// ──────────────────────────────────────────────────────────────
// LA LÍNEA DE TIEMPO DEL ESTUDIO (pura: sin DOM, sin WebGL).
//
// Convierte un Episodio en tiempos de video: la apertura, cada plano, el
// cierre, cuándo dice cada uno su línea y qué número de cuadro es cada
// segundo. El estudio (reproductor.ts) y el renderizador headless usan esto;
// estudio.test.ts lo prueba sin navegador.
//
// Video = apertura (1,5 s) + los planos + cierre (3 s). Durante la apertura
// la escena ya muestra el primer plano detrás del título; durante el cierre,
// el último plano sigue detrás de la tarjeta final.
// ──────────────────────────────────────────────────────────────

import { CHALLENGE_RECORD_DEADLINE, CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import { CELDAS, LUGAR } from "../lugares"
import { usd } from "../ui/formato"
import { horaANumero, type CamaraPlano, type Episodio, type Formato, type LineaDialogo, type Plano, type Visor } from "./guion"

export const TAMANO: Record<Formato, { ancho: number; alto: number }> = {
  "16:9": { ancho: 1920, alto: 1080 },
  "4:3": { ancho: 1440, alto: 1080 },
}

/** El tamaño de salida: 1920×1080 / 1440×1080, o el mismo formato a otro alto (ancho par, como pide H.264). */
export function tamanoDeSalida(formato: Formato, alto?: number): { ancho: number; alto: number } {
  const base = TAMANO[formato]
  if (!alto || !Number.isFinite(alto)) return base
  const h = Math.round(Math.min(2160, Math.max(360, alto)) / 2) * 2
  return { ancho: Math.round((h * base.ancho) / base.alto / 2) * 2, alto: h }
}

export const APERTURA_S = 1.5
export const CIERRE_S = 3
export const FPS_POR_DEFECTO = 30

export interface Tramo {
  indice: number
  plano: Plano
  /** Segundos de video en que empieza y termina el plano. */
  desde: number
  hasta: number
}

export interface LineaTiempo {
  fps: number
  apertura: number
  cierre: number
  tramos: Tramo[]
  /** Segundos de video, con apertura y cierre. */
  duracion: number
  /** Cuadros del video entero. */
  cuadros: number
}

export function armarLinea(ep: Episodio, fps = ep.fps ?? FPS_POR_DEFECTO): LineaTiempo {
  const f = Number.isFinite(fps) && fps > 0 ? fps : FPS_POR_DEFECTO
  let t = APERTURA_S
  const tramos: Tramo[] = ep.planos.map((plano, indice) => {
    const desde = t
    t += plano.dur
    return { indice, plano, desde, hasta: t }
  })
  const duracion = t + CIERRE_S
  return { fps: f, apertura: APERTURA_S, cierre: CIERRE_S, tramos, duracion, cuadros: Math.round(duracion * f) }
}

/** El cuadro i empieza en i / fps. */
export const tiempoDeCuadro = (i: number, fps: number) => i / fps
/** El cuadro que se ve en el segundo t (el último que empezó). */
export const cuadroDeTiempo = (t: number, fps: number) => Math.floor(t * fps + 1e-6)

export type Fase = "apertura" | "plano" | "cierre"

export interface Momento {
  fase: Fase
  /** El plano cuya escena se ve (el primero en la apertura, el último en el cierre). */
  tramo: Tramo
  /** Segundos desde que empezó ese plano (negativo en la apertura). */
  local: number
  /** Segundos de video. */
  t: number
}

export function momentoEn(linea: LineaTiempo, t: number): Momento {
  const { tramos } = linea
  if (!tramos.length) throw new Error("el episodio no tiene planos")
  if (t < linea.apertura) return { fase: "apertura", tramo: tramos[0], local: t - tramos[0].desde, t }
  for (const tr of tramos) if (t < tr.hasta - 1e-9) return { fase: "plano", tramo: tr, local: t - tr.desde, t }
  const ultimo = tramos[tramos.length - 1]
  return { fase: "cierre", tramo: ultimo, local: t - ultimo.desde, t }
}

// ── Diálogo ───────────────────────────────────────────────────

export interface LineaProgramada {
  linea: LineaDialogo
  /** Segundos dentro del plano. */
  desde: number
  hasta: number
}

/** Entra un poco después de que empieza su turno y sale un poco antes: el corte entre líneas se nota. */
const ENTRA_S = 0.12
const SALE_S = 0.08

/** Las líneas repartidas en partes iguales a lo largo del plano. */
export function horarioDialogo(plano: Plano): LineaProgramada[] {
  const ls = plano.dialogo ?? []
  if (!ls.length) return []
  const turno = plano.dur / ls.length
  return ls.map((linea, k) => ({
    linea,
    desde: k * turno + Math.min(ENTRA_S, turno * 0.1),
    hasta: (k + 1) * turno - Math.min(SALE_S, turno * 0.1),
  }))
}

/** La línea que se está diciendo en el segundo `local` del plano (o null). */
export function lineaActiva(plano: Plano, local: number): LineaProgramada | null {
  for (const l of horarioDialogo(plano)) if (local >= l.desde && local < l.hasta) return l
  return null
}

/** 0 → 1 → 0: entra en `fundido` s y sale en `fundido` s dentro de [desde, hasta). */
export function opacidad(local: number, desde: number, hasta: number, fundido = 0.25): number {
  if (local < desde || local >= hasta) return 0
  const f = Math.max(1e-6, Math.min(fundido, (hasta - desde) / 2))
  return Math.max(0, Math.min(1, (local - desde) / f, (hasta - local) / f))
}

// ── Textos ────────────────────────────────────────────────────

/** Cuándo sale un video: fecha "2026-10-30" y hora de Bolivia "19:00" (EntradaCalendario). */
export interface Estreno {
  fecha: string
  hora: string
}

/**
 * Un episodio fuera del calendario (la muestra) usa esta fecha fija: lo que un
 * video muestra nunca sale del reloj de la máquina que lo filma.
 */
export const ESTRENO_SIN_CALENDARIO: Estreno = { fecha: "2026-10-30", hora: "19:00" }

/** El instante (ms) del estreno. Bolivia es UTC−4 todo el año. NaN si la fecha o la hora no son válidas. */
export function instanteDelEstreno(e: Estreno): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha) || !/^\d{2}:\d{2}$/.test(e.hora)) return NaN
  return Date.parse(`${e.fecha}T${e.hora}:00-04:00`)
}

