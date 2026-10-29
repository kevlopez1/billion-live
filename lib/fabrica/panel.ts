// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LO QUE VE KEV EN /publicar (puro)
//
// Las filas de la base entran crudas y salen como una vista corta: el estado
// del interruptor, lo de hoy, la cola de hoy y mañana con el estado por red,
// lo que espera su OK y el último parte. El nombre y la luz de cada personaje
// se ponen aquí, en el servidor: personajes.ts pesa 110 kB y no va al
// navegador.
//
// También valida lo que el panel manda a /api/fabrica/aprobar.
// Se prueba con `npx tsx lib/fabrica/panel.test.ts` (sin red ni base).
// ──────────────────────────────────────────────────────────────

import { z } from "zod"
import { RESERVA_MINIMA } from "./reporte"
import { luzDe, type Luz } from "./semaforo"
import {
  REDES,
  diaBolivia,
  horaBolivia,
  sumarDias,
  tituloDe,
  type EstadoEnvio,
  type EstadoVideo,
  type FilaEnvio,
  type FilaEstado,
  type FilaVideo,
  type RedId,
} from "./tipos"
import type { FilaReporte } from "./base-cola"

/** Lo que trae una fila de fabrica_videos además de lo que usa la cola. */
export type FilaVideoPanel = FilaVideo & {
  guion_hash?: string | null
  avisos?: string[] | null
  trabajo?: string | null
  aprobado_guion_en?: string | null
  errores?: unknown
  episodio?: (FilaVideo["episodio"] & { planos?: { titulo?: string; rotulo?: string; dialogo?: { quien?: string; texto?: string }[] }[] }) | null
}

export interface PersonajeVista {
  id: string
  nombre: string
  luz: Luz
}

export interface EnvioVista {
  red: RedId
  estado: EstadoEnvio
  enlace: string | null
  intentos: number
  /** Hora de Bolivia del próximo intento, si espera uno. */
  proximo: string | null
  /** El último error con el cómo, tal cual lo guardó la cola. */
  error: string | null
}

export type Espera = "guion" | "video"

export interface VideoVista {
  id: string
  dia: string
  slot: number | null
  /** "21:30", hora de Bolivia. */
  hora: string | null
  esReserva: boolean
  estado: EstadoVideo
  /** Su nombre en pantalla. */
  pilar: string | null
  titulo: string
  semaforo: "verde" | "amarillo" | null
  personajes: PersonajeVista[]
  envios: EnvioVista[]
  /** Los últimos 3 errores del video, cada uno con su paso y su cómo. */
  errores: string[]
  motivoRechazo: string | null
  /** Qué espera de Kev, si algo. */
  espera: Espera | null
  guionHash: string | null
  /** Lo que la fábrica le está haciendo ahora (reserva vigente). */
  trabajando: string | null
}

export interface DecisionVista {
  que: Espera
  video: VideoVista
  /** El diálogo del guion, con el nombre de quien habla. */
  dialogo: { quien: string; texto: string }[]
  /** Títulos y rótulos de los planos, en orden. */
  rotulos: string[]
  avisos: string[]
  duracionS: number | null
  /** El texto que sale en YouTube (o el primero que haya): lo que se publica. */
  texto: string | null
}

export interface VistaPanel {
  ahora: string
  hoy: string
  manana: string
  estado: {
    pausada: boolean
    motivo: string | null
    pausadaPor: string | null
    pausadaEn: string | null
    modoAprobacion: boolean
    videosPorDia: number
    topeUsd: number
    redesPausadas: { red: RedId; motivo: string | null }[]
    ultimoTick: string | null
    ultimaTanda: string | null
  }
  /** Los contadores de hoy (si la base todavía no cambió de día, hoy no pasó nada: 0). */
  delDia: { gastoUsd: number; publicados: number; fallidos: number; enCola: number; rechazados: number }
  cola: VideoVista[]
  reserva: { verdes: number; minima: number }
  decisiones: DecisionVista[]
  parte: { dia: string; generadoEn: string; enviadoEn: string | null; texto: string; error: string | null } | null
}

export interface EntradaVista {
  ahora: Date
  estado: FilaEstado
  /** Los videos de hoy y mañana con sus envíos. */
  videos: FilaVideoPanel[]
  envios: FilaEnvio[]
  /** Los que pueden esperar una decisión, de cualquier día (sin envíos). */
  pendientes: FilaVideoPanel[]
  parte: FilaReporte | null
  reservaVerde: number
  /** id → nombre de pantalla (de personajes.ts). */
  nombres: ReadonlyMap<string, string>
}

