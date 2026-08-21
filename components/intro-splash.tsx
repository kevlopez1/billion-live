"use client"

import { useEffect, useState } from "react"

// Intro: un mundo (planeta) que ADENTRO tiene una civilización futurista —
// robots, humanoides, naves, satélites, autos voladores— conectados por una
// red de IA. Título como marca de agua. Fondo negro con galaxias tenues.
const CX = 200
const CY = 250
const R = 118
const C = "#9fe0ff"
const RED = "#ff3b5c"
const FILL = "#0b1424"

const NODES3D: number[][] = [
  [-0.05, -0.968, 0.246], [0.755, -0.286, 0.59], [0.775, -0.411, 0.48], [-0.274, -0.372, 0.887], [0.453, 0.39, 0.802],
  [-0.891, -0.446, 0.088], [0.456, 0.714, 0.531], [0.517, 0.616, 0.594], [0.68, 0.695, 0.235], [0.183, -0.189, 0.965],
  [-0.437, -0.896, 0.078], [0.904, -0.193, 0.381], [-0.186, 0.588, 0.787], [-0.765, 0.093, 0.637], [0.854, 0.32, 0.409],
  [0.308, 0.045, 0.95], [0.486, -0.717, 0.5], [0.478, -0.182, 0.859], [0.511, -0.621, 0.594], [0.849, -0.48, 0.222],
  [-0.381, 0.92, 0.09], [0.925, -0.019, 0.378], [-0.224, -0.048, 0.973], [0.453, -0.871, 0.188], [0.502, 0.538, 0.677],
  [0.842, -0.275, 0.463], [0.228, -0.938, 0.261], [0.032, -0.042, 0.999], [-0.293, 0.088, 0.952], [-0.274, -0.281, 0.92],
]
const EDGES: number[][] = [
  [0, 10], [0, 16], [0, 18], [0, 23], [0, 26], [1, 2], [1, 9], [1, 11], [1, 14], [1, 15], [1, 16], [1, 17], [1, 18], [1, 19], [1, 21], [1, 25],
  [2, 11], [2, 14], [2, 16], [2, 17], [2, 18], [2, 19], [2, 21], [2, 23], [2, 25], [3, 9], [3, 13], [3, 15], [3, 22], [3, 27], [3, 28], [3, 29],
  [4, 6], [4, 7], [4, 8], [4, 9], [4, 12], [4, 14], [4, 15], [4, 17], [4, 24], [4, 27], [5, 10], [6, 7], [6, 8], [6, 12], [6, 14], [6, 24],
  [7, 8], [7, 12], [7, 14], [7, 15], [7, 24], [8, 14], [8, 24], [9, 15], [9, 17], [9, 18], [9, 22], [9, 27], [9, 28], [9, 29], [10, 26],
  [11, 14], [11, 16], [11, 17], [11, 18], [11, 19], [11, 21], [11, 25], [12, 22], [12, 24], [12, 27], [12, 28], [13, 22], [13, 28], [13, 29],
  [14, 21], [14, 24], [14, 25], [15, 17], [15, 22], [15, 24], [15, 27], [15, 28], [15, 29], [16, 17], [16, 18], [16, 19], [16, 23], [16, 25],
  [16, 26], [17, 18], [17, 21], [17, 22], [17, 24], [17, 25], [17, 27], [18, 19], [18, 23], [18, 25], [18, 26], [19, 21], [19, 23], [19, 25],
  [21, 25], [22, 27], [22, 28], [22, 29], [23, 26], [27, 28], [27, 29], [28, 29],
]

const proj = (v: number[]) => [CX + R * v[0], CY - R * v[1]]
const ARCS = EDGES.map(([i, j], k) => {
  const a = proj(NODES3D[i]), b = proj(NODES3D[j])
  const mx = (NODES3D[i][0] + NODES3D[j][0]) / 2, my = (NODES3D[i][1] + NODES3D[j][1]) / 2, mz = (NODES3D[i][2] + NODES3D[j][2]) / 2
  const m = Math.hypot(mx, my, mz) || 1
  const c = proj([mx / m, my / m, mz / m])
  const depth = (NODES3D[i][2] + NODES3D[j][2]) / 2
  return { d: `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`, op: +(0.06 + 0.22 * depth).toFixed(2), red: k % 8 === 0 }
})

