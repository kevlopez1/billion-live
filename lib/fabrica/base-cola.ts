// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL PUERTO DE BASE DE LA COLA Y DEL PARTE
//
// La cola (cola.ts) y el parte (reporte.ts) no tocan Supabase: reciben este
// puerto. Aquí está la interfaz y la implementación real, que solo llama a
// las funciones SQL de la parte 11 de supabase/correr-todo.sql (ahí vive la
// reserva, en una sentencia, con la hora de la base) y a lecturas simples.
// Los tests usan un falso en memoria (base-memoria.ts).
// ──────────────────────────────────────────────────────────────

import { getAdminClient } from "../supabase-admin"
import type { EstadoDeRed, EstadoEnvio, EstadoVideo, FilaEnvio, FilaEstado, FilaVideo, RedId } from "./tipos"

export type CamposEnvio = Record<string, unknown>
export type CamposVideo = Record<string, unknown>

export interface OpcionesReserva {
  /** false = revisar sin gastar un intento (mirar si salió). */
  sumar?: boolean
  /** true = solo para desprogramar YouTube con la fábrica pausada. */
  aunPausada?: boolean
}

export interface FilaReporte {
  dia: string
  generado_en: string
  enviado_en: string | null
  canal: string | null
  resumen: unknown
  texto: string
  error: string | null
}

export interface TokenConError {
  red: string
  ultimo_error: string | null
  expira_en: string | null
}

export interface BaseCola {
  /** Deja la hora del tick y devuelve el estado con el now() de la base. */
  latido(): Promise<{ ahora: Date; estado: FilaEstado }>
  leerEstado(): Promise<FilaEstado>
  vencidosAAmbiguo(): Promise<number>
  vencerAprobaciones(): Promise<{ guiones: number; videos: { dia: string; slot: number | null; hora: string }[] }>
  /** Los videos de esos días (Bolivia) y sus envíos. */
  cargar(dias: string[]): Promise<{ videos: FilaVideo[]; envios: FilaEnvio[] }>
  cubrirHueco(dia: string, slot: number, hora: string): Promise<FilaVideo | null>
  moverVideo(id: string, desde: EstadoVideo[], hasta: EstadoVideo, campos?: CamposVideo): Promise<boolean>
  reservarEnvio(
    id: string,
    desde: EstadoEnvio[],
    enCurso: EstadoEnvio,
    dueno: string,
    venceMin: number,
    maxIntentos: number,
    opciones?: OpcionesReserva,
  ): Promise<FilaEnvio | null>
  terminarEnvio(id: string, dueno: string, hasta: EstadoEnvio, campos?: CamposEnvio): Promise<boolean>
  moverEnvio(id: string, desde: EstadoEnvio[], hasta: EstadoEnvio, campos?: CamposEnvio): Promise<boolean>
  sumarGasto(usd: number): Promise<{ ok: boolean; gasto: number; tope: number; motivo?: string }>
  registrarResultado(red: RedId, ok: boolean): Promise<EstadoDeRed>
  pausar(motivo: string, por: string, red?: RedId): Promise<FilaEstado>
  reanudar(por: string, red?: RedId): Promise<FilaEstado>
  ajustar(campos: Partial<Pick<FilaEstado, "modo_aprobacion" | "videos_por_dia" | "tope_gasto_usd_dia">>): Promise<FilaEstado>
  /** El día (Bolivia) si lo ganó, o null. */
  reclamar(que: "tanda" | `tanda:${string}` | "parte", intentos: number, venceMin: number): Promise<string | null>
  terminarCandado(que: "tanda" | `tanda:${string}` | "parte", dia: string): Promise<boolean>
}

