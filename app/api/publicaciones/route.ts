import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import type { Publicacion } from "@/lib/metricas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// La fila de la base usa nombres en snake_case; la app los usa en camelCase.
// La traducción vive aquí y en un solo lugar.
type Fila = {
  id: string; fecha: string; titulo: string; formato_id: string; red: string
  url: string | null; gancho: string | null; vistas: number
  alcance: number | null; ctr: number | null; duracion_media: number | null
  retencion: number | null
  likes: number; comentarios: number; compartidos: number; seguidores: number
}

// Las redes no dan todas los mismos datos. Lo que no viene queda en null y no
// en 0: un dato que falta no es un cero, y promediar ceros falsos hunde el
// promedio del formato entero.
const oNulo = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const aPublicacion = (f: Fila): Publicacion => ({
  id: f.id, fecha: f.fecha, titulo: f.titulo, formatoId: f.formato_id, red: f.red,
  url: f.url ?? undefined, gancho: f.gancho ?? undefined, vistas: Number(f.vistas),
  alcance: oNulo(f.alcance),
  ctr: oNulo(f.ctr),
  duracionMedia: oNulo(f.duracion_media),
  retencion: oNulo(f.retencion),
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

// Los seguidores son los GANADOS con ese video, y se pueden perder. Es la
// única de las cinco métricas que el esquema deja negativa a propósito
// (las otras llevan `check (>= 0)`). Aplastar un -40 a 0 borra justo el dato
// que más importa: qué video espantó gente.
function limpiarEntero(v: unknown, max = 1e12): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(-max, Math.min(Math.round(n), max))
}

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return NextResponse.json({ error: "Falta ADMIN_SECRET." }, { status: 500 })
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  }
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }) }

  const titulo = String(b.titulo ?? "").trim()
  const formatoId = String(b.formatoId ?? "").trim()
  const red = String(b.red ?? "").trim()
  const fecha = String(b.fecha ?? "").trim()
  if (!titulo || !formatoId || !red || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Faltan el título, el formato, la red o la fecha." }, { status: 400 })
  }

  // Las vistas son obligatorias. Dejarlas vacías guardaba un 0 de verdad, y
  // ese 0 entraba en el promedio del formato como si el video no hubiera
  // tenido ninguna vista. Un dato que falta no es un cero.
  const vistasCrudas = Number(b.vistas)
  if (b.vistas === null || b.vistas === undefined || b.vistas === "" || !Number.isFinite(vistasCrudas) || vistasCrudas < 0) {
    return NextResponse.json(
      { error: "Pon las vistas. Un video sin vistas registradas tuerce el promedio de todo su formato." },
      { status: 400 },
    )
  }

  // Los porcentajes: fuera de 0-100 es un dato mal copiado, y un dato mal
  // copiado aquí tuerce el promedio del formato entero.
  const porcentaje = (v: unknown, nombre: string): { ok: true; v: number | null } | { ok: false; error: string } => {
    if (v === null || v === undefined || v === "") return { ok: true, v: null }
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: `${nombre} va entre 0 y 100.` }
    return { ok: true, v: Math.round(n * 100) / 100 }
  }

  const ret = porcentaje(b.retencion, "La retención")
  if (!ret.ok) return NextResponse.json({ error: ret.error }, { status: 400 })
  const clics = porcentaje(b.ctr, "El CTR")
  if (!clics.ok) return NextResponse.json({ error: clics.error }, { status: 400 })
  const retencion = ret.v

  // Alcance y duración: positivos o nada. Vacío significa "esta red no lo da".
  const positivoOpcional = (v: unknown, nombre: string): { ok: true; v: number | null } | { ok: false; error: string } => {
    if (v === null || v === undefined || v === "") return { ok: true, v: null }
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${nombre} no puede ser un número negativo.` }
    return { ok: true, v: Math.round(n * 100) / 100 }
  }
  const alc = positivoOpcional(b.alcance, "El alcance")
  if (!alc.ok) return NextResponse.json({ error: alc.error }, { status: 400 })
  const dur = positivoOpcional(b.duracionMedia, "La duración media")
  if (!dur.ok) return NextResponse.json({ error: dur.error }, { status: 400 })

  // La configuración del servidor se revisa al final, cuando ya se sabe que el
  // dato es bueno: un dato mal copiado es un 400 de quien lo manda, no un 500
  // de cómo está montado esto. Al revés manda a revisar la llave de Supabase
  // cuando lo que está mal es el número.
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  const { data, error } = await admin
    .from("publicaciones")
    .insert({
      fecha, titulo, formato_id: formatoId, red,
      url: String(b.url ?? "").trim() || null,
      gancho: String(b.gancho ?? "").trim().slice(0, 400) || null,
      vistas: limpiarNumero(b.vistas),
      alcance: alc.v === null ? null : Math.round(alc.v),
      ctr: clics.v,
      duracion_media: dur.v,
      retencion,
      likes: limpiarNumero(b.likes),
      comentarios: limpiarNumero(b.comentarios),
      compartidos: limpiarNumero(b.compartidos),
      seguidores: limpiarEntero(b.seguidores),
    })
    .select("*")
    .maybeSingle()

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    console.error("[api/publicaciones] escritura fallida:", error.message)
    return NextResponse.json(
      { error: falta ? "La tabla no existe todavía. Corre supabase/correr-todo.sql en Supabase." : error.message },
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
