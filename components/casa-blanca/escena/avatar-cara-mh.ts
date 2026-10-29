// ──────────────────────────────────────────────────────────────
// CARAS MAKEHUMAN: la entrada única del runtime.
//
// Cambia la cabeza esculpida de hoy (avatar-cabeza.ts) por una cabeza hecha
// con los datos CC0 de MakeHuman, horneada con código propio
// (scripts/caras-mh/, datos en public/casa-blanca/caras/, licencias en
// public/casa-blanca/caras/LICENCIAS.md). Tres archivos más:
//   avatar-cara-mh-cabeza.ts   arma la cabeza (mallas, materiales, texturas).
//   avatar-cara-mh-montaje.ts  la monta sobre el avatar de hoy (escala,
//                              costura del cuello soldada, mismo esqueleto,
//                              pelo de hoy reajustado y horneado).
//   avatar-cara-mh-androide.ts Claude y ChatGPT: la piel del repo sobre la cara.
//
// Nunca bloquea ni rompe la página: el avatar nace con la cabeza de hoy y la
// nueva llega después (carga asíncrona, montajes de a uno). Si algo falla
// (red, datos, pelo de hoy distinto del horneado, error al montar), queda la
// cabeza de hoy: lo que se tocó se restaura.
//
// Interruptor: ?caras=mh | ?caras=hoy en la URL. Sin él: MakeHuman en calidad
// media y alta; la cabeza de hoy en calidad baja.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Avatar } from "./contrato"
import type { Calidad, Personaje } from "../tipos"
import { resolverFicha } from "./avatar-fichas"
import { cargarDatos, construirCabeza, type CabezaMH, type DatosCabeza } from "./avatar-cara-mh-cabeza"
import { huellaDe, materialesMontaje, montarCabezaMH, suavizarCuero, type Montada, type OpcionesMontaje, type PeloHorneado } from "./avatar-cara-mh-montaje"
import { androidizar, esAndroideId, materialAndroide } from "./avatar-cara-mh-androide"

/** Triángulos por personaje con la cara nueva (presupuesto). */
export const TOPE_TRIS = 25000

/** Dónde se sirven los datos horneados. */
export const BASE_CARAS = "/casa-blanca/caras"

/** Los residentes con cara horneada (public/casa-blanca/caras/manifest.json). */
export const CARAS_MH = new Set(["trump", "musk", "altman", "thiel", "karp", "pichai", "amodei", "hormozi", "tate", "gadzhi", "jobs", "kobe", "lincoln", "napoleon", "leonardo", "cleopatra", "suntzu", "marco", "socrates", "jesus", "mason", "iluminado", "claude", "chatgpt"])

/** ¿Lleva cara MakeHuman? `?caras=mh` / `?caras=hoy` mandan; si no, según la calidad. */
export function usaCarasMH(calidad: Calidad): boolean {
  let pedido: string | null = null
  try {
    pedido = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("caras") : null
  } catch {
    pedido = null
  }
  if (pedido === "mh") return true
  if (pedido === "hoy") return false
  return calidad !== "baja"
}

/**
 * Qué lleva la cara según la calidad. Alta (escritorio, estudio): atlas de piel 1024, cejas y pestañas con
 * bordes por cobertura (MSAA) y la pasada transparente del borde del pelo de hoy (solo de cerca). Media y baja:
 * atlas 512, cejas y pestañas recortadas y sin esa pasada.
 */
const nivelDe = (calidad: Calidad) => ({ atlas: calidad === "alta" ? ("alta" as const) : ("baja" as const), bordes: calidad === "alta" })

export async function cargarPeloHorneado(base: string, id: string): Promise<PeloHorneado | null> {
  const r = await fetch(`${base}/${id}/pelo-hoy.json`)
  if (!r.ok) return null
  const j = (await r.json()) as { n: number; min: number[]; esc: number[]; nIdx: number; nCuero: number; huella?: string }
  const rb = await fetch(`${base}/${id}/pelo-hoy.bin`)
  if (!rb.ok) throw new Error(`pelo-hoy.bin ${rb.status}`)
  const b = await rb.arrayBuffer()
  const q16 = new Uint16Array(b, 0, j.n * 3)
  const pos = new Float32Array(j.n * 3)
  for (let i = 0; i < j.n * 3; i++) pos[i] = j.min[i % 3] + q16[i] * j.esc[i % 3]
  let off = j.n * 6
  off += off % 4
  const idx = new Uint32Array(b.slice(off, off + j.nIdx * 4))
  off += j.nIdx * 4
  const cuero = j.nCuero ? Float32Array.from(new Uint8Array(b, off, j.nCuero), (x) => x / 255) : null
  return { n: j.n, pos, idx, cuero, huella: j.huella }
}

