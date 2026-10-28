// ──────────────────────────────────────────────────────────────
// B3 · PAISAJE — todo lo que no es edificio en la superficie
//
// El suelo de 2,5 km, los jardines con el pasto en franjas de la foto, las
// fuentes con chorros animados, la reja negra, las calles con autos que
// circulan, los faroles de globo, los árboles, las canchas, el Parque
// Lafayette con la estatua de Jackson, la Elipse y el Monumento a Washington.
//
// Cómo está armado, por rendimiento:
//  - Lo estático se junta por material en UNA malla (`Cubetas`): una llamada
//    de dibujo por material, no una por objeto.
//  - Lo repetido (barrotes, árboles, faroles, autos, flores) va en InstancedMesh.
//  - El detalle fino (franjas del pasto, juntas de baldosas, ondas del agua,
//    hojas) se calcula en el shader en coordenadas de mundo: sin texturas
//    externas y sin costuras a ninguna escala.
//
// Coordenadas: las de lugares.ts (HUELLAS y LUGAR). Las huellas de los
// edificios quedan libres: eso lo construye arquitectura.ts.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { HUELLAS, LUGAR } from "../lugares"
import type { TickEscena } from "../tipos"
import type { CtxEscena } from "./contrato"

type P2 = [number, number]
type Rng = () => number

// ── Azar con semilla: el paisaje sale igual en cada carga ──────
function azar(semilla: number): Rng {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const entre = (r: Rng, a: number, b: number) => a + (b - a) * r()
const elegir = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]
const C = (hex: number | string) => new THREE.Color(hex)
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Ruido de valor 3D en JS: deforma las copas y los setos.
function h3(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function ruido3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => h3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}

// ── Alturas del suelo: todo plano salvo la loma del Monumento ──
const MON = HUELLAS.monumento
const LOMA = { alto: 6.5, plano: 30, radio: 75 }
function alturaSuelo(x: number, z: number) {
  const r = Math.hypot(x - MON.x, z - MON.z)
  return r > LOMA.radio ? 0 : LOMA.alto * (1 - suave(LOMA.plano, LOMA.radio, r))
}

// Capas del suelo (m). Separadas lo justo para no titilar a lo lejos;
// además cada material de encima lleva polygonOffset.
const Y = { manzana: -0.12, pasto: 0, camino: 0.03, asfalto: 0.05, pintura: 0.066, cantero: 0.06, acera: 0.15 }

// ══════════════════════════════════════════════════════════════
// Geometría
// ══════════════════════════════════════════════════════════════

function pintar(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute("position").count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r
    a[i * 3 + 1] = c.g
    a[i * 3 + 2] = c.b
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3))
  return g
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

/** Matriz de posición + giro en Y (+ inclinación opcional) + escala. */
function mtx(x: number, y: number, z: number, ry = 0, s = 1, sy = s, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, "YXZ")
  _q.setFromEuler(_e)
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(s, sy, s))
}
/** Coloca una geometría (la modifica y la devuelve). */
function en<T extends THREE.BufferGeometry>(g: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T {
  _e.set(rx, ry, rz, "YXZ")
  _q.setFromEuler(_e)
  g.applyMatrix4(_m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1)))
  return g
}
const caja = (w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0) => en(new THREE.BoxGeometry(w, h, d), x, y, z, ry)
/** Caja con base y techo en alturas dadas. */
const losa = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) =>
  caja(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
const cil = (r0: number, r1: number, h: number, seg = 8, x = 0, y = 0, z = 0) =>
  en(new THREE.CylinderGeometry(r1, r0, h, seg), x, y + h / 2, z)

/** Cilindro entre dos puntos (huesos de la estatua, brazos, ramas). */
function barra(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg)
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  g.applyMatrix4(_m.compose(_v.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)))
  return g
}
const esfera = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, w = 8, h = 6) => {
  const g = new THREE.SphereGeometry(r, w, h)
  g.scale(sx, sy, sz)
  return en(g, x, y, z)
}

/**
 * Lámina plana sobre el suelo: triángulos, cintas, arcos y discos con
 * color por vértice. La normal va siempre hacia arriba; el orden de los
 * vértices se corrige solo para que ninguna cara quede de espaldas.
 */
class Lamina {
  pos: number[] = []
  col: number[] = []
  constructor(private alto: (x: number, z: number) => number) {}
  tri(a: P2, b: P2, c: P2, k: THREE.Color) {
    const cy = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
    const [p, q] = cy < 0 ? [c, b] : [b, c]
    for (const v of [a, p, q]) {
      this.pos.push(v[0], this.alto(v[0], v[1]), v[1])
      this.col.push(k.r, k.g, k.b)
    }
  }
  quad(a: P2, b: P2, c: P2, d: P2, k: THREE.Color) {
    this.tri(a, b, c, k)
    this.tri(a, c, d, k)
  }
  rect(x0: number, x1: number, z0: number, z1: number, k: THREE.Color) {
    this.quad([x0, z0], [x1, z0], [x1, z1], [x0, z1], k)
  }
  /** Cinta de ancho fijo a lo largo de una polilínea. */
  cinta(pts: P2[], ancho: number, k: THREE.Color, cerrada = false) {
    const n = pts.length
    if (n < 2) return
    const iz: P2[] = []
    const de: P2[] = []
    for (let i = 0; i < n; i++) {
      const a = pts[cerrada ? (i - 1 + n) % n : Math.max(i - 1, 0)]
      const b = pts[cerrada ? (i + 1) % n : Math.min(i + 1, n - 1)]
      let tx = b[0] - a[0]
      let tz = b[1] - a[1]
      const l = Math.hypot(tx, tz) || 1
      tx /= l
      tz /= l
      const h = ancho / 2
      iz.push([pts[i][0] - tz * h, pts[i][1] + tx * h])
      de.push([pts[i][0] + tz * h, pts[i][1] - tx * h])
    }
    const m = cerrada ? n : n - 1
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n
      this.quad(iz[i], de[i], de[j], iz[j], k)
    }
  }
  arco(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, k: THREE.Color, seg = 32) {
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg
      const t1 = a0 + ((a1 - a0) * (i + 1)) / seg
      const p = (r: number, t: number): P2 => [cx + Math.cos(t) * r, cz + Math.sin(t) * r]
      this.quad(p(r0, t0), p(r1, t0), p(r1, t1), p(r0, t1), k)
    }
  }
  disco(cx: number, cz: number, r: number, k: THREE.Color, seg = 32) {
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2
      const t1 = ((i + 1) / seg) * Math.PI * 2
      this.tri([cx, cz], [cx + Math.cos(t0) * r, cz + Math.sin(t0) * r], [cx + Math.cos(t1) * r, cz + Math.sin(t1) * r], k)
    }
  }
  /** Polígono estrellado desde un centro (manchas orgánicas: green de golf, bunker). */
  mancha(cx: number, cz: number, rx: number, rz: number, k: THREE.Color, semilla: number, seg = 28, irregular = 0.18) {
    const r = azar(semilla)
    const fases = [r() * 6, r() * 6, r() * 6]
    const p = (i: number): P2 => {
      const t = (i / seg) * Math.PI * 2
      const f = 1 + irregular * (Math.sin(t * 2 + fases[0]) * 0.5 + Math.sin(t * 3 + fases[1]) * 0.3 + Math.sin(t * 5 + fases[2]) * 0.2)
      return [cx + Math.cos(t) * rx * f, cz + Math.sin(t) * rz * f]
    }
    for (let i = 0; i < seg; i++) this.tri([cx, cz], p(i), p(i + 1), k)
  }
  geometria() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    const n = new Float32Array(this.pos.length)
    for (let i = 1; i < n.length; i += 3) n[i] = 1
    g.setAttribute("normal", new THREE.BufferAttribute(n, 3))
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3))
    return g
  }
}
const plano = (y: number) => new Lamina(() => y)
const sobreSuelo = (dy: number) => new Lamina((x, z) => alturaSuelo(x, z) + dy)

/** Curva suave que pasa por los puntos (Catmull-Rom centrípeta). */
function curva(pts: P2[], paso = 2, cerrada = false): P2[] {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), cerrada, "centripetal")
  const n = Math.max(2, Math.ceil(c.getLength() / paso))
  return c.getSpacedPoints(n).map((v) => [v.x, v.z] as P2).slice(0, cerrada ? n : n + 1)
}
function elipse(cx: number, cz: number, rx: number, rz: number, seg = 96, a0 = 0, a1 = Math.PI * 2): P2[] {
  const out: P2[] = []
  for (let i = 0; i <= seg; i++) {
    const t = a0 + ((a1 - a0) * i) / seg
    out.push([cx + Math.cos(t) * rx, cz + Math.sin(t) * rz])
  }
  return out
}

// ── Cubetas: todas las piezas de un material terminan en una sola malla ──
interface Cubeta {
  mat: THREE.Material
  piezas: THREE.BufferGeometry[]
  proyecta: boolean
  recibe: boolean
  uv: boolean
}
class Cubetas {
  private c = new Map<string, Cubeta>()
  mallas: Record<string, THREE.Mesh> = {}
  constructor(private ctx: CtxEscena, private padre: THREE.Object3D) {}
  def(nombre: string, mat: THREE.Material, op: { proyecta?: boolean; recibe?: boolean; uv?: boolean } = {}) {
    this.c.set(nombre, { mat, piezas: [], proyecta: !!op.proyecta, recibe: op.recibe !== false, uv: !!op.uv })
  }
  add(nombre: string, g: THREE.BufferGeometry, k?: THREE.Color) {
    if (k) pintar(g, k)
    const cu = this.c.get(nombre)
    if (!cu) throw new Error(`paisaje: cubeta desconocida ${nombre}`)
    cu.piezas.push(g)
  }
  cerrar() {
    const blanco = C(0xffffff)
    for (const [nombre, cu] of this.c) {
      if (!cu.piezas.length) continue
      const geos = cu.piezas.map((g0) => {
        const g = g0.index ? g0.toNonIndexed() : g0
        if (!g.getAttribute("normal")) g.computeVertexNormals()
        if (!g.getAttribute("color")) pintar(g, blanco)
        const deja = cu.uv ? ["position", "normal", "color", "uv"] : ["position", "normal", "color"]
        for (const k of Object.keys(g.attributes)) if (!deja.includes(k)) g.deleteAttribute(k)
        if (cu.uv && !g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2))
        g.morphAttributes = {}
        g.clearGroups()
        return g
      })
      const geo = mergeGeometries(geos, false)
      if (!geo) {
        console.error("paisaje: no se pudo unir la cubeta", nombre)
        continue
      }
      geo.computeBoundingSphere()
      const m = new THREE.Mesh(geo, cu.mat)
      m.name = `paisaje-${nombre}`
      m.matrixAutoUpdate = false
      if (this.ctx.sombras) {
        m.castShadow = cu.proyecta
        m.receiveShadow = cu.recibe
      }
      this.padre.add(m)
      this.mallas[nombre] = m
    }
    this.c.clear()
  }
}

/** Geometría lista para instanciar: un solo bloque, con normales y uv. */
function unir(piezas: THREE.BufferGeometry[], colores = false): THREE.BufferGeometry {
  const geos = piezas.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0
    if (!g.getAttribute("normal")) g.computeVertexNormals()
    if (colores && !g.getAttribute("color")) pintar(g, C(0xffffff))
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2))
    const deja = ["position", "normal", "uv", ...(colores ? ["color"] : [])]
    for (const k of Object.keys(g.attributes)) if (!deja.includes(k)) g.deleteAttribute(k)
    g.clearGroups()
    return g
  })
  const g = mergeGeometries(geos, false)
  if (!g) throw new Error("paisaje: no se pudo unir una geometría")
  return g
}

// ══════════════════════════════════════════════════════════════
// Shaders: el detalle se calcula en coordenadas de mundo
// ══════════════════════════════════════════════════════════════

const RUIDO = /* glsl */ `
float b3h(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float b3n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(b3h(i), b3h(i + vec2(1.0, 0.0)), u.x), mix(b3h(i + vec2(0.0, 1.0)), b3h(i + vec2(1.0, 1.0)), u.x), u.y); }
float b3f(vec2 p){ return 0.5 * b3n(p) + 0.25 * b3n(p * 2.03 + 17.1) + 0.125 * b3n(p * 4.01 + 3.7) + 0.0625 * b3n(p * 8.05 + 9.2); }
float b3h3(vec3 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float b3n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = b3h3(i), b = b3h3(i + vec3(1.0, 0.0, 0.0)), c = b3h3(i + vec3(0.0, 1.0, 0.0)), d = b3h3(i + vec3(1.0, 1.0, 0.0));
  float e = b3h3(i + vec3(0.0, 0.0, 1.0)), g = b3h3(i + vec3(1.0, 0.0, 1.0)), h = b3h3(i + vec3(0.0, 1.0, 1.0)), k = b3h3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z); }
// Onda cuadrada con antialias: -1..1, se apaga sola cuando la franja es más fina que un píxel.
float b3onda(float x){ float w = fwidth(x); return clamp(sin(x) / (w * 1.2 + 1e-4), -1.0, 1.0) * (1.0 - smoothstep(0.7, 1.8, w)); }
`

const MUNDO_VERT = /* glsl */ `
vec4 b3w = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  b3w = instanceMatrix * b3w;
#endif
vMundo = ( modelMatrix * b3w ).xyz;
`

interface Parche {
  clave: string
  uniforms?: Record<string, THREE.IUniform>
  vDecl?: string
  vBegin?: string
  fDecl?: string
  fColor?: string
  fRough?: string
  fNormal?: string
  fEmisivo?: string
}
/**
 * Inyecta código en un MeshStandardMaterial sin perder luces, sombras,
 * niebla ni reflejos. `clave` distingue el programa en la caché de three:
 * sin ella, dos parches con la misma función se confundirían.
 */
function parchar<T extends THREE.Material>(mat: T, p: Parche): T {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, p.uniforms ?? {})
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vMundo;\n${p.vDecl ?? ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${p.vBegin ?? ""}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${MUNDO_VERT}`)
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vMundo;\n${RUIDO}\n${p.fDecl ?? ""}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${p.fColor ?? ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${p.fRough ?? ""}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${p.fNormal ?? ""}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${p.fEmisivo ?? ""}`)
  }
  mat.customProgramCacheKey = () => `b3:${p.clave}`
  return mat
}

const desplazar = (m: THREE.Material, factor: number, unidades: number) => {
  m.polygonOffset = true
  m.polygonOffsetFactor = factor
  m.polygonOffsetUnits = unidades
  return m
}

type U = THREE.IUniform<number>

function crearMateriales(ctx: CtxEscena, T: U, N: U) {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)

  // Pasto: franjas de corte (Jardín Norte a lo largo, Jardín Sur en rombos,
  // el resto anchas y suaves). Una franja es clara u oscura según desde
  // dónde se mire, como el pasto real cortado en sentidos opuestos.
  const pasto = parchar(std({ color: 0x4f8a2e, roughness: 0.93, metalness: 0 }), {
    clave: "pasto",
    fColor: /* glsl */ `
      vec3 p = vMundo;
      float dCam = distance(cameraPosition, p);
      vec3 c = diffuseColor.rgb;
      float g1 = b3f(p.xz * 0.013);
      float g2 = b3n(p.xz * 0.09 + 5.0);
      float g3 = b3n(p.xz * 0.8);
      float g4 = b3n(p.xz * 3.7);
      float cerca = 1.0 - smoothstep(25.0, 140.0, dCam);
      c *= 0.84 + 0.32 * g1;
      c = mix(c, c * vec3(1.2, 1.08, 0.62), smoothstep(0.62, 0.95, g2) * 0.32);
      c *= mix(1.0, 0.87 + 0.26 * (g3 * 0.5 + g4 * 0.5), cerca);
      vec2 vd = p.xz - cameraPosition.xz; vd /= max(length(vd), 1e-3);
      float sentido = clamp(vd.y * 3.0, -1.0, 1.0);
      float enNorte = step(-95.0, p.x) * step(p.x, 95.0) * step(-70.0, p.z) * step(p.z, -13.0);
      float enSur = step(-95.0, p.x) * step(p.x, 95.0) * step(13.0, p.z) * step(p.z, 162.0);
      float sN = b3onda(p.x * 3.14159 / 2.8) * sentido;
      float sS = b3onda((p.x + p.z) * 0.7071 * 3.14159 / 3.4) * b3onda((p.x - p.z) * 0.7071 * 3.14159 / 3.4);
      float sA = b3onda(p.x * 3.14159 / 5.5) * sentido;
      float franja = enNorte * sN * (0.09 + 0.11 * abs(vd.y)) + enSur * sS * 0.10 + (1.0 - enNorte - enSur) * sA * 0.06;
      franja *= 1.0 - smoothstep(260.0, 900.0, dCam);
      c *= 1.0 + franja;
      diffuseColor.rgb = c;
    `,
  })

  // Suelo de la ciudad (manzanas): hormigón con manchas grandes.
  const manzana = parchar(std({ color: 0x8b8781, roughness: 0.95 }), {
    clave: "manzana",
    fColor: /* glsl */ `
      float n = b3f(vMundo.xz * 0.02);
      float m = b3n(vMundo.xz * 0.25);
      diffuseColor.rgb *= (0.8 + 0.35 * n) * (0.94 + 0.1 * m);
    `,
  })

  const asfalto = desplazar(
    parchar(std({ color: 0x2c2e31, roughness: 0.86, metalness: 0 }), {
      clave: "asfalto",
      fColor: /* glsl */ `
        float n = b3f(vMundo.xz * 0.05);
        float m = b3n(vMundo.xz * 1.3);
        float fw = fwidth(vMundo.x);
        float fino = b3n(vMundo.xz * 9.0) * (1.0 - smoothstep(0.02, 0.2, fw));
        vec3 c = diffuseColor.rgb * (0.8 + 0.38 * n) * (0.94 + 0.1 * m + 0.14 * (fino - 0.5));
        float parche = smoothstep(0.74, 0.78, b3n(vMundo.xz * 0.035 + 11.0));
        c = mix(c, c * 0.72, parche * 0.6);
        diffuseColor.rgb = c;
      `,
      fRough: `roughnessFactor = clamp(roughnessFactor * (0.86 + 0.26 * b3n(vMundo.xz * 1.3)), 0.0, 1.0);`,
    }),
    -2,
    -4,
  )

  // Baldosas y piedra: juntas en grilla y un tono por pieza.
  const pavimento = parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.82 }), {
    clave: "pavimento",
    fColor: /* glsl */ `
      vec2 q = vMundo.xz / 0.9;
      vec2 id = floor(q);
      vec2 f = abs(fract(q) - 0.5);
      vec2 fw = fwidth(q);
      float borde = max(smoothstep(0.47 - fw.x, 0.47 + fw.x, f.x), smoothstep(0.47 - fw.y, 0.47 + fw.y, f.y));
      float nitido = 1.0 - smoothstep(0.12, 0.5, max(fw.x, fw.y));
      vec3 c = diffuseColor.rgb * (0.9 + 0.18 * b3n(vMundo.xz * 0.12));
      c *= mix(1.0, 0.93 + 0.12 * b3h(id + 3.1), nitido);
      c *= 1.0 - 0.3 * borde * nitido;
      diffuseColor.rgb = c;
    `,
  })

  const grava = desplazar(
    parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.97 }), {
      clave: "grava",
      fColor: /* glsl */ `
        float fw = fwidth(vMundo.x);
        float g = b3n(vMundo.xz * 7.0) * (1.0 - smoothstep(0.03, 0.25, fw));
        float n = b3f(vMundo.xz * 0.3);
        diffuseColor.rgb *= (0.86 + 0.22 * n) * (0.92 + 0.3 * (g - 0.5));
      `,
    }),
    -1,
    -2,
  )

  // Superficies de color plano: canchas, canteros, pintura del helipunto.
  const superficie = desplazar(
    parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.78 }), {
      clave: "superficie",
      fColor: `diffuseColor.rgb *= 0.95 + 0.08 * b3n(vMundo.xz * 0.6);`,
    }),
    -2,
    -6,
  )

  const pintura = desplazar(std({ color: 0xffffff, vertexColors: true, roughness: 0.62 }), -4, -10)

  // Follaje: copas, setos, arbustos y matas. Ruido 3D = racimos de hojas;
  // en las instancias, las copas se mecen con el viento.
  const follaje = parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.85, metalness: 0 }), {
    clave: "follaje",
    uniforms: { uTiempo: T },
    vDecl: "uniform float uTiempo;",
    vBegin: /* glsl */ `
      #ifdef USE_INSTANCING
        float b3fa = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
        float b3al = max(position.y - 2.0, 0.0);
        transformed.x += sin(uTiempo * 1.05 + b3fa) * 0.016 * b3al;
        transformed.z += cos(uTiempo * 0.83 + b3fa * 1.3) * 0.013 * b3al;
        transformed += normal * sin(uTiempo * 2.7 + dot(position, vec3(2.1, 1.7, 2.9)) + b3fa) * 0.022;
      #endif
    `,
    fColor: /* glsl */ `
      float hj = b3n3(vMundo * 1.9) * 0.55 + b3n3(vMundo * 4.7 + 3.1) * 0.45;
      float lejos = smoothstep(40.0, 240.0, distance(cameraPosition, vMundo));
      diffuseColor.rgb *= mix(0.66 + 0.68 * hj, 1.0, lejos * 0.7);
    `,
  })

  const flor = std({ color: 0xffffff, roughness: 0.55 })

  // Agua de fuentes y estanques: ondas que se mueven en la normal; el
  // reflejo lo pone el mapa de entorno del motor.
  const ondas = /* glsl */ `
    vec2 q = vMundo.xz;
    float t = uTiempo;
    vec2 dn = vec2(
      sin(q.x * 2.3 + t * 1.9) + sin(q.y * 1.7 - t * 1.3 + q.x * 0.7) + 0.5 * sin((q.x + q.y) * 5.1 + t * 3.2),
      cos(q.y * 2.1 + t * 1.6) + cos(q.x * 1.9 + t * 1.1 - q.y * 0.6) + 0.5 * cos((q.x - q.y) * 4.7 - t * 2.8)
    ) * AMP;
    normal = normalize( normal + ( viewMatrix * vec4( dn.x, 0.0, dn.y, 0.0 ) ).xyz );
  `
  const agua = parchar(std({ color: 0x1d4a52, roughness: 0.05, metalness: 0.0, envMapIntensity: 1.3 }), {
    clave: "agua",
    uniforms: { uTiempo: T },
    fDecl: "uniform float uTiempo;\n#define AMP 0.05",
    fNormal: ondas,
  })
  const piscina = parchar(std({ color: 0x2aa9b6, roughness: 0.06, metalness: 0.0, emissive: 0x19c7d8, emissiveIntensity: 0, envMapIntensity: 1.1 }), {
    clave: "piscina",
    uniforms: { uTiempo: T },
    fDecl: "uniform float uTiempo;\n#define AMP 0.035",
    fNormal: ondas,
    fColor: /* glsl */ `
      vec2 cq = vMundo.xz * 1.7; float ct = uTiempo * 0.8;
      float c1 = sin(cq.x + sin(cq.y * 1.3 + ct) * 1.2 + ct);
      float c2 = sin(cq.y * 1.1 + sin(cq.x * 1.5 - ct * 1.1) * 1.3 - ct * 0.7);
      float caus = pow(1.0 - abs(c1 * c2), 7.0);
      diffuseColor.rgb += vec3(0.22, 0.3, 0.28) * caus;
    `,
  })
  ctx.alAnochecer(piscina, 0.9, 0)

  const piedra = parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.72 }), {
    clave: "piedra",
    fColor: `diffuseColor.rgb *= 0.92 + 0.12 * b3n3(vMundo * 1.3);`,
  })

  // Hierro negro de la reja, faroles y bancos: el del motor, para que toda
  // la herrería del juego tenga el mismo tono.
  const hierro = ctx.materiales.hierroNegro

  const props = std({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.15 })

  const vidrio = std({ color: 0xbfe3e8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.5, side: THREE.DoubleSide })

  const globo = std({ color: 0xf6efe0, emissive: 0xffcf8a, emissiveIntensity: 0, roughness: 0.25 })
  ctx.alAnochecer(globo, 3.2, 0)
  const luzSuelo = std({ color: 0x9aa39a, emissive: 0xfff2c8, emissiveIntensity: 0, roughness: 0.4 })
  ctx.alAnochecer(luzSuelo, 2.5, 0)

  const auto = std({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.55, envMapIntensity: 1.2 })
  const faros = std({ color: 0xdedede, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.2 })
  ctx.alAnochecer(faros, 7, 0.2)
  const traseras = std({ color: 0x5a0a0a, emissive: 0xff1a12, emissiveIntensity: 0, roughness: 0.3 })
  ctx.alAnochecer(traseras, 5, 0.3)

  // Mármol del Monumento: bloques de 61 cm y, de noche, reflectores desde la
  // base (más luz abajo que arriba, como el real).
  const marmol = parchar(std({ color: 0xffffff, vertexColors: true, roughness: 0.62, emissive: 0xfff3e0, emissiveIntensity: 0 }), {
    clave: "marmol",
    fColor: /* glsl */ `
      float fy = fwidth(vMundo.y);
      float j = abs(fract(vMundo.y / 0.61 + 0.5) - 0.5) * 0.61;
      float linea = (1.0 - smoothstep(0.012, 0.012 + fy, j)) * (1.0 - smoothstep(0.03, 0.12, fy));
      diffuseColor.rgb *= (0.95 + 0.07 * b3n(vec2(floor(vMundo.y / 0.61), vMundo.x * 0.4 + vMundo.z * 0.4))) * (1.0 - 0.1 * linea);
    `,
    fEmisivo: `totalEmissiveRadiance *= mix(1.35, 0.5, clamp(vMundo.y / 175.0, 0.0, 1.0));`,
  })
  ctx.alAnochecer(marmol, 0.32, 0)
  const luzRoja = std({ color: 0x400000, emissive: 0xff1508, emissiveIntensity: 0, roughness: 0.4 })

  const bronce = std({ color: 0x4a3a28, roughness: 0.42, metalness: 0.85, envMapIntensity: 1.2 })
  const mastil = std({ color: 0xdcdcdc, roughness: 0.3, metalness: 0.8 })

  const bandera = parchar(
    std({ map: texturaBandera(), side: THREE.DoubleSide, roughness: 0.75 }),
    {
      clave: "bandera",
      uniforms: { uTiempo: T },
      vDecl: "uniform float uTiempo;",
      vBegin: /* glsl */ `
        #ifdef USE_INSTANCING
          float b3fs = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
        #else
          float b3fs = 0.0;
        #endif
        float b3u = max(position.x, 0.0);
        transformed.z += sin(b3u * 2.4 - uTiempo * 5.5 + b3fs) * 0.15 * b3u;
        transformed.y += sin(b3u * 1.6 - uTiempo * 3.7 + b3fs) * 0.03 * b3u;
      `,
    },
  )

  const red = std({ map: texturaRed(), color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })

  const pajaro = parchar(std({ color: 0x1d1d1f, roughness: 0.8, side: THREE.DoubleSide }), {
    clave: "pajaro",
    uniforms: { uTiempo: T },
    vDecl: "uniform float uTiempo;\nattribute float aFase;",
    vBegin: `transformed.y += sin(uTiempo * 12.0 + aFase) * abs(position.z) * 0.9;`,
  })

  const corteza = ctx.materiales.corteza

  return { pasto, manzana, asfalto, pavimento, grava, superficie, pintura, follaje, flor, agua, piscina, piedra, hierro, props, vidrio, globo, luzSuelo, auto, faros, traseras, marmol, luzRoja, bronce, mastil, bandera, red, pajaro, corteza, T, N }
}
type Mats = ReturnType<typeof crearMateriales>

