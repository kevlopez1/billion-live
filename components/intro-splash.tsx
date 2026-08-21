"use client"

import { useEffect, useState } from "react"

// Planeta digital oscuro + habitantes tecnológicos (robots, cohetes, autos
// voladores, drones, satélites) + anillo orbital, en el espacio negro.
const CX = 200
const CY = 215
const R = 92
const C = "#8fd6ff" // cian holográfico
const MERIDIANS = [92, 66, 38, 13]
const PARALLELS = [-58, -30, 0, 30, 58].map((dy) => {
  const rx = Math.sqrt(Math.max(R * R - dy * dy, 1))
  return { dy, rx, ry: rx * 0.17 }
})

// Campo de estrellas: [left%, top%, px, opacidad, dur].
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

const Robot = () => (
  <>
    <circle cx={0} cy={-13} r={1.2} fill={C} />
    <line x1={0} y1={-12} x2={0} y2={-9} stroke={C} strokeWidth={1} />
    <rect x={-6} y={-9} width={12} height={9} rx={2} fill="none" stroke={C} strokeWidth={1.3} />
    <circle cx={-2.5} cy={-5} r={1.1} fill={C} />
    <circle cx={2.5} cy={-5} r={1.1} fill={C} />
    <line x1={-2} y1={-2} x2={2} y2={-2} stroke={C} strokeWidth={1} />
    <rect x={-5} y={1} width={10} height={7} rx={1.5} fill="none" stroke={C} strokeWidth={1.3} />
    <line x1={-6} y1={3} x2={-8.5} y2={5.5} stroke={C} strokeWidth={1.2} />
    <line x1={6} y1={3} x2={8.5} y2={5.5} stroke={C} strokeWidth={1.2} />
    <line x1={-2} y1={8} x2={-2} y2={11} stroke={C} strokeWidth={1.2} />
    <line x1={2} y1={8} x2={2} y2={11} stroke={C} strokeWidth={1.2} />
  </>
)
const Rocket = () => (
  <>
    <path d="M0,-13 C4,-8 5,-3 5,3 L3,9 L-3,9 L-5,3 C-5,-3 -4,-8 0,-13 Z" fill="none" stroke={C} strokeWidth={1.3} />
    <circle cx={0} cy={-3} r={2.2} fill="none" stroke={C} strokeWidth={1.1} />
    <path d="M-5,3 L-9,9 L-4.5,7" fill="none" stroke={C} strokeWidth={1.2} />
    <path d="M5,3 L9,9 L4.5,7" fill="none" stroke={C} strokeWidth={1.2} />
    <path d="M-2,9 L0,14 L2,9" fill="none" stroke={C} strokeWidth={1.1} strokeOpacity={0.7} />
  </>
)
const Satellite = () => (
  <>
    <rect x={-3.5} y={-4} width={7} height={8} rx={1} fill="none" stroke={C} strokeWidth={1.3} />
    <rect x={-12} y={-3.5} width={6.5} height={7} fill="none" stroke={C} strokeWidth={1.1} />
    <rect x={5.5} y={-3.5} width={6.5} height={7} fill="none" stroke={C} strokeWidth={1.1} />
    <line x1={-8.7} y1={-3.5} x2={-8.7} y2={3.5} stroke={C} strokeWidth={0.8} />
    <line x1={8.7} y1={-3.5} x2={8.7} y2={3.5} stroke={C} strokeWidth={0.8} />
    <line x1={-5} y1={0} x2={-3.5} y2={0} stroke={C} strokeWidth={1} />
    <line x1={5} y1={0} x2={3.5} y2={0} stroke={C} strokeWidth={1} />
    <line x1={0} y1={-4} x2={0} y2={-8} stroke={C} strokeWidth={1} />
    <circle cx={0} cy={-9} r={1.4} fill="none" stroke={C} strokeWidth={1} />
  </>
)
const Drone = () => (
  <>
    <rect x={-3.5} y={-2} width={7} height={4.5} rx={1.2} fill="none" stroke={C} strokeWidth={1.3} />
    <line x1={-3.5} y1={-1} x2={-9} y2={-5} stroke={C} strokeWidth={1.1} />
    <line x1={3.5} y1={-1} x2={9} y2={-5} stroke={C} strokeWidth={1.1} />
    <line x1={-3.5} y1={1.5} x2={-9} y2={5.5} stroke={C} strokeWidth={1.1} />
    <line x1={3.5} y1={1.5} x2={9} y2={5.5} stroke={C} strokeWidth={1.1} />
    <ellipse cx={-9} cy={-5} rx={3.2} ry={1.1} fill="none" stroke={C} strokeWidth={1} />
    <ellipse cx={9} cy={-5} rx={3.2} ry={1.1} fill="none" stroke={C} strokeWidth={1} />
    <ellipse cx={-9} cy={5.5} rx={3.2} ry={1.1} fill="none" stroke={C} strokeWidth={1} />
    <ellipse cx={9} cy={5.5} rx={3.2} ry={1.1} fill="none" stroke={C} strokeWidth={1} />
  </>
)
const FlyingCar = () => (
  <>
    <path d="M-10,2 Q-10,-2 -5,-3 L3,-4 Q8,-4 9,1 L10,3 Q10,4.5 8,4.5 L-8,4.5 Q-10,4.5 -10,2 Z" fill="none" stroke={C} strokeWidth={1.3} />
    <path d="M-4,-3.4 L-2,-6 L3,-6 L4,-3.8" fill="none" stroke={C} strokeWidth={1} />
    <circle cx={-5.5} cy={7.5} r={2.1} fill="none" stroke={C} strokeWidth={1.1} />
    <circle cx={5.5} cy={7.5} r={2.1} fill="none" stroke={C} strokeWidth={1.1} />
    <line x1={-5.5} y1={9.6} x2={-5.5} y2={12} stroke={C} strokeWidth={1} strokeOpacity={0.6} />
    <line x1={5.5} y1={9.6} x2={5.5} y2={12} stroke={C} strokeWidth={1} strokeOpacity={0.6} />
  </>
)
const Ufo = () => (
  <>
    <path d="M-6,-1 A6,5 0 0 1 6,-1" fill="none" stroke={C} strokeWidth={1.2} />
    <ellipse cx={0} cy={-1} rx={12} ry={4} fill="none" stroke={C} strokeWidth={1.3} />
    <circle cx={-5} cy={0.5} r={0.9} fill={C} />
    <circle cx={0} cy={1.2} r={0.9} fill={C} />
    <circle cx={5} cy={0.5} r={0.9} fill={C} />
  </>
)

