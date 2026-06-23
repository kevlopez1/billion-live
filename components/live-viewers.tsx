"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Espectadores en vivo, REAL (sin números inventados). Usa Supabase Presence:
// cada visitante se "trackea" en un canal y contamos cuántos hay conectados.
// No necesita tabla ni service-role — funciona con la anon key.
export function LiveViewers() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const key = Math.random().toString(36).slice(2)
    const channel = supabase.channel("live_viewers", {
      config: { presence: { key } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (!count || count < 1) return null

  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-kev-primary opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-kev-primary" />
        </span>
        {count} {count === 1 ? "persona viendo" : "personas viendo"} el reto ahora
      </div>
    </div>
  )
}
