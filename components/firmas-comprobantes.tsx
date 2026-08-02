"use client"

import { useState } from "react"
import { X, PenLine } from "lucide-react"

// Comprobantes de las firmas en el Mercedes ($10 la firma). Cada pago = una persona
// con su nombre camino a la carrocería. Datos de los firmantes censurados EN LA IMAGEN.
const firmas = [
  { src: "/images/comprobantes/firma-001.jpg", amount: "Bs 118", tier: "Firma #001", date: "30 jul 2026" },
]

export function FirmasComprobantes() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {firmas.map((r) => (
          <button
            key={r.src}
            onClick={() => setOpen(r.src)}
            className="lift group text-left rounded-2xl border border-border bg-card/60 overflow-hidden focus:outline-none"
          >
            <div className="bg-white overflow-hidden">
              <img
                src={r.src}
                alt={`Comprobante ${r.tier}`}
                className="w-full aspect-[9/13] object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <div className="px-3 py-2.5">
              <div className="font-display font-extrabold text-sm md:text-base tracking-tight">{r.amount}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.tier} · {r.date}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/80">
        <PenLine className="w-3.5 h-3.5 text-kev-primary" />
        <span>Cada pago es una firma real que va grabada en el Mercedes. Datos de los firmantes censurados por privacidad.</span>
      </div>

      {/* Lightbox */}
      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <button
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={open}
            alt="Comprobante de firma"
            className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
