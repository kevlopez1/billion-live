// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · TIKTOK POR UPLOAD-POST
//
// TikTok no da su API de publicación directa sin auditoría: va por
// Upload-Post (api.upload-post.com), que publica con la cuenta conectada.
// Se manda A LA HORA de salida (no se programa), con la URL firmada del
// almacén, y en modo asíncrono: Upload-Post devuelve un request_id que la
// cola guarda como contenedor (estado `procesando`) y retoma en el próximo
// tick, igual que un Reel de Instagram.
//
// SIN VERIFICAR (la documentación de Upload-Post no fue alcanzable desde
// donde se escribió esto; lo de abajo sale de su guía pública y de la API de
// TikTok, que define `is_aigc`):
//   - que `video` acepte una URL pública (su guía dice "archivo o URL").
//   - que pase `is_aigc` a TikTok (la etiqueta de IA). Sin eso NO se publica:
//     publicar() se niega hasta que FABRICA_UPLOADPOST_AIGC_PROBADO esté
//     encendida (después de ver la etiqueta en un video de prueba).
//   - las rutas de estado (`/uploadposts/status`) y de historial.
// ──────────────────────────────────────────────────────────────

import { etiquetaIA } from "../guardas"
import { flag, type Adaptador, type Clase, type Ctx, type Fallo, type Reciente, type VideoParaRed } from "../tipos"
import { campo, esFallo, falloHttp, ok2xx, pedir, recortar, texto, urlDelArchivo, type Respuesta } from "./http"

export const UPLOADPOST_API = "https://api.upload-post.com/api"

/** Que Upload-Post pase `is_aigc` a TikTok. SIN VERIFICAR: se confirma con un video de prueba. */
export const AIGC_VERIFICADO_POR_DEFECTO = false
export const VARIABLE_AIGC = "FABRICA_UPLOADPOST_AIGC_PROBADO"

// ── Errores ───────────────────────────────────────────────────

const detalle = (cuerpo: unknown) =>
  [campo(cuerpo, "message"), campo(cuerpo, "error"), campo(cuerpo, "detail"), campo(cuerpo, "results", "tiktok", "error")]
    .filter((x): x is string => typeof x === "string")
    .join(" · ")

/**
 * spam_risk_too_many_posts y topes diarios → no_hoy. 429 → no_hoy.
 * 401/403 (clave o cuenta) y 400 (formato) → fatal. 5xx → reintentable.
 */
export function clasificarUploadPost(status: number, cuerpo: unknown): Clase {
  const d = (detalle(cuerpo) || (typeof cuerpo === "string" ? cuerpo : "")).toLowerCase()
  if (/spam_risk|too_many_posts|daily limit|limit reached|reached the limit/.test(d) || status === 429) return "no_hoy"
  if (status >= 500 || status === 408) return "reintentable"
  return "fatal"
}

const falla = (paso: string, r: Respuesta): Fallo => falloHttp(paso, r, clasificarUploadPost)

// ── El cuerpo ─────────────────────────────────────────────────

/** Los campos que van a Upload-Post (también los mira la guarda de la etiqueta de IA). */
export function camposTikTok(v: Pick<VideoParaRed, "texto">, usuario: string, url: string): Record<string, string> {
  return {
    user: usuario,
    "platform[]": "tiktok",
    title: v.texto,
    video: url,
    privacy_level: "PUBLIC_TO_EVERYONE",
    is_aigc: "true",
    disable_duet: "false",
    disable_comment: "false",
    disable_stitch: "false",
    async_upload: "true",
  }
}

// ── El adaptador ─────────────────────────────────────────────

const clave = (c: Ctx) => c.env.FABRICA_UPLOADPOST_KEY?.trim()
const auth = (k: string) => ({ Authorization: `Apikey ${k}` })

