"use client"

import { Star, ArrowUpRight } from "lucide-react"

// WhatsApp de Kev para comprar/firmar.
const WA_KEV = "59174234380"
const WA_MSG = encodeURIComponent("Quiero firmar el Mercedes — poner mi nombre en el auto.")
const WA_URL = `https://wa.me/${WA_KEV}?text=${WA_MSG}`

type Tier = "vip" | "clasica"
type Firmante = { n: number; name: string; tier: Tier }

// Los que ya tienen su nombre camino al Mercedes. Sumá acá cada firma nueva.
const firmantes: Firmante[] = [{ n: 1, name: "Dayson Leónel Busto", tier: "clasica" }]

function num(n: number) {
  return `#${String(n).padStart(3, "0")}`
}

export function MuroFirmas() {
  const vips = firmantes.filter((f) => f.tier === "vip").sort((a, b) => a.n - b.n)
  const clasicas = firmantes.filter((f) => f.tier === "clasica").sort((a, b) => a.n - b.n)

  return (
    <div className="mt-14">
      {/* sub-encabezado */}
      <div className="mb-6 flex items-center gap-2.5 border-b border-border pb-4">
        <span className="gold-tick" />
        <div className="section-eyebrow">El muro · quiénes ya firmaron</div>
        <span className="ml-auto text-xs text-muted-foreground">{firmantes.length} firma{firmantes.length === 1 ? "" : "s"}</span>
      </div>

      {/* VIP destacados */}
      {vips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4">
          {vips.map((f) => (
            <div
              key={f.n}
              className="relative rounded-2xl border border-gold/60 bg-gold/[0.06] px-5 py-7 text-center overflow-hidden"
            >
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-gold">
                <Star className="w-3 h-3 fill-current" /> VIP
              </span>
              <div className="font-serif-display italic text-3xl md:text-4xl text-foreground leading-tight">{f.name}</div>
              <div className="mt-3 text-[10px] font-display font-semibold uppercase tracking-[0.24em] text-gold">
                Firma {num(f.n)} · VIP
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clásicas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {clasicas.map((f) => (
          <div key={f.n} className="rounded-2xl border border-border bg-card/50 px-4 py-6 text-center">
            <div className="font-serif-display italic text-xl md:text-2xl text-foreground leading-tight break-words">
              {f.name}
            </div>
            <div className="mt-2.5 text-[10px] font-display font-semibold uppercase tracking-[0.2em] text-azul">
              Firma {num(f.n)} · Clásica
            </div>
          </div>
        ))}

        {/* CTA: tu nombre acá */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lift group rounded-2xl border border-dashed border-foreground/25 bg-transparent px-4 py-6 text-center flex flex-col items-center justify-center hover:border-rojo/50 transition-colors"
        >
          <div className="font-serif-display italic text-xl md:text-2xl text-muted-foreground/70 leading-tight">
            Tu nombre acá
          </div>
          <div className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-display font-semibold uppercase tracking-[0.2em] text-rojo">
            Firmá el Mercedes <ArrowUpRight className="w-3 h-3" />
          </div>
        </a>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground/80 max-w-lg mx-auto">
        Cada nombre va grabado de verdad en la carrocería cuando el reto llegue a la meta. Por $10 tu firma queda en la historia.
      </p>
    </div>
  )
}
