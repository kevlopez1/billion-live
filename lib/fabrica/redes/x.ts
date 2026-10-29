// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · X (API v2, OAuth 2.0 de usuario)
//
//   subir()     (VM) la media por partes: initialize → append (trozos) →
//               finalize → status hasta `succeeded`. Devuelve media_id y
//               cuándo vence (expires_after_secs de X; si no lo trae, 24 h
//               SIN VERIFICAR).
//   publicar()  (tick, a la hora) POST /2/tweets con el texto y la media.
//               Guarda dura: el texto pasa textoValido("x") — ninguna URL ni
//               dominio (un post con enlace cuesta $0,20 en vez de $0,015).
//
// El refresh token de X es de UN SOLO USO: lo renueva tokens.ts con reserva
// y rotación atómica (renovarX es solo la llamada a la red).
//
// Topes: 429 (incluido el de 10 posts en 24 h del plan) = no_hoy. Un 403 por
// contenido duplicado dice que el post YA salió: es ambiguo, así la cola lo
// busca en recientes() en vez de darlo por fallido o repetirlo.
// ──────────────────────────────────────────────────────────────

import { textoValido } from "../guardas"
import type { Adaptador, Clase, Ctx, Entorno, Fallo, Reciente } from "../tipos"
import { bytesDelArchivo, campo, dormirReal, esFallo, falloHttp, ok2xx, pedir, recortar, texto, type Respuesta } from "./http"

export const X_API = "https://api.x.com/2"
export const X_TOKEN = `${X_API}/oauth2/token`
/** Si X no dice cuánto vive la media (SIN VERIFICAR): 24 h. */
export const MEDIA_VIVE_S = 24 * 3600
/** Trozos de 4 MB (X acepta hasta 5 MB por append). */
export const TROZO_BYTES = 4 * 1024 * 1024

// ── Errores ───────────────────────────────────────────────────

const detalleX = (cuerpo: unknown): string =>
  [campo(cuerpo, "detail"), campo(cuerpo, "title"), campo(cuerpo, "error"), campo(cuerpo, "error_description"), campo(cuerpo, "errors", 0, "message")]
    .filter((x): x is string => typeof x === "string")
    .join(" · ")

/**
 * 429 → no_hoy (tope de 10 posts/24 h o de la app). 403 por duplicado →
 * ambiguo (ya salió). 401, 402 (sin créditos), 403, 400 → fatal. 5xx → reintentable.
 */
export function clasificarX(status: number, cuerpo: unknown): Clase {
  const d = detalleX(cuerpo).toLowerCase()
  if (status === 429 || /too many requests|usage cap|rate limit/.test(d)) return "no_hoy"
  if (status === 403 && /duplicate/.test(d)) return "ambiguo"
  if (status >= 500 || status === 408) return "reintentable"
  return "fatal"
}

const falla = (paso: string, r: Respuesta): Fallo => {
  const f = falloHttp(paso, r, clasificarX)
  // Los encabezados de tope dicen cuándo vuelve: van al cómo.
  const reset = r.headers.get("x-user-limit-24hour-reset") ?? r.headers.get("x-rate-limit-reset")
  const queda = r.headers.get("x-user-limit-24hour-remaining") ?? r.headers.get("x-rate-limit-remaining")
  return r.status === 429 ? { ...f, como: `${f.como} (quedan ${queda ?? "?"}, vuelve ${reset ? new Date(Number(reset) * 1000).toISOString() : "?"})` } : f
}

// ── OAuth (refresh de un solo uso) ───────────────────────────

/**
 * Pide un acceso nuevo. X devuelve también un refresh NUEVO y el viejo deja
 * de servir: quien llama (tokens.ts) tiene que guardar el nuevo sí o sí. No es
 * idempotente: un corte después de mandar puede haber gastado el viejo.
 */
