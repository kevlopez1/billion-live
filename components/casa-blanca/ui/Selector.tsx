"use client"

// ──────────────────────────────────────────────────────────────
// Selector de personajes: cada residente con su retrato (los dibuja la escena
// con escena.retratos()), dónde está ahora según la simulación y "Ir" (la
// cámara va y lo sigue). Si está dentro de un edificio, lo dice: la cámara
// se queda afuera. Tocar la tarjeta abre su ficha.
// ──────────────────────────────────────────────────────────────

import { conPrime } from "@/components/prime-mark"
import type { Simulacion } from "../motor/simulacion"
import { dondeEsta } from "../navegacion"
import type { Departamento, Personaje } from "../tipos"
import { FOCO, Hoja, Retrato } from "./base"
import { useLatido } from "./latido"

export function Selector({
  personajes,
  retratos,
  deptos,
  seleccionado,
  sim,
  onElegir,
  onIr,
  onCerrar,
}: {
  personajes: Personaje[]
  retratos: Record<string, string>
  deptos: Record<string, Departamento>
  seleccionado: string | null
  sim?: Simulacion
  onElegir: (id: string) => void
  /** La cámara va y lo sigue. */
  onIr?: (id: string) => void
  onCerrar: () => void
}) {
  useLatido(1500, !!sim)
  return (
    <Hoja titulo="Personajes" onCerrar={onCerrar} ancho={520}>
      <p className="mb-3 text-[12.5px] text-white/55">{personajes.length} residentes. «Ir» lleva la cámara; la tarjeta abre su ficha.</p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {personajes.map((p) => {
          const sel = p.id === seleccionado
          const e = sim?.pj[p.id]
          const donde = e ? dondeEsta(e) : null
          return (
            <li key={p.id} className={`flex items-center gap-1 rounded-[16px] border transition-colors ${sel ? "border-white/50 bg-white/[0.09]" : "border-white/[0.07] bg-white/[0.025] hover:border-white/20"}`}>
              <button type="button" onClick={() => onElegir(p.id)} aria-pressed={sel} className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-[16px] py-2 pl-2 text-left ${FOCO}`}>
                <Retrato p={p} url={retratos[p.id]} tam={44} className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-white">{p.corto}</span>
                  <span className="block truncate text-[10.5px] text-white/45">{conPrime(deptos[p.departamentoId]?.nombre ?? p.rol, false)}</span>
                  {donde && (
                    <span className={`mt-0.5 block truncate text-[11px] font-semibold ${donde.dentro ? "text-amber-200/85" : "text-white/75"}`} title={donde.texto}>
                      {donde.texto}
                    </span>
                  )}
                </span>
              </button>
              {onIr && (
                <button
                  type="button"
                  onClick={() => onIr(p.id)}
                  aria-label={`Ir con ${p.nombre}`}
                  className={`mr-2 shrink-0 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-black transition-transform hover:scale-105 motion-reduce:transform-none ${FOCO}`}
                >
                  Ir
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Hoja>
  )
}
