import type { Metadata } from "next"
import { Barlow_Condensed } from "next/font/google"
import { CargadorEstudio } from "@/components/casa-blanca/estudio/CargadorEstudio"

// ──────────────────────────────────────────────────────────────
// /casa-blanca/estudio — el estudio que filma los videos de La Casa Blanca
// Project en horizontal (16:9 o 4:3) desde la escena 3D en vivo.
//
// ?ep=<id del calendario o "muestra"> · ?formato=16:9|4:3 · ?visor=cine|camara
// · ?calidad=baja|media|alta · ?render=1 (modo headless, cuadro por cuadro:
// lo usa scripts/casa-blanca-render.mjs).
//
// Es una herramienta, no una página pública: noindex.
// ──────────────────────────────────────────────────────────────

const condensada = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-condensada",
  display: "swap",
})

export const metadata: Metadata = {
  title: { absolute: "Estudio · La Casa Blanca Project" },
  description: "Filma los episodios de La Casa Blanca Project en horizontal, 16:9 o 4:3, desde la escena 3D.",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className={`${condensada.variable} fixed inset-0 z-10 h-[100dvh] overflow-hidden bg-black`}>
      <CargadorEstudio />
    </main>
  )
}
