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

// POST: alguien se anota para que le avisen cuando el reto llegue a un hito.
// Lead privado → tu DB (tabla notify_subscribers).
export async function POST(req: Request) {
  const admin = getAdminClient()
  if (!admin) {
    // Sin backend configurado: el front ofrece seguir en redes.
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

  let email = clean(body.email, 120)
  if (email && !isEmail(email)) email = null
  const whatsapp = clean(body.whatsapp, 30)
  if (!email && !whatsapp) {
    return NextResponse.json({ error: "Dejá un correo o WhatsApp." }, { status: 400 })
  }

  const insert: Record<string, string> = {}
  if (email) insert.email = email
  if (whatsapp) insert.whatsapp = whatsapp
  const trigger = clean(body.trigger, 40)
  if (trigger) insert.trigger = trigger

  const { error } = await admin.from("notify_subscribers").insert([insert])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
