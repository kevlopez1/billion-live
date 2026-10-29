// ──────────────────────────────────────────────────────────────
// Pelo, barba, cejas y pestañas.
//
// Todo sale de la ficha (avatar-fichas.ts: pelo, barba, cejas):
//
// - Pelo: dos o tres capas sobre el cuero cabelludo (la misma grilla de la
//   cabeza), cada una más afuera y más rala: la de adentro es opaca y oscura,
//   la de afuera son hebras sueltas. El grosor sale de la ficha por zona
//   (arriba, frente, lados, nuca), con copete que avanza sobre la frente,
//   raya, rizos y canas. Las hebras se abren desde un remolino (coronilla,
//   frente o raya). Así el pelo tiene volumen y borde de hebras, no un casco.
// - Pelo largo: mechones (tiras con hebras) que caen por la espalda y, si la
//   ficha lo pide, por delante de los hombros, sin atravesar el cuerpo.
// - Barba: capas sobre la cara por zonas (bigote, perilla, mandíbula,
//   mejillas, cuello) con borde limpio o degradado; la barba larga cuelga
//   del mentón (partida o no), y el bigote largo cae por las comisuras.
// - Cejas: tres tiras con volumen y hebras a lo largo (no pintadas): base,
//   capa de arriba más gruesa y, en los mayores, pelos largos que se levantan.
//
// Todo va en un lote: el color de cada parte va en el vértice, y la fuerza del
// brillo anisotrópico en aMat.x (pelo 1, barba 0,6, cejas 0,22, pestañas 0);
// aMat.y = 1 en las capas de abajo (opacas: la textura no les abre huecos).
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Personaje } from "../tipos"
import { barbaEn, peloEn, rizos } from "./avatar-cabeza"
import { ANG, H, M, type Cuerpo, type FilaCabeza } from "./avatar-cuerpo"
import { campana, clamp, hashTexto, lerp, Lote, mezclarRGBA, rgba, suave, type Pesos, type RGBA } from "./avatar-geo"
import { tono, type BarbaR, type PeloR } from "./avatar-fichas"

const _v = new THREE.Vector3()
const _l = new THREE.Vector3()
const _n = new THREE.Vector3()

/** Repeticiones de la textura de hebras alrededor del remolino (entero: sin costura). */
const VUELTA = 9

const GRIS_CANA: RGBA = [0.62, 0.61, 0.6, 1]

/** Color de una hebra con canas: mezcla por mechón (no manchas). */
function conCanas(c: RGBA, canas: number, ruido: number): RGBA {
  if (canas <= 0.001) return c
  const k = clamp(canas * (0.65 + 0.7 * ruido), 0, 1)
  return mezclarRGBA(c, GRIS_CANA, k)
}

/** Punto de origen de las hebras (local) según la ficha. */
function remolino(ph: PeloR): THREE.Vector3 {
  switch (ph.remolino) {
    case "frente":
      return new THREE.Vector3(0, 0.072, 0.082)
    case "raya":
      return new THREE.Vector3((ph.raya ?? 0) * 0.026, 0.108, 0.05)
    default:
      return new THREE.Vector3(0.012, 0.108, -0.05)
  }
}

export function armarPelo(cu: Cuerpo, p: Personaje, op: { holguraEspalda: number; bajoSombrero: boolean; sombreroY?: number }): Lote {
  const lote = new Lote()
  const cab = cu.cab
  const fi = cu.rasgos.f
  const ph = fi.pelo
  const filas = cu.filasCabeza()
  const sem = hashTexto(p.id) % 997
  if (ph.rapado <= 0) pelo(lote, cu, ph, filas, sem, op)
  if (ph.largo > 0 && ph.rapado <= 0) mechones(lote, cu, ph, sem, op)
  if (ph.mono && ph.rapado <= 0) mono(lote, cu, ph)
  const b = fi.barba
  if (b && b.densidad >= 0.35) barba(lote, cu, b, filas, sem)
  cejas(lote, cu)
  pestanas(lote, cu)
  return lote
}

// ── Pelo de la cabeza ─────────────────────────────────────────

