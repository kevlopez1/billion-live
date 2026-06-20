"use client"

import { useState } from "react"
import Image from "next/image"
import { useApp } from "@/context/app-context"
import { PortfolioOverview } from "@/components/portfolio-overview"
import { MetricsGrid } from "@/components/metrics-grid"
import { ProjectsList } from "@/components/projects-list"
import { MobileNav } from "@/components/mobile-nav"
import { SocialLinks } from "@/components/social-links"
import { DailyPulseView } from "@/components/daily-pulse-view"
import { ManifestoView } from "@/components/manifesto-view"
import { SocialPowerGrid } from "@/components/social-power-grid"
import { LatestContent } from "@/components/latest-content"
import { ChallengeStatement } from "@/components/challenge-statement"
import { LayoutDashboard, Activity, BookOpen } from "lucide-react"

export type ActiveView = "dashboard" | "pulse" | "manifesto"

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard")
  const { metrics, t } = useApp()

  const navItems = [
    { id: "dashboard" as const, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse, icon: Activity },
    { id: "manifesto" as const, label: t.nav.manifesto, icon: BookOpen },
  ]

  const renderContent = (mobile = false) => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className={`view-transition stagger-children ${mobile ? "space-y-5" : "space-y-6 md:space-y-8"}`}>
            <PortfolioOverview />
            <ChallengeStatement />
            <MetricsGrid />
            <div className="glass-card overflow-hidden">
              <ProjectsList />
            </div>
            <LatestContent />
            <SocialPowerGrid />
          </div>
        )
      case "pulse":
        return (
          <div className="view-transition">
            <DailyPulseView />
          </div>
        )
      case "manifesto":
        return (
          <div className="view-transition">
            <ManifestoView />
          </div>
        )
      default:
        return null
    }
  }

  const getViewTitle = (view: ActiveView) => {
    const map: Record<ActiveView, string> = {
      dashboard: t.nav.dashboard,
      pulse: t.nav.dailyPulse,
      manifesto: t.nav.manifesto,
    }
    return map[view]
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen relative z-10">
        <aside className="w-64 border-r border-border/50 backdrop-blur-xl bg-background/60 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Image
                src="/images/kev.jpg"
                alt="Kev López"
                width={36}
                height={36}
                className="rounded-lg object-cover w-9 h-9"
              />
              <div>
                <span className="text-sm font-semibold text-foreground block">KEV PROJECT GTA</span>
                <span className="text-xs text-muted-foreground">De $10 al Mansory</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all press-effect ${
                  activeView === item.id
                    ? "bg-kev-primary/15 text-kev-primary border border-kev-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-border/50">
            <div className="glass-card p-3 !bg-kev-primary/5 !border-kev-primary/20">
              <div className="text-xs text-muted-foreground mb-1">Contador del reto · PRIME</div>
              <div className="text-lg font-semibold text-kev-primary number-display">
                ${metrics.netWorth.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Meta: $450.000 · Mansory AMG GT</div>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6 lg:p-8 overflow-auto">
            <div className="max-w-[1400px] mx-auto">{renderContent(false)}</div>
          </main>

          <footer className="px-6 py-3 border-t border-border/50 backdrop-blur-xl bg-background/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>KEV PROJECT GTA · PRIME</span>
              <SocialLinks />
              <span className="tracking-wide">Hecho en Bolivia 🇧🇴</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col min-h-screen pb-20 relative z-10">
        <header className="sticky top-0 z-40 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/70">
          <div className="flex items-center gap-3">
            <Image
              src="/images/kev.jpg"
              alt="Kev López"
              width={28}
              height={28}
              className="rounded-full object-cover w-7 h-7"
            />
            <span className="text-sm font-medium">{getViewTitle(activeView)}</span>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="space-y-4">{renderContent(true)}</div>
        </main>

        <footer className="px-4 py-6 flex flex-col items-center gap-3 border-t border-border/50">
          <SocialLinks />
          <span className="text-[11px] text-muted-foreground tracking-wide">
            KEV PROJECT GTA · PRIME · Hecho en Bolivia 🇧🇴
          </span>
        </footer>

        <MobileNav activeView={activeView} onViewChange={setActiveView} />
      </div>
    </div>
  )
}
