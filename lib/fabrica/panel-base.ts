// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LO QUE LEE Y ESCRIBE EL PANEL DE /publicar (I/O)
//
// Lecturas simples y una sola escritura: fabrica_decidir (parte 11 de
// supabase/correr-todo.sql), que aprueba o rechaza en UNA sentencia y solo si
// el video sigue como Kev lo vio. La vista sale de panel.ts (puro).
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { getAdminClient } from "../supabase-admin"
import { baseSupabase } from "./base-cola"
import { leerResultadoDecision, vistaDelPanel, type FilaVideoPanel, type PedidoDecision, type VistaPanel } from "./panel"
import { diaBolivia, sumarDias } from "./tipos"

type Cliente = NonNullable<ReturnType<typeof getAdminClient>>

const NOMBRES: ReadonlyMap<string, string> = new Map(PERSONAJES.map((p) => [p.id, p.corto || p.nombre]))

/** Los que pueden esperar a Kev, de cualquier día: guion con amarillos, o video terminado sin OK. */
async function pendientes(db: Cliente): Promise<FilaVideoPanel[]> {
  const { data, error } = await db
    .from("fabrica_videos")
    .select("*")
    .in("estado", ["aprobacion_pendiente", "calidad_ok", "subido_parcial", "programado"])
    .order("dia", { ascending: true })
    .limit(60)
  if (error) throw new Error(`[fabrica/panel] leer los pendientes falló: ${error.message}${error.code ? ` (${error.code})` : ""}`)
  return (data ?? []) as FilaVideoPanel[]
}

export async function cargarPanel(db: Cliente, ahora = new Date()): Promise<VistaPanel> {
  const base = baseSupabase(db)
  const hoy = diaBolivia(ahora)
  const [estado, carga, parte, reservaVerde, pend] = await Promise.all([
    base.leerEstado(),
    base.cargar([hoy, sumarDias(hoy, 1)]),
    base.ultimoParte(),
    base.reservaVerde(),
    pendientes(db),
  ])
  return vistaDelPanel({
    ahora,
    estado,
    videos: carga.videos as FilaVideoPanel[],
    envios: carga.envios,
    pendientes: pend,
    parte,
    reservaVerde,
    nombres: NOMBRES,
  })
}

export async function decidir(db: Cliente, p: PedidoDecision, por: string) {
  const { data, error } = await db.rpc("fabrica_decidir", {
    p_id: p.id,
    p_que: p.que,
    p_aprobar: p.decision === "aprobar",
    p_hash: p.hash,
    p_por: por,
    p_motivo: p.motivo ?? null,
  })
  if (error) throw new Error(`[fabrica/panel] fabrica_decidir falló: ${error.message}${error.code ? ` (${error.code})` : ""}`)
  return leerResultadoDecision(data)
}
