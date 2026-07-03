"use client"

import { ShieldCheck } from "lucide-react"

// La transparencia radical es EL diferenciador del reto frente al
// "me lo compró mi papá": el contador solo sube con revenue real de PRIME.
const faqs = [
  {
    q: "¿De dónde sale el número del contador?",
    a: "Del revenue real de PRIME (empleados de IA para empresas, primebusiness.live). Cada dólar del contador es un cobro real a un cliente real. Nada de números inflados ni 'estimados'.",
  },
  {
    q: "¿Es dinero heredado o me lo compró alguien?",
    a: "No. El reto empezó con $10, en cámara, desde Santa Cruz de la Sierra, en plena crisis económica de Bolivia. Todo lo demás se genera en público y queda documentado video por video.",
  },
  {
    q: "¿Qué pasa si un día no entra plata?",
    a: "El contador no se mueve. Así de simple. Los días malos también se publican: la racha de intentos es la métrica más honesta del reto, no una racha de éxitos inventados.",
  },
  {
    q: "¿Los $10 iniciales se usan?",
    a: "No se tocan hasta el final del reto. Todo lo recaudado se genera desde cero, en cámara.",
  },
]

export function Transparencia() {
  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="px-6 py-8 md:px-8 md:py-10">
        <div className="flex items-start gap-3 mb-6">
          <ShieldCheck className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-muted-foreground max-w-2xl">
            Este reto existe para responder a un comentario:{" "}
            <span className="font-serif-display italic text-foreground">"me lo compró mi papá"</span>.
            La única respuesta válida es que todo sea verificable.
          </p>
        </div>

        <div className="divide-y divide-border">
          {faqs.map((f, i) => (
            <details key={i} className="group py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="font-display font-bold tracking-tight text-sm md:text-base pr-4">
                  {f.q}
                </span>
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45 text-lg leading-none">
                  +
                </span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-2xl">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
