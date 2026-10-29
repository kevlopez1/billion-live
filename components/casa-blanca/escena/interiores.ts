// ──────────────────────────────────────────────────────────────
// LOS INTERIORES: se entra a un edificio y se ve una planta por dentro
//
// Corte de maqueta, como el subsuelo: con una planta abierta, la fachada real
// del edificio (arquitectura.ts) se corta a CORTE metros sobre ese piso con un
// plano de recorte (clones de sus materiales con `clippingPlanes`; no hay muros
// exteriores nuevos), el corte lleva un remate oscuro y adentro aparecen los
// cuartos de plantas.ts: pisos, muros cortados a la misma altura, puertas y muebles.
//
// Presupuesto (por planta, calidad media): ≤ 40 llamadas y ≤ 150 mil triángulos.
//   - Muros, muebles y lámparas: UNA malla (material "maqueta": color,
//     rugosidad y brillo por vértice; lote.ts).
//   - Pisos: una malla por textura (parquet, mármol, damero) y una de alfombras.
//   - La luz de las arañas de noche: una malla aditiva en el piso.
//   - Sin luces reales: de noche brillan lámparas, chimeneas y un tono cálido (ctx.alAnochecer).
// Nada se construye en la carga: una planta se arma la primera vez que se abre.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { HUELLAS } from "../lugares"
import {
  CORTE,
  MACIZOS,
  MUROS,
  PLANTA,
  PUERTAS,
  VENTANAS,
  CUARTO,
  ESCALERAS,
  cuartoEn,
  cuartosDe,
  medidasEscalera,
  pozosDe,
  rectPuerta,
  sillasDeMesa,
  MEDIDA,
  type Cuarto,
  type EdificioId,
  type Escalera,
  type Mueble,
  type PlantaId,
  type Rect,
} from "../plantas"
import type { CtxEscena } from "./contrato"
import { A, BOX, CIL, ESF, Lote, M, crearMaqueta, type Acabado } from "./lote"
import { BORDE_ALA, FORRO, INTERIOR_EEOB, INTERIOR_TESORO, OVAL, PATIOS_EEOB } from "../plantas-edificios"

// ── Paleta ──────────────────────────────────────────────────────
const P = {
  remate: "#1f2228",
  neutro: "#d6d0c4",
  marfil: "#dcd6ca",
  marmol: "#d9d4cb",
  marmolGris: "#cfcac2",
  oro: "#c9a24e",
  oroViejo: "#a7823b",
  madera: "#5a3b22",
  caoba: "#4a2614",
  nogal: "#3d2716",
  negro: "#15120f",
  hoja: "#3f7a3c",
  hojaClara: "#5c9446",
  pantalla: "#f6e7c4",
  fuego: "#ff8a3a",
  llama: "#ffcf7a",
  porcelana: "#e2ded6",
  flor: "#c8344a",
  florB: "#f1e3a8",
  piel: "#c9a07a",
}

/** Un poco de brillo propio a todo de noche: la casa tiene la luz prendida. */
const NOCHE_BASE = 0.1
const ac = (a: Acabado, e = NOCHE_BASE): Acabado => ({ ...a, e: a.e ?? e })
const MATE = ac(A.mate)
const TELA = ac(A.tela)
const SATIN = ac(A.satin)
const LACA = ac(A.laca)
const PULIDO = ac(A.pulido)
const METAL = ac(A.metal, 0.12)
const ESPEJO = ac(A.espejo, 0.12)
const LUZ = (e: number): Acabado => A.luz(e)

// ── Texturas de piso (dibujadas, nada externo; con semilla: salen iguales siempre) ──
function azar(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function lienzo(n: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas")
  c.width = n
  c.height = n
  return { c, g: c.getContext("2d")! }
}
function textura(c: HTMLCanvasElement, repetir: boolean, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Parquet de tablas en espiga (la Fontainebleau del Salón Este): 2,4 m por repetición. */
function texParquet(aniso: number) {
  const n = 512
  const { c, g } = lienzo(n)
  const r = azar(11)
  g.fillStyle = "#8a5a32"
  g.fillRect(0, 0, n, n)
  const ancho = n / 8
  const largo = ancho * 3
  for (let fila = -1; fila < 9; fila++) {
    for (let col = -1; col < 6; col++) {
      for (const lado of [0, 1]) {
        const tono = 0.82 + r() * 0.3
        const base = [176, 118, 68].map((v) => Math.min(255, Math.round(v * tono)))
        g.save()
        const x = col * ancho * 2 + (lado ? ancho : 0)
        const y = fila * ancho + (lado ? ancho / 2 : 0)
        g.translate(x, y)
        g.rotate(lado ? Math.PI / 4 : -Math.PI / 4)
        const grad = g.createLinearGradient(0, 0, largo, 0)
        grad.addColorStop(0, `rgb(${base.join(",")})`)
        grad.addColorStop(0.5, `rgb(${base.map((v) => Math.round(v * 0.9)).join(",")})`)
        grad.addColorStop(1, `rgb(${base.join(",")})`)
        g.fillStyle = grad
        g.fillRect(0, 0, largo, ancho * 0.72)
        g.strokeStyle = "rgba(40,22,10,0.55)"
        g.lineWidth = 1.5
        g.strokeRect(0, 0, largo, ancho * 0.72)
        // Veta
        g.strokeStyle = "rgba(70,40,18,0.18)"
        g.lineWidth = 1
        for (let k = 0; k < 4; k++) {
          const yy = 4 + r() * ancho * 0.6
          g.beginPath()
          g.moveTo(0, yy)
          g.bezierCurveTo(largo * 0.3, yy + r() * 4 - 2, largo * 0.6, yy + r() * 4 - 2, largo, yy)
          g.stroke()
        }
        g.restore()
      }
    }
  }
  return textura(c, true, aniso)
}

/** Mármol blanco con vetas grises: 3,2 m por repetición. */
function texMarmol(aniso: number, semilla = 5, base = "#efebe4", veta = "rgba(120,116,110,") {
  const n = 512
  const { c, g } = lienzo(n)
  const r = azar(semilla)
  g.fillStyle = base
  g.fillRect(0, 0, n, n)
  for (let k = 0; k < 26; k++) {
    let x = r() * n
    let y = r() * n
    const a = r() * Math.PI * 2
    g.strokeStyle = `${veta}${(0.05 + r() * 0.16).toFixed(3)})`
    g.lineWidth = 0.6 + r() * 2.2
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 8; s++) {
      x += Math.cos(a + (r() - 0.5) * 1.2) * 40
      y += Math.sin(a + (r() - 0.5) * 1.2) * 40
      g.lineTo(x, y)
    }
    g.stroke()
  }
  // Juntas de las losas (cuatro por lado).
  g.strokeStyle = "rgba(90,86,80,0.35)"
  g.lineWidth = 2
  for (let i = 0; i <= 4; i++) {
    g.beginPath()
    g.moveTo((i * n) / 4, 0)
    g.lineTo((i * n) / 4, n)
    g.moveTo(0, (i * n) / 4)
    g.lineTo(n, (i * n) / 4)
    g.stroke()
  }
  return textura(c, true, aniso)
}

/** Damero de mármol gris y blanco (el Vestíbulo): 1,6 m por repetición. */
function texDamero(aniso: number) {
  const n = 512
  const { c, g } = lienzo(n)
  const blanco = texMarmol(1, 8).image as HTMLCanvasElement
  const gris = texMarmol(1, 9, "#8d8984", "rgba(40,38,36,").image as HTMLCanvasElement
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const src = (i + j) % 2 ? gris : blanco
      g.drawImage(src, (i * n) / 2, (j * n) / 2, n / 2, n / 2, (i * n) / 2, (j * n) / 2, n / 2, n / 2)
    }
  g.strokeStyle = "rgba(60,58,54,0.5)"
  g.lineWidth = 2
  g.strokeRect(0, 0, n, n)
  g.beginPath()
  g.moveTo(n / 2, 0)
  g.lineTo(n / 2, n)
  g.moveTo(0, n / 2)
  g.lineTo(n, n / 2)
  g.stroke()
  return textura(c, true, aniso)
}

/** Alfombra: guarda, medallón y motivos en grises (el color sale del vértice). La esquina de arriba es blanco liso. */
function texAlfombra(aniso: number) {
  const n = 512
  const { c, g } = lienzo(n)
  const r = azar(21)
  g.fillStyle = "#b9b9b9"
  g.fillRect(0, 0, n, n)
  // Motivos del campo
  g.fillStyle = "rgba(255,255,255,0.12)"
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 12; j++) {
      const x = 40 + i * 36
      const y = 40 + j * 36
      g.beginPath()
      g.ellipse(x, y, 6 + r() * 2, 3, ((i + j) % 2) * Math.PI * 0.5, 0, Math.PI * 2)
      g.fill()
    }
  // Medallón
  const grad = g.createRadialGradient(n / 2, n / 2, 10, n / 2, n / 2, 150)
  grad.addColorStop(0, "rgba(255,255,255,0.55)")
  grad.addColorStop(0.55, "rgba(255,255,255,0.25)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.beginPath()
  g.ellipse(n / 2, n / 2, 150, 110, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = "rgba(60,60,60,0.45)"
  g.lineWidth = 3
  g.beginPath()
  g.ellipse(n / 2, n / 2, 120, 86, 0, 0, Math.PI * 2)
  g.stroke()
  // Guarda interior
  g.strokeStyle = "rgba(255,255,255,0.4)"
  g.lineWidth = 10
  g.strokeRect(34, 34, n - 68, n - 68)
  g.strokeStyle = "rgba(40,40,40,0.35)"
  g.lineWidth = 3
  g.strokeRect(48, 48, n - 96, n - 96)
  // La esquina de arriba a la izquierda: blanco liso (para pintar la guarda de un solo color).
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, 12, 12)
  return textura(c, false, aniso)
}
const UV_LISO: [number, number, number, number] = [0.004, 0.996, 0.016, 0.984]

/** Charco de luz de una araña: degradé radial para mezcla aditiva. */
function texCharco() {
  const n = 128
  const { c, g } = lienzo(n)
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, n, n)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ── Utilidades ──────────────────────────────────────────────────
const _sh = new THREE.Vector2()

/** Polígono horizontal (x, z) a la altura y, mirando hacia arriba. */
function geoPoligono(pts: Array<[number, number]>, y: number): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, z]) => _sh.clone().set(x, -z)))
  const g = new THREE.ShapeGeometry(s, 12)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  const r = g.toNonIndexed()
  g.dispose()
  return r
}

/** Contorno de un salón oval (estadio) en orden. */
function contornoOvalo(c: Cuarto, inset = 0, n = 20): Array<[number, number]> {
  const r = (c.rect.x1 - c.rect.x0) / 2 - inset
  const cx = (c.rect.x0 + c.rect.x1) / 2
  const { norte, sur } = c.ovalo!
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI * i) / n // de oeste a este por el norte
    pts.push([cx + r * Math.cos(a), norte + r * Math.sin(a)])
  }
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n // de este a oeste por el sur
    pts.push([cx + r * Math.cos(a), sur + r * Math.sin(a)])
  }
  return pts
}

/** Contorno del Despacho Oval (una elipse) en orden. */
function contornoElipse(c: Cuarto, n = 48): Array<[number, number]> {
  const cx = (c.rect.x0 + c.rect.x1) / 2
  const cz = (c.rect.z0 + c.rect.z1) / 2
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n
    return [cx + c.elipse!.rx * Math.cos(a), cz + c.elipse!.rz * Math.sin(a)] as [number, number]
  })
}

/** Un rectángulo sin el hueco (hasta cuatro pedazos). */
function sinHueco(r: Rect, h0?: Rect): Rect[] {
  if (!h0) return [r]
  const h = { x0: Math.max(r.x0, h0.x0), x1: Math.min(r.x1, h0.x1), z0: Math.max(r.z0, h0.z0), z1: Math.min(r.z1, h0.z1) }
  if (h.x1 <= h.x0 || h.z1 <= h.z0) return [r]
  const out: Rect[] = []
  if (h.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 })
  if (h.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 })
  if (h.x0 > r.x0) out.push({ x0: r.x0, x1: h.x0, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) })
  if (h.x1 < r.x1) out.push({ x0: h.x1, x1: r.x1, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) })
  return out.filter((q) => q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01)
}

