// ──────────────────────────────────────────────────────────────
// La vida del personaje: animación por huesos.
//
// - Postura propia (avatar-postura.ts): ancho de apoyo, puntas afuera,
//   rodillas destrabadas, encorvado o pecho afuera, mentón, hombros y dónde
//   descansan las manos (juntas, en el bolsillo, en el chaleco, atrás…).
// - Quieto: respiración (pecho y clavículas), micromovimiento de baja
//   frecuencia, el peso que pasa de una pierna a la otra cada 8–15 s y a
//   veces un paso de reacomodo del pie libre.
// - Habla: frases y pausas; en cada frase un gesto de su biblioteca (pinza,
//   torre, corte, índice…) frente al torso, con golpes en los acentos de las
//   sílabas que mueve la mandíbula y la cabeza que asiente.
// - Atención: ojos primero y la cabeza después (resorte de ~0,3 s), cuello y
//   pecho acompañan. El motor puede dar un punto a mirar (raiz.userData.vida).
// - Caminar y correr: piernas con cinemática inversa y pies que no patinan,
//   cadencia, braceo y vaivén de cadera de cada uno.
// - Sentado, duerme, deporte, parpadeo. Entre estados, mezcla de 0,4 s.
//
// Determinista: todo depende del dt acumulado y de la semilla del personaje
// (nada de Math.random ni del reloj). Sin objetos nuevos por cuadro.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { EstadoCuerpo } from "../tipos"
import { H, HUESOS, type Cuerpo, type NombreHueso } from "./avatar-cuerpo"
import { clamp, lerp, suave } from "./avatar-geo"
import { GESTOS, REPOSO, perfilDe, type Gesto, type GestoId, type ManoG, type Perfil } from "./avatar-postura"

const NH = HUESOS.length
/** Canales: 3 rotaciones por hueso + desplazamiento de la cadera (x, y, z). */
const N = NH * 3 + 3
const RAIZ = NH * 3

type Pose = Float32Array

interface Pierna {
  lado: 1 | -1
  cad: THREE.Vector3
  rod: THREE.Vector3
  tob: THREE.Vector3
  pun: THREE.Vector3
  L1: number
  L2: number
  f1: number
  f2: number
  fPie: number
}

/** Brazo para la cinemática inversa (todo en la pose de enlace). */
interface Brazo {
  lado: 1 | -1
  S: THREE.Vector3
  u: THREE.Vector3
  f: THREE.Vector3
  L1: number
  L2: number
  A: number
  B: number
  C: number
}

const _q = new THREE.Vector3()
const _e = new THREE.Euler()
const _m4 = new THREE.Matrix4()
const _T = new THREE.Vector3()
const _v = new THREE.Vector3()
const _ep = new THREE.Vector3()
const _pp = new THREE.Vector3()
const _cr = new THREE.Vector3()
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const _eu = new THREE.Euler()
const _mA = new THREE.Matrix4()
const _mB = new THREE.Matrix4()
const _pw = new THREE.Vector3()
const _d = new THREE.Vector3()

// Índices (×3) de los huesos de cada lado, calculados una vez: armar
// `dedos${L}` en cada cuadro creaba cadenas nuevas (basura para el GC).
function indicesLado(L: "I" | "D") {
  const i = (h: NombreHueso) => H[h] * 3
  return {
    dedos: i(`dedos${L}`), dedos2: i(`dedos2${L}`), pulgar: i(`pulgar${L}`), mano: i(`mano${L}`),
    indice: i(`indice${L}`), indice2: i(`indice2${L}`), clavicula: i(`clavicula${L}`),
    hombro: i(`hombro${L}`), codo: i(`codo${L}`),
    muslo: i(`muslo${L}`), rodilla: i(`rodilla${L}`), tobillo: i(`tobillo${L}`), punta: i(`punta${L}`),
    /** La mano y sus dedos (para borrarlos sin crear listas por cuadro). */
    manoEntera: Int32Array.from([i(`mano${L}`), i(`dedos${L}`), i(`dedos2${L}`), i(`indice${L}`), i(`indice2${L}`), i(`pulgar${L}`)]),
  }
}
const LADO_I = indicesLado("I")
const LADO_D = indicesLado("D")
const lado$ = (lado: number) => (lado > 0 ? LADO_I : LADO_D)
const LADOS = [1, -1] as const
const esLoco = (e: EstadoCuerpo) => e === "camina" || e === "corre"

interface Pie {
  y: number
  z: number
  pitch: number
  punta: number
}

/** Ruido suave determinista (suma de senos). */
function ruido(t: number, s: number): number {
  return 0.5 * Math.sin(t * 1.13 + s) + 0.3 * Math.sin(t * 2.37 + s * 1.7) + 0.2 * Math.sin(t * 4.11 + s * 2.9)
}

/** Número en [0, 1) que depende solo de (n, k, semilla). */
function hash(n: number, k: number, sem: number): number {
  const x = Math.sin(n * 12.9898 + k * 78.233 + sem * 0.1371) * 43758.5453
  return x - Math.floor(x)
}

/** Lo que una mano hace en este cuadro (se mezcla entre reposo y gesto). */
interface Mano {
  x: number
  y: number
  z: number
  px: number
  py: number
  pz: number
  curva: number
  indice: number
  pulgar: number
  prono: number
  flex: number
}
const manoVacia = (): Mano => ({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, curva: 0, indice: 0, pulgar: 0, prono: 0, flex: 0 })

const GESTO_VACIO: Gesto = {}
/** Manos sobre el teclado (sentado). */
const TECLEA: ManoG = { p: [0.15, -0.34, 0.26], polo: [0.7, -1, -0.3], forma: [0.25, 0.2, 0.1], prono: -1.45, flex: 0.05 }

export class Animador {
  private readonly cu: Cuerpo
  private readonly huesos: THREE.Bone[]
  private readonly raiz: THREE.Object3D
  private readonly piernas: [Pierna, Pierna]
  private readonly brazos: [Brazo, Brazo]
  private readonly s: number
  private readonly sem: number
  private readonly pf: Perfil
  /** Gestos de su biblioteca (resueltos una vez); después, la pose de escucha y el vacío. */
  private readonly gestos: Gesto[]
  private readonly iEscucha: number
  private readonly iVacio: number
  /** Zurdo para gesticular (Kobe tiene el balón en la derecha). */
  private readonly espejo: boolean
  // Silueta del tronco (con la ropa) por altura: frente, espalda y medio ancho.
  private readonly yT: Float32Array
  private readonly zF: Float32Array
  private readonly zB: Float32Array
  private readonly xW: Float32Array
  private t: number
  private fase = 0
  private estado: EstadoCuerpo = "quieto"
  private previa: Pose = new Float32Array(N)
  private salida: Pose = new Float32Array(N)
  private destino: Pose = new Float32Array(N)
  private mezcla = 1
  private parpadeo = 0
  private proxParpadeo = 2
  private mirada = { x: 0, y: 0, tx: 0, ty: 0, prox: 1 }
  private cabezaMira = { ty: 0, tp: 0, prox: 3 }
  /** Cabeza (resorte críticamente amortiguado hacia lo que mira). */
  private cab = { yaw: 0, pitch: 0, vy: 0, vp: 0, oyaw: 0, opitch: 0 }
  /** Punto del mundo a mirar (lo da el motor) o nada. */
  private aten = { on: false, x: 0, y: 0, z: 0 }
  /** Si el motor dice quién habla: true / false; null = el animador decide. */
  private hablaExterna: boolean | null = null
  private golpe = { lado: 1, t: 0, prox: 0.6 }
  /** Peso: hacia qué pie (+ izq.), su velocidad, el próximo cambio y el paso de reacomodo. */
  private peso = { v: 0, vel: 0, obj: 0, n: 0, prox: 3, paso: -1, pt0: 0, dx0: 0, dz0: 0, dx1: 0, dz1: 0 }
  private readonly offPie = [
    { dx: 0, dz: 0 },
    { dx: 0, dz: 0 },
  ]
  /** Frases: n, cuándo termina la actual, cuándo empieza la próxima, si habla y el gesto. */
  private frase = { n: 0, fin: 0, prox: 0.4, habla: false, g: -1, gPrev: -1, cambio: 1, env: 0, voz: 0 }
  private readonly manoR = manoVacia()
  private readonly manoG = manoVacia()
  private readonly manoP = manoVacia()
  readonly balon: THREE.Object3D | null
  readonly utileria: THREE.Object3D | null
  /** Altura de la coronilla en el cuadro (para la etiqueta). */
  coronilla = 0

