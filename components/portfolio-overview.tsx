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
    <section className="relative overflow-hidden rounded-[var(--radius)] bg-[#0a0a0a] text-white min-h-[82vh] lg:min-h-[560px]">
      {/* El auto del reto (protagonista): fondo completo en móvil, mitad derecha en desktop */}
      <div className="absolute inset-0 lg:left-[38%]">
        <img
          src="/images/mansory.jpg"
          alt="Mercedes-AMG GT 63 4-door por Mansory — el auto del reto"
          className="w-full h-full object-cover object-center"
        />
        {/* Degradados para fundir la foto con el negro y dar legibilidad al texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/55 to-[#0a0a0a]/10 lg:bg-gradient-to-r lg:from-[#0a0a0a] lg:via-[#0a0a0a]/70 lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-transparent to-transparent lg:from-[#0a0a0a]/40" />
      </div>

      {/* Marca de agua gigante */}
      <span className="pointer-events-none select-none absolute -bottom-12 -left-4 font-display font-extrabold uppercase leading-none tracking-tighter text-white/[0.05] text-[34vw] md:text-[20rem] z-0">
        GTA
      </span>

      {/* Contenido: alineado al fondo (estilo póster) */}
      <div className="relative z-10 flex flex-col justify-end min-h-[82vh] lg:min-h-[560px] px-6 py-8 md:px-10 md:py-12 lg:w-[58%]">
        {/* Badge en vivo */}
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          En vivo · El reto
        </div>

        {/* Titular gigante */}
        <h1 className="leading-[0.82]">
          <span className="block font-serif-display italic text-white/60 text-3xl sm:text-4xl md:text-5xl">
            De $10 al
          </span>
          <span className="block font-display font-extrabold uppercase tracking-tighter text-white text-7xl sm:text-8xl md:text-9xl -mt-1">
            Mansory
          </span>
        </h1>

        {/* Contador gigante — el corazón del reto */}
        <div className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-1">
            Recaudado por PRIME · en tiempo real
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="number-display font-extrabold text-white text-6xl sm:text-7xl leading-none tabular-nums">
              ${displayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-white/45 text-base number-display">/ $450K</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-6 max-w-xl">
          <div className="flex items-center justify-between text-[11px] text-white/45 mb-2">
            <span className="number-display">$10</span>
            <span className="font-semibold text-white number-display">{progress.toFixed(2)}% al Mansory</span>
            <span className="number-display">$450K</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(progress, 0.6)}%` }}
            />
          </div>
        </div>

        {/* Pie: prueba social + capa secreta + ubicación */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
          <span className="flex items-center gap-2">
            <img
              src="/images/kev.jpg"
              alt="Kev López"
              className="w-7 h-7 rounded-full object-cover object-[center_30%] ring-1 ring-white/30"
            />
            <span className="text-white font-semibold">Kev López</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="flex text-white/80">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3 h-3 fill-current" />
              ))}
            </span>
            <span><b className="text-white number-display">1.009</b> siguiendo</span>
          </span>
          <span className="flex items-center gap-1.5 uppercase tracking-[0.16em]">
            <Lock className="w-2.5 h-2.5" />
            Secret layer · ${SECRET_TARGET.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Santa Cruz, BO
          </span>
        </div>
      </div>
    </section>
  )
}
