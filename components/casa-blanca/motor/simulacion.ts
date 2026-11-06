// ──────────────────────────────────────────────────────────────
// LA SIMULACIÓN DE LA CASA BLANCA VIVA
//
// Quién está dónde, a dónde va, qué hace y de qué habla. No conoce three ni
// el DOM: la escena lee `pj` en cada cuadro y la interfaz escucha `on()`.
//
// Tres relojes, a propósito:
// - El mundo avanza 12 segundos por segundo real × velocidad: a ×1 un día
//   dura 2 horas, a ×4 media hora y a ×15 ocho minutos. Más rápido, los
//   personajes pasaban el 42 % del día caminando de un lugar a otro.
// - Los personajes caminan con la RAÍZ de la velocidad: a ×16 van 4 veces
//   más rápido, no 16 (a ×16 se teletransportarían y no se vería nada).
// - Las conversaciones corren en segundos reales para que se puedan leer.
//
// Determinista: todo el azar sale de un PRNG con semilla (mulberry32) y el
// tiempo entra por `avanzar(dt, ahoraMs)`. Misma semilla y mismos pasos =
// misma historia; así se puede probar (simulacion.test.ts).
//
// Nada de un personaje en particular vive aquí: horarios, frases y
// conversaciones especiales llegan como datos (datos/personajes.ts).
// ──────────────────────────────────────────────────────────────

import {
  ALTURA_NIVEL,
  type EntradaHorario,
  type Especiales,
  type EstadoCuerpo,
  type Linea,
  type Lugar,
  type NivelId,
  type Personaje,
  type Tema,
  type TipoLugar,
  type Vec3,
} from "../tipos"
import { GRAFO, HUELLAS, LUGAR, NODO } from "../lugares"
import { CUARTOS, PLANTA, dentroDeCuarto, type PlantaId } from "../plantas"

// ── Tipos públicos ────────────────────────────────────────────

export interface EstadoPj {
  id: string
  pos: Vec3
  /** Hacia dónde mira: Math.atan2(dx, dz). 0 = hacia +z (sur). */
  rumbo: number
  /** m/s reales (lo que se ve en pantalla), para que la animación coincida con el desplazamiento. */
  velocidad: number
  estado: EstadoCuerpo
  visible: boolean
  nivel: NivelId
  /** La planta del edificio donde está (null = afuera). Cambia a mitad de camino entre dos plantas: en el vano de la puerta. */
  planta: PlantaId | null
  /** Lugar donde está. null mientras va de un lugar a otro. */
  lugarId: string | null
  /** Lugar al que va (o donde está, si ya llegó). */
  destinoId: string | null
  actividad: string
  conversacionId: string | null
  /** `hasta` está en la misma escala que el `ahoraMs` que se pasa a avanzar(). */
  burbuja: { texto: string; hasta: number; tipo: "dice" | "piensa" } | null
  /** Lo más reciente primero. */
  memoria: { cuando: string; texto: string }[]
  /** De -100 a 100, hacia cada uno de los demás. */
  afinidad: Record<string, number>
}

export interface LineaConv {
  id: string
  texto: string
  cita?: boolean
}

export interface Conversacion {
  id: string
  lugarId: string
  ids: string[]
  lineas: LineaConv[]
  /** Índice de la próxima línea por decir. */
  i: number
  /** true = todavía pueden llegar líneas (la IA está escribiendo). */
  abierta: boolean
  titulo?: string
}

export type EventoSim =
  | { tipo: "linea"; conv: Conversacion; linea: LineaConv; lugarId: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "hora"; dia: number; minutos: number }

export type DeltaAfinidad = { a: string; b: string; delta: number }

export interface OpcionesSimulacion {
  dia?: number
  /** 0..1440. Por defecto 17:30, la hora dorada con la que abre la página. */
  minutos?: number
  /** Semilla del azar. Misma semilla = misma historia. */
  semilla?: number
}

// ── Constantes ────────────────────────────────────────────────

const VEL_CAMINA = 1.4
/** Paso apurado: sigue caminando, pero rápido. Antes de correr, se apura. */
const VEL_APURADO = 2.1
const VEL_CORRE = 3.5
/** Por dentro de un edificio o un pasillo oculto nadie lo ve: se cruza a 8 m/s. */
const VEL_OCULTO = 8
/** Minutos del mundo por segundo real a ×1. */
const MIN_POR_S = 0.2
/** Cada tramo de ascensor dura 4 s (con el mismo reloj que el paso de los personajes). */
const ASCENSOR_S = 4
/** Distancia mínima entre dos personajes que se paran en un lugar. */
const SEPARACION = 1
const MEMORIA_MAX = 14
const AFINIDAD_INICIAL = 10
/** reunir(): espera a que lleguen todos, como mucho 40 s reales. */
const ESPERA_REUNION_S = 40
/** Charla de guion: el que se acerca tiene hasta 20 s reales. */
const ESPERA_GUION_S = 20
/** Una conversación abierta sin líneas nuevas durante 2 min se cierra sola (la IA no respondió). */
const SILENCIO_MAX_S = 120
/** Después de conversar, cada uno descansa 15 s antes de la próxima charla de guion. */
const DESCANSO_CONV_S = 15
/** Un lugar no arranca otra charla de guion antes de 9 s, salvo que haya gente de sobra para otro grupo. */
const ENFRIA_LUGAR_S = 9
const GENTE_PARA_OTRO_GRUPO = 4
const CADA_CONV_S = 2
const PROB_CONV = 0.4
const PROB_ESPECIAL = 0.7
const CADA_PENSAR_S = 5
const PROB_PENSAR = 0.55
const PENSAR_MS = 4200
/** Para charlar de guion tienen que estar a menos de 25 m (un jardín es grande). */
const RADIO_CHARLA = 25
/** A menos de 3,5 m del otro ya se está conversando: nadie se mueve. */
const CERCA_CHARLA = 3.5
/** Al llegar, se para a menos de 30 m del acceso: en un jardín de 120 m nadie cruza todo para quedarse en la otra punta. */
const RADIO_LLEGADA = 30
/**
 * Si a paso normal llegaría con menos del 15 % de su actividad por delante, se
 * apura; si ni apurado llega, corre. Más bajo y media casa corre todo el día.
 */
const UMBRAL_TARDE = 0.85
const PASO_MAX_S = 0.1
const DT_MAX_S = 1
const MINUTOS_INICIO = 17 * 60 + 30
const LUGAR_RESERVA = "jardin-sur"
const SEMILLA_INICIAL = 20261028

const TEMAS: Tema[] = ["poder", "dinero", "muerte", "tecnologia", "guerra", "fe", "verdad", "futuro", "casa", "comida", "deporte", "disciplina"]
const NOMBRE_TEMA: Record<Tema, string> = {
  poder: "el poder",
  dinero: "el dinero",
  muerte: "la muerte",
  tecnologia: "la tecnología",
  guerra: "la guerra",
  fe: "la fe",
  verdad: "la verdad",
  futuro: "el futuro",
  casa: "esta casa",
  comida: "la comida",
  deporte: "el deporte",
  disciplina: "la disciplina",
}

/** De qué se habla en cada lugar (como en la versión anterior). Un lugar nuevo usa los de su tipo. */
const TEMAS_LUGAR: Record<string, Tema[]> = {
  "despacho-oval": ["poder", "casa"],
  "sala-gabinete": ["poder", "futuro", "guerra"],
  "sala-roosevelt": ["futuro", "dinero"],
  "sala-prensa": ["verdad", "poder"],
  "sala-crisis": ["guerra", "verdad", "tecnologia"],
  "salon-este": ["casa", "muerte", "poder"],
  "salon-azul": ["fe", "casa"],
  "salon-rojo": ["poder", "dinero"],
  "salon-verde": ["verdad", "futuro"],
  "comedor-estado": ["comida", "poder"],
  "dormitorio-lincoln": ["muerte", "verdad"],
  "sala-oval-amarilla": ["poder", "casa"],
  cocina: ["comida", "fe"],
  "recepcion-diplomatica": ["poder", "verdad"],
  "sala-mapas": ["guerra"],
  solario: ["muerte", "fe", "futuro"],
  "balcon-truman": ["poder", "futuro"],
  "jardin-sur": ["futuro", "fe", "casa"],
  "jardin-norte": ["casa", "poder"],
  rosas: ["fe", "muerte", "futuro"],
  columnata: ["poder", "verdad"],
  piscina: ["deporte", "futuro"],
  obra: ["futuro", "casa", "dinero"],
  lafayette: ["poder", "verdad", "futuro"],
  cafeteria: ["comida", "tecnologia", "dinero"],
  "sala-guerra": ["guerra", "poder", "futuro"],
  biblioteca: ["verdad", "futuro"],
  "parque-int": ["fe", "futuro"],
  "piscina-int": ["deporte", "disciplina"],
  cine: ["futuro", "verdad"],
  capilla: ["fe", "muerte", "verdad"],
  estudio: ["verdad", "dinero"],
  ajedrez: ["guerra", "poder"],
  "taller-inventos": ["tecnologia", "futuro"],
}
const TEMAS_TIPO: Record<TipoLugar, Tema[]> = {
  edificio: ["poder", "casa"],
  jardin: ["futuro", "fe"],
  deporte: ["deporte", "disciplina"],
  departamento: ["dinero", "tecnologia", "futuro", "disciplina"],
  ocio: ["deporte", "futuro"],
  servicio: ["comida", "futuro"],
  obra: ["futuro", "casa"],
  interior: ["poder", "casa"],
}

/** Canchas y gimnasios del subsuelo (en la superficie se reconocen por tipo "deporte"). */
const DEPORTE_SUBSUELO = new Set(["gimnasio", "basquet-int", "padel-int", "ring"])
/** Donde el deporte es salir a correr. */
const PARA_CORRER = new Set(["jardin-sur", "parque", "lafayette"])
/** Mesa redonda de la Sala de guerra: el consejo se para en un anillo de al menos 5 m de radio. */
const ANILLO_MIN: Record<string, number> = { "sala-guerra": 5 }