// ── Lo que se construye por planta ──────────────────────────────
interface Mats {
  maqueta: THREE.MeshStandardMaterial
  parquet: THREE.MeshStandardMaterial
  marmol: THREE.MeshStandardMaterial
  damero: THREE.MeshStandardMaterial
  alfombra: THREE.MeshStandardMaterial
  charco: THREE.MeshBasicMaterial
}

class ConstructorPlanta {
  readonly L = new Lote()
  readonly pisos = { parquet: new Lote(), marmol: new Lote(), damero: new Lote(), alfombra: new Lote() }
  readonly charcos = new Lote()
  readonly y: number
  constructor(readonly planta: PlantaId) {
    this.y = PLANTA[planta].y
  }

  /** El color de muro del cuarto que hay en (x, z), o el neutro. */
  colorEn(x: number, z: number): { muro: string; zocalo?: string } {
    const c = cuartoEn(this.planta, x, z)
    return c ? { muro: c.muro, zocalo: c.zocalo } : { muro: P.neutro }
  }

  /**
   * Un muro recto de piso a CORTE: cada cara toma el color del cuarto al que
   * mira (partida donde cambia de cuarto), zócalo abajo y remate oscuro arriba.
   */
  bloque(r: Rect, y0 = this.y, y1 = this.y + CORTE) {
    const L = this.L
    const h = y1 - y0
    const caras: Array<{ fijo: number; a0: number; a1: number; eje: "x" | "z"; n: 1 | -1 }> = [
      { fijo: r.z0, a0: r.x0, a1: r.x1, eje: "x", n: -1 },
      { fijo: r.z1, a0: r.x0, a1: r.x1, eje: "x", n: 1 },
      { fijo: r.x0, a0: r.z0, a1: r.z1, eje: "z", n: -1 },
      { fijo: r.x1, a0: r.z0, a1: r.z1, eje: "z", n: 1 },
    ]
    for (const cara of caras) {
      // Cortes donde empieza o termina un cuarto a lo largo de la cara.
      const cortes = new Set<number>([cara.a0, cara.a1])
      for (const c of cuartosDe(this.planta)) {
        for (const v of cara.eje === "x" ? [c.rect.x0, c.rect.x1] : [c.rect.z0, c.rect.z1]) if (v > cara.a0 + 0.05 && v < cara.a1 - 0.05) cortes.add(v)
      }
      const lista = [...cortes].sort((a, b) => a - b)
      for (let i = 0; i < lista.length - 1; i++) {
        const a0 = lista[i]
        const a1 = lista[i + 1]
        const m = (a0 + a1) / 2
        const fuera = cara.fijo + cara.n * 0.2
        const col = cara.eje === "x" ? this.colorEn(m, fuera) : this.colorEn(fuera, m)
        const ry = cara.eje === "x" ? (cara.n > 0 ? 0 : Math.PI) : cara.n > 0 ? Math.PI / 2 : -Math.PI / 2
        const ancho = a1 - a0
        const x = cara.eje === "x" ? m : cara.fijo
        const z = cara.eje === "x" ? cara.fijo : m
        L.quad(x, y0 + h / 2, z, ancho, h, ry, col.muro, SATIN)
        if (col.zocalo && ancho > 0.4) {
          const dx = cara.eje === "z" ? cara.n * 0.012 : 0
          const dz = cara.eje === "x" ? cara.n * 0.012 : 0
          L.quad(x + dx, y0 + 0.13, z + dz, ancho, 0.26, ry, col.zocalo, LACA)
          // Moldura a la altura de la silla.
          L.quad(x + dx, y0 + 0.92, z + dz, ancho, 0.05, ry, col.zocalo, LACA)
        }
      }
    }
    L.piso(r.x0, r.x1, r.z0, r.z1, y1, P.remate, ac(A.mate, 0))
  }

  /** Un muro macizo de forma libre: caras por lado (color del cuarto al que mira) y tapa oscura. */
  macizo(pts: Array<[number, number]>) {
    const L = this.L
    const y0 = this.y
    const y1 = this.y + CORTE
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % pts.length]
      area += ax * bz - bx * az
    }
    const signo = area > 0 ? 1 : -1
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % pts.length]
      const dx = bx - ax
      const dz = bz - az
      const largo = Math.hypot(dx, dz)
      if (largo < 1e-3) continue
      // Normal hacia afuera del polígono.
      const nx = (-dz / largo) * -signo
      const nz = (dx / largo) * -signo
      const mx = (ax + bx) / 2
      const mz = (az + bz) / 2
      const col = this.colorEn(mx + nx * 0.2, mz + nz * 0.2)
      L.quad(mx, (y0 + y1) / 2, mz, largo + 0.01, CORTE, Math.atan2(nx, nz), col.muro, SATIN)
      if (col.zocalo) L.quad(mx + nx * 0.012, y0 + 0.13, mz + nz * 0.012, largo + 0.01, 0.26, Math.atan2(nx, nz), col.zocalo, LACA)
    }
    L.geo(geoPoligono(pts, y1), new THREE.Matrix4(), P.remate, ac(A.mate, 0))
  }

  /** Piso de un cuarto con su textura (coordenadas del mundo: las juntas siguen de un cuarto al otro). */
  piso(c: Cuarto) {
    const y = this.y + 0.004
    const estilo = c.piso
    const lote = estilo === "parquet" ? this.pisos.parquet : estilo === "damero" ? this.pisos.damero : estilo === "marmol" ? this.pisos.marmol : null
    const T = estilo === "parquet" ? 2.4 : estilo === "damero" ? 1.6 : 3.2
    const tinte = c.colorPiso ?? (estilo === "parquet" ? (c.id === "salon-este" ? "#f2e8da" : "#e8dfd2") : "#cfc9bf")
    if (c.ovalo || c.elipse) {
      const g = geoPoligono(c.elipse ? contornoElipse(c) : contornoOvalo(c), y)
      if (lote) lote.geo(g, new THREE.Matrix4(), tinte, ac(A.laca, 0.3), { uv: [0, 0, 1 / T, 1 / T] })
      else this.L.geo(g, new THREE.Matrix4(), "#d8d2c6", ac(A.satin, 0.3))
      return
    }
    // Sin el hueco de la escalinata ni el pozo por donde llega la escalera de abajo.
    let piezas = sinHueco(c.rect, c.hueco)
    for (const pz of pozosDe(c)) piezas = piezas.flatMap((r) => (r.x1 <= pz.x0 || r.x0 >= pz.x1 || r.z1 <= pz.z0 || r.z0 >= pz.z1 ? [r] : sinHueco(r, pz)))
    const liso = c.colorPiso ?? (c.id.startsWith("nucleo") ? "#b9b2a6" : c.id === "cocina" ? "#e9e7e2" : c.id === "gimnasio-res" ? "#4a4e52" : "#d8d2c6")
    for (const r of piezas) {
      if (lote) lote.piso(r.x0, r.x1, r.z0, r.z1, y, tinte, ac(estilo === "parquet" ? A.laca : A.pulido, 0.3), [r.x0 / T, r.z0 / T, r.x1 / T, r.z1 / T])
      else this.L.piso(r.x0, r.x1, r.z0, r.z1, y, liso, ac(A.satin, 0.3))
    }
  }

  alfombras(c: Cuarto) {
    const y = this.y
    for (const a of c.alfombras ?? []) {
      const L = this.pisos.alfombra
      const cx = (a.x0 + a.x1) / 2
      const cz = (a.z0 + a.z1) / 2
      const w = a.x1 - a.x0
      const d = a.z1 - a.z0
      const T = ac(A.tela, 0.22)
      if (a.oval) {
        const circ = new THREE.CircleGeometry(1, 48).toNonIndexed()
        L.geo(circ, M(cx, y + 0.014, cz, w / 2, d / 2, 1, 0, -Math.PI / 2), a.borde, T, { uv: UV_LISO })
        L.geo(circ, M(cx, y + 0.018, cz, w / 2 - 0.22, d / 2 - 0.22, 1, 0, -Math.PI / 2), a.color, T, { uv: [0, 0, 1, 1] })
      } else {
        L.piso(a.x0, a.x1, a.z0, a.z1, y + 0.014, a.borde, T, UV_LISO)
        L.piso(a.x0 + 0.24, a.x1 - 0.24, a.z0 + 0.24, a.z1 - 0.24, y + 0.018, a.color, T, [0, 0, 1, 1])
      }
    }
  }

  /** La luz de una araña en el piso (de noche). */
  charco(x: number, z: number, r: number, fuerza = 1) {
    const k = Math.min(1, fuerza)
    this.charcos.geo(new THREE.PlaneGeometry(1, 1).toNonIndexed(), M(x, this.y + 0.03, z, r * 2, r * 2, 1, 0, -Math.PI / 2), new THREE.Color(1, 0.78, 0.5).multiplyScalar(k), A.mate, { uv: [0, 0, 1, 1] })
  }
}

// ── Muebles (coordenadas locales: el frente mira a +z, el piso en y = 0) ──
type Dibujo = (L: Lote, m: Mueble) => void

function lampara(L: Lote, x: number, y: number, z: number, escala = 1) {
  L.cil(x, y, z, 0.07 * escala, 0.06 * escala, P.oro, METAL, 10)
  L.cil(x, y + 0.06 * escala, z, 0.025 * escala, 0.34 * escala, P.oro, METAL, 8)
  L.cil(x, y + 0.38 * escala, z, 0.19 * escala, 0.24 * escala, P.pantalla, LUZ(0.85), 14, 0.6)
}
function candelabro(L: Lote, x: number, y: number, z: number) {
  L.cil(x, y, z, 0.06, 0.03, P.oro, METAL, 10)
  L.cil(x, y + 0.03, z, 0.018, 0.34, P.oro, METAL, 6)
  for (const s of [-0.11, 0, 0.11]) {
    L.barra([x, y + 0.3, z], [x + s, y + 0.36, z], 0.01, P.oro, METAL, 5)
    L.cil(x + s, y + 0.36, z, 0.012, 0.09, P.porcelana, SATIN, 6)
    L.esf(x + s, y + 0.47, z, 0.02, P.llama, LUZ(3), 1.6, 6, 4)
  }
}
function flores(L: Lote, x: number, y: number, z: number, r = 0.2) {
  L.cil(x, y, z, r * 0.45, r * 0.9, P.porcelana, PULIDO, 10, 1.2)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    L.esf(x + Math.cos(a) * r * 0.5, y + r * 1.05 + (i % 2) * r * 0.2, z + Math.sin(a) * r * 0.5, r * 0.32, i % 3 ? P.flor : P.florB, TELA, 1, 7, 5)
  }
  L.esf(x, y + r * 1.25, z, r * 0.38, P.hoja, TELA, 0.8, 7, 5)
}

function silla(L: Lote, col: string, alto = 0.98) {
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) L.caja(sx, 0, sz, 0.045, 0.45, 0.045, P.oro, METAL)
  L.caja(0, 0.43, 0, 0.5, 0.07, 0.5, col, TELA)
  L.caja(0, 0.45, -0.23, 0.46, alto - 0.45, 0.05, P.oro, METAL)
  L.caja(0, 0.55, -0.2, 0.36, alto - 0.65, 0.025, col, TELA)
}

