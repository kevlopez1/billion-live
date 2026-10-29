// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LOS TOKENS DE LAS REDES (YouTube y X)
//
// Lo que se guarda en fabrica_tokens va cifrado con AES-256-GCM
// (FABRICA_CLAVE_TOKENS, 32 bytes en hex o base64), como `iv.tag.datos` en
// base64. Adentro: { refresh, acceso?, accesoExpira? }.
//
// Renovar es peligroso en X: el refresh token es de UN SOLO USO. Dos
// procesos que renuevan a la vez = uno gasta el refresh del otro y la cuenta
// queda sin token. Por eso:
//   1. reservar (fabrica_reservar_token: un UPDATE condicional, un ganador)
//   2. renovar con la red
//   3. rotar (fabrica_rotar_token: UPDATE ... where version = la leída)
// Si rotar da false, otro rotó: se relee, no se pisa. Si la renovación
// falla, se anota ultimo_error (el parte lo muestra y pide reautorizar).
//
// Puro salvo los puertos: `npx tsx lib/fabrica/tokens.test.ts`.
// ──────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { getAdminClient } from "../supabase-admin"
import { dormirReal } from "./redes/http"
import type { Entorno, Fallo, RedId } from "./tipos"

// ── Cifrado ───────────────────────────────────────────────────

export interface Credencial {
  refresh: string
  acceso?: string
  /** ISO: cuándo vence el token de acceso. */
  accesoExpira?: string
}

/** La clave de 32 bytes, en hex (64 caracteres) o base64. Null si falta o no mide 32 bytes. */
export function claveDe(env: Entorno): Buffer | null {
  const v = env.FABRICA_CLAVE_TOKENS?.trim()
  if (!v) return null
  const b = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, "hex") : Buffer.from(v, "base64")
  return b.length === 32 ? b : null
}

export function cifrar(c: Credencial, clave: Buffer): string {
  const iv = randomBytes(12)
  const cifra = createCipheriv("aes-256-gcm", clave, iv)
  const datos = Buffer.concat([cifra.update(JSON.stringify(c), "utf8"), cifra.final()])
  return [iv, cifra.getAuthTag(), datos].map((b) => b.toString("base64")).join(".")
}

/** Lanza si la clave no es la que cifró o el texto se tocó (GCM lo detecta). */
export function descifrar(s: string, clave: Buffer): Credencial {
  const [iv, tag, datos] = s.split(".").map((p) => Buffer.from(p, "base64"))
  if (!iv || !tag || !datos) throw new Error("formato inválido (se esperaba iv.tag.datos)")
  const d = createDecipheriv("aes-256-gcm", clave, iv)
  d.setAuthTag(tag)
  const j = JSON.parse(Buffer.concat([d.update(datos), d.final()]).toString("utf8")) as Credencial
  if (!j || typeof j.refresh !== "string" || !j.refresh) throw new Error("sin refresh token adentro")
  return j
}

// ── El puerto de base ─────────────────────────────────────────

export interface FilaToken {
  red: string
  cifrado: string
  version: number
  expira_en: string | null
  renovando_hasta: string | null
}

export interface BaseTokens {
  leer(red: RedId): Promise<FilaToken | null>
  /** fabrica_reservar_token: la fila si ganó la reserva, null si otro está renovando. */
  reservar(red: RedId, venceSeg: number): Promise<FilaToken | null>
  /** fabrica_rotar_token: true solo si la versión sigue siendo `version`. */
  rotar(red: RedId, version: number, cifrado: string, expira: string | null): Promise<boolean>
  /** Anota el cómo de una renovación fallida y suelta la reserva. */
  anotarError(red: RedId, como: string): Promise<void>
  /** Carga a mano (scripts/fabrica/cargar-token.ts): sube la versión, así un rotador viejo pierde. */
  guardar(red: RedId, cifrado: string): Promise<void>
}

/** Renovar con la red: devuelve el acceso nuevo y, en X, el refresh nuevo. */
export type Renovador = (
  refresh: string,
  p: { fetch: typeof fetch; env: Entorno },
) => Promise<{ ok: true; acceso: string; expiraEn: string; refresh?: string } | Fallo>

export interface PuertosToken {
  base: BaseTokens
  env: Entorno
  fetch: typeof fetch
  ahora: () => Date
  renovadores: Partial<Record<RedId, Renovador>>
  dormir?: (ms: number) => Promise<void>
  log?: (m: string) => void
}

/** Un acceso que vence en menos de esto se renueva antes de usarlo. */
export const MARGEN_ACCESO_MS = 5 * 60_000
/** La reserva de una renovación: una llamada a la red tarda segundos; si se cae, a los 90 s otro puede. */
export const RESERVA_SEG = 90
const ESPERAS_OTRO = 5

