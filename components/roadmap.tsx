"use client"

import { Reveal } from "@/components/reveal"
import { useApp } from "@/context/app-context"

type Status = "done" | "now" | "next"

interface Milestone {
  title: string
  sub: string
  status: Status
  tag?: string
  amount?: number // si lo tiene, el estado se calcula solo según el contador
}

// La travesía: hitos de dinero (se marcan solos) + hitos de vida (viajes, EE.UU.).
const milestones: Milestone[] = [
  { title: "$10 · El inicio", sub: "Desde la crisis, en cámara.", status: "done", amount: 10 },
  { title: "Escalar PRIME", sub: "Más clientes, más MRR — el motor a fondo", status: "now" },
  { title: "$10.000 recaudado", sub: "Prueba de que el modelo funciona", status: "next", amount: 10_000 },
  { title: "Token2049 · Singapur", sub: "El epicentro cripto, en persona", status: "next", tag: "✈️ Viaje" },
  { title: "$100.000", sub: "Un cuarto del camino al auto", status: "next", amount: 100_000 },
  { title: "Devcon · evento cripto", sub: "Networking de élite mundial", status: "next", tag: "✈️ Viaje" },
  { title: "Silicon Valley · California", sub: "El corazón de la tecnología", status: "next", tag: "✈️ Viaje" },
  { title: "$450.000 · Mercedes-AMG Mansory", sub: "La meta pública del reto", status: "next", tag: "🏁 Meta", amount: 450_000 },
  { title: "Establecerme en Estados Unidos", sub: "Vía O-1 / EB-1A — el objetivo final", status: "next", tag: "🇺🇸 Sueño" },
  { title: "$1.000.000.000 · El imperio", sub: "La capa secreta de largo plazo", status: "next", tag: "🔒 Secreto", amount: 1_000_000_000 },
]

const dot: Record<Status, string> = {
  done: "bg-foreground border-foreground",
  now: "bg-gold border-gold animate-pulse",
  next: "bg-transparent border-foreground/30",
}

const statusChip: Record<Status, { label: string; cls: string }> = {
  done: { label: "Logrado", cls: "border-foreground/30 text-foreground" },
  now: { label: "En curso", cls: "border-foreground/40 text-foreground bg-foreground/10" },
  next: { label: "Próximo", cls: "border-border text-muted-foreground" },
}

export function Roadmap() {
  const { metrics } = useApp()
  const net = metrics.netWorth

  // Los hitos con monto se marcan solos según el contador.
  const resolved = milestones.map((m) => {
    if (m.amount == null) return m
    return { ...m, status: (net >= m.amount ? "done" : "next") as Status }
  })

  return (
    <div className="relative pl-6">
      {/* Línea vertical */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-foreground/40 via-border to-transparent" />

      <div className="space-y-7">
        {resolved.map((m, i) => (
          <Reveal key={i} delay={i * 50}>
            <div className="relative">
              {/* Punto */}
              <span
                className={`absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${dot[m.status]}`}
              />
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className={m.status === "next" ? "opacity-70" : ""}>
                  <div className="font-display font-bold tracking-tight text-lg md:text-xl leading-tight">
                    {m.title}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{m.sub}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.tag && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{m.tag}</span>
                  )}
                  <span
                    className={`text-[10px] uppercase tracking-[0.14em] rounded-full border px-2.5 py-1 ${statusChip[m.status].cls}`}
                  >
                    {statusChip[m.status].label}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
