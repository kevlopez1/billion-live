"use client"

import { useMemo, useRef, useState } from "react"
import { Minus, Plus, Maximize2 } from "lucide-react"
import type { Contenido } from "@/lib/branding"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"

// ──────────────────────────────────────────────────────────────
// EL MAPA MENTAL
//
// Los mismos datos del documento, en radial. No es una vista decorativa: es
// la única forma de ver de un vistazo qué rama está gorda y cuál está vacía.
// Una sección sin hojas se ve desde lejos, y eso es justo lo que hay que ver.
//
// El ángulo de cada rama se reparte por peso, no en partes iguales: una
// sección con 10 hojas necesita más arco que una con 1, si no las hojas se
// pisan entre ellas y el mapa no se puede leer.
// ──────────────────────────────────────────────────────────────

type Hoja = { texto: string; i: number }
type Rama = { id: Seccion; nombre: string; hojas: Hoja[] }

const CORTE = 34
const recortar = (s: string) => (s.length > CORTE ? s.slice(0, CORTE - 1).trimEnd() + "…" : s)

// El documento tiene forma fija, así que la traducción a ramas también.
// Cada hoja es un texto que YA existe en el manual: el mapa no agrega nada.
function aRamas(c: Contenido): Rama[] {
  const h = (xs: string[]): Hoja[] => xs.filter(Boolean).map((texto, i) => ({ texto: recortar(texto), i }))
  return [
    { id: "personaje", nombre: ETIQUETA_SECCION.personaje, hojas: h([...c.personaje.fortalezas, ...c.personaje.debilidades, ...c.personaje.oportunidades]) },
    { id: "norte", nombre: ETIQUETA_SECCION.norte, hojas: h(c.norte.map((p) => p.titulo)) },
    { id: "formatos", nombre: ETIQUETA_SECCION.formatos, hojas: h(c.formatos.map((f) => f.nombre)) },
    { id: "edicion", nombre: ETIQUETA_SECCION.edicion, hojas: h(c.edicion.bloques.map((b) => b.titulo)) },
    { id: "redes", nombre: ETIQUETA_SECCION.redes, hojas: h(c.redes.map((r) => r.nombre)) },
    { id: "produccion", nombre: ETIQUETA_SECCION.produccion, hojas: h([...c.produccion.personaje, ...c.produccion.equipo]) },
    { id: "enCola", nombre: ETIQUETA_SECCION.enCola, hojas: h(c.enCola.map((v) => v.titulo)) },
    { id: "pendientes", nombre: ETIQUETA_SECCION.pendientes, hojas: h(c.pendientes) },
    { id: "hoy", nombre: ETIQUETA_SECCION.hoy, hojas: h(c.hoy.map((l) => l.titulo)) },
    { id: "futuro", nombre: ETIQUETA_SECCION.futuro, hojas: h(c.futuro.map((l) => l.titulo)) },
  ]
}

const R_RAMA = 190
const R_HOJA = 330
const ANCHO = 1180
const ALTO = 1180

type Nodo = { x: number; y: number; ang: number }
const polar = (r: number, ang: number): Nodo => ({ x: ANCHO / 2 + r * Math.cos(ang), y: ALTO / 2 + r * Math.sin(ang), ang })

