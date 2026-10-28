// ──────────────────────────────────────────────────────────────
// Pelo, barba, cejas y pestañas.
//
// El pelo es una capa esculpida sobre el cuero cabelludo (la misma grilla de
// la cabeza, desplazada por un grosor que depende del estilo: tupé con
// volumen, raya al costado, peinado hacia atrás, rizos, melena), con textura
// de hebras, borde deshilachado (alfa por hebra) y brillo anisotrópico. La
// barba usa la misma técnica sobre la cara; la larga cuelga como un mechón.
// Cejas y pestañas son tiras finas con hebras.
//
// Todo va en un lote: el color de cada parte va en el vértice.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Personaje } from "../tipos"
import { grosorBarba, mascaraBarba, pelo, rizos } from "./avatar-cabeza"
import { ANG, H, M, type Cuerpo } from "./avatar-cuerpo"
import { hashTexto, lerp, Lote, rgba, suave, type Pesos, type RGBA } from "./avatar-geo"

const _v = new THREE.Vector3()
const _l = new THREE.Vector3()
const _n = new THREE.Vector3()

/** Color de las cejas: el del pelo, o el de la barba si es calvo; un poco más oscuro. */
function colorCejas(p: Personaje): string {
  const ap = p.apariencia
  const base = ap.pelo.estilo === "calvo" || ap.pelo.estilo === "rapado" ? ap.barba?.color ?? "#3a2a20" : ap.pelo.color
  const c = new THREE.Color(base)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  // Rubios y canosos: cejas algo más oscuras que el pelo.
  c.setHSL(hsl.h, hsl.s, hsl.l > 0.5 ? hsl.l * 0.72 : Math.min(0.5, hsl.l * 1.05 + 0.03))
  return `#${c.getHexString()}`
}

