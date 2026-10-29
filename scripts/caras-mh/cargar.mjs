// cargar.mjs — cargador PROPIO de los datos CC0 de MakeHuman (base.obj + targets + proxies).
// No usa ni porta código de MakeHuman/MPFB: solo lee los formatos de archivo.
//
// Uso CLI:
//   node cargar.mjs <nombre> '<json de config>'
//   -> salida/<nombre>.obj (+ .mtl) y salida/<nombre>.json (mallas listas para el render)
// Config: { macro:{gender,age,muscle,weight,height,proportions,african,asian,caucasian},
//           detalles:{"nose/nose-hump": 0.5, "head/head-oval": 1, ...},
//           piel:"old_caucasian_male", pelo:"short02", cejas:"eyebrow001", pestanas:"eyelashes01",
//           iris:"brown", dientes:"teeth_base", lengua:"tongue01" }
//
// Convenciones medidas en los datos (ver PROGRESO.md):
//  - base.obj: Y arriba, Z hacia adelante, X a la izquierda del personaje; unidades = decímetros.
//  - .target: líneas "idx dx dy dz" en ese MISMO sistema (MakeHuman, no Blender).
//  - .mhclo: pos = w1*v1 + w2*v2 + w3*v3 + offset ⊙ s, con s[eje] = |v[a][eje]-v[b][eje]| / factor
//            (x_scale -> eje x, y_scale -> eje y, z_scale -> eje z). Línea de un solo índice = copia.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
// datos de MakeHuman (NO van al repo): CARAS_MH_VENDOR o scripts/caras-mh/vendor (ver README.md)
export const VENDOR = process.env.CARAS_MH_VENDOR || path.join(AQUI, "vendor")
const CORE = path.join(VENDOR, "core")
const SIS = path.join(VENDOR, "sistema")
const CONV = process.env.CARAS_MH_CONV || path.join(AQUI, "convertido")

// ---------- OBJ ----------
export function leerObj(file) {
  const pos = [], uv = [], caras = [], grupos = new Map()
  let g = "default"
  for (const linea of fs.readFileSync(file, "utf8").split("\n")) {
    if (linea.startsWith("v ")) { const p = linea.split(/\s+/); pos.push(+p[1], +p[2], +p[3]) }
    else if (linea.startsWith("vt ")) { const p = linea.split(/\s+/); uv.push(+p[1], +p[2]) }
    else if (linea.startsWith("g ")) g = linea.slice(2).trim()
    else if (linea.startsWith("f ")) {
      const v = [], t = []
      for (const tok of linea.slice(2).trim().split(/\s+/)) {
        const [a, b] = tok.split("/")
        v.push(+a - 1); t.push(b ? +b - 1 : -1)
      }
      if (!grupos.has(g)) grupos.set(g, [])
      grupos.get(g).push(caras.length)
      caras.push({ g, v, t })
    }
  }
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), caras, grupos }
}

// ---------- targets ----------
const cacheTarget = new Map()
export function leerTarget(rel) {
  if (cacheTarget.has(rel)) return cacheTarget.get(rel)
  const file = path.join(CORE, "targets", rel + ".target")
  if (!fs.existsSync(file)) { cacheTarget.set(rel, null); return null }
  const idx = [], d = []
  for (const linea of fs.readFileSync(file, "utf8").split("\n")) {
    const s = linea.trim()
    if (!s || s[0] === "#") continue
    const p = s.split(/\s+/)
    idx.push(+p[0]); d.push(+p[1], +p[2], +p[3])
  }
  const t = { idx: Int32Array.from(idx), d: Float32Array.from(d) }
  cacheTarget.set(rel, t)
  return t
}

function aplicarTarget(pos, rel, peso) {
  if (!peso) return true
  const t = leerTarget(rel)
  if (!t) return false
  for (let k = 0; k < t.idx.length; k++) {
    const i = t.idx[k] * 3
    pos[i] += t.d[k * 3] * peso; pos[i + 1] += t.d[k * 3 + 1] * peso; pos[i + 2] += t.d[k * 3 + 2] * peso
  }
  return true
}

