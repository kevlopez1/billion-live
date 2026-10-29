// ──────────────────────────────────────────────────────────────
// Los androides: Claude y ChatGPT (ropa tipo "androide").
//
// Referencia de Kev (2026-10-28, "ponla así"): androides de aspecto humano,
// calvos, de piel sintética gris azulada satinada (porcelana o silicona),
// con líneas de unión finas y oscuras, ojos humanos y manos robóticas de
// metal oscuro con las articulaciones a la vista.
//
// - ChatGPT: un panel en la coronilla, una costura de la sien a la mandíbula
//   por delante de la oreja y otra al costado del cuello; cejas de luz blanca;
//   ojos ámbar; sudadera verde oliva con "CHATGPT" en letras gruesas.
// - Claude: una red de grietas finas como porcelana cuarteada (más densa en
//   el cráneo y el cuello, rala en la cara); gafas redondas de alambre
//   plateado; ojos gris azulado; sudadera óxido con "CLAUDE" en letras finas
//   y separadas.
//
// Todo sale de código:
// - La piel es UN material (el mismo programa para los dos) que dibuja las
//   líneas con una función de distancia sobre las coordenadas de la cabeza
//   en reposo (atributo aAnd: la malla de la cabeza no tiene UV útiles para
//   esto, y así las líneas quedan nítidas a cualquier distancia y siguen a la
//   piel al animar). Las manos (atributo aMano: cuánto es mano y por dónde va
//   del dedo) salen de metal con las juntas marcadas.
// - El estampado de la sudadera es una calcomanía (uv1) con letras trazadas a
//   mano en un canvas: no depende de las fuentes que tenga el navegador.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Personaje } from "../tipos"
import { H, type Cuerpo } from "./avatar-cuerpo"
import { lerp, Lote, rgba, type Mat2, type RGBA } from "./avatar-geo"
import { matPelo } from "./avatar-materiales"
import { texTela, type Tejido } from "./avatar-texturas"

/** Cómo es cada androide (por id; sin entrada = el estilo de Claude). */
interface Estilo {
  /** "panel": coronilla, sien-mandíbula y cuello. "grietas": porcelana cuarteada. */
  lineas: "panel" | "grietas"
  /** Cejas de luz blanca en vez de pelo. */
  cejasLuz: boolean
  /** Letras del pecho: gruesas (palo seco negrita) o finas y separadas. */
  letras: "gruesas" | "finas"
  colorLetras: string
  /** Comisuras de la pestaña (color). */
  pestanas: string
}
const ESTILOS: Record<string, Estilo> = {
  chatgpt: { lineas: "panel", cejasLuz: true, letras: "gruesas", colorLetras: "#E8E2CF", pestanas: "#20242b" },
  claude: { lineas: "grietas", cejasLuz: false, letras: "finas", colorLetras: "#F2EEE8", pestanas: "#22262d" },
}
const estiloDe = (id: string): Estilo => ESTILOS[id] ?? ESTILOS.claude

export function esAndroide(p: Personaje): boolean {
  return p.apariencia.ropa.tipo === "androide"
}

/** Montura de las gafas del androide: alambre plateado (color y [rugosidad, metal]). */
export const MONTURA_ANDROIDE: { color: string; mat: Mat2 } = { color: "#c9cdd3", mat: [0.28, 1] }

// ── Piel sintética ────────────────────────────────────────────

