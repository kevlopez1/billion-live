"use client"

import { useEffect, useState, useRef } from "react"
import { useApp, CHALLENGE_TARGET, SECRET_TARGET } from "@/context/app-context"
import { Lock, Star } from "lucide-react"
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
    <section className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 backdrop-blur-xl px-6 py-10 md:px-10 md:py-14 lg:px-14">
      {/* Marca de agua gigante */}
      <span className="pointer-events-none select-none absolute -bottom-10 -left-3 font-display font-extrabold uppercase leading-none tracking-tighter text-foreground/[0.04] text-[32vw] md:text-[17rem] z-0">
        GTA
      </span>
      <div className="accent-glow -top-16 -right-10" />

      <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
        {/* Texto */}
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-kev-primary animate-pulse" />
            El reto · Building in public
          </div>

          {/* Titular: mezcla de tipografías */}
          <h1 className="leading-[0.85]">
            <span className="block font-serif-display italic text-foreground/70 text-3xl sm:text-4xl md:text-5xl">
              De $10 al
            </span>
            <span className="block font-display font-extrabold uppercase tracking-tighter text-accent-gradient text-6xl sm:text-7xl md:text-8xl -mt-1">
              Mansory
            </span>
          </h1>

          <p className="font-serif-display italic text-muted-foreground text-lg md:text-xl mt-5 max-w-md">
            El auto es la carnada — el imperio es la meta.
          </p>

          {/* Rating / prueba social */}
          <div className="flex items-center gap-2.5 mt-7 text-sm">
            <div className="flex text-kev-primary">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <span className="text-muted-foreground">
              <b className="text-foreground number-display">1.009</b> siguiendo el reto
            </span>
          </div>

        </div>

        {/* Foto + widgets flotantes */}
        <div className="relative">
          <div className="relative rounded-[2rem] overflow-hidden border border-border shadow-2xl aspect-square max-w-md mx-auto lg:mx-0">
            <img
              src="/images/kev.jpg"
              alt="Kev López"
              className="w-full h-full object-cover object-[center_42%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-4 font-display font-extrabold uppercase tracking-tighter text-white/90 text-2xl leading-none">
              Kev López
            </span>
          </div>

          {/* Widget: contador (odómetro) */}
          <div className="absolute -left-3 sm:-left-6 top-6 glass-card px-4 py-3 shadow-xl">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-kev-primary animate-pulse" /> Contador · PRIME
            </div>
            <div className="text-2xl font-extrabold number-display text-accent-gradient leading-none">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Widget: ubicación en vivo */}
          <div className="absolute -right-3 sm:-right-6 bottom-10 glass-card px-4 py-3 shadow-xl">
            <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">En vivo</div>
            <div className="text-sm font-semibold">Santa Cruz, BO</div>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="relative z-10 mt-12 lg:mt-14">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span className="number-display">$10</span>
          <span className="font-semibold text-foreground number-display">{progress.toFixed(2)}% al Mansory</span>
          <span className="number-display">$450K</span>
        </div>
        <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full accent-gradient-bg rounded-full transition-all duration-1000 progress-glow"
            style={{ width: `${Math.max(progress, 0.6)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          <Lock className="w-2.5 h-2.5" />
          <span>Secret layer · ${SECRET_TARGET.toLocaleString()}</span>
        </div>
      </div>
    </section>
  )
}
