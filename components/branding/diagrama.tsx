"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eraser, Highlighter, LayoutGrid, Maximize2, MousePointer2, Minus, Plus, Star, X } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"
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

const FILA = 36
const AIRE = 10
const AIRE_SECCION = 26
const ARRIBA = 26
const ALTO_SEC = 44
const ALTO_RAIZ = 56
const SEPARACION_H = 76

// El codo con esquinas redondeadas del mapa de Kev López.
function codo(x1: number, y1: number, x2: number, y2: number): string {
  const dy = y2 - y1
  const mx = x2 > x1 + 24 ? x1 + Math.min(SEPARACION_H / 2, (x2 - x1) / 2) : (x1 + x2) / 2
  if (Math.abs(dy) < 1) return `M ${x1} ${y1} H ${x2}`
  const r = Math.min(10, Math.abs(dy) / 2, Math.abs(mx - x1), Math.abs(x2 - mx))
  const sy = Math.sign(dy)
  const sx1 = Math.sign(mx - x1) || 1
  const sx2 = Math.sign(x2 - mx) || 1
  return `M ${x1} ${y1} H ${mx - sx1 * r} Q ${mx} ${y1} ${mx} ${y1 + sy * r} V ${y2 - sy * r} Q ${mx} ${y2} ${mx + sx2 * r} ${y2} H ${x2}`
}

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

  // De izquierda a derecha, igual que el mapa de Kev López: la raíz, las
  // secciones como bloques de color y lo de cada una colgando a la derecha.
  // Kev: "hazlo igual al de Kev López en estética".
  const X_RAIZ = 24
  const W_RAIZ = 176
  const X_SEC = X_RAIZ + W_RAIZ + SEPARACION_H
  const W_SEC = angosto ? 150 : 210
  const X_ITEM = X_SEC + W_SEC + SEPARACION_H
  const W_ITEM = Math.max(220, Math.min(420, (ancho || 900) - X_ITEM - 24))
  const ANCHO = X_ITEM + W_ITEM + 24

  const { puestos, alto, relaciones, yRaiz } = useMemo(() => {
    const bs = bloques(contenido)

    // Lo que ocupa una sección a la derecha: sus renglones y, en edición, la
    // fila de "Agregar". Una vacía reserva un renglón.
    const altoDe = (n: number) => Math.max(n, 1) * (FILA + AIRE) - AIRE + (editando ? AIRE + 28 : 0)

    let cursor = ARRIBA
    const puestos = bs.map((b, i) => {
      const h = altoDe(b.items.length)
      // Lo que Kev movió a mano manda, y la sección se lleva sus renglones.
      const off = lienzo.pos?.[b.id] ?? { x: 0, y: 0 }
      const yPrimero = cursor + off.y
      const ySec = yPrimero + Math.max(0, Math.min(h, b.items.length * (FILA + AIRE) - AIRE) - ALTO_SEC) / 2
      cursor += h + AIRE_SECCION
      return {
        ...b,
        tono: TINTAS[i % TINTAS.length].h,
        x: X_SEC + off.x,
        xItem: X_ITEM + off.x,
        y: ySec,
        items: b.items.map((item, k) => ({ item, y: yPrimero + k * (FILA + AIRE) })),
        yPrimero,
        h,
      }
    })

    // La relación cruzada: de cada video en cola al formato que usa. Las dos
    // cajas quedan en la misma columna, así que la curva sale por la derecha.
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
        relaciones.push({ x1: cola.xItem + W_ITEM, y1: y + FILA / 2, x2: formatos.xItem + W_ITEM, y2: destino.y + FILA / 2 })
      }
    }

    const abajo = puestos.map((p) => Math.max(p.yPrimero + p.h, p.y + ALTO_SEC))
    const fondo = Math.max(ARRIBA, ...abajo)
    return { puestos, alto: fondo + ARRIBA, relaciones, // La raíz arriba, a la altura de la primera sección: centrada en un
    // lienzo tan alto quedaba fuera de la vista al abrir.
    yRaiz: (puestos[0]?.y ?? ARRIBA) + (ALTO_SEC - ALTO_RAIZ) / 2 }
  }, [contenido, editando, X_SEC, X_ITEM, W_ITEM, lienzo])

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
          { trazo: <span className="h-0.5 w-5 bg-foreground/50" />, que: "pertenece a" },
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
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
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

          {/* Capa 1 · las relaciones, por DEBAJO de todo: son contexto. */}
          {relaciones.map((r, i) => {
            const bx = Math.max(r.x1, r.x2) + 46
            return (
              <path
                key={`rel-${i}`}
                d={`M ${r.x1} ${r.y1} C ${bx} ${r.y1}, ${bx} ${r.y2}, ${r.x2} ${r.y2}`}
                className="stroke-kev-success/55"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="none"
              />
            )
          })}

          {/* Capa 2 · la raíz */}
          <rect x={X_RAIZ} y={yRaiz} width={W_RAIZ} height={ALTO_RAIZ} rx={10} className="fill-foreground" />
          <foreignObject x={X_RAIZ} y={yRaiz} width={W_RAIZ} height={ALTO_RAIZ}>
            <div className="flex h-full items-center justify-center px-3 font-display text-[13px] font-bold text-background">
              Kev Project GTA
            </div>
          </foreignObject>

          {/* Capa 3 · cada sección, un bloque de color con lo suyo a la derecha */}
          {puestos.map(({ id, x, xItem, y, tono: tonoBase, items, agregar, yPrimero }) => {
            const marcada = marcadas?.has(id)
            const faltan = items.filter((i) => i.item.vacio).length
            const ultimo = items.length ? items[items.length - 1].y : yPrimero - (FILA + AIRE)
            const corrida = movimiento?.id === id
            const pintada = lienzo.tinta?.[id]
            const tono = pintada != null ? TINTAS[pintada].h : tonoBase
            const favorita = favs.includes(id)
            const dx = corrida ? movimiento!.dx : 0
            const dy = corrida ? movimiento!.dy : 0
            return (
              <g key={id}>
                <path
                  d={codo(X_RAIZ + W_RAIZ, yRaiz + ALTO_RAIZ / 2, x + dx, y + dy + ALTO_SEC / 2)}
                  stroke={color(tono, 0.62, 0.13, 0.85)}
                  strokeWidth={2}
                  fill="none"
                />
                <g transform={corrida ? `translate(${dx} ${dy})` : undefined}>
                  {items.map(({ item, y: yi }, i) => (
                    <path
                      key={`l-${i}`}
                      d={codo(x + W_SEC, y + ALTO_SEC / 2, xItem, yi + FILA / 2)}
                      stroke={item.vacio ? "var(--rojo, #cb4433)" : color(tono, 0.62, 0.13, 0.6)}
                      strokeOpacity={item.vacio ? 0.6 : 1}
                      strokeWidth={1.5}
                      strokeDasharray={item.vacio ? "5 5" : undefined}
                      fill="none"
                    />
                  ))}
                  <g
                    onClick={() => { if (!editando && !recienMovido.current) onIr(id) }}
                    onPointerDown={secAbajo(id)}
                    onPointerMove={secMueve}
                    onPointerUp={secArriba(id)}
                    onPointerCancel={() => { moviendo.current = null; setMovimiento(null) }}
                    className={editando ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                  >
                    <rect
                      x={x} y={y} width={W_SEC} height={ALTO_SEC} rx={10}
                      fill={color(tono, 0.52, 0.14)}
                      stroke={marcada ? "var(--rojo, #cb4433)" : elegida === id ? color(tono, 0.4, 0.14) : "none"}
                      strokeWidth={2}
                    />
                    {favorita && (
                      <foreignObject x={x - 6} y={y - 6} width={16} height={16}>
                        <Star className="h-3.5 w-3.5 fill-kev-warning text-kev-warning" aria-label="Marcada" />
                      </foreignObject>
                    )}
                    <foreignObject x={x + 12} y={y} width={W_SEC - 24} height={ALTO_SEC}>
                      <div className="flex h-full items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate font-display text-[12.5px] font-bold text-white">
                          {ETIQUETA_SECCION[id]}
                        </span>
                        <span className={`shrink-0 rounded-full bg-white/20 px-1.5 text-[10.5px] tabular-nums text-white ${faltan ? "font-semibold" : ""}`}>
                          {items.length === 0 ? "0" : faltan ? `${items.length - faltan}/${items.length}` : items.length}
                        </span>
                      </div>
                    </foreignObject>
                  </g>

                  {items.map(({ item, y: yi }, i) => (
                    <g key={i} className="group/nodo">
                      <rect
                        x={xItem} y={yi} width={W_ITEM} height={FILA} rx={7}
                        className="fill-background"
                        stroke={item.vacio ? "var(--rojo, #cb4433)" : color(tono, 0.62, 0.13, 0.45)}
                        strokeOpacity={item.vacio ? 0.5 : 1}
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
                            <span onClick={() => onIr(id)} className="min-w-0 flex-1 cursor-pointer truncate text-[12px] text-foreground">
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
                    <foreignObject x={xItem} y={yPrimero + 4} width={W_ITEM} height={FILA - 8}>
                      <div className="flex h-full items-center text-[11.5px] text-muted-foreground/60">Sin definir todavía</div>
                    </foreignObject>
                  )}

                  {editando && (
                    <foreignObject x={xItem} y={ultimo + FILA + AIRE} width={W_ITEM} height={30}>
                      <button
                        type="button"
                        onClick={() => editar((d) => { agregar(d); return d })}
                        className="flex h-[28px] w-full items-center gap-1.5 rounded-[7px] border border-dashed px-2.5 text-[11.5px] transition-colors hover:bg-foreground/[0.04]"
                        style={{ borderColor: color(tono, 0.62, 0.13, 0.5), color: color(tono, 0.45, 0.13) }}
                      >
                        <Plus className="h-3 w-3" /> Agregar
                      </button>
                    </foreignObject>
                  )}
                </g>
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
