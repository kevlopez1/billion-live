import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { Panel } from "@/components/branding/panel"
import { Volver } from "@/components/volver"
import { CONTENIDO_BASE } from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// EL MANUAL DE MARCA Y CONTENIDO
//
// noindex y sin enlace desde ninguna parte: aquí está el método con el que se
// construye el contenido, y eso no es material público. Ojo: noindex NO es
// privado — quien tenga la dirección entra y lo lee. Para escribir sí hace
// falta la clave de administrador, la misma de /control.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Branding y contenido",
  robots: { index: false, follow: false, nocache: true },
}

export default function BrandingPage() {
  const { meta } = CONTENIDO_BASE
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16">
      <Panel />
      <div className="sr-only">
        <h1>{meta.titulo}</h1>
        <p>{meta.bajada}</p>
      </div>
      <Volver className="mt-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al reto
      </Volver>
    </main>
  )
}
