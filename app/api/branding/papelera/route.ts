import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { papelera } from "@/lib/papelera"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID = "kev-project-gta"
// Con guardado automático hay muchas copias por día. 400 alcanza para varias
// semanas sin traer la tabla entera.
const VERSIONES = 400

// Lo que estuvo en el manual y hoy no está. Pública como el manual: si
// cualquiera puede escribirlo, cualquiera tiene que poder devolver lo borrado.
export async function GET() {
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  const [actual, historial] = await Promise.all([
    admin.from("branding").select("contenido").eq("id", ID).maybeSingle(),
    admin
      .from("branding_historial")
      .select("contenido, guardado_en")
      .eq("branding_id", ID)
      .order("guardado_en", { ascending: false })
      .limit(VERSIONES),
  ])
  if (actual.error || historial.error) {
    return NextResponse.json({ error: (actual.error ?? historial.error)!.message }, { status: 500 })
  }
  if (!actual.data) return NextResponse.json({ borrados: [] })

  return NextResponse.json({
    borrados: papelera(actual.data.contenido, historial.data ?? []),
    versiones: historial.data?.length ?? 0,
  })
}
