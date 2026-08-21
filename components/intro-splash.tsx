"use client"

import { useEffect, useState } from "react"

// Intro premium: planeta oscuro con una red de IA (nodos de luz + arcos),
// satélites en órbita, galaxias en tonos joya en las esquinas.
const CX = 200
const CY = 215
const R = 96
const C = "#8fd6ff"

const NODES3D: number[][] = [
  [-0.05, -0.968, 0.246], [0.755, -0.286, 0.59], [0.775, -0.411, 0.48], [-0.274, -0.372, 0.887],
  [0.453, 0.39, 0.802], [-0.891, -0.446, 0.088], [0.456, 0.714, 0.531], [0.517, 0.616, 0.594],
  [0.68, 0.695, 0.235], [0.183, -0.189, 0.965], [0.904, -0.193, 0.381], [-0.186, 0.588, 0.787],
  [-0.765, 0.093, 0.637], [0.854, 0.32, 0.409], [0.308, 0.045, 0.95], [0.486, -0.717, 0.5],
  [0.478, -0.182, 0.859], [0.511, -0.621, 0.594], [0.849, -0.48, 0.222], [-0.381, 0.92, 0.09],
]
const EDGES: number[][] = [
  [0, 15], [0, 17], [1, 2], [1, 4], [1, 9], [1, 10], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17], [1, 18],
  [2, 9], [2, 10], [2, 13], [2, 14], [2, 15], [2, 16], [2, 17], [2, 18], [3, 9], [3, 12], [3, 14], [3, 16],
  [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 13], [4, 14], [4, 16], [5, 12], [6, 7], [6, 8],
  [6, 11], [6, 13], [6, 14], [7, 8], [7, 11], [7, 13], [7, 14], [7, 16], [8, 13], [9, 14], [9, 15], [9, 16],
  [9, 17], [10, 13], [10, 14], [10, 15], [10, 16], [10, 17], [10, 18], [11, 12], [11, 14], [11, 19],
  [13, 14], [13, 16], [13, 18], [14, 16], [14, 17], [15, 16], [15, 17], [15, 18], [16, 17], [16, 18], [17, 18],
]

const proj = (v: number[]) => [CX + R * v[0], CY - R * v[1]]

const ARCS = EDGES.map(([i, j]) => {
  const a = proj(NODES3D[i])
  const b = proj(NODES3D[j])
  const mx = (NODES3D[i][0] + NODES3D[j][0]) / 2
  const my = (NODES3D[i][1] + NODES3D[j][1]) / 2
  const mz = (NODES3D[i][2] + NODES3D[j][2]) / 2
  const m = Math.hypot(mx, my, mz) || 1
  const c = proj([mx / m, my / m, mz / m])
  const depth = (NODES3D[i][2] + NODES3D[j][2]) / 2
  return {
    d: `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`,
    op: +(0.08 + 0.3 * depth).toFixed(2),
  }
})
const NODEDOTS = NODES3D.map((v, k) => {
  const p = proj(v)
  return { x: +p[0].toFixed(1), y: +p[1].toFixed(1), r: +(1.1 + 2.4 * v[2]).toFixed(1), op: +(0.35 + 0.6 * v[2]).toFixed(2), hub: k % 5 === 0 }
})

