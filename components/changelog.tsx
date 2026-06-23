"use client"

import { Reveal } from "@/components/reveal"
import { CHALLENGE_LAUNCH } from "@/context/app-context"
import { Radio } from "lucide-react"

type Entry = {
  date: string // AAAA-MM-DD
  title: string
  body: string
  tag?: string
}

// ── LA BITÁCORA DEL RETO ───────────────────────────────────────────────
// Agregá / editá entradas acá (lo más nuevo arriba). Cada entrada es una
// actualización del reto: qué hiciste, qué pasó, un hito. Esto es lo que
// hace que la web se sienta VIVA y que la gente vuelva.
const entries: Entry[] = [
  {
    date: "2026-06-23",
    title: "Día 1 · El relanzamiento",
    body:
      "Vuelvo al reto, ahora en público y desde cero. El contador arranca en $10 — cada peso es revenue real de PRIME, nada inventado. Esta semana: re-promoción en redes y las primeras reuniones con clientes.",
    tag: "🏁 Inicio",
  },
]

const launch = new Date(CHALLENGE_LAUNCH + "T00:00:00").getTime()
const dayNumber = (iso: string) =>
  Math.max(1, Math.floor((new Date(iso + "T00:00:00").getTime() - launch) / 86_400_000) + 1)

function timeAgo(iso: string): string {
  const then = new Date(iso + "T12:00:00").getTime()
  const d = Math.floor(Math.max(0, Date.now() - then) / 86_400_000)
  if (d <= 0) return "hoy"
  if (d === 1) return "ayer"
  if (d < 30) return `hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? "hace 1 mes" : `hace ${m} meses`
}

export function Changelog() {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const last = sorted[0]

  return (
    <div>
      {/* Sello "actualizado hace X" */}
      <Reveal>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <Radio className="w-3.5 h-3.5 text-kev-primary" />
          {last ? `Actualizado ${timeAgo(last.date)}` : "Bitácora del reto"}
        </div>
      </Reveal>

      {/* Línea de tiempo de entradas */}
      <div className="relative pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-foreground/40 via-border to-transparent" />
        <div className="space-y-7">
          {sorted.map((e, i) => (
            <Reveal key={e.date + i} delay={i * 60}>
              <div className="relative">
                <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-foreground border-foreground" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.14em] rounded-full border border-border px-2.5 py-1 text-muted-foreground number-display">
                    Día {dayNumber(e.date)}
                  </span>
                  {e.tag && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{e.tag}</span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {timeAgo(e.date)}
                  </span>
                </div>
                <div className="font-display font-bold tracking-tight text-lg md:text-xl leading-tight mt-1.5">
                  {e.title}
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{e.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
