"use client"

import { useEffect, useState, useRef } from "react"
import { useApp, CHALLENGE_TARGET, SECRET_TARGET } from "@/context/app-context"
import { TrendingUp, Lock } from "lucide-react"
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
    <div className="accent-surface rounded-[var(--radius)] p-7 md:p-12 relative overflow-hidden">
      {/* Retrato de Kev como fondo del póster (se desvanece hacia el texto) */}
      <img
        src="/images/kev.jpg"
        alt="Kev López"
        className="absolute right-0 top-0 h-full w-2/3 sm:w-1/2 object-cover object-[center_30%] opacity-[0.28] pointer-events-none select-none [mask-image:linear-gradient(to_left,black_10%,transparent_85%)]"
      />
      <div className="accent-glow -left-24 -top-24" />
      <div className="accent-glow accent-glow-violet -right-16 -bottom-28" />
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative z-10">
        {/* Main value */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Contador del reto · Revenue PRIME
            </span>
            {monthlyGrowth !== 0 && (
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  monthlyGrowth > 0 ? "text-kev-success" : "text-kev-danger"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                {monthlyGrowth > 0 ? "+" : ""}
                {monthlyGrowth.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-7xl sm:text-8xl md:text-9xl font-semibold tracking-tighter number-display leading-[0.9] break-all text-accent-gradient">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-muted-foreground font-light">USD</span>
          </div>
          <p className="text-sm text-muted-foreground mt-5 font-light">
            De $10 a un Mercedes-AMG GT&nbsp;63 Mansory — desde Bolivia.
          </p>
        </div>

        {/* Progress to goal */}
        <div className="w-full lg:max-w-sm">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Meta · Mansory AMG GT
            </span>
            <span className="text-sm font-medium number-display">${targetValue.toLocaleString()}</span>
          </div>
          <div className="h-px w-full bg-border mb-3" />
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full accent-gradient-bg rounded-full transition-all duration-1000 progress-glow"
              style={{ width: `${Math.max(progress, 0.6)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5 text-[11px] text-muted-foreground">
            <span className="number-display">$10</span>
            <span className="font-medium text-foreground/70 number-display">{progress.toFixed(2)}%</span>
            <span className="number-display">$450K</span>
          </div>

          {/* Capa secreta: el imperio de largo plazo (mensaje de dos capas) */}
          <div className="mt-6 pt-5 border-t border-border opacity-50 hover:opacity-90 transition-opacity duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Lock className="w-2.5 h-2.5" />
                <span className="uppercase tracking-[0.18em]">Capa secreta · El imperio</span>
              </div>
              <span className="text-[10px] text-muted-foreground number-display">
                ${SECRET_TARGET.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
