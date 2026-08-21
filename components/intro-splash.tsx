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
// Estrellas del fondo (posiciones fijas para no romper la hidratación).
const STARS = [
  [24, 60, 1, 0.5, 3], [60, 130, 0.7, 0.4, 2], [110, 40, 1.2, 0.7, 4], [150, 95, 0.8, 0.5, 3],
  [190, 30, 1, 0.6, 2], [250, 70, 0.7, 0.4, 4], [300, 45, 1.2, 0.7, 3], [350, 110, 1, 0.5, 2],
  [380, 60, 0.8, 0.4, 3], [40, 200, 1, 0.6, 4], [90, 260, 0.7, 0.4, 2], [30, 320, 1.1, 0.6, 3],
  [340, 210, 1, 0.5, 4], [370, 280, 0.8, 0.5, 2], [310, 330, 1.1, 0.7, 3], [70, 350, 0.7, 0.4, 4],
  [130, 300, 1, 0.5, 2], [270, 300, 0.8, 0.5, 3], [200, 340, 0.7, 0.4, 4], [15, 100, 0.9, 0.5, 3],
  [390, 160, 0.9, 0.5, 2], [55, 20, 0.8, 0.4, 4], [230, 20, 0.7, 0.4, 3], [160, 350, 0.9, 0.5, 2],
  [290, 130, 0.7, 0.4, 4], [120, 170, 0.7, 0.35, 3],
]

// Intro: mundo de la IA (kevproject.world) que aparece y se desvanece.
export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 2400)
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
        setTimeout(() => setShow(false), 350)
      }}
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-700 ${
        hide ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "#000000" }}
    >
      <style>{`@keyframes kevSpin{to{transform:rotate(360deg)}}@keyframes kevPulse{0%,100%{opacity:.7}50%{opacity:1}}@keyframes kevTw{0%,100%{opacity:.25}50%{opacity:.9}}`}</style>

      <div className="flex flex-col items-center animate-fade-in-scale px-6">
        <span
          className="font-serif-display text-white text-[30px] sm:text-4xl md:text-5xl tracking-[0.1em]"
          style={{ textShadow: "0 0 22px rgba(90,166,232,0.55)" }}
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

          {STARS.map(([x, y, r, o, d], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill="#ffffff"
              opacity={o}
              style={{ animation: `kevTw ${d}s ease-in-out infinite` }}
            />
          ))}

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
