import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import type { Publicacion } from "@/lib/metricas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// La fila de la base usa nombres en snake_case; la app los usa en camelCase.
// La traducción vive aquí y en un solo lugar.
type Fila = {
  id: string; fecha: string; titulo: string; formato_id: string; red: string
  url: string | null; vistas: number; retencion: number | null
  likes: number; comentarios: number; compartidos: number; seguidores: number
}

const aPublicacion = (f: Fila): Publicacion => ({
  id: f.id, fecha: f.fecha, titulo: f.titulo, formatoId: f.formato_id, red: f.red,
  url: f.url ?? undefined, vistas: Number(f.vistas),
  retencion: f.retencion === null ? null : Number(f.retencion),
  likes: Number(f.likes), comentarios: Number(f.comentarios),
  compartidos: Number(f.compartidos), seguidores: Number(f.seguidores),
})

export async function GET() {
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ configurado: false, publicaciones: [] })

  const { data, error } = await admin
    .from("publicaciones")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(500)

  if (error) {
    // Degrada igual que /api/branding: la tabla puede no existir todavía.
    console.error("[api/publicaciones] lectura fallida:", error.message)
    return NextResponse.json({ configurado: false, publicaciones: [] })
  }
  return NextResponse.json({ configurado: true, publicaciones: (data as Fila[]).map(aPublicacion) })
}

function limpiarNumero(v: unknown, max = 1e12): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.round(n), max)
}

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return NextResponse.json({ error: "Falta ADMIN_SECRET." }, { status: 500 })
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  }
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }) }

  const titulo = String(b.titulo ?? "").trim()
  const formatoId = String(b.formatoId ?? "").trim()
  const red = String(b.red ?? "").trim()
  const fecha = String(b.fecha ?? "").trim()
  if (!titulo || !formatoId || !red || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Faltan el título, el formato, la red o la fecha." }, { status: 400 })
  }

  // La retención es un porcentaje: fuera de 0-100 es un dato mal copiado, y
  // un dato mal copiado aquí tuerce el promedio del formato entero.
  let retencion: number | null = null
  if (b.retencion !== null && b.retencion !== undefined && b.retencion !== "") {
    const r = Number(b.retencion)
    if (!Number.isFinite(r) || r < 0 || r > 100) {
      return NextResponse.json({ error: "La retención va entre 0 y 100." }, { status: 400 })
    }
    retencion = Math.round(r * 100) / 100
  }

  const { data, error } = await admin
    .from("publicaciones")
    .insert({
      fecha, titulo, formato_id: formatoId, red,
      url: String(b.url ?? "").trim() || null,
      vistas: limpiarNumero(b.vistas),
      retencion,
      likes: limpiarNumero(b.likes),
      comentarios: limpiarNumero(b.comentarios),
      compartidos: limpiarNumero(b.compartidos),
      seguidores: limpiarNumero(b.seguidores),
    })
    .select("*")
    .maybeSingle()

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    console.error("[api/publicaciones] escritura fallida:", error.message)
    return NextResponse.json(
      { error: falta ? "La tabla no existe todavía. Corre supabase/metricas.sql en Supabase." : error.message },
      { status: falta ? 503 : 500 },
    )
  }
  return NextResponse.json({ ok: true, publicacion: aPublicacion(data as Fila) })
}

export async function DELETE(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return NextResponse.json({ error: "Falta ADMIN_SECRET." }, { status: 500 })
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  }
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 })

  const { error } = await admin.from("publicaciones").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
