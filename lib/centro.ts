// ──────────────────────────────────────────────────────────────
// /centro — TODO EN UN LUGAR
//
// No guarda nada propio: lee de las mismas fuentes que ya usa cada
// herramienta (el contador, los comprobantes, el manual, los proyectos, las
// preguntas, las publicaciones y las cuentas de Meta) y las pone juntas. Si
// tuviera su propia copia de algún número, dejaría de coincidir con la página
// de donde salió el primer día que alguien edite una de las dos.
//
// Regla "todo real": lo que no se puede leer va como null, nunca como 0. Un
// cero dice "medimos y no hay"; null dice "no sabemos", que es lo honesto.
// ──────────────────────────────────────────────────────────────

import { CANTIDAD, DESDE, ENTIDADES, HASTA, TOTAL_BS } from "@/lib/comprobantes"
import {
  CHALLENGE_DEADLINE, CHALLENGE_LAUNCH, CHALLENGE_RECORD_DEADLINE, CHALLENGE_TARGET, RECAUDADO, montoConfiable,
} from "@/lib/contador"
import { CONTENIDO_BASE, type Contenido } from "@/lib/branding"
import { llenas, semilla as semillaPreguntas, sumarDelManual, valido as preguntasValidas } from "@/lib/preguntas"
import { avanceTotal, migrar } from "@/lib/proyectos"
import { configurado as metaConfigurado, resumenRedes, type Redes } from "@/lib/meta"
import { getAdminClient } from "@/lib/supabase-admin"

const DIA = 86_400_000

export type Centro = {
  reto: {
    recaudado: number
    meta: number
    porcentaje: number
    dia: number
    diasAlRecord: number
    diasAlLimite: number
    /** Lo que entra por día en promedio desde el día 1. */
    ritmoActual: number
    /** Lo que tendría que entrar por día desde hoy para llegar a cada fecha. */
    ritmoRecord: number
    ritmoLimite: number
  }
  dinero: { comprobantes: number; totalBs: number; entidades: number; desde: string; hasta: string }
  trabajo: {
    tareas: { hechas: number; total: number } | null
    preguntas: { pregunta: string; van: number; meta: number }[]
    manualPorDefinir: string[]
  }
  contenido: { publicaciones: number; vistas: number; ultima: string | null } | null
  redes: Redes | null
  /** Qué no se pudo leer y por qué. Se muestra tal cual. */
  avisos: string[]
}

const diasEntre = (a: number, b: number) => Math.max(0, Math.ceil((b - a) / DIA))

export async function centro(ahora = Date.now()): Promise<Centro> {
  const admin = getAdminClient()
  const avisos: string[] = []
  if (!admin) avisos.push("Sin conexión a la base (falta SUPABASE_SERVICE_ROLE_KEY): trabajo y contenido salen sin datos guardados.")

  // ── El reto ──
  let recaudado = RECAUDADO
  if (admin) {
    const { data } = await admin.from("global_metrics").select("net_worth, updated_at").limit(1).maybeSingle()
    recaudado = montoConfiable(data) ?? RECAUDADO
  }
  const inicio = Date.parse(CHALLENGE_LAUNCH)
  const dia = Math.max(1, Math.floor((ahora - inicio) / DIA) + 1)
  const diasAlRecord = diasEntre(ahora, Date.parse(CHALLENGE_RECORD_DEADLINE + "T23:59:59"))
  const diasAlLimite = diasEntre(ahora, Date.parse(CHALLENGE_DEADLINE + "T23:59:59"))
  const falta = Math.max(0, CHALLENGE_TARGET - recaudado)
  const reto: Centro["reto"] = {
    recaudado,
    meta: CHALLENGE_TARGET,
    porcentaje: Math.min(100, (recaudado / CHALLENGE_TARGET) * 100),
    dia,
    diasAlRecord,
    diasAlLimite,
    ritmoActual: recaudado / dia,
    ritmoRecord: diasAlRecord ? falta / diasAlRecord : falta,
    ritmoLimite: diasAlLimite ? falta / diasAlLimite : falta,
  }

  const dinero = { comprobantes: CANTIDAD, totalBs: TOTAL_BS, entidades: ENTIDADES, desde: DESDE, hasta: HASTA }

  // ── El trabajo ──
  let manual: Contenido = CONTENIDO_BASE
  let tareas: Centro["trabajo"]["tareas"] = null
  const preguntas: Centro["trabajo"]["preguntas"] = []

  let q: { data: { contenido: unknown } | null; error: unknown } | null = null
  if (admin) {
    const [b, p, qq] = await Promise.all([
      admin.from("branding").select("contenido").eq("id", "kev-project-gta").maybeSingle(),
      admin.from("proyectos_kev").select("contenido").eq("id", "kev-lopez").maybeSingle(),
      admin.from("preguntas").select("contenido").eq("id", "kev-lopez").maybeSingle(),
    ])
    q = qq
    if (b.data?.contenido) manual = b.data.contenido as Contenido
    const tablero = migrar(p.data?.contenido)
    if (tablero) {
      tareas = tablero.espacios.reduce(
        (a, e) => {
          const t = avanceTotal(e.doc)
          return { hechas: a.hechas + t.hechas, total: a.total + t.total }
        },
        { hechas: 0, total: 0 },
      )
    } else if (p.error) {
      avisos.push("Los proyectos todavía no tienen tabla: corre supabase/correr-todo.sql.")
    }
    if (q.error) avisos.push("Las preguntas todavía no tienen tabla: corre supabase/correr-todo.sql.")
  }
  // Las preguntas son un espacio aparte; se suman las que alguna vez se
  // contestaron dentro del manual, igual que hace /api/preguntas.
  const base = admin && preguntasValidas(q?.data?.contenido) ? q!.data!.contenido : semillaPreguntas()
  for (const x of sumarDelManual(base, manual.preguntas).preguntas) {
    preguntas.push({ pregunta: x.pregunta, van: llenas(x), meta: x.meta })
  }

  // Lo que el propio manual marca como sin definir.
  const manualPorDefinir = [
    ...manual.edicion.bloques.filter((b) => b.reglas.length === 0).map((b) => `La edición: ${b.titulo}`),
    ...manual.redes
      .filter((r) => r.estado === "usamos" && !r.salida?.pieza?.trim())
      .map((r) => `Qué pieza va a ${r.nombre}`),
  ]

  // ── El contenido ──
  let contenido: Centro["contenido"] = null
  if (admin) {
    const { data, error } = await admin.from("publicaciones").select("vistas, fecha")
    if (error) {
      avisos.push("Las publicaciones todavía no tienen tabla: corre supabase/correr-todo.sql.")
    } else {
      const filas = (data ?? []) as { vistas: number; fecha: string }[]
      contenido = {
        publicaciones: filas.length,
        vistas: filas.reduce((a, f) => a + Number(f.vistas || 0), 0),
        ultima: filas.map((f) => f.fecha).sort().at(-1) ?? null,
      }
    }
  }

  // ── Las cuentas ──
  let redes: Redes | null = null
  const m = metaConfigurado()
  if (m.ok) redes = await resumenRedes()
  else avisos.push(`Instagram y Facebook sin conectar: falta ${m.falta} en Vercel.`)

  return {
    reto,
    dinero,
    trabajo: { tareas, preguntas, manualPorDefinir },
    contenido,
    redes,
    avisos,
  }
}