// ---------- macros ----------
// Pesos de mezcla entre los extremos de cada eje macro (todos los sliders en [0,1]).
function tramos(v, puntos, nombres) {
  // interpolación lineal por tramos: devuelve {nombre: peso} con a lo sumo dos no nulos
  const out = {}
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i], b = puntos[i + 1]
    if (v >= a && v <= b) {
      const f = b === a ? 0 : (v - a) / (b - a)
      out[nombres[i]] = (out[nombres[i]] || 0) + (1 - f)
      if (f > 0) out[nombres[i + 1]] = (out[nombres[i + 1]] || 0) + f
      return out
    }
  }
  return out
}

export const MACRO_DEF = { gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5, height: 0.5, proportions: 0.5, african: 1 / 3, asian: 1 / 3, caucasian: 1 / 3 }

// edad del slider -> años: 0 -> 1, 0.1875 -> 11, 0.5 -> 25, 1 -> 90
export function edadASlider(anios) {
  if (anios <= 11) return Math.max(0, (anios - 1) / 10 * 0.1875)
  if (anios <= 25) return 0.1875 + (anios - 11) / 14 * (0.5 - 0.1875)
  return Math.min(1, 0.5 + (anios - 25) / 65 * 0.5)
}

export function pesosMacro(m0 = {}) {
  const m = { ...MACRO_DEF, ...m0 }
  const sumaEt = m.african + m.asian + m.caucasian || 1
  const et = { african: m.african / sumaEt, asian: m.asian / sumaEt, caucasian: m.caucasian / sumaEt }
  const G = { female: 1 - m.gender, male: m.gender }
  const A = tramos(m.age, [0, 0.1875, 0.5, 1], ["baby", "child", "young", "old"])
  const M = tramos(m.muscle, [0, 0.5, 1], ["minmuscle", "averagemuscle", "maxmuscle"])
  const W = tramos(m.weight, [0, 0.5, 1], ["minweight", "averageweight", "maxweight"])
  const H = m.height < 0.5 ? { minheight: (0.5 - m.height) * 2 } : { maxheight: (m.height - 0.5) * 2 }
  const P = m.proportions < 0.5 ? { uncommonproportions: (0.5 - m.proportions) * 2 } : { idealproportions: (m.proportions - 0.5) * 2 }
  const lista = []
  for (const [g, wg] of Object.entries(G)) {
    if (!wg) continue
    for (const [a, wa] of Object.entries(A)) {
      if (!wa) continue
      for (const [r, wr] of Object.entries(et)) if (wr) lista.push([`macrodetails/${r}-${g}-${a}`, wr * wg * wa])
      for (const [mu, wm] of Object.entries(M)) {
        if (!wm) continue
        for (const [we, ww] of Object.entries(W)) {
          if (!ww) continue
          const base = wg * wa * wm * ww
          lista.push([`macrodetails/universal-${g}-${a}-${mu}-${we}`, base])
          for (const [h, wh] of Object.entries(H)) if (wh) lista.push([`macrodetails/height/${g}-${a}-${mu}-${we}-${h}`, base * wh])
          if (a !== "baby") for (const [p, wp] of Object.entries(P)) if (wp) lista.push([`macrodetails/proportions/${g}-${a}-${mu}-${we}-${p}`, base * wp])
        }
      }
    }
  }
  return lista
}

// ---------- modificadores de detalle ----------
let modDef = null
export function modificadores() {
  if (modDef) return modDef
  modDef = new Map()
  const grupos = JSON.parse(fs.readFileSync(path.join(CORE, "modifiers/modeling_modifiers.json"), "utf8"))
  for (const g of grupos) for (const m of g.modifiers) {
    if (!m.target) continue
    const id = m.min ? `${g.group}/${m.target}-${m.min}|${m.max}` : `${g.group}/${m.target}`
    modDef.set(id, m.min ? { menos: `${g.group}/${m.target}-${m.min}`, mas: `${g.group}/${m.target}-${m.max}` } : { mas: `${g.group}/${m.target}` })
  }
  return modDef
}
// clave aceptada: "nose/nose-hump-decr|incr" (valor -1..1) o "head/head-oval" (0..1)
// o atajo "nose/nose-hump" si es único.
function resolverMod(clave) {
  const defs = modificadores()
  if (defs.has(clave)) return defs.get(clave)
  const cand = [...defs.keys()].filter(k => k.startsWith(clave + "-") && k.slice(clave.length + 1).includes("|"))
  if (cand.length === 1) return defs.get(cand[0])
  throw new Error(`modificador desconocido o ambiguo: ${clave} (${cand.join(", ")})`)
}

