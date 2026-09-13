"use client"

import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { SITE_URL } from "@/lib/site"
import { EV, track } from "@/lib/track"

// ──────────────────────────────────────────────────────────────
// COMPARTIR
//
// Un solo toque: comparte el link. Antes abría un menú con dos opciones, y la
// segunda generaba una imagen aparte — una placa que no seguía la identidad
// del sitio y que además repetía peor lo que el link ya hace solo: al pegarlo
// en WhatsApp, Instagram o X sale la tarjeta de /opengraph-image, con el
// contador EN VIVO y los colores de la marca.
//
// Menos pasos y mejor resultado: se quitó el menú y la generación de imagen.
// ──────────────────────────────────────────────────────────────

const TEXTO = "De $10 a un Mercedes Mansory, en público desde Bolivia 🏁 Mira el reto en vivo:"

export function ShareButton({ className = "" }: { className?: string }) {
  const compartir = async () => {
    try {
      // En el celular abre la hoja de compartir del sistema; en escritorio no
      // existe, así que se copia el link.
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "KEV PROJECT GTA", text: TEXTO, url: SITE_URL })
        track(EV.COMPARTIR, { metodo: "nativo" })
      } else {
        await navigator.clipboard.writeText(`${TEXTO} ${SITE_URL}`)
        track(EV.COMPARTIR, { metodo: "copiar" })
        toast.success("¡Link copiado! Compártelo 🔥")
      }
    } catch {
      // La persona canceló el compartir: no es un error.
    }
  }

  return (
    <button
      onClick={compartir}
      className={`btn-accent inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold sm:px-3.5 sm:text-sm ${className}`}
    >
      <Share2 className="w-4 h-4" />
      {/* A 360 px los dos botones del header no entran: aquí queda solo el ícono */}
      <span className="max-[380px]:hidden">Compartir</span>
    </button>
  )
}
