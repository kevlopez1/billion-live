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

const h = (s: string) => createHash("sha256").update(s).digest()
const igual = (a: string, b: string) => timingSafeEqual(h(a), h(b))

/** Solo Kev. Todo lo que no diga lo contrario usa esta. */
export function autorizado(req: Request): Autorizacion {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return "sin-clave"
  return igual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)
}

// ──────────────────────────────────────────────────────────────
// EL EQUIPO
//
// Una clave por persona (el editor, el filmmaker…), en CLAVES_EQUIPO:
//   editor=una-clave-larga,filmmaker=otra-clave-larga
// Una por persona y no una compartida: si alguien se va, se borra SU clave y
// los demás siguen entrando.
//
// El equipo entra SOLO al manual (/branding). El dinero, las preguntas con
// nombres, los proyectos, publicar y el centro siguen siendo de Kev: cada
// ruta usa `autorizado` (solo Kev) salvo las que piden `quien` a propósito.
// Lo que no se abre explícitamente queda cerrado.
// ──────────────────────────────────────────────────────────────

export type Quien = { rol: "admin" } | { rol: "equipo"; nombre: string }

// Menos de 12 caracteres se adivina. Una clave así se ignora, no se acepta.
const LARGO_MINIMO = 12

export function equipo(): { nombre: string; clave: string }[] {
  return (process.env.CLAVES_EQUIPO ?? "")
    .split(",")
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const i = par.indexOf("=")
      return { nombre: par.slice(0, i).trim(), clave: par.slice(i + 1).trim() }
    })
    .filter((x) => x.nombre && x.clave.length >= LARGO_MINIMO && x.clave !== process.env.ADMIN_SECRET)
}

/** Quién manda la petición: Kev, alguien del equipo, o nadie conocido. */
export function quien(req: Request): Quien | null | "sin-clave" {
  const a = autorizado(req)
  if (a === "sin-clave") return "sin-clave"
  if (a) return { rol: "admin" }
  const dado = req.headers.get("authorization") ?? ""
  // Se comparan TODAS, aunque una ya coincida: así el tiempo de respuesta no
  // dice en qué posición está la clave buena.
  let encontrado: string | null = null
  for (const m of equipo()) if (igual(dado, `Bearer ${m.clave}`)) encontrado = m.nombre
  return encontrado ? { rol: "equipo", nombre: encontrado } : null
}

/** Para lo que es solo de Kev aunque la clave sea válida (cuesta dinero, o
 *  toca datos privados): 403 con el motivo, no 401, así la página no vuelve
 *  a pedir la clave a alguien que la tiene bien puesta. */
export function soloKev(motivo: string) {
  return NextResponse.json({ error: motivo }, { status: 403 })
}

export function rechazo(a: Autorizacion) {
  if (a === "sin-clave") {
    return NextResponse.json({ error: "Falta ADMIN_SECRET en las variables de entorno." }, { status: 500 })
  }
  return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 })
}
