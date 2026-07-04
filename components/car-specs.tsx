"use client"

import { Reveal } from "@/components/reveal"
import { Zap, Gauge, Timer, Wind } from "lucide-react"

// Specs del Mercedes-AMG GT 63 S E Performance (4 puertas) — el auto base.
// La personalización es según el catálogo oficial Mansory (kit de carbono,
// llantas forjadas, interior a medida).
const stats = [
  { icon: Zap, value: "831 hp", label: "Potencia · 843 CV" },
  { icon: Gauge, value: "1.470 Nm", label: "Par máximo" },
  { icon: Timer, value: "2,9 s", label: "0–100 km/h" },
  { icon: Wind, value: "316 km/h", label: "Velocidad máx." },
]

const mansory = [
  "Kit aerodinámico completo en fibra de carbono: capó, splitter frontal, difusor, alerón y faldones.",
  "Llantas forjadas Mansory de 21″ / 22″ (modelos FY.5, FD.15, BY.5).",
  "Interior a medida en cuero exclusivo, cielo estrellado RGB y volante deportivo en carbono.",
  "Sistema de escape Mansory con control remoto.",
  "Pintura verde mate — la firma del auto.",
]

export function CarSpecs() {
  return (
    <div>
      <Reveal>
        <div className="mb-6">
          <h3 className="font-display font-extrabold tracking-tight text-xl md:text-2xl">
            Mercedes-AMG GT 63 S E Performance
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            4 puertas · tracción integral 4MATIC+ · híbrido V8 biturbo — personalizado por{" "}
            <span className="text-foreground font-semibold">Mansory</span>. Objetivo: ≈ $450.000.
          </p>
        </div>
      </Reveal>

      {/* Specs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <div className="lift rounded-2xl border border-border bg-card/40 px-4 py-5 h-full hover:border-foreground/20">
              <s.icon className="w-5 h-5 text-gold mb-2.5" strokeWidth={1.75} />
              <div className="number-display font-extrabold text-3xl md:text-4xl leading-none">{s.value}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mt-2">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* El toque Mansory */}
      <Reveal delay={120}>
        <div className="mt-4 rounded-2xl border border-border bg-card/40 px-5 py-6 md:px-7 md:py-7">
          <div className="section-eyebrow mb-4">El toque Mansory</div>
          <ul className="space-y-3">
            {mansory.map((m) => (
              <li key={m} className="flex gap-3 text-sm">
                <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gold" />
                <span className="text-muted-foreground leading-relaxed">{m}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground/70 mt-5 leading-relaxed">
            Cifras del modelo base (AMG GT 63 S E Performance). Personalización según el catálogo
            oficial de Mansory para el AMG GT 63 S 4-Door.
          </p>
        </div>
      </Reveal>
    </div>
  )
}
