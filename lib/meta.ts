// ──────────────────────────────────────────────────────────────
// PUBLICAR EN INSTAGRAM Y FACEBOOK
//
// Solo se importa desde el servidor (app/api/publicar, lib/centro y el
// adaptador de la fábrica, lib/fabrica/redes/meta-reels.ts): los tokens de
// Meta viven en Vercel y nunca llegan al navegador ni al repo.
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
//
// Solo en la cuenta casa-blanca (todo lo que publica es ficción hecha con IA):
//   - el Reel lleva is_ai_generated=true (Instagram, changelog del 22-jun-2026)
//   - antes de publicar se lee content_publishing_limit: con el tope de 24 h
//     lleno, no se crea el contenedor (no_hoy).
// La cuenta de Kev se comporta igual que siempre (Graph v23.0, la versión con
// la que se probó su flujo). Excepción: un video de la casa publicado desde su
// cuenta también lleva is_ai_generated (es ficción hecha con IA igual).
//
// Cada fallo trae `clase` (reintentable | no_hoy | fatal | ambiguo) y, si Meta
// lo dio, `codigo`/`subcodigo`: la fábrica decide con eso, no leyendo el texto.
// ──────────────────────────────────────────────────────────────

import type { Clase } from "./fabrica/tipos"
import { BASE_VIDEOS, VARIABLES, faltaVariable, type Cuenta, type Destino, type Tipo } from "./publicar-pedido"

export type { Cuenta, Destino, Tipo }

/**
 * La versión de Graph de cada cuenta. La de Kev sigue en v23.0: es con la que
 * se probó su publicación manual, y cambiarla sin probar podría romperla sin
 * que nadie tocara su configuración. La casa usa v26.0 (salió el 29-jul-2026,
 * verificada el 2026-10-29). META_GRAPH_URL pisa las dos.
 * Para pasar la de Kev a v26.0: una publicación de prueba en su cuenta primero.
 */
export const GRAPH_VERSIONES: Readonly<Record<Cuenta, string>> = { kev: "v23.0", "casa-blanca": "v26.0" }
export const GRAPH_VERSION = GRAPH_VERSIONES["casa-blanca"]

type Entorno = Record<string, string | undefined>

/** Lo que se puede inyectar (la fábrica pasa su fetch y su entorno; los tests, uno falso). */
export interface PuertosMeta {
  fetch?: typeof fetch
  env?: Entorno
}

interface P {
  fetch: typeof fetch
  env: Entorno
  cuenta: Cuenta
}

// El fetch global se busca al llamar, no al importar: así un test puede reemplazarlo.
const puertos = (cuenta: Cuenta, p?: PuertosMeta): P => ({ fetch: p?.fetch ?? ((u, i) => fetch(u, i)), env: p?.env ?? process.env, cuenta })
/** La URL base de Graph para esa cuenta. */
export const graphDe = (env: Entorno, cuenta: Cuenta) => env.META_GRAPH_URL || `https://graph.facebook.com/${GRAPH_VERSIONES[cuenta]}`

/**
 * `pendiente` = Instagram todavía procesa el video. No es un fallo: trae el id
 * del contenedor para volver a mirarlo con continuar() y publicarlo al terminar.
 */
export type Resultado =
  | { ok: true; id: string; enlace?: string }
  | { ok: false; error: string; pendiente?: string; clase?: Clase; codigo?: string; subcodigo?: string }

type Pagina = { tokenPagina: string; idPagina: string; idInstagram: string | null }

class ErrorMeta extends Error {
  constructor(
    mensaje: string,
    readonly clase: Clase = "fatal",
    readonly codigo?: string,
    readonly subcodigo?: string,
  ) {
    super(mensaje)
  }
}
/** Meta no contestó antes del límite. No dice si lo pedido se hizo o no. */
class SinRespuesta extends ErrorMeta {
  constructor(mensaje: string, metodo: "GET" | "POST") {
    super(mensaje, metodo === "GET" ? "reintentable" : "ambiguo", "sin_respuesta")
  }
}

// ── Clases de error de Graph ──────────────────────────────────

/** Topes: 9 (spam/tope de la app), 80002 (tope de Instagram), subcódigo 2207042 (tope de publicaciones de 24 h). */
const NO_HOY_CODIGOS = new Set([9, 80002, 368])
const NO_HOY_SUBCODIGOS = new Set([2207042])
/** Temporales: 1 y 2 (error de Meta), 4/17/32/613 (llamadas de más en la hora). */
const REINTENTABLE_CODIGOS = new Set([1, 2, 4, 17, 32, 341, 613])

