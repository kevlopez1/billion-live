"use client"

import { HeartHandshake, Video, Bot } from "lucide-react"
import { Reveal } from "@/components/reveal"

const WA_BECA =
  "https://wa.me/59172258926?text=" +
  encodeURIComponent("Hola Kev, postulo mi negocio a una Beca PRIME del reto.")

// Idea ancla del reto: por cada hito, un Empleado AI gratis a un negocio
// boliviano, instalado en cámara. El éxito no se presume — se comparte.
const pasos = [
  {
    icon: Video,
    title: "Se cumple un hito",
    text: "Cada vez que el contador cruza un hito del reto, se activa una beca.",
  },
  {
    icon: Bot,
    title: "Un negocio boliviano gana",
    text: "Elijo un negocio real de Bolivia y le instalo un Empleado AI de PRIME, gratis.",
  },
  {
    icon: HeartHandshake,
    title: "Todo en cámara",
    text: "La instalación se documenta en el reto: el negocio gana un empleado 24/7 y vos lo ves pasar en vivo.",
  },
]

export function BecasPrime() {
  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="px-6 py-8 md:px-8 md:py-10">
        <p className="text-sm text-muted-foreground max-w-2xl">
          El éxito no se presume, se comparte con la economía que me formó. Por{" "}
          <span className="text-foreground font-semibold">cada hito del reto</span>, instalo un
          Empleado AI de PRIME <span className="text-foreground font-semibold">gratis</span> a un
          negocio boliviano, en cámara.
        </p>

        <div className="mt-7 grid sm:grid-cols-3 gap-4">
          {pasos.map((p, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="rounded-xl border border-border bg-background/50 p-5 h-full">
                <p.icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
                <div className="font-display font-bold tracking-tight mt-3">{p.title}</div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <a
            href={WA_BECA}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Postular mi negocio
          </a>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Solo negocios reales de Bolivia 🇧🇴
          </span>
        </div>
      </div>
    </div>
  )
}
