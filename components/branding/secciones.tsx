"use client"

import { AlertTriangle } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { color } from "@/lib/proyectos"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"
import { ETIQUETA_ESTADO, type Contenido, type Estado } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// EL MAPA, POR SECCIONES
//
// Una tarjeta por sección, en el orden del documento. El abanico anterior
// repartía las ramas al lado donde cupieran, así que el orden se perdía: "Las
// redes" con sus 14 hojas se iba a una esquina y el resto quedaba apretado
// donde sobró. Se veía como un enredo, no como un manual.
//
// Aquí cada sección está encerrada y nombrada, y el alto de la tarjeta ES la
// cantidad de cosas que tiene. Una sección vacía se ve desde lejos: es lo
// único que el mapa tiene que gritar.
//
// Columnas CSS y no una grilla: las tarjetas miden distinto (6 formatos contra
// 14 redes) y una grilla dejaría huecos del alto de la más larga.
// ──────────────────────────────────────────────────────────────

const TONO: Record<Seccion, number> = {
  meta: 235, personaje: 235, norte: 28, formatos: 150, edicion: 75,
  redes: 300, produccion: 195, enCola: 345, pendientes: 110, hoy: 180, futuro: 265,
}

const ICONO: Record<Seccion, string> = {
  meta: "🏁", personaje: "👤", norte: "🧭", formatos: "🎬", edicion: "✂️",
  redes: "📡", produccion: "👕", enCola: "🎯", pendientes: "📌", hoy: "✨", futuro: "📈",
}

const PUNTO_RED: Record<Estado, string> = {
  usamos: "bg-kev-success",
  pendiente: "bg-muted-foreground/40",
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
    <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
      {bloques(contenido).map(({ id, items }) => {
        const h = TONO[id]
        const vacia = items.length === 0
        const faltan = items.filter((i) => i.vacio).length
        const marcada = marcadas?.has(id)
        return (
          <section
            key={id}
            className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border bg-card/40"
            style={{ borderColor: color(h, 0.62, 0.13, marcada ? 0.9 : 0.35) }}
          >
            <button
              type="button"
              onClick={() => onIr(id)}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.03]"
              style={{ backgroundColor: color(h, 0.62, 0.13, 0.08) }}
            >
              <span className="text-[15px] leading-none" aria-hidden>{ICONO[id]}</span>
              <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-tight">
                {ETIQUETA_SECCION[id]}
              </span>
              {marcada && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rojo" aria-label="Con un hallazgo grave" />}
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
                style={{ backgroundColor: color(h, 0.62, 0.13, 0.16), color: color(h, 0.45, 0.14) }}
              >
                {vacia ? "vacía" : faltan ? `${items.length - faltan}/${items.length}` : items.length}
              </span>
            </button>

            {vacia ? (
              <p className="px-3.5 py-3 text-[12.5px] leading-snug text-muted-foreground/70">
                Sin definir todavía.
              </p>
            ) : (
              <ul className="px-1.5 py-1.5">
                {items.map((it, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onIr(id)}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]"
                    >
                      <span
                        className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${it.estado ? PUNTO_RED[it.estado] : ""} ${it.vacio ? "ring-1 ring-rojo/40" : ""}`}
                        style={it.estado ? undefined : { backgroundColor: it.vacio ? "transparent" : color(h, 0.62, 0.13, 0.55) }}
                        aria-label={it.estado ? ETIQUETA_ESTADO[it.estado] : undefined}
                      />
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
                        {conPrime(it.texto, false)}
                        {it.vacio && (
                          <span className="ml-1.5 whitespace-nowrap rounded px-1 py-px text-[10.5px] font-semibold uppercase tracking-wider text-rojo/80 ring-1 ring-rojo/30">
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
