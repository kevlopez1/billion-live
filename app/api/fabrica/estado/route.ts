import { NextResponse } from "next/server"
import { autorizado, quien, rechazo } from "@/lib/auth-admin"
import { conLlave } from "@/lib/fabrica/auth"
import { baseReal } from "@/lib/fabrica/base-cola"
import { bajarYouTube } from "@/lib/fabrica/cola"
import { adaptadores, ctxReal } from "@/lib/fabrica/registro-redes"
import { porQuien, sinPermiso, validarPedidoEstado, type Quien } from "@/lib/fabrica/estado-pedido"
import { diaBolivia, sumarDias } from "@/lib/fabrica/tipos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Al pausar se baja YouTube en el momento (cada envío programado, unos segundos).
export const maxDuration = 60

// ──────────────────────────────────────────────────────────────
// El interruptor de la fábrica.
//   GET   (Kev) el estado, los videos de hoy y mañana con sus redes, el
//         último parte y la reserva verde: lo que muestra /publicar.
//   POST  pausar / reanudar / ajustar. Pausar: Kev, el vigilante o el
//         equipo de FABRICA_PAUSA_EQUIPO. Reanudar y ajustar: solo Kev.
// ──────────────────────────────────────────────────────────────

const sinBase = () => NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
const fallo = (que: string, e: unknown) => {
  const como = e instanceof Error ? e.message : String(e)
  console.error(`[fabrica/estado] ${que} falló: ${como}`)
  return NextResponse.json({ error: `${que} falló: ${como}` }, { status: 500 })
}

export async function GET(req: Request) {
  const a = autorizado(req)
  if (a !== true) return rechazo(a)
  const base = baseReal()
  if (!base) return sinBase()
  try {
    const hoy = diaBolivia(new Date())
    const [estado, carga, parte, reserva] = await Promise.all([
      base.leerEstado(),
      base.cargar([hoy, sumarDias(hoy, 1)]),
      base.ultimoParte(),
      base.reservaVerde(),
    ])
    return NextResponse.json({ estado, hoy, ...carga, parte, reserva_verde: reserva })
  } catch (e) {
    return fallo("Leer el estado", e)
  }
}

/** Kev, el vigilante o alguien del equipo; null = nadie conocido. */
function quienPide(req: Request): Quien | null | "sin-clave" {
  const k = autorizado(req)
  if (k === true) return { rol: "kev" }
  if (conLlave(req, "FABRICA_VIGILANTE_SECRET") === true) return { rol: "vigilante" }
  const q = quien(req)
  if (q && q !== "sin-clave" && q.rol === "equipo") return { rol: "equipo", nombre: q.nombre }
  return k === "sin-clave" ? "sin-clave" : null
}

export async function POST(req: Request) {
  const q = quienPide(req)
  if (q === "sin-clave" || q === null) return rechazo(q === "sin-clave" ? "sin-clave" : false)

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON válido." }, { status: 400 })
  }
  const v = validarPedidoEstado(cuerpo)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const p = v.pedido
  const motivo403 = sinPermiso(q, p, process.env)
  if (motivo403) return NextResponse.json({ error: motivo403 }, { status: 403 })

  const base = baseReal()
  if (!base) return sinBase()
  try {
    const por = porQuien(q)
    const estado =
      p.accion === "pausar"
        ? await base.pausar(p.motivo, por, p.red)
        : p.accion === "reanudar"
          ? await base.reanudar(por, p.red)
          : await base.ajustar({
              ...(p.modo_aprobacion !== undefined ? { modo_aprobacion: p.modo_aprobacion } : {}),
              ...(p.videos_por_dia !== undefined ? { videos_por_dia: p.videos_por_dia } : {}),
              ...(p.tope_gasto_usd_dia !== undefined ? { tope_gasto_usd_dia: p.tope_gasto_usd_dia } : {}),
            })
    console.log(`[fabrica/estado] ${por} → ${p.accion}${"red" in p && p.red ? ` (${p.red})` : ""}`)
    // Lo que YouTube ya tiene programado sale aunque la base diga pausada: se
    // baja YA, sin esperar al tick (hasta 10 min). Si falla, la pausa igual
    // quedó y el tick siguiente lo vuelve a intentar; se dice cómo falló.
    let youtube: Awaited<ReturnType<typeof bajarYouTube>> | { error: string } | undefined
    if (p.accion === "pausar" && (!p.red || p.red === "youtube")) {
      try {
        const env = process.env
        youtube = await bajarYouTube({ base, adaptadores: adaptadores(), ctx: ctxReal(env), env, reloj: Date.now })
      } catch (e) {
        const como = e instanceof Error ? e.message : String(e)
        console.error(`[fabrica/estado] pausado, pero bajar YouTube en el momento falló (lo reintenta el tick): ${como}`)
        youtube = { error: como }
      }
    }
    return NextResponse.json({ estado, ...(youtube ? { youtube } : {}) })
  } catch (e) {
    return fallo(p.accion, e)
  }
}
