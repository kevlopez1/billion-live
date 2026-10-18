"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Loader2, Plus, Trash2, TrendingUp } from "lucide-react"
import {
  MINIMO_PARA_CONCLUIR, formatearNumero, lectura, resumirPorFormato, totales,
  type Publicacion,
} from "@/lib/metricas"
import type { Formato } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// LOS NÚMEROS
//
// Cierra el círculo del manual: los formatos dicen qué contar, esto dice
// cuál funcionó. Se carga a mano — cinco números por video, veinte segundos
// — y eso ya basta para dejar de decidir por intuición. Cuando TikTok y
// YouTube estén conectados, los mismos campos se llenan solos.
// ──────────────────────────────────────────────────────────────

const VACIO = {
  fecha: "", titulo: "", formatoId: "", red: "TikTok", url: "",
  vistas: "", retencion: "", likes: "", comentarios: "", compartidos: "", seguidores: "",
}

export function Numeros({ formatos, clave }: { formatos: Formato[]; clave: string }) {
  const [pubs, setPubs] = useState<Publicacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [configurado, setConfigurado] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/publicaciones", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setPubs(d.publicaciones ?? [])
        setConfigurado(Boolean(d.configurado))
      })
      .catch(() => setConfigurado(false))
      .finally(() => setCargando(false))
  }, [])

  const resumen = useMemo(
    () => resumirPorFormato(pubs, formatos.map((f) => ({ id: f.id, nombre: f.nombre }))),
    [pubs, formatos],
  )
  const tot = useMemo(() => totales(pubs, resumen), [pubs, resumen])
  const frase = useMemo(() => lectura(resumen), [resumen])
  const conVideos = resumen.filter((r) => r.videos > 0)

  const enviar = async () => {
    setError("")
    if (!clave) { setError("Entra a editar y pon tu clave antes de registrar un video."); return }
    setGuardando(true)
    try {
      const r = await fetch("/api/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || "No se pudo guardar."); return }
      setPubs((p) => [j.publicacion, ...p])
      setForm(VACIO)
      setAbierto(false)
    } catch {
      setError("Error de red. No se guardó nada.")
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este registro?")) return
    const r = await fetch(`/api/publicaciones?id=${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${clave}` },
    })
    if (r.ok) setPubs((p) => p.filter((x) => x.id !== id))
    else setError("No se pudo borrar. ¿Pusiste la clave?")
  }

  const campo = (k: keyof typeof VACIO, etiqueta: string, tipo = "text", ancho = "") => (
    <label className={`block ${ancho}`}>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{etiqueta}</span>
      <input
        type={tipo}
        inputMode={tipo === "number" ? "numeric" : undefined}
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-gold"
      />
    </label>
  )

  return (
    <section>
      <div id="numeros" className="mb-5 flex scroll-mt-28 items-center gap-2.5 border-b border-border pb-3 pt-2">
        <BarChart3 className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.75} />
        <h2 className="font-display text-lg font-bold tracking-tight md:text-xl">Los números</h2>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {tot.videos} {tot.videos === 1 ? "video" : "videos"}
        </span>
      </div>

      <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        Los formatos dicen qué contar. Esto dice cuál funcionó. Se registra un video en veinte segundos y, con tres
        del mismo formato, el panel empieza a decir dónde poner el esfuerzo.
      </p>

      {!configurado && !cargando && (
        <div className="mb-5 rounded-2xl border border-gold/40 bg-gold/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">Falta la tabla.</b> Corre{" "}
          <code className="rounded bg-foreground/10 px-1 py-0.5 text-[12px]">supabase/correr-todo.sql</code> en Supabase
          para poder registrar videos.
        </div>
      )}

      {/* ── Totales ── */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ["Vistas", formatearNumero(tot.vistas)],
          ["Seguidores", formatearNumero(tot.seguidores)],
          ["Interacción", `${tot.interaccion}%`],
          ["Formatos probados", `${tot.formatosProbados} de ${formatos.length}`],
        ].map(([r, v]) => (
          <div key={r} className="rounded-2xl border border-border bg-card/40 px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{r}</div>
            <div className="mt-1 font-display text-xl font-extrabold tabular-nums tracking-tight">{v}</div>
          </div>
        ))}
      </div>

      {/* ── La lectura ── */}
      {frase ? (
        <div className="mb-5 flex gap-2.5 rounded-2xl border border-gold/40 bg-gold/[0.06] px-4 py-3.5">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-[13.5px] leading-relaxed text-foreground">{frase}</p>
        </div>
      ) : (
        tot.videos > 0 && (
          <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground/80">
            Todavía no hay con qué concluir. Hacen falta al menos {MINIMO_PARA_CONCLUIR} videos del mismo formato,
            en dos formatos distintos, antes de decir cuál rinde más. Sacar conclusiones de un solo video es
            exactamente lo que no queremos.
          </p>
        )
      )}

      {/* ── Tabla por formato ── */}
      {conVideos.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Formato</th>
                <th className="px-2 py-2.5 text-right font-medium">Videos</th>
                <th className="px-2 py-2.5 text-right font-medium">Vistas/video</th>
                <th className="px-2 py-2.5 text-right font-medium">Retención</th>
                <th className="px-2 py-2.5 text-right font-medium">Interac.</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Seg./1k</th>
              </tr>
            </thead>
            <tbody>
              {conVideos.map((r, i) => (
                <tr key={r.formatoId} className={`border-b border-border/60 last:border-0 ${i === 0 && r.suficiente ? "bg-gold/[0.05]" : ""}`}>
                  <td className="px-3.5 py-2.5">
                    <span className="font-medium text-foreground">{r.nombre}</span>
                    {!r.suficiente && (
                      <span className="ml-2 text-[10px] text-muted-foreground/70">pocos datos</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.videos}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{formatearNumero(r.vistasMedia)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.retencionMedia === null ? "—" : `${r.retencionMedia}%`}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.interaccion}%</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums text-muted-foreground">{r.seguidoresPorMil}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Registrar ── */}
      {!abierto ? (
        <button
          onClick={() => { setAbierto(true); setForm({ ...VACIO, fecha: new Date().toISOString().slice(0, 10) }) }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gold/40 px-3.5 py-2 text-[13px] text-gold transition-colors hover:border-gold hover:bg-gold/[0.06]"
        >
          <Plus className="h-3.5 w-3.5" /> Registrar un video
        </button>
      ) : (
        <div className="rounded-2xl border border-gold/40 bg-gold/[0.04] px-4 py-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {campo("titulo", "Título", "text", "sm:col-span-2")}
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Formato</span>
              <select
                value={form.formatoId}
                onChange={(e) => setForm({ ...form, formatoId: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-gold"
              >
                <option value="">Elige uno</option>
                {formatos.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </label>
            {campo("red", "Red")}
            {campo("fecha", "Fecha", "date")}
            {campo("url", "Enlace (opcional)")}
            {campo("vistas", "Vistas", "number")}
            {campo("retencion", "Retención %", "number")}
            {campo("likes", "Likes", "number")}
            {campo("comentarios", "Comentarios", "number")}
            {campo("compartidos", "Compartidos", "number")}
            {campo("seguidores", "Seguidores ganados", "number")}
          </div>
          {error && <p className="mt-2.5 text-[12px] text-rojo">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={enviar}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-background disabled:opacity-40"
            >
              {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
            </button>
            <button
              onClick={() => { setAbierto(false); setError("") }}
              className="rounded-xl border border-border px-3.5 py-1.5 text-[12.5px] text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Últimos videos ── */}
      {cargando ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </p>
      ) : pubs.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Últimos registrados
          </div>
          <ul className="space-y-1.5">
            {pubs.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-start gap-2 rounded-xl border border-border bg-card/40 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{p.titulo}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {formatos.find((f) => f.id === p.formatoId)?.nombre ?? p.formatoId} · {p.red} · {p.fecha} ·{" "}
                    {formatearNumero(p.vistas)} vistas
                  </div>
                </div>
                {clave && (
                  <button
                    onClick={() => borrar(p.id)}
                    aria-label="Borrar registro"
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-rojo/10 hover:text-rojo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
