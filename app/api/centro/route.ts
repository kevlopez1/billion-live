import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { centro } from "@/lib/centro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Pide clave también para LEER: aquí están las preguntas de dinero con
// nombres de personas, y los números de las cuentas.
export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)
  return NextResponse.json(await centro())
}
