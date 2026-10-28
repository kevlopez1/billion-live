// ──────────────────────────────────────────────────────────────
// La cabeza, esculpida con código.
//
// La forma es un campo de distancia (SDF): cráneo, frente, pómulos,
// mejillas (llenas o hundidas), papada y carrillos, mandíbula con su ángulo,
// mentón (cuadrado, partido, adelantado), arco de las cejas, cuencas y
// párpados (encapotados, bolsas), nariz (dorso, giba, punta, aletas,
// respingada o chata), labios por separado con comisuras, y el cuello. Todo
// unido con mezclas suaves (smin). La malla sale de lanzar rayos desde el
// centro de la cabeza (cara y cráneo) y en horizontal desde el eje del cuello,
// con las mismas columnas que el torso: cabeza, cuello y cuerpo son UNA malla.
//
// Cada medida sale de la ficha del personaje (avatar-fichas.ts): un parecido
// de videojuego por forma, edad y proporción, nunca un retrato.
//
// Coordenadas locales de la cabeza: metros para una cabeza de 23,5 cm, con el
// origen entre los oídos; +x = izquierda del personaje, +y arriba, +z al frente.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Personaje } from "../tipos"
import { campana, clamp, lerp, suave } from "./avatar-geo"
import { resolverFicha, type BarbaR, type FichaR, type PeloR } from "./avatar-fichas"

export interface Rasgos {
  /** La ficha resuelta (todo lo demás sale de aquí). */
  f: FichaR
  fem: boolean
  /** 0 = joven, 1 = anciano (canas, arrugas, entradas). */
  edad: number
  grasa: number
  ancho: number
  largo: number
  oreja: number
  iris: string
}

/** Rasgos de la cabeza a partir de la ficha (o de la Apariencia, si no hay ficha). */
export function rasgosDe(p: Personaje): Rasgos {
  const f = resolverFicha(p)
  return {
    f,
    fem: f.fem,
    edad: f.edad,
    grasa: clamp(0.3 + f.cara.mejillas * 0.6 + f.cara.papada * 0.4, 0, 1),
    ancho: f.cara.ancho,
    largo: f.cara.largo,
    oreja: f.cara.orejas.tam,
    iris: f.iris,
  }
}

// ── Primitivas de distancia ───────────────────────────────────

function elip(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  const x = (px - cx) / rx
  const y = (py - cy) / ry
  const z = (pz - cz) / rz
  const k0 = Math.sqrt(x * x + y * y + z * z)
  const x1 = x / rx
  const y1 = y / ry
  const z1 = z / rz
  const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1)
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz)
}
function esf(px: number, py: number, pz: number, cx: number, cy: number, cz: number, r: number): number {
  const x = px - cx
  const y = py - cy
  const z = pz - cz
  return Math.sqrt(x * x + y * y + z * z) - r
}
/** Cono redondeado entre a (radio r1) y b (radio r2). */
function cono(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number): number {
  const bax = bx - ax
  const bay = by - ay
  const baz = bz - az
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const pax = px - ax
  const pay = py - ay
  const paz = pz - az
  const y = pax * bax + pay * bay + paz * baz
  const z = y - l2
  const qx = pax * l2 - bax * y
  const qy = pay * l2 - bay * y
  const qz = paz * l2 - baz * y
  const x2 = qx * qx + qy * qy + qz * qz
  const y2 = y * y * l2
  const z2 = z * z * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
}
/** ¿El grupo (dentro de una esfera c, r) está tan lejos que no cambia d? Así se salta sin error. */
function lejos(px: number, py: number, pz: number, cx: number, cy: number, cz: number, r: number, d: number, k: number): boolean {
  const x = px - cx
  const y = py - cy
  const z = pz - cz
  return Math.sqrt(x * x + y * y + z * z) - r > Math.abs(d) + k
}
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k)
}

/** Ojo en coordenadas locales: centro y radio del globo. */
export interface OjoGeo {
  x: number
  y: number
  z: number
  r: number
}

const SOMBRA_ZONAS: BarbaR = { color: "#000", canas: 0, densidad: 0.3, largo: 0.001, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.7, cuello: 0.5, anchoPerilla: 1, colgante: 0, anchoColgante: 0, partida: 0, bigoteCaido: 0, rizo: 0, borde: 0.6 }
const lin = (hex: string) => new THREE.Color(hex)

export class Cabeza {
  readonly c: THREE.Vector3
  readonly hs: number
  readonly r: Rasgos
  readonly f: FichaR
  readonly ojo: OjoGeo
  /** Abertura de los párpados (radianes en la esfera del ojo): medio ancho, alto arriba/abajo, inclinación. */
  readonly parpado: { U: number; Vu: number; Vl: number; incl: number }
  /** Línea de la boca (y local), medio ancho de la boca y punta de la nariz. */
  readonly yBoca: number
  readonly anchoBoca: number
  readonly nariz: { y: number; z: number }
  readonly yMenton: number
  /** Eje del cuello: de (0, y0, z0) a (0, y1, z1). */
  readonly cuello: { y0: number; z0: number; y1: number; z1: number; r0: number; r1: number }
  // Medidas para la función de distancia (campos fijos: rápido, sin objetos).
  private readonly W: number
  private readonly L: number
  private readonly Fr: number
  private readonly J: number
  private readonly JK: number
  private readonly Mn: number
  private readonly MA: number
  private readonly MC: number
  private readonly Pm: number
  private readonly Mj: number
  private readonly Pa: number
  private readonly B: number
  private readonly NA: number
  private readonly NB: number
  private readonly NH: number
  private readonly NG: number
  private readonly NC: number
  private readonly LW: number
  private readonly LU: number
  private readonly LD: number
  private readonly LA: number
  private readonly LC: number
  private readonly E: number
  private readonly Fm: number
  private readonly NK: number
  private readonly hood: number
  private readonly bolsas: number
  private readonly pliegue: boolean
  /** Colores de la piel por zona, como factores sobre el tono base (lineal). */
  private readonly zonas: { ojos: [number, number, number, number] | null; rubor: [number, number, number, number] | null; labios: [number, number, number] | null; sombra: [number, number, number, number] | null }
  /** Factores del pelo, la barba y las cejas sobre la piel (se calculan una vez). */
  private readonly fPelo: [number, number, number]
  private readonly fBarba: [number, number, number] | null
  private readonly fCeja: [number, number, number]
  /** Zonas de la sombra de afeitado. */
  readonly zonasSombra: BarbaR

