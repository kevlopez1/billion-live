// ──────────────────────────────────────────────────────────────
// Materiales compartidos de la Casa Blanca (contrato: Materiales).
//
// Por qué proyección en el mundo: cada módulo arma su geometría como quiere
// (cajas, extrusiones, geometrías fusionadas, instancias) y sus UV no dicen
// cuántos metros mide una cara. Así que estos materiales toman la textura
// desde la posición en el mundo (triplanar en paredes, planar en el suelo):
// la arenisca, el pasto o el asfalto tienen la misma escala en todas partes y
// las franjas del pasto quedan alineadas entre parches distintos. Al clonar
// un material (`.clone()`), la proyección se conserva.
//
// Las texturas se generan con ruido periódico (motor-texturas.ts): mapas de
// color cerca del blanco (el tono lo pone `color`), de normales y de rugosidad.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Calidad } from "../tipos"
import type { Materiales } from "./contrato"
import {
  azar,
  celdas,
  distanciaJunta,
  fbm,
  gris,
  normalDesdeAltura,
  pintar,
  suave,
  textura,
  type Campo,
} from "./motor-texturas"

/** Tiempo compartido por los materiales animados (agua). Lo avanza el motor. */
const TIEMPO = { value: 0 }

interface Mundo {
  proyeccion: "triplanar" | "planar"
  /** Metros que cubre una repetición de la textura. */
  escala: number
  /** Variación de color a gran escala (0 = nada) para que no se note la repetición. */
  macro: number
  /** Franjas del pasto cortado: ancho de cada franja en metros (0 = sin franjas). */
  franjas: number
  contrasteFranjas: number
  agua: boolean
}

const MUNDO_BASE: Mundo = { proyeccion: "triplanar", escala: 4, macro: 0, franjas: 0, contrasteFranjas: 0, agua: false }

type UniformesMundo = Record<string, THREE.IUniform>

function definesMundo(m: Mundo): Record<string, string> {
  const d: Record<string, string> = { MUNDO: "" }
  if (m.proyeccion === "planar") d.MUNDO_PLANAR = ""
  if (m.macro > 0) d.MUNDO_MACRO = ""
  if (m.franjas > 0) d.MUNDO_FRANJAS = ""
  if (m.agua) d.MUNDO_AGUA = ""
  return d
}

const VERT_DECL = /* glsl */ `#include <common>
varying vec3 vMundoPos;
varying vec3 vMundoNormal;`

const VERT_POS = /* glsl */ `#include <worldpos_vertex>
{
  vec4 mp = vec4( transformed, 1.0 );
  vec3 mn = objectNormal;
  #ifdef USE_BATCHING
    mp = batchingMatrix * mp;
    mn = mat3( batchingMatrix ) * mn;
  #endif
  #ifdef USE_INSTANCING
    mp = instanceMatrix * mp;
    mn = mat3( instanceMatrix ) * mn;
  #endif
  mp = modelMatrix * mp;
  vMundoPos = mp.xyz;
  vMundoNormal = normalize( mat3( modelMatrix ) * mn );
}`

const FRAG_DECL = /* glsl */ `#include <common>
uniform float uMundoEscala;
uniform vec2 uMundoMacro;
uniform vec2 uMundoFranjas;
uniform float uMundoTiempo;
varying vec3 vMundoPos;
varying vec3 vMundoNormal;
vec3 mundoPesos() {
  vec3 w = pow( abs( normalize( vMundoNormal ) ), vec3( 4.0 ) );
  return w / ( w.x + w.y + w.z );
}
vec4 mundoMuestra( sampler2D t, vec3 p ) {
  #ifdef MUNDO_PLANAR
    return texture2D( t, p.xz );
  #else
    vec3 w = mundoPesos();
    return texture2D( t, p.zy ) * w.x + texture2D( t, p.xz ) * w.y + texture2D( t, p.xy ) * w.z;
  #endif
}`

const FRAG_MAPA = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = mundoMuestra( map, vMundoPos / uMundoEscala );
  diffuseColor *= sampledDiffuseColor;
  #ifdef MUNDO_MACRO
  {
    // La misma textura, 9,7 veces más grande: manchas amplias que rompen la repetición.
    vec3 mc = texture2D( map, vMundoPos.xz / ( uMundoEscala * 9.7 ) + 0.37 ).rgb;
    float ml = dot( mc, vec3( 0.2126, 0.7152, 0.0722 ) );
    diffuseColor.rgb *= clamp( 1.0 + ( ml - uMundoMacro.y ) * uMundoMacro.x, 0.6, 1.4 );
  }
  #endif
