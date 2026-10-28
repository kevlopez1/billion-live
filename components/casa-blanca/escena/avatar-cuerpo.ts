// ──────────────────────────────────────────────────────────────
// El cuerpo: proporciones, esqueleto y la malla de piel.
//
// Proporciones de adulto reales según la altura y la complexión (hombros,
// pecho, cintura, cadera, pantorrillas). El tronco es un "loft": secciones
// anatómicas (pectorales, omóplatos, glúteos, vientre) a lo largo de la
// columna que siguen, sin corte, por el cuello y la cabeza esculpida. Brazos
// y piernas son tubos con secciones de músculo a lo largo de sus huesos
// (deltoides, bíceps, antebrazo, muslo, rodilla, gemelo, tobillo), con manos
// de cinco dedos y pies.
//
// Los pesos de piel se mezclan en las articulaciones, así nada se separa al
// doblar. La ropa (avatar-ropa.ts) reutiliza estas mismas secciones infladas.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Personaje } from "../tipos"
import { Cabeza, rasgosDe, type Rasgos } from "./avatar-cabeza"
import { campana, clamp, lerp, Lote, suave, tablaSuave, type Mat2, type Pesos, type RGBA } from "./avatar-geo"

export const HUESOS = [
  "cadera", "columna", "pecho", "cuello", "cabeza", "mandibula", "ojoI", "ojoD", "parpadoI", "parpadoD",
  "claviculaI", "hombroI", "codoI", "manoI", "dedosI", "dedos2I", "pulgarI",
  "claviculaD", "hombroD", "codoD", "manoD", "dedosD", "dedos2D", "pulgarD",
  "musloI", "rodillaI", "tobilloI", "puntaI", "musloD", "rodillaD", "tobilloD", "puntaD",
] as const
export type NombreHueso = (typeof HUESOS)[number]
const PADRE: Record<NombreHueso, NombreHueso | null> = {
  cadera: null, columna: "cadera", pecho: "columna", cuello: "pecho", cabeza: "cuello", mandibula: "cabeza",
  ojoI: "cabeza", ojoD: "cabeza", parpadoI: "cabeza", parpadoD: "cabeza",
  claviculaI: "pecho", hombroI: "claviculaI", codoI: "hombroI", manoI: "codoI", dedosI: "manoI", dedos2I: "dedosI", pulgarI: "manoI",
  claviculaD: "pecho", hombroD: "claviculaD", codoD: "hombroD", manoD: "codoD", dedosD: "manoD", dedos2D: "dedosD", pulgarD: "manoD",
  musloI: "cadera", rodillaI: "musloI", tobilloI: "rodillaI", puntaI: "tobilloI",
  musloD: "cadera", rodillaD: "musloD", tobilloD: "rodillaD", puntaD: "tobilloD",
}
export const H = Object.fromEntries(HUESOS.map((n, i) => [n, i])) as Record<NombreHueso, number>

/** Columnas alrededor del tronco y la cabeza: más densas al frente (la cara). */
export const M = 72
export const ANG: number[] = (() => {
  const a = 0.42
  const out: number[] = []
  for (let j = 0; j < M; j++) {
    const u = (2 * j) / M - 1
    out.push(Math.PI / 2 + Math.PI * u * (a + (1 - a) * u * u))
  }
  return out
})()

/** Ángulos α de las filas de la cabeza en la columna del frente (grados desde la coronilla). */
const ALFAS = [0, 8, 16, 24, 32, 39, 46, 52, 57.5, 62.5, 66.5, 70, 73, 75.5, 78, 80.5, 83, 85.5, 88, 90.5, 93, 95.5, 98, 100.5, 103, 105.5, 108, 110.5, 113, 115.5, 118, 120, 122, 124, 126, 128, 130, 132.5, 135, 137.5, 140, 143, 146]
const FILAS_CUELLO = 6

/** Tronco masculino de 1,78 m, complexión media: [y/H, medio ancho, frente z, espalda z, z del costado]. */
const TRONCO_H = [
  [0.448, 0.05, 0.024, -0.046, -0.012],
  [0.458, 0.1, 0.045, -0.068, -0.012],
  [0.468, 0.128, 0.062, -0.086, -0.012],
  [0.49, 0.158, 0.074, -0.106, -0.014],
  [0.51, 0.168, 0.079, -0.114, -0.014],
  [0.53, 0.172, 0.082, -0.109, -0.012],
  [0.555, 0.168, 0.085, -0.097, -0.008],
  [0.58, 0.159, 0.087, -0.085, -0.005],
  [0.605, 0.149, 0.088, -0.078, -0.003],
  [0.635, 0.148, 0.091, -0.08, -0.002],
  [0.67, 0.153, 0.099, -0.088, 0],
  [0.7, 0.16, 0.107, -0.096, 0],
  [0.725, 0.166, 0.114, -0.1, 0],
  [0.75, 0.171, 0.112, -0.104, -0.003],
  [0.775, 0.176, 0.097, -0.104, -0.007],
  [0.795, 0.18, 0.08, -0.1, -0.012],
  [0.806, 0.172, 0.066, -0.094, -0.016],
  [0.815, 0.152, 0.054, -0.088, -0.02],
  [0.823, 0.118, 0.045, -0.082, -0.024],
  [0.83, 0.085, 0.038, -0.077, -0.026],
]
const TRONCO_M = [
  [0.448, 0.05, 0.024, -0.05, -0.012],
  [0.458, 0.1, 0.045, -0.074, -0.012],
  [0.468, 0.132, 0.06, -0.094, -0.014],
  [0.49, 0.168, 0.07, -0.116, -0.016],
  [0.51, 0.18, 0.075, -0.122, -0.016],
  [0.53, 0.182, 0.078, -0.112, -0.012],
  [0.555, 0.172, 0.08, -0.096, -0.008],
  [0.58, 0.152, 0.08, -0.082, -0.005],
  [0.605, 0.132, 0.078, -0.072, -0.003],
  [0.635, 0.13, 0.08, -0.074, -0.002],
  [0.67, 0.138, 0.088, -0.08, 0],
  [0.7, 0.146, 0.098, -0.086, 0],
  [0.725, 0.152, 0.102, -0.088, 0],
  [0.75, 0.155, 0.098, -0.09, -0.003],
  [0.775, 0.158, 0.088, -0.09, -0.007],
  [0.795, 0.16, 0.072, -0.088, -0.012],
  [0.806, 0.153, 0.06, -0.083, -0.016],
  [0.815, 0.135, 0.05, -0.078, -0.02],
  [0.823, 0.105, 0.042, -0.074, -0.024],
  [0.83, 0.076, 0.036, -0.07, -0.026],
]

