import { NextResponse } from "next/server"
import { quien, soloKev } from "@/lib/auth-admin"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import * as z from "zod/v4"
import { getAdminClient } from "@/lib/supabase-admin"
import { CONTENIDO_BASE, type Contenido } from "@/lib/branding"
import { SECCIONES, TIPOS, GRAVEDADES, ordenar, type Hallazgo, type Revision } from "@/lib/revision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Leer el manual entero y razonar sobre él no es una respuesta de un segundo.
// El límite de Vercel en el plan gratis es 60; pedir más ahí falla el deploy.
export const maxDuration = 60

const MODELO = "claude-opus-5-5"

// ──────────────────────────────────────────────────────────────
// La forma de la respuesta. En esta versión de zod las listas cerradas viajan
// como descripción y no como restricción, así que además se validan abajo a
// mano: un `tipo` inventado romperia el panel en silencio.
// ──────────────────────────────────────────────────────────────
const Esquema = z.object({
  resumen: z.string(),
  hallazgos: z.array(
    z.object({
      tipo: z.enum(TIPOS),
      seccion: z.enum(SECCIONES),
      titulo: z.string(),
      detalle: z.string(),
      accion: z.string(),
      gravedad: z.enum(GRAVEDADES),
    }),
  ),
})

// Las formas prohibidas van escritas: decirle al modelo "no uses voseo" sin
// mostrárselas funciona mucho peor. Vive aparte para que el marcador del
// detector sea un comentario de código y no contamine la instrucción.
const REGLA_IDIOMA =
  'Español neutro de Latinoamérica. NUNCA voseo: va "pon, deja, mira, tienes, puedes, eres, aquí, tú" — nunca "poné, dejá, mirá, tenés, podés, sos, acá, vos".' // sin-voseo:ejemplos

const INSTRUCCIONES = `Eres el editor del manual de marca y contenido de KEV PROJECT GTA.

EL PROYECTO
Kev López (21, Santa Cruz de la Sierra, Bolivia) va de $10 a un Mercedes Mansory
(~$450.000) en público, documentado en kevproject.world, financiado solo con ingresos
reales de su empresa PRIME (empleados de IA para empresas). El auto es la carnada; el
imperio es la meta. Su audiencia es toda Latinoamérica.

TU TRABAJO
Te paso el manual completo en JSON. Revísalo contra sí mismo y contra las reglas de
abajo, y devuelve lo que está mal, lo que falta y lo que se puede mejorar.

NO inventes datos que no están en el documento. No supongas cuántos seguidores tiene,
ni cuánto factura, ni qué le funcionó. Si algo no se puede saber leyendo el documento,
no es un hallazgo: es una pregunta, y entonces el hallazgo es que el documento no lo dice.

QUÉ BUSCAR, EN ESTE ORDEN
1. Contradicciones: dos partes del documento que no pueden ser ciertas a la vez.
2. Huecos que bloquean: algo que el documento promete o requiere y no está.
   Ejemplos: un formato sin beats, un video en cola cuyo formato no existe en la lista
   de formatos, una red marcada "en uso" sin nota de qué se hace ahí, un bloque de
   edición sin reglas, una debilidad del personaje que nada en el documento resuelve.
3. Riesgos: algo que, tal como está escrito, le puede costar credibilidad, dinero o
   la cuenta en una plataforma.
4. Mejoras: solo las que se apoyan en algo que YA está en el documento.

LAS REGLAS DE LA CASA (si el documento las rompe, es un hallazgo)
- "Todo real, sin humo": ningún dato inventado, de ejemplo o de relleno. Un número que
  no se puede probar no va. Esta es la marca del proyecto; romperla es gravedad alta.
- Menos palabras: una idea por bloque. Fuera preámbulos, muletillas ("simplemente",
  "básicamente", "realmente") y superlativos vacíos ("increíble", "único"). Si algo es
  bueno se prueba con un número.
- Una sola fuente de verdad por dato: el mismo número escrito a mano en dos lugares
  termina contradiciéndose.
- El auto se nombra "un Mercedes … Mansory" en pantalla; el nombre completo solo sirve
  para que Google lo encuentre.

CÓMO ESCRIBIR
- ${REGLA_IDIOMA}
- Directo y concreto. Sin preámbulos. Nada de "te recomiendo considerar": di qué hacer.
- "accion" es el siguiente paso concreto, algo que se pueda hacer hoy. No "mejorar la
  sección": di qué escribir o qué quitar.
- "titulo" es una frase corta. "detalle" explica por qué, citando la parte del documento.

CUÁNTOS
Máximo 12 hallazgos, los que de verdad importan. Si el documento está sólido, devuelve
pocos: una lista corta y cierta vale más que una larga y rellena. Cero hallazgos es una
respuesta válida y honesta.

"resumen" son dos o tres frases: en qué estado está el manual y qué es lo primero que
hay que tocar.`

