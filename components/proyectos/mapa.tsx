"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minus, Plus } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { RAIZ, color, hijosDe, tonoDe, type Doc, type Estado, type Nodo } from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// EL MAPA MENTAL
//
// La raíz va al centro, las ramas se reparten a derecha e izquierda y cada
// rama principal tiene su propio tono. Es SVG para las curvas y botones HTML
// para los nodos (así el texto se selecciona, se lee con lector de pantalla y
// "PRIME" puede llevar su logo).
//
// El diseño está calculado, no a ojo: cada columna de profundidad mide lo que
// mide su nodo más ancho, y cada rama ocupa un alto proporcional a sus hojas
// visibles. Por eso nada se pisa por más ramas que se agreguen.
// ──────────────────────────────────────────────────────────────

const ALTO = 36
const ALTO_RAIZ = 56
const SEPARACION_V = 24
const SEPARACION_H = 64
const PUNTO = { idea: "bg-muted-foreground/50", marcha: "bg-[#31abc4]", listo: "bg-kev-success", pausa: "bg-kev-warning" } as const satisfies Record<Estado, string>

type Caja = {
  nodo: Nodo
  x: number
  y: number
  w: number
  h: number
  lado: 1 | -1
  prof: number
  tono: number
  ocultos: number
}

function anchoDe(n: Nodo, raiz: boolean): number {
  const t = n.titulo.length
  return raiz ? Math.min(280, 84 + t * 9.6) : Math.min(340, 74 + t * 7.7)
}

function calcular(doc: Doc) {
  const raiz = doc.nodos.find((n) => n.id === RAIZ)
  if (!raiz) return { cajas: [] as Caja[], ancho: 0, alto: 0 }

  const visibles = (n: Nodo) => (n.plegado ? [] : hijosDe(doc, n.id))
  const hojas = (n: Nodo): number => {
    const h = visibles(n)
    return h.length ? h.reduce((a, c) => a + hojas(c), 0) : 1
  }

  const ramas = hijosDe(doc, RAIZ)
  const total = ramas.reduce((a, r) => a + hojas(r), 0)
  const derecha: Nodo[] = []
  const izquierda: Nodo[] = []
  let acumulado = 0
  for (const r of ramas) {
    if (acumulado < total / 2) derecha.push(r)
    else izquierda.push(r)
    acumulado += hojas(r)
  }

  const tonos = new Map(ramas.map((r) => [r.id, tonoDe(doc, r.id)]))
  const cajas: Caja[] = []
  const wRaiz = anchoDe(raiz, true)
  cajas.push({ nodo: raiz, x: -wRaiz / 2, y: -ALTO_RAIZ / 2, w: wRaiz, h: ALTO_RAIZ, lado: 1, prof: 0, tono: 250, ocultos: 0 })

  const lado = (grupo: Nodo[], signo: 1 | -1) => {
    // Ancho de cada columna de profundidad en este lado.
    const colW: number[] = []
    const medir = (n: Nodo, prof: number) => {
      colW[prof] = Math.max(colW[prof] ?? 0, anchoDe(n, false))
      visibles(n).forEach((c) => medir(c, prof + 1))
    }
    grupo.forEach((r) => medir(r, 1))

    const inicioX: number[] = []
    let acc = wRaiz / 2 + SEPARACION_H
    for (let d = 1; d < colW.length; d++) {
      inicioX[d] = acc
      acc += colW[d] + SEPARACION_H
    }

    const alturaTotal = grupo.reduce((a, r) => a + hojas(r), 0) * (ALTO + SEPARACION_V)
    let cursor = -alturaTotal / 2

    const colocar = (n: Nodo, prof: number, y0: number, tono: number): number => {
      const slot = hojas(n) * (ALTO + SEPARACION_V)
      const hs = visibles(n)
      let yc = y0 + slot / 2
      if (hs.length) {
        let y = y0
        const centros = hs.map((c) => {
          const cy = colocar(c, prof + 1, y, tono)
          y += hojas(c) * (ALTO + SEPARACION_V)
          return cy
        })
        yc = (centros[0] + centros[centros.length - 1]) / 2
      }
      const w = anchoDe(n, false)
      // Los nodos más angostos que su columna se pegan al lado de la raíz.
      const x = signo === 1 ? inicioX[prof] : -(inicioX[prof] + w)
      cajas.push({
        nodo: n, x, y: yc - ALTO / 2, w, h: ALTO, lado: signo, prof, tono,
        ocultos: n.plegado ? hijosDe(doc, n.id).length : 0,
      })
      return yc
    }

    for (const r of grupo) {
      colocar(r, 1, cursor, tonos.get(r.id) ?? 250)
      cursor += hojas(r) * (ALTO + SEPARACION_V)
    }
  }

  lado(derecha, 1)
  lado(izquierda, -1)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const c of cajas) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x + c.w)
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y + c.h)
  }
  const margen = 80
  const dx = -minX + margen
  const dy = -minY + margen
  for (const c of cajas) { c.x += dx; c.y += dy }
  return { cajas, ancho: maxX - minX + margen * 2, alto: maxY - minY + margen * 2 }
}

