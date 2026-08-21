"use client"

import { useEffect, useRef, useState } from "react"

// Intro: el reto en una imagen. Abre en $10 y el contador sube de golpe hasta
// el total real recaudado. Cinematográfico, claro y 100% del reto.
const TARGET = 2649 // = netWorth actual (mantener en sync con app-context)
const FROM = 10
const DUR = 1500 // ms que tarda el conteo

const STARS: number[][] = [
  [8, 12, 1, 0.4], [22, 30, 1, 0.5], [35, 8, 1.5, 0.6], [48, 20, 1, 0.4], [62, 14, 1, 0.5],
  [76, 26, 1.5, 0.6], [90, 10, 1, 0.4], [14, 46, 1, 0.5], [30, 62, 1, 0.4], [6, 74, 1.5, 0.5],
  [88, 44, 1, 0.5], [72, 70, 1, 0.4], [94, 66, 1, 0.5], [18, 88, 1, 0.4], [40, 78, 1.5, 0.5],
  [58, 84, 1, 0.4], [82, 90, 1, 0.5], [50, 94, 1, 0.4], [10, 60, 1, 0.5], [96, 82, 1, 0.4],
  [4, 34, 1, 0.4], [66, 40, 1, 0.5], [28, 16, 1, 0.4], [44, 54, 1, 0.35], [80, 58, 1, 0.5],
  [34, 92, 1, 0.4],
]

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")

export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)
  const [val, setVal] = useState(FROM)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR)
      const e = 1 - Math.pow(1 - t, 3)
      setVal(FROM + (TARGET - FROM) * e)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    const t1 = setTimeout(() => setHide(true), 3400)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 4200)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (!show) return null

  return (
    <div
      onClick={() => {
        setHide(true)
        setTimeout(() => setShow(false), 400)
      }}
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-[opacity,transform] duration-[800ms] ease-in ${
        hide ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background: "radial-gradient(circle at 50% 42%, #0a1524 0%, #03060d 60%, #000 100%)",
        transform: hide ? "scale(1.14)" : "scale(1)",
      }}
    >
      <style>{`
        @keyframes kevGlow{0%,100%{opacity:.75;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
        @keyframes kevTw{0%,100%{opacity:.25}50%{opacity:.85}}
        @keyframes kevUp{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes kevReveal{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Glow celeste detrás del número */}
      <div
        className="pointer-events-none absolute left-1/2 top-[46%] h-[520px] w-[520px]"
        style={{
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(90,166,232,.28), rgba(90,166,232,.06) 45%, transparent 68%)",
          filter: "blur(8px)",
          animation: "kevGlow 3.4s ease-in-out infinite",
        }}
      />

      {/* Estrellas */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map(([x, y, s, o], i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${2 + (i % 4)}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Contenido */}
      <div className="relative z-[3] px-6 text-center" style={{ animation: "kevUp 0.7s cubic-bezier(.2,.7,.2,1) both" }}>
        <div className="mb-4 font-display text-[11px] font-semibold uppercase tracking-[0.42em] text-white/45 sm:text-xs">
          Recaudado en público
        </div>

        <div className="font-display font-extrabold leading-none tracking-tight text-white text-[84px] sm:text-[112px]"
          style={{ textShadow: "0 0 46px rgba(120,190,255,0.5)" }}>
          <span className="align-top text-[0.56em] text-[#bfe0ff]" style={{ marginRight: "0.04em" }}>$</span>
          {fmt(val)}
        </div>

        <div className="mx-auto my-5 h-px w-36" style={{ background: "linear-gradient(90deg, transparent, rgba(140,214,255,.7), transparent)", animation: "kevReveal 0.8s ease 1.5s both" }} />

        <div className="font-serif-display text-2xl italic text-white/70 sm:text-3xl" style={{ animation: "kevReveal 0.8s ease 1.6s both" }}>
          De $10 a un Mercedes
        </div>
        <div className="mt-3 font-serif-display text-sm tracking-[0.3em] text-[#8fd6ff]/80" style={{ animation: "kevReveal 0.8s ease 1.75s both" }}>
          kevproject.world
        </div>
      </div>
    </div>
  )
}