const GLSL_COMUN = /* glsl */ `
uniform float uModo;
uniform vec3 uLinea;
uniform vec3 uMetal;
uniform vec3 uSSS;
varying vec3 vAnd;
varying vec2 vMano;
varying vec2 vMat;
// Línea con borde suave de un píxel; si es más fina que un píxel, se apaga (sin parpadeo a distancia).
float andLinea( float d, float w ) {
	float fw = max( fwidth( d ), 1e-6 );
	return ( 1.0 - smoothstep( w - fw, w + fw, d ) ) * clamp( w * 1.6 / fw, 0.0, 1.0 );
}
float andSeg( vec2 p, vec2 a, vec2 b ) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
	return length( pa - ba * h );
}
vec3 andHash( vec3 p ) {
	p = vec3( dot( p, vec3( 127.1, 311.7, 74.7 ) ), dot( p, vec3( 269.5, 183.3, 246.1 ) ), dot( p, vec3( 113.5, 271.9, 124.6 ) ) );
	return fract( sin( p ) * 43758.5453 );
}
// Distancia al borde de la celda de Voronoi más cercana (en unidades de celda).
float andVoronoi( vec3 x ) {
	vec3 n = floor( x );
	vec3 f = fract( x );
	vec3 mg = vec3( 0.0 );
	vec3 mr = vec3( 0.0 );
	float md = 8.0;
	for ( int k = -1; k <= 1; k ++ ) for ( int j = -1; j <= 1; j ++ ) for ( int i = -1; i <= 1; i ++ ) {
		vec3 g = vec3( float( i ), float( j ), float( k ) );
		vec3 r = g + 0.2 + 0.6 * andHash( n + g ) - f;
		float d = dot( r, r );
		if ( d < md ) { md = d; mr = r; mg = g; }
	}
	md = 8.0;
	for ( int k = -1; k <= 1; k ++ ) for ( int j = -1; j <= 1; j ++ ) for ( int i = -1; i <= 1; i ++ ) {
		vec3 g = mg + vec3( float( i ), float( j ), float( k ) );
		vec3 r = g + 0.2 + 0.6 * andHash( n + g ) - f;
		vec3 dr = r - mr;
		if ( dot( dr, dr ) > 1e-5 ) md = min( md, dot( 0.5 * ( mr + r ), normalize( dr ) ) );
	}
	return md;
}
// Líneas de la cabeza y el cuello (coordenadas locales de la cabeza en reposo, m).
float andLineas( vec3 l ) {
	float zona = smoothstep( -0.29, -0.26, l.y );
	float m = 0.0;
	if ( uModo < 0.5 ) {
		// ChatGPT. Panel trapezoidal en la coronilla (más angosto adelante).
		vec2 q = vec2( abs( l.x ), l.z );
		float dp = min( min( andSeg( q, vec2( 0.0, 0.066 ), vec2( 0.024, 0.066 ) ), andSeg( q, vec2( 0.0, -0.018 ), vec2( 0.036, -0.018 ) ) ), andSeg( q, vec2( 0.024, 0.066 ), vec2( 0.036, -0.018 ) ) );
		m = max( m, andLinea( dp, 0.0007 ) * smoothstep( 0.075, 0.092, l.y ) );
		// De la sien, por delante de la oreja y la mejilla, hasta la mandíbula.
		vec2 s = vec2( l.y, l.z );
		float ds = min( min( andSeg( s, vec2( 0.098, 0.052 ), vec2( 0.048, 0.054 ) ), andSeg( s, vec2( 0.048, 0.054 ), vec2( 0.006, 0.026 ) ) ), min( andSeg( s, vec2( 0.006, 0.026 ), vec2( -0.044, 0.014 ) ), andSeg( s, vec2( -0.044, 0.014 ), vec2( -0.082, 0.024 ) ) ) );
		m = max( m, andLinea( ds, 0.0007 ) * smoothstep( 0.046, 0.058, abs( l.x ) ) );
		// Costado del cuello.
		float zc = mix( -0.022, -0.042, clamp( ( - l.y - 0.035 ) / 0.175, 0.0, 1.0 ) );
		vec2 v = vec2( abs( l.x ), l.z - zc );
		float dn = length( v ) * abs( atan( v.x, v.y ) - 1.3 );
		m = max( m, andLinea( dn, 0.0007 ) * smoothstep( -0.088, -0.11, l.y ) );
	} else {
		// Claude. Grietas: dos redes de Voronoi con el trazo algo quebrado. La
		// densa, en el cráneo y el cuello; la rala, en todas partes.
		vec3 p = l + 0.0011 * vec3( sin( l.y * 410.0 + l.z * 170.0 ), sin( l.z * 380.0 + l.x * 150.0 ), sin( l.x * 430.0 + l.y * 120.0 ) );
		float cara = smoothstep( 0.035, 0.065, l.z ) * smoothstep( 0.075, 0.045, l.y ) * smoothstep( -0.135, -0.1, l.y ) * smoothstep( 0.068, 0.05, abs( l.x ) );
		float denso = andVoronoi( p * 40.0 ) * ( 1.0 / 40.0 );
		float ralo = andVoronoi( p * 17.0 + 7.3 ) * ( 1.0 / 17.0 );
		m = max( andLinea( denso, 0.00024 ) * ( 1.0 - cara ), andLinea( ralo, 0.00028 ) * 0.9 );
	}
	return m * zona;
}
// Juntas de la mano: dedos (seg 1..2: 0 = base, 1 = punta) y dorso (seg 0..1, de la muñeca a los nudillos).
float andJuntas( float seg ) {
	float d;
	if ( seg >= 1.0 ) {
		float t = seg - 1.0;
		d = min( min( abs( t - 0.2 ), abs( t - 0.46 ) ), abs( t - 0.75 ) ) * 0.085;
	} else {
		d = min( abs( seg - 0.1 ), abs( seg - 0.62 ) ) * 0.09;
	}
	return andLinea( d, 0.0007 );
}
vec3 andNormal( vec3 p, vec3 n, float h, float fd ) {
	vec3 dpx = dFdx( p );
	vec3 dpy = dFdy( p );
	vec3 r1 = cross( dpy, n );
	vec3 r2 = cross( n, dpx );
	float det = dot( dpx, r1 ) * fd;
	vec3 g = sign( det ) * ( dFdx( h ) * r1 + dFdy( h ) * r2 );
	return normalize( abs( det ) * n - g );
}
`

