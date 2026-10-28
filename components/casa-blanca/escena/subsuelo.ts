// ──────────────────────────────────────────────────────────────
// EL SUBSUELO — tres pisos bajo el Jardín Sur (ficción)
//
// Vista sin techo, como una casa de muñecas: losa gruesa, muros cortados a
// 2,8 m con remate oscuro (el "corte" de las maquetas de arquitectura),
// pasillos con tiras de luz en el piso, vidrio y concreto pulido.
//   n1 y n2: 22 departamentos de 100 puestos, la cafetería y la Sala de guerra.
//   n3: deporte y ocio.
//
// Presupuesto de dibujo (< 250 llamadas entre los tres niveles):
//   - Todo lo fijo de una celda es UNA malla: las piezas se fusionan con color,
//     rugosidad, metal y brillo por vértice (material "maqueta").
//   - Cada pieza de los puestos (escritorio, silla, monitor, pantalla,
//     trabajador, cabeza, indicador) es UNA InstancedMesh por nivel, no por
//     departamento; el estado se pinta con el color de cada instancia.
//   - Vidrio, luz aditiva y carteles van en una malla por nivel.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { ALTURA_NIVEL, NOMBRE_NIVEL, type EstadoPuesto, type NivelId, type TickEscena, type Vec3 } from "../tipos"
import {
  CELDAS,
  DEPARTAMENTOS_BASE,
  HUELLAS,
  LUGAR,
  SUB_COLUMNAS,
  SUB_FILAS,
  SUB_MEDIO_ANCHO,
  SUB_MEDIO_FONDO,
} from "../lugares"
import type { CtxEscena, Subsuelo } from "./contrato"

// ── Datos de presentación del subsuelo ──────────────────────────
// Colores de los 22 departamentos: paleta armónica en OKLCH (misma luz y
// croma parejos, tonos repartidos en el círculo). El cartel, el piso y las
// pantallas de cada departamento salen de aquí.
export const COLOR_DEPTO: Record<string, string> = {
  trump: "#DE3C37",
  leonardo: "#EE7D8D",
  thiel: "#F18848",
  amodei: "#B36139",
  cleopatra: "#F5AE39",
  jesus: "#F0DE99",
  tate: "#A88831",
  hormozi: "#BED62F",
  jobs: "#48C063",
  suntzu: "#258E6A",
  socrates: "#8FDCCC",
  altman: "#21ADAD",
  musk: "#3AC9F3",
  karp: "#3A95CD",
  lincoln: "#AFBFD5",
  pichai: "#407AEA",
  napoleon: "#8097F5",
  mason: "#6D54B7",
  marco: "#D7AEF0",
  kobe: "#AD52C8",
  iluminado: "#D757B3",
  gadzhi: "#F9AFC5",
}

/** Nombre corto del líder para el cartel del equipo. */
export const LIDER_CORTO: Record<string, string> = {
  trump: "Trump",
  suntzu: "Sun Tzu",
  thiel: "Thiel",
  altman: "Altman",
  musk: "Musk",
  hormozi: "Hormozi",
  amodei: "Amodei",
  pichai: "Pichai",
  mason: "El Gran Maestro",
  iluminado: "El Iluminado",
  jesus: "Jesús",
  karp: "Karp",
  marco: "Marco Aurelio",
  napoleon: "Napoleón",
  tate: "Tate",
  gadzhi: "Gadzhi",
  kobe: "Kobe",
  socrates: "Sócrates",
  cleopatra: "Cleopatra",
  leonardo: "Leonardo",
  lincoln: "Lincoln",
  jobs: "Jobs",
}

const PUESTOS_POR_DEPTO = 100
/** Altura de corte de los muros (vista de casa de muñecas). */
const H = 2.8
const T_MURO = 0.24
/** Separación de columnas de escritorios: 5 a cada lado del pasillo central. */
const OFF_X = [-15.4, -12.3, -9.2, -6.1, -3.0, 3.0, 6.1, 9.2, 12.3, 15.4]
/** Fila 0 (la del frente) a z0 + 10; cada fila 2,4 m más atrás. */
const FILA_Z0 = 10
const FILA_PASO = 2.4

/**
 * Dónde se sienta el líder: x = centro de la celda, z = z0 + 3, mirando a su
 * equipo (+z, rumbo 0). El punto queda libre (sin silla ni mueble) para que
 * el avatar llegue caminando desde la puerta.
 */
export function puestoLider(depId: string): { pos: Vec3; rumbo: number } | null {
  const d = DEPARTAMENTOS_BASE.find((x) => x.id === depId)
  if (!d) return null
  const c = celdaDe(d.lugarId)
  if (!c) return null
  return { pos: { x: c.cx, y: ALTURA_NIVEL[c.nivel], z: c.cz - SUB_MEDIO_FONDO + 3 }, rumbo: 0 }
}

function celdaDe(lugarId: string): { nivel: "n1" | "n2" | "n3"; cx: number; cz: number } | null {
  for (const nivel of ["n1", "n2", "n3"] as const) {
    for (let r = 0; r < CELDAS[nivel].length; r++) {
      const c = CELDAS[nivel][r].indexOf(lugarId)
      if (c >= 0) return { nivel, cx: SUB_COLUMNAS[c], cz: SUB_FILAS[r] }
    }
  }
  return null
}

// Pisos con contraste: celdas de concreto medio y pasillos oscuros con tiras
// de luz. Con todo claro (como antes) la maqueta se lavaba a blanco.
const PAL = {
  concreto: "#a29d95",
  pasillo: "#33363c",
  losa: "#2b2c2f",
  muro: "#e8e3db",
  remate: "#202329",
  columna: "#e2dfd9",
  roble: "#d9b98b",
  nogal: "#5c3c27",
  madera: "#b98a5c",
  blanco: "#f4f2ed",
  negro: "#15171b",
  grafito: "#2c3037",
  cromo: "#d9dde2",
  laton: "#c9a15b",
  tela: "#2a2f38",
  maceta: "#ece8e1",
  tierra: "#3a2a1f",
  luzFria: "#e4f1ff",
  luzCalida: "#ffd6a0",
  piedraOscura: "#1c1f26",
}
const HOJAS = ["#3f7d3c", "#4f9142", "#2f6a43", "#5f9c49", "#376f35", "#6aa456"]
const PIELES = ["#f1c9a8", "#e3ae88", "#c98a64", "#a86a4a", "#7c4b32", "#f5d6bd", "#d49a72", "#8f5a3c"]

// Estados de los puestos
const COLOR_LIBRE = "#5a687c"
const COLOR_LIBRE_CABEZA = "#7d8a9c"
const COLOR_ENTREGADO = "#38d27f"
const PANTALLA_APAGADA = "#0c1118"

// ── Acabados (rugosidad, metal, brillo propio) ──────────────────
type Acabado = { r: number; m: number; e?: number }
const A = {
  mate: { r: 0.82, m: 0 } as Acabado,
  tela: { r: 0.95, m: 0 } as Acabado,
  satin: { r: 0.5, m: 0 } as Acabado,
  laca: { r: 0.26, m: 0 } as Acabado,
  pulido: { r: 0.11, m: 0 } as Acabado,
  metal: { r: 0.34, m: 0.85 } as Acabado,
  cromo: { r: 0.12, m: 1 } as Acabado,
  espejo: { r: 0.03, m: 1 } as Acabado,
  luz: (e: number): Acabado => ({ r: 1, m: 0, e }),
}

