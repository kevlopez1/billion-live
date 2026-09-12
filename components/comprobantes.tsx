"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { ShieldCheck, X } from "lucide-react"
import { COMPROBANTES, monto, type Comprobante } from "@/lib/comprobantes"

// Grilla de comprobantes con lupa. Se usa en la home (recortada) y en la
// página /comprobantes (entera).
export function Comprobantes({ items = COMPROBANTES, nota = true }: { items?: Comprobante[]; nota?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {items.map((r) => (
          <button
            key={r.src}
            onClick={() => setOpen(r.src)}
            className="lift group text-left rounded-2xl border border-border bg-card/60 overflow-hidden focus:outline-none"
          >
            <div className="bg-white overflow-hidden">
              <img
                src={r.src}
                alt={`Comprobante ${r.bank}`}
                className="w-full aspect-[9/13] object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <div className="px-3 py-2.5">
              <div className="font-display font-extrabold text-sm md:text-base tracking-tight">{monto(r.bs)}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.bank} · {r.date}</div>
            </div>
          </button>
        ))}
      </div>

      {nota && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/80">
          <ShieldCheck className="w-3.5 h-3.5 text-kev-primary" />
          <span><b className="text-foreground">Todos son clientes de PRIME.</b> Cada monto es un pago real por servicios de la empresa; los datos personales van censurados por privacidad.</span>
        </div>
      )}

      {/* Lightbox — portal a <body> para escapar el stacking context de Reveal */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <button
              onClick={() => setOpen(null)}
              className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-[121] w-11 h-11 rounded-full bg-black/60 ring-1 ring-white/30 text-white flex items-center justify-center backdrop-blur"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={open}
              alt="Comprobante"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
