"use client"

import { useState } from "react"
import Image from "next/image"
import { useApp } from "@/context/app-context"
import { PortfolioOverview } from "@/components/portfolio-overview"
import { ProgressDashboard } from "@/components/progress-dashboard"
import { ProjectsList } from "@/components/projects-list"
import { MobileNav } from "@/components/mobile-nav"
import { SocialLinks, WHATSAPP_COMMUNITY } from "@/components/social-links"
import { MessageCircle, ArrowUpRight } from "lucide-react"
import { ManifestoView } from "@/components/manifesto-view"
import { EarlyWall } from "@/components/early-wall"
import { Sponsors } from "@/components/sponsors"
import { PrimePipeline } from "@/components/prime-pipeline"
import { Roadmap } from "@/components/roadmap"
import { IntroSplash } from "@/components/intro-splash"
import { Reveal } from "@/components/reveal"
import { ShareButton } from "@/components/share-button"
import { LiveViewers } from "@/components/live-viewers"
import { Changelog } from "@/components/changelog"
import { NotifyForm } from "@/components/notify-form"
import { ScrollProgress } from "@/components/scroll-progress"
import { WhatsAppPopup } from "@/components/whatsapp-popup"
import { Comprobantes } from "@/components/comprobantes"
import { useRouter } from "next/navigation"

export type ActiveView = "dashboard" | "pulse" | "manifesto"

// Etiqueta editorial de sección. accent estratégico: azul = visión/plan · rojo = dinero/urgencia.
function SectionLabel({
  index,
  eyebrow,
  title,
  accent,
}: {
  index: string
  eyebrow: string
  title?: string
  accent?: "azul" | "rojo"
}) {
  const [first, ...rest] = (title ?? "").split(" ")
  const serifCls = accent === "rojo" ? " text-rojo" : accent === "azul" ? " text-azul" : ""
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className={`gold-tick${accent === "rojo" ? " tick-rojo" : ""}`} />
          <div className="section-eyebrow">{eyebrow}</div>
        </div>
        {title && (
          <h2 className="mt-2.5 leading-[0.95]">
            <span className="font-display font-extrabold tracking-tight text-3xl md:text-5xl">{first}</span>
            {rest.length > 0 && (
              <span className={`font-serif-display italic text-3xl md:text-5xl${serifCls}`}> {rest.join(" ")}</span>
            )}
          </h2>
        )}
      </div>
      <span className="font-display font-extrabold text-foreground/[0.10] text-4xl md:text-6xl leading-none number-display">
        {index}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard")
  const { t } = useApp()
  const router = useRouter()

  // "Ranking" vive en su propia página (/ranking).
  const goToRanking = () => router.push("/ranking")

  const navItems = [
    { id: "dashboard" as const, label: t.nav.dashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse },
    { id: "manifesto" as const, label: t.nav.manifesto },
  ]

  const renderHome = () => (
    <div className="space-y-24 md:space-y-32">
      {/* Hero + espectadores en vivo */}
      <div className="space-y-6 md:space-y-8">
        <Reveal>
          <PortfolioOverview />
        </Reveal>
        <LiveViewers />
      </div>

      {/* La bitácora: actualizaciones del reto */}
      <section>
        <Reveal>
          <SectionLabel index="01" eyebrow="En vivo" title="La bitácora" />
        </Reveal>
        <Changelog />
      </section>

      {/* La ruta: hitos de dinero + travesía */}
      <section>
        <Reveal>
          <SectionLabel index="02" eyebrow="La ruta" title="Los hitos" />
        </Reveal>
        <Roadmap />
      </section>

      {/* Comprobantes: pruebas reales de pagos de clientes de PRIME */}
      <section>
        <Reveal>
          <SectionLabel index="03" eyebrow="Pruebas reales" title="Los comprobantes" accent="azul" />
        </Reveal>
        <Reveal delay={80}>
          <Comprobantes />
        </Reveal>
      </section>

      {/* Sumate: comunidad de WhatsApp + aviso de hitos */}
      <section>
        <Reveal>
          <SectionLabel index="04" eyebrow="Sumate" title="No te lo pierdas" accent="rojo" />
        </Reveal>
        <Reveal delay={60}>
          <a
            href={WHATSAPP_COMMUNITY}
            target="_blank"
            rel="noopener noreferrer"
            className="lift mb-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/40 px-5 py-5 md:px-7 hover:border-foreground/20 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <span className="shrink-0 w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </span>
              <div>
                <div className="font-display font-bold text-base md:text-lg tracking-tight">
                  Unite a la comunidad
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Grupo de WhatsApp del reto · detrás de escena y avisos en vivo
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </a>
        </Reveal>
        <Reveal delay={100}>
          <NotifyForm />
        </Reveal>
      </section>

      {/* El muro del Día 1 */}
      <Reveal>
        <EarlyWall />
      </Reveal>

      {/* El motor: PRIME */}
      <section>
        <Reveal>
          <SectionLabel index="05" eyebrow="El motor" title="PRIME" accent="azul" />
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
            {/* Bandera a cuadros (divisor) — acento dorado */}
            <div className="checker h-2 w-28 mx-auto mt-9" style={{ color: "var(--gold)", opacity: 0.55 }} />
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
                  <span className="font-serif-display italic text-3xl md:text-5xl text-rojo">reales</span>
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
      <ScrollProgress />

      {/* Cielo F2.3: luz radial arriba al centro, celeste en los bordes, fundido a blanco */}
      <div
        className="pointer-events-none fixed inset-0 z-0 dark:hidden"
        style={{
          background:
            "linear-gradient(to bottom, rgba(252,253,254,0) 0%, rgba(252,253,254,0) 20%, rgba(252,253,254,0.9) 55%, #fcfdfe 75%), radial-gradient(130% 90% at 50% -8%, #fdfdfc 0%, #cfe4f5 55%, #a8cdea 100%)",
        }}
      />
      {/* Glow ambiental (solo oscuro) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-white/[0.04] to-transparent z-0 hidden dark:block" />

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
              <button
                onClick={goToRanking}
                className="px-3.5 py-2 rounded-full text-sm transition-all press-effect text-muted-foreground hover:text-foreground"
              >
                Ranking
              </button>
            </nav>
            <ShareButton />
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-0">
        <div key={activeView} className="view-fade">{renderContent()}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-14 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 flex flex-col items-center gap-3 text-center">
          <span className="font-display font-extrabold uppercase tracking-tighter text-2xl md:text-3xl">
            KEV PROJECT GTA
          </span>
          <p className="font-serif-display italic text-muted-foreground text-sm md:text-base">
            De $10 a un Mercedes — en público, desde Bolivia.
          </p>
          <div className="gold-rule my-2" />
          <SocialLinks />
        </div>
      </footer>

      {/* Nav flotante (móvil) */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} onRanking={goToRanking} />

      {/* Invitación a la comunidad de WhatsApp */}
      <WhatsAppPopup />
    </div>
  )
}
