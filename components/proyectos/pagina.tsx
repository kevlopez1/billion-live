"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import {
  ESTADOS, ETIQUETA_ESTADO, RAIZ, avance, bloqueVacio, camino, color, hijosDe, subarbol, tonoDe,
  type Bloque, type Doc, type Nodo, type TipoBloque,
} from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// LA PÁGINA DE UN NODO (el "Notion")
//
// Bloques: párrafo, título, lista y tarea. Se escribe como en Notion:
//   "# " al inicio → título · "- " → lista · "[] " → tarea · Enter → bloque nuevo
//   Retroceso en un bloque vacío → lo borra (o lo vuelve párrafo).
//
// Un bloque se VE renderizado (con el logo de PRIME donde corresponde) y se
// vuelve editable al tocarlo: un <textarea> no puede mostrar una imagen.
// ──────────────────────────────────────────────────────────────

const ESTILO: Record<TipoBloque, string> = {
  p: "text-[15px] leading-relaxed",
  h: "font-display text-xl font-semibold tracking-tight pt-3",
  li: "text-[15px] leading-relaxed",
  todo: "text-[15px] leading-relaxed",
}

function Editable({
  valor, onCambia, onEnter, onRetroceso, onFlecha, className, placeholder, foco, onFoco,
}: {
  valor: string
  onCambia: (x: string) => void
  onEnter?: () => void
  onRetroceso?: () => void
  onFlecha?: (dir: -1 | 1) => void
  className: string
  placeholder: string
  foco: boolean
  onFoco: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!foco) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [foco])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "0"
    el.style.height = `${el.scrollHeight}px`
  }, [valor, foco])

  if (!foco) {
    return (
      <div
        role="textbox"
        tabIndex={0}
        onClick={onFoco}
        onFocus={onFoco}
        className={`${className} min-h-[1.6em] cursor-text whitespace-pre-wrap break-words ${valor ? "" : "text-muted-foreground/50"}`}
      >
        {valor ? conPrime(valor, false) : placeholder}
      </div>
    )
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onCambia(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          onEnter?.()
        } else if (e.key === "Backspace" && valor === "") {
          e.preventDefault()
          onRetroceso?.()
        } else if (e.key === "ArrowUp" && e.currentTarget.selectionStart === 0) {
          e.preventDefault()
          onFlecha?.(-1)
        } else if (e.key === "ArrowDown" && e.currentTarget.selectionStart === valor.length) {
          e.preventDefault()
          onFlecha?.(1)
        }
      }}
      className={`${className} block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/40`}
    />
  )
}

