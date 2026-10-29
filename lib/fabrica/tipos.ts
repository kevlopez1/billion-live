// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · TIPOS Y REGLAS COMPARTIDAS (puro)
//
// Lo que leen todos los módulos de la fábrica: los estados y sus
// transiciones (la ÚNICA lista), las banderas de entorno, la hora de
// Bolivia, los horarios de salida, la política de reintentos y el contrato
// de los adaptadores de red. Sin red ni base: se prueba con
// `npx tsx lib/fabrica/tipos.test.ts`.
//
// Contrato completo: docs/fabrica/ESPECIFICACION.md.
// ──────────────────────────────────────────────────────────────

import type { Red } from "../../components/casa-blanca/estudio/guion"
import { FICCION, REDES } from "./textos"

export { FICCION, REDES }
export type RedId = Red

/** El buzón de bajas: se baja en menos de 24 h lo que alguien pida bajar. */
export const CORREO_BAJAS = "bajas@kevproject.world"

// ── Banderas de entorno ───────────────────────────────────────

const SI = new Set(["1", "true", "si", "sí", "on"])

/**
 * Una variable de entorno como booleano. `"false"` es una cadena no vacía y
 * en JS es verdadera: por eso nunca se usa `if (process.env.X)`. Encendida
 * solo con 1, true, si, sí u on (sin importar mayúsculas ni espacios).
 * Vacía, ausente o cualquier otra cosa = apagada.
 */
export function flag(valor: string | undefined | null): boolean {
  return SI.has((valor ?? "").trim().toLowerCase())
}

export type Entorno = Record<string, string | undefined>

/** El nombre de la variable que enciende una red: FABRICA_YOUTUBE_ACTIVA… */
export const variableDeRed = (red: RedId) => `FABRICA_${red.toUpperCase()}_ACTIVA`

/** Las redes encendidas por entorno (no mira si hay adaptador ni si la base las pausó). */
export function redesEncendidas(env: Entorno): RedId[] {
  if (!flag(env.FABRICA_ACTIVA)) return []
  return REDES.filter((r) => flag(env[variableDeRed(r)]))
}

// ── Estados y transiciones ───────────────────────────────────

export const ESTADOS_VIDEO = [
  "idea",
  "guion",
  "aprobacion_pendiente",
  "listo_para_render",
  "renderizado",
  "calidad_ok",
  "subido_parcial",
  "programado",
  "publicado",
  "fallido",
  "rechazado",
] as const
export type EstadoVideo = (typeof ESTADOS_VIDEO)[number]

export const ESTADOS_ENVIO = [
  "pendiente",
  "subiendo",
  "subido",
  "programado",
  "publicando",
  "procesando",
  "ambiguo",
  "publicado",
  "confirmado",
  "no_hoy",
  "fallido",
  "omitido",
] as const
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number]

/** Desde estos ya no se sale. */
export const TERMINALES_VIDEO: readonly EstadoVideo[] = ["publicado", "fallido", "rechazado"]
export const TERMINALES_ENVIO: readonly EstadoEnvio[] = ["confirmado", "fallido", "omitido"]

// Cualquier estado vivo puede terminar en fallido (error fatal de quien tiene
// la reserva) o rechazado (el panel, una aprobación vencida, o un amarillo que
// no llegó y no puede ir a la reserva).
const FIN: EstadoVideo[] = ["fallido", "rechazado"]

/** La máquina de estados del video. La pausa no cambia estados: los bloquea. */
export const TRANSICIONES: Readonly<Record<EstadoVideo, readonly EstadoVideo[]>> = {
  idea: ["guion", ...FIN],
  guion: ["aprobacion_pendiente", "listo_para_render", ...FIN],
  aprobacion_pendiente: ["listo_para_render", ...FIN],
  listo_para_render: ["renderizado", ...FIN],
  renderizado: ["calidad_ok", ...FIN],
  calidad_ok: ["subido_parcial", ...FIN],
  subido_parcial: ["programado", ...FIN],
  programado: ["publicado", ...FIN],
  publicado: [],
  fallido: [],
  rechazado: [],
}

/**
 * La de cada envío. YouTube: pendiente →(VM) subiendo → subido → programado →
 * publicado → confirmado. Meta, TikTok y X: pendiente|subido → publicando →
 * (procesando) → publicado → confirmado.
 */