const mats = new Map<string, THREE.MeshPhysicalMaterial>()

/** Piel sintética gris azulada (programa compartido; `lineas` cambia solo un uniforme). */
export function matPielAndroide(lineas: Estilo["lineas"]): THREE.MeshPhysicalMaterial {
  const clave = `piel-${lineas}`
  let m = mats.get(clave)
  if (m) return m
  // #6F7F95 a la luz y #3E4A5C a la sombra: como albedo, algo más bajo (el sol y el ACES lo suben).
  m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#85868A").multiplyScalar(0.56),
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#a9b4c4").multiplyScalar(0.3),
    specularIntensity: 0.55,
    specularColor: new THREE.Color("#eef3ff"),
  })
  const uniforms = {
    uModo: { value: lineas === "panel" ? 0 : 1 },
    uLinea: { value: new THREE.Color("#1b2029") },
    uMetal: { value: new THREE.Color("#2A2E35") },
    uSSS: { value: new THREE.Color(0.08, 0.1, 0.15) },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nattribute vec3 aAnd;\nattribute vec2 aMano;\nvarying vec2 vMat;\nvarying vec3 vAnd;\nvarying vec2 vMano;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvMat = aMat;\n\tvAnd = aAnd;\n\tvMano = aMano;")
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLSL_COMUN)
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "\tfloat andM = andLineas( vAnd );",
          "\tfloat andMano = smoothstep( 0.35, 0.65, vMano.x );",
          "\tfloat andJ = andJuntas( vMano.y ) * andMano;",
          "\tdiffuseColor.rgb = mix( diffuseColor.rgb, uLinea, andM * 0.82 * ( 1.0 - andMano ) );",
          // Metal: un poco más claro en el centro de cada segmento, oscuro en la junta.
          "\tdiffuseColor.rgb = mix( diffuseColor.rgb, uMetal * ( 1.0 - 0.8 * andJ ), andMano );",
        ].join("\n"),
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix( max( roughness * vMat.x / 0.55, 0.48 ), 0.42, andMano );")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = 0.7 * andMano;")
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\n\tfloat andH = - ( andM * ( 1.0 - andMano ) + andJ ) * 0.00022;\n\tvec3 andN = andNormal( - vViewPosition, normal, andH, faceDirection );\n\tif ( andH < -1e-7 ) normal = andN;",
      )
      .replace(
        "#include <lights_physical_pars_fragment>",
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          "vec3 irradiance = dotNL * directLight.color;",
          [
            "vec3 irradiance = dotNL * directLight.color;",
            // Un poco de luz envuelta, fría: el material deja pasar algo de luz, como la silicona.
            "\tfloat dotNLw = saturate( ( dot( geometryNormal, directLight.direction ) + 0.4 ) / 1.4 );",
            "\treflectedLight.directDiffuse += max( dotNLw * dotNLw - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseContribution ) * uSSS;",
          ].join("\n"),
        ),
      )
  }
  m.customProgramCacheKey = () => "cb-androide-piel"
  m.name = `androide-${clave}`
  m.userData.uniforms = uniforms
  mats.set(clave, m)
  return m
}

