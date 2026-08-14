"use client"

import { PenLine, ArrowUpRight } from "lucide-react"

// WhatsApp de Kev para comprar/firmar (mismo número que el muro).
const WA_KEV = "59174234380"
const WA_MSG = encodeURIComponent("Quiero mi firma en el Mercedes — poner mi nombre en el auto ($10).")
const WA_URL = `https://wa.me/${WA_KEV}?text=${WA_MSG}`

// CTA principal para vender la firma de $10. Urgencia por CUPOS LIMITADOS,
// sin decir nunca cuántas firmas hay en total.
export function FirmaCta() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-rojo/30 bg-gradient-to-br from-rojo/[0.07] via-card/40 to-transparent px-6 py-9 md:px-10 md:py-11 text-center">
      {/* chip de urgencia */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rojo/40 bg-rojo/[0.08] px-3 py-1 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-rojo">
        <span className="w-1.5 h-1.5 rounded-full bg-rojo animate-pulse" /> Cupos limitados
      </span>

      <h3 className="mt-4 font-display font-extrabold tracking-tight text-[26px] leading-[1.05] md:text-4xl">
        Firmá el Mercedes por $10
      </h3>

      <p className="mx-auto mt-3 max-w-md text-sm md:text-base text-muted-foreground">
        Tu nombre grabado <span className="text-foreground font-medium">de verdad</span> en la carrocería del AMG GT 63 Mansory. Cuando el reto llegue a la meta, tu firma queda en la historia para siempre.
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm md:text-base font-serif-display italic text-azul">
        Los cupos son limitados y no se reabren.
      </p>

      <a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="lift mt-6 inline-flex items-center gap-2 rounded-2xl bg-foreground px-7 py-4 font-display font-semibold text-background shadow-[0_8px_20px_rgba(40,55,80,0.28)]"
      >
        <PenLine className="w-4 h-4" /> Quiero mi firma <ArrowUpRight className="w-4 h-4" />
      </a>

      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Pago único de $10 · una firma, un nombre en el auto
      </p>
    </div>
  )
}