export function armarPelo(cu: Cuerpo, p: Personaje, op: { holguraEspalda: number; bajoSombrero: boolean; sombreroY?: number }): Lote {
  const ap = p.apariencia
  const lote = new Lote()
  const cab = cu.cab
  const filas = cu.filasCabeza()
  const sem = hashTexto(p.id) % 997
  const estilo = ap.pelo.estilo
  const barbaLarga = ap.barba?.estilo === "larga" || ap.barba?.estilo === "completa"
  const cPelo = rgba(ap.pelo.color)
  const cBarba = rgba(ap.barba?.color ?? ap.pelo.color)

  // ── Pelo de la cabeza ──
  const nF = filas.length
  const mascara: number[][] = []
  const ids: number[][] = []
  const rizo = estilo === "rizado" ? 0.0045 : estilo === "rizado_voluminoso" ? 0.009 : 0
  let vAcum = new Float64Array(M)
  for (let i = 0; i < nF; i++) {
    const f = filas[i]
    const fila: number[] = []
    const fm: number[] = []
    for (let j = 0; j < M; j++) {
      const l = f.l[j]
      let [m, g] = pelo(cab, l.x, l.y, l.z, estilo, barbaLarga)
      // Bajo el sombrero, el pelo se aplasta un poco.
      if (op.bajoSombrero && op.sombreroY !== undefined && l.y > op.sombreroY) g *= 0.55
      if (rizo && m > 0) g += rizo * (0.6 + 0.4 * rizos(l.x, l.y, l.z, 190, sem)) * suave(0, 0.6, m)
      // En el borde el pelo baja hasta la piel: sin "casco".
      g *= suave(0, 0.75, m)
      fm.push(m)
      const n = f.n[j]
      const d = g + 0.0012
      cab.aAvatar(l.x + n.x * d, l.y + n.y * d, l.z + n.z * d, _v)
      // Raíz más oscura y nuca en sombra; un poco de variación por mechón.
      const k = (0.78 + 0.22 * suave(0.0, 0.012, g)) * (0.82 + 0.18 * suave(-0.12, 0.04, l.y)) * (0.92 + 0.08 * Math.sin(ANG[j] * 7 + sem))
      const a = suave(0.0, 0.42, m)
      if (i > 0) vAcum[j] += filas[i].P[j].distanceTo(filas[i - 1].P[j])
      fila.push(lote.v(_v.x, _v.y, _v.z, ANG[j] * 3.2, vAcum[j] * 9, [cPelo[0] * k, cPelo[1] * k, cPelo[2] * k, a], cu.pesosCabeza(l), [0.5, 0]))
    }
    ids.push(fila)
    mascara.push(fm)
  }
  const centros = filas.map((f) => (f.radial ? cab.c : _v.set(0, f.P[0].y, cab.c.z - 0.03).clone()))
  // Atrás, una columna de cada dos (la nuca es suave); al frente y a los lados, todas.
  const usar = (j: number) => Math.sin(ANG[j]) > -0.35 || j % 2 === 0
  const sub = ids.map((f) => f.filter((_, j) => usar(j)))
  const msub = mascara.map((f) => f.filter((_, j) => usar(j)))
  const MS = sub[0].length
  lote.tiras(sub, true, {
    centros,
    emitir: (i, j) => {
      const j2 = (j + 1) % MS
      return Math.max(msub[i][j], msub[i][j2], msub[i + 1][j], msub[i + 1][j2]) > 0.03
    },
  })
  lote.pieza()

  // ── Pelo largo: cae sobre la espalda y los hombros ──
  if (estilo === "largo" || estilo === "rubio_tupe" || estilo === "rizado_voluminoso") {
    const largo = estilo === "largo" ? 0.16 : estilo === "rizado_voluminoso" ? 0.03 : 0.035
    const base = filas[0]
    const filasExt = 5
    const idsE: number[][] = [ids[0]]
    const yB = base.P[0].y
    const mk: number[][] = [mascara[0]]
    for (let r = 1; r <= filasExt; r++) {
      const t = r / filasExt
      const fila: number[] = []
      const fm: number[] = []
      for (let j = 0; j < M; j++) {
        const a = ANG[j]
        const m0 = mascara[0][j]
        const P0 = base.P[j]
        // Cae vertical desde el borde del pelo, abriéndose hacia afuera.
        const y = yB - t * largo * cu.s
        const ox = P0.x * (1 + 0.25 * t)
        const oz = (P0.z - cab.c.z) * (1 + 0.15 * t) + cab.c.z - 0.012 * t
        // Por encima de la espalda: que no se hunda en el tronco.
        const atras = Math.max(0, -Math.sin(a))
        _v.set(ox, y, oz - atras * op.holguraEspalda * t)
        const m = m0 * (1 - Math.pow(t, 1.6)) * suave(0.55, 0.0, Math.sin(a))
        fm.push(m)
        const pw: Pesos = [[H.cabeza, (1 - t) * 0.5], [H.cuello, 0.3], [H.pecho, 0.2 + t * 0.5]]
        fila.push(lote.v(_v.x, _v.y, _v.z, a * 3.2, (r * largo) * 9, [cPelo[0] * 0.85, cPelo[1] * 0.85, cPelo[2] * 0.85, suave(0, 0.55, m)], pw, [0.5, 0]))
      }
      idsE.push(fila)
      mk.push(fm)
    }
    const cs = idsE.map((_, i) => new THREE.Vector3(0, yB - (i / filasExt) * largo * cu.s, cab.c.z - 0.02))
    const subE = idsE.map((f) => f.filter((_, j) => j % 2 === 0))
    const mkE = mk.map((f) => f.filter((_, j) => j % 2 === 0))
    const ME = subE[0].length
    lote.tiras(subE, true, {
      centros: cs,
      emitir: (i, j) => {
        const j2 = (j + 1) % ME
        return Math.max(mkE[i][j], mkE[i][j2], mkE[i + 1][j], mkE[i + 1][j2]) > 0.05
      },
    })
    lote.pieza()
  }

  // ── Barba ──
  const eb = ap.barba?.estilo
  if (eb && eb !== "barba_de_dias") {
    const idsB: number[][] = []
    const mb: number[][] = []
    for (let i = 0; i < nF; i++) {
      const f = filas[i]
      const fila: number[] = []
      const fm: number[] = []
      for (let j = 0; j < M; j++) {
        const l = f.l[j]
        const m = mascaraBarba(cab, l.x, l.y, l.z, eb)
        fm.push(m)
        const g = m > 0 ? grosorBarba(cab, l.x, l.y, l.z, eb) * (0.5 + 0.5 * suave(0, 0.6, m)) + (eb === "completa" || eb === "larga" ? 0.002 * rizos(l.x, l.y, l.z, 260, sem) : 0) : 0
        const n = f.n[j]
        const d = g + 0.001
        cab.aAvatar(l.x + n.x * d, l.y + n.y * d, l.z + n.z * d, _v)
        // La barba deja ver algo de piel y no es un bloque negro: más clara en la punta de las hebras.
        const k = 1.05 + 0.25 * suave(0.0, 0.008, g)
        fila.push(lote.v(_v.x, _v.y, _v.z, ANG[j] * 4, l.y * 12, [cBarba[0] * k, cBarba[1] * k, cBarba[2] * k, suave(0.02, 0.6, m) * 0.92], cu.pesosCabeza(l), [0.6, 0]))
      }
      idsB.push(fila)
      mb.push(fm)
    }
    lote.tiras(idsB, true, {
      centros,
      emitir: (i, j) => {
        const j2 = (j + 1) % M
        return Math.max(mb[i][j], mb[i][j2], mb[i + 1][j], mb[i + 1][j2]) > 0.04
      },
    })
    lote.pieza()
    if (eb === "larga") mechonBarba(lote, cu, cBarba, 0.14)
  }

  // ── Cejas ──
  const cC = rgba(colorCejas(p))
  for (const lado of [1, -1] as const) {
    const cols = 10
    const idsC: number[][] = []
    for (let r = 0; r <= 2; r++) {
      const w = r - 1
      const fila: number[] = []
      for (let k = 0; k <= cols; k++) {
        const t = k / cols
        const x = lado * lerp(0.011, 0.056, t) * cab.r.ancho
        const alto = lerp(0.0115, 0.0062, t) * (cu.fem ? 0.75 : 1)
        const y = cab.ojo.y + 0.0175 + 0.007 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.003 * t + w * alto * 0.5 + (cu.fem ? 0.002 : 0)
        // Punto sobre la piel en esa dirección desde el centro.
        _l.set(x, y, 0.1).normalize()
        const tt = cab.rayo(0, 0, 0, _l.x, _l.y, _l.z, 0.16)
        const px = _l.x * tt
        const py = _l.y * tt
        const pz = _l.z * tt
        cab.normal(px, py, pz, _n)
        const g = 0.0009 + 0.0012 * (1 - Math.abs(w)) * (1 - 0.5 * t)
        cab.aAvatar(px + _n.x * g, py + _n.y * g, pz + _n.z * g, _v)
        const a = (0.92 - Math.abs(w) * 0.55) * suave(1.04, 0.78, t) * suave(-0.08, 0.12, t)
        fila.push(lote.v(_v.x, _v.y, _v.z, w * 0.5, t * 1.5, [cC[0], cC[1], cC[2], a], [[H.cabeza, 1]], [0.6, 0]))
      }
      idsC.push(fila)
    }
    lote.tiras(idsC, false, { centros: idsC.map(() => cab.c) })
    lote.pieza()
  }

  // ── Pestañas (arriba): siguen al párpado ──
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
        fila.push(lote.v(_v.x, _v.y, _v.z, k / cols, r, [cP[0], cP[1], cP[2], r ? 0.55 : 1], [[H[`parpado${L}`], 1]], [0.5, 0]))
      }
      idsP.push(fila)
    }
    lote.tiras(idsP, false, { invertir: false })
    lote.pieza()
  }
  return lote
}