/** Brazo: [u (m desde el hombro, base 1,78), lateral, frente, medial, atrás]. */
const BRAZO = [
  [-0.02, 0.012, 0.012, 0.012, 0.012],
  [-0.008, 0.032, 0.032, 0.028, 0.032],
  [0.01, 0.042, 0.042, 0.036, 0.043],
  [0.05, 0.046, 0.045, 0.039, 0.046],
  [0.1, 0.044, 0.045, 0.039, 0.046],
  [0.165, 0.04, 0.046, 0.038, 0.045],
  [0.24, 0.037, 0.042, 0.036, 0.041],
  [0.305, 0.035, 0.034, 0.035, 0.036],
  [0.333, 0.034, 0.031, 0.035, 0.037],
  [0.36, 0.039, 0.035, 0.035, 0.034],
  [0.41, 0.039, 0.035, 0.033, 0.032],
  [0.49, 0.032, 0.029, 0.029, 0.027],
  [0.565, 0.022, 0.027, 0.02, 0.026],
  [0.59, 0.018, 0.028, 0.017, 0.027],
  [0.625, 0.015, 0.037, 0.016, 0.035],
  [0.66, 0.0125, 0.041, 0.013, 0.038],
  [0.684, 0.0115, 0.041, 0.011, 0.037],
  [0.69, 0.006, 0.03, 0.006, 0.026],
]
/** Pierna: [u (m desde la cadera), lateral, frente, medial, atrás]. */
const PIERNA = [
  [-0.05, 0.02, 0.02, 0.02, 0.02],
  [-0.03, 0.06, 0.058, 0.05, 0.06],
  [0.0, 0.083, 0.078, 0.068, 0.085],
  [0.06, 0.084, 0.079, 0.073, 0.08],
  [0.17, 0.076, 0.075, 0.068, 0.07],
  [0.29, 0.066, 0.066, 0.06, 0.059],
  [0.385, 0.054, 0.055, 0.052, 0.05],
  [0.42, 0.05, 0.056, 0.053, 0.047],
  [0.46, 0.048, 0.046, 0.05, 0.054],
  [0.54, 0.05, 0.04, 0.05, 0.065],
  [0.64, 0.043, 0.035, 0.043, 0.052],
  [0.74, 0.033, 0.029, 0.032, 0.034],
  [0.82, 0.029, 0.029, 0.029, 0.033],
  [0.85, 0.03, 0.031, 0.031, 0.034],
  [0.875, 0.022, 0.026, 0.024, 0.024],
]
/** Pie: [z desde el talón (m), medio ancho, y abajo, y arriba]. */
const PIE = [
  [0.0, 0.012, 0.02, 0.04],
  [0.012, 0.027, 0.004, 0.058],
  [0.04, 0.034, 0.0, 0.075],
  [0.075, 0.036, 0.0, 0.082],
  [0.12, 0.038, 0.0, 0.066],
  [0.165, 0.043, 0.0, 0.048],
  [0.2, 0.046, 0.0, 0.039],
  [0.232, 0.043, 0.001, 0.031],
  [0.255, 0.033, 0.004, 0.025],
  [0.268, 0.016, 0.008, 0.017],
]

export interface Marco {
  c: THREE.Vector3
  T: THREE.Vector3
  N: THREE.Vector3
  L: THREE.Vector3
}

/** Un miembro (brazo o pierna): línea central por las articulaciones, en reposo. */
export class Cadena {
  readonly pts: THREE.Vector3[]
  readonly u: number[]
  readonly lado: 1 | -1
  constructor(pts: THREE.Vector3[], origen: number, lado: 1 | -1) {
    this.pts = pts
    this.lado = lado
    const u = [0]
    for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + pts[i].distanceTo(pts[i - 1]))
    const u0 = u[origen]
    this.u = u.map((x) => x - u0)
  }
  get largo(): number {
    return this.u[this.u.length - 1]
  }
  marco(u: number, out: Marco, adelante = new THREE.Vector3(0, 0, 1)): Marco {
    const n = this.pts.length
    let i = 0
    while (i < n - 2 && u > this.u[i + 1]) i++
    const a = this.pts[i]
    const b = this.pts[i + 1]
    const seg = this.u[i + 1] - this.u[i]
    const t = (u - this.u[i]) / seg
    out.c.copy(a).lerp(b, t)
    const Ta = new THREE.Vector3().subVectors(b, a).normalize()
    // Tangente suavizada cerca de las articulaciones.
    const banda = 0.035
    out.T.copy(Ta)
    if (i > 0 && u - this.u[i] < banda) {
      const Tp = new THREE.Vector3().subVectors(a, this.pts[i - 1]).normalize()
      out.T.lerp(Tp, 0.5 * (1 - (u - this.u[i]) / banda)).normalize()
    }
    if (i < n - 2 && this.u[i + 1] - u < banda) {
      const Tn = new THREE.Vector3().subVectors(this.pts[i + 2], b).normalize()
      out.T.lerp(Tn, 0.5 * (1 - (this.u[i + 1] - u) / banda)).normalize()
    }
    // Para la geometría, T apunta "hacia abajo" del miembro.
    out.N.copy(adelante).addScaledVector(out.T, -adelante.dot(out.T)).normalize()
    out.L.crossVectors(out.N, out.T).normalize().multiplyScalar(this.lado)
    return out
  }
}

export interface FilaCabeza {
  /** Posiciones en el espacio del avatar, una por columna. */
  P: THREE.Vector3[]
  /** Posiciones y normales locales de la cabeza. */
  l: THREE.Vector3[]
  n: THREE.Vector3[]
  radial: boolean
}

export interface Complexion {
  hombros: number
  pecho: number
  prof: number
  cintura: number
  cadera: number
  musculo: number
  panza: number
}

const COMPLEXION: Record<string, Complexion> = {
  delgado: { hombros: 0.95, pecho: 0.93, prof: 0.9, cintura: 0.9, cadera: 0.95, musculo: 0.88, panza: 0 },
  medio: { hombros: 1, pecho: 1, prof: 1, cintura: 1, cadera: 1, musculo: 1, panza: 0.006 },
  fuerte: { hombros: 1.08, pecho: 1.09, prof: 1.12, cintura: 1.14, cadera: 1.06, musculo: 1.12, panza: 0.026 },
  atletico: { hombros: 1.1, pecho: 1.07, prof: 1.06, cintura: 0.95, cadera: 0.98, musculo: 1.16, panza: 0 },
}

const _m: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }

export class Cuerpo {
  readonly H: number
  readonly s: number
  readonly fem: boolean
  readonly k: Complexion
  readonly rasgos: Rasgos
  readonly cab: Cabeza
  readonly j = {} as Record<NombreHueso, THREE.Vector3>
  readonly brazos: [Cadena, Cadena]
  readonly piernas: [Cadena, Cadena]
  /** Holgura extra de la ropa (m) para separar brazos del cuerpo. */
  readonly holgura: number
  private filas: FilaCabeza[] | null = null

