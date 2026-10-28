"use client"

// ──────────────────────────────────────────────────────────────
// La pantalla de título mientras corre escena.intro(): franjas de cine, el
// nombre grande y "Saltar". El título se va a mitad del plano para que se
// vea el vuelo de la cámara; las franjas se retiran al terminar.
// ──────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { SkipForward } from "lucide-react"
import { FOCO } from "./base"
import { miles } from "./formato"

export function Intro({ onSaltar, saliendo, residentes, departamentos }: { onSaltar: () => void; saliendo: boolean; residentes: number; departamentos: number }) {
  const [titulo, setTitulo] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setTitulo(false), 6200)
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onSaltar()
    }
    window.addEventListener("keydown", tecla)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", tecla)
    }
  }, [onSaltar])

  return (
    <div className={`cb-intro pointer-events-none absolute inset-0 z-30 ${saliendo ? "cb-intro-sale" : ""}`}>
      <div className="cb-franja cb-franja-arriba absolute inset-x-0 top-0 h-[9vh] bg-black" />
      <div className="cb-franja cb-franja-abajo absolute inset-x-0 bottom-0 h-[9vh] bg-black" />

      <div
        className={`absolute inset-x-0 bottom-[16vh] px-6 transition-opacity duration-1000 md:bottom-[18vh] md:px-16 ${titulo && !saliendo ? "opacity-100" : "opacity-0"}`}
      >
        <p className="cb-titulo-in cb-cond text-[11px] font-semibold uppercase tracking-[0.5em] text-white/75 md:text-[13px]">Una ficción interactiva</p>
        <h1 className="cb-titulo-in cb-cond cb-titulo mt-3 text-[15vw] font-extrabold uppercase leading-[0.82] tracking-[0.01em] text-white md:text-[8.6vw]" style={{ animationDelay: "250ms" }}>
          La Casa Blanca
          <span className="block text-[0.42em] font-semibold tracking-[0.62em] text-white/90">Project</span>
        </h1>
        <p className="cb-titulo-in mt-5 text-[12px] font-semibold tracking-[0.08em] text-white/75 md:text-[14px]" style={{ animationDelay: "650ms" }}>
          {residentes} residentes · {departamentos} departamentos · {miles(departamentos * 100)} agentes de IA · objetivos reales
        </p>
      </div>

      <button
        type="button"
        onClick={onSaltar}
        className={`pointer-events-auto absolute bottom-[calc(9vh+16px)] right-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur hover:bg-white hover:text-black md:right-10 ${FOCO}`}
      >
        Saltar <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
