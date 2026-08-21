"use client"

import { useEffect, useState } from "react"

// Intro premium: planeta imponente con red de IA (toques rojos) + una flota de
// naves/robots/vehículos sleek alrededor. Título como marca de agua tenue.
const CX = 200
const CY = 222
const R = 100
const C = "#9fe0ff"
const RED = "#ff3b5c"
const FILL = "#0a1220"

const NODES3D: number[][] = [
  [-0.05, -0.968, 0.246], [0.755, -0.286, 0.59], [0.775, -0.411, 0.48], [-0.274, -0.372, 0.887],
  [0.453, 0.39, 0.802], [-0.891, -0.446, 0.088], [0.456, 0.714, 0.531], [0.517, 0.616, 0.594],
  [0.68, 0.695, 0.235], [0.183, -0.189, 0.965], [0.904, -0.193, 0.381], [-0.186, 0.588, 0.787],
  [-0.765, 0.093, 0.637], [0.854, 0.32, 0.409], [0.308, 0.045, 0.95], [0.486, -0.717, 0.5],
  [0.478, -0.182, 0.859], [0.511, -0.621, 0.594], [0.849, -0.48, 0.222], [-0.381, 0.92, 0.09],
  [0.925, -0.019, 0.378], [-0.224, -0.048, 0.973],
]
const EDGES: number[][] = [
  [0, 15], [0, 17], [1, 2], [1, 4], [1, 9], [1, 10], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17], [1, 18], [1, 20],
  [2, 9], [2, 10], [2, 13], [2, 14], [2, 15], [2, 16], [2, 17], [2, 18], [2, 20], [3, 9], [3, 12], [3, 14], [3, 16],
  [3, 21], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 13], [4, 14], [4, 16], [4, 20], [4, 21], [5, 12],
  [6, 7], [6, 8], [6, 11], [6, 13], [6, 14], [7, 8], [7, 11], [7, 13], [7, 14], [7, 16], [7, 20], [8, 13], [8, 20],
  [9, 14], [9, 15], [9, 16], [9, 17], [9, 21], [10, 13], [10, 14], [10, 15], [10, 16], [10, 17], [10, 18], [10, 20],
  [11, 12], [11, 14], [11, 19], [11, 21], [12, 21], [13, 14], [13, 16], [13, 18], [13, 20], [14, 16], [14, 17],
  [14, 20], [14, 21], [15, 16], [15, 17], [15, 18], [15, 20], [16, 17], [16, 18], [16, 20], [16, 21], [17, 18], [17, 20], [18, 20],
]

const proj = (v: number[]) => [CX + R * v[0], CY - R * v[1]]
const ARCS = EDGES.map(([i, j], k) => {
  const a = proj(NODES3D[i]), b = proj(NODES3D[j])
  const mx = (NODES3D[i][0] + NODES3D[j][0]) / 2, my = (NODES3D[i][1] + NODES3D[j][1]) / 2, mz = (NODES3D[i][2] + NODES3D[j][2]) / 2
  const m = Math.hypot(mx, my, mz) || 1
  const c = proj([mx / m, my / m, mz / m])
  const depth = (NODES3D[i][2] + NODES3D[j][2]) / 2
  return { d: `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`, op: +(0.08 + 0.3 * depth).toFixed(2), red: k % 7 === 0 }
})
const NODEDOTS = NODES3D.map((v, k) => {
  const p = proj(v)
  return { x: +p[0].toFixed(1), y: +p[1].toFixed(1), r: +(1.1 + 2.4 * v[2]).toFixed(1), op: +(0.35 + 0.6 * v[2]).toFixed(2), hub: k % 5 === 0, red: k % 6 === 0 }
})
const GRID_M = [100, 62, 26]
const GRID_P = [-48, 0, 48].map((dy) => {
  const rx = Math.sqrt(Math.max(R * R - dy * dy, 1))
  return { dy, rx: +rx.toFixed(1), ry: +(rx * 0.16).toFixed(1) }
})

