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

export class Lote {
  readonly pos: number[] = []
  readonly uv: number[] = []
  readonly uv1: number[] = []
  readonly col: number[] = []
  readonly mat: number[] = []
  readonly si: number[] = []
  readonly sw: number[] = []
  readonly idx: number[] = []
  usaUv1 = false
  private piezas: Array<[number, number, number, number]> = []
  private v0 = 0
  private i0 = 0

  get nv(): number {
    return this.pos.length / 3
  }

  /** Agrega un vértice y devuelve su índice. */
  v(x: number, y: number, z: number, u: number, w: number, c: RGBA = BLANCO, pesos: Pesos = [[0, 1]], m: Mat2 = MAT_BASE, uv1?: [number, number]): number {
    this.pos.push(x, y, z)
    this.uv.push(u, w)
    this.col.push(c[0], c[1], c[2], c[3])
    this.mat.push(m[0], m[1])
    if (uv1) {
      this.usaUv1 = true
      this.uv1.push(uv1[0], uv1[1])
    } else this.uv1.push(0.02, 0.98)
    // Pesos: los 4 mayores, normalizados.
    let p = pesos
    if (p.length > 4) p = [...p].sort((a, b) => b[1] - a[1]).slice(0, 4)
    let s = 0
    for (const [, k] of p) s += k
    s = s > 1e-9 ? 1 / s : 0
    for (let k = 0; k < 4; k++) {
      const e = p[k]
      this.si.push(e ? e[0] : 0)
      this.sw.push(e ? e[1] * s : 0)
    }
    return this.nv - 1
  }

  t(a: number, b: number, c: number) {
    this.idx.push(a, b, c)
  }

  /** Cuadrilátero a-b-c-d (en orden de giro). */
  q(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d)
  }

  /** Cierra la pieza actual: sus normales se calculan aparte (sin suavizar con la vecina). */
  pieza() {
    if (this.nv > this.v0 || this.idx.length > this.i0) this.piezas.push([this.v0, this.nv, this.i0, this.idx.length])
    this.v0 = this.nv
    this.i0 = this.idx.length
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
    const P = this.pos
    const N = new Float32Array(P.length)
    for (const [v0, v1, i0, i1] of this.piezas) {
      for (let k = i0; k < i1; k += 3) {
        const a = this.idx[k] * 3
        const b = this.idx[k + 1] * 3
        const c = this.idx[k + 2] * 3
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
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute("normal", new THREE.BufferAttribute(this.normales(), 3))
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2))
    if (this.usaUv1) g.setAttribute("uv1", new THREE.Float32BufferAttribute(this.uv1, 2))
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 4))
    g.setAttribute("aMat", new THREE.Float32BufferAttribute(this.mat, 2))
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4))
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4))
    const n = this.nv
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1))
    return g
  }

  get triangulos(): number {
    return this.idx.length / 3
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
