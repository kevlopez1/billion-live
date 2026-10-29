// hornear.mjs — horneado offline de UNA cabeza MakeHuman por personaje (código propio).
//
// Toma la topología decimada (topologia.json, índices de base.obj), aplica macros + detalles +
// expresiones fijas, ajusta los proxies (ojos, cejas, pestañas, dientes, lengua, pelo), arma la
// barba en capas (shells) sobre la piel, y calcula dos morphs: "boca" (mandíbula girada con los
// pesos del rig default) y "parpadeo" (unidades de expresión eye-*-closure).
// Escribe out/<id>/cab.bin (cuantizado) + out/<id>/cab.json (cabecera, materiales, puntos).
//
// Uso: node cabeza/hornear.mjs <personajes-mh.json> [id...]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"
import { leerObj, leerTarget, construirCuerpo, cargarProxy, cargarProxyCore, ajustar, VENDOR } from "./cargar.mjs"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.join(VENDOR, "core")
const OUT = path.join(AQUI, "out")

const base = leerObj(path.join(CORE, "3dobjs/base.obj"))
const TOPO = JSON.parse(fs.readFileSync(path.join(AQUI, "topologia.json"), "utf8"))
const SK = JSON.parse(fs.readFileSync(path.join(CORE, "rigs/default.mhskel")))
const W = JSON.parse(fs.readFileSync(path.join(CORE, "rigs/default_weights.mhw"))).weights
const NV = base.pos.length / 3
// uv de la piel en el atlas propio de la cabeza (topologia.mjs)
const UVA = Float32Array.from(base.uv)
for (const [k, [u, v]] of Object.entries(TOPO.atlas.uv)) { UVA[k * 2] = u; UVA[k * 2 + 1] = v }
const P0 = base.pos // neutra: las máscaras (barba, cuero cabelludo) se definen aquí, iguales para todos

// ── pesos del rig default agrupados en los huesos de la escena ──
const hijos = {}; for (const [n, v] of Object.entries(SK.bones)) (hijos[v.parent] ??= []).push(n)
const sub = (n) => [n, ...(hijos[n] || []).flatMap(sub)]
const enJaw = new Set(sub("jaw")), enCab = new Set(sub("head"))
const wJaw = new Float32Array(NV), wCab = new Float32Array(NV), wCue = new Float32Array(NV), wPec = new Float32Array(NV)
for (const [b, l] of Object.entries(W)) for (const [v, w] of l) {
  if (enJaw.has(b)) wJaw[v] += w
  else if (enCab.has(b)) wCab[v] += w
  else if (b === "neck02" || b === "neck03") wCue[v] += w
  else if (b === "neck01") wPec[v] += w
}
const centro = (idx, pos) => { const c = [0, 0, 0]; for (const v of idx) for (let e = 0; e < 3; e++) c[e] += pos[v * 3 + e] / idx.length; return c }
const grupoVerts = (g) => { const s = new Set(); for (const i of base.grupos.get(g)) for (const v of base.caras[i].v) s.add(v); return [...s] }
const OJO_L = grupoVerts("helper-l-eye"), OJO_R = grupoVerts("helper-r-eye")

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

// ── normales suavizadas sobre vértices soldados ──
function normales(pos, tris, nv) {
  const n = new Float32Array(nv * 3)
  for (const [a, b, c] of tris) {
    const ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2]
    const bx = pos[c * 3] - pos[a * 3], by = pos[c * 3 + 1] - pos[a * 3 + 1], bz = pos[c * 3 + 2] - pos[a * 3 + 2]
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
    for (const v of [a, b, c]) { n[v * 3] += nx; n[v * 3 + 1] += ny; n[v * 3 + 2] += nz }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l }
  return n
}
const trisDeQuads = (quads) => { const t = []; for (const q of quads) { t.push([q[0], q[1], q[2]]); if (q.length > 3 && q[3] !== q[2]) t.push([q[0], q[2], q[3]]) } return t }
const cuerpoTris = trisDeQuads(base.grupos.get("body").map(i => base.caras[i].v))

// Malla de salida (un vértice por par v,t) a partir de triángulos con uv por esquina.
// atributos: { nombre: (v) => [..] } por vértice soldado.
function armarMalla(tris, tuv, pos, nrm, uv, extra = {}) {
  const mapa = new Map(), orig = [], P = [], N = [], T = [], I = []
  const ex = Object.fromEntries(Object.keys(extra).map(k => [k, []]))
  const vert = (v, t) => {
    const k = v * 1e6 + t
    if (mapa.has(k)) return mapa.get(k)
    const i = orig.length
    orig.push(v)
    P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2])
    T.push(uv[t * 2], uv[t * 2 + 1])
    for (const [k2, f] of Object.entries(extra)) ex[k2].push(...f(v))
    mapa.set(k, i); return i
  }
  tris.forEach((t, f) => { for (let k = 0; k < 3; k++) I.push(vert(t[k], tuv[f][k])) })
  return { orig, P, N, T, I, ex }
}

function partir(flat, k) { const o = []; for (let i = 0; i < flat.length; i += k) o.push(flat.slice(i, i + k)); return o }

// Proxy ajustado sobre pos: devuelve posiciones de TODOS sus vértices + normales (topología completa)
function proxyEn(px, pos) {
  const p = ajustar(px.mhclo, pos)
  const quads = partir(px.malla.quads, 4)
  const n = normales(p, trisDeQuads(quads), p.length / 3)
  return { p, n, quads, quv: partir(px.malla.quv, 4), uv: Float32Array.from(px.malla.uv) }
}