export async function renovarX(
  refresh: string,
  p: { fetch: typeof fetch; env: Entorno },
): Promise<{ ok: true; acceso: string; expiraEn: string; refresh?: string } | Fallo> {
  const id = p.env.FABRICA_X_CLIENT_ID?.trim()
  const secreto = p.env.FABRICA_X_CLIENT_SECRET?.trim()
  if (!id || !secreto) return { ok: false, clase: "fatal", como: "x.token: faltan FABRICA_X_CLIENT_ID o FABRICA_X_CLIENT_SECRET" }
  const r = await pedir(
    p,
    X_TOKEN,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${secreto}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: id }),
    },
    { ms: 15_000, idempotente: false, paso: "x.token" },
  )
  if (esFallo(r)) return r
  if (!ok2xx(r)) {
    const f = falloHttp("x.token", r, clasificarX)
    // 400 invalid_request "token was invalid" = refresh gastado o revocado: reautorizar.
    return r.status === 400 || r.status === 401 ? { ...f, clase: "fatal", como: `${f.como} · reautorizar X` } : f
  }
  const acceso = texto(campo(r.cuerpo, "access_token"))
  if (!acceso) return { ok: false, clase: "ambiguo", como: `x.token: respuesta sin access_token: ${recortar(r.texto)}` }
  const nuevo = texto(campo(r.cuerpo, "refresh_token"))
  const segundos = Number(campo(r.cuerpo, "expires_in") ?? 7200)
  return { ok: true, acceso, expiraEn: new Date(Date.now() + segundos * 1000).toISOString(), ...(nuevo ? { refresh: nuevo } : {}) }
}

// ── La guarda del texto ──────────────────────────────────────

/** Errores del texto para X (incluye: ninguna URL ni dominio). Vacío = pasa. */
export const revisarTextoX = (t: string) => textoValido("x", t)

// ── El adaptador ─────────────────────────────────────────────

export interface OpcionesX {
  dormir?: (ms: number) => Promise<void>
  trozoBytes?: number
  /** Cuánto se espera el procesamiento de la media antes de dejarlo para otro intento. */
  esperaMaxMs?: number
}

/**
 * Sin token: la clase la dice tokens.ts (Ctx.tokenFallo). Un fallo pasajero
 * de la base o de la renovación es reintentable, un token sin cargar es
 * no_hoy; solo lo inválido es fatal (y sin el dato, fatal como antes).
 */
