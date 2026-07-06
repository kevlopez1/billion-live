"use client"

import { useRef, useState } from "react"
import { Megaphone, Eye, Users, Clock, Handshake } from "lucide-react"
import { toast } from "sonner"

const plans = [
  { id: "dia", label: "Sponsor del día" },
  { id: "semana", label: "Sponsor de la semana" },
  { id: "otro", label: "A definir" },
]

const valueProps = [
  { icon: Eye, t: "Exposición real", d: "Tu marca en el sitio y en el contenido del reto." },
  { icon: Users, t: "Audiencia fiel", d: "Gente que sigue el reto en vivo, no scroll frío." },
  { icon: Clock, t: "Desde temprano", d: "Entrá cuando es barato y crecés con el reto." },
]

export function Sponsors() {
  const [company, setCompany] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [message, setMessage] = useState("")
  const [plan, setPlan] = useState("semana")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const honeypot = useRef("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    if (!company.trim()) return toast.error("Poné el nombre de tu empresa/marca.")
    if (!email.trim() && !whatsapp.trim()) return toast.error("Dejá un correo o WhatsApp.")
    setSending(true)
    try {
      const res = await fetch("/api/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, name, email, whatsapp, message, plan, website: honeypot.current }),
      })
      const data = await res.json()
      if (data.configured === false) {
        toast("Escribime por DM a @kev.project.gta y lo armamos 🤝", { duration: 6000 })
        return
      }
      if (!res.ok) return toast.error(data.error || "No se pudo enviar. Probá de nuevo.")
      setDone(true)
      toast.success("¡Recibido! Te contacto pronto 🤝")
    } catch {
      toast.error("Falló la conexión. Probá de nuevo.")
    } finally {
      setSending(false)
    }
  }

  return (
    <section>
      <div className="mb-6 border-b border-border pb-4">
        <div className="section-eyebrow">Sponsors</div>
        <h2 className="mt-2 leading-[0.95]">
          <span className="font-display font-extrabold uppercase tracking-tighter text-2xl md:text-4xl">Poné tu marca </span>
          <span className="font-serif-display italic text-2xl md:text-4xl text-rojo">en el reto</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-lg">
          Sponsor del día o de la semana: tu marca frente a la audiencia que sigue el reto en vivo, desde el Día 1.
        </p>
      </div>

      {/* Value props */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {valueProps.map((v) => (
          <div key={v.t} className="lift rounded-2xl border border-border bg-card/40 px-4 py-4 hover:border-foreground/20">
            <v.icon className="w-5 h-5 text-kev-primary mb-2" strokeWidth={1.75} />
            <div className="font-semibold text-sm">{v.t}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{v.d}</div>
          </div>
        ))}
      </div>

      {done ? (
        <div className="rounded-2xl border border-kev-primary/25 bg-kev-primary/5 px-5 py-7 text-center">
          <Handshake className="w-7 h-7 text-kev-primary mx-auto mb-2" />
          <p className="font-display font-bold text-lg">¡Recibido!</p>
          <p className="text-sm text-muted-foreground mt-1">Te contacto pronto para coordinar. Gracias por sumarte.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => (honeypot.current = e.target.value)}
          />

          {/* Plan */}
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  plan === p.id
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={80}
              required
              placeholder="Empresa / marca *"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Tu nombre"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              maxLength={120}
              placeholder="Correo"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
            />
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              maxLength={30}
              placeholder="WhatsApp"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors"
            />
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Contame de tu marca y qué buscás (opcional)"
            className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-kev-primary/50 transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={sending}
            className="btn-accent w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm md:text-base font-semibold disabled:opacity-60"
          >
            <Megaphone className="w-5 h-5" />
            {sending ? "Enviando..." : "Quiero ser sponsor"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Te llega directo a Kev. Sin compromiso — coordinamos por privado.
          </p>
        </form>
      )}
    </section>
  )
}
