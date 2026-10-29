// ──────────────────────────────────────────────────────────────
// El lote de la maqueta: muchas piezas, UNA geometría
//
// Lo usan el subsuelo (subsuelo.ts) y los interiores de los edificios
// (interiores.ts). Cada pieza se fusiona con su color, rugosidad, metal y
// brillo propio por vértice; el material "maqueta" los lee en el shader. Así
// una sala entera, con muebles, es una sola llamada de dibujo.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { CtxEscena } from "./contrato"

// ── Acabados (rugosidad, metal, brillo propio) ──────────────────
export type Acabado = { r: number; m: number; e?: number }
export const A = {
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
export type Col = THREE.Color | string
const _cache = new Map<string, THREE.Color>()
export function C(c: Col): THREE.Color {
  if (typeof c !== "string") return c
  let k = _cache.get(c)
  if (!k) {
    k = new THREE.Color(c)
    _cache.set(c, k)
  }
  return k
}
export function mezcla(a: Col, b: Col, t: number): THREE.Color {
  return C(a).clone().lerp(C(b), t)
}

// ── Prototipos de geometría (sin índice, se transforman al fusionar) ──
const PROTO = new Map<string, THREE.BufferGeometry>()
export function proto(k: string, f: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = PROTO.get(k)
  if (!g) {
    g = f()
    if (g.index) g = g.toNonIndexed()
    PROTO.set(k, g)
  }
  return g
}
export const BOX = () => proto("box", () => new THREE.BoxGeometry(1, 1, 1))
/** Cilindro de radio 1 abajo y `rt` arriba, alto 1, centrado. */
export const CIL = (n: number, rt = 1, abierto = false) =>
  proto(`cil${n}-${rt}-${abierto}`, () => new THREE.CylinderGeometry(rt, 1, 1, n, 1, abierto))
export const ESF = (w: number, h: number) => proto(`esf${w}-${h}`, () => new THREE.SphereGeometry(1, w, h))
export const ICO = (d: number) =>
  proto(`ico${d}`, () => {
    const g = new THREE.IcosahedronGeometry(1, d)
    // normales esféricas: se ve redondo con pocos triángulos
    const p = g.attributes.position
    const n = g.attributes.normal
    for (let i = 0; i < p.count; i++) n.setXYZ(i, p.getX(i), p.getY(i), p.getZ(i))
    return g
  })
export const PLANO = () => proto("plano", () => new THREE.PlaneGeometry(1, 1))
export const ARO = (rel: number, n: number, a0: number, da: number) =>
  proto(`aro${rel.toFixed(4)}-${n}-${a0.toFixed(3)}-${da.toFixed(3)}`, () => new THREE.RingGeometry(rel, 1, n, 1, a0, da))
export const TORO = (rel: number, n: number, m = 8) => proto(`toro${rel.toFixed(4)}-${n}-${m}`, () => new THREE.TorusGeometry(1, rel, m, n))
export const CAPS = (r: number, l: number, cs: number, rs: number) =>
  proto(`caps${r}-${l}-${cs}-${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs))
/** Pirámide de base cuadrada (4 lados), ancho 2 x 2 abajo, punta arriba. */
export const PIRAMIDE = (rt: number) =>
  proto(`pir${rt}`, () => {
    const g = new THREE.CylinderGeometry(rt, 1, 1, 4, 1, true)
    g.rotateY(Math.PI / 4)
    g.scale(Math.SQRT2, 1, Math.SQRT2)
    return g
  })

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
/** Matriz: posición, escala y rotación (orden YXZ). */
export function M(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, "YXZ")
  _q.setFromEuler(_e)
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz))
}


// ── Lote: acumula piezas y las fusiona en UNA geometría ─────────
export class Buf {
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

export class Lote {
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

/**
 * El material de la maqueta: color, rugosidad, metal y brillo por vértice
 * (atributo aAcabado). `emissive` funciona como intensidad del brillo propio:
 * el motor la lleva de `dia` a `noche` con la hora (ctx.alAnochecer).
 */
export function crearMaqueta(ctx: CtxEscena, clave: string, noche: number, dia: number, mapa?: THREE.Texture): THREE.MeshStandardMaterial {
  const maqueta = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    ...(mapa ? { map: mapa } : {}),
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
  maqueta.customProgramCacheKey = () => clave
  ctx.alAnochecer(maqueta, noche, dia)
  return maqueta
}
