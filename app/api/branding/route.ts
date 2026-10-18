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
// Comprueba la forma ENTERA, no la mitad. La versión anterior exigía siete
// listas y que tres campos fueran objetos, pero no miraba `edicion` ni nada
// dentro de los objetos: un documento con `personaje: {}` pasaba, se guardaba
// en la base, y la próxima carga de /branding reventaba al leer
// `doc.edicion.bloques` o `doc.personaje.fortalezas`. Y como el trigger de
// historial ya habría archivado el bueno, el mal guardado se quedaba.
//
// Vale la pena ser estricto justo aquí: es el único punto por donde entra
// algo a la base.
const lista = (v: unknown) => Array.isArray(v)
const listaDeTextos = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string")
const texto = (v: unknown) => typeof v === "string"

function valido(c: unknown): c is Contenido {
  if (!c || typeof c !== "object") return false
  const x = c as Record<string, unknown>

  if (!["norte", "formatos", "redes", "enCola", "hoy", "futuro"].every((k) => lista(x[k]))) return false
  if (!listaDeTextos(x.pendientes)) return false

  const meta = x.meta as Record<string, unknown> | undefined
  if (!meta || typeof meta !== "object") return false
  if (!["titulo", "proyecto", "bajada"].every((k) => texto(meta[k]))) return false

  const per = x.personaje as Record<string, unknown> | undefined
  if (!per || typeof per !== "object") return false
  if (!texto(per.nombre)) return false
  if (!["fortalezas", "debilidades", "oportunidades"].every((k) => listaDeTextos(per[k]))) return false

  const ed = x.edicion as Record<string, unknown> | undefined
  if (!ed || typeof ed !== "object") return false
  if (!texto(ed.regla) || !lista(ed.bloques) || !listaDeTextos(ed.nunca)) return false

  const pro = x.produccion as Record<string, unknown> | undefined
  if (!pro || typeof pro !== "object") return false
  if (!["personaje", "equipo"].every((k) => listaDeTextos(pro[k]))) return false

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

  // El documento se revisa ANTES que la configuración del servidor. Un
  // documento mal formado es un problema de quien lo manda (400) y no de cómo
  // está montado esto (500); decirlo al revés manda a revisar la llave de
  // Supabase cuando lo que está mal es el contenido.
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

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  // ── Que una pestaña no pise a la otra ──
  // El upsert escribía encima sin mirar. Con el manual abierto en dos lugares,
  // el segundo guardado borraba el trabajo del primero y nadie se enteraba:
  // ni un aviso, ni un error. Y el historial guarda la versión pisada, pero
  // hay que saber que pasó para ir a buscarla.
  //
  // Así que se compara contra la versión que el navegador tenía cuando cargó.
  // Si alguien guardó en el medio, no se escribe nada y se avisa.
  const visto = (cuerpo as { visto?: unknown })?.visto
  const { data: actual } = await admin
    .from("branding")
    .select("actualizado_en")
    .eq("id", ID)
    .maybeSingle()

  if (actual && actual.actualizado_en !== visto) {
    return NextResponse.json(
      {
        error:
          "Alguien guardó este manual mientras lo editabas (quizá tú en otra pestaña). No se escribió nada para no pisarlo. Recarga la página y vuelve a aplicar tu cambio.",
        actualizado: actual.actualizado_en,
      },
      { status: 409 },
    )
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
