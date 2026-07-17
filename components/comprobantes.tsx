"use client"

import { useState } from "react"
import { ShieldCheck, X } from "lucide-react"

// Comprobantes reales de pagos de clientes de PRIME. Los datos personales de
// terceros (nombres, cuentas) van censurados EN LA IMAGEN (barra sólida), no con
// CSS — así el archivo servido nunca contiene el dato sensible.
const receipts = [
  { src: "/images/comprobantes/bancosol.jpg", amount: "Bs 1.800", bank: "BancoSol", date: "16 jul 2026" },
  { src: "/images/comprobantes/bnb.jpg", amount: "Bs 2.100", bank: "BNB", date: "13 jul 2026" },
  { src: "/images/comprobantes/bcp2.jpg", amount: "Bs 1.770", bank: "Banco de Crédito", date: "7 jul 2026" },
  { src: "/images/comprobantes/ganadero.jpg", amount: "Bs 3.180", bank: "Banco Ganadero", date: "4 jul 2026" },
  { src: "/images/comprobantes/bcp1.jpg", amount: "Bs 1.730", bank: "Banco de Crédito", date: "29 jun 2026" },
]

export function Comprobantes() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {receipts.map((r) => (
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
              <div className="font-display font-extrabold text-sm md:text-base tracking-tight">{r.amount}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.bank} · {r.date}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/80">
        <ShieldCheck className="w-3.5 h-3.5 text-kev-primary" />
        <span>Datos personales de clientes censurados por privacidad. Cada monto es un pago real por servicios de PRIME.</span>
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
            alt="Comprobante"
            className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
