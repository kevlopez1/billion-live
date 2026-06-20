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

  const navItems = [
    { id: "dashboard" as const, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse.split(" ")[0], icon: Activity },
    { id: "manifesto" as const, label: t.nav.manifesto, icon: BookOpen },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card !rounded-none border-t border-border/50 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex flex-col items-center gap-1 px-5 py-2 rounded-lg transition-all ${
              activeView === item.id ? "text-kev-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
