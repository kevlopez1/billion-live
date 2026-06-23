"use client"

import { useRef, useState } from "react"
import { BellRing, Check } from "lucide-react"
import { toast } from "sonner"

const triggers = [
  { id: "1000", label: "Llegue a $1.000" },
  { id: "10000", label: "Llegue a $10.000" },
  { id: "auto", label: "Compre el Mercedes" },
  { id: "todo", label: "Cada hito" },
]

export function NotifyForm() {
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [trigger, setTrigger] = useState("todo")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const honeypot = useRef("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    if (!email.trim() && !whatsapp.trim()) return toast.error("Dejá un correo o WhatsApp.")
    setSending(true)
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, whatsapp, trigger, website: honeypot.current }),
      })
      const data = await res.json()
      if (data.configured === false) {
        toast("Seguime en @kev.project.gta para no perderte ningún hito 🔔", { duration: 6000 })
        setDone(true)
        return
      }
      if (!res.ok) return toast.error(data.error || "No se pudo guardar. Probá de nuevo.")
      setDone(true)
      toast.success("¡Listo! Te aviso cuando pase 🔔")
    } catch {
      toast.error("Falló la conexión. Probá de nuevo.")
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-kev-primary/25 bg-kev-primary/5 px-5 py-7 text-center">
        <Check className="w-7 h-7 text-kev-primary mx-auto mb-2" />
        <p className="font-display font-bold text-lg">¡Anotado! 🔔</p>
        <p className="text-sm text-muted-foreground mt-1">Te aviso apenas el reto llegue a ese hito.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card/40 px-5 py-6 md:px-7 md:py-7">
      <div className="flex items-center gap-2 mb-1.5">
        <BellRing className="w-5 h-5 text-kev-primary" />
        <h3 className="font-display font-bold text-lg md:text-xl tracking-tight">Avisame cuando pase</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5 max-w-md">
        Te aviso en el momento exacto en que el reto alcance el hito que elijas. Sin spam — solo el hito.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
          onChange={(e) => (honeypot.current = e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          {triggers.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => setTrigger(tr.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                trigger === tr.id
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            maxLength={120}
            placeholder="Tu correo"
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

        <button
          type="submit"
          disabled={sending}
          className="btn-accent w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm md:text-base font-semibold disabled:opacity-60"
        >
          <BellRing className="w-5 h-5" />
          {sending ? "Guardando..." : "Avisame"}
        </button>
      </form>
    </div>
  )
}
