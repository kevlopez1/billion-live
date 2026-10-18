"use client"

import { AlertTriangle, Lightbulb, Loader2, PuzzleIcon, ShieldAlert, Sparkles, X } from "lucide-react"
import { ANCLA, ETIQUETA_SECCION, ETIQUETA_TIPO, type Hallazgo, type Revision, type Tipo } from "@/lib/revision"

// ──────────────────────────────────────────────────────────────
// LO QUE ENCUENTRA LA IA
//
// No corrige sola y no guarda nada: señala, y la tijera la decide una persona.
// Mismo criterio que scripts/sin-relleno.py.
//
// Cada hallazgo lleva al bloque del que habla. Un informe que no se puede
// seguir hasta el texto es un informe que no se arregla.
// ──────────────────────────────────────────────────────────────

const ICONO: Record<Tipo, typeof AlertTriangle> = {
  contradiccion: AlertTriangle,
  hueco: PuzzleIcon,
  riesgo: ShieldAlert,
  mejora: Lightbulb,
}

const COLOR: Record<string, string> = {
  alta: "border-rojo/45 bg-rojo/[0.07]",
  media: "border-gold/40 bg-gold/[0.05]",
  baja: "border-border bg-card/40",
}

export function PanelRevision({
  revision,
  cargando,
  error,
  uso,
  onCerrar,
  onRevisar,
}: {
  revision: Revision | null
  cargando: boolean
  error: string
  uso: { entrada: number; salida: number; costoUsd: number } | null
  onCerrar: () => void
  onRevisar: () => void
}) {
  const ir = (h: Hallazgo) => document.getElementById(ANCLA[h.seccion])?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <aside className="mb-8 rounded-2xl border border-gold/35 bg-gold/[0.03] p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-gold" />
        <h2 className="font-display text-[15px] font-bold tracking-tight">Lo que encontró la IA</h2>
        <button onClick={onCerrar} aria-label="Cerrar" className="ml-auto rounded-lg p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {cargando && (
        <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Leyendo el manual entero y comparándolo consigo mismo. Tarda entre 20 y 40 segundos.
        </p>
      )}

      {!cargando && error && (
        <div className="py-2">
          <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-rojo">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
          <button onClick={onRevisar} className="mt-3 rounded-xl border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-gold hover:text-gold">
            Intentarlo de nuevo
          </button>
        </div>
      )}

      {!cargando && !error && revision && (
        <>
          <p className="mb-4 text-[13.5px] leading-relaxed text-muted-foreground">{revision.resumen}</p>

          {revision.hallazgos.length === 0 ? (
            <p className="rounded-xl border border-border bg-card/40 px-3.5 py-3 text-[13px] text-muted-foreground">
              Sin hallazgos. El manual no se contradice y no le falta nada obvio.
            </p>
          ) : (
            <ul className="space-y-2">
              {revision.hallazgos.map((h, i) => {
                const Icono = ICONO[h.tipo]
                return (
                  <li key={i}>
                    <button
                      onClick={() => ir(h)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-foreground/30 ${COLOR[h.gravedad]}`}
                    >
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {ETIQUETA_TIPO[h.tipo]}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground/70">· {ETIQUETA_SECCION[h.seccion]}</span>
                      </span>
                      <span className="mt-1.5 block font-display text-[14px] font-semibold leading-snug">{h.titulo}</span>
                      <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{h.detalle}</span>
                      <span className="mt-2 block text-[12.5px] leading-snug text-foreground/85">
                        <b className="font-semibold">Qué hacer:</b> {h.accion}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {uso && (
            // El costo se muestra porque lo paga Kev. Un gasto invisible se
            // vuelve un gasto que nadie controla.
            <p className="mt-3.5 text-[11px] tabular-nums text-muted-foreground/70">
              {uso.entrada.toLocaleString("es")} tokens de entrada · {uso.salida.toLocaleString("es")} de salida ·
              US$ {uso.costoUsd.toFixed(4)}
            </p>
          )}
        </>
      )}
    </aside>
  )
}