// Las palabras se buscan enteras: "recorre" no es correr, "escena" no es cena.
const RE_CORRE = /\b(corre|correr|corren|corriendo|trota|trotar|trotan|trotando|trote)\b/i
const RE_COMIDA = /\b(desayun\w*|almuerz\w*|almorz\w*|cena|cenas|cenar|cenan|cenando|come|comer|comen|comiendo|comida|merienda\w*|merend\w*)\b|\bcaf[eé](?![a-záéíóúüñ])/i

// ── Obstáculos de la superficie (para no pararse ni caminar dentro de una fuente) ──

type Circulo = { x: number; z: number; r: number }
type Rect = { x0: number; x1: number; z0: number; z1: number }
const H = HUELLAS
const CIRCULOS: Circulo[] = [
  { x: H.fuenteNorte.x, z: H.fuenteNorte.z, r: H.fuenteNorte.radio },
  { x: H.fuenteSur.x, z: H.fuenteSur.z, r: H.fuenteSur.radio },
  { x: H.porticoSur.cx, z: H.porticoSur.cz, r: H.porticoSur.radio },
  { x: H.despachoOval.cx, z: H.despachoOval.cz, r: Math.max(H.despachoOval.rx, H.despachoOval.rz) },
]
const RECTS: Rect[] = [H.residencia, H.porticoNorte, H.alaOeste, H.eeob, H.tesoro]

// ── El grafo, preparado una vez ───────────────────────────────

type Flags = { ascensor: boolean; interior: boolean }
const VECINOS = new Map<string, Array<{ id: string; costo: number }>>()
const ARISTA = new Map<string, Flags>()
for (const n of GRAFO.nodos) VECINOS.set(n.id, [])
for (const a of GRAFO.aristas) {
  const [u, v] = a
  const op = a.length === 3 ? a[2] : undefined
  const nu = NODO[u]
  const nv = NODO[v]
  if (!nu || !nv) continue
  const costo = dist3(nu.p, nv.p)
  VECINOS.get(u)!.push({ id: v, costo })
  VECINOS.get(v)!.push({ id: u, costo })
  const f = { ascensor: !!op?.ascensor, interior: !!op?.interior }
  ARISTA.set(`${u}|${v}`, f)
  ARISTA.set(`${v}|${u}`, f)
}
const CAMINOS = new Map<string, string[] | null>()

/** A* con pesos = distancia 3D (la heurística, la distancia en línea recta, nunca sobreestima). */
function caminoEntre(desde: string, hasta: string): string[] | null {
  if (!NODO[desde] || !NODO[hasta]) return null
  if (desde === hasta) return [desde]
  const clave = `${desde}>${hasta}`
  const guardado = CAMINOS.get(clave)
  if (guardado !== undefined) return guardado
  const meta = NODO[hasta].p
  const g = new Map<string, number>([[desde, 0]])
  const previo = new Map<string, string>()
  const abiertos = [desde]
  const cerrados = new Set<string>()
  let res: string[] | null = null
  while (abiertos.length) {
    let bi = 0
    let bf = Infinity
    for (let i = 0; i < abiertos.length; i++) {
      const f = g.get(abiertos[i])! + dist3(NODO[abiertos[i]].p, meta)
      if (f < bf) {
        bf = f
        bi = i
      }
    }
    const actual = abiertos.splice(bi, 1)[0]
    if (actual === hasta) {
      res = [actual]
      let k = actual
      while (previo.has(k)) {
        k = previo.get(k)!
        res.unshift(k)
      }
      break
    }
    cerrados.add(actual)
    for (const v of VECINOS.get(actual) ?? []) {
      if (cerrados.has(v.id)) continue
      const ng = g.get(actual)! + v.costo
      if (ng < (g.get(v.id) ?? Infinity)) {
        g.set(v.id, ng)
        previo.set(v.id, actual)
        if (!abiertos.includes(v.id)) abiertos.push(v.id)
      }
    }
  }
  CAMINOS.set(clave, res)
  return res
}

function nodoCercano(p: Vec3, nivel: NivelId): string {
  let mejor = GRAFO.nodos[0].id
  let d = Infinity
  for (const n of GRAFO.nodos) {
    if (n.nivel !== nivel) continue
    const dd = dist3(n.p, p)
    if (dd < d) {
      d = dd
      mejor = n.id
    }
  }
  return mejor
}

const NIVELES = Object.keys(ALTURA_NIVEL) as NivelId[]
function nivelPorAltura(y: number): NivelId {
  let mejor = NIVELES[0]
  let d = Infinity
  for (const n of NIVELES) {
    const dd = Math.abs(ALTURA_NIVEL[n] - y)
    if (dd < d) {
      d = dd
      mejor = n
    }
  }
  return mejor
}

// ── Utilidades ────────────────────────────────────────────────

function dist3(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
const distXZ = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const copia = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z })
const dos = (n: number) => String(n).padStart(2, "0")
const esObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)
const claveDe = (ids: string[]) => [...ids].sort().join("|")
/** Lo que dura una línea en pantalla, según su largo (s). */
const durLinea = (t: string) => clamp(2.4 + t.length * 0.05, 3.2, 9)
const conPunto = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`)
const lista = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`)

function aTexto(l: Linea): { texto: string; cita?: boolean } {
  if (typeof l === "string") return { texto: l.trim() }
  if (l && typeof l.t === "string") return { texto: l.t.trim(), cita: true }
  return { texto: "" }
}

function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizarMinutos(m: number) {
  if (!Number.isFinite(m)) return 0
  return ((m % 1440) + 1440) % 1440
}

function ordenarHorario(hs: unknown): EntradaHorario[] {
  if (!Array.isArray(hs)) return []
  return hs
    .filter((e): e is EntradaHorario => Array.isArray(e) && Number.isFinite(e[0]) && typeof e[1] === "string" && typeof e[2] === "string")
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e[0] - b.e[0] || a.i - b.i)
    .map((x) => x.e)
}

/** La entrada vigente: la última con hora ≤ h. Antes de la primera, sigue la última del día anterior. */
function indiceEntrada(hs: EntradaHorario[], h: number) {
  if (!hs.length) return -1
  let k = -1
  for (let i = 0; i < hs.length; i++) if (hs[i][0] <= h) k = i
  return k >= 0 ? k : hs.length - 1
}

function esDeportivo(l: Lugar) {
  return l.tipo === "deporte" || DEPORTE_SUBSUELO.has(l.id)
}

function temasDe(l: Lugar): Tema[] {
  return TEMAS_LUGAR[l.id] ?? (DEPORTE_SUBSUELO.has(l.id) ? TEMAS_TIPO.deporte : TEMAS_TIPO[l.tipo]) ?? TEMAS
}

/** Cómo se ve el cuerpo cuando ya llegó, según el horario. */
function estadoBase(p: Personaje, l: Lugar, actividad: string, marca: EntradaHorario[3]): EstadoCuerpo {
  // Las IA no duermen: siguen despiertas aunque el horario diga "duerme".
  if (marca === "duerme") return p.real === "ia" ? "quieto" : "duerme"
  if (marca === "trabaja") return "sentado"
  if (RE_CORRE.test(actividad) || (marca === "deporte" && PARA_CORRER.has(l.id))) return "corre"
  if (marca === "deporte" || esDeportivo(l)) return "deporte"
  if (RE_COMIDA.test(actividad)) return "sentado"
  return "quieto"
}

/** Donde se para la gente dentro de un lugar. En un departamento, solo la franja del frente: el resto son los 100 escritorios. */
function areaLibre(l: Lugar): Rect {
  if (l.tipo === "departamento") return { x0: l.x0 + 2, x1: l.x1 - 2, z0: l.z0 + 1.5, z1: l.z0 + 6.5 }
  const m = Math.min(1.2, (l.x1 - l.x0) / 4, (l.z1 - l.z0) / 4)
  return { x0: l.x0 + m, x1: l.x1 - m, z0: l.z0 + m, z1: l.z1 - m }
}

const usaObstaculos = (l: Lugar) => l.nivel === "superficie" && !l.interior && Math.abs(l.y) < 0.5

/** Un lugar donde no se ve a nadie: dentro de un edificio que todavía no tiene planta. */
const oculto = (l: Lugar) => !!l.interior && !l.planta

/** El cuarto de una sala con planta (para el óvalo del Salón Azul y los márgenes). */
const CUARTO_DE_LUGAR = new Map(CUARTOS.filter((c) => c.lugarId && PLANTA[c.planta].lista).map((c) => [c.lugarId!, c]))

const enRect = (r: Rect, p: { x: number; z: number }, m = 0) => p.x > r.x0 - m && p.x < r.x1 + m && p.z > r.z0 - m && p.z < r.z1 + m

function enObstaculo(l: Lugar, p: { x: number; z: number }, margen: number) {
  if (l.planta) {
    // Adentro: fuera de la sala (o del óvalo) o encima de un mueble.
    const c = CUARTO_DE_LUGAR.get(l.id)
    if (c && !dentroDeCuarto(c, p.x, p.z, Math.max(0.45, margen * 0.6))) return true
    for (const r of l.obst ?? []) if (enRect(r, p, margen * 0.5)) return true
    return false
  }
  if (!usaObstaculos(l)) return false
  for (const c of CIRCULOS) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + margen) return true
  for (const r of RECTS) if (p.x > r.x0 - margen && p.x < r.x1 + margen && p.z > r.z0 - margen && p.z < r.z1 + margen) return true
  return false
}

/** Puntos para ir de `a` a `b` sin atravesar una fuente: si el segmento pasa por un círculo, se rodea. */
function esquivar(a: Vec3, b: Vec3, obst: Circulo[], y: number, prof = 0): Vec3[] {
  if (prof < 3) {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const l2 = dx * dx + dz * dz
    let peor: { c: Circulo; t: number; qx: number; qz: number } | null = null
    if (l2 > 1e-6) {
      for (const c of obst) {
        const t = clamp(((c.x - a.x) * dx + (c.z - a.z) * dz) / l2, 0, 1)
        if (t <= 0 || t >= 1) continue
        const qx = a.x + dx * t
        const qz = a.z + dz * t
        if (Math.hypot(qx - c.x, qz - c.z) < c.r + 0.5 && (!peor || t < peor.t)) peor = { c, t, qx, qz }
      }
    }
    if (peor) {
      const { c } = peor
      let nx = peor.qx - c.x
      let nz = peor.qz - c.z
      let n = Math.hypot(nx, nz)
      if (n < 1e-3) {
        nx = -dz
        nz = dx
        n = Math.hypot(nx, nz)
      }
      const m = { x: c.x + (nx / n) * (c.r + 1.2), y, z: c.z + (nz / n) * (c.r + 1.2) }
      return [...esquivar(a, m, obst, y, prof + 1), ...esquivar(m, b, obst, y, prof + 1)]
    }
  }
  return [copia(b)]
}

