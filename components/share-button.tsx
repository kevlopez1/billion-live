"use client"

import { Share2 } from "lucide-react"
import { toast } from "sonner"

const URL = "https://billion-live.vercel.app"
const TEXT = "De $10 a un Mercedes-AMG Mansory, en público desde Bolivia 🏁 Mirá el reto en vivo:"

export function ShareButton({ className = "" }: { className?: string }) {
  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "KEV PROJECT GTA", text: TEXT, url: URL })
      } else {
        await navigator.clipboard.writeText(`${TEXT} ${URL}`)
        toast.success("¡Link copiado! Compartilo 🔥")
      }
    } catch {
      /* el usuario canceló el share */
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`btn-accent inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${className}`}
    >
      <Share2 className="w-4 h-4" />
      Compartir
    </button>
  )
}
