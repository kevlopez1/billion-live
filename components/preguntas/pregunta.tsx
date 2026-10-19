"use client"

import { type KeyboardEvent } from "react"
import { Check, Plus, Trash2 } from "lucide-react"
import { Campo } from "@/components/branding/campos"
import { Ordenable } from "@/components/branding/ordenable"
import { llenas, tramoDe, type Pregunta, type Respuesta } from "@/lib/preguntas"

// ──────────────────────────────────────────────────────────────
// UNA PREGUNTA ABIERTA, CON SUS RESPUESTAS
//
// La misma pieza en los dos sitios: la sección "Las preguntas" de /branding
// (las del reto) y la página /preguntas (las que llevan nombres de personas y
// por eso piden clave). Si el ejercicio se comportara distinto en cada lado,
// dejaría de ser el mismo ejercicio.
// ──────────────────────────────────────────────────────────────

export function VistaPregunta({
  pregunta: p,
  onChange,
  onBorrar,
  editando = true,
  foco,
  setFoco,
  tituloClase = "font-display text-[22px] font-semibold leading-tight tracking-tight md:text-[26px]",
}: {
  pregunta: Pregunta
  onChange: (p: Pregunta) => void
  onBorrar?: () => void
  /** En /branding la página tiene modo lectura; en /preguntas siempre se edita. */
  editando?: boolean
  foco?: number | null
  setFoco?: (i: number | null) => void
  tituloClase?: string
}) {
  const van = llenas(p)
  const faltan = Math.max(0, p.meta - van)
  const hechas = p.respuestas.filter((r) => r.hecha && r.texto.trim()).length

  const setRespuestas = (rs: Respuesta[]) => onChange({ ...p, respuestas: rs })
  const enfocar = (i: number | null) => setFoco?.(i)

  const teclas = (i: number) => (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // Enter crea la siguiente. Shift+Enter sigue siendo salto de línea: hay
    // respuestas de dos renglones que no son dos respuestas.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const rs = [...p.respuestas]
      rs.splice(i + 1, 0, { texto: "" })
      setRespuestas(rs)
      enfocar(i + 1)
      return
    }
    if (e.key === "Backspace" && p.respuestas[i].texto === "" && p.respuestas.length > 1) {
      e.preventDefault()
      setRespuestas(p.respuestas.filter((_, j) => j !== i))
      enfocar(Math.max(0, i - 1))
    }
  }

  const fila = (r: Respuesta, i: number) => {
    const tramo = tramoDe(i)
    return (
      <div>
        {tramo.desde === i && (
          <div className="mb-2 mt-5 flex items-baseline gap-2 first:mt-0">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold">{tramo.nombre}</span>
            <span className="text-[11px] text-muted-foreground/70">{tramo.nota}</span>
          </div>
        )}
        <div className="group flex items-start gap-2 rounded-lg py-0.5">
          <span className="mt-[7px] w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/50">
            {i + 1}
          </span>
          <button
            onClick={() => setRespuestas(p.respuestas.map((x, j) => (j === i ? { ...x, hecha: !x.hecha } : x)))}
            aria-pressed={!!r.hecha}
            aria-label={r.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
            className={`mt-[5px] grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
              r.hecha
                ? "border-[color:var(--kev-success,#4a9)] bg-[color:var(--kev-success,#4a9)]/15 text-[color:var(--kev-success,#4a9)]"
                : "border-border text-transparent hover:border-foreground/40"
            }`}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </button>
          <Campo
            valor={r.texto}
            onChange={(v) => setRespuestas(p.respuestas.map((x, j) => (j === i ? { ...x, texto: v } : x)))}
            editando={editando}
            multilinea
            placeholder="Escribe una respuesta y pulsa Enter"
            onKeyDown={teclas(i)}
            campoRef={(el) => { if (foco === i && el) { el.focus(); enfocar(null) } }}
            className={`text-[15px] leading-relaxed ${r.hecha ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}
          />
          {editando && (
            <button
              onClick={() => {
                const rs = p.respuestas.filter((_, j) => j !== i)
                setRespuestas(rs.length ? rs : [{ texto: "" }])
              }}
              aria-label={`Borrar la respuesta ${i + 1}`}
              className="mt-[3px] shrink-0 rounded-md p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50 hover:!text-rojo focus-visible:text-muted-foreground/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section>
      <Campo
        valor={p.pregunta}
        onChange={(v) => onChange({ ...p, pregunta: v })}
        editando={editando}
        multilinea
        placeholder="¿Cómo…?"
        className={tituloClase}
        campoRef={(el) => { if (foco === -1 && el) { el.focus(); enfocar(null) } }}
      />

      {/* ── El contador ── Es el ejercicio entero: sin número no hay presión. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-display text-[15px] font-bold tabular-nums">
          {van} <span className="text-muted-foreground">/ {p.meta}</span>
        </span>
        <span className="text-[12.5px] text-muted-foreground">
          {faltan > 0 ? `Te faltan ${faltan}. No pares aquí.` : "Llegaste a la meta."}
        </span>
        <span className="text-[12.5px] text-muted-foreground">·</span>
        <span className="text-[12.5px] tabular-nums text-muted-foreground">{hechas} hechas</span>
        {editando && (
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
            Plazo
            <input
              value={p.plazo}
              onChange={(e) => onChange({ ...p, plazo: e.target.value })}
              placeholder="hoy"
              aria-label="Plazo"
              className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-foreground outline-none transition-colors hover:bg-foreground/[0.04] focus:border-gold/45"
            />
          </label>
        )}
        {!editando && p.plazo && (
          <span className="ml-auto text-[12px] text-muted-foreground">Plazo: {p.plazo}</span>
        )}
        {editando && onBorrar && (
          <button
            onClick={onBorrar}
            aria-label="Borrar esta pregunta"
            className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-rojo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
        <div
          className="h-full rounded-full bg-gold/70 transition-[width] duration-300"
          style={{ width: `${Math.min(100, (van / p.meta) * 100)}%` }}
        />
      </div>

      <div className="mt-6">
        {editando ? (
          <Ordenable
            items={p.respuestas}
            clave={(_, i) => String(i)}
            mover={(desde, hasta) => {
              const copia = [...p.respuestas]
              const [x] = copia.splice(desde, 1)
              copia.splice(hasta, 0, x)
              setRespuestas(copia)
            }}
            nombre="respuesta"
          >
            {fila}
          </Ordenable>
        ) : (
          <div>{p.respuestas.map((r, i) => <div key={i}>{fila(r, i)}</div>)}</div>
        )}

        {editando && (
          <button
            onClick={() => {
              setRespuestas([...p.respuestas, { texto: "" }])
              enfocar(p.respuestas.length)
            }}
            className="mt-3 inline-flex items-center gap-1.5 pl-7 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Respuesta {p.respuestas.length + 1}
          </button>
        )}
      </div>
    </section>
  )
}
