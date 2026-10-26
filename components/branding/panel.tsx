"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Check, CircleHelp, Trash2, Undo2, Clapperboard, Cloud, CloudOff, Compass, FileText, Loader2,
  Lock, Network, NotebookPen, Pencil, Radio, Scissors, Shirt, Sparkles, Target, TrendingUp,
  User, X,
} from "lucide-react"
// El mapa y el árbol son los MISMOS de /kevlopez_proyectos. Un segundo mapa
// parecido acaba divergiendo del primero; esto se alimenta traduciendo el
// manual a la forma que ese mapa entiende (lib/branding-arbol.ts).
import { Diagrama } from "@/components/branding/diagrama"
import { guardarClave, leerClave } from "@/lib/clave"
import { devolver, dondeEstaba, type Borrado } from "@/lib/papelera"
import { Arbol } from "@/components/proyectos/arbol"
import { aDoc, idRama, seccionDe } from "@/lib/branding-arbol"
import { PanelRevision } from "@/components/branding/revision-panel"
import { ANCLA, type Revision } from "@/lib/revision"
import { Indice, type Entrada } from "@/components/branding/indice"
import { Plegable } from "@/components/branding/plegable"
import { Agregar, Campo, Fila, ListaTextos } from "@/components/branding/campos"
import { Numeros } from "@/components/branding/numeros"
import { Pruebas } from "@/components/branding/pruebas"
import type { Idea } from "@/app/api/branding/ideas/route"
import { Tema } from "@/components/branding/tema"
import { PrimeMark } from "@/components/prime-mark"
import {
  CONTENIDO_BASE, ESTADOS, ETAPAS, ETIQUETA_ESTADO, ETIQUETA_ETAPA,
  type Contenido, type Estado, type Etapa,
} from "@/lib/branding"

const SECCIONES: Entrada[] = [
  { id: "personaje", nombre: "El personaje" },
  { id: "norte", nombre: "El norte" },
  { id: "formatos", nombre: "Los formatos" },
  { id: "edicion", nombre: "La edición" },
  { id: "numeros", nombre: "Los números" },
  { id: "pruebas", nombre: "La bóveda de pruebas" },
  { id: "distribucion", nombre: "Distribución" },
  { id: "produccion", nombre: "Producción" },
  { id: "cola", nombre: "Guiones e ideas" },
  { id: "hoy", nombre: "Qué funciona hoy" },
  { id: "futuro", nombre: "Hacia 2028" },
]

// Las diez ramas arrancan recogidas: el índice tiene que caber en una pantalla.
const SIN_PLEGAR = new Set<string>()

const SECCIONES_ARBOL = [
  "personaje", "norte", "formatos", "edicion", "redes",
  "produccion", "enCola", "pendientes", "hoy", "futuro",
].map((s) => `sec:${s}`)

const COLOR_ESTADO: Record<Estado, string> = {
  usamos: "border-gold/45 bg-gold/[0.08] text-foreground",
  pendiente: "border-border bg-card/50 text-muted-foreground",
  no: "border-border/70 bg-transparent text-muted-foreground/80",
}

type Guardado = "limpio" | "sucio" | "guardando" | "ok" | "error"


/** `incrustado`: dentro del espacio de trabajo de Kev. Ahí sobran los enlaces
 *  a Proyectos y a Preguntas: el espacio de trabajo ya los tiene arriba. */
