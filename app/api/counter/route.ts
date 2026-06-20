import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"

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

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno (Vercel)." },
      { status: 500 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Campos editables del contador (todos opcionales).
  const patch: Record<string, number> = {}
  if (typeof body.net_worth === "number") patch.net_worth = Math.round(body.net_worth)
  if (typeof body.monthly_growth === "number") patch.monthly_growth = body.monthly_growth
  if (typeof body.roi === "number") patch.roi = body.roi
  if (typeof body.active_projects === "number") patch.active_projects = Math.round(body.active_projects)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 })
  }

  // Upsert: si existe fila la actualizamos; si no, insertamos.
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
