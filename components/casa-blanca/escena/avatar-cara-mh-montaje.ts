// ──────────────────────────────────────────────────────────────
// Caras MakeHuman (2/3): pone la cabeza MakeHuman sobre un avatar de hoy.
//
// 1. Esconde la cabeza esculpida: pelo/barba/cejas (pelo-*), ojos (ojo-*) y los triángulos de
//    piel cuyo peso es de cabeza, mandíbula, ojos, párpados o cuello.
// 2. Escala la cabeza MH a la altura coronilla-mentón de la de hoy y la centra en los ojos
//    (pose de reposo, coordenadas del avatar).
// 3. Cose el cuello: el anillo de abajo del cuello MH se lleva al borde que quedó en la piel de
//    hoy (por ángulo alrededor del eje del cuello) y la diferencia se reparte hacia arriba.
// 4. Liga todo al MISMO esqueleto: la piel con los pesos de MakeHuman pasados a cabeza / cuello /
//    pecho; ojos, cejas, pelo, barba y dientes rígidos a la cabeza. La boca y el parpadeo son
//    morphs que siguen la rotación de los huesos mandibula y parpadoI que ya mueve avatar-anim.
// 5. El pelo y la barba de HOY se reajustan sobre la cara MH. En la web van HORNEADOS
//    (pelo-hoy.bin, con la huella del pelo de hoy): el reajuste en vivo tarda segundos y solo lo
//    usa el horneado (scripts/caras-mh/), nunca la página (`reajusteVivo`).
// ──────────────────────────────────────────────────────────────
import * as THREE from "three"
import type { Avatar } from "./contrato"
import { H } from "./avatar-cuerpo"
import type { CabezaMH, DatosCabeza } from "./avatar-cara-mh-cabeza"

const HUESOS_CABEZA = [H.cabeza, H.mandibula, H.ojoI, H.ojoD, H.parpadoI, H.parpadoD]

export interface Montada {
  /** Boca y parpadeo siguen a los huesos `mandibula` y `parpadoI` (después de animar). Sin asignaciones. */
  actualizar(): void
  info: Record<string, number | string>
  /** pelo de hoy reajustado (lo guarda el horneado: pelo-hoy.*) */
  horneable: PeloHorneado | null
  /** Mallas nuevas del avatar (cabeza MH y la pasada del borde del pelo): van a sus listas (rayos X, conteos). */
  mallas: THREE.SkinnedMesh[]
  /** Materiales y texturas que creó el montaje (clones por avatar); no las compartidas. */
  recursos: Array<{ dispose(): void }>
  /** Triángulos y llamadas de dibujo que suma (o resta, si es negativo) al avatar. */
  triangulos: number
  dibujos: number
  /** Nivel de detalle: de lejos, sin pestañas, dientes, lengua, la pasada del borde del pelo ni la sombra de la cabeza. Sin asignaciones. */
  detalle(cerca: boolean): void
}
export interface OpcionesMontaje { ajusteZ?: number; ajusteY?: number; escala?: number; peloHoy?: boolean; bajaCostura?: number; sinBarbaHoy?: boolean; sinBigoteHoy?: boolean; bigoteBaja?: number; cueroSuave?: number; rizoFino?: number; barbaEspesor?: number; peloHorneado?: PeloHorneado | null; reajusteVivo?: boolean; bordePelo?: boolean; trisAvatar?: number; topeTris?: number; diagnostico?: boolean; mats?: MatsMontaje }
export interface PeloHorneado { n: number; pos: Float32Array; idx: Uint32Array; cuero: Float32Array | null; huella?: string }
/** FASE 6: huella del pelo de HOY antes del reajuste (posiciones a 0,1 mm + nº de índices). Si el pelo de hoy
 *  cambia en el repo (avatar-pelo.ts, la ficha), la huella no coincide y el horneado NO se aplica. */
export function huellaPelo(pa: THREE.BufferAttribute, nIdx: number): string {
  let h = 0x811c9dc5 ^ pa.count, h2 = 0x01000193 ^ nIdx
  const a = pa.array as Float32Array
  for (let i = 0; i < pa.count * 3; i++) { const v = Math.round(a[i] * 1e4) | 0; h = Math.imul(h ^ v, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ (v >>> 3), 0x85ebca6b) >>> 0 }
  return h.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
}

/** El lote de pelo de HOY del avatar (material `pelo-*`), sin tocarlo. */
export function peloDeHoy(av: Avatar): THREE.SkinnedMesh | null {
  let r: THREE.SkinnedMesh | null = null
  av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!r && m.isSkinnedMesh && ((m.material as THREE.Material).name || "").startsWith("pelo-")) r = m })
  return r
}
/** Huella del pelo de hoy de un avatar recién armado (antes de montar), o null si no tiene. */
export function huellaDe(av: Avatar): { huella: string; n: number } | null {
  const m = peloDeHoy(av)
  if (!m) return null
  const g = m.geometry, pa = g.getAttribute("position") as THREE.BufferAttribute
  return { huella: huellaPelo(pa, g.index ? g.index.count : 0), n: pa.count }
}

/** FASE 6 (consistencia): la piel de HOY del avatar (material compartido por tono en avatar-materiales.ts)
 *  se clona para ESTE avatar y recibe el mismo relleno de sombra y la misma luz del cielo entibiada que la
 *  piel MH (mismos uniformes: uTibio, uTibioK, uLlenado). Sin esto la cara MH es cálida y el cuello/manos
 *  de hoy a la sombra salen verde oliva/grises (Lincoln bajo la barba). No toca el borde ni la cavidad. */
function pielCuerpoComoMH(orig: THREE.MeshPhysicalMaterial, U: { uTibio: { value: THREE.Color }; uTibioK: { value: number }; uLlenado: { value: number } }): THREE.Material {
  const m = orig.clone()
  const prev = orig.onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r)
    sh.uniforms.uTibio = U.uTibio; sh.uniforms.uTibioK = U.uTibioK; sh.uniforms.uLlenado = U.uLlenado
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTibio;\nuniform float uTibioK;\nuniform float uLlenado;")
      .replace("#include <lights_fragment_end>", [
        "\t{",
        "\t\tvec3 W3 = vec3( 0.2126, 0.7152, 0.0722 );",
        "\t\tfloat dirRel = dot( reflectedLight.directDiffuse, W3 ) / max( 1e-4, dot( diffuseColor.rgb, W3 ) );",
        "\t\tfloat ll = mix( 1.0, uLlenado, 1.0 - smoothstep( 0.0, 0.35, dirRel ) );",
        "\t\tirradiance = mix( irradiance, dot( irradiance, W3 ) * uTibio, uTibioK ) * ll;",
        "\t\t#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )",
        "\t\tiblIrradiance = mix( iblIrradiance, dot( iblIrradiance, W3 ) * uTibio, uTibioK ) * ll;",
        "\t\t#endif",
        "\t}",
        "#include <lights_fragment_end>",
      ].join("\n"))
  }
  const key = orig.customProgramCacheKey?.() ?? ""
  m.customProgramCacheKey = () => key + "|mh-tibio"
  return m
}

/** Materiales del pelo de hoy sobre la cara MH (FASE 4): la pasada opaca (alfa recortado + alpha-to-coverage, la de
 *  hoy) y, con `conBorde`, una transparente SOLO para el borde de las hebras (alfa < corte): bordes suaves. Las dos
 *  con la luz del cielo entibiada: a la sombra el pelo claro salía celeste/turquesa. */
