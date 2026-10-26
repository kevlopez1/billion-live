"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CloudOff, ExternalLink, Loader2, Plus, RotateCcw, Send, Trash2, X } from "lucide-react"
import { Numeros } from "@/components/branding/numeros"
import { EjemploEdicion, GuiaEditores } from "@/components/videos/ejemplos-edicion"
import { leerClave } from "@/lib/clave"
import { ETAPAS, ETIQUETA_ETAPA, type Contenido, type Etapa, type Video } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// LA FÁBRICA — videos, edición, publicación y métricas en un solo lugar.
//
// No guarda nada propio: los videos son "En cola" del manual y las reglas
// son "La edición". Así el manual y la fábrica no pueden discrepar.
// ──────────────────────────────────────────────────────────────

type Parte = "videos" | "guiones" | "edicion" | "revision" | "publicacion" | "metricas"
const PARTES: [Parte, string][] = [
  ["videos", "Videos"],
  ["guiones", "Guiones"],
  ["edicion", "Edición"],
  ["revision", "Revisión"],
  ["publicacion", "Publicación"],
  ["metricas", "Métricas"],
]

// ── El camino del video ──
// Filmmaker graba y sube al Drive → editor entrega su versión (Drive) → Kev
// aprueba o pide cambios → se publica con su copy. Todo queda en el mismo
// video del tablero, así nadie pregunta «¿en qué va?».

/** Un link de Drive para verlo, convertido en uno de descarga directa: Meta
 *  necesita el archivo, no la página de Drive. Funciona con archivos
 *  compartidos con «cualquiera con el link» y de hasta ~100 MB (un capítulo
 *  de 20–40 s pesa mucho menos). */
export function directo(link: string): string {
  const id = link.match(/\/d\/([\w-]{10,})/)?.[1] ?? link.match(/[?&]id=([\w-]{10,})/)?.[1]
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : link.trim()
}

const pendiente = (v: Video) => (v.correcciones ?? []).find((c) => !c.resuelta)
const copyInicial = (v: Video) => [v.gancho, v.cta].filter(Boolean).join("\n\n")

const REDES: [string, string][] = [["ig", "Instagram"], ["fb", "Facebook"]]

