// ──────────────────────────────────────────────────────────────
// Cámara: intro, dron, seguir, cine y nivel.
//
// - intro: el plano de apertura. Arranca en el Jardín Norte mirando el farol y
//   el frontón del Pórtico Norte (como la foto), retrocede y sube por encima de
//   la fuente y de la reja, gira por el este y termina en una toma aérea del
//   complejo con el Monumento a Washington al fondo.
// - dron: órbita libre (OrbitControls); en reposo gira muy lento.
// - seguir: detrás y arriba del personaje, con retraso suave (tipo GTA). Se
//   puede orbitar con el dedo; al soltar, vuelve a ponerse detrás.
// - cine: rota entre las tomas del modo grabación (TOMAS_CINE).
// - nivel: vista de casa de muñecas de un subsuelo, desde arriba a ~55°.
//
// Las tomas son datos: agregar una es agregar una entrada a TOMAS.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { ALTURA_NIVEL, type NivelId } from "../tipos"
import { CELDAS, HUELLAS, LUGAR } from "../lugares"
import type { ModoCamara } from "./contrato"

export interface Pose {
  pos: THREE.Vector3
  mira: THREE.Vector3
  fov: number
}

const nuevaPose = (): Pose => ({ pos: new THREE.Vector3(), mira: new THREE.Vector3(), fov: 45 })

/** Edificios de la superficie con su altura: la cámara no entra en ellos. */
const EDIFICIOS = [HUELLAS.residencia, HUELLAS.alaOeste, HUELLAS.eeob, HUELLAS.tesoro, { ...HUELLAS.porticoNorte, alto: 18 }]
function edificioEn(x: number, z: number, margen = 0): { x0: number; x1: number; z0: number; z1: number; alto: number } | null {
  for (const e of EDIFICIOS) if (x > e.x0 - margen && x < e.x1 + margen && z > e.z0 - margen && z < e.z1 + margen) return e
  // Pórtico Sur (semicírculo)
  const ps = HUELLAS.porticoSur
  if (z > ps.cz && Math.hypot(x - ps.cx, z - ps.cz) < ps.radio + margen) return { x0: -ps.radio, x1: ps.radio, z0: ps.cz, z1: ps.cz + ps.radio, alto: 18 }
  return null
}

export interface InfoPersonaje {
  pos: THREE.Vector3
  rumbo: number
  visible: boolean
  nivel: NivelId
}

/** Lo que la cámara necesita del motor. */
export interface DepsCamara {
  nivel(): NivelId
  /** Cambia de nivel con fundido a negro; `alCambiar` corre con la pantalla en negro. */
  fundir(accion: () => void): void
  aplicarNivel(n: NivelId): void
  setMaqueta(on: boolean): void
  personaje(id: string): InfoPersonaje | null
  /** Un personaje a la vista para las tomas que siguen a alguien. */
  elegirPersonaje(): string | null
}

interface CtxToma {
  /** Estado suavizado del seguimiento (tomas que siguen a alguien). */
  seguir(dt: number, out: Pose): boolean
}

interface Toma {
  id: string
  nombre: string
  duracion: number
  maqueta?: boolean
  nivel(t: number): NivelId
  pose(t: number, out: Pose, ctx: CtxToma, dt: number): boolean
}

const S: NivelId = "superficie"
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const lerp = THREE.MathUtils.lerp
const suave = (t: number) => t * t * (3 - 2 * t)
const muySuave = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Centro de un lugar (para las tomas que lo usan), o un punto de respaldo. */
function centroLugar(id: string, respaldo: THREE.Vector3): THREE.Vector3 {
  const l = LUGAR[id]
  return l ? v3((l.x0 + l.x1) / 2, l.y, (l.z0 + l.z1) / 2) : respaldo
}

const PN = HUELLAS.porticoNorte
const FN = HUELLAS.fuenteNorte

