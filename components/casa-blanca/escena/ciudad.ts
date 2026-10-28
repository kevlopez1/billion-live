// ──────────────────────────────────────────────────────────────
// LA CIUDAD SUBTERRÁNEA — debajo de la Casa Blanca (ficción)
//
// Una caverna de 400 x 400 m (HUELLAS.ciudad) con el piso en y = -60 y una
// bóveda de roca que sube hasta y = -28. En el centro de la bóveda, un cielo
// artificial que sigue la hora de la superficie. Abajo: la Plaza Central con
// la pantalla del reto, la Gran Avenida, el Distrito de las Torres, el
// Mercado, el Parque con su lago, la Arena, el Club, el Mirador sobre el
// canal y la cascada, la Estación y un monorriel en circuito cerrado.
//
// Presupuesto (< 200 llamadas de dibujo, < 1 M triángulos):
//   - Lo fijo va en "lotes": una malla fusionada por material. El lote "base"
//     lleva color, rugosidad, metal y emisión por vértice, así casi todo lo
//     construido es UNA llamada.
//   - Las ventanas de las torres no son geometría: las dibuja un shader con la
//     posición en metros de cada cara (encendidas y apagadas con variación).
//   - Lo que se mueve (tren, cabina, drones, chorros, vapor, haces de luz) es
//     una malla instanciada o un shader con reloj.
//   - Luces reales: 6 PointLight. El resto es emisión + bloom, reflejos falsos
//     en el piso mojado y "focos falsos" que la roca suma en su shader para
//     que la ciudad la ilumine desde abajo.
//
// La luz general (el sol del cielo artificial, el hemisferio, la niebla, la
// exposición y el bloom) sale de `ambienteCiudad(hora)`: el motor la aplica
// cuando el nivel "ciudad" está a la vista, igual que hace con el cielo real.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { CHALLENGE_LAUNCH, CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import type { Calidad, TickEscena } from "../tipos"
import { HUELLAS, LUGAR, NODO } from "../lugares"
import type { CtxEscena } from "./contrato"

// ═══════════════════════════════════════════════════════════════
// 1. La caverna: forma y medidas
// ═══════════════════════════════════════════════════════════════

const CIU = HUELLAS.ciudad
const Y0 = CIU.piso
const ALTO = CIU.boveda - CIU.piso
const CX = (CIU.x0 + CIU.x1) / 2
const CZ = (CIU.z0 + CIU.z1) / 2
const MEDIO = (CIU.x1 - CIU.x0) / 2
/** Hasta dónde llega el cielo artificial, en la medida de `normaCaverna`. */
const R_CIELO = 0.6
/** Altura del riel del monorriel (cara superior de la viga). */
const RIEL_Y = Y0 + 9

/**
 * Distancia "de caverna" de un punto al centro: 0 en el centro, 1 en la pared.
 * La planta es un cuadrado redondeado (superelipse de grado 4): las esquinas
 * de roca se ven naturales y los 400 x 400 m se aprovechan casi enteros.
 */
export function normaCaverna(x: number, z: number): number {
  const u = Math.abs(x - CX) / MEDIO
  const v = Math.abs(z - CZ) / MEDIO
  return Math.pow(u * u * u * u + v * v * v * v, 0.25)
}

/** Perfil de la bóveda: casi plana en el centro y con paredes que caen a pique. */
function perfil(r: number): number {
  return ALTO * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, r), 5)))
}

/** Altura de la bóveda (sin el relieve de la roca) sobre un punto del piso. Sirve para limitar la cámara. */
export function techoCiudad(x: number, z: number): number {
  return Y0 + perfil(normaCaverna(x, z))
}

type Rect = { x0: number; x1: number; z0: number; z1: number }
/** El rectángulo de un lugar del mapa (el de respaldo solo si el mapa cambió). */
function rectDe(id: string, respaldo: Rect): Rect {
  const l = LUGAR[id]
  return l ? { x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1 } : respaldo
}
const cx = (r: Rect) => (r.x0 + r.x1) / 2
const cz = (r: Rect) => (r.z0 + r.z1) / 2

const R_PLAZA = rectDe("ciudad-plaza", { x0: -30, x1: 30, z0: 30, z1: 85 })
const R_AVENIDA = rectDe("ciudad-avenida", { x0: -12, x1: 12, z0: 85, z1: 230 })
const R_TORRES = rectDe("ciudad-torres", { x0: -150, x1: -45, z0: 40, z1: 200 })
const R_MERCADO = rectDe("ciudad-mercado", { x0: 30, x1: 90, z0: 40, z1: 90 })
const R_PARQUE = rectDe("ciudad-parque", { x0: 30, x1: 140, z0: 100, z1: 220 })
const R_ESTACION = rectDe("ciudad-estacion", { x0: -25, x1: 25, z0: 230, z1: 265 })
const R_ARENA = rectDe("ciudad-arena", { x0: 50, x1: 150, z0: -40, z1: 30 })
const R_CLUB = rectDe("ciudad-club", { x0: -130, x1: -50, z0: -40, z1: 25 })
const R_MIRADOR = rectDe("ciudad-mirador", { x0: -30, x1: 30, z0: -40, z1: -10 })
const ASC = NODO["ciudad-asc"]?.p ?? { x: 0, y: Y0, z: 22 }

/** El canal que recibe la cascada, al norte del Mirador. */
const CANAL = { x0: -100, x1: 100, z0: -112, z1: -50, radio: 22, agua: Y0 - 4.2, fondo: Y0 - 7 }
/** El lago del parque, contra la pared este. */
const LAGO = { x: 163, z: 160, rx: 22, rz: 50, agua: Y0 - 0.55 }
/** La arena: elipse exterior. El acceso del mapa (c-arena) queda del lado abierto, al oeste. */
const ARENA = { x: 92, z: 0, rx: 38, rz: 30, alto: 13 }
/** La pantalla del reto: un pórtico sobre la entrada de la Gran Avenida, mirando a la plaza. */
const PANTALLA = { z: R_PLAZA.z1 + 3, ancho: 25, alto: 9.4, base: Y0 + 9.5 }

const COLOR = {
  cian: "#3fd6ff",
  magenta: "#ff4fae",
  dorado: "#ffc35a",
  tibio: "#ffad62",
  blancoFrio: "#d9ecff",
  violeta: "#9a6bff",
}

// ═══════════════════════════════════════════════════════════════
// 2. Ambiente: el cielo artificial y la luz que el motor aplica
// ═══════════════════════════════════════════════════════════════

interface ClaveCielo {
  h: number
  cenit: string
  horizonte: string
  sol: string
  brillo: number
  noche: number
}

// La bóveda imita el día de la superficie: celeste suave de día, dorado al
// atardecer y azul profundo con estrellas de noche.
const CLAVES: ClaveCielo[] = [
  { h: 0, cenit: "#030a1c", horizonte: "#0d1d40", sol: "#000000", brillo: 0.55, noche: 1 },
  { h: 4.6, cenit: "#030a1c", horizonte: "#0d1d40", sol: "#000000", brillo: 0.55, noche: 1 },
  { h: 5.6, cenit: "#0f1d3d", horizonte: "#4a3657", sol: "#ff8c5a", brillo: 0.65, noche: 0.8 },
  { h: 6.6, cenit: "#3a5e95", horizonte: "#f2a36a", sol: "#ffc27a", brillo: 0.85, noche: 0.35 },
  { h: 8, cenit: "#5c90d0", horizonte: "#c4dcef", sol: "#fff0d4", brillo: 1, noche: 0 },
  { h: 12, cenit: "#5e9ade", horizonte: "#d2e6f6", sol: "#fffaf0", brillo: 1.08, noche: 0 },
  { h: 16, cenit: "#5a8fd0", horizonte: "#d8e2ea", sol: "#fff0d8", brillo: 1.04, noche: 0 },
  { h: 17.5, cenit: "#4a6dab", horizonte: "#f6b569", sol: "#ffcf86", brillo: 0.98, noche: 0.1 },
  { h: 18.5, cenit: "#2c3f7a", horizonte: "#ea7a4c", sol: "#ff965c", brillo: 0.8, noche: 0.45 },
  { h: 19.5, cenit: "#0f1a3c", horizonte: "#3b2c58", sol: "#7a3a46", brillo: 0.62, noche: 0.85 },
  { h: 21, cenit: "#030a1c", horizonte: "#0d1d40", sol: "#000000", brillo: 0.55, noche: 1 },
  { h: 24, cenit: "#030a1c", horizonte: "#0d1d40", sol: "#000000", brillo: 0.55, noche: 1 },
]

export interface AmbienteCiudad {
  hora: number
  /** 0 = pleno día, 1 = noche cerrada (en la bóveda). */
  noche: number
  /** Colores lineales del cielo artificial. */
  cielo: { cenit: THREE.Color; horizonte: THREE.Color; sol: THREE.Color; brillo: number; solPos: THREE.Vector2 }
  /** La luz direccional que baja del cielo artificial (el motor usa su "sol"). `dir` apunta hacia la luz. */
  sol: { color: THREE.Color; intensidad: number; dir: THREE.Vector3 }
  hemi: { cielo: THREE.Color; suelo: THREE.Color; intensidad: number }
  /** scene.environmentIntensity para el entorno de estudio del motor. */
  entorno: number
  niebla: { color: THREE.Color; densidad: number }
  exposicion: number
  /** Mismo formato que el Ambiente del cielo: el motor se lo puede pasar a Post.aplicar. */
  bloom: { fuerza: number; umbral: number; radio: number }
}

const _ca = new THREE.Color()
const _cb = new THREE.Color()
const mezclaHex = (out: THREE.Color, a: string, b: string, t: number) => out.copy(_ca.set(a)).lerp(_cb.set(b), t)

/**
 * La luz de la ciudad a una hora. La usan el cielo artificial (aquí) y el
 * motor (sol, hemisferio, entorno, niebla, exposición y bloom del nivel).
 */
export function ambienteCiudad(hora: number, out?: AmbienteCiudad): AmbienteCiudad {
  const a: AmbienteCiudad = out ?? {
    hora: 0,
    noche: 0,
    cielo: { cenit: new THREE.Color(), horizonte: new THREE.Color(), sol: new THREE.Color(), brillo: 1, solPos: new THREE.Vector2() },
    sol: { color: new THREE.Color(), intensidad: 1, dir: new THREE.Vector3() },
    hemi: { cielo: new THREE.Color(), suelo: new THREE.Color("#2a2420"), intensidad: 0.5 },
    entorno: 0.3,
    niebla: { color: new THREE.Color(), densidad: 0.003 },
    exposicion: 1,
    bloom: { fuerza: 0.4, umbral: 0.9, radio: 0.5 },
  }
  const h = ((hora % 24) + 24) % 24
  let i = 0
  while (i < CLAVES.length - 2 && CLAVES[i + 1].h <= h) i++
  const k0 = CLAVES[i]
  const k1 = CLAVES[i + 1]
  const t = THREE.MathUtils.smoothstep(h, k0.h, k1.h)
  mezclaHex(a.cielo.cenit, k0.cenit, k1.cenit, t)
  mezclaHex(a.cielo.horizonte, k0.horizonte, k1.horizonte, t)
  mezclaHex(a.cielo.sol, k0.sol, k1.sol, t)
  a.cielo.brillo = THREE.MathUtils.lerp(k0.brillo, k1.brillo, t)
  const noche = THREE.MathUtils.lerp(k0.noche, k1.noche, t)
  a.hora = h
  a.noche = noche
  const dia = 1 - noche

  // El sol cruza el panel de este (+x) a oeste (-x), un poco hacia el sur
  // para que se vea desde el Mirador. De noche, la luna hace el mismo arco.
  const arco = h >= 6 && h <= 18 ? (h - 6) / 12 : ((h + 6) % 24) / 12
  a.cielo.solPos.set(Math.cos(arco * Math.PI) * 0.92, 0.28 - Math.sin(arco * Math.PI) * 0.12)
  if (h < 5.2 || h > 19.8) a.cielo.sol.setRGB(0.05, 0.07, 0.12) // la luna: un resplandor frío y tenue

  // Luz direccional: sale del "sol" del panel. Alta al mediodía y rasante al
  // atardecer: sombras largas, como en la superficie a la hora dorada.
  const elev = THREE.MathUtils.degToRad(18 + 58 * Math.sin(arco * Math.PI))
  const hx = a.cielo.solPos.x
  const hz = a.cielo.solPos.y
  const hl = Math.hypot(hx, hz) || 1
  a.sol.dir.set((hx / hl) * Math.cos(elev), Math.sin(elev), (hz / hl) * Math.cos(elev)).normalize()
  a.sol.color.copy(a.cielo.sol).lerp(a.cielo.horizonte, 0.35).lerp(_ca.setRGB(1, 1, 1), 0.3)
  a.sol.intensidad = 0.12 + 1.55 * dia * a.cielo.brillo
  a.hemi.cielo.copy(a.cielo.cenit).lerp(_ca.setRGB(0.75, 0.82, 0.95), 0.3)
  a.hemi.suelo.set("#1d1814")
  a.hemi.intensidad = 0.08 + 0.32 * dia
  a.entorno = 0.12 + 0.2 * dia
  // Niebla: bruma azul verdosa y oscura; de día toma algo del color del cielo.
  a.niebla.color.copy(a.cielo.horizonte).lerp(_ca.set("#1b2733"), 0.72).multiplyScalar(0.42 * dia + 0.1)
  a.niebla.densidad = 0.0036 + 0.0008 * noche
  a.exposicion = 1.0 + 0.15 * noche
  a.bloom.fuerza = 0.42 + 0.24 * noche
  a.bloom.umbral = 0.9 - 0.18 * noche
  a.bloom.radio = 0.52 + 0.08 * noche
  return a
}

/**
 * Entorno de reflejos propio de la ciudad: un cubo pintado con el cielo
 * artificial arriba, roca oscura alrededor y las luces de la ciudad abajo.
 * Así el piso mojado y el vidrio reflejan la caverna, y no el estudio claro
 * que el motor usa en los subsuelos. Se repinta cuando cambia la hora.
 */
class EntornoCiudad {
  readonly textura: THREE.CubeTexture
  private readonly caras: HTMLCanvasElement[]
  private readonly luces: Array<{ cara: number; x: number; y: number; r: number; color: string; a: number }> = []
  private static readonly T = 128

  constructor() {
    const T = EntornoCiudad.T
    this.caras = Array.from({ length: 6 }, () => {
      const c = document.createElement("canvas")
      c.width = T
      c.height = T
      return c
    })
    const rnd = semilla(77)
    const colores = [COLOR.tibio, COLOR.tibio, "#ffd9a8", COLOR.cian, COLOR.magenta, "#ffffff", COLOR.dorado]
    for (const cara of [0, 1, 4, 5])
      for (let i = 0; i < 16; i++)
        this.luces.push({ cara, x: rnd() * T, y: T * (0.55 + rnd() * 0.22), r: 8 + rnd() * 14, color: colores[Math.floor(rnd() * colores.length)], a: 0.25 + rnd() * 0.35 })
    this.textura = new THREE.CubeTexture(this.caras)
    this.textura.colorSpace = THREE.SRGBColorSpace
  }

  pintar(amb: AmbienteCiudad) {
    const T = EntornoCiudad.T
    const css = (c: THREE.Color, k: number) => _ca.copy(c).multiplyScalar(k).getStyle()
    const b = amb.cielo.brillo
    this.caras.forEach((lienzo, cara) => {
      const g = lienzo.getContext("2d")!
      g.globalCompositeOperation = "source-over"
      g.fillStyle = "#0a0a0c"
      g.fillRect(0, 0, T, T)
      if (cara === 2) {
        // Arriba: el cielo artificial.
        const r = g.createRadialGradient(T / 2, T / 2, 2, T / 2, T / 2, T * 0.72)
        r.addColorStop(0, css(amb.cielo.cenit, 1.15 * b))
        r.addColorStop(0.55, css(amb.cielo.cenit.clone().lerp(amb.cielo.horizonte, 0.6), 1.1 * b))
        r.addColorStop(0.72, css(amb.cielo.horizonte, 0.8 * b))
        r.addColorStop(0.8, "#0c0b0c")
        g.fillStyle = r
        g.fillRect(0, 0, T, T)
        return
      }
      if (cara === 3) {
        g.fillStyle = "#060607"
        g.fillRect(0, 0, T, T)
        return
      }
      // Costados: el borde del cielo arriba, roca, y las luces de la ciudad abajo.
      const v = g.createLinearGradient(0, 0, 0, T)
      v.addColorStop(0, css(amb.cielo.horizonte, 0.75 * b))
      v.addColorStop(0.22, css(amb.cielo.horizonte, 0.18 * b))
      v.addColorStop(0.42, "#0d0c0d")
      v.addColorStop(0.62, "#151316")
      v.addColorStop(1, "#050506")
      g.fillStyle = v
      g.fillRect(0, 0, T, T)
      g.globalCompositeOperation = "lighter"
      for (const l of this.luces) {
        if (l.cara !== cara) continue
        const r = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r)
        _ca.set(l.color)
        r.addColorStop(0, `rgba(${Math.round(_ca.r * 255)},${Math.round(_ca.g * 255)},${Math.round(_ca.b * 255)},${l.a})`)
        r.addColorStop(1, "rgba(0,0,0,0)")
        g.fillStyle = r
        g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
      }
    })
    // Tirar el PMREM viejo: three lo vuelve a generar con las caras nuevas.
    this.textura.dispose()
    this.textura.needsUpdate = true
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. Utilidades: azar con semilla, ruido, lotes de geometría
// ═══════════════════════════════════════════════════════════════

function semilla(n: number): () => number {
  let a = n >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function ruido3(x: number, y: number, z: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const fx = x - xi
  const fy = y - yi
  const fz = z - zi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const w = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}

function fbm3(x: number, y: number, z: number, octavas = 4): number {
  let s = 0
  let a = 0.5
  let n = 0
  for (let i = 0; i < octavas; i++) {
    s += a * ruido3(x, y, z)
    n += a
    x = x * 2.03 + 17.1
    y = y * 2.03 + 3.7
    z = z * 2.03 + 9.2
    a *= 0.5
  }
  return s / n
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Matriz de ubicación: posición, giro en y (y opcionalmente en x y z) y escala. */
function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
    new THREE.Vector3(sx, sy, sz),
  )
}

type Valores = Record<string, readonly number[]>

/**
 * Junta muchas piezas en una sola malla (una llamada de dibujo). Cada pieza
 * puede llevar atributos constantes propios (color, rugosidad, emisión…).
 */
class Lote {
  private partes: THREE.BufferGeometry[] = []
  constructor(private readonly extra: ReadonlyArray<readonly [string, number]> = []) {}

  agregar(geo: THREE.BufferGeometry, m?: THREE.Matrix4 | null, valores: Valores = {}): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (m) g.applyMatrix4(m)
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k)
    g.morphAttributes = {}
    g.clearGroups()
    const n = g.getAttribute("position").count
    if (!g.getAttribute("normal")) g.computeVertexNormals()
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
    for (const [nombre, tam] of this.extra) {
      const v = valores[nombre] ?? []
      const arr = new Float32Array(n * tam)
      for (let i = 0; i < n; i++) for (let k = 0; k < tam; k++) arr[i * tam + k] = v[k] ?? 0
      g.setAttribute(nombre, new THREE.Float32BufferAttribute(arr, tam))
    }
    this.partes.push(g)
  }

  malla(material: THREE.Material, nombre: string): THREE.Mesh | null {
    if (!this.partes.length) return null
    const geo = mergeGeometries(this.partes, false)
    for (const p of this.partes) p.dispose()
    this.partes = []
    if (!geo) return null
    geo.computeBoundingSphere()
    const mesh = new THREE.Mesh(geo, material)
    mesh.name = nombre
    return mesh
  }
}

const _col = new THREE.Color()
/** Acabado del lote "base": color, rugosidad, metal y (opcional) emisión en HDR. */
function acabado(color: THREE.ColorRepresentation, rug = 0.6, metal = 0, emis?: THREE.ColorRepresentation, fuerza = 1): Valores {
  _col.set(color)
  const c = [_col.r, _col.g, _col.b]
  let e = [0, 0, 0]
  if (emis !== undefined) {
    _col.set(emis).multiplyScalar(fuerza)
    e = [_col.r, _col.g, _col.b]
  }
  return { color: c, aRM: [rug, metal], aEmis: e }
}
/** Color de una luz (lote "luz"): HDR, con un pulso opcional (radianes por segundo). */
function luz(color: THREE.ColorRepresentation, fuerza: number, pulso = 0): Valores {
  _col.set(color).multiplyScalar(fuerza)
  return { color: [_col.r, _col.g, _col.b], aPulso: [pulso] }
}

// ── Geometrías propias ──

type V2 = [number, number]

/** Empuja un triángulo con la cara hacia `n` (corrige el orden si hace falta). */
function tri(pos: number[], nor: number[], uv: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, ua: V2, ub: V2, uc: V2, normales?: [THREE.Vector3, THREE.Vector3, THREE.Vector3]) {
  const e1x = b.x - a.x
  const e1y = b.y - a.y
  const e1z = b.z - a.z
  const e2x = c.x - a.x
  const e2y = c.y - a.y
  const e2z = c.z - a.z
  const crx = e1y * e2z - e1z * e2y
  const cry = e1z * e2x - e1x * e2z
  const crz = e1x * e2y - e1y * e2x
  const ok = crx * n.x + cry * n.y + crz * n.z >= 0
  const P = ok ? [a, b, c] : [a, c, b]
  const U = ok ? [ua, ub, uc] : [ua, uc, ub]
  const N = normales ? (ok ? normales : [normales[0], normales[2], normales[1]]) : [n, n, n]
  for (let i = 0; i < 3; i++) {
    pos.push(P[i].x, P[i].y, P[i].z)
    nor.push(N[i].x, N[i].y, N[i].z)
    uv.push(U[i][0], U[i][1])
  }
}

function geometria(pos: number[], nor: number[], uv: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/**
 * Prisma vertical sobre un polígono (en planta, coordenadas locales x, z).
 * UV en metros: u a lo largo del contorno (cada cara con un número entero de
 * módulos de ventana) y v = altura desde `vBase`. Lo usa el shader de ventanas.
 */
function prisma(pol: V2[], y0: number, y1: number, opciones: { tapa?: boolean; piso?: boolean; vBase?: number; modulo?: number } = {}): THREE.BufferGeometry {
  const { tapa = true, piso = false, vBase = y0, modulo = 1.9 } = opciones
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  let gx = 0
  let gz = 0
  for (const [x, z] of pol) {
    gx += x / pol.length
    gz += z / pol.length
  }
  let u = 0
  const a0 = new THREE.Vector3()
  const b0 = new THREE.Vector3()
  const a1 = new THREE.Vector3()
  const b1 = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pol.length; i++) {
    const [ax, az] = pol[i]
    const [bx, bz] = pol[(i + 1) % pol.length]
    const largo = Math.hypot(bx - ax, bz - az)
    if (largo < 1e-4) continue
    n.set(bz - az, 0, -(bx - ax)).normalize()
    if (n.x * ((ax + bx) / 2 - gx) + n.z * ((az + bz) / 2 - gz) < 0) n.multiplyScalar(-1)
    const du = Math.max(1, Math.round(largo / modulo)) * modulo
    a0.set(ax, y0, az)
    b0.set(bx, y0, bz)
    a1.set(ax, y1, az)
    b1.set(bx, y1, bz)
    const v0 = y0 - vBase
    const v1 = y1 - vBase
    tri(pos, nor, uv, a0, b0, b1, n, [u, v0], [u + du, v0], [u + du, v1])
    tri(pos, nor, uv, a0, b1, a1, n, [u, v0], [u + du, v1], [u, v1])
    u += du
  }
  const tapas: Array<[number, THREE.Vector3]> = []
  if (tapa) tapas.push([y1, new THREE.Vector3(0, 1, 0)])
  if (piso) tapas.push([y0, new THREE.Vector3(0, -1, 0)])
  if (tapas.length) {
    const contorno = pol.map(([x, z]) => new THREE.Vector2(x, z))
    const caras = THREE.ShapeUtils.triangulateShape(contorno, [])
    for (const [y, nn] of tapas)
      for (const [i, j, k] of caras) {
        const p = (q: number) => new THREE.Vector3(pol[q][0], y, pol[q][1])
        tri(pos, nor, uv, p(i), p(j), p(k), nn, [pol[i][0], pol[i][1]], [pol[j][0], pol[j][1]], [pol[k][0], pol[k][1]])
      }
  }
  return geometria(pos, nor, uv)
}

/** Polígonos de planta (centrados en el origen). */
const poligono = {
  circulo(r: number, n = 20, giro = 0): V2[] {
    return Array.from({ length: n }, (_, i) => {
      const a = giro + (i / n) * Math.PI * 2
      return [Math.cos(a) * r, Math.sin(a) * r] as V2
    })
  },
  achaflanado(ax: number, az: number, c: number): V2[] {
    return [
      [-ax + c, -az],
      [ax - c, -az],
      [ax, -az + c],
      [ax, az - c],
      [ax - c, az],
      [-ax + c, az],
      [-ax, az - c],
      [-ax, -az + c],
    ]
  },
  rectRedondeado(x0: number, x1: number, z0: number, z1: number, r: number, seg = 6): V2[] {
    const out: V2[] = []
    const esquinas: Array<[number, number, number]> = [
      [x1 - r, z1 - r, 0],
      [x0 + r, z1 - r, Math.PI / 2],
      [x0 + r, z0 + r, Math.PI],
      [x1 - r, z0 + r, (3 * Math.PI) / 2],
    ]
    for (const [ex, ez, a0] of esquinas)
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (i / seg) * (Math.PI / 2)
        out.push([ex + Math.cos(a) * r, ez + Math.sin(a) * r])
      }
    return out
  },
  elipse(x: number, z: number, rx: number, rz: number, n = 48): V2[] {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [x + Math.cos(a) * rx, z + Math.sin(a) * rz] as V2
    })
  },
  /** El contorno de la caverna a una "norma" r (1 = la pared). */
  caverna(r: number, n = 256): V2[] {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      return [CX + Math.sign(c) * Math.sqrt(Math.abs(c)) * MEDIO * r, CZ + Math.sign(s) * Math.sqrt(Math.abs(s)) * MEDIO * r] as V2
    })
  },
}

