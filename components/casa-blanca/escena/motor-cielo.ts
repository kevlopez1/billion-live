// ──────────────────────────────────────────────────────────────
// Cielo, sol, luna, estrellas, nubes, niebla y luz según la hora.
//
// El sol sale a las 6 por el noreste, pasa por el sur al mediodía y se pone a
// las 18 por el noroeste (el arco de verano en Washington, un poco exagerado):
// a las 17:30 la luz entra baja y dorada desde el oeste-noroeste y enciende la
// fachada norte, la de la foto.
// Todos los valores salen de tablas por elevación del sol, así que la mañana y
// la tarde se ven igual de bien y retocar el look es cambiar números.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { Sky } from "three/examples/jsm/objects/Sky.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import type { Calidad } from "../tipos"
import { azar, fbm, suave } from "./motor-texturas"

const GRAD = Math.PI / 180

/** Dirección hacia el sol (unitaria) para una hora del día (0–24). */
export function direccionSol(hora: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (hora - 6) / 12
  const az = (45 + a * 270) * GRAD
  const elev = Math.sin(Math.PI * a) * 66 * GRAD
  return out.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), -Math.cos(elev) * Math.cos(az))
}

/** La luna sale a las 19 por el este-sudeste, cruza el sur y se pone a las 6. */
export function direccionLuna(hora: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (((hora - 19) % 24) + 24) % 24 / 11
  const az = (110 + a * 140) * GRAD
  const elev = (a <= 1 ? Math.sin(Math.PI * a) * 48 : -20) * GRAD
  return out.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), -Math.cos(elev) * Math.cos(az))
}

type Tabla = Array<[number, number]>
type TablaColor = Array<[number, string]>

/** Interpolación lineal en una tabla ordenada por elevación del sol (grados). */
function tabla(t: Tabla, e: number): number {
  if (e <= t[0][0]) return t[0][1]
  for (let i = 1; i < t.length; i++) {
    if (e <= t[i][0]) {
      const [e0, v0] = t[i - 1]
      const [e1, v1] = t[i]
      return v0 + ((v1 - v0) * (e - e0)) / (e1 - e0)
    }
  }
  return t[t.length - 1][1]
}

const _c0 = new THREE.Color()
const _c1 = new THREE.Color()
function tablaColor(t: TablaColor, e: number, out: THREE.Color): THREE.Color {
  if (e <= t[0][0]) return out.set(t[0][1])
  for (let i = 1; i < t.length; i++) {
    if (e <= t[i][0]) {
      const k = (e - t[i - 1][0]) / (t[i][0] - t[i - 1][0])
      _c0.set(t[i - 1][1])
      _c1.set(t[i][1])
      return out.copy(_c0).lerp(_c1, k)
    }
  }
  return out.set(t[t.length - 1][1])
}

