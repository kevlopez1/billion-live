// ──────────────────────────────────────────────────────────────
// Caras MakeHuman (1/3): arma en three.js la cabeza horneada por
// scripts/caras-mh/hornear.mjs (código propio; datos CC0, ver
// public/casa-blanca/caras/LICENCIAS.md).
//
// Datos: public/casa-blanca/caras/<id>/cab.json + cab.bin (cuantizado) y
// las texturas compartidas de _comun/ (se cargan una sola vez para todos).
// UNA malla y UN material por cabeza (una llamada de dibujo): piel (morphs
// boca y parpadeo), ojos, cejas, pestañas, dientes y lengua fundidos, con
// el atributo aReg diciendo qué es cada vértice (ver matCabeza). Frame de
// MakeHuman, decímetros: avatar-cara-mh-montaje.ts la escala y la ubica.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"

export interface Parte { tipo: string; n: number; off: number; min?: number[]; esc?: number[]; k?: number }
export interface CabJson {
  id: string
  ms: number
  partes: Record<string, Parte>
  mallas: Array<{ nombre: string; tris: number; verts: number; textura?: string; capas?: number }>
  puntos: { ojoL: number[]; ojoR: number[]; coronilla: number; menton: number[]; pivMand: number[]; angBoca: number; subnasal: number[]; alaX: number }
  texturas: { piel: string; iris: string; cejas: string; pestanas: string; pelo: string | null }
  /** Lo que el runtime lee de la configuración horneada (la completa queda en scripts/caras-mh/personajes-final.json). */
  cfg: { id?: string; personaje?: string; iris?: string; piel?: string; montaje?: Record<string, number | boolean | undefined> }
}
export interface DatosCabeza { cab: CabJson; bin: ArrayBuffer; base: string; bytes: number }

export async function cargarDatos(base: string, id: string): Promise<DatosCabeza> {
  const cab = (await (await fetch(`${base}/${id}/cab.json`)).json()) as CabJson
  const bin = await (await fetch(`${base}/${id}/cab.bin`)).arrayBuffer()
  return { cab, bin, base, bytes: bin.byteLength }
}

function leer(d: DatosCabeza, nombre: string): Float32Array | Uint16Array | Uint32Array | null {
  const p = d.cab.partes[nombre]
  if (!p) return null
  if (p.tipo === "u16q") {
    const q = new Uint16Array(d.bin, p.off, p.n)
    const k = p.k ?? 3
    const out = new Float32Array(p.n)
    for (let i = 0; i < p.n; i++) out[i] = p.min![i % k] + q[i] * p.esc![i % k]
    return out
  }
  if (p.tipo === "s8") { const q = new Int8Array(d.bin, p.off, p.n); return Float32Array.from(q, (x) => x / 127) }
  if (p.tipo === "u8") { const q = new Uint8Array(d.bin, p.off, p.n); return Float32Array.from(q, (x) => x / 255) }
  if (p.tipo === "uv") { const q = new Uint16Array(d.bin, p.off, p.n); return Float32Array.from(q, (x) => x / 65535) }
  if (p.tipo === "u16") return new Uint16Array(d.bin, p.off, p.n).slice()
  if (p.tipo === "u32") return new Uint32Array(d.bin, p.off, p.n).slice()
  throw new Error(p.tipo)
}

export function geometria(d: DatosCabeza, nombre: string): THREE.BufferGeometry | null {
  const pos = leer(d, nombre + ".pos")
  if (!pos) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos as Float32Array, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(leer(d, nombre + ".nrm") as Float32Array, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(leer(d, nombre + ".uv") as Float32Array, 2))
  g.setIndex(new THREE.BufferAttribute(leer(d, nombre + ".idx") as Uint16Array, 1))
  const boca = leer(d, nombre + ".boca"), parp = leer(d, nombre + ".parp")
  if (boca || parp) {
    const n = pos.length
    g.morphAttributes.position = [
      new THREE.BufferAttribute((boca as Float32Array) ?? new Float32Array(n), 3),
      new THREE.BufferAttribute((parp as Float32Array) ?? new Float32Array(n), 3),
    ]
    g.morphTargetsRelative = true
    const bN = leer(d, nombre + ".bocaN"), pN = leer(d, nombre + ".parpN")
    if (bN && pN) g.morphAttributes.normal = [new THREE.BufferAttribute(bN as Float32Array, 3), new THREE.BufferAttribute(pN as Float32Array, 3)]
  }
  for (const extra of ["w", "pelo", "var", "maq", "ext"]) {
    const a = leer(d, `${nombre}.${extra}`)
    if (a) g.setAttribute("a" + extra[0].toUpperCase() + extra.slice(1), new THREE.BufferAttribute(a as Float32Array, d.cab.partes[`${nombre}.${extra}`].k ?? 1))
  }
  return g
}

// ── texturas ──
const cargador = new THREE.TextureLoader()
const cache = new Map<string, Promise<THREE.Texture>>()
function tex(url: string, srgb = true): Promise<THREE.Texture> {
  if (!cache.has(url)) cache.set(url, new Promise((ok, mal) => cargador.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t) }, undefined, mal)))
  return cache.get(url)!
}
/** Hebras: un valor al azar por celda (alto de cada pelo) para la barba en capas y el rapado. */
let texHebras: THREE.DataTexture | null = null
function hebras(): THREE.DataTexture {
  if (texHebras) return texHebras
  const N = 256, a = new Uint8Array(N * N * 4)
  let s = 1234567
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < N * N; i++) { const h = r(); a[i * 4] = h * 255; a[i * 4 + 1] = r() * 255; a[i * 4 + 2] = r() * 255; a[i * 4 + 3] = 255 }
  texHebras = new THREE.DataTexture(a, N, N)
  texHebras.wrapS = texHebras.wrapT = THREE.RepeatWrapping
  texHebras.magFilter = THREE.NearestFilter
  texHebras.minFilter = THREE.LinearMipmapLinearFilter
  texHebras.generateMipmaps = true
  texHebras.needsUpdate = true
  return texHebras
}

