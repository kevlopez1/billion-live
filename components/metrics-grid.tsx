"use client"

import { useApp, CHALLENGE_TARGET } from "@/context/app-context"
import { DollarSign, BarChart3, Briefcase, Car } from "lucide-react"

export function MetricsGrid() {
  const { metrics } = useApp()

  // Revenue real de PRIME = el contador del reto.
  const revenue = metrics.netWorth
  // Progreso hacia el Mercedes-AMG Mansory.
  const progress = Math.min(Math.max((revenue / CHALLENGE_TARGET) * 100, 0), 100)

  const dynamicMetrics = [
    {
      label: "Revenue PRIME",
      value: `$${revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      change: `${metrics.monthlyGrowth >= 0 ? "+" : ""}${metrics.monthlyGrowth}%`,
      trend: metrics.monthlyGrowth >= 0 ? ("up" as const) : ("down" as const),
      period: "vs mes anterior",
      icon: DollarSign,
    },
    {
      label: "Marcas activas",
      value: metrics.activeProjects.toString(),
      change: "PRIME · KEV · IU · @Kev",
      trend: "up" as const,
      period: "el ecosistema",
      icon: Briefcase,
    },
    {
      label: "Progreso al auto",
      value: `${progress.toFixed(2)}%`,
      change: "Mansory AMG GT",
      trend: "up" as const,
      period: "meta $450K",
      icon: Car,
    },
    {
      label: "ROI PRIME",
      value: `${(metrics.roi || 0).toFixed(1)}%`,
      change: `${(metrics.roi || 0) >= 0 ? "+" : ""}${(metrics.roi || 0).toFixed(1)}%`,
      trend: (metrics.roi || 0) >= 0 ? ("up" as const) : ("down" as const),
      period: "moat = datos + nicho",
      icon: BarChart3,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {dynamicMetrics.map((metric) => (
        <div key={metric.label} className="glass-card p-5 md:p-6 hover-lift">
          <div className="flex items-center gap-2 mb-5 text-muted-foreground">
            <metric.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-[0.16em]">{metric.label}</span>
          </div>
          <p
            className={`text-3xl md:text-4xl tracking-tight number-display ${
              metric.label === "Revenue PRIME"
                ? "text-accent-gradient font-medium"
                : "text-foreground font-light"
            }`}
          >
            {metric.value}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 font-light truncate">{metric.period}</p>
        </div>
      ))}
    </div>
  )
}
