import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, ShieldCheck, TrendingUp, Users, Target, Quote, Mail, Building2 } from "lucide-react"
import { SocialLinks } from "@/components/social-links"

export const metadata: Metadata = {
  title: "Prensa & Prueba",
  description:
    "Métricas verificables, prensa y testimonios del reto KEV PROJECT GTA: de $10 a un Mercedes-AMG Mansory, desde Bolivia, con el contador alimentado por el revenue real de PRIME.",
  alternates: { canonical: "/prensa" },
}

const verifiable = [
  {
    icon: TrendingUp,
    label: "Contador del reto",
    value: "Revenue real de PRIME",
    note: "Actualizado del lado del servidor. En camino a auto-sincronizarse con el procesador de pagos.",
  },
  {
    icon: Target,
    label: "Meta pública",
    value: "$450.000",
    note: "Mercedes-AMG GT 63 Mansory. Capa secreta de largo plazo: el imperio.",
  },
  {
    icon: Users,
    label: "Audiencia (Día 1)",
    value: "1.009",
    note: "TikTok 887 · YouTube 104 · Instagram 18 · Facebook. Números reales, sin inflar.",
  },
]

const testimonials = [
  { quote: "Que el contador sea revenue REAL de PRIME le da otra credibilidad.", author: "Diego R." },
  { quote: "Bolivia necesitaba a alguien construyendo en público sin vender humo.", author: "Mauricio T." },
  { quote: "Las Becas PRIME son lo mejor del reto: ayudar mientras construís.", author: "Valeria C." },
]

export default function PrensaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Centro de Mando
          </Link>
          <SocialLinks />
        </nav>

        {/* Hero */}
        <header className="max-w-3xl mb-20">
          <div className="flex items-center gap-2 text-muted-foreground mb-5">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-[0.18em]">Prensa & Prueba</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter text-balance leading-[1.05]">
            El reto que se puede auditar.
          </h1>
          <p className="text-lg text-muted-foreground mt-6 font-light text-pretty leading-relaxed">
            De $10 a un Mercedes-AMG GT 63 Mansory, desde Bolivia, en público. A diferencia del flex tradicional, acá el
            contador no se inventa: se alimenta del <span className="text-foreground">revenue real de PRIME</span>{" "}
            (empleados de IA para empresas). El auto es la carnada; el imperio es la meta.
          </p>
        </header>

        {/* Verifiable metrics */}
        <section className="mb-20">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6">Métricas verificables</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {verifiable.map((m) => (
              <div key={m.label} className="glass-card p-6">
                <m.icon className="w-5 h-5 text-muted-foreground mb-6" strokeWidth={1.5} />
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{m.label}</div>
                <div className="text-2xl font-light number-display mt-1">{m.value}</div>
                <p className="text-xs text-muted-foreground mt-3 font-light leading-relaxed">{m.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="mb-20 glass-card p-8 md:p-10">
          <h2 className="text-lg font-medium tracking-tight mb-4">Cómo se calcula el contador</h2>
          <p className="text-muted-foreground font-light leading-relaxed max-w-3xl">
            El número grande del Centro de Mando representa el revenue acumulado real de PRIME, la empresa de empleados de
            IA fundada por Kev López. Se actualiza desde el servidor con una llave privada — no desde el navegador — para
            que sea imposible de manipular. La hoja de ruta contempla conectar el contador directamente al procesador de
            pagos, de modo que cada dólar mostrado sea trazable hasta una transacción real.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              Prioridad de métricas: <span className="text-foreground">MRR · clientes · retención</span>
            </span>
            <span className="text-muted-foreground">
              Moat: <span className="text-foreground">datos propios + nicho</span>
            </span>
          </div>
        </section>

        {/* Press */}
        <section className="mb-20">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6">Prensa</h2>
          <div className="glass-card p-8 md:p-10 text-center">
            <p className="text-muted-foreground font-light max-w-xl mx-auto">
              ¿Sos prensa o inversor? Esta es una historia de construcción en público desde la crisis: IA, LatAm y una
              meta imposible. Escribinos para acceder al press kit, datos y entrevistas.
            </p>
            <a
              href="mailto:kev@primebusiness.live?subject=Prensa%20KEV%20PROJECT%20GTA"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 btn-accent rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Solicitar press kit
            </a>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mb-20">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6">Testimonios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.author} className="glass-card p-6">
                <Quote className="w-5 h-5 text-muted-foreground/50 mb-4" />
                <p className="text-sm leading-relaxed text-pretty">{t.quote}</p>
                <p className="text-xs text-muted-foreground mt-4">— {t.author}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="mb-20 glass-card p-8 md:p-10">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-[0.18em]">Sobre Kev & PRIME</span>
          </div>
          <p className="text-muted-foreground font-light leading-relaxed max-w-3xl">
            Benjamín Kevin López Mamani (21), Santa Cruz de la Sierra. Fundador de PRIME — empleados de IA para empresas.
            Construye su ecosistema (PRIME · KEV Strategy · Insightful University) en público, con una ruta clara hacia
            EE.UU. (O-1 → EB-1A) y PRIME como Delaware C-Corp. Cada hito del reto desbloquea una Beca PRIME: IA instalada
            gratis a un negocio boliviano, en cámara.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>KEV PROJECT GTA · PRIME · Hecho en Bolivia 🇧🇴</span>
          <SocialLinks />
        </footer>
      </div>
    </div>
  )
}
