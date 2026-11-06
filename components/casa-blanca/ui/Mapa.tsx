"use client"

// ──────────────────────────────────────────────────────────────
// El mapa: el corte de la casa de arriba hacia abajo (superficie, tres
// subsuelos y la ciudad), unido por el ascensor. Cada nivel muestra sus
// lugares como botones; los subsuelos, con la grilla real de celdas y sus
// pasillos. Tocar un lugar lleva la cámara (por el ascensor si hace falta) y
// abre su panel. Arriba, un buscador de lugares, departamentos y residentes.
//
// Todo sale de lugares.ts y navegacion.ts: si un lugar cambia allí, el mapa
// cambia solo. Los números (quién está dónde) son los de la simulación.
// ──────────────────────────────────────────────────────────────

import { useMemo, useState } from "react"
import { ArrowDownUp, ChevronRight, MapPin, Search, Users } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import type { Simulacion } from "../motor/simulacion"
import { CELDAS, LUGAR, NODO } from "../lugares"
import { PLANTAS } from "../plantas"
import {
  NIVEL_CONTENIDO,
  NIVEL_CORTO,
  ORDEN_NIVELES,
  comoLlegar,
  dentroDe,
  dondeEsta,
  edificioDe,
  lugaresDe,
  nombreCorto,
  profundidad,
} from "../navegacion"
import type { Departamento, Lugar, NivelId, Personaje } from "../tipos"
import { Campo, FOCO, Hoja, Retrato } from "./base"
import { useLatido } from "./latido"

const DORADO = "#e3b866"

/** Sin tildes y en minúsculas: "jesus" encuentra a "Jesús". */
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export interface PropsMapa {
  nivel: NivelId
  sim: Simulacion
  personajes: Personaje[]
  deptos: Record<string, Departamento>
  retratos: Record<string, string>
  onIrLugar: (lugarId: string) => void
  onIrPersonaje: (id: string) => void
  onNivel: (n: NivelId) => void
  onCerrar: () => void
}

