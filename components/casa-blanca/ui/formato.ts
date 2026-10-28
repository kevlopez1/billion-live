// ──────────────────────────────────────────────────────────────
// Formatos de pantalla de la Casa Blanca: dinero, hora y textos cortos.
//
// El dinero se separa a mano con punto ("$7.346"): toLocaleString("es-…")
// no agrupa los números de cuatro cifras y daría "$7346".
// ──────────────────────────────────────────────────────────────

import type { Linea } from "../tipos"

export const miles = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
export const usd = (n: number) => `$${miles(n)}`

/** 1050 → "17:30". Los minutos del mundo van de 0 a 1440. */
export function horaTexto(minutos: number) {
  const m = ((Math.floor(minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

export const relojTexto = (dia: number, minutos: number) => `Día ${dia} · ${horaTexto(minutos)}`

export function franja(minutos: number) {
  const h = (minutos / 60) % 24
  if (h < 5 || h >= 21) return "Noche"
  if (h < 12) return "Mañana"
  if (h < 17) return "Tarde"
  if (h < 19.5) return "Hora dorada"
  return "Atardecer"
}

export const textoDeLinea = (l: Linea) => (typeof l === "string" ? l : l.t)
export const esCita = (l: Linea) => typeof l !== "string"

export function recortar(t: string, n: number) {
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`
}

/** "hace 5 min", "hace 2 h", "hace 3 d". */
export function haceCuanto(iso: string, ahora = Date.now()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const s = Math.max(0, (ahora - t) / 1000)
  if (s < 60) return "ahora"
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} d`
}

export const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)} %`

/** Iniciales para el retrato mientras la escena todavía no lo dibujó. */
export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
}