// ── máscaras en la malla NEUTRA (dm; ojos en ±0,308 / 7,284 / 1,245; punta de la nariz z 1,68) ──
// Barba por zonas. b = barba de la ficha resuelta (0..1 por zona).
function mascaraBarba(v, b) {
  const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2], ax = Math.abs(x)
  // labios (y entre 6,62 y 6,84 en el centro): fuera
  // perfil medido en la línea media: mentón 6,16-6,5; labio de abajo 6,6-6,72; boca 6,73; labio de arriba
  // 6,74-6,8; filtrum 6,8-6,85; base de la nariz 6,86
  const labios = (1 - suave(0.2, 0.3, ax)) * suave(6.57, 6.61, y) * (1 - suave(6.79, 6.81, y)) * suave(1.15, 1.3, z)
  const frente = suave(-0.1, 0.25, z) // delante de la oreja
  const bajoNariz = 1 - suave(6.86, 6.93, y)
  // bigote: entre la nariz y el labio de arriba
  const bigote = (1 - suave(0.26, 0.36, ax)) * suave(6.78, 6.81, y) * bajoNariz * suave(1.1, 1.25, z)
  // perilla: mentón y bajo el labio de abajo
  const perilla = (1 - suave(0.18 * (b.anchoPerilla ?? 1), 0.3 * (b.anchoPerilla ?? 1), ax)) * (1 - suave(6.6, 6.64, y)) * suave(5.95, 6.15, y) * suave(0.9, 1.15, z)
  // mandíbula: borde inferior de la cara, de oreja a oreja
  const yTopeMej = 6.62 + 0.42 * (b.mejillas ?? 0.5)
  const mandibula = frente * (1 - suave(yTopeMej - 0.05, yTopeMej + 0.05 + 0.06 * (b.borde ?? 0.5), y)) * suave(6.05, 6.25, y + 0.25 * suave(0.6, 0.2, z)) * (1 - suave(0.86, 0.92, ax))
  // mejillas: sube hasta el pómulo (según "mejillas"), con la línea que baja hacia la boca
  const mej = frente * suave(0.2, 0.45, ax) * (1 - suave(yTopeMej - 0.06 - (1 - suave(0.25, 0.55, ax)) * 0.15, yTopeMej + 0.06 * (b.borde ?? 0.5) + 0.02, y)) * suave(6.3, 6.5, y)
  // cuello: bajo el mentón, adelante
  const cuello = suave(0.2, 0.5, z) * (1 - suave(6.1, 6.25, y)) * suave(5.85 + 0.25 * (1 - (b.cuello ?? 0.5)), 6.05 + 0.25 * (1 - (b.cuello ?? 0.5)), y) * (1 - suave(0.45, 0.6, ax))
  const m = Math.max(bigote * (b.bigote ?? 1), perilla * (b.perilla ?? 1), mandibula * (b.mandibula ?? 1), mej * (b.mandibula ?? 1) * Math.min(1, (b.mejillas ?? 0.5) * 2), cuello * (b.cuello ?? 0.5) * 1.6)
  // FASE 5 g3: bigote FINO pintado (b.bigoteFino) que cae por las comisuras (b.caida, dm): el de "tres
  // mechones" de Sun Tzu. Una banda angosta sobre el labio de arriba y dos hilos que bajan junto a la boca.
  if (b.bigoteFino) {
    const banda = (1 - suave(0.26, 0.31, ax)) * suave(6.79, 6.81, y) * (1 - suave(6.845, 6.87, y)) * suave(1.1, 1.25, z) * (0.55 + 0.45 * suave(0.03, 0.1, ax))
    const caida = b.caida ?? 0.25, t = clamp((6.83 - y) / caida, 0, 1), xc = 0.275 + 0.03 * t
    const cae = (1 - suave(0.03, 0.05, Math.abs(ax - xc))) * suave(6.83 - caida - 0.02, 6.83 - caida + 0.03, y) * (1 - suave(6.82, 6.85, y)) * suave(0.85, 1.05, z) * (1 - 0.45 * t)
    return clamp(Math.max(m * (1 - labios), Math.max(banda * (1 - labios * (1 - suave(0.08, 0.2, ax))), cae) * b.bigoteFino), 0, 1)
  }
  return clamp(m, 0, 1) * (1 - labios)
}
// Cuero cabelludo (para rapados y sombra de la línea del pelo). alto: + sube la línea (dm).
function mascaraCuero(v, l = {}) {
  const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2], ax = Math.abs(x)
  const alto = (l.alto ?? 0) * 0.1
  // frente: línea a y≈7,9 al centro; entradas la suben en las sienes; recta = esquinas a 90°
  const ent = (l.entradas ?? 0) * 0.35 * suave(0.12, 0.45, ax)
  const yFrente = 7.88 + alto + ent - (l.recta ?? 0) * 0.04
  const delante = suave(0.35, 0.75, z)
  // costados: sobre la oreja (y 7,25) con patilla que baja delante de la oreja
  const patilla = suave(0.55, 0.7, ax) * suave(0.1, 0.3, z) * (1 - suave(0.45, 0.6, z))
  const yLado = 7.3 - patilla * (0.45 + 0.1 * (l.patillas ?? 0))
  // atrás: nuca baja hasta y≈6,55
  const atras = suave(0.0, -0.4, z)
  const yLim = delante * yFrente + (1 - delante) * ((1 - atras) * yLado + atras * (6.55 - 0.1 * (l.nuca ?? 0)))
  // oreja: fuera
  const oreja = suave(0.66, 0.74, ax) * (1 - suave(6.75, 6.85, y)) * 0 + suave(0.7, 0.78, ax) * suave(6.85, 6.95, y) * (1 - suave(7.45, 7.6, y)) * (1 - suave(0.15, 0.35, z)) * suave(-0.35, -0.15, z)
  return clamp(suave(yLim - 0.03, yLim + 0.05, y) * (1 - oreja), 0, 1)
}

// Pintado de la barba sobre la piel: barba de días = sombra; barba con volumen = base oscura bajo las tarjetas.
function pintadaBarba(b) {
  if ((b.densidad ?? 0) < 0.35) return clamp((b.densidad ?? 0) * 1.6, 0, 0.6)
  if ((b.largo ?? 0) < 0.006) return clamp(0.75 + 0.25 * (b.densidad ?? 1), 0, 0.95) // barba al ras: solo pintada
  return 0.8
}
// Delineado y sombra de ojos (en la malla neutra: ojos en ±0,308 / 7,284 / 1,245).
function mascaraMaquillaje(v, mq) {
  const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2], ax = Math.abs(x)
  if (z < 1.0) return [0, 0]
  const dx = (ax - 0.308) / 0.16, dy = (y - 7.284) / 0.07
  const r = Math.hypot(dx, dy)
  // borde del párpado (anillo) + cola hacia afuera y un poco arriba
  const anillo = Math.exp(-(((r - 1.05) / 0.22) ** 2))
  const cola = suave(0.9, 1.1, dx) * (1 - suave(1.6, 2.1, dx)) * Math.exp(-(((dy - 0.25 * (dx - 1)) / 0.28) ** 2))
  const kohl = clamp(Math.max(anillo, cola) * (mq.delineado ?? 0), 0, 1)
  // sombra: arriba del ojo, hasta la ceja
  const sombra = clamp(suave(0.2, 0.9, dy) * (1 - suave(2.0, 2.8, dy)) * (1 - suave(1.1, 1.6, Math.abs(dx))) * (mq.sombra ?? 0), 0, 1)
  return [kohl, sombra]
}

// Corona de pelo de un calvo (herradura): sienes, sobre las orejas y nuca.
function mascaraCorona(v, c) {
  const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2], ax = Math.abs(x)
  const cuero = mascaraCuero(v, { patillas: c.patillas ?? 0 })
  const yTope = (c.tope ?? 7.62) + 0.14 * suave(-0.1, -0.6, z)
  const banda = 1 - suave(yTope - 0.04, yTope + 0.06, y)
  const delante = 1 - suave(0.5, 0.65, z)
  return clamp(cuero * banda * delante * (ax > 0.3 || z < -0.2 ? 1 : suave(-0.1, -0.25, z)), 0, 1)
}

// azar determinista
function azarDe(semilla) { let s = semilla >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }

