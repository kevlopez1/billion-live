// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · YOUTUBE (YouTube Data API v3)
//
// El camino de un video:
//   subir()        (VM) videos.insert reanudable, PRIVADO y sin publishAt,
//                  con status.containsSyntheticMedia = true. Después se lee
//                  el estado real (videos.list) para dejar el cómo.
//   programar()    (tick, de T−3 h a T) videos.update: privado + publishAt.
//                  Solo dentro de ~3 h: así el interruptor lo alcanza.
//   publicar()     (tick, a la hora, si no se programó) videos.update a
//                  público y se relee: si YouTube lo deja privado, es el
//                  bloqueo de un proyecto de API sin auditar → fatal.
//   desprogramar() (interruptor) videos.update a privado sin publishAt.
//   subtitular()   captions.insert, aparte (el envío ya está `subido`).
//
// OJO videos.update con part=status REEMPLAZA todo el status: lo que no se
// manda se borra. Por eso cada update vuelve a mandar containsSyntheticMedia
// y selfDeclaredMadeForKids (statusDe()).
//
// Cuota (unidades por llamada, 10.000 por día de base):
//   videos.insert ~100 desde dic-2025 (antes 1.600) · SIN VERIFICAR: mirarlo en
//   la consola de Google Cloud antes de subir el ritmo · videos.update 50 ·
//   captions.insert 400 · videos.list, channels.list, playlistItems.list 1.
//
// OAuth: el refresh token de Google NO rota (se reusa). Ojo: con la pantalla
// de consentimiento en modo "Testing", Google lo vence a los 7 días.
// ──────────────────────────────────────────────────────────────

import { etiquetaIA } from "../guardas"
import type { Adaptador, Clase, Ctx, Entorno, Fallo, Reciente, VideoParaRed, Visibilidad } from "../tipos"
import { bytesDelArchivo, campo, esFallo, falloHttp, ok2xx, pedir, recortar, texto, type Respuesta } from "./http"

export const YT_API = "https://www.googleapis.com/youtube/v3"
export const YT_SUBIDA = "https://www.googleapis.com/upload/youtube/v3"
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"

/** Unidades de cuota por llamada (ver cabecera). */
export const CUOTA = { insert: 100, update: 50, captions: 400, list: 1 } as const

/** publishAt solo para las próximas ~3 h (+10 min de margen para el tick). */
export const VENTANA_PUBLISH_AT_MIN = 190
/** Categoría 24 = Entretenimiento. */
export const CATEGORIA = "24"

// ── Errores ───────────────────────────────────────────────────

const NO_HOY = new Set(["quotaExceeded", "dailyLimitExceeded", "uploadLimitExceeded", "rateLimitExceededDaily"])
const REINTENTABLE = new Set(["rateLimitExceeded", "userRateLimitExceeded", "backendError", "internalError", "servingLimitExceeded"])

/** El motivo de Google: error.errors[0].reason, o el `error` de OAuth ("invalid_grant"). */
export function motivoYouTube(cuerpo: unknown): string | undefined {
  return texto(campo(cuerpo, "error", "errors", 0, "reason")) ?? texto(campo(cuerpo, "error", "status")) ?? texto(campo(cuerpo, "error"))
}

/**
 * quotaExceeded / uploadLimitExceeded → no_hoy. rateLimit, backendError, 5xx,
 * 408, 429 → reintentable. 401, invalid_grant, sin permiso, 400, 404 → fatal.
 */
export function clasificarYouTube(status: number, cuerpo: unknown): Clase {
  const motivo = motivoYouTube(cuerpo)
  if (motivo && NO_HOY.has(motivo)) return "no_hoy"
  if (motivo && REINTENTABLE.has(motivo)) return "reintentable"
  if (status >= 500 || status === 408 || status === 429) return "reintentable"
  return "fatal"
}

const falla = (paso: string, r: Respuesta): Fallo => falloHttp(paso, r, clasificarYouTube, motivoYouTube(r.cuerpo) ?? String(r.status))