  constructor(c: THREE.Vector3, hs: number, r: Rasgos) {
    this.c = c
    this.hs = hs
    this.r = r
    const f = (this.f = r.f)
    const cara = f.cara
    const W = (this.W = cara.ancho)
    const L = (this.L = cara.largo)
    this.Fr = cara.frente * 0.01
    this.J = cara.mandibula
    this.JK = lerp(0.036, 0.014, clamp(cara.anguloMandibula, 0, 1))
    this.Mn = cara.menton
    this.MA = cara.mentonAvance * 0.01
    this.MC = clamp(cara.mentonCuadrado, 0, 1)
    this.Pm = cara.pomulos
    this.Mj = clamp(cara.mejillas, -1, 1)
    this.Pa = clamp(cara.papada, 0, 1)
    this.B = cara.arcoCejas
    const n = cara.nariz
    this.NA = n.ancho
    this.NB = n.punta
    this.NH = clamp(n.puente, 0, 1)
    this.NG = clamp(n.gancho, 0, 1)
    this.NC = clamp(n.chata, 0, 1)
    const lb = cara.labios
    this.LW = lb.ancho
    this.LU = lb.superior
    this.LD = lb.inferior
    this.LA = clamp(lb.avanceInferior, 0, 1)
    this.LC = clamp(lb.comisuras, -1, 1)
    this.E = f.edad
    this.Fm = f.fem ? 1 : 0
    this.NK = f.cuerpo.cuelloGrosor
    const o = cara.ojos
    // Globo de 13,4 mm de radio (el real es de 12): con el ojo apenas más grande y la
    // abertura más ancha, el ojo se lee como ojo y no como un punto.
    this.ojo = { x: 0.032 * o.sep * W, y: 0.012, z: 0.0702 - 0.004 * o.hundidos, r: 0.0134 * o.tam }
    this.hood = clamp(o.parpado, 0, 1)
    this.bolsas = clamp(o.bolsas, 0, 1)
    this.pliegue = !o.monoparpado
    this.parpado = { U: 1.28, Vu: 0.42 * o.abierto * (1 - 0.22 * this.hood), Vl: 0.33 * Math.sqrt(Math.max(0.3, o.abierto)), incl: o.incl }
    this.yBoca = -0.06 * L
    this.anchoBoca = 0.024 * this.LW
    const nl = n.largo
    this.nariz = {
      y: -0.026 * L * nl - 0.004 * this.NG + 0.004 * clamp(n.respingada, 0, 1),
      z: 0.1145 + 0.008 * (n.proy - 1) - 0.004 * this.NC + 0.0015 * clamp(n.respingada, 0, 1),
    }
    this.yMenton = -0.108 * L
    const nk = this.NK
    this.cuello = { y0: -0.035, z0: -0.022, y1: -0.21, z1: -0.042, r0: 0.054 * nk, r1: 0.064 * nk }
    // Zonas de color de la piel (factores sobre el color base del material).
    const base = lin(f.piel.base)
    const fac = (hex: string): [number, number, number] => {
      const k = lin(hex)
      return [k.r / Math.max(0.004, base.r), k.g / Math.max(0.004, base.g), k.b / Math.max(0.004, base.b)]
    }
    this.zonas = {
      ojos: f.piel.ojos ? [...fac(f.piel.ojos[0]), f.piel.ojos[1]] : null,
      rubor: f.piel.rubor ? [...fac(f.piel.rubor[0]), f.piel.rubor[1]] : null,
      labios: f.piel.labios ? fac(f.piel.labios) : null,
      sombra: f.piel.sombraOjos ? [...fac(f.piel.sombraOjos[0]), f.piel.sombraOjos[1]] : null,
    }
    this.fPelo = fac(f.pelo.color)
    this.fBarba = f.barba ? fac(f.barba.color) : null
    this.fCeja = fac(f.cejas.color)
    const b = f.barba
    this.zonasSombra = b ? { ...b, mejillas: Math.max(b.mejillas, 0.7), bigote: 1, perilla: 1, mandibula: 1, cuello: 0.5 } : SOMBRA_ZONAS
  }

