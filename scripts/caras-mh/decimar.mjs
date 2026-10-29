// decimar.mjs — simplificación propia por colapso de medio-arista con error cuadrático (QEM).
//
// Colapso de medio-arista: el vértice u se funde en un vecino v que YA EXISTE. Así los
// vértices que quedan son un subconjunto de los originales: los targets de MakeHuman, los
// pesos del rig y los deltas de la boca siguen valiendo tal cual sobre la malla reducida.
// Por eso se decima UNA vez sobre la malla neutra y la topología se reutiliza para todos.
//
// Entrada: pos (soldadas, Float32 xyz), tris [[a,b,c]], tuv [[ta,tb,tc]] (uv por esquina),
//          peso por vértice (importancia: cara > orejas > nuca), bloqueados (Set).
// Salida:  { tris, tuv } con los triángulos que sobreviven.

function plano(p, a, b, c) {
  const ax = p[b * 3] - p[a * 3], ay = p[b * 3 + 1] - p[a * 3 + 1], az = p[b * 3 + 2] - p[a * 3 + 2]
  const bx = p[c * 3] - p[a * 3], by = p[c * 3 + 1] - p[a * 3 + 1], bz = p[c * 3 + 2] - p[a * 3 + 2]
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
  const l = Math.hypot(nx, ny, nz)
  if (l < 1e-12) return null
  nx /= l; ny /= l; nz /= l
  const d = -(nx * p[a * 3] + ny * p[a * 3 + 1] + nz * p[a * 3 + 2])
  return [nx, ny, nz, d, l / 2]
}

// cuádrica simétrica 4x4 en 10 números
function sumarPlano(Q, i, n, w) {
  const [a, b, c, d] = n, o = i * 10
  Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d
  Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d
  Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d
}
function errQ(Q, i, j, x, y, z) {
  let e = 0
  for (const k of [i, j]) {
    const o = k * 10
    e += Q[o] * x * x + 2 * Q[o + 1] * x * y + 2 * Q[o + 2] * x * z + 2 * Q[o + 3] * x
      + Q[o + 4] * y * y + 2 * Q[o + 5] * y * z + 2 * Q[o + 6] * y
      + Q[o + 7] * z * z + 2 * Q[o + 8] * z + Q[o + 9]
  }
  return e
}

class Heap {
  constructor() { this.a = [] }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break;[a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop() {
    const a = this.a, top = a[0], last = a.pop()
    if (a.length) {
      a[0] = last; let i = 0
      for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]]; i = m }
    }
    return top
  }
  get size() { return this.a.length }
}

export function decimar({ pos, tris, tuv, peso, bloqueados = new Set(), objetivo, maxGiro = 0.5 }) {
  const nv = pos.length / 3
  const T = tris.map(t => t.slice()), TU = tuv.map(t => t.slice())
  const vivo = new Uint8Array(T.length).fill(1)
  const inc = Array.from({ length: nv }, () => new Set())
  T.forEach((t, f) => t.forEach(v => inc[v].add(f)))
  // vértices de costura (más de un uv) y de borde (aristas con un solo triángulo): bloqueados
  const uvsDe = Array.from({ length: nv }, () => new Set())
  T.forEach((t, f) => t.forEach((v, k) => uvsDe[v].add(TU[f][k])))
  const aristas = new Map()
  const clave = (a, b) => a < b ? a * nv + b : b * nv + a
  T.forEach(t => { for (let k = 0; k < 3; k++) { const c = clave(t[k], t[(k + 1) % 3]); aristas.set(c, (aristas.get(c) || 0) + 1) } })
  const fijo = new Uint8Array(nv)
  for (const v of bloqueados) fijo[v] = 1
  for (let v = 0; v < nv; v++) if (uvsDe[v].size > 1) fijo[v] = 1
  for (const [c, n] of aristas) if (n !== 2) { fijo[Math.floor(c / nv)] = 1; fijo[c % nv] = 1 }
  // cuádricas
  const Q = new Float64Array(nv * 10)
  T.forEach(t => {
    const n = plano(pos, t[0], t[1], t[2]); if (!n) return
    for (const v of t) sumarPlano(Q, v, n, n[4] * (peso ? peso[v] : 1))
  })
  const version = new Int32Array(nv)
  const heap = new Heap()
  const vecinos = (u) => { const s = new Set(); for (const f of inc[u]) for (const v of T[f]) if (v !== u) s.add(v); return s }
  const candidatos = (u) => {
    if (fijo[u]) return
    for (const v of vecinos(u)) heap.push([errQ(Q, u, v, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]), u, v, version[u], version[v]])
  }
  for (let u = 0; u < nv; u++) if (inc[u].size) candidatos(u)
  let vivos = T.length
  const nrm = (f, sust, por) => {
    const t = T[f].map(v => v === sust ? por : v)
    return plano(pos, t[0], t[1], t[2])
  }
  while (vivos > objetivo && heap.size) {
    const [, u, v, vu, vv] = heap.pop()
    if (fijo[u] || version[u] !== vu || version[v] !== vv || !inc[u].size) continue
    // condición de enlace: vecinos comunes = 2 (arista interior)
    const nu = vecinos(u), nvv = vecinos(v)
    if (!nu.has(v)) continue
    let comunes = 0; for (const x of nu) if (nvv.has(x)) comunes++
    if (comunes !== 2) continue
    // triángulos que mueren (contienen u y v) y uv de v en ese mapa
    const mueren = [...inc[u]].filter(f => T[f].includes(v))
    if (mueren.length !== 2) continue
    const tv = TU[mueren[0]][T[mueren[0]].indexOf(v)]
    // sin vuelcos: la normal de los triángulos que quedan no gira más de maxGiro
    let ok = true
    for (const f of inc[u]) {
      if (mueren.includes(f)) continue
      const a = plano(pos, T[f][0], T[f][1], T[f][2]), b = nrm(f, u, v)
      if (!b || !a || a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < Math.cos(maxGiro)) { ok = false; break }
    }
    if (!ok) continue
    for (const f of mueren) { vivo[f] = 0; vivos--; for (const x of T[f]) if (x !== u) inc[x].delete(f) }
    for (const f of inc[u]) {
      if (!vivo[f]) continue
      const k = T[f].indexOf(u)
      T[f][k] = v; TU[f][k] = tv
      inc[v].add(f)
    }
    inc[u].clear()
    for (let o = 0; o < 10; o++) Q[v * 10 + o] += Q[u * 10 + o]
    version[v]++
    for (const x of vecinos(v)) { version[x]++; candidatos(x) }
    candidatos(v)
  }
  const out = { tris: [], tuv: [] }
  T.forEach((t, f) => { if (vivo[f]) { out.tris.push(t); out.tuv.push(TU[f]) } })
  return out
}