export interface BaseParte {
  cargar(dias: string[]): Promise<{ videos: FilaVideo[]; envios: FilaEnvio[] }>
  leerEstado(): Promise<FilaEstado>
  /** Reservas verdes listas para tomar un lugar. */
  reservaVerde(): Promise<number>
  tokensConError(): Promise<TokenConError[]>
  candado(que: "tanda" | "parte", dia: string): Promise<{ reclamado: string; terminado: string | null; intentos: number } | null>
  guardarParte(dia: string, resumen: unknown, texto: string, canal: string): Promise<boolean>
  resultadoParte(dia: string, error: string | null): Promise<void>
  ultimoParte(): Promise<FilaReporte | null>
}

// ── La implementación real ────────────────────────────────────

type Cliente = NonNullable<ReturnType<typeof getAdminClient>>

/** Un error de Supabase se lanza con el cómo: la cola lo atrapa por acción y lo loguea. */
function falla(que: string, error: { message: string; code?: string } | null): never {
  throw new Error(`[fabrica/base] ${que} falló: ${error?.message ?? "sin detalle"}${error?.code ? ` (${error.code})` : ""}`)
}

async function rpc<T>(db: Cliente, nombre: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(nombre, args)
  if (error) falla(nombre, error)
  return data as T
}

const primera = <T>(filas: T[] | null) => (Array.isArray(filas) && filas.length ? filas[0] : null)

const aEstado = (j: Record<string, unknown>): FilaEstado => ({
  ...(j as unknown as FilaEstado),
  tope_gasto_usd_dia: Number(j.tope_gasto_usd_dia),
  gasto_usd_dia: Number(j.gasto_usd_dia),
  redes: (j.redes ?? {}) as FilaEstado["redes"],
})