#endif
#ifdef MUNDO_FRANJAS
{
  // Franjas del corte de pasto, paralelas al eje z, con antialias por derivadas.
  float s = vMundoPos.x / uMundoFranjas.x;
  float tri = abs( fract( s * 0.5 ) * 2.0 - 1.0 );
  float aa = min( fwidth( s ) * 1.2, 0.5 );
  float banda = smoothstep( 0.5 - aa, 0.5 + aa, tri );
  diffuseColor.rgb *= mix( 1.0 - uMundoFranjas.y, 1.0 + uMundoFranjas.y, banda );
}
#endif`

const FRAG_RUGOSIDAD = /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = mundoMuestra( roughnessMap, vMundoPos / uMundoEscala );
  roughnessFactor *= texelRoughness.g;
#endif`

// Normales: mezcla "whiteout" por eje (Ben Golus) en espacio mundo y vuelta a espacio vista.
const FRAG_NORMAL = /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
{
  vec3 nG = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
  vec3 p = vMundoPos / uMundoEscala;
  #ifdef MUNDO_AGUA
    vec3 a = texture2D( normalMap, p.xz + vec2( 0.021, 0.013 ) * uMundoTiempo ).xyz * 2.0 - 1.0;
    vec3 b = texture2D( normalMap, p.xz * 1.63 - vec2( 0.017, -0.024 ) * uMundoTiempo ).xyz * 2.0 - 1.0;
    vec3 t = vec3( ( a.xy + b.xy ) * normalScale, a.z * b.z );
    vec3 nW = normalize( vec3( t.x + nG.x, abs( t.z ) * nG.y, t.y + nG.z ) );
  #elif defined( MUNDO_PLANAR )
    vec3 t = texture2D( normalMap, p.xz ).xyz * 2.0 - 1.0;
    t.xy *= normalScale;
    vec3 nW = normalize( vec3( t.x + nG.x, abs( t.z ) * nG.y, t.y + nG.z ) );
  #else
    vec3 w = mundoPesos();
    vec3 tx = texture2D( normalMap, p.zy ).xyz * 2.0 - 1.0;
    vec3 ty = texture2D( normalMap, p.xz ).xyz * 2.0 - 1.0;
    vec3 tz = texture2D( normalMap, p.xy ).xyz * 2.0 - 1.0;
    tx.xy *= normalScale;
    ty.xy *= normalScale;
    tz.xy *= normalScale;
    tx = vec3( tx.xy + nG.zy, abs( tx.z ) * nG.x );
    ty = vec3( ty.xy + nG.xz, abs( ty.z ) * nG.y );
    tz = vec3( tz.xy + nG.xy, abs( tz.z ) * nG.z );
    vec3 nW = normalize( tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z );
  #endif
  normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );
}
#endif`

function parchear(shader: THREE.WebGLProgramParametersWithUniforms, u: UniformesMundo): void {
  Object.assign(shader.uniforms, u)
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", VERT_DECL)
    .replace("#include <worldpos_vertex>", VERT_POS)
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", FRAG_DECL)
    .replace("#include <map_fragment>", FRAG_MAPA)
    .replace("#include <roughnessmap_fragment>", FRAG_RUGOSIDAD)
    .replace("#include <normal_fragment_maps>", FRAG_NORMAL)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClaseMaterial = new (...args: any[]) => THREE.MeshStandardMaterial

/** Agrega la proyección en el mundo a una clase de material de three (estándar o física). */
function conMundo<T extends ClaseMaterial>(Base: T) {
  return class MaterialMundo extends Base {
    mundo: Mundo = { ...MUNDO_BASE }
    uMundo: UniformesMundo = crearUniformes(MUNDO_BASE)

    configurarMundo(m: Mundo): this {
      this.mundo = { ...m }
      this.uMundo = crearUniformes(m)
      this.defines = { ...(this.defines ?? {}), ...definesMundo(m) }
      this.needsUpdate = true
      return this
    }

    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
      parchear(shader, this.uMundo)
    }

    customProgramCacheKey(): string {
      return "casa-blanca-mundo-1"
    }

    copy(fuente: THREE.MeshStandardMaterial): this {
      super.copy(fuente)
      const m = (fuente as unknown as { mundo?: Mundo }).mundo
      if (m) {
        this.configurarMundo(m)
        const media = (fuente as unknown as { uMundo?: UniformesMundo }).uMundo?.uMundoMacro?.value as THREE.Vector2 | undefined
        if (media) (this.uMundo.uMundoMacro.value as THREE.Vector2).copy(media)
      }
      return this
    }
  }
}

