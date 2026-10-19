"use client"

import { AlertTriangle } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"
import { ETIQUETA_ESTADO, type Contenido, type Estado } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// EL MAPA, POR SECCIONES
//
// Una tarjeta por sección, en el orden del documento. El alto de la tarjeta ES
// cuánto tiene esa sección, así que de un vistazo se ve cuál está gorda y cuál
// vacía.
//
// SIN un color por sección. La versión anterior le daba su propio tono a cada
// una: diez colores compitiendo, cada tarjeta gritando igual de fuerte, y leer
// eso cansa. El color aquí solo significa algo:
//
//   rojo    → falta (un bloque sin reglas, un formato sin beats)
//   verde   → esa red está en uso
//   ámbar   → esa red se decidió no usarla
//   gris    → todo lo demás
//
// Diez secciones no necesitan diez colores: necesitan diez nombres. Se
// distinguen por el título, el icono y el aire entre ellas, como en un
// documento de verdad.
//
// Columnas CSS y no una grilla: las tarjetas miden distinto (6 formatos contra
// 14 redes) y una grilla dejaría huecos del alto de la más larga.
// ──────────────────────────────────────────────────────────────

const ICONO: Record<Seccion, string> = {
  meta: "🏁", personaje: "👤", norte: "🧭", formatos: "🎬", edicion: "✂️",
  redes: "📡", produccion: "👕", enCola: "🎯", pendientes: "📌", hoy: "✨", futuro: "📈",
}

const PUNTO_RED: Record<Estado, string> = {
  usamos: "bg-kev-success",
  pendiente: "bg-muted-foreground/35",
  no: "bg-kev-warning",
}

// `vacio` = el ítem existe pero por dentro no tiene nada. Un bloque de edición
// sin reglas y un formato sin beats son huecos, y verlos es para lo que sirve
// este mapa. Contarlos como llenos sería mentir en el único sitio que no debe.
type Item = { texto: string; estado?: Estado; vacio?: boolean }
type Bloque = { id: Seccion; items: Item[] }

function bloques(c: Contenido): Bloque[] {
  const t = (xs: string[]): Item[] => xs.map((x) => x.trim()).filter(Boolean).map((texto) => ({ texto }))
  return [
    { id: "personaje", items: t([...c.personaje.fortalezas, ...c.personaje.debilidades, ...c.personaje.oportunidades]) },
    { id: "norte", items: t(c.norte.map((p) => p.titulo)) },
    {
      id: "formatos",
      items: c.formatos.filter((f) => f.nombre.trim()).map((f) => ({ texto: f.nombre.trim(), vacio: f.beats.length === 0 })),
    },
    {
      id: "edicion",
      items: c.edicion.bloques.filter((b) => b.titulo.trim()).map((b) => ({ texto: b.titulo.trim(), vacio: b.reglas.length === 0 })),
    },
    { id: "redes", items: c.redes.filter((r) => r.nombre.trim()).map((r) => ({ texto: r.nombre.trim(), estado: r.estado })) },
    { id: "produccion", items: t([...c.produccion.personaje, ...c.produccion.equipo]) },
    { id: "enCola", items: t(c.enCola.map((v) => v.titulo)) },
    { id: "pendientes", items: t(c.pendientes) },
    { id: "hoy", items: t(c.hoy.map((l) => l.titulo)) },
    { id: "futuro", items: t(c.futuro.map((l) => l.titulo)) },
  ]
}

export function Secciones({
  contenido,
  onIr,
  marcadas,
}: {
  contenido: Contenido
  onIr: (s: Seccion) => void
  /** Secciones con un hallazgo grave de la IA. */
  marcadas?: Set<string>
}) {
  return (
    <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
      {bloques(contenido).map(({ id, items }) => {
        const vacia = items.length === 0
        const faltan = items.filter((i) => i.vacio).length
        const marcada = marcadas?.has(id)
        return (
          <section
            key={id}
            className={`mb-5 break-inside-avoid overflow-hidden rounded-2xl border bg-card/40 ${
              marcada ? "border-rojo/45" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => onIr(id)}
              className="flex w-full items-center gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03]"
            >
              <span className="text-[15px] leading-none" aria-hidden>{ICONO[id]}</span>
              <span className="min-w-0 flex-1 truncate font-display text-[14.5px] font-bold tracking-tight">
                {ETIQUETA_SECCION[id]}
              </span>
              {marcada && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rojo" aria-label="Con un hallazgo grave" />}
              <span className={`shrink-0 text-[11.5px] tabular-nums ${faltan ? "font-semibold text-rojo/80" : "text-muted-foreground"}`}>
                {vacia ? "vacía" : faltan ? `${items.length - faltan}/${items.length}` : items.length}
              </span>
            </button>

            {vacia ? (
              <p className="px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground/70">
                Sin definir todavía.
              </p>
            ) : (
              <ul className="px-2 py-2">
                {items.map((it, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onIr(id)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.05]"
                    >
                      <span
                        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                          it.vacio
                            ? "ring-1 ring-rojo/50"
                            : it.estado
                              ? PUNTO_RED[it.estado]
                              : "bg-muted-foreground/35"
                        }`}
                        aria-label={it.estado ? ETIQUETA_ESTADO[it.estado] : undefined}
                      />
                      <span className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">
                        {conPrime(it.texto, false)}
                        {it.vacio && (
                          <span className="ml-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-rojo/70">
                            sin definir
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