  constructor(p: Personaje, holguraRopa = 0) {
    const ap = p.apariencia
    this.H = clamp(ap.altura || 1.78, 1.5, 2.05)
    const Hh = this.H
    const s = (this.s = Hh / 1.78)
    this.rasgos = rasgosDe(p)
    this.fem = this.rasgos.fem
    const base = COMPLEXION[ap.complexion] ?? COMPLEXION.medio
    this.k = this.fem ? { ...base, hombros: base.hombros * 0.87, pecho: base.pecho * 0.9, cadera: base.cadera * 1.0, musculo: base.musculo * 0.86, cintura: base.cintura * 0.98 } : base
    this.holgura = holguraRopa
    const k = this.k
    const hs = Math.pow(s, 0.5) * (this.fem ? 0.94 : 1)
    const c = new THREE.Vector3(0, Hh - 0.123 * hs, 0.006 * s)
    this.cab = new Cabeza(c, hs, this.rasgos)
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const j = this.j
    j.cadera = V(0, 0.548 * Hh, -0.008 * s)
    j.columna = V(0, 0.615 * Hh, -0.03 * s)
    j.pecho = V(0, 0.705 * Hh, -0.035 * s)
    j.cuello = V(0, 0.826 * Hh, -0.04 * s)
    j.cabeza = this.cab.aAvatar(0, -0.04, -0.02, V(0, 0, 0))
    j.mandibula = this.cab.aAvatar(0, -0.012, 0.004, V(0, 0, 0))
    const o = this.cab.ojo
    j.ojoI = this.cab.aAvatar(o.x, o.y, o.z, V(0, 0, 0))
    j.ojoD = this.cab.aAvatar(-o.x, o.y, o.z, V(0, 0, 0))
    j.parpadoI = j.ojoI.clone()
    j.parpadoD = j.ojoD.clone()
    // Brazos: separados del cuerpo lo justo para no atravesar cintura y cadera (con la ropa).
    const anchoCintura = 0.149 * s * k.cintura * (this.fem ? 0.88 : 1) + k.panza * 0.4
    const anchoCadera = 0.17 * s * k.cadera * (this.fem ? 1.06 : 1)
    for (const [lado, L] of [[1, "I"], [-1, "D"]] as const) {
      const hx = 0.176 * s * k.hombros
      const hom = V(lado * hx, 0.805 * Hh, -0.028 * s)
      const rB = 0.037 * s * k.musculo
      const cx = Math.max(hx + 0.022 * s, anchoCintura + rB + 0.012 + holguraRopa * 1.6)
      const codo = V(lado * cx, hom.y - 0.33 * s, -0.04 * s)
      const mx = Math.max(cx + 0.006 * s, anchoCadera + 0.024 * s + holguraRopa * 1.4)
      const mano = V(lado * mx, codo.y - 0.256 * s, -0.016 * s)
      j[`clavicula${L}`] = V(lado * 0.024 * s, 0.814 * Hh, 0.01 * s)
      j[`hombro${L}`] = hom
      j[`codo${L}`] = codo
      j[`mano${L}`] = mano
      j[`dedos${L}`] = V(mano.x + lado * 0.002 * s, mano.y - 0.094 * s, mano.z + 0.002 * s)
      j[`dedos2${L}`] = V(mano.x + lado * 0.002 * s, mano.y - 0.132 * s, mano.z + 0.0)
      j[`pulgar${L}`] = V(mano.x - lado * 0.008 * s, mano.y - 0.024 * s, mano.z + 0.02 * s)
      const px = 0.087 * s * k.cadera * (this.fem ? 1.05 : 1)
      j[`muslo${L}`] = V(lado * px, 0.522 * Hh, 0.0)
      j[`rodilla${L}`] = V(lado * (px - 0.004 * s), 0.287 * Hh, 0.012 * s)
      j[`tobillo${L}`] = V(lado * (px - 0.002 * s), 0.047 * Hh, -0.022 * s)
      j[`punta${L}`] = V(lado * (px + 0.012 * s), 0.014 * Hh, 0.118 * s)
    }
    const cad = (L: "I" | "D", lado: 1 | -1) => {
      const hom = j[`hombro${L}`]
      return new Cadena([V(hom.x - lado * 0.004, hom.y + 0.03 * s, hom.z), hom, j[`codo${L}`], j[`mano${L}`], j[`dedos${L}`]], 1, lado)
    }
    this.brazos = [cad("I", 1), cad("D", -1)]
    const pie = (L: "I" | "D", lado: 1 | -1) => {
      const m = j[`muslo${L}`]
      const t = j[`tobillo${L}`]
      return new Cadena([V(m.x, m.y + 0.05 * s, m.z), m, j[`rodilla${L}`], t, V(t.x, t.y - 0.04 * s, t.z + 0.004)], 1, lado)
    }
    this.piernas = [pie("I", 1), pie("D", -1)]
  }

  /** Crea los huesos (en reposo, sin rotaciones) y el esqueleto. */
  esqueleto(): { huesos: THREE.Bone[]; esqueleto: THREE.Skeleton } {
    const huesos = HUESOS.map((n) => {
      const b = new THREE.Bone()
      b.name = n
      return b
    })
    HUESOS.forEach((n, i) => {
      const padre = PADRE[n]
      const b = huesos[i]
      if (padre) {
        huesos[H[padre]].add(b)
        b.position.subVectors(this.j[n], this.j[padre])
      } else b.position.copy(this.j[n])
    })
    huesos[0].updateMatrixWorld(true)
    return { huesos, esqueleto: new THREE.Skeleton(huesos) }
  }

  // ── Tronco ──────────────────────────────────────────────────

