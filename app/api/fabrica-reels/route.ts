import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { autorizado } from "@/lib/auth-admin"
import { FABRICA_BASE, FABRICA_ID, fabricaValida } from "@/lib/fabrica-reels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lectura pública. Si no hay base o tabla, devuelve la semilla: /fabrica nunca
// queda en blanco.
export async function GET() {
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ configurado: false, contenido: FABRICA_BASE })

  const { data, error } = await admin
    .from("fabrica_reels")
    .select("contenido, actualizado_en")
    .eq("id", FABRICA_ID)
    .maybeSingle()

  if (error) {
    console.error("[api/fabrica-reels] lectura fallida:", error.message)
    return NextResponse.json({ configurado: false, contenido: FABRICA_BASE })
  }
  if (!data || !fabricaValida(data.contenido)) {
    return NextResponse.json({ configurado: true, guardado: false, contenido: FABRICA_BASE })
  }
  return NextResponse.json({ configurado: true, guardado: true, contenido: data.contenido, actualizado: data.actualizado_en })
}

// Escritura: solo Kev (ADMIN_SECRET). El documento se valida entero antes de
// tocar la base; el trigger guarda la versión anterior en el historial.
export async function PUT(req: Request) {
  const a = autorizado(req)
  if (a === "sin-clave") return NextResponse.json({ error: "Falta ADMIN_SECRET en el servidor." }, { status: 500 })
  if (!a) return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "La base no está configurada." }, { status: 500 })

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON." }, { status: 400 })
  }
  const contenido = (cuerpo as { contenido?: unknown })?.contenido
  if (!fabricaValida(contenido)) return NextResponse.json({ error: "El documento no tiene la forma esperada." }, { status: 400 })

  const { error } = await admin
    .from("fabrica_reels")
    .upsert({ id: FABRICA_ID, contenido, actualizado_en: new Date().toISOString() })
  if (error) {
    console.error("[api/fabrica-reels] guardado fallido:", error.message)
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