// Texturas dibujadas en canvas (nada de imágenes externas).
function lienzo(w: number, h: number) {
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}
function texturaBandera(): THREE.Texture | null {
  const c = lienzo(256, 136)
  if (!c) return null
  const g = c.getContext("2d")!
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? "#f5f2ea" : "#b22234"
    g.fillRect(0, (i * 136) / 13, 256, 136 / 13 + 1)
  }
  g.fillStyle = "#3c3b6e"
  g.fillRect(0, 0, 103, 73)
  g.fillStyle = "#f5f2ea"
  for (let f = 0; f < 9; f++)
    for (let k = 0; k < (f % 2 ? 5 : 6); k++) {
      g.beginPath()
      g.arc(9 + k * 17 + (f % 2 ? 8.5 : 0), 5 + f * 7.6, 2.1, 0, Math.PI * 2)
      g.fill()
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
/** Malla de alambre (tejido romboidal): con mipmaps, de lejos queda como una bruma oscura. */
function texturaRed(): THREE.Texture | null {
  const c = lienzo(64, 64)
  if (!c) return null
  const g = c.getContext("2d")!
  g.clearRect(0, 0, 64, 64)
  g.strokeStyle = "rgba(30,34,32,0.95)"
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(64, 64)
  g.moveTo(64, 0)
  g.lineTo(0, 64)
  g.stroke()
  g.strokeRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
/** Plano vertical con UV en metros (para la red: una celda cada `celda` m). */
function panelRed(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, celda = 0.12) {
  const g = new THREE.BufferGeometry()
  const l = Math.hypot(x1 - x0, z1 - z0)
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0], 3))
  const u = l / celda
  const v = (y1 - y0) / celda
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2))
  g.computeVertexNormals()
  return g
}

// ══════════════════════════════════════════════════════════════
// El mundo que se va armando
// ══════════════════════════════════════════════════════════════

type Zona = { tipo: "rect"; x0: number; x1: number; z0: number; z1: number } | { tipo: "circ"; x: number; z: number; r: number } | { tipo: "linea"; pts: P2[]; ancho: number }

type TipoArbol = "roble" | "olmo" | "magnolia" | "conifera" | "lejano" | "chico"
interface Arbol {
  x: number
  z: number
  s: number
  tipo: TipoArbol
  tono: THREE.Color
}

interface Mundo {
  ctx: CtxEscena
  raiz: THREE.Group
  M: Mats
  cub: Cubetas
  factor: number
  r: Rng
  arboles: Arbol[]
  faroles: Array<{ x: number; z: number; y: number; ry: number }>
  globos: THREE.Matrix4[]
  bancos: THREE.Matrix4[]
  flores: Array<{ m: THREE.Matrix4; c: THREE.Color }>
  matas: Array<{ m: THREE.Matrix4; c: THREE.Color }>
  arbustos: Array<{ m: THREE.Matrix4; c: THREE.Color }>
  ocupado: Zona[]
  animar: Array<(t: TickEscena) => void>
  /** Fuentes: centro, altura del agua y chorros (los arma `fuentes()`). */
  chorros: Array<{ x: number; z: number; y: number; alto: number; radio: number; anillo?: { r: number; n: number; alto: number }; caida?: number }>
}

const PALETA = {
  piedraClara: C(0xe4ddcf),
  piedraCalida: C(0xd9cdb6),
  granito: C(0xb9b3a9),
  granitoOscuro: C(0x8f8a82),
  acera: C(0xc2bcb1),
  bordillo: C(0xd8d3c9),
  plaza: C(0xc9c3b9),
  plazaOscura: C(0xaaa49b),
  ladrillo: C(0xb07a5c),
  gravaClara: C(0xd2c3a2),
  gravaParque: C(0xc4ab88),
  tierra: C(0x4a3424),
  tierraObra: C(0x7a6650),
  blanco: C(0xf4f4f0),
  amarillo: C(0xe8b323),
  negro: C(0x18191b),
  acero: C(0x6b737b),
  aceroClaro: C(0xa9b0b6),
  madera: C(0x8a5a33),
  maderaClara: C(0xc99a62),
  rojo: C(0xb3261e),
  naranja: C(0xe0641a),
}

/** Tonos de las copas: verdes de verano con algún dorado de otoño. */
const TONOS_COPA = [0x3f6e2a, 0x4b7c2f, 0x578a37, 0x365f26, 0x5d8f3b, 0x47742d, 0x6a933b, 0x41692c]
const TONOS_OTONO = [0x9a8a35, 0xb07a2a, 0x8f9a3a]
function tonoCopa(r: Rng, otono = 0.07) {
  return r() < otono ? C(elegir(r, TONOS_OTONO)) : C(elegir(r, TONOS_COPA)).offsetHSL(entre(r, -0.015, 0.015), entre(r, -0.05, 0.05), entre(r, -0.03, 0.03))
}

function libre(w: Mundo, x: number, z: number, margen: number) {
  for (const o of w.ocupado) {
    if (o.tipo === "rect") {
      if (x > o.x0 - margen && x < o.x1 + margen && z > o.z0 - margen && z < o.z1 + margen) return false
    } else if (o.tipo === "circ") {
      if (Math.hypot(x - o.x, z - o.z) < o.r + margen) return false
    } else {
      const lim = o.ancho / 2 + margen
      for (let i = 0; i < o.pts.length - 1; i++) {
        const [ax, az] = o.pts[i]
        const [bx, bz] = o.pts[i + 1]
        const dx = bx - ax
        const dz = bz - az
        const l2 = dx * dx + dz * dz || 1
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2))
        if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < lim) return false
      }
    }
  }
  return true
}
const ocupaRect = (w: Mundo, x0: number, x1: number, z0: number, z1: number) => w.ocupado.push({ tipo: "rect", x0, x1, z0, z1 })
const ocupaCirc = (w: Mundo, x: number, z: number, r: number) => w.ocupado.push({ tipo: "circ", x, z, r })

/** Camino de grava o piedra: se dibuja y queda marcado para no plantar encima. */
function camino(w: Mundo, pts: P2[], ancho: number, tipo: "grava" | "piedra" | "ladrillo" = "grava", suavizar = true) {
  const linea = suavizar && pts.length > 2 ? curva(pts, 1.5) : pts
  const l = new Lamina((x, z) => alturaSuelo(x, z) + Y.camino)
  const k = tipo === "grava" ? PALETA.gravaClara : tipo === "piedra" ? PALETA.piedraClara : PALETA.ladrillo
  l.cinta(linea, ancho, k)
  w.cub.add(tipo === "grava" ? "grava" : "caminoPiedra", l.geometria())
  w.ocupado.push({ tipo: "linea", pts: linea, ancho })
  return linea
}

// ══════════════════════════════════════════════════════════════
// Suelo: pasto, manzanas, plazas
// ══════════════════════════════════════════════════════════════

const R = HUELLAS.reja
const EXT = { x0: -1250, x1: 1250, z0: -1250, z1: 1400 }

function suelo(w: Mundo) {
  const verde = C(0xffffff)
  const pasto = plano(Y.pasto)
  pasto.rect(R.x0, R.x1, R.z0, R.z1 + 5, verde) // el predio y la franja al sur de la reja
  pasto.rect(-55, 55, -165, -90, verde) // Parque Lafayette
  pasto.rect(-173, 159, 193, 632.6, verde) // la Elipse (President's Park sur)
  pasto.rect(-173, -100, 72, 167, verde) // al sur del Edificio Eisenhower
  pasto.rect(104, 159, 72, 167, verde) // al sur del Tesoro
  pasto.rect(EXT.x0, EXT.x1, 667, EXT.z1, verde) // el National Mall
  w.cub.add("pasto", pasto.geometria())

  // La loma del Monumento: anillos con altura, mismo shader de pasto.
  const anillos = 26
  const lados = 64
  const pos: number[] = []
  const punto = (i: number, j: number): [number, number, number] => {
    const r = (LOMA.radio * i) / anillos
    const t = (j / lados) * Math.PI * 2
    const x = MON.x + Math.cos(t) * r
    const z = MON.z + Math.sin(t) * r
    return [x, alturaSuelo(x, z) + 0.01, z]
  }
  for (let i = 0; i < anillos; i++)
    for (let j = 0; j < lados; j++) {
      const a = punto(i, j), b = punto(i + 1, j), c = punto(i + 1, j + 1), d = punto(i, j + 1)
      pos.push(...a, ...c, ...b, ...a, ...d, ...c)
    }
  const loma = new THREE.BufferGeometry()
  loma.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  loma.computeVertexNormals()
  // Las caras deben mirar arriba: si el orden quedó al revés, se invierte.
  if (loma.getAttribute("normal").getY(0) < 0) {
    const p = loma.getAttribute("position")
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1)
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2))
      p.setXYZ(i + 2, x, y, z)
    }
    loma.computeVertexNormals()
  }
  w.cub.add("pasto", loma, verde)

  // Manzanas de la ciudad: un solo plano debajo de todo.
  const base = plano(Y.manzana)
  base.rect(EXT.x0, EXT.x1, EXT.z0, EXT.z1, C(0xffffff))
  w.cub.add("manzana", base.geometria())

  // Plazas de baldosas: Pennsylvania Avenue peatonal y los alrededores del
  // Edificio Eisenhower y del Tesoro (los edificios los pone arquitectura.ts).
  const pz = plano(0.045)
  pz.rect(-173, 159, -90, -70, PALETA.plaza)
  pz.rect(-173, 159, -84.5, -75.5, PALETA.plazaOscura) // la vieja calzada
  pz.rect(-173, R.x0, -70, 72, PALETA.plaza)
  pz.rect(R.x1, 159, -70, 72, PALETA.plaza)
  pz.rect(-66, -58, -165, -90, PALETA.ladrillo) // Jackson Place
  pz.rect(58, 66, -165, -90, PALETA.ladrillo) // Madison Place
  pz.rect(-58, -55, -165, -90, PALETA.plaza)
  pz.rect(55, 58, -165, -90, PALETA.plaza)
  pz.rect(-173, 159, -167, -165, PALETA.plaza)
  // West y East Executive Avenue, dentro de la reja (las recorre la gente del grafo).
  pz.rect(-94, -86, -64, 30, PALETA.plazaOscura)
  pz.rect(86, 94, -64, 34, PALETA.plazaOscura)
  w.cub.add("pavimento", pz.geometria())
  ocupaRect(w, -94, -86, -64, 30)
  ocupaRect(w, 86, 94, -64, 34)

  // Tierra de la obra del salón de baile (las grúas y andamios son de arquitectura.ts).
  const O = HUELLAS.obra
  const tierra = plano(Y.cantero - 0.045)
  tierra.rect(O.x0, O.x1, O.z0, O.z1, PALETA.tierraObra)
  w.cub.add("superficie", tierra.geometria())

  // Las huellas de los edificios quedan libres de árboles.
  const H = HUELLAS
  ocupaRect(w, H.residencia.x0 - 3, H.residencia.x1 + 3, H.residencia.z0 - 3, H.residencia.z1 + 3)
  ocupaRect(w, H.porticoNorte.x0 - 2, H.porticoNorte.x1 + 2, H.porticoNorte.z0 - 2, H.porticoNorte.z1)
  ocupaCirc(w, H.porticoSur.cx, H.porticoSur.cz, H.porticoSur.radio + 5)
  ocupaRect(w, H.alaOeste.x0 - 3, H.alaOeste.x1 + 3, H.alaOeste.z0 - 3, H.alaOeste.z1 + 3)
  ocupaRect(w, H.columnataOeste.x0, H.columnataOeste.x1, H.columnataOeste.z0 - 2, H.columnataOeste.z1 + 2)
  ocupaRect(w, H.obra.x0 - 2, H.obra.x1 + 2, H.obra.z0 - 2, H.obra.z1 + 2)
  ocupaRect(w, H.eeob.x0 - 4, H.eeob.x1 + 4, H.eeob.z0 - 4, H.eeob.z1 + 4)
  ocupaRect(w, H.tesoro.x0 - 4, H.tesoro.x1 + 4, H.tesoro.z0 - 4, H.tesoro.z1 + 4)
}

// ══════════════════════════════════════════════════════════════
// Calles: asfalto, aceras con bordillo, líneas pintadas y cruces
// ══════════════════════════════════════════════════════════════

/** Una calle recta. "ns" corre de norte a sur en x = c; "eo" de este a oeste en z = c. */
export interface CallePaisaje {
  id: string
  eje: "ns" | "eo"
  c: number
  a: number
  b: number
  carriles: number
  autos: number
  acera?: number
}
const CARRIL = 3.4
export const anchoCalle = (k: CallePaisaje) => k.carriles * 2 * CARRIL + 2.4

/**
 * Las calles alrededor de la Casa Blanca, en las coordenadas de lugares.ts.
 * Se exportan para que otros módulos (la ciudad de fondo) no construyan encima.
 */
export const CALLES_PAISAJE: CallePaisaje[] = (() => {
  const L: CallePaisaje[] = [
    { id: "calle-17", eje: "ns", c: -186, a: EXT.z0, b: EXT.z1, carriles: 2, autos: 11 },
    { id: "calle-15", eje: "ns", c: 172, a: EXT.z0, b: EXT.z1, carriles: 2, autos: 11 },
    { id: "calle-h", eje: "eo", c: -180, a: EXT.x0, b: EXT.x1, carriles: 2, autos: 8 },
    { id: "calle-e", eje: "eo", c: 180, a: EXT.x0, b: EXT.x1, carriles: 2, autos: 7 },
    { id: "constitution", eje: "eo", c: 650, a: EXT.x0, b: EXT.x1, carriles: 3, autos: 9 },
    { id: "independence", eje: "eo", c: 1330, a: EXT.x0, b: EXT.x1, carriles: 2, autos: 6 },
    { id: "calle-14", eje: "ns", c: 305, a: EXT.z0, b: EXT.z1, carriles: 2, autos: 5 },
  ]
  // Grilla de la ciudad al norte de la Constitution y a los costados.
  const xs = [-320, -455, -590, -725, -860, -995, -1130, 440, 575, 710, 845, 980, 1115]
  xs.forEach((x, i) => L.push({ id: `ns-${i}`, eje: "ns", c: x, a: EXT.z0, b: 640, carriles: 1, autos: i % 3 === 0 ? 3 : 0, acera: 4 }))
  const zs = [-310, -440, -570, -700, -830, -960, -1090]
  zs.forEach((z, i) => L.push({ id: `eo-${i}`, eje: "eo", c: z, a: EXT.x0, b: EXT.x1, carriles: 1, autos: i % 2 === 0 ? 4 : 0, acera: 4 }))
  for (const [i, z] of [-50, 60, 330, 480].entries()) {
    L.push({ id: `eo-o${i}`, eje: "eo", c: z, a: EXT.x0, b: -194, carriles: 1, autos: 0, acera: 4 })
    L.push({ id: `eo-e${i}`, eje: "eo", c: z, a: 180, b: EXT.x1, carriles: 1, autos: 0, acera: 4 })
  }
  return L
})()