/** Albedo de la piel a partir del tono de la ficha (misma calibración que avatar-materiales.ts::matPiel). */
export function albedoPiel(hex: string): THREE.Color {
  const c = new THREE.Color(hex)
  const Y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  const t = Math.pow(THREE.MathUtils.clamp((Y - 0.1) / 0.5, 0, 1), 1.5)
  const gR = THREE.MathUtils.lerp(0.6, 0.9, t)
  return new THREE.Color(c.r * gR, c.g * gR * THREE.MathUtils.lerp(1.12, 0.75, t), c.b * gR * THREE.MathUtils.lerp(1.08, 0.64, t))
}

/** Color medio (lineal) de la zona de la cara de una textura de piel (centro de la isla grande). */
const medias = new Map<string, THREE.Color>()
function mediaCara(t: THREE.Texture): THREE.Color {
  const img = t.image as HTMLImageElement
  if (medias.has(img.src)) return medias.get(img.src)!
  const cv = document.createElement("canvas")
  cv.width = cv.height = 128
  const cx = cv.getContext("2d", { willReadFrequently: true })!
  // FASE 4 (atlas2): solo el centro de la cara (mejillas, frente, nariz). En el atlas nuevo el cuero
  // cabelludo pintado ocupa mucho y bajaba la mediana: la piel salía naranja y saturada.
  cx.drawImage(img, img.width * 0.3, img.height * 0.28, img.width * 0.42, img.height * 0.44, 0, 0, 128, 128)
  // el atlas ya viene aplanado (texturas.py): la mediana de todo el atlas es el tono de la piel
  // (un promedio sobre la cara se lo lleva el rojo de los labios y la piel sale verdosa)
  const d = cx.getImageData(0, 0, 128, 128).data
  const lin = (x: number) => Math.pow(x / 255, 2.2)
  const R: number[] = [], G: number[] = [], Bc: number[] = []
  for (let i = 0; i < d.length; i += 4) { R.push(lin(d[i])); G.push(lin(d[i + 1])); Bc.push(lin(d[i + 2])) }
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1]
  const r = med(R), g = med(G), b = med(Bc), n = 1
  const c = new THREE.Color(r / n, g / n, b / n)
  medias.set(img.src, c)
  return c
}

export interface OpcionesCabeza {
  piel: string
  pelo?: string
  canas?: number
  barba?: string
  cejas?: string
  brillo?: number
  /** "alta": atlas 1024; "baja": 512 (lejos). */
  calidad?: "alta" | "baja"
  sombraOjos?: string
  iris?: string
  /** radio del iris en uv del ojo (0,056 ≈ 32° desde el eje: un iris de 11,7 mm en un globo de 21,5 mm) */
  radioIris?: number
  /** Bordes suaves de cejas y pestañas por cobertura (alpha-to-coverage): solo donde se dibuja con MSAA (calidad alta). */
  cobertura?: boolean
  /** La piel en una malla aparte (androides: llevan la piel del repo); ojos, cejas, pestañas y dientes en otra. */
  pielAparte?: boolean
}

export interface UniformesPiel {
  uCuerpo: { value: THREE.Color }
  uLlenado: { value: number }
  uTibio: { value: THREE.Color }
  uTibioK: { value: number }
  uBorde: { value: number }
  uBordeCol: { value: THREE.Color }
  uPiel: { value: THREE.Color }
  uCostura: { value: number }
  uPeloHoy: { value: THREE.Color }
  /** FASE 6: 1 = la piel de hoy del cuerpo (cuello, manos) recibe el mismo relleno + tibio (montaje.ts::
   *  pielCuerpoComoMH): entonces el tibio y el relleno NO se apagan en la costura (si no, queda la banda). */
  uCuerpoTibio: { value: number }
  /** Rugosidad de la piel de hoy en el borde (montaje): en la costura la piel MH va hacia ella. */
  uRugCuerpo: { value: number }
}
export interface UniformesCejas { uColC: { value: THREE.Color }; uColP: { value: THREE.Color }; uLuz: { value: number }; uSinCejas: { value: number } }

/**
 * Regiones de la cabeza (atributo aReg): TODA la cabeza es UNA malla y UN material (una llamada de dibujo).
 * El orden de los índices es el de las regiones: lo de lejos (piel, ojos, cejas) va primero, así el nivel de
 * detalle de lejos es un drawRange más corto (sin pestañas ni dientes ni lengua), sin otro búfer.
 */
export const REG = { piel: 0, ojos: 1, cejas: 2, pestanas: 3, dientes: 4, lengua: 5 } as const

// centros de las pupilas en el uv del ojo CC0 (medidos: cabeza/_ojocentro.mjs) y radio del iris
// horneado en ojo.png (propios.py)
const OJO_C1 = new THREE.Vector2(0.2939, 0.2984), OJO_C2 = new THREE.Vector2(0.7051, 0.6996), RI_TEX = 0.075

