import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { validarDecision } from "@/lib/fabrica/panel"
import { cargarPanel, decidir } from "@/lib/fabrica/panel-base"
import { getAdminClient } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ──────────────────────────────────────────────────────────────
// Lo que espera el OK de Kev (solo Kev).
//   GET   los pendientes: guiones con amarillos y, en modo aprobación,
//         videos terminados sin OK.
//   POST  { id, que: "guion"|"video", decision: "aprobar"|"rechazar", hash, motivo? }
//         La base decide en UNA sentencia (fabrica_decidir) y solo si el
//         video sigue como Kev lo vio: mismo estado, mismo guion, nadie
//         trabajándolo. Si no aplica, 409 con el motivo.
// ──────────────────────────────────────────────────────────────

const sinBase = () => NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
const fallo = (que: string, e: unknown) => {
  const como = e instanceof Error ? e.message : String(e)
  console.error(`[fabrica/aprobar] ${que} falló: ${como}`)
  return NextResponse.json({ error: `${que} falló: ${como}` }, { status: 500 })
}

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)
  const db = getAdminClient()
  if (!db) return sinBase()
  try {
    const vista = await cargarPanel(db)
    return NextResponse.json({ decisiones: vista.decisiones, modo_aprobacion: vista.estado.modoAprobacion })
  } catch (e) {
    return fallo("Leer los pendientes", e)
  }
}

export async function POST(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }
  const v = validarDecision(cuerpo)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const p = v.pedido

  const db = getAdminClient()
  if (!db) return sinBase()
  try {
    const r = await decidir(db, p, "kev")
    console.log(`[fabrica/aprobar] kev → ${p.decision} ${p.que} ${p.id}: ${r.ok ? `ok (${r.estado})` : `no aplicó: ${r.motivo}`}`)
    if (!r.ok) return NextResponse.json({ error: `No se aplicó: ${r.motivo}`, estado: r.estado }, { status: 409 })
    return NextResponse.json({ ok: true, estado: r.estado })
  } catch (e) {
    return fallo(p.decision === "aprobar" ? "Aprobar" : "Rechazar", e)
  }
}
