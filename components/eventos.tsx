"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { MapPin, X } from "lucide-react"

// Eventos a los que Kev asiste como fundador de PRIME. Prueba de que el reto se
// juega también fuera de la pantalla: networking, ecosistema, presencia real.
// Los QR de las credenciales van censurados EN LA IMAGEN por privacidad.
const eventos = [
  {
    src: "/images/eventos/blockchain-2040.jpg",
    nombre: "Blockchain 2040",
    rol: "Acceso VIP",
    lugar: "Santa Cruz, Bolivia",
    nota: "Cumbre de blockchain y futuro digital",
  },
  {
    src: "/images/eventos/fi-cainco.jpg",
    nombre: "Feria Internacional · FI",
    rol: "Visionario",
    lugar: "CAINCO · Santa Cruz",
    nota: "Innova Santa Cruz · Global Gateway (UE)",
  },
]

export function Eventos() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {eventos.map((e) => (
          <button
            key={e.src}
            onClick={() => setOpen(e.src)}
            className="lift group text-left rounded-2xl border border-border bg-card/60 overflow-hidden focus:outline-none"
          >
            <div className="bg-white overflow-hidden">
              <img
                src={e.src}
                alt={`Credencial ${e.nombre}`}
                className="w-full aspect-[4/5] object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-extrabold text-sm md:text-base tracking-tight">{e.nombre}</div>
                <span className="shrink-0 rounded-full border border-kev-primary/40 bg-kev-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-kev-primary">
                  {e.rol}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{e.lugar}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">{e.nota}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground/80">
        <span>El reto no vive solo en la pantalla: PRIME está en los eventos donde se mueve el ecosistema. Credenciales reales, QR censurado por privacidad.</span>
      </div>

      {/* Lightbox */}
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
              alt="Credencial de evento"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
