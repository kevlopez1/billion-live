"use client"

import { useEffect, useState } from "react"
import { CHALLENGE_DEADLINE, CHALLENGE_RECORD_DEADLINE } from "@/context/app-context"

function diff(deadline: number) {
  const ms = Math.max(0, deadline - Date.now())
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return { d, h, m, s }
}

const pad = (n: number) => n.toString().padStart(2, "0")
const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000))
const metaLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-BO", { month: "short", year: "numeric" })

export function Countdown({ className = "" }: { className?: string }) {
  // El reloj grande corre hacia el RITMO RÉCORD (la meta ambiciosa).
  const record = new Date(CHALLENGE_RECORD_DEADLINE + "T23:59:59").getTime()
  const [t, setT] = useState(() => diff(record))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setT(diff(record))
    const id = setInterval(() => setT(diff(record)), 1000)
    return () => clearInterval(id)
  }, [record])

  const blocks: [number | string, string][] = [
    [mounted ? t.d : "—", "días"],
    [mounted ? pad(t.h) : "—", "hs"],
    [mounted ? pad(t.m) : "—", "min"],
    [mounted ? pad(t.s) : "—", "seg"],
  ]

  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">
        El reloj corre · ritmo récord
      </div>

      {/* Reloj grande hacia la meta récord */}
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {blocks.map(([val, label], i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="number-display font-extrabold text-white text-3xl sm:text-5xl leading-none tabular-nums">
              {val}
            </span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/40 mt-1.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Doble meta: récord + límite */}
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
          🏁 Récord · 6 meses · {metaLabel(CHALLENGE_RECORD_DEADLINE)}
          {mounted && <b className="number-display ml-0.5">({daysLeft(CHALLENGE_RECORD_DEADLINE)}d)</b>}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
          Límite · 12 meses · {metaLabel(CHALLENGE_DEADLINE)}
          {mounted && <b className="number-display ml-0.5">({daysLeft(CHALLENGE_DEADLINE)}d)</b>}
        </span>
      </div>
    </div>
  )
}