/** Barba larga: un mechón que cuelga del mentón, angostándose hacia la punta. */
function mechonBarba(lote: Lote, cu: Cuerpo, c: RGBA, largo: number) {
  const cab = cu.cab
  const filas = 9
  const cols = 16
  const ids: number[][] = []
  const centros: THREE.Vector3[] = []
  const y0 = cab.yMenton + 0.012
  for (let i = 0; i <= filas; i++) {
    const t = i / filas
    const y = y0 - t * largo
    const ancho = 0.042 * cab.r.ancho * (1 - 0.72 * Math.pow(t, 0.9))
    const fondo = 0.024 * (1 - 0.6 * t)
    const zc = 0.072 - 0.012 * t + 0.01 * Math.sin(t * 2.5)
    const fila: number[] = []
    for (let k = 0; k < cols; k++) {
      const g = (k / cols) * Math.PI * 2
      const x = Math.cos(g) * ancho * (1 + 0.08 * Math.sin(g * 5 + t * 7))
      const z = zc + Math.sin(g) * fondo
      cab.aAvatar(x, y, z, _v)
      const pw: Pesos = t < 0.3 ? [[H.mandibula, 0.6], [H.cabeza, 0.4]] : [[H.mandibula, 0.3 * (1 - t)], [H.cuello, 0.4], [H.pecho, 0.3 + 0.3 * t]]
      const k2 = 0.85 + 0.15 * Math.sin(g * 9 + t * 11)
      fila.push(lote.v(_v.x, _v.y, _v.z, g * 0.8, t * 2.4, [c[0] * k2, c[1] * k2, c[2] * k2, t > 0.85 ? 1 - (t - 0.85) * 4 : 1], pw, [0.6, 0]))
    }
    ids.push(fila)
    centros.push(cab.aAvatar(0, y, zc, new THREE.Vector3()))
  }
  lote.tiras(ids, true, { centros })
  lote.pieza()
}