const STARFIELD: number[][] = [
  [45.2, 56, 1.5, 0.7, 3], [18.5, 51.2, 1, 0.3, 5], [30.3, 9.1, 1, 0.7, 5], [65.4, 61.6, 1, 0.3, 2],
  [6, 19, 1, 0.3, 5], [32.6, 59.1, 1, 0.5, 4], [50, 66.2, 1.5, 0.6, 5], [99.8, 99.6, 1, 0.6, 4],
  [75.8, 51.3, 1, 0.3, 2], [40, 84.7, 1.5, 0.3, 2], [84.7, 0.1, 1, 0.3, 5], [37.5, 70.9, 1.5, 0.3, 3],
  [77.9, 27, 1, 0.6, 4], [1.5, 41, 1, 0.5, 3], [70.7, 1.1, 1.5, 0.7, 3], [68.2, 18.8, 1, 0.5, 5],
  [64.4, 11.7, 1.5, 0.5, 2], [27, 97.1, 1, 0.3, 3], [18.7, 99.6, 1, 0.3, 3], [21.3, 25.8, 1.5, 0.6, 5],
  [7.3, 9, 1, 0.3, 4], [37.2, 45.3, 1.5, 0.5, 5], [18.3, 15.4, 1, 0.5, 3], [15.8, 62.9, 1, 0.7, 5],
  [60.4, 42.1, 1, 0.3, 2], [51.2, 25.5, 1.5, 0.6, 5], [82.4, 59.6, 1, 0.5, 2], [12.6, 47.9, 1, 0.6, 3],
  [91.7, 20.4, 1, 0.3, 4], [41.1, 24.9, 1, 0.5, 4], [36.9, 57.2, 1, 0.3, 4], [13.8, 45, 1.5, 0.5, 2],
  [92.4, 47.5, 1.5, 0.6, 2], [2.1, 63.6, 1.5, 0.3, 4], [31.9, 99.9, 1, 0.7, 4], [73.7, 90, 1, 0.6, 4],
  [8.5, 47.3, 1, 0.7, 2], [86.3, 57.3, 1.5, 0.7, 2], [60.9, 8, 1, 0.6, 5], [72.8, 38.8, 1.5, 0.7, 5],
  [83.8, 8.4, 1, 0.6, 2], [48.1, 23, 1, 0.7, 5], [25.6, 1.1, 1.5, 0.5, 3], [51.8, 75.4, 1.5, 0.7, 5],
  [89.2, 32.7, 1.5, 0.5, 5], [80.4, 75.5, 1, 0.5, 5], [22, 92.1, 1, 0.5, 3], [49.6, 83.7, 1, 0.3, 4],
]

type Galaxy = { w: string; h: string; color: string; rot: number; d: number; left?: string; right?: string; top?: string; bottom?: string }
const GALAXIES: Galaxy[] = [
  { w: "56%", h: "24%", left: "-24%", top: "-14%", color: "rgba(190,40,150,0.5)", rot: -28, d: 13 },
  { w: "56%", h: "24%", right: "-24%", top: "-16%", color: "rgba(96,60,190,0.48)", rot: 24, d: 16 },
  { w: "58%", h: "24%", left: "-26%", bottom: "-14%", color: "rgba(255,59,92,0.34)", rot: 18, d: 15 },
  { w: "56%", h: "24%", right: "-24%", bottom: "-14%", color: "rgba(180,110,30,0.4)", rot: -22, d: 18 },
]