/**
 * El material único de la cabeza MH. Por región:
 *  - piel (0): atlas MakeHuman teñido al tono de la ficha + poros, luz envuelta (dispersión barata), pelo al ras
 *    pintado (aPelo), cuero bajo el pelo de hoy (aCuero), y aExt: x cavidad de la boca (casi negra y sin luz),
 *    y costura del cuello (albedo, rugosidad y luz de la piel de HOY: sin línea), z cuenca del ojo, w párpado.
 *    Relleno + tibio: la luz indirecta más cálida y más fuerte en las pieles oscuras; borde a contraluz.
 *  - ojos (1): esclera de ojo.png, iris escalado al radio real y teñido, sombra del párpado; barniz = córnea.
 *  - cejas (2) y pestañas (3): atlas cejas-pestanas.png, colores uColC / uColP, alfa por vértice en las cejas;
 *    bordes por cobertura con MSAA (uMsaa), recorte en 0,5 sin MSAA. Se dibujan de los dos lados: sus triángulos
 *    van dos veces (el segundo, dado vuelta y con la misma normal: se iluminan como la piel de abajo).
 *  - dientes (4) y lengua (5): piezas, juntas y encía dibujadas con aVar (sin textura).
 * Androides: uSinCejas (Claude) o uLuz (ChatGPT: cejas de luz, blanco HDR que toma el bloom).
 */
