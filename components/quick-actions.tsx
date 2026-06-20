import { Play, Gift, Building2, Share2, ArrowUpRight } from "lucide-react"

// Accesos rápidos estilo app de banco (BNB): 2 botones grandes + fila de círculos.
const quickCircles = [
  { label: "Becas PRIME", icon: Gift, href: "/prensa" },
  { label: "Contratar PRIME", icon: Building2, href: "https://primebusiness.live" },
  { label: "YouTube", icon: Play, href: "https://www.youtube.com/@KevProjectGTA" },
  { label: "Compartir", icon: Share2, href: "https://www.tiktok.com/@kev.project.gta" },
]

export function QuickActions() {
  return (
    <div className="space-y-5">
      {/* Dos botones grandes (estilo Cobra QR / Paga QR) */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <a
          href="https://www.tiktok.com/@kev.project.gta"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent flex items-center justify-center gap-2 rounded-2xl px-5 py-5 text-sm md:text-base font-semibold"
        >
          <Play className="w-5 h-5 fill-current" />
          Seguí el reto
        </a>
        <a
          href="https://www.youtube.com/@KevProjectGTA"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card flex items-center justify-center gap-2 rounded-2xl px-5 py-5 text-sm md:text-base font-semibold hover:border-foreground/20 transition-colors"
        >
          <ArrowUpRight className="w-5 h-5 text-kev-primary" />
          Mirá el reto
        </a>
      </div>

      {/* Fila de accesos circulares */}
      <div className="grid grid-cols-4 gap-2">
        {quickCircles.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target={a.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-2 text-center"
          >
            <span className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-card border border-border shadow-sm flex items-center justify-center group-hover:border-kev-primary/40 group-hover:-translate-y-0.5 transition-all">
              <a.icon className="w-5 h-5 md:w-6 md:h-6 text-kev-primary" strokeWidth={1.75} />
            </span>
            <span className="text-[10px] md:text-[11px] text-muted-foreground leading-tight">{a.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
