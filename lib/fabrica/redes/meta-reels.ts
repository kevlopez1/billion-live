// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · INSTAGRAM Y FACEBOOK (envuelve lib/meta.ts)
//
// Siempre la cuenta casa-blanca (CASA_BLANCA_META_TOKEN y su página), nunca
// la de Kev. Meta va a buscar el video a la URL firmada del almacén.
//
// Instagram: el Reel lleva is_ai_generated=true y antes se lee el tope de 24 h
// (lo hace lib/meta.ts). Si Meta sigue procesando, vuelve `pendiente` con el
// contenedor: la cola lo deja `procesando` y lo retoma con continuar().
// Facebook: /videos. Si no contesta, es ambiguo (pudo haber salido): la cola
// mira recientes() antes de repetir.
//
// El presupuesto de una llamada es corto (12 s + 10 de margen): el tick tiene
// 45 s para todo y Vercel corta a los 60.
// ──────────────────────────────────────────────────────────────

import { clasificarMeta, continuar, cuerpoInstagram, estadoPost, publicar, recientes, type PuertosMeta, type Resultado } from "../../meta"
import { etiquetaIA } from "../guardas"
import type { Adaptador, Ctx, Fallo, VideoParaRed } from "../tipos"
import { esFallo, urlDelArchivo } from "./http"

export const CUENTA = "casa-blanca" as const
export const PRESUPUESTO_MS = 12_000

const puertosDe = (c: Ctx): PuertosMeta => ({ fetch: c.fetch, env: c.env })

/** Un Resultado de lib/meta.ts como lo entiende la cola. */
export function aRespuesta(paso: string, r: Resultado | undefined): { ok: true; idRed: string; enlace?: string } | Fallo {
  if (!r) return { ok: false, clase: "ambiguo", como: `${paso}: meta.ts no devolvió resultado` }
  if (r.ok) return { ok: true, idRed: r.id, ...(r.enlace ? { enlace: r.enlace } : {}) }
  const codigo = [r.codigo, r.subcodigo].filter(Boolean).join("/") || undefined
  return {
    ok: false,
    // Sin clase, el error salió de algo que meta.ts no clasificó: no se sabe si se mandó.
    clase: r.clase ?? "ambiguo",
    como: `${paso}: ${r.error}${codigo ? ` (código ${codigo})` : ""}`,
    ...(codigo ? { codigo } : {}),
    ...(r.pendiente ? { pendiente: r.pendiente } : {}),
  }
}

function crear(red: "instagram" | "facebook"): Adaptador {
  const destino = red === "instagram" ? "ig" : "fb"
  return {
    red,
    clasificar: clasificarMeta,

    async publicar(v: VideoParaRed, c: Ctx) {
      const paso = `${red}.publicar`
      // Un Reel en proceso se retoma: nunca se crea otro contenedor.
      if (red === "instagram" && v.contenedor) {
        return aRespuesta(`${paso} (retomar)`, await continuar(CUENTA, v.contenedor, PRESUPUESTO_MS, puertosDe(c)))
      }
      const url = await urlDelArchivo(c, v.archivo, paso)
      if (esFallo(url)) return url
      const sin = etiquetaIA(red, red === "instagram" ? cuerpoInstagram(CUENTA, "video", url, v.texto) : { description: v.texto })
      if (sin.length) return { ok: false, clase: "fatal", como: `${paso}: ${sin.join("; ")}` }
      const r = await publicar(CUENTA, "video", url, v.texto, [destino], PRESUPUESTO_MS, puertosDe(c))
      return aRespuesta(paso, r[destino])
    },

    async estado(idRed, c) {
      return estadoPost(CUENTA, destino, idRed, puertosDe(c))
    },

    async recientes(desde, c) {
      const r = await recientes(CUENTA, destino, desde, puertosDe(c))
      if (!r.ok) return { ok: false, clase: r.clase, como: `${red}.recientes: ${r.error}`, ...(r.codigo ? { codigo: r.codigo } : {}) }
      return r.posts.map((p) => ({ idRed: p.id, texto: p.texto, creado: p.creado }))
    },
  }
}

export const instagram = crear("instagram")
export const facebook = crear("facebook")
