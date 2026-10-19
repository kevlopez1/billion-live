"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eraser, Highlighter, LayoutGrid, Maximize2, MousePointer2, Minus, Plus, Star, X } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { llenas, nuevaPregunta } from "@/lib/preguntas"
import { ETIQUETA_SECCION, ICONO_SECCION, type Seccion } from "@/lib/revision"
import { ETIQUETA_ESTADO, type Contenido, type Estado, type Lienzo } from "@/lib/branding"
import { TINTAS, color, nuevoId, type Trazo } from "@/lib/proyectos"

// ──────────────────────────────────────────────────────────────
// EL DIAGRAMA
//
// El manual como esquema, no como lista. Dos capas con gramática distinta, a
// propósito:
//
//   ESTRUCTURA → líneas en ángulo recto. Qué cuelga de qué. Se sigue con el
//   dedo sin perder cuál va con cuál.
//
//   RELACIÓN → líneas curvas, por debajo de las cajas. Qué usa qué. Hoy dibuja
//   la única relación cruzada que existe en los datos: cada video en cola usa
//   un formato. Eso el documento no lo puede mostrar, porque viven en dos
//   secciones distintas.
//
// Mezclar las dos gramáticas no es adorno: es lo que deja distinguir de un
// vistazo "esto pertenece a" de "esto usa a".
//
// Y SE EDITA AQUÍ. Cada ítem sabe escribirse de vuelta en el documento (su
// propio `set`), así que escribir en el diagrama es escribir en el manual. No
// hay copia intermedia que se pueda desincronizar.
// ──────────────────────────────────────────────────────────────

const FILA = 34
const AIRE = 8
const AIRE_SECCION = 34
const ARRIBA = 26

type Item = {
  texto: string
  estado?: Estado
  vacio?: boolean
  /** Dónde vive este texto dentro del documento. */
  set: (d: Contenido, v: string) => void
  borrar: (d: Contenido) => void
  /** Si usa un formato, su nombre. Es la relación cruzada que se dibuja. */
  usaFormato?: string
}

type Bloque = {
  id: Seccion
  items: Item[]
  agregar: (d: Contenido) => void
}

// Quitar de un array por índice, sin dejar huecos.
const quitar = <T,>(xs: T[], i: number) => xs.splice(i, 1)