/** Resultado de montar una cara. `ok: false` = sigue la cabeza de hoy, intacta. */
export interface CaraMH {
  ok: boolean
  error?: string
  /** Montada: actualizar() después de animar; mallas nuevas; conteos. */
  m?: Montada
  cab?: CabezaMH
  /** Todo lo propio de esta cara (para dispose del avatar): no las texturas compartidas. */
  recursos?: Array<{ dispose(): void }>
  triangulos?: number
  dibujos?: number
  /** cargar: de pedida a montar (red, armado, compilación, cola); montar: el montaje síncrono; pedida y lista: performance.now(). */
  ms?: { cargar: number; montar: number; pedida: number; lista: number }
  info?: Record<string, number | string>
}

/**
 * Lo que el montaje toca del avatar, para dejarlo como estaba si falla a la
 * mitad: hijos de la raíz, visibilidad y material de cada malla, y el índice y
 * las posiciones de la piel y del pelo de hoy (las únicas geometrías que cambia).
 */
function instantanea(raiz: THREE.Object3D): () => void {
  const hijos = new Set(raiz.children)
  const mallas: Array<{ m: THREE.Mesh; visible: boolean; material: THREE.Material | THREE.Material[]; index: THREE.BufferAttribute | null; pos: Float32Array | null; attrs: Set<string> }> = []
  raiz.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const n = (Array.isArray(m.material) ? "" : m.material.name) || ""
    const toca = /^(piel-|pelo-|androide-piel)/.test(n)
    const g = m.geometry
    mallas.push({
      m,
      visible: m.visible,
      material: m.material,
      index: toca ? g.index : null,
      pos: toca ? (g.getAttribute("position").array as Float32Array).slice() : null,
      attrs: new Set(Object.keys(g.attributes)),
    })
  })
  return () => {
    for (const h of [...raiz.children]) if (!hijos.has(h)) raiz.remove(h)
    for (const x of mallas) {
      x.m.visible = x.visible
      x.m.material = x.material
      const g = x.m.geometry
      if (x.index) g.setIndex(x.index)
      if (x.pos) {
        const pa = g.getAttribute("position") as THREE.BufferAttribute
        ;(pa.array as Float32Array).set(x.pos)
        pa.needsUpdate = true
      }
      for (const k of Object.keys(g.attributes)) if (!x.attrs.has(k)) g.deleteAttribute(k)
    }
  }
}

// Montajes de a uno (cada uno, 15–55 ms en una CPU lenta): la página sigue respondiendo entre uno y otro.
let cola: Promise<unknown> = Promise.resolve()
const respiro = () => new Promise<void>((ok) => setTimeout(ok, 16))
/** Ceder el hilo un momento (una tarea nueva: entre medio el navegador puede dibujar un cuadro). */
const ceder = () => new Promise<void>((ok) => setTimeout(ok, 0))
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const r = cola.then(fn)
  cola = r.then(respiro, respiro)
  return r
}

/**
 * Carga, arma y monta la cara de `p` sobre `av` (recién armado con la cabeza de
 * hoy). `antes()` corre justo antes de tocar el avatar (el llamador apaga los
 * rayos X); `vigente()` falso = el avatar ya se desechó: no se monta.
 */
