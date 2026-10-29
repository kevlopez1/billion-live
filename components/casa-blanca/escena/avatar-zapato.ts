// ──────────────────────────────────────────────────────────────
// Zapatos por horma.
//
// Cada zapato son dos piezas: la SUELA (un anillo extruido que sobresale unos
// milímetros del corte: la vira) y el CORTE (la capellada, del borde de la suela
// por encima del pie). Las dos se arman a lo largo del pie desde el talón hasta
// la punta y se cierran solas: en el talón y en la punta el ancho baja a cero
// (puntera redonda, sin tapas en abanico). La horma cambia por tipo: oxford,
// charol, botín, bota, zapatilla, mocasín, zapato renacentista y el de punta
// levantada. Detalles por color de vértice (puntera, ojalillos, mediasuela,
// costura del mocasín) y cordones como plaquitas sobre el empeine. La tela
// (cuero, charol, gamuza, malla, suela) va en el atributo de la ropa: el
// barniz del cuero de vestir sale del mismo material, sin llamadas de más.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { H, type Cuerpo } from "./avatar-cuerpo"
import { campana, clamp, escalarRGBA, lerp, rgba, suave, tablaSuave, type Lote, type Mat2, type Pesos, type RGBA } from "./avatar-geo"
import { TELA } from "./avatar-texturas"

export type TipoZapato = "oxford" | "charol" | "botin" | "bota" | "zapatilla" | "mocasin" | "renacentista" | "punta"

export interface Zapato {
  tipo: TipoZapato
  /** Corte (capellada). */
  color: string
  /** Suela (o mediasuela de la zapatilla). */
  suela?: string
  /** Detalle: puntera, logo lateral o costura (por defecto, el corte algo más oscuro). */
  detalle?: string
}

/** Pie: [z desde el talón (m), medio ancho, y abajo, y arriba] (la misma tabla que avatar-cuerpo). */
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

interface Horma {
  /** Largo del zapato / largo del pie. */
  largo: number
  /** Holgura del corte sobre el pie (m). */
  holg: number
  /** Vira: cuánto sobresale la suela del corte (m). */
  vira: number
  /** Alto de la suela bajo el talón y bajo la planta (m). */
  taco: number
  planta: number
  /** Puntera: dónde empieza a redondear (0..1), exponente del contorno y alto de la punta. */
  pBola: number
  pExp: number
  altoPunta: number
  /** Levante de la punta (m). */
  levante: number
  /** Alto del borde en el talón (m). */
  collar: number
  /** Hundimiento de la suela bajo el arco (enfranque, m). */
  arco: number
  cordones: number
  tela: number
  telaSuela: number
  rug: number
}

const HORMAS: Record<TipoZapato, Horma> = {
  oxford: { largo: 1.06, holg: 0.004, vira: 0.0028, taco: 0.024, planta: 0.009, pBola: 0.74, pExp: 0.75, altoPunta: 0.03, levante: 0.011, collar: 0.062, arco: 0.007, cordones: 5, tela: TELA.cuero, telaSuela: TELA.suela, rug: 0.4 },
  charol: { largo: 1.065, holg: 0.004, vira: 0.0024, taco: 0.024, planta: 0.009, pBola: 0.72, pExp: 0.7, altoPunta: 0.028, levante: 0.012, collar: 0.06, arco: 0.007, cordones: 5, tela: TELA.charol, telaSuela: TELA.suela, rug: 0.14 },
  botin: { largo: 1.06, holg: 0.005, vira: 0.003, taco: 0.026, planta: 0.01, pBola: 0.74, pExp: 0.8, altoPunta: 0.026, levante: 0.01, collar: 0.11, arco: 0.006, cordones: 0, tela: TELA.cuero, telaSuela: TELA.suela, rug: 0.42 },
  bota: { largo: 1.06, holg: 0.006, vira: 0.0035, taco: 0.03, planta: 0.013, pBola: 0.76, pExp: 0.9, altoPunta: 0.03, levante: 0.01, collar: 0.11, arco: 0.004, cordones: 0, tela: TELA.cuero, telaSuela: TELA.suela, rug: 0.45 },
  zapatilla: { largo: 1.07, holg: 0.007, vira: 0.0045, taco: 0.03, planta: 0.019, pBola: 0.75, pExp: 0.95, altoPunta: 0.036, levante: 0.014, collar: 0.064, arco: 0, cordones: 6, tela: TELA.gamuza, telaSuela: TELA.suela, rug: 0.85 },
  mocasin: { largo: 1.055, holg: 0.004, vira: 0.0022, taco: 0.02, planta: 0.008, pBola: 0.74, pExp: 0.85, altoPunta: 0.026, levante: 0.01, collar: 0.05, arco: 0.006, cordones: 0, tela: TELA.cuero, telaSuela: TELA.suela, rug: 0.38 },
  renacentista: { largo: 1.05, holg: 0.005, vira: 0.0015, taco: 0.006, planta: 0.006, pBola: 0.72, pExp: 1.1, altoPunta: 0.03, levante: 0.006, collar: 0.07, arco: 0, cordones: 0, tela: TELA.cuero, telaSuela: TELA.suela, rug: 0.6 },
  punta: { largo: 1.08, holg: 0.005, vira: 0.002, taco: 0.012, planta: 0.012, pBola: 0.7, pExp: 0.85, altoPunta: 0.026, levante: 0.03, collar: 0.055, arco: 0, cordones: 0, tela: TELA.fieltro, telaSuela: TELA.suela, rug: 0.9 },
}