  /** Distancia firmada a la superficie de la piel (coordenadas locales). */
  sdf(x: number, y: number, z: number): number {
    const W = this.W, L = this.L, J = this.J, Mn = this.Mn, Pm = this.Pm, Mj = this.Mj, Pa = this.Pa, B = this.B
    const NA = this.NA, NB = this.NB, LW = this.LW, E = this.E, F = this.Fm, NK = this.NK
    const ax = Math.abs(x)
    const o = this.ojo
    const lleno = Math.max(0, Mj)
    // Cráneo y frente (medidas desde el centro entre los oídos: frente ~10 cm, nuca ~10 cm)
    // (el cráneo, lo más ancho de la cabeza por encima de las orejas: con 7,6 cm los
    // pómulos sobresalían y la cabeza se leía como una pera, angosta arriba)
    let d = elip(x, y, z, 0, 0.026 + this.Fr * 0.3, -0.006, 0.079 * W, 0.099 + this.Fr * 0.3, 0.096)
    d = smin(d, elip(x, y, z, 0, 0.036 + this.Fr * 0.5, 0.034, 0.064 * W, 0.066 + this.Fr * 0.6, 0.066), 0.022)
    // Base de la cara: cráneo ensanchado hacia los pómulos (sin borde de "máscara").
    d = smin(d, elip(x, y, z, 0, -0.012, 0.012, 0.07 * W, 0.07, 0.085), 0.03)
    // Maxilar (media cara) y mejillas
    d = smin(d, elip(x, y, z, 0, -0.03 * L, 0.052, (0.056 + 0.006 * lleno) * W, 0.046 * L, 0.051), 0.026)
    if (!lejos(ax, y, z, 0.05, -0.03, 0.05, 0.065, d, 0.026)) {
      d = smin(d, elip(ax, y, z, 0.049 * W, -0.005 + 0.003 * (Pm - 1), 0.063, 0.021 * Pm, 0.014, 0.021), 0.02)
      // Arco cigomático: del pómulo a la oreja
      d = smin(d, cono(ax, y, z, 0.05 * W, -0.004, 0.06, 0.064 * W, 0.0, 0.012, 0.009, 0.006), 0.02)
      // Carrillos: más con grasa, caen con la papada.
      // (la grasa ensancha y baja el carrillo entero, no una bola junto a la boca)
      // (más adentro que antes: con el carrillo tan afuera como el pómulo la cara
      // era un rectángulo; la cara real es un huevo, angosta abajo)
      d = smin(d, elip(ax, y, z, (0.036 + 0.007 * lleno) * W, -0.038 * L - 0.008 * lleno - 0.004 * Pa, 0.066 - 0.006 * lleno, 0.021 + 0.009 * lleno, 0.024 + 0.007 * lleno, 0.026 + 0.003 * lleno), 0.024 + 0.012 * lleno)
      // Mejillas hundidas bajo el pómulo.
      // (el elipsoide está fuera de la piel: solo hunde unos mm, -6 mm con mejillas = -1)
      // (mezcla ancha: con 1 cm el borde del hueco se veía como un pliegue o una cicatriz)
      // Se empuja la superficie hacia adentro con una campana suave (hasta ~5 mm):
      // un hueco tallado con otro volumen dejaba un escalón que se veía como cicatriz.
      if (Mj < -0.05) {
        const gx = (ax - 0.05 * W) / 0.02
        const gy = (y + 0.045 * L) / 0.024
        d += -Mj * 0.0052 * Math.exp(-gx * gx - gy * gy) * suave(0.03, 0.07, z)
      }
      // Carrillos caídos (papada lateral) junto al mentón.
      if (Pa > 0.05) d = smin(d, elip(ax, y, z, 0.047 * W, -0.092 * L - 0.004 * Pa, 0.048, 0.014 + 0.006 * Pa, 0.012 + 0.006 * Pa, 0.02), 0.028)
    }
    if (!lejos(x, y, z, 0, -0.08, 0.04, 0.09, d, 0.034)) {
      // Mandíbula: de cada ángulo al mentón. Ángulo marcado = mezcla corta.
      const k = this.JK
      const sq = this.MC
      d = smin(d, cono(ax, y, z, 0.05 * J * W, -0.058 * L - 0.006 * sq, 0.004, 0.019 * Mn * (1 + 0.45 * sq), -0.095 * L, 0.084 + this.MA, 0.0145 + 0.004 * lleno, 0.0145), k)
      d = smin(d, elip(x, y, z, 0, -0.064 * L, 0.046, 0.05 * J, 0.033 * L, 0.052), 0.026)
      // Mentón: tamaño, avance y forma cuadrada.
      d = smin(d, elip(x, y, z, 0, -0.092 * L, 0.089 + 0.005 * (Mn - 1) + this.MA, 0.021 * Mn * (1.1 - F * 0.15) * (1 + 0.4 * sq), 0.0165, 0.0165), 0.012)
      // Papada: bajo la mandíbula, hacia el cuello.
      if (Pa > 0.05) d = smin(d, elip(x, y, z, 0, -0.116 * L - 0.004 * Pa, 0.036, 0.036 * W * (0.8 + 0.3 * Pa), 0.014 + 0.011 * Pa, 0.03 + 0.012 * Pa), 0.03)
    }
    // Arco de las cejas
    if (!lejos(ax, y, z, 0.028, 0.031, 0.085, 0.04, d, 0.012)) d = smin(d, cono(ax, y, z, 0.045 * W, 0.03, 0.077, 0.008, 0.033, 0.0935, 0.0095 * B, 0.0105 * B), 0.012)
    // Ojos: cuenca, párpados (una esfera apenas mayor que el globo, fundida con la cara)
    // y la abertura en almendra. El borde fino del párpado es una malla aparte (mallaParpado).
    const ko = o.r / 0.0118
    if (!lejos(ax, y, z, o.x + 0.002, o.y, o.z + 0.01, 0.034, d, 0.008)) {
      d = smax(d, -elip(ax, y, z, o.x + 0.002, o.y + 0.0008, o.z + 0.016, 0.0185 * ko, 0.0098 * ko, 0.0125), 0.006)
      const ex = ax - o.x
      const ey = y - o.y
      const ez = z - o.z
      const rr = Math.sqrt(ex * ex + ey * ey + ez * ez)
      d = smin(d, rr - (o.r + 0.0011), 0.0035)
      // Párpado encapotado: el pliegue de arriba cae sobre el párpado.
      if (this.hood > 0.05) d = smin(d, elip(ax, y, z, o.x + 0.002, o.y + 0.0104 * ko - 0.0016 * this.hood, o.z + 0.0058, 0.0165 * ko, 0.0032 + 0.0026 * this.hood, 0.0078), 0.0045)
      // Pliegue del párpado superior (no lo hay con monopárpado).
      if (this.pliegue && ey > 0.002 && ez > 0) d = smax(d, -(Math.abs(rr - (o.r + 0.0052 + 0.0012 * this.hood)) - 0.0005), 0.0016)
      if (rr < o.r + 0.008) {
        const pa = this.parpado
        const u = Math.atan2(ex, ez)
        const v = Math.atan2(ey, Math.sqrt(ex * ex + ez * ez)) - pa.incl * (u / pa.U)
        const vm = v > 0 ? pa.Vu : pa.Vl
        const lam = Math.sqrt((u / pa.U) ** 2 + (v / vm) ** 2)
        const abertura = Math.max((lam - 1.08) * rr * 0.3, rr - (o.r + 0.0035))
        d = smax(d, -abertura, 0.0008)
      }
      // Bolsas bajo los ojos.
      if (this.bolsas > 0.05) d = smin(d, elip(ax, y, z, o.x + 0.001, o.y - 0.0138 * ko, o.z + 0.006, 0.012 * ko, 0.0028 + 0.0014 * this.bolsas, 0.0045 + 0.0012 * this.bolsas), 0.004)
    }
    // Sien (más hundida con la edad)
    if (!lejos(ax, y, z, 0.072 * W, 0.03, 0.05, 0.021, d, 0.012)) d = smax(d, -elip(ax, y, z, 0.072 * W, 0.03, 0.05, 0.012 + 0.003 * E, 0.02, 0.02), 0.012)
    // Nariz: dorso (alto, con giba o chato), punta y aletas
    const nty = this.nariz.y
    const ntz = this.nariz.z
    if (!lejos(x, y, z, 0, -0.012, 0.1, 0.048, d, 0.01)) {
      const NC = this.NC
      d = smin(d, cono(x, y, z, 0, 0.013, 0.0925 - 0.007 * NC, 0, nty + 0.004, ntz - 0.0035, 0.0056 * NA * (1 + 0.35 * NC), 0.0084 * NA * (1 + 0.15 * NC)), 0.008)
      if (this.NH > 0.15) d = smin(d, esf(x, y, z, 0, -0.002, 0.0985 + 0.0065 * this.NH, 0.0048 * NA), 0.006)
      // Giba aguileña
      if (this.NG > 0.05) d = smin(d, esf(x, y, z, 0, nty + 0.017, lerp(0.104, ntz - 0.006, 0.4) + 0.0035 * this.NG, 0.0042 * NA), 0.006)
      d = smin(d, esf(x, y, z, 0, nty, ntz, 0.0102 * NB), 0.0065)
      d = smin(d, esf(ax, y, z, 0.0136 * NA, nty - 0.0085, ntz - 0.0155, 0.0077 * NA), 0.0065)
      d = smin(d, elip(x, y, z, 0, nty - 0.0115 - 0.002 * this.NG, ntz - 0.0125, 0.0092 * NA, 0.0044, 0.0078), 0.005)
    }
    // Labios con volumen, comisuras y la línea de la boca
    const yb = this.yBoca
    if (!lejos(x, y, z, 0, yb, 0.09, 0.048, d, 0.008)) {
      // Comisuras: la línea de los labios se curva arriba (sonrisa) o abajo.
      const kx = x / (0.025 * LW)
      const yl = y - this.LC * 0.0035 * kx * kx
      d = smin(d, elip(x, yl, z, 0, yb + 0.0066, 0.0985, 0.0228 * LW, 0.0062 * this.LU, 0.0082 * this.LU), 0.006)
      d = smin(d, elip(x, yl, z, 0, yb - 0.0068, 0.096 + 0.004 * this.LA, 0.0198 * LW, 0.0071 * this.LD, (0.0086 + 0.002 * this.LA) * this.LD), 0.006)
      d = smax(d, -elip(x, yl, z, 0, yb, 0.107, 0.025 * LW, 0.0008, 0.011), 0.0015)
      // Filtrum: el surco entre la nariz y el labio superior.
      d = smax(d, -cono(x, y, z, 0, nty - 0.014, ntz - 0.008, 0, yb + 0.011, 0.1035, 0.0018, 0.0022), 0.003)
      // Surco bajo el labio inferior
      d = smax(d, -cono(x, y, z, -0.012, yb - 0.0175, 0.1015 + 0.003 * this.LA, 0.012, yb - 0.0175, 0.1015 + 0.003 * this.LA, 0.0035, 0.0035), 0.005)
      // Surco nasolabial (más marcado con la edad y los carrillos llenos)
      const sn = E + 0.5 * Pa
      d = smax(d, -cono(ax, y, z, 0.019 * NA, nty - 0.008, ntz - 0.021, 0.027 * LW, yb - 0.004 - 0.004 * Pa, 0.094, 0.0016 + 0.0014 * sn, 0.0012), 0.004 + 0.003 * sn)
    }
    // Cuello y nuez
    const k = this.cuello
    // (mezcla corta: con 3 cm el cuello rellenaba el ángulo bajo la mandíbula y la
    // cara se fundía con el cuello sin borde: de frente, todas eran un rectángulo)
    d = smin(d, cono(x, y, z, 0, k.y0, k.z0, 0, k.y1, k.z1, k.r0, k.r1), 0.016)
    // Esternocleidomastoideos: la "V" del cuello, de detrás de la oreja al esternón.
    if (!lejos(ax, y, z, 0.03, -0.1, 0.0, 0.09, d, 0.02)) d = smin(d, cono(ax, y, z, 0.05 * W, -0.025, -0.022, 0.014, -0.19, 0.028, 0.0115 * NK, 0.0105 * NK), 0.022)
    if (F < 0.5 && !lejos(x, y, z, 0, -0.132, 0.03, 0.02, d, 0.01)) d = smin(d, elip(x, y, z, 0, -0.132, k.z0 + k.r0 * 0.78, 0.0065, 0.011, 0.006), 0.01)
    return d
  }