// Tarjetas sobre la piel (malla decimada de la cabeza): devuelve una lista de cintas.
function tarjetasSobrePiel(pos, nrm, mascara, o) {
  const r = azarDe(o.semilla)
  const tris = TOPO.piel.tris
  const out = []
  const vmask = new Map()
  const mk = (v) => { if (!vmask.has(v)) vmask.set(v, mascara(v)); return vmask.get(v) }
  const SEG = o.tipo === "corona" ? 3 : 4
  for (const [a, b, c] of tris) {
    const ma = mk(a), mb = mk(b), mc = mk(c)
    const mm = (ma + mb + mc) / 3
    if (mm < 0.05) continue
    const e1 = [0, 1, 2].map(e => pos[b * 3 + e] - pos[a * 3 + e]), e2 = [0, 1, 2].map(e => pos[c * 3 + e] - pos[a * 3 + e])
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const area = Math.hypot(...cr) / 2
    const Lmed = o.largo * (0.6 + 0.4 * mm)
    const esperado = area * mm * o.cobertura / (o.ancho * Math.max(0.05, Lmed))
    let n = Math.floor(esperado + r())
    for (; n > 0; n--) {
      let u = r(), w = r(); if (u + w > 1) { u = 1 - u; w = 1 - w }
      const k0 = 1 - u - w
      const m = k0 * ma + u * mb + w * mc
      if (r() > m * 1.2) continue
      const p = [0, 1, 2].map(e => k0 * pos[a * 3 + e] + u * pos[b * 3 + e] + w * pos[c * 3 + e])
      let nn = [0, 1, 2].map(e => k0 * nrm[a * 3 + e] + u * nrm[b * 3 + e] + w * nrm[c * 3 + e]); const ln = Math.hypot(...nn); nn = nn.map(x => x / ln)
      // crecer hacia abajo pegado a la cara (o hacia atrás y abajo, la corona)
      let g = o.tipo === "corona" ? [0, -1, -0.35] : [0, -1, 0.12]
      // bigote: hacia los lados y abajo
      const x0 = p[0]
      if (o.tipo === "barba" && p[1] > 6.78 && p[2] > 1.1) g = [Math.sign(x0) * 0.6, -1, 0.1]
      const proy = (d) => { const k = d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2]; const t = [d[0] - k * nn[0], d[1] - k * nn[1], d[2] - k * nn[2]]; const l = Math.hypot(...t) || 1; return t.map(x => x / l) }
      let dir = proy(g)
      // despegue de la piel
      const despegue = o.tipo === "corona" ? 0.45 : 0.3
      dir = dir.map((x, e) => x + nn[e] * despegue); { const l = Math.hypot(...dir); dir = dir.map(x => x / l) }
      // largo: más en el mentón si la barba cuelga
      const enMenton = suave(6.55, 6.15, p[1]) * (1 - suave(o.anchoColgante * 0.5 || 0.4, (o.anchoColgante * 0.5 || 0.4) + 0.25, Math.abs(x0)))
      const L = (o.largo * (0.55 + 0.45 * m) + (o.colgante || 0) * enMenton) * (0.75 + 0.45 * r())
      const ancho = o.ancho * (0.8 + 0.5 * r()) * (0.6 + 0.4 * m)
      // eje de la cinta y su ancho (en el plano de la piel)
      let lado = [dir[1] * nn[2] - dir[2] * nn[1], dir[2] * nn[0] - dir[0] * nn[2], dir[0] * nn[1] - dir[1] * nn[0]]
      { const l = Math.hypot(...lado) || 1; lado = lado.map(x => x / l) }
      const P = [], N = [], T = [], I = [], V = []
      const col = Math.floor(r() * 4) / 4
      const tono = r(), cana = r()
      // volumen: las tarjetas arrancan a distintas alturas sobre la piel (capas), más en barba larga
      const capa = Math.pow(r(), 1.5) * Math.min(0.35, L * 0.35)
      let q = p.map((x, e) => x - nn[e] * 0.004 + nn[e] * capa), d = dir.slice()
      const fase = r() * 6.28
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG
        const rz = (o.rizo || 0) * 0.35 * Math.sin(fase + t * 7) * ancho * 3
        for (const sd of [-0.5, 0.5]) {
          const ww = ancho * (1 - 0.55 * t)
          P.push(q[0] + lado[0] * (sd * ww + rz), q[1] + lado[1] * (sd * ww + rz), q[2] + lado[2] * (sd * ww + rz))
          N.push(nn[0], nn[1], nn[2]); T.push(col + (sd + 0.5) * 0.25, t); V.push(tono, cana)
        }
        if (i < SEG) {
          // gravedad: cada tramo se inclina un poco más hacia abajo
          const grav = (o.tipo === "corona" ? 0.15 : 0.22) + 0.5 * (o.colgante ? enMenton : 0)
          d = d.map((x, e) => x + (e === 1 ? -grav : 0)); const l = Math.hypot(...d); d = d.map(x => x / l)
          q = q.map((x, e) => x + d[e] * L / SEG)
          const b0 = i * 2; I.push(b0, b0 + 1, b0 + 3, b0, b0 + 3, b0 + 2)
        }
      }
      out.push({ P, N, T, I, V })
    }
  }
  return out
}


// ════════════════════════════════════════════════════════════════════════════════════════════
// FASE 4: piezas PROPIAS (sin assets del .deb): cejas en tarjetas ligadas a la piel, pestañas sobre
// los helpers CC0 del base.obj, dientes y lengua de los helpers CC0, máscaras extra de la piel.
// ════════════════════════════════════════════════════════════════════════════════════════════
const grupoQuads = (g) => base.grupos.get(g).map(i => base.caras[i].v)
// islas del atlas (atlas2.mjs): vértices del interior de la boca y de las cuencas de los ojos
const VERT_DE_UV = new Map(); TOPO.piel.tris.forEach((t, f) => t.forEach((v, k) => VERT_DE_UV.set(TOPO.piel.tuv[f][k], v)))
const vSet = (ks) => new Set((ks || []).map(k => VERT_DE_UV.get(k)))
const V_BOCA = vSet(TOPO.atlas.islas?.boca), V_CUENCA = vSet(TOPO.atlas.islas?.cuencas)

// (N0_PIEL: normales de la malla neutra, se calculan al primer uso)
// Máscaras extra de la piel (por vértice, en la malla NEUTRA): x = cavidad de la boca (se oscurece:
// boca abierta = hueco oscuro, no una placa rosa), y = costura del cuello (el tono se funde con el del
// cuerpo de hoy), z = cuenca del ojo (lo que el párpado tapa y el parpadeo muestra: tono de párpado).
let PARP_MAG = null
let N0_PIEL = null
function mascaraExtra(v) {
  if (!N0_PIEL) N0_PIEL = normales(P0, cuerpoTris, NV)
  const y = P0[v * 3 + 1], z = P0[v * 3 + 2]
  let cav = V_BOCA.has(v) ? suave(1.5, 1.32, z) : 0
  // y toda piel dentro de la boca que mira hacia adentro (carrillos): la normal apunta al centro de la boca
  {
    const x = P0[v * 3], ax = Math.abs(x)
    if (ax < 0.4 && y > 6.35 && y < 6.95 && z < 1.45) {
      const n = N0_PIEL, c = [0, 6.7, 1.0]
      const hacia = (c[0] - x) * n[v * 3] + (c[1] - y) * n[v * 3 + 1] + (c[2] - z) * n[v * 3 + 2]
      if (hacia > 0) cav = Math.max(cav, suave(1.45, 1.3, z))
    }
  }
  const cos = 1 - suave(5.97, 6.2, y)
  const cue = V_CUENCA.has(v) ? 1 : 0
  const par = PARP_MAG ? PARP_MAG[v] : 0
  return [cav, cos, cue, par]
}

// punto más cercano de un triángulo (Ericson) → baricéntricas
function masCercano(p, a, b, c) {
  const sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2]
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return [1, 0, 0]
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return [0, 1, 0]
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); return [1 - t, t, 0] }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return [0, 0, 1]
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); return [1 - t, 0, t] }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [0, 1 - t, t] }
  const den = 1 / (va + vb + vc); const vv = vb * den, ww = vc * den; return [1 - vv - ww, vv, ww]
}
// Liga puntos (malla neutra) a la piel decimada: triángulo + baricéntricas + altura sobre la normal.
function ligar(puntos, filtroTri) {
  const tris = TOPO.piel.tris.filter(filtroTri)
  const P = (v) => [P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]]
  const N0 = normales(P0, cuerpoTris, NV)
  return puntos.map(({ p, h }) => {
    let mejor = null, dmin = 1e9
    for (const t of tris) {
      const l = masCercano(p, P(t[0]), P(t[1]), P(t[2]))
      const q = [0, 1, 2].map(e => l[0] * P0[t[0] * 3 + e] + l[1] * P0[t[1] * 3 + e] + l[2] * P0[t[2] * 3 + e])
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      if (d < dmin) { dmin = d; mejor = { t, l } }
    }
    return { ...mejor, h }
  })
}
function evaluarLigados(lig, pos, nrm) {
  const out = [], nOut = []
  for (const { t, l, h } of lig) {
    const n = [0, 1, 2].map(e => l[0] * nrm[t[0] * 3 + e] + l[1] * nrm[t[1] * 3 + e] + l[2] * nrm[t[2] * 3 + e]); const ln = Math.hypot(...n) || 1
    for (let e = 0; e < 3; e++) { out.push(l[0] * pos[t[0] * 3 + e] + l[1] * pos[t[1] * 3 + e] + l[2] * pos[t[2] * 3 + e] + n[e] / ln * h); nOut.push(n[e] / ln) }
  }
  return { P: out, N: nOut }
}
// rayo hacia -z desde (x, y, 3) contra la piel neutra: punto de la superficie (para trazar la ceja)
function superficieZ(x, y) {
  let zb = -1e9
  for (const t of TOPO.piel.tris) {
    const a = t.map(v => [P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]])
    const d = (a[1][1] - a[2][1]) * (a[0][0] - a[2][0]) + (a[2][0] - a[1][0]) * (a[0][1] - a[2][1])
    if (Math.abs(d) < 1e-12) continue
    const l1 = ((a[1][1] - a[2][1]) * (x - a[2][0]) + (a[2][0] - a[1][0]) * (y - a[2][1])) / d
    const l2 = ((a[2][1] - a[0][1]) * (x - a[2][0]) + (a[0][0] - a[2][0]) * (y - a[2][1])) / d
    const l3 = 1 - l1 - l2
    if (l1 < 0 || l2 < 0 || l3 < 0) continue
    const z = l1 * a[0][2] + l2 * a[1][2] + l3 * a[2][2]
    if (z > zb) zb = z
  }
  return zb
}