function pelo(lote: Lote, cu: Cuerpo, ph: PeloR, filas: FilaCabeza[], sem: number, op: { bajoSombrero: boolean; sombreroY?: number }) {
  const cab = cu.cab
  const nF = filas.length
  const masc: Float64Array[] = []
  const gros: Float64Array[] = []
  let gMax = 0
  const frec = 190 * ph.frecRizo
  // Con la textura de bucles (ficha rizo ≥ 0,6) el fondo es casi transparente: la capa de adentro tapa sola.
  const rizado = ph.rizo >= 0.6
  for (let i = 0; i < nF; i++) {
    const f = filas[i]
    const fm = new Float64Array(M)
    const fg = new Float64Array(M)
    for (let j = 0; j < M; j++) {
      const l = f.l[j]
      let [m, g] = peloEn(cab, l.x, l.y, l.z, ph)
      if (m > 0) {
        // Bajo el sombrero, el pelo se aplasta.
        if (op.bajoSombrero && op.sombreroY !== undefined && l.y > op.sombreroY) g *= 0.5 * suave(op.sombreroY + 0.03, op.sombreroY, l.y) + 0.12
        if (ph.rizo > 0) g += ph.rizo * (rizado ? 0.004 : 0.0085) * (0.55 + 0.45 * rizos(l.x, l.y, l.z, frec, sem)) * suave(0, 0.5, m)
        // Borde: canto grueso (copete, rizos) o se afina hasta la piel.
        g *= suave(0, 0.08 + 0.7 * ph.borde, m)
      }
      fm[j] = m
      fg[j] = g
      if (m > 0.5 && g > gMax) gMax = g
    }
    masc.push(fm)
    gros.push(fg)
  }
  // Capas: la de adentro opaca, las de afuera hebras sueltas (tres si hay volumen).
  const capas = gMax > 0.011 ? [0.36, 0.7, 1] : [0.45, 1]
  const nc = capas.length
  const W = remolino(ph)
  // Marco en el remolino: la costura de la u queda hacia la nuca.
  const nW = W.clone().normalize()
  const eA = new THREE.Vector3(0, 0, 1).addScaledVector(nW, -nW.z).normalize()
  if (eA.lengthSq() < 0.1) eA.set(0, 1, 0)
  const eB = new THREE.Vector3().crossVectors(nW, eA)
  const cPelo = rgba(ph.color)
  const cPuntas = rgba(ph.puntas)
  const cBajo = rgba(ph.bajo)
  // Copete: cuánto avanza sobre la frente y cuánto sube.
  const avance = ph.copeteAvance
  const centros = filas.map((f) => (f.radial ? cab.c : new THREE.Vector3(0, f.P[0].y, cab.c.z - 0.03)))
  // El pelo es una masa suave: basta una columna de cada dos (al frente, donde la
  // grilla es más densa, también) y una fila de cada dos debajo de la coronilla.
  const cols2 = Array.from({ length: M }, (_, j) => j).filter((j) => j % 2 === 0)
  // La capa de adentro (oscura, lisa, tapada por las otras): una columna de cada tres.
  const cols3 = Array.from({ length: M }, (_, j) => j).filter((j) => j % 3 === 0)
  // (arriba, alrededor de la coronilla, todas las filas: ahí se abren las hebras)
  const filasP = Array.from({ length: nF }, (_, i) => i).filter((i) => i === nF - 1 || i % 2 === 0 || (filas[i].radial && filas[i].l[M >> 1].y > 0.095))
  for (let c = 0; c < nc; c++) {
    const fr = capas[c]
    const interior = c === 0
    const exterior = c === nc - 1
    const medio = !interior && !exterior
    const cols = interior ? cols3 : cols2
    const MS = cols.length
    const ids: number[][] = []
    const mk: number[][] = []
    const gk: number[][] = []
    const i0 = lote.nIdx
    for (const i of filasP) {
      const f = filas[i]
      const fila: number[] = []
      const fm: number[] = []
      const fg: number[] = []
      for (const j of cols) {
        const l = f.l[j]
        const m = masc[i][j]
        const g = gros[i][j]
        fg.push(g)
        const n = f.n[j]
        const d = g * fr + 0.0011 + 0.0007 * c
        let x = l.x + n.x * d
        let y = l.y + n.y * d
        let z = l.z + n.z * d
        // Copete: la parte de adelante avanza y sube (visera suave sobre la frente).
        if (avance > 0) {
          // Todas las capas avanzan juntas (la visera es maciza; la de afuera, apenas más).
          const k = suave(0.015, 0.075, l.z) * suave(0.025, 0.085, l.y) * suave(0.07, 0.03, Math.abs(l.x)) * (0.85 + 0.15 * fr)
          z += avance * k
          y += avance * 0.25 * k - avance * 0.35 * k * suave(0.07, 0.095, l.z)
        }
        // Flequillo: cae sobre la frente.
        if (ph.flequillo > 0) {
          const k = ph.flequillo * suave(0.04, 0.08, l.z) * suave(0.03, 0.06, l.y) * fr
          z += 0.004 * k
        }
        cab.aAvatar(x, y, z, _v)
        // UV: ángulo alrededor del remolino (hebras que se abren desde ahí) y distancia.
        _l.set(l.x - W.x, l.y - W.y, l.z - W.z)
        const dist = _l.length()
        const th = Math.atan2(_l.dot(eB), _l.dot(eA))
        const u = (th / (Math.PI * 2)) * VUELTA + 0.37 * c
        const v = dist * 9 + 0.21 * c
        // En el remolino las hebras salen para todos lados (y la UV se comprime): sin brillo.
        const remol = suave(0.012, 0.045, dist)
        // Color: raíz y capa de abajo más oscuras, puntas más claras; canas por mechón.
        const ruido = 0.5 + 0.5 * Math.sin(ANG[j] * 13 + sem + l.y * 90)
        let col = interior ? cBajo : exterior ? mezclarRGBA(cPelo, cPuntas, 0.55) : cPelo
        const nuca = 0.82 + 0.18 * suave(-0.12, 0.04, l.y)
        col = conCanas(col, ph.canas + ph.canasSienes * suave(0.04, 0.065, Math.abs(l.x)) * suave(0.06, 0.0, l.y) * suave(-0.03, 0.02, l.z), ruido)
        const kk = nuca * (0.9 + 0.1 * ruido) * (interior ? 0.85 : 1)
        // Alfa: la capa de adentro tapa (alfa > 1: sin huecos); las de afuera, hebras.
        // (las de afuera, casi opacas: con alfa 1,3 la silueta se deshilachaba en
        // tiras sueltas; la hebra se lee en el color de la textura, no en huecos.
        // En el borde —la línea del pelo— siguen sueltas.)
        // Borde: el alfa sube despacio (de m = 0,02 a 0,8) y las hebras de la
        // textura, cada una con su alfa, terminan a distinta altura: la línea del
        // pelo queda deshilachada, no recortada en la escalera de la grilla. La capa
        // oscura de adentro empieza más adentro (si no, dibujaba ella el borde duro).
        let a = interior ? suave(0.2, 0.7, m) * (rizado ? 8 : 2.4) : suave(0.02, 0.8, m) * (exterior ? 2.05 : 2.3) * lerp(0.7, 1, suave(0.5, 0.95, m))
        // Pelo liso peinado (laca, gel): las capas de afuera tapan como una masa;
        // solo el borde con la piel sigue en hebras.
        if (!interior && ph.liso > 0) a *= 1 + 1.6 * ph.liso * suave(0.35, 0.8, m)
        fila.push(lote.v(_v.x, _v.y, _v.z, u, v, [col[0] * kk, col[1] * kk, col[2] * kk, a], cu.pesosCabeza(l), [(interior ? 0.55 : 1) * remol, interior ? 1 : 0]))
        fm.push(m)
      }
      ids.push(fila)
      mk.push(fm)
      gk.push(fg)
    }
    lote.tiras(ids, true, {
      centros: filasP.map((i) => centros[i]),
      emitir: (i, j) => {
        const j2 = (j + 1) % MS
        // (la capa de adentro es transparente con m < 0,2: ahí no se emite)
        if (Math.max(mk[i][j], mk[i][j2], mk[i + 1][j], mk[i + 1][j2]) <= (interior ? 0.2 : 0.03)) return false
        // La capa del medio solo donde el pelo tiene grosor (> 11 mm): en lo fino
        // quedaba a 2–3 mm de las otras dos y no se veía (los mechones de la
        // textura ya dan la profundidad). Ahorra ~1.000 triángulos en los de pelo corto.
        if (medio) return Math.max(gk[i][j], gk[i][j2], gk[i + 1][j], gk[i + 1][j2]) > 0.011
        return true
      },
    })
    lote.costuraU(i0, VUELTA)
    lote.pieza()
  }
}

