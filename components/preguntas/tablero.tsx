"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { Check, CloudOff, Plus, Trash2 } from "lucide-react"
import { Campo } from "@/components/branding/campos"
import { Ordenable } from "@/components/branding/ordenable"
import { PantallaClave } from "@/components/pantalla-clave"
import { useEspacio } from "@/lib/use-espacio"
import {
  META_POR_DEFECTO,
  nuevaPregunta,
  tramoDe,
  valido,
  type Pregunta,
  type Respuesta,
  type Tablero as Doc,
} from "@/lib/preguntas"

// ──────────────────────────────────────────────────────────────
// /preguntas — una pregunta, mínimo veinte respuestas.
//
// La página no es una lista: es un contador que te mira. Mientras escribes
// dice cuántas van y en qué tramo estás, porque el ejercicio solo funciona si
// no paras en la ocho.
// ──────────────────────────────────────────────────────────────

const llenas = (p: Pregunta) => p.respuestas.filter((r) => r.texto.trim()).length

export function Tablero() {
  const { clave, entrada, setEntrada, error, cargando, doc, cambiar, estado, estadoTexto, entrar, nube } =
    useEspacio<Doc>({ ruta: "/api/preguntas", llave: "kev-preguntas", valido })

  const [sel, setSel] = useState<string | null>(null)
  const [foco, setFoco] = useState<number | null>(null)

  const actual = useMemo(() => {
    if (!doc) return null
    return doc.preguntas.find((p) => p.id === sel) ?? doc.preguntas[0] ?? null
  }, [doc, sel])

  if (!doc || !clave) {
    return (
      <PantallaClave
        titulo={<>Preguntas <span className="font-serif-display italic font-normal">abiertas</span></>}
        bajada="Una pregunta, mínimo veinte respuestas. Entra con tu clave de administrador."
        entrada={entrada}
        setEntrada={setEntrada}
        error={error}
        cargando={cargando}
        onEntrar={() => entrar(entrada)}
      />
    )
  }

  // ── Cambios ──
  const editarPregunta = (id: string, f: (p: Pregunta) => Pregunta) =>
    cambiar((d) => ({ ...d, preguntas: d.preguntas.map((p) => (p.id === id ? f(p) : p)) }))

  const setRespuestas = (id: string, rs: Respuesta[]) => editarPregunta(id, (p) => ({ ...p, respuestas: rs }))

  const agregarPregunta = () => {
    const p = nuevaPregunta()
    cambiar((d) => ({ ...d, preguntas: [p, ...d.preguntas] }))
    setSel(p.id)
    setFoco(-1)
  }

  const borrarPregunta = (id: string) => {
    cambiar((d) => ({ ...d, preguntas: d.preguntas.filter((p) => p.id !== id) }))
    setSel(null)
  }

  const teclas = (p: Pregunta, i: number) => (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // Enter crea la siguiente. Shift+Enter sigue siendo salto de línea: hay
    // respuestas de dos renglones que no son dos respuestas.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const rs = [...p.respuestas]
      rs.splice(i + 1, 0, { texto: "" })
      setRespuestas(p.id, rs)
      setFoco(i + 1)
      return
    }
    if (e.key === "Backspace" && p.respuestas[i].texto === "" && p.respuestas.length > 1) {
      e.preventDefault()
      setRespuestas(p.id, p.respuestas.filter((_, j) => j !== i))
      setFoco(Math.max(0, i - 1))
    }
  }

  const hechas = actual ? actual.respuestas.filter((r) => r.hecha && r.texto.trim()).length : 0
  const van = actual ? llenas(actual) : 0
  const faltan = actual ? Math.max(0, actual.meta - van) : 0

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-7">
      {/* ── Barra ── */}
      <header className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Preguntas <span className="font-serif-display italic font-normal">abiertas</span>
        </h1>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {estado === "ok" && nube !== false && <Check className="h-3 w-3" />}
          {nube === false && <CloudOff className="h-3 w-3" />}
          {estadoTexto}
        </span>
        <button
          onClick={agregarPregunta}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Pregunta
        </button>
      </header>

      {/* ── Las preguntas ── */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {doc.preguntas.map((p) => {
          const activa = actual?.id === p.id
          const n = llenas(p)
          return (
            <button
              key={p.id}
              onClick={() => setSel(p.id)}
              aria-pressed={activa}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                activa ? "border-gold/50 bg-gold/[0.07]" : "border-border hover:bg-foreground/[0.03]"
              }`}
            >
              <span className="block max-w-[200px] truncate text-[12.5px] font-semibold">
                {p.pregunta || "Sin escribir"}
              </span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                {n} / {p.meta}
                {p.plazo && ` · ${p.plazo}`}
              </span>
            </button>
          )
        })}
      </div>

      {!actual ? (
        <p className="text-sm text-muted-foreground">
          No hay ninguna pregunta todavía. Crea la primera con el botón de arriba.
        </p>
      ) : (
        <section>
          <Campo
            valor={actual.pregunta}
            onChange={(v) => editarPregunta(actual.id, (p) => ({ ...p, pregunta: v }))}
            editando
            multilinea
            placeholder="¿Cómo…?"
            className="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]"
            campoRef={(el) => { if (foco === -1 && el) { el.focus(); setFoco(null) } }}
          />

          {/* ── El contador ── Es el ejercicio entero: sin número no hay presión. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-display text-[15px] font-bold tabular-nums">
              {van} <span className="text-muted-foreground">/ {actual.meta}</span>
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {faltan > 0 ? `Te faltan ${faltan}. No pares aquí.` : "Llegaste a la meta."}
            </span>
            <span className="text-[12.5px] text-muted-foreground">·</span>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">{hechas} hechas</span>
            <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground">
              Plazo
              <input
                value={actual.plazo}
                onChange={(e) => editarPregunta(actual.id, (p) => ({ ...p, plazo: e.target.value }))}
                placeholder="hoy"
                aria-label="Plazo"
                className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-foreground outline-none transition-colors hover:bg-foreground/[0.04] focus:border-gold/45"
              />
            </label>
            <button
              onClick={() => borrarPregunta(actual.id)}
              aria-label="Borrar esta pregunta"
              className="rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-rojo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
            <div
              className="h-full rounded-full bg-gold/70 transition-[width] duration-300"
              style={{ width: `${Math.min(100, (van / actual.meta) * 100)}%` }}
            />
          </div>

          {/* ── Las respuestas ── */}
          <div className="mt-7">
            <Ordenable
              items={actual.respuestas}
              clave={(_, i) => String(i)}
              mover={(desde, hasta) => {
                const copia = [...actual.respuestas]
                const [x] = copia.splice(desde, 1)
                copia.splice(hasta, 0, x)
                setRespuestas(actual.id, copia)
              }}
              nombre="respuesta"
            >
              {(r, i) => {
                const tramo = tramoDe(i)
                const abre = tramo.desde === i
                return (
                  <div>
                    {abre && (
                      <div className="mb-2 mt-5 flex items-baseline gap-2 first:mt-0">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold">
                          {tramo.nombre}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">{tramo.nota}</span>
                      </div>
                    )}
                    <div className="group flex items-start gap-2 rounded-lg py-0.5">
                      <span className="mt-[7px] w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/50">
                        {i + 1}
                      </span>
                      <button
                        onClick={() =>
                          setRespuestas(
                            actual.id,
                            actual.respuestas.map((x, j) => (j === i ? { ...x, hecha: !x.hecha } : x)),
                          )
                        }
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
                        onChange={(v) =>
                          setRespuestas(
                            actual.id,
                            actual.respuestas.map((x, j) => (j === i ? { ...x, texto: v } : x)),
                          )
                        }
                        editando
                        multilinea
                        placeholder="Escribe una respuesta y pulsa Enter"
                        onKeyDown={teclas(actual, i)}
                        campoRef={(el) => { if (foco === i && el) { el.focus(); setFoco(null) } }}
                        className={`text-[15px] leading-relaxed ${r.hecha ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}
                      />
                      <button
                        onClick={() => {
                          const rs = actual.respuestas.filter((_, j) => j !== i)
                          setRespuestas(actual.id, rs.length ? rs : [{ texto: "" }])
                        }}
                        aria-label={`Borrar la respuesta ${i + 1}`}
                        className="mt-[3px] shrink-0 rounded-md p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50 hover:!text-rojo focus-visible:text-muted-foreground/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              }}
            </Ordenable>

            <button
              onClick={() => {
                setRespuestas(actual.id, [...actual.respuestas, { texto: "" }])
                setFoco(actual.respuestas.length)
              }}
              className="mt-3 inline-flex items-center gap-1.5 pl-7 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Respuesta {actual.respuestas.length + 1}
            </button>
          </div>

          {actual.meta !== META_POR_DEFECTO && (
            <p className="mt-6 text-[11.5px] text-muted-foreground/70">
              Esta pregunta pide {actual.meta} respuestas en lugar de {META_POR_DEFECTO}.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
