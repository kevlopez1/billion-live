import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { MAX_BYTES, valido, type Doc } from "@/lib/proyectos"
import { semilla } from "@/lib/proyectos-semilla"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID = "kev-lopez"

// ──────────────────────────────────────────────────────────────
// A diferencia de /api/branding, aquí se exige la clave TAMBIÉN para LEER:
// estas notas son metas y estrategia personal, no material público.
// ──────────────────────────────────────────────────────────────
function autorizado(req: Request): boolean | "sin-clave" {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return "sin-clave"
  const dado = req.headers.get("authorization") ?? ""
  const h = (s: string) => createHash("sha256").update(s).digest()
  return timingSafeEqual(h(dado), h(`Bearer ${secret}`))
}

function rechazo(a: boolean | "sin-clave") {
  if (a === "sin-clave") {
    return NextResponse.json({ error: "Falta ADMIN_SECRET en las variables de entorno." }, { status: 500 })
  }
  return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
}

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configurado: false, motivo: "sin-credenciales", contenido: semilla() })
  }

  const { data, error } = await admin
    .from("proyectos_kev")
    .select("contenido, actualizado_en")
    .eq("id", ID)
    .maybeSingle()

  if (error) {
    console.error("[api/proyectos] lectura fallida:", error.message)
    return NextResponse.json({ configurado: false, motivo: "sin-tabla", contenido: semilla() })
  }
  if (!data) {
    return NextResponse.json({ configurado: true, guardado: false, contenido: semilla() })
  }
  return NextResponse.json({
    configurado: true,
    guardado: true,
    contenido: data.contenido as Doc,
    actualizado: data.actualizado_en,
  })
}

export async function PUT(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const texto = await req.text()
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ error: "El documento es demasiado grande. No se guardó nada." }, { status: 413 })
  }

  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }

  const contenido = (cuerpo as { contenido?: unknown })?.contenido
  if (!valido(contenido)) {
    return NextResponse.json({ error: "El documento no tiene la forma esperada. No se guardó nada." }, { status: 400 })
  }

  const { data, error } = await admin
    .from("proyectos_kev")
    .upsert({ id: ID, contenido, actualizado_en: new Date().toISOString() })
    .select("actualizado_en")
    .maybeSingle()

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    console.error("[api/proyectos] escritura fallida:", error.message)
    return NextResponse.json(
      {
        error: falta
          ? "La tabla no existe todavía. Corre supabase/correr-todo.sql en el SQL Editor de Supabase."
          : error.message,
      },
      { status: falta ? 503 : 500 },
    )
  }

  return NextResponse.json({ ok: true, actualizado: data?.actualizado_en })
}
