// ──────────────────────────────────────────────────────────────
// El cliente de /api/casa-blanca. Nunca tira: devuelve { ok: false } con el
// motivo, porque cada llamada tiene un plan B (el guion) y la interfaz decide.
// ──────────────────────────────────────────────────────────────

import type { Entregable } from "../tipos"

export interface EstadoServidor {
  entregables: Entregable[]
  progreso: Record<string, { entregados: number; puestos: number[] }>
  recaudado: number
  meta: number
  /** El ánimo y el pensamiento del día de cada residente (vacío si todavía no reflexionaron). */
  conciencias?: Record<string, { animo: string; pensamiento: string }>
}

/** El estado interior de un residente: lo escribe su reflexión diaria en el servidor. */
export interface ConcienciaServidor {
  animo: string
  meta: string
  pensamiento: string
  diario: string
  /** id de otro residente → { valor de -100 a 100, por qué }. */
  opiniones: Record<string, { valor: number; frase: string }>
  /** El día de Bolivia de la reflexión, "2026-10-28". */
  dia: string
}

/** Un recuerdo de la memoria compartida (lo que vivió con todos los visitantes). */
export interface RecuerdoServidor {
  texto: string
  tipo: "charla" | "conversacion" | "consejo" | "noticia" | "trabajo" | "diario"
  creado: string
  con: string[]
}

export interface InteriorServidor {
  conciencia: ConcienciaServidor | null
  recuerdos: RecuerdoServidor[]
}

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; status: number; error: string }

const RUTA = "/api/casa-blanca"

async function leerError(r: Response) {
  try {
    const j = (await r.json()) as { error?: unknown }
    if (typeof j?.error === "string" && j.error) return j.error
  } catch {}
  return `Error ${r.status}`
}

export async function pedir<T>(
  cuerpo: Record<string, unknown>,
  opciones: { clave?: string | null; signal?: AbortSignal } = {},
): Promise<Respuesta<T>> {
  try {
    const r = await fetch(RUTA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opciones.clave ? { Authorization: `Bearer ${opciones.clave}` } : {}),
      },
      body: JSON.stringify(cuerpo),
      signal: opciones.signal,
    })
    if (!r.ok) return { ok: false, status: r.status, error: await leerError(r) }
    return { ok: true, datos: (await r.json()) as T }
  } catch (e) {
    // Sin red o abortado: status 0 para distinguirlo de una respuesta del servidor.
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Sin conexión" }
  }
}

/** El estado público: entregables, progreso por departamento y el contador real. */
export async function leerEstado(clave?: string | null): Promise<EstadoServidor | null> {
  try {
    const r = await fetch(RUTA, {
      cache: "no-store",
      headers: clave ? { Authorization: `Bearer ${clave}` } : undefined,
    })
    if (!r.ok) return null
    const j = (await r.json()) as Partial<EstadoServidor>
    return {
      entregables: Array.isArray(j.entregables) ? j.entregables : [],
      progreso: j.progreso && typeof j.progreso === "object" ? j.progreso : {},
      recaudado: typeof j.recaudado === "number" ? j.recaudado : NaN,
      meta: typeof j.meta === "number" ? j.meta : NaN,
      conciencias: j.conciencias && typeof j.conciencias === "object" ? j.conciencias : {},
    }
  } catch {
    return null
  }
}

const esTexto = (x: unknown): x is string => typeof x === "string"

/** La conciencia y la memoria compartida de un residente, para su ficha. null si no se pudo leer. */
export async function leerInterior(id: string, opciones: { signal?: AbortSignal } = {}): Promise<InteriorServidor | null> {
  try {
    const r = await fetch(`${RUTA}?personaje=${encodeURIComponent(id)}`, { cache: "no-store", signal: opciones.signal })
    if (!r.ok) return null
    const j = (await r.json()) as { conciencia?: Partial<ConcienciaServidor> | null; recuerdos?: unknown }
    const c = j.conciencia
    const conciencia: ConcienciaServidor | null =
      c && typeof c === "object"
        ? {
            animo: esTexto(c.animo) ? c.animo : "",
            meta: esTexto(c.meta) ? c.meta : "",
            pensamiento: esTexto(c.pensamiento) ? c.pensamiento : "",
            diario: esTexto(c.diario) ? c.diario : "",
            opiniones: c.opiniones && typeof c.opiniones === "object" ? c.opiniones : {},
            dia: esTexto(c.dia) ? c.dia : "",
          }
        : null
    const recuerdos = (Array.isArray(j.recuerdos) ? j.recuerdos : []).filter(
      (x): x is RecuerdoServidor => !!x && typeof x === "object" && esTexto((x as RecuerdoServidor).texto) && esTexto((x as RecuerdoServidor).creado),
    )
    return { conciencia, recuerdos }
  } catch {
    return null
  }
}

/** Por qué no respondió la IA, en una línea para el público. */
export function motivoSinIa(status: number) {
  if (status === 429) return "La IA llegó a su límite por hoy: responde el guion."
  if (status === 0) return "Sin conexión: responde el guion."
  return "La IA no está disponible: responde el guion."
}
