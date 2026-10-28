"use client"

// ──────────────────────────────────────────────────────────────
// La ficha de un personaje: quién es (datos reales), qué hace ahora en la
// simulación, su conciencia del día y su memoria compartida (del servidor,
// iguales para todos los visitantes), lo que recuerda de esta visita, a quién
// aprecia, y un chat.
//
// El chat le pide la respuesta a la IA con el contexto real del momento
// (hora, lugar, actividad, recuerdos, quién está cerca). Si la IA no
// responde, contesta una línea de su guion y se marca "guion": nunca se
// presenta una línea de guion como si fuera de la IA, ni al revés.
// ──────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react"
import { Crosshair, Send } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { leerClave } from "@/lib/clave"
import { LUGAR } from "../lugares"
import type { Departamento, Personaje } from "../tipos"
import type { Simulacion } from "../motor/simulacion"
import { leerInterior, motivoSinIa, pedir, type InteriorServidor, type RecuerdoServidor } from "./api"
import { Barra, EtiquetaFiccion, FOCO, Hoja, Retrato, Rotulo } from "./base"
import { cuandoFue, recortar, relojTexto } from "./formato"
import { detectarTema, lineaDeGuion } from "./guion"
import { useLatido } from "./latido"

const TIPO_RECUERDO: Record<RecuerdoServidor["tipo"], string> = {
  charla: "Charla",
  conversacion: "Conversación",
  consejo: "Consejo",
  noticia: "Noticia",
  trabajo: "Trabajo",
  diario: "Diario",
}

/** El día de hoy en Bolivia, "2026-10-28": la reflexión es de un día de Bolivia. */
const hoyEnBolivia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

/** "2026-10-27" → "27 oct.". */
const diaCorto = (dia: string) => {
  const t = Date.parse(`${dia}T12:00:00Z`)
  return Number.isFinite(t) ? new Intl.DateTimeFormat("es", { timeZone: "UTC", day: "numeric", month: "short" }).format(t) : dia
}

/** Un código al azar por charla: el servidor guarda UN recuerdo por charla y lo reescribe. */
const nuevaCharla = () => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface MensajeChat {
  de: "tu" | "el"
  texto: string
  guion?: boolean
  cita?: boolean
  nota?: string
}

