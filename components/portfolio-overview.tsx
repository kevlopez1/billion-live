"use client"

import { useEffect, useState, useRef } from "react"
import { useApp, CHALLENGE_TARGET, SECRET_TARGET } from "@/context/app-context"
import { TrendingUp, ArrowUpRight, Target, Lock } from "lucide-react"
import { supabase, subscribeToGlobalMetrics, type GlobalMetrics } from "@/lib/supabase"

export function PortfolioOverview() {
  const { metrics } = useApp()
  const [supabaseMetrics, setSupabaseMetrics] = useState<GlobalMetrics | null>(null)
  const [displayValue, setDisplayValue] = useState<number>(0)
  // La meta pública es FIJA: el Mercedes-AMG Mansory (~$450K). No depende de la DB.
  const targetValue = CHALLENGE_TARGET
  const animationRef = useRef<number | undefined>(undefined)
  const isInitialLoad = useRef(true)

  // Fetch initial data from Supabase
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase
          .from('global_metrics')
          .select('*')

        if (error) {
          // Fallback to local metrics if database fails
          setSupabaseMetrics({
            id: 'fallback',
            net_worth: metrics.netWorth,
            monthly_growth: metrics.monthlyGrowth,
            roi: metrics.roi,
            target_revenue: metrics.targetRevenue,
            active_projects: metrics.activeProjects,
            ytd_return: metrics.ytdReturn,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          return
        }

        if (data && data.length > 0) {
          setSupabaseMetrics(data[0])
        } else {
          // Fallback to local metrics if no data
          setSupabaseMetrics({
            id: 'fallback',
            net_worth: metrics.netWorth,
            monthly_growth: metrics.monthlyGrowth,
            roi: metrics.roi,
            target_revenue: metrics.targetRevenue,
            active_projects: metrics.activeProjects,
            ytd_return: metrics.ytdReturn,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        // Fallback to local metrics on exception
        setSupabaseMetrics({
          id: 'fallback',
          net_worth: metrics.netWorth,
          monthly_growth: metrics.monthlyGrowth,
          roi: metrics.roi,
          target_revenue: metrics.targetRevenue,
          active_projects: metrics.activeProjects,
          ytd_return: metrics.ytdReturn,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    fetchMetrics()

    // Subscribe to real-time changes
    const unsubscribe = subscribeToGlobalMetrics((newMetrics) => {
      setSupabaseMetrics(newMetrics)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Animate value changes when metrics update
  useEffect(() => {
    if (!supabaseMetrics) return

    // On initial load, set value directly without animation
    if (isInitialLoad.current) {
      setDisplayValue(supabaseMetrics.net_worth)
      isInitialLoad.current = false
      return
    }

    // Don't animate if the value hasn't changed
    if (displayValue === supabaseMetrics.net_worth) return

    const startValue = displayValue
    const endValue = supabaseMetrics.net_worth
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
  }, [supabaseMetrics?.net_worth])

  const netWorth = supabaseMetrics?.net_worth || displayValue
  const monthlyGrowth = supabaseMetrics?.monthly_growth || metrics.monthlyGrowth
  const activeProjects = supabaseMetrics?.active_projects || metrics.activeProjects
  const ytdReturn = supabaseMetrics?.ytd_return || metrics.ytdReturn
  // Progreso hacia el Mansory, acotado a 0–100% para que nunca se rompa visualmente.
  const progress = Math.min(Math.max((netWorth / targetValue) * 100, 0), 100)
  // Capa secreta: el imperio de largo plazo.
  const secretProgress = Math.min(Math.max((netWorth / SECRET_TARGET) * 100, 0), 100)

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Main value */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Contador del Reto · Revenue PRIME
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-kev-success/15 border border-kev-success/20 rounded-full text-kev-success text-[10px] font-medium">
              <TrendingUp className="w-3 h-3" />
              {monthlyGrowth >= 0 ? "+" : ""}
              {monthlyGrowth.toFixed(1)}%
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight number-display">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-muted-foreground">USD</span>
          </div>
          <p className="text-xs text-muted-foreground">De $10 a un Mercedes-AMG GT 63 Mansory · desde Bolivia</p>
        </div>

        {/* Progress to goal */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Meta:</span>
              <span className="font-medium">${targetValue.toLocaleString()}</span>
              <span className="hidden sm:inline text-muted-foreground">· Mansory AMG GT</span>
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
            <span>$10</span>
            <span>El auto es la carnada</span>
            <span>$450K</span>
          </div>

          {/* Capa secreta: el imperio de largo plazo (mensaje de dos capas) */}
          <div className="mt-4 pt-3 border-t border-border/40 opacity-70 hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span className="uppercase tracking-wider">Capa secreta · El imperio</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground number-display">
                ${SECRET_TARGET.toLocaleString()}
              </span>
            </div>
            <div className="h-1 bg-secondary/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all duration-1000"
                style={{ width: `${Math.max(secretProgress, 0.4)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick stats - hidden on smaller screens for cleaner layout */}
        <div className="hidden xl:flex gap-6 lg:gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Crecimiento mensual</p>
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold number-display">
                +${Math.round((netWorth * monthlyGrowth) / 100).toLocaleString()}
              </span>
              <ArrowUpRight className="w-4 h-4 text-kev-success" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Marcas activas</p>
            <span className="text-xl font-semibold number-display">{activeProjects}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Progreso al auto</p>
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold number-display text-kev-success">{progress.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