export const TRANSICIONES_ENVIO: Readonly<Record<EstadoEnvio, readonly EstadoEnvio[]>> = {
  pendiente: ["subiendo", "publicando", "omitido", "fallido"],
  subiendo: ["subido", "pendiente", "ambiguo", "no_hoy", "fallido"],
  subido: ["programado", "publicando", "omitido", "fallido"],
  // Desprogramar (pausa) vuelve a subido; publish_at vencido = YouTube ya lo sacó.
  programado: ["subido", "publicado", "fallido"],
  publicando: ["publicado", "procesando", "ambiguo", "pendiente", "subido", "no_hoy", "fallido"],
  // Un contenedor de Instagram: se retoma (publicando) o se cae.
  procesando: ["publicando", "omitido", "fallido"],
  // De ambiguo solo se sale mirando recientes(): estaba (publicado/subido),
  // no estaba (se vuelve a intentar) o se terminó la ventana (fallido, a mano).
  ambiguo: ["publicado", "subido", "pendiente", "fallido"],
  publicado: ["confirmado", "fallido"],
  no_hoy: ["publicando", "omitido"],
  confirmado: [],
  fallido: [],
  omitido: [],
}

export const puedePasar = (de: EstadoVideo, a: EstadoVideo) => TRANSICIONES[de].includes(a)
export const puedePasarEnvio = (de: EstadoEnvio, a: EstadoEnvio) => TRANSICIONES_ENVIO[de].includes(a)

/** Adonde vuelve un envío para intentarse de nuevo: YouTube y X ya tienen lo suyo subido por la VM. */
export const estadoBase = (red: RedId): EstadoEnvio => (red === "youtube" || red === "x" ? "subido" : "pendiente")

// ── La hora de Bolivia (UTC−4 fijo, sin horario de verano) ─────

export const DESFASE_BOLIVIA_MS = -4 * 3600_000

/** "2026-11-10": el día de Bolivia de un instante. */
export const diaBolivia = (ahora: Date) => new Date(ahora.getTime() + DESFASE_BOLIVIA_MS).toISOString().slice(0, 10)

/** "21:30": la hora de Bolivia de un instante. */
export const horaBolivia = (ahora: Date) => new Date(ahora.getTime() + DESFASE_BOLIVIA_MS).toISOString().slice(11, 16)

/** El instante de un día y una hora de Bolivia: ("2026-11-10", "12:00") → 16:00 UTC. */
export function instanteBolivia(dia: string, hora: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw new Error(`fabrica/tipos: día u hora inválidos (${dia} ${hora})`)
  }
  return new Date(Date.parse(`${dia}T${hora}:00Z`) - DESFASE_BOLIVIA_MS)
}

/** El día de Bolivia n días después: ("2026-11-10", 1) → "2026-11-11". */
export const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)

/** Las 00:00 de mañana en Bolivia. Lo que una red dice "hoy no" se intenta desde ahí. */
export const mananaBolivia = (ahora: Date) => instanteBolivia(sumarDias(diaBolivia(ahora), 1), "00:00")

// ── Horarios de salida (hora de Bolivia) ───────────────────────

export const HORARIOS_3 = ["12:00", "16:00", "21:30"] as const
export const HORARIOS_6 = ["10:00", "12:00", "14:00", "16:00", "21:00", "22:30"] as const
/** La temporada de 19 episodios sale a las 19:00 hasta este día: la fábrica no publica a esa hora. */
export const FIN_TEMPORADA = "2026-11-22"

/**
 * Las horas de salida de un día, según cuántos videos hay. El plan define 3
 * y 6; con 1 o 2 se toman las primeras de las de 3, con 4 o 5 las primeras de
 * las de 6 (a decidir por Kev). El lugar (slot) es la posición + 1.
 */
export function horariosDelDia(videosPorDia: number, dia: string): string[] {
  const n = Math.min(6, Math.max(1, Math.round(videosPorDia)))
  const horas: string[] = n <= 3 ? HORARIOS_3.slice(0, n) : HORARIOS_6.slice(0, n)
  // Nunca a la hora de la temporada mientras dure. Hoy ninguna lista la usa;
  // esto evita que alguien la agregue sin darse cuenta.
  return dia <= FIN_TEMPORADA ? horas.filter((h) => h !== "19:00") : horas
}

