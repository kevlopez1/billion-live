import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { CHALLENGE_TARGET } from "@/lib/contador"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lectura pública del estado actual del contador.
export async function GET() {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }
  const { data, error } = await admin.from("global_metrics").select("*").limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configured: true, metrics: data })
}

// Escritura BLINDADA: solo con el secreto del servidor. La service-role evita
// el RLS de forma segura porque corre en el servidor, nunca en el navegador.
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "Falta ADMIN_SECRET en las variables de entorno (Vercel)." },
      { status: 500 },
    )
  }

  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Campos editables del contador (todos opcionales).
  const patch: Record<string, number | string> = {}
  if (typeof body.net_worth === "number") patch.net_worth = Math.round(body.net_worth)
  if (typeof body.monthly_growth === "number") patch.monthly_growth = body.monthly_growth
  if (typeof body.roi === "number") patch.roi = body.roi
  if (typeof body.active_projects === "number") patch.active_projects = Math.round(body.active_projects)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 })
  }

  // La web ignora cualquier monto fuera de $1 – la meta (ver lib/contador.ts).
  // Mejor rechazarlo aquí, con el motivo, que guardarlo y que no aparezca.
  const monto = patch.net_worth
  if (typeof monto === "number" && (monto <= 0 || monto > CHALLENGE_TARGET)) {
    return NextResponse.json(
      { error: `El monto tiene que estar entre $1 y $${CHALLENGE_TARGET.toLocaleString("en-US")}. No se guardó nada.` },
      { status: 400 },
    )
  }

  // Se sella la fecha a mano: la tabla no la actualiza sola, y la web solo
  // confía en filas guardadas después del día 1 del reto. Sin esto, cambiar
  // el número desde /control dejaría la fecha vieja y el cambio no se vería.

  // Upsert: si existe fila la actualizamos; si no, insertamos.
  patch.updated_at = new Date().toISOString()

  // La configuración se mira DESPUÉS de revisar el cuerpo: un monto imposible
  // es un 400 de quien lo manda, no un 500 de cómo está montado esto.
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (Vercel)." },
      { status: 500 },
    )
  }

  const { data: existing } = await admin.from("global_metrics").select("id").limit(1).maybeSingle()

  if (existing?.id) {
    const { data, error } = await admin
      .from("global_metrics")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, metrics: data })
  }

  const { data, error } = await admin.from("global_metrics").insert([patch]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, metrics: data })
}
