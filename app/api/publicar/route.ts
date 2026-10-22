import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { configurado, publicar, type Destino, type Tipo } from "@/lib/meta"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Un reel tarda en procesarse en Meta antes de poder publicarse.
export const maxDuration = 60

// ──────────────────────────────────────────────────────────────
// Publicar en Instagram y Facebook a la vez. Misma clave que /control.
// ──────────────────────────────────────────────────────────────

const TIPOS: Tipo[] = ["foto", "video"]
const DESTINOS: Destino[] = ["ig", "fb"]

export async function POST(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  // El cuerpo se revisa ANTES que la configuración: lo mal pedido es un 400 de
  // quien pide, no un 500 de cómo está montado esto.
  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }

  const tipo = cuerpo.tipo as Tipo
  const url = typeof cuerpo.url === "string" ? cuerpo.url.trim() : ""
  const texto = typeof cuerpo.texto === "string" ? cuerpo.texto : ""
  const destinos = Array.isArray(cuerpo.destinos)
    ? (cuerpo.destinos as unknown[]).filter((d): d is Destino => DESTINOS.includes(d as Destino))
    : []

  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Elige si es foto o video." }, { status: 400 })
  }
  if (!/^https:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "Meta necesita una dirección pública que empiece con https:// para ir a buscar el archivo." },
      { status: 400 },
    )
  }
  if (destinos.length === 0) {
    return NextResponse.json({ error: "Elige al menos una red: Instagram o Facebook." }, { status: 400 })
  }
  // El límite de Instagram para el texto de una publicación.
  if (texto.length > 2200) {
    return NextResponse.json({ error: "El texto pasa de 2.200 caracteres, el máximo de Instagram." }, { status: 400 })
  }

  const c = configurado()
  if (!c.ok) {
    return NextResponse.json(
      { error: `Falta ${c.falta} en las variables de entorno de Vercel.` },
      { status: 500 },
    )
  }

  const resultado = await publicar(tipo, url, texto, destinos)
  const algunoBien = Object.values(resultado).some((r) => r?.ok)
  return NextResponse.json({ resultado }, { status: algunoBien ? 200 : 502 })
}