function matCabeza(
  map: THREE.Texture,
  poros: THREE.Texture,
  texOjo: THREE.Texture,
  texCejas: THREE.Texture,
  p: { tinte: THREE.Color; rugosidad: number; sheen: number; sheenColor: THREE.Color; especular: number; sss: THREE.Color; pelo: THREE.Color; calva: THREE.Color; sombraOjos: THREE.Color | null; iris: THREE.Color; radioIris: number; cobertura: boolean },
  U: UniformesPiel,
  UC: UniformesCejas,
  uMsaa: { value: number },
): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    map,
    color: p.tinte,
    normalMap: poros,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: p.rugosidad,
    metalness: 0,
    sheen: p.sheen,
    sheenRoughness: 0.55,
    sheenColor: p.sheenColor,
    specularIntensity: p.especular,
    specularColor: new THREE.Color("#fff4ee"),
    // el barniz es la córnea: solo en los ojos (el shader lo apaga en el resto)
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    alphaToCoverage: p.cobertura,
  })
  const conMaq = !!p.sombraOjos
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSSS = { value: p.sss }
    sh.uniforms.uHebras = { value: hebras() }
    sh.uniforms.uPeloCol = { value: p.pelo }
    sh.uniforms.uCalva = { value: p.calva }
    sh.uniforms.uSombraOjos = { value: p.sombraOjos ?? new THREE.Color(0, 0, 0) }
    sh.uniforms.uTexOjo = { value: texOjo }
    sh.uniforms.uIris = { value: p.iris }
    sh.uniforms.uRI = { value: p.radioIris }
    sh.uniforms.uTexCejas = { value: texCejas }
    sh.uniforms.uMsaa = uMsaa
    Object.assign(sh.uniforms, U, UC)
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 aPelo;\nvarying vec2 vPelo;\nattribute vec4 aExt;\nvarying vec4 vExt;\nattribute float aCuero;\nvarying float vCuero;\nattribute float aReg;\nvarying float vReg;\nattribute vec2 aVar;\nvarying vec2 vVar;" +
          (conMaq ? "\nattribute vec2 aMaq;\nvarying vec2 vMaq;" : ""),
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvPelo = aPelo;\n\tvExt = aExt;\n\tvCuero = aCuero;\n\tvReg = aReg;\n\tvVar = aVar;" + (conMaq ? "\n\tvMaq = aMaq;" : ""))
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "uniform vec3 uSSS;\nuniform vec3 uPeloCol;\nuniform vec3 uCalva;\nuniform sampler2D uHebras;\nvarying vec2 vPelo;\nvarying vec4 vExt;\nvarying float vReg;\nvarying vec2 vVar;",
          "varying float vCuero;\nuniform float uRugCuerpo;\nuniform vec3 uPeloHoy;\nuniform vec3 uCuerpo;\nuniform float uLlenado;\nuniform vec3 uTibio;\nuniform float uTibioK;\nuniform float uBorde;\nuniform vec3 uBordeCol;\nuniform vec3 uPiel;\nuniform float uCostura;\nuniform float uCuerpoTibio;",
          "uniform sampler2D uTexOjo;\nuniform vec3 uIris;\nuniform float uRI;\nuniform sampler2D uTexCejas;\nuniform vec3 uColC;\nuniform vec3 uColP;\nuniform float uLuz;\nuniform float uSinCejas;\nuniform float uMsaa;",
          conMaq ? "varying vec2 vMaq;\nuniform vec3 uSombraOjos;" : "",
        ].join("\n"),
      )
      // ── color por región (reemplaza map_fragment) ──
      .replace(
        "#include <map_fragment>",
        [
          "\tint cReg = int( vReg + 0.5 );",
          "\tif ( cReg == 0 ) {",
          "\t\tdiffuseColor *= texture2D( map, vMapUv );",
          "\t} else if ( cReg == 1 ) {",
          // ojo: el iris (gris en la textura) escalado al radio real y teñido; la esclera empujada fuera del iris
          "\t\tvec2 c1 = vec2( " + OJO_C1.x + ", " + OJO_C1.y + " ), c2 = vec2( " + OJO_C2.x + ", " + OJO_C2.y + " );",
          "\t\tvec2 cc = distance( vMapUv, c1 ) < distance( vMapUv, c2 ) ? c1 : c2;",
          "\t\tvec2 dd = vMapUv - cc;",
          "\t\tfloat r = length( dd );",
          "\t\tfloat RT = " + RI_TEX.toFixed(3) + ";",
          "\t\tfloat rS = r < uRI ? r * RT / uRI : mix( RT * 1.08, 0.2, clamp( ( r - uRI ) / ( 0.2 - uRI ), 0.0, 1.0 ) );",
          "\t\tvec4 tx = texture2D( uTexOjo, cc + ( r > 1e-5 ? dd / r : vec2( 0.0 ) ) * rS );",
          "\t\tfloat enIris = 1.0 - smoothstep( uRI * 0.97, uRI * 1.03, r );",
          "\t\tvec3 col = mix( tx.rgb, tx.rgb * uIris * 2.0, enIris );",
          // sombra del párpado de arriba y de los costados (en uv: +v = arriba en los dos ojos)
          "\t\tfloat dy = dd.y / 0.082, dx = abs( dd.x ) / 0.085;",
          "\t\tcol *= 1.0 - 0.55 * smoothstep( 0.1, 0.7, dy ) - 0.12 * smoothstep( 0.45, 0.9, -dy ) - 0.15 * smoothstep( 0.55, 0.95, dx );",
          "\t\tdiffuseColor = vec4( col, 1.0 );",
          "\t} else if ( cReg == 2 || cReg == 3 ) {",
          "\t\tvec4 tc = texture2D( uTexCejas, vMapUv );",
          "\t\tdiffuseColor = vec4( tc.rgb * ( cReg == 3 ? uColP : uColC ), tc.a );",
          "\t\tif ( cReg == 2 ) { diffuseColor.a *= vVar.x; if ( uSinCejas > 0.5 ) discard; }",
          "\t} else {",
          // dientes: piezas (bordes en dm desde la línea media), juntas, encía; más oscuros hacia el fondo
          "\t\tdiffuseColor = vec4( 0.8, 0.76, 0.66, 1.0 );",
          "\t\tfloat arco = vVar.x * 0.7;",
          "\t\tfloat bs[8] = float[8]( 0.0, 0.085, 0.15, 0.225, 0.295, 0.365, 0.465, 0.565 );",
          "\t\tfloat dmin = 1.0;",
          "\t\tfor ( int i = 0; i < 8; i++ ) dmin = min( dmin, abs( arco - bs[i] ) );",
          "\t\tdiffuseColor.rgb *= 1.0 - 0.4 * ( 1.0 - smoothstep( 0.0, 0.008, dmin ) );",
          "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.9, 0.92, 0.95 ), 1.0 - smoothstep( 0.0, 0.1, vVar.y ) );",
          "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.42, 0.14, 0.13 ), smoothstep( 0.7, 0.85, vVar.y ) );",
          "\t\tdiffuseColor.rgb *= 1.0 - 0.7 * smoothstep( 0.18, 0.45, arco );",
          // la lengua: rojo muy oscuro, sin piezas
          "\t\tif ( cReg == 5 ) diffuseColor.rgb = vec3( 0.03, 0.005, 0.005 );",
          "\t}",
          // cejas y pestañas: cobertura con MSAA (bordes suaves sin pasada transparente), recorte sin MSAA
          "\tif ( cReg == 2 || cReg == 3 ) {",
          "\t\tif ( uMsaa > 0.5 ) { diffuseColor.a = smoothstep( 0.12, 0.62, diffuseColor.a ); if ( diffuseColor.a < 0.02 ) discard; }",
          "\t\telse { if ( diffuseColor.a < 0.5 ) discard; diffuseColor.a = 1.0; }",
          "\t} else diffuseColor.a = 1.0;",
        ].join("\n"),
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "\tif ( cReg == 0 ) {",
          conMaq ? "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uSombraOjos, vMaq.y * 0.7 );\n\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012, 0.01, 0.01 ), smoothstep( 0.15, 0.7, vMaq.x ) );" : "",
          "\t\tif ( vPelo.y > 0.003 ) {",
          "\t\t\tfloat nz = texture2D( uHebras, vMapUv * 60.0 ).g;",
          "\t\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uCalva * ( 0.94 + 0.1 * nz ), smoothstep( 0.0, 0.6, vPelo.y ) );",
          "\t\t}",
          "\t\tif ( vPelo.x > 0.003 ) {",
          "\t\t\tfloat hh = texture2D( uHebras, vMapUv * 900.0 ).r;",
          "\t\t\tfloat hh2 = texture2D( uHebras, vMapUv * 260.0 ).g;",
          "\t\t\tfloat cub = smoothstep( 0.05, 0.75, vPelo.x ) * ( 0.72 + 0.28 * hh ) * ( 0.85 + 0.15 * hh2 );",
          "\t\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uPeloCol, clamp( cub, 0.0, 0.92 ) );",
          "\t\t}",
          // cuero bajo el pelo de hoy: la capa de abajo del pelo (entre hebras no se ve piel ni cielo)
          "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uPeloHoy, 0.9 * vCuero );",
          // cuenca del ojo: tono de párpado (un poco más rosado y oscuro que la piel)
          "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uPiel * vec3( 0.92, 0.78, 0.76 ), vExt.z );",
          // párpado (lo que se mueve al parpadear): el atlas lo trae marrón y moteado; al tono de la piel con su detalle
          "\t\t{ float lr = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / max( 1e-4, dot( uPiel, vec3( 0.2126, 0.7152, 0.0722 ) ) );",
          "\t\t  diffuseColor.rgb = mix( diffuseColor.rgb, uPiel * vec3( 0.97, 0.9, 0.88 ) * mix( 1.0, clamp( lr, 0.6, 1.3 ), 0.5 ), 0.8 * vExt.w ); }",
          // costura: el albedo de la piel de hoy
          "\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, uCuerpo, vExt.y * uCostura );",
          // cavidad: casi negra hacia adentro (labio de adentro rojo oscuro)
          "\t\tdiffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.16, 0.05, 0.05 ), smoothstep( 0.0, 0.5, vExt.x ) );",
          "\t\tdiffuseColor.rgb *= 1.0 - 0.75 * smoothstep( 0.5, 1.0, vExt.x );",
          "\t}",
        ].join("\n"),
      )
      .replace(
        "#include <roughnessmap_fragment>",
        [
          "#include <roughnessmap_fragment>",
          // costura: la rugosidad de la piel de hoy (si no, el brillo distinto marca una línea en el cuello)
          "\tif ( cReg == 0 ) { if ( uRugCuerpo > 0.0 ) roughnessFactor = mix( roughnessFactor, uRugCuerpo, vExt.y * uCostura ); }",
          "\telse roughnessFactor = cReg == 1 ? 0.5 : ( cReg <= 3 ? 0.9 : ( cReg == 4 ? 0.3 : 0.45 ) );",
        ].join("\n"),
      )
      // los poros solo en la piel
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n\tif ( cReg != 0 ) normal = nonPerturbedNormal;")
      .replace(
        "#include <lights_physical_fragment>",
        [
          "#include <lights_physical_fragment>",
          "#ifdef USE_CLEARCOAT",
          "\tmaterial.clearcoat = cReg == 1 ? 1.0 : 0.0;",
          "#endif",
          "\tif ( cReg != 0 ) {",
          // ojo: physical con especular 0,2; el resto, como un MeshStandardMaterial (F0 0,04)
          "\t\tfloat siR = cReg == 1 ? 0.2 : 1.0;",
          "\t\tmaterial.specularColor = vec3( 0.04 * siR );",
          "\t\tmaterial.specularColorBlended = material.specularColor;",
          "\t\tmaterial.specularF90 = siR;",
          "#ifdef USE_SHEEN",
          "\t\tmaterial.sheenColor = vec3( 0.0 );",
          "#endif",
          "\t}",
        ].join("\n"),
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n\tif ( cReg == 2 && uLuz > 0.5 ) { totalEmissiveRadiance += vec3( 5.6, 5.8, 6.2 ); diffuseColor.rgb = vec3( 0.0 ); }")
      .replace(
        "#include <lights_fragment_end>",
        [
          "\t{",
          "\t\tvec3 W3 = vec3( 0.2126, 0.7152, 0.0722 );",
          "\t\tif ( cReg == 0 ) {",
          // la luz indirecta de la piel: más cálida (dispersión) y más fuerte en las pieles oscuras
          "\t\t\tfloat kPropio = 1.0 - vExt.y * uCostura;",
          "\t\t\tfloat kT = mix( kPropio, 1.0, uCuerpoTibio );",
          "\t\t\tfloat k = uTibioK * kT;",
          // el relleno solo donde el sol no llega (lado de sombra, contraluz, noche): al sol no se aclara
          "\t\t\tfloat dirRel = dot( reflectedLight.directDiffuse, W3 ) / max( 1e-4, dot( diffuseColor.rgb, W3 ) );",
          "\t\t\tfloat ll = mix( 1.0, uLlenado, kT * ( 1.0 - smoothstep( 0.0, 0.35, dirRel ) ) );",
          "\t\t\tirradiance = mix( irradiance, dot( irradiance, W3 ) * uTibio, k ) * ll;",
          "\t\t\tfloat cav = 1.0 - 0.92 * vExt.x;",
          "\t\t\tirradiance *= cav;",
          "#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )",
          "\t\t\tiblIrradiance = mix( iblIrradiance, dot( iblIrradiance, W3 ) * uTibio, k ) * ll * cav;",
          // el reflejo del cielo en la piel a la mitad: en la piel oscura, a mediodía, el cuero salía gris plateado
          "\t\t\tradiance *= cav * mix( 0.5, 1.0, vExt.y * uCostura );",
          "#endif",
          "\t\t} else {",
          // ojos, cejas, pestañas y dientes: la luz del cielo entibiada y su reflejo apagado (si no, salían celestes)
          "\t\t\tfloat k = cReg == 1 ? 0.75 : 0.7;",
          "\t\t\tfloat kEnv = cReg == 1 || cReg == 2 || cReg == 3 ? 0.15 : 0.5;",
          "\t\t\tirradiance = mix( irradiance, dot( irradiance, W3 ) * vec3( 1.1, 1.0, 0.9 ), k );",
          "#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )",
          "\t\t\tiblIrradiance = mix( iblIrradiance, dot( iblIrradiance, W3 ) * vec3( 1.1, 1.0, 0.9 ), k ) * kEnv;",
          "\t\t\tradiance = mix( radiance, dot( radiance, W3 ) * vec3( 1.05, 1.0, 0.95 ), k ) * kEnv;",
          "#endif",
          "\t\t}",
          "\t}",
          "#include <lights_fragment_end>",
          // borde a contraluz de la piel (fresnel ancho, teñido): sale de la luz del entorno, así de noche baja solo
          "\tif ( cReg == 0 ) {",
          "\t\tvec3 W3 = vec3( 0.2126, 0.7152, 0.0722 );",
          "\t\tfloat nv = saturate( dot( geometryNormal, geometryViewDir ) );",
          "\t\tfloat amb = dot( irradiance, W3 );",
          "#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )",
          "\t\tamb += dot( iblIrradiance, W3 );",
          "#endif",
          "\t\treflectedLight.indirectSpecular += uBorde * pow( 1.0 - nv, 3.0 ) * amb * RECIPROCAL_PI * uBordeCol * ( 1.0 - vExt.y * uCostura ) * ( 1.0 - vExt.x );",
          "\t}",
        ].join("\n"),
      )
      .replace(
        "#include <lights_physical_pars_fragment>",
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          "vec3 irradiance = dotNL * directLight.color;",
          [
            "vec3 irradiance = dotNL * directLight.color;",
            // luz envuelta (dispersión barata): solo la piel
            "\tif ( vReg < 0.5 ) {",
            "\t\tfloat dotNLw = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 );",
            "\t\treflectedLight.directDiffuse += max( dotNLw * dotNLw - dotNL, 0.0 ) * directLight.color * BRDF_Lambert( material.diffuseContribution ) * uSSS;",
            "\t}",
          ].join("\n"),
        ),
      )
  }
  m.customProgramCacheKey = () => "mh-cabeza1" + (conMaq ? "-maq" : "") + (p.cobertura ? "-a2c" : "")
  return m
}

