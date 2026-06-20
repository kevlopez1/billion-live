import { Play, ArrowUpRight, Music2, Youtube } from "lucide-react"

// Contenido del reto. Para incrustar un video específico, pega su URL aquí.
// (Mandame 1 URL de TikTok y 1 de YouTube y los dejo embebidos de verdad.)
const content = [
  {
    platform: "TikTok",
    icon: Music2,
    title: "El reto, en vivo",
    subtitle: "@kev.project.gta · donde pasa todo",
    url: "https://www.tiktok.com/@kev.project.gta",
    featured: true,
  },
  {
    platform: "YouTube",
    icon: Youtube,
    title: "De $10 al Mansory — desde Bolivia",
    subtitle: "@KevProjectGTA · long-form",
    url: "https://www.youtube.com/@KevProjectGTA",
    featured: false,
  },
]

export function LatestContent() {
  return (
    <div className="glass-card p-6 md:p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Mirá el reto</h3>
          <p className="text-sm text-muted-foreground mt-1 font-light">El contenido que mueve la máquina</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {content.map((c) => (
          <a
            key={c.platform}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-border hover:border-foreground/20 transition-colors"
          >
            {/* Placeholder cinematográfico (hasta incrustar el video real) */}
            <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-foreground/[0.06] to-transparent">
              <div className="w-14 h-14 rounded-full bg-foreground/[0.06] border border-border flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-foreground ml-0.5" fill="currentColor" />
              </div>
            </div>
            <div className="p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                  <c.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="text-[10px] uppercase tracking-[0.14em]">{c.platform}</span>
                </div>
                <div className="font-medium truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground font-light mt-0.5 truncate">{c.subtitle}</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
