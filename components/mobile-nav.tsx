"use client"

import { LayoutDashboard, BarChart3, BookOpen, Trophy } from "lucide-react"
import type { ActiveView } from "@/app/page"
import { useApp } from "@/context/app-context"

interface MobileNavProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
  onRanking: () => void
}

export function MobileNav({ activeView, onViewChange, onRanking }: MobileNavProps) {
  const { t } = useApp()

  const tabBase = "flex flex-col items-center gap-1 py-1.5 transition-colors"

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur-xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="grid grid-cols-4 items-end">
        {/* Inicio */}
        <button
          onClick={() => onViewChange("dashboard")}
          className={`${tabBase} ${
            activeView === "dashboard" ? "text-kev-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t.nav.dashboard}</span>
        </button>

        {/* Pulso / Números */}
        <button
          onClick={() => onViewChange("pulse")}
          className={`${tabBase} ${
            activeView === "pulse" ? "text-kev-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t.nav.dailyPulse.split(" ")[0]}</span>
        </button>

        {/* Ranking — sección del home (equipo de vendedores) */}
        <button onClick={onRanking} className={`${tabBase} text-azul`}>
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Ranking</span>
        </button>

        {/* Manifiesto */}
        <button
          onClick={() => onViewChange("manifesto")}
          className={`${tabBase} ${
            activeView === "manifesto" ? "text-kev-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t.nav.manifesto}</span>
        </button>
      </div>
    </nav>
  )
}
