import type { Metadata } from "next"
import { Espacio } from "@/components/proyectos/espacio"

// ──────────────────────────────────────────────────────────────
// EL ESPACIO DE PROYECTOS DE KEV: notas tipo Notion + mapa mental.
//
// Privado de verdad: la API exige la clave de administrador hasta para LEER, y
// el contenido inicial vive en el servidor, no en este JavaScript. Además va
// noindex, fuera del sitemap y bloqueado en robots.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Proyectos",
  robots: { index: false, follow: false, nocache: true },
}

export default function ProyectosPage() {
  return <Espacio />
}
