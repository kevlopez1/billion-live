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
import { ANG, Cuerpo, H, M, mallaPie, type Cobertura, type Marco } from "./avatar-cuerpo"
import { campana, clamp, escalarRGBA, lerp, Lote, rgba, suave, type Mat2, type Pesos, type RGBA } from "./avatar-geo"
import { peloEn } from "./avatar-cabeza"
import { vestuarioDe } from "./avatar-fichas"
import type { Tejido } from "./avatar-texturas"

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
const MAT_SUELA: Mat2 = [0.7, 0]
const MAT_ORO: Mat2 = [0.36, 1]
const MAT_BOTON: Mat2 = [0.35, 0]

const _v = new THREE.Vector3()
const _n = new THREE.Vector3()

/** Columnas de las prendas cerradas: 48, más densas al frente (bastan para la tela). */
const MR = 48
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

  constructor(cu: Cuerpo) {
    this.cu = cu
    this.s = cu.s
    this.Hh = cu.H
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

  /** Pesos de una falda o faldón: cadera arriba, cada vez más muslo hacia el ruedo. */
  pesosFalda(x: number, y: number, z: number, yRuedo: number): Pesos {
    const yC = 0.5 * this.Hh
    if (y >= yC) return this.cu.pesosTronco(x, y, z)
    const t = clamp((yC - y) / Math.max(0.05, yC - yRuedo), 0, 1)
    const w = 0.6 * Math.pow(t, 0.8)
    const centro = 1 - suave(0, 0.06 * this.s, Math.abs(x))
    const L = x >= 0 ? "I" : "D"
    const O = x >= 0 ? "D" : "I"
    const p: Pesos = [[H.cadera, 1 - w], [H[`muslo${L}`], w * (1 - centro * 0.5)]]
    if (centro > 0.01) p.push([H[`muslo${O}`], w * centro * 0.5])
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
  }) {
    const L = this.lote
    const bultos = op.bultos ?? 0.35
    const paso = (op.paso ?? 0.026) * this.s
    const n = Math.max(2, Math.ceil((op.y1 - op.y0) / paso))
    const ts: number[] = []
    for (let i = 0; i <= n; i++) ts.push(i / n)
    const abierta = !!op.arco
    const cols = abierta ? op.cols ?? 44 : MR
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    for (const t of ts) {
      const fila: number[] = []
      let cz = 0
      const y0 = lerp(op.y0, op.y1, t)
      const arc = op.arco ? op.arco(y0) : null
      for (let k = 0; k < (abierta ? cols + 1 : cols); k++) {
        const a = arc ? lerp(arc[0], arc[1], k / cols) : ANG_R[k]
        const y = op.tope ? lerp(op.y0, Math.min(op.y1, op.tope(a)), t) : y0
        const vu = op.vuelo ? op.vuelo(y) : 0
        let h = op.holgura(y, a)
        if (op.pliegues) h += op.pliegues(y, a)
        this.punto(y, a, bultos, h, _v, vu)
        const c = op.color(y, a)
        const m = typeof op.mat === "function" ? op.mat(y, a) : op.mat
        const pw = y < 0.5 * this.Hh ? this.pesosFalda(_v.x, y, _v.z, op.y0) : this.cu.pesosTronco(_v.x, y, _v.z)
        fila.push(L.v(_v.x, _v.y, _v.z, a * 0.16, y, c, pw, m))
        cz += _v.z
      }
      ids.push(fila)
      centros.push(new THREE.Vector3(0, y0, cz / (abierta ? cols + 1 : cols)))
    }
    L.tiras(ids, !abierta, { centros })
    L.pieza()
    if (op.tapa !== false) {
      const arco = op.arco
      const tope = op.tope
      const y0 = op.y0
      const y1 = op.y1
      this.tapaTronco.push((y, a) => {
        if (y < y0 + 0.01 || y > (tope ? Math.min(y1, tope(a)) : y1) - 0.012) return false
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
  }) {
    const cu = this.cu
    const c = op.cadena === "brazo" ? cu.brazos[op.lado > 0 ? 0 : 1] : cu.piernas[op.lado > 0 ? 0 : 1]
    const paso = (op.paso ?? 0.032) * this.s
    const n = Math.max(2, Math.ceil((op.u1 - op.u0) / paso))
    const cols = op.cols ?? 16
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const m: Marco = { c: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() }
    for (let i = 0; i <= n; i++) {
      const u = lerp(op.u0, op.u1, i / n)
      c.marco(u, m)
      const r = op.cadena === "brazo" ? cu.radiosBrazo(u) : cu.radiosPierna(u)
      const fila: number[] = []
      for (let k = 0; k < cols; k++) {
        const a = (k / cols) * DOS_PI
        const h = op.holgura(u, a)
        Cuerpo.puntoAnillo(m, [r[0] + h, r[1] + h, r[2] + h, r[3] + h], a, 2.2, _v)
        const pw = op.cadena === "brazo" ? cu.pesosBrazo(op.lado, u) : cu.pesosPierna(op.lado, u, Math.sin(a))
        fila.push(this.lote.v(_v.x, _v.y, _v.z, (k / cols) * 0.28, u, op.color(u, a), pw, op.mat))
      }
      ids.push(fila)
      centros.push(m.c.clone())
    }
    this.lote.tiras(ids, true, { centros })
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
    for (let i = 0; i <= filas; i++) {
      const t = i / filas
      const fila: number[] = []
      for (let k = 0; k < (abierta ? cols + 1 : cols); k++) {
        const a = op.arco ? lerp(op.arco[0], op.arco[1], k / cols) : ANG_R[k]
        const y = lerp(op.y0, op.y1(a), t)
        const h = lerp(op.holg0, op.holg1, t)
        // Abajo, sobre el tronco; arriba, sobre el cuello.
        if (y < 0.826 * this.Hh) this.punto(y, a, 0.3, h, _v)
        else this.puntoCuello(y, a, h, _v)
        const l = (y - cab.c.y) / cab.hs
        const pw: Pesos = y < 0.826 * this.Hh ? this.cu.pesosTronco(_v.x, y, _v.z) : this.cu.pesosCabeza(new THREE.Vector3(_v.x, l, 0))
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
      const y = op.y1(a)
      if (y < 0.826 * this.Hh) this.punto(y, a, 0.3, 0.0005, _v)
      else this.puntoCuello(y, a, 0.0005, _v)
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
  tira(op: { filas: number; cols: number; pos: (t: number, w: number, out: THREE.Vector3) => THREE.Vector3; grosor: number; color: (t: number, w: number) => RGBA; mat: Mat2; pesos: (p: THREE.Vector3, t: number) => Pesos; normal: (t: number, w: number, out: THREE.Vector3) => THREE.Vector3 }) {
    const L = this.lote
    const caras: number[][][] = [[], []]
    for (const cara of [0, 1]) {
      for (let i = 0; i <= op.filas; i++) {
        const t = i / op.filas
        const fila: number[] = []
        for (let k = 0; k <= op.cols; k++) {
          const w = (k / op.cols) * 2 - 1
          op.pos(t, w, _v)
          op.normal(t, w, _n)
          if (cara === 0) _v.addScaledVector(_n, op.grosor)
          fila.push(L.v(_v.x, _v.y, _v.z, w * 0.03, t * 0.1, op.color(t, w), op.pesos(_v, t), op.mat))
        }
        caras[cara].push(fila)
      }
    }
    // Cara de afuera mira según la normal; la de adentro al revés. Se decide con un punto de referencia.
    op.pos(0.5, 0, _v)
    op.normal(0.5, 0, _n)
    const lejos = _v.clone().addScaledVector(_n, -1)
    const cerca = _v.clone().addScaledVector(_n, 1)
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

  const pantalon = (color: RGBA, op: { mezclilla?: boolean; ruedo?: number; holg?: number; corto?: number; hasta?: number } = {}) => {
    const holg = op.holg ?? 0.012
    // Entre las piernas, la piel del tronco no se ve.
    S.tapaTronco.push((y) => y < 0.6 * Hh - 0.012)
    // Cadera del pantalón: de la ingle a la cintura.
    S.tronco({
      y0: 0.47 * Hh,
      y1: 0.6 * Hh,
      holgura: () => holg * 0.8,
      bultos: 0.5,
      color: (y, a) => (op.mezclilla && Math.abs(Math.cos(a)) > 0.985 ? escalarRGBA(color, 1.25) : color),
      mat: MAT_LANA,
    })
    for (const lado of [1, -1] as const) {
      const c = cu.piernas[lado > 0 ? 0 : 1]
      const fin = op.corto ?? op.hasta ?? c.u[3] - 0.035 * s
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
          const quiebre = op.corto || op.hasta ? 0 : 0.006 * campana(u, fin - 0.03 * s, 0.015 * s) * Math.max(0, Math.sin(a))
          return holg + raya + abajo + quiebre + (op.corto ? 0.012 : 0)
        },
        color: (u, a) => (op.mezclilla && Math.abs(Math.cos(a)) > 0.95 ? escalarRGBA(color, 1.2) : color),
        mat: op.mezclilla ? [0.88, 0] : MAT_LANA,
        tapaHasta: fin - 0.02 * s,
      })
    }
  }

  const cinturon = (y: number, holg: number) => {
    S.tronco({ y0: y - 0.018 * s, y1: y, paso: 0.02, holgura: () => holg, bultos: 0.5, color: () => cueroNegro, mat: MAT_CUERO, tapa: false })
    S.punto(y - 0.009 * s, FRENTE, 0.5, holg + 0.002, _v)
    S.boton(_v.clone(), new THREE.Vector3(0, 0, 1), 0.011 * s, 0.003, rgba("#b9a46a"), MAT_ORO, cu.pesosTronco(0, y, 0.1), 4)
  }

  const zapatos = (color: RGBA, op: { suela?: RGBA; deportivo?: boolean } = {}) => {
    for (const lado of [1, -1] as const) {
      mallaPie(S.lote, cu, lado, op.deportivo ? 0.011 : 0.008, color, op.deportivo ? MAT_ALGODON : MAT_CUERO, false, op.suela ?? rgba("#1a1512"), MAT_SUELA)
    }
  }

  const sandalias = () => {
    pieDescalzo = true
    const cuero = rgba("#6b4a2f")
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

  const mangas = (color: RGBA, hasta: number, holg: number, op: { ancha?: number; puno?: RGBA; mat?: Mat2; cols?: number } = {}) => {
    for (const lado of [1, -1] as const) {
      const c = cu.brazos[lado > 0 ? 0 : 1]
      const fin = Math.min(hasta, c.u[3] - 0.012 * s)
      S.tubo({
        cadena: "brazo",
        lado,
        u0: 0.022 * s,
        u1: fin,
        holgura: (u, a) => holg * (0.75 + 0.25 * suave(0.0, 0.08 * s, u)) + (op.ancha ?? 0) * suave(c.u[2] - 0.1 * s, fin, u) + 0.003 * campana(u, c.u[2] - 0.01 * s, 0.03 * s) * Math.max(0, -Math.sin(a)),
        color: () => color,
        mat: op.mat ?? MAT_LANA,
        cols: op.cols,
      })
      if (op.puno) {
        S.tubo({ cadena: "brazo", lado, u0: fin - 0.02 * s, u1: fin + 0.012 * s, paso: 0.012, holgura: () => 0.005, color: () => op.puno!, mat: MAT_ALGODON, tapa: false })
      }
    }
  }

  const holgTraje = (y: number, a: number) => {
    return 0.014 + 0.004 * suave(0.6 * Hh, 0.5 * Hh, y) + 0 * a
  }

  /** Saco (o levita, o casaca militar) con solapas, cuello, botones y bolsillos. */
  const saco = (color: RGBA, op: { ruedo: number; boton: number; cruzado?: boolean; colas?: boolean; solapa?: RGBA; botones?: RGBA; matBoton?: Mat2; paso?: number }) => {
    const yb = op.boton
    const yTop = 0.828 * Hh
    const dTop = 0.42
    const delta = (y: number) => (y > yb ? 0.035 + dTop * Math.pow(suave(yb, yTop, y), 0.85) : 0.035 + (op.colas ? 1.1 : 0.22) * suave(yb, op.colas ? yb - 0.08 * Hh : op.ruedo, y))
    const arco = (y: number): [number, number] => [FRENTE + delta(y), FRENTE + DOS_PI - delta(y)]
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
      cols: 40,
    })
    // Solapas: sobre el borde de la abertura, del botón al cuello.
    // La solapa refleja distinto (la tela va doblada): un tono apenas más claro.
    const solapa = op.solapa ?? escalarRGBA(color, 1.18)
    for (const lado of [1, -1] as const) {
      const yA = yb + 0.004 * Hh
      const yB = yTop - 0.004 * Hh
      const R = 0.12 * s
      S.tira({
        filas: 10,
        cols: 3,
        grosor: 0.0025,
        pos: (t, w, out) => {
          const y = lerp(yA, yB, t)
          const ancho = (0.072 * s * suave(0, 0.3, t) * (1 - 0.4 * suave(0.78, 1, t))) / R
          const borde = FRENTE + lado * -delta(y)
          const a = borde + lado * -(((w + 1) / 2) * ancho)
          return S.punto(y, a, 0.3, holgTraje(y, a) + 0.004 - 0.002 * (w + 1) * 0, out)
        },
        normal: (t, w, out) => {
          const y = lerp(yA, yB, t)
          const a = FRENTE + lado * -delta(y)
          S.punto(y, a, 0.3, 0, _v)
          return out.copy(_n)
        },
        color: () => solapa,
        mat: MAT_LANA,
        pesos: (pt, t) => cu.pesosTronco(pt.x, lerp(yA, yB, t), pt.z),
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
    const nb = op.cruzado ? 6 : 2
    for (let i = 0; i < nb; i++) {
      const fila = op.cruzado ? Math.floor(i / 2) : i
      const y = yb - fila * (op.cruzado ? 0.055 : 0.06) * Hh * (op.cruzado ? 0.7 : 1) + (op.cruzado ? 0.1 * Hh : 0)
      const a = FRENTE + (op.cruzado ? (i % 2 ? 0.22 : -0.22) : -0.06)
      S.punto(y, a, 0.3, holgTraje(y, a) + 0.001, _v)
      S.boton(_v.clone(), _n.clone(), 0.0085 * s, 0.003, op.botones ?? escalarRGBA(color, 0.6), op.matBoton ?? MAT_BOTON, cu.pesosTronco(_v.x, y, _v.z))
    }
    // Bolsillos: tapas a la altura de la cadera y bolsillo de pecho.
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
          color: () => escalarRGBA(color, 0.93),
          mat: MAT_LANA,
          pesos: (pt) => cu.pesosTronco(pt.x, yP, pt.z),
        })
      }
    }
  }

  /** Camisa visible: el frente (bajo el saco) y el cuello con puntas. */
  const camisa = (color: RGBA, op: { corbata?: string; mono?: boolean; abierta?: boolean; arco?: number; larga?: boolean }) => {
    const ar = op.arco ?? 0.75
    S.tronco({
      y0: 0.56 * Hh,
      y1: 0.828 * Hh,
      arco: () => [FRENTE - ar, FRENTE + ar],
      holgura: () => 0.0045,
      bultos: 0.45,
      color: () => color,
      mat: MAT_ALGODON,
      cols: 22,
    })
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
      const largo = 0.06 * s
      const a0 = abierto + 0.02
      const abre = op.abierta ? 0.42 : 0.22
      S.tira({
        filas: 3,
        cols: 2,
        grosor: 0.0015,
        pos: (t, w, out) => {
          const y = yA - t * largo
          // Base ancha arriba, punta abajo y hacia afuera.
          const a = FRENTE + lado * (a0 + abre * t + ((w + 1) / 2) * 0.28 * (1 - t))
          return y > 0.826 * Hh ? S.puntoCuello(y, a, 0.0085, out) : S.punto(y, a, 0.45, 0.0075 + 0.002 * (1 - t), out)
        },
        normal: (t, w, out) => {
          const a = FRENTE + lado * (a0 + abre * t)
          return out.set(Math.cos(a), 0.25, Math.sin(a)).normalize()
        },
        color: () => color,
        mat: MAT_ALGODON,
        pesos: (pt) => cu.pesosTronco(pt.x, Math.min(pt.y, 0.83 * Hh), pt.z),
      })
    }
    if (op.corbata && !op.abierta) {
      const ct = rgba(op.corbata)
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
        S.tira({
          filas: 14,
          cols: 2,
          grosor: 0.003,
          pos: (t, w, out) => {
            const y = lerp(yNudo - 0.022 * s, yFin, t)
            const ancho = lerp(0.018, 0.043, Math.pow(t, 0.8)) * s
            const punta = t > 0.94 ? (1 - Math.abs(w)) * 0.035 * s * (t - 0.94) / 0.06 : 0
            S.punto(y - punta, FRENTE, 0.45, 0.009 + 0.003 * t, out)
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
          filas: 2,
          cols: 2,
          grosor: 0.008,
          pos: (t, w, out) => {
            const y = yNudo + 0.004 * s - t * 0.036 * s
            S.punto(Math.min(y, 0.826 * Hh), FRENTE, 0.45, 0.01, out)
            if (y > 0.826 * Hh) S.puntoCuello(y, FRENTE, 0.01, out)
            out.x += w * lerp(0.02, 0.011, t) * s
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
  const banda = (lado: 1 | -1, ancho: number, holg: number, color: (w: number) => RGBA, op: { y0?: number; y1?: number; pliegues?: number; mat?: Mat2 } = {}) => {
    const yAlto = op.y1 ?? 0.818 * Hh
    const yBajo = op.y0 ?? 0.56 * Hh
    // El plano inclinado pasa por arriba del hombro y por la cadera del otro lado.
    const xH = -lado * 0.11 * s
    const xC = lado * 0.15 * s
    const k = (yAlto - yBajo) / (xH - xC)
    const yDe = (x: number) => yBajo + (x - xC) * k
    const cols = 48
    S.tira({
      filas: cols,
      cols: 4,
      grosor: 0.0035,
      pos: (t, w, out) => {
        const a = -Math.PI / 2 + t * DOS_PI
        let y = 0.7 * Hh
        for (let it = 0; it < 3; it++) {
          S.punto(clamp(y, 0.5 * Hh, 0.826 * Hh), a, 0.3, holg, out)
          y = yDe(out.x)
        }
        y = clamp(y + w * ancho * 0.5, 0.48 * Hh, 0.83 * Hh)
        const pl = op.pliegues ? op.pliegues * Math.sin(w * 3 + t * 40) * 0.5 + op.pliegues * 0.5 : 0
        return S.punto(y, a, 0.3, holg + 0.004 + pl, out)
      },
      normal: (t, w, out) => {
        const a = -Math.PI / 2 + t * DOS_PI
        S.punto(0.7 * Hh, a, 0.3, 0, _v)
        return out.copy(_n)
      },
      color: (t, w) => color(w),
      mat: op.mat ?? MAT_LANA,
      pesos: (pt) => cu.pesosTronco(pt.x, pt.y, pt.z),
    })
  }

  /** Túnica larga hasta el tobillo, con pliegues verticales que se abren hacia el ruedo. */
  const tunica = (color: RGBA, op: { ruedo: number; escote?: number; vuelo?: number; ribete?: RGBA; manga?: number; mangaAncha?: number; soloFrente?: boolean }) => {
    const sem = (p.id.length * 7) % 13
    const escote = op.escote ?? 0.3
    S.tronco({
      y0: op.ruedo,
      y1: 0.828 * Hh,
      paso: 0.036,
      // Bajo un sobretodo solo se ve el frente.
      arco: op.soloFrente ? () => [FRENTE - 1.05, FRENTE + 1.05] : undefined,
      cols: 22,
      holgura: (y, a) => 0.016 + 0.006 * suave(0.6 * Hh, 0.5 * Hh, y),
      bultos: 0.3,
      vuelo: (y) => (op.vuelo ?? 0.32) * Math.pow(suave(0.5 * Hh, op.ruedo, y), 0.8),
      pliegues: (y, a) => {
        const abajo = suave(0.58 * Hh, op.ruedo, y)
        const cint = campana(y, 0.6 * Hh, 0.025 * Hh)
        return (0.012 * abajo + 0.004 * cint) * (0.6 * Math.sin(a * 11 + sem) + 0.4 * Math.sin(a * 17 + sem * 2.3 + y * 6))
      },
      tope: (a) => 0.828 * Hh - escote * 0.06 * Hh * Math.pow(Math.max(0, Math.sin(a)), 3),
      color: (y) => (op.ribete && y < op.ruedo + 0.03 * s ? op.ribete : color),
      mat: MAT_ALGODON,
    })
    S.tapaFalda(op.ruedo)
    mangas(color, op.manga ?? 9, 0.016, { ancha: op.mangaAncha ?? 0.03, mat: MAT_ALGODON, cols: 16 })
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
      pantalon(C1)
      cinturon(0.595 * Hh, 0.016)
      saco(C1, { ruedo: (levita ? 0.3 : 0.425) * Hh, boton: 0.598 * Hh, paso: levita ? 0.034 : 0.03 })
      mangas(C1, 9, 0.015, { puno: rgba(camisaColor(ap)) })
      zapatos(rgba("#100c0a"))
      break
    }
    case "uniforme_militar": {
      const rojo = rgba("#9e1b26")
      const blanco = C2
      // Chaleco blanco al frente, calzón blanco, botas altas negras.
      S.tronco({ y0: 0.52 * Hh, y1: 0.828 * Hh, arco: () => [FRENTE - 0.95, FRENTE + 0.95], holgura: () => 0.008, bultos: 0.4, color: () => blanco, mat: MAT_ALGODON, cols: 24 })
      pantalon(blanco, { holg: 0.006, hasta: cu.piernas[0].u[2] + 0.07 * s })
      saco(C1, { ruedo: 0.31 * Hh, boton: 0.62 * Hh, colas: true, paso: 0.034, solapa: escalarRGBA(C1, 1.05), botones: rgba("#d8b04a"), matBoton: MAT_ORO, cruzado: true })
      S.cuello({ y0: 0.82 * Hh, y1: (a) => 0.82 * Hh + 0.045 * s, arco: [FRENTE + 0.35, FRENTE + DOS_PI - 0.35], holg0: 0.014, holg1: 0.012, color: rojo, mat: MAT_LANA, filas: 2, tapa: true })
      mangas(C1, 9, 0.015, { puno: rojo })
      // Botas: caña hasta la rodilla.
      for (const lado of [1, -1] as const) {
        const c = cu.piernas[lado > 0 ? 0 : 1]
        S.tubo({ cadena: "pierna", lado, u0: c.u[2] - 0.035 * s, u1: c.u[3] + 0.02 * s, holgura: (u) => 0.01 + 0.012 * suave(c.u[2] + 0.04 * s, c.u[2] - 0.03 * s, u), color: () => cueroNegro, mat: MAT_CUERO, cols: 18 })
      }
      zapatos(cueroNegro)
      // Charreteras doradas con flecos.
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
      tunica(C1, { ruedo: 0.035 * Hh, ribete: ren ? undefined : C2, escote: ren ? 0.15 : 0.35, mangaAncha: ren ? 0.012 : 0.035, soloFrente: ren })
      cinturon(0.6 * Hh, 0.024)
      if (!ren) banda(1, 0.2 * s, 0.036, () => C2, { pliegues: 0.004 })
      else {
        // Sobretodo oscuro abierto al frente.
        S.tronco({ y0: 0.25 * Hh, y1: 0.826 * Hh, paso: 0.034, arco: (y) => [FRENTE + 0.32, FRENTE + DOS_PI - 0.32], holgura: (y) => 0.028 + 0.008 * suave(0.6 * Hh, 0.3 * Hh, y), bultos: 0.25, vuelo: (y) => 0.25 * suave(0.5 * Hh, 0.25 * Hh, y), color: () => C2, mat: MAT_LANA, cols: 52 })
      }
      if (ren) zapatos(rgba("#2a1c14"))
      else sandalias()
      break
    }
    case "toga": {
      tunica(C1, { ruedo: 0.04 * Hh, escote: 0.25, mangaAncha: 0.02, manga: 0.17 * s })
      // La toga: banda ancha cruzada con la franja púrpura en el borde.
      banda(1, 0.32 * s, 0.04, (w) => (w > 0.75 ? C2 : escalarRGBA(C1, 0.97)), { pliegues: 0.006 })
      sandalias()
      break
    }
    case "vestido_egipcio": {
      // Vestido de lino del pecho al tobillo, con tirantes; collar ancho dorado.
      S.tronco({
        y0: 0.035 * Hh,
        y1: 0.8 * Hh,
        paso: 0.036,
        holgura: (y) => 0.007 + 0.006 * suave(0.5 * Hh, 0.1 * Hh, y),
        bultos: 0.7,
        vuelo: (y) => 0.12 * suave(0.5 * Hh, 0.05 * Hh, y),
        pliegues: (y, a) => 0.003 * suave(0.5 * Hh, 0.05 * Hh, y) * Math.sin(a * 13),
        tope: (a) => 0.8 * Hh - 0.035 * Hh * Math.pow(Math.max(0, Math.sin(a)), 2),
        color: (y) => (y < 0.06 * Hh ? C2 : C1),
        mat: [0.92, 0],
      })
      S.tapaFalda(0.035 * Hh)
      // Collar ancho (usekh): franjas de oro, lapislázuli y cornalina.
      const franjas = [rgba("#d4aa48"), rgba("#1f4ea3"), rgba("#d4aa48"), rgba("#a8322a"), rgba("#d4aa48")]
      S.tronco({
        y0: 0.765 * Hh,
        y1: 0.83 * Hh,
        paso: 0.008,
        holgura: (y, a) => 0.009 + 0.006 * suave(0.81 * Hh, 0.77 * Hh, y),
        bultos: 0.5,
        tope: (a) => 0.83 * Hh,
        color: (y) => franjas[clamp(Math.floor(((y - 0.765 * Hh) / (0.065 * Hh)) * 5), 0, 4)],
        mat: (y) => (Math.floor(((y - 0.765 * Hh) / (0.065 * Hh)) * 5) % 2 ? [0.4, 0.1] : MAT_ORO),
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
      S.tronco({
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
      S.tronco({ y0: 0.47 * Hh, y1: 0.6 * Hh, holgura: () => 0.02, bultos: 0.5, color: (y) => (y > 0.585 * Hh ? C2 : C1), mat: MAT_ALGODON })
      for (const lado of [1, -1] as const) {
        const c = cu.piernas[lado > 0 ? 0 : 1]
        S.tubo({ cadena: "pierna", lado, u0: -0.02 * s, u1: c.u[2] - 0.045 * s, holgura: (u) => 0.026 + 0.012 * suave(0, c.u[2], u), color: (u, a) => (Math.cos(a) > 0.93 || u > c.u[2] - 0.065 * s ? C2 : C1), mat: MAT_ALGODON })
        // Medias blancas a media pantorrilla.
        S.tubo({ cadena: "pierna", lado, u0: c.u[2] + 0.2 * s, u1: c.u[3] + 0.02 * s, holgura: () => 0.003, color: () => rgba("#f2f2f2"), mat: MAT_ALGODON })
      }
      zapatos(rgba("#f4f4f4"), { suela: rgba("#552583"), deportivo: true })
      break
    }
    case "cuello_alto": {
      tejido = "punto"
      S.tronco({ y0: 0.505 * Hh, y1: 0.836 * Hh, holgura: (y) => 0.01 + 0.006 * suave(0.6 * Hh, 0.5 * Hh, y), bultos: 0.4, color: () => C1, mat: [0.92, 0] })
      S.cuello({ y0: 0.81 * Hh, y1: () => 0.818 * Hh + 0.062 * s, holg0: 0.009, holg1: 0.005, color: C1, mat: [0.92, 0], filas: 4, tapa: true })
      // Mangas un poco recogidas.
      mangas(C1, cu.brazos[0].u[3] - 0.06 * s, 0.009, { mat: [0.92, 0] })
      pantalon(C2, { mezclilla: true, holg: 0.007 })
      zapatos(rgba("#8a8d93"), { suela: rgba("#e8e8e8"), deportivo: true })
      break
    }
    case "deportivo":
    case "casual":
    case "holograma": {
      tejido = "algodon"
      const remera = ap.complexion === "fuerte" || ap.complexion === "atletico" || tipo === "deportivo" || tipo === "holograma"
      if (!remera) tejido = "punto"
      S.tronco({
        y0: 0.5 * Hh,
        y1: 0.836 * Hh,
        holgura: (y) => 0.009 + 0.007 * suave(0.6 * Hh, 0.5 * Hh, y),
        bultos: remera ? 0.6 : 0.4,
        tope: (a) => 0.836 * Hh - 0.016 * Hh * Math.pow(Math.max(0, Math.sin(a)), 3),
        color: (y) => (y < 0.51 * Hh && !remera ? escalarRGBA(C1, 0.9) : C1),
        mat: remera ? MAT_ALGODON : [0.92, 0],
      })
      S.cuello({ y0: 0.826 * Hh, y1: (a) => 0.84 * Hh - 0.016 * Hh * Math.pow(Math.max(0, Math.sin(a)), 3), holg0: 0.009, holg1: 0.004, color: escalarRGBA(C1, 0.92), mat: MAT_ALGODON, filas: 1 })
      if (remera) mangas(C1, 0.15 * s, 0.01, { mat: MAT_ALGODON })
      else mangas(C1, 9, 0.011, { mat: [0.92, 0], puno: escalarRGBA(C1, 0.9) })
      const mezclilla = new THREE.Color(ap.ropa.color2 ?? "#2f3e55").b > 0.25
      if (tipo === "deportivo") pantalon(C2, { corto: cu.piernas[0].u[2] - 0.05 * s })
      else pantalon(C2, { mezclilla, holg: 0.007 })
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
  const capucha = vestuarioDe(p.id).capucha
  if (capucha) {
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
      // Medio ancho (rad) de la abertura de la cara a la altura y (local).
      // De la línea de los ojos (y ≈ 0) al cuello: la frente y los ojos quedan en la sombra.
      const e = (y + 0.07) / 0.068
      return e >= 1 || e <= -1.5 ? 0 : 0.8 * Math.sqrt(Math.max(0, 1 - Math.min(1, e * e)))
    }
    const ext: number[][] = []
    const int: number[][] = []
    const abierto: boolean[][] = []
    for (let i = 0; i <= NT; i++) {
      const th = (i / NT) * (158 * Math.PI) / 180
      const fe: number[] = []
      const fi: number[] = []
      const fa: boolean[] = []
      for (let k = 0; k < NA; k++) {
        const a = FR + (k / NA) * DOS_PI
        dir.set(Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a))
        const t = cab.rayo(centro.x, centro.y, centro.z, dir.x, dir.y, dir.z, 0.2)
        // Holgura: más arriba y adelante (el pico de la capucha sobresale sobre la frente).
        const adelante = Math.pow(Math.max(0, Math.sin(a)), 2) * suave(2.0, 1.0, th)
        const r = Math.max(t, 0.07) + 0.026 + 0.05 * adelante + 0.012 * suave(1.6, 2.6, th)
        pt.copy(dir).multiplyScalar(r).add(centro)
        // Abajo, la tela cae hacia los hombros (se abre).
        const caida = suave(2.0, 2.75, th)
        pt.x *= 1 + 0.55 * caida
        pt.z = pt.z * (1 + 0.25 * caida) - 0.01 * caida
        pt.y -= 0.035 * caida
        const da = Math.abs(Math.atan2(Math.sin(a - FR), Math.cos(a - FR)))
        const h = hueco(pt.y)
        fa.push(da < h)
        const borde = h > 0.12 && da < h + 0.14
        const col = borde ? cr : ct
        const wCuello = suave(-0.07, -0.16, pt.y)
        const pw: Pesos = wCuello > 0 ? [[H.cabeza, 1 - wCuello], [H.cuello, wCuello * 0.6], [H.pecho, wCuello * 0.4]] : pesoCab()
        cab.aAvatar(pt.x, pt.y, pt.z, _v)
        fe.push(L.v(_v.x, _v.y, _v.z, k / NA, i / NT, col, pw, [0.95, 0]))
        // Adentro: 4 mm hacia el centro, más oscuro (la sombra de la tela).
        pt.sub(centro).multiplyScalar(1 - 0.004 / Math.max(0.05, pt.length())).add(centro)
        cab.aAvatar(pt.x, pt.y, pt.z, _v)
        fi.push(L.v(_v.x, _v.y, _v.z, k / NA, i / NT, borde ? cr : escalarRGBA(ct, 0.55), pw, [0.95, 0]))
      }
      ext.push(fe)
      int.push(fi)
      abierto.push(fa)
    }
    // Orientación: la cara de afuera mira lejos del centro de la cabeza.
    const P = L.pos
    const iA = ext[10][NA >> 1], iB = ext[10][(NA >> 1) + 1], iD = ext[11][NA >> 1]
    const e1 = new THREE.Vector3(P[iB * 3] - P[iA * 3], P[iB * 3 + 1] - P[iA * 3 + 1], P[iB * 3 + 2] - P[iA * 3 + 2])
    const e2 = new THREE.Vector3(P[iD * 3] - P[iA * 3], P[iD * 3 + 1] - P[iA * 3 + 1], P[iD * 3 + 2] - P[iA * 3 + 2])
    const cAv = cab.aAvatar(centro.x, centro.y, centro.z, new THREE.Vector3())
    const rad = new THREE.Vector3(P[iA * 3] - cAv.x, P[iA * 3 + 1] - cAv.y, P[iA * 3 + 2] - cAv.z)
    const afuera = e1.cross(e2).dot(rad) > 0
    const emitir = (i: number, j: number) => {
      const j2 = (j + 1) % NA
      return !(abierto[i][j] || abierto[i][j2] || abierto[i + 1][j] || abierto[i + 1][j2])
    }
    L.tiras(ext, true, { invertir: !afuera, emitir })
    L.pieza()
    L.tiras(int, true, { invertir: afuera, emitir })
    L.pieza()
  }
  if (acc.has("faja")) banda(-1, 0.075 * s, holgTraje(0.7 * Hh, 0) + 0.004, (w) => (Math.abs(w) > 0.7 ? rgba("#d4aa48") : rgba(ap.ropa.corbata ?? "#1e3a8a")))
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
    const montura = rgba(sinAro ? "#b8b8b8" : red ? "#3a332c" : sol ? "#0f0f10" : "#1c1c1e")
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
      S.cordon(pts, sinAro ? 0.00045 * cab.hs : red ? 0.0011 * cab.hs : 0.0017 * cab.hs, montura, MAT_BOTON, pesoCab, true, sinAro ? 3 : 5)
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
      S.cordon(pat, 0.0013 * cab.hs, montura, MAT_BOTON, pesoCab, false, 4)
    }
    // Puente
    S.cordon([cab.aAvatar(0.012, o.y + 0.003, zL + 0.002, new THREE.Vector3()), cab.aAvatar(0, o.y + 0.005, zL + 0.006, new THREE.Vector3()), cab.aAvatar(-0.012, o.y + 0.003, zL + 0.002, new THREE.Vector3())], 0.0013 * cab.hs, montura, MAT_BOTON, pesoCab, false, 4)
    lote.pieza()
    lentes = { lote, sol }
  }
  // Utilería en la mano izquierda.
  const enMano = acc.has("pergamino") ? "pergamino" : acc.has("cuaderno") ? "cuaderno" : acc.has("laptop") ? "laptop" : null
  if (enMano) {
    const U = new Sastre(cu)
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
    switch (sombrero) {
      case "chistera": {
        const h = 0.17
        cilindro([[yB - 0.006, rx + 0.032, rz + 0.04], [yB - 0.002, rx + 0.036, rz + 0.044], [yB, rx + 0.03, rz + 0.038], [yB + 0.002, rx, rz], [yB + 0.03, rx - 0.001, rz - 0.001], [yB + 0.032, rx - 0.0005, rz - 0.0005], [yB + h, rx + 0.006, rz + 0.006], [yB + h + 0.002, rx + 0.004, rz + 0.004]], negroF, [0.4, 0], true)
        // Cinta
        cilindro([[yB + 0.004, rx + 0.0015, rz + 0.0015], [yB + 0.028, rx + 0.0015, rz + 0.0015]], rgba("#1d1d22"), [0.6, 0], false)
        altoSombrero = (yB + h - 0.123) * hs
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
        const y0 = yB - 0.014
        const forma = (cara: number, t: number, v: number, out: THREE.Vector3) => {
          const u = 2 * t - 1
          const x = u * largo * 0.5
          const tope = y0 + 0.016 + alto * Math.pow(Math.max(0, 1 - u * u), 0.62) - 0.012 * u * u * u * u
          const y = lerp(y0 + 0.01 * u * u, tope, v)
          const base = Math.sqrt(Math.max(0, 1 - (x / (rx * 1.04)) ** 2)) * rz * 1.05
          // Las alas se abren un poco hacia afuera abajo y se curvan al juntarse arriba.
          const z = -0.004 + cara * ((base + 0.008) * Math.pow(1 - v, 0.8) + 0.004 * Math.sin(Math.PI * v) * (1 - u * u))
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
        const oro = rgba("#d4aa48")
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

  return { lote: S.lote, utileria, lentes, cobertura, tejido, numero, altoSombrero, sombraBarba }
}

