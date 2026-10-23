"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle, ArrowUpRight, CircleHelp, Gauge, Instagram, Facebook, Lock, Map as MapIcon, NotebookPen,
  Receipt, RefreshCw, Send, Sparkles,
} from "lucide-react"
import { PantallaClave } from "@/components/pantalla-clave"
import { guardarClave, leerClave, olvidarClave } from "@/lib/clave"
import type { Centro } from "@/lib/centro"

// ──────────────────────────────────────────────────────────────
// /centro — todo el trabajo de Kev en un lugar, con números.
//
// Arriba lo que manda (el reto y el ritmo), después cada frente, y abajo la
// puerta a cada herramienta. No guarda nada: todo sale de /api/centro, que
// lee de las mismas fuentes que cada página.
// ──────────────────────────────────────────────────────────────

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-BO"))

function Tarjeta({ titulo, icono, children, className = "" }: { titulo: string; icono: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card/60 p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {icono} {titulo}
      </h2>
      {children}
    </section>
  )
}

function Barra({ valor, max }: { valor: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
      <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(pct, valor > 0 ? 1.5 : 0)}%` }} />
    </div>
  )
}

function Cifra({ valor, etiqueta, nota }: { valor: string; etiqueta: string; nota?: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold tabular-nums tracking-tight">{valor}</div>
      <div className="text-[12px] text-muted-foreground">{etiqueta}</div>
      {nota && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{nota}</div>}
    </div>
  )
}

const HERRAMIENTAS = [
  { href: "/branding", nombre: "Manual de marca", icono: Sparkles, nota: "Formatos, edición, preguntas del reto" },
  { href: "/kevlopez_proyectos", nombre: "Proyectos", icono: MapIcon, nota: "Mapa, notas y tareas" },
  { href: "/preguntas", nombre: "Preguntas", icono: CircleHelp, nota: "Una pregunta, mínimo veinte respuestas" },
  { href: "/publicar", nombre: "Publicar", icono: Send, nota: "Instagram y Facebook a la vez" },
  { href: "/control", nombre: "Contador", icono: Gauge, nota: "Actualizar lo recaudado" },
  { href: "/comprobantes", nombre: "Comprobantes", icono: Receipt, nota: "La prueba pública" },
]

export default function CentroPage() {
  const [clave, setClave] = useState<string | null>(null)
  const [entrada, setEntrada] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(true)
  const [datos, setDatos] = useState<Centro | null>(null)
  const [hora, setHora] = useState<Date | null>(null)

  const cargar = useCallback(async (k: string, silencioso = false) => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch("/api/centro", { headers: { authorization: `Bearer ${k}` }, cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (!silencioso) {
          olvidarClave()
          setError(j?.error || "No se pudo entrar. Inténtalo de nuevo.")
        }
        setClave(null)
        return
      }
      guardarClave(k)
      setDatos(j as Centro)
      setHora(new Date())
      setClave(k)
    } catch {
      if (!silencioso) setError("Error de red. Revisa tu conexión.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const k = leerClave()
    if (k) cargar(k, true)
    else setCargando(false)
  }, [cargar])

  if (!clave || !datos) {
    return (
      <PantallaClave
        titulo={<>Centro de <span className="font-serif-display italic font-normal">Kev López</span></>}
        bajada="Todo tu trabajo en un lugar, con números. Entra con tu clave de administrador."
        entrada={entrada}
        setEntrada={setEntrada}
        error={error}
        cargando={cargando}
        onEntrar={() => cargar(entrada)}
      />
    )
  }

  const { reto, dinero, trabajo, contenido, redes, avisos } = datos
  // Cuántas veces más rápido tendría que entrar la plata para llegar a tiempo.
  // Es EL número del tablero: dice si el plan actual alcanza o no.
  const veces = reto.ritmoActual > 0 ? reto.ritmoRecord / reto.ritmoActual : null

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-7">
      <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Centro de <span className="font-serif-display italic font-normal">Kev López</span>
        </h1>
        <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums">Día {reto.dia}</span>
        <button
          onClick={() => cargar(clave)}
          disabled={cargando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          {hora ? `Actualizado ${hora.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}` : "Actualizar"}
        </button>
      </header>

      {/* ── El reto ── Lo que manda. */}
      <section className="mb-4 rounded-2xl border border-border bg-card/60 p-6">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">El reto</div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-5xl font-bold tabular-nums tracking-tight">{usd(reto.recaudado)}</span>
          <span className="text-muted-foreground">/ {usd(reto.meta)} · {reto.porcentaje.toLocaleString("es-BO", { maximumFractionDigits: 2 })}%</span>
        </div>
        <div className="my-4"><Barra valor={reto.recaudado} max={reto.meta} /></div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Cifra valor={`${usd(reto.ritmoActual)}/día`} etiqueta="Tu ritmo real" nota={`Promedio de ${reto.dia} días`} />
          <Cifra valor={`${usd(reto.ritmoRecord)}/día`} etiqueta={`Para el récord · ${reto.diasAlRecord} días`} nota="30 dic 2026" />
          <Cifra valor={`${usd(reto.ritmoLimite)}/día`} etiqueta={`Para el límite · ${reto.diasAlLimite} días`} nota="30 jun 2027" />
        </div>

        {veces !== null && veces > 1 && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-foreground/[0.04] px-3.5 py-2.5 text-[13.5px] leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-kev-warning" aria-label="Aviso" />
            <span>
              Para el récord, la plata tiene que entrar <b className="tabular-nums">{veces.toLocaleString("es-BO", { maximumFractionDigits: 0 })} veces</b> más
              rápido que hasta ahora. Eso no sale de más esfuerzo en lo mismo: sale de un trato que mueva el contador a cinco cifras.
            </span>
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── El dinero ── */}
        <Tarjeta titulo="La prueba" icono={<Receipt className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-4">
            <Cifra valor={num(dinero.comprobantes)} etiqueta="comprobantes públicos" nota={`${dinero.entidades} bancos distintos`} />
            <Cifra valor={`Bs ${num(dinero.totalBs)}`} etiqueta="en comprobantes" nota={`${dinero.desde} – ${dinero.hasta}`} />
          </div>
        </Tarjeta>

        {/* ── Las cuentas ── */}
        <Tarjeta titulo="Las cuentas" icono={<Instagram className="h-3.5 w-3.5" />}>
          {!redes ? (
            <p className="text-[13px] text-muted-foreground">Instagram y Facebook sin conectar.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {"error" in redes.instagram ? (
                <p className="text-[12.5px] text-muted-foreground"><b className="text-foreground">Instagram:</b> {redes.instagram.error}</p>
              ) : (
                <Cifra valor={num(redes.instagram.seguidores)} etiqueta={`seguidores · @${redes.instagram.usuario}`} nota={`${num(redes.instagram.publicaciones)} publicaciones`} />
              )}
              {"error" in redes.facebook ? (
                <p className="text-[12.5px] text-muted-foreground"><b className="text-foreground">Facebook:</b> {redes.facebook.error}</p>
              ) : (
                <Cifra valor={num(redes.facebook.seguidores)} etiqueta="seguidores en Facebook" nota={redes.facebook.nombre} />
              )}
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
            <Facebook className="h-3 w-3" /> TikTok y YouTube todavía no entran aquí.
          </p>
        </Tarjeta>

        {/* ── El trabajo ── */}
        <Tarjeta titulo="El trabajo" icono={<NotebookPen className="h-3.5 w-3.5" />}>
          {trabajo.tareas ? (
            <div className="mb-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px]">Tareas de tus proyectos</span>
                <span className="font-semibold tabular-nums">{trabajo.tareas.hechas} / {trabajo.tareas.total}</span>
              </div>
              <Barra valor={trabajo.tareas.hechas} max={trabajo.tareas.total} />
            </div>
          ) : (
            <p className="mb-5 text-[13px] text-muted-foreground">Las tareas aparecen cuando los proyectos se guarden en la base.</p>
          )}

          <div className="space-y-3">
            {trabajo.preguntas.map((p, i) => (
              <div key={i}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
                    <span className="truncate">{p.pregunta || "Sin escribir"}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">{p.van} / {p.meta}</span>
                </div>
                <Barra valor={p.van} max={p.meta} />
              </div>
            ))}
          </div>
        </Tarjeta>

        {/* ── El contenido ── */}
        <Tarjeta titulo="El contenido" icono={<Sparkles className="h-3.5 w-3.5" />}>
          {contenido ? (
            <div className="mb-5 grid grid-cols-2 gap-4">
              <Cifra valor={num(contenido.publicaciones)} etiqueta="videos registrados" nota={contenido.ultima ? `Último: ${contenido.ultima}` : "Ninguno todavía"} />
              <Cifra valor={num(contenido.vistas)} etiqueta="vistas sumadas" />
            </div>
          ) : (
            <p className="mb-5 text-[13px] text-muted-foreground">Los videos aparecen cuando la tabla de publicaciones exista.</p>
          )}
          {trabajo.manualPorDefinir.length > 0 && (
            <>
              <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Sin definir en el manual · {trabajo.manualPorDefinir.length}</div>
              <ul className="space-y-1 text-[13px]">
                {trabajo.manualPorDefinir.slice(0, 6).map((x) => (
                  <li key={x} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-rojo" />{x}</li>
                ))}
              </ul>
            </>
          )}
        </Tarjeta>
      </div>

      {/* ── Las herramientas ── */}
      <h2 className="mb-3 mt-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Herramientas</h2>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {HERRAMIENTAS.map(({ href, nombre, icono: Icono, nota }) => (
          <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-foreground/[0.04]">
            <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">{nombre}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{nota}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {avisos.length > 0 && (
        <div className="mt-8 rounded-xl border border-border px-4 py-3">
          <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Lo que todavía no se puede leer</div>
          <ul className="space-y-1 text-[12.5px] text-muted-foreground">
            {avisos.map((a) => <li key={a}>· {a}</li>)}
          </ul>
        </div>
      )}
    </main>
  )
}
