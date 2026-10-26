import type { Metadata } from "next"
import { Espacio } from "@/components/proyectos/espacio"

// ──────────────────────────────────────────────────────────────
// /branding — el espacio de trabajo: el manual de marca, Preguntas, Videos y
// el área de Kev López (con clave). Kev: "conserva el link de branding y
// borra el otro".
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Kev Project GTA Branding",
  robots: { index: false, follow: false, nocache: true },
}

export default function BrandingPage() {
  return <Espacio />
}
