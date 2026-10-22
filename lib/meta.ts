// ──────────────────────────────────────────────────────────────
// PUBLICAR EN INSTAGRAM Y FACEBOOK
//
// Solo se importa desde app/api/publicar (servidor): el token del usuario del sistema de Meta vive en
// Vercel (META_SYSTEM_TOKEN) y nunca llega al navegador ni al repo.
//
// Con un solo token y el id de la página alcanza. De la página se sacan dos
// cosas: su propio token (para publicar en Facebook) y la cuenta de Instagram
// conectada a ella. Así no hay que guardar tres secretos que se desincronizan.
//
// Meta NO acepta archivos sueltos: pide una dirección pública desde donde ir a
// buscar el video o la foto. Por eso todo entra como `url`.
// ──────────────────────────────────────────────────────────────

const GRAPH = process.env.META_GRAPH_URL || "https://graph.facebook.com/v23.0"

export type Tipo = "foto" | "video"
export type Destino = "ig" | "fb"
export type Resultado = { ok: true; id: string; enlace?: string } | { ok: false; error: string }

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

export function configurado(): { ok: true } | { ok: false; falta: string } {
  if (!process.env.META_SYSTEM_TOKEN) return { ok: false, falta: "META_SYSTEM_TOKEN" }
  if (!process.env.META_PAGE_ID) return { ok: false, falta: "META_PAGE_ID" }
  return { ok: true }
}

async function pagina(): Promise<Pagina> {
  const sistema = process.env.META_SYSTEM_TOKEN!
  const id = process.env.META_PAGE_ID!
  const j = await llamar(`${id}?fields=access_token,instagram_business_account`, sistema)
  const tokenPagina = typeof j.access_token === "string" ? j.access_token : null
  if (!tokenPagina) {
    throw new ErrorMeta("El usuario del sistema no tiene acceso a esta página. Asígnale la página en Meta Business.")
  }
  const ig = j.instagram_business_account as { id?: string } | undefined
  return { tokenPagina, idPagina: id, idInstagram: ig?.id ?? null }
}

// Un video en Instagram no se publica al instante: Meta lo descarga y lo
// procesa. Hay que esperar a que diga FINISHED antes de publicarlo; si se
// publica antes, falla.
async function esperarProceso(contenedor: string, token: string, hastaMs = 50_000) {
  const fin = Date.now() + hastaMs
  while (Date.now() < fin) {
    const j = await llamar(`${contenedor}?fields=status_code,status`, token)
    if (j.status_code === "FINISHED") return
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") {
      throw new ErrorMeta(`Instagram no pudo procesar el video (${String(j.status ?? j.status_code)}).`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new ErrorMeta("Instagram sigue procesando el video. Vuelve a intentarlo en unos minutos.")
}

async function instagram(p: Pagina, tipo: Tipo, url: string, texto: string): Promise<Resultado> {
  if (!p.idInstagram) {
    return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada." }
  }
  const cuerpo: Record<string, string> =
    tipo === "video"
      ? { media_type: "REELS", video_url: url, caption: texto, share_to_feed: "true" }
      : { image_url: url, caption: texto }
  const c = await llamar(`${p.idInstagram}/media`, p.tokenPagina, "POST", cuerpo)
  const contenedor = String(c.id)
  if (tipo === "video") await esperarProceso(contenedor, p.tokenPagina)
  const pub = await llamar(`${p.idInstagram}/media_publish`, p.tokenPagina, "POST", { creation_id: contenedor })
  const id = String(pub.id)
  const e = await llamar(`${id}?fields=permalink`, p.tokenPagina).catch(() => ({}) as Record<string, unknown>)
  return { ok: true, id, enlace: typeof e.permalink === "string" ? e.permalink : undefined }
}

async function facebook(p: Pagina, tipo: Tipo, url: string, texto: string): Promise<Resultado> {
  const j =
    tipo === "video"
      ? await llamar(`${p.idPagina}/videos`, p.tokenPagina, "POST", { file_url: url, description: texto })
      : await llamar(`${p.idPagina}/photos`, p.tokenPagina, "POST", { url, caption: texto })
  const id = String(j.post_id ?? j.id)
  return { ok: true, id, enlace: `https://www.facebook.com/${id}` }
}

/** Publica en cada destino por separado: si Instagram falla, Facebook igual
 *  sale, y la respuesta dice cuál salió y cuál no. */
export async function publicar(
  tipo: Tipo,
  url: string,
  texto: string,
  destinos: Destino[],
): Promise<Record<Destino, Resultado | undefined>> {
  const salida: Record<Destino, Resultado | undefined> = { ig: undefined, fb: undefined }
  let p: Pagina
  try {
    p = await pagina()
  } catch (e) {
    const error = e instanceof Error ? e.message : "No se pudo leer la página."
    for (const d of destinos) salida[d] = { ok: false, error }
    return salida
  }
  await Promise.all(
    destinos.map(async (d) => {
      try {
        salida[d] = d === "ig" ? await instagram(p, tipo, url, texto) : await facebook(p, tipo, url, texto)
      } catch (e) {
        salida[d] = { ok: false, error: e instanceof Error ? e.message : "Error desconocido." }
      }
    }),
  )
  return salida
}