/** ¿El segmento a→b pasa por dentro del rectángulo? (Liang–Barsky, sin contar el borde.) */
function cruzaRect(a: { x: number; z: number }, b: { x: number; z: number }, r: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dz = b.z - a.z
  const lados: Array<[number, number]> = [
    [-dx, a.x - r.x0],
    [dx, r.x1 - a.x],
    [-dz, a.z - r.z0],
    [dz, r.z1 - a.z],
  ]
  for (const [q, d] of lados) {
    if (Math.abs(q) < 1e-12) {
      if (d <= 0) return false
      continue
    }
    const t = d / q
    if (q < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 >= t1) return false
  }
  return t1 - t0 > 1e-6
}

/**
 * Camino dentro de una sala sin atravesar sus muebles: si la recta choca con
 * uno, va por las esquinas (grafo de visibilidad, Dijkstra). Las esquinas que
 * caen fuera de la sala no sirven (un mueble contra el muro se rodea por el otro lado).
 * Si el punto de partida o de llegada está sobre un mueble (una silla de la
 * mesa), sale primero al borde más cercano.
 */
function rodear(a: Vec3, b: Vec3, obst: Rect[], dentro: (x: number, z: number) => boolean, y: number): Vec3[] {
  const libre = (p: { x: number; z: number }, q: { x: number; z: number }) => obst.every((r) => !cruzaRect(p, q, r))
  const salida = (p: Vec3): Vec3 | null => {
    const r = obst.find((o) => enRect(o, p))
    if (!r) return null
    const op: Array<[number, number, number]> = [
      [p.x - r.x0, r.x0 - 0.12, p.z],
      [r.x1 - p.x, r.x1 + 0.12, p.z],
      [p.z - r.z0, p.x, r.z0 - 0.12],
      [r.z1 - p.z, p.x, r.z1 + 0.12],
    ]
    op.sort((u, v) => u[0] - v[0])
    for (const [, x, z] of op) if (dentro(x, z)) return { x, y, z }
    return null
  }
  const sa = salida(a)
  const sb = salida(b)
  const ini = sa ?? a
  const fin = sb ?? b
  let medio: Vec3[] = [fin]
  if (!libre(ini, fin)) {
    const pts: Vec3[] = [ini, fin]
    for (const r of obst) {
      for (const [x, z] of [
        [r.x0 - 0.08, r.z0 - 0.08],
        [r.x1 + 0.08, r.z0 - 0.08],
        [r.x0 - 0.08, r.z1 + 0.08],
        [r.x1 + 0.08, r.z1 + 0.08],
      ]) {
        if (dentro(x, z) && !obst.some((o) => enRect(o, { x, z }))) pts.push({ x, y, z })
      }
    }
    const n = pts.length
    const dist = new Array<number>(n).fill(Infinity)
    const prev = new Array<number>(n).fill(-1)
    const hecho = new Array<boolean>(n).fill(false)
    dist[0] = 0
    for (let k = 0; k < n; k++) {
      let u = -1
      for (let i = 0; i < n; i++) if (!hecho[i] && (u < 0 || dist[i] < dist[u])) u = i
      if (u < 0 || dist[u] === Infinity) break
      hecho[u] = true
      if (u === 1) break
      for (let v = 0; v < n; v++) {
        if (hecho[v] || v === u) continue
        if (!libre(pts[u], pts[v])) continue
        const nd = dist[u] + distXZ(pts[u], pts[v])
        if (nd < dist[v]) {
          dist[v] = nd
          prev[v] = u
        }
      }
    }
    if (prev[1] >= 0) {
      medio = []
      for (let k = 1; k !== 0 && k >= 0; k = prev[k]) medio.unshift(pts[k])
    }
  }
  const out: Vec3[] = []
  if (sa) out.push(sa)
  out.push(...medio)
  if (sb) out.push(copia(b))
  return out.map(copia)
}

/**
 * Dónde se sienta a trabajar: el líder, al frente de su departamento (x = centro
 * de la celda, z = z0 + 3), mirando hacia su equipo (+z). Los demás de ese
 * departamento (las IA) se sientan a su lado, alternando: centro + 2,5, centro − 2,5…
 * Lo exporta para que la escena ponga el escritorio en el mismo punto.
 */
export function escritorioDe(p: Personaje, personajes: Personaje[]): { lugarId: string; pos: Vec3; rumbo: number } | null {
  const lugarId = `dep-${p.departamentoId}`
  const l = LUGAR[lugarId]
  if (!l) return null
  const cx = (l.x0 + l.x1) / 2
  const z = l.z0 + 3
  if (p.id === p.departamentoId) return { lugarId, pos: { x: cx, y: l.y, z }, rumbo: 0 }
  const acompanantes = personajes.filter((o) => o.departamentoId === p.departamentoId && o.id !== o.departamentoId)
  const i = Math.max(0, acompanantes.findIndex((o) => o.id === p.id))
  const lado = i % 2 === 0 ? 1 : -1
  return { lugarId, pos: { x: cx + lado * 2.5 * (Math.floor(i / 2) + 1), y: l.y, z }, rumbo: 0 }
}

// ── Estado interno ────────────────────────────────────────────

type Ritmo = "paso" | "apurado" | "corre"
const VEL: Record<Ritmo, number> = { paso: VEL_CAMINA, apurado: VEL_APURADO, corre: VEL_CORRE }

/** Un punto del recorrido. `nodo` = es un nodo del grafo; `entra` = al llegar aquí, entra a ese lugar. */
interface Tramo {
  p: Vec3
  nodo: string | null
  ascensor: boolean
  oculto: boolean
  nivel: NivelId
  /** La planta del punto de llegada (null = afuera). */
  planta: PlantaId | null
  entra?: string
}

const velTramo = (t: Tramo, ritmo: Ritmo) => (t.oculto ? VEL_OCULTO : VEL[ritmo])

interface Interno {
  p: Personaje
  horario: EntradaHorario[]
  /** Índice de la entrada de horario aplicada. */
  entrada: number
  /** Un irA() a mano: manda hasta el próximo cambio de horario. */
  manual: { lugarId: string; actividad: string } | null
  ruta: Tramo[]
  /** Donde empezó el tramo en curso (para cambiar de planta a mitad de camino). */
  inicioTramo: Vec3 | null
  ascT: number
  ascDesde: Vec3 | null
  /** Lugar donde está o por el que se mueve; se suelta al llegar al primer nodo del grafo. */
  zona: string | null
  /** Va de un lugar a otro. */
  viaje: boolean
  nodo: string | null
  meta: { lugarId: string; spot: Vec3; rumbo: number | null } | null
  /** El estado del cuerpo cuando está quieto en su lugar. */
  base: EstadoCuerpo
  fantasma: boolean
  ritmo: Ritmo
  vagar: number
  libreDesde: number
  recientes: string[]
}

interface ConvInterna {
  conv: Conversacion
  esperando: boolean
  limite: number
  t: number
  /** Las charlas que arranca sola la simulación se aceleran con la raíz de la velocidad. */
  auto: boolean
  tema: Tema | null
  resumen: string | null
  deltas: DeltaAfinidad[]
  silencio: number
  centro: Vec3 | null
}

type OpcionesConv = {
  auto: boolean
  lineas: LineaConv[]
  abierta: boolean
  titulo?: string
  tema: Tema | null
  /** "ancla": se juntan alrededor de uno que ya está ahí. "centro": anillo en el punto de reunión del lugar. */
  formacion: "ancla" | "centro"
  espera: number
  corre: boolean
}

// ── La simulación ─────────────────────────────────────────────

export class Simulacion {
  reloj: { dia: number; minutos: number; velocidad: number; pausa: boolean }
  pj: Record<string, EstadoPj> = {}
  conversaciones: Conversacion[] = []

  private personajes: Personaje[]
  private ids: string[]
  private int: Record<string, Interno> = {}
  private especiales: Especiales
  private rand: () => number
  private oyentes = new Set<(e: EventoSim) => void>()
  private convs = new Map<string, ConvInterna>()
  /** Conversaciones especiales ya dichas hoy (no se repiten en el día). */
  private usados = new Set<string>()
  private enfriaLugar: Record<string, number> = {}
  private escritorios: Record<string, Array<{ id: string; pos: Vec3 }>> = {}
  private tReal = 0
  private ahora = 0
  private relojConv = 0
  private relojPensar = 0
  private contador = 0
  private marcaHora = 0
  private avisados = new Set<string>()

