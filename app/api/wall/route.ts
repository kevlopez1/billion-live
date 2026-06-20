import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Límites de tamaño (anti-spam / anti-abuso).
const MAX_NAME = 40
const MAX_MESSAGE = 140
const MAX_EMAIL = 120
const MAX_WHATSAPP = 30

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const s = v.trim().replace(/\s+/g, " ")
  if (!s) return null
  return s.slice(0, max)
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// GET: muro público — total de firmas + las más recientes.
export async function GET() {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configured: false, total: 0, signatures: [] }, { status: 200 })
  }

  const { count } = await admin
    .from("wall_signatures")
    .select("*", { count: "exact", head: true })

  const { data, error } = await admin
    .from("wall_signatures")
    .select("id, name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    configured: true,
    total: count ?? 0,
    signatures: data ?? [],
  })
}

// POST: dejar tu huella. "Yo estuve aquí desde el Día 1."
// La escritura va por service-role en el servidor (evita spam directo a la DB).
export async function POST(req: Request) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "El muro aún no está configurado (falta SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Honeypot: si un bot rellena este campo oculto, lo ignoramos en silencio.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
  }

  const name = clean(body.name, MAX_NAME)
  if (!name) {
    return NextResponse.json({ error: "Poné tu nombre para dejar tu huella." }, { status: 400 })
  }

  const message = clean(body.message, MAX_MESSAGE)
  const whatsapp = clean(body.whatsapp, MAX_WHATSAPP)
  let email = clean(body.email, MAX_EMAIL)
  if (email && !isEmail(email)) email = null // correo inválido: lo descartamos sin bloquear la firma

  const insert: Record<string, string> = { name }
  if (message) insert.message = message
  if (email) insert.email = email
  if (whatsapp) insert.whatsapp = whatsapp

  const { data, error } = await admin
    .from("wall_signatures")
    .insert([insert])
    .select("id, name, message, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tu posición = total de firmas (sos el #N en entrar).
  const { count } = await admin
    .from("wall_signatures")
    .select("*", { count: "exact", head: true })

  return NextResponse.json({
    ok: true,
    signature: data,
    position: count ?? 1,
    total: count ?? 1,
  })
}
