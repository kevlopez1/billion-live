// ──────────────────────────────────────────────────────────────
// La ropa: capas que siguen al cuerpo.
//
// Cada prenda es la misma sección anatómica del cuerpo (avatar-cuerpo.ts)
// inflada a lo largo de su normal, con los músculos suavizados, más sus
// detalles: saco con solapas, cuello de camisa, corbata con nudo, botones,
// bolsillos, puños, pantalón con raya, zapatos con suela; túnicas y togas con
// pliegues; uniforme con charreteras; camiseta de básquet con número; y
// sombreros, gafas, reloj, collares y lo que lleva en la mano.
//
// Todo va en UN lote (un material por tejido): el color de cada prenda va en
// el vértice y la rugosidad/metal también. Los pesos de piel son los del
// cuerpo, así la ropa se dobla con él. La piel que queda tapada no se arma.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Apariencia, Personaje } from "../tipos"
import { ANG, Cuerpo, H, M, type Cobertura, type Marco } from "./avatar-cuerpo"
import { campana, clamp, escalarRGBA, lerp, Lote, rgba, suave, type Mat2, type Pesos, type RGBA } from "./avatar-geo"
import { peloEn } from "./avatar-cabeza"
import { vestuarioDe } from "./avatar-fichas"
import { estampar, MONTURA_ANDROIDE } from "./avatar-androide"
import { armarZapatos, calzadoDe, type TipoZapato } from "./avatar-zapato"
import { TELA, type Tejido } from "./avatar-texturas"

const DOS_PI = Math.PI * 2
const FRENTE = Math.PI / 2

/** Separación extra de los brazos según lo que viste (para que no atraviesen la ropa). */
export function holguraDe(ap: Apariencia): number {
  switch (ap.ropa.tipo) {
    case "traje":
    case "uniforme_militar":
      return 0.02
    case "tunica":
    case "toga":
    case "tunica_renacentista":
    case "vestido_egipcio":
      return 0.026
    case "cuello_alto":
    case "casual":
    case "androide":
    case "holograma":
      return 0.011
    default:
      return 0.008
  }
}

export interface Ropa {
  lote: Lote
  /** Lo que lleva en la mano (se esconde al sentarse o hacer deporte). */
  utileria: Lote | null
  lentes: { lote: Lote; sol: boolean } | null
  cobertura: Cobertura
  tejido: Tejido
  numero?: { texto: string; relleno: string; borde: string }
  /** Alto del sombrero sobre la coronilla (m), para la etiqueta. */
  altoSombrero: number
  /** Oscuridad de la sombra de barba en la piel (0..1). */
  sombraBarba: number
}

const MAT_LANA: Mat2 = [0.82, 0]
const MAT_ALGODON: Mat2 = [0.9, 0]
const MAT_CUERO: Mat2 = [0.32, 0]
// (0,36 -> 0,46: a la hora dorada la diadema y los herrajes estallaban en un punto de luz)
const MAT_ORO: Mat2 = [0.46, 1]
const MAT_BOTON: Mat2 = [0.35, 0]

const _v = new THREE.Vector3()
const _n = new THREE.Vector3()
const _q = new THREE.Vector3()

/** Código de pliegue para aArr.y: tipo (1 manga, 2 pernera, 3 torso, 4 caída, 5 banda) + fuerza (0..2). */
const PL = (tipo: number, fuerza: number) => tipo + clamp(fuerza, 0, 1.98) * 0.5

/** Columnas de las prendas cerradas: 48, más densas al frente (bastan para la tela). */
const MR = 40
const ANG_R: number[] = (() => {
  const a = 0.55
  const out: number[] = []
  for (let j = 0; j < MR; j++) {
    const u = (2 * j) / MR - 1
    out.push(Math.PI / 2 + Math.PI * u * (a + (1 - a) * u * u))
  }
  return out
})()

/** Normaliza un ángulo al rango de ANG: [-π/2, 3π/2). */
function normAng(a: number): number {
  let x = (a + Math.PI / 2) % DOS_PI
  if (x < 0) x += DOS_PI
  return x - Math.PI / 2
}

/** Alturas (/H) de las filas de los hombros que comparten todas las prendas del tronco. */
const FILAS_HOMBRO = [0.79, 0.806, 0.818]

interface Anillo {
  xs: Float64Array
  zs: Float64Array
  nx: Float64Array
  nz: Float64Array
}

/** Arma prendas sobre un cuerpo. */
class Sastre {
  readonly cu: Cuerpo
  readonly lote = new Lote()
  readonly s: number
  readonly Hh: number
  private anillos = new Map<number, Anillo>()
  /** Cobertura de la piel del tronco: cada pieza registra una función. */
  readonly tapaTronco: Array<(y: number, a: number) => boolean> = []
  readonly tapaCuello: Array<(y: number, a: number) => boolean> = []
  readonly tapaBrazo: Array<(lado: 1 | -1, u: number) => boolean> = []
  readonly tapaPierna: Array<(lado: 1 | -1, u: number) => boolean> = []

  /** Tela de lo que se arma ahora (capa de texTelas; va en el atributo aArr.x). */
  telaId: number = TELA.lana

  constructor(cu: Cuerpo) {
    this.cu = cu
    this.s = cu.s
    this.Hh = cu.H
    this.tela(TELA.lana)
  }

  /** Tela de las piezas que siguen (las que no traen pliegue propio). */
  tela(id: number) {
    this.telaId = id
    this.lote.exPorDefecto(id, 0, 0, 0)
  }

  private bases = new Map<number, number>()
  /** Borde de arriba de la última prenda del tronco que llega a los hombros (el cuello nace ahí). */
  topePrenda: ((a: number) => number) | null = null
  /**
   * Altura de la base del cuello en el ángulo a: la primera (desde 0,80·H) donde la
   * superficie del tronco queda a menos de 2 cm de la del cuello. Al frente es baja
   * (la horquilla del esternón); a los costados sube por el trapecio. Ahí nacen los
   * cuellos de las prendas: con una altura fija, a los costados la fila de abajo del
   * cuello caía en la punta del hombro y el cuello era un abanico que salía por
   * encima de la prenda (las "plumas" sobre los hombros).
   */
  baseCuello(a: number): number {
    const key = Math.round(normAng(a) * 400)
    const c = this.bases.get(key)
    if (c !== undefined) return c
    // Suavizada a lo largo del ángulo: sin eso, donde el hombro es casi plano la base
    // saltaba de golpe entre dos columnas y el cuello de la prenda hacía un escalón.
    const y = (this.baseCruda(a - 0.3) + 2 * this.baseCruda(a - 0.15) + 3 * this.baseCruda(a) + 2 * this.baseCruda(a + 0.15) + this.baseCruda(a + 0.3)) / 9
    this.bases.set(key, y)
    return y
  }

  private crudas = new Map<number, number>()
  private baseCruda(a: number): number {
    const key = Math.round(normAng(a) * 400)
    const c = this.crudas.get(key)
    if (c !== undefined) return c
    const Hh = this.Hh
    const cab = this.cu.cab
    const yN = 0.845 * Hh
    const q = this.puntoCuello(yN, a, 0, new THREE.Vector3())
    const yl = (yN - cab.c.y) / cab.hs
    const k = cab.cuello
    const zE = cab.c.z + lerp(k.z0, k.z1, clamp((yl - k.y0) / (k.y1 - k.y0), 0, 1)) * cab.hs
    const rQ = Math.hypot(q.x - cab.c.x, q.z - zE) + 0.02 * this.s
    const p = new THREE.Vector3()
    let y = 0.845 * Hh
    let dAnt = Infinity
    const paso = 0.002 * Hh
    for (let yy = 0.8 * Hh; yy < 0.845 * Hh; yy += paso) {
      this.punto(yy, a, 0.3, 0, p)
      const d = Math.hypot(p.x - cab.c.x, p.z - zE) - rQ
      if (d <= 0) {
        // Entre dos pasos, la altura donde la distancia cruza el umbral.
        y = Number.isFinite(dAnt) ? yy - paso * (-d / Math.max(1e-9, dAnt - d)) : yy
        break
      }
      dAnt = d
    }
    this.crudas.set(key, y)
    return y
  }

  /** Sección del tronco (con normales 2D). Debajo de la cadera, la de la cadera (faldas). */
  anillo(y: number, bultos: number): Anillo {
    // Cada 2 mm: las prendas comparten las secciones (y no se recalcula una por vértice).
    const iy = Math.round(Math.max(y, 0.5 * this.Hh) * 500)
    const yy = iy / 500
    const k = iy * 1000 + Math.round(bultos * 100)
    let r = this.anillos.get(k)
    if (r) return r
    const xs = new Float64Array(M)
    const zs = new Float64Array(M)
    this.cu.anilloTronco(yy, bultos, xs, zs)
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
    r = { xs, zs, nx, nz }
    this.anillos.set(k, r)
    return r
  }

  /** Punto de la superficie del tronco en (y, ángulo), inflado `holg` a lo largo de la normal. */
  punto(y: number, a: number, bultos: number, holg: number, out: THREE.Vector3, vuelo = 0): THREE.Vector3 {
    const an = normAng(a)
    let j = 0
    while (j < M - 1 && ANG[j + 1] <= an) j++
    const j2 = (j + 1) % M
    const a0 = ANG[j]
    const a1 = j2 === 0 ? ANG[0] + DOS_PI : ANG[j2]
    const t = clamp((an - a0) / (a1 - a0), 0, 1)
    const r = this.anillo(y, bultos)
    const x = lerp(r.xs[j], r.xs[j2], t)
    const z = lerp(r.zs[j], r.zs[j2], t)
    let nx = lerp(r.nx[j], r.nx[j2], t)
    let nz = lerp(r.nz[j], r.nz[j2], t)
    const l = Math.hypot(nx, nz) || 1
    nx /= l
    nz /= l
    // Pendiente de la superficie (hombros, pecho): la holgura va a lo largo de la
    // normal de verdad, no solo en horizontal, o la piel asoma en los hombros.
    let ny = 0
    if (y >= 0.5 * this.Hh) {
      const d = 0.006
      const r2 = this.anillo(y + d, bultos)
      const r1 = this.anillo(y - d, bultos)
      const dr = (lerp(r2.xs[j], r2.xs[j2], t) - lerp(r1.xs[j], r1.xs[j2], t)) * nx + (lerp(r2.zs[j], r2.zs[j2], t) - lerp(r1.zs[j], r1.zs[j2], t)) * nz
      ny = -clamp(dr / (2 * d), -4, 4)
      const k = 1 / Math.sqrt(1 + ny * ny)
      nx *= k
      nz *= k
      ny *= k
    }
    _n.set(nx, ny, nz)
    // Falda: por debajo de la cadera la sección se abre un poco.
    const f = 1 + vuelo
    return out.set(x * f + nx * holg, y + ny * holg, (z + 0.012 * this.s) * f - 0.012 * this.s + nz * holg)
  }

  /** u de una pierna a la altura y (en reposo). */
  uAltura(lado: 1 | -1, y: number): number {
    const c = this.cu.piernas[lado > 0 ? 0 : 1]
    for (let i = 0; i < c.pts.length - 1; i++) {
      const a = c.pts[i]
      const b = c.pts[i + 1]
      if (y <= a.y && y >= b.y) return lerp(c.u[i], c.u[i + 1], (a.y - y) / (a.y - b.y || 1))
    }
    return y > c.pts[0].y ? c.u[0] : c.largo
  }

  /** La pierna queda tapada por una falda hasta un poco arriba del ruedo. */
  tapaFalda(yRuedo: number) {
    for (const lado of [1, -1] as const) {
      const uR = this.uAltura(lado, yRuedo + 0.09 * this.s)
      this.tapaPierna.push((l, u) => l === lado && u < uR)
    }
  }

  /**
   * Pesos de una falda o faldón. La mitad de ATRÁS cuelga de la cadera y toma
   * cada vez más muslo hacia el ruedo (lo de siempre: al caminar se mece). La
   * mitad de ADELANTE va entera al muslo a la altura de la rodilla y, debajo,
   * pasa a la pierna (rodilla): sentado, la tela hace regazo sobre los muslos
   * y cae delante de las canillas. Antes todo tomaba como mucho 0,6 de muslo y,
   * con los muslos horizontales, la túnica se doblaba hacia atrás en "banana".
   */
  pesosFalda(x: number, y: number, z: number, yRuedo: number): Pesos {
    const yC = 0.5 * this.Hh
    if (y >= yC) return this.cu.pesosTronco(x, y, z)
    const s = this.s
    const izq = x >= 0
    const ML = izq ? H.musloI : H.musloD
    const MO = izq ? H.musloD : H.musloI
    const RL = izq ? H.rodillaI : H.rodillaD
    const RO = izq ? H.rodillaD : H.rodillaI
    const yK = (izq ? this.cu.j.rodillaI : this.cu.j.rodillaD).y
    // Atrás: cadera -> muslo (máx. 0,6) hacia el ruedo.
    const t = clamp((yC - y) / Math.max(0.05, yC - yRuedo), 0, 1)
    const wAtras = 0.6 * Math.pow(t, 0.8)
    // Adelante: muslo entero al llegar a la rodilla; debajo, la pierna.
    const frente = suave(-0.035 * s, 0.03 * s, z)
    const tk = clamp((yC - y) / Math.max(0.05, yC - yK), 0, 1)
    const wMus = lerp(wAtras, Math.pow(tk, 0.7), frente)
    const wRod = frente * 0.85 * clamp((yK - y) / (0.12 * this.Hh), 0, 1)
    const wPierna = wMus * (1 - wRod) // muslo
    const wCad = 1 - wMus
    // Reparto entre las dos piernas: mitad y mitad en el centro y, hacia el costado,
    // a la altura de la rodilla (8,5 cm), 0,92 la de su lado. (Antes, a 6 cm del centro todo iba a una pierna: al
    // caminar el panel delantero se partía en dos "perneras" con un hueco entre ellas.)
    const a = 0.5 + 0.42 * suave(0, 0.085 * s, Math.abs(x))
    const b = 1 - a
    const p: Pesos = [[H.cadera, wCad]]
    if (wPierna * a > 0.001) p.push([ML, wPierna * a])
    if (wMus * wRod * a > 0.001) p.push([RL, wMus * wRod * a])
    if (wPierna * b > 0.001) p.push([MO, wPierna * b])
    if (wMus * wRod * b > 0.001) p.push([RO, wMus * wRod * b])
    return p
  }

  /**
   * Prenda del tronco: filas de abajo arriba; `arco(y)` = [a0, a1] si es abierta
   * (saco, chaleco), null si da la vuelta entera.
   */
  tronco(op: {
    y0: number
    y1: number
    paso?: number
    arco?: (y: number) => [number, number] | null
    holgura: (y: number, a: number) => number
    bultos?: number
    color: (y: number, a: number) => RGBA
    mat: Mat2 | ((y: number, a: number) => Mat2)
    vuelo?: (y: number) => number
    pliegues?: (y: number, a: number) => number
    cols?: number
    tope?: (a: number) => number
    tapa?: boolean
    /** Pliegue: código (tipo + 0,5·fuerza; 3 = torso, 4 = caída). */
    pl?: number
    /** Ondas del ruedo (m, por ángulo): se apagan hacia arriba. */
    ruedo?: (a: number) => number
    /** false: el borde de arriba no sube por el trapecio hasta la base del cuello. */
    alCuello?: boolean
    /**
     * false: filas repartidas hasta el borde en cada ángulo, sin las filas fijas de los
     * hombros (prendas sin nada encima cuyo borde baja mucho, como la musculosa: con la
     * grilla, el ribete de la sisa quedaba entre dos filas y salía dentado).
     */
    grilla?: boolean
  }) {
    const L = this.lote
    const Hh = this.Hh
    const bultos = op.bultos ?? 0.35
    const paso = (op.paso ?? 0.026) * this.s
    const abierta = !!op.arco
    const cols = abierta ? op.cols ?? 44 : MR
    // Borde de arriba en cada ángulo. Si la prenda llega a los hombros, sube por el
    // trapecio hasta la base del cuello (ahí nace su cuello): si no, entre el borde
    // y el cuello de la prenda quedaba un escalón de piel o una aleta.
    const alto = op.alCuello !== false
    const topeDe = (a: number) => {
      const t = op.tope ? Math.min(op.y1, op.tope(a)) : op.y1
      if (!alto || t < 0.81 * Hh) return t
      return t + Math.max(0, this.baseCuello(a) - t) * suave(0.81 * Hh, 0.826 * Hh, t)
    }
    // El cuello que se arme después nace en este borde (sin escalón de piel entre los dos).
    if (op.y1 >= 0.8 * Hh) this.topePrenda = topeDe
    // Filas: parejas hasta 0,77·H y, en los hombros, a alturas FIJAS que comparten
    // todas las prendas. Con filas propias (cada 4–7 cm, a otra altura en cada capa)
    // la cuerda de la de abajo cortaba la curva del hombro por fuera de la de arriba
    // y asomaba en astillas sobre la silueta.
    const grilla = op.grilla !== false && paso > 0.015 * this.s
    const yCorte = grilla ? Math.min(op.y1, 0.77 * Hh) : op.y1
    const nU = Math.max(grilla && op.y1 > 0.78 * Hh ? 1 : 2, Math.ceil((yCorte - op.y0) / paso))
    const niveles: number[] = []
    for (let i = 0; i <= nU; i++) niveles.push(lerp(op.y0, yCorte, i / nU))
    if (grilla && op.y1 > 0.78 * Hh) {
      for (const g of FILAS_HOMBRO) if (g * Hh > yCorte + 0.004 * Hh) niveles.push(g * Hh)
      niveles.push(Infinity)
    }
    const nF = niveles.length
    const ids: number[][] = []
    const llenas: boolean[][] = []
    const centros: THREE.Vector3[] = []
    for (let i = 0; i < nF; i++) {
      const t = i / (nF - 1)
      const fila: number[] = []
      const llena: boolean[] = []
      let cz = 0
      const yN = Math.min(niveles[i], op.y1)
      const arc = op.arco ? op.arco(yN) : null
      // Cerrada: la última columna repite la primera (una vuelta entera de ángulo):
      // las UV y los pliegues siguen sin salto en la costura de la espalda.
      for (let k = 0; k <= cols; k++) {
        const a = arc ? lerp(arc[0], arc[1], k / cols) : k === cols ? ANG_R[0] + DOS_PI : ANG_R[k]
        const top = topeDe(a)
        let y: number
        if (!grilla) y = op.tope ? lerp(op.y0, top, t) : lerp(op.y0, op.y1, t)
        else if (top <= yCorte + 0.004 * Hh) y = i <= nU ? lerp(op.y0, top, i / nU) : top
        else y = Math.min(niveles[i], top)
        llena.push(y >= top - 1e-6)
        if (op.ruedo && t < 0.5) y += op.ruedo(a) * (1 - 2 * t) * (1 - 2 * t)
        const vu = op.vuelo ? op.vuelo(y) : 0
        let h = op.holgura(y, a)
        if (op.pliegues) h += op.pliegues(y, a)
        this.punto(y, a, bultos, h, _v, vu)
        const c = op.color(y, a)
        const m = typeof op.mat === "function" ? op.mat(y, a) : op.mat
        const pw = y < 0.5 * Hh ? this.pesosFalda(_v.x, y, _v.z, op.y0) : this.cu.pesosTronco(_v.x, y, _v.z)
        fila.push(L.v(_v.x, _v.y, _v.z, a * 0.16, y, c, pw, m))
        if (op.pl) L.ex(this.telaId, op.pl, y / Hh, a)
        cz += _v.z
      }
      ids.push(fila)
      llenas.push(llena)
      centros.push(new THREE.Vector3(0, Number.isFinite(yN) ? yN : op.y1, cz / (cols + 1)))
    }
    // Sin los cuadriláteros que quedaron aplastados en el borde (filas ya en el tope).
    L.tiras(ids, false, { centros, emitir: (i, j) => !(llenas[i][j] && llenas[i][j + 1]) })
    L.pieza()
    if (op.tapa !== false) {
      const arco = op.arco
      const y0 = op.y0
      this.tapaTronco.push((y, a) => {
        if (y < y0 + 0.01 || y > topeDe(a) - 0.012) return false
        const ar = arco ? arco(y) : null
        if (!ar) return true
        const [a0, a1] = ar
        let x = normAng(a)
        while (x < a0) x += DOS_PI
        return x <= a1
      })
    }
  }

