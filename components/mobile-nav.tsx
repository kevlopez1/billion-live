"use client"

import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Settings,
  Activity,
  BookOpen,
  Milestone,
  MoreHorizontal,
  Target,
  Calendar,
  Trophy,
} from "lucide-react"
import { useState } from "react"
import type { ActiveView } from "@/app/page"
import { useApp } from "@/context/app-context"

interface MobileNavProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const [showMore, setShowMore] = useState(false)
  const { t } = useApp()

  const primaryNavItems = [
    { id: "dashboard" as const, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse.split(" ")[0], icon: Activity },
    { id: "projects" as const, label: t.nav.projects, icon: Briefcase },
  ]

  const secondaryNavItems = [
    { id: "goals" as const, label: t.nav.goals, icon: Target },
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "achievements" as const, label: "Achievements", icon: Trophy },
    { id: "manifesto" as const, label: t.nav.manifesto, icon: BookOpen },
    { id: "history" as const, label: t.nav.journey.split(" ").pop(), icon: Milestone },
    { id: "analytics" as const, label: t.nav.analytics, icon: BarChart3 },
    { id: "settings" as const, label: t.nav.settings, icon: Settings },
  ]

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === activeView)

  return (
    <>
      {/* Expanded menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMore(false)}
        >
          <div className="absolute bottom-20 left-4 right-4 glass-card p-2" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-1">
              {secondaryNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id)
                    setShowMore(false)
                  }}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg transition-all ${
                    activeView === item.id
                      ? "text-kev-primary bg-kev-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card !rounded-none border-t border-border/50 px-2 pt-2 pb-24 lg:hidden">
        <div className="flex items-center justify-around">
          {primaryNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                activeView === item.id
                  ? "text-kev-primary bg-kev-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
              showMore || isSecondaryActive
                ? "text-kev-primary bg-kev-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.nav.more}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