// Cejas PROPIAS: dos capas de tarjetas por lado que siguen el arco de la ceja sobre la piel. La forma
// sale de la ficha (grosor, largo, arco, inclinación, alto, pobladas); la textura (ceja.png) da las hebras.
// u = de la cabeza a la cola, v = de abajo arriba. Ligadas a la piel: siguen los targets y los morphs.
function cejasPropias(ce) {
  const NS = 14, filas = 3
  const grosor = (ce.grosor ?? 1) * (1 + 0.25 * (ce.pobladas ?? 0)), largo = ce.largo ?? 1, arco = ce.arco ?? 0.2
  const incl = ce.inclinacion ?? 0, alto = ce.alto ?? 0
  const puntos = [], meta = []
  for (const lado of [1, -1]) {
    for (const capa of [0, 1]) {
      const h = capa === 0 ? 0.004 : 0.010 + 0.006 * (ce.pobladas ?? 0)
      const angosta = capa === 0 ? 1 : 0.78
      for (let i = 0; i <= NS; i++) {
        const s = i / NS
        const x = 0.105 + 0.46 * largo * s
        const bump = s < 0.62 ? Math.sin(Math.PI / 2 * s / 0.62) : Math.cos(Math.PI / 2 * (s - 0.62) / 0.38 * 0.85)
        const yc = 7.392 + (0.03 + 0.07 * arco) * bump - 0.018 * s - incl * 0.05 * (s - 0.35) + alto * 0.05
        // grosor: cabeza llena, cuerpo, cola fina
        const w = (0.072 * (1 - 0.35 * suave(0.3, 1, s)) * (1 - 0.45 * suave(0.75, 1, s)) + 0.012 * (1 - suave(0, 0.12, s))) * grosor * angosta
        for (let f = 0; f < filas; f++) {
          const k = f / (filas - 1)
          const y = yc - 0.45 * w + w * k
          const z = superficieZ(x, y)
          puntos.push({ p: [lado * x, y, z], h })
          meta.push({ u: s, v: k, lado, capa })
        }
      }
    }
  }
  const lig = ligar(puntos, (t) => t.every(v => P0[v * 3 + 1] > 7.25 && P0[v * 3 + 1] < 7.85 && P0[v * 3 + 2] > 0.5))
  // triángulos: por lado y capa, una grilla (NS+1) × filas
  const I = [], porGrupo = (NS + 1) * filas
  for (let g = 0; g < 4; g++) for (let i = 0; i < NS; i++) for (let f = 0; f < filas - 1; f++) {
    const a = g * porGrupo + i * filas + f, b = a + filas, c = b + 1, d = a + 1
    I.push(a, b, c, a, c, d)
  }
  // la capa de arriba usa otra parte de la textura (corrida en u) para no repetir el dibujo
  const T = meta.flatMap(m => [m.capa ? Math.min(1, m.u * 0.92 + 0.05) : m.u, m.v])
  const A = meta.map(m => m.capa ? 0.75 * (ce.densidad ?? 1) : (ce.densidad ?? 1))
  return { lig, I, T, A }
}

// Pestañas PROPIAS. Los helpers CC0 del base.obj (helper-*-eyelashes-1 abajo, -2 arriba) son cáscaras
// que se apoyan sobre el párpado; de ellos se toma solo el BORDE (la fila más cercana a la abertura del
// ojo, que mueven los targets y el parpadeo) y la fila siguiente (la dirección "párpado arriba"). La
// tarjeta nace en el borde y sale hacia afuera y arriba con una curva: u del lagrimal a la comisura,
// v de la raíz a la punta (mitad alta de pestanas.png arriba, baja abajo).
function pestanasBordes() {
  // La isla uv de la "cuenca" es una copa detrás del globo; su borde compartido con la cara es el borde
  // libre de los párpados. Se parte en arriba/abajo por la recta entre las comisuras y se remuestrea.
  const out = []
  for (const [lado, ojo] of [[1, OJO_L], [-1, OJO_R]]) {
    const c = centro(ojo, P0)
    // el borde libre = los vértices que la isla de la cuenca (la copa detrás del globo) comparte con la
    // de la cara: un anillo alrededor de la abertura del ojo
    const V_CAB = vSet(TOPO.atlas.islas?.cabeza)
    const anillo = [...V_CUENCA].filter(v => V_CAB.has(v) && Math.sign(P0[v * 3]) === lado)
    // vecinos de cada vértice del anillo en la cara (afuera de la copa): su movimiento es el del borde visible
    const vecinos = new Map()
    for (const t of TOPO.piel.tris) for (const v of t) if (anillo.includes(v)) for (const w of t) if (w !== v || true) (vecinos.get(v) ?? vecinos.set(v, new Set()).get(v)).add(w)
    const xl = (v) => (P0[v * 3] - c[0]) * lado
    const vin = anillo.reduce((a, v) => (xl(v) < xl(a) ? v : a)), vout = anillo.reduce((a, v) => (xl(v) > xl(a) ? v : a))
    const yRecta = (v) => { const t = (xl(v) - xl(vin)) / Math.max(1e-6, xl(vout) - xl(vin)); return P0[vin * 3 + 1] * (1 - t) + P0[vout * 3 + 1] * t }
    const arr = anillo.filter(v => v === vin || v === vout || P0[v * 3 + 1] > yRecta(v))
    const abj = anillo.filter(v => v === vin || v === vout || P0[v * 3 + 1] <= yRecta(v))
    for (const [cam0, arriba] of [[arr, 1], [abj, 0]]) {
      const cam = [...new Set(cam0)].sort((a, b) => xl(a) - xl(b))
      const L = [0]; for (let i = 1; i < cam.length; i++) L.push(L[i - 1] + Math.hypot(...[0, 1, 2].map(e => P0[cam[i] * 3 + e] - P0[cam[i - 1] * 3 + e])))
      const NP = arriba ? 22 : 16, pts = []
      for (let k = 0; k < NP; k++) {
        const u = 0.03 + 0.94 * k / (NP - 1), s2 = u * L[L.length - 1]
        let i = 1; while (i < L.length - 1 && L[i] < s2) i++
        const t = (s2 - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])
        pts.push({ a: cam[i - 1], b: cam[i], t, u, va: [...(vecinos.get(cam[i - 1]) ?? [])], vb: [...(vecinos.get(cam[i]) ?? [])] })
      }
      out.push({ pts, ojo, arriba, n: cam.length })
    }
  }
  console.log("pestañas: bordes", out.map(o => o.n).join(","))
  return out
}
function pestanasEn(bordes, pos, nrm, posRef = P0, globos = null) {
  const P = [], N = [], T = [], I = []
  const nz = (x) => { const l = Math.hypot(...x) || 1; return x.map(y => y / l) }
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  // gira v con la rotación mínima que lleva a0 a a1 (Rodrigues)
  const girar = (v, a0, a1) => {
    const k = cruz(a0, a1), sn = Math.hypot(...k), cs = a0[0] * a1[0] + a0[1] * a1[1] + a0[2] * a1[2]
    if (sn < 1e-6) return v
    const kk = k.map(x => x / sn), kv = cruz(kk, v), kd = kk[0] * v[0] + kk[1] * v[1] + kk[2] * v[2]
    return [0, 1, 2].map(e => v[e] * cs + kv[e] * sn + kk[e] * kd * (1 - cs))
  }
  for (const { pts, ojo, arriba } of bordes) {
    const c = centro(ojo, pos), c0 = centro(ojo, posRef)
    const L = arriba ? 0.095 : 0.035
    const b0 = P.length / 3
    const sg = arriba ? 1 : -1
    for (const { a, b, t, u, va, vb } of pts) {
      let p = [0, 1, 2].map(e => posRef[a * 3 + e] * (1 - t) + posRef[b * 3 + e] * t)
      // movimiento del borde visible (los vecinos en la cara) entre la pose de referencia y esta
      // (el vecino que más se mueve: el borde mismo del párpado)
      const mov = (lista) => { let d = [0, 0, 0], m = -1; for (const w of lista) { const q = [0, 1, 2].map(e => pos[w * 3 + e] - posRef[w * 3 + e]); const l = Math.hypot(...q); if (l > m) { m = l; d = q } } return d }
      const ma = mov(va), mb = mov(vb), dmov = [0, 1, 2].map(e => ma[e] * (1 - t) + mb[e] * t)
      // el anillo del borde queda DENTRO del globo (la piel lo tapa por fuera): la raíz va a la superficie
      // del globo en esa dirección (+0,4 mm), que es donde se ve el borde del párpado
      // (se adelanta en z, sin mover x ni y: visto de frente queda justo en el borde del párpado)
      const alGlobo = (q, off) => { if (!globos) return q; const g = globos[ojo === OJO_L ? 0 : 1]; const dx = q[0] - g.c[0], dy = q[1] - g.c[1]; const zz = g.c[2] + Math.sqrt(Math.max(0, g.R * g.R - dx * dx - dy * dy)) + off; return q[2] < zz ? [q[0], q[1], zz] : q }
      p = alGlobo(p, 0.004)
      const p0 = p.slice()
      // lo que mueve la raíz al parpadear: los vértices de la piel más cercanos a la raíz (el borde visible
      // del párpado, que la decimación dejó fuera del anillo)
      {
        const cerca = TOPO.piel.vertices.map(w => [w, Math.hypot(posRef[w * 3] - p0[0], posRef[w * 3 + 1] - p0[1], posRef[w * 3 + 2] - p0[2])]).sort((x, y) => x[1] - y[1]).slice(0, 4).map(x => x[0])
        const m2 = mov(cerca)
        if (Math.hypot(...m2) > Math.hypot(...dmov)) for (let e = 0; e < 3; e++) dmov[e] = m2[e]
      }
      // cerrado, el párpado tiene grosor: la raíz va un poco más afuera del globo
      p = alGlobo(p.map((x, e) => x + dmov[e]), 0.004 + 0.022 * Math.min(1, Math.hypot(...dmov) / 0.07))
      if (process.env.DBG_PEST && pos !== posRef) console.log("pest", arriba, u.toFixed(2), dmov.map(x => x.toFixed(3)).join(","), va.length, vb.length)
      const o = nz([0, 1, 2].map(e => p[e] - c[e])), o0 = nz([0, 1, 2].map(e => p0[e] - c0[e]))
      // en reposo: hacia adelante y un poco hacia arriba (abajo las de abajo), abiertas hacia la sien;
      // en otra pose (parpadeo) giran con el borde del párpado alrededor del globo
      const afuera = (u - 0.5) * 0.35 * Math.sign(p0[0] - c0[0] || 1) * 0 + 0
      // (al cerrar giran la mitad que el borde: quedan hacia adelante y abajo, no colgando)
      const oM = nz(o0.map((x, e) => x + o[e]))
      const d1 = nz(girar(nz([o0[0] * 0.3 + afuera, sg * 0.3 + o0[1] * 0.3, 1]), o0, oM))
      const d2 = nz(girar(nz([o0[0] * 0.2, sg * 1.0, 0.45]), o0, oM))
      const k = (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.92))) * L
      const m = p.map((x, e) => x + d1[e] * k * 0.55)
      const tt = m.map((x, e) => x + d2[e] * k * 0.5)
      for (const [q, vv] of [[p, 0], [m, 0.5], [tt, 1]]) {
        P.push(...q.map((x, e) => x - o[e] * 0.002)); N.push(...o)
        T.push(0.02 + 0.96 * u, arriba ? 0.5 + 0.49 * vv : 0.01 + 0.48 * vv)
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let f = 0; f < 2; f++) {
      const a = b0 + i * 3 + f, b = a + 3
      I.push(a, b, b + 1, a, b + 1, a + 1)
    }
  }
  return { P, N, T, I }
}