  /** Normal (gradiente) en un punto local. */
  normal(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const e = 0.0004
    // Tetraedro: 4 evaluaciones.
    const a = this.sdf(x + e, y - e, z - e)
    const b = this.sdf(x - e, y - e, z + e)
    const c = this.sdf(x - e, y + e, z - e)
    const d = this.sdf(x + e, y + e, z + e)
    out.set(a - b - c + d, -a - b + c + d, -a + b - c + d)
    const l = out.length()
    return l > 1e-12 ? out.multiplyScalar(1 / l) : out.set(0, 1, 0)
  }

  /** Oclusión ambiental aproximada (0 = ocluido, 1 = libre) a partir del campo. */
  oclusion(x: number, y: number, z: number, n: THREE.Vector3): number {
    // Tres distancias (4, 9 y 16 mm): las cuencas, las aletas de la nariz, la
    // comisura y el surco bajo el labio se oscurecen como en una foto; con
    // una sola distancia corta la cara quedaba plana bajo el cielo.
    let o = 0
    o += 1.0 * Math.max(0, 0.004 - this.sdf(x + n.x * 0.004, y + n.y * 0.004, z + n.z * 0.004)) / 0.004
    o += 0.75 * Math.max(0, 0.009 - this.sdf(x + n.x * 0.009, y + n.y * 0.009, z + n.z * 0.009)) / 0.009
    o += 0.5 * Math.max(0, 0.016 - this.sdf(x + n.x * 0.016, y + n.y * 0.016, z + n.z * 0.016)) / 0.016
    return clamp(1 - o * 0.5, 0, 1)
  }

