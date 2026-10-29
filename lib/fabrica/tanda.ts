// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LA TANDA DIARIA (la máquina con GPU, D−1 a las 22:00)
//
// Una vez por día, en orden (ESPECIFICACION.md, sección 3):
//   1. vencidos a ambiguo · leer la pausa · reclamar el día (fabrica_reclamar)
//   2. ideas → filas en fabrica_videos (lugares del día + la reserva verde)
//   3. guiones (guionista.ts) contra los últimos 30, CONTANDO los de esta noche
//      → aprobacion_pendiente (hay amarillo) o listo_para_render
//   4. voces (voz/voces.ts; el gasto se reserva antes) → render (proceso hijo)
//      → calidad → almacén → envíos por red → subidas pesadas (YouTube, X)
//   5. el resumen en fabrica_estado.ultima_tanda y el candado cerrado
//
// Reglas que valen en cada paso:
//   - Reservar antes de hacer: cada video se toma con fabrica_reservar_video
//     (estado + dueño + vencimiento, y la pausa leída en la MISMA sentencia).
//     Si la reserva no sale, se lee el estado para decir por qué.
//   - Cada fallo se guarda en el video con el CÓMO y se loguea igual.
//   - Un video con voz de prueba nunca llega al almacén en una tanda de
//     verdad (vozPublicable). En seco sí: la base es de mentira.
//
// Todo entra por puertos (TandaPuertos): la base, la IA, la voz, el render,
// la calidad, el almacén y las redes. scripts/fabrica/tanda.ts arma los de
// verdad o los de mentira (--seco); el test corre la cadena entera sin red.
// ──────────────────────────────────────────────────────────────

import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { rutaDelVideo, TIPO_MP4 } from "./almacen"
import type { ResultadoCalidad } from "./calidad"
import { idsDelEstudio, repartoDe, textoValido, type ContextoGuion, type TextosDelVideo } from "./guardas"
import { escribirGuion, type PedirIA } from "./guionista"
import { elegirIdeas, leerFuentesDeIdeas, type FuentesDeIdeas, type Idea, type IdeaPasada, type PuertoIdeas } from "./ideas"
import { esFallo } from "./redes/http"
import { REDES } from "./textos"
import {
  MAX_INTENTOS,
  diaBolivia,
  esperaTras,
  horaBolivia,
  horariosDelDia,
  instanteBolivia,
  mananaBolivia,
  sumarDias,
  tituloDe,
  type Adaptador,
  type Almacen,
  type Ctx,
  type ErrorGuardado,
  type EstadoEnvio,
  type EstadoVideo,
  type Fallo,
  type FilaEnvio,
  type FilaEstado,
  type FilaVideo,
  type Log,
  type RedId,
  type VideoParaRed,
} from "./tipos"
import type { RegistroVoces } from "./voz/registro"
import type { ProveedorVoz } from "./voz/tipos"
import { costoUsdEstimado, lineasDelEpisodio, voces, vozPublicable, type ResultadoVoces } from "./voz/voces"

// ── Constantes ────────────────────────────────────────────────

/** La tanda se reclama hasta 3 veces por día; una tanda caída se puede retomar a los 200 min (la VM se apaga a los 180). */
export const INTENTOS_TANDA = 3
export const VENCE_TANDA_MIN = 200
/** Lo que dura cada reserva de video (ESPECIFICACION.md, sección 3). */
export const VENCE_MIN = { guion: 15, render: 40, calidad: 10, almacen: 20 } as const
/** Una subida pesada (45–90 MB) a YouTube o a X. */
export const VENCE_SUBIDA_MIN = 30
/** Una corrida antes de esta hora (Bolivia) retoma la tanda de anoche en vez de reclamar un día nuevo. */
export const HORA_RETOMA = "12:00"
/** La reserva verde: nunca menos de 3, nunca más de 5, y como mucho 2 nuevas por noche (si falta, 1 siempre). */
export const RESERVA_MIN = 3
export const RESERVA_MAX = 5
export const RESERVA_POR_NOCHE = 2
/** Las redes cuyo archivo sube la VM antes de la salida (lo pesado no entra en Vercel). */
export const REDES_PESADAS: readonly RedId[] = ["youtube", "x"]

// ── Filas y puertos ───────────────────────────────────────────

/** Una fila de fabrica_videos con lo que la tanda lee (la idea y el episodio enteros). */
export type FilaVideoTanda = Omit<FilaVideo, "episodio" | "textos"> & {
  idea: Idea | null
  episodio: Episodio | null
  textos: TextosDelVideo | null
  guion_hash?: string | null
  archivo_bytes?: number | null
}

export interface NuevaFilaVideo {
  dia: string
  slot: number | null
  hora_salida: string | null
  es_reserva: boolean
  pilar: string
  personajes: string[]
  idea: Idea
}

/** Lo que la tanda necesita de la base. La reserva vive en las funciones SQL de la parte 11. */
export interface BaseTanda {
  vencidosAAmbiguo(): Promise<number>
  leerEstado(): Promise<FilaEstado>
  reclamar(que: "tanda", intentos: number, venceMin: number): Promise<string | null>
  terminarCandado(que: "tanda", dia: string): Promise<boolean>
  /** fabrica_sumar_gasto: suma ANTES de gastar; ok false = tope del día (la fábrica queda pausada). */
  sumarGasto(usd: number): Promise<{ ok: boolean; gasto: number; tope: number; motivo?: string }>
  /** Los videos de esos días de salida. */
  videosDe(dias: string[]): Promise<FilaVideoTanda[]>
  /** Las reservas (sin lugar) que siguen vivas, de cualquier día. */
  reservasVivas(): Promise<FilaVideoTanda[]>
  /** Los últimos guiones escritos (más nuevos primero), para la similitud. */
  guionesRecientes(n: number): Promise<Episodio[]>
  /** Inserta una idea. `ocupado` = ese lugar del día ya tiene video (unique dia, slot). */
  insertarVideo(f: NuevaFilaVideo): Promise<{ ok: true; id: string } | { ok: false; ocupado: boolean; como: string }>
  reservarVideo(id: string, desde: EstadoVideo[], trabajo: string, dueno: string, venceMin: number, maxIntentos: number): Promise<FilaVideoTanda | null>
  terminarVideo(id: string, dueno: string, hasta: EstadoVideo, campos?: Record<string, unknown>): Promise<boolean>
  /** Una fila por red (on conflict do nothing): idempotente. */
  crearEnvios(videoId: string, redes: readonly RedId[]): Promise<void>
  enviosDe(videoId: string): Promise<FilaEnvio[]>
  reservarEnvio(id: string, desde: EstadoEnvio[], enCurso: EstadoEnvio, dueno: string, venceMin: number, maxIntentos: number): Promise<FilaEnvio | null>
  terminarEnvio(id: string, dueno: string, hasta: EstadoEnvio, campos?: Record<string, unknown>): Promise<boolean>
  /** fabrica_estado.ultima_tanda_en / ultima_tanda. */
  guardarResumen(resumen: ResumenTanda): Promise<void>
}

