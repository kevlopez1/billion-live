"use client"

import { useState } from "react"
import { ImageDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApp, CHALLENGE_LAUNCH, CHALLENGE_TARGET } from "@/context/app-context"

const SITE = "billion-live.vercel.app"

// Genera una tarjeta 9:16 (story) con el estado actual del reto, en el navegador.
// Sin imágenes externas → sin CORS, sin red. Pura tipografía + formas.
export function ShareCard() {
  const { metrics } = useApp()
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const W = 1080
      const H = 1920
      const c = document.createElement("canvas")
      c.width = W
      c.height = H
      const ctx = c.getContext("2d")
      if (!ctx) throw new Error("no-canvas")

      const net = metrics.netWorth
      const target = CHALLENGE_TARGET
      const pct = Math.min(100, (net / target) * 100)
      const day = Math.max(
        1,
        Math.floor((Date.now() - new Date(CHALLENGE_LAUNCH + "T00:00:00").getTime()) / 86_400_000) + 1,
      )

      // Fondo
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, W, H)
      // Halo sutil arriba
      const g = ctx.createRadialGradient(W / 2, 280, 60, W / 2, 280, 700)
      g.addColorStop(0, "rgba(255,255,255,0.08)")
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, 900)

      ctx.textAlign = "center"

      // Eyebrow EN VIVO
      ctx.fillStyle = "rgba(255,255,255,0.55)"
      ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText("• EN VIVO · EL RETO •", W / 2, 250)

      // Wordmark
      ctx.fillStyle = "#ffffff"
      ctx.font = "800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText("KEV PROJECT GTA", W / 2, 340)

      // Contador gigante
      ctx.fillStyle = "#ffffff"
      ctx.font = "900 220px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText(`$${net.toLocaleString("en-US")}`, W / 2, 780)

      ctx.fillStyle = "rgba(255,255,255,0.45)"
      ctx.font = "700 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText(`de $${target.toLocaleString("en-US")}`, W / 2, 880)

      // Barra de progreso
      const barX = 140
      const barW = W - barX * 2
      const barY = 980
      const barH = 26
      const r = barH / 2
      const rr = (x: number, w: number) => {
        ctx.beginPath()
        ctx.roundRect(x, barY, Math.max(w, barH), barH, r)
        ctx.fill()
      }
      ctx.fillStyle = "rgba(255,255,255,0.14)"
      rr(barX, barW)
      ctx.fillStyle = "#ffffff"
      rr(barX, (barW * pct) / 100)

      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText(`${pct.toFixed(pct < 1 ? 4 : 1)}% al Mercedes  ·  Día ${day}`, W / 2, 1080)

      // Frase
      ctx.fillStyle = "#ffffff"
      ctx.font = "800 72px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText("De $10 a un", W / 2, 1340)
      ctx.fillText("Mercedes-AMG GT 63", W / 2, 1430)
      ctx.fillStyle = "rgba(255,255,255,0.55)"
      ctx.font = "700 56px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText("by Mansory", W / 2, 1510)

      // Pie
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      ctx.font = "600 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText("@kev.project.gta", W / 2, 1740)
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      ctx.fillText(SITE, W / 2, 1800)

      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error("no-blob"))), "image/png"),
      )
      const file = new File([blob], "kev-project-gta.png", { type: "image/png" })

      const navAny = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean
      }
      if (navAny.canShare && navAny.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: "KEV PROJECT GTA",
          text: `De $10 a un Mercedes-AMG Mansory · Día ${day} 🏁 ${SITE}`,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "kev-project-gta.png"
        a.click()
        URL.revokeObjectURL(url)
        toast.success("¡Tarjeta lista! Subila a tu story 🔥")
      }
    } catch {
      toast.error("No se pudo generar la imagen. Probá de nuevo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="lift inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-5 py-4 text-sm font-semibold hover:border-foreground/20 transition-colors disabled:opacity-60 w-full"
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageDown className="w-5 h-5" />}
      {busy ? "Generando..." : "Bajar tarjeta para tu story"}
    </button>
  )
}
