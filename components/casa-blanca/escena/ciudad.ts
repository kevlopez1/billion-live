// ──────────────────────────────────────────────────────────────
// LA INSTALACIÓN SUBTERRÁNEA — debajo de la Casa Blanca (ficción)
//
// Ya no es una ciudad bajo una bóveda: es un búnker compacto de 74 x 102 m
// (HUELLAS.ciudad) con el piso en y = -60, todo techado y con luz artificial.
// El gesto que se ve desde el ascensor es UNO: un pozo de 20 x 32 m que sube
// hasta y = -28, con galerías de oficinas cada 8 m (un rascacielos al revés).
// Alrededor del pozo: el andén del tren que llega desde la Residencia, la
// sala de control con el contador real del reto, el corredor blanco con el
// arco de escaneo, los laboratorios de vidrio, el comedor, el jardín
// hidropónico y la cámara de pruebas de robots y drones.
//
// Presupuesto (< 80 llamadas de dibujo, < 300 mil triángulos):
//   - Lo fijo va en "lotes": una malla fusionada por material. El lote "base"
//     lleva color, rugosidad, metal, emisión y módulo de panel por vértice.
//   - Las ventanas de las oficinas del pozo y las juntas de los paneles las
//     dibuja el shader con la posición en metros: no hay geometría por ventana.
//   - Lo que se mueve (tren, cabinas, puertas, escaneo, núcleo, robots) es una
//     malla instanciada o un shader con reloj.
//   - Luces reales: 5 PointLight. El resto es emisión + bloom moderado.
//
// Vista de maqueta: los techos de las salas solo se ven desde abajo. Desde la
// cámara libre (por encima de los techos) la instalación se lee en corte, como
// los subsuelos. Por eso `techoCiudad` da el techo del pozo dentro del pozo y
// una altura de maqueta en el resto.
//
// La luz general (la direccional del techo, el hemisferio, la niebla, la
// exposición y el bloom) sale de `ambienteCiudad(hora)`: el turno de noche baja
// los pasillos y los tiñe de azul. El motor la aplica con el nivel a la vista.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { CHALLENGE_LAUNCH, CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import type { TickEscena } from "../tipos"
import { HUELLAS, LUGAR, LUGARES, NODO } from "../lugares"
import type { CtxEscena } from "./contrato"

// ═══════════════════════════════════════════════════════════════
// 1. Medidas
// ═══════════════════════════════════════════════════════════════

const CIU = HUELLAS.ciudad
const Y0 = CIU.piso
/** Techo del pozo (la boca, bajo la losa del Subsuelo 3). */
const TOPE = CIU.boveda
const ASC = NODO["ciudad-asc"]?.p ?? { x: 0, y: Y0, z: 22 }

type Rect = { x0: number; x1: number; z0: number; z1: number }
type Sala = Rect & { alto: number }
const cx = (r: Rect) => (r.x0 + r.x1) / 2
const cz = (r: Rect) => (r.z0 + r.z1) / 2
/** El rectángulo de un lugar del mapa (el de respaldo solo si el mapa cambió). */
function rectDe(id: string, respaldo: Rect): Rect {
  const l = LUGAR[id]
  return l ? { x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1 } : respaldo
}

/** El pozo: planta baja de PB m y galerías a 8, 16 y 24 m sobre el piso. */
const POZO: Rect = { x0: -10, x1: 10, z0: 12, z1: 44 }
const PB = 7
const GALERIAS = [8, 16, 24]
/** Lo que queda libre en el centro del pozo (las galerías vuelan 2,5 m). */
const VACIO: Rect = { x0: -7.5, x1: 7.5, z0: 14.5, z1: 41.5 }
/** El foso bajo el piso de vidrio del Balcón: el pozo sigue 12 m más abajo. */
const FOSO = { x0: -8, x1: 8, z0: 13.5, z1: 19.5, fondo: 12 }
/** Ascensores: dos cajas de vidrio (como el núcleo del subsuelo), a x = ±2,2. */
const ELEV = { dx: 2.2, medio: 1.3 }

const ANDEN: Sala = { x0: -36, x1: -12, z0: 12, z1: 44, alto: 7 }
/** La vía, hundida 1,2 m, del lado oeste del andén. */
const VIA = { x: -30.4, x0: -36, x1: -28, hondo: 1.2, tope: 43.2 }
const TUNEL = { x: -30.4, y: Y0 + 1.2, radio: 2.4, z0: 12, z1: -58 }
const CONTROL: Sala = { x0: 10, x1: 36, z0: 12, z1: 40, alto: 7 }
const CORREDOR: Sala = { x0: -3, x1: 3, z0: 46, z1: 96, alto: 4.2 }
const LABS: Sala = { x0: -30, x1: -4, z0: 47, z1: 93, alto: 4.5 }
/** El frente de vidrio de los cuatro módulos de laboratorio. */
const FRENTE_LABS = -17
const COMEDOR: Sala = { x0: 4, x1: 26, z0: 47, z1: 68, alto: 4.5 }
const JARDIN: Sala = { x0: 4, x1: 26, z0: 69, z1: 93, alto: 4.5 }
const CAMARA: Sala = { x0: -14, x1: 14, z0: 97, z1: 112, alto: 10 }
/** La pantalla curva y el núcleo de IA de la sala de control. */
const NUCLEO = { x: 22.5, z: 26 }
const PANTALLA = { radio: 12.6, ang: 0.72, y0: Y0 + 1.5, y1: Y0 + 6.5 }

const R_PLAZA = rectDe("ciudad-plaza", { x0: -9, x1: 9, z0: 25, z1: 43 })
const R_MIRADOR = rectDe("ciudad-mirador", { x0: -9, x1: 9, z0: 13, z1: 20 })
const R_ESTACION = rectDe("ciudad-estacion", { x0: -27, x1: -13, z0: 14, z1: 43 })
const R_CLUB = rectDe("ciudad-club", { x0: 13, x1: 20, z0: 14, z1: 39 })
const R_AVENIDA = rectDe("ciudad-avenida", { x0: -3, x1: 3, z0: 46, z1: 96 })
const R_TORRES = rectDe("ciudad-torres", { x0: -16, x1: -5, z0: 48, z1: 92 })
const R_MERCADO = rectDe("ciudad-mercado", { x0: 5, x1: 16, z0: 48, z1: 67 })
const R_PARQUE = rectDe("ciudad-parque", { x0: 5, x1: 16, z0: 70, z1: 92 })
const R_ARENA = rectDe("ciudad-arena", { x0: -13, x1: 13, z0: 98, z1: 111 })

const dentro = (r: Rect, x: number, z: number, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m

/**
 * Hasta dónde puede subir algo (la cámara) sobre un punto. En el pozo, su
 * techo; en el resto, la altura de la vista de maqueta (por encima de los
 * techos de las salas, que desde arriba no se dibujan).
 */
export function techoCiudad(x: number, z: number): number {
  if (dentro(POZO, x, z, 0.5)) return TOPE - 0.6
  return Y0 + 16
}

// Paleta (del estudio de la película: blanco clínico, acero, grafito y acentos).
const P = {
  panel: "#e9eef2",
  junta: "#b7c2cc",
  acero: "#8c969f",
  grafito: "#1b2228",
  concreto: "#7a7d80",
  epoxi: "#c9d0d6",
  frio: "#eaf4ff",
  cian: "#36d3ff",
  azul: "#1e6bff",
  ambar: "#ffb020",
  amarillo: "#f2c21b",
  negro: "#111316",
  rojo: "#e5352b",
  magenta: "#ff4fd1",
  verde: "#4caf50",
  niebla: "#0e141a",
  corte: "#2b3138",
}

// ═══════════════════════════════════════════════════════════════
// 2. Ambiente: luz de interior que sigue la hora de la superficie
// ═══════════════════════════════════════════════════════════════

export interface AmbienteCiudad {
  hora: number
  /** 0 = turno de día, 1 = turno de noche. */
  noche: number
  /** La luz direccional del techo (el motor usa su "sol"). `dir` apunta hacia la luz. */
  sol: { color: THREE.Color; intensidad: number; dir: THREE.Vector3 }
  hemi: { cielo: THREE.Color; suelo: THREE.Color; intensidad: number }
  /** scene.environmentIntensity para el entorno de estudio del motor. */
  entorno: number
  niebla: { color: THREE.Color; densidad: number }
  exposicion: number
  /** Mismo formato que el Ambiente del cielo: el motor se lo puede pasar a Post.aplicar. */
  bloom: { fuerza: number; umbral: number; radio: number }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const _ca = new THREE.Color()
const _cb = new THREE.Color()
const mezcla = (out: THREE.Color, a: string, b: string, t: number) => out.copy(_ca.set(a)).lerp(_cb.set(b), t)
const DIR_TECHO = new THREE.Vector3(0.32, 1, 0.22).normalize()

/**
 * La luz de la instalación a una hora. De día (7 a 19 h): blanco neutro al
 * 100 %. De noche: los pasillos bajan y se tiñen de azul de turno nocturno.
 * Sin cielo: la hora solo cambia la temperatura y la intensidad.
 */
export function ambienteCiudad(hora: number, out?: AmbienteCiudad): AmbienteCiudad {
  const a: AmbienteCiudad = out ?? {
    hora: 0,
    noche: 0,
    sol: { color: new THREE.Color(), intensidad: 1, dir: new THREE.Vector3() },
    hemi: { cielo: new THREE.Color(), suelo: new THREE.Color(), intensidad: 0.5 },
    entorno: 0.5,
    niebla: { color: new THREE.Color(P.niebla), densidad: 0.01 },
    exposicion: 1,
    bloom: { fuerza: 0.4, umbral: 0.9, radio: 0.5 },
  }
  const h = ((hora % 24) + 24) % 24
  const noche = 1 - smooth(5.5, 7.5, h) * (1 - smooth(18.5, 20.5, h))
  a.hora = h
  a.noche = noche
  mezcla(a.sol.color, "#fff3e4", "#c6d6ff", noche)
  a.sol.intensidad = THREE.MathUtils.lerp(0.6, 0.38, noche)
  a.sol.dir.copy(DIR_TECHO)
  mezcla(a.hemi.cielo, "#e4edf5", "#a9bde4", noche)
  mezcla(a.hemi.suelo, "#5a616b", "#363e4c", noche)
  a.hemi.intensidad = THREE.MathUtils.lerp(0.36, 0.26, noche)
  a.entorno = THREE.MathUtils.lerp(0.4, 0.3, noche)
  a.niebla.color.set(P.niebla)
  a.niebla.densidad = THREE.MathUtils.lerp(0.0095, 0.0115, noche)
  a.exposicion = THREE.MathUtils.lerp(0.95, 1.0, noche)
  a.bloom.fuerza = THREE.MathUtils.lerp(0.3, 0.42, noche)
  a.bloom.umbral = THREE.MathUtils.lerp(0.96, 0.9, noche)
  a.bloom.radio = 0.5
  return a
}

/**
 * Entorno de reflejos propio: un cubo pintado una vez con el interior de la
 * instalación (techo de paneles de luz, muros claros, piso gris). Así el
 * epoxi y el acero reflejan un búnker y no el estudio del motor.
 */
function entornoInstalacion(): THREE.CubeTexture {
  const T = 64
  const caras = Array.from({ length: 6 }, (_, cara) => {
    const c = document.createElement("canvas")
    c.width = T
    c.height = T
    const g = c.getContext("2d")!
    if (cara === 2) {
      g.fillStyle = "#3a434d"
      g.fillRect(0, 0, T, T)
      g.fillStyle = "#f4f9ff"
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(4 + i * 16, 4 + j * 16, 8, 8)
    } else if (cara === 3) {
      g.fillStyle = "#4b525a"
      g.fillRect(0, 0, T, T)
    } else {
      const v = g.createLinearGradient(0, 0, 0, T)
      v.addColorStop(0, "#56606a")
      v.addColorStop(0.12, "#e8f2ff")
      v.addColorStop(0.18, "#8d98a3")
      v.addColorStop(0.6, "#a7b0b8")
      v.addColorStop(1, "#3c434a")
      g.fillStyle = v
      g.fillRect(0, 0, T, T)
    }
    return c
  })
  const t = new THREE.CubeTexture(caras)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

// ═══════════════════════════════════════════════════════════════
// 3. Utilidades: azar con semilla, lotes de geometría, piezas
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

/** Matriz de ubicación: posición, giro en y (y opcionalmente en x y z) y escala. */
function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
    new THREE.Vector3(sx, sy, sz),
  )
}

type Valores = Record<string, readonly number[]>

/** Junta muchas piezas en una sola malla (una llamada de dibujo), con atributos constantes por pieza. */
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

  geometria(): THREE.BufferGeometry | null {
    if (!this.partes.length) return null
    const geo = mergeGeometries(this.partes, false)
    for (const p of this.partes) p.dispose()
    this.partes = []
    if (geo) geo.computeBoundingSphere()
    return geo
  }

  malla(material: THREE.Material, nombre: string): THREE.Mesh | null {
    const geo = this.geometria()
    if (!geo) return null
    const mesh = new THREE.Mesh(geo, material)
    mesh.name = nombre
    return mesh
  }
}

const PBR = [
  ["color", 3],
  ["aRM", 2],
  ["aEmis", 3],
  ["aJunta", 1],
] as const

const _col = new THREE.Color()
/**
 * Acabado del lote "base": color, rugosidad, metal, emisión (HDR) y el
 * módulo de los paneles en metros (0 = sin juntas).
 */
function acabado(color: THREE.ColorRepresentation, rug = 0.6, metal = 0, junta = 0, emis?: THREE.ColorRepresentation, fuerza = 1): Valores {
  _col.set(color)
  const c = [_col.r, _col.g, _col.b]
  let e = [0, 0, 0]
  if (emis !== undefined) {
    _col.set(emis).multiplyScalar(fuerza)
    e = [_col.r, _col.g, _col.b]
  }
  return { color: c, aRM: [rug, metal], aEmis: e, aJunta: [junta] }
}
/** Una luz (lote "luz"): color HDR, pulso (rad/s) y cuánto baja en el turno de noche (0..1). */
function luz(color: THREE.ColorRepresentation, fuerza: number, turno = 1, pulso = 0): Valores {
  _col.set(color).multiplyScalar(fuerza)
  return { color: [_col.r, _col.g, _col.b], aPulso: [pulso], aTurno: [turno] }
}

const A = {
  panel: acabado(P.panel, 0.55, 0, 1.2),
  muroCorte: acabado(P.corte, 0.9, 0),
  concreto: acabado(P.concreto, 0.85, 0, 2.4),
  concretoOsc: acabado("#4f5357", 0.9, 0),
  grafito: acabado(P.grafito, 0.5, 0.1, 1.2),
  grafitoPiso: acabado("#20272e", 0.32, 0.1, 1.2),
  epoxi: acabado(P.epoxi, 0.2, 0, 2.4),
  acero: acabado(P.acero, 0.35, 0.8),
  aceroOsc: acabado("#4a525a", 0.4, 0.7),
  blanco: acabado("#f2f5f7", 0.4, 0),
  rejilla: acabado("#4a5056", 0.55, 0.6, 0.6),
}

type V2 = [number, number]

/** Empuja un triángulo con la cara hacia `n` (corrige el orden si hace falta). */
function tri(pos: number[], nor: number[], uv: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, ua: V2, ub: V2, uc: V2) {
  const e1 = new THREE.Vector3().subVectors(b, a)
  const e2 = new THREE.Vector3().subVectors(c, a)
  const ok = e1.cross(e2).dot(n) >= 0
  const Pt = ok ? [a, b, c] : [a, c, b]
  const U = ok ? [ua, ub, uc] : [ua, uc, ub]
  for (let i = 0; i < 3; i++) {
    pos.push(Pt[i].x, Pt[i].y, Pt[i].z)
    nor.push(n.x, n.y, n.z)
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
 * Cara vertical de (ax, az) a (bx, bz), entre y0 e y1, mirando hacia `n`.
 * UV en metros: u a lo largo (desde `u0`) y v = altura sobre `vBase`.
 */
function cara(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, n: THREE.Vector3, u0 = 0, vBase = y0): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const largo = Math.hypot(bx - ax, bz - az)
  const a0 = new THREE.Vector3(ax, y0, az)
  const b0 = new THREE.Vector3(bx, y0, bz)
  const a1 = new THREE.Vector3(ax, y1, az)
  const b1 = new THREE.Vector3(bx, y1, bz)
  const v0 = y0 - vBase
  const v1 = y1 - vBase
  tri(pos, nor, uv, a0, b0, b1, n, [u0, v0], [u0 + largo, v0], [u0 + largo, v1])
  tri(pos, nor, uv, a0, b1, a1, n, [u0, v0], [u0 + largo, v1], [u0, v1])
  return geometria(pos, nor, uv)
}

/** Cara horizontal (piso si `abajo` es false, techo si es true). UV en metros. */
function horizontal(r: Rect, y: number, abajo = false): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const n = new THREE.Vector3(0, abajo ? -1 : 1, 0)
  const p = (x: number, z: number) => new THREE.Vector3(x, y, z)
  tri(pos, nor, uv, p(r.x0, r.z0), p(r.x1, r.z0), p(r.x1, r.z1), n, [r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1])
  tri(pos, nor, uv, p(r.x0, r.z0), p(r.x1, r.z1), p(r.x0, r.z1), n, [r.x0, r.z0], [r.x1, r.z1], [r.x0, r.z1])
  return geometria(pos, nor, uv)
}