function curva(p: Caja, c: Caja): string {
  const x1 = c.lado === 1 ? p.x + p.w : p.x
  const y1 = p.y + p.h / 2
  const x2 = c.lado === 1 ? c.x : c.x + c.w
  const y2 = c.y + c.h / 2
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function Mapa({
  doc,
  seleccionado,
  onSeleccionar,
  onPlegar,
  onAgregar,
}: {
  doc: Doc
  seleccionado: string
  onSeleccionar: (id: string) => void
  onPlegar: (id: string) => void
  /** Opcional: donde el árbol no se edita (el manual de /branding sale de un
   *  documento de forma fija), un "+" que no hace nada es peor que no estar. */
  onAgregar?: (padre: string) => void
}) {
  const { cajas, ancho, alto } = useMemo(() => calcular(doc), [doc])
  const porId = useMemo(() => new Map(cajas.map((c) => [c.nodo.id, c])), [cajas])

  const marco = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const ajustada = useRef(false)
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const arrastre = useRef<{ x: number; y: number; vx: number; vy: number; movido: boolean } | null>(null)

  const ajustar = useCallback(() => {
    const el = marco.current
    if (!el || !ancho || !alto) return
    const { width, height } = el.getBoundingClientRect()
    const raiz = cajas.find((c) => c.nodo.id === RAIZ)
    if (width < 640 && raiz) {
      // En el teléfono, todo el mapa a la vez es ilegible: se centra la raíz
      // con un zoom que se lee, y el resto se explora arrastrando.
      const k = 0.7
      setVista({ k, x: width / 2 - (raiz.x + raiz.w / 2) * k, y: height / 2 - (raiz.y + raiz.h / 2) * k })
      return
    }
    const k = Math.min(1, Math.max(0.3, Math.min(width / ancho, height / alto)))
    setVista({ k, x: (width - ancho * k) / 2, y: (height - alto * k) / 2 })
  }, [ancho, alto, cajas])

  // Se encuadra una sola vez al inicio. Después, plegar o agregar una rama no
  // debe mover la cámara bajo los dedos de quien está trabajando.
  useEffect(() => {
    if (ajustada.current || !ancho) return
    ajustada.current = true
    ajustar()
  }, [ancho, ajustar])

  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = marco.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = cx ?? r.width / 2
    const py = cy ?? r.height / 2
    setVista((v) => {
      const k = Math.min(2.2, Math.max(0.25, v.k * factor))
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })
  }, [])

  // La rueda se registra a mano: React la registra "pasiva" y entonces no
  // puede evitar que la página entera haga scroll mientras se hace zoom.
  useEffect(() => {
    const el = marco.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom])

  // Un dedo arrastra; dos dedos hacen zoom (pinch).
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number } | null>(null)

  const abajo = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-nodo], [data-control]")) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    marco.current?.setPointerCapture(e.pointerId)
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) }
      arrastre.current = null
    } else {
      arrastre.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, movido: false }
    }
  }
  const mueve = (e: React.PointerEvent) => {
    if (!punteros.current.has(e.pointerId)) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size === 2 && pinch.current) {
      const [a, b] = [...punteros.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const r = marco.current!.getBoundingClientRect()
      zoom(d / pinch.current.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
      pinch.current.d = d
      return
    }
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    if (Math.abs(dx) + Math.abs(dy) > 3) a.movido = true
    setVista((v) => ({ ...v, x: a.vx + dx, y: a.vy + dy }))
  }
  const arriba = (e: React.PointerEvent) => {
    punteros.current.delete(e.pointerId)
    pinch.current = null
    arrastre.current = null
    // Si quedó un dedo, sigue arrastrando desde donde está.
    const resto = [...punteros.current.values()][0]
    if (resto) arrastre.current = { x: resto.x, y: resto.y, vx: vistaRef.current.x, vy: vistaRef.current.y, movido: true }
  }

  return (
    <div
      ref={marco}
      onPointerDown={abajo}
      onPointerMove={mueve}
      onPointerUp={arriba}
      onPointerCancel={arriba}
      className="relative h-full w-full touch-none select-none overflow-hidden rounded-[inherit] cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--foreground) 11%, transparent) 1px, transparent 0)",
        backgroundSize: `${24 * vista.k}px ${24 * vista.k}px`,
        backgroundPosition: `${vista.x}px ${vista.y}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: ancho, height: alto, transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}
      >
        <svg width={ancho} height={alto} className="pointer-events-none absolute inset-0" aria-hidden>
          {cajas
            .filter((c) => c.nodo.padre)
            .map((c) => {
              const padre = porId.get(c.nodo.padre!)
              if (!padre) return null
              return (
                <path
                  key={c.nodo.id}
                  d={curva(padre, c)}
                  fill="none"
                  stroke={color(c.tono, 0.62, 0.12, c.prof === 1 ? 0.75 : 0.5)}
                  strokeWidth={c.prof === 1 ? 2.6 : 1.7}
                  strokeLinecap="round"
                />
              )
            })}
        </svg>

        {cajas.map((c) => {
          const raiz = c.nodo.id === RAIZ
          const sel = c.nodo.id === seleccionado
          const tieneHijos = hijosDe(doc, c.nodo.id).length > 0
          const fuera = c.lado === 1 ? "left-full ml-1.5" : "right-full mr-1.5"
          return (
            <div key={c.nodo.id} className="absolute" style={{ left: c.x, top: c.y, width: c.w, height: c.h }}>
              <button
                type="button"
                data-nodo
                onClick={() => onSeleccionar(c.nodo.id)}
                className={[
                  "group flex h-full w-full items-center gap-2 text-left transition-all duration-200",
                  raiz
                    ? "justify-center rounded-full bg-foreground px-5 text-background shadow-[0_18px_40px_-18px_var(--glass-shadow)]"
                    : "rounded-full border bg-card/90 px-3 backdrop-blur-md hover:-translate-y-px",
                  sel && !raiz ? "ring-2 ring-offset-2 ring-offset-background" : "",
                ].join(" ")}
                style={
                  raiz
                    ? undefined
                    : {
                        borderColor: color(c.tono, 0.62, 0.13, sel ? 0.95 : 0.4),
                        ["--tw-ring-color" as string]: color(c.tono, 0.62, 0.13, 0.7),
                        background: sel ? color(c.tono, 0.62, 0.13, 0.12) : undefined,
                      }
                }
              >
                <span className={raiz ? "text-xl leading-none" : "text-[15px] leading-none"} aria-hidden>
                  {c.nodo.icono}
                </span>
                <span
                  className={[
                    "min-w-0 flex-1 truncate",
                    raiz ? "font-display text-[17px] font-semibold tracking-tight" : "text-[13px] font-medium",
                  ].join(" ")}
                >
                  {conPrime(c.nodo.titulo || "Sin título", false)}
                </span>
                {!raiz && (
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${PUNTO[c.nodo.estado]}`}
                    aria-label={c.nodo.estado}
                  />
                )}
              </button>

              {!raiz && c.nodo.meta && (
                <span
                  className="pointer-events-none absolute left-3 top-full mt-0.5 rounded-full px-2 py-px text-[10.5px] font-semibold tabular-nums"
                  style={{ color: color(c.tono, 0.45, 0.13), background: color(c.tono, 0.62, 0.13, 0.1) }}
                >
                  {c.nodo.meta}
                </span>
              )}

              {!raiz && tieneHijos && (
                <button
                  type="button"
                  data-control
                  onClick={() => onPlegar(c.nodo.id)}
                  aria-label={c.nodo.plegado ? "Desplegar rama" : "Recoger rama"}
                  className={`absolute top-1/2 ${fuera} flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-background px-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground`}
                  style={{ borderColor: color(c.tono, 0.62, 0.13, 0.5) }}
                >
                  {c.nodo.plegado ? c.ocultos : <Minus className="h-2.5 w-2.5" strokeWidth={2.5} />}
                </button>
              )}

              {sel && onAgregar && (
                <button
                  type="button"
                  data-control
                  onClick={() => onAgregar(c.nodo.id)}
                  aria-label="Agregar una rama"
                  className={`absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow transition-transform hover:scale-110 ${
                    c.lado === 1
                      ? raiz ? "left-full ml-2" : tieneHijos ? "left-full ml-8" : "left-full ml-1.5"
                      : raiz ? "right-full mr-2" : tieneHijos ? "right-full mr-8" : "right-full mr-1.5"
                  }`}
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div data-control className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full border bg-card/90 p-1 shadow-lg backdrop-blur-md">
        <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Alejar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(vista.k * 100)}%</span>
        <button type="button" onClick={() => zoom(1.25)} aria-label="Acercar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button type="button" onClick={ajustar} aria-label="Encuadrar todo" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