/** Muro vertical que sigue un contorno cerrado (en coordenadas del mundo), con la cara hacia adentro o afuera. */
function muroContorno(pts: V2[], y0: number, y1: number, haciaAdentro: boolean): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  let gx = 0
  let gz = 0
  for (const [x, z] of pts) {
    gx += x / pts.length
    gz += z / pts.length
  }
  let u = 0
  const n = new THREE.Vector3()
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[(i + 1) % pts.length]
    const largo = Math.hypot(bx - ax, bz - az)
    if (largo < 1e-4) continue
    n.set(bz - az, 0, -(bx - ax)).normalize()
    const afuera = n.x * ((ax + bx) / 2 - gx) + n.z * ((az + bz) / 2 - gz) > 0
    if (afuera === haciaAdentro) n.multiplyScalar(-1)
    const A0 = new THREE.Vector3(ax, y0, az)
    const B0 = new THREE.Vector3(bx, y0, bz)
    const A1 = new THREE.Vector3(ax, y1, az)
    const B1 = new THREE.Vector3(bx, y1, bz)
    tri(pos, nor, uv, A0, B0, B1, n, [u, y0], [u + largo, y0], [u + largo, y1])
    tri(pos, nor, uv, A0, B1, A1, n, [u, y0], [u + largo, y1], [u, y1])
    u += largo
  }
  return geometria(pos, nor, uv)
}

/** Losa horizontal con forma de polígono (y agujeros), mirando hacia arriba o abajo. */
function losa(contorno: V2[], y: number, agujeros: V2[][] = [], abajo = false): THREE.BufferGeometry {
  const forma = new THREE.Shape(contorno.map(([x, z]) => new THREE.Vector2(x, -z)))
  for (const h of agujeros) forma.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))
  const g = new THREE.ShapeGeometry(forma, 1)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  if (abajo) {
    // Mirando hacia abajo: se invierte el orden de los triángulos y la normal.
    const idx = g.getIndex()
    if (idx)
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i + 1)
        idx.setX(i + 1, idx.getX(i + 2))
        idx.setX(i + 2, t)
      }
    const n = g.getAttribute("normal") as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, -1, 0)
  }
  return g
}

/** Cinta a lo largo de una polilínea: dos bordes (a cada lado o arriba/abajo) y una normal por punto. */
function cinta(puntos: THREE.Vector3[], borde: (i: number, lado: -1 | 1, out: THREE.Vector3) => void, normal: (i: number, out: THREE.Vector3) => void, cerrada: boolean): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const n = puntos.length
  const A = Array.from({ length: n }, () => new THREE.Vector3())
  const B = Array.from({ length: n }, () => new THREE.Vector3())
  const N = Array.from({ length: n }, () => new THREE.Vector3())
  for (let i = 0; i < n; i++) {
    borde(i, -1, A[i])
    borde(i, 1, B[i])
    normal(i, N[i])
  }
  let u = 0
  const tramos = cerrada ? n : n - 1
  for (let i = 0; i < tramos; i++) {
    const j = (i + 1) % n
    const d = puntos[i].distanceTo(puntos[j])
    const nm = N[i].clone().add(N[j]).normalize()
    tri(pos, nor, uv, A[i], B[i], B[j], nm, [u, 0], [u, 1], [u + d, 1], [N[i], N[i], N[j]])
    tri(pos, nor, uv, A[i], B[j], A[j], nm, [u, 0], [u + d, 1], [u + d, 0], [N[i], N[j], N[j]])
    u += d
  }
  return geometria(pos, nor, uv)
}

// ═══════════════════════════════════════════════════════════════
// 4. Shaders y materiales
// ═══════════════════════════════════════════════════════════════

/** Ruido en GLSL (valor 3D con hash sin senos: estable en celulares). */
const GLSL_RUIDO = /* glsl */ `
float cbHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float cbHash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float cbRuido(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cbHash(i), cbHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(cbHash(i + vec3(0.0, 1.0, 0.0)), cbHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(cbHash(i + vec3(0.0, 0.0, 1.0)), cbHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(cbHash(i + vec3(0.0, 1.0, 1.0)), cbHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float cbFbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { s += a * cbRuido(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.875; }
`

/** Posición y normal en el mundo para los shaders que se apoyan en MeshStandardMaterial (con o sin instancias). */
const GLSL_MUNDO_VERT = /* glsl */ `
{
  vec4 pmC = vec4(transformed, 1.0);
  vec3 nmC = objectNormal;
  #ifdef USE_INSTANCING
    pmC = instanceMatrix * pmC;
    nmC = mat3(instanceMatrix) * nmC;
  #endif
  pmC = modelMatrix * pmC;
  vPosM = pmC.xyz;
  vNorM = normalize(mat3(modelMatrix) * nmC);
}`

interface MaterialesCiudad {
  roca: THREE.MeshStandardMaterial
  cielo: THREE.ShaderMaterial
  base: THREE.MeshStandardMaterial
  torres: THREE.MeshStandardMaterial
  luz: THREE.MeshBasicMaterial
  vidrio: THREE.MeshStandardMaterial
  piso: THREE.MeshStandardMaterial
  follaje: THREE.MeshStandardMaterial
  cascada: THREE.ShaderMaterial
  chorros: THREE.ShaderMaterial
  vapor: THREE.ShaderMaterial
  reflejos: THREE.ShaderMaterial
  charcos: THREE.ShaderMaterial
  haces: THREE.ShaderMaterial
  pisoLed: THREE.ShaderMaterial
  senal: THREE.MeshBasicMaterial
  pantalla: THREE.MeshBasicMaterial
  // Copias de los materiales de la casa, con el entorno de reflejos de la ciudad.
  granito: THREE.MeshStandardMaterial
  acero: THREE.MeshStandardMaterial
  madera: THREE.MeshStandardMaterial
  hierro: THREE.MeshStandardMaterial
  agua: THREE.MeshStandardMaterial
  pasto: THREE.MeshStandardMaterial
  grava: THREE.MeshStandardMaterial
  acera: THREE.MeshStandardMaterial
  corteza: THREE.MeshStandardMaterial
  /** Uniformes que se mueven cada cuadro. */
  u: {
    tiempo: THREE.IUniform<number>
    noche: THREE.IUniform<number>
    cenit: THREE.IUniform<THREE.Color>
    horizonte: THREE.IUniform<THREE.Color>
    solCol: THREE.IUniform<THREE.Color>
    solPos: THREE.IUniform<THREE.Vector2>
    solDir: THREE.IUniform<THREE.Vector3>
    brillo: THREE.IUniform<number>
    bordeCielo: THREE.IUniform<THREE.Color>
    escalaPuntos: THREE.IUniform<number>
    /** Los reflejos de las luces en el piso pesan menos de día. */
    reflejo: THREE.IUniform<number>
    charco: THREE.IUniform<number>
  }
}

const N_FOCOS = 12
interface Foco {
  p: THREE.Vector3
  radio: number
  color: THREE.ColorRepresentation
  fuerza: number
}

