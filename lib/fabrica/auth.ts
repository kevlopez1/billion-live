// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LAS CLAVES DE LAS MÁQUINAS
//
// pg_cron llama al tick con `Bearer FABRICA_CRON_SECRET`; el bot de Prime
// lee el vigilante (y puede PAUSAR, nunca reanudar) con
// `Bearer FABRICA_VIGILANTE_SECRET`. Mismo criterio que lib/auth-admin.ts:
// se comparan los sha256 con timingSafeEqual, y una clave corta se ignora.
// ──────────────────────────────────────────────────────────────

import { createHash, timingSafeEqual } from "node:crypto"
import type { Entorno } from "./tipos"

const LARGO_MINIMO = 24
const h = (s: string) => createHash("sha256").update(s).digest()

export type Llave = "FABRICA_CRON_SECRET" | "FABRICA_VIGILANTE_SECRET"

/** true si la cabecera trae esa clave; "sin-clave" si la variable falta o es corta (un 500, no un 401). */
export function conLlave(req: Request, llave: Llave, env: Entorno = process.env): boolean | "sin-clave" {
  const secreto = env[llave]?.trim()
  if (!secreto || secreto.length < LARGO_MINIMO) return "sin-clave"
  return timingSafeEqual(h(req.headers.get("authorization") ?? ""), h(`Bearer ${secreto}`))
}