export function Pagina({
  doc, nodo, cambiar, onSeleccionar, onAgregar, onCerrar,
}: {
  doc: Doc
  nodo: Nodo
  cambiar: (f: (d: Doc) => Doc) => void
  onSeleccionar: (id: string) => void
  onAgregar: (padre: string) => void
  onCerrar?: () => void
}) {
  const [foco, setFoco] = useState<string | null>(null)
  const [editaTitulo, setEditaTitulo] = useState(false)
  const raiz = nodo.id === RAIZ
  const tono = tonoDe(doc, nodo.id)
  const ruta = camino(doc, nodo.id)
  const hijos = hijosDe(doc, nodo.id)
  const { hechas, total } = avance(doc, nodo.id)
  const invalidos = subarbol(doc, nodo.id)

  // Al cambiar de nodo no debe quedar un bloque "enfocado" del anterior.
  useEffect(() => { setFoco(null); setEditaTitulo(false) }, [nodo.id])

  const parche = (p: Partial<Nodo>) =>
    cambiar((d) => ({ ...d, nodos: d.nodos.map((n) => (n.id === nodo.id ? { ...n, ...p } : n)) }))

  const bloques = (f: (b: Bloque[]) => Bloque[]) =>
    cambiar((d) => ({ ...d, nodos: d.nodos.map((n) => (n.id === nodo.id ? { ...n, bloques: f(n.bloques) } : n)) }))

  const escribir = (id: string, x: string) =>
    bloques((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b
        // Atajos de estilo, como en Notion.
        if (b.t === "p" && x.startsWith("# ")) return { ...b, t: "h", x: x.slice(2) }
        if (b.t === "p" && x.startsWith("- ")) return { ...b, t: "li", x: x.slice(2) }
        if (b.t === "p" && (x.startsWith("[] ") || x.startsWith("[ ] "))) return { id: b.id, t: "todo", x: x.replace(/^\[ ?\] /, ""), ok: false }
        return { ...b, x }
      }),
    )

  const despuesDe = (id: string) => {
    const actual = nodo.bloques.find((b) => b.id === id)
    if (!actual) return
    // Enter en una lista o tarea VACÍA la cierra y vuelve a párrafo.
    if ((actual.t === "li" || actual.t === "todo") && actual.x === "") {
      bloques((bs) => bs.map((b) => (b.id === id ? { id: b.id, t: "p", x: "" } : b)))
      return
    }
    const sigue: TipoBloque = actual.t === "li" || actual.t === "todo" ? actual.t : "p"
    const nuevo = bloqueVacio(sigue)
    bloques((bs) => {
      const i = bs.findIndex((b) => b.id === id)
      return [...bs.slice(0, i + 1), nuevo, ...bs.slice(i + 1)]
    })
    setFoco(nuevo.id)
  }

  const retroceso = (id: string) => {
    const i = nodo.bloques.findIndex((b) => b.id === id)
    const actual = nodo.bloques[i]
    if (!actual) return
    if (actual.t !== "p") {
      bloques((bs) => bs.map((b) => (b.id === id ? { id: b.id, t: "p", x: "" } : b)))
      return
    }
    if (nodo.bloques.length === 1) return
    const previo = nodo.bloques[i - 1] ?? nodo.bloques[i + 1]
    bloques((bs) => bs.filter((b) => b.id !== id))
    setFoco(previo?.id ?? null)
  }

  const moverFoco = (id: string, dir: -1 | 1) => {
    const i = nodo.bloques.findIndex((b) => b.id === id)
    const otro = nodo.bloques[i + dir]
    if (otro) setFoco(otro.id)
  }

  const mover = (nuevoPadre: string) =>
    cambiar((d) => ({ ...d, nodos: d.nodos.map((n) => (n.id === nodo.id ? { ...n, padre: nuevoPadre } : n)) }))

  const borrar = () => {
    const sub = subarbol(doc, nodo.id)
    const msg = sub.size > 1 ? `¿Borrar "${nodo.titulo}" y sus ${sub.size - 1} sub-páginas?` : `¿Borrar "${nodo.titulo}"?`
    if (!window.confirm(msg)) return
    const padre = nodo.padre ?? RAIZ
    cambiar((d) => ({ ...d, nodos: d.nodos.filter((n) => !sub.has(n.id)) }))
    onSeleccionar(padre)
  }

  return (
    <article className="mx-auto w-full max-w-2xl px-5 pb-24 pt-6 sm:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <nav aria-label="Ruta" className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {ruta.map((r, i) => (
            <span key={r.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
              <button type="button" onClick={() => onSeleccionar(r.id)} className={`max-w-[10rem] truncate transition-colors hover:text-foreground ${i === ruta.length - 1 ? "text-foreground" : ""}`}>
                {conPrime(r.titulo, false)}
              </button>
            </span>
          ))}
        </nav>
        {onCerrar && (
          <button type="button" onClick={onCerrar} className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Cerrar
          </button>
        )}
      </div>

      <div className="flex items-start gap-3">
        <input
          value={nodo.icono}
          onChange={(e) => parche({ icono: [...e.target.value].slice(-2).join("") || "•" })}
          aria-label="Icono"
          className="h-12 w-12 shrink-0 rounded-2xl border bg-card/70 text-center text-2xl outline-none focus:border-foreground/30"
          style={{ background: color(tono, 0.62, 0.13, 0.1) }}
        />
        <div className="min-w-0 flex-1">
          {editaTitulo ? (
            <input
              autoFocus
              value={nodo.titulo}
              onChange={(e) => parche({ titulo: e.target.value })}
              onBlur={() => setEditaTitulo(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditaTitulo(false) }}
              className="font-display w-full bg-transparent text-3xl font-semibold tracking-tight outline-none"
            />
          ) : (
            <h1
              tabIndex={0}
              onClick={() => setEditaTitulo(true)}
              onFocus={() => setEditaTitulo(true)}
              className="font-display cursor-text text-3xl font-semibold leading-tight tracking-tight"
            >
              {nodo.titulo ? conPrime(nodo.titulo, false) : <span className="text-muted-foreground/50">Sin título</span>}
            </h1>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Estado</span>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => parche({ estado: e })}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${nodo.estado === e ? "border-transparent text-white" : "text-muted-foreground hover:text-foreground"}`}
              style={nodo.estado === e ? { background: color(tono, 0.55, 0.13) } : undefined}
            >
              {ETIQUETA_ESTADO[e]}
            </button>
          ))}
        </div>
        {!raiz && (
          <>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Número</span>
            <input
              value={nodo.meta}
              onChange={(e) => parche({ meta: e.target.value })}
              placeholder="$450.000 · 1 venta · ?"
              className="w-full rounded-lg bg-transparent px-2 py-1 text-[15px] font-semibold tabular-nums outline-none ring-1 ring-transparent transition focus:ring-border"
            />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Plazo</span>
            <input
              value={nodo.plazo}
              onChange={(e) => parche({ plazo: e.target.value })}
              placeholder="Fecha o ventana"
              className="w-full rounded-lg bg-transparent px-2 py-1 text-[15px] outline-none ring-1 ring-transparent transition focus:ring-border"
            />
            {/* Un <option> no admite imágenes: es una de las excepciones al logo de PRIME. */}
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Dentro de</span>
            <select
              value={nodo.padre ?? RAIZ}
              onChange={(e) => mover(e.target.value)}
              className="w-full rounded-lg bg-transparent px-1 py-1 text-[15px] outline-none ring-1 ring-transparent transition focus:ring-border"
            >
              {doc.nodos.filter((n) => !invalidos.has(n.id)).map((n) => (
                <option key={n.id} value={n.id} className="bg-background">{n.icono} {n.titulo}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {total > 0 && (
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Tareas de esta rama</span>
            <span className="tabular-nums">{hechas} de {total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(hechas / total) * 100}%`, background: color(tono, 0.6, 0.13) }} />
          </div>
        </div>
      )}

      <hr className="my-6 border-border" />

      <div className="space-y-0.5">
        {nodo.bloques.map((b) => (
          <div key={b.id} className="flex items-start gap-2.5">
            {b.t === "todo" && (
              <input
                type="checkbox"
                checked={!!b.ok}
                onChange={(e) => bloques((bs) => bs.map((x) => (x.id === b.id ? { ...x, ok: e.target.checked } : x)))}
                aria-label="Hecha"
                className="mt-[0.42rem] h-4 w-4 shrink-0 cursor-pointer accent-[#31abc4]"
              />
            )}
            {b.t === "li" && <span className="mt-[0.62rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" aria-hidden />}
            <div className={`min-w-0 flex-1 ${b.t === "todo" && b.ok ? "text-muted-foreground line-through" : ""}`}>
              <Editable
                valor={b.x}
                onCambia={(x) => escribir(b.id, x)}
                onEnter={() => despuesDe(b.id)}
                onRetroceso={() => retroceso(b.id)}
                onFlecha={(dir) => moverFoco(b.id, dir)}
                className={ESTILO[b.t]}
                placeholder={b.t === "h" ? "Título" : "Escribe aquí  ·  # título  ·  - lista  ·  [] tarea"}
                foco={foco === b.id}
                onFoco={() => setFoco(b.id)}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          const nuevo = bloqueVacio()
          bloques((bs) => [...bs, nuevo])
          setFoco(nuevo.id)
        }}
        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar bloque
      </button>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sub-páginas · {hijos.length}</h2>
          <button type="button" onClick={() => onAgregar(nodo.id)} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <Plus className="h-3 w-3" /> Nueva
          </button>
        </div>
        {hijos.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">Todavía no hay ramas aquí.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {hijos.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onSeleccionar(h.id)}
                className="flex items-center gap-3 rounded-2xl border bg-card/60 p-3 text-left transition-all hover:-translate-y-px hover:bg-card"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: color(tono, 0.62, 0.13, 0.12) }}>{h.icono}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{conPrime(h.titulo, false)}</span>
                  {h.meta && <span className="block truncate text-xs tabular-nums text-muted-foreground">{h.meta}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!raiz && (
        <button type="button" onClick={borrar} className="mt-12 flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Borrar esta página
        </button>
      )}
    </article>
  )
}