/** Las cuatro caras interiores de una caja (para el pozo, el foso y la cámara de pruebas). */
function carasInteriores(r: Rect, y0: number, y1: number, vBase = y0): THREE.BufferGeometry[] {
  const X = new THREE.Vector3(1, 0, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const ax = r.x1 - r.x0
  const az = r.z1 - r.z0
  return [
    cara(r.x0, r.z0, r.x1, r.z0, y0, y1, Z, 0, vBase),
    cara(r.x1, r.z0, r.x1, r.z1, y0, y1, X.clone().negate(), ax, vBase),
    cara(r.x1, r.z1, r.x0, r.z1, y0, y1, Z.clone().negate(), ax + az, vBase),
    cara(r.x0, r.z1, r.x0, r.z0, y0, y1, X, 2 * ax + az, vBase),
  ]
}

/** Da vuelta una geometría (caras hacia adentro): invierte el orden y las normales. */
function invertir(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const p = g.getAttribute("position") as THREE.BufferAttribute
  const n = g.getAttribute("normal") as THREE.BufferAttribute
  const u = g.getAttribute("uv") as THREE.BufferAttribute | undefined
  for (let i = 0; i < p.count; i += 3) {
    for (const at of [p, n, u]) {
      if (!at) continue
      for (let k = 0; k < at.itemSize; k++) {
        const t = at.getComponent(i + 1, k)
        at.setComponent(i + 1, k, at.getComponent(i + 2, k))
        at.setComponent(i + 2, k, t)
      }
    }
  }
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  return g
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

/** Las coordenadas en metros sobre la cara (según hacia dónde mira): sirven para juntas y grillas. */
const GLSL_PLANO = /* glsl */ `
vec2 cbPlano(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > 0.5) return p.xz;
  return a.x > a.z ? vec2(p.z, p.y) : vec2(p.x, p.y);
}
`

interface MaterialesCiudad {
  base: THREE.MeshStandardMaterial
  oficinas: THREE.MeshStandardMaterial
  luz: THREE.MeshBasicMaterial
  vidrio: THREE.MeshStandardMaterial
  esmerilado: THREE.MeshStandardMaterial
  grilla: THREE.MeshStandardMaterial
  chevron: THREE.MeshStandardMaterial
  follaje: THREE.MeshStandardMaterial
  robot: THREE.MeshStandardMaterial
  brillo: THREE.MeshBasicMaterial
  vapor: THREE.ShaderMaterial
  reflejos: THREE.ShaderMaterial
  escaneo: THREE.ShaderMaterial
  senal: THREE.MeshBasicMaterial
  pantalla: THREE.MeshBasicMaterial
  u: {
    tiempo: THREE.IUniform<number>
    noche: THREE.IUniform<number>
    escalaPuntos: THREE.IUniform<number>
    reflejo: THREE.IUniform<number>
  }
}

function chevrones(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const g = c.getContext("2d")!
  // Acero cepillado con una franja de chevrones abajo y otra al medio.
  const fondo = g.createLinearGradient(0, 0, 256, 0)
  fondo.addColorStop(0, "#7d868f")
  fondo.addColorStop(0.5, "#959ea7")
  fondo.addColorStop(1, "#7d868f")
  g.fillStyle = fondo
  g.fillRect(0, 0, 256, 256)
  g.globalAlpha = 0.08
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = y % 4 ? "#ffffff" : "#000000"
    g.fillRect(0, y, 256, 1)
  }
  g.globalAlpha = 1
  const franja = (y0: number, alto: number) => {
    g.save()
    g.beginPath()
    g.rect(0, y0, 256, alto)
    g.clip()
    g.fillStyle = P.amarillo
    g.fillRect(0, y0, 256, alto)
    g.fillStyle = P.negro
    for (let x = -alto; x < 256 + alto; x += 40) {
      g.beginPath()
      g.moveTo(x, y0 + alto)
      g.lineTo(x + 20, y0 + alto)
      g.lineTo(x + 20 + alto, y0)
      g.lineTo(x + alto, y0)
      g.closePath()
      g.fill()
    }
    g.restore()
  }
  franja(206, 50)
  franja(112, 26)
  // Remaches.
  g.fillStyle = "#5c646c"
  for (let x = 12; x < 256; x += 32)
    for (const y of [8, 100, 196]) {
      g.beginPath()
      g.arc(x, y, 3, 0, Math.PI * 2)
      g.fill()
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function crearMaterialesCiudad(entorno: THREE.Texture, atlas: THREE.Texture, pantalla: THREE.Texture): MaterialesCiudad {
  const u: MaterialesCiudad["u"] = {
    tiempo: { value: 0 },
    noche: { value: 0 },
    escalaPuntos: { value: 600 },
    reflejo: { value: 1 },
  }

  // ── Base: color, rugosidad, metal, emisión y juntas de panel por vértice ──
  const base = new THREE.MeshStandardMaterial({ name: "ciudad-base", vertexColors: true, roughness: 1, metalness: 1 })
  base.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aRM;\nattribute vec3 aEmis;\nattribute float aJunta;\nvarying vec2 vRM;\nvarying vec3 vEmis;\nvarying float vJunta;\nvarying vec3 vPosM;\nvarying vec3 vNorM;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRM = aRM;\nvEmis = aEmis;\nvJunta = aJunta;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec2 vRM;\nvarying vec3 vEmis;\nvarying float vJunta;\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}\n${GLSL_PLANO}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float granoB = cbRuido(vPosM * 2.3);
diffuseColor.rgb *= 0.95 + 0.1 * cbRuido(vPosM * 0.37 + 5.0);
// Juntas de panel: un módulo cuadrado en pisos y techos, de 1 x 2 en los muros.
if (vJunta > 0.0) {
  vec3 nJ = normalize(vNorM);
  vec2 pl = cbPlano(vPosM, nJ);
  vec2 mod2 = abs(nJ.y) > 0.5 ? vec2(vJunta) : vec2(vJunta, vJunta * 2.0);
  vec2 f = fract(pl / mod2);
  vec2 d = min(f, 1.0 - f) * mod2;
  vec2 fw = fwidth(pl) * 1.2;
  float dj = min(d.x, d.y);
  float junta = 1.0 - smoothstep(0.006, 0.006 + max(fw.x, fw.y), dj);
  junta *= 1.0 - clamp(max(fw.x, fw.y) * 6.0 - 0.3, 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - junta * 0.32;
}`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = clamp(vRM.x + (granoB - 0.5) * 0.1, 0.03, 1.0);")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vRM.y;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmis;")
  }
  base.customProgramCacheKey = () => "ciudad-base-v2"

  // ── Oficinas del pozo: ventanas de piso a techo, encendidas y apagadas ──
  const oficinas = new THREE.MeshStandardMaterial({ name: "ciudad-oficinas", color: "#cfd6dc", roughness: 1, metalness: 0 })
  oficinas.onBeforeCompile = (s) => {
    s.uniforms.uNoche = u.noche
    s.uniforms.uTiempo = u.tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vUvM;\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUvM = uv;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uNoche;\nuniform float uTiempo;\nvarying vec2 vUvM;\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float semO = dot(floor(vNorM * 2.0 + 0.5), vec3(3.0, 7.0, 13.0)) + floor(vPosM.y / 200.0);
// Pisos de 4 m con paños de vidrio de 2,4 m; cada 8 m, la losa de la galería.
vec2 q = vUvM / vec2(2.4, 4.0);
vec2 idV = floor(q);
vec2 f = fract(q);
vec2 fw = fwidth(q);
float lejos = clamp((max(fw.x, fw.y) - 0.05) * 6.0, 0.0, 1.0);
vec2 e0 = smoothstep(vec2(0.05, 0.16) - fw, vec2(0.05, 0.16) + fw, f);
vec2 e1 = 1.0 - smoothstep(vec2(0.95, 0.93) - fw, vec2(0.95, 0.93) + fw, f);
float parante = smoothstep(0.0, 0.012 + fw.x, abs(f.x - 0.5));
float vent = mix(e0.x * e0.y * e1.x * e1.y * parante, 0.62, lejos);
diffuseColor.rgb = mix(diffuseColor.rgb * (0.94 + 0.08 * cbRuido(vPosM * 0.6)), vec3(0.02, 0.026, 0.032), vent);
float rugO = mix(0.5, 0.08, vent);
float metO = mix(0.0, 0.85, vent);
// Cada oficina cambia de estado cada uno o dos minutos, a su ritmo.
float hId = cbHash2(idV + semO * 17.0);
float periodo = 70.0 + 90.0 * cbHash2(idV.yx + semO);
float fase = floor((uTiempo + hId * periodo) / periodo);
float hOn = cbHash2(idV * 1.37 + fase * 3.1 + semO * 7.0);
float frac = mix(0.78, 0.42, uNoche);
float on = mix(step(1.0 - frac, hOn), frac, lejos);
float tipo = cbHash2(idV + 31.0 + semO);
vec3 colV = tipo < 0.7 ? vec3(0.86, 0.93, 1.0) : tipo < 0.88 ? vec3(1.0, 0.86, 0.68) : vec3(0.3, 0.75, 1.0);
colV = mix(colV, colV * vec3(0.7, 0.8, 1.15), uNoche);
// Dentro: el panel del techo arriba, escritorios oscuros abajo.
float gradV = mix(0.45, 1.0, smoothstep(0.25, 0.9, f.y));
float muebles = 1.0 - 0.55 * (1.0 - smoothstep(0.28, 0.36, f.y)) * step(0.4, cbHash2(idV + 41.0));
float inten = mix(1.15, 0.85, uNoche) * (0.45 + 0.6 * cbHash2(idV + 5.0)) * gradV * muebles;
inten = mix(inten, 0.6, lejos);
vec3 emiO = vent * on * colV * inten;`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = rugO;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = metO;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += emiO;")
  }
  oficinas.customProgramCacheKey = () => "ciudad-oficinas"

  // ── Luces: tiras, paneles y balizas. Color HDR por vértice, pulso y turno ──
  const luzMat = new THREE.MeshBasicMaterial({ name: "ciudad-luz", vertexColors: true })
  luzMat.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = u.tiempo
    s.uniforms.uNoche = u.noche
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPulso;\nattribute float aTurno;\nvarying float vPulso;\nvarying float vTurno;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPulso = aPulso;\nvTurno = aTurno;")
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTiempo;\nuniform float uNoche;\nvarying float vPulso;\nvarying float vTurno;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (vPulso > 0.0) diffuseColor.rgb *= 0.7 + 0.3 * sin(uTiempo * vPulso);
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.58, 0.82), uNoche * vTurno);`,
      )
  }
  luzMat.customProgramCacheKey = () => "ciudad-luz-v2"

  const vidrio = new THREE.MeshStandardMaterial({
    name: "ciudad-vidrio",
    color: "#a9d6e5",
    metalness: 0.3,
    roughness: 0.05,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const esmerilado = new THREE.MeshStandardMaterial({
    name: "ciudad-esmerilado",
    color: "#eef4f8",
    roughness: 0.85,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  // ── Cámara de pruebas: blanco con una grilla de luz que respira ──
  const grilla = new THREE.MeshStandardMaterial({ name: "ciudad-grilla", color: "#e7edf2", roughness: 0.35, metalness: 0 })
  grilla.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = u.tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uTiempo;\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_PLANO}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
{
  vec2 pl = cbPlano(vPosM, normalize(vNorM));
  vec2 fw = fwidth(pl);
  vec2 g1 = abs(fract(pl + 0.5) - 0.5) / max(fw, 1e-4);
  vec2 g4 = abs(fract(pl / 4.0 + 0.5) - 0.5) * 4.0 / max(fw, 1e-4);
  float l1 = 1.0 - clamp(min(g1.x, g1.y) - 0.5, 0.0, 1.0);
  float l4 = 1.0 - clamp(min(g4.x, g4.y) - 1.0, 0.0, 1.0);
  float lejos = clamp(max(fw.x, fw.y) * 3.0, 0.0, 1.0);
  float onda = 0.5 + 0.5 * sin(dot(pl, vec2(0.21, 0.13)) - uTiempo * 1.3);
  vec3 cian = vec3(0.21, 0.83, 1.0);
  totalEmissiveRadiance += cian * (l1 * 0.18 * (1.0 - lejos) + l4 * (0.8 + 1.4 * onda)) ;
}`,
      )
  }
  grilla.customProgramCacheKey = () => "ciudad-grilla"

  const chevron = new THREE.MeshStandardMaterial({ name: "ciudad-compuerta", map: chevrones(), roughness: 0.42, metalness: 0.55 })

  // Follaje del jardín: hojas con huecos de sombra, y la luz magenta que las atraviesa.
  const follaje = new THREE.MeshStandardMaterial({ name: "ciudad-follaje", color: "#ffffff", roughness: 0.8, metalness: 0 })
  follaje.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = u.tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTiempo;\nvarying vec3 vPosM;\nvarying vec3 vNorM;")
      .replace(
        "#include <begin_vertex>",
        // Se mecen con la ventilación: más arriba, más movimiento.
        "#include <begin_vertex>\ntransformed.x += sin(uTiempo * 1.7 + position.y * 3.0 + float(gl_InstanceID) * 1.3) * 0.06 * max(position.y, 0.0);",
      )
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + GLSL_MUNDO_VERT)
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;\n${GLSL_RUIDO}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float hojas = cbRuido(vPosM * 9.0) * 0.55 + cbRuido(vPosM * 21.0) * 0.45;
diffuseColor.rgb *= mix(0.55, 1.08, smoothstep(0.3, 0.6, hojas)) * (0.75 + 0.35 * clamp(vNorM.y * 0.5 + 0.5, 0.0, 1.0));`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.16, 0.05, 0.14);")
  }
  follaje.customProgramCacheKey = () => "ciudad-follaje-v2"

  const robot = new THREE.MeshStandardMaterial({ name: "ciudad-robot", color: "#f1f4f6", roughness: 0.38, metalness: 0.1 })
  const brillo = new THREE.MeshBasicMaterial({ name: "ciudad-brillo", color: "#ffffff" })

  // ── Bruma: puntos suaves que suben y se desvanecen ──
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
  gl_PointSize = min(aTam * (0.6 + 0.8 * t) * uEscala / max(-mv.z, 0.5), 700.0);
  vAlfa = sin(t * 3.14159) * smoothstep(1.0, 4.0, -mv.z);
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

  // ── Reflejos falsos en el epoxi: una estela por cada luz, estirada hacia la cámara ──
  const reflejos = new THREE.ShaderMaterial({
    name: "ciudad-reflejos",
    uniforms: { uY: { value: Y0 + 0.02 }, uFuerza: u.reflejo },
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
  vec2 centro = base + dir * dist * h / (h + camH);
  float largo = 0.6 * h + 0.05 * dist + 0.6;
  float ancho = aAncho * (0.8 + 0.004 * dist);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 p = centro + perp * position.x * ancho + dir * position.y * largo;
  vQ = position.xy * 2.0;
  vCol = aColor * exp(-dist * 0.02) * smoothstep(2.0, 8.0, dist);
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

  // ── Arco de escaneo: un plano azul con grilla fina que recorre el corredor ──
  const escaneo = new THREE.ShaderMaterial({
    name: "ciudad-escaneo",
    uniforms: { uTiempo: u.tiempo, uAlfa: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform float uTiempo;
uniform float uAlfa;
varying vec2 vUv;
void main() {
  vec2 g = abs(fract(vUv * vec2(24.0, 17.0)) - 0.5);
  vec2 fw = fwidth(vUv * vec2(24.0, 17.0));
  float linea = 1.0 - clamp(min(g.x / fw.x, g.y / fw.y) - 0.5, 0.0, 1.0);
  vec2 b = min(vUv, 1.0 - vUv);
  float borde = 1.0 - smoothstep(0.0, 0.03, min(b.x, b.y * 1.4));
  float barrido = 0.5 + 0.5 * sin(vUv.y * 40.0 - uTiempo * 6.0);
  vec3 c = vec3(0.21, 0.83, 1.0);
  float a = 0.05 + linea * 0.35 * (0.6 + 0.4 * barrido) + borde * 1.4;
  gl_FragColor = vec4(c * a * uAlfa, 1.0);
}`,
  })

  const senal = new THREE.MeshBasicMaterial({
    name: "ciudad-senales",
    map: atlas,
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(1.6, 1.6, 1.6),
    side: THREE.DoubleSide,
  })
  const pantallaMat = new THREE.MeshBasicMaterial({ name: "ciudad-pantalla", map: pantalla, color: new THREE.Color(1.35, 1.35, 1.35) })

  // Todo refleja la instalación (no el estudio del motor).
  for (const m of [base, oficinas, vidrio, esmerilado, grilla, chevron, robot]) {
    m.envMap = entorno
    m.envMapIntensity = m === vidrio ? 1.2 : 0.55
  }
  return { base, oficinas, luz: luzMat, vidrio, esmerilado, grilla, chevron, follaje, robot, brillo, vapor, reflejos, escaneo, senal, pantalla: pantallaMat, u }
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

