"use client"

import { useApp, CHALLENGE_TARGET } from "@/context/app-context"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Briefcase, Car } from "lucide-react"

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {dynamicMetrics.map((metric) => (
        <div key={metric.label} className="glass-card p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 bg-kev-primary/10 border border-kev-primary/20 rounded-lg">
              <metric.icon className="w-4 h-4 text-kev-primary" />
            </div>
            <div
              className={`flex items-center gap-0.5 text-xs font-medium ${
                metric.trend === "up" ? "text-kev-success" : "text-kev-danger"
              }`}
            >
              {metric.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {metric.change}
            </div>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight number-display">{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
