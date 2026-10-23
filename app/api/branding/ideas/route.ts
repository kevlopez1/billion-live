import { NextResponse } from "next/server"
import { quien, soloKev } from "@/lib/auth-admin"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import * as z from "zod/v4"
import { getAdminClient } from "@/lib/supabase-admin"
import { CONTENIDO_BASE, type Contenido } from "@/lib/branding"
import { MINIMO_PARA_CONCLUIR, resumirPorFormato, type Publicacion } from "@/lib/metricas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODELO = "claude-opus-5-5"

const Esquema = z.object({
  ideas: z.array(
    z.object({
      titulo: z.string(),
      formatoId: z.string(),
      gancho: z.string(),
      prueba: z.string(),
      porque: z.string(),
    }),
  ),
})

export type Idea = {
  titulo: string
  formatoId: string
  gancho: string
  prueba: string
  porque: string
}

// Las formas prohibidas van escritas: decirle "no uses voseo" sin mostrárselas
// funciona mucho peor.
const REGLA_IDIOMA =
  'Español neutro de Latinoamérica. NUNCA voseo: va "pon, deja, mira, tienes, puedes, eres, aquí, tú" — nunca "poné, dejá, mirá, tenés, podés, sos, acá, vos".' // sin-voseo:ejemplos

const INSTRUCCIONES = `Eres el jefe de contenido de KEV PROJECT GTA.

EL PROYECTO
Kev López (21, Santa Cruz de la Sierra, Bolivia) va de $10 a un Mercedes Mansory
(~$450.000) en público, documentado en kevproject.world, financiado solo con ingresos
reales de su empresa PRIME (empleados de IA para empresas). El auto es la carnada; el
imperio es la meta. Su audiencia es toda Latinoamérica.

TU TRABAJO
Te paso su manual y los números de lo que ya publicó. Propón las próximas ideas de
video. Cada una tiene que usar UNO de los formatos que ya existen en el manual: pasa su
id exacto en "formatoId". No inventes formatos nuevos.

LO QUE DECIDE SI UNA IDEA ES BUENA
1. El gancho. El manual dice que los tres primeros segundos deciden todo: se abre con la
   ambición grande, nunca con el saludo ni con el nombre, y el primer fotograma ya es
   contenido. Escribe el gancho TAL CUAL se va a decir, no lo describas.
2. La prueba. Regla de la casa: si se menciona un número, se muestra. Di qué aparece en
   pantalla que lo compruebe — el saldo, el comprobante, el código, la pantalla. Una idea
   sin prueba en pantalla no sirve para este proyecto.
3. La evidencia. Si los números muestran que un formato retiene más, apóyate en ese y
   dilo en "porque". Si todavía no hay datos suficientes, dilo también: "sin datos
   todavía" es una razón honesta.

LO QUE NO PUEDES HACER
- Inventar datos: ni cifras de facturación, ni de seguidores, ni resultados que no estén
  en lo que te paso. Si no está, no existe.
- Proponer algo que el manual prohíbe explícitamente (está en "edicion.nunca").
- Prometer un resultado sin la prueba en la misma pieza.

CÓMO ESCRIBIR
- ${REGLA_IDIOMA}
- Directo y concreto, sin preámbulos.
- "porque" es una frase: por qué ESTA idea y no otra, atada al manual o a los números.

CUÁNTAS
Seis como máximo. Pocas y buenas. Si el manual está tan vacío que no se puede proponer
nada honesto, devuelve la lista vacía.`