/**
 * Pura. 190 (token), 10 y 200–299 (permisos), 100 (parámetro) → fatal.
 * 9 / 80002 / 2207042 → no_hoy. 1 / 2 / topes por hora / 5xx → reintentable.
 */
export function clasificarMeta(status: number, cuerpo: unknown): Clase {
  const e = (cuerpo && typeof cuerpo === "object" ? (cuerpo as { error?: unknown }).error : undefined) as
    | { code?: unknown; error_subcode?: unknown; is_transient?: unknown }
    | undefined
  const codigo = Number(e?.code)
  const sub = Number(e?.error_subcode)
  if (NO_HOY_SUBCODIGOS.has(sub) || NO_HOY_CODIGOS.has(codigo)) return "no_hoy"
  if (codigo === 190 || codigo === 10 || (codigo >= 200 && codigo <= 299)) return "fatal"
  if (REINTENTABLE_CODIGOS.has(codigo) || e?.is_transient === true) return "reintentable"
  if (status >= 500 || status === 429) return "reintentable"
  return "fatal"
}

// Lo que espera una llamada que no trae límite propio.
const LLAMADA_MS = 15_000

/**
 * `limite` = el instante (ms) en que hay que dejar de esperar. Sin él, la
 * llamada tiene LLAMADA_MS. Una llamada colgada no puede llevarse la ruta
 * entera: Vercel la corta a los 60 s y la página se queda sin saber qué salió.
 */
