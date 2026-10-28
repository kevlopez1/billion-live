"use client"

// ──────────────────────────────────────────────────────────────
// Modo grabación: cuadro vertical 9:16 limpio para grabar la pantalla y
// tener el reel. Dentro del cuadro solo van los subtítulos grandes y una
// marca discreta. Los controles quedan FUERA del cuadro en computadora (en
// la banda negra de la izquierda) y en celular aparecen al tocar y se van
// solos a los 3 segundos.
// ──────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { FOCO, VIDRIO } from "./base"

export interface Toma {
  id: string
  nombre: string
}

/**
 * Las tomas de la spec, en orden (más el descenso a la ciudad). La lista de verdad la da el motor
 * (escena.tomas()); esta es la de respaldo mientras la escena no la entregó.
 */
export const TOMAS: ReadonlyArray<Toma> = [
  { id: "portico-norte", nombre: "Pórtico Norte" },
  { id: "dron", nombre: "Dron sobre el complejo" },
  { id: "bajada", nombre: "Bajada al subsuelo" },
  { id: "departamento", nombre: "Un departamento por dentro" },
  { id: "seguir", nombre: "Detrás de un personaje" },
  { id: "sala-guerra", nombre: "Sala de guerra" },
  { id: "ciudad", nombre: "Descenso a la ciudad" },
  { id: "maqueta", nombre: "Modo maqueta" },
]

export function MarcaGrabacion() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(18px,env(safe-area-inset-top))] z-20 flex justify-center">
      <span className="cb-cond cb-sombra text-[12px] font-bold uppercase tracking-[0.42em] text-white/85">La Casa Blanca Project</span>
    </div>
  )
}

export function ControlesGrabacion({
  tomas,
  toma,
  onToma,
  onSalir,
  compacto,
}: {
  tomas: ReadonlyArray<Toma>
  toma: string
  onToma: (id: string) => void
  onSalir: () => void
  compacto: boolean
}) {
  const [visible, setVisible] = useState(true)

  // En celular se esconden solos; un toque en cualquier lado los trae.
  useEffect(() => {
    if (!compacto) return
    let t = window.setTimeout(() => setVisible(false), 3000)
    const mostrar = () => {
      setVisible(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setVisible(false), 3000)
    }
    window.addEventListener("pointerdown", mostrar)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("pointerdown", mostrar)
    }
  }, [compacto])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSalir()
      const n = Number(e.key)
      if (n >= 1 && n <= tomas.length) onToma(tomas[n - 1].id)
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [onSalir, onToma, tomas])

  const lista = (
    <ol className="flex flex-col gap-1">
      {tomas.map((t, i) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onToma(t.id)}
            aria-pressed={toma === t.id}
            className={`flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] font-semibold transition-colors ${FOCO} ${
              toma === t.id ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
            }`}
          >
            <span className="cb-cond w-4 text-[13px] font-bold opacity-60">{i + 1}</span>
            {t.nombre}
          </button>
        </li>
      ))}
    </ol>
  )

  if (!compacto) {
    return (
      <aside aria-label="Tomas de grabación" className={`pointer-events-auto absolute left-6 top-1/2 z-40 w-[230px] -translate-y-1/2 rounded-[24px] p-3 ${VIDRIO}`}>
        <div className="mb-2 flex items-center gap-2 px-2 pt-1">
          <span className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden />
          <span className="cb-cond flex-1 text-[12px] font-bold uppercase tracking-[0.24em] text-white">Grabación 9:16</span>
        </div>
        {lista}
        <button
          type="button"
          onClick={onSalir}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-white/15 px-3 py-2 text-[12px] font-bold text-white/80 hover:bg-white/10 ${FOCO}`}
        >
          <X className="h-3.5 w-3.5" /> Salir
        </button>
        <p className="mt-2 px-2 text-[10.5px] leading-snug text-white/40">Teclas 1 a {tomas.length} cambian de toma. Esc sale.</p>
      </aside>
    )
  }

  return (
    <div
      className={`pointer-events-auto absolute inset-x-3 top-[max(48px,calc(env(safe-area-inset-top)+40px))] z-40 transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className={`rounded-[22px] p-2 ${VIDRIO}`}>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] touch-pan-x">
          {tomas.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onToma(t.id)}
              aria-pressed={toma === t.id}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${FOCO} ${toma === t.id ? "bg-white text-black" : "text-white/80"}`}
            >
              {i + 1}. {t.nombre}
            </button>
          ))}
          <button type="button" onClick={onSalir} aria-label="Salir de la grabación" className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold text-white ${FOCO}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
