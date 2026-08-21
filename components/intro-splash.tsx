"use client"

import { useEffect, useState } from "react"

// Planeta digital: globo wireframe + red de nodos (la IA) + anillo orbital.
const CX = 200
const CY = 215
const R = 92
const MERIDIANS = [92, 66, 38, 13]
const PARALLELS = [-58, -30, 0, 30, 58].map((dy) => {
  const rx = Math.sqrt(Math.max(R * R - dy * dy, 1))
  return { dy, rx, ry: rx * 0.17 }
})
const NODES: [number, number][] = [
  [168, 188], [230, 208], [196, 244], [214, 172], [160, 224], [240, 242],
]
const LINKS: [number, number][] = [[0, 3], [1, 5], [2, 4], [0, 2], [3, 1]]

// Campo de estrellas a pantalla completa: [left%, top%, px, opacidad, dur].
const STARFIELD: number[][] = [
  [45.2, 56, 2, 0.9, 3], [18.5, 51.2, 1, 0.3, 5], [30.3, 9.1, 1, 0.9, 5], [65.4, 61.6, 1, 0.3, 2],
  [6, 19, 1, 0.3, 5], [32.6, 59.1, 1, 0.5, 4], [50, 66.2, 2, 0.7, 5], [99.8, 99.6, 1, 0.7, 4],
  [75.8, 51.3, 1, 0.3, 2], [40, 84.7, 2, 0.3, 2], [84.7, 0.1, 1, 0.3, 5], [37.5, 70.9, 2, 0.3, 3],
  [77.9, 27, 1, 0.7, 4], [1.5, 41, 1, 0.5, 3], [70.7, 1.1, 2, 0.9, 3], [68.2, 18.8, 1, 0.5, 5],
  [64.4, 11.7, 2, 0.5, 2], [27, 97.1, 1.5, 0.3, 3], [18.7, 99.6, 1, 0.3, 3], [21.3, 25.8, 1.5, 0.7, 5],
  [7.3, 9, 1, 0.3, 4], [37.2, 45.3, 2, 0.5, 5], [18.3, 15.4, 1, 0.5, 3], [15.8, 62.9, 1, 0.9, 5],
  [60.4, 42.1, 1, 0.3, 2], [51.2, 25.5, 2, 0.7, 5], [82.4, 59.6, 1.5, 0.5, 2], [12.6, 47.9, 1, 0.7, 3],
  [91.7, 20.4, 1, 0.3, 4], [41.1, 24.9, 1, 0.5, 4], [36.9, 57.2, 1, 0.3, 4], [13.8, 45, 1.5, 0.5, 2],
  [92.4, 47.5, 1.5, 0.7, 2], [2.1, 63.6, 2, 0.3, 4], [31.9, 99.9, 1, 0.9, 4], [73.7, 90, 1, 0.7, 4],
  [8.5, 47.3, 1, 0.9, 2], [86.3, 57.3, 2, 0.9, 2], [60.9, 8, 1, 0.7, 5], [72.8, 38.8, 2, 0.9, 5],
  [83.8, 8.4, 1, 0.7, 2], [48.1, 23, 1, 0.9, 5], [25.6, 1.1, 1.5, 0.5, 3], [51.8, 75.4, 1.5, 0.9, 5],
  [89.2, 32.7, 1.5, 0.5, 5], [80.4, 75.5, 1, 0.5, 5], [22, 92.1, 1, 0.5, 3], [49.6, 83.7, 1, 0.3, 4],
  [82.2, 11.3, 2, 0.7, 3], [83.1, 38.3, 2, 0.7, 5], [32, 82.9, 1.5, 0.3, 4], [57.1, 30.9, 1, 0.5, 5],
  [45.5, 2.5, 1.5, 0.5, 3], [79.7, 98.4, 1, 0.9, 2], [63, 65.5, 1.5, 0.3, 3], [19.9, 47.5, 1, 0.3, 5],
]

// Nebulosas / galaxias de fondo.
type Nebula = {
  w: number
  h: number
  color: string
  anim: string
  left?: string
  right?: string
  top?: string
  bottom?: string
}
const NEBULAE: Nebula[] = [
  { w: 360, h: 320, left: "-14%", top: "16%", color: "rgba(109,63,156,0.55)", anim: "kevNebA 17s ease-in-out infinite" },
  { w: 400, h: 360, right: "-20%", top: "48%", color: "rgba(30,90,180,0.5)", anim: "kevNebB 21s ease-in-out infinite" },
  { w: 280, h: 250, right: "-6%", top: "10%", color: "rgba(176,64,122,0.42)", anim: "kevNebB 19s ease-in-out infinite" },
  { w: 320, h: 280, left: "8%", bottom: "4%", color: "rgba(40,120,140,0.32)", anim: "kevNebA 23s ease-in-out infinite" },
]

