"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { GripVertical } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// LISTA QUE SE ARRASTRA
//
// Sin librería: con punteros, que es el único evento que funciona igual con
// el dedo y con el mouse. El drag-and-drop nativo de HTML no existe en el
// celular, y Kev edita desde el celular.
//
// Las alturas se miden UNA vez al empezar a arrastrar. Durante el arrastre
// solo se mueven en pantalla (transform), así que la medida sigue valiendo:
// si se midiera en cada movimiento, cada fila desplazada cambiaría el
// cálculo de la siguiente y el orden saltaría solo.
//
// También se mueve con el teclado (Alt + ↑/↓). No es un extra de
// accesibilidad: con listas largas es más rápido que arrastrar.
// ──────────────────────────────────────────────────────────────

type Props<T> = {
  items: T[]
  clave: (item: T, i: number) => string
  mover: (desde: number, hasta: number) => void
  children: (item: T, i: number) => ReactNode
  /** Texto para el lector de pantalla: "formato", "regla", "principio"… */
  nombre?: string
}

export function Ordenable<T>({ items, clave, mover, children, nombre = "elemento" }: Props<T>) {
  const cont = useRef<HTMLDivElement>(null)
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const estado = useRef<{ cajas: DOMRect[]; inicioY: number; desde: number } | null>(null)
  const [dy, setDy] = useState(0)

  const alSoltar = useCallback(() => {
    const e = estado.current
    if (e && destino !== null && destino !== e.desde) mover(e.desde, destino)
    estado.current = null
    setArrastrando(null)
    setDestino(null)
    setDy(0)
  }, [destino, mover])

  const alBajar = (i: number) => (ev: React.PointerEvent) => {
    // Solo el botón principal: un clic derecho no debe arrastrar.
    if (ev.button !== 0) return
    const filas = Array.from(cont.current?.children ?? []) as HTMLElement[]
    estado.current = {
      cajas: filas.map((f) => f.getBoundingClientRect()),
      inicioY: ev.clientY,
      desde: i,
    }
    setArrastrando(i)
    setDestino(i)
    // Capturar el puntero: si el dedo se sale de la fila, el arrastre sigue.
    ;(ev.target as HTMLElement).setPointerCapture(ev.pointerId)
    ev.preventDefault()
  }

  const alMover = (ev: React.PointerEvent) => {
    const e = estado.current
    if (!e) return
    const delta = ev.clientY - e.inicioY
    setDy(delta)

    // El centro de la fila arrastrada, en coordenadas de pantalla.
    const centro = e.cajas[e.desde].top + e.cajas[e.desde].height / 2 + delta
    let nuevo = e.desde
    for (let i = 0; i < e.cajas.length; i++) {
      if (i === e.desde) continue
      const c = e.cajas[i]
      const medio = c.top + c.height / 2
      if (i < e.desde && centro < medio) { nuevo = i; break }
      if (i > e.desde && centro > medio) nuevo = i
    }
    setDestino(nuevo)
  }

  const alTeclado = (i: number) => (ev: React.KeyboardEvent) => {
    if (!ev.altKey) return
    if (ev.key === "ArrowUp" && i > 0) { ev.preventDefault(); mover(i, i - 1) }
    if (ev.key === "ArrowDown" && i < items.length - 1) { ev.preventDefault(); mover(i, i + 1) }
  }

  // Cuánto se corre una fila que NO es la arrastrada, para abrir el hueco.
  const desplazamiento = (i: number) => {
    const e = estado.current
    if (!e || arrastrando === null || destino === null || i === arrastrando) return 0
    const alto = e.cajas[arrastrando].height + 8
    if (arrastrando < i && i <= destino) return -alto
    if (destino <= i && i < arrastrando) return alto
    return 0
  }

  return (
    <div ref={cont} className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div
          key={clave(item, i)}
          style={{
            transform: i === arrastrando ? `translateY(${dy}px)` : `translateY(${desplazamiento(i)}px)`,
            transition: i === arrastrando ? "none" : "transform 160ms ease",
            zIndex: i === arrastrando ? 20 : undefined,
            position: "relative",
          }}
          className={i === arrastrando ? "opacity-90 shadow-lg" : ""}
        >
          <div className="flex items-start gap-1.5">
            <button
              type="button"
              onPointerDown={alBajar(i)}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
              onKeyDown={alTeclado(i)}
              aria-label={`Mover ${nombre} ${i + 1} de ${items.length}. Alt y flechas para moverlo con el teclado.`}
              className="mt-1.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">{children(item, i)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
