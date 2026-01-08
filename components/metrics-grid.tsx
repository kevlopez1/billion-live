"use client"

import { useApp } from "@/context/app-context"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Briefcase } from "lucide-react"

export function MetricsGrid() {
  const { metrics, projects } = useApp()

  const totalValue = projects.reduce((sum, p) => sum + p.value, 0)
  const avgROI = projects.reduce((sum, p) => sum + p.change, 0) / projects.length

  const dynamicMetrics = [
    {
      label: "Revenue",
      value: `$${(totalValue / 1_000_000).toFixed(1)}M`,
      change: `+${metrics.monthlyGrowth}%`,
      trend: "up" as const,
      period: "vs last month",
      icon: DollarSign,
    },
    {
      label: "Active Projects",
      value: metrics.activeProjects.toString(),
      change: "+2",
      trend: "up" as const,
      period: "this quarter",
      icon: Briefcase,
    },
    {
      label: "Avg ROI",
      value: `${avgROI.toFixed(1)}%`,
      change: `+${(avgROI * 0.15).toFixed(1)}%`,
      trend: avgROI > 0 ? ("up" as const) : ("down" as const),
      period: "vs last month",
      icon: BarChart3,
    },
    {
      label: "YTD Return",
      value: `${metrics.ytdReturn}%`,
      change: `+${(metrics.ytdReturn * 0.1).toFixed(1)}%`,
      trend: metrics.ytdReturn > 0 ? ("up" as const) : ("down" as const),
      period: "vs last year",
      icon: TrendingUp,
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