  constructor(personajes: Personaje[], especiales: Especiales, opciones: OpcionesSimulacion = {}) {
    const vistos = new Set<string>()
    this.personajes = (Array.isArray(personajes) ? personajes : []).filter((p) => {
      if (!p || typeof p.id !== "string" || vistos.has(p.id)) return false
      vistos.add(p.id)
      return true
    })
    this.ids = this.personajes.map((p) => p.id)
    this.especiales = esObj(especiales) ? especiales : {}
    this.rand = mulberry32(Number.isFinite(opciones.semilla) ? (opciones.semilla as number) : SEMILLA_INICIAL)
    const dia = Number(opciones.dia)
    this.reloj = {
      dia: Number.isInteger(dia) && dia >= 1 ? dia : 1,
      minutos: normalizarMinutos(opciones.minutos ?? MINUTOS_INICIO),
      velocidad: 1,
      pausa: false,
    }
    for (const p of this.personajes) {
      const esc = escritorioDe(p, this.personajes)
      if (esc) (this.escritorios[esc.lugarId] = this.escritorios[esc.lugarId] ?? []).push({ id: p.id, pos: esc.pos })
    }
    for (const p of this.personajes) {
      const afinidad: Record<string, number> = {}
      for (const o of this.ids) if (o !== p.id) afinidad[o] = AFINIDAD_INICIAL
      this.pj[p.id] = {
        id: p.id,
        pos: { x: 0, y: 0, z: 0 },
        rumbo: 0,
        velocidad: 0,
        estado: "quieto",
        visible: true,
        nivel: "superficie",
        planta: null,
        lugarId: null,
        destinoId: null,
        actividad: "",
        conversacionId: null,
        burbuja: null,
        memoria: [],
        afinidad,
      }
      this.int[p.id] = {
        p,
        horario: ordenarHorario(p.horario),
        entrada: -1,
        manual: null,
        ruta: [],
        inicioTramo: null,
        ascT: 0,
        ascDesde: null,
        zona: null,
        viaje: false,
        nodo: null,
        meta: null,
        base: "quieto",
        fantasma: false,
        ritmo: "paso",
        vagar: 2 + this.rand() * 8,
        libreDesde: 0,
        recientes: [],
      }
    }
    // Arranca cada uno ya en su lugar del horario, no caminando desde el origen.
    const h = this.reloj.minutos / 60
    for (const id of this.ids) {
      this.int[id].entrada = indiceEntrada(this.int[id].horario, h)
      this.aplicarHorario(id, true)
    }
    for (const id of this.ids) this.actualizarVista(id, 1)
    this.marcaHora = this.horaAbsoluta()
  }

  // ── API ──

  /** 1 s real = 1 minuto del mundo × velocidad. `ahoraMs` es el reloj de la interfaz (para las burbujas). */
  avanzar(dtReal: number, ahoraMs: number): void {
    const ahora = Number.isFinite(ahoraMs) ? ahoraMs : this.ahora
    if (!Number.isFinite(dtReal) || dtReal <= 0) {
      this.ahora = ahora
      this.limpiarBurbujas()
      return
    }
    // Un salto grande (pestaña en segundo plano) se recorta y se parte en pasos chicos.
    const total = Math.min(dtReal, DT_MAX_S)
    const n = Math.max(1, Math.ceil(total / PASO_MAX_S - 1e-9))
    const paso = total / n
    for (let i = 0; i < n; i++) this.paso(paso, ahora - (total - paso * (i + 1)) * 1000)
  }

  on(fn: (e: EventoSim) => void): () => void {
    this.oyentes.add(fn)
    return () => {
      this.oyentes.delete(fn)
    }
  }

  /** Lo manda a un lugar ahora; manda hasta el próximo cambio de su horario. */
  irA(id: string, lugarId: string, actividad?: string): void {
    const s = this.int[id]
    const l = LUGAR[lugarId]
    if (!s || !l) return
    this.sacarDeConv(id)
    s.manual = { lugarId, actividad: (typeof actividad === "string" && actividad.trim()) || `Visita: ${l.nombre}` }
    this.aplicarHorario(id)
    this.refrescar()
  }

  /** Junta a varios en un lugar y abre una conversación sin líneas (la IA o el guion las agregan). */
  reunir(lugarId: string, ids: string[], titulo?: string): Conversacion {
    const l = LUGAR[lugarId] ?? LUGAR[LUGAR_RESERVA]
    const quienes = this.validos(ids)
    const tit = typeof titulo === "string" && titulo.trim() ? titulo.trim() : undefined
    if (!quienes.length) return this.convVacia(l.id, tit)
    for (const id of quienes) {
      this.sacarDeConv(id)
      const s = this.int[id]
      s.manual = null
      s.fantasma = false
      s.base = "quieto"
      this.pj[id].actividad = tit ?? `Reunión · ${l.nombre}`
    }
    const conv = this.abrir(l, quienes, { auto: false, lineas: [], abierta: true, titulo: tit, tema: null, formacion: "centro", espera: ESPERA_REUNION_S, corre: true })
    this.refrescar()
    return conv
  }

  /** Agrega líneas a una conversación abierta. Solo cuentan las de quienes participan. */
  agregarLineas(convId: string, lineas: LineaConv[]): void {
    const ci = this.convs.get(convId)
    if (!ci || !Array.isArray(lineas)) return
    for (const l of lineas) {
      if (!l || typeof l.id !== "string" || typeof l.texto !== "string" || !l.texto.trim()) continue
      if (!ci.conv.ids.includes(l.id)) continue
      ci.conv.lineas.push({ id: l.id, texto: l.texto.trim(), ...(l.cita ? { cita: true } : {}) })
    }
    ci.silencio = 0
  }

  /** Ya no llegan más líneas: termina cuando se digan las que faltan. */
  cerrar(convId: string, resumen?: string, afinidad?: DeltaAfinidad[]): void {
    const ci = this.convs.get(convId)
    if (!ci) return
    ci.conv.abierta = false
    if (typeof resumen === "string" && resumen.trim()) ci.resumen = resumen.trim()
    if (Array.isArray(afinidad))
      ci.deltas = afinidad.filter((d) => d && typeof d.a === "string" && typeof d.b === "string" && Number.isFinite(d.delta))
    if (!ci.conv.lineas.length) {
      this.terminar(ci)
      this.refrescar()
    }
  }

  /**
   * Salta el reloj a `minutos` (y a `dia`, si viene): cada uno aparece ya en
   * su lugar del horario, sin caminar. Las conversaciones en curso se
   * descartan. Es un corte de montaje: lo usa el estudio (/casa-blanca/estudio)
   * cuando un plano pide otra hora.
   */
  saltarA(minutos: number, dia?: number): void {
    if (!Number.isFinite(minutos)) return
    for (const ci of [...this.convs.values()]) this.descartar(ci)
    if (typeof dia === "number" && Number.isInteger(dia) && dia >= 1) this.reloj.dia = dia
    this.reloj.minutos = normalizarMinutos(minutos)
    const h = this.reloj.minutos / 60
    for (const id of this.ids) {
      const s = this.int[id]
      s.manual = null
      s.entrada = indiceEntrada(s.horario, h)
      this.pj[id].burbuja = null
      this.aplicarHorario(id, true)
    }
    this.marcaHora = this.horaAbsoluta()
    this.refrescar()
  }

  /**
   * Como reunir(), pero ya están ahí: cada uno aparece en su puesto de la
   * ronda, mirando al centro (sin cruzar la casa). Para el estudio: el plano
   * empieza con todos en cuadro.
   */
  reunirYa(lugarId: string, ids: string[], titulo?: string): Conversacion {
    const conv = this.reunir(lugarId, ids, titulo)
    for (const id of conv.ids) {
      const m = this.int[id].meta
      const l = m ? LUGAR[m.lugarId] : undefined
      if (m && l) this.colocar(id, l, copia(m.spot), m.rumbo)
    }
    this.refrescar()
    return conv
  }

  /** Una conversación de guion a mano: si no están en el lugar, van. */
  conversarGuion(lugarId: string, ids: string[], tema?: Tema): Conversacion {
    const l = LUGAR[lugarId] ?? LUGAR[LUGAR_RESERVA]
    const quienes = this.validos(ids)
    if (!quienes.length) return this.convVacia(l.id)
    const g = this.armarGuion(quienes, l, tema && TEMAS.includes(tema) ? tema : undefined)
    for (const id of quienes) {
      this.sacarDeConv(id)
      const s = this.int[id]
      if (s.base === "duerme") s.base = "quieto"
    }
    const conv = this.abrir(l, quienes, { auto: false, lineas: g.lineas, abierta: false, tema: g.tema, formacion: "ancla", espera: ESPERA_REUNION_S, corre: false })
    this.refrescar()
    return conv
  }

  recordar(id: string, texto: string): void {
    const e = this.pj[id]
    if (!e || typeof texto !== "string" || !texto.trim()) return
    e.memoria.unshift({ cuando: this.cuando(), texto: texto.trim() })
    if (e.memoria.length > MEMORIA_MAX) e.memoria.length = MEMORIA_MAX
  }

  /** Quiénes están en un lugar (no cuenta a los que van en camino). */
  presentes(lugarId: string): string[] {
    return this.ids.filter((id) => this.pj[id].lugarId === lugarId)
  }

  serializar(): unknown {
    const pj: Record<string, unknown> = {}
    for (const id of this.ids) {
      const e = this.pj[id]
      pj[id] = {
        lugarId: e.lugarId ?? this.int[id].meta?.lugarId ?? null,
        memoria: e.memoria.map((m) => ({ cuando: m.cuando, texto: m.texto })),
        afinidad: { ...e.afinidad },
      }
    }
    return {
      v: 1,
      reloj: { dia: this.reloj.dia, minutos: this.reloj.minutos, velocidad: this.reloj.velocidad },
      usados: [...this.usados],
      pj,
    }
  }

