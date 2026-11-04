import type { Metadata } from "next"
import { Fabrica } from "@/components/fabrica-reels/fabrica"

// ──────────────────────────────────────────────────────────────
// /fabrica — la Fábrica de Reels: cómo se produce cada video del reto.
// Se ve sin clave; editar, mover y escribir notas pide la clave de Kev.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Fábrica de reels · Kev Project GTA",
  description: "Cómo se produce cada video del reto De $10 a un Mercedes Mansory: flujo, reglas, referentes, música y ganchos.",
  robots: { index: false, follow: false },
}

export default function FabricaPage() {
  return <Fabrica />
}