const SIL_TYPES = ["human", "mech", "rocket", "sat", "jet", "drone", "jet", "station", "human", "mech", "rocket", "drone"]
const ORDER = NODES3D.map((v, i) => [i, v[2]]).sort((a, b) => b[1] - a[1]).map((p) => p[0])
const SILSET = new Set(ORDER.slice(0, 12))
const FIGS: { x: number; y: number; s: number; op: number; rot: number; type: string }[] = []
const DOTS: { x: number; y: number; r: number; op: number; red: boolean }[] = []
{
  let si = 0
  for (const k of ORDER) {
    const v = NODES3D[k], p = proj(v), z = v[2]
    if (SILSET.has(k)) {
      FIGS.push({ x: +p[0].toFixed(1), y: +p[1].toFixed(1), s: +(0.3 + 0.34 * z).toFixed(2), op: +(0.5 + 0.45 * z).toFixed(2), rot: ((k * 37) % 24) - 12, type: SIL_TYPES[si % SIL_TYPES.length] })
      si++
    } else {
      DOTS.push({ x: +p[0].toFixed(1), y: +p[1].toFixed(1), r: +(1 + 1.8 * z).toFixed(1), op: +(0.3 + 0.5 * z).toFixed(2), red: k % 6 === 0 })
    }
  }
}
const GRID_M = [118, 74, 32]
const GRID_P = [-58, 0, 58].map((dy) => {
  const rx = Math.sqrt(Math.max(R * R - dy * dy, 1))
  return { dy, rx: +rx.toFixed(1), ry: +(rx * 0.15).toFixed(1) }
})

const STARFIELD: number[][] = [
  [45.2, 56, 1.5, 0.7, 3], [18.5, 51.2, 1, 0.3, 5], [30.3, 9.1, 1, 0.7, 5], [65.4, 61.6, 1, 0.3, 2], [6, 19, 1, 0.3, 5],
  [32.6, 59.1, 1, 0.5, 4], [50, 66.2, 1.5, 0.6, 5], [99.8, 99.6, 1, 0.6, 4], [75.8, 51.3, 1, 0.3, 2], [40, 84.7, 1.5, 0.3, 2],
  [84.7, 0.1, 1, 0.3, 5], [37.5, 70.9, 1.5, 0.3, 3], [77.9, 27, 1, 0.6, 4], [1.5, 41, 1, 0.5, 3], [70.7, 1.1, 1.5, 0.7, 3],
  [68.2, 18.8, 1, 0.5, 5], [64.4, 11.7, 1.5, 0.5, 2], [27, 97.1, 1, 0.3, 3], [18.7, 99.6, 1, 0.3, 3], [21.3, 25.8, 1.5, 0.6, 5],
  [7.3, 9, 1, 0.3, 4], [37.2, 45.3, 1.5, 0.5, 5], [18.3, 15.4, 1, 0.5, 3], [15.8, 62.9, 1, 0.7, 5], [60.4, 42.1, 1, 0.3, 2],
  [51.2, 25.5, 1.5, 0.6, 5], [82.4, 59.6, 1, 0.5, 2], [12.6, 47.9, 1, 0.6, 3], [91.7, 20.4, 1, 0.3, 4], [41.1, 24.9, 1, 0.5, 4],
  [36.9, 57.2, 1, 0.3, 4], [13.8, 45, 1.5, 0.5, 2], [92.4, 47.5, 1.5, 0.6, 2], [2.1, 63.6, 1.5, 0.3, 4], [31.9, 99.9, 1, 0.7, 4],
  [73.7, 90, 1, 0.6, 4], [8.5, 47.3, 1, 0.7, 2], [86.3, 57.3, 1.5, 0.7, 2], [60.9, 8, 1, 0.6, 5], [72.8, 38.8, 1.5, 0.7, 5],
  [83.8, 8.4, 1, 0.6, 2], [48.1, 23, 1, 0.7, 5], [25.6, 1.1, 1.5, 0.5, 3], [51.8, 75.4, 1.5, 0.7, 5], [89.2, 32.7, 1.5, 0.5, 5],
  [80.4, 75.5, 1, 0.5, 5], [22, 92.1, 1, 0.5, 3], [49.6, 83.7, 1, 0.3, 4],
]