const Satellite = () => (
  <>
    <rect x={-3} y={-7} width={6} height={14} rx={2} fill={FILL} stroke={C} strokeWidth={1.1} />
    <path d="M-3,-4 L-13,-6 L-13,3 L-3,1 Z" fill={FILL} stroke={C} strokeWidth={1} />
    <path d="M3,-4 L13,-6 L13,3 L3,1 Z" fill={FILL} stroke={C} strokeWidth={1} />
    <line x1={-11} y1={-4.5} x2={-11} y2={1.5} stroke={C} strokeOpacity={0.7} strokeWidth={0.7} />
    <line x1={11} y1={-4.5} x2={11} y2={1.5} stroke={C} strokeOpacity={0.7} strokeWidth={0.7} />
    <path d="M0,-7 L0,-11 M-2,-12 A2.5,2.5 0 0 1 2,-12" fill="none" stroke={C} strokeWidth={1} />
    <circle cx={0} cy={2} r={1.3} fill={RED} />
  </>
)
const RocketS = () => (
  <>
    <path d="M0,-14 C4,-10 5,-4 5,3 L5,7 C5,10 2,11 0,11 C-2,11 -5,10 -5,7 L-5,3 C-5,-4 -4,-10 0,-14 Z" fill={FILL} stroke={C} strokeWidth={1.1} />
    <path d="M-5,4 L-10,11 L-5,8 Z" fill={FILL} stroke={C} strokeWidth={1} />
    <path d="M5,4 L10,11 L5,8 Z" fill={FILL} stroke={C} strokeWidth={1} />
    <circle cx={0} cy={-4} r={2.3} fill="none" stroke={C} strokeWidth={1} />
    <circle cx={0} cy={-4} r={1} fill={RED} />
    <path d="M-2,11 L0,16 L2,11" fill="none" stroke={RED} strokeWidth={1.2} strokeOpacity={0.8} />
  </>
)
const Jet = () => (
  <>
    <path d="M0,-13 C1.6,-9 2,-2 2.6,3 L12,9 L12,11 L2.6,8 L2,13 L-2,13 L-2.6,8 L-12,11 L-12,9 L-2.6,3 C-2,-2 -1.6,-9 0,-13 Z" fill={FILL} stroke={C} strokeWidth={1.05} />
    <circle cx={0} cy={-6} r={1.2} fill={RED} />
  </>
)
const Humanoid = () => (
  <>
    <rect x={-2.6} y={-13} width={5.2} height={5.4} rx={2.3} fill={FILL} stroke={C} strokeWidth={1} />
    <circle cx={0} cy={-10.3} r={0.9} fill={RED} />
    <path d="M-3.2,-7 L3.2,-7 L2.4,2 L-2.4,2 Z" fill={FILL} stroke={C} strokeWidth={1.05} />
    <path d="M-3.2,-6.4 L-6.2,2 L-4.6,2.6 L-2,-4 Z" fill={FILL} stroke={C} strokeWidth={0.9} />
    <path d="M3.2,-6.4 L6.2,2 L4.6,2.6 L2,-4 Z" fill={FILL} stroke={C} strokeWidth={0.9} />
    <path d="M-2.4,2 L-3,12 L-1,12 L-0.6,2 Z" fill={FILL} stroke={C} strokeWidth={0.95} />
    <path d="M2.4,2 L3,12 L1,12 L0.6,2 Z" fill={FILL} stroke={C} strokeWidth={0.95} />
    <line x1={0} y1={-4} x2={0} y2={-1} stroke={RED} strokeWidth={1} />
  </>
)
const Hovercar = () => (
  <>
    <path d="M-13,1 C-13,-3 -7,-5 0,-5 C7,-5 13,-3 13,1 C13,3.5 10,5 6,5 L-6,5 C-10,5 -13,3.5 -13,1 Z" fill={FILL} stroke={C} strokeWidth={1.1} />
    <path d="M-6,-4.4 C-3,-6.6 3,-6.6 6,-4.4" fill="none" stroke={C} strokeWidth={0.9} />
    <line x1={-9} y1={6.5} x2={9} y2={6.5} stroke={RED} strokeWidth={1.4} strokeOpacity={0.8} />
    <circle cx={-9} cy={0} r={1} fill={RED} />
    <circle cx={9} cy={0} r={1} fill={C} />
  </>
)
const Drone = () => (
  <>
    <path d="M-3,-2.5 L3,-2.5 L4,2 L-4,2 Z" fill={FILL} stroke={C} strokeWidth={1} />
    <line x1={-3} y1={-1.5} x2={-10} y2={-6} stroke={C} strokeWidth={1.1} />
    <line x1={3} y1={-1.5} x2={10} y2={-6} stroke={C} strokeWidth={1.1} />
    <line x1={-3} y1={1.5} x2={-10} y2={6} stroke={C} strokeWidth={1.1} />
    <line x1={3} y1={1.5} x2={10} y2={6} stroke={C} strokeWidth={1.1} />
    <ellipse cx={-10} cy={-6} rx={3.4} ry={1.1} fill={FILL} stroke={C} strokeWidth={0.9} />
    <ellipse cx={10} cy={-6} rx={3.4} ry={1.1} fill={FILL} stroke={C} strokeWidth={0.9} />
    <ellipse cx={-10} cy={6} rx={3.4} ry={1.1} fill={FILL} stroke={C} strokeWidth={0.9} />
    <ellipse cx={10} cy={6} rx={3.4} ry={1.1} fill={FILL} stroke={C} strokeWidth={0.9} />
    <circle cx={0} cy={0} r={1} fill={RED} />
  </>
)

const SHIPS = [
  { k: "sat", x: 58, y: 150, s: 1.05, r: -8, d: 5 },
  { k: "rocket", x: 342, y: 110, s: 1.05, r: 12, d: 6 },
  { k: "jet", x: 352, y: 255, s: 1.0, r: 60, d: 4.5 },
  { k: "human", x: 56, y: 330, s: 1.05, r: 0, d: 5.5 },
  { k: "hover", x: 165, y: 405, s: 1.05, r: 0, d: 4 },
  { k: "drone", x: 330, y: 350, s: 1.0, r: 0, d: 3.5 },
]
function renderShip(k: string) {
  switch (k) {
    case "sat": return <Satellite />
    case "rocket": return <RocketS />
    case "jet": return <Jet />
    case "human": return <Humanoid />
    case "hover": return <Hovercar />
    default: return <Drone />
  }
}