/** Lo que pide la tanda al render (scripts/casa-blanca-render.mjs, como proceso hijo). */
export interface PedidoRender {
  videoId: string
  episodio: Episodio
  /** El episodio en JSON, ya escrito en disco. */
  archivoEpisodio: string
  /** El manifiesto de la voz (voz.json): tramos de audio y tiempos de cada línea. null = sin diálogo. */
  archivoVoz: string | null
  salida: string
}
export type ResultadoRender = { ok: true; archivo: string; renderer: string | null; como: string } | Fallo
export type Renderizar = (p: PedidoRender) => Promise<ResultadoRender>

export type RevisarCalidad = (archivo: string, ep: Episodio, renderer: string | null) => Promise<ResultadoCalidad>

/** Los archivos de trabajo de la VM (el disco). */
export interface Disco {
  carpetaDe(videoId: string): string
  escribir(ruta: string, datos: Uint8Array | string): Promise<void>
  leer(ruta: string): Promise<Uint8Array>
  existe(ruta: string): Promise<boolean>
}

export interface TandaPuertos {
  base: BaseTanda
  ideas: PuertoIdeas
  pedirIA: PedirIA
  /** El proveedor de voz elegido por entorno (voz/voces.ts, proveedorDesdeEnv). null = no hay (dice qué falta). */
  voz: { proveedor: ProveedorVoz | null; como: string; falta: string[] }
  registroVoces: RegistroVoces
  render: Renderizar
  /**
   * ¿Puede el render hacer un video de la fábrica? null = sí; si no, qué falta.
   * Se mira ANTES de pedir voces: no se paga audio que no se va a usar.
   */
  renderListo?: () => string | null
  calidad: RevisarCalidad
  almacen: Almacen | null
  /** Por qué no hay almacén, si no hay (las variables que faltan). */
  almacenFalta?: string[]
  /** Solo las redes encendidas Y configuradas (registro-redes.ts, adaptadores()). */
  adaptadores: Partial<Record<RedId, Adaptador>>
  ctx: Ctx
  disco: Disco
  tomas: ReadonlyArray<{ id: string; duracion: number }>
  ahora: () => Date
  dormir: (ms: number) => Promise<void>
  log: Log
  /** Quién tiene las reservas: "tanda:<máquina>:<pid>". */
  dueno: string
  /** true = base, IA, voz, render y redes de mentira: se permite la voz de prueba. */
  seco: boolean
  /** Minutos que la tanda espera a que Kev apruebe los guiones amarillos (0 = no espera). */
  esperaAprobacionMin?: number
  /** Para pruebas o a mano: el día de salida (si no, el día reclamado + 1). */
  diaSalida?: string
}

// ── El resumen ────────────────────────────────────────────────

export type PasoTanda = "ideas" | "guion" | "voz" | "render" | "calidad" | "almacen" | "subida"

export interface ErrorDeTanda {
  paso: PasoTanda | "tanda"
  video?: string
  como: string
}

export interface ResumenTanda {
  dueno: string
  seco: boolean
  empezo: string
  termino: string | null
  /** completa | pausada (no se reclamó o se paró en el medio) | sin_reclamar (hecha, de otro o sin intentos) | error */
  resultado: "completa" | "pausada" | "sin_reclamar" | "cortada" | "error"
  motivo: string | null
  diaReclamado: string | null
  diaSalida: string | null
  ideas: { lugares: number; reserva: number; faltan: string[] }
  pasos: Record<Exclude<PasoTanda, "ideas">, { ok: number; fallos: number }>
  pendientesAprobacion: number
  /** Reservas verdes vivas al terminar. */
  reservaVerde: number
  gastoUsd: number
  errores: ErrorDeTanda[]
  avisos: string[]
}

const resumenVacio = (dueno: string, seco: boolean, ahora: Date): ResumenTanda => ({
  dueno,
  seco,
  empezo: ahora.toISOString(),
  termino: null,
  resultado: "completa",
  motivo: null,
  diaReclamado: null,
  diaSalida: null,
  ideas: { lugares: 0, reserva: 0, faltan: [] },
  pasos: { guion: z(), voz: z(), render: z(), calidad: z(), almacen: z(), subida: z() },
  pendientesAprobacion: 0,
  reservaVerde: 0,
  gastoUsd: 0,
  errores: [],
  avisos: [],
})
function z() {
  return { ok: 0, fallos: 0 }
}

// ── Lo puro ───────────────────────────────────────────────────

/** El día de salida: el día que se reclamó (Bolivia) + 1. La tanda de las 22:00 del 9 hace los videos del 10. */
export const diaDeSalida = (diaReclamado: string) => sumarDias(diaReclamado, 1)

/** Cuántas reservas nuevas esta noche: 1 siempre que haya lugar, hasta 2 si la reserva está por debajo de 3, nunca por encima de 5. */
export function reservasNuevas(vivasDeAntes: number, hechasEstaNoche: number): number {
  if (vivasDeAntes + hechasEstaNoche >= RESERVA_MAX) return 0
  const objetivo = Math.min(RESERVA_POR_NOCHE, Math.max(1, RESERVA_MIN - vivasDeAntes), RESERVA_MAX - vivasDeAntes)
  return Math.max(0, objetivo - hechasEstaNoche)
}

