"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { MapPin, X } from "lucide-react"
import { PrimeMark } from "@/components/prime-mark"

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
      {/* Filas compactas, no tarjetas grandes. Las credenciales son verticales
          (4/5): a ancho completo cada una medía media pantalla y la sección
          entera pasaba de 1.200 px. Como fila, la miniatura basta para
          reconocerla y la credencial completa se abre al tocarla. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {eventos.map((e) => (
          <button
            key={e.src}
            onClick={() => setOpen(e.src)}
            className="lift group flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2 pr-3.5 text-left focus:outline-none"
          >
            <div className="shrink-0 overflow-hidden rounded-xl bg-white">
              <img
                src={e.src}
                alt={`Credencial ${e.nombre}`}
                className="h-14 w-[46px] object-cover object-top transition-transform duration-500 group-hover:scale-[1.06]"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-[13px] font-extrabold tracking-tight">{e.nombre}</span>
                <span className="shrink-0 rounded-full border border-kev-primary/40 bg-kev-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-kev-primary">
                  {e.rol}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{e.lugar}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-2 text-center text-[10px] leading-snug text-muted-foreground/80">
        <span>El reto no vive solo en la pantalla: <PrimeMark /> está en los eventos donde se mueve el ecosistema. Credenciales reales, QR censurado por privacidad.</span>
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
