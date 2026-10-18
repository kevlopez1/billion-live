"use client"

import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Ordenable } from "@/components/branding/ordenable"

// ──────────────────────────────────────────────────────────────
// Las piezas de edición del panel.
//
// Regla de diseño: en modo lectura no se nota que esto es editable. Nada de
// cajas, bordes ni fondos de formulario — el manual tiene que leerse como un
// documento. Los controles aparecen solo cuando se entra a editar.
// ──────────────────────────────────────────────────────────────

/** Texto editable que crece con su contenido. En lectura es texto a secas. */
export function Campo({
  valor,
  onChange,
  editando,
  className = "",
  placeholder = "Escribe aquí",
  multilinea = false,
  as: Etiqueta = "div",
  onKeyDown,
  campoRef,
}: {
  valor: string
  onChange: (v: string) => void
  editando: boolean
  className?: string
  placeholder?: string
  multilinea?: boolean
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p"
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  /** Ref de callback: el campo sigue midiéndose solo y además avisa a quien
   *  lo pidió, para poder mover el foco de una fila a la siguiente. */
  campoRef?: (el: HTMLTextAreaElement | null) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const asignar = (el: HTMLTextAreaElement | null) => {
    ref.current = el
    campoRef?.(el)
  }

  // El textarea se ajusta a su contenido en cada cambio: con alto fijo, un
  // párrafo de cinco líneas se edita por una rendija de dos.
  useEffect(() => {
    const el = ref.current
    if (!el || !editando) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [valor, editando])

  if (!editando) {
    return (
      <Etiqueta className={className}>
        {valor || <span className="text-muted-foreground/40">{placeholder}</span>}
      </Etiqueta>
    )
  }

  if (multilinea) {
    return (
      <textarea
        ref={asignar}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className={`block w-full resize-none rounded-lg border border-gold/35 bg-gold/[0.04] px-2.5 py-1.5 outline-none transition-colors focus:border-gold ${className}`}
      />
    )
  }

  return (
    <input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`block w-full rounded-lg border border-gold/35 bg-gold/[0.04] px-2.5 py-1.5 outline-none transition-colors focus:border-gold ${className}`}
    />
  )
}

/** Fila de una lista: el contenido, y en edición el botón de borrar.
 *  Mover ya no vive aquí: lo hace <Ordenable>, arrastrando. */
export function Fila({
  editando,
  onBorrar,
  children,
}: {
  editando: boolean
  onBorrar: () => void
  children: ReactNode
}) {
  return (
    <div className="group/fila relative flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      {editando && (
        <button
          onClick={onBorrar}
          aria-label="Borrar"
          className="mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-rojo/10 hover:text-rojo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** Botón de agregar. Solo existe en edición. */
export function Agregar({ onClick, texto }: { onClick: () => void; texto: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gold/40 px-3 py-1.5 text-[12.5px] text-gold transition-colors hover:border-gold hover:bg-gold/[0.06]"
    >
      <Plus className="h-3.5 w-3.5" /> {texto}
    </button>
  )
}

/** Lista de textos sueltos (fortalezas, detalles, pendientes…).
 *
 *  Es la lista que usa medio manual, así que lo que entra aquí lo heredan
 *  todas de golpe: arrastrar para mover, Alt+flechas, Enter para crear el
 *  siguiente y Backspace para borrar el vacío. Escribir una lista de diez
 *  cosas tiene que ser diez veces Enter, no diez veces buscar el botón. */
export function ListaTextos({
  items,
  onChange,
  editando,
  placeholder,
  textoAgregar,
  className = "",
  nombre = "elemento",
}: {
  items: string[]
  onChange: (v: string[]) => void
  editando: boolean
  placeholder: string
  textoAgregar: string
  className?: string
  nombre?: string
}) {
  // A qué fila saltar después de un Enter o un borrado. Sin esto hay que
  // volver a hacer clic en cada línea nueva y se pierde el ritmo.
  const [foco, setFoco] = useState<number | null>(null)
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])

  useEffect(() => {
    if (foco === null) return
    const el = refs.current[foco]
    if (el) {
      el.focus()
      const n = el.value.length
      el.setSelectionRange(n, n)
    }
    setFoco(null)
  }, [foco, items])

  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)))
  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i))

  const mover = (desde: number, hasta: number) => {
    const copia = [...items]
    const [x] = copia.splice(desde, 1)
    copia.splice(hasta, 0, x)
    onChange(copia)
  }

  const teclas = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // Enter crea el siguiente. Shift+Enter sigue siendo salto de línea: hay
    // ideas que ocupan dos renglones y no por eso son dos ideas.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const copia = [...items]
      copia.splice(i + 1, 0, "")
      onChange(copia)
      setFoco(i + 1)
      return
    }
    // Backspace en una fila vacía la borra y sube. Solo si queda alguna:
    // dejar la lista sin ninguna fila deja la sección sin dónde escribir.
    if (e.key === "Backspace" && items[i] === "" && items.length > 1) {
      e.preventDefault()
      quitar(i)
      setFoco(Math.max(0, i - 1))
    }
  }

  const fila = (x: string, i: number) => (
    <Fila editando={editando} onBorrar={() => quitar(i)}>
      <div className="flex gap-2">
        {!editando && <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />}
        <Campo
          valor={x}
          onChange={(v) => set(i, v)}
          editando={editando}
          multilinea
          placeholder={placeholder}
          onKeyDown={teclas(i)}
          campoRef={(el) => { refs.current[i] = el }}
          className="text-[13.5px] leading-snug text-muted-foreground"
        />
      </div>
    </Fila>
  )

  if (editando) {
    return (
      <div className={className}>
        <Ordenable items={items} clave={(_, i) => String(i)} mover={mover} nombre={nombre}>
          {fila}
        </Ordenable>
        <Agregar onClick={() => { onChange([...items, ""]); setFoco(items.length) }} texto={textoAgregar} />
      </div>
    )
  }

  return (
    <>
      <ul className={`space-y-1.5 ${className}`}>
        {items.map((x, i) => (
          <li key={i}>{fila(x, i)}</li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-[13px] text-muted-foreground/50">Sin definir.</p>}
    </>
  )
}
