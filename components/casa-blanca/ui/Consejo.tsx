"use client"

// ──────────────────────────────────────────────────────────────
// El consejo: un tema y de 2 a 6 participantes van a la Sala de guerra
// (Subsuelo 2) y debaten. Las líneas las escribe la IA; si no responde, el
// guion de cada uno. Mientras dura, este panel muestra la transcripción.
// ──────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import { Shuffle } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import type { Personaje } from "../tipos"
import { BotonFuerte, Campo, FOCO, Hoja, Modal, Retrato, Rotulo } from "./base"

export const PROPUESTAS_CONSEJO = [
  "¿Cómo se construye un imperio empezando con 10 dólares?",
  "¿Cómo llevamos PRIME a Silicon Valley?",
  "¿Cómo llevamos PRIME a mil millones?",
  "¿Cómo llegamos al Mercedes antes del 30 de diciembre?",
  "¿Debería gobernar una inteligencia artificial?",
  "¿Qué es una buena vida?",
]

export const MIN_CONSEJO = 2
export const MAX_CONSEJO = 6

export interface SesionConsejo {
  convId: string
  tema: string
  ids: string[]
  lineas: Array<{ id: string; texto: string; cita?: boolean }>
  estado: "escribiendo" | "en-curso" | "terminado"
  guion: boolean
  nota?: string
}

function alAzar(ids: string[], n: number) {
  const xs = [...ids]
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs.slice(0, n)
}

export function ConvocarConsejo({
  personajes,
  onConvocar,
  onCerrar,
}: {
  personajes: Personaje[]
  onConvocar: (tema: string, ids: string[]) => void
  onCerrar: () => void
}) {
  const [tema, setTema] = useState("")
  const [ids, setIds] = useState<string[]>(() => alAzar(personajes.map((p) => p.id), 4))
  const alternar = (id: string) =>
    setIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= MAX_CONSEJO ? xs : [...xs, id]))
  const valido = ids.length >= MIN_CONSEJO && ids.length <= MAX_CONSEJO

  return (
    <Modal titulo="Convocar al consejo" onCerrar={onCerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valido) return
          onConvocar(tema.trim() || PROPUESTAS_CONSEJO[0], ids)
        }}
      >
        <Rotulo className="mb-2 mt-1">Tema</Rotulo>
        <Campo valor={tema} onCambio={setTema} etiqueta="Tema del consejo" placeholder="Escribe una pregunta para el consejo" max={160} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROPUESTAS_CONSEJO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTema(t)}
              aria-pressed={tema === t}
              className={`rounded-full border px-3 py-1.5 text-left text-[12px] font-semibold transition-colors ${FOCO} ${
                tema === t ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:border-white/30 hover:text-white"
              }`}
            >
              {conPrime(t, false)}
            </button>
          ))}
        </div>

        <div className="mb-2 mt-5 flex items-center justify-between">
          <Rotulo>
            Participantes · {ids.length} de {MAX_CONSEJO}
          </Rotulo>
          <button
            type="button"
            onClick={() => setIds(alAzar(personajes.map((p) => p.id), 4))}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white/60 hover:text-white ${FOCO}`}
          >
            <Shuffle className="h-3 w-3" /> Al azar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {personajes.map((p) => {
            const on = ids.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => alternar(p.id)}
                aria-pressed={on}
                disabled={!on && ids.length >= MAX_CONSEJO}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-35 ${FOCO} ${
                  on ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:border-white/30"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.corto}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-white/45">Entre {MIN_CONSEJO} y {MAX_CONSEJO}. Van a la Sala de guerra, en el Subsuelo 2.</p>
        <div className="mt-5 flex justify-end">
          <BotonFuerte tipo="submit" disabled={!valido}>
            Convocar
          </BotonFuerte>
        </div>
      </form>
    </Modal>
  )
}

export function TranscripcionConsejo({
  sesion,
  personajes,
  retratos,
  onCerrar,
}: {
  sesion: SesionConsejo
  personajes: Record<string, Personaje>
  retratos: Record<string, string>
  onCerrar: () => void
}) {
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "nearest" })
  }, [sesion.lineas.length])
  const cabecera = (
    <div>
      <div className="cb-cond text-[11px] font-bold uppercase tracking-[0.24em] text-amber-300">Consejo · Sala de guerra</div>
      <h2 className="mt-1 text-[17px] font-bold leading-snug text-white">{conPrime(sesion.tema)}</h2>
      <div className="mt-2 flex -space-x-2">
        {sesion.ids.map((id) => personajes[id] && <Retrato key={id} p={personajes[id]} url={retratos[id]} tam={30} />)}
      </div>
    </div>
  )
  return (
    <Hoja titulo="Consejo" cabecera={cabecera} onCerrar={onCerrar} ancho={430}>
      {sesion.guion && (
        <p className="mb-3 rounded-[12px] bg-white/[0.06] px-3 py-2 text-[11.5px] text-white/60">
          <b className="mr-1 uppercase tracking-[0.1em] text-white/80">Guion.</b>
          {sesion.nota ?? "La IA no respondió: debaten con su guion."}
        </p>
      )}
      <ul className="space-y-2.5">
        {sesion.lineas.map((l, i) => {
          const p = personajes[l.id]
          return (
            <li key={i} className="cb-entra-suave text-[13px] leading-relaxed text-white/85">
              <b style={{ color: p?.color ?? "#fff" }}>{p?.corto ?? l.id}:</b> {conPrime(l.texto)}
              {l.cita && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">cita</span>}
            </li>
          )
        })}
      </ul>
      {sesion.estado !== "terminado" && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-white/50">
          <span className="cb-puntos" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {sesion.estado === "escribiendo" ? "Preparan sus argumentos…" : "Debatiendo…"}
        </p>
      )}
      {sesion.estado === "terminado" && <p className="mt-3 text-[12px] font-semibold text-white/50">Fin de la sesión.</p>}
      <div ref={fin} />
    </Hoja>
  )
}