  /** Sección del tronco a la altura y: puntos (x, z) por columna, con músculos según `bultos`. */
  anilloTronco(y: number, bultos: number, xs: Float64Array, zs: Float64Array) {
    const Hh = this.H
    const s = this.s
    const t = y / Hh
    const T = this.fem ? TRONCO_M : TRONCO_H
    const k = this.k
    // Factor de ancho por zona: cadera abajo, cintura, pecho, hombros arriba.
    const fw =
      t < 0.56 ? k.cadera : t < 0.6 ? lerp(k.cadera, k.cintura, (t - 0.56) / 0.04) : t < 0.68 ? k.cintura : t < 0.72 ? lerp(k.cintura, k.pecho, (t - 0.68) / 0.04) : t < 0.775 ? k.pecho : lerp(k.pecho, k.hombros, clamp((t - 0.775) / 0.03, 0, 1))
    const fp = t < 0.68 ? lerp(1, k.prof, 0.5) : k.prof
    const w = tablaSuave(T, t, 1) * s * fw
    let zf = tablaSuave(T, t, 2) * s * fp
    const zb = tablaSuave(T, t, 3) * s * fp
    const zc = tablaSuave(T, t, 4) * s
    // Vientre
    zf += k.panza * campana(t, 0.618, 0.05) * s
    const pf = 2.25
    const pb = 2.7
    for (let j = 0; j < M; j++) {
      const a = ANG[j]
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const p = sa >= 0 ? pf : pb
      xs[j] = w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p)
      zs[j] = zc + (sa >= 0 ? zf - zc : zc - zb) * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p)
    }
    if (bultos <= 0) return
    // Músculos y relieves a lo largo de la normal de la sección.
    const nx = new Float64Array(M)
    const nz = new Float64Array(M)
    for (let j = 0; j < M; j++) {
      const a = (j - 1 + M) % M
      const b = (j + 1) % M
      const tx = xs[b] - xs[a]
      const tz = zs[b] - zs[a]
      const l = Math.hypot(tx, tz) || 1
      nx[j] = tz / l
      nz[j] = -tx / l
    }
    const mu = k.musculo
    for (let j = 0; j < M; j++) {
      const x = xs[j]
      const ax = Math.abs(x)
      const fr = zs[j] > zc ? 1 : 0
      let d = 0
      if (this.fem) {
        d += fr * 0.03 * s * campana(ax, 0.068 * s, 0.045 * s) * campana(y, 0.722 * Hh, 0.045 * s)
        d += (1 - fr) * 0.02 * s * campana(ax, 0.064 * s, 0.055 * s) * campana(y, 0.5 * Hh, 0.05 * s)
      } else {
        d += fr * 0.011 * s * mu * campana(ax, 0.066 * s, 0.045 * s) * campana(y, 0.738 * Hh, 0.04 * s)
        d -= fr * 0.003 * s * campana(ax, 0, 0.012 * s) * campana(y, 0.74 * Hh, 0.05 * s)
        d += (1 - fr) * 0.015 * s * campana(ax, 0.062 * s, 0.05 * s) * campana(y, 0.505 * Hh, 0.045 * s)
      }
      d += (1 - fr) * 0.008 * s * mu * campana(ax, 0.075 * s, 0.04 * s) * campana(y, 0.77 * Hh, 0.05 * s)
      d -= (1 - fr) * 0.005 * s * campana(ax, 0, 0.013 * s) * campana(y, 0.68 * Hh, 0.12 * s)
      d -= (1 - fr) * 0.012 * s * campana(ax, 0, 0.01 * s) * suave(0.53 * Hh, 0.5 * Hh, y)
      // Deltoides: los hombros son parte del tronco (el brazo nace debajo, sin unión visible).
      d += 0.046 * s * mu * this.k.hombros * suave(0.1 * s, 0.168 * s, ax) * campana(y, 0.788 * Hh, 0.026 * Hh) * (this.fem ? 0.72 : 1)
      // Clavículas
      d += fr * 0.004 * s * campana(y, 0.812 * Hh - ax * 0.05, 0.01 * s) * suave(0.015 * s, 0.04 * s, ax) * suave(0.16 * s, 0.12 * s, ax)
      xs[j] += nx[j] * d * bultos
      zs[j] += nz[j] * d * bultos
    }
  }

  /** Pesos del tronco para un punto (de la piel o de la ropa sobre ella). */
  pesosTronco(x: number, y: number, z: number): Pesos {
    const Hh = this.H
    const s = this.s
    const t = y / Hh
    const ax = Math.abs(x)
    const L = x >= 0 ? "I" : "D"
    const p: Pesos = []
    // Columna: cadera → columna → pecho → cuello
    const a = suave(0.575, 0.645, t)
    const b = suave(0.675, 0.735, t)
    const c = suave(0.812, 0.84, t)
    let wCad = 1 - a
    let wCol = a * (1 - b)
    let wPec = b * (1 - c)
    let wCue = c
    // Hombro: la parte de afuera de los hombros sigue a la clavícula y un poco al brazo.
    const hom = suave(0.1 * s, 0.165 * s, ax) * suave(0.735, 0.785, t) * (1 - c)
    const wCla = hom * 0.55
    const wHom = suave(0.15 * s, 0.19 * s, ax) * suave(0.755, 0.8, t) * 0.4
    // Glúteos e ingle: un poco de muslo.
    const ing = suave(0.54, 0.47, t) * suave(0.01 * s, 0.07 * s, ax)
    const wMus = ing * (z < 0 ? 0.55 : 0.4)
    const resto = 1 - wCla - wHom - wMus
    wCad *= resto
    wCol *= resto
    wPec *= resto
    wCue *= resto
    if (wCad > 0.001) p.push([H.cadera, wCad])
    if (wCol > 0.001) p.push([H.columna, wCol])
    if (wPec > 0.001) p.push([H.pecho, wPec])
    if (wCue > 0.001) p.push([H.cuello, wCue])
    if (wCla > 0.001) p.push([H[`clavicula${L}`], wCla])
    if (wHom > 0.001) p.push([H[`hombro${L}`], wHom])
    if (wMus > 0.001) p.push([H[`muslo${L}`], wMus])
    return p.length ? p : [[H.pecho, 1]]
  }

  /** Alturas de las filas del tronco (m). */
  filasTronco(): number[] {
    const fr = [0.448, 0.458, 0.468, 0.48, 0.495, 0.51, 0.525, 0.54, 0.555, 0.57, 0.585, 0.6, 0.615, 0.63, 0.645, 0.66, 0.675, 0.69, 0.705, 0.72, 0.735, 0.75, 0.763, 0.775, 0.787, 0.798, 0.808, 0.817, 0.825]
    return fr.map((f) => f * this.H)
  }

  // ── Cabeza y cuello ────────────────────────────────────────

  /** Filas de la cabeza, desde la base del cuello hasta la coronilla. */
  filasCabeza(): FilaCabeza[] {
    if (this.filas) return this.filas
    const cab = this.cab
    const radial: FilaCabeza[] = []
    const dir = new THREE.Vector3()
    const tPrev = new Float64Array(M).fill(0.2)
    for (let k = 0; k < ALFAS.length; k++) {
      const fila: FilaCabeza = { P: [], l: [], n: [], radial: true }
      for (let j = 0; j < M; j++) {
        const phi = ANG[j]
        const aMax = 139 + 1.2 * Math.sin(phi)
        const al = (ALFAS[k] * aMax) / 146 * (Math.PI / 180)
        dir.set(Math.sin(al) * Math.cos(phi), Math.cos(al), Math.sin(al) * Math.sin(phi))
        // Arranque cálido: un poco por fuera del anterior de la misma columna.
        let t0 = Math.min(0.2, tPrev[j] + 0.03)
        if (cab.sdf(dir.x * t0, dir.y * t0, dir.z * t0) <= 0) t0 = 0.2
        const t = cab.rayo(0, 0, 0, dir.x, dir.y, dir.z, t0)
        tPrev[j] = t
        const l = new THREE.Vector3(dir.x * t, dir.y * t, dir.z * t)
        fila.l.push(l)
        fila.n.push(cab.normal(l.x, l.y, l.z, new THREE.Vector3()))
        fila.P.push(cab.aAvatar(l.x, l.y, l.z, new THREE.Vector3()))
      }
      radial.push(fila)
    }
    // Cuello: rayos horizontales desde su eje, de la última fila radial a la base.
    const ult = radial[radial.length - 1]
    const yFin = clamp((0.836 * this.H - cab.c.y) / cab.hs, -0.21, -0.14)
    const k = cab.cuello
    const cuello: FilaCabeza[] = []
    for (let r = 1; r <= FILAS_CUELLO; r++) {
      const fila: FilaCabeza = { P: [], l: [], n: [], radial: false }
      const f = Math.pow(r / FILAS_CUELLO, 0.85)
      for (let j = 0; j < M; j++) {
        const phi = ANG[j]
        const y = lerp(ult.l[j].y, yFin, f)
        const zEje = lerp(k.z0, k.z1, clamp((y - k.y0) / (k.y1 - k.y0), 0, 1))
        const dx = Math.cos(phi)
        const dz = Math.sin(phi)
        const t = cab.rayo(0, y, zEje, dx, 0, dz, 0.13)
        const l = new THREE.Vector3(dx * t, y, zEje + dz * t)
        fila.l.push(l)
        fila.n.push(cab.normal(l.x, l.y, l.z, new THREE.Vector3()))
        fila.P.push(cab.aAvatar(l.x, l.y, l.z, new THREE.Vector3()))
      }
      cuello.push(fila)
    }
    this.filas = [...cuello.reverse(), ...radial.reverse()]
    return this.filas
  }

  /** Pesos de un punto de la cabeza o el cuello (coordenadas locales de la cabeza). */
  pesosCabeza(l: THREE.Vector3): Pesos {
    const y = l.y
    const cab = this.cab
    // Mandíbula: debajo de la boca y por delante del ángulo.
    const wM = suave(cab.yBoca + 0.0015, cab.yBoca - 0.007, y) * suave(-0.03, 0.012, l.z) * suave(-0.15, -0.115, y) * 0.9
    // Cuello: de la cabeza al cuello y al pecho, hacia la base.
    const a = suave(-0.055, -0.13, y)
    const b = suave(-0.13, -0.2, y)
    const p: Pesos = []
    const wCab = (1 - a) * (1 - wM)
    if (wCab > 0.001) p.push([H.cabeza, wCab])
    if (wM > 0.001) p.push([H.mandibula, wM * (1 - a)])
    if (a * (1 - b) > 0.001) p.push([H.cuello, a * (1 - b)])
    if (a * b > 0.001) p.push([H.pecho, a * b])
    return p
  }

  // ── Miembros ───────────────────────────────────────────────

  /** Punto de un anillo de brazo o pierna: radios [lateral, frente, medial, atrás] y ángulo. */
  static puntoAnillo(m: Marco, r: number[], a: number, p: number, out: THREE.Vector3): THREE.Vector3 {
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const x = (ca >= 0 ? r[0] : r[2]) * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p)
    const z = (sa >= 0 ? r[1] : r[3]) * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p)
    return out.copy(m.c).addScaledVector(m.L, x).addScaledVector(m.N, z)
  }

  /** Radios del brazo en u (m), escalados por altura y músculo. */
  radiosBrazo(u: number): number[] {
    const s = this.s
    const us = u / s
    const mu = this.k.musculo
    // La mano no engorda con el músculo.
    const f = us < 0.56 ? mu : lerp(mu, 1, clamp((us - 0.56) / 0.04, 0, 1))
    const g = this.fem ? 0.9 : 1
    return [1, 2, 3, 4].map((k) => tablaSuave(BRAZO, us, k) * s * f * g)
  }
  radiosPierna(u: number): number[] {
    const s = this.s
    const us = u / s
    const mu = this.k.musculo
    const g = this.fem ? 1.04 : 1
    const ca = us < 0.4 ? this.k.cadera : 1
    return [1, 2, 3, 4].map((k) => tablaSuave(PIERNA, us, k) * s * mu * g * (k === 1 && us < 0.25 ? ca : 1))
  }

  pesosBrazo(lado: 1 | -1, u: number): Pesos {
    const L = lado > 0 ? "I" : "D"
    const s = this.s
    const c = this.brazos[lado > 0 ? 0 : 1]
    const uCodo = c.u[2]
    const uMano = c.u[3]
    const p: Pesos = []
    const wCla = suave(0.04 * s, -0.02 * s, u) * 0.5
    const e = suave(uCodo - 0.03 * s, uCodo + 0.03 * s, u)
    const m = suave(uMano - 0.018 * s, uMano + 0.012 * s, u)
    const wHom = (1 - e) * (1 - wCla)
    const wCod = e * (1 - m)
    if (wCla > 0.001) p.push([H[`clavicula${L}`], wCla])
    if (wHom > 0.001) p.push([H[`hombro${L}`], wHom])
    if (wCod > 0.001) p.push([H[`codo${L}`], wCod])
    if (m > 0.001) p.push([H[`mano${L}`], m])
    return p
  }

  pesosPierna(lado: 1 | -1, u: number, frente: number): Pesos {
    const L = lado > 0 ? "I" : "D"
    const s = this.s
    const c = this.piernas[lado > 0 ? 0 : 1]
    const uRod = c.u[2]
    const uTob = c.u[3]
    const wCad = suave(0.07 * s, -0.04 * s, u) * (frente > 0 ? 0.35 : 0.5)
    const r = suave(uRod - 0.035 * s, uRod + 0.035 * s, u)
    const t = suave(uTob - 0.03 * s, uTob + 0.01 * s, u)
    const p: Pesos = []
    if (wCad > 0.001) p.push([H.cadera, wCad])
    const wMus = (1 - r) * (1 - wCad)
    if (wMus > 0.001) p.push([H[`muslo${L}`], wMus])
    if (r * (1 - t) > 0.001) p.push([H[`rodilla${L}`], r * (1 - t)])
    if (t > 0.001) p.push([H[`tobillo${L}`], t])
    return p
  }

  /** Punto y pesos del pie (sin zapato) en (s: m desde el talón, a: ángulo), con holgura. */
  puntoPie(lado: 1 | -1, sz: number, a: number, holg: number, out: THREE.Vector3): { pesos: Pesos; abajo: boolean } {
    const L = lado > 0 ? "I" : "D"
    const s = this.s
    const tob = this.j[`tobillo${L}`]
    const pun = this.j[`punta${L}`]
    const ss = sz / s
    const w = tablaSuave(PIE, ss, 1) * s * (this.fem ? 0.9 : 1) + holg
    const yb = tablaSuave(PIE, ss, 2) * s - (holg > 0 ? holg * 0.6 : 0)
    const yt = tablaSuave(PIE, ss, 3) * s + holg
    const yc = (yb + yt) / 2
    const hh = (yt - yb) / 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const pAbajo = 6
    const p = sa >= 0 ? 2.2 : pAbajo
    const x = w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p)
    const y = yc + hh * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p)
    // El pie apunta un poco hacia afuera.
    const z0 = tob.z - 0.062 * s
    const giro = lado * 0.1
    const zl = z0 + sz
    out.set(tob.x + lado * 0.004 * s + x * Math.cos(giro) + (zl - tob.z) * Math.sin(giro), Math.max(0, y), zl)
    const bola = suave(pun.z - 0.035 * s, pun.z + 0.01 * s, zl)
    const pesos: Pesos = [[H[`tobillo${L}`], 1 - bola]]
    if (bola > 0.001) pesos.push([H[`punta${L}`], bola])
    return { pesos, abajo: sa < -0.3 }
  }

  /** Largo del pie (m). */
  get largoPie(): number {
    return 0.268 * this.s
  }
}

