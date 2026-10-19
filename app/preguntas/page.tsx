import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, NotebookPen } from "lucide-react"
import { Tablero } from "@/components/preguntas/tablero"
import { Volver } from "@/components/volver"

// ──────────────────────────────────────────────────────────────
// PREGUNTAS ABIERTAS
//
// Privada de verdad: la API pide clave también para leer. Aquí hay nombres de
// personas reales y preguntas de dinero. noindex además, por si acaso.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Preguntas abiertas",
  robots: { index: false, follow: false, nocache: true },
}

export default function PreguntasPage() {
  return (
    <>
      <Tablero />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-5 gap-y-2 px-5 pb-16">
        <Volver className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al reto
        </Volver>
        <Link
          href="/kevlopez_proyectos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <NotebookPen className="h-3.5 w-3.5" /> Proyectos de Kev López
        </Link>
      </div>
    </>
  )
}