export function Fabrica() {
  const [doc, setDoc] = useState<Contenido | null>(null)
  const [estado, setEstado] = useState<"limpio" | "sucio" | "guardando" | "error">("limpio")
  const [mensaje, setMensaje] = useState("")
  const [parte, setParte] = useState<Parte>("videos")
  const [abierto, setAbierto] = useState(0)
  const [notas, setNotas] = useState<Record<number, string>>({})
  const [publicando, setPublicando] = useState<number | null>(null)
  const [errores, setErrores] = useState<Record<number, string>>({})
  const visto = useRef<string | null>(null)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { setDoc(j.contenido); visto.current = j.actualizado ?? null })
      .catch(() => setMensaje("No se pudo cargar. Recarga la página."))
  }, [])

  const guardar = async (d: Contenido) => {
    setEstado("guardando")
    try {
      const r = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: d, visto: visto.current }),
      })
      const j = await r.json()
      if (!r.ok) { setEstado("error"); setMensaje(j.error || "No se pudo guardar."); return }
      visto.current = j.actualizado ?? new Date().toISOString()
      setEstado("limpio")
      setMensaje("")
    } catch {
      setEstado("error")
      setMensaje("Error de red. No se guardó nada.")
    }
  }

  const cambiar = (f: (d: Contenido) => void) => {
    setDoc((antes) => {
      if (!antes) return antes
      const d: Contenido = structuredClone(antes)
      f(d)
      setEstado("sucio")
      if (espera.current) clearTimeout(espera.current)
      espera.current = setTimeout(() => guardar(d), 800)
      return d
    })
  }

  if (!doc) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{mensaje || <Loader2 className="h-4 w-4 animate-spin" />}</div>
  }

  const videos = doc.enCola.map((v, i) => ({ v, i, etapa: (v.etapa ?? "idea") as Etapa }))
  const mover = (i: number, paso: number) =>
    cambiar((d) => {
      const actual = ETAPAS.indexOf((d.enCola[i].etapa ?? "idea") as Etapa)
      d.enCola[i].etapa = ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, actual + paso))]
    })
  const enRevision = videos.filter((x) => x.etapa === "editado")
  const aprobados = videos.filter((x) => x.etapa === "aprobado")

  // El editor pega una versión nueva: si había una corrección pendiente,
  // queda resuelta y la versión sube.
  const entregar = (i: number, link: string) =>
    cambiar((d) => {
      const v = d.enCola[i]
      const p = pendiente(v)
      if (p && link.trim() && link.trim() !== (v.editado ?? "").trim()) {
        p.resuelta = true
        v.version = (v.version ?? 1) + 1
      }
      v.editado = link
      if (!v.version && link.trim()) v.version = 1
    })

  const pedirCambios = (i: number) => {
    const texto = (notas[i] ?? "").trim()
    if (!texto) return
    cambiar((d) => {
      const v = d.enCola[i]
      ;(v.correcciones ??= []).push({ texto, fecha: new Date().toISOString(), version: v.version ?? 1 })
    })
    setNotas((n) => ({ ...n, [i]: "" }))
  }

  const aprobar = (i: number) =>
    cambiar((d) => {
      const v = d.enCola[i]
      v.etapa = "aprobado"
      if (!v.copy) v.copy = copyInicial(v)
      if (!v.redes) v.redes = ["ig", "fb"]
    })

  const publicar = async (i: number) => {
    const v = doc.enCola[i]
    const clave = leerClave()
    setErrores((e) => ({ ...e, [i]: "" }))
    if (!clave) { setErrores((e) => ({ ...e, [i]: "Para publicar, entra con tu clave en la pestaña Kev López." })); return }
    if (!v.editado?.trim()) { setErrores((e) => ({ ...e, [i]: "Falta el link del video editado." })); return }
    if (!v.redes?.length) { setErrores((e) => ({ ...e, [i]: "Elige al menos una red." })); return }
    setPublicando(i)
    try {
      const r = await fetch("/api/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ tipo: "video", url: directo(v.editado), texto: v.copy ?? "", destinos: v.redes }),
      })
      const j = await r.json()
      const res = (j.resultado ?? {}) as Record<string, { ok: boolean; enlace?: string; id?: string; error?: string } | undefined>
      const bien = Object.entries(res).filter(([, x]) => x?.ok)
      const mal = Object.entries(res).filter(([, x]) => x && !x.ok)
      if (bien.length) {
        cambiar((d) => {
          const w = d.enCola[i]
          w.enlaces = { ...(w.enlaces ?? {}), ...Object.fromEntries(bien.map(([k, x]) => [k, x!.enlace ?? x!.id ?? ""])) }
          if (!mal.length) w.etapa = "publicado"
        })
      }
      const msg = [j.error, ...mal.map(([k, x]) => `${k === "ig" ? "Instagram" : "Facebook"}: ${x!.error}`)].filter(Boolean).join(" · ")
      if (msg) setErrores((e) => ({ ...e, [i]: msg }))
    } catch {
      setErrores((e) => ({ ...e, [i]: "Error de red. No se publicó nada." }))
    } finally {
      setPublicando(null)
    }
  }

  const campo = "w-full rounded-[8px] border bg-background px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/60"

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border bg-card/70 p-0.5">
          {PARTES.map(([p, t]) => (
            <button
              key={p}
              type="button"
              onClick={() => setParte(p)}
              aria-pressed={parte === p}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${parte === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${estado === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {estado === "guardando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : estado === "error" ? <CloudOff className="h-3.5 w-3.5" />
            : estado === "sucio" ? <span className="h-2 w-2 rounded-full bg-kev-warning" />
            : <Check className="h-3.5 w-3.5" />}
          {mensaje || (estado === "limpio" ? "Guardado" : estado === "guardando" ? "Guardando" : "Sin guardar")}
        </span>
      </div>

      {parte === "videos" && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {ETAPAS.map((et) => {
            const aqui = videos.filter((x) => x.etapa === et)
            return (
              <section key={et} className="rounded-[14px] border bg-card/40 p-2.5">
                <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">
                  {ETIQUETA_ETAPA[et]}
                  <span className="tabular-nums text-muted-foreground">{aqui.length}</span>
                </h3>
                <div className="space-y-2">
                  {aqui.map(({ v, i }) => (
                    <div key={i} className="group rounded-[10px] border bg-background p-2">
                      <input
                        value={v.titulo}
                        onChange={(e) => cambiar((d) => { d.enCola[i].titulo = e.target.value })}
                        placeholder="Título del video"
                        className="w-full bg-transparent text-[13px] font-medium outline-none"
                      />
                      <select
                        value={v.formato}
                        onChange={(e) => cambiar((d) => { d.enCola[i].formato = e.target.value })}
                        className="mt-1 w-full rounded-[6px] bg-foreground/[0.04] px-1.5 py-1 text-[11px] text-muted-foreground outline-none"
                      >
                        <option value="">Sin formato</option>
                        {doc.formatos.map((f) => <option key={f.id} value={f.nombre}>{f.nombre}</option>)}
                      </select>
                      <input
                        value={v.gancho ?? ""}
                        onChange={(e) => cambiar((d) => { d.enCola[i].gancho = e.target.value })}
                        placeholder="Gancho: los 3 primeros segundos"
                        className="mt-1 w-full bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/60"
                      />
                      {et === "grabado" && (
                        <input
                          value={v.material ?? ""}
                          onChange={(e) => cambiar((d) => { d.enCola[i].material = e.target.value })}
                          placeholder="Filmmaker: link del Drive con lo grabado"
                          className="mt-1.5 w-full rounded-[6px] bg-foreground/[0.04] px-1.5 py-1 text-[11px] outline-none placeholder:text-muted-foreground/60"
                        />
                      )}
                      {et === "editado" && (
                        <>
                          <input
                            value={v.editado ?? ""}
                            onChange={(e) => entregar(i, e.target.value)}
                            placeholder="Editor: link del Drive con el video"
                            className="mt-1.5 w-full rounded-[6px] bg-foreground/[0.04] px-1.5 py-1 text-[11px] outline-none placeholder:text-muted-foreground/60"
                          />
                          {pendiente(v) && (
                            <p className="mt-1 rounded-[6px] bg-rojo/10 px-1.5 py-1 text-[11px] font-semibold text-rojo">Cambios pedidos: {pendiente(v)!.texto}</p>
                          )}
                        </>
                      )}
                      <div className="mt-1.5 flex items-center justify-between">
                        <button type="button" aria-label="Etapa anterior" disabled={et === "idea"} onClick={() => mover(i, -1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" aria-label="Borrar video" onClick={() => cambiar((d) => { d.enCola.splice(i, 1) })} className="rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-rojo group-hover:opacity-100 max-md:opacity-60">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" aria-label="Etapa siguiente" disabled={et === "publicado"} onClick={() => mover(i, 1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {et === "idea" && (
                    <button
                      type="button"
                      onClick={() => cambiar((d) => { d.enCola.push({ titulo: "", formato: "", etapa: "idea" }) })}
                      className="flex w-full items-center gap-1.5 rounded-[10px] border border-dashed px-2.5 py-2 text-xs text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Video
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {parte === "guiones" && (() => {
        if (videos.length === 0) {
          return <p className="text-xs text-muted-foreground">Todavía no hay videos. Agrega uno en Videos y aquí se escribe su guion.</p>
        }
        const sel = Math.min(abierto, videos.length - 1)
        const v = doc.enCola[sel]
        const formato = doc.formatos.find((f) => f.nombre === v.formato)
        return (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            {/* La lista: un guion por video del tablero. */}
            <nav className="space-y-1">
              {videos.map(({ v: x, i, etapa }) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAbierto(i)}
                  aria-pressed={i === sel}
                  className={`w-full rounded-[10px] border px-2.5 py-2 text-left transition-colors ${i === sel ? "border-foreground/40 bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]"}`}
                >
                  <span className="block truncate text-[13px] font-medium">{x.titulo || "Sin título"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {ETIQUETA_ETAPA[etapa]}{x.gancho && x.estructura && x.cta ? " · guion listo" : ""}
                  </span>
                </button>
              ))}
            </nav>

            <article className="rounded-[14px] border bg-card/40 p-4">
              <h3 className="text-base font-semibold">{v.titulo || "Sin título"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{v.formato || "Sin formato"}</p>

              {/* Los pasos del formato, como guía mientras se escribe. */}
              {formato && (
                <ol className="mt-3 flex flex-wrap gap-1.5">
                  {formato.beats.map((b, k) => (
                    <li key={k} className="rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground">{k + 1}. {b.paso}</li>
                  ))}
                </ol>
              )}

              {/* El guion, como lo define Kev: gancho + estructura + CTA,
                  coherentes entre sí. No es un texto palabra por palabra. */}
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-gold">Gancho</label>
              <textarea
                value={v.gancho ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[sel].gancho = e.target.value })}
                placeholder="Lo que engancha en los 3 primeros segundos"
                rows={2}
                className="mt-1 w-full resize-y rounded-[8px] border bg-background px-2.5 py-2 text-[14px] font-medium leading-relaxed outline-none"
              />
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-gold">Estructura</label>
              <textarea
                value={v.estructura ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[sel].estructura = e.target.value })}
                placeholder="Cómo se desarrolla: los pasos del formato, en tus palabras"
                rows={5}
                className="mt-1 w-full resize-y rounded-[8px] border bg-background px-2.5 py-2 text-[14px] font-medium leading-relaxed outline-none"
              />
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-gold">CTA</label>
              <textarea
                value={v.cta ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[sel].cta = e.target.value })}
                placeholder="Qué le pides al que mira, al final"
                rows={2}
                className="mt-1 w-full resize-y rounded-[8px] border bg-background px-2.5 py-2 text-[14px] font-medium leading-relaxed outline-none"
              />
            </article>
          </div>
        )
      })()}

      {parte === "edicion" && (
        <div className="grid gap-3 md:grid-cols-2">
          {doc.edicion.bloques.map((b, i) => (
            <section key={i} className="rounded-[14px] border bg-card/40 p-4">
              <h3 className="text-sm font-semibold">{b.titulo || "Sin título"}</h3>
              {b.nota && <p className="mt-1 text-xs text-muted-foreground">{b.nota}</p>}
              <ul className="mt-3 space-y-1.5">
                {b.reglas.map((r, k) => (
                  <li key={k} className="flex gap-2 text-[13px]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kev-success" />{r}</li>
                ))}
                {b.reglas.length === 0 && <li className="text-xs text-rojo/80">Falta definir las reglas.</li>}
              </ul>
              <EjemploEdicion titulo={b.titulo} />
            </section>
          ))}
          <p className="text-xs text-muted-foreground md:col-span-2">Las reglas se cambian en Kev Project GTA Branding, sección La edición.</p>
          <div className="md:col-span-2"><GuiaEditores /></div>
        </div>
      )}

      {parte === "revision" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            El editor pega aquí el link de su versión. Tú la miras y la apruebas o pides cambios. Al aprobarla pasa a Publicación.
          </p>
          {enRevision.length === 0 && <p className="text-sm text-muted-foreground">Ningún video espera revisión.</p>}
          {enRevision.map(({ v, i }) => {
            const p = pendiente(v)
            return (
              <article key={i} className="rounded-[14px] border bg-card/40 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{v.titulo || "Sin título"}</h3>
                  <span className="text-xs text-muted-foreground">{v.formato || "Sin formato"} · v{v.version ?? 1}</span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={v.editado ?? ""} onChange={(e) => entregar(i, e.target.value)} placeholder="Link del Drive con el video editado" className={campo} />
                  {v.editado?.trim() && (
                    <a href={v.editado} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.04]">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver video
                    </a>
                  )}
                </div>
                {v.material?.trim() && (
                  <a href={v.material} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[11px] text-muted-foreground underline">Material crudo del filmmaker</a>
                )}

                {(v.correcciones ?? []).length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {v.correcciones!.map((c, k) => (
                      <li key={k} className={`rounded-[8px] px-2.5 py-1.5 text-[12.5px] ${c.resuelta ? "bg-foreground/[0.04] text-muted-foreground line-through" : "bg-rojo/10 font-semibold text-rojo"}`}>
                        v{c.version} · {c.texto}
                      </li>
                    ))}
                  </ol>
                )}

                <textarea
                  value={notas[i] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [i]: e.target.value }))}
                  placeholder="Qué hay que cambiar (si hace falta)"
                  rows={2}
                  className={`mt-3 resize-y ${campo}`}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => pedirCambios(i)} disabled={!(notas[i] ?? "").trim()} className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold hover:bg-foreground/[0.04] disabled:opacity-40">
                    <RotateCcw className="h-3.5 w-3.5" /> Pedir cambios
                  </button>
                  <button type="button" onClick={() => aprobar(i)} disabled={!v.editado?.trim() || !!p} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background disabled:opacity-40">
                    <Check className="h-3.5 w-3.5" /> Aprobar
                  </button>
                  {p && <span className="self-center text-[11px] text-muted-foreground">Se aprueba cuando el editor entrega la versión corregida.</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {parte === "publicacion" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Los videos aprobados, con su copy. El video se toma del Drive: tiene que estar compartido con «cualquiera con el link».
          </p>
          {aprobados.length === 0 && <p className="text-sm text-muted-foreground">Ningún video aprobado todavía. Se aprueban en Revisión.</p>}
          {aprobados.map(({ v, i }) => (
            <article key={i} className="rounded-[14px] border bg-card/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{v.titulo || "Sin título"}</h3>
                {v.editado?.trim() && (
                  <a href={v.editado} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline"><ExternalLink className="h-3 w-3" /> Ver video</a>
                )}
              </div>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-gold">Copy</label>
              <textarea
                value={v.copy ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[i].copy = e.target.value })}
                rows={5}
                className={`mt-1 resize-y ${campo} text-[14px] leading-relaxed`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {REDES.map(([k, nombre]) => {
                  const on = (v.redes ?? []).includes(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => cambiar((d) => {
                        const r = new Set(d.enCola[i].redes ?? [])
                        if (r.has(k)) r.delete(k); else r.add(k)
                        d.enCola[i].redes = [...r]
                      })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}
                    >
                      {nombre}{v.enlaces?.[k] ? " ✓" : ""}
                    </button>
                  )
                })}
                <span className="text-[11px] text-muted-foreground">YouTube Shorts y TikTok, en la próxima etapa.</span>
              </div>
              {errores[i] && <p className="mt-2 rounded-[8px] bg-rojo/10 px-2.5 py-1.5 text-[12px] text-rojo">{errores[i]}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => publicar(i)} disabled={publicando !== null} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
                  {publicando === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar ahora
                </button>
                <button type="button" onClick={() => mover(i, -1)} className="rounded-full border px-3.5 py-2 text-xs font-semibold hover:bg-foreground/[0.04]">Volver a revisión</button>
              </div>
            </article>
          ))}
          {videos.some((x) => x.etapa === "publicado") && (
            <>
              <h3 className="pt-3 text-sm font-semibold">Publicados</h3>
              {videos.filter((x) => x.etapa === "publicado").map(({ v, i }) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border bg-background px-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate">{v.titulo || "Sin título"}</span>
                  <span className="flex gap-3 text-xs">
                    {Object.entries(v.enlaces ?? {}).map(([k, url]) => url.startsWith("http")
                      ? <a key={k} href={url} target="_blank" rel="noreferrer" className="underline">{k === "ig" ? "Instagram" : "Facebook"}</a>
                      : <span key={k}>{k === "ig" ? "Instagram" : "Facebook"} ✓</span>)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {parte === "metricas" && <Numeros formatos={doc.formatos} clave={leerClave() ?? ""} />}
    </div>
  )
}
