// ──────────────────────────────────────────────────────────────
// Materiales de los personajes.
//
// - Piel: MeshPhysical con poros (normal map), variación de color fina,
//   brillo de terciopelo (sheen) y un truco de dispersión subsuperficial:
//   la luz "envuelve" el terminador con un tono rojizo, como la piel real,
//   para que no parezca plástico. La rugosidad sale de cada vértice (labios
//   y frente brillan más que las mejillas).
// - Ropa: UN material por tejido, compartido por todos. El color de cada
//   prenda va en el vértice y la rugosidad/metal también (zapatos de cuero
//   brillante y botones dorados en la misma malla).
// - Pelo: hebras con alfa recortado y brillo anisotrópico.
// - Ojos: iris pintado y una capa de barniz (clearcoat) que da el reflejo.
// - Holograma (las IA): luz translúcida con borde brillante y líneas de escaneo.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { texArrugas, texNumero, texOjo, texPelo, texPielColor, texPielNormal, texTela, type Tejido } from "./avatar-texturas"

/** Lee la rugosidad y el metal del vértice (atributo aMat) y, si hay color de dispersión, envuelve la luz. */
function inyectar(m: THREE.MeshPhysicalMaterial, sss: THREE.Color | null) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nvarying vec2 vMat;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvMat = aMat;")
    let f = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMat;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * vMat.x;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = max( metalness, vMat.y );")
    if (sss) {
      sh.uniforms.uSSS = { value: sss }
      sh.uniforms.uArrugas = { value: texArrugas() }
      // Arrugas: mapa canónico de la cara (aArr = u, v, edad, hoyuelo) como relieve
      // (gradiente de la altura en pantalla, sin tangentes) y una sombra leve en el pliegue.
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 aArr;\nvarying vec4 vArr;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvArr = aArr;")
      f = f
        .replace("#include <common>", "#include <common>\nuniform sampler2D uArrugas;\nvarying vec4 vArr;\nvec3 arrugaNormal( vec3 p, vec3 n, float h, float fd ) {\n\tvec3 dpx = dFdx( p );\n\tvec3 dpy = dFdy( p );\n\tvec3 r1 = cross( dpy, n );\n\tvec3 r2 = cross( n, dpx );\n\tfloat det = dot( dpx, r1 ) * fd;\n\tvec3 g = sign( det ) * ( dFdx( h ) * r1 + dFdy( h ) * r2 );\n\treturn normalize( abs( det ) * n - g );\n}")
        .replace("#include <color_fragment>", "#include <color_fragment>\n\tvec4 arrW = texture2D( uArrugas, vArr.xy );\n\tfloat arrH = arrW.r * vArr.z + arrW.g * vArr.w;\n\tdiffuseColor.rgb *= 1.0 - 0.16 * arrH;")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n\tif ( arrH > 0.002 ) normal = arrugaNormal( - vViewPosition, normal, - arrH * 0.00016, faceDirection );")
      f = f
        .replace("#include <common>", "#include <common>\nuniform vec3 uSSS;")
        .replace(
          "#include <lights_physical_pars_fragment>",
          THREE.ShaderChunk.lights_physical_pars_fragment.replace(
            "vec3 irradiance = dotNL * directLight.color;",
            [
              "vec3 irradiance = dotNL * directLight.color;",
              // Luz envuelta: el borde de la sombra se tiñe de rojo (la sangre bajo la piel).
              "\tfloat dotNLw = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 );",
              "\treflectedLight.directDiffuse += max( dotNLw * dotNLw - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseContribution ) * uSSS;",
            ].join("\n"),
          ),
        )
    }
    sh.fragmentShader = f
  }
  const clave = sss ? "cb-avatar-piel" : "cb-avatar-amat"
  m.customProgramCacheKey = () => clave
}

