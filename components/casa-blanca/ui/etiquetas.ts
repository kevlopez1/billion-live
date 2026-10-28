// ──────────────────────────────────────────────────────────────
// Etiquetas y burbujas sobre los personajes.
//
// Se mueven en cada cuadro, así que no pasan por React: son divs creados una
// vez y movidos con transform (sin layout). El texto se toca solo si cambió.
// Solo se ven los cercanos y en pantalla, con tope: veinte etiquetas a la vez
// tapan la Casa Blanca.
// ──────────────────────────────────────────────────────────────

import type { Personaje } from "../tipos"

export interface DatoEtiqueta {
  id: string
  x: number
  y: number
  /** Distancia en planta a la cámara (m). */
  dist: number
  actividad: string
  burbuja: { texto: string; tipo: "dice" | "piensa" } | null
}

interface Nodo {
  raiz: HTMLDivElement
  tag: HTMLElement
  act: HTMLSpanElement
  burbuja: HTMLDivElement
  ultAct: string
  ultBurbuja: string
  ultTipo: string
  ultTag: boolean
  /** Tamaño medido; se vuelve a medir solo cuando cambia el contenido. */
  w: number
  h: number
  sucio: boolean
}

const MAX_ETIQUETAS = 7
const MAX_BURBUJAS = 6
/** Más lejos que esto (m, en planta) no se etiqueta: se ve como un punto. */
const LEJOS_ETIQUETA = 320
const LEJOS_BURBUJA = 400

type Rect = { x0: number; x1: number; y0: number; y1: number }
const solapan = (a: Rect, b: Rect) => a.x0 < b.x1 - 2 && b.x0 < a.x1 - 2 && a.y0 < b.y1 - 2 && b.y0 < a.y1 - 2

