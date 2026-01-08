"use client"

import { useApp } from "@/context/app-context"
import { Calendar, DollarSign, Flag, Star, Globe, Building, Rocket, TrendingUp } from "lucide-react"

const iconMap: Record<string, typeof Flag> = {
  Flag,
  TrendingUp,
  Rocket,
  Star,
  Globe,
  Building,
}

export function JourneyView() {
  const { milestones, metrics, t } = useApp()

  const startYear = milestones.length > 0 ? Number.parseInt(milestones[0].year) : 2015
  const currentYear = new Date().getFullYear()
  const yearsActive = currentYear - startYear
  const progress = (metrics.netWorth / metrics.targetRevenue) * 100
  const netWorthInMillions = (metrics.netWorth / 1_000_000).toFixed(0)
  const remainingInMillions = ((metrics.targetRevenue - metrics.netWorth) / 1_000_000).toFixed(0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">{t.journey.title}</h1>
        <p className="text-muted-foreground">{t.journey.subtitle.replace("${amount}", netWorthInMillions)}</p>
      </div>

      {/* Stats Overview - consistent gap */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-kev-primary number-display">{yearsActive}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t.journey.years}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-kev-primary number-display">
            {Math.floor(metrics.netWorth / 2500).toLocaleString()}x
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t.journey.growth}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-kev-primary number-display">6</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t.journey.countries}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-kev-primary number-display">{progress.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t.journey.towardBillion}</div>
        </div>
      </div>

      {/* Timeline - Fixed mobile alignment */}
      <div className="relative">
        {/* Vertical line - positioned correctly for mobile */}
        <div className="absolute left-[18px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-kev-primary via-kev-primary/50 to-transparent" />

        <div className="space-y-8">
          {milestones.map((milestone, index) => {
            const IconComponent = iconMap[milestone.iconName] || Flag
            const isEven = index % 2 === 0

            return (
              <div key={milestone.id} className="relative flex items-start">
                {/* Timeline dot - fixed position */}
                <div className="absolute left-[18px] md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-kev-primary border-4 border-background z-10 shadow-lg" />

                {/* Content container */}
                <div
                  className={`w-full pl-12 md:pl-0 md:w-1/2 ${isEven ? "md:pr-8 md:text-right" : "md:pl-8 md:ml-auto"}`}
                >
                  <div
                    className={`glass-card p-5 transition-all hover:border-kev-primary/30 ${
                      milestone.highlight ? "!border-kev-primary/40 !bg-kev-primary/5" : ""
                    }`}
                  >
                    <div className={`flex items-center gap-3 mb-3 ${isEven ? "md:flex-row-reverse" : ""}`}>
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          milestone.highlight
                            ? "bg-kev-primary text-white"
                            : "bg-kev-primary/10 border border-kev-primary/20 text-kev-primary"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className={isEven ? "md:text-right" : ""}>
                        <div className={`flex items-center gap-2 ${isEven ? "md:flex-row-reverse" : ""}`}>
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-kev-primary">{milestone.year}</span>
                        </div>
                        <h3 className="font-semibold text-foreground">{milestone.title}</h3>
                      </div>
                    </div>

                    <p
                      className={`text-sm text-muted-foreground leading-relaxed mb-3 ${isEven ? "md:text-right" : ""}`}
                    >
                      {milestone.description}
                    </p>

                    <div className={`flex items-center gap-2 text-sm ${isEven ? "md:justify-end" : ""}`}>
                      <DollarSign className="w-4 h-4 text-kev-success" />
                      <span className="font-semibold text-kev-success number-display">{milestone.netWorth}</span>
                      <span className="text-muted-foreground">{t.journey.netWorth}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Future */}
      <div className="glass-card p-6 text-center !bg-kev-primary/5 !border-kev-primary/20">
        <h3 className="text-lg font-semibold text-foreground mb-2">{t.journey.thePathAhead}</h3>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {t.journey.pathAheadDesc.replace("${amount}", remainingInMillions)}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="h-2 w-48 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-kev-primary to-kev-primary-light rounded-full progress-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-kev-primary">{progress.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