type Galaxy = { w: string; h: string; color: string; d: number; left?: string; right?: string; top?: string; bottom?: string }
const GALAXIES: Galaxy[] = [
  { w: "58%", h: "24%", left: "-26%", top: "-12%", color: "rgba(150,40,140,0.42)", d: 13 },
  { w: "58%", h: "24%", right: "-26%", top: "-14%", color: "rgba(80,55,170,0.4)", d: 16 },
  { w: "60%", h: "24%", left: "-28%", bottom: "-12%", color: "rgba(210,50,80,0.3)", d: 15 },
  { w: "58%", h: "24%", right: "-26%", bottom: "-12%", color: "rgba(150,95,30,0.32)", d: 18 },
]

const Satellite = () => (<><rect x={-3} y={-7} width={6} height={14} rx={2} fill={FILL} stroke={C} strokeWidth={1.1} /><path d="M-3,-4 L-12,-6 L-12,3 L-3,1 Z" fill={FILL} stroke={C} strokeWidth={1} /><path d="M3,-4 L12,-6 L12,3 L3,1 Z" fill={FILL} stroke={C} strokeWidth={1} /><circle cx={0} cy={2} r={1.3} fill={RED} /></>)
const RocketS = () => (<><path d="M0,-13 C4,-9 5,-3 5,3 L5,7 C5,10 2,11 0,11 C-2,11 -5,10 -5,7 L-5,3 C-5,-3 -4,-9 0,-13 Z" fill={FILL} stroke={C} strokeWidth={1.1} /><path d="M-5,4 L-9,10 L-5,8 Z" fill={FILL} stroke={C} strokeWidth={1} /><path d="M5,4 L9,10 L5,8 Z" fill={FILL} stroke={C} strokeWidth={1} /><circle cx={0} cy={-4} r={1} fill={RED} /></>)
const Jet = () => (<><path d="M0,-12 C1.6,-8 2,-2 2.6,3 L11,9 L11,11 L2.6,8 L2,12 L-2,12 L-2.6,8 L-11,11 L-11,9 L-2.6,3 C-2,-2 -1.6,-8 0,-12 Z" fill={FILL} stroke={C} strokeWidth={1.05} /><circle cx={0} cy={-5} r={1} fill={RED} /></>)
const Humanoid = () => (<><rect x={-2.4} y={-12} width={4.8} height={5} rx={2.1} fill={FILL} stroke={C} strokeWidth={1} /><circle cx={0} cy={-9.5} r={0.8} fill={RED} /><path d="M-3,-6.5 L3,-6.5 L2.2,2 L-2.2,2 Z" fill={FILL} stroke={C} strokeWidth={1} /><path d="M-3,-6 L-5.6,2 L-4.2,2.5 L-1.8,-3.5 Z" fill={FILL} stroke={C} strokeWidth={0.85} /><path d="M3,-6 L5.6,2 L4.2,2.5 L1.8,-3.5 Z" fill={FILL} stroke={C} strokeWidth={0.85} /><path d="M-2.2,2 L-2.8,11 L-1,11 L-0.5,2 Z" fill={FILL} stroke={C} strokeWidth={0.9} /><path d="M2.2,2 L2.8,11 L1,11 L0.5,2 Z" fill={FILL} stroke={C} strokeWidth={0.9} /></>)
const Hovercar = () => (<><path d="M-12,1 C-12,-3 -6,-5 0,-5 C6,-5 12,-3 12,1 C12,3.3 9,4.6 5.5,4.6 L-5.5,4.6 C-9,4.6 -12,3.3 -12,1 Z" fill={FILL} stroke={C} strokeWidth={1.1} /><path d="M-5.5,-4.2 C-3,-6.2 3,-6.2 5.5,-4.2" fill="none" stroke={C} strokeWidth={0.85} /><line x1={-8} y1={6} x2={8} y2={6} stroke={RED} strokeWidth={1.3} strokeOpacity={0.8} /></>)
const Drone = () => (<><path d="M-3,-2.4 L3,-2.4 L4,2 L-4,2 Z" fill={FILL} stroke={C} strokeWidth={1} /><line x1={-3} y1={-1.4} x2={-9} y2={-5.4} stroke={C} strokeWidth={1} /><line x1={3} y1={-1.4} x2={9} y2={-5.4} stroke={C} strokeWidth={1} /><line x1={-3} y1={1.4} x2={-9} y2={5.4} stroke={C} strokeWidth={1} /><line x1={3} y1={1.4} x2={9} y2={5.4} stroke={C} strokeWidth={1} /><ellipse cx={-9} cy={-5.4} rx={3} ry={1} fill={FILL} stroke={C} strokeWidth={0.85} /><ellipse cx={9} cy={-5.4} rx={3} ry={1} fill={FILL} stroke={C} strokeWidth={0.85} /><ellipse cx={-9} cy={5.4} rx={3} ry={1} fill={FILL} stroke={C} strokeWidth={0.85} /><ellipse cx={9} cy={5.4} rx={3} ry={1} fill={FILL} stroke={C} strokeWidth={0.85} /><circle cx={0} cy={0} r={0.9} fill={RED} /></>)
const Mech = () => (<><rect x={-4} y={-12.5} width={8} height={5.4} rx={1.8} fill={FILL} stroke={C} strokeWidth={1.05} /><line x1={-2.6} y1={-10.3} x2={2.6} y2={-10.3} stroke={RED} strokeWidth={1.2} /><rect x={-8} y={-7} width={4.4} height={4} rx={1.4} fill={FILL} stroke={C} strokeWidth={0.9} /><rect x={3.6} y={-7} width={4.4} height={4} rx={1.4} fill={FILL} stroke={C} strokeWidth={0.9} /><path d="M-5.4,-6.7 L5.4,-6.7 L4.4,3.5 L-4.4,3.5 Z" fill={FILL} stroke={C} strokeWidth={1.1} /><circle cx={0} cy={-1.5} r={1.4} fill={RED} /><path d="M-4.4,3.5 L-5.2,13 L-2.2,13 L-1.3,3.5 Z" fill={FILL} stroke={C} strokeWidth={1} /><path d="M4.4,3.5 L5.2,13 L2.2,13 L1.3,3.5 Z" fill={FILL} stroke={C} strokeWidth={1} /></>)
const Station = () => (<><circle cx={0} cy={0} r={5} fill={FILL} stroke={C} strokeWidth={1.1} /><circle cx={0} cy={0} r={2} fill="none" stroke={C} strokeWidth={0.8} /><circle cx={0} cy={0} r={0.9} fill={RED} /><path d="M-5,-1.6 L-16,-3.4 L-16,3.4 L-5,1.6 Z" fill={FILL} stroke={C} strokeWidth={0.9} /><path d="M5,-1.6 L16,-3.4 L16,3.4 L5,1.6 Z" fill={FILL} stroke={C} strokeWidth={0.9} /><rect x={-2.6} y={-11} width={5.2} height={5} rx={1.2} fill={FILL} stroke={C} strokeWidth={0.9} /></>)

