import { NextResponse, after } from "next/server"
import { autorizado, quien, soloKev } from "@/lib/auth-admin"
import {
  SIN_CLAVE_IA,
  consejo,
  consumirCupo,
  conversar,
  esPersonaje,
  hablar,
  interior,
  marcarPublico,
  noticia,
  quienPide,
  reflexionarSiToca,
  tablero,
  trabajar,
  validarPedido,
  validarPublico,
  type Resultado,
} from "@/lib/casa-blanca-servidor"

// ──────────────────────────────────────────────────────────────
// /api/casa-blanca — la IA de LA CASA BLANCA PROJECT
//
//   GET    el tablero: entregables, progreso por departamento y el reto, más
//          el ánimo y el pensamiento de cada residente (conciencias).
//          ?personaje=<id> suma su conciencia completa y sus 10 recuerdos.
//          La primera visita del día despierta la reflexión de todos (después
//          de responder: nadie la espera).
//   POST   { accion: "hablar" | "conversar" | "consejo" | "noticia" } público, con límite.
//          { accion: "trabajar" } solo Kev: cada entrega cuesta y se guarda.
//   PATCH  { id, publico } solo Kev: muestra (o esconde) un entregable.
//
// Si algo falta (la clave de la IA, la base), responde con un error que dice
// qué falta y la página sigue con su guion. La lógica vive en
// lib/casa-blanca-servidor.ts; aquí solo se traduce HTTP.
// ──────────────────────────────────────────────────────────────

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// El plan gratis de Vercel corta a los 60 s; pedir más ahí falla el deploy.
export const maxDuration = 60

// Un pedido legítimo (10 mensajes de historial, 24 ids con recuerdos) no
// pasa de unos pocos KB. Se mide antes de parsear el JSON.
const MAX_CUERPO = 32_000

const json = (datos: unknown, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(datos, { status, headers })

function responder<T>(r: Resultado<T>, extra?: Record<string, unknown>) {
  if (r.ok) return json({ ...(r.datos as object), ...extra })
  return json({ error: r.error, ...(r.status === 503 ? { configurado: false } : {}) }, r.status)
}

async function leerCuerpo(req: Request): Promise<{ ok: true; cuerpo: unknown } | { ok: false; resp: NextResponse }> {
  let crudo: string
  try {
    crudo = await req.text()
  } catch {
    return { ok: false, resp: json({ error: "No se pudo leer el pedido." }, 400) }
  }
  if (crudo.length > MAX_CUERPO) return { ok: false, resp: json({ error: "El pedido es demasiado grande." }, 413) }
  try {
    return { ok: true, cuerpo: JSON.parse(crudo) }
  } catch {
    return { ok: false, resp: json({ error: "El cuerpo no es JSON válido." }, 400) }
  }
}

/** Solo Kev. Alguien del equipo con su clave recibe un 403 con el motivo, no un 401. */
function exigirKev(req: Request, motivo: string): NextResponse | null {
  const q = quien(req)
  if (q === "sin-clave") return json({ error: "Falta ADMIN_SECRET en las variables de entorno." }, 500)
  if (!q) return json({ error: "Clave incorrecta." }, 401)
  if (q.rol !== "admin") return soloKev(motivo)
  return null
}

export async function GET(req: Request) {
  try {
    const personaje = new URL(req.url).searchParams.get("personaje")
    if (personaje !== null && !esPersonaje(personaje)) return json({ error: "Personaje desconocido." }, 400)
    const [t, int] = await Promise.all([tablero(autorizado(req) === true), interior(personaje)])
    // Corre después de mandar la respuesta, dentro del tiempo de la función.
    if (int.reflexionar) after(() => reflexionarSiToca())
    return json({ ...t, ...int.datos })
  } catch (e) {
    console.error("[api/casa-blanca] GET falló:", (e as Error).message)
    return json({ error: "No se pudo leer el tablero." }, 500)
  }
}

export async function POST(req: Request) {
  try {
    const leido = await leerCuerpo(req)
    if (!leido.ok) return leido.resp
    const v = validarPedido(leido.cuerpo)
    if (!v.ok) return json({ error: v.error, detalle: v.detalle }, 400)
    const pedido = v.pedido

    if (pedido.accion === "trabajar") {
      const no = exigirKev(req, "Trabajar lo usa solo Kev: cada entrega cuesta dinero y se guarda.")
      if (no) return no
      return responder(await trabajar(pedido.departamentoId, pedido.objetivoId))
    }

    // Sin clave de la IA no se cuenta el cupo: no se gastó nada.
    if (!(process.env.ANTHROPIC_API_KEY ?? "").trim()) {
      return json({ error: SIN_CLAVE_IA, configurado: false }, 503)
    }

    // Kev no tiene límite; el resto, 25 por día y un techo global.
    let quedan: number | null = null
    if (autorizado(req) !== true) {
      const cupo = await consumirCupo(req)
      if (!cupo.ok) {
        return json({ error: cupo.mensaje, limite: cupo.motivo }, 429, { "Retry-After": String(cupo.reintentarEn) })
      }
      quedan = cupo.quedan
    }
    const extra = quedan === null ? undefined : { quedan }

    switch (pedido.accion) {
      case "hablar":
        return responder(await hablar(pedido, quienPide(req)), extra)
      case "conversar":
        return responder(await conversar(pedido), extra)
      case "consejo":
        return responder(await consejo(pedido), extra)
      case "noticia":
        return responder(await noticia(pedido), extra)
    }
  } catch (e) {
    console.error("[api/casa-blanca] POST falló:", (e as Error).message)
    return json({ error: "Algo falló en el servidor. Inténtalo de nuevo." }, 500)
  }
}

export async function PATCH(req: Request) {
  try {
    const no = exigirKev(req, "Publicar entregables lo hace solo Kev.")
    if (no) return no
    const leido = await leerCuerpo(req)
    if (!leido.ok) return leido.resp
    const v = validarPublico(leido.cuerpo)
    if (!v.success) {
      return json({ error: 'Datos inválidos: se espera { "id": "<uuid>", "publico": true | false }.' }, 400)
    }
    return responder(await marcarPublico(v.data.id, v.data.publico))
  } catch (e) {
    console.error("[api/casa-blanca] PATCH falló:", (e as Error).message)
    return json({ error: "Algo falló en el servidor. Inténtalo de nuevo." }, 500)
  }
}
