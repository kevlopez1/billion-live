"use client"

import { CheckCircle2, Flame } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// EDITAR ACÁ: clientes y pipeline de PRIME.
// activeClients = cuántos clientes ya pagan.
// pipeline = tratos en proceso. status: "propuesta" | "negociacion" | "cerrado".
// Para nombrar a un prospecto públicamente, cambiá "name" (con su permiso).
// ──────────────────────────────────────────────────────────────
const activeClients = 2

const pipeline: { name: string; note: string; status: "propuesta" | "negociacion" | "cerrado" }[] = [
  {
    name: "Cerámica líder · Santa Cruz",
    note: "Propuesta comercial + CRM con IA",
    status: "negociacion",
  },
]

const statusChip: Record<string, { label: string; cls: string }> = {
  propuesta: { label: "Propuesta enviada", cls: "border-border text-muted-foreground" },
  negociacion: { label: "En negociación", cls: "border-foreground/30 text-foreground bg-foreground/[0.04]" },
  cerrado: { label: "Cerrado ✓", cls: "border-foreground/40 text-foreground bg-foreground/10" },
}

export function PrimePipeline() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="section-eyebrow">PRIME · ventas en público</div>
          <h3 className="mt-2 font-display font-bold tracking-tight text-xl md:text-2xl">Clientes & Pipeline</h3>
        </div>
      </div>

      {/* Clientes activos (stat grande, estilo LATHOS) */}
      <div className="rounded-2xl border border-border bg-card/60 px-5 py-5 flex items-center gap-4">
        <CheckCircle2 className="w-7 h-7 text-foreground shrink-0" strokeWidth={1.75} />
        <div>
          <div className="flex items-baseline gap-2">
            <span className="number-display font-extrabold text-4xl md:text-5xl leading-none">{activeClients}</span>
            <span className="text-sm text-muted-foreground">clientes activos</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Pagando hoy · alimentan el contador</div>
        </div>
      </div>

      {/* En el horno (pipeline) */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          <Flame className="w-3 h-3" /> En el horno
        </div>
        <div className="space-y-2.5">
          {pipeline.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3.5"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm md:text-base truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.note}</div>
              </div>
              <span
                className={`shrink-0 text-[10px] uppercase tracking-[0.14em] rounded-full border px-2.5 py-1 ${statusChip[d.status].cls}`}
              >
                {statusChip[d.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