/** Tramos de una calle entre cruces: [desde, hasta] a lo largo de su eje. */
function tramos(k: CallePaisaje, margen: (o: CallePaisaje) => number): Array<[number, number]> {
  const cortes: Array<[number, number]> = []
  for (const o of CALLES_PAISAJE) {
    if (o.eje === k.eje || o === k) continue
    if (k.c < o.a - 1 || k.c > o.b + 1 || o.c < k.a || o.c > k.b) continue
    const m = margen(o)
    cortes.push([o.c - m, o.c + m])
  }
  cortes.sort((p, q) => p[0] - q[0])
  const out: Array<[number, number]> = []
  let desde = k.a
  for (const [c0, c1] of cortes) {
    if (c0 > desde) out.push([desde, c0])
    desde = Math.max(desde, c1)
  }
  if (desde < k.b) out.push([desde, k.b])
  return out
}

function calles(w: Mundo) {
  const asf = plano(Y.asfalto)
  const lin = plano(Y.pintura)
  const cerca = (k: CallePaisaje, s: number) => (k.eje === "ns" ? Math.hypot(k.c, s) : Math.hypot(s, k.c)) < 900
  // Un rect "a lo largo" de la calle: s0..s1 en su eje, o0..o1 de costado.
  const rectEn = (l: Lamina, k: CallePaisaje, s0: number, s1: number, o0: number, o1: number, col: THREE.Color) => {
    if (k.eje === "ns") l.rect(k.c + o0, k.c + o1, s0, s1, col)
    else l.rect(s0, s1, k.c + o0, k.c + o1, col)
  }
  for (const k of CALLES_PAISAJE) {
    const W = anchoCalle(k)
    rectEn(asf, k, k.a, k.b, -W / 2, W / 2, C(0xffffff))
    if (k.eje === "ns") ocupaRect(w, k.c - W / 2, k.c + W / 2, k.a, k.b)
    else ocupaRect(w, k.a, k.b, k.c - W / 2, k.c + W / 2)

    // Aceras con bordillo, cortadas en cada cruce.
    const A = k.acera ?? 5
    for (const [s0, s1] of tramos(k, (o) => anchoCalle(o) / 2)) {
      for (const lado of [-1, 1]) {
        const o0 = lado < 0 ? -W / 2 - A : W / 2
        const o1 = lado < 0 ? -W / 2 : W / 2 + A
        const g = k.eje === "ns" ? losa(k.c + o0, k.c + o1, s0, s1, -0.1, Y.acera) : losa(s0, s1, k.c + o0, k.c + o1, -0.1, Y.acera)
        w.cub.add("pavimento", g, PALETA.acera)
        const b0 = lado < 0 ? -W / 2 - 0.3 : W / 2
        const b1 = lado < 0 ? -W / 2 : W / 2 + 0.3
        const gb = k.eje === "ns" ? losa(k.c + b0, k.c + b1, s0, s1, -0.1, Y.acera + 0.005) : losa(s0, s1, k.c + b0, k.c + b1, -0.1, Y.acera + 0.005)
        w.cub.add("pavimento", gb, PALETA.bordillo)
        if (k.eje === "ns") ocupaRect(w, k.c + o0, k.c + o1, s0, s1)
        else ocupaRect(w, s0, s1, k.c + o0, k.c + o1)
      }
    }

    // Líneas: doble amarilla al centro y discontinuas blancas entre carriles.
    for (const [s0, s1] of tramos(k, (o) => anchoCalle(o) / 2 + 4)) {
      rectEn(lin, k, s0, s1, -0.22, -0.1, PALETA.amarillo)
      rectEn(lin, k, s0, s1, 0.1, 0.22, PALETA.amarillo)
      for (let i = 1; i < k.carriles; i++)
        for (const lado of [-1, 1]) {
          const o = lado * (i * CARRIL + 0.2)
          for (let s = s0 + 2; s + 3 < s1; s += 12) rectEn(lin, k, s, s + 3, o - 0.07, o + 0.07, PALETA.blanco)
        }
      // Borde de calzada.
      rectEn(lin, k, s0, s1, -W / 2 + 0.9, -W / 2 + 1.02, PALETA.blanco)
      rectEn(lin, k, s0, s1, W / 2 - 1.02, W / 2 - 0.9, PALETA.blanco)
    }
    // Pasos de cebra y líneas de pare a los dos lados de cada cruce cercano.
    for (const o of CALLES_PAISAJE) {
      if (o.eje === k.eje || k.c < o.a - 1 || k.c > o.b + 1 || o.c < k.a || o.c > k.b) continue
      if (!cerca(k, o.c)) continue
      const m = anchoCalle(o) / 2
      for (const lado of [-1, 1]) {
        const s0 = o.c + lado * (m + 0.8)
        const s1 = o.c + lado * (m + 3.8)
        for (let q = -W / 2 + 1.2; q + 0.5 < W / 2 - 1; q += 1.1) rectEn(lin, k, Math.min(s0, s1), Math.max(s0, s1), q, q + 0.5, PALETA.blanco)
        const sp = o.c + lado * (m + 4.6)
        const pare = lado < 0 ? [0.2, W / 2 - 1] : [-W / 2 + 1, -0.2]
        rectEn(lin, k, Math.min(sp, sp + lado * 0.4), Math.max(sp, sp + lado * 0.4), pare[0], pare[1], PALETA.blanco)
      }
    }
  }
  w.cub.add("asfalto", asf.geometria())
  w.cub.add("pintura", lin.geometria())

  // Árboles y faroles de vereda (solo cerca: lo lejano lo tapa la niebla).
  const r = w.r
  for (const k of CALLES_PAISAJE) {
    const W = anchoCalle(k)
    const A = k.acera ?? 5
    const principal = k.carriles >= 2
    for (const [s0, s1] of tramos(k, (o) => anchoCalle(o) / 2 + (o.acera ?? 5) + 3)) {
      for (const lado of [-1, 1]) {
        const off = lado * (W / 2 + A * 0.55)
        const offF = lado * (W / 2 + 0.75)
        for (let s = s0 + 6; s < s1 - 4; s += principal ? 19 : 23) {
          const [x, z] = k.eje === "ns" ? [k.c + off, s] : [s, k.c + off]
          const d = Math.hypot(x, z - 150)
          if (d > 1150 || r() < 0.08) continue
          // Pista ajardinada al pie del árbol.
          const cuadro = plano(Y.acera + 0.006)
          cuadro.rect(x - 0.8, x + 0.8, z - 0.8, z + 0.8, PALETA.tierra)
          w.cub.add("superficie", cuadro.geometria())
          w.arboles.push({ x, z, s: entre(r, 0.6, 0.85), tipo: d > 380 ? "lejano" : "chico", tono: tonoCopa(r, 0.05) })
        }
        if (!principal) continue
        for (let s = s0 + 15; s < s1 - 4; s += 38) {
          const [x, z] = k.eje === "ns" ? [k.c + offF, s] : [s, k.c + offF]
          if (Math.hypot(x, z - 150) > 900) continue
          const ry = k.eje === "ns" ? (lado < 0 ? Math.PI / 2 : -Math.PI / 2) : lado < 0 ? 0 : Math.PI
          w.faroles.push({ x, z, y: Y.acera, ry })
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Jardín Norte: la vista de la foto
// ══════════════════════════════════════════════════════════════

/** La entrada semicircular de autos: media elipse desde los portones de Pennsylvania Ave. */
const ENTRADA_NORTE = { cx: 0, cz: R.z0, rx: 38, rz: 43, ancho: 7 }

function jardinNorte(w: Mundo) {
  const E = ENTRADA_NORTE
  const F = HUELLAS.fuenteNorte
  const asf = new Lamina(() => Y.asfalto)
  const arcoEntrada = elipse(E.cx, E.cz, E.rx, E.rz, 80, Math.PI, Math.PI * 2).map(([x, z]) => [x, z] as P2)
  // Se estira un poco hacia Pennsylvania Ave para que entre por el portón.
  const conPuntas: P2[] = [[-E.rx, R.z0 - 3.5], ...arcoEntrada, [E.rx, R.z0 - 3.5]]
  asf.cinta(conPuntas, E.ancho, C(0xffffff))
  w.cub.add("asfalto", asf.geometria())
  w.ocupado.push({ tipo: "linea", pts: conPuntas, ancho: E.ancho + 2 })
  // Bordillo claro a los dos lados de la entrada.
  const bord = plano(Y.asfalto + 0.004)
  bord.cinta(elipse(E.cx, E.cz, E.rx - E.ancho / 2 - 0.15, E.rz - E.ancho / 2 - 0.15, 80, Math.PI, Math.PI * 2), 0.3, PALETA.bordillo)
  bord.cinta(elipse(E.cx, E.cz, E.rx + E.ancho / 2 + 0.15, E.rz + E.ancho / 2 + 0.15, 80, Math.PI, Math.PI * 2), 0.3, PALETA.bordillo)
  w.cub.add("pintura", bord.geometria())

  // Camino de piedra recto: de la reja a la fuente y de la fuente a la entrada.
  const zEntrada = E.cz - E.rz + E.ancho / 2
  camino(w, [[0, R.z0 - 0.5], [0, F.z + F.radio + 2.2]], 3.4, "piedra", false)
  camino(w, [[0, F.z - F.radio - 2.2], [0, zEntrada]], 3.4, "piedra", false)
  // Un anillo de piedra alrededor del cantero de la fuente.
  const anillo = plano(Y.camino)
  anillo.arco(F.x, F.z, F.radio + 2.0, F.radio + 3.3, 0, Math.PI * 2, PALETA.piedraClara, 64)
  w.cub.add("caminoPiedra", anillo.geometria())
  ocupaCirc(w, F.x, F.z, F.radio + 4)
  // Senderos hacia West y East Executive Avenue (no-1 → calle-oeste-n y espejo).
  camino(w, [[-2, -36], [-22, -39], [-40, -40], [-62, -39], [-80, -35], [-90, -28]], 2.4, "piedra")
  camino(w, [[2, -36], [22, -39], [40, -40], [62, -39], [80, -35], [90, -28]], 2.4, "piedra")
  // Corredor de la vista de la foto: sin árboles entre la reja y la fachada.
  ocupaRect(w, -30, 30, R.z0, HUELLAS.residencia.z0)

  // Fuente norte: borde de piedra, cuenco central y chorro.
  fuente(w, F.x, F.z, F.radio, { cuenco: 1.6, altoCuenco: 1.2 })
  w.chorros.push({ x: F.x, z: F.z, y: 1.45, alto: 5.2, radio: 2.2, caida: 1.6 })
  // Flores alrededor de la fuente: rojas por fuera, blancas por dentro.
  cantero(w, (pl) => pl.arco(F.x, F.z, F.radio + 0.15, F.radio + 1.9, 0, Math.PI * 2, PALETA.tierra, 64))
  for (let i = 0; i < 2; i++) {
    const rr = F.radio + 0.6 + i * 0.8
    const n = Math.floor((2 * Math.PI * rr) / 0.48)
    for (let j = 0; j < n; j++) {
      const t = (j / n) * Math.PI * 2 + i * 0.2
      sembrarFlor(w, F.x + Math.cos(t) * rr, F.z + Math.sin(t) * rr, i === 0 ? C(0xf2efe6) : C(0xc4161c))
    }
  }

  // Setos de boj al pie de la fachada y alrededor del pórtico (la puerta, libre).
  const P = HUELLAS.porticoNorte
  const res = HUELLAS.residencia
  seto(w, [[-25, -15], [P.x0 - 1.2, -15]], 1.1, 1.9)
  seto(w, [[P.x1 + 1.2, -15], [25, -15]], 1.1, 1.9)
  seto(w, [[P.x0 - 1.0, -15.6], [P.x0 - 1.0, P.z0 - 0.4]], 1.0, 1.4)
  seto(w, [[P.x1 + 1.0, -15.6], [P.x1 + 1.0, P.z0 - 0.4]], 1.0, 1.4)
  seto(w, [[P.x0 - 1.0, P.z0 - 0.6], [-3.6, P.z0 - 0.6]], 0.75, 1.0)
  seto(w, [[3.6, P.z0 - 0.6], [P.x1 + 1.0, P.z0 - 0.6]], 0.75, 1.0)
  // Un cantero de flores blancas delante de los setos.
  cantero(w, (pl) => {
    pl.rect(-25, P.x0 - 1.2, -17.3, -16.2, PALETA.tierra)
    pl.rect(P.x1 + 1.2, 25, -17.3, -16.2, PALETA.tierra)
  })
  for (let x = -24.6; x < 24.6; x += 0.5) {
    if (Math.abs(x) < P.x1 + 1.6) continue
    sembrarFlor(w, x, -16.75, C(0xf4f1ea))
  }
  // Bolas de boj en las esquinas del pórtico y en los extremos de la fachada.
  for (const [x, z, s] of [[-12.4, -23.6, 1.3], [12.4, -23.6, 1.3], [-25.6, -15.2, 1.5], [25.6, -15.2, 1.5], [-18, -15.2, 1.1], [18, -15.2, 1.1]] as const)
    w.arbustos.push({ m: mtx(x, 0, z, 0, s, s * 0.95), c: C(0x2d4a22) })
  // Setos bajos a lo largo del ala oeste y de la obra, del lado norte.
  seto(w, [[-48, res.z0 - 1.6], [-28, res.z0 - 1.6]], 0.9, 1.3)
  seto(w, [[28, res.z0 - 1.6], [31, res.z0 - 1.6]], 0.9, 1.3)

  // Faroles de globo a lo largo de la entrada de autos.
  const exterior = elipse(E.cx, E.cz, E.rx + E.ancho / 2 + 1.4, E.rz + E.ancho / 2 + 1.4, 12, Math.PI + 0.12, Math.PI * 2 - 0.12)
  exterior.forEach(([x, z], i) => {
    if (i % 2 === 1 || Math.abs(x) < 8) return
    w.faroles.push({ x, z, y: 0, ry: 0 })
  })
}

/** Cantero de tierra para flores (lámina oscura sobre el pasto). */
function cantero(w: Mundo, dibujar: (l: Lamina) => void) {
  const l = plano(Y.cantero - 0.025)
  dibujar(l)
  w.cub.add("superficie", l.geometria())
}

function sembrarFlor(w: Mundo, x: number, z: number, c: THREE.Color, s = 1) {
  const r = w.r
  const y = alturaSuelo(x, z)
  const ss = s * entre(r, 0.85, 1.15)
  w.matas.push({ m: mtx(x, y, z, r() * 6.28, ss, ss * entre(r, 0.8, 1.1)), c: C(0x3d6a2a).offsetHSL(entre(r, -0.02, 0.02), 0, entre(r, -0.04, 0.03)) })
  w.flores.push({ m: mtx(x, y, z, r() * 6.28, ss), c: c.clone().offsetHSL(entre(r, -0.01, 0.01), 0, entre(r, -0.05, 0.05)) })
}

/** Seto de boj recortado: tramos de caja redondeada con el borde irregular. */
function seto(w: Mundo, pts: P2[], alto: number, ancho: number) {
  const r = w.r
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const L = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(L / 1.5))
    const ry = Math.atan2(-(bz - az), bx - ax)
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n
      const largo = L / n + 0.35
      const g = new RoundedBoxGeometry(largo, alto * entre(r, 0.95, 1.05), ancho, 2, Math.min(0.3, alto * 0.3))
      deformar(g, 0.06, j * 7 + i * 13)
      sombrear(g, alto)
      en(g, ax + (bx - ax) * t, alto / 2, az + (bz - az) * t, ry)
      w.cub.add("follaje", g)
    }
    w.ocupado.push({ tipo: "linea", pts: [pts[i], pts[i + 1]], ancho: ancho + 1 })
  }
}
/** Mueve cada vértice a lo largo de su normal con ruido 3D. */
function deformar(g: THREE.BufferGeometry, amp: number, semilla: number) {
  const p = g.getAttribute("position")
  const n = g.getAttribute("normal")
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const d = (ruido3(x * 2.2 + semilla, y * 2.2, z * 2.2) - 0.5) * 2 * amp
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d)
  }
  g.computeVertexNormals()
}
/** Oscurece la base del follaje (oclusión falsa): más vivo arriba, más denso abajo. */
function sombrear(g: THREE.BufferGeometry, alto: number, base = C(0x2f5424)) {
  const p = g.getAttribute("position")
  const a = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const t = suave(-alto / 2, alto / 2, p.getY(i))
    const k = 0.55 + 0.6 * t
    a[i * 3] = base.r * k
    a[i * 3 + 1] = base.g * k
    a[i * 3 + 2] = base.b * k
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3))
}

// ══════════════════════════════════════════════════════════════
// Fuentes: borde de piedra, agua con ondas, chorros y gotas
// ══════════════════════════════════════════════════════════════

function fuente(w: Mundo, x: number, z: number, radio: number, op: { cuenco?: number; altoCuenco?: number; altoBorde?: number } = {}) {
  const y0 = alturaSuelo(x, z)
  const hb = op.altoBorde ?? 0.55
  // Borde: perfil torneado (base, pared, remate redondeado).
  const perfil = [
    [radio - 0.55, 0],
    [radio + 0.12, 0],
    [radio + 0.12, hb - 0.12],
    [radio + 0.22, hb - 0.08],
    [radio + 0.2, hb + 0.02],
    [radio - 0.05, hb + 0.06],
    [radio - 0.42, hb + 0.03],
    [radio - 0.45, hb - 0.08],
    [radio - 0.55, hb - 0.15],
    [radio - 0.55, 0],
  ].map(([a, b]) => new THREE.Vector2(a, b))
  w.cub.add("piedra", en(new THREE.LatheGeometry(perfil, 72), x, y0, z), PALETA.piedraClara)
  // Agua.
  const agua = new THREE.CircleGeometry(radio - 0.5, 64)
  agua.rotateX(-Math.PI / 2)
  w.cub.add("agua", en(agua, x, y0 + hb - 0.14, z))
  // Cuenco central (pie torneado + plato) con su propia lámina de agua.
  if (op.cuenco) {
    const hc = op.altoCuenco ?? 1.2
    const rc = op.cuenco
    const pie = [
      [0, 0], [0.75, 0], [0.7, 0.18], [0.36, 0.3], [0.28, hc * 0.55], [0.36, hc * 0.7], [0.5, hc * 0.8],
      [rc, hc], [rc + 0.08, hc + 0.1], [rc + 0.02, hc + 0.22], [rc - 0.12, hc + 0.22], [rc - 0.14, hc + 0.12], [0.2, hc + 0.12], [0, hc + 0.12],
    ].map(([a, b]) => new THREE.Vector2(a, b))
    w.cub.add("piedra", en(new THREE.LatheGeometry(pie, 40), x, y0 + hb - 0.2, z), PALETA.piedraClara)
    const ac = new THREE.CircleGeometry(rc - 0.12, 40)
    ac.rotateX(-Math.PI / 2)
    w.cub.add("agua", en(ac, x, y0 + hb - 0.2 + hc + 0.2, z))
  }
  ocupaCirc(w, x, z, radio + 2.5)
}

/**
 * Chorros y gotas de todas las fuentes en dos mallas: columnas de agua
 * translúcidas y partículas que siguen una parábola real (g = 9,8 m/s²)
 * calculada en la GPU, sin tocar la CPU en cada cuadro.
 */
