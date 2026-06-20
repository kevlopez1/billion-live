"use client"

import { Music2, Youtube, Instagram, Facebook, Users, ArrowUpRight } from "lucide-react"

// La atención como ACTIVO. Números REALES, Día 1 — autenticidad sobre vanidad.
const socialPlatforms = [
  {
    name: "TikTok",
    handle: "@kev.project.gta",
    icon: Music2,
    value: "887",
    role: "El motor del reto",
    url: "https://www.tiktok.com/@kev.project.gta",
  },
  {
    name: "YouTube",
    handle: "@KevProjectGTA",
    icon: Youtube,
    value: "104",
    role: "Long-form",
    url: "https://www.youtube.com/@KevProjectGTA",
  },
  {
    name: "Instagram",
    handle: "@kev_project_gta",
    icon: Instagram,
    value: "18",
    role: "Comunidad",
    url: "https://www.instagram.com/kev_project_gta",
  },
  {
    name: "Facebook",
    handle: "Kev Project GTA",
    icon: Facebook,
    value: "Nuevo",
    role: "Página",
    url: "https://www.facebook.com/people/Kev-Project-GTA/",
  },
]

export function SocialPowerGrid() {
  const totalFollowers = "1.009"

  return (
    <div className="glass-card p-6 md:p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium tracking-tight">Público & Base de Datos</h3>
          <p className="text-sm text-muted-foreground mt-1 font-light">La atención como activo · números reales, Día 1</p>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <Users className="w-3.5 h-3.5 text-muted-foreground self-center" strokeWidth={1.5} />
          <span className="text-xl font-light text-foreground number-display">{totalFollowers}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {socialPlatforms.map((platform) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group p-5 rounded-2xl border border-border transition-colors hover:border-white/[0.16] hover:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between mb-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <platform.icon className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-sm text-foreground">{platform.name}</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <div className="text-2xl font-light text-foreground number-display">{platform.value}</div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-muted-foreground font-light truncate">{platform.handle}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0 ml-2">
                {platform.role}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
