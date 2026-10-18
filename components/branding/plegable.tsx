"use client"

import { useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

// Bloque que se abre y se cierra, como un toggle de Notion. Los formatos de
// video son 10 y cada uno trae sus pasos: desplegados todos, la página es un
// muro de texto y no se puede comparar nada.
export function Plegable({
  titulo,
  subtitulo,
  etiqueta,
  children,
  abiertoPorDefecto = false,
}: {
  titulo: string
  subtitulo?: string
  etiqueta?: string
  children: ReactNode
  abiertoPorDefecto?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-foreground/[0.03] md:px-5"
      >
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {etiqueta && (
              <span className="shrink-0 text-[11px] font-display font-bold tabular-nums text-gold">{etiqueta}</span>
            )}
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground md:text-base">
              {titulo}
            </span>
          </span>
          {subtitulo && <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{subtitulo}</span>}
        </span>
      </button>
      {abierto && <div className="border-t border-border px-4 py-4 md:px-5">{children}</div>}
    </div>
  )
}