const PANT_W = 1448
const PANT_H = 400

/**
 * La pantalla curva de la sala de control: el contador REAL del reto
 * (RECAUDADO de CHALLENGE_TARGET, de lib/contador.ts) y el plano de la
 * instalación, dibujado con los lugares del mapa. Ningún otro número.
 */
function dibujarPantalla(g: CanvasRenderingContext2D, reloj: string, barrido: number) {
  const W = PANT_W
  const H = PANT_H
  const monto = `$${miles(RECAUDADO)}`
  const meta = `$${miles(CHALLENGE_TARGET)}`
  const pct = Math.min(1, Math.max(0, RECAUDADO / CHALLENGE_TARGET))
  const pctTxt = `${(pct * 100).toFixed(1).replace(".", ",")} %`

  const fondo = g.createLinearGradient(0, 0, 0, H)
  fondo.addColorStop(0, "#071a33")
  fondo.addColorStop(1, "#02070f")
  g.fillStyle = fondo
  g.fillRect(0, 0, W, H)
  const halo = g.createRadialGradient(W * 0.3, H * 0.55, 10, W * 0.3, H * 0.55, W * 0.45)
  halo.addColorStop(0, "rgba(54,211,255,0.16)")
  halo.addColorStop(1, "rgba(54,211,255,0)")
  g.fillStyle = halo
  g.fillRect(0, 0, W, H)

  g.textBaseline = "alphabetic"
  g.font = `800 26px ${FUENTE}`
  g.fillStyle = "#8fd8ff"
  g.textAlign = "left"
  g.fillText("LA CASA BLANCA PROJECT · SALA DE CONTROL", 44, 50)
  g.textAlign = "right"
  g.fillText(reloj, W - 44, 50)
  g.fillStyle = "rgba(143,216,255,0.35)"
  g.fillRect(44, 64, W - 88, 2)

  // A la izquierda: el contador.
  const IZQ = 44
  const ANCHO_IZQ = 820
  g.textAlign = "left"
  g.font = `800 36px ${FUENTE}`
  g.fillStyle = "#ffffff"
  g.fillText("DE $10 A UN MERCEDES", IZQ, 122)
  g.font = `900 124px ${FUENTE}`
  const wM = g.measureText(monto).width
  g.lineJoin = "round"
  g.lineWidth = 12
  g.strokeStyle = "#0b2a12"
  g.strokeText(monto, IZQ, 250)
  g.fillStyle = "#6fe08a"
  g.fillText(monto, IZQ, 250)
  g.font = `800 56px ${FUENTE}`
  g.fillStyle = "#e9f1ff"
  g.fillText(` / ${meta}`, IZQ + wM, 250)
  const by = 290
  g.fillStyle = "rgba(255,255,255,0.12)"
  g.beginPath()
  g.roundRect(IZQ, by, ANCHO_IZQ - 170, 24, 12)
  g.fill()
  const gr = g.createLinearGradient(IZQ, 0, IZQ + ANCHO_IZQ, 0)
  gr.addColorStop(0, "#3ddc84")
  gr.addColorStop(1, "#7cf0b0")
  g.fillStyle = gr
  g.beginPath()
  g.roundRect(IZQ, by, Math.max(24, (ANCHO_IZQ - 170) * pct), 24, 12)
  g.fill()
  g.font = `800 32px ${FUENTE}`
  g.textAlign = "right"
  g.fillStyle = "#ffffff"
  g.fillText(pctTxt, IZQ + ANCHO_IZQ, by + 24)
  g.textAlign = "left"
  g.font = `700 28px ${FUENTE}`
  g.fillStyle = "#9cc4ff"
  g.fillText(`DÍA ${diaDelReto()} DEL RETO`, IZQ, 362)

  // A la derecha: el plano de la instalación (los lugares del mapa, a escala).
  const X0 = 920
  const X1 = W - 44
  const Z0 = 84
  const Z1 = H - 28
  g.strokeStyle = "rgba(143,216,255,0.3)"
  g.lineWidth = 2
  g.strokeRect(X0 - 12, Z0 - 8, X1 - X0 + 24, Z1 - Z0 + 16)
  const esc = Math.min((X1 - X0) / (CIU.z1 - CIU.z0), (Z1 - Z0) / (CIU.x1 - CIU.x0))
  // El plano va girado: el eje z del mundo corre a lo ancho de la pantalla.
  const px = (z: number) => X0 + (z - CIU.z0) * esc
  const py = (x: number) => Z0 + (x - CIU.x0) * esc
  for (const l of LUGARES) {
    if (l.nivel !== "ciudad") continue
    const x = px(l.z0)
    const y = py(l.x0)
    const w = (l.z1 - l.z0) * esc
    const h = (l.x1 - l.x0) * esc
    g.fillStyle = "rgba(54,211,255,0.12)"
    g.fillRect(x, y, w, h)
    g.strokeStyle = "rgba(54,211,255,0.7)"
    g.strokeRect(x, y, w, h)
  }
  // El ascensor: un punto que late.
  g.fillStyle = `rgba(255,176,32,${0.6 + 0.4 * Math.sin(barrido * Math.PI * 2)})`
  g.beginPath()
  g.arc(px(ASC.z), py(ASC.x), 6, 0, Math.PI * 2)
  g.fill()

  // Brillo que barre y retícula de los LED.
  const bx = -200 + barrido * (W + 400)
  const brilloG = g.createLinearGradient(bx - 120, 0, bx + 120, 0)
  brilloG.addColorStop(0, "rgba(255,255,255,0)")
  brilloG.addColorStop(0.5, "rgba(255,255,255,0.08)")
  brilloG.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = brilloG
  g.fillRect(0, 0, W, H)
  g.fillStyle = "rgba(0,0,0,0.2)"
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1)
}

interface Letrero {
  id: string
  texto: string
  /** Tamaño de la letra en píxeles del atlas. */
  px: number
  color: string
  flecha?: "izq" | "der" | "arriba"
}

/** Señalética propia: rótulos cortos, números de nivel y flechas. Sin logos. */
const LETREROS: Letrero[] = [
  { id: "anden", texto: "ANDÉN", px: 96, color: P.ambar },
  { id: "control", texto: "SALA DE CONTROL", px: 64, color: "#8fd8ff" },
  { id: "corredor", texto: "CORREDOR CENTRAL", px: 56, color: "#e9eef2" },
  { id: "labs", texto: "LABORATORIOS", px: 64, color: "#7fb2ff" },
  { id: "comedor", texto: "COMEDOR", px: 64, color: "#ffd9a8" },
  { id: "jardin", texto: "JARDÍN HIDROPÓNICO", px: 56, color: "#9be7a6" },
  { id: "camara", texto: "CÁMARA DE PRUEBAS", px: 56, color: "#e9eef2" },
  { id: "balcon", texto: "BALCÓN", px: 56, color: "#e9eef2" },
  { id: "ascensor", texto: "ASCENSOR", px: 48, color: "#e9eef2" },
  { id: "salida", texto: "SALIDA", px: 44, color: "#ff6a5f" },
  ...["-4", "-5", "-6", "-7"].map((t, i): Letrero => ({ id: `n${4 + i}`, texto: t, px: 180, color: "#e9eef2" })),
  ...[1, 2, 3, 4].map((i): Letrero => ({ id: `lab-${i}`, texto: `LAB 0${i}`, px: 48, color: "#cfe2ff" })),
  { id: "f-anden", texto: "ANDÉN", px: 52, color: P.ambar, flecha: "izq" },
  { id: "f-control", texto: "CONTROL", px: 52, color: "#ffffff", flecha: "izq" },
  { id: "f-labs", texto: "LABORATORIOS", px: 52, color: "#7fb2ff", flecha: "izq" },
  { id: "f-jardin", texto: "JARDÍN", px: 52, color: "#9be7a6", flecha: "der" },
  { id: "f-comedor", texto: "COMEDOR", px: 52, color: "#ffd9a8", flecha: "der" },
  { id: "f-camara", texto: "PRUEBAS", px: 52, color: "#ffffff", flecha: "arriba" },
]

interface Celda {
  u0: number
  v0: number
  u1: number
  v1: number
  /** Ancho / alto del letrero. */
  aspecto: number
}

const ATLAS_W = 1024
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
    const pad = Math.round(l.px * 0.4)
    const fw = l.flecha ? l.px * 1.1 : 0
    const w = Math.ceil(tw + pad * 2 + fw)
    const h = Math.ceil(l.px * 1.45)
    if (x + w > ATLAS_W) {
      x = 0
      y += fila + 4
      fila = 0
    }
    const base = y + h * 0.5 + l.px * 0.36
    const tx = l.flecha === "izq" ? x + pad + fw : x + pad
    g.textAlign = "left"
    g.textBaseline = "alphabetic"
    g.shadowColor = l.color
    g.shadowBlur = l.px * 0.08
    g.fillStyle = l.color
    g.fillText(l.texto, tx, base)
    g.shadowBlur = 0
    if (l.flecha) {
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
  /** Medio lado del emisor en x y en z. */
  rx: number
  rz: number
  n: number
  tam: number
  alto: number
  vel: number
  color: THREE.ColorRepresentation
  fuerza: number
}
interface Planta {
  x: number
  y: number
  z: number
  s: number
  color: string
}
/** Una compuerta blindada: dos hojas que se corren a lo largo de `eje`. */
interface Compuerta {
  x: number
  z: number
  eje: "x" | "z"
  ancho: number
  alto: number
  /** Espesor del muro donde va (las hojas se esconden dentro). */
  grosor: number
  abierta: number
}

/** Todo lo que los constructores van llenando. */
interface Kit {
  base: Lote
  techo: Lote
  oficinas: Lote
  luz: Lote
  vidrio: Lote
  esmerilado: Lote
  grilla: Lote
  chevron: Lote
  senal: Lote
  pantalla: Lote
  reflejos: Reflejo[]
  vapores: Vapor[]
  plantas: Planta[]
  compuertas: Compuerta[]
  balizas: THREE.Vector3[]
  celdas: Record<string, Celda>
}

interface Piezas {
  caja: THREE.BufferGeometry
  cil8: THREE.BufferGeometry
  cil16: THREE.BufferGeometry
  cil24: THREE.BufferGeometry
  esfera: THREE.BufferGeometry
  plano: THREE.BufferGeometry
  /** Una mata: bolitas deformadas, fusionadas (una instancia por planta). */
  mata: THREE.BufferGeometry
}

function crearPiezas(): Piezas {
  const rnd = semilla(5)
  const partes = Array.from({ length: 5 }, (_, i) => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 0).deleteAttribute("uv").deleteAttribute("normal"))
    const p = g.getAttribute("position") as THREE.BufferAttribute
    const a = (i / 5) * Math.PI * 2
    const ox = Math.cos(a) * 0.5
    const oz = Math.sin(a) * 0.5
    const r = 0.45 + rnd() * 0.2
    for (let j = 0; j < p.count; j++) p.setXYZ(j, ox + p.getX(j) * r, 0.35 + p.getY(j) * r * 0.8 + rnd() * 0.1, oz + p.getZ(j) * r)
    g.computeVertexNormals()
    return g
  })
  const mata = mergeGeometries(partes, false)!
  for (const g of partes) g.dispose()
  return {
    mata,
    caja: new THREE.BoxGeometry(1, 1, 1),
    cil8: new THREE.CylinderGeometry(1, 1, 1, 8),
    cil16: new THREE.CylinderGeometry(1, 1, 1, 16),
    cil24: new THREE.CylinderGeometry(1, 1, 1, 24),
    esfera: new THREE.SphereGeometry(1, 12, 8),
    plano: new THREE.PlaneGeometry(1, 1),
  }
}

/** Caja alineada a los ejes, por sus bordes. */
function caja(l: Lote, pz: Piezas, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, v: Valores = {}) {
  l.agregar(pz.caja, M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, x1 - x0, y1 - y0, z1 - z0), v)
}

/** Tubo recto entre dos puntos (para cañerías y barandas). */
function tubo(l: Lote, pz: Piezas, a: THREE.Vector3, b: THREE.Vector3, r: number, v: Valores = {}) {
  const d = new THREE.Vector3().subVectors(b, a)
  const largo = d.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(r, largo, r))
  l.agregar(pz.cil8, m, v)
}

/** Un letrero del atlas sobre una placa de grafito, mirando hacia `giro` (0 = +z). */
function letrero(k: Kit, pz: Piezas, id: string, x: number, y: number, z: number, giro: number, alto: number, placa = true) {
  const c = k.celdas[id]
  if (!c) return
  const g = pz.plano.clone()
  const uv = g.getAttribute("uv") as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? c.u0 : c.u1, uv.getY(i) < 0.5 ? c.v0 : c.v1)
  const nx = Math.sin(giro)
  const nz = Math.cos(giro)
  k.senal.agregar(g, M(x + nx * 0.07, y, z + nz * 0.07, giro, alto * c.aspecto, alto, 1))
  g.dispose()
  if (placa) k.base.agregar(pz.caja, M(x + nx * 0.02, y, z + nz * 0.02, giro, alto * c.aspecto + 0.16, alto + 0.12, 0.06), acabado(P.grafito, 0.5, 0.2))
}

interface Hueco {
  /** Desde y hasta, a lo largo del muro. */
  a: number
  b: number
  alto: number
}

/**
 * Muro (caja) a lo largo de `eje`, de `a0` a `a1`, con espesor `e0..e1` en el
 * otro eje, entre y0 e y1. Los huecos son puertas: dintel arriba y umbral de
 * acero abajo. Arriba lleva la "tapa de corte" oscura que se ve en la maqueta.
 */
function muro(k: Kit, pz: Piezas, eje: "x" | "z", a0: number, a1: number, e0: number, e1: number, y0: number, y1: number, huecos: Hueco[] = [], acab: Valores = A.panel) {
  const pon = (pa: number, pb: number, ya: number, yb: number, v: Valores) => {
    if (pb - pa < 1e-3 || yb - ya < 1e-3) return
    if (eje === "x") caja(k.base, pz, pa, pb, ya, yb, e0, e1, v)
    else caja(k.base, pz, e0, e1, ya, yb, pa, pb, v)
  }
  let cursor = a0
  for (const h of [...huecos].sort((p, q) => p.a - q.a)) {
    pon(cursor, h.a, y0, y1, acab)
    pon(h.a, h.b, y0 + h.alto, y1, acab)
    // Umbral de acero en el piso del hueco.
    pon(h.a, h.b, Y0 - 0.02, Y0 + 0.012, A.acero)
    cursor = h.b
  }
  pon(cursor, a1, y0, y1, acab)
  pon(a0, a1, y1, y1 + 0.02, A.muroCorte)
}

/** Vidrio plano de piso a techo, a lo largo de `eje` en la coordenada `fijo`. */
function vidrioPlano(k: Kit, pz: Piezas, eje: "x" | "z", fijo: number, a0: number, a1: number, y0: number, y1: number, lote: Lote = k.vidrio) {
  const largo = a1 - a0
  const m = eje === "x" ? M((a0 + a1) / 2, (y0 + y1) / 2, fijo, 0, largo, y1 - y0, 1) : M(fijo, (y0 + y1) / 2, (a0 + a1) / 2, Math.PI / 2, largo, y1 - y0, 1)
  lote.agregar(pz.plano, m)
}

/**
 * Tabique de vidrio con parantes de acero cada ~2,4 m, una franja esmerilada a
 * 1,4 m y puertas abiertas en los huecos.
 */
