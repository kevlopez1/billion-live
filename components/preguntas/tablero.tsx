"use client"

import { useMemo, useState } from "react"
import { Check, CloudOff, Plus } from "lucide-react"
import { PantallaClave } from "@/components/pantalla-clave"
import { VistaPregunta } from "@/components/preguntas/pregunta"
import { useEspacio } from "@/lib/use-espacio"
import { llenas, nuevaPregunta, valido, type Pregunta, type Tablero as Doc } from "@/lib/preguntas"

// ──────────────────────────────────────────────────────────────
// /preguntas — las preguntas que NO pueden ir a /branding.
//
// El mecanismo (una pregunta, mínimo veinte respuestas) también vive en el
// manual, en la sección "Las preguntas": ahí van las del reto. Aquí quedan las
// que llevan nombres de personas y montos, porque esta página pide clave
// hasta para leer y /branding no.
// ──────────────────────────────────────────────────────────────

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

  const reemplazar = (p: Pregunta) =>
    cambiar((d) => ({ ...d, preguntas: d.preguntas.map((x) => (x.id === p.id ? p : x)) }))

  const agregar = () => {
    const p = nuevaPregunta()
    cambiar((d) => ({ ...d, preguntas: [p, ...d.preguntas] }))
    setSel(p.id)
    setFoco(-1)
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-7">
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
          onClick={agregar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Pregunta
        </button>
      </header>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {doc.preguntas.map((p) => {
          const activa = actual?.id === p.id
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
                {llenas(p)} / {p.meta}
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
        <VistaPregunta
          pregunta={actual}
          onChange={reemplazar}
          onBorrar={() => {
            cambiar((d) => ({ ...d, preguntas: d.preguntas.filter((p) => p.id !== actual.id) }))
            setSel(null)
          }}
          foco={foco}
          setFoco={setFoco}
          tituloClase="font-display text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]"
        />
      )}
    </main>
  )
}