function crearMaterialesCiudad(ctx: CtxEscena, focos: Foco[], atlas: THREE.Texture, pantalla: THREE.Texture, entorno: THREE.Texture): MaterialesCiudad {
  const calidad: Calidad = ctx.calidad
  const u: MaterialesCiudad["u"] = {
    tiempo: { value: 0 },
    noche: { value: 0 },
    cenit: { value: new THREE.Color() },
    horizonte: { value: new THREE.Color() },
    solCol: { value: new THREE.Color() },
    solPos: { value: new THREE.Vector2() },
    solDir: { value: new THREE.Vector3(0, 1, 0) },
    brillo: { value: 1 },
    bordeCielo: { value: new THREE.Color() },
    escalaPuntos: { value: 600 },
    reflejo: { value: 1 },
    charco: { value: 0.2 },
  }
  const defs = `#define CB_CX ${CX.toFixed(2)}\n#define CB_CZ ${CZ.toFixed(2)}\n#define CB_MEDIO ${MEDIO.toFixed(2)}\n#define CB_RCIELO ${R_CIELO.toFixed(3)}\n#define CB_Y0 ${Y0.toFixed(2)}\n`

  // ── Roca: oscura y húmeda, con vetas, relieve fino y la ciudad reflejada en ella ──
  const focoPos = Array.from({ length: N_FOCOS }, (_, i) => {
    const f = focos[i]
    return f ? new THREE.Vector4(f.p.x, f.p.y, f.p.z, f.radio) : new THREE.Vector4(0, -999, 0, 1)
  })
  const focoCol = Array.from({ length: N_FOCOS }, (_, i) => {
    const f = focos[i]
    return f ? new THREE.Color(f.color).multiplyScalar(f.fuerza) : new THREE.Color(0, 0, 0)
  })
  const roca = new THREE.MeshStandardMaterial({ name: "ciudad-roca", color: "#ffffff", roughness: 1, metalness: 0 })
  const bump = calidad === "baja" ? 0 : calidad === "media" ? 0.6 : 1
  roca.onBeforeCompile = (s) => {
    s.uniforms.uFocos = { value: focoPos }
    s.uniforms.uFocosCol = { value: focoCol }
    s.uniforms.uBorde = u.bordeCielo
    s.uniforms.uRebote = { value: new THREE.Color("#ffb070").multiplyScalar(0.55) }
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${defs}
varying vec3 vPosM;
varying vec3 vNorM;
uniform vec4 uFocos[${N_FOCOS}];
uniform vec3 uFocosCol[${N_FOCOS}];
uniform vec3 uBorde;
uniform vec3 uRebote;
${GLSL_RUIDO}
vec3 cbPerturbar(vec3 pos, vec3 n, float h, float k, float cara) {
  vec3 sx = dFdx(pos); vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n); vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * cara;
  vec2 dh = vec2(dFdx(h), dFdy(h)) * k;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - grad);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 pR = vPosM;
float gran = cbFbm(pR * 0.035);
float medio = cbFbm(pR * 0.23 + 3.7);
vec3 albedo = mix(vec3(0.045, 0.042, 0.04), vec3(0.15, 0.125, 0.1), gran);
albedo *= 0.62 + 0.76 * medio;
// Estratos: capas horizontales, torcidas, que se leen de lejos.
float estr = cbFbm(vec3(pR.x * 0.018, pR.y * 0.32 + cbFbm(pR * 0.025) * 3.5, pR.z * 0.018));
albedo *= 0.6 + 0.8 * smoothstep(0.32, 0.68, estr);
// Vetas: líneas finas de mineral claro que serpentean.
float tuerce = cbFbm(pR * 0.045 + 11.0);
float vv = abs(cbRuido(pR * 0.09 + tuerce * 3.0) - 0.5);
float veta = (1.0 - smoothstep(0.0, 0.016, vv)) * smoothstep(0.5, 0.7, cbRuido(pR * 0.07 + 2.0));
albedo *= 1.0 - veta * 0.55;
// Humedad: el agua escurre en franjas verticales y oscurece la piedra.
float hum = smoothstep(0.42, 0.7, cbFbm(vec3(pR.x * 0.32, pR.y * 0.022, pR.z * 0.32)));
albedo *= mix(1.0, 0.55, hum);
float rugRoca = mix(0.94, 0.32, hum);
rugRoca = mix(rugRoca, 0.5, veta * 0.5);
diffuseColor.rgb = albedo;`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = rugRoca;")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  float hB = cbFbm(vPosM * 0.4) + 0.3 * cbRuido(vPosM * 1.3);
  float kB = ${bump.toFixed(2)} * 1.4 * clamp(1.0 - length(vViewPosition) / 130.0, 0.0, 1.0);
  if (kB > 0.0) normal = cbPerturbar(-vViewPosition, normal, hB, kB, faceDirection);
}`,
      )
      .replace(
        "#include <lights_fragment_maps>",
        `#include <lights_fragment_maps>
radiance *= 0.35;
iblIrradiance *= 0.6;`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
reflectedLight.directDiffuse *= 0.4;
reflectedLight.directSpecular *= 0.4;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
{
  vec3 nW = normalize(vNorM);
  vec3 luzF = vec3(0.0);
  for (int i = 0; i < ${N_FOCOS}; i++) {
    vec3 d = uFocos[i].xyz - vPosM;
    float d2 = dot(d, d);
    float r2 = uFocos[i].w * uFocos[i].w;
    float at = r2 / (d2 + r2) * (1.0 - smoothstep(r2 * 3.0, r2 * 8.0, d2));
    float ndl = clamp(dot(nW, d * inversesqrt(d2 + 1e-3)) * 0.7 + 0.3, 0.0, 1.0);
    luzF += uFocosCol[i] * at * ndl;
  }
  // El cielo artificial ilumina la roca de alrededor (con su color de la hora).
  float rN = pow(pow(abs(vPosM.x - CB_CX) / CB_MEDIO, 4.0) + pow(abs(vPosM.z - CB_CZ) / CB_MEDIO, 4.0), 0.25);
  luzF += uBorde * exp(-max(rN - CB_RCIELO, 0.0) * 7.0) * step(CB_RCIELO - 0.04, rN);
  // Rebote cálido de la ciudad en la base de las paredes, y su resplandor en el techo.
  luzF += uRebote * (1.0 - smoothstep(0.0, 20.0, vPosM.y - CB_Y0));
  luzF += uRebote * 0.3 * max(-nW.y, 0.0);
  totalEmissiveRadiance += diffuseColor.rgb * luzF;
}`,
      )
  }
  roca.customProgramCacheKey = () => `ciudad-roca-${calidad}`

  // ── Cielo artificial: degradé, sol o luna, nubes de día, estrellas de noche y paneles hexagonales ──
  const cielo = new THREE.ShaderMaterial({
    name: "ciudad-cielo",
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uCenit: u.cenit,
      uHorizonte: u.horizonte,
      uSolCol: u.solCol,
      uSolDir: u.solDir,
      uBrillo: u.brillo,
      uNoche: u.noche,
      uTiempo: u.tiempo,
    },
    vertexShader: /* glsl */ `
varying vec3 vPosM;
#include <fog_pars_vertex>
void main() {
  vec4 mp = modelMatrix * vec4(position, 1.0);
  vPosM = mp.xyz;
  vec4 mvPosition = viewMatrix * mp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
${defs}
uniform vec3 uCenit;
uniform vec3 uHorizonte;
uniform vec3 uSolCol;
uniform vec3 uSolDir;
uniform float uBrillo;
uniform float uNoche;
uniform float uTiempo;
varying vec3 vPosM;
#include <common>
#include <fog_pars_fragment>
${GLSL_RUIDO}
vec4 cbHex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 9.73);
}
float cbHexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
void main() {
  vec2 d = (vPosM.xz - vec2(CB_CX, CB_CZ)) / (CB_MEDIO * CB_RCIELO);
  float rN = pow(pow(abs(d.x), 4.0) + pow(abs(d.y), 4.0), 0.25);
  // El panel muestra un cielo "en el infinito": el color depende de hacia dónde
  // se mira, no del punto del panel. Así, desde cualquier lugar de la ciudad,
  // arriba es cenit, lo rasante es horizonte y el sol está donde cae su luz.
  vec3 dir = normalize(vPosM - cameraPosition);
  float e = clamp(dir.y, 0.0, 1.0);
  // Mezcla en raíz (casi perceptual): del dorado al azul sin pasar por un gris lila.
  float te = smoothstep(0.06, 0.5, e);
  vec3 col = mix(sqrt(uHorizonte), sqrt(uCenit), te * te * (3.0 - 2.0 * te));
  col *= col;
  float ds = max(dot(dir, uSolDir), 0.0);
  col += uSolCol * (pow(ds, 900.0) * 24.0 + pow(ds, 40.0) * 0.9 + pow(ds, 6.0) * 0.25 * (1.0 - e));
  // Nubes en un plano lejano (con perspectiva), encendidas cerca del sol.
  vec2 pn = dir.xz / max(dir.y, 0.06) * 0.55 + vec2(uTiempo * 0.006, uTiempo * 0.002);
  float nub = cbFbm(vec3(pn * vec2(1.0, 1.8), 4.0)) * 0.7 + cbFbm(vec3(pn * 2.9, 9.0)) * 0.3;
  nub = smoothstep(0.5, 0.8, nub) * smoothstep(0.05, 0.3, e);
  vec3 colNub = mix(vec3(0.92, 0.94, 1.0) * mix(0.6, 1.0, e), uHorizonte * 1.2 + uSolCol * 0.6, pow(ds, 3.0) * 0.8 + (1.0 - e) * 0.3);
  col = mix(col, colNub, nub * (1.0 - uNoche) * 0.55);
  col *= uBrillo;
  // Estrellas: puntos fijos en el cielo que titilan, solo de noche.
  vec3 sd = dir * 140.0;
  vec3 ce = floor(sd);
  float he = cbHash(ce);
  vec3 jit = vec3(cbHash(ce + 7.1), cbHash(ce + 3.3), cbHash(ce + 1.7)) * 0.6 + 0.2;
  float est = step(0.985, he) * smoothstep(0.16, 0.0, length(fract(sd) - jit));
  est *= 0.55 + 0.45 * sin(uTiempo * (0.8 + he * 3.0) + he * 40.0);
  col += vec3(0.8, 0.88, 1.0) * est * smoothstep(0.35, 0.85, uNoche) * 2.6 * smoothstep(0.08, 0.3, e);
  // Paneles hexagonales: de cerca se nota que el cielo está construido.
  vec4 hx = cbHex(vPosM.xz / 8.0);
  float borde = 0.5 - cbHexDist(hx.xy);
  float fw = fwidth(vPosM.x / 8.0) * 1.5;
  float junta = smoothstep(0.0, 0.005 + fw, borde);
  junta = mix(junta, 0.97, clamp(fw * 7.0, 0.0, 1.0));
  col *= mix(0.9, 1.0, junta) * (0.985 + 0.03 * cbHash2(hx.zw));
  col *= smoothstep(1.0, 0.95, rN);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  })

  // ── Base: color, rugosidad, metal y emisión por vértice + un grano sutil ──
  const base = new THREE.MeshStandardMaterial({ name: "ciudad-base", vertexColors: true, roughness: 1, metalness: 1 })
  base.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aRM;\nattribute vec3 aEmis;\nvarying vec2 vRM;\nvarying vec3 vEmis;\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRM = aRM;\nvEmis = aEmis;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec2 vRM;\nvarying vec3 vEmis;\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\nfloat granoB = cbRuido(vPosM * 1.9);\ndiffuseColor.rgb *= 0.9 + 0.2 * cbRuido(vPosM * 0.43 + 5.0);")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = clamp(vRM.x + (granoB - 0.5) * 0.14, 0.03, 1.0);")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vRM.y;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmis;")
  }
  base.customProgramCacheKey = () => "ciudad-base"

  // ── Torres: fachada con ventanas encendidas que cambian despacio ──
  const torres = new THREE.MeshStandardMaterial({ name: "ciudad-torres", vertexColors: true, roughness: 1, metalness: 0 })
  torres.onBeforeCompile = (s) => {
    s.uniforms.uNoche = u.noche
    s.uniforms.uTiempo = u.tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSem;\nvarying float vSem;\nvarying vec2 vUvM;\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSem = aSem;\nvUvM = uv;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uNoche;\nuniform float uTiempo;\nvarying float vSem;\nvarying vec2 vUvM;\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// La semilla llega interpolada: se redondea, porque un hash amplifica cualquier error mínimo.
float semT = floor(vSem + 0.5);
float esMuro = 1.0 - step(0.5, abs(vNorM.y));
float lobby = (1.0 - step(4.4, vUvM.y)) * esMuro;
// Pisos de 3,3 m con ventanas de 1,9 m; en la planta baja, vidrieras de 3,8 x 4,4 m.
vec2 modulo = mix(vec2(1.6, 3.2), vec2(3.8, 4.4), lobby);
vec2 q = vUvM / modulo;
vec2 idV = floor(q);
vec2 f = fract(q);
vec2 fw = fwidth(q);
float lejos = clamp((max(fw.x, fw.y) - 0.05) * 6.0, 0.0, 1.0);
vec2 m0 = mix(vec2(0.1, 0.2), vec2(0.035, 0.05), lobby);
vec2 m1 = mix(vec2(0.9, 0.88), vec2(0.965, 0.86), lobby);
vec2 e0 = smoothstep(m0 - fw, m0 + fw, f);
vec2 e1 = 1.0 - smoothstep(m1 - fw, m1 + fw, f);
float parante = mix(smoothstep(0.0, 0.022 + fw.x, abs(f.x - 0.5)), 1.0, lobby);
float vent = mix(e0.x * e0.y * e1.x * e1.y * parante, 0.58, lejos) * esMuro;
vec3 colMarco = diffuseColor.rgb * (0.9 + 0.2 * cbRuido(vPosM * 0.5));
// La losa entre pisos se marca un poco más clara.
float losaF = (1.0 - smoothstep(0.0, 0.06 + fw.y, f.y)) * (1.0 - lobby) * (1.0 - lejos) * esMuro;
colMarco *= 1.0 + losaF * 0.7;
diffuseColor.rgb = mix(colMarco, vec3(0.012, 0.015, 0.02), vent);
float rugT = mix(0.55, 0.16, vent);
float metT = mix(0.35, 0.9, vent);
// Ventanas encendidas: cada una cambia de estado cada uno o dos minutos, a su ritmo.
float hId = cbHash2(idV + semT * 17.0);
float periodo = 60.0 + 90.0 * cbHash2(idV.yx + semT);
float fase = floor((uTiempo + hId * periodo) / periodo);
float hOn = cbHash2(idV * 1.37 + fase * 3.1 + semT * 7.0);
float frac = mix(mix(0.34, 0.6, uNoche), 0.7, lobby);
float on = mix(step(1.0 - frac, hOn), frac, lejos);
float tipo = cbHash2(idV + 31.0 + semT);
vec3 colV = tipo < 0.62 ? vec3(1.0, 0.6, 0.28) : tipo < 0.86 ? vec3(1.0, 0.8, 0.55) : vec3(0.5, 0.74, 1.0);
colV = mix(colV, vec3(0.62, 0.95, 0.9), step(0.93, tipo) * lobby);
// Dentro: la luz del techo arriba y, en algunas, cortinas.
float gradV = mix(0.5, 1.0, smoothstep(0.2, 0.85, f.y));
float hc = cbHash2(idV + 13.0 + semT);
float cortina = step(0.7, hc) * smoothstep(0.3 + hc * 0.4 - 0.04, 0.3 + hc * 0.4 + 0.04, f.y);
float baseV = mix(0.42, 1.15, uNoche) * mix(1.0, 0.8, lobby);
// Muebles: una franja oscura abajo en algunas ventanas.
float muebles = 1.0 - 0.6 * (1.0 - smoothstep(0.3, 0.4, f.y)) * step(0.5, cbHash2(idV + 41.0)) * (1.0 - lobby);
// En las vidrieras: la luz del techo arriba, el interior más oscuro abajo y parantes a tercios.
float tercios = min(abs(f.x - 0.333), abs(f.x - 0.667));
muebles *= mix(1.0, (0.22 + 0.78 * smoothstep(0.45, 0.92, f.y)) * smoothstep(0.0, 0.012 + fw.x, tercios), lobby);
float inten = baseV * (0.4 + 0.75 * cbHash2(idV + 5.0)) * gradV * muebles * mix(1.0, 0.15, cortina);
inten = mix(inten, baseV * 0.6, lejos);
vec3 emiT = vent * on * colV * inten;`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = rugT;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = metT;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += emiT;")
  }
  torres.customProgramCacheKey = () => "ciudad-torres"

  // ── Luces: neón, faroles, tiras. Color HDR por vértice, con pulso opcional ──
  const luzMat = new THREE.MeshBasicMaterial({ name: "ciudad-luz", vertexColors: true })
  luzMat.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = u.tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPulso;\nvarying float vPulso;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPulso = aPulso;")
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTiempo;\nvarying float vPulso;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (vPulso > 0.0) diffuseColor.rgb *= 0.78 + 0.22 * sin(uTiempo * vPulso);")
  }
  luzMat.customProgramCacheKey = () => "ciudad-luz"

  const vidrio = new THREE.MeshStandardMaterial({
    name: "ciudad-vidrio",
    color: "#9fc3d4",
    metalness: 0.35,
    roughness: 0.04,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  // Todo lo de la ciudad refleja la caverna (no el estudio del motor). Las
  // copias de los materiales de la casa conservan su textura y su proyección,
  // y dejan de estar en la lista de "reflejantes" que el motor reescribe.
  const propio = <T extends THREE.MeshStandardMaterial>(m: T, intensidad: number, nombre?: string): T => {
    m.envMap = entorno
    m.envMapIntensity = intensidad
    delete m.userData.reflejo
    if (nombre) m.name = nombre
    return m
  }
  const copia = (m: THREE.MeshStandardMaterial, intensidad: number, nombre: string) => propio(m.clone(), intensidad, nombre)
  propio(roca, 1)
  propio(base, 0.9)
  propio(torres, 1)
  propio(vidrio, 1.2)

  // Piso: el concreto pulido de la casa, oscuro y mojado.
  const piso = copia(ctx.materiales.concretoPulido, 1.25, "ciudad-piso")
  piso.color.set("#3b3e43")
  piso.roughness = Math.min(piso.roughness, 0.6) * 0.6

  // Follaje: copas con huecos de sombra y un poco de luz que las atraviesa. El
  // color de cada copa lo pone la instancia (verdes y tajibos en flor).
  const follaje = propio(new THREE.MeshStandardMaterial({ name: "ciudad-follaje", color: "#ffffff", roughness: 0.85, metalness: 0 }), 0.35)
  follaje.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float hojas = cbRuido(vPosM * 4.3) * 0.55 + cbRuido(vPosM * 9.7) * 0.45;
float hueco = smoothstep(0.3, 0.6, hojas);
diffuseColor.rgb *= mix(0.5, 1.06, hueco) * (0.72 + 0.4 * clamp(vNorM.y * 0.5 + 0.5, 0.0, 1.0));`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.06;")
  }
  follaje.customProgramCacheKey = () => "ciudad-follaje"

  // ── Cascada: una lámina que cae, con franjas que bajan ──
  const cascada = new THREE.ShaderMaterial({
    name: "ciudad-cascada",
    uniforms: { uTiempo: u.tiempo, uNoche: u.noche },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying float vProf;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vProf = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uTiempo;
uniform float uNoche;
varying vec2 vUv;
varying float vProf;
${GLSL_RUIDO}
void main() {
  float y = vUv.y;
  float caida = uTiempo * 1.6;
  float fino = cbRuido(vec3(vUv.x * 70.0, y * 4.0 + caida * 2.2, 0.0));
  float grueso = cbRuido(vec3(vUv.x * 14.0, y * 1.2 + caida * 0.9, 3.0));
  float a = smoothstep(0.25, 0.85, fino * 0.55 + grueso * 0.6);
  a *= smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
  a *= 0.55 + 0.45 * smoothstep(0.0, 0.25, 1.0 - y);
  a *= smoothstep(0.0, 0.07, y);
  float espuma = smoothstep(0.82, 1.0, y);
  vec3 col = mix(vec3(0.6, 0.82, 0.95), vec3(1.0), a * 0.6 + espuma * 0.5);
  // De noche la iluminan focos cian desde el canal.
  col *= mix(1.15, 1.4, uNoche) + espuma * 1.4;
  col = mix(col, col * vec3(0.55, 1.0, 1.35), uNoche * espuma);
  gl_FragColor = vec4(col, clamp(a * 0.85 + espuma * 0.4, 0.0, 0.92));
}`,
  })

  // ── Chorros de la fuente: conos que suben y bajan, aditivos ──
  const chorros = new THREE.ShaderMaterial({
    name: "ciudad-chorros",
    uniforms: { uTiempo: u.tiempo, uCol: { value: new THREE.Color(0.24, 0.38, 0.5) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute vec3 aPos;
attribute float aAlto;
attribute float aFase;
uniform float uTiempo;
varying float vV;
void main() {
  float alto = aAlto * (0.7 + 0.3 * sin(uTiempo * 1.6 + aFase));
  vec3 p = position;
  vV = p.y;
  p.xz *= 1.0 + p.y * p.y * p.y * 7.0;
  p.y *= alto;
  gl_Position = projectionMatrix * viewMatrix * vec4(p + aPos, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uTiempo;
uniform vec3 uCol;
varying float vV;
void main() {
  float flujo = 0.6 + 0.4 * sin(vV * 38.0 - uTiempo * 13.0);
  float a = smoothstep(1.0, 0.65, vV) * (0.3 + 0.7 * flujo) * (0.25 + 0.75 * smoothstep(0.0, 0.2, vV)) * (0.55 + 0.45 * smoothstep(0.6, 1.0, vV));
  gl_FragColor = vec4(uCol * a, 1.0);
}`,
  })

  // ── Vapor y bruma: puntos suaves que suben y se desvanecen ──
  const vapor = new THREE.ShaderMaterial({
    name: "ciudad-vapor",
    uniforms: { uTiempo: u.tiempo, uEscala: u.escalaPuntos },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
attribute float aFase;
attribute float aVel;
attribute float aTam;
attribute float aAlto;
attribute vec3 aCol;
uniform float uTiempo;
uniform float uEscala;
varying float vAlfa;
varying vec3 vCol;
void main() {
  float t = fract(uTiempo * aVel + aFase);
  vec3 p = position + vec3(sin(t * 5.0 + aFase * 30.0), t * aAlto, cos(t * 4.0 + aFase * 20.0)) * vec3(aTam * 0.25, 1.0, aTam * 0.25);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aTam * (0.6 + 0.8 * t) * uEscala / max(-mv.z, 0.5), 900.0);
  vAlfa = sin(t * 3.14159) * smoothstep(1.5, 6.0, -mv.z) * exp(-max(-mv.z - 60.0, 0.0) * 0.006);
  vCol = aCol;
}`,
    fragmentShader: /* glsl */ `
varying float vAlfa;
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vCol, a * a * vAlfa);
}`,
  })

  // ── Reflejos en el piso mojado: una estela por cada luz, estirada hacia la cámara ──
  const reflejos = new THREE.ShaderMaterial({
    name: "ciudad-reflejos",
    uniforms: { uY: { value: Y0 + 0.035 }, uFuerza: u.reflejo },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
attribute vec3 aFuente;
attribute vec3 aColor;
attribute float aAncho;
uniform float uY;
varying vec2 vQ;
varying vec3 vCol;
void main() {
  vec2 base = aFuente.xz;
  float h = max(aFuente.y, 0.3);
  vec2 haciaCam = cameraPosition.xz - base;
  float dist = max(length(haciaCam), 0.001);
  vec2 dir = haciaCam / dist;
  float camH = max(cameraPosition.y - uY, 0.4);
  // Donde aparece el reflejo de una luz a altura h vista desde la cámara.
  vec2 centro = base + dir * dist * h / (h + camH);
  float largo = 0.7 * h + 0.06 * dist + 0.8;
  float ancho = aAncho * (0.8 + 0.004 * dist);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 p = centro + perp * position.x * ancho + dir * position.y * largo;
  vQ = position.xy * 2.0;
  float lejos = exp(-dist * 0.0045) * smoothstep(3.0, 14.0, dist) * 0.55;
  vCol = aColor * lejos;
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, uY, p.y, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uFuerza;
varying vec2 vQ;
varying vec3 vCol;
void main() {
  float a = exp(-vQ.x * vQ.x * 3.2) * smoothstep(1.0, 0.15, abs(vQ.y));
  gl_FragColor = vec4(vCol * a * uFuerza, 1.0);
}`,
  })

  // ── Charcos de luz bajo los faroles: discos aditivos que pesan más de noche ──
  const charcos = new THREE.ShaderMaterial({
    name: "ciudad-charcos",
    uniforms: { uFuerza: u.charco },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
attribute vec4 aCharco;
attribute vec3 aColor;
varying vec2 vQ;
varying vec3 vCol;
void main() {
  vQ = position.xy * 2.0;
  vCol = aColor;
  // z = -y: así el cuadro mira hacia arriba (con +y quedaría de espaldas y no se dibuja).
  vec3 p = vec3(aCharco.x + position.x * aCharco.w * 2.0, aCharco.y + 0.03, aCharco.z - position.y * aCharco.w * 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uFuerza;
varying vec2 vQ;
varying vec3 vCol;
void main() {
  float d = length(vQ);
  float a = (1.0 - smoothstep(0.0, 1.0, d));
  gl_FragColor = vec4(vCol * a * a * uFuerza, 1.0);
}`,
  })

  // ── Haces de luz: conos aditivos que barren (club, arena) ──
  const haces = new THREE.ShaderMaterial({
    name: "ciudad-haces",
    uniforms: { uTiempo: u.tiempo },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute vec3 aBase;
attribute vec4 aAng;
attribute vec3 aCol;
attribute vec2 aDim;
uniform float uTiempo;
varying float vV;
varying vec3 vCol;
varying vec3 vNorV;
varying vec3 vPosV;
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
void main() {
  float v = position.y + 0.5;
  vec2 circ = normalize(position.xz + 1e-5);
  float rad = mix(0.22, aDim.y, v);
  vec3 local = vec3(circ.x * rad, v * aDim.x, circ.y * rad);
  float az = aAng.x + sin(uTiempo * aAng.w + aAng.z * 7.0) * aAng.z;
  float tilt = aAng.y + 0.12 * sin(uTiempo * aAng.w * 0.7 + aAng.x);
  mat3 R = rotY(az) * rotX(tilt);
  vec4 mv = viewMatrix * vec4(aBase + R * local, 1.0);
  vNorV = normalize(mat3(viewMatrix) * (R * vec3(circ.x, 0.0, circ.y)));
  vPosV = mv.xyz;
  vV = v;
  vCol = aCol;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying float vV;
varying vec3 vCol;
varying vec3 vNorV;
varying vec3 vPosV;
void main() {
  float f = abs(dot(normalize(vNorV), normalize(-vPosV)));
  float a = f * f * (1.0 - vV) * (1.0 - vV) * smoothstep(0.0, 0.06, vV);
  gl_FragColor = vec4(vCol * a, 1.0);
}`,
  })

  // ── Piso LED del club: ondas de color que laten ──
  const pisoLed = new THREE.ShaderMaterial({
    name: "ciudad-piso-led",
    uniforms: { uTiempo: u.tiempo },
    vertexShader: /* glsl */ `
varying vec3 vPosM;
void main() {
  vec4 mp = modelMatrix * vec4(position, 1.0);
  vPosM = mp.xyz;
  gl_Position = projectionMatrix * viewMatrix * mp;
}`,
    fragmentShader: /* glsl */ `
uniform float uTiempo;
varying vec3 vPosM;
${GLSL_RUIDO}
void main() {
  vec2 p = vPosM.xz;
  vec2 id = floor(p / 1.6);
  vec2 f = fract(p / 1.6);
  vec2 fwL = fwidth(p / 1.6);
  vec2 jj = smoothstep(vec2(0.0), 0.05 + fwL, f) * smoothstep(vec2(1.0), 0.95 - fwL, f);
  float junta = mix(jj.x * jj.y, 0.85, clamp(max(fwL.x, fwL.y) * 4.0 - 0.4, 0.0, 1.0));
  float beat = pow(0.5 + 0.5 * sin(uTiempo * 6.283 * 2.0), 3.0);
  float onda = 0.5 + 0.5 * sin(length(id - vec2(-66.0, -5.0)) * 0.7 - uTiempo * 3.2);
  float h = cbHash2(id + floor(uTiempo * 2.0));
  vec3 a = vec3(1.0, 0.24, 0.62);
  vec3 b = vec3(0.25, 0.75, 1.0);
  vec3 c = vec3(0.6, 0.35, 1.0);
  vec3 col = mix(mix(a, c, onda), b, smoothstep(0.75, 1.0, onda) * 0.6);
  float l = 0.06 + 0.55 * onda * onda * (0.45 + 0.55 * beat) + step(0.97, h) * 0.35;
  gl_FragColor = vec4(col * l * junta * 1.25 + vec3(0.006), 1.0);
}`,
  })

  const senal = new THREE.MeshBasicMaterial({
    name: "ciudad-senales",
    map: atlas,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: new THREE.Color(2.4, 2.4, 2.4),
    side: THREE.DoubleSide,
  })
  const pantallaMat = new THREE.MeshBasicMaterial({ name: "ciudad-pantalla", map: pantalla, color: new THREE.Color(1.5, 1.5, 1.5) })

  const C = ctx.materiales
  const oscura = (m: THREE.MeshStandardMaterial, color: string) => {
    m.color.set(color)
    return m
  }
  const agua = copia(C.agua, 1.3, "ciudad-agua")
  agua.color.set("#0f3340")
  return {
    charcos,
    roca,
    cielo,
    base,
    torres,
    luz: luzMat,
    vidrio,
    piso,
    follaje,
    cascada,
    chorros,
    vapor,
    reflejos,
    haces,
    pisoLed,
    senal,
    pantalla: pantallaMat,
    granito: copia(C.granito, 0.8, "ciudad-granito"),
    acero: copia(C.acero, 1.1, "ciudad-acero"),
    madera: oscura(copia(C.madera, 0.5, "ciudad-madera"), "#8a6a4e"),
    hierro: copia(C.hierroNegro, 0.9, "ciudad-hierro"),
    agua,
    pasto: copia(C.pasto, 0.25, "ciudad-pasto"),
    grava: copia(C.grava, 0.4, "ciudad-grava"),
    acera: copia(C.acera, 0.7, "ciudad-acera"),
    corteza: copia(C.corteza, 0.3, "ciudad-corteza"),
    u,
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. Texturas dibujadas: la pantalla del reto y los letreros
// ═══════════════════════════════════════════════════════════════

const FUENTE = "'Bricolage Grotesque', 'Manrope', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/** Miles con punto, como en la web: 450000 → "450.000". */
function miles(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** El día del reto (el día 1 es el del lanzamiento). */
function diaDelReto(): number {
  const ms = Date.now() - Date.parse(`${CHALLENGE_LAUNCH}T00:00:00`)
  return Math.max(1, Math.floor(ms / 86_400_000) + 1)
}

const PANT_W = 1024
const PANT_H = 384

/**
 * La pantalla gigante: el contador REAL del reto (RECAUDADO de CHALLENGE_TARGET).
 * Alterna dos páginas y un brillo que la barre, como un LED de estadio.
 */
function dibujarPantalla(g: CanvasRenderingContext2D, pagina: number, reloj: string, barrido: number) {
  const W = PANT_W
  const H = PANT_H
  const monto = `$${miles(RECAUDADO)}`
  const meta = `$${miles(CHALLENGE_TARGET)}`
  const pct = Math.min(1, Math.max(0, RECAUDADO / CHALLENGE_TARGET))
  const pctTxt = `${(pct * 100).toFixed(1).replace(".", ",")} %`

  const fondo = g.createLinearGradient(0, 0, 0, H)
  fondo.addColorStop(0, "#08204a")
  fondo.addColorStop(1, "#020816")
  g.fillStyle = fondo
  g.fillRect(0, 0, W, H)
  const halo = g.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, W * 0.6)
  halo.addColorStop(0, "rgba(60,140,255,0.22)")
  halo.addColorStop(1, "rgba(60,140,255,0)")
  g.fillStyle = halo
  g.fillRect(0, 0, W, H)

  g.textBaseline = "alphabetic"
  // Cabecera: el nombre del proyecto y la hora del mundo.
  g.font = `800 26px ${FUENTE}`
  g.fillStyle = "#9cc4ff"
  g.textAlign = "left"
  g.fillText("LA CASA BLANCA PROJECT", 44, 52)
  g.textAlign = "right"
  g.fillText(reloj, W - 44, 52)
  g.fillStyle = "rgba(156,196,255,0.35)"
  g.fillRect(44, 66, W - 88, 2)

  const barra = (y: number) => {
    const x0 = 44
    const x1 = W - 190
    g.fillStyle = "rgba(255,255,255,0.12)"
    g.beginPath()
    g.roundRect(x0, y, x1 - x0, 26, 13)
    g.fill()
    const lleno = Math.max(26, (x1 - x0) * pct)
    const gr = g.createLinearGradient(x0, 0, x0 + lleno, 0)
    gr.addColorStop(0, "#3ddc84")
    gr.addColorStop(1, "#7cf0b0")
    g.fillStyle = gr
    g.beginPath()
    g.roundRect(x0, y, lleno, 26, 13)
    g.fill()
    g.font = `800 34px ${FUENTE}`
    g.textAlign = "right"
    g.fillStyle = "#ffffff"
    g.fillText(pctTxt, W - 44, y + 26)
  }

  if (pagina === 0) {
    g.textAlign = "center"
    g.font = `800 44px ${FUENTE}`
    g.fillStyle = "#ffffff"
    g.fillText("DE $10 A UN MERCEDES", W / 2, 124)
    // El monto, verde con contorno oscuro (como el dinero de GTA).
    g.font = `900 132px ${FUENTE}`
    const wM = g.measureText(monto).width
    g.font = `800 62px ${FUENTE}`
    const resto = ` / ${meta}`
    const wR = g.measureText(resto).width
    const x = (W - wM - wR) / 2
    g.textAlign = "left"
    g.font = `900 132px ${FUENTE}`
    g.lineJoin = "round"
    g.lineWidth = 12
    g.strokeStyle = "#0b2a12"
    g.strokeText(monto, x, 262)
    g.fillStyle = "#6fe08a"
    g.fillText(monto, x, 262)
    g.font = `800 62px ${FUENTE}`
    g.fillStyle = "#e9f1ff"
    g.fillText(resto, x + wM, 262)
    barra(304)
  } else {
    g.textAlign = "center"
    g.font = `900 92px ${FUENTE}`
    g.fillStyle = "#ffffff"
    g.fillText("LA CASA BLANCA", W / 2, 168)
    g.font = `800 56px ${FUENTE}`
    g.fillStyle = "#9cc4ff"
    g.fillText("PROJECT", W / 2, 228)
    g.font = `700 30px ${FUENTE}`
    g.fillStyle = "#e9f1ff"
    g.fillText(`DÍA ${diaDelReto()} DEL RETO · ${monto} DE ${meta}`, W / 2, 278)
    barra(304)
  }

  // Brillo que barre la pantalla y la retícula de los LED.
  const bx = -200 + barrido * (W + 400)
  const brillo = g.createLinearGradient(bx - 120, 0, bx + 120, 0)
  brillo.addColorStop(0, "rgba(255,255,255,0)")
  brillo.addColorStop(0.5, "rgba(255,255,255,0.10)")
  brillo.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = brillo
  g.fillRect(0, 0, W, H)
  g.fillStyle = "rgba(0,0,0,0.22)"
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1)
}

interface Letrero {
  id: string
  texto: string
  /** Tamaño de la letra en píxeles del atlas. */
  px: number
  color: string
  estilo: "neon" | "panel"
  flecha?: "izq" | "der" | "arriba"
}

/** Los letreros: señalética de la ciudad, comercios y comida boliviana del mercado. Ninguna marca real. */
const LETREROS: Letrero[] = [
  { id: "club", texto: "CLUB", px: 150, color: "#ff4fae", estilo: "neon" },
  { id: "arena", texto: "ARENA", px: 120, color: "#e8f4ff", estilo: "panel" },
  { id: "estacion", texto: "ESTACIÓN", px: 96, color: "#e8f4ff", estilo: "panel" },
  { id: "mercado", texto: "MERCADO", px: 96, color: "#ffc35a", estilo: "neon" },
  { id: "plaza", texto: "PLAZA CENTRAL", px: 64, color: "#e8f4ff", estilo: "panel" },
  { id: "avenida", texto: "GRAN AVENIDA", px: 64, color: "#e8f4ff", estilo: "panel" },
  { id: "parque", texto: "PARQUE", px: 64, color: "#c9f7d8", estilo: "panel" },
  { id: "mirador", texto: "MIRADOR", px: 64, color: "#e8f4ff", estilo: "panel" },
  { id: "torres", texto: "DISTRITO DE LAS TORRES", px: 56, color: "#e8f4ff", estilo: "panel" },
  { id: "circuito", texto: "CIRCUITO CIUDAD", px: 56, color: "#7fe6ff", estilo: "panel" },
  { id: "abierto", texto: "ABIERTO", px: 56, color: "#ff79c6", estilo: "neon" },
  { id: "f-mercado", texto: "MERCADO", px: 52, color: "#ffffff", estilo: "panel", flecha: "der" },
  { id: "f-club", texto: "CLUB", px: 52, color: "#ffffff", estilo: "panel", flecha: "izq" },
  { id: "f-arena", texto: "ARENA", px: 52, color: "#ffffff", estilo: "panel", flecha: "der" },
  { id: "f-torres", texto: "TORRES", px: 52, color: "#ffffff", estilo: "panel", flecha: "izq" },
  { id: "f-estacion", texto: "ESTACIÓN", px: 52, color: "#ffffff", estilo: "panel", flecha: "arriba" },
  { id: "f-parque", texto: "PARQUE", px: 52, color: "#ffffff", estilo: "panel", flecha: "der" },
  ...["CAFÉ", "LIBRERÍA", "FARMACIA", "PANADERÍA", "HOTEL", "GALERÍA", "BARBERÍA", "FLORERÍA", "RAMEN", "HELADOS"].map(
    (t, i): Letrero => ({ id: `tienda-${i}`, texto: t, px: 60, color: [COLOR.tibio, "#7fe6ff", "#ffffff", COLOR.dorado, "#ff8fc8"][i % 5], estilo: "neon" }),
  ),
  ...["SALTEÑAS", "API Y PASTEL", "CUÑAPÉS", "ANTICUCHOS", "MOCOCHINCHI", "TUCUMANAS", "MASACO", "SOPA DE MANÍ", "PIQUE MACHO", "EMPANADAS", "JUGOS", "CAFÉ"].map(
    (t, i): Letrero => ({ id: `comida-${i}`, texto: t, px: 46, color: "#fff4e0", estilo: "panel" }),
  ),
  ...Array.from({ length: 18 }, (_, i): Letrero => ({ id: `torre-${i}`, texto: `TORRE ${String(i + 1).padStart(2, "0")}`, px: 40, color: "#d9ecff", estilo: "panel" })),
]

interface Celda {
  u0: number
  v0: number
  u1: number
  v1: number
  /** Ancho / alto del letrero. */
  aspecto: number
}

const ATLAS_W = 2048
const ATLAS_H = 1024

function dibujarAtlas(g: CanvasRenderingContext2D): Record<string, Celda> {
  g.clearRect(0, 0, ATLAS_W, ATLAS_H)
  const celdas: Record<string, Celda> = {}
  let x = 0
  let y = 0
  let fila = 0
  for (const l of LETREROS) {
    g.font = `800 ${l.px}px ${FUENTE}`
    const tw = g.measureText(l.texto).width
    const pad = Math.round(l.px * 0.45)
    const fw = l.flecha ? l.px * 1.1 : 0
    const w = Math.ceil(tw + pad * 2 + fw)
    const h = Math.ceil(l.px * 1.5)
    if (x + w > ATLAS_W) {
      x = 0
      y += fila + 4
      fila = 0
    }
    const base = y + h * 0.5 + l.px * 0.36
    const tx = l.flecha === "izq" ? x + pad + fw : x + pad
    g.textAlign = "left"
    g.textBaseline = "alphabetic"
    if (l.estilo === "neon") {
      g.shadowColor = l.color
      g.shadowBlur = l.px * 0.35
      g.lineWidth = Math.max(2, l.px * 0.07)
      g.strokeStyle = l.color
      g.strokeText(l.texto, tx, base)
      g.shadowBlur = l.px * 0.12
      g.fillStyle = "#ffffff"
      g.globalAlpha = 0.85
      g.fillText(l.texto, tx, base)
      g.globalAlpha = 1
    } else {
      g.shadowColor = l.color
      g.shadowBlur = l.px * 0.08
      g.fillStyle = l.color
      g.fillText(l.texto, tx, base)
    }
    g.shadowBlur = 0
    if (l.flecha) {
      // La flecha se dibuja a mano: no todas las fuentes traen el glifo.
      const s = l.px * 0.42
      const fx = l.flecha === "izq" ? x + pad + s : x + pad + tw + l.px * 0.25 + s
      const fy = y + h * 0.5
      g.save()
      g.translate(fx, fy)
      g.rotate(l.flecha === "der" ? 0 : l.flecha === "izq" ? Math.PI : -Math.PI / 2)
      g.fillStyle = l.color
      g.beginPath()
      g.moveTo(s, 0)
      g.lineTo(0, -s * 0.8)
      g.lineTo(0, -s * 0.28)
      g.lineTo(-s, -s * 0.28)
      g.lineTo(-s, s * 0.28)
      g.lineTo(0, s * 0.28)
      g.lineTo(0, s * 0.8)
      g.closePath()
      g.fill()
      g.restore()
    }
    celdas[l.id] = { u0: x / ATLAS_W, u1: (x + w) / ATLAS_W, v0: 1 - (y + h) / ATLAS_H, v1: 1 - y / ATLAS_H, aspecto: w / h }
    x += w + 4
    fila = Math.max(fila, h)
  }
  return celdas
}

// ═══════════════════════════════════════════════════════════════
// 6. Construcción
// ═══════════════════════════════════════════════════════════════

interface Arbol {
  x: number
  z: number
  y?: number
  alto: number
  copa: number
  color: string
}
interface Reflejo {
  x: number
  z: number
  /** Altura de la luz sobre el piso. */
  h: number
  color: THREE.ColorRepresentation
  fuerza: number
  ancho: number
}
interface Vapor {
  x: number
  y: number
  z: number
  /** Radio de dispersión del emisor. */
  r: number
  n: number
  tam: number
  alto: number
  vel: number
  color: THREE.ColorRepresentation
  fuerza: number
}
interface Haz {
  x: number
  y: number
  z: number
  az: number
  incl: number
  barrido: number
  vel: number
  largo: number
  abre: number
  color: THREE.ColorRepresentation
  fuerza: number
}

/** Todo lo que los constructores van llenando. */
interface Kit {
  base: Lote
  torres: Lote
  luz: Lote
  vidrio: Lote
  roca: Lote
  granito: Lote
  acero: Lote
  madera: Lote
  hierro: Lote
  agua: Lote
  pasto: Lote
  grava: Lote
  acera: Lote
  senal: Lote
  pantalla: Lote
  pisoLed: Lote
  arboles: Arbol[]
  reflejos: Reflejo[]
  /** Charcos de luz: el círculo que un farol deja en el piso (x, y del suelo, z, radio, color). */
  charcos: Array<{ x: number; y: number; z: number; r: number; color: string }>
  vapores: Vapor[]
  haces: Haz[]
  celdas: Record<string, Celda>
  rnd: () => number
  /** Puntos del monorriel (para no poner torres encima). */
  riel: THREE.Vector3[]
}

// Piezas reutilizables (se crean una vez por construcción).
interface Piezas {
  caja: THREE.BufferGeometry
  cil8: THREE.BufferGeometry
  cil16: THREE.BufferGeometry
  cil24: THREE.BufferGeometry
  esfera: THREE.BufferGeometry
  cono: THREE.BufferGeometry
  plano: THREE.BufferGeometry
  rocas: THREE.BufferGeometry[]
  /** Copa de árbol: varias bolas deformadas, fusionadas (una instancia por árbol). */
  copa: THREE.BufferGeometry
}

function crearPiezas(): Piezas {
  const rocas = [0, 1, 2, 3].map((k) => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute("uv").deleteAttribute("normal"))
    const p = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const d = 0.72 + 0.5 * fbm3(x * 1.3 + k * 7, y * 1.3, z * 1.3, 3)
      p.setXYZ(i, x * d, y * d * 0.8, z * d)
    }
    g.computeVertexNormals()
    return g
  })
  const bolas: Array<[number, number, number, number]> = [
    [0, 0, 0, 1],
    [0.62, -0.16, 0.16, 0.68],
    [-0.6, -0.1, 0.26, 0.66],
    [0.1, -0.2, -0.64, 0.64],
    [0.05, 0.48, 0.06, 0.62],
    [-0.32, -0.36, -0.3, 0.56],
    [0.36, 0.22, 0.46, 0.52],
  ]
  const partes = bolas.map(([x, y, z, r], i) => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute("uv").deleteAttribute("normal"))
    const p = g.getAttribute("position") as THREE.BufferAttribute
    for (let j = 0; j < p.count; j++) {
      const vx = p.getX(j)
      const vy = p.getY(j)
      const vz = p.getZ(j)
      const d = 0.82 + 0.36 * ruido3(vx * 1.7 + i * 5, vy * 1.7, vz * 1.7)
      p.setXYZ(j, x + vx * d * r, y + vy * d * r, z + vz * d * r)
    }
    g.computeVertexNormals()
    return g
  })
  const copa = mergeGeometries(partes, false)!
  for (const g of partes) g.dispose()
  return {
    copa,
    caja: new THREE.BoxGeometry(1, 1, 1),
    cil8: new THREE.CylinderGeometry(1, 1, 1, 8),
    cil16: new THREE.CylinderGeometry(1, 1, 1, 16),
    cil24: new THREE.CylinderGeometry(1, 1, 1, 24),
    esfera: new THREE.SphereGeometry(1, 12, 8),
    cono: new THREE.ConeGeometry(1, 1, 7),
    plano: new THREE.PlaneGeometry(1, 1),
    rocas,
  }
}

