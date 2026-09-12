import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import {
  PIXEL_PRICE,
  SLOTS,
  TOTAL_PIXELS,
  TOTAL_VALUE,
  cellAt,
  slotById,
} from "@/lib/car-grid"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_NAME = 40
const MAX_MESSAGE = 140
const MAX_LINK = 200
const MAX_EMAIL = 120
const MAX_WHATSAPP = 30
const MAX_QTY = 200

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const s = v.trim().replace(/\s+/g, " ")
  return s ? s.slice(0, max) : null
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function code() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sin caracteres ambiguos
  let s = ""
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return `KPG-${s}`
}

// GET: estado público del auto — qué celdas están encendidas y cuánto se vendió.
export async function GET() {
  const admin = getAdminClient()
  const base = {
    total_pixels: TOTAL_PIXELS,
    total_value: TOTAL_VALUE,
    pixel_price: PIXEL_PRICE,
    slots_def: SLOTS,
  }

  if (!admin) {
    return NextResponse.json({ ...base, configured: false, cells: [], slots: {}, sold_usd: 0, sold_pixels: 0 })
  }

  const { data, error } = await admin
    .from("car_pixels")
    .select("kind, idx, slot_id, name, link, price_usd, status")
    .neq("status", "anulado")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  // Solo lo CONFIRMADO se enciende en el auto. Lo pendiente reserva el lugar
  // pero no se muestra como vendido: el contador nunca se infla.
  const confirmados = rows.filter((r) => r.status === "confirmado")

  const cells = confirmados
    .filter((r) => r.kind === "pixel" && r.idx !== null)
    .map((r) => {
      const c = cellAt(r.idx as number)
      return c ? { x: c.x, y: c.y, name: r.name } : null
    })
    .filter(Boolean)

  const slots: Record<string, { name: string; link: string | null }> = {}
  for (const r of confirmados) {
    if (r.kind === "slot" && r.slot_id) slots[r.slot_id] = { name: r.name, link: r.link ?? null }
  }

  return NextResponse.json({
    ...base,
    configured: true,
    cells,
    slots,
    sold_pixels: cells.length,
    sold_usd: confirmados.reduce((a, r) => a + (r.price_usd ?? 0), 0),
    reservados: rows.length - confirmados.length,
  })
}

// POST: reservar píxeles o un espacio premium. Queda 'pendiente' hasta que el
// pago se confirme a mano — el precio lo calcula SIEMPRE el servidor.
export async function POST(req: Request) {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Todavía no está configurado (falta SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Honeypot: si un bot rellena el campo oculto, lo ignoramos en silencio.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const name = clean(body.name, MAX_NAME)
  if (!name) return NextResponse.json({ error: "Poné tu nombre o el de tu marca." }, { status: 400 })

  const message = clean(body.message, MAX_MESSAGE)
  const link = clean(body.link, MAX_LINK)
  const whatsapp = clean(body.whatsapp, MAX_WHATSAPP)
  let email = clean(body.email, MAX_EMAIL)
  if (email && !isEmail(email)) email = null

  const kind = body.kind === "slot" ? "slot" : "pixel"
  const claim = code()
  const comun = { name, message, link, email, whatsapp, claim_code: claim, status: "pendiente" }

  // ── Espacio premium (capó / ruedas) ──
  if (kind === "slot") {
    const slot = slotById(String(body.slot_id ?? ""))
    if (!slot) return NextResponse.json({ error: "Ese espacio no existe." }, { status: 400 })

    const { error } = await admin
      .from("car_pixels")
      .insert([{ ...comun, kind: "slot", slot_id: slot.id, price_usd: slot.price }])

    if (error) {
      // El índice único lo protege: si ya está tomado, avisamos sin drama.
      return NextResponse.json({ error: `"${slot.label}" ya está tomado.` }, { status: 409 })
    }
    return NextResponse.json({ ok: true, code: claim, price: slot.price, slot: slot.label })
  }

  // ── Píxeles: se asignan en orden, los próximos libres ──
  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(body.qty ?? 1)) || 1))

  const { data: tomadas, error: e1 } = await admin
    .from("car_pixels")
    .select("idx")
    .eq("kind", "pixel")
    .neq("status", "anulado")

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const ocupadas = new Set((tomadas ?? []).map((r) => r.idx as number))
  const asignar: number[] = []
  for (let i = 0; i < TOTAL_PIXELS && asignar.length < qty; i++) {
    if (!ocupadas.has(i)) asignar.push(i)
  }

  if (asignar.length === 0) {
    return NextResponse.json({ error: "El auto ya está completo." }, { status: 409 })
  }

  const filas = asignar.map((idx) => ({ ...comun, kind: "pixel", idx, price_usd: PIXEL_PRICE }))
  const { error: e2 } = await admin.from("car_pixels").insert(filas)
  if (e2) return NextResponse.json({ error: "Alguien tomó esos píxeles justo ahora. Probá de nuevo." }, { status: 409 })

  return NextResponse.json({
    ok: true,
    code: claim,
    price: asignar.length * PIXEL_PRICE,
    qty: asignar.length,
    parcial: asignar.length < qty,
  })
}
