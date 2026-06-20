"use client"

import { Music2, Instagram, Building2, TrendingUp, Users } from "lucide-react"

// La atención como ACTIVO: cada plataforma alimenta la base de datos → público real.
const socialPlatforms = [
  {
    name: "TikTok · @kev.project.gta",
    icon: Music2,
    followers: "El Reto",
    change: "Día 1",
    changePercent: "Relanzado",
    color: "text-foreground",
    bgColor: "bg-foreground/5",
    borderColor: "border-foreground/15",
  },
  {
    name: "@1kevlopez",
    icon: Instagram,
    followers: "19.6K",
    change: "El medio",
    changePercent: "Personal",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
  },
  {
    name: "PRIME · primebusiness.live",
    icon: Building2,
    followers: "B2B",
    change: "Leads IA",
    changePercent: "El motor",
    color: "text-kev-primary",
    bgColor: "bg-kev-primary/10",
    borderColor: "border-kev-primary/20",
  },
]

export function SocialPowerGrid() {
  const totalFollowers = "19.6K+"

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Público & Base de Datos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">La atención como activo · se convierte en público real</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-kev-primary" />
          <span className="font-semibold text-foreground number-display">{totalFollowers}</span>
          <span className="text-muted-foreground">Audiencia</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {socialPlatforms.map((platform) => (
          <div
            key={platform.name}
            className={`p-4 rounded-xl border ${platform.borderColor} ${platform.bgColor} transition-all hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <platform.icon className={`w-5 h-5 ${platform.color}`} />
                <span className="text-sm font-medium text-foreground">{platform.name}</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground number-display">{platform.followers}</div>
                <div className="text-xs text-muted-foreground">{platform.changePercent}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-kev-success text-sm font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {platform.change}
                </div>
                <div className="text-xs text-muted-foreground">Función</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