const MUEBLES: Record<string, Dibujo> = {
  mesaComedor(L, m) {
    const w = m.w ?? MEDIDA.mesaComedor[0]
    const d = m.d ?? MEDIDA.mesaComedor[1]
    const col = m.color ?? P.caoba
    L.caja(0, 0.7, 0, w, 0.05, d, col, LACA)
    L.caja(0, 0.6, 0, w - 0.12, 0.1, d - 0.12, col, SATIN)
    const patas = Math.max(2, Math.round(d / 2.2))
    for (let i = 0; i < patas; i++) {
      const z = -d / 2 + 0.35 + ((d - 0.7) * i) / Math.max(1, patas - 1)
      L.cil(0, 0, z, 0.09, 0.6, col, SATIN, 10)
      L.caja(0, 0, z, w * 0.6, 0.06, 0.18, col, SATIN)
    }
    // Centro de mesa: bandeja dorada, flores y candelabros.
    if (d > 4) {
      L.caja(0, 0.75, 0, 0.42, 0.04, d * 0.62, P.oro, METAL)
      for (let i = 0; i < 4; i++) flores(L, 0, 0.79, -d * 0.24 + (d * 0.48 * i) / 3, 0.14)
      for (const z of [-d * 0.36, -d * 0.12, d * 0.12, d * 0.36]) candelabro(L, 0, 0.79, z)
    } else {
      flores(L, 0, 0.75, 0, 0.16)
      candelabro(L, 0, 0.75, -d * 0.3)
      candelabro(L, 0, 0.75, d * 0.3)
    }
  },
  mesaRedonda(L, m) {
    const r = (m.w ?? MEDIDA.mesaRedonda[0]) / 2
    L.cil(0, 0.7, 0, r, 0.045, m.color ?? P.marmol, PULIDO, 28)
    L.cil(0, 0.62, 0, r * 0.92, 0.08, P.oro, METAL, 24)
    L.cil(0, 0.08, 0, 0.08, 0.55, P.oro, METAL, 10)
    L.cil(0, 0, 0, r * 0.45, 0.08, P.oroViejo, METAL, 16)
    flores(L, 0, 0.745, 0, 0.17)
  },
  mesita(L, m) {
    const w = m.w ?? MEDIDA.mesita[0]
    const d = m.d ?? MEDIDA.mesita[1]
    L.caja(0, 0.42, 0, w, 0.05, d, m.color ?? P.madera, LACA)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.caja((sx * (w - 0.1)) / 2, 0, (sz * (d - 0.1)) / 2, 0.05, 0.42, 0.05, P.oro, METAL)
    lampara(L, w * 0.3, 0.47, 0, 0.6)
  },
  silla(L, m) {
    silla(L, m.color ?? "#b8923f")
  },
  butaca(L, m) {
    const col = m.color ?? "#b8923f"
    for (const sx of [-0.32, 0.32]) for (const sz of [-0.3, 0.3]) L.caja(sx, 0, sz, 0.06, 0.18, 0.06, P.oro, METAL)
    L.caja(0, 0.18, 0, 0.76, 0.26, 0.72, col, TELA)
    L.caja(0, 0.44, 0.04, 0.6, 0.08, 0.6, col, TELA)
    L.caja(0, 0.18, -0.32, 0.76, 0.72, 0.12, col, TELA)
    for (const sx of [-0.35, 0.35]) L.caja(sx, 0.44, 0, 0.08, 0.22, 0.64, P.oro, METAL)
  },
  sofa(L, m) {
    const w = m.w ?? MEDIDA.sofa[0]
    const col = m.color ?? "#b8923f"
    for (const sx of [-1, 1]) for (const sz of [-0.33, 0.33]) L.caja((sx * (w - 0.12)) / 2, 0, sz, 0.06, 0.16, 0.06, P.oro, METAL)
    L.caja(0, 0.16, 0, w, 0.26, 0.82, col, TELA)
    for (const s of [-1, 1]) L.caja((s * w) / 4, 0.42, 0.05, w / 2 - 0.06, 0.09, 0.66, col, TELA)
    L.caja(0, 0.16, -0.36, w, 0.78, 0.14, col, TELA)
    L.caja(0, 0.92, -0.37, w * 0.55, 0.08, 0.1, P.oro, METAL)
    for (const s of [-1, 1]) L.caja((s * (w - 0.12)) / 2, 0.16, 0, 0.14, 0.48, 0.8, col, TELA)
  },
  banco(L, m) {
    const w = m.w ?? MEDIDA.banco[0]
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.caja((sx * (w - 0.1)) / 2, 0, sz * 0.18, 0.05, 0.36, 0.05, P.oro, METAL)
    L.caja(0, 0.36, 0, w, 0.12, 0.46, m.color ?? "#9e1f24", TELA)
  },
  consola(L, m) {
    const w = m.w ?? MEDIDA.consola[0]
    L.caja(0, 0.82, 0, w, 0.05, 0.44, P.marmol, PULIDO)
    L.caja(0, 0.7, 0, w - 0.06, 0.12, 0.4, m.color ?? P.oro, METAL)
    for (const sx of [-1, 1]) L.caja((sx * (w - 0.12)) / 2, 0, 0.1, 0.07, 0.7, 0.07, m.color ?? P.oro, METAL)
    // Espejo dorado en el muro.
    L.caja(0, 1.05, -0.2, w * 0.82, 1.5, 0.05, P.oro, METAL)
    L.quad(0, 1.8, -0.17, w * 0.72, 1.38, 0, "#bcc6cc", ESPEJO)
    lampara(L, -w * 0.3, 0.87, 0, 0.8)
    flores(L, w * 0.25, 0.87, 0, 0.14)
  },
  aparador(L, m) {
    const w = m.w ?? MEDIDA.aparador[0]
    L.caja(0, 0, 0, w, 0.9, 0.56, m.color ?? P.madera, SATIN)
    L.caja(0, 0.9, 0.01, w + 0.06, 0.04, 0.6, P.marmol, PULIDO)
    for (let i = 0; i < 3; i++) L.caja(-w / 3 + (w / 3) * i, 0.12, 0.285, w / 3 - 0.08, 0.66, 0.02, P.caoba, LACA)
    candelabro(L, -w * 0.35, 0.94, 0)
    candelabro(L, w * 0.35, 0.94, 0)
    flores(L, 0, 0.94, 0, 0.17)
  },
  chimenea(L, m) {
    const w = m.w ?? MEDIDA.chimenea[0]
    const col = m.color ?? P.marmol
    L.caja(0, 0, 0.12, w + 0.3, 0.04, 0.62, "#d9d2c6", PULIDO)
    for (const s of [-1, 1]) L.caja((s * (w - 0.3)) / 2, 0, 0, 0.3, 1.12, 0.38, col, PULIDO)
    L.caja(0, 0.84, 0, w, 0.28, 0.38, col, PULIDO)
    L.caja(0, 1.12, 0.03, w + 0.22, 0.07, 0.48, col, PULIDO)
    L.caja(0, 0.04, -0.12, w - 0.6, 0.8, 0.14, "#1a1512", ac(A.mate, 0))
    L.caja(0, 0.06, -0.05, w - 0.8, 0.22, 0.06, P.fuego, LUZ(1.4))
    for (const s of [-1, 1]) candelabro(L, s * (w / 2 - 0.15), 1.19, 0.05)
    L.caja(0, 1.19, 0.02, 0.32, 0.36, 0.16, P.oro, METAL)
  },
  piano(L, m) {
    // Un piano de cola: el teclado mira a +z.
    const col = m.color ?? P.negro
    L.caja(0, 0.62, -0.25, 1.52, 0.34, 1.7, col, LACA)
    L.cil(0, 0.62, -1.1, 0.76, 0.34, col, LACA, 24)
    L.caja(0.05, 0.98, -0.6, 1.4, 0.03, 1.9, col, LACA, 0, -0.32)
    L.caja(0, 0.82, 0.68, 1.42, 0.06, 0.2, "#f4f1ea", PULIDO)
    L.caja(0, 0.85, 0.66, 1.4, 0.03, 0.08, P.negro, LACA)
    for (const [x, z] of [
      [-0.65, 0.5],
      [0.65, 0.5],
      [0, -1.5],
    ])
      L.cil(x, 0, z, 0.07, 0.62, P.oro, METAL, 10)
    L.caja(0, 0.46, 1.25, 0.9, 0.06, 0.36, P.negro, LACA)
    for (const sx of [-0.38, 0.38]) L.caja(sx, 0, 1.25, 0.05, 0.46, 0.3, P.negro, LACA)
  },
  cuadro(L, m) {
    const w = m.w ?? MEDIDA.cuadro[0]
    const alto = m.alto ?? 1.4
    const y0 = m.y ?? 1.0
    const tono = m.tono ?? "#2f2a24"
    L.quad(0, y0 + alto / 2, 0.02, w - 0.14, alto - 0.14, 0, tono, ac(A.satin, 0.15))
    // Retrato: la figura y la cara, apenas sugeridas.
    L.geo(BOX(), M(0, y0 + alto * 0.36, 0.024, w * 0.46, alto * 0.48, 0.006), "#1c1915", ac(A.satin, 0.1))
    L.geo(ESF(12, 8), M(0, y0 + alto * 0.7, 0.026, w * 0.09, alto * 0.075, 0.006), P.piel, ac(A.satin, 0.15))
    const e = 0.08
    L.caja(0, y0, 0.01, w, e, 0.06, P.oro, METAL)
    L.caja(0, y0 + alto - e, 0.01, w, e, 0.06, P.oro, METAL)
    for (const s of [-1, 1]) L.caja((s * (w - e)) / 2, y0, 0.01, e, alto, 0.06, P.oro, METAL)
    // Una luz chica de cuadro.
    L.caja(0, y0 + alto + 0.04, 0.08, w * 0.4, 0.04, 0.06, P.oro, LUZ(0.8))
  },
  palmera(L) {
    L.cil(0, 0, 0, 0.3, 0.5, P.porcelana, PULIDO, 14, 1.15)
    L.cil(0, 0.5, 0, 0.3, 0.03, "#3a2a1f", MATE, 14)
    L.cil(0, 0.5, 0, 0.045, 1.1, "#6b5136", MATE, 6, 0.7)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const caida = 0.35 + (i % 3) * 0.15
      L.geo(BOX(), M(Math.sin(a) * 0.35, 1.55 - caida * 0.3, Math.cos(a) * 0.35, 0.16, 0.02, 0.85, a, caida), i % 2 ? P.hoja : P.hojaClara, TELA)
    }
  },
  mesaReunion(L, m) {
    // Una mesa de reuniones: tablero de puntas redondas, sin centro de mesa.
    const w = m.w ?? MEDIDA.mesaReunion[0]
    const d = m.d ?? MEDIDA.mesaReunion[1]
    const col = m.color ?? P.caoba
    L.caja(0, 0.72, 0, w, 0.05, d - w, col, LACA)
    for (const s of [-1, 1]) L.cil(0, 0.72, (s * (d - w)) / 2, w / 2, 0.05, col, LACA, 20)
    L.caja(0, 0.6, 0, w * 0.5, 0.12, d * 0.8, col, SATIN)
    const patas = Math.max(2, Math.round(d / 2.4))
    for (let i = 0; i < patas; i++) {
      const z = -d / 2 + 0.7 + ((d - 1.4) * i) / Math.max(1, patas - 1)
      L.cil(0, 0, z, 0.1, 0.6, col, SATIN, 10)
      L.caja(0, 0, z, w * 0.55, 0.06, 0.22, col, SATIN)
    }
    // Carpetas de cuero en cada lugar.
    const n = Math.max(1, Math.floor((d - 0.4) / 0.8))
    for (let i = 0; i < n; i++) for (const sx of [-1, 1]) L.caja((sx * w) / 2 - sx * 0.22, 0.77, (i - (n - 1) / 2) * 0.8, 0.3, 0.008, 0.42, "#2a2420", SATIN)
  },
  atril(L) {
    // El atril de la Sala de Prensa: madera, frente azul con el sello y dos micrófonos.
    L.caja(0, 0, 0, 0.66, 1.08, 0.46, P.caoba, SATIN)
    L.caja(0, 1.08, -0.02, 0.72, 0.05, 0.56, P.caoba, LACA, 0, -0.18)
    L.caja(0, 0.18, 0.235, 0.56, 0.78, 0.01, "#1f3a6e", SATIN)
    L.geo(CIL(24), M(0, 0.62, 0.245, 0.19, 0.01, 0.19, 0, Math.PI / 2), P.oro, METAL)
    for (const s of [-1, 1]) L.cil(s * 0.08, 1.12, 0.12, 0.009, 0.28, "#1b1b1d", METAL, 6)
  },
  telon(L, m) {
    // El fondo azul de la Sala de Prensa, con el óvalo de la Casa Blanca.
    const w = m.w ?? MEDIDA.telon[0]
    L.caja(0, 0, 0, w, CORTE - 0.03, 0.12, "#1f3a6e", TELA)
    L.geo(CIL(36), M(0, 1.75, 0.062, 0.95, 0.01, 0.62, 0, Math.PI / 2), "#e9e4d6", SATIN)
    L.geo(CIL(36), M(0, 1.75, 0.066, 0.86, 0.01, 0.54, 0, Math.PI / 2), "#2a4a86", SATIN)
    L.caja(0, 1.6, 0.07, 0.9, 0.2, 0.01, "#e9e4d6", SATIN)
    L.caja(0, 1.8, 0.07, 0.34, 0.12, 0.01, "#e9e4d6", SATIN)
  },
  pantalla(L, m) {
    // Una pantalla de pared: marco negro y la imagen encendida (mapas y gráficos en azul).
    const w = m.w ?? MEDIDA.pantalla[0]
    const y0 = m.y ?? 0.95
    const h = Math.min(w * 0.5625, CORTE - y0 - 0.25)
    L.caja(0, y0, 0.03, w + 0.06, h + 0.06, 0.05, "#15171b", LACA)
    L.quad(0, y0 + 0.03 + h / 2, 0.058, w, h, 0, "#2f5f96", LUZ(0.75))
    L.quad(-w * 0.18, y0 + 0.03 + h * 0.55, 0.06, w * 0.42, h * 0.5, 0, "#7fb2de", LUZ(0.85))
    L.quad(w * 0.28, y0 + 0.03 + h * 0.3, 0.06, w * 0.3, h * 0.18, 0, "#d9b45a", LUZ(0.85))
  },
  balcon(L, m) {
    // Un balcón corrido contra el muro (atrás, -z): losa a 2,15 m sobre ménsulas y
    // baranda de bronce hasta el corte. Se camina por debajo.
    const [w0, d0] = MEDIDA.balcon
    const w = m.w ?? w0
    const d = m.d ?? d0
    const piedra = m.color ?? "#e8dcc2"
    const bronce = "#8a6a3a"
    L.caja(0, 2.15, 0, w, 0.16, d, piedra, PULIDO)
    L.caja(0, 2.12, d / 2 - 0.06, w, 0.06, 0.14, P.oroViejo, METAL)
    const n = Math.max(2, Math.round(w / 1.8))
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + 0.15 + ((w - 0.3) * i) / n
      // Ménsula: más alta junto al muro, se afina hacia el borde.
      L.caja(x, 1.72, -d / 2 + 0.2, 0.14, 0.43, 0.4, piedra, PULIDO)
      L.caja(x, 1.92, -d / 2 + 0.6, 0.12, 0.23, 0.4, piedra, PULIDO)
    }
    const b = Math.round(w / 0.24)
    for (let i = 0; i <= b; i++) L.caja(-w / 2 + 0.06 + ((w - 0.12) * i) / b, 2.31, d / 2 - 0.06, 0.035, 0.3, 0.035, bronce, METAL)
    L.caja(0, 2.61, d / 2 - 0.06, w, 0.06, 0.09, bronce, METAL)
  },
  bandera(L, m) {
    // Una bandera en su asta, recogida.
    const col = m.color ?? "#b22234"
    L.cil(0, 0, 0, 0.17, 0.06, P.oro, METAL, 12)
    L.cil(0, 0.06, 0, 0.022, 2.3, P.oroViejo, METAL, 8)
    L.esf(0, 2.4, 0, 0.05, P.oro, METAL, 1, 8, 6)
    L.caja(0.1, 1.05, 0, 0.16, 1.2, 0.15, col, TELA)
    if (col === "#b22234") {
      for (let i = 0; i < 4; i++) L.caja(0.1, 1.12 + i * 0.26, 0, 0.165, 0.09, 0.155, "#f4f1ea", TELA)
      L.caja(0.1, 1.85, 0.04, 0.17, 0.4, 0.08, "#1f3a6e", TELA)
    } else L.caja(0.1, 1.5, 0, 0.165, 0.22, 0.155, P.oro, TELA)
  },
  columna(L, m) {
    const col = m.color ?? P.marmol
    L.caja(0, 0, 0, 0.82, 0.28, 0.82, col, PULIDO)
    L.cil(0, 0.28, 0, 0.36, 0.1, col, PULIDO, 18)
    L.cil(0, 0.38, 0, 0.32, CORTE - 0.38 - 0.005, col, PULIDO, 18)
    L.cil(0, CORTE - 0.005, 0, 0.32, 0.005, P.remate, ac(A.mate, 0), 18)
  },
  ascensor(L, m) {
    const [w] = MEDIDA.ascensor
    L.caja(0, 0, 0, w, CORTE - 0.01, w, "#e2dccf", SATIN)
    L.caja(0, 0, w / 2 + 0.01, w * 0.62, 2.2, 0.03, m.color ?? P.oro, METAL)
    L.caja(0, 0, w / 2 + 0.02, 0.02, 2.2, 0.03, P.oroViejo, METAL)
    L.caja(0, CORTE - 0.01, 0, w, 0.01, w, P.remate, ac(A.mate, 0))
  },
  mostrador(L, m) {
    const [w0, d0] = MEDIDA.mostrador
    const w = m.w ?? w0
    L.caja(0, 0, 0, w, 0.88, d0, "#d4cec1", SATIN)
    L.caja(0, 0.88, 0, w + 0.04, 0.05, d0 + 0.04, m.color ?? "#e9e6df", PULIDO)
    for (let i = 0; i < 3; i++) L.cil(-w / 3 + (w / 3) * i, 0.93, 0, 0.11, 0.02, P.porcelana, PULIDO, 14)
  },
  busto(L) {
    L.caja(0, 0, 0, 0.42, 1.05, 0.42, P.marmolGris, PULIDO)
    L.caja(0, 1.05, 0, 0.48, 0.05, 0.48, P.marmol, PULIDO)
    L.esf(0, 1.25, 0, 0.17, P.marmol, PULIDO, 0.55, 12, 8)
    L.esf(0, 1.48, 0.01, 0.12, P.marmol, PULIDO, 1.2, 12, 8)
  },
  cama(L, m) {
    // La cabecera contra el muro (−z); el pie mira a la sala.
    const w = m.w ?? MEDIDA.cama[0]
    const d = m.d ?? MEDIDA.cama[1]
    const col = m.color ?? "#e9e2d2"
    const madera = P.caoba
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.caja((sx * (w - 0.1)) / 2, 0, (sz * (d - 0.1)) / 2, 0.08, 0.14, 0.08, madera, SATIN)
    L.caja(0, 0.14, 0, w, 0.2, d, madera, SATIN)
    L.caja(0, 0.34, 0.02, w - 0.08, 0.22, d - 0.1, "#f4f1ea", TELA)
    L.caja(0, 0.5, 0.22, w + 0.04, 0.09, d - 0.5, col, TELA)
    for (const s of [-1, 1]) L.caja(s * (w / 2 + 0.005), 0.2, 0.22, 0.03, 0.38, d - 0.5, col, TELA)
    for (const s of [-1, 1]) L.caja(s * w * 0.23, 0.56, -d / 2 + 0.3, w * 0.4, 0.15, 0.36, "#fbf8f2", TELA)
    L.caja(0, 0.14, -d / 2 + 0.04, w + 0.08, m.alto ?? 1.25, 0.08, madera, LACA)
    L.caja(0, 0.14, d / 2 - 0.04, w + 0.08, 0.52, 0.07, madera, LACA)
  },
  escritorio(L, m) {
    const w = m.w ?? MEDIDA.escritorio[0]
    const d = m.d ?? MEDIDA.escritorio[1]
    const col = m.color ?? P.caoba
    L.caja(0, 0.72, 0, w, 0.05, d, col, LACA)
    for (const s of [-1, 1]) L.caja((s * (w - 0.46)) / 2, 0, 0, 0.42, 0.72, d - 0.06, col, SATIN)
    L.caja(0, 0.77, 0.02, w * 0.5, 0.004, d * 0.55, "#2f4a3a", TELA)
    L.caja(-w * 0.12, 0.775, 0.05, 0.3, 0.012, 0.4, "#f4f1ea", MATE)
    lampara(L, w * 0.36, 0.77, -d * 0.2, 0.75)
  },
  estante(L, m) {
    // Biblioteca de pared: los libros en colores apagados, sin repetir el orden de un estante al otro.
    const w = m.w ?? MEDIDA.estante[0]
    const d = MEDIDA.estante[1]
    const alto = m.alto ?? 2.3
    const col = m.color ?? P.nogal
    L.caja(0, 0, -d / 2 + 0.02, w, alto, 0.04, col, SATIN)
    for (const s of [-1, 1]) L.caja((s * (w - 0.04)) / 2, 0, 0, 0.04, alto, d, col, SATIN)
    L.caja(0, alto, 0.01, w + 0.06, 0.06, d + 0.04, col, LACA)
    const lomos = ["#6e2a24", "#2f4a3a", "#3a3f5c", "#7a5a2e", "#4a2c18", "#8a7a5a", "#5a2a3a", "#2a2a2a"]
    const filas = 5
    for (let k = 0; k < filas; k++) {
      const y = 0.08 + k * ((alto - 0.1) / filas)
      L.caja(0, y - 0.03, 0, w - 0.08, 0.03, d - 0.02, col, SATIN)
      const n = 5
      const ancho = (w - 0.12) / n
      for (let i = 0; i < n; i++) {
        const h = 0.24 + ((i * 7 + k * 3) % 5) * 0.025
        L.caja(-w / 2 + 0.06 + ancho * (i + 0.5), y, 0.01, ancho - 0.02, h, d - 0.1, lomos[(i * 3 + k * 5) % lomos.length], TELA)
      }
    }
  },
  vitrina(L, m) {
    const w = m.w ?? MEDIDA.vitrina[0]
    const d = MEDIDA.vitrina[1]
    const col = m.color ?? "#e9e2d2"
    L.caja(0, 0, 0, w, 0.85, d, col, LACA)
    L.caja(0, 0.85, 0, w + 0.04, 0.04, d + 0.04, P.marmol, PULIDO)
    L.caja(0, 0.89, -d / 2 + 0.03, w - 0.04, 1.2, 0.04, "#7a2a28", TELA)
    for (const s of [-1, 1]) L.caja((s * (w - 0.05)) / 2, 0.89, 0, 0.05, 1.2, d - 0.04, col, LACA)
    L.caja(0, 2.09, 0, w + 0.06, 0.1, d + 0.06, col, LACA)
    for (let k = 0; k < 3; k++) {
      const y = 0.93 + k * 0.38
      L.caja(0, y - 0.02, 0, w - 0.1, 0.02, d - 0.08, "#dfe8ec", ESPEJO)
      for (let i = 0; i < 3; i++) L.cil(-w / 3 + (w / 3) * i, y, 0, 0.11, 0.05, (i + k) % 2 ? P.porcelana : "#d9c79a", PULIDO, 12, 1.4)
    }
    L.quad(0, 1.49, d / 2 + 0.005, w - 0.1, 1.18, 0, "#cfdde4", ESPEJO)
  },
  estufa(L, m) {
    const w = m.w ?? MEDIDA.estufa[0]
    const d = MEDIDA.estufa[1]
    L.caja(0, 0, 0, w, 0.88, d, "#b9bcbf", METAL)
    L.caja(0, 0.88, 0, w, 0.04, d, "#2a2c2e", LACA)
    for (let i = 0; i < 6; i++) L.cil(-w / 2 + 0.3 + (i % 3) * 0.32, 0.92, (i < 3 ? -0.18 : 0.18), 0.1, 0.015, "#151515", MATE, 12)
    for (let i = 0; i < 2; i++) L.quad(-w / 4 + (w / 2) * i, 0.45, d / 2 + 0.005, w / 2 - 0.16, 0.5, 0, "#2a2c2e", LACA)
    L.caja(0, 0.92, -d / 2 + 0.04, w, 0.6, 0.05, "#d9dcdf", METAL)
    L.cil(w * 0.25, 0.935, 0, 0.16, 0.2, "#8a8d90", METAL, 14)
    L.cil(w * 0.38, 0.935, -0.2, 0.12, 0.14, "#8a8d90", METAL, 14)
    L.caja(w * 0.3, 0.935, 0.05, 0.36, 0.02, 0.26, "#d4b28a", SATIN)
  },
  billar(L, m) {
    const w = m.w ?? MEDIDA.billar[0]
    const d = m.d ?? MEDIDA.billar[1]
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) L.caja((sx * (w - 0.2)) / 2, 0, (sz * (d - 0.2)) / 2, 0.14, 0.62, 0.14, P.caoba, SATIN)
    L.caja(0, 0.62, 0, w + 0.16, 0.16, d + 0.16, P.caoba, LACA)
    L.caja(0, 0.78, 0, w - 0.06, 0.012, d - 0.06, "#1f6a3a", TELA)
    const bolas = ["#f4f1ea", "#c8344a", "#e3b03a", "#2a4a8a", "#151515", "#6a2a7a"]
    bolas.forEach((c, i) => L.esf(-0.25 + (i % 3) * 0.12, 0.82, d * 0.18 + Math.floor(i / 3) * 0.12, 0.028, c, PULIDO, 1, 8, 6))
  },
  cinta(L, m) {
    const w = m.w ?? MEDIDA.cinta[0]
    const d = m.d ?? MEDIDA.cinta[1]
    L.caja(0, 0, 0, w, 0.18, d, "#2a2c2e", LACA)
    L.caja(0, 0.18, 0.1, w - 0.16, 0.015, d - 0.4, "#151515", MATE)
    for (const s of [-1, 1]) L.barra([s * (w / 2 - 0.06), 0.18, -d / 2 + 0.14], [s * (w / 2 - 0.06), 1.25, -d / 2 + 0.26], 0.025, "#8a8d90", METAL, 6)
    L.caja(0, 1.18, -d / 2 + 0.22, w, 0.1, 0.24, "#2a2c2e", LACA)
    L.quad(0, 1.24, -d / 2 + 0.345, w * 0.5, 0.06, 0, "#7ad0ff", LUZ(1.2))
  },
  mapa(L, m) {
    // Un mapa grande de pared: papel, tierras y mares, y el marco.
    const w = m.w ?? MEDIDA.mapa[0]
    const alto = m.alto ?? 1.8
    const y0 = m.y ?? 0.8
    L.quad(0, y0 + alto / 2, 0.02, w - 0.1, alto - 0.1, 0, "#9fb8c4", ac(A.satin, 0.15))
    const tierras: Array<[number, number, number, number]> = [
      [-0.3, 0.62, 0.22, 0.3],
      [-0.22, 0.3, 0.12, 0.24],
      [0.08, 0.66, 0.2, 0.2],
      [0.12, 0.38, 0.12, 0.26],
      [0.32, 0.6, 0.26, 0.28],
      [0.38, 0.22, 0.1, 0.1],
    ]
    for (const [u, v, a, b] of tierras) L.quad(u * w, y0 + v * alto, 0.024, a * w, b * alto, 0, "#cfc29a", ac(A.satin, 0.15))
    L.caja(0, y0, 0.01, w, 0.06, 0.05, P.nogal, SATIN)
    L.caja(0, y0 + alto - 0.06, 0.01, w, 0.06, 0.05, P.nogal, SATIN)
    for (const s of [-1, 1]) L.caja((s * (w - 0.06)) / 2, y0, 0.01, 0.06, alto, 0.05, P.nogal, SATIN)
    L.caja(0, y0 + alto + 0.04, 0.08, w * 0.3, 0.04, 0.06, P.oro, LUZ(0.8))
  },
}