/** Un letrero del atlas: un cuadro de alto `alto` mirando hacia `giro` (0 = +z). */
function letrero(k: Kit, pz: Piezas, id: string, x: number, y: number, z: number, giro: number, alto: number) {
  const c = k.celdas[id]
  if (!c) return
  const g = pz.plano.clone()
  const uv = g.getAttribute("uv") as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? c.u0 : c.u1, uv.getY(i) < 0.5 ? c.v0 : c.v1)
  k.senal.agregar(g, M(x, y, z, giro, alto * c.aspecto, alto, 1))
  g.dispose()
}

// ── 6.1 La caverna: bóveda, piso, rocas, estalactitas y el cielo artificial ──

/**
 * Cuánto se aparta la roca de la forma ideal (m, hacia adentro de la roca),
 * en un punto de la bóveda de "norma" r a la altura h sobre el piso.
 */
function relieveRoca(x: number, y: number, z: number, r: number, h: number): number {
  // Grandes bultos y detalle; en el cielo artificial la roca solo se retira.
  const n1 = fbm3(x * 0.028, y * 0.04, z * 0.028, 3) - 0.5
  const n2 = fbm3(x * 0.11 + 40, y * 0.13, z * 0.11, 3) - 0.5
  const amp = 2 + 5.5 * smooth(0.55, 0.97, r)
  let d = n1 * 2 * amp + n2 * 2.2
  const kc = smooth(R_CIELO - 0.01, R_CIELO + 0.07, r)
  d = d * kc + (1 - kc) * (1.1 + Math.abs(n2) * 2)
  // Boca de la cascada: un hueco en la pared norte.
  if (z < CZ - 120) {
    const bx = x / 17
    const by = (y - (Y0 + 18)) / 6
    d += 7 * Math.exp(-(bx * bx + by * by))
  }
  // Bajo el piso casi no hay relieve (el borde inferior queda oculto).
  if (h < 0.5) d *= 0.4
  return d
}

/**
 * Un punto sobre la pared de roca: en el ángulo `ang` (alrededor del centro)
 * y a `h` metros sobre el piso, ya con el relieve. `dentro` lo adelanta hacia
 * la caverna. Devuelve también hacia dónde mira la pared (en planta).
 */
function puntoEnPared(ang: number, h: number, dentro: number): { p: THREE.Vector3; giro: number } {
  const r = Math.pow(Math.max(0, 1 - (h / ALTO) ** 2), 0.2)
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  const du = Math.sign(c) * Math.sqrt(Math.abs(c))
  const dv = Math.sign(sn) * Math.sqrt(Math.abs(sn))
  let gx = du * du * du
  let gz = dv * dv * dv
  const gl = Math.hypot(gx, gz) || 1
  gx /= gl
  gz /= gl
  // Normal del perfil (hacia la roca): (-dH/dr, MEDIO), normalizada.
  const dHdr = (ALTO * -5 * r ** 4) / (2 * Math.sqrt(Math.max(1e-4, 1 - r ** 5)))
  const l = Math.hypot(dHdr, MEDIO)
  const nr = -dHdr / l
  const nh = MEDIO / l
  const x = CX + du * MEDIO * r
  const z = CZ + dv * MEDIO * r
  const y = Y0 + h
  const d = relieveRoca(x, y, z, r, h) - dentro
  return { p: new THREE.Vector3(x + gx * nr * d, y + nh * d, z + gz * nr * d), giro: Math.atan2(-gx, -gz) }
}

/** Casas excavadas en la roca: racimos de ventanas encendidas que dan escala a las paredes. */
function construirCasasEnRoca(k: Kit, pz: Piezas, rnd: () => number) {
  const racimos = 24
  for (let c = 0; c < racimos; c++) {
    const a0 = (c / racimos) * Math.PI * 2 + rnd() * 0.25
    // Sin casas sobre la cascada (pared norte, centro).
    const pn = puntoEnPared(a0, 8, 0).p
    if (pn.z < CZ - 150 && Math.abs(pn.x) < 45) continue
    const pisos = 3 + Math.floor(rnd() * 5)
    const altoPiso = 2.4 + rnd() * 0.6
    const ancho = 0.05 + rnd() * 0.05
    for (let f = 0; f < pisos; f++) {
      const h = 3 + f * altoPiso + rnd() * 0.4
      const n = 4 + Math.floor(rnd() * 7)
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.25) continue
        const a = a0 + (i / n - 0.5) * ancho * (1 - f * 0.08)
        const { p, giro } = puntoEnPared(a, h, 0.7)
        const w = 0.6 + rnd() * 0.8
        const alto = 0.8 + rnd() * 0.6
        const tibia = rnd() < 0.8
        k.base.agregar(pz.caja, M(p.x, p.y, p.z, giro, w + 0.5, alto + 0.5, 0.3), acabado("#100e0d", 0.8, 0))
        k.luz.agregar(pz.plano, M(p.x + Math.sin(giro) * 0.16, p.y, p.z + Math.cos(giro) * 0.16, giro, w, alto, 1), luz(tibia ? (rnd() < 0.5 ? "#ffa860" : "#ffcf94") : "#9fd8ff", 0.9 + rnd() * 1.2))
        if (rnd() < 0.3) k.base.agregar(pz.caja, M(p.x + Math.sin(giro) * 0.7, p.y - alto / 2 - 0.25, p.z + Math.cos(giro) * 0.7, giro, w + 1.2, 0.12, 1.1), acabado("#2a2522", 0.7, 0.2))
      }
    }
  }
}

function construirCaverna(k: Kit, pz: Piezas, mats: MaterialesCiudad, grupo: THREE.Group, ctx: CtxEscena) {
  const N_ANG = ctx.calidad === "baja" ? 160 : 224
  const N_ANILLOS = ctx.calidad === "baja" ? 46 : 64

  // Perfil denso y remuestreado por largo: más anillos donde la pared cae a pique.
  const denso: Array<[number, number]> = []
  for (let i = 0; i <= 1500; i++) {
    const r = i / 1500
    denso.push([r, perfil(r)])
  }
  denso.push([1.0, -1.6])
  const largos = [0]
  for (let i = 1; i < denso.length; i++) {
    const dr = (denso[i][0] - denso[i - 1][0]) * MEDIO
    const dh = denso[i][1] - denso[i - 1][1]
    largos.push(largos[i - 1] + Math.hypot(dr, dh))
  }
  const total = largos[largos.length - 1]
  const anillos: Array<{ r: number; h: number; nr: number; nh: number }> = []
  let j = 0
  for (let a = 0; a <= N_ANILLOS; a++) {
    const u = a / N_ANILLOS
    const L = total * (1 - Math.pow(1 - u, 1.55))
    while (j < largos.length - 2 && largos[j + 1] < L) j++
    const t = (L - largos[j]) / Math.max(1e-6, largos[j + 1] - largos[j])
    const r = denso[j][0] + (denso[j + 1][0] - denso[j][0]) * t
    const h = denso[j][1] + (denso[j + 1][1] - denso[j][1]) * t
    // Normal del perfil hacia la roca: (-dH, dR).
    const dR = (denso[j + 1][0] - denso[j][0]) * MEDIO
    const dH = denso[j + 1][1] - denso[j][1]
    const l = Math.hypot(dR, dH) || 1
    anillos.push({ r, h, nr: dH === 0 && dR === 0 ? 0 : -dH / l, nh: dR / l })
  }
  // Hacia la roca: en el centro la normal apunta arriba (nh > 0); en la pared, hacia afuera.
  for (const a of anillos) {
    if (a.nh < 0) {
      a.nh = -a.nh
      a.nr = -a.nr
    }
    if (a.nr < 0) a.nr = -a.nr
  }

  const pos = new Float32Array((N_ANILLOS + 1) * (N_ANG + 1) * 3)
  const uvs = new Float32Array((N_ANILLOS + 1) * (N_ANG + 1) * 2)
  for (let a = 0; a <= N_ANILLOS; a++) {
    const an = anillos[a]
    for (let s = 0; s <= N_ANG; s++) {
      const ang = (s / N_ANG) * Math.PI * 2
      const c = Math.cos(ang)
      const sn = Math.sin(ang)
      const du = Math.sign(c) * Math.sqrt(Math.abs(c))
      const dv = Math.sign(sn) * Math.sqrt(Math.abs(sn))
      // Normal horizontal de la superelipse (gradiente de u⁴ + v⁴).
      let gx = du * du * du
      let gz = dv * dv * dv
      const gl = Math.hypot(gx, gz) || 1
      gx /= gl
      gz /= gl
      let x = CX + du * MEDIO * an.r
      let z = CZ + dv * MEDIO * an.r
      let y = Y0 + an.h
      const d = relieveRoca(x, y, z, an.r, an.h)
      x += (gx * an.nr) * d
      z += (gz * an.nr) * d
      y += an.nh * d
      const i = a * (N_ANG + 1) + s
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      uvs[i * 2] = s / N_ANG
      uvs[i * 2 + 1] = a / N_ANILLOS
    }
  }
  const idx: number[] = []
  for (let a = 0; a < N_ANILLOS; a++)
    for (let s = 0; s < N_ANG; s++) {
      const i0 = a * (N_ANG + 1) + s
      const i1 = i0 + 1
      const i2 = i0 + N_ANG + 1
      const i3 = i2 + 1
      // Caras hacia adentro de la caverna (desde afuera no se ven: vista de maqueta).
      idx.push(i0, i1, i2, i1, i3, i2)
    }
  const boveda = new THREE.BufferGeometry()
  boveda.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  boveda.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  boveda.setIndex(idx)
  boveda.computeVertexNormals()
  // La costura en el ángulo 0 deja normales partidas: se promedian.
  const nor = boveda.getAttribute("normal") as THREE.BufferAttribute
  for (let a = 0; a <= N_ANILLOS; a++) {
    const i0 = a * (N_ANG + 1)
    const i1 = i0 + N_ANG
    const nx = nor.getX(i0) + nor.getX(i1)
    const ny = nor.getY(i0) + nor.getY(i1)
    const nz = nor.getZ(i0) + nor.getZ(i1)
    const l = Math.hypot(nx, ny, nz) || 1
    nor.setXYZ(i0, nx / l, ny / l, nz / l)
    nor.setXYZ(i1, nx / l, ny / l, nz / l)
  }
  // ¿Las caras miran hacia adentro? Se comprueba en el centro de la bóveda (la normal debe bajar).
  if (nor.getY(5 * (N_ANG + 1) + Math.floor(N_ANG / 2)) > 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]
      idx[i + 1] = idx[i + 2]
      idx[i + 2] = t
    }
    boveda.setIndex(idx)
    boveda.computeVertexNormals()
  }
  k.roca.agregar(boveda)
  boveda.dispose()

  // ── Cielo artificial: los anillos interiores, sin relieve ──
  {
    const NA = 28
    const NS = N_ANG
    const p = new Float32Array((NA + 1) * (NS + 1) * 3)
    for (let a = 0; a <= NA; a++) {
      const r = (a / NA) * R_CIELO
      for (let s = 0; s <= NS; s++) {
        const ang = (s / NS) * Math.PI * 2
        const c = Math.cos(ang)
        const sn = Math.sin(ang)
        const i = a * (NS + 1) + s
        const x = CX + Math.sign(c) * Math.sqrt(Math.abs(c)) * MEDIO * r
        const z = CZ + Math.sign(sn) * Math.sqrt(Math.abs(sn)) * MEDIO * r
        p[i * 3] = x
        p[i * 3 + 1] = Y0 + perfil(r) - 0.15
        p[i * 3 + 2] = z
      }
    }
    const ix: number[] = []
    for (let a = 0; a < NA; a++)
      for (let s = 0; s < NS; s++) {
        const i0 = a * (NS + 1) + s
        const i1 = i0 + 1
        const i2 = i0 + NS + 1
        const i3 = i2 + 1
        ix.push(i0, i2, i1, i1, i2, i3)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(p, 3))
    g.setIndex(ix)
    g.computeVertexNormals()
    const n = g.getAttribute("normal") as THREE.BufferAttribute
    if (n.getY(3 * (NS + 1) + Math.floor(NS / 2)) > 0) {
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1]
        ix[i + 1] = ix[i + 2]
        ix[i + 2] = t
      }
      g.setIndex(ix)
    }
    const cieloMalla = new THREE.Mesh(g, mats.cielo)
    cieloMalla.name = "ciudad-cielo"
    grupo.add(cieloMalla)

    // Marco del cielo: un aro de acero oscuro con una línea de luz (la "cornisa").
    const marco: THREE.Vector3[] = []
    const NM = 256
    for (let s = 0; s < NM; s++) {
      const ang = (s / NM) * Math.PI * 2
      const c = Math.cos(ang)
      const sn = Math.sin(ang)
      marco.push(new THREE.Vector3(Math.sign(c) * Math.sqrt(Math.abs(c)), 0, Math.sign(sn) * Math.sqrt(Math.abs(sn))))
    }
    const enR = (d: THREE.Vector3, r: number, baja: number, out: THREE.Vector3) => out.set(CX + d.x * MEDIO * r, Y0 + perfil(r) - baja, CZ + d.z * MEDIO * r)
    const aro = cinta(
      marco,
      (i, lado, out) => enR(marco[i], lado < 0 ? R_CIELO - 0.006 : R_CIELO + 0.016, lado < 0 ? 0.35 : 0.1, out),
      (_i, out) => out.set(0, -1, 0),
      true,
    )
    k.base.agregar(aro, null, acabado("#1b1e23", 0.45, 0.8))
    const linea = cinta(
      marco,
      (i, lado, out) => enR(marco[i], lado < 0 ? R_CIELO - 0.0045 : R_CIELO - 0.0005, 0.42, out),
      (_i, out) => out.set(0, -1, 0),
      true,
    )
    k.luz.agregar(linea, null, luz("#fff1d8", 0.7))
    aro.dispose()
    linea.dispose()
  }

  // ── Piso: el contorno de la caverna con agujeros para el canal y el lago ──
  const contorno = poligono.caverna(1.004, 256)
  const canal = poligono.rectRedondeado(CANAL.x0, CANAL.x1, CANAL.z0, CANAL.z1, CANAL.radio, 8)
  const lago = poligono.elipse(LAGO.x, LAGO.z, LAGO.rx, LAGO.rz, 56)
  const piso = losa(contorno, Y0, [canal, lago])
  const pisoMalla = new THREE.Mesh(piso, mats.piso)
  pisoMalla.name = "ciudad-piso"
  pisoMalla.receiveShadow = ctx.sombras
  grupo.add(pisoMalla)

  // ── Rocas al pie de las paredes y estalactitas en la bóveda ──
  const rnd = semilla(907)
  const nRocas = ctx.calidad === "baja" ? 110 : 220
  for (let i = 0; i < nRocas; i++) {
    const ang = rnd() * Math.PI * 2
    const r = 0.955 + rnd() * 0.05
    const c = Math.cos(ang)
    const sn = Math.sin(ang)
    const x = CX + Math.sign(c) * Math.sqrt(Math.abs(c)) * MEDIO * r
    const z = CZ + Math.sign(sn) * Math.sqrt(Math.abs(sn)) * MEDIO * r
    if (x > CANAL.x0 + 8 && x < CANAL.x1 - 8 && z > CANAL.z0 + 3 && z < CANAL.z1) continue
    const t = 1.2 + Math.pow(rnd(), 2) * 4.5
    k.roca.agregar(pz.rocas[i % 4], M(x, Y0 + t * 0.15, z, rnd() * 6, t * (1 + rnd() * 0.6), t * (0.6 + rnd() * 0.6), t))
  }
  const nEst = ctx.calidad === "baja" ? 90 : 190
  for (let i = 0; i < nEst; i++) {
    const ang = rnd() * Math.PI * 2
    const r = R_CIELO + 0.05 + rnd() * 0.33
    const c = Math.cos(ang)
    const sn = Math.sin(ang)
    const x = CX + Math.sign(c) * Math.sqrt(Math.abs(c)) * MEDIO * r
    const z = CZ + Math.sign(sn) * Math.sqrt(Math.abs(sn)) * MEDIO * r
    const largo = 1.2 + Math.pow(rnd(), 1.6) * 6
    const ancho = 0.35 + rnd() * 0.9
    const techo = Y0 + perfil(r) + 1.2
    k.roca.agregar(pz.cono, M(x, techo - largo / 2, z, rnd() * 6, ancho, largo, ancho * (0.7 + rnd() * 0.5), Math.PI))
  }
  // Rocas que asoman en el agua al pie de la cascada.
  for (let i = 0; i < 9; i++) {
    const t = 1.5 + rnd() * 2.8
    k.roca.agregar(pz.rocas[i % 4], M(-24 + i * 6 + rnd() * 3, CANAL.agua - 0.4, -104 + rnd() * 5, rnd() * 6, t * 1.3, t * 0.7, t))
  }
}

// ── 6.2 Canal, cascada y Mirador ──

function construirCanal(k: Kit, pz: Piezas, mats: MaterialesCiudad, grupo: THREE.Group) {
  const contorno = poligono.rectRedondeado(CANAL.x0, CANAL.x1, CANAL.z0, CANAL.z1, CANAL.radio, 8)
  k.granito.agregar(muroContorno(contorno, CANAL.fondo, Y0, true))
  k.base.agregar(losa(contorno, CANAL.fondo + 0.01), null, acabado("#0d1418", 0.3, 0))
  k.agua.agregar(losa(contorno, CANAL.agua))
  // Parapeto bajo de piedra (salvo frente al Mirador, donde va la baranda de vidrio).
  const parapeto: V2[] = poligono.rectRedondeado(CANAL.x0 - 0.6, CANAL.x1 + 0.6, CANAL.z0 - 0.6, CANAL.z1 + 0.6, CANAL.radio + 0.6, 8)
  for (let i = 0; i < parapeto.length; i++) {
    const [ax, az] = parapeto[i]
    const [bx, bz] = parapeto[(i + 1) % parapeto.length]
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    if (mz > CANAL.z1 - 2 && Math.abs(mx) < R_MIRADOR.x1 + 3) continue
    const largo = Math.hypot(bx - ax, bz - az)
    k.granito.agregar(pz.caja, M(mx, Y0 + 0.45, mz, Math.atan2(-(bz - az), bx - ax), largo + 0.05, 0.9, 0.6))
  }
  // Línea de luz cian sobre el agua: se refleja y marca el borde de noche.
  const borde = muroContorno(poligono.rectRedondeado(CANAL.x0 + 0.02, CANAL.x1 - 0.02, CANAL.z0 + 0.02, CANAL.z1 - 0.02, CANAL.radio, 8), CANAL.agua + 0.35, CANAL.agua + 0.5, true)
  k.luz.agregar(borde, null, luz("#5fe3ff", 1.8))
  for (let x = CANAL.x0 + 16; x <= CANAL.x1 - 16; x += 24) k.reflejos.push({ x, z: CANAL.z1 - 1.5, h: 0.6, color: "#5fe3ff", fuerza: 0.18, ancho: 2.5 })

  // ── La cascada: una lámina curva que sale de la roca y cae 20 m al canal ──
  const ancho = 36
  const arriba = Y0 + 17.5
  const zSale = CZ - 189.5
  const caida = arriba - CANAL.agua
  const seg = 40
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= seg; j++) {
    const v = j / seg
    const y = arriba - v * caida
    // Trayectoria de tiro: el agua sale con ~2,4 m/s y se separa de la roca.
    const sale = 2.4 * Math.sqrt((2 * (v * caida)) / 9.8)
    for (let i = 0; i <= 24; i++) {
      const u = i / 24
      const x = (u - 0.5) * ancho
      const curva = 1.5 * Math.cos((u - 0.5) * Math.PI) - 1.5
      pos.push(x, y, zSale + sale - curva * 0.8 + Math.sin(u * 9) * 0.25)
      uv.push(u, v)
    }
  }
  for (let j = 0; j < seg; j++)
    for (let i = 0; i < 24; i++) {
      const a = j * 25 + i
      idx.push(a, a + 1, a + 25, a + 1, a + 26, a + 25)
    }
  const lamina = new THREE.BufferGeometry()
  lamina.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  lamina.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  lamina.setIndex(idx)
  const cascada = new THREE.Mesh(lamina, mats.cascada)
  cascada.name = "ciudad-cascada"
  cascada.renderOrder = 2
  grupo.add(cascada)
  // El labio de roca de donde sale el agua.
  const rl = semilla(5)
  for (let i = 0; i < 11; i++) {
    const t = 1.6 + rl() * 2.2
    k.roca.agregar(pz.rocas[i % 4], M(-ancho / 2 + (i / 10) * ancho + (rl() - 0.5) * 2, arriba + 0.6 + rl() * 0.8, zSale - 1.2 - rl() * 1.5, rl() * 6, t * 1.4, t * 0.6, t))
  }
  // Bruma al pie, focos cian bajo el agua y el resplandor en el agua.
  k.vapores.push({ x: 0, y: CANAL.agua - 0.5, z: zSale + 6, r: ancho * 0.55, n: 150, tam: 9, alto: 9, vel: 0.05, color: "#cfe9f5", fuerza: 0.32 })
  k.vapores.push({ x: 0, y: CANAL.agua - 0.2, z: -80, r: 70, n: 40, tam: 10, alto: 3, vel: 0.02, color: "#9fc8dc", fuerza: 0.14 })
  for (let i = -2; i <= 2; i++) k.reflejos.push({ x: i * 7, z: zSale + 4, h: 4, color: "#9fe8ff", fuerza: 0.35, ancho: 5 })
  k.luz.agregar(pz.caja, M(0, CANAL.agua + 0.06, zSale + 5, 0, ancho * 0.95, 0.04, 3.5), luz("#6fe6ff", 2.2))

  // ── El Mirador: un balcón con baranda de vidrio que vuela sobre el canal ──
  const m = R_MIRADOR
  const zBalcon = CANAL.z1 - 2.5
  // Deck de madera (y la parte que vuela sobre el agua).
  k.madera.agregar(pz.caja, M(cx(m), Y0 + 0.06, (zBalcon + m.z1) / 2, 0, m.x1 - m.x0 + 4, 0.12, m.z1 - zBalcon))
  k.base.agregar(pz.caja, M(cx(m), Y0 - 0.45, zBalcon + 1.5, 0, m.x1 - m.x0 + 4, 0.9, 3.2), acabado("#22262c", 0.5, 0.4))
  const xb0 = m.x0 - 2
  const xb1 = m.x1 + 2
  // Baranda: paneles de vidrio, pasamanos de acero y una línea de luz en el borde.
  const panel = (x0: number, z0: number, x1: number, z1: number) => {
    const largo = Math.hypot(x1 - x0, z1 - z0)
    const giro = Math.atan2(-(z1 - z0), x1 - x0)
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    k.vidrio.agregar(pz.caja, M(mx, Y0 + 0.7, mz, giro, largo, 1.1, 0.03))
    k.acero.agregar(pz.caja, M(mx, Y0 + 1.28, mz, giro, largo, 0.07, 0.1))
    k.luz.agregar(pz.caja, M(mx, Y0 + 0.14, mz, giro, largo, 0.04, 0.06), luz("#ffcf8a", 2.4))
  }
  panel(xb0, zBalcon, xb1, zBalcon)
  panel(xb0, zBalcon, xb0, zBalcon + 6)
  panel(xb1, zBalcon, xb1, zBalcon + 6)
  // Visores y bancos mirando a la cascada.
  for (const x of [-18, 0, 18]) {
    k.base.agregar(pz.cil8, M(x, Y0 + 0.55, zBalcon + 1.6, 0, 0.09, 1.1, 0.09), acabado("#20444c", 0.35, 0.8))
    k.base.agregar(pz.caja, M(x, Y0 + 1.2, zBalcon + 1.6, 0, 0.55, 0.32, 0.38, -0.25), acabado("#2a5c66", 0.3, 0.85))
  }
  for (const x of [-24, -9, 9, 24]) banco(k, pz, x, zBalcon + 9, Math.PI)
  for (const x of [m.x0 + 1, m.x1 - 1]) for (const z of [zBalcon + 4, m.z1 - 4]) farol(k, pz, x, z, 4.2, "#ffd29a")
  letrero(k, pz, "mirador", cx(m) - 14, Y0 + 2.6, m.z1 - 0.58, 0, 0.8)
  k.base.agregar(pz.caja, M(cx(m) - 14, Y0 + 1.4, m.z1 - 0.75, 0, 7, 2.8, 0.3), acabado("#15181d", 0.4, 0.6))
}

// ── Mobiliario común ──

/** Un aro de luz horizontal. */
function aro(k: Kit, x: number, y: number, z: number, r: number, grosor: number, color: string, fuerza: number) {
  const g = new THREE.TorusGeometry(r, grosor, 5, Math.max(16, Math.round(r * 10)))
  g.rotateX(Math.PI / 2)
  k.luz.agregar(g, M(x, y, z), luz(color, fuerza))
  g.dispose()
}