// Dientes y lengua de los helpers CC0 del base.obj. Dientes: aDiente = (arco en dm desde el centro / 0,7,
// t = 0 en el borde que muerde, 1 en la encía): el shader dibuja las piezas, las separaciones y la encía.
function dientesPropios() {
  const verts = [], I = [], A = []
  for (const [g, arriba] of [["helper-upper-teeth", 1], ["helper-lower-teeth", 0]]) {
    const quads = grupoQuads(g)
    const vs = [...new Set(quads.flat())]
    const loc = new Map()
    // arco: ángulo alrededor de un centro detrás de los incisivos, convertido a largo de arco por la
    // fila de adelante; t por franja de arco entre el y mínimo y el máximo
    const zc = 0.9
    const ang = (v) => Math.atan2(Math.abs(P0[v * 3]), P0[v * 3 + 2] - zc)
    const orden = vs.slice().sort((a, b) => ang(a) - ang(b))
    // largo de arco acumulado (sobre los vértices ordenados por ángulo, por su proyección xz)
    const arcoDe = new Map(); let acc = 0, prev = null
    for (const v of orden) { if (prev !== null) acc += Math.hypot(Math.abs(P0[v * 3]) - Math.abs(P0[prev * 3]), P0[v * 3 + 2] - P0[prev * 3 + 2]) * 0.5; arcoDe.set(v, acc); prev = v }
    const NB = 8, amax = Math.max(...vs.map(ang)), ymn = Array(NB).fill(9), ymx = Array(NB).fill(-9)
    const bin = (v) => Math.min(NB - 1, Math.floor(ang(v) / amax * NB))
    for (const v of vs) { const b = bin(v); ymn[b] = Math.min(ymn[b], P0[v * 3 + 1]); ymx[b] = Math.max(ymx[b], P0[v * 3 + 1]) }
    for (const v of vs) {
      loc.set(v, verts.length); verts.push(v)
      const b = bin(v), y = P0[v * 3 + 1]
      const t = arriba ? (y - ymn[b]) / (ymx[b] - ymn[b]) : (ymx[b] - y) / (ymx[b] - ymn[b])
      // largo de arco ≈ ángulo × 0,45 dm (radio medio del arco dental del helper)
      A.push(Math.min(1, ang(v) * 0.45 / 0.7), Math.min(1, Math.max(0, t)))
    }
    for (const q of quads) { const a = loc.get(q[0]), b = loc.get(q[1]), c = loc.get(q[2]), d = loc.get(q[3]); I.push(a, b, c); if (q[3] !== q[2]) I.push(a, c, d) }
  }
  const lq = grupoQuads("helper-tongue"), lv = [...new Set(lq.flat())], ll = new Map(); lv.forEach((v, i) => ll.set(v, i))
  const LI = []; for (const q of lq) { const a = ll.get(q[0]), b = ll.get(q[1]), c = ll.get(q[2]), d = ll.get(q[3]); LI.push(a, b, c); if (q[3] !== q[2]) LI.push(a, c, d) }
  return { dientes: { verts, I, A }, lengua: { verts: lv, I: LI } }
}

// Expresión de reposo AMABLE para todos (figuras reales: nada de comisuras caídas ni ceño): las
// comisuras van a neutro o apenas arriba y las cejas se relajan. Se suma a la de cada ficha.
const EXPR_BASE = { "mouth-corner-puller": 0.16, "mouth-elevation": 0.0, "mouth-depression": 0, "eyebrows-left-inner-up": 0.0, "eyebrows-right-inner-up": 0.0 }
const DET_BASE = { "mouth/mouth-angles-down|up": 0.35 }

