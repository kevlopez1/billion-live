// ──────────────────────────────────────────────────────────────
// /kevlopez_proyectos — el modelo de datos.
//
// Un solo árbol de nodos. Cada nodo es a la vez una rama del mapa mental y una
// página de notas: así el mapa y las notas nunca se desincronizan. Esta
// estructura es la misma que viaja a la base (una fila jsonb), igual que el
// manual de /branding.
//
// La semilla (el contenido inicial) NO vive aquí: este archivo llega al
// navegador, y la semilla son metas personales que no son públicas. Está en
// lib/proyectos-semilla.ts y solo la importa el servidor.
// ──────────────────────────────────────────────────────────────

export const ESTADOS = ["idea", "marcha", "listo", "pausa"] as const
export type Estado = (typeof ESTADOS)[number]

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  idea: "Idea",
  marcha: "En marcha",
  listo: "Listo",
  pausa: "En pausa",
}

export type TipoBloque = "p" | "h" | "li" | "todo"

export type Bloque = {
  id: string
  t: TipoBloque
  x: string
  /** Solo para `todo`. */
  ok?: boolean
}

export type Nodo = {
  id: string
  /** `null` solo en la raíz. */
  padre: string | null
  titulo: string
  icono: string
  estado: Estado
  /** El número exacto: "$450.000", "1 venta". Vacío si todavía no se sabe. */
  meta: string
  /** Fecha o ventana: "3–6 nov 2026". */
  plazo: string
  bloques: Bloque[]
  /** Rama recogida en el mapa. */
  plegado?: boolean
}

export type Doc = { v: 1; nodos: Nodo[] }

export const RAIZ = "raiz"
export const MAX_NODOS = 400
export const MAX_BYTES = 900_000

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

export function bloqueVacio(t: TipoBloque = "p"): Bloque {
  return t === "todo" ? { id: nuevoId(), t, x: "", ok: false } : { id: nuevoId(), t, x: "" }
}

export function nodoNuevo(padre: string, titulo = "Sin título"): Nodo {
  return {
    id: nuevoId(),
    padre,
    titulo,
    icono: "•",
    estado: "idea",
    meta: "",
    plazo: "",
    bloques: [bloqueVacio()],
  }
}

export function hijosDe(doc: Doc, id: string): Nodo[] {
  return doc.nodos.filter((n) => n.padre === id)
}

/** El id del nodo y todos sus descendientes. */
export function subarbol(doc: Doc, id: string): Set<string> {
  const fuera = new Set<string>([id])
  let creció = true
  while (creció) {
    creció = false
    for (const n of doc.nodos) {
      if (n.padre && fuera.has(n.padre) && !fuera.has(n.id)) {
        fuera.add(n.id)
        creció = true
      }
    }
  }
  return fuera
}

/** De la raíz hasta el nodo (incluido). */
export function camino(doc: Doc, id: string): Nodo[] {
  const por = new Map(doc.nodos.map((n) => [n.id, n]))
  const ruta: Nodo[] = []
  let actual = por.get(id)
  while (actual && ruta.length < 64) {
    ruta.unshift(actual)
    actual = actual.padre ? por.get(actual.padre) : undefined
  }
  return ruta
}

/** Cuántas tareas hay hechas y cuántas en total, contando toda la rama. */
export function avance(doc: Doc, id: string): { hechas: number; total: number } {
  const ids = subarbol(doc, id)
  let hechas = 0
  let total = 0
  for (const n of doc.nodos) {
    if (!ids.has(n.id)) continue
    for (const b of n.bloques) {
      if (b.t !== "todo") continue
      total++
      if (b.ok) hechas++
    }
  }
  return { hechas, total }
}

// El tono de cada rama principal. oklch con la misma luminosidad: se lee bien
// tanto en el tema claro como en el OLED.
const TONOS = [235, 28, 150, 75, 300, 195, 345, 110]

export function tonoDe(doc: Doc, id: string): number {
  const ruta = camino(doc, id)
  const rama = ruta[1]
  if (!rama) return 250
  const hermanas = hijosDe(doc, RAIZ)
  const i = Math.max(0, hermanas.findIndex((n) => n.id === rama.id))
  return TONOS[i % TONOS.length]
}

export function color(h: number, l = 0.6, c = 0.13, a = 1): string {
  return `oklch(${l} ${c} ${h} / ${a})`
}

/** Valida la forma del documento ANTES de tocar la base. */
export function valido(d: unknown): d is Doc {
  if (!d || typeof d !== "object") return false
  const x = d as Record<string, unknown>
  if (x.v !== 1 || !Array.isArray(x.nodos)) return false
  if (x.nodos.length < 1 || x.nodos.length > MAX_NODOS) return false
  const ids = new Set<string>()
  let raices = 0
  for (const n of x.nodos as unknown[]) {
    if (!n || typeof n !== "object") return false
    const o = n as Record<string, unknown>
    if (typeof o.id !== "string" || !o.id || ids.has(o.id)) return false
    ids.add(o.id)
    if (typeof o.titulo !== "string" || typeof o.icono !== "string") return false
    if (typeof o.meta !== "string" || typeof o.plazo !== "string") return false
    if (!(ESTADOS as readonly string[]).includes(o.estado as string)) return false
    if (o.padre === null) raices++
    else if (typeof o.padre !== "string") return false
    if (!Array.isArray(o.bloques)) return false
    for (const b of o.bloques as unknown[]) {
      if (!b || typeof b !== "object") return false
      const bb = b as Record<string, unknown>
      if (typeof bb.id !== "string" || typeof bb.x !== "string") return false
      if (!["p", "h", "li", "todo"].includes(bb.t as string)) return false
    }
  }
  if (raices !== 1) return false
  // Todo padre tiene que existir: un huérfano desaparecería del mapa.
  for (const n of x.nodos as { padre: string | null }[]) {
    if (n.padre !== null && !ids.has(n.padre)) return false
  }
  return true
}
