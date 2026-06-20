"use client"

import { MapPin, Globe } from "lucide-react"

const locations = [
  { city: "Santa Cruz", country: "Bolivia", type: "HQ · Origen", active: true },
  { city: "La Paz", country: "Bolivia", type: "PRIME", active: true },
  { city: "Buenos Aires", country: "Argentina", type: "PRIME LatAm", active: false },
  { city: "CDMX", country: "México", type: "PRIME LatAm", active: false },
  { city: "Miami", country: "EE.UU.", type: "Objetivo O-1/EB-1A", active: false },
  { city: "Delaware", country: "EE.UU.", type: "C-Corp", active: false },
]

export function GlobalPresenceMap() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Expansión</h3>
          <p className="text-sm text-muted-foreground mt-0.5">De Santa Cruz a LatAm y EE.UU.</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-kev-success" />
            <span className="text-muted-foreground">Operando</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            <span className="text-muted-foreground">Objetivo</span>
          </div>
        </div>
      </div>

      <div className="relative h-48 md:h-56 rounded-xl overflow-hidden bg-secondary/30 border border-border/50 mb-4">
        <div className="absolute inset-0 grid-overlay opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-br from-kev-primary/5 via-transparent to-kev-primary/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe className="w-24 h-24 text-kev-primary/10" />
        </div>

        {locations.map((loc) => {
          const positions: Record<string, { x: string; y: string }> = {
            "Santa Cruz": { x: "32%", y: "70%" },
            "La Paz": { x: "27%", y: "65%" },
            "Buenos Aires": { x: "35%", y: "84%" },
            CDMX: { x: "17%", y: "47%" },
            Miami: { x: "23%", y: "41%" },
            Delaware: { x: "26%", y: "33%" },
          }
          const pos = positions[loc.city]

          return (
            <div
              key={loc.city}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              style={{ left: pos.x, top: pos.y }}
            >
              <div className="relative">
                {loc.active && <div className="absolute -inset-2 rounded-full bg-kev-success/20 animate-ping" />}
                <div
                  className={`w-3 h-3 rounded-full border-2 border-background shadow-lg ${
                    loc.active ? "bg-kev-success" : "bg-muted-foreground/60"
                  }`}
                />
              </div>

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10 scale-90 group-hover:scale-100">
                <div className="bg-popover border border-border px-2.5 py-1.5 rounded-lg shadow-lg text-xs whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-kev-primary" />
                    <span className="font-medium text-foreground">{loc.city}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{loc.type}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {locations.map((loc) => (
          <div
            key={loc.city}
            className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-kev-primary/30 transition-colors"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${loc.active ? "bg-kev-success" : "bg-muted-foreground/50"}`}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{loc.city}</div>
              <div className="text-xs text-muted-foreground">{loc.type}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