// ── Reintentos ─────────────────────────────────────────────────

/** Como máximo 3 intentos por paso (el intento se cuenta al reservar: una caída también cuenta). */
export const MAX_INTENTOS = 3
/** Espera antes del intento siguiente, en minutos: 10 tras el primero, 30 tras el segundo, 90 tras el tercero. */
export const ESPERAS_MIN = [10, 30, 90] as const
export const esperaTras = (intentos: number) => ESPERAS_MIN[Math.min(Math.max(intentos, 1), ESPERAS_MIN.length) - 1]

/** Lo que cuesta cada envío, para el tope de gasto del día (X: $0,015 por post sin URL [X1]). */
export const COSTO_USD: Readonly<Record<RedId, number>> = { youtube: 0, facebook: 0, instagram: 0, tiktok: 0, x: 0.015 }

// ── Errores y adaptadores de red ──────────────────────────────

/**
 * reintentable: 5xx, error de red ANTES de mandar, Meta 1/2.
 * no_hoy:       topes y spam (X 429 / 10 posts en 24 h, TikTok spam_risk_too_many_posts,
 *               Meta 9 / 2207042 / 80002, YouTube quotaExceeded). No se reintenta hoy.
 * fatal:        token inválido tras renovar, sin permiso, formato rechazado.
 * ambiguo:      se cortó DESPUÉS de mandar: puede haber salido. Se mira recientes() antes de repetir.
 */
export type Clase = "reintentable" | "no_hoy" | "fatal" | "ambiguo"

/** `como` es la respuesta de la red tal cual (o lo que pasó, con detalle), nunca "falló". */
export type Fallo = { ok: false; clase: Clase; como: string; codigo?: string; pendiente?: string }

/** Lo que se guarda de cada error. `cuando` lo pone la base. */
export interface ErrorGuardado {
  paso: string
  como: string
  clase: Clase | "omitido" | "privado"
  codigo?: string
}

/** El almacén del archivo (Supabase Storage o Vercel Blob, paso 11 de Kev). URL firmada de 24 h o más. */
export interface Almacen {
  subir(ruta: string, datos: Uint8Array, tipo: string): Promise<void>
  urlFirmada(ruta: string, horas: number): Promise<string>
  borrar(ruta: string): Promise<void>
}

export type Log = (mensaje: string) => void

export interface Ctx {
  fetch: typeof fetch
  env: Entorno
  ahora: () => Date
  /** El token vigente de esa red, ya descifrado (tokens.ts), o null si no hay. */
  token: (red: RedId) => Promise<string | null>
  almacen: Almacen | null
  log: Log
}

/** Lo que un adaptador necesita de un video para una red. */
export interface VideoParaRed {
  videoId: string
  envioId: string
  red: RedId
  titulo: string
  /** El texto ya validado para esa red (primera línea = FICCION). */
  texto: string
  /** Ruta en el almacén. */
  archivo: string | null
  duracionS: number | null
  formato: "16:9" | "4:3" | null
  /** ISO. */
  horaSalida: string | null
  idRed: string | null
  contenedor: string | null
  mediaId: string | null
  publishAt: string | null
}

export type Visibilidad = "publico" | "privado" | "procesando" | "no_existe" | "desconocida"
export type Reciente = { idRed: string; texto: string; creado: string }

export interface Adaptador {
  red: RedId
  /** Solo la VM (archivo pesado). */
  subir?(v: VideoParaRed, c: Ctx): Promise<{ ok: true; idRed?: string; mediaId?: string; expira?: string } | Fallo>
  /** Publica a la hora. Si queda procesando (contenedor de Instagram): Fallo con `pendiente` = el contenedor. */
  publicar(v: VideoParaRed, c: Ctx): Promise<{ ok: true; idRed: string; enlace?: string; contenedor?: string } | Fallo>
  /** YouTube: deja el video privado con publishAt (solo para las próximas ~3 h, así el interruptor lo alcanza). */
  programar?(v: VideoParaRed, publishAt: string, c: Ctx): Promise<{ ok: true } | Fallo>
  estado(idRed: string, c: Ctx): Promise<{ visibilidad: Visibilidad; como: string }>
  /** Los posts desde `desde`, para saber si un envío ambiguo salió. */
  recientes(desde: Date, c: Ctx): Promise<Reciente[] | Fallo>
  /** YouTube al pausar: privado y sin publishAt. */
  desprogramar?(idRed: string, c: Ctx): Promise<{ ok: true } | Fallo>
  clasificar(status: number, cuerpo: unknown): Clase
}

