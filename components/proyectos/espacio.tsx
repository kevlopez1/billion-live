"use client"

import { useCallback, useMemo, useState } from "react"
import { BookOpen, Check, Clapperboard, CircleHelp, CloudOff, Loader2, Lock, Network, NotebookPen, Plus, X } from "lucide-react"
import { Arbol } from "@/components/proyectos/arbol"
import { Mapa } from "@/components/proyectos/mapa"
import { Pagina } from "@/components/proyectos/pagina"
import { PantallaClave } from "@/components/pantalla-clave"
import { Panel } from "@/components/branding/panel"
import { Fabrica } from "@/components/videos/fabrica"
import { Tablero as TableroPreguntas } from "@/components/preguntas/tablero"
import { useEspacio } from "@/lib/use-espacio"
import {
  MAX_ESPACIOS, RAIZ, espacioNuevo, iconoDe, migrar, nodoNuevo, nombreDe, subarbol,
  type Doc, type Tablero, type Trazo,
} from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// /kevlopez_proyectos — el espacio de trabajo (notas + mapa mental)
//
// La clave, el autoguardado y la copia en el navegador viven en
// `useEspacio`, que comparte con /preguntas. Aquí queda solo el árbol.
// ──────────────────────────────────────────────────────────────

type Vista = "mapa" | "notas"

// Acepta lo de hoy y lo de antes: una copia vieja en el navegador no se tira,
// se traduce.
const aceptable = (x: unknown): x is Tablero => migrar(x) !== null

