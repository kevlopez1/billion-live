import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { CHALLENGE_LAUNCH, CHALLENGE_TARGET, RECAUDADO, montoConfiable } from "@/lib/contador"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ──────────────────────────────────────────────────────────────
// El número del contador, tal cual lo muestra la portada.
//
// Lo lee el publicador diario (Railway) para armar la imagen del día. Misma
// regla que la home, /centro y la vista previa: la base solo manda si la fila
// es del reto; si no, RECAUDADO. Así la imagen nunca contradice a la web.
// ──────────────────────────────────────────────────────────────

const DIA = 86_400_000

export async function GET() {
  let monto = RECAUDADO
  let fuente: "base" | "codigo" = "codigo"
  const admin = getAdminClient()
  if (admin) {
    const { data } = await admin.from("global_metrics").select("net_worth, updated_at").limit(1).maybeSingle()
    const confiable = montoConfiable(data)
    if (confiable !== null) {
      monto = confiable
      fuente = "base"
    }
  }
  const dia = Math.max(1, Math.floor((Date.now() - Date.parse(CHALLENGE_LAUNCH)) / DIA) + 1)
  return NextResponse.json(
    { monto, meta: CHALLENGE_TARGET, dia, dia1: CHALLENGE_LAUNCH, fuente },
    { headers: { "Cache-Control": "no-store" } },
  )
}