export function construirCuerpo(base, cfg = {}) {
  const pos = Float32Array.from(base.pos)
  const usados = []
  for (const [rel, w] of pesosMacro(cfg.macro)) {
    if (!aplicarTarget(pos, rel, w)) throw new Error("falta target " + rel)
    usados.push([rel, +w.toFixed(4)])
  }
  for (const [clave, v] of Object.entries(cfg.detalles || {})) {
    const d = resolverMod(clave)
    if (v < 0 && d.menos) aplicarTarget(pos, d.menos, -v)
    else if (v > 0) aplicarTarget(pos, d.mas, v)
    usados.push([clave, v])
  }
  return { pos, usados }
}

// ---------- proxies (.mhclo) ----------
export function leerMhclo(file) {
  const out = { refs: [], escala: {}, borrar: [], material: null, objFile: null, dir: path.dirname(file) }
  let seccion = null
  for (const linea of fs.readFileSync(file, "utf8").split("\n")) {
    if (linea.startsWith("#")) continue
    const p = linea.trim().split(/\s+/)
    if (!p[0]) { seccion = null; continue }
    if (p[0] === "material") { out.material = p[1]; continue }
    if (seccion === "verts") {
      if (/^\d/.test(p[0])) { out.refs.push(p.length === 1 ? [+p[0]] : p.slice(0, 9).map(Number)); continue }
      if (p[0] === "tag") continue // algunas cejas traen "tag" justo después de "verts 0"
      seccion = null; continue
    }
    if (seccion === "borrar") {
      if (/^\d/.test(p[0])) {
        for (let i = 0; i < p.length; i++) {
          if (p[i + 1] === "-") { for (let k = +p[i]; k <= +p[i + 2]; k++) out.borrar.push(k); i += 2 }
          else out.borrar.push(+p[i])
        }
        continue
      }
      seccion = null; continue
    }
    if (p[0] === "verts") seccion = "verts"
    else if (p[0] === "delete_verts") seccion = "borrar"
    else if (p[0] === "x_scale" || p[0] === "y_scale" || p[0] === "z_scale") out.escala[p[0][0]] = [+p[1], +p[2], +p[3]]
    else if (p[0] === "obj_file") out.objFile = p[1]
  }
  return out
}

export function ajustar(mhclo, pos) {
  const s = [0, 1, 2].map(e => {
    const r = mhclo.escala["xyz"[e]]
    return r ? Math.abs(pos[r[0] * 3 + e] - pos[r[1] * 3 + e]) / r[2] : 1
  })
  const out = new Float32Array(mhclo.refs.length * 3)
  mhclo.refs.forEach((r, i) => {
    if (r.length === 1) { for (let e = 0; e < 3; e++) out[i * 3 + e] = pos[r[0] * 3 + e]; return }
    for (let e = 0; e < 3; e++)
      out[i * 3 + e] = r[3] * pos[r[0] * 3 + e] + r[4] * pos[r[1] * 3 + e] + r[5] * pos[r[2] * 3 + e] + r[6 + e] * s[e]
  })
  return out
}

export function leerMhmat(file) {
  const m = { file }
  for (const linea of fs.readFileSync(file, "utf8").split("\n")) {
    if (linea.startsWith("#")) continue
    const p = linea.trim().split(/\s+/)
    if (p.length >= 2) m[p[0]] = p.slice(1).join(" ")
  }
  if (m.diffuseTexture) m.textura = path.resolve(path.dirname(file), m.diffuseTexture)
  return m
}

// cat: hair|eyebrows|eyelashes|teeth|tongue|eyes ; nombre: carpeta (eyes: high-poly)
export function cargarProxy(cat, nombre) {
  const dir = path.join(SIS, cat, nombre)
  const mhclo = leerMhclo(path.join(dir, nombre + ".mhclo"))
  const malla = JSON.parse(fs.readFileSync(path.join(CONV, cat, nombre, nombre + ".json"), "utf8"))
  const mat = mhclo.material ? leerMhmat(path.join(dir, mhclo.material)) : null
  if (malla.coord.length / 3 !== mhclo.refs.length) throw new Error(`${cat}/${nombre}: ${malla.coord.length / 3} vértices vs ${mhclo.refs.length} refs`)
  return { cat, nombre, mhclo, malla, mat }
}

