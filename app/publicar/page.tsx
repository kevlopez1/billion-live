"use client"

import { useState } from "react"
import { AlertTriangle, Check, ExternalLink, Loader2, Lock, Send } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// /publicar — una pieza, Instagram y Facebook a la vez.
//
// La clave no se guarda: vive en memoria mientras la pestaña está abierta,
// igual que en /control. El token de Meta nunca pasa por aquí: vive en Vercel
// y lo usa el servidor.
// ──────────────────────────────────────────────────────────────

type Resultado = { ok: true; id: string; enlace?: string } | { ok: false; error: string }
const RED = { ig: "Instagram", fb: "Facebook" } as const

export default function PublicarPage() {
  const [clave, setClave] = useState("")
  const [tipo, setTipo] = useState<"video" | "foto">("video")
  const [url, setUrl] = useState("")
  const [texto, setTexto] = useState("")
  const [destinos, setDestinos] = useState<Record<"ig" | "fb", boolean>>({ ig: true, fb: true })
  const [estado, setEstado] = useState<"quieto" | "enviando" | "listo" | "error">("quieto")
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<Partial<Record<"ig" | "fb", Resultado>>>({})

  const enviar = async () => {
    setEstado("enviando")
    setError("")
    setResultado({})
    try {
      const r = await fetch("/api/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({
          tipo,
          url,
          texto,
          destinos: (Object.keys(destinos) as ("ig" | "fb")[]).filter((d) => destinos[d]),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (j.resultado) setResultado(j.resultado)
      if (!r.ok && !j.resultado) {
        setEstado("error")
        setError(j.error || "No se pudo publicar.")
        return
      }
      setEstado(r.ok ? "listo" : "error")
    } catch {
      setEstado("error")
      setError("Error de red. Revisa tu conexión.")
    }
  }

  const listo = clave && url && (destinos.ig || destinos.fb) && estado !== "enviando"
  const campo =
    "w-full rounded-lg border border-border bg-foreground/[0.04] px-4 py-2.5 text-sm outline-none transition-colors focus:border-foreground/30"
  const etiqueta = "mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="glass-card w-full max-w-md p-7">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-[0.18em]">Privado</span>
        </div>
        <h1 className="mb-6 text-xl font-medium tracking-tight">Publicar</h1>

        <label className={etiqueta}>Clave</label>
        <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="ADMIN_SECRET" className={`${campo} mb-4`} />

        <span className={etiqueta}>Qué es</span>
        <div className="mb-4 flex gap-2">
          {(["video", "foto"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                tipo === t ? "border-foreground/40 bg-foreground/[0.07] font-semibold" : "border-border text-muted-foreground"
              }`}
            >
              {t === "video" ? "Video (reel)" : "Foto"}
            </button>
          ))}
        </div>

        <label className={etiqueta}>Dirección pública del archivo</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
          className={`${campo} mb-1.5`}
        />
        <p className="mb-4 text-[11.5px] leading-snug text-muted-foreground">
          Meta va a buscar el archivo a esa dirección: tiene que abrirse sin iniciar sesión.
        </p>

        <label className={etiqueta}>
          Texto <span className="normal-case tracking-normal">· {texto.length}/2.200</span>
        </label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={2200} className={`${campo} mb-4 resize-y`} />

        <span className={etiqueta}>Dónde</span>
        <div className="mb-6 flex gap-4">
          {(["ig", "fb"] as const).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={destinos[d]} onChange={(e) => setDestinos((x) => ({ ...x, [d]: e.target.checked }))} />
              {RED[d]}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={enviar}
          disabled={!listo}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {estado === "enviando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {estado === "enviando" ? (tipo === "video" ? "Publicando · un video tarda hasta un minuto" : "Publicando…") : "Publicar"}
        </button>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {(Object.keys(resultado) as ("ig" | "fb")[]).map((d) => {
          const r = resultado[d]
          if (!r) return null
          return (
            <div key={d} className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${r.ok ? "border-kev-success/40" : "border-destructive/40"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {r.ok ? <Check className="h-4 w-4 text-kev-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                {RED[d]}: {r.ok ? "publicado" : "no salió"}
              </div>
              {r.ok && r.enlace && (
                <a href={r.enlace} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground underline">
                  Ver la publicación <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!r.ok && <p className="mt-1 text-[12.5px] text-muted-foreground">{r.error}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
