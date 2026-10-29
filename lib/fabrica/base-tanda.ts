// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL PUERTO DE BASE DE LA TANDA (Supabase, service role)
//
// Lo mismo que base-cola.ts: solo llama a las funciones SQL de la parte 11
// de supabase/correr-todo.sql (ahí vive la reserva, en una sentencia y con
// la hora de la base) y a lecturas e inserciones simples. Cada error se
// lanza con el cómo; la tanda lo atrapa por paso y lo guarda.
// ──────────────────────────────────────────────────────────────

import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { getAdminClient } from "../supabase-admin"
import { baseSupabase } from "./base-cola"
import type { BaseTanda, FilaVideoTanda } from "./tanda"
import type { FilaEnvio } from "./tipos"

type Cliente = NonNullable<ReturnType<typeof getAdminClient>>

function falla(que: string, error: { message: string; code?: string } | null): never {
  throw new Error(`[fabrica/base-tanda] ${que} falló: ${error?.message ?? "sin detalle"}${error?.code ? ` (${error.code})` : ""}`)
}

const primera = <T,>(filas: T[] | null) => (Array.isArray(filas) && filas.length ? filas[0] : null)

export function baseTandaSupabase(db: Cliente): BaseTanda {
  const cola = baseSupabase(db)
  return {
    vencidosAAmbiguo: () => cola.vencidosAAmbiguo(),
    leerEstado: () => cola.leerEstado(),
    reclamar: (que, intentos, venceMin) => cola.reclamar(que, intentos, venceMin),
    terminarCandado: (que, dia) => cola.terminarCandado(que, dia),
    sumarGasto: (usd) => cola.sumarGasto(usd),
    reservarEnvio: (id, desde, enCurso, dueno, venceMin, maxIntentos) => cola.reservarEnvio(id, desde, enCurso, dueno, venceMin, maxIntentos),
    terminarEnvio: (id, dueno, hasta, campos) => cola.terminarEnvio(id, dueno, hasta, campos),

    async videosDe(dias) {
      const { data, error } = await db.from("fabrica_videos").select("*").in("dia", dias)
      if (error) falla("leer fabrica_videos", error)
      return (data ?? []) as FilaVideoTanda[]
    },
    async reservasVivas() {
      const { data, error } = await db
        .from("fabrica_videos")
        .select("*")
        .eq("es_reserva", true)
        .is("slot", null)
        .not("estado", "in", "(publicado,fallido,rechazado)")
      if (error) falla("leer la reserva", error)
      return (data ?? []) as FilaVideoTanda[]
    },
    async guionesRecientes(n) {
      // Por `actualizado`, no por `creado`: `creado` es cuando se insertó la
      // IDEA, y una reserva de hace varias noches con guion de anoche quedaría
      // fuera. Además, TODAS las reservas vivas con guion: pueden salir
      // cualquier día de la semana, así que siempre cuentan para la similitud.
      const [recientes, reservas] = await Promise.all([
        db.from("fabrica_videos").select("id, episodio").not("episodio", "is", null).order("actualizado", { ascending: false }).limit(n),
        db
          .from("fabrica_videos")
          .select("id, episodio")
          .not("episodio", "is", null)
          .eq("es_reserva", true)
          .is("slot", null)
          .not("estado", "in", "(publicado,fallido,rechazado)"),
      ])
      if (recientes.error) falla("leer los guiones recientes", recientes.error)
      if (reservas.error) falla("leer los guiones de la reserva", reservas.error)
      const vistos = new Set<string>()
      return [...(recientes.data ?? []), ...(reservas.data ?? [])]
        .filter((f: { id: string }) => (vistos.has(f.id) ? false : (vistos.add(f.id), true)))
        .map((f: { episodio: unknown }) => f.episodio as Episodio)
    },
    async insertarVideo(f) {
      const { data, error } = await db
        .from("fabrica_videos")
        .insert({
          dia: f.dia,
          slot: f.slot,
          hora_salida: f.hora_salida,
          es_reserva: f.es_reserva,
          estado: "idea",
          pilar: f.pilar,
          personajes: f.personajes,
          idea: f.idea,
        })
        .select("id")
        .single()
      if (error) {
        // 23505 = el lugar (dia, slot) ya tiene video: otra corrida lo llenó.
        return { ok: false, ocupado: error.code === "23505", como: `${error.message}${error.code ? ` (${error.code})` : ""}` }
      }
      return { ok: true, id: String((data as { id: string }).id) }
    },
    async reservarVideo(id, desde, trabajo, dueno, venceMin, maxIntentos) {
      const { data, error } = await db.rpc("fabrica_reservar_video", {
        p_id: id,
        p_desde: desde,
        p_trabajo: trabajo,
        p_dueno: dueno,
        p_vence_min: venceMin,
        p_max_intentos: maxIntentos,
      })
      if (error) falla("fabrica_reservar_video", error)
      return primera(data as FilaVideoTanda[] | null)
    },
    async terminarVideo(id, dueno, hasta, campos = {}) {
      const { data, error } = await db.rpc("fabrica_terminar_video", { p_id: id, p_dueno: dueno, p_hasta: hasta, p_campos: campos })
      if (error) falla("fabrica_terminar_video", error)
      return data === true
    },
    async crearEnvios(videoId, redes) {
      const { error } = await db
        .from("fabrica_envios")
        .upsert(
          redes.map((red) => ({ video_id: videoId, red })),
          { onConflict: "video_id,red", ignoreDuplicates: true },
        )
      if (error) falla("crear fabrica_envios", error)
    },
    async enviosDe(videoId) {
      const { data, error } = await db.from("fabrica_envios").select("*").eq("video_id", videoId)
      if (error) falla("leer fabrica_envios", error)
      return (data ?? []) as FilaEnvio[]
    },
    async guardarResumen(r) {
      // La hora es la de la máquina: es un dato para el parte, no una reserva.
      const { error } = await db.from("fabrica_estado").update({ ultima_tanda_en: r.termino ?? new Date().toISOString(), ultima_tanda: r }).eq("id", true)
      if (error) falla("guardar ultima_tanda", error)
    },
  }
}

/** La base real, o null si falta SUPABASE_SERVICE_ROLE_KEY. */
export function baseTandaReal(): BaseTanda | null {
  const db = getAdminClient()
  return db ? baseTandaSupabase(db) : null
}