// ── cuantización ──
class Bin {
  constructor() { this.partes = []; this.off = 0; this.cab = {} }
  add(nombre, arr, tipo, extra = {}) {
    let buf
    const info = { tipo, n: arr.length, off: this.off, ...extra }
    if (tipo === "i16") { // por componente con min/escala
      const k = extra.k || 3, min = [], esc = []
      for (let e = 0; e < k; e++) { let a = 1e9, b = -1e9; for (let i = e; i < arr.length; i += k) { a = Math.min(a, arr[i]); b = Math.max(b, arr[i]) } min.push(a); esc.push((b - a) / 65535 || 1e-9) }
      const q = new Uint16Array(arr.length); for (let i = 0; i < arr.length; i++) q[i] = Math.round((arr[i] - min[i % k]) / esc[i % k])
      info.min = min; info.esc = esc; info.tipo = "u16q"; buf = Buffer.from(q.buffer)
    } else if (tipo === "s8") { const q = new Int8Array(arr.length); for (let i = 0; i < arr.length; i++) q[i] = Math.round(clamp(arr[i], -1, 1) * 127); buf = Buffer.from(q.buffer) }
    else if (tipo === "u8") { const q = new Uint8Array(arr.length); for (let i = 0; i < arr.length; i++) q[i] = Math.round(clamp(arr[i], 0, 1) * 255); buf = Buffer.from(q.buffer) }
    else if (tipo === "uv") { const q = new Uint16Array(arr.length); for (let i = 0; i < arr.length; i++) q[i] = Math.round(clamp(arr[i], 0, 1) * 65535); buf = Buffer.from(q.buffer) }
    else if (tipo === "u16") { const q = Uint16Array.from(arr); buf = Buffer.from(q.buffer) }
    else if (tipo === "u32") { const q = Uint32Array.from(arr); buf = Buffer.from(q.buffer) }
    else throw new Error(tipo)
    this.partes.push(buf); this.off += buf.length
    const pad = (4 - (this.off % 4)) % 4; if (pad) { this.partes.push(Buffer.alloc(pad)); this.off += pad }
    this.cab[nombre] = info
  }
  buffer() { return Buffer.concat(this.partes) }
}

