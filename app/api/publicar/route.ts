import { NextResponse } from "next/server"
import { autorizado, rechazo } from "@/lib/auth-admin"
import { configurado, continuar, publicar, type Resultado } from "@/lib/meta"
import { cuentaDe, urlDelEpisodio, validarPedido, type Cuenta } from "@/lib/publicar-pedido"
import { CALENDARIO } from "@/components/casa-blanca/estudio/episodios"
import { duracionTotal } from "@/components/casa-blanca/estudio/guion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Un reel tarda en procesarse en Meta antes de poder publicarse. Lo que no
// termina en este tiempo vuelve como "en proceso" y la página lo retoma.
export const maxDuration = 60

// ──────────────────────────────────────────────────────────────
// Publicar en Instagram y Facebook a la vez. Misma clave que /control.
// Dos cuentas: "kev" (por defecto) y "casa-blanca".
// ──────────────────────────────────────────────────────────────

const sinConfigurar = (falta: string) =>
  NextResponse.json({ error: `Falta ${falta} en las variables de entorno de Vercel.`, falta }, { status: 500 })

/** El calendario de una cuenta, liviano: lo que la página necesita para elegir. */
function calendario(cuenta: Cuenta) {
  if (cuenta !== "casa-blanca") return []
  return [...CALENDARIO]
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .map((e) => ({
      id: e.episodio.id,
      fecha: e.fecha,
      hora: e.hora,
      titulo: e.episodio.titulo,
      formato: e.episodio.formato,
      segundos: Math.round(duracionTotal(e.episodio)),
      redes: e.redes,
      pilar: e.pilar,
      texto: e.texto,
      url: urlDelEpisodio(e.episodio.id),
    }))
}

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)
  const cuenta = cuentaDe(new URL(req.url).searchParams.get("cuenta"))
  if (!cuenta) return NextResponse.json({ error: "Cuenta desconocida." }, { status: 400 })
  const c = configurado(cuenta)
  return NextResponse.json({
    cuenta,
    falta: c.ok ? null : c.falta,
    calendario: calendario(cuenta),
  })
}

export async function POST(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)

  // El cuerpo se revisa ANTES que la configuración: lo mal pedido es un 400 de
  // quien pide, no un 500 de cómo está montado esto.
  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }
  const v = validarPedido(cuerpo)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const pedido = v.pedido

  const c = configurado(pedido.cuenta)
  if (!c.ok) return sinConfigurar(c.falta)

  const resultado: Partial<Record<"ig" | "fb", Resultado | undefined>> =
    pedido.accion === "continuar"
      ? { ig: await continuar(pedido.cuenta, pedido.contenedor) }
      : await publicar(pedido.cuenta, pedido.tipo, pedido.url, pedido.texto, pedido.destinos)

  // "En proceso" no es un fallo: la página lo vuelve a mirar.
  const algunoBien = Object.values(resultado).some((r) => r?.ok || (r && !r.ok && r.pendiente))
  return NextResponse.json({ cuenta: pedido.cuenta, resultado }, { status: algunoBien ? 200 : 502 })
}
