"use client"

// ──────────────────────────────────────────────────────────────
// Panel de un departamento: su líder, su misión, la grilla de sus 100
// puestos pintada con el estado REAL (entregado = hay un entregable guardado
// de ese puesto) y sus entregables.
//
// "Trabajar" es solo de Kev: pide la clave (lib/clave), la manda como
// Authorization: Bearer y el servidor decide. Un 401/403 se explica sin
// borrar la clave guardada (puede ser la del equipo, que sí abre el manual).
// ──────────────────────────────────────────────────────────────

import { useMemo, useState } from "react"
import { Check, ChevronDown, KeyRound, Lock, Play } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import { guardarClave, leerClave } from "@/lib/clave"
import type { Agente, Departamento, Entregable, EstadoPuesto, Objetivo, Personaje } from "../tipos"
import { BotonFuerte, Campo, Chip, FOCO, Hoja, Retrato, Rotulo } from "./base"
import { haceCuanto } from "./formato"

export type ResultadoTrabajo = { ok: true; cuantos: number; aviso?: string } | { ok: false; status: number; error: string }

const COLOR_ESTADO: Record<EstadoPuesto, string> = { libre: "rgba(255,255,255,0.1)", trabajando: "", entregado: "#6fd27c" }
const NOMBRE_ESTADO: Record<EstadoPuesto, string> = { libre: "libre", trabajando: "trabajando", entregado: "entregado" }

