"use client"

// ──────────────────────────────────────────────────────────────
// El radar de abajo a la izquierda, como el de GTA: norte arriba, la cámara
// al centro con su cono y un punto de color por residente. En la superficie
// dibuja las huellas reales de los edificios (HUELLAS); en el subsuelo, la
// grilla de celdas del nivel (CELDAS). Se dibuja en un canvas 2D propio a
// ~20 cuadros por segundo: no compite con el render 3D.
// ──────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react"
import { CELDAS, HUELLAS, SUB_COLUMNAS, SUB_FILAS, SUB_MEDIO_ANCHO, SUB_MEDIO_FONDO } from "../lugares"
import type { NivelId } from "../tipos"

export interface DatosRadar {
  cam: { x: number; z: number; rumbo: number }
  nivel: NivelId
  puntos: Array<{ id: string; x: number; z: number; color: string; nivel: NivelId; visible: boolean }>
  seleccionado: string | null
  /** Color de cada celda del subsuelo (lugarId → color), para la grilla. */
  colorCelda: Record<string, string>
}

/**
 * Hacia dónde mira la cámara en planta. El motor da el rumbo en radianes con
 * la convención de Three.js para rotation.y (0 = mira hacia +z): el vector
 * es (sin, cos). Si el motor cambia la convención, se cambia solo aquí.
 */
export const direccionDeRumbo = (r: number) => ({ x: Math.sin(r), z: Math.cos(r) })

export function Radar({ fuente, tam, etiqueta }: { fuente: () => DatosRadar | null; tam: number; etiqueta: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fuenteRef = useRef(fuente)
  fuenteRef.current = fuente

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(tam * dpr)
    cv.height = Math.round(tam * dpr)
    let raf = 0
    let ultimo = 0
    const cuadro = (t: number) => {
      raf = requestAnimationFrame(cuadro)
      if (t - ultimo < 48) return
      ultimo = t
      const d = fuenteRef.current()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dibujar(ctx, tam, d)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
  }, [tam])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={etiqueta}
      className="block rounded-full"
      style={{ width: tam, height: tam }}
    />
  )
}

