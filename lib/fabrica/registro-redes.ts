// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · QUÉ ADAPTADOR ATIENDE CADA RED
//
// Una red entra al registro solo si (1) está encendida por entorno
// (FABRICA_ACTIVA y FABRICA_<RED>_ACTIVA, leídas con flag()) y (2) tiene todo
// lo que necesita para publicar. Si le falta algo, NO entra: el tick la omite
// ("red apagada … o sin adaptador") y aquí se loguea qué variable falta.
// Nada se publica a medias.
//
//   youtube    FABRICA_YT_CLIENT_ID, FABRICA_YT_CLIENT_SECRET + token en fabrica_tokens
//   x          FABRICA_X_CLIENT_ID, FABRICA_X_CLIENT_SECRET + token en fabrica_tokens
//   instagram  CASA_BLANCA_META_TOKEN, CASA_BLANCA_META_PAGE_ID
//   facebook   CASA_BLANCA_META_TOKEN, CASA_BLANCA_META_PAGE_ID
//   tiktok     FABRICA_UPLOADPOST_KEY, FABRICA_UPLOADPOST_USUARIO y
//              FABRICA_UPLOADPOST_AIGC_PROBADO (TikTok apagada hasta probar is_aigc)
//   los tokens FABRICA_CLAVE_TOKENS (32 bytes) y SUPABASE_SERVICE_ROLE_KEY
//
// El almacén (FABRICA_ALMACEN, FABRICA_BUCKET) es común y NO saca a una red del
// registro: YouTube tiene que poder desprogramar al pausar aunque el almacén
// falle. Sin almacén, publicar en Meta o TikTok da `fatal` con el cómo
// ("sin almacén configurado (FABRICA_ALMACEN)").
// ──────────────────────────────────────────────────────────────

import { VARIABLES } from "../publicar-pedido"
import { getAdminClient } from "../supabase-admin"
import { almacenDesdeEnv, configDe, type StorageSupabase } from "./almacen"
import { facebook, instagram } from "./redes/meta-reels"
import { uploadpost, VARIABLE_AIGC } from "./redes/uploadpost"
import { renovarX, x } from "./redes/x"
import { renovarYouTube, youtube } from "./redes/youtube"
import { baseTokensSupabase, claveDe, tokenPara, type BaseTokens } from "./tokens"
import { flag, REDES, redesEncendidas, variableDeRed, type Adaptador, type Almacen, type Ctx, type Entorno, type Log, type RedId } from "./tipos"

/** El adaptador de cada red. Uno solo por red. */
export const ADAPTADORES: Readonly<Record<RedId, Adaptador>> = {
  youtube,
  x,
  instagram,
  facebook,
  tiktok: uploadpost,
}

const falta = (env: Entorno, nombre: string) => !env[nombre]?.trim()

/** Lo que necesita una red que guarda su token en fabrica_tokens. */
function faltanTokens(env: Entorno): string[] {
  const f: string[] = []
  if (!claveDe(env)) f.push(env.FABRICA_CLAVE_TOKENS?.trim() ? "FABRICA_CLAVE_TOKENS (no mide 32 bytes en hex o base64)" : "FABRICA_CLAVE_TOKENS")
  if (falta(env, "SUPABASE_SERVICE_ROLE_KEY")) f.push("SUPABASE_SERVICE_ROLE_KEY")
  return f
}

/** Qué variables le faltan a una red para poder publicar (vacío = configurada). Puro. */
export function faltanDe(red: RedId, env: Entorno): string[] {
  const f: string[] = []
  switch (red) {
    case "youtube":
    case "x": {
      const pre = red === "youtube" ? "FABRICA_YT" : "FABRICA_X"
      for (const v of [`${pre}_CLIENT_ID`, `${pre}_CLIENT_SECRET`]) if (falta(env, v)) f.push(v)
      f.push(...faltanTokens(env))
      break
    }
    case "instagram":
    case "facebook": {
      // Las dos de la cuenta de la casa (los mismos nombres que usa lib/meta.ts), nunca las de Kev.
      const v = VARIABLES["casa-blanca"]
      for (const n of [v.token, v.pagina]) if (falta(env, n)) f.push(n)
      break
    }
    case "tiktok": {
      for (const v of ["FABRICA_UPLOADPOST_KEY", "FABRICA_UPLOADPOST_USUARIO"]) if (falta(env, v)) f.push(v)
      if (!flag(env[VARIABLE_AIGC])) f.push(`${VARIABLE_AIGC} (encenderla después de ver is_aigc en un video de prueba)`)
      break
    }
  }
  return f
}

export interface DiagnosticoRed {
  red: RedId
  variable: string
  encendida: boolean
  faltan: string[]
  /** Encendida y configurada: entra al registro. */
  lista: boolean
}