// ── Malla de piel ─────────────────────────────────────────────

export interface Cobertura {
  /** ¿La ropa tapa la piel del tronco/cabeza en (y, columna j)? */
  tronco(y: number, j: number, cabeza: boolean): boolean
  /** ¿Tapa el brazo en u? */
  brazo(lado: 1 | -1, u: number): boolean
  pierna(lado: 1 | -1, u: number): boolean
  pie: boolean
  manos: boolean
}

const BLANCO: RGBA = [1, 1, 1, 1]

/** Construye la malla de piel: tronco + cuello + cabeza (una grilla), brazos, manos, piernas, pies, párpados y orejas. */
export function mallaPiel(cu: Cuerpo, cub: Cobertura, op: { sombraBarba: number; barbaDias: boolean }): { lote: Lote; ojos: Lote } {
  const lote = new Lote()
  const cab = cu.cab
  const s = cu.s
  const xs = new Float64Array(M)
  const zs = new Float64Array(M)

  // ── Tronco + cabeza: una sola grilla ──
  const ys = cu.filasTronco()
  const filasC = cu.filasCabeza()
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const cubiertos: boolean[][] = []
  const rug = (r: number): Mat2 => [r, 0]
  for (const y of ys) {
    cu.anilloTronco(y, 1, xs, zs)
    const fila: number[] = []
    const cf: boolean[] = []
    let v = 0
    for (let j = 0; j < M; j++) {
      const x = xs[j]
      const z = zs[j]
      // Codos, rodillas y pliegues: tono un poco más rojizo en el pecho alto (sol).
      const tono = 1 - 0.04 * campana(y, 0.47 * cu.H, 0.03)
      fila.push(lote.v(x, y, z, ANG[j] * 0.15, y, [tono, tono * 0.99, tono * 0.99, 1], cu.pesosTronco(x, y, z), rug(0.55)))
      cf.push(cub.tronco(y, j, false))
      v += z
    }
    ids.push(fila)
    cubiertos.push(cf)
    centros.push(new THREE.Vector3(0, y, v / M))
  }
  const tmp = new THREE.Vector3()
  for (const f of filasC) {
    const fila: number[] = []
    const cf: boolean[] = []
    for (let j = 0; j < M; j++) {
      const l = f.l[j]
      const P = f.P[j]
      const ao = cab.oclusion(l.x, l.y, l.z, f.n[j])
      const col = cab.tinte(l.x, l.y, l.z, ao, op.sombraBarba)
      // Rugosidad: labios y frente más brillantes.
      const ax = Math.abs(l.x)
      const lab = campana(ax, 0, 0.02) * campana(l.y, cab.yBoca, 0.011) * suave(0.085, 0.09, l.z)
      const zonaT = campana(ax, 0, 0.03) * suave(0.0, 0.05, l.y) * suave(0.06, 0.09, l.z) + campana(ax, 0, 0.012) * campana(l.y, cab.nariz.y, 0.02) * suave(0.09, 0.1, l.z)
      const r = 0.52 - 0.14 * lab - 0.08 * zonaT
      fila.push(lote.v(P.x, P.y, P.z, ANG[j] * 0.085, P.y, [col[0], col[1], col[2], 1], cu.pesosCabeza(l), rug(r)))
      cf.push(cub.tronco(P.y, j, true))
    }
    ids.push(fila)
    cubiertos.push(cf)
    centros.push(f.radial ? cab.c : tmp.set(0, f.P[0].y, cab.c.z - 0.03 * s).clone())
  }
  lote.tiras(ids, true, {
    centros,
    emitir: (i, j) => {
      const j2 = (j + 1) % M
      return !(cubiertos[i][j] && cubiertos[i][j2] && cubiertos[i + 1][j] && cubiertos[i + 1][j2])
    },
  })
  // Tapa de abajo (entre las piernas, casi nunca se ve).
  {
    const y0 = ys[0]
    const centro = lote.v(0, y0 - 0.005, -0.012 * s, 0, 0, BLANCO, [[H.cadera, 1]], rug(0.6))
    for (let j = 0; j < M; j++) lote.t(centro, ids[0][(j + 1) % M], ids[0][j])
  }
  lote.pieza()

  // ── Brazos y manos ──
  for (const c of cu.brazos) mallaBrazo(lote, cu, c, cub)
  // ── Piernas y pies ──
  for (const c of cu.piernas) mallaPierna(lote, cu, c, cub)
  if (!cub.pie) for (const lado of [1, -1] as const) mallaPie(lote, cu, lado, 0, [1, 1, 1, 1], [0.55, 0], true)

  // ── Párpados y orejas ──
  const ojos = new Lote()
  for (const lado of [1, -1] as const) {
    mallaParpado(lote, cu, lado)
    mallaOreja(lote, cu, lado)
    mallaGlobo(ojos, cu, lado)
  }
  void op
  return { lote, ojos }
}