  /** Distancia `t` del punto de la superficie más externo sobre el rayo o + d·t (t ≤ tMax). */
  rayo(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number): number {
    let t = tMax
    let s = this.sdf(ox + dx * t, oy + dy * t, oz + dz * t)
    if (s <= 0) return t
    for (let i = 0; i < 160; i++) {
      const paso = Math.max(s * 0.95, 0.0005)
      const t2 = t - paso
      if (t2 <= 0) return 0
      const s2 = this.sdf(ox + dx * t2, oy + dy * t2, oz + dz * t2)
      if (s2 < 0) {
        // Bisección entre t2 (adentro) y t (afuera).
        let a = t2
        let b = t
        for (let k = 0; k < 7; k++) {
          const m = (a + b) * 0.5
          if (this.sdf(ox + dx * m, oy + dy * m, oz + dz * m) < 0) a = m
          else b = m
        }
        return (a + b) * 0.5
      }
      t = t2
      s = s2
    }
    return t
  }

  /**
   * Como `rayo`, pero arrancando cerca de una respuesta conocida (la fila
   * anterior): encierra la superficie y la refina por regula falsi. Unas 5
   * evaluaciones en vez de 15; si algo no cuadra, vuelve al rayo completo.
   */
  rayoDesde(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t0: number, tMax: number): number {
    const f = (t: number) => this.sdf(ox + dx * t, oy + dy * t, oz + dz * t)
    let a = Math.min(t0, tMax)
    let fa = f(a)
    let b = a
    let fb = fa
    let n = 0
    if (fa > 0) {
      // Afuera: hacia adentro hasta cruzar.
      while (fb > 0) {
        a = b
        fa = fb
        b = a - Math.max(fb, 0.0015)
        if (b <= 0 || ++n > 24) return this.rayo(ox, oy, oz, dx, dy, dz, tMax)
        fb = f(b)
      }
    } else {
      // Adentro: hacia afuera hasta salir.
      while (fa <= 0) {
        b = a
        fb = fa
        a = b + Math.max(-fa, 0.0015)
        if (a > tMax || ++n > 24) return this.rayo(ox, oy, oz, dx, dy, dz, tMax)
        fa = f(a)
      }
    }
    // a afuera (fa > 0), b adentro (fb < 0): regula falsi (Illinois).
    let lado = 0
    let t = a
    for (let k = 0; k < 6; k++) {
      t = (b * fa - a * fb) / (fa - fb)
      const ft = f(t)
      if (Math.abs(ft) < 2e-6) break
      if (ft > 0) {
        a = t
        fa = ft
        if (lado === 1) fb *= 0.5
        lado = 1
      } else {
        b = t
        fb = ft
        if (lado === -1) fa *= 0.5
        lado = -1
      }
    }
    // ¿Es la superficie de más afuera? Un poco más allá tiene que haber aire.
    if (f(t + 0.006) <= 0) return this.rayo(ox, oy, oz, dx, dy, dz, tMax)
    return t
  }