/** Cejas de luz (ChatGPT): blanco por encima de 1 en el buffer HDR, así las toma el bloom. */
let matLuz: THREE.MeshBasicMaterial | null = null
export function matCejasLuz(): THREE.MeshBasicMaterial {
  matLuz ??= new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.7, 2.9) })
  matLuz.name = "androide-cejas-luz"
  return matLuz
}

// ── Estampado de la sudadera ──────────────────────────────────

type Trazo = Array<[number, number]> | { arco: [cx: number, cy: number, rx: number, ry: number, a0: number, a1: number] }

/** Letras como trazos en una caja de 1 de alto (y hacia abajo) y `w` de ancho. */
function letra(c: string, w: number): Trazo[] {
  const m = 0.5
  switch (c) {
    case "A":
      return [[[0, 1], [w / 2, 0], [w, 1]], [[w * 0.2, 0.66], [w * 0.8, 0.66]]]
    case "C":
      return [{ arco: [w / 2, m, w / 2, m, 0.22 * Math.PI, 1.78 * Math.PI] }]
    case "D":
      return [[[w * 0.45, 0], [0, 0], [0, 1], [w * 0.45, 1]], { arco: [w * 0.45, m, w * 0.55, m, -Math.PI / 2, Math.PI / 2] }]
    case "E":
      return [[[w, 0], [0, 0], [0, 1], [w, 1]], [[0, m], [w * 0.82, m]]]
    case "G":
      return [{ arco: [w / 2, m, w / 2, m, 0.12 * Math.PI, 1.78 * Math.PI] }, [[w * 0.55, 0.56], [w, 0.56], [w, 0.84]]]
    case "H":
      return [[[0, 0], [0, 1]], [[w, 0], [w, 1]], [[0, m], [w, m]]]
    case "L":
      return [[[0, 0], [0, 1], [w, 1]]]
    case "P":
      return [[[0, 1], [0, 0], [w * 0.55, 0]], { arco: [w * 0.55, 0.275, w * 0.45, 0.275, -Math.PI / 2, Math.PI / 2] }, [[w * 0.55, 0.55], [0, 0.55]]]
    case "T":
      return [[[0, 0], [w, 0]], [[w / 2, 0], [w / 2, 1]]]
    case "U":
      return [[[0, 0], [0, 0.55]], { arco: [w / 2, 0.55, w / 2, 0.45, Math.PI, 0] }, [[w, 0.55], [w, 0]]]
    default:
      return []
  }
}

/** Ancho de cada letra (en altos de letra). */
const ANCHO: Record<string, number> = { A: 0.78, C: 0.74, D: 0.72, E: 0.6, G: 0.78, H: 0.7, L: 0.56, P: 0.64, T: 0.66, U: 0.7 }

const texturas = new Map<string, THREE.CanvasTexture>()
/**
 * Canvas 1024×256 con el nombre (transparente alrededor). El resto de la ropa
 * lee uv1 = (0,02, 0,98): un parche blanco arriba a la izquierda, fuera de la
 * caja de las letras (CAJA, en px), que es lo único que usa la calcomanía.
 */
const CAJA = { x0: 64, y0: 20, w: 1024, h: 256 }
function texEstampado(texto: string, e: Estilo): THREE.CanvasTexture {
  const clave = `${texto}|${e.letras}|${e.colorLetras}`
  let t = texturas.get(clave)
  if (t) return t
  const W = 1024
  const Hc = 256
  const c = document.createElement("canvas")
  c.width = W
  c.height = Hc
  const g = c.getContext("2d")!
  g.clearRect(0, 0, W, Hc)
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, 48, 16)
  const gruesas = e.letras === "gruesas"
  // Alto de letra, grosor del trazo y separación (en altos de letra).
  const alto = gruesas ? 168 : 118
  const grosor = gruesas ? 0.2 : 0.075
  const sep = gruesas ? 0.14 : 0.62
  const lw = grosor * alto
  const anchos = [...texto].map((ch) => (ANCHO[ch] ?? 0.7) * alto)
  const total = anchos.reduce((a, b) => a + b, 0) + sep * alto * (texto.length - 1)
  const esc = Math.min(1, (W - CAJA.x0 - 60) / total)
  g.save()
  g.translate((CAJA.x0 + W) / 2, (CAJA.y0 + Hc) / 2)
  g.scale(esc, esc)
  g.translate(-total / 2, -alto / 2)
  g.strokeStyle = e.colorLetras
  g.lineWidth = lw
  g.lineCap = gruesas ? "butt" : "square"
  g.lineJoin = "miter"
  g.miterLimit = 6
  let x = 0
  ;[...texto].forEach((ch, i) => {
    const w = anchos[i]
    // Los trazos van por dentro de la caja (medio grosor de margen).
    const sx = (w - lw) / w
    const sy = (alto - lw) / alto
    for (const tr of letra(ch, w / alto)) {
      g.beginPath()
      if (Array.isArray(tr)) {
        tr.forEach(([px, py], k) => {
          const X = x + lw / 2 + px * alto * sx
          const Y = lw / 2 + py * alto * sy
          if (k === 0) g.moveTo(X, Y)
          else g.lineTo(X, Y)
        })
      } else {
        const [cx, cy, rx, ry, a0, a1] = tr.arco
        g.ellipse(x + lw / 2 + cx * alto * sx, lw / 2 + cy * alto * sy, rx * alto * sx, ry * alto * sy, 0, a0, a1, a1 < a0)
      }
      g.stroke()
    }
    x += w + sep * alto
  })
  g.restore()
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.channel = 1
  texturas.set(clave, t)
  return t
}