export async function caraMH(
  av: Avatar,
  p: Personaje,
  op: {
    base?: string
    calidad: Calidad
    vigente?: () => boolean
    antes?: () => void
    reajusteVivo?: boolean
    sinPeloHorneado?: boolean
    /** Compila los materiales nuevos sin dibujarlos (renderer.compileAsync): el primer cuadro con la cara no se traba. */
    compilar?: (o: THREE.Object3D) => Promise<unknown>
  },
): Promise<CaraMH> {
  if (!CARAS_MH.has(p.id)) return { ok: false, error: "sin cara MH" }
  const base = op.base ?? BASE_CARAS
  const nivel = nivelDe(op.calidad)
  const t0 = performance.now()
  let d: DatosCabeza
  let pelo: PeloHorneado | null = null
  // 1. Red y datos: nada del avatar se toca todavía.
  try {
    const andro = esAndroideId(p.id)
    ;[d, pelo] = await Promise.all([cargarDatos(base, p.id), andro || op.sinPeloHorneado ? Promise.resolve(null) : cargarPeloHorneado(base, p.id)])
    if (!andro && !op.reajusteVivo) {
      const h = huellaDe(av)
      if (!pelo) throw new Error("falta pelo-hoy horneado")
      if (h && (h.n !== pelo.n || (pelo.huella && pelo.huella !== h.huella))) throw new Error(`el pelo de hoy cambió (huella ${pelo.huella} != ${h.huella}): hay que re-hornear pelo-hoy`)
    }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) }
  }
  return enCola(async () => {
    if (op.vigente && !op.vigente()) return { ok: false, error: "avatar desechado" }
    // 2. Armar la cabeza (texturas compartidas, una sola vez).
    let cab: CabezaMH
    try {
      const f = resolverFicha(p)
      cab = await construirCabeza(d, {
        piel: f.piel.base, pelo: f.pelo.color, canas: f.pelo.canas, barba: f.barba?.color ?? f.pelo.color,
        cejas: f.cejas.color, iris: d.cab.cfg.iris ?? f.iris, brillo: f.piel.brillo, calidad: nivel.atlas,
        cobertura: nivel.bordes, sombraOjos: f.piel.sombraOjos?.[0], pielAparte: esAndroideId(p.id),
      })
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) }
    }
    const liberarCab = () => { for (const r of cab.recursos) r.dispose() }
    if (op.vigente && !op.vigente()) {
      liberarCab()
      return { ok: false, error: "avatar desechado" }
    }
    // 3. Los materiales que el montaje pone en el avatar (sin tocarlo todavía) y, si se puede, compilarlos
    // aparte con mallas de muestra (mismo esqueleto, mismos morphs): el primer cuadro con la cara no compila nada.
    const opMontaje: OpcionesMontaje = { ...(d.cab.cfg.montaje ?? {}), peloHoy: true, peloHorneado: pelo, reajusteVivo: op.reajusteVivo, bordePelo: nivel.bordes, trisAvatar: av.raiz.userData.triangulos as number | undefined, topeTris: TOPE_TRIS }
    // el cuero bajo el pelo suavizado (solo lee la cabeza): aquí, no en la tarea del montaje
    if (pelo?.cuero && opMontaje.cueroSuave) {
      pelo = { ...pelo, cuero: suavizarCuero(cab.piel.geometry, pelo.cuero, opMontaje.cueroSuave, 0.1) }
      opMontaje.peloHorneado = pelo
      opMontaje.cueroSuave = 0
    }
    let mats: ReturnType<typeof materialesMontaje>
    try {
      mats = materialesMontaje(av, cab, opMontaje)
    } catch (e) {
      liberarCab()
      return { ok: false, error: String((e as Error)?.message ?? e) }
    }
    const liberarMats = () => { for (const r of mats.recursos) r.dispose() }
    if (op.compilar) {
      let sk: THREE.Skeleton | null = null
      av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!sk && m.isSkinnedMesh) sk = m.skeleton })
      if (sk) {
        const muestra = new THREE.Group()
        const ident = new THREE.Matrix4()
        const agregar = (g: THREE.BufferGeometry, m: THREE.Material, origen?: THREE.Mesh) => {
          const sm = new THREE.SkinnedMesh(g, m)
          sm.bind(sk!, ident)
          sm.receiveShadow = true
          if (origen?.morphTargetInfluences) sm.morphTargetInfluences = [...origen.morphTargetInfluences]
          muestra.add(sm)
        }
        for (const m of cab.mallas) agregar(m.geometry, m.material as THREE.Material, m)
        for (const x of mats.muestras) agregar(x.geo, x.mat)
        const mAndro = materialAndroide(p.id)
        if (mAndro) agregar(cab.piel.geometry, mAndro, cab.piel)
        try {
          await op.compilar(muestra)
        } catch {
          // sin compilar antes: se compila en el primer cuadro, como siempre
        }
      }
      if (op.vigente && !op.vigente()) {
        liberarMats()
        liberarCab()
        return { ok: false, error: "avatar desechado" }
      }
    }
    // armar la cabeza y montarla son dos tareas: el navegador puede dibujar un cuadro entre medio
    await ceder()
    if (op.vigente && !op.vigente()) {
      liberarMats()
      liberarCab()
      return { ok: false, error: "avatar desechado" }
    }
    const t1 = performance.now()
    // 4. Montar (síncrono). Si falla a la mitad, se restaura todo lo tocado.
    op.antes?.()
    const restaurar = instantanea(av.raiz)
    try {
      const m = montarCabezaMH(av, cab, d, { ...opMontaje, mats })
      let triangulos = m.triangulos, dibujos = m.dibujos
      const recursos = [...cab.recursos, ...m.recursos]
      let info = m.info
      if (esAndroideId(p.id)) {
        const a = androidizar(av, cab, p.id)
        triangulos += a.triangulos
        dibujos += a.dibujos
        recursos.push(...a.recursos)
        info = { ...info, ...a.info }
      }
      return { ok: true, m, cab, recursos, triangulos, dibujos, info, ms: { cargar: Math.round(t1 - t0), montar: Math.round(performance.now() - t1), pedida: Math.round(t0), lista: Math.round(performance.now()) } }
    } catch (e) {
      restaurar()
      liberarMats()
      liberarCab()
      return { ok: false, error: String((e as Error)?.message ?? e) }
    }
  })
}
