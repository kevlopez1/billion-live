import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { CONTENIDO_BASE, type Contenido } from "@/lib/branding"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID = "kev-project-gta"

// ──────────────────────────────────────────────────────────────
// Lectura. Degrada SIEMPRE a algo usable: si no hay cliente, si la tabla no
// existe todavía o si la fila está vacía, devuelve el contenido semilla con
// `configurado: false`. Así la página nunca queda en blanco esperando un SQL
// que puede tardar días en correrse.
// ──────────────────────────────────────────────────────────────
export async function GET() {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configurado: false, motivo: "sin-credenciales", contenido: CONTENIDO_BASE })
  }

  const { data, error } = await admin
    .from("branding")
    .select("contenido, actualizado_en")
    .eq("id", ID)
    .maybeSingle()

  if (error) {
    console.error("[api/branding] lectura fallida:", error.message)
    return NextResponse.json({ configurado: false, motivo: "sin-tabla", contenido: CONTENIDO_BASE })
  }
  if (!data) {
    return NextResponse.json({ configurado: true, guardado: false, contenido: CONTENIDO_BASE })
  }
  return NextResponse.json({
    configurado: true,
    guardado: true,
    contenido: data.contenido as Contenido,
    actualizado: data.actualizado_en,
  })
}

// ──────────────────────────────────────────────────────────────
// Escritura. Mismo secreto que /control. El cuerpo se valida antes de tocar
// la base: un documento a medias guardado encima del bueno es peor que un
// error, porque el trigger de historial ya habría archivado el anterior.
// ──────────────────────────────────────────────────────────────
function valido(c: unknown): c is Contenido {
  if (!c || typeof c !== "object") return false
  const x = c as Record<string, unknown>
  const listas = ["norte", "formatos", "redes", "enCola", "pendientes", "hoy", "futuro"]
  if (!listas.every((k) => Array.isArray(x[k]))) return false
  if (!x.meta || typeof x.meta !== "object") return false
  if (!x.personaje || typeof x.personaje !== "object") return false
  if (!x.produccion || typeof x.produccion !== "object") return false
  return true
}

export async function PUT(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Falta ADMIN_SECRET en las variables de entorno." }, { status: 500 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }

  const contenido = (cuerpo as { contenido?: unknown })?.contenido
  if (!valido(contenido)) {
    return NextResponse.json({ error: "El documento no tiene la forma esperada. No se guardó nada." }, { status: 400 })
  }

  const { data, error } = await admin
    .from("branding")
    .upsert({ id: ID, contenido, actualizado_en: new Date().toISOString() })
    .select("actualizado_en")
    .maybeSingle()

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    console.error("[api/branding] escritura fallida:", error.message)
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
