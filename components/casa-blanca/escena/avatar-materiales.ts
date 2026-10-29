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
import { TELA_REPETIR, texArrugas, texNumero, texOjo, texPelo, texPielColor, texPielNormal, texRizos, texRizosDir, texTelas, type Tejido } from "./avatar-texturas"

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
        .replace("#include <color_fragment>", "#include <color_fragment>\n\tvec4 arrW = texture2D( uArrugas, vArr.xy );\n\tfloat arrH = arrW.r * vArr.z + arrW.g * vArr.w;\n\tdiffuseColor.rgb *= ( 1.0 - 0.16 * arrH ) * ( 1.0 - 0.7 * arrW.b );")
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
  // El tono de la ficha es la piel "como se ve"; como albedo, una piel clara
  // refleja bastante menos (si no, el sol y el ACES la queman a blanco y se
  // pierde el tono). Se baja la luminancia de las pieles claras y se les
  // devuelve un poco de saturación; las oscuras quedan casi igual, menos el
  // naranja.
  //
  // Calibrado con el banco de ajuste (2026-10-28): se midió el color de la
  // mejilla al sol (9:00 y 12:00, cámara 3/4) de los 22 residentes con cinco
  // escalas de albedo y se buscó, por canal, el albedo que da el tono de la
  // ficha. El cielo azul (hemisferio + entorno) y el hombro del ACES lavan las
  // pieles claras hacia el blanco: hay que bajarles el azul y el verde (más
  // croma). Las oscuras salían algo rojas (la dispersión y el rubor): se
  // bajan parejo, un poco más el rojo. Y = luminancia lineal del tono.
  const Y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  const t = Math.pow(THREE.MathUtils.clamp((Y - 0.1) / 0.5, 0, 1), 1.5)
  const gR = THREE.MathUtils.lerp(0.6, 0.9, t)
  const alb = new THREE.Color(c.r * gR, c.g * gR * THREE.MathUtils.lerp(1.12, 0.75, t), c.b * gR * THREE.MathUtils.lerp(1.08, 0.64, t))
  m = new THREE.MeshPhysicalMaterial({
    color: alb,
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
  const k = 0.25 + 0.5 * hsl.l
  inyectar(m, new THREE.Color(0.95 * k, 0.32 * k, 0.2 * k))
  m.name = `piel-${color}`
  pieles.set(color, m)
  return m
}

// ── Ropa ──────────────────────────────────────────────────────
// Por vértice (aArr): x = tela (capa de texTelas), y = pliegue (tipo + 2·fuerza
// en la parte decimal), z, w = coordenadas del pliegue (a lo largo, alrededor).
// Por tela: repetición física, fuerza del relieve, terciopelo (sheen, teñido con
// el color de la prenda) y barniz (cuero de vestir, charol).
const N_TELAS = 16
const fl = (a: number[]) => `float[${N_TELAS}]( ${a.map((x) => x.toFixed(3)).join(", ")} )`
const TELA_NORMAL = [0.65, 0.35, 0.55, 1.0, 0.5, 0.75, 0.55, 0.4, 0.5, 0.8, 1.0, 0.6, 0, 0, 0, 0.5]
const TELA_SHEEN = [0.55, 0.22, 0.4, 0.75, 0.22, 0.3, 0.85, 0.35, 0.0, 0.2, 0.65, 0.0, 0.0, 0, 0.0, 0.9]
// Especular por tela (la tela mate no tiene brillo puntual: la camisa blanca se quemaba en el cuello).
const TELA_ESPEC = [0.7, 0.45, 0.5, 0.4, 0.5, 0.5, 0.35, 1, 1, 0.6, 0.4, 0.6, 1, 1, 1, 0.35]
const TELA_BARNIZ = [0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0.75, 0]

const GLSL_ROPA_PARS = /* glsl */ `
uniform sampler2DArray uTelas;
varying vec4 vTela;
varying vec2 vTelaUv;
const float TELA_REP[${N_TELAS}] = ${fl(TELA_REPETIR)};
const float TELA_NOR[${N_TELAS}] = ${fl(TELA_NORMAL)};
const float TELA_SHE[${N_TELAS}] = ${fl(TELA_SHEEN)};
const float TELA_BAR[${N_TELAS}] = ${fl(TELA_BARNIZ)};
const float TELA_ESP[${N_TELAS}] = ${fl(TELA_ESPEC)};
float plA( float x ) { float q = sin( x ); return sqrt( q * q + 0.03 ) - 0.17; }
// Altura de los pliegues (0..~0,85) según el tipo y la posición en la prenda.
float pliegueH( float tipo, float s, float t ) {
	float h = 0.0;
	if ( tipo < 1.5 ) {
		// Manga: s = u / u(codo); t = ángulo (pi/2 = pliegue del codo).
		float fr = pow( max( 0.0, sin( t ) ), 1.5 );
		float codo = exp( - pow( ( s - 1.0 ) / 0.17, 2.0 ) );
		h += codo * fr * 0.5 * ( plA( ( s - 1.0 ) * 17.0 + ( t - 1.5708 ) * 2.4 ) + plA( ( s - 1.0 ) * 17.0 - ( t - 1.5708 ) * 2.4 ) );
		h += smoothstep( 1.55, 1.85, s ) * 0.7 * plA( s * 34.0 + 0.7 * sin( t * 2.0 ) );
		h += exp( - pow( ( s - 0.2 ) / 0.13, 2.0 ) ) * max( 0.0, - cos( t ) ) * 0.7 * plA( s * 15.0 + t * 1.6 );
		h += 0.08 * ( 1.0 + sin( t * 3.0 + s * 9.0 ) );
	} else if ( tipo < 2.5 ) {
		// Pernera: s = u / u(rodilla); t = ángulo (pi/2 = adelante).
		float atras = max( 0.0, - sin( t ) );
		float fr = max( 0.0, sin( t ) );
		h += exp( - pow( ( s - 1.0 ) / 0.15, 2.0 ) ) * pow( atras, 1.2 ) * plA( ( s - 1.0 ) * 22.0 + 0.9 * cos( t ) );
		h += exp( - pow( ( s - 0.2 ) / 0.15, 2.0 ) ) * smoothstep( 0.1, 0.8, fr ) * 0.8 * plA( s * 19.0 - ( t - 1.5708 ) * 3.2 );
		h += smoothstep( 1.75, 1.97, s ) * ( 0.4 + 0.6 * fr ) * plA( s * 27.0 + 0.6 * sin( t ) );
		h += 0.06 * ( 1.0 + sin( t * 3.0 + s * 4.0 ) );
	} else if ( tipo < 3.5 ) {
		// Torso: s = y / estatura; t = ángulo (pi/2 = adelante, 0 y pi = costados).
		float lado = pow( abs( cos( t ) ), 2.0 );
		h += exp( - pow( ( s - 0.615 ) / 0.035, 2.0 ) ) * 0.5 * plA( t * 11.0 + s * 18.0 + 0.8 * sin( t * 3.0 ) );
		h += exp( - pow( ( s - 0.725 ) / 0.045, 2.0 ) ) * lado * 0.8 * plA( s * 34.0 + abs( sin( t ) ) * 5.0 );
		h += 0.08 * ( 1.0 + sin( t * 5.0 + s * 11.0 + 0.6 * sin( t * 2.3 ) ) );
	} else if ( tipo < 4.5 ) {
		// Caída (faldas, túnicas, capas): pliegues casi verticales que crecen hacia el ruedo.
		float g = 0.35 + 0.65 * smoothstep( 0.62, 0.15, s );
		h += g * plA( t * 9.0 + 4.0 * s + 0.8 * sin( t * 3.0 + s * 7.0 ) );
		h += g * 0.45 * plA( t * 17.0 - 3.0 * s + 1.3 );
	} else {
		// Banda (manto cruzado): pliegues a lo largo. s = 0..1 a lo largo, t = -1..1 a lo ancho.
		h += plA( t * 4.7 + s * 6.0 + 0.5 * sin( s * 13.0 ) ) * 0.9 + 0.3 * plA( t * 9.0 - s * 3.0 );
	}
	return h;
}
// Relieve por derivadas de pantalla (sin tangentes): h en metros.
vec3 telaRelieve( vec3 p, vec3 n, float h, float fd ) {
	vec3 dpx = dFdx( p );
	vec3 dpy = dFdy( p );
	vec3 r1 = cross( dpy, n );
	vec3 r2 = cross( n, dpx );
	float det = dot( dpx, r1 ) * fd;
	vec3 g = sign( det ) * ( dFdx( h ) * r1 + dFdy( h ) * r2 );
	return normalize( abs( det ) * n - g );
}
mat3 telaTBN( vec3 p, vec3 n, vec2 uv ) {
	vec3 q0 = dFdx( p );
	vec3 q1 = dFdy( p );
	vec2 st0 = dFdx( uv );
	vec2 st1 = dFdy( uv );
	vec3 q1p = cross( q1, n );
	vec3 q0p = cross( n, q0 );
	vec3 T = q1p * st0.x + q0p * st1.x;
	vec3 B = q1p * st0.y + q0p * st1.y;
	float det = max( dot( T, T ), dot( B, B ) );
	float sc = det == 0.0 ? 0.0 : inversesqrt( det );
	return mat3( T * sc, B * sc, n );
}
`

/** Ropa: un solo material (las telas van por vértice). `numero`: textura con el número de camiseta (canal uv1). */
const ropas = new Map<string, THREE.MeshPhysicalMaterial>()
export function matRopa(_tejido: Tejido, numero?: { texto: string; relleno: string; borde: string }): THREE.MeshPhysicalMaterial {
  const clave = `telas|${numero ? `${numero.texto}${numero.relleno}${numero.borde}` : ""}`
  let m = ropas.get(clave)
  if (m) return m
  m = new THREE.MeshPhysicalMaterial({
    // Ninguna tela refleja más del ~85 %: una camisa blanca al sol se quemaba
    // a blanco y el resplandor (bloom) lavaba la cara de al lado.
    color: new THREE.Color(0.86, 0.86, 0.86),
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    // El terciopelo y el barniz se encienden aquí y cada tela dice cuánto (shader).
    sheen: 1,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(1, 1, 1),
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    specularIntensity: 0.5,
  })
  // Sombras de las dos caras: el ala de un sombrero, una cinta o el alambre de
  // unas gafas son láminas abiertas; con la cara de atrás sola, solo el contorno
  // proyectaba sombra y en la cara quedaban líneas como cicatrices.
  m.shadowSide = THREE.DoubleSide
  if (numero) {
    m.map = texNumero(numero.texto, numero.relleno, numero.borde)
    m.alphaTest = 0.5
  }
  const telas = texTelas()
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTelas = { value: telas }
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nvarying vec2 vMat;\nattribute vec4 aArr;\nvarying vec4 vTela;\nvarying vec2 vTelaUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvMat = aMat;\n\tvTela = aArr;\n\tvTelaUv = uv;")
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMat;\n" + GLSL_ROPA_PARS)
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "\tint telaC = int( vTela.x + 0.5 );",
          "\tvec4 telaT = texture( uTelas, vec3( vTelaUv * TELA_REP[ telaC ], float( telaC ) ) );",
          "\tvec4 telaM = texture( uTelas, vec3( vTelaUv * 2.0, 13.0 ) );",
          "\tfloat plTipo = floor( vTela.y );",
          "\tfloat plF = fract( vTela.y ) * 2.0;",
          "\tfloat plH = plTipo > 0.5 ? pliegueH( plTipo, vTela.z, vTela.w ) * plF : 0.0;",
          "\tdiffuseColor.rgb *= telaT.b * 2.0 * ( telaM.b * 2.0 ) * ( 1.0 - 0.22 * plF * ( 0.85 - plH ) * step( 0.5, plTipo ) );",
        ].join("\n"),
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = clamp( roughness * vMat.x * telaT.a * 2.0 * telaM.a * 2.0, 0.04, 1.0 );")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = max( metalness, vMat.y );")
      .replace(
        "#include <normal_fragment_maps>",
        [
          "#include <normal_fragment_maps>",
          "\tif ( plH > 0.0 ) normal = telaRelieve( - vViewPosition, normal, - plH * 0.0045, faceDirection );",
          "\tvec2 telaN = ( telaT.rg * 2.0 - 1.0 ) * TELA_NOR[ telaC ] + ( telaM.rg * 2.0 - 1.0 ) * 0.25;",
          "\tnormal = normalize( telaTBN( - vViewPosition, normal, vTelaUv ) * vec3( telaN, 1.0 ) );",
        ].join("\n"),
      )
      .replace(
        "#include <lights_physical_fragment>",
        [
          "#include <lights_physical_fragment>",
          // Terciopelo teñido con el color de la prenda (lana y punto: borde aterciopelado).
          "\tmaterial.sheenColor = TELA_SHE[ telaC ] * ( 0.08 + 0.92 * min( diffuseColor.rgb * 2.5, vec3( 1.0 ) ) ) * ( 1.0 - metalnessFactor );",
          "\tmaterial.clearcoat = TELA_BAR[ telaC ];",
          "\tmaterial.specularColorBlended *= TELA_ESP[ telaC ];",
          "\tmaterial.specularColor *= TELA_ESP[ telaC ];",
          "\tmaterial.specularF90 *= TELA_ESP[ telaC ];",
          "\tmaterial.clearcoatRoughness = telaC == 14 ? 0.1 : 0.25;",
        ].join("\n"),
      )
  }
  m.customProgramCacheKey = () => "cb-avatar-telas"
  m.name = `ropa-${clave}`
  ropas.set(clave, m)
  return m
}