function bloques(c: Contenido): Bloque[] {
  // Las listas de texto suelto comparten forma: el mismo lector y escritor.
  const textos = (
    lee: (d: Contenido) => string[],
    xs: string[],
  ): Item[] =>
    xs.map((texto, i) => ({
      texto,
      set: (d, v) => { lee(d)[i] = v },
      borrar: (d) => quitar(lee(d), i),
    }))

  const per = c.personaje
  const pro = c.produccion

  return [
    {
      id: "personaje",
      items: [
        ...textos((d) => d.personaje.fortalezas, per.fortalezas),
        ...textos((d) => d.personaje.debilidades, per.debilidades),
        ...textos((d) => d.personaje.oportunidades, per.oportunidades),
      ],
      agregar: (d) => { d.personaje.fortalezas.push("") },
    },
    {
      id: "norte",
      items: c.norte.map((p, i) => ({
        texto: p.titulo,
        set: (d, v) => { d.norte[i].titulo = v },
        borrar: (d) => quitar(d.norte, i),
      })),
      agregar: (d) => { d.norte.push({ titulo: "", cuerpo: "", detalle: [] }) },
    },
    {
      id: "formatos",
      items: c.formatos.map((f, i) => ({
        texto: f.nombre,
        vacio: f.beats.length === 0,
        set: (d, v) => { d.formatos[i].nombre = v },
        borrar: (d) => quitar(d.formatos, i),
      })),
      agregar: (d) => { d.formatos.push({ id: `f${d.formatos.length + 1}`, nombre: "", para: "", beats: [] }) },
    },
    {
      id: "edicion",
      items: c.edicion.bloques.map((b, i) => ({
        texto: b.titulo,
        vacio: b.reglas.length === 0,
        set: (d, v) => { d.edicion.bloques[i].titulo = v },
        borrar: (d) => quitar(d.edicion.bloques, i),
      })),
      agregar: (d) => { d.edicion.bloques.push({ titulo: "", nota: "", reglas: [] }) },
    },
    {
      id: "redes",
      items: c.redes.map((r, i) => ({
        texto: r.nombre,
        estado: r.estado,
        set: (d, v) => { d.redes[i].nombre = v },
        borrar: (d) => quitar(d.redes, i),
      })),
      agregar: (d) => { d.redes.push({ nombre: "", estado: "pendiente" }) },
    },
    {
      id: "produccion",
      items: [
        ...textos((d) => d.produccion.personaje, pro.personaje),
        ...textos((d) => d.produccion.equipo, pro.equipo),
      ],
      agregar: (d) => { d.produccion.personaje.push("") },
    },
    {
      id: "enCola",
      items: c.enCola.map((v, i) => ({
        texto: v.titulo,
        usaFormato: v.formato,
        set: (d, x) => { d.enCola[i].titulo = x },
        borrar: (d) => quitar(d.enCola, i),
      })),
      agregar: (d) => { d.enCola.push({ titulo: "", formato: "", etapa: "idea" }) },
    },
    {
      id: "pendientes",
      items: textos((d) => d.pendientes, c.pendientes),
      agregar: (d) => { d.pendientes.push("") },
    },
    {
      id: "hoy",
      items: c.hoy.map((l, i) => ({
        texto: l.titulo,
        set: (d, v) => { d.hoy[i].titulo = v },
        borrar: (d) => quitar(d.hoy, i),
      })),
      agregar: (d) => { d.hoy.push({ titulo: "", cuerpo: "" }) },
    },
    {
      id: "futuro",
      items: c.futuro.map((l, i) => ({
        texto: l.titulo,
        set: (d, v) => { d.futuro[i].titulo = v },
        borrar: (d) => quitar(d.futuro, i),
      })),
      agregar: (d) => { d.futuro.push({ titulo: "", cuerpo: "" }) },
    },
    {
      id: "preguntas",
      items: (c.preguntas ?? []).map((p, i) => ({
        texto: p.pregunta,
        // Una pregunta con tres respuestas está sin contestar, y en el
        // diagrama eso tiene que verse sin abrirla: va en rojo punteado,
        // igual que cualquier otra cosa por definir.
        vacio: llenas(p) < p.meta,
        set: (d, v) => { (d.preguntas ?? [])[i].pregunta = v },
        borrar: (d) => { d.preguntas = (d.preguntas ?? []).filter((_, j) => j !== i) },
      })),
      agregar: (d) => { d.preguntas = [...(d.preguntas ?? []), nuevaPregunta()] },
    },
  ]
}

const PUNTO: Record<Estado, string> = {
  usamos: "bg-kev-success",
  pendiente: "bg-muted-foreground/40",
  no: "bg-kev-warning",
}

