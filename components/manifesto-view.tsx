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

export function ManifestoView() {
  const [expandedPrinciple, setExpandedPrinciple] = useState<string | null>(null)
  const { manifesto, t } = useApp()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">{t.manifesto.title}</h1>
        <p className="text-muted-foreground">{t.manifesto.subtitle}</p>
      </div>

      {/* Mission, Vision, Purpose - using dynamic content */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Target className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-kev-primary font-medium mb-2">{t.manifesto.mission}</h3>
          <p className="text-foreground font-medium leading-relaxed">{manifesto.mission}</p>
        </div>

        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-kev-primary font-medium mb-2">{t.manifesto.vision}</h3>
          <p className="text-foreground font-medium leading-relaxed">{manifesto.vision}</p>
        </div>

        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-kev-primary" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-kev-primary font-medium mb-2">{t.manifesto.purpose}</h3>
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

      {/* Quote Section - using dynamic content */}
      <div className="glass-card p-8 text-center !bg-kev-primary/5 !border-kev-primary/20">
        <blockquote className="text-xl md:text-2xl font-medium text-foreground italic mb-4">
          "{manifesto.quote}"
        </blockquote>
        <cite className="text-sm text-kev-primary font-medium">— {manifesto.quoteAuthor}</cite>
      </div>
    </div>
  )
}
