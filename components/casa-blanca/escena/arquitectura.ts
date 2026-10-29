// ──────────────────────────────────────────────────────────────
// B1 · Arquitectura de la superficie
//
// La Residencia (fiel a la fachada norte real y al Pórtico Sur), el Ala Oeste
// con el Despacho Oval, la Columnata Oeste, la obra del salón de baile, el
// Edificio Eisenhower, el Tesoro y una ciudad de fondo.
//
// Todo se arma con geometría propia, sin modelos ni imágenes externas. Para
// que entre en el presupuesto de un juego que corre en el celular:
//  · cada edificio fusiona su geometría por material (un draw call por material),
//  · lo que se repite (columnas, balaustres, ventanas del EEOB) va instanciado,
//  · los materiales base salen de ctx.materiales para que todo tenga el mismo color.
//
// Ejes: +x este, +z sur, +y arriba. Origen: centro de la Residencia.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { HUELLAS } from "../lugares"
import type { TickEscena } from "../tipos"
import type { CtxEscena, Materiales } from "./contrato"

type P2 = [number, number]
const V3 = THREE.Vector3
const ARRIBA = new THREE.Vector3(0, 1, 0)
const GRAD = Math.PI / 180

// ── Azar con semilla: la ciudad y las ventanas encendidas salen iguales en cada carga ──
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

// ──────────────────────────────────────────────────────────────
// Utilidades de geometría
// ──────────────────────────────────────────────────────────────

/** Deja una geometría lista para fusionar: sin índice, con posición, normal y uv. */
function prep(g: THREE.BufferGeometry, color = false): THREE.BufferGeometry {
  const r = g.index ? g.toNonIndexed() : g
  if (r !== g) g.dispose()
  r.clearGroups()
  for (const k of Object.keys(r.attributes)) {
    if (k !== "position" && k !== "normal" && k !== "uv" && !(color && k === "color")) r.deleteAttribute(k)
  }
  if (!r.getAttribute("normal")) r.computeVertexNormals()
  if (!r.getAttribute("uv")) {
    r.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(r.getAttribute("position").count * 2), 2))
  }
  return r
}

/** Caja por sus extremos. */
function cajaE(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.001, Math.abs(y1 - y0) || 0.001, Math.abs(z1 - z0) || 0.001)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

function mT(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z)
}
function mTR(x: number, y: number, z: number, ry: number, s = 1): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeRotationY(ry)
  if (s !== 1) m.scale(new V3(s, s, s))
  return m.setPosition(x, y, z)
}
/** Matriz que lleva el eje x local a lo largo del tramo a→b (para vigas, rieles y barandas). */
function mTramo(a: THREE.Vector3, b: THREE.Vector3, escalaLargo = true): THREE.Matrix4 {
  const d = new V3().subVectors(b, a)
  const L = d.length()
  const x = d.clone().normalize()
  const ref = Math.abs(x.y) > 0.95 ? new V3(1, 0, 0) : ARRIBA
  const z = new V3().crossVectors(x, ref).normalize()
  const y = new V3().crossVectors(z, x).normalize()
  const m = new THREE.Matrix4().makeBasis(x, y, z)
  if (escalaLargo) m.scale(new V3(L, 1, 1))
  return m.setPosition(a.x + d.x / 2, a.y + d.y / 2, a.z + d.z / 2)
}

/** Invierte el sentido de los triángulos (para piezas espejadas). */
function invertirCaras(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const r = prep(g)
  for (const nombre of ["position", "normal", "uv"]) {
    const at = r.getAttribute(nombre) as THREE.BufferAttribute
    const n = at.itemSize
    const arr = at.array as Float32Array
    for (let i = 0; i < at.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const a = arr[(i + 1) * n + k]
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k]
        arr[(i + 2) * n + k] = a
      }
    }
    at.needsUpdate = true
  }
  return r
}

/**
 * Un plano de fachada: u a lo largo (hacia la derecha de quien la mira de
 * frente), v hacia arriba, d hacia afuera. Todo lo de una fachada se dibuja en
 * estas coordenadas y la matriz lo lleva al mundo.
 */
class Marco {
  readonly base: THREE.Matrix4
  readonly n: THREE.Vector3
  readonly u: THREE.Vector3
  readonly o: THREE.Vector3
  constructor(o: THREE.Vector3, n: THREE.Vector3) {
    this.o = o.clone()
    this.n = n.clone().normalize()
    this.u = new V3().crossVectors(ARRIBA, this.n).normalize()
    this.base = new THREE.Matrix4().makeBasis(this.u, ARRIBA, this.n).setPosition(this.o)
  }
  m(u = 0, v = 0, d = 0): THREE.Matrix4 {
    return this.base.clone().multiply(mT(u, v, d))
  }
  p(u: number, v: number, d: number): THREE.Vector3 {
    return new V3(u, v, d).applyMatrix4(this.base)
  }
}

/** Marco de un tramo recto en planta (x,z), con la normal hacia afuera. */
function marcoTramo(a: P2, b: P2, afuera: P2): Marco {
  const o = new V3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
  return new Marco(o, new V3(afuera[0], 0, afuera[1]))
}

// ── Barrido: un perfil de moldura llevado a lo largo de un camino ──
interface OpcBarrido {
  cerrado?: boolean
  /** Punto interior del camino (en a,b): define hacia dónde es "afuera" en caminos abiertos. */
  interior?: P2
  /** true: el perfil sobresale por la normal del plano (frontones); false: por el plano (cornisas). */
  vertical?: boolean
  tapas?: boolean
}

/**
 * Lleva un perfil (salida, altura) a lo largo de un camino 2D (a,b) con
 * esquinas a inglete. El perfil va de la base contra el muro, hacia afuera,
 * hacia arriba y vuelve al muro por arriba. `aMundo` convierte (a, b, h) en un
 * punto del mundo. La orientación de cada cara se corrige sola.
 */
function barrido(
  camino: P2[],
  perfil: P2[],
  aMundo: (a: number, b: number, h: number) => THREE.Vector3,
  o: OpcBarrido = {},
): THREE.BufferGeometry {
  const cerr = !!o.cerrado
  const c: P2[] = []
  for (const p of camino) {
    const q = c[c.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) c.push(p)
  }
  if (cerr && c.length > 2) {
    const a = c[0]
    const b = c[c.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5) c.pop()
  }
  const n = c.length
  const nSeg = cerr ? n : n - 1
  if (nSeg < 1) return new THREE.BufferGeometry()

  const tang: P2[] = []
  for (let i = 0; i < nSeg; i++) {
    const a = c[i]
    const b = c[(i + 1) % n]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    tang.push([(b[0] - a[0]) / L, (b[1] - a[1]) / L])
  }
  // ¿afuera es la izquierda del avance?
  let izq: boolean
  if (cerr) {
    let A = 0
    for (let i = 0; i < n; i++) A += c[i][0] * c[(i + 1) % n][1] - c[(i + 1) % n][0] * c[i][1]
    izq = A < 0
  } else {
    const ref = o.interior ?? [0, 0]
    const a = c[0]
    const t = tang[0]
    const l: P2 = [-t[1], t[0]]
    izq = (ref[0] - a[0]) * l[0] + (ref[1] - a[1]) * l[1] < 0
  }
  const nt: P2[] = tang.map((t) => (izq ? [-t[1], t[0]] : [t[1], -t[0]]))
  const mi: P2[] = []
  for (let i = 0; i < n; i++) {
    const n0 = cerr ? nt[(i - 1 + n) % n] : i > 0 ? nt[i - 1] : null
    const n1 = cerr ? nt[i] : i < nSeg ? nt[i] : null
    if (!n0) mi.push(n1!)
    else if (!n1) mi.push(n0)
    else {
      const d = 1 + n0[0] * n1[0] + n0[1] * n1[1]
      const k = 1 / Math.max(d, 0.25)
      mi.push([(n0[0] + n1[0]) * k, (n0[1] + n1[1]) * k])
    }
  }
  const vert = !!o.vertical
  const O0 = aMundo(0, 0, 0)
  const dirM = (a: number, b: number, h: number) => aMundo(a, b, h).sub(O0)
  const H3 = dirM(0, 0, 1).normalize()
  const pt = (i: number, j: number) => {
    const [pr, al] = perfil[j]
    const so = vert ? al : pr
    const sh = vert ? pr : al
    return aMundo(c[i][0] + so * mi[i][0], c[i][1] + so * mi[i][1], sh)
  }
  const pos: number[] = []
  const tri = (A: THREE.Vector3, B: THREE.Vector3, Cc: THREE.Vector3, esperado: THREE.Vector3) => {
    const nG = new V3().subVectors(B, A).cross(new V3().subVectors(Cc, A))
    if (nG.dot(esperado) >= 0) pos.push(A.x, A.y, A.z, B.x, B.y, B.z, Cc.x, Cc.y, Cc.z)
    else pos.push(A.x, A.y, A.z, Cc.x, Cc.y, Cc.z, B.x, B.y, B.z)
  }
  const np = perfil.length
  const filas: THREE.Vector3[][] = []
  for (let i = 0; i < n; i++) {
    const f: THREE.Vector3[] = []
    for (let j = 0; j < np; j++) f.push(pt(i, j))
    filas.push(f)
  }
  for (let s = 0; s < nSeg; s++) {
    const i0 = s
    const i1 = (s + 1) % n
    const O3 = dirM(nt[s][0], nt[s][1], 0).normalize()
    const PR = vert ? H3 : O3
    const AL = vert ? O3 : H3
    for (let j = 0; j < np - 1; j++) {
      const dpr = perfil[j + 1][0] - perfil[j][0]
      const dal = perfil[j + 1][1] - perfil[j][1]
      const esp = PR.clone().multiplyScalar(dal).addScaledVector(AL, -dpr)
      const A = filas[i0][j]
      const B = filas[i1][j]
      const Cc = filas[i1][j + 1]
      const D = filas[i0][j + 1]
      tri(A, B, Cc, esp)
      tri(A, Cc, D, esp)
    }
  }
  if (!cerr && o.tapas !== false) {
    const cont = perfil.map(([p, a]) => new THREE.Vector2(p, a))
    const tris = THREE.ShapeUtils.triangulateShape(cont, [])
    const ends: Array<[number, THREE.Vector3]> = [
      [0, dirM(-tang[0][0], -tang[0][1], 0)],
      [n - 1, dirM(tang[nSeg - 1][0], tang[nSeg - 1][1], 0)],
    ]
    for (const [i, esp] of ends) {
      for (const t of tris) tri(filas[i][t[0]], filas[i][t[1]], filas[i][t[2]], esp)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Polígono plano (convexo o en abanico) con su cara hacia `haciaAfuera`. */
function poligono(pts: THREE.Vector3[], haciaAfuera: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[0]
    const B = pts[i]
    const C = pts[i + 1]
    const nG = new V3().subVectors(B, A).cross(new V3().subVectors(C, A))
    if (nG.dot(haciaAfuera) >= 0) pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z)
    else pos.push(A.x, A.y, A.z, C.x, C.y, C.z, B.x, B.y, B.z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Losa horizontal con forma de `Shape` (en x, z) entre y0 e y1. */
function losa(forma: THREE.Shape, y0: number, y1: number, segs = 24): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(forma, { depth: y1 - y0, bevelEnabled: false, curveSegments: segs })
  // La forma está en (x, -z): al rotar -90° en X queda acostada.
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0, 0)
  return g
}
/** Forma en planta: los puntos (x, z) pasan a (x, -z) para que `losa` los deje en su lugar. */
function formaPlanta(pts: P2[]): THREE.Shape {
  const s = new THREE.Shape()
  pts.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)))
  s.closePath()
  return s
}
function puntosArco(cx: number, cz: number, r: number, a0: number, a1: number, segs: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)])
  }
  return out
}

// ── Huecos en muros ──
interface Hueco {
  u0: number
  u1: number
  v0: number
  /** Arranque del arco si `arco`; si no, borde superior. */
  v1: number
  arco?: boolean
}
const topeHueco = (h: Hueco) => (h.arco ? h.v1 + (h.u1 - h.u0) / 2 : h.v1)

/** Muro con huecos en el plano de un marco: cara exterior en d = 0, espesor hacia adentro. */
function geoMuro(u0: number, u1: number, v0: number, v1: number, esp: number, huecos: Hueco[]): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(u0, v0)
  s.lineTo(u1, v0)
  s.lineTo(u1, v1)
  s.lineTo(u0, v1)
  s.closePath()
  for (const h of huecos) {
    const p = new THREE.Path()
    p.moveTo(h.u0, h.v0)
    p.lineTo(h.u1, h.v0)
    p.lineTo(h.u1, h.v1)
    if (h.arco) p.absarc((h.u0 + h.u1) / 2, h.v1, (h.u1 - h.u0) / 2, 0, Math.PI, false)
    else p.lineTo(h.u0, h.v1)
    p.lineTo(h.u0, h.v0)
    s.holes.push(p)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: esp, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -esp)
  return g
}

// ──────────────────────────────────────────────────────────────
// Piezas: un grupo clicable con su geometría fusionada por material
// ──────────────────────────────────────────────────────────────

class Lote {
  private porMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  add(mat: THREE.Material, g: THREE.BufferGeometry, m?: THREE.Matrix4): void {
    const p = prep(g)
    if (m) p.applyMatrix4(m)
    const l = this.porMat.get(mat)
    if (l) l.push(p)
    else this.porMat.set(mat, [p])
  }
  vacio(): boolean {
    return this.porMat.size === 0
  }
  volcar(padre: THREE.Object3D, sombraDe: (m: THREE.Material) => [boolean, boolean]): THREE.Mesh[] {
    const out: THREE.Mesh[] = []
    for (const [mat, lista] of this.porMat) {
      const g = mergeGeometries(lista, false)
      lista.forEach((x) => x.dispose())
      if (!g) continue
      g.computeBoundingSphere()
      g.computeBoundingBox()
      const mesh = new THREE.Mesh(g, mat)
      const [cast, recv] = sombraDe(mat)
      mesh.castShadow = cast
      mesh.receiveShadow = recv
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      padre.add(mesh)
      out.push(mesh)
    }
    this.porMat.clear()
    return out
  }
}

interface Instancias {
  geo: THREE.BufferGeometry
  mat: THREE.Material
  mats: THREE.Matrix4[]
  sombra: boolean
  umbralNoche?: number
}

class Pieza {
  readonly grupo = new THREE.Group()
  readonly lote = new Lote()
  /** Ventanas que se encienden de noche: dos tandas para que no se prendan todas a la vez. */
  readonly nocheA = new Lote()
  readonly nocheB = new Lote()
  private inst = new Map<string, Instancias>()
  constructor(
    readonly lugarId: string | null,
    nombre: string,
  ) {
    this.grupo.name = nombre
  }
  instancia(clave: string, geo: () => THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, sombra = true, umbralNoche?: number): void {
    let e = this.inst.get(clave)
    if (!e) {
      e = { geo: geo(), mat, mats: [], sombra, umbralNoche }
      this.inst.set(clave, e)
    }
    e.mats.push(m)
  }
  cerrar(K: Constructor): void {
    const sombraDe = (m: THREE.Material): [boolean, boolean] => {
      if (!K.ctx.sombras) return [false, false]
      if (K.sinSombra.has(m)) return [false, true]
      return [true, true]
    }
    const mallas: THREE.Object3D[] = [...this.lote.volcar(this.grupo, sombraDe)]
    for (const m of this.nocheA.volcar(this.grupo, () => [false, false])) K.deNoche(m, 0.22)
    for (const m of this.nocheB.volcar(this.grupo, () => [false, false])) K.deNoche(m, 0.5)
    for (const e of this.inst.values()) {
      const im = new THREE.InstancedMesh(e.geo, e.mat, e.mats.length)
      e.mats.forEach((m, i) => im.setMatrixAt(i, m))
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
      im.computeBoundingBox()
      im.castShadow = K.ctx.sombras && e.sombra
      im.receiveShadow = K.ctx.sombras
      im.matrixAutoUpdate = false
      im.updateMatrix()
      this.grupo.add(im)
      if (e.umbralNoche !== undefined) K.deNoche(im, e.umbralNoche)
      else mallas.push(im)
    }
    if (this.lugarId) for (const m of mallas) K.ctx.seleccionable(m, this.lugarId)
    K.ctx.niveles.superficie.add(this.grupo)
  }
}

// ──────────────────────────────────────────────────────────────
// Materiales propios: lo que no está en ctx.materiales
// ──────────────────────────────────────────────────────────────

interface Propios {
  puerta: THREE.MeshStandardMaterial
  farol: THREE.MeshStandardMaterial
  luzObra: THREE.MeshStandardMaterial
  rojo: THREE.MeshStandardMaterial
  amarillo: THREE.MeshStandardMaterial
  lona: THREE.MeshStandardMaterial
  hormigon: THREE.MeshStandardMaterial
  contenedor: THREE.MeshStandardMaterial
  pizarra: THREE.MeshStandardMaterial
  bandera: THREE.MeshStandardMaterial
  ciudad: THREE.MeshStandardMaterial[]
  ciudadTecho: THREE.MeshStandardMaterial
  oxido: THREE.MeshStandardMaterial
}