const vigente = (c: Credencial, ahora: Date) =>
  !!c.acceso && !!c.accesoExpira && Date.parse(c.accesoExpira) - ahora.getTime() > MARGEN_ACCESO_MS

/**
 * El token de acceso vigente de una red, renovándolo si hace falta. Nunca
 * renueva dos veces a la vez (reserva en la base) y nunca pisa una rotación ajena.
 */
export async function accesoVigente(red: RedId, p: PuertosToken): Promise<{ ok: true; acceso: string } | Fallo> {
  const clave = claveDe(p.env)
  if (!clave) return { ok: false, clase: "fatal", como: `tokens: falta FABRICA_CLAVE_TOKENS (32 bytes en hex o base64)` }
  const leer = async (): Promise<{ fila: FilaToken; cred: Credencial } | Fallo> => {
    const fila = await p.base.leer(red)
    if (!fila) return { ok: false, clase: "fatal", codigo: "sin_cargar", como: `tokens: no hay token de ${red} en fabrica_tokens (cargarlo con scripts/fabrica/cargar-token.ts)` }
    try {
      return { fila, cred: descifrar(fila.cifrado, clave) }
    } catch (e) {
      return { ok: false, clase: "fatal", como: `tokens: el de ${red} no se pudo descifrar (${e instanceof Error ? e.message : e}); ¿cambió FABRICA_CLAVE_TOKENS?` }
    }
  }

  const primero = await leer()
  if ("ok" in primero) return primero
  if (vigente(primero.cred, p.ahora())) return { ok: true, acceso: primero.cred.acceso! }

  const renovar = p.renovadores[red]
  if (!renovar) return { ok: false, clase: "fatal", como: `tokens: ${red} no tiene renovador` }

  // 1. Reservar. Si otro está renovando, se espera su rotación y se lee la suya.
  const reservada = await p.base.reservar(red, RESERVA_SEG)
  if (!reservada) {
    const dormir = p.dormir ?? dormirReal
    for (let i = 0; i < ESPERAS_OTRO; i++) {
      await dormir(2_000)
      const otra = await leer()
      if ("ok" in otra) return otra
      if (vigente(otra.cred, p.ahora())) return { ok: true, acceso: otra.cred.acceso! }
    }
    return { ok: false, clase: "reintentable", como: `tokens: otro proceso está renovando el de ${red} y no terminó en ${ESPERAS_OTRO * 2} s` }
  }

  // La fila de la reserva es la verdad (otro pudo rotar entre la lectura y la reserva).
  let cred: Credencial
  try {
    cred = descifrar(reservada.cifrado, clave)
  } catch (e) {
    const como = `tokens: el de ${red} no se pudo descifrar (${e instanceof Error ? e.message : e})`
    await p.base.anotarError(red, como)
    return { ok: false, clase: "fatal", como }
  }
  if (vigente(cred, p.ahora())) {
    // Otro ya lo renovó: se suelta la reserva rotando lo mismo (sube la versión, no cambia el token).
    await p.base.rotar(red, reservada.version, reservada.cifrado, reservada.expira_en)
    return { ok: true, acceso: cred.acceso! }
  }

  // 2. Renovar con la red.
  const r = await renovar(cred.refresh, { fetch: p.fetch, env: p.env })
  if (!r.ok) {
    const como = `${r.como}${red === "x" && r.clase === "ambiguo" ? " · X pudo haber gastado el refresh: si el próximo intento da invalid_request, reautorizar" : ""}`
    console.error(`[fabrica/tokens] renovar ${red} falló: ${como}`)
    await p.base.anotarError(red, como)
    return { ...r, como }
  }

  // 3. Rotar, solo si nadie rotó antes.
  const nuevo: Credencial = { refresh: r.refresh ?? cred.refresh, acceso: r.acceso, accesoExpira: r.expiraEn }
  const rotado = await p.base.rotar(red, reservada.version, cifrar(nuevo, clave), r.expiraEn)
  if (!rotado) {
    // La reserva venció mientras se renovaba y otro rotó. En X el refresh que
    // se acaba de recibir se pierde: lo que vale es lo que está en la base.
    const como = `tokens: la rotación de ${red} perdió contra otra (versión ${reservada.version} ya no es la vigente)`
    console.error(`[fabrica/tokens] ${como}`)
    const otra = await leer()
    if (!("ok" in otra) && vigente(otra.cred, p.ahora())) return { ok: true, acceso: otra.cred.acceso! }
    await p.base.anotarError(red, `${como}; reautorizar si sigue fallando`)
    return { ok: false, clase: "fatal", como }
  }
  ;(p.log ?? console.log)(`[fabrica/tokens] ${red} renovado: acceso hasta ${r.expiraEn}${r.refresh && r.refresh !== cred.refresh ? ", refresh rotado" : ""}`)
  return { ok: true, acceso: r.acceso }
}