/** El estado de cada red y del almacén, para el log, el panel y la tanda. Puro. */
export function diagnostico(env: Entorno): { activa: boolean; redes: DiagnosticoRed[]; almacen: string[] } {
  const encendidas = redesEncendidas(env)
  const redes = REDES.map((red) => {
    const faltan = faltanDe(red, env)
    const encendida = encendidas.includes(red)
    return { red, variable: variableDeRed(red), encendida, faltan, lista: encendida && faltan.length === 0 }
  })
  const a = configDe(env)
  return { activa: flag(env.FABRICA_ACTIVA), redes, almacen: a.ok ? [] : a.faltan }
}

/** Una línea por red que está encendida pero no puede publicar. */
export function avisosDeConfiguracion(env: Entorno): string[] {
  const d = diagnostico(env)
  const avisos = d.redes.filter((r) => r.encendida && !r.lista).map((r) => `${r.red} encendida pero sin configurar: falta ${r.faltan.join(", ")}. No se publica en ${r.red}`)
  if (d.activa && d.almacen.length) avisos.push(`sin almacén: falta ${d.almacen.join("; ")}. Meta y TikTok no pueden publicar`)
  return avisos
}

/**
 * Los adaptadores que el tick y la tanda pueden usar: solo las redes encendidas
 * Y configuradas. Lo que falta se loguea con el nombre de la variable.
 */
export function adaptadores(env: Entorno = process.env, log: (m: string) => void = (m) => console.error(m)): Partial<Record<RedId, Adaptador>> {
  for (const a of avisosDeConfiguracion(env)) log(`[fabrica/registro-redes] ${a}`)
  const r: Partial<Record<RedId, Adaptador>> = {}
  for (const d of diagnostico(env).redes) if (d.lista) r[d.red] = ADAPTADORES[d.red]
  return r
}

/**
 * Los adaptadores que pueden BAJAR lo ya programado (hoy, solo YouTube y su
 * publishAt): las redes configuradas, estén encendidas o no. Apagar
 * FABRICA_ACTIVA o FABRICA_YOUTUBE_ACTIVA saca a YouTube de adaptadores(), y
 * sin esto desprogramar daba "sin adaptador" y el video salía igual a su hora.
 * Solo se usa para desprogramar, nunca para publicar.
 */
export function adaptadoresParaBajar(env: Entorno = process.env): Partial<Record<RedId, Adaptador>> {
  const r: Partial<Record<RedId, Adaptador>> = {}
  for (const red of REDES) if (ADAPTADORES[red].desprogramar && faltanDe(red, env).length === 0) r[red] = ADAPTADORES[red]
  return r
}

/** Las redes que guardan su token en fabrica_tokens y cómo se renuevan. */
export const RENOVADORES = { youtube: renovarYouTube, x: renovarX }

export interface PuertosCtx {
  /** La base de los tokens. Por defecto, Supabase con service-role; null = no hay. */
  baseTokens?: BaseTokens | null
  /** El almacén. Por defecto, el del entorno (almacen.ts). */
  almacen?: Almacen | null
  storage?: StorageSupabase | null
  fetch?: typeof fetch
  ahora?: () => Date
  log?: Log
}

/** El contexto real de los adaptadores: tokens descifrados de fabrica_tokens y el almacén del entorno. */
export function ctxReal(env: Entorno, p: PuertosCtx = {}): Ctx {
  const f = p.fetch ?? fetch
  const ahora = p.ahora ?? (() => new Date())
  const log = p.log ?? ((m: string) => console.log(m))

  let baseTokens = p.baseTokens
  if (baseTokens === undefined) {
    const db = getAdminClient()
    baseTokens = db ? baseTokensSupabase(db) : null
  }
  const tp = baseTokens ? tokenPara({ base: baseTokens, env, fetch: f, ahora, renovadores: RENOVADORES, log }) : null
  const token: Ctx["token"] =
    tp ??
    (async (red) => {
      console.error(`[fabrica/registro-redes] token de ${red}: sin base de tokens (falta SUPABASE_SERVICE_ROLE_KEY); se devuelve null`)
      return null
    })
  // Por qué no llegó el token: un 503 de la base no es lo mismo que un token inválido.
  const tokenFallo: Ctx["tokenFallo"] = tp
    ? tp.fallo
    : () => ({ ok: false, clase: "fatal", como: "sin base de tokens: falta SUPABASE_SERVICE_ROLE_KEY" })

  const almacen = p.almacen !== undefined ? p.almacen : almacenDesdeEnv(env, { storage: p.storage, log })

  return { fetch: f, env, ahora, token, tokenFallo, almacen, log }
}