// ── Muros exteriores por dentro: forro con huecos de ventana y cortinas ──
function forrosExteriores(K: ConstructorPlanta, ext: Rect) {
  const L = K.L
  const y = K.y
  const v = VENTANAS[K.planta] ?? []
  const esp = 0.05
  // Cada cuarto que toca la fachada recibe el forro de su color en ese tramo.
  for (const c of cuartosDe(K.planta)) {
    if (c.ovalo) continue
    const r = c.rect
    const lados: Array<{ fijo: number; a0: number; a1: number; eje: "x" | "z"; n: 1 | -1 }> = []
    if (Math.abs(r.z0 - ext.z0) < 0.05) lados.push({ fijo: ext.z0, a0: r.x0, a1: r.x1, eje: "x", n: 1 })
    if (Math.abs(r.z1 - ext.z1) < 0.05) lados.push({ fijo: ext.z1, a0: r.x0, a1: r.x1, eje: "x", n: -1 })
    if (Math.abs(r.x0 - ext.x0) < 0.05) lados.push({ fijo: ext.x0, a0: r.z0, a1: r.z1, eje: "z", n: 1 })
    if (Math.abs(r.x1 - ext.x1) < 0.05) lados.push({ fijo: ext.x1, a0: r.z0, a1: r.z1, eje: "z", n: -1 })
    for (const lado of lados) {
      // Huecos: ventanas en este muro y dentro del tramo (y el hueco de la escalinata).
      const huecos = v
        .filter((w) => w.eje === lado.eje && Math.abs((lado.eje === "x" ? w.z : w.x) - lado.fijo) < 0.1)
        .map((w) => ({ c: lado.eje === "x" ? w.x : w.z, a: w.ancho, alf: w.alfeizar }))
        .filter((w) => w.c > lado.a0 && w.c < lado.a1)
      if (c.hueco && lado.eje === "x") huecos.push({ c: (c.hueco.x0 + c.hueco.x1) / 2, a: c.hueco.x1 - c.hueco.x0, alf: CORTE })
      huecos.sort((a, b) => a.c - b.c)
      const tramos: Array<[number, number]> = []
      let desde = lado.a0
      for (const h of huecos) {
        tramos.push([desde, h.c - h.a / 2])
        desde = h.c + h.a / 2
      }
      tramos.push([desde, lado.a1])
      const pieza = (a0: number, a1: number, y0: number, y1: number, color: string, aca: Acabado, salida = esp) => {
        if (a1 - a0 < 0.02 || y1 - y0 < 0.01) return
        if (lado.eje === "x") L.ext(a0, a1, y + y0, y + y1, lado.fijo + (lado.n > 0 ? 0 : -salida), lado.fijo + (lado.n > 0 ? salida : 0), color, aca)
        else L.ext(lado.fijo + (lado.n > 0 ? 0 : -salida), lado.fijo + (lado.n > 0 ? salida : 0), y + y0, y + y1, a0, a1, color, aca)
      }
      for (const [a0, a1] of tramos) {
        pieza(a0, a1, 0, CORTE, c.muro, SATIN)
        if (c.zocalo) pieza(a0, a1, 0, 0.26, c.zocalo, LACA, esp + 0.012)
        pieza(a0, a1, CORTE - 0.004, CORTE, P.remate, ac(A.mate, 0), esp + 0.012)
      }
      for (const h of huecos) {
        if (h.alf >= CORTE) continue
        // Bajo el alféizar, el mismo forro; a los lados, cortinas.
        pieza(h.c - h.a / 2, h.c + h.a / 2, 0, h.alf, c.muro, SATIN)
        if (c.cortina) {
          for (const s of [-1, 1]) {
            const a = h.c + s * (h.a / 2 + 0.14)
            pieza(a - 0.2, a + 0.2, 0, CORTE - 0.06, c.cortina, TELA, 0.2)
          }
          pieza(h.c - h.a / 2 - 0.36, h.c + h.a / 2 + 0.36, CORTE - 0.32, CORTE - 0.02, c.cortina, TELA, 0.24)
        }
      }
    }
  }
}