function chorrosYGotas(w: Mundo) {
  const { T, N } = w.M
  const columnas: THREE.BufferGeometry[] = []
  const espumas: THREE.BufferGeometry[] = []
  const origen: number[] = []
  const vel: number[] = []
  const vida: number[] = []
  const tam: number[] = []
  const r = azar(77)
  const g = 9.8
  const gota = (ox: number, oy: number, oz: number, vx: number, vy: number, vz: number, yAgua: number, s: number) => {
    // Tiempo hasta volver a caer al agua: así la gota desaparece justo al tocarla.
    const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (oy - yAgua)))) / g
    origen.push(ox, oy, oz)
    vel.push(vx, vy, vz)
    vida.push(Math.max(0.3, t), r())
    tam.push(s)
  }
  for (const f of w.chorros) {
    const y0 = alturaSuelo(f.x, f.z)
    const yAgua = y0 + 0.41
    const base = y0 + f.y
    // Columna central: un cono estirado y abierto.
    const alto = f.alto * 0.92
    const perfil = [new THREE.Vector2(0.09, 0), new THREE.Vector2(0.12, alto * 0.3), new THREE.Vector2(0.18, alto * 0.75), new THREE.Vector2(0.32, alto), new THREE.Vector2(0.05, alto + 0.25)]
    columnas.push(en(new THREE.LatheGeometry(perfil, 14), f.x, base, f.z))
    const esp = new THREE.CircleGeometry(f.radio, 40)
    esp.rotateX(-Math.PI / 2)
    espumas.push(en(esp, f.x, (f.caida ? base + 0.02 : yAgua + 0.015), f.z))
    const v0 = Math.sqrt(2 * g * f.alto)
    const n = Math.round(380 * w.factor * (f.alto / 6))
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const abre = entre(r, 0.15, 0.95) * (f.radio / Math.max(1, f.alto)) * 2.2
      gota(f.x, base, f.z, Math.cos(a) * abre, v0 * entre(r, 0.82, 1.0), Math.sin(a) * abre, yAgua, entre(r, 0.05, 0.11))
    }
    // Agua que rebalsa del cuenco central y cae en cortina.
    if (f.caida) {
      const nc = Math.round(220 * w.factor)
      for (let i = 0; i < nc; i++) {
        const a = r() * Math.PI * 2
        const rr = f.caida + 0.05
        const sv = entre(r, 0.4, 0.9)
        gota(f.x + Math.cos(a) * rr, base - 0.05, f.z + Math.sin(a) * rr, Math.cos(a) * sv, entre(r, -0.1, 0.25), Math.sin(a) * sv, yAgua, entre(r, 0.04, 0.08))
      }
    }
    // Chorros en arco desde el borde hacia el centro (la fuente grande del sur).
    if (f.anillo) {
      const A = f.anillo
      const v0a = Math.sqrt(2 * g * A.alto)
      const tVuelo = (2 * v0a) / g
      const vh = (A.r * 0.55) / tVuelo
      const porChorro = Math.round(34 * w.factor)
      for (let k = 0; k < A.n; k++) {
        const a = (k / A.n) * Math.PI * 2
        const ox = f.x + Math.cos(a) * A.r
        const oz = f.z + Math.sin(a) * A.r
        for (let i = 0; i < porChorro; i++) {
          const j = entre(r, 0.92, 1.06)
          gota(ox, yAgua + 0.05, oz, -Math.cos(a) * vh * j + entre(r, -0.08, 0.08), v0a * j, -Math.sin(a) * vh * j + entre(r, -0.08, 0.08), yAgua, entre(r, 0.04, 0.08))
        }
      }
    }
  }
  if (!origen.length) return

  const matCol = new THREE.ShaderMaterial({
    uniforms: { uTiempo: T, uNoche: N },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTiempo; uniform float uNoche;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      ${RUIDO}
      void main(){
        float n = b3n(vec2(vUv.x * 14.0, vUv.y * 9.0 - uTiempo * 5.0));
        float n2 = b3n(vec2(vUv.x * 31.0, vUv.y * 21.0 - uTiempo * 8.0));
        float a = (0.2 + 0.55 * n * n2) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 1.5);
        a *= 0.45 + 0.9 * fres;
        vec3 c = mix(vec3(0.72, 0.84, 0.9), vec3(1.0), n) * (1.0 + uNoche * 1.6);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const matEsp = new THREE.ShaderMaterial({
    uniforms: { uTiempo: T, uNoche: N },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTiempo; uniform float uNoche; varying vec2 vUv;
      ${RUIDO}
      void main(){
        vec2 c = vUv - 0.5; float d = length(c) * 2.0; float ang = atan(c.y, c.x);
        float n = b3n(vec2(ang * 6.0, d * 9.0 - uTiempo * 2.4)) * b3n(vec2(ang * 13.0 + 3.0, d * 17.0 - uTiempo * 3.1));
        float a = smoothstep(0.15, 0.55, n) * (1.0 - smoothstep(0.55, 1.0, d)) * 0.75;
        gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * (1.0 + uNoche), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const col = new THREE.Mesh(unir(columnas), matCol)
  col.name = "paisaje-chorros"
  col.renderOrder = 2
  const espuma = new THREE.Mesh(unir(espumas), matEsp)
  espuma.name = "paisaje-espuma"
  espuma.renderOrder = 1

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(origen, 3))
  geo.setAttribute("aVel", new THREE.Float32BufferAttribute(vel, 3))
  geo.setAttribute("aVida", new THREE.Float32BufferAttribute(vida, 2))
  geo.setAttribute("aTam", new THREE.Float32BufferAttribute(tam, 1))
  const matG = new THREE.ShaderMaterial({
    uniforms: { uTiempo: T, uNoche: N },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTiempo;
      attribute vec3 aVel; attribute vec2 aVida; attribute float aTam;
      varying float vA;
      void main(){
        float per = aVida.x;
        float t = mod(uTiempo + aVida.y * per, per);
        vec3 p = position + aVel * t + vec3(0.0, -4.9, 0.0) * t * t;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(per * 0.9, per, t));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(1100.0 * aTam / -mv.z, 1.0, 24.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNoche; varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
        if (d > 0.25) discard;
        float a = (1.0 - d * 4.0) * vA * 0.7;
        gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * (1.05 + uNoche * 1.8), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const gotas = new THREE.Points(geo, matG)
  gotas.name = "paisaje-gotas"
  gotas.frustumCulled = false
  gotas.renderOrder = 3
  w.raiz.add(col, espuma, gotas)
}

// ══════════════════════════════════════════════════════════════
// Jardín Sur: el óvalo, la fuente grande, caminos curvos y el helipunto
// ══════════════════════════════════════════════════════════════

const OVALO = { cx: 0, cz: 88, rx: 25, rz: 50, ancho: 5 }
const HELI = { x: 0, z: 125 }

function jardinSur(w: Mundo) {
  const F = HUELLAS.fuenteSur
  const O = OVALO
  // El gran óvalo: el camino de grava que rodea el césped central.
  camino(w, elipse(O.cx, O.cz, O.rx, O.rz, 120), O.ancho, "grava", false)
  ocupaCirc(w, O.cx, O.cz, 0) // marcador (el interior se protege abajo)
  // Del Pórtico Sur al óvalo.
  camino(w, [[0, HUELLAS.porticoSur.cz + HUELLAS.porticoSur.radio - 0.5], [0, O.cz - O.rz]], 4, "grava", false)
  // Caminos curvos al oeste y al este, rodeando las canchas.
  const oeste: P2[] = [[-4, 25.5], [-22, 27], [-29, 33], [-28.6, 42], [-31, 49.5], [-40, 53], [-49, 60], [-49.5, 75], [-50, 90], [-53, 104], [-54, 118], [-52.5, 134], [-40, 143], [-20, 147], [0, 147.5]]
  const este: P2[] = [[4, 25.5], [20, 28], [34, 34], [40, 46], [41, 60], [41, 78], [45, 92], [42, 106], [39.5, 121], [40, 139], [22, 146.5], [0, 147.5]]
  camino(w, oeste, 3, "grava")
  camino(w, este, 3, "grava")
  // Ramales a las canchas y a la piscina.
  camino(w, [[-38, 53], [-55, 46], [-70, 41.5], [-71, 37.5]], 2.2, "grava")
  camino(w, [[-62, 25], [-78, 23.5], [-89, 19], [-95.5, 14]], 2.4, "grava")
  camino(w, [[-53, 105], [-58.8, 105]], 2.2, "grava", false)
  camino(w, [[-54, 113.5], [-36, 113.5]], 2.2, "grava", false)
  camino(w, [[43, 106], [52, 108.5], [55, 111.8]], 2.2, "grava")
  camino(w, [[35, 30], [55, 27], [80, 30], [89, 33], [95.5, 20]], 2.4, "grava")

  // El césped del óvalo queda abierto: ni árboles ni bancos.
  w.ocupado.push({ tipo: "rect", x0: -O.rx - 4, x1: O.rx + 4, z0: O.cz - O.rz - 4, z1: O.cz + O.rz + 4 })
  // La vista al Monumento: un corredor libre hacia el sur.
  ocupaRect(w, -26, 26, 20, R.z1)

  // Fuente sur: grande, con chorro alto y un anillo de chorros en arco.
  fuente(w, F.x, F.z, F.radio, { altoBorde: 0.6 })
  w.chorros.push({ x: F.x, z: F.z, y: 0.45, alto: 8.5, radio: 3.2, anillo: { r: F.radio - 0.7, n: 16, alto: 1.9 } })
  // Canteros de flores alrededor de la fuente.
  cantero(w, (pl) => pl.arco(F.x, F.z, F.radio + 0.3, F.radio + 2.4, 0, Math.PI * 2, PALETA.tierra, 72))
  const coloresSur = [C(0xc4161c), C(0xf2efe6), C(0xe58a1f), C(0xd6336c)]
  for (let i = 0; i < 3; i++) {
    const rr = F.radio + 0.75 + i * 0.7
    const n = Math.floor((2 * Math.PI * rr) / 0.52)
    for (let j = 0; j < n; j++) {
      const t = (j / n) * Math.PI * 2 + i * 0.15
      const grupo = Math.floor((t / (Math.PI * 2)) * 8) % 2
      sembrarFlor(w, F.x + Math.cos(t) * rr, F.z + Math.sin(t) * rr, coloresSur[(i + grupo * 2) % 4])
    }
  }

  // Setos curvos y flores alrededor del Pórtico Sur (dejando libre la escalinata).
  const PS = HUELLAS.porticoSur
  const puntosSeto = (a0: number, a1: number) => elipse(PS.cx, PS.cz, PS.radio + 2.4, PS.radio + 2.4, 10, a0, a1)
  seto(w, puntosSeto(0.05, Math.PI / 2 - 0.22), 0.9, 1.2)
  seto(w, puntosSeto(Math.PI / 2 + 0.22, Math.PI - 0.05), 0.9, 1.2)
  cantero(w, (pl) => {
    pl.arco(PS.cx, PS.cz, PS.radio + 3.2, PS.radio + 4.6, 0.05, Math.PI / 2 - 0.25, PALETA.tierra, 20)
    pl.arco(PS.cx, PS.cz, PS.radio + 3.2, PS.radio + 4.6, Math.PI / 2 + 0.25, Math.PI - 0.05, PALETA.tierra, 20)
  })
  for (const [a0, a1] of [[0.08, Math.PI / 2 - 0.28], [Math.PI / 2 + 0.28, Math.PI - 0.08]]) {
    for (let i = 0; i < 2; i++) {
      const rr = PS.radio + 3.55 + i * 0.7
      const n = Math.floor(((a1 - a0) * rr) / 0.5)
      for (let j = 0; j <= n; j++) {
        const t = a0 + ((a1 - a0) * j) / n
        sembrarFlor(w, PS.cx + Math.cos(t) * rr, PS.cz + Math.sin(t) * rr, i ? C(0xd6336c) : C(0xf4f1ea))
      }
    }
  }
  // Setos que cierran el Jardín Sur contra la residencia (a los costados del pórtico).
  seto(w, [[-25, 15.4], [-12.5, 15.4]], 1.0, 1.6)
  seto(w, [[12.5, 15.4], [25, 15.4]], 1.0, 1.6)

  // Helipunto discreto: círculo y H en verde pálido, luces al ras del suelo.
  const pal = C(0xc9d9b0)
  const h = plano(Y.cantero - 0.02)
  h.arco(HELI.x, HELI.z, 9.4, 9.75, 0, Math.PI * 2, pal, 64)
  h.rect(HELI.x - 2.1, HELI.x - 1.4, HELI.z - 3, HELI.z + 3, pal)
  h.rect(HELI.x + 1.4, HELI.x + 2.1, HELI.z - 3, HELI.z + 3, pal)
  h.rect(HELI.x - 1.4, HELI.x + 1.4, HELI.z - 0.35, HELI.z + 0.35, pal)
  w.cub.add("superficie", h.geometria())
  const luces: THREE.Matrix4[] = []
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2
    luces.push(mtx(HELI.x + Math.cos(t) * 10.4, 0, HELI.z + Math.sin(t) * 10.4))
  }
  const g = new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10)
  g.translate(0, 0.04, 0)
  w.raiz.add(instanciar(w, g, w.M.luzSuelo, luces, undefined, "luces-helipunto", false, false))

  // Faroles a lo largo de los caminos curvos.
  for (const lado of [oeste, este]) {
    const c = curva(lado, 22)
    c.forEach(([x, z], i) => {
      if (i === 0 || i === c.length - 1) return
      const sig = c[Math.min(i + 1, c.length - 1)]
      const tx = sig[0] - x
      const tz = sig[1] - z
      const l = Math.hypot(tx, tz) || 1
      w.faroles.push({ x: x + (tz / l) * 2.2, z: z - (tx / l) * 2.2, y: 0, ry: 0 })
    })
  }
}

// ══════════════════════════════════════════════════════════════
// Deporte y ocio: cada cosa dentro de su rectángulo de LUGAR
// ══════════════════════════════════════════════════════════════

function rectLugar(id: string) {
  const l = LUGAR[id]
  if (!l) throw new Error(`paisaje: falta el lugar ${id}`)
  return l
}

/** Losa de cancha (baja, 6 cm) con su color. */
function losaCancha(w: Mundo, x0: number, x1: number, z0: number, z1: number, k: THREE.Color, alto = 0.06) {
  w.cub.add("superficie", losa(x0, x1, z0, z1, -0.05, alto), k)
}
/** Rectángulo de líneas (contorno) de ancho `a`. */
function contorno(l: Lamina, x0: number, x1: number, z0: number, z1: number, a: number, k: THREE.Color) {
  l.rect(x0, x1, z0, z0 + a, k)
  l.rect(x0, x1, z1 - a, z1, k)
  l.rect(x0, x0 + a, z0, z1, k)
  l.rect(x1 - a, x1, z0, z1, k)
}

/** Aro de básquet con tablero de vidrio, mirando hacia +x (rotar con ry). */
function aroBasquet(w: Mundo, x: number, z: number, ry: number, profesional = true) {
  const props: THREE.BufferGeometry[] = []
  const vidrio: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, k: THREE.Color) => props.push(pintar(g, k))
  // Poste detrás de la línea de fondo y brazo hasta el tablero.
  add(caja(0.9, 0.5, 1.3, -1.25, 0.25, 0), PALETA.acero)
  add(cil(0.1, 0.09, 3.35, 10, -1.25, 0.5, 0), PALETA.acero)
  add(caja(1.3, 0.1, 0.12, -0.6, 3.6, 0), PALETA.acero)
  add(barra(new THREE.Vector3(-1.25, 2.6, 0), new THREE.Vector3(-0.1, 3.5, 0), 0.04), PALETA.acero)
  // Tablero: vidrio con marco y el rectángulo blanco.
  vidrio.push(caja(0.04, 1.05, 1.8, 0, 3.425, 0))
  add(caja(0.05, 0.04, 1.84, 0, 2.9, 0), PALETA.blanco)
  add(caja(0.05, 0.04, 1.84, 0, 3.95, 0), PALETA.blanco)
  add(caja(0.05, 1.05, 0.04, 0, 3.425, -0.9), PALETA.blanco)
  add(caja(0.05, 1.05, 0.04, 0, 3.425, 0.9), PALETA.blanco)
  add(caja(0.055, 0.04, 0.59, 0, 3.05 + 0.15, 0), PALETA.blanco)
  add(caja(0.055, 0.04, 0.59, 0, 3.05 + 0.45, 0), PALETA.blanco)
  add(caja(0.055, 0.34, 0.04, 0, 3.05 + 0.3, -0.275), PALETA.blanco)
  add(caja(0.055, 0.34, 0.04, 0, 3.05 + 0.3, 0.275), PALETA.blanco)
  // Aro naranja y soporte.
  const aro = new THREE.TorusGeometry(0.225, 0.018, 6, 20)
  aro.rotateX(Math.PI / 2)
  add(en(aro, 0.375, 3.05, 0), PALETA.naranja)
  add(caja(0.16, 0.03, 0.12, 0.08, 3.05, 0), PALETA.naranja)
  const tr = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))
  for (const g of props) w.cub.add("props", g.applyMatrix4(tr))
  for (const g of vidrio) w.cub.add("vidrio", g.applyMatrix4(tr))
  // Red: tronco de cono con el tejido.
  const red = new THREE.CylinderGeometry(0.225, 0.15, 0.42, 12, 1, true)
  const uv = red.getAttribute("uv")
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 4)
  w.cub.add("red", en(red, 0.375, 2.84, 0).applyMatrix4(tr))
  if (profesional) void 0
}