export function Diagrama({
  contenido,
  onIr,
  marcadas,
  editando,
  editar,
}: {
  contenido: Contenido
  onIr: (s: Seccion) => void
  marcadas?: Set<string>
  editando: boolean
  editar: (fn: (d: Contenido) => Contenido) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [ancho, setAncho] = useState(0)
  const angosto = ancho > 0 && ancho < 720
  const caja = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const lienzo = contenido.lienzo ?? {}
  const trazos = lienzo.trazos ?? []
  const favs = lienzo.fav ?? []
  const [herramienta, setHerramienta] = useState<"mano" | "marcador" | "borrador">("mano")
  const [tinta, setTinta] = useState(0)
  const [elegida, setElegida] = useState<Seccion | null>(null)
  const [trazando, setTrazando] = useState<Trazo | null>(null)
  const trazoRef = useRef<Trazo | null>(null)
  const [movimiento, setMovimiento] = useState<{ id: Seccion; dx: number; dy: number } | null>(null)
  const moviendo = useRef<{ id: Seccion; x: number; y: number; movido: boolean } | null>(null)
  const recienMovido = useRef(false)

  // Escribir en el lienzo es escribir en el documento: se guarda con todo lo
  // demás y vuelve igual en el otro aparato.
  const enLienzo = (f: (l: Lienzo) => Lienzo) =>
    editar((d) => ({ ...d, lienzo: f(d.lienzo ?? {}) }))

  const mueveSeccion = (id: Seccion, dx: number, dy: number) =>
    enLienzo((l) => {
      const antes = l.pos?.[id] ?? { x: 0, y: 0 }
      return { ...l, pos: { ...l.pos, [id]: { x: antes.x + dx, y: antes.y + dy } } }
    })

  const pintaSeccion = (id: Seccion, t: number | null) =>
    enLienzo((l) => {
      const pos = { ...l.tinta }
      if (t === null) delete pos[id]
      else pos[id] = t
      return { ...l, tinta: pos }
    })

  const marcaSeccion = (id: Seccion) =>
    enLienzo((l) => {
      const actuales = l.fav ?? []
      return { ...l, fav: actuales.includes(id) ? actuales.filter((x: string) => x !== id) : [...actuales, id] }
    })

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W_SEC = angosto ? 128 : 210
  const X_TRONCO_REL = W_SEC + (angosto ? 20 : 42)
  const X_ITEM_REL = X_TRONCO_REL + (angosto ? 20 : 42)
  const COLS = angosto ? 1 : 2
  const SEPARACION_COL = 48

  const disponible = Math.max(ancho || 900, 320) - 24 - SEPARACION_COL * (COLS - 1)
  const W_ITEM = Math.max(170, Math.floor(disponible / COLS) - X_ITEM_REL)
  const ANCHO_COL = X_ITEM_REL + W_ITEM
  const ANCHO = COLS * ANCHO_COL + (COLS - 1) * SEPARACION_COL + 24

  const { puestos, alto, relaciones } = useMemo(() => {
    const yCol = Array.from({ length: COLS }, () => ARRIBA)
    const puestos = bloques(contenido).map((b) => {
      const col = yCol.indexOf(Math.min(...yCol))
      const x = 12 + col * (ANCHO_COL + SEPARACION_COL)
      const n = Math.max(b.items.length, 1)
      const yInicio = yCol[col]
      const items = b.items.map((item, i) => ({ item, y: yInicio + i * (FILA + AIRE) }))
      const altoSec = n * (FILA + AIRE) - AIRE
      yCol[col] = yInicio + altoSec + AIRE_SECCION
      // Lo que Kev movió a mano manda sobre el cálculo, y la sección se lleva
      // sus renglones: moverla y dejar las filas atrás no movería nada.
      const off = lienzo.pos?.[b.id] ?? { x: 0, y: 0 }
      return {
        ...b,
        x: x + off.x,
        y: yInicio + off.y,
        items: items.map((it) => ({ ...it, y: it.y + off.y })),
      }
    })

    // La relación cruzada: de cada video en cola a la caja del formato que usa.
    // Se busca por nombre porque es lo que el manual guarda hoy.
    const formatos = puestos.find((p) => p.id === "formatos")
    const cola = puestos.find((p) => p.id === "enCola")
    const relaciones: { x1: number; y1: number; x2: number; y2: number }[] = []
    if (formatos && cola) {
      for (const { item, y } of cola.items) {
        if (!item.usaFormato?.trim()) continue
        const destino = formatos.items.find(
          (f) => f.item.texto.trim().toLowerCase() === item.usaFormato!.trim().toLowerCase(),
        )
        if (!destino) continue
        relaciones.push({
          x1: cola.x + X_ITEM_REL,
          y1: y + FILA / 2,
          x2: formatos.x + X_ITEM_REL + W_ITEM,
          y2: destino.y + FILA / 2,
        })
      }
    }

    // El alto sale de dónde quedó todo, no de la columna más larga: con
    // secciones movidas a mano, lo segundo deja cosas fuera del lienzo.
    const abajo = puestos.map((p) => (p.items.length ? p.items[p.items.length - 1].y : p.y) + FILA)
    return { puestos, alto: Math.max(ARRIBA, ...abajo) + ARRIBA, relaciones }
  }, [contenido, angosto, COLS, ANCHO_COL, X_ITEM_REL, W_ITEM, SEPARACION_COL, lienzo])

  // Coordenadas del dibujo (las mismas en las que están las cajas).
  const aLienzo = (e: { clientX: number; clientY: number }) => {
    const r = caja.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
  }

  const tocaTrazo = (t: Trazo, x: number, y: number, radio: number) => {
    for (let i = 0; i < t.pts.length; i += 2) {
      if (Math.hypot(t.pts[i] - x, t.pts[i + 1] - y) <= radio) return true
    }
    return false
  }

  // ── Mover una sección ──
  const secAbajo = (id: Seccion) => (e: React.PointerEvent) => {
    if (!editando || herramienta !== "mano" || e.button !== 0) return
    moviendo.current = { id, x: e.clientX, y: e.clientY, movido: false }
    ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }
  const secMueve = (e: React.PointerEvent) => {
    const m = moviendo.current
    if (!m) return
    if (Math.abs(e.clientX - m.x) + Math.abs(e.clientY - m.y) > 3) m.movido = true
    if (m.movido) setMovimiento({ id: m.id, dx: (e.clientX - m.x) / zoom, dy: (e.clientY - m.y) / zoom })
  }
  const secArriba = (id: Seccion) => (e: React.PointerEvent) => {
    const m = moviendo.current
    moviendo.current = null
    setMovimiento(null)
    if (!m) return
    if (m.movido) {
      recienMovido.current = true
      setTimeout(() => { recienMovido.current = false }, 0)
      mueveSeccion(id, (e.clientX - m.x) / zoom, (e.clientY - m.y) / zoom)
    } else {
      setElegida(id)
    }
  }

  const bajar = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Los botones nunca dibujan ni arrastran.
    if ((e.target as HTMLElement).closest("[data-control]")) return
    if (editando && herramienta !== "mano") {
      const { x, y } = aLienzo(e)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      if (herramienta === "borrador") {
        enLienzo((l) => ({ ...l, trazos: (l.trazos ?? []).filter((t) => !tocaTrazo(t, x, y, 14)) }))
        return
      }
      const t: Trazo = { id: nuevoId(), pts: [x, y], tinta, ancho: 3 }
      trazoRef.current = t
      setTrazando(t)
      return
    }
    // En edición se sigue pudiendo arrastrar el lienzo, pero NO desde una caja
    // de texto o un botón: ahí el arrastre pelearía con seleccionar o escribir.
    // Sin esto, en edición no había forma de llegar a lo que queda más abajo:
    // ni arrastre ni scroll.
    if ((e.target as HTMLElement).closest("input, textarea, button")) return
    arrastre.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const mover = (e: React.PointerEvent) => {
    if (editando && herramienta !== "mano") {
      const { x, y } = aLienzo(e)
      if (herramienta === "borrador") {
        if (e.buttons) enLienzo((l) => ({ ...l, trazos: (l.trazos ?? []).filter((t) => !tocaTrazo(t, x, y, 14)) }))
        return
      }
      const t = trazoRef.current
      if (!t) return
      const n = t.pts.length
      if (Math.hypot(t.pts[n - 2] - x, t.pts[n - 1] - y) < 2.5) return
      t.pts.push(x, y)
      setTrazando({ ...t, pts: [...t.pts] })
      return
    }
    const a = arrastre.current
    if (!a) return
    setPan({ x: a.px + (e.clientX - a.x), y: a.py + (e.clientY - a.y) })
  }
  const soltar = () => {
    const t = trazoRef.current
    trazoRef.current = null
    setTrazando(null)
    // Un toque suelto no es un trazo: sin esto el lienzo se llena de puntos.
    if (t && t.pts.length >= 4) enLienzo((l) => ({ ...l, trazos: [...(l.trazos ?? []), t] }))
    arrastre.current = null
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/20">
      {/* ── Leyenda ── Un diagrama sin leyenda obliga a adivinar qué significa
          cada línea, y entonces no se lee: se mira. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        {[
          { trazo: <span className="h-px w-5 bg-gold/60" />, que: "pertenece a" },
          { trazo: <span className="h-px w-5 border-t border-dashed border-rojo/70" />, que: "falta por definir" },
          { trazo: <span className="h-px w-5 border-t border-dashed border-[color:var(--kev-success,#4a9)]" />, que: "usa ese formato" },
        ].map(({ trazo, que }) => (
          <span key={que} className="flex items-center gap-1.5">{trazo}{que}</span>
        ))}
        {editando && (
          <span className="ml-auto font-semibold text-gold">Escribe directo en las cajas</span>
        )}
      </div>

      <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
        {[
          { icono: Plus, accion: () => setZoom((z) => Math.min(2, z + 0.15)), etiqueta: "Acercar" },
          { icono: Minus, accion: () => setZoom((z) => Math.max(0.45, z - 0.15)), etiqueta: "Alejar" },
          { icono: Maximize2, accion: () => { setZoom(1); setPan({ x: 0, y: 0 }) }, etiqueta: "Centrar" },
        ].map(({ icono: Icono, accion, etiqueta }) => (
          <button
            key={etiqueta}
            onClick={accion}
            aria-label={etiqueta}
            className="rounded-lg border border-border bg-background/90 p-2 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <Icono className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {!editando && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-background/85 px-2 py-1 text-[11px] text-muted-foreground/80 backdrop-blur-sm">
          Arrastra para mover · entra a Editar para escribir aquí
        </p>
      )}

      <div
        ref={caja}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className={`h-[580px] touch-none overflow-hidden md:h-[760px] ${editando ? "" : "cursor-grab active:cursor-grabbing"}`}
      >
        <svg
          width={ANCHO}
          height={alto}
          viewBox={`0 0 ${ANCHO} ${alto}`}
          className="max-w-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "left top" }}
        >
          <defs>
            {/* El lienzo punteado: da la sensación de plano técnico y además
                deja ver que las cajas están alineadas a una retícula. */}
            <pattern id="retic" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" className="fill-muted-foreground/15" />
            </pattern>
          </defs>
          <rect width={ANCHO} height={alto} fill="url(#retic)" />

          {/* Capa 1 · las relaciones, por DEBAJO de todo: son contexto, no
              estructura, y no deben competir con ella. */}
          {relaciones.map((r, i) => {
            const mx = (r.x1 + r.x2) / 2
            return (
              <path
                key={`rel-${i}`}
                d={`M ${r.x1} ${r.y1} C ${mx} ${r.y1}, ${mx} ${r.y2}, ${r.x2} ${r.y2}`}
                className="stroke-kev-success/55"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="none"
              />
            )
          })}

          {/* Capa 2 · la estructura, en ángulo recto */}
          {puestos.map(({ id, x, y, items }) => {
            const xTronco = x + X_TRONCO_REL
            const xItem = x + X_ITEM_REL
            const yMedio = y + FILA / 2
            const ultimo = items.length ? items[items.length - 1].y + FILA / 2 : yMedio
            return (
              <g key={`c-${id}`}>
                <path d={`M ${x + W_SEC} ${yMedio} H ${xTronco}`} className="stroke-gold/55" strokeWidth={1.5} fill="none" />
                {items.length > 1 && (
                  <path d={`M ${xTronco} ${yMedio} V ${ultimo}`} className="stroke-gold/35" strokeWidth={1.5} fill="none" />
                )}
                {items.map(({ item, y: yi }, i) => (
                  <path
                    key={i}
                    d={`M ${xTronco} ${yi + FILA / 2} H ${xItem}`}
                    className={item.vacio ? "stroke-rojo/70" : "stroke-gold/35"}
                    strokeWidth={1.5}
                    strokeDasharray={item.vacio ? "3 3" : undefined}
                    fill="none"
                  />
                ))}
              </g>
            )
          })}

          {/* Capa 3 · las cajas */}
          {puestos.map(({ id, x, y, items, agregar }) => {
            const xItem = x + X_ITEM_REL
            const xTronco = x + X_TRONCO_REL
            const marcada = marcadas?.has(id)
            const faltan = items.filter((i) => i.item.vacio).length
            const ultimo = items.length ? items[items.length - 1].y : y
            const corrida = movimiento?.id === id
            const pintada = lienzo.tinta?.[id]
            const favorita = favs.includes(id)
            return (
              <g key={id} transform={corrida ? `translate(${movimiento!.dx} ${movimiento!.dy})` : undefined}>
                <g
                  onClick={() => { if (!editando && !recienMovido.current) onIr(id) }}
                  onPointerDown={secAbajo(id)}
                  onPointerMove={secMueve}
                  onPointerUp={secArriba(id)}
                  onPointerCancel={() => { moviendo.current = null; setMovimiento(null) }}
                  className={editando ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                >
                  <rect
                    x={x} y={y} width={W_SEC} height={FILA} rx={8}
                    className={pintada == null ? `fill-gold/[0.14] ${marcada ? "stroke-rojo/70" : "stroke-gold/55"}` : marcada ? "stroke-rojo/70" : ""}
                    fill={pintada != null ? color(TINTAS[pintada].h, 0.62, 0.17, 0.22) : undefined}
                    stroke={pintada != null && !marcada ? color(TINTAS[pintada].h, 0.6, 0.16, 0.85) : undefined}
                    strokeWidth={elegida === id ? 2.5 : 1.5}
                  />
                  {favorita && (
                    <foreignObject x={x - 7} y={y - 7} width={16} height={16}>
                      <Star className="h-3.5 w-3.5 fill-kev-warning text-kev-warning" aria-label="Marcada" />
                    </foreignObject>
                  )}
                  <foreignObject x={x + 8} y={y + 4} width={W_SEC - 16} height={FILA - 8}>
                    <div className="flex h-full items-center gap-1.5">
                      <span className="shrink-0 text-[12px] leading-none" aria-hidden>{ICONO_SECCION[id]}</span>
                      <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-bold text-foreground">
                        {ETIQUETA_SECCION[id]}
                      </span>
                      <span className={`shrink-0 text-[10.5px] tabular-nums ${faltan ? "font-semibold text-rojo/85" : "text-muted-foreground"}`}>
                        {items.length === 0 ? "0" : faltan ? `${items.length - faltan}/${items.length}` : items.length}
                      </span>
                    </div>
                  </foreignObject>
                </g>

                {items.map(({ item, y: yi }, i) => (
                  <g key={i} className="group/nodo">
                    <rect
                      x={xItem} y={yi} width={W_ITEM} height={FILA} rx={7}
                      className={`fill-background/70 ${item.vacio ? "stroke-rojo/45" : "stroke-border"}`}
                      strokeWidth={1}
                      strokeDasharray={item.vacio ? "3 3" : undefined}
                    />
                    <foreignObject x={xItem + 9} y={yi + 3} width={W_ITEM - 18} height={FILA - 6}>
                      <div className="flex h-full items-center gap-1.5">
                        {item.estado && (
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[item.estado]}`} aria-label={ETIQUETA_ESTADO[item.estado]} />
                        )}
                        {editando ? (
                          <input
                            value={item.texto}
                            onChange={(e) => editar((d) => { item.set(d, e.target.value); return d })}
                            placeholder="Escribe aquí"
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[12px] text-foreground outline-none transition-colors hover:bg-foreground/[0.05] focus:border-gold/45 focus:bg-gold/[0.06]"
                          />
                        ) : (
                          <span
                            onClick={() => onIr(id)}
                            className="min-w-0 flex-1 cursor-pointer truncate text-[12px] text-muted-foreground"
                          >
                            {conPrime(item.texto, false)}
                          </span>
                        )}
                        {item.vacio && !editando && (
                          <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-wider text-rojo/75">falta</span>
                        )}
                        {editando && (
                          <button
                            type="button"
                            onClick={() => editar((d) => { item.borrar(d); return d })}
                            aria-label="Borrar"
                            className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-rojo focus-visible:opacity-100 group-hover/nodo:opacity-100 max-md:opacity-60"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                ))}

                {items.length === 0 && !editando && (
                  <foreignObject x={xItem} y={y + 4} width={W_ITEM} height={FILA - 8}>
                    <div className="flex h-full items-center text-[11.5px] text-muted-foreground/60">Sin definir todavía</div>
                  </foreignObject>
                )}

                {/* Agregar: cuelga del mismo tronco, al final. */}
                {editando && (
                  <>
                    <path
                      d={`M ${xTronco} ${ultimo + FILA / 2} V ${ultimo + FILA + AIRE + FILA / 2 - 6} H ${xItem}`}
                      className="stroke-gold/25" strokeWidth={1.5} strokeDasharray="3 3" fill="none"
                    />
                    <foreignObject x={xItem} y={ultimo + FILA + AIRE - 6} width={W_ITEM} height={FILA}>
                      <button
                        type="button"
                        onClick={() => editar((d) => { agregar(d); return d })}
                        className="flex h-[28px] items-center gap-1.5 rounded-lg border border-dashed border-gold/40 px-2.5 text-[11.5px] text-gold transition-colors hover:border-gold hover:bg-gold/[0.07]"
                      >
                        <Plus className="h-3 w-3" /> Agregar
                      </button>
                    </foreignObject>
                  </>
                )}
              </g>
            )
          })}

          {/* Capa 4 · el marcador que dibuja, encima de todo */}
          {[...trazos, ...(trazando ? [trazando] : [])].map((t) => (
            <polyline
              key={t.id}
              data-trazo
              points={t.pts.join(" ")}
              fill="none"
              stroke={color(TINTAS[t.tinta]?.h ?? TINTAS[0].h, 0.62, 0.17, 0.75)}
              strokeWidth={t.ancho}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          ))}
        </svg>
      </div>

      {/* ── Las marcadas ── Una barra para saltar, no para mirar. */}
      {favs.length > 0 && (
        <div data-control className="absolute left-2 top-12 z-10 flex max-w-[70%] flex-wrap gap-1.5">
          {favs.map((f) => (
            <button
              key={f}
              onClick={() => onIr(f as Seccion)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2 py-1 text-[11px] font-medium backdrop-blur transition-colors hover:bg-foreground/[0.05]"
            >
              <Star className="h-3 w-3 fill-kev-warning text-kev-warning" />
              {ETIQUETA_SECCION[f as Seccion]}
            </button>
          ))}
        </div>
      )}

      {/* ── El marcador ── Solo en edición: lo que se pinta aquí se guarda con
          el manual, y en lectura la página no guarda nada. */}
      {editando && (
        <div data-control className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-xl border border-border bg-background/90 p-1 backdrop-blur">
          {([
            ["mano", "Mover y elegir", MousePointer2],
            ["marcador", "Marcador: dibujar encima", Highlighter],
            ["borrador", "Borrador: quitar trazos", Eraser],
          ] as const).map(([h, etiqueta, Icono]) => (
            <button
              key={h}
              onClick={() => setHerramienta(h)}
              aria-pressed={herramienta === h}
              aria-label={etiqueta}
              title={etiqueta}
              className={`rounded-lg p-2 transition-colors ${
                herramienta === h ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icono className="h-3.5 w-3.5" />
            </button>
          ))}

          {(herramienta === "marcador" || elegida) && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border" />
              {TINTAS.map((t, i) => {
                const activo = herramienta === "marcador" ? tinta === i : lienzo.tinta?.[elegida!] === i
                return (
                  <button
                    key={t.nombre}
                    onClick={() => {
                      if (herramienta === "marcador") setTinta(i)
                      else if (elegida) pintaSeccion(elegida, lienzo.tinta?.[elegida] === i ? null : i)
                    }}
                    aria-pressed={!!activo}
                    aria-label={herramienta === "marcador" ? `Tinta ${t.nombre.toLowerCase()}` : `Resaltar en ${t.nombre.toLowerCase()}`}
                    title={t.nombre}
                    className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${activo ? "scale-110 ring-2 ring-offset-2 ring-offset-background" : ""}`}
                    style={{ background: color(t.h, 0.62, 0.17), ["--tw-ring-color" as string]: color(t.h, 0.5, 0.15) }}
                  />
                )
              })}
            </>
          )}

          {elegida && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <button
                onClick={() => marcaSeccion(elegida)}
                aria-pressed={favs.includes(elegida)}
                aria-label={favs.includes(elegida) ? "Quitar de marcadas" : "Marcar para saltar aquí"}
                title={favs.includes(elegida) ? "Quitar de marcadas" : "Marcar para saltar aquí"}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-kev-warning"
              >
                <Star className={`h-3.5 w-3.5 ${favs.includes(elegida) ? "fill-kev-warning text-kev-warning" : ""}`} />
              </button>
            </>
          )}

          {(lienzo.pos && Object.keys(lienzo.pos).length > 0) && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <button
                onClick={() => enLienzo((l) => ({ ...l, pos: {} }))}
                aria-label="Acomodar solo"
                title="Acomodar solo: deshace todo lo movido a mano"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {trazos.length > 0 && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <button
                onClick={() => enLienzo((l) => ({ ...l, trazos: [] }))}
                aria-label="Borrar todos los trazos"
                title="Borrar todos los trazos"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-rojo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
