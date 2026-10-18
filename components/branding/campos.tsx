"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { GripVertical, Plus, Trash2 } from "lucide-react"

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
}: {
  valor: string
  onChange: (v: string) => void
  editando: boolean
  className?: string
  placeholder?: string
  multilinea?: boolean
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p"
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

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
        ref={ref}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
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
      placeholder={placeholder}
      className={`block w-full rounded-lg border border-gold/35 bg-gold/[0.04] px-2.5 py-1.5 outline-none transition-colors focus:border-gold ${className}`}
    />
  )
}

/** Fila de una lista: el contenido, y en edición el botón de borrar. */
export function Fila({
  editando,
  onBorrar,
  children,
  mover,
}: {
  editando: boolean
  onBorrar: () => void
  children: ReactNode
  mover?: { arriba: () => void; abajo: () => void; puedeSubir: boolean; puedeBajar: boolean }
}) {
  return (
    <div className="group/fila relative flex items-start gap-2">
      {editando && mover && (
        <div className="flex shrink-0 flex-col pt-1.5 text-muted-foreground/50">
          <button
            onClick={mover.arriba}
            disabled={!mover.puedeSubir}
            aria-label="Subir"
            className="leading-none hover:text-foreground disabled:opacity-25"
          >
            <GripVertical className="h-3.5 w-3.5 rotate-90" />
          </button>
        </div>
      )}
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

/** Lista de textos sueltos (fortalezas, detalles, pendientes…). */
export function ListaTextos({
  items,
  onChange,
  editando,
  placeholder,
  textoAgregar,
  className = "",
}: {
  items: string[]
  onChange: (v: string[]) => void
  editando: boolean
  placeholder: string
  textoAgregar: string
  className?: string
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)))
  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i))

  return (
    <>
      <ul className={`space-y-1.5 ${className}`}>
        {items.map((x, i) => (
          <li key={i}>
            <Fila editando={editando} onBorrar={() => quitar(i)}>
              <div className="flex gap-2">
                {!editando && <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />}
                <Campo
                  valor={x}
                  onChange={(v) => set(i, v)}
                  editando={editando}
                  multilinea
                  placeholder={placeholder}
                  className="text-[13.5px] leading-snug text-muted-foreground"
                />
              </div>
            </Fila>
          </li>
        ))}
      </ul>
      {editando && <Agregar onClick={() => onChange([...items, ""])} texto={textoAgregar} />}
      {!editando && items.length === 0 && (
        <p className="text-[13px] text-muted-foreground/50">Sin definir.</p>
      )}
    </>
  )
}
