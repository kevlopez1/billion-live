"use client"

import { useEffect, useState } from "react"
import { useApp, CHALLENGE_TARGET, CHALLENGE_LAUNCH, CHALLENGE_RECORD_DEADLINE } from "@/context/app-context"

// ──────────────────────────────────────────────────────────────
// EDITAR ACÁ: números manuales del reto (actualizá a medida que avanzás).
// El "recaudado", el % y los días se calculan solos.
// ──────────────────────────────────────────────────────────────
const MRR = 0 // ingreso recurrente mensual del reto (USD)
const CLIENTES_RETO = 0 // clientes cerrados DESDE el relanzamiento
const PROPUESTAS = 1 // propuestas enviadas
const EN_NEGOCIACION = 1 // tratos en pipeline
const SEGUIDORES = 1009 // suma de todas las redes

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="lift rounded-2xl border border-border bg-card/60 px-4 py-5 hover:border-foreground/20">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{label}</div>
      <div className="number-display font-extrabold text-4xl md:text-5xl leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow mb-3">{children}</div>
}

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86_400_000))
const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000))

export function ProgressDashboard() {
  const { metrics } = useApp()
  const [huellas, setHuellas] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch("/api/wall", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => typeof d.total === "number" && setHuellas(d.total))
      .catch(() => {})
  }, [])

  const recaudado = metrics.netWorth
  const pct = Math.min((recaudado / CHALLENGE_TARGET) * 100, 100)
  const diaN = mounted ? daysSince(CHALLENGE_LAUNCH) + 1 : 1
  const recordD = mounted ? daysLeft(CHALLENGE_RECORD_DEADLINE) : 0

  return (
    <div className="space-y-8">
      {/* Sello de transparencia */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-kev-primary animate-pulse" />
        Todo real, sin filtros · el contador = revenue real de PRIME
      </div>

      {/* EL RETO */}
      <div>
        <GroupLabel>El reto</GroupLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            value={`$${recaudado.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            label="Recaudado"
            sub="de $450.000"
          />
          <Stat value={`${pct.toFixed(2)}%`} label="Al Mercedes" sub="meta $450K" />
          <Stat value={`${diaN}`} label="Día del reto" sub="desde el relanzamiento" />
          <Stat value={`${recordD}`} label="Días al récord" sub="meta 6 meses" />
        </div>
      </div>

      {/* PRIME (MOTOR) */}
      <div>
        <GroupLabel>PRIME · el motor</GroupLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat value={`$${MRR.toLocaleString("en-US")}`} label="MRR" sub="ingreso recurrente/mes" />
          <Stat value={`${CLIENTES_RETO}`} label="Clientes" sub="cerrados en el reto" />
          <Stat value={`${EN_NEGOCIACION}`} label="En negociación" sub="en el pipeline" />
          <Stat value={`${PROPUESTAS}`} label="Propuestas" sub="enviadas" />
        </div>
      </div>

      {/* ALCANCE */}
      <div>
        <GroupLabel>Alcance · la atención</GroupLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat value={SEGUIDORES.toLocaleString("es-BO")} label="Seguidores" sub="todas las redes" />
          <Stat
            value={mounted && huellas !== null ? huellas.toLocaleString("es-BO") : "—"}
            label="Huellas"
            sub="en el muro del Día 1"
          />
        </div>
      </div>
    </div>
  )
}
