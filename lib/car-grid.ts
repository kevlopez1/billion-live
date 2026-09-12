// ──────────────────────────────────────────────────────────────
// EL AUTO POR PARTES — geometría, precios y orden de llenado.
//
// Fuente ÚNICA de verdad: la importan el componente (para dibujar) y la API
// (para validar). El precio lo recalcula siempre el servidor, así no se puede
// falsificar desde el navegador.
//
// Dos productos sobre el mismo auto:
//  1. LAS PARTES ($60–$500) — piezas con nombre (capó, techo, puerta, cola,
//     faldón, las dos ruedas). Una sola por pieza. El precio sale de cuánto se
//     VE esa parte, igual que el patrocinio de un auto de carrera.
//  2. LA FIRMA ($10) — el resto de la carrocería, en celdas. El comprador NO
//     elige la celda: compra cantidad y se asignan de la trompa hacia atrás.
//     En un celular una celda mide ~2px; elegirla sería imposible, y además
//     así el auto se "materializa" en orden en vez de quedar salpicado.
// ──────────────────────────────────────────────────────────────

export const VIEW_W = 1000
export const VIEW_H = 400
export const CELL = 7
export const COLS = Math.floor(VIEW_W / CELL)
export const ROWS = Math.floor(VIEW_H / CELL)

// Silueta como POLÍGONO (no bezier) a propósito: el mismo listado de puntos
// dibuja el SVG y resuelve el test "¿está dentro?" en el servidor.
//
// Proporciones tomadas del AMG GT 63 de 4 puertas (5,05 m × 1,45 m, batalla
// 2,95 m): alto = 0,287 del largo, batalla = 0,58 del largo, rueda = 0,14.
// De ahí el perfil: nariz baja, capó largo, parabrisas muy tumbado, techo bajo
// adelantado y caída fastback continua hasta una cola corta y alta.
// Los arcos de rueda están RECORTADOS del cuerpo para que las ruedas encajen.
const TOP: [number, number][] = [
  // Nariz: alta y casi vertical — así es la parrilla Panamericana del AMG,
  // no una punta baja de prototipo.
  [62, 302], [59, 278], [68, 258], [96, 245], [142, 238], [200, 233], [268, 229],
  [340, 225], [400, 221],
  // Parabrisas muy tumbado
  [438, 188], [472, 160], [512, 138], [556, 124],
  // Techo bajo y corto
  [600, 120], [646, 124],
  // Caída fastback continua hasta la cola
  [694, 136], [742, 156], [790, 180], [838, 200], [878, 212], [910, 222],
  // Cola corta y alta, con el borde del spoiler
  [932, 232], [941, 250], [940, 278], [932, 300], [918, 316],
]
const ARCO_TRAS: [number, number][] = [
  [826, 318], [821, 292], [808, 268], [788, 252], [758, 246], [728, 252], [708, 268],
  [695, 292], [690, 318],
]
const ARCO_DEL: [number, number][] = [
  [316, 318], [311, 292], [298, 268], [278, 252], [248, 246], [218, 252], [198, 268],
  [185, 292], [180, 318],
]

export const BODY: [number, number][] = [
  ...TOP, ...ARCO_TRAS, [500, 322], ...ARCO_DEL, [72, 318],
]

export const SUELO = 360

export const BODY_PATH = `M ${BODY.map(([x, y]) => `${x},${y}`).join(" L ")} Z`

// El vidrio no se vende: se dibuja encima para que se lea "auto" y no "mancha".
export const VIDRIO_PATH =
  "M 410,216 L 448,180 L 492,150 L 548,131 L 600,126 L 648,131 L 690,146 L 628,150 L 548,168 L 470,196 Z"

// ── LAS PARTES ──────────────────────────────────────────────────
// Las zonas se dibujan RECORTADAS contra la silueta (clipPath), así una
// región rectangular simple sigue exactamente la forma del auto: no hay que
// calzar curvas a mano y nunca se sale del cuerpo.
export type Forma =
  | { tipo: "circulo"; cx: number; cy: number; r: number }
  | { tipo: "zona"; x: number; y: number; w: number; h: number }

export type Slot = {
  id: string
  /** El número que se ve sobre el auto y en la tarjeta de abajo. */
  n: number
  label: string
  price: number
  nota: string
  /** Dónde va el número sobre el auto. */
  mx: number
  my: number
  forma: Forma
}

// El precio sale de cuánto se VE la parte, igual que el patrocinio real de un
// auto de carrera: el capó y las ruedas salen en cada foto; el faldón casi no.
export const SLOTS: Slot[] = [
  {
    id: "capo",
    n: 1,
    label: "El capó",
    price: 500,
    nota: "La parte más fotografiada del auto",
    mx: 352,
    my: 268,
    forma: { tipo: "zona", x: 78, y: 232, w: 312, h: 66 },
  },
  {
    id: "rueda-del",
    n: 2,
    label: "Rueda delantera",
    price: 500,
    nota: "Gira en cada video que grabo",
    mx: 248,
    my: 298,
    forma: { tipo: "circulo", cx: 248, cy: 298, r: 62 },
  },
  {
    id: "rueda-tras",
    n: 3,
    label: "Rueda trasera",
    price: 500,
    nota: "Gira en cada video que grabo",
    mx: 758,
    my: 298,
    forma: { tipo: "circulo", cx: 758, cy: 298, r: 62 },
  },
  {
    id: "puerta",
    n: 4,
    label: "La puerta",
    price: 250,
    nota: "El lugar clásico del patrocinio",
    mx: 560,
    my: 262,
    forma: { tipo: "zona", x: 440, y: 222, w: 240, h: 78 },
  },
  {
    id: "techo",
    n: 5,
    label: "El techo",
    price: 200,
    nota: "Se ve entero en las tomas con drone",
    mx: 600,
    my: 136,
    forma: { tipo: "zona", x: 540, y: 120, w: 130, h: 32 },
  },
  {
    id: "cola",
    n: 6,
    label: "La cola",
    price: 150,
    nota: "Lo último que ve el que te quiere pasar",
    mx: 890,
    my: 250,
    forma: { tipo: "zona", x: 846, y: 202, w: 98, h: 90 },
  },
  {
    id: "faldon",
    n: 7,
    label: "El faldón",
    price: 60,
    nota: "De rueda a rueda, todo el costado",
    mx: 500,
    my: 311,
    forma: { tipo: "zona", x: 322, y: 300, w: 364, h: 22 },
  },
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

/** Las partes con nombre no entran al pozo de firmas de $10. */
function pisaSlot(px: number, py: number): boolean {
  return SLOTS.some((s) => {
    const f = s.forma
    if (f.tipo === "circulo") return (px - f.cx) ** 2 + (py - f.cy) ** 2 <= (f.r + 3) ** 2
    return px >= f.x - 2 && px <= f.x + f.w + 2 && py >= f.y - 2 && py <= f.y + f.h + 2
  })
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
