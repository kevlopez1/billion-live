"use client"

import { useState } from "react"
import Image from "next/image"
import { useApp } from "@/context/app-context"
import { PortfolioOverview } from "@/components/portfolio-overview"
import { ProgressDashboard } from "@/components/progress-dashboard"
import { ProjectsList } from "@/components/projects-list"
import { MobileNav } from "@/components/mobile-nav"
import { SocialLinks } from "@/components/social-links"
import { ManifestoView } from "@/components/manifesto-view"
import { QuickActions } from "@/components/quick-actions"
import { EarlyWall } from "@/components/early-wall"
import { Sponsors } from "@/components/sponsors"
import { PrimePipeline } from "@/components/prime-pipeline"
import { Roadmap } from "@/components/roadmap"
import { IntroSplash } from "@/components/intro-splash"
import { Reveal } from "@/components/reveal"
import { ShareButton } from "@/components/share-button"

export type ActiveView = "dashboard" | "pulse" | "manifesto"

// Etiqueta editorial de sección (estilo LATHOS: mezcla bold + serif itálica)
function SectionLabel({ index, eyebrow, title }: { index: string; eyebrow: string; title?: string }) {
  const [first, ...rest] = (title ?? "").split(" ")
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <div className="section-eyebrow">{eyebrow}</div>
        {title && (
          <h2 className="mt-2 leading-[0.95]">
            <span className="font-display font-extrabold tracking-tight text-3xl md:text-5xl">{first}</span>
            {rest.length > 0 && (
              <span className="font-serif-display italic text-3xl md:text-5xl"> {rest.join(" ")}</span>
            )}
          </h2>
        )}
      </div>
      <span className="font-display font-extrabold text-foreground/[0.12] text-4xl md:text-6xl leading-none number-display">
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
    <div className="space-y-24 md:space-y-32">
      {/* Hero */}
      <Reveal>
        <PortfolioOverview />
      </Reveal>

      {/* La ruta: hitos de dinero + travesía */}
      <section>
        <Reveal>
          <SectionLabel index="01" eyebrow="La ruta" title="Los hitos" />
        </Reveal>
        <Roadmap />
      </section>

      {/* Seguí el reto */}
      <section>
        <Reveal>
          <SectionLabel index="02" eyebrow="Sumate" title="Seguí el reto" />
        </Reveal>
        <Reveal delay={80}>
          <QuickActions />
        </Reveal>
      </section>

      {/* El muro del Día 1 */}
      <Reveal>
        <EarlyWall />
      </Reveal>

      {/* El imperio: las marcas */}
      <section>
        <Reveal>
          <SectionLabel index="03" eyebrow="El imperio" title="Las marcas" />
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
            <ProjectsList />
          </div>
        </Reveal>
      </section>

      {/* Sponsors */}
      <Reveal>
        <Sponsors />
      </Reveal>

      {/* Cierre — statement a sangre, tipografía gigante + motivo racing */}
      <Reveal>
        <div className="-mx-4 md:-mx-6 relative overflow-hidden bg-[#0a0a0a] text-white border-y border-white/10 px-6 py-20 md:py-28 text-center">
          {/* Líneas de velocidad (sutil) */}
          <div className="pointer-events-none absolute inset-0 text-white opacity-[0.05] speed-lines" />
          <div className="relative max-w-5xl mx-auto">
            <p className="font-serif-display italic text-white/50 text-xl md:text-3xl">El auto es la carnada</p>
            <p className="font-display font-extrabold uppercase tracking-tighter text-6xl sm:text-8xl md:text-9xl leading-[0.85] mt-1">
              El imperio<br />es la meta
            </p>
            {/* Bandera a cuadros (divisor) */}
            <div className="checker text-white/25 h-2 w-28 mx-auto mt-9" />
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              De $10 al Mercedes · desde Bolivia
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )

  const renderContent = () => {
    switch (activeView) {
      case "pulse":
        return (
          <div className="space-y-7">
            <Reveal>
              <div className="border-b border-border pb-4">
                <div className="section-eyebrow">El reto en vivo</div>
                <h2 className="mt-2 leading-[0.95]">
                  <span className="font-display font-extrabold uppercase tracking-tighter text-3xl md:text-5xl">Números </span>
                  <span className="font-serif-display italic text-3xl md:text-5xl">reales</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-3 max-w-lg">
                  Las estadísticas reales del reto: cuánto, cómo y cuándo. Cada número es revenue real de PRIME, no inventado.
                </p>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <ProgressDashboard />
            </Reveal>
            <Reveal delay={120}>
              <PrimePipeline />
            </Reveal>
          </div>
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

      {/* Navbar flotante (isla redondeada) */}
      <header className="sticky top-3 z-40 px-3 md:px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-background/70 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] px-4 md:px-5 h-14 flex items-center justify-between">
          <button onClick={() => setActiveView("dashboard")} className="flex items-center gap-2.5 press-effect">
            <Image
              src="/images/kev.jpg"
              alt="Kev López"
              width={32}
              height={32}
              className="rounded-full object-cover object-[center_80%] w-8 h-8 ring-1 ring-foreground/15"
            />
            <div className="text-left leading-none">
              <span className="block text-sm font-display font-extrabold tracking-tight">KEV PROJECT GTA</span>
              <span className="block text-[10px] text-muted-foreground tracking-wide mt-0.5">De $10 a un Mercedes</span>
            </div>
          </button>

          <div className="flex items-center gap-2">
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
            <ShareButton />
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-12 lg:pb-16">
        <div key={activeView} className="view-fade">{renderContent()}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 mt-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 flex flex-col items-center gap-4 text-center">
          <span className="font-display font-extrabold uppercase tracking-tighter text-xl">KEV PROJECT GTA</span>
          <SocialLinks />
          <span className="text-[11px] text-muted-foreground tracking-wide">
            PRIME · empleados de IA · Hecho en Bolivia 🇧🇴
          </span>
        </div>
      </footer>

      {/* Nav flotante (móvil) */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  )
}
