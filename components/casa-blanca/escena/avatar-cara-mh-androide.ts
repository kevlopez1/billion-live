// ──────────────────────────────────────────────────────────────
// Caras MakeHuman (3/3): la cabeza MakeHuman de los androides (Claude, ChatGPT).
// La piel sintética es la del repo (avatar-androide.ts::matPielAndroide, el
// mismo programa y los mismos uniformes), más la cavidad de la boca (aExt.x
// de la piel MH: boca abierta = hueco oscuro). Para la cabeza MH:
//  - aAnd (coordenadas de la cabeza en reposo, normalizadas como en
//    prepararAndroide) sale de un ajuste AFÍN pos → aAnd medido sobre la piel
//    de hoy (vértices de la cabeza), aplicado a la piel MH montada: costuras y
//    grietas caen donde el repo las dibuja, sobre la superficie MH.
//  - cejas de luz de ChatGPT = las cejas propias de MH (forma de la ficha) con
//    el blanco HDR del repo; Claude sin cejas; pestañas oscuras del repo.
// La piel de hoy que queda (cuello, manos) conserva su material del repo.
// ──────────────────────────────────────────────────────────────
import * as THREE from "three"
import type { Avatar } from "./contrato"
import { H } from "./avatar-cuerpo"
import { matPielAndroide } from "./avatar-androide"
import type { CabezaMH } from "./avatar-cara-mh-cabeza"

const ESTILO: Record<string, { lineas: "panel" | "grietas"; cejasLuz: boolean; pestanas: string }> = {
  chatgpt: { lineas: "panel", cejasLuz: true, pestanas: "#20242b" },
  claude: { lineas: "grietas", cejasLuz: false, pestanas: "#22262d" },
}
export const esAndroideId = (id: string) => id in ESTILO

const mats = new Map<string, THREE.MeshPhysicalMaterial>()
/** matPielAndroide del repo + la cavidad de la boca (aExt.x). Mismo programa base, mismos uniformes. */
function matPiel(lineas: "panel" | "grietas"): THREE.MeshPhysicalMaterial {
  let m = mats.get(lineas)
  if (m) return m
  const base = matPielAndroide(lineas)
  const c = base.clone()
  c.onBeforeCompile = (sh, r) => {
    base.onBeforeCompile.call(base, sh, r)
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aExt;\nvarying vec4 vExt;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvExt = aExt;")
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec4 vExt;")
      // cavidad de la boca (piel MH): hacia adentro, casi negra y sin luz
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n\tdiffuseColor.rgb *= 1.0 - 0.9 * smoothstep( 0.0, 0.6, vExt.x );")
      .replace("#include <lights_fragment_end>", "\t{ float cav = 1.0 - 0.9 * vExt.x; irradiance *= cav;\n#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\n\tiblIrradiance *= cav; radiance *= cav;\n#endif\n\t}\n#include <lights_fragment_end>")
  }
  const key = base.customProgramCacheKey()
  c.customProgramCacheKey = () => key + "|mh-boca"
  c.name = `androide-piel-mh-${lineas}`
  mats.set(lineas, c)
  return c
}

/** El material de la piel MH de un androide (para compilarlo antes de montar). */
export const materialAndroide = (id: string): THREE.Material | null => (ESTILO[id] ? matPiel(ESTILO[id].lineas) : null)

/** Ajuste afín por mínimos cuadrados: y ≈ A·[x,1] (4 incógnitas por salida). */
function afin(X: number[][], Y: number[][]): number[][] {
  const fila = (k: number) => {
    const M = Array.from({ length: 4 }, () => new Array(5).fill(0))
    for (let i = 0; i < X.length; i++) { const x = [...X[i], 1]; for (let a = 0; a < 4; a++) { for (let b = 0; b < 4; b++) M[a][b] += x[a] * x[b]; M[a][4] += x[a] * Y[i][k] } }
    for (let c = 0; c < 4; c++) { let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j < 5; j++) M[r][j] -= f * M[c][j] } }
    return M.map((r, i) => r[4] / r[i])
  }
  return [0, 1, 2].map(fila)
}

/** Después de montarCabezaMH: piel, cejas y pestañas de androide sobre la cabeza MH. */
export interface Androidizado { info: Record<string, number | string>; recursos: Array<{ dispose(): void }>; triangulos: number; dibujos: number }
const trisDe = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3

