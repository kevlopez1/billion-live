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
    }
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