export function Mapa(props: PropsMapa) {
  useLatido(1500)
  const [q, setQ] = useState("")
  const porLugar = useMemo(() => Object.fromEntries(Object.values(props.deptos).map((d) => [d.lugarId, d])), [props.deptos])
  const pjPorId = useMemo(() => Object.fromEntries(props.personajes.map((p) => [p.id, p])), [props.personajes])

  // Cuántos residentes hay en cada nivel y en cada lugar, ahora.
  const enNivel: Record<string, number> = {}
  const enLugar: Record<string, number> = {}
  for (const p of props.personajes) {
    const e = props.sim.pj[p.id]
    if (!e) continue
    enNivel[e.nivel] = (enNivel[e.nivel] ?? 0) + 1
    if (e.lugarId) enLugar[e.lugarId] = (enLugar[e.lugarId] ?? 0) + 1
  }

  const cabecera = (
    <div>
      <h2 className="cb-cond flex items-center gap-2 text-[24px] font-bold uppercase leading-none tracking-[0.04em] text-white">
        <MapPin className="h-5 w-5 text-[#e3b866]" />
        Mapa
      </h2>
      <p className="mt-1 text-[12px] text-white/55">El corte de la casa, de arriba abajo. Toca un lugar y la cámara va.</p>
    </div>
  )

  return (
    <Hoja titulo="Mapa" cabecera={cabecera} onCerrar={props.onCerrar} ancho={540}>
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <div className="[&_input]:pl-10">
            <Campo valor={q} onCambio={setQ} etiqueta="Buscar un lugar, un departamento o un residente" placeholder="Busca un lugar, un departamento o un residente" max={60} />
          </div>
        </div>
      </div>
      {q.trim() ? (
        <Resultados q={q} {...props} porLugar={porLugar} />
      ) : (
        <ol className="relative">
          {ORDEN_NIVELES.map((n, i) => (
            <li key={n} className="relative pb-5 pl-7 last:pb-1">
              {/* El ascensor: la línea que une los niveles. */}
              {i < ORDEN_NIVELES.length - 1 && <span className="absolute bottom-0 left-[10px] top-3 w-[2px] rounded-full bg-gradient-to-b from-[#e3b866] to-[#e3b866]/30" aria-hidden />}
              <span
                className="absolute left-[3px] top-[3px] grid h-4 w-4 place-items-center rounded-[4px] border border-black/60 bg-[#e3b866] shadow-[0_0_12px_-2px_rgba(227,184,102,0.8)]"
                aria-hidden
              >
                <ArrowDownUp className="h-2.5 w-2.5 text-black/80" />
              </span>
              <CabeceraNivel n={n} actual={props.nivel === n} cuantos={enNivel[n] ?? 0} onNivel={() => props.onNivel(n)} />
              <div className="mt-2.5">
                {n === "superficie" && <Superficie onIr={props.onIrLugar} enLugar={enLugar} />}
                {(n === "n1" || n === "n2" || n === "n3") && (
                  <Plano nivel={n} porLugar={porLugar} pjPorId={pjPorId} retratos={props.retratos} enLugar={enLugar} onIr={props.onIrLugar} />
                )}
                {n === "ciudad" && <Ciudad onIr={props.onIrLugar} enLugar={enLugar} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Hoja>
  )
}

function CabeceraNivel({ n, actual, cuantos, onNivel }: { n: NivelId; actual: boolean; cuantos: number; onNivel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="cb-cond shrink-0 rounded-full bg-white/[0.1] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-white/70">{profundidad(n)}</span>
      <button type="button" onClick={onNivel} className={`group min-w-0 flex-1 rounded-[10px] text-left ${FOCO}`} aria-label={`Ir al nivel ${NIVEL_CORTO[n]}`}>
        <span className="cb-cond block truncate text-[17px] font-bold uppercase leading-tight tracking-[0.04em] text-white group-hover:text-[#e3b866]">
          {NIVEL_CORTO[n]}
          <ChevronRight className="ml-0.5 inline h-4 w-4 align-[-2px] opacity-40 group-hover:opacity-100" />
        </span>
        <span className="block truncate text-[11.5px] text-white/50">{NIVEL_CONTENIDO[n]}</span>
      </button>
      {actual && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-black">Estás aquí</span>}
      <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold tabular-nums text-white/55" title={`${cuantos} residentes en este nivel`}>
        <Users className="h-3.5 w-3.5" />
        {cuantos}
      </span>
    </div>
  )
}

/** Un lugar como botón: nombre, quiénes hay y, si se pide, una línea de "dónde". */
function BotonLugar({ l, cuantos, onIr, sub, color }: { l: Lugar | { id: string; nombre: string }; cuantos?: number; onIr: (id: string) => void; sub?: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={() => onIr(l.id)}
      className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-[12px] border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-left transition-colors hover:border-white/30 hover:bg-white/[0.09] ${FOCO}`}
    >
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-bold text-white">{l.nombre}</span>
        {sub && <span className="block truncate text-[10.5px] text-white/45">{sub}</span>}
      </span>
      {!!cuantos && (
        <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-white/[0.1] px-1.5 text-[10.5px] font-bold tabular-nums text-white/80">
          <Users className="h-3 w-3" />
          {cuantos}
        </span>
      )}
    </button>
  )
}

/** Las salas de un edificio por planta, de arriba hacia abajo (como el corte); las que no tienen planta, al final. */
function porPlanta(ls: Lugar[]): Array<[string | null, Lugar[]]> {
  const plantaDe = (l: Lugar) => l.planta ?? NODO[l.acceso]?.planta ?? null
  const out: Array<[string | null, Lugar[]]> = []
  for (const p of PLANTAS) {
    const salas = ls.filter((l) => plantaDe(l) === p.id)
    if (salas.length) out.push([p.nombre, salas])
  }
  const sin = ls.filter((l) => !plantaDe(l))
  if (sin.length) out.push([null, sin])
  return out
}

function Superficie({ onIr, enLugar }: { onIr: (id: string) => void; enLugar: Record<string, number> }) {
  const lugares = lugaresDe("superficie")
  const afuera = lugares.filter((l) => !l.interior)
  const edificios = new Map<string, Lugar[]>()
  for (const l of lugares) {
    const e = edificioDe(l)
    if (e) edificios.set(e, [...(edificios.get(e) ?? []), l])
  }
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onIr("ascensor")}
        className={`flex w-full items-center gap-3 rounded-[14px] border border-[#e3b866]/40 bg-[#e3b866]/[0.1] px-3 py-2 text-left transition-colors hover:bg-[#e3b866]/[0.18] ${FOCO}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#e3b866] text-black">
          <ArrowDownUp className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold text-white">Ascensor a los subsuelos</span>
          <span className="block text-[11px] text-white/55">Pabellón de vidrio junto al Pórtico Sur</span>
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-white/40" />
      </button>
      <div className="flex flex-wrap gap-1.5">
        {afuera.map((l) => (
          <BotonLugar key={l.id} l={l} cuantos={enLugar[l.id]} onIr={onIr} />
        ))}
      </div>
      {[...edificios].map(([e, ls]) => (
        <details key={e} className="group rounded-[14px] border border-white/[0.07] bg-white/[0.02]">
          <summary className={`flex cursor-pointer list-none items-center gap-2 rounded-[14px] px-3 py-2 text-[12.5px] font-bold text-white/85 hover:bg-white/[0.04] ${FOCO}`}>
            <ChevronRight className="h-3.5 w-3.5 text-white/45 transition-transform group-open:rotate-90" />
            {dentroDe(e)}
            <span className="ml-auto text-[11px] font-semibold text-white/40">
              {ls.length} {ls.length === 1 ? "sala" : "salas"}
            </span>
          </summary>
          {porPlanta(ls).map(([planta, salas]) => (
            <div key={planta ?? "-"} className="px-3 pb-2.5 pt-1 last:pb-3">
              {planta && <p className="cb-cond mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e3b866]/80">{planta}</p>}
              <div className="flex flex-wrap gap-1.5">
                {salas.map((l) => (
                  <BotonLugar key={l.id} l={l} cuantos={enLugar[l.id]} onIr={onIr} />
                ))}
              </div>
            </div>
          ))}
        </details>
      ))}
    </div>
  )
}

/**
 * Un subsuelo como es: 4 x 3 celdas con el norte arriba, el núcleo de
 * ascensores arriba al centro y los tres pasillos entre las filas.
 */
function Plano({
  nivel,
  porLugar,
  pjPorId,
  retratos,
  enLugar,
  onIr,
}: {
  nivel: "n1" | "n2" | "n3"
  porLugar: Record<string, Departamento>
  pjPorId: Record<string, Personaje>
  retratos: Record<string, string>
  enLugar: Record<string, number>
  onIr: (id: string) => void
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-black/25 p-2">
      <div className="relative mb-1 flex items-center justify-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#e3b866]">
        {/* El plano va con el norte arriba, como el radar. */}
        <span className="cb-cond absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-[0.1em] text-white/40" aria-hidden>
          N ↑
        </span>
        <ArrowDownUp className="h-3 w-3" />
        Ascensores
      </div>
      {CELDAS[nivel].map((fila, r) => (
        <div key={r}>
          <div className="my-1 flex items-center gap-2" aria-hidden>
            <span className="h-px flex-1 bg-[#e3b866]/25" />
            <span className="cb-cond text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">Pasillo {r + 1}</span>
            <span className="h-px flex-1 bg-[#e3b866]/25" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {fila.map((lugarId) => {
              const d = porLugar[lugarId]
              const lider = d ? pjPorId[d.liderId] : undefined
              const n = enLugar[lugarId] ?? 0
              const color = d?.color ?? DORADO
              return (
                <button
                  key={lugarId}
                  type="button"
                  onClick={() => onIr(lugarId)}
                  aria-label={`${LUGAR[lugarId]?.nombre ?? lugarId}${lider ? `, de ${lider.nombre}` : ""}. ${n} ${n === 1 ? "residente" : "residentes"} ahora`}
                  className={`group relative flex min-h-[78px] flex-col gap-1 overflow-hidden rounded-[11px] border p-1.5 text-left transition-colors ${FOCO}`}
                  style={{ borderColor: `${color}55`, background: `linear-gradient(160deg, ${color}2e, ${color}0d 70%)` }}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} aria-hidden />
                  <span className="flex items-center gap-1 pl-0.5">
                    {lider ? <Retrato p={lider} url={retratos[lider.id]} tam={22} /> : <span className="h-[22px]" />}
                    {n > 0 && (
                      <span className="ml-auto flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 text-[10px] font-bold tabular-nums text-white">
                        <Users className="h-2.5 w-2.5" />
                        {n}
                      </span>
                    )}
                  </span>
                  <span lang="es" className="line-clamp-3 hyphens-auto break-words pl-0.5 text-[10px] font-extrabold leading-[1.15] text-white sm:line-clamp-2 sm:text-[11px]">{conPrime(nombreCorto(lugarId), false)}</span>
                  {lider && <span className="truncate pl-0.5 text-[10px] font-semibold leading-none text-white/55">{lider.corto}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Ciudad({ onIr, enLugar }: { onIr: (id: string) => void; enLugar: Record<string, number> }) {
  const lugares = lugaresDe("ciudad")
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {lugares.map((l) => {
        const pasos = comoLlegar(l.id)
        return <BotonLugar key={l.id} l={l} cuantos={enLugar[l.id]} onIr={onIr} sub={pasos[pasos.length - 1]?.texto} />
      })}
    </div>
  )
}

/** Búsqueda en lugares (incluidos los departamentos por su nombre y su líder) y residentes. */
function Resultados(props: PropsMapa & { q: string; porLugar: Record<string, Departamento> }) {
  const q = normal(props.q.trim())
  const lugares = ORDEN_NIVELES.flatMap((n) => lugaresDe(n)).filter((l) => {
    const d = props.porLugar[l.id]
    const lider = d ? props.personajes.find((p) => p.id === d.liderId) : undefined
    return [l.nombre, d?.nombre, lider?.nombre, lider?.corto].some((t) => t && normal(t).includes(q))
  })
  const gente = props.personajes.filter((p) => [p.nombre, p.corto, p.rol].some((t) => normal(t).includes(q)))
  if (!lugares.length && !gente.length) return <p className="py-6 text-center text-[13px] text-white/50">Nada con «{props.q.trim()}».</p>
  return (
    <div className="space-y-4">
      {gente.length > 0 && (
        <section>
          <h3 className="cb-cond mb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Residentes</h3>
          <ul className="space-y-1">
            {gente.slice(0, 8).map((p) => {
              const e = props.sim.pj[p.id]
              const donde = e ? dondeEsta(e) : null
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => props.onIrPersonaje(p.id)} className={`flex w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left hover:bg-white/[0.06] ${FOCO}`}>
                    <Retrato p={p} url={props.retratos[p.id]} tam={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-white">{p.nombre}</span>
                      <span className="block truncate text-[11px] text-white/50">{donde?.texto}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black">Ir</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {lugares.length > 0 && (
        <section>
          <h3 className="cb-cond mb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Lugares</h3>
          <ul className="space-y-1">
            {lugares.slice(0, 12).map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => props.onIrLugar(l.id)} className={`flex w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left hover:bg-white/[0.06] ${FOCO}`}>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: props.porLugar[l.id]?.color ?? DORADO }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-white">{conPrime(l.nombre, false)}</span>
                    <span className="block truncate text-[11px] text-white/50">
                      {NIVEL_CORTO[l.nivel]}
                      {edificioDe(l) ? ` · ${dentroDe(edificioDe(l)!)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black">Ir</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
