import { NextResponse } from "next/server"
import { reto } from "@/lib/centro"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lectura pública del reto: los mismos números que muestra la home (lo
// recaudado, la meta, el día y los ritmos). La usa el overlay de los LIVE.
export async function GET() {
  return NextResponse.json(await reto())
}