/** Las tomas del modo grabación, en el orden de la especificación. */
const TOMAS: Toma[] = [
  {
    id: "portico-norte",
    nombre: "Pórtico Norte",
    duracion: 9,
    nivel: () => S,
    pose(t, o) {
      const k = suave(t)
      o.pos.set(lerp(-1.5, 1.5, k), lerp(2.0, 2.8, k), lerp(FN.z + FN.radio + 1.5, PN.z0 - 15, k))
      o.mira.set(0, 11.2, PN.z0 + 4)
      o.fov = lerp(46, 42, k)
      return true
    },
  },
  {
    id: "dron",
    nombre: "Dron sobre el complejo",
    duracion: 10,
    nivel: () => S,
    pose(t, o) {
      const a = -0.55 + t * 0.6
      o.pos.set(Math.sin(a) * 240, 115, 35 - Math.cos(a) * 240)
      o.mira.set(0, 4, 35)
      o.fov = 42
      return true
    },
  },
  {
    id: "bajada",
    nombre: "Bajada al subsuelo",
    duracion: 10,
    nivel: (t) => (t < 0.5 ? S : "n1"),
    pose(t, o) {
      if (t < 0.5) {
        const k = muySuave(t / 0.5)
        o.pos.set(0, lerp(75, 4, k), lerp(5, 64, k))
        o.mira.set(0, lerp(0, -6, k), lerp(55, 80, k))
      } else {
        const y = ALTURA_NIVEL.n1
        const k = suave((t - 0.5) / 0.5)
        o.pos.set(0, y + lerp(34, 18, k), lerp(16, 46, k))
        o.mira.set(0, y, lerp(60, 84, k))
      }
      o.fov = 44
      return true
    },
  },
  {
    id: "departamento",
    nombre: "Un departamento por dentro",
    duracion: 9,
    nivel: () => "n1",
    pose(t, o) {
      const id = CELDAS.n1[0][0]
      const l = LUGAR[id]
      const y = ALTURA_NIVEL.n1
      const x0 = l ? l.x0 : -86
      const x1 = l ? l.x1 : -46
      const z0 = l ? l.z0 : 29
      const z1 = l ? l.z1 : 63
      const k = suave(t)
      o.pos.set(lerp(x0 + 4, x1 - 4, k), y + 6.2, z0 - 2)
      o.mira.set(lerp(x0 + 9, x1 - 9, k), y + 0.6, (z0 + z1) / 2 + 2)
      o.fov = 48
      return true
    },
  },
  {
    id: "seguir",
    nombre: "Detrás de un personaje",
    duracion: 10,
    nivel: () => S,
    pose(_t, o, ctx, dt) {
      return ctx.seguir(dt, o)
    },
  },
  {
    id: "sala-guerra",
    nombre: "Sala de guerra",
    duracion: 9,
    nivel: () => "n2",
    pose(t, o) {
      const c = centroLugar("sala-guerra", v3(22, ALTURA_NIVEL.n2, 46))
      const a = 0.4 + t * 0.9
      o.pos.set(c.x + Math.sin(a) * 21, c.y + 14, c.z - Math.cos(a) * 21)
      o.mira.set(c.x, c.y + 1, c.z)
      o.fov = 45
      return true
    },
  },
  {
    id: "maqueta",
    nombre: "Modo maqueta",
    duracion: 10,
    maqueta: true,
    nivel: () => S,
    pose(t, o) {
      const a = 2.35 + t * 0.35
      o.pos.set(Math.sin(a) * 175, 150, 10 - Math.cos(a) * 175)
      o.mira.set(-4, 2, 12)
      o.fov = 28
      return true
    },
  },
]

/** Para la interfaz: el selector de tomas del modo grabación. */
export const TOMAS_CINE: ReadonlyArray<{ id: string; nombre: string; duracion: number }> = TOMAS.map((t) => ({
  id: t.id,
  nombre: t.nombre,
  duracion: t.duracion,
}))