const COLS_CORTE = 11
const COLS_SUELA = 7
/** Filas a lo largo (0 = detrás del talón, 1 = punta), más densas en el talón y la puntera. */
const FILAS_T = [0, 0.03, 0.08, 0.15, 0.25, 0.35, 0.47, 0.6, 0.7, 0.78, 0.8, 0.86, 0.92, 0.965, 1]

const _p = new THREE.Vector3()

/** Arma un par de zapatos en el lote. Devuelve los triángulos agregados. */
export function armarZapatos(L: Lote, cu: Cuerpo, z: Zapato): number {
  const t0 = L.triangulos
  for (const lado of [1, -1] as const) zapato(L, cu, lado, z)
  return L.triangulos - t0
}

function zapato(L: Lote, cu: Cuerpo, lado: 1 | -1, z: Zapato) {
  const s = cu.s
  const h = HORMAS[z.tipo]
  const Ld = lado > 0 ? "I" : "D"
  const tob = cu.j[`tobillo${Ld}`]
  const pun = cu.j[`punta${Ld}`]
  const fem = cu.fem ? 0.9 : 1
  const largoPie = 0.268 * s
  const Ls = largoPie * h.largo + 0.006 * s
  const zh = -0.007 * s
  const giro = lado * 0.1
  const cg = Math.cos(giro)
  const sg = Math.sin(giro)
  const z0 = tob.z - 0.062 * s
  const col = rgba(z.color)
  const colSuela = rgba(z.suela ?? (z.tipo === "zapatilla" ? "#ececea" : "#2a1d16"))
  const colDet = rgba(z.detalle ?? "#000000")
  const usaDet = !!z.detalle
  const oscuro = escalarRGBA(col, 0.72)
  const mat: Mat2 = [h.rug, 0]
  const matSuela: Mat2 = [z.tipo === "zapatilla" ? 0.75 : 0.62, 0]

  // Perfiles a lo largo del zapato (t = 0 talón .. 1 punta).
  const zPie = (t: number) => zh + t * Ls
  const anchoPie = (t: number) => tablaSuave(PIE, clamp(zPie(t), 0, 0.93 * largoPie) / s, 1) * s * fem
  /** Medio ancho del corte en planta: talón redondo y puntera según la horma. */
  const W = (t: number) => {
    let w = anchoPie(t) + h.holg * s
    if (t < 0.13) w *= Math.sqrt(Math.max(0, 1 - ((0.13 - t) / 0.13) ** 2))
    if (t > h.pBola) w *= Math.pow(Math.max(0, 1 - ((t - h.pBola) / (1 - h.pBola)) ** 2), 0.5 * h.pExp)
    return Math.max(w, 0)
  }
  /** Lado de adentro algo más recto: la puntera se corre hacia el dedo gordo. */
  const corrX = (t: number) => -lado * 0.006 * s * suave(0.55, 0.95, t)
  /** Abajo de la suela: plano en el piso, enfranque bajo el arco, punta levantada. */
  const yAbajo = (t: number) => h.arco * s * suave(0.22, 0.3, t) * suave(0.58, 0.48, t) + h.levante * s * Math.pow(suave(0.7, 1, t), 1.6)
  /** Arriba de la suela (= abajo del corte): el taco en el talón. */
  const ySuela = (t: number) => yAbajo(t) + lerp(h.taco, h.planta, suave(0.22, 0.32, t)) * s * (z.tipo === "zapatilla" ? 1 : 1)
  /** Arriba del corte: el empeine del pie + holgura; collar en el talón; puntera que baja. */
  const yArriba = (t: number) => {
    const zp = clamp(zPie(t), 0, largoPie)
    let y = tablaSuave(PIE, zp / s, 3) * s + h.holg * s + 0.008 * s + 0.005 * s * campana(t, 0.4, 0.12)
    // Talón: el borde del zapato a la altura del collar (o la caña, que sigue arriba).
    y = Math.min(y, lerp(h.collar * s, y, suave(0.12, 0.3, t)))
    // Puntera: baja redondeada hasta la suela.
    const base = ySuela(t)
    if (t > h.pBola - 0.05) {
      const q = clamp((t - (h.pBola - 0.05)) / (1.05 - h.pBola), 0, 1)
      const alto = lerp(Math.max(Math.min(y - base, h.altoPunta * s + 0.014 * s), h.altoPunta * s), h.altoPunta * s * 0.55, q * q)
      y = base + alto * Math.pow(Math.max(0, 1 - q ** 4), 0.4)
    }
    return Math.max(y, base + 0.002 * s)
  }
  const aMundo = (x: number, y: number, t: number, out: THREE.Vector3) => {
    const zl = z0 + zPie(t)
    return out.set(tob.x + lado * 0.004 * s + (x + corrX(t)) * cg + (zl - tob.z) * sg, Math.max(0, y), zl)
  }
  const pesos = (t: number): Pesos => {
    const zl = z0 + zPie(t)
    const bola = suave(pun.z - 0.035 * s, pun.z + 0.01 * s, zl)
    const p: Pesos = [[H[`tobillo${Ld}`], 1 - bola]]
    if (bola > 0.001) p.push([H[`punta${Ld}`], bola])
    return p
  }

  // ── Suela: anillo de 7 puntos (canto, bisel y fondo plano) ──
  L.exPorDefecto(h.telaSuela)
  const idsS: number[][] = []
  const centrosS: THREE.Vector3[] = []
  for (const t of FILAS_T) {
    const w = W(t) + h.vira * s * Math.min(1, W(t) / (0.01 * s))
    const yb = yAbajo(t)
    const yt = ySuela(t)
    const e = Math.min(0.002 * s, w * 0.5)
    const pts: Array<[number, number]> = [[-w, yt], [-w, yb + e], [-w + e, yb], [w - e, yb], [w, yb + e], [w, yt], [0, yt + 0.002 * s]]
    const fila: number[] = []
    const pw = pesos(t)
    for (let k = 0; k < COLS_SUELA; k++) {
      const [x, y] = pts[k]
      aMundo(x, y, t, _p)
      // Canto de la suela de vestir: un tono más claro arriba (la vira encerada).
      const c = k === 0 || k === 5 ? escalarRGBA(colSuela, z.tipo === "zapatilla" ? 1 : 1.35) : colSuela
      fila.push(L.v(_p.x, _p.y, _p.z, (k / COLS_SUELA) * 0.2, zPie(t), c, pw, matSuela))
    }
    idsS.push(fila)
    centrosS.push(aMundo(0, (yb + yt) / 2, t, new THREE.Vector3()))
  }
  L.tiras(idsS, true, { centros: centrosS })
  L.pieza()

  // ── Corte: de un borde de la suela, por arriba, al otro ──
  L.exPorDefecto(h.tela)
  const idsC: number[][] = []
  const centrosC: THREE.Vector3[] = []
  for (const t of FILAS_T) {
    const w = W(t)
    const yb = ySuela(t)
    const yt = yArriba(t)
    const fila: number[] = []
    const pw = pesos(t)
    for (let k = 0; k <= COLS_CORTE; k++) {
      const f = (k / COLS_CORTE) * Math.PI
      const c = Math.cos(f)
      const sn = Math.sin(f)
      // Sección: costados casi verticales (superelipse) y empeine redondo.
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), 0.7)
      const y = yb + (yt - yb) * Math.pow(sn, 0.55)
      aMundo(x, y, t, _p)
      fila.push(L.v(_p.x, _p.y, _p.z, f * w, zPie(t), colorCorte(z.tipo, t, f, col, oscuro, colDet, usaDet, lado), pw, mat))
    }
    idsC.push(fila)
    centrosC.push(aMundo(0, (yb + yt) * 0.5, t, new THREE.Vector3()))
  }
  L.tiras(idsC, false, { centros: centrosC })
  L.pieza()

  // ── Cordones: plaquitas cruzadas sobre el empeine ──
  if (h.cordones > 0) {
    const cc = z.tipo === "zapatilla" ? escalarRGBA(col, 1.08) : escalarRGBA(col, 0.6)
    const tA = 0.27
    const tB = 0.47
    for (let i = 0; i < h.cordones; i++) {
      const t = lerp(tA, tB, i / (h.cordones - 1))
      const w = W(t)
      const yt = yArriba(t) + 0.0015 * s
      const ab = (0.32 - 0.08 * (i / h.cordones)) * w
      const d = 0.0022 * s
      const pw = pesos(t)
      const q: number[] = []
      for (const [x, dt] of [[-ab, -1], [ab, -1], [ab, 1], [-ab, 1]] as const) {
        aMundo(x, yt - 0.25 * Math.abs(x) * 0.4, t + (dt * d) / Ls, _p)
        q.push(L.v(_p.x, _p.y, _p.z, 0, 0, cc, pw, [0.8, 0]))
      }
      L.q(q[0], q[3], q[2], q[1])
    }
    L.pieza()
  }
}

