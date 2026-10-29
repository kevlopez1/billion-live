// topologia.mjs — UNA vez, sobre la malla neutra: recorta cabeza + cuello del base.obj,
// decima con QEM de medio-arista (decimar.mjs) y decima también ojos y dientes.
// Escribe cabeza/topologia.json (índices de vértices ORIGINALES: los targets siguen valiendo).
//
// Uso: node cabeza/topologia.mjs [triangulosPiel=5600]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { leerObj, leerMhclo, VENDOR } from "./cargar.mjs"
import { decimar } from "./decimar.mjs"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.join(VENDOR, "core"), SIS = path.join(VENDOR, "sistema"), CONV = process.env.CARAS_MH_CONV || path.join(AQUI, "convertido")
const objPiel = +(process.argv[2] || 5600)

const base = leerObj(path.join(CORE, "3dobjs/base.obj"))
const sk = JSON.parse(fs.readFileSync(path.join(CORE, "rigs/default.mhskel"))).bones
const W = JSON.parse(fs.readFileSync(path.join(CORE, "rigs/default_weights.mhw"))).weights
const hijos = {}; for (const [n, v] of Object.entries(sk)) (hijos[v.parent] ??= []).push(n)
const sub = (n) => [n, ...(hijos[n] || []).flatMap(sub)]
const cabezaSet = new Set([...sub("neck01")])
const nv = base.pos.length / 3
const wCab = new Float32Array(nv)
for (const [b, l] of Object.entries(W)) if (cabezaSet.has(b)) for (const [v, w] of l) wCab[v] += w

