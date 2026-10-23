import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { getAdminClient } from "@/lib/supabase-admin"
import { IDS_RETO, semilla, sumarDelManual, valido, type Pregunta, type Tablero } from "@/lib/preguntas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID = "kev-lopez"
const MAX_BYTES = 900_000

// ──────────────────────────────────────────────────────────────
// Igual que /api/proyectos: la clave hace falta también para LEER. Aquí están
// las preguntas de dinero y de inversores, con nombres de personas reales.
// ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configurado: false, motivo: "sin-credenciales", contenido: semilla() })
  }

  const [{ data, error }, manual] = await Promise.all([
    admin.from("preguntas").select("contenido, actualizado_en").eq("id", ID).maybeSingle(),
    // Lo que se haya contestado cuando las preguntas vivían en el manual.
    admin.from("branding").select("contenido").eq("id", "kev-project-gta").maybeSingle(),
  ])
  // Las del reto ya no se muestran aquí: son de /api/preguntas/publicas.
  const sinReto = (t: Tablero): Tablero => ({ ...t, preguntas: t.preguntas.filter((p) => !IDS_RETO.has(p.id)) })
  const delManual = (manual.data?.contenido as { preguntas?: Pregunta[] } | null)?.preguntas?.filter((p) => !IDS_RETO.has(p.id))

  if (error) {
    console.error("[api/preguntas] lectura fallida:", error.message)
    return NextResponse.json({ configurado: false, motivo: "sin-tabla", contenido: sumarDelManual(semilla(), delManual) })
  }
  if (!data) {
    return NextResponse.json({ configurado: true, guardado: false, contenido: sumarDelManual(semilla(), delManual) })
  }
  return NextResponse.json({
    configurado: true,
    guardado: true,
    contenido: sinReto(sumarDelManual(data.contenido as Tablero, delManual)),
    actualizado: data.actualizado_en,
  })
}

export async function PUT(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  // El tablero se revisa ANTES que la configuración del servidor: un cuerpo
  // mal formado es problema de quien lo manda (400), no de cómo está montado
  // esto (500). Decirlo al revés manda a revisar la llave de Supabase cuando
  // lo que está mal es el contenido.
  const texto = await req.text()
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ error: "El tablero es demasiado grande. No se guardó nada." }, { status: 413 })
  }

  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }

  const contenido = (cuerpo as { contenido?: unknown })?.contenido
  if (!valido(contenido)) {
    return NextResponse.json({ error: "El tablero no tiene la forma esperada. No se guardó nada." }, { status: 400 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  // Este tablero ya no muestra las preguntas del reto, pero si estaban
  // guardadas aquí se conservan: /api/preguntas/publicas las lee de esta fila
  // para no perder lo que se contestó antes de que existiera el área pública.
  const { data: previo } = await admin.from("preguntas").select("contenido").eq("id", ID).maybeSingle()
  const delReto = valido(previo?.contenido) ? previo!.contenido.preguntas.filter((p: Pregunta) => IDS_RETO.has(p.id)) : []
  const aGuardar: Tablero = {
    preguntas: [...contenido.preguntas.filter((p) => !IDS_RETO.has(p.id)), ...delReto],
  }

  const { data, error } = await admin
    .from("preguntas")
    .upsert({ id: ID, contenido: aGuardar, actualizado_en: new Date().toISOString() })
    .select("actualizado_en")
    .maybeSingle()

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    console.error("[api/preguntas] escritura fallida:", error.message)
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
