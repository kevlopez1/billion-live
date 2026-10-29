// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LO COMÚN DE LOS ADAPTADORES DE RED
//
// Una sola forma de llamar a una red: `pedir()` nunca lanza. Devuelve la
// respuesta (cualquier status) o un Fallo con la clase y el CÓMO.
//
// La regla que importa: si la llamada se cortó, ¿pudo haber salido?
//   - idempotente (leer, dejar privado, iniciar una subida): se repite → reintentable.
//   - no idempotente (crear un post, subir los bytes): puede haber salido →
//     ambiguo, y la cola mira recientes() antes de repetir.
// Un error de DNS o de conexión rechazada pasa antes de mandar nada: reintentable.
// ──────────────────────────────────────────────────────────────

import type { Clase, Ctx, Fallo } from "../tipos"

export interface Respuesta {
  status: number
  /** El JSON, o null si el cuerpo no era JSON. */
  cuerpo: unknown
  /** El cuerpo tal cual (recortado al guardarlo en el cómo). */
  texto: string
  headers: Headers
}

export interface OpcionesPedido {
  /** Lo que se espera antes de cortar. */
  ms: number
  /** true = repetirla no duplica nada. */
  idempotente: boolean
  /** Para el cómo: "youtube.subir (PUT de los bytes)". */
  paso: string
}

/** Errores que ocurren antes de que salga un byte: nada pudo publicarse. */
const ANTES_DE_MANDAR = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ERR_INVALID_URL", "UND_ERR_CONNECT_TIMEOUT"])

export const recortar = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}…` : s)

const codigoDe = (e: unknown): string | undefined => {
  const causa = (e as { cause?: { code?: unknown } })?.cause
  const c = causa?.code ?? (e as { code?: unknown })?.code
  return typeof c === "string" ? c : undefined
}

export const esFallo = (x: unknown): x is Fallo =>
  !!x && typeof x === "object" && (x as { ok?: unknown }).ok === false && typeof (x as { clase?: unknown }).clase === "string"

/** Llama a la red. Nunca lanza. */
export async function pedir(c: Pick<Ctx, "fetch">, url: string, init: RequestInit, o: OpcionesPedido): Promise<Respuesta | Fallo> {
  let r: Response
  try {
    r = await c.fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(o.ms) })
  } catch (e) {
    return falloDeExcepcion(e, o)
  }
  let texto: string
  try {
    texto = await r.text()
  } catch (e) {
    // La red contestó el status pero el cuerpo se cortó: con un 2xx algo se hizo.
    const f = falloDeExcepcion(e, o)
    return r.ok && !o.idempotente ? { ...f, clase: "ambiguo", como: `${f.como} (después de un HTTP ${r.status})` } : f
  }
  let cuerpo: unknown = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = null // no era JSON: queda el texto, que va al cómo
  }
  return { status: r.status, cuerpo, texto, headers: r.headers }
}

export function falloDeExcepcion(e: unknown, o: Pick<OpcionesPedido, "ms" | "idempotente" | "paso">): Fallo {
  const nombre = e instanceof Error ? e.name : ""
  const mensaje = e instanceof Error ? e.message : String(e)
  const codigo = codigoDe(e)
  if (nombre === "TimeoutError" || nombre === "AbortError") {
    return {
      ok: false,
      clase: o.idempotente ? "reintentable" : "ambiguo",
      como: `${o.paso}: sin respuesta en ${Math.round(o.ms / 1000)} s${o.idempotente ? "" : " (puede haber salido: mirar recientes antes de repetir)"}`,
      codigo: "sin_respuesta",
    }
  }
  if (codigo && ANTES_DE_MANDAR.has(codigo)) {
    return { ok: false, clase: "reintentable", como: `${o.paso}: no se pudo conectar (${codigo}: ${mensaje})`, codigo }
  }
  return {
    ok: false,
    clase: o.idempotente ? "reintentable" : "ambiguo",
    como: `${o.paso}: error de red${codigo ? ` ${codigo}` : ""} (${mensaje})${o.idempotente ? "" : ": puede haber salido"}`,
    ...(codigo ? { codigo } : {}),
  }
}

/** Una respuesta que no es 2xx, como Fallo: la clase la decide el clasificador de la red; el cómo es el cuerpo tal cual. */
export function falloHttp(paso: string, r: Respuesta, clasificar: (status: number, cuerpo: unknown) => Clase, codigo?: string): Fallo {
  return {
    ok: false,
    clase: clasificar(r.status, r.cuerpo),
    como: `${paso}: HTTP ${r.status} ${recortar(r.texto || "(sin cuerpo)")}`,
    codigo: codigo ?? String(r.status),
  }
}

export const ok2xx = (r: Respuesta) => r.status >= 200 && r.status < 300

/** Un campo de un objeto desconocido, sin `any`. */
export function campo(o: unknown, ...ruta: (string | number)[]): unknown {
  let x: unknown = o
  for (const k of ruta) {
    if (x === null || typeof x !== "object") return undefined
    x = (x as Record<string | number, unknown>)[k]
  }
  return x
}

export const texto = (x: unknown): string | undefined => (typeof x === "string" && x ? x : undefined)

/**
 * Los bytes del archivo, desde el almacén (URL firmada). Solo la VM sube
 * archivos pesados: en Vercel esto no se llama.
 */
export async function bytesDelArchivo(c: Pick<Ctx, "fetch" | "almacen">, archivo: string | null, paso: string): Promise<Uint8Array | Fallo> {
  if (!archivo) return { ok: false, clase: "fatal", como: `${paso}: el video no tiene archivo en el almacén` }
  if (!c.almacen) return { ok: false, clase: "fatal", como: `${paso}: sin almacén configurado (FABRICA_ALMACEN)` }
  let url: string
  try {
    url = await c.almacen.urlFirmada(archivo, 24)
  } catch (e) {
    return { ok: false, clase: "reintentable", como: `${paso}: el almacén no dio la URL firmada de ${archivo}: ${e instanceof Error ? e.message : e}` }
  }
  let r: Response
  try {
    r = await c.fetch(url, { cache: "no-store", signal: AbortSignal.timeout(300_000) })
  } catch (e) {
    return falloDeExcepcion(e, { ms: 300_000, idempotente: true, paso: `${paso} (bajar ${archivo})` })
  }
  if (!r.ok) return { ok: false, clase: r.status >= 500 ? "reintentable" : "fatal", como: `${paso}: el almacén respondió HTTP ${r.status} al bajar ${archivo}` }
  try {
    const datos = new Uint8Array(await r.arrayBuffer())
    if (!datos.byteLength) return { ok: false, clase: "fatal", como: `${paso}: ${archivo} está vacío en el almacén` }
    return datos
  } catch (e) {
    return falloDeExcepcion(e, { ms: 300_000, idempotente: true, paso: `${paso} (leer ${archivo})` })
  }
}

/** La URL firmada para que la red vaya a buscar el archivo (Meta, Upload-Post). */
export async function urlDelArchivo(c: Pick<Ctx, "almacen">, archivo: string | null, paso: string): Promise<string | Fallo> {
  if (!archivo) return { ok: false, clase: "fatal", como: `${paso}: el video no tiene archivo en el almacén` }
  if (!c.almacen) return { ok: false, clase: "fatal", como: `${paso}: sin almacén configurado (FABRICA_ALMACEN)` }
  try {
    return await c.almacen.urlFirmada(archivo, 24)
  } catch (e) {
    return { ok: false, clase: "reintentable", como: `${paso}: el almacén no dio la URL firmada de ${archivo}: ${e instanceof Error ? e.message : e}` }
  }
}

export const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
