// ──────────────────────────────────────────────────────────────
// Constructor de mallas de los personajes.
//
// Todo el cuerpo, la ropa y el pelo se arman con grillas (anillos a lo largo
// de un hueso) en un mismo lote por material. Cada vértice lleva sus pesos de
// piel (hasta 4 huesos), un color (que multiplica al del material: así la ropa
// entera es UN material) y su rugosidad/metal propios (atributo aMat).
//
// Las normales se calculan por pieza y se sueldan por posición: la costura de
// una grilla cerrada y el polo de una esfera no se notan.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"

/** Pesos de piel: [índice de hueso, peso]. Se normalizan y se quedan los 4 mayores. */
export type Pesos = Array<[number, number]>
export type RGBA = [number, number, number, number]
export type Mat2 = [rugosidad: number, metal: number]

const BLANCO: RGBA = [1, 1, 1, 1]
const MAT_BASE: Mat2 = [0.6, 0]

/** Arreglo de números que crece duplicando (sin miles de push en arrays de JS). */
class Buf<T extends Float32Array | Uint16Array | Uint32Array> {
  a: T
  n = 0
  private readonly C: { new (n: number): T }
  constructor(C: { new (n: number): T }, cap: number) {
    this.C = C
    this.a = new C(cap)
  }
  reservar(k: number) {
    if (this.n + k <= this.a.length) return
    let cap = this.a.length * 2
    while (cap < this.n + k) cap *= 2
    const b = new this.C(cap)
    b.set(this.a.subarray(0, this.n))
    this.a = b
  }
  push2(x: number, y: number) {
    this.reservar(2)
    this.a[this.n++] = x
    this.a[this.n++] = y
  }
  push3(x: number, y: number, z: number) {
    this.reservar(3)
    this.a[this.n++] = x
    this.a[this.n++] = y
    this.a[this.n++] = z
  }
  push4(x: number, y: number, z: number, w: number) {
    this.reservar(4)
    this.a[this.n++] = x
    this.a[this.n++] = y
    this.a[this.n++] = z
    this.a[this.n++] = w
  }
  get(i: number): number {
    return this.a[i]
  }
  set(i: number, v: number) {
    this.a[i] = v
  }
  vista(): T {
    return this.a.subarray(0, this.n) as T
  }
}

export class Lote {
  // Capacidad inicial para ~4000 vértices: casi nunca hace falta crecer.
  private readonly bPos = new Buf(Float32Array, 12288)
  private readonly bUv = new Buf(Float32Array, 8192)
  private readonly bUv1 = new Buf(Float32Array, 8192)
  private readonly bCol = new Buf(Float32Array, 16384)
  private readonly bMat = new Buf(Float32Array, 8192)
  private readonly bSi = new Buf(Uint16Array, 16384)
  private readonly bSw = new Buf(Float32Array, 16384)
  private readonly bIdx = new Buf(Uint32Array, 24576)
  private readonly bEx = new Buf(Float32Array, 4)
  usaUv1 = false
  /** Atributo extra por vértice (aArr: coordenadas del mapa de arrugas, edad, hoyuelo). */
  usaEx = false
  private readonly exDef: [number, number, number, number] = [0, 0, 0, 0]
  private piezas: Array<[number, number, number, number]> = []
  private v0 = 0
  private i0 = 0

  /** Posiciones (lectura y escritura directa: x, y, z por vértice). */
  get pos(): Float32Array {
    return this.bPos.a
  }
  /** Índices de triángulos (arreglo crudo: válidos hasta `nIdx`). */
  get indices(): Uint32Array {
    return this.bIdx.a
  }
  get nIdx(): number {
    return this.bIdx.n
  }

  get nv(): number {
    return this.bPos.n / 3
  }
  /** Huesos y pesos de piel (4 por vértice), para retocar la pose de reposo. */
  get huesosV(): Uint16Array {
    return this.bSi.a
  }
  get pesosV(): Float32Array {
    return this.bSw.a
  }
  /** Colores (4 por vértice), lectura y escritura. */
  get colores(): Float32Array {
    return this.bCol.a
  }

  private activarEx() {
    if (this.usaEx) return
    this.usaEx = true
    this.bEx.reservar(this.nv * 4)
    this.bEx.a.fill(0, 0, this.nv * 4)
    this.bEx.n = this.nv * 4
  }

