// ──────────────────────────────────────────────────────────────
// La vida del personaje: animación por huesos.
//
// - Caminar y correr: piernas con cinemática inversa (dos huesos) y pies que
//   no patinan (la zancada sale de la velocidad), apoyo de talón y despegue
//   de punta, transferencia de peso (cadera hacia el pie de apoyo), rotación
//   de cadera y hombros en contra, braceo, rebote y cabeza estable.
// - Quieto: respiración, peso que pasa de una pierna a la otra, vistazos.
// - Sentado: tecleando, con la vista en la pantalla.
// - Habla: gestos con las manos, cabeza que asiente, mandíbula que se mueve.
// - Duerme, deporte (dribleo con balón o golpes de boxeo), parpadeo.
// Entre estados, una mezcla suave de 0,4 s.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { EstadoCuerpo } from "../tipos"
import { H, HUESOS, type Cuerpo, type NombreHueso } from "./avatar-cuerpo"
import { clamp, lerp, suave } from "./avatar-geo"

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

const _q = new THREE.Vector3()
const _e = new THREE.Euler()
const _m4 = new THREE.Matrix4()

/** Ruido suave determinista (suma de senos). */
function ruido(t: number, s: number): number {
  return 0.5 * Math.sin(t * 1.13 + s) + 0.3 * Math.sin(t * 2.37 + s * 1.7) + 0.2 * Math.sin(t * 4.11 + s * 2.9)
}

export class Animador {
  private readonly cu: Cuerpo
  private readonly huesos: THREE.Bone[]
  private readonly raiz: THREE.Object3D
  private readonly piernas: [Pierna, Pierna]
  private readonly s: number
  private readonly sem: number
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
  private cabezaMira = { y: 0, ty: 0, prox: 3 }
  private golpe = { lado: 1, t: 0, prox: 0.6 }
  readonly balon: THREE.Object3D | null
  readonly utileria: THREE.Object3D | null
  /** Altura de la coronilla en el cuadro (para la etiqueta). */
  coronilla = 0

  constructor(cu: Cuerpo, huesos: THREE.Bone[], raiz: THREE.Object3D, op: { balon: THREE.Object3D | null; utileria: THREE.Object3D | null; semilla: number }) {
    this.cu = cu
    this.huesos = huesos
    this.raiz = raiz
    this.s = cu.s
    this.sem = op.semilla
    this.t = (op.semilla % 1000) * 0.137
    this.balon = op.balon
    this.utileria = op.utileria
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
  }

  private r(P: Pose, h: NombreHueso, x: number, y = 0, z = 0) {
    const i = H[h] * 3
    P[i] += x
    P[i + 1] += y
    P[i + 2] += z
  }

  /** Mano: curvatura de dedos (0 abierta, 1 puño) y giro de la muñeca. */
  private mano(P: Pose, lado: 1 | -1, curva: number, prono = 0, flex = 0) {
    const L = lado > 0 ? "I" : "D"
    this.r(P, `dedos${L}`, 0, 0, -lado * curva * 1.1)
    this.r(P, `dedos2${L}`, 0, 0, -lado * curva * 1.25)
    this.r(P, `pulgar${L}`, 0.15 * curva, 0, -lado * 0.25 * curva)
    this.r(P, `mano${L}`, flex, -lado * prono, 0)
  }

