"use client"

import { useEffect, useState, useRef } from "react"
import { useApp } from "@/context/app-context"
import { TrendingUp, ArrowUpRight, Target, Calendar } from "lucide-react"

export function PortfolioOverview() {
  const { metrics } = useApp()
  const [displayValue, setDisplayValue] = useState(metrics.netWorth)
  const targetValue = metrics.targetRevenue
  const animationRef = useRef<number>()

  useEffect(() => {
    const startValue = displayValue
    const endValue = metrics.netWorth
    const duration = 800
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(startValue + (endValue - startValue) * eased)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [metrics.netWorth])

  const progress = (metrics.netWorth / targetValue) * 100

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Main value */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Total Portfolio Value
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-kev-success/15 border border-kev-success/20 rounded-full text-kev-success text-[10px] font-medium">
              <TrendingUp className="w-3 h-3" />+{metrics.monthlyGrowth}%
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight number-display">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-muted-foreground">.00 USD</span>
          </div>
        </div>

        {/* Progress to goal */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">${targetValue.toLocaleString()}</span>
            </div>
            <span className="text-sm font-medium text-kev-primary">{progress.toFixed(2)}%</span>
          </div>
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-kev-primary to-kev-primary-light rounded-full transition-all duration-1000 progress-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>$0</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Est. completion: Q4 2027</span>
            </div>
            <span>$1B</span>
          </div>
        </div>

        {/* Quick stats - hidden on smaller screens for cleaner layout */}
        <div className="hidden xl:flex gap-6 lg:gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Monthly Growth</p>
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold number-display">
                +${((metrics.netWorth * metrics.monthlyGrowth) / 100 / 1_000_000).toFixed(1)}M
              </span>
              <ArrowUpRight className="w-4 h-4 text-kev-success" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Active Projects</p>
            <span className="text-xl font-semibold number-display">{metrics.activeProjects}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">YTD Return</p>
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold number-display text-kev-success">+{metrics.ytdReturn}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
