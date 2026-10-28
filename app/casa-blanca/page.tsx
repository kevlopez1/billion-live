import type { Metadata } from "next"
import { Barlow_Condensed } from "next/font/google"
import { Cargador } from "@/components/casa-blanca/ui/Cargador"

// ──────────────────────────────────────────────────────────────
// /casa-blanca — La Casa Blanca Project.
//
// Pantalla completa y sin scroll: la cámara se maneja con gestos y la página
// no puede moverse debajo. La condensada (Barlow Condensed) se carga solo
// aquí, para el dinero y los títulos del HUD.
// ──────────────────────────────────────────────────────────────

const condensada = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-condensada",
  display: "swap",
})

const TITULO = "La Casa Blanca Project"
const DESCRIPCION =
  "Ficción interactiva en 3D: 22 líderes de la historia y de hoy, y dos IA, viven en la Casa Blanca y dirigen 2.200 agentes de IA que trabajan para los objetivos reales de Kev López."

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRIPCION,
  alternates: { canonical: "/casa-blanca" },
  openGraph: {
    type: "website",
    locale: "es_BO",
    url: "/casa-blanca",
    siteName: "KEV PROJECT GTA",
    title: TITULO,
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    creator: "@kev.project.gta",
  },
}

export default function Page() {
  return (
    <main className={`${condensada.variable} fixed inset-0 z-10 h-[100dvh] overflow-hidden overscroll-none bg-black`}>
      <Cargador />
    </main>
  )
}