// Intro: mundo de la IA en el espacio, con galaxias detrás. Aparece y hace
// zoom hacia la web (kevproject.world).
export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 2600)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 3400)
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
      style={{ background: "#000000", transform: hide ? "scale(1.18)" : "scale(1)" }}
    >
      <style>{`
        @keyframes kevSpin{to{transform:rotate(360deg)}}
        @keyframes kevPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes kevTw{0%,100%{opacity:.25}50%{opacity:.95}}
        @keyframes kevNebA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(14px,-10px) scale(1.08)}}
        @keyframes kevNebB{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-16px,12px) scale(1.1)}}
      `}</style>

      {/* Galaxias / nebulosas */}
      {NEBULAE.map((n, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: n.w,
            height: n.h,
            left: n.left,
            right: n.right,
            top: n.top,
            bottom: n.bottom,
            background: `radial-gradient(circle, ${n.color}, transparent 70%)`,
            filter: "blur(55px)",
            animation: n.anim,
          }}
        />
      ))}

      {/* Estrellas */}
      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map(([x, y, s, o, d], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s,
              height: s,
              opacity: o,
              animation: `kevTw ${d}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Contenido */}
      <div className="relative z-[3] flex flex-col items-center animate-fade-in-scale px-6">
        <span
          className="font-serif-display text-white text-[30px] sm:text-4xl md:text-5xl tracking-[0.1em]"
          style={{ textShadow: "0 0 26px rgba(120,180,255,0.7)" }}
        >
          kevproject.world
        </span>

        <svg width="360" height="396" viewBox="0 0 400 440" className="mt-1 w-[80vw] max-w-[380px]">
          <defs>
            <radialGradient id="kevSph" cx="38%" cy="34%" r="75%">
              <stop offset="0%" stopColor="#7fc4ff" />
              <stop offset="42%" stopColor="#1d4b82" />
              <stop offset="100%" stopColor="#0a1d3a" />
            </radialGradient>
            <radialGradient id="kevAtmo" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#4a90d9" stopOpacity="0" />
              <stop offset="82%" stopColor="#4a90d9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4a90d9" stopOpacity="0" />
            </radialGradient>
            <filter id="kevGlow">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="kevBall">
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r="140"
            fill="url(#kevAtmo)"
            style={{ animation: "kevPulse 3.6s ease-in-out infinite" }}
          />

          {/* Anillo orbital + satélite */}
          <g transform={`rotate(-18 ${CX} ${CY})`}>
            <ellipse cx={CX} cy={CY} rx="150" ry="44" fill="none" stroke="#5aa6e8" strokeOpacity="0.4" strokeWidth="1.2" />
            <g transform={`translate(${CX} ${CY})`}>
              <g transform="scale(1 0.293)">
                <g style={{ animation: "kevSpin 9s linear infinite" }}>
                  <circle cx="150" cy="0" r="5.5" fill="#eafaff" filter="url(#kevGlow)" />
                </g>
              </g>
            </g>
          </g>

          {/* Esfera */}
          <circle cx={CX} cy={CY} r={R} fill="url(#kevSph)" />
          <g clipPath="url(#kevBall)">
            {MERIDIANS.map((rx, i) => (
              <ellipse key={`m${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke="#5aa6e8" strokeOpacity="0.28" strokeWidth="1" />
            ))}
            {PARALLELS.map((p, i) => (
              <ellipse key={`p${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} fill="none" stroke="#5aa6e8" strokeOpacity="0.22" strokeWidth="1" />
            ))}
            {LINKS.map(([a, b], i) => (
              <line key={`l${i}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="#7fc0ff" strokeOpacity="0.35" strokeWidth="0.8" />
            ))}
            {NODES.map(([x, y], i) => (
              <circle key={`n${i}`} cx={x} cy={y} r="2.6" fill="#bfe0ff" />
            ))}
          </g>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#7fc0ff" strokeOpacity="0.5" strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  )
}