/** El arco sur de un salón oval (el muro curvo de la fachada) por dentro: forro, ventanas francesas y cortinas. */
function forroArco(K: ConstructorPlanta, c: Cuarto) {
  const L = K.L
  const r = (c.rect.x1 - c.rect.x0) / 2
  const cx = (c.rect.x0 + c.rect.x1) / 2
  const cz = c.ovalo!.sur
  // En el Tercer piso el arco no tiene ventanas (la fachada es ciega detrás de la balaustrada).
  const ventanas = K.planta === "res-tercero" ? [] : [60, 90, 120].map((g) => (g * Math.PI) / 180)
  const medio = 0.66 / r
  const n = 30
  for (let i = 0; i < n; i++) {
    const a0 = (Math.PI * i) / n
    const a1 = (Math.PI * (i + 1)) / n
    const am = (a0 + a1) / 2
    const enVentana = ventanas.some((v) => Math.abs(am - v) < medio)
    const largo = 2 * r * Math.sin((a1 - a0) / 2) + 0.01
    const x = cx + Math.cos(am) * (r - 0.03)
    const z = cz + Math.sin(am) * (r - 0.03)
    const ry = Math.atan2(-Math.cos(am), -Math.sin(am))
    if (!enVentana) {
      L.quad(x, K.y + CORTE / 2, z, largo, CORTE, ry, c.muro, SATIN)
      if (c.zocalo) L.quad(x - Math.cos(am) * 0.012, K.y + 0.13, z - Math.sin(am) * 0.012, largo, 0.26, ry, c.zocalo, LACA)
    }
  }
  for (const v of ventanas) {
    for (const s of [-1, 1]) {
      const a = v + s * (medio + 0.07)
      L.caja(cx + Math.cos(a) * (r - 0.12), K.y, cz + Math.sin(a) * (r - 0.12), 0.38, CORTE - 0.06, 0.2, c.cortina ?? c.muro, TELA, Math.atan2(-Math.cos(a), -Math.sin(a)))
    }
  }
}

/** Escalones de piso a piso entre (z0, y0) y (z1, y1), de ancho x0..x1; se cortan en yTope. */
function escalones(L: Lote, x0: number, x1: number, z0: number, y0: number, z1: number, y1: number, yTope: number, color: string, nFijo?: number) {
  const n = nFijo ?? Math.max(2, Math.round(Math.abs(y1 - y0) / 0.176))
  const dz = (z1 - z0) / n
  const dy = (y1 - y0) / n
  for (let i = 0; i < n; i++) {
    const yA = y0 + dy * (i + 1)
    if (yA > yTope + 1e-3) break
    const za = z0 + dz * i
    const zb = z0 + dz * (i + 1)
    L.ext(x0, x1, Math.min(y0, yA) - 0.02, yA, Math.min(za, zb), Math.max(za, zb), color, PULIDO)
    // Nariz del escalón
    L.ext(x0, x1, yA - 0.03, yA + 0.005, za - 0.02, za + 0.02, "#e2ddd3", PULIDO)
  }
}

/** Baranda de balaustres entre dos puntos (a la altura y). */
function baranda(L: Lote, ax: number, az: number, bx: number, bz: number, y: number, alto = 0.95) {
  const largo = Math.hypot(bx - ax, bz - az)
  const n = Math.max(2, Math.round(largo / 0.24))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    L.cil(ax + (bx - ax) * t, y, az + (bz - az) * t, 0.045, alto - 0.08, P.marmol, PULIDO, 8, 0.7)
  }
  L.barra([ax, y + alto - 0.04, az], [bx, y + alto - 0.04, bz], 0.07, P.marmol, PULIDO, 8)
  L.barra([ax, y + 0.04, az], [bx, y + 0.04, bz], 0.06, P.marmol, PULIDO, 6)
}

// ── Lo que no sale de las listas: escaleras, luz de las arañas, el vidrio del Solario ──

/** La escalinata norte (de la puerta, a 0,45 m, al Vestíbulo): se ve desde la Planta de Estado y, cortada, desde la Baja. */
function escalinata(K: ConstructorPlanta) {
  const L = K.L
  const esc = CUARTO["escalinata"]
  if (!esc) return
  const r = esc.rect
  const yE = CUARTO["vestibulo"] ? PLANTA[CUARTO["vestibulo"].planta].y : 3.45
  const tope = K.y + CORTE
  L.ext(r.x0, r.x1, 0, 0.45, r.z0, -11.2, P.marmol, PULIDO)
  escalones(L, -2.0, 2.0, -11.2, 0.45, -6.3, yE, tope, P.marmol)
  for (const s of [-1, 1]) {
    // Muros laterales de mármol (hasta el piso del Vestíbulo o hasta el corte).
    L.ext(s > 0 ? 2.0 : r.x0, s > 0 ? r.x1 : -2.0, 0, Math.min(yE, tope), r.z0, r.z1, "#e6e0d4", PULIDO)
    if (K.planta === "res-estado") {
      baranda(L, s * 2.2, r.z0 + 0.2, s * 2.2, r.z1, yE)
      L.barra([s * 1.9, 0.45 + 0.9, -11.2], [s * 1.9, yE + 0.9, -6.3], 0.045, P.oro, METAL, 8)
    }
  }
  for (const s of [-1, 1]) lampara(L, s * 1.7, 0.45, -12.0, 1.1)
  // En la Planta Baja, el remate oscuro del corte sobre los muros de la escalinata.
  if (K.planta !== "res-estado") for (const s of [-1, 1]) L.ext(s > 0 ? 2.0 : r.x0, s > 0 ? r.x1 : -2.0, tope - 0.004, tope, r.z0, r.z1, P.remate, ac(A.mate, 0))
}