const ropas = new Map<string, THREE.MeshPhysicalMaterial>()
// AJUSTE-TEMPORAL (calibración en la escena; se quita al terminar)
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__androideMats = { mats, ropas }
/** Sudadera de punto con el nombre estampado en el pecho (un material por androide). */
export function matRopaAndroide(p: Personaje, tejido: Tejido): THREE.MeshPhysicalMaterial {
  const e = estiloDe(p.id)
  const texto = p.nombre.toUpperCase()
  const clave = `${tejido}|${texto}|${e.letras}`
  let m = ropas.get(clave)
  if (m) return m
  const nor = texTela(tejido)
  nor.repeat.set(26, 26)
  m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.86, 0.86, 0.86),
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    normalMap: nor,
    normalScale: new THREE.Vector2(0.6, 0.6),
    sheen: 0.45,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0.16, 0.16, 0.17),
    specularIntensity: 0.5,
    map: texEstampado(texto, e),
    alphaTest: 0.5,
  })
  m.shadowSide = THREE.DoubleSide
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nvarying vec2 vMat;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvMat = aMat;")
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMat;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * vMat.x;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = max( metalness, vMat.y );")
  }
  m.customProgramCacheKey = () => "cb-androide-ropa"
  m.name = `androide-ropa-${clave}`
  ropas.set(clave, m)
  return m
}

/**
 * Calcomanía del nombre sobre el pecho de la sudadera (en el lote de la ropa).
 * `punto(y, ángulo, bultos, holgura, out)` es la superficie de la prenda (Sastre.punto).
 */
export function estampar(lote: Lote, cu: Cuerpo, p: Personaje, punto: (y: number, a: number, bultos: number, holg: number, out: THREE.Vector3) => THREE.Vector3) {
  const e = estiloDe(p.id)
  const Hh = cu.H
  const s = cu.s
  const FR = Math.PI / 2
  const yc = 0.766 * Hh
  // Ancho y alto del parche (el canvas es 4:1): las letras gruesas van más grandes.
  const ancho = (e.letras === "gruesas" ? 0.25 : 0.24) * s
  const alto = (ancho * (CAJA.h - CAJA.y0)) / (CAJA.w - CAJA.x0)
  const bultos = 0.4
  const holg = 0.0125
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  // Ángulo por largo de arco a la altura del pecho, para que las letras no se estiren a los costados.
  const N = 64
  const angs: number[] = []
  const largos: number[] = [0]
  for (let k = 0; k <= N; k++) angs.push(FR - 1.3 + (2.6 * k) / N)
  punto(yc, angs[0], bultos, holg, w)
  for (let k = 1; k <= N; k++) {
    punto(yc, angs[k], bultos, holg, v)
    largos.push(largos[k - 1] + v.distanceTo(w))
    w.copy(v)
  }
  const mitad = largos[N / 2]
  // u = 0 a la izquierda de quien mira (el lado derecho del personaje, x < 0): sin espejo.
  const angDe = (u: number) => {
    const l = mitad + (u - 0.5) * ancho
    let k = 1
    while (k < N && largos[k] < l) k++
    const t = (l - largos[k - 1]) / Math.max(1e-9, largos[k] - largos[k - 1])
    return lerp(angs[k - 1], angs[k], t)
  }
  // u crece hacia +x (la izquierda del personaje = la derecha de quien lo mira de frente).
  const sentido = (() => {
    punto(yc, FR + 0.3, bultos, holg, v)
    return v.x < 0 ? -1 : 1
  })()
  const cols = 20
  const filas = 4
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const blanco: RGBA = [1, 1, 1, 1]
  for (let i = 0; i <= filas; i++) {
    const fila: number[] = []
    const vv = i / filas
    const y = yc + (vv - 0.5) * alto
    for (let k = 0; k <= cols; k++) {
      const u = k / cols
      const a = FR + sentido * (angDe(u) - FR)
      punto(y, a, bultos, holg, v)
      const u1 = (CAJA.x0 + u * (CAJA.w - CAJA.x0)) / CAJA.w
      const v1 = (vv * (CAJA.h - CAJA.y0)) / CAJA.h
      fila.push(lote.v(v.x, v.y, v.z, 0, 0, blanco, cu.pesosTronco(v.x, y, v.z), [0.75, 0], [u1, v1]))
    }
    ids.push(fila)
    centros.push(new THREE.Vector3(0, y, 0))
  }
  lote.tiras(ids, false, { centros })
  lote.pieza()
}