  /**
   * Valor por defecto del atributo extra para los vértices que siguen (en la
   * ropa: la tela y el pliegue de la prenda que se está armando).
   */
  exPorDefecto(a: number, b = 0, c = 0, d = 0) {
    this.activarEx()
    this.exDef[0] = a
    this.exDef[1] = b
    this.exDef[2] = c
    this.exDef[3] = d
  }

  /** Atributo extra del último vértice agregado (4 valores). */
  ex(a: number, b: number, c: number, d: number) {
    this.activarEx()
    const i = (this.nv - 1) * 4
    this.bEx.reservar(4)
    if (this.bEx.n < i + 4) this.bEx.n = i + 4
    this.bEx.set(i, a)
    this.bEx.set(i + 1, b)
    this.bEx.set(i + 2, c)
    this.bEx.set(i + 3, d)
  }

  /** Agrega un vértice y devuelve su índice. */
  v(x: number, y: number, z: number, u: number, w: number, c: RGBA = BLANCO, pesos: Pesos = [[0, 1]], m: Mat2 = MAT_BASE, uv1?: [number, number]): number {
    this.bPos.push3(x, y, z)
    this.bUv.push2(u, w)
    this.bCol.push4(c[0], c[1], c[2], c[3])
    this.bMat.push2(m[0], m[1])
    if (uv1) {
      this.usaUv1 = true
      this.bUv1.push2(uv1[0], uv1[1])
    } else this.bUv1.push2(0.02, 0.98)
    // Pesos: los 4 mayores, normalizados.
    let p = pesos
    if (p.length > 4) p = [...p].sort((a, b) => b[1] - a[1]).slice(0, 4)
    let s = 0
    for (let k = 0; k < p.length; k++) s += p[k][1]
    s = s > 1e-9 ? 1 / s : 0
    const e0 = p[0], e1 = p[1], e2 = p[2], e3 = p[3]
    this.bSi.push4(e0 ? e0[0] : 0, e1 ? e1[0] : 0, e2 ? e2[0] : 0, e3 ? e3[0] : 0)
    this.bSw.push4(e0 ? e0[1] * s : 0, e1 ? e1[1] * s : 0, e2 ? e2[1] * s : 0, e3 ? e3[1] * s : 0)
    if (this.usaEx) this.bEx.push4(this.exDef[0], this.exDef[1], this.exDef[2], this.exDef[3])
    return this.nv - 1
  }

