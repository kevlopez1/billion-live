"use client"

import { useState } from "react"
import { Loader2, Lock, Check, AlertTriangle } from "lucide-react"

// Panel privado (noindex) para actualizar el contador del reto de forma blindada.
// El secreto NO se guarda: vive solo en memoria durante la sesión.
export default function ControlPage() {
  const [secret, setSecret] = useState("")
  const [netWorth, setNetWorth] = useState("")
  const [growth, setGrowth] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [message, setMessage] = useState("")

  const submit = async () => {
    if (!secret) {
      setStatus("error")
      setMessage("Ingresá tu secreto.")
      return
    }
    setStatus("loading")
    setMessage("")
    const body: Record<string, number> = {}
    if (netWorth !== "") body.net_worth = Number(netWorth)
    if (growth !== "") body.monthly_growth = Number(growth)

    try {
      const res = await fetch("/api/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(json.error || "Error al actualizar.")
        return
      }
      setStatus("ok")
      setMessage(`Contador actualizado: $${Number(json.metrics?.net_worth ?? 0).toLocaleString("en-US")}`)
    } catch (e) {
      setStatus("error")
      setMessage("Error de red.")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-sm glass-card p-7">
        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
          <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-[0.18em]">Control privado</span>
        </div>
        <h1 className="text-xl font-medium tracking-tight mb-6">Actualizar contador</h1>

        <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1.5">Secreto</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          className="w-full mb-4 px-4 py-2.5 bg-white/[0.04] border border-border rounded-lg text-sm outline-none focus:border-white/30 transition-colors"
        />

        <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1.5">
          Revenue real de PRIME (USD)
        </label>
        <input
          type="number"
          value={netWorth}
          onChange={(e) => setNetWorth(e.target.value)}
          placeholder="ej. 250"
          className="w-full mb-4 px-4 py-2.5 bg-white/[0.04] border border-border rounded-lg text-sm number-display outline-none focus:border-white/30 transition-colors"
        />

        <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1.5">
          Crecimiento mensual % (opcional)
        </label>
        <input
          type="number"
          value={growth}
          onChange={(e) => setGrowth(e.target.value)}
          placeholder="ej. 12.5"
          className="w-full mb-6 px-4 py-2.5 bg-white/[0.04] border border-border rounded-lg text-sm number-display outline-none focus:border-white/30 transition-colors"
        />

        <button
          onClick={submit}
          disabled={status === "loading"}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 btn-accent rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar
        </button>

        {message && (
          <div
            className={`mt-4 flex items-start gap-2 text-xs ${status === "ok" ? "text-kev-success" : "text-kev-danger"}`}
          >
            {status === "ok" ? (
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <p className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
          Escritura del lado del servidor con service-role. Tu secreto nunca se guarda ni viaja al bundle público.
        </p>
      </div>
    </div>
  )
}
