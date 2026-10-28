"use client"

// ──────────────────────────────────────────────────────────────
// "Cómo llegar": los pasos desde la superficie hasta un lugar (pabellón del
// ascensor, nivel, pasillo y puerta). Los pasos salen de navegacion.ts.
// ──────────────────────────────────────────────────────────────

import { ArrowDownUp, Flag, MapPin, MoveRight } from "lucide-react"
import { comoLlegar, type Paso } from "../navegacion"
import { Rotulo } from "./base"

const ICONO: Record<Paso["tipo"], typeof MapPin> = { inicio: MapPin, ascensor: ArrowDownUp, pasillo: MoveRight, llegada: Flag }

export function ComoLlegar({ lugarId, color = "#e3b866" }: { lugarId: string; color?: string }) {
  const pasos = comoLlegar(lugarId)
  if (!pasos.length) return null
  return (
    <section className="mt-5">
      <Rotulo className="mb-2">Cómo llegar</Rotulo>
      <ol className="relative space-y-1.5">
        {pasos.length > 1 && <span className="absolute bottom-3 left-[13px] top-3 w-px bg-white/15" aria-hidden />}
        {pasos.map((p, i) => {
          const Icono = ICONO[p.tipo]
          const fin = i === pasos.length - 1
          return (
            <li key={i} className="relative flex items-center gap-2.5">
              <span
                className="relative grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border"
                style={fin ? { background: color, borderColor: color, color: "#0b0d10" } : { background: "#11141a", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.8)" }}
              >
                <Icono className="h-3.5 w-3.5" />
              </span>
              <span className={`text-[12.5px] leading-snug ${fin ? "font-bold text-white" : "text-white/75"}`}>{p.texto}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