function farol(k: Kit, pz: Piezas, x: number, z: number, alto = 5, color: string = COLOR.tibio, fuerza = 4.5, suelo: number = Y0) {
  k.charcos.push({ x, y: suelo, z, r: alto * 1.35, color })
  k.hierro.agregar(pz.cil8, M(x, Y0 + alto / 2, z, 0, 0.09, alto, 0.09))
  k.hierro.agregar(pz.cil8, M(x, Y0 + 0.25, z, 0, 0.22, 0.5, 0.22))
  k.hierro.agregar(pz.cil8, M(x, Y0 + alto + 0.05, z, 0, 0.28, 0.1, 0.28))
  k.luz.agregar(pz.esfera, M(x, Y0 + alto + 0.38, z, 0, 0.3, 0.36, 0.3), luz(color, fuerza))
  k.reflejos.push({ x, z, h: alto + 0.4, color, fuerza: 0.5, ancho: 0.9 })
}

function banco(k: Kit, pz: Piezas, x: number, z: number, giro: number) {
  k.madera.agregar(pz.caja, M(x, Y0 + 0.46, z, giro, 2.2, 0.08, 0.55))
  // Respaldo: detrás del asiento (el frente del banco mira hacia +z local).
  k.madera.agregar(pz.caja, M(x - Math.sin(giro) * 0.27, Y0 + 0.78, z - Math.cos(giro) * 0.27, giro, 2.2, 0.4, 0.06, -0.12))
  const dx = Math.cos(giro) * 0.9
  const dz = -Math.sin(giro) * 0.9
  for (const s of [-1, 1]) k.hierro.agregar(pz.caja, M(x + dx * s, Y0 + 0.22, z + dz * s, giro, 0.08, 0.44, 0.5))
}

function maceta(k: Kit, pz: Piezas, x: number, z: number, lado: number, color: string, alto = 3) {
  k.granito.agregar(pz.caja, M(x, Y0 + 0.4, z, 0, lado, 0.8, lado))
  k.base.agregar(pz.caja, M(x, Y0 + 0.81, z, 0, lado - 0.25, 0.04, lado - 0.25), acabado("#2a1d14", 0.95, 0))
  k.luz.agregar(pz.caja, M(x, Y0 + 0.06, z, 0, lado + 0.04, 0.04, lado + 0.04), luz("#ffcf8a", 0.9))
  k.arboles.push({ x, z, y: Y0 + 0.8, alto, copa: 0.95 + lado * 0.13, color })
}

// ── 6.3 El ascensor de vidrio ──

interface Cabina {
  grupo: THREE.Group
  arriba: number
}

function construirAscensor(k: Kit, pz: Piezas, mats: MaterialesCiudad, ctx: CtxEscena): Cabina {
  const { x, z } = ASC
  const techo = techoCiudad(x, z) - 0.2
  const r = 2.8
  const alto = techo - Y0
  // Podio con anillo de luz y el tubo de vidrio.
  k.granito.agregar(pz.cil24, M(x, Y0 + 0.15, z, 0, 5.6, 0.3, 5.6))
  aro(k, x, Y0 + 0.31, z, 5.5, 0.05, "#5fe3ff", 2.2)
  k.base.agregar(pz.cil24, M(x, Y0 + 0.32, z, 0, 5.3, 0.03, 5.3), acabado("#14181d", 0.25, 0.6))
  const tubo = new THREE.CylinderGeometry(r, r, alto - 0.3, 32, 1, true)
  k.vidrio.agregar(tubo, M(x, Y0 + 0.3 + (alto - 0.3) / 2, z))
  tubo.dispose()
  // Parantes, aros de acero cada 3,5 m y aros de luz cada 7 m.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.acero.agregar(pz.caja, M(x + Math.cos(a) * (r + 0.05), Y0 + alto / 2, z + Math.sin(a) * (r + 0.05), -a, 0.14, alto, 0.14))
  }
  for (let y = Y0 + 3.5; y < techo - 1; y += 3.5) {
    const toro = new THREE.TorusGeometry(r + 0.06, 0.07, 6, 40)
    toro.rotateX(Math.PI / 2)
    const esLuz = Math.round((y - Y0) / 3.5) % 2 === 0
    if (esLuz) k.luz.agregar(toro, M(x, y, z), luz("#bfefff", 2.4))
    else k.acero.agregar(toro, M(x, y, z))
    toro.dispose()
  }
  // Collar donde el tubo entra en el cielo.
  k.base.agregar(pz.cil24, M(x, techo - 0.4, z, 0, r + 2.2, 0.8, r + 2.2), acabado("#1b1f25", 0.4, 0.8))
  aro(k, x, techo - 0.82, z, r + 1.9, 0.07, "#d9f4ff", 3)
  aro(k, x, techo - 0.82, z, r + 0.6, 0.05, "#d9f4ff", 2.4)
  // Rieles de la cabina.
  for (const s of [-1, 1]) k.acero.agregar(pz.caja, M(x + s * (r - 0.25), Y0 + alto / 2, z, 0, 0.12, alto, 0.2))
  k.reflejos.push({ x, z, h: 3.5, color: "#7fe6ff", fuerza: 0.7, ancho: 3.5 })
  k.vapores.push({ x, y: Y0 + 0.2, z, r: 4, n: 10, tam: 3, alto: 2, vel: 0.06, color: "#bfe8ff", fuerza: 0.12 })

  // La cabina: piso, techo con luz cálida y vidrio. Sube y baja (alActualizar).
  const cab = new Lote([
    ["color", 3],
    ["aRM", 2],
    ["aEmis", 3],
  ])
  const rc = r - 0.4
  cab.agregar(pz.cil24, M(0, 0.1, 0, 0, rc, 0.2, rc), acabado("#d7dade", 0.35, 0.7))
  cab.agregar(pz.cil24, M(0, 3.1, 0, 0, rc, 0.2, rc), acabado("#d7dade", 0.35, 0.7))
  cab.agregar(pz.cil24, M(0, 2.98, 0, 0, rc - 0.4, 0.04, rc - 0.4), acabado("#fff3dc", 0.5, 0, "#ffe2b0", 3.2))
  cab.agregar(pz.caja, M(0, 1.05, -rc + 0.15, 0, 1.6, 0.06, 0.25), acabado("#b6bcc4", 0.3, 0.9))
  const cabVid = new Lote()
  const pared = new THREE.CylinderGeometry(rc, rc, 2.8, 24, 1, true)
  cabVid.agregar(pared, M(0, 1.6, 0))
  pared.dispose()
  const g = new THREE.Group()
  g.name = "ciudad-cabina"
  const m1 = cab.malla(mats.base, "ciudad-cabina-base")
  const m2 = cabVid.malla(mats.vidrio, "ciudad-cabina-vidrio")
  if (m1) {
    m1.castShadow = ctx.sombras
    g.add(m1)
  }
  if (m2) g.add(m2)
  g.position.set(x, Y0 + 0.35, z)
  return { grupo: g, arriba: techo - 3.6 }
}

// ── 6.4 La Plaza Central: fuente a ras de piso y la pantalla del reto ──

interface Chorro {
  x: number
  y: number
  z: number
  alto: number
  fase: number
}

function construirPlaza(k: Kit, pz: Piezas, chorros: Chorro[]) {
  const P = R_PLAZA
  const fx = cx(P)
  const fz = cz(P)
  // Rosa de los vientos en el piso: anillos de granito y líneas de luz que salen de la fuente.
  const anillo = (r0: number, r1: number) => losa(poligono.elipse(fx, fz, r1, r1, 72), Y0 + 0.012, [poligono.elipse(fx, fz, r0, r0, 72)])
  k.granito.agregar(anillo(9.2, 11))
  k.granito.agregar(anillo(21.5, 23))
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const largo = i % 2 === 0 ? 10 : 6
    const r = 11.5 + largo / 2
    k.luz.agregar(pz.caja, M(fx + Math.cos(a) * r, Y0 + 0.02, fz + Math.sin(a) * r, -a, largo, 0.02, i % 2 === 0 ? 0.14 : 0.08), luz("#cfe9ff", i % 2 === 0 ? 1.6 : 0.9))
  }
  // La fuente: un espejo de agua oscuro a ras de piso con chorros que bailan (se puede caminar por encima).
  k.base.agregar(losa(poligono.elipse(fx, fz, 9.2, 9.2, 64), Y0 + 0.015), null, acabado("#0c1116", 0.08, 0.2))
  k.agua.agregar(losa(poligono.elipse(fx, fz, 8.6, 8.6, 64), Y0 + 0.03))
  k.luz.agregar(muroContorno(poligono.elipse(fx, fz, 9.1, 9.1, 64), Y0 + 0.02, Y0 + 0.06, false), null, luz("#6fe6ff", 2))
  chorros.push({ x: fx, y: Y0, z: fz, alto: 7.5, fase: 0 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    chorros.push({ x: fx + Math.cos(a) * 4.6, y: Y0, z: fz + Math.sin(a) * 4.6, alto: 3, fase: i * 0.52 })
    chorros.push({ x: fx + Math.cos(a + 0.26) * 7.4, y: Y0, z: fz + Math.sin(a + 0.26) * 7.4, alto: 1.5, fase: i * 0.52 + Math.PI })
    k.luz.agregar(pz.cil8, M(fx + Math.cos(a) * 4.6, Y0 + 0.04, fz + Math.sin(a) * 4.6, 0, 0.22, 0.02, 0.22), luz("#bff4ff", 4))
  }
  k.vapores.push({ x: fx, y: Y0 + 0.5, z: fz, r: 5, n: 26, tam: 4, alto: 6, vel: 0.07, color: "#e3f6ff", fuerza: 0.16 })
  k.reflejos.push({ x: fx, z: fz, h: 5, color: "#9fe8ff", fuerza: 0.5, ancho: 3 })

  // Bancos mirando a la fuente, macetas con tajibos y faroles.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    banco(k, pz, fx + Math.cos(a) * 15.5, fz + Math.sin(a) * 15.5, Math.PI / 2 - a + Math.PI)
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    maceta(k, pz, fx + Math.cos(a) * 19, fz + Math.sin(a) * 19, 3, i % 2 === 0 ? "#f08cbc" : "#f3d24c", 3.4)
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    farol(k, pz, fx + Math.cos(a) * 25.5, fz + Math.sin(a) * 25.5, 5.5, "#ffd7a0")
  }
  // Tótems de señalética.
  totem(k, pz, P.x1 - 3, P.z0 + 4, -Math.PI / 2, ["f-mercado", "f-arena", "f-parque"])
  totem(k, pz, P.x0 + 3, P.z0 + 4, Math.PI / 2, ["f-club", "f-torres", "f-estacion"])
  // El cartel de la plaza, a un costado (el centro es el camino del ascensor).
  letrero(k, pz, "plaza", fx - 16, Y0 + 3.2, P.z0 - 0.47, Math.PI, 0.85)
  k.base.agregar(pz.caja, M(fx - 16, Y0 + 1.75, P.z0 - 0.25, 0, 10.5, 3.5, 0.4), acabado("#14181d", 0.35, 0.7))
  k.luz.agregar(pz.caja, M(fx - 16, Y0 + 3.52, P.z0 - 0.25, 0, 10.5, 0.06, 0.42), luz("#7fe6ff", 2))

  // Vestíbulo del ascensor: anillos de piedra y de agua a ras de piso, árboles, bancos y faroles.
  const ax = ASC.x
  const az = ASC.z
  k.granito.agregar(losa(poligono.elipse(ax, az, 15, 15, 72), Y0 + 0.011, [poligono.elipse(ax, az, 9.5, 9.5, 72)]))
  k.agua.agregar(losa(poligono.elipse(ax, az, 8.8, 8.8, 72), Y0 + 0.025, [poligono.elipse(ax, az, 6.2, 6.2, 72)]))
  k.base.agregar(losa(poligono.elipse(ax, az, 9.5, 9.5, 72), Y0 + 0.008, [poligono.elipse(ax, az, 5.6, 5.6, 72)]), null, acabado("#0b0f13", 0.1, 0.2))
  aro(k, ax, Y0 + 0.03, az, 9.05, 0.04, "#7fe6ff", 1.6)
  aro(k, ax, Y0 + 0.03, az, 15.1, 0.04, "#ffd9a8", 1.2)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    maceta(k, pz, ax + Math.cos(a) * 12.2, az + Math.sin(a) * 12.2, 2.6, i % 2 ? "#f08cbc" : "#4f8d3c", 3)
    banco(k, pz, ax + Math.cos(a + 0.42) * 12, az + Math.sin(a + 0.42) * 12, Math.PI / 2 - (a + 0.42) + Math.PI)
    banco(k, pz, ax + Math.cos(a - 0.42) * 12, az + Math.sin(a - 0.42) * 12, Math.PI / 2 - (a - 0.42) + Math.PI)
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    farol(k, pz, ax + Math.cos(a) * 16.5, az + Math.sin(a) * 16.5, 5, "#ffd7a0")
  }
  // Líneas de luz en el piso que llevan a la plaza y al Mirador.
  for (const s of [-1, 1]) {
    k.luz.agregar(pz.caja, M(ASC.x + s * 3.4, Y0 + 0.02, (ASC.z + P.z0) / 2 + 2, 0, 0.1, 0.02, P.z0 - ASC.z), luz("#cfe9ff", 1.4))
    k.luz.agregar(pz.caja, M(ASC.x + s * 3.4, Y0 + 0.02, (ASC.z + R_MIRADOR.z1) / 2 - 2, 0, 0.1, 0.02, ASC.z - R_MIRADOR.z1), luz("#cfe9ff", 1.4))
  }
}

function totem(k: Kit, pz: Piezas, x: number, z: number, giro: number, ids: string[]) {
  k.base.agregar(pz.caja, M(x, Y0 + 1.6, z, giro, 1.6, 3.2, 0.35), acabado("#14181d", 0.3, 0.7))
  k.luz.agregar(pz.caja, M(x, Y0 + 3.24, z, giro, 1.6, 0.06, 0.36), luz("#7fe6ff", 2.2))
  const nx = Math.sin(giro) * 0.19
  const nz = Math.cos(giro) * 0.19
  ids.forEach((id, i) => {
    letrero(k, pz, id, x + nx, Y0 + 2.6 - i * 0.62, z + nz, giro, 0.48)
    letrero(k, pz, id, x - nx, Y0 + 2.6 - i * 0.62, z - nz, giro + Math.PI, 0.48)
  })
}

/** La pantalla del reto: pórtico de dos pilonos con la pantalla arriba, que se ve de los dos lados. */
function construirPantalla(k: Kit, pz: Piezas) {
  const z = PANTALLA.z
  const w = PANTALLA.ancho
  const h = PANTALLA.alto
  const yb = PANTALLA.base
  const ym = yb + h / 2
  const xp = w / 2 + 1.6
  for (const s of [-1, 1]) {
    k.base.agregar(pz.caja, M(s * xp, Y0 + (yb + h + 1.5 - Y0) / 2, z, 0, 2.4, yb + h + 1.5 - Y0, 2.4), acabado("#1a1d22", 0.35, 0.75))
    k.luz.agregar(pz.caja, M(s * (xp - 1.21), Y0 + (yb + h + 1.5 - Y0) / 2, z, 0, 0.05, yb + h + 1.5 - Y0, 0.3), luz("#7fe6ff", 2.4))
    k.luz.agregar(pz.caja, M(s * (xp + 1.21), Y0 + (yb + h + 1.5 - Y0) / 2, z, 0, 0.05, yb + h + 1.5 - Y0, 0.3), luz("#7fe6ff", 1.4))
    k.reflejos.push({ x: s * xp, z, h: 9, color: "#7fe6ff", fuerza: 0.35, ancho: 1.2 })
  }
  // Marco y viga superior.
  k.base.agregar(pz.caja, M(0, ym, z, 0, w + 1.2, h + 1.2, 1.1), acabado("#0f1216", 0.4, 0.7))
  k.base.agregar(pz.caja, M(0, yb + h + 1.1, z, 0, w + 5.6, 0.8, 1.6), acabado("#1a1d22", 0.35, 0.75))
  k.luz.agregar(pz.caja, M(0, yb - 0.62, z, 0, w + 1.2, 0.06, 1.12), luz("#d9f4ff", 2.6))
  // Las dos caras: hacia la plaza (norte) y hacia la avenida (sur).
  const cara = pz.plano.clone()
  k.pantalla.agregar(cara, M(0, ym, z - 0.56, Math.PI, w, h, 1))
  k.pantalla.agregar(cara, M(0, ym, z + 0.56, 0, w, h, 1))
  cara.dispose()
  // La luz de la pantalla en el piso mojado.
  for (let i = -3; i <= 3; i++) {
    k.reflejos.push({ x: i * 3.4, z: z - 0.6, h: ym - Y0, color: i % 2 === 0 ? "#79e39a" : "#8fb8ff", fuerza: 0.22, ancho: 3 })
    k.reflejos.push({ x: i * 3.4, z: z + 0.6, h: ym - Y0, color: i % 2 === 0 ? "#79e39a" : "#8fb8ff", fuerza: 0.16, ancho: 3 })
  }
}

// ── 6.5 La Gran Avenida ──

function construirAvenida(k: Kit, pz: Piezas, rnd: () => number) {
  const A = R_AVENIDA
  const largo = A.z1 - A.z0
  // Aceras de piedra, bordillos y líneas de luz embutidas en el piso.
  for (const s of [-1, 1]) {
    k.acera.agregar(pz.caja, M(s * (A.x1 + 2.2), Y0 + 0.06, cz(A), 0, 4.4, 0.12, largo))
    k.granito.agregar(pz.caja, M(s * (A.x1 + 0.1), Y0 + 0.08, cz(A), 0, 0.3, 0.16, largo))
    k.luz.agregar(pz.caja, M(s * 4.6, Y0 + 0.015, cz(A) + 2, 0, 0.12, 0.02, largo - 4), luz("#d9ecff", 1.2))
  }
  // Faroles, macetas con tajibos rosados y bancos, alternados.
  for (let z = A.z0 + 8; z <= A.z1 - 4; z += 15) {
    for (const s of [-1, 1]) {
      farol(k, pz, s * 10.3, z, 6, "#ffcf94", 5)
      if (z + 7.5 < A.z1 - 3) maceta(k, pz, s * 7.2, z + 7.5, 2.4, rnd() < 0.75 ? "#f28cbf" : "#f5d34e", 3.2)
    }
    if (rnd() < 0.6) banco(k, pz, 7.2, z + 2.5, -Math.PI / 2)
    if (rnd() < 0.6) banco(k, pz, -7.2, z + 2.5, Math.PI / 2)
  }
  // Rejillas de las que sale vapor (la ciudad respira).
  for (const [x, z] of [
    [-3, 112],
    [2.5, 141],
    [-1.5, 176],
    [3, 203],
  ] as const) {
    k.base.agregar(pz.caja, M(x, Y0 + 0.01, z, 0, 1.6, 0.02, 1.0), acabado("#0e1013", 0.6, 0.8))
    k.vapores.push({ x, y: Y0 + 0.1, z, r: 0.7, n: 16, tam: 2.4, alto: 5, vel: 0.09, color: "#e9eef5", fuerza: 0.22 })
  }
  // Edificios a los dos lados: planta baja de comercio y pisos con ventanas.
  const tramos: Array<[number, number]> = [
    [A.z0 + 7, A.z0 + 31],
    [A.z0 + 36, A.z0 + 60],
    [A.z0 + 65, A.z0 + 89],
    [A.z0 + 94, A.z0 + 118],
    [A.z0 + 123, A.z1 - 3],
  ]
  let tienda = 0
  tramos.forEach(([z0, z1], i) => {
    for (const s of [-1, 1]) {
      const prof = s < 0 ? 14 : 12
      const xin = A.x1 + 4.4
      const x0 = s < 0 ? -(xin + prof) : xin
      const x1 = s < 0 ? -xin : xin + prof
      const alto = [12, 17, 14, 19, 11][(i + (s > 0 ? 2 : 0)) % 5]
      const pol: V2[] = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ]
      const estilo = (i * 2 + (s > 0 ? 1 : 0)) % 5
      const tono = ["#2a2f36", "#3a342e", "#24292f", "#423b33", "#2f343c"][estilo]
      k.torres.agregar(prisma(pol, Y0, Y0 + alto), null, { color: hexA(tono), aSem: [i * 7 + (s > 0 ? 3 : 0) + 1] })
      const fx = s < 0 ? x1 : x0
      if (estilo % 2 === 0) {
        // Balcones corridos con baranda de vidrio y una luz bajo cada losa.
        for (let y = Y0 + 7.6; y < Y0 + alto - 1; y += 3.2) {
          k.base.agregar(pz.caja, M(fx - s * 0.55, y, (z0 + z1) / 2, 0, 1.1, 0.2, z1 - z0 - 1), acabado("#c9c6bf", 0.55, 0.1))
          k.vidrio.agregar(pz.caja, M(fx - s * 1.08, y + 0.55, (z0 + z1) / 2, 0, 0.03, 0.9, z1 - z0 - 1))
          k.luz.agregar(pz.caja, M(fx - s * 1.0, y - 0.11, (z0 + z1) / 2, 0, 0.05, 0.02, z1 - z0 - 1.2), luz("#ffd9a8", 0.9))
        }
      } else {
        // Aletas verticales de metal oscuro, a ritmo de ventana.
        for (let z = z0 + 0.8; z < z1 - 0.5; z += 3.2) k.base.agregar(pz.caja, M(fx - s * 0.3, Y0 + 4.4 + (alto - 4.4) / 2, z, 0, 0.6, alto - 4.4, 0.14), acabado("#14171b", 0.4, 0.7))
      }
      // Cornisa con luz y marquesina sobre la vidriera.
      const fachada = s < 0 ? x1 : x0
      k.base.agregar(pz.caja, M((x0 + x1) / 2, Y0 + alto + 0.3, (z0 + z1) / 2, 0, prof + 0.4, 0.6, z1 - z0 + 0.4), acabado("#1b1f24", 0.4, 0.6))
      k.luz.agregar(pz.caja, M(fachada - s * 0.02, Y0 + alto - 0.05, (z0 + z1) / 2, 0, 0.06, 0.1, z1 - z0), luz(i % 2 ? COLOR.tibio : "#cfe9ff", 2))
      k.base.agregar(pz.caja, M(fachada - s * 0.9, Y0 + 4.5, (z0 + z1) / 2, 0, 1.8, 0.18, z1 - z0 - 2), acabado("#15181c", 0.4, 0.6))
      k.luz.agregar(pz.caja, M(fachada - s * 0.9, Y0 + 4.39, (z0 + z1) / 2, 0, 1.6, 0.03, z1 - z0 - 2.4), luz("#ffd9a8", 1.6))
      // Letrero de la tienda sobre la marquesina.
      const id = `tienda-${tienda++ % 10}`
      letrero(k, pz, id, fachada - s * 0.06, Y0 + 5.6, (z0 + z1) / 2, s < 0 ? Math.PI / 2 : -Math.PI / 2, 1.05)
      k.reflejos.push({ x: fachada - s * 1.5, z: (z0 + z1) / 2, h: 2.2, color: "#ffc98a", fuerza: 0.3, ancho: 7 })
      k.reflejos.push({ x: fachada - s * 0.5, z: (z0 + z1) / 2, h: 5.6, color: ["#ffad62", "#7fe6ff", "#ffffff", "#ffc35a", "#ff8fc8"][(tienda - 1) % 5], fuerza: 0.35, ancho: 2.5 })
    }
  })
  // Pórtico de entrada de la avenida (letrero colgante bajo la pantalla).
  k.base.agregar(pz.caja, M(0, PANTALLA.base - 1.25, PANTALLA.z, 0, 10, 1.1, 0.4), acabado("#14181d", 0.35, 0.7))
  letrero(k, pz, "avenida", 0, PANTALLA.base - 1.25, PANTALLA.z + 0.22, 0, 0.8)
  letrero(k, pz, "avenida", 0, PANTALLA.base - 1.25, PANTALLA.z - 0.22, Math.PI, 0.8)
}

/** "#rrggbb" → color lineal [r, g, b] para atributos. */
function hexA(hex: string): number[] {
  _col.set(hex)
  return [_col.r, _col.g, _col.b]
}

// ── 6.6 El Distrito de las Torres ──