/**
 * Cómo tiene que tratar un adaptador un token que no llegó. Lo que se envía
 * todavía no salió, así que nada es ambiguo:
 *   - la base falló o la renovación falló un rato (5xx, red, otro renovando,
 *     ambiguo) → reintentable: un 503 de Supabase no pierde la noche;
 *   - nunca se cargó (no hay fila) → no_hoy: queda para cuando Kev lo cargue,
 *     sin contar como fallo de la red;
 *   - lo demás (inválido, sin clave, no se descifra) → fatal.
 */
export function claseSinToken(f: Fallo): Fallo {
  if (f.codigo === "sin_cargar") return { ...f, clase: "no_hoy" }
  if (f.clase === "ambiguo" || f.clase === "reintentable") return { ...f, clase: "reintentable" }
  return f
}

/** Para Ctx.token: el acceso o null, con el cómo en el log (nunca un null mudo). `fallo(red)` dice por qué fue null. */
export function tokenPara(p: PuertosToken): ((red: RedId) => Promise<string | null>) & { fallo: (red: RedId) => Fallo | null } {
  const ultimo = new Map<RedId, Fallo>()
  const token = async (red: RedId) => {
    ultimo.delete(red)
    try {
      const r = await accesoVigente(red, p)
      if (r.ok) return r.acceso
      ultimo.set(red, claseSinToken(r))
      console.error(`[fabrica/tokens] sin token de ${red} (${claseSinToken(r).clase}): ${r.como}`)
      return null
    } catch (e) {
      const como = `tokens: la base falló al leer o renovar el de ${red} (${e instanceof Error ? e.message : e})`
      ultimo.set(red, { ok: false, clase: "reintentable", como })
      console.error(`[fabrica/tokens] sin token de ${red} (reintentable): ${como}`)
      return null
    }
  }
  return Object.assign(token, { fallo: (red: RedId) => ultimo.get(red) ?? null })
}

// ── La base real (Supabase, service-role) ─────────────────────

type Cliente = NonNullable<ReturnType<typeof getAdminClient>>

const primera = <T>(x: T[] | T | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x)

export function baseTokensSupabase(db: Cliente): BaseTokens {
  const falla = (que: string, e: { message: string }) => {
    throw new Error(`[fabrica/tokens] ${que} falló: ${e.message}`)
  }
  return {
    async leer(red) {
      const { data, error } = await db.from("fabrica_tokens").select("red, cifrado, version, expira_en, renovando_hasta").eq("red", red).maybeSingle()
      if (error) falla(`leer ${red}`, error)
      return (data as FilaToken | null) ?? null
    },
    async reservar(red, venceSeg) {
      const { data, error } = await db.rpc("fabrica_reservar_token", { p_red: red, p_vence_seg: venceSeg })
      if (error) falla(`reservar ${red}`, error)
      return primera(data as FilaToken[] | null)
    },
    async rotar(red, version, cifrado, expira) {
      const { data, error } = await db.rpc("fabrica_rotar_token", { p_red: red, p_version: version, p_cifrado: cifrado, p_expira: expira })
      if (error) falla(`rotar ${red}`, error)
      return data === true
    },
    async anotarError(red, como) {
      const { error } = await db.from("fabrica_tokens").update({ ultimo_error: como.slice(0, 1000), renovando_hasta: null }).eq("red", red)
      // Que no se pueda anotar no tapa el error original: se loguea y sigue.
      if (error) console.error(`[fabrica/tokens] no se pudo anotar el error de ${red}: ${error.message}`)
    },
    async guardar(red, cifrado) {
      const { data, error } = await db.from("fabrica_tokens").select("version").eq("red", red).maybeSingle()
      if (error) falla(`leer ${red}`, error)
      if (data) {
        const v = (data as { version: number }).version
        const { data: hecho, error: e2 } = await db
          .from("fabrica_tokens")
          .update({ cifrado, version: v + 1, expira_en: null, renovando_hasta: null, ultimo_error: null, actualizado: new Date().toISOString() })
          .eq("red", red)
          .eq("version", v)
          .select("red")
        if (e2) falla(`guardar ${red}`, e2)
        if (!hecho?.length) throw new Error(`[fabrica/tokens] ${red} cambió de versión mientras se guardaba: correrlo de nuevo`)
        return
      }
      const { error: e3 } = await db.from("fabrica_tokens").insert({ red, cifrado, version: 1 })
      if (e3) falla(`crear ${red}`, e3)
    },
  }
}