// ---------- mallas de salida ----------
// Normales suavizadas sobre los vértices SOLDADOS (antes de abrir por costuras UV).
function normales(pos, quads) {
  const n = new Float32Array(pos.length)
  const add = (a, b, c) => {
    const ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2]
    const bx = pos[c * 3] - pos[a * 3], by = pos[c * 3 + 1] - pos[a * 3 + 1], bz = pos[c * 3 + 2] - pos[a * 3 + 2]
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
    for (const v of [a, b, c]) { n[v * 3] += nx; n[v * 3 + 1] += ny; n[v * 3 + 2] += nz }
  }
  for (const q of quads) { add(q[0], q[1], q[2]); if (q.length > 3 && q[3] !== q[2]) add(q[0], q[2], q[3]) }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l }
  return n
}

// quads: [[v..]], quv: [[t..]] -> malla indexada con un vértice por par (v,t)
export function mallaRender(nombre, pos, uv, quads, quv, extra = {}) {
  const nrm = normales(pos, quads)
  const mapa = new Map(), P = [], N = [], T = [], I = []
  const vert = (v, t) => {
    const k = v * 1e6 + t
    if (mapa.has(k)) return mapa.get(k)
    const i = P.length / 3
    P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2])
    T.push(t >= 0 ? uv[t * 2] : 0, t >= 0 ? uv[t * 2 + 1] : 0)
    mapa.set(k, i); return i
  }
  quads.forEach((q, f) => {
    const t = quv[f]
    const a = vert(q[0], t[0]), b = vert(q[1], t[1]), c = vert(q[2], t[2])
    I.push(a, b, c)
    if (q.length > 3 && q[3] !== q[2]) { const d = vert(q[3], t[3]); I.push(a, c, d) }
  })
  return { nombre, pos: P.map(x => +x.toFixed(5)), nrm: N.map(x => +x.toFixed(4)), uv: T.map(x => +x.toFixed(5)), idx: I, quads, quv, posSoldada: pos, uvSoldada: uv, ...extra }
}

function partir(flat, k) { const o = []; for (let i = 0; i < flat.length; i += k) o.push(flat.slice(i, i + k)); return o }

export function armar(cfg = {}) {
  const base = leerObj(path.join(CORE, "3dobjs/base.obj"))
  const { pos, usados } = construirCuerpo(base, cfg)
  const mallas = []
  // cuerpo: solo el grupo "body" (los helper-* y joint-* son andamios)
  const cuerpoCaras = base.grupos.get("body").map(i => base.caras[i])
  const piel = cfg.piel ? leerMhmat(path.join(SIS, "skins", cfg.piel, cfg.piel + ".mhmat")) : null
  mallas.push(mallaRender("cuerpo", pos, base.uv, cuerpoCaras.map(c => c.v), cuerpoCaras.map(c => c.t), { textura: piel?.textura, tipo: "piel" }))
  const proxies = [
    ["eyes", "high-poly", "ojos"], ["eyebrows", cfg.cejas, "cejas"], ["eyelashes", cfg.pestanas, "pestanas"],
    ["teeth", cfg.dientes, "dientes"], ["tongue", cfg.lengua, "lengua"], ["hair", cfg.pelo, "pelo"],
  ]
  for (const [cat, nombre, tipo] of proxies) {
    if (!nombre) continue
    const px = cargarProxy(cat, nombre)
    const p = ajustar(px.mhclo, pos)
    let textura = px.mat?.textura
    if (cat === "eyes") textura = path.join(SIS, "eyes/materials", (cfg.iris || "brown") + "_eye.png")
    if (cat === "teeth") textura = path.join(SIS, "teeth/materials/teeth.png")
    mallas.push(mallaRender(tipo, p, Float32Array.from(px.malla.uv), partir(px.malla.quads, 4), partir(px.malla.quv, 4), { textura, tipo }))
  }
  return { mallas, usados, base }
}