function construirTorres(k: Kit, pz: Piezas, rnd: () => number) {
  const R = R_TORRES
  const libres = [
    { x: NODO["c-torres-n"]?.p.x ?? -60, z: NODO["c-torres-n"]?.p.z ?? 70, r: 13 },
    { x: NODO["c-torres-s"]?.p.x ?? -60, z: NODO["c-torres-s"]?.p.z ?? 170, r: 13 },
    { x: cx(R), z: cz(R), r: 15 },
  ]
  const xCamino = libres[0].x
  const torres: Array<{ x: number; z: number; ancho: number; alto: number; tipo: number; acento: string | null; giro: number }> = []
  const lejosDelRiel = (x: number, z: number, d: number) => k.riel.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d)
  for (let intento = 0; intento < 5000 && torres.length < 17; intento++) {
    const x = R.x0 + 7 + rnd() * (R.x1 - R.x0 - 14)
    const z = R.z0 + 7 + rnd() * (R.z1 - R.z0 - 14)
    const ancho = 7 + rnd() * 4
    if (libres.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + ancho / 2)) continue
    if (Math.abs(x - xCamino) < 6 + ancho / 2 && z > libres[0].z - 4 && z < libres[1].z + 4) continue
    if (torres.some((t) => Math.hypot(x - t.x, z - t.z) < (t.ancho + ancho) / 2 + 8)) continue
    if (!lejosDelRiel(x, z, 7 + ancho / 2)) continue
    if (normaCaverna(x, z) > 0.86) continue
    const techo = techoCiudad(x, z) - Y0
    const alto = rnd() < 0.72 ? techo - 1.2 - rnd() * 2.6 : techo * (0.5 + rnd() * 0.28)
    const acento = rnd() < 0.42 ? [COLOR.cian, COLOR.magenta, COLOR.dorado][Math.floor(rnd() * 3)] : null
    torres.push({ x, z, ancho, alto, tipo: Math.floor(rnd() * 4), acento, giro: rnd() * Math.PI })
  }
  torres.forEach((t, i) => {
    const sem = [100 + i * 7]
    const tonos = ["#262b33", "#1d232a", "#36322d", "#2a313b", "#7d7b77"]
    const tono = hexA(tonos[i % 5])
    const a = t.ancho / 2
    // Podio de dos pisos con el vestíbulo iluminado.
    const podio = poligono.achaflanado(a + 1.6, a + 1.6, 1.4).map(([x, z]) => [t.x + x, t.z + z] as V2)
    k.torres.agregar(prisma(podio, Y0, Y0 + 4.2), null, { color: hexA("#1d2126"), aSem: sem })
    k.luz.agregar(muroContorno(podio, Y0 + 4.2, Y0 + 4.32, false), null, luz("#ffd9a8", 1.6))
    // Cuerpo: según el tipo, prisma achaflanado, cilindro, hexágono o escalonada.
    const cuerpo = (ancho: number, y0: number, y1: number): V2[] => {
      const h = ancho / 2
      const pol =
        t.tipo === 1
          ? poligono.circulo(h, 22, t.giro)
          : t.tipo === 2
            ? poligono.circulo(h * 1.08, 6, t.giro)
            : poligono.achaflanado(h, h * (t.tipo === 3 ? 0.8 : 1), h * 0.22)
      const g = t.tipo === 3 || t.tipo === 0 ? t.giro : 0
      const c = Math.cos(g)
      const s = Math.sin(g)
      const mundo = pol.map(([x, z]) => [t.x + x * c - z * s, t.z + x * s + z * c] as V2)
      k.torres.agregar(prisma(mundo, y0, y1, { vBase: Y0 }), null, { color: tono, aSem: sem })
      return mundo
    }
    const yTop = Y0 + t.alto
    let ultimo: V2[]
    if (t.tipo === 3 || t.alto > 24) {
      const y1 = Y0 + t.alto * 0.55
      const y2 = Y0 + t.alto * 0.82
      cuerpo(t.ancho, Y0 + 4.2, y1)
      const m = cuerpo(t.ancho * 0.84, y1, y2)
      k.luz.agregar(muroContorno(m, y1 + 0.02, y1 + 0.14, false), null, luz(t.acento ?? "#ffd9a8", 1.4))
      ultimo = cuerpo(t.ancho * 0.66, y2, yTop)
      k.luz.agregar(muroContorno(ultimo, y2 + 0.02, y2 + 0.14, false), null, luz(t.acento ?? "#ffd9a8", 1.4))
    } else {
      ultimo = cuerpo(t.ancho, Y0 + 4.2, yTop)
    }
    // Losas salientes cada piso en las torres de planta cuadrada: dan ritmo y escala.
    if (t.tipo === 0) {
      const sale = ultimo.map(([x, z]) => [t.x + (x - t.x) * 1.06, t.z + (z - t.z) * 1.06] as V2)
      for (let y = Y0 + 7.4; y < yTop - 1.5; y += 3.2) k.base.agregar(prisma(sale, y, y + 0.18, { piso: true }), null, acabado("#b9b6b0", 0.5, 0.2))
    }
    // Corona de luz y aguja con su luz en la punta.
    k.luz.agregar(muroContorno(ultimo, yTop - 0.5, yTop - 0.15, false), null, luz(t.acento ?? "#e9f3ff", t.acento ? 2.6 : 1.6))
    const techo = techoCiudad(t.x, t.z)
    if (techo - yTop > 2.4) {
      k.acero.agregar(pz.cil8, M(t.x, (yTop + techo - 1.2) / 2, t.z, 0, 0.12, techo - 1.2 - yTop, 0.12))
      k.luz.agregar(pz.esfera, M(t.x, techo - 1.15, t.z, 0, 0.18, 0.18, 0.18), luz(i % 3 === 0 ? "#ff5a4f" : "#ffffff", 6, i % 3 === 0 ? 2.4 : 0))
    }
    // Acentos de neón verticales en dos aristas (con moderación).
    if (t.acento) {
      for (const q of [0, Math.floor(ultimo.length / 2)]) {
        const [px, pzz] = ultimo[q]
        const dx = px - t.x
        const dz = pzz - t.z
        const l = Math.hypot(dx, dz) || 1
        k.luz.agregar(pz.caja, M(px + (dx / l) * 0.06, (Y0 + 4.4 + yTop) / 2, pzz + (dz / l) * 0.06, 0, 0.16, yTop - Y0 - 4.6, 0.16), luz(t.acento, 2.2, 0.7 + (i % 3) * 0.3))
      }
      k.reflejos.push({ x: t.x, z: t.z, h: 10, color: t.acento, fuerza: 0.12, ancho: 2 })
    }
    letrero(k, pz, `torre-${i}`, t.x, Y0 + 3.3, t.z - a - 1.62, Math.PI, 0.5)
    k.reflejos.push({ x: t.x, z: t.z - a - 2, h: 2.2, color: "#ffd2a0", fuerza: 0.3, ancho: t.ancho })
  })
  // Pasarelas de vidrio entre torres vecinas.
  let pasarelas = 0
  for (let i = 0; i < torres.length && pasarelas < 8; i++)
    for (let j = i + 1; j < torres.length && pasarelas < 8; j++) {
      const A = torres[i]
      const B = torres[j]
      const d = Math.hypot(B.x - A.x, B.z - A.z)
      if (d > 30) continue
      const y = Y0 + Math.min(A.alto, B.alto) * (0.35 + 0.3 * ((i + j) % 3) * 0.5)
      if (y < Y0 + 7) continue
      const giro = Math.atan2(-(B.z - A.z), B.x - A.x)
      const mx = (A.x + B.x) / 2
      const mz = (A.z + B.z) / 2
      const l = d - (A.ancho + B.ancho) * 0.35
      k.base.agregar(pz.caja, M(mx, y, mz, giro, l, 0.35, 3.2), acabado("#d8dbe0", 0.4, 0.5))
      k.base.agregar(pz.caja, M(mx, y + 3, mz, giro, l, 0.25, 3.2), acabado("#d8dbe0", 0.4, 0.5))
      for (const s of [-1, 1]) {
        const ox = Math.sin(giro) * 1.55 * s
        const oz = Math.cos(giro) * 1.55 * s
        k.vidrio.agregar(pz.caja, M(mx + ox, y + 1.5, mz + oz, giro, l, 2.7, 0.04))
        k.luz.agregar(pz.caja, M(mx + ox, y - 0.2, mz + oz, giro, l, 0.06, 0.08), luz(COLOR.cian, 2))
      }
      k.luz.agregar(pz.caja, M(mx, y + 2.84, mz, giro, l - 1, 0.04, 0.5), luz("#fff0d8", 2.2))
      pasarelas++
    }
  // Plazuela central del distrito: un círculo de piedra con un árbol grande y bancos.
  const pc = libres[2]
  k.granito.agregar(losa(poligono.elipse(pc.x, pc.z, 11, 11, 48), Y0 + 0.012))
  k.luz.agregar(muroContorno(poligono.elipse(pc.x, pc.z, 11, 11, 48), Y0 + 0.012, Y0 + 0.04, false), null, luz("#7fe6ff", 1.4))
  maceta(k, pz, pc.x, pc.z, 3.6, "#3f7f3c", 4.2)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    banco(k, pz, pc.x + Math.cos(a) * 6.5, pc.z + Math.sin(a) * 6.5, Math.PI / 2 - a + Math.PI)
    farol(k, pz, pc.x + Math.cos(a + 0.5) * 10, pc.z + Math.sin(a + 0.5) * 10, 4.5, "#ffd7a0", 4)
  }
  // Camino entre los dos accesos, con faroles.
  for (let z = libres[0].z + 12; z < libres[1].z - 10; z += 14) {
    farol(k, pz, xCamino - 4.5, z, 4.8, "#ffd7a0")
    farol(k, pz, xCamino + 4.5, z + 7, 4.8, "#ffd7a0")
  }
  letrero(k, pz, "torres", xCamino, Y0 + 3, libres[0].z - 9, Math.PI, 0.75)
  k.base.agregar(pz.caja, M(xCamino, Y0 + 1.6, libres[0].z - 9.2, 0, 10.5, 3.2, 0.3), acabado("#14181d", 0.3, 0.7))
}

// ── 6.7 El Mercado ──

function construirMercado(k: Kit, pz: Piezas, rnd: () => number) {
  const R = R_MERCADO
  const toldos = ["#b8452f", "#1f7a74", "#d8a032", "#e9dcc4", "#7d2b3a", "#2f5f8f"]
  let comida = 0
  const puesto = (x: number, z: number, giro: number, i: number) => {
    const t = (dx: number, dy: number, dz: number) => {
      const c = Math.cos(giro)
      const s = Math.sin(giro)
      return [x + dx * c + dz * s, Y0 + dy, z - dx * s + dz * c] as const
    }
    const m = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, rx = 0) => {
      const [px, py, pzz] = t(dx, dy, dz)
      return M(px, py, pzz, giro, sx, sy, sz, rx)
    }
    k.madera.agregar(pz.caja, m(0, 0.5, 0.6, 4.4, 1.0, 0.9))
    k.base.agregar(pz.caja, m(0, 1.02, 0.6, 4.5, 0.06, 1.0), acabado("#e8e2d6", 0.4, 0))
    k.base.agregar(pz.caja, m(0, 1.3, -1.2, 4.4, 2.6, 0.12), acabado("#3a2c22", 0.7, 0))
    for (const sx of [-2.15, 2.15]) for (const sz of [-1.2, 1.1]) k.hierro.agregar(pz.caja, m(sx, 1.4, sz, 0.08, 2.8, 0.08))
    k.base.agregar(pz.caja, m(0, 2.95, 0.15, 4.9, 0.08, 3.2, 0.2), acabado(toldos[i % toldos.length], 0.85, 0))
    k.luz.agregar(pz.caja, m(0, 2.68, 0.1, 3.6, 0.04, 0.25), luz("#ffd39a", 3.2))
    const [lx, , lz] = t(0, 0, 1.3)
    k.reflejos.push({ x: lx, z: lz, h: 2.6, color: "#ffc27a", fuerza: 0.35, ancho: 3.2 })
    const [sx2, sy2, sz2] = t(0, 3.45, 1.72)
    letrero(k, pz, `comida-${comida++ % 12}`, sx2, sy2, sz2, giro, 0.55)
    if (rnd() < 0.5) {
      const [vx, , vz] = t(rnd() * 2 - 1, 0, -0.2)
      k.vapores.push({ x: vx, y: Y0 + 1.2, z: vz, r: 0.4, n: 6, tam: 1.4, alto: 2.4, vel: 0.12, color: "#f5ece0", fuerza: 0.2 })
    }
  }
  let i = 0
  for (let x = R.x0 + 6; x <= R.x1 - 4; x += 6.2) {
    puesto(x, R.z0 + 1.5, 0, i++)
    puesto(x, R.z1 - 1.5, Math.PI, i++)
  }
  for (let z = R.z0 + 13; z <= R.z1 - 12; z += 6.2) puesto(R.x1 - 1.5, z, -Math.PI / 2, i++)
  // Mesas largas en el medio.
  for (let j = 0; j < 4; j++) {
    const z = R.z0 + 15 + j * 7
    k.madera.agregar(pz.caja, M(cx(R) - 4, Y0 + 0.75, z, 0, 14, 0.08, 1.2))
    for (const s of [-1, 1]) k.madera.agregar(pz.caja, M(cx(R) - 4, Y0 + 0.45, z + s * 1.05, 0, 14, 0.06, 0.4))
    for (const s of [-6, 6]) k.hierro.agregar(pz.caja, M(cx(R) - 4 + s, Y0 + 0.37, z, 0, 0.1, 0.74, 1.0))
  }
  // Guirnaldas: cables con focos entre postes, de norte a sur.
  for (let x = R.x0 + 8; x <= R.x1 - 6; x += 9) {
    for (const z of [R.z0 + 4.5, R.z1 - 4.5]) k.hierro.agregar(pz.cil8, M(x, Y0 + 3, z, 0, 0.07, 6, 0.07))
    const n = 22
    const z0 = R.z0 + 4.5
    const z1 = R.z1 - 4.5
    for (let q = 0; q <= n; q++) {
      const t = q / n
      const z = z0 + (z1 - z0) * t
      const y = Y0 + 5.9 - Math.sin(t * Math.PI) * 1.3
      k.luz.agregar(pz.esfera, M(x, y - 0.12, z, 0, 0.09, 0.11, 0.09), luz(q % 5 === 0 ? "#ffe8b8" : "#ffc77a", 6))
      if (q < n) {
        const z2 = z0 + (z1 - z0) * ((q + 1) / n)
        const y2 = Y0 + 5.9 - Math.sin(((q + 1) / n) * Math.PI) * 1.3
        const l = Math.hypot(z2 - z, y2 - y)
        k.hierro.agregar(pz.caja, M(x, (y + y2) / 2, (z + z2) / 2, 0, 0.02, 0.02, l, Math.atan2(-(y2 - y), z2 - z)))
      }
      if (q % 4 === 2) k.reflejos.push({ x, z, h: y - Y0, color: "#ffc77a", fuerza: 0.12, ancho: 0.7 })
    }
  }
  // Arco de entrada desde la plaza.
  const xa = R.x0 + 1
  const za = cz(R)
  for (const s of [-1, 1]) k.base.agregar(pz.caja, M(xa, Y0 + 2.6, za + s * 6, 0, 0.5, 5.2, 0.5), acabado("#2a2018", 0.6, 0.2))
  k.base.agregar(pz.caja, M(xa, Y0 + 5.5, za, 0, 0.6, 1.4, 13), acabado("#2a2018", 0.6, 0.2))
  letrero(k, pz, "mercado", xa - 0.34, Y0 + 5.5, za, -Math.PI / 2, 1.1)
  letrero(k, pz, "mercado", xa + 0.34, Y0 + 5.5, za, Math.PI / 2, 1.1)
}

// ── 6.8 El Parque bajo la bóveda y el lago ──

function construirParque(k: Kit, pz: Piezas, rnd: () => number) {
  const R = R_PARQUE
  const cesped = poligono.rectRedondeado(R.x0 + 3, R.x1 - 1, R.z0 + 3, R.z1 - 3, 14, 8)
  k.pasto.agregar(losa(cesped, Y0 + 0.14))
  k.granito.agregar(muroContorno(cesped, Y0, Y0 + 0.14, false))
  // Caminos de grava: un anillo y dos diagonales.
  const pcx = cx(R)
  const pcz = cz(R)
  k.grava.agregar(losa(poligono.elipse(pcx, pcz, 40, 44, 72), Y0 + 0.16, [poligono.elipse(pcx, pcz, 37, 41, 72)]))
  const camino = (x0: number, z0: number, x1: number, z1: number) => {
    const l = Math.hypot(x1 - x0, z1 - z0)
    k.grava.agregar(pz.caja, M((x0 + x1) / 2, Y0 + 0.155, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0), l, 0.02, 3))
  }
  const acc = NODO["c-parque"]?.p ?? { x: 45, z: 130 }
  camino(acc.x - 6, acc.z, pcx, pcz)
  camino(pcx, pcz, R.x1 - 4, R.z1 - 10)
  camino(pcx - 30, R.z1 - 6, pcx, pcz)
  // Kiosco en el centro (el punto de reunión): piso de piedra, columnas y techo con luz.
  k.granito.agregar(pz.cil24, M(pcx, Y0 + 0.2, pcz, 0, 6.5, 0.12, 6.5))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.base.agregar(pz.cil8, M(pcx + Math.cos(a) * 6, Y0 + 2.2, pcz + Math.sin(a) * 6, 0, 0.14, 4, 0.14), acabado("#ece8de", 0.5, 0))
  }
  const techo = new THREE.ConeGeometry(7.6, 2.2, 8, 1)
  k.base.agregar(techo, M(pcx, Y0 + 5.3, pcz, Math.PI / 8), acabado("#2e4a42", 0.5, 0.3))
  techo.dispose()
  aro(k, pcx, Y0 + 4.15, pcz, 6.1, 0.06, "#ffd9a0", 2.6)
  k.reflejos.push({ x: pcx, z: pcz, h: 4.2, color: "#ffd9a0", fuerza: 0.3, ancho: 6 })
  // Árboles: verdes de varios tonos y algunos tajibos amarillos y rosados.
  const verdes = ["#3f7a3a", "#4f8d3c", "#2f6a3a", "#5d9445", "#3b6e44"]
  let puestos = 0
  for (let intento = 0; intento < 900 && puestos < 46; intento++) {
    const x = R.x0 + 6 + rnd() * (R.x1 - R.x0 - 10)
    const z = R.z0 + 6 + rnd() * (R.z1 - R.z0 - 12)
    const rr = Math.hypot((x - pcx) / 38.5, (z - pcz) / 42.5)
    if (Math.abs(rr - 1) < 0.1) continue
    if (Math.hypot(x - pcx, z - pcz) < 12) continue
    if (Math.hypot(x - acc.x, z - acc.z) < 9) continue
    if (k.arboles.some((a) => Math.hypot(a.x - x, a.z - z) < 6.5)) continue
    const tajibo = rnd() < 0.16
    k.arboles.push({ x, z, y: Y0 + 0.14, alto: 2.6 + rnd() * 2.2, copa: 1.8 + rnd() * 1.3, color: tajibo ? (rnd() < 0.5 ? "#f3d24c" : "#f08cbc") : verdes[Math.floor(rnd() * verdes.length)] })
    puestos++
  }
  // Arbustos bajos en los bordes del césped.
  for (let i = 0; i < 40; i++) {
    const t = i / 40
    const [x, z] = cesped[Math.floor(t * cesped.length)]
    const dx = pcx - x
    const dz = pcz - z
    const l = Math.hypot(dx, dz) || 1
    k.arboles.push({ x: x + (dx / l) * 2, z: z + (dz / l) * 2, y: Y0 + 0.14, alto: 0.1, copa: 1.1 + rnd() * 0.5, color: "#284f2a" })
  }
  // Faroles de globo a lo largo del anillo y bancos.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    farol(k, pz, pcx + Math.cos(a) * 42, pcz + Math.sin(a) * 46, 4.2, "#fff0c8", 4, Y0 + 0.17)
    if (i % 2 === 0) banco(k, pz, pcx + Math.cos(a + 0.2) * 35.5, pcz + Math.sin(a + 0.2) * 39.5, Math.PI / 2 - (a + 0.2) + Math.PI)
  }
  // Luciérnagas sobre el pasto (puntos de luz que flotan: ver drones).
  // El lago: borde de piedra, agua, muelle y farolillos flotantes.
  const borde = poligono.elipse(LAGO.x, LAGO.z, LAGO.rx, LAGO.rz, 56)
  k.granito.agregar(muroContorno(borde, Y0 - 1.6, Y0 + 0.25, true))
  k.granito.agregar(losa(poligono.elipse(LAGO.x, LAGO.z, LAGO.rx + 1.4, LAGO.rz + 1.4, 56), Y0 + 0.25, [borde]))
  k.agua.agregar(losa(borde, LAGO.agua))
  k.base.agregar(losa(borde, Y0 - 1.55), null, acabado("#0b1310", 0.4, 0))
  const xm = LAGO.x - LAGO.rx - 1
  k.madera.agregar(pz.caja, M(xm + 6, Y0 + 0.3, LAGO.z - 8, 0, 14, 0.15, 3))
  for (let q = 0; q < 4; q++) for (const s of [-1, 1]) k.madera.agregar(pz.cil8, M(xm + 1 + q * 4, Y0 - 0.5, LAGO.z - 8 + s * 1.3, 0, 0.12, 1.8, 0.12))
  farol(k, pz, xm + 12.5, LAGO.z - 9.3, 3.2, "#ffe0a8", 4)
  for (let q = 0; q < 22; q++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * 0.82
    const x = LAGO.x + Math.cos(a) * LAGO.rx * r
    const z = LAGO.z + Math.sin(a) * LAGO.rz * r
    k.luz.agregar(pz.esfera, M(x, LAGO.agua + 0.1, z, 0, 0.22, 0.14, 0.22), luz("#ffb860", 5))
    k.reflejos.push({ x, z, h: 0.6, color: "#ffb860", fuerza: 0.25, ancho: 0.6 })
  }
  k.vapores.push({ x: LAGO.x, y: LAGO.agua, z: LAGO.z, r: 26, n: 26, tam: 8, alto: 2, vel: 0.02, color: "#cfdde8", fuerza: 0.1 })
  letrero(k, pz, "parque", acc.x + 5.5, Y0 + 2.4, acc.z - 4, -Math.PI / 2, 0.7)
  k.base.agregar(pz.caja, M(acc.x + 5.75, Y0 + 1.2, acc.z - 4, 0, 0.3, 2.4, 6), acabado("#20302a", 0.4, 0.4))
}

// ── 6.9 El monorriel y la Estación ──

function curvaMonorriel(): THREE.CatmullRomCurve3 {
  const e = cz(R_ESTACION) + 4.5
  const P: Array<[number, number]> = [
    [-30, e],
    [0, e],
    [30, e],
    [75, e + 9],
    [140, 240],
    [178, 190],
    [182, 110],
    [178, 40],
    [160, -55],
    [90, -86],
    [0, -80],
    [-90, -86],
    [-160, -55],
    [-181, 30],
    [-172, 100],
    [-128, 148],
    [-98, 204],
    [-60, e + 2],
  ]
  return new THREE.CatmullRomCurve3(
    P.map(([x, z]) => new THREE.Vector3(x, RIEL_Y, z)),
    true,
    "centripetal",
  )
}

interface Tren {
  malla: THREE.InstancedMesh
  curva: THREE.CatmullRomCurve3
  largo: number
  /** Arco (m) donde el tren se detiene, centrado en la estación. */
  sEstacion: number
}

function construirMonorriel(k: Kit, pz: Piezas, mats: MaterialesCiudad, ctx: CtxEscena, curva: THREE.CatmullRomCurve3): Tren {
  const N = 720
  const pts = curva.getSpacedPoints(N).slice(0, N)
  const largo = curva.getLength()
  const tan = pts.map((_, i) => pts[(i + 1) % N].clone().sub(pts[(i - 1 + N) % N]).setY(0).normalize())
  const lado = tan.map((t) => new THREE.Vector3(-t.z, 0, t.x))
  const w = 0.55
  const top = RIEL_Y
  const bot = RIEL_Y - 1.4
  const caraViga = (a: (i: number, out: THREE.Vector3) => void, b: (i: number, out: THREE.Vector3) => void, n: (i: number, out: THREE.Vector3) => void) =>
    cinta(pts, (i, l, out) => (l < 0 ? a(i, out) : b(i, out)), n, true)
  const P = (i: number, s: number, y: number, out: THREE.Vector3) => out.copy(pts[i]).addScaledVector(lado[i], s).setY(y)
  const vigaAc = acabado("#55585d", 0.4, 0.45)
  k.base.agregar(caraViga((i, o) => P(i, -w, top, o), (i, o) => P(i, w, top, o), (_i, o) => o.set(0, 1, 0)), null, vigaAc)
  k.base.agregar(caraViga((i, o) => P(i, w, bot, o), (i, o) => P(i, -w, bot, o), (_i, o) => o.set(0, -1, 0)), null, vigaAc)
  k.base.agregar(caraViga((i, o) => P(i, w, top, o), (i, o) => P(i, w, bot, o), (i, o) => o.copy(lado[i])), null, vigaAc)
  k.base.agregar(caraViga((i, o) => P(i, -w, bot, o), (i, o) => P(i, -w, top, o), (i, o) => o.copy(lado[i]).negate()), null, vigaAc)
  // La línea de luz bajo la viga: el trazo cian que cruza la ciudad.
  k.luz.agregar(caraViga((i, o) => P(i, 0.16, bot - 0.01, o), (i, o) => P(i, -0.16, bot - 0.01, o), (_i, o) => o.set(0, -1, 0)), null, luz("#5fe3ff", 2.4))
  // Columnas cada ~26 m (más largas dentro del canal y del lago).
  const paso = Math.round((26 / largo) * N)
  for (let i = 0; i < N; i += paso) {
    const p = pts[i]
    if (p.x > R_ESTACION.x0 - 4 && p.x < R_ESTACION.x1 + 4 && Math.abs(p.z - cz(R_ESTACION)) < 20) continue
    const enCanal = p.x > CANAL.x0 && p.x < CANAL.x1 && p.z > CANAL.z0 && p.z < CANAL.z1
    const enLago = ((p.x - LAGO.x) / LAGO.rx) ** 2 + ((p.z - LAGO.z) / LAGO.rz) ** 2 < 1
    const pie = enCanal ? CANAL.fondo : enLago ? Y0 - 1.6 : Y0
    const alto = bot - pie - 0.5
    const giro = Math.atan2(-tan[i].z, tan[i].x)
    k.base.agregar(pz.cil16, M(p.x, pie + alto / 2, p.z, 0, 0.6, alto, 0.6), acabado("#6b6d70", 0.55, 0.2))
    k.base.agregar(pz.caja, M(p.x, bot - 0.3, p.z, giro, 1.4, 0.6, 2.2), acabado("#6b6d70", 0.55, 0.2))
    if (!enCanal && !enLago) {
      k.base.agregar(pz.cil16, M(p.x, Y0 + 0.2, p.z, 0, 1.0, 0.4, 1.0), acabado("#8f8c86", 0.7, 0))
      aro(k, p.x, Y0 + 0.41, p.z, 0.82, 0.035, "#5fe3ff", 1.8)
    }
  }
  for (let i = 0; i < N; i += Math.round(paso / 2)) k.reflejos.push({ x: pts[i].x, z: pts[i].z, h: bot - Y0, color: "#5fe3ff", fuerza: 0.1, ancho: 0.8 })

  // ── La Estación: hall de vidrio abajo, andén y techo curvo arriba ──
  const E = R_ESTACION
  const ze = cz(E) + 4.5
  const yAnden = RIEL_Y - 0.35
  const hall: V2[] = [
    [E.x0 - 2, E.z0 + 6],
    [E.x1 + 2, E.z0 + 6],
    [E.x1 + 2, E.z1 + 2],
    [E.x0 - 2, E.z1 + 2],
  ]
  k.vidrio.agregar(muroContorno(hall, Y0, yAnden - 0.6, false))
  k.base.agregar(pz.caja, M(0, yAnden - 0.75, (E.z0 + 6 + E.z1 + 2) / 2, 0, E.x1 - E.x0 + 4, 0.3, E.z1 + 2 - (E.z0 + 6)), acabado("#1c2026", 0.4, 0.5))
  for (let x = E.x0; x <= E.x1; x += 6) {
    k.base.agregar(pz.caja, M(x, (Y0 + yAnden) / 2, E.z0 + 6.2, 0, 0.5, yAnden - Y0, 0.5), acabado("#d4d6da", 0.4, 0.4))
    k.luz.agregar(pz.caja, M(x + 3, yAnden - 0.66, (E.z0 + E.z1) / 2 + 4, 0, 0.3, 0.04, E.z1 - E.z0 - 6), luz("#fff3df", 2.8))
  }
  k.reflejos.push({ x: 0, z: E.z0 + 6, h: 4, color: "#ffe9c8", fuerza: 0.45, ancho: 30 })
  k.base.agregar(losa(hall, Y0 + 0.02), null, acabado("#c9c4bb", 0.25, 0))
  // Andenes a los dos lados de la viga.
  for (const s of [-1, 1]) {
    k.base.agregar(pz.caja, M(0, yAnden - 0.3, ze + s * 3.6, 0, E.x1 - E.x0 + 4, 0.6, 4.4), acabado("#d9d6cf", 0.45, 0.1))
    k.luz.agregar(pz.caja, M(0, yAnden + 0.01, ze + s * 1.5, 0, E.x1 - E.x0 + 4, 0.02, 0.14), luz("#ffd36a", 2.4))
    k.vidrio.agregar(pz.caja, M(0, yAnden + 0.6, ze + s * 5.75, 0, E.x1 - E.x0 + 4, 1.2, 0.04))
  }
  // Techo curvo: costillas de acero y vidrio.
  const arco = (y0: number, r: number) => {
    const g = new THREE.CylinderGeometry(r, r, E.x1 - E.x0 + 8, 24, 1, true, Math.PI / 2 - 1.1, 2.2)
    g.rotateZ(Math.PI / 2)
    g.translate(0, y0, ze)
    return g
  }
  const vid = arco(yAnden + 1.2, 7.5)
  k.vidrio.agregar(vid)
  vid.dispose()
  for (let x = E.x0 - 3; x <= E.x1 + 3; x += 5) {
    const t = new THREE.TorusGeometry(7.55, 0.12, 6, 24, 2.2)
    t.rotateZ(Math.PI / 2 - 1.1)
    t.rotateY(Math.PI / 2)
    k.acero.agregar(t, M(x, yAnden + 1.2, ze))
    t.dispose()
  }
  // Escaleras (bloques) del hall al andén.
  for (let q = 0; q < 12; q++) k.base.agregar(pz.caja, M(-14, Y0 + (q + 0.5) * ((yAnden - Y0) / 12), E.z0 + 8 + q * 0.6, 0, 3, (yAnden - Y0) / 12, 0.6), acabado("#cfcac2", 0.5, 0))
  letrero(k, pz, "estacion", 0, yAnden - 2.6, E.z0 + 5.7, Math.PI, 1.6)
  letrero(k, pz, "circuito", 0, yAnden + 3.4, ze - 7.5, Math.PI, 0.7)
  k.base.agregar(pz.caja, M(0, yAnden - 2.6, E.z0 + 5.85, 0, 16, 2.4, 0.2), acabado("#121519", 0.35, 0.7))

  // ── El tren: tres coches, una malla instanciada (las ventanas y la franja brillan solas) ──
  const coche = new Lote([
    ["color", 3],
    ["aRM", 2],
    ["aEmis", 3],
  ])
  const cuerpo = new THREE.CapsuleGeometry(1.42, 8.4, 6, 16)
  cuerpo.rotateZ(Math.PI / 2)
  coche.agregar(cuerpo, M(0, 1.25, 0, 0, 1, 1.12, 1.05), acabado("#eef0f2", 0.22, 0.35))
  cuerpo.dispose()
  coche.agregar(pz.caja, M(0, 1.72, 0, 0, 8.6, 0.78, 3.02), acabado("#0b0f14", 0.06, 0.6, "#ffcf98", 1.7))
  coche.agregar(pz.caja, M(0, 0.32, 0, 0, 9.2, 0.12, 3.0), acabado("#0b0f14", 0.2, 0.5, "#5fe3ff", 2.6))
  coche.agregar(pz.esfera, M(5.62, 1.4, 0, 0, 0.12, 0.22, 0.7), acabado("#ffffff", 0.2, 0, "#ffffff", 6))
  coche.agregar(pz.esfera, M(-5.62, 1.4, 0, 0, 0.12, 0.18, 0.6), acabado("#ff3030", 0.2, 0, "#ff3a30", 4))
  coche.agregar(pz.caja, M(0, -0.25, 0, 0, 8, 0.9, 1.5), acabado("#2a2e33", 0.5, 0.6))
  const geo = coche.malla(mats.base, "tmp")
  const malla = new THREE.InstancedMesh(geo ? geo.geometry : new THREE.BufferGeometry(), mats.base, 3)
  malla.name = "ciudad-tren"
  malla.castShadow = ctx.sombras
  malla.frustumCulled = false
  // El arco más cercano a la estación.
  let sEst = 0
  let mejor = Infinity
  for (let i = 0; i < N; i++) {
    const d = (pts[i].x - 0) ** 2 + (pts[i].z - ze) ** 2
    if (d < mejor) {
      mejor = d
      sEst = (i / N) * largo
    }
  }
  return { malla, curva, largo, sEstacion: sEst }
}