/**
 * Pelo largo: mechones que salen del borde del pelo (costados y nuca) y caen
 * por la espalda y, si la ficha lo pide, por delante de los hombros. Siguen
 * la superficie del cuerpo con una holgura, así no lo atraviesan.
 */
function mechones(lote: Lote, cu: Cuerpo, ph: PeloR, sem: number, op: { holguraEspalda: number }) {
  const cab = cu.cab
  const s = cu.s
  const xs = new Float64Array(M)
  const zs = new Float64Array(M)
  const cPelo = rgba(ph.color)
  const cPuntas = rgba(ph.puntas)
  const cBajo = rgba(ph.bajo)
  const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233 + sem) * 43758.5453) % 1 + 1) % 1
  // Ángulo a (como las columnas del tronco): π/2 = frente, 0 = izquierda, -π/2 = espalda.
  const angulos: Array<{ a: number; capa: number }> = []
  const nAtras = 13
  for (let i = 0; i < nAtras; i++) {
    const t = i / (nAtras - 1)
    // De costado a costado por la espalda (sin los dos extremos: el mechón que
    // nacía justo al costado caía por fuera del hombro y se veía como alambres).
    angulos.push({ a: lerp(0.4, Math.PI - 0.4, t) - Math.PI, capa: 0 })
    if (i % 2 === 1) angulos.push({ a: lerp(0.4, Math.PI - 0.4, t) - Math.PI + 0.08, capa: 1 })
  }
  // Mechones de adelante, sobre los hombros.
  if (ph.adelante > 0) {
    const n = Math.round(2 + ph.adelante * 3)
    for (let i = 0; i < n; i++) {
      for (const lado of [1, -1]) {
        const a = lado > 0 ? 0.42 + i * 0.12 : Math.PI - 0.42 - i * 0.12
        angulos.push({ a, capa: i % 2 })
      }
    }
  }
  // El flequillo recto (melena) termina parejo; el pelo suelto, desparejo.
  const parejo = ph.flequillo > 0.5
  const yTopL = 0.012
  const filasM = 9
  for (let r = 0; r < angulos.length; r++) {
    const { a, capa } = angulos[r]
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    // Punto de partida: dentro de la capa de pelo (el arranque queda tapado),
    // arriba de la oreja; atrás, más abajo.
    const yl = lerp(yTopL + (sa > 0 ? 0.03 : 0.012), -0.03, Math.max(0, -sa))
    const dirx = ca
    const dirz = sa
    const t0 = cab.rayo(0, yl, -0.004, dirx, 0, dirz, 0.16)
    const [, g0] = peloEn(cab, dirx * t0, yl, dirz * t0 - 0.004, ph)
    const rIni = t0 + g0 * 0.55 + 0.0015 + capa * 0.003
    const largo = (ph.largo + (parejo ? 0 : (rnd(r, 1) - 0.5) * 0.04)) * s + 0.12 * cab.hs
    const ancho = (0.045 + 0.015 * rnd(r, 2)) * (capa ? 0.85 : 1) * Math.max(0.8, s)
    const fase = rnd(r, 3) * 6.28
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const ini = cab.aAvatar(dirx * rIni, yl, dirz * rIni - 0.004, new THREE.Vector3())
    for (let i = 0; i <= filasM; i++) {
      const t = i / filasM
      const y = ini.y - t * largo
      // Radio desde el eje: el del cuero arriba; abajo, el del cuerpo + holgura.
      let px = ini.x
      let pz = ini.z
      // Se abre un poco al caer.
      px += ca * 0.012 * t
      pz += sa * 0.01 * t
      if (y < 0.86 * cu.H) {
        cu.anilloTronco(Math.max(y, 0.5 * cu.H), 0.6, xs, zs)
        // Columna del tronco en esa dirección.
        let jb = 0
        let mejor = 9
        for (let j = 0; j < M; j++) {
          const d = Math.abs(Math.atan2(Math.sin(ANG[j] - a), Math.cos(ANG[j] - a)))
          if (d < mejor) {
            mejor = d
            jb = j
          }
        }
        const holg = 0.02 + op.holguraEspalda + capa * 0.006
        const tx = xs[jb] + ca * holg
        const tz = zs[jb] + sa * holg
        if (sa > 0.05) {
          // Mechón de adelante: el hombro no lo empuja hacia afuera (quedaba
          // horizontal sobre el hombro, como alambres); se apoya hacia ADELANTE
          // sobre el pecho, sin pasar el ancho del cuello + 8 cm.
          const xMax = 0.1 * s
          if (Math.abs(px) > xMax) px = Math.sign(px) * lerp(Math.abs(px), xMax, suave(0.88 * cu.H, 0.8 * cu.H, y))
          if (pz < tz) pz = tz
        } else {
          // Mechón de atrás: cae por la espalda, no por encima del hombro. (Empujado
          // en dirección radial hasta el anillo del tronco, a la altura de los hombros
          // salía disparado de costado hasta la punta del hombro: alambres finos en
          // Jesús y Cleopatra.) Se limita el ancho y se empuja solo hacia atrás.
          const xMax = 0.11 * s
          if (Math.abs(px) > xMax) px = Math.sign(px) * lerp(Math.abs(px), xMax, suave(0.88 * cu.H, 0.8 * cu.H, y))
          // Espalda a esa x: la columna de atrás más cercana en x.
          let zB = 0
          let dx = 9
          for (let j = 0; j < M; j++) {
            if (Math.sin(ANG[j]) > -0.2) continue
            const d = Math.abs(xs[j] - px)
            if (d < dx) {
              dx = d
              zB = zs[j]
            }
          }
          const zMax = zB - holg
          if (pz > zMax) pz = zMax
          void tx
          void tz
        }
      }
      // Ondas a lo largo.
      // (onda de ~1 cm: con 7 mm los mechones caían como tiras paralelas)
      const onda = ph.ondas * 0.013 * Math.sin(t * Math.PI * 3.2 + fase) * suave(0.0, 0.25, t)
      px += -sa * onda
      pz += ca * onda
      const fila: number[] = []
      const w = ancho * (1 - 0.25 * t) * 0.5
      const pw: Pesos = t < 0.25 ? [[H.cabeza, 1 - t * 2], [H.cuello, t * 2]] : [[H.cabeza, Math.max(0, 0.4 - t * 0.5)], [H.cuello, 0.35], [H.pecho, 0.25 + t * 0.6]]
      // Nace de a poco bajo la capa de la nuca (con 0,14 se veía el escalón donde empieza).
      const alfa = (1 - 0.75 * suave(0.7, 1, t)) * suave(0, 0.24, t) * (capa ? 1.35 : 1.8)
      const col = mezclarRGBA(capa ? cPelo : cBajo, cPuntas, t * 0.6)
      const kk = 0.85 + 0.15 * rnd(r, 4)
      for (let k = -1; k <= 1; k++) {
        // A lo ancho: tangente horizontal a la dirección; los bordes se curvan hacia el cuerpo.
        const bx = -sa * w * k - ca * Math.abs(k) * 0.004
        const bz = ca * w * k - sa * Math.abs(k) * 0.004
        fila.push(lote.v(px + bx, y, pz + bz, (k + 1) * 0.16 + r * 0.37, t * largo * 9, [col[0] * kk, col[1] * kk, col[2] * kk, alfa], pw, [1, 0]))
      }
      ids.push(fila)
      centros.push(new THREE.Vector3(px - ca, y, pz - sa))
    }
    lote.tiras(ids, false, { centros })
  }
  lote.pieza()
}