export function crearEtiquetas(contenedor: HTMLElement, personajes: Personaje[], alTocar: (id: string) => void) {
  const nodos = new Map<string, Nodo>()
  for (const p of personajes) {
    const raiz = document.createElement("div")
    raiz.className = "cb-pj"
    raiz.style.display = "none"

    const burbuja = document.createElement("div")
    burbuja.className = "cb-burbuja"
    burbuja.style.display = "none"
    burbuja.setAttribute("aria-hidden", "true")

    const tag = document.createElement("button")
    tag.type = "button"
    tag.className = "cb-tag"
    tag.style.setProperty("--cb-color", p.color)
    tag.setAttribute("aria-label", `Abrir la ficha de ${p.nombre}`)
    tag.addEventListener("click", (e) => {
      e.stopPropagation()
      alTocar(p.id)
    })
    const nombre = document.createElement("b")
    nombre.textContent = p.corto
    const act = document.createElement("span")
    tag.append(nombre, act)

    raiz.append(burbuja, tag)
    contenedor.append(raiz)
    nodos.set(p.id, { raiz, tag, act, burbuja, ultAct: "", ultBurbuja: "", ultTipo: "", ultTag: true, w: 0, h: 0, sucio: true })
  }

  // El ancho de la capa se guarda al cambiar, no se lee en cada cuadro (forzaría un layout).
  let ancho = contenedor.clientWidth
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => (ancho = contenedor.clientWidth)) : null
  ro?.observe(contenedor)

  function actualizar(datos: DatoEtiqueta[], opciones: { seleccionado: string | null; soloBurbujas: boolean; oculto: boolean }) {
    const mostrados = new Set<string>()
    if (!opciones.oculto) {
      const sel = opciones.seleccionado
      // El elegido primero; después, los más cercanos. Si una etiqueta pisa a otra ya puesta, no sale.
      const orden = [...datos].sort((a, b) => (a.id === sel ? -1 : b.id === sel ? 1 : a.dist - b.dist))
      const ocupados: Rect[] = []
      let nt = 0
      let nb = 0
      for (const d of orden) {
        const n = nodos.get(d.id)
        if (!n) continue
        const esSel = d.id === sel
        const tagOn = esSel || (!opciones.soloBurbujas && nt < MAX_ETIQUETAS && d.dist < LEJOS_ETIQUETA)
        const b = d.burbuja && nb < MAX_BURBUJAS && d.dist < LEJOS_BURBUJA ? d.burbuja : null
        if (!tagOn && !b) continue

        if (tagOn !== n.ultTag) {
          n.tag.style.display = tagOn ? "" : "none"
          n.ultTag = tagOn
          n.sucio = true
        }
        if (tagOn && d.actividad !== n.ultAct) {
          n.act.textContent = d.actividad
          n.ultAct = d.actividad
          n.sucio = true
        }
        if (!b) {
          if (n.ultBurbuja) {
            n.burbuja.style.display = "none"
            n.ultBurbuja = ""
            n.sucio = true
          }
        } else if (b.texto !== n.ultBurbuja || b.tipo !== n.ultTipo) {
          n.burbuja.style.display = ""
          n.burbuja.textContent = b.texto
          n.burbuja.classList.toggle("cb-piensa", b.tipo === "piensa")
          // Al cambiar el texto, la burbuja vuelve a "saltar".
          n.burbuja.classList.remove("cb-pop")
          void n.burbuja.offsetWidth
          n.burbuja.classList.add("cb-pop")
          n.ultBurbuja = b.texto
          n.ultTipo = b.tipo
          n.sucio = true
        }
        if (n.raiz.style.display === "none") n.raiz.style.display = ""
        if (n.sucio) {
          n.w = n.raiz.offsetWidth
          n.h = n.raiz.offsetHeight
          n.sucio = false
        }

        // Dentro de la pantalla aunque el personaje esté en el borde.
        const medio = n.w / 2
        const x = ancho > n.w + 12 ? Math.max(medio + 6, Math.min(ancho - medio - 6, d.x)) : d.x
        const y = d.y - 6
        const r: Rect = { x0: x - medio, x1: x + medio, y0: y - n.h, y1: y }
        if (!esSel && ocupados.some((o) => solapan(o, r))) {
          n.raiz.style.display = "none"
          continue
        }
        ocupados.push(r)
        if (tagOn && !esSel) nt++
        if (b) nb++
        mostrados.add(d.id)
        n.raiz.style.transform = `translate3d(${(x - medio).toFixed(1)}px, ${(y - n.h).toFixed(1)}px, 0)`
        // Más lejos, más tenue: da profundidad sin ocultar.
        n.raiz.style.opacity = String(Math.max(0.6, Math.min(1, 1.3 - d.dist / 300)))
        n.raiz.classList.toggle("cb-sel", esSel)
      }
    }
    for (const [id, n] of nodos) {
      if (!mostrados.has(id) && n.raiz.style.display !== "none") n.raiz.style.display = "none"
    }
  }

  function destruir() {
    ro?.disconnect()
    for (const n of nodos.values()) n.raiz.remove()
    nodos.clear()
  }

  return { actualizar, destruir }
}

/**
 * Etiqueta tipo reel para un puesto del subsuelo: "Mateo · Guiones de venta"
 * con una barra. La barra no inventa porcentajes: llena = entregado,
 * en movimiento = trabajando, vacía = libre.
 */
export function crearEtiquetaPuesto(contenedor: HTMLElement) {
  const el = document.createElement("div")
  el.className = "cb-reel"
  el.style.display = "none"
  el.setAttribute("aria-hidden", "true")
  const t = document.createElement("div")
  t.className = "cb-reel-t"
  const s = document.createElement("div")
  s.className = "cb-reel-s"
  const barra = document.createElement("div")
  barra.className = "cb-reel-b"
  const relleno = document.createElement("i")
  barra.append(relleno)
  el.append(t, s, barra)
  contenedor.append(el)
  return {
    mostrar(x: number, y: number, titulo: string, sub: string, estado: "libre" | "trabajando" | "entregado", color: string) {
      el.style.display = ""
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - 10).toFixed(1)}px, 0) translate(-50%, -100%)`
      el.style.setProperty("--cb-color", color)
      t.textContent = titulo
      s.textContent = sub
      el.dataset.estado = estado
    },
    ocultar() {
      el.style.display = "none"
    },
    destruir() {
      el.remove()
    },
  }
}