const pelos = new Map<string, THREE.MeshPhysicalMaterial>()

// Sombreado del pelo (se inyecta en el MeshPhysical):
// - Brillo de Kajiya-Kay con dos lóbulos a lo largo de la hebra: la hebra es la
//   dirección de v en la UV de la tarjeta (en los rizos, la que trae texRizosDir),
//   sacada de las derivadas de pantalla (sin atributo nuevo). El primero, blanco,
//   corrido hacia la raíz y angosto; el segundo, teñido del color del pelo,
//   corrido hacia la punta, ancho y salpicado (lo enciende el brillo del mechón).
//   El brillo de cada mechón de la textura corre la banda: cada mechón brilla a
//   otra altura, como el pelo real.
// - Luz a través del pelo: de contraluz el contorno se enciende con el color del
//   pelo (la luz atraviesa las hebras), más en el borde de la silueta.
// - Luz indirecta entibiada (uTibio): el cielo azul ponía las canas menta y el pelo
//   negro azul marino. Con el sol bajo (luz naranja) se apaga, porque al
//   atardecer sumado al sol saturaba los rubios.
// - Borde con alfa a la cobertura (MSAA): la cobertura sigue al alfa en todo el
//   rango 0,24–0,8 (no un escalón en 0,42), así las hebras ralas del borde dejan
//   ver la piel y la línea del pelo se desvanece en vez de cortarse. Sin MSAA
//   (calidad media y baja) es un recorte en 0,27.
// - Capas de abajo opacas (aMat.y = 1): la textura no les abre huecos, así el
//   cielo y la piel no se ven a través de la masa del pelo.
const PELO_COMUN = [
  "uniform vec3 uTibio;",
  "uniform vec4 uKK;",
  "uniform vec4 uKK2;",
  "uniform vec3 uBrillo;",
  "#ifdef PELO_RIZOS",
  "uniform sampler2D uDirRizo;",
  "#endif",
  "varying float vKK;",
  "varying float vOpaco;",
  "vec3 gPeloT;",
  "float gPeloJ;",
  "float gPeloK;",
].join("\n")