/**
 * Las ideas de la noche: una por lugar que falta y las de reserva. Las de
 * reserva extra salen de nuevas pasadas de elegirIdeas con lo ya elegido en
 * el historial (así no repiten par ni tema). Pura.
 */
export function planDeIdeas(
  f: FuentesDeIdeas,
  o: { dia: string; videosPorDia: number; lugaresLibres: number[]; reservas: number },
): { lugares: Array<{ slot: number; idea: Idea }>; reserva: Idea[]; faltan: string[] } {
  const faltan: string[] = []
  const historial: IdeaPasada[] = [...f.historial]
  const anotar = (i: Idea) => historial.push({ dia: o.dia, personajes: i.personajes, tema: i.tema })
  const lugares: Array<{ slot: number; idea: Idea }> = []
  const reserva: Idea[] = []
  if (!o.lugaresLibres.length && o.reservas <= 0) return { lugares, reserva, faltan }

  const primera = elegirIdeas({ ...f, historial }, { dia: o.dia, cuantas: Math.max(o.videosPorDia, o.lugaresLibres.length) })
  for (const [k, slot] of o.lugaresLibres.entries()) {
    const idea = primera.ideas[k]
    if (!idea) {
      faltan.push(`el lugar ${slot} no tiene idea: ${primera.faltan.join("; ") || "no hubo más candidatos"}`)
      continue
    }
    lugares.push({ slot, idea })
  }
  // Las que no entraron a un lugar no cuentan como usadas: se pueden volver a elegir otro día.
  for (const l of lugares) anotar(l.idea)
  if (o.reservas > 0) {
    if (primera.reserva) {
      reserva.push(primera.reserva)
      anotar(primera.reserva)
    }
    while (reserva.length < o.reservas) {
      const otra = elegirIdeas({ ...f, historial }, { dia: o.dia, cuantas: 3 }).reserva
      if (!otra) break
      reserva.push(otra)
      anotar(otra)
    }
    if (reserva.length < o.reservas) faltan.push(`se pidieron ${o.reservas} ideas de reserva y salieron ${reserva.length}: no hay más pares verdes sin repetir`)
  }
  return { lugares, reserva, faltan }
}

/**
 * Qué hacer con un guion que no salió. "Volver" deja la idea para otro
 * intento (la IA no respondió: no es culpa de la idea); "tope" además frena
 * los guiones de esta noche; "rechazar" = 3 guiones que no pasaron las guardas.
 */
export function destinoDeGuionFallido(motivo: string): "tope" | "volver" | "rechazar" {
  if (/tope de gasto/i.test(motivo)) return "tope"
  if (/no respondió/i.test(motivo)) return "volver"
  return "rechazar"
}

/** A dónde va un video cuando su paso falla, según la clase del fallo. */
export function destinoDeFallo(clase: Fallo["clase"], desde: EstadoVideo): EstadoVideo {
  return clase === "fatal" ? "fallido" : desde
}

/** Lo que una red necesita del video para subir el archivo. */
export function videoParaRed(v: FilaVideoTanda, e: FilaEnvio): VideoParaRed {
  return {
    videoId: v.id,
    envioId: e.id,
    red: e.red,
    titulo: tituloDe({ textos: v.textos, episodio: v.episodio }),
    texto: v.textos?.porRed?.[e.red] ?? "",
    archivo: v.archivo,
    duracionS: v.duracion_s,
    formato: v.episodio?.formato ?? null,
    horaSalida: v.hora_salida,
    idRed: e.id_red,
    contenedor: e.contenedor,
    mediaId: e.media_id,
    publishAt: e.publish_at,
  }
}

/** El error que se guarda en la base: paso, clase y el cómo tal cual. */
const err = (paso: string, como: string, clase: ErrorGuardado["clase"] = "fatal", codigo?: string): ErrorGuardado => ({
  paso,
  como: como.slice(0, 1000),
  clase,
  ...(codigo ? { codigo } : {}),
})

const textoDe = (e: unknown) => (e instanceof Error ? e.message : String(e))

// ── La tanda ──────────────────────────────────────────────────

/** Una señal interna: la fábrica se pausó (o llegó al tope) en el medio. */
class Parada extends Error {}