export async function POST(req: Request) {
  // Solo Kev: cada uso cuesta dinero de su cuenta de Anthropic. Alguien del
  // equipo con su clave recibe un 403 con el motivo, no un 401.
  const q = quien(req)
  if (q === "sin-clave") return NextResponse.json({ error: "Falta ADMIN_SECRET." }, { status: 500 })
  if (!q) return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  if (q.rol !== "admin") return soloKev("Esto lo usa solo Kev: cada uso cuesta dinero.")


  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        configurado: false,
        error:
          "Falta ANTHROPIC_API_KEY. Se crea en console.anthropic.com → API keys y se agrega en Vercel → billion_live → Settings → Environment Variables.",
      },
      { status: 503 },
    )
  }

  let contenido: Contenido | null = null
  try {
    const cuerpo = (await req.json()) as { contenido?: Contenido }
    if (cuerpo?.contenido && typeof cuerpo.contenido === "object") contenido = cuerpo.contenido
  } catch {
    // Sin cuerpo se sigue con lo guardado.
  }

  const admin = getAdminClient()
  if (!contenido) {
    if (admin) {
      const { data } = await admin.from("branding").select("contenido").eq("id", "kev-project-gta").maybeSingle()
      if (data?.contenido) contenido = data.contenido as Contenido
    }
    contenido = contenido ?? CONTENIDO_BASE
  }

  // Los números se leen del servidor: así la propuesta se apoya en lo que de
  // verdad pasó y no en lo que el navegador quiera mandar.
  let evidencia = "Todavía no hay ningún video registrado."
  if (admin) {
    const { data } = await admin.from("publicaciones").select("*").limit(500)
    const filas = (data ?? []) as Record<string, unknown>[]
    if (filas.length) {
      const pubs = filas.map((f) => ({
        formatoId: String(f.formato_id),
        vistas: Number(f.vistas ?? 0),
        alcance: f.alcance === null || f.alcance === undefined ? null : Number(f.alcance),
        ctr: f.ctr === null || f.ctr === undefined ? null : Number(f.ctr),
        duracionMedia: f.duracion_media === null || f.duracion_media === undefined ? null : Number(f.duracion_media),
        retencion: f.retencion === null || f.retencion === undefined ? null : Number(f.retencion),
        likes: Number(f.likes ?? 0),
        comentarios: Number(f.comentarios ?? 0),
        compartidos: Number(f.compartidos ?? 0),
        seguidores: Number(f.seguidores ?? 0),
      })) as Publicacion[]
      const resumen = resumirPorFormato(pubs, contenido.formatos.map((f) => ({ id: f.id, nombre: f.nombre })))
        .filter((r) => r.videos > 0)
      evidencia = JSON.stringify(
        {
          minimoParaConcluir: MINIMO_PARA_CONCLUIR,
          nota: "`suficiente: false` significa que hay muy pocos videos de ese formato para concluir nada.",
          formatos: resumen,
        },
        null,
        2,
      )
    }
  }

  const cliente = new Anthropic({ apiKey })

  try {
    const respuesta = await cliente.messages.parse({
      model: MODELO,
      max_tokens: 8000,
      system: INSTRUCCIONES,
      output_config: { format: zodOutputFormat(Esquema) },
      messages: [
        {
          role: "user",
          content: `EL MANUAL:\n\n${JSON.stringify(contenido, null, 2)}\n\nLO QUE YA SE PUBLICÓ:\n\n${evidencia}`,
        },
      ],
    })

    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "El modelo no quiso responder a esto." }, { status: 502 })
    }

    const bruto = respuesta.parsed_output as { ideas?: unknown } | null
    if (!bruto || !Array.isArray(bruto.ideas)) {
      return NextResponse.json({ error: "La respuesta no tuvo la forma esperada. Inténtalo de nuevo." }, { status: 502 })
    }

    // El formato tiene que ser uno de los suyos: el esquema no lo impone y una
    // idea con un formato inventado no se puede agregar a la cola.
    const validos = new Set(contenido.formatos.map((f) => f.id))
    const ideas: Idea[] = []
    for (const x of bruto.ideas as Record<string, unknown>[]) {
      if (!x || typeof x !== "object") continue
      const campos = ["titulo", "formatoId", "gancho", "prueba", "porque"] as const
      if (!campos.every((k) => typeof x[k] === "string")) continue
      if (!validos.has(x.formatoId as string)) continue
      if (!(x.titulo as string).trim() || !(x.gancho as string).trim()) continue
      ideas.push({
        titulo: (x.titulo as string).trim(),
        formatoId: x.formatoId as string,
        gancho: (x.gancho as string).trim(),
        prueba: (x.prueba as string).trim(),
        porque: (x.porque as string).trim(),
      })
    }

    const u = respuesta.usage
    return NextResponse.json({
      configurado: true,
      ideas,
      uso: {
        entrada: u.input_tokens,
        salida: u.output_tokens,
        costoUsd: Math.round(((u.input_tokens * 4 + u.output_tokens * 20) / 1e6) * 10000) / 10000,
      },
    })
  } catch (e) {
    const err = e as Error
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "La ANTHROPIC_API_KEY no es válida." }, { status: 401 })
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas seguidas. Espera un minuto." }, { status: 429 })
    }
    console.error("[api/branding/ideas] falló:", err.message)
    return NextResponse.json({ error: `No se pudo proponer. El servidor respondió: "${err.message}"` }, { status: 500 })
  }
}
