"use client"

import { useEffect, useRef, type ReactNode } from "react"

// El auto se acerca y se inclina apenas mientras bajas, como los productos en
// apple.com. Va con transform (sin layout) y respeta "reducir movimiento".
export function AutoScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const pintar = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      // 0 cuando el auto entra por abajo, 1 cuando sale por arriba.
      const p = Math.min(1, Math.max(0, 1 - (r.top + r.height) / (innerHeight + r.height)))
      const escala = 0.94 + p * 0.22
      const giro = (p - 0.35) * -6
      el.style.transform = `translate3d(0, ${(p - 0.35) * -40}px, 0) scale(${escala}) rotate(${giro}deg)`
    }
    const pedir = () => { if (!raf) raf = requestAnimationFrame(pintar) }
    pintar()
    addEventListener("scroll", pedir, { passive: true })
    addEventListener("resize", pedir)
    return () => { removeEventListener("scroll", pedir); removeEventListener("resize", pedir); cancelAnimationFrame(raf) }
  }, [])

  return <div ref={ref} className="will-change-transform">{children}</div>
}
