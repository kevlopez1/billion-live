import { NextResponse } from "next/server"
import { conLlave } from "@/lib/fabrica/auth"
import { baseReal } from "@/lib/fabrica/base-cola"
import { ejecutarTick } from "@/lib/fabrica/cola"
import { adaptadores, ctxReal } from "@/lib/fabrica/registro-redes"
import { canalHttp, hacerParte } from "@/lib/fabrica/reporte"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// El tick trabaja 45 s como mucho (presupuesto de cola.ts) y deja 15 de margen:
// lo pesado (subir a YouTube, la media de X) lo hace la VM, nunca esta ruta.
export const maxDuration = 60

// ──────────────────────────────────────────────────────────────
// El tick de la fábrica: lo llama pg_cron cada 10 minutos con
// `Bearer FABRICA_CRON_SECRET` (supabase/correr-todo.sql, parte 11).
// ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const a = conLlave(req, "FABRICA_CRON_SECRET")
  if (a === "sin-clave") {
    return NextResponse.json({ error: "Falta FABRICA_CRON_SECRET (24 caracteres o más) en las variables de entorno." }, { status: 500 })
  }
  if (!a) return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })

  const base = baseReal()
  if (!base) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  const env = process.env
  const canal = canalHttp(env)
  try {
    const r = await ejecutarTick({
      base,
      adaptadores: adaptadores(),
      ctx: ctxReal(env),
      env,
      reloj: Date.now,
      parte: () => hacerParte({ base, canal }),
    })
    return NextResponse.json(r)
  } catch (e) {
    // Sin latido o sin carga no hay tick: se dice con el cómo, y el vigilante
    // lo ve en ultimo_tick_en.
    const como = e instanceof Error ? e.message : String(e)
    console.error(`[fabrica/tick] el tick falló: ${como}`)
    return NextResponse.json({ error: `El tick falló: ${como}` }, { status: 500 })
  }
}