  /** Local → espacio del avatar. */
  aAvatar(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.c.x + x * this.hs, this.c.y + y * this.hs, this.c.z + z * this.hs)
  }

  /**
   * Coordenadas canónicas de la cara (0..1) para el mapa de arrugas: x por el
   * ancho de la cara; y por puntos fijos (mentón, boca, nariz, ojos, frente).
   */
  canonica(x: number, y: number): [number, number] {
    const u = 0.5 + x / (0.15 * this.W)
    const o = this.ojo
    const yb = this.yBoca
    const ny = this.nariz.y
    const ym = this.yMenton
    let v: number
    if (y < ym) v = 0.1 - (ym - y) * 4
    else if (y < yb) v = lerp(0.1, 0.3, (y - ym) / (yb - ym))
    else if (y < ny) v = lerp(0.3, 0.45, (y - yb) / (ny - yb))
    else if (y < o.y) v = lerp(0.45, 0.68, (y - ny) / (o.y - ny))
    else v = 0.68 + (y - o.y) * 4.4
    return [u, v]
  }

  /**
   * Color de la piel en un punto de la cara (multiplica al color base):
   * rubor en mejillas, nariz y orejas, labios, ojeras, contorno de ojos,
   * manchas, la sombra del pelo y de la barba, y la oclusión del propio campo.
   */
  tinte(x: number, y: number, z: number, ao: number, sombraBarba: number, peloT: number, barbaT: number): [number, number, number] {
    const ax = Math.abs(x)
    let r = 1
    let g = 1
    let b = 1
    const frente = suave(0.0, 0.05, z)
    const zn = this.zonas
    // Mejillas y nariz: rubor
    const rubor = (campana(ax, 0.042, 0.018) * campana(y, -0.025, 0.02) * frente + campana(ax, 0, 0.012) * campana(y, this.nariz.y, 0.012) * suave(0.09, 0.11, z) * 0.8) * (this.r.fem ? 1.1 : 0.85)
    if (zn.rubor) {
      const k = rubor * zn.rubor[3] * 1.6
      r = lerp(r, zn.rubor[0], k)
      g = lerp(g, zn.rubor[1], k)
      b = lerp(b, zn.rubor[2], k)
    } else {
      r += 0.05 * rubor
      g -= 0.07 * rubor
      b -= 0.06 * rubor
    }
    // Labios
    const yb = this.yBoca
    const labio = campana(ax, 0, 0.021 * this.LW) * campana(y - this.LC * 0.0035 * (x / (0.025 * this.LW)) ** 2, yb, 0.0095) * suave(0.088, 0.096, z)
    if (zn.labios) {
      r = lerp(r, zn.labios[0], labio * 0.85)
      g = lerp(g, zn.labios[1], labio * 0.85)
      b = lerp(b, zn.labios[2], labio * 0.85)
    } else {
      const kl = this.r.fem ? 1.4 : 1.1
      r -= 0.08 * labio * kl
      g -= 0.38 * labio * kl
      b -= 0.32 * labio * kl
    }
    // Línea de la boca (apenas: la boca de verdad se abre)
    const linea = campana(y, yb, 0.0011) * campana(ax, 0, 0.022) * suave(0.088, 0.096, z)
    r -= 0.25 * linea
    g -= 0.3 * linea
    b -= 0.28 * linea
    // Ojeras y párpados
    const o = this.ojo
    const ojera = campana(ax, o.x, 0.016) * campana(y, o.y - 0.008, 0.009) * frente * (0.35 + this.r.edad * 0.5)
    r -= 0.07 * ojera
    g -= 0.09 * ojera
    b -= 0.05 * ojera
    // Pliegue del párpado de arriba: una línea más oscura unos 5 mm sobre las
    // pestañas que se apaga hacia las esquinas. Da al ojo su forma a distancia.
    {
      const ex = ax - o.x
      const ey = y - o.y
      const ez = z - o.z
      const rr = Math.sqrt(ex * ex + ey * ey + ez * ez)
      if (rr < o.r + 0.009 && ez > 0 && ey > -0.004) {
        const pa = this.parpado
        const u = Math.atan2(ex, ez) / (pa.U * 1.12)
        const v = Math.atan2(ey, Math.sqrt(ex * ex + ez * ez)) - pa.incl * u
        const arco = Math.sqrt(Math.max(0, 1 - u * u))
        const vc = (pa.Vu + 0.3 + 0.08 * this.hood) * arco
        const k = campana(v, vc, 0.07) * suave(1.0, 0.6, Math.abs(u)) * frente
        r -= 0.2 * k
        g -= 0.24 * k
        b -= 0.22 * k
        // Párpado móvil (entre las pestañas y el pliegue): apenas más oscuro y rosado.
        const lid = suave(pa.Vu * arco - 0.02, pa.Vu * arco + 0.06, v) * suave(vc + 0.02, vc - 0.06, v) * suave(1.0, 0.7, Math.abs(u)) * frente
        r -= 0.04 * lid
        g -= 0.09 * lid
        b -= 0.07 * lid
        // Sombra de color en el párpado (Cleopatra: malaquita).
        const so = this.zonas.sombra
        if (so) {
          const k = suave(pa.Vu * arco - 0.02, pa.Vu * arco + 0.05, v) * suave(vc + 0.1, vc - 0.02, v) * suave(1.15, 0.8, Math.abs(u)) * frente * so[3]
          r = lerp(r, so[0], k)
          g = lerp(g, so[1], k)
          b = lerp(b, so[2], k)
        }
      }
    }
    // Delineado (kohl): línea negra pegada a las pestañas de arriba y de abajo,
    // con la cola que sigue hacia la sien desde la esquina de afuera.
    const del = this.f.piel.delineado
    // (solo cerca del ojo: el anillo es en ángulos desde el centro del globo y,
    // sin este tope, se repetía lejos — manchas negras en la nariz y la boca)
    const dOjo = Math.hypot(ax - o.x, y - o.y, z - o.z)
    if (del > 0.01 && z > 0.04 && dOjo < o.r + 0.012 && z > o.z) {
      const ex = ax - o.x
      const ey = y - o.y
      const pa = this.parpado
      const u = Math.atan2(ex, Math.max(0.001, z - o.z)) / pa.U
      const v = Math.atan2(ey, Math.sqrt(ex * ex + (z - o.z) ** 2)) - pa.incl * u
      const lam = Math.sqrt(u * u + (v / (v > 0 ? pa.Vu : pa.Vl)) ** 2)
      // Anillo alrededor de la abertura (más grueso arriba).
      let k = campana(lam, v > 0 ? 1.18 : 1.12, v > 0 ? 0.13 : 0.08) * (lam > 1.0 ? 1 : 0)
      // Cola: desde la esquina de afuera, sube un poco hacia la sien.
      const cola = (ex - o.r * 0.9) / (o.r * 1.1)
      if (cola > -0.2 && cola < 1) k = Math.max(k, campana(ey - 0.0035 * Math.max(0, cola), 0.0005, 0.0018) * suave(1, 0.6, cola) * suave(-0.2, 0.1, cola))
      k *= del
      r = lerp(r, 0.12, k)
      g = lerp(g, 0.11, k)
      b = lerp(b, 0.12, k)
    }
    // Contorno de los ojos de otro tono (más claro o más oscuro).
    if (zn.ojos) {
      const k = campana(ax, o.x, 0.02) * campana(y, o.y, 0.014) * frente * zn.ojos[3]
      r = lerp(r, zn.ojos[0], k)
      g = lerp(g, zn.ojos[1], k)
      b = lerp(b, zn.ojos[2], k)
    }
    // Frente y nariz un poco más claras y amarillas
    const t = campana(ax, 0, 0.04) * campana(y, 0.055, 0.03) * frente
    r += 0.02 * t
    g += 0.015 * t
    // Fosas nasales
    const fosa = campana(ax, 0.008, 0.006) * campana(y, this.nariz.y - 0.012, 0.004) * suave(0.09, 0.098, z)
    r -= 0.4 * fosa
    g -= 0.45 * fosa
    b -= 0.45 * fosa
    // Manchas de la edad: puntos suaves en sienes, frente y mejillas.
    const man = this.f.piel.manchas
    if (man > 0.01) {
      const n = Math.sin(x * 410 + 1.3) * Math.sin(y * 370 + 0.7) * Math.sin(z * 290 + 2.1)
      const k = man * Math.max(0, n - 0.55) * 2.2 * suave(-0.02, 0.03, y)
      r -= 0.1 * k
      g -= 0.16 * k
      b -= 0.2 * k
    }
    // Sombra de barba (afeitado o de días): gris azulado sobre mandíbula, mentón y bigote.
    if (sombraBarba > 0) {
      const m = barbaSombra(this, x, y, z)
      const k = sombraBarba * m * m
      r -= 0.26 * k
      g -= 0.24 * k
      b -= 0.18 * k
    }
    // Bajo las cejas, la piel toma un poco su color (se leen como pelo, no como trazo).
    const ceja = cejaEn(this, x, y, z)
    if (ceja > 0.001) {
      const c = this.fCeja
      // (con 0,45 las cejas se leían como trazos sueltos; la piel de abajo
      // casi del color de la ceja las vuelve una forma, como en los juegos)
      const k = ceja * 0.82
      r = lerp(r, c[0], k)
      g = lerp(g, c[1], k)
      b = lerp(b, c[2], k)
    }
    let rr = r
    let gg = g
    let bb = b
    // Debajo del pelo y de la barba la piel toma su color: los huecos entre
    // hebras se leen como pelo, no como piel (y la cabeza rapada muestra la sombra).
    if (peloT > 0.001) {
      const c = this.fPelo
      rr = lerp(rr, c[0], peloT)
      gg = lerp(gg, c[1], peloT)
      bb = lerp(bb, c[2], peloT)
    }
    if (barbaT > 0.001 && this.fBarba) {
      const c = this.fBarba
      rr = lerp(rr, c[0], barbaT)
      gg = lerp(gg, c[1], barbaT)
      bb = lerp(bb, c[2], barbaT)
    }
    const a = 0.42 + 0.58 * ao
    return [rr * a, gg * a, bb * a]
  }
}