const DIA_MS = 86_400_000
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

/** Días de calendario entre dos fechas "AAAA-MM-DD" (sin horas: no depende de la zona horaria). */
export function diasEntreFechas(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS)
}

/** "2026-12-30" → "30 de diciembre". */
export function fechaEnPalabras(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number)
  return `${d} de ${MESES[m - 1]}`
}

/**
 * Los números y fechas que se escriben en un guion como marcas, nunca a mano:
 * {RECAUDADO} sale de lib/contador.ts (como en la home), {META} es la meta del reto,
 * {FECHA_RECORD} la fecha del ritmo récord (CHALLENGE_RECORD_DEADLINE) y
 * {DIAS_AL_RECORD} los días que le faltan desde `fecha`, la del estreno del video.
 */
export function textoFinal(texto: string, fecha: string = ESTRENO_SIN_CALENDARIO.fecha): string {
  return texto
    .replace(/\{RECAUDADO\}/g, usd(RECAUDADO))
    .replace(/\{META\}/g, usd(CHALLENGE_TARGET))
    .replace(/\{FECHA_RECORD\}/g, fechaEnPalabras(CHALLENGE_RECORD_DEADLINE))
    .replace(/\{DIAS_AL_RECORD\}/g, String(Math.max(0, diasEntreFechas(fecha, CHALLENGE_RECORD_DEADLINE))))
}

