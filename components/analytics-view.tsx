"use client"

import { useApp } from "@/context/app-context"
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity } from "lucide-react"

const monthlyData = [
  { month: "Jul", revenue: 2.4, expenses: 1.8, profit: 0.6 },
  { month: "Aug", revenue: 2.8, expenses: 1.9, profit: 0.9 },
  { month: "Sep", revenue: 3.1, expenses: 2.0, profit: 1.1 },
  { month: "Oct", revenue: 3.4, expenses: 2.1, profit: 1.3 },
  { month: "Nov", revenue: 3.8, expenses: 2.2, profit: 1.6 },
  { month: "Dec", revenue: 4.2, expenses: 2.3, profit: 1.9 },
]

export function AnalyticsView() {
  const { t } = useApp()

  const metrics = [
    { label: t.analytics.revenueGrowth, value: "+24.8%", trend: "up", description: t.analytics.vsLastQuarter },
    { label: t.analytics.profitMargin, value: "42.3%", trend: "up", description: `+3.2% ${t.analytics.improvement}` },
    { label: t.analytics.operatingCosts, value: "$2.3M", trend: "down", description: `-8% ${t.analytics.optimized}` },
    { label: t.dashboard.roi, value: "186%", trend: "up", description: t.analytics.annualizedReturn },
  ]

  const breakdown = [
    { category: "Venture Capital", percentage: 38, value: "$42.8M", color: "bg-kev-primary" },
    { category: "Real Estate", percentage: 25, value: "$156M", color: "bg-kev-primary-light" },
    { category: "AI/ML Startups", percentage: 18, value: "$8.2M", color: "bg-kev-success" },
    { category: "Trading", percentage: 11, value: "$12.4M", color: "bg-neutral-500" },
    { category: "Sustainable", percentage: 8, value: "$5.8M", color: "bg-kev-warning" },
  ]

  const maxValue = Math.max(...monthlyData.map((d) => d.revenue))

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">{t.analytics.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.analytics.subtitle}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{metric.label}</span>
              {metric.trend === "up" ? (
                <TrendingUp className="w-3 h-3 text-kev-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-kev-danger" />
              )}
            </div>
            <div className="text-xl lg:text-2xl font-semibold number-display">{metric.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{metric.description}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-8 glass-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.analytics.revenueVsExpenses}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-kev-primary" />
                <span className="text-muted-foreground">{t.analytics.revenue}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-neutral-500" />
                <span className="text-muted-foreground">{t.analytics.expenses}</span>
              </div>
            </div>
          </div>

          <div className="h-48 lg:h-64 flex items-end gap-2 lg:gap-4">
            {monthlyData.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex gap-1 h-40 lg:h-52 items-end">
                  <div
                    className="flex-1 bg-kev-primary/80 rounded-t transition-all duration-500 hover:bg-kev-primary"
                    style={{ height: `${(data.revenue / maxValue) * 100}%` }}
                  />
                  <div
                    className="flex-1 bg-neutral-600 rounded-t transition-all duration-500 hover:bg-neutral-500"
                    style={{ height: `${(data.expenses / maxValue) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{data.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation Breakdown */}
        <div className="lg:col-span-4 glass-card p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-4 h-4 text-kev-primary" />
            <h2 className="text-base font-semibold">{t.analytics.allocationBreakdown}</h2>
          </div>

          <div className="space-y-4">
            {breakdown.map((item) => (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.category}</span>
                  <span className="font-medium">{item.percentage}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="glass-card p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-kev-primary" />
          <h2 className="text-base font-semibold">{t.analytics.portfolioSummary}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-kev-success/10 border border-kev-success/20 rounded-xl">
            <div className="text-sm text-kev-success font-medium mb-1">{t.analytics.bestMonth}</div>
            <div className="text-lg font-semibold">Quantum Trading</div>
            <div className="text-sm text-muted-foreground">+34.2% {t.analytics.thisQuarter}</div>
          </div>
          <div className="p-4 bg-kev-primary/10 border border-kev-primary/20 rounded-xl">
            <div className="text-sm text-kev-primary font-medium mb-1">{t.analytics.largestHolding}</div>
            <div className="text-lg font-semibold">Titan Real Estate</div>
            <div className="text-sm text-muted-foreground">$156M (25% {t.analytics.allocation})</div>
          </div>
          <div className="p-4 bg-kev-warning/10 border border-kev-warning/20 rounded-xl">
            <div className="text-sm text-kev-warning font-medium mb-1">{t.analytics.worstMonth}</div>
            <div className="text-lg font-semibold">Green Energy Fund</div>
            <div className="text-sm text-muted-foreground">-1.2% {t.analytics.underperforming}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