// ── Intro ────────────────────────────────────────────────────
const INTRO_DURACION = 13
const INTRO_POS = new THREE.CatmullRomCurve3(
  [
    v3(0, 2.4, FN.z + FN.radio + 2),
    v3(0.6, 7.5, FN.z - 2),
    v3(5, 16, HUELLAS.reja.z0 - 3),
    v3(34, 44, -112),
    v3(72, 96, -192),
  ],
  false,
  "centripetal",
)
const INTRO_MIRA = new THREE.CatmullRomCurve3(
  [v3(0, 11, PN.z0 + 5), v3(0, 10, PN.z0 + 8), v3(0, 7, -4), v3(4, 2, 34), v3(10, 0, 108)],
  false,
  "centripetal",
)
const INTRO_FOV: [number, number] = [50, 42]

/** La pose final de la intro: también es la vista aérea por defecto. */
export function poseAerea(out: Pose = nuevaPose()): Pose {
  out.pos.copy(INTRO_POS.getPointAt(1))
  out.mira.copy(INTRO_MIRA.getPoint(1))
  out.fov = INTRO_FOV[1]
  return out
}

/** Vista por defecto de un subsuelo: desde el norte, a ~55° sobre el horizonte. */
function poseNivel(n: NivelId, out: Pose = nuevaPose()): Pose {
  const y = ALTURA_NIVEL[n]
  const S2 = HUELLAS.subsuelo
  const cx = (S2.x0 + S2.x1) / 2
  const cz = (S2.z0 + S2.z1) / 2
  const elev = 55 * THREE.MathUtils.DEG2RAD
  const d = 175
  out.mira.set(cx, y, cz)
  out.pos.set(cx + 18, y + Math.sin(elev) * d, cz - Math.cos(elev) * d)
  out.fov = 45
  return out
}

const LIMITES: Record<"superficie" | "nivel" | "seguir", Partial<OrbitControls>> = {
  superficie: { minDistance: 4, maxDistance: 1100, minPolarAngle: 0.05, maxPolarAngle: 1.5, enablePan: true },
  nivel: { minDistance: 12, maxDistance: 300, minPolarAngle: 0.12, maxPolarAngle: 1.12, enablePan: true },
  seguir: { minDistance: 2.5, maxDistance: 45, minPolarAngle: 0.2, maxPolarAngle: 1.45, enablePan: false },
}

export class ControlCamara {
  readonly camara: THREE.PerspectiveCamera
  readonly controles: OrbitControls
  modo: ModoCamara = "dron"

  private readonly deps: DepsCamara
  private reloj = 0
  private ultimaInteraccion = 0
  private interactuando = false
  private intro: { t: number; resolver: () => void } | null = null
  private promesaIntro: Promise<void> | null = null
  private cine: { i: number; t: number; fija: boolean; cambiando: boolean } | null = null
  private seguirId: string | null = null
  private seguirListo = false
  private readonly seguirPose = nuevaPose()
  private enfoque: { t: number; dur: number; p0: THREE.Vector3; m0: THREE.Vector3; p1: THREE.Vector3; m1: THREE.Vector3 } | null = null
  private poseSuperficie: Pose | null = null
  private readonly pose = nuevaPose()
  private fovBase = 45

  constructor(canvas: HTMLCanvasElement, deps: DepsCamara) {
    this.deps = deps
    this.camara = new THREE.PerspectiveCamera(45, 1, 0.5, 9000)
    this.controles = new OrbitControls(this.camara, canvas)
    this.controles.enableDamping = true
    this.controles.dampingFactor = 0.07
    this.controles.screenSpacePanning = false
    this.controles.rotateSpeed = 0.6
    this.controles.zoomSpeed = 0.9
    this.controles.autoRotateSpeed = 0.18
    this.controles.addEventListener("start", this.alEmpezar)
    this.controles.addEventListener("end", this.alTerminar)
    this.aplicarLimites("superficie")
    this.ponerPose(poseAerea(this.pose))
  }

  private alEmpezar = () => {
    this.interactuando = true
    this.ultimaInteraccion = this.reloj
    this.controles.autoRotate = false
    this.enfoque = null
  }

  private alTerminar = () => {
    this.interactuando = false
    this.ultimaInteraccion = this.reloj
  }