async function llamar(
  p: P,
  ruta: string,
  token: string,
  metodo: "GET" | "POST" = "GET",
  cuerpo?: Record<string, string>,
  limite?: number,
) {
  const url = new URL(`${graphDe(p.env, p.cuenta)}/${ruta}`)
  const espera = limite === undefined ? LLAMADA_MS : Math.max(1_000, limite - Date.now())
  const init: RequestInit = { method: metodo, cache: "no-store", signal: AbortSignal.timeout(espera) }
  if (metodo === "GET") {
    url.searchParams.set("access_token", token)
  } else {
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" }
    init.body = new URLSearchParams({ ...cuerpo, access_token: token })
  }
  let r: Response
  let j: Record<string, unknown> & { error?: { message?: string; code?: unknown; error_subcode?: unknown } }
  try {
    r = await p.fetch(url, init)
    j = (await r.json().catch(() => ({}))) as typeof j
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new SinRespuesta(`Meta no contestó en ${Math.round(espera / 1000)} s.`, metodo)
    }
    // Error de red: leer se repite; un POST pudo haber llegado.
    throw new ErrorMeta(e instanceof Error ? e.message : String(e), metodo === "GET" ? "reintentable" : "ambiguo", "red")
  }
  if (!r.ok || j.error) {
    // El mensaje de Meta tal cual: es el que dice qué permiso falta.
    const codigo = j.error?.code === undefined ? undefined : String(j.error.code)
    const sub = j.error?.error_subcode === undefined ? undefined : String(j.error.error_subcode)
    throw new ErrorMeta(j.error?.message || `Meta respondió ${r.status}.`, clasificarMeta(r.status, j), codigo ?? String(r.status), sub)
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

async function pagina(p: P, cuenta: Cuenta, limite?: number): Promise<Pagina> {
  const v = VARIABLES[cuenta]
  const sistema = p.env[v.token]?.trim()
  const id = p.env[v.pagina]?.trim()
  if (!sistema || !id) throw new ErrorMeta(`Falta ${sistema ? v.pagina : v.token} en las variables de entorno.`, "fatal", "sin_configurar")
  const j = await llamar(p, `${id}?fields=access_token,instagram_business_account`, sistema, "GET", undefined, limite)
  const tokenPagina = typeof j.access_token === "string" ? j.access_token : null
  if (!tokenPagina) {
    throw new ErrorMeta("El usuario del sistema no tiene acceso a esta página. Asígnale la página en Meta Business.", "fatal", "sin_acceso")
  }
  const ig = j.instagram_business_account as { id?: string } | undefined
  return { tokenPagina, idPagina: id, idInstagram: ig?.id ?? null }
}

// La ruta tiene 60 s (maxDuration). Lo que no termina antes de esto se
// devuelve como "en proceso" en vez de dejar que Vercel corte a la mitad.
const PRESUPUESTO_MS = 45_000
// Después del presupuesto se deja de ESPERAR a Meta: ninguna llamada pasa de
// aquí (45 + 10 = 55 s, antes de los 60 de Vercel).
const MARGEN_MS = 10_000
const PAUSA_MS = 5_000
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

const permalink = async (p: P, id: string, token: string, limite?: number) => {
  const e = await llamar(p, `${id}?fields=permalink`, token, "GET", undefined, limite).catch((err) => {
    // Sin enlace el post igual salió: se loguea por qué falta, no se tapa.
    console.error(`[meta] permalink de ${id} falló: ${err instanceof Error ? err.message : err}`)
    return {} as Record<string, unknown>
  })
  return typeof e.permalink === "string" ? e.permalink : undefined
}

/** Los campos de un fallo a partir de lo que se lanzó. */
const detalle = (e: unknown): { clase?: Clase; codigo?: string; subcodigo?: string } =>
  e instanceof ErrorMeta
    ? { clase: e.clase, ...(e.codigo ? { codigo: e.codigo } : {}), ...(e.subcodigo ? { subcodigo: e.subcodigo } : {}) }
    : {}

// Un video en Instagram no se publica al instante: Meta lo descarga y lo
// procesa (status_code IN_PROGRESS). Solo con FINISHED se puede llamar a
// media_publish; antes, falla. Si el tiempo no alcanza, queda pendiente.
//
// Con el contenedor ya creado, nada se da por fallido por falta de tiempo:
// una llamada sin respuesta deja el reel "en proceso", y la próxima vuelta lee
// status_code (PUBLISHED = ya salió, no se publica otra vez).
async function esperarYPublicar(p: P, idInstagram: string, contenedor: string, token: string, hasta: number): Promise<Resultado> {
  const duro = hasta + MARGEN_MS
  const enProceso: Resultado = { ok: false, pendiente: contenedor, error: "Instagram sigue procesando el video.", clase: "reintentable" }
  const estadoDe = async () => {
    const j = await llamar(p, `${contenedor}?fields=status_code,status`, token, "GET", undefined, duro)
    return { estado: String(j.status_code ?? ""), detalle: String(j.status ?? j.status_code ?? "") }
  }
  try {
    for (;;) {
      const { estado, detalle: det } = await estadoDe()
      if (estado === "FINISHED") {
        let pub: Record<string, unknown>
        try {
          pub = await llamar(p, `${idInstagram}/media_publish`, token, "POST", { creation_id: contenedor }, duro)
        } catch (e) {
          if (e instanceof SinRespuesta) throw e
          // Otra vuelta pudo publicarlo justo antes (dos pedidos sobre el mismo
          // contenedor): si Meta ya lo marca PUBLISHED, salió, no es un error.
          const ahora = await estadoDe().catch((err) => {
            console.error(`[meta] status_code de ${contenedor} tras fallar media_publish: ${mensaje(err, "sin detalle")}`)
            return null
          })
          if (ahora?.estado === "PUBLISHED") return { ok: true, id: contenedor }
          // Un rechazo seguro (token, permiso, parámetro) no publicó nada.
          if (e instanceof ErrorMeta && e.clase === "fatal") throw e
          // Cualquier otra cosa (5xx, códigos 1 o 2, la red) pudo haber
          // publicado y Meta todavía no lo dice. Se devuelve el MISMO
          // contenedor: el próximo intento lo retoma con continuar() y ve
          // PUBLISHED, en vez de crear otro y sacar el Reel dos veces.
          const d = detalle(e)
          return {
            ok: false,
            pendiente: contenedor,
            error: `media_publish falló (${mensaje(e, "sin detalle")}); se retoma el mismo contenedor.`,
            clase: "reintentable",
            ...(d.codigo ? { codigo: d.codigo } : {}),
            ...(d.subcodigo ? { subcodigo: d.subcodigo } : {}),
          }
        }
        const id = String(pub.id)
        return { ok: true, id, enlace: await permalink(p, id, token, duro) }
      }
      // Ya salió (otra pestaña, o un intento anterior que no llegó a contestar).
      // No se publica de nuevo: un segundo media_publish sería un reel repetido.
      if (estado === "PUBLISHED") return { ok: true, id: contenedor }
      if (estado === "ERROR" || estado === "EXPIRED") {
        // Un contenedor caído no se retoma: con fatal la fábrica no vuelve a mirarlo en bucle.
        return { ok: false, error: `Instagram no pudo procesar el video (${det}).`, clase: "fatal", codigo: estado }
      }
      if (Date.now() + PAUSA_MS > hasta) return enProceso
      await dormir(PAUSA_MS)
    }
  } catch (e) {
    if (e instanceof SinRespuesta) return enProceso
    throw e
  }
}

/** El cuerpo del contenedor de Instagram. Puro: lo revisa la guarda de etiquetas de IA de la fábrica. */
export function cuerpoInstagram(cuenta: Cuenta, tipo: Tipo, url: string, texto: string): Record<string, string> {
  // Video = REELS: Meta dejó de aceptar media_type=VIDEO para publicaciones
  // sueltas. Un reel acepta horizontal (16:9 y 4:3) hasta 1920 px de ancho.
  const cuerpo: Record<string, string> =
    tipo === "video"
      ? { media_type: "REELS", video_url: url, caption: texto, share_to_feed: "true" }
      : { image_url: url, caption: texto }
  // La Casa Blanca Project es ficción hecha con IA: la etiqueta "Info de IA" de
  // Instagram. También un video de la casa que Kev publica desde su cuenta.
  if (cuenta === "casa-blanca" || url.startsWith(BASE_VIDEOS)) cuerpo.is_ai_generated = "true"
  return cuerpo
}

/**
 * El tope de publicaciones de 24 h de Instagram. Null si no se pudo leer (se
 * loguea el porqué y se sigue: si de verdad está lleno, Meta contesta 9/2207042).
 */
export async function topeInstagram(
  p: P,
  idInstagram: string,
  token: string,
  limite?: number,
): Promise<{ usadas: number; total: number } | null> {
  try {
    const j = await llamar(p, `${idInstagram}/content_publishing_limit?fields=config,quota_usage`, token, "GET", undefined, limite)
    const d = Array.isArray(j.data) ? (j.data[0] as Record<string, unknown> | undefined) : undefined
    const usadas = Number(d?.quota_usage)
    const total = Number((d?.config as { quota_total?: unknown } | undefined)?.quota_total)
    if (!Number.isFinite(usadas) || !Number.isFinite(total) || total <= 0) {
      console.error(`[meta] content_publishing_limit sin números: ${JSON.stringify(j).slice(0, 300)}`)
      return null
    }
    return { usadas, total }
  } catch (e) {
    console.error(`[meta] content_publishing_limit falló: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

async function instagram(p: P, cuenta: Cuenta, pg: Pagina, tipo: Tipo, url: string, texto: string, hasta: number): Promise<Resultado> {
  if (!pg.idInstagram) {
    return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada.", clase: "fatal", codigo: "sin_instagram" }
  }
  const cuerpo = cuerpoInstagram(cuenta, tipo, url, texto)
  const duro = hasta + MARGEN_MS
  if (cuenta === "casa-blanca") {
    const tope = await topeInstagram(p, pg.idInstagram, pg.tokenPagina, duro)
    if (tope && tope.usadas >= tope.total) {
      return {
        ok: false,
        error: `Instagram: tope de publicaciones de 24 h lleno (${tope.usadas} de ${tope.total}).`,
        clase: "no_hoy",
        codigo: "content_publishing_limit",
      }
    }
  }
  let c: Record<string, unknown>
  try {
    c = await llamar(p, `${pg.idInstagram}/media`, pg.tokenPagina, "POST", cuerpo, duro)
  } catch (e) {
    // Sin id de contenedor no hay nada que retomar, y un contenedor que nadie
    // publica no sale: volver a intentarlo no lo duplica.
    if (e instanceof SinRespuesta) {
      return { ok: false, error: "Instagram no contestó a tiempo. Inténtalo de nuevo.", clase: "reintentable", codigo: "sin_respuesta" }
    }
    throw e
  }
  const contenedor = String(c.id)
  if (tipo === "video") return esperarYPublicar(p, pg.idInstagram, contenedor, pg.tokenPagina, hasta)
  const pub = await llamar(p, `${pg.idInstagram}/media_publish`, pg.tokenPagina, "POST", { creation_id: contenedor }, duro)
  const id = String(pub.id)
  return { ok: true, id, enlace: await permalink(p, id, pg.tokenPagina, duro) }
}

async function facebook(p: P, pg: Pagina, tipo: Tipo, url: string, texto: string, limite: number): Promise<Resultado> {
  // Video: /{página}/videos con file_url. Meta lo descarga de esa dirección y
  // lo procesa por su cuenta; contesta con el id del video apenas lo acepta.
  let j: Record<string, unknown>
  try {
    j =
      tipo === "video"
        ? await llamar(p, `${pg.idPagina}/videos`, pg.tokenPagina, "POST", { file_url: url, description: texto }, limite)
        : await llamar(p, `${pg.idPagina}/photos`, pg.tokenPagina, "POST", { url, caption: texto }, limite)
  } catch (e) {
    // Facebook no tiene un "en proceso" que se pueda retomar: si no contesta
    // antes del corte, no se sabe si salió. Se dice así, sin dar por fallido
    // algo que puede estar publicándose (reintentar lo duplicaría).
    if (e instanceof SinRespuesta) {
      return {
        ok: false,
        error: "Facebook no contestó a tiempo. Puede que el video igual salga: revisa la página antes de volver a publicarlo.",
        clase: "ambiguo",
        codigo: "sin_respuesta",
      }
    }
    throw e
  }
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
  presupuestoMs = PRESUPUESTO_MS,
  inyectado?: PuertosMeta,
): Promise<Record<Destino, Resultado | undefined>> {
  const p = puertos(cuenta, inyectado)
  const hasta = Date.now() + presupuestoMs
  const salida: Record<Destino, Resultado | undefined> = { ig: undefined, fb: undefined }
  let pg: Pagina
  try {
    pg = await pagina(p, cuenta, hasta)
  } catch (e) {
    const error = mensaje(e, "No se pudo leer la página.")
    for (const d of destinos) salida[d] = { ok: false, error, ...detalle(e) }
    return salida
  }
  await Promise.all(
    destinos.map(async (d) => {
      try {
        if (d === "ig") {
          salida.ig = await instagram(p, cuenta, pg, tipo, url, texto, hasta)
          return
        }
        // Hasta 53 s: después de los 45 del presupuesto, unos segundos más
        // para que Meta acepte el archivo, y antes de los 60 de Vercel.
        salida.fb = await facebook(p, pg, tipo, url, texto, hasta + 8_000)
      } catch (e) {
        salida[d] = { ok: false, error: mensaje(e, "Error desconocido."), ...detalle(e) }
      }
    }),
  )
  return salida
}

/** Vuelve a mirar un reel que quedó en proceso y, si ya terminó, lo publica. */
export async function continuar(cuenta: Cuenta, contenedor: string, presupuestoMs = PRESUPUESTO_MS, inyectado?: PuertosMeta): Promise<Resultado> {
  const p = puertos(cuenta, inyectado)
  const hasta = Date.now() + presupuestoMs
  try {
    const pg = await pagina(p, cuenta, hasta)
    if (!pg.idInstagram) {
      return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada.", clase: "fatal", codigo: "sin_instagram" }
    }
    return await esperarYPublicar(p, pg.idInstagram, contenedor, pg.tokenPagina, hasta)
  } catch (e) {
    // Sin respuesta de Meta no se sabe nada nuevo: el reel sigue pendiente.
    if (e instanceof SinRespuesta) return { ok: false, pendiente: contenedor, error: "Meta no contestó a tiempo.", clase: "reintentable", codigo: "sin_respuesta" }
    return { ok: false, error: mensaje(e, "Error desconocido."), ...detalle(e) }
  }
}

// ──────────────────────────────────────────────────────────────
// LO QUE YA ESTÁ PUBLICADO (para la fábrica: un envío ambiguo se busca
// aquí antes de repetirlo, y 15 min después de salir se mira si es público)
// ──────────────────────────────────────────────────────────────

export type Post = { id: string; texto: string; creado: string }
export type FalloLectura = { ok: false; error: string; clase: Clase; codigo?: string; subcodigo?: string }

/** Los videos de la página (Facebook) o los posts de Instagram desde `desde`. */
export async function recientes(
  cuenta: Cuenta,
  destino: Destino,
  desde: Date,
  inyectado?: PuertosMeta,
): Promise<{ ok: true; posts: Post[] } | FalloLectura> {
  const p = puertos(cuenta, inyectado)
  try {
    const pg = await pagina(p, cuenta)
    let j: Record<string, unknown>
    if (destino === "fb") {
      j = await llamar(p, `${pg.idPagina}/videos?fields=id,description,created_time&limit=50`, pg.tokenPagina)
    } else {
      if (!pg.idInstagram) return { ok: false, error: "La página no tiene una cuenta de Instagram profesional conectada.", clase: "fatal" }
      j = await llamar(p, `${pg.idInstagram}/media?fields=id,caption,timestamp&limit=50`, pg.tokenPagina)
    }
    if (!Array.isArray(j.data)) return { ok: false, error: `Meta contestó sin data: ${JSON.stringify(j).slice(0, 300)}`, clase: "reintentable" }
    const posts: Post[] = []
    for (const x of j.data as Record<string, unknown>[]) {
      const creado = String(x.created_time ?? x.timestamp ?? "")
      // Meta escribe "2026-10-29T16:00:00+0000": Date.parse lo entiende.
      if (!x.id || (creado && Date.parse(creado) < desde.getTime())) continue
      posts.push({ id: String(x.id), texto: String(x.description ?? x.caption ?? ""), creado })
    }
    return { ok: true, posts }
  } catch (e) {
    const d = detalle(e)
    return { ok: false, error: mensaje(e, "Error desconocido."), clase: d.clase ?? "reintentable", ...d }
  }
}

export type VisibilidadMeta = "publico" | "privado" | "procesando" | "no_existe" | "desconocida"

/** Si un post sigue en pie y es público. Instagram no tiene posts privados en una cuenta profesional. */
export async function estadoPost(
  cuenta: Cuenta,
  destino: Destino,
  id: string,
  inyectado?: PuertosMeta,
): Promise<{ visibilidad: VisibilidadMeta; como: string }> {
  const p = puertos(cuenta, inyectado)
  try {
    const pg = await pagina(p, cuenta)
    if (destino === "ig") {
      const j = await llamar(p, `${id}?fields=id,permalink`, pg.tokenPagina)
      return j.id ? { visibilidad: "publico", como: `existe (${String(j.permalink ?? "sin permalink")})` } : { visibilidad: "desconocida", como: "Meta contestó sin id" }
    }
    const j = await llamar(p, `${id}?fields=id,published,status,permalink_url`, pg.tokenPagina)
    const estado = String((j.status as { video_status?: unknown } | undefined)?.video_status ?? "")
    const como = `published=${String(j.published)} video_status=${estado || "?"}`
    if (estado === "error") return { visibilidad: "no_existe", como }
    if (estado === "processing" || estado === "uploading") return { visibilidad: "procesando", como }
    if (j.published === false) return { visibilidad: "privado", como }
    if (j.published === true) return { visibilidad: "publico", como }
    return { visibilidad: "desconocida", como }
  } catch (e) {
    // 100 con subcódigo 33 = el objeto no existe (o no se ve con este token).
    if (e instanceof ErrorMeta && e.codigo === "100" && e.subcodigo === "33") return { visibilidad: "no_existe", como: e.message }
    return { visibilidad: "desconocida", como: mensaje(e, "Error desconocido.") }
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
  const p = puertos(cuenta)
  let pg: Pagina
  try {
    pg = await pagina(p, cuenta)
  } catch (e) {
    const error = mensaje(e, "No se pudo leer la página.")
    return { facebook: { error }, instagram: { error } }
  }
  const num = (v: unknown) => (typeof v === "number" ? v : null)
  let facebook: Redes["facebook"]
  try {
    const j = await llamar(p, `${pg.idPagina}?fields=name,followers_count,fan_count`, pg.tokenPagina)
    facebook = { nombre: String(j.name ?? ""), seguidores: num(j.followers_count) ?? num(j.fan_count) }
  } catch (e) {
    facebook = { error: mensaje(e, "Error de Facebook.") }
  }
  let instagram: Redes["instagram"]
  if (!pg.idInstagram) {
    instagram = { error: "La página no tiene un Instagram profesional conectado." }
  } else {
    try {
      const j = await llamar(p, `${pg.idInstagram}?fields=username,followers_count,media_count`, pg.tokenPagina)
      instagram = { usuario: String(j.username ?? ""), seguidores: num(j.followers_count), publicaciones: num(j.media_count) }
    } catch (e) {
      instagram = { error: mensaje(e, "Error de Instagram.") }
    }
  }
  return { facebook, instagram }
}