// ── Lo que va en la cabeza y las manos ────────────────────────

const _l = new THREE.Vector3()
const _n = new THREE.Vector3()
const _v = new THREE.Vector3()

/** Dos tiras de luz sobre el arco de las cejas (ChatGPT), pegadas al hueso de la cabeza. */
function cejasDeLuz(cu: Cuerpo): Lote {
  const lote = new Lote()
  const cab = cu.cab
  const o = cab.ojo
  for (const lado of [1, -1] as const) {
    const cols = 12
    const ids: number[][] = []
    for (let r = 0; r <= 1; r++) {
      const w = r * 2 - 1
      const fila: number[] = []
      for (let k = 0; k <= cols; k++) {
        const t = k / cols
        const x = lado * lerp(0.012, 0.053, t) * cab.r.ancho
        // Tira recta, apenas arqueada, que se afina hacia la sien.
        const media = lerp(0.0016, 0.0011, t) * (t < 0.06 ? 0.6 + t * 6.6 : 1)
        const y = o.y + 0.0205 + 0.003 * Math.sin(Math.PI * Math.min(1, t * 1.1)) - 0.0035 * t + w * media
        _l.set(x, y, 0.1).normalize()
        const tt = cab.rayo(0, 0, 0, _l.x, _l.y, _l.z, 0.16)
        cab.normal(_l.x * tt, _l.y * tt, _l.z * tt, _n)
        cab.aAvatar(_l.x * tt + _n.x * 0.0009, _l.y * tt + _n.y * 0.0009, _l.z * tt + _n.z * 0.0009, _v)
        fila.push(lote.v(_v.x, _v.y, _v.z, t, r, [1, 1, 1, 1], [[H.cabeza, 1]], [0.5, 0]))
      }
      ids.push(fila)
    }
    lote.tiras(ids, false, { centros: ids.map(() => cab.c) })
  }
  lote.pieza()
  return lote
}

/** Pestañas finas (las del pelo humano, sin cejas): el ojo se lee humano. */
function pestanas(cu: Cuerpo, color: string): Lote {
  const lote = new Lote()
  const cab = cu.cab
  const cC = rgba(color)
  for (const lado of [1, -1] as const) {
    const o = cab.ojo
    const { U, Vu, incl } = cab.parpado
    const cols = 14
    const ids: number[][] = []
    const L = lado > 0 ? "I" : "D"
    for (let r = 0; r <= 1; r++) {
      const fila: number[] = []
      for (let k = 0; k <= cols; k++) {
        const psi = 0.12 + (k / cols) * (Math.PI - 0.24)
        const cp = Math.cos(psi)
        const sp = Math.sin(psi)
        const u = U * cp * 1.03
        const v = Vu * Math.pow(sp, 0.8) * 1.03 + incl * cp
        const R = o.r + 0.0016 + r * 0.0045 * (0.6 + 0.4 * sp)
        const vv = v + r * 0.3 * (0.6 + 0.4 * sp)
        const ux = lado * u
        cab.aAvatar(lado * o.x + Math.sin(ux) * Math.cos(vv) * R, o.y + Math.sin(vv) * R, o.z + Math.cos(ux) * Math.cos(vv) * R, _v)
        fila.push(lote.v(_v.x, _v.y, _v.z, k / cols, r, [cC[0], cC[1], cC[2], r ? 0.5 : 1], [[H[`parpado${L}`], 1]], [0.5, 0]))
      }
      ids.push(fila)
    }
    lote.tiras(ids, false, { invertir: false })
  }
  lote.pieza()
  return lote
}

