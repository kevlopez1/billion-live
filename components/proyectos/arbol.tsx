"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { RAIZ, hijosDe, type Doc, type Nodo } from "@/lib/proyectos"

// El índice lateral, como la barra de Notion: el árbol entero, plegable.
export function Arbol({
  doc,
  seleccionado,
  onSeleccionar,
  onAgregar,
  cerradosIniciales,
  onMover,
}: {
  doc: Doc
  seleccionado: string
  onSeleccionar: (id: string) => void
  /** Opcional, por lo mismo que en el mapa. */
  onAgregar?: (padre: string) => void
  /** Ramas recogidas al abrir. El manual tiene ~70 hojas: desplegadas todas,
   *  el índice mide tres pantallas y deja de servir como índice. */
  cerradosIniciales?: string[]
  /** Subir (-1) o bajar (1) una rama de primer nivel. Solo el manual lo usa. */
  onMover?: (id: string, paso: -1 | 1) => void
}) {
  // Abierto por defecto: la raíz y sus ramas. Lo que el usuario cierra, queda cerrado.
  const [cerrados, setCerrados] = useState<Set<string>>(() => new Set(cerradosIniciales ?? []))
  const alternar = (id: string) =>
    setCerrados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const fila = (n: Nodo, prof: number) => {
    const hs = hijosDe(doc, n.id)
    const abierto = !cerrados.has(n.id)
    const sel = n.id === seleccionado
    return (
      <li key={n.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg py-1 pr-1 transition-colors ${sel ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.04]"}`}
          style={{ paddingLeft: 4 + prof * 14 }}
        >
          <button
            type="button"
            onClick={() => alternar(n.id)}
            aria-label={abierto ? "Recoger" : "Desplegar"}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform hover:text-foreground ${hs.length ? "" : "invisible"} ${abierto ? "rotate-90" : ""}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onSeleccionar(n.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {/* El manual de /branding no lleva iconos (a Kev le quitaban las
                ganas de escribir); los proyectos sí, porque ahí los elige él. */}
            {n.icono && <span className="text-[15px] leading-none" aria-hidden>{n.icono}</span>}
            <span className={`truncate text-[13.5px] ${sel ? "font-semibold" : "font-medium text-foreground/85"}`}>
              {conPrime(n.titulo || "Sin título", false)}
            </span>
          </button>
          {onMover && n.padre === RAIZ && (
            <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-60">
              <button type="button" onClick={() => onMover(n.id, -1)} aria-label={`Subir ${n.titulo}`} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onMover(n.id, 1)} aria-label={`Bajar ${n.titulo}`} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {onAgregar && <button
            type="button"
            onClick={() => onAgregar(n.id)}
            aria-label={`Agregar dentro de ${n.titulo}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100 max-lg:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>}
        </div>
        {hs.length > 0 && abierto && <ul>{hs.map((h) => fila(h, prof + 1))}</ul>}
      </li>
    )
  }

  const raiz = doc.nodos.find((n) => n.id === RAIZ)
  if (!raiz) return null
  return (
    <nav aria-label="Índice de proyectos">
      <ul>{fila(raiz, 0)}</ul>
    </nav>
  )
}
