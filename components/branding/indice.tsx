"use client"

import { useEffect, useState } from "react"

// ──────────────────────────────────────────────────────────────
// El índice del manual: el "mapa" del mapa mental.
//
// En pantalla grande queda fijo a la izquierda y marca dónde estás.
// En el celular se vuelve una barra pegada arriba que se despliega, porque
// un índice fijo de 9 entradas se come media pantalla.
// ──────────────────────────────────────────────────────────────

export type Entrada = { id: string; nombre: string }

export function Indice({ entradas }: { entradas: Entrada[] }) {
  const [activa, setActiva] = useState(entradas[0]?.id ?? "")
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    // rootMargin recorta la ventana a una franja superior: así se marca la
    // sección que está arriba, no la que apenas asoma por abajo.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiva(visible.target.id)
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    )
    entradas.forEach((e) => {
      const el = document.getElementById(e.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [entradas])

  const ir = (id: string) => {
    setAbierto(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      {/* Celular: barra pegada arriba */}
      <div className="sticky top-0 z-30 -mx-5 mb-6 border-b border-border bg-background px-5 py-3 lg:hidden">
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={abierto}
        >
          <span className="text-[11px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Índice
          </span>
          <span className="truncate pl-3 text-[13px] text-foreground">
            {entradas.find((e) => e.id === activa)?.nombre ?? entradas[0]?.nombre}
          </span>
        </button>
        {abierto && (
          <nav className="mt-3 flex flex-col gap-0.5 pb-1">
            {entradas.map((e) => (
              <button
                key={e.id}
                onClick={() => ir(e.id)}
                className={`rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                  e.id === activa ? "bg-foreground/[0.07] font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {e.nombre}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Escritorio: columna fija */}
      <nav className="sticky top-10 hidden h-fit w-56 shrink-0 flex-col gap-0.5 lg:flex">
        <span className="mb-2 px-3 text-[11px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Índice
        </span>
        {entradas.map((e) => (
          <button
            key={e.id}
            onClick={() => ir(e.id)}
            className={`rounded-lg px-3 py-1.5 text-left text-[14px] leading-snug transition-colors ${
              e.id === activa
                ? "bg-foreground/[0.07] font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {e.nombre}
          </button>
        ))}
      </nav>
    </>
  )
}
