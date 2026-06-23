"use client"

import { useEffect, useState } from "react"
import { useApp, CHALLENGE_LAUNCH, CHALLENGE_RECORD_DEADLINE } from "@/context/app-context"

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86_400_000))
const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000))

export function LiveTicker() {
  const { metrics } = useApp()
  const [huellas, setHuellas] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch("/api/wall", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => typeof d.total === "number" && setHuellas(d.total))
      .catch(() => {})
  }, [])

  const items = [
    `🏁 Día ${mounted ? daysSince(CHALLENGE_LAUNCH) + 1 : 1} del reto`,
    `⏱️ ${mounted ? daysLeft(CHALLENGE_RECORD_DEADLINE) : "—"} días al récord`,
    `💵 Recaudado · $${metrics.netWorth.toLocaleString("en-US")} / $450K`,
    `🎯 Meta · Mercedes-AMG GT 63 Mansory`,
    huellas != null ? `🖐️ ${huellas} huellas en el muro` : "🖐️ Dejá tu huella en el muro",
    "📍 En vivo desde Santa Cruz, Bolivia",
  ]
  const row = items.join("        •        ")

  return (
    <div className="-mx-4 md:-mx-6 overflow-hidden bg-[#0a0a0a] text-white/75 border-y border-white/10 py-2.5">
      <div className="ticker-track text-[11px] uppercase tracking-[0.18em]">
        <span className="px-6">{row}</span>
        <span className="px-6" aria-hidden="true">
          {row}
        </span>
      </div>
    </div>
  )
}