function materialesPelo(base: THREE.MeshPhysicalMaterial, conBorde: boolean): { op: THREE.Material; tr: THREE.Material | null } {
  const tibio = (mm: THREE.MeshPhysicalMaterial, borde: boolean) => {
    mm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <lights_fragment_end>", [
          "\t{ vec3 W3 = vec3( 0.2126, 0.7152, 0.0722 );",
          "\t  irradiance = mix( irradiance, dot( irradiance, W3 ) * vec3( 1.1, 1.0, 0.9 ), 0.6 );",
          "\t  #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )",
          "\t  iblIrradiance = mix( iblIrradiance, dot( iblIrradiance, W3 ) * vec3( 1.1, 1.0, 0.9 ), 0.6 );",
          "\t  radiance = mix( radiance, dot( radiance, W3 ) * vec3( 1.05, 1.0, 0.95 ), 0.7 );",
          "\t  #endif",
          "\t}",
          "#include <lights_fragment_end>",
        ].join("\n"))
      // el borde solo de las capas de hebras de verdad: las capas casi transparentes del lote (el cuero de
      // un calvo, el final del degradé) quedaban como un velo
      if (borde) sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\n\tif ( diffuseColor.a >= " + base.alphaTest.toFixed(3) + " ) discard;\n#ifdef USE_COLOR_ALPHA\n\tif ( vColor.a < 0.6 ) discard;\n#endif")
    }
    mm.customProgramCacheKey = () => "mh-pelo-hoy" + (borde ? "-borde" : "")
  }
  const op = base.clone(); tibio(op, false)
  if (!conBorde) return { op, tr: null }
  const tr = base.clone(); tr.transparent = true; tr.depthWrite = false; tr.alphaToCoverage = false; tr.alphaTest = 0.22; tibio(tr, true)
  return { op, tr }
}

/** Materiales que el montaje pone en el avatar, hechos ANTES de tocarlo: así se pueden compilar aparte (sin un tirón
 *  en el primer cuadro) y el montaje solo los asigna. */
export interface MatsMontaje {
  pelo: { op: THREE.Material; tr: THREE.Material | null } | null
  piel: THREE.Material | null
  recursos: Array<{ dispose(): void }>
  /** Geometría + material de cada uno, para compilarlos con una malla de muestra (avatar-cara-mh.ts). */
  muestras: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }>
}
export function materialesMontaje(av: Avatar, cab: CabezaMH, op: OpcionesMontaje): MatsMontaje {
  let andro = false
  let piel: THREE.SkinnedMesh | null = null
  av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return; const n = (m.material as THREE.Material).name || ""; if (n.startsWith("androide-piel")) andro = true; if (n.startsWith("piel-") || n.startsWith("androide-piel")) piel = m })
  const pelo = andro || !op.peloHoy ? null : peloDeHoy(av)
  const r: MatsMontaje = { pelo: null, piel: null, recursos: [], muestras: [] }
  if (pelo) {
    let base = pelo.material as THREE.MeshPhysicalMaterial
    // FASE 5 g3: rizos más chicos (montaje.rizoFino = factor de repetición): con la cara realista, los bucles de
    // 1,5–2 cm de texRizos se leían como manchas ("cerebro") en el pelo y la barba de Marco Aurelio
    if (op.rizoFino && base.map) { const pmc = base.clone(); pmc.map = base.map.clone(); pmc.map.repeat.multiplyScalar(op.rizoFino); pmc.map.needsUpdate = true; r.recursos.push(pmc, pmc.map); base = pmc }
    r.pelo = materialesPelo(base, op.bordePelo !== false)
    r.recursos.push(r.pelo.op, ...(r.pelo.tr ? [r.pelo.tr] : []))
    r.muestras.push({ geo: pelo.geometry, mat: r.pelo.op }, ...(r.pelo.tr ? [{ geo: pelo.geometry, mat: r.pelo.tr }] : []))
  }
  if (piel && !andro) {
    const P = piel as THREE.SkinnedMesh
    r.piel = pielCuerpoComoMH(P.material as THREE.MeshPhysicalMaterial, cab.uPiel)
    r.recursos.push(r.piel)
    r.muestras.push({ geo: P.geometry, mat: r.piel })
  }
  return r
}

/** Clave numérica (exacta) de una posición a 0,05 mm: para soldar vértices partidos por la costura UV sin cadenas. */
const clavePos = (x: number, y: number, z: number) => ((Math.round(x * 2e4) + 65536) * 131072 + (Math.round(y * 2e4) + 65536)) * 131072 + (Math.round(z * 2e4) + 65536)

/** FASE 5 g3: cuero bajo el pelo SUAVIZADO (montaje.cueroSuave = pasadas): la máscara por vértice (rayos) dejaba una
 *  escalera oscura en la frente (Jesús, Marco); se promedia con los vecinos y se encoge un poco. Solo lee la
 *  geometría de la cabeza: avatar-cara-mh.ts lo hace antes de montar (`escala` 0,1: la cabeza todavía en dm). */
export function suavizarCuero(g: THREE.BufferGeometry, cuero: Float32Array, pasadas: number, escala = 1): Float32Array {
  const pm = g.getAttribute("position") as THREE.BufferAttribute, ixm = g.index!
  const mapa = new Map<number, number>(), sold = new Int32Array(pm.count)
  for (let i = 0; i < pm.count; i++) { const k = clavePos(pm.getX(i) * escala, pm.getY(i) * escala, pm.getZ(i) * escala); if (!mapa.has(k)) mapa.set(k, i); sold[i] = mapa.get(k)! }
  const vec: number[][] = Array.from({ length: pm.count }, () => [])
  for (let t = 0; t < ixm.count; t += 3) for (let k = 0; k < 3; k++) { const a2 = sold[ixm.getX(t + k)], b2 = sold[ixm.getX(t + (k + 1) % 3)]; vec[a2].push(b2); vec[b2].push(a2) }
  let c0 = new Float32Array(pm.count); for (let i = 0; i < pm.count; i++) c0[sold[i]] = Math.max(c0[sold[i]], cuero[i] ?? 0)
  for (let it = 0; it < pasadas; it++) { const c1 = c0.slice(); for (let i = 0; i < pm.count; i++) if (vec[i].length) { let sm = c0[i]; for (const j of vec[i]) sm += c0[j]; c1[i] = sm / (vec[i].length + 1) } c0 = c1 }
  const out = new Float32Array(pm.count); for (let i = 0; i < pm.count; i++) out[i] = THREE.MathUtils.smoothstep(c0[sold[i]], 0.3, 0.85)
  return out
}

function reposo(sk: THREE.Skeleton, i: number): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert())
}

/** La pasada del borde del pelo de hoy (material `tr`): solo con los triángulos que pueden tener borde: capas de hebras
 *  de verdad (alfa del vértice >= 0,6) y no las de abajo (aMat.y = 1, opacas). Comparte los atributos del lote. */
function bordeDelPelo(m: THREE.SkinnedMesh, tr: THREE.Material): { malla: THREE.SkinnedMesh; geo: THREE.BufferGeometry; tris: number } {
  const g = m.geometry, ix = g.index!
  const col = g.getAttribute("color") as THREE.BufferAttribute | undefined
  const mat = g.getAttribute("aMat") as THREE.BufferAttribute | undefined
  const sirve = (v: number) => (!col || col.itemSize < 4 || col.getW(v) >= 0.6) && (!mat || mat.getY(v) < 0.5)
  const sub: number[] = []
  for (let t = 0; t < ix.count; t += 3) { const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2); if (sirve(a) || sirve(b) || sirve(c)) sub.push(a, b, c) }
  const g2 = new THREE.BufferGeometry()
  for (const k of Object.keys(g.attributes)) g2.setAttribute(k, g.getAttribute(k))
  g2.setIndex(sub)
  const m2 = new THREE.SkinnedMesh(g2, tr)
  m2.bind(m.skeleton, m.bindMatrix)
  m2.renderOrder = 3; m2.castShadow = false; m2.frustumCulled = false
  m.parent?.add(m2)
  return { malla: m2, geo: g2, tris: sub.length / 3 }
}