// ── El look, por elevación del sol (grados) ──────────────────
const T = {
  turbidez: [[-10, 3.5], [0, 5], [10, 3.8], [25, 2.9], [60, 2.5]] as Tabla,
  rayleigh: [[-10, 1.4], [0, 2.6], [8, 1.9], [25, 1.3], [60, 1.1]] as Tabla,
  mie: [[0, 0.006], [10, 0.0042], [40, 0.003]] as Tabla,
  mieG: [[0, 0.9], [10, 0.86], [40, 0.8]] as Tabla,
  /** Escala del brillo del cielo para que conviva con las luces de la escena. */
  escalaCielo: [[-10, 1], [0, 0.95], [8, 0.7], [25, 0.46], [60, 0.38]] as Tabla,
  intensidadSol: [[-2, 0], [0, 0.4], [3, 3.0], [8, 5.3], [20, 6.0], [45, 6.4], [70, 6.6]] as Tabla,
  colorSol: [[0, "#ff5a1e"], [3, "#ff8236"], [8, "#ffa04f"], [14, "#ffbf7c"], [25, "#ffdcb0"], [45, "#fff0dc"], [70, "#fff6ea"]] as TablaColor,
  hemiCielo: [[-12, "#2a4378"], [-4, "#3e5590"], [2, "#6f86b8"], [8, "#86a5d8"], [25, "#a3c0ea"], [60, "#b3ccf0"]] as TablaColor,
  hemiSuelo: [[-12, "#0b0d12"], [0, "#2c261f"], [10, "#4b3d2b"], [40, "#5b5040"]] as TablaColor,
  hemiIntensidad: [[-12, 0.62], [-4, 0.52], [2, 0.42], [8, 0.36], [30, 0.42], [60, 0.48]] as Tabla,
  entorno: [[-12, 0.5], [0, 0.65], [8, 0.62], [30, 0.72], [60, 0.78]] as Tabla,
  exposicion: [[-12, 1.55], [-6, 1.45], [0, 1.3], [6, 1.08], [15, 1.0], [40, 0.96]] as Tabla,
  niebla: [[-12, 0.00048], [0, 0.00052], [10, 0.0004], [40, 0.00034]] as Tabla,
  bloomFuerza: [[-12, 0.6], [-4, 0.55], [2, 0.42], [8, 0.3], [25, 0.2]] as Tabla,
  bloomUmbral: [[-12, 0.95], [0, 0.95], [8, 1.35], [25, 1.7]] as Tabla,
  bloomRadio: [[-12, 0.6], [8, 0.48], [25, 0.42]] as Tabla,
}

/** Colores de la noche (lineales): azul profundo arriba, resplandor de la ciudad abajo. */
const NOCHE_CENIT = new THREE.Color(0.0035, 0.0075, 0.026)
const NOCHE_HORIZONTE = new THREE.Color(0.03, 0.034, 0.06)

// ── Cielo con noche, estrellas y luna (shader de Sky ampliado) ──
const DECL = /* glsl */ `uniform float time;
uniform float uEscala;
uniform float uNoche;
uniform vec3 uLunaDir;
uniform vec3 uNocheCenit;
uniform vec3 uNocheHorizonte;
uniform vec3 uSuelo;
uniform float uMaxBrillo;
uniform float uEstrellas;
float cbHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}`

const FINAL = /* glsl */ `texColor *= uEscala;
{
  float alto = max( direction.y, 0.0 );
  vec3 nocheCol = mix( uNocheHorizonte, uNocheCenit, pow( alto, 0.42 ) );
  // Estrellas: una por celda de una grilla sobre la esfera, redondas y titilando.
  vec3 q = direction * 420.0;
  vec3 celda = floor( q );
  float hs = cbHash( celda );
  vec3 centro = celda + 0.5 + ( vec3( cbHash( celda + 1.7 ), cbHash( celda + 3.1 ), cbHash( celda + 5.3 ) ) - 0.5 ) * 0.5;
  float estrella = step( 0.9935, hs ) * smoothstep( 0.6, 0.05, length( q - centro ) );
  estrella *= ( 0.7 + 0.3 * sin( time * ( 1.3 + hs * 3.0 ) + hs * 97.0 ) );
  estrella *= smoothstep( 0.03, 0.3, direction.y ) * ( 0.25 + 3.0 * pow( fract( hs * 91.7 ), 4.0 ) );
  // Luna: disco con mares y un halo suave.
  vec3 ld = normalize( uLunaDir );
  float cl = dot( direction, ld );
  float disco = smoothstep( 0.99982, 0.99987, cl );
  vec3 eu = normalize( cross( ld, vec3( 0.0, 1.0, 0.0 ) ) );
  vec3 ev = cross( eu, ld );
  vec2 lp = vec2( dot( direction, eu ), dot( direction, ev ) ) / 0.0185;
  float mares = 0.86 + 0.14 * noise( lp * 2.3 + 3.0 ) - 0.16 * smoothstep( 0.1, 0.7, noise( lp * 1.2 + 7.0 ) );
  float halo = pow( max( cl, 0.0 ), 1400.0 ) * 0.5 + pow( max( cl, 0.0 ), 70.0 ) * 0.05;
  vec3 luna = ( vec3( 1.0, 0.96, 0.88 ) * disco * mares * 5.0 + vec3( 0.5, 0.62, 0.95 ) * halo ) * step( -0.02, ld.y );
  texColor += uNoche * ( nocheCol + vec3( 0.85, 0.92, 1.0 ) * estrella * uEstrellas + luna );
  // Bajo el horizonte, suelo oscuro: el mapa de entorno no ilumina desde abajo como si fuera cielo.
  texColor = mix( texColor, uSuelo, smoothstep( 0.0, -0.1, direction.y ) );
  texColor = min( texColor, vec3( uMaxBrillo ) );
}
gl_FragColor = vec4( texColor, 1.0 );`