function crearUniformes(m: Mundo): UniformesMundo {
  return {
    uMundoEscala: { value: m.escala },
    uMundoMacro: { value: new THREE.Vector2(m.macro, 0.5) },
    uMundoFranjas: { value: new THREE.Vector2(Math.max(m.franjas, 0.001), m.contrasteFranjas) },
    uMundoTiempo: TIEMPO,
  }
}

const EstandarMundo = conMundo(THREE.MeshStandardMaterial)
const FisicoMundo = conMundo(THREE.MeshPhysicalMaterial)

// ── Generadores de texturas ──────────────────────────────────

interface Juego {
  mapa?: Uint8ClampedArray
  normal?: Uint8ClampedArray
  rug?: Uint8ClampedArray
  /** Rugosidad mínima y máxima que codifica `rug` (el material usa la máxima). */
  rugMin: number
  rugMax: number
  fuerzaNormal: number
}

interface Pide {
  n: number
  normal: boolean
  rug: boolean
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function rugDe(p: Pide, min: number, max: number, fn: (i: number) => number): Uint8ClampedArray | undefined {
  if (!p.rug) return undefined
  return gris(p.n, (i) => clamp01((min + (max - min) * clamp01(fn(i))) / max))
}

function genFachada(p: Pide): Juego {
  const { n } = p
  const grano = fbm(n, 48, 48, 3, 11)
  const nube = fbm(n, 4, 4, 5, 12)
  // Sillares de 0,6 m de alto y 1,2 m de largo, trabados (la textura cubre 3,6 m).
  const paso = n / 6
  const largo = n / 3
  const w = Math.max(0.55, n / 600)
  const junta = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    const fila = Math.floor(y / paso)
    const dy = distanciaJunta(y, paso)
    const off = (fila % 2) * (largo / 2)
    for (let x = 0; x < n; x++) {
      const dx = distanciaJunta((x + off) % n, largo)
      junta[y * n + x] = 1 - suave(w, w + 1.1, Math.min(dx, dy))
    }
  }
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = 0.5 * grano[i] + 0.25 * nube[i] - 0.7 * junta[i]
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const v = 0.965 + 0.035 * (nube[i] - 0.5) + 0.012 * (grano[i] - 0.5) - 0.05 * junta[i]
      c[0] = clamp01(v * 1.004)
      c[1] = clamp01(v)
      c[2] = clamp01(v * 0.994)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 2.2 * (n / 512)) : undefined,
    rug: rugDe(p, 0.68, 0.92, (i) => 0.4 + 0.4 * grano[i] + 0.5 * junta[i]),
    rugMin: 0.68,
    rugMax: 0.92,
    fuerzaNormal: 0.45,
  }
}

function genMoldura(p: Pide): Juego {
  const { n } = p
  const grano = fbm(n, 40, 40, 3, 21)
  const nube = fbm(n, 5, 5, 4, 22)
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = 0.7 * grano[i] + 0.3 * nube[i]
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const v = 0.975 + 0.025 * (nube[i] - 0.5)
      c[0] = clamp01(v)
      c[1] = clamp01(v)
      c[2] = clamp01(v * 0.996)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 1.4 * (n / 512)) : undefined,
    rug: rugDe(p, 0.55, 0.78, (i) => 0.3 + 0.7 * grano[i]),
    rugMin: 0.55,
    rugMax: 0.78,
    fuerzaNormal: 0.3,
  }
}

