"use client"

import { useEffect, useState, useRef } from "react"
import { useApp, CHALLENGE_TARGET, SECRET_TARGET } from "@/context/app-context"
import { Lock } from "lucide-react"
import { Countdown } from "@/components/countdown"
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

    // Don't animate if the value hasn't changed
    if (displayValue === supabaseMetrics.net_worth) return

    // Odómetro: en la primera carga anima desde 0 (efecto dramático); luego desde el valor actual.
    const initial = isInitialLoad.current
    isInitialLoad.current = false
    const startValue = initial ? 0 : displayValue
    const endValue = supabaseMetrics.net_worth
    const duration = initial ? 1600 : 800
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
    <section className="relative overflow-hidden rounded-[var(--radius)] bg-[#0a0a0a] text-white min-h-[90vh] flex flex-col">
      {/* Marca de agua gigante */}
      <span className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-extrabold uppercase leading-none tracking-tighter text-white/[0.03] text-[42vw] z-0">
        GTA
      </span>

      {/* Eyebrow arriba, centrado */}
      <div className="relative z-10 flex justify-center pt-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm px-3.5 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/75">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          En vivo · El reto
        </div>
      </div>

      {/* El auto, protagonista absoluto */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-2 min-h-0">
        <img
          src="/images/mansory.jpg"
          alt="Mercedes-AMG GT 63 4-door por Mansory — el auto del reto"
          className="w-auto max-w-full max-h-[46vh] object-contain drop-shadow-2xl"
        />
      </div>

      {/* Texto gigante + contador, centrado, con aire */}
      <div className="relative z-10 px-6 pb-10 text-center">
        <h1 className="leading-[0.85]">
          <span className="block font-serif-display italic text-white/55 text-xl sm:text-2xl">
            De $10 a un
          </span>
          <span className="block font-display font-extrabold uppercase tracking-tighter text-white text-6xl sm:text-8xl -mt-1">
            Mercedes
          </span>
          <span className="block font-display font-semibold uppercase tracking-[0.22em] text-white/65 text-xs sm:text-sm mt-2">
            AMG GT 63 · by Mansory
          </span>
        </h1>

        {/* Contador */}
        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/45 mb-1.5">
            Recaudado a día de hoy
          </div>
          <div className="flex items-baseline justify-center gap-2.5">
            <span className="number-display font-extrabold text-white text-5xl sm:text-6xl leading-none tabular-nums">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-white/40 text-base number-display">/ $450K</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-6 mx-auto max-w-md">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(progress, 0.6)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[10px] uppercase tracking-[0.16em] text-white/40">
            <span className="number-display">{progress.toFixed(2)}% al Mercedes</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-2.5 h-2.5" /> Secret · ${SECRET_TARGET.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Santa Cruz, BO
            </span>
          </div>
        </div>

        {/* Cuenta regresiva */}
        <Countdown className="mt-9" />
      </div>
    </section>
  )
}