export function baseSupabase(db: Cliente): BaseCola & BaseParte {
  const leerEstado = async () => {
    const { data, error } = await db.from("fabrica_estado").select("*").eq("id", true).maybeSingle()
    if (error) falla("leer fabrica_estado", error)
    if (!data) throw new Error("[fabrica/base] fabrica_estado no tiene su fila: falta correr la parte 11 de supabase/correr-todo.sql")
    return aEstado(data)
  }
  const cargar = async (dias: string[]) => {
    const { data: videos, error } = await db.from("fabrica_videos").select("*").in("dia", dias)
    if (error) falla("leer fabrica_videos", error)
    const ids = (videos ?? []).map((v) => v.id as string)
    if (!ids.length) return { videos: [], envios: [] }
    const { data: envios, error: e2 } = await db.from("fabrica_envios").select("*").in("video_id", ids)
    if (e2) falla("leer fabrica_envios", e2)
    return { videos: (videos ?? []) as FilaVideo[], envios: (envios ?? []) as FilaEnvio[] }
  }

  return {
    async latido() {
      const j = await rpc<Record<string, unknown> | null>(db, "fabrica_latido", {})
      if (!j?.ahora) throw new Error("[fabrica/base] fabrica_latido no devolvió el estado: falta la fila de fabrica_estado (correr la parte 11 de supabase/correr-todo.sql)")
      return { ahora: new Date(String(j.ahora)), estado: aEstado(j) }
    },
    leerEstado,
    vencidosAAmbiguo: () => rpc<number>(db, "fabrica_vencidos_a_ambiguo", {}),
    vencerAprobaciones: () => rpc(db, "fabrica_vencer_aprobaciones", { p_horas: 24, p_min_sin_ok: 30 }),
    cargar,
    async cubrirHueco(dia, slot, hora) {
      return primera(await rpc<FilaVideo[]>(db, "fabrica_cubrir_hueco", { p_dia: dia, p_slot: slot, p_hora: hora }))
    },
    moverVideo: (id, desde, hasta, campos = {}) =>
      rpc<boolean>(db, "fabrica_mover_video", { p_id: id, p_desde: desde, p_hasta: hasta, p_campos: campos }),
    async reservarEnvio(id, desde, enCurso, dueno, venceMin, maxIntentos, o = {}) {
      return primera(
        await rpc<FilaEnvio[]>(db, "fabrica_reservar_envio", {
          p_id: id,
          p_desde: desde,
          p_en_curso: enCurso,
          p_dueno: dueno,
          p_vence_min: venceMin,
          p_max_intentos: maxIntentos,
          p_sumar: o.sumar ?? true,
          p_aun_pausada: o.aunPausada ?? false,
        }),
      )
    },
    terminarEnvio: (id, dueno, hasta, campos = {}) =>
      rpc<boolean>(db, "fabrica_terminar_envio", { p_id: id, p_dueno: dueno, p_hasta: hasta, p_campos: campos }),
    moverEnvio: (id, desde, hasta, campos = {}) =>
      rpc<boolean>(db, "fabrica_mover_envio", { p_id: id, p_desde: desde, p_hasta: hasta, p_campos: campos }),
    async sumarGasto(usd) {
      const j = await rpc<Record<string, unknown>>(db, "fabrica_sumar_gasto", { p_usd: usd })
      return { ok: j.ok === true, gasto: Number(j.gasto), tope: Number(j.tope), motivo: j.motivo as string | undefined }
    },
    registrarResultado: (red, ok) => rpc<EstadoDeRed>(db, "fabrica_registrar_resultado", { p_red: red, p_ok: ok }),
    async pausar(motivo, por, red) {
      return aEstado(await rpc(db, "fabrica_pausar", { p_motivo: motivo, p_por: por, p_red: red ?? null }))
    },
    async reanudar(por, red) {
      return aEstado(await rpc(db, "fabrica_reanudar", { p_por: por, p_red: red ?? null }))
    },
    async ajustar(campos) {
      const { data, error } = await db.from("fabrica_estado").update(campos).eq("id", true).select("*").single()
      if (error) falla("ajustar fabrica_estado", error)
      return aEstado(data)
    },
    reclamar: (que, intentos, venceMin) =>
      rpc<string | null>(db, "fabrica_reclamar", { p_que: que, p_intentos: intentos, p_vence_min: venceMin }),
    terminarCandado: (que, dia) => rpc<boolean>(db, "fabrica_terminar_candado", { p_que: que, p_dia: dia }),

    // ── El parte ──
    async reservaVerde() {
      const { count, error } = await db
        .from("fabrica_videos")
        .select("id", { count: "exact", head: true })
        .eq("es_reserva", true)
        .is("slot", null)
        .eq("semaforo", "verde")
        .eq("estado", "subido_parcial")
      if (error) falla("contar la reserva", error)
      return count ?? 0
    },
    async tokensConError() {
      const { data, error } = await db.from("fabrica_tokens").select("red, ultimo_error, expira_en").not("ultimo_error", "is", null)
      if (error) falla("leer fabrica_tokens", error)
      return (data ?? []) as TokenConError[]
    },
    async candado(que, dia) {
      const { data, error } = await db
        .from("fabrica_candados")
        .select("reclamado, terminado, intentos")
        .eq("que", que)
        .eq("dia", dia)
        .maybeSingle()
      if (error) falla("leer fabrica_candados", error)
      return data
    },
    guardarParte: (dia, resumen, texto, canal) =>
      rpc<boolean>(db, "fabrica_guardar_parte", { p_dia: dia, p_resumen: resumen, p_texto: texto, p_canal: canal }),
    async resultadoParte(dia, error) {
      await rpc(db, "fabrica_parte_resultado", { p_dia: dia, p_error: error })
    },
    async ultimoParte() {
      const { data, error } = await db.from("fabrica_reporte").select("*").order("dia", { ascending: false }).limit(1).maybeSingle()
      if (error) falla("leer fabrica_reporte", error)
      return (data as FilaReporte | null) ?? null
    },
  }
}

/** La base real, o null si falta SUPABASE_SERVICE_ROLE_KEY. */
export function baseReal(): (BaseCola & BaseParte) | null {
  const db = getAdminClient()
  return db ? baseSupabase(db) : null
}