  /**
   * Piernas por cinemática inversa: con la cadera donde dice la pose y los
   * tobillos en `pies` (y, z en el espacio del personaje), calcula muslo,
   * rodilla y tobillo; `pitch` = punta hacia abajo (+).
   */
  private ik(P: Pose, pies: Array<{ y: number; z: number; x?: number; pitch: number; punta?: number }>) {
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
      let d = Math.hypot(dy, dz)
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
      const L = pg.lado > 0 ? "I" : "D"
      const im = H[`muslo${L}`] * 3
      P[im] = r1
      // El muslo compensa el giro de la cadera: la rodilla dobla hacia adelante.
      P[im + 1] = -P[ic + 1]
      P[H[`rodilla${L}`] * 3] = r2
      P[H[`tobillo${L}`] * 3] = r3
      P[H[`punta${L}`] * 3] = pie.punta ?? 0
    }
  }

  // ── Poses ───────────────────────────────────────────────────

  private respirar(P: Pose, k = 1) {
    const b = Math.sin(this.t * 1.55 + this.sem) * 0.5 + 0.5
    this.r(P, "pecho", -0.012 * b * k)
    this.r(P, "claviculaI", 0, 0, 0.012 * b * k)
    this.r(P, "claviculaD", 0, 0, -0.012 * b * k)
  }

  private brazosSueltos(P: Pose, k = 1) {
    const sw = ruido(this.t * 0.5, this.sem) * 0.02
    this.r(P, "hombroI", 0.03 + sw, 0, 0.06 * k)
    this.r(P, "hombroD", 0.03 - sw, 0, -0.06 * k)
    this.r(P, "codoI", -0.16)
    this.r(P, "codoD", -0.16)
    this.mano(P, 1, 0.38, 0.12)
    this.mano(P, -1, 0.38, 0.12)
  }

  private poseQuieto(P: Pose) {
    const s = this.s
    const t = this.t
    // El peso pasa de una pierna a la otra (lento) y la cadera cae del lado libre.
    const peso = Math.sin(t * 0.21 + this.sem) * 0.8 + ruido(t * 0.1, this.sem) * 0.2
    P[RAIZ] = 0.022 * s * peso
    P[RAIZ + 1] = -0.008 * s - 0.006 * s * Math.abs(peso)
    this.r(P, "cadera", 0, 0.03 * peso, 0.035 * peso)
    this.r(P, "columna", 0.01, -0.02 * peso, -0.025 * peso)
    this.r(P, "pecho", 0.01, -0.01 * peso, -0.012 * peso)
    this.respirar(P)
    this.brazosSueltos(P)
    this.mirar(P)
    const pi = this.piernas[0]
    const pd = this.piernas[1]
    this.ik(P, [
      { y: pi.tob.y, z: pi.tob.z, pitch: 0 },
      { y: pd.tob.y, z: pd.tob.z, pitch: 0 },
    ])
  }

  private mirar(P: Pose) {
    const c = this.cabezaMira
    c.y += (c.ty - c.y) * 0.05
    this.r(P, "cuello", 0, c.y * 0.35)
    this.r(P, "cabeza", 0.02 * ruido(this.t * 0.4, this.sem + 3), c.y * 0.65, 0.03 * ruido(this.t * 0.3, this.sem + 5))
  }

  private poseCaminar(P: Pose, v: number, forzarCorrer: boolean, dt: number) {
    const s = this.s
    const vel = v > 0.08 ? v : forzarCorrer ? 3.4 : 1.25
    const kR = forzarCorrer ? Math.max(0.85, suave(1.9, 3.0, vel)) : suave(2.0, 3.1, vel)
    const pasosSeg = lerp(1.5 + 0.34 * vel, 2.5 + 0.11 * vel, kR) * Math.pow(1 / s, 0.35)
    this.fase = (this.fase + dt * pasosSeg * 0.5) % 1
    const p = this.fase
    const paso = vel / pasosSeg
    const duty = lerp(0.6, 0.36, kR)
    const pies: Array<{ y: number; z: number; pitch: number; punta: number }> = []
    for (let k = 0; k < 2; k++) {
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
          pitch = -0.22 * (1 - suave(0, 0.16, u)) * (1 - kR * 2)
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
      pies.push({ y, z: pg.tob.z + z, pitch, punta })
    }
    // Cadera: baja un poco, rebota, va hacia el pie de apoyo y gira.
    const c = Math.cos(2 * Math.PI * (p - duty / 2))
    const c2 = Math.cos(4 * Math.PI * (p - duty / 2))
    const giro = -lerp(0.085, 0.12, kR) * Math.cos(2 * Math.PI * p)
    P[RAIZ] = lerp(0.02, 0.008, kR) * s * c
    P[RAIZ + 1] = -lerp(0.022, 0.075, kR) * s + lerp(0.011, -0.032, kR) * s * c2
    P[RAIZ + 2] = 0
    this.r(P, "cadera", lerp(0.02, 0.06, kR), giro, lerp(0.045, 0.03, kR) * c)
    this.r(P, "columna", lerp(0.03, 0.14, kR), -giro * 0.55, -0.03 * c)
    this.r(P, "pecho", lerp(0.01, 0.06, kR), -giro * 1.1, -0.015 * c)
    this.r(P, "cuello", -lerp(0.02, 0.1, kR), giro * 0.25)
    this.r(P, "cabeza", -lerp(0.02, 0.1, kR) + 0.02 * c2, giro * 0.25)
    this.respirar(P, 0.5)
    // Braceo opuesto a las piernas.
    const am = lerp(0.42 + 0.1 * clamp(vel - 1.3, -0.5, 1), 0.66, kR)
    const bI = am * Math.cos(2 * Math.PI * p) - 0.04
    const bD = -am * Math.cos(2 * Math.PI * p) - 0.04
    this.r(P, "hombroI", bI, 0, lerp(0.07, 0.16, kR))
    this.r(P, "hombroD", bD, 0, -lerp(0.07, 0.16, kR))
    this.r(P, "codoI", lerp(-0.2 - 0.32 * Math.max(0, -bI), -1.5 + 0.18 * Math.cos(2 * Math.PI * p), kR))
    this.r(P, "codoD", lerp(-0.2 - 0.32 * Math.max(0, -bD), -1.5 - 0.18 * Math.cos(2 * Math.PI * p), kR))
    this.mano(P, 1, lerp(0.42, 1.05, kR), 0.15)
    this.mano(P, -1, lerp(0.42, 1.05, kR), 0.15)
    this.ik(P, pies)
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
    // Brazos al teclado: antebrazos casi horizontales, palmas abajo, dedos tecleando.
    for (const lado of [1, -1] as const) {
      const L = lado > 0 ? "I" : "D"
      this.r(P, `hombro${L}`, -0.6, 0, lado * 0.16)
      this.r(P, `codo${L}`, -1.2)
      const tecla = 0.12 * Math.max(0, Math.sin(t * (lado > 0 ? 9.3 : 8.1) + this.sem)) * Math.max(0, Math.sin(t * 1.7 + lado))
      this.mano(P, lado, 0.45 + tecla, 1.42, 0.12)
    }
    // Pies apoyados en el piso, rodillas al frente.
    const pies = this.piernas.map((pg) => ({ y: pg.tob.y, z: pg.cad.z + P[RAIZ + 2] + pg.L1 * 0.92, pitch: 0 }))
    this.ik(P, pies)
  }

  private poseHabla(P: Pose) {
    this.poseQuieto(P)
    const t = this.t
    const sem = this.sem
    // Gestos: una mano más activa que la otra; palmas que se abren.
    for (const lado of [1, -1] as const) {
      const L = lado > 0 ? "I" : "D"
      const act = lado > 0 ? 0.55 + 0.45 * Math.sin(t * 0.31 + sem) : 0.55 - 0.45 * Math.sin(t * 0.31 + sem)
      const g1 = 0.5 + 0.5 * ruido(t * 1.4, sem + lado * 3)
      const g2 = 0.5 + 0.5 * ruido(t * 1.1, sem + lado * 7)
      this.r(P, `hombro${L}`, -(0.15 + 0.5 * g1) * act, 0, lado * (0.08 + 0.2 * g2 * act))
      this.r(P, `codo${L}`, -(0.7 + 0.85 * g2) * act)
      this.mano(P, lado, -0.2 * act, -0.9 * act, -0.15 * act)
    }
    this.r(P, "cabeza", 0.045 * Math.sin(t * 2.3) * (0.5 + 0.5 * Math.sin(t * 0.7 + sem)), 0.06 * Math.sin(t * 0.9 + sem))
    // Mandíbula: sílabas.
    const silaba = Math.max(0, Math.sin(t * 13 + sem)) * (0.5 + 0.5 * Math.sin(t * 3.1 + sem)) * (0.6 + 0.4 * Math.sin(t * 0.8))
    this.r(P, "mandibula", 0.02 + 0.075 * silaba)
  }

  private poseDuerme(P: Pose) {
    const s = this.s
    const b = Math.sin(this.t * 0.9) * 0.5 + 0.5
    P[RAIZ + 1] = -0.025 * s
    this.r(P, "columna", 0.06)
    this.r(P, "pecho", 0.1 - 0.02 * b)
    this.r(P, "cuello", 0.32)
    this.r(P, "cabeza", 0.22, 0.05, 0.12)
    this.r(P, "claviculaI", 0, 0, -0.04)
    this.r(P, "claviculaD", 0, 0, 0.04)
    this.r(P, "hombroI", 0.06, 0, 0.04)
    this.r(P, "hombroD", 0.06, 0, -0.04)
    this.r(P, "codoI", -0.1)
    this.r(P, "codoD", -0.1)
    this.mano(P, 1, 0.5, 0.1)
    this.mano(P, -1, 0.5, 0.1)
    const pi = this.piernas[0]
    const pd = this.piernas[1]
    this.ik(P, [
      { y: pi.tob.y, z: pi.tob.z, pitch: 0 },
      { y: pd.tob.y, z: pd.tob.z, pitch: 0 },
    ])
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
      this.mano(P, -1, 0.15, 1.25, 0.2 - 0.3 * empuje)
      // El otro brazo, abierto, protege el balón.
      this.r(P, "hombroI", -0.3, 0, 0.5)
      this.r(P, "codoI", -0.95)
      this.mano(P, 1, 0.35, 0.5)
      this.ik(P, [
        { y: pi.tob.y, z: pi.tob.z + 0.12 * s, x: 0.05, pitch: 0 },
        { y: pd.tob.y, z: pd.tob.z - 0.1 * s, pitch: 0 },
      ])
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
      for (const lado of [1, -1] as const) {
        const L = lado > 0 ? "I" : "D"
        const e = g.lado === lado ? ext : 0
        this.r(P, `hombro${L}`, lerp(-1.0, -1.42, e), 0, lado * lerp(0.42, 0.12, e))
        this.r(P, `codo${L}`, lerp(-2.05, -0.12, e))
        this.mano(P, lado, 1.25, lerp(0.6, 1.4, e), 0.1)
      }
      this.ik(P, [
        { y: pi.tob.y, z: pi.tob.z + 0.16 * s, pitch: 0.06 },
        { y: pd.tob.y + 0.02 * s, z: pd.tob.z - 0.14 * s, pitch: 0.35 },
      ])
    }
  }

  // ── Cuadro ─────────────────────────────────────────────────

  actualizar(estado: EstadoCuerpo, dt: number, velocidad: number) {
    const sinTiempo = dt <= 0
    const d = Math.min(Math.max(dt, 0), 0.1)
    this.t += d
    const loco = (e: EstadoCuerpo) => e === "camina" || e === "corre"
    if (estado !== this.estado) {
      if (!(loco(estado) && loco(this.estado))) {
        this.previa.set(this.salida)
        this.mezcla = sinTiempo ? 1 : 0
      }
      this.estado = estado
    }
    // Vistazos y mirada.
    const c = this.cabezaMira
    c.prox -= d
    if (c.prox <= 0) {
      c.ty = estado === "quieto" || estado === "habla" ? 0.45 * Math.sin(this.t * 7.13 + this.sem) * (Math.sin(this.t * 2.1) > -0.3 ? 1 : 0) : 0
      c.prox = 1.8 + 2.5 * (0.5 + 0.5 * Math.sin(this.t * 3.7 + this.sem))
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
        this.poseHabla(P)
        break
      case "duerme":
        this.poseDuerme(P)
        break
      case "deporte":
        this.poseDeporte(P, d)
        break
      default:
        this.poseQuieto(P)
    }
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
      m.ty = 0.07 * Math.sin(this.t * 3.3 + this.sem * 2) + this.cabezaMira.ty * 0.25
      m.prox = 0.6 + 1.6 * (0.5 + 0.5 * Math.sin(this.t * 2.9))
    }
    m.x += (m.tx - m.x) * Math.min(1, d * 18)
    m.y += (m.ty - m.y) * Math.min(1, d * 18)
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
