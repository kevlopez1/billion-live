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
import { QuickActions } from "@/components/quick-actions"
import { EarlyWall } from "@/components/early-wall"
import { Roadmap } from "@/components/roadmap"
import { Cronologia } from "@/components/cronologia"
import { IntroSplash } from "@/components/intro-splash"
import { Reveal } from "@/components/reveal"

export type ActiveView = "dashboard" | "pulse" | "manifesto"

// Etiqueta editorial de sección (estilo sitio pro: "01 — Título")
function SectionLabel({ index, eyebrow, title }: { index: string; eyebrow: string; title?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <div className="section-eyebrow">{eyebrow}</div>
        {title && (
          <h2 className="mt-2 font-display font-extrabold uppercase tracking-tighter text-2xl md:text-4xl leading-none">
            {title}
          </h2>
        )}
      </div>
      <span className="font-display font-extrabold text-foreground/15 text-3xl md:text-5xl leading-none number-display">
        {index}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard")
  const { t } = useApp()

  const navItems = [
    { id: "dashboard" as const, label: t.nav.dashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse },
    { id: "manifesto" as const, label: t.nav.manifesto },
  ]

  const renderHome = () => (
    <div className="space-y-20 md:space-y-28">
      {/* Hero */}
      <Reveal>
        <PortfolioOverview />
      </Reveal>

      {/* El auto: galería de fotos oficiales */}
      <section>
        <Reveal>
          <SectionLabel index="01" eyebrow="El auto" title="AMG GT 63 · Mansory" />
        </Reveal>
        <Reveal delay={80}>
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {["mansory-2", "mansory-3", "mansory-4", "mansory-1"].map((n, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-[86%] sm:w-[58%] lg:w-[48%] rounded-2xl overflow-hidden border border-border bg-[#101010]"
              >
                <img
                  src={`/images/car/${n}.jpg`}
                  alt="Mercedes-AMG GT 63 4-door por Mansory"
                  className="w-full aspect-[3/2] object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* La ruta: hitos de dinero + travesía */}
      <section>
        <Reveal>
          <SectionLabel index="02" eyebrow="La ruta" title="Los hitos" />
        </Reveal>
        <Roadmap />
      </section>

      {/* La cronología: el plan paso a paso */}
      <section>
        <Reveal>
          <div className="mb-6 border-b border-border pb-4">
            <div className="section-eyebrow">El plan</div>
            <h2 className="mt-2 leading-[0.95]">
              <span className="font-display font-extrabold tracking-tight text-2xl md:text-4xl">Paso </span>
              <span className="font-serif-display italic text-2xl md:text-4xl">a paso</span>
            </h2>
          </div>
        </Reveal>
        <Cronologia />
      </section>

      {/* Seguí el reto */}
      <section>
        <Reveal>
          <SectionLabel index="04" eyebrow="Sumate" title="Seguí el reto" />
        </Reveal>
        <Reveal delay={80}>
          <QuickActions />
        </Reveal>
      </section>

      {/* El muro del Día 1 */}
      <Reveal>
        <EarlyWall />
      </Reveal>

      {/* La prueba: números reales de PRIME */}
      <section>
        <Reveal>
          <SectionLabel index="05" eyebrow="La prueba" title="Números reales" />
        </Reveal>
        <Reveal delay={80}>
          <MetricsGrid />
        </Reveal>
      </section>

      {/* El imperio: las marcas */}
      <section>
        <Reveal>
          <SectionLabel index="06" eyebrow="El imperio" title="Las marcas" />
        </Reveal>
        <Reveal delay={80}>
          <div className="glass-card overflow-hidden">
            <ProjectsList />
          </div>
        </Reveal>
      </section>

      {/* Redes */}
      <Reveal>
        <SocialPowerGrid />
      </Reveal>
    </div>
  )

  const renderContent = () => {
    switch (activeView) {
      case "pulse":
        return (
          <Reveal>
            <DailyPulseView />
          </Reveal>
        )
      case "manifesto":
        return (
          <Reveal>
            <ManifestoView />
          </Reveal>
        )
      default:
        return renderHome()
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <IntroSplash />

      {/* Glow ambiental superior */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-white/[0.04] to-transparent z-0" />

      {/* Navbar minimalista (landing, no dashboard) */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <button onClick={() => setActiveView("dashboard")} className="flex items-center gap-2.5 press-effect">
            <Image
              src="/images/kev.jpg"
              alt="Kev López"
              width={32}
              height={32}
              className="rounded-full object-cover object-[center_30%] w-8 h-8 ring-1 ring-white/20"
            />
            <div className="text-left leading-none">
              <span className="block text-sm font-display font-extrabold tracking-tight">KEV PROJECT GTA</span>
              <span className="block text-[10px] text-muted-foreground tracking-wide mt-0.5">De $10 a un Mercedes</span>
            </div>
          </button>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`px-3.5 py-2 rounded-full text-sm transition-all press-effect ${
                  activeView === item.id
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-28 lg:pb-20">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 mt-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 flex flex-col items-center gap-4 text-center">
          <span className="font-display font-extrabold uppercase tracking-tighter text-xl">KEV PROJECT GTA</span>
          <SocialLinks />
          <span className="text-[11px] text-muted-foreground tracking-wide">
            PRIME · El auto es la carnada, el imperio es la meta · Hecho en Bolivia 🇧🇴
          </span>
        </div>
      </footer>

      {/* Nav flotante (móvil) */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  )
}
