"use client"

import { useEffect, useState } from "react"

// Intro minimalista: solo el dominio kevproject.world sobre negro, aparece y
// se desvanece hacia la web.
const STARS: number[][] = [
  [8, 12, 1, 0.4], [22, 30, 1, 0.5], [35, 8, 1.5, 0.6], [48, 20, 1, 0.4], [62, 14, 1, 0.5],
  [76, 26, 1.5, 0.6], [90, 10, 1, 0.4], [14, 46, 1, 0.5], [30, 62, 1, 0.4], [6, 74, 1.5, 0.5],
  [88, 44, 1, 0.5], [72, 70, 1, 0.4], [94, 66, 1, 0.5], [18, 88, 1, 0.4], [40, 78, 1.5, 0.5],
  [58, 84, 1, 0.4], [82, 90, 1, 0.5], [50, 94, 1, 0.4], [10, 60, 1, 0.5], [96, 82, 1, 0.4],
]

export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 2300)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 3100)
    return () => {
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
      style={{ background: "#000000", transform: hide ? "scale(1.12)" : "scale(1)" }}
    >
      <style>{`
        @keyframes kevTw{0%,100%{opacity:.25}50%{opacity:.8}}
        @keyframes kevIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Estrellas sutiles */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map(([x, y, s, o], i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${2 + (i % 4)}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Dominio */}
      <span
        className="relative z-[3] font-serif-display text-white text-[30px] sm:text-4xl md:text-5xl tracking-[0.14em]"
        style={{ textShadow: "0 0 30px rgba(140,214,255,0.55)", animation: "kevIn 0.9s cubic-bezier(.2,.7,.2,1) both" }}
      >
        kevproject.world
      </span>
    </div>
  )
}