const ESPERA_VIDEO: readonly EstadoVideo[] = ["calidad_ok", "subido_parcial", "programado"]

/** Qué espera ese video de Kev. El guion, siempre; el video, solo en modo aprobación. */
export function esperaDe(v: Pick<FilaVideoPanel, "estado" | "aprobado_video_en">, modoAprobacion: boolean): Espera | null {
  if (v.estado === "aprobacion_pendiente") return "guion"
  if (modoAprobacion && ESPERA_VIDEO.includes(v.estado) && !v.aprobado_video_en) return "video"
  return null
}

/** Los errores guardados ({paso, como, …}) como renglones, los últimos n. */
export function erroresLegibles(errores: unknown, n = 3): string[] {
  if (!Array.isArray(errores)) return []
  return errores
    .slice(-n)
    .map((e) => {
      if (!e || typeof e !== "object") return String(e)
      const x = e as { paso?: unknown; como?: unknown; codigo?: unknown }
      const codigo = x.codigo ? ` (${String(x.codigo)})` : ""
      return `${x.paso ? `${String(x.paso)}: ` : ""}${String(x.como ?? "sin detalle")}${codigo}`
    })
    .reverse()
}

const vigente = (dueno: string | null | undefined, vence: string | null | undefined, ahora: Date) =>
  !!dueno && !!vence && Date.parse(vence) > ahora.getTime()

function videoVista(v: FilaVideoPanel, envios: FilaEnvio[], e: EntradaVista): VideoVista {
  const fecha = v.dia
  const propios = envios.filter((x) => x.video_id === v.id)
  const orden = (r: RedId) => REDES.indexOf(r)
  return {
    id: v.id,
    dia: v.dia,
    slot: v.slot,
    hora: v.hora_salida ? horaBolivia(new Date(v.hora_salida)) : null,
    esReserva: v.es_reserva,
    estado: v.estado,
    pilar: nombrePilar(v.pilar),
    titulo: tituloDe(v) || "(sin título todavía)",
    semaforo: v.semaforo,
    personajes: (v.personajes ?? []).map((id) => ({ id, nombre: e.nombres.get(id) ?? id, luz: luzDe(id, fecha) })),
    envios: propios
      .sort((a, b) => orden(a.red) - orden(b.red))
      .map((x) => ({
        red: x.red,
        estado: x.estado,
        enlace: x.enlace,
        intentos: x.intentos,
        proximo:
          x.proximo_intento && Date.parse(x.proximo_intento) > e.ahora.getTime() ? horaBolivia(new Date(x.proximo_intento)) : null,
        error: x.ultimo_error ? `${x.ultimo_error.paso}: ${x.ultimo_error.como}${x.ultimo_error.codigo ? ` (${x.ultimo_error.codigo})` : ""}` : null,
      })),
    errores: erroresLegibles(v.errores),
    motivoRechazo: v.motivo_rechazo,
    espera: esperaDe(v, e.estado.modo_aprobacion),
    guionHash: v.guion_hash ?? null,
    trabajando: vigente(v.dueno, v.vence_en, e.ahora) ? (v.trabajo ?? "trabajo en curso") : null,
  }
}

function decisionVista(v: FilaVideoPanel, que: Espera, e: EntradaVista, envios: FilaEnvio[]): DecisionVista {
  const planos = Array.isArray(v.episodio?.planos) ? v.episodio!.planos! : []
  const dialogo: DecisionVista["dialogo"] = []
  const rotulos: string[] = []
  for (const p of planos) {
    for (const t of [p.titulo, p.rotulo]) if (typeof t === "string" && t.trim()) rotulos.push(t.trim())
    for (const l of Array.isArray(p.dialogo) ? p.dialogo : []) {
      if (typeof l?.texto !== "string" || !l.texto.trim()) continue
      const quien = typeof l.quien === "string" ? l.quien : "?"
      dialogo.push({ quien: e.nombres.get(quien) ?? quien, texto: l.texto.trim() })
    }
  }
  const porRed = v.textos?.porRed ?? {}
  const texto = porRed.youtube ?? Object.values(porRed).find((t) => typeof t === "string") ?? null
  return {
    que,
    video: videoVista(v, envios, e),
    dialogo,
    rotulos,
    avisos: Array.isArray(v.avisos) ? v.avisos : [],
    duracionS: v.duracion_s === null || v.duracion_s === undefined ? null : Number(v.duracion_s),
    texto,
  }
}