function deportes(w: Mundo) {
  const lin = plano(0.064)
  const blanco = PALETA.blanco

  // ── Cancha de tenis (con los aros de básquet que agregó Obama) ──
  {
    const L = rectLugar("cancha-tenis")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    losaCancha(w, L.x0, L.x1, L.z0, L.z1, C(0x3f7a5a))
    const fondo = plano(0.062)
    fondo.rect(cx - 11.885 - 0.3, cx + 11.885 + 0.3, cz - 5.485 - 0.3, cz + 5.485 + 0.3, C(0x2c5f93))
    w.cub.add("superficie", fondo.geometria())
    const a = 0.08
    contorno(lin, cx - 11.885, cx + 11.885, cz - 5.485, cz + 5.485, a, blanco)
    lin.rect(cx - 11.885, cx + 11.885, cz - 4.115, cz - 4.115 + a, blanco)
    lin.rect(cx - 11.885, cx + 11.885, cz + 4.115 - a, cz + 4.115, blanco)
    for (const s of [-1, 1]) lin.rect(cx + s * 6.4 - a / 2, cx + s * 6.4 + a / 2, cz - 4.115, cz + 4.115, blanco)
    lin.rect(cx - 6.4, cx + 6.4, cz - a / 2, cz + a / 2, blanco)
    for (const s of [-1, 1]) lin.rect(cx + s * 11.885 - (s > 0 ? 0.2 : 0), cx + s * 11.885 + (s < 0 ? 0.2 : 0), cz - a / 2, cz + a / 2, blanco)
    // Red y postes.
    for (const s of [-1, 1]) w.cub.add("props", cil(0.04, 0.04, 1.07, 8, cx, 0.06, cz + s * 6.4), C(0x2a2d2f))
    const red = new THREE.BufferGeometry()
    const pts: number[] = []
    const uvs: number[] = []
    const seg = 16
    for (let i = 0; i < seg; i++) {
      const z0 = cz - 6.4 + (12.8 * i) / seg
      const z1 = cz - 6.4 + (12.8 * (i + 1)) / seg
      const top = (z: number) => 1.07 - 0.156 * (1 - Math.pow((z - cz) / 6.4, 2))
      pts.push(cx, 0.08, z0, cx, 0.08, z1, cx, top(z1), z1, cx, 0.08, z0, cx, top(z1), z1, cx, top(z0), z0)
      const u0 = (z0 - cz + 6.4) / 0.05, u1 = (z1 - cz + 6.4) / 0.05
      uvs.push(u0, 0, u1, 0, u1, 20, u0, 0, u1, 20, u0, 20)
    }
    red.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    red.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    red.computeVertexNormals()
    w.cub.add("red", red)
    for (let i = 0; i < seg; i++) {
      const z0 = cz - 6.4 + (12.8 * i) / seg
      const top = 1.07 - 0.156 * (1 - Math.pow((z0 + 0.4 - cz) / 6.4, 2))
      w.cub.add("props", caja(0.03, 0.06, 12.8 / seg + 0.02, cx, top, z0 + 6.4 / seg), blanco)
    }
    // Aros de básquet en los dos fondos.
    aroBasquet(w, L.x0 + 1.6, cz, 0)
    aroBasquet(w, L.x1 - 1.6, cz, Math.PI)
    // Cerco de malla con postes.
    cerco(w, L.x0 + 0.15, L.x1 - 0.15, L.z0 + 0.15, L.z1 - 0.15, 3.4, C(0x23352c))
    // Bancos al costado.
    w.bancos.push(mtx(cx - 4, 0.06, L.z0 + 1.2, Math.PI), mtx(cx + 4, 0.06, L.z0 + 1.2, Math.PI))
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Pádel: pared de vidrio al fondo, malla a los costados ──
  {
    const L = rectLugar("cancha-padel")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    losaCancha(w, L.x0, L.x1, L.z0, L.z1, C(0x2b3440))
    const cesped = plano(0.062)
    cesped.rect(cx - 10, cx + 10, cz - 5, cz + 5, C(0x2a63b8))
    w.cub.add("superficie", cesped.geometria())
    const a = 0.06
    for (const s of [-1, 1]) lin.rect(cx + s * 6.95 - a / 2, cx + s * 6.95 + a / 2, cz - 5, cz + 5, blanco)
    lin.rect(cx - 6.95, cx + 6.95, cz - a / 2, cz + a / 2, blanco)
    // Red central.
    const red = panelRed(cx, cz - 5, cx, cz + 5, 0.06, 0.88, 0.05)
    w.cub.add("red", red)
    w.cub.add("props", caja(0.03, 0.05, 10, cx, 0.9, cz), blanco)
    for (const s of [-1, 1]) w.cub.add("props", cil(0.05, 0.05, 0.92, 8, cx, 0.06, cz + s * 5.05), C(0x1d1f22))
    // Paredes: vidrio de 3 m al fondo y en los primeros 4 m de cada costado.
    const xv = [cx - 10, cx + 10]
    for (const x of xv) {
      w.cub.add("vidrio", caja(0.03, 3, 10, x, 1.56, cz))
      w.cub.add("red", panelRed(x, cz - 5, x, cz + 5, 3.06, 4.06))
    }
    for (const zc of [cz - 5, cz + 5])
      for (const s of [-1, 1]) {
        const xe = cx + s * 10
        w.cub.add("vidrio", caja(2, 3, 0.03, xe - s * 1, 1.56, zc))
        w.cub.add("vidrio", caja(2, 2, 0.03, xe - s * 3, 1.06, zc))
        w.cub.add("red", panelRed(xe - s * 4, zc, cx + s * 1.2, zc, 0.06, 3.06))
      }
    // Estructura negra: postes cada 2 m y un larguero arriba.
    const negro = C(0x15171a)
    for (let x = cx - 10; x <= cx + 10.01; x += 2)
      for (const zc of [cz - 5, cz + 5]) w.cub.add("props", caja(0.08, x === cx - 10 || x > cx + 9.9 ? 4.06 : 3.06, 0.08, x, (x === cx - 10 || x > cx + 9.9 ? 4.06 : 3.06) / 2 + 0.03, zc), negro)
    for (let z = cz - 5; z <= cz + 5.01; z += 2.5) for (const x of xv) w.cub.add("props", caja(0.08, 4.06, 0.08, x, 2.06, z), negro)
    for (const x of xv) w.cub.add("props", caja(0.08, 0.08, 10, x, 4.06, cz), negro)
    for (const zc of [cz - 5, cz + 5]) w.cub.add("props", caja(20, 0.06, 0.06, cx, 3.06, zc), negro)
    w.bancos.push(mtx(cx - 3, 0.06, L.z1 - 0.6, 0), mtx(cx + 3, 0.06, L.z1 - 0.6, 0))
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Básquet: cancha completa de 28 x 15 con líneas reales (FIBA) ──
  {
    const L = rectLugar("cancha-basquet")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    losaCancha(w, L.x0, L.x1, L.z0, L.z1, C(0x1e2b47))
    const piso = plano(0.062)
    piso.rect(cx - 14, cx + 14, cz - 7.5, cz + 7.5, C(0xc8945c))
    w.cub.add("superficie", piso.geometria())
    const pintado = plano(0.063)
    const llave = C(0x8e2f2b)
    const a = 0.08
    contorno(lin, cx - 14, cx + 14, cz - 7.5, cz + 7.5, a, blanco)
    lin.rect(cx - a / 2, cx + a / 2, cz - 7.5, cz + 7.5, blanco)
    pintado.disco(cx, cz, 1.8, llave, 40)
    lin.arco(cx, cz, 1.8 - a, 1.8, 0, Math.PI * 2, blanco, 48)
    for (const s of [-1, 1]) {
      const fondo = cx + s * 14
      const aro = fondo - s * 1.575
      // Zona pintada (llave) y su contorno.
      const xA = Math.min(fondo, fondo - s * 5.8)
      const xB = Math.max(fondo, fondo - s * 5.8)
      pintado.rect(xA, xB, cz - 2.45, cz + 2.45, llave)
      contorno(lin, xA, xB, cz - 2.45, cz + 2.45, a, blanco)
      // Círculo de tiro libre y semicírculo de no carga.
      const tl = fondo - s * 5.8
      lin.arco(tl, cz, 1.8 - a, 1.8, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2, blanco, 28)
      lin.arco(aro, cz, 1.25 - a, 1.25, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2, blanco, 20)
      // Línea de tres: arco de 6,75 m y rectas a 0,9 m de las bandas.
      const th = Math.asin(6.6 / 6.75)
      const c0 = s > 0 ? Math.PI - th : -th
      const c1 = s > 0 ? Math.PI + th : th
      lin.arco(aro, cz, 6.75 - a, 6.75, c0, c1, blanco, 48)
      const xr = aro - s * 6.75 * Math.cos(th)
      for (const sz of [-1, 1]) lin.rect(Math.min(fondo, xr), Math.max(fondo, xr), cz + sz * 6.6 - a / 2, cz + sz * 6.6 + a / 2, blanco)
      aroBasquet(w, fondo - s * 1.2, cz, s > 0 ? Math.PI : 0)
    }
    w.cub.add("superficie", pintado.geometria())
    w.bancos.push(mtx(cx - 3.5, 0.06, L.z0 + 0.25, Math.PI), mtx(cx + 3.5, 0.06, L.z0 + 0.25, Math.PI))
    // Un balón junto al banco.
    w.cub.add("props", esfera(0.12, cx - 1.5, 0.18, L.z0 + 0.4), PALETA.naranja)
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Gimnasio al aire libre ──
  {
    const L = rectLugar("gimnasio-aire")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    losaCancha(w, L.x0 + 0.5, L.x1 - 0.5, L.z0 + 0.5, L.z1 - 0.5, C(0x2a2e33), 0.05)
    const bordes = plano(0.053)
    contorno(bordes, L.x0 + 0.5, L.x1 - 0.5, L.z0 + 0.5, L.z1 - 0.5, 0.15, C(0xe0641a))
    w.cub.add("superficie", bordes.geometria())
    const ac = C(0x56606a)
    const ng = C(0x17181a)
    const P = (g: THREE.BufferGeometry, k: THREE.Color) => w.cub.add("props", g, k)
    // Barras de dominadas (tres alturas).
    const xb = L.x0 + 3
    for (let i = 0; i < 4; i++) P(cil(0.06, 0.06, 2.6, 8, xb + i * 1.4, 0.05, L.z0 + 2), ac)
    for (let i = 0; i < 3; i++) P(barra(new THREE.Vector3(xb + i * 1.4, 2.0 + i * 0.25, L.z0 + 2), new THREE.Vector3(xb + (i + 1) * 1.4, 2.0 + i * 0.25, L.z0 + 2), 0.025), ac)
    // Paralelas.
    for (const dz of [-0.3, 0.3]) {
      P(barra(new THREE.Vector3(xb, 1.2, L.z0 + 5 + dz), new THREE.Vector3(xb + 2.4, 1.2, L.z0 + 5 + dz), 0.03), ac)
      for (const dx of [0, 2.4]) P(cil(0.05, 0.05, 1.2, 8, xb + dx, 0.05, L.z0 + 5 + dz), ac)
    }
    // Escalera horizontal.
    for (const dz of [-0.35, 0.35]) {
      P(barra(new THREE.Vector3(xb, 2.3, L.z0 + 8 + dz), new THREE.Vector3(xb + 4, 2.3, L.z0 + 8 + dz), 0.035), ac)
      for (const dx of [0, 4]) P(cil(0.06, 0.06, 2.3, 8, xb + dx, 0.05, L.z0 + 8 + dz), ac)
    }
    for (let i = 1; i < 10; i++) P(barra(new THREE.Vector3(xb + i * 0.4, 2.3, L.z0 + 7.65), new THREE.Vector3(xb + i * 0.4, 2.3, L.z0 + 8.35), 0.02), ac)
    // Jaula de sentadillas con barra y discos.
    const xj = L.x1 - 5
    const zj = L.z0 + 3.5
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) P(caja(0.08, 2.3, 0.08, xj + dx, 1.2, zj + dz), ng)
    for (const dz of [-0.6, 0.6]) P(caja(1.28, 0.08, 0.08, xj, 2.32, zj + dz), ng)
    for (const dx of [-0.6, 0.6]) P(caja(0.08, 0.08, 1.28, xj + dx, 2.32, zj), ng)
    P(barra(new THREE.Vector3(xj - 1.1, 1.4, zj), new THREE.Vector3(xj + 1.1, 1.4, zj), 0.016), PALETA.aceroClaro)
    for (const dx of [-0.85, -0.78, 0.78, 0.85]) {
      const d = new THREE.CylinderGeometry(0.225, 0.225, 0.05, 18)
      d.rotateZ(Math.PI / 2)
      P(en(d, xj + dx, 1.4, zj), C(0xb3261e))
    }
    // Bancos planos y mancuernas.
    for (let i = 0; i < 3; i++) {
      const bx = L.x1 - 8.5 + i * 2.2
      const bz = L.z0 + 9
      P(caja(0.32, 0.1, 1.2, bx, 0.45, bz), ng)
      for (const dz of [-0.45, 0.45]) P(caja(0.28, 0.4, 0.06, bx, 0.25, bz + dz), ac)
    }
    const xr = L.x1 - 2
    P(caja(0.6, 0.06, 2.6, xr, 0.55, cz + 4), ac)
    P(caja(0.6, 0.06, 2.6, xr, 0.85, cz + 4), ac)
    for (const dz of [-1.2, 1.2]) P(caja(0.06, 0.9, 0.06, xr, 0.45, cz + 4 + dz), ac)
    for (let i = 0; i < 6; i++)
      for (const [hy, rr] of [[0.6, 0.06 + i * 0.008], [0.9, 0.05 + i * 0.007]] as const) {
        const zz = cz + 3 + i * 0.4
        const m = new THREE.CylinderGeometry(rr, rr, 0.3, 10)
        m.rotateX(Math.PI / 2)
        P(en(m, xr, hy + rr, zz), ng)
      }
    // Pesas rusas y cajones de salto.
    for (let i = 0; i < 4; i++) {
      P(esfera(0.13 + i * 0.015, cx - 2 + i * 0.6, 0.18 + i * 0.015, L.z1 - 2.2), ng)
      const asa = new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI)
      P(en(asa, cx - 2 + i * 0.6, 0.3 + i * 0.03, L.z1 - 2.2), ng)
    }
    for (const [i, h] of [0.45, 0.6, 0.75].entries()) P(caja(0.6, h, 0.75, cx + 2.5 + i * 0.9, 0.05 + h / 2, L.z1 - 2.5), PALETA.maderaClara)
    w.bancos.push(mtx(L.x0 + 1.2, 0, cz + 4, Math.PI / 2))
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Piscina (la de Ford, 1975): solárium de piedra, agua turquesa ──
  {
    const L = rectLugar("piscina")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    const px0 = cx - 5.5, px1 = cx + 5.5, pz0 = cz - 2.6, pz1 = cz + 2.6
    const yS = 0.18
    for (const [x0, x1, z0, z1] of [[L.x0, L.x1, L.z0, pz0], [L.x0, L.x1, pz1, L.z1], [L.x0, px0, pz0, pz1], [px1, L.x1, pz0, pz1]])
      w.cub.add("pavimento", losa(x0, x1, z0, z1, -0.05, yS), PALETA.piedraCalida)
    // Remate de piedra blanca alrededor del agua.
    for (const [x0, x1, z0, z1] of [[px0 - 0.4, px1 + 0.4, pz0 - 0.4, pz0], [px0 - 0.4, px1 + 0.4, pz1, pz1 + 0.4], [px0 - 0.4, px0, pz0, pz1], [px1, px1 + 0.4, pz0, pz1]])
      w.cub.add("piedra", losa(x0, x1, z0, z1, yS - 0.02, yS + 0.05), PALETA.piedraClara)
    // Paredes interiores de azulejo.
    for (const [x0, x1, z0, z1] of [[px0, px1, pz0, pz0 + 0.02], [px0, px1, pz1 - 0.02, pz1], [px0, px0 + 0.02, pz0, pz1], [px1 - 0.02, px1, pz0, pz1]])
      w.cub.add("superficie", losa(x0, x1, z0, z1, -0.6, yS), C(0x7fd0da))
    const agua = new THREE.PlaneGeometry(px1 - px0, pz1 - pz0, 1, 1)
    agua.rotateX(-Math.PI / 2)
    const ma = new THREE.Mesh(en(agua, cx, yS - 0.07, cz), w.M.piscina)
    ma.name = "paisaje-piscina"
    if (w.ctx.sombras) ma.receiveShadow = true
    w.raiz.add(ma)
    // Reposeras blancas y dos sombrillas.
    for (let i = 0; i < 4; i++) {
      const rx = L.x0 + 2.4 + i * 3.4
      const rz = L.z1 - 1.35
      w.cub.add("props", caja(0.7, 0.12, 1.7, rx, yS + 0.32, rz, 0), PALETA.blanco)
      w.cub.add("props", en(new THREE.BoxGeometry(0.7, 0.1, 0.7), rx, yS + 0.62, rz - 0.95, 0, -0.9), PALETA.blanco)
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.7, 0.7]) w.cub.add("props", caja(0.04, 0.26, 0.04, rx + dx, yS + 0.13, rz + dz), PALETA.aceroClaro)
    }
    for (const sx of [L.x0 + 1.2, L.x1 - 1.2]) sombrilla(w, sx, L.z0 + 1.2, yS, C(0xf2efe6))
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Green de golf (Eisenhower, 1954): green, antegreen, bunker, hoyo y bandera ──
  {
    const L = rectLugar("golf")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    const g = plano(0.035)
    g.mancha(cx, cz, 6.4, 5.4, C(0x4d8a2c), 11, 36, 0.12)
    w.cub.add("superficie", g.geometria())
    const gg = plano(0.045)
    gg.mancha(cx + 0.2, cz - 0.1, 5.4, 4.4, C(0x6aa83e), 11, 36, 0.12)
    w.cub.add("superficie", gg.geometria())
    const b = plano(0.05)
    b.mancha(cx - 5.2, cz + 3.6, 1.8, 1.15, C(0xe2d3a8), 5, 24, 0.2)
    w.cub.add("superficie", b.geometria())
    const hx = cx + 1.8
    const hz = cz - 1.2
    const hoyo = plano(0.052)
    hoyo.disco(hx, hz, 0.11, C(0x0e0e0e), 16)
    w.cub.add("pintura", hoyo.geometria())
    w.cub.add("props", cil(0.012, 0.012, 2.2, 6, hx, 0.04, hz), PALETA.blanco)
    const flag = new THREE.BufferGeometry()
    flag.setAttribute("position", new THREE.Float32BufferAttribute([hx, 2.24, hz, hx + 0.55, 2.06, hz + 0.05, hx, 1.88, hz], 3))
    flag.computeVertexNormals()
    w.cub.add("props", flag, C(0xd62828))
    const flag2 = flag.clone()
    const pp = flag2.getAttribute("position")
    pp.setXYZ(1, pp.getX(2), pp.getY(2), pp.getZ(2))
    pp.setXYZ(2, hx + 0.55, 2.06, hz + 0.05)
    flag2.computeVertexNormals()
    w.cub.add("props", flag2, C(0xd62828))
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Parque (este): sendero en lazo, cantero central, bancos y faroles ──
  {
    const L = rectLugar("parque")
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    const lazo = elipse(cx, cz, 10.5, 9.5, 64)
    camino(w, lazo, 2.4, "grava", false)
    camino(w, [[41, 70], [cx - 10.5, 70]], 2.2, "grava", false)
    camino(w, [[cx + 10.5, cz], [L.x1 - 0.5, cz]], 2.2, "grava", false)
    cantero(w, (pl) => pl.disco(cx, cz, 3.6, PALETA.tierra, 40))
    for (let i = 0; i < 3; i++) {
      const rr = 1.0 + i * 0.85
      const n = Math.max(6, Math.floor((2 * Math.PI * rr) / 0.48))
      for (let j = 0; j < n; j++) {
        const t = (j / n) * Math.PI * 2
        sembrarFlor(w, cx + Math.cos(t) * rr, cz + Math.sin(t) * rr, [C(0xd6336c), C(0xf4f1ea), C(0x8e44ad)][i])
      }
    }
    // Bebedero de pájaros en el centro.
    w.cub.add("piedra", cil(0.25, 0.18, 0.8, 12, cx, 0, cz), PALETA.piedraClara)
    w.cub.add("piedra", cil(0.55, 0.62, 0.12, 16, cx, 0.8, cz), PALETA.piedraClara)
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2 + 0.3
      const bx = cx + Math.cos(t) * 12.4
      const bz = cz + Math.sin(t) * 11.4
      w.bancos.push(mtx(bx, 0, bz, Math.atan2(-(cz - bz), cx - bx) - Math.PI / 2))
    }
    for (const t of [0.95, 2.5, 4.0, 5.55]) w.faroles.push({ x: cx + Math.cos(t) * 9.0, z: cz + Math.sin(t) * 8.0, y: 0, ry: 0 })
    // Árboles del parque: alrededor del lazo.
    const r = azar(404)
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * Math.PI * 2 + r() * 0.3
      const x = cx + Math.cos(t) * entre(r, 13.5, 15.5)
      const z = cz + Math.sin(t) * entre(r, 12.5, 14)
      if (x > L.x1 - 1 || z < L.z0 + 1 || z > L.z1 - 1 || x < 44) continue
      w.arboles.push({ x, z, s: entre(r, 0.7, 1.0), tipo: r() < 0.3 ? "magnolia" : "roble", tono: tonoCopa(r, 0.12) })
    }
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  // ── Jardín de las Rosas: patio de piedra (2025), rosales y manzanos ──
  {
    const L = rectLugar("rosas")
    const patio = plano(Y.camino + 0.01)
    patio.rect(L.x0 + 1.8, L.x1 - 1.8, L.z0 + 1.8, L.z1 - 1.8, PALETA.piedraClara)
    w.cub.add("caminoPiedra", patio.geometria())
    cantero(w, (pl) => {
      pl.rect(L.x0, L.x1, L.z0, L.z0 + 1.8, PALETA.tierra)
      pl.rect(L.x0, L.x1, L.z1 - 1.8, L.z1, PALETA.tierra)
      pl.rect(L.x0, L.x0 + 1.8, L.z0 + 1.8, L.z1 - 1.8, PALETA.tierra)
      pl.rect(L.x1 - 1.8, L.x1, L.z0 + 1.8, L.z1 - 1.8, PALETA.tierra)
    })
    // Bordillo de boj bajo alrededor del patio.
    seto(w, [[L.x0 + 1.75, L.z0 + 1.75], [L.x1 - 1.75, L.z0 + 1.75], [L.x1 - 1.75, L.z1 - 1.75], [L.x0 + 1.75, L.z1 - 1.75], [L.x0 + 1.75, L.z0 + 1.75]], 0.38, 0.35)
    // Rosales rojos y rosados en dos filas por cantero.
    const rosas = [C(0xc0111f), C(0xe75480), C(0xd81b3c), C(0xf28bb0)]
    let k = 0
    const fila = (x0: number, z0: number, x1: number, z1: number) => {
      const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 0.6)
      for (let i = 0; i <= n; i++) {
        const t = i / n
        sembrarFlor(w, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, rosas[k++ % rosas.length], 1.25)
      }
    }
    for (const d of [0.55, 1.25]) {
      fila(L.x0 + 0.5, L.z0 + d, L.x1 - 0.5, L.z0 + d)
      fila(L.x0 + 0.5, L.z1 - d, L.x1 - 0.5, L.z1 - d)
      fila(L.x0 + d, L.z0 + 2.2, L.x0 + d, L.z1 - 2.2)
      fila(L.x1 - d, L.z0 + 2.2, L.x1 - d, L.z1 - 2.2)
    }
    // Manzanos ornamentales en las esquinas y a mitad de los lados largos.
    const r = azar(1913)
    for (const [x, z] of [[L.x0 + 0.9, L.z0 + 0.9], [L.x1 - 0.9, L.z0 + 0.9], [L.x0 + 0.9, L.z1 - 0.9], [L.x1 - 0.9, L.z1 - 0.9], [(L.x0 + L.x1) / 2, L.z0 + 0.9], [(L.x0 + L.x1) / 2, L.z1 - 0.9]] as P2[])
      w.arboles.push({ x, z, s: entre(r, 0.32, 0.38), tipo: "chico", tono: C(0x6f9a3a).offsetHSL(0, 0, entre(r, -0.03, 0.03)) })
    // Mesas con sombrillas en el patio.
    const cx = (L.x0 + L.x1) / 2
    const cz = (L.z0 + L.z1) / 2
    for (const [dx, dz] of [[-4.5, -2.6], [0, -2.6], [4.5, -2.6], [-4.5, 2.6], [0, 2.6], [4.5, 2.6]]) {
      const x = cx + dx
      const z = cz + dz
      w.cub.add("props", cil(0.45, 0.45, 0.04, 16, x, 0.72, z), PALETA.blanco)
      w.cub.add("props", cil(0.04, 0.04, 0.72, 6, x, 0.04, z), PALETA.negro)
      sombrilla(w, x, z, 0, C(0xf4e7b0))
      for (let i = 0; i < 4; i++) {
        const t = (i / 4) * Math.PI * 2 + Math.PI / 4
        w.cub.add("props", caja(0.42, 0.06, 0.42, x + Math.cos(t) * 0.8, 0.45, z + Math.sin(t) * 0.8), PALETA.blanco)
        w.cub.add("props", caja(0.04, 0.45, 0.04, x + Math.cos(t) * 0.8, 0.23, z + Math.sin(t) * 0.8), PALETA.negro)
      }
    }
    ocupaRect(w, L.x0, L.x1, L.z0, L.z1)
  }

  w.cub.add("pintura", lin.geometria())
}

function sombrilla(w: Mundo, x: number, z: number, y: number, k: THREE.Color) {
  w.cub.add("props", cil(0.025, 0.025, 2.4, 6, x, y, z), PALETA.blanco)
  const tela = new THREE.ConeGeometry(1.35, 0.45, 12, 1, true)
  w.cub.add("props", en(tela, x, y + 2.35, z), k)
  const bajo = new THREE.ConeGeometry(1.35, 0.45, 12, 1, true)
  bajo.scale(1, 1, 1)
  const idx = bajo.index
  if (idx) for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i)
    idx.setX(i, idx.getX(i + 1))
    idx.setX(i + 1, a)
  }
  w.cub.add("props", en(bajo, x, y + 2.34, z), k.clone().multiplyScalar(0.8))
}