/** Brazo + mano (palma con los cinco dedos). */
function mallaBrazo(lote: Lote, cu: Cuerpo, c: Cadena, cub: Cobertura) {
  const s = cu.s
  const lado = c.lado
  const uMano = c.u[3]
  const uFin = c.largo
  const cols = 20
  const filas: number[] = []
  for (let u = -0.02 * s; u < uFin - 0.001; ) {
    filas.push(u)
    const enMano = u > uMano - 0.02 * s
    u += (u < 0.03 * s ? 0.012 : enMano ? 0.016 : 0.028) * s
  }
  filas.push(uFin - 0.004 * s)
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const cubierto: boolean[] = []
  const P = new THREE.Vector3()
  for (const u of filas) {
    c.marco(u, _m)
    const r = cu.radiosBrazo(u)
    const fila: number[] = []
    const pesos = cu.pesosBrazo(lado, u)
    const nudillo = suave(uMano + 0.06 * s, uMano + 0.09 * s, u)
    for (let k = 0; k < cols; k++) {
      const a = (k / cols) * Math.PI * 2
      Cuerpo.puntoAnillo(_m, r, a, 2.2, P)
      // Dorso de la mano y nudillos apenas más rojizos.
      const t = 1 - 0.05 * nudillo * Math.max(0, Math.cos(a))
      const pw: Pesos = nudillo > 0.01 ? [...pesos.map(([h, w]) => [h, w * (1 - nudillo * 0.5)] as [number, number]), [H[`dedos${lado > 0 ? "I" : "D"}`], nudillo * 0.5]] : pesos
      fila.push(lote.v(P.x, P.y, P.z, (k / cols) * 0.2, u, [1, t, t, 1], pw, [0.55, 0]))
    }
    ids.push(fila)
    centros.push(_m.c.clone())
    cubierto.push(cub.brazo(lado, u))
  }
  lote.tiras(ids, true, { centros, emitir: (i) => !(cubierto[i] && cubierto[i + 1]) })
  lote.pieza()
  if (!cub.manos) mallaDedos(lote, cu, c)
}

/** Cuatro dedos y el pulgar como tubos que nacen de la palma. */
function mallaDedos(lote: Lote, cu: Cuerpo, c: Cadena) {
  const s = cu.s
  const lado = c.lado
  const L = lado > 0 ? "I" : "D"
  const uMano = c.u[3]
  c.marco(c.largo - 0.004 * s, _m)
  const base = _m.c.clone()
  const T = _m.T.clone()
  const N = _m.N.clone()
  const Lat = _m.L.clone()
  const g = cu.fem ? 0.9 : 1
  // [posición frente-atrás, largo, radio]
  const dedos: Array<[number, number, number]> = [
    [0.027, 0.075, 0.0091],
    [0.0085, 0.082, 0.0094],
    [-0.0095, 0.077, 0.0088],
    [-0.026, 0.061, 0.0078],
  ]
  const j2 = cu.j[`dedos2${L}`]
  const P = new THREE.Vector3()
  const m: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }
  for (const [f, largo, radio] of dedos) {
    const l = largo * s * g
    const r = radio * s * g
    const a0 = base.clone().addScaledVector(N, f * s * g).addScaledVector(T, -0.012 * s)
    // Dedos un poco convergentes.
    const dir = T.clone().addScaledVector(N, -f * 0.25).normalize()
    const filas = [0, 0.15, 0.35, 0.45, 0.55, 0.72, 0.8, 0.88, 0.95, 1]
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const cols = 8
    for (const t of filas) {
      m.c.copy(a0).addScaledVector(dir, t * (l + 0.012 * s))
      m.T.copy(dir)
      m.N.copy(N)
      m.L.copy(Lat)
      // Falanges: un poco más anchas en las articulaciones, la punta redonda.
      const nud = 1 + 0.08 * campana(t, 0.45, 0.06) + 0.06 * campana(t, 0.75, 0.05)
      const punta = t > 0.88 ? Math.sqrt(Math.max(0, 1 - ((t - 0.88) / 0.12) ** 2)) : 1
      const rr = r * (1 - 0.18 * t) * nud * punta + (t >= 1 ? 0.0004 : 0)
      const radios = [rr * 0.95, rr, rr * 0.95, rr]
      const fila: number[] = []
      // Peso: falange proximal → dedos; el resto → dedos2 (articulación promedio).
      const yRel = m.c.distanceTo(base)
      const d2 = base.distanceTo(j2)
      const w2 = suave(d2 - 0.006 * s, d2 + 0.006 * s, yRel)
      const pw: Pesos = [[H[`dedos${L}`], 1 - w2], [H[`dedos2${L}`], w2]]
      for (let k = 0; k < cols; k++) {
        const a = (k / cols) * Math.PI * 2
        Cuerpo.puntoAnillo(m, radios, a, 2.2, P)
        // Uñas: lado del dorso (lateral) de la última falange, claras y brillantes.
        const una = t > 0.76 && t < 0.97 && Math.cos(a) > 0.35 ? 1 : 0
        const col: RGBA = una ? [1.08, 0.98, 0.96, 1] : [1, 0.985, 0.98, 1]
        fila.push(lote.v(P.x, P.y, P.z, k / cols, t, col, pw, una ? [0.3, 0] : [0.55, 0]))
      }
      ids.push(fila)
      centros.push(m.c.clone())
    }
    lote.tiras(ids, true, { centros })
    // Cerrar la punta
    const ult = ids[ids.length - 1]
    const pc = m.c.clone().addScaledVector(dir, 0.0006)
    const tip = lote.v(pc.x, pc.y, pc.z, 0.5, 1, BLANCO, [[H[`dedos2${L}`], 1]], [0.55, 0])
    for (let k = 0; k < cols; k++) lote.t(tip, ult[k], ult[(k + 1) % cols])
    lote.pieza()
  }
  // Pulgar: de la base de la muñeca hacia adelante y abajo.
  {
    const cmc = cu.j[`pulgar${L}`]
    const dir = T.clone().multiplyScalar(0.82).addScaledVector(N, 0.5).addScaledVector(Lat, -0.15).normalize()
    const l = 0.085 * s * g
    const r = 0.0105 * s * g
    const filas = [0, 0.12, 0.3, 0.5, 0.62, 0.78, 0.88, 0.95, 1]
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const cols = 8
    const Np = Lat.clone().cross(dir).normalize().multiplyScalar(-lado)
    for (const t of filas) {
      m.c.copy(cmc).addScaledVector(dir, t * l)
      m.T.copy(dir)
      m.N.copy(Np)
      m.L.copy(Lat)
      const punta = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1
      const eminencia = 1 + 0.45 * suave(0.45, 0.0, t)
      const rr = r * (1 - 0.15 * t) * punta * eminencia + (t >= 1 ? 0.0004 : 0)
      const fila: number[] = []
      const pw: Pesos = t < 0.25 ? [[H[`mano${L}`], 1 - t * 2], [H[`pulgar${L}`], t * 2 + 0.5]] : [[H[`pulgar${L}`], 1]]
      for (let k = 0; k < cols; k++) {
        const a = (k / cols) * Math.PI * 2
        Cuerpo.puntoAnillo(m, [rr, rr * 0.9, rr, rr * 0.9], a, 2.2, P)
        const una = t > 0.72 && t < 0.96 && Math.sin(a) > 0.3 ? 1 : 0
        fila.push(lote.v(P.x, P.y, P.z, k / cols, t, una ? [1.08, 0.98, 0.96, 1] : BLANCO, pw, una ? [0.3, 0] : [0.55, 0]))
      }
      ids.push(fila)
      centros.push(m.c.clone())
    }
    lote.tiras(ids, true, { centros })
    const ult = ids[ids.length - 1]
    const pc = m.c.clone()
    const tip = lote.v(pc.x, pc.y, pc.z, 0.5, 1, BLANCO, [[H[`pulgar${L}`], 1]], [0.55, 0])
    for (let k = 0; k < cols; k++) lote.t(tip, ult[k], ult[(k + 1) % cols])
    lote.pieza()
  }
  void uMano
}