/** Color del corte por zona: puntera, ojalillos, mediasuela, logo, costura del mocasín. */
function colorCorte(tipo: TipoZapato, t: number, f: number, col: RGBA, oscuro: RGBA, det: RGBA, usaDet: boolean, lado: 1 | -1): RGBA {
  const arriba = Math.sin(f)
  // Lateral (afuera) del pie: f cerca de 0 para el izquierdo (+x), de pi para el derecho.
  const afuera = lado > 0 ? Math.cos(f) : -Math.cos(f)
  switch (tipo) {
    case "oxford":
    case "charol":
      // Costura de la puntera (cap toe) y los ojalillos a los dos lados de los cordones.
      if (Math.abs(t - 0.79) < 0.012 && arriba > 0.2) return oscuro
      if (t > 0.24 && t < 0.5 && Math.abs(Math.cos(f)) < 0.42 && Math.abs(Math.cos(f)) > 0.3) return escalarRGBA(col, 0.8)
      return col
    case "zapatilla": {
      // Logo lateral (la "N") y refuerzo del talón.
      if (usaDet && afuera > 0.35 && t > 0.33 && t < 0.62 && arriba < 0.85) return det
      if (t < 0.12 && arriba < 0.9) return escalarRGBA(col, 0.82)
      if (t > 0.86) return escalarRGBA(col, 0.9)
      return col
    }
    case "mocasin":
      // Costura en U del empeine (mocasín) y antifaz.
      if (t > 0.5 && t < 0.86 && Math.abs(Math.cos(f)) < 0.62 && Math.abs(Math.abs(Math.cos(f)) - 0.55) < 0.06) return oscuro
      if (Math.abs(t - 0.45) < 0.02 && arriba > 0.4) return usaDet ? det : oscuro
      return col
    case "bota":
    case "botin":
      if (t < 0.1) return escalarRGBA(col, 0.85)
      return col
    default:
      return col
  }
}

