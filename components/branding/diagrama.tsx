"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minus, Plus } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { ETIQUETA_SECCION, ICONO_SECCION, type Seccion } from "@/lib/revision"
import { ETIQUETA_ESTADO, type Contenido, type Estado } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// EL DIAGRAMA
//
// El manual dibujado como esquema técnico, no como lista. La gramática es la
// de un diagrama de verdad:
//
//   · Conectores en ÁNGULO RECTO, no curvas. Una curva es más bonita; un
//     ángulo recto se sigue con el dedo sin perder cuál va con cuál.
//   · Dos tipos de caja: la sección va rellena, sus cosas van de contorno. Se
//     ve de un vistazo qué manda y qué deriva.
//   · La línea PUNTEADA Y ROJA marca lo que falta — un bloque sin reglas, un
//     formato sin beats. El color aquí informa, no decora.
//   · Un tronco vertical por sección, como un bus: todas sus ramas salen del
//     mismo riel en vez de abrirse en abanico. Por eso nada se pisa por más
//     ítems que se agreguen.
//
// El alto de cada sección ES cuántas cosas tiene. Una sección vacía se ve
// desde lejos: es lo único que el diagrama tiene que gritar.
// ──────────────────────────────────────────────────────────────

const FILA = 34          // alto de una caja de ítem
const AIRE = 8           // entre ítems
const AIRE_SECCION = 30  // entre una sección y la siguiente
const ARRIBA = 24

type Item = { texto: string; estado?: Estado; vacio?: boolean }
type Bloque = { id: Seccion; items: Item[] }

function bloques(c: Contenido): Bloque[] {
  const t = (xs: string[]): Item[] => xs.map((x) => x.trim()).filter(Boolean).map((texto) => ({ texto }))
  return [
    { id: "personaje", items: t([...c.personaje.fortalezas, ...c.personaje.debilidades, ...c.personaje.oportunidades]) },
    { id: "norte", items: t(c.norte.map((p) => p.titulo)) },
    { id: "formatos", items: c.formatos.filter((f) => f.nombre.trim()).map((f) => ({ texto: f.nombre.trim(), vacio: f.beats.length === 0 })) },
    { id: "edicion", items: c.edicion.bloques.filter((b) => b.titulo.trim()).map((b) => ({ texto: b.titulo.trim(), vacio: b.reglas.length === 0 })) },
    { id: "redes", items: c.redes.filter((r) => r.nombre.trim()).map((r) => ({ texto: r.nombre.trim(), estado: r.estado })) },
    { id: "produccion", items: t([...c.produccion.personaje, ...c.produccion.equipo]) },
    { id: "enCola", items: t(c.enCola.map((v) => v.titulo)) },
    { id: "pendientes", items: t(c.pendientes) },
    { id: "hoy", items: t(c.hoy.map((l) => l.titulo)) },
    { id: "futuro", items: t(c.futuro.map((l) => l.titulo)) },
  ]
}

const PUNTO: Record<Estado, string> = {
  usamos: "bg-kev-success",
  pendiente: "bg-muted-foreground/40",
  no: "bg-kev-warning",
}