/** 5,4 s a 30 fps → "00:00:05:12". */
export function codigoDeTiempo(t: number, fps: number): string {
  const total = cuadroDeTiempo(Math.max(0, t), fps)
  const f = Math.round(fps)
  const ff = total % f
  const s = Math.floor(total / f)
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}:${dos(ff)}`
}

// ── Cámaras ───────────────────────────────────────────────────

/** El lugar que muestra cada toma del motor (para reunir y para el nombre de la cámara). Las que no muestran uno, null. */
export const LUGAR_DE_TOMA: Record<string, string | null> = {
  "portico-norte": "jardin-norte",
  "sala-guerra": "sala-guerra",
  departamento: CELDAS.n1[0]?.[0] ?? null,
  dron: null,
  bajada: null,
  seguir: null,
  ciudad: null,
  maqueta: null,
}

/**
 * El lugar del plano. `dondeEsta(id)` resuelve a un residente (la toma que lo
 * sigue o la cámara "seguir"): en el estudio sale de la simulación.
 */
export function lugarDelPlano(c: CamaraPlano, dondeEsta: (id: string) => string | null): string | null {
  if (c.tipo === "lugar") return c.lugar
  if (c.tipo === "seguir") return dondeEsta(c.personaje)
  if (c.toma === "seguir" || (c.personaje && !LUGAR_DE_TOMA[c.toma])) return c.personaje ? dondeEsta(c.personaje) : null
  return LUGAR_DE_TOMA[c.toma] ?? null
}

/** La misma cámara en dos planos es la misma CAM: se numeran en el orden en que aparecen. */
export function numerosDeCamara(ep: Episodio): number[] {
  const vistas: string[] = []
  return ep.planos.map((p) => {
    const c = p.camara
    const clave = c.tipo === "toma" ? `toma:${c.toma}:${c.personaje ?? ""}` : c.tipo === "seguir" ? `seguir:${c.personaje}` : `lugar:${c.lugar}`
    let k = vistas.indexOf(clave)
    if (k < 0) k = vistas.push(clave) - 1
    return k + 1
  })
}

/** "CAM 03 · SALA DE GUERRA". `nombre` ya resuelto (lugar, toma o residente). */
export function rotuloDeCamara(numero: number, nombre: string): string {
  return `CAM ${String(numero).padStart(2, "0")} · ${nombre.toLocaleUpperCase("es")}`
}

/** El nombre que va en el rótulo de la cámara. */
export function nombreDeCamara(
  c: CamaraPlano,
  lugarId: string | null,
  nombres: { toma: (id: string) => string | undefined; personaje: (id: string) => string | undefined },
): string {
  if (lugarId && LUGAR[lugarId]) return LUGAR[lugarId].nombre
  if (c.tipo === "toma") return nombres.toma(c.toma) ?? c.toma
  if (c.tipo === "seguir") return nombres.personaje(c.personaje) ?? c.personaje
  return c.lugar
}

export const visorDe = (ep: Episodio, p: Plano, forzado?: Visor | null): Visor => forzado ?? p.visor ?? ep.visor

/** Minutos del mundo de "17:30". */
export const minutosDe = (hora: string) => Math.round(horaANumero(hora) * 60)

// ── El pulso de la mano (visor "camara") ──────────────────────

/**
 * Un temblor suave y determinista: suma de senos con frecuencias que no se
 * repiten entre sí. Mismo t, mismo temblor. En píxeles para un cuadro de
 * 1080 de alto (se escala con el alto real).
 */
export function pulsoDeMano(t: number, alto: number): { dx: number; dy: number; giro: number; escala: number } {
  const k = alto / 1080
  const s = (f: number, fase: number) => Math.sin(t * f + fase)
  const dx = (s(1.31, 0.4) * 2.1 + s(2.73, 1.9) * 1.1 + s(5.17, 0.7) * 0.45) * k
  const dy = (s(1.07, 2.2) * 1.7 + s(3.11, 0.3) * 0.9 + s(6.03, 1.4) * 0.35) * k
  const giro = (s(0.83, 1.1) * 0.0011 + s(2.29, 2.6) * 0.0005)
  // Escala fija con margen: el cuadro movido nunca deja ver un borde negro.
  return { dx, dy, giro, escala: 1.022 }
}

// ── Avisos del estudio (no impiden filmar) ────────────────────

/**
 * Lo que va a salir raro aunque el guion sea válido. `tomas` = escena.tomas().
 * - Una toma fija que dura menos que el plano termina antes: la cámara queda quieta en su última pose.
 * - "reunir" en una toma que no muestra un lugar no tiene dónde reunir.
 * - Más de 17 caracteres por segundo no se alcanza a leer.
 */
export function avisosDelEpisodio(ep: Episodio, tomas: ReadonlyArray<{ id: string; duracion: number }>): string[] {
  const avisos: string[] = []
  const linea = armarLinea(ep)
  linea.tramos.forEach((tr, i) => {
    const p = tr.plano
    const n = `plano ${i + 1}`
    const c = p.camara
    if (c.tipo === "toma") {
      const toma = tomas.find((t) => t.id === c.toma)
      // Lo que corre la toma: el plano, más la apertura (primero) o el cierre (último). El motor
      // la sostiene en su última pose (opción `sostener`): medio segundo quieta no se nota.
      const corre = p.dur + (i === 0 ? linea.apertura : 0) + (i === linea.tramos.length - 1 ? linea.cierre : 0)
      if (toma && c.toma !== "seguir" && corre > toma.duracion + 0.5)
        avisos.push(`${n}: la toma "${c.toma}" dura ${toma.duracion} s y aquí corre ${corre.toFixed(1)} s: los últimos ${(corre - toma.duracion).toFixed(1)} s la cámara queda quieta`)
      if (p.reunir?.length && !lugarDelPlano(c, () => "x")) avisos.push(`${n}: la toma "${c.toma}" no muestra un lugar; "reunir" no tiene dónde reunir`)
    }
    for (const l of horarioDialogo(p)) {
      const cps = textoFinal(l.linea.texto).length / Math.max(0.1, l.hasta - l.desde)
      if (cps > 17) avisos.push(`${n}: "${l.linea.texto.slice(0, 30)}…" va a ${cps.toFixed(0)} caracteres por segundo (más de 17 no se alcanza a leer)`)
    }
  })
  return avisos
}

/** Quiénes pone el guion en cuadro: el seguido, los reunidos y quien habla. */
export function enElGuion(ep: Episodio): Set<string> {
  const ids = new Set<string>()
  for (const p of ep.planos) {
    const c = p.camara
    if (c.tipo !== "lugar" && c.personaje) ids.add(c.personaje)
    for (const id of p.reunir ?? []) ids.add(id)
    for (const l of p.dialogo ?? []) ids.add(l.quien)
  }
  return ids
}

/**
 * Los residentes que el video no muestra: una persona real ("vivo" o
 * "fallecido") sale solo si el guion la pone. Si no, la simulación la llevaría
 * de fondo por los lugares del plano (Kobe por la cafetería, Jobs por el
 * taller) en un video que puede llevar PRIME o el contador, y Trump no sale
 * antes del 10-nov. Fuente: kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md, sección 6.
 */
export function ocultosDelVideo(ep: Episodio, personajes: ReadonlyArray<{ id: string; real?: string }>): Set<string> {
  const guion = enElGuion(ep)
  return new Set(personajes.filter((p) => (p.real === "vivo" || p.real === "fallecido") && !guion.has(p.id)).map((p) => p.id))
}