/** Moño en la coronilla (pelo recogido). */
function mono(lote: Lote, cu: Cuerpo, ph: PeloR) {
  const cab = cu.cab
  const m = ph.mono!
  const t = cab.rayo(0, 0, 0, 0, 1, -0.15, 0.2)
  const base = new THREE.Vector3(0, t * 0.99, -0.15 * t * 0.99)
  const c = rgba(ph.color)
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const n = 12
  const perfil: Array<[number, number]> = [[-0.01, 0.8], [0, 1], [0.35, 1.05], [0.7, 1], [0.95, 0.75], [1, 0.3], [1.01, 0.02]]
  for (const [h, rr] of perfil) {
    const fila: number[] = []
    for (let k = 0; k < n; k++) {
      const g = (k / n) * Math.PI * 2
      cab.aAvatar(base.x + Math.cos(g) * m.radio * rr, base.y + h * m.alto, base.z + Math.sin(g) * m.radio * rr, _v)
      fila.push(lote.v(_v.x, _v.y, _v.z, (k / n) * 2, h * 2, [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9, 2.4], [[H.cabeza, 1]], [0.9, 1]))
    }
    ids.push(fila)
    centros.push(cab.aAvatar(base.x, base.y + h * m.alto, base.z, new THREE.Vector3()))
  }
  lote.tiras(ids, true, { centros })
  lote.pieza()
}

