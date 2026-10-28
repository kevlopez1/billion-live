"use client"

// ──────────────────────────────────────────────────────────────
// Un lugar tocado en la escena: su nombre, su dato real (o "ficción") y
// quién está ahí ahora mismo según la simulación.
// ──────────────────────────────────────────────────────────────

import { conPrime } from "@/components/prime-mark"
import { NOMBRE_NIVEL, type Lugar, type Personaje } from "../tipos"
import type { Simulacion } from "../motor/simulacion"
import { FOCO, Hoja, Retrato, Rotulo } from "./base"
import { useLatido } from "./latido"

export function PanelLugar({
  lugar,
  sim,
  personajes,
  retratos,
  onPersonaje,
  onCerrar,
}: {
  lugar: Lugar
  sim: Simulacion
  personajes: Record<string, Personaje>
  retratos: Record<string, string>
  onPersonaje: (id: string) => void
  onCerrar: () => void
}) {
  useLatido(1000)
  const presentes = sim.presentes(lugar.id).filter((id) => personajes[id])
  const cabecera = (
    <div>
      <div className="cb-cond text-[11px] font-bold uppercase tracking-[0.24em] text-white/50">{NOMBRE_NIVEL[lugar.nivel]}</div>
      <h2 className="cb-cond mt-1 text-[26px] font-bold uppercase leading-none tracking-[0.02em] text-white">{lugar.nombre}</h2>
    </div>
  )
  return (
    <Hoja titulo={lugar.nombre} cabecera={cabecera} onCerrar={onCerrar} ancho={400}>
      {lugar.ficcion && (
        <span className="mb-3 inline-flex rounded-full border border-white/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/60">Ficción</span>
      )}
      <p className="text-[13px] leading-relaxed text-white/80">{conPrime(lugar.dato)}</p>
      <Rotulo className="mb-2 mt-5">Aquí ahora</Rotulo>
      {presentes.length === 0 ? (
        <p className="text-[12px] text-white/45">No hay nadie en este momento.</p>
      ) : (
        <ul className="space-y-1">
          {presentes.map((id) => {
            const p = personajes[id]
            return (
              <li key={id}>
                <button type="button" onClick={() => onPersonaje(id)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.06] ${FOCO}`}>
                  <Retrato p={p} url={retratos[id]} tam={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-white">{p.nombre}</span>
                    <span className="block truncate text-[11px] text-white/50">{sim.pj[id]?.actividad}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Hoja>
  )
}