// ── Máscaras de pelo, cejas y barba ───────────────────────────

/** Densidad de la ceja sobre la piel (para teñir debajo de las tiras). */
export function cejaEn(cab: Cabeza, x: number, y: number, z: number): number {
  if (z < 0.05) return 0
  const ce = cab.f.cejas
  const o = cab.ojo
  const ax = Math.abs(x)
  const x0 = 0.011 * cab.r.ancho
  const x1 = (0.011 + 0.045 * ce.largo) * cab.r.ancho
  const t = (ax - x0) / (x1 - x0)
  if (t < -0.15 || t > 1.1) return 0
  const tc = clamp(t, 0, 1)
  const arco = (0.004 + 0.008 * ce.arco) * Math.sin(Math.PI * Math.min(1, tc * 1.15))
  const yc = o.y + 0.0172 + 0.01 * ce.alto + arco - 0.003 * tc + ce.inclinacion * 0.004 * (1 - tc)
  const alto = lerp(0.0112, 0.0058, tc) * ce.grosor * 0.5
  return suave(alto + 0.002, alto * 0.4, Math.abs(y - yc)) * suave(-0.15, 0.1, t) * suave(1.1, 0.85, t) * ce.densidad
}

/** Dónde crece la barba (sombra de afeitado: la zona completa). */
function barbaSombra(cab: Cabeza, x: number, y: number, z: number): number {
  return barbaEn(cab, x, y, z, cab.zonasSombra)[0]
}

/**
 * Barba en un punto de la cara (coordenadas locales): [máscara 0..1, grosor m].
 * Las zonas se suman: bigote, perilla (mentón), mandíbula, mejillas y cuello.
 */
export function barbaEn(cab: Cabeza, x: number, y: number, z: number, b: BarbaR): [number, number] {
  const ax = Math.abs(x)
  const yb = cab.yBoca
  const ny = cab.nariz.y
  const L = cab.r.largo
  const lw = cab.anchoBoca / 0.024
  // Fuera de la cara (detrás de la oreja) no hay barba.
  const delante = suave(-0.014, 0.01, z)
  // Labios: sin pelo (el bigote cae sobre el labio superior).
  const labios = 1 - campana(ax, 0, 0.026 * lw) * suave(0.07, 0.085, z) * campana(y, yb - 0.003, 0.0105)
  const bajoMandibula = suave(-0.15, -0.12, y)
  // Bigote: entre la nariz y el labio de arriba, hasta las comisuras.
  const bw = 0.024 * lw + 0.004
  const bigote = b.bigote * suave(bw + 0.004, bw - 0.003, ax) * suave(ny - 0.01, ny - 0.015, y) * suave(yb + 0.0012, yb + 0.005, y) * suave(0.07, 0.085, z)
  // Perilla: mentón y bajo el labio de abajo.
  const pw = 0.022 * b.anchoPerilla
  const perilla = b.perilla * suave(pw + 0.006, pw - 0.004, ax) * suave(yb - 0.003, yb - 0.01, y) * suave(0.02, 0.055, z) * bajoMandibula
  // Mandíbula: franja a lo largo del hueso, del ángulo al mentón.
  const yj = -0.058 * L - 0.037 * L * clamp(z / 0.084, 0, 1.15)
  const franja = suave(yj + 0.02, yj + 0.007, y) * delante * bajoMandibula
  const mand = b.mandibula * franja
  // Mejillas: desde la mandíbula hasta una línea que sube hacia el pómulo.
  const yMej = lerp(yj + 0.012, -0.008 - ax * 0.25, clamp(b.mejillas, 0, 1))
  const ancho = lerp(0.002, 0.012, clamp(b.borde, 0, 1))
  const mej = clamp(b.mejillas * 1.5, 0, 1) * suave(yMej + ancho, yMej - ancho * 0.6, y) * delante * bajoMandibula
  // Cuello: debajo de la mandíbula.
  const cue = b.cuello * suave(-0.1, -0.125, y) * suave(-0.17 + 0.03 * b.cuello, -0.14, y) * suave(-0.01, 0.03, z)
  const m = clamp(Math.max(bigote, Math.max(perilla, mand, mej) * labios, cue), 0, 1)
  if (m <= 0) return [0, 0]
  // Grosor: lo que dice la ficha en el mentón; menos en las mejillas, el bigote
  // y bajo la mandíbula (la barba sigue el hueso y se afina hacia el cuello).
  const menton = campana(ax, 0, 0.032) * suave(yb - 0.008, yb - 0.035, y)
  const bajo = suave(-0.105, -0.14, y) * (1 - 0.6 * menton)
  // (el pelo de la barba va inclinado: la capa es más fina que el largo, sobre todo en las mejillas)
  const g = b.largo * (0.3 + 0.7 * menton) * (bigote > Math.max(perilla, mand, mej) ? 0.6 : 1) * (1 - 0.65 * bajo)
  return [m, g]
}

