"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, CloudOff, Loader2, Lock, Network, NotebookPen } from "lucide-react"
import { Arbol } from "@/components/proyectos/arbol"
import { Mapa } from "@/components/proyectos/mapa"
import { Pagina } from "@/components/proyectos/pagina"
import { RAIZ, nodoNuevo, valido, type Doc } from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// /kevlopez_proyectos — el espacio de trabajo (notas + mapa mental)
//
// Dos cuidados que importan:
//  1. Nada se pierde. Cada cambio se copia al navegador al instante y se manda
//     a la base con autoguardado. Si la base no está lista (tabla sin crear,
//     sin red), el trabajo queda en el navegador y la barra lo dice.
//  2. La clave vive solo en sessionStorage: se borra al cerrar la pestaña.
// ──────────────────────────────────────────────────────────────

const K_CLAVE = "kev-proyectos-clave"
const K_LOCAL = "kev-proyectos-doc"

type Estado = "limpio" | "sucio" | "guardando" | "ok" | "error"
type Vista = "mapa" | "notas"

function leerLocal(): { doc: Doc; sync: boolean } | null {
  try {
    const t = localStorage.getItem(K_LOCAL)
    if (!t) return null
    const o = JSON.parse(t)
    return valido(o?.doc) ? { doc: o.doc, sync: !!o.sync } : null
  } catch {
    return null
  }
}

function escribirLocal(doc: Doc, sync: boolean) {
  try {
    localStorage.setItem(K_LOCAL, JSON.stringify({ doc, sync }))
  } catch {
    // Almacenamiento lleno o bloqueado: la base sigue siendo el respaldo.
  }
}

export function Espacio() {
  const [clave, setClave] = useState<string | null>(null)
  const [entrada, setEntrada] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(true)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [sel, setSel] = useState(RAIZ)
  const [vista, setVista] = useState<Vista>("mapa")
  const [cajon, setCajon] = useState(false)
  const [estado, setEstado] = useState<Estado>("limpio")
  const [mensaje, setMensaje] = useState("")
  const [nube, setNube] = useState<boolean | null>(null)

  const campo = useRef<HTMLInputElement>(null)
  const sucio = useRef(false)
  const version = useRef(0)
  const docRef = useRef<Doc | null>(null)
  docRef.current = doc

  // ── Entrada ──
  const entrar = useCallback(async (k: string, silencioso = false) => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch("/api/proyectos", { headers: { authorization: `Bearer ${k}` }, cache: "no-store" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        try { sessionStorage.removeItem(K_CLAVE) } catch {}
        if (!silencioso) setError(d?.error || "No se pudo entrar. Inténtalo de nuevo.")
        setClave(null)
        return
      }
      try { sessionStorage.setItem(K_CLAVE, k) } catch {}
      setNube(!!d.configurado)
      const local = leerLocal()
      // Lo que quedó sin mandar en este navegador manda sobre lo de la base.
      if (local && !local.sync) {
        setDoc(local.doc)
        sucio.current = true
        setEstado("sucio")
      } else if (valido(d.contenido)) {
        setDoc(d.contenido)
        escribirLocal(d.contenido, true)
      }
      setClave(k)
    } catch {
      if (!silencioso) setError("Error de red. Revisa tu conexión.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let guardada: string | null = null
    try { guardada = sessionStorage.getItem(K_CLAVE) } catch {}
    if (guardada) entrar(guardada, true)
    else setCargando(false)
  }, [entrar])

  // ── Cambios y autoguardado ──
  const cambiar = useCallback((f: (d: Doc) => Doc) => {
    setDoc((prev) => {
      if (!prev) return prev
      const sig = f(prev)
      if (sig === prev) return prev
      version.current++
      sucio.current = true
      escribirLocal(sig, false)
      return sig
    })
    setEstado("sucio")
  }, [])

  const guardar = useCallback(async () => {
    const d = docRef.current
    if (!d || !clave || !sucio.current) return
    const v = version.current
    setEstado("guardando")
    try {
      const r = await fetch("/api/proyectos", {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ contenido: d }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEstado("error")
        setMensaje(j?.error || "No se pudo guardar.")
        return
      }
      // Si se escribió algo mientras viajaba, sigue pendiente: no se marca limpio.
      if (v === version.current) {
        sucio.current = false
        escribirLocal(d, true)
        setEstado("ok")
        setNube(true)
      } else {
        setEstado("sucio")
      }
    } catch {
      setEstado("error")
      setMensaje("Sin conexión. Lo escrito queda guardado en este navegador.")
    }
  }, [clave])

  useEffect(() => {
    if (!sucio.current || !clave) return
    const t = setTimeout(guardar, 1200)
    return () => clearTimeout(t)
  }, [doc, clave, guardar])

  // Al cerrar la pestaña con algo sin mandar, se intenta un último envío.
  useEffect(() => {
    if (!clave) return
    const alSalir = () => {
      const d = docRef.current
      if (!d || !sucio.current) return
      try {
        fetch("/api/proyectos", {
          method: "PUT",
          keepalive: true,
          headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
          body: JSON.stringify({ contenido: d }),
        })
      } catch {}
    }
    window.addEventListener("pagehide", alSalir)
    return () => window.removeEventListener("pagehide", alSalir)
  }, [clave])

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

  // Se enfoca desde el efecto y no con autoFocus, que desajusta la hidratación.
  useEffect(() => { if (!cargando) campo.current?.focus() }, [cargando, clave])

  // ── Pantalla de clave ──
  if (!doc || !clave) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (entrada) entrar(entrada) }}
          className="glass-card w-full max-w-sm p-7"
        >
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-[0.18em]">Privado</span>
          </div>
          <h1 className="font-display mb-1 text-2xl font-semibold tracking-tight">
            Proyectos de <span className="font-serif-display italic font-normal">Kev López</span>
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">Notas y mapa mental. Entra con tu clave de administrador.</p>
          <input
            type="password"
            ref={campo}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Clave"
            aria-label="Clave"
            className="mb-3 w-full rounded-lg border border-border bg-foreground/[0.04] px-4 py-2.5 text-base outline-none transition-colors focus:border-foreground/30"
          />
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={cargando || !entrada}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-50"
          >
            {cargando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>
        </form>
      </main>
    )
  }

  const nodo = doc.nodos.find((n) => n.id === sel) ?? doc.nodos.find((n) => n.id === RAIZ)!

  const estadoTexto =
    estado === "guardando" ? "Guardando…"
    : estado === "sucio" ? "Sin guardar"
    : estado === "error" ? mensaje
    : nube === false ? "Solo en este navegador"
    : "Guardado"

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-display truncate text-base font-semibold tracking-tight sm:text-lg">
            Proyectos de <span className="font-serif-display italic font-normal">Kev López</span>
          </h1>
        </div>

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
