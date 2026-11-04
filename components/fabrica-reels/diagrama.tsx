import type { Paso, Retorno } from "@/lib/fabrica-reels"
import s from "./fabrica.module.css"

// ──────────────────────────────────────────────────────────────
// EL FLUJO, DIBUJADO A MANO EN SVG
//
// Sin librería de diagramas: la que usamos antes no cargaba en todos los
// visores y Kev vio el código en vez del dibujo. Las cajas van en columna y
// cada retorno es una curva por fuera: las vueltas cortas a la izquierda, las
// largas a la derecha, cada una un poco más afuera para que no se crucen.
// ──────────────────────────────────────────────────────────────

const ANCHO = 900
const CAJA_X = 250
const CAJA_W = 400
const CENTRO = CAJA_X + CAJA_W / 2
const SEP = 56

function partir(texto: string, max: number): string[] {
  const out: string[] = []
  let linea = ""
  for (const p of texto.split(/\s+/)) {
    if ((linea + " " + p).trim().length > max && linea) {
      out.push(linea)
      linea = p
    } else linea = (linea + " " + p).trim()
  }
  if (linea) out.push(linea)
  return out
}

export function Diagrama({ pasos, retornos }: { pasos: Paso[]; retornos: Retorno[] }) {
  let y = 20
  const cajas = pasos.map((p) => {
    const lineas = partir(p.detalle, 46).slice(0, 3)
    const h = 48 + lineas.length * 21
    const c = { ...p, lineas, y, h }
    y += h + SEP
    return c
  })
  const alto = y - SEP + 20

  // Las vueltas cortas (1–2 pasos) van a la izquierda y las largas a la
  // derecha; dentro de cada lado, la más corta va más pegada a las cajas.
  const cortas = retornos.filter((r) => Math.abs(r.desde - r.hasta) <= 2).sort((a, b) => Math.abs(a.desde - a.hasta) - Math.abs(b.desde - b.hasta))
  const largas = retornos.filter((r) => Math.abs(r.desde - r.hasta) > 2).sort((a, b) => Math.abs(a.desde - a.hasta) - Math.abs(b.desde - b.hasta))
  const lados = [
    ...cortas.map((r, i) => ({ r, derecha: false, nivel: i })),
    ...largas.map((r, i) => ({ r, derecha: true, nivel: i })),
  ]

  return (
    <div className={s.diagrama}>
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label="Diagrama de flujo de un video, paso a paso, con sus retornos">
        <defs>
          <marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#d4d4d4" />
          </marker>
        </defs>

        {cajas.slice(0, -1).map((c, i) => (
          <line key={`f${i}`} x1={CENTRO} y1={c.y + c.h} x2={CENTRO} y2={cajas[i + 1].y - 2} className={s.flecha} markerEnd="url(#punta)" />
        ))}

        {lados.map(({ r, derecha, nivel }, k) => {
          const a = cajas[r.desde]
          const b = cajas[r.hasta]
          if (!a || !b) return null
          const borde = derecha ? CAJA_X + CAJA_W : CAJA_X
          const sale = derecha ? 1 : -1
          const off = 90 + 120 * nivel
          const ctrl = borde + sale * off
          const y1 = a.y + a.h / 2
          const y2 = b.y + b.h / 2
          // La etiqueta va sobre la curva: al medio en el nivel de adentro y más
          // arriba en los de afuera, para que dos etiquetas no queden a la par.
          const t = nivel === 0 ? 0.5 : 0.3
          const ex = borde + sale * off * 3 * t * (1 - t)
          const ey = y1 + (y2 - y1) * (t * t * (3 - 2 * t))
          const lineas = partir(r.etiqueta, 13)
          const lw = Math.max(...lineas.map((l) => l.length)) * 7.4 + 16
          const lh = lineas.length * 18 + 10
          return (
            <g key={`r${k}`}>
              <path
                d={`M ${borde} ${y1} C ${ctrl} ${y1}, ${ctrl} ${y2}, ${borde} ${y2}`}
                className={s.flecha}
                strokeDasharray={r.punteado ? "6 5" : undefined}
                markerEnd="url(#punta)"
              />
              <rect x={ex - lw / 2} y={ey - lh / 2} width={lw} height={lh} className={s.fondoEtiqueta} />
              {lineas.map((l, i) => (
                <text key={i} x={ex} y={ey - lh / 2 + 18 + i * 18} className={s.etiquetaSvg}>{l}</text>
              ))}
            </g>
          )
        })}

        {cajas.map((c, i) => (
          <g key={`c${i}`}>
            <rect x={CAJA_X} y={c.y} width={CAJA_W} height={c.h} className={s.caja} strokeDasharray={c.kev ? "7 5" : undefined} />
            <text x={CENTRO} y={c.y + 30} className={s.cajaTitulo}>{c.titulo}</text>
            {c.lineas.map((l, j) => (
              <text key={j} x={CENTRO} y={c.y + 56 + j * 21} className={s.cajaTexto}>{l}</text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
