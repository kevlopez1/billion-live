"use client"

import { useEffect, useRef, useState } from "react"
import { Hand, Users, ChevronDown, Sparkles, Clock } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

interface Signature {
  id: string
  name: string
  message: string | null
  created_at: string
}

const STORAGE_KEY = "kev-wall-signed"

// Tiempo relativo en español ("hace 3 min", "ayer", etc.).
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return "recién"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return "ayer"
  if (d < 30) return `hace ${d} d`
  return new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" })
}

function initials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function EarlyWall() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [total, setTotal] = useState<number>(0)
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [myPosition, setMyPosition] = useState<number | null>(null)
  const [signed, setSigned] = useState(false)

  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const honeypot = useRef("")

  // Carga inicial + recuerda si ya firmaste (localStorage).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSigned(true)
        if (typeof parsed.position === "number") setMyPosition(parsed.position)
      }
    } catch {}

    const load = async () => {
      try {
        const res = await fetch("/api/wall", { cache: "no-store" })
        const data = await res.json()
        if (data.signatures) setSignatures(data.signatures)
        if (typeof data.total === "number") setTotal(data.total)
      } catch {}
    }
    load()

    // Realtime: cuando alguien firma, aparece en vivo.
    const channel = supabase
      .channel("wall_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_signatures" },
        (payload) => {
          const row = payload.new as Signature
          setSignatures((prev) => {
            if (prev.some((s) => s.id === row.id)) return prev
            return [row, ...prev].slice(0, 60)
          })
          setTotal((t) => t + 1)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) {
      toast.error("Poné tu nombre para dejar tu huella.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          email,
          whatsapp,
          website: honeypot.current, // honeypot anti-bot
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "No se pudo guardar. Probá de nuevo.")
        return
      }
      setSigned(true)
      setMyPosition(data.position ?? null)
      if (typeof data.total === "number") setTotal(data.total)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ position: data.position, name }))
      } catch {}
      toast.success(`¡Quedaste en el muro! Sos el #${data.position} 🖐️`)
      // Limpia campos sensibles
      setMessage("")
      setEmail("")
      setWhatsapp("")
    } catch {
      toast.error("Falló la conexión. Probá de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const visible = expanded ? signatures : signatures.slice(0, 9)

  return (
    <section className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-card/50 backdrop-blur-xl px-5 py-7 md:px-10 md:py-10">
      <div className="accent-glow -top-16 -left-10" />

      <div className="relative z-10">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
              <Sparkles className="w-3 h-3" />
              El muro del Día 1
            </div>
            <h2 className="font-display font-extrabold uppercase tracking-tighter text-3xl md:text-4xl leading-none">
              Yo estuve aquí
            </h2>
            <p className="font-serif-display italic text-muted-foreground text-base md:text-lg mt-3 max-w-md">
              Dejá tu huella antes de que llegue el Mansory. El día que se cumpla,
              vas a poder decir: <span className="text-foreground">“yo estaba desde el inicio”.</span>
            </p>
          </div>

          <div className="flex items-center gap-2 glass-card px-4 py-3 shrink-0">
            <Users className="w-4 h-4 text-kev-primary" />
            <div>
              <div className="text-xl font-extrabold number-display text-accent-gradient leading-none">
                {total.toLocaleString("es-BO")}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">huellas</div>
            </div>
          </div>
        </div>

        {/* Formulario o estado "ya firmaste" */}
        {signed ? (
          <div className="mt-7 rounded-2xl border border-kev-primary/25 bg-kev-primary/5 px-5 py-6 text-center">
            <Hand className="w-7 h-7 text-kev-primary mx-auto mb-2" />
            <p className="font-display font-bold text-lg">¡Ya estás en el muro! 🖐️</p>
            {myPosition && (
              <p className="text-muted-foreground text-sm mt-1">
                Sos el <b className="text-foreground number-display">#{myPosition}</b> en dejar tu huella.
                Cuando llegue el Mansory, esto va a valer oro.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            {/* Honeypot oculto anti-bots */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
              onChange={(e) => (honeypot.current = e.target.value)}
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                placeholder="Tu nombre *"
                className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
              />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={140}
                placeholder="Tu frase (opcional)"
                className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                maxLength={120}
                placeholder="Tu correo (opcional)"
                className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
              />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                maxLength={30}
                placeholder="WhatsApp (opcional)"
                className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-accent w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm md:text-base font-semibold disabled:opacity-60"
            >
              <Hand className="w-5 h-5" />
              {submitting ? "Guardando..." : "Yo estuve aquí"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Tu correo y WhatsApp son privados — solo para avisarte cuando se cumpla el reto. Nunca spam.
            </p>
          </form>
        )}

        {/* Muro de firmas */}
        {signatures.length > 0 && (
          <div className="mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {visible.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-3"
                >
                  <span className="shrink-0 w-9 h-9 rounded-full accent-gradient-bg text-background flex items-center justify-center text-xs font-bold">
                    {initials(s.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    {s.message && (
                      <div className="text-xs text-muted-foreground truncate">{s.message}</div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(s.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {signatures.length > 9 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? "Ver menos" : `Ver las ${total.toLocaleString("es-BO")} huellas`}
                <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