// ── OAuth ─────────────────────────────────────────────────────

/** Renueva el acceso con el refresh token (que en Google no cambia). */
export async function renovarYouTube(
  refresh: string,
  p: { fetch: typeof fetch; env: Entorno },
): Promise<{ ok: true; acceso: string; expiraEn: string; refresh?: string } | Fallo> {
  const id = p.env.FABRICA_YT_CLIENT_ID?.trim()
  const secreto = p.env.FABRICA_YT_CLIENT_SECRET?.trim()
  if (!id || !secreto) return { ok: false, clase: "fatal", como: "youtube.token: faltan FABRICA_YT_CLIENT_ID o FABRICA_YT_CLIENT_SECRET" }
  const r = await pedir(
    p,
    GOOGLE_TOKEN,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secreto, refresh_token: refresh, grant_type: "refresh_token" }),
    },
    { ms: 15_000, idempotente: true, paso: "youtube.token" },
  )
  if (esFallo(r)) return r
  if (!ok2xx(r)) {
    const f = falla("youtube.token", r)
    // invalid_grant = revocado, vencido (modo Testing: 7 días) o la contraseña cambió.
    return motivoYouTube(r.cuerpo) === "invalid_grant" ? { ...f, clase: "fatal", como: `${f.como} · reautorizar YouTube` } : f
  }
  const acceso = texto(campo(r.cuerpo, "access_token"))
  const segundos = Number(campo(r.cuerpo, "expires_in") ?? 3600)
  if (!acceso) return { ok: false, clase: "reintentable", como: `youtube.token: respuesta sin access_token: ${recortar(r.texto)}` }
  return { ok: true, acceso, expiraEn: new Date(Date.now() + segundos * 1000).toISOString() }
}

// ── El cuerpo (con la etiqueta de IA) ────────────────────────

/** El status completo: privado por defecto, con la etiqueta de IA, nunca "para niños". */
export function statusDe(extra: { privacyStatus?: "private" | "public"; publishAt?: string } = {}) {
  return {
    privacyStatus: extra.privacyStatus ?? "private",
    ...(extra.publishAt ? { publishAt: extra.publishAt } : {}),
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  }
}

export function cuerpoSubida(v: Pick<VideoParaRed, "titulo" | "texto">) {
  return {
    snippet: {
      title: v.titulo.slice(0, 100),
      description: v.texto,
      categoryId: CATEGORIA,
      defaultLanguage: "es",
      defaultAudioLanguage: "es",
    },
    status: statusDe(),
  }
}

/** Sin la etiqueta de IA no sale nada: se corta antes de la red. */
function sinEtiqueta(paso: string, cuerpo: unknown): Fallo | null {
  const e = etiquetaIA("youtube", cuerpo)
  return e.length ? { ok: false, clase: "fatal", como: `${paso}: ${e.join("; ")}` } : null
}

// ── El adaptador ─────────────────────────────────────────────

export interface OpcionesYouTube {
  /** Corte de la subida de los bytes (VM). */
  msSubida?: number
}

/**
 * Sin token: la clase la dice tokens.ts (Ctx.tokenFallo). Un fallo pasajero
 * de la base o de la renovación es reintentable, un token sin cargar es
 * no_hoy; solo lo inválido es fatal (y sin el dato, fatal como antes).
 */