// ── Barba ─────────────────────────────────────────────────────

function barba(lote: Lote, cu: Cuerpo, b: BarbaR, filas: FilaCabeza[], sem: number) {
  const cab = cu.cab
  // El material del pelo (y de la barba) usa la textura de bucles si el pelo es rizado.
  const rizado = cu.rasgos.f.pelo.rizo >= 0.6
  const nF = filas.length
  const cB = rgba(b.color)
  // Puntas de la barba algo más claras (la luz atraviesa las puntas).
  const cPuntas = rgba(tono(b.color, 0.06))
  const masc: number[][] = []
  const gros: number[][] = []
  for (let i = 0; i < nF; i++) {
    const f = filas[i]
    const fm: number[] = []
    const fg: number[] = []
    for (let j = 0; j < M; j++) {
      const l = f.l[j]
      let [m, g] = barbaEn(cab, l.x, l.y, l.z, b)
      if (m > 0 && b.rizo > 0) g += b.rizo * 0.0025 * rizos(l.x, l.y, l.z, 260, sem)
      fm.push(m)
      // En el borde la barba baja hasta la piel: borde limpio sin "pared".
      fg.push(Math.max(0, g) * suave(0, 0.55 + 0.35 * b.borde, m))
    }
    masc.push(fm)
    gros.push(fg)
  }
  const centros = filas.map((f) => (f.radial ? cab.c : new THREE.Vector3(0, f.P[0].y, cab.c.z - 0.03)))
  // Una fila y una columna de cada dos (unos 7 mm): la barba es una masa suave.
  const filasB = Array.from({ length: nF }, (_, i) => i).filter((i) => i % 2 === 0 || i === nF - 1)
  const colsB2 = Array.from({ length: M }, (_, j) => j).filter((j) => j % 2 === 0)
  // La capa de adentro, tapada por la de afuera: una columna de cada tres.
  const colsB3 = Array.from({ length: M }, (_, j) => j).filter((j) => j % 3 === 0)
  const capas = [0.45, 1]
  for (let c = 0; c < capas.length; c++) {
    const interior = c === 0
    const colsB = interior ? colsB3 : colsB2
    const MB = colsB.length
    const ids: number[][] = []
    const mk: number[][] = []
    for (const i of filasB) {
      const f = filas[i]
      const fila: number[] = []
      const fm: number[] = []
      for (const j of colsB) {
        fm.push(masc[i][j])
        const l = f.l[j]
        const n = f.n[j]
        const m = masc[i][j]
        const d = gros[i][j] * capas[c] + 0.0009 + 0.0006 * c
        cab.aAvatar(l.x + n.x * d, l.y + n.y * d, l.z + n.z * d, _v)
        const ruido = 0.5 + 0.5 * Math.sin(ANG[j] * 17 + sem + l.y * 120)
        let col = conCanas(interior ? cB : cPuntas, b.canas * (1 + 0.6 * suave(-0.07, -0.11, l.y)), ruido)
        const k = interior ? 0.85 : 0.95 + 0.15 * ruido
        col = [col[0] * k, col[1] * k, col[2] * k, 1]
        // Borde: la de adentro tapa, la de afuera deja ver hebras.
        // (la de afuera, casi opaca salvo en el borde: con 0,95 la barba era una
        // mancha oscura con hebras sueltas alrededor; con bucles, tapa la de adentro)
        let a = interior ? suave(0.15, 0.6, m) * (rizado ? 8 : 2) * b.densidad : suave(0.02, 0.55, m) * lerp(0.95, 1.7, suave(0.5, 0.95, m)) * b.densidad
        // Barba recortada y tupida: la capa de afuera es una masa (el borde sigue en hebras).
        if (!interior && b.liso) a *= 1 + 1.4 * b.liso * suave(0.5, 0.9, m)
        // Hebras que ondulan (la barba no es un peine): la u se corre con la altura.
        // (onda larga, de varias filas: con una más corta que la grilla salían espigas en zigzag)
        const ondaB = rizado ? 0 : (0.08 + 0.14 * b.rizo) * Math.sin(l.y * 70 + ANG[j] * 2 + sem)
        fila.push(lote.v(_v.x, _v.y, _v.z, ANG[j] * (rizado ? 1.4 : 2.2) + c * 0.31 + ondaB, l.y * (rizado ? 18 : 9), [col[0], col[1], col[2], a], cu.pesosCabeza(l), [interior ? 0.35 : 0.6, interior ? 1 : 0]))
      }
      ids.push(fila)
      mk.push(fm)
    }
    lote.tiras(ids, true, {
      centros: filasB.map((i) => centros[i]),
      emitir: (i, j) => {
        const j2 = (j + 1) % MB
        // (la de adentro es transparente con m < 0,15)
        return Math.max(mk[i][j], mk[i][j2], mk[i + 1][j], mk[i + 1][j2]) > (interior ? 0.15 : 0.04)
      },
    })
    lote.pieza()
  }
  if (b.colgante > 0.005) mechonBarba(lote, cu, b, cB, sem)
  if (b.bigoteCaido > 0.005) bigoteCaido(lote, cu, b, cB)
}