/** Cerco de malla con postes alrededor de un rectángulo. */
function cerco(w: Mundo, x0: number, x1: number, z0: number, z1: number, alto: number, k: THREE.Color) {
  const lados: Array<[number, number, number, number]> = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]
  for (const [ax, az, bx, bz] of lados) {
    w.cub.add("red", panelRed(ax, az, bx, bz, 0.06, alto))
    const L = Math.hypot(bx - ax, bz - az)
    const n = Math.round(L / 3)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      w.cub.add("props", cil(0.045, 0.045, alto + 0.06, 6, ax + (bx - ax) * t, 0, az + (bz - az) * t), k)
    }
    w.cub.add("props", barra(new THREE.Vector3(ax, alto, az), new THREE.Vector3(bx, alto, bz), 0.03, 0.03, 5), k)
  }
}

// ══════════════════════════════════════════════════════════════
// La reja negra: barrotes con punta, zócalo de piedra, pilares y portones
// ══════════════════════════════════════════════════════════════

const ALTO_REJA = 3.6

function reja(w: Mundo) {
  // Huecos de los portones: donde el grafo cruza la reja y donde entra la entrada de autos.
  const E = ENTRADA_NORTE
  const huecos: Record<"n" | "s" | "o" | "e", Array<[number, number]>> = {
    n: [[-E.rx - E.ancho / 2 - 0.5, -E.rx + E.ancho / 2 + 0.5], [-5, 5], [E.rx - E.ancho / 2 - 0.5, E.rx + E.ancho / 2 + 0.5]],
    s: [[-5, 5]],
    o: [[-23, -17], [11, 17]],
    e: [[-23, -17], [15, 21]],
  }
  const lados: Array<{ id: "n" | "s" | "o" | "e"; a: P2; b: P2 }> = [
    { id: "n", a: [R.x0, R.z0], b: [R.x1, R.z0] },
    { id: "s", a: [R.x0, R.z1], b: [R.x1, R.z1] },
    { id: "o", a: [R.x0, R.z0], b: [R.x0, R.z1] },
    { id: "e", a: [R.x1, R.z0], b: [R.x1, R.z1] },
  ]
  const barrotes: THREE.Matrix4[] = []
  const pilares: THREE.Matrix4[] = []
  const paso = 0.17
  for (const L of lados) {
    const largo = L.id === "n" || L.id === "s" ? R.x1 - R.x0 : R.z1 - R.z0
    const s0 = L.id === "n" || L.id === "s" ? R.x0 : R.z0
    const pos = (s: number): P2 => (L.id === "n" || L.id === "s" ? [s, L.a[1]] : [L.a[0], s])
    const tramosLibres: Array<[number, number]> = []
    let desde = s0
    for (const [h0, h1] of [...huecos[L.id]].sort((p, q) => p[0] - q[0])) {
      tramosLibres.push([desde, h0])
      desde = h1
    }
    tramosLibres.push([desde, s0 + largo])
    for (const [t0, t1] of tramosLibres) {
      // Zócalo de piedra y los dos travesaños.
      const [ax, az] = pos(t0)
      const [bx, bz] = pos(t1)
      const zx = L.id === "n" || L.id === "s"
      const z0 = zx ? losa(ax, bx, az - 0.3, az + 0.3, -0.05, 0.42) : losa(ax - 0.3, ax + 0.3, az, bz, -0.05, 0.42)
      w.cub.add("piedra", z0, PALETA.granito)
      for (const hy of [0.62, ALTO_REJA - 0.25]) {
        const g = zx ? losa(ax, bx, az - 0.03, az + 0.03, hy, hy + 0.07) : losa(ax - 0.03, ax + 0.03, az, bz, hy, hy + 0.07)
        w.cub.add("hierro", g)
      }
      // Pilares en los extremos de cada tramo y cada ~30 m.
      const n = Math.max(1, Math.round((t1 - t0) / 30))
      for (let i = 0; i <= n; i++) {
        const [px, pz] = pos(t0 + ((t1 - t0) * i) / n)
        pilares.push(mtx(px, 0, pz))
      }
      for (let s = t0 + 0.6; s < t1 - 0.5; s += paso) {
        const [x, z] = pos(s)
        barrotes.push(mtx(x, 0.42, z, zx ? 0 : Math.PI / 2))
      }
    }
    // Faroles sobre los pilares de cada portón.
    for (const [h0, h1] of huecos[L.id])
      for (const s of [h0, h1]) {
        const [px, pz] = pos(s)
        w.globos.push(mtx(px, 5.25, pz))
        w.cub.add("hierro", cil(0.12, 0.2, 0.32, 8, px, 4.88, pz))
      }
  }
  // Barrote: cuadrado de 3,5 cm con punta de lanza.
  const bar = new THREE.BoxGeometry(0.035, ALTO_REJA - 0.42, 0.035)
  bar.translate(0, (ALTO_REJA - 0.42) / 2, 0)
  const punta = new THREE.ConeGeometry(0.045, 0.24, 4, 1)
  punta.rotateY(Math.PI / 4)
  punta.translate(0, ALTO_REJA - 0.42 + 0.12, 0)
  const anillo = new THREE.BoxGeometry(0.06, 0.05, 0.06)
  anillo.translate(0, ALTO_REJA - 0.44, 0)
  w.raiz.add(instanciar(w, unir([bar, punta, anillo]), w.M.hierro, barrotes, undefined, "reja-barrotes", true, false))

  // Pilar de piedra: zócalo, fuste, cornisa y remate.
  const pil = unir([
    caja(1.05, 0.6, 1.05, 0, 0.3, 0),
    caja(0.82, 3.9, 0.82, 0, 2.5, 0),
    caja(1.12, 0.22, 1.12, 0, 4.55, 0),
    caja(0.92, 0.14, 0.92, 0, 4.73, 0),
  ])
  w.raiz.add(instanciar(w, pil, w.M.piedraPilar, pilares, undefined, "reja-pilares", true, true))

  w.ocupado.push({ tipo: "rect", x0: R.x0 - 2.5, x1: R.x0 + 2.5, z0: R.z0, z1: R.z1 })
  w.ocupado.push({ tipo: "rect", x0: R.x1 - 2.5, x1: R.x1 + 2.5, z0: R.z0, z1: R.z1 })
  w.ocupado.push({ tipo: "rect", x0: R.x0, x1: R.x1, z0: R.z0 - 2.5, z1: R.z0 + 2.5 })
  w.ocupado.push({ tipo: "rect", x0: R.x0, x1: R.x1, z0: R.z1 - 2.5, z1: R.z1 + 2.5 })

  // Arbustos al pie de la reja, por dentro (en el norte solo en las esquinas).
  const r = azar(5150)
  const fila = (a: P2, b: P2, salto: number) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    for (let s = 2; s < L - 2; s += entre(r, 2.2, 3.4)) {
      const x = a[0] + ((b[0] - a[0]) * s) / L
      const z = a[1] + ((b[1] - a[1]) * s) / L
      if (r() < salto) continue
      if (!libreDeHuecos(x, z)) continue
      const sc = entre(r, 0.9, 1.5)
      w.arbustos.push({ m: mtx(x, 0, z, r() * 6.28, sc, sc * entre(r, 0.8, 1.05)), c: C(0x31542a).offsetHSL(entre(r, -0.02, 0.02), 0, entre(r, -0.05, 0.04)) })
    }
  }
  const libreDeHuecos = (x: number, z: number) => {
    if (Math.abs(z - R.z0) < 3) return !huecos.n.some(([a, b]) => x > a - 2 && x < b + 2) && Math.abs(x) > 52
    if (Math.abs(z - R.z1) < 3) return !huecos.s.some(([a, b]) => x > a - 2 && x < b + 2)
    if (Math.abs(x - R.x0) < 3) return !huecos.o.some(([a, b]) => z > a - 2 && z < b + 2)
    if (Math.abs(x - R.x1) < 3) return !huecos.e.some(([a, b]) => z > a - 2 && z < b + 2)
    return true
  }
  fila([R.x0 + 1.6, R.z0 + 1.6], [R.x1 - 1.6, R.z0 + 1.6], 0.1)
  fila([R.x0 + 1.6, R.z1 - 1.6], [R.x1 - 1.6, R.z1 - 1.6], 0.15)
  fila([R.x0 + 1.6, R.z0 + 1.6], [R.x0 + 1.6, R.z1 - 1.6], 0.2)
  fila([R.x1 - 1.6, R.z0 + 1.6], [R.x1 - 1.6, R.z1 - 1.6], 0.2)

  // Faroles de Pennsylvania Avenue, contra la reja y del lado del parque.
  for (let x = -165; x <= 155; x += 16) {
    if (!huecos.n.some(([a, b]) => x > a - 1.5 && x < b + 1.5)) w.faroles.push({ x, z: R.z0 - 1.6, y: 0.045, ry: 0 })
    w.faroles.push({ x: x + 8, z: -88.3, y: 0.045, ry: 0 })
  }
  // Árboles chicos y bancos a lo largo del lado norte de Pennsylvania Ave.
  for (let x = -160; x <= 150; x += 11) {
    if (Math.abs(x) < 6) continue
    w.arboles.push({ x, z: -86.6, s: entre(r, 0.5, 0.62), tipo: "chico", tono: tonoCopa(r, 0.03) })
    const cuadro = plano(0.05)
    cuadro.rect(x - 0.9, x + 0.9, -87.5, -85.7, PALETA.tierra)
    w.cub.add("superficie", cuadro.geometria())
  }
  for (let x = -150; x <= 150; x += 22) if (Math.abs(x) > 8) w.bancos.push(mtx(x + 5.5, 0.045, -85.8, Math.PI))
  // Faroles en la vereda de E Street, junto a la reja sur.
  for (let x = -90; x <= 90; x += 18) w.faroles.push({ x, z: R.z1 + 4.2, y: 0, ry: 0 })
  for (let x = -88; x <= 88; x += 12) if (Math.abs(x) > 7) w.arboles.push({ x, z: R.z1 + 2.6, s: entre(r, 0.75, 1.0), tipo: "roble", tono: tonoCopa(r, 0.06) })
}

// ══════════════════════════════════════════════════════════════
// Parque Lafayette: caminos, fuentes, la estatua de Jackson
// ══════════════════════════════════════════════════════════════

const LAF = { cx: 0, cz: -127.5 }

function lafayette(w: Mundo) {
  const L = rectLugar("lafayette")
  const { cx, cz } = LAF
  // Plaza oval de la estatua y caminos: el eje norte-sur, el este-oeste y diagonales curvas.
  const plaza = plano(Y.camino)
  plaza.disco(cx, cz, 10.5, PALETA.ladrillo, 48)
  w.cub.add("caminoPiedra", plaza.geometria())
  ocupaCirc(w, cx, cz, 11)
  camino(w, [[cx, L.z1], [cx, cz + 10]], 4, "ladrillo", false)
  camino(w, [[cx, cz - 10], [cx, L.z0]], 4, "ladrillo", false)
  camino(w, [[L.x0, cz], [cx - 10, cz]], 3.2, "ladrillo", false)
  camino(w, [[cx + 10, cz], [L.x1, cz]], 3.2, "ladrillo", false)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      camino(w, [[cx + sx * 7.5, cz + sz * 7.5], [cx + sx * 22, cz + sz * 15], [cx + sx * 40, cz + sz * 24], [cx + sx * (L.x1 - 1), cz + sz * 36.5]], 2.8, "ladrillo")
  // Dos fuentes sobre el eje este-oeste.
  for (const sx of [-1, 1]) {
    const fx = cx + sx * 31
    const pl = plano(Y.camino)
    pl.disco(fx, cz, 7.2, PALETA.ladrillo, 40)
    w.cub.add("caminoPiedra", pl.geometria())
    fuente(w, fx, cz, 4.2, { cuenco: 1.0, altoCuenco: 0.9 })
    w.chorros.push({ x: fx, z: cz, y: 1.15, alto: 2.2, radio: 1.2, caida: 1.0 })
    ocupaCirc(w, fx, cz, 8)
  }

  // Estatua ecuestre de Andrew Jackson (Clark Mills, 1853): el caballo encabritado
  // se sostiene solo sobre las patas traseras.
  const ped: THREE.BufferGeometry[] = [
    caja(7.4, 0.45, 5.0, 0, 0.225, 0),
    caja(6.4, 0.4, 4.0, 0, 0.65, 0),
    caja(5.0, 2.6, 2.7, 0, 2.15, 0),
    caja(5.5, 0.35, 3.1, 0, 3.6, 0),
    caja(4.8, 0.2, 2.5, 0, 3.87, 0),
  ]
  for (const g of ped) w.cub.add("piedra", en(g, cx, 0, cz), PALETA.piedraClara)
  // Cerca baja de hierro alrededor del pedestal.
  const rejaBaja: THREE.BufferGeometry[] = []
  for (const [ax, az, bx, bz] of [[-4.6, -3.4, 4.6, -3.4], [4.6, -3.4, 4.6, 3.4], [4.6, 3.4, -4.6, 3.4], [-4.6, 3.4, -4.6, -3.4]]) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.22)
    for (let i = 0; i <= n; i++) rejaBaja.push(caja(0.025, 1.0, 0.025, cx + ax + ((bx - ax) * i) / n, 0.5, cz + az + ((bz - az) * i) / n))
    rejaBaja.push(barra(new THREE.Vector3(cx + ax, 0.95, cz + az), new THREE.Vector3(cx + bx, 0.95, cz + bz), 0.03, 0.03, 4))
  }
  for (const g of rejaBaja) w.cub.add("hierro", g)
  // Cuatro cañones en las esquinas (los reales son españoles, capturados por Jackson).
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const b = barra(new THREE.Vector3(cx + sx * 3.3, 0.55, cz + sz * 2.4), new THREE.Vector3(cx + sx * 4.4, 0.75, cz + sz * 3.2), 0.16, 0.11, 10)
      w.cub.add("bronce", b)
      w.cub.add("bronce", en(new THREE.SphereGeometry(0.17, 8, 6), cx + sx * 3.3, 0.55, cz + sz * 2.4))
      w.cub.add("props", caja(0.6, 0.35, 0.5, cx + sx * 3.5, 0.18, cz + sz * 2.55), C(0x2a2622))
    }
  const estatua = jackson()
  estatua.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx - 1.3, 3.97, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new THREE.Vector3(1.25, 1.25, 1.25)))
  w.cub.add("bronce", estatua)
  // Las otras cuatro estatuas en las esquinas (Lafayette, Rochambeau, Kościuszko, von Steuben).
  for (const [x, z, ry] of [[L.x0 + 6, L.z1 - 6, -0.8], [L.x1 - 6, L.z1 - 6, 0.8], [L.x0 + 6, L.z0 + 6, -2.3], [L.x1 - 6, L.z0 + 6, 2.3]] as const) {
    w.cub.add("piedra", caja(2.6, 0.4, 2.6, x, 0.2, z), PALETA.granito)
    w.cub.add("piedra", caja(2.0, 3.0, 2.0, x, 1.9, z), PALETA.piedraClara)
    w.cub.add("piedra", caja(2.3, 0.25, 2.3, x, 3.5, z), PALETA.piedraClara)
    const f = figura()
    f.applyMatrix4(mtx(x, 3.62, z, ry, 1.3))
    w.cub.add("bronce", f)
    ocupaCirc(w, x, z, 3)
  }

  // Bancos y faroles a lo largo de los caminos.
  for (const sz of [-1, 1])
    for (let d = 14; d < 36; d += 7) {
      w.bancos.push(mtx(cx + 2.8, 0, cz + sz * d, Math.PI / 2))
      w.bancos.push(mtx(cx - 2.8, 0, cz + sz * d, -Math.PI / 2))
    }
  for (const sx of [-1, 1]) for (const d of [16, 44]) w.bancos.push(mtx(cx + sx * d, 0, cz + 2.6, Math.PI))
  for (const sz of [-1, 1]) for (const d of [12, 26]) {
    w.faroles.push({ x: cx + 3, z: cz + sz * d, y: 0, ry: 0 })
    w.faroles.push({ x: cx - 3, z: cz + sz * (d + 7), y: 0, ry: 0 })
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.faroles.push({ x: cx + sx * 11.5, z: cz + sz * 9, y: 0, ry: 0 })

  // Árboles grandes por todo el parque (muestreo con distancia mínima).
  const r = azar(1853)
  sembrarArboles(w, r, L.x0 + 3, L.x1 - 3, L.z0 + 3, L.z1 - 3, 11, 260, () => (r() < 0.25 ? "olmo" : r() < 0.2 ? "magnolia" : "roble"), 0.85, 1.35)
  // Seto bajo en el borde del parque contra Pennsylvania Ave.
  seto(w, [[L.x0 + 1, L.z1 - 0.8], [cx - 3.2, L.z1 - 0.8]], 0.7, 0.9)
  seto(w, [[cx + 3.2, L.z1 - 0.8], [L.x1 - 1, L.z1 - 0.8]], 0.7, 0.9)
}

/** Caballo encabritado y jinete con el sombrero en alto. El caballo mira a +x. */
function jackson(): THREE.BufferGeometry {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const p: THREE.BufferGeometry[] = []
  const hueso = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0) => {
    p.push(barra(a, b, r0, r1, 8))
    p.push(en(new THREE.SphereGeometry(r1 * 1.05, 8, 6), b.x, b.y, b.z))
  }
  // Cuerpo inclinado unos 38° (las manos arriba).
  const cuerpo = new THREE.SphereGeometry(1, 16, 10)
  cuerpo.scale(1.15, 0.5, 0.42)
  en(cuerpo, 0.55, 1.75, 0, 0, 0, 0.66)
  p.push(cuerpo)
  // Ancas.
  p.push(esfera(0.48, -0.2, 1.3, 0, 1.15, 1, 0.95, 12, 8))
  // Patas traseras apoyadas en el pedestal.
  for (const z of [-0.2, 0.2]) {
    hueso(V(-0.15, 1.2, z), V(-0.25, 0.62, z * 1.1), 0.17, 0.09)
    hueso(V(-0.25, 0.62, z * 1.1), V(0.05, 0.08, z * 1.1), 0.08, 0.06)
    p.push(caja(0.2, 0.1, 0.14, 0.08, 0.05, z * 1.1))
  }
  // Manos levantadas y dobladas.
  for (const [z, k] of [[-0.18, 0], [0.18, 0.15]] as const) {
    hueso(V(1.15, 2.05, z), V(1.55 + k, 1.75, z), 0.13, 0.07)
    hueso(V(1.55 + k, 1.75, z), V(1.45 + k, 1.3, z), 0.06, 0.055)
  }
  // Cuello y cabeza.
  hueso(V(1.05, 2.3, 0), V(1.45, 3.05, 0), 0.3, 0.17)
  const cabeza = new THREE.SphereGeometry(1, 10, 8)
  cabeza.scale(0.36, 0.17, 0.15)
  en(cabeza, 1.62, 3.0, 0, 0, 0, -0.6)
  p.push(cabeza)
  p.push(caja(0.1, 0.18, 0.05, 1.45, 3.25, -0.06), caja(0.1, 0.18, 0.05, 1.45, 3.25, 0.06))
  // Cola.
  hueso(V(-0.62, 1.45, 0), V(-0.95, 0.9, 0), 0.12, 0.08)
  hueso(V(-0.95, 0.9, 0), V(-1.0, 0.35, 0), 0.08, 0.11)
  // Jinete: piernas a los costados, torso, cabeza, brazo en alto con el sombrero.
  for (const z of [-0.36, 0.36]) {
    hueso(V(0.5, 2.45, z * 0.7), V(0.85, 2.05, z), 0.1, 0.08)
    hueso(V(0.85, 2.05, z), V(0.72, 1.6, z), 0.075, 0.06)
    p.push(caja(0.24, 0.08, 0.1, 0.8, 1.56, z))
  }
  hueso(V(0.5, 2.5, 0), V(0.62, 3.15, 0), 0.24, 0.2)
  p.push(esfera(0.13, 0.64, 3.42, 0))
  hueso(V(0.62, 3.1, 0.2), V(0.72, 3.55, 0.36), 0.06, 0.05)
  hueso(V(0.72, 3.55, 0.36), V(0.86, 3.95, 0.42), 0.05, 0.045)
  const sombrero = new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10)
  sombrero.scale(1.3, 1, 0.8)
  p.push(en(sombrero, 0.88, 4.05, 0.42))
  hueso(V(0.62, 3.1, -0.2), V(0.95, 2.75, -0.25), 0.06, 0.05)
  // Faldón del saco.
  p.push(en(new THREE.ConeGeometry(0.32, 0.5, 8), 0.45, 2.45, 0))
  return unir(p)
}

/** Figura de pie, de bronce, para las estatuas de las esquinas. */
function figura(): THREE.BufferGeometry {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const p: THREE.BufferGeometry[] = []
  p.push(barra(V(0, 0, -0.12), V(0, 0.85, -0.1), 0.09, 0.11, 8), barra(V(0.05, 0, 0.12), V(0, 0.85, 0.1), 0.09, 0.11, 8))
  p.push(en(new THREE.ConeGeometry(0.42, 1.1, 10), 0, 1.0, 0))
  p.push(barra(V(0, 0.9, 0), V(0, 1.45, 0), 0.24, 0.2, 10))
  p.push(esfera(0.12, 0, 1.62, 0))
  p.push(barra(V(0, 1.4, 0.24), V(0.35, 1.1, 0.4), 0.06, 0.05, 6), barra(V(0, 1.4, -0.24), V(0.15, 1.05, -0.3), 0.06, 0.05, 6))
  p.push(barra(V(0.35, 1.1, 0.4), V(0.4, 0, 0.55), 0.02, 0.02, 4))
  return unir(p)
}