// ── horneado ──
export function hornear(cfg) {
  const t0 = performance.now()
  const detBase = cfg.sinBase ? {} : (cfg.detBase ?? DET_BASE)
  const det = { ...cfg.detalles }
  for (const [k, v] of Object.entries(detBase)) det[k] = clamp((det[k] ?? 0) + v, -1, 1)
  const { pos } = construirCuerpo(base, { macro: cfg.macro, detalles: det })
  const m = { african: 1 / 3, asian: 1 / 3, caucasian: 1 / 3, ...cfg.macro }
  const se = m.african + m.asian + m.caucasian
  const etn = { african: m.african / se, asian: m.asian / se, caucasian: m.caucasian / se }
  const expr = (pos2, nombre, w) => { for (const [r, wr] of Object.entries(etn)) if (wr > 0.001) { const t = leerTarget(`expression/units/${r}/${nombre}`); if (!t) throw new Error("falta " + nombre); for (let k = 0; k < t.idx.length; k++) { const i = t.idx[k] * 3; pos2[i] += t.d[k * 3] * w * wr; pos2[i + 1] += t.d[k * 3 + 1] * w * wr; pos2[i + 2] += t.d[k * 3 + 2] * w * wr } } }
  const exprTotal = { ...(cfg.sinBase ? {} : (cfg.exprBase ?? EXPR_BASE)) }
  for (const [n, w] of Object.entries(cfg.expresion || {})) exprTotal[n] = (exprTotal[n] ?? 0) + w
  for (const [n, w] of Object.entries(exprTotal)) if (Math.abs(w) > 1e-4) expr(pos, n, w)
  // FASE 5 (grupo 1): gesto asimétrico por lado, { unidad: [derecha, izquierda] } (la sonrisa torcida
  // de Musk). Lado del personaje: izquierda = +x en MH; mezcla suave en la línea media (±0,15 dm).
  for (const [n, [wd, wi]] of Object.entries(cfg.expresionLados || {})) for (const [r, wr] of Object.entries(etn)) if (wr > 0.001) {
    const t = leerTarget(`expression/units/${r}/${n}`); if (!t) throw new Error("falta " + n)
    for (let k = 0; k < t.idx.length; k++) { const i = t.idx[k] * 3; const s = clamp((pos[i] + 0.15) / 0.3, 0, 1), w = (wd + (wi - wd) * s * s * (3 - 2 * s)) * wr; pos[i] += t.d[k * 3] * w; pos[i + 1] += t.d[k * 3 + 1] * w; pos[i + 2] += t.d[k * 3 + 2] * w }
  }

  // morph boca: mandíbula girada (pesos del rig) alrededor de jaw____head, eje x
  const ANG = 0.3
  const piv = centro(SK.joints["jaw____head"], pos)
  const posBoca = Float32Array.from(pos)
  const c = Math.cos(ANG), s = Math.sin(ANG)
  for (let v = 0; v < NV; v++) {
    const w = wJaw[v]; if (w < 1e-4) continue
    const y = pos[v * 3 + 1] - piv[1], z = pos[v * 3 + 2] - piv[2]
    posBoca[v * 3 + 1] = pos[v * 3 + 1] + w * (y * c - z * s + piv[1] - pos[v * 3 + 1])
    posBoca[v * 3 + 2] = pos[v * 3 + 2] + w * (y * s + z * c + piv[2] - pos[v * 3 + 2])
  }
  // morph parpadeo: las dos unidades de cierre
  const posParp = Float32Array.from(pos)
  expr(posParp, "eye-left-closure", 1); expr(posParp, "eye-right-closure", 1)

  // FASE 4: la bolsa de la boca decimada cruzaba por DELANTE de los dientes (paredes aplanadas por el
  // QEM): lo que es cavidad se empuja hacia atrás (y un poco hacia el centro) en las tres poses
  {
    if (!N0_PIEL) N0_PIEL = normales(P0, cuerpoTris, NV)
    for (const v of TOPO.piel.vertices) {
      const c = mascaraExtra(v)[0]
      if (c < 0.05) continue
      const k = suave(0.05, 0.7, c)
      for (const P of [pos, posBoca, posParp]) { P[v * 3 + 2] -= 0.22 * k; P[v * 3] *= 1 - 0.25 * k }
    }
  }
  const nrm = normales(pos, cuerpoTris, NV)
  // ext.w: cuánto se mueve cada vértice al parpadear (normalizado): el párpado se limpia de la mancha
  { let mx = 0; const m = new Float32Array(NV); for (let v = 0; v < NV; v++) { m[v] = Math.hypot(posParp[v * 3] - pos[v * 3], posParp[v * 3 + 1] - pos[v * 3 + 1], posParp[v * 3 + 2] - pos[v * 3 + 2]); mx = Math.max(mx, m[v]) } for (let v = 0; v < NV; v++) m[v] = suave(0.05, 0.45, m[v] / (mx || 1)); PARP_MAG = m }
  const bin = new Bin(), mallas = []
  const pelo0 = cfg.cuero || null, barba = cfg.barba || null
  // ── piel ──
  const piel = armarMalla(TOPO.piel.tris, TOPO.piel.tuv, pos, nrm, UVA, {
    w: (v) => [wCab[v] + (wJaw[v] > 0 ? wJaw[v] : 0), 0, wCue[v], wPec[v]].map((x, _, a) => x / (a[0] + a[2] + a[3] || 1)),
    mand: (v) => [wJaw[v]],
    // maquillaje: x = delineado (kohl) en el borde de los párpados con la cola hacia la sien, y = sombra del párpado
    ext: (v) => mascaraExtra(v),
    maq: (v) => cfg.maquillaje ? mascaraMaquillaje(v, cfg.maquillaje) : [0, 0],
    pelo: (v) => [
      Math.max(pelo0 ? mascaraCuero(v, pelo0.linea) * (pelo0.densidad ?? 1) : 0, barba ? mascaraBarba(v, barba) * pintadaBarba(barba) : 0, cfg.corona ? mascaraCorona(v, cfg.corona) * 0.7 : 0),
      // el atlas trae pelo al ras pintado en el cuero: se limpia SIEMPRE (el pelo lo ponen las tarjetas,
      // el proxy o la máscara de rapado); si no, asoma en sienes y patillas que el peinado no tapa
      mascaraCuero(v, cfg.limpiaCuero ?? { alto: -0.8 }) * (1 - (cfg.corona ? mascaraCorona(v, cfg.corona) : 0)),
    ],
  })
  const dBoca = [], dParp = []
  for (const v of piel.orig) for (let e = 0; e < 3; e++) { dBoca.push(posBoca[v * 3 + e] - pos[v * 3 + e]); dParp.push(posParp[v * 3 + e] - pos[v * 3 + e]) }
  bin.add("piel.pos", piel.P, "i16"); bin.add("piel.nrm", piel.N, "s8"); bin.add("piel.uv", piel.T, "uv"); bin.add("piel.idx", piel.I, "u16")
  bin.add("piel.boca", dBoca, "i16"); bin.add("piel.parp", dParp, "i16")
  // FASE 4: normales de los morphs (sin esto el párpado cerrado conserva las normales de la cuenca —
  // hacia adentro— y se ve como un hueco oscuro; lo mismo los labios con la boca abierta)
  {
    const nB = normales(posBoca, cuerpoTris, NV), nP = normales(posParp, cuerpoTris, NV)
    const dnB = [], dnP = []
    for (let i = 0; i < piel.orig.length; i++) { const v = piel.orig[i]; for (let e = 0; e < 3; e++) { dnB.push(nB[v * 3 + e] - piel.N[i * 3 + e]); dnP.push(nP[v * 3 + e] - piel.N[i * 3 + e]) } }
    bin.add("piel.bocaN", dnB, "i16"); bin.add("piel.parpN", dnP, "i16")
  }
  bin.add("piel.w", piel.ex.w, "u8", { k: 4 }); bin.add("piel.pelo", piel.ex.pelo, "u8", { k: 2 })
  bin.add("piel.ext", piel.ex.ext, "u8", { k: 4 })
  if (cfg.maquillaje) bin.add("piel.maq", piel.ex.maq, "u8", { k: 2 })
  mallas.push({ nombre: "piel", tris: piel.I.length / 3, verts: piel.orig.length })

  // ── proxies ──
  // centro de la cabeza (detrás de los ojos): las tarjetas de cejas y pestañas miran hacia afuera
  const cCab = (() => { const l = centro(OJO_L, pos), r = centro(OJO_R, pos); return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2 - 1.0] })()
  const conMorph = (px, nombre, triSel, tuvSel, afuera = false) => {
    const a = proxyEn(px, pos), b = proxyEn(px, posBoca), p = proxyEn(px, posParp)
    if (afuera) for (let v = 0; v < a.p.length / 3; v++) {
      const d = [0, 1, 2].map(e => a.p[v * 3 + e] - cCab[e])
      if (d[0] * a.n[v * 3] + d[1] * a.n[v * 3 + 1] + d[2] * a.n[v * 3 + 2] < 0) for (let e = 0; e < 3; e++) a.n[v * 3 + e] *= -1
    }
    const tris = triSel || trisDeQuads(a.quads), tuv = tuvSel || trisDeQuads(a.quv)
    const r = armarMalla(tris, tuv, a.p, a.n, a.uv)
    const db = [], dp = []
    for (const v of r.orig) for (let e = 0; e < 3; e++) { db.push(b.p[v * 3 + e] - a.p[v * 3 + e]); dp.push(p.p[v * 3 + e] - a.p[v * 3 + e]) }
    bin.add(nombre + ".pos", r.P, "i16"); bin.add(nombre + ".nrm", r.N, "s8"); bin.add(nombre + ".uv", r.T, "uv"); bin.add(nombre + ".idx", r.I, "u16")
    if (db.some(x => Math.abs(x) > 1e-4)) bin.add(nombre + ".boca", db, "i16")
    if (dp.some(x => Math.abs(x) > 1e-4)) bin.add(nombre + ".parp", dp, "i16")
    mallas.push({ nombre, tris: r.I.length / 3, verts: r.orig.length })
    return { r, a }
  }
  // ojos: el proxy CC0 de git (core/eyes/high-poly, idéntico vértice a vértice al del .deb)
  const ojos = conMorph(cargarProxyCore("eyes", "high-poly"), "ojos", TOPO.ojos.tris, TOPO.ojos.tuv)
  // normales de las tres poses (para lo que va ligado a la piel)
  const nrmB = normales(posBoca, cuerpoTris, NV), nrmP = normales(posParp, cuerpoTris, NV)
  // malla propia con morphs: Pn/Pb/Pp = posiciones por vértice de salida en las tres poses
  const addPropia = (nombre, Pn, Pb, Pp, Nn, T, I, extra = {}) => {
    bin.add(nombre + ".pos", Pn, "i16"); bin.add(nombre + ".nrm", Nn, "s8"); bin.add(nombre + ".uv", T, "uv"); bin.add(nombre + ".idx", I, "u16")
    const db = Pb.map((x, i) => x - Pn[i]), dp = Pp.map((x, i) => x - Pn[i])
    if (db.some(x => Math.abs(x) > 1e-4)) bin.add(nombre + ".boca", db, "i16")
    if (dp.some(x => Math.abs(x) > 1e-4)) bin.add(nombre + ".parp", dp, "i16")
    for (const [k, [arr, kk]] of Object.entries(extra)) bin.add(`${nombre}.${k}`, arr, "u8", { k: kk })
    mallas.push({ nombre, tris: I.length / 3, verts: Pn.length / 3 })
  }
  const deVerts = (vs, P) => vs.flatMap(v => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]])
  // cejas propias
  {
    const ce = cejasPropias(cfg.cejasFicha || {})
    const a = evaluarLigados(ce.lig, pos, nrm), b = evaluarLigados(ce.lig, posBoca, nrmB), p = evaluarLigados(ce.lig, posParp, nrmP)
    addPropia("cejas", a.P, b.P, p.P, a.N, ce.T, ce.I, { var: [ce.A.flatMap(x => [x, 0]), 2] })
  }
  // pestañas propias: tarjetas desde el borde del párpado (helpers CC0)
  {
    const bordes = pestanasBordes()
    // globos (centro y radio) del proxy de ojos ajustado
    const globos = [1, -1].map(lado => {
      const vs = []; for (let v = 0; v < ojos.a.p.length / 3; v++) if (Math.sign(ojos.a.p[v * 3]) === lado) vs.push(v)
      const c = [0, 1, 2].map(e => vs.reduce((s2, v) => s2 + ojos.a.p[v * 3 + e], 0) / vs.length)
      const R = vs.reduce((s2, v) => s2 + Math.hypot(ojos.a.p[v * 3] - c[0], ojos.a.p[v * 3 + 1] - c[1], ojos.a.p[v * 3 + 2] - c[2]), 0) / vs.length
      return { c, R }
    })
    const a = pestanasEn(bordes, pos, nrm, pos, globos), b = pestanasEn(bordes, posBoca, nrmB, pos, globos), p = pestanasEn(bordes, posParp, nrmP, pos, globos)
    addPropia("pestanas", a.P, b.P, p.P, a.N, a.T, a.I)
  }
  // dientes y lengua propios (helpers)
  {
    const { dientes, lengua } = dientesPropios()
    const sub = (vs) => { const m = new Map(); vs.forEach((v, i) => m.set(v, i)); return m }
    const nrmDe = (vs, I, P) => { const loc = new Float32Array(vs.length * 3); const pp = deVerts(vs, P); for (let i = 0; i < I.length; i += 3) { const [a, b, c] = [I[i], I[i + 1], I[i + 2]]; const e1 = [0, 1, 2].map(e => pp[b * 3 + e] - pp[a * 3 + e]), e2 = [0, 1, 2].map(e => pp[c * 3 + e] - pp[a * 3 + e]); const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c]) for (let e = 0; e < 3; e++) loc[v * 3 + e] += n[e] } for (let i = 0; i < loc.length; i += 3) { const l = Math.hypot(loc[i], loc[i + 1], loc[i + 2]) || 1; loc[i] /= l; loc[i + 1] /= l; loc[i + 2] /= l } return Array.from(loc) }
    const uv0 = (n) => new Array(n * 2).fill(0)
    addPropia("dientes", deVerts(dientes.verts, pos), deVerts(dientes.verts, posBoca), deVerts(dientes.verts, posParp), nrmDe(dientes.verts, dientes.I, pos), uv0(dientes.verts.length), dientes.I, { var: [dientes.A, 2] })
    // la lengua del helper llega a la altura del borde de los incisivos de abajo: con la boca abierta tapaba
    // todo como una placa. Se baja 5 mm y se corre 5 mm hacia atrás (en las tres poses)
    // (aplastada: el alto del helper, medido desde su base, al 45 %, y 6 mm hacia atrás)
    const yBase = Math.min(...lengua.verts.map(v => pos[v * 3 + 1]))
    const bajar = (arr) => arr.map((x, i) => i % 3 === 1 ? yBase + (x - yBase) * 0.45 - 0.02 : i % 3 === 2 ? x - 0.06 : x)
    addPropia("lengua", bajar(deVerts(lengua.verts, pos)), bajar(deVerts(lengua.verts, posBoca)), bajar(deVerts(lengua.verts, posParp)), nrmDe(lengua.verts, lengua.I, pos), uv0(lengua.verts.length), lengua.I)
  }
  if (cfg.pelo?.proxy) {
    const px = cargarProxy("hair", cfg.pelo.proxy)
    const a = proxyEn(px, pos)
    let quads = a.quads, quv = a.quv
    // recorte: quita caras del pelo (p. ej. coronilla calva) según un plano/elipse en coords relativas a la cabeza
    const rc = cfg.pelo.recorte
    if (rc) {
      const top = Math.max(...TOPO.piel.vertices.map(v => pos[v * 3 + 1]))
      const keep = quads.map(q => {
        const cy = q.reduce((s2, v) => s2 + a.p[v * 3 + 1], 0) / q.length, cz = q.reduce((s2, v) => s2 + a.p[v * 3 + 2], 0) / q.length
        // calvo: fuera todo lo que está por encima de una línea que baja de adelante (yF) a atrás (yA)
        const yCorte = top - rc.bajoFrente + (rc.bajoFrente - rc.bajoAtras) * suave(0.6, -0.4, cz)
        return cy < yCorte
      })
      quads = quads.filter((_, i) => keep[i]); quv = quv.filter((_, i) => keep[i])
    }
    // escala de volumen del pelo (sobre la normal del cuero): infla/aplana
    if (cfg.pelo.inflar) {
      const cab = centro(TOPO.piel.vertices.filter(v => pos[v * 3 + 1] > 7.6), pos)
      for (let v = 0; v < a.p.length / 3; v++) for (let e = 0; e < 3; e++) a.p[v * 3 + e] = cab[e] + (a.p[v * 3 + e] - cab[e]) * (1 + cfg.pelo.inflar)
    }
    const r = armarMalla(trisDeQuads(quads), trisDeQuads(quv), a.p, a.n, a.uv)
    bin.add("pelo.pos", r.P, "i16"); bin.add("pelo.nrm", r.N, "s8"); bin.add("pelo.uv", r.T, "uv"); bin.add("pelo.idx", r.I, "u16")
    mallas.push({ nombre: "pelo", tris: r.I.length / 3, verts: r.orig.length, textura: path.relative(VENDOR, px.mat.textura) })
  }
  // ── barba y corona de pelo en TARJETAS (código propio): cintas finas con textura de hebras,
  // nacen en la piel donde la máscara lo dice, crecen hacia abajo pegadas a la cara y se curvan ──
  const tarjetas = []
  if (barba && (barba.densidad ?? 0) >= 0.35 && (cfg.tarjetasBarba ?? true)) {
    tarjetas.push(...tarjetasSobrePiel(pos, nrm, (v) => mascaraBarba(v, barba), {
      largo: Math.max(0.06, barba.largo * 10), colgante: (barba.colgante ?? 0) * 10, anchoColgante: (barba.anchoColgante ?? 0.08) * 10,
      rizo: barba.rizo ?? 0, cobertura: 7 * (barba.densidad ?? 1), ancho: 0.15, semilla: 7, tipo: "barba",
    }))
  }
  if (cfg.corona) {
    tarjetas.push(...tarjetasSobrePiel(pos, nrm, (v) => mascaraCorona(v, cfg.corona), {
      largo: cfg.corona.largo ?? 0.35, colgante: 0, rizo: cfg.corona.rizo ?? 0.5, cobertura: 8, ancho: 0.16, semilla: 11, tipo: "corona",
    }))
  }
  if (tarjetas.length) {
    const P = [], N = [], T = [], I = [], V = []
    for (const t of tarjetas) {
      const b0 = P.length / 3
      P.push(...t.P); N.push(...t.N); T.push(...t.T); V.push(...t.V)
      for (const x of t.I) I.push(b0 + x)
    }
    bin.add("barba.pos", P, "i16"); bin.add("barba.nrm", N, "s8"); bin.add("barba.uv", T, "uv"); bin.add("barba.idx", I, "u16")
    bin.add("barba.var", V, "u8", { k: 2 })
    mallas.push({ nombre: "barba", tris: I.length / 3, verts: P.length / 3, tarjetas: tarjetas.length })
  }

  // ── puntos de referencia (dm, frame de MakeHuman) ──
  const ojoL = centro(OJO_L, pos), ojoR = centro(OJO_R, pos)
  let ymax = -1e9, ymin = 1e9
  for (const v of TOPO.piel.vertices) { ymax = Math.max(ymax, pos[v * 3 + 1]) }
  const menton = [pos[991 * 3], pos[991 * 3 + 1], pos[991 * 3 + 2]]
  // base de la nariz (subnasal, vértice 312 de la línea media) y ancho de las alas: el bigote de hoy
  // reajustado no puede subir por encima (se "derretía" sobre la nariz)
  const subnasal = [pos[312 * 3], pos[312 * 3 + 1], pos[312 * 3 + 2]]
  let alaX = 0.15
  for (const v of TOPO.piel.vertices) { const y = pos[v * 3 + 1], z = pos[v * 3 + 2]; if (y > subnasal[1] && y < subnasal[1] + 0.16 && z > subnasal[2] - 0.12) alaX = Math.max(alaX, Math.abs(pos[v * 3])) }
  // anillo de la base del cuello: vértices de borde más bajos
  const ar = new Map(); for (const t of TOPO.piel.tris) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; const kk = a < b ? a + "_" + b : b + "_" + a; ar.set(kk, (ar.get(kk) || 0) + 1) }
  const borde = new Set(); for (const [kk, n] of ar) if (n === 1) for (const x of kk.split("_")) borde.add(+x)
  for (const v of borde) ymin = Math.min(ymin, pos[v * 3 + 1])
  const anillo = [...borde].filter(v => pos[v * 3 + 1] < ymin + 0.6)
  const idxAnillo = anillo.map(v => piel.orig.indexOf(v)).filter(i => i >= 0)
  bin.add("piel.anillo", idxAnillo, "u16")
  const buf = bin.buffer()
  const ms = performance.now() - t0
  const cab = {
    id: cfg.id, cfg, ms: Math.round(ms), partes: bin.cab, mallas,
    puntos: { ojoL, ojoR, coronilla: ymax, menton, pivMand: piv, angBoca: ANG, ojosCentro: [ojoL, ojoR], subnasal, alaX },
    texturas: { piel: cfg.piel, iris: cfg.iris, cejas: "ceja", pestanas: "pestanas", pelo: cfg.pelo?.proxy || null, ojo: "ojo", propias: true },
  }
  const dir = path.join(OUT, cfg.id); fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "cab.bin"), buf)
  fs.writeFileSync(path.join(dir, "cab.json"), JSON.stringify(cab))
  const gz = zlib.gzipSync(buf, { level: 9 }).length
  return { id: cfg.id, ms: Math.round(ms), bytes: buf.length, gzip: gz, mallas }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lista = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  const ids = process.argv.slice(3)
  for (const cfg of lista) {
    if (ids.length && !ids.includes(cfg.id)) continue
    const r = hornear(cfg)
    console.log(r.id, r.ms + "ms", "bin", r.bytes, "gz", r.gzip, r.mallas.map(m => `${m.nombre}:${m.tris}`).join(" "), "total", r.mallas.reduce((a, m) => a + m.tris, 0))
  }
}