/** Sombra de la cabeza (luz del sol y luces de noche): sin cejas ni pestañas (sus tarjetas harían sombras cuadradas). */
let sombraCab: { depth: THREE.MeshDepthMaterial; dist: THREE.MeshDistanceMaterial } | null = null
function sombraCabeza() {
  if (sombraCab) return sombraCab
  const sacar = (m: THREE.Material, k: string) => {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aReg;")
        .replace("#include <project_vertex>", "#include <project_vertex>\n\tif ( aReg > 1.5 && aReg < 3.5 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );")
    }
    m.customProgramCacheKey = () => k
  }
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  const dist = new THREE.MeshDistanceMaterial()
  sacar(depth, "mh-sombra-d")
  sacar(dist, "mh-sombra-p")
  sombraCab = { depth, dist }
  return sombraCab
}

/** Color de cejas: el de la ficha, llevado al matiz del pelo (nunca verdoso) y un poco más oscuro. */
export function colorCejas(cejas: string | undefined, pelo: string | undefined, canas = 0): THREE.Color {
  const cp = new THREE.Color(pelo ?? cejas ?? "#2a2018"), cc = new THREE.Color(cejas ?? pelo ?? "#2a2018")
  const hp = { h: 0, s: 0, l: 0 }, hc = { h: 0, s: 0, l: 0 }
  cp.getHSL(hp); cc.getHSL(hc)
  // matiz del pelo, luminancia de la ficha de cejas (un 10 % más oscura), saturación moderada
  let h = hp.s > 0.08 ? hp.h : hc.h
  if (h > 0.13 && h < 0.5) h = 0.09 // nada entre amarillo-verde y cian: el rubio va a arena
  const c = new THREE.Color().setHSL(h, Math.min(0.45, Math.max(hc.s, hp.s) * 0.8), hc.l * 0.9)
  if (canas > 0) c.lerp(new THREE.Color("#a9a6a0"), Math.min(1, canas) * 0.8)
  return c
}

