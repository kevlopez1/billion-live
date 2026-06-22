"use client"

import { useEffect, useState } from "react"
import { CHALLENGE_DEADLINE } from "@/context/app-context"

function diff(deadline: number) {
  const ms = Math.max(0, deadline - Date.now())
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return { d, h, m, s }
}

const pad = (n: number) => n.toString().padStart(2, "0")

export function Countdown({ className = "" }: { className?: string }) {
  const deadline = new Date(CHALLENGE_DEADLINE + "T23:59:59").getTime()
  const [t, setT] = useState(() => diff(deadline))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setT(diff(deadline))
    const id = setInterval(() => setT(diff(deadline)), 1000)
    return () => clearInterval(id)
  }, [deadline])

  const blocks: [number | string, string][] = [
    [mounted ? t.d : "—", "días"],
    [mounted ? pad(t.h) : "—", "hs"],
    [mounted ? pad(t.m) : "—", "min"],
    [mounted ? pad(t.s) : "—", "seg"],
  ]

  const metaDate = new Date(CHALLENGE_DEADLINE + "T00:00:00").toLocaleDateString("es-BO", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/45 mb-2">
        El reloj corre · meta {metaDate}
      </div>
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
    </div>
  )
}