function tabiqueVidrio(k: Kit, pz: Piezas, eje: "x" | "z", fijo: number, a0: number, a1: number, alto: number, huecos: Array<[number, number]> = []) {
  const tramos: Array<[number, number]> = []
  let c = a0
  for (const [a, b] of [...huecos].sort((p, q) => p[0] - q[0])) {
    tramos.push([c, a])
    c = b
  }
  tramos.push([c, a1])
  const parante = (a: number) => {
    if (eje === "x") caja(k.base, pz, a - 0.05, a + 0.05, Y0, Y0 + alto, fijo - 0.06, fijo + 0.06, A.acero)
    else caja(k.base, pz, fijo - 0.06, fijo + 0.06, Y0, Y0 + alto, a - 0.05, a + 0.05, A.acero)
  }
  for (const [a, b] of tramos) {
    if (b - a < 0.05) continue
    vidrioPlano(k, pz, eje, fijo, a, b, Y0 + 0.08, Y0 + alto)
    vidrioPlano(k, pz, eje, fijo, a, b, Y0 + 1.25, Y0 + 1.55, k.esmerilado)
    const n = Math.max(1, Math.round((b - a) / 2.4))
    for (let i = 0; i <= n; i++) parante(a + ((b - a) * i) / n)
    // Zócalo y cabezal.
    if (eje === "x") {
      caja(k.base, pz, a, b, Y0, Y0 + 0.08, fijo - 0.07, fijo + 0.07, A.acero)
      caja(k.base, pz, a, b, Y0 + alto - 0.08, Y0 + alto, fijo - 0.07, fijo + 0.07, A.acero)
    } else {
      caja(k.base, pz, fijo - 0.07, fijo + 0.07, Y0, Y0 + 0.08, a, b, A.acero)
      caja(k.base, pz, fijo - 0.07, fijo + 0.07, Y0 + alto - 0.08, Y0 + alto, a, b, A.acero)
    }
  }
}

/** Techo de una sala (solo se ve desde abajo) con paneles de luz de 60 x 60 en grilla. */
function techoSala(k: Kit, pz: Piezas, s: Sala, acab: Valores, paso = 2.4, colorLuz: string = P.frio, fuerza = 2.4, turno = 1) {
  const y = Y0 + s.alto
  k.techo.agregar(horizontal(s, y, true), null, acab)
  for (let x = s.x0 + paso / 2; x < s.x1; x += paso)
    for (let z = s.z0 + paso / 2; z < s.z1; z += paso) k.luz.agregar(pz.plano, M(x, y - 0.015, z, 0, 0.6, 0.6, 1, Math.PI / 2), luz(colorLuz, fuerza, turno))
}

/** Línea de color en el piso (tira plana a 1 cm, con un leve brillo). */
function lineaPiso(k: Kit, pz: Piezas, puntos: V2[], color: string) {
  for (let i = 0; i + 1 < puntos.length; i++) {
    const [ax, az] = puntos[i]
    const [bx, bz] = puntos[i + 1]
    const largo = Math.hypot(bx - ax, bz - az)
    k.base.agregar(pz.caja, M((ax + bx) / 2, Y0 + 0.006, (az + bz) / 2, Math.atan2(bx - ax, bz - az), 0.14, 0.012, largo + 0.14), acabado(color, 0.4, 0, 0, color, 0.35))
  }
}

// ── 6.1 El pozo: planta baja, galerías, oficinas, foso, balcón y ascensores ──

function construirPozo(k: Kit, pz: Piezas) {
  const X = new THREE.Vector3(1, 0, 0)
  const Zv = new THREE.Vector3(0, 0, 1)
  // Piso de epoxi alrededor del foso, y el foso con piso de vidrio.
  for (const r of [
    { x0: POZO.x0, x1: POZO.x1, z0: FOSO.z1, z1: POZO.z1 },
    { x0: POZO.x0, x1: FOSO.x0, z0: POZO.z0, z1: FOSO.z1 },
    { x0: FOSO.x1, x1: POZO.x1, z0: POZO.z0, z1: FOSO.z1 },
    { x0: FOSO.x0, x1: FOSO.x1, z0: POZO.z0, z1: FOSO.z0 },
  ])
    k.base.agregar(horizontal(r, Y0), null, A.epoxi)
  k.vidrio.agregar(horizontal(FOSO, Y0 + 0.01))
  for (const z of [15.5, 17.5]) caja(k.base, pz, FOSO.x0, FOSO.x1, Y0 - 0.22, Y0 - 0.01, z - 0.06, z + 0.06, A.acero)
  for (const x of [-4, 0, 4]) caja(k.base, pz, x - 0.06, x + 0.06, Y0 - 0.22, Y0 - 0.01, FOSO.z0, FOSO.z1, A.acero)
  // El foso: las oficinas siguen dos pisos más abajo, con su propia luz.
  for (const g of carasInteriores(FOSO, Y0 - FOSO.fondo, Y0, Y0 - FOSO.fondo)) k.oficinas.agregar(g)
  k.base.agregar(horizontal(FOSO, Y0 - FOSO.fondo), null, A.grafitoPiso)
  k.luz.agregar(pz.caja, M(0, Y0 - FOSO.fondo + 0.02, cz(FOSO), 0, 12, 0.02, 0.12), luz(P.cian, 3, 0))
  for (let y = Y0 - 4; y > Y0 - FOSO.fondo; y -= 4)
    for (const [a, b, c2, d] of [
      [FOSO.x0, FOSO.z0, FOSO.x1, FOSO.z0],
      [FOSO.x0, FOSO.z1, FOSO.x1, FOSO.z1],
    ])
      k.luz.agregar(pz.caja, M((a + c2) / 2, y, (b + d) / 2, 0, c2 - a, 0.05, 0.08), luz(P.frio, 2.2))
  k.vapores.push({ x: 0, y: Y0 - FOSO.fondo + 0.5, z: cz(FOSO), rx: 6, rz: 2, n: 18, tam: 3, alto: 6, vel: 0.05, color: "#bfe8ff", fuerza: 0.1 })

  // Muros de la planta baja (los del andén, la sala de control y el corredor los ponen ellos).
  const yPB = Y0 + PB
  // Las cuatro caras de oficinas, de la primera galería a la boca del pozo.
  for (const g of carasInteriores(POZO, yPB, Y0 + GALERIAS[0], Y0)) k.base.agregar(g, null, A.panel)
  for (const g of carasInteriores(POZO, Y0 + GALERIAS[0], TOPE, Y0)) k.oficinas.agregar(g)
  // Franja de luz al pie de las oficinas y en la boca.
  for (const y of [yPB + 0.1, TOPE - 0.4]) {
    k.luz.agregar(cara(POZO.x0, POZO.z0 + 0.03, POZO.x1, POZO.z0 + 0.03, y, y + 0.12, Zv), null, luz(P.frio, 2.6))
    k.luz.agregar(cara(POZO.x0, POZO.z1 - 0.03, POZO.x1, POZO.z1 - 0.03, y, y + 0.12, Zv.clone().negate()), null, luz(P.frio, 2.6))
    k.luz.agregar(cara(POZO.x0 + 0.03, POZO.z0, POZO.x0 + 0.03, POZO.z1, y, y + 0.12, X), null, luz(P.frio, 2.6))
    k.luz.agregar(cara(POZO.x1 - 0.03, POZO.z0, POZO.x1 - 0.03, POZO.z1, y, y + 0.12, X.clone().negate()), null, luz(P.frio, 2.6))
  }

  // Galerías: losas de 2,5 m alrededor del vacío, baranda de vidrio y luz en el canto.
  const anillo: Rect[] = [
    { x0: POZO.x0, x1: POZO.x1, z0: POZO.z0, z1: VACIO.z0 },
    { x0: POZO.x0, x1: POZO.x1, z0: VACIO.z1, z1: POZO.z1 },
    { x0: POZO.x0, x1: VACIO.x0, z0: VACIO.z0, z1: VACIO.z1 },
    { x0: VACIO.x1, x1: POZO.x1, z0: VACIO.z0, z1: VACIO.z1 },
  ]
  const nombres = ["n6", "n5", "n4"]
  GALERIAS.forEach((h, i) => {
    const y = Y0 + h
    for (const r of anillo) {
      caja(k.base, pz, r.x0, r.x1, y - 0.4, y, r.z0, r.z1, acabado("#dfe5ea", 0.5, 0, 1.2))
      k.base.agregar(horizontal(r, y + 0.003), null, A.epoxi)
    }
    // Canto de luz bajo la losa, del lado del vacío.
    const borde: Array<[number, number, number, number]> = [
      [VACIO.x0, VACIO.z0, VACIO.x1, VACIO.z0],
      [VACIO.x0, VACIO.z1, VACIO.x1, VACIO.z1],
      [VACIO.x0, VACIO.z0, VACIO.x0, VACIO.z1],
      [VACIO.x1, VACIO.z0, VACIO.x1, VACIO.z1],
    ]
    for (const [ax, az, bx, bz] of borde) {
      const largo = Math.hypot(bx - ax, bz - az)
      const giro = ax === bx ? Math.PI / 2 : 0
      k.luz.agregar(pz.caja, M((ax + bx) / 2, y - 0.42, (az + bz) / 2, giro, largo, 0.04, 0.12), luz(P.frio, 3.4))
      // Baranda: vidrio y pasamanos (con paso libre hacia los puentes del ascensor en la galería norte).
      const tramos: Array<[number, number]> = az === bz && az === VACIO.z0 ? [[ax, -ELEV.dx - ELEV.medio], [-ELEV.dx + ELEV.medio, ELEV.dx - ELEV.medio], [ELEV.dx + ELEV.medio, bx]] : [[ax === bx ? az : ax, ax === bx ? bz : bx]]
      for (const [a, b] of tramos) {
        if (b - a < 0.1) continue
        if (ax === bx) {
          vidrioPlano(k, pz, "z", ax, a, b, y, y + 1.05)
          tubo(k.base, pz, new THREE.Vector3(ax, y + 1.08, a), new THREE.Vector3(ax, y + 1.08, b), 0.03, A.acero)
        } else {
          vidrioPlano(k, pz, "x", az, a, b, y, y + 1.05)
          tubo(k.base, pz, new THREE.Vector3(a, y + 1.08, az), new THREE.Vector3(b, y + 1.08, az), 0.03, A.acero)
        }
      }
    }
    // Puentes de la galería norte a cada ascensor.
    for (const s of [-1, 1]) {
      const x = s * ELEV.dx
      caja(k.base, pz, x - ELEV.medio + 0.1, x + ELEV.medio - 0.1, y - 0.3, y, VACIO.z0, ASC.z - ELEV.medio, acabado("#dfe5ea", 0.5, 0, 1.2))
      for (const sx of [-1, 1]) vidrioPlano(k, pz, "z", x + sx * (ELEV.medio - 0.12), VACIO.z0, ASC.z - ELEV.medio, y, y + 1.05)
    }
    // El número del nivel en el muro, sobre la galería, en las caras norte y sur.
    letrero(k, pz, nombres[i], -6.5, y + 2.6, POZO.z1 - 0.05, Math.PI, 1.3)
    letrero(k, pz, nombres[i], 6.5, y + 2.6, POZO.z0 + 0.05, 0, 1.3)
  })
  letrero(k, pz, "n7", -6.5, Y0 + 4.9, POZO.z1 - 0.05, Math.PI, 1.3)

  // La boca del pozo: un cielo raso oscuro con paneles de luz y cañerías.
  k.techo.agregar(horizontal(POZO, TOPE, true), null, A.grafito)
  for (let x = POZO.x0 + 2; x < POZO.x1; x += 4)
    for (let z = POZO.z0 + 2; z < POZO.z1; z += 4) k.luz.agregar(pz.plano, M(x, TOPE - 0.02, z, 0, 1.2, 1.2, 1, Math.PI / 2), luz(P.frio, 3.2))
  for (const z of [16, 28, 40]) tubo(k.base, pz, new THREE.Vector3(POZO.x0, TOPE - 0.7, z), new THREE.Vector3(POZO.x1, TOPE - 0.7, z), 0.3, A.aceroOsc)
  for (const x of [-8.6, 8.6]) caja(k.base, pz, x - 0.4, x + 0.4, TOPE - 1.3, TOPE - 1.2, POZO.z0, POZO.z1, A.acero)

  // Muros de la planta baja: norte (detrás del balcón).
  muro(k, pz, "x", POZO.x0, POZO.x1, POZO.z0 - 1, POZO.z0, Y0, yPB)
  k.luz.agregar(pz.caja, M(0, Y0 + 3.4, POZO.z0 + 0.03, 0, 16, 0.08, 0.04), luz(P.frio, 2.4))
  letrero(k, pz, "balcon", 0, Y0 + 4.4, POZO.z0 + 0.05, 0, 0.6)
  // Sur: la compuerta al corredor (el muro es más alto que el corredor: cierra el pozo).
  muro(k, pz, "x", POZO.x0, POZO.x1, POZO.z1, CORREDOR.z0, Y0, yPB, [{ a: -2.1, b: 2.1, alto: 4.2 }])
  k.compuertas.push({ x: 0, z: POZO.z1 + 1, eje: "x", ancho: 4.2, alto: 4.2, grosor: 2, abierta: 0 })
  letrero(k, pz, "corredor", 0, Y0 + 5.1, POZO.z1 - 0.05, Math.PI, 0.5)
  // Las tiras de color que salen del ascensor hacia cada puerta.
  lineaPiso(k, pz, [[-1.2, 26], [-1.2, 32], [-12.5, 32]], P.ambar)
  lineaPiso(k, pz, [[1.2, 26], [1.2, 30.3], [12, 30.3]], "#e9eef2")
  lineaPiso(k, pz, [[-0.6, 26], [-0.6, 56.4], [-6, 56.4]], P.azul)
  lineaPiso(k, pz, [[0.6, 26], [0.6, 76.2], [7, 76.2]], P.verde)
  // Bancos de acero contra los muros, fuera del paso.
  for (const z of [27, 39]) {
    caja(k.base, pz, POZO.x0 + 0.2, POZO.x0 + 0.7, Y0 + 0.42, Y0 + 0.47, z - 1.5, z + 1.5, A.blanco)
    caja(k.base, pz, POZO.x0 + 0.25, POZO.x0 + 0.65, Y0, Y0 + 0.42, z - 1.3, z + 1.3, A.aceroOsc)
  }
  k.reflejos.push({ x: 0, z: POZO.z0 + 0.2, h: 3.4, color: P.frio, fuerza: 0.5, ancho: 6 })
}

interface Cabinas {
  cuerpo: THREE.InstancedMesh
  vidrio: THREE.InstancedMesh
  arriba: number
}