  /**
   * Carga lo que dejó serializar(). Tolerante: toma cada dato que sea válido e
   * ignora el resto, así un guardado viejo o roto nunca rompe la página. También
   * entiende el formato de la versión anterior ({ dia, min, ag: { id: { mem, rel } } }).
   */
  cargar(datos: unknown): void {
    if (!esObj(datos)) return
    try {
      const rel = esObj(datos.reloj) ? datos.reloj : datos
      const dia = rel.dia
      if (typeof dia === "number" && Number.isInteger(dia) && dia >= 1 && dia < 1e7) this.reloj.dia = dia
      const min = typeof rel.minutos === "number" ? rel.minutos : typeof rel.min === "number" ? rel.min : NaN
      if (Number.isFinite(min)) this.reloj.minutos = normalizarMinutos(min)
      const vel = rel.velocidad
      if (typeof vel === "number" && Number.isFinite(vel) && vel > 0 && vel <= 10000) this.reloj.velocidad = vel
      if (Array.isArray(datos.usados)) this.usados = new Set(datos.usados.filter((x): x is string => typeof x === "string"))
      const todos = esObj(datos.pj) ? datos.pj : esObj(datos.ag) ? datos.ag : {}

      // Lo que estaba en curso no se retoma: las conversaciones se descartan sin dejar recuerdo.
      for (const ci of [...this.convs.values()]) this.descartar(ci)
      const h = this.reloj.minutos / 60
      for (const id of this.ids) {
        const e = this.pj[id]
        const s = this.int[id]
        const g = esObj(todos[id]) ? (todos[id] as Record<string, unknown>) : null
        let guardado: Lugar | undefined
        try {
          if (g) {
            const mem = Array.isArray(g.memoria) ? g.memoria : Array.isArray(g.mem) ? g.mem : null
            if (mem) {
              e.memoria = mem
                .map((m: unknown) => {
                  if (!esObj(m)) return null
                  const texto = typeof m.texto === "string" ? m.texto : typeof m.txt === "string" ? m.txt : ""
                  return texto.trim() ? { cuando: typeof m.cuando === "string" ? m.cuando : "", texto: texto.trim() } : null
                })
                .filter((m): m is { cuando: string; texto: string } => !!m)
                .slice(0, MEMORIA_MAX)
            }
            const af = esObj(g.afinidad) ? g.afinidad : esObj(g.rel) ? g.rel : null
            if (af)
              for (const o of this.ids) {
                const v = af[o]
                if (o !== id && typeof v === "number" && Number.isFinite(v)) e.afinidad[o] = clamp(v, -100, 100)
              }
            if (typeof g.lugarId === "string") guardado = LUGAR[g.lugarId]
          }
        } catch {
          // Un personaje con datos rotos no arrastra a los demás.
        }
        e.burbuja = null
        s.manual = null
        s.entrada = indiceEntrada(s.horario, h)
        const ent = s.horario[s.entrada]
        if (guardado && (!ent || ent[1] !== guardado.id)) {
          // Aparece donde estaba y, si su horario dice otra cosa, camina hacia allá.
          this.colocar(id, guardado, this.puntoDeLlegada(guardado, id), null)
          this.aplicarHorario(id)
        } else this.aplicarHorario(id, true)
      }
      this.marcaHora = this.horaAbsoluta()
      this.refrescar()
    } catch {
      // Datos rotos: queda lo que ya se pudo cargar.
    }
  }

  // ── El paso ──

  private paso(dt: number, ahora: number) {
    this.ahora = ahora
    this.limpiarBurbujas()
    if (this.reloj.pausa) {
      for (const id of this.ids) this.pj[id].velocidad = 0
      return
    }
    const v = Number.isFinite(this.reloj.velocidad) && this.reloj.velocidad > 0 ? this.reloj.velocidad : 0
    this.tReal += dt
    this.avanzarReloj(dt * v * MIN_POR_S)
    this.revisarHorarios()
    const dtMov = dt * Math.sqrt(v)
    for (const id of this.ids) {
      this.mover(id, dtMov)
      this.vagar(id, dtMov)
    }
    this.avanzarConversaciones(dt, v)
    this.relojConv += dt
    if (this.relojConv >= CADA_CONV_S) {
      this.relojConv = 0
      this.intentarConversar()
    }
    this.relojPensar += dt
    if (this.relojPensar >= CADA_PENSAR_S) {
      this.relojPensar = 0
      this.pensar()
    }
    for (const id of this.ids) this.actualizarVista(id, v)
  }

  private horaAbsoluta() {
    return this.reloj.dia * 24 + Math.floor(this.reloj.minutos / 60)
  }

  private avanzarReloj(min: number) {
    const r = this.reloj
    if (!Number.isFinite(r.minutos)) r.minutos = 0
    if (!Number.isInteger(r.dia) || r.dia < 1) r.dia = 1
    r.minutos += min
    while (r.minutos >= 1440) {
      r.minutos -= 1440
      r.dia += 1
      this.usados.clear()
      this.emitir({ tipo: "aviso", texto: `Empieza el día ${r.dia} en la Casa Blanca.` })
    }
    while (r.minutos < 0) r.minutos += 1440
    const marca = this.horaAbsoluta()
    if (marca !== this.marcaHora) {
      this.marcaHora = marca
      this.emitir({ tipo: "hora", dia: r.dia, minutos: r.minutos })
    }
  }

  /** Al cambiar la entrada del horario, cada uno va a la suya; si está conversando, termina primero. */
  private revisarHorarios() {
    const h = this.reloj.minutos / 60
    for (const id of this.ids) {
      const s = this.int[id]
      const k = indiceEntrada(s.horario, h)
      if (k === s.entrada) continue
      s.entrada = k
      s.manual = null
      if (!this.pj[id].conversacionId) this.aplicarHorario(id)
    }
  }

  private aplicarHorario(id: string, forzar = false) {
    const e = this.pj[id]
    const s = this.int[id]
    if (e.conversacionId && !forzar) return
    const ent = s.horario[s.entrada]
    let lugarId: string
    let actividad: string
    let marca: EntradaHorario[3]
    if (s.manual) {
      lugarId = s.manual.lugarId
      actividad = s.manual.actividad
      marca = undefined
    } else if (ent) {
      lugarId = ent[1]
      actividad = ent[2]
      marca = ent[3]
    } else if (forzar) {
      lugarId = LUGAR_RESERVA
      actividad = ""
      marca = undefined
    } else return
    let l = LUGAR[lugarId]
    if (!l) {
      this.avisarDato(`${id}: el lugar "${lugarId}" de su horario no existe en lugares.ts`)
      if (!forzar) return
      l = LUGAR[LUGAR_RESERVA] ?? Object.values(LUGAR)[0]
    }
    e.actividad = actividad
    s.fantasma = marca === "fantasma"
    s.base = estadoBase(s.p, l, actividad, marca)
    s.ritmo = s.base === "corre" ? "corre" : "paso"
    const esc = marca === "trabaja" ? escritorioDe(s.p, this.personajes) : null
    // En una sala con sillas (el Comedor de Estado), el que se sienta toma una silla libre.
    const escritorio = esc && esc.lugarId === l.id ? esc : s.base === "sentado" && l.asientos?.length ? this.asientoLibre(l, id) : null
    // Adentro nadie se sienta en el aire: sin silla, de pie.
    if (s.base === "sentado" && l.planta && !escritorio) s.base = "quieto"
    if (forzar) {
      this.colocar(id, l, escritorio ? copia(escritorio.pos) : this.puntoDeLlegada(l, id), escritorio ? escritorio.rumbo : null)
      return
    }
    if (s.zona === l.id && !s.viaje) {
      // Ya está ahí: solo cambia lo que hace (y, si trabaja, vuelve a su escritorio).
      if (escritorio) {
        if (s.ruta.length || distXZ(e.pos, escritorio.pos) > 0.05) this.planear(id, l, copia(escritorio.pos), escritorio.rumbo)
        else {
          e.rumbo = escritorio.rumbo
          s.meta = { lugarId: l.id, spot: copia(escritorio.pos), rumbo: escritorio.rumbo }
        }
      }
      return
    }
    this.planear(id, l, escritorio ? copia(escritorio.pos) : this.puntoDeLlegada(l, id), escritorio ? escritorio.rumbo : null)
    // Si a paso normal no llega a tiempo para hacer lo suyo, se apura o corre.
    if (s.ritmo === "paso" && !s.manual) s.ritmo = this.ritmoParaLlegar(id)
  }

  private ritmoParaLlegar(id: string): Ritmo {
    const s = this.int[id]
    const v = this.reloj.velocidad
    if (!(v > 0) || s.horario.length < 2) return "paso"
    let largo = 0
    let oculto = 0
    let ascensores = 0
    let prev = this.pj[id].pos
    for (const t of s.ruta) {
      if (t.ascensor) ascensores++
      else if (t.oculto) oculto += dist3(prev, t.p)
      else largo += dist3(prev, t.p)
      prev = t.p
    }
    const m = this.reloj.minutos
    let proxima = Infinity
    for (const ent of s.horario) {
      const em = ent[0] * 60
      if (em > m + 1e-6) proxima = Math.min(proxima, em)
    }
    if (proxima === Infinity) proxima = s.horario[0][0] * 60 + 1440
    const disponibles = UMBRAL_TARDE * ((proxima - m) / (v * MIN_POR_S))
    const fijo = oculto / VEL_OCULTO + ascensores * ASCENSOR_S
    const llega = (vel: number) => (largo / vel + fijo) / Math.sqrt(v) <= disponibles
    return llega(VEL_CAMINA) ? "paso" : llega(VEL_APURADO) ? "apurado" : "corre"
  }

  // ── Movimiento ──

  private colocar(id: string, l: Lugar, spot: Vec3, rumbo: number | null) {
    const e = this.pj[id]
    const s = this.int[id]
    e.pos.x = spot.x
    e.pos.y = spot.y
    e.pos.z = spot.z
    if (rumbo != null) e.rumbo = rumbo
    e.nivel = l.nivel
    e.planta = l.planta ?? null
    s.ruta = []
    s.inicioTramo = null
    s.ascDesde = null
    s.ascT = 0
    s.zona = l.id
    s.viaje = false
    s.nodo = l.acceso
    s.meta = { lugarId: l.id, spot: copia(spot), rumbo }
  }

