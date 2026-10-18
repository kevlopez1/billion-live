"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Minus, Plus, Maximize2 } from "lucide-react"
import type { Contenido } from "@/lib/branding"
import { conPrime } from "@/components/prime-mark"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"

// ──────────────────────────────────────────────────────────────
// EL MAPA MENTAL
//
// Los mismos datos del documento, en árbol. No es decoración: es la única
// forma de ver de un vistazo qué rama está gorda y cuál está vacía.
//
// Es horizontal y no radial a propósito. Un radial reparte ÁNGULO, y el texto
// necesita RENGLONES: con 14 redes en un abanico las etiquetas se montan unas
// sobre otras y el mapa deja de leerse. Aquí cada hoja tiene su propia línea,
// así que no pueden chocar — por construcción, no por suerte.
//
// Las etiquetas son HTML dentro del SVG (foreignObject) y no <text>: así
// PRIME sale con su logo, el texto corta con puntos suspensivos de verdad y
// usa las mismas fuentes que el resto de la web.
// ──────────────────────────────────────────────────────────────

type Hoja = { texto: string }
type Rama = { id: Seccion; nombre: string; hojas: Hoja[] }

function aRamas(c: Contenido): Rama[] {
  const h = (xs: string[]): Hoja[] => xs.filter(Boolean).map((texto) => ({ texto }))
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

// Dos formas, según quepa o no. En un teléfono el mapa no se mira entero: se
// recorre. Encogerlo para que quepa deja la letra en 4px, que es lo mismo que
// no mostrarlo. Así que en pantalla angosta va a una sola columna, a tamaño
// real, y se arrastra.
const ANCHO_AMPLIO = 1120
const ANCHO_ANGOSTO = 540
const RENGLON = 30      // alto de una hoja: fijo, y de ahí sale que nada se pise
const HUECO = 26        // aire entre una rama y la siguiente
const X_RAMA = 186      // distancia del centro al nodo de la rama
const X_HOJA = 320      // distancia del centro al punto de la hoja
const ANCHO_ETIQUETA = 236
// En una columna todo se acerca: hay la mitad de ancho para la misma etiqueta.
// En un teléfono no caben centro + rama + hoja en horizontal: la hoja queda
// siempre cortada. Así que deja de ser un abanico y pasa a ser un esquema
// indentado — todo alineado a la izquierda, cada nivel un poco más adentro.
// Es la misma información; es la forma que entra en 390 píxeles.
const X_RAMA_ANGOSTO = 14
const X_HOJA_ANGOSTO = 34
const ARRIBA = 40

function curva(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function Mapa({
  contenido,
  onIr,
  vacias,
}: {
  contenido: Contenido
  onIr: (seccion: Seccion) => void
  /** Secciones con un hallazgo grave de la IA: se marcan en rojo. */
  vacias?: Set<string>
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [cerradas, setCerradas] = useState<Set<string>>(new Set())
  const [angosto, setAngosto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  // Se mide el contenedor y no la ventana: el panel tiene índice al costado en
  // escritorio, así que el ancho de la ventana no dice cuánto hay de verdad.
  useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAngosto(e.contentRect.width < 820))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ANCHO = angosto ? ANCHO_ANGOSTO : ANCHO_AMPLIO
  const CENTRO = angosto ? 16 : ANCHO / 2
  const distRama = angosto ? X_RAMA_ANGOSTO : X_RAMA
  const distHoja = angosto ? X_HOJA_ANGOSTO : X_HOJA

  const ramas = useMemo(() => aRamas(contenido), [contenido])

  const { puestas, alto } = useMemo(() => {
    // Cuántos renglones pide cada rama: su título más sus hojas (o una línea
    // sola si está plegada o vacía).
    const filas = ramas.map((r) => (cerradas.has(r.id) ? 1 : 1 + Math.max(r.hojas.length, 1)))
    const total = filas.reduce((a, b) => a + b, 0)

    // Cada rama va al lado que por ahora tiene menos renglones. Cortar por la
    // mitad del total parecía más simple, pero basta una rama gorda justo
    // antes del corte (las 14 redes) para que un lado quede el doble de largo
    // que el otro y media tarjeta quede en blanco.
    const lados: ("der" | "izq")[] = []
    const altoLado = { der: 0, izq: 0 }
    for (const f of filas) {
      const lado = angosto ? "der" : altoLado.der <= altoLado.izq ? "der" : "izq"
      lados.push(lado)
      altoLado[lado] += f
    }
    void total

    // En una columna el centro va arriba del todo, así que las ramas tienen
    // que empezar MÁS abajo o la primera se dibuja encima de él.
    const inicio = angosto ? ARRIBA + 46 : ARRIBA
    const y = { der: inicio, izq: inicio }
    const puestas = ramas.map((r, i) => {
      const lado = lados[i]
      const abierta = !cerradas.has(r.id)
      const signo = lado === "der" ? 1 : -1
      const yRama = y[lado]
      const hojas = abierta
        ? r.hojas.map((hoja, j) => ({ hoja, y: yRama + (j + 1) * RENGLON }))
        : []
      y[lado] += filas[i] * RENGLON + HUECO
      return { rama: r, lado, signo, yRama, hojas, abierta }
    })
    return { puestas, alto: Math.max(y.der, y.izq) + ARRIBA }
  }, [ramas, cerradas, angosto])

  // Con dos columnas el centro va al medio, que es de donde salen las dos.
  // Con una sola va ARRIBA: si no, queda a mitad de un mapa de dos mil píxeles
  // de alto, o sea fuera de la pantalla, y el mapa abre mostrando un vacío.
  const yCentro = angosto ? ARRIBA : alto / 2

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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/30">
      <div className={`absolute right-3 z-10 flex gap-1.5 ${angosto ? "bottom-12 flex-row" : "top-3 flex-col"}`}>
        {[
          { icono: Plus, accion: () => setZoom((z) => Math.min(2.2, z + 0.15)), etiqueta: "Acercar" },
          { icono: Minus, accion: () => setZoom((z) => Math.max(0.5, z - 0.15)), etiqueta: "Alejar" },
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

      {/* Fondo propio: el mapa pasa por debajo y sin él las dos capas de texto
          se leen como una sola. */}
      <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-background/85 px-2 py-1 text-[11px] text-muted-foreground/80 backdrop-blur-sm">
        Arrastra para mover · toca una rama para plegarla · toca una hoja para ir a ella
      </p>

      <div
        ref={caja}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className="h-[560px] cursor-grab touch-none overflow-hidden active:cursor-grabbing md:h-[760px]"
      >
        <svg
          width={ANCHO}
          height={alto}
          viewBox={`0 0 ${ANCHO} ${alto}`}
          className="max-w-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: angosto ? "left top" : "center" }}
        >
          {/* Las líneas primero: ningún trazo cruza por encima de un texto. */}
          {puestas.map(({ rama, signo, yRama, hojas }) => (
            <g key={`l-${rama.id}`}>
              <path
                d={curva(CENTRO + signo * (angosto ? 10 : 54), yCentro, CENTRO + signo * distRama, yRama)}
                className="stroke-gold/40" strokeWidth={2} fill="none"
              />
              {hojas.map(({ y }, j) => (
                <path
                  key={j}
                  d={curva(CENTRO + signo * distRama, yRama, CENTRO + signo * distHoja, y)}
                  className="stroke-border" strokeWidth={1.25} fill="none"
                />
              ))}
            </g>
          ))}

          {/* El centro */}
          <circle cx={CENTRO} cy={yCentro} r={angosto ? 10 : 54} className="fill-gold/12 stroke-gold/50" strokeWidth={1.5} />
          <foreignObject x={angosto ? CENTRO + 18 : CENTRO - 52} y={yCentro - 26} width={angosto ? ANCHO - CENTRO - 28 : 104} height={52}>
            <div className={`flex h-full flex-col justify-center leading-tight ${angosto ? "items-start text-left" : "items-center text-center"}`}>
              <span className={`font-display font-bold text-foreground ${angosto ? "text-[12px]" : "text-[13px]"}`}>
                {contenido.meta.proyecto}
              </span>
            </div>
          </foreignObject>

          {/* Ramas y hojas */}
          {puestas.map(({ rama, lado, signo, yRama, hojas, abierta }) => {
            const der = lado === "der"
            const marcada = vacias?.has(rama.id)
            const xEtiqueta = der ? CENTRO + distRama + 12 : CENTRO - distRama - 12 - ANCHO_ETIQUETA
            const xEtiquetaHoja = der ? CENTRO + distHoja + 10 : CENTRO - distHoja - 10 - ANCHO_ETIQUETA
            const anchoRama = angosto ? ANCHO - xEtiqueta - 10 : ANCHO_ETIQUETA
            const anchoHoja = angosto ? ANCHO - xEtiquetaHoja - 10 : ANCHO_ETIQUETA
            return (
              <g key={rama.id}>
                <g onClick={() => alternar(rama.id)} className="cursor-pointer">
                  <circle
                    cx={CENTRO + signo * distRama}
                    cy={yRama}
                    r={6.5}
                    className={marcada ? "fill-rojo stroke-rojo" : abierta ? "fill-gold stroke-gold" : "fill-background stroke-gold"}
                    strokeWidth={2}
                  />
                  <foreignObject x={xEtiqueta} y={yRama - 15} width={anchoRama} height={30}>
                    <div className={`flex h-full items-center gap-1.5 ${der ? "justify-start" : "justify-end"}`}>
                      <span className="truncate font-display text-[13.5px] font-semibold text-foreground">{rama.nombre}</span>
                      <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                        {rama.hojas.length === 0 ? "vacía" : rama.hojas.length}
                      </span>
                    </div>
                  </foreignObject>
                </g>

                {hojas.map(({ hoja, y }, j) => (
                  <g key={j} onClick={() => onIr(rama.id)} className="cursor-pointer">
                    <circle cx={CENTRO + signo * distHoja} cy={y} r={2.5} className="fill-muted-foreground/50" />
                    <foreignObject x={xEtiquetaHoja} y={y - 14} width={anchoHoja} height={28}>
                      <div className={`flex h-full items-center ${der ? "justify-start" : "justify-end"}`}>
                        <span className="truncate text-[12px] leading-snug text-muted-foreground hover:text-foreground">
                          {conPrime(hoja.texto, false)}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
