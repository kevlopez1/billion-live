"use client"

// ──────────────────────────────────────────────────────────────
// Objetivos y "En marcha". Todo es real: el Mercedes se mide con el contador
// del reto; los demás objetivos, con los entregables guardados; y "En marcha"
// muestra a los líderes que están en su departamento AHORA en la simulación
// y los últimos entregables de verdad. Si no hay entregables, lo dice.
// ──────────────────────────────────────────────────────────────

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import type { Departamento, Entregable, Objetivo, Personaje } from "../tipos"
import { Barra, FOCO, Rotulo, VIDRIO } from "./base"
import { haceCuanto, pct, recortar } from "./formato"

export interface EnMarcha {
  dep: Departamento
  lider: Personaje | undefined
  /** "lider" = el líder está en su departamento; "kev" = trabajando ahora por pedido de Kev. */
  motivo: "lider" | "kev"
  actividad: string
}

export function ListaObjetivos({
  objetivos,
  progreso,
}: {
  objetivos: Objetivo[]
  progreso: (o: Objetivo) => { valor: number; texto: string }
}) {
  return (
    <ul className="space-y-3.5">
      {objetivos.map((o, i) => {
        const p = progreso(o)
        return (
          <li key={o.id}>
            <div className="flex items-baseline gap-2">
              <span className="cb-cond text-[13px] font-bold tabular-nums text-white/40">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-white">{conPrime(o.titulo)}</span>
              <span className="cb-cond text-[14px] font-bold tabular-nums text-white/90">{pct(p.valor)}</span>
            </div>
            <div className="mt-1.5 pl-6">
              <Barra valor={p.valor} color={o.metrica === "recaudado" ? "#6fd27c" : "#f2c14e"} />
              <p className="mt-1 text-[11px] text-white/50">{p.texto}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ListaEnMarcha({
  enMarcha,
  recientes,
  deptos,
  onDep,
}: {
  enMarcha: EnMarcha[]
  recientes: Entregable[]
  deptos: Record<string, Departamento>
  onDep: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Rotulo className="mb-2">Trabajando ahora</Rotulo>
        {enMarcha.length === 0 ? (
          <p className="text-[12px] text-white/45">Ningún líder está en su departamento a esta hora.</p>
        ) : (
          <ul className="space-y-1">
            {enMarcha.slice(0, 6).map((m) => (
              <li key={m.dep.id}>
                <button
                  type="button"
                  onClick={() => onDep(m.dep.id)}
                  className={`flex w-full items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left hover:bg-white/[0.06] ${FOCO}`}
                >
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inset-0 rounded-full motion-safe:animate-ping" style={{ background: m.dep.color, opacity: 0.55 }} />
                    <span className="relative h-2 w-2 rounded-full" style={{ background: m.dep.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-white">{conPrime(m.dep.nombre, false)}</span>
                    <span className="block truncate text-[11px] text-white/50">
                      {m.lider?.corto ?? "—"} · {m.motivo === "kev" ? "trabajando en un objetivo" : m.actividad}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <Rotulo className="mb-2">Entregables recientes</Rotulo>
        {recientes.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-white/45">Todavía no hay entregables guardados. Cuando un departamento entregue algo, aparece aquí.</p>
        ) : (
          <ul className="space-y-2">
            {recientes.slice(0, 4).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onDep(e.departamentoId)} className={`w-full rounded-[12px] px-2 py-1 text-left hover:bg-white/[0.06] ${FOCO}`}>
                  <span className="block text-[12.5px] font-semibold leading-snug text-white">{conPrime(recortar(e.titulo, 90), false)}</span>
                  <span className="block truncate text-[11px] text-white/45">
                    {deptos[e.departamentoId]?.nombre ?? e.departamentoId} · {e.agenteNombre} · {haceCuanto(e.creado)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** La columna derecha en computadora: objetivos arriba, "En marcha" abajo. Se pliega. */
export function ColumnaObjetivos(props: {
  objetivos: Objetivo[]
  progreso: (o: Objetivo) => { valor: number; texto: string }
  enMarcha: EnMarcha[]
  recientes: Entregable[]
  deptos: Record<string, Departamento>
  onDep: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(true)
  const [marcha, setMarcha] = useState(true)
  return (
    <div className="pointer-events-auto flex max-h-full w-[300px] flex-col gap-2.5">
      <section className={`rounded-[22px] ${VIDRIO}`}>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className={`flex w-full items-center gap-2 rounded-[22px] px-4 py-3 text-left ${FOCO}`}
        >
          <span className="cb-cond flex-1 text-[13px] font-bold uppercase tracking-[0.2em] text-white">Objetivos</span>
          <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${abierto ? "" : "-rotate-90"}`} />
        </button>
        {abierto && (
          <div className="px-4 pb-4">
            <ListaObjetivos objetivos={props.objetivos} progreso={props.progreso} />
          </div>
        )}
      </section>
      <section className={`flex min-h-0 flex-col rounded-[22px] ${VIDRIO}`}>
        <button
          type="button"
          onClick={() => setMarcha((v) => !v)}
          aria-expanded={marcha}
          className={`flex w-full items-center gap-2 rounded-[22px] px-4 py-3 text-left ${FOCO}`}
        >
          <span className="cb-cond flex-1 text-[13px] font-bold uppercase tracking-[0.2em] text-white">En marcha</span>
          <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${marcha ? "" : "-rotate-90"}`} />
        </button>
        {marcha && (
          <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-width:thin]">
            <ListaEnMarcha enMarcha={props.enMarcha} recientes={props.recientes} deptos={props.deptos} onDep={props.onDep} />
          </div>
        )}
      </section>
    </div>
  )
}
