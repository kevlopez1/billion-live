"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { Target, Eye, Crown, Scale, Rocket } from "lucide-react"

const iconMap: Record<string, typeof Scale> = {
  Scale,
  Rocket,
  Crown,
  Target,
  Eye,
}

// Método STRATEGY — el método de Kev para llegar a los $1.000.000.000.
const strategyMethod = [
  { letter: "S", word: "Singularidad", desc: "Ser irrepetible: el único que hace esto, así, desde acá." },
  { letter: "T", word: "Timing", desc: "Lo correcto en el momento correcto. La ola antes que la multitud." },
  { letter: "R", word: "Rapidez", desc: "Velocidad de ejecución como ventaja injusta." },
  { letter: "A", word: "Apalancamiento", desc: "Que cada esfuerzo rinda 10x, 100x, 1000x." },
  { letter: "T", word: "Tangible", desc: "Resultados reales, medibles, demostrables. Nada de humo." },
  { letter: "E", word: "Energía", desc: "El combustible diario que sostiene la consistencia." },
  { letter: "G", word: "Garganta", desc: "La voz: comunicar, vender, convencer, mover gente." },
  { letter: "Y", word: "Yo", desc: "Todo empieza y termina en uno. La responsabilidad es propia." },
]

export function ManifestoView() {
  const [expandedPrinciple, setExpandedPrinciple] = useState<string | null>(null)
  const { manifesto, t } = useApp()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-3 text-balance">
          {t.manifesto.title}
        </h1>
        <p className="text-muted-foreground font-light text-pretty">{t.manifesto.subtitle}</p>
      </div>

      {/* Mission, Vision, Purpose - using dynamic content */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Target className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{t.manifesto.mission}</h3>
          <p className="text-foreground font-medium leading-relaxed">{manifesto.mission}</p>
        </div>

        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{t.manifesto.vision}</h3>
          <p className="text-foreground font-medium leading-relaxed">{manifesto.vision}</p>
        </div>

        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{t.manifesto.purpose}</h3>
          <p className="text-foreground font-medium leading-relaxed">{manifesto.purpose}</p>
        </div>
      </div>

      {/* Core Principles - 3 Pillars using dynamic content */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
          {t.manifesto.threePillars}
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {manifesto.principles.map((principle) => {
            const IconComponent = iconMap[principle.iconName] || Scale
            return (
              <div
                key={principle.id}
                className={`glass-card p-5 cursor-pointer transition-all duration-500 ${
                  expandedPrinciple === principle.id
                    ? "md:col-span-3 !border-kev-primary/40"
                    : "hover:border-kev-primary/30"
                }`}
                onClick={() => setExpandedPrinciple(expandedPrinciple === principle.id ? null : principle.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center shrink-0">
                    <IconComponent className="w-6 h-6 text-kev-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg mb-1">{principle.title}</h3>
                    <p className="text-sm text-muted-foreground">{principle.shortDesc}</p>

                    {expandedPrinciple === principle.id && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-foreground leading-relaxed">{principle.fullDesc}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Método STRATEGY — bloque negro */}
      <div className="rounded-[var(--radius)] bg-[#0a0a0a] text-white p-6 md:p-8">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 mb-1">Método STRATEGY</h2>
        <p className="text-sm text-white/55 font-light mb-5">El método con el que voy a construir todo</p>
        <div className="rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {strategyMethod.map((s, i) => (
            <div key={i} className="flex items-center gap-5 md:gap-8 px-5 md:px-7 py-5 group hover:bg-white/[0.04] transition-colors">
              <span className="text-3xl md:text-4xl font-light number-display text-white/35 w-8 shrink-0 text-center group-hover:text-white transition-colors">
                {s.letter}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white">{s.word}</div>
                <div className="text-sm text-white/55 font-light mt-0.5 text-pretty">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