function crearCielo(): Sky {
  const cielo = new Sky()
  const mat = cielo.material
  mat.fragmentShader = mat.fragmentShader
    .replace("uniform float time;", DECL)
    .replace("gl_FragColor = vec4( texColor, 1.0 );", FINAL)
  Object.assign(mat.uniforms, {
    uEscala: { value: 0.6 },
    uNoche: { value: 0 },
    uLunaDir: { value: new THREE.Vector3(0, 1, 0) },
    uNocheCenit: { value: NOCHE_CENIT.clone() },
    uNocheHorizonte: { value: NOCHE_HORIZONTE.clone() },
    uSuelo: { value: new THREE.Color(0.05, 0.05, 0.05) },
    uMaxBrillo: { value: 1e5 },
    uEstrellas: { value: 1 },
  })
  mat.needsUpdate = true
  cielo.frustumCulled = false
  cielo.renderOrder = -1000
  return cielo
}

// ── Modelo de Preetham en JS (el mismo del shader) para el color de la niebla ──
const TR = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5]
const MC = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14]
interface ParamsCielo {
  turbidez: number
  rayleigh: number
  mie: number
  mieG: number
  escala: number
}
function radiancia(d: THREE.Vector3, s: THREE.Vector3, p: ParamsCielo, out: number[]): number[] {
  const sunE = 1000 * Math.max(0, 1 - Math.exp(-((1.6110731556870734 - Math.acos(Math.max(-1, Math.min(1, s.y)))) / 1.5)))
  const c = 0.2 * p.turbidez * 10e-18
  const za = Math.acos(Math.max(0, d.y))
  const inv = 1 / (Math.cos(za) + 0.15 * Math.pow(93.885 - (za * 180) / Math.PI, -1.253))
  const ct = d.x * s.x + d.y * s.y + d.z * s.z
  const rP = 0.05968310365946075 * (1 + Math.pow(ct * 0.5 + 0.5, 2))
  const g2 = p.mieG * p.mieG
  const mP = (0.07957747154594767 * (1 - g2)) / Math.pow(1 - 2 * p.mieG * ct + g2, 1.5)
  const mezcla = Math.min(1, Math.max(0, Math.pow(1 - s.y, 5)))
  for (let i = 0; i < 3; i++) {
    const bR = TR[i] * p.rayleigh
    const bM = 0.434 * c * MC[i] * p.mie
    const fex = Math.exp(-(bR * 8.4e3 * inv + bM * 1.25e3 * inv))
    const r = (bR * rP + bM * mP) / (bR + bM)
    let lin = Math.pow(sunE * r * (1 - fex), 1.5)
    lin *= 1 - mezcla + mezcla * Math.pow(sunE * r * fex, 0.5)
    out[i] = ((lin + 0.1 * fex) * 0.04 + [0, 0.0003, 0.00075][i]) * p.escala
  }
  return out
}