/**
 * Funde partes de la cabeza en UNA geometría: unión de atributos (lo que le falta a una parte va en cero; aW, los
 * pesos, en 1 a la cabeza), morphs de boca y parpadeo (los que falten, en cero: son relativos) y el atributo aReg.
 * `doble`: sus triángulos van otra vez dados vuelta (se ven de los dos lados con un material de una sola cara).
 * Devuelve dónde termina cada parte en el índice (para el drawRange del nivel de detalle).
 */
function fundir(partes: Array<{ g: THREE.BufferGeometry; reg: number; doble?: boolean }>): { g: THREE.BufferGeometry; fin: number[]; nPrimera: number } {
  const nombres = new Map<string, number>()
  for (const { g } of partes) for (const [k, a] of Object.entries(g.attributes)) if (!nombres.has(k)) nombres.set(k, (a as THREE.BufferAttribute).itemSize)
  let nv = 0
  for (const { g } of partes) nv += g.getAttribute("position").count
  const out = new THREE.BufferGeometry()
  for (const [k, sz] of nombres) {
    const arr = new Float32Array(nv * sz)
    let o = 0
    for (const { g } of partes) {
      const a = g.getAttribute(k) as THREE.BufferAttribute | undefined
      const n = g.getAttribute("position").count
      if (a) arr.set(a.array as Float32Array, o * sz)
      else if (k === "aW") for (let i = 0; i < n; i++) arr[(o + i) * sz] = 1
      o += n
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, sz))
  }
  const reg = new Float32Array(nv)
  { let o = 0; for (const { g, reg: r } of partes) { const n = g.getAttribute("position").count; reg.fill(r, o, o + n); o += n } }
  out.setAttribute("aReg", new THREE.BufferAttribute(reg, 1))
  // morphs (boca, parpadeo): posiciones siempre; normales si alguna parte las trae
  const conN = partes.some(({ g }) => g.morphAttributes.normal?.length)
  const morph = (tipo: "position" | "normal") => [0, 1].map((t) => {
    const arr = new Float32Array(nv * 3)
    let o = 0
    for (const { g } of partes) {
      const a = g.morphAttributes[tipo]?.[t]
      if (a) arr.set(a.array as Float32Array, o * 3)
      o += g.getAttribute("position").count
    }
    return new THREE.BufferAttribute(arr, 3)
  })
  out.morphAttributes.position = morph("position")
  if (conN) out.morphAttributes.normal = morph("normal")
  out.morphTargetsRelative = true
  const idx: number[] = []
  const fin: number[] = []
  let o = 0
  for (const { g, doble } of partes) {
    const ix = g.index!
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + o)
    if (doble) for (let i = 0; i < ix.count; i += 3) idx.push(ix.getX(i) + o, ix.getX(i + 2) + o, ix.getX(i + 1) + o)
    fin.push(idx.length)
    o += g.getAttribute("position").count
  }
  out.setIndex(nv < 65535 ? new THREE.BufferAttribute(Uint16Array.from(idx), 1) : new THREE.BufferAttribute(Uint32Array.from(idx), 1))
  for (const { g } of partes) g.dispose()
  return { g: out, fin, nPrimera: partes[0].g.getAttribute("position").count }
}

