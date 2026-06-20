"use client"

import { useEffect, useState, useRef } from "react"
import { useApp, CHALLENGE_TARGET, SECRET_TARGET } from "@/context/app-context"
import { Lock } from "lucide-react"
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
    <section className="relative overflow-hidden rounded-[var(--radius)] min-h-[460px] md:min-h-[580px] flex flex-col justify-end">
      {/* Foto a sangre completa (estilo póster de las referencias) */}
      <img
        src="/images/kev.jpg"
        alt="Kev López"
        className="absolute inset-0 w-full h-full object-cover object-[center_22%] pointer-events-none select-none [filter:grayscale(0.25)_contrast(1.06)_brightness(0.74)]"
      />
      {/* Duotono azul → violeta (lavado de color sobre la foto) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[oklch(0.5_0.23_260)] via-transparent to-[oklch(0.5_0.23_292)] mix-blend-overlay opacity-80" />
      {/* Oscurecidos para legibilidad del texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/10 to-transparent" />

      <div className="relative z-10 p-7 md:p-12">
        {/* Eyebrow */}
        <div className="flex items-center gap-2.5 mb-5 text-[11px] uppercase tracking-[0.24em] text-white/70">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6b8cff] animate-pulse shadow-[0_0_10px_#6b8cff]" />
          KEV PROJECT GTA · EN VIVO
        </div>

        {/* Titular GIGANTE de póster, dos tonos */}
        <h1 className="font-display font-extrabold uppercase tracking-tighter leading-[0.8] text-6xl sm:text-7xl md:text-[7rem]">
          <span className="block text-white">De $10 al</span>
          <span className="block text-accent-gradient">Mansory</span>
        </h1>

        {/* Contador + progreso, sobre la foto */}
        <div className="mt-9 flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">Contador · Revenue PRIME</span>
              {monthlyGrowth !== 0 && (
                <span className={`text-[10px] font-medium ${monthlyGrowth > 0 ? "text-[#7ce0a0]" : "text-kev-danger"}`}>
                  {monthlyGrowth > 0 ? "+" : ""}
                  {monthlyGrowth.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl md:text-6xl font-semibold number-display text-white tracking-tighter leading-none">
                ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-white/50">USD</span>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] max-w-sm">
            <div className="flex items-center justify-between text-[11px] text-white/60 mb-2">
              <span className="number-display">$10</span>
              <span className="font-medium text-white number-display">{progress.toFixed(2)}%</span>
              <span className="number-display">$450K · Mansory</span>
            </div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full accent-gradient-bg rounded-full transition-all duration-1000 progress-glow"
                style={{ width: `${Math.max(progress, 0.6)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
              <Lock className="w-2.5 h-2.5" />
              <span>Capa secreta · ${SECRET_TARGET.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