function construirAscensores(k: Kit, pz: Piezas, mats: MaterialesCiudad, sombras: boolean): Cabinas {
  const m = ELEV.medio
  for (const s of [-1, 1]) {
    const x = ASC.x + s * ELEV.dx
    const z = ASC.z
    // Caja de vidrio de punta a punta del pozo, aristas de acero y marcos en cada galería.
    vidrioPlano(k, pz, "x", z - m, x - m, x + m, Y0, TOPE)
    vidrioPlano(k, pz, "x", z + m, x - m, x + m, Y0 + 2.6, TOPE)
    vidrioPlano(k, pz, "z", x - m, z - m, z + m, Y0, TOPE)
    vidrioPlano(k, pz, "z", x + m, z - m, z + m, Y0, TOPE)
    for (const [ex, ez] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      caja(k.base, pz, x + ex * m - 0.07, x + ex * m + 0.07, Y0, TOPE, z + ez * m - 0.07, z + ez * m + 0.07, A.acero)
    for (const h of [0, 2.6, ...GALERIAS, TOPE - Y0 - 0.2]) {
      const y = Y0 + h
      caja(k.base, pz, x - m - 0.06, x + m + 0.06, y - 0.08, y + 0.08, z - m - 0.06, z - m + 0.06, A.acero)
      caja(k.base, pz, x - m - 0.06, x + m + 0.06, y - 0.08, y + 0.08, z + m - 0.06, z + m + 0.06, A.acero)
      caja(k.base, pz, x - m - 0.06, x - m + 0.06, y - 0.08, y + 0.08, z - m, z + m, A.acero)
      caja(k.base, pz, x + m - 0.06, x + m + 0.06, y - 0.08, y + 0.08, z - m, z + m, A.acero)
    }
    // Puerta de abajo (lado sur, hacia el atrio) y su luz.
    k.luz.agregar(pz.caja, M(x, Y0 + 2.75, z + m + 0.05, 0, 2.2, 0.05, 0.05), luz(P.cian, 3, 0))
    // Rieles de la cabina.
    for (const sx of [-1, 1]) caja(k.base, pz, x + sx * (m - 0.12) - 0.04, x + sx * (m - 0.12) + 0.04, Y0, TOPE, z - m + 0.05, z - m + 0.2, A.acero)
    k.reflejos.push({ x, z: z + m + 0.2, h: 2.6, color: P.cian, fuerza: 0.6, ancho: 2 })
  }
  letrero(k, pz, "ascensor", ASC.x, Y0 + 3.3, ASC.z + m + 0.12, 0, 0.42)

  // La cabina: piso y techo de acero con un panel de luz, y vidrio alrededor.
  const cab = new Lote(PBR)
  const ci = m - 0.2
  cab.agregar(pz.caja, M(0, 0.06, 0, 0, ci * 2, 0.12, ci * 2), A.acero)
  cab.agregar(pz.caja, M(0, 2.54, 0, 0, ci * 2, 0.12, ci * 2), A.acero)
  cab.agregar(pz.caja, M(0, 2.47, 0, 0, ci * 1.6, 0.02, ci * 1.6), acabado("#ffffff", 0.5, 0, 0, P.frio, 3.5))
  cab.agregar(pz.caja, M(0, 1.0, -ci + 0.05, 0, ci * 1.6, 0.05, 0.08), A.acero)
  const geoCab = cab.geometria()!
  const vid = new Lote()
  for (const [a, b, c2, d] of [
    [-ci, -ci, ci, -ci],
    [-ci, ci, ci, ci],
    [-ci, -ci, -ci, ci],
    [ci, -ci, ci, ci],
  ])
    vid.agregar(cara(a, b, c2, d, 0.12, 2.48, new THREE.Vector3(b === d ? 0 : 1, 0, b === d ? 1 : 0)))
  const geoVid = vid.geometria()!
  const cuerpo = new THREE.InstancedMesh(geoCab, mats.base, 2)
  cuerpo.name = "ciudad-cabinas"
  cuerpo.castShadow = sombras
  const vidrio = new THREE.InstancedMesh(geoVid, mats.vidrio, 2)
  vidrio.name = "ciudad-cabinas-vidrio"
  vidrio.renderOrder = 3
  for (const im of [cuerpo, vidrio]) im.frustumCulled = false
  return { cuerpo, vidrio, arriba: TOPE - 3.2 }
}

// ── 6.2 El andén del tren ──

function construirAnden(k: Kit, pz: Piezas) {
  const S = ANDEN
  const yT = Y0 + S.alto
  const lecho = Y0 - VIA.hondo
  // Piso del andén, el lecho de la vía y el borde de seguridad.
  k.base.agregar(horizontal({ x0: VIA.x1, x1: S.x1, z0: S.z0, z1: S.z1 }, Y0), null, A.concreto)
  k.base.agregar(cara(VIA.x1, S.z0, VIA.x1, S.z1, lecho, Y0, new THREE.Vector3(-1, 0, 0)), null, A.concreto)
  k.base.agregar(horizontal({ x0: S.x0, x1: VIA.x1, z0: S.z0, z1: S.z1 }, lecho), null, A.concretoOsc)
  caja(k.base, pz, VIA.x1, VIA.x1 + 0.55, Y0, Y0 + 0.012, S.z0, S.z1, acabado(P.amarillo, 0.6, 0))
  // Rieles y durmientes, también dentro del túnel.
  for (const s of [-1, 1]) caja(k.base, pz, VIA.x + s * 0.72 - 0.04, VIA.x + s * 0.72 + 0.04, lecho + 0.16, lecho + 0.3, TUNEL.z1, VIA.tope, A.acero)
  for (let z = TUNEL.z1 + 0.4; z < VIA.tope; z += 0.9) caja(k.base, pz, VIA.x - 1.2, VIA.x + 1.2, lecho, lecho + 0.16, z - 0.12, z + 0.12, acabado("#3b3f44", 0.9, 0))
  // Tope al final de la vía, con chevrones y luces rojas.
  caja(k.chevron, pz, VIA.x - 1.4, VIA.x + 1.4, lecho, lecho + 1.6, VIA.tope, VIA.tope + 0.6)
  for (const s of [-1, 1]) k.luz.agregar(pz.esfera, M(VIA.x + s * 0.9, lecho + 1.75, VIA.tope + 0.1, 0, 0.09, 0.09, 0.09), luz(P.rojo, 6, 0, 2.5))
  k.balizas.push(new THREE.Vector3(VIA.x, lecho + 1.9, VIA.tope + 0.3))

  // Muros: norte (con la boca del túnel), oeste y sur. El del este lo comparte con el pozo.
  const N0 = POZO.z0 - 1
  // Norte: de x0 a x1 de toda la instalación (también cierra la sala de control).
  const hx0 = TUNEL.x - TUNEL.radio - 0.25
  const hx1 = TUNEL.x + TUNEL.radio + 0.25
  const hy0 = TUNEL.y - TUNEL.radio - 0.25
  const hy1 = TUNEL.y + TUNEL.radio + 0.25
  muro(k, pz, "x", S.x0, hx0, N0, POZO.z0, lecho, yT, [], A.concreto)
  muro(k, pz, "x", hx0, hx1, N0, POZO.z0, hy1, yT, [], A.concreto)
  muro(k, pz, "x", hx1, POZO.x0, N0, POZO.z0, lecho, yT, [], A.concreto)
  // Las esquinas de la boca: un marco con agujero redondo.
  {
    const forma = new THREE.Shape()
    forma.moveTo(hx0, hy0)
    forma.lineTo(hx1, hy0)
    forma.lineTo(hx1, hy1)
    forma.lineTo(hx0, hy1)
    forma.closePath()
    const agujero = new THREE.Path()
    agujero.absarc(TUNEL.x, TUNEL.y, TUNEL.radio - 0.05, 0, Math.PI * 2, false)
    forma.holes.push(agujero)
    const g = new THREE.ShapeGeometry(forma, 24)
    g.translate(0, 0, POZO.z0 + 0.01)
    k.base.agregar(g, null, A.concreto)
    g.dispose()
    const marco = new THREE.TorusGeometry(TUNEL.radio, 0.18, 6, 40)
    k.base.agregar(marco, M(TUNEL.x, TUNEL.y, POZO.z0 + 0.1), A.aceroOsc)
    marco.dispose()
  }
  muro(k, pz, "z", N0, POZO.z1 + 2, CIU.x0, S.x0, lecho, yT, [], A.concreto)
  muro(k, pz, "x", S.x0, POZO.x0, POZO.z1, POZO.z1 + 2, Y0, yT, [], A.concreto)
  // Este: el muro grueso entre el andén y el pozo, con la compuerta.
  muro(k, pz, "z", POZO.z0, POZO.z1, S.x1, POZO.x0, Y0, yT, [{ a: 30, b: 34, alto: 4.2 }], A.concreto)
  k.compuertas.push({ x: (S.x1 + POZO.x0) / 2, z: 32, eje: "z", ancho: 4, alto: 4.2, grosor: 2, abierta: 0 })
  // Del lado del atrio, el mismo muro lleva los paneles blancos del pozo.
  const Xp = new THREE.Vector3(1, 0, 0)
  for (const [a, b, y0, y1] of [
    [POZO.z0, 30, Y0, Y0 + PB],
    [34, POZO.z1, Y0, Y0 + PB],
    [30, 34, Y0 + 4.2, Y0 + PB],
  ])
    k.base.agregar(cara(POZO.x0 + 0.004, a, POZO.x0 + 0.004, b, y0, y1, Xp), null, A.panel)
  letrero(k, pz, "f-anden", POZO.x0 + 0.05, Y0 + 5.0, 32, Math.PI / 2, 0.5)
  letrero(k, pz, "anden", S.x1 - 0.05, Y0 + 5.2, 22, -Math.PI / 2, 0.9)

  // El túnel: un tubo que se pierde en la niebla, con anillos de luz cada 6 m.
  {
    const largo = TUNEL.z0 - TUNEL.z1
    const g = invertir(new THREE.CylinderGeometry(TUNEL.radio, TUNEL.radio, largo, 28, 1, true))
    k.base.agregar(g, M(TUNEL.x, TUNEL.y, (TUNEL.z0 + TUNEL.z1) / 2, 0, 1, 1, 1, Math.PI / 2), A.concreto)
    g.dispose()
    const aro = new THREE.TorusGeometry(TUNEL.radio - 0.08, 0.05, 4, 32)
    for (let z = TUNEL.z0 - 3; z > TUNEL.z1; z -= 6) k.luz.agregar(aro, M(TUNEL.x, TUNEL.y, z), luz(P.frio, 3.6, 0.6))
    aro.dispose()
  }

  // Techo de concreto con vigas, bandejas de cables y cañerías.
  k.techo.agregar(horizontal(S, yT, true), null, A.concreto)
  for (let z = S.z0 + 2; z < S.z1; z += 4) caja(k.techo, pz, S.x0, S.x1, yT - 0.55, yT, z - 0.25, z + 0.25, A.concreto)
  for (const x of [-30.5, -14.2]) {
    caja(k.base, pz, x - 0.3, x + 0.3, yT - 0.95, yT - 0.88, S.z0, S.z1, A.acero)
    caja(k.base, pz, x - 0.3, x - 0.27, yT - 0.95, yT - 0.8, S.z0, S.z1, A.acero)
    caja(k.base, pz, x + 0.27, x + 0.3, yT - 0.95, yT - 0.8, S.z0, S.z1, A.acero)
  }
  const tuberias: Array<[number, number, number, string]> = [
    [S.x0 + 0.5, yT - 1.5, 0.32, "#6f7880"],
    [S.x0 + 1.3, yT - 1.4, 0.2, "#8c969f"],
    [S.x1 - 0.5, yT - 1.6, 0.26, "#6f7880"],
    [S.x1 - 1.2, yT - 1.45, 0.16, "#b7834a"],
  ]
  for (const [x, y, r, c] of tuberias) {
    tubo(k.base, pz, new THREE.Vector3(x, y, S.z0), new THREE.Vector3(x, y, S.z1), r, acabado(c, 0.4, 0.7))
    for (let z = S.z0 + 3; z < S.z1; z += 6) caja(k.base, pz, x - r - 0.05, x + r + 0.05, y + r, yT - 0.55, z - 0.04, z + 0.04, A.aceroOsc)
  }
  // Luminarias lineales sobre el andén y la vía.
  for (const x of [-24, -18]) {
    k.luz.agregar(pz.caja, M(x, yT - 0.62, cz(S), 0, 0.18, 0.04, S.z1 - S.z0 - 4), luz(P.frio, 3.2))
    for (let z = S.z0 + 5; z < S.z1; z += 7) k.reflejos.push({ x, z, h: S.alto - 0.6, color: P.frio, fuerza: 0.35, ancho: 1.2 })
  }
  k.luz.agregar(pz.caja, M(VIA.x, yT - 0.62, cz(S), 0, 0.18, 0.04, S.z1 - S.z0 - 4), luz(P.frio, 2))
  // Bancos contra el muro del pozo y una franja roja de salida, baja.
  for (const z of [18, 26, 38]) {
    caja(k.base, pz, S.x1 - 0.65, S.x1 - 0.15, Y0 + 0.42, Y0 + 0.47, z - 1.4, z + 1.4, acabado(P.acero, 0.4, 0.7))
    caja(k.base, pz, S.x1 - 0.6, S.x1 - 0.2, Y0, Y0 + 0.42, z - 1.2, z + 1.2, A.aceroOsc)
  }
  k.luz.agregar(pz.caja, M(S.x1 - 0.03, Y0 + 0.25, 41.5, 0, 0.04, 0.05, 3), luz(P.rojo, 2.4, 0))
  letrero(k, pz, "salida", S.x1 - 0.05, Y0 + 2.6, 41.5, -Math.PI / 2, 0.3)
}

interface Tren {
  coches: THREE.InstancedMesh
  puertas: THREE.InstancedMesh
  /** Largo de un coche y separación entre coches. */
  largo: number
  paso: number
}

function construirTren(mats: MaterialesCiudad, pz: Piezas, sombras: boolean): Tren {
  const largo = 10.6
  const r = 1.35
  const cuerpo = new Lote(PBR)
  // Aluminio cepillado, nariz redondeada, franja de ventanas con luz blanca azulada.
  const cap = new THREE.CapsuleGeometry(r, largo - 2 * r, 6, 16)
  cap.rotateX(Math.PI / 2)
  cuerpo.agregar(cap, M(0, 0, 0, 0, 1, 1.1, 1), acabado("#c5ccd2", 0.3, 0.85))
  cap.dispose()
  for (const s of [-1, 1]) {
    cuerpo.agregar(pz.caja, M(s * (r - 0.02), 0.45, 0, 0, 0.08, 0.7, largo - 3.4), acabado("#0d1216", 0.1, 0.4, 0, "#dbe9ff", 0.75))
    cuerpo.agregar(pz.caja, M(s * (r - 0.05), -0.35, 0, 0, 0.06, 0.08, largo - 3), acabado(P.cian, 0.3, 0, 0, P.cian, 2.5))
  }
  cuerpo.agregar(pz.caja, M(0, -1.35, 0, 0, 2.0, 0.3, largo - 2.6), A.aceroOsc)
  // Bogies sobre los rieles.
  for (const s of [-1, 1]) cuerpo.agregar(pz.caja, M(0, -1.75, s * (largo / 2 - 2.2), 0, 1.9, 0.5, 2.4), acabado("#2b3036", 0.6, 0.6))
  // Parabrisas delante y detrás.
  for (const s of [-1, 1]) cuerpo.agregar(pz.esfera, M(0, 0.5, s * (largo / 2 - 0.55), 0, 0.85, 0.42, 0.5), acabado("#0d1216", 0.08, 0.5, 0, "#9fc3ff", 0.6))
  const coches = new THREE.InstancedMesh(cuerpo.geometria()!, mats.base, 2)
  coches.name = "ciudad-tren"
  coches.castShadow = sombras
  coches.frustumCulled = false
  const hoja = new Lote(PBR)
  hoja.agregar(pz.caja, M(0, 0, 0, 0, 0.06, 2.1, 0.75), acabado("#d3d9de", 0.3, 0.85))
  hoja.agregar(pz.caja, M(0.02, 0.35, 0, 0, 0.04, 0.9, 0.5), acabado("#0d1216", 0.1, 0.4, 0, "#dbe9ff", 0.7))
  const puertas = new THREE.InstancedMesh(hoja.geometria()!, mats.base, 8)
  puertas.name = "ciudad-tren-puertas"
  puertas.frustumCulled = false
  return { coches, puertas, largo, paso: largo + 0.7 }
}

// ── 6.3 La sala de control: pantalla curva y núcleo de IA ──

function construirControl(k: Kit, pz: Piezas) {
  const S = CONTROL
  const yT = Y0 + S.alto
  k.base.agregar(horizontal(S, Y0), null, A.grafitoPiso)
  // Pared de vidrio hacia el atrio (con la puerta) y los muros de grafito.
  tabiqueVidrio(k, pz, "z", S.x0, S.z0, S.z1, S.alto, [[28.3, 32.3]])
  muro(k, pz, "x", S.x0, CIU.x1, S.z0 - 1, S.z0, Y0, yT, [], A.grafito)
  muro(k, pz, "z", S.z0 - 1, S.z1 + 1, S.x1, CIU.x1, Y0, yT, [], A.grafito)
  muro(k, pz, "x", POZO.x1 + 0.6, S.x1, S.z1, S.z1 + 1, Y0, yT, [], A.grafito)
  // El tramo del pozo entre la sala y el corredor.
  muro(k, pz, "z", S.z1, POZO.z1 + 2, POZO.x1, POZO.x1 + 0.6, Y0, Y0 + PB)
  letrero(k, pz, "f-control", POZO.x1 - 0.05, Y0 + 4.6, 42.2, -Math.PI / 2, 0.42)
  letrero(k, pz, "control", S.x0 + 0.1, Y0 + 5.6, 21, -Math.PI / 2, 0.55)
  // Techo de grafito con tiras azules.
  k.techo.agregar(horizontal(S, yT, true), null, A.grafito)
  for (let z = S.z0 + 2; z < S.z1; z += 3) k.luz.agregar(pz.caja, M(cx(S), yT - 0.03, z, 0, S.x1 - S.x0 - 3, 0.03, 0.08), luz(P.azul, 2.6, 0))

  // La pantalla: un tramo de cilindro, cóncavo hacia el núcleo.
  {
    const pos: number[] = []
    const nor: number[] = []
    const uv: number[] = []
    const N = 32
    for (let i = 0; i < N; i++) {
      const t0 = i / N
      const t1 = (i + 1) / N
      const a0 = THREE.MathUtils.lerp(-PANTALLA.ang, PANTALLA.ang, t0)
      const a1 = THREE.MathUtils.lerp(-PANTALLA.ang, PANTALLA.ang, t1)
      const p = (a: number, y: number) => new THREE.Vector3(NUCLEO.x + Math.cos(a) * PANTALLA.radio, y, NUCLEO.z + Math.sin(a) * PANTALLA.radio)
      const n = new THREE.Vector3(-Math.cos((a0 + a1) / 2), 0, -Math.sin((a0 + a1) / 2))
      tri(pos, nor, uv, p(a0, PANTALLA.y0), p(a1, PANTALLA.y0), p(a1, PANTALLA.y1), n, [t0, 0], [t1, 0], [t1, 1])
      tri(pos, nor, uv, p(a0, PANTALLA.y0), p(a1, PANTALLA.y1), p(a0, PANTALLA.y1), n, [t0, 0], [t1, 1], [t0, 1])
    }
    k.pantalla.agregar(geometria(pos, nor, uv))
    // Marco y la luz que la pantalla deja en el piso.
    for (const y of [PANTALLA.y0 - 0.12, PANTALLA.y1 + 0.12]) {
      const arco = new THREE.TorusGeometry(PANTALLA.radio + 0.05, 0.1, 4, 40, PANTALLA.ang * 2)
      arco.rotateX(Math.PI / 2)
      arco.rotateY(PANTALLA.ang)
      k.base.agregar(arco, M(NUCLEO.x, y, NUCLEO.z), A.aceroOsc)
      arco.dispose()
    }
    for (let a = -0.6; a <= 0.61; a += 0.3) k.reflejos.push({ x: NUCLEO.x + Math.cos(a) * (PANTALLA.radio - 0.3), z: NUCLEO.z + Math.sin(a) * (PANTALLA.radio - 0.3), h: 4, color: "#4aa8ff", fuerza: 0.35, ancho: 3 })
  }

  // Escritorios en gradas: dos arcos frente a la pantalla, de espaldas al núcleo.
  const arcos: Array<[number, number, number]> = [
    [6.2, 0, 7],
    [9.2, 0.45, 9],
  ]
  for (const [r, sube, n] of arcos) {
    for (let i = 0; i < n; i++) {
      const a = THREE.MathUtils.lerp(-0.62, 0.62, n === 1 ? 0.5 : i / (n - 1))
      const x = NUCLEO.x + Math.cos(a) * r
      const z = NUCLEO.z + Math.sin(a) * r
      const giro = Math.PI / 2 - a
      const y = Y0 + sube
      if (sube > 0) k.base.agregar(pz.caja, M(x - Math.cos(a) * 0.4, Y0 + sube / 2, z - Math.sin(a) * 0.4, giro, 1.9, sube, 2.3), A.grafito)
      k.base.agregar(pz.caja, M(x, y + 0.74, z, giro, 1.7, 0.05, 0.75), acabado("#2a333b", 0.35, 0.3))
      k.base.agregar(pz.caja, M(x, y + 0.37, z + 0, giro, 1.6, 0.72, 0.6), A.grafito)
      // Dos monitores que miran al operador (hacia el núcleo).
      for (const s of [-0.42, 0.42]) {
        const mx = x + Math.cos(a) * 0.22 + Math.sin(a) * s
        const mz = z + Math.sin(a) * 0.22 - Math.cos(a) * s
        k.base.agregar(pz.caja, M(mx, y + 1.05, mz, giro, 0.62, 0.38, 0.03), acabado("#0b1015", 0.2, 0.3, 0, i % 3 ? P.cian : P.azul, 0.9))
      }
      // La silla, del lado del núcleo.
      const sx = x - Math.cos(a) * 0.75
      const sz = z - Math.sin(a) * 0.75
      k.base.agregar(pz.cil8, M(sx, y + 0.46, sz, 0, 0.26, 0.08, 0.26), A.grafito)
      k.base.agregar(pz.caja, M(sx - Math.cos(a) * 0.24, y + 0.8, sz - Math.sin(a) * 0.24, giro, 0.48, 0.6, 0.06), A.grafito)
      k.base.agregar(pz.cil8, M(sx, y + 0.22, sz, 0, 0.04, 0.44, 0.04), A.acero)
    }
  }
  // El núcleo de IA: un cilindro de vidrio con una columna de luz (los anillos se animan aparte).
  k.base.agregar(pz.cil24, M(NUCLEO.x, Y0 + 0.15, NUCLEO.z, 0, 1.6, 0.3, 1.6), A.grafito)
  k.luz.agregar(new THREE.TorusGeometry(1.55, 0.03, 4, 40).rotateX(Math.PI / 2), M(NUCLEO.x, Y0 + 0.31, NUCLEO.z), luz(P.cian, 3, 0))
  k.luz.agregar(pz.cil16, M(NUCLEO.x, Y0 + 3.3, NUCLEO.z, 0, 0.12, 5.8, 0.12), luz(P.cian, 4, 0, 1.3))
  {
    const g = new THREE.CylinderGeometry(0.8, 0.8, 6, 32, 1, true)
    k.vidrio.agregar(g, M(NUCLEO.x, Y0 + 3.3, NUCLEO.z))
    g.dispose()
  }
  k.base.agregar(pz.cil24, M(NUCLEO.x, Y0 + 6.45, NUCLEO.z, 0, 1.1, 0.3, 1.1), A.grafito)
  k.reflejos.push({ x: NUCLEO.x, z: NUCLEO.z, h: 3, color: P.cian, fuerza: 0.6, ancho: 1.5 })
}

// ── 6.4 El corredor blanco con el arco de escaneo ──

function construirCorredor(k: Kit, pz: Piezas) {
  const S = CORREDOR
  const yT = Y0 + S.alto
  k.base.agregar(horizontal(S, Y0), null, A.epoxi)
  k.base.agregar(horizontal({ x0: S.x0 - 1, x1: S.x0, z0: LABS.z0, z1: LABS.z1 }, Y0), null, A.epoxi)
  // Oeste: vidrio hacia los laboratorios, con dos puertas.
  tabiqueVidrio(k, pz, "z", S.x0 - 0.5, LABS.z0, LABS.z1, 3.0, [
    [54, 58],
    [86, 90],
  ])
  caja(k.base, pz, S.x0 - 1, S.x0, Y0 + 3.0, Y0 + LABS.alto, LABS.z0, LABS.z1, A.panel)
  caja(k.base, pz, S.x0 - 1, S.x0, Y0 + LABS.alto, Y0 + LABS.alto + 0.02, LABS.z0, LABS.z1, A.muroCorte)
  muro(k, pz, "z", S.z0, LABS.z0, S.x0 - 1, S.x0, Y0, Y0 + LABS.alto)
  muro(k, pz, "z", LABS.z1, S.z1, S.x0 - 1, S.x0, Y0, Y0 + LABS.alto)
  // Este: paneles blancos con las puertas del comedor y del jardín.
  muro(k, pz, "z", S.z0, S.z1, S.x1, S.x1 + 1, Y0, Y0 + COMEDOR.alto, [
    { a: 54.5, b: 58.5, alto: 3.2 },
    { a: 74, b: 78, alto: 3.2 },
  ])
  letrero(k, pz, "f-comedor", S.x1 - 0.02, Y0 + 3.6, 56.5, -Math.PI / 2, 0.38)
  letrero(k, pz, "f-jardin", S.x1 - 0.02, Y0 + 3.6, 76, -Math.PI / 2, 0.38)
  letrero(k, pz, "f-labs", S.x0 - 0.5, Y0 + 3.6, 56, Math.PI / 2, 0.38)
  // Zócalo de acero al pie del muro blanco.
  caja(k.base, pz, S.x1 - 0.03, S.x1, Y0, Y0 + 0.15, S.z0, S.z1, A.acero)
  // Techo con dos tiras de luz lineal empotradas.
  k.techo.agregar(horizontal(S, yT, true), null, acabado(P.panel, 0.55, 0, 1.2))
  for (const x of [-1.25, 1.25]) {
    k.luz.agregar(pz.caja, M(x, yT - 0.01, cz(S), 0, 0.16, 0.02, S.z1 - S.z0 - 1), luz(P.frio, 2.4))
    for (let z = S.z0 + 4; z < S.z1; z += 6) k.reflejos.push({ x, z, h: S.alto, color: P.frio, fuerza: 0.45, ancho: 0.6 })
  }
  // El pórtico del escáner a la entrada: acero y tiras cian.
  const zP = S.z0 + 1.6
  for (const s of [-1, 1]) {
    caja(k.base, pz, s * S.x1 - 0.18 * s - 0.18, s * S.x1 - 0.18 * s + 0.18, Y0, yT, zP - 0.25, zP + 0.25, A.acero)
    k.luz.agregar(pz.caja, M(s * (S.x1 - 0.4), Y0 + S.alto / 2, zP, 0, 0.03, S.alto - 0.4, 0.1), luz(P.cian, 3, 0))
  }
  caja(k.base, pz, S.x0, S.x1, yT - 0.35, yT, zP - 0.25, zP + 0.25, A.acero)
  // La puerta del fondo (a la cámara de pruebas) y su letrero.
  letrero(k, pz, "f-camara", 0, Y0 + 3.8, S.z1 - 0.02, Math.PI, 0.38)
  // Rojo de salida, bajo y poco.
  k.luz.agregar(pz.caja, M(S.x1 - 0.02, Y0 + 0.25, 66, 0, 0.03, 0.05, 2.5), luz(P.rojo, 2.4, 0))
}

// ── 6.5 Los laboratorios de vidrio ──

function construirLabs(k: Kit, pz: Piezas, rnd: () => number) {
  const S = LABS
  const yT = Y0 + S.alto
  k.base.agregar(horizontal(S, Y0), null, A.epoxi)
  muro(k, pz, "x", CIU.x0, S.x1, S.z0 - 1, S.z0, Y0, yT)
  muro(k, pz, "x", S.x0 - 1, S.x1, S.z1, S.z1 + 1, Y0, yT)
  muro(k, pz, "z", S.z0, S.z1, S.x0 - 1, S.x0, Y0, yT)
  // Macizo de roca y concreto al oeste (la instalación está excavada).
  caja(k.base, pz, CIU.x0, S.x0 - 1, Y0, yT, S.z0, S.z1 + 1, A.concretoOsc)
  caja(k.base, pz, CIU.x0, S.x0 - 1, yT, yT + 0.02, S.z0, S.z1 + 1, A.muroCorte)
  techoSala(k, pz, S, A.panel)
  // Cuatro módulos iguales, con frente de vidrio hacia el pasillo.
  const n = 4
  const paso = (S.z1 - S.z0) / n
  for (let i = 0; i < n; i++) {
    const z0 = S.z0 + i * paso
    const z1 = z0 + paso
    const zc = (z0 + z1) / 2
    if (i > 0) muro(k, pz, "x", S.x0, FRENTE_LABS, z0 - 0.1, z0 + 0.1, Y0, yT)
    tabiqueVidrio(k, pz, "z", FRENTE_LABS, z0 + 0.1, z1 - 0.1, S.alto, [[zc - 0.9, zc + 0.9]])
    letrero(k, pz, `lab-${i + 1}`, FRENTE_LABS + 0.08, Y0 + 3.2, zc - 2.6, Math.PI / 2, 0.36, false)
    // Mesadas blancas con gabinetes, una campana extractora y un rack de muestras.
    for (const dz of [-2.4, 2.4]) {
      caja(k.base, pz, S.x0 + 2.5, FRENTE_LABS - 2.2, Y0, Y0 + 0.86, zc + dz - 0.45, zc + dz + 0.45, acabado("#dfe5ea", 0.5, 0))
      caja(k.base, pz, S.x0 + 2.4, FRENTE_LABS - 2.1, Y0 + 0.86, Y0 + 0.92, zc + dz - 0.52, zc + dz + 0.52, A.blanco)
      // Pantallas pequeñas sobre la mesada.
      for (let j = 0; j < 3; j++) {
        const x = S.x0 + 4 + j * 3.2
        caja(k.base, pz, x - 0.3, x + 0.3, Y0 + 1.0, Y0 + 1.36, zc + dz - 0.03, zc + dz + 0.03, acabado("#0b1015", 0.2, 0.3, 0, j === 1 ? P.cian : "#7fb2ff", 0.8))
        caja(k.base, pz, x - 0.03, x + 0.03, Y0 + 0.92, Y0 + 1.0, zc + dz - 0.03, zc + dz + 0.03, A.acero)
      }
    }
    // Campana extractora contra el muro del fondo.
    caja(k.base, pz, S.x0, S.x0 + 1.0, Y0, Y0 + 0.9, zc - 1.2, zc + 1.2, acabado("#dfe5ea", 0.5, 0))
    caja(k.base, pz, S.x0, S.x0 + 1.0, Y0 + 2.0, Y0 + 2.6, zc - 1.2, zc + 1.2, acabado("#dfe5ea", 0.5, 0))
    for (const s of [-1, 1]) caja(k.base, pz, S.x0, S.x0 + 1.0, Y0 + 0.9, Y0 + 2.0, zc + s * 1.2 - 0.05, zc + s * 1.2 + 0.05, A.blanco)
    vidrioPlano(k, pz, "z", S.x0 + 1.0, zc - 1.15, zc + 1.15, Y0 + 0.9, Y0 + 2.0)
    k.luz.agregar(pz.caja, M(S.x0 + 0.5, Y0 + 1.96, zc, 0, 0.6, 0.02, 2.2), luz(P.frio, 3.5))
    // Rack de muestras con luz verde suave, en la esquina.
    const rz = z0 + 0.6
    caja(k.base, pz, S.x0 + 1.5, S.x0 + 3.3, Y0, Y0 + 2.2, rz - 0.3, rz + 0.3, acabado("#cfd6dc", 0.4, 0.3))
    for (let h = 0.5; h < 2.2; h += 0.5) k.luz.agregar(pz.caja, M(S.x0 + 2.4, Y0 + h, rz + 0.31, 0, 1.6, 0.04, 0.02), luz("#7dffb0", 2.2, 0.4))
    // Un brazo robótico de laboratorio sobre la mesada sur.
    const bx = S.x0 + 8 + rnd() * 2
    const bz = zc + 2.4
    k.base.agregar(pz.cil16, M(bx, Y0 + 1.0, bz, 0, 0.18, 0.16, 0.18), A.blanco)
    const hombro = new THREE.Vector3(bx, Y0 + 1.2, bz)
    const codo = new THREE.Vector3(bx + 0.25, Y0 + 1.75, bz - 0.1)
    const pinza = new THREE.Vector3(bx + 0.65, Y0 + 1.35, bz - 0.15)
    tubo(k.base, pz, hombro, codo, 0.07, A.blanco)
    tubo(k.base, pz, codo, pinza, 0.055, A.blanco)
    k.luz.agregar(pz.esfera, M(codo.x, codo.y, codo.z, 0, 0.06, 0.06, 0.06), luz(P.cian, 4, 0))
  }
  // Una línea azul guía por el pasillo de los laboratorios.
  lineaPiso(k, pz, [[-6, 56.4], [-10.6, 56.4], [-10.6, 88]], P.azul)
  letrero(k, pz, "labs", CORREDOR.x0 - 1, Y0 + 3.85, 70, -Math.PI / 2, 0.42)
}

// ── 6.6 El comedor ──

function construirComedor(k: Kit, pz: Piezas) {
  const S = COMEDOR
  const yT = Y0 + S.alto
  k.base.agregar(horizontal(S, Y0), null, acabado("#b9aa98", 0.35, 0, 1.2))
  muro(k, pz, "x", S.x0, S.x1, S.z0 - 1, S.z0, Y0, yT)
  muro(k, pz, "x", S.x0, S.x1, S.z1, JARDIN.z0, Y0, yT, [{ a: 11, b: 15, alto: 3.2 }])
  muro(k, pz, "z", S.z0 - 1, JARDIN.z1 + 1, S.x1, S.x1 + 1, Y0, yT)
  // Macizo al este.
  caja(k.base, pz, S.x1 + 1, CIU.x1, Y0, yT, S.z0 - 1, JARDIN.z1 + 1, A.concretoOsc)
  caja(k.base, pz, S.x1 + 1, CIU.x1, yT, yT + 0.02, S.z0 - 1, JARDIN.z1 + 1, A.muroCorte)
  // Entre la sala de control y el comedor.
  caja(k.base, pz, POZO.x1 + 0.6, CIU.x1, Y0, Y0 + 4.5, CONTROL.z1 + 1, S.z0 - 1, A.concretoOsc)
  caja(k.base, pz, POZO.x1 + 0.6, CIU.x1, Y0 + 4.5, Y0 + 4.52, CONTROL.z1 + 1, S.z0 - 1, A.muroCorte)
  techoSala(k, pz, S, A.panel, 3, "#fff1dc", 2.6, 0.3)
  letrero(k, pz, "comedor", S.x0 + 0.05, Y0 + 3.5, 62, Math.PI / 2, 0.45)
  // Barra de café contra el muro norte.
  caja(k.base, pz, 17, 25.6, Y0, Y0 + 1.05, S.z0 + 0.1, S.z0 + 0.9, acabado("#8a6a4e", 0.5, 0))
  caja(k.base, pz, 16.9, 25.7, Y0 + 1.05, Y0 + 1.1, S.z0 + 0.05, S.z0 + 1.0, A.blanco)
  k.luz.agregar(pz.caja, M(21.3, Y0 + 1.0, S.z0 + 0.92, 0, 8.5, 0.03, 0.02), luz("#ffcf8a", 2.6, 0.2))
  for (const x of [18.5, 21, 23.5]) caja(k.base, pz, x - 0.3, x + 0.3, Y0 + 1.1, Y0 + 1.55, S.z0 + 0.3, S.z0 + 0.7, A.acero)
  // Dos mesas largas con bancas y lámparas tibias encima.
  for (const x of [19, 23]) {
    caja(k.base, pz, x - 0.6, x + 0.6, Y0 + 0.72, Y0 + 0.78, 51, 65, acabado("#a07850", 0.45, 0))
    for (const z of [52, 58, 64]) caja(k.base, pz, x - 0.06, x + 0.06, Y0, Y0 + 0.72, z - 0.06, z + 0.06, A.aceroOsc)
    for (const s of [-1, 1]) caja(k.base, pz, x + s * 1.0 - 0.18, x + s * 1.0 + 0.18, Y0 + 0.42, Y0 + 0.47, 51.2, 64.8, acabado("#a07850", 0.5, 0))
    for (let z = 52.5; z < 65; z += 3) {
      k.base.agregar(pz.cil8, M(x, yT - 0.6, z, 0, 0.012, 1.2, 0.012), A.aceroOsc)
      k.luz.agregar(pz.esfera, M(x, yT - 1.25, z, 0, 0.16, 0.16, 0.16), luz("#ffcf8a", 5, 0.2))
      k.reflejos.push({ x, z, h: S.alto - 1.25, color: "#ffcf8a", fuerza: 0.3, ancho: 0.8 })
    }
  }
}

// ── 6.7 El jardín hidropónico ──

function construirJardin(k: Kit, pz: Piezas, rnd: () => number) {
  const S = JARDIN
  const yT = Y0 + S.alto
  k.base.agregar(horizontal({ x0: S.x0, x1: 16.5, z0: S.z0, z1: S.z1 }, Y0), null, A.rejilla)
  k.base.agregar(horizontal({ x0: 16.5, x1: S.x1, z0: S.z0, z1: S.z1 }, Y0), null, A.epoxi)
  muro(k, pz, "x", S.x0, S.x1, S.z1, S.z1 + 1, Y0, yT)
  techoSala(k, pz, S, A.panel, 3, "#f3e9ff", 1.6, 0.6)
  letrero(k, pz, "jardin", S.x0 + 0.05, Y0 + 3.6, 85, Math.PI / 2, 0.42)
  // Racks de cuatro niveles con luces de cultivo magenta debajo de cada estante.
  const verdes = ["#4caf50", "#5fbf5a", "#3f9b48", "#7ccf6a", "#2f8a43"]
  for (const z of [71.4, 75.2, 79, 82.8, 86.6, 90.4]) {
    for (const x of [17, 25]) caja(k.base, pz, x - 0.04, x + 0.04, Y0, Y0 + 2.6, z - 0.45, z + 0.45, A.acero)
    for (const h of [0.35, 0.95, 1.55, 2.15]) {
      caja(k.base, pz, 17, 25, Y0 + h - 0.04, Y0 + h, z - 0.45, z + 0.45, acabado("#e4e9ec", 0.45, 0.2))
      k.luz.agregar(pz.caja, M(21, Y0 + h + 0.5, z, 0, 7.6, 0.025, 0.1), luz(P.magenta, 4.2, 0.2))
      for (let x = 17.35; x < 24.8; x += 0.62) k.plantas.push({ x: x + (rnd() - 0.5) * 0.1, y: Y0 + h, z: z + (rnd() - 0.5) * 0.25, s: 0.17 + rnd() * 0.09, color: verdes[Math.floor(rnd() * verdes.length)] })
    }
  }
  k.vapores.push({ x: 21, y: Y0 + 0.4, z: cz(S), rx: 4, rz: 10, n: 40, tam: 2.4, alto: 2.4, vel: 0.04, color: "#ffc7f1", fuerza: 0.06 })
  for (let z = 72; z < 92; z += 5) k.reflejos.push({ x: 16.6, z, h: 1.4, color: P.magenta, fuerza: 0.25, ancho: 1.2 })
}

// ── 6.8 La cámara de pruebas ──

function construirCamara(k: Kit, pz: Piezas) {
  const S = CAMARA
  const yT = Y0 + S.alto
  // Muros: el norte (con la puerta desde el corredor), los lados y el fondo.
  muro(k, pz, "x", S.x0 - 1, S.x1 + 1, CORREDOR.z1, S.z0, Y0, yT, [{ a: -2.1, b: 2.1, alto: 3.4 }])
  k.compuertas.push({ x: 0, z: (CORREDOR.z1 + S.z0) / 2, eje: "x", ancho: 4.2, alto: 3.4, grosor: 1, abierta: 0 })
  muro(k, pz, "z", S.z0, S.z1, S.x0 - 1, S.x0, Y0, yT)
  muro(k, pz, "z", S.z0, S.z1, S.x1, S.x1 + 1, Y0, yT)
  muro(k, pz, "x", S.x0 - 1, S.x1 + 1, S.z1, S.z1 + 1, Y0, yT)
  // Macizos a los costados (entre el corredor y la cámara).
  for (const [a, b] of [
    [CIU.x0, S.x0 - 1],
    [S.x1 + 1, CIU.x1],
  ]) {
    caja(k.base, pz, a, b, Y0, Y0 + 4.5, LABS.z1 + 1, CIU.z1, A.concretoOsc)
    caja(k.base, pz, a, b, Y0 + 4.5, Y0 + 4.52, LABS.z1 + 1, CIU.z1, A.muroCorte)
  }
  for (const [a, b] of [
    [S.x0 - 1, CORREDOR.x0 - 1],
    [CORREDOR.x1 + 1, S.x1 + 1],
  ]) {
    caja(k.base, pz, a, b, Y0, Y0 + 4.5, LABS.z1 + 1, CORREDOR.z1, A.concretoOsc)
    caja(k.base, pz, a, b, Y0 + 4.5, Y0 + 4.52, LABS.z1 + 1, CORREDOR.z1, A.muroCorte)
  }
  // El interior: un cubo blanco con la grilla de luz.
  k.grilla.agregar(horizontal(S, Y0 + 0.004))
  k.grilla.agregar(horizontal(S, yT - 0.004, true))
  for (const g of carasInteriores({ x0: S.x0 + 0.004, x1: S.x1 - 0.004, z0: S.z0 + 0.004, z1: S.z1 - 0.004 }, Y0, yT)) k.grilla.agregar(g)
  letrero(k, pz, "camara", 0, Y0 + 5.2, S.z0 + 0.02, 0, 0.5)
}

// ═══════════════════════════════════════════════════════════════
// 7. El nivel entero
// ═══════════════════════════════════════════════════════════════

type Vista = { pos: [number, number, number]; mira: [number, number, number]; fov: number }

/**
 * Vistas listas para grabar la instalación (cámara y punto al que mira). La
 * primera, "mirador", es la de llegada. Todas respetan los límites de la
 * cámara libre: dentro de HUELLAS.ciudad, el punto mirado a 12 m o menos del
 * piso y mirando un poco hacia abajo (la órbita no pasa de 83° desde arriba).
 */
export const VISTAS_CIUDAD: Record<"mirador" | "plaza" | "avenida" | "aerea" | "torres" | "anden" | "control" | "comedor" | "jardin" | "camara", Vista> = {
  mirador: { pos: [-6.5, Y0 + 5.5, 15.6], mira: [4, Y0 + 0.5, 40], fov: 64 },
  plaza: { pos: [7, Y0 + 5, 42], mira: [-2, Y0 + 1.5, 22], fov: 64 },
  avenida: { pos: [1.5, Y0 + 2.9, 94.8], mira: [-0.4, Y0 + 0.1, 76], fov: 60 },
  aerea: { pos: [31, Y0 + 13.5, 107.5], mira: [-4, Y0, 52], fov: 55 },
  torres: { pos: [-5.6, Y0 + 3.6, 91], mira: [-18, Y0 + 0.5, 74], fov: 62 },
  anden: { pos: [-13.2, Y0 + 4.6, 42.8], mira: [-27, Y0 + 0.5, 22], fov: 62 },
  control: { pos: [11.2, Y0 + 4.6, 38.6], mira: [26, Y0 + 1.5, 25], fov: 64 },
  comedor: { pos: [5.5, Y0 + 3.6, 66.8], mira: [19, Y0 + 0.6, 54], fov: 62 },
  jardin: { pos: [5.4, Y0 + 3.6, 92], mira: [18, Y0 + 0.6, 76], fov: 62 },
  camara: { pos: [-12.6, Y0 + 7, 110.6], mira: [4, Y0 + 1.5, 101], fov: 64 },
}

/**
 * La toma "Descenso a la ciudad" (0 ≤ t ≤ 1): baja por el eje del pozo desde
 * la boca hasta el atrio, girando un cuarto de vuelta mientras las galerías
 * suben por los costados, y termina mirando el ascensor. Devuelve el campo de
 * visión.
 */
export function tomaDescensoCiudad(t: number, pos: THREE.Vector3, mira: THREE.Vector3): number {
  const k = t * t * (3 - 2 * t)
  const ang = THREE.MathUtils.lerp(-0.9, 0.5, k)
  const r = THREE.MathUtils.lerp(4.2, 6.0, k)
  const y = THREE.MathUtils.lerp(TOPE - 1.6, Y0 + 3.2, Math.pow(k, 0.9))
  pos.set(Math.sin(ang) * r, y, 30 + Math.cos(ang) * r)
  const km = Math.pow(k, 1.6)
  mira.set(THREE.MathUtils.lerp(0, -1, km), THREE.MathUtils.lerp(TOPE - 18, Y0 + 8.5, km), THREE.MathUtils.lerp(26, 16, km))
  return THREE.MathUtils.lerp(66, 58, k)
}

export function construirCiudad(ctx: CtxEscena): void {
  const grupo = ctx.niveles.ciudad
  if (!grupo) {
    console.warn("[casa-blanca] no hay grupo para el nivel ciudad: la instalación no se construye")
    return
  }
  const factor = ctx.calidad === "alta" ? 1 : ctx.calidad === "media" ? 0.7 : 0.45
  const sombra = ctx.sombras

  // ── Texturas dibujadas ──
  const lienzoP = document.createElement("canvas")
  lienzoP.width = PANT_W
  lienzoP.height = PANT_H
  const gP = lienzoP.getContext("2d")!
  dibujarPantalla(gP, "12:00", 0)
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

  const entorno = entornoInstalacion()
  const mats = crearMaterialesCiudad(entorno, texA, texP)
  const pz = crearPiezas()
  const rnd = semilla(1792)
  const k: Kit = {
    base: new Lote(PBR),
    techo: new Lote(PBR),
    oficinas: new Lote(),
    luz: new Lote([
      ["color", 3],
      ["aPulso", 1],
      ["aTurno", 1],
    ]),
    vidrio: new Lote(),
    esmerilado: new Lote(),
    grilla: new Lote(),
    chevron: new Lote(),
    senal: new Lote(),
    pantalla: new Lote(),
    reflejos: [],
    vapores: [],
    plantas: [],
    compuertas: [],
    balizas: [],
    celdas,
  }

  // ── Construcción ──
  construirPozo(k, pz)
  const cabinas = construirAscensores(k, pz, mats, sombra)
  grupo.add(cabinas.cuerpo, cabinas.vidrio)
  construirAnden(k, pz)
  const tren = construirTren(mats, pz, sombra)
  grupo.add(tren.coches, tren.puertas)
  construirControl(k, pz)
  construirCorredor(k, pz)
  construirLabs(k, pz, rnd)
  construirComedor(k, pz)
  construirJardin(k, pz, rnd)
  construirCamara(k, pz)

  // Marcos de las compuertas (acero atornillado) y una baliza encima de cada una.
  for (const c of k.compuertas) {
    const w = c.ancho / 2 + 0.35
    const zx = c.eje === "x"
    for (const s of [-1, 1]) {
      const a = s * (c.ancho / 2 + 0.17)
      const g = c.grosor / 2
      if (zx) for (const lado of [-1, 1]) caja(k.chevron, pz, c.x + a - 0.17, c.x + a + 0.17, Y0, Y0 + c.alto, c.z + lado * g - 0.08, c.z + lado * g + 0.08)
      else for (const lado of [-1, 1]) caja(k.chevron, pz, c.x + lado * g - 0.08, c.x + lado * g + 0.08, Y0, Y0 + c.alto, c.z + a - 0.17, c.z + a + 0.17)
    }
    const g = c.grosor / 2
    if (zx) for (const lado of [-1, 1]) caja(k.base, pz, c.x - w, c.x + w, Y0 + c.alto, Y0 + c.alto + 0.4, c.z + lado * g - 0.1, c.z + lado * g + 0.1, A.aceroOsc)
    else for (const lado of [-1, 1]) caja(k.base, pz, c.x + lado * g - 0.1, c.x + lado * g + 0.1, Y0 + c.alto, Y0 + c.alto + 0.4, c.z - w, c.z + w, A.aceroOsc)
    for (const lado of [-1, 1]) k.balizas.push(zx ? new THREE.Vector3(c.x + w - 0.3, Y0 + c.alto + 0.6, c.z + lado * (g + 0.1)) : new THREE.Vector3(c.x + lado * (g + 0.1), Y0 + c.alto + 0.6, c.z + w - 0.3))
  }

  // ── Mallas fusionadas ──
  const poner = (lote: Lote, mat: THREE.Material, nombre: string, op: { proyecta?: boolean; recibe?: boolean; orden?: number } = {}) => {
    const m = lote.malla(mat, nombre)
    if (!m) return null
    m.castShadow = sombra && !!op.proyecta
    m.receiveShadow = sombra && !!op.recibe
    if (op.orden !== undefined) m.renderOrder = op.orden
    grupo.add(m)
    return m
  }
  poner(k.base, mats.base, "ciudad-base", { proyecta: true, recibe: true })
  poner(k.techo, mats.base, "ciudad-techos")
  poner(k.oficinas, mats.oficinas, "ciudad-oficinas", { recibe: true })
  poner(k.grilla, mats.grilla, "ciudad-camara", { recibe: true })
  poner(k.chevron, mats.chevron, "ciudad-chevrones", { proyecta: true, recibe: true })
  poner(k.luz, mats.luz, "ciudad-luces")
  poner(k.pantalla, mats.pantalla, "ciudad-pantalla")
  poner(k.vidrio, mats.vidrio, "ciudad-vidrio", { orden: 3 })
  poner(k.esmerilado, mats.esmerilado, "ciudad-esmerilado", { orden: 3 })
  poner(k.senal, mats.senal, "ciudad-senales", { orden: 4 })

  // ── Compuertas: las hojas se corren cuando alguien se acerca ──
  const hojas = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats.chevron, Math.max(1, k.compuertas.length * 2))
  hojas.name = "ciudad-compuertas"
  hojas.castShadow = sombra
  hojas.frustumCulled = false
  grupo.add(hojas)

  // ── Balizas ámbar que giran (un cono emisivo cada una) ──
  const geoBaliza = new THREE.ConeGeometry(0.16, 0.5, 10)
  geoBaliza.rotateZ(-Math.PI / 2)
  geoBaliza.translate(0.25, 0, 0)
  const balizas = new THREE.InstancedMesh(geoBaliza, new THREE.MeshBasicMaterial({ name: "ciudad-balizas", color: new THREE.Color(P.ambar).multiplyScalar(5) }), Math.max(1, k.balizas.length))
  balizas.name = "ciudad-balizas"
  balizas.frustumCulled = false
  grupo.add(balizas)

  // ── Plantas del jardín (se mecen en el shader) ──
  {
    const im = new THREE.InstancedMesh(pz.mata, mats.follaje, Math.max(1, k.plantas.length))
    const r2 = semilla(33)
    k.plantas.forEach((p, i) => {
      im.setMatrixAt(i, M(p.x, p.y, p.z, r2() * 6, p.s, p.s * (0.9 + r2() * 0.4), p.s))
      im.setColorAt(i, _col.set(p.color))
    })
    im.count = k.plantas.length
    im.name = "ciudad-plantas"
    im.receiveShadow = sombra
    grupo.add(im)
  }

  // ── Arco de escaneo del corredor ──
  const escaneo = new THREE.Mesh(new THREE.PlaneGeometry(CORREDOR.x1 - CORREDOR.x0 - 0.1, CORREDOR.alto - 0.05), mats.escaneo)
  escaneo.name = "ciudad-escaneo"
  escaneo.renderOrder = 6
  escaneo.position.set(0, Y0 + CORREDOR.alto / 2, CORREDOR.z0 + 2)
  grupo.add(escaneo)

  // ── Núcleo de IA: anillos de luz apilados que pulsan en cian ──
  const N_ANILLOS = 12
  const anillos = new THREE.InstancedMesh(new THREE.TorusGeometry(0.95, 0.035, 6, 40).rotateX(Math.PI / 2), mats.brillo, N_ANILLOS)
  anillos.name = "ciudad-nucleo"
  anillos.frustumCulled = false
  for (let i = 0; i < N_ANILLOS; i++) {
    anillos.setMatrixAt(i, M(NUCLEO.x, Y0 + 0.9 + i * 0.44, NUCLEO.z))
    anillos.setColorAt(i, _col.set(P.cian).multiplyScalar(2))
  }
  grupo.add(anillos)

  // ── Robots de servicio (corredor y cámara) y drones de prueba ──
  const N_ROBOTS = 3 + 3
  const N_DRONES = Math.max(3, Math.round(6 * factor))
  const geoCuerpo = (() => {
    const l = new Lote()
    l.agregar(new THREE.CapsuleGeometry(0.28, 0.32, 4, 12), M(0, 0.48, 0))
    l.agregar(pz.cil16, M(0, 0.06, 0, 0, 0.3, 0.12, 0.3))
    return l.geometria()!
  })()
  const robots = new THREE.InstancedMesh(geoCuerpo, mats.robot, N_ROBOTS + N_DRONES)
  robots.name = "ciudad-robots"
  robots.castShadow = sombra
  robots.frustumCulled = false
  grupo.add(robots)
  const ojos = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.brillo, N_ROBOTS + N_DRONES * 2)
  ojos.name = "ciudad-ojos"
  ojos.frustumCulled = false
  for (let i = 0; i < N_ROBOTS; i++) ojos.setColorAt(i, _col.set(P.cian).multiplyScalar(5))
  for (let i = 0; i < N_DRONES; i++) {
    ojos.setColorAt(N_ROBOTS + i * 2, _col.set("#ffffff").multiplyScalar(5))
    ojos.setColorAt(N_ROBOTS + i * 2 + 1, _col.set(i % 2 ? P.cian : P.ambar).multiplyScalar(5))
  }
  grupo.add(ojos)
  const rd = semilla(2040)
  const datosRobot = Array.from({ length: N_ROBOTS }, (_, i) =>
    i < 3
      ? { corredor: true, x: i === 1 ? 2.25 : -2.25, z0: CORREDOR.z0 + 4 + i * 12, z1: CORREDOR.z1 - 3 - i * 6, vel: 0.5 + rd() * 0.2, fase: rd() * 100 }
      : { corredor: false, x: cx(CAMARA) + (i - 4) * 7, z0: cz(CAMARA), z1: 3.5 + rd() * 1.5, vel: 0.25 + rd() * 0.15, fase: rd() * 100 },
  )
  const datosDron = Array.from({ length: N_DRONES }, () => ({ x: (rd() - 0.5) * 18, z: cz(CAMARA) + (rd() - 0.5) * 8, y: Y0 + 3.5 + rd() * 4.5, r: 1.5 + rd() * 3, vel: 0.3 + rd() * 0.4, fase: rd() * 100 }))

  // ── Reflejos falsos en el epoxi ──
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

  // ── Bruma (jardín y foso), en una sola emisión ──
  {
    const r3 = semilla(71)
    const pos: number[] = []
    const fase: number[] = []
    const vel: number[] = []
    const tam: number[] = []
    const alto: number[] = []
    const col: number[] = []
    for (const v of k.vapores) {
      const n = Math.max(2, Math.round(v.n * factor))
      _col.set(v.color).multiplyScalar(v.fuerza)
      for (let i = 0; i < n; i++) {
        pos.push(v.x + (r3() - 0.5) * 2 * v.rx, v.y, v.z + (r3() - 0.5) * 2 * v.rz)
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

  // ── Luces reales: cinco, una por espacio grande ──
  const luces: Array<{ l: THREE.PointLight; base: number; turno: number }> = []
  const poneLuz = (x: number, y: number, z: number, color: string, intensidad: number, distancia: number, turno: number) => {
    const l = new THREE.PointLight(color, intensidad, distancia, 2)
    l.position.set(x, y, z)
    l.castShadow = false
    grupo.add(l)
    luces.push({ l, base: intensidad, turno })
  }
  poneLuz(0, Y0 + 5, 33, "#eaf4ff", 90, 30, 0.4)
  poneLuz(NUCLEO.x - 3, Y0 + 4.5, NUCLEO.z, "#56c8ff", 70, 24, -0.3)
  poneLuz(-22, Y0 + 5.5, 28, "#eef3ff", 80, 30, 0.4)
  poneLuz(0, Y0 + 8, cz(CAMARA), "#e6f7ff", 90, 26, 0.3)
  poneLuz(20, Y0 + 3.4, cz(JARDIN), P.magenta, 45, 18, 0)

  // ── Lugares que se pueden tocar: cajas invisibles (no dibujan) sobre cada lugar ──
  const invisible = new THREE.MeshBasicMaterial({ visible: false })
  const tocable: Array<[string, Rect, number]> = [
    ["ciudad-plaza", R_PLAZA, 4],
    ["ciudad-mirador", R_MIRADOR, 3],
    ["ciudad-estacion", R_ESTACION, 5],
    ["ciudad-club", R_CLUB, 5],
    ["ciudad-avenida", R_AVENIDA, 3],
    ["ciudad-torres", R_TORRES, 3],
    ["ciudad-mercado", R_MERCADO, 3],
    ["ciudad-parque", R_PARQUE, 3],
    ["ciudad-arena", R_ARENA, 6],
  ]
  for (const [id, r, h] of tocable) {
    if (!LUGAR[id]) continue
    const c = new THREE.Mesh(pz.caja, invisible)
    c.position.set(cx(r), Y0 + h / 2, cz(r))
    c.scale.set(r.x1 - r.x0, h, r.z1 - r.z0)
    c.name = `tocable-${id}`
    grupo.add(c)
    ctx.seleccionable(c, id)
  }

  // ── Animación ──
  const amb = ambienteCiudad(12)
  const _q = new THREE.Quaternion()
  const _p = new THREE.Vector3()
  const _s = new THREE.Vector3()
  const _m = new THREE.Matrix4()
  const _e = new THREE.Euler()
  const _c = new THREE.Color()
  let ultimaPantalla = -99
  // Los personajes que están en la instalación (para abrir las compuertas a su paso).
  let avatares: THREE.Object3D | null = null
  const buscarAvatares = () => {
    for (const o of ctx.scene.children) if (o.children.some((h) => h.userData?.personajeId)) return o
    return null
  }
  const alguienCerca = (x: number, z: number, r: number) => {
    if (!avatares) return false
    for (const a of avatares.children) {
      if (!a.visible || a.position.y > Y0 + 6) continue
      const dx = a.position.x - x
      const dz = a.position.z - z
      if (dx * dx + dz * dz < r * r) return true
    }
    return false
  }

  // El tren: entra desde el túnel, frena, abre las puertas, espera 12 s y sale.
  const PARADA = VIA.tope - 1.2
  const RECORRIDO = PARADA - (TUNEL.z1 + 8)
  const T_ENTRA = 10
  const T_PUERTA = 1
  const T_ESPERA = 12
  const T_SALE = 10
  const T_FUERA = 9
  const CICLO_TREN = T_ENTRA + 2 * T_PUERTA + T_ESPERA + T_SALE + T_FUERA
  const frenteTren = (c: number): { z: number; puerta: number } => {
    if (c < T_ENTRA) {
      const s = c / T_ENTRA
      return { z: PARADA - RECORRIDO * (1 - s) * (1 - s), puerta: 0 }
    }
    c -= T_ENTRA
    if (c < T_PUERTA) return { z: PARADA, puerta: smooth(0, 1, c / T_PUERTA) }
    c -= T_PUERTA
    if (c < T_ESPERA) return { z: PARADA, puerta: 1 }
    c -= T_ESPERA
    if (c < T_PUERTA) return { z: PARADA, puerta: 1 - smooth(0, 1, c / T_PUERTA) }
    c -= T_PUERTA
    if (c < T_SALE) {
      const s = c / T_SALE
      return { z: PARADA - RECORRIDO * s * s, puerta: 0 }
    }
    return { z: PARADA - RECORRIDO, puerta: 0 }
  }

  const actualizar = (tick: TickEscena) => {
    const t = tick.tiempo
    ambienteCiudad(tick.hora, amb)
    const noche = amb.noche
    const u = mats.u
    u.tiempo.value = t
    u.noche.value = noche
    u.reflejo.value = 0.7 + 0.3 * noche

    // La pantalla se redibuja cada 2 s (la hora y el brillo que la barre).
    if (t - ultimaPantalla > 2 || ultimaPantalla < 0) {
      ultimaPantalla = t
      const hh = Math.floor(tick.hora)
      const mm = Math.floor((tick.hora - hh) * 60)
      dibujarPantalla(gP, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, (t % 8) / 8)
      texP.needsUpdate = true
    }

    // Ascensores: uno sube mientras el otro baja, con esperas en las puntas.
    for (let i = 0; i < 2; i++) {
      const T = 34
      const c = (t + i * T * 0.5) % T
      const k2 = smooth(6, 15, c) - smooth(23, 32, c)
      const y = Y0 + 0.02 + (cabinas.arriba - Y0) * k2
      _m.compose(_p.set(ASC.x + (i ? 1 : -1) * ELEV.dx, y, ASC.z), _q.identity(), _s.set(1, 1, 1))
      cabinas.cuerpo.setMatrixAt(i, _m)
      cabinas.vidrio.setMatrixAt(i, _m)
    }
    cabinas.cuerpo.instanceMatrix.needsUpdate = true
    cabinas.vidrio.instanceMatrix.needsUpdate = true

    // El tren (dos coches) y sus puertas del lado del andén.
    {
      const f = frenteTren(t % CICLO_TREN)
      const visible = f.z > TUNEL.z1 + 4 + tren.paso * 2
      tren.coches.visible = visible
      tren.puertas.visible = visible
      const yC = Y0 + 1.2
      for (let i = 0; i < 2; i++) {
        const zc = f.z - tren.largo / 2 - i * tren.paso
        _m.compose(_p.set(VIA.x, yC, zc), _q.identity(), _s.set(1, 1, 1))
        tren.coches.setMatrixAt(i, _m)
        for (let d = 0; d < 2; d++) {
          const zd = zc + (d ? 2.4 : -2.4)
          for (let h = 0; h < 2; h++) {
            const s = h ? 1 : -1
            _m.compose(_p.set(VIA.x + 1.33, yC - 0.1, zd + s * (0.38 + 0.8 * f.puerta)), _q.identity(), _s.set(1, 1, 1))
            tren.puertas.setMatrixAt(i * 4 + d * 2 + h, _m)
          }
        }
      }
      tren.coches.instanceMatrix.needsUpdate = true
      tren.puertas.instanceMatrix.needsUpdate = true
    }

    // Compuertas: se abren (0,6 s) cuando alguien pasa cerca, y se cierran solas.
    if (!avatares || !avatares.parent) avatares = buscarAvatares()
    k.compuertas.forEach((c, i) => {
      const objetivo = alguienCerca(c.x, c.z, 5) ? 1 : 0
      const paso = Math.min(tick.dt, 0.1) / 0.6
      c.abierta = Math.min(1, Math.max(0, c.abierta + Math.max(-paso, Math.min(paso, objetivo - c.abierta))))
      const a = smooth(0, 1, c.abierta)
      const medio = c.ancho / 2
      for (let h = 0; h < 2; h++) {
        const s = h ? 1 : -1
        const corr = s * (medio / 2 + a * medio)
        if (c.eje === "x") _m.compose(_p.set(c.x + corr, Y0 + c.alto / 2, c.z), _q.identity(), _s.set(medio, c.alto, 0.6))
        else _m.compose(_p.set(c.x, Y0 + c.alto / 2, c.z + corr), _q.identity(), _s.set(0.6, c.alto, medio))
        hojas.setMatrixAt(i * 2 + h, _m)
      }
    })
    hojas.instanceMatrix.needsUpdate = true

    // Balizas: giran siempre (la instalación está en marcha).
    k.balizas.forEach((b, i) => {
      _e.set(0, t * 4 + i * 1.7, 0)
      _m.compose(b, _q.setFromEuler(_e), _s.set(1, 1, 1))
      balizas.setMatrixAt(i, _m)
    })
    balizas.instanceMatrix.needsUpdate = true

    // El arco de escaneo recorre el corredor despacio cada 14 s.
    {
      const c = t % 14
      const s = smooth(0, 11, c)
      escaneo.position.z = THREE.MathUtils.lerp(CORREDOR.z0 + 2, CORREDOR.z1 - 0.5, s)
      ;(mats.escaneo.uniforms.uAlfa as THREE.IUniform<number>).value = smooth(0, 0.8, c) * (1 - smooth(10.2, 11.2, c))
    }

    // Núcleo: una onda de luz sube por los anillos.
    for (let i = 0; i < N_ANILLOS; i++) {
      const w = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.55)
      anillos.setColorAt(i, _c.set(P.cian).multiplyScalar(1.2 + 5 * w * w))
    }
    if (anillos.instanceColor) anillos.instanceColor.needsUpdate = true

    // Robots: van y vuelven por el corredor o dan vueltas en la cámara; drones en óvalos.
    for (let i = 0; i < N_ROBOTS; i++) {
      const d = datosRobot[i]
      let x: number
      let z: number
      let rumbo: number
      if (d.corredor) {
        const largo = d.z1 - d.z0
        const s = ((t * d.vel + d.fase) % (2 * largo)) / largo
        const ida = s < 1
        z = d.z0 + (ida ? s : 2 - s) * largo
        x = d.x
        rumbo = ida ? 0 : Math.PI
      } else {
        const a = t * d.vel + d.fase
        x = d.x + Math.cos(a) * d.z1
        z = d.z0 + Math.sin(a) * d.z1 * 0.6
        rumbo = Math.atan2(-Math.sin(a), Math.cos(a) * 0.6)
      }
      _m.compose(_p.set(x, Y0, z), _q.setFromEuler(_e.set(0, rumbo, 0)), _s.set(1, 1, 1))
      robots.setMatrixAt(i, _m)
      _m.compose(_p.set(x + Math.sin(rumbo) * 0.26, Y0 + 0.62, z + Math.cos(rumbo) * 0.26), _q.identity(), _s.setScalar(0.05))
      ojos.setMatrixAt(i, _m)
    }
    for (let i = 0; i < N_DRONES; i++) {
      const d = datosDron[i]
      const a = t * d.vel + d.fase
      const x = Math.max(CAMARA.x0 + 1, Math.min(CAMARA.x1 - 1, d.x + Math.cos(a) * d.r))
      const z = Math.max(CAMARA.z0 + 1, Math.min(CAMARA.z1 - 1, d.z + Math.sin(a * 1.3) * d.r * 0.6))
      const y = d.y + Math.sin(a * 2.1) * 0.6
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, a, 0)), _s.set(1.1, 0.22, 1.1))
      robots.setMatrixAt(N_ROBOTS + i, _m)
      _m.compose(_p.set(x, y + 0.18, z), _q.identity(), _s.setScalar(0.06))
      ojos.setMatrixAt(N_ROBOTS + i * 2, _m)
      _m.compose(_p.set(x, y - 0.02, z), _q.identity(), _s.setScalar(0.035 + 0.03 * (Math.sin(t * 9 + i) > 0 ? 1 : 0)))
      ojos.setMatrixAt(N_ROBOTS + i * 2 + 1, _m)
    }
    robots.instanceMatrix.needsUpdate = true
    ojos.instanceMatrix.needsUpdate = true

    // Turno de noche: los pasillos bajan y la sala de control sube un poco.
    for (const l of luces) l.l.intensity = l.base * (1 - 0.4 * noche * l.turno)
  }
  ctx.alActualizar((tick) => {
    if (grupo.visible) actualizar(tick)
  })
  // Primer cuadro: deja todo en su lugar antes de que el motor dibuje.
  actualizar({ dt: 0, tiempo: 0, hora: 12, noche: 0 })

  // ── Limpieza de piezas temporales (la caja la usan los tocables; la mata, las plantas) ──
  for (const g of [pz.cil8, pz.cil16, pz.cil24, pz.esfera, pz.plano]) g.dispose()
}