  /** Copia un vértice (todos sus atributos) y devuelve el índice nuevo. */
  duplicar(v: number, du = 0): number {
    const P = this.bPos.a, U = this.bUv.a, U1 = this.bUv1.a, C = this.bCol.a, Mt = this.bMat.a, SI = this.bSi.a, SW = this.bSw.a
    this.bPos.push3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])
    this.bUv.push2(U[v * 2] + du, U[v * 2 + 1])
    this.bUv1.push2(U1[v * 2], U1[v * 2 + 1])
    this.bCol.push4(C[v * 4], C[v * 4 + 1], C[v * 4 + 2], C[v * 4 + 3])
    this.bMat.push2(Mt[v * 2], Mt[v * 2 + 1])
    this.bSi.push4(SI[v * 4], SI[v * 4 + 1], SI[v * 4 + 2], SI[v * 4 + 3])
    this.bSw.push4(SW[v * 4], SW[v * 4 + 1], SW[v * 4 + 2], SW[v * 4 + 3])
    if (this.usaEx) {
      const E = this.bEx.a
      this.bEx.push4(E[v * 4], E[v * 4 + 1], E[v * 4 + 2], E[v * 4 + 3])
    }
    return this.nv - 1
  }

  /**
   * Costura de una coordenada u periódica (ángulo alrededor de un remolino):
   * en los triángulos que la cruzan, los vértices del lado bajo se duplican
   * con u + período, así la textura no se aplasta en esa fila.
   */
  costuraU(i0: number, periodo: number) {
    const dup = new Map<number, number>()
    const I = this.bIdx.a
    const n = this.bIdx.n
    for (let k = i0; k < n; k += 3) {
      const U = this.bUv.a
      const a = I[k], b = I[k + 1], c = I[k + 2]
      const ua = U[a * 2], ub = U[b * 2], uc = U[c * 2]
      const mx = Math.max(ua, ub, uc)
      if (mx - Math.min(ua, ub, uc) <= periodo * 0.5) continue
      for (let q = 0; q < 3; q++) {
        const v = I[k + q]
        if (this.bUv.a[v * 2] < mx - periodo * 0.5) {
          let d = dup.get(v)
          if (d === undefined) {
            d = this.duplicar(v, periodo)
            dup.set(v, d)
          }
          this.bIdx.a[k + q] = d
        }
      }
    }
  }

  t(a: number, b: number, c: number) {
    this.bIdx.push3(a, b, c)
  }

  /** Cuadrilátero a-b-c-d (en orden de giro). */
  q(a: number, b: number, c: number, d: number) {
    this.bIdx.push3(a, b, c)
    this.bIdx.push3(a, c, d)
  }

  /** Cierra la pieza actual: sus normales se calculan aparte (sin suavizar con la vecina). */
  pieza() {
    const ni = this.bIdx.n
    if (this.nv > this.v0 || ni > this.i0) this.piezas.push([this.v0, this.nv, this.i0, ni])
    this.v0 = this.nv
    this.i0 = ni
  }

  /**
   * Tiras de cuadriláteros entre filas de una grilla `ids[fila][col]`.
   * `cerrada`: la última columna se une con la primera. `emitir(i, j)` decide
   * si va el cuadrilátero que empieza en (i, j). `afuera` da el sentido: el
   * centro de cada fila para que las caras miren hacia fuera (si no, se usa
   * `invertir`).
   */
  tiras(ids: number[][], cerrada: boolean, op: { emitir?: (i: number, j: number) => boolean; centros?: THREE.Vector3[]; invertir?: boolean } = {}) {
    const filas = ids.length
    if (filas < 2) return
    const cols = ids[0].length
    let inv = !!op.invertir
    if (op.centros) {
      // Mira el primer cuadrilátero no degenerado y su orientación respecto del centro.
      let votos = 0
      const P = this.pos
      // Se vota desde la fila del medio (los bordes pueden ser tiras de canto).
      for (let n = 0; n < filas - 1 && Math.abs(votos) < 6; n++) {
        const i = (Math.floor((filas - 1) / 2) + n) % (filas - 1)
        for (let j = 0; j < (cerrada ? cols : cols - 1); j += 3) {
          const a = ids[i][j]
          const b = ids[i][(j + 1) % cols]
          const d = ids[i + 1][j]
          if (a < 0 || b < 0 || d < 0) continue
          const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2]
          const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az
          const e2x = P[d * 3] - ax, e2y = P[d * 3 + 1] - ay, e2z = P[d * 3 + 2] - az
          const nx = e1y * e2z - e1z * e2y
          const ny = e1z * e2x - e1x * e2z
          const nz = e1x * e2y - e1y * e2x
          const c = op.centros[i]
          const dot = nx * (ax - c.x) + ny * (ay - c.y) + nz * (az - c.z)
          if (Math.abs(dot) > 1e-14) votos += dot > 0 ? 1 : -1
        }
      }
      // (b-a)×(d-a) es la normal del orden a-b-c-d: si apunta hacia el centro, se invierte.
      inv = votos < 0
    }
    for (let i = 0; i < filas - 1; i++) {
      const jMax = cerrada ? cols : cols - 1
      for (let j = 0; j < jMax; j++) {
        if (op.emitir && !op.emitir(i, j)) continue
        const j2 = (j + 1) % cols
        const a = ids[i][j]
        const b = ids[i][j2]
        const c = ids[i + 1][j2]
        const d = ids[i + 1][j]
        if (a < 0 || b < 0 || c < 0 || d < 0) continue
        if (inv) this.q(a, d, c, b)
        else this.q(a, b, c, d)
      }
    }
  }

  /** Normales suavizadas por pieza, soldando vértices en la misma posición. */
  private normales(): Float32Array {
    this.pieza()
    const P = this.bPos.a
    const I = this.bIdx.a
    const N = new Float32Array(this.bPos.n)
    for (const [v0, v1, i0, i1] of this.piezas) {
      for (let k = i0; k < i1; k += 3) {
        const a = I[k] * 3
        const b = I[k + 1] * 3
        const c = I[k + 2] * 3
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2]
        const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2]
        const nx = e1y * e2z - e1z * e2y
        const ny = e1z * e2x - e1x * e2z
        const nz = e1x * e2y - e1y * e2x
        for (const o of [a, b, c]) {
          N[o] += nx
          N[o + 1] += ny
          N[o + 2] += nz
        }
      }
      // Soldar por posición (costuras de grillas cerradas, polos).
      const grupos = new Map<string, number[]>()
      for (let v = v0; v < v1; v++) {
        const k = `${Math.round(P[v * 3] * 2e5)},${Math.round(P[v * 3 + 1] * 2e5)},${Math.round(P[v * 3 + 2] * 2e5)}`
        const g = grupos.get(k)
        if (g) g.push(v)
        else grupos.set(k, [v])
      }
      for (const g of grupos.values()) {
        if (g.length < 2) continue
        let sx = 0, sy = 0, sz = 0
        for (const v of g) {
          sx += N[v * 3]
          sy += N[v * 3 + 1]
          sz += N[v * 3 + 2]
        }
        for (const v of g) {
          N[v * 3] = sx
          N[v * 3 + 1] = sy
          N[v * 3 + 2] = sz
        }
      }
    }
    for (let k = 0; k < N.length; k += 3) {
      const l = Math.hypot(N[k], N[k + 1], N[k + 2])
      if (l > 1e-20) {
        N[k] /= l
        N[k + 1] /= l
        N[k + 2] /= l
      } else N[k + 1] = 1
    }
    return N
  }

  /** La geometría lista para una SkinnedMesh (o una Mesh: los atributos de piel sobran). */
  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    const n = this.nv
    const normales = this.normales()
    g.setAttribute("position", new THREE.BufferAttribute(this.bPos.vista().slice(), 3))
    g.setAttribute("normal", new THREE.BufferAttribute(normales, 3))
    g.setAttribute("uv", new THREE.BufferAttribute(this.bUv.vista().slice(), 2))
    if (this.usaUv1) g.setAttribute("uv1", new THREE.BufferAttribute(this.bUv1.vista().slice(), 2))
    if (this.usaEx) {
      const ex = new Float32Array(n * 4)
      ex.set(this.bEx.a.subarray(0, Math.min(this.bEx.n, n * 4)))
      g.setAttribute("aArr", new THREE.BufferAttribute(ex, 4))
    }
    g.setAttribute("color", new THREE.BufferAttribute(this.bCol.vista().slice(), 4))
    g.setAttribute("aMat", new THREE.BufferAttribute(this.bMat.vista().slice(), 2))
    g.setAttribute("skinIndex", new THREE.BufferAttribute(this.bSi.vista().slice(), 4))
    g.setAttribute("skinWeight", new THREE.BufferAttribute(this.bSw.vista().slice(), 4))
    const idx = this.bIdx.vista()
    g.setIndex(n > 65535 ? new THREE.BufferAttribute(idx.slice(), 1) : new THREE.BufferAttribute(Uint16Array.from(idx), 1))
    return g
  }

  get triangulos(): number {
    return this.bIdx.n / 3
  }
}