export function Espacio() {
  const { clave, entrada, setEntrada, error, cargando, doc: crudo, cambiar: cambiarCrudo, estado, estadoTexto, entrar, nube, guardar } =
    useEspacio<Tablero>({ ruta: "/api/proyectos", llave: "kev-proyectos", valido: aceptable })

  const [sel, setSel] = useState(RAIZ)
  const [vista, setVista] = useState<Vista>("mapa")
  const [cajon, setCajon] = useState(false)
  const [espacioId, setEspacioId] = useState<string | null>(null)
  // El Manual de marca vive aquí como el primer espacio, aunque sus datos son
  // otros (un documento con forma fija, en /api/branding). Kev: "lo de
  // proyectos y lo de branding hay que centralizarlo en lo mismo".
  // Abre en el manual: es público, no pide clave.
  const [enManual, setEnManual] = useState(true)
  // Las preguntas, aparte del manual. Kev: "ponlo como otra sección muy aparte".
  // Las del reto son públicas; las de plata, del área de Kev López.
  const [enPreguntas, setEnPreguntas] = useState(false)
  const [enPrivadas, setEnPrivadas] = useState(false)
  // Videos, edición, publicación y métricas: público, para el equipo.
  const [enVideos, setEnVideos] = useState(false)
  const enOtro = enManual || enPreguntas || enPrivadas || enVideos
  const ir = (m: boolean, p: boolean, v: boolean) => { setEnManual(m); setEnPreguntas(p); setEnPrivadas(v); setEnVideos(false) }

  const tablero = useMemo(() => (crudo ? migrar(crudo) : null), [crudo])
  const esp = tablero?.espacios.find((e) => e.id === espacioId) ?? tablero?.espacios[0] ?? null
  const doc = esp?.doc ?? null

  const cambiarTablero = useCallback((f: (t: Tablero) => Tablero) => {
    cambiarCrudo((d) => f(migrar(d) as Tablero))
  }, [cambiarCrudo])

  // Cambiar algo DENTRO del espacio abierto. El resto del tablero no se toca.
  const enEspacio = useCallback((id: string, f: (e: { doc: Doc; trazos: Trazo[] }) => { doc: Doc; trazos: Trazo[] }) => {
    cambiarTablero((t) => ({
      ...t,
      espacios: t.espacios.map((e) => (e.id === id ? { ...e, ...f({ doc: e.doc, trazos: e.trazos }) } : e)),
    }))
  }, [cambiarTablero])

  const idEsp = esp?.id ?? ""
  const cambiar = useCallback((f: (d: Doc) => Doc) => {
    enEspacio(idEsp, (e) => ({ ...e, doc: f(e.doc) }))
  }, [enEspacio, idEsp])

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

  // ── El mapa, a mano ──
  // Mover un nodo mueve su rama entera: si se quedaran los hijos, las líneas
  // cruzarían todo el lienzo y el mapa dejaría de leerse.
  const mover = useCallback((id: string, dx: number, dy: number) => {
    cambiar((d) => {
      const rama = subarbol(d, id)
      return {
        ...d,
        nodos: d.nodos.map((n) =>
          rama.has(n.id) ? { ...n, pos: { x: (n.pos?.x ?? 0) + dx, y: (n.pos?.y ?? 0) + dy } } : n,
        ),
      }
    })
  }, [cambiar])

  const pintar = useCallback((id: string, tinta: number | null) => {
    cambiar((d) => ({
      ...d,
      nodos: d.nodos.map((n) => {
        if (n.id !== id) return n
        const sig = { ...n }
        if (tinta === null) delete sig.tinta
        else sig.tinta = tinta
        return sig
      }),
    }))
  }, [cambiar])

  const marcar = useCallback((id: string) => {
    cambiar((d) => ({
      ...d,
      nodos: d.nodos.map((n) => {
        if (n.id !== id) return n
        const sig = { ...n }
        if (sig.fav) delete sig.fav
        else sig.fav = true
        return sig
      }),
    }))
  }, [cambiar])

  const acomodar = useCallback(() => {
    cambiar((d) => ({ ...d, nodos: d.nodos.map(({ pos, ...n }) => n) }))
  }, [cambiar])

  const ponerTrazos = useCallback((t: Trazo[]) => {
    enEspacio(idEsp, (e) => ({ ...e, trazos: t }))
  }, [enEspacio, idEsp])

  // ── Espacios ──
  const nuevoEspacio = useCallback(() => {
    const e = espacioNuevo()
    cambiarTablero((t) => (t.espacios.length >= MAX_ESPACIOS ? t : { ...t, espacios: [...t.espacios, e] }))
    setEspacioId(e.id)
    setSel(RAIZ)
    setCajon(false)
  }, [cambiarTablero])

  const borrarEspacio = useCallback((id: string) => {
    cambiarTablero((t) => (t.espacios.length <= 1 ? t : { ...t, espacios: t.espacios.filter((e) => e.id !== id) }))
    setEspacioId(null)
    setSel(RAIZ)
  }, [cambiarTablero])

  // Renombrar el espacio ES renombrar su raíz: el nombre vive en un solo
  // lugar, así que la pestaña y el nodo del centro no pueden discrepar.
  const renombrarEspacio = useCallback((id: string, nombre: string) => {
    cambiarTablero((t) => ({
      ...t,
      espacios: t.espacios.map((e) =>
        e.id === id
          ? { ...e, doc: { ...e.doc, nodos: e.doc.nodos.map((n) => (n.padre === null ? { ...n, titulo: nombre } : n)) } }
          : e,
      ),
    }))
  }, [cambiarTablero])

  const seleccionar = (id: string) => {
    setSel(id)
    setCajon(true)
  }

  // Kev: "el bloqueo del pin que solo sea para el área de Kev López".
  const bloqueado = !doc || !esp || !clave
  const nodo = doc ? doc.nodos.find((n) => n.id === sel) ?? doc.nodos.find((n) => n.id === RAIZ)! : null

  return (
    // overflow-hidden: la página no se desplaza, solo la caja de adentro. Sin
    // esto había dos scrolls y el de afuera bajaba a un espacio vacío.
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-display truncate text-base font-semibold tracking-tight sm:text-lg">
            Trabajo de <span className="font-serif-display italic font-normal">Kev López</span>
          </h1>
        </div>


        {!enOtro && !bloqueado && <div role="tablist" aria-label="Vista" className="flex rounded-full border bg-card/70 p-0.5 backdrop-blur-md">
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
        </div>}

        {!enOtro && !bloqueado && <button
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
        </button>}
      </header>

      {/* ── Los espacios ── Varios tableros, no uno solo. Cada uno con su
          propio árbol y sus propios trazos. */}
      {(
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2 sm:px-6">
          <button
            type="button"
            onClick={() => ir(true, false, false)}
            aria-pressed={enManual}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              enManual ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" /> Kev Project GTA Branding
          </button>
          <button
            type="button"
            onClick={() => ir(false, true, false)}
            aria-pressed={enPreguntas}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              enPreguntas ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]"
            }`}
          >
            <CircleHelp className="h-3.5 w-3.5" /> Preguntas
          </button>
          <button
            type="button"
            onClick={() => { ir(false, false, false); setEnVideos(true) }}
            aria-pressed={enVideos}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              enVideos ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]"
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" /> Videos
          </button>
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
          {bloqueado || !tablero || !esp ? (
            <button
              type="button"
              onClick={() => ir(false, false, false)}
              aria-pressed={!enOtro}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                !enOtro ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]"
              }`}
            >
              <Lock className="h-3.5 w-3.5" /> Kev López
            </button>
          ) : <>
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Área de Kev López, con clave" />
          <button
            type="button"
            onClick={() => ir(false, false, true)}
            aria-pressed={enPrivadas}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              enPrivadas ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]"
            }`}
          >
            <CircleHelp className="h-3.5 w-3.5" /> Mis preguntas
          </button>
          {tablero.espacios.map((e) => {
            const activo = !enOtro && e.id === esp.id
            return (
              <div
                key={e.id}
                className={`group flex shrink-0 items-center gap-1 rounded-full border px-1 py-0.5 transition-colors ${
                  activo ? "border-foreground/25 bg-foreground/[0.06]" : "border-transparent hover:bg-foreground/[0.04]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => { ir(false, false, false); setEspacioId(e.id); setSel(RAIZ); setCajon(false) }}
                  aria-pressed={activo}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
                >
                  <span aria-hidden>{iconoDe(e)}</span>
                  {activo ? (
                    <input
                      value={nombreDe(e)}
                      onChange={(ev) => renombrarEspacio(e.id, ev.target.value)}
                      aria-label="Nombre del espacio"
                      size={Math.max(6, nombreDe(e).length)}
                      className="min-w-0 rounded border border-transparent bg-transparent px-1 py-0 outline-none transition-colors hover:border-border focus:border-foreground/30"
                    />
                  ) : (
                    <span className="max-w-[140px] truncate text-muted-foreground">{nombreDe(e) || "Sin nombre"}</span>
                  )}
                </button>
                {activo && tablero.espacios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => borrarEspacio(e.id)}
                    aria-label={`Borrar el espacio ${nombreDe(e)}`}
                    className="mr-1 rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
          {tablero.espacios.length < MAX_ESPACIOS && (
            <button
              type="button"
              onClick={nuevoEspacio}
              aria-label="Espacio nuevo"
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Espacio
            </button>
          )}
          </>}
        </div>
      )}

      {enManual ? (
        // `cuaderno`: hoja punteada, para que el manual se sienta un lugar
        // donde se escribe y no un informe terminado.
        <main className="cuaderno mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border px-5 sm:mx-6 sm:mb-6">
          <Panel incrustado />
        </main>
      ) : enVideos ? (
        <main className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border bg-background sm:mx-6 sm:mb-6">
          <Fabrica />
        </main>
      ) : enPreguntas ? (
        <main className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border bg-background sm:mx-6 sm:mb-6">
          <TableroPreguntas incrustado publico />
        </main>
      ) : enPrivadas && !bloqueado ? (
        <main className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border bg-background sm:mx-6 sm:mb-6">
          <TableroPreguntas incrustado />
        </main>
      ) : bloqueado || !doc || !esp || !nodo ? (
        <main className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-[2rem] border bg-background sm:mx-6 sm:mb-6">
          <PantallaClave
            titulo={<>Área de <span className="font-serif-display italic font-normal">Kev López</span></>}
            bajada="Proyectos, mapa mental y preguntas de plata. Entra con tu clave."
            entrada={entrada}
            setEntrada={setEntrada}
            error={error}
            cargando={cargando}
            onEntrar={() => entrar(entrada)}
          />
        </main>
      ) : vista === "mapa" ? (
        <main className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-[2rem] border bg-card/40 sm:mx-6 sm:mb-6">
          <Mapa
            doc={doc}
            seleccionado={nodo.id}
            onSeleccionar={seleccionar}
            onPlegar={plegar}
            onAgregar={agregar}
            onMover={mover}
            onTinta={pintar}
            onFav={marcar}
            onAcomodar={acomodar}
            trazos={esp.trazos}
            onTrazos={ponerTrazos}
          />
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
