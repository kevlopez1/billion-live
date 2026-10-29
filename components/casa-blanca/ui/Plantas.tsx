"use client"

// ──────────────────────────────────────────────────────────────
// Adentro de un edificio: qué planta se ve, las demás plantas que ya se
// pueden recorrer y "Salir" (vuelve a la vista de afuera). Sale de plantas.ts.
// ──────────────────────────────────────────────────────────────

import { LogOut } from "lucide-react"
import { NOMBRE_EDIFICIO, PLANTA, plantasDe, type PlantaId } from "../plantas"
import { Boton, VIDRIO } from "./base"

export function BarraPlanta({ planta, onPlanta, onSalir }: { planta: PlantaId; onPlanta: (p: PlantaId) => void; onSalir: () => void }) {
  const p = PLANTA[planta]
  const plantas = plantasDe(p.edificio)
  return (
    <nav aria-label={`Plantas de ${NOMBRE_EDIFICIO[p.edificio]}`} className={`pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full p-1 ${VIDRIO}`}>
      <span className="cb-cond shrink-0 pl-3 pr-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">{NOMBRE_EDIFICIO[p.edificio]}</span>
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {plantas.map((x) => (
          <Boton key={x.id} activo={x.id === planta} onClick={() => onPlanta(x.id)} etiqueta={x.nombre} className="shrink-0 whitespace-nowrap">
            {x.nombre}
          </Boton>
        ))}
      </div>
      <Boton onClick={onSalir} etiqueta="Salir del edificio" className="shrink-0">
        <LogOut className="h-3.5 w-3.5" />
        Salir
      </Boton>
    </nav>
  )
}