export function PanelDepartamento({
  dep,
  lider,
  retrato,
  agentes,
  estados,
  entregables,
  objetivos,
  puestoInicial,
  trabajando,
  onTrabajar,
  onLider,
  onCerrar,
}: {
  dep: Departamento
  lider?: Personaje
  retrato?: string
  agentes: Agente[]
  estados: EstadoPuesto[]
  entregables: Entregable[]
  objetivos: Objetivo[]
  puestoInicial?: number
  trabajando: boolean
  onTrabajar: (objetivoId: string, clave: string) => Promise<ResultadoTrabajo>
  onLider: (id: string) => void
  onCerrar: () => void
}) {
  const propios = useMemo(() => {
    const suyos = objetivos.filter((o) => o.departamentos.includes(dep.id))
    return suyos.length ? suyos : objetivos
  }, [objetivos, dep.id])
  const [objetivoId, setObjetivoId] = useState(propios[0]?.id ?? "")
  const [puesto, setPuesto] = useState<number | null>(puestoInicial ?? null)
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [clave, setClave] = useState("")
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  const cuenta = useMemo(() => {
    const c = { libre: 0, trabajando: 0, entregado: 0 }
    for (const e of estados) c[e]++
    return c
  }, [estados])
  const tareas = dep.tareas.filter((t) => t.objetivoId === objetivoId)
  const ag = puesto != null ? agentes[puesto] : null

  async function correr(k: string) {
    setMensaje(null)
    const r = await onTrabajar(objetivoId, k)
    if (r.ok) {
      const base = r.cuantos ? `Listo: ${r.cuantos} entregable${r.cuantos === 1 ? "" : "s"} nuevo${r.cuantos === 1 ? "" : "s"}.` : "Terminaron, pero no hubo entregables nuevos."
      setMensaje({ tipo: "ok", texto: r.aviso ? `${base} ${r.aviso}` : base })
    } else if (r.status === 0 && !r.error) {
      return
    } else if (r.status === 401 || r.status === 403) {
      setMensaje({ tipo: "error", texto: "Esa clave no abre el trabajo: solo Kev pone a trabajar a los departamentos. La clave guardada no se borró." })
    } else {
      setMensaje({ tipo: "error", texto: r.error || "No se pudo completar el trabajo." })
    }
  }

  function trabajar() {
    const k = leerClave()
    if (!k) {
      setPidiendoClave(true)
      return
    }
    void correr(k)
  }

  const cabecera = (
    <div>
      <div className="cb-cond text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: dep.color }}>
        Departamento · 100 agentes
      </div>
      <h2 className="cb-cond mt-1 text-[26px] font-bold uppercase leading-none tracking-[0.02em] text-white">{conPrime(dep.nombre)}</h2>
    </div>
  )

  return (
    <Hoja titulo={dep.nombre} cabecera={cabecera} onCerrar={onCerrar} ancho={460}>
      {lider && (
        <button
          type="button"
          onClick={() => onLider(lider.id)}
          className={`flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-left hover:bg-white/[0.07] ${FOCO}`}
        >
          <Retrato p={lider} url={retrato} tam={44} />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Líder</span>
            <span className="block truncate text-[14px] font-bold text-white">{lider.nombre}</span>
          </span>
        </button>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-white/80">{conPrime(dep.mision)}</p>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between gap-2">
          <Rotulo>Los 100 puestos</Rotulo>
          <span className="text-[11px] tabular-nums text-white/55">
            <b className="text-[#6fd27c]">{cuenta.entregado}</b> entregados · <b style={{ color: dep.color }}>{cuenta.trabajando}</b> trabajando · {cuenta.libre} libres
          </span>
        </div>
        <div
          className="grid grid-cols-10 gap-[3px] rounded-2xl border border-white/[0.07] bg-black/30 p-2"
          role="img"
          aria-label={`Grilla de 100 puestos: ${cuenta.entregado} entregados, ${cuenta.trabajando} trabajando, ${cuenta.libre} libres.`}
          onMouseLeave={() => setPuesto(puestoInicial ?? null)}
        >
          {estados.map((e, i) => (
            <span
              key={i}
              onMouseEnter={() => setPuesto(i)}
              onClick={() => setPuesto(i)}
              className={`aspect-square rounded-[4px] transition-transform duration-150 ${e === "trabajando" ? "cb-trabaja" : ""} ${puesto === i ? "scale-125 ring-2 ring-white" : ""}`}
              style={{ background: e === "trabajando" ? dep.color : COLOR_ESTADO[e] }}
              title={agentes[i] ? `${agentes[i].nombre} · ${agentes[i].rol}` : undefined}
            />
          ))}
        </div>
        {/* Etiqueta tipo reel del puesto bajo el cursor. */}
        <div className="mt-2 min-h-[52px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          {ag ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-bold text-white">
                  {ag.nombre} · <span className="font-semibold text-white/70">{ag.rol}</span>
                </span>
                <span className="cb-cond shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Puesto {String((puesto ?? 0) + 1).padStart(2, "0")} · {NOMBRE_ESTADO[estados[puesto ?? 0]]}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${estados[puesto ?? 0] === "trabajando" ? "cb-barra-viva w-1/3" : estados[puesto ?? 0] === "entregado" ? "w-full" : "w-0"}`}
                  style={{ background: estados[puesto ?? 0] === "entregado" ? "#6fd27c" : dep.color }}
                />
              </div>
            </>
          ) : (
            <p className="text-[12px] text-white/45">Pasa el cursor por un puesto para ver quién es.</p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Rotulo className="mb-2">Poner a trabajar</Rotulo>
        <div className="flex flex-wrap gap-1.5">
          {propios.map((o) => (
            <Chip key={o.id} activo={o.id === objetivoId} onClick={() => setObjetivoId(o.id)}>
              {conPrime(o.titulo, false)}
            </Chip>
          ))}
        </div>
        {tareas.length > 0 && (
          <ol className="mt-3 space-y-1" aria-label="Tareas de este objetivo">
            {tareas.slice(0, 8).map((t, i) => {
              // Hecha = hay un entregable guardado con el título exacto de la tarea (así lo guarda el servidor).
              const hecha = entregables.some((e) => e.objetivoId === objetivoId && e.titulo.trim() === t.titulo)
              return (
                <li key={i} className={`flex gap-2 text-[12px] leading-snug ${hecha ? "text-white/45" : "text-white/70"}`}>
                  <span className={`cb-cond w-4 shrink-0 font-bold ${hecha ? "text-[#6fd27c]" : "text-white/35"}`}>{hecha ? <Check className="mt-0.5 h-3.5 w-3.5" aria-label="Entregada" /> : `${i + 1}.`}</span>
                  <span>
                    <b className={hecha ? "font-semibold text-white/55 line-through decoration-white/30" : "text-white/90"}>{conPrime(t.titulo)}</b>{" "}
                    <span className="text-white/45">· {t.rol}</span>
                  </span>
                </li>
              )
            })}
            {tareas.length > 8 && <li className="pl-6 text-[11px] text-white/40">y {tareas.length - 8} más</li>}
          </ol>
        )}
        {pidiendoClave ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(ev) => {
              ev.preventDefault()
              const k = clave.trim()
              if (!k) return
              guardarClave(k)
              setPidiendoClave(false)
              setClave("")
              void correr(k)
            }}
          >
            <p className="flex items-center gap-1.5 text-[12px] text-white/60">
              <Lock className="h-3.5 w-3.5" /> Solo Kev pone a trabajar a los departamentos.
            </p>
            <div className="flex gap-2">
              <Campo valor={clave} onCambio={setClave} etiqueta="Clave de Kev" placeholder="Clave" tipo="password" autoFocus />
              <BotonFuerte tipo="submit" disabled={!clave.trim()}>
                <KeyRound className="h-4 w-4" /> Entrar
              </BotonFuerte>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BotonFuerte onClick={trabajar} disabled={trabajando || !objetivoId}>
              {trabajando ? <span className="cb-puntos cb-puntos-negros" aria-hidden><i /><i /><i /></span> : <Play className="h-4 w-4" />}
              {trabajando ? "Trabajando" : "Trabajar"}
            </BotonFuerte>
            <span className="flex items-center gap-1 text-[11px] text-white/45">
              <Lock className="h-3 w-3" /> Solo Kev
            </span>
            {mensaje?.tipo === "error" && (
              <button type="button" onClick={() => setPidiendoClave(true)} className={`text-[11px] font-semibold text-white/70 underline underline-offset-2 ${FOCO}`}>
                Usar otra clave
              </button>
            )}
          </div>
        )}
        {mensaje && (
          <p role="status" className={`mt-2 text-[12px] leading-relaxed ${mensaje.tipo === "ok" ? "text-[#8fe39a]" : "text-amber-200"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>

      <div className="mt-6">
        <Rotulo className="mb-2">Entregables ({entregables.length})</Rotulo>
        {entregables.length === 0 ? (
          <p className="text-[12px] text-white/45">Este departamento todavía no entregó nada.</p>
        ) : (
          <ul className="space-y-2">
            {entregables.map((e) => (
              <li key={e.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => setAbierto((v) => (v === e.id ? null : e.id))}
                  aria-expanded={abierto === e.id}
                  disabled={!e.contenido}
                  className={`flex w-full items-start gap-2 text-left disabled:cursor-default ${FOCO}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-snug text-white">{conPrime(e.titulo, false)}</span>
                    <span className="mt-0.5 block text-[11px] text-white/45">
                      {e.agenteNombre} · {e.rol} · {haceCuanto(e.creado)}
                    </span>
                  </span>
                  {e.contenido && <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-white/50 transition-transform ${abierto === e.id ? "rotate-180" : ""}`} />}
                </button>
                {abierto === e.id && e.contenido && (
                  <div className="mt-2 whitespace-pre-wrap border-t border-white/[0.07] pt-2 text-[12.5px] leading-relaxed text-white/80">{conPrime(e.contenido)}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  )
}