export function Ficha({
  p,
  retrato,
  dep,
  sim,
  personajes,
  historial,
  setHistorial,
  decir,
  onSeguir,
  onDep,
  onCerrar,
}: {
  p: Personaje
  retrato?: string
  dep?: Departamento
  sim: Simulacion
  personajes: Record<string, Personaje>
  historial: MensajeChat[]
  setHistorial: (id: string, h: MensajeChat[]) => void
  decir: (id: string, texto: string, extra?: { cita?: boolean; guion?: boolean }) => void
  onSeguir: (id: string) => void
  onDep: (id: string) => void
  onCerrar: () => void
}) {
  useLatido(1000)
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const histRef = useRef(historial)
  histRef.current = historial
  const charlaRef = useRef<string>("")
  if (!charlaRef.current) charlaRef.current = nuevaCharla()
  // La conciencia y la memoria compartida: undefined mientras carga, null si no se pudo leer.
  const [interior, setInterior] = useState<InteriorServidor | null | undefined>(undefined)
  const interiorRef = useRef<AbortController | null>(null)
  const cargarInterior = useCallback(async () => {
    interiorRef.current?.abort()
    const ac = new AbortController()
    interiorRef.current = ac
    const r = await leerInterior(p.id, { signal: ac.signal })
    if (!ac.signal.aborted) setInterior((prev) => r ?? (prev === undefined ? null : prev))
  }, [p.id])

  useEffect(() => {
    void cargarInterior()
    return () => interiorRef.current?.abort()
  }, [cargarInterior])
  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest" })
  }, [historial.length, ocupado])

  const e = sim.pj[p.id]
  const lugar = e?.lugarId ? LUGAR[e.lugarId] : undefined
  const ahora = e ? `${e.actividad || "Sin actividad"}${lugar ? ` · ${lugar.nombre}` : e.destinoId ? " · de camino" : ""}` : "—"
  // La memoria viene con lo más reciente primero.
  const recuerdos = e ? e.memoria.slice(0, 5) : []
  const afinidades = e
    ? Object.entries(e.afinidad)
        .filter(([id, v]) => personajes[id] && v !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5)
    : []
  // La afinidad va de -100 a 100 (la misma escala que usa el servidor).
  const escala = 100

  async function enviar() {
    const msg = texto.trim()
    if (!msg || ocupado) return
    const previo = histRef.current
    const conPregunta: MensajeChat[] = [...previo, { de: "tu", texto: msg }]
    setHistorial(p.id, conPregunta)
    setTexto("")
    setOcupado(true)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const est = sim.pj[p.id]
    // Los topes son los del servidor (zod): un texto de más rechaza el pedido entero.
    const contexto = {
      hora: relojTexto(sim.reloj.dia, sim.reloj.minutos).slice(0, 20),
      lugar: est?.lugarId ?? "de camino",
      actividad: (est?.actividad ?? "").slice(0, 120),
      recuerdos: (est?.memoria ?? []).slice(0, 6).map((m) => m.texto.slice(0, 200)),
      presentes: est?.lugarId ? sim.presentes(est.lugarId).filter((id) => id !== p.id).slice(0, 30) : [],
    }
    const r = await pedir<{ texto?: string }>(
      {
        accion: "hablar",
        personajeId: p.id,
        mensaje: msg,
        historial: previo.slice(-10).map(({ de, texto }) => ({ de, texto: texto.slice(0, 600) })),
        contexto,
        charla: charlaRef.current,
      },
      { signal: ac.signal, clave: leerClave() },
    )
    if (ac.signal.aborted) return
    let respuesta: MensajeChat
    if (r.ok && typeof r.datos.texto === "string" && r.datos.texto.trim()) {
      respuesta = { de: "el", texto: r.datos.texto.trim() }
      // El servidor ya guardó el recuerdo de esta charla: se ve en su memoria.
      void cargarInterior()
    } else {
      const g = lineaDeGuion(p, detectarTema(msg))
      respuesta = { de: "el", texto: g.texto, cita: g.cita, guion: true, nota: motivoSinIa(r.ok ? 500 : r.status) }
    }
    setHistorial(p.id, [...conPregunta, respuesta])
    setOcupado(false)
    decir(p.id, respuesta.texto, { cita: respuesta.cita, guion: respuesta.guion })
    sim.recordar(p.id, `Un visitante le preguntó: «${recortar(msg, 70)}»`)
  }

  const cabecera = (
    <div className="flex items-center gap-3.5">
      <Retrato p={p} url={retrato} tam={64} />
      <div className="min-w-0">
        <h2 className="cb-cond text-[24px] font-bold uppercase leading-none tracking-[0.03em] text-white">{p.nombre}</h2>
        <p className="mt-1 text-[12px] text-white/55">
          {p.epoca} · {conPrime(p.rol)}
        </p>
      </div>
    </div>
  )

  return (
    <Hoja
      titulo={p.nombre}
      cabecera={cabecera}
      onCerrar={onCerrar}
      ancho={430}
      pie={
        <form
          className="flex items-center gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            void enviar()
          }}
        >
          <input
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder={`Escríbele a ${p.corto}`}
            aria-label={`Mensaje para ${p.nombre}`}
            maxLength={400}
            className={`h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 text-[16px] text-white placeholder:text-white/35 md:text-[14px] ${FOCO}`}
          />
          <button
            type="submit"
            disabled={ocupado || !texto.trim()}
            aria-label="Enviar"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-35 ${FOCO}`}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <EtiquetaFiccion p={p} />
        {dep && (
          <button
            type="button"
            onClick={() => onDep(dep.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white/85 hover:border-white/35 ${FOCO}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: dep.color }} aria-hidden />
            {conPrime(dep.nombre, false)}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSeguir(p.id)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white/85 hover:border-white/35 ${FOCO}`}
        >
          <Crosshair className="h-3 w-3" /> Seguir
        </button>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-white/80">{conPrime(p.bio)}</p>

      <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
        <Rotulo>Ahora</Rotulo>
        <p className="mt-1 text-[13px] font-semibold text-white">{conPrime(ahora)}</p>
      </div>

      {interior?.conciencia && <Conciencia c={interior.conciencia} p={p} personajes={personajes} />}

      {interior && (
        <div className="mt-4">
          <Rotulo>Memoria compartida</Rotulo>
          <p className="mb-2 mt-1 text-[11px] leading-snug text-white/40">Lo que vivió en esta casa con todos los visitantes. Sin datos personales.</p>
          {interior.recuerdos.length === 0 ? (
            <p className="text-[12px] text-white/45">Todavía no hay recuerdos guardados.</p>
          ) : (
            <ul className="space-y-1.5">
              {interior.recuerdos.map((m, i) => (
                <li key={`${m.creado}-${i}`} className="text-[12px] leading-snug text-white/70">
                  <span className="cb-cond mr-1.5 font-semibold text-white/40">{cuandoFue(m.creado)}</span>
                  <span className="mr-1.5 inline-block rounded-full bg-white/[0.07] px-1.5 py-px align-[1px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/55">
                    {TIPO_RECUERDO[m.tipo] ?? m.tipo}
                  </span>
                  {conPrime(m.texto)}
                  {m.con.length > 0 && <span className="text-white/35"> · {conQuienes(m.con, personajes)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recuerdos.length > 0 && (
        <div className="mt-4">
          <Rotulo className="mb-1.5">En esta visita</Rotulo>
          <ul className="space-y-1">
            {recuerdos.map((m, i) => (
              <li key={i} className="text-[12px] leading-snug text-white/65">
                <span className="cb-cond mr-1.5 font-semibold text-white/40">{m.cuando}</span>
                {conPrime(m.texto)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {afinidades.length > 0 && (
        <div className="mt-4">
          <Rotulo className="mb-1.5">Afinidades</Rotulo>
          <ul className="space-y-1.5">
            {afinidades.map(([id, v]) => (
              <li key={id} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 truncate text-[12px] font-semibold text-white/80">{personajes[id].corto}</span>
                <Barra valor={Math.abs(v) / escala} color={v >= 0 ? "#6fd27c" : "#ff6b6b"} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <Rotulo className="mb-2">Conversación</Rotulo>
        {historial.length === 0 && !ocupado && (
          <p className="text-[12px] text-white/45">Pregúntale algo. Responde con lo que sabe y lo que está viviendo en la casa.</p>
        )}
        <ul className="space-y-2">
          {historial.map((m, i) => (
            <li key={i} className={`flex ${m.de === "tu" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] rounded-[16px] px-3.5 py-2 text-[13px] leading-relaxed ${
                  m.de === "tu" ? "rounded-br-[6px] bg-white text-black" : "rounded-bl-[6px] border border-white/10 bg-white/[0.06] text-white"
                }`}
                style={m.de === "el" ? { borderLeft: `3px solid ${p.color}` } : undefined}
              >
                {m.de === "el" ? conPrime(m.texto) : m.texto}
                {(m.guion || m.cita) && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {m.guion && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/70">guion</span>}
                    {m.cita && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-200">cita</span>}
                  </span>
                )}
                {m.nota && <span className="mt-1 block text-[10.5px] text-white/40">{m.nota}</span>}
              </div>
            </li>
          ))}
          {ocupado && (
            <li className="flex justify-start">
              <div className="rounded-[16px] rounded-bl-[6px] border border-white/10 bg-white/[0.06] px-3.5 py-2.5" aria-label="Escribiendo">
                <span className="cb-puntos" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </li>
          )}
        </ul>
        <div ref={finRef} />
      </div>
    </Hoja>
  )
}

/** "con Musk, Thiel y 4 más". */
function conQuienes(ids: string[], personajes: Record<string, Personaje>) {
  const nombres = ids.map((id) => personajes[id]?.corto).filter((n): n is string => !!n)
  if (nombres.length <= 3) return `con ${nombres.join(", ").replace(/, ([^,]*)$/, " y $1")}`
  return `con ${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`
}

/** Su estado interior: lo escribe su reflexión de cada día, a partir de lo que vivió. */
function Conciencia({ c, p, personajes }: { c: NonNullable<InteriorServidor["conciencia"]>; p: Personaje; personajes: Record<string, Personaje> }) {
  const deHoy = c.dia === hoyEnBolivia()
  const opiniones = Object.entries(c.opiniones)
    .filter(([id, o]) => personajes[id] && Number.isFinite(o?.valor) && o.valor !== 0)
    .sort((a, b) => Math.abs(b[1].valor) - Math.abs(a[1].valor))
    .slice(0, 3)
  const etiqueta = "text-[10px] font-bold uppercase tracking-[0.16em] text-white/40"
  return (
    <section className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-3" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Conciencia</Rotulo>
        <span className="text-[10.5px] font-semibold text-white/35">{deHoy ? "Hoy" : `Reflexión del ${diaCorto(c.dia)}`}</span>
      </div>
      {c.animo && (
        <p className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white" style={{ background: `${p.color}33`, boxShadow: `inset 0 0 0 1px ${p.color}66` }}>
          {c.animo}
        </p>
      )}
      {c.meta && (
        <div className="mt-2.5">
          <p className={etiqueta}>{deHoy ? "Meta de hoy" : "Su meta"}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/85">{conPrime(c.meta)}</p>
        </div>
      )}
      {c.pensamiento && (
        <div className="mt-2.5">
          <p className={etiqueta}>Lo que piensa</p>
          <p className="mt-0.5 text-[12.5px] italic leading-snug text-white/85">«{conPrime(c.pensamiento)}»</p>
        </div>
      )}
      {c.diario && (
        <div className="mt-3 border-t border-white/[0.07] pt-2.5">
          <p className={etiqueta}>{deHoy ? "Su diario de hoy" : "Su diario"}</p>
          <p className="mt-1 text-[14.5px] leading-[1.5] text-white/80" style={{ fontFamily: "var(--font-serif-display), Georgia, serif" }}>
            {conPrime(c.diario)}
          </p>
        </div>
      )}
      {opiniones.length > 0 && (
        <div className="mt-3 border-t border-white/[0.07] pt-2.5">
          <p className={etiqueta}>Lo que opina</p>
          <ul className="mt-1 space-y-1">
            {opiniones.map(([id, o]) => (
              <li key={id} className="text-[12px] leading-snug text-white/70">
                <span className="font-semibold text-white/85">{personajes[id].corto}</span>{" "}
                <span className={o.valor > 0 ? "font-bold text-[#6fd27c]" : "font-bold text-[#ff6b6b]"}>
                  {o.valor > 0 ? "+" : ""}
                  {o.valor}
                </span>
                {o.frase && <span> · {conPrime(o.frase)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