// La lista cerrada se comprueba aquí porque el esquema no la impone.
const dentro = <T extends readonly string[]>(lista: T, v: unknown): v is T[number] =>
  typeof v === "string" && (lista as readonly string[]).includes(v)

function limpiar(bruto: unknown): Revision | null {
  if (!bruto || typeof bruto !== "object") return null
  const r = bruto as { resumen?: unknown; hallazgos?: unknown }
  if (typeof r.resumen !== "string" || !Array.isArray(r.hallazgos)) return null

  const hallazgos: Hallazgo[] = []
  for (const h of r.hallazgos) {
    if (!h || typeof h !== "object") continue
    const x = h as Record<string, unknown>
    if (!dentro(TIPOS, x.tipo) || !dentro(SECCIONES, x.seccion) || !dentro(GRAVEDADES, x.gravedad)) continue
    if (typeof x.titulo !== "string" || typeof x.detalle !== "string" || typeof x.accion !== "string") continue
    if (!x.titulo.trim()) continue
    hallazgos.push({
      tipo: x.tipo, seccion: x.seccion, gravedad: x.gravedad,
      titulo: x.titulo.trim(), detalle: x.detalle.trim(), accion: x.accion.trim(),
    })
  }
  return { resumen: r.resumen.trim(), hallazgos: ordenar(hallazgos) }
}

export async function POST(req: Request) {
  // Solo Kev: cada uso cuesta dinero de su cuenta de Anthropic. Alguien del
  // equipo con su clave recibe un 403 con el motivo, no un 401.
  const q = quien(req)
  if (q === "sin-clave") return NextResponse.json({ error: "Falta ADMIN_SECRET." }, { status: 500 })
  if (!q) return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
  if (q.rol !== "admin") return soloKev("Esto lo usa solo Kev: cada uso cuesta dinero.")


  // Degrada igual que el resto: sin llave la página sigue funcionando y dice
  // exactamente qué falta, en vez de mostrar un error sin salida.
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

  // El cuerpo manda: así se puede revisar lo que está editado en pantalla sin
  // tener que guardarlo antes. Sin cuerpo, se revisa lo que hay guardado.
  let contenido: Contenido | null = null
  try {
    const cuerpo = (await req.json()) as { contenido?: Contenido }
    if (cuerpo?.contenido && typeof cuerpo.contenido === "object") contenido = cuerpo.contenido
  } catch {
    // Sin cuerpo válido se sigue con lo guardado.
  }

  if (!contenido) {
    const admin = getAdminClient()
    if (admin) {
      const { data } = await admin.from("branding").select("contenido").eq("id", "kev-project-gta").maybeSingle()
      if (data?.contenido) contenido = data.contenido as Contenido
    }
    contenido = contenido ?? CONTENIDO_BASE
  }

  const cliente = new Anthropic({ apiKey })

  try {
    const respuesta = await cliente.messages.parse({
      model: MODELO,
      max_tokens: 8000,
      system: INSTRUCCIONES,
      output_config: { format: zodOutputFormat(Esquema) },
      messages: [{ role: "user", content: `Este es el manual completo:\n\n${JSON.stringify(contenido, null, 2)}` }],
    })

    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "El modelo no quiso responder a esto." }, { status: 502 })
    }

    const revision = limpiar(respuesta.parsed_output)
    if (!revision) {
      return NextResponse.json({ error: "La respuesta no tuvo la forma esperada. Inténtalo de nuevo." }, { status: 502 })
    }

    const u = respuesta.usage
    return NextResponse.json({
      configurado: true,
      revision,
      // El costo se muestra porque lo paga Kev. Un gasto invisible se vuelve
      // un gasto que nadie controla.
      uso: {
        entrada: u.input_tokens,
        salida: u.output_tokens,
        costoUsd: Math.round((u.input_tokens * 4 + u.output_tokens * 20) / 1e6 * 10000) / 10000,
      },
    })
  } catch (e) {
    const err = e as Error
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "La ANTHROPIC_API_KEY no es válida." }, { status: 401 })
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas revisiones seguidas. Espera un minuto." }, { status: 429 })
    }
    console.error("[api/branding/revision] falló:", err.message)
    return NextResponse.json({ error: `No se pudo revisar. El servidor respondió: "${err.message}"` }, { status: 500 })
  }
}