const PELO_HEBRA = [
  "{",
  "\tvec3 pp = - vViewPosition;",
  "\tvec3 dp1 = dFdx( pp );",
  "\tvec3 dp2 = dFdy( pp );",
  "\tvec2 du1 = dFdx( vMapUv );",
  "\tvec2 du2 = dFdy( vMapUv );",
  "\tfloat sD = ( du1.x * du2.y - du2.x * du1.y ) >= 0.0 ? 1.0 : -1.0;",
  "\tvec3 pv = ( dp2 * du1.x - dp1 * du2.x ) * sD;",
  "#ifdef PELO_RIZOS",
  "\tvec3 pu = ( dp1 * du2.y - dp2 * du1.y ) * sD;",
  "\tvec2 dr = texture2D( uDirRizo, vMapUv ).rg * 2.0 - 1.0;",
  "\tpv = pu * dr.x + pv * dr.y;",
  "#endif",
  "\tpv -= normal * dot( pv, normal );",
  "\tgPeloT = dot( pv, pv ) > 1e-20 ? normalize( pv ) : vec3( 0.0, 1.0, 0.0 );",
  "\tgPeloJ = texture2D( map, vMapUv ).r;",
  // Cerca del remolino la UV gira sobre sí misma (la tangente no existe): sin brillo ahí.
  "\tfloat giroUV = max( fwidth( vMapUv.x ), fwidth( vMapUv.y ) );",
  "\tgPeloK = vKK * ( 1.0 - smoothstep( 0.08, 0.3, giroUV ) );",
  "}",
].join("\n")