// ══════════════════════════════════════════════════════════════
// La Elipse, el National Mall, el Monumento a Washington
// ══════════════════════════════════════════════════════════════

const ELIPSE = { cx: 0, cz: 412, rx: 150, rz: 140, ancho: 8 }

function elipseYMall(w: Mundo) {
  const E = ELIPSE
  const anillo = new Lamina(() => Y.asfalto)
  anillo.cinta(elipse(E.cx, E.cz, E.rx, E.rz, 160).slice(0, 160), E.ancho, C(0xffffff), true)
  w.cub.add("asfalto", anillo.geometria())
  const bord = plano(Y.pintura)
  bord.cinta(elipse(E.cx, E.cz, E.rx + E.ancho / 2 - 0.4, E.rz + E.ancho / 2 - 0.4, 160).slice(0, 160), 0.12, PALETA.blanco, true)
  bord.cinta(elipse(E.cx, E.cz, E.rx - E.ancho / 2 + 0.4, E.rz - E.ancho / 2 + 0.4, 160).slice(0, 160), 0.12, PALETA.blanco, true)
  w.cub.add("pintura", bord.geometria())
  w.ocupado.push({ tipo: "linea", pts: elipse(E.cx, E.cz, E.rx, E.rz, 80), ancho: E.ancho + 3 })
  // Senderos que cruzan la Elipse desde E Street.
  camino(w, [[-120, 193], [-95, 260], [-78, 290]], 3, "grava")
  camino(w, [[110, 193], [90, 255], [76, 290]], 3, "grava")
  camino(w, [[0, 193], [0, E.cz - E.rz - E.ancho / 2]], 4, "grava", false)
  // Faroles alrededor del anillo y árboles por fuera.
  const r = azar(1791)
  const n = 40
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    w.faroles.push({ x: E.cx + Math.cos(t) * (E.rx + E.ancho / 2 + 1.2), z: E.cz + Math.sin(t) * (E.rz + E.ancho / 2 + 1.2), y: 0, ry: 0 })
  }
  for (let i = 0; i < 70; i++) {
    const t = (i / 70) * Math.PI * 2 + r() * 0.04
    const d = entre(r, 12, 34)
    const x = E.cx + Math.cos(t) * (E.rx + d)
    const z = E.cz + Math.sin(t) * (E.rz + d)
    if (!libre(w, x, z, 2)) continue
    w.arboles.push({ x, z, s: entre(r, 0.9, 1.4), tipo: r() < 0.3 ? "olmo" : "roble", tono: tonoCopa(r, 0.08) })
  }
  // El abeto del Árbol de Navidad Nacional, al norte de la Elipse.
  w.arboles.push({ x: 0, z: E.cz - E.rz + 22, s: 1.5, tipo: "conifera", tono: C(0x2f5a3a) })
  // Árboles al sur del Tesoro y del Edificio Eisenhower.
  sembrarArboles(w, r, -170, -103, 75, 160, 13, 120, () => (r() < 0.3 ? "olmo" : "roble"), 0.9, 1.4)
  sembrarArboles(w, r, 107, 156, 75, 160, 13, 90, () => (r() < 0.3 ? "olmo" : "roble"), 0.9, 1.4)

  // National Mall al este de la calle 15: paseos de grava y filas de olmos.
  for (const z of [935, 1065]) {
    const g = plano(Y.camino)
    g.rect(190, EXT.x1, z - 5, z + 5, PALETA.gravaClara)
    w.cub.add("grava", g.geometria())
    ocupaRect(w, 190, EXT.x1, z - 5, z + 5)
    for (const dz of [-9, 9])
      for (let x = 200; x < 1000; x += 17) w.arboles.push({ x: x + entre(r, -1, 1), z: z + dz, s: entre(r, 1.0, 1.2), tipo: "lejano", tono: tonoCopa(r, 0.04) })
  }
  // Al oeste: el Estanque Reflectante y el Memorial de la Segunda Guerra Mundial.
  const estanque = new THREE.PlaneGeometry(760, 51)
  estanque.rotateX(-Math.PI / 2)
  w.cub.add("agua", en(estanque, -860, 0.25, 1000))
  for (const [x0, x1, z0, z1] of [[-1242, -478, 972, 974.5], [-1242, -478, 1025.5, 1028], [-1242, -1240, 974.5, 1025.5], [-480, -478, 974.5, 1025.5]])
    w.cub.add("piedra", losa(x0, x1, z0, z1, -0.05, 0.4), PALETA.piedraClara)
  ocupaRect(w, -1245, -470, 965, 1035)
  for (const dz of [-24, 24])
    for (let x = -1230; x < -480; x += 19) w.arboles.push({ x, z: 1000 + dz + entre(r, -1, 1), s: entre(r, 1.0, 1.25), tipo: "lejano", tono: tonoCopa(r, 0.03) })
  const wx = -330
  const plz = plano(Y.camino + 0.01)
  plz.disco(wx, 1000, 78, PALETA.piedraCalida, 64)
  w.cub.add("caminoPiedra", plz.geometria())
  const ov = new THREE.CircleGeometry(1, 64)
  ov.rotateX(-Math.PI / 2)
  ov.scale(60, 1, 40)
  w.cub.add("agua", en(ov, wx, 0.3, 1000))
  const borde = new THREE.TorusGeometry(1, 0.012, 4, 96)
  borde.rotateX(Math.PI / 2)
  borde.scale(60.4, 30, 40.4)
  w.cub.add("piedra", en(borde, wx, 0.3, 1000), PALETA.piedraClara)
  // Las 56 columnas del memorial en dos semicírculos.
  for (let i = 0; i < 56; i++) {
    const lado = i < 28 ? -1 : 1
    const t = ((i % 28) / 27) * Math.PI * 0.8 + Math.PI * 0.1
    const x = wx + Math.sin(t) * 70 * (lado < 0 ? -1 : 1) * 0.35 + (lado < 0 ? -0 : 0)
    const z = 1000 - Math.cos(t) * 70 * lado
    w.cub.add("piedra", caja(1.1, 5.2, 1.1, x, 2.6, z), PALETA.piedraCalida)
  }
  ocupaCirc(w, wx, 1000, 82)
  // Grupos de árboles en los terrenos del Monumento y en Constitution Gardens.
  sembrarArboles(w, r, -165, 150, 690, 1300, 26, 500, () => "lejano", 1.0, 1.5)
  sembrarArboles(w, r, -1200, -200, 690, 950, 30, 600, () => "lejano", 1.0, 1.5)
  sembrarArboles(w, r, -1200, -200, 1050, 1300, 30, 500, () => "lejano", 1.0, 1.5)
  sembrarArboles(w, r, 200, 1200, 690, 900, 28, 600, () => "lejano", 1.0, 1.4)
  sembrarArboles(w, r, 200, 1200, 1100, 1310, 28, 500, () => "lejano", 1.0, 1.4)
}

function monumento(w: Mundo) {
  const { x, z } = MON
  const y0 = LOMA.alto
  // Plaza circular de granito en la cima de la loma y cuatro senderos.
  const plz = plano(y0 + Y.camino)
  plz.disco(x, z, 26, PALETA.piedraCalida, 64)
  w.cub.add("caminoPiedra", plz.geometria())
  for (const t of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const pts: P2[] = []
    for (let d = 25; d <= 150; d += 5) pts.push([x + Math.cos(t + 0.25) * d, z + Math.sin(t + 0.25) * d])
    camino(w, pts, 4, "grava", false)
  }
  ocupaCirc(w, x, z, 48)
  // El obelisco: base de 16,8 m, 152 m hasta el piramidión, 169,3 m en total.
  // A un tercio de la altura (unos 46 m) cambia el tono del mármol: la obra se
  // paró en 1854 y se retomó en 1879 con piedra de otra cantera.
  const b = 8.4
  const t = 5.25
  const hc = 152.4
  const hp = MON.alto
  const corte = 46
  const pos: number[] = []
  const col: number[] = []
  const bajo = C(0xeee9df)
  const alto = C(0xd9cdb8)
  const ancho = (h: number) => b + (t - b) * (h / hc)
  const cara = (k: number, h0: number, h1: number, c: THREE.Color) => {
    // k: 0 sur (+z), 1 este (+x), 2 norte (-z), 3 oeste (-x)
    const w0 = ancho(h0), w1 = ancho(h1)
    const pt = (s: number, h: number, wv: number): number[] => {
      if (k === 0) return [x + s * wv, y0 + h, z + wv]
      if (k === 1) return [x + wv, y0 + h, z - s * wv]
      if (k === 2) return [x - s * wv, y0 + h, z - wv]
      return [x - wv, y0 + h, z + s * wv]
    }
    const a = pt(-1, h0, w0), bb = pt(1, h0, w0), c1 = pt(1, h1, w1), d = pt(-1, h1, w1)
    pos.push(...a, ...bb, ...c1, ...a, ...c1, ...d)
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b)
  }
  for (let k = 0; k < 4; k++) {
    cara(k, -1, corte, bajo)
    cara(k, corte, hc, alto)
    // Piramidión.
    const pk = (s: number): number[] => {
      if (k === 0) return [x + s * t, y0 + hc, z + t]
      if (k === 1) return [x + t, y0 + hc, z - s * t]
      if (k === 2) return [x - s * t, y0 + hc, z - t]
      return [x - t, y0 + hc, z + s * t]
    }
    pos.push(...pk(-1), ...pk(1), x, y0 + hp, z)
    for (let i = 0; i < 3; i++) col.push(alto.r, alto.g, alto.b)
  }
  const ob = new THREE.BufferGeometry()
  ob.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  ob.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  ob.computeVertexNormals()
  // Las dos ventanas de observación por cara, a 150 m.
  const ventanas: THREE.BufferGeometry[] = []
  for (let k = 0; k < 4; k++)
    for (const s of [-0.9, 0.9]) {
      const wv = ancho(150.4) + 0.03
      const g = new THREE.PlaneGeometry(0.6, 0.9)
      const ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][k]
      const dx = [s, wv, -s, -wv][k]
      const dz = [wv, -s, -wv, s][k]
      en(g, x + dx, y0 + 150.4, z + dz, ry)
      ventanas.push(pintar(g, C(0x2a2622)))
    }
  const marmol = unir([ob, ...ventanas], true)
  const mesh = new THREE.Mesh(marmol, w.M.marmol)
  mesh.name = "paisaje-monumento"
  if (w.ctx.sombras) mesh.castShadow = mesh.receiveShadow = true
  w.raiz.add(mesh)
  // Luces rojas de balizamiento: dos por cara cerca de la punta.
  const rojas: THREE.BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][k]
    for (const s of [-0.8, 0.8]) {
      const hh = hc + 6
      const wv = t * (1 - 6 / (hp - hc)) + 0.12
      const dx = [s, wv, -s, -wv][k]
      const dz = [wv, -s, -wv, s][k]
      rojas.push(en(new THREE.BoxGeometry(0.35, 0.35, 0.2), x + dx, y0 + hh, z + dz, ry))
    }
  }
  const lr = new THREE.Mesh(unir(rojas), w.M.luzRoja)
  lr.name = "paisaje-balizas"
  w.raiz.add(lr)
  w.animar.push((tk) => {
    const fase = (tk.tiempo % 2.4) / 2.4
    const on = fase < 0.45 ? 1 : 0.06
    w.M.luzRoja.emissiveIntensity = (0.15 + tk.noche * 7) * on
  })
  // Un reflector discreto de noche sobre el obelisco (las fachadas las ilumina el motor).
  const foco = new THREE.SpotLight(0xfff1dc, 0, 420, 0.22, 0.6, 1)
  foco.position.set(x - 60, 2, z - 90)
  foco.target.position.set(x, y0 + 80, z)
  w.raiz.add(foco, foco.target)
  w.ctx.luzNocturna(foco, 9000)

  // Las 50 banderas en círculo alrededor de la base.
  const mastiles: THREE.Matrix4[] = []
  const banderas: THREE.Matrix4[] = []
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2
    const fx = x + Math.cos(a) * 36
    const fz = z + Math.sin(a) * 36
    const fy = alturaSuelo(fx, fz)
    mastiles.push(mtx(fx, fy, fz))
    banderas.push(mtx(fx, fy + 7.0, fz, -0.4))
  }
  const palo = unir([new THREE.CylinderGeometry(0.045, 0.07, 9, 6).translate(0, 4.5, 0), new THREE.SphereGeometry(0.1, 6, 4).translate(0, 9.05, 0)])
  w.raiz.add(instanciar(w, palo, w.M.mastil, mastiles, undefined, "mastiles", true, false))
  const tela = new THREE.PlaneGeometry(2.4, 1.27, 10, 4)
  tela.translate(1.2 + 0.05, 1.27 / 2 + 0.6, 0)
  w.raiz.add(instanciar(w, tela, w.M.bandera, banderas, undefined, "banderas", true, false))
  // Bancos alrededor de la plaza.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.6
    w.bancos.push(mtx(x + Math.cos(a) * 28, y0, z + Math.sin(a) * 28, -a + Math.PI / 2))
  }
}

// ══════════════════════════════════════════════════════════════
// Árboles: copas de varias esferas deformadas, instanciadas
// ══════════════════════════════════════════════════════════════

/** Muestreo con distancia mínima (tipo Poisson) dentro de un rectángulo libre. */
function sembrarArboles(w: Mundo, r: Rng, x0: number, x1: number, z0: number, z1: number, dist: number, intentos: number, tipo: () => TipoArbol, s0: number, s1: number) {
  const puestos: P2[] = []
  const n = Math.round(intentos * Math.max(0.4, w.factor))
  for (let i = 0; i < n; i++) {
    const x = entre(r, x0, x1)
    const z = entre(r, z0, z1)
    if (!libre(w, x, z, 1.5)) continue
    if (puestos.some(([px, pz]) => Math.hypot(px - x, pz - z) < dist)) continue
    if (w.arboles.some((a) => Math.abs(a.x - x) < dist * 0.6 && Math.abs(a.z - z) < dist * 0.6)) continue
    puestos.push([x, z])
    const t = tipo()
    w.arboles.push({ x, z, s: entre(r, s0, s1), tipo: t, tono: t === "conifera" ? C(0x2c5236).offsetHSL(0, 0, entre(r, -0.03, 0.03)) : tonoCopa(r) })
  }
}

function arbolesDelPredio(w: Mundo) {
  const r = azar(1792)
  // Grandes alrededor del Jardín Sur y a los costados del Jardín Norte.
  sembrarArboles(w, r, R.x0 + 3, R.x1 - 3, 20, R.z1 - 3, 10.5, 900, () => {
    const u = r()
    return u < 0.5 ? "roble" : u < 0.78 ? "olmo" : u < 0.92 ? "magnolia" : "conifera"
  }, 0.9, 1.5)
  sembrarArboles(w, r, R.x0 + 3, R.x1 - 3, R.z0 + 3, 0, 11, 500, () => (r() < 0.55 ? "roble" : r() < 0.5 ? "olmo" : "magnolia"), 0.95, 1.5)
}

interface Copa {
  geo: THREE.BufferGeometry
}
function copa(semilla: number, op: { blobs: number; detalle: number; rx: number; ry: number; base: number; radio: [number, number]; ruido: number }): THREE.BufferGeometry {
  const r = azar(semilla)
  const piezas: THREE.BufferGeometry[] = []
  const cy = op.base + op.ry
  const v = new THREE.Vector3()
  for (let i = 0; i < op.blobs; i++) {
    const ang = (i / op.blobs) * Math.PI * 2 + r() * 0.9
    const rad = i === 0 ? 0 : entre(r, 0.45, 0.78)
    const c = new THREE.Vector3(Math.cos(ang) * rad * op.rx, cy + (i === 0 ? op.ry * 0.3 : entre(r, -0.4, 0.25) * op.ry), Math.sin(ang) * rad * op.rx)
    const rb = entre(r, op.radio[0], op.radio[1]) * (i === 0 ? 1.12 : 1)
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, op.detalle)
    g.deleteAttribute("normal")
    g.deleteAttribute("uv")
    g = mergeVertices(g)
    const p = g.getAttribute("position")
    for (let j = 0; j < p.count; j++) {
      v.fromBufferAttribute(p, j)
      const n = ruido3(v.x * 1.6 + i * 3.7 + semilla, v.y * 1.6, v.z * 1.6)
      const k = rb * (1 + (n - 0.5) * 2 * op.ruido)
      p.setXYZ(j, c.x + v.x * k, c.y + v.y * k * 0.88, c.z + v.z * k)
    }
    g.computeVertexNormals()
    // Normales mezcladas con las de la copa entera: luz suave, de volumen.
    const nn = g.getAttribute("normal")
    const col = new Float32Array(p.count * 3)
    for (let j = 0; j < p.count; j++) {
      const px = p.getX(j), py = p.getY(j), pz = p.getZ(j)
      const sx = px / op.rx, sy = (py - cy) / op.ry, sz = pz / op.rx
      const sl = Math.hypot(sx, sy, sz) || 1
      const bx = nn.getX(j) * 0.42 + (sx / sl) * 0.58
      const by = nn.getY(j) * 0.42 + (sy / sl) * 0.58
      const bz = nn.getZ(j) * 0.42 + (sz / sl) * 0.58
      const bl = Math.hypot(bx, by, bz) || 1
      nn.setXYZ(j, bx / bl, by / bl, bz / bl)
      // Oclusión falsa: abajo y adentro más oscuro.
      const alto = suave(op.base - 0.3, op.base + op.ry * 2, py)
      const fuera = Math.min(1, sl)
      const k = 0.38 + 0.5 * alto + 0.3 * fuera
      col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    piezas.push(g.toNonIndexed())
  }
  const g = mergeGeometries(piezas, false)
  if (!g) throw new Error("paisaje: copa vacía")
  return g
}
function conifera(semilla: number): THREE.BufferGeometry {
  const r = azar(semilla)
  const piezas: THREE.BufferGeometry[] = []
  const pisos = 5
  for (let i = 0; i < pisos; i++) {
    const t = i / pisos
    const rr = 3.0 * (1 - t * 0.78)
    const h = 3.6 * (1 - t * 0.35)
    let g: THREE.BufferGeometry = new THREE.ConeGeometry(rr, h, 9, 2, false)
    g.deleteAttribute("uv")
    g.deleteAttribute("normal")
    g = mergeVertices(g)
    g.translate(0, 1.6 + i * 2.15 + h / 2, 0)
    const p = g.getAttribute("position")
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j)
      const n = (ruido3(x * 1.3 + i * 4, y * 1.3, z * 1.3) - 0.5) * 0.5
      p.setXYZ(j, x * (1 + n), y + n * 0.3, z * (1 + n))
    }
    g.computeVertexNormals()
    const col = new Float32Array(p.count * 3)
    for (let j = 0; j < p.count; j++) {
      const lado = Math.hypot(p.getX(j), p.getZ(j)) / rr
      const k = 0.45 + 0.35 * lado + 0.3 * (p.getY(j) / 14)
      col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = k
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    piezas.push(g.toNonIndexed())
    void r
  }
  const g = mergeGeometries(piezas, false)
  if (!g) throw new Error("paisaje: conífera vacía")
  return g
}
function tronco(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = []
  p.push(new THREE.CylinderGeometry(0.34, 0.55, 0.5, 8).translate(0, 0.25, 0))
  p.push(new THREE.CylinderGeometry(0.2, 0.34, 4.6, 8, 3).translate(0, 2.8, 0))
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  for (const a of [0.3, 2.4, 4.4]) {
    p.push(barra(V(0, 3.8, 0), V(Math.cos(a) * 1.9, 6.0, Math.sin(a) * 1.9), 0.15, 0.07, 6))
  }
  p.push(barra(V(0, 4.6, 0), V(0.2, 7.0, -0.3), 0.14, 0.07, 6))
  return unir(p)
}

function instanciar(w: Mundo, geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colores: THREE.Color[] | undefined, nombre: string, proyecta: boolean, recibe: boolean) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length))
  mats.forEach((m, i) => im.setMatrixAt(i, m))
  if (colores) colores.forEach((c, i) => im.setColorAt(i, c))
  im.count = mats.length
  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true
  im.computeBoundingSphere()
  im.name = `paisaje-${nombre}`
  if (w.ctx.sombras) {
    im.castShadow = proyecta
    im.receiveShadow = recibe
  }
  return im
}