// ── Utilidades de color y azar ──────────────────────────────────
type Col = THREE.Color | string
const _cache = new Map<string, THREE.Color>()
function C(c: Col): THREE.Color {
  if (typeof c !== "string") return c
  let k = _cache.get(c)
  if (!k) {
    k = new THREE.Color(c)
    _cache.set(c, k)
  }
  return k
}
function mezcla(a: Col, b: Col, t: number): THREE.Color {
  return C(a).clone().lerp(C(b), t)
}
function colorDe(depId: string): string {
  return COLOR_DEPTO[depId] ?? "#9aa4b5"
}
/** Para leer texto de color sobre fondo oscuro: aclara los tonos muy oscuros. */
function aclarar(hex: string): string {
  const c = new THREE.Color(hex)
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  if (l > 0.3) return hex
  return "#" + c.lerp(new THREE.Color(1, 1, 1), 0.4).getHexString()
}
function azar(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// ── Prototipos de geometría (sin índice, se transforman al fusionar) ──
const PROTO = new Map<string, THREE.BufferGeometry>()
function proto(k: string, f: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = PROTO.get(k)
  if (!g) {
    g = f()
    if (g.index) g = g.toNonIndexed()
    PROTO.set(k, g)
  }
  return g
}
const BOX = () => proto("box", () => new THREE.BoxGeometry(1, 1, 1))
/** Cilindro de radio 1 abajo y `rt` arriba, alto 1, centrado. */
const CIL = (n: number, rt = 1, abierto = false) =>
  proto(`cil${n}-${rt}-${abierto}`, () => new THREE.CylinderGeometry(rt, 1, 1, n, 1, abierto))
const ESF = (w: number, h: number) => proto(`esf${w}-${h}`, () => new THREE.SphereGeometry(1, w, h))
const ICO = (d: number) =>
  proto(`ico${d}`, () => {
    const g = new THREE.IcosahedronGeometry(1, d)
    // normales esféricas: se ve redondo con pocos triángulos
    const p = g.attributes.position
    const n = g.attributes.normal
    for (let i = 0; i < p.count; i++) n.setXYZ(i, p.getX(i), p.getY(i), p.getZ(i))
    return g
  })
const PLANO = () => proto("plano", () => new THREE.PlaneGeometry(1, 1))
const ARO = (rel: number, n: number, a0: number, da: number) =>
  proto(`aro${rel.toFixed(4)}-${n}-${a0.toFixed(3)}-${da.toFixed(3)}`, () => new THREE.RingGeometry(rel, 1, n, 1, a0, da))
const TORO = (rel: number, n: number, m = 8) => proto(`toro${rel.toFixed(4)}-${n}-${m}`, () => new THREE.TorusGeometry(1, rel, m, n))
const CAPS = (r: number, l: number, cs: number, rs: number) =>
  proto(`caps${r}-${l}-${cs}-${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs))
/** Pirámide de base cuadrada (4 lados), ancho 2 x 2 abajo, punta arriba. */
const PIRAMIDE = (rt: number) =>
  proto(`pir${rt}`, () => {
    const g = new THREE.CylinderGeometry(rt, 1, 1, 4, 1, true)
    g.rotateY(Math.PI / 4)
    g.scale(Math.SQRT2, 1, Math.SQRT2)
    return g
  })

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
/** Matriz: posición, escala y rotación (orden YXZ). */
function M(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, "YXZ")
  _q.setFromEuler(_e)
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz))
}

type Rect = { uv: [number, number, number, number]; w: number; h: number }

// ── Lote: acumula piezas y las fusiona en UNA geometría ─────────
class Buf {
  a: Float32Array
  n = 0
  constructor(cap = 4096) {
    this.a = new Float32Array(cap)
  }
  push(x: number) {
    if (this.n >= this.a.length) {
      const b = new Float32Array(this.a.length * 2)
      b.set(this.a)
      this.a = b
    }
    this.a[this.n++] = x
  }
  final(): Float32Array {
    return this.a.slice(0, this.n)
  }
}

class Lote {
  private p = new Buf()
  private n = new Buf()
  private c = new Buf()
  private a = new Buf()
  private u = new Buf()
  private pila: THREE.Matrix4[] = [new THREE.Matrix4()]
  private nm = new THREE.Matrix3()
  private v = new THREE.Vector3()
  private w = new THREE.Vector3()

  get vacio(): boolean {
    return this.p.n === 0
  }

  /** Dibuja dentro de un sistema local (mueble rotado, etc.). */
  en(m: THREE.Matrix4, fn: () => void) {
    this.pila.push(this.pila[this.pila.length - 1].clone().multiply(m))
    fn()
    this.pila.pop()
  }

  geo(g: THREE.BufferGeometry, m: THREE.Matrix4, col: Col, ac: Acabado, op?: { uv?: [number, number, number, number]; grad?: [number, number] }) {
    const T = this.pila[this.pila.length - 1].clone().multiply(m)
    this.nm.getNormalMatrix(T)
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute | undefined
    const k = C(col)
    const e = ac.e ?? 0
    for (let i = 0; i < pos.count; i++) {
      this.v.fromBufferAttribute(pos, i)
      const ly = this.v.y
      this.v.applyMatrix4(T)
      this.p.push(this.v.x)
      this.p.push(this.v.y)
      this.p.push(this.v.z)
      this.w.fromBufferAttribute(nor, i).applyMatrix3(this.nm).normalize()
      this.n.push(this.w.x)
      this.n.push(this.w.y)
      this.n.push(this.w.z)
      let f = 1
      if (op?.grad) f = op.grad[0] + (op.grad[1] - op.grad[0]) * Math.min(1, Math.max(0, ly + 0.5))
      this.c.push(k.r * f)
      this.c.push(k.g * f)
      this.c.push(k.b * f)
      this.a.push(ac.r)
      this.a.push(ac.m)
      this.a.push(e)
      if (op?.uv && uv) {
        const r = op.uv
        this.u.push(r[0] + (r[2] - r[0]) * uv.getX(i))
        this.u.push(r[1] + (r[3] - r[1]) * uv.getY(i))
      } else {
        this.u.push(0)
        this.u.push(0)
      }
    }
  }

  /** Caja por extremos. */
  ext(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: Col, ac: Acabado) {
    this.geo(BOX(), M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0), col, ac)
  }
  /** Caja apoyada en y0, rotada en y. */
  caja(x: number, y0: number, z: number, w: number, h: number, d: number, col: Col, ac: Acabado, ry = 0, rx = 0, rz = 0) {
    this.geo(BOX(), M(x, y0 + h / 2, z, w, h, d, ry, rx, rz), col, ac)
  }
  /** Cilindro vertical apoyado en y0 (rt = radio de arriba relativo). */
  cil(x: number, y0: number, z: number, r: number, h: number, col: Col, ac: Acabado, n = 12, rt = 1) {
    this.geo(CIL(n, rt), M(x, y0 + h / 2, z, r, h, r), col, ac)
  }
  esf(x: number, y: number, z: number, r: number, col: Col, ac: Acabado, sy = 1, w = 12, h = 8) {
    this.geo(ESF(w, h), M(x, y, z, r, r * sy, r), col, ac)
  }
  blob(x: number, y: number, z: number, r: number, col: Col, ac: Acabado, sy = 1, d = 1) {
    this.geo(ICO(d), M(x, y, z, r, r * sy, r), col, ac)
  }
  /** Cilindro de un punto a otro (cables, barandas, patas). */
  barra(a: [number, number, number], b: [number, number, number], r: number, col: Col, ac: Acabado, n = 6) {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    if (len < 1e-5) return
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r))
    this.geo(CIL(n), m, col, ac)
  }
  /** Plano vertical que mira hacia (sin ry, 0, cos ry). */
  quad(x: number, y: number, z: number, w: number, h: number, ry: number, col: Col, ac: Acabado, uv?: [number, number, number, number]) {
    this.geo(PLANO(), M(x, y, z, w, h, 1, ry), col, ac, { uv })
  }
  /** Plano horizontal que mira hacia arriba (lo alto de la textura queda al norte). */
  piso(x0: number, x1: number, z0: number, z1: number, y: number, col: Col, ac: Acabado, uv?: [number, number, number, number]) {
    this.geo(PLANO(), M((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, z1 - z0, 1, 0, -Math.PI / 2), col, ac, { uv })
  }
  /** Aro plano en el piso. Ángulo 0 = +x; ángulos positivos giran hacia -z. */
  aro(x: number, y: number, z: number, rIn: number, rOut: number, col: Col, ac: Acabado, n = 48, a0 = 0, da = Math.PI * 2) {
    this.geo(ARO(rIn / rOut, n, a0, da), M(x, y, z, rOut, rOut, 1, 0, -Math.PI / 2), col, ac)
  }
  /** Toro: por defecto acostado (eje vertical). */
  toro(x: number, y: number, z: number, R: number, r: number, col: Col, ac: Acabado, n = 24, rx = Math.PI / 2, ry = 0) {
    this.geo(TORO(r / R, n), M(x, y, z, R, R, R, ry, rx), col, ac)
  }
  /** Triángulo de dos caras (telas, alas). */
  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], col: Col, ac: Acabado) {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3))
    g.computeVertexNormals()
    this.geo(g, new THREE.Matrix4(), col, ac)
  }

  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(this.p.final(), 3))
    g.setAttribute("normal", new THREE.BufferAttribute(this.n.final(), 3))
    g.setAttribute("color", new THREE.BufferAttribute(this.c.final(), 3))
    g.setAttribute("aAcabado", new THREE.BufferAttribute(this.a.final(), 3))
    g.setAttribute("uv", new THREE.BufferAttribute(this.u.final(), 2))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

// ── Materiales del subsuelo ─────────────────────────────────────
interface MatsSub {
  /** Color, rugosidad, metal y brillo por vértice: casi todo lo fijo. */
  maqueta: THREE.MeshStandardMaterial
  vidrio: THREE.MeshStandardMaterial
  aditiva: THREE.MeshBasicMaterial
  pantalla: THREE.MeshBasicMaterial
  indicador: THREE.MeshBasicMaterial
  tiempo: { value: number }
}

function crearMats(ctx: CtxEscena): MatsSub {
  const tiempo = { value: 0 }
  const maqueta = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 1,
  })
  maqueta.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aAcabado;\nvarying vec3 vAcabado;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAcabado = aAcabado;")
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAcabado;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = vAcabado.x;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = vAcabado.y;")
      // `emissive` funciona como intensidad (la sube de noche el motor)
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance = diffuseColor.rgb * vAcabado.z * emissive.r;",
      )
  }
  maqueta.customProgramCacheKey = () => "cb-subsuelo-maqueta-1"
  // Las luces de un sótano siempre están prendidas; de noche brillan un poco más.
  ctx.alAnochecer(maqueta, 1.35, 1)

  const vidrio = new THREE.MeshStandardMaterial({
    color: "#cfe9f2",
    transparent: true,
    opacity: 0.16,
    roughness: 0.04,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.6,
  })

  const aditiva = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })

  // Pantallas: color por instancia (estado), "líneas de código" que se
  // escriben solas y un latido cuando el puesto trabaja.
  const pantalla = new THREE.MeshBasicMaterial({ color: 0xffffff })
  pantalla.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPulso;\nvarying float vPulso;\nvarying vec2 vUvP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPulso = aPulso;\nvUvP = uv;")
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTiempo;\nvarying float vPulso;\nvarying vec2 vUvP;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vPulso > 0.5) {
          float latido = 0.8 + 0.2 * sin(uTiempo * 2.6 + vPulso * 6.0);
          if (vUvP.x >= 0.0) {
            float fy = vUvP.y * 9.0;
            float fila = floor(fy);
            float paso = floor(uTiempo * 1.3 + vPulso * 13.0 + fila * 0.37);
            float largo = 0.2 + 0.75 * fract(sin(fila * 12.9898 + paso * 78.233 + vPulso * 3.1) * 43758.5453);
            float enFila = step(0.3, fract(fy)) * step(fract(fy), 0.78);
            float barra = enFila * step(0.07, vUvP.x) * step(vUvP.x, 0.07 + largo * 0.86);
            diffuseColor.rgb *= (0.34 + 0.9 * barra) * latido;
          } else {
            diffuseColor.rgb *= 0.5 * latido;
          }
        } else if (vUvP.x < 0.0) {
          diffuseColor.rgb *= 0.5;
        }`,
      )
  }
  pantalla.customProgramCacheKey = () => "cb-subsuelo-pantalla-1"

  // Indicador de "entregado": un rombo verde que flota y gira.
  const indicador = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.4, 1.0), toneMapped: false })
  indicador.onBeforeCompile = (s) => {
    s.uniforms.uTiempo = tiempo
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTiempo;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float fi = float(gl_InstanceID) * 0.9;
        float ang = uTiempo * 1.6 + fi;
        vec3 c0 = vec3(0.0, 1.74, 0.07);
        vec3 d = transformed - c0;
        d.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d.xz;
        transformed = c0 + d + vec3(0.0, sin(uTiempo * 2.2 + fi) * 0.05, 0.0);`,
      )
  }
  indicador.customProgramCacheKey = () => "cb-subsuelo-indicador-1"

  return { maqueta, vidrio, aditiva, pantalla, indicador, tiempo }
}

// ── Texturas dibujadas (CanvasTexture, nada externo) ────────────
const FUENTE = "'Bricolage Grotesque', 'Manrope', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

function lienzo(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")
  if (!g) throw new Error("subsuelo: el navegador no dio un contexto 2D")
  return { c, g }
}
function textura(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}
function rect(W: number, Hh: number, x: number, y: number, w: number, h: number): Rect {
  return { uv: [x / W, 1 - (y + h) / Hh, (x + w) / W, 1 - y / Hh], w, h }
}
/** Escribe partes de colores en una línea centrada, achicando la letra si no entra. */
function lineaColores(
  g: CanvasRenderingContext2D,
  partes: Array<{ t: string; c: string; peso?: number }>,
  cx: number,
  cy: number,
  tam: number,
  max: number,
) {
  const medir = (s: number) =>
    partes.reduce((acc, p) => {
      g.font = `${p.peso ?? 800} ${s}px ${FUENTE}`
      return acc + g.measureText(p.t).width
    }, 0)
  let s = tam
  let ancho = medir(s)
  if (ancho > max) {
    s = Math.floor((s * max) / ancho)
    ancho = medir(s)
  }
  g.textBaseline = "middle"
  let x = cx - ancho / 2
  for (const p of partes) {
    g.font = `${p.peso ?? 800} ${s}px ${FUENTE}`
    g.fillStyle = p.c
    g.fillText(p.t, x, cy)
    x += g.measureText(p.t).width
  }
}

/** Nombre corto del lugar para la señalética. */
function nombreLugar(lugarId: string): string {
  const d = DEPARTAMENTOS_BASE.find((x) => x.lugarId === lugarId)
  if (d) return d.nombre
  return LUGAR[lugarId]?.nombre ?? lugarId
}
function colorLugar(lugarId: string): string {
  const d = DEPARTAMENTOS_BASE.find((x) => x.lugarId === lugarId)
  if (d) return colorDe(d.id)
  return "#c9a15b"
}

/** Atlas de rótulos de un nivel: carteles de equipo, título, directorio y tótems. */
function atlasRotulos(nivel: "n1" | "n2" | "n3"): { tex: THREE.CanvasTexture; uv: Record<string, Rect> } {
  const W = 2048
  const Hh = 2048
  const { c, g } = lienzo(W, Hh)
  const uv: Record<string, Rect> = {}
  let y = 0
  const lugares = CELDAS[nivel].flat()
  // Carteles de equipo: "<DEPTO.> · <LÍDER> · 100 AGENTES"
  for (const lugarId of lugares) {
    const d = DEPARTAMENTOS_BASE.find((x) => x.lugarId === lugarId)
    if (!d) continue
    const h = 136
    const color = colorDe(d.id)
    g.save()
    g.translate(0, y)
    const fondo = g.createLinearGradient(0, 0, 0, h)
    fondo.addColorStop(0, "#1a2336")
    fondo.addColorStop(1, "#0a0f1a")
    g.fillStyle = fondo
    g.fillRect(0, 0, W, h)
    g.fillStyle = color
    g.fillRect(0, 0, 20, h)
    g.fillRect(W - 20, 0, 20, h)
    g.globalAlpha = 0.95
    g.fillRect(20, h - 7, W - 40, 7)
    g.globalAlpha = 1
    g.strokeStyle = "rgba(255,255,255,0.12)"
    g.lineWidth = 2
    g.strokeRect(26, 5, W - 52, h - 16)
    lineaColores(
      g,
      [
        { t: d.nombre.toUpperCase(), c: "#F5F7FB" },
        { t: "  ·  ", c: "#5d697e" },
        { t: (LIDER_CORTO[d.id] ?? d.id).toUpperCase(), c: aclarar(color) },
        { t: "  ·  ", c: "#5d697e" },
        { t: `${PUESTOS_POR_DEPTO} AGENTES`, c: "#A9B4C6", peso: 700 },
      ],
      W / 2,
      h / 2 - 3,
      74,
      W - 170,
    )
    g.restore()
    uv[`cartel-${d.id}`] = rect(W, Hh, 0, y, W, h)
    y += h
  }
  // Título del nivel (izquierda) y directorio (derecha)
  {
    const h = 160
    const [a, b] = NOMBRE_NIVEL[nivel].split(" · ")
    g.save()
    g.translate(0, y)
    g.fillStyle = "#11141b"
    g.fillRect(0, 0, 1024, h)
    g.fillStyle = PAL.laton
    g.fillRect(0, h - 5, 1024, 5)
    g.fillRect(40, 30, 6, h - 64)
    g.textBaseline = "middle"
    g.font = `800 70px ${FUENTE}`
    g.fillStyle = "#F4F1EA"
    g.fillText(a.toUpperCase(), 72, 62)
    g.font = `700 32px ${FUENTE}`
    g.fillStyle = PAL.laton
    g.fillText((b ?? "").toUpperCase(), 74, 118)
    // directorio
    g.translate(1024, 0)
    g.fillStyle = "#11141b"
    g.fillRect(0, 0, 1024, h)
    g.fillStyle = PAL.laton
    g.fillRect(0, h - 5, 1024, 5)
    lugares.forEach((lid, i) => {
      const col = i % 4
      const fila = Math.floor(i / 4)
      const x = 24 + col * 250
      const yy = 14 + fila * 46
      g.fillStyle = colorLugar(lid)
      g.fillRect(x, yy + 9, 14, 24)
      g.fillStyle = "#E8E6E1"
      g.font = `700 21px ${FUENTE}`
      g.textBaseline = "middle"
      let t = nombreLugar(lid).toUpperCase()
      while (g.measureText(t).width > 214 && t.length > 4) t = t.slice(0, -2) + "…"
      g.fillText(t, x + 24, yy + 22)
    })
    g.restore()
    uv.titulo = rect(W, Hh, 0, y, 1024, h)
    uv.directorio = rect(W, Hh, 1024, y, 1024, h)
    y += h
  }
  // Tótems de cada celda
  lugares.forEach((lid, i) => {
    const w = 512
    const h = 128
    const x = (i % 4) * w
    const yy = y + Math.floor(i / 4) * h
    const color = colorLugar(lid)
    g.save()
    g.translate(x, yy)
    g.fillStyle = "#121722"
    g.fillRect(0, 0, w, h)
    g.fillStyle = color
    g.fillRect(0, 0, 16, h)
    g.fillStyle = "rgba(255,255,255,0.10)"
    g.fillRect(16, h - 4, w - 16, 4)
    const d = DEPARTAMENTOS_BASE.find((x2) => x2.lugarId === lid)
    lineaColores(g, [{ t: nombreLugar(lid).toUpperCase(), c: "#F3F5F8" }], w / 2 + 8, d ? 50 : h / 2, 40, w - 60)
    if (d) lineaColores(g, [{ t: (LIDER_CORTO[d.id] ?? d.id).toUpperCase(), c: aclarar(color), peso: 700 }], w / 2 + 8, 96, 28, w - 60)
    g.restore()
    uv[`totem-${lid}`] = rect(W, Hh, x, yy, w, h)
  })
  return { tex: textura(c), uv }
}

// Contornos simplificados de los continentes (lon, lat) para los mapas de puntos.
const CONTINENTES: number[][][] = [
  // Norteamérica
  [[-168, 66], [-162, 70], [-140, 70], [-125, 70], [-95, 72], [-80, 73], [-62, 66], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-84, 30], [-90, 29], [-97, 26], [-97, 21], [-92, 18], [-87, 21], [-88, 16], [-83, 10], [-78, 8], [-80, 7], [-86, 12], [-92, 14], [-100, 17], [-105, 20], [-110, 24], [-112, 29], [-117, 32], [-120, 35], [-124, 40], [-124, 46], [-127, 51], [-133, 56], [-140, 60], [-150, 60], [-158, 57], [-165, 60]],
  // Groenlandia
  [[-73, 78], [-60, 82], [-30, 83], [-20, 78], [-22, 70], [-40, 65], [-50, 62], [-55, 68]],
  // Sudamérica
  [[-80, 8], [-75, 11], [-70, 12], [-62, 11], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-35, -10], [-39, -15], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-62, -40], [-65, -45], [-68, -50], [-69, -55], [-73, -53], [-75, -47], [-73, -40], [-72, -30], [-71, -20], [-76, -14], [-81, -6], [-81, -2], [-78, 2], [-77, 7]],
  // Eurasia
  [[-10, 36], [-9, 43], [-1, 46], [-4, 48], [2, 51], [8, 54], [9, 57], [5, 58], [5, 62], [12, 66], [18, 70], [26, 71], [40, 68], [55, 70], [70, 73], [80, 73], [100, 78], [115, 74], [130, 72], [140, 72], [160, 70], [175, 68], [180, 66], [178, 62], [165, 60], [160, 55], [157, 51], [143, 59], [137, 54], [141, 47], [135, 43], [130, 42], [127, 38], [126, 35], [121, 31], [122, 29], [118, 24], [110, 21], [108, 18], [109, 12], [105, 9], [100, 13], [100, 7], [103, 2], [98, 8], [97, 16], [92, 21], [88, 22], [80, 15], [77, 8], [73, 17], [70, 21], [67, 25], [57, 25], [56, 27], [50, 30], [48, 29], [52, 24], [55, 22], [57, 19], [52, 16], [45, 13], [43, 17], [39, 22], [35, 28], [33, 31], [35, 36], [30, 36], [27, 37], [26, 40], [23, 40], [22, 37], [20, 40], [19, 42], [14, 45], [12, 44], [16, 41], [18, 40], [15, 38], [12, 41], [9, 44], [3, 43], [0, 39], [-1, 37], [-6, 36]],
  // África
  [[-17, 21], [-17, 15], [-12, 8], [-8, 4], [-2, 5], [5, 4], [9, 4], [10, 1], [9, -1], [12, -5], [13, -11], [12, -17], [15, -27], [18, -34], [20, -35], [25, -34], [31, -29], [33, -25], [35, -24], [41, -15], [40, -10], [39, -5], [42, 0], [47, 4], [51, 11], [44, 11], [43, 12], [38, 18], [35, 24], [33, 29], [32, 31], [25, 32], [20, 31], [15, 32], [11, 34], [10, 37], [3, 37], [-2, 35], [-6, 36], [-10, 30], [-13, 27]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Australia y Oceanía
  [[114, -22], [114, -34], [118, -35], [124, -34], [131, -31], [137, -34], [140, -38], [146, -39], [150, -37], [153, -32], [153, -25], [146, -18], [143, -11], [141, -13], [136, -12], [132, -11], [129, -15], [125, -14], [122, -18]],
  [[172, -34], [178, -38], [174, -41], [167, -46], [172, -41]],
  [[131, -1], [141, -3], [150, -10], [141, -9], [134, -4]],
  // Islas
  [[-6, 50], [2, 51], [0, 53], [-2, 56], [-3, 59], [-6, 58], [-5, 55], [-3, 54]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  [[130, 31], [134, 34], [140, 35], [142, 40], [141, 45], [140, 41], [136, 36], [130, 33]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
  [[95, 5], [104, -2], [106, -6], [101, -3]],
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
]
function enTierra(lon: number, lat: number): boolean {
  let dentro = false
  for (const pol of CONTINENTES) {
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const [xi, yi] = pol[i]
      const [xj, yj] = pol[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
    }
    if (dentro) return true
  }
  return false
}
/** Mapa del mundo de puntos (equirectangular) en el rectángulo dado. */
function mapaPuntos(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, paso: number, color: string, filtro?: (px: number, py: number) => boolean) {
  g.fillStyle = color
  const r = paso * 0.36
  for (let py = y + paso / 2; py < y + h; py += paso) {
    for (let px = x + paso / 2; px < x + w; px += paso) {
      if (filtro && !filtro(px, py)) continue
      const lon = ((px - x) / w) * 360 - 180
      const lat = 90 - ((py - y) / h) * 180
      if (!enTierra(lon, lat)) continue
      g.beginPath()
      g.arc(px, py, r, 0, Math.PI * 2)
      g.fill()
    }
  }
}
function lonLat(x: number, y: number, w: number, h: number, lon: number, lat: number): [number, number] {
  return [x + ((lon + 180) / 360) * w, y + ((90 - lat) / 180) * h]
}
/** Arco luminoso entre dos puntos del mapa. */
function arcoMapa(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], color: string, ancho: number) {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35
  g.save()
  g.strokeStyle = color
  g.lineWidth = ancho
  g.shadowColor = color
  g.shadowBlur = ancho * 5
  g.beginPath()
  g.moveTo(a[0], a[1])
  g.quadraticCurveTo(mx, my, b[0], b[1])
  g.stroke()
  g.restore()
}
function puntoBrillo(g: CanvasRenderingContext2D, p: [number, number], r: number, color: string) {
  g.save()
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = r * 4
  g.beginPath()
  g.arc(p[0], p[1], r, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

// Ciudades reales del reto: de Santa Cruz de la Sierra a Silicon Valley.
const SANTA_CRUZ: [number, number] = [-63.18, -17.78]
const SILICON_VALLEY: [number, number] = [-122.08, 37.39]
const WASHINGTON: [number, number] = [-77.04, 38.9]

/** Texturas especiales de cada nivel (letrero de café, mapa, pantallas, vitral, cine…). */
function atlasEspecial(nivel: "n1" | "n2" | "n3"): { tex: THREE.CanvasTexture; uv: Record<string, Rect> } {
  const uv: Record<string, Rect> = {}
  if (nivel === "n1") {
    const W = 1024
    const Hh = 512
    const { c, g } = lienzo(W, Hh)
    // Letrero de neón "COFFEE" (fondo transparente)
    g.save()
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `italic 800 150px ${FUENTE}`
    for (const [blur, col, ancho] of [
      [40, "rgba(255,120,40,0.9)", 16],
      [18, "rgba(255,170,80,1)", 10],
      [6, "rgba(255,226,180,1)", 5],
    ] as Array<[number, string, number]>) {
      g.shadowColor = col
      g.shadowBlur = blur
      g.strokeStyle = col
      g.lineWidth = ancho
      g.strokeText("COFFEE", 512, 128)
    }
    g.shadowBlur = 0
    g.fillStyle = "rgba(255,246,230,1)"
    g.lineWidth = 3
    g.strokeStyle = "rgba(255,250,240,1)"
    g.strokeText("COFFEE", 512, 128)
    g.restore()
    uv.coffee = rect(W, Hh, 0, 0, 1024, 256)
    // Pizarra del menú (sin precios)
    g.save()
    g.translate(0, 256)
    g.fillStyle = "#6b4a2f"
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = "#1f2623"
    g.fillRect(14, 14, 484, 228)
    g.fillStyle = "#EDEBE4"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `800 40px ${FUENTE}`
    g.fillText("MENÚ", 256, 50)
    g.font = `600 24px ${FUENTE}`
    const items = ["ESPRESSO", "CORTADO", "AMERICANO", "LATTE", "CAPUCHINO", "TÉ VERDE"]
    items.forEach((t, i) => g.fillText(t, i % 2 === 0 ? 150 : 362, 104 + Math.floor(i / 2) * 44))
    g.restore()
    uv.menu = rect(W, Hh, 0, 256, 512, 256)
    return { tex: textura(c), uv }
  }
  if (nivel === "n2") {
    const W = 2048
    const Hh = 1024
    const { c, g } = lienzo(W, Hh)
    // Mesa de la Sala de guerra: disco con el mapa del mundo
    {
      const cx = 512
      const cy = 512
      const R = 500
      g.save()
      g.beginPath()
      g.arc(cx, cy, R, 0, Math.PI * 2)
      g.clip()
      const fondo = g.createRadialGradient(cx, cy, 30, cx, cy, R)
      fondo.addColorStop(0, "#0c2a3d")
      fondo.addColorStop(1, "#040b14")
      g.fillStyle = fondo
      g.fillRect(0, 0, 1024, 1024)
      g.strokeStyle = "rgba(110,220,255,0.18)"
      g.lineWidth = 2
      for (let r = 80; r < R; r += 80) {
        g.beginPath()
        g.arc(cx, cy, r, 0, Math.PI * 2)
        g.stroke()
      }
      for (let a = 0; a < 12; a++) {
        g.beginPath()
        g.moveTo(cx, cy)
        g.lineTo(cx + Math.cos((a * Math.PI) / 6) * R, cy + Math.sin((a * Math.PI) / 6) * R)
        g.stroke()
      }
      const mx = 62
      const mw = 900
      const mh = 450
      const my = cy - mh / 2 + 20
      mapaPuntos(g, mx, my, mw, mh, 9, "rgba(120,225,255,0.85)", (px, py) => Math.hypot(px - cx, py - cy) < R - 18)
      const scz = lonLat(mx, my, mw, mh, ...SANTA_CRUZ)
      const sv = lonLat(mx, my, mw, mh, ...SILICON_VALLEY)
      const dc = lonLat(mx, my, mw, mh, ...WASHINGTON)
      arcoMapa(g, scz, sv, "#FFC857", 5)
      arcoMapa(g, scz, dc, "rgba(255,110,90,0.9)", 4)
      puntoBrillo(g, scz, 10, "#FFE3A0")
      puntoBrillo(g, sv, 8, "#FFE3A0")
      puntoBrillo(g, dc, 7, "#FF8D7A")
      g.fillStyle = "#FFE7B5"
      g.font = `800 22px ${FUENTE}`
      g.textAlign = "left"
      g.fillText("SANTA CRUZ", scz[0] + 16, scz[1] + 8)
      g.fillText("SILICON VALLEY", sv[0] - 30, sv[1] - 22)
      g.restore()
      g.strokeStyle = "rgba(200,161,91,0.95)"
      g.lineWidth = 10
      g.beginPath()
      g.arc(cx, cy, R - 5, 0, Math.PI * 2)
      g.stroke()
      uv.mapa = rect(W, Hh, 0, 0, 1024, 1024)
    }
    // Pantallas gigantes (1024 x 256 cada una)
    const pantalla = (i: number, dibujar: (g: CanvasRenderingContext2D) => void) => {
      g.save()
      g.translate(1024, i * 256)
      const f = g.createLinearGradient(0, 0, 0, 256)
      f.addColorStop(0, "#08131f")
      f.addColorStop(1, "#050a12")
      g.fillStyle = f
      g.fillRect(0, 0, 1024, 256)
      g.strokeStyle = "rgba(110,220,255,0.10)"
      g.lineWidth = 1
      for (let x = 0; x < 1024; x += 32) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, 256)
        g.stroke()
      }
      for (let y = 0; y < 256; y += 32) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(1024, y)
        g.stroke()
      }
      dibujar(g)
      g.restore()
      uv[`pantalla${i}`] = rect(W, Hh, 1024, i * 256, 1024, 256)
    }
    pantalla(0, (g2) => {
      g2.fillStyle = "#C81E2B"
      g2.fillRect(60, 64, 10, 128)
      g2.textBaseline = "middle"
      g2.fillStyle = "#F4F6FA"
      g2.font = `800 88px ${FUENTE}`
      g2.fillText("SALA DE GUERRA", 96, 108)
      g2.fillStyle = "#C9A15B"
      g2.font = `700 34px ${FUENTE}`
      g2.fillText("CONSEJO DE LOS 22 LÍDERES", 100, 178)
    })
    pantalla(1, (g2) => {
      const mx = 40
      const my = 18
      const mw = 440
      const mh = 220
      mapaPuntos(g2, mx, my, mw, mh, 6, "rgba(120,225,255,0.75)")
      const a = lonLat(mx, my, mw, mh, ...SANTA_CRUZ)
      const b = lonLat(mx, my, mw, mh, ...SILICON_VALLEY)
      arcoMapa(g2, a, b, "#FFC857", 4)
      puntoBrillo(g2, a, 7, "#FFE3A0")
      puntoBrillo(g2, b, 6, "#FFE3A0")
      g2.textBaseline = "middle"
      g2.fillStyle = "#F4F6FA"
      g2.font = `800 46px ${FUENTE}`
      g2.fillText("SANTA CRUZ", 530, 92)
      g2.fillStyle = "#FFC857"
      g2.font = `800 30px ${FUENTE}`
      g2.fillText("→  SILICON VALLEY", 534, 150)
    })
    pantalla(2, (g2) => {
      const cx = 140
      const cy = 128
      g2.strokeStyle = "rgba(120,225,255,0.5)"
      g2.lineWidth = 2
      for (const r of [30, 60, 90, 112]) {
        g2.beginPath()
        g2.arc(cx, cy, r, 0, Math.PI * 2)
        g2.stroke()
      }
      const barrido = g2.createRadialGradient(cx, cy, 0, cx, cy, 112)
      barrido.addColorStop(0, "rgba(90,255,170,0.65)")
      barrido.addColorStop(1, "rgba(90,255,170,0.05)")
      g2.fillStyle = barrido
      g2.beginPath()
      g2.moveTo(cx, cy)
      g2.arc(cx, cy, 112, -0.9, -0.1)
      g2.fill()
      g2.textBaseline = "middle"
      g2.fillStyle = "#F4F6FA"
      g2.font = `800 58px ${FUENTE}`
      g2.fillText("OBJETIVOS", 300, 96)
      g2.fillStyle = "#9FE8C9"
      g2.font = `700 28px ${FUENTE}`
      g2.fillText("DE $10 A UN MERCEDES  ·  SILICON VALLEY  ·  MIL MILLONES", 302, 160)
    })
    pantalla(3, (g2) => {
      const deps = DEPARTAMENTOS_BASE
      g2.textBaseline = "middle"
      deps.forEach((d, i) => {
        const col = i % 6
        const fila = Math.floor(i / 6)
        const x = 22 + col * 166
        const y = 20 + fila * 56
        g2.fillStyle = colorDe(d.id)
        g2.fillRect(x, y + 8, 12, 34)
        g2.fillStyle = "#E9EDF3"
        g2.font = `700 19px ${FUENTE}`
        let t = (LIDER_CORTO[d.id] ?? d.id).toUpperCase()
        while (g2.measureText(t).width > 136 && t.length > 4) t = t.slice(0, -2) + "…"
        g2.fillText(t, x + 20, y + 25)
      })
    })
    return { tex: textura(c), uv }
  }
  // n3: vitral, pantalla de cine, "AL AIRE", diana y emblema de la cancha
  const W = 2048
  const Hh = 1024
  const { c, g } = lienzo(W, Hh)
  {
    // Vitral abstracto: celdas de vidrio de colores con plomo oscuro, arco arriba
    const w = 256
    const h = 512
    const { c: c2, g: g2 } = lienzo(w, h)
    const img = g2.createImageData(w, h)
    const rnd = azar(1792)
    const semillas = Array.from({ length: 46 }, () => [rnd() * w, rnd() * h] as [number, number])
    const tonos = ["#1f4fb8", "#2a6fd6", "#b8202e", "#e2a52a", "#1c8a5a", "#7a2fa0", "#f2c04a", "#163a8a", "#d4532b"]
    const colores = semillas.map((s, i) => new THREE.Color(tonos[(i * 7 + Math.floor(s[1] / 60)) % tonos.length]))
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let d1 = 1e9
        let d2 = 1e9
        let k = 0
        for (let i = 0; i < semillas.length; i++) {
          const dx = px - semillas[i][0]
          const dy = py - semillas[i][1]
          const d = dx * dx + dy * dy
          if (d < d1) {
            d2 = d1
            d1 = d
            k = i
          } else if (d < d2) d2 = d
        }
        const borde = Math.sqrt(d2) - Math.sqrt(d1) < 2.2
        const o = (py * w + px) * 4
        const brillo = 0.75 + 0.25 * Math.sin(px * 0.05 + py * 0.03 + k)
        const col = colores[k]
        img.data[o] = borde ? 24 : Math.min(255, col.r * 255 * brillo + 30)
        img.data[o + 1] = borde ? 20 : Math.min(255, col.g * 255 * brillo + 20)
        img.data[o + 2] = borde ? 18 : Math.min(255, col.b * 255 * brillo + 20)
        img.data[o + 3] = 255
      }
    }
    g2.putImageData(img, 0, 0)
    g.save()
    g.beginPath()
    g.moveTo(16, 1008)
    g.lineTo(16, 256)
    g.arc(256, 256, 240, Math.PI, 0)
    g.lineTo(496, 1008)
    g.closePath()
    g.clip()
    g.drawImage(c2, 0, 0, 512, 1024)
    // un sol claro al centro: luz cálida que entra
    const luz = g.createRadialGradient(256, 380, 10, 256, 380, 200)
    luz.addColorStop(0, "rgba(255,240,200,0.75)")
    luz.addColorStop(1, "rgba(255,240,200,0)")
    g.fillStyle = luz
    g.fillRect(0, 0, 512, 1024)
    g.restore()
    g.strokeStyle = "#2a2420"
    g.lineWidth = 14
    g.beginPath()
    g.moveTo(16, 1008)
    g.lineTo(16, 256)
    g.arc(256, 256, 240, Math.PI, 0)
    g.lineTo(496, 1008)
    g.closePath()
    g.stroke()
    uv.vitral = rect(W, Hh, 0, 0, 512, 1024)
  }
  {
    // Pantalla de cine: atardecer sobre una ciudad y el título del proyecto
    g.save()
    g.translate(512, 0)
    const cielo = g.createLinearGradient(0, 0, 0, 512)
    cielo.addColorStop(0, "#141a4a")
    cielo.addColorStop(0.45, "#7a2d6e")
    cielo.addColorStop(0.75, "#f0713a")
    cielo.addColorStop(1, "#ffc46b")
    g.fillStyle = cielo
    g.fillRect(0, 0, 1024, 512)
    const sol = g.createRadialGradient(512, 400, 10, 512, 400, 220)
    sol.addColorStop(0, "rgba(255,236,170,1)")
    sol.addColorStop(0.25, "rgba(255,200,120,0.8)")
    sol.addColorStop(1, "rgba(255,160,90,0)")
    g.fillStyle = sol
    g.fillRect(0, 0, 1024, 512)
    const rnd = azar(2026)
    g.fillStyle = "#120f24"
    for (let x = 0; x < 1024; ) {
      const bw = 26 + rnd() * 60
      const bh = 50 + rnd() * 150
      g.fillRect(x, 512 - bh, bw, bh)
      g.fillStyle = "rgba(255,210,140,0.7)"
      for (let wy = 512 - bh + 10; wy < 500; wy += 14) for (let wx = x + 6; wx < x + bw - 6; wx += 10) if (rnd() < 0.3) g.fillRect(wx, wy, 4, 6)
      g.fillStyle = "#120f24"
      x += bw + 2
    }
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = "#FFF6E8"
    g.shadowColor = "rgba(0,0,0,0.5)"
    g.shadowBlur = 18
    g.font = `800 74px ${FUENTE}`
    g.fillText("LA CASA BLANCA", 512, 150)
    g.font = `700 40px ${FUENTE}`
    g.fillStyle = "#FFD79A"
    g.fillText("PROJECT", 512, 214)
    g.restore()
    uv.cine = rect(W, Hh, 512, 0, 1024, 512)
  }
  {
    // "AL AIRE" del estudio
    g.save()
    g.translate(512, 512)
    g.fillStyle = "#5a0c12"
    g.fillRect(0, 0, 512, 128)
    g.fillStyle = "#ff3344"
    g.fillRect(10, 10, 492, 108)
    g.fillStyle = "#fff2f2"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `800 72px ${FUENTE}`
    g.fillText("AL AIRE", 256, 66)
    g.restore()
    uv.alAire = rect(W, Hh, 512, 512, 512, 128)
  }
  {
    // Diana de dardos (20 sectores)
    g.save()
    g.translate(1536 + 256, 256)
    const sect = (r0: number, r1: number, a: number, col: string) => {
      g.fillStyle = col
      g.beginPath()
      g.arc(0, 0, r1, a, a + Math.PI / 10)
      g.arc(0, 0, r0, a + Math.PI / 10, a, true)
      g.closePath()
      g.fill()
    }
    g.fillStyle = "#151515"
    g.beginPath()
    g.arc(0, 0, 250, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10 - Math.PI / 20
      const par = i % 2 === 0
      sect(20, 200, a, par ? "#1b1b1b" : "#efe2c2")
      sect(110, 124, a, par ? "#c8202c" : "#1f8a4a")
      sect(186, 200, a, par ? "#c8202c" : "#1f8a4a")
    }
    g.fillStyle = "#1f8a4a"
    g.beginPath()
    g.arc(0, 0, 20, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = "#c8202c"
    g.beginPath()
    g.arc(0, 0, 9, 0, Math.PI * 2)
    g.fill()
    g.restore()
    uv.diana = rect(W, Hh, 1536, 0, 512, 512)
  }
  {
    // Emblema del círculo central de la cancha
    g.save()
    g.translate(1536 + 256, 512 + 256)
    g.fillStyle = "#16294d"
    g.beginPath()
    g.arc(0, 0, 246, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = "#f4f1ea"
    g.lineWidth = 10
    g.beginPath()
    g.arc(0, 0, 220, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = "#f4f1ea"
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 70 : 28
      const a = (i * Math.PI) / 5 - Math.PI / 2
      if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r - 40)
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r - 40)
    }
    g.closePath()
    g.fill()
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `800 50px ${FUENTE}`
    g.fillText("CASA BLANCA", 0, 80)
    g.font = `700 28px ${FUENTE}`
    g.fillStyle = "#C9A15B"
    g.fillText("PROJECT", 0, 128)
    g.restore()
    uv.emblema = rect(W, Hh, 1536, 512, 512, 512)
  }
  return { tex: textura(c), uv }
}

/** Lomos de libros: 4 bandas que se repiten a lo largo de los estantes. */
function texturaLomos(): THREE.CanvasTexture {
  const { c, g } = lienzo(1024, 512)
  const rnd = azar(1450)
  const tonos = ["#7a1f24", "#1f3a68", "#2d5a3a", "#b4842e", "#e9dfc8", "#1b1b1f", "#5a2a4a", "#8a4a22", "#2f6b7a", "#c9b38a", "#3a3f4a"]
  for (let b = 0; b < 4; b++) {
    const y0 = b * 128
    g.fillStyle = "#24170f"
    g.fillRect(0, y0, 1024, 128)
    let x = 0
    while (x < 1024) {
      let w = 10 + Math.floor(rnd() * 18)
      if (x + w > 1024 - 8) w = 1024 - x
      const h = 86 + Math.floor(rnd() * 38)
      const col = tonos[Math.floor(rnd() * tonos.length)]
      g.fillStyle = col
      g.fillRect(x + 1, y0 + 128 - h, w - 2, h)
      g.fillStyle = "rgba(255,255,255,0.10)"
      g.fillRect(x + 1, y0 + 128 - h, 2, h)
      if (rnd() < 0.6) {
        g.fillStyle = "rgba(214,178,98,0.85)"
        g.fillRect(x + 2, y0 + 128 - h + 10, w - 4, 3)
        g.fillRect(x + 2, y0 + 128 - 16, w - 4, 3)
      }
      x += w
    }
  }
  const t = textura(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Mapa de normales del agua (ondas que se repiten sin costura). */
function texturaOlas(): THREE.CanvasTexture {
  const N = 256
  const { c, g } = lienzo(N, N)
  const img = g.createImageData(N, N)
  const ondas = [
    [3, 1, 0.5, 0.2],
    [1, 4, 0.4, 1.3],
    [5, 3, 0.25, 2.1],
    [7, -2, 0.18, 0.7],
    [-4, 6, 0.15, 2.8],
  ]
  const alt = (x: number, y: number) =>
    ondas.reduce((s, [fx, fy, a, ph]) => s + a * Math.sin(((fx * x + fy * y) / N) * Math.PI * 2 + ph), 0)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = alt(x + 1, y) - alt(x - 1, y)
      const dy = alt(x, y + 1) - alt(x, y - 1)
      const v = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize()
      const o = (y * N + x) * 4
      img.data[o] = (v.x * 0.5 + 0.5) * 255
      img.data[o + 1] = (v.y * 0.5 + 0.5) * 255
      img.data[o + 2] = (v.z * 0.5 + 0.5) * 255
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = textura(c, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Cáusticas: la red de luz que el agua dibuja en el fondo de la piscina. */
function texturaCausticas(): THREE.CanvasTexture {
  const N = 256
  const { c, g } = lienzo(N, N)
  const img = g.createImageData(N, N)
  const rnd = azar(25)
  const pts = Array.from({ length: 22 }, () => [rnd() * N, rnd() * N])
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let d1 = 1e9
      let d2 = 1e9
      for (const [px, py] of pts) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const dx = x - (px + ox * N)
            const dy = y - (py + oy * N)
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < d1) {
              d2 = d1
              d1 = d
            } else if (d < d2) d2 = d
          }
        }
      }
      const v = Math.pow(Math.max(0, 1 - (d2 - d1) / 7), 2.2)
      const o = (y * N + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = textura(c, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// ── Piezas de los puestos (geometría local: el asiento en el origen, mirando a -z) ──
function geoEscritorio(): THREE.BufferGeometry {
  const L = new Lote()
  const z = -0.75
  L.ext(-0.75, 0.75, 0.72, 0.76, z - 0.375, z + 0.375, PAL.roble, A.satin)
  L.ext(-0.74, -0.7, 0, 0.72, z - 0.33, z + 0.33, PAL.blanco, A.laca)
  L.ext(0.7, 0.74, 0, 0.72, z - 0.33, z + 0.33, PAL.blanco, A.laca)
  L.ext(-0.7, 0.7, 0.36, 0.7, z - 0.33, z - 0.31, PAL.blanco, A.laca)
  L.ext(-0.23, 0.23, 0.76, 0.775, -0.66, -0.52, "#22252b", A.satin)
  L.ext(0.33, 0.39, 0.76, 0.78, -0.62, -0.53, "#22252b", A.satin)
  return L.geometria()
}
function geoMonitor(): THREE.BufferGeometry {
  const L = new Lote()
  L.ext(-0.31, 0.31, 0.86, 1.22, -1.0, -0.975, "#14161a", { r: 0.3, m: 0.4 })
  L.ext(-0.025, 0.025, 0.76, 0.9, -1.03, -1.0, PAL.grafito, A.metal)
  L.ext(-0.12, 0.12, 0.76, 0.772, -1.1, -0.95, PAL.grafito, A.metal)
  return L.geometria()
}
/** Cara de la pantalla (uv 0..1) y luz trasera del monitor (uv = -1: sin líneas). */
function geoPantalla(): THREE.BufferGeometry {
  const L = new Lote()
  L.quad(0, 1.04, -0.9735, 0.58, 0.33, 0, "#ffffff", A.mate, [0, 0, 1, 1])
  L.quad(0, 1.05, -1.0015, 0.5, 0.26, Math.PI, "#ffffff", A.mate, [-1, -1, -1, -1])
  return L.geometria()
}
function sillaLocal(L: Lote, tapiz: Col) {
  L.ext(-0.25, 0.25, 0.42, 0.5, -0.17, 0.27, tapiz, A.tela)
  L.caja(0, 0.54, 0.33, 0.46, 0.56, 0.05, tapiz, A.tela, 0, -0.12)
  L.barra([0, 0.46, 0.24], [0, 0.6, 0.32], 0.02, PAL.grafito, A.metal, 4)
  L.cil(0, 0.1, 0.05, 0.03, 0.32, PAL.cromo, A.cromo, 6)
  for (let i = 0; i < 3; i++) L.caja(0, 0.05, 0.05, 0.56, 0.03, 0.05, PAL.grafito, A.metal, (i * Math.PI) / 3)
}
function geoSilla(): THREE.BufferGeometry {
  const L = new Lote()
  sillaLocal(L, "#262a31")
  return L.geometria()
}
/** El trabajador sentado: blanco donde va el color del estado, gris en el pantalón. */
function geoCuerpo(detalle: number): THREE.BufferGeometry {
  const L = new Lote()
  const piel = "#ffffff"
  const pant = "#8d8d8d"
  const zap = "#3a3a3a"
  if (detalle >= 1) L.geo(CAPS(0.165, 0.26, detalle >= 2 ? 2 : 1, detalle >= 2 ? 9 : 7), M(0, 0.84, 0.12, 1, 1, 0.78, 0, -0.12), piel, A.satin)
  else L.caja(0, 0.54, 0.12, 0.34, 0.6, 0.24, piel, A.satin)
  L.ext(-0.18, 0.18, 0.46, 0.62, -0.3, 0.2, pant, A.satin)
  L.ext(-0.17, -0.04, 0.08, 0.5, -0.37, -0.24, pant, A.satin)
  L.ext(0.04, 0.17, 0.08, 0.5, -0.37, -0.24, pant, A.satin)
  L.ext(-0.17, -0.04, 0, 0.09, -0.5, -0.24, zap, A.satin)
  L.ext(0.04, 0.17, 0, 0.09, -0.5, -0.24, zap, A.satin)
  L.cil(0, 1.1, 0.09, 0.052, 0.1, piel, A.satin, 6)
  for (const s of [-1, 1]) {
    const hombro: [number, number, number] = [s * 0.2, 1.05, 0.13]
    const codo: [number, number, number] = [s * 0.23, 0.84, -0.05]
    const mano: [number, number, number] = [s * 0.15, 0.8, -0.44]
    if (detalle >= 2) {
      capsulaEntre(L, hombro, codo, 0.056, piel)
      capsulaEntre(L, codo, mano, 0.05, piel)
    } else {
      L.barra(hombro, codo, 0.055, piel, A.satin, 5)
      L.barra(codo, mano, 0.05, piel, A.satin, 5)
    }
  }
  return L.geometria()
}
function capsulaEntre(L: Lote, a: [number, number, number], b: [number, number, number], r: number, col: Col) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const dir = vb.clone().sub(va)
  const len = dir.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  L.geo(CAPS(r, Math.max(0.01, len - r), 1, 6), m, col, A.satin)
}
function geoCabeza(detalle: number): THREE.BufferGeometry {
  const L = new Lote()
  L.blob(0, 1.27, 0.07, 0.112, "#ffffff", A.satin, 1.08, detalle >= 1 ? 1 : 0)
  if (detalle >= 1) {
    const pelo = proto("pelo", () => new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.46))
    L.geo(pelo, M(0, 1.28, 0.085, 0.12, 0.13, 0.122, 0, 0.42), "#2a1d16", A.satin)
  }
  return L.geometria()
}
function geoIndicador(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(0.085, 0)
  g.scale(1, 1.35, 1)
  g.translate(0, 1.74, 0.07)
  return g
}

// ── Muebles y piezas fijas (se dibujan dentro de un Lote) ───────
function sofa(L: Lote, x: number, y: number, z: number, ry: number, tapiz: Col, largo = 2.0) {
  const a = largo / 2
  L.en(M(x, y, z, 1, 1, 1, ry), () => {
    L.ext(-a, a, 0.08, 0.42, -0.42, 0.42, tapiz, A.tela)
    L.ext(-a, a, 0.42, 0.86, -0.42, -0.2, tapiz, A.tela)
    L.ext(-a, -a + 0.18, 0.42, 0.64, -0.42, 0.42, tapiz, A.tela)
    L.ext(a - 0.18, a, 0.42, 0.64, -0.42, 0.42, tapiz, A.tela)
    L.ext(-a + 0.2, -0.02, 0.42, 0.52, -0.2, 0.4, mezcla(tapiz, "#ffffff", 0.08), A.tela)
    L.ext(0.02, a - 0.2, 0.42, 0.52, -0.2, 0.4, mezcla(tapiz, "#ffffff", 0.08), A.tela)
    L.ext(-a + 0.05, a - 0.05, 0, 0.08, -0.36, 0.36, PAL.negro, A.metal)
  })
}
function mesaRedonda(L: Lote, x: number, y: number, z: number, r: number, cubierta: Col, ac: Acabado = A.pulido, alto = 0.74) {
  L.cil(x, y + alto - 0.04, z, r, 0.04, cubierta, ac, 28)
  L.cil(x, y, z, 0.04, alto - 0.04, PAL.grafito, A.metal, 8)
  L.cil(x, y, z, r * 0.45, 0.03, PAL.grafito, A.metal, 16)
}
function sillaBistro(L: Lote, x: number, y: number, z: number, rumbo: number, col: Col) {
  L.en(M(x, y, z, 1, 1, 1, rumbo + Math.PI), () => {
    L.ext(-0.21, 0.21, 0.44, 0.48, -0.2, 0.2, col, A.satin)
    L.caja(0, 0.5, 0.19, 0.4, 0.36, 0.03, col, A.satin, 0, -0.1)
    for (const dx of [-0.18, 0.18]) for (const dz of [-0.17, 0.17]) L.barra([dx, 0, dz], [dx * 0.95, 0.44, dz * 0.95], 0.014, PAL.grafito, A.metal, 4)
  })
}
function sillaOficina(L: Lote, x: number, y: number, z: number, rumbo: number, tapiz: Col) {
  L.en(M(x, y, z, 1, 1, 1, rumbo + Math.PI), () => sillaLocal(L, tapiz))
}
function taburete(L: Lote, x: number, y: number, z: number, asiento: Col) {
  L.cil(x, y + 0.74, z, 0.19, 0.06, asiento, A.satin, 16)
  L.cil(x, y + 0.02, z, 0.03, 0.72, PAL.cromo, A.cromo, 8)
  L.cil(x, y, z, 0.22, 0.02, PAL.cromo, A.cromo, 16)
  L.toro(x, y + 0.3, z, 0.15, 0.012, PAL.cromo, A.cromo, 16)
}
function planta(L: Lote, x: number, y: number, z: number, s: number, rnd: () => number, maceta: Col = PAL.maceta) {
  L.cil(x, y, z, 0.26 * s, 0.5 * s, maceta, A.laca, 14, 1.22)
  L.cil(x, y + 0.47 * s, z, 0.3 * s, 0.03, PAL.tierra, A.mate, 14)
  const alta = s > 1.2
  if (alta) L.barra([x, y + 0.5 * s, z], [x + 0.05, y + 1.3 * s, z], 0.03 * s, "#5a4030", A.mate, 5)
  const n = alta ? 6 : 4
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const d = (alta ? 0.28 : 0.18) * s * rnd()
    const yy = y + (alta ? 0.9 + rnd() * 0.75 : 0.62 + rnd() * 0.3) * s
    const r = (alta ? 0.3 : 0.24) * s * (0.75 + rnd() * 0.45)
    L.blob(x + Math.cos(a) * d, yy, z + Math.sin(a) * d, r, HOJAS[Math.floor(rnd() * HOJAS.length)], A.mate, 1.1)
  }
}
function arbol(L: Lote, x: number, y: number, z: number, s: number, rnd: () => number, copa?: string[]) {
  L.cil(x, y, z, 0.16 * s, 2.2 * s, "#5d4331", A.mate, 8, 0.7)
  const tonos = copa ?? HOJAS
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2
    const d = 0.9 * s * rnd()
    const yy = y + (2.2 + rnd() * 1.6) * s
    const r = (0.75 + rnd() * 0.6) * s
    L.blob(x + Math.cos(a) * d, yy, z + Math.sin(a) * d, r, tonos[Math.floor(rnd() * tonos.length)], A.mate, 0.9)
  }
}
function banca(L: Lote, x: number, y: number, z: number, ry: number) {
  L.en(M(x, y, z, 1, 1, 1, ry), () => {
    for (let i = 0; i < 4; i++) L.ext(-0.9, 0.9, 0.42, 0.46, -0.22 + i * 0.12, -0.13 + i * 0.12, "#a7774c", A.satin)
    for (let i = 0; i < 3; i++) L.caja(0, 0.55 + i * 0.13, 0.27, 1.8, 0.08, 0.03, "#a7774c", A.satin, 0, -0.15)
    for (const dx of [-0.75, 0.75]) {
      L.ext(dx - 0.03, dx + 0.03, 0, 0.42, -0.2, 0.22, PAL.grafito, A.metal)
      L.ext(dx - 0.03, dx + 0.03, 0.42, 0.9, 0.24, 0.3, PAL.grafito, A.metal)
    }
  })
}

// ── Celda: piso, muros cortados, columnas y señalética ─────────
interface Obra {
  y: number
  nivel: "n1" | "n2" | "n3"
  cel: Lote
  vid: Lote
  adi: Lote
  rot: Lote
  esp: Lote
  libros: Lote
  uvRot: Record<string, Rect>
  uvEsp: Record<string, Rect>
  extras: THREE.Object3D[]
  rnd: () => number
  detalle: number
  mats: MatsSub
  anim: Array<(t: TickEscena) => void>
  texturas: { olas?: THREE.Texture; causticas?: THREE.Texture }
}

function bordes(cx: number, cz: number) {
  return { x0: cx - SUB_MEDIO_ANCHO, x1: cx + SUB_MEDIO_ANCHO, z0: cz - SUB_MEDIO_FONDO, z1: cz + SUB_MEDIO_FONDO }
}

interface OpcMuros {
  muro: Col
  remate?: Col
  /** El frente (z0, al pasillo) es vidrio, salvo la puerta de 4 m al centro. */
  frente?: "vidrio" | "solido"
  lados?: "mixto" | "solido"
  /** Línea fina de color sobre el zócalo de los lados. */
  acento?: Col
}
function muros(o: Obra, cx: number, cz: number, op: OpcMuros) {
  const { cel: L, vid: V, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  const rem = op.remate ?? PAL.remate
  const t = T_MURO
  // fondo (sur)
  L.ext(x0, x1, y, y + H, z1 - t, z1, op.muro, A.satin)
  L.ext(x0 - 0.03, x1 + 0.03, y + H, y + H + 0.07, z1 - t - 0.03, z1 + 0.03, rem, A.laca)
  // lados
  for (const xs of [x0, x1 - t]) {
    if (op.lados === "solido") {
      L.ext(xs, xs + t, y, y + H, z0, z1, op.muro, A.satin)
    } else {
      L.ext(xs, xs + t, y, y + 1.0, z0, z1, op.muro, A.satin)
      if (op.acento) L.ext(xs - 0.005, xs + t + 0.005, y + 1.0, y + 1.03, z0, z1, op.acento, A.luz(0.9))
      V.ext(xs + t / 2 - 0.015, xs + t / 2 + 0.015, y + 1.03, y + H, z0, z1, "#ffffff", A.mate)
      for (let z = z0 + 3.4; z < z1 - 1; z += 3.4) L.ext(xs + t / 2 - 0.03, xs + t / 2 + 0.03, y + 1.0, y + H, z - 0.03, z + 0.03, rem, A.metal)
    }
    L.ext(xs - 0.03, xs + t + 0.03, y + H, y + H + 0.07, z0, z1, rem, A.laca)
  }
  // frente (norte) con la puerta al centro
  const tramos: Array<[number, number]> = [
    [x0, cx - 2],
    [cx + 2, x1],
  ]
  for (const [a, b] of tramos) {
    if (op.frente === "solido") {
      L.ext(a, b, y, y + H, z0, z0 + t, op.muro, A.satin)
    } else {
      L.ext(a, b, y, y + 0.1, z0 + 0.04, z0 + 0.18, rem, A.laca)
      V.ext(a, b, y + 0.1, y + H, z0 + 0.095, z0 + 0.125, "#ffffff", A.mate)
      for (let x = a + 3; x < b - 0.5; x += 3) L.ext(x - 0.03, x + 0.03, y + 0.1, y + H, z0 + 0.08, z0 + 0.14, rem, A.metal)
    }
    L.ext(a, b, y + H, y + H + 0.07, z0 - 0.03, z0 + (op.frente === "solido" ? t : 0.2) + 0.03, rem, A.laca)
  }
  for (const s of [-1, 1]) L.ext(cx + s * 2 - 0.07, cx + s * 2 + 0.07, y, y + H + 0.07, z0, z0 + 0.22, rem, A.metal)
  // columnas estructurales en las esquinas
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) {
      L.cil(x, y, z, 0.42, 3.05, PAL.columna, A.satin, 20)
      L.cil(x, y + 3.05, z, 0.44, 0.07, rem, A.laca, 20)
    }
  }
}

/** Tótem con el nombre del lugar, junto a la puerta, del lado del pasillo. */
function totem(o: Obra, cx: number, cz: number, lugarId: string) {
  const { cel: L, y } = o
  const r = o.uvRot[`totem-${lugarId}`]
  if (!r) return
  const z = cz - SUB_MEDIO_FONDO - 0.75
  const x = cx + 3.3
  const w = 1.7
  const h = (w * r.h) / r.w
  L.ext(x - 0.32, x + 0.32, y, y + 0.04, z - 0.16, z + 0.16, PAL.remate, A.laca)
  L.ext(x - 0.035, x + 0.035, y, y + 2.05, z - 0.035, z + 0.035, PAL.remate, A.metal)
  L.ext(x - w / 2 - 0.04, x + w / 2 + 0.04, y + 2.03, y + 2.11 + h, z - 0.035, z + 0.035, PAL.remate, A.laca)
  o.rot.quad(x, y + 2.07 + h / 2, z + 0.037, w, h, 0, "#ffffff", A.mate, r.uv)
  o.rot.quad(x, y + 2.07 + h / 2, z - 0.037, w, h, Math.PI, "#ffffff", A.mate, r.uv)
}

/** Cartel colgante del equipo, sobre el frente de la celda, de dos caras. */
function cartelEquipo(o: Obra, cx: number, zc: number, depId: string) {
  const r = o.uvRot[`cartel-${depId}`]
  if (!r) return
  const { cel: L, y } = o
  const ancho = 18
  const alto = (ancho * r.h) / r.w
  const yc = y + 4.6
  L.ext(cx - ancho / 2 - 0.12, cx + ancho / 2 + 0.12, yc - alto / 2 - 0.1, yc + alto / 2 + 0.1, zc - 0.06, zc + 0.06, PAL.remate, A.laca)
  o.rot.quad(cx, yc, zc + 0.062, ancho, alto, 0, "#ffffff", A.mate, r.uv)
  o.rot.quad(cx, yc, zc - 0.062, ancho, alto, Math.PI, "#ffffff", A.mate, r.uv)
  const top = y + 6.45
  for (const s of [-1, 1]) L.barra([cx + s * ancho * 0.36, yc + alto / 2 + 0.1, zc], [cx + s * ancho * 0.36, top, zc], 0.014, PAL.remate, A.metal, 4)
  L.ext(cx - ancho / 2 - 0.6, cx + ancho / 2 + 0.6, top, top + 0.14, zc - 0.07, zc + 0.07, PAL.remate, A.metal)
  for (const s of [-1, 1]) {
    const px = cx + s * (ancho / 2 + 0.5)
    L.ext(px - 0.07, px + 0.07, y, top + 0.14, zc - 0.07, zc + 0.07, PAL.remate, A.metal)
    L.ext(px - 0.18, px + 0.18, y, y + 0.03, zc - 0.18, zc + 0.18, PAL.remate, A.laca)
  }
}

// ── Departamento: 100 puestos, puesto de mando, cartel y detalles ──
function celdaDepartamento(o: Obra, depId: string, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const color = colorDe(depId)
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  // Piso de concreto pulido con un tinte del color del depto.
  L.ext(x0, x1, y, y + 0.03, z0, z1, mezcla(PAL.concreto, color, 0.2), A.pulido)
  // Alfombra oscura teñida bajo los puestos, en dos mitades: el pasillo central queda pulido
  const alf = mezcla(color, "#24272d", 0.72)
  for (const [a, b] of [
    [x0 + 2.8, cx - 2.0],
    [cx + 2.0, x1 - 2.8],
  ]) {
    L.ext(a, b, y + 0.03, y + 0.04, z0 + 8.0, z1 - 1.0, alf, A.tela)
    L.ext(a, b, y + 0.03, y + 0.043, z0 + 7.92, z0 + 8.0, color, A.luz(1.4))
    L.ext(a, b, y + 0.03, y + 0.043, z1 - 1.0, z1 - 0.92, color, A.luz(1.4))
  }
  // Línea de luz que lleva del puesto de mando al fondo
  L.ext(cx - 0.035, cx + 0.035, y + 0.03, y + 0.042, z0 + 5.4, z1 - 1.2, color, A.luz(2.2))
  muros(o, cx, cz, { muro: PAL.muro, lados: "mixto", acento: color })

  // Muro del fondo: listones de madera, emblema de color y luz de cornisa
  for (let x = cx - 11; x <= cx + 11; x += 0.17) L.ext(x, x + 0.06, y + 0.25, y + 2.55, z1 - T_MURO - 0.05, z1 - T_MURO, "#c49b6c", A.satin)
  L.geo(CIL(32), M(cx, y + 1.42, z1 - T_MURO - 0.08, 0.62, 0.05, 0.62, 0, Math.PI / 2), PAL.remate, A.laca)
  L.geo(CIL(32), M(cx, y + 1.42, z1 - T_MURO - 0.11, 0.5, 0.02, 0.5, 0, Math.PI / 2), color, A.luz(1.6))
  L.ext(x0 + 0.3, x1 - 0.3, y + 2.64, y + 2.68, z1 - T_MURO - 0.06, z1 - T_MURO, PAL.luzCalida, A.luz(2.4))

  // Puesto de mando del líder: alfombra oscura y un aro de luz en (cx, z0 + 3)
  L.ext(cx - 4.2, cx + 4.2, y + 0.03, y + 0.04, z0 + 1.0, z0 + 6.0, mezcla(color, "#141820", 0.86), A.tela)
  L.aro(cx, y + 0.043, z0 + 3, 1.02, 1.1, color, A.luz(2.4), 48)

  // Rincón de reunión (izquierda): dos sofás y una mesa de mármol
  const tapiz = mezcla(color, "#2b2f37", 0.78)
  sofa(L, cx - 13.6, y, z0 + 2.0, 0, tapiz)
  sofa(L, cx - 13.6, y, z0 + 5.3, Math.PI, tapiz)
  mesaRedonda(L, cx - 13.6, y, z0 + 3.65, 0.55, "#f2efe9", A.pulido, 0.42)
  // Pantalla de presentación (derecha)
  L.ext(cx + 12.2, cx + 12.3, y, y + 1.0, z0 + 3.2, z0 + 3.3, PAL.remate, A.metal)
  L.ext(cx + 14.7, cx + 14.8, y, y + 1.0, z0 + 3.2, z0 + 3.3, PAL.remate, A.metal)
  L.ext(cx + 12.0, cx + 15.0, y + 0.95, y + 2.65, z0 + 3.15, z0 + 3.27, PAL.remate, A.laca)
  L.ext(cx + 12.08, cx + 14.92, y + 1.03, y + 2.57, z0 + 3.27, z0 + 3.28, mezcla(color, "#0b1018", 0.45), A.luz(1.5))
  L.ext(cx + 12.08, cx + 14.92, y + 1.03, y + 2.57, z0 + 3.14, z0 + 3.15, mezcla(color, "#0b1018", 0.7), A.luz(1.0))

  // Credenzas con plantas a los costados y plantas grandes en las esquinas
  for (const [xa, xb] of [
    [x0 + T_MURO + 0.05, x0 + T_MURO + 0.5],
    [x1 - T_MURO - 0.5, x1 - T_MURO - 0.05],
  ]) {
    for (const zc of [z0 + 11.5, z0 + 19, z0 + 26.5]) {
      L.ext(xa, xb, y + 0.08, y + 0.72, zc - 1.5, zc + 1.5, PAL.blanco, A.laca)
      L.ext(xa - 0.01, xb + 0.01, y + 0.72, y + 0.76, zc - 1.52, zc + 1.52, PAL.roble, A.satin)
      planta(L, (xa + xb) / 2, y + 0.76, zc + 0.8, 0.7, rnd)
    }
  }
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.6, rnd)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.6, rnd)
  planta(L, x0 + 1.3, y + 0.03, z1 - 1.4, 1.6, rnd)
  planta(L, x1 - 1.3, y + 0.03, z1 - 1.4, 1.6, rnd)
  planta(L, cx - 3.4, y + 0.03, z0 + 6.6, 1.0, rnd)
  planta(L, cx + 3.4, y + 0.03, z0 + 6.6, 1.0, rnd)

  cartelEquipo(o, cx, z0 + 0.55, depId)
  totem(o, cx, cz, `dep-${depId}`)
}

// ── Celdas especiales ───────────────────────────────────────────
function cafeteria(o: Obra, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#a7784e", A.laca)
  for (let x = x0 + 0.6; x < x1; x += 0.6) L.ext(x - 0.006, x + 0.006, y + 0.03, y + 0.032, z0, z1, "#8a5f3b", A.laca)
  muros(o, cx, cz, { muro: "#f1ebe2", lados: "mixto", acento: "#d08a43" })
  // Barra
  const bx0 = cx - 13
  const bx1 = cx + 7
  const bz = z1 - 4.2
  L.ext(bx0, bx1, y, y + 1.02, bz - 0.4, bz + 0.4, "#2b221c", A.satin)
  for (let x = bx0 + 0.08; x < bx1 - 0.05; x += 0.14) L.ext(x, x + 0.07, y + 0.1, y + 0.98, bz - 0.44, bz - 0.4, "#9c6b43", A.satin)
  L.ext(bx0 - 0.06, bx1 + 0.06, y + 1.02, y + 1.08, bz - 0.52, bz + 0.46, "#f3f0ea", A.pulido)
  L.ext(bx0, bx1, y + 0.06, y + 0.09, bz - 0.47, bz - 0.44, PAL.luzCalida, A.luz(2.6))
  // Máquina de espresso, molino y tazas
  const mx = cx - 5
  L.ext(mx - 0.55, mx + 0.55, y + 1.08, y + 1.56, bz - 0.12, bz + 0.36, PAL.cromo, A.cromo)
  L.ext(mx - 0.56, mx + 0.56, y + 1.56, y + 1.61, bz - 0.13, bz + 0.37, "#1a1c20", A.laca)
  L.ext(mx - 0.4, mx + 0.4, y + 1.3, y + 1.4, bz - 0.13, bz - 0.12, "#c43a2b", A.laca)
  for (const dx of [-0.28, 0.28]) {
    L.cil(mx + dx, y + 1.2, bz - 0.18, 0.05, 0.1, "#1a1c20", A.metal, 8)
    L.cil(mx + dx, y + 1.08, bz - 0.2, 0.035, 0.07, "#f4f1ea", A.laca, 8)
  }
  for (let i = 0; i < 6; i++) L.cil(mx - 0.4 + i * 0.16, y + 1.61, bz + 0.12, 0.035, 0.07, "#f4f1ea", A.laca, 8)
  L.cil(mx + 1.0, y + 1.08, bz + 0.1, 0.11, 0.36, "#1a1c20", A.metal, 10)
  L.cil(mx + 1.0, y + 1.44, bz + 0.1, 0.09, 0.26, "#6b4528", A.laca, 10, 1.6)
  // Vitrina de postres
  o.vid.ext(cx + 1.5, cx + 4.5, y + 1.08, y + 1.5, bz - 0.45, bz + 0.2, "#ffffff", A.mate)
  const postres = ["#f2d0a4", "#7a3f2a", "#f4b5c4", "#e8d36a", "#f7efe3"]
  for (let i = 0; i < 8; i++) L.cil(cx + 1.8 + i * 0.36, y + 1.1, bz - 0.12, 0.12, 0.1, postres[i % postres.length], A.satin, 10)
  // Estantes del fondo
  for (const yy of [1.3, 1.75, 2.2]) {
    L.ext(bx0 + 1, bx1 - 1, y + yy, y + yy + 0.05, z1 - T_MURO - 0.38, z1 - T_MURO, "#8b5e3c", A.satin)
    for (let x = bx0 + 1.2; x < bx1 - 1.2; x += 0.32) {
      const c = rnd()
      if (c < 0.5) L.cil(x, y + yy + 0.05, z1 - T_MURO - 0.18, 0.06, 0.12 + rnd() * 0.18, ["#f4f1ea", "#2a5a46", "#3b2a20", "#c98c3e"][Math.floor(rnd() * 4)], A.laca, 8)
      else L.cil(x, y + yy + 0.05, z1 - T_MURO - 0.18, 0.045, 0.3, ["#5a2a1a", "#2d4a2a", "#b06a2a"][Math.floor(rnd() * 3)], A.pulido, 8)
    }
  }
  // Letrero "COFFEE" de neón, colgado sobre la barra (dos caras)
  const r = o.uvEsp.coffee
  if (r) {
    const w = 6
    const h = 1.5
    o.esp.quad(cx - 3, y + 3.55, bz, w, h, 0, "#ffffff", A.mate, r.uv)
    o.esp.quad(cx - 3, y + 3.55, bz - 0.01, w, h, Math.PI, "#ffffff", A.mate, r.uv)
    L.ext(cx - 6.1, cx + 0.1, y + 4.32, y + 4.36, bz - 0.03, bz + 0.03, PAL.remate, A.metal)
    for (const dx of [-2.6, 2.6]) L.barra([cx - 3 + dx, y + 4.36, bz], [cx - 3 + dx, y + 6.4, bz], 0.01, PAL.remate, A.metal, 4)
  }
  // Pizarra del menú en el muro este
  const rm = o.uvEsp.menu
  if (rm) {
    L.ext(x1 - T_MURO - 0.05, x1 - T_MURO, y + 1.05, y + 2.35, z1 - 10.4, z1 - 7.6, "#3b2a1f", A.satin)
    o.esp.quad(x1 - T_MURO - 0.06, y + 1.7, z1 - 9, 2.6, 1.3, -Math.PI / 2, "#ffffff", A.mate, rm.uv)
  }
  // Taburetes
  for (let i = 0; i < 8; i++) taburete(L, bx0 + 1.2 + i * 2.4, y, bz - 1.05, "#3b2a20")
  // Mesas con sillas
  const mesas: Array<[number, number]> = [
    [cx - 12, z0 + 10],
    [cx - 5.5, z0 + 9.5],
    [cx + 5.5, z0 + 10],
    [cx + 12, z0 + 11],
    [cx - 12, z0 + 17.5],
    [cx - 4, z0 + 17],
    [cx + 4.5, z0 + 17.5],
    [cx + 12.5, z0 + 18.5],
  ]
  mesas.forEach(([mx2, mz], i) => {
    mesaRedonda(L, mx2, y, mz, 0.42, i % 2 ? "#f2efe9" : "#2e2a27", A.pulido)
    const n = 2 + (i % 2)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + i
      const sx = mx2 + Math.sin(a) * 0.82
      const sz = mz + Math.cos(a) * 0.82
      sillaBistro(L, sx, y, sz, Math.atan2(mx2 - sx, mz - sz), i % 3 ? "#c98a4a" : "#2a2f37")
    }
  })
  // Sofás y plantas
  sofa(L, x0 + 1.3, y, z0 + 13, Math.PI / 2, "#5b6b4a", 2.4)
  sofa(L, x0 + 1.3, y, z0 + 19, Math.PI / 2, "#5b6b4a", 2.4)
  for (const [px, pz] of [
    [x0 + 1.2, z0 + 1.4],
    [x1 - 1.2, z0 + 1.4],
    [x1 - 1.3, z1 - 1.4],
    [x0 + 1.3, z1 - 1.4],
    [cx - 3.2, z0 + 1.6],
    [cx + 3.2, z0 + 1.6],
  ])
    planta(L, px, y + 0.03, pz, 1.5, rnd)
  totem(o, cx, cz, "cafeteria")
}

function salaGuerra(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#181c24", A.pulido)
  muros(o, cx, cz, { muro: "#2a2f39", lados: "solido" })
  const tz = cz + 2
  // Mesa redonda con el mapa del mundo luminoso
  L.cil(cx, y, tz, 3.2, 0.7, "#10131a", A.laca, 48)
  L.cil(cx, y + 0.7, tz, 4.9, 0.08, "#0c0f15", A.pulido, 64)
  L.aro(cx, y + 0.784, tz, 4.74, 4.86, "#7fe3ff", A.luz(2.6), 96)
  L.aro(cx, y + 0.784, tz, 3.72, 3.8, PAL.laton, A.luz(1.6), 96)
  const rm = o.uvEsp.mapa
  if (rm) o.esp.piso(cx - 3.72, cx + 3.72, tz - 3.72, tz + 3.72, y + 0.786, "#ffffff", A.mate, rm.uv)
  // 24 sillas alrededor
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const px = cx + Math.sin(a) * 5.75
    const pz = tz + Math.cos(a) * 5.75
    sillaOficina(L, px, y, pz, Math.atan2(cx - px, tz - pz), "#1d2129")
  }
  L.aro(cx, y + 0.034, tz, 6.85, 6.95, "#7fe3ff", A.luz(1.8), 96)
  // Anillo de luz colgado sobre la mesa
  L.toro(cx, y + 5.2, tz, 5.0, 0.07, "#cfefff", A.luz(2.6), 64)
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4
    L.barra([cx + Math.sin(a) * 5, y + 5.2, tz + Math.cos(a) * 5], [cx + Math.sin(a) * 5, y + 6.6, tz + Math.cos(a) * 5], 0.012, PAL.remate, A.metal, 4)
  }
  // Pantallas gigantes en los muros
  const pantalla = (clave: string, x: number, z: number, ry: number) => {
    const r = o.uvEsp[clave]
    if (!r) return
    const w = 9.2
    const h = 2.3
    L.en(M(x, y, z, 1, 1, 1, ry), () => {
      L.ext(-w / 2 - 0.12, w / 2 + 0.12, 0.33, 0.45 + h + 0.0, -0.08, 0, "#0a0c10", A.laca)
      L.ext(-w / 2 - 0.12, w / 2 + 0.12, 0.33, 0.35, 0, 0.05, "#7fe3ff", A.luz(2))
    })
    o.esp.quad(x + Math.sin(ry) * 0.005, y + 0.39 + h / 2, z + Math.cos(ry) * 0.005, w, h, ry, "#ffffff", A.mate, r.uv)
  }
  pantalla("pantalla0", cx - 9.8, z1 - T_MURO, Math.PI)
  pantalla("pantalla1", cx + 9.8, z1 - T_MURO, Math.PI)
  pantalla("pantalla2", x0 + T_MURO, cz + 2, Math.PI / 2)
  pantalla("pantalla3", x1 - T_MURO, cz + 2, -Math.PI / 2)
  totem(o, cx, cz, "sala-guerra")
}

function gimnasio(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#2a2d33", { r: 0.7, m: 0 })
  muros(o, cx, cz, { muro: "#e9e5de", lados: "mixto", acento: "#f2c230" })
  // espejo en el muro del fondo
  L.ext(x0 + 1, x1 - 1, y + 0.3, y + 2.5, z1 - T_MURO - 0.02, z1 - T_MURO, "#dfe8ee", A.espejo)
  // líneas amarillas de zonas
  for (const z of [z0 + 12.5, z1 - 8.5]) L.ext(x0 + 1, x1 - 1, y + 0.03, y + 0.036, z - 0.05, z + 0.05, "#f2c230", A.laca)
  // racks con barra y discos, sobre tarimas de madera
  for (const rx of [cx - 11, cx, cx + 11]) {
    const rz = z1 - 4.8
    L.ext(rx - 1.6, rx + 1.6, y + 0.03, y + 0.08, rz - 1.6, rz + 1.6, "#c9a173", A.satin)
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) L.ext(rx + dx - 0.04, rx + dx + 0.04, y + 0.08, y + 2.4, rz + dz - 0.04, rz + dz + 0.04, "#18191c", A.metal)
    for (const dz of [-0.6, 0.6]) L.ext(rx - 0.64, rx + 0.64, y + 2.36, y + 2.42, rz + dz - 0.04, rz + dz + 0.04, "#18191c", A.metal)
    for (const dx of [-0.6, 0.6]) L.ext(rx + dx - 0.04, rx + dx + 0.04, y + 2.36, y + 2.42, rz - 0.64, rz + 0.64, "#c8202c", A.laca)
    L.barra([rx - 1.15, y + 1.4, rz - 0.6], [rx + 1.15, y + 1.4, rz - 0.6], 0.022, PAL.cromo, A.cromo, 8)
    for (const s of [-1, 1]) {
      L.geo(CIL(20), M(rx + s * 0.85, y + 1.4, rz - 0.6, 0.23, 0.05, 0.23, 0, 0, Math.PI / 2), "#c8202c", A.laca)
      L.geo(CIL(20), M(rx + s * 0.92, y + 1.4, rz - 0.6, 0.2, 0.05, 0.2, 0, 0, Math.PI / 2), "#1f4fb8", A.laca)
    }
    // banco plano delante
    L.ext(rx - 0.15, rx + 0.15, y + 0.4, y + 0.5, rz - 3.0, rz - 1.8, "#141518", A.satin)
    L.ext(rx - 0.04, rx + 0.04, y + 0.03, y + 0.4, rz - 2.9, rz - 1.9, PAL.grafito, A.metal)
  }
  // rack de mancuernas en el muro oeste
  const mx = x0 + 1.4
  L.ext(mx - 0.35, mx + 0.35, y + 0.03, y + 0.06, z0 + 14, z1 - 10, PAL.grafito, A.metal)
  for (const [yy, dx] of [
    [0.55, -0.1],
    [0.95, 0.12],
  ]) {
    L.ext(mx - 0.3 + dx, mx + 0.3 + dx, y + yy - 0.05, y + yy, z0 + 14, z1 - 10, "#18191c", A.metal)
    for (let z = z0 + 14.4; z < z1 - 10.2; z += 0.55) {
      for (const s of [-1, 1]) L.geo(CIL(10), M(mx + dx + s * 0.13, y + yy + 0.08, z, 0.08, 0.08, 0.08, 0, 0, Math.PI / 2), "#2a2c30", A.metal)
      L.barra([mx + dx - 0.13, y + yy + 0.08, z], [mx + dx + 0.13, y + yy + 0.08, z], 0.017, PAL.cromo, A.cromo, 6)
    }
  }
  for (let z = z0 + 14; z < z1 - 10; z += 2.6) L.ext(mx - 0.06, mx + 0.06, y + 0.03, y + 0.95, z - 0.04, z + 0.04, "#18191c", A.metal)
  // cintas de correr frente al vidrio
  for (let i = 0; i < 5; i++) {
    const tx = cx - 12 + i * 6
    const tz = z0 + 7.5
    L.ext(tx - 0.42, tx + 0.42, y + 0.03, y + 0.25, tz - 0.9, tz + 1.0, "#1b1d21", A.satin)
    L.ext(tx - 0.3, tx + 0.3, y + 0.25, y + 0.27, tz - 0.8, tz + 0.95, "#0d0e10", A.tela)
    for (const s of [-1, 1]) L.barra([tx + s * 0.34, y + 0.25, tz - 0.75], [tx + s * 0.3, y + 1.3, tz - 0.95], 0.025, "#2b2e33", A.metal, 6)
    L.ext(tx - 0.4, tx + 0.4, y + 1.25, y + 1.45, tz - 1.05, tz - 0.85, "#1b1d21", A.satin)
    L.ext(tx - 0.25, tx + 0.25, y + 1.3, y + 1.42, tz - 0.85, tz - 0.84, "#4fd8ff", A.luz(2.2))
  }
  // kettlebells
  for (let i = 0; i < 8; i++) {
    const kx = cx - 6 + i * 1.1
    const kz = z0 + 13.8
    L.esf(kx, y + 0.17, kz, 0.14, "#1e2024", A.metal)
    L.toro(kx, y + 0.34, kz, 0.08, 0.018, "#1e2024", A.metal, 12, 0)
  }
  planta(L, x1 - 1.4, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  planta(L, x0 + 1.4, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  totem(o, cx, cz, "gimnasio")
}

function basquet(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  const ccz = cz + 1.5
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#7a4a2c", A.laca)
  L.ext(cx - 14, cx + 14, y + 0.03, y + 0.04, ccz - 7.5, ccz + 7.5, "#d9a066", { r: 0.22, m: 0 })
  muros(o, cx, cz, { muro: "#e8e4dd", lados: "mixto", acento: "#ff7a1a" })
  const yl = y + 0.042
  const blanco = "#f7f4ee"
  const linea = (xa: number, xb: number, za: number, zb: number) => L.ext(xa, xb, yl - 0.002, yl, za, zb, blanco, A.laca)
  linea(cx - 14, cx + 14, ccz - 7.5, ccz - 7.45)
  linea(cx - 14, cx + 14, ccz + 7.45, ccz + 7.5)
  linea(cx - 14, cx - 13.95, ccz - 7.5, ccz + 7.5)
  linea(cx + 13.95, cx + 14, ccz - 7.5, ccz + 7.5)
  linea(cx - 0.025, cx + 0.025, ccz - 7.5, ccz + 7.5)
  L.aro(cx, yl, ccz, 1.75, 1.8, blanco, A.laca, 48)
  const re = o.uvEsp.emblema
  if (re) o.esp.piso(cx - 1.72, cx + 1.72, ccz - 1.72, ccz + 1.72, yl + 0.001, "#ffffff", A.mate, re.uv)
  for (const s of [-1, 1]) {
    const base = cx + s * 14
    const aro = cx + s * (14 - 1.575)
    // pintura (zona restringida) y círculo de tiro libre
    L.ext(Math.min(base, base - s * 5.8), Math.max(base, base - s * 5.8), yl - 0.003, yl - 0.001, ccz - 2.45, ccz + 2.45, "#1f3a68", A.laca)
    linea(Math.min(base, base - s * 5.8), Math.max(base, base - s * 5.8), ccz - 2.45, ccz - 2.4)
    linea(Math.min(base, base - s * 5.8), Math.max(base, base - s * 5.8), ccz + 2.4, ccz + 2.45)
    linea(base - s * 5.8 - 0.025, base - s * 5.8 + 0.025, ccz - 2.45, ccz + 2.45)
    L.aro(base - s * 5.8, yl, ccz, 1.75, 1.8, blanco, A.laca, 48, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI)
    // línea de tres
    const ang = Math.asin(6.6 / 6.75)
    L.aro(aro, yl, ccz, 6.7, 6.75, blanco, A.laca, 64, s < 0 ? -ang : Math.PI - ang, ang * 2)
    const xEnd = aro - s * 6.75 * Math.cos(ang)
    for (const zz of [-6.6, 6.6]) linea(Math.min(base, xEnd), Math.max(base, xEnd), ccz + zz - 0.025, ccz + zz + 0.025)
    // aro, tablero y soporte
    const tab = cx + s * (14 - 1.2)
    o.vid.ext(tab - 0.02, tab + 0.02, y + 2.9, y + 3.95, ccz - 0.9, ccz + 0.9, "#ffffff", A.mate)
    L.ext(tab - 0.03, tab + 0.03, y + 2.88, y + 2.92, ccz - 0.92, ccz + 0.92, PAL.blanco, A.laca)
    L.ext(tab - 0.03, tab + 0.03, y + 3.93, y + 3.97, ccz - 0.92, ccz + 0.92, PAL.blanco, A.laca)
    L.ext(tab - 0.035, tab + 0.035, y + 3.05, y + 3.5, ccz - 0.3, ccz + 0.3, "#ff6a1a", A.laca)
    L.toro(aro, y + 3.05, ccz, 0.23, 0.012, "#ff5a10", A.metal, 24)
    L.geo(CIL(10, 1.35, true), M(aro, y + 2.83, ccz, 0.17, 0.4, 0.17), "#f2f2f2", A.tela)
    const poste = cx + s * 15.2
    L.ext(poste - 0.1, poste + 0.1, y, y + 3.6, ccz - 0.1, ccz + 0.1, "#1d2a44", A.laca)
    L.ext(Math.min(poste, tab), Math.max(poste, tab), y + 3.4, y + 3.52, ccz - 0.08, ccz + 0.08, "#1d2a44", A.laca)
    L.ext(poste - 0.3, poste + 0.3, y, y + 1.6, ccz - 0.3, ccz + 0.3, "#1f3a68", A.tela)
  }
  // gradas en el fondo
  for (let i = 0; i < 3; i++) {
    const zz = z1 - 1.0 - i * 1.0
    L.ext(cx - 12, cx + 12, y, y + 0.45 * (3 - i), zz - 1.0, zz, "#3a3f49", A.satin)
    L.ext(cx - 12, cx + 12, y + 0.45 * (3 - i), y + 0.45 * (3 - i) + 0.05, zz - 1.0, zz - 0.6, i === 1 ? "#ff7a1a" : "#1f3a68", A.laca)
  }
  // balones
  L.ext(x0 + 1.2, x0 + 2.6, y + 0.03, y + 0.75, z0 + 5, z0 + 5.6, PAL.grafito, A.metal)
  for (let i = 0; i < 6; i++) L.esf(x0 + 1.4 + (i % 3) * 0.48, y + 0.88 + Math.floor(i / 3) * 0.02, z0 + 5.3, 0.12, "#e8641e", A.satin)
  totem(o, cx, cz, "basquet-int")
}

function padel(o: Obra, cx: number, cz: number) {
  const { cel: L, vid: V, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#2c3038", A.satin)
  muros(o, cx, cz, { muro: "#e7e3dc", lados: "mixto", acento: "#3ad0ff" })
  const pz = cz + 1.5
  for (const px of [cx - 6.5, cx + 6.5]) {
    L.ext(px - 5, px + 5, y + 0.03, y + 0.05, pz - 10, pz + 10, "#2f6fd6", A.tela)
    const yl = y + 0.052
    const linea = (xa: number, xb: number, za: number, zb: number) => L.ext(xa, xb, yl - 0.002, yl, za, zb, "#f7f4ee", A.laca)
    for (const s of [-1, 1]) linea(px - 5, px + 5, pz + s * 6.95 - 0.025, pz + s * 6.95 + 0.025)
    linea(px - 0.025, px + 0.025, pz - 6.95, pz + 6.95)
    // red
    for (const s of [-1, 1]) L.ext(px + s * 5.1 - 0.04, px + s * 5.1 + 0.04, y, y + 0.92, pz - 0.04, pz + 0.04, PAL.remate, A.metal)
    L.ext(px - 5.1, px + 5.1, y + 0.05, y + 0.84, pz - 0.008, pz + 0.008, "#1a1d22", { r: 0.95, m: 0 })
    L.ext(px - 5.1, px + 5.1, y + 0.84, y + 0.9, pz - 0.015, pz + 0.015, "#f4f2ed", A.tela)
    // vidrio al fondo y en las esquinas; malla en los lados
    for (const s of [-1, 1]) {
      const zf = pz + s * 10
      V.ext(px - 5, px + 5, y + 0.05, y + 3.0, zf - 0.015, zf + 0.015, "#ffffff", A.mate)
      for (const sx of [-1, 1]) V.ext(px + sx * 5 - 0.015, px + sx * 5 + 0.015, y + 0.05, y + 3.0, Math.min(zf, zf - s * 2), Math.max(zf, zf - s * 2), "#ffffff", A.mate)
      for (let x = px - 5; x <= px + 5.01; x += 2.5) L.ext(x - 0.04, x + 0.04, y, y + 3.0, zf - 0.04, zf + 0.04, "#14161a", A.metal)
    }
    for (const sx of [-1, 1]) {
      const xs = px + sx * 5
      for (let z = pz - 8; z <= pz + 8.01; z += 2) L.ext(xs - 0.04, xs + 0.04, y, y + 3.0, z - 0.04, z + 0.04, "#14161a", A.metal)
      for (let z = pz - 8; z < pz + 8; z += 0.25) L.ext(xs - 0.006, xs + 0.006, y + 0.05, y + 3.0, z - 0.006, z + 0.006, "#2a2d33", A.metal)
      for (const yy of [1.0, 2.0, 3.0]) L.ext(xs - 0.02, xs + 0.02, y + yy - 0.02, y + yy + 0.02, pz - 8, pz + 8, "#14161a", A.metal)
    }
    // torres de luz
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = px + sx * 5.3
        const lz = pz + sz * 5
        L.ext(lx - 0.05, lx + 0.05, y, y + 5.2, lz - 0.05, lz + 0.05, "#14161a", A.metal)
        L.ext(lx - 0.35, lx + 0.35, y + 5.15, y + 5.35, lz - 0.2, lz + 0.2, "#14161a", A.metal)
        L.ext(lx - 0.3, lx + 0.3, y + 5.13, y + 5.15, lz - 0.15, lz + 0.15, "#ffffff", A.luz(3))
      }
    }
  }
  banca(L, cx, y, z0 + 4.5, 0)
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  totem(o, cx, cz, "padel-int")
}

function ring(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#26292f", A.satin)
  muros(o, cx, cz, { muro: "#e6e1da", lados: "mixto", acento: "#e0242f" })
  const rz = cz + 3
  const a = 3.6
  // plataforma, lona y faldón
  L.ext(cx - a - 0.3, cx + a + 0.3, y, y + 0.95, rz - a - 0.3, rz + a + 0.3, "#141518", A.satin)
  L.ext(cx - a - 0.31, cx + a + 0.31, y + 0.55, y + 0.65, rz - a - 0.31, rz + a + 0.31, "#c8202c", A.laca)
  L.ext(cx - a - 0.3, cx + a + 0.3, y + 0.95, y + 1.02, rz - a - 0.3, rz + a + 0.3, "#c9d2dd", A.tela)
  L.aro(cx, y + 1.022, rz, 0.9, 1.4, "#1f3a68", A.tela, 40)
  // esquineros y cuerdas
  const esquinas: Array<[number, number, string]> = [
    [-1, -1, "#c8202c"],
    [1, 1, "#1f4fb8"],
    [1, -1, "#f4f2ed"],
    [-1, 1, "#f4f2ed"],
  ]
  for (const [sx, sz, col] of esquinas) {
    L.cil(cx + sx * a, y + 1.02, rz + sz * a, 0.07, 1.5, "#18191c", A.metal, 8)
    L.ext(cx + sx * a - 0.14, cx + sx * a + 0.14, y + 1.12, y + 2.3, rz + sz * a - 0.14, rz + sz * a + 0.14, col, A.satin)
  }
  for (const h of [1.5, 1.9, 2.3]) {
    const yy = y + h
    L.barra([cx - a, yy, rz - a], [cx + a, yy, rz - a], 0.03, "#d81f2c", A.satin, 6)
    L.barra([cx - a, yy, rz + a], [cx + a, yy, rz + a], 0.03, "#d81f2c", A.satin, 6)
    L.barra([cx - a, yy, rz - a], [cx - a, yy, rz + a], 0.03, "#d81f2c", A.satin, 6)
    L.barra([cx + a, yy, rz - a], [cx + a, yy, rz + a], 0.03, "#d81f2c", A.satin, 6)
  }
  // escalera
  for (let i = 0; i < 3; i++) L.ext(cx + a + 0.3, cx + a + 1.2, y, y + 0.3 * (i + 1), rz - a - 0.3 + i * 0.0, rz - a + 0.5 - i * 0.25, "#2a2d33", A.satin)
  // estructura de luces sobre el ring
  const b = a + 1.6
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.ext(cx + sx * b - 0.06, cx + sx * b + 0.06, y, y + 6.2, rz + sz * b - 0.06, rz + sz * b + 0.06, "#18191c", A.metal)
  for (const s of [-1, 1]) {
    L.ext(cx - b, cx + b, y + 6.1, y + 6.25, rz + s * b - 0.08, rz + s * b + 0.08, "#18191c", A.metal)
    L.ext(cx + s * b - 0.08, cx + s * b + 0.08, y + 6.1, y + 6.25, rz - b, rz + b, "#18191c", A.metal)
    for (let k = -1; k <= 1; k++) {
      L.ext(cx + k * 2.4 - 0.22, cx + k * 2.4 + 0.22, y + 5.85, y + 6.1, rz + s * b - 0.22, rz + s * b + 0.22, "#18191c", A.metal)
      L.ext(cx + k * 2.4 - 0.16, cx + k * 2.4 + 0.16, y + 5.83, y + 5.85, rz + s * b - 0.16, rz + s * b + 0.16, "#ffffff", A.luz(3.2))
    }
  }
  o.adi.geo(PIRAMIDE(0.35), M(cx, y + 3.45, rz, a, 4.8, a), "#fff2dc", A.mate, { grad: [0.0, 0.16] })
  // sacos de boxeo
  const sx0 = x0 + 2.6
  L.ext(sx0 - 0.08, sx0 + 0.08, y, y + 2.6, z0 + 9, z0 + 9.16, "#18191c", A.metal)
  L.ext(sx0 - 0.08, sx0 + 0.08, y, y + 2.6, z1 - 9.16, z1 - 9, "#18191c", A.metal)
  L.ext(sx0 - 0.06, sx0 + 0.06, y + 2.5, y + 2.62, z0 + 9, z1 - 9, "#18191c", A.metal)
  for (let i = 0; i < 4; i++) {
    const bz = z0 + 11 + i * 3.6
    L.barra([sx0, y + 2.5, bz], [sx0, y + 2.0, bz], 0.012, PAL.cromo, A.cromo, 4)
    L.cil(sx0, y + 0.85, bz, 0.19, 1.15, i % 2 ? "#141518" : "#a01c24", A.satin, 14)
  }
  // banca con guantes
  banca(L, x1 - 2.2, y, z0 + 12, -Math.PI / 2)
  for (const dz of [-0.3, 0.3]) L.esf(x1 - 2.2, y + 0.55, z0 + 12 + dz, 0.11, "#c8202c", A.satin, 0.8)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  totem(o, cx, cz, "ring")
}

/** Estantería con lomos de libros (frente hacia `ry`). */
function estante(o: Obra, x: number, y0: number, z: number, largo: number, alto: number, ry: number, niveles: number) {
  const { cel: L, libros: B } = o
  const paso = alto / niveles
  L.en(M(x, y0, z, 1, 1, 1, ry), () => {
    L.ext(-largo / 2, largo / 2, 0, alto, -0.42, -0.4, "#2a1c13", A.satin)
    for (let i = 0; i <= niveles; i++) L.ext(-largo / 2, largo / 2, i * paso, i * paso + 0.035, -0.42, 0, "#4a3020", A.satin)
    for (let x = -largo / 2; x <= largo / 2 + 0.01; x += Math.max(0.9, largo / Math.ceil(largo / 1.2))) L.ext(x - 0.025, x + 0.025, 0, alto, -0.42, 0, "#4a3020", A.satin)
  })
  for (let i = 0; i < niveles; i++) {
    const banda = (i * 7 + Math.floor(x * 3 + z)) & 3
    const v0 = 1 - (banda + 1) * 0.25
    const v1 = 1 - banda * 0.25 - 0.002
    const hy = y0 + i * paso + 0.035 + (paso - 0.05) / 2
    const ox = Math.sin(ry) * -0.12
    const oz = Math.cos(ry) * -0.12
    B.quad(x + ox, hy, z + oz, largo - 0.06, paso - 0.05, ry, "#ffffff", A.mate, [0, v0, largo / 1.4, v1])
  }
}

function biblioteca(o: Obra, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#5a3a26", A.laca)
  L.ext(cx - 15, cx + 15, y + 0.03, y + 0.04, z0 + 6, z0 + 17, "#23473a", A.tela)
  L.ext(cx - 15, cx + 15, y + 0.03, y + 0.042, z0 + 6, z0 + 6.08, "#c9a15b", A.laca)
  L.ext(cx - 15, cx + 15, y + 0.03, y + 0.042, z0 + 16.92, z0 + 17, "#c9a15b", A.laca)
  muros(o, cx, cz, { muro: "#e9e1d3", lados: "solido" })
  // Muro de libros de dos pisos con galería
  const zb = z1 - T_MURO
  estante(o, cx, y, zb, 36, 2.7, Math.PI, 6)
  estante(o, cx, y + 2.85, zb, 36, 2.6, Math.PI, 6)
  L.ext(cx - 18, cx + 18, y + 2.75, y + 2.85, zb - 1.3, zb - 0.42, "#3a2618", A.satin)
  for (let x = cx - 18; x <= cx + 18.01; x += 1.2) L.barra([x, y + 2.85, zb - 1.28], [x, y + 3.85, zb - 1.28], 0.02, PAL.laton, A.metal, 6)
  L.barra([cx - 18, y + 3.85, zb - 1.28], [cx + 18, y + 3.85, zb - 1.28], 0.03, PAL.laton, A.metal, 8)
  L.barra([cx - 18, y + 3.35, zb - 1.28], [cx + 18, y + 3.35, zb - 1.28], 0.012, PAL.laton, A.metal, 6)
  for (let x = cx - 15; x <= cx + 15; x += 6) L.cil(x, y, zb - 1.15, 0.1, 2.75, "#3a2618", A.satin, 10)
  // escalera rodante
  const ex = cx + 7
  L.barra([ex - 0.3, y, zb - 1.8], [ex - 0.3, y + 2.8, zb - 1.32], 0.025, PAL.laton, A.metal, 6)
  L.barra([ex + 0.3, y, zb - 1.8], [ex + 0.3, y + 2.8, zb - 1.32], 0.025, PAL.laton, A.metal, 6)
  for (let i = 1; i < 8; i++) L.barra([ex - 0.3, y + i * 0.35, zb - 1.8 + i * 0.06], [ex + 0.3, y + i * 0.35, zb - 1.8 + i * 0.06], 0.018, "#5a3a26", A.satin, 5)
  // estantes en los muros laterales
  estante(o, x0 + T_MURO, y, cz + 4, 22, 2.5, Math.PI / 2, 6)
  estante(o, x1 - T_MURO, y, cz + 4, 22, 2.5, -Math.PI / 2, 6)
  // estanterías de doble cara
  for (const ez of [z1 - 6.5, z1 - 10]) {
    for (const exx of [cx - 9, cx + 9]) {
      estante(o, exx, y, ez - 0.43, 9, 2.2, 0, 5)
      estante(o, exx, y, ez + 0.43, 9, 2.2, Math.PI, 5)
    }
  }
  // mesas largas con lámparas verdes
  for (const mx of [cx - 8, cx + 8]) {
    const mz = z0 + 11.5
    L.ext(mx - 3.6, mx + 3.6, y + 0.72, y + 0.78, mz - 0.7, mz + 0.7, "#6b432a", A.laca)
    for (const sx of [-3.2, 3.2]) L.ext(mx + sx - 0.12, mx + sx + 0.12, y, y + 0.72, mz - 0.55, mz + 0.55, "#4a2e1c", A.satin)
    for (let k = -1; k <= 1; k++) {
      const lx = mx + k * 2.3
      L.cil(lx, y + 0.78, mz, 0.08, 0.03, PAL.laton, A.metal, 10)
      L.barra([lx, y + 0.8, mz], [lx, y + 1.12, mz], 0.012, PAL.laton, A.metal, 4)
      L.ext(lx - 0.24, lx + 0.24, y + 1.1, y + 1.2, mz - 0.1, mz + 0.1, "#17673a", A.pulido)
      L.ext(lx - 0.2, lx + 0.2, y + 1.095, y + 1.1, mz - 0.07, mz + 0.07, "#fff0c8", A.luz(3.4))
      o.adi.geo(PIRAMIDE(0.25), M(lx, y + 0.94, mz, 0.42, 0.32, 0.28), "#ffe7b0", A.mate, { grad: [0.06, 0.2] })
    }
    for (let k = 0; k < 5; k++) {
      const sx = mx - 2.8 + k * 1.4
      sillaBistro(L, sx, y, mz - 1.1, 0, "#3b2418")
      sillaBistro(L, sx, y, mz + 1.1, Math.PI, "#3b2418")
    }
  }
  // sillones de cuero, lámpara de pie y un globo terráqueo
  for (const [sx, ry] of [
    [x0 + 3, Math.PI / 2],
    [x1 - 3, -Math.PI / 2],
  ] as Array<[number, number]>) {
    sofa(L, sx, y, z0 + 4, ry, "#6a3a22", 1.1)
    L.cil(sx + (ry > 0 ? 0.9 : -0.9), y, z0 + 5.4, 0.03, 1.6, PAL.laton, A.metal, 6)
    L.cil(sx + (ry > 0 ? 0.9 : -0.9), y + 1.5, z0 + 5.4, 0.22, 0.3, "#efe2c4", A.luz(1.4), 14, 0.7)
  }
  L.cil(cx, y, z0 + 4, 0.25, 0.04, PAL.laton, A.metal, 14)
  L.cil(cx, y + 0.04, z0 + 4, 0.03, 0.8, PAL.laton, A.metal, 6)
  L.esf(cx, y + 1.15, z0 + 4, 0.34, "#2f6f9f", A.laca, 1, 18, 12)
  L.toro(cx, y + 1.15, z0 + 4, 0.38, 0.015, PAL.laton, A.metal, 24, 0, 0.4)
  planta(L, cx - 3.4, y + 0.03, z0 + 1.6, 1.4, rnd)
  planta(L, cx + 3.4, y + 0.03, z0 + 1.6, 1.4, rnd)
  totem(o, cx, cz, "biblioteca")
}

function parque(o: Obra, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#5c8f3d", A.mate)
  // matices del pasto
  for (let i = 0; i < 18; i++) {
    const px = x0 + 2 + rnd() * 36
    const pz = z0 + 6 + rnd() * 26
    L.ext(px - 1.5 - rnd() * 2, px + 1.5 + rnd() * 2, y + 0.03, y + 0.034, pz - 1 - rnd() * 2, pz + 1 + rnd() * 2, rnd() < 0.5 ? "#679c45" : "#527f37", A.mate)
  }
  muros(o, cx, cz, { muro: "#ece7de", lados: "mixto", acento: "#8fdc6a" })
  // muro verde en el fondo
  for (let i = 0; i < 260; i++) L.blob(x0 + 1 + rnd() * 38, y + 0.3 + rnd() * 2.4, z1 - T_MURO - 0.12 - rnd() * 0.12, 0.22 + rnd() * 0.16, HOJAS[Math.floor(rnd() * HOJAS.length)], A.mate, 1, 0)
  // camino: de la puerta a un anillo alrededor del árbol central
  const pcz = cz + 2
  L.ext(cx - 1.2, cx + 1.2, y + 0.03, y + 0.05, z0, pcz - 8.5, "#ddd6c8", A.satin)
  L.aro(cx, y + 0.05, pcz, 7.6, 9.4, "#ddd6c8", A.satin, 64)
  L.cil(cx, y + 0.03, pcz, 2.2, 0.35, "#b9b2a5", A.satin, 32)
  L.cil(cx, y + 0.2, pcz, 1.9, 0.2, "#3a8fb0", A.pulido, 32)
  arbol(L, cx, y + 0.38, pcz, 1.35, rnd, ["#f6b8c8", "#f0a2b8", "#fbd0dc", "#e98fa9"])
  // árboles alrededor
  const puestos: Array<[number, number, number]> = [
    [x0 + 4, z0 + 8, 1.0],
    [x1 - 4, z0 + 9, 1.1],
    [x0 + 5, z1 - 6, 1.2],
    [x1 - 5, z1 - 5, 1.0],
    [x0 + 3.5, cz + 2, 0.9],
    [x1 - 3.5, cz + 3, 0.95],
    [cx - 11, z1 - 4, 0.85],
    [cx + 11, z1 - 4, 0.9],
  ]
  for (const [px, pz, s] of puestos) arbol(L, px, y + 0.03, pz, s, rnd)
  // flores y arbustos
  const flores = ["#f2c230", "#e8484e", "#f4f2ed", "#b05ad8", "#ff8a3d"]
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2
    const r = 10 + rnd() * 5
    const px = cx + Math.cos(a) * r
    const pz = pcz + Math.sin(a) * r * 0.8
    if (Math.abs(px - cx) < 2 && pz < pcz) continue
    if (px < x0 + 1 || px > x1 - 1 || pz < z0 + 2 || pz > z1 - 1) continue
    if (rnd() < 0.35) L.blob(px, y + 0.25, pz, 0.35 + rnd() * 0.2, HOJAS[Math.floor(rnd() * HOJAS.length)], A.mate, 0.8, 0)
    else L.blob(px, y + 0.12, pz, 0.1 + rnd() * 0.06, flores[Math.floor(rnd() * flores.length)], A.satin, 1, 0)
  }
  // bancas mirando al árbol
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const bx = cx + Math.sin(a) * 10.1
    const bz = pcz + Math.cos(a) * 10.1
    banca(L, bx, y + 0.03, bz, Math.atan2(cx - bx, pcz - bz))
  }
  // Tragaluz que brilla: marco de vidrio arriba y haces de luz
  const ty = y + 6.45
  const tw = 8
  for (let k = -tw; k <= tw + 0.01; k += 2) {
    L.ext(cx + k - 0.04, cx + k + 0.04, ty, ty + 0.1, pcz - tw, pcz + tw, PAL.remate, A.metal)
    L.ext(cx - tw, cx + tw, ty, ty + 0.1, pcz + k - 0.04, pcz + k + 0.04, PAL.remate, A.metal)
  }
  o.adi.piso(cx - tw, cx + tw, pcz - tw, pcz + tw, ty + 0.02, "#bfe4ff", A.mate)
  o.adi.piso(cx - tw, cx + tw, pcz - tw, pcz + tw, ty + 0.03, "#7fb8e6", A.mate)
  for (const [dx, dz, w] of [
    [-3.5, -2, 4.2],
    [2.5, 1.5, 5.0],
    [-1, 4.5, 3.4],
  ] as Array<[number, number, number]>) {
    o.adi.geo(BOX(), M(cx + dx + 0.8, y + 3.2, pcz + dz, w, 6.4, w * 0.8, 0.2, 0, -0.12), "#fff3d6", A.mate, { grad: [0.0, 0.22] })
  }
  totem(o, cx, cz, "parque-int")
}

function piscina(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  const px0 = cx - 12.5
  const px1 = cx + 12.5
  const pz0 = cz - 1.5
  const pz1 = cz + 8.5
  const piedra = "#e7e2d8"
  // piso con el hueco de la piscina
  L.ext(x0, x1, y, y + 0.03, z0, pz0, piedra, A.laca)
  L.ext(x0, x1, y, y + 0.03, pz1, z1, piedra, A.laca)
  L.ext(x0, px0, y, y + 0.03, pz0, pz1, piedra, A.laca)
  L.ext(px1, x1, y, y + 0.03, pz0, pz1, piedra, A.laca)
  // borde
  L.ext(px0 - 0.4, px1 + 0.4, y + 0.03, y + 0.07, pz0 - 0.4, pz0, PAL.blanco, A.satin)
  L.ext(px0 - 0.4, px1 + 0.4, y + 0.03, y + 0.07, pz1, pz1 + 0.4, PAL.blanco, A.satin)
  L.ext(px0 - 0.4, px0, y + 0.03, y + 0.07, pz0, pz1, PAL.blanco, A.satin)
  L.ext(px1, px1 + 0.4, y + 0.03, y + 0.07, pz0, pz1, PAL.blanco, A.satin)
  // vaso: paredes y fondo de azulejo, con líneas de carril
  const fondo = y - 1.1
  L.ext(px0, px1, fondo - 0.05, fondo, pz0, pz1, "#8fd3e2", A.laca)
  L.ext(px0, px1, fondo, y, pz0, pz0 + 0.02, "#a6dcea", A.laca)
  L.ext(px0, px1, fondo, y, pz1 - 0.02, pz1, "#a6dcea", A.laca)
  L.ext(px0, px0 + 0.02, fondo, y, pz0, pz1, "#a6dcea", A.laca)
  L.ext(px1 - 0.02, px1, fondo, y, pz0, pz1, "#a6dcea", A.laca)
  for (let i = 0; i < 4; i++) {
    const lz = pz0 + 1.25 + i * 2.5
    L.ext(px0 + 2, px1 - 2, fondo, fondo + 0.005, lz - 0.12, lz + 0.12, "#1d4f7a", A.laca)
  }
  muros(o, cx, cz, { muro: "#e9f0f2", lados: "mixto", acento: "#3ad0ff" })
  // mosaico azul en el muro del fondo
  for (let i = 0; i < 40; i++) for (let j = 0; j < 5; j++) L.ext(x0 + 0.6 + i * 0.97, x0 + 1.5 + i * 0.97, y + 0.2 + j * 0.5, y + 0.66 + j * 0.5, z1 - T_MURO - 0.02, z1 - T_MURO, (i + j) % 3 ? "#2a78b0" : "#5fb3d9", A.laca)
  // corcheras
  const cols = ["#d8262f", "#f4f2ed", "#1f4fb8"]
  for (let i = 1; i < 4; i++) {
    const lz = pz0 + i * 2.5
    for (let k = 0; k < 12; k++) {
      const xa = px0 + k * (25 / 12)
      L.barra([xa, y - 0.1, lz], [xa + 25 / 12, y - 0.1, lz], 0.05, cols[(k + i) % 3], A.satin, 6)
    }
  }
  // poyetes de salida y escaleras
  for (let i = 0; i < 4; i++) {
    const lz = pz0 + 1.25 + i * 2.5
    L.ext(px0 - 0.9, px0 - 0.3, y + 0.03, y + 0.7, lz - 0.3, lz + 0.3, PAL.blanco, A.laca)
    L.ext(px0 - 0.9, px0 - 0.3, y + 0.7, y + 0.74, lz - 0.32, lz + 0.32, "#1f4fb8", A.laca)
  }
  for (const lz of [pz0 + 1.2, pz1 - 1.2]) {
    for (const dz of [-0.28, 0.28]) {
      L.barra([px1 + 0.3, y + 0.9, lz + dz], [px1 + 0.3, y + 0.05, lz + dz], 0.025, PAL.cromo, A.cromo, 6)
      L.barra([px1 + 0.3, y + 0.9, lz + dz], [px1 - 0.15, y + 0.9, lz + dz], 0.025, PAL.cromo, A.cromo, 6)
      L.barra([px1 - 0.15, y + 0.9, lz + dz], [px1 - 0.15, y - 0.8, lz + dz], 0.025, PAL.cromo, A.cromo, 6)
    }
  }
  // tumbonas
  for (let i = 0; i < 7; i++) {
    const tx = px0 + 1 + i * 3.8
    const tz = z1 - 3.4
    L.ext(tx - 0.35, tx + 0.35, y + 0.03, y + 0.3, tz - 0.9, tz + 0.9, PAL.blanco, A.laca)
    L.ext(tx - 0.33, tx + 0.33, y + 0.3, y + 0.37, tz - 0.4, tz + 0.88, i % 2 ? "#f4f2ed" : "#2a6fd6", A.tela)
    L.caja(tx, y + 0.3, tz - 0.62, 0.66, 0.7, 0.07, i % 2 ? "#f4f2ed" : "#2a6fd6", A.tela, 0, 0.75)
  }
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.5, o.rnd)
  planta(L, x0 + 1.3, y + 0.03, z1 - 1.4, 1.5, o.rnd)
  planta(L, x1 - 1.3, y + 0.03, z1 - 1.4, 1.5, o.rnd)

  // Agua animada y cáusticas en el fondo
  const olas = o.texturas.olas
  const caus = o.texturas.causticas
  if (olas) {
    const mat = new THREE.MeshStandardMaterial({
      color: "#1593b8",
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78,
      normalMap: olas,
      normalScale: new THREE.Vector2(0.45, 0.45),
      envMapIntensity: 1.4,
    })
    olas.repeat.set(5, 2)
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(25, 10), mat)
    agua.rotation.x = -Math.PI / 2
    agua.position.set(cx, y - 0.13, (pz0 + pz1) / 2)
    agua.renderOrder = 2
    o.extras.push(agua)
    o.anim.push((t) => {
      olas.offset.set(t.tiempo * 0.012, t.tiempo * 0.007)
    })
  }
  if (caus) {
    caus.repeat.set(6, 2.4)
    const mat = new THREE.MeshBasicMaterial({
      map: caus,
      color: new THREE.Color(0.35, 0.75, 0.85),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const c = new THREE.Mesh(new THREE.PlaneGeometry(25, 10), mat)
    c.rotation.x = -Math.PI / 2
    c.position.set(cx, fondo + 0.02, (pz0 + pz1) / 2)
    c.raycast = () => {}
    o.extras.push(c)
    o.anim.push((t) => {
      caus.offset.set(Math.sin(t.tiempo * 0.15) * 0.05 + t.tiempo * 0.01, t.tiempo * 0.006)
    })
  }
  totem(o, cx, cz, "piscina-int")
}

function cine(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#1c1e26", A.tela)
  muros(o, cx, cz, { muro: "#2b2631", lados: "solido", frente: "solido" })
  // paneles acústicos
  for (const xs of [x0 + T_MURO, x1 - T_MURO - 0.08]) for (let z = z0 + 8; z < z1 - 2; z += 1.6) L.ext(xs, xs + 0.08, y + 0.4, y + 2.6, z, z + 1.45, (Math.floor(z) % 2) ? "#3a2f40" : "#463a4e", A.tela)
  // pantalla y escenario
  const r = o.uvEsp.cine
  const sw = 12
  const sh = sw * 0.5
  const sz = z1 - 0.5
  L.ext(cx - sw / 2 - 0.25, cx + sw / 2 + 0.25, y + 0.7, y + 0.95 + sh + 0.25, sz - 0.02, sz + 0.2, "#0b0b0e", A.laca)
  if (r) o.esp.quad(cx, y + 0.95 + sh / 2, sz - 0.025, sw, sh, Math.PI, "#ffffff", A.mate, r.uv)
  L.ext(cx - 8, cx + 8, y, y + 0.5, z1 - 2.6, z1 - 0.3, "#15161b", A.satin)
  // gradas con butacas rojas mirando a la pantalla (+z)
  const filas = 5
  for (let i = 0; i < filas; i++) {
    const zr = z1 - 9 - i * 1.4
    const h = i * 0.32
    if (i > 0) {
      L.ext(cx - 9.5, cx + 9.5, y, y + h, zr - 0.7, zr + 0.7, "#23252e", A.tela)
      L.ext(cx - 9.5, cx + 9.5, y + h - 0.03, y + h, zr + 0.69, zr + 0.71, PAL.luzCalida, A.luz(2.2))
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const bx = cx + s * (1.25 + k * 0.68)
        L.ext(bx - 0.28, bx + 0.28, y + h + 0.3, y + h + 0.44, zr - 0.25, zr + 0.25, "#9c1c2b", A.tela)
        L.caja(bx, y + h + 0.42, zr - 0.3, 0.56, 0.6, 0.12, "#8a1726", A.tela, 0, -0.12)
        L.ext(bx - 0.31, bx - 0.27, y + h, y + h + 0.62, zr - 0.3, zr + 0.2, "#16171b", A.satin)
      }
      const bx = cx + s * (1.25 + 3 * 0.68)
      L.ext(bx + 0.27, bx + 0.31, y + h, y + h + 0.62, zr - 0.3, zr + 0.2, "#16171b", A.satin)
    }
  }
  // plataforma de atrás con la cabina de proyección
  const zt = z1 - 9 - (filas - 1) * 1.4 - 0.7
  const ht = (filas - 1) * 0.32
  L.ext(cx - 9.5, cx + 9.5, y, y + ht, z0 + 8, zt, "#23252e", A.tela)
  L.ext(cx - 9.5, cx + 9.5, y + ht - 0.03, y + ht, z0 + 7.98, z0 + 8.0, PAL.luzCalida, A.luz(2.2))
  L.ext(cx - 1, cx + 1, y + ht, y + ht + 1.4, z0 + 8.3, z0 + 9.6, "#15161b", A.satin)
  L.geo(CIL(16), M(cx, y + ht + 0.9, z0 + 9.7, 0.14, 0.2, 0.14, 0, Math.PI / 2), "#ffffff", A.luz(4))
  // haz del proyector
  const p0 = new THREE.Vector3(cx, y + ht + 0.9, z0 + 9.8)
  const p1 = new THREE.Vector3(cx, y + 0.95 + sh / 2, sz)
  const largo = p0.distanceTo(p1)
  const mid = p0.clone().add(p1).multiplyScalar(0.5)
  const incl = Math.atan2(p1.y - p0.y, p1.z - p0.z)
  o.adi.geo(PIRAMIDE(0.01), M(mid.x, mid.y, mid.z, sw / 2, largo, sh / 2, 0, Math.PI / 2 - incl), "#cfe2ff", A.mate, { grad: [0.03, 0.22] })
  totem(o, cx, cz, "cine")
}

function capilla(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#ece6d9", A.pulido)
  muros(o, cx, cz, { muro: "#efe4d2", lados: "solido", frente: "solido" })
  // alfombra del pasillo central
  L.ext(cx - 0.9, cx + 0.9, y + 0.03, y + 0.04, z0 + 1, z1 - 6.5, "#7a1e24", A.tela)
  // ventanas altas de luz cálida en los lados
  for (const xs of [x0 + T_MURO + 0.01, x1 - T_MURO - 0.03]) for (let z = z0 + 5; z < z1 - 3; z += 4) L.ext(xs, xs + 0.02, y + 0.8, y + 2.6, z - 0.35, z + 0.35, "#ffcf8a", A.luz(2.2))
  // bancos de madera (miran al altar, +z)
  for (let i = 0; i < 7; i++) {
    const bz = z0 + 8 + i * 2.3
    for (const s of [-1, 1]) {
      const bx = cx + s * 4.6
      L.ext(bx - 2.9, bx + 2.9, y + 0.42, y + 0.48, bz - 0.25, bz + 0.2, "#8a5a36", A.satin)
      L.ext(bx - 2.9, bx + 2.9, y + 0.48, y + 1.0, bz - 0.3, bz - 0.24, "#7a4e2e", A.satin)
      for (const e of [-2.9, 2.9]) L.ext(bx + e - 0.04, bx + e + 0.04, y, y + 1.0, bz - 0.32, bz + 0.22, "#6a4226", A.satin)
    }
  }
  // altar sobre gradas
  const az = z1 - 6
  for (let i = 0; i < 3; i++) L.ext(cx - 7 + i * 0.4, cx + 7 - i * 0.4, y, y + 0.15 * (i + 1), az + i * 0.4, z1 - T_MURO, "#e2dccf", A.pulido)
  L.ext(cx - 1.6, cx + 1.6, y + 0.45, y + 1.4, z1 - 3.8, z1 - 2.9, "#f6f2ea", A.satin)
  L.ext(cx - 1.7, cx + 1.7, y + 1.4, y + 1.46, z1 - 3.9, z1 - 2.8, PAL.laton, A.metal)
  // velas
  for (let k = -2; k <= 2; k++) {
    if (k === 0) continue
    const vx = cx + k * 1.6
    L.cil(vx, y + 0.45, z1 - 2.4, 0.08, 1.2, PAL.laton, A.metal, 8)
    L.cil(vx, y + 1.65, z1 - 2.4, 0.04, 0.25, "#f6f0e2", A.satin, 8)
    L.blob(vx, y + 1.95, z1 - 2.4, 0.035, "#ffb347", A.luz(5), 1.8, 0)
  }
  for (let k = 0; k < 9; k++) L.blob(cx - 1.2 + k * 0.3, y + 1.52, z1 - 3.3, 0.022, "#ffc46b", A.luz(5), 1.8, 0)
  // vitral en el muro del fondo (dos caras: el vidrio deja ver la luz de los dos lados)
  const r = o.uvEsp.vitral
  const vw = 3.8
  const vh = 7.6
  const vz = z1 - T_MURO - 0.04
  if (r) {
    L.ext(cx - vw / 2 - 0.25, cx + vw / 2 + 0.25, y + 0.9, y + 1.3, vz - 0.1, vz + 0.12, "#d9cfbd", A.satin)
    o.esp.quad(cx, y + 1.3 + vh / 2, vz, vw, vh, Math.PI, "#ffffff", A.mate, r.uv)
    o.esp.quad(cx, y + 1.3 + vh / 2, vz + 0.02, vw, vh, 0, "#ffffff", A.mate, r.uv)
    // luz de colores que baja del vitral
    o.adi.geo(BOX(), M(cx, y + 2.8, vz - 3.2, vw * 0.9, 5.6, 6.0, 0, -0.5), "#ffd9a8", A.mate, { grad: [0.0, 0.13] })
  }
  planta(L, cx - 3, y + 0.45, z1 - 3.4, 1.0, o.rnd)
  planta(L, cx + 3, y + 0.45, z1 - 3.4, 1.0, o.rnd)
  totem(o, cx, cz, "capilla")
}

function estudio(o: Obra, cx: number, cz: number) {
  const { cel: L, y } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#141518", A.pulido)
  muros(o, cx, cz, { muro: "#2a2c31", lados: "solido" })
  // ciclorama verde (fondo, curva y piso)
  const verde = "#25c35a"
  const gx0 = cx - 18
  const gx1 = cx - 4
  const gz = z1 - T_MURO - 0.05
  L.ext(gx0, gx1, y + 0.9, y + 3.2, gz - 0.06, gz, verde, A.mate)
  const curva = proto("curva", () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, Math.PI, Math.PI / 2))
  L.geo(curva, M((gx0 + gx1) / 2, y + 0.92, gz - 0.92, 0.9, gx1 - gx0, 0.9, 0, 0, Math.PI / 2), verde, A.mate)
  L.ext(gx0, gx1, y + 0.03, y + 0.05, gz - 6, gz - 0.9, verde, A.mate)
  // luces en trípode con caja de luz
  const luzTripode = (x: number, z: number, ry: number) => {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3
      L.barra([x + Math.sin(a) * 0.5, y, z + Math.cos(a) * 0.5], [x, y + 1.0, z], 0.018, PAL.negro, A.metal, 4)
    }
    L.cil(x, y + 1.0, z, 0.022, 1.3, PAL.negro, A.metal, 6)
    L.en(M(x, y + 2.35, z, 1, 1, 1, ry, -0.25), () => {
      L.ext(-0.55, 0.55, -0.4, 0.4, -0.22, 0.05, PAL.negro, A.satin)
      L.ext(-0.5, 0.5, -0.35, 0.35, 0.05, 0.06, "#ffffff", A.luz(3.2))
    })
  }
  luzTripode(cx - 16, z1 - 9, Math.PI * 0.82)
  luzTripode(cx - 6, z1 - 9, -Math.PI * 0.82)
  luzTripode(cx - 11, z1 - 11, Math.PI)
  // cámara de cine en trípode, con luz roja de grabación
  const kx = cx - 11
  const kz = z1 - 13.5
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3
    L.barra([kx + Math.sin(a) * 0.55, y, kz + Math.cos(a) * 0.55], [kx, y + 1.2, kz], 0.02, PAL.negro, A.metal, 4)
  }
  L.ext(kx - 0.16, kx + 0.16, y + 1.2, y + 1.48, kz - 0.25, kz + 0.25, "#1b1c20", A.satin)
  L.geo(CIL(16), M(kx, y + 1.34, kz + 0.38, 0.1, 0.3, 0.1, 0, Math.PI / 2), "#0e0f12", A.metal)
  L.ext(kx + 0.1, kx + 0.14, y + 1.44, y + 1.48, kz - 0.26, kz - 0.25, "#ff2a2a", A.luz(4))
  // micrófono de caña
  L.cil(cx - 8, y, z1 - 7, 0.2, 0.03, PAL.negro, A.metal, 10)
  L.cil(cx - 8, y, z1 - 7, 0.02, 2.2, PAL.negro, A.metal, 6)
  L.barra([cx - 8, y + 2.2, z1 - 7], [cx - 10.4, y + 2.6, z1 - 5.6], 0.015, PAL.negro, A.metal, 4)
  L.geo(CIL(10), M(cx - 10.4, y + 2.5, z1 - 5.6, 0.04, 0.35, 0.04, 0, 0, Math.PI / 2), "#2a2c31", A.satin)
  // set de pódcast: mesa redonda, micrófonos, aro de luz y "AL AIRE"
  const px = cx + 9
  const pz = z0 + 15
  mesaRedonda(L, px, y, pz, 1.0, "#2a2018", A.laca)
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI
    const sx = px + Math.sin(a) * 1.45
    const sz = pz + Math.cos(a) * 1.45
    sillaOficina(L, sx, y, sz, Math.atan2(px - sx, pz - sz), "#3a3f4a")
    const mx = px + Math.sin(a) * 0.7
    const mz = pz + Math.cos(a) * 0.7
    L.barra([mx, y + 0.74, mz], [mx, y + 1.05, mz], 0.012, PAL.negro, A.metal, 4)
    L.cil(mx, y + 1.02, mz, 0.035, 0.14, "#202226", A.metal, 8)
  }
  L.cil(px + 2.6, y, pz + 1.4, 0.2, 0.03, PAL.negro, A.metal, 10)
  L.cil(px + 2.6, y, pz + 1.4, 0.02, 1.5, PAL.negro, A.metal, 6)
  L.toro(px + 2.6, y + 1.85, pz + 1.4, 0.36, 0.035, "#ffffff", A.luz(3.4), 32, 0, -0.9)
  const ra = o.uvEsp.alAire
  if (ra) {
    L.ext(px - 1.1, px + 1.1, y + 2.0, y + 2.6, z1 - T_MURO - 0.08, z1 - T_MURO, "#2a0b0e", A.laca)
    o.esp.quad(px, y + 2.3, z1 - T_MURO - 0.085, 2.0, 0.5, Math.PI, "#ffffff", A.mate, ra.uv)
  }
  // espuma acústica en el muro este
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) L.ext(x1 - T_MURO - 0.1, x1 - T_MURO, y + 0.4 + j * 0.55, y + 0.9 + j * 0.55, z0 + 6 + i * 1.6, z0 + 7.5 + i * 1.6, (i + j) % 2 ? "#3a3d45" : "#2c2f36", A.tela)
  // mesa de edición con dos pantallas
  const ex = cx + 10
  const ez = z1 - 5
  L.ext(ex - 1.5, ex + 1.5, y + 0.72, y + 0.76, ez - 0.4, ez + 0.4, "#2a2018", A.laca)
  for (const s of [-1, 1]) L.ext(ex + s * 1.4 - 0.04, ex + s * 1.4 + 0.04, y, y + 0.72, ez - 0.35, ez + 0.35, PAL.negro, A.metal)
  for (const s of [-0.7, 0.7]) {
    L.ext(ex + s - 0.5, ex + s + 0.5, y + 0.95, y + 1.55, ez + 0.2, ez + 0.24, "#111", A.satin)
    L.ext(ex + s - 0.47, ex + s + 0.47, y + 0.98, y + 1.52, ez + 0.19, ez + 0.2, s < 0 ? "#3a6dd8" : "#25c35a", A.luz(1.6))
  }
  sillaOficina(L, ex, y, ez - 1.0, 0, "#3a3f4a")
  totem(o, cx, cz, "estudio")
}

function ajedrez(o: Obra, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#9b6b43", A.laca)
  for (let z = z0 + 0.5; z < z1; z += 0.5) L.ext(x0, x1, y + 0.03, y + 0.031, z - 0.005, z + 0.005, "#7d5232", A.laca)
  L.ext(cx - 17, cx - 1, y + 0.03, y + 0.04, z0 + 6, z0 + 20, "#2f3b55", A.tela)
  muros(o, cx, cz, { muro: "#efe7da", lados: "mixto", acento: "#c9a15b" })
  // mesas de ajedrez con tablero de 8 x 8
  const tableros: Array<[number, number]> = [
    [cx - 13, z0 + 9.5],
    [cx - 6, z0 + 9.5],
    [cx - 13, z0 + 16],
    [cx - 6, z0 + 16],
  ]
  for (const [tx, tz] of tableros) {
    L.ext(tx - 0.5, tx + 0.5, y + 0.7, y + 0.75, tz - 0.5, tz + 0.5, "#3a2418", A.laca)
    L.cil(tx, y, tz, 0.06, 0.7, "#2a1a10", A.satin, 8)
    L.cil(tx, y, tz, 0.3, 0.03, "#2a1a10", A.satin, 12)
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) L.ext(tx - 0.4 + i * 0.1, tx - 0.3 + i * 0.1, y + 0.75, y + 0.755, tz - 0.4 + j * 0.1, tz - 0.3 + j * 0.1, (i + j) % 2 ? "#3b2a20" : "#efe6d2", A.laca)
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(rnd() * 8)
      const j = rnd() < 0.5 ? Math.floor(rnd() * 2) : 6 + Math.floor(rnd() * 2)
      const blanca = j < 4
      const h = rnd() < 0.2 ? 0.09 : 0.05
      L.cil(tx - 0.35 + i * 0.1, y + 0.755, tz - 0.35 + j * 0.1, 0.028, h, blanca ? "#f4ecda" : "#1a1612", A.laca, 8, 0.6)
    }
    sillaBistro(L, tx, y, tz - 0.95, 0, "#2a2f37")
    sillaBistro(L, tx, y, tz + 0.95, Math.PI, "#2a2f37")
  }
  // mesa de billar
  const bx = cx + 9
  const bz = z0 + 13
  L.ext(bx - 1.55, bx + 1.55, y + 0.15, y + 0.72, bz - 0.9, bz + 0.9, "#4a2a18", A.laca)
  for (const sx of [-1.35, 1.35]) for (const sz of [-0.7, 0.7]) L.ext(bx + sx - 0.1, bx + sx + 0.1, y, y + 0.2, bz + sz - 0.1, bz + sz + 0.1, "#3a2012", A.laca)
  L.ext(bx - 1.42, bx + 1.42, y + 0.72, y + 0.76, bz - 0.77, bz + 0.77, "#1f7a4c", A.tela)
  for (const s of [-1, 1]) {
    L.ext(bx - 1.55, bx + 1.55, y + 0.72, y + 0.82, bz + s * 0.83 - 0.07, bz + s * 0.83 + 0.07, "#5a321c", A.laca)
    L.ext(bx + s * 1.48 - 0.07, bx + s * 1.48 + 0.07, y + 0.72, y + 0.82, bz - 0.9, bz + 0.9, "#5a321c", A.laca)
  }
  for (const px of [-1.42, 0, 1.42]) for (const pz of [-0.77, 0.77]) L.cil(bx + px, y + 0.761, bz + pz, 0.06, 0.005, "#050505", A.mate, 10)
  const bolas = ["#f2c230", "#1f4fb8", "#c8202c", "#5a2a8a", "#ff7a1a", "#1f7a4c", "#7a1f24", "#111111", "#f2c230", "#1f4fb8", "#c8202c", "#5a2a8a", "#ff7a1a", "#1f7a4c", "#7a1f24"]
  let k = 0
  for (let fila = 0; fila < 5; fila++) {
    for (let i = 0; i <= fila; i++) {
      L.esf(bx + 0.55 + fila * 0.05, y + 0.79, bz - fila * 0.029 + i * 0.058, 0.028, bolas[k % bolas.length], A.pulido, 1, 10, 6)
      k++
    }
  }
  L.esf(bx - 0.7, y + 0.79, bz, 0.028, "#f8f6f0", A.pulido, 1, 10, 6)
  L.barra([bx - 1.0, y + 0.82, bz + 0.2], [bx - 2.4, y + 0.95, bz + 0.5], 0.012, "#c9a173", A.satin, 5)
  for (const sx of [-2.2, 2.2]) {
    L.cil(bx + sx, y, bz - 1.4, 0.2, 0.03, PAL.negro, A.metal, 10)
    L.cil(bx + sx, y, bz - 1.4, 0.02, 1.7, PAL.negro, A.metal, 6)
    L.cil(bx + sx, y + 1.62, bz - 1.4, 0.24, 0.26, "#f3e2c0", A.luz(1.6), 14, 0.6)
  }
  // mesa de cartas
  const cxm = cx + 9
  const czm = z1 - 8
  mesaRedonda(L, cxm, y, czm, 0.8, "#1f6a44", A.tela)
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const sx = cxm + Math.sin(a) * 1.2
    const sz = czm + Math.cos(a) * 1.2
    sillaBistro(L, sx, y, sz, Math.atan2(cxm - sx, czm - sz), "#7a1f24")
    L.caja(cxm + Math.sin(a) * 0.45, y + 0.74, czm + Math.cos(a) * 0.45, 0.09, 0.006, 0.13, "#f6f3ec", A.satin, a)
  }
  // diana en el muro del fondo
  const rd = o.uvEsp.diana
  if (rd) {
    L.geo(CIL(32), M(cx - 8, y + 1.75, z1 - T_MURO - 0.03, 0.27, 0.06, 0.27, 0, Math.PI / 2), "#1a1a1a", A.satin)
    o.esp.quad(cx - 8, y + 1.75, z1 - T_MURO - 0.065, 0.5, 0.5, Math.PI, "#ffffff", A.mate, rd.uv)
  }
  sofa(L, cx - 12, y, z1 - 3, Math.PI, "#6a4a7a", 2.4)
  sofa(L, cx - 4, y, z1 - 3, Math.PI, "#6a4a7a", 2.4)
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.5, rnd)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.5, rnd)
  totem(o, cx, cz, "ajedrez")
}

function taller(o: Obra, cx: number, cz: number) {
  const { cel: L, y, rnd } = o
  const { x0, x1, z0, z1 } = bordes(cx, cz)
  L.ext(x0, x1, y, y + 0.03, z0, z1, "#b9bcc0", A.pulido)
  for (const [a, b] of [
    [z0 + 6, z0 + 6.1],
    [z1 - 9, z1 - 8.9],
  ])
    L.ext(x0 + 1, x1 - 1, y + 0.03, y + 0.034, a, b, "#f2c230", A.laca)
  muros(o, cx, cz, { muro: "#e9e6e1", lados: "mixto", acento: "#f08a24" })
  // mesas de trabajo con tablero perforado y herramientas
  const mesaTrabajo = (x: number, z: number, ry: number) => {
    L.en(M(x, y, z, 1, 1, 1, ry), () => {
      L.ext(-1.6, 1.6, 0.86, 0.94, -0.45, 0.45, "#c99a63", A.satin)
      for (const sx of [-1.5, 1.5]) for (const sz of [-0.38, 0.38]) L.ext(sx - 0.04, sx + 0.04, 0, 0.86, sz - 0.04, sz + 0.04, "#2c3037", A.metal)
      L.ext(-1.5, 1.5, 0.25, 0.28, -0.4, 0.4, "#2c3037", A.metal)
      L.ext(-1.6, 1.6, 0.94, 2.2, 0.43, 0.47, "#d8cdb8", A.satin)
      for (let i = 0; i < 7; i++) {
        const hx = -1.3 + i * 0.42
        L.ext(hx - 0.04, hx + 0.04, 1.3 + rnd() * 0.5, 1.75 + rnd() * 0.3, 0.38, 0.43, ["#c8202c", "#1f4fb8", "#2c3037", "#f2c230"][i % 4], A.satin)
      }
      L.ext(-1.0, -0.5, 0.94, 1.1, -0.2, 0.15, "#c8202c", A.laca)
      L.ext(0.4, 1.1, 0.94, 0.98, -0.3, 0.2, "#7aa4c8", A.satin)
    })
  }
  mesaTrabajo(x0 + 0.9, z0 + 12, -Math.PI / 2)
  mesaTrabajo(x0 + 0.9, z0 + 20, -Math.PI / 2)
  mesaTrabajo(x1 - 0.9, z0 + 12, Math.PI / 2)
  mesaTrabajo(x1 - 0.9, z0 + 20, Math.PI / 2)
  // brazo robótico naranja
  const rx = cx + 9
  const rz = z1 - 6
  L.cil(rx, y, rz, 0.45, 0.35, "#2c3037", A.metal, 18)
  L.cil(rx, y + 0.35, rz, 0.32, 0.4, "#f08a24", A.laca, 18)
  L.esf(rx, y + 0.85, rz, 0.26, "#2c3037", A.metal)
  L.barra([rx, y + 0.85, rz], [rx - 0.5, y + 2.0, rz - 0.4], 0.16, "#f08a24", A.laca, 10)
  L.esf(rx - 0.5, y + 2.0, rz - 0.4, 0.18, "#2c3037", A.metal)
  L.barra([rx - 0.5, y + 2.0, rz - 0.4], [rx - 1.4, y + 1.6, rz - 1.1], 0.12, "#f08a24", A.laca, 10)
  L.esf(rx - 1.4, y + 1.6, rz - 1.1, 0.12, "#2c3037", A.metal)
  L.barra([rx - 1.4, y + 1.6, rz - 1.1], [rx - 1.45, y + 1.2, rz - 1.15], 0.05, PAL.cromo, A.cromo, 8)
  // impresora 3D con cama luminosa
  const ix = cx - 10
  const iz = z1 - 5.5
  L.ext(ix - 0.9, ix + 0.9, y, y + 0.8, iz - 0.6, iz + 0.6, "#2c3037", A.satin)
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.4, 0.4]) L.ext(ix + sx - 0.03, ix + sx + 0.03, y + 0.8, y + 1.9, iz + sz - 0.03, iz + sz + 0.03, "#15171b", A.metal)
  L.ext(ix - 0.58, ix + 0.58, y + 1.86, y + 1.92, iz - 0.43, iz + 0.43, "#15171b", A.metal)
  L.ext(ix - 0.45, ix + 0.45, y + 1.0, y + 1.03, iz - 0.32, iz + 0.32, "#3ad0ff", A.luz(2.4))
  L.ext(ix - 0.1, ix + 0.1, y + 1.03, y + 1.25, iz - 0.1, iz + 0.1, "#f2c230", A.laca)
  o.vid.ext(ix - 0.55, ix + 0.55, y + 0.8, y + 1.9, iz - 0.42, iz - 0.4, "#ffffff", A.mate)
  // dron prototipo
  const dx = cx - 3
  const dz = z1 - 6
  L.ext(dx - 1.0, dx + 1.0, y + 0.74, y + 0.78, dz - 0.6, dz + 0.6, "#f2f0ec", A.laca)
  for (const s of [-1, 1]) L.ext(dx + s * 0.9 - 0.04, dx + s * 0.9 + 0.04, y, y + 0.74, dz - 0.5, dz + 0.5, "#2c3037", A.metal)
  L.caja(dx, y + 0.8, dz, 0.9, 0.04, 0.08, "#1b1d21", A.satin, Math.PI / 4)
  L.caja(dx, y + 0.8, dz, 0.9, 0.04, 0.08, "#1b1d21", A.satin, -Math.PI / 4)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    L.cil(dx + Math.sin(a) * 0.32, y + 0.84, dz + Math.cos(a) * 0.32, 0.17, 0.008, "#4a4f58", A.satin, 16)
  }
  L.ext(dx - 0.08, dx + 0.08, y + 0.84, y + 0.9, dz - 0.08, dz + 0.08, "#38d27f", A.luz(3))
  // engranajes de latón
  for (const [gx, gr] of [
    [cx - 4, 0.6],
    [cx - 2.95, 0.4],
    [cx - 5.1, 0.35],
  ] as Array<[number, number]>) {
    const gz = z1 - T_MURO - 0.06
    L.toro(gx, y + 1.9, gz, gr, 0.07, PAL.laton, A.metal, 24, 0)
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5
      L.caja(gx + Math.cos(a) * (gr + 0.07), y + 1.9 + Math.sin(a) * (gr + 0.07) - 0.05, gz, 0.1, 0.1, 0.08, PAL.laton, A.metal, 0, 0, a)
    }
  }
  // Homenaje a Leonardo: su máquina voladora de madera, colgada
  const lx = cx
  const ly = y + 4.3
  const lz = cz + 3
  const maderaL = "#9a6a3c"
  const tela = "#dcc79c"
  L.barra([lx, ly, lz - 1.8], [lx, ly, lz + 1.8], 0.05, maderaL, A.satin, 6)
  L.barra([lx - 0.4, ly - 0.5, lz - 1.2], [lx + 0.4, ly - 0.5, lz - 1.2], 0.035, maderaL, A.satin, 6)
  L.barra([lx - 0.4, ly - 0.5, lz + 1.2], [lx + 0.4, ly - 0.5, lz + 1.2], 0.035, maderaL, A.satin, 6)
  for (const s of [-1, 1]) {
    L.barra([lx + s * 0.4, ly - 0.5, lz - 1.2], [lx + s * 0.4, ly - 0.5, lz + 1.2], 0.035, maderaL, A.satin, 6)
    L.barra([lx + s * 0.4, ly - 0.5, lz - 1.2], [lx, ly, lz - 1.6], 0.03, maderaL, A.satin, 6)
    L.barra([lx + s * 0.4, ly - 0.5, lz + 1.2], [lx, ly, lz + 1.6], 0.03, maderaL, A.satin, 6)
    // ala de murciélago: costillas en abanico y tela entre ellas
    const raiz: [number, number, number] = [lx + s * 0.3, ly + 0.1, lz]
    const puntas: Array<[number, number, number]> = [
      [lx + s * 2.2, ly + 0.9, lz - 1.6],
      [lx + s * 4.2, ly + 1.1, lz - 1.1],
      [lx + s * 5.8, ly + 0.8, lz - 0.2],
      [lx + s * 5.2, ly + 0.5, lz + 0.9],
      [lx + s * 3.4, ly + 0.3, lz + 1.4],
      [lx + s * 1.4, ly + 0.15, lz + 1.5],
    ]
    for (const p of puntas) L.barra(raiz, p, 0.03, maderaL, A.satin, 5)
    for (let i = 0; i < puntas.length - 1; i++) {
      const a = puntas[i]
      const b = puntas[i + 1]
      const m: [number, number, number] = [(a[0] + b[0]) / 2 - s * 0.35, (a[1] + b[1]) / 2 - 0.15, (a[2] + b[2]) / 2]
      L.tri(raiz, a, m, tela, A.tela)
      L.tri(raiz, m, b, tela, A.tela)
    }
    L.barra([lx + s * 2.2, ly + 0.9, lz - 1.6], [lx + s * 2.2, y + 6.6, lz - 1.6], 0.008, PAL.remate, A.metal, 3)
    L.barra([lx + s * 3.4, ly + 0.3, lz + 1.4], [lx + s * 3.4, y + 6.6, lz + 1.4], 0.008, PAL.remate, A.metal, 3)
  }
  // prototipos sobre una mesa central
  L.ext(cx - 2.5, cx + 2.5, y + 0.86, y + 0.92, cz + 6.5, cz + 7.7, "#c99a63", A.satin)
  for (const s of [-2.3, 2.3]) L.ext(cx + s - 0.05, cx + s + 0.05, y, y + 0.86, cz + 6.6, cz + 7.6, "#2c3037", A.metal)
  L.toro(cx - 1.4, y + 1.1, cz + 7.1, 0.18, 0.04, PAL.laton, A.metal, 16, 0)
  L.esf(cx, y + 1.08, cz + 7.1, 0.16, "#7aa4c8", A.pulido)
  L.ext(cx + 1, cx + 1.8, y + 0.92, y + 1.2, cz + 6.8, cz + 7.4, "#f08a24", A.laca)
  planta(L, x0 + 1.3, y + 0.03, z0 + 1.4, 1.5, rnd)
  planta(L, x1 - 1.3, y + 0.03, z0 + 1.4, 1.5, rnd)
  totem(o, cx, cz, "taller-inventos")
}

const ESPECIALES: Record<string, (o: Obra, cx: number, cz: number) => void> = {
  cafeteria,
  "sala-guerra": salaGuerra,
  gimnasio,
  "basquet-int": basquet,
  "padel-int": padel,
  ring,
  biblioteca,
  "parque-int": parque,
  "piscina-int": piscina,
  cine,
  capilla,
  estudio,
  ajedrez,
  "taller-inventos": taller,
}

// ── Cascarón del nivel: losa, pasillos, muro perimetral, núcleo ──
const PASILLO_Z = [27, 65, 103]
const PASILLO_X = [-44, 0, 44]
const NUCLEO = { x: 0, z: 22, ejes: [-2.2, 2.2], medio: 1.3 }

function cascaron(o: Obra, techoNucleo: number) {
  const { cel: L, vid: V, y } = o
  const S = HUELLAS.subsuelo
  const rem = PAL.remate
  // losa gruesa y piso de los pasillos
  L.ext(S.x0, S.x1, y - 1.2, y - 0.03, S.z0, S.z1, PAL.losa, { r: 0.85, m: 0 })
  L.ext(S.x0, S.x1, y - 0.03, y, S.z0, S.z1, PAL.pasillo, A.pulido)
  // canto luminoso de la losa (se ve de lejos, como en las maquetas)
  const cy0 = y - 0.2
  const cy1 = y - 0.14
  L.ext(S.x0 - 0.01, S.x1 + 0.01, cy0, cy1, S.z0 - 0.02, S.z0, PAL.luzCalida, A.luz(2.4))
  L.ext(S.x0 - 0.01, S.x1 + 0.01, cy0, cy1, S.z1, S.z1 + 0.02, PAL.luzCalida, A.luz(2.4))
  L.ext(S.x0 - 0.02, S.x0, cy0, cy1, S.z0, S.z1, PAL.luzCalida, A.luz(2.4))
  L.ext(S.x1, S.x1 + 0.02, cy0, cy1, S.z0, S.z1, PAL.luzCalida, A.luz(2.4))
  // muro perimetral
  const t = 0.45
  for (const [x0, x1, z0, z1] of [
    [S.x0, S.x1, S.z0, S.z0 + t],
    [S.x0, S.x1, S.z1 - t, S.z1],
    [S.x0, S.x0 + t, S.z0, S.z1],
    [S.x1 - t, S.x1, S.z0, S.z1],
  ]) {
    L.ext(x0, x1, y, y + H, z0, z1, "#d8d3cb", A.satin)
    L.ext(x0 - 0.03, x1 + 0.03, y + H, y + H + 0.08, z0 - 0.03, z1 + 0.03, rem, A.laca)
  }
  // tiras de luz en el piso de los pasillos
  const tira = (x0: number, x1: number, z0: number, z1: number) => L.ext(x0, x1, y, y + 0.012, z0, z1, PAL.luzFria, A.luz(2.6))
  for (const z of PASILLO_Z) for (const s of [-1, 1]) tira(S.x0 + t, S.x1 - t, z + s * 1.7 - 0.035, z + s * 1.7 + 0.035)
  for (const x of PASILLO_X) {
    for (let r = 0; r < SUB_FILAS.length; r++) {
      const za = SUB_FILAS[r] - SUB_MEDIO_FONDO
      const zb = SUB_FILAS[r] + SUB_MEDIO_FONDO
      for (const s of [-1, 1]) tira(x + s * 1.7 - 0.035, x + s * 1.7 + 0.035, za, zb)
    }
  }
  for (const x of [S.x0 + 2.2, S.x1 - 2.2]) tira(x - 0.035, x + 0.035, PASILLO_Z[0] + 1.7, S.z1 - t)
  tira(S.x0 + t, S.x1 - t, S.z1 - 1.6 - 0.035, S.z1 - 1.6 + 0.035)
  // vestíbulo de los ascensores: piedra oscura, columnas y jardineras
  L.ext(-8, 8, y, y + 0.02, S.z0 + t, PASILLO_Z[0] - 1.9, PAL.piedraOscura, A.pulido)
  L.aro(0, y + 0.022, NUCLEO.z, 4.6, 4.68, PAL.laton, A.luz(1.8), 64, 0, Math.PI)
  for (const x of [-66, -22, 22, 66]) {
    L.cil(x, y, 21.6, 0.45, 3.05, PAL.columna, A.satin, 20)
    L.cil(x, y + 3.05, 21.6, 0.47, 0.07, rem, A.laca, 20)
  }
  for (const x of [-56, -32, 32, 56, -78, 78]) {
    L.ext(x - 2.6, x + 2.6, y, y + 0.55, S.z0 + t + 0.1, S.z0 + t + 1.1, "#2a2e35", A.satin)
    for (let k = 0; k < 6; k++) L.blob(x - 2.2 + k * 0.88, y + 0.75, S.z0 + t + 0.6, 0.35, HOJAS[(k + Math.abs(x)) % HOJAS.length], A.mate, 0.9, 0)
  }
  // título del nivel y directorio en el muro norte
  for (const [clave, x] of [
    ["titulo", -24],
    ["directorio", 24],
  ] as Array<[string, number]>) {
    const r = o.uvRot[clave]
    if (!r) continue
    const w = 12
    const h = (w * r.h) / r.w
    L.ext(x - w / 2 - 0.15, x + w / 2 + 0.15, y + 0.95, y + 1.1 + h + 0.15, S.z0 + t, S.z0 + t + 0.08, rem, A.laca)
    o.rot.quad(x, y + 1.1 + h / 2, S.z0 + t + 0.082, w, h, 0, "#ffffff", A.mate, r.uv)
  }
  // Núcleo de ascensores de vidrio: dos cajas que atraviesan los tres niveles
  const a = NUCLEO.medio
  for (const ex of NUCLEO.ejes) {
    const zc = NUCLEO.z
    for (const dx of [-a, a]) for (const dz of [-a, a]) L.ext(ex + dx - 0.06, ex + dx + 0.06, y - 1.2, techoNucleo, zc + dz - 0.06, zc + dz + 0.06, rem, A.metal)
    for (const yy of [y + 0.02, y + 2.8, techoNucleo - 0.08]) {
      L.ext(ex - a, ex + a, yy, yy + 0.08, zc - a - 0.05, zc - a + 0.05, rem, A.metal)
      L.ext(ex - a, ex + a, yy, yy + 0.08, zc + a - 0.05, zc + a + 0.05, rem, A.metal)
      L.ext(ex - a - 0.05, ex - a + 0.05, yy, yy + 0.08, zc - a, zc + a, rem, A.metal)
      L.ext(ex + a - 0.05, ex + a + 0.05, yy, yy + 0.08, zc - a, zc + a, rem, A.metal)
    }
    V.ext(ex - a, ex + a, y, techoNucleo, zc - a - 0.015, zc - a + 0.015, "#ffffff", A.mate)
    V.ext(ex - a, ex + a, y, techoNucleo, zc + a - 0.015, zc + a + 0.015, "#ffffff", A.mate)
    V.ext(ex - a - 0.015, ex - a + 0.015, y, techoNucleo, zc - a, zc + a, "#ffffff", A.mate)
    V.ext(ex + a - 0.015, ex + a + 0.015, y, techoNucleo, zc - a, zc + a, "#ffffff", A.mate)
    // marco de la puerta (hacia el pasillo)
    for (const s of [-1, 1]) L.ext(ex + s * 0.62 - 0.05, ex + s * 0.62 + 0.05, y, y + 2.5, zc + a - 0.02, zc + a + 0.09, PAL.laton, A.metal)
    L.ext(ex - 0.67, ex + 0.67, y + 2.45, y + 2.55, zc + a - 0.02, zc + a + 0.09, PAL.laton, A.metal)
    L.ext(ex - a, ex + a, y, y + 0.025, zc - a, zc + a, "#0f1115", A.pulido)
  }
}

// ── Cabinas del ascensor (se mueven en ctx.alActualizar) ─────────
const PARADAS = [ALTURA_NIVEL.n3, ALTURA_NIVEL.n2, ALTURA_NIVEL.n1, -2.85]
const ESPERA = 3.2
const VELOCIDAD = 2.6
function geoCabina(): THREE.BufferGeometry {
  const L = new Lote()
  const a = 1.12
  L.ext(-a, a, 0, 0.08, -a, a, "#1b1e24", A.laca)
  L.ext(-a, a, 2.45, 2.55, -a, a, "#1b1e24", A.laca)
  L.ext(-0.9, 0.9, 2.43, 2.45, -0.9, 0.9, "#fff4e0", A.luz(3))
  L.ext(-a, a, 0.08, 2.45, -a, -a + 0.06, "#b8875a", A.satin)
  for (const dx of [-a, a]) for (const dz of [-a, a]) L.ext(dx - 0.04, dx + 0.04, 0.08, 2.45, dz - 0.04, dz + 0.04, PAL.cromo, A.cromo)
  L.barra([-0.8, 0.95, -a + 0.12], [0.8, 0.95, -a + 0.12], 0.02, PAL.cromo, A.cromo, 6)
  return L.geometria()
}
/** Recorrido de ida y vuelta por las cuatro paradas, con espera en cada una. */
function alturaCabina(t: number): number {
  const tramos: Array<{ a: number; b: number; d: number }> = []
  const ida = [...PARADAS]
  const vuelta = [...PARADAS].reverse()
  for (const ruta of [ida, vuelta]) {
    for (let i = 0; i < ruta.length - 1; i++) tramos.push({ a: ruta[i], b: ruta[i + 1], d: Math.abs(ruta[i + 1] - ruta[i]) / VELOCIDAD })
  }
  const ciclo = tramos.reduce((s, x) => s + x.d + ESPERA, 0)
  let r = ((t % ciclo) + ciclo) % ciclo
  for (const x of tramos) {
    if (r < ESPERA) return x.a
    r -= ESPERA
    if (r < x.d) {
      const u = r / x.d
      return x.a + (x.b - x.a) * (u * u * (3 - 2 * u))
    }
    r -= x.d
  }
  return PARADAS[0]
}

// ── Sombras de contacto y charcos de luz (calcomanías en el piso) ──
// Sin ellas los escritorios "flotan" sobre el piso claro y todas las celdas
// tienen la misma luz. Son cuadros con un degradé radial: una malla por nivel.
function texturaRadial(): THREE.CanvasTexture {
  const { c, g } = lienzo(128, 128)
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  d.addColorStop(0, "rgba(255,255,255,1)")
  d.addColorStop(0.45, "rgba(255,255,255,0.55)")
  d.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = d
  g.fillRect(0, 0, 128, 128)
  return textura(c)
}
function capaCalcos(lista: Array<{ x: number; z: number; w: number; h: number; c: THREE.Color }>, y: number): THREE.BufferGeometry {
  const pos = new Float32Array(lista.length * 12)
  const uv = new Float32Array(lista.length * 8)
  const col = new Float32Array(lista.length * 12)
  const idx: number[] = []
  lista.forEach((q, i) => {
    const esq: Array<[number, number, number, number]> = [
      [-0.5, -0.5, 0, 0],
      [0.5, -0.5, 1, 0],
      [0.5, 0.5, 1, 1],
      [-0.5, 0.5, 0, 1],
    ]
    esq.forEach(([ex, ez, u, v], j) => {
      pos.set([q.x + ex * q.w, y, q.z + ez * q.h], (i * 4 + j) * 3)
      uv.set([u, v], (i * 4 + j) * 2)
      col.set([q.c.r, q.c.g, q.c.b], (i * 4 + j) * 3)
    })
    const b = i * 4
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

// ── Construcción ────────────────────────────────────────────────
interface NivelPuestos {
  deps: string[]
  cuerpos: THREE.InstancedMesh
  cabezas: THREE.InstancedMesh
  pantallas: THREE.InstancedMesh
  indicadores: THREE.InstancedMesh
  pulso: THREE.InstancedBufferAttribute
  matriz: THREE.Matrix4[]
}

export function construirSubsuelo(ctx: CtxEscena): Subsuelo {
  const detalle = ctx.calidad === "alta" ? 2 : ctx.calidad === "media" ? 1 : 0
  const mats = crearMats(ctx)
  const anims: Array<(t: TickEscena) => void> = []
  const puestos: Record<string, Array<{ pos: Vec3; rumbo: number }>> = {}
  const porDep = new Map<string, { nv: NivelPuestos; i: number }>()
  const porMalla = new Map<THREE.Object3D, NivelPuestos>()
  const sombra = (m: THREE.Mesh, emite: boolean, recibe = true) => {
    m.castShadow = ctx.sombras && emite
    m.receiveShadow = ctx.sombras && recibe
  }
  const decorativa = (m: THREE.Mesh) => {
    // vidrio, luz y carteles no le roban el toque a la celda de atrás
    m.raycast = () => {}
    return m
  }

  // Geometrías compartidas de los puestos
  const gEscritorio = geoEscritorio()
  const gMonitor = geoMonitor()
  const gPantalla = geoPantalla()
  const gSilla = geoSilla()
  const gCuerpo = geoCuerpo(detalle)
  const gCabeza = geoCabeza(detalle)
  const gIndicador = geoIndicador()
  const gCabina = geoCabina()
  const texLomos = texturaLomos()
  const matLibros = new THREE.MeshStandardMaterial({ map: texLomos, roughness: 0.78, metalness: 0 })
  const tex: Obra["texturas"] = {}
  const cabinas: Array<{ malla: THREE.InstancedMesh; y0: number; y1: number }> = []
  const radial = texturaRadial()
  const matSombra = new THREE.MeshBasicMaterial({
    name: "subsuelo-sombras",
    map: radial,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const matCharco = new THREE.MeshBasicMaterial({
    name: "subsuelo-charcos",
    map: radial,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  for (const nivel of ["n1", "n2", "n3"] as const) {
    const grupo = ctx.niveles[nivel]
    const y = ALTURA_NIVEL[nivel]
    const rot = atlasRotulos(nivel)
    const esp = atlasEspecial(nivel)
    if (nivel === "n3") {
      tex.olas = texturaOlas()
      tex.causticas = texturaCausticas()
    }
    const base = {
      y,
      nivel,
      vid: new Lote(),
      adi: new Lote(),
      rot: new Lote(),
      esp: new Lote(),
      libros: new Lote(),
      uvRot: rot.uv,
      uvEsp: esp.uv,
      detalle,
      mats,
      anim: anims,
      texturas: tex,
    }

    // Cascarón (losa, pasillos, muro perimetral, núcleo)
    const techo = nivel === "n1" ? -0.3 : y + 6.8
    const cas: Obra = { ...base, cel: new Lote(), extras: [], rnd: azar(hash(nivel)) }
    cascaron(cas, techo)
    const mCas = new THREE.Mesh(cas.cel.geometria(), mats.maqueta)
    mCas.name = `subsuelo-${nivel}-cascaron`
    sombra(mCas, true)
    grupo.add(mCas)

    // Celdas
    CELDAS[nivel].forEach((fila, r) =>
      fila.forEach((lugarId, c) => {
        const cx = SUB_COLUMNAS[c]
        const cz = SUB_FILAS[r]
        const o: Obra = { ...base, cel: new Lote(), extras: [], rnd: azar(hash(lugarId)) }
        const dep = DEPARTAMENTOS_BASE.find((d) => d.lugarId === lugarId)
        if (dep) celdaDepartamento(o, dep.id, cx, cz)
        else ESPECIALES[lugarId]?.(o, cx, cz)
        const g = new THREE.Group()
        g.name = lugarId
        const m = new THREE.Mesh(o.cel.geometria(), mats.maqueta)
        m.name = `celda-${lugarId}`
        sombra(m, true)
        g.add(m)
        for (const e of o.extras) g.add(e)
        grupo.add(g)
        ctx.seleccionable(g, lugarId)
      }),
    )

    // Capas del nivel: vidrio, luz aditiva, carteles, texturas especiales, libros
    if (!base.vid.vacio) grupo.add(decorativa(Object.assign(new THREE.Mesh(base.vid.geometria(), mats.vidrio), { name: `subsuelo-${nivel}-vidrio`, renderOrder: 3 })))
    if (!base.adi.vacio) grupo.add(decorativa(Object.assign(new THREE.Mesh(base.adi.geometria(), mats.aditiva), { name: `subsuelo-${nivel}-luz`, renderOrder: 4 })))
    if (!base.rot.vacio) {
      const mat = new THREE.MeshBasicMaterial({ map: rot.tex, color: new THREE.Color(0.92, 0.92, 0.92), toneMapped: false })
      grupo.add(decorativa(Object.assign(new THREE.Mesh(base.rot.geometria(), mat), { name: `subsuelo-${nivel}-carteles` })))
    } else rot.tex.dispose()
    if (!base.esp.vacio) {
      const mat = new THREE.MeshBasicMaterial({ map: esp.tex, transparent: true, toneMapped: false, side: THREE.FrontSide })
      grupo.add(decorativa(Object.assign(new THREE.Mesh(base.esp.geometria(), mat), { name: `subsuelo-${nivel}-pantallas`, renderOrder: 1 })))
    } else esp.tex.dispose()
    if (!base.libros.vacio) {
      const m = new THREE.Mesh(base.libros.geometria(), matLibros)
      m.name = `subsuelo-${nivel}-libros`
      sombra(m, false)
      grupo.add(m)
    }

    // Cabinas del ascensor de este tramo
    const cab = new THREE.InstancedMesh(gCabina, mats.maqueta, NUCLEO.ejes.length)
    cab.name = `subsuelo-${nivel}-cabinas`
    cab.frustumCulled = false
    sombra(cab, false)
    grupo.add(cab)
    cabinas.push({ malla: cab, y0: y - 1.2, y1: nivel === "n1" ? 0 : y + 6.8 })

    // Los 100 puestos de cada departamento del nivel
    const deps = CELDAS[nivel]
      .flat()
      .map((l) => DEPARTAMENTOS_BASE.find((d) => d.lugarId === l))
      .filter((d): d is (typeof DEPARTAMENTOS_BASE)[number] => !!d)
    if (deps.length === 0) continue
    const nP = deps.length * PUESTOS_POR_DEPTO
    const nE = deps.length * 2
    const escritorios = new THREE.InstancedMesh(gEscritorio, mats.maqueta, nP + nE)
    const monitores = new THREE.InstancedMesh(gMonitor, mats.maqueta, nP + nE)
    const gPant = gPantalla.clone()
    const pulso = new THREE.InstancedBufferAttribute(new Float32Array(nP + nE), 1)
    gPant.setAttribute("aPulso", pulso)
    const pantallas = new THREE.InstancedMesh(gPant, mats.pantalla, nP + nE)
    const sillas = new THREE.InstancedMesh(gSilla, mats.maqueta, nP)
    const cuerpos = new THREE.InstancedMesh(gCuerpo, mats.maqueta, nP)
    const cabezas = new THREE.InstancedMesh(gCabeza, mats.maqueta, nP)
    const indicadores = new THREE.InstancedMesh(gIndicador, mats.indicador, nP)
    const nv: NivelPuestos = { deps: deps.map((d) => d.id), cuerpos, cabezas, pantallas, indicadores, pulso, matriz: [] }
    const cero = new THREE.Matrix4().makeScale(0, 0, 0)
    const libre = C(PANTALLA_APAGADA)
    deps.forEach((d, di) => {
      const cel = celdaDe(d.lugarId)
      if (!cel) return
      const z0 = cel.cz - SUB_MEDIO_FONDO
      const lista: Array<{ pos: Vec3; rumbo: number }> = []
      for (let p = 0; p < PUESTOS_POR_DEPTO; p++) {
        const fila = Math.floor(p / 10)
        const col = p % 10
        const sx = cel.cx + OFF_X[col]
        const sz = z0 + FILA_Z0 + fila * FILA_PASO
        const i = di * PUESTOS_POR_DEPTO + p
        const m = new THREE.Matrix4().makeTranslation(sx, y, sz)
        nv.matriz[i] = m
        escritorios.setMatrixAt(i, m)
        monitores.setMatrixAt(i, m)
        pantallas.setMatrixAt(i, m)
        sillas.setMatrixAt(i, m)
        cuerpos.setMatrixAt(i, m)
        cabezas.setMatrixAt(i, m)
        indicadores.setMatrixAt(i, cero)
        pantallas.setColorAt(i, libre)
        cuerpos.setColorAt(i, C(COLOR_LIBRE))
        cabezas.setColorAt(i, C(COLOR_LIBRE_CABEZA))
        lista.push({ pos: { x: sx, y, z: sz }, rumbo: Math.PI })
      }
      puestos[d.id] = lista
      porDep.set(d.id, { nv, i: di })
      // Consolas del líder a los dos lados del punto (cx, z0 + 3), mirándolo
      const lider = new THREE.Vector3(cel.cx, y, z0 + 3)
      const brillo = C(colorDe(d.id)).clone().multiplyScalar(2.2)
      for (const s of [-1, 1]) {
        const centro = new THREE.Vector3(cel.cx + s * 2.05, y, z0 + 3.35)
        const u = centro.clone().sub(lider).setY(0).normalize()
        const asiento = centro.clone().addScaledVector(u, -0.75 * 1.1)
        const m = M(asiento.x, y, asiento.z, 1.25, 1, 1.1, Math.atan2(u.x, u.z) + Math.PI)
        const i = nP + di * 2 + (s < 0 ? 0 : 1)
        escritorios.setMatrixAt(i, m)
        monitores.setMatrixAt(i, m)
        pantallas.setMatrixAt(i, m)
        pantallas.setColorAt(i, brillo)
        pulso.setX(i, 1 + ((i * 0.37) % 1) * 6)
      }
    })
    // Sombra bajo cada escritorio y, por departamento, dos charcos de luz de su color.
    const negro = new THREE.Color(0, 0, 0)
    const sombras: Array<{ x: number; z: number; w: number; h: number; c: THREE.Color }> = []
    const charcos: Array<{ x: number; z: number; w: number; h: number; c: THREE.Color }> = []
    for (const d of deps) {
      const cel = celdaDe(d.lugarId)
      if (!cel) continue
      const z0 = cel.cz - SUB_MEDIO_FONDO
      for (let p = 0; p < PUESTOS_POR_DEPTO; p++) {
        sombras.push({ x: cel.cx + OFF_X[p % 10], z: z0 + FILA_Z0 + Math.floor(p / 10) * FILA_PASO - 0.55, w: 2.3, h: 2.2, c: negro })
      }
      const tinte = C(colorDe(d.id)).clone().multiplyScalar(0.15)
      for (const s of [-1, 1]) charcos.push({ x: cel.cx + s * 9.2, z: z0 + 20.5, w: 22, h: 30, c: tinte })
      charcos.push({ x: cel.cx, z: z0 + 3.2, w: 12, h: 9, c: tinte.clone().multiplyScalar(1.4) })
    }
    const mSombras = new THREE.Mesh(capaCalcos(sombras, y + 0.045), matSombra)
    mSombras.name = `subsuelo-${nivel}-sombras-contacto`
    mSombras.renderOrder = 1
    grupo.add(decorativa(mSombras))
    const mCharcos = new THREE.Mesh(capaCalcos(charcos, y + 0.05), matCharco)
    mCharcos.name = `subsuelo-${nivel}-charcos-luz`
    mCharcos.renderOrder = 2
    grupo.add(decorativa(mCharcos))

    for (const im of [escritorios, monitores, pantallas, sillas, cuerpos, cabezas, indicadores]) {
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.computeBoundingSphere()
      im.computeBoundingBox()
      porMalla.set(im, nv)
      grupo.add(im)
    }
    escritorios.name = `subsuelo-${nivel}-escritorios`
    monitores.name = `subsuelo-${nivel}-monitores`
    pantallas.name = `subsuelo-${nivel}-pantallas-puestos`
    sillas.name = `subsuelo-${nivel}-sillas`
    cuerpos.name = `subsuelo-${nivel}-trabajadores`
    cabezas.name = `subsuelo-${nivel}-cabezas`
    indicadores.name = `subsuelo-${nivel}-indicadores`
    sombra(escritorios, true)
    sombra(monitores, true)
    sombra(sillas, true)
    sombra(cuerpos, true)
    sombra(cabezas, true)
    sombra(pantallas, false, false)
    sombra(indicadores, false, false)
    nv.matriz.length = nP
  }

  const _m = new THREE.Matrix4()
  ctx.alActualizar((t) => {
    mats.tiempo.value = t.tiempo
    for (const f of anims) f(t)
    // Dos cabinas a contramano; cada tramo muestra la que está dentro de él
    NUCLEO.ejes.forEach((ex, k) => {
      const yc = alturaCabina(t.tiempo + k * 17.3)
      for (const c of cabinas) {
        if (yc >= c.y0 && yc < c.y1) _m.makeTranslation(ex, yc, NUCLEO.z)
        else _m.makeScale(0, 0, 0)
        c.malla.setMatrixAt(k, _m)
        c.malla.instanceMatrix.needsUpdate = true
      }
    })
  })

  const marcarPuestos = (depId: string, estados: EstadoPuesto[]) => {
    const ref = porDep.get(depId)
    if (!ref) return
    const { nv, i: di } = ref
    const color = C(colorDe(depId))
    const brillo = color.clone().multiplyScalar(2.4)
    const verde = C(COLOR_ENTREGADO)
    const verdeBrillo = verde.clone().multiplyScalar(2.0)
    for (let p = 0; p < PUESTOS_POR_DEPTO; p++) {
      const i = di * PUESTOS_POR_DEPTO + p
      const e = estados[p] ?? "libre"
      const piel = C(PIELES[(i * 7 + (i >> 3)) % PIELES.length])
      if (e === "trabajando") {
        nv.cuerpos.setColorAt(i, color)
        nv.cabezas.setColorAt(i, piel)
        nv.pantallas.setColorAt(i, brillo)
        nv.pulso.setX(i, 1 + ((i * 0.6180339) % 1) * 6)
        nv.indicadores.setMatrixAt(i, _cero)
      } else if (e === "entregado") {
        nv.cuerpos.setColorAt(i, verde)
        nv.cabezas.setColorAt(i, piel)
        nv.pantallas.setColorAt(i, verdeBrillo)
        nv.pulso.setX(i, 0)
        nv.indicadores.setMatrixAt(i, nv.matriz[i])
      } else {
        nv.cuerpos.setColorAt(i, C(COLOR_LIBRE))
        nv.cabezas.setColorAt(i, C(COLOR_LIBRE_CABEZA))
        nv.pantallas.setColorAt(i, C(PANTALLA_APAGADA))
        nv.pulso.setX(i, 0)
        nv.indicadores.setMatrixAt(i, _cero)
      }
    }
    for (const im of [nv.cuerpos, nv.cabezas, nv.pantallas]) if (im.instanceColor) im.instanceColor.needsUpdate = true
    nv.pulso.needsUpdate = true
    nv.indicadores.instanceMatrix.needsUpdate = true
  }

  const identificar = (obj: THREE.Object3D, instanceId?: number) => {
    const nv = porMalla.get(obj)
    if (!nv || instanceId == null || instanceId < 0) return null
    if (instanceId >= nv.deps.length * PUESTOS_POR_DEPTO) return null
    return { depId: nv.deps[Math.floor(instanceId / PUESTOS_POR_DEPTO)], puesto: instanceId % PUESTOS_POR_DEPTO }
  }

  return { puestos, marcarPuestos, identificar }
}

const _cero = new THREE.Matrix4().makeScale(0, 0, 0)
