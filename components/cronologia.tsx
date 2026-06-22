"use client"

import { Rocket, DollarSign, Clapperboard, TrendingUp, Globe, Trophy } from "lucide-react"
import { Reveal } from "@/components/reveal"

const steps = [
  {
    phase: "Semana 1–2",
    title: "El Command Center en pie",
    desc: "La web + las cuentas en todas las redes. La base pública del reto.",
    icon: Rocket,
  },
  {
    phase: "Mes 1",
    title: "El primer dólar",
    desc: "Cerrar el primer cliente de PRIME. El contador se mueve de verdad.",
    icon: DollarSign,
  },
  {
    phase: "Mes 1–2",
    title: "El motor de contenido",
    desc: "1 video pilar por semana → clips en todas las redes. Apalancamiento media.",
    icon: Clapperboard,
  },
  {
    phase: "Mes 2–4",
    title: "De $1K a $10K",
    desc: "Repetir lo que funciona. Validar el modelo con números reales.",
    icon: TrendingUp,
  },
  {
    phase: "Mes 4–8",
    title: "Escalar + el mundo",
    desc: "Más clientes PRIME, viajes (Token2049…) y prensa. Apalancamiento total.",
    icon: Globe,
  },
  {
    phase: "Mes 6–12",
    title: "El Mercedes — y EE.UU.",
    desc: "$450.000 = el AMG Mansory. Y arranca la ruta a Estados Unidos.",
    icon: Trophy,
  },
]

export function Cronologia() {
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <Reveal key={i} delay={i * 60}>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 px-4 py-4 md:px-5 transition-colors hover:border-foreground/20">
            <span className="shrink-0 w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center">
              <s.icon className="w-5 h-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.phase}</div>
              <div className="font-display font-bold text-base md:text-lg leading-tight">{s.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
            <span className="font-display font-extrabold text-3xl md:text-4xl text-foreground/[0.12] number-display tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