export async function ejecutarTanda(p: TandaPuertos): Promise<ResumenTanda> {
  const r = resumenVacio(p.dueno, p.seco, p.ahora())
  const log = (m: string) => p.log(`[fabrica/tanda] ${m}`)
  const anotarError = (paso: ErrorDeTanda["paso"], como: string, video?: string) => {
    r.errores.push({ paso, como: como.slice(0, 500), ...(video ? { video } : {}) })
    log(`${video ? `${video} · ` : ""}${paso} falló: ${como}`)
  }
  const cerrar = async (resultado: ResumenTanda["resultado"], motivo: string | null) => {
    r.resultado = resultado
    r.motivo = motivo
    r.termino = p.ahora().toISOString()
    try {
      await p.base.guardarResumen(r)
    } catch (e) {
      log(`no se pudo guardar el resumen en fabrica_estado: ${textoDe(e)}`)
    }
    log(`terminó: ${resultado}${motivo ? ` (${motivo})` : ""} · guiones ${r.pasos.guion.ok}/${r.pasos.guion.fallos} · render ${r.pasos.render.ok}/${r.pasos.render.fallos} · calidad ${r.pasos.calidad.ok}/${r.pasos.calidad.fallos} · almacén ${r.pasos.almacen.ok}/${r.pasos.almacen.fallos} · subidas ${r.pasos.subida.ok}/${r.pasos.subida.fallos}`)
    return r
  }

  log(`empieza (${p.seco ? "EN SECO: base, IA, voz, render y redes de mentira" : "de verdad"}) · dueño ${p.dueno}`)

  // 1. Lo vencido primero (como cada tick): una subida que se cortó queda ambigua, no se repite a ciegas.
  try {
    const n = await p.base.vencidosAAmbiguo()
    if (n) log(`${n} envío(s) vencidos pasaron a ambiguo`)
  } catch (e) {
    anotarError("tanda", `fabrica_vencidos_a_ambiguo: ${textoDe(e)}`)
  }

  // 2. La pausa. Una tanda pausada no reclama el día: cuando Kev reanuda, se puede correr.
  let estado: FilaEstado
  try {
    estado = await p.base.leerEstado()
  } catch (e) {
    anotarError("tanda", `no se pudo leer fabrica_estado: ${textoDe(e)}`)
    return cerrar("error", "sin estado de la fábrica: no se avanza a ciegas")
  }
  if (estado.pausada) {
    log(`la fábrica está pausada (${estado.motivo ?? "sin motivo"}): no se reclama el día ni se avanza`)
    return cerrar("pausada", estado.motivo ?? "pausada")
  }

  // 3. El día, reclamado en la base: un ganador por día. Antes del mediodía
  //    no se reclama: es una corrida que RETOMA la tanda de anoche (se cayó o
  //    se cortó). Reclamar ahora tomaría el candado de hoy y la tanda de esta
  //    noche ya no podría hacer los videos de mañana.
  const retoma = !p.diaSalida && horaBolivia(p.ahora()) < HORA_RETOMA
  let reclamado: string | null
  if (retoma) {
    reclamado = sumarDias(diaBolivia(p.ahora()), -1)
    log(`son las ${horaBolivia(p.ahora())} en Bolivia: se retoma la tanda de anoche (${reclamado}) sin ideas nuevas; cada video se reserva igual`)
  } else {
    try {
      reclamado = await p.base.reclamar("tanda", INTENTOS_TANDA, VENCE_TANDA_MIN)
    } catch (e) {
      anotarError("tanda", `fabrica_reclamar: ${textoDe(e)}`)
      return cerrar("error", "no se pudo reclamar el día")
    }
    if (!reclamado) {
      log(`el día no se reclamó: ya está hecho, otra máquina lo tiene (vence a los ${VENCE_TANDA_MIN} min) o se gastaron los ${INTENTOS_TANDA} intentos`)
      return cerrar("sin_reclamar", "día ya reclamado")
    }
  }
  const diaReclamado: string = reclamado
  const dia = p.diaSalida ?? diaDeSalida(diaReclamado)
  r.diaReclamado = diaReclamado
  r.diaSalida = dia
  log(`${retoma ? "retoma del" : "día reclamado"} ${diaReclamado}: videos que salen el ${dia}`)

  /** Antes de cada paso: ¿se pausó mientras tanto? (la reserva también lo mira, esto es para decir por qué). */
  const sigue = async () => {
    try {
      const e = await p.base.leerEstado()
      if (e.pausada) throw new Parada(`la fábrica se pausó durante la tanda: ${e.motivo ?? "sin motivo"}`)
      estado = e
    } catch (e) {
      if (e instanceof Parada) throw e
      throw new Parada(`no se pudo leer fabrica_estado: ${textoDe(e)}`)
    }
  }
  /** La reserva no salió: por qué. */
  const porQueNo = async (id: string, paso: string) => {
    let motivo = "otro dueño la tiene, cambió de estado o no le quedan intentos"
    try {
      const e = await p.base.leerEstado()
      if (e.pausada) motivo = `la fábrica está pausada (${e.motivo ?? "sin motivo"})`
    } catch (e) {
      motivo = `${motivo}; además no se pudo leer fabrica_estado: ${textoDe(e)}`
    }
    log(`${id} · ${paso}: la reserva no salió (${motivo})`)
    return motivo
  }
  /**
   * Un video a la vez: una excepción que nadie esperaba (la base se cayó a
   * mitad de un paso) se anota con el cómo y la tanda sigue con el próximo.
   * Su reserva vence sola (15 a 40 min) y otra corrida lo retoma. La pausa y
   * el tope (Parada) sí cortan todo.
   */
  const porVideo = async (paso: ErrorDeTanda["paso"], id: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      if (e instanceof Parada) throw e
      anotarError(paso, `error inesperado (la reserva vence sola y otra corrida lo retoma): ${(e as Error)?.stack?.split("\n").slice(0, 3).join(" | ") ?? textoDe(e)}`, id)
    }
  }
  const reservarGasto = async (usd: number, que: string): Promise<boolean> => {
    if (usd <= 0) return true
    const g = await p.base.sumarGasto(usd)
    if (!g.ok) {
      log(`${que}: el gasto de USD ${usd.toFixed(4)} pasa el tope del día (${g.gasto} de ${g.tope}): ${g.motivo ?? "la fábrica se pausa"}`)
      return false
    }
    r.gastoUsd = Math.round((r.gastoUsd + usd) * 10000) / 10000
    return true
  }

  try {
    if (!retoma) await pasoIdeas()
    await sigue()
    await pasoGuiones()
    const esperaMs = Math.max(0, p.esperaAprobacionMin ?? 0) * 60_000
    const hasta = p.ahora().getTime() + esperaMs
    for (;;) {
      await sigue()
      await pasoProduccion()
      const pendientes = (await videosDeLaNoche()).filter((v) => v.estado === "aprobacion_pendiente").length
      r.pendientesAprobacion = pendientes
      if (!pendientes || p.ahora().getTime() + 60_000 > hasta) break
      log(`${pendientes} guion(es) esperan el OK de Kev: se vuelve a mirar en 1 min (hasta ${new Date(hasta).toISOString()})`)
      await p.dormir(60_000)
    }
  } catch (e) {
    if (e instanceof Parada) {
      log(e.message)
      return cerrar("cortada", e.message)
    }
    anotarError("tanda", `error inesperado: ${(e as Error)?.stack ?? textoDe(e)}`)
    return cerrar("error", textoDe(e))
  }

  try {
    r.reservaVerde = (await p.base.reservasVivas()).filter((v) => v.semaforo === "verde").length
    if (r.reservaVerde < RESERVA_MIN) r.avisos.push(`la reserva verde tiene ${r.reservaVerde} videos (mínimo ${RESERVA_MIN})`)
  } catch (e) {
    anotarError("tanda", `no se pudo contar la reserva: ${textoDe(e)}`)
  }
  try {
    // Al retomar se cierra el candado de anoche (si sigue abierto): el parte dirá que terminó.
    await p.base.terminarCandado("tanda", diaReclamado)
  } catch (e) {
    anotarError("tanda", `no se pudo cerrar el candado de la tanda: ${textoDe(e)}`)
  }
  return cerrar("completa", null)

  // ── Los pasos ──

  /** Los videos de esta noche: los lugares del día de salida y TODAS las reservas vivas. */
  async function videosDeLaNoche(): Promise<FilaVideoTanda[]> {
    const [delDia, reservas] = await Promise.all([p.base.videosDe([dia]), p.base.reservasVivas()])
    const vistos = new Set<string>()
    return [...delDia, ...reservas].filter((v) => (vistos.has(v.id) ? false : (vistos.add(v.id), true)))
  }

  async function pasoIdeas() {
    const horas = horariosDelDia(estado.videos_por_dia, dia)
    const delDia = await p.base.videosDe([dia])
    const ocupados = new Set(delDia.filter((v) => v.slot !== null).map((v) => v.slot))
    const libres = horas.map((_, i) => i + 1).filter((s) => !ocupados.has(s))
    const reservas = await p.base.reservasVivas()
    const hechasEstaNoche = reservas.filter((v) => v.dia === dia).length
    const cuantasReserva = reservasNuevas(reservas.length - hechasEstaNoche, hechasEstaNoche)
    if (!libres.length && !cuantasReserva) {
      log(`ideas: los ${horas.length} lugares del ${dia} ya tienen video y la reserva está completa (${reservas.length})`)
      return
    }
    const fuentes = await leerFuentesDeIdeas(p.ideas, dia)
    if (!fuentes.ok) {
      anotarError("ideas", fuentes.como)
      r.ideas.faltan.push(fuentes.como)
      return
    }
    const plan = planDeIdeas(fuentes.fuentes, { dia, videosPorDia: estado.videos_por_dia, lugaresLibres: libres, reservas: cuantasReserva })
    r.ideas.faltan.push(...plan.faltan)
    for (const f of plan.faltan) log(`ideas: ${f}`)
    const filas: NuevaFilaVideo[] = [
      ...plan.lugares.map(({ slot, idea }) => ({
        dia,
        slot,
        hora_salida: instanteBolivia(dia, horas[slot - 1]).toISOString(),
        es_reserva: false,
        pilar: idea.pilar,
        personajes: idea.personajes,
        idea,
      })),
      ...plan.reserva.map((idea) => ({ dia, slot: null, hora_salida: null, es_reserva: true, pilar: idea.pilar, personajes: idea.personajes, idea })),
    ]
    for (const f of filas) {
      const que = f.slot ? `lugar ${f.slot} (${horas[f.slot - 1]})` : "reserva"
      try {
        const ins = await p.base.insertarVideo(f)
        if (ins.ok) {
          if (f.slot) r.ideas.lugares++
          else r.ideas.reserva++
          log(`idea ${que}: ${f.idea.par} · ${f.idea.pilar} · tema «${f.idea.tema}»`)
        } else if (ins.ocupado) log(`idea ${que}: el lugar ya tenía video (otra tanda lo llenó): ${ins.como}`)
        else anotarError("ideas", `no se guardó la idea del ${que}: ${ins.como}`)
      } catch (e) {
        anotarError("ideas", `no se guardó la idea del ${que}: ${textoDe(e)}`)
      }
    }
  }

  async function pasoGuiones() {
    let recientes: Episodio[] = []
    try {
      recientes = await p.base.guionesRecientes(30)
    } catch (e) {
      // Sin los recientes no se puede medir la similitud: escribir igual sería
      // arriesgar el contenido repetido que YouTube castiga en todo el canal.
      anotarError("guion", `no se pudieron leer los guiones recientes (la similitud no se puede medir): ${textoDe(e)}`)
      return
    }
    const ctxDe = (): ContextoGuion => ({ fechaSalida: dia, ids: idsDelEstudio(p.tomas), tomas: p.tomas, redes: REDES, recientes })
    const ideas = (await videosDeLaNoche()).filter((v) => v.estado === "idea")
    for (const v of ideas) {
      await sigue()
      await porVideo("guion", v.id, async () => {
        if (!v.idea) {
          anotarError("guion", "la fila no tiene idea", v.id)
          return
        }
        const rv = await p.base.reservarVideo(v.id, ["idea"], "guion", p.dueno, VENCE_MIN.guion, MAX_INTENTOS)
        if (!rv) {
          await porQueNo(v.id, "guion")
          return
        }
        let g: Awaited<ReturnType<typeof escribirGuion>>
        try {
          g = await escribirGuion(
            { idea: v.idea, slot: v.slot, ctx: ctxDe() },
            { pedir: p.pedirIA, reservarGasto: (usd) => reservarGasto(usd, `guion de ${v.id}`) },
          )
        } catch (e) {
          g = { ok: false, motivo: `la IA no respondió: excepción ${textoDe(e)}`, motivos: [], intentos: 0, gastoUsd: 0 }
        }
        if (g.ok) {
          const hasta: EstadoVideo = g.luz === "amarillo" ? "aprobacion_pendiente" : "listo_para_render"
          const ok = await p.base.terminarVideo(v.id, p.dueno, hasta, {
            episodio: g.episodio,
            textos: g.textos,
            guion_hash: g.hash,
            semaforo: g.luz,
            // Los protagonistas primero (el historial de 7 días compara el par), después el resto del reparto.
            personajes: [...new Set([...v.idea.personajes, ...repartoDe(g.episodio).todos])],
          })
          if (!ok) {
            anotarError("guion", "se escribió pero la reserva ya no era nuestra (venció o la tomó otro): no se guardó", v.id)
            r.pasos.guion.fallos++
            return
          }
          // Lo de esta noche también cuenta para la similitud: dos guiones de la misma tanda no pueden ser gemelos.
          recientes = [g.episodio, ...recientes].slice(0, 30)
          r.pasos.guion.ok++
          log(`${v.id} · guion «${g.episodio.titulo}» (${g.luz}, ${g.intentos} intento(s), USD ${g.gastoUsd.toFixed(4)}) → ${hasta}`)
          return
        }
        r.pasos.guion.fallos++
        const destino = destinoDeGuionFallido(g.motivo)
        const como = [g.motivo, ...g.motivos.slice(0, 5)].join(" · ")
        if (destino === "rechazar") {
          await p.base.terminarVideo(v.id, p.dueno, "rechazado", { motivo_rechazo: g.motivo.slice(0, 300), error: err("guion", como) })
          anotarError("guion", `rechazado: ${como}`, v.id)
        } else {
          await p.base.terminarVideo(v.id, p.dueno, "idea", { error: err("guion", como, destino === "tope" ? "no_hoy" : "reintentable") })
          anotarError("guion", `vuelve a idea: ${como}`, v.id)
          if (destino === "tope") throw new Parada(`tope de gasto del día en los guiones: ${g.motivo}`)
        }
      })
    }
  }

  async function pasoProduccion() {
    // La voz decide si se puede producir algo esta noche.
    const proveedor = p.voz.proveedor
    if (!proveedor) {
      const listos = (await videosDeLaNoche()).filter((v) => v.estado === "listo_para_render").length
      if (listos) anotarError("voz", `sin proveedor de voz (${p.voz.como}; falta ${p.voz.falta.join(", ") || "?"}): ${listos} video(s) quedan en listo_para_render`)
      return
    }
    if (proveedor.falso && !p.seco) {
      const listos = (await videosDeLaNoche()).filter((v) => v.estado === "listo_para_render").length
      if (listos)
        anotarError(
          "voz",
          `la voz es de prueba (${p.voz.como}): un video con esa voz no se publica, así que no se renderiza. Poner FABRICA_VOZ=elevenlabs con su clave, o correr --seco para ensayar. ${listos} video(s) quedan en listo_para_render`,
        )
      // Lo que ya está renderizado o en calidad puede seguir: no tiene voz nueva.
    }

    const noRender = p.renderListo?.() ?? null
    if (noRender) {
      const listos = (await videosDeLaNoche()).filter((v) => v.estado === "listo_para_render").length
      if (listos) anotarError("render", `${noRender}. ${listos} video(s) quedan en listo_para_render`)
    }

    for (const v of (await videosDeLaNoche()).filter((x) => ["listo_para_render", "renderizado", "calidad_ok"].includes(x.estado))) {
      await sigue()
      await porVideo("render", v.id, async () => {
        let fila: FilaVideoTanda | null = v
        if (fila.estado === "listo_para_render") {
          if ((proveedor.falso && !p.seco) || noRender) return
          fila = await vozYRender(fila, proveedor)
          if (!fila) return
        }
        if (fila.estado === "renderizado") {
          fila = await calidad(fila)
          if (!fila) return
        }
        if (fila.estado === "calidad_ok") await almacenYSubidas(fila)
      })
    }
    // Lo que quedó subido a medias en otra corrida (la subida pesada que faltó).
    for (const v of (await videosDeLaNoche()).filter((x) => x.estado === "subido_parcial")) {
      await sigue()
      await porVideo("subida", v.id, () => subidasPesadas(v))
    }
  }

  async function vozYRender(v: FilaVideoTanda, proveedor: ProveedorVoz): Promise<FilaVideoTanda | null> {
    const ep = v.episodio
    if (!ep) {
      anotarError("render", "listo_para_render sin episodio", v.id)
      return null
    }
    const rv = await p.base.reservarVideo(v.id, ["listo_para_render"], "render", p.dueno, VENCE_MIN.render, MAX_INTENTOS)
    if (!rv) {
      await porQueNo(v.id, "render")
      return null
    }
    const volver = async (paso: PasoTanda, f: Fallo) => {
      const hasta = destinoDeFallo(f.clase, "listo_para_render")
      await p.base.terminarVideo(v.id, p.dueno, hasta, { error: err(paso, f.como, f.clase, f.codigo) })
      anotarError(paso, `${f.clase} → ${hasta}: ${f.como}`, v.id)
      r.pasos[paso as Exclude<PasoTanda, "ideas">].fallos++
    }
    const carpeta = p.disco.carpetaDe(v.id)

    // La voz: el gasto se reserva en la base ANTES de pedirla.
    const caracteres = lineasDelEpisodio(ep).reduce((s, l) => s + l.texto.length, 0)
    const usd = costoUsdEstimado(caracteres, proveedor)
    if (!(await reservarGasto(usd, `voz de ${v.id}`))) {
      await p.base.terminarVideo(v.id, p.dueno, "listo_para_render", { error: err("voz", `tope de gasto del día: USD ${usd} de voz no entran`, "no_hoy") })
      throw new Parada(`tope de gasto del día en las voces (${v.id})`)
    }
    let rv2: ResultadoVoces | Fallo
    try {
      rv2 = await voces(ep, { proveedor, registro: p.registroVoces, dia, log: p.log })
    } catch (e) {
      rv2 = { ok: false, clase: "reintentable", como: `voces lanzó: ${textoDe(e)}` }
    }
    if (esFallo(rv2)) {
      await volver("voz", rv2)
      if (rv2.clase === "no_hoy") throw new Parada(`la voz dice que hoy no: ${rv2.como}`)
      return null
    }
    for (const a of rv2.avisos) r.avisos.push(`${v.id}: ${a}`)
    let archivoVoz: string | null = null
    try {
      const tramos = []
      for (const [k, t] of rv2.tramos.entries()) {
        const ruta = `${carpeta}/voz-${k + 1}.${t.formato}`
        await p.disco.escribir(ruta, t.audio)
        tramos.push({ archivo: ruta, formato: t.formato, duracionS: t.duracionS, como: t.como })
      }
      if (tramos.length) {
        archivoVoz = `${carpeta}/voz.json`
        await p.disco.escribir(
          archivoVoz,
          JSON.stringify(
            { proveedor: rv2.proveedor, modelo: rv2.modelo, falso: rv2.falso, tramos, lineas: rv2.lineas, vozPorPlanoS: rv2.vozPorPlanoS },
            null,
            2,
          ),
        )
      }
    } catch (e) {
      await volver("voz", { ok: false, clase: "reintentable", como: `no se pudo escribir el audio en ${carpeta}: ${textoDe(e)}` })
      return null
    }
    r.pasos.voz.ok++
    log(`${v.id} · voz: ${rv2.tramos.length} tramo(s), ${rv2.lineas.length} línea(s), ${rv2.caracteres} caracteres (${rv2.proveedor}${rv2.falso ? ", DE PRUEBA" : ""})`)

    // El render.
    const archivoEpisodio = `${carpeta}/episodio.json`
    const salida = `${carpeta}/video.mp4`
    let ren: ResultadoRender
    try {
      await p.disco.escribir(archivoEpisodio, JSON.stringify(ep, null, 2))
      ren = await p.render({ videoId: v.id, episodio: ep, archivoEpisodio, archivoVoz, salida })
    } catch (e) {
      ren = { ok: false, clase: "reintentable", como: `el render lanzó: ${textoDe(e)}` }
    }
    if (esFallo(ren)) {
      await volver("render", ren)
      return null
    }
    const calidadPrevia = { renderer: ren.renderer, render: ren.como, voz: { proveedor: rv2.proveedor, falso: rv2.falso, caracteres: rv2.caracteres } }
    const ok = await p.base.terminarVideo(v.id, p.dueno, "renderizado", { calidad: calidadPrevia })
    if (!ok) {
      anotarError("render", "se renderizó pero la reserva ya no era nuestra: no se guardó", v.id)
      r.pasos.render.fallos++
      return null
    }
    r.pasos.render.ok++
    log(`${v.id} · render listo: ${ren.archivo} (${ren.como})`)
    return { ...v, estado: "renderizado", calidad: calidadPrevia } as FilaVideoTanda
  }

  async function calidad(v: FilaVideoTanda): Promise<FilaVideoTanda | null> {
    const ep = v.episodio
    if (!ep) {
      anotarError("calidad", "renderizado sin episodio", v.id)
      return null
    }
    const rv = await p.base.reservarVideo(v.id, ["renderizado"], "calidad", p.dueno, VENCE_MIN.calidad, MAX_INTENTOS)
    if (!rv) {
      await porQueNo(v.id, "calidad")
      return null
    }
    const previa = ((rv as unknown as { calidad?: unknown }).calidad ?? (v as unknown as { calidad?: unknown }).calidad ?? {}) as {
      renderer?: string | null
      voz?: { falso?: boolean }
    }
    const archivo = `${p.disco.carpetaDe(v.id)}/video.mp4`
    if (!(await p.disco.existe(archivo))) {
      // El render se hizo en otra máquina o se borró: renderizado → listo no existe en la máquina de estados.
      await p.base.terminarVideo(v.id, p.dueno, "fallido", { error: err("calidad", `el archivo ${archivo} no está en esta máquina (¿se renderizó en otra?)`) })
      anotarError("calidad", `sin archivo local ${archivo}: fallido`, v.id)
      r.pasos.calidad.fallos++
      return null
    }
    let res: ResultadoCalidad
    try {
      res = await p.calidad(archivo, ep, previa.renderer ?? null)
    } catch (e) {
      await p.base.terminarVideo(v.id, p.dueno, "renderizado", { error: err("calidad", `la revisión lanzó: ${textoDe(e)}`, "reintentable") })
      anotarError("calidad", `la revisión lanzó: ${textoDe(e)}`, v.id)
      r.pasos.calidad.fallos++
      return null
    }
    const guardada = { ...previa, ...res }
    const bytes = res.medido.bytes
    if (!res.ok) {
      await p.base.terminarVideo(v.id, p.dueno, "rechazado", {
        calidad: guardada,
        motivo_rechazo: `calidad: ${res.motivos.join("; ")}`.slice(0, 300),
        error: err("calidad", res.motivos.join("; ")),
      })
      anotarError("calidad", `rechazado: ${res.motivos.join("; ")}`, v.id)
      r.pasos.calidad.fallos++
      return null
    }
    const campos: Record<string, unknown> = { calidad: guardada }
    if (res.medido.duracionS !== null) campos.duracion_s = Math.round(res.medido.duracionS * 100) / 100
    if (bytes !== null) campos.archivo_bytes = bytes
    if (res.avisos.length) campos.avisos = res.avisos.slice(0, 20)
    const ok = await p.base.terminarVideo(v.id, p.dueno, "calidad_ok", campos)
    if (!ok) {
      anotarError("calidad", "pasó pero la reserva ya no era nuestra: no se guardó", v.id)
      r.pasos.calidad.fallos++
      return null
    }
    r.pasos.calidad.ok++
    log(`${v.id} · calidad ok${res.avisos.length ? ` (avisos: ${res.avisos.join("; ")})` : ""}`)
    return { ...v, estado: "calidad_ok", calidad: guardada, duracion_s: (campos.duracion_s as number | undefined) ?? v.duracion_s } as FilaVideoTanda
  }

  async function almacenYSubidas(v: FilaVideoTanda) {
    const previa = ((v as unknown as { calidad?: { voz?: { falso?: boolean } } }).calidad ?? {}) as { voz?: { falso?: boolean } }
    const vozFalsa = previa.voz?.falso !== false
    if (vozFalsa && !p.seco) {
      // Nunca al almacén ni a una red: no hay forma de que salga publicado.
      const rv = await p.base.reservarVideo(v.id, ["calidad_ok"], "almacen", p.dueno, VENCE_MIN.almacen, MAX_INTENTOS)
      if (rv) await p.base.terminarVideo(v.id, p.dueno, "fallido", { error: err("almacen", "voz de prueba o sin dato de la voz: un video así no se publica (vozPublicable)") })
      anotarError("almacen", "voz de prueba o sin dato de la voz: fallido, no se publica", v.id)
      r.pasos.almacen.fallos++
      return
    }
    if (vozFalsa) log(`${v.id} · EN SECO con voz de prueba: en una tanda de verdad este video no pasaría de aquí (vozPublicable = ${vozPublicable({ falso: true })})`)
    if (!p.almacen) {
      anotarError("almacen", `sin almacén configurado: falta ${(p.almacenFalta ?? ["FABRICA_ALMACEN / SUPABASE_SERVICE_ROLE_KEY"]).join("; ")}. El video queda en calidad_ok`, v.id)
      r.pasos.almacen.fallos++
      return
    }
    const rv = await p.base.reservarVideo(v.id, ["calidad_ok"], "almacen", p.dueno, VENCE_MIN.almacen, MAX_INTENTOS)
    if (!rv) {
      await porQueNo(v.id, "almacen")
      return
    }
    const ruta = rutaDelVideo(v.dia, v.id)
    try {
      const datos = await p.disco.leer(`${p.disco.carpetaDe(v.id)}/video.mp4`)
      await p.almacen.subir(ruta, datos, TIPO_MP4)
      // Primero los envíos (uno por red): así el tick ve todo lo que tiene que publicar cuando el video aparece listo.
      await p.base.crearEnvios(v.id, REDES)
      const ok = await p.base.terminarVideo(v.id, p.dueno, "subido_parcial", { archivo: ruta, archivo_bytes: datos.byteLength })
      if (!ok) throw new Error("subió pero la reserva ya no era nuestra: el estado no se guardó")
    } catch (e) {
      await p.base.terminarVideo(v.id, p.dueno, "calidad_ok", { error: err("almacen", textoDe(e), "reintentable") })
      anotarError("almacen", textoDe(e), v.id)
      r.pasos.almacen.fallos++
      return
    }
    r.pasos.almacen.ok++
    log(`${v.id} · en el almacén: ${ruta}`)
    await subidasPesadas({ ...v, estado: "subido_parcial", archivo: ruta })
  }

  /** YouTube (privado, sin publishAt) y la media de X: lo pesado lo sube la VM. */
  async function subidasPesadas(v: FilaVideoTanda) {
    let envios: FilaEnvio[]
    try {
      envios = await p.base.enviosDe(v.id)
    } catch (e) {
      anotarError("subida", `no se pudieron leer los envíos: ${textoDe(e)}`, v.id)
      return
    }
    for (const red of REDES_PESADAS) {
      const e = envios.find((x) => x.red === red)
      const ad = p.adaptadores[red]
      if (!e || e.estado !== "pendiente") continue
      if (!ad?.subir) {
        log(`${v.id} · ${red}: sin adaptador (apagada o sin configurar): no se sube; el tick la omite a la hora`)
        continue
      }
      const datos = videoParaRed(v, e)
      // Un texto que no sirve no se sube: el tick lo marca fallido con el cómo al publicar.
      const malTexto = datos.texto ? textoValido(red, datos.texto, datos.titulo || undefined) : [`sin texto para ${red}`]
      if (malTexto.length) {
        anotarError("subida", `${red}: no se sube, el texto no sirve: ${malTexto.join("; ")}`, v.id)
        r.pasos.subida.fallos++
        continue
      }
      await sigue()
      const re = await p.base.reservarEnvio(e.id, ["pendiente"], "subiendo", p.dueno, VENCE_SUBIDA_MIN, MAX_INTENTOS)
      if (!re) {
        await porQueNo(`${v.id} · ${red}`, "subida")
        continue
      }
      let res: Awaited<ReturnType<NonNullable<Adaptador["subir"]>>>
      try {
        res = await ad.subir({ ...datos, envioId: re.id }, p.ctx)
      } catch (ex) {
        // Una excepción después de empezar a mandar: no se sabe si llegó.
        res = { ok: false, clase: "ambiguo", como: `${red}.subir lanzó: ${textoDe(ex)}` }
      }
      if (!esFallo(res)) {
        await p.base.terminarEnvio(re.id, p.dueno, "subido", {
          ...(res.idRed ? { id_red: res.idRed } : {}),
          ...(res.mediaId ? { media_id: res.mediaId } : {}),
          ...(res.expira ? { media_expira_en: res.expira } : {}),
          proximo_intento: null,
        })
        r.pasos.subida.ok++
        log(`${v.id} · ${red} subido${res.idRed ? ` (${res.idRed})` : ""}${res.mediaId ? ` (media ${res.mediaId}, vence ${res.expira ?? "sin fecha"})` : ""}`)
        if (red === "x" && res.expira && v.hora_salida && Date.parse(res.expira) < Date.parse(v.hora_salida) + 30 * 60_000)
          r.avisos.push(`${v.id}: la media de X vence (${res.expira}) antes de 30 min después de la salida: el tick la va a omitir`)
        continue
      }
      r.pasos.subida.fallos++
      const ahora = p.ahora()
      const intentos = re.intentos
      const [hasta, extra]: [EstadoEnvio, Record<string, unknown>] =
        res.clase === "ambiguo"
          ? ["ambiguo", {}]
          : res.clase === "fatal"
            ? ["fallido", {}]
            : res.clase === "no_hoy"
              ? ["pendiente", { proximo_intento: mananaBolivia(ahora).toISOString() }]
              : ["pendiente", { proximo_intento: new Date(ahora.getTime() + esperaTras(intentos) * 60_000).toISOString() }]
      await p.base.terminarEnvio(re.id, p.dueno, hasta, { ...extra, error: err("subiendo", res.como, res.clase, res.codigo) })
      anotarError("subida", `${red} ${res.clase} → ${hasta}: ${res.como}`, v.id)
    }
  }
}

