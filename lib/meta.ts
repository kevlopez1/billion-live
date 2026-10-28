// ──────────────────────────────────────────────────────────────
// PUBLICAR EN INSTAGRAM Y FACEBOOK
//
// Solo se importa desde el servidor (app/api/publicar y lib/centro): los
// tokens de Meta viven en Vercel y nunca llegan al navegador ni al repo.
//
// Dos cuentas (lib/publicar-pedido.ts): la de Kev (META_SYSTEM_TOKEN +
// META_PAGE_ID, la de siempre y la que se usa si no se dice otra) y la de La
// Casa Blanca Project (CASA_BLANCA_META_TOKEN + CASA_BLANCA_META_PAGE_ID).
//
// Con un token y el id de la página alcanza. De la página se sacan dos cosas:
// su propio token (para publicar en Facebook) y la cuenta de Instagram
// conectada a ella. Así no hay que guardar tres secretos que se desincronizan.
//
// Meta NO acepta archivos sueltos: pide una dirección pública desde donde ir a
// buscar el video o la foto. Por eso todo entra como `url`.
// ──────────────────────────────────────────────────────────────

import { VARIABLES, faltaVariable, type Cuenta, type Destino, type Tipo } from "./publicar-pedido"

export type { Cuenta, Destino, Tipo }

const GRAPH = process.env.META_GRAPH_URL || "https://graph.facebook.com/v23.0"

/**
 * `pendiente` = Instagram todavía procesa el video. No es un fallo: trae el id
 * del contenedor para volver a mirarlo con continuar() y publicarlo al terminar.
 */
export type Resultado = { ok: true; id: string; enlace?: string } | { ok: false; error: string; pendiente?: string }

type Pagina = { tokenPagina: string; idPagina: string; idInstagram: string | null }

class ErrorMeta extends Error {}

async function llamar(ruta: string, token: string, metodo: "GET" | "POST" = "GET", cuerpo?: Record<string, string>) {
  const url = new URL(`${GRAPH}/${ruta}`)
  const init: RequestInit = { method: metodo, cache: "no-store" }
  if (metodo === "GET") {
    url.searchParams.set("access_token", token)
  } else {
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" }
    init.body = new URLSearchParams({ ...cuerpo, access_token: token })
  }
  const r = await fetch(url, init)
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } }
  if (!r.ok || j.error) {
    // El mensaje de Meta tal cual: es el que dice qué permiso falta.
    throw new ErrorMeta(j.error?.message || `Meta respondió ${r.status}.`)
  }
  return j
}

export function configurado(
  cuenta: Cuenta = "kev",
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; falta: string } {
  const falta = faltaVariable(cuenta, env)
  return falta ? { ok: false, falta } : { ok: true }
}

async function pagina(cuenta: Cuenta): Promise<Pagina> {
  const v = VARIABLES[cuenta]
  const sistema = process.env[v.token]!.trim()
  const id = process.env[v.pagina]!.trim()
  const j = await llamar(`${id}?fields=access_token,instagram_business_account`, sistema)
  const tokenPagina = typeof j.access_token === "string" ? j.access_token : null
  if (!tokenPagina) {
    throw new ErrorMeta("El usuario del sistema no tiene acceso a esta página. Asígnale la página en Meta Business.")
  }
  const ig = j.instagram_business_account as { id?: string } | undefined
  return { tokenPagina, idPagina: id, idInstagram: ig?.id ?? null }
}

// La ruta tiene 60 s (maxDuration). Lo que no termina antes de esto se
// devuelve como "en proceso" en vez de dejar que Vercel corte a la mitad.
const PRESUPUESTO_MS = 45_000
const PAUSA_MS = 5_000
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

const permalink = async (id: string, token: string) => {
  const e = await llamar(`${id}?fields=permalink`, token).catch(() => ({}) as Record<string, unknown>)
  return typeof e.permalink === "string" ? e.permalink : undefined
}

// Un video en Instagram no se publica al instante: Meta lo descarga y lo
// procesa (status_code IN_PROGRESS). Solo con FINISHED se puede llamar a
// media_publish; antes, falla. Si el tiempo no alcanza, queda pendiente.
async function esperarYPublicar(idInstagram: string, contenedor: string, token: string, hasta: number): Promise<Resultado> {
  for (;;) {
    const j = await llamar(`${contenedor}?fields=status_code,status`, token)
    const estado = String(j.status_code ?? "")
    if (estado === "FINISHED") {
      const pub = await llamar(`${idInstagram}/media_publish`, token, "POST", { creation_id: contenedor })
      const id = String(pub.id)
      return { ok: true, id, enlace: await permalink(id, token) }
    }
    // Ya salió (otra pestaña, o un intento anterior que no llegó a contestar).
    // No se publica de nuevo: un segundo media_publish sería un reel repetido.
    if (estado === "PUBLISHED") return { ok: true, id: contenedor }
    if (estado === "ERROR" || estado === "EXPIRED") {
      return { ok: false, error: `Instagram no pudo procesar el video (${String(j.status ?? estado)}).` }
    }
    if (Date.now() + PAUSA_MS > hasta) {
      return { ok: false, pendiente: contenedor, error: "Instagram sigue procesando el video." }
    }
    await dormir(PAUSA_MS)
  }
}