  private aplicarLimites(tipo: keyof typeof LIMITES) {
    Object.assign(this.controles, LIMITES[tipo])
  }

  /** Coloca la cámara en una pose exacta (y el pivote de la órbita en lo que mira). */
  ponerPose(p: Pose) {
    this.camara.position.copy(p.pos)
    this.controles.target.copy(p.mira)
    this.fovBase = p.fov
    this.aplicarFov()
    this.camara.lookAt(p.mira)
  }

  /**
   * En vertical (celular, modo grabación 9:16) se abre el ángulo: las tomas
   * están pensadas en horizontal y sin esto se pierden los costados.
   */
  aplicarFov() {
    const a = this.camara.aspect
    let f = this.fovBase
    if (a < 1) f = Math.min(75, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f / 2)) / Math.sqrt(a))))
    if (Math.abs(this.camara.fov - f) > 1e-3) {
      this.camara.fov = f
      this.camara.updateProjectionMatrix()
    }
  }

  // ── Intro ──
  iniciarIntro(): Promise<void> {
    if (this.promesaIntro) return this.promesaIntro
    this.salirDeCine()
    this.modo = "intro"
    this.controles.enabled = false
    this.promesaIntro = new Promise<void>((resolver) => {
      this.intro = { t: 0, resolver }
    })
    if (this.deps.nivel() !== S) this.deps.aplicarNivel(S)
    this.poseIntro(0)
    return this.promesaIntro
  }

  /** Para pruebas: fija el avance de la intro en segundos. */
  fijarIntro(segundos: number) {
    if (this.intro) {
      this.intro.t = segundos
      this.poseIntro(Math.min(1, segundos / INTRO_DURACION))
    }
  }

  saltarIntro() {
    if (!this.intro) return
    this.deps.fundir(() => this.terminarIntro())
  }

  private terminarIntro() {
    const it = this.intro
    if (!it) return
    this.intro = null
    this.promesaIntro = null
    this.ponerPose(poseAerea(this.pose))
    this.entrarDron()
    it.resolver()
  }

  private poseIntro(u: number) {
    // Un respiro al principio, aceleración suave y llegada lenta.
    const k = muySuave(Math.min(1, Math.max(0, (u - 0.03) / 0.97)))
    this.pose.pos.copy(INTRO_POS.getPointAt(k))
    this.pose.mira.copy(INTRO_MIRA.getPoint(k))
    this.pose.fov = lerp(INTRO_FOV[0], INTRO_FOV[1], k)
    this.ponerPose(this.pose)
  }

  // ── Modos ──
  setModo(modo: ModoCamara, objetivoId?: string) {
    if (modo === "intro") {
      void this.iniciarIntro()
      return
    }
    if (this.intro) this.terminarIntro()
    if (modo !== "cine") this.salirDeCine()
    this.enfoque = null
    if (modo === "dron") {
      if (this.deps.nivel() !== S) {
        this.deps.fundir(() => {
          this.deps.aplicarNivel(S)
          this.ponerPose(this.poseSuperficie ?? poseAerea(this.pose))
          this.entrarDron()
        })
      } else this.entrarDron()
    } else if (modo === "seguir") {
      const id = objetivoId ?? this.seguirId ?? this.deps.elegirPersonaje()
      if (!id || !this.deps.personaje(id)) {
        this.entrarDron()
        return
      }
      this.seguirId = id
      this.seguirListo = false
      this.modo = "seguir"
      this.controles.enabled = true
      this.controles.autoRotate = false
      this.aplicarLimites("seguir")
    } else if (modo === "cine") {
      const fija = objetivoId ? TOMAS.findIndex((t) => t.id === objetivoId) : -1
      if (fija < 0 && objetivoId && this.deps.personaje(objetivoId)) this.seguirId = objetivoId
      this.modo = "cine"
      this.controles.enabled = false
      this.controles.autoRotate = false
      const i = fija >= 0 ? fija : this.cine && !this.cine.fija ? this.cine.i : 0
      this.cine = { i, t: 0, fija: fija >= 0, cambiando: false }
      this.empezarToma(i)
    } else if (modo === "nivel") {
      const n = this.deps.nivel()
      if (n === S) this.entrarDron()
      else this.entrarNivel(n)
    }
  }

  private entrarDron() {
    this.modo = "dron"
    this.controles.enabled = true
    this.aplicarLimites("superficie")
    this.ultimaInteraccion = this.reloj
  }

  /** Llamado por el motor al cambiar de nivel (con la pantalla en negro). */
  encuadrarNivel(n: NivelId, desde: NivelId) {
    if (desde === S && n !== S) this.poseSuperficie = { pos: this.camara.position.clone(), mira: this.controles.target.clone(), fov: this.camara.fov }
    if (this.modo === "cine" || this.modo === "intro") return
    if (this.modo === "seguir") {
      this.seguirListo = false
      return
    }
    if (n === S) {
      this.ponerPose(this.poseSuperficie ?? poseAerea(this.pose))
      this.entrarDron()
    } else this.entrarNivel(n)
  }

  private entrarNivel(n: NivelId) {
    this.modo = "nivel"
    this.controles.enabled = true
    this.controles.autoRotate = false
    this.aplicarLimites("nivel")
    this.ponerPose(poseNivel(n, this.pose))
  }

  /** Lleva la cámara a mirar un punto, en ~1 s. */
  enfocar(p: THREE.Vector3, distancia: number) {
    if (this.intro) this.terminarIntro()
    if (this.modo === "cine" || this.modo === "seguir") {
      this.salirDeCine()
      this.entrarDron()
    }
    const dir = this.camara.position.clone().sub(this.controles.target)
    if (dir.lengthSq() < 1e-4) dir.set(0, 1, -1)
    dir.normalize()
    // Que no quede rasante: al menos 25° de elevación (35° en un subsuelo).
    const min = Math.sin((this.modo === "nivel" ? 35 : 25) * THREE.MathUtils.DEG2RAD)
    if (dir.y < min) {
      const h = Math.sqrt(Math.max(0, 1 - min * min))
      const plano = Math.hypot(dir.x, dir.z) || 1
      dir.set((dir.x / plano) * h, min, (dir.z / plano) * h)
    }
    this.enfoque = {
      t: 0,
      dur: 1.1,
      p0: this.camara.position.clone(),
      m0: this.controles.target.clone(),
      p1: p.clone().addScaledVector(dir, distancia),
      m1: p.clone(),
    }
  }

  // ── Cine ──
  private salirDeCine() {
    if (this.cine) {
      this.cine = null
      this.deps.setMaqueta(false)
    }
  }

  private empezarToma(i: number) {
    const toma = TOMAS[i]
    const ctx = this.ctxToma()
    const arrancar = () => {
      if (!this.cine) return
      this.cine.i = i
      this.cine.t = 0
      this.cine.cambiando = false
      this.seguirListo = false
      this.deps.setMaqueta(!!toma.maqueta)
      const n = this.nivelDeToma(toma, 0)
      if (n !== this.deps.nivel()) this.deps.aplicarNivel(n)
      if (toma.pose(0, this.pose, ctx, 0)) this.ponerPose(this.pose)
    }
    if (this.cine) this.cine.cambiando = true
    this.deps.fundir(arrancar)
  }

  private nivelDeToma(toma: Toma, t: number): NivelId {
    if (toma.id === "seguir" && this.seguirId) return this.deps.personaje(this.seguirId)?.nivel ?? S
    return toma.nivel(t)
  }

  private ctxToma(): CtxToma {
    return {
      seguir: (dt, out) => {
        if (!this.seguirId || !this.deps.personaje(this.seguirId)?.visible) this.seguirId = this.deps.elegirPersonaje()
        if (!this.seguirId) return false
        return this.calcularSeguimiento(dt, out)
      },
    }
  }

  /** Detrás y arriba del personaje, con retraso suave. Devuelve false si no hay a quién seguir. */
  private calcularSeguimiento(dt: number, out: Pose): boolean {
    const info = this.seguirId ? this.deps.personaje(this.seguirId) : null
    if (!info) return false
    const adelante = _v.set(Math.sin(info.rumbo), 0, Math.cos(info.rumbo))
    const deseadaPos = _v2.copy(info.pos).addScaledVector(adelante, -6.5)
    deseadaPos.y += 3.1
    const deseadaMira = _v3.copy(info.pos).addScaledVector(adelante, 2.5)
    deseadaMira.y += 1.3
    const sp = this.seguirPose
    if (!this.seguirListo || sp.pos.distanceTo(deseadaPos) > 60) {
      sp.pos.copy(deseadaPos)
      sp.mira.copy(deseadaMira)
      this.seguirListo = true
    } else {
      sp.pos.lerp(deseadaPos, 1 - Math.exp(-2.2 * dt))
      sp.mira.lerp(deseadaMira, 1 - Math.exp(-4.5 * dt))
    }
    out.pos.copy(sp.pos)
    out.mira.copy(sp.mira)
    out.fov = 50
    return true
  }

  // ── Cada cuadro ──
  actualizar(dt: number) {
    this.reloj += dt
    if (this.intro) {
      this.intro.t += dt
      const u = this.intro.t / INTRO_DURACION
      this.poseIntro(Math.min(1, u))
      if (u >= 1) this.terminarIntro()
      return
    }
    if (this.cine) {
      this.actualizarCine(dt)
      return
    }
    if (this.enfoque) {
      const e = this.enfoque
      e.t += dt
      const k = suave(Math.min(1, e.t / e.dur))
      this.camara.position.lerpVectors(e.p0, e.p1, k)
      this.controles.target.lerpVectors(e.m0, e.m1, k)
      if (k >= 1) this.enfoque = null
    }
    if (this.modo === "seguir") this.actualizarSeguir(dt)
    if (this.modo === "dron") {
      // En reposo, una órbita muy lenta (como un dron que espera).
      this.controles.autoRotate = !this.interactuando && !this.enfoque && this.reloj - this.ultimaInteraccion > 8
    }
    this.controles.update(dt)
    this.limitar()
  }

  private actualizarCine(dt: number) {
    const c = this.cine!
    const toma = TOMAS[c.i]
    if (!c.cambiando) {
      c.t += dt / toma.duracion
      const t = Math.min(1, c.t)
      const n = this.nivelDeToma(toma, t)
      if (n !== this.deps.nivel()) {
        c.cambiando = true
        this.deps.fundir(() => {
          this.deps.aplicarNivel(n)
          if (this.cine) this.cine.cambiando = false
        })
      }
      if (!toma.pose(t, this.pose, this.ctxToma(), dt)) c.t = 1
      else this.ponerPose(this.pose)
      if (c.t >= 1) {
        const sig = c.fija ? c.i : (c.i + 1) % TOMAS.length
        this.empezarToma(sig)
      }
    } else if (toma.pose(Math.min(1, c.t), this.pose, this.ctxToma(), dt)) {
      this.ponerPose(this.pose)
    }
  }

  private actualizarSeguir(dt: number) {
    const info = this.seguirId ? this.deps.personaje(this.seguirId) : null
    if (!info) return
    if (info.nivel !== this.deps.nivel()) {
      // Bajó en el ascensor: la cámara lo acompaña al otro nivel.
      const n = info.nivel
      this.deps.fundir(() => {
        this.deps.aplicarNivel(n)
        this.seguirListo = false
      })
      return
    }
    const deseado = _v.copy(info.pos)
    deseado.y += 1.5
    // Dentro de un edificio no se ve: la cámara se queda afuera y encuadra el edificio.
    const caja = !info.visible && info.nivel === S ? edificioEn(info.pos.x, info.pos.z) : null
    if (caja) deseado.set((caja.x0 + caja.x1) / 2, caja.alto * 0.45, (caja.z0 + caja.z1) / 2)
    const t = this.controles.target
    if (!this.seguirListo) {
      // Al empezar: detrás del personaje, a 9 m y unos 25° por encima.
      const atras = _v2.set(-Math.sin(info.rumbo), 0, -Math.cos(info.rumbo))
      const lejos = caja ? Math.max(42, (caja.x1 - caja.x0) * 0.9) : 8.2
      this.camara.position.copy(deseado).addScaledVector(atras, lejos).add(_v3.set(0, caja ? lejos * 0.45 : 3.8, 0))
      t.copy(deseado)
      this.seguirListo = true
      return
    }
    const delta = _v2.copy(deseado).sub(t).multiplyScalar(1 - Math.exp(-6 * dt))
    t.add(delta)
    this.camara.position.add(delta)
    if (caja) {
      // Lejos del edificio, sin girar detrás de alguien que no se ve.
      const min = Math.max(42, (caja.x1 - caja.x0) * 0.9)
      const off = _v3.copy(this.camara.position).sub(t)
      if (off.length() < min) this.camara.position.copy(t).add(off.setLength(min))
      return
    }
    // Sin tocar la pantalla por un rato, la cámara vuelve a ponerse detrás.
    if (!this.interactuando && this.reloj - this.ultimaInteraccion > 1.5) {
      const off = _v3.copy(this.camara.position).sub(t)
      const esf = _esf.setFromVector3(off)
      const objetivo = info.rumbo + Math.PI
      let d = objetivo - esf.theta
      d = Math.atan2(Math.sin(d), Math.cos(d))
      esf.theta += d * (1 - Math.exp(-1.6 * dt))
      off.setFromSpherical(esf)
      this.camara.position.copy(t).add(off)
    }
  }

  /** Que la cámara no atraviese el suelo y el pivote no se escape del mapa. */
  private limitar() {
    const n = this.deps.nivel()
    const t = this.controles.target
    if (n === S) {
      if (t.y < 0) t.y = 0
      const r = Math.hypot(t.x, t.z - 40)
      if (r > 700) {
        t.x *= 700 / r
        t.z = 40 + (t.z - 40) * (700 / r)
      }
      if (this.camara.position.y < 1.2) this.camara.position.y = 1.2
      // La cámara nunca entra a un edificio: si queda dentro, sube por encima del techo.
      const p = this.camara.position
      const dentro = edificioEn(p.x, p.z, 1.5)
      if (dentro && p.y < dentro.alto + 2) p.y = dentro.alto + 2
    } else if (this.modo === "nivel") {
      const y = ALTURA_NIVEL[n]
      const S2 = HUELLAS.subsuelo
      t.x = Math.min(S2.x1 + 5, Math.max(S2.x0 - 5, t.x))
      t.z = Math.min(S2.z1 + 5, Math.max(S2.z0 - 5, t.z))
      t.y = y
    }
    // Plano cercano según la distancia: precisión de profundidad de cerca y de lejos.
    const d = this.camara.position.distanceTo(t)
    const near = Math.min(2.5, Math.max(0.15, d * 0.006))
    if (Math.abs(near - this.camara.near) > 0.02) {
      this.camara.near = near
      this.camara.updateProjectionMatrix()
    }
  }

  /** Rumbo de la cámara en planta (0 = mirando al sur, +z), para el radar. */
  enPlanta(): { x: number; z: number; rumbo: number } {
    this.camara.getWorldDirection(_v)
    return { x: this.camara.position.x, z: this.camara.position.z, rumbo: Math.atan2(_v.x, _v.z) }
  }

  get introActiva(): boolean {
    return this.intro !== null
  }

  get tomaActual(): string | null {
    return this.cine ? TOMAS[this.cine.i].id : null
  }

  dispose() {
    this.controles.removeEventListener("start", this.alEmpezar)
    this.controles.removeEventListener("end", this.alTerminar)
    this.controles.dispose()
    if (this.intro) {
      const r = this.intro.resolver
      this.intro = null
      r()
    }
  }
}

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _esf = new THREE.Spherical()