const pieles = new Map<string, THREE.MeshPhysicalMaterial>()
/** Piel de un color. Compartida por todos los que tienen ese tono. */
export function matPiel(color: string): THREE.MeshPhysicalMaterial {
  let m = pieles.get(color)
  if (m) return m
  const c = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const nor = texPielNormal()
  nor.repeat.set(70, 70)
  const det = texPielColor()
  det.repeat.set(9, 9)
  m = new THREE.MeshPhysicalMaterial({
    color: c,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    map: det,
    normalMap: nor,
    normalScale: new THREE.Vector2(0.45, 0.45),
    sheen: 0.28,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.min(0.9, hsl.l * 0.9 + 0.1)).multiplyScalar(0.55),
    specularIntensity: 0.6,
    specularColor: new THREE.Color("#fff4ee"),
  })
  // Pieles oscuras dispersan menos rojo visible; las claras, más.
  const k = 0.35 + 0.4 * hsl.l
  inyectar(m, new THREE.Color(0.95 * k, 0.32 * k, 0.2 * k))
  m.name = `piel-${color}`
  pieles.set(color, m)
  return m
}

const ropas = new Map<string, THREE.MeshPhysicalMaterial>()
/** Ropa de un tejido. `numero`: textura con el número de camiseta (canal uv1). */
export function matRopa(tejido: Tejido, numero?: { texto: string; relleno: string; borde: string }): THREE.MeshPhysicalMaterial {
  const clave = `${tejido}|${numero ? `${numero.texto}${numero.relleno}${numero.borde}` : ""}`
  let m = ropas.get(clave)
  if (m) return m
  const nor = texTela(tejido)
  nor.repeat.set(26, 26)
  m = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    normalMap: nor,
    normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: tejido === "seda" ? 0.2 : 0.45,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0.16, 0.16, 0.17),
    specularIntensity: 0.55,
  })
  if (numero) {
    m.map = texNumero(numero.texto, numero.relleno, numero.borde)
    m.alphaTest = 0.5
  }
  inyectar(m, null)
  m.name = `ropa-${clave}`
  ropas.set(clave, m)
  return m
}

const pelos = new Map<string, THREE.MeshPhysicalMaterial>()
/** Pelo, barba y cejas: hebras con alfa recortado y brillo anisotrópico (teñido por `color`). */
export function matPelo(color: string): THREE.MeshPhysicalMaterial {
  let m = pelos.get(color)
  if (m) return m
  const c = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const t = texPelo()
  // El color de cada hebra va en el vértice (pelo, barba y cejas en un solo material);
  // el tono del pelo solo tiñe el brillo.
  m = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: t,
    vertexColors: true,
    alphaTest: 0.42,
    // Con MSAA el borde de cada hebra se suaviza (sin escalones en la línea del pelo).
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.52,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.25).multiplyScalar(0.5),
    specularIntensity: 0.55 + 0.25 * hsl.l,
    specularColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.6),
  })
  m.name = `pelo-${color}`
  pelos.set(color, m)
  return m
}

const ojos = new Map<string, THREE.MeshPhysicalMaterial>()
export function matOjo(iris: string, esclera = "#ece6de"): THREE.MeshPhysicalMaterial {
  const clave = `${iris}|${esclera}`
  let m = ojos.get(clave)
  if (m) return m
  m = new THREE.MeshPhysicalMaterial({
    map: texOjo(iris, esclera),
    // El color del vértice da la sombra del párpado sobre el ojo.
    vertexColors: true,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 0.4,
  })
  m.name = `ojo-${iris}`
  ojos.set(clave, m)
  return m
}

const lentes = new Map<string, THREE.MeshPhysicalMaterial>()
/** Cristal de las gafas: oscuro (de sol) o casi transparente. */
export function matLente(sol: boolean): THREE.MeshPhysicalMaterial {
  const k = sol ? "sol" : "clara"
  let m = lentes.get(k)
  if (m) return m
  m = new THREE.MeshPhysicalMaterial({
    color: sol ? "#0b0d10" : "#e8f0f4",
    roughness: 0.04,
    metalness: sol ? 0.2 : 0,
    transparent: true,
    opacity: sol ? 0.92 : 0.16,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.4,
  })
  m.name = `lente-${k}`
  lentes.set(k, m)
  return m
}