const PELO_LUZ = [
  "vec3 irradiance = dotNL * directLight.color;",
  "\t{",
  "\t\tvec3 Lk = directLight.direction;",
  "\t\tvec3 Hk = normalize( Lk + geometryViewDir );",
  "\t\tfloat jk = ( gPeloJ - 0.72 ) * 0.9;",
  "\t\tvec3 T1 = normalize( gPeloT + geometryNormal * ( uKK.x + jk ) );",
  "\t\tvec3 T2 = normalize( gPeloT + geometryNormal * ( uKK.y + jk ) );",
  "\t\tfloat d1 = dot( T1, Hk );",
  "\t\tfloat d2 = dot( T2, Hk );",
  "\t\tfloat s1 = pow( max( 1.0 - d1 * d1, 0.0 ), uKK.z );",
  "\t\tfloat s2 = pow( max( 1.0 - d2 * d2, 0.0 ), uKK.w );",
  // Las hebras se tapan entre sí: el brillo solo del lado iluminado.
  "\t\tfloat visK = smoothstep( -0.15, 0.4, dot( geometryNormal, Lk ) );",
  // La luna (luz azul) brilla menos: con la exposición de la noche el pelo negro quedaba con una franja blanca.
  "\t\tvisK *= 1.0 - 0.5 * smoothstep( 1.1, 1.5, directLight.color.b / max( directLight.color.r, 1e-4 ) );",
  "\t\treflectedLight.directSpecular += ( uBrillo * s1 * uKK2.x + material.diffuseColor * s2 * uKK2.y * smoothstep( 0.55, 0.95, gPeloJ ) ) * visK * gPeloK * directLight.color;",
  // Difusa de hebra (Kajiya-Kay: depende del ángulo con la hebra, no de la normal):
  // la cara de abajo de un copete o de un mechón ya no queda negra.
  "\t\tfloat tl = dot( gPeloT, Lk );",
  "\t\tfloat difK = mix( dotNL, sqrt( max( 1.0 - tl * tl, 0.0 ) ) * 0.6, 0.35 );",
  "\t\treflectedLight.directDiffuse += max( difK - dotNL, 0.0 ) * min( vKK + 0.4, 1.0 ) * directLight.color * BRDF_Lambert( material.diffuseContribution );",
  // Contraluz: la luz atraviesa las hebras (más en el borde de la silueta).
  "\t\tfloat trasK = pow( saturate( dot( geometryViewDir, - Lk ) ), 3.0 );",
  "\t\tfloat bordeK = 1.0 - abs( dot( geometryNormal, geometryViewDir ) );",
  "\t\treflectedLight.directDiffuse += trasK * ( 0.25 + 0.75 * bordeK * bordeK ) * uKK2.z * min( vKK, 1.0 ) * material.diffuseColor * directLight.color;",
  "\t}",
].join("\n")