// ── Nubes: carteles lejanos con textura procedural ──────────
// La textura guarda en R cuánto le da el sol a cada punto (cima de cada copo)
// y en A la densidad; el shader mezcla dos colores que cambian con la hora:
// la luz del sol y la sombra azulada del cielo.
function texturaNube(semilla: number, ancho: number): THREE.CanvasTexture {
  const alto = ancho / 2
  const r = azar(semilla)
  const det = fbm(ancho, 6, 6, 5, semilla + 3)
  const bolas: Array<[number, number, number]> = []
  const k = 7 + Math.floor(r() * 5)
  const base = 0.74
  for (let i = 0; i < k; i++) {
    const u = 0.14 + 0.72 * (i / (k - 1)) + (r() - 0.5) * 0.06
    const centro = 1 - Math.abs(u - 0.5) * 1.7
    const rad = (0.07 + r() * 0.07) * (0.55 + centro * 0.9)
    bolas.push([u, base - rad * (0.9 + r() * 1.1) - centro * 0.12 * r(), rad])
  }
  const lienzo = document.createElement("canvas")
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext("2d")!
  const img = ctx.createImageData(ancho, alto)
  for (let y = 0; y < alto; y++) {
    const v = y / alto
    for (let x = 0; x < ancho; x++) {
      const u = x / ancho
      let dens = 0
      let luz = 0
      for (const [bu, bv, br] of bolas) {
        const dx = (u - bu) / br
        const dy = ((v - bv) / br) * 0.5
        const d = Math.sqrt(dx * dx + dy * dy)
        const f = 1 - d
        if (f > dens) {
          dens = f
          luz = 0.5 - dy * 0.55 - dx * 0.12
        }
      }
      const ruido = det[(Math.floor(v * ancho) % ancho) * ancho + x]
      const corte = suave(base + 0.02, base - 0.05, v)
      const a = Math.min(1, Math.max(0, (dens * 2.2 + (ruido - 0.5) * 1.1 - 0.12) * corte))
      const l = Math.min(1, Math.max(0, luz + (ruido - 0.5) * 0.35 + (1 - v / base) * 0.15))
      const o = (y * ancho + x) * 4
      img.data[o] = 255 * l
      img.data[o + 1] = 255 * l
      img.data[o + 2] = 255 * l
      img.data[o + 3] = 255 * a * a * (3 - 2 * a)
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(lienzo)
  t.colorSpace = THREE.NoColorSpace
  return t
}

const NUBE_FRAG = /* glsl */ `vec4 nubeT = texture2D( map, vMapUv );
diffuseColor.rgb *= mix( uSombra, uLuz, smoothstep( 0.05, 0.95, nubeT.r ) );
diffuseColor.a *= nubeT.a;`

interface Nube {
  sprite: THREE.Sprite
  luz: THREE.Color
  sombra: THREE.Color
  angulo: number
  radio: number
  altura: number
  velocidad: number
}

// ── El cielo completo ────────────────────────────────────────

export interface Ambiente {
  hora: number
  /** 0 = pleno día, 1 = noche cerrada. */
  noche: number
  /** Elevación del sol en grados. */
  elevacion: number
  exposicion: number
  bloom: { fuerza: number; umbral: number; radio: number }
}

export class Cielo {
  readonly cielo: Sky
  readonly sol: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly nubes = new THREE.Group()
  readonly niebla: THREE.FogExp2
  readonly solDir = new THREE.Vector3()
  readonly lunaDir = new THREE.Vector3()
  /** Dirección desde la que llega la luz direccional (sol o luna). */
  readonly luzDir = new THREE.Vector3()
  readonly ambiente: Ambiente = { hora: 17.5, noche: 0, elevacion: 0, exposicion: 1, bloom: { fuerza: 0.3, umbral: 1.3, radio: 0.45 } }
  intensidadEntorno = 0.7

  private readonly renderer: THREE.WebGLRenderer
  private readonly pmrem: THREE.PMREMGenerator
  private readonly escenaEntorno = new THREE.Scene()
  private readonly cieloEntorno: Sky
  private entornoRT: THREE.WebGLRenderTarget | null = null
  private habitacionRT: THREE.WebGLRenderTarget | null = null
  private horaEntorno = -99
  private ultimoEntorno = -1e9
  private tamEntorno: number
  private readonly lista: Nube[] = []
  private readonly texNubes: THREE.Texture[] = []
  private readonly params: ParamsCielo = { turbidez: 3, rayleigh: 1, mie: 0.005, mieG: 0.8, escala: 0.5 }

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, calidad: Calidad) {
    this.renderer = renderer
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.tamEntorno = calidad === "alta" ? 256 : 128

    this.cielo = crearCielo()
    this.cielo.scale.setScalar(5000)
    scene.add(this.cielo)

    this.cieloEntorno = crearCielo()
    this.cieloEntorno.scale.setScalar(10)
    const u = this.cieloEntorno.material.uniforms
    u.showSunDisc.value = 0
    u.uMaxBrillo.value = 14
    u.uEstrellas.value = 0
    this.escenaEntorno.add(this.cieloEntorno)

    this.sol = new THREE.DirectionalLight(0xffffff, 3)
    this.sol.name = "sol"
    scene.add(this.sol, this.sol.target)

    this.hemi = new THREE.HemisphereLight(0xa3c0ea, 0x4b3d2b, 0.4)
    scene.add(this.hemi)

    this.niebla = new THREE.FogExp2(0xa0b0c8, 0.0006)
    scene.fog = this.niebla

    this.crearNubes(calidad)
    scene.add(this.nubes)
  }

  private crearNubes(calidad: Calidad) {
    const ancho = calidad === "alta" ? 512 : 256
    for (let i = 0; i < 5; i++) this.texNubes.push(texturaNube(900 + i * 37, ancho))
    const r = azar(4242)
    const cuantas = calidad === "baja" ? 10 : 18
    for (let i = 0; i < cuantas; i++) {
      const luz = new THREE.Color(1, 1, 1)
      const sombra = new THREE.Color(0.5, 0.55, 0.65)
      const mat = new THREE.SpriteMaterial({
        map: this.texNubes[i % this.texNubes.length],
        transparent: true,
        depthWrite: false,
        fog: false,
      })
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uLuz = { value: luz }
        sh.uniforms.uSombra = { value: sombra }
        sh.fragmentShader = sh.fragmentShader
          .replace("uniform float opacity;", "uniform float opacity;\nuniform vec3 uLuz;\nuniform vec3 uSombra;")
          .replace("#include <map_fragment>", NUBE_FRAG)
      }
      const sprite = new THREE.Sprite(mat)
      const radio = 1900 + r() * 1500
      const elev = (2.5 + r() * 9) * GRAD
      const ancho = radio * (0.3 + r() * 0.32)
      sprite.scale.set(ancho, ancho / 2, 1)
      sprite.renderOrder = -900
      this.nubes.add(sprite)
      this.lista.push({
        sprite,
        luz,
        sombra,
        angulo: (i / cuantas) * Math.PI * 2 + (r() - 0.5) * 0.3,
        radio,
        altura: Math.tan(elev) * radio + ancho * 0.12,
        velocidad: 0.0022 + r() * 0.0018,
      })
    }
  }

  /** Mueve el sol, la luna y todo lo que depende de la hora. */
  setHora(hora: number): Ambiente {
    const h = ((hora % 24) + 24) % 24
    direccionSol(h, this.solDir)
    direccionLuna(h, this.lunaDir)
    const e = Math.asin(this.solDir.y) / GRAD
    const noche = suave(4, -12, e)
    const a = this.ambiente
    a.hora = h
    a.noche = noche
    a.elevacion = e

    const p = this.params
    p.turbidez = tabla(T.turbidez, e)
    p.rayleigh = tabla(T.rayleigh, e)
    p.mie = tabla(T.mie, e)
    p.mieG = tabla(T.mieG, e)
    p.escala = tabla(T.escalaCielo, e)
    const u = this.cielo.material.uniforms
    u.turbidity.value = p.turbidez
    u.rayleigh.value = p.rayleigh
    u.mieCoefficient.value = p.mie
    u.mieDirectionalG.value = p.mieG
    ;(u.sunPosition.value as THREE.Vector3).copy(this.solDir)
    u.uEscala.value = p.escala
    u.uNoche.value = noche
    ;(u.uLunaDir.value as THREE.Vector3).copy(this.lunaDir)
    u.cloudCoverage.value = 0.18
    u.cloudDensity.value = 0.3
    u.cloudElevation.value = 0.55

    // Niebla: el color del horizonte (el mismo modelo del shader), sin el resplandor del sol.
    const niebla = this.colorHorizonte(this.niebla.color)
    this.niebla.density = tabla(T.niebla, e)
    ;(u.uSuelo.value as THREE.Color).copy(niebla).multiplyScalar(0.3)

    // Luz principal: el sol de día; la luna de noche (fría y suave).
    const iSol = tabla(T.intensidadSol, e)
    if (iSol > 0.02 || this.lunaDir.y < 0.08) {
      this.luzDir.copy(this.solDir.y > 0.02 ? this.solDir : _arriba)
      tablaColor(T.colorSol, e, this.sol.color)
      this.sol.intensity = iSol
    } else {
      this.luzDir.copy(this.lunaDir)
      this.sol.color.set("#9db4ff")
      this.sol.intensity = 0.85 * suave(0.5, 0.95, noche) * suave(0.05, 0.25, this.lunaDir.y)
    }

    tablaColor(T.hemiCielo, e, this.hemi.color)
    tablaColor(T.hemiSuelo, e, this.hemi.groundColor)
    this.hemi.intensity = tabla(T.hemiIntensidad, e)
    this.intensidadEntorno = tabla(T.entorno, e)

    a.exposicion = tabla(T.exposicion, e)
    a.bloom.fuerza = tabla(T.bloomFuerza, e)
    a.bloom.umbral = tabla(T.bloomUmbral, e)
    a.bloom.radio = tabla(T.bloomRadio, e)

    this.colorearNubes()
    return a
  }

  private colorHorizonte(out: THREE.Color): THREE.Color {
    const s = this.solDir
    let r = 0
    let g = 0
    let b = 0
    let suma = 0
    const m = [0, 0, 0]
    const k = 12
    const sh = Math.max(1e-3, Math.hypot(s.x, s.z))
    for (let i = 0; i < k; i++) {
      const az = (i / k) * Math.PI * 2
      _d.set(Math.cos(az) * 0.995, 0.05, Math.sin(az) * 0.995).normalize()
      radiancia(_d, s, this.params, m)
      // Pesa más el lado contrario al sol: la niebla es uniforme y no debe teñir todo de naranja.
      const w = 1 - 0.75 * Math.max(0, (_d.x * s.x + _d.z * s.z) / sh)
      const tope = 2.2 * this.params.escala * 3
      r += Math.min(m[0], tope) * w
      g += Math.min(m[1], tope) * w
      b += Math.min(m[2], tope) * w
      suma += w
    }
    const noche = this.ambiente.noche
    out.setRGB(r / suma, g / suma, b / suma).multiplyScalar(0.82)
    _c0.copy(NOCHE_HORIZONTE).multiplyScalar(noche)
    out.add(_c0)
    return out
  }

  private colorearNubes() {
    const e = this.ambiente.elevacion
    const noche = this.ambiente.noche
    const iSol = tabla(T.intensidadSol, e)
    const escala = this.params.escala
    const sh = Math.max(0.05, Math.hypot(this.solDir.x, this.solDir.z))
    for (const n of this.lista) {
      _d.set(Math.cos(n.angulo), 0, Math.sin(n.angulo))
      const hacia = Math.max(0, (_d.x * this.solDir.x + _d.z * this.solDir.z) / sh)
      // Del lado del sol, la cara iluminada brilla más (dispersión hacia adelante).
      n.luz.copy(this.sol.color).multiplyScalar(iSol * (0.2 + 0.22 * hacia * hacia) * (escala / 0.5))
      n.sombra.copy(this.hemi.color).multiplyScalar(0.42 * escala + 0.12)
      _c0.copy(this.sol.color).multiplyScalar(0.12 * iSol * escala)
      n.sombra.add(_c0)
      if (noche > 0) {
        n.luz.lerp(_c1.setRGB(0.05, 0.06, 0.1), noche)
        n.sombra.lerp(_c1.setRGB(0.012, 0.016, 0.03), noche)
      }
      n.sprite.material.opacity = 0.95 - 0.4 * noche
    }
  }

  /** Cada cuadro: nubes a la deriva, titileo de estrellas, el domo sigue a la cámara. */
  actualizar(dt: number, tiempo: number, camara: THREE.Camera) {
    this.cielo.position.copy(camara.position)
    this.cielo.material.uniforms.time.value = tiempo
    for (const n of this.lista) {
      n.angulo += n.velocidad * dt
      n.sprite.position.set(Math.cos(n.angulo) * n.radio, n.altura, Math.sin(n.angulo) * n.radio + 80)
    }
  }

  /**
   * Mapa de entorno del cielo (reflejos e iluminación ambiente). Se rehace cada
   * 15 minutos del mundo, no cada cuadro: un PMREM cuesta varios renders.
   */
  entorno(tiempoReal: number, forzar = false): THREE.Texture | null {
    const dh = Math.abs(this.ambiente.hora - this.horaEntorno)
    const salto = Math.min(dh, 24 - dh)
    if (forzar || this.entornoRT === null || (salto >= 0.25 && tiempoReal - this.ultimoEntorno > 1.2) || salto > 1.5) {
      const src = this.cielo.material.uniforms
      const dst = this.cieloEntorno.material.uniforms
      for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG", "uEscala", "uNoche", "cloudCoverage", "cloudDensity", "cloudElevation"]) dst[k].value = src[k].value
      ;(dst.sunPosition.value as THREE.Vector3).copy(src.sunPosition.value as THREE.Vector3)
      ;(dst.uLunaDir.value as THREE.Vector3).copy(src.uLunaDir.value as THREE.Vector3)
      ;(dst.uSuelo.value as THREE.Color).copy(src.uSuelo.value as THREE.Color)
      const viejo = this.entornoRT
      this.entornoRT = this.pmrem.fromScene(this.escenaEntorno, 0, 0.1, 100, { size: this.tamEntorno })
      viejo?.dispose()
      this.horaEntorno = this.ambiente.hora
      this.ultimoEntorno = tiempoReal
    }
    return this.entornoRT?.texture ?? null
  }

  /** Entorno neutro de estudio para los subsuelos (no tienen cielo). */
  entornoInterior(): THREE.Texture {
    if (!this.habitacionRT) {
      const sala = new RoomEnvironment()
      this.habitacionRT = this.pmrem.fromScene(sala, 0.04, 0.1, 100, { size: this.tamEntorno })
      sala.dispose()
    }
    return this.habitacionRT.texture
  }

  dispose() {
    this.entornoRT?.dispose()
    this.habitacionRT?.dispose()
    this.pmrem.dispose()
    this.cielo.geometry.dispose()
    this.cielo.material.dispose()
    this.cieloEntorno.geometry.dispose()
    this.cieloEntorno.material.dispose()
    for (const n of this.lista) n.sprite.material.dispose()
    for (const t of this.texNubes) t.dispose()
    this.sol.dispose()
    this.hemi.dispose()
  }
}

const _d = new THREE.Vector3()
const _arriba = new THREE.Vector3(0.3, 1, 0.2).normalize()