const THINGS = [
  { k: "robot", x: 168, y: 188, s: 0.95, r: 0, d: 4 },
  { k: "rocket", x: 236, y: 202, s: 0.85, r: -18, d: 5 },
  { k: "sat", x: 200, y: 252, s: 0.8, r: 8, d: 6 },
  { k: "drone", x: 214, y: 176, s: 0.72, r: 0, d: 3.5 },
  { k: "car", x: 158, y: 232, s: 0.82, r: 0, d: 4.5 },
  { k: "ufo", x: 244, y: 244, s: 0.7, r: 0, d: 5.5 },
]

function renderThing(k: string) {
  switch (k) {
    case "robot": return <Robot />
    case "rocket": return <Rocket />
    case "sat": return <Satellite />
    case "drone": return <Drone />
    case "car": return <FlyingCar />
    default: return <Ufo />
  }
}

// Intro: mundo de la IA en el espacio negro. Aparece y hace zoom hacia la web.
export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 2800)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 3600)
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
        @keyframes kevFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      `}</style>

      {/* Estrellas */}
      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map(([x, y, s, o, d], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${d}s ease-in-out infinite` }}
          />
        ))}
      </div>

      {/* Contenido */}
      <div className="relative z-[3] flex flex-col items-center animate-fade-in-scale px-6">
        <span
          className="font-serif-display text-white text-[30px] sm:text-4xl md:text-5xl tracking-[0.1em]"
          style={{ textShadow: "0 0 26px rgba(120,180,255,0.6)" }}
        >
          kevproject.world
        </span>

        <svg width="360" height="396" viewBox="0 0 400 440" className="mt-1 w-[80vw] max-w-[380px]">
          <defs>
            <radialGradient id="kevSph" cx="38%" cy="32%" r="78%">
              <stop offset="0%" stopColor="#22344f" />
              <stop offset="42%" stopColor="#0a1220" />
              <stop offset="100%" stopColor="#020407" />
            </radialGradient>
            <radialGradient id="kevAtmo" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#5ab0ff" stopOpacity="0" />
              <stop offset="83%" stopColor="#5ab0ff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#5ab0ff" stopOpacity="0" />
            </radialGradient>
            <filter id="kevGlow">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="kevTGlow">
              <feGaussianBlur stdDeviation="0.7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="kevBall"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>

          <circle cx={CX} cy={CY} r="140" fill="url(#kevAtmo)" style={{ animation: "kevPulse 3.6s ease-in-out infinite" }} />

          {/* Anillo orbital + satélite */}
          <g transform={`rotate(-18 ${CX} ${CY})`}>
            <ellipse cx={CX} cy={CY} rx="150" ry="44" fill="none" stroke={C} strokeOpacity="0.35" strokeWidth="1.2" />
            <g transform={`translate(${CX} ${CY})`}>
              <g transform="scale(1 0.293)">
                <g style={{ animation: "kevSpin 9s linear infinite" }}>
                  <circle cx="150" cy="0" r="5" fill="#eafaff" filter="url(#kevGlow)" />
                </g>
              </g>
            </g>
          </g>

          {/* Esfera oscura */}
          <circle cx={CX} cy={CY} r={R} fill="url(#kevSph)" />
          <g clipPath="url(#kevBall)">
            {MERIDIANS.map((rx, i) => (
              <ellipse key={`m${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke={C} strokeOpacity="0.18" strokeWidth="1" />
            ))}
            {PARALLELS.map((p, i) => (
              <ellipse key={`p${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} fill="none" stroke={C} strokeOpacity="0.14" strokeWidth="1" />
            ))}
            {/* Habitantes tecnológicos */}
            {THINGS.map((t, i) => (
              <g key={`t${i}`} transform={`translate(${t.x} ${t.y})`} filter="url(#kevTGlow)">
                <g style={{ animation: `kevFloat ${t.d}s ease-in-out infinite` }}>
                  <g transform={`rotate(${t.r}) scale(${t.s})`}>{renderThing(t.k)}</g>
                </g>
              </g>
            ))}
          </g>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C} strokeOpacity="0.45" strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  )
}