/** Barba que cuelga del mentón: se angosta hacia la punta; partida, se abre en dos. */
function mechonBarba(lote: Lote, cu: Cuerpo, b: BarbaR, c: RGBA, sem: number) {
  const cab = cu.cab
  const filas = 8
  const cols = 12
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const y0 = cab.yMenton + 0.014
  const largo = b.colgante / cab.hs
  const ancho0 = (b.anchoColgante / cab.hs) * 0.5
  for (let i = 0; i <= filas; i++) {
    const t = i / filas
    const fila: number[] = []
    let cy = 0
    let cz = 0
    for (let k = 0; k < cols; k++) {
      const g = (k / cols) * Math.PI * 2
      const cx = Math.cos(g)
      // Partida: el centro de la punta es más corto (se ven dos masas).
      const corte = 1 - b.partida * 0.28 * campana(cx, 0, 0.35) * suave(0.5, 1, t)
      const y = y0 - t * largo * corte
      const ancho = ancho0 * (1 - 0.7 * Math.pow(t, 1.1)) * (1 + 0.08 * Math.sin(g * 5 + t * 7))
      const fondo = Math.min(ancho, 0.026) * (1 - 0.55 * t)
      const zc = 0.074 - 0.014 * t + 0.008 * Math.sin(t * 2.5) + b.rizo * 0.004 * Math.sin(t * 9 + sem)
      const x = cx * ancho
      const z = zc + Math.sin(g) * fondo
      cab.aAvatar(x, y, z, _v)
      cy += y
      cz += zc
      const pw: Pesos = t < 0.25 ? [[H.mandibula, 0.65], [H.cabeza, 0.35]] : [[H.mandibula, 0.4 * (1 - t)], [H.cuello, 0.35], [H.pecho, 0.25 + 0.4 * t]]
      const k2 = 0.85 + 0.15 * Math.sin(g * 9 + t * 11)
      const col = conCanas(c, b.canas, 0.5 + 0.5 * Math.sin(g * 7 + sem))
      fila.push(lote.v(_v.x, _v.y, _v.z, g * 0.8, t * 2.4, [col[0] * k2, col[1] * k2, col[2] * k2, (t > 0.85 ? 1 - (t - 0.85) * 5 : 1) * 1.3], pw, [0.6, 0]))
    }
    ids.push(fila)
    centros.push(cab.aAvatar(0, cy / cols, cz / cols, new THREE.Vector3()))
  }
  lote.tiras(ids, true, { centros })
  lote.pieza()
}