const sinToken = (paso: string, c: Ctx): Fallo => {
  const f = c.tokenFallo?.("youtube")
  return {
    ok: false,
    clase: f?.clase ?? "fatal",
    como: `${paso}: sin token de YouTube${f ? ` (${f.como})` : " (renovación fallida o sin cargar: ver fabrica_tokens.ultimo_error)"}`,
    ...(f?.codigo ? { codigo: f.codigo } : {}),
  }
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

/** Lee el status real de un video. 1 unidad. */
async function leerStatus(id: string, t: string, c: Ctx, paso: string): Promise<Record<string, unknown> | null | Fallo> {
  const r = await pedir(c, `${YT_API}/videos?part=status&id=${encodeURIComponent(id)}`, { headers: auth(t) }, { ms: 15_000, idempotente: true, paso })
  if (esFallo(r)) return r
  if (!ok2xx(r)) return falla(paso, r)
  const s = campo(r.cuerpo, "items", 0, "status")
  return s && typeof s === "object" ? (s as Record<string, unknown>) : null
}

/** videos.update del status (50 unidades). Idempotente: repetirlo deja lo mismo. */
async function actualizarStatus(id: string, status: ReturnType<typeof statusDe>, t: string, c: Ctx, paso: string) {
  const cuerpo = { id, status }
  const sin = sinEtiqueta(paso, cuerpo)
  if (sin) return sin
  const r = await pedir(
    c,
    `${YT_API}/videos?part=status`,
    { method: "PUT", headers: { ...auth(t), "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) },
    { ms: 20_000, idempotente: true, paso },
  )
  if (esFallo(r)) return r
  if (!ok2xx(r)) return falla(paso, r)
  return (campo(r.cuerpo, "status") ?? {}) as Record<string, unknown>
}

const mismoInstante = (a: unknown, b: string) => typeof a === "string" && Date.parse(a) === Date.parse(b)

export function crearYouTube(o: OpcionesYouTube = {}): Adaptador & {
  subtitular(idRed: string, contenido: string, c: Ctx, idioma?: string): Promise<{ ok: true; id: string } | Fallo>
} {
  const msSubida = o.msSubida ?? 15 * 60_000

  return {
    red: "youtube",
    clasificar: clasificarYouTube,

    async subir(v, c) {
      const paso = "youtube.subir"
      const cuerpo = cuerpoSubida(v)
      const sin = sinEtiqueta(paso, cuerpo)
      if (sin) return sin
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      const bytes = await bytesDelArchivo(c, v.archivo, paso)
      if (esFallo(bytes)) return bytes

      // 1. Abrir la sesión reanudable. Nada se crea hasta que llegan los bytes: se puede repetir.
      const ini = await pedir(
        c,
        `${YT_SUBIDA}/videos?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            ...auth(t),
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": String(bytes.byteLength),
          },
          body: JSON.stringify(cuerpo),
        },
        { ms: 30_000, idempotente: true, paso: `${paso} (abrir sesión)` },
      )
      if (esFallo(ini)) return ini
      if (!ok2xx(ini)) return falla(`${paso} (abrir sesión)`, ini)
      const sesion = ini.headers.get("location")
      if (!sesion) return { ok: false, clase: "reintentable", como: `${paso}: YouTube abrió la sesión sin Location: ${recortar(ini.texto)}` }

      // 2. Los bytes. Acá nace el video: cortarse aquí = puede existir.
      const put = await pedir(
        c,
        sesion,
        { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) }, body: bytes as unknown as BodyInit },
        { ms: msSubida, idempotente: false, paso: `${paso} (bytes, ${bytes.byteLength} B)` },
      )
      if (esFallo(put)) return put
      if (!ok2xx(put)) {
        const f = falla(`${paso} (bytes)`, put)
        // Un 5xx con los bytes ya mandados no dice si quedó: se mira antes de repetir.
        return f.clase === "reintentable" ? { ...f, clase: "ambiguo" } : f
      }
      const id = texto(campo(put.cuerpo, "id"))
      if (!id) return { ok: false, clase: "ambiguo", como: `${paso}: YouTube contestó ${put.status} sin id: ${recortar(put.texto)}` }

      // 3. El estado real, para dejar el cómo (un proyecto sin auditar lo deja bloqueado en privado).
      const s = await leerStatus(id, t, c, `${paso} (leer estado)`)
      if (esFallo(s)) {
        c.log(`[fabrica/youtube] ${id} subido; no se pudo leer su estado: ${s.como}`)
      } else if (!s) {
        c.log(`[fabrica/youtube] ${id} subido pero videos.list no lo devuelve todavía`)
      } else {
        c.log(
          `[fabrica/youtube] ${id} subido: privacyStatus=${String(s.privacyStatus)} uploadStatus=${String(s.uploadStatus)} containsSyntheticMedia=${String(s.containsSyntheticMedia)}`,
        )
        if (s.uploadStatus === "rejected" || s.uploadStatus === "failed") {
          return { ok: false, clase: "fatal", como: `${paso}: YouTube lo marcó ${s.uploadStatus} (${String(s.rejectionReason ?? s.failureReason ?? "sin motivo")})`, codigo: String(s.uploadStatus) }
        }
        if (s.privacyStatus && s.privacyStatus !== "private") {
          // Nunca debería: se pidió privado. Se baja ya y se avisa.
          await actualizarStatus(id, statusDe(), t, c, `${paso} (volver a privado)`)
          return { ok: false, clase: "fatal", como: `${paso}: YouTube lo dejó ${String(s.privacyStatus)} aunque se pidió privado (id ${id}); se volvió a privado` }
        }
      }
      return { ok: true, idRed: id }
    },

    async programar(v, publishAt, c) {
      const paso = "youtube.programar"
      if (!v.idRed) return { ok: false, clase: "fatal", como: `${paso}: sin id de YouTube (la VM no lo subió)` }
      const falta = Date.parse(publishAt) - c.ahora().getTime()
      if (!Number.isFinite(falta) || falta <= 60_000 || falta > VENTANA_PUBLISH_AT_MIN * 60_000) {
        return { ok: false, clase: "fatal", como: `${paso}: publishAt ${publishAt} fuera de la ventana (entre 1 min y ${VENTANA_PUBLISH_AT_MIN} min desde ahora)` }
      }
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      const s = await actualizarStatus(v.idRed, statusDe({ publishAt }), t, c, paso)
      if (esFallo(s)) return s
      if (s.privacyStatus !== "private" || !mismoInstante(s.publishAt, publishAt)) {
        return { ok: false, clase: "ambiguo", como: `${paso}: YouTube contestó privacyStatus=${String(s.privacyStatus)} publishAt=${String(s.publishAt)}; se pidió privado con ${publishAt}` }
      }
      return { ok: true }
    },

    async publicar(v, c) {
      const paso = "youtube.publicar"
      if (!v.idRed) return { ok: false, clase: "fatal", como: `${paso}: sin id de YouTube (la VM no lo subió)` }
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      const s = await actualizarStatus(v.idRed, statusDe({ privacyStatus: "public" }), t, c, paso)
      if (esFallo(s)) return s
      // Releer: un proyecto sin auditar acepta el update y deja el video bloqueado en privado.
      const real = await leerStatus(v.idRed, t, c, `${paso} (releer)`)
      const vis = esFallo(real) ? s.privacyStatus : real?.privacyStatus
      if (vis !== "public") {
        return {
          ok: false,
          clase: "fatal",
          como: `${paso}: se pidió público y YouTube lo tiene ${String(vis)}${esFallo(real) ? ` (no se pudo releer: ${real.como})` : ""}: bloqueo de privado de un proyecto de API sin auditar`,
          codigo: "privado_bloqueado",
        }
      }
      return { ok: true, idRed: v.idRed, enlace: `https://www.youtube.com/watch?v=${v.idRed}` }
    },

    async desprogramar(idRed, c) {
      const paso = "youtube.desprogramar"
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      const s = await actualizarStatus(idRed, statusDe(), t, c, paso)
      if (esFallo(s)) return s
      if (s.privacyStatus !== "private" || s.publishAt) {
        return { ok: false, clase: "reintentable", como: `${paso}: YouTube contestó privacyStatus=${String(s.privacyStatus)} publishAt=${String(s.publishAt)}` }
      }
      return { ok: true }
    },

    async estado(idRed, c) {
      const t = await c.token("youtube")
      if (!t) return { visibilidad: "desconocida", como: "sin token de YouTube" }
      const s = await leerStatus(idRed, t, c, "youtube.estado")
      if (esFallo(s)) return { visibilidad: "desconocida", como: s.como }
      if (!s) return { visibilidad: "no_existe", como: `videos.list no devuelve ${idRed} (borrado o de otra cuenta)` }
      const como = `privacyStatus=${String(s.privacyStatus)} uploadStatus=${String(s.uploadStatus)}${s.publishAt ? ` publishAt=${String(s.publishAt)}` : ""}`
      let visibilidad: Visibilidad
      if (s.uploadStatus === "rejected" || s.uploadStatus === "failed" || s.uploadStatus === "deleted") visibilidad = "no_existe"
      else if (s.uploadStatus === "uploaded") visibilidad = "procesando"
      else if (s.privacyStatus === "public") visibilidad = "publico"
      else visibilidad = "privado"
      return { visibilidad, como: visibilidad === "privado" && !s.publishAt ? `${como} (¿bloqueo de proyecto sin auditar?)` : como }
    },

    async recientes(desde, c) {
      const paso = "youtube.recientes"
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      // La lista de subidas del canal (incluye los privados para el dueño): 1 + 1 unidades, no search (100).
      const ch = await pedir(c, `${YT_API}/channels?part=contentDetails&mine=true`, { headers: auth(t) }, { ms: 15_000, idempotente: true, paso })
      if (esFallo(ch)) return ch
      if (!ok2xx(ch)) return falla(paso, ch)
      const lista = texto(campo(ch.cuerpo, "items", 0, "contentDetails", "relatedPlaylists", "uploads"))
      if (!lista) return { ok: false, clase: "fatal", como: `${paso}: el canal no tiene lista de subidas: ${recortar(ch.texto)}` }
      const pl = await pedir(
        c,
        `${YT_API}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(lista)}`,
        { headers: auth(t) },
        { ms: 15_000, idempotente: true, paso },
      )
      if (esFallo(pl)) return pl
      if (!ok2xx(pl)) return falla(paso, pl)
      const items = campo(pl.cuerpo, "items")
      if (!Array.isArray(items)) return { ok: false, clase: "reintentable", como: `${paso}: respuesta sin items: ${recortar(pl.texto)}` }
      const salida: Reciente[] = []
      for (const it of items) {
        const id = texto(campo(it, "snippet", "resourceId", "videoId"))
        const creado = texto(campo(it, "snippet", "publishedAt"))
        if (!id || !creado || Date.parse(creado) < desde.getTime()) continue
        salida.push({ idRed: id, texto: `${String(campo(it, "snippet", "title") ?? "")}\n${String(campo(it, "snippet", "description") ?? "")}`, creado })
      }
      return salida
    },

    /** captions.insert (400 unidades). No es idempotente: un corte puede dejar la pista creada. */
    async subtitular(idRed, contenido, c, idioma = "es") {
      const paso = "youtube.subtitular"
      if (!contenido.trim()) return { ok: false, clase: "fatal", como: `${paso}: subtítulos vacíos` }
      const t = await c.token("youtube")
      if (!t) return sinToken(paso, c)
      const limite = `fabrica${Math.random().toString(36).slice(2)}`
      const meta = { snippet: { videoId: idRed, language: idioma, name: "Español", isDraft: false } }
      const cuerpo =
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${limite}\r\nContent-Type: application/octet-stream\r\n\r\n${contenido}\r\n--${limite}--`
      const r = await pedir(
        c,
        `${YT_SUBIDA}/captions?part=snippet&uploadType=multipart`,
        { method: "POST", headers: { ...auth(t), "Content-Type": `multipart/related; boundary=${limite}` }, body: cuerpo },
        { ms: 30_000, idempotente: false, paso },
      )
      if (esFallo(r)) return r
      if (!ok2xx(r)) return falla(paso, r)
      const id = texto(campo(r.cuerpo, "id"))
      return id ? { ok: true, id } : { ok: false, clase: "ambiguo", como: `${paso}: respuesta sin id: ${recortar(r.texto)}` }
    },
  }
}

export const youtube = crearYouTube()
