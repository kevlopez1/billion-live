"use client"

import { useEffect, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import { WHATSAPP_COMMUNITY } from "@/components/social-links"

const KEY = "kev-wa-popup-dismissed"

// Popup no invasivo que invita a la comunidad de WhatsApp mientras navegan.
// Aparece después de unos segundos, se puede cerrar y no vuelve a molestar.
export function WhatsAppPopup() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
    } catch {}
    const t = setTimeout(() => setShow(true), 14000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(KEY, "1")
    } catch {}
  }

  if (!show) return null

  return (
    <div className="fixed z-50 left-3 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm animate-fade-in-up">
      <div className="relative rounded-2xl border border-border bg-popover backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-4 pr-10">
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm tracking-tight">Unite a la comunidad</div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Grupo de WhatsApp del reto — detrás de escena, avisos y la comunidad en vivo.
            </p>
            <a
              href={WHATSAPP_COMMUNITY}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="btn-accent mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              Unirme al grupo
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