/** Pelo, barba y cejas: hebras con alfa a la cobertura y brillo anisotrópico (teñido por `color`). */
export function matPelo(color: string, rizado = false): THREE.MeshPhysicalMaterial {
  const clave = `${color}${rizado ? "|rizos" : ""}`
  let m = pelos.get(clave)
  if (m) return m
  const c = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const t = rizado ? texRizos() : texPelo()
  // El color de cada hebra va en el vértice (pelo, barba y cejas en un solo material);
  // el tono del pelo solo tiñe el brillo.
  m = new THREE.MeshPhysicalMaterial({
    // Canas y rubios: un poco más cálidos (bajo el cielo azul el blanco se iba a celeste).
    // (más todavía: a la sombra, con la luz del cielo, el rubio salía verde oliva y las canas turquesa)
    color: new THREE.Color(1, 1 - 0.14 * hsl.l, 1 - 0.45 * hsl.l),
    map: t,
    vertexColors: true,
    alphaTest: 0.42,
    // Con MSAA el borde de cada hebra se suaviza (sin escalones en la línea del pelo).
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    // Los bucles, más mates (con el brillo del pelo lacio parecían de metal).
    roughness: rizado ? 0.8 : 0.6,
    metalness: 0,
    // (el brillo de terciopelo del pelo claro también tomaba el cielo: nada en canas y rubios claros)
    sheen: rizado ? 0.06 : 0.2 * (1 - THREE.MathUtils.smoothstep(hsl.l, 0.45, 0.7)),
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.25).multiplyScalar(0.5 - 0.25 * hsl.l),
    // El brillo de verdad es el anisotrópico (abajo): el especular redondo queda
    // bajo (el pelo claro reflejaba el cielo y se veía celeste o verdoso).
    specularIntensity: (0.22 - 0.14 * hsl.l) * (rizado ? 0.6 : 1),
    // (y el pelo negro reflejaba el cielo: barbas y bigotes oscuros salían azules)
    specularColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35 - 0.15 * hsl.l),
  })
  // La luz del cielo (hemisferio + entorno) es azul: las canas y barbas blancas
  // salían menta o celeste a mediodía y el pelo negro, azul marino. Ni el
  // albedo ni el especular lo arreglaban (probado): se entibia solo la luz
  // indirecta que recibe el pelo, más cuanto más claro (el sol directo no se toca).
  const hs = { h: 0, s: 0, l: 0 }
  c.getHSL(hs, THREE.SRGBColorSpace)
  const tibio = new THREE.Vector3(1, 0.94 - 0.4 * hs.l, 0.87 - 0.47 * hs.l)
  // Brillo anisotrópico: corrimientos (raíz, punta), exponentes (la mitad del de
  // Kajiya-Kay: se eleva 1 - cos²) y fuerzas. El oscuro brilla más (contraste);
  // el claro, menos y más ancho (el rubio y las canas ya son claros).
  const kk = rizado ? new THREE.Vector4(-0.05, 0.12, 22, 6) : new THREE.Vector4(-0.1, 0.14, 85, 10)
  const kk2 = new THREE.Vector4((rizado ? 0.05 : 0.13) * (1 - 0.45 * hs.l), (rizado ? 0.14 : 0.4) * (1 - 0.3 * hs.l), 0.55, 0)
  // El brillo blanco, apenas teñido del pelo (en el negro, casi blanco; en el castaño, dorado).
  const brillo = new THREE.Color(color).lerp(new THREE.Color("#fff4e6"), 0.75)
  const dir = rizado ? texRizosDir() : null
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTibio = { value: tibio }
    sh.uniforms.uKK = { value: kk }
    sh.uniforms.uKK2 = { value: kk2 }
    sh.uniforms.uBrillo = { value: brillo }
    if (dir) sh.uniforms.uDirRizo = { value: dir }
    // aMat.x = fuerza del brillo de esa parte (pelo, barba, cejas, pestañas; avatar-pelo.ts).
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nvarying float vKK;\nvarying float vOpaco;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvKK = aMat.x;\n\tvOpaco = aMat.y;")
    sh.fragmentShader = (dir ? "#define PELO_RIZOS\n" : "") + sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + PELO_COMUN)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + PELO_HEBRA)
      .replace("#include <color_fragment>", "#include <color_fragment>\n\tdiffuseColor.a = max( diffuseColor.a, vOpaco * smoothstep( 0.6, 2.0, vColor.a ) * 1.2 );")
      .replace("#include <lights_physical_pars_fragment>", THREE.ShaderChunk.lights_physical_pars_fragment.replace("vec3 irradiance = dotNL * directLight.color;", PELO_LUZ))
      .replace(
        "#include <alphatest_fragment>",
        [
          "#ifdef ALPHA_TO_COVERAGE",
          // Cobertura parcial en todo el rango (0,24–0,8): las hebras ralas del borde y
          // de las capas de afuera dejan ver lo de abajo (con MSAA, mezcla de verdad).
          "\tdiffuseColor.a = smoothstep( 0.24, max( 0.8, 0.24 + fwidth( diffuseColor.a ) ), diffuseColor.a );",
          "\tif ( diffuseColor.a < 0.05 ) discard;",
          "#else",
          "#include <alphatest_fragment>",
          "#endif",
        ].join("\n"),
      )
      .replace(
        "#include <lights_fragment_maps>",
        [
          "#include <lights_fragment_maps>",
          "\tvec3 tibioK = uTibio;",
          "#if NUM_DIR_LIGHTS > 0",
          "\ttibioK = mix( vec3( 1.0 ), uTibio, smoothstep( 0.4, 0.8, directionalLights[ 0 ].color.b / max( directionalLights[ 0 ].color.r, 1e-4 ) ) );",
          "#endif",
          "\tirradiance *= tibioK;",
          "\tiblIrradiance *= tibioK;",
          "#if defined( RE_IndirectSpecular )",
          "\tradiance *= tibioK;",
          "#endif",
        ].join("\n"),
      )
  }
  m.customProgramCacheKey = () => (dir ? "pelo-kk-rizos" : "pelo-kk")
  m.name = `pelo-${clave}`
  pelos.set(clave, m)
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
    // El barniz reflejaba el cielo entero y los iris oscuros se leían azules
    // (Kobe, Tate, Cleopatra): menos barniz (el envMapIntensity no cuenta con
    // scene.environment); el punto de brillo del sol queda.
    clearcoat: 0.45,
    clearcoatRoughness: 0.03,
    specularIntensity: 0.3,
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
    color: sol ? "#0b0d10" : "#ffffff",
    roughness: sol ? 0.3 : 0.05,
    metalness: 0,
    transparent: true,
    // (las claras con barniz 1 reflejaban todo el cielo y tapaban los ojos de
    // blanco: Jobs, Amodei, Pichai se veían ciegos; ahora apenas un reflejo)
    opacity: sol ? 0.92 : 0.08,
    depthWrite: false,
    // Las de sol reflejaban tanto cielo que se leían como cristal claro (el
    // envMapIntensity no cuenta con scene.environment: se baja el barniz).
    clearcoat: sol ? 0.25 : 0.15,
    clearcoatRoughness: sol ? 0.15 : 0.05,
    specularIntensity: sol ? 0.45 : 0.3,
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
varying vec3 vP;
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
	vP = transformed;
	gl_Position = projectionMatrix * mv;
}`

const HOLO_FRAG = /* glsl */ `
#include <color_pars_fragment>
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTiempo;
uniform float uAlto;
uniform float uPatron;
uniform float uFundir;
varying vec3 vN;
varying vec3 vV;
varying float vY;
varying vec3 vP;
float hash( float n ) { return fract( sin( n ) * 43758.5453 ); }
// Celda hexagonal más cercana (p en unidades de celda) y distancia hexagonal a su centro (0,5 = borde).
vec2 celdaHex( vec2 p ) {
	const vec2 s = vec2( 1.0, 1.7320508 );
	vec2 a = mod( p, s ) - s * 0.5;
	vec2 b = mod( p - s * 0.5, s ) - s * 0.5;
	return dot( a, a ) < dot( b, b ) ? a : b;
}
float bordeHex( vec2 p ) { p = abs( p ); return max( dot( p, vec2( 0.8660254, 0.5 ) ), p.y ); }
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
	// ChatGPT: retícula hexagonal (celdas de 2 cm) en vez de líneas de escaneo.
	if ( uPatron > 0.5 ) {
		vec2 q = vec2( atan( vP.x, vP.z ) * 0.16, vY - uTiempo * 0.02 ) / 0.02;
		float e = bordeHex( celdaHex( q ) );
		lineas = 0.8 + 0.2 * ( 1.0 - smoothstep( 0.38, 0.47, e ) );
	}
	// Luminancia del color del vértice respecto del color base: la ropa más clara
	// (abrigo, chaqueta, costuras, emblema) se ve más opaca y brillante.
	const vec3 LUM = vec3( 0.3, 0.59, 0.11 );
	#ifdef USE_COLOR_ALPHA
		float kc = clamp( dot( vColor.rgb, LUM ) / max( dot( uColor, LUM ), 0.01 ), 0.6, 3.0 );
	#else
		float kc = 1.0;
	#endif
	float barrido = smoothstep( 0.12, 0.0, abs( fract( uTiempo * 0.18 ) * ( uAlto + 0.6 ) - 0.3 - vY ) );
	float parpadeo = 0.92 + 0.08 * sin( uTiempo * 31.0 ) * sin( uTiempo * 7.3 );
	float falla = step( 0.985, hash( floor( uTiempo * 9.0 ) ) ) * step( abs( fract( vY * 3.0 + uTiempo ) - 0.5 ), 0.06 );
	vec3 col = mix( uColor, uColor2, fr * 0.8 + barrido * 0.5 );
	float brillo = ( 0.85 + 3.2 * fr + 1.2 * barrido ) * lineas * parpadeo + falla * 1.5;
	brillo *= 0.75 + 0.25 * kc;
	float a = clamp( ( 0.34 + 0.6 * fr + 0.2 * barrido + falla * 0.3 ) * ( 0.8 + 0.2 * kc ), 0.0, 1.0 ) * ( 0.85 + 0.15 * lineas );
	// Claude: las piernas se funden en luz desde media pantorrilla hacia el suelo.
	a *= mix( 1.0, smoothstep( 0.02 * uAlto, 0.24 * uAlto, vY ), uFundir );
	gl_FragColor = vec4( col * brillo, a );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`

/** Material de holograma (color y prepaso de profundidad: solo se ve la cara más cercana). */
export function matHolograma(color: string, color2: string, alto: number, op: { hex?: boolean; fundir?: boolean } = {}): { color: THREE.ShaderMaterial; prepaso: THREE.ShaderMaterial } {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uColor2: { value: new THREE.Color(color2) },
    uTiempo: { value: 0 },
    uAlto: { value: alto },
    uPatron: { value: op.hex ? 1 : 0 },
    uFundir: { value: op.fundir ? 1 : 0 },
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
