// atlas2.mjs — re-empaca el atlas de la cabeza (código propio). Reemplaza topologia.json.atlas.
// La isla de la cabeza (cara + cuero + orejas) ocupa 0,8 del ancho con una deformación separable
// que da más texeles a la cara (frente, ojos, nariz, boca) y menos a la nuca y la coronilla (las tapa
// el pelo). Cuello, interior de la boca (se oscurece) y cuencas de los ojos van en una columna.
// La textura se hornea rasterizando cada triángulo (texturas.py), así que cualquier uv por vértice vale.
// Uso: node cabeza/atlas2.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { leerObj, VENDOR } from "./cargar.mjs"
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const base = leerObj(path.join(VENDOR, "core/3dobjs/base.obj"))
const TF = path.join(AQUI, "topologia.json")
const T = JSON.parse(fs.readFileSync(TF, "utf8"))
const PAD = 4 / 2048
// islas (por conectividad de uv) como en topologia.mjs
const padre = new Map(); const raiz = (a) => { while (padre.get(a) !== a) { padre.set(a, padre.get(padre.get(a))); a = padre.get(a) } return a }
for (const t of T.piel.tuv) for (const k of t) if (!padre.has(k)) padre.set(k, k)
for (const t of T.piel.tuv) { padre.set(raiz(t[1]), raiz(t[0])); padre.set(raiz(t[2]), raiz(t[0])) }
const islas = new Map()
for (const k of padre.keys()) {
  const r = raiz(k), u = base.uv[k * 2], v = base.uv[k * 2 + 1]
  if (!islas.has(r)) islas.set(r, { u0: 9, v0: 9, u1: -9, v1: -9, ks: [] })
  const b = islas.get(r); b.u0 = Math.min(b.u0, u); b.v0 = Math.min(b.v0, v); b.u1 = Math.max(b.u1, u); b.v1 = Math.max(b.v1, v); b.ks.push(k)
}
const R = [...islas.values()].map(b => ({ ...b, u0: b.u0 - PAD, v0: b.v0 - PAD, u1: b.u1 + PAD, v1: b.v1 + PAD })).sort((a, b) => b.ks.length - a.ks.length)
// clasificar: cabeza = la de más vértices; boca = la que contiene uv del interior; cuello; cuencas
const P = base.pos
const vDeUv = new Map(); T.piel.tris.forEach((t, f) => t.forEach((v, k) => vDeUv.set(T.piel.tuv[f][k], v)))
const media = (r, e) => r.ks.reduce((s, k) => s + P[vDeUv.get(k) * 3 + e], 0) / r.ks.length
for (const r of R) { r.my = media(r, 1); r.mz = media(r, 2); r.mx = media(r, 0) }
const cabeza = R[0]
const resto = R.slice(1)
const cuello = resto.reduce((a, b) => (b.my < a.my ? b : a))
const cuencas = resto.filter(r => r.my > 7.0)
const boca = resto.find(r => r !== cuello && !cuencas.includes(r))
console.log("islas", R.length, "cabeza", cabeza.ks.length, "cuello", cuello.ks.length, "boca", boca?.ks.length, "cuencas", cuencas.map(r => r.ks.length))
// densidad separable de la isla de la cabeza (en uv viejo): 1 en la cara, baja afuera
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const DU = (u) => 0.42 + 0.58 * suave(0.73, 0.78, u)                       // cara: u 0,77..0,99 (la línea media a la derecha)
const DV = (v) => 0.5 + 0.5 * suave(0.29, 0.34, v) * (1 - suave(0.64, 0.69, v)) // cara: v 0,34..0,63
function integral(D, a, b, n = 2000) { const xs = [0]; let s = 0; for (let i = 1; i <= n; i++) { const x0 = a + (b - a) * (i - 1) / n, x1 = a + (b - a) * i / n; s += (D(x0) + D(x1)) / 2 * (x1 - x0); xs.push(s) } return { F: (x) => { const f = (x - a) / (b - a) * n; const i = Math.max(0, Math.min(n - 1, Math.floor(f))); const t = f - i; return (xs[i] * (1 - t) + xs[i + 1] * t) / s }, total: s } }
const W0 = 0.8
const FU = integral(DU, cabeza.u0, cabeza.u1), FV = integral(DV, cabeza.v0, cabeza.v1)
const uv = {}
for (const k of cabeza.ks) uv[k] = [FU.F(base.uv[k * 2]) * W0, FV.F(base.uv[k * 2 + 1])]
// densidad lograda en la cara (texeles de 1024 por unidad de uv viejo) contra la anterior
const dCara = { u: W0 * 1 / FU.total, v: 1 / FV.total }
console.log("densidad cara (por uv viejo): u", dCara.u.toFixed(3), "v", dCara.v.toFixed(3), "antes", T.atlas.escala.toFixed(3), "→ x", (dCara.u / T.atlas.escala).toFixed(2), (dCara.v / T.atlas.escala).toFixed(2))
// columna derecha
const X0 = W0 + 2 / 1024, WC = 1 - X0
let y = 0
const rects = [{ u0: cabeza.u0, v0: cabeza.v0, u1: cabeza.u1, v1: cabeza.v1, x: 0, y: 0, w: W0, h: 1, warp: true }]
const colocar = (r, esc, x, yy) => {
  const w = (r.u1 - r.u0) * esc, h = (r.v1 - r.v0) * esc
  for (const k of r.ks) uv[k] = [x + (base.uv[k * 2] - r.u0) / (r.u1 - r.u0) * w, yy + (base.uv[k * 2 + 1] - r.v0) / (r.v1 - r.v0) * h]
  rects.push({ u0: r.u0, v0: r.v0, u1: r.u1, v1: r.v1, x, y: yy, w, h })
  return { w, h }
}
{ const esc = WC / (cuello.u1 - cuello.u0); const d = colocar(cuello, esc, X0, y); y += d.h + 2 / 1024; console.log("cuello esc", esc.toFixed(2)) }
{ const esc = Math.min(WC / (boca.u1 - boca.u0), 0.75); const d = colocar(boca, esc, X0, y); y += d.h + 2 / 1024; console.log("boca esc", esc.toFixed(2)) }
{ const esc = Math.min(WC / 2 / (cuencas[0].u1 - cuencas[0].u0), 1.6); let x = X0, hmax = 0; for (const c of cuencas) { const d = colocar(c, esc, x, y); x += d.w; hmax = Math.max(hmax, d.h) } y += hmax; console.log("cuencas esc", esc.toFixed(2)) }
console.log("columna alto", y.toFixed(3))
if (y > 1) throw new Error("no entra")
if (!T.atlasV1) T.atlasV1 = T.atlas
const islas2 = { cabeza: cabeza.ks, cuello: cuello.ks, boca: boca.ks, cuencas: cuencas.flatMap(c => c.ks) }
T.atlas = { tam: 1024, escala: dCara.u, rects, uv, islas: islas2, version: 2, nota: "atlas2.mjs: hornear rasterizando triángulos (texturas.py)" }
fs.writeFileSync(TF, JSON.stringify(T))
console.log("ok")