function genTecho(p: Pide): Juego {
  const { n } = p
  // Junta alzada de chapa cada 0,5 m (la textura cubre 3 m: 6 juntas).
  const paso = n / 6
  const vetas = fbm(n, 24, 2, 3, 41)
  const ondas = fbm(n, 3, 8, 3, 42)
  const h = new Float32Array(n * n)
  const junta = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = distanciaJunta(x, paso)
      const j = 1 - suave(0.5, 2.6 * (n / 512) + 0.6, d)
      const i = y * n + x
      junta[i] = j
      h[i] = j * 1.2 + 0.18 * ondas[i]
    }
  }
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const v = 0.9 + 0.09 * (vetas[i] - 0.5) + 0.06 * junta[i] + 0.03 * (ondas[i] - 0.5)
      c[0] = clamp01(v)
      c[1] = clamp01(v)
      c[2] = clamp01(v * 1.01)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 2.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.35, 0.62, (i) => 0.25 + 0.75 * vetas[i]),
    rugMin: 0.35,
    rugMax: 0.62,
    fuerzaNormal: 0.6,
  }
}

function genPasto(p: Pide): Juego {
  const { n } = p
  const grano = fbm(n, 128, 128, 2, 31)
  const medio = fbm(n, 14, 14, 4, 32)
  const parche = fbm(n, 3, 3, 5, 33)
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = grano[i] * 0.85 + medio[i] * 0.15
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const seco = suave(0.6, 0.9, parche[i])
      const sombra = suave(0.5, 0.15, medio[i])
      const l = 0.8 + 0.2 * grano[i] - 0.14 * sombra
      c[0] = clamp01(l * (0.95 + 0.3 * seco))
      c[1] = clamp01(l * (1.0 + 0.04 * seco))
      c[2] = clamp01(l * (0.95 - 0.3 * seco))
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 3.2 * (n / 512)) : undefined,
    rug: rugDe(p, 0.82, 1, (i) => 0.3 + 0.7 * grano[i]),
    rugMin: 0.82,
    rugMax: 1,
    fuerzaNormal: 0.75,
  }
}

/** Follaje: manchas de hojas (celdas) con huecos oscuros entre ellas. */
function genFollaje(p: Pide, f: number, semilla: number): Juego {
  const { n } = p
  const c = celdas(n, f, semilla)
  const fino = fbm(n, Math.min(n, f * 6), Math.min(n, f * 6), 2, semilla + 1)
  const nube = fbm(n, 4, 4, 4, semilla + 2)
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) {
    const domo = 1 - Math.min(1, c.f1[i] * 1.6)
    h[i] = domo * 0.8 + fino[i] * 0.2
  }
  return {
    mapa: pintar(n, (i, _x, _y, col) => {
      const hueco = 1 - suave(0.0, 0.18, c.borde[i])
      const domo = 1 - Math.min(1, c.f1[i] * 1.6)
      let l = 0.62 + 0.26 * c.id[i] + 0.12 * domo + 0.06 * (fino[i] - 0.5)
      l *= 1 - 0.45 * hueco
      const tibio = suave(0.55, 0.95, nube[i]) * 0.18
      col[0] = clamp01(l * (0.95 + tibio))
      col[1] = clamp01(l)
      col[2] = clamp01(l * (0.92 - tibio * 0.5))
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 3.0 * (n / 512)) : undefined,
    rug: rugDe(p, 0.62, 0.95, (i) => 1 - (1 - Math.min(1, c.f1[i] * 1.6)) * 0.7),
    rugMin: 0.62,
    rugMax: 0.95,
    fuerzaNormal: 0.9,
  }
}

function genCorteza(p: Pide): Juego {
  const { n } = p
  const vetas = fbm(n, 18, 2, 4, 51)
  const fino = fbm(n, 64, 16, 2, 52)
  const h = new Float32Array(n * n)
  const grieta = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) {
    grieta[i] = 1 - suave(0.0, 0.09, Math.abs(vetas[i] - 0.5))
    h[i] = vetas[i] * 0.5 + fino[i] * 0.3 - grieta[i] * 0.7
  }
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.72 + 0.22 * vetas[i] + 0.08 * (fino[i] - 0.5) - 0.38 * grieta[i]
      c[0] = clamp01(l)
      c[1] = clamp01(l * 0.97)
      c[2] = clamp01(l * 0.93)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 3.4 * (n / 512)) : undefined,
    rug: rugDe(p, 0.8, 1, (i) => 0.5 + 0.5 * grieta[i]),
    rugMin: 0.8,
    rugMax: 1,
    fuerzaNormal: 1,
  }
}