function dibujar(ctx: CanvasRenderingContext2D, S: number, d: DatosRadar | null) {
  const R = S / 2
  ctx.clearRect(0, 0, S, S)
  ctx.save()
  ctx.beginPath()
  ctx.arc(R, R, R - 1, 0, Math.PI * 2)
  ctx.clip()

  // Fondo: oscuro con un brillo leve al centro.
  const g = ctx.createRadialGradient(R, R, 0, R, R, R)
  g.addColorStop(0, "rgba(28,36,40,0.92)")
  g.addColorStop(1, "rgba(6,9,11,0.94)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)

  if (!d) {
    ctx.restore()
    aro(ctx, R)
    return
  }

  const sub = d.nivel !== "superficie"
  // Metros que caben del centro al borde.
  const alcance = sub ? 105 : 175
  const k = (R - 4) / alcance
  const X = (x: number) => R + (x - d.cam.x) * k
  const Z = (z: number) => R + (z - d.cam.z) * k

  if (!sub) {
    // Terreno del predio, calles y edificios (huellas reales).
    const reja = HUELLAS.reja
    ctx.fillStyle = "rgba(74,110,70,0.42)"
    ctx.fillRect(X(reja.x0), Z(reja.z0), (reja.x1 - reja.x0) * k, (reja.z1 - reja.z0) * k)
    ctx.strokeStyle = "rgba(255,255,255,0.16)"
    ctx.lineWidth = 1
    ctx.strokeRect(X(reja.x0), Z(reja.z0), (reja.x1 - reja.x0) * k, (reja.z1 - reja.z0) * k)

    ctx.strokeStyle = "rgba(160,170,180,0.35)"
    ctx.lineWidth = Math.max(2, 12 * k)
    linea(ctx, X(-400), Z(-78), X(400), Z(-78)) // Pennsylvania Avenue
    linea(ctx, X(-92), Z(-400), X(-92), Z(400)) // calle oeste
    linea(ctx, X(92), Z(-400), X(92), Z(400)) // calle este

    ctx.fillStyle = "rgba(90,160,210,0.7)"
    for (const f of [HUELLAS.fuenteNorte, HUELLAS.fuenteSur]) {
      ctx.beginPath()
      ctx.arc(X(f.x), Z(f.z), Math.max(2, f.radio * k), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = "rgba(236,236,230,0.88)"
    for (const h of [HUELLAS.residencia, HUELLAS.porticoNorte, HUELLAS.alaOeste, HUELLAS.columnataOeste, HUELLAS.eeob, HUELLAS.tesoro]) {
      ctx.fillRect(X(h.x0), Z(h.z0), (h.x1 - h.x0) * k, (h.z1 - h.z0) * k)
    }
    const ps = HUELLAS.porticoSur
    ctx.beginPath()
    ctx.arc(X(ps.cx), Z(ps.cz), ps.radio * k, 0, Math.PI)
    ctx.fill()
    const ov = HUELLAS.despachoOval
    ctx.beginPath()
    ctx.ellipse(X(ov.cx), Z(ov.cz), ov.rx * k, ov.rz * k, 0, 0, Math.PI * 2)
    ctx.fill()

    // La obra, rayada en ámbar.
    const o = HUELLAS.obra
    ctx.fillStyle = "rgba(240,170,60,0.28)"
    ctx.fillRect(X(o.x0), Z(o.z0), (o.x1 - o.x0) * k, (o.z1 - o.z0) * k)
    ctx.strokeStyle = "rgba(240,170,60,0.55)"
    ctx.lineWidth = 1
    ctx.strokeRect(X(o.x0), Z(o.z0), (o.x1 - o.x0) * k, (o.z1 - o.z0) * k)
  } else {
    // Subsuelo: las doce celdas del nivel con el color de su departamento.
    const celdas = CELDAS[d.nivel as "n1" | "n2" | "n3"]
    ctx.fillStyle = "rgba(255,255,255,0.05)"
    const s = HUELLAS.subsuelo
    ctx.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * k, (s.z1 - s.z0) * k)
    celdas.forEach((fila, r) =>
      fila.forEach((lugarId, c) => {
        const cx = SUB_COLUMNAS[c]
        const cz = SUB_FILAS[r]
        const color = d.colorCelda[lugarId] ?? "#9aa3ad"
        const x = X(cx - SUB_MEDIO_ANCHO + 1.5)
        const z = Z(cz - SUB_MEDIO_FONDO + 1.5)
        const w = (SUB_MEDIO_ANCHO * 2 - 3) * k
        const h = (SUB_MEDIO_FONDO * 2 - 3) * k
        ctx.fillStyle = hexAlfa(color, 0.22)
        ctx.fillRect(x, z, w, h)
        ctx.strokeStyle = hexAlfa(color, 0.6)
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, z + 0.5, w - 1, h - 1)
      }),
    )
    // Núcleo de ascensores.
    ctx.fillStyle = "rgba(140,210,255,0.85)"
    ctx.fillRect(X(-2.5), Z(19.5), 5 * k, 5 * k)
  }

  // Cono de la cámara.
  const dir = direccionDeRumbo(d.cam.rumbo)
  const ang = Math.atan2(dir.z, dir.x)
  const cono = ctx.createRadialGradient(R, R, 0, R, R, R * 0.75)
  cono.addColorStop(0, "rgba(255,255,255,0.32)")
  cono.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = cono
  ctx.beginPath()
  ctx.moveTo(R, R)
  ctx.arc(R, R, R * 0.75, ang - 0.5, ang + 0.5)
  ctx.closePath()
  ctx.fill()

  // Residentes del nivel. Los que quedan fuera del radar se pegan al borde, como en GTA.
  for (const p of d.puntos) {
    if (p.nivel !== d.nivel) continue
    let x = X(p.x)
    let z = Z(p.z)
    const dx = x - R
    const dz = z - R
    const dist = Math.hypot(dx, dz)
    const borde = R - 7
    const fuera = dist > borde
    if (fuera) {
      x = R + (dx / dist) * borde
      z = R + (dz / dist) * borde
    }
    const sel = p.id === d.seleccionado
    const r = sel ? 5 : fuera ? 2.6 : 3.6
    ctx.globalAlpha = p.visible ? 1 : 0.45
    ctx.beginPath()
    ctx.arc(x, z, r + 1.4, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.75)"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, z, r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    if (sel) {
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x, z, r + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // La cámara: una flecha blanca.
  ctx.save()
  ctx.translate(R, R)
  ctx.rotate(ang + Math.PI / 2)
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(5, 5)
  ctx.lineTo(0, 2.5)
  ctx.lineTo(-5, 5)
  ctx.closePath()
  ctx.fillStyle = "#fff"
  ctx.shadowColor = "rgba(0,0,0,0.8)"
  ctx.shadowBlur = 4
  ctx.fill()
  ctx.restore()

  ctx.restore()
  aro(ctx, R)
}

function aro(ctx: CanvasRenderingContext2D, R: number) {
  ctx.beginPath()
  ctx.arc(R, R, R - 1.5, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(255,255,255,0.22)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  // Norte.
  ctx.font = "700 10px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "rgba(0,0,0,0.8)"
  ctx.beginPath()
  ctx.arc(R, 9, 7.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.fillText("N", R, 9.5)
}

function linea(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

function hexAlfa(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(154,163,173,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