// caras del cuerpo cuyo peso en cuello+cabeza supera 0,5 en todos sus vértices
// Corte LIMPIO del cuello: se recorre un anillo de quads alrededor del cuello (entrando y saliendo
// por aristas opuestas) desde un quad del frente a la altura Y_CORTE, y la región es todo lo que se
// alcanza desde la coronilla sin cruzar la arista de abajo de ese anillo. Así el borde es UN loop.
const Y_CORTE = +(process.argv[3] || 5.9)
const cuerpo = base.grupos.get("body").map(i => base.caras[i])
const PB = base.pos
const ka = (a, b) => a < b ? a + "_" + b : b + "_" + a
const porArista = new Map()
cuerpo.forEach((c, f) => { for (let k = 0; k < c.v.length; k++) { const e = ka(c.v[k], c.v[(k + 1) % c.v.length]); if (!porArista.has(e)) porArista.set(e, []); porArista.get(e).push(f) } })
const cen = (c) => [0, 1, 2].map(e => c.v.reduce((s, v) => s + PB[v * 3 + e], 0) / c.v.length)
let f0 = -1, mejor = 1e9
cuerpo.forEach((c, f) => { if (c.v.length !== 4) return; const m = cen(c); if (Math.abs(m[0]) > 0.06 || m[2] < 0.3) return; const d = Math.abs(m[1] - Y_CORTE); if (d < mejor) { mejor = d; f0 = f } })
// aristas del quad: la más "vertical" de las dos de los costados se cruza
const aristasQ = (c) => [0, 1, 2, 3].map(k => [c.v[k], c.v[(k + 1) % 4]])
const vert = ([a, b]) => Math.abs(PB[a * 3 + 1] - PB[b * 3 + 1]) / (Math.hypot(PB[a * 3] - PB[b * 3], PB[a * 3 + 2] - PB[b * 3 + 2]) + 1e-9)
let ar0 = aristasQ(cuerpo[f0]).map((e, k) => [vert(e), k]).sort((a, b) => b[0] - a[0])[0][1]
const anillo = [f0], abajo = new Set()
let f = f0, kEntra = (ar0 + 2) % 4
for (let paso = 0; paso < 400; paso++) {
  const c = cuerpo[f]
  const kSale = (kEntra + 2) % 4
  // aristas no cruzadas: la de abajo (menor y media) va al corte
  const otras = [(kEntra + 1) % 4, (kEntra + 3) % 4].map(k => [c.v[k], c.v[(k + 1) % 4]])
  const yM = (e) => (PB[e[0] * 3 + 1] + PB[e[1] * 3 + 1]) / 2
  const bajo = yM(otras[0]) < yM(otras[1]) ? otras[0] : otras[1]
  abajo.add(ka(bajo[0], bajo[1]))
  const e = ka(c.v[kSale], c.v[(kSale + 1) % 4])
  const sig = porArista.get(e).find(g => g !== f)
  if (sig === undefined || sig === f0) break
  const cs = cuerpo[sig]
  if (cs.v.length !== 4) throw new Error("triángulo en el anillo del cuello")
  kEntra = aristasQ(cs).findIndex(([a, b]) => ka(a, b) === e)
  f = sig; anillo.push(f)
}
// BFS desde la cara más alta
let fTop = 0; cuerpo.forEach((c, i) => { if (cen(c)[1] > cen(cuerpo[fTop])[1]) fTop = i })
const dentro = new Uint8Array(cuerpo.length); dentro[fTop] = 1
const cola = [fTop]
while (cola.length) {
  const g = cola.pop(), c = cuerpo[g]
  for (let k = 0; k < c.v.length; k++) {
    const e = ka(c.v[k], c.v[(k + 1) % c.v.length])
    if (abajo.has(e)) continue
    for (const h of porArista.get(e)) if (!dentro[h]) { dentro[h] = 1; cola.push(h) }
  }
}
const caras = cuerpo.filter((_, i) => dentro[i])
{ const ys = [...abajo].flatMap(e => e.split("_").map(Number)).map(v => PB[v * 3 + 1]); const zs = [...abajo].flatMap(e => e.split("_").map(Number)).map(v => PB[v * 3 + 2]); console.log("y del anillo:", Math.min(...ys).toFixed(2), Math.max(...ys).toFixed(2), "z:", Math.min(...zs).toFixed(2), Math.max(...zs).toFixed(2)) }
console.log("anillo del cuello:", anillo.length, "quads; región:", caras.length, "caras (y del corte", Y_CORTE, ")")
const tris = [], tuv = []
for (const c of caras) {
  tris.push([c.v[0], c.v[1], c.v[2]]); tuv.push([c.t[0], c.t[1], c.t[2]])
  if (c.v.length === 4) { tris.push([c.v[0], c.v[2], c.v[3]]); tuv.push([c.t[0], c.t[2], c.t[3]]) }
}
const P = base.pos
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
// importancia: la cara manda (ojos, nariz, boca, mentón), luego orejas; nuca y cuello, poco
const peso = new Float32Array(nv).fill(1)
for (let v = 0; v < 13380; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]
  const cara = suave(0.35, 0.8, z) * suave(5.95, 6.25, y) * (1 - suave(7.85, 8.15, y)) * (1 - suave(0.62, 0.78, Math.abs(x)))
  const ojos = Math.exp(-(((Math.abs(x) - 0.31) / 0.25) ** 2 + ((y - 7.28) / 0.18) ** 2 + ((z - 1.25) / 0.4) ** 2))
  const boca = Math.exp(-((x / 0.35) ** 2 + ((y - 6.72) / 0.2) ** 2 + ((z - 1.3) / 0.4) ** 2))
  const oreja = suave(0.62, 0.78, Math.abs(x)) * (1 - suave(0.45, 0.8, z)) * suave(6.7, 6.9, y) * (1 - suave(7.5, 7.7, y))
  const cuello = 1 - suave(5.95, 6.3, y)
  peso[v] = 1 + 14 * cara + 30 * ojos + 20 * boca + 1.5 * oreja - 0.5 * cuello - 0.4 * suave(0.2, -0.4, z) * (1 - cara)
}
const t0 = Date.now()
const piel = decimar({ pos: P, tris, tuv, peso, objetivo: objPiel })
console.log("piel", tris.length, "->", piel.tris.length, "tri", Date.now() - t0, "ms")

// proxies: ojos y dientes (sus mallas vienen en quads)
function decimarProxy(cat, nombre, objetivo, pesoFn, filtro) {
  const m = JSON.parse(fs.readFileSync(path.join(CONV, cat, nombre, nombre + ".json"), "utf8"))
  const pos = Float32Array.from(m.coord)
  const T = [], U = []
  for (let f = 0; f < m.quads.length / 4; f++) {
    const q = m.quads.slice(f * 4, f * 4 + 4), t = m.quv.slice(f * 4, f * 4 + 4)
    if (filtro && !q.every(v => filtro(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]))) continue
    T.push([q[0], q[1], q[2]]); U.push([t[0], t[1], t[2]])
    if (q[3] !== q[2]) { T.push([q[0], q[2], q[3]]); U.push([t[0], t[2], t[3]]) }
  }
  const pw = pesoFn ? Float32Array.from({ length: pos.length / 3 }, (_, i) => pesoFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])) : null
  const r = objetivo >= T.length ? { tris: T, tuv: U } : decimar({ pos, tris: T, tuv: U, peso: pw, objetivo })
  console.log(cat, nombre, T.length, "->", r.tris.length)
  return r
}
// ojos: el frente (iris y córnea) pesa más que la parte de atrás, que no se ve
const ojos = decimarProxy("eyes", "high-poly", 640, (x, y, z) => 1 + 25 * suave(1.36, 1.43, z))
const dientes = decimarProxy("teeth", "teeth_base", 700, (x, y, z) => 1 + 4 * suave(1.1, 1.3, z), (x, y, z) => z > 1.1)
const lengua = decimarProxy("tongue", "tongue01", 200)

