"use client"

import { useState } from "react"
import { AlertTriangle, Check, ExternalLink, Factory, Loader2, Pause, Play, RefreshCw, X as Cerrar } from "lucide-react"
import { conPrime } from "@/components/prime-mark"
import type { DecisionVista, EnvioVista, PersonajeVista, VideoVista, VistaPanel } from "@/lib/fabrica/panel"

// ──────────────────────────────────────────────────────────────
// /publicar · la sección «Fábrica»: el interruptor, lo de hoy, la cola de hoy
// y mañana con el estado por red, lo que espera el OK de Kev y el último parte.
//
// Lee /api/fabrica/panel (ya armado en el servidor), pausa y reanuda con
// /api/fabrica/estado y aprueba con /api/fabrica/aprobar. Después de cada
// acción se vuelve a leer: lo que se ve es lo que dice la base, no lo que el
// navegador supone.
// ──────────────────────────────────────────────────────────────

const RED: Record<string, string> = { youtube: "YouTube", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", x: "X" }

const ESTADO_VIDEO: Record<string, string> = {
  idea: "idea",
  guion: "escribiendo",
  aprobacion_pendiente: "espera tu OK",
  listo_para_render: "para render",
  renderizado: "renderizado",
  calidad_ok: "pasó calidad",
  subido_parcial: "subido en parte",
  programado: "programado",
  publicado: "publicado",
  fallido: "falló",
  rechazado: "rechazado",
}

const ESTADO_ENVIO: Record<string, string> = {
  pendiente: "pendiente",
  subiendo: "subiendo",
  subido: "subido",
  programado: "programado",
  publicando: "publicando",
  procesando: "procesando",
  ambiguo: "sin confirmar",
  publicado: "publicado",
  confirmado: "confirmado",
  no_hoy: "mañana",
  fallido: "falló",
  omitido: "omitido",
}

const LUZ: Record<PersonajeVista["luz"], { punto: string; nombre: string }> = {
  verde: { punto: "bg-kev-success", nombre: "verde" },
  amarillo: { punto: "bg-kev-warning", nombre: "amarillo" },
  vivo: { punto: "bg-muted-foreground", nombre: "de fondo" },
  fuera: { punto: "bg-destructive", nombre: "fuera" },
}

/** "2026-10-30" → "jue 30 oct". */
const dia = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
/** Un instante en hora de Bolivia: "30 oct, 21:30". */
const instante = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/La_Paz" })
    : "nunca"
/** Hasta 3 decimales: un post en X cuesta $0,015. */
const usd = (n: number) => `$${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`

const tonoEnvio = (e: EnvioVista["estado"]) =>
  e === "confirmado" || e === "publicado"
    ? "border-kev-success/40 text-foreground"
    : e === "fallido" || e === "ambiguo"
      ? "border-destructive/50 text-destructive"
      : e === "no_hoy" || e === "omitido"
        ? "border-kev-warning/50 text-muted-foreground"
        : "border-border text-muted-foreground"

export function Fabrica({ clave }: { clave: string }) {
  const [vista, setVista] = useState<VistaPanel | null>(null)
  const [carga, setCarga] = useState<"nada" | "cargando" | "listo" | "error">("nada")
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState("")
  const [motivoRechazo, setMotivoRechazo] = useState<Record<string, string>>({})
  const [ajustes, setAjustes] = useState<{ videos: number; tope: string; modo: boolean } | null>(null)

  const cabeceras = { "Content-Type": "application/json", authorization: `Bearer ${clave}` }

  const cargar = async () => {
    if (!clave) return
    setCarga("cargando")
    setError("")
    try {
      const r = await fetch("/api/fabrica/panel", { headers: cabeceras, cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setCarga("error")
        setError(j.error || `No se pudo leer la fábrica (${r.status}).`)
        return
      }
      const v = j as VistaPanel
      setVista(v)
      setAjustes({ videos: v.estado.videosPorDia, tope: String(v.estado.topeUsd), modo: v.estado.modoAprobacion })
      setCarga("listo")
    } catch {
      setCarga("error")
      setError("Error de red. Revisa tu conexión.")
    }
  }

  /** Manda una acción y vuelve a leer, salga bien o mal. */
  const accion = async (url: string, cuerpo: unknown, hecho: string) => {
    setOcupado(true)
    setAviso("")
    setError("")
    try {
      const r = await fetch(url, { method: "POST", headers: cabeceras, body: JSON.stringify(cuerpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setError(j.error || `No se pudo (${r.status}).`)
      else setAviso(hecho)
      await cargar()
      return r.ok
    } catch {
      setError("Error de red: no se sabe si se aplicó. Se vuelve a leer la fábrica.")
      await cargar()
      return false
    } finally {
      setOcupado(false)
    }
  }

  const pausar = async (red?: string) => {
    const motivo = motivoPausa.trim()
    if (motivo.length < 3) {
      setError("Escribe el motivo de la pausa (3 caracteres o más).")
      return
    }
    if (await accion("/api/fabrica/estado", { accion: "pausar", motivo, ...(red ? { red } : {}) }, red ? `${RED[red]} pausada.` : "Fábrica pausada.")) {
      setMotivoPausa("")
    }
  }

  const reanudar = (red?: string) => {
    const que = red ? `${RED[red]}` : "la fábrica"
    if (!window.confirm(`¿Reanudar ${que}? Vuelve a publicar sola.`)) return
    accion("/api/fabrica/estado", { accion: "reanudar", ...(red ? { red } : {}) }, red ? `${RED[red]} reanudada.` : "Fábrica en marcha.")
  }

  const decidir = (d: DecisionVista, decision: "aprobar" | "rechazar") => {
    const motivo = (motivoRechazo[d.video.id] ?? "").trim()
    accion(
      "/api/fabrica/aprobar",
      { id: d.video.id, que: d.que, decision, hash: d.video.guionHash, ...(decision === "rechazar" && motivo ? { motivo } : {}) },
      decision === "aprobar" ? `Aprobado: ${d.video.titulo}` : `Rechazado: ${d.video.titulo}`,
    )
  }

  const guardarAjustes = () => {
    if (!ajustes || !vista) return
    const tope = Number(ajustes.tope.replace(",", "."))
    if (!Number.isFinite(tope) || tope < 0 || tope > 100) {
      setError("El tope va de 0 a 100 dólares por día.")
      return
    }
    accion("/api/fabrica/estado", { accion: "ajustar", videos_por_dia: ajustes.videos, tope_gasto_usd_dia: tope, modo_aprobacion: ajustes.modo }, "Ajustes guardados.")
  }

  const campo =
    "w-full rounded-lg border border-border bg-foreground/[0.04] px-4 py-2.5 text-base outline-none transition-colors focus:border-foreground/30"
  const etiqueta = "mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"
  const e = vista?.estado

  return (
    <section className="glass-card w-full min-w-0 max-w-md p-5 sm:p-7" aria-labelledby="fabrica-titulo">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Factory className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-[0.18em]">La Casa Blanca Project</span>
        </span>
        <button
          type="button"
          onClick={cargar}
          disabled={!clave || carga === "cargando" || ocupado}
          className="flex items-center gap-1 text-[12px] text-muted-foreground underline disabled:no-underline disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${carga === "cargando" ? "animate-spin" : ""}`} /> {vista ? "Actualizar" : "Cargar"}
        </button>
      </div>
      <h2 id="fabrica-titulo" className="mb-5 text-xl font-medium tracking-tight">
        Fábrica
      </h2>

      {!clave && <p className="text-[12.5px] text-muted-foreground">Escribe la clave arriba para ver la fábrica.</p>}
      {clave && carga === "nada" && <p className="text-[12.5px] text-muted-foreground">Toca Cargar.</p>}

      {error && (
        <p className="mb-4 flex items-start gap-2 break-words text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span className="min-w-0">{error}</span>
        </p>
      )}
      {aviso && !error && (
        <p className="mb-4 flex items-start gap-2 break-words text-sm" role="status">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-kev-success" /> <span className="min-w-0">{aviso}</span>
        </p>
      )}

      {vista && e && (
        <>
          {/* ── El interruptor ── */}
          <div className={`mb-5 rounded-lg border p-3 ${e.pausada ? "border-kev-warning/50" : "border-kev-success/40"}`}>
            <p className="text-sm font-semibold">{e.pausada ? "Pausada" : "En marcha"}</p>
            {e.pausada && (
              <p className="mt-0.5 break-words text-[12.5px] text-muted-foreground">
                {e.motivo || "sin motivo"}
                {e.pausadaPor && ` · ${e.pausadaPor}`}
                {e.pausadaEn && ` · ${instante(e.pausadaEn)}`}
              </p>
            )}
            {e.pausada ? (
              <button
                type="button"
                onClick={() => reanudar()}
                disabled={ocupado}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-3.5 text-base font-semibold text-background disabled:opacity-40"
              >
                {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Reanudar
              </button>
            ) : (
              <>
                <label htmlFor="motivo-pausa" className={`${etiqueta} mt-3`}>
                  Motivo
                </label>
                <input
                  id="motivo-pausa"
                  value={motivoPausa}
                  onChange={(x) => setMotivoPausa(x.target.value)}
                  maxLength={300}
                  placeholder="Por qué se pausa"
                  className={`${campo} mb-2`}
                />
                <button
                  type="button"
                  onClick={() => pausar()}
                  disabled={ocupado}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive py-3.5 text-base font-semibold text-white disabled:opacity-40"
                >
                  {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <Pause className="h-5 w-5" />} Pausar todo
                </button>
              </>
            )}

            {e.redesPausadas.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {e.redesPausadas.map((r) => (
                  <li key={r.red} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{RED[r.red]}</span> pausada{r.motivo ? `: ${r.motivo}` : ""}
                    </span>
                    <button type="button" onClick={() => reanudar(r.red)} disabled={ocupado} className="shrink-0 underline disabled:opacity-40">
                      Reanudar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Último tick: {instante(e.ultimoTick)} · última tanda: {instante(e.ultimaTanda)}
            </p>
          </div>

          {/* ── Hoy ── */}
          <span className={etiqueta}>Hoy · {dia(vista.hoy)}</span>
          <div className="mb-5 grid grid-cols-3 gap-2 text-center">
            {[
              { n: vista.delDia.publicados, t: "publicados" },
              { n: vista.delDia.enCola, t: "en cola" },
              { n: vista.delDia.fallidos, t: "fallos" },
            ].map((c) => (
              <div key={c.t} className="rounded-lg border border-border px-2 py-2.5">
                <p className="text-lg font-semibold tabular-nums">{c.n}</p>
                <p className="text-[11px] text-muted-foreground">{c.t}</p>
              </div>
            ))}
            <div className="col-span-3 flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-left text-[12.5px]">
              <span>
                Gasto <span className="tabular-nums font-semibold">{usd(vista.delDia.gastoUsd)}</span> de {usd(e.topeUsd)}
              </span>
              <span className={vista.reserva.verdes < vista.reserva.minima ? "font-semibold text-destructive" : ""}>
                Reserva verde: <span className="tabular-nums">{vista.reserva.verdes}</span>
                {vista.reserva.verdes < vista.reserva.minima && ` (mínimo ${vista.reserva.minima})`}
              </span>
            </div>
          </div>

          {/* ── Lo que espera tu OK ── */}
          {vista.decisiones.length > 0 && (
            <>
              <span className={etiqueta}>Espera tu OK · {vista.decisiones.length}</span>
              <ul className="mb-5 flex flex-col gap-3">
                {vista.decisiones.map((d) => (
                  <li key={d.video.id} className="rounded-lg border border-kev-warning/50 p-3">
                    <Cabecera v={d.video} />
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {d.que === "guion" ? "Guion con personajes que solo salen con tu OK" : "Video terminado: falta tu OK para salir"}
                      {d.duracionS !== null && ` · ${Math.round(d.duracionS)} s`}
                    </p>

                    {d.rotulos.length > 0 && (
                      <p className="mt-2 break-words text-[12.5px] text-muted-foreground">{d.rotulos.join(" · ")}</p>
                    )}
                    {d.dialogo.length > 0 && (
                      <ol className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md bg-foreground/[0.04] p-2 text-[13px] leading-snug">
                        {d.dialogo.map((l, i) => (
                          <li key={i} className="break-words">
                            <span className="font-semibold">{l.quien}:</span> {conPrime(l.texto)}
                          </li>
                        ))}
                      </ol>
                    )}
                    {d.que === "video" && d.texto && (
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line break-words rounded-md bg-foreground/[0.04] p-2 text-[12.5px]">
                        {conPrime(d.texto)}
                      </p>
                    )}
                    {d.avisos.length > 0 && (
                      <ul className="mt-2 text-[12px] text-kev-warning">
                        {d.avisos.map((a, i) => (
                          <li key={i} className="break-words">
                            · {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.que === "video" && (
                      <p className="mt-2 text-[11.5px] text-muted-foreground">Vista previa del video: cuando el almacén esté conectado.</p>
                    )}

                    <input
                      value={motivoRechazo[d.video.id] ?? ""}
                      onChange={(x) => setMotivoRechazo((m) => ({ ...m, [d.video.id]: x.target.value }))}
                      maxLength={300}
                      placeholder="Motivo si lo rechazas (opcional)"
                      aria-label="Motivo del rechazo"
                      className={`${campo} mt-3`}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => decidir(d, "aprobar")}
                        disabled={ocupado || !!d.video.trabajando}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" /> Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => decidir(d, "rechazar")}
                        disabled={ocupado || !!d.video.trabajando}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/50 py-2.5 text-sm font-semibold text-destructive disabled:opacity-40"
                      >
                        <Cerrar className="h-4 w-4" /> Rechazar
                      </button>
                    </div>
                    {d.video.trabajando && (
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">La fábrica lo está trabajando ({d.video.trabajando}). Actualiza en unos minutos.</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ── La cola ── */}
          {[vista.hoy, vista.manana].map((f) => {
            const del = vista.cola.filter((v) => v.dia === f)
            return (
              <div key={f} className="mb-5">
                <span className={etiqueta}>
                  {f === vista.hoy ? "Cola de hoy" : "Mañana"} · {dia(f)}
                </span>
                {del.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">Sin videos.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {del.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border p-3">
                        <Cabecera v={v} />
                        {v.envios.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {v.envios.map((x) => (
                              <li key={x.red} className={`rounded-md border px-2 py-1 text-[11.5px] ${tonoEnvio(x.estado)}`}>
                                {x.enlace ? (
                                  <a href={x.enlace} target="_blank" rel="noopener" className="inline-flex items-center gap-1 underline">
                                    {RED[x.red]} · {ESTADO_ENVIO[x.estado] ?? x.estado} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <>
                                    {RED[x.red]} · {ESTADO_ENVIO[x.estado] ?? x.estado}
                                    {x.proximo && ` · ${x.proximo}`}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {v.envios
                          .filter((x) => x.error)
                          .map((x) => (
                            <p key={x.red} className="mt-1.5 break-words text-[11.5px] text-destructive">
                              {RED[x.red]}: {x.error}
                            </p>
                          ))}
                        {v.motivoRechazo && <p className="mt-1.5 break-words text-[11.5px] text-muted-foreground">Motivo: {v.motivoRechazo}</p>}
                        {v.errores.map((t, i) => (
                          <p key={i} className="mt-1 break-words text-[11.5px] text-destructive">
                            {t}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          {/* ── El último parte ── */}
          <span className={etiqueta}>Último parte</span>
          {vista.parte ? (
            <div className="mb-5 rounded-lg border border-border p-3">
              <p className="text-[12.5px] text-muted-foreground">
                {dia(vista.parte.dia)} · {vista.parte.enviadoEn ? `enviado ${instante(vista.parte.enviadoEn)}` : "no se envió"}
              </p>
              {vista.parte.error && <p className="mt-1 break-words text-[12.5px] text-destructive">{vista.parte.error}</p>}
              <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12.5px] leading-snug">
                {vista.parte.texto}
              </pre>
            </div>
          ) : (
            <p className="mb-5 text-[12.5px] text-muted-foreground">Todavía no hay parte.</p>
          )}

          {/* ── Ajustes ── */}
          {ajustes && (
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-[12.5px] text-muted-foreground">
                Ajustes · {e.videosPorDia} por día · tope {usd(e.topeUsd)} · {e.modoAprobacion ? "con" : "sin"} OK de cada video
              </summary>
              <label htmlFor="videos-dia" className={`${etiqueta} mt-3`}>
                Videos por día
              </label>
              <select
                id="videos-dia"
                value={ajustes.videos}
                onChange={(x) => setAjustes({ ...ajustes, videos: Number(x.target.value) })}
                className={`${campo} mb-3`}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <label htmlFor="tope" className={etiqueta}>
                Tope de gasto por día (USD)
              </label>
              <input
                id="tope"
                value={ajustes.tope}
                onChange={(x) => setAjustes({ ...ajustes, tope: x.target.value })}
                inputMode="decimal"
                className={`${campo} mb-3`}
              />
              <label className="mb-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={ajustes.modo} onChange={(x) => setAjustes({ ...ajustes, modo: x.target.checked })} className="mt-1" />
                <span>Cada video espera mi OK antes de salir</span>
              </label>
              <button
                type="button"
                onClick={guardarAjustes}
                disabled={ocupado}
                className="w-full rounded-lg border border-foreground/30 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Guardar ajustes
              </button>
            </details>
          )}
        </>
      )}
    </section>
  )
}

function Cabecera({ v }: { v: VideoVista }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-medium">{conPrime(v.titulo)}</p>
        <span className="shrink-0 text-[11.5px] text-muted-foreground">{ESTADO_VIDEO[v.estado] ?? v.estado}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        {v.hora ? `${dia(v.dia)} ${v.hora}` : dia(v.dia)}
        {v.pilar && ` · ${v.pilar}`}
        {v.trabajando && ` · ${v.trabajando}`}
      </p>
      {v.personajes.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {v.personajes.map((p) => (
            <li key={p.id} className="flex items-center gap-1 text-[12px]" title={LUZ[p.luz].nombre}>
              <span className={`inline-block h-2 w-2 rounded-full ${LUZ[p.luz].punto}`} aria-hidden />
              {p.nombre}
              <span className="text-muted-foreground">· {LUZ[p.luz].nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
