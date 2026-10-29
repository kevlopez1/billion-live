import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { cargarPanel } from "@/lib/fabrica/panel-base"
import { getAdminClient } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ──────────────────────────────────────────────────────────────
// GET (solo Kev): todo lo que muestra la sección «Fábrica» de /publicar, ya
// armado (lib/fabrica/panel.ts). Pausar y reanudar van a /api/fabrica/estado;
// aprobar y rechazar, a /api/fabrica/aprobar.
// ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)
  const db = getAdminClient()
  if (!db) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  try {
    return NextResponse.json(await cargarPanel(db))
  } catch (e) {
    const como = e instanceof Error ? e.message : String(e)
    console.error(`[fabrica/panel] leer el panel falló: ${como}`)
    return NextResponse.json({ error: `No se pudo leer la fábrica: ${como}` }, { status: 500 })
  }
}