function genAsfalto(p: Pide): Juego {
  const { n } = p
  const fino = fbm(n, 192, 192, 2, 61)
  const medio = fbm(n, 8, 8, 5, 62)
  const r = azar(63)
  const piedra = new Float32Array(n * n)
  for (let i = 0; i < piedra.length; i++) piedra[i] = r() > 0.982 ? 0.5 + r() * 0.5 : 0
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = fino[i] * 0.7 + piedra[i] * 0.6
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.8 + 0.12 * (fino[i] - 0.5) + 0.1 * (medio[i] - 0.5) + 0.22 * piedra[i]
      c[0] = clamp01(l)
      c[1] = clamp01(l)
      c[2] = clamp01(l * 1.01)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 2.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.68, 0.98, (i) => 0.25 + 0.6 * medio[i] + 0.15 * fino[i]),
    rugMin: 0.68,
    rugMax: 0.98,
    fuerzaNormal: 0.6,
  }
}

function genAcera(p: Pide): Juego {
  const { n } = p
  // Losetas de 1,2 m (la textura cubre 2,4 m: 2 x 2).
  const paso = n / 2
  const w = Math.max(0.6, n / 420)
  const manchas = fbm(n, 6, 6, 4, 71)
  const grano = fbm(n, 96, 96, 2, 72)
  const r = azar(73)
  const tono = [r(), r(), r(), r()]
  const junta = new Float32Array(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      junta[y * n + x] = 1 - suave(w, w + 1.2, Math.min(distanciaJunta(x, paso), distanciaJunta(y, paso)))
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = grano[i] * 0.4 + manchas[i] * 0.1 - junta[i] * 0.9
  return {
    mapa: pintar(n, (i, x, y, c) => {
      const t = tono[(Math.floor(y / paso) % 2) * 2 + (Math.floor(x / paso) % 2)]
      const l = 0.93 + 0.05 * (t - 0.5) + 0.06 * (manchas[i] - 0.5) + 0.04 * (grano[i] - 0.5) - 0.3 * junta[i]
      c[0] = clamp01(l * 1.005)
      c[1] = clamp01(l)
      c[2] = clamp01(l * 0.985)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 2.4 * (n / 512)) : undefined,
    rug: rugDe(p, 0.7, 0.95, (i) => 0.35 + 0.4 * grano[i] + 0.4 * junta[i]),
    rugMin: 0.7,
    rugMax: 0.95,
    fuerzaNormal: 0.55,
  }
}

function genGrava(p: Pide): Juego {
  const { n } = p
  const c = celdas(n, Math.max(8, Math.round(n / 14)), 81)
  const fino = fbm(n, 96, 96, 2, 82)
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) {
    const hueco = 1 - suave(0.0, 0.16, c.borde[i])
    h[i] = (1 - Math.min(1, c.f1[i] * 1.5)) * 0.8 + fino[i] * 0.15 - hueco * 0.5
  }
  return {
    mapa: pintar(n, (i, _x, _y, col) => {
      const hueco = 1 - suave(0.0, 0.16, c.borde[i])
      const id = c.id[i]
      const id2 = (id * 7.31) % 1
      let l = 0.74 + 0.26 * id + 0.05 * (fino[i] - 0.5)
      l *= 1 - 0.42 * hueco
      col[0] = clamp01(l * (1.0 + 0.04 * id2))
      col[1] = clamp01(l * 0.99)
      col[2] = clamp01(l * (0.96 - 0.05 * id2))
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 3.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.75, 0.97, (i) => 0.5 + 0.5 * fino[i]),
    rugMin: 0.75,
    rugMax: 0.97,
    fuerzaNormal: 1,
  }
}

function genAgua(p: Pide): Juego {
  const { n } = p
  const olas = fbm(n, 5, 5, 5, 91, 0.55)
  return {
    normal: p.normal ? normalDesdeAltura(n, olas, 5.0 * (n / 512)) : undefined,
    rugMin: 0.04,
    rugMax: 0.04,
    fuerzaNormal: 0.35,
  }
}

function genHierro(p: Pide): Juego {
  const { n } = p
  const nube = fbm(n, 10, 10, 4, 101)
  const fino = fbm(n, 96, 96, 2, 102)
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = fino[i]
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.93 + 0.07 * (nube[i] - 0.5)
      c[0] = clamp01(l)
      c[1] = clamp01(l)
      c[2] = clamp01(l)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 0.8 * (n / 512)) : undefined,
    rug: rugDe(p, 0.32, 0.58, (i) => nube[i]),
    rugMin: 0.32,
    rugMax: 0.58,
    fuerzaNormal: 0.25,
  }
}