/** Un pasamanos inclinado de (z0, y0) a (z1, y1) en x, cortado en yTope. */
function pasamanos(L: Lote, x: number, z0: number, y0: number, z1: number, y1: number, yTope: number) {
  let zb = z1
  let yb = y1
  if (y1 + 0.9 > yTope) {
    const t = Math.max(0, Math.min(1, (yTope - 0.05 - (y0 + 0.9)) / (y1 - y0)))
    if (t <= 0.02) return
    zb = z0 + (z1 - z0) * t
    yb = y0 + (y1 - y0) * t
  }
  L.barra([x, y0 + 0.9, z0], [x, yb + 0.9, zb], 0.035, P.caoba, LACA, 8)
  const n = Math.max(1, Math.round(Math.abs(zb - z0) / 0.9))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const yy = y0 + (yb - y0) * t
    L.cil(x, yy, z0 + (zb - z0) * t, 0.022, 0.9, P.oroViejo, METAL, 6)
  }
}

/**
 * Una escalera en U vista desde su planta: abajo, el tramo que sube, el
 * descanso y el arranque del segundo (todo cortado a la altura del corte);
 * arriba, el pozo por donde llega (segundo tramo, descanso y, si la escalera
 * no sigue, también el primero). Un muro de alma separa los dos tramos.
 */
function escalera(K: ConstructorPlanta, e: Escalera) {
  const L = K.L
  const { y0, y1, ym, n, zB } = medidasEscalera(e)
  const color = e.id === "gran" ? P.marmol : "#cfc9bd"
  const zDesc0 = Math.min(zB, e.zFin)
  const zDesc1 = Math.max(zB, e.zFin)
  const xMin = Math.min(e.sube[0], e.llega[0])
  const xMax = Math.max(e.sube[1], e.llega[1])
  const alma: [number, number] = e.sube[0] > e.llega[1] ? [e.llega[1], e.sube[0]] : [e.sube[1], e.llega[0]]
  const zAlma0 = Math.min(e.zA, zB)
  const zAlma1 = Math.max(e.zA, zB)
  const sube = (yTope: number) => escalones(L, e.sube[0], e.sube[1], e.zA, y0, zB, ym, yTope, color, n)
  const llega = (yTope: number) => escalones(L, e.llega[0], e.llega[1], zB, ym, e.zA, y1, yTope, color, n)
  const descanso = () => L.ext(xMin, xMax, ym - 0.25, ym, zDesc0, zDesc1, color, PULIDO)
  if (CUARTO[e.abajo].planta === K.planta) {
    const tope = y0 + CORTE
    sube(tope)
    if (ym <= tope) descanso()
    llega(tope)
    L.ext(alma[0], alma[1], y0, tope, zAlma0, zAlma1, "#e6e0d4", SATIN)
    L.ext(alma[0], alma[1], tope - 0.004, tope, zAlma0, zAlma1, P.remate, ac(A.mate, 0))
    const exterior = e.sube[0] > e.llega[1] ? e.sube[1] - 0.06 : e.sube[0] + 0.06
    pasamanos(L, exterior, e.zA, y0, zB, ym, tope)
  }
  if (CUARTO[e.arriba].planta === K.planta) {
    const tope = y1 + CORTE
    const sigue = ESCALERAS.some((o) => o.abajo === e.arriba)
    llega(y1 + 0.01)
    descanso()
    if (!sigue) sube(y1)
    // El alma sube desde la planta de abajo hasta la baranda (o hasta el corte, si la escalera sigue).
    const almaTope = sigue ? tope : y1 + 0.95
    L.ext(alma[0], alma[1], y0, almaTope, zAlma0, zAlma1, "#e6e0d4", SATIN)
    L.ext(alma[0], alma[1], almaTope - 0.004, almaTope, zAlma0, zAlma1, sigue ? P.remate : P.marmol, sigue ? ac(A.mate, 0) : PULIDO)
    pasamanos(L, e.sube[0] > e.llega[1] ? e.llega[0] + 0.06 : e.llega[1] - 0.06, zB, ym, e.zA, y1, y1 + 2)
    if (!sigue) {
      // Baranda alrededor del pozo, salvo por donde se llega.
      // (donde del otro lado hay piso: contra un muro no hace falta).
      const hayPiso = (x: number, z: number) => !!cuartoEn(K.planta, x, z)
      baranda(L, e.sube[0], e.zA, e.sube[1], e.zA, y1)
      if (hayPiso((xMin + xMax) / 2, e.zFin + e.dir * 0.3)) baranda(L, xMin, e.zFin, xMax, e.zFin, y1)
      const lado = e.sube[0] > e.llega[1] ? e.sube[1] : e.sube[0]
      const afuera = e.sube[0] > e.llega[1] ? 0.3 : -0.3
      if (hayPiso(lado + afuera, (e.zA + e.zFin) / 2)) baranda(L, lado, e.zA, lado, e.zFin, y1)
    }
  }
}

/** La luz de las arañas de cada planta, de noche: las de la Planta de Estado van a mano; en las otras, una por sala y varias por pasillo. */
const ARAÑAS_ESTADO: Array<[number, number, number]> = [
  [19.55, -7.5, 3.2],
  [19.55, 0, 3.2],
  [19.55, 7.5, 3.2],
  [-19.6, 2.6, 3.4],
  [-19.6, 8.0, 3.4],
  [-8.8, 8.1, 3.2],
  [8.9, 8.1, 3.2],
  [0, 10.0, 3.0],
  [0, -4.0, 3.0],
  [-6.5, 1.1, 2.4],
  [6.5, 1.1, 2.4],
  [-19.6, -9.2, 2.6],
  [11.6, -6.5, 2.2],
]
function charcos(K: ConstructorPlanta) {
  if (K.planta === "res-estado") {
    for (const [x, z, r] of ARAÑAS_ESTADO) K.charco(x, z, r)
    return
  }
  for (const c of cuartosDe(K.planta)) {
    const w = c.rect.x1 - c.rect.x0
    const d = c.rect.z1 - c.rect.z0
    if (c.ovalo) {
      K.charco((c.rect.x0 + c.rect.x1) / 2, (c.ovalo.norte + c.ovalo.sur) / 2, 3.0)
      continue
    }
    if (c.elipse) {
      K.charco((c.rect.x0 + c.rect.x1) / 2, (c.rect.z0 + c.rect.z1) / 2, 3.4)
      continue
    }
    if (c.exterior || c.piso === "piedra") continue
    if (c.paso && Math.max(w, d) > 12) {
      // Un pasillo largo: una lámpara cada 8 m.
      const L = Math.max(w, d)
      const k = Math.round(L / 8)
      for (let i = 0; i < k; i++) {
        const t = (L * (i + 0.5)) / k
        if (w >= d) K.charco(c.rect.x0 + t, (c.rect.z0 + c.rect.z1) / 2, 2.0)
        else K.charco((c.rect.x0 + c.rect.x1) / 2, c.rect.z0 + t, 2.0)
      }
      continue
    }
    if (c.id.startsWith("nucleo") || c.id.startsWith("paso-") || c.id === "escalera-este-2") continue
    if (c.lugarId && w * d > 70 && PLANTA[c.planta].edificio !== "residencia") {
      // Una sala grande sin arañas propias (Sala de Crisis, Sala del Efectivo): una luz cada 4,5 m.
      const nx = Math.max(1, Math.round(w / 4.5))
      const nz = Math.max(1, Math.round(d / 4.5))
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) K.charco(c.rect.x0 + (w * (i + 0.5)) / nx, c.rect.z0 + (d * (j + 0.5)) / nz, 2.2, 0.8)
      continue
    }
    K.charco((c.rect.x0 + c.rect.x1) / 2, (c.rect.z0 + c.rect.z1) / 2, Math.max(1.6, Math.min(3.4, Math.min(w, d) * 0.38)), 0.85)
  }
}

/** El Solario es de vidrio: paneles claros en sus muros (de día, el cielo; de noche, su propia luz). */
function vidrioSolario(K: ConstructorPlanta) {
  const c = CUARTO["solario"]
  if (!c || c.planta !== K.planta) return
  const L = K.L
  const y = K.y
  const r = c.rect
  const vidrio = LUZ(0.55)
  // Al sur, a los dos lados del arco del mirador (|x| > 3,4).
  for (const s of [-1, 1]) {
    const a = 3.6
    const b = (r.x1 - r.x0) / 2 - 0.3
    const x = s * (a + b) / 2
    L.quad(x, y + 1.65, r.z1 - 0.07, b - a, 1.9, Math.PI, "#cfe3ea", vidrio)
    L.ext(Math.min(s * a, s * b), Math.max(s * a, s * b), y, y + 0.6, r.z1 - 0.12, r.z1 - 0.04, "#f4f1ea", LACA)
  }
  for (const s of [-1, 1]) {
    const x = s < 0 ? r.x0 + 0.07 : r.x1 - 0.07
    for (let i = 0; i < 3; i++) L.quad(x, y + 1.65, r.z0 + 3.4 + i * 1.6, 1.4, 1.9, s < 0 ? Math.PI / 2 : -Math.PI / 2, "#cfe3ea", vidrio)
  }
}

function extras(K: ConstructorPlanta) {
  if (K.planta === "res-estado" || K.planta === "res-baja") escalinata(K)
  for (const e of ESCALERAS) escalera(K, e)
  charcos(K)
  vidrioSolario(K)
  if (K.planta === "oeste-sotano") bordeSotano(K)
  if (K.planta === "oeste-principal") pozoAla(K)
  if (K.planta === "eeob-alta") patiosAbajo(K)
}

/** El sótano del Ala Oeste visto desde arriba: entre el remate del corte y el pasto, la tierra. */
function bordeSotano(K: ConstructorPlanta) {
  const W = HUELLAS.alaOeste
  const y0 = K.y + CORTE
  const h = -y0 + 0.02
  const ym = y0 + h / 2
  const tierra = "#4a4038"
  K.L.quad((W.x0 + W.x1) / 2, ym, W.z0 + 0.01, W.x1 - W.x0, h, 0, tierra, ac(A.mate, 0))
  K.L.quad((W.x0 + W.x1) / 2, ym, W.z1 - 0.01, W.x1 - W.x0, h, Math.PI, tierra, ac(A.mate, 0))
  K.L.quad(W.x0 + 0.01, ym, (W.z0 + W.z1) / 2, W.z1 - W.z0, h, Math.PI / 2, tierra, ac(A.mate, 0))
  K.L.quad(W.x1 - 0.01, ym, (W.z0 + W.z1) / 2, W.z1 - W.z0, h, -Math.PI / 2, tierra, ac(A.mate, 0))
}

/** El pozo de la escalera del Ala Oeste, visto desde la planta principal: sus muros bajan hasta el sótano. */
function pozoAla(K: ConstructorPlanta) {
  const r = pozosDe(CUARTO["ala-escalera"])[0]
  const y0 = PLANTA["oeste-sotano"].y
  const h = K.y - y0
  const ym = y0 + h / 2
  const muro = "#cfc9bd"
  K.L.quad((r.x0 + r.x1) / 2, ym, r.z1 - 0.01, r.x1 - r.x0, h, Math.PI, muro, SATIN)
  K.L.quad(r.x0 + 0.01, ym, (r.z0 + r.z1) / 2, r.z1 - r.z0, h, Math.PI / 2, muro, SATIN)
  K.L.quad(r.x1 - 0.01, ym, (r.z0 + r.z1) / 2, r.z1 - r.z0, h, -Math.PI / 2, muro, SATIN)
  // Al norte, bajo el arranque: el muro llega solo hasta el piso del sótano más la altura del tramo.
  K.L.quad((r.x0 + r.x1) / 2, ym, r.z0 + 0.01, r.x1 - r.x0, h, 0, muro, SATIN)
}