// ── Utilidades para el script ─────────────────────────────────

/** Una línea por paso, para la terminal. */
export function resumenEnTexto(r: ResumenTanda): string {
  const p = r.pasos
  return [
    `Tanda ${r.resultado}${r.motivo ? ` (${r.motivo})` : ""}${r.seco ? " · EN SECO" : ""}`,
    `Día reclamado ${r.diaReclamado ?? "—"} · salida ${r.diaSalida ?? "—"}`,
    `Ideas: ${r.ideas.lugares} lugares + ${r.ideas.reserva} de reserva${r.ideas.faltan.length ? ` · faltan: ${r.ideas.faltan.join("; ")}` : ""}`,
    `Guiones ${p.guion.ok} ok / ${p.guion.fallos} fallos · voz ${p.voz.ok}/${p.voz.fallos} · render ${p.render.ok}/${p.render.fallos} · calidad ${p.calidad.ok}/${p.calidad.fallos} · almacén ${p.almacen.ok}/${p.almacen.fallos} · subidas ${p.subida.ok}/${p.subida.fallos}`,
    `Esperan el OK de Kev: ${r.pendientesAprobacion} · reserva verde: ${r.reservaVerde} · gasto USD ${r.gastoUsd.toFixed(4)}`,
    ...r.avisos.map((a) => `Aviso: ${a}`),
    ...r.errores.map((e) => `Error ${e.paso}${e.video ? ` (${e.video})` : ""}: ${e.como}`),
  ].join("\n")
}