export function Diagrama({
  contenido,
  onIr,
  marcadas,
}: {
  contenido: Contenido
  onIr: (s: Seccion) => void
  marcadas?: Set<string>
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [ancho, setAncho] = useState(0)
  const angosto = ancho > 0 && ancho < 720
  const caja = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // En pantalla angosta todo se acerca y las cajas se estrechan: el esquema
  // sigue siendo el mismo, cabe en menos ancho.
  const W_SEC = angosto ? 128 : 210
  const X_TRONCO_REL = W_SEC + (angosto ? 20 : 42)
  const X_ITEM_REL = X_TRONCO_REL + (angosto ? 20 : 42)
  // Con ancho de sobra van dos columnas de secciones. Con una sola, el
  // esquema se iba a 2.600px de alto y dejaba media pantalla vacía.
  const COLS = angosto ? 1 : 2
  const SEPARACION_COL = 48

  // El ancho de la caja de ítem SALE del contenedor, no de un número fijo. Con
  // un fijo, la segunda columna se cortaba por la derecha en cuanto la
  // pantalla era un poco más angosta de lo previsto.
  const disponible = Math.max(ancho || 900, 320) - 24 - SEPARACION_COL * (COLS - 1)
  const W_ITEM = Math.max(170, Math.floor(disponible / COLS) - X_ITEM_REL)
  const ANCHO_COL = X_ITEM_REL + W_ITEM
  const ANCHO = COLS * ANCHO_COL + (COLS - 1) * SEPARACION_COL + 24

  const { puestos, alto } = useMemo(() => {
    // Cada sección va a la columna que por ahora tiene menos alto. Repartir
    // por mitades deja una columna el doble de larga en cuanto hay una sección
    // gorda (las 14 redes).
    const yCol = Array.from({ length: COLS }, () => ARRIBA)
    const puestos = bloques(contenido).map((b) => {
      const col = yCol.indexOf(Math.min(...yCol))
      const x = 12 + col * (ANCHO_COL + SEPARACION_COL)
      const n = Math.max(b.items.length, 1)
      const yInicio = yCol[col]
      const items = b.items.map((item, i) => ({ item, y: yInicio + i * (FILA + AIRE) }))
      const altoSec = n * (FILA + AIRE) - AIRE
      yCol[col] = yInicio + altoSec + AIRE_SECCION
      return { ...b, x, y: yInicio, altoSec, items }
    })
    return { puestos, alto: Math.max(...yCol) + ARRIBA }
  }, [contenido, angosto, COLS, ANCHO_COL, SEPARACION_COL])

  const bajar = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    arrastre.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const mover = (e: React.PointerEvent) => {
    const a = arrastre.current
    if (!a) return
    setPan({ x: a.px + (e.clientX - a.x), y: a.py + (e.clientY - a.y) })
  }
  const soltar = () => { arrastre.current = null }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/20">
      <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
        {[
          { icono: Plus, accion: () => setZoom((z) => Math.min(2, z + 0.15)), etiqueta: "Acercar" },
          { icono: Minus, accion: () => setZoom((z) => Math.max(0.45, z - 0.15)), etiqueta: "Alejar" },
          { icono: Maximize2, accion: () => { setZoom(1); setPan({ x: 0, y: 0 }) }, etiqueta: "Centrar" },
        ].map(({ icono: Icono, accion, etiqueta }) => (
          <button
            key={etiqueta}
            onClick={accion}
            aria-label={etiqueta}
            className="rounded-lg border border-border bg-background/90 p-2 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <Icono className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-background/85 px-2 py-1 text-[11px] text-muted-foreground/80 backdrop-blur-sm">
        Arrastra para mover · la línea roja punteada marca lo que falta
      </p>

      <div
        ref={caja}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="h-[580px] cursor-grab touch-none overflow-hidden active:cursor-grabbing md:h-[760px]"
      >
        <svg
          width={ANCHO}
          height={alto}
          viewBox={`0 0 ${ANCHO} ${alto}`}
          className="max-w-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "left top" }}
        >
          {/* Primero los conectores: ningún trazo cruza por encima de un texto. */}
          {puestos.map(({ id, x, y, items }) => {
            const xTronco = x + X_TRONCO_REL
            const xItem = x + X_ITEM_REL
            const yMedio = y + FILA / 2
            const ultimo = items.length ? items[items.length - 1].y + FILA / 2 : yMedio
            return (
              <g key={`c-${id}`}>
                {/* De la caja de sección al tronco */}
                <path
                  d={`M ${x + W_SEC} ${yMedio} H ${xTronco}`}
                  className="stroke-gold/55" strokeWidth={1.5} fill="none"
                />
                {/* El tronco vertical: el bus del que cuelga todo */}
                {items.length > 1 && (
                  <path
                    d={`M ${xTronco} ${yMedio} V ${ultimo}`}
                    className="stroke-gold/35" strokeWidth={1.5} fill="none"
                  />
                )}
                {/* Del tronco a cada caja de ítem, en ángulo recto */}
                {items.map(({ item, y: yi }, i) => (
                  <path
                    key={i}
                    d={`M ${xTronco} ${yi + FILA / 2} H ${xItem}`}
                    className={item.vacio ? "stroke-rojo/70" : "stroke-gold/35"}
                    strokeWidth={1.5}
                    strokeDasharray={item.vacio ? "3 3" : undefined}
                    fill="none"
                  />
                ))}
              </g>
            )
          })}

          {/* Las cajas */}
          {puestos.map(({ id, x, y, items }) => {
            const xItem = x + X_ITEM_REL
            const marcada = marcadas?.has(id)
            const faltan = items.filter((x) => x.item.vacio).length
            return (
              <g key={id}>
                {/* La sección: caja RELLENA, como el nodo principal del diagrama */}
                <g onClick={() => onIr(id)} className="cursor-pointer">
                  <rect
                    x={x} y={y} width={W_SEC} height={FILA} rx={8}
                    className={`fill-gold/[0.14] ${marcada ? "stroke-rojo/70" : "stroke-gold/55"}`}
                    strokeWidth={1.5}
                  />
                  <foreignObject x={x + 8} y={y + 4} width={W_SEC - 16} height={FILA - 8}>
                    <div className="flex h-full items-center gap-1.5">
                      <span className="shrink-0 text-[12px] leading-none" aria-hidden>{ICONO_SECCION[id]}</span>
                      <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-bold text-foreground">
                        {ETIQUETA_SECCION[id]}
                      </span>
                      <span className={`shrink-0 text-[10.5px] tabular-nums ${faltan ? "font-semibold text-rojo/85" : "text-muted-foreground"}`}>
                        {items.length === 0 ? "0" : faltan ? `${items.length - faltan}/${items.length}` : items.length}
                      </span>
                    </div>
                  </foreignObject>
                </g>

                {/* Los ítems: cajas de CONTORNO, más chicas */}
                {items.map(({ item, y: yi }, i) => (
                  <g key={i} onClick={() => onIr(id)} className="cursor-pointer">
                    <rect
                      x={xItem} y={yi} width={W_ITEM} height={FILA} rx={7}
                      className={`fill-background/60 ${item.vacio ? "stroke-rojo/45" : "stroke-border"}`}
                      strokeWidth={1}
                      strokeDasharray={item.vacio ? "3 3" : undefined}
                    />
                    <foreignObject x={xItem + 9} y={yi + 4} width={W_ITEM - 18} height={FILA - 8}>
                      <div className="flex h-full items-center gap-1.5">
                        {item.estado && (
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[item.estado]}`}
                            aria-label={ETIQUETA_ESTADO[item.estado]}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                          {conPrime(item.texto, false)}
                        </span>
                        {item.vacio && (
                          <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-wider text-rojo/75">
                            falta
                          </span>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                ))}

                {/* Una sección sin nada: se dice, no se deja en blanco */}
                {items.length === 0 && (
                  <foreignObject x={xItem} y={y + 4} width={W_ITEM} height={FILA - 8}>
                    <div className="flex h-full items-center text-[11.5px] text-muted-foreground/60">
                      Sin definir todavía
                    </div>
                  </foreignObject>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