/** Desde el segundo piso del Edificio Eisenhower se ve el fondo de los patios: su piso y sus muros, abajo. */
function patiosAbajo(K: ConstructorPlanta) {
  const yP = PLANTA["eeob-baja"].y
  const L = K.L
  for (const r of PATIOS_EEOB) {
    L.piso(r.x0, r.x1, r.z0, r.z1, yP + 0.004, "#a8a294", ac(A.satin, 0.25))
    const h = K.y - yP
    const ym = yP + h / 2
    const muro = "#a39888"
    L.quad((r.x0 + r.x1) / 2, ym, r.z0 + 0.01, r.x1 - r.x0, h, 0, muro, SATIN)
    L.quad((r.x0 + r.x1) / 2, ym, r.z1 - 0.01, r.x1 - r.x0, h, Math.PI, muro, SATIN)
    L.quad(r.x0 + 0.01, ym, (r.z0 + r.z1) / 2, r.z1 - r.z0, h, Math.PI / 2, muro, SATIN)
    L.quad(r.x1 - 0.01, ym, (r.z0 + r.z1) / 2, r.z1 - r.z0, h, -Math.PI / 2, muro, SATIN)
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    for (const dx of [-9, 9]) for (const dz of [-9, 9]) L.en(M(cx + dx, yP, cz + dz), () => MUEBLES.palmera(L, { t: "palmera", x: cx + dx, z: cz + dz }))
  }
}

// ── El remate oscuro sobre la fachada cortada ────────────────────
function remateResidencia(): THREE.BufferGeometry {
  const R = HUELLAS.residencia
  const ps = HUELLAS.porticoSur
  const exterior = new THREE.Shape()
  const ext: Array<[number, number]> = [
    [R.x0, R.z0],
    [R.x1, R.z0],
    [R.x1, R.z1],
    [4.0, R.z1],
  ]
  for (let i = 1; i < 24; i++) {
    const a = (Math.PI * i) / 24
    ext.push([ps.cx + 4.0 * Math.cos(a), ps.cz + 4.0 * Math.sin(a)])
  }
  ext.push([-4.0, R.z1], [R.x0, R.z1])
  ext.forEach(([x, z], i) => (i ? exterior.lineTo(x, -z) : exterior.moveTo(x, -z)))
  const hueco = new THREE.Path()
  const int: Array<[number, number]> = [
    [R.x0 + 0.7, R.z0 + 0.7],
    [R.x1 - 0.7, R.z0 + 0.7],
    [R.x1 - 0.7, R.z1 - 0.7],
    [3.38, R.z1 - 0.7],
    [3.36, R.z1],
  ]
  for (let i = 1; i < 24; i++) {
    const a = (Math.PI * i) / 24
    int.push([ps.cx + 3.36 * Math.cos(a), ps.cz + 3.36 * Math.sin(a)])
  }
  int.push([-3.36, R.z1], [-3.38, R.z1 - 0.7], [R.x0 + 0.7, R.z1 - 0.7])
  int.forEach(([x, z], i) => (i ? hueco.lineTo(x, -z) : hueco.moveTo(x, -z)))
  exterior.holes.push(hueco)
  const g = new THREE.ShapeGeometry(exterior, 8)
  g.rotateX(-Math.PI / 2)
  return g
}

/** Una forma horizontal (afuera menos el hueco), en el plano y = 0. */
function formaConHueco(afuera: Array<[number, number]>, hueco: Array<[number, number]>): THREE.BufferGeometry {
  const ext = new THREE.Shape()
  afuera.forEach(([x, z], i) => (i ? ext.lineTo(x, -z) : ext.moveTo(x, -z)))
  const h = new THREE.Path()
  hueco.forEach(([x, z], i) => (i ? h.lineTo(x, -z) : h.moveTo(x, -z)))
  ext.holes.push(h)
  const g = new THREE.ShapeGeometry(ext, 8)
  g.rotateX(-Math.PI / 2)
  return g
}
/** Puntos de un óvalo del Despacho Oval (grados: 0 = este, 90 = sur). */
function arcoOval(rx: number, rz: number, a0: number, a1: number): Array<[number, number]> {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [OVAL.cx + rx * Math.cos(a), OVAL.cz + rz * Math.sin(a)] as [number, number]
  })
}
const GR = 180 / Math.PI

/** El remate del Ala Oeste: sus muros y el muro del Despacho Oval (el óvalo sobresale del Ala al sureste). */
function remateAla(): THREE.BufferGeometry {
  const W = HUELLAS.alaOeste
  const I = { x0: -79.4, x1: -50.6, z0: -14.4, z1: 17.4 }
  const { ovaloAfuera: A1, ovaloAdentro: A0 } = BORDE_ALA
  const afuera: Array<[number, number]> = [
    [W.x0, W.z0],
    [W.x1, W.z0],
    ...arcoOval(A1.rx, A1.rz, -Math.acos((W.x1 - OVAL.cx) / A1.rx) * GR, 180 - Math.asin((W.z1 - OVAL.cz) / A1.rz) * GR),
    [W.x0, W.z1],
  ]
  const hueco: Array<[number, number]> = [
    [I.x0, I.z0],
    [I.x1, I.z0],
    ...arcoOval(A0.rx, A0.rz, -Math.acos((I.x1 - OVAL.cx) / A0.rx) * GR, 180 - Math.asin((I.z1 - OVAL.cz) / A0.rz) * GR),
    [I.x0, I.z1],
  ]
  return formaConHueco(afuera, hueco)
}

/** El remate del Edificio Eisenhower: su contorno con pabellones menos el forro (en la Planta baja, con el vestíbulo hasta la puerta). */
function remateEEOB(baja: boolean): THREE.BufferGeometry {
  const E = HUELLAS.eeob
  const ret = 1.6
  const afuera: Array<[number, number]> = [
    [E.x1, E.z0], [-114, E.z0], [-114, E.z0 + ret], [-123, E.z0 + ret], [-123, E.z0], [-137, E.z0], [-137, E.z0 + ret], [-146, E.z0 + ret], [-146, E.z0], [E.x0, E.z0],
    [E.x0, -46], [E.x0 + ret, -46], [E.x0 + ret, -11], [E.x0, -11], [E.x0, 11], [E.x0 + ret, 11], [E.x0 + ret, 46], [E.x0, 46], [E.x0, E.z1],
    [-146, E.z1], [-146, E.z1 - ret], [-137, E.z1 - ret], [-137, E.z1], [-123, E.z1], [-123, E.z1 - ret], [-114, E.z1 - ret], [-114, E.z1], [E.x1, E.z1],
    [E.x1, 46], [E.x1 - ret, 46], [E.x1 - ret, 11], [E.x1, 11], [E.x1, -11], [E.x1 - ret, -11], [E.x1 - ret, -46], [E.x1, -46],
  ]
  const f = FORRO.eeob
  const I = INTERIOR_EEOB
  const hueco: Array<[number, number]> = [
    [I.x0 - f, I.z0 - f],
    [I.x1 + f, I.z0 - f],
    ...(baja ? ([[I.x1 + f, -6.3], [-100.02, -6.3], [-100.02, 6.3], [I.x1 + f, 6.3]] as Array<[number, number]>) : []),
    [I.x1 + f, I.z1 + f],
    [I.x0 - f, I.z1 + f],
  ]
  return formaConHueco(afuera, hueco)
}

/** El remate del Tesoro: el edificio con su podio y el del pórtico sur, menos el forro (y el vestíbulo del pabellón norte). */
function remateTesoro(): THREE.BufferGeometry {
  const T = HUELLAS.tesoro
  const afuera: Array<[number, number]> = [
    [T.x0, T.z0], [T.x1, T.z0], [T.x1, T.z1], [T.x1 - 11.5, T.z1], [T.x1 - 11.5, T.z1 + 5.2], [T.x0 + 9.5, T.z1 + 5.2], [T.x0 + 9.5, T.z1], [T.x0, T.z1],
  ]
  const f = FORRO.tesoro
  const I = INTERIOR_TESORO
  const hueco: Array<[number, number]> = [
    [I.x0 - f, I.z0 - f],
    [I.x1 + f, I.z0 - f],
    [I.x1 + f, I.z1 + f],
    [I.x0 - f, I.z1 + f],
    [I.x0 - f, -49.7],
    [100.02, -49.7],
    [100.02, -61.6],
    [I.x0 - f, -61.6],
  ]
  return formaConHueco(afuera, hueco)
}

/** El remate de cada planta (el del sótano no hace falta: sus macizos llegan al borde). */
const CLAVE_REMATE: Record<PlantaId, string | null> = {
  "res-baja": "residencia",
  "res-estado": "residencia",
  "res-segundo": "residencia",
  "res-tercero": "residencia",
  "oeste-principal": "ala",
  "oeste-sotano": null,
  "eeob-baja": "eeob-baja",
  "eeob-alta": "eeob-alta",
  "tesoro-baja": "tesoro",
}
function geoRemate(clave: string): THREE.BufferGeometry {
  if (clave === "ala") return remateAla()
  if (clave === "eeob-baja") return remateEEOB(true)
  if (clave === "eeob-alta") return remateEEOB(false)
  if (clave === "tesoro") return remateTesoro()
  return remateResidencia()
}

/**
 * El sótano del Ala Oeste está bajo el pasto: con esa planta abierta, el
 * suelo (y lo que esté en él) se recorta dentro de la huella del Ala, hasta
 * 0,6 m de alto. Planos con `clipIntersection`: se recorta solo adentro de los cinco.
 */
const POZO_ALA: Rect = pozosDe(CUARTO["ala-escalera"])[0]
const CAJA_SOTANO = [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), HUELLAS.alaOeste.x0),
  new THREE.Plane(new THREE.Vector3(1, 0, 0), -HUELLAS.alaOeste.x1),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), HUELLAS.alaOeste.z0),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), -HUELLAS.alaOeste.z1),
  new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6),
]

// ── El sistema ──────────────────────────────────────────────────
export interface Interiores {
  /** Abre una planta (corta su edificio) o, con null, vuelve a la vista de afuera. */
  mostrar(p: PlantaId | null): void
  planta(): PlantaId | null
  /** La sala (lugar) que hay en un punto de la planta abierta, para los toques. */
  lugarEn(x: number, z: number): string | null
  /** Para el depurador: lo que se construyó. */
  info(): { construidas: PlantaId[]; mallas: number; triangulos: number }
  /** Al desmontar: devuelve los materiales originales a la fachada y al suelo, y libera los clones con corte (no cuelgan de la escena). */
  dispose(): void
}

