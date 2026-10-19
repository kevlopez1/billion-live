import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

// ──────────────────────────────────────────────────────────────
// La clave de administrador, comprobada en un solo lugar.
//
// Se comparan los sha256 y no los textos: timingSafeEqual exige dos búferes
// del mismo largo, y el hash lo garantiza sin filtrar cuántos caracteres
// tiene la clave buena.
// ──────────────────────────────────────────────────────────────

export type Autorizacion = boolean | "sin-clave"

export function autorizado(req: Request): Autorizacion {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return "sin-clave"
  const dado = req.headers.get("authorization") ?? ""
  const h = (s: string) => createHash("sha256").update(s).digest()
  return timingSafeEqual(h(dado), h(`Bearer ${secret}`))
}

export function rechazo(a: Autorizacion) {
  if (a === "sin-clave") {
    return NextResponse.json({ error: "Falta ADMIN_SECRET en las variables de entorno." }, { status: 500 })
  }
  return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
}
