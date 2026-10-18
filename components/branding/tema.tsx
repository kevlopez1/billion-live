"use client"

import { useEffect, useState } from "react"
import { Moon, Sun, Laptop } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// El interruptor de tema.
//
// Hasta ahora el sitio decidía el tema por la HORA del día: antes de las 7 o
// después de las 19, oscuro. Sin preguntar y sin poder cambiarlo. Aquí se
// elige, y la elección se guarda.
//
// "Automático" conserva esa regla de la hora, que es la que da el efecto de
// que el sitio acompaña el día.
// ──────────────────────────────────────────────────────────────

export type Tema = "claro" | "oscuro" | "auto"
const LLAVE = "kev-tema"

export function aplicarTema(t: Tema) {
  const h = new Date().getHours()
  const oscuro = t === "oscuro" || (t === "auto" && (h < 7 || h >= 19))
  document.documentElement.classList.toggle("dark", oscuro)
}

const OPCIONES: { id: Tema; icono: typeof Sun; etiqueta: string }[] = [
  { id: "claro", icono: Sun, etiqueta: "Claro" },
  { id: "oscuro", icono: Moon, etiqueta: "Oscuro" },
  { id: "auto", icono: Laptop, etiqueta: "Automático" },
]

export function Tema() {
  const [tema, setTema] = useState<Tema>("auto")
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const guardado = (localStorage.getItem(LLAVE) as Tema | null) ?? "auto"
    setTema(guardado)
    aplicarTema(guardado)
    setListo(true)
  }, [])

  const elegir = (t: Tema) => {
    setTema(t)
    try {
      localStorage.setItem(LLAVE, t)
    } catch {
      // Navegador en privado o con el almacenamiento bloqueado: el tema
      // igual se aplica, solo no se recuerda.
    }
    aplicarTema(t)
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-card/40 p-0.5">
      {OPCIONES.map((o) => {
        const Icono = o.icono
        const activo = listo && tema === o.id
        return (
          <button
            key={o.id}
            onClick={() => elegir(o.id)}
            title={o.etiqueta}
            aria-label={`Tema ${o.etiqueta.toLowerCase()}`}
            aria-pressed={activo}
            className={`rounded-lg p-1.5 transition-colors ${
              activo ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icono className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