export function crearInteriores(ctx: CtxEscena, renderer: THREE.WebGLRenderer): Interiores {
  const grupos = new Map<PlantaId, THREE.Group>()
  const remates = new Map<string, THREE.Mesh>()
  const clonesCaja = new Map<THREE.Material, THREE.Material>()
  let suelo: Array<{ malla: THREE.Mesh; original: THREE.Material | THREE.Material[] }> | null = null
  let sueloRecortado = false
  const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  const clones = new Map<THREE.Material, THREE.Material>()
  /** Las mallas de cada edificio con su material original. */
  const cortadas = new Map<EdificioId, Array<{ malla: THREE.Mesh; original: THREE.Material | THREE.Material[] }>>()
  let mats: Mats | null = null
  let actual: PlantaId | null = null
  let edificioCortado: EdificioId | null = null

  const materiales = (): Mats => {
    if (mats) return mats
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const maqueta = crearMaqueta(ctx, "cb-interior-maqueta-1", 1, 0)
    const conMapa = (clave: string, t: THREE.Texture) => crearMaqueta(ctx, clave, 1, 0, t)
    const charco = new THREE.MeshBasicMaterial({
      map: texCharco(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
    })
    mats = {
      maqueta,
      parquet: conMapa("cb-interior-parquet-1", texParquet(aniso)),
      marmol: conMapa("cb-interior-marmol-1", texMarmol(aniso)),
      damero: conMapa("cb-interior-damero-1", texDamero(aniso)),
      alfombra: conMapa("cb-interior-alfombra-1", texAlfombra(aniso)),
      charco,
    }
    return mats
  }

  const construir = (p: PlantaId): THREE.Group => {
    const hecho = grupos.get(p)
    if (hecho) return hecho
    const m = materiales()
    const K = new ConstructorPlanta(p)
    const ext: Rect = { x0: HUELLAS.residencia.x0 + 0.7, x1: HUELLAS.residencia.x1 - 0.7, z0: HUELLAS.residencia.z0 + 0.7, z1: HUELLAS.residencia.z1 - 0.7 }
    for (const c of cuartosDe(p)) {
      // La escalinata no tiene piso en esta planta (es el hueco por donde sube); el balcón ya tiene el suyo.
      if (c.yNodo === undefined && !c.exterior) K.piso(c)
      K.alfombras(c)
      if (c.ovalo) forroArco(K, c)
      for (const mu of c.muebles ?? []) {
        const dib = MUEBLES[mu.t]
        if (!dib) continue
        K.L.en(M(mu.x, K.y, mu.z, 1, 1, 1, mu.rumbo ?? 0), () => dib(K.L, mu))
        if (mu.t === "mesaComedor" || mu.t === "mesaReunion") {
          const reunion = mu.t === "mesaReunion"
          for (const s of sillasDeMesa(mu)) {
            K.L.en(M(s.x, K.y, s.z, 1, 1, 1, s.rumbo), () => silla(K.L, reunion ? (mu.tono ?? "#3b2b22") : "#d6b46a", reunion ? 1.15 : 1.05))
            // El plato de cada uno, sobre la mesa.
            if (!reunion) K.L.cil(s.x + Math.sin(s.rumbo) * 0.42, K.y + 0.75, s.z + Math.cos(s.rumbo) * 0.42, 0.12, 0.012, "#d9d4ca", SATIN, 16)
          }
        }
      }
    }
    // Muros interiores, partidos por sus puertas.
    for (const mu of MUROS) {
      if (mu.planta !== p) continue
      const largoX = mu.x1 - mu.x0 >= mu.z1 - mu.z0
      const cortes: Array<[number, number]> = []
      for (const pu of PUERTAS) {
        if (CUARTO[pu.a]?.planta !== p) continue
        if (pu.x < mu.x0 - 0.05 || pu.x > mu.x1 + 0.05 || pu.z < mu.z0 - 0.05 || pu.z > mu.z1 + 0.05) continue
        const c = largoX ? pu.x : pu.z
        cortes.push([c - pu.ancho / 2, c + pu.ancho / 2])
      }
      cortes.sort((a, b) => a[0] - b[0])
      let desde = largoX ? mu.x0 : mu.z0
      const hasta = largoX ? mu.x1 : mu.z1
      const pieza = (a0: number, a1: number) => {
        if (a1 - a0 < 0.02) return
        K.bloque(largoX ? { x0: a0, x1: a1, z0: mu.z0, z1: mu.z1 } : { x0: mu.x0, x1: mu.x1, z0: a0, z1: a1 })
      }
      for (const [c0, c1] of cortes) {
        pieza(desde, c0)
        desde = Math.max(desde, c1)
      }
      pieza(desde, hasta)
    }
    for (const mz of MACIZOS) if (mz.planta === p) K.macizo(mz.pts)
    // Umbral de cada puerta (el piso entre los dos cuartos) y marco de las que no son abiertas.
    for (const pu of PUERTAS) {
      if (CUARTO[pu.a]?.planta !== p || pu.b === "afuera") continue
      const r = rectPuerta(pu)
      K.pisos.marmol.piso(r.x0, r.x1, r.z0, r.z1, K.y + 0.002, "#cfc9bf", ac(A.pulido, 0.3), [r.x0 / 3.2, r.z0 / 3.2, r.x1 / 3.2, r.z1 / 3.2])
      if (pu.abierta) continue
      for (const s of [-1, 1]) {
        const h = pu.ancho / 2 + 0.06
        if (pu.eje === "x") K.L.ext(pu.x + s * h - 0.07, pu.x + s * h + 0.07, K.y, K.y + CORTE - 0.01, pu.z - 0.2, pu.z + 0.2, P.marfil, LACA)
        else K.L.ext(pu.x - 0.2, pu.x + 0.2, K.y, K.y + CORTE - 0.01, pu.z + s * h - 0.07, pu.z + s * h + 0.07, P.marfil, LACA)
      }
    }
    // La Residencia tiene ventanas que dan a cada cuarto: su forro va con huecos. Los demás edificios
    // tienen la cara de adentro de su muro (Ala Oeste) o un muro de forro en plantas-edificios.ts.
    if (PLANTA[p].edificio === "residencia") forrosExteriores(K, ext)
    extras(K)

    const g = new THREE.Group()
    g.name = `planta-${p}`
    g.visible = false
    const agregar = (lote: Lote, mat: THREE.Material, sombra: boolean) => {
      if (lote.vacio) return
      const malla = new THREE.Mesh(lote.geometria(), mat)
      malla.castShadow = sombra && ctx.sombras
      malla.receiveShadow = ctx.sombras
      malla.matrixAutoUpdate = false
      malla.updateMatrix()
      malla.userData.plantaId = p
      g.add(malla)
    }
    agregar(K.L, m.maqueta, true)
    agregar(K.pisos.parquet, m.parquet, false)
    agregar(K.pisos.marmol, m.marmol, false)
    agregar(K.pisos.damero, m.damero, false)
    agregar(K.pisos.alfombra, m.alfombra, false)
    if (!K.charcos.vacio) {
      const ch = new THREE.Mesh(K.charcos.geometria(), m.charco)
      ch.renderOrder = 2
      ch.matrixAutoUpdate = false
      ch.updateMatrix()
      g.add(ch)
    }
    ctx.niveles.superficie.add(g)
    grupos.set(p, g)
    return g
  }

  /** Las mallas de la fachada de un edificio (arquitectura.ts las marca con userData.edificio). */
  const mallasDe = (e: EdificioId) => {
    let l = cortadas.get(e)
    if (l) return l
    l = []
    for (const o of ctx.niveles.superficie.children) {
      if (o.userData.edificio !== e) continue
      o.traverse((x) => {
        const malla = x as THREE.Mesh
        if (malla.isMesh) l!.push({ malla, original: malla.material })
      })
    }
    cortadas.set(e, l)
    return l
  }

  const clonDe = (mat: THREE.Material): THREE.Material => {
    let c = clones.get(mat)
    if (!c) {
      c = mat.clone()
      if (Object.prototype.hasOwnProperty.call(mat, "onBeforeCompile")) c.onBeforeCompile = mat.onBeforeCompile
      if (Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey")) c.customProgramCacheKey = mat.customProgramCacheKey
      c.clippingPlanes = [plano]
      c.clipShadows = true
      c.userData = { ...mat.userData, original: mat }
      clones.set(mat, c)
    }
    return c
  }

  const cortar = (e: EdificioId) => {
    renderer.localClippingEnabled = true
    for (const { malla, original } of mallasDe(e)) malla.material = Array.isArray(original) ? original.map(clonDe) : clonDe(original)
    edificioCortado = e
  }

  const restaurar = (e: EdificioId) => {
    for (const { malla, original } of mallasDe(e)) malla.material = original
    edificioCortado = null
  }

  /** El remate oscuro sobre los muros cortados de la planta (uno por forma, se arma la primera vez). */
  const mostrarRemate = (p: PlantaId | null) => {
    const clave = p ? CLAVE_REMATE[p] : null
    for (const [k, r] of remates) r.visible = k === clave
    if (!p || !clave) return
    let r = remates.get(clave)
    if (!r) {
      r = new THREE.Mesh(geoRemate(clave), new THREE.MeshStandardMaterial({ color: P.remate, roughness: 0.9, metalness: 0 }))
      r.name = `remate-${clave}`
      r.receiveShadow = ctx.sombras
      ctx.niveles.superficie.add(r)
      remates.set(clave, r)
    }
    r.position.y = PLANTA[p].y + CORTE + 0.004
    r.visible = true
  }

  /** Las mallas del suelo que tocan la huella del Ala Oeste (pasto, caminos): se recortan con el sótano abierto. */
  const mallasDelSuelo = () => {
    if (suelo) return suelo
    suelo = []
    const W = HUELLAS.alaOeste
    const caja = new THREE.Box3(new THREE.Vector3(W.x0, -1, W.z0), new THREE.Vector3(W.x1, 0.6, W.z1))
    const b = new THREE.Box3()
    ctx.niveles.superficie.updateMatrixWorld(true)
    for (const o of ctx.niveles.superficie.children) {
      if (o.userData.edificio || o.name.startsWith("planta-") || o.name.startsWith("remate-")) continue
      o.traverse((x) => {
        const malla = x as THREE.Mesh
        if (!malla.isMesh) return
        b.setFromObject(malla)
        if (!b.isEmpty() && b.intersectsBox(caja)) suelo!.push({ malla, original: malla.material })
      })
    }
    return suelo
  }
  const clonCaja = (mat: THREE.Material): THREE.Material => {
    let c = clonesCaja.get(mat)
    if (!c) {
      c = mat.clone()
      if (Object.prototype.hasOwnProperty.call(mat, "onBeforeCompile")) c.onBeforeCompile = mat.onBeforeCompile
      if (Object.prototype.hasOwnProperty.call(mat, "customProgramCacheKey")) c.customProgramCacheKey = mat.customProgramCacheKey
      c.clippingPlanes = CAJA_SOTANO
      c.clipIntersection = true
      c.clipShadows = true
      c.userData = { ...mat.userData, original: mat }
      clonesCaja.set(mat, c)
    }
    return c
  }
  /** Recorta el suelo dentro de `caja` (dentro de la huella del Ala), o lo deja entero con null. */
  const recortarSuelo = (caja: Rect | null) => {
    if (caja) {
      CAJA_SOTANO[0].constant = caja.x0
      CAJA_SOTANO[1].constant = -caja.x1
      CAJA_SOTANO[2].constant = caja.z0
      CAJA_SOTANO[3].constant = -caja.z1
    }
    const si = !!caja
    if (si === sueloRecortado) return
    sueloRecortado = si
    for (const { malla, original } of mallasDelSuelo()) malla.material = si ? (Array.isArray(original) ? original.map(clonCaja) : clonCaja(original)) : original
  }

  // Los clones siguen al original: el brillo de noche de las ventanas y el reflejo del cielo.
  ctx.alActualizar((t) => {
    // El sótano del Ala Oeste no tiene ventanas: sus lámparas están prendidas las 24 h.
    if (mats) {
      const sinVentanas = actual === "oeste-sotano"
      mats.charco.opacity = 0.55 * (sinVentanas ? 1 : t.noche)
      // Sus lámparas y pantallas, igual: el brillo de noche todo el día (lo repone el motor al salir).
      if (sinVentanas) for (const mt of [mats.maqueta, mats.parquet, mats.marmol, mats.damero, mats.alfombra]) mt.emissiveIntensity = 1
    }
    if (!edificioCortado) return
    for (const [orig, clon] of [...clones, ...(sueloRecortado ? clonesCaja : [])]) {
      const o = orig as THREE.MeshStandardMaterial
      const c = clon as THREE.MeshStandardMaterial
      if (o.emissiveIntensity !== undefined) c.emissiveIntensity = o.emissiveIntensity
      if (o.envMap !== c.envMap) c.envMap = o.envMap
      c.visible = o.visible
      c.opacity = o.opacity
    }
  })

  return {
    mostrar(p) {
      const e = p ? PLANTA[p].edificio : null
      if (edificioCortado && edificioCortado !== e) restaurar(edificioCortado)
      actual = p
      if (p && e) {
        const g = construir(p)
        plano.constant = PLANTA[p].y + CORTE
        if (edificioCortado !== e) cortar(e)
        g.visible = true
      }
      mostrarRemate(p)
      // El sótano: toda la huella del Ala. La planta principal: solo el pozo de la escalera (se ve bajar).
      recortarSuelo(p === "oeste-sotano" ? HUELLAS.alaOeste : p === "oeste-principal" ? POZO_ALA : null)
      for (const [id, g] of grupos) g.visible = id === p
    },
    planta: () => actual,
    dispose() {
      if (edificioCortado) restaurar(edificioCortado)
      recortarSuelo(null)
      for (const m of [...clones.values(), ...clonesCaja.values()]) m.dispose()
      clones.clear()
      clonesCaja.clear()
    },
    lugarEn(x, z) {
      if (!actual) return null
      return cuartoEn(actual, x, z)?.lugarId ?? null
    },
    info() {
      let mallas = 0
      let triangulos = 0
      for (const g of grupos.values())
        g.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          mallas++
          const pos = m.geometry.getAttribute("position")
          triangulos += (m.geometry.index ? m.geometry.index.count : pos.count) / 3
        })
      return { construidas: [...grupos.keys()], mallas, triangulos: Math.round(triangulos) }
    },
  }
}