// Curva suave entre dos puntos: el tirón horizontal hace que las líneas
// salgan del nodo en vez de cortarlo en diagonal.
function curva(a: Nodo, b: Nodo) {
  const mx = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`
}

export function Mapa({
  contenido,
  onIr,
  vacias,
}: {
  contenido: Contenido
  onIr: (seccion: Seccion) => void
  /** Secciones que la IA marcó: se dibujan con anillo rojo. */
  vacias?: Set<string>
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [cerradas, setCerradas] = useState<Set<string>>(new Set())
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const ramas = useMemo(() => aRamas(contenido), [contenido])

  const disposicion = useMemo(() => {
    // Peso: una rama cerrada ocupa lo mínimo; una abierta, según sus hojas.
    const pesos = ramas.map((r) => (cerradas.has(r.id) ? 1 : Math.max(1, r.hojas.length)))
    const total = pesos.reduce((a, b) => a + b, 0)
    // Empezar arriba (-90°) para que la primera rama quede en las 12.
    let ang = -Math.PI / 2
    return ramas.map((r, i) => {
      const arco = (pesos[i] / total) * Math.PI * 2
      const centro = ang + arco / 2
      const nodo = polar(R_RAMA, centro)
      const abierta = !cerradas.has(r.id)
      const hojas = abierta
        ? r.hojas.map((hoja, j) => {
            // Reparto dentro del arco, con margen para que no se toquen ramas vecinas.
            const n = r.hojas.length
            const paso = (arco * 0.86) / Math.max(n, 1)
            const a = centro - (arco * 0.86) / 2 + paso * (j + 0.5)
            return { hoja, nodo: polar(R_HOJA, a) }
          })
        : []
      ang += arco
      return { rama: r, nodo, hojas, abierta }
    })
  }, [ramas, cerradas])

  const alternar = (id: string) =>
    setCerradas((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

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

  const ajustar = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/30">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        {[
          { icono: Plus, accion: () => setZoom((z) => Math.min(2.4, z + 0.2)), etiqueta: "Acercar" },
          { icono: Minus, accion: () => setZoom((z) => Math.max(0.4, z - 0.2)), etiqueta: "Alejar" },
          { icono: Maximize2, accion: ajustar, etiqueta: "Centrar" },
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

      <p className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] text-muted-foreground/70">
        Arrastra para mover · toca una rama para plegarla · toca una hoja para ir a ella
      </p>

      <div
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="h-[460px] cursor-grab touch-none active:cursor-grabbing md:h-[620px]"
      >
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-full w-full"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
        >
          {/* Las líneas van primero: así ningún trazo cruza por encima de un texto. */}
          {disposicion.map(({ rama, nodo, hojas }) => (
            <g key={`l-${rama.id}`}>
              <path d={curva(polar(0, 0), nodo)} className="stroke-gold/35" strokeWidth={2} fill="none" />
              {hojas.map(({ hoja, nodo: hn }) => (
                <path key={hoja.i} d={curva(nodo, hn)} className="stroke-border" strokeWidth={1.25} fill="none" />
              ))}
            </g>
          ))}

          {/* El centro */}
          <g>
            <circle cx={ANCHO / 2} cy={ALTO / 2} r={62} className="fill-gold/12 stroke-gold/50" strokeWidth={1.5} />
            <text
              x={ANCHO / 2}
              y={ALTO / 2 - 4}
              textAnchor="middle"
              className="fill-foreground font-display text-[15px] font-bold"
            >
              {contenido.meta.proyecto.split(" ").slice(0, 2).join(" ")}
            </text>
            <text x={ANCHO / 2} y={ALTO / 2 + 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {contenido.meta.proyecto.split(" ").slice(2).join(" ") || "el manual"}
            </text>
          </g>

          {/* Ramas */}
          {disposicion.map(({ rama, nodo, hojas, abierta }) => {
            const izq = nodo.x < ANCHO / 2
            const marcada = vacias?.has(rama.id)
            return (
              <g key={rama.id}>
                <g onClick={() => alternar(rama.id)} className="cursor-pointer">
                  <circle
                    cx={nodo.x}
                    cy={nodo.y}
                    r={7}
                    className={marcada ? "fill-rojo stroke-rojo" : abierta ? "fill-gold stroke-gold" : "fill-background stroke-gold"}
                    strokeWidth={2}
                  />
                  <text
                    x={nodo.x + (izq ? -13 : 13)}
                    y={nodo.y + 4}
                    textAnchor={izq ? "end" : "start"}
                    className="fill-foreground font-display text-[13px] font-semibold"
                  >
                    {rama.nombre}
                  </text>
                  <text
                    x={nodo.x + (izq ? -13 : 13)}
                    y={nodo.y + 19}
                    textAnchor={izq ? "end" : "start"}
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {rama.hojas.length === 0 ? "vacía" : `${rama.hojas.length}`}
                  </text>
                </g>

                {hojas.map(({ hoja, nodo: hn }) => {
                  const hIzq = hn.x < ANCHO / 2
                  return (
                    <g key={hoja.i} onClick={() => onIr(rama.id)} className="cursor-pointer">
                      <circle cx={hn.x} cy={hn.y} r={3} className="fill-muted-foreground/50" />
                      <text
                        x={hn.x + (hIzq ? -9 : 9)}
                        y={hn.y + 3.5}
                        textAnchor={hIzq ? "end" : "start"}
                        className="fill-muted-foreground text-[11px] hover:fill-foreground"
                      >
                        {hoja.texto}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