export function Panel({ incrustado = false }: { incrustado?: boolean } = {}) {
  const [doc, setDoc] = useState<Contenido>(CONTENIDO_BASE)
  const [cargando, setCargando] = useState(true)
  const [configurado, setConfigurado] = useState<boolean | null>(null)
  const [actualizado, setActualizado] = useState<string | null>(null)
  // Siempre se escribe: el manual es público para ver y escribir (decisión
  // de Kev). La clave solo hace falta para lo que cuesta dinero: Revisar e
  // Ideas, con IA.
  const editando = true
  const [clave, setClave] = useState("")
  const [pidiendoClave, setPidiendoClave] = useState(false)

  // La clave, si ya se puso en este dispositivo: sirve para Revisar e Ideas.
  useEffect(() => {
    try {
      const k = leerClave()
      if (k) setClave(k)
    } catch {}
  }, [])

  const entrarConClave = () => {
    if (!clave) return
    guardarClave(clave)
    setPidiendoClave(false)
  }

  const [estado, setEstado] = useState<Guardado>("limpio")
  const [mensaje, setMensaje] = useState("")
  const original = useRef<string>("")
  // Siempre el documento de AHORA. Hace falta porque `guardar` se queda con
  // el documento del momento en que arrancó, y entre que sale y vuelve la
  // persona sigue escribiendo.
  const docActual = useRef<Contenido>(CONTENIDO_BASE)

  // Documento o mapa: los mismos datos, dos formas de mirarlos. El mapa no es
  // decoración — una rama vacía se ve desde lejos, y eso es lo que hay que ver.
  const [vista, setVista] = useState<"documento" | "mapa">("documento")
  const [nodoSel, setNodoSel] = useState<string>(idRama("personaje"))

  // La revisión de la IA.
  const [verRevision, setVerRevision] = useState(false)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [errorRevision, setErrorRevision] = useState("")
  const [uso, setUso] = useState<{ entrada: number; salida: number; costoUsd: number } | null>(null)

  // Las ideas que propone la IA. No se guardan: o se mandan a la cola, o se
  // tiran. Guardar una propuesta que nadie aceptó solo ensucia el manual.
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [proponiendo, setProponiendo] = useState(false)
  const [errorIdeas, setErrorIdeas] = useState("")

  // ── Carga ──
  useEffect(() => {
    let vivo = true
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return
        if (d?.contenido) {
          setDoc(d.contenido)
          docActual.current = d.contenido
          original.current = JSON.stringify(d.contenido)
        }
        setConfigurado(Boolean(d?.configurado))
        setActualizado(d?.actualizado ?? null)
      })
      .catch(() => {
        // Sin red se sigue con la semilla: el manual se lee igual.
        if (vivo) setConfigurado(false)
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [])

  // Cambiar algo marca el documento como sucio. Se compara el JSON entero
  // en vez de llevar un flag por campo: son decenas de campos y un flag
  // olvidado es un cambio que se pierde sin avisar.
  // ── Deshacer ──
  // Kev borró una fortaleza sin querer y no había cómo volver. Cada cambio
  // deja aquí la versión de antes (las últimas 60); "Deshacer" o ⌘Z vuelven
  // un paso. Vive en la memoria de la pestaña: para ir más atrás está el
  // historial de la base, que guarda una copia en cada guardado.
  const pasado = useRef<Contenido[]>([])
  const [hayPasado, setHayPasado] = useState(false)

  const editar = useCallback((fn: (d: Contenido) => Contenido) => {
    setDoc((d) => {
      const nuevo = fn(structuredClone(d))
      if (pasado.current.at(-1) !== d) {
        pasado.current.push(d)
        if (pasado.current.length > 60) pasado.current.shift()
      }
      docActual.current = nuevo
      setEstado(JSON.stringify(nuevo) === original.current ? "limpio" : "sucio")
      return nuevo
    })
    setHayPasado(true)
  }, [])

  const deshacer = useCallback(() => {
    const anterior = pasado.current.pop()
    if (!anterior) return
    setDoc(anterior)
    docActual.current = anterior
    setEstado(JSON.stringify(anterior) === original.current ? "limpio" : "sucio")
    setHayPasado(pasado.current.length > 0)
  }, [])

  // ── La papelera ──
  // Lo que se borró antes de abrir la página: "Deshacer" no llega ahí, la base
  // sí. Se trae renglón por renglón y cada uno vuelve solo, a su lugar.
  const [verPapelera, setVerPapelera] = useState(false)
  const [borrados, setBorrados] = useState<Borrado[] | null>(null)
  const [errorPapelera, setErrorPapelera] = useState("")

  const abrirPapelera = async () => {
    setVerPapelera((v) => !v)
    if (verPapelera) return
    setBorrados(null)
    setErrorPapelera("")
    try {
      const r = await fetch("/api/branding/papelera", { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) { setErrorPapelera(j.error || "No se pudo abrir la papelera."); return }
      setBorrados(j.borrados ?? [])
    } catch {
      setErrorPapelera("Error de red.")
    }
  }

  const devolverRenglon = (b: Borrado) => {
    editar((d) => devolver(d, b))
    setBorrados((xs) => (xs ? xs.filter((x) => x !== b) : xs))
  }

  // ⌘Z / Ctrl+Z, salvo dentro de una caja de texto: ahí el navegador ya
  // deshace las letras, y quitarle eso sería peor.
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return
      if ((document.activeElement as HTMLElement | null)?.closest("textarea, input, [contenteditable]")) return
      e.preventDefault()
      deshacer()
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [deshacer])

  // Avisa antes de cerrar con cambios sin guardar.
  useEffect(() => {
    if (estado !== "sucio") return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [estado])

  const guardar = async () => {
    setEstado("guardando")
    setMensaje("")
    // Se congela lo que se manda: el documento puede cambiar mientras viaja.
    const enviado = { doc, json: JSON.stringify(doc) }
    try {
      const r = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // `visto` es la versión que este navegador tenía al cargar. Si otro
        // guardó en el medio, el servidor rebota en vez de pisarlo.
        body: JSON.stringify({ contenido: enviado.doc, visto: actualizado }),
      })
      const j = await r.json()
      if (!r.ok) {
        setEstado("error")
        setMensaje(j.error || "No se pudo guardar.")
        return
      }
      original.current = enviado.json
      setActualizado(j.actualizado ?? new Date().toISOString())
      setConfigurado(true)
      setMensaje("")
      // Lo que se escribió MIENTRAS el guardado iba en camino no se guardó.
      // Marcarlo como guardado apagaba el aviso de "sin guardar" y el de
      // cerrar la pestaña: el cambio se perdía sin que nadie lo viera.
      const sigueSucio = JSON.stringify(docActual.current) !== enviado.json
      setEstado(sigueSucio ? "sucio" : "ok")
      setTimeout(() => setEstado((e) => (e === "ok" ? "limpio" : e)), 2500)
    } catch {
      setEstado("error")
      setMensaje("Error de red. No se guardó nada.")
    }
  }

  // ── Guardado solo ──
  // Editar y tener que acordarse de guardar son dos trabajos. Se guarda a los
  // dos segundos de dejar de escribir, pero SOLO si ya hay clave: sin ella
  // esto abriría el cuadro de la contraseña mientras la persona escribe.
  useEffect(() => {
    if (estado !== "sucio") return
    const t = setTimeout(() => { void guardar() }, 2000)
    return () => clearTimeout(t)
    // `guardar` se redefine en cada render; lo que importa es el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, estado])

  // ── La revisión de la IA ──
  const revisar = async () => {
    if (!clave) { setPidiendoClave(true); return }
    setVerRevision(true)
    setRevisando(true)
    setErrorRevision("")
    try {
      const r = await fetch("/api/branding/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        // Se manda lo que hay EN PANTALLA, no lo guardado: así se puede
        // revisar un cambio antes de dejarlo escrito.
        body: JSON.stringify({ contenido: doc }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErrorRevision(j.error || "No se pudo revisar.")
        if (r.status === 401 && !j.error?.includes("ANTHROPIC")) setPidiendoClave(true)
        return
      }
      setRevision(j.revision)
      setUso(j.uso ?? null)
    } catch {
      setErrorRevision("Error de red. No se revisó nada.")
    } finally {
      setRevisando(false)
    }
  }

  // El mapa y el árbol hablan de nodos; el documento, de secciones.
  const irANodo = (idNodo: string) => {
    setNodoSel(idNodo)
    const sec = seccionDe(idNodo)
    if (!sec) return
    setVista("documento")
    // Una sección a la vez: al cambiar se vuelve arriba del documento.
    setTimeout(() => document.getElementById("manual-arriba")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  // La sección que se ve. El norte se muestra también con el personaje: en el
  // índice cuelga de él.
  const activa = ANCLA[seccionDe(nodoSel) ?? "personaje"] ?? "personaje"
  const ver = (id: string) => (activa === id || (activa === "personaje" && id === "norte") ? "" : "hidden")

  const proponer = async () => {
    if (!clave) { setPidiendoClave(true); return }
    setProponiendo(true)
    setErrorIdeas("")
    try {
      const r = await fetch("/api/branding/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ contenido: doc }),
      })
      const j = await r.json()
      if (!r.ok) { setErrorIdeas(j.error || "No se pudo proponer."); return }
      setIdeas(j.ideas ?? [])
    } catch {
      setErrorIdeas("Error de red. No se propuso nada.")
    } finally {
      setProponiendo(false)
    }
  }

  const aLaCola = (idea: Idea) => {
    editar((d) => ({
      ...d,
      enCola: [
        ...d.enCola,
        {
          titulo: idea.titulo,
          formato: d.formatos.find((f) => f.id === idea.formatoId)?.nombre ?? idea.formatoId,
          etapa: "idea" as const,
          gancho: idea.gancho,
          prueba: idea.prueba,
        },
      ],
    }))
    setIdeas((xs) => (xs ? xs.filter((x) => x !== idea) : xs))
  }

  // El título no lleva regla debajo, ni icono, ni emoji: el tamaño y el aire
  // ya separan una sección de la siguiente. Kev: "no me da ganas de escribir
  // ahí, quizá por los emojis". Doce dibujos de colores convertían una hoja de
  // trabajo en una presentación terminada.
  const Titulo = ({ id, children, numero }: { id: string; emoji?: string; children: React.ReactNode; numero?: string }) => (
    <div id={id} className="mb-4 flex scroll-mt-28 items-baseline gap-2.5 pt-2">
      <h2 className="font-display text-[21px] font-bold tracking-tight md:text-[25px]">{children}</h2>
      {numero && <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{numero}</span>}
    </div>
  )

  const enUso = doc.redes.filter((r) => r.estado === "usamos").length
  const salidasDefinidas = doc.redes.filter((r) => r.estado === "usamos" && (r.salida?.pieza ?? "").trim()).length
  // El índice lateral lleva su propio plegado por dentro, así que aquí no va
  // ninguno: este árbol es solo la forma del manual.
  const arbol = useMemo(() => aDoc(doc, SIN_PLEGAR), [doc])

  return (
    <>
      {/* ── Barra de estado y acciones ── */}
      <div className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background px-5 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {cargando ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</>
            ) : configurado && actualizado ? (
              <><Cloud className="h-3 w-3 text-gold" /> En la base</>
            ) : configurado ? (
              // La tabla existe pero todavía está vacía. Decir "En la base" aquí
              // y abajo "no se ha guardado ninguna edición" es contradecirse.
              <><Cloud className="h-3 w-3 text-gold" /> Lista para guardar</>
            ) : (
              <><CloudOff className="h-3 w-3" /> Solo lectura</>
            )}
          </span>

          {/* Las otras dos páginas privadas. Sin esto no se llega a ellas más
              que escribiendo la dirección a mano, y entonces no existen. */}
          {!incrustado && (
            <Link href="/preguntas" className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            <CircleHelp className="h-3 w-3" /> Preguntas
          </Link>
          )}
          {!incrustado && (
            <Link href="/branding" className="hidden items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:flex">
              <NotebookPen className="h-3 w-3" /> Proyectos
            </Link>
          )}

          {estado === "sucio" && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">Sin guardar</span>
          )}
          {estado === "ok" && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-gold"><Check className="h-3 w-3" /> Guardado</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Documento o mapa. Los mismos datos, dos formas de mirarlos. */}
            <div className="flex rounded-xl border border-border p-0.5">
              {([
                ["documento", "Documento", FileText],
                ["mapa", "Mapa", Network],
              ] as const).map(([v, etiqueta, Icono]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  aria-pressed={vista === v}
                  /* En celular solo se ve el icono: sin esto el botón se queda
                     sin nombre para un lector de pantalla. */
                  aria-label={etiqueta}
                  className={`inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    vista === v ? "bg-foreground/[0.09] text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icono className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{etiqueta}</span>
                </button>
              ))}
            </div>

            <button
              onClick={revisar}
              disabled={revisando}
              title="La IA lee el manual entero y dice qué se contradice, qué falta y qué se puede mejorar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold/45 px-3 py-1.5 text-[12.5px] font-semibold text-gold transition-colors hover:bg-gold/[0.08] disabled:opacity-40"
            >
              {revisando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Revisar</span>
            </button>

            <Tema />
            {editando ? (
              <>
                <button
                  onClick={deshacer}
                  disabled={!hayPasado}
                  title="Deshacer el último cambio (⌘Z)"
                  aria-label="Deshacer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Deshacer</span>
                </button>
                <button
                  onClick={abrirPapelera}
                  aria-pressed={verPapelera}
                  title="Lo que se borró del manual, para devolverlo"
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    verPapelera ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Papelera</span>
                </button>
                {(estado === "sucio" || estado === "error") && (
                  <button
                    onClick={guardar}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-[12.5px] font-semibold text-background"
                  >
                    <Check className="h-3.5 w-3.5" /> Guardar ahora
                  </button>
                )}

              </>
            ) : null
}
          </div>
        </div>

        {verPapelera && editando && (
          <div className="mx-auto mt-3 max-w-6xl rounded-2xl border border-border bg-card/70 p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold">Lo que se borró</span>
              <span className="text-[11.5px] text-muted-foreground">Cada renglón vuelve solo a su lugar; lo demás no se toca.</span>
            </div>
            {errorPapelera ? (
              <p className="text-[12.5px] text-rojo">{errorPapelera}</p>
            ) : borrados === null ? (
              <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando en las versiones guardadas…</p>
            ) : borrados.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">No hay nada borrado: todo lo que estuvo guardado sigue en el manual.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {borrados.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px]">{b.texto}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {dondeEstaba(b)} · estaba el {new Date(b.visto).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <button
                      onClick={() => devolverRenglon(b)}
                      className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background"
                    >
                      Devolver
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pidiendoClave && (
          <div className="mx-auto mt-2.5 flex max-w-6xl flex-wrap items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") entrarConClave() }}
              placeholder="Tu clave — se pide una sola vez en este dispositivo"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-gold"
            />
            <button
              onClick={entrarConClave}
              className="shrink-0 rounded-xl bg-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-background"
            >
              Entrar
            </button>
          </div>
        )}

        {mensaje && (
          <p className="mx-auto mt-2 flex max-w-6xl items-start gap-1.5 text-[12px] text-rojo">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {mensaje}
          </p>
        )}
      </div>

      {configurado === false && !cargando && (
        <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/[0.06] px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">La base todavía no está lista.</b> Se está leyendo el contenido semilla del
            código. Para que el panel guarde de verdad, hay que correr{" "}
            <code className="rounded bg-foreground/10 px-1 py-0.5 text-[12px]">supabase/correr-todo.sql</code> en el SQL
            Editor de Supabase. Mientras tanto se puede leer todo, pero no guardar.
          </p>
        </div>
      )}

      {verRevision && (
        <PanelRevision
          revision={revision}
          cargando={revisando}
          error={errorRevision}
          uso={uso}
          onCerrar={() => setVerRevision(false)}
          onRevisar={revisar}
          onIr={(sec) => irANodo(idRama(sec))}
        />
      )}

      {vista === "mapa" ? (
        <Diagrama
          contenido={doc}
          onIr={(s) => irANodo(idRama(s))}
          marcadas={new Set(revision?.hallazgos.filter((h) => h.gravedad === "alta").map((h) => h.seccion) ?? [])}
          editando={editando}
          editar={editar}
        />
      ) : (
      <div className="lg:flex lg:gap-10">
        <Indice entradas={SECCIONES} soloMovil />
        <aside className="sticky top-10 hidden h-fit w-60 shrink-0 lg:block">
          <span className="mb-2 block px-2 text-[11px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Índice
          </span>
          <Arbol
            doc={arbol}
            seleccionado={nodoSel}
            onSeleccionar={irANodo}
            cerradosIniciales={SECCIONES_ARBOL}
          />
        </aside>

        <div id="manual-arriba" className="min-w-0 flex-1 scroll-mt-6 space-y-16 md:space-y-20">
          {/* ── El personaje ── */}
          <section className={ver("personaje")}>
            <Titulo id="personaje" emoji="👤">El personaje</Titulo>
            <Campo
              valor={doc.personaje.nombre}
              onChange={(v) => editar((d) => ({ ...d, personaje: { ...d.personaje, nombre: v } }))}
              editando={editando}
              className="mb-4 font-display text-xl font-bold tracking-tight"
              placeholder="Nombre"
            />
            {/* items-start: si no, las tres columnas se estiran a la altura de
                la más larga y queda un hueco muerto bajo las cortas. */}
            <div className="grid items-start gap-x-8 gap-y-6 sm:grid-cols-3">
              {([
                ["Fortalezas", "fortalezas"],
                ["Debilidades", "debilidades"],
                ["Oportunidades", "oportunidades"],
              ] as const).map(([rotulo, llave]) => (
                <div key={llave}>
                  <div className="mb-2 text-[10.5px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">{rotulo}</div>
                  <ListaTextos
                    items={doc.personaje[llave]}
                    onChange={(v) => editar((d) => ({ ...d, personaje: { ...d.personaje, [llave]: v } }))}
                    editando={editando}
                    placeholder={rotulo.slice(0, -1)}
                    textoAgregar="Agregar"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── El norte ── */}
          <section className={ver("norte")}>
            <Titulo id="norte" emoji="🧭" numero={`${doc.norte.length} principios`}>El norte</Titulo>
            <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Lo que se toma en cuenta siempre. Si un video no responde a esto, no se publica.
            </p>
            {/* Sin tarjeta: el número y el título en negrita ya hacen la
                jerarquía. Encajonar cada párrafo convierte un documento en un
                informe, y en un informe no da ganas de escribir. */}
            <div className="space-y-6">
              {doc.norte.map((p, i) => (
                <div key={i}>
                  <Fila
                    editando={editando}
                    onBorrar={() => editar((d) => ({ ...d, norte: d.norte.filter((_, j) => j !== i) }))}
                  >
                    <div className="flex gap-3">
                      <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Campo
                          valor={p.titulo}
                          onChange={(v) => editar((d) => { d.norte[i].titulo = v; return d })}
                          editando={editando}
                          className="font-display text-[15px] font-semibold tracking-tight md:text-base"
                          placeholder="Título del principio"
                        />
                        <Campo
                          valor={p.cuerpo}
                          onChange={(v) => editar((d) => { d.norte[i].cuerpo = v; return d })}
                          editando={editando}
                          multilinea
                          className="text-[14.5px] leading-relaxed text-foreground/90"
                          placeholder="Qué significa"
                        />
                        {(editando || p.detalle.length > 0) && (
                          <div className="pt-1.5">
                            {editando ? (
                              <ListaTextos
                                items={p.detalle}
                                onChange={(v) => editar((d) => { d.norte[i].detalle = v; return d })}
                                editando
                                placeholder="Detalle"
                                textoAgregar="Agregar detalle"
                              />
                            ) : (
                              <ul className="flex flex-wrap gap-1.5">
                                {p.detalle.map((x, k) => (
                                  <li key={k} className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[12.5px] leading-snug text-muted-foreground">
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Fila>
                </div>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, norte: [...d.norte, { titulo: "", cuerpo: "", detalle: [] }] }))}
                texto="Agregar principio"
              />
            )}
          </section>

          {/* ── Los formatos ── */}
          <section className={ver("formatos")}>
            <Titulo id="formatos" emoji="🎬" numero={`${doc.formatos.length} formatos`}>Los formatos</Titulo>
            <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              La estructura puede variar, pero el objetivo no: posicionar las ambiciones reales y construir el apego a
              la novela del personaje. Toca uno para ver sus pasos.
            </p>
            <div className="space-y-2.5">
              {doc.formatos.map((f, i) => (
                <Fila
                  key={f.id || i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, formatos: d.formatos.filter((_, j) => j !== i) }))}
                >
                  <Plegable
                    titulo={f.nombre || "Formato sin nombre"}
                    subtitulo={f.para}
                    etiqueta={String(i + 1).padStart(2, "0")}
                    abiertoPorDefecto={editando}
                  >
                    {editando && (
                      <div className="mb-4 space-y-2">
                        <Campo valor={f.nombre} onChange={(v) => editar((d) => { d.formatos[i].nombre = v; return d })} editando className="font-display text-[15px] font-semibold" placeholder="Nombre del formato" />
                        <Campo valor={f.para} onChange={(v) => editar((d) => { d.formatos[i].para = v; return d })} editando multilinea className="text-[13px] text-muted-foreground" placeholder="Para qué sirve" />
                      </div>
                    )}
                    <ol className="space-y-3.5">
                      {f.beats.map((b, k) => (
                        <li key={k}>
                          <Fila
                            editando={editando}
                            onBorrar={() => editar((d) => { d.formatos[i].beats.splice(k, 1); return d })}
                          >
                            <div className="flex gap-3">
                              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold tabular-nums text-muted-foreground">
                                {k + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <Campo
                                  valor={b.paso}
                                  onChange={(v) => editar((d) => { d.formatos[i].beats[k].paso = v; return d })}
                                  editando={editando}
                                  className="text-[13.5px] font-medium leading-snug text-foreground"
                                  placeholder="El paso"
                                />
                                {(editando || b.ejemplo) && (
                                  // Como una nota pegada al paso: letra normal y legible, sobre un
                                  // fondo propio. La serif en cursiva se leía fina y apretada.
                                  <div className="rounded-[10px] border border-gold/25 bg-gold/[0.07] px-3 py-2">
                                    <Campo
                                      valor={b.ejemplo ?? ""}
                                      onChange={(v) => editar((d) => { d.formatos[i].beats[k].ejemplo = v; return d })}
                                      editando={editando}
                                      multilinea
                                      className="text-[14.5px] font-medium leading-relaxed text-foreground/90"
                                      placeholder="Guion de ejemplo (opcional)"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </Fila>
                        </li>
                      ))}
                    </ol>
                    {editando && (
                      <Agregar
                        onClick={() => editar((d) => { d.formatos[i].beats.push({ paso: "", ejemplo: "" }); return d })}
                        texto="Agregar paso"
                      />
                    )}
                  </Plegable>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() =>
                  editar((d) => ({
                    ...d,
                    formatos: [...d.formatos, { id: `f${d.formatos.length + 1}`, nombre: "", para: "", beats: [{ paso: "" }] }],
                  }))
                }
                texto="Agregar formato"
              />
            )}
          </section>

          {/* ── La edición ── */}
          <section className={ver("edicion")}>
            <Titulo id="edicion" emoji="✂️" numero={`${doc.edicion.bloques.length} bloques`}>La edición</Titulo>

            <div className="mb-5 rounded-2xl border border-gold/40 bg-gold/[0.05] px-4 py-4 md:px-5">
              <div className="mb-1.5 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-gold">
                La regla madre
              </div>
              <Campo
                valor={doc.edicion.regla}
                onChange={(v) => editar((d) => ({ ...d, edicion: { ...d.edicion, regla: v } }))}
                editando={editando}
                multilinea
                className="font-serif-display text-[15px] italic leading-relaxed text-foreground md:text-base"
                placeholder="La regla que manda sobre todas las demás"
              />
            </div>

            {/* ── La estructura ──
                Va antes que los bloques porque es el esqueleto: los bloques
                dicen CÓMO se hace cada cosa, esto dice EN QUÉ ORDEN. Se
                numera porque el orden es parte de la regla. */}
            {(editando || (doc.edicion.estructura?.length ?? 0) > 0) && (
              <div className="mb-5">
                <div className="mb-2.5 flex items-baseline gap-2">
                  <h3 className="font-display text-[15px] font-bold tracking-tight">La estructura</h3>
                  <span className="text-[11.5px] text-muted-foreground">
                    pensada para formato largo, aplicable al corto — en corto se comprime, no se saltan pasos
                  </span>
                </div>
                <ol className="space-y-1.5">
                  {(doc.edicion.estructura ?? []).map((b, i) => (
                    <li key={i}>
                      <Fila
                        editando={editando}
                        onBorrar={() =>
                          editar((d) => ({
                            ...d,
                            edicion: { ...d.edicion, estructura: (d.edicion.estructura ?? []).filter((_, j) => j !== i) },
                          }))
                        }
                      >
                        <div className="flex items-start gap-3 rounded-xl border border-border bg-card/40 px-3.5 py-2.5">
                          <span className="mt-px shrink-0 font-display text-[13px] font-bold tabular-nums text-gold">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Campo
                              valor={b.paso}
                              onChange={(v) => editar((d) => { (d.edicion.estructura ?? [])[i].paso = v; return d })}
                              editando={editando}
                              className="text-[14px] font-semibold leading-snug"
                              placeholder="El paso"
                            />
                            {(editando || b.ejemplo) && (
                              <Campo
                                valor={b.ejemplo ?? ""}
                                onChange={(v) => editar((d) => { (d.edicion.estructura ?? [])[i].ejemplo = v; return d })}
                                editando={editando}
                                multilinea
                                className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground"
                                placeholder="Qué entra en este paso (opcional)"
                              />
                            )}
                          </div>
                        </div>
                      </Fila>
                    </li>
                  ))}
                </ol>
                {editando && (
                  <Agregar
                    onClick={() =>
                      editar((d) => ({
                        ...d,
                        edicion: { ...d.edicion, estructura: [...(d.edicion.estructura ?? []), { paso: "" }] },
                      }))
                    }
                    texto="Agregar paso"
                  />
                )}
              </div>
            )}

            <div className="space-y-2.5">
              {doc.edicion.bloques.map((b, i) => (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() =>
                    editar((d) => ({ ...d, edicion: { ...d.edicion, bloques: d.edicion.bloques.filter((_, j) => j !== i) } }))
                  }
                >
                  <Plegable
                    titulo={b.titulo || "Bloque sin nombre"}
                    subtitulo={b.nota}
                    etiqueta={b.reglas.length === 0 && !editando ? "—" : String(b.reglas.length)}
                    abiertoPorDefecto={editando || b.reglas.length > 0}
                  >
                    {editando && (
                      <div className="mb-3 space-y-2">
                        <Campo
                          valor={b.titulo}
                          onChange={(v) => editar((d) => { d.edicion.bloques[i].titulo = v; return d })}
                          editando
                          className="font-display text-[15px] font-semibold"
                          placeholder="Nombre del bloque"
                        />
                        <Campo
                          valor={b.nota}
                          onChange={(v) => editar((d) => { d.edicion.bloques[i].nota = v; return d })}
                          editando
                          multilinea
                          className="text-[13px] text-muted-foreground"
                          placeholder="Por qué importa este bloque"
                        />
                      </div>
                    )}
                    <ListaTextos
                      items={b.reglas}
                      onChange={(v) => editar((d) => { d.edicion.bloques[i].reglas = v; return d })}
                      editando={editando}
                      placeholder="La regla, en una frase"
                      textoAgregar="Agregar regla"
                    />
                  </Plegable>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() =>
                  editar((d) => ({
                    ...d,
                    edicion: { ...d.edicion, bloques: [...d.edicion.bloques, { titulo: "", nota: "", reglas: [] }] },
                  }))
                }
                texto="Agregar bloque"
              />
            )}

            <div className="mt-4 rounded-2xl border border-rojo/35 bg-rojo/[0.04] px-4 py-4">
              <div className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-rojo">
                Lo que nunca
              </div>
              <ListaTextos
                items={doc.edicion.nunca}
                onChange={(v) => editar((d) => ({ ...d, edicion: { ...d.edicion, nunca: v } }))}
                editando={editando}
                placeholder="Lo que no se hace, nunca"
                textoAgregar="Agregar prohibición"
              />
            </div>
          </section>

          {/* ── Los números ── van con los formatos: miden cómo rinde cada uno. */}
          <div className={ver("formatos")}><Numeros formatos={doc.formatos} clave={clave} /></div>

          {/* La bóveda de pruebas va con los guiones: de ahí sale lo que se muestra en pantalla. */}
          <div className={ver("cola")}><Pruebas /></div>

          {/* ── Distribución ── */}
          <section className={ver("distribucion")}>
            <Titulo id="distribucion" emoji="📡" numero={`${enUso} de ${doc.redes.length} en uso`}>Distribución</Titulo>

            <p className="mb-4 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
              <b className="text-foreground">Un rodaje, {enUso} salidas.</b>{" "}
              {salidasDefinidas === enUso
                ? "Cada red en uso tiene escrito qué pieza le toca."
                : `${enUso - salidasDefinidas} de las ${enUso} redes en uso no tienen escrito qué pieza les toca de cada rodaje.`}
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {doc.redes.map((r, i) => (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, redes: d.redes.filter((_, j) => j !== i) }))}
                >
                  <div className={`rounded-xl border px-3.5 py-3 ${COLOR_ESTADO[r.estado]}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Campo
                        valor={r.nombre}
                        onChange={(v) => editar((d) => { d.redes[i].nombre = v; return d })}
                        editando={editando}
                        as="span"
                        className="font-display text-[14px] font-semibold tracking-tight"
                        placeholder="Red"
                      />
                      {editando ? (
                        <select
                          value={r.estado}
                          onChange={(e) => editar((d) => { d.redes[i].estado = e.target.value as Estado; return d })}
                          className="shrink-0 rounded-lg border border-gold/35 bg-background px-1.5 py-1 text-[11px] outline-none"
                        >
                          {ESTADOS.map((e) => (
                            <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] opacity-70">
                          {ETIQUETA_ESTADO[r.estado]}
                        </span>
                      )}
                    </div>
                    {(editando || r.nota) && (
                      <Campo
                        valor={r.nota ?? ""}
                        onChange={(v) => editar((d) => { d.redes[i].nota = v; return d })}
                        editando={editando}
                        className="mt-1 text-[12px] leading-snug opacity-75"
                        placeholder="Nota (opcional)"
                      />
                    )}

                    {/* Qué sale para esta red de un mismo rodaje. Sin esto,
                        "estar en diez redes" es una intención; con esto es una
                        lista de entregables. Solo se pide donde ya se publica. */}
                    {r.estado === "usamos" && (editando || r.salida?.pieza) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-current/15 pt-2 text-[11.5px]">
                        {editando ? (
                          <>
                            {(["pieza", "duracion", "relacion"] as const).map((k) => (
                              <input
                                key={k}
                                value={r.salida?.[k] ?? ""}
                                onChange={(e) =>
                                  editar((d) => {
                                    const s = d.redes[i].salida ?? { pieza: "", duracion: "", relacion: "" }
                                    s[k] = e.target.value
                                    d.redes[i].salida = s
                                    return d
                                  })
                                }
                                placeholder={{ pieza: "Qué pieza", duracion: "Duración", relacion: "Formato" }[k]}
                                className="min-w-0 flex-1 rounded-md border border-gold/35 bg-background px-1.5 py-0.5 text-[11.5px] outline-none focus:border-gold"
                              />
                            ))}
                          </>
                        ) : (
                          [r.salida?.pieza, r.salida?.duracion, r.salida?.relacion]
                            .filter(Boolean)
                            .map((x, j) => (
                              <span key={j} className="rounded-md bg-current/10 px-1.5 py-0.5 opacity-80">{x}</span>
                            ))
                        )}
                      </div>
                    )}
                    {r.estado === "usamos" && !editando && !r.salida?.pieza && (
                      <p className="mt-2 border-t border-current/15 pt-2 text-[11px] text-rojo/75">
                        Sin definir qué sale para aquí de cada rodaje.
                      </p>
                    )}
                  </div>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, redes: [...d.redes, { nombre: "", estado: "pendiente" }] }))}
                texto="Agregar red"
              />
            )}
          </section>

          {/* ── Producción ── */}
          <section className={ver("produccion")}>
            <Titulo id="produccion" emoji="👕">Producción</Titulo>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["Personaje", "personaje"], ["Equipo", "equipo"]] as const).map(([rotulo, llave]) => (
                <div key={llave}>
                  <div className="mb-2 text-[10.5px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">{rotulo}</div>
                  <ListaTextos
                    items={doc.produccion[llave]}
                    onChange={(v) => editar((d) => ({ ...d, produccion: { ...d.produccion, [llave]: v } }))}
                    editando={editando}
                    placeholder={rotulo}
                    textoAgregar="Agregar"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Guiones e ideas ── */}
          <section className={ver("cola")}>
            <Titulo id="cola" emoji="🎯" numero={`${doc.enCola.length} videos`}>Guiones e ideas</Titulo>

            {/* ── La línea de producción ──
                Una fábrica tiene estaciones. Ver cuántos hay en cada una es lo
                que deja ver dónde se atasca: diez ideas y cero grabados no es
                un problema de ideas. */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ETAPAS.map((e) => {
                const n = doc.enCola.filter((v) => (v.etapa ?? "idea") === e).length
                return (
                  <span
                    key={e}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] tabular-nums ${
                      n ? "border-gold/45 bg-gold/[0.07] text-foreground" : "border-border text-muted-foreground/60"
                    }`}
                  >
                    {ETIQUETA_ETAPA[e]} <b className="font-display font-bold">{n}</b>
                  </span>
                )
              })}
            </div>

            <div className="space-y-2.5">
              {doc.enCola.map((v, i) => {
                const etapa = v.etapa ?? "idea"
                return (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, enCola: d.enCola.filter((_, j) => j !== i) }))}
                >
                  <div className="rounded-2xl border border-border bg-card/40 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Campo
                          valor={v.titulo}
                          onChange={(x) => editar((d) => { d.enCola[i].titulo = x; return d })}
                          editando={editando}
                          className="font-display text-[15px] font-semibold tracking-tight"
                          placeholder="Título del video"
                        />
                        {editando ? (
                          <Campo
                            valor={v.formato}
                            onChange={(x) => editar((d) => { d.enCola[i].formato = x; return d })}
                            editando
                            className="text-[12px] text-muted-foreground"
                            placeholder="Formato"
                          />
                        ) : (
                          <div className="text-[12px] text-muted-foreground">Formato · {v.formato}</div>
                        )}
                      </div>
                      {editando ? (
                        <select
                          value={etapa}
                          onChange={(e) => editar((d) => { d.enCola[i].etapa = e.target.value as Etapa; return d })}
                          className="shrink-0 rounded-lg border border-border bg-background px-2 py-1 text-[12px] outline-none focus:border-gold"
                        >
                          {ETAPAS.map((e) => <option key={e} value={e}>{ETIQUETA_ETAPA[e]}</option>)}
                        </select>
                      ) : (
                        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/[0.07] px-2.5 py-0.5 text-[11px] font-semibold">
                          {ETIQUETA_ETAPA[etapa]}
                        </span>
                      )}
                    </div>

                    {/* El guion, como lo define Kev: gancho + estructura + CTA. No es un
                        texto palabra por palabra; tiene que ser coherente de
                        punta a punta. */}
                    {(editando || v.gancho || v.estructura || v.cta) && (
                      <div className="mt-3 space-y-2.5 border-t border-border pt-3">
                        <div className="grid gap-1 sm:grid-cols-[92px_1fr]">
                          <span className="pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gold">Gancho</span>
                          <Campo
                            valor={v.gancho ?? ""}
                            onChange={(x) => editar((d) => { d.enCola[i].gancho = x; return d })}
                            editando={editando}
                            multilinea
                            className="text-[14px] font-medium leading-relaxed text-foreground/85"
                            placeholder="Lo que engancha en los 3 primeros segundos"
                          />
                        </div>
                        <div className="grid gap-1 sm:grid-cols-[92px_1fr]">
                          <span className="pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gold">Estructura</span>
                          <Campo
                            valor={v.estructura ?? ""}
                            onChange={(x) => editar((d) => { d.enCola[i].estructura = x; return d })}
                            editando={editando}
                            multilinea
                            className="text-[14px] font-medium leading-relaxed text-foreground/85"
                            placeholder="Cómo se desarrolla: los pasos del formato, en tus palabras"
                          />
                        </div>
                        <div className="grid gap-1 sm:grid-cols-[92px_1fr]">
                          <span className="pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gold">CTA</span>
                          <Campo
                            valor={v.cta ?? ""}
                            onChange={(x) => editar((d) => { d.enCola[i].cta = x; return d })}
                            editando={editando}
                            multilinea
                            className="text-[14px] font-medium leading-relaxed text-foreground/85"
                            placeholder="Qué le pides al que mira, al final"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Fila>
                )
              })}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, enCola: [...d.enCola, { titulo: "", formato: "", etapa: "idea" }] }))}
                texto="Agregar video"
              />
            )}

            {/* ── Que la IA proponga, no solo revise ── */}
            <div className="mt-5 border-t border-border pt-4">
              <button
                onClick={proponer}
                disabled={proponiendo}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gold/45 px-3.5 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/[0.08] disabled:opacity-40"
              >
                {proponiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Proponer las próximas ideas
              </button>
              <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground/80">
                Lee el manual y los números de lo que ya publicaste. Cada idea viene con su
                gancho escrito y con qué prueba lleva en pantalla.
              </p>

              {errorIdeas && (
                <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-rojo">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {errorIdeas}
                </p>
              )}

              {ideas && ideas.length === 0 && !proponiendo && (
                <p className="mt-2.5 text-[13px] text-muted-foreground">
                  No propuso nada. Con el manual así de vacío, cualquier idea sería inventada.
                </p>
              )}

              {ideas && ideas.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {ideas.map((idea, i) => (
                    <li key={i} className="rounded-2xl border border-gold/35 bg-gold/[0.04] px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[15px] font-semibold tracking-tight">{idea.titulo}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {doc.formatos.find((f) => f.id === idea.formatoId)?.nombre ?? idea.formatoId}
                          </p>
                        </div>
                        <button
                          onClick={() => aLaCola(idea)}
                          className="shrink-0 rounded-xl bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background transition-opacity hover:opacity-85"
                        >
                          A la cola
                        </button>
                      </div>
                      <dl className="mt-2.5 space-y-1 border-t border-gold/25 pt-2.5 text-[13px] leading-snug">
                        {([
                          ["Gancho", `«${idea.gancho}»`],
                          ["Prueba", idea.prueba],
                          ["Por qué", idea.porque],
                        ] as const).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <dt className="shrink-0 pt-px text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{k}</dt>
                            <dd className="min-w-0 flex-1 text-muted-foreground">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4">
              <div className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Pendientes
              </div>
              <ListaTextos
                items={doc.pendientes}
                onChange={(v) => editar((d) => ({ ...d, pendientes: v }))}
                editando={editando}
                placeholder="Pendiente"
                textoAgregar="Agregar pendiente"
              />
            </div>
          </section>

          {/* ── Hoy y futuro ── */}
          {([
            ["hoy", "Qué funciona hoy", "2026", "✨", "hoy"],
            ["futuro", "Hacia dónde va", "2028", "📈", "futuro"],
          ] as const).map(([id, titulo, anio, Icono, llave]) => (
            <section key={id} className={ver(id)}>
              <Titulo id={id} emoji={Icono} numero={anio}>{titulo}</Titulo>
              {id === "futuro" && (
                <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                  Qué buscará el consumidor, y por lo tanto hacia dónde tiene que mirar{" "}
                  <PrimeMark className="text-[0.9em]" />.
                </p>
              )}
              <div className="space-y-2.5">
                {doc[llave].map((l, i) => (
                  <Fila
                    key={i}
                    editando={editando}
                    onBorrar={() => editar((d) => ({ ...d, [llave]: d[llave].filter((_, j) => j !== i) }))}
                  >
                    <Plegable titulo={l.titulo || "Sin título"} abiertoPorDefecto={editando}>
                      <div className="space-y-2">
                        {editando && (
                          <Campo
                            valor={l.titulo}
                            onChange={(v) => editar((d) => { d[llave][i].titulo = v; return d })}
                            editando
                            className="font-display text-[15px] font-semibold"
                            placeholder="Título"
                          />
                        )}
                        <Campo
                          valor={l.cuerpo}
                          onChange={(v) => editar((d) => { d[llave][i].cuerpo = v; return d })}
                          editando={editando}
                          multilinea
                          className="text-[14.5px] leading-relaxed text-foreground/90"
                          placeholder="Qué significa"
                        />
                      </div>
                    </Plegable>
                  </Fila>
                ))}
              </div>
              {editando && (
                <Agregar
                  onClick={() => editar((d) => ({ ...d, [llave]: [...d[llave], { titulo: "", cuerpo: "" }] }))}
                  texto="Agregar lectura"
                />
              )}
            </section>
          ))}

          <p className="border-t border-border pt-6 text-[12px] leading-relaxed text-muted-foreground/70">
            {actualizado
              ? `Última edición guardada: ${new Date(actualizado).toLocaleString("es-BO", { dateStyle: "long", timeStyle: "short" })}.`
              : "Todavía no se ha guardado ninguna edición: se está leyendo el contenido del código."}{" "}
            Cada guardado deja copia del anterior en el historial.
          </p>
        </div>
      </div>
      )}
    </>
  )
}