export function montarCabezaMH(av: Avatar, cab: CabezaMH, d: DatosCabeza, op: OpcionesMontaje = {}): Montada {
  // tiempos por etapa (ms): el montaje es síncrono y corre entre dos cuadros
  const tm: Record<string, number> = {}
  let tPrev = performance.now()
  const marca = (k: string) => { const t = performance.now(); tm["t_" + k] = Math.round((t - tPrev) * 10) / 10; tPrev = t }
  const recursos: Array<{ dispose(): void }> = []
  const extra: THREE.SkinnedMesh[] = []
  let deltaTris = 0, deltaDibujos = 0
  let bordePeloHoy: ReturnType<typeof bordeDelPelo> | null = null
  // los materiales nuevos (pelo de hoy, piel de hoy): hechos antes (y compilados) por avatar-cara-mh.ts, o aquí
  const mats = op.mats ?? materialesMontaje(av, cab, op)
  recursos.push(...mats.recursos)
  let piel: THREE.SkinnedMesh | null = null
  let peloHoy: THREE.SkinnedMesh | null = null
  const ocultas: string[] = []
  let ocultasTris = 0
  // FASE 5 g3: androide (piel "androide-piel-*"): sin pelo de hoy (solo trae pestañas), se esconde todo
  let andro = false
  av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && ((m.material as THREE.Material).name || "").startsWith("androide-piel")) andro = true })
  if (andro) op = { ...op, peloHoy: false }
  av.raiz.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) return
    const n = (m.material as THREE.Material).name || ""
    if (n.startsWith("piel-") || n.startsWith("androide-piel")) piel = m
    if (n.startsWith("pelo-") && op.peloHoy) { peloHoy = m; return }
    if (n.startsWith("pelo-") || n.startsWith("ojo-")) { if (m.visible) { deltaDibujos--; deltaTris -= (m.geometry.index ? m.geometry.index.count : 0) / 3 } m.visible = false; ocultas.push(n); ocultasTris += (m.geometry.index ? m.geometry.index.count : 0) / 3 }
  })
  if (!piel) throw new Error("sin piel")
  const P = piel as THREE.SkinnedMesh
  const sk = P.skeleton
  const g0 = P.geometry
  const pos = g0.getAttribute("position") as THREE.BufferAttribute
  const si = g0.getAttribute("skinIndex") as THREE.BufferAttribute
  const sw = g0.getAttribute("skinWeight") as THREE.BufferAttribute
  const wDe = (v: number, huesos: number[]) => { let s = 0; for (let k = 0; k < 4; k++) if (huesos.includes(si.getComponent(v, k))) s += sw.getComponent(v, k); return s }
  const nv = pos.count
  const wCab = new Float32Array(nv), wCue = new Float32Array(nv), wMan = new Float32Array(nv)
  for (let v = 0; v < nv; v++) { wCab[v] = wDe(v, HUESOS_CABEZA); wCue[v] = wDe(v, [H.cuello]); wMan[v] = wDe(v, [H.mandibula]) }
  // medidas de la cabeza de hoy (antes de esconderla)
  const eL = reposo(sk, H.ojoI), eR = reposo(sk, H.ojoD)
  const ojosHoy = eL.clone().add(eR).multiplyScalar(0.5)
  let corona = -1e9, menton = 1e9
  for (let v = 0; v < nv; v++) {
    if (wCab[v] > 0.95) corona = Math.max(corona, pos.getY(v))
    if (wMan[v] > 0.4 && pos.getZ(v) > ojosHoy.z - 0.02) menton = Math.min(menton, pos.getY(v))
  }
  const yCuelloHoy = reposo(sk, H.cuello).y
  marca("medir")
  // ropa (para medir el cuello de la camisa cuando la piel de hoy no existe debajo)
  let ropa: THREE.SkinnedMesh | null = null
  av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && ((m.material as THREE.Material).name || "").startsWith("ropa-")) ropa = m })

  // ── transformación MH (dm) → avatar (m): escala por coronilla-mentón, centro en los ojos ──
  const pt = d.cab.puntos
  const ojosMH = new THREE.Vector3(...(pt.ojoL as [number, number, number])).add(new THREE.Vector3(...(pt.ojoR as [number, number, number]))).multiplyScalar(0.5)
  const altoMH = pt.coronilla - pt.menton[1]
  const s = ((corona - menton) / altoMH) * (op.escala ?? 1)
  const destino = ojosHoy.clone().add(new THREE.Vector3(0, op.ajusteY ?? 0, op.ajusteZ ?? 0))
  const M = new THREE.Matrix4().makeTranslation(destino.x, destino.y, destino.z).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-ojosMH.x, -ojosMH.y, -ojosMH.z))
  for (const m of cab.mallas) {
    const g = m.geometry
    if (g.userData.montada) continue
    g.applyMatrix4(M)
    for (const ma of g.morphAttributes.position ?? []) for (let i = 0; i < ma.count; i++) ma.setXYZ(i, ma.getX(i) * s, ma.getY(i) * s, ma.getZ(i) * s)
    g.userData.montada = true
  }
  // anillo de abajo del cuello MH: eje (centro), y su alto y radio por ángulo
  const gp = cab.piel.geometry
  const pp = gp.getAttribute("position") as THREE.BufferAttribute
  const anilloIdx = new Uint16Array(d.bin, d.cab.partes["piel.anillo"].off, d.cab.partes["piel.anillo"].n)
  let cx = 0, cz = 0
  for (const i of anilloIdx) { cx += pp.getX(i) / anilloIdx.length; cz += pp.getZ(i) / anilloIdx.length }
  // Cizalla del cuello: la cabeza MH va alineada por los ojos, pero el cuello de hoy puede estar más
  // atrás (encorvado). El cuello MH se corre (solo debajo del mentón) hasta el centro del cuello de hoy.
  let yAn = 0; for (const i of anilloIdx) yAn += pp.getY(i) / anilloIdx.length
  let sx = 0, sz = 0, sn = 0
  for (let v = 0; v < nv; v++) if (wCue[v] > 0.3 && Math.abs(pos.getY(v) - yAn) < 0.015) { sx += pos.getX(v); sz += pos.getZ(v); sn++ }
  if (sn < 6) { const c = reposo(sk, H.cuello); sx = c.x; sz = c.z } else { sx /= sn; sz /= sn }
  const yMentonMH = menton
  const dX = sx - cx, dZ = sz - cz
  const cizalla = (g: THREE.BufferGeometry) => {
    const pa = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i)
      const w = THREE.MathUtils.smoothstep(yMentonMH - y, -0.01, yMentonMH - yAn)
      if (w > 0) pa.setXYZ(i, pa.getX(i) + dX * w, y, pa.getZ(i) + dZ * w)
    }
    pa.needsUpdate = true
  }
  for (const m of cab.mallas) if (!m.geometry.userData.cizalla) { cizalla(m.geometry); m.geometry.userData.cizalla = true }
  marca("ubicar")
  cx = sx; cz = sz
  const ang = (x: number, z: number) => Math.atan2(x - cx, z - cz)
  const enAngulo = <T>(lista: Array<{ a: number; v: T }>, a: number, mezcla: (x: T, y: T, f: number) => T): T => {
    const n = lista.length
    let j = lista.findIndex((e) => e.a > a)
    if (j < 0) j = 0
    const i = (j - 1 + n) % n
    const a0 = lista[i].a, a1 = lista[j].a + (j === 0 ? 2 * Math.PI : 0)
    const aa = a < a0 ? a + 2 * Math.PI : a
    const f = a1 - a0 > 1e-6 ? (aa - a0) / (a1 - a0) : 0
    return mezcla(lista[i].v, lista[j].v, THREE.MathUtils.clamp(f, 0, 1))
  }
  const lerpN = (x: number, y: number, f: number) => x + (y - x) * f
  const _lv = new THREE.Vector3()
  /** (escribe en un vector reusado: se lee enseguida) */
  const lerpV = (x: THREE.Vector3, y: THREE.Vector3, f: number) => _lv.copy(x).lerp(y, f)
  const anMH = [...anilloIdx].map((i) => ({ a: ang(pp.getX(i), pp.getZ(i)), y: pp.getY(i), r: Math.hypot(pp.getX(i) - cx, pp.getZ(i) - cz) })).sort((x, y) => x.a - y.a)
  // (las listas por ángulo se arman una vez: se consultan por cada vértice de la cabeza y del pelo)
  const anY = anMH.map((e) => ({ a: e.a, v: e.y })), anR = anMH.map((e) => ({ a: e.a, v: e.r }))
  const yMHen = (a: number) => enAngulo(anY, a, lerpN)
  const rMHen = (a: number) => enAngulo(anR, a, lerpN)

  // ── reajuste radial del pelo y la barba de HOY sobre la cabeza MH (op.peloHoy) ──
  // Desde un centro dentro de la cabeza, cada vértice del pelo guarda su altura sobre el cuero de hoy
  // y se pone a esa misma altura sobre la piel MH, en la misma dirección. Cejas y pestañas de hoy
  // (que van en el mismo lote) se quitan: las pone MakeHuman.
  let reajuste: Record<string, number> = {}
  let horneable: PeloHorneado | null = null
  let cueroMH: Float32Array | null = null
  let colPeloHoy = new THREE.Color(0.05, 0.04, 0.03)
  if (peloHoy) {
    const t0 = performance.now()
    const gp0 = (peloHoy as THREE.SkinnedMesh).geometry as THREE.BufferGeometry
    const pa = gp0.getAttribute("position") as THREE.BufferAttribute
    // color del pelo de hoy (media de los vértices de arriba de los ojos): la piel MH debajo del pelo se
    // pinta de ese color oscurecido (la capa de abajo), así entre las hebras no se ve piel ni cielo
    {
      const col = gp0.getAttribute("color") as THREE.BufferAttribute | undefined
      if (col) { const acc = new THREE.Color(0, 0, 0); let n = 0; for (let i = 0; i < pa.count; i++) if (pa.getY(i) > eL.y + 0.03) { acc.r += col.getX(i); acc.g += col.getY(i); acc.b += col.getZ(i); n++ } if (n) colPeloHoy = acc.multiplyScalar(1 / n) }
    }
    const hz = op.peloHorneado
    const nIdx0 = gp0.index ? gp0.index.count : 0
    const huella = huellaPelo(pa, nIdx0)
    const valido = !!hz && hz.n === pa.count && (!hz.huella || hz.huella === huella)
    // el reajuste en vivo tarda segundos: la página nunca lo hace (avatar-cara-mh.ts ya lo descartó antes de tocar nada)
    if (!valido && !op.reajusteVivo) throw new Error(`pelo-hoy horneado con otro pelo de hoy (huella ${hz?.huella ?? "-"} != ${huella}): hay que re-hornear`)
    deltaTris -= nIdx0 / 3
    if (hz && valido) {
      // HORNEADO (FASE 4): posiciones ya reajustadas, índices sin cejas/pestañas de hoy y la máscara del
      // cuero bajo el pelo. Sin rayos en vivo.
      ;(pa.array as Float32Array).set(hz.pos)
      pa.needsUpdate = true
      gp0.setIndex(new THREE.BufferAttribute(hz.idx, 1))
      // la máscara horneada cubre la piel (los primeros vértices): el resto de la cabeza, en cero
      if (hz.cuero) { cueroMH = new Float32Array(cab.piel.geometry.getAttribute("position").count); cueroMH.set(hz.cuero.subarray(0, Math.min(hz.cuero.length, cueroMH.length))) }
      reajuste = { reajuste_ms: Math.round(performance.now() - t0), horneado: 1 }
    } else {
      const C = new THREE.Vector3(ojosHoy.x, ojosHoy.y + 0.01, ojosHoy.z - 0.085)
      const triHoy: number[] = []
      const ix = g0.index!
      for (let t = 0; t < ix.count; t += 3) { const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2); if (wCab[a] + wCue[a] > 0.5 && wCab[b] + wCue[b] > 0.5 && wCab[c] + wCue[c] > 0.5) triHoy.push(a, b, c) }
      const gHoy = new THREE.BufferGeometry(); gHoy.setAttribute("position", pos); gHoy.setIndex(triHoy)
      const mHoy = new THREE.Mesh(gHoy, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      // solo la piel (la geometría de la cabeza trae también ojos, cejas y dientes)
      const gSoloPiel = new THREE.BufferGeometry()
      gSoloPiel.setAttribute("position", cab.piel.geometry.getAttribute("position"))
      gSoloPiel.setIndex(Array.from({ length: cab.nIdxPiel }, (_, i) => cab.piel.geometry.index!.getX(i)))
      const mMH = new THREE.Mesh(gSoloPiel, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      const NA = 72, NE = 48
      const mapa = (m: THREE.Mesh) => {
        const R = new Float32Array(NA * NE), rc = new THREE.Raycaster()
        for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) {
          const el = -Math.PI / 2 + (Math.PI * (j + 0.5)) / NE, az = (2 * Math.PI * i) / NA
          const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
          rc.set(C, dir)
          const hit = rc.intersectObject(m, false)
          let r = -1
          for (const h of hit) if (h.distance < 0.16) r = h.distance
          R[j * NA + i] = r
        }
        return R
      }
      const Rh = mapa(mHoy), Rm = mapa(mMH)
      // FASE 4: campo de desplazamiento D = Rm − Rh, con los huecos (direcciones que no tocan una de las
      // dos pieles: debajo del mentón, la barba que cuelga) rellenados por difusión desde los vecinos y
      // suavizado. Antes esos vértices no se movían y la barba quedaba despegada (babero).
      const D = new Float32Array(NA * NE), ok = new Uint8Array(NA * NE)
      for (let k = 0; k < NA * NE; k++) if (Rh[k] >= 0 && Rm[k] >= 0) { D[k] = Rm[k] - Rh[k]; ok[k] = 1 }
      const vec = (j: number, i: number) => [[j, (i + 1) % NA], [j, (i - 1 + NA) % NA], [Math.min(NE - 1, j + 1), i], [Math.max(0, j - 1), i]]
      for (let it = 0, falta = 1; it < 400 && falta; it++) {
        falta = 0
        const nuevo: Array<[number, number]> = []
        for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) {
          const k = j * NA + i; if (ok[k]) continue
          let sm = 0, n = 0; for (const [jj, ii] of vec(j, i)) { const kk = jj * NA + ii; if (ok[kk]) { sm += D[kk]; n++ } }
          if (n) nuevo.push([k, sm / n]); else falta++
        }
        for (const [k, v] of nuevo) { D[k] = v; ok[k] = 1 }
        if (!nuevo.length) break
      }
      { const D2 = D.slice(); for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) { let sm = D[j * NA + i] * 2, n = 2; for (const [jj, ii] of vec(j, i)) { sm += D[jj * NA + ii]; n++ } D2[j * NA + i] = sm / n } D.set(D2) }
      const muestra = (R: Float32Array, d: THREE.Vector3, todo = false) => {
        const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), az = Math.atan2(d.x, d.z)
        const fj = (el + Math.PI / 2) / Math.PI * NE - 0.5, fi = ((az + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * NA
        const j0 = THREE.MathUtils.clamp(Math.floor(fj), 0, NE - 1), j1 = Math.min(NE - 1, j0 + 1), tj = THREE.MathUtils.clamp(fj - j0, 0, 1)
        const i0 = Math.floor(fi) % NA, i1 = (i0 + 1) % NA, ti = fi - Math.floor(fi)
        const v = [R[j0 * NA + i0], R[j0 * NA + i1], R[j1 * NA + i0], R[j1 * NA + i1]]
        if (!todo && v.some((x) => x < 0)) return -1
        return (v[0] * (1 - ti) + v[1] * ti) * (1 - tj) + (v[2] * (1 - ti) + v[3] * ti) * tj
      }
      // base de la nariz MH en el avatar: el bigote no sube por encima
      const sub = new THREE.Vector3(...(pt.subnasal as [number, number, number])).applyMatrix4(M)
      const alaX = (pt.alaX as number) * s
      const d = new THREE.Vector3(), p = new THREE.Vector3()
      let movidos = 0, nariz = 0
      for (let i = 0; i < pa.count; i++) {
        p.set(pa.getX(i), pa.getY(i), pa.getZ(i))
        d.subVectors(p, C); const L = d.length(); d.divideScalar(L)
        const rm = muestra(Rm, d)
        let nL = L + muestra(D, d, true)
        if (rm >= 0) nL = Math.max(rm + 0.0005, nL)
        // FASE 5 g2: barba más pegada (montaje.barbaEspesor < 1): de los ojos para abajo, la altura de la
        // hebra sobre la piel MH se escala (Tate: barba recortada de 5-8 mm; la de hoy es de 3 cm)
        if (op.barbaEspesor != null && rm >= 0 && p.y < eL.y - 0.03) { const k = THREE.MathUtils.smoothstep(eL.y - 0.03 - p.y, 0, 0.02); nL = rm + 0.0005 + (nL - rm - 0.0005) * (1 - k + k * op.barbaEspesor) }
        p.copy(C).addScaledVector(d, nL)
        // bigote: lo que quedó sobre la nariz baja hasta la base (comprimido, no cortado)
        if (p.y < eL.y - 0.02 && p.z > sub.z - 0.03) {
          const w = 1 - THREE.MathUtils.smoothstep(Math.abs(p.x - sub.x), alaX * 0.85, alaX * 1.35)
          const tope = sub.y - 0.0025 - (op.bigoteBaja ?? 0) // FASE 5 g3: bigoteBaja (narices respingadas: Sócrates)
          if (w > 0 && p.y > tope) { p.y -= (p.y - tope) * 0.8 * w; p.z = Math.max(p.z, sub.z - 0.004 * (1 - w)); nariz++ }
        }
        pa.setXYZ(i, p.x, p.y, p.z); movidos++
      }
      pa.needsUpdate = true
      // fuera cejas y pestañas de hoy: triángulos alrededor de cada ojo
      const ip = gp0.index!
      const quedanP: number[] = []
      const c3 = new THREE.Vector3()
      for (let t = 0; t < ip.count; t += 3) {
        const a = ip.getX(t), b = ip.getX(t + 1), c = ip.getX(t + 2)
        c3.set((pa.getX(a) + pa.getX(b) + pa.getX(c)) / 3, (pa.getY(a) + pa.getY(b) + pa.getY(c)) / 3, (pa.getZ(a) + pa.getZ(b) + pa.getZ(c)) / 3)
        let ojo = false
        for (const e of [eL, eR]) if (Math.abs(c3.x - e.x) < 0.04 && c3.y - e.y > -0.014 && c3.y - e.y < 0.032 && c3.z > e.z - 0.02) ojo = true
        // FASE 5 g2: barba de hoy fuera (montaje.sinBarbaHoy): barbas al ras (Tate, Kobe) quedan solo
        // pintadas en la piel MH (hornear.mjs::pintadaBarba); las tarjetas de hoy eran un bloque
        if (op.sinBarbaHoy && c3.y < eL.y - 0.045 && (c3.z > eL.z - 0.075 || c3.y < eL.y - 0.07)) ojo = true
        // FASE 5 g3: bigote de hoy fuera (montaje.sinBigoteHoy): el bigote va pintado (bigoteFino); la perilla queda
        if (op.sinBigoteHoy && c3.y < sub.y + 0.006 && c3.y > sub.y - 0.022 && c3.z > sub.z - 0.035 && Math.abs(c3.x - sub.x) < alaX * 2.6) ojo = true
        if (!ojo) quedanP.push(a, b, c)
      }
      gp0.setIndex(quedanP)
      // máscara del cuero bajo el pelo: rayo desde cada vértice de la piel MH (de las orejas para arriba)
      // hacia afuera contra el pelo reajustado
      {
        const gpm = cab.piel.geometry, pm = gpm.getAttribute("position") as THREE.BufferAttribute
        cueroMH = new Float32Array(pm.count)
        const mP = new THREE.Mesh(gp0, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
        const rc = new THREE.Raycaster(); rc.far = 0.035
        const q = new THREE.Vector3(), dd = new THREE.Vector3()
        for (let i = 0; i < cab.nPiel; i++) {
          q.set(pm.getX(i), pm.getY(i), pm.getZ(i))
          if (q.y < eL.y - 0.035) continue
          dd.subVectors(q, C).normalize()
          rc.set(q.clone().addScaledVector(dd, -0.002), dd)
          // solo cuenta el pelo de verdad (alfa del vértice): el lote trae capas casi transparentes
          const colP = gp0.getAttribute("color") as THREE.BufferAttribute | undefined
          for (const h of rc.intersectObject(mP, false)) {
            const f = h.face!; const al = colP && colP.itemSize === 4 ? (colP.getW(f.a) + colP.getW(f.b) + colP.getW(f.c)) / 3 : 1
            if (al > 0.6) { cueroMH[i] = 1; break }
          }
        }
      }
      horneable = { n: pa.count, pos: Float32Array.from(pa.array as Float32Array), idx: Uint32Array.from(quedanP), cuero: cueroMH.slice(0, cab.nPiel), huella }
      reajuste = { reajuste_ms: Math.round(performance.now() - t0), movidos, nariz, quitados: (ip.count - quedanP.length) / 3 }
    }
    // FASE 5 g3: rizos más chicos (montaje.rizoFino = factor de repetición): con la cara realista, los bucles de
    // 1,5–2 cm de texRizos se leían como manchas ("cerebro") en el pelo y la barba de Marco Aurelio
    if (mats.pelo) {
      ;(peloHoy as THREE.SkinnedMesh).material = mats.pelo.op
      if (mats.pelo.tr) {
        const ps = bordeDelPelo(peloHoy as THREE.SkinnedMesh, mats.pelo.tr)
        bordePeloHoy = ps
        // (la geometría del borde comparte atributos con el lote: se libera solo junto con el avatar)
        extra.push(ps.malla); deltaDibujos++
        recursos.push(ps.geo)
        deltaTris += ps.tris
      }
    }
    deltaTris += (peloHoy as THREE.SkinnedMesh).geometry.index!.count / 3
    // FASE 5 g3: cuero bajo el pelo SUAVIZADO (montaje.cueroSuave = pasadas): la máscara por vértice (rayos)
    // dejaba una escalera oscura en la frente (Jesús, Marco); se promedia con los vecinos y se encoge un poco.
    if (cueroMH && op.cueroSuave) cueroMH = suavizarCuero(cab.piel.geometry, cueroMH, op.cueroSuave)
    if (cueroMH) {
      cab.piel.geometry.setAttribute("aCuero", new THREE.BufferAttribute(cueroMH, 1))
      cab.uPiel.uPeloHoy.value.copy(colPeloHoy).multiplyScalar(0.55)
    }
  }
  marca("pelo")
  // ── costura del cuello (v2): el cuello de HOY se queda hasta la altura del anillo MH; el anillo MH
  // se lleva, por ángulo, a la superficie del cuello de hoy a esa misma altura (1,2 mm por fuera, así
  // su borde limpio tapa el borde dentado de la piel de hoy). Sin estirar hacia abajo: no hay "babero".
  const BINS = 48
  const binDe = (x: number, z: number) => Math.floor(((ang(x, z) + Math.PI) / (2 * Math.PI)) * BINS) % BINS
  const enTubo = (v: number) => wCab[v] + wCue[v] > 0.3
  const idx = g0.index!
  const quedan: number[] = []
  // fuera: la cabeza de hoy, y del cuello todo triángulo con ALGÚN vértice por encima del anillo MH
  // el anillo MH decimado zigzaguea en y: la curva de corte es su altura suavizada por ángulo (±3 bins),
  // por debajo del punto más bajo de la ventana (así el borde MH queda recto y no deja dientes)
  const yBin = Array.from({ length: BINS }, (_, k) => yMHen(((k + 0.5) / BINS) * 2 * Math.PI - Math.PI))
  const yS = yBin.map((_, k) => { let s2 = 0, mn = 1e9; for (let d = -3; d <= 3; d++) { const y = yBin[(k + d + BINS) % BINS]; s2 += y; mn = Math.min(mn, y) } return Math.min(s2 / 7, mn + 0.004) })
  const yCorte = (a: number) => { const f = ((a + Math.PI) / (2 * Math.PI)) * BINS - 0.5; const k0 = Math.floor(f), t = f - k0; return yS[(k0 + BINS) % BINS] * (1 - t) + yS[(k0 + 1) % BINS] * t - (op.bajaCostura ?? 0.015) }
  const arriba = (v: number) => enTubo(v) && (wCab[v] > 0.9 || pos.getY(v) > yCorte(ang(pos.getX(v), pos.getZ(v))))
  const enBorde = new Uint8Array(nv), sigue = new Uint8Array(nv)
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
    if (arriba(a) || arriba(b) || arriba(c)) { enBorde[a] = enBorde[b] = enBorde[c] = 1; continue }
    quedan.push(a, b, c); sigue[a] = sigue[b] = sigue[c] = 1
  }
  // COSTURA SOLDADA: la curva C(a) = (radio del cuello de hoy, yCorte(a)) es el borde común. Los
  // vértices del borde de lo que queda de hoy se llevan a C, y el anillo MH también: no hay hueco ni
  // piel de hoy que asome por encima.
  const rB: Array<number | null> = new Array(BINS).fill(null)
  const rLista: number[][] = Array.from({ length: BINS }, () => [])
  const deBorde: number[] = []
  for (let v = 0; v < nv; v++) {
    if (!(enBorde[v] && sigue[v])) continue
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), r = Math.hypot(x - cx, z - cz), a = ang(x, z)
    if (r > rMHen(a) * 1.8 || r < rMHen(a) * 0.4 || Math.abs(y - yCorte(a)) > 0.04) continue
    rLista[binDe(x, z)].push(r); deBorde.push(v)
  }
  rLista.forEach((l, k) => { if (l.length) rB[k] = l.sort((p, q) => p - q)[Math.floor(l.length / 2)] })
  const rellenar = (arr: Array<number | null>) => {
    const n = arr.filter((x) => x !== null).length
    if (!n) return n
    for (let k = 0; k < BINS; k++) if (arr[k] === null) {
      let i = 1; while (arr[(k - i + BINS) % BINS] === null) i++
      let j = 1; while (arr[(k + j) % BINS] === null) j++
      const p0 = arr[(k - i + BINS) % BINS]!, p1 = arr[(k + j) % BINS]!
      arr[k] = p0 + (p1 - p0) * (i / (i + j))
    }
    return n
  }
  const llenos = rellenar(rB)
  const rHoy = rB
  // radio de C por ángulo, suavizado (promedio circular de 5 bins) e interpolado
  const rC = rB.map((_, k) => { let s2 = 0; for (let d = -2; d <= 2; d++) s2 += rB[(k + d + BINS) % BINS] ?? 0; return s2 / 5 })
  const rCen = (a: number) => { const f = ((a + Math.PI) / (2 * Math.PI)) * BINS - 0.5; const k0 = Math.floor(f), t = f - k0; return rC[(k0 + BINS) % BINS] * (1 - t) + rC[(k0 + 1) % BINS] * t }
  let soldados = 0
  if (llenos >= BINS * 0.3) for (const v of deBorde) {
    const a = ang(pos.getX(v), pos.getZ(v)), r = rCen(a)
    pos.setXYZ(v, cx + Math.sin(a) * r, yCorte(a), cz + Math.cos(a) * r); soldados++
  }
  pos.needsUpdate = true
  let tonoCuerpo = ""
  // FASE 4: tono de la piel de HOY en el borde (color del material × color del vértice × media del mapa
  // de detalle): la piel MH se funde a ese albedo en la costura (aExt.y), sin línea de tono.
  {
    const mat = P.material as THREE.MeshPhysicalMaterial
    const col = g0.getAttribute("color") as THREE.BufferAttribute | undefined
    const acc = new THREE.Color(0, 0, 0); let n = 0
    for (const v of deBorde) { if (col) acc.add(new THREE.Color(col.getX(v), col.getY(v), col.getZ(v))); else acc.add(new THREE.Color(1, 1, 1)); n++ }
    if (n) acc.multiplyScalar(1 / n); else acc.setRGB(1, 1, 1)
    let mMap = new THREE.Color(0.9, 0.89, 0.88)
    const img = (mat.map?.image ?? null) as { data?: ArrayLike<number>; width?: number } | null
    if (img && img.data && img.data.length) {
      let r = 0, g = 0, b = 0, c = 0
      for (let i = 0; i < img.data.length; i += 16) { r += Math.pow(img.data[i] / 255, 2.2); g += Math.pow(img.data[i + 1] / 255, 2.2); b += Math.pow(img.data[i + 2] / 255, 2.2); c++ }
      mMap = new THREE.Color(r / c, g / c, b / c)
    }
    const cuerpo = mat.color.clone().multiply(acc).multiply(mMap)
    // rugosidad de la piel de hoy en el borde (roughness × aMat.x, como en avatar-materiales.ts::inyectar)
    {
      const am = g0.getAttribute("aMat") as THREE.BufferAttribute | undefined
      let rs = 0, rn = 0
      for (const v of deBorde) { rs += mat.roughness * (am ? am.getX(v) : 1); rn++ }
      if (rn) cab.uPiel.uRugCuerpo.value = THREE.MathUtils.clamp(rs / rn, 0.05, 1)
    }
    cab.uPiel.uCuerpo.value.copy(cuerpo)
    cab.uPiel.uCostura.value = 1
    // FASE 6: la piel de hoy que queda (cuello, manos, brazos) responde a la luz IGUAL que la cara MH
    if (!andro && mats.piel) { P.material = mats.piel; cab.uPiel.uCuerpoTibio.value = 1 }
    tonoCuerpo = cuerpo.getHexString()
  }
  marca("costura")
  // pesos de hoy en el borde, por ángulo: el anillo MH los copia (y los mezcla con los suyos en 3 cm)
  // para doblarse IGUAL que la piel de hoy con la que está soldado; si no, al animar se abre la costura
  const pesoBin: Array<{ d: number; I: number[]; W: number[] } | null> = new Array(BINS).fill(null)
  for (const v of deBorde) {
    const a = ang(pos.getX(v), pos.getZ(v)), f = ((a + Math.PI) / (2 * Math.PI)) * BINS, k = Math.floor(f) % BINS, d = Math.abs(f - k - 0.5)
    if (!pesoBin[k] || d < pesoBin[k]!.d) pesoBin[k] = { d, I: [0, 1, 2, 3].map((j) => si.getComponent(v, j)), W: [0, 1, 2, 3].map((j) => sw.getComponent(v, j)) }
  }
  { let n0 = 0; for (const p0 of pesoBin) if (p0) n0++
    if (n0) for (let k = 0; k < BINS; k++) if (!pesoBin[k]) { let i = 1; while (!pesoBin[(k + i) % BINS] && !pesoBin[(k - i + BINS) % BINS]) i++; pesoBin[k] = pesoBin[(k + i) % BINS] ?? pesoBin[(k - i + BINS) % BINS] } }
  // normal del cuello de hoy en el borde, por ángulo (promedio del bin; los vacíos, del vecino)
  const nBin: Array<THREE.Vector3 | null> = new Array(BINS).fill(null)
  {
    const nh = g0.getAttribute("normal") as THREE.BufferAttribute | undefined
    if (nh) {
      for (const v of deBorde) { const k = binDe(pos.getX(v), pos.getZ(v)); (nBin[k] ??= new THREE.Vector3()).add(new THREE.Vector3(nh.getX(v), nh.getY(v), nh.getZ(v))) }
      for (const n of nBin) n?.normalize()
      if (nBin.some(Boolean)) for (let k = 0; k < BINS; k++) if (!nBin[k]) { let i = 1; while (!nBin[(k + i) % BINS] && !nBin[(k - i + BINS) % BINS]) i++; nBin[k] = (nBin[(k + i) % BINS] ?? nBin[(k - i + BINS) % BINS])!.clone() }
    }
  }
  const deltas: Array<{ a: number; v: THREE.Vector3 }> = []
  let maxDelta = 0
  for (const i of anilloIdx) {
    const p = new THREE.Vector3(pp.getX(i), pp.getY(i), pp.getZ(i))
    const a = ang(p.x, p.z), r0 = Math.hypot(p.x - cx, p.z - cz)
    const ok = llenos >= BINS * 0.3, k = binDe(p.x, p.z)
    const rt = ok ? rCen(a) + 0.0008 : r0
    const dy = ok ? yCorte(a) - 0.002 - p.y : 0
    const dlt = new THREE.Vector3(Math.sin(a) * rt + cx - p.x, dy, Math.cos(a) * rt + cz - p.z)
    maxDelta = Math.max(maxDelta, dlt.length())
    deltas.push({ a, v: dlt })
  }
  deltas.sort((x, y) => x.a - y.a)
  // la corrección radial se reparte del anillo al mentón (suave: 1 en el anillo, 0 en el mentón)
  const estirar = (g: THREE.BufferGeometry) => {
    const pa = g.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
      const a = ang(x, z), y0 = yMHen(a), L = Math.max(0.03, menton - 0.005 - y0)
      const w = THREE.MathUtils.smoothstep(1 - (y - y0) / L, 0, 1)
      if (w <= 0) continue
      const dl = enAngulo(deltas, a, lerpV)
      pa.setXYZ(i, x + dl.x * w, y + dl.y * w, z + dl.z * w)
    }
    pa.needsUpdate = true
  }
  for (const m of cab.mallas) if (!m.geometry.userData.estirada) { estirar(m.geometry); m.geometry.userData.estirada = true }
  if (peloHoy) estirar((peloHoy as THREE.SkinnedMesh).geometry)
  // pendiente continua en la costura: en la banda de arriba del corte (hasta 3,5 cm, nunca más de la mitad del
  // camino al mentón) el radio de la piel MH va hacia el del cuello de hoy en el corte. Sin esto el cuello MH
  // (inclinado hacia adelante) y el de hoy (casi vertical) se encontraban en ángulo: un pliegue en el cuello.
  if (llenos >= BINS * 0.3 && !gp.userData.pendiente) {
    const pa = gp.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
      const a = ang(x, z), yc = yCorte(a), banda = Math.min(0.035, 0.5 * (menton - yc))
      const dd = y - yc
      if (banda <= 0.005 || dd < -0.006 || dd > banda) continue
      const w = 1 - THREE.MathUtils.smoothstep(dd, 0, banda)
      const r = Math.hypot(x - cx, z - cz), rt = rCen(a) + 0.0008
      const nr = r + (rt - r) * w
      pa.setXYZ(i, cx + Math.sin(a) * nr, y, cz + Math.cos(a) * nr)
    }
    pa.needsUpdate = true
    gp.userData.pendiente = true
  }
  let ctrlCostura = ""
  // (diagnóstico: solo en el banco y al hornear; en la página son milisegundos entre dos cuadros)
  if (op.diagnostico || op.reajusteVivo) {
    // control: bordes abiertos de la piel MH (aristas de una sola cara) contra la curva de corte
    // soldar por posición (la malla de salida parte vértices por costura UV)
    const pq = gp.getAttribute("position") as THREE.BufferAttribute
    const pq0 = new Map<string, number>(), sold = new Int32Array(pq.count)
    for (let i = 0; i < pq.count; i++) { const k = `${Math.round(pq.getX(i) * 2e4)}_${Math.round(pq.getY(i) * 2e4)}_${Math.round(pq.getZ(i) * 2e4)}`; if (!pq0.has(k)) pq0.set(k, i); sold[i] = pq0.get(k)! }
    const ix2 = gp.index!, cnt = new Map<string, number>()
    for (let t = 0; t < ix2.count; t += 3) for (let k = 0; k < 3; k++) { const a2 = sold[ix2.getX(t + k)], b2 = sold[ix2.getX(t + (k + 1) % 3)]; const kk = a2 < b2 ? a2 + "_" + b2 : b2 + "_" + a2; cnt.set(kk, (cnt.get(kk) ?? 0) + 1) }
    const bv = new Set<number>(); for (const [kk, n] of cnt) if (n === 1) for (const x of kk.split("_")) if (pq.getY(+x) < menton - 0.01) bv.add(+x)
    let maxD = 0, nBajo = 0, nAlto = 0
    const enAn = new Set([...anilloIdx].map((i) => sold[i]))
    for (const v of bv) { const dd = pq.getY(v) - (yCorte(ang(pq.getX(v), pq.getZ(v))) - 0.002); maxD = Math.max(maxD, Math.abs(dd)); if (dd > 0.003) nAlto++; if (dd < -0.003) nBajo++ }
    ctrlCostura = `bordes ${bv.size} anillo ${anilloIdx.length} fuera ${[...bv].filter((v) => !enAn.has(v)).length} maxD ${maxD.toFixed(4)} alto ${nAlto} bajo ${nBajo}`
  }
  const borde = rHoy, cuelloRopa = new Float32Array(0), nBorde = soldados, nRopa = 0
  deltaTris -= (idx.count - quedan.length) / 3
  g0.setIndex(quedan)
  marca("estirar")
  // ── piel MH como SkinnedMesh del mismo esqueleto ──
  const ident = new THREE.Matrix4()
  const nuevas: THREE.SkinnedMesh[] = []
  for (const m of cab.mallas) {
    const g = m.geometry
    if (!g.getAttribute("skinIndex")) {
      const n = g.getAttribute("position").count
      const I = new Uint16Array(n * 4), W = new Float32Array(n * 4)
      const aw = g.getAttribute("aW") as THREE.BufferAttribute | undefined
      // (sin Map ni arreglos por vértice: hueso y peso acumulados en orden de llegada, orden estable por peso)
      const kB = new Int32Array(8), kW = new Float64Array(8), ord = new Int32Array(8)
      const pa2 = g.getAttribute("position") as THREE.BufferAttribute
      for (let v = 0; v < n; v++) {
        if (aw) {
          let nk = 0
          const add2 = (b: number, w: number) => { if (!(w > 0)) return; for (let q = 0; q < nk; q++) if (kB[q] === b) { kW[q] += w; return } kB[nk] = b; kW[nk] = w; nk++ }
          const a2 = ang(pa2.getX(v), pa2.getZ(v))
          const wHoy = g === gp && pesoBin[0] ? THREE.MathUtils.clamp(1 - (pa2.getY(v) - yCorte(a2)) / 0.03, 0, 1) : 0
          add2(H.cabeza, aw.getX(v) * (1 - wHoy)); add2(H.cuello, aw.getZ(v) * (1 - wHoy)); add2(H.pecho, aw.getW(v) * (1 - wHoy))
          if (wHoy > 0) { const pb = pesoBin[Math.floor(((a2 + Math.PI) / (2 * Math.PI)) * BINS) % BINS]!; for (let j = 0; j < 4; j++) add2(pb.I[j], pb.W[j] * wHoy) }
          for (let q = 0; q < nk; q++) { let r = q; while (r > 0 && kW[ord[r - 1]] < kW[q]) { ord[r] = ord[r - 1]; r-- } ord[r] = q }
          const nt = Math.min(4, nk)
          let tot = 0
          for (let j = 0; j < nt; j++) tot += kW[ord[j]]
          if (!tot) tot = 1
          for (let j = 0; j < nt; j++) { I[v * 4 + j] = kB[ord[j]]; W[v * 4 + j] = kW[ord[j]] / tot }
        } else { I[v * 4] = H.cabeza; W[v * 4] = 1 }
      }
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(I, 4))
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(W, 4))
    }
    // normales en la costura: la piel MH que se estiró hasta el borde de hoy conserva las normales de MH y,
    // al lado de las de hoy, la luz hacía un escalón (un anillo en el cuello). En los 3 cm de arriba del corte
    // la normal va hacia la del cuello de hoy en ese ángulo (la misma mezcla que los pesos).
    if (g === gp && nBin.some(Boolean)) {
      const pa2 = g.getAttribute("position") as THREE.BufferAttribute, na = g.getAttribute("normal") as THREE.BufferAttribute
      const nv2 = new THREE.Vector3()
      const ext = g.getAttribute("aExt") as THREE.BufferAttribute | undefined
      for (let v = 0; v < pa2.count; v++) {
        const a2 = ang(pa2.getX(v), pa2.getZ(v))
        const w = THREE.MathUtils.clamp(1 - (pa2.getY(v) - yCorte(a2)) / 0.03, 0, 1)
        if (w <= 0) continue
        const f = ((a2 + Math.PI) / (2 * Math.PI)) * BINS - 0.5, k0 = ((Math.floor(f) % BINS) + BINS) % BINS, t = f - Math.floor(f)
        const n0 = nBin[k0], n1 = nBin[(k0 + 1) % BINS]
        if (!n0 || !n1) continue
        nv2.copy(n0).lerp(n1, t).normalize()
        const s3 = THREE.MathUtils.smoothstep(w, 0, 1)
        nv2.set(na.getX(v) + (nv2.x - na.getX(v)) * s3, na.getY(v) + (nv2.y - na.getY(v)) * s3, na.getZ(v) + (nv2.z - na.getZ(v)) * s3).normalize()
        na.setXYZ(v, nv2.x, nv2.y, nv2.z)
        // y la mezcla de la costura (aExt.y) en 1 justo en el borde: el horneado traía ~0,7 ahí y el 30 % del
        // atlas MH junto a la piel de hoy se veía como una línea
        if (ext) ext.setY(v, Math.max(ext.getY(v), s3))
      }
      na.needsUpdate = true
      if (ext) ext.needsUpdate = true
    }
    const sm = new THREE.SkinnedMesh(g, m.material)
    if (m.morphTargetInfluences) sm.morphTargetInfluences = m.morphTargetInfluences
    sm.renderOrder = m.renderOrder
    sm.castShadow = m.castShadow
    sm.customDepthMaterial = m.customDepthMaterial
    sm.customDistanceMaterial = m.customDistanceMaterial
    sm.onBeforeRender = m.onBeforeRender
    sm.receiveShadow = true
    sm.frustumCulled = false
    av.raiz.add(sm)
    sm.bind(sk, ident)
    nuevas.push(sm)
    deltaTris += g.index!.count / 3; deltaDibujos++
  }
  // FASE 5 (grupo 1): los cristales CLAROS de hoy (matLente: barniz 1, opacidad 0,16) reflejan tanto
  // cielo que, con ojos de verdad detrás, el iris se lee celeste (Pichai, Amodei). Con cabeza MH se
  // clonan con menos barniz; los de sol no se tocan.
  {
    const hechos = new Map<THREE.Material, THREE.Material>()
    av.raiz.traverse((o) => {
      const me = o as THREE.Mesh
      const mt = me.material as THREE.MeshPhysicalMaterial
      if (!me.isMesh || !mt || !(mt as any).isMeshPhysicalMaterial || !mt.transparent || mt.opacity > 0.3 || mt.clearcoat < 0.9) return
      if (!hechos.has(mt)) { const c = mt.clone(); c.clearcoat = 0.3; c.clearcoatRoughness = 0.08; c.opacity = 0.1; hechos.set(mt, c); recursos.push(c) }
      me.material = hechos.get(mt)!
    })
  }
  marca("ligar")
  const bones = sk.bones
  // Tope de triángulos por personaje: si con la cara nueva se pasa, sale la pasada del borde del pelo (pelos largos)
  if (op.topeTris && op.trisAvatar != null && bordePeloHoy?.malla && op.trisAvatar + deltaTris > op.topeTris) {
    const b = bordePeloHoy.malla
    b.removeFromParent()
    extra.splice(extra.indexOf(b), 1)
    deltaTris -= bordePeloHoy.tris
    deltaDibujos--
  }
  // la soldadura frente a la articulación del cuello (CONTRATO-CUELLO: al menos 1,3 cm por encima, o medida al armar)
  let yCorteMin = 1e9, yCorteMax = -1e9
  for (let k = 0; k < BINS; k++) { const y = yCorte(((k + 0.5) / BINS) * 2 * Math.PI - Math.PI); yCorteMin = Math.min(yCorteMin, y); yCorteMax = Math.max(yCorteMax, y) }
  const conMorph = nuevas.filter((m) => m.morphTargetInfluences && m.morphTargetInfluences.length >= 2)
  const gLod = cab.lod.malla.geometry, bordeLod = bordePeloHoy?.malla && extra.includes(bordePeloHoy.malla) ? bordePeloHoy.malla : null
  let cercaAhora = true
  const dbg = { ...reajuste, trisPielHoyQuitados: (idx.count - quedan.length) / 3, trisPielHoyTotal: idx.count / 3, trisOjosHoy: ocultasTris, ctrl: ctrlCostura, tonoCuerpo, cizallaZ: +dZ.toFixed(3), cizallaX: +dX.toFixed(3), yOjos: +ojosHoy.y.toFixed(3), yCuello: +yCuelloHoy.toFixed(3), soldaduraSobreCuelloMin: +(yCorteMin - yCuelloHoy).toFixed(4), soldaduraSobreCuelloMax: +(yCorteMax - yCuelloHoy).toFixed(4), binsBorde: borde.filter(Boolean).length, binsRopa: cuelloRopa.filter((x) => x > 0).length, nBorde, nRopa, rMH: +(anMH.reduce((a, e) => a + e.r, 0) / anMH.length).toFixed(3) }
  return {
    horneable,
    mallas: [...nuevas, ...extra],
    recursos,
    triangulos: Math.round(deltaTris),
    dibujos: deltaDibujos,
    info: { ...dbg, ...tm, escala: +s.toFixed(5), altoHoy: +(corona - menton).toFixed(4), maxCostura: +maxDelta.toFixed(4), tris: cab.triangulos, dibujos: nuevas.length, ocultas: ocultas.length },
    detalle(cerca) {
      if (cerca === cercaAhora) return
      cercaAhora = cerca
      gLod.setDrawRange(0, cerca ? cab.lod.cerca : cab.lod.lejos)
      if (bordeLod) bordeLod.visible = cerca
      // la sombra de la cabeza, solo de cerca: de lejos son unos píxeles en el piso y una llamada de dibujo más
      for (let i = 0; i < nuevas.length; i++) nuevas[i].castShadow = cerca
    },
    actualizar() {
      const boca = THREE.MathUtils.clamp(bones[H.mandibula].rotation.x / pt.angBoca, 0, 1)
      const parp = THREE.MathUtils.clamp(bones[H.parpadoI].rotation.x / 0.55, 0, 1)
      for (let i = 0; i < conMorph.length; i++) { const mi = conMorph[i].morphTargetInfluences!; mi[0] = boca; mi[1] = parp }
    },
  }
}
