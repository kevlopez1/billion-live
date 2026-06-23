import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null
  const s = v.trim().replace(/\s+/g, " ")
  return s ? s.slice(0, max) : null
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// POST: una empresa/persona se registra como sponsor. Lead privado → tu DB.
export async function POST(req: Request) {
  const admin = getAdminClient()
  if (!admin) {
    // Sin backend configurado: avisamos al front para que ofrezca contacto por DM.
    return NextResponse.json({ configured: false }, { status: 200 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Honeypot anti-bots
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
  }

  const company = clean(body.company, 80)
  if (!company) {
    return NextResponse.json({ error: "Poné el nombre de la empresa/marca." }, { status: 400 })
  }
  let email = clean(body.email, 120)
  if (email && !isEmail(email)) email = null
  const whatsapp = clean(body.whatsapp, 30)
  if (!email && !whatsapp) {
    return NextResponse.json({ error: "Dejá un correo o WhatsApp para contactarte." }, { status: 400 })
  }

  const insert: Record<string, string> = { company }
  const name = clean(body.name, 60)
  const message = clean(body.message, 400)
  const plan = clean(body.plan, 20)
  if (name) insert.name = name
  if (email) insert.email = email
  if (whatsapp) insert.whatsapp = whatsapp
  if (message) insert.message = message
  if (plan) insert.plan = plan

  const { error } = await admin.from("sponsors").insert([insert])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
