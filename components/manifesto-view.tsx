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

      {/* Método STRATEGY — bloque negro, acróstico (primero) */}
      <div className="rounded-[var(--radius)] bg-[#0a0a0a] text-white p-6 md:p-8 border border-white/10">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 mb-1">Método STRATEGY</h2>
        <p className="text-sm text-white/55 font-light mb-6">El método con el que voy a construir todo</p>

        {/* Acróstico: STRATEGY en horizontal, cada palabra cae hacia abajo */}
        <div className="flex justify-center gap-2.5 md:gap-5 overflow-x-auto pb-1">
          {strategyMethod.map((s, i) => (
            <div key={i} className="flex flex-col items-center shrink-0">
              {s.word.toUpperCase().split("").map((ch, j) => (
                <span
                  key={j}
                  className={
                    j === 0
                      ? "font-display font-extrabold leading-none text-2xl md:text-4xl text-white mb-2"
                      : "font-display leading-[1.15] text-xs md:text-base text-white/35 uppercase tracking-wide"
                  }
                >
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Definiciones */}
        <div className="mt-8 space-y-2.5 border-t border-white/10 pt-6">
          {strategyMethod.map((s, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="font-display font-extrabold text-white w-4 shrink-0">{s.letter}</span>
              <span>
                <b className="text-white">{s.word}.</b> <span className="text-white/55">{s.desc}</span>
              </span>
            </div>
          ))}
        </div>
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
    </div>
  )
}
