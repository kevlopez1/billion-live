import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { ID_PUBLICAS, IDS_RETO, semillaPublica, sumarDelManual, valido, type Pregunta, type Tablero } from "@/lib/preguntas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 300_000

// ──────────────────────────────────────────────────────────────
// LAS PREGUNTAS DEL RETO — públicas para ver y escribir.
//
// Decisión de Kev, con el riesgo dicho: sin clave, cualquiera con el link
// puede escribir aquí. Lo que lo hace aceptable es que nada se pierde: cada
// guardado deja copia, y en la página están Deshacer y la papelera.
//
// Al leer se suman, una sola vez, las preguntas del reto que se contestaron
// antes de que existiera esta área (en el tablero privado o dentro del
// manual). Si esta fila ya tiene una, gana la de aquí.
// ──────────────────────────────────────────────────────────────

const delReto = (ps: Pregunta[] | undefined) => (ps ?? []).filter((p) => IDS_RETO.has(p.id))

export async function GET() {
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ configurado: false, motivo: "sin-credenciales", contenido: semillaPublica() })
  }

  const [propia, privada, manual] = await Promise.all([
    admin.from("preguntas").select("contenido, actualizado_en").eq("id", ID_PUBLICAS).maybeSingle(),
    admin.from("preguntas").select("contenido").eq("id", "kev-lopez").maybeSingle(),
    admin.from("branding").select("contenido").eq("id", "kev-project-gta").maybeSingle(),
  ])
  if (propia.error) {
    return NextResponse.json({ configurado: false, motivo: "sin-tabla", contenido: semillaPublica() })
  }

  const base: Tablero = valido(propia.data?.contenido) ? propia.data!.contenido : semillaPublica()
  const antes = [
    ...delReto(valido(privada.data?.contenido) ? privada.data!.contenido.preguntas : []),
    ...delReto((manual.data?.contenido as { preguntas?: Pregunta[] } | null)?.preguntas),
  ]
  // Lo contestado antes reemplaza a la semilla vacía si esta fila todavía no existe.
  const contenido = propia.data
    ? sumarDelManual(base, antes)
    : sumarDelManual({ preguntas: [] }, [...antes, ...base.preguntas])

  return NextResponse.json({
    configurado: true,
    guardado: !!propia.data,
    contenido,
    actualizado: propia.data?.actualizado_en ?? null,
  })
}

export async function PUT(req: Request) {
  const texto = await req.text()
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ error: "Es demasiado grande. No se guardó nada." }, { status: 413 })
  }
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }
  const contenido = (cuerpo as { contenido?: unknown })?.contenido
  if (!valido(contenido)) {
    return NextResponse.json({ error: "No tiene la forma esperada. No se guardó nada." }, { status: 400 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })

  const { data, error } = await admin
    .from("preguntas")
    .upsert({ id: ID_PUBLICAS, contenido, actualizado_en: new Date().toISOString() })
    .select("actualizado_en")
    .maybeSingle()
  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    return NextResponse.json(
      { error: falta ? "La tabla no existe todavía. Corre supabase/correr-todo.sql." : error.message },
      { status: falta ? 503 : 500 },
    )
  }
  return NextResponse.json({ ok: true, actualizado: data?.actualizado_en })
}