  /** Arma el recorrido hasta `spot` dentro de `l`: salir de donde está, A* hasta el acceso, y entrar. */
  private planear(id: string, l: Lugar, spot: Vec3, rumbo: number | null) {
    const e = this.pj[id]
    const s = this.int[id]
    s.meta = { lugarId: l.id, spot, rumbo }
    if (s.zona === l.id) {
      s.ruta = this.tramosDentro(e.pos, spot, l)
      s.viaje = false
      s.ascDesde = null
      s.ascT = 0
      return
    }
    const ruta: Tramo[] = []
    let inicio: string
    const actual = s.ruta[0]
    if (s.viaje && !s.zona && actual && actual.nodo) {
      // En pleno camino: el tramo en curso se termina (un ascensor nunca se corta a la mitad).
      const t: Tramo = { ...actual }
      delete t.entra
      ruta.push(t)
      inicio = actual.nodo
    } else {
      s.ascDesde = null
      s.ascT = 0
      const z = s.zona ? LUGAR[s.zona] : undefined
      const acc = z ? NODO[z.acceso] : undefined
      if (z && acc) {
        const salida = this.tramosDentro(e.pos, acc.p, z)
        const fin = salida[salida.length - 1]
        fin.nodo = acc.id
        fin.oculto = fin.oculto || !!acc.oculto
        fin.nivel = acc.nivel
        fin.planta = acc.planta ?? null
        ruta.push(...salida)
        inicio = acc.id
      } else {
        inicio = s.nodo && NODO[s.nodo] ? s.nodo : nodoCercano(e.pos, e.nivel)
        const n = NODO[inicio]
        ruta.push({ p: copia(n.p), nodo: n.id, ascensor: false, oculto: !!n.oculto, nivel: n.nivel, planta: n.planta ?? null })
      }
    }
    const camino = caminoEntre(inicio, l.acceso)
    if (!camino) {
      // Sin camino en el grafo (no debería pasar): aparece allí antes que quedar trabado.
      this.avisarDato(`no hay camino de "${inicio}" a "${l.acceso}" en el grafo`)
      this.colocar(id, l, spot, rumbo)
      return
    }
    for (let i = 1; i < camino.length; i++) {
      const a = NODO[camino[i - 1]]
      const b = NODO[camino[i]]
      const f = ARISTA.get(`${a.id}|${b.id}`) ?? { ascensor: false, interior: false }
      ruta.push({
        p: copia(b.p),
        nodo: b.id,
        ascensor: f.ascensor,
        oculto: f.ascensor || f.interior || !!a.oculto || !!b.oculto,
        nivel: b.nivel,
        planta: b.planta ?? null,
      })
    }
    ruta[ruta.length - 1].entra = l.id
    ruta.push(...this.tramosDentro(NODO[l.acceso].p, spot, l))
    s.ruta = ruta
    s.viaje = true
  }

  private tramosDentro(desde: Vec3, hasta: Vec3, l: Lugar): Tramo[] {
    const planta = l.planta ?? null
    if (l.planta) {
      // En una sala: por el piso de la sala, rodeando los muebles.
      const c = CUARTO_DE_LUGAR.get(l.id)
      const dentro = (x: number, z: number) => (c ? dentroDeCuarto(c, x, z, 0.35) : true)
      return rodear(desde, hasta, l.obst ?? [], dentro, l.y).map((p) => ({ p, nodo: null, ascensor: false, oculto: false, nivel: l.nivel, planta }))
    }
    const obst = usaObstaculos(l) ? CIRCULOS : []
    return esquivar(desde, hasta, obst, l.y).map((p) => ({ p, nodo: null, ascensor: false, oculto: oculto(l), nivel: l.nivel, planta }))
  }

