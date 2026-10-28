"use client"

// ──────────────────────────────────────────────────────────────
// Selector de personajes: la grilla de retratos (los dibuja la escena con
// escena.retratos()). Al elegir uno, la cámara lo sigue y se abre su ficha.
// ──────────────────────────────────────────────────────────────

import { conPrime } from "@/components/prime-mark"
import type { Departamento, Personaje } from "../tipos"
import { FOCO, Hoja, Retrato } from "./base"

export function Selector({
  personajes,
  retratos,
  deptos,
  seleccionado,
  onElegir,
  onCerrar,
}: {
  personajes: Personaje[]
  retratos: Record<string, string>
  deptos: Record<string, Departamento>
  seleccionado: string | null
  onElegir: (id: string) => void
  onCerrar: () => void
}) {
  return (
    <Hoja titulo="Personajes" onCerrar={onCerrar} ancho={460}>
      <p className="mb-4 text-[12.5px] text-white/55">{personajes.length} residentes. Toca uno para seguirlo y abrir su ficha.</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {personajes.map((p) => {
          const sel = p.id === seleccionado
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onElegir(p.id)}
                aria-pressed={sel}
                className={`group flex w-full flex-col items-center gap-1.5 rounded-2xl border px-1.5 pb-2 pt-3 text-center transition-colors ${FOCO} ${
                  sel ? "border-white/60 bg-white/[0.1]" : "border-transparent hover:border-white/15 hover:bg-white/[0.05]"
                }`}
              >
                <Retrato p={p} url={retratos[p.id]} tam={56} className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none" />
                <span className="w-full truncate text-[12px] font-bold text-white">{p.corto}</span>
                <span className="line-clamp-2 w-full text-[10px] leading-tight text-white/45">
                  {conPrime(deptos[p.departamentoId]?.nombre ?? p.rol, false)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Hoja>
  )
}
