import { NextResponse } from "next/server"
import { conLlave } from "@/lib/fabrica/auth"
import { baseReal } from "@/lib/fabrica/base-cola"
import { respuestaVigilante } from "@/lib/fabrica/reporte"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ──────────────────────────────────────────────────────────────
// Solo lectura, para el bot de Prime (`Bearer FABRICA_VIGILANTE_SECRET`).
// A las 23:30 lo consulta: si no contesta, si el último tick tiene más de
// 30 min o si no hay parte enviado, avisa a Kev y a la segunda persona.
// ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const a = conLlave(req, "FABRICA_VIGILANTE_SECRET")
  if (a === "sin-clave") {
    return NextResponse.json({ error: "Falta FABRICA_VIGILANTE_SECRET (24 caracteres o más) en las variables de entorno." }, { status: 500 })
  }
  if (!a) return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })

  const base = baseReal()
  if (!base) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  try {
    const [estado, parte, reserva] = await Promise.all([base.leerEstado(), base.ultimoParte(), base.reservaVerde()])
    return NextResponse.json(respuestaVigilante(new Date(), estado, parte, reserva))
  } catch (e) {
    const como = e instanceof Error ? e.message : String(e)
    console.error(`[fabrica/vigilante] no se pudo leer el estado: ${como}`)
    return NextResponse.json({ error: `No se pudo leer el estado: ${como}` }, { status: 500 })
  }
}