function genGranito(p: Pide): Juego {
  const { n } = p
  const nube = fbm(n, 6, 6, 4, 111)
  const fino = fbm(n, 128, 128, 2, 112)
  const r = azar(113)
  const punto = new Float32Array(n * n)
  for (let i = 0; i < punto.length; i++) {
    const v = r()
    punto[i] = v < 0.1 ? -1 : v > 0.94 ? 1 : 0
  }
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.88 + 0.08 * (nube[i] - 0.5) + 0.05 * (fino[i] - 0.5) + 0.16 * punto[i]
      c[0] = clamp01(l)
      c[1] = clamp01(l * 0.995)
      c[2] = clamp01(l * 1.005)
    }),
    normal: p.normal ? normalDesdeAltura(n, fino, 1.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.5, 0.78, (i) => 0.3 + 0.5 * nube[i] + 0.2 * fino[i]),
    rugMin: 0.5,
    rugMax: 0.78,
    fuerzaNormal: 0.35,
  }
}

function genConcreto(p: Pide): Juego {
  const { n } = p
  // Juntas de corte cada 3 m (la textura cubre 6 m).
  const paso = n / 2
  const nube = fbm(n, 3, 3, 6, 121)
  const fino = fbm(n, 128, 128, 2, 122)
  const junta = new Float32Array(n * n)
  const w = Math.max(0.5, n / 700)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      junta[y * n + x] = 1 - suave(w, w + 1, Math.min(distanciaJunta(x, paso), distanciaJunta(y, paso)))
  const h = new Float32Array(n * n)
  for (let i = 0; i < h.length; i++) h[i] = fino[i] * 0.15 - junta[i]
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.93 + 0.1 * (nube[i] - 0.5) + 0.025 * (fino[i] - 0.5) - 0.22 * junta[i]
      c[0] = clamp01(l)
      c[1] = clamp01(l)
      c[2] = clamp01(l * 0.99)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 1.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.1, 0.32, (i) => 0.15 + 0.75 * nube[i] + 0.5 * junta[i]),
    rugMin: 0.1,
    rugMax: 0.32,
    fuerzaNormal: 0.3,
  }
}

function genAcero(p: Pide): Juego {
  const { n } = p
  const cepillo = fbm(n, 2, Math.min(n, 192), 2, 131)
  const nube = fbm(n, 4, 4, 3, 132)
  return {
    mapa: pintar(n, (i, _x, _y, c) => {
      const l = 0.94 + 0.05 * (cepillo[i] - 0.5) + 0.02 * (nube[i] - 0.5)
      c[0] = clamp01(l)
      c[1] = clamp01(l)
      c[2] = clamp01(l)
    }),
    normal: p.normal ? normalDesdeAltura(n, cepillo, 0.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.2, 0.4, (i) => 0.65 * cepillo[i] + 0.35 * nube[i]),
    rugMin: 0.2,
    rugMax: 0.4,
    fuerzaNormal: 0.2,
  }
}

function genMadera(p: Pide): Juego {
  const { n } = p
  // Tablas a lo largo del eje u: 6 por repetición (1,6 m: tablas de ~27 cm).
  const tablas = 6
  const paso = n / tablas
  const veta = fbm(n, 2, 48, 4, 141)
  const nudo = fbm(n, 4, 16, 3, 142)
  const r = azar(143)
  const tono = Array.from({ length: tablas }, () => r())
  const h = new Float32Array(n * n)
  const junta = new Float32Array(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      junta[i] = 1 - suave(0.5, 1.6, distanciaJunta(y, paso))
      h[i] = veta[i] * 0.4 - junta[i] * 0.8
    }
  return {
    mapa: pintar(n, (i, _x, y, c) => {
      const t = tono[Math.floor(y / paso) % tablas]
      const anillo = 0.5 + 0.5 * Math.sin((veta[i] * 9 + nudo[i] * 3) * Math.PI * 2)
      const l = 0.8 + 0.1 * (t - 0.5) + 0.1 * (anillo - 0.5) - 0.3 * junta[i]
      c[0] = clamp01(l * 1.02)
      c[1] = clamp01(l * 0.98)
      c[2] = clamp01(l * 0.92)
    }),
    normal: p.normal ? normalDesdeAltura(n, h, 1.6 * (n / 512)) : undefined,
    rug: rugDe(p, 0.42, 0.68, (i) => 0.3 + 0.5 * veta[i] + 0.4 * junta[i]),
    rugMin: 0.42,
    rugMax: 0.68,
    fuerzaNormal: 0.35,
  }
}

