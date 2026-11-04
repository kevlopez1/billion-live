import type { Metadata } from "next"
import { Fabrica } from "@/components/fabrica-reels/fabrica"
import { canalPorId } from "@/lib/fabrica-canales"

// ──────────────────────────────────────────────────────────────
// /fabrica — la Fábrica de Reels: cómo se produce cada video del reto.
// Se ve sin clave; editar, mover y escribir notas pide la clave de Kev.
// ?canal=prime-al-billon abre otro canal; sin parámetro, Kev Project GTA.
// ──────────────────────────────────────────────────────────────

type Props = { searchParams: Promise<{ canal?: string | string[] }> }

const leerCanal = async (searchParams: Props["searchParams"]) => {
  const { canal } = await searchParams
  return canalPorId(Array.isArray(canal) ? canal[0] : canal)
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const canal = await leerCanal(searchParams)
  return {
    title: `Fábrica de reels · ${canal.nombre}`,
    description: canal.descripcion,
    robots: { index: false, follow: false },
  }
}

export default async function FabricaPage({ searchParams }: Props) {
  const canal = await leerCanal(searchParams)
  return <Fabrica key={canal.id} canalId={canal.id} />
}