  /** Manga o pernera: anillos a lo largo del miembro, radios del cuerpo + holgura. */
  tubo(op: {
    cadena: "brazo" | "pierna"
    lado: 1 | -1
    u0: number
    u1: number
    paso?: number
    holgura: (u: number, a: number) => number
    color: (u: number, a: number) => RGBA
    mat: Mat2
    cols?: number
    tapa?: boolean
    tapaHasta?: number
    /** Pliegue: código (tipo + 0,5·fuerza; 1 = manga, 2 = pernera). */
    pl?: number
    /** Retoque del punto (u, ángulo, punto): el quiebre del pantalón sobre el zapato. */
    ajuste?: (u: number, a: number, out: THREE.Vector3) => void
  }) {
    const cu = this.cu
    const c = op.cadena === "brazo" ? cu.brazos[op.lado > 0 ? 0 : 1] : cu.piernas[op.lado > 0 ? 0 : 1]
    // (3,8 cm entre anillos: los pliegues finos van en el shader; con 3,2 cm sobraban triángulos)
    const paso = (op.paso ?? 0.038) * this.s
    const n = Math.max(2, Math.ceil((op.u1 - op.u0) / paso))
    const cols = op.cols ?? 16
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const m: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }
    // UV en metros: la vuelta mide el contorno del miembro a mitad de la pieza.
    const rm = op.cadena === "brazo" ? cu.radiosBrazo((op.u0 + op.u1) / 2) : cu.radiosPierna((op.u0 + op.u1) / 2)
    const vuelta = (Math.PI / 2) * (rm[0] + rm[1] + rm[2] + rm[3]) + 0.02
    const uRef = Math.max(0.05, c.u[2])
    // Anillos parejos, pero los dos más cercanos al codo o la rodilla se corren a ±3,5 cm
    // del hueso: la silueta doblada sale redonda (sin costo de triángulos).
    const us: number[] = []
    for (let i = 0; i <= n; i++) us.push(lerp(op.u0, op.u1, i / n))
    const uJ = c.u[2]
    if (n >= 4 && uJ > op.u0 + 0.06 * this.s && uJ < op.u1 - 0.06 * this.s) {
      for (const objetivo of [uJ - 0.035 * this.s, uJ + 0.035 * this.s]) {
        let k = 1
        for (let i = 1; i < n; i++) if (Math.abs(us[i] - objetivo) < Math.abs(us[k] - objetivo)) k = i
        if (us[k - 1] < objetivo - 0.01 * this.s && us[k + 1] > objetivo + 0.01 * this.s) us[k] = objetivo
      }
    }
    for (let i = 0; i <= n; i++) {
      const u = us[i]
      c.marco(u, m)
      const r = op.cadena === "brazo" ? cu.radiosBrazo(u) : cu.radiosPierna(u)
      const fila: number[] = []
      // La última columna repite la primera (costura sin salto de UV ni de pliegues).
      for (let k = 0; k <= cols; k++) {
        const a = (k / cols) * DOS_PI
        const h = op.holgura(u, a)
        Cuerpo.puntoAnillo(m, [r[0] + h, r[1] + h, r[2] + h, r[3] + h], a, 2.2, _v)
        if (op.ajuste) op.ajuste(u, a, _v)
        const pw = op.cadena === "brazo" ? cu.pesosBrazo(op.lado, u) : cu.pesosPierna(op.lado, u, Math.sin(a))
        fila.push(this.lote.v(_v.x, _v.y, _v.z, (k / cols) * vuelta, u, op.color(u, a), pw, op.mat))
        if (op.pl) this.lote.ex(this.telaId, op.pl, u / uRef, a)
      }
      ids.push(fila)
      centros.push(m.c.clone())
    }
    this.lote.tiras(ids, false, { centros })
    this.lote.pieza()
    if (op.tapa !== false) {
      const u0 = op.u0
      const u1 = op.tapaHasta ?? op.u1
      const lado = op.lado
      // Lo que queda por encima de una manga o pernera está dentro del tronco vestido.
      if (op.cadena === "brazo") this.tapaBrazo.push((l, u) => l === lado && u <= u1 - 0.01 && (u0 < 0.05 || u >= u0 + 0.005))
      else this.tapaPierna.push((l, u) => l === lado && u <= u1 - 0.01 && (u0 < 0.05 || u >= u0 + 0.005))
    }
  }

  /** Punto del cuello (piel) a la altura y (avatar) y ángulo a, inflado `holg`. */
  puntoCuello(y: number, a: number, holg: number, out: THREE.Vector3): THREE.Vector3 {
    const cab = this.cu.cab
    const yl = (y - cab.c.y) / cab.hs
    const k = cab.cuello
    const zEje = lerp(k.z0, k.z1, clamp((yl - k.y0) / (k.y1 - k.y0), 0, 1))
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const t = cab.rayo(0, yl, zEje, dx, 0, dz, 0.14)
    cab.normal(dx * t, yl, zEje + dz * t, _n)
    cab.aAvatar(dx * t, yl, zEje + dz * t, out)
    // Normal horizontal: el cuello de la prenda no se abre hacia arriba.
    const l = Math.hypot(_n.x, _n.z) || 1
    return out.add(_n.set((_n.x / l) * holg, 0, (_n.z / l) * holg))
  }

  /** Banda alrededor del cuello (cuello de camisa, de saco, cuello alto). */
  cuello(op: { y0: number; y1: (a: number) => number; arco?: [number, number]; holg0: number; holg1: number; color: RGBA; mat: Mat2; filas?: number; cols?: number; tapa?: boolean }) {
    const filas = op.filas ?? 3
    const abierta = !!op.arco
    const cols = op.cols ?? (abierta ? 32 : MR)
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const cab = this.cu.cab
    // La banda nace en la base del cuello de ese ángulo (ver baseCuello) y la fila de
    // abajo va sobre el tronco, donde termina la prenda; las de arriba, sobre el cuello.
    const tp = this.topePrenda
    const yA = (a: number) => {
      const y = Math.max(op.y0, this.baseCuello(a) - 0.002 * this.Hh)
      return tp ? Math.min(y, Math.max(op.y0, tp(a))) : y
    }
    const yB = (a: number) => Math.max(op.y1(a), yA(a) + 0.006 * this.Hh)
    for (let i = 0; i <= filas; i++) {
      const t = i / filas
      const fila: number[] = []
      for (let k = 0; k < (abierta ? cols + 1 : cols); k++) {
        const a = op.arco ? lerp(op.arco[0], op.arco[1], k / cols) : ANG_R[k]
        const y = lerp(yA(a), yB(a), t)
        const h = lerp(op.holg0, op.holg1, t)
        // Del tronco al cuello sin escalón: entre 0,818 y 0,834·H se mezclan los dos
        // (con el corte seco en 0,826, donde el borde del escote cruzaba esa altura
        // la banda saltaba de una superficie a la otra y el escote salía dentado).
        const kN = i === 0 ? 0 : suave(0.818 * this.Hh, 0.834 * this.Hh, y)
        if (kN < 1) this.punto(y, a, 0.3, h, _v)
        if (kN > 0) {
          // (el cuello se mide desde 0,834·H para abajo en vertical: más abajo la forma del
          // cuello no está definida y el rayo devolvía radios irregulares —borde mordido—)
          const yC = Math.max(y, 0.834 * this.Hh)
          this.puntoCuello(yC, a, h, _q)
          _q.y -= yC - y
          if (kN < 1) _v.lerp(_q, kN)
          else _v.copy(_q)
        }
        const l = (y - cab.c.y) / cab.hs
        const pw: Pesos = i === 0 || kN < 0.5 ? this.cu.pesosTronco(_v.x, y, _v.z) : this.cu.pesosCabeza(new THREE.Vector3(_v.x, l, 0))
        fila.push(this.lote.v(_v.x, _v.y, _v.z, a * 0.1, y, op.color, pw, op.mat))
      }
      ids.push(fila)
      centros.push(new THREE.Vector3(0, lerp(op.y0, op.y1(FRENTE), t), cab.c.z - 0.035 * this.s))
    }
    this.lote.tiras(ids, !abierta, { centros })
    // Canto superior: grosor de la tela hacia adentro.
    const top = ids[ids.length - 1]
    const filaIn: number[] = []
    for (let k = 0; k < top.length; k++) {
      const a = op.arco ? lerp(op.arco[0], op.arco[1], k / cols) : ANG_R[k]
      const y = yB(a)
      // (la misma mezcla tronco–cuello que la fila de arriba: si no, el canto salía
      // de otra superficie y el borde del cuello se veía mordido)
      const kN = suave(0.818 * this.Hh, 0.834 * this.Hh, y)
      if (kN < 1) this.punto(y, a, 0.3, 0.0005, _v)
      if (kN > 0) {
        const yC = Math.max(y, 0.834 * this.Hh)
        this.puntoCuello(yC, a, 0.0005, _q)
        _q.y -= yC - y
        if (kN < 1) _v.lerp(_q, kN)
        else _v.copy(_q)
      }
      const l = (y - cab.c.y) / cab.hs
      filaIn.push(this.lote.v(_v.x, _v.y, _v.z, 0, 0, escalarRGBA(op.color, 0.7), this.cu.pesosCabeza(new THREE.Vector3(0, l, 0)), op.mat))
    }
    this.lote.tiras([top, filaIn], !abierta, { invertir: true })
    this.lote.pieza()
    if (op.tapa) {
      const y1 = op.y1
      const arco = op.arco
      this.tapaCuello.push((y, a) => {
        if (y > y1(a) - 0.006) return false
        if (!arco) return true
        let x = normAng(a)
        while (x < arco[0]) x += DOS_PI
        return x <= arco[1]
      })
    }
  }

  /**
   * Una tira sobre una superficie: `pos(t, w)` da el punto (t a lo largo, w a
   * lo ancho, -1..1) y `n(t, w)` hacia dónde sobresale. Con grosor: dos caras y cantos.
   */
  tira(op: { filas: number; cols: number; pos: (t: number, w: number, out: THREE.Vector3) => THREE.Vector3; grosor: number; color: (t: number, w: number) => RGBA; mat: Mat2; pesos: (p: THREE.Vector3, t: number) => Pesos; normal: (t: number, w: number, out: THREE.Vector3) => THREE.Vector3; pl?: number; uvEscala?: number }) {
    const L = this.lote
    const caras: number[][][] = [[], []]
    // Vectores propios: los `normal` de las prendas llaman a S.punto, que escribe
    // en _v y _n (con _v compartido, la banda diagonal, las solapas y las
    // tapas de los bolsillos colapsaban en una línea sobre el cuerpo).
    const Q = new THREE.Vector3()
    const N = new THREE.Vector3()
    for (const cara of [0, 1]) {
      for (let i = 0; i <= op.filas; i++) {
        const t = i / op.filas
        const fila: number[] = []
        for (let k = 0; k <= op.cols; k++) {
          const w = (k / op.cols) * 2 - 1
          op.pos(t, w, Q)
          op.normal(t, w, N)
          if (cara === 0) Q.addScaledVector(N, op.grosor)
          fila.push(L.v(Q.x, Q.y, Q.z, w * 0.03 * (op.uvEscala ?? 1), t * 0.1 * (op.uvEscala ?? 1), op.color(t, w), op.pesos(Q, t), op.mat))
          if (op.pl) L.ex(this.telaId, op.pl, t, w)
        }
        caras[cara].push(fila)
      }
    }
    // Cara de afuera mira según la normal; la de adentro al revés. Se decide con un punto de referencia.
    op.pos(0.5, 0, Q)
    op.normal(0.5, 0, N)
    const lejos = Q.clone().addScaledVector(N, -1)
    const cerca = Q.clone().addScaledVector(N, 1)
    L.tiras(caras[0], false, { centros: caras[0].map(() => lejos) })
    L.tiras(caras[1], false, { centros: caras[1].map(() => cerca) })
    // Cantos (los cuatro bordes).
    const f = caras[0].length - 1
    const c = caras[0][0].length - 1
    // Centro de la tira: los cantos miran hacia afuera de él.
    let cx = 0, cy = 0, cz = 0, nn = 0
    for (const fila of caras[0]) for (const i of fila) { cx += L.pos[i * 3]; cy += L.pos[i * 3 + 1]; cz += L.pos[i * 3 + 2]; nn++ }
    cx /= nn; cy /= nn; cz /= nn
    const P = L.pos
    const borde = (a: number[], b: number[]) => {
      for (let k = 0; k < a.length - 1; k++) {
        const i0 = a[k], i1 = a[k + 1], i2 = b[k + 1]
        const e1x = P[i1 * 3] - P[i0 * 3], e1y = P[i1 * 3 + 1] - P[i0 * 3 + 1], e1z = P[i1 * 3 + 2] - P[i0 * 3 + 2]
        const e2x = P[i2 * 3] - P[i0 * 3], e2y = P[i2 * 3 + 1] - P[i0 * 3 + 1], e2z = P[i2 * 3 + 2] - P[i0 * 3 + 2]
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x
        const d = nx * (P[i0 * 3] - cx) + ny * (P[i0 * 3 + 1] - cy) + nz * (P[i0 * 3 + 2] - cz)
        if (d >= 0) L.q(a[k], a[k + 1], b[k + 1], b[k])
        else L.q(a[k], b[k], b[k + 1], a[k + 1])
      }
    }
    const col = (cara: number, k: number) => caras[cara].map((fila) => fila[k])
    borde(col(0, 0), col(1, 0))
    borde(col(1, c), col(0, c))
    borde(caras[1][0], caras[0][0])
    borde(caras[0][f], caras[1][f])
    L.pieza()
  }

  /** Cilindro chico (botón, remache) apoyado sobre un punto con su normal. */
  boton(p: THREE.Vector3, n: THREE.Vector3, r: number, alto: number, color: RGBA, mat: Mat2, pesos: Pesos, lados = 8) {
    const L = this.lote
    const u = new THREE.Vector3(0, 1, 0)
    if (Math.abs(n.y) > 0.9) u.set(1, 0, 0)
    const a = new THREE.Vector3().crossVectors(n, u).normalize()
    const b = new THREE.Vector3().crossVectors(n, a).normalize()
    const base: number[] = []
    const tope: number[] = []
    for (let k = 0; k < lados; k++) {
      const g = (k / lados) * DOS_PI
      _v.copy(p).addScaledVector(a, Math.cos(g) * r).addScaledVector(b, Math.sin(g) * r)
      base.push(L.v(_v.x, _v.y, _v.z, 0, 0, color, pesos, mat))
      _v.addScaledVector(n, alto)
      tope.push(L.v(_v.x, _v.y, _v.z, 0, 0, color, pesos, mat))
    }
    _v.copy(p).addScaledVector(n, alto * 1.25)
    const c = L.v(_v.x, _v.y, _v.z, 0, 0, color, pesos, mat)
    L.tiras([base, tope], true, { centros: [p, p] })
    for (let k = 0; k < lados; k++) L.t(c, tope[k], tope[(k + 1) % lados])
    // Orientar la tapa hacia afuera
    const i = L.nIdx - lados * 3
    const I = L.indices
    for (let k = 0; k < lados; k++) {
      const o = i + k * 3
      const pa = I[o], pb = I[o + 1], pc = I[o + 2]
      const P = L.pos
      const e1 = new THREE.Vector3(P[pb * 3] - P[pa * 3], P[pb * 3 + 1] - P[pa * 3 + 1], P[pb * 3 + 2] - P[pa * 3 + 2])
      const e2 = new THREE.Vector3(P[pc * 3] - P[pa * 3], P[pc * 3 + 1] - P[pa * 3 + 1], P[pc * 3 + 2] - P[pa * 3 + 2])
      if (e1.cross(e2).dot(n) < 0) {
        I[o + 1] = pc
        I[o + 2] = pb
      }
    }
    L.pieza()
  }

  /** Tubo fino a lo largo de una curva (cadena, cinta, montura de gafas). */
  cordon(pts: THREE.Vector3[], r: number, color: RGBA, mat: Mat2, pesos: (p: THREE.Vector3) => Pesos, cerrado: boolean, lados = 6) {
    const L = this.lote
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const n = pts.length
    const ref = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < n; i++) {
      const a = pts[cerrado ? (i - 1 + n) % n : Math.max(0, i - 1)]
      const b = pts[cerrado ? (i + 1) % n : Math.min(n - 1, i + 1)]
      const T = new THREE.Vector3().subVectors(b, a).normalize()
      const u = Math.abs(T.dot(ref)) > 0.9 ? new THREE.Vector3(1, 0, 0) : ref
      const A = new THREE.Vector3().crossVectors(T, u).normalize()
      const B = new THREE.Vector3().crossVectors(T, A).normalize()
      const fila: number[] = []
      const pw = pesos(pts[i])
      for (let k = 0; k < lados; k++) {
        const g = (k / lados) * DOS_PI
        _v.copy(pts[i]).addScaledVector(A, Math.cos(g) * r).addScaledVector(B, Math.sin(g) * r)
        fila.push(L.v(_v.x, _v.y, _v.z, k / lados, i / n, color, pw, mat))
      }
      ids.push(fila)
      centros.push(pts[i])
    }
    if (cerrado) ids.push(ids[0])
    L.tiras(ids, true, { centros: cerrado ? [...centros, centros[0]] : centros })
    L.pieza()
  }
}