/** Interior encendido tras el vidrio: cálido arriba, cortinas a los costados (UV de la ventana). */
function texturaVentana(anisotropia: number): THREE.CanvasTexture {
  const n = 64
  const ruido = fbm(n, 4, 4, 3, 151)
  const px = pintar(n, (i, x, y, c) => {
    const u = x / (n - 1)
    const v = 1 - y / (n - 1)
    const cortina = Math.min(suave(0.0, 0.16, u), suave(1.0, 0.84, u))
    const l = (0.45 + 0.55 * cortina) * (0.72 + 0.28 * v) * (0.9 + 0.2 * ruido[i])
    c[0] = clamp01(l)
    c[1] = clamp01(l * 0.93)
    c[2] = clamp01(l * 0.82)
  })
  const t = textura(n, px, { color: true, anisotropia })
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// ── Fábrica ──────────────────────────────────────────────────

export interface MaterialesMotor extends Materiales {
  /** Avanza el tiempo de los materiales animados (agua), en segundos. */
  actualizar(tiempo: number): void
  /** Libera texturas y materiales. */
  dispose(): void
}

const TAMANO: Record<Calidad, number> = { alta: 512, media: 256, baja: 128 }
const ANISOTROPIA: Record<Calidad, number> = { alta: 8, media: 4, baja: 2 }

/** Promedio de luminancia (lineal aproximada) de un mapa: la referencia de la variación amplia. */
function luminanciaMedia(px: Uint8ClampedArray): number {
  let s = 0
  let k = 0
  for (let o = 0; o < px.length; o += 4 * 7) {
    const l = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255
    s += Math.pow(l, 2.2)
    k++
  }
  return k ? s / k : 0.5
}

export function crearMateriales(calidad: Calidad): MaterialesMotor {
  const n = TAMANO[calidad]
  const anis = ANISOTROPIA[calidad]
  const pide: Pide = { n, normal: calidad !== "baja", rug: calidad === "alta" }
  const texturas: THREE.Texture[] = []
  const tex = (px: Uint8ClampedArray | undefined, color: boolean) => {
    if (!px) return null
    const t = textura(n, px, { color, anisotropia: anis })
    texturas.push(t)
    return t
  }

  // Un juego de texturas se sube una sola vez aunque lo usen varios materiales.
  const subidas = new Map<Juego, { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null }>()
  const subir = (juego: Juego) => {
    let s = subidas.get(juego)
    if (!s) {
      s = { map: tex(juego.mapa, true), normalMap: tex(juego.normal, false), roughnessMap: tex(juego.rug, false) }
      subidas.set(juego, s)
    }
    return s
  }

  /** Material con proyección en el mundo a partir de un juego de texturas. */
  const mundo = (
    juego: Juego,
    params: THREE.MeshStandardMaterialParameters,
    m: Partial<Mundo>,
    fisico?: THREE.MeshPhysicalMaterialParameters,
  ): THREE.MeshStandardMaterial => {
    const config: Mundo = { ...MUNDO_BASE, ...m }
    const { map, normalMap, roughnessMap } = subir(juego)
    const base = {
      ...params,
      map,
      normalMap,
      roughnessMap,
      normalScale: new THREE.Vector2(juego.fuerzaNormal, juego.fuerzaNormal),
      roughness: roughnessMap ? juego.rugMax : (juego.rugMin + juego.rugMax) / 2,
    }
    const mat = fisico ? new FisicoMundo({ ...base, ...fisico }) : new EstandarMundo(base)
    mat.configurarMundo(config)
    if (juego.mapa && config.macro > 0) (mat.uMundo.uMundoMacro.value as THREE.Vector2).set(config.macro, luminanciaMedia(juego.mapa))
    return mat
  }

  const pasto = genPasto(pide)
  const follajeArbusto = genFollaje(pide, Math.max(10, Math.round(n / 20)), 61)
  const follajeHoja = genFollaje(pide, Math.max(8, Math.round(n / 32)), 67)

  const fachada = mundo(genFachada(pide), { color: "#F3F2EE", name: "fachada" }, { escala: 3.6 })
  const moldura = mundo(genMoldura(pide), { color: "#F6F3EA", name: "moldura" }, { escala: 2.5 })

  // Vidrio de ventana: oscuro y verdoso, refleja el cielo (Fresnel + metalness alto).
  const vidrio = new THREE.MeshStandardMaterial({
    name: "vidrio",
    color: "#2b3a37",
    metalness: 0.82,
    roughness: 0.07,
  })
  vidrio.userData.reflejo = 1.5

  // La misma ventana, con el interior encendido de noche (el motor la registra en alAnochecer).
  const ventanaNoche = new THREE.MeshStandardMaterial({
    name: "ventanaNoche",
    color: "#2b3a37",
    metalness: 0.6,
    roughness: 0.1,
    emissive: new THREE.Color("#ffd59a"),
    emissiveMap: texturaVentana(anis),
    emissiveIntensity: 0,
  })
  if (ventanaNoche.emissiveMap) texturas.push(ventanaNoche.emissiveMap)
  ventanaNoche.userData.reflejo = 1.2

  const techoMetal = mundo(genTecho(pide), { color: "#878d93", metalness: 0.55, name: "techoMetal" }, { escala: 3 })

  // El pasto comparte texturas; el rayado agrega las franjas del corte (4,5 m).
  const pastoMat = mundo(pasto, { color: "#5f9a3e", name: "pasto" }, { proyeccion: "planar", escala: 7, macro: 1.1 })
  const pastoRayado = mundo(
    pasto,
    { color: "#5f9a3e", name: "pastoRayado" },
    { proyeccion: "planar", escala: 7, macro: 1.1, franjas: 4.5, contrasteFranjas: 0.11 },
  )

  const arbusto = mundo(follajeArbusto, { color: "#2f5726", name: "arbusto" }, { escala: 1.6 })
  const hoja = mundo(follajeHoja, { color: "#4f8a32", name: "hoja" }, { escala: 2.4 })
  const corteza = mundo(genCorteza(pide), { color: "#5d4c3e", name: "corteza" }, { escala: 1.3 })
  const asfalto = mundo(genAsfalto(pide), { color: "#3a3c40", name: "asfalto" }, { proyeccion: "planar", escala: 5, macro: 0.8 })
  const acera = mundo(genAcera(pide), { color: "#c4c0b7", name: "acera" }, { escala: 2.4 })
  const grava = mundo(genGrava(pide), { color: "#d2c6ae", name: "grava" }, { proyeccion: "planar", escala: 1.5 })

  const agua = mundo(
    genAgua(pide),
    { color: "#1d5a6c", metalness: 0, name: "agua" },
    { proyeccion: "planar", escala: 3.5, agua: true },
  )
  agua.userData.reflejo = 1.7

  const hierroNegro = mundo(genHierro(pide), { color: "#17181b", metalness: 0.75, name: "hierroNegro" }, { escala: 2 })
  const granito = mundo(genGranito(pide), { color: "#8f9194", name: "granito" }, { escala: 2.5 })

  const concretoPulido = mundo(
    genConcreto(pide),
    { color: "#bdbdb8", name: "concretoPulido" },
    { escala: 6 },
    calidad === "alta" ? { clearcoat: 0.45, clearcoatRoughness: 0.12 } : undefined,
  )
  concretoPulido.userData.reflejo = 1.1

  const acero = mundo(genAcero(pide), { color: "#c9ccd1", metalness: 1, name: "acero" }, { escala: 1 })
  acero.userData.reflejo = 1.2
  const madera = mundo(genMadera(pide), { color: "#c99f72", name: "madera" }, { escala: 1.6 })

  const todos: Materiales = {
    fachada,
    moldura,
    vidrio,
    ventanaNoche,
    techoMetal,
    pasto: pastoMat,
    pastoRayado,
    arbusto,
    hoja,
    corteza,
    asfalto,
    acera,
    grava,
    agua,
    hierroNegro,
    granito,
    concretoPulido,
    acero,
    madera,
  }

  return {
    ...todos,
    actualizar(tiempo: number) {
      TIEMPO.value = tiempo
    },
    dispose() {
      for (const t of texturas) t.dispose()
      for (const m of Object.values(todos)) m.dispose()
    },
  }
}
