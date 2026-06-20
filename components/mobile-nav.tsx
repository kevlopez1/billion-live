"use client"

import { LayoutDashboard, Activity, BookOpen } from "lucide-react"
import type { ActiveView } from "@/app/page"
import { useApp } from "@/context/app-context"

interface MobileNavProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const { t } = useApp()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur-xl px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-end justify-between">
        {/* Inicio */}
        <button
          onClick={() => onViewChange("dashboard")}
          className={`flex flex-col items-center gap-1 px-4 py-1.5 transition-colors ${
            activeView === "dashboard" ? "text-kev-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t.nav.dashboard}</span>
        </button>

        {/* Pulso — botón central flotante (estilo BNB) */}
        <button
          onClick={() => onViewChange("pulse")}
          className="flex flex-col items-center -mt-7"
        >
          <span
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-kev-primary/30 transition-transform active:scale-95 ${
              activeView === "pulse" ? "accent-gradient-bg" : "accent-gradient-bg"
            }`}
          >
            <Activity className="w-6 h-6 text-white" />
          </span>
          <span
            className={`text-[10px] font-medium mt-1 ${
              activeView === "pulse" ? "text-kev-primary" : "text-muted-foreground"
            }`}
          >
            {t.nav.dailyPulse.split(" ")[0]}
          </span>
        </button>

        {/* Manifiesto */}
        <button
          onClick={() => onViewChange("manifesto")}
          className={`flex flex-col items-center gap-1 px-4 py-1.5 transition-colors ${
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