// ── Vestir ────────────────────────────────────────────────────

const camisaColor = (ap: Apariencia) => ap.ropa.color2 ?? "#f2f2f0"

/** Arma la ropa completa de un personaje. */
export function vestir(cu: Cuerpo, p: Personaje): Ropa {
  const ap = p.apariencia
  const S = new Sastre(cu)
  const s = cu.s
  const Hh = cu.H
  const tipo = ap.ropa.tipo
  const C1 = rgba(ap.ropa.color)
  const C2 = rgba(ap.ropa.color2 ?? ap.ropa.color)
  let tejido: Tejido = "lana"
  let numero: Ropa["numero"]
  let utileria: Lote | null = null
  let lentes: Ropa["lentes"] = null
  let pieDescalzo = false
  let manos = false
  const negro = rgba("#141416")
  const cueroNegro = rgba("#0e0e10")

  const pantalon = (color: RGBA, op: { mezclilla?: boolean; ruedo?: number; holg?: number; corto?: number; hasta?: number; bajo?: number; tela?: number; bultos?: number } = {}) => {
    const holg = op.holg ?? 0.012
    const telaP = op.tela ?? (op.mezclilla ? TELA.mezclilla : TELA.lana)
    S.tela(telaP)
    const plP = PL(2, op.mezclilla ? 1.25 : telaP === TELA.jersey ? 1.1 : 0.75)
    // Entre las piernas, la piel del tronco no se ve.
    S.tapaTronco.push((y) => y < 0.6 * Hh - 0.012)
    // Cadera del pantalón: de la ingle a la cintura.
    // (bajo una prenda de arriba, la cadera empieza en la entrepierna: de 0,47 a 0,5 era
    // un panel plano entre los muslos que asomaba claro bajo el ruedo, como un pañal)
    S.tronco({
      y0: (op.bajo !== undefined ? 0.493 : 0.47) * Hh,
      y1: 0.6 * Hh,
      holgura: () => holg * 0.8,
      // (bajo un saco, la cadera del pantalón sigue al cuerpo como el saco: con 0,5 la
      // cola asomaba por debajo del ruedo en dientes)
      bultos: op.bultos ?? 0.5,
      color: (y, a) => (op.mezclilla && Math.abs(Math.cos(a)) > 0.985 ? escalarRGBA(color, 1.25) : color),
      mat: MAT_LANA,
      pl: PL(3, 0.6),
    })
    for (const lado of [1, -1] as const) {
      const c = cu.piernas[lado > 0 ? 0 : 1]
      // Largo: hasta el zapato (el ruedo se apoya en el empeine y cae 2 cm más atrás).
      const largo = !op.corto && !op.hasta
      const fin = op.corto ?? op.hasta ?? c.u[3] - 0.004 * s
      // Bajo una prenda suelta (remera, suéter): arriba de su ruedo el muslo se mete
      // 3 cm. (El tubo del muslo nace sobre la cadera y ahí es más ancho que el
      // tronco: asomaba por delante del ruedo en dos arcos, el "ruedo dentado".)
      const uB = op.bajo !== undefined ? S.uAltura(lado, op.bajo) : -1
      S.tubo({
        cadena: "pierna",
        lado,
        cols: 14,
        u0: -0.02 * s,
        u1: fin,
        holgura: (u, a) => {
          // Raya delantera, más holgado abajo, y el quiebre sobre el zapato.
          const raya = op.mezclilla || op.corto ? 0 : 0.006 * Math.pow(Math.max(0, Math.sin(a)), 24)
          const abajo = op.hasta ? 0 : suave(c.u[2] - 0.1 * s, c.u[3], u) * (op.corto ? 0.025 : 0.012)
          const quiebre = op.corto || op.hasta ? 0 : 0.008 * campana(u, fin - 0.035 * s, 0.015 * s) * (0.4 + 0.6 * Math.max(0, Math.sin(a))) + 0.012 * suave(fin - 0.05 * s, fin, u)
          const metido = uB > 0 ? 0.03 * suave(uB + 0.04 * s, uB, u) : 0
          return holg + raya + abajo + quiebre + (op.corto ? 0.012 : 0) - metido
        },
        color: (u, a) => (op.mezclilla && Math.abs(Math.cos(a)) > 0.95 ? escalarRGBA(color, 1.2) : color),
        mat: op.mezclilla ? [0.88, 0] : MAT_LANA,
        tapaHasta: fin - 0.02 * s,
        pl: plP,
        // Quiebre: atrás el ruedo baja hasta el talón; adelante se apoya en el empeine
        // y hace una onda horizontal (la tela que sobra sobre el zapato).
        ajuste: largo
          ? (u, a, P) => {
              const k = suave(fin - 0.07 * s, fin, u)
              if (k <= 0) return
              P.y -= 0.022 * s * k * Math.max(0, -Math.sin(a)) * Math.max(0, -Math.sin(a))
              P.y += 0.004 * s * k * Math.max(0, Math.sin(a))
              const onda = Math.sin(((fin - u) / (0.035 * s)) * Math.PI)
              P.y -= 0.004 * s * k * onda * Math.max(0, Math.sin(a))
            }
          : undefined,
      })
    }
  }

  const cinturon = (y: number, holg: number, bultos = 0.5) => {
    S.tela(TELA.cuero)
    S.tronco({ y0: y - 0.018 * s, y1: y, paso: 0.02, holgura: () => holg, bultos, color: () => cueroNegro, mat: MAT_CUERO, tapa: false })
    S.punto(y - 0.009 * s, FRENTE, bultos, holg + 0.002, _v)
    S.tela(TELA.liso)
    S.boton(_v.clone(), new THREE.Vector3(0, 0, 1), 0.011 * s, 0.003, rgba("#b9a46a"), MAT_ORO, cu.pesosTronco(0, y, 0.1), 4)
  }

  const hex = (c: RGBA) => "#" + new THREE.Color(c[0], c[1], c[2]).getHexString()
  /** Tipo de zapato que quedó (las medias y el quiebre del pantalón dependen de él). */
  let calzado: TipoZapato | null = null
  const zapatos = (color: RGBA, op: { suela?: RGBA; deportivo?: boolean } = {}) => {
    const z = calzadoDe(p.id, { tipo: op.deportivo ? "zapatilla" : "oxford", color: hex(color), suela: op.suela ? hex(op.suela) : undefined })
    calzado = z.tipo
    armarZapatos(S.lote, cu, z)
    S.tela(S.telaId)
  }
  /** Caña de bota o botín: del zapato hacia arriba (bajo el pantalón). */
  const cana = (color: RGBA, alto: number) => {
    S.tela(TELA.cuero)
    for (const lado of [1, -1] as const) {
      const c = cu.piernas[lado > 0 ? 0 : 1]
      S.tubo({ cadena: "pierna", lado, u0: c.u[3] - alto * s, u1: c.u[3] + 0.03 * s, paso: 0.035, cols: 12, holgura: (u) => 0.006 + 0.004 * suave(c.u[3] - 0.02 * s, c.u[3] + 0.03 * s, u), color: () => color, mat: [0.42, 0] })
    }
  }
  /** Medias: del zapato hasta media pantorrilla (lo que se ve entre el ruedo y el zapato al caminar). */
  const medias = (color: RGBA) => {
    S.tela(TELA.acanalado)
    for (const lado of [1, -1] as const) {
      const c = cu.piernas[lado > 0 ? 0 : 1]
      S.tubo({ cadena: "pierna", lado, u0: c.u[3] - 0.12 * s, u1: c.u[3] + 0.012 * s, paso: 0.04, cols: 10, holgura: () => 0.0022, color: () => color, mat: [0.9, 0] })
    }
  }

  const sandalias = (altas = false) => {
    pieDescalzo = true
    S.tela(TELA.cuero)
    if (altas) {
      // Tiras cruzadas que suben por la pantorrilla (calcei / caligae).
      for (const lado of [1, -1] as const) {
        const c = cu.piernas[lado > 0 ? 0 : 1]
        for (let k = 0; k < 4; k++) {
          const u = c.u[3] - (0.025 + k * 0.045) * s
          S.tubo({ cadena: "pierna", lado, u0: u - 0.012 * s, u1: u, paso: 0.012, cols: 12, holgura: () => 0.003, color: () => rgba("#6a4a30"), mat: MAT_CUERO, tapa: false })
        }
      }
    }
    const cuero = rgba("#6b4a2f")
    S.tela(TELA.cuero)
    for (const lado of [1, -1] as const) {
      // Suela fina debajo del pie y dos tiras encima.
      const Lp = lado > 0 ? "I" : "D"
      S.tira({
        filas: 8,
        cols: 2,
        grosor: 0.007,
        pos: (t, w, out) => {
          const z = t * cu.largoPie
          cu.puntoPie(lado, z, 0, 0.004, _v)
          const xd = _v.x
          cu.puntoPie(lado, z, Math.PI, 0.004, _v)
          const xi = _v.x
          return out.set(lerp(xi, xd, (w + 1) / 2), 0.0005, _v.z)
        },
        normal: (t, w, out) => out.set(0, 1, 0),
        color: () => escalarRGBA(cuero, 0.8),
        mat: MAT_CUERO,
        pesos: (pt, t) => (t > 0.72 ? [[H[`punta${Lp}`], 1]] : [[H[`tobillo${Lp}`], 1]]),
      })
      for (const z of [0.085, 0.17]) {
        const L = lado > 0 ? "I" : "D"
        const pts: THREE.Vector3[] = []
        for (let k = 0; k <= 10; k++) {
          const a = Math.PI * (k / 10)
          cu.puntoPie(lado, z * s, a - 0.0001, 0.0025, _v)
          pts.push(_v.clone())
        }
        S.cordon(pts, 0.0035 * s, cuero, MAT_CUERO, () => [[H[`tobillo${L}`], 1]], false, 5)
      }
    }
  }

  const mangas = (color: RGBA, hasta: number, holg: number, op: { ancha?: number; puno?: RGBA; mat?: Mat2; cols?: number; tela?: number; pl?: number; telaPuno?: number; botones?: RGBA } = {}) => {
    const telaM = op.tela ?? S.telaId
    for (const lado of [1, -1] as const) {
      S.tela(telaM)
      const c = cu.brazos[lado > 0 ? 0 : 1]
      const fin = Math.min(hasta, c.u[3] - 0.012 * s)
      S.tubo({
        cadena: "brazo",
        lado,
        u0: 0.022 * s,
        u1: fin,
        // (la copa de la manga nace casi pegada al brazo, por DENTRO de la prenda del
        // tronco: con 3/4 de la holgura asomaba en el hombro como una caja; el vuelo de
        // la manga ancha también crece desde el hombro, no desde la copa)
        holgura: (u, a) => holg * (0.35 + 0.65 * suave(0.0, 0.12 * s, u)) + (op.ancha ?? 0) * suave(c.u[2] - 0.1 * s, fin, u) * suave(0.01 * s, 0.11 * s, u) + 0.003 * campana(u, c.u[2] - 0.01 * s, 0.03 * s) * Math.max(0, -Math.sin(a)),
        color: () => color,
        mat: op.mat ?? MAT_LANA,
        cols: op.cols,
        pl: op.pl ?? PL(1, 0.8),
      })
      if (op.botones) {
        // Tres botones en la bocamanga, del lado de afuera y atrás.
        S.tela(TELA.liso)
        const mm: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }
        for (let i = 0; i < 3; i++) {
          const u = fin - (0.03 + i * 0.016) * s
          c.marco(u, mm)
          const r = cu.radiosBrazo(u)
          const h = holg + (op.ancha ?? 0) + 0.0015
          const a = -0.55
          Cuerpo.puntoAnillo(mm, [r[0] + h, r[1] + h, r[2] + h, r[3] + h], a, 2.2, _v)
          const P = _v.clone()
          S.boton(P, P.clone().sub(mm.c).normalize(), 0.0055 * s, 0.002, op.botones, MAT_BOTON, cu.pesosBrazo(lado, u), 5)
        }
        S.tela(telaM)
      }
      if (op.puno) {
        S.tela(op.telaPuno ?? TELA.popelina)
        S.tubo({ cadena: "brazo", lado, u0: fin - 0.02 * s, u1: fin + 0.012 * s, paso: 0.012, holgura: () => 0.005, color: () => op.puno!, mat: MAT_ALGODON, tapa: false })
      }
    }
  }

  const holgTraje = (y: number, a: number) => {
    return 0.014 + 0.004 * suave(0.6 * Hh, 0.5 * Hh, y) + 0 * a
  }

  /** Saco (o levita, o casaca militar) con solapas, cuello, botones y bolsillos. */
  const saco = (color: RGBA, op: { ruedo: number; boton: number; cruzado?: boolean; colas?: boolean; solapa?: RGBA; botones?: RGBA; matBoton?: Mat2; paso?: number; tela?: number }) => {
    const yb = op.boton
    const yTop = 0.828 * Hh
    const dTop = 0.42
    const delta = (y: number) => (y > yb ? 0.035 + dTop * Math.pow(suave(yb, yTop, y), 0.85) : 0.035 + (op.colas ? 1.1 : 0.22) * suave(yb, op.colas ? yb - 0.08 * Hh : op.ruedo, y))
    const arco = (y: number): [number, number] => [FRENTE + delta(y), FRENTE + DOS_PI - delta(y)]
    S.tela(op.tela ?? TELA.lana)
    S.tronco({
      y0: op.ruedo,
      y1: yTop,
      paso: op.paso,
      arco,
      holgura: holgTraje,
      bultos: 0.3,
      vuelo: (y) => 0.05 * suave(0.5 * Hh, op.ruedo, y),
      color: () => color,
      mat: MAT_LANA,
      cols: 34,
      pl: PL(3, 0.45),
    })
    // Solapas: sobre el borde de la abertura, del botón al cuello.
    // La solapa refleja distinto (la tela va doblada): un tono apenas más claro.
    const solapa = op.solapa ?? escalarRGBA(color, 1.18)
    for (const lado of [1, -1] as const) {
      const yA = yb + 0.004 * Hh
      const yB = yTop - 0.004 * Hh
      const R = 0.12 * s
      S.tira({
        filas: 12,
        cols: 4,
        // (con grosor: el canto de la solapa se ve de costado)
        grosor: 0.0045,
        pos: (t, w, out) => {
          const y = lerp(yA, yB, t)
          // Ancho con la muesca (el escote entre la solapa y el cuello) arriba.
          // (muesca de 0,06 de ancho en t: con 0,035 caía entre dos filas y era un diente suelto)
          const ancho = (0.072 * s * suave(0, 0.3, t) * (1 - 0.4 * suave(0.78, 1, t)) * (1 - 0.38 * campana(t, 0.84, 0.06))) / R
          const borde = FRENTE + lado * -delta(y)
          const f = (w + 1) / 2
          const a = borde + lado * -(f * ancho)
          // Quiebre: la solapa se levanta en el doblez (borde de la abertura) y se apoya afuera.
          const rollo = 0.005 * (1 - f) * (1 - f) * (1 - 0.6 * suave(0.75, 1, t)) * suave(0, 0.2, t)
          return S.punto(y, a, 0.3, holgTraje(y, a) + 0.0035 + rollo, out)
        },
        normal: (t, w, out) => {
          const y = lerp(yA, yB, t)
          const a = FRENTE + lado * -delta(y)
          S.punto(y, a, 0.3, 0, _v)
          return out.copy(_n)
        },
        // Canto de afuera en sombra y el pespunte claro a 5 mm del borde.
        color: (t, w) => (w > 0.9 ? escalarRGBA(solapa, 0.72) : w > 0.4 && w < 0.6 ? escalarRGBA(solapa, 1.06) : solapa),
        mat: MAT_LANA,
        pesos: (pt, t) => cu.pesosTronco(pt.x, lerp(yA, yB, t), pt.z),
      })
    }
    // Bolsillo de pecho (izquierdo): un ribete de 10 cm.
    if (!op.colas) {
      const yP = 0.738 * Hh
      const aP = FRENTE - 0.62
      S.tira({
        filas: 1,
        cols: 3,
        grosor: 0.0018,
        pos: (t, w, out) => S.punto(yP - t * 0.013 * s + w * 0.006 * s, aP + w * 0.3, 0.3, holgTraje(yP, aP) + 0.0016, out),
        normal: (t, w, out) => {
          S.punto(yP, aP + w * 0.3, 0.3, 0, _v)
          return out.copy(_n)
        },
        color: (t) => escalarRGBA(color, t > 0.5 ? 0.8 : 1.02),
        mat: MAT_LANA,
        pesos: (pt) => cu.pesosTronco(pt.x, yP, pt.z),
      })
    }
    // Cuello del saco (atrás del cuello, sube 3 cm).
    S.cuello({
      y0: yTop - 0.01 * Hh,
      y1: (a) => yTop + (0.032 + 0.01 * Math.max(0, -Math.sin(a))) * s,
      arco: [FRENTE + dTop * 0.8, FRENTE + DOS_PI - dTop * 0.8],
      holg0: 0.016,
      holg1: 0.012,
      color: escalarRGBA(color, 0.95),
      mat: MAT_LANA,
      filas: 2,
    })
    // Botones
    S.tela(TELA.liso)
    const nb = op.cruzado ? 6 : 2
    for (let i = 0; i < nb; i++) {
      const fila = op.cruzado ? Math.floor(i / 2) : i
      const y = yb - fila * (op.cruzado ? 0.055 : 0.06) * Hh * (op.cruzado ? 0.7 : 1) + (op.cruzado ? 0.1 * Hh : 0)
      const a = FRENTE + (op.cruzado ? (i % 2 ? 0.22 : -0.22) : -0.06)
      S.punto(y, a, 0.3, holgTraje(y, a) + 0.001, _v)
      S.boton(_v.clone(), _n.clone(), 0.0085 * s, 0.003, op.botones ?? escalarRGBA(color, 0.6), op.matBoton ?? MAT_BOTON, cu.pesosTronco(_v.x, y, _v.z))
    }
    // Bolsillos: tapas a la altura de la cadera y bolsillo de pecho.
    S.tela(op.tela ?? TELA.lana)
    if (!op.colas) {
      for (const lado of [1, -1] as const) {
        const yP = yb - 0.08 * Hh
        S.tira({
          filas: 1,
          cols: 4,
          grosor: 0.002,
          pos: (t, w, out) => S.punto(yP - t * 0.03 * s, FRENTE + lado * (0.75 + w * 0.2), 0.3, holgTraje(yP, 0) + 0.003, out, 0.05 * suave(0.5 * Hh, op.ruedo, yP - t * 0.03 * s)),
          normal: (t, w, out) => {
            S.punto(yP, FRENTE + lado * (0.75 + w * 0.2), 0.3, 0, _v)
            return out.copy(_n)
          },
          color: (t) => escalarRGBA(color, t > 0.5 ? 0.78 : 0.97),
          mat: MAT_LANA,
          pesos: (pt) => cu.pesosTronco(pt.x, yP, pt.z),
        })
      }
    }
  }

  /** Camisa visible: el frente (bajo el saco) y el cuello con puntas. */
  const camisa = (color: RGBA, op: { corbata?: string; mono?: boolean; abierta?: boolean; arco?: number; larga?: boolean }) => {
    // El blanco de la camisa, a 88 %: al sol se quemaba y el resplandor lavaba la cara.
    if (color[0] + color[1] + color[2] > 2.4) color = escalarRGBA(color, 0.88)
    const ar = op.arco ?? 0.75
    S.tela(TELA.popelina)
    S.tronco({
      y0: 0.56 * Hh,
      y1: 0.828 * Hh,
      // (pechera casi plana bajo el saco: filas cada 4 cm bastan)
      paso: 0.04,
      // Solo lo que se ve por la abertura del saco (más lo que tapa la solapa): con
      // ±0,75 rad la pechera llegaba al hombro y asomaba por encima del saco.
      arco: (y) => {
        const yb = 0.598 * Hh
        const d = y > yb ? 0.035 + 0.42 * Math.pow(suave(yb, 0.828 * Hh, y), 0.85) : 0.035 + 0.22 * suave(yb, 0.425 * Hh, y)
        const m = Math.min(ar, d + 0.16)
        return [FRENTE - m, FRENTE + m]
      },
      holgura: () => 0.0045,
      bultos: 0.45,
      // Tapeta: una franja apenas más oscura al centro.
      color: (y, a) => (Math.abs(a - FRENTE) < 0.03 ? escalarRGBA(color, 0.9) : color),
      mat: MAT_ALGODON,
      cols: 16,
    })
    if (op.abierta) {
      // Botones de la camisa (abierta arriba: el primero a la altura del esternón).
      S.tela(TELA.liso)
      for (let i = 0; i < 3; i++) {
        const y = (0.735 - i * 0.055) * Hh
        S.punto(y, FRENTE, 0.45, 0.0052, _v)
        S.boton(_v.clone(), _n.clone(), 0.0045 * s, 0.0015, escalarRGBA(color, 0.88), MAT_BOTON, cu.pesosTronco(_v.x, y, _v.z), 5)
      }
      S.tela(TELA.popelina)
    }
    // Cuello de camisa: banda alrededor del cuello.
    const abierto = op.abierta ? 0.42 : 0.07
    S.cuello({
      y0: 0.818 * Hh,
      y1: (a) => 0.828 * Hh + (0.05 - 0.012 * Math.max(0, Math.sin(a))) * s,
      arco: [FRENTE + abierto, FRENTE + DOS_PI - abierto],
      holg0: 0.006,
      holg1: 0.0045,
      color,
      mat: MAT_ALGODON,
      filas: 2,
      tapa: true,
    })
    // Puntas del cuello: dos triángulos sobre el pecho, a los lados del nudo.
    for (const lado of [1, -1] as const) {
      const yA = 0.828 * Hh + 0.012 * s
      // Abierto (sin corbata): puntas cortas que caen SOBRE la solapa, junto a la
      // muesca. (Con 7,5 cm, abriendo 0,42 rad, salían hacia los hombros por fuera
      // de las solapas y se leían como dos colmillos blancos.)
      const largo = (op.abierta ? 0.05 : 0.06) * s
      const a0 = abierto + 0.02
      const abre = op.abierta ? 0.2 : 0.22
      const base = op.abierta ? 0.3 : 0.28
      S.tira({
        filas: 3,
        cols: op.abierta ? 4 : 2,
        grosor: op.abierta ? 0.0025 : 0.0015,
        pos: (t, w, out) => {
          const y = yA - t * largo
          // Base ancha arriba, punta abajo y hacia afuera.
          const a = FRENTE + lado * (a0 + abre * t + ((w + 1) / 2) * base * (1 - t))
          if (y > 0.826 * Hh) return S.puntoCuello(y, a, 0.0085, out)
          // Abierto: por encima de la superficie de la solapa (holgura del saco +
          // 3,5 mm de la solapa + su rollo + 2,5 mm), no a una distancia fija.
          const h = op.abierta ? lerp(0.0095, holgTraje(y, a) + 0.0035 + 0.005 + 0.0025, suave(0, 0.35, t)) : 0.0075 + 0.002 * (1 - t)
          return S.punto(y, a, 0.45, h, out)
        },
        normal: (t, w, out) => {
          const a = FRENTE + lado * (a0 + abre * t)
          return out.set(Math.cos(a), 0.25, Math.sin(a)).normalize()
        },
        // Canto más oscuro: se lee como tela doblada, no como una lámina.
        color: (t, w) => (op.abierta && Math.abs(w) > 0.9 ? escalarRGBA(color, 0.8) : color),
        mat: MAT_ALGODON,
        pesos: (pt) => cu.pesosTronco(pt.x, Math.min(pt.y, 0.83 * Hh), pt.z),
      })
    }
    if (op.corbata && !op.abierta) {
      const ct = rgba(op.corbata)
      S.tela(TELA.seda)
      // El nudo llena la abertura del cuello, hasta casi arriba.
      const yNudo = 0.828 * Hh + 0.022 * s
      if (op.mono) {
        // Moño (lazo).
        for (const lado of [1, -1] as const) {
          S.tira({
            filas: 2,
            cols: 3,
            grosor: 0.006,
            pos: (t, w, out) => {
              const y = yNudo - 0.004 * s + w * 0.012 * s * (0.6 + t)
              return S.puntoCuello(Math.max(y, 0.83 * Hh), FRENTE + lado * t * 0.5, 0.013, out)
            },
            normal: (t, w, out) => out.set(0, 0, 1),
            color: () => ct,
            mat: [0.5, 0],
            pesos: () => [[H.cuello, 1]],
          })
        }
      } else {
        // Corbata: nudo y hoja hasta el cinturón (o más abajo si es larga).
        const yFin = (op.larga ? 0.548 : 0.585) * Hh
        // La corbata larga cuelga por DELANTE del saco abotonado (botón a 0,598·Hh):
        // por debajo del botón pasa a la holgura del saco; antes iba por debajo y la
        // tela del saco la atravesaba (fragmentos rojos sueltos en la punta).
        const yBot = 0.598 * Hh
        S.tira({
          filas: 14,
          cols: 2,
          grosor: 0.003,
          pos: (t, w, out) => {
            const y = lerp(yNudo - 0.022 * s, yFin, t)
            const ancho = lerp(0.018, 0.043, Math.pow(t, 0.8)) * s
            const punta = t > 0.94 ? (1 - Math.abs(w)) * 0.035 * s * (t - 0.94) / 0.06 : 0
            const sobre = op.larga ? suave(yBot + 0.012 * Hh, yBot - 0.004 * Hh, y) : 0
            S.punto(y - punta, FRENTE, lerp(0.45, 0.3, sobre), lerp(0.009 + 0.003 * t, holgTraje(y, FRENTE) + 0.005, sobre), out)
            out.x += w * ancho * (t > 0.94 ? 1 - (t - 0.94) / 0.06 * 0.2 : 1)
            return out
          },
          normal: (t, w, out) => out.set(0, 0.15, 1).normalize(),
          color: () => ct,
          mat: [0.45, 0],
          pesos: (pt) => cu.pesosTronco(0, pt.y, 0.1),
        })
        // Nudo
        S.tira({
          filas: 3,
          cols: 4,
          grosor: 0.008,
          pos: (t, w, out) => {
            const y = yNudo + 0.004 * s - t * 0.036 * s
            S.punto(Math.min(y, 0.826 * Hh), FRENTE, 0.45, 0.01, out)
            if (y > 0.826 * Hh) S.puntoCuello(y, FRENTE, 0.01, out)
            out.x += w * lerp(0.02, 0.011, t) * s
            // Nudo abultado (Windsor): sale al centro, y el hoyuelo de abajo.
            out.z += 0.004 * s * (1 - w * w) * (1 - 0.5 * t)
            return out
          },
          normal: (t, w, out) => out.set(0, 0.2, 1).normalize(),
          color: () => escalarRGBA(ct, 0.9),
          mat: [0.45, 0],
          pesos: () => [[H.pecho, 0.6], [H.cuello, 0.4]],
        })
      }
    }
  }

  /** Banda diagonal sobre el torso (faja, manto, toga): del hombro `lado` a la cadera opuesta. */
  const banda = (lado: 1 | -1, ancho: number, holg: number, color: (w: number) => RGBA, op: { y0?: number; y1?: number; pliegues?: number; mat?: Mat2; t0?: number; t1?: number; filas?: number; hombro?: number; tela?: number; pl?: number } = {}) => {
    S.tela(op.tela ?? TELA.fieltro)
    const yAlto = op.y1 ?? 0.818 * Hh
    const yBajo = op.y0 ?? 0.56 * Hh
    // El plano inclinado pasa por arriba del hombro y por la cadera del otro lado.
    const xH = -lado * 0.11 * s
    const xC = lado * 0.15 * s
    const k = (yAlto - yBajo) / (xH - xC)
    const yDe = (x: number) => yBajo + (x - xC) * k
    const cols = op.filas ?? 48
    // t0..t1: qué parte de la vuelta (0 = espalda, 0,5 = frente); por defecto, entera.
    const t0 = op.t0 ?? 0
    const t1 = op.t1 ?? 1
    const yMin = Math.min(0.48 * Hh, yBajo - ancho * 0.5)
    S.tira({
      filas: cols,
      cols: 4,
      grosor: 0.0035,
      pos: (tt, w, out) => {
        const t = lerp(t0, t1, tt)
        const a = -Math.PI / 2 + t * DOS_PI
        let y = 0.7 * Hh
        for (let it = 0; it < 3; it++) {
          S.punto(clamp(y, 0.5 * Hh, 0.826 * Hh), a, 0.3, holg, out)
          y = yDe(out.x)
        }
        y = clamp(y + w * ancho * 0.5, yMin, 0.83 * Hh)
        const pl = op.pliegues ? op.pliegues * Math.sin(w * 3 + t * 40) * 0.5 + op.pliegues * 0.5 : 0
        // Sobre el hombro, más afuera: si no, la manga de la túnica (el deltoides)
        // asomaba blanca por el borde del manto.
        const hb = op.hombro ? op.hombro * suave(0.09 * s, 0.15 * s, Math.abs(out.x)) * suave(0.74 * Hh, 0.8 * Hh, y) : 0
        return S.punto(y, a, 0.3, holg + 0.004 + pl + hb, out)
      },
      normal: (tt, w, out) => {
        const a = -Math.PI / 2 + lerp(t0, t1, tt) * DOS_PI
        S.punto(0.7 * Hh, a, 0.3, 0, _v)
        return out.copy(_n)
      },
      color: (t, w) => color(w),
      mat: op.mat ?? MAT_LANA,
      pesos: (pt) => cu.pesosTronco(pt.x, pt.y, pt.z),
      pl: op.pl ?? PL(5, 1.2),
      uvEscala: 8,
    })
  }

  /** Perfil de las flautas de una falda (-1..1): 7 grandes + 11 chicas, fase según la altura. */
  const flauta = (a: number, y: number, sem: number) => {
    const fy = y / Hh
    const g = Math.sin(a * 7 + sem + 2.2 * fy + 0.6 * Math.sin(a * 2 + sem))
    const c = Math.sin(a * 11 + sem * 2.3 - 1.7 * fy)
    // Crestas redondas, valles marcados: 1 - |.| empuja hacia afuera, el valle queda en punta.
    return 0.7 * (1 - 2 * Math.abs(g) ** 0.7) * -1 + 0.3 * c
  }

  /** Túnica larga hasta el tobillo, con pliegues verticales que se abren hacia el ruedo. */
  const tunica = (color: RGBA, op: { ruedo: number; escote?: number; vuelo?: number; ribete?: RGBA; manga?: number; mangaAncha?: number; soloFrente?: number; clavi?: RGBA; tela?: number }) => {
    const sem = (p.id.length * 7) % 13
    const escote = op.escote ?? 0.3
    S.tela(op.tela ?? TELA.lino)
    S.tronco({
      y0: op.ruedo,
      y1: 0.828 * Hh,
      paso: 0.036,
      // Bajo un sobretodo solo se ve el frente; por debajo del ruedo del sobretodo
      // (op.soloFrente = su altura) la túnica da la vuelta entera: si no, de costado
      // se veía el cielo detrás del panel y los zapatos flotando.
      arco: op.soloFrente ? (y) => {
        const m = lerp(Math.PI, 1.05, suave(op.soloFrente! + 0.03 * Hh, op.soloFrente! + 0.11 * Hh, y))
        return [FRENTE - m, FRENTE + m]
      } : undefined,
      cols: op.soloFrente ? 30 : 22,
      // (+1 cm adelante a la altura de la rodilla: al dar el paso, la rodilla de
      // adelante atravesaba el ruedo de las túnicas cortas)
      holgura: (y, a) => 0.016 + 0.006 * suave(0.6 * Hh, 0.5 * Hh, y) + 0.01 * Math.max(0, Math.sin(a)) ** 2 * campana(y, 0.29 * Hh, 0.08 * Hh),
      bultos: 0.3,
      vuelo: (y) => (op.vuelo ?? 0.32) * Math.pow(suave(0.5 * Hh, op.ruedo, y), 0.8),
      // Caída: flautas que nacen del cinturón y crecen hacia el ruedo, con la fase que
      // deriva con la altura (no son verticales perfectas); crestas redondas y valles
      // marcados, como la tela que cuelga. Arriba del cinturón, un poco de blusón.
      pliegues: (y, a) => {
        const abajo = Math.pow(suave(0.58 * Hh, op.ruedo, y), 0.8)
        const cint = campana(y, 0.6 * Hh, 0.025 * Hh)
        return (0.02 * abajo + 0.004 * cint) * flauta(a, y, sem) + 0.006 * campana(y, 0.63 * Hh, 0.02 * Hh)
      },
      ruedo: (a) => -0.012 * s * flauta(a, op.ruedo, sem),
      tope: (a) => 0.828 * Hh - escote * 0.06 * Hh * Math.pow(Math.max(0, Math.sin(a)), 3),
      color: (y, a) => {
        // (umbral entre la 2.ª y la 3.ª fila: con el ruedo ondulado, 3 cm dejaba el ribete dentado)
        if (op.ribete && y < op.ruedo + 0.052 * s) return op.ribete
        // Clavi: dos franjas de 4 cm a cada lado del centro, del hombro al ruedo.
        if (op.clavi) {
          const d = Math.abs(normAng(a) - FRENTE)
          if (d > 0.36 && d < 0.6) return op.clavi
        }
        return color
      },
      mat: MAT_ALGODON,
      pl: PL(4, 1.1),
    })
    S.tapaFalda(op.ruedo)
    if (op.manga !== 0) mangas(color, op.manga ?? 9, 0.016, { ancha: op.mangaAncha ?? 0.03, mat: MAT_ALGODON, cols: 16, pl: PL(1, 1.1) })
  }

  /** Cinturón de la túnica: el de la ficha (faja o cordón de tela, sin hebilla), ninguno, o el de cuero. */
  const cinturonTunica = (y: number, holg: number) => {
    const c = vestuarioDe(p.id).cinturon
    if (c === null) return
    if (!c) return cinturon(y, holg)
    const ancho = (c.ancho ?? 0.02) * s
    S.tela(TELA.lino)
    S.tronco({ y0: y - ancho, y1: y, paso: Math.max(0.006, Math.min(0.02, ancho / s)), holgura: () => holg + 0.002, bultos: 0.3, color: () => rgba(c.color), mat: MAT_ALGODON, tapa: false, cols: undefined })
  }

  /** Lo que la ficha agrega encima de la túnica: manto cruzado, capa, cuello cruzado. */
  const sobreTunica = (defecto: () => void) => {
    const ves = vestuarioDe(p.id)
    if (ves.manto === undefined) defecto()
    else if (ves.manto) {
      const m = ves.manto
      const cm = rgba(m.color)
      const cb = m.borde ? rgba(m.borde) : escalarRGBA(cm, 0.8)
      // Manto (himation): banda ancha y pesada del hombro a la cadera opuesta, con borde.
      banda(m.lado ?? 1, (m.ancho ?? 0.3) * s, 0.04, (w) => (w > 0.8 ? cb : cm), { pliegues: 0.008, y0: (m.bajo ?? 0.54) * Hh, hombro: 0.018 })
    }
    if (ves.cuelloCruzado) {
      const cc = rgba(ves.cuelloCruzado)
      // Solapa izquierda sobre la derecha: el ribete baja del lado izquierdo del
      // cuello a la axila derecha (solo por delante), y rodea la nuca.
      banda(-1, 0.05 * s, 0.022, () => cc, { y0: 0.665 * Hh, y1: 0.835 * Hh, t0: 0.3, t1: 0.75, filas: 16 })
      S.cuello({ y0: 0.818 * Hh, y1: () => 0.818 * Hh + 0.03 * s, arco: [FRENTE + 0.55, FRENTE + DOS_PI - 0.55], holg0: 0.02, holg1: 0.012, color: cc, mat: MAT_ALGODON, filas: 2 })
    }
    if (ves.capa) capa(rgba(ves.capa.color), ves.capa.largo ?? 0.7)
  }

  /** Collar ancho en V (cinta del grado): de los lados del cuello al esternón, con fleco y la joya. */
  const collarV = (color: RGBA, borde: RGBA) => {
    const yA = 0.818 * Hh
    const yP = 0.655 * Hh
    S.tela(TELA.seda)
    for (const lado of [1, -1] as const) {
      S.tira({
        filas: 8,
        cols: 3,
        grosor: 0.002,
        pos: (t, w, out) => {
          const y = lerp(yA, yP, t)
          // Del costado del cuello (ángulo ancho) a la punta en el centro.
          const a = FRENTE + lado * (lerp(0.62, 0.05, t) + w * 0.09 * (1 - 0.6 * t))
          // (por encima de la solapa del saco —3,5 mm + rollo de 5 mm—: con 8 mm las
          // solapas la atravesaban en un zigzag de dientes negros)
          return S.punto(y, a, 0.3, holgTraje(y, a) + 0.0125, out)
        },
        normal: (t, w, out) => {
          const y = lerp(yA, yP, t)
          S.punto(y, FRENTE + lado * lerp(0.62, 0.05, t), 0.3, 0, _v)
          return out.copy(_n)
        },
        color: (t, w) => (Math.abs(w) > 0.7 ? borde : color),
        mat: MAT_ALGODON,
        pesos: (pt) => cu.pesosTronco(pt.x, pt.y, pt.z),
      })
    }
    // La joya: un triángulo dorado colgando de la punta.
    S.tela(TELA.liso)
    S.punto(yP - 0.03 * s, FRENTE, 0.3, holgTraje(yP, FRENTE) + 0.0135, _v)
    S.boton(_v.clone(), _n.clone(), 0.028 * s, 0.004, rgba("#d4aa48"), MAT_ORO, cu.pesosTronco(0, yP, 0.1), 3)
  }

  /** Mandil (delantal) de piel blanca con ribete y solapa triangular, sobre el saco. */
  const mandil = (color: RGBA, ribete: RGBA) => {
    const yT = 0.6 * Hh
    const yB = yT - 0.33 * s
    const ancho = 0.18 * s
    const frente = (y: number, out: THREE.Vector3) => S.punto(Math.max(y, 0.5 * Hh), FRENTE, 0.3, holgTraje(Math.max(y, 0.5 * Hh), FRENTE) + 0.012, out)
    // (pesos de falda: se mueve con los muslos al caminar)
    const pesos = (pt: THREE.Vector3) => S.pesosFalda(pt.x, pt.y, pt.z, yB)
    S.tela(TELA.cuero)
    S.tira({
      filas: 6,
      cols: 6,
      grosor: 0.003,
      pos: (t, w, out) => {
        const y = lerp(yT, yB, t)
        frente(y, out)
        out.x = w * ancho
        out.z += 0.012 * suave(0.5 * Hh, yB, y) - 0.03 * w * w * (y > 0.5 * Hh ? 1 : 0.6)
        return out
      },
      normal: (t, w, out) => out.set(0, 0, 1),
      color: (t, w) => (Math.abs(w) > 0.86 || t > 0.93 ? ribete : color),
      mat: [0.6, 0],
      pesos,
    })
    // Solapa triangular, encima.
    S.tira({
      filas: 3,
      cols: 6,
      grosor: 0.003,
      pos: (t, w, out) => {
        const y = lerp(yT + 0.004, yT - 0.1 * s, t)
        frente(y, out)
        out.x = w * ancho * (1 - t)
        out.z += 0.006 - 0.03 * w * w * (1 - t) * (1 - t)
        return out
      },
      normal: (t, w, out) => out.set(0, 0, 1),
      color: (t, w) => (Math.abs(w) > 0.8 || t > 0.85 ? ribete : color),
      mat: [0.6, 0],
      pesos,
    })
    frente(yT - 0.19 * s, _v)
    _v.z += 0.01
    S.tela(TELA.liso)
    S.boton(_v.clone(), new THREE.Vector3(0, 0, 1), 0.026 * s, 0.002, rgba("#c9a040"), MAT_ORO, pesos(_v), 4)
  }

  /** Capa larga (paludamentum) por la espalda, prendida con una fíbula en el hombro derecho. */
  const capa = (color: RGBA, largo: number) => {
    const yArr = 0.826 * Hh
    const yAb = Math.max(0.06 * Hh, yArr - largo * Hh)
    const A0 = FRENTE + 1.15
    const A1 = DOS_PI + 0.1
    S.tela(TELA.fieltro)
    S.tronco({
      y0: yAb,
      y1: yArr,
      paso: 0.045,
      // Prendida en el hombro DERECHO (la fíbula, adelante) y cruzada por la espalda
      // hasta el costado izquierdo: el ruedo baja en diagonal (corto adelante a la
      // derecha, largo atrás) y los pliegues salen en abanico de la fíbula.
      arco: () => [A0, A1],
      cols: 22,
      tope: (a) => yArr - 0.045 * Hh * suave(4.9, A1, a),
      ruedo: (a) => 0.12 * Hh * suave(4.3, A0, a),
      holgura: (y, a) => 0.03 + 0.03 * suave(0.75 * Hh, 0.5 * Hh, y),
      bultos: 0.3,
      vuelo: (y) => 0.42 * Math.pow(suave(0.55 * Hh, yAb, y), 0.8),
      pliegues: (y, a) => 0.016 * suave(0.78 * Hh, 0.4 * Hh, y) * flauta(a + 0.3 * (y / Hh), y, 3),
      color: (y, a) => (y < yAb + 0.12 * Hh * suave(4.3, A0, a) + 0.02 * s ? escalarRGBA(color, 0.8) : color),
      mat: MAT_LANA,
      tapa: false,
      alCuello: false,
      pl: PL(4, 1.4),
    })
    // Pliegue sobre los hombros (la capa se apoya ahí) y la fíbula dorada.
    S.cuello({ y0: 0.805 * Hh, y1: () => 0.826 * Hh + 0.012 * s, arco: [A0, A1], holg0: 0.035, holg1: 0.02, color, mat: MAT_LANA, filas: 2 })
    S.punto(0.79 * Hh, FRENTE + 0.95, 0.3, 0.032, _v)
    S.tela(TELA.liso)
    S.boton(_v.clone(), _n.clone(), 0.02 * s, 0.006, rgba("#c9a040"), MAT_ORO, cu.pesosTronco(_v.x, 0.79 * Hh, _v.z), 12)
  }

  // ── Por tipo de ropa ──
  // Sombra de barba en la piel: afeitado (leve), de pocos días (según la densidad)
  // o bajo una barba. Densidad 0 en la ficha = afeitado al ras, sin sombra.
  const bf = cu.rasgos.f.barba
  let sombraBarba = cu.fem ? 0 : 0.14
  if (bf) sombraBarba = bf.densidad <= 0.02 ? 0 : bf.densidad < 0.35 ? 0.18 + bf.densidad * 1.4 : 0.3

  switch (tipo) {
    case "traje": {
      const levita = ap.sombrero === "chistera"
      const conCorbata = !!ap.ropa.corbata
      // Los corpulentos llevan la corbata más larga, por debajo del cinturón.
      camisa(rgba(camisaColor(ap)), { corbata: ap.ropa.corbata, mono: levita, abierta: !conCorbata, larga: ap.complexion === "fuerte" })
      // Chaleco (ficha): tapa la camisa y deja solo una franja en "V" bajo el
      // moño (Lincoln: sin él, la levita mostraba una pechera blanca de frac).
      const chaleco = vestuarioDe(p.id).chaleco
      if (chaleco) {
        S.tela(TELA.lana)
        S.tronco({
          y0: 0.555 * Hh,
          y1: 0.826 * Hh,
          paso: 0.05,
          arco: () => [FRENTE - 0.8, FRENTE + 0.8],
          holgura: () => 0.0095,
          bultos: 0.3,
          tope: (a) => 0.826 * Hh - 0.07 * Hh * Math.max(0, 1 - Math.abs(a - FRENTE) / 0.42),
          color: () => rgba(chaleco),
          mat: MAT_LANA,
          // (con 24 columnas Lincoln pasaba el tope de 25.000 triángulos)
          cols: 18,
        })
      }
      // (bajo el saco el muslo se mete: el tubo de la pierna nace ancho y asomaba por el faldón)
      pantalon(C1, { bultos: 0.3, holg: 0.01, bajo: (levita ? 0.3 : 0.425) * Hh })
      medias(rgba("#141417"))
      if (calzadoDe(p.id, { tipo: "oxford", color: "#000" }).tipo === "botin") cana(rgba("#121112"), 0.12)
      // (con 1,6 cm de holgura el cinturón atravesaba el saco —1,4 cm— y se veía
      // por encima: va entre el pantalón y el saco)
      cinturon(0.595 * Hh, 0.0115, 0.3)
      saco(C1, { ruedo: (levita ? 0.3 : 0.425) * Hh, boton: 0.598 * Hh, paso: levita ? 0.034 : 0.03 })
      mangas(C1, 9, 0.015, { puno: rgba(camisaColor(ap)), tela: TELA.lana, pl: PL(1, 0.7), botones: escalarRGBA(C1, 0.55) })
      zapatos(rgba("#100c0a"))
      const vesT = vestuarioDe(p.id)
      if (vesT.collarV) collarV(rgba(vesT.collarV.color), rgba(vesT.collarV.borde))
      if (vesT.mandil) mandil(rgba(vesT.mandil.color), rgba(vesT.mandil.ribete))
      break
    }
    case "uniforme_militar": {
      const rojo = rgba("#9e1b26")
      const blanco = C2
      // Chaleco al frente (blanco, o el de la ficha: el rojo de los Cazadores de
      // Napoleón), calzón blanco, botas altas negras.
      const chalecoU = vestuarioDe(p.id).chaleco
      S.tela(TELA.lana)
      S.tronco({ y0: 0.52 * Hh, y1: 0.828 * Hh, arco: () => [FRENTE - 0.95, FRENTE + 0.95], holgura: () => 0.008, bultos: 0.4, color: () => (chalecoU ? rgba(chalecoU) : blanco), mat: chalecoU ? MAT_LANA : MAT_ALGODON, cols: 24 })
      pantalon(blanco, { holg: 0.006, hasta: cu.piernas[0].u[2] + 0.07 * s, tela: TELA.gamuza })
      saco(C1, { ruedo: 0.31 * Hh, boton: 0.62 * Hh, colas: true, paso: 0.034, solapa: escalarRGBA(C1, 1.05), botones: rgba("#d8b04a"), matBoton: MAT_ORO, cruzado: true, tela: TELA.fieltro })
      S.tela(TELA.fieltro)
      S.cuello({ y0: 0.82 * Hh, y1: (a) => 0.82 * Hh + 0.045 * s, arco: [FRENTE + 0.35, FRENTE + DOS_PI - 0.35], holg0: 0.014, holg1: 0.012, color: rojo, mat: MAT_LANA, filas: 2, tapa: true })
      mangas(C1, 9, 0.015, { puno: rojo, tela: TELA.fieltro, telaPuno: TELA.fieltro, pl: PL(1, 0.8) })
      // Botas: caña hasta la rodilla. (De cuero: seguía la tela del calzón y se leía como tela.)
      S.tela(TELA.cuero)
      for (const lado of [1, -1] as const) {
        const c = cu.piernas[lado > 0 ? 0 : 1]
        S.tubo({ cadena: "pierna", lado, u0: c.u[2] - 0.035 * s, u1: c.u[3] + 0.02 * s, holgura: (u) => 0.01 + 0.012 * suave(c.u[2] + 0.04 * s, c.u[2] - 0.03 * s, u), color: () => cueroNegro, mat: MAT_CUERO, cols: 14 })
      }
      zapatos(cueroNegro)
      // Charreteras doradas con flecos.
      S.tela(TELA.liso)
      for (const lado of [1, -1] as const) {
        const L = lado > 0 ? "I" : "D"
        const cx = lado * 0.15 * s * cu.k.hombros
        const y = 0.816 * Hh
        const centro = new THREE.Vector3(cx, y + 0.004, -0.01 * s)
        const pw: Pesos = [[H[`clavicula${L}`], 0.6], [H[`hombro${L}`], 0.4]]
        S.boton(centro, new THREE.Vector3(0, 1, 0), 0.042 * s, 0.006, rgba("#d4aa48"), MAT_ORO, pw, 14)
        for (let k = 0; k < 14; k++) {
          const g = (k / 14) * DOS_PI
          const a = new THREE.Vector3(cx + Math.cos(g) * 0.046 * s, y + 0.004, -0.01 * s + Math.sin(g) * 0.041 * s)
          if (lado * Math.cos(g) < -0.2) continue
          const b = a.clone().add(new THREE.Vector3(lado * Math.max(0, lado * Math.cos(g)) * 0.012, -0.045 * s, 0))
          S.cordon([a, b], 0.004 * s, rgba("#c9a040"), MAT_ORO, () => pw, false, 4)
        }
      }
      break
    }
    case "tunica":
    case "tunica_renacentista": {
      const ren = tipo === "tunica_renacentista"
      const ves = vestuarioDe(p.id)
      const ribete = ves.ribete === null ? undefined : ves.ribete ? rgba(ves.ribete) : ren ? undefined : C2
      tunica(C1, { tela: ren ? TELA.lana : vestuarioDe(p.id).capucha ? TELA.fieltro : TELA.lino, ruedo: (ves.ruedo ?? 0.035) * Hh, ribete, escote: ren ? 0.15 : 0.35, mangaAncha: ves.mangaAncha ?? (ren ? 0.012 : 0.035), manga: ves.manga, soloFrente: ren ? 0.25 * Hh : undefined, clavi: ves.clavi ? rgba(ves.clavi) : undefined })
      cinturonTunica(0.6 * Hh, 0.024)
      if (!ren) sobreTunica(() => banda(1, 0.2 * s, 0.036, () => C2, { pliegues: 0.004 }))
      else {
        // Sobretodo oscuro abierto al frente.
        S.tela(TELA.fieltro)
        S.tronco({ y0: 0.25 * Hh, y1: 0.826 * Hh, paso: 0.034, arco: (y) => [FRENTE + 0.32, FRENTE + DOS_PI - 0.32], holgura: (y) => 0.028 + 0.008 * suave(0.6 * Hh, 0.3 * Hh, y), bultos: 0.25, vuelo: (y) => 0.25 * suave(0.5 * Hh, 0.25 * Hh, y), color: () => C2, mat: MAT_LANA, cols: 52, pl: PL(4, 1.0) })
      }
      if (ren) zapatos(rgba("#2a1c14"))
      else if (ves.descalzo) pieDescalzo = true
      else sandalias()
      break
    }
    case "toga": {
      const ves = vestuarioDe(p.id)
      tunica(C1, { ruedo: (ves.ruedo ?? 0.04) * Hh, escote: 0.25, mangaAncha: ves.mangaAncha ?? 0.02, manga: (ves.manga ?? 0.17) * s, ribete: ves.ribete ? rgba(ves.ribete) : undefined, clavi: ves.clavi ? rgba(ves.clavi) : undefined })
      if (ves.cinturon) cinturonTunica(0.6 * Hh, 0.02)
      // La toga: banda ancha cruzada con la franja púrpura en el borde.
      sobreTunica(() => banda(1, 0.32 * s, 0.04, (w) => (w > 0.75 ? C2 : escalarRGBA(C1, 0.97)), { pliegues: 0.006 }))
      if (ves.descalzo) pieDescalzo = true
      else sandalias((ves.ruedo ?? 0) > 0.15)
      break
    }
    case "vestido_egipcio": {
      // Vestido de lino del pecho al tobillo, con tirantes; collar ancho dorado.
      S.tela(TELA.lino)
      S.tronco({
        y0: 0.035 * Hh,
        y1: 0.8 * Hh,
        paso: 0.036,
        holgura: (y) => 0.007 + 0.006 * suave(0.5 * Hh, 0.1 * Hh, y),
        bultos: 0.7,
        vuelo: (y) => 0.12 * suave(0.5 * Hh, 0.05 * Hh, y),
        pliegues: (y, a) => 0.0045 * suave(0.55 * Hh, 0.05 * Hh, y) * Math.sin(a * 13),
        tope: (a) => 0.8 * Hh - 0.035 * Hh * Math.pow(Math.max(0, Math.sin(a)), 2),
        color: (y) => (y < 0.06 * Hh ? C2 : C1),
        mat: [0.92, 0],
        pl: PL(4, 0.7),
      })
      S.tapaFalda(0.035 * Hh)
      // Collar ancho (usekh): franjas de oro, lapislázuli y cornalina.
      // (oro dominante y piedras en hileras finas y apagadas: con cinco franjas
      // anchas y saturadas se leía como un arcoíris de cotillón)
      S.tela(TELA.liso)
      // (oro satinado y más oscuro: pulido, a la tarde resplandecía como un foco)
      const franjas = [rgba("#b8863a"), rgba("#23407c"), rgba("#b8863a"), rgba("#8e2f24"), rgba("#b8863a"), rgba("#2f857c"), rgba("#b8863a")]
      S.tronco({
        y0: 0.765 * Hh,
        y1: 0.83 * Hh,
        paso: 0.0045,
        // (+1,4 cm a los costados abajo: el casquete del hombro —la malla del brazo— asomaba
        // por el borde inferior del collar en dientes)
        holgura: (y, a) => 0.009 + 0.006 * suave(0.81 * Hh, 0.77 * Hh, y) + 0.014 * Math.abs(Math.cos(a)) ** 2 * suave(0.81 * Hh, 0.765 * Hh, y),
        bultos: 0.5,
        tope: (a) => 0.83 * Hh,
        // (franjas a alturas fijas: con el borde subiendo por el trapecio las filas se
        // repartían distinto en cada ángulo y las franjas salían en zigzag)
        alCuello: false,
        color: (y) => franjas[clamp(Math.floor(((y - 0.765 * Hh) / (0.065 * Hh)) * 7), 0, 6)],
        mat: (y) => (Math.floor(((y - 0.765 * Hh) / (0.065 * Hh)) * 7) % 2 ? [0.45, 0] : [0.58, 1]),
      })
      // Brazaletes
      for (const lado of [1, -1] as const) {
        const c = cu.brazos[lado > 0 ? 0 : 1]
        S.tubo({ cadena: "brazo", lado, u0: 0.1 * s, u1: 0.125 * s, paso: 0.012, holgura: () => 0.004, color: () => rgba("#d4aa48"), mat: MAT_ORO, tapa: false })
        S.tubo({ cadena: "brazo", lado, u0: c.u[3] - 0.035 * s, u1: c.u[3] - 0.012 * s, paso: 0.012, holgura: () => 0.004, color: () => rgba("#d4aa48"), mat: MAT_ORO, tapa: false })
      }
      sandalias()
      break
    }
    case "camiseta_basquet": {
      tejido = "algodon"
      // Musculosa: sin mangas, sisas amplias, ribete dorado.
      const sisa = (y: number, a: number) => {
        const lat = Math.abs(Math.cos(a))
        return y > 0.705 * Hh && lat > 0.8 - 0.55 * suave(0.705 * Hh, 0.8 * Hh, y)
      }
      S.tela(TELA.malla)
      S.tronco({
        pl: PL(3, 0.7),
        grilla: false,
        alCuello: false,
        y0: 0.5 * Hh,
        y1: 0.826 * Hh,
        holgura: (y) => 0.011 + 0.006 * suave(0.6 * Hh, 0.5 * Hh, y),
        bultos: 0.5,
        tope: (a) => {
          // Tirantes sobre el trapecio, sisas amplias y escote redondo.
          const c = Math.abs(Math.cos(a))
          const tirante = suave(0.3, 0.45, c) * suave(0.82, 0.68, c)
          const sisa = suave(0.72, 0.86, c)
          const escote = Math.max(0, Math.sin(a)) ** 2 * 0.055 + Math.max(0, -Math.sin(a)) ** 2 * 0.03
          return 0.83 * Hh - Hh * (escote * (1 - tirante) + 0.085 * sisa)
        },
        color: (y, a) => {
          const c = Math.abs(Math.cos(a))
          const tirante = suave(0.3, 0.45, c) * suave(0.82, 0.68, c)
          const sisa = suave(0.72, 0.86, c)
          const escote = Math.max(0, Math.sin(a)) ** 2 * 0.055 + Math.max(0, -Math.sin(a)) ** 2 * 0.03
          const tope = 0.83 * Hh - Hh * (escote * (1 - tirante) + 0.085 * sisa)
          return y > tope - 0.014 * s || y < 0.505 * Hh ? C2 : C1
        },
        mat: MAT_ALGODON,
        tapa: false,
      })
      S.tapaTronco.push((y, a) => y > 0.505 * Hh && y < 0.745 * Hh && !sisa(y, a))
      numero = { texto: String((ap.ropa as { numero?: number | string }).numero ?? "24"), relleno: ap.ropa.color2 ?? "#FDB927", borde: "#ffffff" }
      // Número delante y detrás (calcomanía con su propia uv1).
      for (const atras of [false, true]) {
        const yc = 0.715 * Hh
        const L = S.lote
        const ids: number[][] = []
        for (let i = 0; i <= 6; i++) {
          const fila: number[] = []
          for (let k = 0; k <= 6; k++) {
            const u = k / 6
            const v = i / 6
            const a = (atras ? -FRENTE : FRENTE) - (u - 0.5) * 0.95
            const y = yc + (v - 0.5) * 0.16 * s
            S.punto(y, a, 0.5, 0.0135, _v)
            fila.push(L.v(_v.x, _v.y, _v.z, 0, 0, [1, 1, 1, 1], cu.pesosTronco(_v.x, y, _v.z), MAT_ALGODON, [0.08 + u * 0.88, 0.08 + v * 0.88]))
          }
          ids.push(fila)
        }
        L.tiras(ids, false, { centros: ids.map((_, i) => new THREE.Vector3(0, yc + (i / 6 - 0.5) * 0.16 * s, 0)) })
        L.pieza()
      }
      // Short ancho hasta arriba de la rodilla, con franja dorada.
      S.tela(TELA.malla)
      S.tronco({ y0: 0.47 * Hh, y1: 0.6 * Hh, holgura: () => 0.02, bultos: 0.5, color: (y) => (y > 0.585 * Hh ? C2 : C1), mat: MAT_ALGODON })
      for (const lado of [1, -1] as const) {
        const c = cu.piernas[lado > 0 ? 0 : 1]
        S.tela(TELA.malla)
        S.tubo({ cadena: "pierna", lado, u0: -0.02 * s, u1: c.u[2] - 0.045 * s, holgura: (u) => 0.026 + 0.012 * suave(0, c.u[2], u), color: (u, a) => (Math.cos(a) > 0.93 || u > c.u[2] - 0.065 * s ? C2 : C1), mat: MAT_ALGODON, pl: PL(2, 1.2) })
        // Medias blancas a media pantorrilla.
        S.tela(TELA.acanalado)
        S.tubo({ cadena: "pierna", lado, u0: c.u[2] + 0.2 * s, u1: c.u[3] + 0.02 * s, holgura: () => 0.003, color: () => rgba("#f2f2f2"), mat: MAT_ALGODON })
      }
      zapatos(rgba("#f4f4f4"), { suela: rgba("#552583"), deportivo: true })
      break
    }
    case "cuello_alto": {
      tejido = "punto"
      // Jersey fino de lana (el de Jobs no es un punto grueso) con cuello, puños y ruedo de canalé.
      S.tela(TELA.jersey)
      S.tronco({ pl: PL(3, 0.9), y0: 0.505 * Hh, y1: 0.836 * Hh, holgura: (y) => 0.01 + 0.006 * suave(0.6 * Hh, 0.5 * Hh, y) + 0.012 * suave(0.55 * Hh, 0.505 * Hh, y), vuelo: (y) => 0.1 * suave(0.565 * Hh, 0.505 * Hh, y), bultos: 0.4, color: () => C1, mat: [0.92, 0] })
      S.tela(TELA.acanalado)
      S.cuello({ y0: 0.81 * Hh, y1: () => 0.818 * Hh + 0.062 * s, holg0: 0.009, holg1: 0.005, color: C1, mat: [0.92, 0], filas: 4, tapa: true })
      // Mangas un poco recogidas.
      mangas(C1, cu.brazos[0].u[3] - 0.06 * s, 0.009, { mat: [0.92, 0], tela: TELA.jersey, pl: PL(1, 1.3) })
      pantalon(C2, { mezclilla: true, holg: 0.007, bajo: 0.505 * Hh })
      medias(rgba("#2a2b2e"))
      zapatos(rgba("#8a8d93"), { suela: rgba("#e8e8e8"), deportivo: true })
      break
    }
    case "deportivo":
    case "casual":
    case "androide":
    case "holograma": {
      tejido = "algodon"
      const ves = vestuarioDe(p.id)
      const remera = ves.remera ?? (ap.complexion === "fuerte" || ap.complexion === "atletico" || tipo === "deportivo" || tipo === "holograma")
      if (!remera) tejido = "punto"
      // Escote: redondo, o en V (el suéter de Pichai y de Amodei) con la camisa o
      // la camiseta de abajo a la vista.
      const enV = !!ves.cuelloV
      // (androide: sudadera de cuello redondo más cerrado)
      const escote = (a: number) => (tipo === "androide" ? 0.01 : 0.016) * Hh * Math.pow(Math.max(0, Math.sin(a)), 3)
      const ve = (a: number) => (enV ? 0.07 * Hh * Math.max(0, 1 - Math.abs(normAng(a) - FRENTE) / 0.5) : 0)
      const topeSueter = (a: number) => 0.836 * Hh - Math.max(escote(a), ve(a))
      S.tela(remera ? TELA.jersey : TELA.punto)
      // Suéter: el cuerpo de punto termina en una pretina de canalé de 6 cm, más ceñida
      // (la tela de arriba sobra un poco: blusón).
      const pretina = !remera && tipo !== "androide"
      S.tronco({
        pl: PL(3, remera ? 0.8 : 1.0),
        y0: (pretina ? 0.528 : 0.5) * Hh,
        y1: 0.836 * Hh,
        // (más holgura y un poco de vuelo abajo: con 1,6 cm los muslos del pantalón
        // asomaban por delante del ruedo en dos arcos y el borde se veía dentado)
        holgura: (y) => 0.009 + 0.007 * suave(0.6 * Hh, 0.5 * Hh, y) + 0.012 * suave(0.545 * Hh, 0.5 * Hh, y),
        vuelo: (y) => 0.1 * suave(0.56 * Hh, 0.5 * Hh, y),
        bultos: remera ? 0.6 : 0.4,
        tope: topeSueter,
        color: (y, a) => (y < 0.51 * Hh && !remera ? escalarRGBA(C1, 0.9) : enV && y > topeSueter(a) - 0.012 * s && ve(a) > 0.01 * Hh ? escalarRGBA(C1, 0.85) : C1),
        mat: remera ? MAT_ALGODON : [0.92, 0],
      })
      if (pretina) {
        S.tela(TELA.acanalado)
        S.tronco({
          y0: 0.5 * Hh,
          y1: 0.533 * Hh,
          paso: 0.03,
          holgura: (y) => 0.013 + 0.006 * suave(0.5 * Hh, 0.533 * Hh, y),
          vuelo: () => 0.04,
          bultos: 0.4,
          color: () => escalarRGBA(C1, 0.92),
          mat: [0.92, 0],
        })
        S.tela(TELA.punto)
      }
      if (enV) {
        // Lo de abajo: camisa (con su cuello) o camiseta clara.
        const abajo = rgba(ves.cuelloCamisa ?? "#d8d5cf")
        S.tela(ves.cuelloCamisa ? TELA.popelina : TELA.jersey)
        // (solo el frente, lo que se ve por la V: dando la vuelta entera asomaba por los hombros del suéter)
        S.tronco({ y0: 0.836 * Hh - 0.08 * Hh, y1: 0.836 * Hh, arco: () => [FRENTE - 0.78, FRENTE + 0.78], cols: 14, holgura: () => 0.0045, bultos: 0.4, tope: (a) => 0.836 * Hh - escote(a), color: () => abajo, mat: MAT_ALGODON })
        if (ves.cuelloCamisa) {
          // Cuello de camisa: banda alta, abierta adelante, con las puntas sobre el escote.
          S.cuello({ y0: 0.822 * Hh, y1: (a) => 0.85 * Hh - 0.024 * Hh * Math.pow(Math.max(0, Math.sin(a)), 4), holg0: 0.011, holg1: 0.005, color: abajo, mat: MAT_ALGODON, filas: 2 })
        } else S.cuello({ y0: 0.818 * Hh, y1: (a) => 0.84 * Hh - escote(a), holg0: 0.006, holg1: 0.003, color: escalarRGBA(abajo, 0.92), mat: MAT_ALGODON, filas: 1 })
      // (y0 por debajo del escote: con 0,826 la banda quedaba invertida adelante, donde el
      // escote baja a 0,824, y dibujaba una línea oscura suelta sobre el pecho)
      } else if (tipo === "androide") {
        S.tela(TELA.acanalado)
        // Sudadera: cuello de canalé alto y cerrado, más oscuro que la tela.
        S.cuello({ y0: 0.822 * Hh, y1: (a) => 0.846 * Hh - escote(a), holg0: 0.0105, holg1: 0.005, color: escalarRGBA(C1, 0.85), mat: [0.92, 0], filas: 3 })
      } else {
        S.tela(remera ? TELA.jersey : TELA.acanalado)
        S.cuello({ y0: 0.818 * Hh, y1: (a) => 0.84 * Hh - escote(a), holg0: 0.0095, holg1: 0.004, color: escalarRGBA(C1, 0.92), mat: MAT_ALGODON, filas: 1 })
      }
      if (remera) mangas(C1, 0.15 * s, 0.01, { mat: MAT_ALGODON, tela: TELA.jersey, pl: PL(1, 0.8) })
      else mangas(C1, 9, 0.011, { mat: [0.92, 0], puno: escalarRGBA(C1, 0.9), tela: TELA.punto, telaPuno: TELA.acanalado, pl: PL(1, 1.1) })
      // Androide: el nombre estampado en el pecho de la sudadera (avatar-androide.ts).
      if (tipo === "androide") estampar(S.lote, cu, p, (y, a, b, h, o) => S.punto(y, a, b, h, o))
      const mezclilla = ves.mezclilla ?? new THREE.Color(ap.ropa.color2 ?? "#2f3e55").b > 0.25
      if (tipo === "deportivo") pantalon(C2, { corto: cu.piernas[0].u[2] - 0.05 * s, tela: TELA.jersey })
      // (en el holograma, el color 2 es el del borde de luz: el pantalón va del color base)
      else pantalon(tipo === "holograma" ? C1 : C2, { mezclilla: mezclilla && tipo !== "holograma", holg: 0.007, bajo: 0.5 * Hh, tela: mezclilla && tipo !== "holograma" ? TELA.mezclilla : p.id === "hormozi" ? TELA.jersey : TELA.lana })
      const tipoZ = calzadoDe(p.id, { tipo: remera ? "zapatilla" : "oxford", color: "#000" }).tipo
      if (tipoZ === "bota" || tipoZ === "botin") cana(rgba(calzadoDe(p.id, { tipo: "bota", color: "#121212" }).color), 0.13)
      else if (tipo !== "deportivo") medias(rgba("#1c1c1f"))
      zapatos(remera ? rgba("#1d1d1f") : rgba("#2b2119"), { suela: rgba(remera ? "#e9e9e9" : "#1a1410"), deportivo: remera })
      break
    }
  }

  // ── Accesorios ──
  const acc = new Set(ap.accesorios)
  const cab = cu.cab
  const pesoCab = (): Pesos => [[H.cabeza, 1]]
  // Capucha profunda (hábito del Iluminado): una concha alrededor de la cabeza
  // que tapa la frente y deja ver solo el tercio de abajo de la cara (la nariz,
  // la boca y el mentón); cae como cuello sobre los hombros. Dos caras (afuera y
  // adentro, que se ve por la abertura) y un ribete en el borde.
  // ── Hologramas: silueta y emblema propios (Claude y ChatGPT no son el mismo maniquí) ──
  if (tipo === "holograma") {
    const ves = vestuarioDe(p.id)
    // En el holograma solo cuenta la luminancia del color: lo claro se ve más opaco y brillante.
    const claro = rgba(ap.ropa.color2 ?? "#ffffff")
    const blanco = rgba("#ffffff")
    if (ves.abrigo) {
      // Abrigo largo literario: abierto adelante, hasta la rodilla, suelto, con cuello chal.
      const yR = 0.27 * Hh
      const abre = (y: number) => 0.32 + 0.22 * suave(0.62 * Hh, yR, y)
      S.tronco({
        y0: yR,
        y1: 0.836 * Hh,
        // (con 40 columnas y paso 3,4 cm Claude pasaba el tope de 25.000 triángulos)
        paso: 0.042,
        arco: (y) => [FRENTE + abre(y), FRENTE + DOS_PI - abre(y)],
        cols: 32,
        holgura: (y) => 0.02 + 0.012 * suave(0.6 * Hh, 0.45 * Hh, y),
        bultos: 0.3,
        vuelo: (y) => 0.3 * Math.pow(suave(0.52 * Hh, yR, y), 0.85),
        pliegues: (y, a) => 0.008 * suave(0.55 * Hh, yR, y) * Math.sin(a * 7 + y * 9),
        color: (y, a) => {
          const d = Math.abs(normAng(a) - FRENTE)
          return d < abre(y) + 0.09 || y < yR + 0.02 * s ? blanco : claro
        },
        mat: MAT_LANA,
      })
      S.tapaFalda(yR)
      mangas(claro, 9, 0.02, { mat: MAT_LANA, ancha: 0.012, puno: blanco })
      // Cuello chal: una banda que sube por detrás del cuello y baja por los bordes hasta la cintura.
      S.cuello({ y0: 0.815 * Hh, y1: () => 0.84 * Hh + 0.03 * s, arco: [FRENTE + 0.4, FRENTE + DOS_PI - 0.4], holg0: 0.03, holg1: 0.02, color: blanco, mat: MAT_LANA, filas: 2 })
      for (const lado of [1, -1] as const) {
        S.tira({
          filas: 8,
          cols: 2,
          grosor: 0.004,
          pos: (t, w, out) => {
            const y = lerp(0.835 * Hh, 0.6 * Hh, t)
            const a = FRENTE + lado * (abre(y) + 0.04 + ((w + 1) / 2) * 0.32 * (1 - 0.7 * t))
            return S.punto(y, a, 0.3, 0.03 + 0.006 * (1 - t), out)
          },
          normal: (t, w, out) => {
            const y = lerp(0.835 * Hh, 0.6 * Hh, t)
            S.punto(y, FRENTE + lado * (abre(y) + 0.15), 0.3, 0, _v)
            return out.copy(_n)
          },
          color: () => blanco,
          mat: MAT_LANA,
          pesos: (pt) => cu.pesosTronco(pt.x, Math.min(pt.y, 0.83 * Hh), pt.z),
        })
      }
    }
    if (ves.chaquetaMao) {
      // Chaqueta corta entallada, cuello alto, cierre en diagonal y hombreras rectas.
      const yR = 0.5 * Hh
      const cierre = (y: number) => FRENTE - 0.55 + 0.75 * clamp((y - yR) / (0.83 * Hh - yR), 0, 1)
      S.tronco({
        y0: yR,
        y1: 0.836 * Hh,
        paso: 0.03,
        holgura: (y, a) => {
          const hombro = suave(0.775 * Hh, 0.815 * Hh, y) * suave(0.45, 0.85, Math.abs(Math.cos(a)))
          return 0.014 + 0.004 * suave(0.6 * Hh, 0.5 * Hh, y) + 0.016 * hombro
        },
        bultos: 0.35,
        tope: (a) => 0.836 * Hh - 0.012 * Hh * Math.pow(Math.max(0, Math.sin(a)), 3),
        color: (y, a) => (Math.abs(normAng(a) - cierre(y)) < 0.045 || y < yR + 0.012 * s || Math.abs(Math.abs(Math.cos(a)) - 0.62) < 0.02 ? blanco : claro),
        mat: MAT_LANA,
      })
      mangas(claro, 9, 0.016, { mat: MAT_LANA, puno: blanco })
      S.cuello({ y0: 0.825 * Hh, y1: (a) => 0.85 * Hh + 0.035 * s - 0.01 * s * Math.pow(Math.max(0, Math.sin(a)), 4), holg0: 0.014, holg1: 0.01, color: blanco, mat: MAT_LANA, filas: 3, tapa: true })
    }
    if (ves.emblema === "chispa") {
      // La chispa de Claude: asterisco de diez rayos de punta redonda, detrás de la cabeza (35 cm).
      const N = 10
      // (más grande que la cabeza: con 22 cm quedaba tapado por ella)
      const cz = -0.2
      const cy = 0.035
      for (let i = 0; i < N; i++) {
        const fi = (i / N) * DOS_PI + 0.12
        const dx = Math.cos(fi)
        const dy = Math.sin(fi)
        S.tira({
          filas: 4,
          cols: 2,
          grosor: 0.006,
          pos: (t, w, out) => {
            const r = lerp(0.03, 0.175, t)
            const ancho = 0.014 * (1 - 0.3 * t) * (t > 0.85 ? Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)) * 0.9 + 0.1 : 1)
            return cab.aAvatar(dx * r - dy * w * ancho, cy + dy * r + dx * w * ancho, cz, out)
          },
          normal: (t, w, out) => out.set(0, 0, -1),
          color: () => blanco,
          mat: MAT_LANA,
          pesos: pesoCab,
        })
      }
    }
    if (ves.emblema === "nudo") {
      // El nudo de ChatGPT: seis lazos entrelazados (14 cm), flotando delante del pecho.
      S.punto(0.715 * Hh, FRENTE, 0.3, 0.04, _v)
      const c0 = _v.clone()
      const pw = cu.pesosTronco(0, 0.715 * Hh, 0.1)
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * DOS_PI
        const pts: THREE.Vector3[] = []
        for (let k = 0; k < 16; k++) {
          const g = (k / 16) * DOS_PI
          const ex = 0.036 * s * Math.cos(g)
          const ey = 0.014 * s * Math.sin(g)
          const ox = 0.022 * s
          const x = (ox + ex) * Math.cos(th) - ey * Math.sin(th)
          const y = (ox + ex) * Math.sin(th) + ey * Math.cos(th)
          pts.push(new THREE.Vector3(c0.x + x, c0.y + y, c0.z + 0.004 * Math.sin(g * 2 + i)))
        }
        S.cordon(pts, 0.0055 * s, blanco, MAT_LANA, () => pw, true, 4)
      }
    }
  }

  const capucha = vestuarioDe(p.id).capucha
  if (capucha) {
    S.tela(TELA.fieltro)
    const L = S.lote
    const ct = rgba(capucha.color)
    const cr = capucha.ribete ? rgba(capucha.ribete) : ct
    const NT = 20
    const NA = 44
    const centro = new THREE.Vector3(0, 0.012, -0.012)
    const dir = new THREE.Vector3()
    const pt = new THREE.Vector3()
    const FR = Math.PI / 2
    const hueco = (y: number) => {
      // Medio ancho (rad) de la abertura de la cara a la altura y (local): una
      // ojiva con la punta sobre la línea de los ojos, que se abre hasta el
      // mentón (la frente y los ojos quedan en la sombra de la tela).
      const yTop = -0.012
      const yBot = -0.16
      if (y > yTop || y < yBot) return 0
      const u = (yTop - y) / (yTop - yBot)
      return 0.62 * Math.pow(Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5), 0.9) * (1 - 0.3 * suave(0.8, 1, u))
    }
    const ext: number[][] = []
    const int: number[][] = []
    // Punto de la capucha en la dirección (th, a), en coordenadas de la cabeza.
    const puntoCap = (th: number, a: number, out: THREE.Vector3) => {
      dir.set(Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a))
      const t = cab.rayo(centro.x, centro.y, centro.z, dir.x, dir.y, dir.z, 0.2)
      // Holgura: más arriba y adelante (el pico de la capucha sobresale sobre la frente).
      const adelante = Math.pow(Math.max(0, Math.sin(a)), 2) * suave(2.0, 1.0, th)
      // Punta blanda que cae hacia atrás (no un cono de mago arriba).
      const atras = Math.pow(Math.max(0, -Math.sin(a)), 3) * campana(th, 0.75, 0.38)
      const r = Math.max(t, 0.07) + 0.03 + 0.04 * adelante + 0.045 * atras + 0.012 * suave(1.6, 2.6, th) - 0.012 * suave(0.5, 0.0, th) + 0.016 * Math.abs(Math.cos(a)) * campana(th, 0.65, 0.35)
      out.copy(dir).multiplyScalar(r).add(centro)
      out.y -= 0.02 * atras
      // Abajo, la tela cae hacia los hombros (se abre).
      const caida = suave(2.0, 2.75, th)
      out.x *= 1 + 0.55 * caida
      out.z = out.z * (1 + 0.25 * caida) - 0.01 * caida
      out.y -= 0.035 * caida
      return out
    }
    for (let i = 0; i <= NT; i++) {
      const th = (i / NT) * (158 * Math.PI) / 180
      // La abertura de esta fila: las columnas cubren solo el arco cerrado, así
      // el borde de la cara es limpio (cortar cuadriláteros lo dejaba en escalones).
      const h = hueco(puntoCap(th, FR, pt).y)
      const fe: number[] = []
      const fi: number[] = []
      for (let k = 0; k <= NA; k++) {
        const a = FR + h + (k / NA) * (DOS_PI - 2 * h)
        puntoCap(th, a, pt)
        const borde = h > 0.02 && (k === 0 || k === NA)
        const col = borde ? cr : ct
        const wCuello = suave(-0.07, -0.16, pt.y)
        const pw: Pesos = wCuello > 0 ? [[H.cabeza, 1 - wCuello], [H.cuello, wCuello * 0.6], [H.pecho, wCuello * 0.4]] : pesoCab()
        cab.aAvatar(pt.x, pt.y, pt.z, _v)
        fe.push(L.v(_v.x, _v.y, _v.z, k / NA, i / NT, col, pw, [0.95, 0]))
        // Adentro: 4 mm hacia el centro, casi negro (la sombra de la tela).
        pt.sub(centro).multiplyScalar(1 - 0.004 / Math.max(0.05, pt.length())).add(centro)
        cab.aAvatar(pt.x, pt.y, pt.z, _v)
        fi.push(L.v(_v.x, _v.y, _v.z, k / NA, i / NT, borde ? cr : escalarRGBA(ct, 0.3), pw, [0.95, 0]))
      }
      ext.push(fe)
      int.push(fi)
    }
    // Orientación: la cara de afuera mira lejos del centro de la cabeza (se mira atrás, sin abertura).
    const P = L.pos
    const iA = ext[10][NA >> 1], iB = ext[10][(NA >> 1) + 1], iD = ext[11][NA >> 1]
    const e1 = new THREE.Vector3(P[iB * 3] - P[iA * 3], P[iB * 3 + 1] - P[iA * 3 + 1], P[iB * 3 + 2] - P[iA * 3 + 2])
    const e2 = new THREE.Vector3(P[iD * 3] - P[iA * 3], P[iD * 3 + 1] - P[iA * 3 + 1], P[iD * 3 + 2] - P[iA * 3 + 2])
    const cAv = cab.aAvatar(centro.x, centro.y, centro.z, new THREE.Vector3())
    const rad = new THREE.Vector3(P[iA * 3] - cAv.x, P[iA * 3 + 1] - cAv.y, P[iA * 3 + 2] - cAv.z)
    const afuera = e1.cross(e2).dot(rad) > 0
    L.tiras(ext, false, { invertir: !afuera })
    L.pieza()
    L.tiras(int, false, { invertir: afuera })
    L.pieza()
  }
  if (acc.has("faja")) banda(-1, 0.075 * s, holgTraje(0.7 * Hh, 0) + 0.004, (w) => (Math.abs(w) > 0.7 ? rgba("#d4aa48") : rgba(ap.ropa.corbata ?? "#1e3a8a")), { tela: TELA.seda, pl: PL(5, 0.3) })
  S.tela(TELA.liso)
  if (acc.has("collar_oro") && tipo !== "vestido_egipcio") {
    const pts: THREE.Vector3[] = []
    const holg = tipo === "traje" ? holgTraje(0.8 * Hh, 0) + 0.006 : 0.016
    for (let k = 0; k < 40; k++) {
      const a = -Math.PI / 2 + (k / 40) * DOS_PI
      const fr = Math.pow(Math.max(0, Math.sin(a)), 3)
      const y = 0.822 * Hh - 0.07 * Hh * fr
      pts.push(S.punto(y, a, 0.3, holg, new THREE.Vector3()).clone())
    }
    S.cordon(pts, 0.0035 * s, rgba("#d4aa48"), MAT_ORO, (pt) => cu.pesosTronco(pt.x, pt.y, pt.z), true, 5)
    S.punto(0.75 * Hh, FRENTE, 0.3, holg + 0.002, _v)
    S.boton(_v.clone(), _n.clone(), 0.02 * s, 0.004, rgba("#d4aa48"), MAT_ORO, cu.pesosTronco(0, 0.75 * Hh, 0.1), 12)
  }
  if (acc.has("reloj")) {
    const c = cu.brazos[0]
    S.tubo({ cadena: "brazo", lado: 1, u0: c.u[3] - 0.03 * s, u1: c.u[3] - 0.012 * s, paso: 0.009, holgura: () => 0.006, color: () => rgba("#c9a24a"), mat: MAT_ORO, tapa: false })
  }
  // Gafas: montura (aquí) y cristales (lote aparte, transparente).
  if (acc.has("gafas") || acc.has("gafas_redondas") || acc.has("gafas_sol")) {
    const sol = acc.has("gafas_sol")
    const red = acc.has("gafas_redondas")
    const o = cab.ojo
    // Delante de la piel: con pómulos o cejas salientes el cristal quedaba
    // detrás de la mejilla y se veía recortado en escalones.
    let zL = o.z + o.r + 0.0115
    for (const sx of [0.6, 1, 1.4]) for (const sy of [-0.018, -0.006, 0.008]) {
      const t = cab.rayo(sx * o.x, o.y + sy, 0, 0, 0, 1, 0.16)
      zL = Math.max(zL, t + 0.0045)
    }
    const lote = new Lote()
    // Sin aro (Jobs): solo un filo plateado finísimo que marca el borde del cristal.
    const sinAro = !!vestuarioDe(p.id).gafasSinAro
    // (androide: alambre plateado y metálico)
    const montura = rgba(tipo === "androide" ? MONTURA_ANDROIDE.color : sinAro ? "#b8b8b8" : red ? "#3a332c" : sol ? "#0f0f10" : "#1c1c1e")
    const matMontura = tipo === "androide" ? MONTURA_ANDROIDE.mat : MAT_BOTON
    for (const lado of [1, -1] as const) {
      const cx = lado * (o.x + 0.002)
      const cy = o.y - 0.001
      const rx = (red ? 0.0205 : sol ? 0.027 : 0.0255)
      const ry = red ? 0.0205 : sol ? 0.021 : 0.0165
      const pts: THREE.Vector3[] = []
      const lente: number[] = []
      cab.aAvatar(cx, cy, zL + 0.001, _v)
      const cen = lote.v(_v.x, _v.y, _v.z, 0, 0, [1, 1, 1, 1], pesoCab(), [0.05, 0])
      for (let k = 0; k < 24; k++) {
        const g = (k / 24) * DOS_PI
        let px = Math.cos(g)
        let py = Math.sin(g)
        if (!red) {
          // Rectángulo redondeado (o gota en las de sol).
          const e = sol ? 3 : 4
          px = Math.sign(px) * Math.pow(Math.abs(px), 2 / e)
          py = Math.sign(py) * Math.pow(Math.abs(py), 2 / e)
          if (sol && py < 0) px *= 1 - 0.25 * -py
        }
        const x = cx + px * rx
        const y = cy + py * ry
        const z = zL - 0.004 * px * px * (lado * px > 0 ? 1 : 0.3)
        pts.push(cab.aAvatar(x, y, z, new THREE.Vector3()))
        cab.aAvatar(x, y, z + 0.0005, _v)
        lente.push(lote.v(_v.x, _v.y, _v.z, 0, 0, [1, 1, 1, 1], pesoCab(), [0.05, 0]))
      }
      for (let k = 0; k < 24; k++) lote.t(cen, lente[k], lente[(k + 1) % 24])
      S.cordon(pts, sinAro ? 0.00045 * cab.hs : red ? 0.0011 * cab.hs : 0.0017 * cab.hs, montura, matMontura, pesoCab, true, sinAro ? 3 : 5)
      // Patilla hacia la oreja.
      const pat: THREE.Vector3[] = []
      for (let k = 0; k <= 6; k++) {
        const t = k / 6
        const z = lerp(zL - 0.004, -0.004, t)
        const yl = cy + 0.004 + 0.002 * t
        const tt = cab.rayo(0, yl, z, lado, 0, 0, 0.12)
        pat.push(cab.aAvatar(lado * (tt + 0.004 + 0.012 * (1 - t) * (1 - t)) , yl, z, new THREE.Vector3()))
      }
      pat[0] = cab.aAvatar(cx + lado * rx, cy + 0.004, zL - 0.004, new THREE.Vector3())
      S.cordon(pat, 0.0013 * cab.hs, montura, matMontura, pesoCab, false, 4)
    }
    // Puente
    S.cordon([cab.aAvatar(0.012, o.y + 0.003, zL + 0.002, new THREE.Vector3()), cab.aAvatar(0, o.y + 0.005, zL + 0.006, new THREE.Vector3()), cab.aAvatar(-0.012, o.y + 0.003, zL + 0.002, new THREE.Vector3())], 0.0013 * cab.hs, montura, matMontura, pesoCab, false, 4)
    lote.pieza()
    lentes = { lote, sol }
  }
  // Utilería en la mano izquierda.
  const enMano = acc.has("pergamino") ? "pergamino" : acc.has("cuaderno") ? "cuaderno" : acc.has("laptop") ? "laptop" : null
  if (enMano) {
    const U = new Sastre(cu)
    U.tela(enMano === "laptop" ? TELA.liso : enMano === "cuaderno" ? TELA.cuero : TELA.popelina)
    const c = cu.brazos[0]
    const m: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }
    c.marco(c.largo - 0.03 * s, m)
    const pw: Pesos = [[H.manoI, 1]]
    const centro = m.c.clone().addScaledVector(m.L, -0.03 * s)
    if (enMano === "pergamino") {
      const pts = [centro.clone().addScaledVector(m.N, -0.13 * s), centro.clone().addScaledVector(m.N, 0.13 * s)]
      U.cordon(pts, 0.017 * s, rgba("#e6d6ad"), [0.85, 0], () => pw, false, 10)
      for (const pt of pts) U.boton(pt, pt.clone().sub(centro).normalize(), 0.02 * s, 0.006, rgba("#7a5230"), MAT_CUERO, pw, 10)
    } else {
      // Cuaderno o laptop: una tapa contra el costado de la mano.
      const alto = enMano === "laptop" ? 0.24 : 0.2
      const ancho = enMano === "laptop" ? 0.32 : 0.14
      const grosor = enMano === "laptop" ? 0.016 : 0.022
      const col = enMano === "laptop" ? rgba("#b8bcc3") : rgba("#5a3a22")
      U.tira({
        filas: 1,
        cols: 1,
        grosor: grosor * s,
        pos: (t, w, out) => out.copy(centro).addScaledVector(m.N, w * ancho * 0.5 * s).addScaledVector(m.T, (t - 0.35) * alto * s),
        normal: (t, w, out) => out.copy(m.L).multiplyScalar(-1),
        color: () => col,
        mat: enMano === "laptop" ? [0.35, 0.7] : [0.6, 0],
        pesos: () => pw,
      })
    }
    utileria = U.lote
  }

  // ── Guan (Sun Tzu): tapa laqueada sobre el moño y pasador horizontal dorado ──
  S.tela(TELA.liso)
  const guan = vestuarioDe(p.id).guan
  const monoF = cu.rasgos.f.pelo.mono
  if (guan && monoF) {
    const tB = cab.rayo(0, 0, 0, 0, 1, -0.15, 0.2)
    const bx = 0
    const by = tB * 0.99
    const bz = -0.15 * tB * 0.99
    const rG = monoF.radio * 1.18
    const cG = rgba(guan.color)
    const L = S.lote
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    // Perfil: abre un poco abajo, lados rectos, tapa plana con borde redondeado.
    const perfil: Array<[number, number]> = [[0.28, 1.0], [0.34, 1.04], [0.9, 1.02], [1.06, 0.92], [1.1, 0.55], [1.11, 0.02]]
    for (const [h, rr] of perfil) {
      const fila: number[] = []
      for (let k = 0; k < 16; k++) {
        const g = (k / 16) * DOS_PI
        cab.aAvatar(bx + Math.cos(g) * rG * rr, by + h * monoF.alto, bz + Math.sin(g) * rG * rr * 0.9, _v)
        fila.push(L.v(_v.x, _v.y, _v.z, k / 16, h, cG, pesoCab(), [0.32, 0]))
      }
      ids.push(fila)
      centros.push(cab.aAvatar(bx, by + h * monoF.alto, bz, new THREE.Vector3()))
    }
    L.tiras(ids, true, { centros })
    L.pieza()
    // Pasador: de lado a lado, atravesando la tapa.
    const largoP = rG * 3.2
    const p0 = cab.aAvatar(bx - largoP / 2, by + 0.62 * monoF.alto, bz, new THREE.Vector3())
    const p1 = cab.aAvatar(bx + largoP / 2, by + 0.62 * monoF.alto, bz, new THREE.Vector3())
    const dirP = p1.clone().sub(p0)
    const lP = dirP.length()
    S.boton(p0, dirP.normalize(), 0.0026 * cab.hs, lP, rgba(guan.pasador), MAT_ORO, pesoCab(), 6)
  }

  // ── Sombreros (pesos: cabeza) ──
  let altoSombrero = 0
  const sombrero = ap.sombrero
  if (sombrero) {
    // Radio del borde: la cabeza + el pelo a la altura de la frente.
    const yB = 0.058
    let rx = 0
    let rz = 0
    for (let k = 0; k < 16; k++) {
      const g = (k / 16) * DOS_PI
      const dx = Math.cos(g)
      const dz = Math.sin(g)
      const t = cab.rayo(0, yB, -0.004, dx, 0, dz, 0.14)
      const [, gr] = peloEn(cab, dx * t, yB, dz * t - 0.004)
      const r = t + gr + 0.004
      rx = Math.max(rx, Math.abs(dx) * r)
      rz = Math.max(rz, Math.abs(dz) * r)
    }
    const negroF = rgba("#111113")
    const hs = cab.hs
    const anillo = (y: number, sx: number, sz: number, z0 = -0.004) => (g: number, out: THREE.Vector3) => cab.aAvatar(Math.cos(g) * sx, y, z0 + Math.sin(g) * sz, out)
    const cilindro = (filas: Array<[y: number, sx: number, sz: number]>, color: RGBA, mat: Mat2, tapaArriba: boolean) => {
      const L = S.lote
      const ids: number[][] = []
      const centros: THREE.Vector3[] = []
      for (const [y, sx, sz] of filas) {
        const fila: number[] = []
        for (let k = 0; k < 32; k++) {
          const g = (k / 32) * DOS_PI
          anillo(y, sx, sz)(g, _v)
          fila.push(L.v(_v.x, _v.y, _v.z, k / 32, y, color, pesoCab(), mat))
        }
        ids.push(fila)
        centros.push(cab.aAvatar(0, y, -0.004, new THREE.Vector3()))
      }
      L.tiras(ids, true, { centros })
      if (tapaArriba) {
        const [y] = filas[filas.length - 1]
        const c = cab.aAvatar(0, y, -0.004, new THREE.Vector3())
        const ci = L.v(c.x, c.y, c.z, 0, 0, color, pesoCab(), mat)
        const f = ids[ids.length - 1]
        for (let k = 0; k < 32; k++) L.t(ci, f[(k + 1) % 32], f[k])
      }
      L.pieza()
    }
    S.tela(sombrero === "corona_egipcia" || sombrero === "laurel" ? TELA.liso : sombrero === "gorra" ? TELA.jersey : TELA.fieltro)
    switch (sombrero) {
      case "chistera": {
        const h = 0.17
        // 7 mm más abajo que el borde medido: el ala se apoya en el pelo (antes
        // quedaba una franja de frente clara entre el pelo y el ala).
        const yC = yB - 0.007
        const ex = 0.002
        cilindro([[yC - 0.006, rx + 0.032, rz + 0.04], [yC - 0.002, rx + 0.036, rz + 0.044], [yC, rx + 0.03, rz + 0.038], [yC + 0.002, rx + ex, rz + ex], [yC + 0.03, rx - 0.001 + ex, rz - 0.001 + ex], [yC + 0.032, rx - 0.0005 + ex, rz - 0.0005 + ex], [yC + h, rx + 0.006 + ex, rz + 0.006 + ex], [yC + h + 0.002, rx + 0.004 + ex, rz + 0.004 + ex]], negroF, [0.4, 0], true)
        // Cinta
        cilindro([[yC + 0.004, rx + 0.0015 + ex, rz + 0.0015 + ex], [yC + 0.028, rx + 0.0015 + ex, rz + 0.0015 + ex]], rgba("#1d1d22"), [0.6, 0], false)
        altoSombrero = (yC + h - 0.123) * hs
        break
      }
      case "bicornio": {
        // Bicornio "en bataille": media luna de fieltro de ~44 cm de punta a punta
        // y ~16 cm de alto en el centro, puesto de costado (las puntas sobre los
        // hombros). Dos caras (adelante y atrás) que se abren abajo para la
        // cabeza y se juntan arriba y en las puntas; escarapela tricolor a la
        // izquierda. (Antes medía lo mismo que la cabeza y se leía como gorra.)
        const largo = Math.max(rx * 2.7, 0.44)
        const alto = 0.135
        // (4 mm más abajo: flotaba sobre el pelo; copa de lados rectos y puntas
        // que suben, en fieltro duro: con la copa redonda se leía como una cúpula)
        const y0 = yB - 0.018
        const forma = (cara: number, t: number, v: number, out: THREE.Vector3) => {
          const u = 2 * t - 1
          const x = u * largo * 0.5
          // (arco de media luna, exponente 0,62, con el borde de abajo que sube hacia
          // las puntas: con 0,38 la copa era plana arriba y de frente se leía como
          // una losa negra rectangular)
          const u6 = u * u * u * u * u * u
          const tope = y0 + 0.016 + alto * Math.pow(Math.max(0, 1 - u * u), 0.62) + 0.035 * u6
          const y = lerp(y0 + 0.012 * u * u + 0.035 * u6, tope, v)
          const base = Math.sqrt(Math.max(0, 1 - (x / (rx * 1.04)) ** 2)) * rz * 1.05
          // Las alas se abren un poco hacia afuera abajo y se curvan al juntarse arriba.
          // (+14 mm sobre el cráneo: con 8 mm el mechón de la frente atravesaba el fieltro)
          const z = -0.004 + cara * ((base + 0.014) * Math.pow(1 - v, 0.8) + 0.004 * Math.sin(Math.PI * v) * (1 - u * u))
          return cab.aAvatar(x, y, z, out)
        }
        const _a = new THREE.Vector3()
        const _b = new THREE.Vector3()
        for (const cara of [1, -1]) {
          S.tira({
            filas: 22,
            cols: 6,
            grosor: 0.0035 * hs,
            pos: (t, w, out) => forma(cara, t, (w + 1) / 2, out),
            normal: (t, w, out) => {
              const v = (w + 1) / 2
              forma(cara, Math.min(1, t + 0.01), v, _a).sub(forma(cara, Math.max(0, t - 0.01), v, _b))
              const dt = _a.clone()
              forma(cara, t, Math.min(1, v + 0.02), _a).sub(forma(cara, t, Math.max(0, v - 0.02), _b))
              out.crossVectors(dt, _a).normalize()
              if (out.z * cara < 0) out.negate()
              return out
            },
            color: () => negroF,
            mat: [0.85, 0],
            pesos: () => pesoCab(),
          })
        }
        // Escarapela tricolor sobre la cara de adelante, del lado izquierdo.
        const tc = 0.5 + 0.075 / largo
        const pc = forma(1, tc, 0.58, new THREE.Vector3())
        const nc = forma(1, tc, 0.6, new THREE.Vector3()).sub(forma(1, tc, 0.56, _b))
        const tg = forma(1, tc + 0.01, 0.58, _a).sub(pc)
        const ncar = new THREE.Vector3().crossVectors(tg, nc).normalize()
        if (ncar.z < 0) ncar.negate()
        pc.addScaledVector(ncar, 0.004 * hs)
        for (const [r, c, dz] of [[0.024, "#1f3a8a", 0], [0.016, "#f4f4f2", 0.0016], [0.008, "#c8102e", 0.0032]] as const) {
          S.boton(pc.clone().addScaledVector(ncar, dz * hs), ncar, r * hs, 0.0016 * hs, rgba(c), [0.7, 0], pesoCab(), 14)
        }
        altoSombrero = (y0 + 0.016 + alto - 0.123) * hs
        break
      }
      case "boina": {
        // Gorro blando renacentista: banda ceñida y una copa de tela ancha y
        // floja que cae hacia un costado (como la estatua de los Uffizi), no un disco.
        const L = S.lote
        const filas: Array<[y: number, sx: number, sz: number, cae: number]> = [
          [yB - 0.004, rx + 0.003, rz + 0.003, 0],
          [yB + 0.012, rx + 0.004, rz + 0.004, 0.1],
          [yB + 0.026, rx + 0.022, rz + 0.02, 0.45],
          [yB + 0.042, rx + 0.034, rz + 0.03, 0.8],
          [yB + 0.06, rx + 0.032, rz + 0.028, 1],
          [yB + 0.076, rx + 0.016, rz + 0.014, 1],
          [yB + 0.084, rx * 0.55, rz * 0.55, 1],
          [yB + 0.087, 0.002, 0.002, 1],
        ]
        const col = escalarRGBA(rgba("#2a221d"), 1)
        const ids: number[][] = []
        const centros: THREE.Vector3[] = []
        for (const [y, sx, sz, cae] of filas) {
          const fila: number[] = []
          for (let k = 0; k < 32; k++) {
            const g = (k / 32) * DOS_PI
            const x = Math.cos(g) * sx + 0.016 * cae
            const z = -0.004 + Math.sin(g) * sz
            // Cae hacia la izquierda del personaje (+x) y un poco atrás; pliegues suaves.
            const yy = y - 0.03 * cae * Math.max(0, x / (rx + 0.03)) - 0.006 * cae * Math.max(0, -Math.sin(g)) + 0.0025 * cae * Math.sin(g * 5)
            cab.aAvatar(x, yy, z, _v)
            fila.push(L.v(_v.x, _v.y, _v.z, k / 32, y, col, pesoCab(), [0.95, 0]))
          }
          ids.push(fila)
          centros.push(cab.aAvatar(0.016 * cae, y - 0.01, -0.004, new THREE.Vector3()))
        }
        L.tiras(ids, true, { centros })
        L.pieza()
        altoSombrero = 0.02
        break
      }
      case "gorra": {
        cilindro([[yB - 0.004, rx + 0.003, rz + 0.003], [yB + 0.04, rx * 0.92, rz * 0.92], [yB + 0.065, rx * 0.55, rz * 0.55], [yB + 0.072, 0.001, 0.001]], C2, [0.9, 0], false)
        altoSombrero = 0.01
        break
      }
      case "corona_egipcia": {
        // (#d4aa48 metálico reflejaba el cielo azul y salía verde limón)
        const oro = rgba("#d09a3c")
        cilindro([[yB - 0.002, rx + 0.002, rz + 0.002], [yB + 0.016, rx + 0.002, rz + 0.002]], oro, MAT_ORO, false)
        // Ureo (cobra) al frente.
        const base = cab.aAvatar(0, yB + 0.012, rz + 0.002 - 0.004, new THREE.Vector3())
        // Ureo: la cobra erguida (~5 cm), con el cuerpo en S y la capucha abierta.
        const pts = [base, cab.aAvatar(0, yB + 0.022, rz + 0.012 - 0.004, new THREE.Vector3()), cab.aAvatar(0, yB + 0.036, rz + 0.006 - 0.004, new THREE.Vector3()), cab.aAvatar(0, yB + 0.05, rz + 0.012 - 0.004, new THREE.Vector3())]
        S.cordon(pts, 0.0062 * hs, oro, MAT_ORO, pesoCab, false, 8)
        const capu = cab.aAvatar(0, yB + 0.044, rz + 0.012 - 0.004, new THREE.Vector3())
        S.boton(capu, new THREE.Vector3(0, 0.25, 1).normalize(), 0.013 * hs, 0.003 * hs, oro, MAT_ORO, pesoCab(), 12)
        const cabeza = cab.aAvatar(0, yB + 0.058, rz + 0.016 - 0.004, new THREE.Vector3())
        S.boton(cabeza, new THREE.Vector3(0, 0.5, 1).normalize(), 0.006 * hs, 0.004 * hs, oro, MAT_ORO, pesoCab(), 8)
        altoSombrero = 0
        break
      }
      case "laurel": {
        // Corona de laurel: dos ramas que nacen en la nuca (atadas con una
        // cinta) y se encuentran sobre la frente; hojas de ~3 cm en dos hileras,
        // apoyadas sobre el pelo y abiertas hacia arriba. Cada hoja es un rombo
        // con nervio (dos caras), no un trazo: así se lee como laurel a distancia.
        const L = S.lote
        const verdes = [rgba("#4f6b2a"), rgba("#5d7a32"), rgba("#43602a")]
        const yL = yB + 0.006
        const ra = rx + 0.006
        const rb = rz + 0.006
        const radial = new THREE.Vector3()
        const tang = new THREE.Vector3()
        const dir = new THREE.Vector3()
        const lat = new THREE.Vector3()
        const pt = (g: number, out: THREE.Vector3) => cab.aAvatar(Math.cos(g) * ra, yL + 0.008 * Math.sin(g), -0.004 + Math.sin(g) * rb, out)
        const p0 = new THREE.Vector3()
        const p1 = new THREE.Vector3()
        let n = 0
        for (const lado of [1, -1]) {
          // g: ángulo alrededor de la cabeza (π/2 = frente). De la nuca (-π/2) hacia la frente.
          const nHojas = 13
          for (let i = 0; i < nHojas; i++) {
            const f = i / (nHojas - 1)
            const g = lado > 0 ? lerp(-Math.PI / 2 + 0.12, Math.PI / 2 - 0.2, f) : lerp(-Math.PI / 2 - 0.12, -Math.PI * 1.5 + 0.2, f)
            pt(g, p0)
            // Hacia la frente siguiendo el aro.
            pt(g + (lado > 0 ? 0.05 : -0.05), p1)
            tang.subVectors(p1, p0).normalize()
            radial.set(Math.cos(g), 0, Math.sin(g))
            for (const fila of [1, -1]) {
              const largo = (0.03 + 0.004 * Math.sin(i * 2.3)) * hs * (fila > 0 ? 1 : 0.85)
              const ancho = 0.012 * hs * (fila > 0 ? 1 : 0.85)
              dir.copy(tang).multiplyScalar(0.8).addScaledVector(new THREE.Vector3(0, 1, 0), fila > 0 ? 0.55 : -0.2).addScaledVector(radial, 0.12).normalize()
              lat.crossVectors(dir, radial).normalize()
              const base = p0.clone().addScaledVector(radial, 0.002 * hs).addScaledVector(new THREE.Vector3(0, 1, 0), fila > 0 ? 0.002 * hs : -0.002 * hs)
              const punta = base.clone().addScaledVector(dir, largo).addScaledVector(radial, 0.004 * hs)
              const medio = base.clone().addScaledVector(dir, largo * 0.42).addScaledVector(radial, 0.0035 * hs)
              const c = verdes[(n++) % 3]
              const pw = pesoCab()
              const m1 = medio.clone().addScaledVector(lat, ancho * 0.5)
              const m2 = medio.clone().addScaledVector(lat, -ancho * 0.5)
              medio.addScaledVector(radial, 0.0012 * hs)
              // Las dos caras (sin material de doble cara): la de atrás con sus propios
              // vértices, apenas hundidos, para que las normales no se anulen al soldar.
              for (const cara of [1, -1]) {
                const k = cara > 0 ? 0 : -0.0007 * hs
                const vb = L.v(base.x + radial.x * k, base.y, base.z + radial.z * k, 0, 0, c, pw, [0.55, 0])
                const vp = L.v(punta.x + radial.x * k, punta.y, punta.z + radial.z * k, 0, 1, c, pw, [0.55, 0])
                const vm = L.v(medio.x + radial.x * k, medio.y, medio.z + radial.z * k, 0.5, 0.42, escalarRGBA(c, cara > 0 ? 1.15 : 0.8), pw, [0.5, 0])
                const v1 = L.v(m1.x + radial.x * k, m1.y, m1.z + radial.z * k, 1, 0.42, c, pw, [0.55, 0])
                const v2 = L.v(m2.x + radial.x * k, m2.y, m2.z + radial.z * k, 0, 0.42, c, pw, [0.55, 0])
                // Afuera: la normal mira lejos de la cabeza (se comprueba con el radial).
                const e1 = new THREE.Vector3().subVectors(m1, base)
                const e2 = new THREE.Vector3().subVectors(punta, base)
                const afuera = e1.cross(e2).dot(radial) * cara > 0
                if (afuera) { L.t(vb, v1, vm); L.t(vm, v1, vp); L.t(vb, vm, v2); L.t(vm, vp, v2) }
                else { L.t(vb, vm, v1); L.t(vm, vp, v1); L.t(vb, v2, vm); L.t(vm, v2, vp) }
              }
            }
          }
        }
        // Cinta atada en la nuca.
        const nudo = pt(-Math.PI / 2, new THREE.Vector3())
        const cinta = rgba("#b8a36a")
        for (const lado of [1, -1]) {
          const pts = [nudo.clone(), nudo.clone().add(new THREE.Vector3(lado * 0.012 * hs, -0.03 * hs, -0.006 * hs)), nudo.clone().add(new THREE.Vector3(lado * 0.02 * hs, -0.07 * hs, -0.012 * hs))]
          S.cordon(pts, 0.003 * hs, cinta, [0.6, 0], pesoCab, false, 4)
        }
        L.pieza()
        altoSombrero = 0
        break
      }
    }
  }

  // ── Cobertura de la piel ──
  const cobertura: Cobertura = {
    tronco: (y, j, cabeza) => {
      const a = ANG[j]
      if (cabeza) return S.tapaCuello.some((f) => f(y, a))
      return S.tapaTronco.some((f) => f(y, a)) || S.tapaCuello.some((f) => f(y, a))
    },
    brazo: (lado, u) => S.tapaBrazo.some((f) => f(lado, u)),
    pierna: (lado, u) => S.tapaPierna.some((f) => f(lado, u)),
    pie: !pieDescalzo,
    manos,
  }

  // Negros con información: tela ≥ 0,017 lineal (≈ #242424), cuero y charol ≥ 0,011.
  if (tipo !== "holograma") S.lote.pisoColor((t) => (t === TELA.cuero || t === TELA.charol || t === TELA.liso ? 0.011 : 0.017))
  return { lote: S.lote, utileria, lentes, cobertura, tejido, numero, altoSombrero, sombraBarba }
}

