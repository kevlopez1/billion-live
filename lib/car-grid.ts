// ──────────────────────────────────────────────────────────────
// EL AUTO DE PÍXELES — geometría, precios y orden de llenado.
//
// Fuente ÚNICA de verdad: la importan el componente (para dibujar) y la API
// (para validar). El precio lo recalcula siempre el servidor, así no se puede
// falsificar desde el navegador.
//
// Decisión de diseño: el comprador NO elige la celda. Compra cantidad y las
// celdas se asignan en orden (de la trompa hacia atrás). Motivos:
//  1. En un celular una celda mide ~2px: sería imposible de tocar.
//  2. El auto se "materializa" en orden, que se ve mucho mejor que píxeles
//     sueltos y desparramados.
// Los 3 lugares premium SÍ se eligen: son grandes y son EL lugar del auto.
// ──────────────────────────────────────────────────────────────

export const VIEW_W = 1000
export const VIEW_H = 420
export const CELL = 6
export const COLS = Math.floor(VIEW_W / CELL)
export const ROWS = Math.floor(VIEW_H / CELL)

// Silueta como POLÍGONO (no bezier) a propósito: el mismo listado de puntos
// dibuja el SVG y resuelve el test "¿está dentro?" en el servidor.
// Perfil de coupé GT: trompa corta, capó largo, cabina atrás, cola fastback.
// Los arcos de rueda están RECORTADOS del cuerpo para que las ruedas encajen.
const TOP: [number, number][] = [
  [66, 318], [54, 292], [52, 262], [66, 234], [96, 212], [140, 201], [200, 194],
  [270, 189], [340, 185], [386, 181], [416, 168], [448, 144], [482, 126], [524, 118],
  [576, 116], [624, 119], [668, 127], [712, 142], [756, 163], [800, 185], [842, 200],
  [886, 209], [922, 218], [946, 232], [956, 254], [956, 284], [948, 310], [938, 318],
]
const ARCO_TRAS: [number, number][] = [
  [840, 318], [832, 288], [816, 262], [794, 246], [768, 241], [742, 246], [720, 262],
  [704, 288], [696, 318],
]
const ARCO_DEL: [number, number][] = [
  [324, 318], [316, 288], [300, 262], [278, 246], [252, 241], [226, 246], [204, 262],
  [188, 288], [180, 318],
]

export const BODY: [number, number][] = [...TOP, ...ARCO_TRAS, [500, 320], ...ARCO_DEL]

export const SUELO = 360

export const BODY_PATH = `M ${BODY.map(([x, y]) => `${x},${y}`).join(" L ")} Z`

// Los lugares premium son ESPACIOS ÚNICOS, como el patrocinio real de un auto
// de carrera: la puerta y las ruedas son EL lugar, no un píxel más.
export type SlotId = "puerta" | "rueda-del" | "rueda-tras"

export type Slot = {
  id: SlotId
  label: string
  price: number
  cx: number
  cy: number
  r: number
}

export const SLOTS: Slot[] = [
  { id: "rueda-del", label: "Rueda delantera", price: 500, cx: 252, cy: 300, r: 60 },
  { id: "rueda-tras", label: "Rueda trasera", price: 500, cx: 768, cy: 300, r: 60 },
  { id: "puerta", label: "La puerta", price: 250, cx: 520, cy: 265, r: 50 },
]

export const PIXEL_PRICE = 10

export function slotById(id: string): Slot | undefined {
  return SLOTS.find((s) => s.id === id)
}

/** Ray casting: ¿el punto cae dentro del polígono del cuerpo? */
export function insideBody(px: number, py: number): boolean {
  let hit = false
  for (let i = 0, j = BODY.length - 1; i < BODY.length; j = i++) {
    const [xi, yi] = BODY[i]
    const [xj, yj] = BODY[j]
    const cruza = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (cruza) hit = !hit
  }
  return hit
}

function pisaSlot(px: number, py: number): boolean {
  return SLOTS.some((s) => (px - s.cx) ** 2 + (py - s.cy) ** 2 <= (s.r + 3) ** 2)
}

/**
 * Orden canónico de las celdas: de la trompa hacia atrás (x, luego y).
 * El índice de una celda en este array ES su identidad en la base de datos.
 * Se calcula una sola vez por proceso.
 */
let _cells: { x: number; y: number }[] | null = null

export function cells(): { x: number; y: number }[] {
  if (_cells) return _cells
  const out: { x: number; y: number }[] = []
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      const cx = x * CELL + CELL / 2
      const cy = y * CELL + CELL / 2
      if (insideBody(cx, cy) && !pisaSlot(cx, cy)) out.push({ x, y })
    }
  }
  _cells = out
  return out
}

export const TOTAL_PIXELS = cells().length

/** Coordenadas de la celda número `idx` del orden canónico. */
export function cellAt(idx: number): { x: number; y: number } | null {
  const list = cells()
  return idx >= 0 && idx < list.length ? list[idx] : null
}

/** Valor total del auto si se vendiera completo (para mostrarlo sin inflar). */
export const TOTAL_VALUE = TOTAL_PIXELS * PIXEL_PRICE + SLOTS.reduce((a, s) => a + s.price, 0)