// ── Filas de la base (supabase/correr-todo.sql, parte 11) ──────

export interface EstadoDeRed {
  pausada?: boolean
  motivo?: string
  fallos_seguidos?: number
}

export interface FilaEstado {
  pausada: boolean
  motivo: string | null
  pausada_por: string | null
  pausada_en: string | null
  modo_aprobacion: boolean
  videos_por_dia: number
  tope_gasto_usd_dia: number
  dia: string | null
  gasto_usd_dia: number
  publicados_dia: number
  fallidos_dia: number
  redes: Partial<Record<RedId, EstadoDeRed>>
  ultimo_tick_en: string | null
  ultima_tanda_en: string | null
  ultima_tanda: unknown
}

export interface FilaVideo {
  id: string
  creado: string
  actualizado: string
  dia: string
  slot: number | null
  hora_salida: string | null
  es_reserva: boolean
  estado: EstadoVideo
  pilar: string | null
  personajes: string[]
  semaforo: "verde" | "amarillo" | null
  episodio: { titulo?: string; formato?: "16:9" | "4:3" } | null
  /** { titulo?, porRed: { red: texto }, miniatura? } */
  textos: { titulo?: string; porRed?: Partial<Record<RedId, string>>; miniatura?: string } | null
  archivo: string | null
  duracion_s: number | null
  aprobado_video_en: string | null
  motivo_rechazo: string | null
  dueno: string | null
  vence_en: string | null
  intentos: number
}

export interface FilaEnvio {
  id: string
  video_id: string
  red: RedId
  estado: EstadoEnvio
  id_red: string | null
  enlace: string | null
  contenedor: string | null
  media_id: string | null
  media_expira_en: string | null
  publish_at: string | null
  publicado_en: string | null
  dueno: string | null
  /** La última reserva (cualquiera, también las que solo miran). */
  reservado_en: string | null
  /**
   * Cuándo se MANDÓ por última vez (reserva en publicando o subiendo). Es el
   * ancla de recientes() para un ambiguo: las reservas que solo miran no la
   * mueven, así una lista que falla varias veces no deja afuera el post.
   */
  enviado_en?: string | null
  /** De dónde vino el ambiguo (publicando | subiendo). Columna propia: un error posterior no la pisa. */
  ambiguo_desde?: string | null
  vence_en: string | null
  intentos: number
  proximo_intento: string | null
  visibilidad: string | null
  verificado_en: string | null
  ultimo_error: (ErrorGuardado & { cuando?: string }) | null
}

/** Una marca del estudio ({RECAUDADO}, {META}…) en cualquier forma: lo que la tenga no es un título publicado. */
export const MARCA_SUELTA = /\{[^{}]*\}/

/**
 * El título con el que se publica (y con el que se busca en recientes()).
 * Siempre el que salió de verdad, con los números puestos:
 *   1. textos.titulo (el guionista lo guarda ya con textoFinal);
 *   2. si falta, el segundo bloque de un texto publicado (textos.ts lo arma
 *      FICCION + título + …), que es el título tal cual salió;
 *   3. el del episodio solo si no trae marcas.
 * Con una marca sin reemplazar devuelve "": buscar «{RECAUDADO}» entre los
 * posts no encontraría nunca el que dice «$1.234», y "no está" sería publicar
 * dos veces. Vacío = no se busca a ciegas (revisar a mano).
 */
export function tituloDe(v: Pick<FilaVideo, "textos" | "episodio">): string {
  const limpio = (s: string | undefined | null) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim()
    return t && !MARCA_SUELTA.test(t) ? t : ""
  }
  const guardado = limpio(v.textos?.titulo)
  if (guardado) return guardado
  for (const texto of Object.values(v.textos?.porRed ?? {})) {
    if (!texto?.startsWith(FICCION)) continue
    const t = limpio(texto.split("\n\n")[1])
    if (t) return t
  }
  return limpio(v.episodio?.titulo)
}
