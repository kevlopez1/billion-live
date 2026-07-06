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
    <section className="relative text-center">
      {/* Eyebrow (pill) — el punto rojo = EN VIVO */}
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-rojo opacity-50 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rojo" />
        </span>
        En vivo · El reto
      </div>

      {/* Título centrado — "$10" en rojo (dinero) sobre tinta navy */}
      <h1 className="leading-[0.9]">
        <span className="block font-serif-display italic text-muted-foreground text-3xl sm:text-5xl">
          De <span className="text-rojo">$10</span> a un
        </span>
        <span className="block font-display font-extrabold uppercase tracking-tighter text-foreground text-7xl sm:text-8xl md:text-9xl -mt-1">
          Mercedes
        </span>
        <span className="block font-display font-semibold uppercase tracking-[0.2em] text-muted-foreground text-xs sm:text-sm mt-2">
          AMG GT 63 · by Mansory
        </span>
      </h1>

      {/* El auto — flotando sobre el fondo (look poster de showroom) */}
      <div className="relative mt-8 md:mt-6">
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[2%] w-[72%] h-10 md:h-14 rounded-full blur-2xl"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(27,23,16,0.32), transparent 70%)" }}
        />
        <img
          src="/images/car/green-2-cut.png"
          alt="Mercedes-AMG GT 63 4-door por Mansory"
          className="relative w-full max-w-3xl mx-auto"
          loading="eager"
        />
      </div>

      {/* Otros ángulos (fotos oficiales) */}
      <div
        className="mt-6 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {["green-3", "green-4", "green-1"].map((n, i) => (
          <div
            key={i}
            className="img-zoom snap-center shrink-0 w-[58%] sm:w-[38%] lg:w-[31.5%] rounded-2xl overflow-hidden border border-border bg-white shadow-[0_10px_40px_-18px_rgba(0,0,0,0.25)]"
          >
            <img
              src={`/images/car/${n}.jpg`}
              alt="Mercedes-AMG GT 63 4-door por Mansory"
              className="w-full aspect-[3/2] object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* Contador */}
      <div className="mt-9 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
          Recaudado a día de hoy
        </div>
        <div className="flex items-baseline justify-center gap-2.5 flex-wrap">
          <span className="number-display font-extrabold text-metal text-7xl sm:text-8xl leading-none tabular-nums">
            ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-muted-foreground text-base number-display">/ $450K</span>
        </div>
        <div className="gold-rule mx-auto mt-4" />
      </div>

      {/* Barra de progreso */}
      <div className="mt-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span className="number-display">$10</span>
          <span className="font-semibold text-foreground number-display">{progress.toFixed(2)}% al Mercedes</span>
          <span className="number-display">$450K</span>
        </div>
        <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className="h-full gold-fill rounded-full transition-all duration-1000"
            style={{ width: `${Math.max(progress, 0.6)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          <span className="flex items-center gap-1.5">
            <Lock className="w-2.5 h-2.5" /> Secret layer · ${SECRET_TARGET.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-kev-primary animate-pulse" /> Santa Cruz, BO
          </span>
        </div>
      </div>

      {/* Cuenta regresiva */}
      <Countdown className="mt-9 text-center" />
    </section>
  )
}