function texturaBandera(): THREE.CanvasTexture {
  const W = 760
  const H = 400
  const cv = document.createElement("canvas")
  cv.width = W
  cv.height = H
  const g = cv.getContext("2d")!
  const franja = H / 13
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF"
    g.fillRect(0, Math.round(i * franja), W, Math.ceil(franja) + 1)
  }
  const cw = W * 0.4
  const ch = franja * 7
  g.fillStyle = "#3C3B6E"
  g.fillRect(0, 0, cw, ch)
  g.fillStyle = "#FFFFFF"
  const estrella = (cx: number, cy: number, r: number) => {
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? r : r * 0.382
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      const x = cx + rr * Math.cos(a)
      const y = cy + rr * Math.sin(a)
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.fill()
  }
  const r = H * 0.0616 * 0.5 * 1.1
  for (let fila = 0; fila < 9; fila++) {
    const y = ((fila + 1) * ch) / 10
    const seis = fila % 2 === 0
    const cant = seis ? 6 : 5
    for (let k = 0; k < cant; k++) {
      const x = seis ? ((2 * k + 1) * cw) / 12 : ((2 * k + 2) * cw) / 12
      estrella(x, y, r)
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Fachadas de la ciudad de fondo: 8 vanos x 8 pisos por textura, con su mapa
 * de luces (ventanas encendidas de noche al azar). Sin letreros ni texto.
 */
function texturasCiudad(tam: number, rnd: () => number): Array<{ mapa: THREE.CanvasTexture; luz: THREE.CanvasTexture }> {
  const estilos = [
    { fondo: "#d8d1c2", vidrio: ["#28323a", "#34414a"], marco: "#efe9dc", banda: "#c6bfae", ancho: 0.5, alto: 0.56 },
    { fondo: "#3b4c56", vidrio: ["#2a3b45", "#3f5562"], marco: "#a9b3b8", banda: "#56656d", ancho: 0.9, alto: 0.7 },
    { fondo: "#c4ac8d", vidrio: ["#2b2f33", "#3a3f44"], marco: "#e6dccb", banda: "#b29a7b", ancho: 0.42, alto: 0.6 },
    { fondo: "#e8e4dc", vidrio: ["#1f2a30", "#2c3a42"], marco: "#ffffff", banda: "#d8d2c6", ancho: 0.62, alto: 0.5 },
  ]
  return estilos.map((e, idx) => {
    const cv = document.createElement("canvas")
    cv.width = cv.height = tam
    const g = cv.getContext("2d")!
    const lv = document.createElement("canvas")
    lv.width = lv.height = tam
    const gl = lv.getContext("2d")!
    gl.fillStyle = "#000"
    gl.fillRect(0, 0, tam, tam)
    g.fillStyle = e.fondo
    g.fillRect(0, 0, tam, tam)
    // Grano de la piedra: manchas suaves para que no se vea plano.
    for (let i = 0; i < tam * 2; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},${0.03 + rnd() * 0.04})`
      g.fillRect(rnd() * tam, rnd() * tam, 2 + rnd() * 6, 1 + rnd() * 3)
    }
    const cel = tam / 8
    for (let fila = 0; fila < 8; fila++) {
      const y0 = fila * cel
      g.fillStyle = e.banda
      g.fillRect(0, y0 + cel * 0.9, tam, cel * 0.1)
      for (let col = 0; col < 8; col++) {
        const x0 = col * cel
        const ww = cel * e.ancho
        const hh = cel * e.alto
        const wx = x0 + (cel - ww) / 2
        const wy = y0 + cel * 0.16
        if (idx === 1) {
          // Muro cortina: vidrio continuo con montantes.
          g.fillStyle = e.vidrio[(col + fila) % 2]
          g.fillRect(x0 + 2, y0 + 2, cel - 4, cel * 0.82)
          g.fillStyle = e.marco
          g.fillRect(x0, y0, 3, cel)
        } else {
          g.fillStyle = e.marco
          g.fillRect(wx - 3, wy - 3, ww + 6, hh + 6)
          const grad = g.createLinearGradient(0, wy, 0, wy + hh)
          grad.addColorStop(0, e.vidrio[1])
          grad.addColorStop(1, e.vidrio[0])
          g.fillStyle = grad
          g.fillRect(wx, wy, ww, hh)
          g.fillStyle = "rgba(255,255,255,0.18)"
          g.fillRect(wx + ww / 2 - 1, wy, 2, hh)
        }
        const r = rnd()
        if (r < 0.42) {
          const calido = rnd() < 0.8
          const k = 0.55 + rnd() * 0.45
          gl.fillStyle = calido
            ? `rgb(${Math.round(255 * k)},${Math.round(196 * k)},${Math.round(120 * k)})`
            : `rgb(${Math.round(200 * k)},${Math.round(222 * k)},${Math.round(255 * k)})`
          if (idx === 1) gl.fillRect(x0 + 3, y0 + 3, cel - 6, cel * 0.8)
          else gl.fillRect(wx, wy, ww, hh)
        }
      }
    }
    const mapa = new THREE.CanvasTexture(cv)
    const luz = new THREE.CanvasTexture(lv)
    for (const t of [mapa, luz]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 4
    }
    return { mapa, luz }
  })
}

// ──────────────────────────────────────────────────────────────
// Elementos clásicos: columnas, balaustres, ventanas, frontones
// ──────────────────────────────────────────────────────────────

/** Fuste estriado (y de 0 a alto) con éntasis: el tercio de abajo recto y después se afina. */
function geoFusteEstriado(r0: number, r1: number, alto: number, estrias: number): THREE.BufferGeometry {
  const anillos = 6
  const porEstria = 3
  const nCol = estrias * porEstria
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const paso = (Math.PI * 2) / estrias
  for (let a = 0; a <= anillos; a++) {
    const t = a / anillos
    const r = t < 1 / 3 ? r0 : r0 + (r1 - r0) * Math.pow((t - 1 / 3) / (2 / 3), 1.25)
    for (let k = 0; k <= nCol; k++) {
      const kk = k % nCol
      const est = Math.floor(kk / porEstria)
      const sub = kk % porEstria
      let ang = est * paso
      let rr = r
      if (sub === 1) ang += paso * 0.16
      else if (sub === 2) {
        ang += paso * 0.58
        rr = r * 0.93
      }
      pos.push(Math.cos(ang) * rr, t * alto, Math.sin(ang) * rr)
      uv.push(k / nCol, t)
    }
  }
  const fila = nCol + 1
  for (let a = 0; a < anillos; a++) {
    for (let k = 0; k < nCol; k++) {
      const A = a * fila + k
      const B = (a + 1) * fila + k
      const C = a * fila + k + 1
      const D = (a + 1) * fila + k + 1
      idx.push(A, B, C, B, D, C)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function torno(puntos: P2[], segs: number): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    puntos.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  )
}

/** Basa ática (plinto, toro, escocia, toro) para una columna de diámetro D. Altura 0,5 D. */
function geoBasa(D: number, segs: number, cuadrada = true): THREE.BufferGeometry[] {
  const r = D / 2
  const out: THREE.BufferGeometry[] = []
  if (cuadrada) out.push(cajaE(-r * 1.32, r * 1.32, 0, D * 0.16, -r * 1.32, r * 1.32))
  out.push(
    torno(
      [
        [0, D * 0.16],
        [r * 1.26, D * 0.16],
        [r * 1.3, D * 0.2],
        [r * 1.26, D * 0.26],
        [r * 1.12, D * 0.28],
        [r * 1.06, D * 0.33],
        [r * 1.12, D * 0.38],
        [r * 1.14, D * 0.42],
        [r * 1.08, D * 0.46],
        [r * 1.0, D * 0.5],
        [0, D * 0.5],
      ],
      segs,
    ),
  )
  return out
}

/** Espiral de voluta (tubo) en el plano z = zf, centrada en (cx, cy). */
function geoVoluta(cx: number, cy: number, zf: number, r0: number, sentido: number, grosor: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  const vueltas = 2.1
  const N = 40
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const ang = Math.PI / 2 + sentido * t * vueltas * Math.PI * 2
    const r = r0 * (1 - 0.82 * t)
    pts.push(new V3(cx + Math.cos(ang) * r * sentido * -1, cy + Math.sin(ang) * r, zf))
  }
  const curva = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curva, 26, grosor, 4, false)
}

/** Capitel jónico para una columna de diámetro D. y = 0 en la punta del fuste; alto 0,4 D. */
function geoCapitelJonico(D: number, segs: number): THREE.BufferGeometry[] {
  const r1 = D * 0.42
  const out: THREE.BufferGeometry[] = []
  const astr = new THREE.TorusGeometry(r1 + D * 0.015, D * 0.03, 5, segs)
  astr.rotateX(Math.PI / 2)
  astr.translate(0, D * 0.02, 0)
  out.push(astr)
  out.push(
    torno(
      [
        [r1 * 0.9, D * 0.04],
        [r1 + D * 0.05, D * 0.07],
        [r1 + D * 0.09, D * 0.13],
        [r1 + D * 0.08, D * 0.18],
        [0, D * 0.18],
      ],
      segs,
    ),
  )
  // Cojín entre las volutas.
  out.push(cajaE(-D * 0.5, D * 0.5, D * 0.16, D * 0.31, -D * 0.31, D * 0.31))
  const vr = D * 0.19
  const vy = D * 0.2
  for (const sx of [-1, 1]) {
    const cil = new THREE.CylinderGeometry(vr, vr * 0.92, D * 0.64, 14)
    cil.rotateX(Math.PI / 2)
    cil.translate(sx * D * 0.5, vy, 0)
    out.push(cil)
    for (const sz of [-1, 1]) out.push(geoVoluta(sx * D * 0.5, vy, sz * D * 0.325, vr * 0.97, sx, D * 0.022))
  }
  // Ábaco.
  out.push(cajaE(-D * 0.6, D * 0.6, D * 0.31, D * 0.37, -D * 0.6, D * 0.6))
  out.push(cajaE(-D * 0.63, D * 0.63, D * 0.37, D * 0.4, -D * 0.63, D * 0.63))
  return out
}

/** Columna jónica completa (basa + fuste estriado + capitel) de diámetro D y alto total H. */
function geoColumnaJonica(D: number, H: number, estrias: number): THREE.BufferGeometry {
  const segs = estrias >= 20 ? 20 : 14
  const hb = D * 0.5
  const hc = D * 0.4
  const partes = [...geoBasa(D, segs)]
  const fuste = geoFusteEstriado(D / 2, D * 0.42, H - hb - hc, estrias)
  fuste.translate(0, hb, 0)
  partes.push(fuste)
  for (const p of geoCapitelJonico(D, segs)) {
    p.translate(0, H - hc, 0)
    partes.push(p)
  }
  return mergeGeometries(partes.map((p) => prep(p)))!
}

/** Columna toscana (lisa) de diámetro D y alto H. */
function geoColumnaToscana(D: number, H: number): THREE.BufferGeometry {
  const r = D / 2
  const partes: THREE.BufferGeometry[] = [
    cajaE(-r * 1.3, r * 1.3, 0, D * 0.14, -r * 1.3, r * 1.3),
    torno(
      [
        [0, D * 0.14],
        [r * 1.2, D * 0.14],
        [r * 1.24, D * 0.22],
        [r * 1.16, D * 0.3],
        [r * 1.02, D * 0.33],
        [0, D * 0.33],
      ],
      14,
    ),
  ]
  const fuste = new THREE.CylinderGeometry(r * 0.84, r, H - D * 0.33 - D * 0.36, 16, 1, true)
  fuste.translate(0, D * 0.33 + (H - D * 0.33 - D * 0.36) / 2, 0)
  partes.push(fuste)
  const cap = torno(
    [
      [r * 0.84, 0],
      [r * 0.92, D * 0.04],
      [r * 0.86, D * 0.08],
      [r * 0.9, D * 0.12],
      [r * 1.12, D * 0.22],
      [0, D * 0.22],
    ],
    14,
  )
  cap.translate(0, H - D * 0.36, 0)
  partes.push(cap)
  partes.push(cajaE(-r * 1.22, r * 1.22, H - D * 0.14, H, -r * 1.22, r * 1.22))
  return mergeGeometries(partes.map((p) => prep(p)))!
}

/** Balaustre de alto 1 (se escala por instancia): jarrón de un solo vientre. */
function geoBalaustre(): THREE.BufferGeometry {
  const pts: P2[] = [
    [0, 0],
    [0.12, 0],
    [0.12, 0.1],
    [0.075, 0.14],
    [0.13, 0.36],
    [0.125, 0.5],
    [0.06, 0.7],
    [0.08, 0.78],
    [0.12, 0.88],
    [0.12, 1],
    [0, 1],
  ]
  return prep(torno(pts, 6))
}

// ──────────────────────────────────────────────────────────────
// El constructor: guarda el contexto, los materiales y las cosas que se animan
// ──────────────────────────────────────────────────────────────

class Constructor {
  readonly M: Materiales
  readonly P: Propios
  readonly rnd: () => number
  readonly sinSombra = new Set<THREE.Material>()
  private nocturnos: Array<{ obj: THREE.Object3D; umbral: number }> = []
  readonly animaciones: Array<(t: TickEscena) => void> = []
  private cache = new Map<string, THREE.BufferGeometry>()
  constructor(readonly ctx: CtxEscena) {
    this.M = ctx.materiales
    this.rnd = azar(1792)
    this.P = this.crearPropios()
    this.sinSombra.add(this.M.vidrio)
    this.sinSombra.add(this.M.ventanaNoche)
    this.sinSombra.add(this.P.farol)
    this.sinSombra.add(this.P.luzObra)
    this.sinSombra.add(this.P.rojo)
  }
  geo(clave: string, crear: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.cache.get(clave)
    if (!g) {
      g = crear()
      this.cache.set(clave, g)
    }
    return g
  }
  deNoche(obj: THREE.Object3D, umbral: number): void {
    obj.visible = false
    this.nocturnos.push({ obj, umbral })
  }
  actualizarNoche(noche: number): void {
    for (const n of this.nocturnos) n.obj.visible = noche > n.umbral
  }
  /** Agrega el vidrio de una ventana y, al azar, su capa encendida de noche. */
  vidrio(P: Pieza, g: THREE.BufferGeometry, m: THREE.Matrix4, prob = 0.45, enc?: THREE.BufferGeometry): void {
    P.lote.add(this.M.vidrio, g.clone(), m)
    const r = this.rnd()
    const gn = (enc ?? g).clone()
    gn.translate(0, 0, 0.012)
    if (r < prob * 0.6) P.nocheA.add(this.M.ventanaNoche, gn, m)
    else if (r < prob) P.nocheB.add(this.M.ventanaNoche, gn, m)
    else gn.dispose()
    g.dispose()
  }
  private crearPropios(): Propios {
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    const farol = std({ color: 0xfff0cf, emissive: 0xffb45a, emissiveIntensity: 0.15, roughness: 0.25 })
    const luzObra = std({ color: 0xd8dde0, emissive: 0xfff1d8, emissiveIntensity: 0, roughness: 0.3 })
    const rojo = std({ color: 0x7a1010, emissive: 0xff2a1a, emissiveIntensity: 0.4, roughness: 0.4 })
    // El farol del Pórtico Norte: a 2 m de la cámara, con 4 quemaba el centro del cuadro.
    this.ctx.alAnochecer(farol, 1.2, 0.12)
    this.ctx.alAnochecer(luzObra, 7, 0)
    this.ctx.alAnochecer(rojo, 6, 0.5)
    const bandera = std({ map: texturaBandera(), side: THREE.DoubleSide, roughness: 0.85 })
    const tam = this.ctx.calidad === "baja" ? 256 : 512
    const ciudad = texturasCiudad(tam, azar(2026)).map((t, i) => {
      const m = std({
        map: t.mapa,
        emissiveMap: t.luz,
        emissive: 0xffffff,
        emissiveIntensity: 0,
        roughness: i === 1 ? 0.35 : 0.85,
        metalness: i === 1 ? 0.35 : 0,
      })
      this.ctx.alAnochecer(m, 1.4, 0)
      return m
    })
    return {
      puerta: std({ color: 0x1a1f1d, roughness: 0.45, metalness: 0.1 }),
      farol,
      luzObra,
      rojo,
      amarillo: std({ color: 0xf2b100, roughness: 0.5, metalness: 0.35 }),
      lona: std({ color: 0x2c4434, roughness: 0.95 }),
      hormigon: std({ color: 0xa3a19a, roughness: 0.92 }),
      contenedor: std({ vertexColors: true, roughness: 0.7, metalness: 0.25 }),
      pizarra: std({ color: 0x3d434b, roughness: 0.62, metalness: 0.25 }),
      bandera,
      ciudad,
      ciudadTecho: std({ color: 0x77756f, roughness: 0.95 }),
      oxido: std({ color: 0x8a3b22, roughness: 0.7, metalness: 0.4 }),
    }
  }

  // ── Molduras de uso general ──

  /** Ventana de guillotina con marco, parteluces, alféizar y (opcional) frontón. Devuelve su hueco. */
  ventana(P: Pieza, f: Marco, u: number, o: OpcVentana): Hueco {
    const { w, h, v0 } = o
    const M = this.M
    const lote = P.lote
    const prof = o.prof ?? 0.24
    const hw = w / 2
    const hueco: Hueco = o.arco ? { u0: u - hw, u1: u + hw, v0, v1: v0 + h, arco: true } : { u0: u - hw, u1: u + hw, v0, v1: v0 + h }
    const top = topeHueco(hueco)
    // Vidrio
    let gv: THREE.BufferGeometry
    if (o.arco) {
      const s = new THREE.Shape()
      s.moveTo(-hw, 0)
      s.lineTo(hw, 0)
      s.lineTo(hw, h)
      s.absarc(0, h, hw, 0, Math.PI, false)
      s.lineTo(-hw, 0)
      gv = new THREE.ShapeGeometry(s, 10)
    } else {
      gv = new THREE.PlaneGeometry(w, h)
      gv.translate(0, h / 2, 0)
    }
    const mv = f.m(u, v0, -prof)
    if (o.dobleCara) {
      const gb = gv.clone()
      gb.rotateY(Math.PI)
      lote.add(M.vidrio, gb, f.m(u, v0, -prof - 0.02))
    }
    this.vidrio(P, gv, mv, o.noche ?? 0.45)
    // Parteluces (madera pintada de blanco)
    const dm0 = -prof + 0.015
    const dm1 = -prof + 0.07
    const barra = (u0: number, u1: number, a: number, b: number) =>
      lote.add(M.moldura, cajaE(u + u0, u + u1, a, b, dm0, dm1), f.base)
    const tipo = o.hoja ?? "6x6"
    if (tipo !== "ninguna") {
      const e = 0.07
      barra(-hw, -hw + e, v0, v0 + h)
      barra(hw - e, hw, v0, v0 + h)
      barra(-hw, hw, v0, v0 + 0.1)
      if (!o.arco) barra(-hw, hw, v0 + h - e, v0 + h)
      if (tipo === "6x6") {
        barra(-hw, hw, v0 + h / 2 - 0.04, v0 + h / 2 + 0.04)
        for (const k of [1, 3]) barra(-hw, hw, v0 + (h * k) / 4 - 0.018, v0 + (h * k) / 4 + 0.018)
        for (const k of [-1, 1]) barra((k * w) / 6 - 0.018, (k * w) / 6 + 0.018, v0, v0 + h)
      } else if (tipo === "francesa") {
        barra(-0.035, 0.035, v0, v0 + h)
        for (let k = 1; k < 5; k++) barra(-hw, hw, v0 + (h * k) / 5 - 0.018, v0 + (h * k) / 5 + 0.018)
        for (const k of [-1, 1]) barra(k * hw * 0.5 - 0.016, k * hw * 0.5 + 0.016, v0, v0 + h)
      } else if (tipo === "arco") {
        for (const k of [-1, 1]) barra((k * w) / 6 - 0.018, (k * w) / 6 + 0.018, v0, v0 + h)
        for (let k = 1; k < 4; k++) barra(-hw, hw, v0 + (h * k) / 4 - 0.018, v0 + (h * k) / 4 + 0.018)
        // Rayos del abanico
        for (let k = 1; k < 6; k++) {
          const a = (k * Math.PI) / 6
          const g = cajaE(0, hw, -0.018, 0.018, dm0, dm1)
          g.rotateZ(a)
          lote.add(M.moldura, g, f.m(u, v0 + h, 0))
        }
      }
    }
    if (o.marco === false) return hueco
    // Marco (arquitrabe) y alféizar
    const mb = 0.17
    const sal = 0.07
    lote.add(M.moldura, cajaE(u - hw - mb, u - hw, v0, o.arco ? v0 + h : top, 0, sal), f.base)
    lote.add(M.moldura, cajaE(u + hw, u + hw + mb, v0, o.arco ? v0 + h : top, 0, sal), f.base)
    if (o.arco) {
      const arco = puntosArco(0, 0, hw + mb / 2, Math.PI, 0, 14).map(([x, y]) => [x, y] as P2)
      const perfil: P2[] = [
        [0, -mb / 2],
        [sal, -mb / 2],
        [sal, mb / 2],
        [0, mb / 2],
      ]
      lote.add(
        M.moldura,
        barrido(arco, perfil, (a, b, hh) => f.p(u + a, v0 + h + b, hh), { interior: [0, -10], vertical: true }),
      )
      lote.add(M.moldura, cajaE(u - 0.16, u + 0.16, top - 0.05, top + mb + 0.12, 0, sal + 0.05), f.base)
    } else {
      lote.add(M.moldura, cajaE(u - hw - mb, u + hw + mb, top, top + mb, 0, sal), f.base)
    }
    if (!o.sinAlfeizar) lote.add(M.moldura, cajaE(u - hw - mb - 0.06, u + hw + mb + 0.06, v0 - 0.1, v0, 0, 0.15), f.base)
    if (o.fronton) this.fronton(P, f, u, top + mb, w + mb * 2, o.fronton)
    else if (o.cornisa) {
      lote.add(M.moldura, cajaE(u - hw - mb, u + hw + mb, top + mb, top + mb + 0.22, 0, 0.05), f.base)
      lote.add(M.moldura, cajaE(u - hw - mb - 0.12, u + hw + mb + 0.12, top + mb + 0.22, top + mb + 0.34, 0, 0.2), f.base)
    }
    return hueco
  }

  /** Frontón de ventana sobre un friso con ménsulas: triangular o curvo. */
  fronton(P: Pieza, f: Marco, u: number, vb: number, ancho: number, tipo: "tri" | "curvo"): void {
    const M = this.M
    const lote = P.lote
    const hw = ancho / 2
    lote.add(M.moldura, cajaE(u - hw, u + hw, vb, vb + 0.3, 0, 0.05), f.base)
    for (const s of [-1, 1]) lote.add(M.moldura, cajaE(u + s * (hw + 0.02) - 0.08, u + s * (hw + 0.02) + 0.08, vb - 0.3, vb + 0.3, 0, 0.2), f.base)
    const v1 = vb + 0.3
    lote.add(M.moldura, cajaE(u - hw - 0.2, u + hw + 0.2, v1, v1 + 0.12, 0, 0.22), f.base)
    lote.add(M.moldura, cajaE(u - hw - 0.25, u + hw + 0.25, v1 + 0.12, v1 + 0.18, 0, 0.28), f.base)
    const base = v1 + 0.18
    const ext = hw + 0.25
    const perfil: P2[] = [
      [0, 0],
      [0.2, 0],
      [0.22, 0.06],
      [0.28, 0.1],
      [0.29, 0.16],
      [0, 0.17],
    ]
    let camino: P2[]
    let timpano: THREE.Shape
    if (tipo === "tri") {
      const alto = ext * Math.tan(21 * GRAD)
      camino = [
        [-ext, 0],
        [0, alto],
        [ext, 0],
      ]
      timpano = new THREE.Shape()
      timpano.moveTo(-ext + 0.05, 0)
      timpano.lineTo(ext - 0.05, 0)
      timpano.lineTo(0, alto - 0.02)
      timpano.closePath()
    } else {
      const sag = ext * 0.36
      const R = (ext * ext + sag * sag) / (2 * sag)
      const cy = sag - R
      const a0 = Math.atan2(-cy, ext)
      camino = puntosArco(0, cy, R, Math.PI - a0, a0, 12)
      timpano = new THREE.Shape()
      timpano.moveTo(-ext + 0.05, 0)
      timpano.lineTo(ext - 0.05, 0)
      timpano.absarc(0, cy, R - 0.02, a0, Math.PI - a0, false)
      timpano.closePath()
    }
    lote.add(
      M.moldura,
      barrido(camino, perfil, (a, b, h) => f.p(u + a, base + b, h), { interior: [0, -5], vertical: true }),
    )
    const gt = new THREE.ShapeGeometry(timpano, 10)
    lote.add(M.fachada, gt, f.m(u, base, 0.05))
  }

  /** Balaustrada a lo largo de una polilínea 3D: zócalo, balaustres, pasamanos y pedestales. */
  balaustrada(P: Pieza, pts: THREE.Vector3[], o: OpcBalaustrada): void {
    const M = this.M
    const mat = o.mat ?? M.moldura
    const alto = o.alto ?? 1.3
    const paso = o.paso ?? 0.32
    const ancho = o.ancho ?? 0.34
    const zocalo = Math.min(0.24, alto * 0.18)
    const pasam = Math.min(0.22, alto * 0.17)
    const hb = alto - zocalo - pasam
    const cadaPed = o.pedestal ?? 4.2
    const geoB = this.geo("balaustre", geoBalaustre)
    const peds: THREE.Vector3[] = []
    const n = pts.length
    const tramos = o.cerrado ? n : n - 1
    for (let i = 0; i < tramos; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % n]
      const L = a.distanceTo(b)
      if (L < 1e-4) continue
      // Zócalo y pasamanos siguen el tramo (también en pendiente).
      const mz = mTramo(a, b)
      P.lote.add(mat, cajaE(-0.5, 0.5, 0, zocalo, -ancho / 2 - 0.03, ancho / 2 + 0.03), mz)
      P.lote.add(mat, cajaE(-0.5, 0.5, alto - pasam, alto - 0.06, -ancho / 2 - 0.02, ancho / 2 + 0.02), mz)
      P.lote.add(mat, cajaE(-0.5, 0.5, alto - 0.06, alto, -ancho / 2 - 0.06, ancho / 2 + 0.06), mz)
      const esq = o.esquinas === undefined || o.esquinas.includes(i)
      if (esq || i === 0) peds.push(a.clone())
      const nPed = Math.max(0, Math.round(L / cadaPed) - 1)
      for (let k = 1; k <= nPed; k++) peds.push(a.clone().lerp(b, k / (nPed + 1)))
      const subs = nPed + 1
      for (let s = 0; s < subs; s++) {
        const s0 = s / subs
        const s1 = (s + 1) / subs
        const libre = L * (s1 - s0) - (esq || s > 0 ? 0.25 : 0.05) - 0.25
        const cant = Math.max(1, Math.floor(libre / paso))
        for (let k = 0; k < cant; k++) {
          const t = s0 + ((s1 - s0) * (k + 0.5)) / cant
          const p = a.clone().lerp(b, t)
          const m = new THREE.Matrix4().makeScale(hb * 0.95, hb, hb * 0.95).setPosition(p.x, p.y + zocalo, p.z)
          P.instancia(`bal-${mat.uuid}`, () => geoB, mat, m)
        }
      }
    }
    if (!o.cerrado) peds.push(pts[n - 1].clone())
    for (const p of peds) {
      const w = ancho + 0.16
      P.lote.add(mat, cajaE(-w / 2, w / 2, 0, alto + 0.02, -w / 2, w / 2), mT(p.x, p.y, p.z))
      P.lote.add(mat, cajaE(-w / 2 - 0.05, w / 2 + 0.05, alto + 0.02, alto + 0.1, -w / 2 - 0.05, w / 2 + 0.05), mT(p.x, p.y, p.z))
    }
  }

  /** Pilastra plana con basa y capitel sencillos. */
  pilastra(P: Pieza, f: Marco, u: number, v0: number, v1: number, ancho = 0.9, sal = 0.18, jonica = true): void {
    const M = this.M
    const hw = ancho / 2
    P.lote.add(M.moldura, cajaE(u - hw - 0.08, u + hw + 0.08, v0, v0 + 0.3, 0, sal + 0.08), f.base)
    P.lote.add(M.moldura, cajaE(u - hw, u + hw, v0 + 0.3, v1 - 0.35, 0, sal), f.base)
    P.lote.add(M.moldura, cajaE(u - hw - 0.06, u + hw + 0.06, v1 - 0.35, v1 - 0.12, 0, sal + 0.05), f.base)
    P.lote.add(M.moldura, cajaE(u - hw - 0.12, u + hw + 0.12, v1 - 0.12, v1, 0, sal + 0.1), f.base)
    if (jonica) {
      for (const s of [-1, 1]) {
        const c = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10)
        c.rotateX(Math.PI / 2)
        P.lote.add(M.moldura, c, f.m(u + s * (hw - 0.02), v1 - 0.26, sal + 0.06))
      }
    }
  }

  /** Almohadillado: hiladas horizontales con juntas, cortadas en los huecos. */
  rustico(P: Pieza, f: Marco, u0: number, u1: number, v0: number, v1: number, huecos: Hueco[], filas: number, mat?: THREE.Material): void {
    const hf = (v1 - v0) / filas
    for (let r = 0; r < filas; r++) {
      const a = v0 + r * hf + (r === 0 ? 0 : 0.03)
      const b = v0 + (r + 1) * hf - 0.03
      const bloq = huecos
        .filter((h) => h.v0 < b && topeHueco(h) > a)
        .map((h) => [h.u0 - 0.17, h.u1 + 0.17] as P2)
        .sort((x, y) => x[0] - y[0])
      let cur = u0
      for (const [x0, x1] of bloq) {
        if (x0 > cur + 0.05) P.lote.add(mat ?? this.M.fachada, cajaE(cur, x0, a, b, 0, 0.06), f.base)
        cur = Math.max(cur, x1)
      }
      if (cur < u1 - 0.05) P.lote.add(mat ?? this.M.fachada, cajaE(cur, u1, a, b, 0, 0.06), f.base)
    }
  }

  /** Dentículos bajo la cornisa, a lo largo de un tramo recto. */
  denticulos(P: Pieza, f: Marco, u0: number, u1: number, v: number, sal0: number, saltar?: (u: number) => boolean): void {
    for (let u = u0 + 0.2; u < u1 - 0.1; u += 0.32) {
      if (saltar && saltar(u)) continue
      P.lote.add(this.M.moldura, cajaE(u - 0.08, u + 0.08, v, v + 0.22, sal0, sal0 + 0.18), f.base)
    }
  }
}

interface OpcVentana {
  w: number
  h: number
  v0: number
  fronton?: "tri" | "curvo"
  cornisa?: boolean
  arco?: boolean
  marco?: boolean
  hoja?: "6x6" | "francesa" | "arco" | "ninguna"
  noche?: number
  prof?: number
  dobleCara?: boolean
  sinAlfeizar?: boolean
}

interface OpcBalaustrada {
  alto?: number
  paso?: number
  ancho?: number
  pedestal?: number
  cerrado?: boolean
  /** Índices de los tramos que empiezan con pedestal (esquinas). Por defecto, todos. */
  esquinas?: number[]
  mat?: THREE.Material
}

// ── Perfiles de molduras (salida, altura) ──

/** Entablamento principal (arquitrabe, friso y cornisa), 2,8 m de alto. */
const ENTABLAMENTO: P2[] = [
  [0, 0],
  [0.1, 0],
  [0.1, 0.2],
  [0.14, 0.22],
  [0.14, 0.4],
  [0.18, 0.42],
  [0.18, 0.6],
  [0.12, 0.62],
  [0.12, 1.55],
  [0.18, 1.6],
  [0.24, 1.7],
  [0.24, 1.95],
  [0.45, 2.0],
  [0.86, 2.05],
  [0.88, 2.3],
  [0.95, 2.38],
  [1.02, 2.5],
  [1.02, 2.6],
  [0.5, 2.68],
  [0, 2.8],
]
const conAltura = (perfil: P2[], y0: number, k = 1, ks = k): P2[] => perfil.map(([s, h]) => [s * ks, y0 + h * k])

const IMPOSTA: P2[] = [
  [0, 0],
  [0.05, 0],
  [0.08, 0.04],
  [0.08, 0.14],
  [0.12, 0.18],
  [0.12, 0.24],
  [0, 0.26],
]

// ──────────────────────────────────────────────────────────────
// Dimensiones de la Residencia (metros)
//
// La fachada norte mide 18,4 m de alto y la sur 21,3 m: la planta baja queda
// enterrada del lado norte. Aquí el suelo es plano, así que la fachada norte
// muestra dos pisos (como la foto) y la sur tres, con la misma cornisa.
// ──────────────────────────────────────────────────────────────
const RES = HUELLAS.residencia
const Y = {
  arquitrabe: 14.0,
  cornisa: 16.8,
  techoTope: 19.4,
  /** Piso principal del lado sur (sobre la planta baja). */
  principalSur: 3.45,
  balcon: 8.6,
  imposta: 9.2,
  segundoAlfeizar: 9.6,
  segundoAlto: 3.0,
}
const EJES_LADO = [0, 1, 2, 3].map((i) => 10.5 + ((RES.x1 - 10.5) * (i + 0.5)) / 4)
const PS = HUELLAS.porticoSur
/** El arco del Salón Azul, que asoma en la fachada sur detrás del pórtico. */
const R_BOW = 4.0
const R_COL_SUR = 9.0
const R_VIGA_SUR = 8.3

// ──────────────────────────────────────────────────────────────
// La Residencia
// ──────────────────────────────────────────────────────────────

function construirResidencia(K: Constructor): void {
  const res = new Pieza("habitaciones", "residencia")
  const pn = new Pieza("jardin-norte", "portico-norte")
  const bal = new Pieza("balcon-truman", "balcon-truman")
  const M = K.M

  fachadaNorte(K, res, pn)
  fachadaSur(K, res)
  fachadasLaterales(K, res)
  porticoNorte(K, pn)
  porticoSur(K, res, bal)
  techoResidencia(K, res)

  // Entablamento corrido alrededor de la casa.
  const rect: P2[] = [
    [RES.x1, RES.z0],
    [RES.x0, RES.z0],
    [RES.x0, RES.z1],
    [RES.x1, RES.z1],
  ]
  res.lote.add(M.moldura, barrido(rect, conAltura(ENTABLAMENTO, Y.arquitrabe), (a, b, h) => new V3(a, h, b), { cerrado: true }))
  // Imposta a la altura del segundo piso.
  res.lote.add(M.moldura, barrido(rect, conAltura(IMPOSTA, Y.imposta - 0.26), (a, b, h) => new V3(a, h, b), { cerrado: true }))
  // Dentículos (se saltean donde los tapan los pórticos).
  const caras: Array<[Marco, number, (u: number) => boolean]> = [
    [new Marco(new V3(0, 0, RES.z0), new V3(0, 0, -1)), RES.x1, (u) => Math.abs(u) < 10.4],
    [new Marco(new V3(0, 0, RES.z1), new V3(0, 0, 1)), RES.x1, (u) => Math.abs(u) < 9.6],
    [new Marco(new V3(RES.x1, 0, 0), new V3(1, 0, 0)), RES.z1, () => false],
    [new Marco(new V3(RES.x0, 0, 0), new V3(-1, 0, 0)), RES.z1, () => false],
  ]
  for (const [f, L, saltar] of caras) K.denticulos(res, f, -L, L, Y.arquitrabe + 1.72, 0.24, saltar)

  // Balaustrada del techo: corre por los cuatro lados y por encima del Pórtico Sur;
  // se corta donde está el frontón del Pórtico Norte.
  const yb = Y.cornisa
  const d = 0.2
  const xE = RES.x1 + d
  const zN = RES.z0 - d
  const zS = RES.z1 + d
  const arcoSur = puntosArco(PS.cx, PS.cz + d, 9.4, 0, Math.PI, 26).map(([x, z]) => new V3(x, yb, z))
  const camino: THREE.Vector3[] = [
    new V3(11.2, yb, zN),
    new V3(xE, yb, zN),
    new V3(xE, yb, zS),
    new V3(9.4, yb, zS),
    ...arcoSur.slice(1, -1),
    new V3(-9.4, yb, zS),
    new V3(-xE, yb, zS),
    new V3(-xE, yb, zN),
    new V3(-11.2, yb, zN),
  ]
  const esquinas = [0, 1, 2, 3, camino.length - 5, camino.length - 4, camino.length - 3, camino.length - 2]
  K.balaustrada(res, camino, { alto: 1.42, esquinas, pedestal: 3.9 })

  // Las piezas de la Residencia: interiores.ts las corta a la altura de la planta que se mira.
  for (const p of [res, pn, bal]) p.grupo.userData.edificio = "residencia"
  res.cerrar(K)
  pn.cerrar(K)
  bal.cerrar(K)
}

/** Fachada norte: la de la foto. Dos pisos sobre un zócalo bajo, once ejes. */
function fachadaNorte(K: Constructor, P: Pieza, pn: Pieza): void {
  const M = K.M
  const f = new Marco(new V3(0, 0, RES.z0), new V3(0, 0, -1))
  const huecos: Hueco[] = []
  const vP = 1.85
  const hP = 3.6
  // Planta principal: frontones alternados (triangular en las puntas).
  EJES_LADO.forEach((e, i) => {
    const tipo = i % 2 === 0 ? "curvo" : "tri"
    for (const s of [-1, 1]) huecos.push(K.ventana(P, f, s * e, { w: 1.6, h: hP, v0: vP, fronton: tipo, noche: 0.5 }))
  })
  // Bajo el pórtico: dos ventanas y la puerta.
  for (const s of [-1, 1]) huecos.push(K.ventana(pn, f, s * 7, { w: 1.6, h: hP, v0: vP, fronton: "curvo", noche: 0.6 }))
  huecos.push(puertaNorte(K, pn, f))
  // Segundo piso: ventanas simples con marco.
  for (const u of [...EJES_LADO, ...EJES_LADO.map((e) => -e)]) {
    huecos.push(K.ventana(P, f, u, { w: 1.5, h: Y.segundoAlto, v0: Y.segundoAlfeizar, cornisa: false, noche: 0.4 }))
  }
  for (const u of [-7, 0, 7]) huecos.push(K.ventana(pn, f, u, { w: 1.5, h: Y.segundoAlto, v0: Y.segundoAlfeizar, noche: 0.5 }))
  P.lote.add(M.fachada, geoMuro(RES.x0, RES.x1, 0, Y.cornisa, 0.7, huecos), f.base)
  // Zócalo bajo (lo tapan los setos de boj), cortado en la puerta.
  for (const [a, b] of [
    [RES.x0, -2.4],
    [2.4, RES.x1],
  ]) {
    P.lote.add(M.fachada, cajaE(a, b, 0, 1.0, 0, 0.12), f.base)
    P.lote.add(M.moldura, cajaE(a, b, 1.0, 1.14, 0, 0.17), f.base)
  }
  // Paneles bajo las ventanas principales.
  for (const u of [...EJES_LADO, ...EJES_LADO.map((e) => -e), -7, 7]) {
    P.lote.add(M.moldura, cajaE(u - 0.75, u + 0.75, 1.2, 1.65, 0, 0.05), f.base)
  }
}

/** La puerta norte: hoja oscura, montante en abanico, escalones. */
function puertaNorte(K: Constructor, P: Pieza, f: Marco): Hueco {
  const M = K.M
  const lote = P.lote
  const hw = 1.2
  const v0 = 0.45
  const vA = 4.75
  // Hojas de la puerta con tableros.
  lote.add(K.P.puerta, cajaE(-hw, hw, v0, vA, -0.42, -0.34), f.base)
  for (const s of [-1, 1]) {
    for (const [a, b] of [
      [v0 + 0.3, v0 + 1.9],
      [v0 + 2.2, vA - 0.3],
    ]) {
      lote.add(K.P.puerta, cajaE(s * 0.15, s * (hw - 0.18), a, b, -0.34, -0.3), f.base)
    }
  }
  lote.add(M.moldura, cajaE(-hw, hw, vA - 0.06, vA + 0.08, -0.4, -0.26), f.base)
  // Montante: medio círculo de vidrio con rayos.
  const s = new THREE.Shape()
  s.moveTo(-hw, 0)
  s.lineTo(hw, 0)
  s.absarc(0, 0, hw, 0, Math.PI, false)
  s.closePath()
  const gv = new THREE.ShapeGeometry(s, 16)
  K.vidrio(P, gv, f.m(0, vA, -0.36), 1)
  for (let k = 1; k < 8; k++) {
    const g = cajaE(0.18, hw, -0.02, 0.02, -0.34, -0.3)
    g.rotateZ((k * Math.PI) / 8)
    lote.add(M.moldura, g, f.m(0, vA + 0.04, 0))
  }
  const anillo = barrido(
    puntosArco(0, 0, 0.42, Math.PI, 0, 10),
    [
      [0, -0.03],
      [0.05, -0.03],
      [0.05, 0.03],
      [0, 0.03],
    ],
    (a, b, h) => f.p(a, vA + 0.04 + b, -0.34 + h),
    { interior: [0, -5], vertical: true },
  )
  lote.add(M.moldura, anillo)
  // Marco: pilastras a los lados y arco moldurado con clave.
  for (const sx of [-1, 1]) K.pilastra(P, f, sx * (hw + 0.38), v0, vA, 0.5, 0.14, false)
  lote.add(
    M.moldura,
    barrido(
      puntosArco(0, 0, hw + 0.12, Math.PI, 0, 18),
      [
        [0, -0.12],
        [0.1, -0.12],
        [0.12, 0.0],
        [0.1, 0.12],
        [0, 0.14],
      ],
      (a, b, h) => f.p(a, vA + b, h),
      { interior: [0, -5], vertical: true },
    ),
  )
  lote.add(M.moldura, cajaE(-0.2, 0.2, vA + hw - 0.1, vA + hw + 0.45, 0, 0.18), f.base)
  // Escalones de piedra.
  for (let k = 0; k < 3; k++) {
    lote.add(M.moldura, cajaE(-2.3 + k * 0.1, 2.3 - k * 0.1, 0, 0.15 * (k + 1), 0, 1.25 - k * 0.4), f.base)
  }
  return { u0: -hw, u1: hw, v0, v1: vA, arco: true }
}

/** Pórtico Norte: cuatro columnas jónicas al frente, frontón liso y el farol. */
function porticoNorte(K: Constructor, P: Pieza): void {
  const M = K.M
  const D = 1.5
  const zF = -20.9
  const xs = [-9.6, -3.3, 3.3, 9.6]
  const estrias = K.ctx.calidad === "baja" ? 12 : 24
  const H = Y.arquitrabe
  const geoCol = () => K.geo(`jonica-${D}-${H}-${estrias}`, () => geoColumnaJonica(D, H, estrias))
  for (const x of xs) P.instancia("col", geoCol, M.moldura, mT(x, 0, zF))
  for (const x of [-9.6, 9.6]) P.instancia("col", geoCol, M.moldura, mTR(x, 0, -17.0, Math.PI / 2))
  // Pilastras contra el muro, detrás de cada columna.
  const f = new Marco(new V3(0, 0, RES.z0), new V3(0, 0, -1))
  for (const x of xs) K.pilastra(P, f, x, 0.15, H, 1.3, 0.2)
  // Bloque del pórtico (techo) con el entablamento en sus tres lados.
  const xA = 10.22
  const zA = -21.55
  P.lote.add(M.fachada, cajaE(-xA, xA, H, Y.cornisa, zA, RES.z0 + 0.2))
  const camino: P2[] = [
    [-xA, RES.z0],
    [-xA, zA],
    [xA, zA],
    [xA, RES.z0],
  ]
  P.lote.add(M.moldura, barrido(camino, conAltura(ENTABLAMENTO, H), (a, b, h) => new V3(a, h, b), { interior: [0, -17] }))
  const fF = new Marco(new V3(0, 0, zA), new V3(0, 0, -1))
  K.denticulos(P, fF, -xA, xA, H + 1.72, 0.24)
  for (const sx of [-1, 1]) {
    const fl = new Marco(new V3(sx * xA, 0, (zA + RES.z0) / 2), new V3(sx, 0, 0))
    K.denticulos(P, fl, -(RES.z0 - zA) / 2, (RES.z0 - zA) / 2, H + 1.72, 0.24)
  }
  // Cielorraso con casetones.
  for (const z of [-19.2, -16.0]) P.lote.add(M.moldura, cajaE(-xA, xA, H - 0.35, H, z - 0.18, z + 0.18))
  for (const x of [-6.45, 0, 6.45]) P.lote.add(M.moldura, cajaE(x - 0.18, x + 0.18, H - 0.35, H, zA, RES.z0))
  // Frontón triangular liso.
  const ext = xA + 0.95
  const pend = 15 * GRAD
  const alto = ext * Math.tan(pend)
  const yb = Y.cornisa - 0.05
  const perfilFr: P2[] = [
    [0, 0],
    [0.5, 0],
    [0.55, 0.12],
    [0.88, 0.2],
    [0.9, 0.45],
    [0.97, 0.52],
    [1.02, 0.62],
    [1.02, 0.7],
    [0, 0.75],
  ]
  P.lote.add(
    M.moldura,
    barrido(
      [
        [-ext, yb],
        [0, yb + alto],
        [ext, yb],
      ],
      perfilFr,
      (a, b, h) => fF.p(a, b, h),
      { interior: [0, 0], vertical: true },
    ),
  )
  const tim = new THREE.Shape()
  tim.moveTo(-ext + 0.4, 0)
  tim.lineTo(ext - 0.4, 0)
  tim.lineTo(0, alto - 0.1)
  tim.closePath()
  P.lote.add(M.fachada, new THREE.ShapeGeometry(tim), fF.m(0, yb, 0.1))
  // Techo a dos aguas detrás del frontón.
  const cumbre = yb + alto + 0.75
  const alero = yb + 0.7
  const z0 = zA - 0.9
  const z1 = RES.z0 + 4
  for (const sx of [-1, 1]) {
    P.lote.add(
      M.techoMetal,
      poligono([new V3(0, cumbre, z0), new V3(sx * (ext - 0.05), alero, z0), new V3(sx * (ext - 0.05), alero, z1), new V3(0, cumbre, z1)], new V3(sx, 1, 0)),
    )
  }
  P.lote.add(M.fachada, cajaE(-xA, xA, Y.cornisa, Y.cornisa + 0.5, zA, RES.z0))
  // Piso de piedra bajo el pórtico (por aquí pasan los autos).
  P.lote.add(M.acera, cajaE(-xA - 0.5, xA + 0.5, 0, 0.05, zA - 0.6, RES.z0))
  farol(K, P, 0, 7.4, -17.4, H)
}

/** El farol de hierro y vidrio que cuelga sobre la puerta norte. De noche brilla. */
function farol(K: Constructor, P: Pieza, x: number, y: number, z: number, techo: number): void {
  const M = K.M
  const H = 2.1
  const W = 1.05
  const hw = W / 2
  const L = P.lote
  const m0 = mT(x, y, z)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.add(M.hierroNegro, cajaE(sx * hw - 0.04, sx * hw + 0.04, 0, H, sz * hw - 0.04, sz * hw + 0.04), m0)
  for (const yy of [0, H * 0.5, H]) {
    const e = yy === H * 0.5 ? 0.02 : 0.05
    for (const s of [-1, 1]) {
      L.add(M.hierroNegro, cajaE(-hw - 0.05, hw + 0.05, yy - e, yy + e, s * hw - 0.05, s * hw + 0.05), m0)
      L.add(M.hierroNegro, cajaE(s * hw - 0.05, s * hw + 0.05, yy - e, yy + e, -hw - 0.05, hw + 0.05), m0)
    }
  }
  // Corona y remate inferior (pirámides de cuatro caras) con perillas.
  const corona = new THREE.ConeGeometry(hw * 1.55, 0.62, 4, 1)
  corona.rotateY(Math.PI / 4)
  corona.translate(0, H + 0.31, 0)
  L.add(M.hierroNegro, corona, m0)
  const base = new THREE.ConeGeometry(hw * 1.2, 0.5, 4, 1)
  base.rotateY(Math.PI / 4)
  base.rotateX(Math.PI)
  base.translate(0, -0.25, 0)
  L.add(M.hierroNegro, base, m0)
  const perilla = new THREE.SphereGeometry(0.1, 8, 6)
  L.add(M.hierroNegro, perilla.clone().translate(0, -0.6, 0), m0)
  L.add(M.hierroNegro, perilla.translate(0, H + 0.7, 0), m0)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4
    const voluta = new THREE.TorusGeometry(0.2, 0.025, 4, 10, Math.PI * 1.3)
    voluta.rotateY(-a)
    voluta.translate(Math.cos(a) * hw * 0.95, H + 0.55, -Math.sin(a) * hw * 0.95)
    L.add(M.hierroNegro, voluta, m0)
  }
  // Cadena hasta el cielorraso.
  L.add(M.hierroNegro, cajaE(-0.025, 0.025, H + 0.75, techo - y, -0.025, 0.025), m0)
  for (let yy = H + 1.0; yy < techo - y - 0.2; yy += 0.45) {
    const esl = new THREE.TorusGeometry(0.07, 0.016, 4, 8)
    if (Math.round(yy / 0.45) % 2 === 0) esl.rotateY(Math.PI / 2)
    L.add(M.hierroNegro, esl.translate(0, yy, 0), m0)
  }
  // Vidrios (brillan de noche).
  for (let k = 0; k < 4; k++) {
    const g = new THREE.PlaneGeometry(W - 0.08, H - 0.1)
    g.translate(0, H / 2, hw)
    g.rotateY((k * Math.PI) / 2)
    L.add(K.P.farol, g, m0)
  }
  const nucleo = new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8)
  nucleo.translate(0, H * 0.45, 0)
  L.add(K.P.farol, nucleo, m0)
  // Luz cálida del farol: ilumina el cielorraso y la puerta.
  const luz = new THREE.PointLight(0xffb866, 0, 22, 2)
  luz.position.set(x, y + H * 0.5, z)
  P.grupo.add(luz)
  // A 1–3 m del cielorraso y las columnas: con 60 las quemaba de blanco.
  K.ctx.luzNocturna(luz, 12)
}

/** Fachada sur: tres pisos (la planta baja a la vista) y el arco del Salón Azul. */
function fachadaSur(K: Constructor, P: Pieza): void {
  const M = K.M
  const f = new Marco(new V3(0, 0, RES.z1), new V3(0, 0, 1))
  const huecos: Hueco[] = []
  const bajas: Hueco[] = []
  EJES_LADO.forEach((e, i) => {
    const tipo = i % 2 === 0 ? "curvo" : "tri"
    for (const s of [-1, 1]) {
      const hb = K.ventana(P, f, s * e, { w: 1.4, h: 1.9, v0: 0.9, noche: 0.35, sinAlfeizar: true })
      huecos.push(hb)
      bajas.push(hb)
      huecos.push(K.ventana(P, f, s * e, { w: 1.6, h: 3.3, v0: 4.3, fronton: tipo, noche: 0.5 }))
      huecos.push(K.ventana(P, f, s * e, { w: 1.5, h: Y.segundoAlto, v0: Y.segundoAlfeizar, noche: 0.4 }))
    }
  })
  // El muro se corta donde abre el arco del Salón Azul: por dentro, la sala oval sigue hasta el arco.
  const abre = R_BOW - 0.62
  P.lote.add(M.fachada, geoMuro(RES.x0, -abre, 0, Y.cornisa, 0.7, huecos.filter((h) => h.u1 < -abre)), f.base)
  P.lote.add(M.fachada, geoMuro(abre, RES.x1, 0, Y.cornisa, 0.7, huecos.filter((h) => h.u0 > abre)), f.base)
  K.rustico(P, f, RES.x0, -R_BOW, 0, Y.principalSur - 0.05, bajas, 8)
  K.rustico(P, f, R_BOW, RES.x1, 0, Y.principalSur - 0.05, bajas, 8)
  // Pilastras donde termina el pórtico.
  for (const s of [-1, 1]) K.pilastra(P, f, s * 9.7, Y.principalSur, Y.arquitrabe, 1.1, 0.2)
  arcoSalonAzul(K, P)
}

/** El muro curvo del Salón Azul (y de la Sala Oval Amarilla arriba), con normales suaves. */
function arcoSalonAzul(K: Constructor, P: Pieza): void {
  const M = K.M
  const cortes = [0, 22.5, 45, 75, 105, 135, 157.5, 180].map((a) => a * GRAD)
  for (let i = 0; i < cortes.length - 1; i++) {
    const a0 = cortes[i]
    const a1 = cortes[i + 1]
    const am = (a0 + a1) / 2
    const L = 2 * R_BOW * Math.sin((a1 - a0) / 2)
    const ap = R_BOW * Math.cos((a1 - a0) / 2)
    const n = new V3(Math.cos(am), 0, Math.sin(am))
    const f = new Marco(new V3(PS.cx + n.x * ap, 0, PS.cz + n.z * ap), n)
    const huecos: Hueco[] = []
    const conVentana = i >= 2 && i <= 4
    if (conVentana) {
      const centro = i === 3
      if (centro) huecos.push(K.ventana(P, f, 0, { w: 1.3, h: 2.7, v0: 0, hoja: "francesa", noche: 0.8, sinAlfeizar: true }))
      else huecos.push(K.ventana(P, f, 0, { w: 1.2, h: 1.9, v0: 0.9, noche: 0.5, sinAlfeizar: true }))
      huecos.push(K.ventana(P, f, 0, { w: 1.25, h: 3.9, v0: Y.principalSur + 0.05, hoja: "francesa", noche: 0.7, cornisa: true }))
      huecos.push(K.ventana(P, f, 0, { w: 1.2, h: 3.0, v0: Y.balcon + 0.05, hoja: "francesa", noche: 0.7, sinAlfeizar: true }))
    }
    const g = geoMuro(-L / 2 - 0.01, L / 2 + 0.01, 0, Y.cornisa, 0.6, huecos)
    // Normales radiales en la cara exterior: el muro se ve curvo aunque sean tramos planos.
    const pos = g.getAttribute("position")
    const nor = g.getAttribute("normal")
    for (let k = 0; k < pos.count; k++) {
      if (nor.getZ(k) > 0.99) {
        const v = new V3(pos.getX(k), 0, ap).normalize()
        nor.setXYZ(k, v.x, 0, v.z)
      }
    }
    P.lote.add(M.fachada, g, f.base)
    K.rustico(P, f, -L / 2, L / 2, 0, Y.principalSur - 0.05, huecos.filter((h) => h.v0 < 3), 8)
  }
  // Molduras corridas sobre el arco.
  const arco = puntosArco(PS.cx, PS.cz, R_BOW, 0, Math.PI, 7)
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  P.lote.add(M.moldura, barrido(arco, conAltura(IMPOSTA, Y.principalSur - 0.05), xz, { interior: [PS.cx, PS.cz] }))
  P.lote.add(M.moldura, barrido(arco, conAltura(IMPOSTA, Y.imposta - 0.26), xz, { interior: [PS.cx, PS.cz] }))
}

/** Fachadas este y oeste: cinco ejes y tres pisos. */
function fachadasLaterales(K: Constructor, P: Pieza): void {
  const M = K.M
  const zIn = RES.z1 - 0.7
  for (const sx of [1, -1]) {
    const f = new Marco(new V3(sx * RES.x1, 0, 0), new V3(sx, 0, 0))
    const huecos: Hueco[] = []
    const bajas: Hueco[] = []
    const ejes = [-9.6, -4.8, 0, 4.8, 9.6]
    ejes.forEach((u, i) => {
      // En el oeste, el eje que da a la Columnata es una puerta.
      const zMundo = f.p(u, 0, 0).z
      const aColumnata = sx < 0 && zMundo > 3 && zMundo < 8
      const hb = aColumnata
        ? K.ventana(P, f, u, { w: 1.5, h: 2.9, v0: 0, hoja: "francesa", noche: 0.7, sinAlfeizar: true })
        : K.ventana(P, f, u, { w: 1.4, h: 1.9, v0: 0.9, noche: 0.35, sinAlfeizar: true })
      huecos.push(hb)
      bajas.push(hb)
      if (i === 2) huecos.push(K.ventana(P, f, u, { w: 1.8, h: 3.0, v0: 4.3, arco: true, hoja: "arco", noche: 0.6 }))
      else huecos.push(K.ventana(P, f, u, { w: 1.6, h: 3.3, v0: 4.3, fronton: i % 2 === 0 ? "tri" : "curvo", noche: 0.5 }))
      huecos.push(K.ventana(P, f, u, { w: 1.5, h: Y.segundoAlto, v0: Y.segundoAlfeizar, noche: 0.4 }))
    })
    P.lote.add(M.fachada, geoMuro(-zIn, zIn, 0, Y.cornisa, 0.7, huecos), f.base)
    K.rustico(P, f, -RES.z1, RES.z1, 0, Y.principalSur - 0.05, bajas, 8)
    for (const u of [-2.4, 2.4]) K.pilastra(P, f, u, Y.principalSur, Y.arquitrabe, 0.95, 0.18)
  }
  // Remate de la planta baja (este, sur y oeste).
  // Cada tramo termina donde empieza el arco del Salón Azul (antes cruzaban el arco y, por dentro, el piso del salón).
  const camino: P2[] = [
    [RES.x1, RES.z0],
    [RES.x1, RES.z1],
    [R_BOW, RES.z1],
  ]
  const camino2: P2[] = [
    [-R_BOW, RES.z1],
    [RES.x0, RES.z1],
    [RES.x0, RES.z0],
  ]
  for (const c of [camino, camino2]) {
    P.lote.add(M.moldura, barrido(c, conAltura(IMPOSTA, Y.principalSur - 0.05), (a, b, h) => new V3(a, h, b), { interior: [0, 0] }))
  }
}

/** Pórtico Sur: semicírculo de columnas jónicas sobre la planta baja, balcón Truman y escaleras curvas. */
function porticoSur(K: Constructor, P: Pieza, bal: Pieza): void {
  const M = K.M
  const D = 1.25
  const y0 = Y.principalSur
  const H = Y.arquitrabe - y0
  const estrias = K.ctx.calidad === "baja" ? 12 : 24
  const geoCol = () => K.geo(`jonica-${D}-${H}-${estrias}`, () => geoColumnaJonica(D, H, estrias))
  const angs = [15, 45, 75, 105, 135, 165].map((a) => a * GRAD)
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  for (const a of angs) {
    const x = PS.cx + Math.cos(a) * R_COL_SUR
    const z = PS.cz + Math.sin(a) * R_COL_SUR
    P.instancia("col", geoCol, M.moldura, mTR(x, y0, z, Math.PI / 2 - a))
    // Pilar almohadillado de la planta baja bajo cada columna.
    const m = mTR(x, 0, z, Math.PI / 2 - a)
    P.lote.add(M.fachada, cajaE(-0.82, 0.82, 0, y0 - 0.45, -0.82, 0.82), m)
    for (let k = 1; k < 7; k++) P.lote.add(M.fachada, cajaE(-0.86, 0.86, k * 0.42 - 0.17, k * 0.42 + 0.17, -0.86, 0.86), m)
  }
  // Piso del pórtico (sobre la planta baja) con su canto moldurado.
  const anillo = (r0: number, r1: number): THREE.Shape => {
    const pts = [...puntosArco(PS.cx, PS.cz, r1, 0, Math.PI, 36), ...puntosArco(PS.cx, PS.cz, r0, Math.PI, 0, 24)]
    return formaPlanta(pts)
  }
  P.lote.add(M.moldura, losa(anillo(R_BOW - 0.1, 9.75), y0 - 0.45, y0))
  P.lote.add(
    M.moldura,
    barrido(puntosArco(PS.cx, PS.cz, 9.75, 0, Math.PI, 36), conAltura(IMPOSTA, y0 - 0.45, 1.6), xz, { interior: [PS.cx, PS.cz] }),
  )
  // Entablamento curvo sobre las columnas y techo del pórtico.
  const perfilViga: P2[] = [[0, 0], [1.18, 0], ...ENTABLAMENTO.slice(1).map(([s, h]) => [s + 1.18, h] as P2)]
  perfilViga[perfilViga.length - 1] = [0, 2.8]
  P.lote.add(
    M.moldura,
    barrido(puntosArco(PS.cx, PS.cz, R_VIGA_SUR, 0, Math.PI, 40), conAltura(perfilViga, Y.arquitrabe), xz, { interior: [PS.cx, PS.cz] }),
  )
  const semi = formaPlanta([...puntosArco(PS.cx, PS.cz, R_VIGA_SUR + 0.05, 0, Math.PI, 36)])
  P.lote.add(M.fachada, losa(semi, Y.arquitrabe, Y.cornisa - 0.02))
  const fCurva = (r: number) => (a: number) => new Marco(new V3(PS.cx + Math.cos(a) * r, 0, PS.cz + Math.sin(a) * r), new V3(Math.cos(a), 0, Math.sin(a)))
  for (let k = 0; k < 64; k++) {
    const a = ((k + 0.5) / 64) * Math.PI
    const f = fCurva(R_VIGA_SUR + 1.42)(a)
    P.lote.add(M.moldura, cajaE(-0.07, 0.07, Y.arquitrabe + 1.72, Y.arquitrabe + 1.94, 0, 0.17), f.base)
  }
  // Balcón Truman: piso a la altura del segundo piso, baranda detrás de las columnas.
  bal.lote.add(M.moldura, losa(anillo(R_BOW - 0.05, R_VIGA_SUR + 0.1), Y.balcon - 0.38, Y.balcon))
  bal.lote.add(
    M.moldura,
    barrido(puntosArco(PS.cx, PS.cz, R_VIGA_SUR + 0.1, 0, Math.PI, 36), conAltura(IMPOSTA, Y.balcon - 0.4, 1.4), xz, { interior: [PS.cx, PS.cz] }),
  )
  const baranda = puntosArco(PS.cx, PS.cz + 0.0, 8.0, 8 * GRAD, 172 * GRAD, 30).map(([x, z]) => new V3(x, Y.balcon, z))
  K.balaustrada(bal, baranda, { alto: 1.05, paso: 0.24, ancho: 0.24, esquinas: [0], pedestal: 4.2 })
  // Las dos escaleras curvas que bajan al jardín.
  for (const s of [1, -1]) escaleraCurva(K, P, s)
}

function escaleraCurva(K: Constructor, P: Pieza, s: number): void {
  const M = K.M
  const r0 = 10.5
  const r1 = 12.6
  const aTop = 6 * GRAD
  const aBot = 58 * GRAD
  const pasos = 21
  const yTop = Y.principalSur
  const ang = (a: number) => (s > 0 ? a : Math.PI - a)
  for (let k = 0; k < pasos; k++) {
    const a = ang(aTop + ((aBot - aTop) * (k + 0.5)) / pasos)
    const yk = yTop - (k * yTop) / pasos
    const largo = ((r0 + r1) / 2) * ((aBot - aTop) / pasos) + 0.06
    const m = mTR(PS.cx + Math.cos(a) * ((r0 + r1) / 2), 0, PS.cz + Math.sin(a) * ((r0 + r1) / 2), Math.PI / 2 - a)
    P.lote.add(M.moldura, cajaE(-largo / 2, largo / 2, 0, yk, -(r1 - r0) / 2, (r1 - r0) / 2), m)
  }
  // Descanso arriba, contra el muro.
  const aL = ang(aTop / 2 - 1 * GRAD)
  P.lote.add(M.moldura, cajaE(-1.0, 1.0, 0, yTop, -(r1 - 9.0) / 2, (r1 - 9.0) / 2), mTR(PS.cx + Math.cos(aL) * ((r1 + 9.0) / 2), 0, PS.cz + Math.sin(aL) * ((r1 + 9.0) / 2), Math.PI / 2 - aL))
  // Barandas a los dos lados, siguiendo la pendiente.
  for (const r of [r0 + 0.15, r1 - 0.15]) {
    const pts: THREE.Vector3[] = []
    const N = 8
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const a = ang(aTop + (aBot - aTop) * t)
      pts.push(new V3(PS.cx + Math.cos(a) * r, yTop * (1 - t) + 0.02, PS.cz + Math.sin(a) * r))
    }
    K.balaustrada(P, pts, { alto: 1.05, paso: 0.3, ancho: 0.26, esquinas: [0], pedestal: 99 })
  }
}

/** Techo de metal gris de poca pendiente, chimeneas, asta con bandera y antenas. */
function techoResidencia(K: Constructor, P: Pieza): void {
  const M = K.M
  const y0 = Y.cornisa
  const y1 = Y.techoTope
  const ax = RES.x1 - 1.2
  const az = RES.z1 - 1.2
  const bx = 17
  const bz = 5
  const A = new V3(-ax, y0, -az)
  const B = new V3(ax, y0, -az)
  const C = new V3(ax, y0, az)
  const D = new V3(-ax, y0, az)
  const a = new V3(-bx, y1, -bz)
  const b = new V3(bx, y1, -bz)
  const c = new V3(bx, y1, bz)
  const d = new V3(-bx, y1, bz)
  P.lote.add(M.techoMetal, poligono([A, B, b, a], new V3(0, 1, -1)))
  P.lote.add(M.techoMetal, poligono([C, D, d, c], new V3(0, 1, 1)))
  P.lote.add(M.techoMetal, poligono([B, C, c, b], new V3(1, 1, 0)))
  P.lote.add(M.techoMetal, poligono([D, A, a, d], new V3(-1, 1, 0)))
  P.lote.add(M.techoMetal, poligono([a, b, c, d], new V3(0, 1, 0)))
  // Juntas alzadas de la chapa (dan textura a la luz rasante).
  for (let x = -ax + 1; x < ax; x += 1.6) {
    for (const s of [-1, 1]) {
      const xt = Math.max(-bx, Math.min(bx, x))
      const p0 = new V3(x, y0 + 0.04, s * az)
      const p1 = new V3(xt, y1 + 0.04, s * bz)
      P.lote.add(M.techoMetal, cajaE(-0.5, 0.5, -0.03, 0.03, -0.03, 0.03), mTramo(p0, p1))
    }
  }
  // Chimeneas blancas con remate.
  for (const [x, z] of [
    [-13.6, -7.4],
    [13.6, -7.4],
    [-13.6, 7.4],
    [13.6, 7.4],
    [-22.4, 0],
    [22.4, 0],
  ]) {
    const m = mT(x, 0, z)
    const ancha = Math.abs(x) > 20
    const hx = ancha ? 1.2 : 0.75
    const hz = ancha ? 0.75 : 1.45
    const top = ancha ? 21.3 : 22.6
    P.lote.add(M.fachada, cajaE(-hx, hx, y0, top, -hz, hz), m)
    P.lote.add(M.moldura, cajaE(-hx - 0.15, hx + 0.15, top, top + 0.28, -hz - 0.15, hz + 0.15), m)
    P.lote.add(M.moldura, cajaE(-hx - 0.05, hx + 0.05, top + 0.28, top + 0.42, -hz - 0.05, hz + 0.05), m)
    for (const k of ancha ? [-0.5, 0.5] : [-0.6, 0, 0.6]) {
      const pot = new THREE.CylinderGeometry(0.17, 0.2, 0.55, 8)
      pot.translate(ancha ? k : 0, top + 0.7, ancha ? 0 : k)
      P.lote.add(M.techoMetal, pot, m)
    }
  }
  // Antenas finas.
  for (const [x, z, h] of [
    [-4.2, 2.6, 5.5],
    [5.1, 3.1, 4.2],
    [-6.8, -2.2, 3.4],
  ]) {
    const g = new THREE.CylinderGeometry(0.035, 0.05, h, 5)
    g.translate(x, y1 + h / 2, z)
    P.lote.add(M.hierroNegro, g)
    for (let k = 1; k <= 2; k++) P.lote.add(M.hierroNegro, cajaE(x - 0.5, x + 0.5, y1 + h * (0.5 + k * 0.2), y1 + h * (0.5 + k * 0.2) + 0.04, z - 0.02, z + 0.02))
  }
  P.lote.add(M.techoMetal, cajaE(-2.4, 2.4, y1, y1 + 0.9, 0.8, 3.6))
  banderaEnElTecho(K, P, 0, y1, 0)
}

/** Asta y bandera de EE. UU. que ondea (desplazamiento de vértices por cuadro). */
function banderaEnElTecho(K: Constructor, P: Pieza, x: number, y: number, z: number): void {
  const M = K.M
  const altoAsta = 9.5
  const asta = new THREE.CylinderGeometry(0.06, 0.1, altoAsta, 8)
  asta.translate(x, y + altoAsta / 2, z)
  P.lote.add(M.moldura, asta)
  P.lote.add(M.moldura, new THREE.SphereGeometry(0.16, 10, 8).translate(x, y + altoAsta + 0.12, z))
  P.lote.add(M.moldura, cajaE(x - 0.35, x + 0.35, y, y + 0.4, z - 0.35, z + 0.35))
  const W = 3.9
  const Hb = 2.05
  const geo = new THREE.PlaneGeometry(W, Hb, 24, 12)
  geo.translate(W / 2, -Hb / 2, 0)
  const base = (geo.getAttribute("position").array as Float32Array).slice()
  const flag = new THREE.Mesh(geo, K.P.bandera)
  flag.position.set(x + 0.08, y + altoAsta - 0.15, z)
  flag.castShadow = K.ctx.sombras
  flag.receiveShadow = false
  P.grupo.add(flag)
  const pos = geo.getAttribute("position") as THREE.BufferAttribute
  let cuadro = 0
  K.animaciones.push((t) => {
    // Medio cuadro sí, medio no: la tela ondea igual y se ahorra CPU.
    if (cuadro++ % 2 === 1) return
    const T = t.tiempo
    const arr = pos.array as Float32Array
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3]
      const by = base[i * 3 + 1]
      const k = bx / W
      const amp = 0.06 + 0.32 * k
      const ola = Math.sin(bx * 1.9 - T * 5.2 + by * 0.35) * amp + Math.sin(bx * 3.3 - T * 7.9) * amp * 0.25
      arr[i * 3] = bx - Math.abs(ola) * 0.12 * k
      arr[i * 3 + 1] = by - k * k * 0.12 + Math.sin(bx * 1.3 - T * 3.1) * 0.04 * k
      arr[i * 3 + 2] = ola
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })
}

// ──────────────────────────────────────────────────────────────
// Ala Oeste, Despacho Oval y Columnata Oeste
// ──────────────────────────────────────────────────────────────

function construirAlaOeste(K: Constructor): void {
  const M = K.M
  const W = HUELLAS.alaOeste
  const P = new Pieza("sala-gabinete", "ala-oeste")
  P.grupo.userData.edificio = "ala-oeste"
  const yP = 4.6
  const yC = 8.4
  const yCor = 9.2
  const ov = HUELLAS.despachoOval
  const lados: Array<{ f: Marco; L: number; z?: boolean }> = [
    { f: new Marco(new V3((W.x0 + W.x1) / 2, 0, W.z0), new V3(0, 0, -1)), L: (W.x1 - W.x0) / 2 },
    { f: new Marco(new V3((W.x0 + W.x1) / 2, 0, W.z1), new V3(0, 0, 1)), L: (W.x1 - W.x0) / 2 },
    { f: new Marco(new V3(W.x1, 0, (W.z0 + W.z1) / 2), new V3(1, 0, 0)), L: (W.z1 - W.z0) / 2 - 0.6 },
    { f: new Marco(new V3(W.x0, 0, (W.z0 + W.z1) / 2), new V3(-1, 0, 0)), L: (W.z1 - W.z0) / 2 - 0.6 },
  ]
  lados.forEach(({ f, L }, idx) => {
    const huecos: Hueco[] = []
    const n = Math.floor((L * 2) / 3.4)
    for (let k = 0; k < n; k++) {
      const u = -L + (L * 2 * (k + 0.5)) / n
      const pm = f.p(u, 0, 0)
      // Donde está el óvalo o la Columnata no van ventanas.
      const dOv = ((pm.x - ov.cx) / (ov.rx + 1.2)) ** 2 + ((pm.z - ov.cz) / (ov.rz + 1.2)) ** 2
      if (dOv < 1) continue
      const enCol = idx === 2 && pm.z > 2 && pm.z < 9
      // Puerta sur (la del Jardín de las Rosas y el Jardín Sur).
      const puerta = idx === 1 && Math.abs(pm.x - -62) < 1.8
      // Entrada norte del Ala Oeste, bajo su pórtico.
      const entrada = idx === 0 && Math.abs(pm.x - -65) < 1.8
      if (puerta || entrada) huecos.push(K.ventana(P, f, u, { w: 1.6, h: 3.1, v0: 0.15, hoja: "francesa", noche: 0.8, sinAlfeizar: true }))
      else if (enCol) {
        if (Math.abs(pm.z - 5.5) < 1.8) huecos.push(K.ventana(P, f, u, { w: 1.5, h: 2.9, v0: 0.15, hoja: "francesa", noche: 0.8, sinAlfeizar: true }))
      } else huecos.push(K.ventana(P, f, u, { w: 1.35, h: 2.7, v0: 1.0, noche: 0.55, cornisa: true }))
      huecos.push(K.ventana(P, f, u, { w: 1.3, h: 2.3, v0: yP + 0.95, noche: 0.5 }))
    }
    // Donde el Despacho Oval se mete en el Ala (sus muros sur y este), el muro del Ala se abre
    // hasta el techo del óvalo: por dentro es el Despacho. Desde afuera no cambia nada (lo tapa el óvalo).
    let corte: [number, number] | null = null
    if (idx === 1 || idx === 2) {
      let a = Infinity
      let b = -Infinity
      for (let u = -L; u <= L + 1e-6; u += 0.05) {
        const pm = f.p(u, 0, 0)
        if (((pm.x - ov.cx) / (ov.rx + 0.65)) ** 2 + ((pm.z - ov.cz) / (ov.rz + 0.65)) ** 2 < 1) {
          a = Math.min(a, u)
          b = Math.max(b, u)
        }
      }
      if (a <= b) corte = [Math.max(-L, a), Math.min(L, b + 0.05)]
    }
    const tramos: Array<[number, number]> = corte ? [[-L, corte[0]], [corte[1], L]].filter(([a, b]) => b - a > 0.05) as Array<[number, number]> : [[-L, L]]
    for (const [a, b] of tramos) {
      P.lote.add(M.fachada, geoMuro(a, b, 0, yCor, 0.6, huecos.filter((h) => h.u0 > a && h.u1 < b)), f.base)
      P.lote.add(M.fachada, cajaE(a, b, 0, 0.8, 0, 0.1), f.base)
    }
    if (corte) P.lote.add(M.fachada, geoMuro(corte[0], corte[1], 6.5, yCor, 0.6, []), f.base)
  })
  const rect: P2[] = [
    [W.x1, W.z0],
    [W.x0, W.z0],
    [W.x0, W.z1],
    [W.x1, W.z1],
  ]
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  P.lote.add(M.moldura, barrido(rect, conAltura(ENTABLAMENTO, yC - 0.4, 0.45, 0.6), xz, { cerrado: true }))
  P.lote.add(M.moldura, barrido(rect, conAltura(IMPOSTA, yP - 0.2), xz, { cerrado: true }))
  const yTop = yC - 0.4 + 2.8 * 0.45
  P.lote.add(M.techoMetal, cajaE(W.x0 + 0.3, W.x1 - 0.3, yCor - 0.2, yTop - 0.05, W.z0 + 0.3, W.z1 - 0.3))
  // Volúmenes en el techo (máquinas y la sala de arriba).
  P.lote.add(M.fachada, cajaE(-74, -58, yTop - 0.1, yTop + 2.2, -9, 6))
  P.lote.add(M.techoMetal, cajaE(-74.3, -57.7, yTop + 2.2, yTop + 2.5, -9.3, 6.3))
  for (const [x, z] of [
    [-77, -12],
    [-55, -11],
    [-77, 14],
  ]) P.lote.add(M.techoMetal, cajaE(x - 1.2, x + 1.2, yTop, yTop + 1.4, z - 1, z + 1))
  const d = 0.15
  K.balaustrada(
    P,
    [new V3(W.x1 + d, yTop, W.z0 - d), new V3(W.x0 - d, yTop, W.z0 - d), new V3(W.x0 - d, yTop, W.z1 + d), new V3(W.x1 + d, yTop, W.z1 + d)],
    { alto: 1.0, cerrado: true, paso: 0.3, ancho: 0.28, pedestal: 3.4 },
  )
  // Pórtico de la entrada norte.
  const fN = lados[0].f
  const Dc = 0.5
  const Hc = 4.4
  for (const u of [-3.6, -1.2, 1.2, 3.6]) {
    const p = fN.p(u, 0, 3.2)
    P.instancia("tosc", () => K.geo(`toscana-${Dc}-${Hc}`, () => geoColumnaToscana(Dc, Hc)), M.moldura, mT(p.x, 0, p.z))
  }
  const cx = -65
  P.lote.add(M.moldura, cajaE(cx - 4.4, cx + 4.4, Hc, Hc + 0.7, W.z0 - 3.8, W.z0))
  P.lote.add(M.moldura, cajaE(cx - 4.6, cx + 4.6, Hc + 0.7, Hc + 0.9, W.z0 - 4.0, W.z0))
  const fP = new Marco(new V3(cx, 0, W.z0 - 3.8), new V3(0, 0, -1))
  const alto = 4.6 * Math.tan(18 * GRAD)
  P.lote.add(
    M.moldura,
    barrido(
      [
        [-4.6, Hc + 0.9],
        [0, Hc + 0.9 + alto],
        [4.6, Hc + 0.9],
      ],
      [
        [0, 0],
        [0.3, 0],
        [0.32, 0.12],
        [0.4, 0.25],
        [0, 0.3],
      ],
      (a, b, h) => fP.p(a, b, h),
      { interior: [0, 0], vertical: true },
    ),
  )
  const tim = new THREE.Shape()
  tim.moveTo(-4.4, 0)
  tim.lineTo(4.4, 0)
  tim.lineTo(0, alto - 0.05)
  tim.closePath()
  P.lote.add(M.fachada, new THREE.ShapeGeometry(tim), fP.m(0, Hc + 0.9, 0.05))
  for (const s of [-1, 1]) {
    P.lote.add(
      M.techoMetal,
      poligono(
        [new V3(cx, Hc + 0.9 + alto + 0.25, W.z0 - 4.0), new V3(cx + s * 4.6, Hc + 1.05, W.z0 - 4.0), new V3(cx + s * 4.6, Hc + 1.05, W.z0), new V3(cx, Hc + 0.9 + alto + 0.25, W.z0)],
        new V3(s, 1, 0),
      ),
    )
  }
  P.lote.add(M.acera, cajaE(cx - 5, cx + 5, 0, 0.3, W.z0 - 4.6, W.z0))
  P.cerrar(K)
  despachoOval(K)
  columnataOeste(K)
}

/** El Despacho Oval: volumen ovalado en la esquina sureste del Ala Oeste, ventanales al sur. */
function despachoOval(K: Constructor): void {
  const M = K.M
  const O = HUELLAS.despachoOval
  const P = new Pieza("despacho-oval", "despacho-oval")
  P.grupo.userData.edificio = "ala-oeste"
  const rx = O.rx + 0.4
  const rz = O.rz + 0.4
  const yTop = 6.8
  const N = 16
  const cortes = Array.from({ length: N + 1 }, (_, i) => (-11.25 + i * 22.5) * GRAD)
  const punto = (a: number): P2 => [O.cx + rx * Math.cos(a), O.cz + rz * Math.sin(a)]
  for (let i = 0; i < N; i++) {
    const p0 = punto(cortes[i])
    const p1 = punto(cortes[i + 1])
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const mx = (p0[0] + p1[0]) / 2
    const mz = (p0[1] + p1[1]) / 2
    const am = (cortes[i] + cortes[i + 1]) / 2
    // Normal del óvalo en el medio del tramo.
    const nx = Math.cos(am) / rx
    const nz = Math.sin(am) / rz
    const f = new Marco(new V3(mx, 0, mz), new V3(nx, 0, nz))
    const centroGrados = Math.round(am / GRAD)
    const huecos: Hueco[] = []
    if ([68, 90, 113].includes(centroGrados)) {
      huecos.push(K.ventana(P, f, 0, { w: 1.35, h: 4.3, v0: 0.35, hoja: "francesa", noche: 0.9, cornisa: true, sinAlfeizar: true }))
    }
    // Las dos puertas: al oeste, a la antesala (dentro del Ala); al este, al Jardín de las Rosas.
    const puerta = centroGrados === 180 || centroGrados === 0
    if (puerta) {
      const a = centroGrados === 0 ? 0.6 : 0.55
      huecos.push({ u0: -a, u1: a, v0: 0.002, v1: 2.5 })
      P.lote.add(M.moldura, cajaE(-a - 0.12, a + 0.12, 2.5, 2.72, -0.04, 0.08), f.base)
      for (const s of [-1, 1]) P.lote.add(M.moldura, cajaE(s * a - 0.06 * (1 - s), s * a + 0.06 * (1 + s), 0, 2.5, -0.04, 0.08), f.base)
    }
    const g = geoMuro(-L / 2 - 0.02, L / 2 + 0.02, 0, yTop, 0.5, huecos)
    const pos = g.getAttribute("position")
    const nor = g.getAttribute("normal")
    const inv = new THREE.Matrix4().copy(f.base)
    for (let k = 0; k < pos.count; k++) {
      if (nor.getZ(k) > 0.99) {
        const w = new V3(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(inv)
        const n = new V3((w.x - O.cx) / (rx * rx), 0, (w.z - O.cz) / (rz * rz)).normalize()
        // Pasar la normal del mundo al marco local (el marco es una rotación pura).
        const nl = n.clone().applyMatrix4(new THREE.Matrix4().extractRotation(f.base).invert())
        nor.setXYZ(k, nl.x, 0, nl.z)
      }
    }
    P.lote.add(M.fachada, g, f.base)
    if (!puerta) P.lote.add(M.fachada, cajaE(-L / 2, L / 2, 0, 0.6, 0, 0.08), f.base)
    // Pilastras entre los ventanales.
    if ([45, 68, 90, 113].includes(centroGrados)) K.pilastra(P, f, L / 2, 0.6, yTop - 0.3, 0.42, 0.12, false)
  }
  const anillo = cortes.slice(0, N).map((a) => punto(a))
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  P.lote.add(M.moldura, barrido(anillo, conAltura(ENTABLAMENTO, yTop - 0.4, 0.42, 0.5), xz, { cerrado: true }))
  const yC = yTop - 0.4 + 2.8 * 0.42
  P.lote.add(M.techoMetal, losa(formaPlanta(anillo), yTop - 0.3, yC - 0.05))
  const anilloB = cortes.slice(0, N).map((a) => [O.cx + (rx + 0.05) * Math.cos(a), O.cz + (rz + 0.05) * Math.sin(a)] as P2)
  // Balaustrada solo en la parte que asoma fuera del ala (sur y este).
  const desde = 2
  const hasta = 9
  const ptsB = anilloB.slice(desde, hasta + 1).map(([x, z]) => new V3(x, yC, z))
  K.balaustrada(P, ptsB, { alto: 0.95, paso: 0.28, ancho: 0.26, esquinas: [0], pedestal: 2.4 })
  P.cerrar(K)
}

/** Columnata Oeste: columnas blancas, techo plano y muro de fondo con ventanas en arco. */
function columnataOeste(K: Constructor): void {
  const M = K.M
  const C = HUELLAS.columnataOeste
  const P = new Pieza("columnata", "columnata-oeste")
  const zMuro = C.z0 + 0.2
  const zCol = C.z1 - 0.6
  const yV = 3.7
  const yT = 4.75
  const x0 = C.x0
  const x1 = C.x1
  // Muro de fondo (mira al Jardín Norte por un lado y a la galería por el otro).
  const fN = new Marco(new V3((x0 + x1) / 2, 0, zMuro - 0.3), new V3(0, 0, -1))
  const fS = new Marco(new V3((x0 + x1) / 2, 0, zMuro + 0.3), new V3(0, 0, 1))
  const L = (x1 - x0) / 2
  const huecos: Hueco[] = []
  const n = 8
  for (let k = 0; k < n; k++) {
    const u = -L + (L * 2 * (k + 0.5)) / n
    huecos.push(K.ventana(P, fN, u, { w: 1.2, h: 1.6, v0: 0.95, arco: true, hoja: "arco", noche: 0.5, prof: 0.3, dobleCara: true }))
    K.ventana(P, fS, -u, { w: 1.2, h: 1.6, v0: 0.95, arco: true, hoja: "ninguna", marco: true, noche: 0, prof: 0.3 })
  }
  P.lote.add(M.fachada, geoMuro(-L, L, 0, yT, 0.6, huecos), fN.base)
  // Columnas toscanas.
  const D = 0.52
  const nc = 11
  for (let k = 0; k < nc; k++) {
    const x = x0 + 0.9 + ((x1 - x0 - 1.8) * k) / (nc - 1)
    P.instancia("tosc", () => K.geo(`toscana-${D}-${yV}`, () => geoColumnaToscana(D, yV)), M.moldura, mT(x, 0, zCol))
  }
  // Viga, techo plano y cornisa.
  P.lote.add(M.moldura, cajaE(x0, x1, yV, yV + 0.55, zCol - 0.38, zCol + 0.38))
  P.lote.add(M.fachada, cajaE(x0, x1, yV + 0.3, yT, zMuro - 0.3, zCol + 0.3))
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  P.lote.add(
    M.moldura,
    barrido(
      [
        [x0, zMuro - 0.3],
        [x0, zCol + 0.38],
        [x1, zCol + 0.38],
      ],
      conAltura(IMPOSTA, yT - 0.3, 1.3, 1.6),
      xz,
      { interior: [(x0 + x1) / 2, C.z0] },
    ),
  )
  P.lote.add(
    M.moldura,
    barrido(
      [
        [x0, zMuro - 0.3],
        [x1, zMuro - 0.3],
      ],
      conAltura(IMPOSTA, yT - 0.3, 1.3, 1.6),
      xz,
      { interior: [(x0 + x1) / 2, C.z1] },
    ),
  )
  K.balaustrada(P, [new V3(x0 + 0.2, yT + 0.04, zCol + 0.25), new V3(x1 - 0.6, yT + 0.04, zCol + 0.25)], { alto: 0.9, paso: 0.28, ancho: 0.26, pedestal: 3 })
  // Piso de piedra de la galería.
  P.lote.add(M.acera, cajaE(x0, x1, 0, 0.12, zMuro + 0.3, zCol + 0.7))
  P.cerrar(K)
}

// ──────────────────────────────────────────────────────────────
// La obra del salón de baile
// ──────────────────────────────────────────────────────────────

/** Perfil doble T de largo 1 sobre el eje x (se escala por instancia). */
function geoVigaI(alto: number, ancho: number): THREE.BufferGeometry {
  const e = 0.03
  return mergeGeometries([
    prep(cajaE(-0.5, 0.5, alto / 2 - e, alto / 2, -ancho / 2, ancho / 2)),
    prep(cajaE(-0.5, 0.5, -alto / 2, -alto / 2 + e, -ancho / 2, ancho / 2)),
    prep(cajaE(-0.5, 0.5, -alto / 2, alto / 2, -0.015, 0.015)),
  ])!
}

function construirObra(K: Constructor): void {
  const M = K.M
  const PR = K.P
  const O = HUELLAS.obra
  const P = new Pieza("obra", "obra-salon-de-baile")
  const rnd = azar(2025)
  const xs = [34, 41, 48, 55, 62, 69]
  const zs = [-10, -2.5, 5, 12.5, 20]
  const niveles = [6.5, 11.5, 16.5]
  const viga = () => K.geo("vigaI", () => geoVigaI(0.5, 0.3))
  const col = () => K.geo("columnaI", () => geoVigaI(0.42, 0.42))
  const barra = (a: THREE.Vector3, b: THREE.Vector3, columna = false) =>
    P.instancia(columna ? "colI" : "vigaI", columna ? col : viga, columna ? M.acero : PR.oxido, mTramo(a, b))
  const bahiaGrua = (x: number, z: number) => x > 41 && x < 48 && z > 5 && z < 12.5
  // Columnas: algunas más altas esperando el último piso.
  for (const x of xs) {
    for (const z of zs) {
      const alta = rnd() < 0.3
      barra(new V3(x, 0, z), new V3(x, alta ? 21.5 : 16.5, z), true)
    }
  }
  niveles.forEach((y, ni) => {
    for (let i = 0; i < xs.length - 1; i++) {
      for (const z of zs) {
        if (ni === 2 && rnd() < 0.3) continue
        barra(new V3(xs[i], y, z), new V3(xs[i + 1], y, z))
      }
    }
    for (const x of xs) {
      for (let j = 0; j < zs.length - 1; j++) {
        if (ni === 2 && rnd() < 0.3) continue
        barra(new V3(x, y, zs[j]), new V3(x, y, zs[j + 1]))
      }
    }
  })
  // Arriostramientos en cruz en algunos vanos.
  for (const [x0, x1, z] of [
    [34, 41, -10],
    [55, 62, -10],
    [34, 41, 20],
    [62, 69, 20],
  ]) {
    barra(new V3(x0, 0.3, z), new V3(x1, 6.3, z))
    barra(new V3(x1, 0.3, z), new V3(x0, 6.3, z))
  }
  for (const [x, z0, z1] of [
    [69, -10, -2.5],
    [69, 12.5, 20],
    [34, 5, 12.5],
  ]) {
    barra(new V3(x, 6.7, z0), new V3(x, 11.3, z1))
    barra(new V3(x, 6.7, z1), new V3(x, 11.3, z0))
  }
  // Losas: el primer nivel completo, el segundo a medias (chapa colaborante).
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cz = (zs[j] + zs[j + 1]) / 2
      if (bahiaGrua(cx, cz)) continue
      P.lote.add(PR.hormigon, cajaE(xs[i], xs[i + 1], niveles[0] + 0.25, niveles[0] + 0.45, zs[j], zs[j + 1]))
      if (rnd() < 0.55) P.lote.add(M.acero, cajaE(xs[i], xs[i + 1], niveles[1] + 0.25, niveles[1] + 0.32, zs[j], zs[j + 1]))
    }
  }
  P.lote.add(PR.hormigon, cajaE(O.x0 + 0.5, 71, 0, 0.18, -11, 21))
  // Fachada clásica ya colocada: muro sur (oeste) y muro oeste (sur), con ventanales en arco.
  fachadaObra(K, P, new Marco(new V3(44.5, 0, 21.0), new V3(0, 0, 1)), 11.5)
  fachadaObra(K, P, new Marco(new V3(33.0, 0, 12.5), new V3(-1, 0, 0)), 8.5)
  // Andamios donde la fachada todavía no llega.
  andamio(K, P, new Marco(new V3(62.5, 0, 21.4), new V3(0, 0, 1)), -6.5, 6.5, 17.5)
  andamio(K, P, new Marco(new V3(33.4, 0, -2.5), new V3(-1, 0, 0)), -7.5, 6, 12.5)
  // Cerco de obra con lona verde (portón al sur, junto al acceso).
  const zs0 = O.z0 - 2.5
  const zs1 = O.z1 + 4.5
  const xs0 = O.x0 - 1.5
  const xs1 = O.x1 + 2
  const cerco: P2[] = [
    [36, zs1],
    [xs0, zs1],
    [xs0, zs0],
    [xs1, zs0],
    [xs1, zs1],
    [44, zs1],
  ]
  for (let i = 0; i < cerco.length - 1; i++) {
    const [ax, az] = cerco[i]
    const [bx, bz] = cerco[i + 1]
    const L = Math.hypot(bx - ax, bz - az)
    const a = new V3(ax, 0, az)
    const b = new V3(bx, 0, bz)
    const m = mTramo(new V3(ax, 1.25, az), new V3(bx, 1.25, bz), false)
    P.lote.add(PR.lona, cajaE(-L / 2, L / 2, -1.15, 1.15, -0.03, 0.03), m)
    const n = Math.ceil(L / 3)
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n)
      const poste = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5)
      P.lote.add(M.acero, poste, mT(p.x, 1.25, p.z))
    }
  }
  // Contenedores de obra (colores con vértices: un solo material).
  const cont = (x: number, y: number, z: number, ry: number, color: number) => {
    const partes: THREE.BufferGeometry[] = [cajaE(-3.03, 3.03, 0, 2.59, -1.22, 1.22)]
    for (let k = -7; k <= 7; k++) {
      partes.push(cajaE(k * 0.4 - 0.06, k * 0.4 + 0.06, 0.1, 2.49, -1.27, 1.27))
    }
    const g = mergeGeometries(partes.map((p) => prep(p)))!
    const c = new THREE.Color(color)
    const n = g.getAttribute("position").count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    g.applyMatrix4(mTR(x, y, z, ry))
    return g
  }
  const conts = [
    cont(76, 0, -12, Math.PI / 2, 0xd9622b),
    cont(76, 2.6, -12, Math.PI / 2 + 0.05, 0x2f5f8a),
    cont(73.2, 0, -12.5, Math.PI / 2, 0x8d9396),
    cont(76.5, 0, 2, Math.PI / 2, 0xe8e3d6),
    cont(37, 0, -13.6, 0, 0x2f6b46),
  ]
  const gc = mergeGeometries(conts.map((g) => prep(g, true)))!
  const mc = new THREE.Mesh(gc, PR.contenedor)
  mc.castShadow = mc.receiveShadow = K.ctx.sombras
  P.grupo.add(mc)
  K.ctx.seleccionable(mc, "obra")
  // Pilas de vigas y tarimas.
  for (let k = 0; k < 6; k++) {
    const y = 0.3 + Math.floor(k / 3) * 0.52
    const zz = 8 + (k % 3) * 0.42
    P.instancia("vigaI", viga, PR.oxido, mTramo(new V3(72.6, y, zz), new V3(79.4, y, zz)))
  }
  for (let k = 0; k < 4; k++) P.lote.add(M.madera, cajaE(-0.6, 0.6, 0, 0.9, -0.5, 0.5), mTR(74 + (k % 2) * 1.5, 0, 16 + Math.floor(k / 2) * 1.3, 0.1 * k))
  // Torres de luz de obra: de noche iluminan la estructura.
  for (const [x, z, r] of [
    [31.2, -16.2, Math.PI * 0.25],
    [81.2, -16.2, -Math.PI * 0.25],
    [81.2, 28, -Math.PI * 0.75],
  ]) {
    const m = mTR(x, 0, z, r)
    P.lote.add(M.acero, cajaE(-0.9, 0.9, 0, 0.5, -0.6, 0.6), m)
    P.lote.add(M.acero, cajaE(-0.08, 0.08, 0.5, 9, -0.08, 0.08), m)
    P.lote.add(M.acero, cajaE(-1.1, 1.1, 8.6, 8.7, -0.05, 0.05), m)
    for (const s of [-0.75, -0.25, 0.25, 0.75]) {
      P.lote.add(M.hierroNegro, cajaE(s - 0.22, s + 0.22, 8.75, 9.25, -0.25, 0.05), m)
      P.lote.add(PR.luzObra, cajaE(s - 0.18, s + 0.18, 8.8, 9.2, 0.05, 0.07), m)
    }
  }
  // Guirnaldas de luz en el primer nivel.
  for (const z of [-10.2, 20.2]) {
    for (let x = 34.5; x < 69; x += 1.4) P.lote.add(PR.luzObra, new THREE.SphereGeometry(0.07, 5, 4), mT(x, niveles[0] - 0.35 - 0.12 * Math.sin(((x - 34) / 7) * Math.PI) ** 2, z))
  }
  const foco = new THREE.SpotLight(0xfff0d8, 0, 120, 0.55, 0.6, 1.6)
  foco.position.set(81, 9.5, 28)
  foco.target.position.set(52, 4, 4)
  P.grupo.add(foco, foco.target)
  K.ctx.luzNocturna(foco, 900)
  // Dos grúas torre amarillas.
  grua(K, P, 44.5, 8.75, 50, 46, 0.4, 1)
  grua(K, P, 76.5, -5.5, 38, 32, 2.3, 2)
  P.cerrar(K)
}

/** Paño de fachada clásica del salón de baile: ventanales en arco y pilastras. */
function fachadaObra(K: Constructor, P: Pieza, f: Marco, L: number): void {
  const M = K.M
  const huecos: Hueco[] = []
  const n = Math.round((L * 2) / 3.5)
  for (let k = 0; k < n; k++) {
    const u = -L + (L * 2 * (k + 0.5)) / n
    huecos.push(K.ventana(P, f, u, { w: 1.8, h: 6.4, v0: 1.4, arco: true, hoja: "arco", noche: 0.85, marco: true, sinAlfeizar: true }))
    if (k > 0) K.pilastra(P, f, -L + (L * 2 * k) / n, 0.6, 12.4, 0.75, 0.2)
  }
  P.lote.add(M.fachada, geoMuro(-L, L, 0, 12.4, 0.5, huecos), f.base)
  P.lote.add(M.fachada, cajaE(-L, L, 0, 0.7, 0, 0.1), f.base)
  P.lote.add(M.moldura, barrido([[-L, 0], [L, 0]], conAltura(ENTABLAMENTO, 12.4, 0.6, 0.7), (a, b, h) => f.p(a, h, b), { interior: [0, -5] }))
}

/** Andamio tubular: montantes, largueros, tablones y cruces. */
function andamio(K: Constructor, P: Pieza, f: Marco, u0: number, u1: number, alto: number): void {
  const M = K.M
  const tubo = () => K.geo("tubo", () => prep(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateZ(Math.PI / 2)))
  const tablon = () => K.geo("tablon", () => prep(cajaE(-0.5, 0.5, -0.025, 0.025, -0.45, 0.45)))
  const paso = 2.5
  const n = Math.round((u1 - u0) / paso)
  const nivel = 2.0
  const pisos = Math.floor(alto / nivel)
  const t = (a: THREE.Vector3, b: THREE.Vector3) => P.instancia("tubo", tubo, M.acero, mTramo(a, b), false)
  for (let i = 0; i <= n; i++) {
    const u = u0 + i * paso
    for (const d of [0.4, 1.5]) t(f.p(u, 0, d), f.p(u, pisos * nivel + 1, d))
  }
  for (let p = 1; p <= pisos; p++) {
    const v = p * nivel
    for (const d of [0.4, 1.5]) t(f.p(u0, v, d), f.p(u1, v, d))
    t(f.p(u0, v + 1, 1.5), f.p(u1, v + 1, 1.5))
    for (let i = 0; i <= n; i++) t(f.p(u0 + i * paso, v, 0.4), f.p(u0 + i * paso, v, 1.5))
    for (let i = 0; i < n; i++) {
      const m = f.m(u0 + (i + 0.5) * paso, v + 0.05, 0.95).multiply(new THREE.Matrix4().makeScale(paso - 0.05, 1, 1))
      P.instancia("tablon", tablon, M.madera, m)
    }
    if (p % 2 === 1) for (let i = 0; i < n; i += 2) t(f.p(u0 + i * paso, v - nivel, 1.5), f.p(u0 + (i + 1) * paso, v, 1.5))
  }
}

/** Grúa torre: mástil de celosía, pluma, contrapluma con contrapeso, carro y gancho animados. */
function grua(K: Constructor, P: Pieza, x: number, z: number, H: number, L: number, rumbo: number, semilla: number): void {
  const M = K.M
  const PR = K.P
  const amar = PR.amarillo
  const a = 1.0
  // Base de hormigón y mástil.
  P.lote.add(PR.hormigon, cajaE(x - 2.6, x + 2.6, 0, 1.0, z - 2.6, z + 2.6))
  const est = new Lote()
  const cel = (p0: THREE.Vector3, p1: THREE.Vector3, g = 0.07) => est.add(amar, cajaE(-0.5, 0.5, -g, g, -g, g), mTramo(p0, p1))
  const esq: P2[] = [
    [-a, -a],
    [a, -a],
    [a, a],
    [-a, a],
  ]
  for (const [ex, ez] of esq) cel(new V3(x + ex, 1, z + ez), new V3(x + ex, H, z + ez), 0.09)
  for (let y = 1; y < H; y += 2.5) {
    for (let i = 0; i < 4; i++) {
      const [ax, az] = esq[i]
      const [bx, bz] = esq[(i + 1) % 4]
      cel(new V3(x + ax, y, z + az), new V3(x + bx, y, z + bz), 0.045)
      cel(new V3(x + ax, y, z + az), new V3(x + bx, Math.min(H, y + 2.5), z + bz), 0.04)
    }
  }
  est.volcar(P.grupo, () => [K.ctx.sombras, K.ctx.sombras]).forEach((m) => K.ctx.seleccionable(m, "obra"))
  // Lo que gira: pluma, contrapluma, cabina, torreta y tirantes.
  const giro = new THREE.Group()
  giro.position.set(x, H, z)
  const L2 = new Lote()
  const c2 = (p0: THREE.Vector3, p1: THREE.Vector3, g = 0.06, mat: THREE.Material = amar) => L2.add(mat, cajaE(-0.5, 0.5, -g, g, -g, g), mTramo(p0, p1))
  L2.add(amar, new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16).translate(0, 0.3, 0))
  const yj = 0.6
  const hj = 1.6
  const wj = 0.75
  // Pluma (triángulo de celosía) hacia +x.
  for (const s of [-1, 1]) c2(new V3(0, yj, s * wj), new V3(L, yj, s * wj), 0.07)
  c2(new V3(0, yj + hj, 0), new V3(L - 1, yj + hj * 0.4, 0), 0.07)
  for (let px = 0; px < L - 1; px += 2.2) {
    const yTop = yj + hj - (hj * 0.6 * px) / L
    const yTop2 = yj + hj - (hj * 0.6 * (px + 2.2)) / L
    for (const s of [-1, 1]) {
      c2(new V3(px, yj, s * wj), new V3(px + 1.1, yTop - 0.05, 0), 0.04)
      c2(new V3(px + 1.1, yTop - 0.05, 0), new V3(px + 2.2, yj, s * wj), 0.04)
    }
    c2(new V3(px, yj, -wj), new V3(px, yj, wj), 0.035)
    void yTop2
  }
  // Contrapluma con contrapeso.
  const Lc = L * 0.3
  for (const s of [-1, 1]) c2(new V3(0, yj, s * 1.0), new V3(-Lc, yj, s * 1.0), 0.09)
  for (let px = -1; px > -Lc; px -= 2) c2(new V3(px, yj, -1), new V3(px, yj, 1), 0.04)
  L2.add(PR.hormigon, cajaE(-Lc + 0.2, -Lc + 3.4, yj - 2.4, yj + 0.1, -1.1, 1.1))
  L2.add(M.acero, cajaE(-Lc + 3.6, -Lc + 6, yj + 0.08, yj + 1.1, -0.8, 0.8))
  // Torreta y tirantes.
  const yT = yj + 8.5
  for (const [ex, ez] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [0.8, 0.8],
    [-0.8, 0.8],
  ]) c2(new V3(ex, yj, ez), new V3(0, yT, 0), 0.07)
  c2(new V3(0, yT, 0), new V3(L * 0.62, yj + hj * 0.6, 0), 0.025, M.hierroNegro)
  c2(new V3(0, yT, 0), new V3(L * 0.25, yj + hj * 0.85, 0), 0.025, M.hierroNegro)
  for (const s of [-1, 1]) c2(new V3(0, yT, 0), new V3(-Lc + 0.4, yj + 0.1, s * 0.9), 0.025, M.hierroNegro)
  // Cabina.
  L2.add(amar, cajaE(0.3, 2.5, yj - 2.6, yj - 0.1, 1.0, 2.6))
  L2.add(M.vidrio, cajaE(2.5, 2.52, yj - 2.2, yj - 0.6, 1.15, 2.45))
  L2.add(M.vidrio, cajaE(0.6, 2.3, yj - 2.2, yj - 0.6, 2.6, 2.62))
  // Luces rojas de balizamiento.
  L2.add(PR.rojo, new THREE.SphereGeometry(0.22, 8, 6).translate(0, yT + 0.25, 0))
  L2.add(PR.rojo, new THREE.SphereGeometry(0.2, 8, 6).translate(L - 0.5, yj + hj * 0.45, 0))
  L2.add(PR.rojo, new THREE.SphereGeometry(0.2, 8, 6).translate(-Lc + 0.5, yj + 1.3, 0))
  L2.volcar(giro, (m) => [K.ctx.sombras && !K.sinSombra.has(m), K.ctx.sombras]).forEach((m) => K.ctx.seleccionable(m, "obra"))
  // Carro, cable, gancho y una carga de vigas.
  const carro = new THREE.Group()
  const L3 = new Lote()
  L3.add(amar, cajaE(-0.9, 0.9, yj - 0.35, yj + 0.05, -0.85, 0.85))
  L3.add(M.hierroNegro, new THREE.CylinderGeometry(0.15, 0.15, 1.6, 10).rotateX(Math.PI / 2).translate(0, yj - 0.2, 0))
  L3.volcar(carro, () => [K.ctx.sombras, K.ctx.sombras])
  giro.add(carro)
  const cable = new THREE.Mesh(K.geo("cable", () => prep(cajaE(-0.025, 0.025, -1, 0, -0.025, 0.025))), M.hierroNegro)
  cable.position.y = yj - 0.3
  carro.add(cable)
  const gancho = new THREE.Group()
  const L4 = new Lote()
  L4.add(amar, cajaE(-0.35, 0.35, -0.9, 0, -0.25, 0.25))
  L4.add(M.hierroNegro, new THREE.TorusGeometry(0.28, 0.07, 6, 12, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, -1.3, 0))
  for (const s of [-1, 1]) L4.add(M.hierroNegro, cajaE(-0.02, 0.02, -4.1, -1.2, -0.02, 0.02), mTramo(new V3(0, -1.3, 0), new V3(s * 2.6, -4.2, 0), true))
  for (let k = 0; k < 3; k++) L4.add(PR.oxido, cajaE(-3.2, 3.2, -4.6 + k * 0.32, -4.3 + k * 0.32, -0.15 - k * 0.0, 0.15))
  L4.volcar(gancho, () => [K.ctx.sombras, K.ctx.sombras])
  carro.add(gancho)
  P.grupo.add(giro)
  const fase = semilla * 2.1
  K.animaciones.push((t) => {
    const T = t.tiempo
    giro.rotation.y = rumbo + Math.sin(T * 0.045 + fase) * 0.55
    const pos = 7 + (L - 12) * (0.5 + 0.5 * Math.sin(T * 0.07 + fase * 1.7))
    carro.position.x = pos
    const caida = 10 + (H - 28) * (0.5 + 0.5 * Math.sin(T * 0.11 + fase))
    cable.scale.y = caida
    gancho.position.y = yj - 0.3 - caida
    gancho.rotation.y = Math.sin(T * 0.3 + fase) * 0.4
  })
}

// ──────────────────────────────────────────────────────────────
// Edificio Eisenhower (Segundo Imperio) y Tesoro (neoclásico)
// ──────────────────────────────────────────────────────────────

/** Módulo de ventana del EEOB: marco, columnillas a los lados y guardapolvo con frontón chico. */
function geoModuloEEOB(w: number, h: number): THREE.BufferGeometry {
  const hw = w / 2
  const partes: THREE.BufferGeometry[] = [
    cajaE(-hw - 0.14, -hw, 0, h, 0, 0.12),
    cajaE(hw, hw + 0.14, 0, h, 0, 0.12),
    cajaE(-hw - 0.14, hw + 0.14, h, h + 0.14, 0, 0.12),
    cajaE(-hw - 0.3, hw + 0.3, -0.16, 0, 0, 0.24),
  ]
  for (const s of [-1, 1]) {
    const c = new THREE.CylinderGeometry(0.1, 0.11, h, 7)
    c.translate(s * (hw + 0.3), h / 2, 0.22)
    partes.push(c)
    partes.push(cajaE(s * (hw + 0.3) - 0.16, s * (hw + 0.3) + 0.16, h, h + 0.16, 0.06, 0.38))
    partes.push(cajaE(s * (hw + 0.3) - 0.16, s * (hw + 0.3) + 0.16, -0.1, 0.08, 0.06, 0.38))
  }
  partes.push(cajaE(-hw - 0.5, hw + 0.5, h + 0.16, h + 0.42, 0, 0.4))
  // Frontón chico (prisma).
  const s = new THREE.Shape()
  s.moveTo(-hw - 0.45, 0)
  s.lineTo(hw + 0.45, 0)
  s.lineTo(0, 0.42)
  s.closePath()
  const fr = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false })
  fr.translate(0, h + 0.42, 0.02)
  partes.push(fr)
  return mergeGeometries(partes.map((p) => prep(p)))!
}

function geoVidrioPlano(w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h)
  g.translate(0, h / 2, 0.02)
  return prep(g)
}

/** Ventanas instanciadas a lo largo de un tramo de muro (EEOB y Tesoro). */
function filaVentanas(
  K: Constructor,
  P: Pieza,
  f: Marco,
  u0: number,
  u1: number,
  pisos: number[],
  paso: number,
  claveModulo: string,
  modulo: () => THREE.BufferGeometry,
  w: number,
  h: number,
  mat: THREE.Material,
): void {
  const n = Math.floor((u1 - u0) / paso)
  if (n < 1) return
  const vidrio = () => K.geo(`vidrio-${w}-${h}`, () => geoVidrioPlano(w, h))
  for (let k = 0; k < n; k++) {
    const u = u0 + ((u1 - u0) * (k + 0.5)) / n
    for (const v of pisos) {
      const m = f.m(u, v, 0)
      P.instancia(claveModulo, modulo, mat, m)
      P.instancia(`vid-${w}-${h}`, vidrio, K.M.vidrio, m, false)
      const r = K.rnd()
      if (r < 0.22) P.instancia(`nocheA-${w}-${h}`, vidrio, K.M.ventanaNoche, f.m(u, v, 0.01), false, 0.25)
      else if (r < 0.4) P.instancia(`nocheB-${w}-${h}`, vidrio, K.M.ventanaNoche, f.m(u, v, 0.01), false, 0.5)
    }
  }
}

/** Mansarda: tronco de pirámide (lados empinados) con tapa plana. */
function mansarda(P: Pieza, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, ret: number): void {
  const A = new V3(x0, y0, z0)
  const B = new V3(x1, y0, z0)
  const C = new V3(x1, y0, z1)
  const D = new V3(x0, y0, z1)
  const a = new V3(x0 + ret, y1, z0 + ret)
  const b = new V3(x1 - ret, y1, z0 + ret)
  const c = new V3(x1 - ret, y1, z1 - ret)
  const d = new V3(x0 + ret, y1, z1 - ret)
  P.lote.add(mat, poligono([A, B, b, a], new V3(0, 0.3, -1)))
  P.lote.add(mat, poligono([B, C, c, b], new V3(1, 0.3, 0)))
  P.lote.add(mat, poligono([C, D, d, c], new V3(0, 0.3, 1)))
  P.lote.add(mat, poligono([D, A, a, d], new V3(-1, 0.3, 0)))
  P.lote.add(mat, poligono([a, b, c, d], new V3(0, 1, 0)))
}

function construirEEOB(K: Constructor): void {
  const M = K.M
  const E = HUELLAS.eeob
  const P = new Pieza("eeob", "edificio-eisenhower")
  P.grupo.userData.edificio = "eeob"
  const g = M.granito
  const yCor = 18.4
  const pisos = [1.9, 6.0, 10.0, 14.0]
  const ret = 1.6
  // Contorno con pabellones (esquinas y centros salientes).
  const contorno: P2[] = [
    [E.x1, E.z0],
    [-114, E.z0],
    [-114, E.z0 + ret],
    [-123, E.z0 + ret],
    [-123, E.z0],
    [-137, E.z0],
    [-137, E.z0 + ret],
    [-146, E.z0 + ret],
    [-146, E.z0],
    [E.x0, E.z0],
    [E.x0, -46],
    [E.x0 + ret, -46],
    [E.x0 + ret, -11],
    [E.x0, -11],
    [E.x0, 11],
    [E.x0 + ret, 11],
    [E.x0 + ret, 46],
    [E.x0, 46],
    [E.x0, E.z1],
    [-146, E.z1],
    [-146, E.z1 - ret],
    [-137, E.z1 - ret],
    [-137, E.z1],
    [-123, E.z1],
    [-123, E.z1 - ret],
    [-114, E.z1 - ret],
    [-114, E.z1],
    [E.x1, E.z1],
    [E.x1, 46],
    [E.x1 - ret, 46],
    [E.x1 - ret, 11],
    [E.x1, 11],
    [E.x1, -11],
    [E.x1 - ret, -11],
    [E.x1 - ret, -46],
    [E.x1, -46],
  ]
  P.lote.add(g, losa(formaPlanta(contorno), 0, yCor, 1))
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  // Zócalo, cornisas de cada piso y cornisa mayor.
  P.lote.add(g, barrido(contorno, conAltura(IMPOSTA, 1.0, 1.4, 1.2), xz, { cerrado: true }))
  for (const y of [5.4, 9.4, 13.4]) P.lote.add(g, barrido(contorno, conAltura(IMPOSTA, y, 1.6, 1.5), xz, { cerrado: true }))
  P.lote.add(g, barrido(contorno, conAltura(ENTABLAMENTO, yCor - 1.5, 0.55, 0.85), xz, { cerrado: true }))
  // Ventanas a lo largo de cada tramo.
  let A = 0
  for (let i = 0; i < contorno.length; i++) {
    const p = contorno[i]
    const q = contorno[(i + 1) % contorno.length]
    A += p[0] * q[1] - q[0] * p[1]
  }
  const modulo = () => K.geo("moduloEEOB", () => geoModuloEEOB(1.25, 2.55))
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]
    const b = contorno[(i + 1) % contorno.length]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 4) continue
    const t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    const afuera: P2 = A < 0 ? [-t[1], t[0]] : [t[1], -t[0]]
    const f = marcoTramo(a, b, afuera)
    filaVentanas(K, P, f, -L / 2 + 0.9, L / 2 - 0.9, pisos, 3.5, "modEEOB", modulo, 1.25, 2.55, g)
    // Pilastras en las esquinas de cada tramo.
    for (const s of [-1, 1]) P.lote.add(g, cajaE(s * (L / 2) - (s > 0 ? 0.7 : 0), s * (L / 2) + (s > 0 ? 0 : 0.7), 1.0, yCor - 1.5, 0, 0.16), f.base)
  }
  // Escalinata y puerta de la fachada que mira a la Casa Blanca.
  for (let k = 0; k < 5; k++) P.lote.add(g, cajaE(E.x1 - 0.1, E.x1 + 2.6 - k * 0.5, 0, 0.24 * (k + 1), -6 + k * 0.1, 6 - k * 0.1))
  P.lote.add(K.P.puerta, cajaE(E.x1 - 0.05, E.x1 + 0.02, 1.2, 4.6, -1.2, 1.2))
  // Techos mansarda: el cuerpo y pabellones más altos.
  const pz = K.P.pizarra
  mansarda(P, pz, E.x0 + ret + 0.3, E.x1 - ret - 0.3, E.z0 + ret + 0.3, E.z1 - ret - 0.3, yCor - 0.05, yCor + 5.2, 1.6)
  const pabellones: Array<[number, number, number, number, number]> = [
    [E.x0, -146, E.z0, -46, 7.4],
    [-114, E.x1, E.z0, -46, 7.4],
    [E.x0, -146, 46, E.z1, 7.4],
    [-114, E.x1, 46, E.z1, 7.4],
    [-137, -123, E.z0, E.z0 + 12, 6.4],
    [-137, -123, E.z1 - 12, E.z1, 6.4],
    [E.x0, E.x0 + 12, -11, 11, 6.4],
    [E.x1 - 12, E.x1, -11, 11, 6.8],
  ]
  for (const [x0, x1, z0, z1, h] of pabellones) {
    mansarda(P, pz, x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, yCor - 0.05, yCor + h, 1.3)
    // Crestería de hierro arriba.
    const yt = yCor + h
    const r = 1.6
    for (const [ax, az, bx, bz] of [
      [x0 + r, z0 + r, x1 - r, z0 + r],
      [x1 - r, z0 + r, x1 - r, z1 - r],
      [x1 - r, z1 - r, x0 + r, z1 - r],
      [x0 + r, z1 - r, x0 + r, z0 + r],
    ]) {
      P.lote.add(M.hierroNegro, cajaE(-0.5, 0.5, 0.5, 0.56, -0.03, 0.03), mTramo(new V3(ax, yt, az), new V3(bx, yt, bz)))
      const L = Math.hypot(bx - ax, bz - az)
      for (let k = 0; k <= L; k += 0.8) {
        const p = new V3(ax, yt, az).lerp(new V3(bx, yt, bz), k / L)
        P.lote.add(M.hierroNegro, cajaE(-0.025, 0.025, 0, 0.7, -0.025, 0.025), mT(p.x, p.y, p.z))
      }
    }
  }
  // Buhardillas en las mansardas del cuerpo.
  const buh = () =>
    K.geo("buhardilla", () => {
      const partes = [cajaE(-0.8, 0.8, 0, 2.1, -1.6, 0.25), cajaE(-0.95, 0.95, 2.1, 2.3, -1.6, 0.35)]
      const s = new THREE.Shape()
      s.moveTo(-0.95, 0)
      s.lineTo(0.95, 0)
      s.lineTo(0, 0.7)
      s.closePath()
      const pr = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false })
      pr.translate(0, 2.3, -1.6)
      partes.push(pr)
      return mergeGeometries(partes.map((p) => prep(p)))!
    })
  const vidB = () => K.geo("vidrio-buh", () => geoVidrioPlano(0.95, 1.4))
  const lados: Array<[Marco, number, number]> = [
    [new Marco(new V3(E.x1 - ret - 1.3, 0, 0), new V3(1, 0, 0)), -44, 44],
    [new Marco(new V3(E.x0 + ret + 1.3, 0, 0), new V3(-1, 0, 0)), -44, 44],
    [new Marco(new V3((E.x0 + E.x1) / 2, 0, E.z0 + ret + 1.3), new V3(0, 0, -1)), -26, 26],
    [new Marco(new V3((E.x0 + E.x1) / 2, 0, E.z1 - ret - 1.3), new V3(0, 0, 1)), -26, 26],
  ]
  for (const [f, u0, u1] of lados) {
    for (let u = u0; u <= u1; u += 3.5) {
      const enPab = Math.abs(u) < 12.5 || Math.abs(u) > 42
      if (enPab) continue
      const m = f.m(u, yCor + 1.0, 0)
      P.instancia("buh", buh, g, m)
      P.instancia("vidbuh", vidB, M.vidrio, f.m(u, yCor + 1.35, 0.26), false)
      if (K.rnd() < 0.3) P.instancia("nochebuh", vidB, M.ventanaNoche, f.m(u, yCor + 1.35, 0.27), false, 0.35)
    }
  }
  // Chimeneas altas de granito.
  for (const [x, z] of [
    [-104.5, -30],
    [-104.5, 30],
    [-155.5, -30],
    [-155.5, 30],
    [-130, -55.2],
    [-130, 55.2],
    [-118, -55.2],
    [-142, 55.2],
    [-104.5, -18],
    [-155.5, 18],
  ]) {
    P.lote.add(g, cajaE(x - 0.7, x + 0.7, yCor, yCor + 8.6, z - 1.1, z + 1.1))
    P.lote.add(g, cajaE(x - 0.9, x + 0.9, yCor + 8.6, yCor + 9.0, z - 1.3, z + 1.3))
  }
  P.cerrar(K)
}

function construirTesoro(K: Constructor): void {
  const M = K.M
  const T = HUELLAS.tesoro
  const P = new Pieza("tesoro", "tesoro")
  P.grupo.userData.edificio = "tesoro"
  const g = M.granito
  const yPod = 3.2
  const yArq = 14.4
  const yAt = yArq + 2.4
  const yTop = yAt + 2.6
  const xMuro = T.x0 + 4.0
  const zc0 = -40
  const zc1 = 30
  const xz = (a: number, b: number, h: number) => new V3(a, h, b)
  // Cuerpo: retranqueado detrás de la columnata, a ras en los pabellones.
  P.lote.add(g, cajaE(xMuro, T.x1, 0, yTop, zc0, zc1))
  P.lote.add(g, cajaE(T.x0, T.x1, 0, yTop, T.z0, zc0))
  P.lote.add(g, cajaE(T.x0, T.x1, 0, yTop, zc1, T.z1))
  // Podio de la columnata y escalones.
  P.lote.add(g, cajaE(T.x0, xMuro, 0, yPod, zc0, zc1))
  for (let k = 0; k < 4; k++) P.lote.add(g, cajaE(T.x0 - 1.2 + k * 0.3, T.x0, 0, (yPod / 4) * (k + 1) * 0.35, zc0 + 6, zc1 - 6))
  // Columnata jónica larga.
  const D = 1.2
  const Hc = yArq - yPod
  const estrias = K.ctx.calidad === "alta" ? 16 : 12
  const geoCol = () => K.geo(`jonica-${D}-${Hc}-${estrias}`, () => geoColumnaJonica(D, Hc, estrias))
  const n = 22
  for (let k = 0; k < n; k++) {
    const z = zc0 + 1.6 + ((zc1 - zc0 - 3.2) * k) / (n - 1)
    P.instancia("col", geoCol, M.moldura, mTR(T.x0 + 1.3, yPod, z, -Math.PI / 2))
  }
  // Entablamento sobre la columnata, ático y cornisas de todo el edificio.
  P.lote.add(g, cajaE(T.x0 + 0.5, xMuro, yArq, yAt, zc0, zc1))
  const cont: P2[] = [
    [T.x1, T.z0],
    [T.x0, T.z0],
    [T.x0, T.z1],
    [T.x1, T.z1],
  ]
  P.lote.add(g, barrido(cont, conAltura(ENTABLAMENTO, yArq, 0.86, 0.9), xz, { cerrado: true }))
  P.lote.add(g, barrido(cont, conAltura(IMPOSTA, yTop - 0.3, 1.5, 1.4), xz, { cerrado: true }))
  P.lote.add(g, barrido(cont, conAltura(IMPOSTA, yPod - 0.2, 1.2, 1.2), xz, { cerrado: true }))
  // Ventanas: detrás de la columnata y en los demás frentes.
  const modulo = () =>
    K.geo("moduloTesoro", () => {
      const w = 1.4
      const h = 2.7
      const hw = w / 2
      return mergeGeometries(
        [
          cajaE(-hw - 0.18, -hw, 0, h, 0, 0.1),
          cajaE(hw, hw + 0.18, 0, h, 0, 0.1),
          cajaE(-hw - 0.18, hw + 0.18, h, h + 0.18, 0, 0.1),
          cajaE(-hw - 0.3, hw + 0.3, h + 0.18, h + 0.42, 0, 0.28),
          cajaE(-hw - 0.25, hw + 0.25, -0.14, 0, 0, 0.18),
        ].map((p) => prep(p)),
      )!
    })
  const fCol = new Marco(new V3(xMuro, 0, (zc0 + zc1) / 2), new V3(-1, 0, 0))
  filaVentanas(K, P, fCol, -(zc1 - zc0) / 2 + 1, (zc1 - zc0) / 2 - 1, [4.4, 9.3], 3.2, "modT", modulo, 1.4, 2.7, g)
  const frentes: Array<[Marco, number, number[]]> = [
    [new Marco(new V3(T.x0, 0, (T.z0 + zc0) / 2), new V3(-1, 0, 0)), (zc0 - T.z0) / 2, [1.0, 4.4, 9.3]],
    [new Marco(new V3(T.x0, 0, (T.z1 + zc1) / 2), new V3(-1, 0, 0)), (T.z1 - zc1) / 2, [1.0, 4.4, 9.3]],
    [new Marco(new V3(T.x1, 0, (T.z0 + T.z1) / 2), new V3(1, 0, 0)), (T.z1 - T.z0) / 2, [1.0, 4.4, 9.3]],
    [new Marco(new V3((T.x0 + T.x1) / 2, 0, T.z0), new V3(0, 0, -1)), (T.x1 - T.x0) / 2, [1.0, 4.4, 9.3]],
    [new Marco(new V3((T.x0 + T.x1) / 2, 0, T.z1), new V3(0, 0, 1)), (T.x1 - T.x0) / 2, [1.0, 4.4, 9.3]],
  ]
  for (const [f, L, pisos] of frentes) {
    filaVentanas(K, P, f, -L + 1.2, L - 1.2, pisos, 3.4, "modT", modulo, 1.4, 2.7, g)
    for (let u = -L + 0.6; u <= L - 0.5; u += (2 * L - 1.1) / Math.max(1, Math.round((2 * L) / 6.8))) {
      P.lote.add(g, cajaE(u - 0.4, u + 0.4, yPod, yArq, 0, 0.22), f.base)
    }
  }
  // Ventanitas del ático.
  for (const [f, L] of frentes.map(([f, L]) => [f, L] as [Marco, number])) {
    for (let u = -L + 2; u < L - 1.5; u += 3.4) {
      const m = f.m(u, yArq + 2.65, 0.01)
      P.instancia("vid-at", () => K.geo("vid-at", () => geoVidrioPlano(1.0, 1.0)), M.vidrio, m, false)
    }
  }
  // Pórtico sur con frontón (el del billete de 10 dólares).
  const zP = T.z1 + 5
  for (let k = 0; k < 6; k++) {
    const x = T.x0 + 12 + k * 5.2
    P.instancia("col", geoCol, M.moldura, mT(x, yPod, zP - 0.8))
  }
  P.lote.add(g, cajaE(T.x0 + 9.5, T.x1 - 11.5, 0, yPod, T.z1, zP + 0.2))
  for (let k = 0; k < 4; k++) P.lote.add(g, cajaE(T.x0 + 10.5, T.x1 - 12.5, 0, yPod * (k + 1) * 0.22, zP, zP + 2.6 - k * 0.6))
  P.lote.add(g, cajaE(T.x0 + 9.5, T.x1 - 11.5, yArq, yAt - 0.4, T.z1, zP))
  const cx = (T.x0 + 9.5 + T.x1 - 11.5) / 2
  const ext = (T.x1 - 11.5 - (T.x0 + 9.5)) / 2 + 0.6
  const fP = new Marco(new V3(cx, 0, zP), new V3(0, 0, 1))
  const alto = ext * Math.tan(15 * GRAD)
  P.lote.add(
    g,
    barrido(
      [
        [-ext, yAt - 0.4],
        [0, yAt - 0.4 + alto],
        [ext, yAt - 0.4],
      ],
      [
        [0, 0],
        [0.5, 0],
        [0.6, 0.3],
        [0.9, 0.45],
        [0.9, 0.62],
        [0, 0.68],
      ],
      (a, b, h) => fP.p(a, b, h),
      { interior: [0, 0], vertical: true },
    ),
  )
  const tim = new THREE.Shape()
  tim.moveTo(-ext + 0.3, 0)
  tim.lineTo(ext - 0.3, 0)
  tim.lineTo(0, alto - 0.08)
  tim.closePath()
  P.lote.add(g, new THREE.ShapeGeometry(tim), fP.m(0, yAt - 0.4, 0.05))
  for (const s of [-1, 1]) {
    P.lote.add(
      M.techoMetal,
      poligono([new V3(cx, yAt - 0.4 + alto + 0.6, zP + 0.4), new V3(cx + s * ext, yAt + 0.2, zP + 0.4), new V3(cx + s * ext, yAt + 0.2, T.z1 - 1), new V3(cx, yAt - 0.4 + alto + 0.6, T.z1 - 1)], new V3(s, 1, 0)),
    )
  }
  // La puerta del pabellón norte (entre dos ventanas, en z = −55): marco de granito y la hoja.
  P.lote.add(g, cajaE(T.x0 - 0.16, T.x0, 2.9, 3.3, -55.7, -54.3))
  for (const z of [-55.7, -54.42]) P.lote.add(g, cajaE(T.x0 - 0.16, T.x0, 0, 2.9, z, z + 0.12))
  // La hoja, del mismo metal oscuro del techo (un material que la pieza ya dibuja: no suma llamadas).
  P.lote.add(M.techoMetal, cajaE(T.x0 - 0.05, T.x0 + 0.01, 0, 2.9, -55.58, -54.42))
  // Techo bajo.
  mansarda(P, M.techoMetal, T.x0 + 1, T.x1 - 1, T.z0 + 1, T.z1 - 1, yTop, yTop + 2.2, 6)
  P.cerrar(K)
}

// ──────────────────────────────────────────────────────────────
// La ciudad de fondo: edificios de 6 a 12 pisos más allá de las calles
// ──────────────────────────────────────────────────────────────

function construirCiudad(K: Constructor): void {
  const PR = K.P
  const rnd = azar(1800)
  const grupo = new THREE.Group()
  grupo.name = "ciudad"
  const quads = PR.ciudad.map(() => ({ pos: [] as number[], uv: [] as number[], nor: [] as number[] }))
  const techo = new Lote()
  const equipos: THREE.Matrix4[] = []
  const PISO = 3.6
  const zonas: Array<{ x0: number; x1: number; z0: number; z1: number; p0: number; p1: number; cuadra: number }> = [
    { x0: -430, x1: 430, z0: -330, z1: -192, p0: 6, p1: 12, cuadra: 62 },
    { x0: -175, x1: -100, z0: -178, z1: -96, p0: 4, p1: 7, cuadra: 36 },
    { x0: 100, x1: 175, z0: -178, z1: -96, p0: 5, p1: 9, cuadra: 36 },
    { x0: -96, x1: -72, z0: -170, z1: -96, p0: 3, p1: 5, cuadra: 26 },
    { x0: 72, x1: 96, z0: -170, z1: -96, p0: 3, p1: 5, cuadra: 26 },
    { x0: -440, x1: -192, z0: -180, z1: 520, p0: 6, p1: 12, cuadra: 64 },
    { x0: 188, x1: 440, z0: -180, z1: 520, p0: 6, p1: 12, cuadra: 64 },
  ]
  const calle = 14
  const edificio = (x0: number, x1: number, z0: number, z1: number, h: number, estilo: number) => {
    const Q = quads[estilo]
    const bay = estilo === 1 ? 3.0 : 3.4
    const ou = Math.floor(rnd() * 8) / 8
    const ov = Math.floor(rnd() * 8) / 8
    const cara = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
      const L = Math.hypot(bx - ax, bz - az)
      const u1 = ou + L / (8 * bay)
      const v1 = ov + h / (8 * PISO)
      const p = [ax, 0, az, bx, 0, bz, bx, h, bz, ax, 0, az, bx, h, bz, ax, h, az]
      const uv = [ou, ov, u1, ov, u1, v1, ou, ov, u1, v1, ou, v1]
      // Sentido: la cara mira hacia (nx, nz).
      const e1x = bx - ax
      const e1z = bz - az
      const cruz = e1x * nz - e1z * nx
      if (cruz < 0) {
        Q.pos.push(...p)
        Q.uv.push(...uv)
      } else {
        Q.pos.push(bx, 0, bz, ax, 0, az, ax, h, az, bx, 0, bz, ax, h, az, bx, h, bz)
        Q.uv.push(ou, ov, u1, ov, u1, v1, ou, ov, u1, v1, ou, v1)
      }
      for (let k = 0; k < 6; k++) Q.nor.push(nx, 0, nz)
    }
    cara(x0, z0, x1, z0, 0, -1)
    cara(x1, z0, x1, z1, 1, 0)
    cara(x1, z1, x0, z1, 0, 1)
    cara(x0, z1, x0, z0, -1, 0)
    techo.add(PR.ciudadTecho, cajaE(x0 - 0.35, x1 + 0.35, h - 0.05, h + 0.7, z0 - 0.35, z1 + 0.35))
    const nEq = Math.floor(rnd() * 4)
    for (let k = 0; k < nEq; k++) {
      const ex = x0 + 3 + rnd() * Math.max(1, x1 - x0 - 6)
      const ez = z0 + 3 + rnd() * Math.max(1, z1 - z0 - 6)
      const s = 1 + rnd() * 2.5
      equipos.push(new THREE.Matrix4().makeScale(s * (1 + rnd()), 1 + rnd() * 1.8, s).setPosition(ex, h + 0.7, ez))
    }
  }
  for (const zn of zonas) {
    for (let bx = zn.x0; bx < zn.x1 - 8; bx += zn.cuadra + calle) {
      for (let bz = zn.z0; bz < zn.z1 - 8; bz += zn.cuadra + calle) {
        const cx1 = Math.min(bx + zn.cuadra, zn.x1)
        const cz1 = Math.min(bz + zn.cuadra, zn.z1)
        // Cada cuadra se parte en 1 a 3 edificios de alturas distintas.
        const partes = 1 + Math.floor(rnd() * 3)
        const largoX = cx1 - bx > cz1 - bz
        for (let k = 0; k < partes; k++) {
          const a = k / partes
          const b = (k + 1) / partes
          let x0 = bx
          let x1 = cx1
          let z0 = bz
          let z1 = cz1
          if (largoX) {
            x0 = bx + (cx1 - bx) * a + (k > 0 ? 0.4 : 0)
            x1 = bx + (cx1 - bx) * b
          } else {
            z0 = bz + (cz1 - bz) * a + (k > 0 ? 0.4 : 0)
            z1 = bz + (cz1 - bz) * b
          }
          if (x1 - x0 < 6 || z1 - z0 < 6) continue
          const pisos = zn.p0 + Math.floor(rnd() * (zn.p1 - zn.p0 + 1))
          const estilo = Math.floor(rnd() * PR.ciudad.length)
          edificio(x0, x1, z0, z1, pisos * PISO + 1.2, estilo)
        }
      }
    }
  }
  quads.forEach((Q, i) => {
    if (!Q.pos.length) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(Q.pos, 3))
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(Q.nor, 3))
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(Q.uv, 2))
    geo.computeBoundingSphere()
    const m = new THREE.Mesh(geo, PR.ciudad[i])
    m.castShadow = false
    m.receiveShadow = K.ctx.sombras
    m.matrixAutoUpdate = false
    grupo.add(m)
  })
  techo.volcar(grupo, () => [false, K.ctx.sombras])
  if (equipos.length) {
    const im = new THREE.InstancedMesh(prep(cajaE(-0.5, 0.5, 0, 1, -0.5, 0.5)), PR.ciudadTecho, equipos.length)
    equipos.forEach((m, i) => im.setMatrixAt(i, m))
    im.computeBoundingSphere()
    im.matrixAutoUpdate = false
    grupo.add(im)
  }
  K.ctx.niveles.superficie.add(grupo)
}

// ──────────────────────────────────────────────────────────────
// Reflectores nocturnos: la fachada bañada de luz como en la realidad
// ──────────────────────────────────────────────────────────────

const FOCO_FACHADA = 240

function reflectores(K: Constructor): void {
  const g = new THREE.Group()
  g.name = "reflectores"
  const foco = (px: number, pz: number, tx: number, ty: number, tz: number, ang: number, int: number) => {
    const s = new THREE.SpotLight(0xfff4e6, 0, 110, ang, 0.75, 1.5)
    s.position.set(px, 0.6, pz)
    s.target.position.set(tx, ty, tz)
    s.castShadow = false
    g.add(s, s.target)
    K.ctx.luzNocturna(s, int)
  }
  // Fachada norte: dos focos bajos en el césped que cubren alas y pórtico.
  // A ~33 m de una fachada blanca, 240 la deja bañada de luz; con 1500 la casa
  // entera se quemaba de blanco de noche (exposición 1,85 + bloom).
  foco(-17, -44, -10, 9, -13, 0.62, FOCO_FACHADA)
  foco(17, -44, 10, 9, -13, 0.62, FOCO_FACHADA)
  // Fachada sur.
  foco(-19, 48, -9, 9, 14, 0.6, FOCO_FACHADA)
  foco(19, 48, 9, 9, 14, 0.6, FOCO_FACHADA)
  K.ctx.niveles.superficie.add(g)
}

// ──────────────────────────────────────────────────────────────
// Entrada
// ──────────────────────────────────────────────────────────────

/**
 * Construye toda la arquitectura de la superficie en `ctx.niveles.superficie`
 * y registra lo que se anima (bandera, grúas) y lo que se enciende de noche.
 */
export function construirArquitectura(ctx: CtxEscena): void {
  const K = new Constructor(ctx)
  construirResidencia(K)
  construirAlaOeste(K)
  construirObra(K)
  construirEEOB(K)
  construirTesoro(K)
  construirCiudad(K)
  reflectores(K)
  K.actualizarNoche(0)
  ctx.alActualizar((t) => {
    K.actualizarNoche(t.noche)
    for (const a of K.animaciones) a(t)
  })
}