const porSalida = (a: VideoVista, b: VideoVista) =>
  a.dia.localeCompare(b.dia) || (a.slot ?? 99) - (b.slot ?? 99) || (a.hora ?? "99").localeCompare(b.hora ?? "99")

export function vistaDelPanel(e: EntradaVista): VistaPanel {
  const hoy = diaBolivia(e.ahora)
  const manana = sumarDias(hoy, 1)
  const s = e.estado
  const delDiaVale = s.dia === hoy

  const cola = e.videos.filter((v) => !v.es_reserva && (v.dia === hoy || v.dia === manana)).map((v) => videoVista(v, e.envios, e))
  cola.sort(porSalida)

  // Las decisiones: las de la cola y las de cualquier otro día, sin repetir.
  const vistos = new Set<string>()
  const decisiones: DecisionVista[] = []
  for (const v of [...e.videos, ...e.pendientes]) {
    if (vistos.has(v.id)) continue
    vistos.add(v.id)
    const que = esperaDe(v, s.modo_aprobacion)
    if (que) decisiones.push(decisionVista(v, que, e, e.envios))
  }
  decisiones.sort((a, b) => porSalida(a.video, b.video))

  const deHoy = cola.filter((v) => v.dia === hoy)
  return {
    ahora: e.ahora.toISOString(),
    hoy,
    manana,
    estado: {
      pausada: s.pausada,
      motivo: s.motivo,
      pausadaPor: s.pausada_por,
      pausadaEn: s.pausada_en,
      modoAprobacion: s.modo_aprobacion,
      videosPorDia: s.videos_por_dia,
      topeUsd: Number(s.tope_gasto_usd_dia),
      redesPausadas: (Object.entries(s.redes ?? {}) as [RedId, { pausada?: boolean; motivo?: string }][])
        .filter(([, r]) => r?.pausada)
        .map(([red, r]) => ({ red, motivo: r.motivo ?? null })),
      ultimoTick: s.ultimo_tick_en,
      ultimaTanda: s.ultima_tanda_en,
    },
    delDia: {
      gastoUsd: delDiaVale ? Number(s.gasto_usd_dia) : 0,
      publicados: delDiaVale ? s.publicados_dia : 0,
      fallidos: delDiaVale ? s.fallidos_dia : 0,
      enCola: deHoy.filter((v) => !["publicado", "fallido", "rechazado"].includes(v.estado)).length,
      rechazados: deHoy.filter((v) => v.estado === "rechazado").length,
    },
    cola,
    reserva: { verdes: e.reservaVerde, minima: RESERVA_MINIMA },
    decisiones,
    parte: e.parte
      ? { dia: e.parte.dia, generadoEn: e.parte.generado_en, enviadoEn: e.parte.enviado_en, texto: e.parte.texto, error: e.parte.error }
      : null,
  }
}

// ── Lo que el panel manda a /api/fabrica/aprobar ──────────────

const Decision = z.object({
  id: z.string().uuid(),
  que: z.enum(["guion", "video"]),
  decision: z.enum(["aprobar", "rechazar"]),
  // El hash del guion que Kev VIO: si cambió, la base no aplica la decisión.
  hash: z.string().max(200).nullable(),
  motivo: z.string().trim().max(300).optional(),
})
export type PedidoDecision = z.infer<typeof Decision>

export function validarDecision(cuerpo: unknown): { ok: true; pedido: PedidoDecision } | { ok: false; error: string } {
  const r = Decision.safeParse(cuerpo)
  if (r.success) return { ok: true, pedido: r.data }
  return { ok: false, error: `Pedido inválido: ${r.error.issues.map((i) => `${i.path.join(".") || "cuerpo"} ${i.message}`).join("; ")}` }
}

/** Lo que devuelve fabrica_decidir, leído sin confiar en la forma. */
export function leerResultadoDecision(j: unknown): { ok: boolean; estado: string | null; motivo: string | null } {
  if (!j || typeof j !== "object") return { ok: false, estado: null, motivo: "la base no devolvió nada" }
  const x = j as { ok?: unknown; estado?: unknown; motivo?: unknown }
  return {
    ok: x.ok === true,
    estado: typeof x.estado === "string" ? x.estado : null,
    motivo: typeof x.motivo === "string" ? x.motivo : x.ok === true ? null : "sin motivo",
  }
}

/** El nombre de un pilar en pantalla. Uno desconocido sale tal cual. */
export const nombrePilar = (p: string | null): string | null =>
  p === null ? null : ({ "camara-oculta": "Cámara oculta", historia: "Historia", consejo: "El consejo" } as Record<string, string>)[p] ?? p