/** Bigote largo que cae por las comisuras (dos mechones finos). */
function bigoteCaido(lote: Lote, cu: Cuerpo, b: BarbaR, c: RGBA) {
  const cab = cu.cab
  const yb = cab.yBoca
  const aB = cab.anchoBoca
  const largo = b.bigoteCaido / cab.hs
  for (const lado of [1, -1]) {
    const ids: number[][] = []
    const centros: THREE.Vector3[] = []
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = lado * (aB + 0.002 + 0.006 * Math.sin(t * Math.PI * 0.6))
      const y = yb + 0.004 - t * largo
      const z = 0.098 - 0.01 * t
      const r = lerp(0.0032, 0.0006, t)
      const fila: number[] = []
      for (let k = 0; k < 5; k++) {
        const g = (k / 5) * Math.PI * 2
        cab.aAvatar(x + Math.cos(g) * r, y, z + Math.sin(g) * r, _v)
        const pw: Pesos = t < 0.3 ? [[H.cabeza, 1]] : [[H.cabeza, 0.5], [H.mandibula, 0.2], [H.cuello, 0.3]]
        fila.push(lote.v(_v.x, _v.y, _v.z, k * 0.2, t * 2, [c[0], c[1], c[2], 1.6 * (1 - suave(0.85, 1, t))], pw, [0.6, 0]))
      }
      ids.push(fila)
      centros.push(cab.aAvatar(x, y, z, new THREE.Vector3()))
    }
    lote.tiras(ids, true, { centros })
  }
  lote.pieza()
}

// ── Cejas ─────────────────────────────────────────────────────

/**
 * Cejas con volumen: una base pegada a la piel, una capa de arriba algo
 * separada (las hebras corren a lo largo, inclinadas hacia afuera) y, si la
 * ficha dice pobladas, una tercera que se levanta y cae (cejas de anciano).
 */
