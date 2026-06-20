"use client"

import { Music2, Instagram, Building2, Users } from "lucide-react"

// La atención como ACTIVO: cada plataforma alimenta la base de datos → público real.
const socialPlatforms = [
  { name: "TikTok", handle: "@kev.project.gta", icon: Music2, value: "El reto", role: "El medio" },
  { name: "Instagram", handle: "@1kevlopez", icon: Instagram, value: "19.6K", role: "La marca personal" },
  { name: "PRIME", handle: "primebusiness.live", icon: Building2, value: "B2B", role: "El motor" },
]

export function SocialPowerGrid() {
  const totalFollowers = "19.6K+"

  return (
    <div className="glass-card p-6 md:p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Público & Base de Datos</h3>
          <p className="text-sm text-muted-foreground mt-1 font-light">La atención como activo</p>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <Users className="w-3.5 h-3.5 text-muted-foreground self-center" strokeWidth={1.5} />
          <span className="text-xl font-light text-foreground number-display">{totalFollowers}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {socialPlatforms.map((platform) => (
          <div
            key={platform.name}
            className="p-5 rounded-2xl border border-border transition-colors hover:border-white/[0.16] hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-6 text-muted-foreground">
              <platform.icon className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-sm text-foreground">{platform.name}</span>
            </div>
            <div className="text-2xl font-light text-foreground number-display">{platform.value}</div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-muted-foreground font-light truncate">{platform.handle}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0 ml-2">
                {platform.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