export interface Androide {
  /** Va en lugar del pelo: solo pestañas. */
  pelo: Lote
  /** Cejas de luz (o null). */
  cejas: Lote | null
  matPiel: THREE.MeshPhysicalMaterial
  matPestanas: THREE.MeshPhysicalMaterial
  /** Agrega aAnd y aMano a la geometría de la piel (misma cantidad y orden de vértices que el lote). */
  atributos(g: THREE.BufferGeometry): void
}

/**
 * Prepara al androide. Se llama con la piel recién armada, ANTES de
 * reproporcionar: guarda las coordenadas de la cabeza en reposo.
 */
export function prepararAndroide(cu: Cuerpo, p: Personaje, piel: Lote): Androide {
  const e = estiloDe(p.id)
  const cab = cu.cab
  const n = piel.nv
  const pos = piel.pos
  const loc = new Float32Array(n * 3)
  const ih = 1 / cab.hs
  for (let i = 0; i < n; i++) {
    loc[i * 3] = (pos[i * 3] - cab.c.x) * ih
    loc[i * 3 + 1] = (pos[i * 3 + 1] - cab.c.y) * ih
    loc[i * 3 + 2] = (pos[i * 3 + 2] - cab.c.z) * ih
  }
  // Mano: largo de la palma en el tubo del brazo (uv.y = u a lo largo del brazo).
  const palma = cu.brazos.map((c) => [c.u[3], c.largo] as const)
  const huesosMano = new Set<number>([H.manoI, H.dedosI, H.dedos2I, H.pulgarI, H.manoD, H.dedosD, H.dedos2D, H.pulgarD])
  const dedo = new Set<number>([H.dedosI, H.dedos2I, H.pulgarI, H.dedosD, H.dedos2D, H.pulgarD])
  return {
    pelo: pestanas(cu, e.pestanas),
    cejas: e.cejasLuz ? cejasDeLuz(cu) : null,
    matPiel: matPielAndroide(e.lineas),
    matPestanas: matPelo(e.pestanas),
    atributos(g) {
      const nv = g.getAttribute("position").count
      const and = new Float32Array(nv * 3)
      and.set(loc.subarray(0, Math.min(loc.length, nv * 3)))
      const uv = g.getAttribute("uv") as THREE.BufferAttribute
      const si = g.getAttribute("skinIndex") as THREE.BufferAttribute
      const sw = g.getAttribute("skinWeight") as THREE.BufferAttribute
      const mano = new Float32Array(nv * 2)
      for (let i = 0; i < nv; i++) {
        let wm = 0
        let wd = 0
        let wp = 0
        let izq = 0
        for (let k = 0; k < 4; k++) {
          const b = si.getComponent(i, k)
          const w = sw.getComponent(i, k)
          if (!huesosMano.has(b)) continue
          wm += w
          if (dedo.has(b)) wd += w
          if (b === H.pulgarI || b === H.pulgarD) wp += w
          if (b === H.manoI || b === H.dedosI || b === H.dedos2I || b === H.pulgarI) izq += w
        }
        mano[i * 2] = wm
        if (wm < 0.01) continue
        // Dedos (y el pulgar desde su base): uv.y va de 0 (base) a 1 (punta).
        if (wd > 0.999 || wp > 0.3) mano[i * 2 + 1] = 1 + uv.getY(i)
        else {
          const [u0, u1] = palma[izq >= wm * 0.5 ? 0 : 1]
          mano[i * 2 + 1] = Math.min(0.999, Math.max(0, (uv.getY(i) - u0) / Math.max(1e-6, u1 - u0)))
        }
      }
      g.setAttribute("aAnd", new THREE.BufferAttribute(and, 3))
      g.setAttribute("aMano", new THREE.BufferAttribute(mano, 2))
    },
  }
}