async function instagram(p: Pagina, tipo: Tipo, url: string, texto: string, hasta: number): Promise<Resultado> {
  if (!p.idInstagram) {
    return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada." }
  }
  // Video = REELS: Meta dejó de aceptar media_type=VIDEO para publicaciones
  // sueltas. Un reel acepta horizontal (16:9 y 4:3) hasta 1920 px de ancho.
  const cuerpo: Record<string, string> =
    tipo === "video"
      ? { media_type: "REELS", video_url: url, caption: texto, share_to_feed: "true" }
      : { image_url: url, caption: texto }
  const c = await llamar(`${p.idInstagram}/media`, p.tokenPagina, "POST", cuerpo)
  const contenedor = String(c.id)
  if (tipo === "video") return esperarYPublicar(p.idInstagram, contenedor, p.tokenPagina, hasta)
  const pub = await llamar(`${p.idInstagram}/media_publish`, p.tokenPagina, "POST", { creation_id: contenedor })
  const id = String(pub.id)
  return { ok: true, id, enlace: await permalink(id, p.tokenPagina) }
}

async function facebook(p: Pagina, tipo: Tipo, url: string, texto: string): Promise<Resultado> {
  // Video: /{página}/videos con file_url. Meta lo descarga de esa dirección y
  // lo procesa por su cuenta; contesta con el id del video apenas lo acepta.
  const j =
    tipo === "video"
      ? await llamar(`${p.idPagina}/videos`, p.tokenPagina, "POST", { file_url: url, description: texto })
      : await llamar(`${p.idPagina}/photos`, p.tokenPagina, "POST", { url, caption: texto })
  const id = String(j.post_id ?? j.id)
  return { ok: true, id, enlace: `https://www.facebook.com/${id}` }
}

const mensaje = (e: unknown, si: string) => (e instanceof Error ? e.message : si)

/** Publica en cada destino por separado: si Instagram falla, Facebook igual
 *  sale, y la respuesta dice cuál salió y cuál no. */
export async function publicar(
  cuenta: Cuenta,
  tipo: Tipo,
  url: string,
  texto: string,
  destinos: Destino[],
): Promise<Record<Destino, Resultado | undefined>> {
  const hasta = Date.now() + PRESUPUESTO_MS
  const salida: Record<Destino, Resultado | undefined> = { ig: undefined, fb: undefined }
  let p: Pagina
  try {
    p = await pagina(cuenta)
  } catch (e) {
    const error = mensaje(e, "No se pudo leer la página.")
    for (const d of destinos) salida[d] = { ok: false, error }
    return salida
  }
  await Promise.all(
    destinos.map(async (d) => {
      try {
        if (d === "ig") {
          salida.ig = await instagram(p, tipo, url, texto, hasta)
          return
        }
        // Facebook no tiene un "en proceso" que se pueda retomar: si no contesta
        // antes del corte, no se sabe si salió. Se dice así, sin dar por fallido
        // algo que puede estar publicándose (reintentar lo duplicaría).
        let reloj: ReturnType<typeof setTimeout> | undefined
        const limite = new Promise<Resultado>((r) => {
          reloj = setTimeout(
            () =>
              r({
                ok: false,
                error: "Facebook no contestó a tiempo. Puede que el video igual salga: revisa la página antes de volver a publicarlo.",
              }),
            Math.max(0, hasta - Date.now()) + 8_000,
          )
        })
        try {
          salida.fb = await Promise.race([facebook(p, tipo, url, texto), limite])
        } finally {
          clearTimeout(reloj)
        }
      } catch (e) {
        salida[d] = { ok: false, error: mensaje(e, "Error desconocido.") }
      }
    }),
  )
  return salida
}

/** Vuelve a mirar un reel que quedó en proceso y, si ya terminó, lo publica. */
export async function continuar(cuenta: Cuenta, contenedor: string): Promise<Resultado> {
  try {
    const p = await pagina(cuenta)
    if (!p.idInstagram) return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada." }
    return await esperarYPublicar(p.idInstagram, contenedor, p.tokenPagina, Date.now() + PRESUPUESTO_MS)
  } catch (e) {
    return { ok: false, error: mensaje(e, "Error desconocido.") }
  }
}

// ──────────────────────────────────────────────────────────────
// LOS NÚMEROS DE LAS CUENTAS (para /centro)
// Lo que Meta dice hoy, sin guardar nada: seguidores y publicaciones.
// ──────────────────────────────────────────────────────────────

export type Redes = {
  facebook: { nombre: string; seguidores: number | null } | { error: string }
  instagram: { usuario: string; seguidores: number | null; publicaciones: number | null } | { error: string }
}

export async function resumenRedes(cuenta: Cuenta = "kev"): Promise<Redes> {
  let p: Pagina
  try {
    p = await pagina(cuenta)
  } catch (e) {
    const error = mensaje(e, "No se pudo leer la página.")
    return { facebook: { error }, instagram: { error } }
  }
  const num = (v: unknown) => (typeof v === "number" ? v : null)
  let facebook: Redes["facebook"]
  try {
    const j = await llamar(`${p.idPagina}?fields=name,followers_count,fan_count`, p.tokenPagina)
    facebook = { nombre: String(j.name ?? ""), seguidores: num(j.followers_count) ?? num(j.fan_count) }
  } catch (e) {
    facebook = { error: mensaje(e, "Error de Facebook.") }
  }
  let instagram: Redes["instagram"]
  if (!p.idInstagram) {
    instagram = { error: "La página no tiene un Instagram profesional conectado." }
  } else {
    try {
      const j = await llamar(`${p.idInstagram}?fields=username,followers_count,media_count`, p.tokenPagina)
      instagram = { usuario: String(j.username ?? ""), seguidores: num(j.followers_count), publicaciones: num(j.media_count) }
    } catch (e) {
      instagram = { error: mensaje(e, "Error de Instagram.") }
    }
  }
  return { facebook, instagram }
}