// grupos: qué vértices del proxy de dientes van con la mandíbula (refs al helper de abajo)
const mhDientes = leerMhclo(path.join(SIS, "teeth/teeth_base/teeth_base.mhclo"))
const inferior = mhDientes.refs.map(r => (r[0] >= 14992 && r[0] <= 15059) ? 1 : 0)

const usados = [...new Set(piel.tris.flat())].sort((a, b) => a - b)

// ── atlas propio de la cabeza: las islas UV de la cabeza (cara, orejas, cuello, boca) se
// re-empacan en un cuadrado; así se manda un recorte de 1024 en vez de la piel entera de 2048 ──
const ATL = 1024, PAD = 6 / 2048
const padre = new Map(); const raiz = (a) => { while (padre.get(a) !== a) { padre.set(a, padre.get(padre.get(a))); a = padre.get(a) } return a }
for (const t of piel.tuv) for (const k of t) if (!padre.has(k)) padre.set(k, k)
for (const t of piel.tuv) { padre.set(raiz(t[1]), raiz(t[0])); padre.set(raiz(t[2]), raiz(t[0])) }
const islas = new Map()
for (const k of padre.keys()) {
  const r = raiz(k), u = base.uv[k * 2], v = base.uv[k * 2 + 1]
  if (!islas.has(r)) islas.set(r, { u0: 9, v0: 9, u1: -9, v1: -9, ks: [] })
  const b = islas.get(r); b.u0 = Math.min(b.u0, u); b.v0 = Math.min(b.v0, v); b.u1 = Math.max(b.u1, u); b.v1 = Math.max(b.v1, v); b.ks.push(k)
}
const rects = [...islas.values()].map(b => ({ ...b, u0: b.u0 - PAD, v0: b.v0 - PAD, u1: b.u1 + PAD, v1: b.v1 + PAD })).sort((a, b) => (b.v1 - b.v0) - (a.v1 - a.v0))
// la isla más alta (la cara) va a la izquierda; las demás, en estantes en la columna que queda
function empacar(esc) {
  const r0 = rects[0]
  r0.x = 0; r0.y = 0; r0.w = (r0.u1 - r0.u0) * esc; r0.h = (r0.v1 - r0.v0) * esc
  if (r0.w > 1 || r0.h > 1) return false
  const x0 = r0.w
  let x = x0, y = 0, alto = 0
  for (const r of rects.slice(1)) {
    const w = (r.u1 - r.u0) * esc, h = (r.v1 - r.v0) * esc
    if (x + w > 1) { x = x0; y += alto; alto = 0 }
    if (x0 + w > 1) return false
    r.x = x; r.y = y; r.w = w; r.h = h; x += w; alto = Math.max(alto, h)
  }
  return y + alto <= 1
}
let esc = 2.5; while (!empacar(esc)) esc *= 0.98
const uvAtlas = {}
for (const r of rects) for (const k of r.ks) uvAtlas[k] = [r.x + (base.uv[k * 2] - r.u0) / (r.u1 - r.u0) * r.w, r.y + (base.uv[k * 2 + 1] - r.v0) / (r.v1 - r.v0) * r.h]
console.log("atlas: islas", rects.length, "escala", esc.toFixed(3), "(px de 2048 por px de", ATL, "=", (2048 / (esc * ATL)).toFixed(2), ")")
fs.writeFileSync(path.join(AQUI, "topologia.json"), JSON.stringify({
  nota: "índices de base.obj (hm08) y de las mallas de proxy; generado por topologia.mjs",
  piel: { ...piel, vertices: usados, region: caras.length },
  atlas: { tam: ATL, escala: esc, rects: rects.map(({ ks, ...r }) => r), uv: uvAtlas },
  ojos, dientes, dientesInferior: inferior, lengua,
}))
console.log("vértices de piel usados:", usados.length)