export interface CabezaMH {
  grupo: THREE.Group
  /** Una malla (la cabeza entera) o dos con `pielAparte` (piel; ojos, cejas, pestañas y dientes). */
  mallas: THREE.Mesh[]
  /** La malla que lleva la piel (los vértices de piel son los primeros `nPiel` de su geometría). */
  piel: THREE.Mesh
  nPiel: number
  /** Índices de la piel (los primeros de la geometría de `piel`). */
  nIdxPiel: number
  /** Índices a dibujar de cerca y de lejos (sin pestañas, dientes ni lengua) en la malla de las facciones. */
  lod: { malla: THREE.Mesh; cerca: number; lejos: number }
  setBoca(x: number): void
  setParpadeo(x: number): void
  triangulos: number
  dibujos: number
  /** uniforms de la piel (el montaje pone el tono del cuerpo de hoy en la costura) */
  uPiel: UniformesPiel
  /** Uniformes de cejas y pestañas (los androides los cambian). */
  uCejas: UniformesCejas
  /** Geometrías, materiales y texturas propias de esta cabeza (no las compartidas del caché). */
  recursos: Array<{ dispose(): void }>
}

/** Construye la cabeza (en decímetros, frame de MakeHuman): una malla y un material (una llamada de dibujo). */
export async function construirCabeza(d: DatosCabeza, op: OpcionesCabeza): Promise<CabezaMH> {
  const B = d.base
  const T = d.cab.texturas
  const lin = (hex: string) => new THREE.Color(hex)
  // texturas compartidas (una sola vez para todas las cabezas)
  const [tPiel, poros0, tOjo, tCejas] = await Promise.all([
    tex(`${B}/_comun/piel-${T.piel}${op.calidad === "baja" ? "-512" : ""}.jpg`),
    tex(`${B}/_comun/poros.png`, false),
    tex(`${B}/_comun/ojo.png`),
    tex(`${B}/_comun/cejas-pestanas.png`),
  ])
  const media = mediaCara(tPiel)
  const alb = albedoPiel(op.piel)
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(op.piel).getHSL(hsl)
  const k = 0.25 + 0.5 * hsl.l
  const poros = porosRepetidos(poros0)
  const cPiel = new THREE.Color(op.piel)
  const Ylum = 0.2126 * cPiel.r + 0.7152 * cPiel.g + 0.0722 * cPiel.b
  const oscura = 1 - THREE.MathUtils.smoothstep(Ylum, 0.04, 0.3)
  const U: UniformesPiel = {
    uCuerpo: { value: alb.clone() },
    uLlenado: { value: 1.0 + 1.0 * oscura },
    uTibio: { value: new THREE.Color(1.12, 0.98, 0.88) },
    uTibioK: { value: 0.4 },
    uBorde: { value: 0.08 + 0.17 * oscura },
    uBordeCol: { value: new THREE.Color(1.0, 0.85, 0.72) },
    uPiel: { value: alb.clone() },
    uCostura: { value: 0 },
    uPeloHoy: { value: new THREE.Color(0.03, 0.025, 0.02) },
    uCuerpoTibio: { value: 0 },
    uRugCuerpo: { value: -1 },
  }
  // iris: el hex de la ficha hacia su gris (los oscuros conservan el matiz: 45 % en claros → 12 % en oscuros) y
  // algo más oscuro, con piso de luminancia (un marrón oscuro de ficha en albedo es un disco negro de muñeco)
  const ci = lin(op.iris ?? T.iris ?? "#5a4030"), gi = (ci.r + ci.g + ci.b) / 3
  const Yi = 0.2126 * ci.r + 0.7152 * ci.g + 0.0722 * ci.b, kd = 0.12 + 0.33 * THREE.MathUtils.smoothstep(Yi, 0.02, 0.12)
  const irisCol = new THREE.Color(ci.r * (1 - kd) + gi * kd, ci.g * (1 - kd) + gi * kd, ci.b * (1 - kd) + gi * kd).multiplyScalar(0.8)
  { const Y = 0.2126 * irisCol.r + 0.7152 * irisCol.g + 0.0722 * irisCol.b; if (Y < 0.07) irisCol.multiplyScalar(0.07 / Math.max(Y, 1e-3)) }
  const colC = colorCejas(op.cejas, op.pelo, op.canas ?? 0)
  const uCejas: UniformesCejas = {
    uColC: { value: colC },
    uColP: { value: colC.clone().multiplyScalar(0.3).lerp(new THREE.Color(0.03, 0.02, 0.014), 0.65) },
    uLuz: { value: 0 },
    uSinCejas: { value: 0 },
  }
  const uMsaa = { value: 1 }
  const mat = matCabeza(tPiel, poros, tOjo, tCejas, {
    tinte: new THREE.Color(alb.r / media.r, alb.g / media.g, alb.b / media.b),
    rugosidad: 0.6 - 0.25 * (op.brillo ?? 0) - 0.12 * oscura,
    sheen: 0.3 - 0.15 * oscura,
    sheenColor: new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8), Math.min(0.9, hsl.l * 0.9 + 0.1)).multiplyScalar(0.5),
    // (más especular en la piel oscura daba un velo gris plateado a mediodía: se baja y el brillo queda chico)
    especular: 0.5 - 0.34 * oscura,
    sss: new THREE.Color(0.95 * k, 0.32 * k, 0.2 * k),
    pelo: lin(op.barba ?? op.pelo ?? "#1a1410").multiplyScalar(0.45),
    calva: alb,
    sombraOjos: d.cab.partes["piel.maq"] ? lin(op.sombraOjos ?? "#000000") : null,
    iris: irisCol,
    radioIris: op.radioIris ?? 0.063,
    cobertura: !!op.cobertura,
  }, U, uCejas, uMsaa)

  // ── geometrías ──
  const gPiel = geometria(d, "piel")!
  // ojos: el globo (la córnea de MakeHuman sale: es el barniz del material)
  const gOjos = geometria(d, "ojos")!
  {
    const uvO = gOjos.getAttribute("uv") as THREE.BufferAttribute, ixO = gOjos.index!
    const globo: number[] = []
    for (let t = 0; t < ixO.count; t += 3) {
      const a = ixO.getX(t), b = ixO.getX(t + 1), c = ixO.getX(t + 2)
      const u = (uvO.getX(a) + uvO.getX(b) + uvO.getX(c)) / 3, v = (uvO.getY(a) + uvO.getY(b) + uvO.getY(c)) / 3
      if (!(u > 0.86 && v < 0.14)) globo.push(a, b, c)
    }
    gOjos.setIndex(globo)
  }
  // cejas y pestañas: uv al atlas compartido (scripts/caras-mh/atlas-cejas.py); aVar.x = densidad de la capa
  const gC = geometria(d, "cejas")!, gP = geometria(d, "pestanas")!
  {
    const uvC = gC.getAttribute("uv") as THREE.BufferAttribute, uvP = gP.getAttribute("uv") as THREE.BufferAttribute
    for (let i = 0; i < uvC.count; i++) uvC.setY(i, 1 - 0.25 * (1 - uvC.getY(i)))
    for (let i = 0; i < uvP.count; i++) uvP.setXY(i, uvP.getX(i) * 0.5, 1 - (144 + 256 * (1 - uvP.getY(i))) / 512)
    if (!gC.getAttribute("aVar")) gC.setAttribute("aVar", new THREE.BufferAttribute(new Float32Array(uvC.count * 2).fill(1), 2))
  }
  const gD = geometria(d, "dientes")!, gL = geometria(d, "lengua")!
  const facciones = [
    { g: gOjos, reg: REG.ojos },
    { g: gC, reg: REG.cejas, doble: true },
    { g: gP, reg: REG.pestanas, doble: true },
    { g: gD, reg: REG.dientes },
    { g: gL, reg: REG.lengua },
  ]
  const mallas: THREE.Mesh[] = []
  let piel: THREE.Mesh, lodMalla: THREE.Mesh, fin: [number, number], nPiel: number, nIdxPiel: number
  const sombra = sombraCabeza()
  const nueva = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const malla = new THREE.Mesh(g, m)
    malla.morphTargetInfluences = [0, 0]
    malla.castShadow = true
    malla.customDepthMaterial = sombra.depth
    malla.customDistanceMaterial = sombra.dist
    // con MSAA (calidad alta, retratos) las cejas y pestañas van por cobertura; sin MSAA, recortadas
    malla.onBeforeRender = (renderer) => {
      const rt = renderer.getRenderTarget()
      uMsaa.value = rt && rt.samples > 0 ? 1 : 0
    }
    mallas.push(malla)
    return malla
  }
  if (op.pielAparte) {
    const fp = fundir([{ g: gPiel, reg: REG.piel }])
    piel = nueva(fp.g, mat)
    nPiel = fp.nPrimera
    nIdxPiel = fp.fin[0]
    const ff = fundir(facciones)
    lodMalla = nueva(ff.g, mat)
    // lejos: ojos y cejas (las primeras 2 partes)
    fin = [ff.fin[1], ff.fin[ff.fin.length - 1]]
  } else {
    const ff = fundir([{ g: gPiel, reg: REG.piel }, ...facciones])
    piel = lodMalla = nueva(ff.g, mat)
    nPiel = ff.nPrimera
    nIdxPiel = ff.fin[0]
    // lejos: piel, ojos y cejas (las primeras 3 partes)
    fin = [ff.fin[2], ff.fin[ff.fin.length - 1]]
  }
  const grupo = new THREE.Group()
  for (const m of mallas) grupo.add(m)
  let tris = 0
  for (const m of mallas) tris += m.geometry.index!.count / 3
  const setMorph = (i: number, x: number) => { for (const m of mallas) m.morphTargetInfluences![i] = x }
  // (las texturas son compartidas: no van en recursos)
  const recursos: Array<{ dispose(): void }> = [mat]
  for (const m of mallas) recursos.push(m.geometry)
  return {
    grupo, mallas, piel, nPiel, nIdxPiel, triangulos: tris, uPiel: U, uCejas, recursos,
    lod: { malla: lodMalla, cerca: fin[1], lejos: fin[0] },
    dibujos: mallas.length,
    setBoca: (x) => setMorph(0, x),
    setParpadeo: (x) => setMorph(1, x),
  }
}

/** Los poros se repiten 26 veces sobre la cara: una copia de la textura compartida con su repetición (comparte la imagen). */
let porosRep: THREE.Texture | null = null
function porosRepetidos(base: THREE.Texture): THREE.Texture {
  if (porosRep) return porosRep
  const t = base.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(26, 26)
  t.needsUpdate = true
  porosRep = t
  return t
}