const GRID_M = [96, 60, 26]
const GRID_P = [-46, 0, 46].map((dy) => {
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
  [82.2, 11.3, 1.5, 0.6, 3], [83.1, 38.3, 1.5, 0.6, 5], [32, 82.9, 1.5, 0.3, 4], [57.1, 30.9, 1, 0.5, 5],
]

type Galaxy = { w: string; h: string; color: string; rot: number; d: number; left?: string; right?: string; top?: string; bottom?: string }
const GALAXIES: Galaxy[] = [
  { w: "56%", h: "26%", left: "-22%", top: "-14%", color: "rgba(190,40,150,0.55)", rot: -28, d: 13 },
  { w: "56%", h: "26%", right: "-24%", top: "-16%", color: "rgba(96,60,190,0.5)", rot: 24, d: 16 },
  { w: "58%", h: "26%", left: "-24%", bottom: "-14%", color: "rgba(20,140,130,0.45)", rot: 18, d: 15 },
  { w: "56%", h: "26%", right: "-24%", bottom: "-14%", color: "rgba(180,110,30,0.42)", rot: -22, d: 18 },
]

const ORBITS = [
  { rx: 158, ry: 44, tilt: -16, dur: 16, dir: "normal", start: 30 },
  { rx: 182, ry: 64, tilt: 22, dur: 24, dir: "reverse", start: 200 },
  { rx: 150, ry: 124, tilt: -44, dur: 28, dir: "normal", start: 120 },
]

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
        @keyframes kevTw{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes kevGal{0%,100%{opacity:.6}50%{opacity:1}}
      `}</style>

      {/* Galaxias en tonos joya */}
      {GALAXIES.map((g, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: g.w, height: g.h, left: g.left, right: g.right, top: g.top, bottom: g.bottom,
            background: `radial-gradient(circle, ${g.color}, transparent 72%)`,
            filter: "blur(52px)", mixBlendMode: "screen", transform: `rotate(${g.rot}deg)`,
            animation: `kevGal ${g.d}s ease-in-out infinite`,
          }}
        />
      ))}

      {/* Estrellas */}
      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map(([x, y, s, o, d], i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o, animation: `kevTw ${d}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Contenido */}
      <div className="relative z-[3] flex flex-col items-center animate-fade-in-scale px-6">
        <span className="font-serif-display text-white text-[30px] sm:text-4xl md:text-5xl tracking-[0.14em]"
          style={{ textShadow: "0 0 32px rgba(140,214,255,0.6)" }}>
          kevproject.world
        </span>
        <span className="mt-3 mb-1 h-px w-28"
          style={{ background: "linear-gradient(90deg, transparent, rgba(140,214,255,0.65), transparent)" }} />

        <svg width="360" height="396" viewBox="0 0 400 440" className="w-[82vw] max-w-[380px]">
          <defs>
            <radialGradient id="kevSph" cx="40%" cy="34%" r="80%">
              <stop offset="0%" stopColor="#1a2a42" />
              <stop offset="45%" stopColor="#080f1c" />
              <stop offset="100%" stopColor="#010204" />
            </radialGradient>
            <radialGradient id="kevAtmo" cx="50%" cy="50%" r="50%">
              <stop offset="62%" stopColor="#7cc8ff" stopOpacity="0" />
              <stop offset="84%" stopColor="#7cc8ff" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#7cc8ff" stopOpacity="0" />
            </radialGradient>
            <filter id="kevGlow">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="kevBall"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>

          <circle cx={CX} cy={CY} r="145" fill="url(#kevAtmo)" style={{ animation: "kevPulse 3.8s ease-in-out infinite" }} />

          {/* Órbitas + satélites (partículas) */}
          {ORBITS.map((o, i) => (
            <g key={`o${i}`} transform={`rotate(${o.tilt} ${CX} ${CY})`}>
              <ellipse cx={CX} cy={CY} rx={o.rx} ry={o.ry} fill="none" stroke={C} strokeOpacity="0.26" strokeWidth="1" />
              <g transform={`translate(${CX} ${CY})`}>
                <g transform={`scale(1 ${(o.ry / o.rx).toFixed(3)})`}>
                  <g style={{ animation: `kevSpin ${o.dur}s linear infinite`, animationDirection: o.dir }}>
                    <g transform={`rotate(${o.start})`}>
                      <circle cx={o.rx} cy={0} r="3" fill="#ffffff" filter="url(#kevGlow)" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          ))}

          {/* Esfera + red de IA */}
          <circle cx={CX} cy={CY} r={R} fill="url(#kevSph)" />
          <g clipPath="url(#kevBall)">
            {GRID_M.map((rx, i) => (
              <ellipse key={`gm${i}`} cx={CX} cy={CY} rx={rx} ry={R} fill="none" stroke="#5aa6e8" strokeOpacity="0.1" strokeWidth="0.8" />
            ))}
            {GRID_P.map((p, i) => (
              <ellipse key={`gp${i}`} cx={CX} cy={CY + p.dy} rx={p.rx} ry={p.ry} fill="none" stroke="#5aa6e8" strokeOpacity="0.08" strokeWidth="0.8" />
            ))}
            {ARCS.map((a, i) => (
              <path key={`a${i}`} d={a.d} fill="none" stroke={C} strokeOpacity={a.op} strokeWidth="0.9" />
            ))}
            {NODEDOTS.map((n, i) => (
              <g key={`n${i}`}>
                {n.hub && <circle cx={n.x} cy={n.y} r={n.r + 1.8} fill={C} opacity={n.op * 0.22} />}
                <circle cx={n.x} cy={n.y} r={n.r} fill="#dff2ff" opacity={n.op}
                  style={n.hub ? { animation: `kevTw ${3 + (i % 3)}s ease-in-out infinite` } : undefined} />
              </g>
            ))}
          </g>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C} strokeOpacity="0.35" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke={C} strokeOpacity="0.1" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}