/**
 * Pelo de la cabeza en un punto del cuero cabelludo: [máscara 0..1 (dónde
 * nace), grosor (m)]. Sale de la ficha: línea de nacimiento (entradas,
 * coronilla, herradura, patillas, nuca, flequillo) y volumen por zona.
 */
export function peloEn(cab: Cabeza, x: number, y: number, z: number, ph: PeloR = cab.f.pelo): [number, number] {
  const ax = Math.abs(x)
  const fem = cab.r.fem
  // Frente: línea de nacimiento. Entradas = la línea sube en las sienes (forma de M).
  let yF = 0.066 + 0.01 * ph.alto + cab.f.cara.frente * 0.006 + (fem ? -0.008 : 0)
  yF += ph.entradas * 0.03 * campana(ax, 0.043, 0.016)
  // Línea recta: las esquinas de las sienes no bajan.
  yF -= 0.006 * ph.recta * suave(0.03, 0.05, ax)
  // Pelo largo con raya: se abre hacia los costados y deja la frente en "V" invertida.
  if (ph.raya !== null && ph.largo > 0 && ph.flequillo < 0.5) yF += 0.024 * campana(x, ph.raya * 0.026, 0.024)
  yF = lerp(yF, 0.03, clamp(ph.flequillo, 0, 1))
  const anchoBorde = lerp(0.011, 0.004, clamp(ph.recta, 0, 1))
  const wF = suave(0.025, 0.055, z) * suave(0.07, 0.05, ax)
  const mFrente = 1 - wF * (1 - suave(yF - anchoBorde, yF + anchoBorde, y))
  // Sien y patilla: delante de la oreja el pelo baja hasta la patilla.
  const yT = lerp(0.0 - 0.01 * ph.patillas, 0.05 + 0.014 * ph.entradas, suave(0.028, 0.058, z))
  const wT = suave(0.045, 0.06, ax) * suave(0.015, 0.03, z)
  const mSien = 1 - wT * (1 - suave(yT - anchoBorde, yT + anchoBorde, y))
  // Alrededor de la oreja: un hueco con su forma (más 1 cm), salvo que el pelo las tape.
  const dOreja = ((y - 0.006) / 0.043) ** 2 + ((z + 0.008) / 0.03) ** 2
  const mOreja = 1 - (1 - clamp(ph.cubreOrejas, 0, 1)) * suave(0.05, 0.065, ax) * suave(1.3, 0.75, dOreja)
  // Nuca
  const yNuca = -0.072 - 0.01 * ph.nuca - (ph.largo > 0 ? 0.02 : 0)
  const mNuca = 1 - suave(0.02, -0.02, z) * (1 - suave(yNuca - 0.012, yNuca + 0.012, y))
  // Debajo de la oreja y por delante de la nuca (la mandíbula): sin pelo.
  const mBajo = 1 - suave(0.0, -0.025, y) * suave(-0.03, 0.0, z)
  let m = mFrente * mSien * mOreja * mNuca * mBajo
  // Calvicie en herradura y clareo de la coronilla.
  if (ph.calvo > 0) m *= 1 - ph.calvo * Math.max(suave(0.018, 0.04, y), suave(0.02, 0.045, z))
  if (ph.coronilla > 0) {
    const dx = x
    const dy = y - 0.106
    const dz = z + 0.045
    m *= 1 - ph.coronilla * campana(Math.sqrt(dx * dx + dy * dy + dz * dz), 0, 0.03)
  }
  m = clamp(m, 0, 1)
  if (m <= 0) return [0, 0]
  const enLado = suave(0.045, 0.06, ax)
  // (arriba empieza más alto: el volumen de la coronilla no baja a las sienes, sin casco)
  const arriba = suave(0.0, 0.085, y)
  const atras = suave(0.01, -0.07, z)
  const delante = suave(0.02, 0.07, z) * suave(0.02, 0.07, y)
  let g = ph.vBase + ph.vArriba * arriba + ph.vFrente * delante + ph.vLados * enLado + ph.vAtras * atras
  // Copete: volumen al frente y arriba.
  if (ph.copeteAlto > 0) g += ph.copeteAlto * campana(z, 0.05, 0.035) * suave(0.03, 0.085, y) * suave(0.065, 0.035, ax)
  // Raya: un surco donde se abre el pelo.
  if (ph.raya !== null) {
    const xr = ph.raya * 0.026
    g -= 0.75 * (ph.vArriba + ph.vBase) * campana(x, xr, 0.004) * suave(-0.03, 0.04, z) * arriba
    // Junto a la raya, al frente, el pelo se va hacia los costados: la frente
    // queda libre en "V" invertida (sin flequillo de casco).
    if (ph.flequillo < 0.5) g *= 1 - 0.65 * campana(x, xr, 0.028) * suave(0.03, 0.075, z) * suave(0.02, 0.06, y)
  }
  // Patillas y costados bajos: el pelo se pega a la cabeza (sin "casco"), salvo
  // que el estilo tape las orejas.
  const pegado = enLado * suave(-0.03, 0.02, z) * (1 - clamp(ph.cubreOrejas, 0, 1) * 0.8)
  g *= lerp(1, lerp(0.12, 1, suave(0.0, 0.06, y)), pegado)
  return [m, Math.max(0.0012, g)]
}

/** Ruido suave en la esfera (rizos): suma de senos con fases por semilla. */
export function rizos(x: number, y: number, z: number, frec: number, semilla: number): number {
  const s = semilla * 0.37
  return (
    Math.sin(x * frec + s) * Math.sin(y * frec * 1.13 + s * 1.7) * Math.sin(z * frec * 0.91 + s * 2.3) +
    0.5 * Math.sin(x * frec * 2.1 + 1.3 + s) * Math.sin(y * frec * 1.9 + s) * Math.sin(z * frec * 2.3 + 0.7)
  )
}

export { lerp }
