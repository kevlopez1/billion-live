import { FABRICA_BASE, FABRICA_ID, type ContenidoFabrica } from "@/lib/fabrica-reels"
import { FABRICA_PRIME_BASE, FABRICA_PRIME_ID } from "@/lib/fabrica-prime-al-billon"
import { FABRICA_CASA_BLANCA_BASE, FABRICA_CASA_BLANCA_ID } from "@/lib/fabrica-casa-blanca"

// ──────────────────────────────────────────────────────────────
// CANALES DE LA FÁBRICA — el selector de /fabrica.
//
// /fabrica sin ?canal= es Kev Project GTA, como siempre. Cada canal tiene su
// semilla, su fila en Supabase (fabrica_reels.id) y su metricas.json.
// ──────────────────────────────────────────────────────────────

export type Canal = {
  id: string
  nombre: string
  etiqueta: string
  descripcion: string
  base: ContenidoFabrica
  metricas: string
}

export const CANALES: Canal[] = [
  {
    id: FABRICA_ID,
    nombre: "Kev Project GTA",
    etiqueta: "Kev Project GTA · de $10 a un Mercedes Mansory",
    descripcion: "Cómo se produce cada video del reto De $10 a un Mercedes Mansory: flujo, reglas, referentes, música y ganchos.",
    base: FABRICA_BASE,
    metricas: "/fabrica/metricas.json",
  },
  {
    id: FABRICA_PRIME_ID,
    nombre: "Prime al Billón",
    etiqueta: "Prime al Billón",
    descripcion: "Cómo se produce cada video de Prime al Billón: flujo, reglas, referentes, música y ganchos.",
    base: FABRICA_PRIME_BASE,
    metricas: "/fabrica/prime-al-billon/metricas.json",
  },
  {
    id: FABRICA_CASA_BLANCA_ID,
    nombre: "Casa Blanca",
    etiqueta: "La Casa Blanca Project",
    descripcion: "Cómo se produce cada video de La Casa Blanca Project: la simulación, el guion, las voces, el render y la publicación.",
    base: FABRICA_CASA_BLANCA_BASE,
    // Sin archivo todavía: la sección dice «Todavía no hay métricas cargadas».
    metricas: "/fabrica/casa-blanca/metricas.json",
  },
]

export const CANAL_PRINCIPAL = CANALES[0]

/** Canal por id; cualquier valor desconocido o vacío cae en Kev Project GTA. */
export const canalPorId = (id: string | null | undefined): Canal =>
  CANALES.find((c) => c.id === id) ?? CANAL_PRINCIPAL