export function androidizar(av: Avatar, cab: CabezaMH, id: string): Androidizado {
  const e = ESTILO[id]
  const mat = matPiel(e.lineas)
  const recursos: Array<{ dispose(): void }> = []
  let triangulos = 0, dibujos = 0
  let hoy: THREE.SkinnedMesh | null = null
  av.raiz.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) return
    const n = (m.material as THREE.Material).name || ""
    if (n.startsWith("androide-piel") && m.geometry !== cab.piel.geometry) hoy = m
    if (n === "androide-cejas-luz" && m.visible) { m.visible = false; triangulos -= trisDe(m); dibujos-- }
  })
  if (!hoy) throw new Error("androide sin piel de hoy")
  const H0 = hoy as THREE.SkinnedMesh
  const g0 = H0.geometry
  const pos = g0.getAttribute("position") as THREE.BufferAttribute, and = g0.getAttribute("aAnd") as THREE.BufferAttribute
  const si = g0.getAttribute("skinIndex") as THREE.BufferAttribute, sw = g0.getAttribute("skinWeight") as THREE.BufferAttribute
  const col = g0.getAttribute("color") as THREE.BufferAttribute | undefined
  const X: number[][] = [], Y: number[][] = []
  let cr = 0, cg = 0, cb = 0, nc = 0
  for (let v = 0; v < pos.count; v++) {
    let w = 0
    for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === H.cabeza) w += sw.getComponent(v, k)
    if (w < 0.95) continue
    X.push([pos.getX(v), pos.getY(v), pos.getZ(v)]); Y.push([and.getX(v), and.getY(v), and.getZ(v)])
    if (col) { const yl = 0.2126 * col.getX(v) + 0.7152 * col.getY(v) + 0.0722 * col.getZ(v); cr += yl; cg += yl; cb += yl; nc++ }
  }
  const A = afin(X, Y)
  let res = 0
  for (let i = 0; i < X.length; i++) for (let k = 0; k < 3; k++) { const p = A[k][0] * X[i][0] + A[k][1] * X[i][1] + A[k][2] * X[i][2] + A[k][3]; res = Math.max(res, Math.abs(p - Y[i][k])) }
  // piel MH: aAnd, aMat, aMano y el color de vértice medio de la cara de hoy
  const g = cab.piel.geometry
  const pm = g.getAttribute("position") as THREE.BufferAttribute
  const n = pm.count
  const aA = new Float32Array(n * 3), aM = new Float32Array(n * 2), aH = new Float32Array(n * 2), c = new Float32Array(n * 3)
  const mc = nc ? [cr / nc, cg / nc, cb / nc] : [1, 1, 1]
  for (let v = 0; v < n; v++) {
    const x = pm.getX(v), y = pm.getY(v), z = pm.getZ(v)
    for (let k = 0; k < 3; k++) aA[v * 3 + k] = A[k][0] * x + A[k][1] * y + A[k][2] * z + A[k][3]
    aM[v * 2] = 0.55
    c.set(mc, v * 3)
  }
  g.setAttribute("aAnd", new THREE.BufferAttribute(aA, 3))
  g.setAttribute("aMat", new THREE.BufferAttribute(aM, 2))
  g.setAttribute("aMano", new THREE.BufferAttribute(aH, 2))
  g.setAttribute("color", new THREE.BufferAttribute(c, 3))
  if (!g.getAttribute("aExt")) g.setAttribute("aExt", new THREE.BufferAttribute(new Float32Array(n * 4), 4))
  // (la piel de hoy que queda, cuello y manos, sigue con matPielAndroide del repo: mismo programa y uniformes)
  // mallas nuevas del avatar que usan la geometría de la cabeza MH (montaje las clona como SkinnedMesh)
  const porGeo = (gg: THREE.BufferGeometry) => { const r: THREE.SkinnedMesh[] = []; av.raiz.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.geometry === gg) r.push(m) }); return r }
  for (const m of porGeo(g)) m.material = mat
  // cejas y pestañas (una malla, 1 o 2 pasadas): uniformes compartidos de la cabeza
  cab.uCejas.uColP.value.set(e.pestanas)
  if (e.cejasLuz) cab.uCejas.uLuz.value = 1
  else cab.uCejas.uSinCejas.value = 1
  return { info: { ajusteMax: +res.toFixed(4), nAjuste: X.length, colorCara: new THREE.Color(mc[0], mc[1], mc[2]).getHexString() }, recursos, triangulos, dibujos }
}