export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 3200)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 4000)
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
      style={{ background: "#000000", transform: hide ? "scale(1.2)" : "scale(1)" }}
    >
      <style>{`
        @keyframes kevSpin{to{transform:rotate(360deg)}}
        @keyframes kevPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes kevTw{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes kevGal{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes kevFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes kevIntroIn{0%{opacity:0;transform:scale(.66);filter:blur(9px)}60%{opacity:1}100%{opacity:1;transform:scale(1);filter:blur(0)}}
        @keyframes kevWm{0%{opacity:0;transform:translate(-50%,-8px)}100%{opacity:.34;transform:translate(-50%,0)}}
        @keyframes kevShip{0%{opacity:0}100%{opacity:1}}
      `}</style>

      {/* Galaxias en tonos joya (con un toque rojo) */}
      {GALAXIES.map((g, i) => (
        <div key={i} className="pointer-events-none absolute rounded-full"
          style={{ width: g.w, height: g.h, left: g.left, right: g.right, top: g.top, bottom: g.bottom, background: `radial-gradient(circle, ${g.color}, transparent 72%)`, filter: "blur(52px)", mixBlendMode: "screen", transform: `rotate(${g.rot}deg)`, animation: `kevGal ${g.d}s ease-in-out infinite` }} />
      ))}

      {/* Estrellas */}
      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map(([x, y, s, o, d], i) => (
          <span key={i} className="absolute rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${d}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Marca de agua del dominio (tenue) */}
      <span
        className="pointer-events-none absolute left-1/2 top-[7%] z-[4] font-serif-display text-white text-base sm:text-xl tracking-[0.34em]"
        style={{ opacity: 0.34, animation: "kevWm 1.2s ease 0.35s both" }}
      >
        kevproject.world
      </span>

      {/* Planeta + flota */}
      <div className="relative z-[3] flex items-center justify-center">
        <svg width="400" height="440" viewBox="0 0 400 440" className="w-[92vw] max-w-[420px]" style={{ animation: "kevIntroIn 1.2s cubic-bezier(.2,.7,.2,1) both" }}>
          <defs>
            <radialGradient id="kevSph" cx="40%" cy="34%" r="80%">
              <stop offset="0%" stopColor="#1c2438" />
              <stop offset="45%" stopColor="#0a0f1a" />
              <stop offset="100%" stopColor="#010204" />
            </radialGradient>
            <radialGradient id="kevAtmo" cx="50%" cy="50%" r="50%">
              <stop offset="62%" stopColor="#7cc8ff" stopOpacity="0" />
              <stop offset="84%" stopColor="#7cc8ff" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#7cc8ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="kevAtmoR" cx="50%" cy="50%" r="50%">
              <stop offset="66%" stopColor={RED} stopOpacity="0" />
              <stop offset="85%" stopColor={RED} stopOpacity="0.14" />
              <stop offset="100%" stopColor={RED} stopOpacity="0" />
            </radialGradient>
            <filter id="kevGlow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="kevSGlow"><feGaussianBlur stdDeviation="0.9" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <clipPath id="kevBall"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>

          <ellipse cx={CX - 40} cy={CY + 30} rx="150" ry="150" fill="url(#kevAtmoR)" style={{ animation: "kevPulse 4.4s ease-in-out infinite" }} />
          <circle cx={CX} cy={CY} r="150" fill="url(#kevAtmo)" style={{ animation: "kevPulse 3.8s ease-in-out infinite" }} />

          {/* Esfera + red de IA */}
          <circle cx={CX} cy={CY} r={R} fill="url(#kevSph)" />
          <g clipPath="url(#kevBall)">
            {GRID_M.map((rx, i) => (<ellipse key={`gm${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke="#5aa6e8" strokeOpacity="0.09" strokeWidth="0.8" />))}
            {GRID_P.map((p, i) => (<ellipse key={`gp${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} fill="none" stroke="#5aa6e8" strokeOpacity="0.07" strokeWidth="0.8" />))}
            {ARCS.map((a, i) => (<path key={`a${i}`} d={a.d} fill="none" stroke={a.red ? RED : C} strokeOpacity={a.op} strokeWidth="0.9" />))}
            {NODEDOTS.map((n, i) => (
              <g key={`n${i}`}>
                {n.hub && <circle cx={n.x} cy={n.y} r={n.r + 1.8} fill={n.red ? RED : C} opacity={n.op * 0.22} />}
                <circle cx={n.x} cy={n.y} r={n.r} fill={n.red ? RED : "#dff2ff"} opacity={n.op} style={n.hub ? { animation: `kevTw ${3 + (i % 3)}s ease-in-out infinite` } : undefined} />
              </g>
            ))}
          </g>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C} strokeOpacity="0.32" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={R + 11} fill="none" stroke={C} strokeOpacity="0.09" strokeWidth="1" />

          {/* Flota de naves / robots / vehículos */}
          {SHIPS.map((sh, i) => (
            <g key={`s${i}`} transform={`translate(${sh.x} ${sh.y}) rotate(${sh.r}) scale(${sh.s})`} filter="url(#kevSGlow)" style={{ animation: `kevShip 0.8s ease ${0.6 + i * 0.12}s both` }}>
              <g style={{ animation: `kevFloat ${sh.d}s ease-in-out infinite` }}>{renderShip(sh.k)}</g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
