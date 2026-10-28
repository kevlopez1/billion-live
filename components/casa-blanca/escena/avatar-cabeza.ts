// ──────────────────────────────────────────────────────────────
// La cabeza, esculpida con código.
//
// La forma es un campo de distancia (SDF): cráneo, frente, pómulos,
// mandíbula, mentón, arco de las cejas, cuencas, nariz con puente, punta y
// aletas, labios con comisuras y el cuello, todo unido con mezclas suaves
// (smin). La malla sale de lanzar rayos desde el centro de la cabeza (cara y
// cráneo) y en horizontal desde el eje del cuello (cuello), siempre con las
// mismas columnas que el torso: cabeza, cuello y cuerpo son UNA malla
// continua, sin unión visible.
//
// Los rasgos (ancho de cara, mandíbula, nariz, labios, ojos, edad) salen de
// la apariencia de cada personaje y de una semilla por id: estilo y rasgos
// generales, nunca el retrato de una persona.
//
// Coordenadas locales de la cabeza: metros para una cabeza de 23,5 cm, con el
// origen entre los oídos; +x = izquierda del personaje, +y arriba, +z al frente.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Apariencia, Personaje } from "../tipos"
import { azar } from "./motor-texturas"
import { campana, clamp, hashTexto, lerp, suave } from "./avatar-geo"

export interface Rasgos {
  fem: boolean
  /** 0 = joven, 1 = anciano (canas, arrugas, entradas). */
  edad: number
  grasa: number
  ancho: number
  largo: number
  mandibula: number
  menton: number
  pomulos: number
  cejas: number
  nariz: { largo: number; ancho: number; proy: number; bulbo: number; puente: number }
  labios: number
  bocaAncho: number
  ojo: { tam: number; sep: number; abierto: number; incl: number }
  oreja: number
  cuello: number
  iris: string
}

const gris = (hex: string) => {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  return { s: hsl.s, l: hsl.l }
}