  constructor(
    cu: Cuerpo,
    huesos: THREE.Bone[],
    raiz: THREE.Object3D,
    op: { balon: THREE.Object3D | null; utileria: THREE.Object3D | null; semilla: number; id?: string },
  ) {
    this.cu = cu
    this.huesos = huesos
    this.raiz = raiz
    this.s = cu.s
    this.sem = op.semilla
    this.t = (op.semilla % 1000) * 0.137
    this.balon = op.balon
    this.utileria = op.utileria
    this.pf = perfilDe(op.id ?? "")
    this.gestos = this.pf.gestos.map((g: GestoId) => GESTOS[g])
    this.iEscucha = this.pf.escucha ? this.gestos.length : -1
    if (this.pf.escucha) this.gestos.push(GESTOS[this.pf.escucha])
    this.iVacio = this.gestos.length
    this.gestos.push(GESTO_VACIO)
    this.espejo = !!op.balon
    const j = cu.j
    const pierna = (L: "I" | "D", lado: 1 | -1): Pierna => {
      const cad = j[`muslo${L}`]
      const rod = j[`rodilla${L}`]
      const tob = j[`tobillo${L}`]
      const pun = j[`punta${L}`]
      return {
        lado,
        cad,
        rod,
        tob,
        pun,
        L1: cad.distanceTo(rod),
        L2: rod.distanceTo(tob),
        f1: Math.atan2(rod.z - cad.z, cad.y - rod.y),
        f2: Math.atan2(tob.z - rod.z, rod.y - tob.y),
        fPie: tob.distanceTo(pun),
      }
    }
    this.piernas = [pierna("I", 1), pierna("D", -1)]
    const brazo = (L: "I" | "D", lado: 1 | -1): Brazo => {
      const S = j[`hombro${L}`].clone()
      const u = new THREE.Vector3().subVectors(j[`codo${L}`], S)
      const f = new THREE.Vector3().subVectors(j[`mano${L}`], j[`codo${L}`])
      return { lado, S, u, f, L1: u.length(), L2: f.length(), A: u.x * f.x, B: u.y * f.y + u.z * f.z, C: u.z * f.y - u.y * f.z }
    }
    this.brazos = [brazo("I", 1), brazo("D", -1)]
    // Silueta del tronco: 10 alturas, de bajo la cadera al cuello.
    const n = 10
    this.yT = new Float32Array(n)
    this.zF = new Float32Array(n)
    this.zB = new Float32Array(n)
    this.xW = new Float32Array(n)
    const M = 72
    const ax = new Float64Array(M)
    const az = new Float64Array(M)
    const y0 = j.cadera.y - 0.12 * this.s
    const y1 = j.cuello.y
    // (la ropa: holgura de los brazos más una capa de tela)
    const extra = 0.012 + cu.holgura
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, i / (n - 1))
      cu.anilloTronco(y, 1, ax, az)
      let zf = -1
      let zb = 1
      let xw = 0
      for (let q = 0; q < M; q++) {
        if (Math.abs(ax[q]) < 0.06 * this.s) {
          zf = Math.max(zf, az[q])
          zb = Math.min(zb, az[q])
        }
        xw = Math.max(xw, Math.abs(ax[q]))
      }
      this.yT[i] = y
      this.zF[i] = zf + extra
      this.zB[i] = zb - extra
      this.xW[i] = xw + extra
    }
  }

  /** El motor puede pedir que mire un punto del mundo (null = vuelve a su mirada propia). */
  mirarA(x: number | null, y = 0, z = 0) {
    if (x === null) {
      this.aten.on = false
      return
    }
    this.aten.on = true
    this.aten.x = x
    this.aten.y = y
    this.aten.z = z
  }

  /** El motor puede decir si este personaje habla ahora (true) o escucha (false); null = lo decide el animador. */
  hablando(on: boolean | null) {
    this.hablaExterna = on
  }

  private silueta(tabla: Float32Array, y: number): number {
    const ys = this.yT
    const n = ys.length
    if (y <= ys[0]) return tabla[0]
    if (y >= ys[n - 1]) return tabla[n - 1]
    const f = ((y - ys[0]) / (ys[n - 1] - ys[0])) * (n - 1)
    const i = Math.floor(f)
    return lerp(tabla[i], tabla[i + 1], f - i)
  }

  private r(P: Pose, h: NombreHueso, x: number, y = 0, z = 0) {
    const i = H[h] * 3
    P[i] += x
    P[i + 1] += y
    P[i + 2] += z
  }

  /** Como r, con el índice (×3) ya calculado. */
  private ri(P: Pose, i: number, x: number, y = 0, z = 0) {
    P[i] += x
    P[i + 1] += y
    P[i + 2] += z
  }

  /** Pies preasignados para el IK (sin objetos nuevos por cuadro). */
  private readonly pies: [Pie, Pie] = [{ y: 0, z: 0, pitch: 0, punta: 0 }, { y: 0, z: 0, pitch: 0, punta: 0 }]
  private pie(k: 0 | 1, y: number, z: number, pitch: number, punta = 0) {
    const p = this.pies[k]
    p.y = y
    p.z = z
    p.pitch = pitch
    p.punta = punta
  }

  /** Mano: curvatura de dedos (0 abierta, 1 puño) y giro de la muñeca. */
  private mano(P: Pose, lado: 1 | -1, curva: number, prono = 0, flex = 0) {
    const I = lado$(lado)
    this.ri(P, I.dedos, 0, 0, -lado * curva * 1.1)
    this.ri(P, I.dedos2, 0, 0, -lado * curva * 1.25)
    this.ri(P, I.indice, 0, 0, -lado * curva * 1.1)
    this.ri(P, I.indice2, 0, 0, -lado * curva * 1.25)
    // (al cerrar, el pulgar se pliega sobre los dedos; al abrir, se separa poco)
    const cp = curva > 0 ? curva : curva * 0.5
    this.ri(P, I.pulgar, 0.3 * cp, 0, -lado * 0.38 * cp)
    this.ri(P, I.mano, flex, -lado * prono, 0)
  }

  /** Mano de un gesto: dedos, índice y pulgar por separado; prono + = la palma hacia arriba; flex + = hacia la palma. */
  private manoForma(P: Pose, lado: 1 | -1, m: Mano) {
    const I = lado$(lado)
    this.ri(P, I.dedos, 0, 0, -lado * m.curva * 1.1)
    this.ri(P, I.dedos2, 0, 0, -lado * m.curva * 1.25)
    this.ri(P, I.indice, 0, 0, -lado * m.indice * 1.05)
    this.ri(P, I.indice2, 0, 0, -lado * m.indice * 1.2)
    const cp = m.pulgar > 0 ? m.pulgar : m.pulgar * 0.5
    this.ri(P, I.pulgar, 0.3 * cp, 0, -lado * 0.38 * cp)
    this.ri(P, I.mano, 0, lado * m.prono, -lado * m.flex)
  }

  /**
   * Brazo por cinemática inversa: la muñeca a (tx, ty, tz) en el espacio del
   * cuerpo (como si el pecho no girara: el gesto viaja con el torso), el codo
   * hacia el polo (px afuera, py arriba, pz adelante). Mezcla con peso w.
   */
  private brazoIK(P: Pose, b: Brazo, m: Mano, w: number) {
    if (w <= 0) return
    const I = lado$(b.lado)
    _T.set(m.x - b.S.x, m.y - b.S.y, m.z - b.S.z)
    let d = _T.length()
    const dMin = Math.abs(b.L1 - b.L2) * 1.1 + 0.02
    const dMax = (b.L1 + b.L2) * 0.995
    if (d < dMin) d = dMin
    if (d > dMax) d = dMax
    _T.normalize()
    // Codo: (d² − L1² − L2²)/2 = A + B cos θ + C sin θ
    const D = (d * d - b.L1 * b.L1 - b.L2 * b.L2) / 2
    const R = Math.hypot(b.B, b.C)
    const phi = Math.atan2(b.C, b.B)
    const a = Math.acos(clamp((D - b.A) / R, -1, 1))
    let th = phi - a
    const th2 = phi + a
    if (Math.abs(th2) < Math.abs(th) && th2 <= 0.05) th = th2
    if (th > 0.05) th = Math.min(th, th2)
    // Brazo con ese codo, en la pose de enlace.
    const c = Math.cos(th)
    const sn = Math.sin(th)
    _v.set(b.u.x + b.f.x, b.u.y + b.f.y * c - b.f.z * sn, b.u.z + b.f.y * sn + b.f.z * c).normalize()
    _qa.setFromUnitVectors(_v, _T)
    // Giro alrededor del eje hombro→muñeca para llevar el codo al polo.
    _ep.copy(b.u).applyQuaternion(_qa)
    _ep.addScaledVector(_T, -_ep.dot(_T))
    _pp.set(b.lado * m.px, m.py, m.pz)
    _pp.addScaledVector(_T, -_pp.dot(_T))
    if (_ep.lengthSq() > 1e-10 && _pp.lengthSq() > 1e-10) {
      _ep.normalize()
      _pp.normalize()
      const psi = Math.atan2(_T.dot(_cr.crossVectors(_ep, _pp)), _ep.dot(_pp))
      _qb.setFromAxisAngle(_T, psi)
      _qa.premultiply(_qb)
    }
    _eu.setFromQuaternion(_qa, "XYZ")
    const h = I.hombro
    P[h] = lerp(P[h], _eu.x, w)
    P[h + 1] = lerp(P[h + 1], _eu.y, w)
    P[h + 2] = lerp(P[h + 2], _eu.z, w)
    const k = I.codo
    P[k] = lerp(P[k], th, w)
    P[k + 1] *= 1 - w
    P[k + 2] *= 1 - w
  }

  /** Punto de la muñeca de una mano de reposo o de gesto, en el espacio del cuerpo. */
  private objetivo(g: ManoG, lado: 1 | -1, golpe: number, out: Mano, k = 1) {
    const s = this.s
    const b = this.brazos[lado > 0 ? 0 : 1]
    const ref = g.ref ?? "frente"
    let x: number
    let y = b.S.y + g.p[1] * s
    let z: number
    if (ref === "bind") {
      const m = this.cu.j[lado > 0 ? "manoI" : "manoD"]
      x = m.x + lado * g.p[0] * s
      y = m.y + g.p[1] * s
      z = m.z + g.p[2] * s
    } else if (ref === "lado") {
      x = lado * (this.silueta(this.xW, y) + g.p[0] * s)
      z = 0.5 * (this.silueta(this.zF, y) + this.silueta(this.zB, y)) + g.p[2] * s
    } else if (ref === "espalda") {
      x = lado * g.p[0] * s
      z = this.silueta(this.zB, y) - g.p[2] * s
    } else {
      x = lado * g.p[0] * s
      z = this.silueta(this.zF, y) + g.p[2] * s
    }
    if (golpe !== 0) {
      // Golpe del gesto en el acento, más uno genérico (la muñeca baja 3 cm y avanza
      // 1,5): sin él, los gestos sin golpe propio se sostenían congelados.
      const b = g.b
      x += lado * (b ? b[0] : 0) * s * golpe
      y += ((b ? b[1] : 0) - 0.03) * s * golpe
      z += ((b ? b[2] : 0) + 0.015) * s * golpe
    }
    out.x = x
    out.y = y
    out.z = z
    const polo = g.polo ?? REPOSO.sueltas.polo
    out.px = polo[0]
    out.py = polo[1]
    out.pz = polo[2]
    out.curva = g.forma[0] * k
    out.indice = g.forma[1] * k
    out.pulgar = g.forma[2] * k
    out.prono = (g.prono ?? 0) * k
    out.flex = (g.flex ?? 0) * k
  }

  /**
   * Un punto del cuerpo (pies en y = 0, ya con la cadera donde dice la pose)
   * al marco del pecho en la pose de enlace, que es donde trabaja brazoIK:
   * sirve para anclar las manos a algo que no se mueve con el torso (un teclado).
   */
  private alPecho(P: Pose, m: Mano) {
    const j = this.cu.j
    const ic = H.cadera * 3
    const io = H.columna * 3
    const ip = H.pecho * 3
    _mA.makeRotationFromEuler(_e.set(P[ic], P[ic + 1], P[ic + 2]))
    _pw.set(j.cadera.x + P[RAIZ], j.cadera.y + P[RAIZ + 1], j.cadera.z + P[RAIZ + 2])
    _d.subVectors(j.columna, j.cadera).applyMatrix4(_mA)
    _pw.add(_d)
    _mA.multiply(_mB.makeRotationFromEuler(_e.set(P[io], P[io + 1], P[io + 2])))
    _d.subVectors(j.pecho, j.columna).applyMatrix4(_mA)
    _pw.add(_d)
    _mA.multiply(_mB.makeRotationFromEuler(_e.set(P[ip], P[ip + 1], P[ip + 2])))
    _mA.transpose()
    _d.set(m.x, m.y, m.z).sub(_pw).applyMatrix4(_mA).add(j.pecho)
    m.x = _d.x
    m.y = _d.y
    m.z = _d.z
  }

  private static mezclar(a: Mano, b: Mano, t: number, out: Mano) {
    out.x = lerp(a.x, b.x, t)
    out.y = lerp(a.y, b.y, t)
    out.z = lerp(a.z, b.z, t)
    out.px = lerp(a.px, b.px, t)
    out.py = lerp(a.py, b.py, t)
    out.pz = lerp(a.pz, b.pz, t)
    out.curva = lerp(a.curva, b.curva, t)
    out.indice = lerp(a.indice, b.indice, t)
    out.pulgar = lerp(a.pulgar, b.pulgar, t)
    out.prono = lerp(a.prono, b.prono, t)
    out.flex = lerp(a.flex, b.flex, t)
  }

  /**
   * Piernas por cinemática inversa: con la cadera donde dice la pose y los
   * tobillos en `pies` (y, z en el espacio del personaje), calcula muslo,
   * rodilla y tobillo; `pitch` = punta hacia abajo (+).
   */
  private ik(P: Pose, pies: readonly Pie[]) {
    const cad = this.cu.j.cadera
    const oy = P[RAIZ + 1]
    const oz = P[RAIZ + 2]
    const ic = H.cadera * 3
    _e.set(P[ic], P[ic + 1], P[ic + 2])
    _m4.makeRotationFromEuler(_e)
    for (let k = 0; k < 2; k++) {
      const pg = this.piernas[k]
      const pie = pies[k]
      _q.subVectors(pg.cad, cad).applyMatrix4(_m4)
      const hy = cad.y + oy + _q.y
      const hz = cad.z + oz + _q.z
      const dy = hy - pie.y
      const dz = pie.z - hz
      let d = Math.sqrt(dy * dy + dz * dz)
      const max = (pg.L1 + pg.L2) * 0.9995
      if (d > max) d = max
      const cosK = clamp((pg.L1 * pg.L1 + pg.L2 * pg.L2 - d * d) / (2 * pg.L1 * pg.L2), -1, 1)
      const kappa = Math.PI - Math.acos(cosK)
      const base = Math.atan2(dz, dy)
      const cosA = clamp((pg.L1 * pg.L1 + d * d - pg.L2 * pg.L2) / (2 * pg.L1 * d), -1, 1)
      const th1 = base + Math.acos(cosA)
      const r1 = -(th1 - pg.f1)
      const r2 = kappa + (pg.f2 - pg.f1)
      const r3 = pie.pitch - r1 - r2
      const I = lado$(pg.lado)
      const im = I.muslo
      P[im] = r1
      // El muslo compensa el giro de la cadera: la rodilla dobla hacia adelante.
      P[im + 1] = -P[ic + 1]
      P[I.rodilla] = r2
      P[I.tobillo] = r3
      P[I.punta] = pie.punta
    }
  }

  /**
   * Apoyo: pies más abiertos (abducción del muslo, el tobillo la compensa para
   * que la suela quede plana), puntas afuera y el desplazamiento lateral de
   * cada pie (reacomodo). Va después de ik().
   */
  private apoyo(P: Pose, k: number) {
    const pf = this.pf
    for (let q = 0; q < 2; q++) {
      const pg = this.piernas[q]
      const I = lado$(pg.lado)
      const L = pg.L1 + pg.L2
      const abd = (pf.apoyo * this.s * k + pg.lado * this.offPie[q].dx) / L
      P[I.muslo + 2] += pg.lado * abd
      P[I.tobillo + 2] -= pg.lado * abd
      P[I.muslo + 1] += pg.lado * pf.puntas * k
    }
  }

  // ── Postura propia ─────────────────────────────────────────

  private postura(P: Pose, k: number) {
    const pf = this.pf
    const enc = pf.encorvar * k
    const pa = pf.pechoAfuera * k
    const ca = pf.cabezaAdelante * k
    this.r(P, "cadera", pf.pelvis * k)
    this.r(P, "columna", enc * 0.5 - pa * 0.35)
    this.r(P, "pecho", enc * 0.6 - pa)
    this.r(P, "cuello", ca + enc * 0.25)
    // La mirada vuelve a quedar horizontal (salvo el mentón propio).
    this.r(P, "cabeza", -ca * 0.95 - enc * 1.2 + pa * 1.3 + pf.menton * k, 0, pf.ladeo * k)
    for (const lado of LADOS) {
      const I = lado$(lado)
      this.ri(P, I.clavicula, 0, lado * pf.hombrosAtras * k, -lado * pf.hombrosCaida * k)
    }
  }

  // ── Poses ───────────────────────────────────────────────────

  private respirar(P: Pose, k = 1) {
    // Inhalar algo más rápido que exhalar.
    const f = this.t * 1.5 + this.sem
    const b = 0.5 + 0.5 * Math.sin(f + 0.35 * Math.sin(f))
    this.r(P, "columna", -0.006 * b * k)
    this.r(P, "pecho", -0.022 * b * k)
    this.r(P, "cuello", 0.012 * b * k)
    this.r(P, "cabeza", 0.012 * b * k)
    this.r(P, "claviculaI", 0, 0, 0.03 * b * k)
    this.r(P, "claviculaD", 0, 0, -0.03 * b * k)
    // (los brazos siguen colgando: el hombro compensa la clavícula)
    this.r(P, "hombroI", 0, 0, -0.022 * b * k)
    this.r(P, "hombroD", 0, 0, 0.022 * b * k)
  }

  /** Micromovimiento: nadie está quieto del todo (3 octavas, 0,2–0,8 Hz). */
  private vida(P: Pose, k: number) {
    const t = this.t
    const s = this.sem
    const a = 0.009 * k * this.pf.vaiven
    this.r(P, "columna", a * ruido(t * 0.35, s + 11), 0, a * 0.8 * ruido(t * 0.27, s + 13))
    this.r(P, "pecho", a * 0.5 * ruido(t * 0.31, s + 17), a * 1.2 * ruido(t * 0.22, s + 19))
    this.r(P, "cuello", a * 0.8 * ruido(t * 0.45, s + 23), a * ruido(t * 0.33, s + 29))
    this.r(P, "cabeza", a * 1.2 * ruido(t * 0.52, s + 31), a * 0.8 * ruido(t * 0.4, s + 37), a * 1.1 * ruido(t * 0.37, s + 41))
  }

  /** El peso de una pierna a la otra, y a veces un paso de reacomodo del pie libre. */
  private pesoYPies(P: Pose, d: number) {
    const s = this.s
    const pe = this.peso
    const pf = this.pf
    const sem = this.sem
    pe.prox -= d
    if (pe.prox <= 0) {
      pe.n++
      const h1 = hash(pe.n, 1, sem)
      const h2 = hash(pe.n, 2, sem)
      const h3 = hash(pe.n, 3, sem)
      const signo = pe.obj === 0 ? (h1 > 0.5 ? 1 : -1) : h1 > 0.3 ? -Math.sign(pe.obj) : Math.sign(pe.obj)
      pe.obj = clamp(pf.peso + signo * (0.45 + 0.5 * h2) * (1 - 0.6 * Math.abs(pf.peso)), -1, 1)
      pe.prox = (8 + 7 * h3) / Math.sqrt(Math.max(0.3, pf.vaiven))
      // Paso de reacomodo del pie que queda libre.
      if (hash(pe.n, 4, sem) < 0.55) {
        const q = pe.obj > 0 ? 1 : 0
        pe.paso = q
        pe.pt0 = 0
        const o = this.offPie[q]
        pe.dx0 = o.dx
        pe.dz0 = o.dz
        pe.dz1 = clamp(o.dz + (hash(pe.n, 5, sem) - 0.5) * 0.09 * s, -0.06 * s, 0.06 * s)
        pe.dx1 = clamp(o.dx + (hash(pe.n, 6, sem) - 0.45) * 0.04 * s, -0.012 * s, 0.035 * s)
      }
    }
    // Resorte críticamente amortiguado (ω = 2,2: ~1,2 s de transferencia).
    const w = 2.2
    pe.vel += (w * w * (pe.obj - pe.v) - 2 * w * pe.vel) * d
    pe.v += pe.vel * d
    // Paso: arranca cuando el peso ya pasó.
    let alza = 0
    if (pe.paso >= 0) {
      pe.pt0 += d
      const u = clamp((pe.pt0 - 0.55) / 0.7, 0, 1)
      const e = u * u * (3 - 2 * u)
      const o = this.offPie[pe.paso]
      o.dx = lerp(pe.dx0, pe.dx1, e)
      o.dz = lerp(pe.dz0, pe.dz1, e)
      alza = 0.022 * s * Math.sin(Math.PI * u)
      if (u >= 1) pe.paso = -1
    }
    const p = pe.v + 0.12 * ruido(this.t * 0.17, sem + 3) * pf.vaiven
    P[RAIZ] = 0.03 * s * p
    P[RAIZ + 1] = -this.pf.rodilla * s - 0.007 * s * Math.abs(p)
    this.r(P, "cadera", 0, 0.03 * p, 0.05 * p)
    // Contrapposto: los hombros se inclinan al revés que la cadera.
    this.r(P, "columna", 0, -0.02 * p, -0.035 * p)
    this.r(P, "pecho", 0, -0.01 * p, -0.03 * p)
    this.r(P, "cuello", 0, 0, 0.02 * p)
    for (let q = 0 as 0 | 1; q < 2; q = (q + 1) as 0 | 1) {
      const pg = this.piernas[q]
      const o = this.offPie[q]
      this.pie(q, pg.tob.y + (pe.paso === q ? alza : 0), pg.tob.z + o.dz, pe.paso === q ? 0.12 * Math.min(1, alza / (0.01 * s)) : 0)
    }
  }

  /** Brazos de reposo propios (manos juntas, en el bolsillo, en el chaleco…). */
  private reposo(P: Pose, peso: number) {
    const s = this.s
    for (const lado of LADOS) {
      const g = REPOSO[lado > 0 ? this.pf.reposoI : this.pf.reposoD]
      const m = this.manoR
      this.objetivo(g, lado, 0, m)
      // (las manos no quedan clavadas en el aire)
      m.x += 0.004 * s * ruido(this.t * 0.3, this.sem + lado * 5)
      m.y += 0.005 * s * ruido(this.t * 0.25, this.sem + lado * 9)
      m.z += 0.004 * s * ruido(this.t * 0.28, this.sem + lado * 13)
      this.brazoIK(P, this.brazos[lado > 0 ? 0 : 1], m, peso)
      this.manoForma(P, lado, m)
    }
  }

  private poseQuieto(P: Pose, d: number) {
    this.pesoYPies(P, d)
    this.postura(P, 1)
    this.respirar(P)
    this.vida(P, 1)
    this.mirar(P, 1)
    this.ik(P, this.pies)
    this.apoyo(P, 1)
    this.reposo(P, 1)
  }

  /** Cabeza y ojos hacia el objetivo de atención (o la mirada propia). */
  private mirar(P: Pose, k: number) {
    const c = this.cab
    const cm = this.cabezaMira
    let yaw = cm.ty
    let pitch = cm.tp
    if (this.aten.on) {
      const rz = this.raiz
      const dx = this.aten.x - rz.position.x
      const dz = this.aten.z - rz.position.z
      const ry = rz.rotation.y
      const lx = dx * Math.cos(ry) - dz * Math.sin(ry)
      const lz = dx * Math.sin(ry) + dz * Math.cos(ry)
      const hy = rz.position.y + this.cu.j.cabeza.y + 0.06 * this.s
      yaw = clamp(Math.atan2(lx, lz), -1.25, 1.25)
      pitch = clamp(Math.atan2(hy - this.aten.y, Math.max(0.3, Math.hypot(lx, lz))), -0.35, 0.45)
    }
    c.oyaw = yaw
    c.opitch = pitch
    this.r(P, "pecho", 0, 0.12 * c.yaw * k)
    this.r(P, "cuello", 0.4 * c.pitch * k, 0.33 * c.yaw * k)
    this.r(P, "cabeza", 0.6 * c.pitch * k, 0.55 * c.yaw * k)
  }

  /** Resorte de la cabeza (críticamente amortiguado, ~0,3 s). */
  private moverCabeza(d: number) {
    const c = this.cab
    const w = 9
    const oy = c.oyaw
    const op = c.opitch
    // Un giro grande arranca con un parpadeo.
    if (Math.abs(oy - c.yaw) > 0.5 && this.parpadeo <= 0 && Math.abs(c.vy) < 0.2) this.parpadeo = 0.16
    c.vy += (w * w * (oy - c.yaw) - 2 * w * c.vy) * d
    c.yaw += c.vy * d
    c.vp += (w * w * (op - c.pitch) - 2 * w * c.vp) * d
    c.pitch += c.vp * d
  }

  private poseCaminar(P: Pose, v: number, forzarCorrer: boolean, dt: number) {
    const s = this.s
    const pf = this.pf
    const vel = v > 0.08 ? v : forzarCorrer ? 3.4 : 1.25
    const kR = forzarCorrer ? Math.max(0.85, suave(1.9, 3.0, vel)) : suave(2.0, 3.1, vel)
    const pasosSeg = lerp(1.5 + 0.34 * vel, 2.5 + 0.11 * vel, kR) * Math.pow(1 / s, 0.35) * lerp(pf.cadencia, 1, kR)
    this.fase = (this.fase + dt * pasosSeg * 0.5) % 1
    const p = this.fase
    const paso = vel / pasosSeg
    const duty = lerp(0.6, 0.36, kR)
    for (let k = 0 as 0 | 1; k < 2; k++) {
      const pg = this.piernas[k]
      const q = (p + k * 0.5) % 1
      let z: number
      let y = pg.tob.y
      let pitch = 0
      let punta = 0
      if (q < duty) {
        const u = q / duty
        z = lerp(duty * paso, -duty * paso, u)
        if (kR < 0.5) {
          // Talón que toca y se aplana; al final el talón sube y la punta empuja.
          pitch = -0.26 * (1 - suave(0, 0.16, u)) * (1 - kR * 2)
          const e = suave(0.62, 1, u)
          pitch += 0.55 * e
          y += pg.fPie * 0.75 * Math.sin(Math.max(0, pitch))
          punta = -0.75 * e
        } else {
          pitch = 0.12 + 0.35 * suave(0.5, 1, u)
          y += pg.fPie * 0.8 * Math.sin(Math.max(0, pitch - 0.12))
          punta = -0.4 * suave(0.5, 1, u)
        }
      } else {
        const u = (q - duty) / (1 - duty)
        const e = 0.5 - 0.5 * Math.cos(Math.PI * u)
        z = lerp(-duty * paso, duty * paso, e)
        const alto = lerp(0.075, 0.2, kR) * s
        y += alto * Math.sin(Math.PI * Math.pow(u, lerp(1, 0.75, kR))) + (kR > 0.5 ? 0.08 * s * Math.sin(Math.PI * Math.min(1, u * 1.6)) * kR : 0)
        pitch = lerp(lerp(0.5, 0.25, kR), lerp(-0.2, 0.05, kR), suave(0, 0.85, u))
        punta = -0.2 * (1 - u)
      }
      this.pie(k as 0 | 1, y, pg.tob.z + z, pitch, punta)
    }
    // Cadera: baja un poco, rebota, va hacia el pie de apoyo y gira.
    const c = Math.cos(2 * Math.PI * (p - duty / 2))
    const c2 = Math.cos(4 * Math.PI * (p - duty / 2))
    const giro = -lerp(0.085, 0.12, kR) * Math.cos(2 * Math.PI * p)
    const kc = lerp(pf.cadera, 1, kR)
    P[RAIZ] = lerp(0.02, 0.008, kR) * s * c * Math.sqrt(kc)
    P[RAIZ + 1] = -lerp(0.022, 0.075, kR) * s + lerp(0.011, -0.032, kR) * s * c2
    P[RAIZ + 2] = 0
    this.r(P, "cadera", lerp(0.02, 0.06, kR), giro, lerp(0.045, 0.03, kR) * c * kc)
    this.r(P, "columna", lerp(0.03, 0.14, kR), -giro * 0.6, -0.035 * c * kc)
    this.r(P, "pecho", lerp(0.01, 0.06, kR), -giro * 1.25, -0.018 * c * kc)
    // Cabeza estable: compensa el rebote y el giro del pecho (la mirada no baila).
    this.r(P, "cuello", -lerp(0.02, 0.1, kR), giro * 0.45)
    this.r(P, "cabeza", -lerp(0.02, 0.1, kR) - 0.012 * c2, giro * 0.4, 0.02 * c * kc)
    this.respirar(P, 0.5)
    this.postura(P, lerp(0.7, 0.3, kR))
    this.mirar(P, 0.6)
    // Braceo opuesto a las piernas.
    const am = lerp((0.42 + 0.1 * clamp(vel - 1.3, -0.5, 1)) * pf.braceo, 0.66, kR)
    const bI = am * Math.cos(2 * Math.PI * p) - 0.04
    const bD = -am * Math.cos(2 * Math.PI * p) - 0.04
    const afuera = lerp(0.07 + pf.brazosAfuera, 0.16, kR)
    this.r(P, "hombroI", bI, 0, afuera)
    this.r(P, "hombroD", bD, 0, -afuera)
    // (el codo se dobla más cuando el brazo va adelante)
    this.r(P, "codoI", lerp(-0.26 - 0.4 * Math.max(0, -bI), -1.5 + 0.18 * Math.cos(2 * Math.PI * p), kR))
    this.r(P, "codoD", lerp(-0.26 - 0.4 * Math.max(0, -bD), -1.5 - 0.18 * Math.cos(2 * Math.PI * p), kR))
    this.mano(P, 1, lerp(0.22, 0.9, kR), 0.18)
    this.mano(P, -1, lerp(0.22, 0.9, kR), 0.18)
    this.ik(P, this.pies)
    this.apoyo(P, lerp(0.35, 0, kR))
    // Manos que no bracean (atrás, en el bolsillo, con el cuaderno).
    const wR = 1 - kR
    for (const lado of LADOS) {
      const nombre = lado > 0 ? pf.caminaI : pf.caminaD
      if (!nombre || wR <= 0) continue
      const I = lado$(lado)
      // (se borra el braceo de ese brazo antes del IK)
      for (let q = 0; q < I.manoEntera.length; q++) {
        const h = I.manoEntera[q]
        P[h] = 0
        P[h + 1] = 0
        P[h + 2] = 0
      }
      const m = this.manoR
      this.objetivo(REPOSO[nombre], lado, 0, m)
      m.z += 0.012 * s * Math.cos(2 * Math.PI * p) * lado
      this.brazoIK(P, this.brazos[lado > 0 ? 0 : 1], m, wR)
      this.manoForma(P, lado, m)
    }
  }

  private poseSentado(P: Pose) {
    const s = this.s
    const t = this.t
    const hip = this.cu.j.musloI
    // Cadera sobre el asiento (0,5 m), un poco hacia atrás.
    P[RAIZ + 1] = 0.5 + 0.088 * s - hip.y
    P[RAIZ + 2] = -0.06 * s
    this.r(P, "cadera", -0.12)
    this.r(P, "columna", 0.12)
    this.r(P, "pecho", 0.08)
    this.r(P, "cuello", 0.1)
    this.r(P, "cabeza", 0.12 + 0.03 * ruido(t * 0.3, this.sem), 0.1 * ruido(t * 0.13, this.sem + 1))
    this.respirar(P, 0.8)
    this.vida(P, 0.7)
    // (encorvado y cabeza adelantada propios; el mentón no: mira la pantalla)
    const pf = this.pf
    this.r(P, "columna", pf.encorvar * 0.4)
    this.r(P, "pecho", pf.encorvar * 0.4)
    this.r(P, "cuello", pf.cabezaAdelante)
    this.r(P, "cabeza", -pf.cabezaAdelante * 0.9 - pf.encorvar * 0.7)
    // Brazos al teclado (IK: las manos quedan delante del vientre de cada uno,
    // no adentro), palmas abajo, dedos tecleando.
    for (const lado of LADOS) {
      const m = this.manoR
      this.objetivo(TECLEA, lado, 0, m)
      // El teclado está quieto en la mesa (a 0,78 m): las manos van ahí aunque el torso se mueva.
      m.x = lado * 0.17 * s
      m.y = 0.785 + 0.006 * s * ruido(t * 0.7, this.sem + lado)
      m.z = Math.max(0.33 * s, this.silueta(this.zF, this.cu.j.columna.y) + 0.1 * s) + P[RAIZ + 2]
      this.alPecho(P, m)
      const tecla = 0.12 * Math.max(0, Math.sin(t * (lado > 0 ? 9.3 : 8.1) + this.sem)) * Math.max(0, Math.sin(t * 1.7 + lado))
      m.curva += tecla
      m.indice += tecla * 1.3
      this.brazoIK(P, this.brazos[lado > 0 ? 0 : 1], m, 1)
      this.manoForma(P, lado, m)
    }
    // Pies apoyados en el piso, rodillas al frente (algo abiertas: no se cruzan).
    for (let k = 0 as 0 | 1; k < 2; k++) {
      const pg = this.piernas[k]
      this.pie(k as 0 | 1, pg.tob.y, pg.cad.z + P[RAIZ + 2] + pg.L1 * 0.92, 0)
    }
    this.ik(P, this.pies)
    for (let q = 0; q < 2; q++) {
      const pg = this.piernas[q]
      const I = lado$(pg.lado)
      P[I.muslo + 1] += pg.lado * 0.1
    }
  }

  /** Frases y pausas: quién habla lo dice el motor o, si no, un horario propio determinista. */
  private planHabla(d: number) {
    const f = this.frase
    const sem = this.sem
    const en = this.pf.energia
    f.prox -= d
    f.fin -= d
    if (f.prox <= 0) {
      f.n++
      const h1 = hash(f.n, 11, sem)
      const h2 = hash(f.n, 12, sem)
      const h3 = hash(f.n, 13, sem)
      const ext = this.hablaExterna
      // (sin el motor: a veces escucha, para que dos que conversan no hablen siempre a la vez)
      f.habla = ext !== null ? ext : h1 > 0.3
      // Frases de 1,2–1,9 s con respiros cortos (y a veces una pausa larga): cada una
      // trae su gesto. Con frases de hasta 5,4 s el que hablaba quedaba en la misma
      // pose toda la toma y solo se movía la mandíbula.
      const dur = f.habla ? 1.2 + 0.7 * h2 : 1.6 + 2.6 * h2
      f.fin = dur
      f.prox = dur + (f.habla ? 0.15 + 0.35 * h3 + (h3 > 0.82 ? 1.0 : 0) : 0.35 + 1.1 * h3)
      // Gesto: el primero de la lista sale más seguido; no se repite el mismo dos veces seguidas.
      // Al escuchar: la pose de escucha (si tiene) o las manos en reposo.
      const n = this.pf.gestos.length
      let g: number
      if (f.habla) {
        g = Math.min(n - 1, Math.floor(Math.pow(hash(f.n, 14, sem), 1.3) * n))
        if (n > 1 && g === f.g && hash(f.n, 15, sem) < 0.7) g = (g + 1) % n
      } else g = this.iEscucha >= 0 && hash(f.n, 16, sem) < 0.55 ? this.iEscucha : this.iVacio
      if (g !== f.g) {
        f.gPrev = f.g < 0 ? this.iVacio : f.g
        f.g = g
        f.cambio = 0
      }
    }
    if (this.hablaExterna !== null && this.hablaExterna !== f.habla && f.fin > 0) {
      // El motor cambió de turno a mitad de frase: se corta aquí.
      f.fin = 0
      f.prox = Math.min(f.prox, 0.3)
    }
    f.cambio = Math.min(1, f.cambio + (d * en) / 0.45)
    const activa = f.fin > 0
    // Envolvente del gesto: sube al empezar a hablar, se sostiene en pausas cortas y baja en las largas.
    let objetivo: number
    if (f.habla) objetivo = activa ? 1 : f.prox < 0.9 ? 0.6 : 0
    else objetivo = f.g === this.iEscucha && activa ? 1 : 0
    const vel = objetivo > f.env ? 2.6 * en : 1.6
    f.env += clamp(objetivo - f.env, -vel * d, vel * d)
    const vObj = f.habla && activa ? 1 : 0
    f.voz += clamp(vObj - f.voz, -8 * d, 8 * d)
  }

  private poseHabla(P: Pose, d: number) {
    this.planHabla(d)
    const f = this.frase
    const t = this.t
    const sem = this.sem
    const pf = this.pf
    const en = pf.energia
    const s = this.s
    this.pesoYPies(P, d)
    this.postura(P, 1)
    this.respirar(P)
    this.vida(P, 1.1)
    this.mirar(P, 1)
    // Rebote sobre los pies (Karp).
    if (pf.rebote) P[RAIZ + 1] -= pf.rebote * 0.008 * s * (0.5 + 0.5 * Math.sin(t * 6.3 + sem)) * f.env
    this.ik(P, this.pies)
    this.apoyo(P, 1)
    // Sílabas y acentos (cada tres sílabas, en el pico de una).
    const fuerza = 0.5 + 0.5 * Math.sin(t * 3.1 + sem)
    const silaba = Math.max(0, Math.sin(t * 13 + sem)) * fuerza * (0.6 + 0.4 * Math.sin(t * 0.8))
    const ac = Math.max(0, Math.sin((t * 13 + sem - Math.PI / 2) / 3 + Math.PI / 2))
    const golpe = ac * ac * ac * ac * (0.45 + 0.55 * fuerza) * f.voz * Math.min(1.4, en)
    // Gesto actual (con la transición desde el anterior) o pose de escucha.
    const gCur = this.gestos[f.g < 0 ? this.iVacio : f.g]
    const gAnt = this.gestos[f.gPrev < 0 ? this.iVacio : f.gPrev]
    const kc = f.cambio * f.cambio * (3 - 2 * f.cambio)
    const env = f.env * f.env * (3 - 2 * f.env)
    const amp = Math.min(1.8, 1.5 * (0.75 + 0.3 * en))
    for (const lado of LADOS) {
      const ladoG = this.espejo ? -lado : lado
      const reposo = REPOSO[lado > 0 ? pf.reposoI : pf.reposoD]
      const mR = this.manoR
      const mG = this.manoG
      const mP = this.manoP
      this.objetivo(reposo, lado, 0, mR)
      mR.x += 0.004 * s * ruido(t * 0.3, sem + lado * 5)
      mR.y += 0.005 * s * ruido(t * 0.25, sem + lado * 9)
      const gc = ladoG < 0 ? gCur.d : gCur.i
      const ga = ladoG < 0 ? gAnt.d : gAnt.i
      let w = env
      if (gc) this.objetivo(gc, lado, golpe * amp, mG)
      else Animador.copiar(mR, mG)
      if (ga && kc < 1) {
        this.objetivo(ga, lado, golpe * amp, mP)
        Animador.mezclar(mP, mG, kc, mG)
      } else if (!ga && kc < 1) {
        Animador.mezclar(mR, mG, kc, mG)
      }
      if (!gc && (!ga || kc >= 1)) w = 0
      // Deriva lenta: el gesto respira.
      mG.x += 0.012 * s * ruido(t * 0.6, sem + lado * 3) * en
      mG.y += 0.012 * s * ruido(t * 0.5, sem + lado * 7) * en
      mG.z += 0.01 * s * ruido(t * 0.45, sem + lado * 11)
      Animador.mezclar(mR, mG, w, mG)
      this.brazoIK(P, this.brazos[lado > 0 ? 0 : 1], mG, 1)
      this.manoForma(P, lado, mG)
    }
    // Cabeza y torso del gesto, y la cabeza que asiente en los acentos.
    const gT = gCur
    const asiente = (gT.asiente ?? 0.02) * golpe * 1.4
    const cab = gT.cab
    const tor = gT.torso
    this.r(P, "cabeza", asiente + (cab ? cab[0] * env : 0), (cab ? cab[1] * env : 0) + 0.05 * Math.sin(t * 0.9 + sem) * f.voz, cab ? cab[2] * env : 0)
    this.r(P, "cuello", asiente * 0.4)
    if (tor) this.r(P, "pecho", tor[0] * env, tor[1] * env * (this.espejo ? -1 : 1), tor[2] * env)
    // Mandíbula: sílabas (cerrada al escuchar).
    this.r(P, "mandibula", 0.02 * f.voz + 0.075 * silaba * f.voz)
  }

  private static copiar(a: Mano, out: Mano) {
    Animador.mezclar(a, a, 0, out)
  }

  private poseDuerme(P: Pose) {
    const s = this.s
    const b = Math.sin(this.t * 0.9) * 0.5 + 0.5
    P[RAIZ + 1] = -0.025 * s
    this.r(P, "columna", 0.06)
    this.r(P, "pecho", 0.1 - 0.03 * b)
    this.r(P, "cuello", 0.32)
    this.r(P, "cabeza", 0.22, 0.05, 0.12)
    this.r(P, "claviculaI", 0, 0, -0.04 + 0.015 * b)
    this.r(P, "claviculaD", 0, 0, 0.04 - 0.015 * b)
    this.r(P, "hombroI", 0.06, 0, 0.04)
    this.r(P, "hombroD", 0.06, 0, -0.04)
    this.r(P, "codoI", -0.1)
    this.r(P, "codoD", -0.1)
    this.mano(P, 1, 0.25, 0.1)
    this.mano(P, -1, 0.25, 0.1)
    const pi = this.piernas[0]
    const pd = this.piernas[1]
    this.pie(0, pi.tob.y, pi.tob.z, 0)
    this.pie(1, pd.tob.y, pd.tob.z, 0)
    this.ik(P, this.pies)
  }

  private poseDeporte(P: Pose, dt: number) {
    const s = this.s
    const t = this.t
    const pi = this.piernas[0]
    const pd = this.piernas[1]
    if (this.balon) {
      // Dribleo: postura atlética, la mano derecha empuja el balón al ritmo del bote.
      this.fase = (this.fase + dt * 1.9) % 1
      const q = this.fase
      const empuje = Math.exp(-(((q < 0.5 ? q : q - 1) / 0.12) ** 2))
      P[RAIZ + 1] = -0.085 * s + 0.01 * s * Math.cos(q * Math.PI * 2)
      this.r(P, "cadera", 0.18, -0.12)
      this.r(P, "columna", 0.16, 0.06)
      this.r(P, "pecho", 0.08, 0.04)
      this.r(P, "cuello", -0.12)
      this.r(P, "cabeza", -0.12, 0.04)
      this.r(P, "hombroD", -0.32 - 0.12 * empuje, 0, -0.32)
      this.r(P, "codoD", -0.75 + 0.42 * empuje)
      this.mano(P, -1, -0.05, 1.25, 0.2 - 0.3 * empuje)
      // El otro brazo, abierto, protege el balón.
      this.r(P, "hombroI", -0.3, 0, 0.5)
      this.r(P, "codoI", -0.95)
      this.mano(P, 1, 0.12, 0.5)
      this.pie(0, pi.tob.y, pi.tob.z + 0.12 * s, 0)
      this.pie(1, pd.tob.y, pd.tob.z - 0.1 * s, 0)
      this.ik(P, this.pies)
      this.apoyo(P, 1.6)
    } else {
      // Boxeo de sombra: guardia, jab y cruzado, saltitos.
      const g = this.golpe
      g.prox -= dt
      if (g.prox <= 0) {
        g.lado = g.lado > 0 ? -1 : 1
        g.t = 0
        g.prox = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.1 + this.sem))
      }
      g.t += dt
      const ext = g.t < 0.28 ? Math.sin((g.t / 0.28) * Math.PI) : 0
      P[RAIZ + 1] = -0.06 * s + 0.018 * s * Math.abs(Math.sin(t * 7))
      this.r(P, "cadera", 0.08, -0.3)
      this.r(P, "columna", 0.12, 0.12 + 0.2 * ext * -g.lado)
      this.r(P, "pecho", 0.06, 0.08 + 0.15 * ext * -g.lado)
      this.r(P, "cuello", -0.05, 0.05)
      this.r(P, "cabeza", -0.06, 0.05)
      for (const lado of LADOS) {
        const I = lado$(lado)
        const e = g.lado === lado ? ext : 0
        this.ri(P, I.hombro, lerp(-1.0, -1.42, e), 0, lado * lerp(0.42, 0.12, e))
        this.ri(P, I.codo, lerp(-2.05, -0.12, e))
        this.mano(P, lado, 1.05, lerp(0.6, 1.4, e), 0.1)
      }
      this.pie(0, pi.tob.y, pi.tob.z + 0.16 * s, 0.06)
      this.pie(1, pd.tob.y + 0.02 * s, pd.tob.z - 0.14 * s, 0.35)
      this.ik(P, this.pies)
      this.apoyo(P, 1.6)
    }
  }

  // ── Cuadro ─────────────────────────────────────────────────

  actualizar(estado: EstadoCuerpo, dt: number, velocidad: number) {
    const sinTiempo = dt <= 0
    const d = Math.min(Math.max(dt, 0), 0.1)
    this.t += d
    if (estado !== this.estado) {
      if (!(esLoco(estado) && esLoco(this.estado))) {
        this.previa.set(this.salida)
        this.mezcla = sinTiempo ? 1 : 0
      }
      this.estado = estado
    }
    // Vistazos propios (si el motor no da a quién mirar).
    const c = this.cabezaMira
    c.prox -= d
    if (c.prox <= 0) {
      const n = Math.floor(this.t * 0.7)
      const habla = estado === "habla"
      const mira = estado === "quieto" || habla
      // (al conversar casi siempre mira al frente, donde está el otro; quieto, mira alrededor)
      const amp = habla ? 0.18 : 0.45
      c.ty = mira && hash(n, 21, this.sem) > 0.25 ? amp * (2 * hash(n, 22, this.sem) - 1) : 0
      c.tp = mira ? 0.05 * (2 * hash(n, 23, this.sem) - 1) : 0
      c.prox = (habla ? 2.5 : 1.8) + 2.5 * hash(n, 24, this.sem)
    }
    const P = this.destino
    P.fill(0)
    switch (estado) {
      case "camina":
        this.poseCaminar(P, velocidad, false, d)
        break
      case "corre":
        this.poseCaminar(P, velocidad, true, d)
        break
      case "sentado":
        this.poseSentado(P)
        break
      case "habla":
        this.poseHabla(P, d)
        break
      case "duerme":
        this.poseDuerme(P)
        break
      case "deporte":
        this.poseDeporte(P, d)
        break
      default:
        this.poseQuieto(P, d)
    }
    if (estado !== "habla") {
      // Fuera de una conversación los gestos se apagan (y vuelven desde cero).
      this.frase.env = Math.max(0, this.frase.env - d * 2)
      this.frase.voz = 0
    }
    this.moverCabeza(d)
    // Parpadeo y ojos.
    this.proxParpadeo -= d
    if (this.proxParpadeo <= 0) {
      this.parpadeo = 0.16
      this.proxParpadeo = 2.2 + 3.5 * (0.5 + 0.5 * Math.sin(this.t * 5.3 + this.sem))
    }
    let cierre = 0
    if (this.parpadeo > 0) {
      this.parpadeo -= d
      cierre = Math.sin(clamp(1 - this.parpadeo / 0.16, 0, 1) * Math.PI)
    }
    if (estado === "duerme") cierre = 1
    const pa = this.cu.cab.parpado
    const cerrar = (pa.Vu + pa.Vl) * 0.92 * cierre
    this.r(P, "parpadoI", cerrar)
    this.r(P, "parpadoD", cerrar)
    const m = this.mirada
    m.prox -= d
    if (m.prox <= 0) {
      // Mirada casi siempre al frente, con pequeños saltos (sacádicos).
      m.tx = 0.03 * Math.sin(this.t * 4.7 + this.sem)
      m.ty = 0.05 * Math.sin(this.t * 3.3 + this.sem * 2)
      m.prox = 0.6 + 1.6 * (0.5 + 0.5 * Math.sin(this.t * 2.9))
    }
    // Los ojos se adelantan a la cabeza (sacada) y vuelven al centro cuando ella llega.
    const cb = this.cab
    const adelYaw = clamp(cb.oyaw - cb.yaw, -0.3, 0.3)
    const adelPitch = clamp(cb.opitch - cb.pitch, -0.2, 0.2)
    const kO = Math.min(1, d * 25)
    m.x += (m.tx + adelPitch - m.x) * kO
    m.y += (m.ty + adelYaw - m.y) * kO
    this.r(P, "ojoI", m.x + (estado === "sentado" ? 0.12 : 0), m.y)
    this.r(P, "ojoD", m.x + (estado === "sentado" ? 0.12 : 0), m.y)
    // Mezcla entre estados.
    if (this.mezcla < 1) this.mezcla = Math.min(1, this.mezcla + d / 0.4)
    const w = this.mezcla * this.mezcla * (3 - 2 * this.mezcla)
    const S = this.salida
    for (let i = 0; i < N; i++) S[i] = this.previa[i] + (P[i] - this.previa[i]) * w
    // Aplicar a los huesos.
    const hs = this.huesos
    for (let i = 0; i < NH; i++) hs[i].rotation.set(S[i * 3], S[i * 3 + 1], S[i * 3 + 2])
    const cad = this.cu.j.cadera
    hs[0].position.set(cad.x + S[RAIZ], cad.y + S[RAIZ + 1], cad.z + S[RAIZ + 2])
    this.coronilla = this.cu.H + S[RAIZ + 1]

    // Balón y utilería.
    const b = this.balon
    if (b || this.utileria) this.raiz.updateMatrixWorld(true)
    if (b) {
      const mano = hs[H.manoD]
      const r = 0.12
      _q.setFromMatrixPosition(mano.matrixWorld)
      this.raiz.worldToLocal(_q)
      if (estado === "deporte") {
        const q = this.fase
        const k = Math.pow(Math.abs(1 - 2 * q), 1.25)
        b.position.set(_q.x - 0.03, r + (_q.y - 0.09 - r) * k, _q.z + 0.06)
        b.rotation.x += d * 9
        b.visible = true
      } else {
        b.position.set(_q.x - 0.06 * this.s, _q.y - 0.02, _q.z + 0.05)
        b.visible = estado === "quieto" || estado === "camina" || estado === "habla"
      }
    }
    if (this.utileria) this.utileria.visible = estado === "quieto" || estado === "camina" || estado === "habla" || estado === "ascensor"
  }
}