// ── 6.10 La Arena ──

function construirArena(k: Kit, pz: Piezas) {
  const { x: ax, z: az, rx, rz, alto } = ARENA
  // Lado abierto hacia el oeste (la entrada del mapa queda ahí).
  const abre = 0.75
  const enAbierto = (a: number) => Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < abre
  // Muro exterior: anillo elíptico con el hueco de la entrada vidriada.
  const NS = 96
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const vid: number[] = []
  const vnor: number[] = []
  const vuv: number[] = []
  for (let i = 0; i < NS; i++) {
    const a0 = (i / NS) * Math.PI * 2
    const a1 = ((i + 1) / NS) * Math.PI * 2
    const am = (a0 + a1) / 2
    const p0 = new THREE.Vector3(ax + Math.cos(a0) * rx, 0, az + Math.sin(a0) * rz)
    const p1 = new THREE.Vector3(ax + Math.cos(a1) * rx, 0, az + Math.sin(a1) * rz)
    const n = new THREE.Vector3(Math.cos(am) / rx, 0, Math.sin(am) / rz).normalize()
    const quad = (P: number[], Nn: number[], U: number[], y0: number, y1: number) => {
      const A0 = p0.clone().setY(y0)
      const B0 = p1.clone().setY(y0)
      const A1 = p0.clone().setY(y1)
      const B1 = p1.clone().setY(y1)
      tri(P, Nn, U, A0, B0, B1, n, [0, 0], [1, 0], [1, 1])
      tri(P, Nn, U, A0, B1, A1, n, [0, 0], [1, 1], [0, 1])
    }
    if (enAbierto(am)) {
      quad(vid, vnor, vuv, Y0, Y0 + 8)
      quad(pos, nor, uv, Y0 + 8, Y0 + alto)
    } else quad(pos, nor, uv, Y0, Y0 + alto)
  }
  k.base.agregar(geometria(pos, nor, uv), null, acabado("#7f878f", 0.3, 0.7))
  k.vidrio.agregar(geometria(vid, vnor, vuv))
  // Bandas de LED alrededor del muro (blanca fría y una línea dorada fina).
  const banda = (y0: number, y1: number, col: string, f: number, crece = 0.05) =>
    k.luz.agregar(muroContorno(poligono.elipse(ax, az, rx + crece, rz + crece, NS), Y0 + y0, Y0 + y1, false), null, luz(col, f))
  banda(9.4, 10.0, "#d9f4ff", 1.5)
  banda(11.7, 11.82, COLOR.dorado, 2)
  banda(8.0, 8.06, "#7fe6ff", 1.6)
  // Techo: anillo sólido y óvalo central de vidrio con costillas.
  const NR = 64
  const anillo = (rx0: number, rz0: number, y0: number, rx1: number, rz1: number, y1: number) => {
    const P: number[] = []
    const Nn: number[] = []
    const U: number[] = []
    for (let i = 0; i < NR; i++) {
      const a0 = (i / NR) * Math.PI * 2
      const a1 = ((i + 1) / NR) * Math.PI * 2
      const A = new THREE.Vector3(ax + Math.cos(a0) * rx0, y0, az + Math.sin(a0) * rz0)
      const B = new THREE.Vector3(ax + Math.cos(a1) * rx0, y0, az + Math.sin(a1) * rz0)
      const C = new THREE.Vector3(ax + Math.cos(a1) * rx1, y1, az + Math.sin(a1) * rz1)
      const D = new THREE.Vector3(ax + Math.cos(a0) * rx1, y1, az + Math.sin(a0) * rz1)
      const n = new THREE.Vector3(0, 1, 0)
      tri(P, Nn, U, A, B, C, n, [0, 0], [1, 0], [1, 1])
      tri(P, Nn, U, A, C, D, n, [0, 0], [1, 1], [0, 1])
    }
    const g = geometria(P, Nn, U)
    g.computeVertexNormals()
    return g
  }
  k.base.agregar(anillo(rx + 1.5, rz + 1.5, Y0 + alto, rx - 12, rz - 10, Y0 + alto + 3.6), null, acabado("#a7adb4", 0.3, 0.6))
  k.base.agregar(anillo(rx + 1.5, rz + 1.5, Y0 + alto - 0.4, rx + 1.5, rz + 1.5, Y0 + alto), null, acabado("#5d646b", 0.35, 0.7))
  k.vidrio.agregar(anillo(rx - 12, rz - 10, Y0 + alto + 3.6, 0.5, 0.5, Y0 + alto + 5.4))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const x0 = ax + Math.cos(a) * (rx - 12)
    const z0 = az + Math.sin(a) * (rz - 10)
    const l = Math.hypot(x0 - ax, z0 - az)
    k.acero.agregar(pz.caja, M((x0 + ax) / 2, Y0 + alto + 4.6, (z0 + az) / 2, Math.atan2(-(z0 - az), x0 - ax), l, 0.3, 0.3, 0, Math.atan2(1.8, l) * 0.6))
  }
  k.luz.agregar(muroContorno(poligono.elipse(ax, az, rx - 12, rz - 10, 64), Y0 + alto + 3.55, Y0 + alto + 3.75, false), null, luz("#d9f4ff", 2.4))
  // La cancha (28 x 15) con sus líneas, y los aros.
  const cx0 = ax
  k.madera.agregar(pz.caja, M(cx0, Y0 + 0.05, az, 0, 32, 0.1, 19))
  const linea = (x: number, z: number, w: number, d: number) => k.base.agregar(pz.caja, M(x, Y0 + 0.105, z, 0, w, 0.01, d), acabado("#f4f1ea", 0.5, 0))
  linea(cx0, az - 7.5, 28, 0.08)
  linea(cx0, az + 7.5, 28, 0.08)
  linea(cx0 - 14, az, 0.08, 15)
  linea(cx0 + 14, az, 0.08, 15)
  linea(cx0, az, 0.08, 15)
  const circ = muroContorno(poligono.elipse(cx0, az, 1.8, 1.8, 32), Y0 + 0.1, Y0 + 0.11, false)
  k.base.agregar(losa(poligono.elipse(cx0, az, 1.8, 1.8, 32), Y0 + 0.106, [poligono.elipse(cx0, az, 1.72, 1.72, 32)]), null, acabado("#f4f1ea", 0.5, 0))
  circ.dispose()
  for (const s of [-1, 1]) {
    k.base.agregar(losa(poligono.elipse(cx0 + s * 13.2, az, 5.8, 4.9, 32).filter(([x]) => s * (x - (cx0 + s * 13.2)) <= 0.01), Y0 + 0.104), null, acabado("#2e5aa8", 0.5, 0))
    k.base.agregar(pz.caja, M(cx0 + s * 15.2, Y0 + 1.6, az, 0, 0.2, 3.2, 0.2), acabado("#1b1e22", 0.4, 0.7))
    k.base.agregar(pz.caja, M(cx0 + s * 14.7, Y0 + 3.4, az, 0, 0.08, 1.05, 1.8), acabado("#f4f6f8", 0.2, 0, "#ffffff", 0.4))
    k.luz.agregar(muroContorno(poligono.elipse(cx0 + s * 14.2, az, 0.23, 0.23, 16), Y0 + 3.05, Y0 + 3.08, false), null, luz("#ff6a2a", 2))
  }
  // Gradas en forma de U (abiertas al oeste): 10 escalones.
  const N_G = 84
  for (let e = 0; e < 10; e++) {
    const rx0 = 19.5 + e * 1.55
    const rz0 = 12.5 + e * 1.3
    const y = Y0 + 0.55 * (e + 1)
    const P: number[] = []
    const Nn: number[] = []
    const U: number[] = []
    for (let i = 0; i < N_G; i++) {
      const a0 = (i / N_G) * Math.PI * 2
      const a1 = ((i + 1) / N_G) * Math.PI * 2
      if (enAbierto((a0 + a1) / 2) || enAbierto(a0) || enAbierto(a1)) continue
      const q = (a: number, r: number, rr: number, yy: number) => new THREE.Vector3(ax + Math.cos(a) * r, yy, az + Math.sin(a) * rr)
      const up = new THREE.Vector3(0, 1, 0)
      tri(P, Nn, U, q(a0, rx0, rz0, y), q(a1, rx0, rz0, y), q(a1, rx0 + 1.55, rz0 + 1.3, y), up, [0, 0], [1, 0], [1, 1])
      tri(P, Nn, U, q(a0, rx0, rz0, y), q(a1, rx0 + 1.55, rz0 + 1.3, y), q(a0, rx0 + 1.55, rz0 + 1.3, y), up, [0, 0], [1, 1], [0, 1])
      const nn = new THREE.Vector3(-Math.cos((a0 + a1) / 2) / rx0, 0, -Math.sin((a0 + a1) / 2) / rz0).normalize()
      tri(P, Nn, U, q(a0, rx0, rz0, y - 0.55), q(a1, rx0, rz0, y - 0.55), q(a1, rx0, rz0, y), nn, [0, 0], [1, 0], [1, 1])
      tri(P, Nn, U, q(a0, rx0, rz0, y - 0.55), q(a1, rx0, rz0, y), q(a0, rx0, rz0, y), nn, [0, 0], [1, 1], [0, 1])
    }
    const col = e === 4 ? "#c9963a" : e % 2 ? "#1d3550" : "#173048"
    k.base.agregar(geometria(P, Nn, U), null, acabado(col, 0.55, 0.1))
  }
  // Marcador colgante sobre la cancha (las cuatro caras muestran el contador del reto).
  const ym = Y0 + 11
  k.base.agregar(pz.caja, M(cx0, ym, az, 0, 6.6, 3.6, 6.6), acabado("#0f1216", 0.4, 0.7))
  const cara = pz.plano.clone()
  for (let i = 0; i < 4; i++) {
    const g = (i * Math.PI) / 2
    k.pantalla.agregar(cara, M(cx0 + Math.sin(g) * 3.32, ym, az + Math.cos(g) * 3.32, g, 6.2, 2.3, 1))
  }
  cara.dispose()
  k.luz.agregar(pz.caja, M(cx0, ym - 1.85, az, 0, 6.7, 0.08, 6.7), luz("#d9f4ff", 3))
  k.acero.agregar(pz.cil8, M(cx0, (ym + Y0 + alto + 4) / 2, az, 0, 0.1, Y0 + alto + 4 - ym, 0.1))
  // Letreros y luces de la entrada.
  letrero(k, pz, "arena", ax - rx - 0.4, Y0 + 9.7, az, -Math.PI / 2, 2.2)
  for (const s of [-1, 1]) k.reflejos.push({ x: ax - rx + 2, z: az + s * 8, h: 4, color: "#d9f4ff", fuerza: 0.22, ancho: 3.5 })
  k.reflejos.push({ x: ax - rx - 1, z: az, h: 9.7, color: "#ffffff", fuerza: 0.3, ancho: 4 })
  k.haces.push({ x: ax - 12, y: Y0 + alto + 3.8, z: az - 14, az: 0.4, incl: 0.32, barrido: 0.5, vel: 0.35, largo: 16, abre: 1.6, color: "#bfe6ff", fuerza: 0.1 })
  k.haces.push({ x: ax + 12, y: Y0 + alto + 3.8, z: az + 14, az: 3.5, incl: 0.32, barrido: 0.5, vel: 0.3, largo: 16, abre: 1.6, color: "#bfe6ff", fuerza: 0.1 })
}

// ── 6.11 El Club ──

function construirClub(k: Kit, pz: Piezas) {
  const R = R_CLUB
  const xf = R.x0 + 26
  const zc = cz(R)
  const z0 = zc - 21
  const z1 = zc + 21
  const alto = 15
  // El edificio: negro brillante, con la fachada hacia la terraza (al este).
  const pol: V2[] = [
    [R.x0 + 2, z0],
    [xf, z0],
    [xf, z1],
    [R.x0 + 2, z1],
  ]
  k.base.agregar(prisma(pol, Y0, Y0 + alto), null, acabado("#0b0c10", 0.16, 0.75))
  k.base.agregar(pz.caja, M(xf - 0.4, Y0 + alto + 0.3, zc, 0, 1.6, 0.6, z1 - z0 + 1), acabado("#16181d", 0.3, 0.8))
  // Neón de la fachada: un marco magenta y barras de "ecualizador" que laten con la música.
  const xn = xf + 0.06
  const tubo = (y: number, z: number, w: number, h: number, col: string, f: number, pulso = 0) => k.luz.agregar(pz.caja, M(xn, y, z, 0, 0.08, h, w), luz(col, f, pulso))
  tubo(Y0 + alto - 0.35, zc, z1 - z0 - 0.6, 0.12, COLOR.magenta, 3.2)
  tubo(Y0 + 0.35, zc, z1 - z0 - 0.6, 0.1, COLOR.magenta, 2.4)
  for (const s of [-1, 1]) tubo(Y0 + alto / 2, zc + s * ((z1 - z0) / 2 - 0.3), 0.12, alto - 0.7, COLOR.magenta, 3.2)
  const rb = semilla(19)
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const z = zc + s * (5.5 + i * 1.9)
      const h = 2.2 + Math.abs(Math.sin(i * 1.7 + (s > 0 ? 0.6 : 0))) * 6.5 + rb() * 1.2
      tubo(Y0 + 1.2 + h / 2, z, 0.22, h, i % 3 === 0 ? COLOR.violeta : COLOR.cian, 2.4, 2.2 + i * 0.41 + (s > 0 ? 0.3 : 0))
    }
  // El letrero: grande, arriba al centro, y "ABIERTO" bajo él.
  letrero(k, pz, "club", xn + 0.05, Y0 + 11.4, zc, Math.PI / 2, 5.2)
  letrero(k, pz, "abierto", xn + 0.05, Y0 + 7.9, zc, Math.PI / 2, 0.9)
  // Entrada: un portal de luz con puerta de vidrio y marquesina.
  k.luz.agregar(pz.caja, M(xn + 0.02, Y0 + 3.2, zc - 2.6, 0, 0.1, 6.4, 0.16), luz("#ff6fc0", 3))
  k.luz.agregar(pz.caja, M(xn + 0.02, Y0 + 3.2, zc + 2.6, 0, 0.1, 6.4, 0.16), luz("#ff6fc0", 3))
  k.luz.agregar(pz.caja, M(xn + 0.02, Y0 + 6.4, zc, 0, 0.1, 0.16, 5.36), luz("#ff6fc0", 3))
  k.base.agregar(pz.caja, M(xn + 0.04, Y0 + 3.1, zc, 0, 0.1, 6.2, 5), acabado("#120812", 0.1, 0.4, "#ff4fae", 0.35))
  k.base.agregar(pz.caja, M(xf + 2.5, Y0 + 6.9, zc, 0, 5, 0.3, 8), acabado("#0b0c10", 0.2, 0.7))
  k.luz.agregar(pz.caja, M(xf + 2.5, Y0 + 6.74, zc, 0, 4.6, 0.03, 7.6), luz("#ffb3df", 1.8))
  k.reflejos.push({ x: xf + 1, z: zc, h: 11.4, color: COLOR.magenta, fuerza: 0.55, ancho: 10 })
  k.reflejos.push({ x: xf + 1, z: zc, h: 3.2, color: "#ff6fc0", fuerza: 0.45, ancho: 5 })
  for (const s of [-1, 1]) for (const d of [8, 15]) k.reflejos.push({ x: xf + 0.5, z: zc + s * d, h: 5, color: d === 8 ? COLOR.cian : COLOR.violeta, fuerza: 0.2, ancho: 1.6 })
  const tz0 = z0
  const tz1 = z1
  // La terraza: piso LED, cabina del DJ, barra, sillones y una estructura con luces.
  const tx0 = xf + 6
  const tx1 = R.x1 - 4
  k.pisoLed.agregar(losa(poligono.rectRedondeado(tx0 + 3, tx1 - 8, tz0 + 6, tz1 - 8, 2, 3), Y0 + 0.03))
  k.base.agregar(pz.caja, M(xf + 3.2, Y0 + 0.6, zc, 0, 2.4, 1.2, 7), acabado("#101216", 0.25, 0.7))
  k.luz.agregar(pz.caja, M(xf + 4.42, Y0 + 0.6, zc, 0, 0.04, 0.12, 6.6), luz(COLOR.cian, 3))
  k.base.agregar(pz.caja, M((tx0 + tx1) / 2, Y0 + 0.55, tz1 - 1, 0, tx1 - tx0 - 6, 1.1, 1.4), acabado("#14161b", 0.15, 0.8))
  k.luz.agregar(pz.caja, M((tx0 + tx1) / 2, Y0 + 0.2, tz1 - 1.72, 0, tx1 - tx0 - 6.2, 0.06, 0.04), luz(COLOR.dorado, 2.6))
  for (let i = 0; i < 6; i++) {
    const x = tx0 + 3 + i * ((tx1 - tx0 - 6) / 5)
    k.base.agregar(pz.caja, M(x, Y0 + 0.35, tz0 + 1.2, 0, 3.2, 0.7, 1.4), acabado("#4a1638", 0.8, 0))
    k.base.agregar(pz.caja, M(x, Y0 + 0.8, tz0 + 0.65, 0, 3.2, 0.9, 0.3), acabado("#4a1638", 0.8, 0))
  }
  // Estructura de luces sobre la pista.
  const yt = Y0 + 8.5
  const fx0 = tx0 + 2
  const fx1 = tx1 - 6
  const fz0 = tz0 + 4
  const fz1 = tz1 - 6
  for (const [x, z] of [
    [fx0, fz0],
    [fx1, fz0],
    [fx0, fz1],
    [fx1, fz1],
  ] as const)
    k.acero.agregar(pz.caja, M(x, (Y0 + yt) / 2, z, 0, 0.35, yt - Y0, 0.35))
  for (let x = fx0; x <= fx1 + 0.1; x += (fx1 - fx0) / 4) k.acero.agregar(pz.caja, M(x, yt, (fz0 + fz1) / 2, 0, 0.3, 0.3, fz1 - fz0))
  for (const z of [fz0, fz1]) k.acero.agregar(pz.caja, M((fx0 + fx1) / 2, yt, z, 0, fx1 - fx0, 0.3, 0.3))
  const colores = [COLOR.magenta, COLOR.cian, "#ffffff", COLOR.violeta]
  let q = 0
  for (let x = fx0; x <= fx1 + 0.1; x += (fx1 - fx0) / 4)
    for (let z = fz0 + 3; z < fz1; z += 5) {
      k.luz.agregar(pz.esfera, M(x, yt - 0.35, z, 0, 0.22, 0.22, 0.22), luz(colores[q % 4], 7, 3 + (q % 5)))
      q++
    }
  for (let i = 0; i < 4; i++)
    k.haces.push({
      x: fx0 + (fx1 - fx0) * (i % 2 ? 0.75 : 0.25),
      y: yt - 0.2,
      z: fz0 + (fz1 - fz0) * (i < 2 ? 0.3 : 0.7),
      az: i * 1.7,
      incl: 2.7,
      barrido: 0.9,
      vel: 0.6 + i * 0.13,
      largo: 9,
      abre: 2.2,
      color: colores[i],
      fuerza: 0.22,
    })
  for (let i = 0; i < 2; i++)
    k.haces.push({ x: xf + 1, y: Y0 + alto, z: zc + (i ? 14 : -14), az: i ? 2 : -1, incl: 0.25, barrido: 0.7, vel: 0.4 + i * 0.1, largo: 18, abre: 1.5, color: i ? COLOR.cian : COLOR.magenta, fuerza: 0.12 })
  k.vapores.push({ x: (fx0 + fx1) / 2, y: Y0 + 0.2, z: (fz0 + fz1) / 2, r: 10, n: 30, tam: 6, alto: 1.2, vel: 0.03, color: "#c87ad8", fuerza: 0.16 })
  for (const s of [-1, 1]) farol(k, pz, R.x1 - 2, zc + s * 12, 4, "#ffb3df", 3)
}

// ── 6.12 Lo que llena: bloques bajos entre zonas ──

function construirRelleno(k: Kit, rnd: () => number) {
  const bloques: Array<[number, number, number, number, number]> = [
    // x0, x1, z0, z1, alto
    [-52, -34, 224, 240, 6],
    [32, 56, 224, 242, 6],
    [62, 86, 226, 244, 7],
  ]
  bloques.forEach(([x0, x1, z0, z1, alto], i) => {
    const pol: V2[] = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]
    k.torres.agregar(prisma(pol, Y0, Y0 + alto + rnd() * 2), null, { color: hexA(["#2c3138", "#3a352f", "#262b31"][i % 3]), aSem: [300 + i * 5] })
  })
}

// ═══════════════════════════════════════════════════════════════
// 7. El nivel entero
// ═══════════════════════════════════════════════════════════════

/** Vistas listas para grabar la ciudad (cámara y punto al que mira). */
export const VISTAS_CIUDAD: Record<"mirador" | "plaza" | "avenida" | "aerea" | "torres", { pos: [number, number, number]; mira: [number, number, number]; fov: number }> = {
  mirador: { pos: [15, Y0 + 8.5, R_MIRADOR.z1 - 6], mira: [-12, Y0 + 4, 150], fov: 56 },
  plaza: { pos: [-21, Y0 + 1.7, cz(R_PLAZA) - 8], mira: [0, PANTALLA.base + 3, PANTALLA.z], fov: 52 },
  avenida: { pos: [2.4, Y0 + 1.6, R_AVENIDA.z1 - 6], mira: [0, Y0 + 5.5, 40], fov: 50 },
  aerea: { pos: [118, Y0 + 23, 200], mira: [-40, Y0 + 1, 40], fov: 56 },
  torres: { pos: [-112, Y0 + 20, 214], mira: [20, Y0 + 2, 10], fov: 56 },
}