/** Rasgos generales a partir de la apariencia y una semilla por id (no es un retrato). */
export function rasgosDe(p: Personaje): Rasgos {
  const ap: Apariencia = p.apariencia
  const r = azar(hashTexto(p.id) ^ 0x5bd1e995)
  const v = (a: number) => 1 + (r() * 2 - 1) * a
  const fem = ap.ropa.tipo === "vestido_egipcio"
  // Canas: pelo o barba gris claro = mayor.
  const g1 = gris(ap.pelo.color)
  const g2 = ap.barba ? gris(ap.barba.color) : g1
  const canas = Math.max(g1.s < 0.12 && g1.l > 0.5 ? (g1.l - 0.45) * 2.2 : 0, g2.s < 0.12 && g2.l > 0.45 ? (g2.l - 0.4) * 2 : 0)
  const edad = clamp(0.25 + r() * 0.25 + canas * 0.6, 0, 1)
  const grasa = { delgado: 0.1, medio: 0.3, fuerte: 0.65, atletico: 0.15 }[ap.complexion] ?? 0.3
  const fuerte = ap.complexion === "fuerte" || ap.complexion === "atletico"
  // Ojos: pelo rubio o castaño claro → claros; oscuro → marrón.
  const claro = g1.l > 0.42 && g1.s > 0.15 && !canas
  const irisClaros = ["#5f86a8", "#6b8f7a", "#7d6a45", "#4f7795"]
  const irisOscuros = ["#4a2f1d", "#3b2618", "#5a3b22", "#2f1f15"]
  const iris = (claro ? irisClaros : irisOscuros)[Math.floor(r() * 4)]
  return {
    fem,
    edad,
    grasa,
    ancho: v(0.04) * (fem ? 0.95 : 1) * (1 + grasa * 0.04),
    largo: v(0.04) * (fem ? 0.96 : 1),
    mandibula: v(0.07) * (fem ? 0.86 : fuerte ? 1.07 : 1) * (1 + grasa * 0.05),
    menton: v(0.15) * (fem ? 0.85 : 1),
    pomulos: v(0.15) * (fem ? 1.1 : 1),
    cejas: v(0.15) * (fem ? 0.6 : 1),
    nariz: { largo: v(0.08) * (fem ? 0.93 : 1), ancho: v(0.1) * (fem ? 0.88 : 1), proy: v(0.1), bulbo: v(0.12), puente: r() * (fem ? 0.2 : 0.8) },
    labios: v(0.15) * (fem ? 1.25 : 1),
    bocaAncho: v(0.06),
    ojo: { tam: v(0.05) * (fem ? 1.08 : 1.03), sep: v(0.03), abierto: v(0.1) * (1 - edad * 0.12), incl: (r() - 0.4) * 0.12 + (fem ? 0.06 : 0) },
    oreja: v(0.08) * (1 + edad * 0.08),
    cuello: v(0.05) * (fem ? 0.82 : fuerte ? 1.12 : 1) * (1 + grasa * 0.06),
    iris,
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

export class Cabeza {
  readonly c: THREE.Vector3
  readonly hs: number
  readonly r: Rasgos
  readonly ojo: OjoGeo
  /** Abertura de los párpados (radianes en la esfera del ojo): medio ancho, alto arriba/abajo, inclinación. */
  readonly parpado: { U: number; Vu: number; Vl: number; incl: number }
  /** Línea de la boca (y local) y punta de la nariz. */
  readonly yBoca: number
  readonly nariz: { y: number; z: number }
  readonly yMenton: number
  /** Eje del cuello: de (0, y0, z0) a (0, y1, z1). */
  readonly cuello: { y0: number; z0: number; y1: number; z1: number; r0: number; r1: number }
  private readonly P: number[]

  constructor(c: THREE.Vector3, hs: number, r: Rasgos) {
    this.c = c
    this.hs = hs
    this.r = r
    const W = r.ancho
    const L = r.largo
    this.ojo = { x: 0.032 * r.ojo.sep * W, y: 0.012, z: 0.0712, r: 0.0118 * r.ojo.tam }
    this.parpado = { U: 1.08, Vu: 0.36 * r.ojo.abierto, Vl: 0.29, incl: r.ojo.incl }
    this.yBoca = -0.06 * L
    const nl = r.nariz.largo
    this.nariz = { y: -0.026 * L * nl, z: 0.1145 + 0.008 * (r.nariz.proy - 1) }
    this.yMenton = -0.108 * L
    const nk = r.cuello
    this.cuello = { y0: -0.035, z0: -0.022, y1: -0.21, z1: -0.042, r0: 0.054 * nk, r1: 0.064 * nk }
    // Parámetros empaquetados para la función de distancia (rápida, sin objetos).
    this.P = [W, L, r.mandibula, r.menton, r.pomulos, r.cejas, nl, r.nariz.ancho, r.nariz.proy, r.nariz.bulbo, r.nariz.puente, r.labios, r.bocaAncho, r.grasa, r.edad, r.fem ? 1 : 0, nk]
  }

  /** Distancia firmada a la superficie de la piel (coordenadas locales). */
  sdf(x: number, y: number, z: number): number {
    const [W, L, J, Mn, Pm, B, NL, NA, NP, NB, NH, LF, LW, G, E, F, NK] = this.P
    const ax = Math.abs(x)
    const o = this.ojo
    // Cráneo y frente (medidas desde el centro entre los oídos: frente ~10 cm, nuca ~10 cm)
    let d = elip(x, y, z, 0, 0.026, -0.006, 0.0762 * W, 0.099, 0.096)
    d = smin(d, elip(x, y, z, 0, 0.036, 0.034, 0.064 * W, 0.066, 0.066), 0.022)
    // Base de la cara: cráneo ensanchado hacia los pómulos (sin borde de "máscara").
    d = smin(d, elip(x, y, z, 0, -0.012, 0.012, 0.07 * W, 0.07, 0.085), 0.03)
    // Maxilar (media cara) y mejillas
    d = smin(d, elip(x, y, z, 0, -0.03 * L, 0.052, (0.056 + 0.005 * G) * W, 0.046 * L, 0.051), 0.026)
    if (!lejos(ax, y, z, 0.05, -0.02, 0.045, 0.06, d, 0.024)) {
      d = smin(d, elip(ax, y, z, 0.049 * W, -0.005, 0.063, 0.021 * Pm, 0.014, 0.021), 0.02)
      // Arco cigomático: del pómulo a la oreja
      d = smin(d, cono(ax, y, z, 0.05 * W, -0.004, 0.06, 0.068 * W, 0.0, 0.012, 0.009, 0.006), 0.02)
      // Carrillos (más con grasa)
      d = smin(d, elip(ax, y, z, 0.041 * W, -0.038 * L, 0.064, 0.022 + 0.008 * G, 0.025, 0.026), 0.024)
    }
    if (!lejos(x, y, z, 0, -0.07, 0.04, 0.085, d, 0.03)) {
      // Mandíbula: de cada ángulo al mentón
      d = smin(d, cono(ax, y, z, 0.052 * J * W, -0.058 * L, 0.004, 0.019 * Mn, -0.095 * L, 0.084, 0.0145 + 0.004 * G, 0.0145), 0.03)
      d = smin(d, elip(x, y, z, 0, -0.064 * L, 0.046, 0.05 * J, 0.033 * L, 0.052), 0.026)
      // Mentón
      d = smin(d, elip(x, y, z, 0, -0.092 * L, 0.089 + 0.005 * (Mn - 1), 0.021 * Mn * (1.1 - F * 0.15), 0.0165, 0.0165), 0.012)
    }
    // Arco de las cejas
    if (!lejos(ax, y, z, 0.028, 0.031, 0.085, 0.04, d, 0.012)) d = smin(d, cono(ax, y, z, 0.045 * W, 0.03, 0.077, 0.008, 0.033, 0.0935, 0.0095 * B, 0.0105 * B), 0.012)
    // Ojos: cuenca, párpados (una esfera apenas mayor que el globo, fundida con la cara)
    // y la abertura en almendra. El borde fino del párpado es una malla aparte (mallaParpado).
    const ko = o.r / 0.0118
    if (!lejos(ax, y, z, o.x + 0.002, o.y, o.z + 0.01, 0.032, d, 0.008)) {
      d = smax(d, -elip(ax, y, z, o.x + 0.002, o.y + 0.0008, o.z + 0.016, 0.0185 * ko, 0.0098 * ko, 0.0125), 0.006)
      const ex = ax - o.x
      const ey = y - o.y
      const ez = z - o.z
      const rr = Math.sqrt(ex * ex + ey * ey + ez * ez)
      d = smin(d, rr - (o.r + 0.0011), 0.0035)
      // Pliegue del párpado superior.
      if (ey > 0.002 && ez > 0) d = smax(d, -(Math.abs(rr - (o.r + 0.0052)) - 0.0005), 0.0016)
      if (rr < o.r + 0.008) {
        const pa = this.parpado
        const u = Math.atan2(ex, ez)
        const v = Math.atan2(ey, Math.sqrt(ex * ex + ez * ez)) - pa.incl * (u / pa.U)
        const vm = v > 0 ? pa.Vu : pa.Vl
        const lam = Math.sqrt((u / pa.U) ** 2 + (v / vm) ** 2)
        const abertura = Math.max((lam - 1.08) * rr * 0.3, rr - (o.r + 0.0035))
        d = smax(d, -abertura, 0.0008)
      }
    }
    // Sien
    if (!lejos(ax, y, z, 0.072 * W, 0.03, 0.05, 0.021, d, 0.012)) d = smax(d, -elip(ax, y, z, 0.072 * W, 0.03, 0.05, 0.012, 0.02, 0.02), 0.012)
    // Nariz: puente, punta y aletas
    const nty = this.nariz.y
    const ntz = this.nariz.z
    if (!lejos(x, y, z, 0, -0.012, 0.1, 0.045, d, 0.01)) {
      d = smin(d, cono(x, y, z, 0, 0.013, 0.0925, 0, nty + 0.004, ntz - 0.0035, 0.0056 * NA, 0.0084 * NA), 0.008)
      if (NH > 0.3) d = smin(d, esf(x, y, z, 0, -0.002, 0.1035 + 0.002 * NH, 0.005 * NA), 0.006)
      d = smin(d, esf(x, y, z, 0, nty, ntz, 0.0102 * NB), 0.0065)
      d = smin(d, esf(ax, y, z, 0.0136 * NA, nty - 0.0085, ntz - 0.0155, 0.0077 * NA), 0.0065)
      d = smin(d, elip(x, y, z, 0, nty - 0.0115, ntz - 0.0125, 0.0092 * NA, 0.0044, 0.0078), 0.005)
    }
    // Labios con volumen, comisuras y la línea de la boca
    const yb = this.yBoca
    if (!lejos(x, y, z, 0, yb, 0.09, 0.045, d, 0.008)) {
      d = smin(d, elip(x, y, z, 0, yb + 0.0066, 0.0985, 0.0228 * LW, 0.0062 * LF, 0.0082 * LF), 0.006)
      d = smin(d, elip(x, y, z, 0, yb - 0.0068, 0.096, 0.0198 * LW, 0.0071 * LF, 0.0086 * LF), 0.006)
      d = smax(d, -elip(x, y, z, 0, yb, 0.107, 0.025 * LW, 0.0008, 0.011), 0.0015)
      // Filtrum: el surco entre la nariz y el labio superior.
      d = smax(d, -cono(x, y, z, 0, nty - 0.014, ntz - 0.008, 0, yb + 0.011, 0.1035, 0.0018, 0.0022), 0.003)
      // Surco bajo el labio inferior
      d = smax(d, -cono(x, y, z, -0.012, yb - 0.0175, 0.1015, 0.012, yb - 0.0175, 0.1015, 0.0035, 0.0035), 0.005)
      // Surco nasolabial (más marcado con la edad)
      d = smax(d, -cono(ax, y, z, 0.019 * NA, nty - 0.008, ntz - 0.021, 0.027 * LW, yb - 0.004, 0.094, 0.0016 + 0.0012 * E, 0.0012), 0.004 + 0.003 * E)
    }
    // Cuello y nuez
    const k = this.cuello
    d = smin(d, cono(x, y, z, 0, k.y0, k.z0, 0, k.y1, k.z1, k.r0, k.r1), 0.03)
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
    let o = 0
    let w = 1
    for (let i = 1; i <= 2; i++) {
      const h = 0.0055 * i
      o += w * (h - this.sdf(x + n.x * h, y + n.y * h, z + n.z * h))
      w *= 0.6
    }
    return clamp(1 - o * 8, 0, 1)
  }

  /** Distancia `t` del punto de la superficie más externo sobre el rayo o + d·t (t ≤ tMax). */
  rayo(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tMax: number, f: (x: number, y: number, z: number) => number = (x, y, z) => this.sdf(x, y, z)): number {
    let t = tMax
    let s = f(ox + dx * t, oy + dy * t, oz + dz * t)
    if (s <= 0) return t
    for (let i = 0; i < 160; i++) {
      const paso = Math.max(s * 0.95, 0.0005)
      const t2 = t - paso
      if (t2 <= 0) return 0
      const s2 = f(ox + dx * t2, oy + dy * t2, oz + dz * t2)
      if (s2 < 0) {
        // Bisección entre t2 (adentro) y t (afuera).
        let a = t2
        let b = t
        for (let k = 0; k < 7; k++) {
          const m = (a + b) * 0.5
          if (f(ox + dx * m, oy + dy * m, oz + dz * m) < 0) a = m
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
   * Color de la piel en un punto de la cara (multiplica al color base):
   * rubor en mejillas, nariz y orejas, labios, ojeras, sombra de barba y
   * la oclusión del propio campo.
   */
  tinte(x: number, y: number, z: number, ao: number, sombraBarba: number): [number, number, number] {
    const ax = Math.abs(x)
    let r = 1
    let g = 1
    let b = 1
    const frente = suave(0.0, 0.05, z)
    // Mejillas y nariz: rubor
    const rubor = (campana(ax, 0.042, 0.018) * campana(y, -0.025, 0.02) * frente + campana(ax, 0, 0.012) * campana(y, this.nariz.y, 0.012) * suave(0.09, 0.11, z) * 0.8) * (this.r.fem ? 1.1 : 0.85)
    r += 0.05 * rubor
    g -= 0.07 * rubor
    b -= 0.06 * rubor
    // Labios
    const yb = this.yBoca
    const labio = campana(ax, 0, 0.021 * this.r.bocaAncho) * campana(y, yb, 0.0095) * suave(0.088, 0.096, z)
    const kl = this.r.fem ? 1.4 : 1.1
    r -= 0.08 * labio * kl
    g -= 0.38 * labio * kl
    b -= 0.32 * labio * kl
    // Línea de la boca
    const linea = campana(y, yb, 0.0013) * campana(ax, 0, 0.022) * suave(0.088, 0.096, z)
    r -= 0.35 * linea
    g -= 0.4 * linea
    b -= 0.38 * linea
    // Ojeras y párpados
    const o = this.ojo
    const ojera = campana(ax, o.x, 0.016) * campana(y, o.y - 0.004, 0.012) * frente * (0.6 + this.r.edad * 0.6)
    r -= 0.07 * ojera
    g -= 0.09 * ojera
    b -= 0.05 * ojera
    // Frente y nariz un poco más claras y amarillas
    const t = campana(ax, 0, 0.04) * campana(y, 0.055, 0.03) * frente
    r += 0.02 * t
    g += 0.015 * t
    // Fosas nasales
    const fosa = campana(ax, 0.008, 0.006) * campana(y, this.nariz.y - 0.012, 0.004) * suave(0.09, 0.098, z)
    r -= 0.4 * fosa
    g -= 0.45 * fosa
    b -= 0.45 * fosa
    // Sombra de barba (afeitado o de días): gris azulado sobre mandíbula, mentón y bigote.
    if (sombraBarba > 0) {
      const m = mascaraBarba(this, x, y, z, "completa")
      const k = sombraBarba * m * m
      r -= 0.26 * k
      g -= 0.24 * k
      b -= 0.18 * k
    }
    const a = 0.55 + 0.45 * ao
    return [r * a, g * a, b * a]
  }
}

// ── Máscaras de pelo y barba ──────────────────────────────────

export type EstiloBarba = NonNullable<Apariencia["barba"]>["estilo"]

/** Cuánto de barba hay en un punto de la cara (0..1). */
export function mascaraBarba(cab: Cabeza, x: number, y: number, z: number, estilo: EstiloBarba): number {
  const ax = Math.abs(x)
  const yb = cab.yBoca
  const ny = cab.nariz.y
  // Fuera de la cara (detrás de la oreja) no hay barba.
  const delante = suave(-0.012, 0.012, z)
  // Línea de la mejilla: baja hacia la boca.
  const mejilla = suave(-0.008 - ax * 0.25, -0.02 - ax * 0.25, y)
  // Labios: sin pelo (el bigote cae sobre el labio superior).
  const labios = 1 - campana(ax, 0, 0.026) * suave(0.07, 0.085, z) * campana(y, yb - 0.003, 0.0105)
  const bigote = campana(ax, 0, 0.026) * suave(ny - 0.011, ny - 0.016, y) * suave(yb + 0.0015, yb + 0.006, y) * suave(0.07, 0.085, z)
  const bajoMandibula = suave(-0.14, -0.118, y)
  switch (estilo) {
    case "candado": {
      const chivo = campana(ax, 0, 0.022) * suave(yb - 0.004, yb - 0.012, y) * suave(0.03, 0.06, z) * bajoMandibula
      return clamp(Math.max(chivo * labios, bigote), 0, 1)
    }
    case "menton": {
      // Barba de collar: solo el borde de la mandíbula y el mentón, sin bigote.
      // La línea de la mandíbula va del ángulo (atrás, arriba) al mentón (adelante, abajo).
      const L = cab.r.largo
      const yj = -0.058 * L - 0.037 * L * clamp(z / 0.084, 0, 1.15)
      const borde = suave(yj + 0.018, yj + 0.006, y)
      return clamp(borde * delante * bajoMandibula * labios, 0, 1)
    }
    default: {
      const cara = mejilla * delante * bajoMandibula
      return clamp(Math.max(cara * labios, bigote), 0, 1)
    }
  }
}

/** Grosor de barba por estilo (m) en un punto. */
export function grosorBarba(cab: Cabeza, x: number, y: number, z: number, estilo: EstiloBarba): number {
  const ax = Math.abs(x)
  const yb = cab.yBoca
  const menton = campana(ax, 0, 0.03) * suave(yb - 0.01, yb - 0.04, y)
  switch (estilo) {
    case "corta":
      return 0.003 + 0.0015 * menton
    case "candado":
      return 0.0045 + 0.003 * menton
    case "menton":
      return 0.006 + 0.004 * menton
    case "larga":
      return 0.007 + 0.008 * menton
    case "completa":
    default:
      return 0.0045 + 0.0045 * menton
  }
}

export type EstiloPelo = Apariencia["pelo"]["estilo"]

/**
 * Pelo de la cabeza: máscara (dónde nace) y grosor por estilo, en un punto
 * del cuero cabelludo. Devuelve [máscara 0..1, grosor m].
 */
export function pelo(cab: Cabeza, x: number, y: number, z: number, estilo: EstiloPelo, conBarbaLarga: boolean): [number, number] {
  const ax = Math.abs(x)
  const e = cab.r.edad
  // Frente: línea de nacimiento (con entradas según la edad). Solo manda al frente.
  const entradas = 0.004 + e * 0.014
  // La melena lleva flequillo: el pelo cae sobre la frente hasta las cejas.
  const yF = estilo === "melena_bob" ? 0.034 : 0.066 + entradas * campana(ax, 0.04, 0.016) + e * 0.006 + (cab.r.fem ? -0.008 : 0)
  const wF = suave(0.025, 0.055, z) * suave(0.07, 0.05, ax)
  const mFrente = 1 - wF * (1 - suave(yF - 0.012, yF + 0.01, y))
  // Sien y patilla: delante de la oreja el pelo baja hasta la patilla.
  const yT = lerp(0.0, 0.05, suave(0.028, 0.058, z))
  const wT = suave(0.045, 0.06, ax) * suave(0.015, 0.03, z)
  const mSien = 1 - wT * (1 - suave(yT - 0.012, yT + 0.01, y))
  // Alrededor de la oreja: un hueco con su forma (más 1 cm).
  const dOreja = ((y - 0.006) / 0.043) ** 2 + ((z + 0.008) / 0.03) ** 2
  const mOreja = 1 - suave(0.05, 0.065, ax) * suave(1.3, 0.75, dOreja)
  // Nuca
  let yNuca = -0.072
  if (estilo === "largo" || estilo === "melena_bob") yNuca = -0.2
  if (estilo === "rubio_tupe") yNuca = -0.112
  const mNuca = 1 - suave(0.02, -0.02, z) * (1 - suave(yNuca - 0.012, yNuca + 0.012, y))
  // Debajo de la oreja y por delante de la nuca (la mandíbula): sin pelo.
  const mBajo = 1 - suave(0.0, -0.025, y) * suave(-0.03, 0.0, z)
  const larga = estilo === "largo" || estilo === "melena_bob"
  let m = mFrente * mSien * (larga ? 1 : mOreja) * mNuca * (larga ? 1 : mBajo)
  m = clamp(m, 0, 1)
  const enLado = suave(0.045, 0.06, ax)
  const arriba = suave(-0.02, 0.07, y)
  const atras = suave(0.01, -0.07, z)
  let g = 0.008
  switch (estilo) {
    case "calvo": {
      // Herradura (si hay barba de sabio) o nada.
      if (!conBarbaLarga) return [0, 0]
      const corona = suave(0.035, 0.02, y)
      return [m * corona * suave(-0.03, 0.0, -z + 0.02 * 0) * (ax > 0.03 || z < 0 ? 1 : 0), 0.004 + 0.003 * atras]
    }
    case "rapado":
      return [m, 0.0018]
    case "corto":
      g = 0.004 + 0.008 * arriba + 0.002 * atras
      break
    case "peinado_lado":
      g = 0.007 + 0.013 * arriba + 0.004 * suave(-0.02, 0.04, x) * arriba
      // Raya al costado
      g -= 0.008 * campana(x, 0.026, 0.0045) * suave(-0.02, 0.04, z) * arriba
      break
    case "peinado_atras":
      g = 0.006 + 0.01 * arriba + 0.006 * campana(z, 0.06, 0.03) * arriba + 0.003 * atras
      break
    case "rubio_tupe":
      // Volumen al frente y arriba, peinado hacia atrás y al costado; largo hasta el cuello.
      g = 0.01 + 0.018 * arriba + 0.022 * campana(z, 0.055, 0.035) * suave(0.02, 0.07, y) + 0.008 * suave(-0.04, 0.03, x) * arriba + 0.008 * atras * suave(-0.12, -0.02, y) + 0.006 * enLado
      break
    case "largo":
      g = 0.008 + 0.006 * arriba + 0.02 * suave(0.0, -0.1, y) * (1 - campana(z, 0.08, 0.03))
      // Raya al medio
      g -= 0.004 * campana(x, 0, 0.004) * suave(0.0, 0.05, z) * arriba
      break
    case "rizado":
      g = 0.013 + 0.008 * arriba + 0.004 * atras
      break
    case "rizado_voluminoso":
      g = 0.022 + 0.022 * arriba + 0.01 * atras + 0.012 * enLado
      break
    case "melena_bob":
      g = 0.01 + 0.006 * arriba + 0.014 * suave(0.02, -0.06, y) * (1 - campana(z, 0.09, 0.025)) + 0.004 * atras
      break
  }
  // Patillas y costados bajos: el pelo se pega a la cabeza (sin "casco").
  g *= lerp(1, lerp(0.12, 1, suave(0.0, 0.06, y)), enLado * suave(-0.03, 0.02, z))
  return [m, Math.max(0.0015, g)]
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
