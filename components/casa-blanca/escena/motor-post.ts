// ──────────────────────────────────────────────────────────────
// Postproceso: bloom, tono ACES, gradación de color estilo GTA V, viñeta,
// tilt-shift del modo maqueta, fundido a negro y antialias.
//
// Orden: escena (HDR lineal) → bloom → OutputPass (ACES + sRGB) → gradación
// (en espacio de pantalla, como un LUT) → tilt-shift → FXAA. El antialias de
// la geometría en calidad alta es MSAA x4 en el render target de la escena;
// en media y baja, FXAA al final.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js"
import type { Calidad } from "../tipos"
import type { Ambiente } from "./motor-cielo"

const VERT = /* glsl */ `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`

/** Gradación: puntos negro y blanco, curva S, saturación, teal & orange, viñeta, fundido y tramado. */
const GRADACION = {
  name: "GradacionCasaBlanca",
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uNegro: { value: 0.025 },
    uBlanco: { value: 0.985 },
    uContraste: { value: 0.3 },
    uSaturacion: { value: 1.12 },
    uTealOrange: { value: 0.7 },
    uTinte: { value: new THREE.Vector3(1, 1, 1) },
    uVineta: { value: 0.3 },
    uFundido: { value: 0 },
    uTiempo: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uNegro;
uniform float uBlanco;
uniform float uContraste;
uniform float uSaturacion;
uniform float uTealOrange;
uniform vec3 uTinte;
uniform float uVineta;
uniform float uFundido;
uniform float uTiempo;
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tDiffuse, vUv ).rgb;
  // Negros profundos y blancos limpios.
  c = clamp( ( c - uNegro ) / ( uBlanco - uNegro ), 0.0, 1.0 );
  // Curva S suave (contraste sin quemar).
  vec3 s = c * c * ( 3.0 - 2.0 * c );
  c = mix( c, s, uContraste );
  // Saturación con cuerpo: más en los tonos medios que en los ya saturados.
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  float croma = max( max( c.r, c.g ), c.b ) - min( min( c.r, c.g ), c.b );
  float sat = uSaturacion + ( uSaturacion - 1.0 ) * ( 1.0 - croma ) * 0.5;
  c = mix( vec3( l ), c, sat );
  // Teal & orange: sombras hacia el verde azulado, luces hacia el ámbar.
  float sombras = 1.0 - smoothstep( 0.0, 0.5, l );
  float luces = smoothstep( 0.45, 1.0, l );
  c += uTealOrange * ( sombras * vec3( -0.03, 0.008, 0.035 ) + luces * vec3( 0.03, 0.008, -0.03 ) );
  c *= uTinte;
  // Viñeta.
  vec2 q = ( vUv - 0.5 ) * vec2( uRes.x / uRes.y, 1.0 );
  c *= 1.0 - uVineta * smoothstep( 0.4, 1.1, length( q ) );
  c *= 1.0 - uFundido;
  // Tramado: evita bandas en los degradés del cielo.
  float n = fract( sin( dot( gl_FragCoord.xy + uTiempo * 61.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( n - 0.5 ) / 255.0;
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`,
}

/** Desenfoque gaussiano separable cuyo radio crece lejos de una franja horizontal nítida. */
const TILT = {
  name: "TiltShiftCasaBlanca",
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uRadio: { value: 0 },
    uCentro: { value: 0.47 },
    uBanda: { value: 0.1 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse;
uniform vec2 uDir;
uniform float uRadio;
uniform float uCentro;
uniform float uBanda;
varying vec2 vUv;
void main() {
  float d = abs( vUv.y - uCentro );
  float r = uRadio * smoothstep( uBanda, uBanda + 0.32, d );
  vec4 suma = vec4( 0.0 );
  float peso = 0.0;
  for ( int i = -7; i <= 7; i ++ ) {
    float fi = float( i );
    float w = exp( - fi * fi / 24.0 );
    suma += texture2D( tDiffuse, vUv + uDir * fi * r / 7.0 ) * w;
    peso += w;
  }
  gl_FragColor = suma / peso;
}`,
}

export class Post {
  readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass | null
  private readonly gradacion: ShaderPass
  private readonly tiltH: ShaderPass
  private readonly tiltV: ShaderPass
  private readonly fxaa: FXAAPass | null
  private readonly destino: THREE.WebGLRenderTarget
  private ancho = 1
  private alto = 1
  private pr = 1

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camara: THREE.Camera, calidad: Calidad) {
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2())
    this.destino = new THREE.WebGLRenderTarget(Math.max(1, tam.x), Math.max(1, tam.y), {
      type: THREE.HalfFloatType,
      samples: calidad === "alta" ? 4 : 0,
    })
    this.composer = new EffectComposer(renderer, this.destino)
    this.composer.addPass(new RenderPass(scene, camara))
    this.bloom = calidad === "baja" ? null : new UnrealBloomPass(new THREE.Vector2(tam.x, tam.y), 0.3, 0.45, 1.3)
    if (this.bloom) this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.gradacion = new ShaderPass(GRADACION)
    this.composer.addPass(this.gradacion)
    this.tiltH = new ShaderPass(TILT)
    this.tiltV = new ShaderPass(TILT)
    this.tiltH.enabled = false
    this.tiltV.enabled = false
    this.composer.addPass(this.tiltH)
    this.composer.addPass(this.tiltV)
    this.fxaa = calidad === "alta" ? null : new FXAAPass()
    if (this.fxaa) this.composer.addPass(this.fxaa)
  }

  setSize(ancho: number, alto: number, pixelRatio: number) {
    this.ancho = ancho
    this.alto = alto
    this.pr = pixelRatio
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(ancho, alto)
    ;(this.gradacion.uniforms.uRes.value as THREE.Vector2).set(ancho, alto)
  }

  /**
   * Ajusta todo según la hora y el modo. `maqueta` (0..1) sube saturación y
   * contraste y prende el tilt-shift; `fundido` (0..1) lleva a negro.
   */
  aplicar(a: Ambiente, maqueta: number, fundido: number, tiempo: number, interior: boolean) {
    const g = this.gradacion.uniforms
    const noche = interior ? 0 : a.noche
    // Día: cálido y con cuerpo. Noche: azul profundo con luces ámbar.
    g.uContraste.value = 0.3 + 0.08 * noche + 0.18 * maqueta
    g.uSaturacion.value = 1.12 - 0.04 * noche + 0.2 * maqueta
    g.uTealOrange.value = 0.75 + 0.35 * noche
    g.uNegro.value = 0.022 + 0.01 * noche
    g.uBlanco.value = 0.985 - 0.02 * maqueta
    ;(g.uTinte.value as THREE.Vector3).set(1.0 + 0.012 * (1 - noche) - 0.03 * noche, 1.0, 0.985 + 0.05 * noche)
    g.uVineta.value = 0.3 + 0.12 * noche + 0.1 * maqueta
    g.uFundido.value = fundido
    g.uTiempo.value = tiempo % 100

    if (this.bloom) {
      this.bloom.strength = interior ? 0.35 : a.bloom.fuerza
      this.bloom.threshold = interior ? 1.0 : a.bloom.umbral
      this.bloom.radius = interior ? 0.45 : a.bloom.radio
    }

    const tilt = maqueta > 0.01
    this.tiltH.enabled = tilt
    this.tiltV.enabled = tilt
    if (tilt) {
      const r = 9 * maqueta * this.pr * Math.max(0.6, this.alto / 900)
      this.tiltH.uniforms.uRadio.value = r
      this.tiltV.uniforms.uRadio.value = r
      ;(this.tiltH.uniforms.uDir.value as THREE.Vector2).set(1 / (this.ancho * this.pr), 0)
      ;(this.tiltV.uniforms.uDir.value as THREE.Vector2).set(0, 1 / (this.alto * this.pr))
    }
  }

  render(dt: number) {
    this.composer.render(dt)
  }

  dispose() {
    for (const p of this.composer.passes) p.dispose()
    this.composer.dispose()
    this.destino.dispose()
  }
}