/**
 * La toma "Descenso a la ciudad" (0 ≤ t ≤ 1): baja con el ascensor desde la
 * bóveda, gira para descubrir la plaza y la pantalla, y se abre sobre la
 * avenida. Devuelve el campo de visión.
 */
export function tomaDescensoCiudad(t: number, pos: THREE.Vector3, mira: THREE.Vector3): number {
  const k = t * t * (3 - 2 * t)
  // Espiral por fuera del tubo (del lado de la plaza): no se mira a través de los parantes.
  const a = THREE.MathUtils.lerp(-1.1, 0.35, k)
  const r = THREE.MathUtils.lerp(7, 15, k)
  const y = THREE.MathUtils.lerp(techoCiudad(ASC.x, ASC.z) - 3, Y0 + 5.5, Math.pow(k, 0.85))
  pos.set(ASC.x + Math.sin(a) * r, y, ASC.z + Math.cos(a) * r)
  mira.set(0, THREE.MathUtils.lerp(Y0 + 1, PANTALLA.base + 3, k), THREE.MathUtils.lerp(cz(R_PLAZA) - 8, PANTALLA.z + 30, k))
  return THREE.MathUtils.lerp(60, 50, k)
}

export function construirCiudad(ctx: CtxEscena): void {
  const grupo = ctx.niveles.ciudad
  if (!grupo) {
    console.warn("[casa-blanca] no hay grupo para el nivel ciudad: la ciudad no se construye")
    return
  }
  const calidad = ctx.calidad
  const factor = calidad === "alta" ? 1 : calidad === "media" ? 0.7 : 0.45

  // ── Texturas dibujadas ──
  const lienzoP = document.createElement("canvas")
  lienzoP.width = PANT_W
  lienzoP.height = PANT_H
  const gP = lienzoP.getContext("2d")!
  dibujarPantalla(gP, 0, "17:30", 0)
  const texP = new THREE.CanvasTexture(lienzoP)
  texP.colorSpace = THREE.SRGBColorSpace
  texP.anisotropy = 4
  const lienzoA = document.createElement("canvas")
  lienzoA.width = ATLAS_W
  lienzoA.height = ATLAS_H
  const gA = lienzoA.getContext("2d")!
  const celdas = dibujarAtlas(gA)
  const texA = new THREE.CanvasTexture(lienzoA)
  texA.colorSpace = THREE.SRGBColorSpace
  texA.anisotropy = 4
  // Si la fuente de la web todavía no cargó, los letreros se redibujan cuando llegue.
  document.fonts?.ready.then(() => {
    dibujarAtlas(gA)
    texA.needsUpdate = true
  })

  // ── Focos falsos: dónde brilla la ciudad (la roca los suma en su shader) ──
  const focos: Foco[] = [
    { p: new THREE.Vector3(0, PANTALLA.base + 4, PANTALLA.z), radio: 32, color: "#9fc4ff", fuerza: 0.9 },
    { p: new THREE.Vector3(cx(R_CLUB) - 5, Y0 + 6, cz(R_CLUB)), radio: 30, color: COLOR.magenta, fuerza: 1.0 },
    { p: new THREE.Vector3(ARENA.x, Y0 + 12, ARENA.z), radio: 38, color: "#cfe9ff", fuerza: 0.7 },
    { p: new THREE.Vector3(cx(R_MERCADO), Y0 + 5, cz(R_MERCADO)), radio: 30, color: COLOR.tibio, fuerza: 0.9 },
    { p: new THREE.Vector3(cx(R_TORRES), Y0 + 22, cz(R_TORRES)), radio: 45, color: "#ffc58a", fuerza: 0.7 },
    { p: new THREE.Vector3(cx(R_TORRES) - 20, Y0 + 14, cz(R_TORRES) + 50), radio: 35, color: COLOR.cian, fuerza: 0.45 },
    { p: new THREE.Vector3(0, Y0 + 6, cz(R_ESTACION)), radio: 32, color: "#ffe2b8", fuerza: 0.8 },
    { p: new THREE.Vector3(0, CANAL.agua + 2, CZ - 186), radio: 30, color: "#6fe6ff", fuerza: 1.1 },
    { p: new THREE.Vector3(LAGO.x, Y0 + 2, LAGO.z), radio: 34, color: "#ffb860", fuerza: 0.7 },
    { p: new THREE.Vector3(0, Y0 + 6, cz(R_AVENIDA)), radio: 40, color: "#ffcf94", fuerza: 0.7 },
    { p: new THREE.Vector3(-180, RIEL_Y, 30), radio: 26, color: "#5fe3ff", fuerza: 0.6 },
    { p: new THREE.Vector3(180, RIEL_Y, 110), radio: 26, color: "#5fe3ff", fuerza: 0.6 },
  ]
  const entorno = new EntornoCiudad()
  entorno.pintar(ambienteCiudad(17.5))
  const mats = crearMaterialesCiudad(ctx, focos, texA, texP, entorno.textura)
  const pz = crearPiezas()
  const rnd = semilla(1792)
  const PBR = [
    ["color", 3],
    ["aRM", 2],
    ["aEmis", 3],
  ] as const
  const curva = curvaMonorriel()
  const k: Kit = {
    base: new Lote(PBR),
    torres: new Lote([
      ["color", 3],
      ["aSem", 1],
    ]),
    luz: new Lote([
      ["color", 3],
      ["aPulso", 1],
    ]),
    vidrio: new Lote(),
    roca: new Lote(),
    granito: new Lote(),
    acero: new Lote(),
    madera: new Lote(),
    hierro: new Lote(),
    agua: new Lote(),
    pasto: new Lote(),
    grava: new Lote(),
    acera: new Lote(),
    senal: new Lote(),
    pantalla: new Lote(),
    pisoLed: new Lote(),
    arboles: [],
    reflejos: [],
    charcos: [],
    vapores: [],
    haces: [],
    celdas,
    rnd,
    riel: curva.getSpacedPoints(300),
  }

  // ── Construcción ──
  construirCaverna(k, pz, mats, grupo, ctx)
  construirCasasEnRoca(k, pz, rnd)
  construirCanal(k, pz, mats, grupo)
  const cabina = construirAscensor(k, pz, mats, ctx)
  grupo.add(cabina.grupo)
  const chorros: Chorro[] = []
  construirPlaza(k, pz, chorros)
  construirPantalla(k, pz)
  construirAvenida(k, pz, rnd)
  construirTorres(k, pz, rnd)
  construirMercado(k, pz, rnd)
  construirParque(k, pz, rnd)
  const tren = construirMonorriel(k, pz, mats, ctx, curva)
  grupo.add(tren.malla)
  construirArena(k, pz)
  construirClub(k, pz)
  construirRelleno(k, rnd)

  // ── Mallas fusionadas ──
  const sombra = ctx.sombras
  const poner = (lote: Lote, mat: THREE.Material, nombre: string, op: { proyecta?: boolean; recibe?: boolean; orden?: number } = {}) => {
    const m = lote.malla(mat, nombre)
    if (!m) return null
    m.castShadow = sombra && !!op.proyecta
    m.receiveShadow = sombra && !!op.recibe
    if (op.orden !== undefined) m.renderOrder = op.orden
    grupo.add(m)
    return m
  }
  poner(k.roca, mats.roca, "ciudad-roca", { recibe: true })
  poner(k.base, mats.base, "ciudad-base", { proyecta: true, recibe: true })
  poner(k.torres, mats.torres, "ciudad-torres", { proyecta: true, recibe: true })
  poner(k.granito, mats.granito, "ciudad-granito", { recibe: true })
  poner(k.acero, mats.acero, "ciudad-acero", { proyecta: true })
  poner(k.madera, mats.madera, "ciudad-madera", { proyecta: true, recibe: true })
  poner(k.hierro, mats.hierro, "ciudad-hierro", { proyecta: true })
  poner(k.agua, mats.agua, "ciudad-agua", { recibe: true })
  poner(k.pasto, mats.pasto, "ciudad-pasto", { recibe: true })
  poner(k.grava, mats.grava, "ciudad-grava", { recibe: true })
  poner(k.acera, mats.acera, "ciudad-acera", { recibe: true })
  poner(k.pisoLed, mats.pisoLed, "ciudad-piso-led")
  poner(k.luz, mats.luz, "ciudad-luces")
  poner(k.pantalla, mats.pantalla, "ciudad-pantalla")
  poner(k.vidrio, mats.vidrio, "ciudad-vidrio", { orden: 3 })
  poner(k.senal, mats.senal, "ciudad-senales", { orden: 4 })

  // ── Árboles: troncos y copas instanciados (cada copa toma el color de su árbol) ──
  {
    const copas: Array<{ m: THREE.Matrix4; c: THREE.Color }> = []
    const troncos: THREE.Matrix4[] = []
    const r2 = semilla(33)
    for (const a of k.arboles) {
      const y = a.y ?? Y0
      const s = a.copa
      if (a.alto > 0.5) troncos.push(M(a.x, y + a.alto / 2 + s * 0.2, a.z, r2() * 6, 0.16 + s * 0.035, a.alto + s * 0.4, 0.16 + s * 0.035))
      const c = new THREE.Color(a.color).offsetHSL((r2() - 0.5) * 0.03, 0, (r2() - 0.5) * 0.08)
      const alta = a.alto > 0.5
      copas.push({ m: M(a.x, y + (alta ? a.alto + s * 0.55 : s * 0.35), a.z, r2() * 6, s * (0.9 + r2() * 0.2), s * (alta ? 0.82 : 0.55), s * (0.9 + r2() * 0.2)), c })
    }
    const geoT = new THREE.CylinderGeometry(0.7, 1, 1, 7)
    const it = new THREE.InstancedMesh(geoT, mats.corteza, Math.max(1, troncos.length))
    troncos.forEach((m, i) => it.setMatrixAt(i, m))
    it.count = troncos.length
    it.name = "ciudad-troncos"
    it.castShadow = sombra
    grupo.add(it)
    const ic = new THREE.InstancedMesh(pz.copa, mats.follaje, Math.max(1, copas.length))
    copas.forEach((c, i) => {
      ic.setMatrixAt(i, c.m)
      ic.setColorAt(i, c.c)
    })
    ic.count = copas.length
    ic.name = "ciudad-copas"
    ic.castShadow = sombra
    ic.receiveShadow = sombra
    grupo.add(ic)
  }

  // ── Chorros de la fuente ──
  {
    const cil = new THREE.CylinderGeometry(0.03, 0.1, 1, 8, 6, true)
    cil.translate(0, 0.5, 0)
    const g = new THREE.InstancedBufferGeometry()
    g.index = cil.index
    g.setAttribute("position", cil.getAttribute("position"))
    g.setAttribute("aPos", new THREE.InstancedBufferAttribute(new Float32Array(chorros.flatMap((c) => [c.x, c.y, c.z])), 3))
    g.setAttribute("aAlto", new THREE.InstancedBufferAttribute(new Float32Array(chorros.map((c) => c.alto)), 1))
    g.setAttribute("aFase", new THREE.InstancedBufferAttribute(new Float32Array(chorros.map((c) => c.fase)), 1))
    g.instanceCount = chorros.length
    const m = new THREE.Mesh(g, mats.chorros)
    m.name = "ciudad-chorros"
    m.frustumCulled = false
    m.renderOrder = 5
    grupo.add(m)
  }

  // ── Reflejos en el piso mojado ──
  {
    const lista = k.reflejos
    const g = new THREE.InstancedBufferGeometry()
    const q = new THREE.PlaneGeometry(1, 1)
    g.index = q.index
    g.setAttribute("position", q.getAttribute("position"))
    const f = new Float32Array(lista.length * 3)
    const c = new Float32Array(lista.length * 3)
    const w = new Float32Array(lista.length)
    lista.forEach((r, i) => {
      f.set([r.x, r.h, r.z], i * 3)
      _col.set(r.color).multiplyScalar(r.fuerza)
      c.set([_col.r, _col.g, _col.b], i * 3)
      w[i] = r.ancho
    })
    g.setAttribute("aFuente", new THREE.InstancedBufferAttribute(f, 3))
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(c, 3))
    g.setAttribute("aAncho", new THREE.InstancedBufferAttribute(w, 1))
    g.instanceCount = lista.length
    const m = new THREE.Mesh(g, mats.reflejos)
    m.name = "ciudad-reflejos"
    m.frustumCulled = false
    m.renderOrder = 1
    grupo.add(m)
  }

  // ── Charcos de luz ──
  {
    const lista = k.charcos
    const q = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = q.index
    g.setAttribute("position", q.getAttribute("position"))
    g.setAttribute("aCharco", new THREE.InstancedBufferAttribute(new Float32Array(lista.flatMap((c) => [c.x, c.y, c.z, c.r])), 4))
    g.setAttribute(
      "aColor",
      new THREE.InstancedBufferAttribute(
        new Float32Array(
          lista.flatMap((c) => {
            _col.set(c.color)
            return [_col.r, _col.g, _col.b]
          }),
        ),
        3,
      ),
    )
    g.instanceCount = lista.length
    const m = new THREE.Mesh(g, mats.charcos)
    m.name = "ciudad-charcos"
    m.frustumCulled = false
    m.renderOrder = 1
    grupo.add(m)
  }

  // ── Haces de luz ──
  {
    const lista = k.haces
    const cono = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true)
    const g = new THREE.InstancedBufferGeometry()
    g.index = cono.index
    g.setAttribute("position", cono.getAttribute("position"))
    g.setAttribute("aBase", new THREE.InstancedBufferAttribute(new Float32Array(lista.flatMap((h) => [h.x, h.y, h.z])), 3))
    g.setAttribute("aAng", new THREE.InstancedBufferAttribute(new Float32Array(lista.flatMap((h) => [h.az, h.incl, h.barrido, h.vel])), 4))
    g.setAttribute(
      "aCol",
      new THREE.InstancedBufferAttribute(
        new Float32Array(
          lista.flatMap((h) => {
            _col.set(h.color).multiplyScalar(h.fuerza)
            return [_col.r, _col.g, _col.b]
          }),
        ),
        3,
      ),
    )
    g.setAttribute("aDim", new THREE.InstancedBufferAttribute(new Float32Array(lista.flatMap((h) => [h.largo, h.abre])), 2))
    g.instanceCount = lista.length
    const m = new THREE.Mesh(g, mats.haces)
    m.name = "ciudad-haces"
    m.frustumCulled = false
    m.renderOrder = 6
    grupo.add(m)
  }

  // ── Vapor y bruma ──
  {
    const lista = k.vapores
    const r3 = semilla(71)
    const pos: number[] = []
    const fase: number[] = []
    const vel: number[] = []
    const tam: number[] = []
    const alto: number[] = []
    const col: number[] = []
    for (const v of lista) {
      const n = Math.max(2, Math.round(v.n * factor))
      _col.set(v.color).multiplyScalar(v.fuerza)
      for (let i = 0; i < n; i++) {
        const a = r3() * Math.PI * 2
        const r = Math.sqrt(r3()) * v.r
        pos.push(v.x + Math.cos(a) * r, v.y, v.z + Math.sin(a) * r * (v.r > 20 ? 0.4 : 1))
        fase.push(r3())
        vel.push(v.vel * (0.7 + r3() * 0.6))
        tam.push(v.tam * (0.6 + r3() * 0.8))
        alto.push(v.alto * (0.6 + r3() * 0.8))
        col.push(_col.r, _col.g, _col.b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("aFase", new THREE.Float32BufferAttribute(fase, 1))
    g.setAttribute("aVel", new THREE.Float32BufferAttribute(vel, 1))
    g.setAttribute("aTam", new THREE.Float32BufferAttribute(tam, 1))
    g.setAttribute("aAlto", new THREE.Float32BufferAttribute(alto, 1))
    g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3))
    const p = new THREE.Points(g, mats.vapor)
    p.name = "ciudad-vapor"
    p.frustumCulled = false
    p.renderOrder = 7
    const _t = new THREE.Vector2()
    p.onBeforeRender = (renderer, _s, camara) => {
      renderer.getDrawingBufferSize(_t)
      const fov = (camara as THREE.PerspectiveCamera).fov ?? 50
      mats.u.escalaPuntos.value = _t.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))
    }
    grupo.add(p)
  }

  // ── Drones de luz y luciérnagas ──
  const N_DRONES = Math.round(26 * factor)
  const N_LUCES = Math.round(50 * factor)
  const drones = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ name: "ciudad-drones" }), N_DRONES + N_LUCES)
  drones.name = "ciudad-drones"
  drones.frustumCulled = false
  const rd = semilla(2040)
  const datosDron = Array.from({ length: N_DRONES + N_LUCES }, (_, i) => {
    const luciernaga = i >= N_DRONES
    const zona = luciernaga
      ? { x: cx(R_PARQUE) + (rd() - 0.5) * 90, z: cz(R_PARQUE) + (rd() - 0.5) * 100, y: Y0 + 0.6 + rd() * 2.2 }
      : { x: (rd() - 0.5) * 300, z: CZ + (rd() - 0.5) * 300, y: Y0 + 11 + rd() * 12 }
    const colores = ["#7fe6ff", "#ffffff", "#ffcf8a", "#7fe6ff"]
    const c = new THREE.Color(luciernaga ? "#ffe27a" : colores[i % 4]).multiplyScalar(luciernaga ? 7 : 6)
    drones.setColorAt(i, c)
    return { ...zona, r: luciernaga ? 1.5 + rd() * 2 : 12 + rd() * 30, vel: luciernaga ? 0.2 + rd() * 0.3 : 0.05 + rd() * 0.08, fase: rd() * 100, s: luciernaga ? 0.05 : 0.2, luciernaga }
  })
  grupo.add(drones)

  // ── Luces reales: seis, donde más se ven en el piso mojado ──
  const luces: Array<{ l: THREE.PointLight; base: number; pulso: number }> = []
  const poneLuz = (x: number, y: number, z: number, color: string, intensidad: number, distancia: number, pulso = 0) => {
    const l = new THREE.PointLight(color, intensidad, distancia, 2)
    l.position.set(x, y, z)
    l.castShadow = false
    grupo.add(l)
    luces.push({ l, base: intensidad, pulso })
  }
  poneLuz(0, PANTALLA.base + 2, PANTALLA.z - 8, "#a9c8ff", 220, 70)
  poneLuz(cx(R_PLAZA), Y0 + 2.5, cz(R_PLAZA), "#7fe6ff", 45, 26)
  poneLuz(0, Y0 + 12, cz(R_AVENIDA) + 10, "#ffc98a", 150, 90)
  poneLuz(cx(R_CLUB) - 6, Y0 + 5, cz(R_CLUB) - 4, "#ff4fae", 260, 55, 1)
  poneLuz(cx(R_MERCADO), Y0 + 4.5, cz(R_MERCADO), "#ffb066", 180, 45)
  poneLuz(cx(R_TORRES), Y0 + 7, cz(R_TORRES), "#9fdcff", 200, 60)

  // ── Lugares que se pueden tocar: cajas invisibles (no dibujan) sobre cada lugar ──
  const invisible = new THREE.MeshBasicMaterial({ visible: false })
  const tocable: Array<[string, Rect, number]> = [
    ["ciudad-plaza", R_PLAZA, 3],
    ["ciudad-avenida", R_AVENIDA, 3],
    ["ciudad-torres", R_TORRES, 26],
    ["ciudad-mercado", R_MERCADO, 6],
    ["ciudad-parque", R_PARQUE, 5],
    ["ciudad-estacion", R_ESTACION, 14],
    ["ciudad-arena", R_ARENA, 18],
    ["ciudad-club", R_CLUB, 14],
    ["ciudad-mirador", R_MIRADOR, 3],
  ]
  for (const [id, r, h] of tocable) {
    if (!LUGAR[id]) continue
    const caja = new THREE.Mesh(pz.caja, invisible)
    caja.position.set(cx(r), Y0 + h / 2, cz(r))
    caja.scale.set(r.x1 - r.x0, h, r.z1 - r.z0)
    caja.name = `tocable-${id}`
    grupo.add(caja)
    ctx.seleccionable(caja, id)
  }

  // ── Animación ──
  const amb = ambienteCiudad(17.5)
  const _q = new THREE.Quaternion()
  const _p = new THREE.Vector3()
  const _s = new THREE.Vector3()
  const _m = new THREE.Matrix4()
  const _e = new THREE.Euler()
  const _tan = new THREE.Vector3()
  let ultimaPantalla = -99
  let horaEntorno = 17.5
  let pagina = 0
  let tiempoTren = 0
  const ACEL = 1.1
  const VMAX = 15
  const PARADA = 9
  const tAcel = VMAX / ACEL
  const dAcel = 0.5 * ACEL * tAcel * tAcel
  const tCorre = (tren.largo - 2 * dAcel) / VMAX + 2 * tAcel
  const arcoTren = (tau: number) => {
    if (tau < tAcel) return 0.5 * ACEL * tau * tau
    if (tau < tCorre - tAcel) return dAcel + VMAX * (tau - tAcel)
    const r = tCorre - tau
    return tren.largo - 0.5 * ACEL * r * r
  }
  const ponerCoche = (i: number, s: number) => {
    const L = tren.largo
    const u = (((s % L) + L) % L) / L
    tren.curva.getPointAt(u, _p)
    tren.curva.getTangentAt(u, _tan)
    _e.set(0, Math.atan2(-_tan.z, _tan.x), 0)
    _q.setFromEuler(_e)
    _p.y = RIEL_Y - 0.55
    _m.compose(_p, _q, _s.set(1, 1, 1))
    tren.malla.setMatrixAt(i, _m)
  }

  const ciclo = (tick: TickEscena) => {
    if (!grupo.visible) return
    const t = tick.tiempo
    ambienteCiudad(tick.hora, amb)
    const noche = Math.max(amb.noche, tick.noche * 0.85)
    const u = mats.u
    u.tiempo.value = t
    u.noche.value = noche
    u.reflejo.value = 0.45 + 0.55 * noche
    u.charco.value = 0.08 + 0.75 * noche
    u.cenit.value.copy(amb.cielo.cenit).multiplyScalar(1.1)
    u.horizonte.value.copy(amb.cielo.horizonte).multiplyScalar(0.95)
    u.solCol.value.copy(amb.cielo.sol)
    u.solPos.value.copy(amb.cielo.solPos)
    u.solDir.value.copy(amb.sol.dir)
    u.brillo.value = amb.cielo.brillo
    u.bordeCielo.value.copy(amb.cielo.horizonte).lerp(amb.cielo.cenit, 0.4).multiplyScalar(0.55 * amb.cielo.brillo)

    // El entorno de reflejos sigue al cielo (se repinta cada ~15 min del mundo).
    if (Math.abs(tick.hora - horaEntorno) > 0.25) {
      horaEntorno = tick.hora
      entorno.pintar(amb)
    }

    // La pantalla del reto se redibuja cada 2 s (y cambia de página cada 6 s).
    if (t - ultimaPantalla > 2) {
      ultimaPantalla = t
      pagina = Math.floor(t / 6) % 3 === 2 ? 1 : 0
      const hh = Math.floor(tick.hora)
      const mm = Math.floor((tick.hora - hh) * 60)
      dibujarPantalla(gP, pagina, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, (t % 6) / 6)
      texP.needsUpdate = true
    }

    // El tren: arranca, recorre el circuito y se detiene en la estación.
    tiempoTren = (tiempoTren + tick.dt) % (tCorre + PARADA)
    const s = tren.sEstacion + (tiempoTren < PARADA ? 0 : arcoTren(tiempoTren - PARADA)) + 12.4
    for (let i = 0; i < 3; i++) ponerCoche(i, s - i * 12.4)
    tren.malla.instanceMatrix.needsUpdate = true

    // La cabina del ascensor: espera abajo, sube hasta la bóveda y vuelve.
    const T = 28
    const c = t % T
    const sube = THREE.MathUtils.smoothstep(c, 8, 15)
    const baja = THREE.MathUtils.smoothstep(c, 19, 26)
    cabina.grupo.position.y = Y0 + 0.35 + (cabina.arriba - Y0 - 0.35) * (sube - baja)

    // Drones (vuelan en óvalos lentos) y luciérnagas (titilan sobre el pasto).
    for (let i = 0; i < datosDron.length; i++) {
      const d = datosDron[i]
      const a = t * d.vel + d.fase
      let x: number
      let y: number
      let z: number
      let esc = d.s
      if (d.luciernaga) {
        x = d.x + Math.sin(a * 1.3) * d.r + Math.sin(a * 3.1) * 0.4
        z = d.z + Math.cos(a * 0.9) * d.r
        y = d.y + Math.sin(a * 2.3) * 0.5
        esc *= 0.4 + 0.6 * Math.max(0, Math.sin(a * 4 + d.fase))
      } else {
        x = d.x + Math.cos(a) * d.r
        z = d.z + Math.sin(a * 1.3) * d.r * 0.7
        y = d.y + Math.sin(a * 2.1) * 1.5
        y = Math.min(y, techoCiudad(x, z) - 3)
      }
      _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(esc))
      drones.setMatrixAt(i, _m)
    }
    drones.instanceMatrix.needsUpdate = true

    // El club late; las demás luces son fijas.
    for (const l of luces) l.l.intensity = l.base * (l.pulso ? 0.75 + 0.25 * Math.pow(0.5 + 0.5 * Math.sin(t * 6.283 * 2), 3) : 1) * (0.85 + 0.15 * noche)
  }
  ctx.alActualizar(ciclo)
  // Primer cuadro: deja todo en su lugar antes de que el motor dibuje.
  ciclo({ dt: 0, tiempo: 0, hora: 17.5, noche: 0 })

  // ── Limpieza de piezas temporales ──
  for (const g of [pz.caja, pz.cil8, pz.cil16, pz.cil24, pz.esfera, pz.cono, pz.plano, ...pz.rocas]) {
    // La copa la usan las instancias de árboles: queda.
    // La caja la usan los tocables: no se libera.
    if (g !== pz.caja) g.dispose()
  }
}
