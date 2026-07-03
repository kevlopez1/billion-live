"use client"

import { useState } from "react"
import { Globe2, ArrowRight } from "lucide-react"
import { Reveal } from "@/components/reveal"

// El reto no se queda en Bolivia: un socio por país, cobrando en dólares.
// El funnel real es el programa Prime Partners (primebusiness.live/franquicias).
const PAISES = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Ecuador",
  "El Salvador",
  "Guatemala",
  "Honduras",
  "México",
  "Nicaragua",
  "Panamá",
  "Paraguay",
  "Perú",
  "R. Dominicana",
  "Uruguay",
  "Venezuela",
  "EE.UU. (latinos)",
]

const waLink = (pais: string) =>
  "https://wa.me/59172258926?text=" +
  encodeURIComponent(`Hola Kev, quiero ser el socio de PRIME en ${pais}. Vengo del reto.`)

export function SociosLatam() {
  const [pais, setPais] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="px-6 py-8 md:px-8 md:py-10">
        <div className="flex items-start gap-3">
          <Globe2 className="w-5 h-5 text-muted-foreground mt-1 shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-muted-foreground max-w-2xl">
            Bolivia me formó, pero el imperio se construye en dólares. Busco{" "}
            <span className="text-foreground font-semibold">una persona en cada país de LATAM</span>{" "}
            para llevar los Empleados AI de PRIME a su mercado: yo pongo el producto, el sistema y
            el respaldo del reto; vos ponés tu país.
          </p>
        </div>

        {/* Selector de país */}
        <div className="mt-6 flex flex-wrap gap-2">
          {PAISES.map((p) => (
            <button
              key={p}
              onClick={() => setPais(p)}
              className={`press-effect rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                pais === p
                  ? "border-foreground bg-foreground text-background font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <Reveal>
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <a
              href={waLink(pais ?? "mi país")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              {pais ? `Quiero ${pais}` : "Quiero mi país"}
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://primebusiness.live/franquicias"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Ver cómo funciona Prime Partners
            </a>
          </div>
        </Reveal>

        <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Un socio por territorio · comisión recurrente · sin saber de tecnología
        </p>
      </div>
    </div>
  )
}
