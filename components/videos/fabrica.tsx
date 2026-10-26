"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CloudOff, Loader2, Plus, Send, Trash2, X } from "lucide-react"
import { Numeros } from "@/components/branding/numeros"
import { leerClave } from "@/lib/clave"
import { ETAPAS, ETIQUETA_ETAPA, type Contenido, type Etapa } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// LA FÁBRICA — videos, edición, publicación y métricas en un solo lugar.
//
// No guarda nada propio: los videos son "En cola" del manual y las reglas
// son "La edición". Así el manual y la fábrica no pueden discrepar.
// ──────────────────────────────────────────────────────────────

type Parte = "videos" | "guiones" | "edicion" | "publicacion" | "metricas"
const PARTES: [Parte, string][] = [
  ["videos", "Videos"],
  ["guiones", "Guiones"],
  ["edicion", "Edición"],
  ["publicacion", "Publicación"],
  ["metricas", "Métricas"],
]

export function Fabrica() {
  const [doc, setDoc] = useState<Contenido | null>(null)
  const [estado, setEstado] = useState<"limpio" | "sucio" | "guardando" | "error">("limpio")
  const [mensaje, setMensaje] = useState("")
  const [parte, setParte] = useState<Parte>("videos")
  const [abierto, setAbierto] = useState(0)
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
  const listos = videos.filter((x) => x.etapa === "editado")

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
        <div className="grid gap-3 md:grid-cols-5">
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
        const tomas = v.guion ?? []
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
                    {ETIQUETA_ETAPA[etapa]} · {(x.guion ?? []).length} tomas
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

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gancho (3 primeros segundos)</label>
              <input
                value={v.gancho ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[sel].gancho = e.target.value })}
                className="mt-1 w-full rounded-[8px] border bg-background px-2.5 py-1.5 text-sm outline-none"
              />

              <div className="mt-4 space-y-2">
                {tomas.map((t, k) => (
                  <div key={k} className="group grid gap-2 rounded-[10px] border bg-background p-2.5 sm:grid-cols-[28px_1fr_1fr_24px]">
                    <span className="pt-1.5 text-xs font-semibold tabular-nums text-muted-foreground">{k + 1}</span>
                    <textarea
                      value={t.dice}
                      onChange={(e) => cambiar((d) => { d.enCola[sel].guion![k].dice = e.target.value })}
                      placeholder="Lo que dices"
                      rows={3}
                      className="w-full resize-y rounded-[6px] bg-foreground/[0.03] px-2 py-1.5 text-[13px] outline-none"
                    />
                    <textarea
                      value={t.pantalla ?? ""}
                      onChange={(e) => cambiar((d) => { d.enCola[sel].guion![k].pantalla = e.target.value })}
                      placeholder="Lo que se ve: toma, prueba, texto en pantalla"
                      rows={3}
                      className="w-full resize-y rounded-[6px] bg-foreground/[0.03] px-2 py-1.5 text-[12px] text-muted-foreground outline-none"
                    />
                    <button type="button" aria-label="Borrar toma" onClick={() => cambiar((d) => { d.enCola[sel].guion!.splice(k, 1) })} className="self-start rounded p-1 text-muted-foreground/50 opacity-0 hover:text-rojo group-hover:opacity-100 max-md:opacity-60">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => cambiar((d) => { (d.enCola[sel].guion ??= []).push({ dice: "", pantalla: "" }) })}
                  className="flex items-center gap-1.5 rounded-[10px] border border-dashed px-2.5 py-2 text-xs text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Toma
                </button>
              </div>

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prueba en pantalla</label>
              <input
                value={v.prueba ?? ""}
                onChange={(e) => cambiar((d) => { d.enCola[sel].prueba = e.target.value })}
                placeholder="Si se menciona un número, se muestra: el saldo, el comprobante, la pantalla"
                className="mt-1 w-full rounded-[8px] border bg-background px-2.5 py-1.5 text-sm outline-none"
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
            </section>
          ))}
          <p className="text-xs text-muted-foreground md:col-span-2">Las reglas se cambian en Kev Project GTA Branding, sección La edición.</p>
        </div>
      )}

      {parte === "publicacion" && (
        <div className="space-y-3">
          <a href="/publicar" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
            <Send className="h-4 w-4" /> Publicar en Instagram y Facebook
          </a>
          <h3 className="pt-2 text-sm font-semibold">Listos para publicar ({listos.length})</h3>
          {listos.length === 0 && <p className="text-xs text-muted-foreground">Ningún video está en Editado.</p>}
          {listos.map(({ v, i }) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-[10px] border bg-background px-3 py-2">
              <span className="min-w-0 truncate text-[13px]">{v.titulo || "Sin título"} <span className="text-muted-foreground">· {v.formato || "sin formato"}</span></span>
              <button type="button" onClick={() => mover(i, 1)} className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-foreground/[0.04]">
                Marcar publicado
              </button>
            </div>
          ))}
        </div>
      )}

      {parte === "metricas" && <Numeros formatos={doc.formatos} clave={leerClave() ?? ""} />}
    </div>
  )
}
