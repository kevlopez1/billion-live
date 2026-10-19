"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Check, CircleHelp, CloudOff, Loader2, Network, NotebookPen } from "lucide-react"
import { Arbol } from "@/components/proyectos/arbol"
import { Mapa } from "@/components/proyectos/mapa"
import { Pagina } from "@/components/proyectos/pagina"
import { PantallaClave } from "@/components/pantalla-clave"
import { useEspacio } from "@/lib/use-espacio"
import { RAIZ, nodoNuevo, valido, type Doc } from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// /kevlopez_proyectos — el espacio de trabajo (notas + mapa mental)
//
// La clave, el autoguardado y la copia en el navegador viven en
// `useEspacio`, que comparte con /preguntas. Aquí queda solo el árbol.
// ──────────────────────────────────────────────────────────────

type Vista = "mapa" | "notas"

export function Espacio() {
  const { clave, entrada, setEntrada, error, cargando, doc, cambiar, estado, estadoTexto, entrar, nube, guardar } =
    useEspacio<Doc>({ ruta: "/api/proyectos", llave: "kev-proyectos", valido })

  const [sel, setSel] = useState(RAIZ)
  const [vista, setVista] = useState<Vista>("mapa")
  const [cajon, setCajon] = useState(false)

  // ── Acciones sobre el árbol ──
  const agregar = useCallback((padre: string) => {
    const n = nodoNuevo(padre)
    cambiar((d) => ({
      ...d,
      nodos: [...d.nodos.map((x) => (x.id === padre && x.plegado ? { ...x, plegado: false } : x)), n],
    }))
    setSel(n.id)
    setCajon(true)
  }, [cambiar])

  const plegar = useCallback((id: string) => {
    cambiar((d) => ({ ...d, nodos: d.nodos.map((n) => (n.id === id ? { ...n, plegado: !n.plegado } : n)) }))
  }, [cambiar])

  const seleccionar = (id: string) => {
    setSel(id)
    setCajon(true)
  }

  // ── Pantalla de clave ──
  if (!doc || !clave) {
    return (
      <PantallaClave
        titulo={<>Proyectos de <span className="font-serif-display italic font-normal">Kev López</span></>}
        bajada="Notas y mapa mental. Entra con tu clave de administrador."
        entrada={entrada}
        setEntrada={setEntrada}
        error={error}
        cargando={cargando}
        onEntrar={() => entrar(entrada)}
      />
    )
  }

  const nodo = doc.nodos.find((n) => n.id === sel) ?? doc.nodos.find((n) => n.id === RAIZ)!

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-display truncate text-base font-semibold tracking-tight sm:text-lg">
            Proyectos de <span className="font-serif-display italic font-normal">Kev López</span>
          </h1>
        </div>

        <Link
          href="/preguntas"
          className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
        >
          <CircleHelp className="h-3.5 w-3.5" /> Preguntas
        </Link>

        <div role="tablist" aria-label="Vista" className="flex rounded-full border bg-card/70 p-0.5 backdrop-blur-md">
          {([["mapa", "Mapa", Network], ["notas", "Notas", NotebookPen]] as const).map(([v, t, Icono]) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              type="button"
              onClick={() => setVista(v)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${vista === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icono className="h-3.5 w-3.5" /> {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => estado === "error" || estado === "sucio" ? guardar() : undefined}
          title={estado === "error" ? "Reintentar" : undefined}
          className={`flex shrink-0 items-center gap-1.5 text-xs ${estado === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {estado === "guardando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : estado === "error" || nube === false ? <CloudOff className="h-3.5 w-3.5" />
            : estado === "sucio" ? <span className="h-2 w-2 rounded-full bg-kev-warning" />
            : <Check className="h-3.5 w-3.5" />}
          <span className="hidden max-w-[16rem] truncate sm:inline">{estadoTexto}</span>
        </button>
      </header>

      {vista === "mapa" ? (
        <main className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-[2rem] border bg-card/40 sm:mx-6 sm:mb-6">
          <Mapa doc={doc} seleccionado={nodo.id} onSeleccionar={seleccionar} onPlegar={plegar} onAgregar={agregar} />
          {cajon && (
            <aside className="absolute inset-y-3 right-3 z-10 w-[min(480px,calc(100%-1.5rem))] overflow-y-auto rounded-[1.5rem] border bg-background shadow-2xl">
              <Pagina doc={doc} nodo={nodo} cambiar={cambiar} onSeleccionar={setSel} onAgregar={agregar} onCerrar={() => setCajon(false)} />
            </aside>
          )}
        </main>
      ) : (
        <main className="mx-3 mb-3 grid min-h-0 flex-1 overflow-hidden rounded-[2rem] border bg-card/40 sm:mx-6 sm:mb-6 lg:grid-cols-[280px_1fr]">
          <aside className="max-h-48 overflow-y-auto border-b p-3 lg:max-h-none lg:border-b-0 lg:border-r">
            <Arbol doc={doc} seleccionado={nodo.id} onSeleccionar={setSel} onAgregar={agregar} />
          </aside>
          <div className="min-h-0 overflow-y-auto">
            <Pagina doc={doc} nodo={nodo} cambiar={cambiar} onSeleccionar={setSel} onAgregar={agregar} />
          </div>
        </main>
      )}
    </div>
  )
}
