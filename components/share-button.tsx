"use client"

import { useEffect, useRef, useState } from "react"
import { Share2, Link2, ImageDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApp } from "@/context/app-context"
import { downloadStoryCard } from "@/lib/story-card"

const URL_SITE = "https://billion-live.vercel.app"
const TEXT = "De $10 a un Mercedes-AMG Mansory, en público desde Bolivia 🏁 Mirá el reto en vivo:"

export function ShareButton({ className = "" }: { className?: string }) {
  const { metrics } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const shareLink = async () => {
    setOpen(false)
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "KEV PROJECT GTA", text: TEXT, url: URL_SITE })
      } else {
        await navigator.clipboard.writeText(`${TEXT} ${URL_SITE}`)
        toast.success("¡Link copiado! Compartilo 🔥")
      }
    } catch {
      /* el usuario canceló el share */
    }
  }

  const shareCard = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await downloadStoryCard(metrics.netWorth)
      // En móvil se abre el compartir nativo (ya es su confirmación) → sin toast.
      // En escritorio se descarga el archivo → avisamos brevemente.
      if (res === "downloaded") {
        toast.success("¡Imagen guardada! Ya podés compartirla 🔥", { duration: 4000 })
      }
    } catch {
      toast.error("No se pudo generar la imagen. Probá de nuevo.", { duration: 4000 })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn-accent inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${className}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        Compartir
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-popover backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-1.5 z-50"
        >
          <button
            role="menuitem"
            onClick={shareLink}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-foreground/5 transition-colors"
          >
            <Link2 className="w-4 h-4 text-kev-primary shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Compartir el reto</span>
              <span className="block text-[11px] text-muted-foreground">Mandá el link de la web</span>
            </span>
          </button>
          <button
            role="menuitem"
            onClick={shareCard}
            disabled={busy}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-foreground/5 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin text-kev-primary shrink-0" />
            ) : (
              <ImageDown className="w-4 h-4 text-kev-primary shrink-0" />
            )}
            <span>
              <span className="block text-sm font-semibold">Imagen para compartir</span>
              <span className="block text-[11px] text-muted-foreground">Story, WhatsApp, TikTok…</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