// ── Utilidades numéricas ──────────────────────────────────────

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const suave = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Campana gaussiana (1 en x = c, ~0 a 2·s). */
export const campana = (x: number, c: number, s: number) => {
  const d = (x - c) / s
  return Math.exp(-d * d)
}

/** Interpolación Catmull-Rom sobre una tabla [x, ...valores] ordenada por x. */
export function tablaSuave(tabla: number[][], x: number, k: number): number {
  const n = tabla.length
  if (x <= tabla[0][0]) return tabla[0][k]
  if (x >= tabla[n - 1][0]) return tabla[n - 1][k]
  let i = 0
  while (i < n - 2 && x > tabla[i + 1][0]) i++
  const x1 = tabla[i][0]
  const x2 = tabla[i + 1][0]
  const t = (x - x1) / (x2 - x1)
  const p0 = tabla[Math.max(0, i - 1)][k]
  const p1 = tabla[i][k]
  const p2 = tabla[i + 1][k]
  const p3 = tabla[Math.min(n - 1, i + 2)][k]
  // Catmull-Rom con tangentes amortiguadas (no se pasa de los extremos).
  const m1 = (p2 - p0) * 0.5 * 0.85
  const m2 = (p3 - p1) * 0.5 * 0.85
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2
}

/** Hash determinista de un texto (semilla por personaje). */
export function hashTexto(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Color hex → RGBA lineal (para los colores por vértice). */
export function rgba(hex: string | THREE.Color, a = 1): RGBA {
  const c = typeof hex === "string" ? new THREE.Color(hex) : hex
  return [c.r, c.g, c.b, a]
}
export function mezclarRGBA(a: RGBA, b: RGBA, t: number): RGBA {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]
}
export function escalarRGBA(a: RGBA, k: number): RGBA {
  return [a[0] * k, a[1] * k, a[2] * k, a[3]]
}