export function escribirObj(salida, mallas) {
  const lineas = [`mtllib ${path.basename(salida, ".obj")}.mtl`], mtl = []
  let ov = 0, ot = 0
  for (const m of mallas) {
    lineas.push(`o ${m.nombre}`, `usemtl ${m.nombre}`)
    for (let i = 0; i < m.posSoldada.length; i += 3) lineas.push(`v ${m.posSoldada[i].toFixed(5)} ${m.posSoldada[i + 1].toFixed(5)} ${m.posSoldada[i + 2].toFixed(5)}`)
    for (let i = 0; i < m.uvSoldada.length; i += 2) lineas.push(`vt ${m.uvSoldada[i].toFixed(5)} ${m.uvSoldada[i + 1].toFixed(5)}`)
    m.quads.forEach((q, f) => {
      const t = m.quv[f], vs = (q.length > 3 && q[3] === q[2]) ? 3 : q.length
      lineas.push("f " + Array.from({ length: vs }, (_, k) => `${q[k] + 1 + ov}/${t[k] + 1 + ot}`).join(" "))
    })
    ov += m.posSoldada.length / 3; ot += m.uvSoldada.length / 2
    mtl.push(`newmtl ${m.nombre}`, "Kd 1 1 1", ...(m.textura ? [`map_Kd ${m.textura}`] : []), "")
  }
  fs.writeFileSync(salida, lineas.join("\n") + "\n")
  fs.writeFileSync(salida.replace(/\.obj$/, ".mtl"), mtl.join("\n"))
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nombre = process.argv[2] || "defecto"
  const cfg = JSON.parse(process.argv[3] || "{}")
  const t0 = Date.now()
  const { mallas, usados } = armar(cfg)
  const dirSal = path.join(AQUI, "out", "salida")
  fs.mkdirSync(dirSal, { recursive: true })
  escribirObj(path.join(dirSal, nombre + ".obj"), mallas)
  // JSON para el render: rutas de textura relativas a la carpeta makehuman/ (la sirve foto.cjs)
  const json = mallas.map(m => ({ nombre: m.nombre, tipo: m.tipo, pos: m.pos, nrm: m.nrm, uv: m.uv, idx: m.idx, textura: m.textura ? path.relative(AQUI, m.textura) : null }))
  fs.writeFileSync(path.join(dirSal, nombre + ".json"), JSON.stringify({ cfg, mallas: json }))
  // cabeza: alto y centro para el encuadre
  const c = mallas[0].posSoldada
  let ymax = -1e9; for (let i = 1; i < 13380 * 3; i += 3) ymax = Math.max(ymax, c[i])
  let ymin = 1e9; for (let i = 1; i < 13380 * 3; i += 3) ymin = Math.min(ymin, c[i])
  console.log(nombre, `${Date.now() - t0}ms`, "targets:", usados.length, "alto(dm):", (ymax - ymin).toFixed(2), "mallas:", mallas.map(m => `${m.nombre}:${m.idx.length / 3}tri`).join(" "))
  console.log("macro usados:", usados.filter(u => u[1] > 0.001).map(u => u.join("=")).join(" "))
}

// ---------- proxies CC0 de git (core/): obj + mhclo con cabecera CC0 ----------
// Devuelve el mismo formato que cargarProxy (malla: coord, quads (4 por cara; triángulo = último repetido), uv, quv).
export function cargarProxyCore(cat, nombre) {
  const dir = path.join(CORE, cat, nombre)
  const mhclo = leerMhclo(path.join(dir, nombre + ".mhclo"))
  const o = leerObj(path.join(dir, mhclo.objFile || nombre + ".obj"))
  const quads = [], quv = []
  for (const c of o.caras) {
    const v = c.v.length === 3 ? [...c.v, c.v[2]] : c.v, t = c.t.length === 3 ? [...c.t, c.t[2]] : c.t
    quads.push(...v); quv.push(...t)
  }
  const malla = { coord: Array.from(o.pos), quads, uv: Array.from(o.uv), quv }
  if (malla.coord.length / 3 !== mhclo.refs.length) throw new Error(`${cat}/${nombre}: ${malla.coord.length / 3} vértices vs ${mhclo.refs.length} refs`)
  return { cat, nombre, mhclo, malla, mat: null }
}