function cejas(lote: Lote, cu: Cuerpo) {
  const cab = cu.cab
  const ce = cu.rasgos.f.cejas
  const cC = rgba(ce.color)
  const o = cab.ojo
  const capas: Array<{ off: number; alto: number; alfa: number; levanta: number }> = [
    { off: 0.0005, alto: 1.1, alfa: 0.75, levanta: 0 },
    { off: 0.0013 + 0.0008 * ce.grosor, alto: 0.85, alfa: 1.05, levanta: 0 },
  ]
  if (ce.pobladas > 0.05) capas.push({ off: 0.0022, alto: 1.15, alfa: 0.95, levanta: 0.005 * ce.pobladas })
  for (const lado of [1, -1] as const) {
    for (let c = 0; c < capas.length; c++) {
      const cp = capas[c]
      const cols = 11
      const ids: number[][] = []
      for (let r = 0; r <= 2; r++) {
        const w = r - 1
        const fila: number[] = []
        for (let k = 0; k <= cols; k++) {
          const t = k / cols
          const x = lado * lerp(0.011, 0.011 + 0.045 * ce.largo, t) * cab.r.ancho
          const alto = lerp(0.0112, 0.0058, t) * ce.grosor * cp.alto
          const arco = (0.004 + 0.008 * ce.arco) * Math.sin(Math.PI * Math.min(1, t * 1.15))
          const y = o.y + 0.0172 + 0.01 * ce.alto + arco - 0.003 * t + ce.inclinacion * 0.004 * (1 - t) + w * alto * 0.5
          // Punto sobre la piel en esa dirección desde el centro.
          _l.set(x, y, 0.1).normalize()
          const tt = cab.rayo(0, 0, 0, _l.x, _l.y, _l.z, 0.16)
          const px = _l.x * tt
          const py = _l.y * tt
          const pz = _l.z * tt
          cab.normal(px, py, pz, _n)
          // Las capas de arriba se separan de la piel; la que se levanta, más arriba.
          const g = cp.off + 0.0009 * (1 - Math.abs(w)) * (1 - 0.5 * t) * ce.grosor + cp.levanta * (w + 1) * 0.5
          cab.aAvatar(px + _n.x * g, py + _n.y * g + cp.levanta * 0.3 * (w + 1), pz + _n.z * g, _v)
          const a = (1.05 - Math.abs(w) * 0.55) * suave(1.04, 0.74, t) * suave(-0.1, 0.14, t) * cp.alfa * (0.35 + 0.8 * ce.densidad)
          // Hebras a lo largo de la ceja, inclinadas hacia afuera y arriba.
          fila.push(lote.v(_v.x, _v.y, _v.z, w * 0.22 + t * 0.35 + c * 0.41, t * 1.4 + w * 0.12, [cC[0], cC[1], cC[2], a * 1.4], [[H.cabeza, 1]], [0.22, 0]))
        }
        ids.push(fila)
      }
      lote.tiras(ids, false, { centros: ids.map(() => cab.c) })
    }
  }
  lote.pieza()
}

/** Pestañas (arriba): siguen al párpado. */
function pestanas(lote: Lote, cu: Cuerpo) {
  const cab = cu.cab
  const cC = rgba(cu.rasgos.f.cejas.color)
  const cP: RGBA = [Math.min(cC[0], 0.05), Math.min(cC[1], 0.04), Math.min(cC[2], 0.035), 1]
  for (const lado of [1, -1] as const) {
    const o = cab.ojo
    const { U, Vu, incl } = cab.parpado
    const cols = 14
    const idsP: number[][] = []
    const L = lado > 0 ? "I" : "D"
    for (let r = 0; r <= 1; r++) {
      const fila: number[] = []
      for (let k = 0; k <= cols; k++) {
        const psi = 0.12 + (k / cols) * (Math.PI - 0.24)
        const cp = Math.cos(psi)
        const sp = Math.sin(psi)
        const u = U * cp * 1.03
        const v = Vu * Math.pow(sp, 0.8) * 1.03 + incl * cp
        const R = o.r + 0.0016 + r * 0.0055 * (0.6 + 0.4 * sp)
        const vv = v + r * 0.32 * (0.6 + 0.4 * sp)
        const ux = lado * u
        cab.aAvatar(lado * o.x + Math.sin(ux) * Math.cos(vv) * R, o.y + Math.sin(vv) * R, o.z + Math.cos(ux) * Math.cos(vv) * R, _v)
        fila.push(lote.v(_v.x, _v.y, _v.z, k / cols, r, [cP[0], cP[1], cP[2], r ? 0.8 : 1.5], [[H[`parpado${L}`], 1]], [0, 0]))
      }
      idsP.push(fila)
    }
    lote.tiras(idsP, false, { invertir: false })
  }
  lote.pieza()
}
