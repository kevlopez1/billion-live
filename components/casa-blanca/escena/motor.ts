// ──────────────────────────────────────────────────────────────
// Motor de la escena 3D (contrato: Escena, CtxEscena).
//
// Arma el renderer, el cielo, la luz por hora, el postproceso y la cámara;
// llama a los constructores de arquitectura, paisaje, subsuelo y avatares (cada
// uno dentro de un try/catch: si uno falla, el resto de la escena sigue en pie)
// y corre el bucle de render.
//
// Calidad: "alta" en computadora y "media" en celular; si los FPS medios caen
// de 40 durante 3 s, baja un nivel. Si quien crea la escena pasa `calidad`,
// esa calidad queda fija (sin bajadas automáticas).
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { ALTURA_NIVEL, type Calidad, type EstadoCuerpo, type EstadoPuesto, type NivelId, type Personaje, type TickEscena, type Vec3 } from "../tipos"
import type { Avatar, CtxEscena, Escena, ModoCamara, Subsuelo, Toque } from "./contrato"
import { crearMateriales, type MaterialesMotor } from "./materiales"
import { Cielo } from "./motor-cielo"
import { Post } from "./motor-post"
import { ControlCamara, TOMAS_CINE, type InfoPersonaje } from "./motor-camara"
import { construirArquitectura } from "./arquitectura"
import { construirPaisaje } from "./paisaje"
import { construirSubsuelo } from "./subsuelo"
import { crearAvatar } from "./avatares"

export { TOMAS_CINE }

/** Lo que el motor ofrece además del contrato Escena. */
export interface EscenaMotor extends Escena {
  /** Modo maqueta: tilt-shift, más saturación y contraste (una toma del modo grabación y un botón). */
  modoMaqueta(on: boolean): void
  /** Si el modo maqueta está prendido. */
  maqueta(): boolean
  /** Las tomas del modo grabación, para el selector. `modoCamara("cine", id)` fija una. */
  tomas(): ReadonlyArray<{ id: string; nombre: string; duracion: number }>
  /** La toma que está corriendo en modo cine (null fuera de cine). */
  tomaActual(): string | null
  /** El modo de cámara actual. */
  camara(): ModoCamara
  /** Solo para pruebas y depuración. */
  depurar: {
    /** Fija el avance de la intro (segundos) y quita el fundido. */
    fijarIntro(segundos: number): void
    /** Dibuja un cuadro ya (sin esperar al bucle). */
    cuadro(dt?: number): void
    info(): { calidad: Calidad; hora: number; noche: number; drawCalls: number; triangulos: number; fps: number }
  }
}

const NIVELES: NivelId[] = ["superficie", "n1", "n2", "n3"]

/** El nivel al que pertenece una altura (superficie si y > -4, n1 si -12 < y ≤ -4…). */
export function nivelDeY(y: number): NivelId {
  if (y > -4) return "superficie"
  if (y > -12) return "n1"
  if (y > -20) return "n2"
  return "n3"
}

const PIXEL_RATIO: Record<Calidad, number> = { alta: 1.5, media: 1.5, baja: 1 }
const SOMBRA: Record<Calidad, number> = { alta: 4096, media: 2048, baja: 0 }
/** Luces nocturnas encendidas por nivel; las que sobran se apagan (cada luz cuesta en todos los materiales). */
const LUCES_POR_NIVEL: Record<Calidad, number> = { alta: 14, media: 6, baja: 2 }
const LUCES_CON_SOMBRA: Record<Calidad, number> = { alta: 2, media: 0, baja: 0 }

function calidadInicial(): Calidad {
  if (typeof navigator === "undefined") return "alta"
  const movil =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches)
  return movil ? "media" : "alta"
}

function intentar<T>(que: string, fn: () => T): T | null {
  try {
    return fn()
  } catch (e) {
    console.error(`[casa-blanca] falló ${que}:`, e)
    return null
  }
}