function renderFig(t: string) {
  switch (t) {
    case "sat": return <Satellite />
    case "rocket": return <RocketS />
    case "jet": return <Jet />
    case "human": return <Humanoid />
    case "hover": return <Hovercar />
    case "mech": return <Mech />
    case "station": return <Station />
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
        @keyframes kevPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes kevTw{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes kevGal{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes kevIntroIn{0%{opacity:0;transform:scale(.66);filter:blur(9px)}60%{opacity:1}100%{opacity:1;transform:scale(1);filter:blur(0)}}
        @keyframes kevWm{0%{opacity:0;transform:translate(-50%,-8px)}100%{opacity:.3;transform:translate(-50%,0)}}
        @keyframes kevPop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
      `}</style>

      {GALAXIES.map((g, i) => (
        <div key={i} className="pointer-events-none absolute rounded-full"
          style={{ width: g.w, height: g.h, left: g.left, right: g.right, top: g.top, bottom: g.bottom, background: `radial-gradient(circle, ${g.color}, transparent 72%)`, filter: "blur(56px)", mixBlendMode: "screen", animation: `kevGal ${g.d}s ease-in-out infinite` }} />
      ))}

      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map(([x, y, s, o, d], i) => (
          <span key={i} className="absolute rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${d}s ease-in-out infinite` }} />
        ))}
      </div>

      <span className="pointer-events-none absolute left-1/2 top-[6%] z-[4] font-serif-display text-white text-base sm:text-lg tracking-[0.34em]"
        style={{ opacity: 0.3, animation: "kevWm 1.2s ease 0.4s both" }}>
        kevproject.world
      </span>

      <div className="relative z-[3] flex items-center justify-center">
        <svg width="400" height="500" viewBox="0 0 400 500" className="w-[94vw] max-w-[440px]" style={{ animation: "kevIntroIn 1.2s cubic-bezier(.2,.7,.2,1) both" }}>
          <defs>
            <radialGradient id="kevSph" cx="40%" cy="34%" r="82%">
              <stop offset="0%" stopColor="#1a2336" />
              <stop offset="46%" stopColor="#0a0f1a" />
              <stop offset="100%" stopColor="#010204" />
            </radialGradient>
            <radialGradient id="kevAtmo" cx="50%" cy="50%" r="50%">
              <stop offset="64%" stopColor="#7cc8ff" stopOpacity="0" />
              <stop offset="85%" stopColor="#7cc8ff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7cc8ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="kevAtmoR" cx="50%" cy="50%" r="50%">
              <stop offset="68%" stopColor={RED} stopOpacity="0" />
              <stop offset="86%" stopColor={RED} stopOpacity="0.13" />
              <stop offset="100%" stopColor={RED} stopOpacity="0" />
            </radialGradient>
            <filter id="kevSGlow"><feGaussianBlur stdDeviation="0.7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <clipPath id="kevBall"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>

          <ellipse cx={CX - 46} cy={CY + 34} rx="172" ry="172" fill="url(#kevAtmoR)" style={{ animation: "kevPulse 4.4s ease-in-out infinite" }} />
          <circle cx={CX} cy={CY} r="172" fill="url(#kevAtmo)" style={{ animation: "kevPulse 3.8s ease-in-out infinite" }} />
          <circle cx={CX} cy={CY} r={R} fill="url(#kevSph)" />

          <g clipPath="url(#kevBall)">
            {GRID_M.map((rx, i) => (<ellipse key={`gm${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke="#5aa6e8" strokeOpacity="0.07" strokeWidth="0.7" />))}
            {GRID_P.map((p, i) => (<ellipse key={`gp${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} fill="none" stroke="#5aa6e8" strokeOpacity="0.06" strokeWidth="0.7" />))}
            {ARCS.map((a, i) => (<path key={`a${i}`} d={a.d} fill="none" stroke={a.red ? RED : C} strokeOpacity={a.op} strokeWidth="0.8" />))}
            {DOTS.map((n, i) => (<circle key={`d${i}`} cx={n.x} cy={n.y} r={n.r} fill={n.red ? RED : "#dff2ff"} opacity={n.op} />))}
            {FIGS.map((f, i) => (
              <g key={`f${i}`} opacity={f.op} transform={`translate(${f.x} ${f.y}) rotate(${f.rot}) scale(${f.s})`} filter="url(#kevSGlow)">
                <g style={{ animation: `kevPop 0.6s ease ${0.7 + i * 0.06}s both` }}>{renderFig(f.type)}</g>
              </g>
            ))}
          </g>

          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C} strokeOpacity="0.3" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={R + 13} fill="none" stroke={C} strokeOpacity="0.08" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}