/** Lo que dijo Upload-Post de una subida (síncrona o el estado de una asíncrona). */
function leerResultado(cuerpo: unknown): { estado: "listo" | "en_curso" | "fallo" | "?"; url?: string; id?: string; error?: string } {
  const tk = campo(cuerpo, "results", "tiktok") ?? campo(cuerpo, "result", "tiktok") ?? campo(cuerpo, "tiktok")
  const estado = String(campo(cuerpo, "status") ?? campo(tk, "status") ?? "").toLowerCase()
  const url = texto(campo(tk, "url")) ?? texto(campo(tk, "post_url")) ?? texto(campo(cuerpo, "url"))
  const id = texto(campo(tk, "publish_id")) ?? texto(campo(tk, "video_id")) ?? texto(campo(tk, "id"))
  const error = texto(campo(tk, "error")) ?? texto(campo(cuerpo, "error"))
  if (campo(tk, "success") === false || /fail|error/.test(estado)) return { estado: "fallo", error: error ?? estado }
  if (campo(tk, "success") === true || /complet|success|done|publish/.test(estado)) return { estado: "listo", url, id }
  if (/pend|progress|process|queue|upload/.test(estado)) return { estado: "en_curso" }
  return { estado: "?" }
}

export function crearUploadPost(): Adaptador {
  return {
    red: "tiktok",
    clasificar: clasificarUploadPost,

    async publicar(v, c) {
      const paso = "tiktok.publicar"
      const k = clave(c)
      if (!k) return { ok: false, clase: "fatal", como: `${paso}: falta FABRICA_UPLOADPOST_KEY` }

      // Retomar: ya hay un request_id. Se pregunta, no se manda otra vez.
      if (v.contenedor) {
        const r = await pedir(c, `${UPLOADPOST_API}/uploadposts/status?request_id=${encodeURIComponent(v.contenedor)}`, { headers: auth(k) }, { ms: 15_000, idempotente: true, paso: `${paso} (estado)` })
        if (esFallo(r)) return { ...r, pendiente: v.contenedor }
        if (!ok2xx(r)) {
          const f = falla(`${paso} (estado)`, r)
          if (f.clase === "reintentable") return { ...f, pendiente: v.contenedor }
          // Un 404 de la ruta de estado (SIN VERIFICAR) no dice que no salió: se mira antes de decidir.
          return r.status === 404 ? { ...f, clase: "ambiguo" } : f
        }
        const res = leerResultado(r.cuerpo)
        if (res.estado === "listo") return { ok: true, idRed: res.url ?? res.id ?? v.contenedor, enlace: res.url }
        if (res.estado === "fallo") return { ok: false, clase: "fatal", como: `${paso}: Upload-Post dice que falló: ${res.error ?? recortar(r.texto)}` }
        return { ok: false, clase: "reintentable", como: `${paso}: Upload-Post sigue subiendo (${recortar(r.texto, 200)})`, pendiente: v.contenedor }
      }

      const usuario = c.env.FABRICA_UPLOADPOST_USUARIO?.trim()
      if (!usuario) return { ok: false, clase: "fatal", como: `${paso}: falta FABRICA_UPLOADPOST_USUARIO` }
      if (!(AIGC_VERIFICADO_POR_DEFECTO || flag(c.env[VARIABLE_AIGC]))) {
        return {
          ok: false,
          clase: "fatal",
          como: `${paso}: TikTok apagada en código hasta probar que Upload-Post pasa is_aigc (encender ${VARIABLE_AIGC} después de verlo en un video de prueba)`,
          codigo: "aigc_sin_verificar",
        }
      }
      const url = await urlDelArchivo(c, v.archivo, paso)
      if (esFallo(url)) return url
      const campos = camposTikTok(v, usuario, url)
      const sin = etiquetaIA("tiktok", campos)
      if (sin.length) return { ok: false, clase: "fatal", como: `${paso}: ${sin.join("; ")}` }

      const f = new FormData()
      for (const [k2, v2] of Object.entries(campos)) f.append(k2, v2)
      const r = await pedir(c, `${UPLOADPOST_API}/upload`, { method: "POST", headers: auth(k), body: f }, { ms: 25_000, idempotente: false, paso })
      if (esFallo(r)) return r
      if (!ok2xx(r)) {
        const fa = falla(paso, r)
        return fa.clase === "reintentable" ? { ...fa, clase: "ambiguo" } : fa
      }
      const pedido = texto(campo(r.cuerpo, "request_id")) ?? texto(campo(r.cuerpo, "requestId"))
      if (pedido) return { ok: false, clase: "reintentable", como: `${paso}: Upload-Post lo aceptó (request_id ${pedido}); se mira en el próximo tick`, pendiente: pedido }
      const res = leerResultado(r.cuerpo)
      if (res.estado === "listo") {
        const id = res.url ?? res.id
        return id ? { ok: true, idRed: id, enlace: res.url } : { ok: false, clase: "ambiguo", como: `${paso}: salió sin id ni URL: ${recortar(r.texto)}` }
      }
      if (res.estado === "fallo") return { ok: false, clase: clasificarUploadPost(r.status, r.cuerpo) === "no_hoy" ? "no_hoy" : "fatal", como: `${paso}: ${res.error ?? recortar(r.texto)}` }
      // 2xx sin request_id ni resultado claro: algo se hizo y no se sabe qué.
      return { ok: false, clase: "ambiguo", como: `${paso}: respuesta sin request_id ni resultado: ${recortar(r.texto)}` }
    },

    async estado(idRed, c) {
      // Upload-Post no expone la visibilidad. El oEmbed público de TikTok solo
      // responde por videos públicos: 200 = público; lo demás no prueba nada.
      if (!/^https:\/\/(www\.)?tiktok\.com\//.test(idRed)) {
        return { visibilidad: "desconocida", como: `sin URL pública de TikTok para mirar (id ${idRed})` }
      }
      const r = await pedir(c, `https://www.tiktok.com/oembed?url=${encodeURIComponent(idRed)}`, {}, { ms: 10_000, idempotente: true, paso: "tiktok.estado" })
      if (esFallo(r)) return { visibilidad: "desconocida", como: r.como }
      if (ok2xx(r)) return { visibilidad: "publico", como: "oEmbed público responde" }
      return { visibilidad: "desconocida", como: `oEmbed HTTP ${r.status} (privado, procesando o borrado: no se distingue)` }
    },

    async recientes(desde, c) {
      const paso = "tiktok.recientes"
      const k = clave(c)
      if (!k) return { ok: false, clase: "fatal", como: `${paso}: falta FABRICA_UPLOADPOST_KEY` }
      // SIN VERIFICAR: la ruta del historial. Si falla, el envío sigue ambiguo (nunca se repite a ciegas).
      const r = await pedir(c, `${UPLOADPOST_API}/uploadposts/history?limit=50`, { headers: auth(k) }, { ms: 15_000, idempotente: true, paso })
      if (esFallo(r)) return r
      if (!ok2xx(r)) return falla(paso, r)
      const lista = campo(r.cuerpo, "history") ?? campo(r.cuerpo, "data") ?? r.cuerpo
      if (!Array.isArray(lista)) return { ok: false, clase: "reintentable", como: `${paso}: el historial no es una lista: ${recortar(r.texto)}` }
      const salida: Reciente[] = []
      for (const p of lista) {
        const plataforma = String(campo(p, "platform") ?? "tiktok")
        const creado = texto(campo(p, "upload_timestamp")) ?? texto(campo(p, "created_at")) ?? ""
        if (plataforma !== "tiktok" || (creado && Date.parse(creado) < desde.getTime())) continue
        const id = texto(campo(p, "post_url")) ?? texto(campo(p, "url")) ?? texto(campo(p, "request_id"))
        if (id) salida.push({ idRed: id, texto: String(campo(p, "title") ?? campo(p, "caption") ?? ""), creado })
      }
      return salida
    },
  }
}

export const uploadpost = crearUploadPost()