function plantar(w: Mundo) {
  // Formas de copa (geometría en metros para un árbol de escala 1).
  const formas: Record<TipoArbol, THREE.BufferGeometry[]> = {
    roble: [copa(11, { blobs: 7, detalle: 1, rx: 4.4, ry: 3.1, base: 4.2, radio: [2.0, 2.8], ruido: 0.24 }), copa(12, { blobs: 6, detalle: 1, rx: 4.0, ry: 3.4, base: 4.4, radio: [2.1, 2.9], ruido: 0.26 })],
    olmo: [copa(21, { blobs: 8, detalle: 1, rx: 5.0, ry: 3.6, base: 5.6, radio: [2.0, 2.7], ruido: 0.22 })],
    magnolia: [copa(31, { blobs: 6, detalle: 1, rx: 3.0, ry: 3.6, base: 1.6, radio: [1.9, 2.5], ruido: 0.18 })],
    conifera: [conifera(41)],
    lejano: [copa(51, { blobs: 3, detalle: 1, rx: 3.6, ry: 3.0, base: 4.3, radio: [2.6, 3.2], ruido: 0.2 })],
    chico: [copa(61, { blobs: 5, detalle: 1, rx: 3.6, ry: 2.8, base: 4.0, radio: [2.0, 2.6], ruido: 0.22 })],
  }
  const r = azar(2468)
  const tron: THREE.Matrix4[] = []
  const porForma = new Map<THREE.BufferGeometry, { m: THREE.Matrix4[]; c: THREE.Color[] }>()
  for (const a of w.arboles) {
    const y = alturaSuelo(a.x, a.z)
    const ry = r() * Math.PI * 2
    const sy = a.s * entre(r, 0.9, 1.12)
    const f = elegir(r, formas[a.tipo])
    if (!porForma.has(f)) porForma.set(f, { m: [], c: [] })
    const d = porForma.get(f)!
    d.m.push(mtx(a.x, y, a.z, ry, a.s, sy))
    d.c.push(a.tono)
    tron.push(a.tipo === "conifera" ? mtx(a.x, y, a.z, ry, a.s * 0.8, a.s * 0.45) : mtx(a.x, y, a.z, ry, a.s, sy))
  }
  w.raiz.add(instanciar(w, tronco(), w.M.corteza, tron, undefined, "troncos", true, true))
  let i = 0
  for (const [geo, d] of porForma) w.raiz.add(instanciar(w, geo, w.M.follaje, d.m, d.c, `copas-${i++}`, true, true))

  // Arbustos redondos, matas y flores.
  const bola = (() => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.7, 1)
    g.deleteAttribute("normal")
    g.deleteAttribute("uv")
    g = mergeVertices(g)
    g.translate(0, 0.55, 0)
    deformar(g, 0.1, 3)
    sombrear(g, 1.2, C(0xffffff))
    return g
  })()
  if (w.arbustos.length) w.raiz.add(instanciar(w, bola, w.M.follaje, w.arbustos.map((a) => a.m), w.arbustos.map((a) => a.c), "arbustos", true, true))
  const mata = (() => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.24, 0)
    g.deleteAttribute("normal")
    g.deleteAttribute("uv")
    g = mergeVertices(g)
    g.scale(1, 0.8, 1)
    g.translate(0, 0.17, 0)
    deformar(g, 0.04, 9)
    sombrear(g, 0.4, C(0xffffff))
    return g
  })()
  if (w.matas.length) w.raiz.add(instanciar(w, mata, w.M.follaje, w.matas.map((a) => a.m), w.matas.map((a) => a.c), "matas", false, true))
  const flor = (() => {
    const rr = azar(8)
    const p: THREE.BufferGeometry[] = []
    for (let k = 0; k < 5; k++) {
      const t = (k / 5) * Math.PI * 2 + rr()
      const d = k === 0 ? 0 : entre(rr, 0.08, 0.16)
      p.push(en(new THREE.OctahedronGeometry(entre(rr, 0.055, 0.075), 0), Math.cos(t) * d, 0.32 + rr() * 0.07, Math.sin(t) * d))
    }
    return unir(p)
  })()
  if (w.flores.length) w.raiz.add(instanciar(w, flor, w.M.flor, w.flores.map((a) => a.m), w.flores.map((a) => a.c), "flores", false, false))
}

// ══════════════════════════════════════════════════════════════
// Faroles de globo estilo Washington y bancos
// ══════════════════════════════════════════════════════════════

function farolesYBancos(w: Mundo) {
  // Poste torneado de hierro fundido (base ancha, fuste fino, collar) y globo.
  const perfil = [
    [0.0, 0], [0.21, 0], [0.21, 0.12], [0.16, 0.2], [0.16, 0.5], [0.1, 0.62], [0.065, 0.75],
    [0.06, 3.0], [0.09, 3.06], [0.07, 3.14], [0.12, 3.3], [0.15, 3.38], [0.0, 3.4],
  ].map(([a, b]) => new THREE.Vector2(a, b))
  const poste = new THREE.LatheGeometry(perfil, 8)
  const mats: THREE.Matrix4[] = []
  const globos: THREE.Matrix4[] = [...w.globos]
  for (const f of w.faroles) {
    mats.push(mtx(f.x, f.y, f.z, f.ry))
    globos.push(mtx(f.x, f.y + 3.66, f.z))
  }
  w.raiz.add(instanciar(w, unir([poste]), w.M.hierro, mats, undefined, "faroles", true, false))
  const globo = unir([new THREE.SphereGeometry(0.29, 12, 8), new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, 0.33, 0)])
  w.raiz.add(instanciar(w, globo, w.M.globo, globos, undefined, "globos", false, false))

  // Pocas luces reales (cuestan en todos los materiales): las de la vista de
  // la foto, Pennsylvania Avenue y el Jardín Sur. El resto brilla por emisión.
  const reales: Array<[number, number, number, number]> = [
    [-22, 4.2, R.z0 - 2.5, 110],
    [22, 4.2, R.z0 - 2.5, 110],
    [0, 5, -40, 90],
    [-14, 4, HUELLAS.fuenteSur.z, 90],
    [14, 4, HUELLAS.fuenteSur.z, 90],
    [LAF.cx + 6, 6, LAF.cz, 120],
  ]
  for (const [x, y, z, i] of reales) {
    const l = new THREE.PointLight(0xffc98a, 0, 34, 2)
    l.position.set(x, y, z)
    w.raiz.add(l)
    w.ctx.luzNocturna(l, i)
  }

  // Banco de plaza: listones de madera sobre patas de hierro.
  const p: THREE.BufferGeometry[] = []
  const mad = PALETA.madera
  const hie = C(0x1b1c1e)
  for (let i = 0; i < 3; i++) p.push(pintar(caja(1.8, 0.035, 0.1, 0, 0.44, -0.15 + i * 0.13), mad))
  for (let i = 0; i < 2; i++) p.push(pintar(en(new THREE.BoxGeometry(1.8, 0.1, 0.035), 0, 0.62 + i * 0.15, -0.26 - i * 0.03, 0, -0.18), mad))
  for (const x of [-0.75, 0.75]) {
    p.push(pintar(caja(0.05, 0.44, 0.05, x, 0.22, 0.12), hie))
    p.push(pintar(caja(0.05, 0.8, 0.05, x, 0.4, -0.25), hie))
    p.push(pintar(caja(0.05, 0.04, 0.45, x, 0.4, -0.05), hie))
    p.push(pintar(caja(0.05, 0.04, 0.3, x, 0.62, 0.0), hie))
  }
  const banco = unir(p, true)
  if (w.bancos.length) w.raiz.add(instanciar(w, banco, w.M.props, w.bancos, undefined, "bancos", true, false))
}

// ══════════════════════════════════════════════════════════════
// Autos que circulan (con faros y luces traseras que se encienden de noche)
// ══════════════════════════════════════════════════════════════

function autoGeo(suv: boolean) {
  const s = suv
    ? [[-2.45, 0.42], [-2.5, 1.05], [-2.42, 1.78], [0.72, 1.86], [1.48, 1.18], [2.42, 1.06], [2.52, 0.62], [2.42, 0.4]]
    : [[-2.33, 0.36], [-2.38, 0.76], [-2.2, 0.96], [-1.25, 1.0], [-0.65, 1.42], [0.55, 1.45], [1.15, 1.0], [2.25, 0.86], [2.38, 0.56], [2.3, 0.34]]
  const forma = new THREE.Shape(s.map(([x, y]) => new THREE.Vector2(x, y)))
  const anchoA = suv ? 1.86 : 1.72
  const cuerpo = new THREE.ExtrudeGeometry(forma, { depth: anchoA, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 1 })
  cuerpo.translate(0, 0, -anchoA / 2)
  pintar(cuerpo, C(0xffffff))
  // Vidrios: el perfil de la cabina, un poco más ancho y afuera del cuerpo.
  const v = suv
    ? [[-2.47, 1.08], [-2.43, 1.7], [0.7, 1.77], [1.42, 1.18]]
    : [[-1.3, 0.99], [-0.73, 1.38], [0.67, 1.38], [1.2, 0.99]]
  const fv = new THREE.Shape(v.map(([x, y]) => new THREE.Vector2(x, y)))
  const anchoV = anchoA + 0.15
  const vid = new THREE.ExtrudeGeometry(fv, { depth: anchoV, bevelEnabled: false, curveSegments: 1 })
  vid.translate(0, 0, -anchoV / 2)
  pintar(vid, C(0x0b0f12))
  const ruedas: THREE.BufferGeometry[] = []
  const rr = suv ? 0.42 : 0.35
  for (const x of suv ? [-1.6, 1.55] : [-1.45, 1.42])
    for (const z of [-1, 1]) {
      const g = new THREE.CylinderGeometry(rr, rr, 0.26, 10)
      g.rotateX(Math.PI / 2)
      ruedas.push(pintar(en(g, x, rr, z * (anchoA / 2 - 0.04)), C(0x111111)))
      const llanta = new THREE.CylinderGeometry(rr * 0.55, rr * 0.55, 0.27, 8)
      llanta.rotateX(Math.PI / 2)
      ruedas.push(pintar(en(llanta, x, rr, z * (anchoA / 2 - 0.035)), C(0x6d7378)))
    }
  return unir([cuerpo, vid, ...ruedas], true)
}

function autos(w: Mundo) {
  const r = azar(4242)
  type Carril = { ox: number; oz: number; dx: number; dz: number; largo: number; vel: number }
  const carriles: Carril[] = []
  const autos: Array<{ c: number; s: number; suv: boolean; color: THREE.Color }> = []
  const colores = [0x111214, 0x111214, 0x1c1f24, 0xe9e9e6, 0xdcdcd8, 0x9ea3a8, 0x6f757c, 0x40454c, 0x1f2f4f, 0x7a1717, 0x2b3a2e, 0x8a8f94]
  for (const k of CALLES_PAISAJE) {
    if (!k.autos) continue
    const n = Math.max(1, Math.round(k.autos * w.factor))
    for (let i = 0; i < k.carriles; i++)
      for (const sentido of [1, -1]) {
        const off = (i + 0.5) * CARRIL + 0.25
        // Se maneja por la derecha: hacia el sur (+z) por el lado oeste; hacia el este (+x) por el lado sur.
        const ox = k.eje === "ns" ? k.c - sentido * off : sentido > 0 ? k.a : k.b
        const oz = k.eje === "ns" ? (sentido > 0 ? k.a : k.b) : k.c + sentido * off
        const dx = k.eje === "ns" ? 0 : sentido
        const dz = k.eje === "ns" ? sentido : 0
        const idx = carriles.length
        carriles.push({ ox, oz, dx, dz, largo: k.b - k.a, vel: entre(r, 10.5, 15.5) - i * 1.2 })
        for (let j = 0; j < n; j++) autos.push({ c: idx, s: ((j + r() * 0.55) / n) * (k.b - k.a), suv: r() < 0.32, color: C(elegir(r, colores)) })
      }
  }
  const sed = autos.filter((a) => !a.suv)
  const suv = autos.filter((a) => a.suv)
  const mSed = instanciar(w, autoGeo(false), w.M.auto, sed.map(() => new THREE.Matrix4()), sed.map((a) => a.color), "autos", true, false)
  const mSuv = instanciar(w, autoGeo(true), w.M.auto, suv.map(() => new THREE.Matrix4()), suv.map((a) => a.color), "camionetas", true, false)
  // Faros y luces traseras: un par por auto, en mallas propias que se encienden de noche.
  const par = (x: number, y: number, w0: number, h: number, sep: number) => unir([caja(0.05, h, w0, x, y, -sep), caja(0.05, h, w0, x, y, sep)])
  const faros = new THREE.InstancedMesh(par(0, 0, 0.34, 0.12, 0.6), w.M.faros, autos.length)
  const traseras = new THREE.InstancedMesh(par(0, 0, 0.36, 0.12, 0.62), w.M.traseras, autos.length)
  faros.name = "paisaje-faros"
  traseras.name = "paisaje-traseras"
  for (const m of [mSed, mSuv, faros, traseras]) {
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }
  w.raiz.add(mSed, mSuv, faros, traseras)
  const M = new THREE.Matrix4()
  const off = new THREE.Matrix4()
  const ofFaro = { sed: new THREE.Matrix4().makeTranslation(2.37, 0.72, 0), suv: new THREE.Matrix4().makeTranslation(2.5, 0.88, 0) }
  const ofTras = { sed: new THREE.Matrix4().makeTranslation(-2.37, 0.84, 0), suv: new THREE.Matrix4().makeTranslation(-2.49, 1.22, 0) }
  const mover = (t: number) => {
    let iSed = 0
    let iSuv = 0
    autos.forEach((a, i) => {
      const c = carriles[a.c]
      const s = (a.s + c.vel * t) % c.largo
      const x = c.ox + c.dx * s
      const z = c.oz + c.dz * s
      M.copy(mtx(x, Y.asfalto - 0.02, z, Math.atan2(-c.dz, c.dx)))
      if (a.suv) mSuv.setMatrixAt(iSuv++, M)
      else mSed.setMatrixAt(iSed++, M)
      faros.setMatrixAt(i, off.multiplyMatrices(M, a.suv ? ofFaro.suv : ofFaro.sed))
      traseras.setMatrixAt(i, off.multiplyMatrices(M, a.suv ? ofTras.suv : ofTras.sed))
    })
    for (const m of [mSed, mSuv, faros, traseras]) m.instanceMatrix.needsUpdate = true
  }
  mover(0)
  w.animar.push((t) => mover(t.tiempo))
}

// ══════════════════════════════════════════════════════════════
// Pájaros: una bandada de palomas que gira sobre Lafayette y patos en V
// que cruzan de vez en cuando
// ══════════════════════════════════════════════════════════════

function pajaros(w: Mundo) {
  const g = new THREE.BufferGeometry()
  // Cuerpo, cola y dos alas (las puntas de las alas aletean en el shader).
  const pos = [
    0.24, 0, 0, -0.16, 0.03, 0.035, -0.16, 0.03, -0.035,
    -0.14, 0.02, 0, -0.32, 0.01, 0.09, -0.32, 0.01, -0.09,
    0.08, 0.02, 0, -0.08, 0.02, 0, -0.03, 0, 0.42,
    0.08, 0.02, 0, -0.03, 0, -0.42, -0.08, 0.02, 0,
  ]
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  const nPal = Math.round(18 * Math.max(0.6, w.factor))
  const nV = 11
  const total = nPal + nV
  const fase = new Float32Array(total)
  const r = azar(1776)
  for (let i = 0; i < total; i++) fase[i] = r() * 6.28
  g.setAttribute("aFase", new THREE.InstancedBufferAttribute(fase, 1))
  const im = new THREE.InstancedMesh(g, w.M.pajaro, total)
  im.name = "paisaje-pajaros"
  im.frustumCulled = false
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  w.raiz.add(im)
  const pal = Array.from({ length: nPal }, () => ({ rad: entre(r, 18, 42), alt: entre(r, 16, 30), vel: entre(r, 0.32, 0.42), f: r() * 6.28, os: entre(r, 1.5, 4) }))
  const ESCALA_V = 2.4
  const mover = (t: number) => {
    pal.forEach((p, i) => {
      const a = p.f + t * p.vel
      const x = LAF.cx + Math.cos(a) * p.rad + Math.sin(t * 0.3 + p.f) * p.os
      const z = LAF.cz + Math.sin(a) * p.rad * 0.8
      const y = p.alt + Math.sin(t * 0.7 + p.f) * 2.5
      // Rumbo tangente al círculo.
      im.setMatrixAt(i, mtx(x, y, z, -(a + Math.PI / 2), 1.5, 1.5, 0, Math.sin(t * 0.9 + p.f) * 0.25))
    })
    // Bandada en V: cruza el cielo cada 110 s, en una dirección distinta cada vez.
    const ciclo = Math.floor(t / 110)
    const local = t - ciclo * 110
    const rc = azar(ciclo * 7919 + 13)
    const ang = rc() * Math.PI * 2
    const dur = 70
    const visible = local < dur
    const u = local / dur
    const cx = Math.cos(ang) * (-750 + 1500 * u) + entre(rc, -150, 150)
    const cz = 150 + Math.sin(ang) * (-750 + 1500 * u) + entre(rc, -150, 150)
    const alt = entre(rc, 60, 95)
    const ry = Math.atan2(-Math.sin(ang), Math.cos(ang))
    for (let k = 0; k < nV; k++) {
      const fila = Math.ceil(k / 2)
      const lado = k === 0 ? 0 : k % 2 ? 1 : -1
      const bx = -fila * 3.2
      const bz = lado * fila * 2.6
      const x = cx + Math.cos(ang) * bx - Math.sin(ang) * bz
      const z = cz + Math.sin(ang) * bx + Math.cos(ang) * bz
      im.setMatrixAt(nPal + k, visible ? mtx(x, alt + Math.sin(t * 1.3 + k) * 0.6, z, ry, ESCALA_V) : mtx(0, -500, 0, 0, 0.001))
    }
    im.instanceMatrix.needsUpdate = true
  }
  mover(0)
  w.animar.push((tk) => mover(tk.tiempo))
}

// ══════════════════════════════════════════════════════════════
// Lugares clicables: una caja invisible y baja sobre cada rectángulo
// ══════════════════════════════════════════════════════════════

const LUGARES_EXTERIORES = ["jardin-norte", "jardin-sur", "rosas", "piscina", "golf", "cancha-tenis", "cancha-padel", "cancha-basquet", "gimnasio-aire", "parque", "lafayette"]

function seleccion(w: Mundo) {
  // Material invisible: no se dibuja (cero llamadas), pero el rayo lo toca.
  const inv = new THREE.MeshBasicMaterial({ visible: false })
  for (const id of LUGARES_EXTERIORES) {
    const l = LUGAR[id]
    if (!l) continue
    const g = new THREE.BoxGeometry(l.x1 - l.x0, 0.5, l.z1 - l.z0)
    const m = new THREE.Mesh(g, inv)
    m.position.set((l.x0 + l.x1) / 2, 0.2, (l.z0 + l.z1) / 2)
    m.name = `lugar-${id}`
    m.userData.lugarId = id
    w.raiz.add(m)
    w.ctx.seleccionable(m, id)
  }
}

// ══════════════════════════════════════════════════════════════
// Entrada
// ══════════════════════════════════════════════════════════════

export function construirPaisaje(ctx: CtxEscena): void {
  const raiz = new THREE.Group()
  raiz.name = "paisaje"
  ctx.niveles.superficie.add(raiz)
  const T: U = { value: 0 }
  const N: U = { value: 0 }
  const base = crearMateriales(ctx, T, N)
  // Piedra de los pilares: la de las molduras del motor, para que la reja
  // combine con la fachada.
  const M = { ...base, piedraPilar: ctx.materiales.moldura }
  const cub = new Cubetas(ctx, raiz)
  cub.def("pasto", M.pasto, { recibe: true })
  cub.def("manzana", M.manzana, { recibe: true })
  cub.def("asfalto", M.asfalto, { recibe: true })
  cub.def("pavimento", M.pavimento, { recibe: true })
  cub.def("grava", M.grava, { recibe: true })
  cub.def("caminoPiedra", M.pavimento, { recibe: true })
  cub.def("superficie", M.superficie, { recibe: true })
  cub.def("pintura", M.pintura, { recibe: true })
  cub.def("follaje", M.follaje, { proyecta: true, recibe: true })
  cub.def("agua", M.agua, { recibe: true })
  cub.def("piedra", M.piedra, { proyecta: true, recibe: true })
  cub.def("hierro", M.hierro, { proyecta: true, recibe: false, uv: true })
  cub.def("props", M.props, { proyecta: true, recibe: true })
  cub.def("vidrio", M.vidrio, { recibe: false })
  cub.def("red", M.red, { recibe: false, uv: true })
  cub.def("bronce", M.bronce, { proyecta: true, recibe: true })

  const factor = ctx.calidad === "alta" ? 1 : ctx.calidad === "media" ? 0.75 : 0.5
  const w: Mundo = {
    ctx, raiz, M, cub, factor, r: azar(1600),
    arboles: [], faroles: [], globos: [], bancos: [], flores: [], matas: [], arbustos: [], ocupado: [], animar: [], chorros: [],
  }

  suelo(w)
  calles(w)
  jardinNorte(w)
  jardinSur(w)
  deportes(w)
  reja(w)
  lafayette(w)
  elipseYMall(w)
  monumento(w)
  arbolesDelPredio(w)
  plantar(w)
  farolesYBancos(w)
  chorrosYGotas(w)
  autos(w)
  pajaros(w)
  seleccion(w)
  cub.cerrar()

  // La "caída" de los nodos de la escena: lo estático no recalcula matrices.
  raiz.updateMatrixWorld(true)

  ctx.alActualizar((t) => {
    T.value = t.tiempo
    N.value = t.noche
    for (const f of w.animar) f(t)
  })
}
