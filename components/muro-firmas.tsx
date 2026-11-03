"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Star, ArrowUpRight, X, PenLine } from "lucide-react"
import { FIRMAS, CANTIDAD, numero, fechaCorta, type Firma } from "@/lib/firmas"

// ──────────────────────────────────────────────────────────────
// El muro de firmas del Mercedes.
//
// Antes esto eran DOS bloques separados y seguidos: uno con los comprobantes
// de pago y otro con los nombres. Era lo mismo contado dos veces, y quedaban
// como dos secciones sueltas sin relación visible entre sí. Ahora cada firma
// es UNA tarjeta: el nombre, su número, y el comprobante que lo prueba.
//
// Los datos salen de lib/firmas.ts. No se escribe nada a mano aquí.
// ──────────────────────────────────────────────────────────────

const WA_KEV = "59174234380"
const WA_MSG = encodeURIComponent("Quiero firmar el Mercedes — poner mi nombre en el auto.")
const WA_URL = `https://wa.me/${WA_KEV}?text=${WA_MSG}`

function Tarjeta({ f, onVer }: { f: Firma; onVer: (src: string) => void }) {
  const vip = f.tier === "vip"
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card/50 ${
        vip ? "border-gold/60 bg-gold/[0.06]" : "border-border"
      }`}
    >
      {/* El comprobante: la prueba de que la firma existe */}
      <button
        onClick={() => onVer(f.comprobante)}
        className="group block w-full overflow-hidden bg-white focus:outline-none"
        aria-label={`Ver el comprobante de la firma ${numero(f.n)}`}
      >
        <img
          src={f.comprobante}
          alt={`Comprobante de la firma ${numero(f.n)}`}
          className="aspect-[9/11] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </button>

      {/* Quién firmó */}
      <div className="px-4 py-4 text-center">
        {vip && (
          <span className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-gold">
            <Star className="h-3 w-3 fill-current" /> VIP
          </span>
        )}
        <div className="break-words font-serif-display text-xl italic leading-tight text-foreground md:text-2xl">
          {f.nombre}
        </div>
        <div
          className={`mt-2 text-[10px] font-display font-semibold uppercase tracking-[0.2em] ${
            vip ? "text-gold" : "text-azul"
          }`}
        >
          Firma {numero(f.n)} · {vip ? "VIP" : "Clásica"}
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          Bs {f.montoBs} · {fechaCorta(f.fecha)}
        </div>
      </div>
    </div>
  )
}

export function MuroFirmas() {
  const [abierto, setAbierto] = useState<string | null>(null)

  // Las VIP primero; dentro de cada grupo, por orden de pago.
  const orden = [...FIRMAS].sort((a, b) =>
    a.tier === b.tier ? a.n - b.n : a.tier === "vip" ? -1 : 1,
  )

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-2.5 border-b border-border pb-4">
        <span className="gold-tick" />
        <div className="section-eyebrow">El muro · quiénes ya firmaron</div>
        <span className="ml-auto text-xs text-muted-foreground">
          {CANTIDAD} firma{CANTIDAD === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        {orden.map((f) => (
          <Tarjeta key={f.n} f={f} onVer={setAbierto} />
        ))}

        {/* El lugar vacío que sigue: el siguiente en firmar */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lift group flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/25 px-4 py-8 text-center transition-colors hover:border-rojo/50"
        >
          <div className="font-serif-display text-xl italic leading-tight text-muted-foreground/70 md:text-2xl">
            Tu nombre aquí
          </div>
          <div className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-display font-semibold uppercase tracking-[0.2em] text-rojo">
            Firma el Mercedes <ArrowUpRight className="h-3 w-3" />
          </div>
        </a>
      </div>

      <div className="mt-5 flex items-start justify-center gap-2 text-[11px] text-muted-foreground/80">
        <PenLine className="mt-px h-3.5 w-3.5 shrink-0 text-kev-primary" />
        <span className="max-w-lg text-left">
          Cada pago es una firma real que va grabada en la carrocería cuando el reto llegue a la meta. Por $10 tu
          nombre queda en la historia. Los datos de los firmantes van censurados por privacidad.
        </span>
      </div>

      {/* Lightbox — portal a <body> para escapar el stacking context de Reveal */}
      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setAbierto(null)}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setAbierto(null)}
              className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[121] flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={abierto}
              alt="Comprobante de la firma"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