/** El calzado de cada uno (de las fichas de investigación); el resto sale del tipo de ropa. */
const CALZADO: Record<string, Zapato> = {
  trump: { tipo: "oxford", color: "#0f0d0c" },
  thiel: { tipo: "oxford", color: "#121010" },
  mason: { tipo: "oxford", color: "#0e0d0d" },
  lincoln: { tipo: "botin", color: "#121112" },
  tate: { tipo: "charol", color: "#0a0a0b" },
  musk: { tipo: "bota", color: "#121212", suela: "#1a1817" },
  napoleon: { tipo: "bota", color: "#0e0e10", suela: "#1c1612" },
  jobs: { tipo: "zapatilla", color: "#8e8e8b", suela: "#ededed", detalle: "#7f8186" },
  altman: { tipo: "zapatilla", color: "#9a9ca0", suela: "#eeeeec", detalle: "#d8d8d6" },
  pichai: { tipo: "zapatilla", color: "#e6e6e3", suela: "#f2f2f0", detalle: "#b9bcc2" },
  karp: { tipo: "zapatilla", color: "#2b2f36", suela: "#e2e2e0", detalle: "#c43c2c" },
  amodei: { tipo: "zapatilla", color: "#2c2e33", suela: "#d9d9d6", detalle: "#55585e" },
  hormozi: { tipo: "zapatilla", color: "#151515", suela: "#1d1d1d", detalle: "#2e2e2e" },
  kobe: { tipo: "zapatilla", color: "#f2f2f0", suela: "#552583", detalle: "#fdb927" },
  gadzhi: { tipo: "mocasin", color: "#1a1311", suela: "#2a1d16", detalle: "#b9a46a" },
  leonardo: { tipo: "renacentista", color: "#3b2a1f", suela: "#2a1d16" },
  suntzu: { tipo: "punta", color: "#141414", suela: "#e8e4da" },
}

/** Calzado del personaje: el de la tabla o, si no está, uno según el tipo de ropa. */
export function calzadoDe(id: string, porDefecto: Zapato): Zapato {
  return CALZADO[id] ?? porDefecto
}