let sombraMats: Record<"normal" | "holo", THREE.MeshBasicMaterial> | null = null
export function matSombra(holo: boolean, tex: THREE.Texture): THREE.MeshBasicMaterial {
  if (!sombraMats) {
    const mk = (o: number) => new THREE.MeshBasicMaterial({ color: "#000000", map: tex, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    sombraMats = { normal: mk(0.5), holo: mk(0.16) }
  }
  return holo ? sombraMats.holo : sombraMats.normal
}

// ── Holograma ─────────────────────────────────────────────────

const HOLO_VERT = /* glsl */ `
#include <common>
#include <color_pars_vertex>
#include <skinning_pars_vertex>
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
	#include <color_vertex>
	#include <skinbase_vertex>
	#include <begin_vertex>
	#include <beginnormal_vertex>
	#include <skinnormal_vertex>
	#include <skinning_vertex>
	vec4 mv = modelViewMatrix * vec4( transformed, 1.0 );
	vN = normalize( normalMatrix * objectNormal );
	vV = -mv.xyz;
	vY = transformed.y;
	gl_Position = projectionMatrix * mv;
}`

const HOLO_FRAG = /* glsl */ `
#include <color_pars_fragment>
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTiempo;
uniform float uAlto;
varying vec3 vN;
varying vec3 vV;
varying float vY;
float hash( float n ) { return fract( sin( n ) * 43758.5453 ); }
void main() {
	#ifdef USE_COLOR_ALPHA
		if ( vColor.a < 0.45 ) discard;
	#endif
	vec3 n = normalize( vN );
	vec3 v = normalize( vV );
	float fr = pow( 1.0 - abs( dot( n, v ) ), 2.2 );
	// Líneas de escaneo finas que suben y una banda ancha que barre el cuerpo.
	// Líneas finas (130 por metro) y suaves: a 1080p se leen como textura, no como rayas.
	float lineas = 0.78 + 0.22 * smoothstep( 0.2, 0.8, abs( fract( vY * 130.0 - uTiempo * 0.9 ) - 0.5 ) * 2.0 );
	float barrido = smoothstep( 0.12, 0.0, abs( fract( uTiempo * 0.18 ) * ( uAlto + 0.6 ) - 0.3 - vY ) );
	float parpadeo = 0.92 + 0.08 * sin( uTiempo * 31.0 ) * sin( uTiempo * 7.3 );
	float falla = step( 0.985, hash( floor( uTiempo * 9.0 ) ) ) * step( abs( fract( vY * 3.0 + uTiempo ) - 0.5 ), 0.06 );
	vec3 col = mix( uColor, uColor2, fr * 0.8 + barrido * 0.5 );
	float brillo = ( 0.85 + 3.2 * fr + 1.2 * barrido ) * lineas * parpadeo + falla * 1.5;
	float a = clamp( 0.34 + 0.6 * fr + 0.2 * barrido + falla * 0.3, 0.0, 1.0 ) * ( 0.85 + 0.15 * lineas );
	gl_FragColor = vec4( col * brillo, a );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`

/** Material de holograma (color y prepaso de profundidad: solo se ve la cara más cercana). */
export function matHolograma(color: string, color2: string, alto: number): { color: THREE.ShaderMaterial; prepaso: THREE.ShaderMaterial } {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uColor2: { value: new THREE.Color(color2) },
    uTiempo: { value: 0 },
    uAlto: { value: alto },
  }
  const col = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    blending: THREE.NormalBlending,
  })
  col.name = `holo-${color}`
  const pre = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: HOLO_VERT,
    fragmentShader: "#include <common>\n#include <color_pars_fragment>\nvoid main() {\n#ifdef USE_COLOR_ALPHA\nif ( vColor.a < 0.45 ) discard;\n#endif\ngl_FragColor = vec4( 0.0 );\n}",
    vertexColors: true,
    transparent: true,
    colorWrite: false,
    depthWrite: true,
  })
  pre.name = `holo-pre-${color}`
  return { color: col, prepaso: pre }
}

/** Para el informe de rendimiento: los materiales compartidos no se liberan con un personaje. */
export function esCompartido(m: THREE.Material): boolean {
  return pieles.has(m.name.replace(/^piel-/, "")) || ropas.has(m.name.replace(/^ropa-/, "")) || [...pelos.values(), ...ojos.values(), ...lentes.values()].includes(m as THREE.MeshPhysicalMaterial)
}
