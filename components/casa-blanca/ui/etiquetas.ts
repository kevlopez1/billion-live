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
}

const MAX_ETIQUETAS = 7
const MAX_BURBUJAS = 6

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
    nodos.set(p.id, { raiz, tag, act, burbuja, ultAct: "", ultBurbuja: "", ultTipo: "" })
  }

  function actualizar(datos: DatoEtiqueta[], opciones: { seleccionado: string | null; soloBurbujas: boolean; oculto: boolean }) {
    const visibles = new Set<string>()
    const conTag = new Set<string>()
    const conBurbuja = new Set<string>()
    if (!opciones.oculto) {
      const orden = [...datos].sort((a, b) => a.dist - b.dist)
      let nt = 0
      let nb = 0
      for (const d of orden) {
        const sel = d.id === opciones.seleccionado
        if (d.burbuja && nb < MAX_BURBUJAS && d.dist < 240) {
          conBurbuja.add(d.id)
          nb++
        }
        if (sel || (!opciones.soloBurbujas && nt < MAX_ETIQUETAS && d.dist < 150)) {
          conTag.add(d.id)
          if (!sel) nt++
        }
        if (conTag.has(d.id) || conBurbuja.has(d.id)) visibles.add(d.id)
      }
    }
    const porId = new Map(datos.map((d) => [d.id, d]))
    for (const [id, n] of nodos) {
      const d = porId.get(id)
      if (!d || !visibles.has(id)) {
        if (n.raiz.style.display !== "none") n.raiz.style.display = "none"
        continue
      }
      n.raiz.style.display = ""
      n.raiz.style.transform = `translate3d(${d.x.toFixed(1)}px, ${(d.y - 6).toFixed(1)}px, 0) translate(-50%, -100%)`
      // Más lejos, más tenue: da profundidad sin ocultar.
      n.raiz.style.opacity = String(Math.max(0.55, Math.min(1, 1.25 - d.dist / 200)))
      n.raiz.classList.toggle("cb-sel", id === opciones.seleccionado)

      const tagOn = conTag.has(id)
      n.tag.style.display = tagOn ? "" : "none"
      if (tagOn && d.actividad !== n.ultAct) {
        n.act.textContent = d.actividad
        n.ultAct = d.actividad
      }
      const b = conBurbuja.has(id) ? d.burbuja : null
      if (!b) {
        if (n.burbuja.style.display !== "none") n.burbuja.style.display = "none"
        n.ultBurbuja = ""
      } else {
        n.burbuja.style.display = ""
        if (b.texto !== n.ultBurbuja || b.tipo !== n.ultTipo) {
          n.burbuja.textContent = b.texto
          n.burbuja.classList.toggle("cb-piensa", b.tipo === "piensa")
          // Al cambiar el texto, la burbuja vuelve a "saltar".
          n.burbuja.classList.remove("cb-pop")
          void n.burbuja.offsetWidth
          n.burbuja.classList.add("cb-pop")
          n.ultBurbuja = b.texto
          n.ultTipo = b.tipo
        }
      }
    }
  }

  function destruir() {
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
