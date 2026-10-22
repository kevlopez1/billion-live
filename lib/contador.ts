// ──────────────────────────────────────────────────────────────
// EL CONTADOR — el número y la regla para confiar en la base
//
// Vive aquí y no en context/app-context.tsx porque ese archivo es "use client"
// y la imagen de vista previa (app/opengraph-image.tsx) corre en el servidor:
// desde ahí no se puede leer un valor de un módulo de cliente. Por eso la
// vista previa tenía su propio número escrito a mano ($5.091) que nadie
// actualizaba. app-context lo reexporta, así que lo demás no cambia.
// ──────────────────────────────────────────────────────────────

export const CHALLENGE_TARGET = 450_000 // Mercedes-AMG GT 63 Mansory
export const CHALLENGE_LAUNCH = "2026-06-30" // Día 1: martes del primer video
export const CHALLENGE_RECORD_DEADLINE = "2026-12-30" // ritmo récord: 6 meses
export const CHALLENGE_DEADLINE = "2027-06-30" // límite: 12 meses

/**
 * Lo recaudado hasta hoy. Es LA fuente del número: lo usan el contador de la
 * home, /profile y la vista previa al compartir el link.
 */
export const RECAUDADO = 7346 // 6915 + 431 (Bs 5.100 el 9 oct ÷ 11,83) — edita aquí o desde /control

/**
 * El valor guardado en la base (`global_metrics`), SOLO si es del reto.
 *
 * La base traía una fila de la plantilla vieja del dashboard, creada el 8 de
 * enero de 2026 — antes de que existiera el reto — con $250.000.000 de
 * ejemplo. Mientras la base no estuvo conectada daba igual; el día que se
 * conectó, la home pasó a decir "$250.000.000 · 100% al Mercedes". En un reto
 * cuya marca es "todo real", un número de mentira en la portada es lo peor
 * que puede pasar.
 *
 * Dos reglas, y si falla cualquiera se usa RECAUDADO:
 *  - La fila tiene que haberse guardado DESPUÉS del día 1 del reto. Lo de
 *    antes es plantilla. (/api/counter ahora sella la fecha en cada cambio.)
 *  - El monto tiene que estar entre $1 y la meta. Más que el auto es un dedazo
 *    con ceros de más, no un dato.
 */
export function montoConfiable(fila: unknown): number | null {
  if (!fila || typeof fila !== "object") return null
  const { net_worth, updated_at } = fila as { net_worth?: unknown; updated_at?: unknown }
  if (typeof net_worth !== "number" || !Number.isFinite(net_worth)) return null
  if (net_worth <= 0 || net_worth > CHALLENGE_TARGET) return null
  const t = typeof updated_at === "string" ? Date.parse(updated_at) : NaN
  if (!Number.isFinite(t) || t < Date.parse(CHALLENGE_LAUNCH)) return null
  return net_worth
}
