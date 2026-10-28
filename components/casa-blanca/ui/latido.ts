"use client"

import { useEffect, useState } from "react"

/**
 * Re-dibuja el componente cada `ms`. Para paneles que muestran el estado vivo
 * de la simulación (que cambia en cada cuadro, fuera de React) sin
 * re-renderizar todo el HUD sesenta veces por segundo.
 */
export function useLatido(ms: number, activo = true) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!activo) return
    const t = window.setInterval(() => setN((x) => x + 1), ms)
    return () => window.clearInterval(t)
  }, [ms, activo])
  return n
}

/** true si la persona pidió menos movimiento en su sistema. */
export function useMenosMovimiento() {
  const [menos, setMenos] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const f = () => setMenos(mq.matches)
    f()
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])
  return menos
}

/** true en pantallas angostas (celular): el HUD se compacta. */
export function useCompacto() {
  const [c, setC] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const f = () => setC(mq.matches)
    f()
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])
  return c
}