function mallaPierna(lote: Lote, cu: Cuerpo, c: Cadena, cub: Cobertura) {
  const s = cu.s
  const lado = c.lado
  const cols = 20
  const filas: number[] = []
  const uRod = c.u[2]
  for (let u = -0.05 * s; u < c.largo - 0.001; ) {
    filas.push(u)
    u += (Math.abs(u - uRod) < 0.06 * s ? 0.018 : u < 0 ? 0.02 : 0.034) * s
  }
  filas.push(c.largo)
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const cubierto: boolean[] = []
  const P = new THREE.Vector3()
  for (const u of filas) {
    c.marco(u, _m)
    const r = cu.radiosPierna(u)
    const fila: number[] = []
    const rodilla = campana(u, uRod, 0.04 * s)
    for (let k = 0; k < cols; k++) {
      const a = (k / cols) * Math.PI * 2
      Cuerpo.puntoAnillo(_m, r, a, 2.2, P)
      const t = 1 - 0.05 * rodilla * Math.max(0, Math.sin(a))
      fila.push(lote.v(P.x, P.y, P.z, (k / cols) * 0.3, u, [1, t, t, 1], cu.pesosPierna(lado, u, Math.sin(a)), [0.55, 0]))
    }
    ids.push(fila)
    centros.push(_m.c.clone())
    cubierto.push(cub.pierna(lado, u))
  }
  lote.tiras(ids, true, { centros, emitir: (i) => !(cubierto[i] && cubierto[i + 1]) })
  lote.pieza()
}

/** Pie (o zapato, con holgura): loft del talón a la punta. */
export function mallaPie(lote: Lote, cu: Cuerpo, lado: 1 | -1, holg: number, col: RGBA, mat: Mat2, dedos: boolean, colSuela?: RGBA, matSuela?: Mat2) {
  const s = cu.s
  const largo = cu.largoPie + holg * 1.6
  const filasZ: number[] = []
  const n = 13
  for (let i = 0; i <= n; i++) filasZ.push(-holg * 0.8 + (largo * i) / n)
  const cols = 16
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const P = new THREE.Vector3()
  for (const z of filasZ) {
    const fila: number[] = []
    let cy = 0
    let cz = 0
    let cx = 0
    for (let k = 0; k < cols; k++) {
      const a = (k / cols) * Math.PI * 2 - Math.PI / 2
      const zz = clamp(z, 0, cu.largoPie)
      const { pesos, abajo } = cu.puntoPie(lado, zz, a, holg, P)
      if (z < 0) P.z += z
      if (z > cu.largoPie) P.z += z - cu.largoPie
      // Dedos: relieve en la punta de arriba.
      if (dedos && zz > 0.2 * s && Math.sin(a) > 0.2) {
        const xr = Math.cos(a)
        P.y += 0.0025 * s * Math.abs(Math.sin(xr * 9)) * suave(0.2 * s, 0.235 * s, zz)
      }
      const suela = abajo && colSuela
      fila.push(lote.v(P.x, P.y, P.z, (k / cols) * 0.25, z, suela ? colSuela : col, pesos, suela && matSuela ? matSuela : mat))
      cx += P.x
      cy += P.y
      cz += P.z
    }
    ids.push(fila)
    centros.push(new THREE.Vector3(cx / cols, cy / cols, cz / cols))
  }
  lote.tiras(ids, true, { centros })
  // Tapas: talón y punta.
  for (const [i, sgn] of [[0, -1], [ids.length - 1, 1]] as const) {
    const c = centros[i]
    const pz = c.z + sgn * 0.002
    const L = lado > 0 ? "I" : "D"
    const cen = lote.v(c.x, c.y, pz, 0, 0, col, [[H[sgn < 0 ? `tobillo${L}` : `punta${L}`], 1]], mat)
    const f = ids[i]
    for (let k = 0; k < cols; k++) {
      if (sgn < 0) lote.t(cen, f[k], f[(k + 1) % cols])
      else lote.t(cen, f[(k + 1) % cols], f[k])
    }
  }
  lote.pieza()
}

/**
 * Párpados: una cáscara alrededor del globo con la abertura en forma de
 * almendra. El de arriba sigue a su hueso (parpadeo); el borde es más
 * grueso y oscuro (pestañas, línea del párpado).
 */