// Fondo de los subsuelos: un degradé oscuro, como un estudio.
function fondoInterior(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 4
  c.height = 256
  const g = c.getContext("2d")!
  const d = g.createLinearGradient(0, 0, 0, 256)
  d.addColorStop(0, "#162238")
  d.addColorStop(0.55, "#0b111d")
  d.addColorStop(1, "#05070b")
  g.fillStyle = d
  g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Revelado de los retratos: ACES + sRGB a mano (en un render target three no aplica el tono).
const REVELADO = new THREE.ShaderMaterial({
  uniforms: { tMapa: { value: null }, uExpo: { value: 1.05 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tMapa;
uniform float uExpo;
varying vec2 vUv;
vec3 rrt( vec3 v ) {
  vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
  vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
  return a / b;
}
vec3 aces( vec3 c ) {
  const mat3 entrada = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 salida = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c *= uExpo / 0.6;
  return clamp( salida * rrt( entrada * c ), 0.0, 1.0 );
}
vec3 srgb( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
void main() {
  vec4 t = texture2D( tMapa, vUv );
  vec3 c = t.a > 0.001 ? t.rgb / t.a : vec3( 0.0 );
  gl_FragColor = vec4( srgb( aces( c ) ), clamp( t.a, 0.0, 1.0 ) );
}`,
  depthTest: false,
  depthWrite: false,
})

interface EstadoAvatar {
  pos: Vec3
  rumbo: number
  estado: EstadoCuerpo
  visible: boolean
  velocidad: number
}

export function crearEscena(canvas: HTMLCanvasElement, opciones: { personajes: Personaje[]; calidad?: Calidad }): EscenaMotor {
  let calidad: Calidad = opciones.calidad ?? calidadInicial()
  const automatica = !opciones.calidad

  // ── Renderer ──
  // El antialias de la geometría lo hace el postproceso (MSAA en el búfer de la escena o FXAA):
  // el canvas solo recibe un cuadro plano, así que pedirle antialias al contexto sería memoria perdida.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" })
  renderer.info.autoReset = false
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  // PCFSoftShadowMap ya no existe en three 0.186 (avisa y cae a PCF): PCF con radio da la misma suavidad.
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.enabled = calidad !== "baja"
  const pr = () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, PIXEL_RATIO[calidad])
  renderer.setPixelRatio(pr())

  // ── Escena y niveles ──
  const scene = new THREE.Scene()
  scene.name = "casa-blanca"
  const niveles = {} as Record<NivelId, THREE.Group>
  for (const n of NIVELES) {
    const g = new THREE.Group()
    g.name = `nivel-${n}`
    g.visible = n === "superficie"
    niveles[n] = g
    scene.add(g)
  }
  const grupoAvatares = new THREE.Group()
  grupoAvatares.name = "avatares"
  scene.add(grupoAvatares)

  const materiales: MaterialesMotor = crearMateriales(calidad)
  const cielo = new Cielo(scene, renderer, calidad)
  const sol = cielo.sol
  const fondoSub = fondoInterior()
  const nieblaSub = new THREE.FogExp2(0x070b12, 0.0022)

  // ── Registro del contexto ──
  const alCuadro: Array<(t: TickEscena) => void> = []
  const nocturnos: Array<{ mat: THREE.MeshStandardMaterial; noche: number; dia: number }> = []
  const luces: Array<{ luz: THREE.Light; intensidad: number; activa: boolean; nivel: NivelId }> = []
  const seleccionables = new Map<THREE.Object3D, string>()
  let nocheActual = 0

  const ctx: CtxEscena = {
    scene,
    niveles,
    calidad,
    sombras: calidad !== "baja",
    alActualizar(fn) {
      alCuadro.push(fn)
    },
    alAnochecer(mat, noche, dia = 0) {
      nocturnos.push({ mat, noche, dia })
      mat.emissiveIntensity = dia + (noche - dia) * nocheActual
    },
    luzNocturna(luz, intensidadNoche) {
      luces.push({ luz, intensidad: intensidadNoche, activa: true, nivel: "superficie" })
      luz.intensity = intensidadNoche * nocheActual
    },
    seleccionable(obj, lugarId) {
      seleccionables.set(obj, lugarId)
      obj.userData.lugarId = lugarId
    },
    materiales,
  }
  ctx.alAnochecer(materiales.ventanaNoche, 3.2, 0)

  // ── Construcción (cada módulo aislado) ──
  intentar("construirArquitectura", () => construirArquitectura(ctx))
  intentar("construirPaisaje", () => construirPaisaje(ctx))
  const subsuelo: Subsuelo | null = intentar("construirSubsuelo", () => construirSubsuelo(ctx))

  const avatares = new Map<string, Avatar>()
  const porRaiz = new Map<THREE.Object3D, string>()
  const estados = new Map<string, EstadoAvatar>()
  const rumbos = new Map<string, number>()
  const avataresRotos = new Set<string>()
  for (const p of opciones.personajes) {
    const a = intentar(`crearAvatar(${p.id})`, () => crearAvatar(p))
    if (!a) continue
    a.raiz.visible = false
    a.raiz.userData.personajeId = p.id
    grupoAvatares.add(a.raiz)
    avatares.set(p.id, a)
    porRaiz.set(a.raiz, p.id)
  }

  // Materiales que reflejan más que el promedio (vidrio, agua, acero): su propio envMap e intensidad.
  const reflejantes: Array<{ mat: THREE.MeshStandardMaterial; factor: number }> = []
  const vistos = new Set<THREE.Material>()
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      if (vistos.has(mat)) continue
      vistos.add(mat)
      const f = mat.userData?.reflejo
      if (typeof f === "number" && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) reflejantes.push({ mat: mat as THREE.MeshStandardMaterial, factor: f })
    }
  })
  for (const m of Object.values(materiales)) {
    if (m instanceof THREE.Material && !vistos.has(m) && typeof m.userData.reflejo === "number") reflejantes.push({ mat: m as THREE.MeshStandardMaterial, factor: m.userData.reflejo })
  }

  /** Nivel al que pertenece un objeto (por el grupo que lo contiene). */
  const nivelDeObjeto = (o: THREE.Object3D): NivelId => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) for (const n of NIVELES) if (p === niveles[n]) return n
    return "superficie"
  }

  /** Enciende las luces nocturnas más fuertes de cada nivel, hasta el límite de la calidad. */
  const aplicarLimitesLuces = () => {
    const maxSombra = LUCES_CON_SOMBRA[calidad]
    for (const l of luces) l.nivel = nivelDeObjeto(l.luz)
    for (const n of NIVELES) {
      const delNivel = luces.filter((l) => l.nivel === n).sort((a, b) => b.intensidad - a.intensidad)
      let sombras = 0
      delNivel.forEach((l, i) => {
        l.activa = i < LUCES_POR_NIVEL[calidad]
        l.luz.visible = l.activa
        if (l.luz.castShadow) {
          if (l.activa && sombras < maxSombra && calidad !== "baja") sombras++
          else l.luz.castShadow = false
        }
      })
    }
  }
  aplicarLimitesLuces()

  // ── Estado de la vista ──
  let nivelActual: NivelId = "superficie"
  let maquetaOn = false
  let maquetaManual = false
  let maquetaMezcla = 0
  let hora = 17.5
  let horaSucia = true

  // Transición con fundido a negro: sale, ejecuta la acción en negro, entra.
  let trans: { fase: "sale" | "entra"; t: number; accion: (() => void) | null; durSale: number; durEntra: number } | null = null
  let fundido = 0
  const fundir = (accion: () => void) => {
    if (trans && trans.fase === "sale") {
      const previa = trans.accion
      trans.accion = () => {
        previa?.()
        accion()
      }
      return
    }
    trans = { fase: "sale", t: trans ? 1 - trans.t : 0, accion, durSale: 0.22, durEntra: 0.35 }
  }

  const aplicarNivel = (n: NivelId) => {
    const desde = nivelActual
    nivelActual = n
    for (const k of NIVELES) niveles[k].visible = k === n
    const sup = n === "superficie"
    cielo.cielo.visible = sup
    cielo.nubes.visible = sup
    scene.background = sup ? null : fondoSub
    scene.fog = sup ? cielo.niebla : nieblaSub
    camara.encuadrarNivel(n, desde)
    horaSucia = true
  }

  const infoPersonaje = (id: string): InfoPersonaje | null => {
    const a = avatares.get(id)
    const e = estados.get(id)
    if (!a || !e) return null
    return { pos: a.raiz.position, rumbo: rumbos.get(id) ?? e.rumbo, visible: e.visible, nivel: nivelDeY(e.pos.y) }
  }

  const camara = new ControlCamara(canvas, {
    nivel: () => nivelActual,
    fundir,
    aplicarNivel,
    setMaqueta: (on) => {
      maquetaOn = on
    },
    personaje: infoPersonaje,
    elegirPersonaje: () => {
      let respaldo: string | null = null
      for (const [id, e] of estados) {
        if (!e.visible || !avatares.has(id)) continue
        if (nivelDeY(e.pos.y) === "superficie" && (e.estado === "camina" || e.estado === "corre" || e.estado === "deporte")) return id
        respaldo ??= id
      }
      return respaldo
    },
  })
  const cam = camara.camara
  let post = new Post(renderer, scene, cam, calidad)

  // ── Hora ──
  const ambienteInterior = () => {
    sol.color.set("#fff1df")
    sol.intensity = 2.6
    cielo.luzDir.set(0.38, 1, -0.3).normalize()
    cielo.hemi.color.set("#dbe5ff")
    cielo.hemi.groundColor.set("#2b2723")
    cielo.hemi.intensity = 0.6
    renderer.toneMappingExposure = 1.0
  }

  const aplicarHora = (tiempoReal: number) => {
    const a = cielo.setHora(hora)
    nocheActual = a.noche
    for (const n of nocturnos) n.mat.emissiveIntensity = n.dia + (n.noche - n.dia) * nocheActual
    for (const l of luces) l.luz.intensity = l.intensidad * nocheActual
    const sup = nivelActual === "superficie"
    let env: THREE.Texture | null
    let intensidadEnv: number
    if (sup) {
      renderer.toneMappingExposure = a.exposicion
      env = cielo.entorno(tiempoReal)
      intensidadEnv = cielo.intensidadEntorno
    } else {
      ambienteInterior()
      env = cielo.entornoInterior()
      intensidadEnv = 0.6
    }
    scene.environment = env
    scene.environmentIntensity = intensidadEnv
    for (const r of reflejantes) {
      r.mat.envMap = env
      r.mat.envMapIntensity = intensidadEnv * r.factor
    }
    // La sombra de la luna solo se recalcula si la luz alumbra algo.
    sol.shadow.autoUpdate = sol.intensity > 0.03
  }

  // ── Sombras: la cámara de sombra sigue a la cámara ──
  const configurarSombras = () => {
    const sombras = calidad !== "baja"
    renderer.shadowMap.enabled = sombras
    sol.castShadow = sombras
    if (sombras) {
      const tam = SOMBRA[calidad]
      if (sol.shadow.mapSize.x !== tam) {
        sol.shadow.mapSize.set(tam, tam)
        sol.shadow.map?.dispose()
        sol.shadow.map = null
      }
      sol.shadow.radius = calidad === "alta" ? 2.2 : 1.6
      sol.shadow.bias = -0.00025
      sol.shadow.camera.near = 1
      sol.shadow.camera.far = 1400
    }
  }
  configurarSombras()

  const _ejeX = new THREE.Vector3()
  const _ejeY = new THREE.Vector3()
  const _arriba = new THREE.Vector3(0, 1, 0)
  const _centro = new THREE.Vector3()
  const seguirSombra = () => {
    const dir = cielo.luzDir
    const t = camara.controles.target
    const d = cam.position.distanceTo(t)
    _centro.copy(t)
    let mitad: number
    if (nivelActual === "superficie") {
      // Cuarto de octava: el tamaño cambia a saltos para que la sombra no tiemble al hacer zoom.
      const crudo = Math.min(300, Math.max(28, d * 0.8))
      mitad = Math.pow(2, Math.round(Math.log2(crudo) * 4) / 4)
      // Centrada un poco por delante del pivote, hacia donde mira la cámara.
      cam.getWorldDirection(_ejeX)
      _ejeX.y = 0
      if (_ejeX.lengthSq() > 1e-6) _centro.addScaledVector(_ejeX.normalize(), mitad * 0.35)
    } else {
      mitad = 105
      _centro.set(0, ALTURA_NIVEL[nivelActual], 80)
    }
    const s = sol.shadow
    const texel = (2 * mitad) / s.mapSize.x
    // Ajuste a la grilla de texels en el espacio de la luz: sin parpadeo al mover la cámara.
    _ejeX.crossVectors(_arriba, dir)
    if (_ejeX.lengthSq() < 1e-6) _ejeX.set(1, 0, 0)
    _ejeX.normalize()
    _ejeY.crossVectors(dir, _ejeX).normalize()
    const cx = _centro.dot(_ejeX)
    const cy = _centro.dot(_ejeY)
    _centro.addScaledVector(_ejeX, Math.round(cx / texel) * texel - cx).addScaledVector(_ejeY, Math.round(cy / texel) * texel - cy)
    sol.target.position.copy(_centro)
    sol.position.copy(_centro).addScaledVector(dir, 600)
    const c = s.camera
    if (c.right !== mitad) {
      c.left = -mitad
      c.right = mitad
      c.top = mitad
      c.bottom = -mitad
      c.updateProjectionMatrix()
    }
    s.normalBias = texel * 1.6
  }

  // ── Personajes ──
  const aplicarPersonajes = (dt: number) => {
    for (const [id, e] of estados) {
      const a = avatares.get(id)
      if (!a) continue
      a.raiz.position.set(e.pos.x, e.pos.y, e.pos.z)
      // Giro suave por el camino más corto.
      const actual = rumbos.get(id) ?? e.rumbo
      const dif = Math.atan2(Math.sin(e.rumbo - actual), Math.cos(e.rumbo - actual))
      const nuevo = actual + dif * (1 - Math.exp(-10 * dt))
      rumbos.set(id, nuevo)
      a.raiz.rotation.y = nuevo
      a.raiz.visible = e.visible && nivelDeY(e.pos.y) === nivelActual
      if (!a.raiz.visible && e.estado !== "camina" && e.estado !== "corre") continue
      if (avataresRotos.has(id)) continue
      try {
        a.animar(e.estado, dt, e.velocidad)
      } catch (err) {
        avataresRotos.add(id)
        console.error(`[casa-blanca] el avatar ${id} falló al animar:`, err)
      }
    }
  }

  // ── Toques: clic (no arrastre) sobre personajes, puestos o lugares ──
  const tocadores: Array<(t: Toque) => void> = []
  const raycaster = new THREE.Raycaster()
  const _ndc = new THREE.Vector2()
  let abajo: { x: number; y: number; t: number; id: number } | null = null
  const visibleEnCadena = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
    return true
  }
  const resolverToque = (hit: THREE.Intersection): Toque | null => {
    for (let p: THREE.Object3D | null = hit.object; p; p = p.parent) {
      const id = porRaiz.get(p)
      if (id) return { tipo: "personaje", id }
    }
    if (subsuelo) {
      const r = intentar("subsuelo.identificar", () => subsuelo.identificar(hit.object, hit.instanceId))
      if (r) return { tipo: "puesto", id: r.depId, puesto: r.puesto }
    }
    for (let p: THREE.Object3D | null = hit.object; p; p = p.parent) {
      const lugar = seleccionables.get(p)
      if (lugar) return { tipo: "lugar", id: lugar }
    }
    return null
  }
  const alBajar = (e: PointerEvent) => {
    abajo = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
  }
  const alSubir = (e: PointerEvent) => {
    const a = abajo
    abajo = null
    if (!a || a.id !== e.pointerId || !tocadores.length) return
    if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 7 || performance.now() - a.t > 700) return
    const r = canvas.getBoundingClientRect()
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(_ndc, cam)
    const hits = raycaster.intersectObjects([niveles[nivelActual], grupoAvatares], true)
    for (const h of hits) {
      if (!visibleEnCadena(h.object)) continue
      const t = resolverToque(h)
      if (t) {
        for (const fn of tocadores) intentar("alTocar", () => fn(t))
        return
      }
    }
  }
  canvas.addEventListener("pointerdown", alBajar)
  canvas.addEventListener("pointerup", alSubir)

  // ── Tamaño ──
  const redimensionar = () => {
    const ancho = Math.max(1, canvas.clientWidth || canvas.width)
    const alto = Math.max(1, canvas.clientHeight || canvas.height)
    renderer.setPixelRatio(pr())
    renderer.setSize(ancho, alto, false)
    cam.aspect = ancho / alto
    cam.updateProjectionMatrix()
    camara.aplicarFov()
    post.setSize(ancho, alto, renderer.getPixelRatio())
  }
  redimensionar()
  const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => redimensionar()) : null
  observador?.observe(canvas)

  // ── Calidad ──
  const setCalidadInterna = (c: Calidad) => {
    if (c === calidad) return
    calidad = c
    ctx.calidad = c
    ctx.sombras = c !== "baja"
    post.dispose()
    post = new Post(renderer, scene, cam, c)
    configurarSombras()
    aplicarLimitesLuces()
    // Prender o apagar sombras cambia los shaders: recompilar.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true
    })
    redimensionar()
    fps.gracia = 3
    fps.malos = 0
  }
  const fps = { acumulado: 0, cuadros: 0, malos: 0, gracia: 3, medio: 60 }
  const medirFps = (dtReal: number) => {
    fps.acumulado += dtReal
    fps.cuadros++
    if (fps.acumulado < 1) return
    fps.medio = fps.cuadros / fps.acumulado
    fps.acumulado = 0
    fps.cuadros = 0
    if (!automatica) return
    if (fps.gracia > 0) {
      fps.gracia--
      return
    }
    fps.malos = fps.medio < 40 ? fps.malos + 1 : 0
    if (fps.malos >= 3 && calidad !== "baja") setCalidadInterna(calidad === "alta" ? "media" : "baja")
  }

  // ── Bucle ──
  let raf = 0
  let corriendo = false
  let destruida = false
  let ultimo = 0
  let tiempo = 0
  const fallidos = new Set<(t: TickEscena) => void>()

  const cuadro = (dt: number, dtReal: number) => {
    tiempo += dt
    renderer.info.reset()
    camara.actualizar(dt)
    if (horaSucia) {
      aplicarHora(tiempo)
      horaSucia = false
    } else if (nivelActual === "superficie") {
      const env = cielo.entorno(tiempo)
      if (env !== scene.environment) {
        scene.environment = env
        for (const r of reflejantes) r.mat.envMap = env
      }
    }
    cielo.actualizar(dt, tiempo, cam)
    materiales.actualizar(tiempo)
    aplicarPersonajes(dt)
    const tick: TickEscena = { dt, tiempo, hora, noche: nocheActual }
    for (const fn of alCuadro) {
      if (fallidos.has(fn)) continue
      try {
        fn(tick)
      } catch (e) {
        // Un error por cuadro llenaría la consola: se avisa una vez y se deja de llamar.
        fallidos.add(fn)
        console.error("[casa-blanca] alActualizar falló y se desactivó:", e)
      }
    }
    if (renderer.shadowMap.enabled) seguirSombra()

    if (trans) {
      if (trans.fase === "sale") {
        trans.t += dt / trans.durSale
        fundido = Math.min(1, trans.t)
        if (trans.t >= 1) {
          const accion = trans.accion
          trans = { ...trans, fase: "entra", t: 0, accion: null }
          if (accion) intentar("transición", accion)
        }
      } else {
        trans.t += dt / trans.durEntra
        fundido = Math.max(0, 1 - trans.t)
        if (trans.t >= 1) trans = null
      }
    } else fundido = 0
    maquetaMezcla += ((maquetaOn ? 1 : 0) - maquetaMezcla) * (1 - Math.exp(-5 * dt))
    if (Math.abs(maquetaMezcla - (maquetaOn ? 1 : 0)) < 0.002) maquetaMezcla = maquetaOn ? 1 : 0
    post.aplicar(cielo.ambiente, maquetaMezcla, fundido, tiempo, nivelActual !== "superficie")
    post.render(dt)
    medirFps(dtReal)
  }

  const bucle = (ahora: number) => {
    if (!corriendo || destruida) return
    raf = requestAnimationFrame(bucle)
    const dtReal = ultimo ? (ahora - ultimo) / 1000 : 1 / 60
    ultimo = ahora
    cuadro(Math.min(0.1, Math.max(0, dtReal)), dtReal)
  }

  const alCambiarVisibilidad = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = 0
    } else if (corriendo && !destruida && !raf) {
      ultimo = 0
      fps.acumulado = 0
      fps.cuadros = 0
      fps.gracia = Math.max(fps.gracia, 1)
      raf = requestAnimationFrame(bucle)
    }
  }
  document.addEventListener("visibilitychange", alCambiarVisibilidad)

  // ── Retratos ──
  let retratosPromesa: Promise<Record<string, string>> | null = null
  const hacerRetratos = (): Record<string, string> => {
    const tam = 256
    const rtHDR = new THREE.WebGLRenderTarget(tam, tam, { type: THREE.HalfFloatType, samples: 4 })
    const rtLDR = new THREE.WebGLRenderTarget(tam, tam)
    const estudio = new THREE.Scene()
    estudio.environment = cielo.entornoInterior()
    estudio.environmentIntensity = 0.55
    const clave = new THREE.DirectionalLight("#fff0dc", 3.2)
    clave.position.set(-1.6, 2.4, 2.6)
    const relleno = new THREE.DirectionalLight("#bcd4ff", 0.9)
    relleno.position.set(2.2, 1.2, 1.6)
    const contra = new THREE.DirectionalLight("#ffffff", 2.4)
    contra.position.set(0.6, 2.6, -2.8)
    estudio.add(clave, relleno, contra)
    const camRetrato = new THREE.PerspectiveCamera(30, 1, 0.05, 50)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), REVELADO)
    quad.frustumCulled = false
    const escenaQuad = new THREE.Scene()
    escenaQuad.add(quad)
    const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const px = new Uint8Array(tam * tam * 4)
    const lienzo = document.createElement("canvas")
    lienzo.width = tam
    lienzo.height = tam
    const g = lienzo.getContext("2d")!
    const img = g.createImageData(tam, tam)
    const previoColor = renderer.getClearColor(new THREE.Color())
    const previoAlfa = renderer.getClearAlpha()
    const previoRT = renderer.getRenderTarget()
    const sombrasPrevias = renderer.shadowMap.enabled
    renderer.shadowMap.enabled = false
    const out: Record<string, string> = {}
    try {
      for (const [id, a] of avatares) {
        const padre = a.raiz.parent
        const pos = a.raiz.position.clone()
        const rot = a.raiz.rotation.y
        const vis = a.raiz.visible
        try {
          estudio.add(a.raiz)
          a.raiz.position.set(0, 0, 0)
          a.raiz.rotation.y = 0.3
          a.raiz.visible = true
          a.animar("quieto", 0, 0)
          a.raiz.updateMatrixWorld(true)
          // Cabeza y torso: del pecho a un poco sobre la coronilla.
          const h = a.altura || 1.8
          const mira = h * 0.8
          const dist = (h * 0.62) / 2 / Math.tan(THREE.MathUtils.degToRad(15))
          camRetrato.position.set(0.12 * h, mira + 0.03 * h, dist)
          camRetrato.lookAt(0, mira, 0)
          renderer.setRenderTarget(rtHDR)
          renderer.setClearColor(0x000000, 0)
          renderer.clear()
          renderer.render(estudio, camRetrato)
          REVELADO.uniforms.tMapa.value = rtHDR.texture
          renderer.setRenderTarget(rtLDR)
          renderer.clear()
          renderer.render(escenaQuad, camQuad)
          renderer.readRenderTargetPixels(rtLDR, 0, 0, tam, tam, px)
          // WebGL lee de abajo hacia arriba: dar vuelta las filas.
          for (let y = 0; y < tam; y++) img.data.set(px.subarray((tam - 1 - y) * tam * 4, (tam - y) * tam * 4), y * tam * 4)
          g.putImageData(img, 0, 0)
          out[id] = lienzo.toDataURL("image/png")
        } catch (e) {
          console.error(`[casa-blanca] retrato de ${id}:`, e)
        } finally {
          padre?.add(a.raiz)
          a.raiz.position.copy(pos)
          a.raiz.rotation.y = rot
          a.raiz.visible = vis
        }
      }
    } finally {
      renderer.shadowMap.enabled = sombrasPrevias
      renderer.setRenderTarget(previoRT)
      renderer.setClearColor(previoColor, previoAlfa)
      rtHDR.dispose()
      rtLDR.dispose()
      quad.geometry.dispose()
      for (const l of [clave, relleno, contra]) l.dispose()
    }
    return out
  }

  // ── Proyección a pantalla ──
  const _p = new THREE.Vector3()
  const _vista = new THREE.Vector3()
  const proyectar = (p: Vec3) => {
    _p.set(p.x, p.y, p.z)
    _vista.copy(_p).applyMatrix4(cam.matrixWorldInverse)
    _p.project(cam)
    const ancho = canvas.clientWidth || canvas.width
    const alto = canvas.clientHeight || canvas.height
    const delante = _vista.z < 0
    return {
      x: ((_p.x + 1) / 2) * ancho,
      y: ((1 - _p.y) / 2) * alto,
      visible: delante && Math.abs(_p.x) <= 1.05 && Math.abs(_p.y) <= 1.05,
    }
  }

  const escena: EscenaMotor = {
    iniciar() {
      if (corriendo || destruida) return
      corriendo = true
      ultimo = 0
      if (!document.hidden) raf = requestAnimationFrame(bucle)
    },
    setHora(h) {
      const nueva = ((h % 24) + 24) % 24
      if (nueva !== hora) {
        hora = nueva
        horaSucia = true
      }
    },
    mostrarNivel(n) {
      if (n === nivelActual && !trans) return
      fundir(() => aplicarNivel(n))
    },
    nivel: () => nivelActual,
    intro() {
      const p = camara.iniciarIntro()
      // Abre desde negro, como un plano de cine.
      fundido = 1
      trans = { fase: "entra", t: 0, accion: null, durSale: 0.22, durEntra: 0.9 }
      return p
    },
    saltarIntro() {
      camara.saltarIntro()
    },
    modoCamara(modo, objetivoId) {
      camara.setModo(modo, objetivoId)
      if (modo !== "cine") maquetaOn = maquetaManual
    },
    enfocar(p, distancia = 40) {
      const n = nivelDeY(p.y)
      const destino = new THREE.Vector3(p.x, p.y, p.z)
      if (n !== nivelActual) {
        fundir(() => {
          aplicarNivel(n)
          camara.enfocar(destino, distancia)
        })
      } else camara.enfocar(destino, distancia)
    },
    actualizarPersonajes(lista) {
      for (const e of lista) {
        const previo = estados.get(e.id)
        if (previo) {
          previo.pos = e.pos
          previo.rumbo = e.rumbo
          previo.estado = e.estado
          previo.visible = e.visible
          previo.velocidad = e.velocidad
        } else estados.set(e.id, { pos: e.pos, rumbo: e.rumbo, estado: e.estado, visible: e.visible, velocidad: e.velocidad })
      }
    },
    marcarPuestos(depId, est: EstadoPuesto[]) {
      if (subsuelo) intentar("subsuelo.marcarPuestos", () => subsuelo.marcarPuestos(depId, est))
    },
    pantallaDe(id) {
      const a = avatares.get(id)
      if (!a) return null
      a.cabeza.getWorldPosition(_p)
      const r = proyectar(_p)
      return { ...r, visible: r.visible && visibleEnCadena(a.raiz) }
    },
    proyectar,
    camaraEnPlanta: () => camara.enPlanta(),
    alTocar(fn) {
      tocadores.push(fn)
    },
    retratos() {
      if (!retratosPromesa) {
        retratosPromesa = new Promise((resolver) => {
          // En el próximo cuadro libre: no bloquear el arranque.
          const hacer = () => resolver(destruida ? {} : hacerRetratos())
          if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(hacer)
          else hacer()
        })
      }
      return retratosPromesa
    },
    calidad: () => calidad,
    setCalidad(c) {
      setCalidadInterna(c)
    },
    redimensionar,
    destruir() {
      if (destruida) return
      destruida = true
      corriendo = false
      cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", alCambiarVisibilidad)
      canvas.removeEventListener("pointerdown", alBajar)
      canvas.removeEventListener("pointerup", alSubir)
      observador?.disconnect()
      camara?.dispose()
      for (const a of avatares.values()) intentar("avatar.dispose", () => a.dispose())
      const texturas = new Set<THREE.Texture>()
      const mats = new Set<THREE.Material>()
      scene.traverse((o) => {
        const malla = o as THREE.Mesh
        malla.geometry?.dispose()
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose()
        const m = malla.material
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mats.add(mat)
        if ((o as THREE.Light).isLight) (o as THREE.Light).dispose()
      })
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) texturas.add(v as THREE.Texture)
        m.dispose()
      }
      for (const t of texturas) t.dispose()
      materiales.dispose()
      cielo.dispose()
      post.dispose()
      fondoSub.dispose()
      REVELADO.dispose()
      scene.clear()
      renderer.dispose()
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__casaBlancaEscena === escena) {
        delete (window as unknown as Record<string, unknown>).__casaBlancaEscena
      }
    },
    modoMaqueta(on) {
      maquetaManual = on
      maquetaOn = on
    },
    maqueta: () => maquetaOn,
    tomas: () => TOMAS_CINE,
    tomaActual: () => camara.tomaActual,
    camara: () => camara.modo,
    depurar: {
      fijarIntro(segundos) {
        camara.fijarIntro(segundos)
        trans = null
        fundido = 0
      },
      cuadro(dt = 1 / 60) {
        cuadro(dt, dt)
      },
      info: () => ({
        calidad,
        hora,
        noche: nocheActual,
        drawCalls: renderer.info.render.calls,
        triangulos: renderer.info.render.triangles,
        fps: Math.round(fps.medio),
      }),
    },
  }
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    ;(window as unknown as Record<string, unknown>).__casaBlancaEscena = escena
  }

  return escena
}