  private mover(id: string, dtMov: number) {
    const e = this.pj[id]
    const s = this.int[id]
    let tiempo = dtMov
    let vueltas = 0
    while (s.ruta.length && tiempo > 1e-9 && vueltas++ < 200) {
      const w = s.ruta[0]
      if (w.ascensor) {
        if (!s.ascDesde) {
          s.ascDesde = copia(e.pos)
          s.ascT = 0
        }
        const usa = Math.max(0, Math.min(ASCENSOR_S - s.ascT, tiempo))
        s.ascT += usa
        tiempo -= usa
        const k = Math.min(1, s.ascT / ASCENSOR_S)
        e.pos.x = s.ascDesde.x + (w.p.x - s.ascDesde.x) * k
        e.pos.y = s.ascDesde.y + (w.p.y - s.ascDesde.y) * k
        e.pos.z = s.ascDesde.z + (w.p.z - s.ascDesde.z) * k
        e.nivel = nivelPorAltura(e.pos.y)
        if (s.ascT >= ASCENSOR_S - 1e-9) {
          s.ascDesde = null
          s.ascT = 0
          s.ruta.shift()
          s.inicioTramo = null
          e.planta = w.planta
          this.alcanzar(id, w)
        }
      } else {
        const vel = velTramo(w, s.ritmo)
        if (!s.inicioTramo) s.inicioTramo = copia(e.pos)
        const dx = w.p.x - e.pos.x
        const dy = w.p.y - e.pos.y
        const dz = w.p.z - e.pos.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dx * dx + dz * dz > 1e-8) e.rumbo = Math.atan2(dx, dz)
        const alcance = vel * tiempo
        if (d <= alcance) {
          e.pos.x = w.p.x
          e.pos.y = w.p.y
          e.pos.z = w.p.z
          tiempo -= d / vel
          s.ruta.shift()
          s.inicioTramo = null
          e.planta = w.planta
          this.alcanzar(id, w)
        } else {
          const k = alcance / d
          e.pos.x += dx * k
          e.pos.y += dy * k
          e.pos.z += dz * k
          tiempo = 0
          // Entre dos plantas (una puerta a la calle), cambia en el vano: a mitad del tramo.
          if (e.planta !== w.planta && dist3(e.pos, w.p) <= dist3(s.inicioTramo, w.p) / 2) e.planta = w.planta
        }
      }
    }
  }

  private alcanzar(id: string, w: Tramo) {
    const e = this.pj[id]
    const s = this.int[id]
    if (w.nodo) {
      s.nodo = w.nodo
      e.nivel = w.nivel
      // Llegó al acceso del lugar que dejaba: ya está en camino.
      if (s.viaje && s.zona) s.zona = null
    }
    if (w.entra && LUGAR[w.entra]) {
      s.zona = w.entra
      s.viaje = false
      e.nivel = LUGAR[w.entra].nivel
    }
    if (!s.ruta.length) this.llegar(id)
  }

  private llegar(id: string) {
    const e = this.pj[id]
    const s = this.int[id]
    if (s.meta && s.meta.rumbo != null) e.rumbo = s.meta.rumbo
    s.ritmo = s.base === "corre" ? "corre" : "paso"
    const ci = e.conversacionId ? this.convs.get(e.conversacionId) : undefined
    if (ci) this.orientar(ci)
  }

  /** Deambula cada tanto dentro de su lugar; el que corre, da vueltas sin parar. */
  private vagar(id: string, dtMov: number) {
    const e = this.pj[id]
    const s = this.int[id]
    if (s.ruta.length || s.viaje || !s.zona || e.conversacionId || dtMov <= 0) return
    const l = LUGAR[s.zona]
    if (!l || oculto(l)) return
    if (s.base === "corre") {
      s.ritmo = "corre"
      this.planear(id, l, this.puntoLibre(l, id), null)
      return
    }
    if (s.base !== "quieto" && s.base !== "deporte") return
    s.vagar -= dtMov
    if (s.vagar > 0) return
    const deporte = s.base === "deporte"
    s.vagar = deporte ? 3 + this.rand() * 5 : 6 + this.rand() * 10
    if (this.rand() < 0.6) {
      s.ritmo = "paso"
      this.planear(id, l, this.puntoLibre(l, id, { p: e.pos, radio: deporte ? 5 : 8 }), null)
    }
  }

  private puntoDeLlegada(l: Lugar, yo: string): Vec3 {
    const acc = NODO[l.acceso]
    return this.puntoLibre(l, yo, acc ? { p: acc.p, radio: RADIO_LLEGADA } : undefined)
  }

  /** Un punto libre dentro del lugar: a 1 m o más de los demás y de los escritorios ajenos. */
  /** Una de las zonas de la sala, con probabilidad según su área. */
  private zonaAlAzar(zonas: Rect[]): Rect {
    const area = (r: Rect) => Math.max(0.01, (r.x1 - r.x0) * (r.z1 - r.z0))
    let t = this.rand() * zonas.reduce((s, r) => s + area(r), 0)
    for (const r of zonas) {
      t -= area(r)
      if (t <= 0) return r
    }
    return zonas[zonas.length - 1]
  }

  /** Una silla libre de la sala: nadie sentado ni yendo a ella. Sin sillas libres, null (se queda de pie). */
  private asientoLibre(l: Lugar, yo: string): { lugarId: string; pos: Vec3; rumbo: number } | null {
    const as = l.asientos ?? []
    if (!as.length) return null
    const k0 = Math.floor(this.rand() * as.length)
    for (let i = 0; i < as.length; i++) {
      const a = as[(k0 + i) % as.length]
      const p = { x: a.x, y: l.y, z: a.z }
      if (this.holgura(l, p, yo) >= 0.45) return { lugarId: l.id, pos: p, rumbo: a.rumbo }
    }
    return null
  }

  private puntoLibre(l: Lugar, yo: string, cerca?: { p: Vec3; radio: number }): Vec3 {
    const a = l.zonas?.length ? this.zonaAlAzar(l.zonas) : areaLibre(l)
    let mejor: Vec3 | null = null
    let mejorD = -1
    for (let i = 0; i < 24; i++) {
      let x: number
      let z: number
      if (cerca) {
        const ang = this.rand() * Math.PI * 2
        const r = Math.sqrt(this.rand()) * cerca.radio
        x = clamp(cerca.p.x + Math.sin(ang) * r, a.x0, a.x1)
        z = clamp(cerca.p.z + Math.cos(ang) * r, a.z0, a.z1)
      } else {
        x = a.x0 + this.rand() * (a.x1 - a.x0)
        z = a.z0 + this.rand() * (a.z1 - a.z0)
      }
      const p = { x, y: l.y, z }
      if (enObstaculo(l, p, 1)) continue
      const d = this.holgura(l, p, yo)
      if (d >= SEPARACION + 0.2) return p
      if (d > mejorD) {
        mejorD = d
        mejor = p
      }
    }
    return mejor ?? { x: (a.x0 + a.x1) / 2, y: l.y, z: (a.z0 + a.z1) / 2 }
  }

  /** Distancia al más cercano: los que están ahí, los que van hacia ahí y los escritorios reservados. */
  private holgura(l: Lugar, p: Vec3, yo: string) {
    let d = Infinity
    for (const id of this.ids) {
      if (id === yo) continue
      const e = this.pj[id]
      if (Math.abs(e.pos.y - p.y) < 2) d = Math.min(d, distXZ(e.pos, p))
      const m = this.int[id].meta
      if (m && m.lugarId === l.id) d = Math.min(d, distXZ(m.spot, p))
    }
    for (const esc of this.escritorios[l.id] ?? []) if (esc.id !== yo) d = Math.min(d, distXZ(esc.pos, p))
    return d
  }

  /** Deja `pj` al día después de una llamada de la interfaz (sin esperar al próximo paso). */
  private refrescar() {
    const v = Number.isFinite(this.reloj.velocidad) && this.reloj.velocidad > 0 ? this.reloj.velocidad : 0
    for (const id of this.ids) this.actualizarVista(id, v)
  }

  private actualizarVista(id: string, v: number) {
    const e = this.pj[id]
    const s = this.int[id]
    const w = s.ruta[0]
    if (w) {
      e.visible = !w.oculto
      if (w.ascensor) {
        e.estado = "ascensor"
        e.velocidad = 0
      } else {
        e.estado = s.ritmo === "corre" ? "corre" : "camina"
        e.velocidad = velTramo(w, s.ritmo) * Math.sqrt(v)
      }
    } else {
      const l = s.zona ? LUGAR[s.zona] : undefined
      const nodo = s.nodo ? NODO[s.nodo] : undefined
      e.visible = l ? !oculto(l) : !nodo?.oculto
      e.velocidad = 0
      const ci = e.conversacionId ? this.convs.get(e.conversacionId) : undefined
      e.estado = ci && !ci.esperando ? "habla" : s.base === "corre" ? "quieto" : s.base
    }
    e.lugarId = s.viaje ? null : s.zona
    e.destinoId = s.meta?.lugarId ?? e.lugarId
  }

  // ── Conversaciones ──

  private validos(ids: string[]) {
    if (!Array.isArray(ids)) return []
    return [...new Set(ids.filter((id) => typeof id === "string" && !!this.pj[id]))]
  }

  private convVacia(lugarId: string, titulo?: string): Conversacion {
    return { id: `c${++this.contador}`, lugarId, ids: [], lineas: [], i: 0, abierta: false, ...(titulo ? { titulo } : {}) }
  }

  private abrir(l: Lugar, ids: string[], op: OpcionesConv): Conversacion {
    for (const id of ids) this.sacarDeConv(id)
    const conv: Conversacion = {
      id: `c${++this.contador}`,
      lugarId: l.id,
      ids: [...ids],
      lineas: op.lineas,
      i: 0,
      abierta: op.abierta,
      ...(op.titulo ? { titulo: op.titulo } : {}),
    }
    const ci: ConvInterna = {
      conv,
      esperando: true,
      limite: op.espera,
      t: 0.6,
      auto: op.auto,
      tema: op.tema,
      resumen: null,
      deltas: [],
      silencio: 0,
      centro: null,
    }
    this.formar(ci, l, op.formacion, op.corre)
    for (const id of ids) this.pj[id].conversacionId = conv.id
    this.convs.set(conv.id, ci)
    this.conversaciones.push(conv)
    return conv
  }

  /** Dónde se para cada uno para conversar: cerca, sin pisarse, mirándose. */
  private formar(ci: ConvInterna, l: Lugar, modo: "ancla" | "centro", corre: boolean) {
    const ids = ci.conv.ids
    const adentro = (id: string) => !this.int[id].viaje && this.int[id].zona === l.id
    if (modo === "ancla") {
      const quieto = (id: string) => adentro(id) && !this.int[id].ruta.length
      const ancla = ids.find((id) => quieto(id) && this.int[id].base === "sentado") ?? ids.find(quieto) ?? ids.find(adentro)
      if (ancla) {
        const sa = this.int[ancla]
        // El ancla se queda donde está (si estaba dando un paso, se detiene).
        if (sa.ruta.length) sa.ruta = []
        const centro = copia(this.pj[ancla].pos)
        const tomados: Vec3[] = [centro]
        for (const id of ids) {
          if (id === ancla) continue
          const e = this.pj[id]
          if (quieto(id) && distXZ(e.pos, centro) <= CERCA_CHARLA) {
            tomados.push(copia(e.pos))
            continue
          }
          const spot = this.puestoEnAnillo(l, centro, e.pos, tomados, 1.5, id)
          tomados.push(spot)
          this.int[id].ritmo = corre ? "corre" : "paso"
          this.planear(id, l, spot, null)
        }
        ci.centro = centro
        return
      }
    }
    const n = ids.length
    const radio = Math.max(ANILLO_MIN[l.id] ?? 0, n <= 1 ? 0 : Math.max(1.2, 0.62 / Math.sin(Math.PI / n)))
    const centro = this.puntoDeReunion(l, radio)
    // Cada uno toma el lugar del anillo que le queda de su lado: nadie cruza por el medio.
    const angulo = (id: string) => Math.atan2(this.pj[id].pos.x - centro.x, this.pj[id].pos.z - centro.z)
    const orden = [...ids].sort((a, b) => angulo(a) - angulo(b))
    const a0 = n ? angulo(orden[0]) : 0
    orden.forEach((id, k) => {
      const ang = a0 + (k * Math.PI * 2) / Math.max(1, n)
      const spot = { x: centro.x + Math.sin(ang) * radio, y: l.y, z: centro.z + Math.cos(ang) * radio }
      this.int[id].ritmo = corre ? "corre" : "paso"
      this.planear(id, l, spot, Math.atan2(centro.x - spot.x, centro.z - spot.z))
    })
    ci.centro = centro
  }

  private puestoEnAnillo(l: Lugar, centro: Vec3, desde: Vec3, tomados: Vec3[], radio: number, yo: string): Vec3 {
    const base = Math.atan2(desde.x - centro.x, desde.z - centro.z)
    for (const r of [radio, radio + 0.8, radio + 1.6]) {
      for (let k = 0; k < 12; k++) {
        const ang = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6)
        const p = { x: centro.x + Math.sin(ang) * r, y: l.y, z: centro.z + Math.cos(ang) * r }
        if (p.x < l.x0 + 0.5 || p.x > l.x1 - 0.5 || p.z < l.z0 + 0.5 || p.z > l.z1 - 0.5) continue
        if (enObstaculo(l, p, 0.6)) continue
        if (tomados.some((t) => distXZ(t, p) < SEPARACION + 0.1)) continue
        if (this.holgura(l, p, yo) < SEPARACION) continue
        return p
      }
    }
    return { x: clamp(centro.x + radio, l.x0 + 0.5, l.x1 - 0.5), y: l.y, z: centro.z }
  }

  /** El centro del anillo de una reunión: el del lugar o, si cae en un obstáculo, el más cercano que entre. */
  private puntoDeReunion(l: Lugar, radio: number): Vec3 {
    const cx = (l.x0 + l.x1) / 2
    const cz = l.tipo === "departamento" ? l.z0 + 5 + radio : (l.z0 + l.z1) / 2
    const entra = (x: number, z: number) => {
      for (let k = 0; k < 16; k++) {
        const ang = (k * Math.PI) / 8
        const p = { x: x + Math.sin(ang) * radio, z: z + Math.cos(ang) * radio }
        if (p.x < l.x0 + 0.4 || p.x > l.x1 - 0.4 || p.z < l.z0 + 0.4 || p.z > l.z1 - 0.4) return false
        if (enObstaculo(l, p, 0.5)) return false
      }
      return radio > 0 || !enObstaculo(l, { x, z }, 0.5)
    }
    if (entra(cx, cz)) return { x: cx, y: l.y, z: cz }
    const candidatos: Array<{ x: number; z: number; d: number }> = []
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++) {
        const x = l.x0 + ((l.x1 - l.x0) * i) / 10
        const z = l.z0 + ((l.z1 - l.z0) * j) / 10
        candidatos.push({ x, z, d: Math.hypot(x - cx, z - cz) })
      }
    candidatos.sort((a, b) => a.d - b.d)
    const ok = candidatos.find((c) => entra(c.x, c.z))
    return ok ? { x: ok.x, y: l.y, z: ok.z } : { x: cx, y: l.y, z: cz }
  }

  /** Los que conversan se miran: cada uno al centro de los demás. */
  private orientar(ci: ConvInterna) {
    for (const id of ci.conv.ids) {
      if (this.int[id].ruta.length) continue
      const otros = ci.conv.ids.filter((o) => o !== id)
      if (!otros.length) continue
      this.mirarA(id, this.centroDe(otros))
    }
  }

  private centroDe(ids: string[]) {
    let x = 0
    let z = 0
    for (const id of ids) {
      x += this.pj[id].pos.x
      z += this.pj[id].pos.z
    }
    return { x: x / ids.length, z: z / ids.length }
  }

  private mirarA(id: string, p: { x: number; z: number }) {
    const e = this.pj[id]
    const dx = p.x - e.pos.x
    const dz = p.z - e.pos.z
    if (dx * dx + dz * dz > 1e-6) e.rumbo = Math.atan2(dx, dz)
  }

  private avanzarConversaciones(dt: number, v: number) {
    for (const ci of [...this.convs.values()]) {
      if (!this.convs.has(ci.conv.id)) continue
      const conv = ci.conv
      if (ci.esperando) {
        ci.limite -= dt
        const listos = conv.ids.every((id) => !this.int[id].ruta.length)
        if (!listos && ci.limite > 0) continue
        ci.esperando = false
        ci.t = Math.min(ci.t, 0.4)
        this.orientar(ci)
      }
      const factor = ci.auto ? Math.sqrt(Math.max(1, v)) : 1
      ci.t -= dt * factor
      if (ci.t > 0) continue
      if (conv.i < conv.lineas.length) {
        const l = conv.lineas[conv.i++]
        if (!conv.ids.includes(l.id)) {
          ci.t = 0
          continue
        }
        const dur = durLinea(l.texto)
        const e = this.pj[l.id]
        e.burbuja = { texto: l.texto, hasta: this.ahora + (dur / factor) * 1000, tipo: "dice" }
        const otros = conv.ids.filter((o) => o !== l.id)
        for (const o of otros) if (!this.int[o].ruta.length) this.mirarA(o, e.pos)
        if (otros.length && !this.int[l.id].ruta.length) this.mirarA(l.id, this.centroDe(otros))
        this.anotarReciente(l.id, l.texto)
        ci.t = dur
        ci.silencio = 0
        this.emitir({ tipo: "linea", conv, linea: l, lugarId: conv.lugarId })
      } else if (!conv.abierta) this.terminar(ci)
      else {
        ci.silencio += dt
        if (ci.silencio > SILENCIO_MAX_S) {
          conv.abierta = false
          this.terminar(ci)
        }
      }
    }
  }

  private terminar(ci: ConvInterna) {
    const conv = ci.conv
    if (!this.convs.has(conv.id)) return
    this.quitar(conv.id)
    const l = LUGAR[conv.lugarId]
    const hubo = conv.i > 0 || !!ci.resumen
    for (const id of conv.ids) {
      const e = this.pj[id]
      const s = this.int[id]
      if (e.conversacionId === conv.id) e.conversacionId = null
      s.libreDesde = this.tReal + DESCANSO_CONV_S
      if (hubo) {
        const otros = conv.ids.filter((o) => o !== id)
        const nombres = otros.map((o) => this.int[o].p.corto || o)
        const donde = l ? ` en ${l.nombre}` : ""
        const texto = ci.resumen
          ? `${conv.titulo ? `${conv.titulo}: ` : ""}${ci.resumen}`
          : conv.titulo
            ? `${conv.titulo}, con ${lista(nombres)}${donde}.`
            : `Hablé con ${lista(nombres)} ${ci.tema ? `sobre ${NOMBRE_TEMA[ci.tema]}` : "de lo que nos une y nos separa"}${donde}.`
        if (otros.length || ci.resumen) this.recordar(id, texto)
        for (const o of otros) {
          const d = ci.deltas.find((x) => x.a === id && x.b === o) ?? ci.deltas.find((x) => x.a === o && x.b === id)
          const delta = d ? clamp(Number(d.delta) || 0, -10, 10) : Math.round(-2 + this.rand() * 7)
          e.afinidad[o] = clamp((e.afinidad[o] ?? AFINIDAD_INICIAL) + delta, -100, 100)
        }
      }
    }
    // Termina la conversación y cada uno sigue con su horario.
    for (const id of conv.ids) if (!this.pj[id].conversacionId) this.aplicarHorario(id)
  }

  /** Cierra una conversación sin recuerdo ni afinidad (al cargar un guardado). */
  private descartar(ci: ConvInterna) {
    this.quitar(ci.conv.id)
    for (const id of ci.conv.ids) if (this.pj[id] && this.pj[id].conversacionId === ci.conv.id) this.pj[id].conversacionId = null
  }

  private quitar(convId: string) {
    this.convs.delete(convId)
    const k = this.conversaciones.findIndex((c) => c.id === convId)
    if (k >= 0) this.conversaciones.splice(k, 1)
  }

  /** Lo saca de la conversación en la que esté. Una charla de guion con menos de dos se termina. */
  private sacarDeConv(id: string) {
    const e = this.pj[id]
    const cid = e?.conversacionId
    if (!cid) return
    e.conversacionId = null
    const ci = this.convs.get(cid)
    if (!ci) return
    ci.conv.ids = ci.conv.ids.filter((x) => x !== id)
    if (!ci.conv.ids.length || (ci.auto && ci.conv.ids.length < 2)) this.terminar(ci)
  }

  private puedeCharlar(id: string) {
    const e = this.pj[id]
    const s = this.int[id]
    if (!e.visible || e.conversacionId || s.ruta.length || s.viaje || !s.zona) return false
    const l = LUGAR[s.zona]
    if (!l || oculto(l)) return false
    return s.base !== "duerme" && s.base !== "corre" && !s.fantasma && this.tReal >= s.libreDesde
  }

  /** Charlas de guion: dos o más despiertos y quietos en un lugar visible. */
  private intentarConversar() {
    const porLugar = new Map<string, string[]>()
    for (const id of this.ids) {
      if (!this.puedeCharlar(id)) continue
      const z = this.int[id].zona!
      const lst = porLugar.get(z)
      if (lst) lst.push(id)
      else porLugar.set(z, [id])
    }
    for (const [lugarId, ids] of porLugar) {
      if (ids.length < 2) continue
      if ((this.enfriaLugar[lugarId] ?? 0) > this.tReal && ids.length < GENTE_PARA_OTRO_GRUPO) continue
      if (this.rand() > PROB_CONV) continue
      const grupo = this.elegirGrupo(ids)
      if (!grupo) continue
      const l = LUGAR[lugarId]
      const g = this.armarGuion(grupo, l)
      if (!g.lineas.length) continue
      this.abrir(l, grupo, { auto: true, lineas: g.lineas, abierta: false, tema: g.tema, formacion: "ancla", espera: ESPERA_GUION_S, corre: false })
      this.enfriaLugar[lugarId] = this.tReal + ENFRIA_LUGAR_S
    }
  }

  /** Las conversaciones especiales que todavía no se dijeron hoy tienen prioridad. */
  private elegirGrupo(ids: string[]): string[] | null {
    const aqui = new Set(ids)
    const especiales: string[][] = []
    for (const clave of Object.keys(this.especiales)) {
      if (this.usados.has(clave)) continue
      const lineas = this.especiales[clave]
      if (!Array.isArray(lineas) || !lineas.length) continue
      const miembros = clave.split("|")
      if (miembros.length < 2 || !miembros.every((m) => aqui.has(m))) continue
      if (miembros.some((m) => distXZ(this.pj[m].pos, this.pj[miembros[0]].pos) > RADIO_CHARLA)) continue
      especiales.push(miembros)
    }
    if (especiales.length && this.rand() < PROB_ESPECIAL) return this.elegir(especiales)
    const mezcla = this.barajar(ids)
    const ancla = mezcla[0]
    const cerca = mezcla.slice(1).filter((id) => distXZ(this.pj[id].pos, this.pj[ancla].pos) <= RADIO_CHARLA)
    if (!cerca.length) return null
    const n = cerca.length >= 2 && this.rand() < 0.25 ? 3 : 2
    return [ancla, ...cerca.slice(0, n - 1)]
  }

  /** Las líneas de guion: una especial si la hay (y no se dijo hoy), o una por cabeza sobre un tema del lugar, y a veces una réplica. */
  private armarGuion(ids: string[], l: Lugar, temaForzado?: Tema): { lineas: LineaConv[]; tema: Tema | null } {
    const clave = claveDe(ids)
    const esp = this.especiales[clave]
    if (!temaForzado && Array.isArray(esp) && esp.length && !this.usados.has(clave)) {
      this.usados.add(clave)
      const lineas = esp
        .filter((x) => Array.isArray(x) && ids.includes(x[0]) && typeof x[1] === "string" && x[1].trim())
        .map(([id, t]) => ({ id, texto: t.trim() }))
      if (lineas.length) return { lineas, tema: null }
    }
    const temas = temasDe(l)
    const tema = temaForzado ?? (this.rand() < 0.7 && temas.length ? this.elegir(temas) : this.elegir(TEMAS))
    const lineas: LineaConv[] = []
    for (const id of ids) {
      const p = this.int[id].p
      const delTema = p.temas?.[tema]
      const fuente = delTema && delTema.length ? delTema : Array.isArray(p.pensamientos) ? p.pensamientos : []
      const l2 = this.elegirSinRepetir(id, fuente.map(aTexto))
      if (l2) lineas.push({ id, texto: l2.texto, ...(l2.cita ? { cita: true } : {}) })
    }
    if (ids.length >= 2 && lineas.length && this.rand() < 0.5) {
      const r = this.elegirSinRepetir(ids[0], (Array.isArray(this.int[ids[0]].p.replicas) ? this.int[ids[0]].p.replicas : []).map(aTexto))
      if (r) lineas.push({ id: ids[0], texto: r.texto })
    }
    return { lineas, tema }
  }

  /** Pensamientos sueltos: burbuja "piensa" sobre alguien quieto y a la vista. */
  private pensar() {
    const libres = this.ids.filter((id) => {
      const e = this.pj[id]
      const s = this.int[id]
      return e.visible && !e.conversacionId && !s.ruta.length && s.base !== "duerme" && !e.burbuja
    })
    if (!libres.length || this.rand() >= PROB_PENSAR) return
    const id = this.elegir(libres)
    const e = this.pj[id]
    const p = this.int[id].p
    const opciones = (Array.isArray(p.pensamientos) ? p.pensamientos : []).map(aTexto)
    if (e.actividad.trim()) opciones.push({ texto: conPunto(e.actividad.trim()) })
    const l = this.elegirSinRepetir(id, opciones)
    if (l) e.burbuja = { texto: l.texto, hasta: this.ahora + PENSAR_MS, tipo: "piensa" }
  }

  // ── Varios ──

  private elegirSinRepetir(id: string, opciones: Array<{ texto: string; cita?: boolean }>) {
    const validas = opciones.filter((o) => o.texto)
    if (!validas.length) return null
    const recientes = this.int[id].recientes
    const nuevas = validas.filter((o) => !recientes.includes(o.texto))
    const o = this.elegir(nuevas.length ? nuevas : validas)
    this.anotarReciente(id, o.texto)
    return o
  }

  private anotarReciente(id: string, texto: string) {
    const r = this.int[id].recientes
    if (r[0] === texto) return
    r.unshift(texto)
    if (r.length > 8) r.length = 8
  }

  private elegir<T>(xs: T[]): T {
    return xs[Math.floor(this.rand() * xs.length)]
  }

  private barajar<T>(xs: T[]): T[] {
    const a = [...xs]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  private cuando() {
    const m = Math.floor(this.reloj.minutos)
    return `Día ${this.reloj.dia}, ${dos(Math.floor(m / 60))}:${dos(m % 60)}`
  }

  private limpiarBurbujas() {
    for (const id of this.ids) {
      const b = this.pj[id].burbuja
      if (b && b.hasta <= this.ahora) this.pj[id].burbuja = null
    }
  }

  private emitir(ev: EventoSim) {
    for (const fn of [...this.oyentes]) {
      try {
        fn(ev)
      } catch (err) {
        // Un oyente roto (la interfaz) no puede frenar el mundo.
        console.error("casa-blanca/simulacion: un oyente falló", err)
      }
    }
  }

  /** Un dato mal escrito (un lugar que no existe) se avisa una vez en la consola, para que se corrija. */
  private avisarDato(texto: string) {
    if (this.avisados.has(texto)) return
    this.avisados.add(texto)
    console.warn(`casa-blanca/simulacion: ${texto}`)
  }
}