function mallaParpado(lote: Lote, cu: Cuerpo, lado: 1 | -1) {
  const cab = cu.cab
  const o = cab.ojo
  const L = lado > 0 ? "I" : "D"
  const cols = 40
  const lambdas = [1, 1.025, 1.08, 1.18, 1.32, 1.5]
  const ids: number[][] = []
  const P = new THREE.Vector3()
  const { U, Vu, Vl, incl } = cab.parpado
  for (let k = 0; k < lambdas.length; k++) {
    const lam = lambdas[k]
    const fila: number[] = []
    for (let i = 0; i < cols; i++) {
      const psi = (i / cols) * Math.PI * 2
      const cp = Math.cos(psi)
      const sp = Math.sin(psi)
      // Almendra: esquina de afuera (psi = 0) un poco más alta.
      // Almendra: esquina de afuera (psi = 0) un poco más alta; las filas de afuera la agrandan.
      const u = U * cp * lam
      const v = (sp >= 0 ? Vu * Math.pow(sp, 0.8) : -Vl * Math.pow(-sp, 0.95)) * lam + incl * cp * lam
      // Radio: el borde toca el globo, la segunda fila es el grosor del párpado, las
      // siguientes van apenas por encima del párpado de la cara y la última se hunde en ella.
      const sup = sp > 0 ? 1 : 0
      const R = [o.r + 0.00025, o.r + 0.0012 + 0.0004 * sup, o.r + 0.00145 + 0.0003 * sup, o.r + 0.0014, o.r + 0.00135, o.r + 0.0004][k]
      const ux = lado * u
      const dx = Math.sin(ux) * Math.cos(v)
      const dy = Math.sin(v)
      const dz = Math.cos(ux) * Math.cos(v)
      cab.aAvatar(lado * o.x + dx * R, o.y + dy * R, o.z + dz * R, P)
      // Borde oscuro (pestañas/línea) y lagrimal rosado.
      let col: RGBA = [0.96, 0.92, 0.92, 1]
      if (k <= 1) col = sup ? [0.42, 0.34, 0.33, 1] : [0.8, 0.66, 0.64, 1]
      if (k <= 1 && cp < -0.85) col = [0.95, 0.68, 0.66, 1]
      if (k === 2) col = sup ? [0.86, 0.8, 0.79, 1] : [0.94, 0.88, 0.87, 1]
      // Pesos: la mitad de arriba sigue al párpado cerca del borde.
      const wp = sup * suave(-0.05, 0.25, sp) * (1 - suave(1.2, 1.5, lam))
      const pw: Pesos = [[H.cabeza, 1 - wp]]
      if (wp > 0.001) pw.push([H[`parpado${L}`], wp])
      fila.push(lote.v(P.x, P.y, P.z, i / cols, k * 0.1, col, pw, [k <= 1 ? 0.35 : 0.5, 0]))
    }
    ids.push(fila)
  }
  // La cara de afuera mira lejos del centro del ojo.
  const centro = cab.aAvatar(lado * o.x, o.y, o.z, new THREE.Vector3())
  lote.tiras(ids, true, { centros: ids.map(() => centro) })
  lote.pieza()
}

/** Globo ocular: esfera con el polo al frente y la córnea abombada. */
function mallaGlobo(lote: Lote, cu: Cuerpo, lado: 1 | -1) {
  const cab = cu.cab
  const o = cab.ojo
  const L = lado > 0 ? "I" : "D"
  const cols = 24
  const filas = 14
  const ids: number[][] = []
  const P = new THREE.Vector3()
  for (let i = 0; i <= filas; i++) {
    const ang = (i / filas) * Math.PI
    const fila: number[] = []
    for (let k = 0; k <= cols; k++) {
      const az = (k / cols) * Math.PI * 2
      // Córnea: abombada sobre el iris.
      const R = o.r + 0.0007 * Math.max(0, Math.cos(ang * 1.8)) * (ang < 0.9 ? 1 : 0)
      const dx = Math.sin(ang) * Math.cos(az)
      const dy = Math.sin(ang) * Math.sin(az)
      const dz = Math.cos(ang)
      cab.aAvatar(lado * o.x + dx * R, o.y + dy * R, o.z + dz * R, P)
      fila.push(lote.v(P.x, P.y, P.z, k / cols, 1 - ang / Math.PI, BLANCO, [[H[`ojo${L}`], 1]], [0.3, 0]))
    }
    ids.push(fila)
  }
  const centro = cab.aAvatar(lado * o.x, o.y, o.z, new THREE.Vector3())
  lote.tiras(ids, false, { centros: ids.map(() => centro) })
  lote.pieza()
}

/** Oreja: lámina con borde enrollado (hélix), antehélix y concha. */
function mallaOreja(lote: Lote, cu: Cuerpo, lado: 1 | -1) {
  const cab = cu.cab
  const hs = cab.hs
  const tam = cab.r.oreja
  const alto = 0.06 * tam
  const ancho = 0.033 * tam
  // Centro y orientación (local de la cabeza).
  const centro = new THREE.Vector3(lado * 0.0795 * cab.r.ancho, 0.004, -0.01)
  const giroY = lado * 0.42 // la cara de la oreja mira un poco al frente
  const n = new THREE.Vector3(lado * Math.cos(giroY), 0, Math.sin(Math.abs(giroY)) * 0.55).normalize()
  const arriba = new THREE.Vector3(0, 1, 0.22).normalize()
  const atras = new THREE.Vector3().crossVectors(arriba, n).normalize()
  if (atras.z > 0) atras.negate()
  const cols = 26
  const ts = [0, 0.1, 0.22, 0.38, 0.55, 0.72, 0.88, 1]
  const P = new THREE.Vector3()
  const caras: number[][][] = [[], []]
  for (const cara of [0, 1]) {
    for (const t of ts) {
      const fila: number[] = []
      for (let i = 0; i < cols; i++) {
        const g = (i / cols) * Math.PI * 2
        // Contorno: arriba ancho y redondo, abajo el lóbulo más angosto; el frente recto.
        const cg = Math.cos(g)
        const sg = Math.sin(g)
        let a = ancho * 0.5 * cg * (cg < 0 ? 0.55 : 1) * (sg < 0 ? 0.78 + 0.22 * (1 + sg) : 1)
        let b = alto * 0.5 * sg
        a *= 1 - t
        b *= 1 - t * 0.92
        b -= t * alto * 0.06
        // Relieve (hacia afuera de la oreja): hélix, escafa, antehélix y concha.
        let d: number
        if (cara === 0) {
          const helix = campana(t, 0.09, 0.07) * 0.0042 * (cg < -0.3 && sg < 0.3 ? 0.4 : 1)
          const anti = campana(t, 0.42, 0.1) * 0.0028
          const concha = -suave(0.5, 0.8, t) * 0.004
          d = 0.002 + helix + anti + concha
        } else d = -0.0028 - t * 0.003
        P.copy(centro).addScaledVector(atras, a).addScaledVector(arriba, b).addScaledVector(n, d)
        cab.aAvatar(P.x, P.y, P.z, P)
        const sombra = cara === 0 ? 1 - 0.35 * suave(0.55, 0.9, t) : 0.9
        fila.push(lote.v(P.x, P.y, P.z, i / cols, t, [1.04 * sombra, 0.93 * sombra, 0.92 * sombra, 1], [[H.cabeza, 1]], [0.5, 0]))
      }
      caras[cara].push(fila)
    }
  }
  void hs
  // Cara de adelante (mira según n) y de atrás (al revés); unidas por el borde (t = 0).
  const c0 = cab.aAvatar(centro.x, centro.y, centro.z, new THREE.Vector3())
  const cAfuera = c0.clone().addScaledVector(cab.aAvatar(n.x, n.y, n.z, new THREE.Vector3()).sub(cab.c), 1)
  lote.tiras(caras[0], true, { invertir: false, centros: caras[0].map(() => c0.clone().sub(cAfuera.clone().sub(c0).multiplyScalar(4))) })
  lote.tiras(caras[1], true, { centros: caras[1].map(() => cAfuera.clone().add(cAfuera.clone().sub(c0).multiplyScalar(4))) })
  // Canto del borde: une las dos caras.
  lote.tiras([caras[0][0], caras[1][0]], true, { centros: [c0, c0] })
  lote.pieza()
}

export { _m as _marcoTmp }