const sinToken = (paso: string, c: Ctx): Fallo => {
  const f = c.tokenFallo?.("x")
  return {
    ok: false,
    clase: f?.clase ?? "fatal",
    como: `${paso}: sin token de X${f ? ` (${f.como})` : " (renovación fallida o sin cargar: ver fabrica_tokens.ultimo_error)"}`,
    ...(f?.codigo ? { codigo: f.codigo } : {}),
  }
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

export function crearX(o: OpcionesX = {}): Adaptador {
  const dormir = o.dormir ?? dormirReal
  const trozo = o.trozoBytes ?? TROZO_BYTES
  const esperaMax = o.esperaMaxMs ?? 10 * 60_000

  /** El id del usuario dueño del token (para listar sus posts). */
  async function yo(t: string, c: Ctx): Promise<string | Fallo> {
    const fijo = c.env.FABRICA_X_USUARIO_ID?.trim()
    if (fijo) return fijo
    const r = await pedir(c, `${X_API}/users/me`, { headers: auth(t) }, { ms: 15_000, idempotente: true, paso: "x.yo" })
    if (esFallo(r)) return r
    if (!ok2xx(r)) return falla("x.yo", r)
    return texto(campo(r.cuerpo, "data", "id")) ?? { ok: false, clase: "fatal", como: `x.yo: sin id: ${recortar(r.texto)}` }
  }

  return {
    red: "x",
    clasificar: clasificarX,

    async subir(v, c) {
      const paso = "x.subir"
      const t = await c.token("x")
      if (!t) return sinToken(paso, c)
      const bytes = await bytesDelArchivo(c, v.archivo, paso)
      if (esFallo(bytes)) return bytes
      const json = { ...auth(t), "Content-Type": "application/json" }

      // 1. initialize. Una sesión que nadie usa vence sola: se puede repetir.
      const ini = await pedir(
        c,
        `${X_API}/media/upload/initialize`,
        { method: "POST", headers: json, body: JSON.stringify({ media_type: "video/mp4", total_bytes: bytes.byteLength, media_category: "tweet_video" }) },
        { ms: 20_000, idempotente: true, paso: `${paso} (initialize)` },
      )
      if (esFallo(ini)) return ini
      if (!ok2xx(ini)) return falla(`${paso} (initialize)`, ini)
      const id = texto(campo(ini.cuerpo, "data", "id")) ?? texto(campo(ini.cuerpo, "data", "media_id")) ?? texto(campo(ini.cuerpo, "media_id_string"))
      if (!id) return { ok: false, clase: "reintentable", como: `${paso}: initialize sin id: ${recortar(ini.texto)}` }
      let vive = Number(campo(ini.cuerpo, "data", "expires_after_secs"))

      // 2. append, de a trozos. Repetir un segmento lo reemplaza: idempotente.
      for (let i = 0, desde = 0; desde < bytes.byteLength; i++, desde += trozo) {
        const f = new FormData()
        f.append("segment_index", String(i))
        f.append("media", new Blob([bytes.slice(desde, desde + trozo)], { type: "application/octet-stream" }), "trozo")
        const ap = await pedir(c, `${X_API}/media/upload/${id}/append`, { method: "POST", headers: auth(t), body: f }, { ms: 120_000, idempotente: true, paso: `${paso} (append ${i})` })
        if (esFallo(ap)) return ap
        if (!ok2xx(ap)) return falla(`${paso} (append ${i})`, ap)
      }

      // 3. finalize.
      const fin = await pedir(c, `${X_API}/media/upload/${id}/finalize`, { method: "POST", headers: auth(t) }, { ms: 30_000, idempotente: true, paso: `${paso} (finalize)` })
      if (esFallo(fin)) return fin
      if (!ok2xx(fin)) return falla(`${paso} (finalize)`, fin)
      vive = Number(campo(fin.cuerpo, "data", "expires_after_secs")) || vive
      let info = campo(fin.cuerpo, "data", "processing_info")

      // 4. status hasta succeeded.
      const inicio = c.ahora().getTime()
      while (info && typeof info === "object") {
        const estado = String(campo(info, "state") ?? "")
        if (estado === "succeeded") break
        if (estado === "failed") {
          return { ok: false, clase: "fatal", como: `${paso}: X no pudo procesar el video: ${JSON.stringify(campo(info, "error") ?? info)}`, codigo: "processing_failed" }
        }
        if (c.ahora().getTime() - inicio > esperaMax) {
          return { ok: false, clase: "reintentable", como: `${paso}: X sigue procesando la media ${id} (${estado}) después de ${Math.round(esperaMax / 60_000)} min` }
        }
        await dormir(Math.max(1, Number(campo(info, "check_after_secs") ?? 5)) * 1000)
        const st = await pedir(c, `${X_API}/media/upload?command=STATUS&media_id=${id}`, { headers: auth(t) }, { ms: 15_000, idempotente: true, paso: `${paso} (status)` })
        if (esFallo(st)) return st
        if (!ok2xx(st)) return falla(`${paso} (status)`, st)
        info = campo(st.cuerpo, "data", "processing_info")
        vive = Number(campo(st.cuerpo, "data", "expires_after_secs")) || vive
      }

      const segundos = Number.isFinite(vive) && vive > 0 ? vive : MEDIA_VIVE_S
      if (!(Number.isFinite(vive) && vive > 0)) c.log(`[fabrica/x] la media ${id} no trajo expires_after_secs: se asumen 24 h (SIN VERIFICAR)`)
      return { ok: true, mediaId: id, expira: new Date(c.ahora().getTime() + segundos * 1000).toISOString() }
    },

    async publicar(v, c) {
      const paso = "x.publicar"
      // La guarda dura, antes de la red y antes del token: con una URL no sale.
      const errores = revisarTextoX(v.texto)
      if (errores.length) return { ok: false, clase: "fatal", como: `${paso}: ${errores.join("; ")}`, codigo: "texto_invalido" }
      if (!v.mediaId) return { ok: false, clase: "fatal", como: `${paso}: sin media_id (la VM no subió el video a X)` }
      const t = await c.token("x")
      if (!t) return sinToken(paso, c)
      const r = await pedir(
        c,
        `${X_API}/tweets`,
        { method: "POST", headers: { ...auth(t), "Content-Type": "application/json" }, body: JSON.stringify({ text: v.texto, media: { media_ids: [v.mediaId] } }) },
        { ms: 20_000, idempotente: false, paso },
      )
      if (esFallo(r)) return r
      if (!ok2xx(r)) {
        const f = falla(paso, r)
        // Un 5xx en un POST que crea: pudo haber salido. Se mira antes de repetir.
        return f.clase === "reintentable" ? { ...f, clase: "ambiguo" } : f
      }
      const id = texto(campo(r.cuerpo, "data", "id"))
      if (!id) return { ok: false, clase: "ambiguo", como: `${paso}: X contestó ${r.status} sin id: ${recortar(r.texto)}` }
      return { ok: true, idRed: id, enlace: `https://x.com/i/web/status/${id}` }
    },

    async estado(idRed, c) {
      const t = await c.token("x")
      if (!t) return { visibilidad: "desconocida", como: "sin token de X" }
      const r = await pedir(c, `${X_API}/tweets/${encodeURIComponent(idRed)}`, { headers: auth(t) }, { ms: 15_000, idempotente: true, paso: "x.estado" })
      if (esFallo(r)) return { visibilidad: "desconocida", como: r.como }
      if (ok2xx(r) && texto(campo(r.cuerpo, "data", "id"))) return { visibilidad: "publico", como: "GET /2/tweets lo devuelve" }
      const d = detalleX(r.cuerpo) || recortar(r.texto)
      if (r.status === 404 || /not found|could not find/i.test(d)) return { visibilidad: "no_existe", como: `HTTP ${r.status} ${d}` }
      if (/authorization|protected/i.test(d)) return { visibilidad: "privado", como: `HTTP ${r.status} ${d}` }
      return { visibilidad: "desconocida", como: `HTTP ${r.status} ${d}` }
    },

    async recientes(desde, c) {
      const paso = "x.recientes"
      const t = await c.token("x")
      if (!t) return sinToken(paso, c)
      const quien = await yo(t, c)
      if (esFallo(quien)) return quien
      const inicio = new Date(Math.max(desde.getTime(), c.ahora().getTime() - 7 * 86400_000)).toISOString().replace(/\.\d{3}Z$/, "Z")
      const r = await pedir(
        c,
        `${X_API}/users/${encodeURIComponent(quien)}/tweets?max_results=20&tweet.fields=created_at&start_time=${encodeURIComponent(inicio)}`,
        { headers: auth(t) },
        { ms: 15_000, idempotente: true, paso },
      )
      if (esFallo(r)) return r
      if (!ok2xx(r)) return falla(paso, r)
      const datos = campo(r.cuerpo, "data")
      // Sin posts en la ventana X no manda `data`: eso sí es una lista vacía (meta.result_count = 0).
      if (datos === undefined) {
        return campo(r.cuerpo, "meta", "result_count") === 0 ? [] : { ok: false, clase: "reintentable", como: `${paso}: respuesta sin data ni result_count: ${recortar(r.texto)}` }
      }
      if (!Array.isArray(datos)) return { ok: false, clase: "reintentable", como: `${paso}: data no es una lista: ${recortar(r.texto)}` }
      const salida: Reciente[] = []
      for (const p of datos) {
        const id = texto(campo(p, "id"))
        if (id) salida.push({ idRed: id, texto: String(campo(p, "text") ?? ""), creado: String(campo(p, "created_at") ?? "") })
      }
      return salida
    },
  }
}

export const x = crearX()
