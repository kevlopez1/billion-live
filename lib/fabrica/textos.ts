// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL TEXTO DE CADA PUBLICACIÓN (puro)
//
// Un video, cinco redes, cinco textos armados por código, nunca por la IA:
//   1. «Ficción hecha con IA. …» (exacta, primera línea, en todas)
//   2. el título (48 caracteres o menos)
//   3. una línea de descripción, si la hay
//   4. kevproject.world/casa-blanca (menos en X: con URL cada post cuesta
//      $0,20 en vez de $0,015; el enlace va en la bio)
//   5. #LaCasaBlancaProject + 2 del pilar
// guardas.ts (textoValido) los vuelve a revisar antes de subir.
// ──────────────────────────────────────────────────────────────

import type { Red } from "@/components/casa-blanca/estudio/guion"

/** La primera línea de todo texto publicado. Exacta: textoValido la compara carácter por carácter. */
export const FICCION = "Ficción hecha con IA. Personajes inspirados en figuras reales; no son ellas ni hablan por ellas."
export const WEB_CASA = "kevproject.world/casa-blanca"
export const HASHTAG_CASA = "#LaCasaBlancaProject"
export const MAX_TITULO = 48

export const REDES: readonly Red[] = ["youtube", "facebook", "instagram", "tiktok", "x"]

/** Los pilares de la fábrica (10-CASA-BLANCA-PROJECT.md) y sus dos etiquetas. A decidir por Kev. */
export const PILARES = {
  "camara-oculta": ["#CámaraOculta", "#FicciónConIA"],
  historia: ["#Historia", "#FicciónConIA"],
  consejo: ["#ElConsejo", "#Estrategia"],
} as const satisfies Record<string, readonly [string, string]>
export type Pilar = keyof typeof PILARES
export const esPilar = (x: unknown): x is Pilar => typeof x === "string" && Object.prototype.hasOwnProperty.call(PILARES, x)

/** Largo máximo del texto por red (X cuenta cada carácter latino como 1). */
export const MAX_TEXTO: Record<Red, number> = { x: 280, instagram: 2200, tiktok: 2200, youtube: 5000, facebook: 5000 }

export interface VideoParaTexto {
  titulo: string
  pilar: Pilar
  /** Una frase que cuenta de qué trata. Opcional; en X se cae si no entra. */
  descripcion?: string
}

/** Cuenta como X: por carácter visible, no por unidad UTF-16. */
export const largo = (s: string) => [...s].length

const limpio = (s: string) => s.replace(/\s+/g, " ").trim()

/** El texto de un video para una red. */
export function textoDe(v: VideoParaTexto, red: Red): string {
  const etiquetas = [HASHTAG_CASA, ...PILARES[v.pilar]].join(" ")
  const bloques = (desc: boolean) =>
    [FICCION, limpio(v.titulo), desc && v.descripcion ? limpio(v.descripcion) : "", red === "x" ? "" : WEB_CASA, etiquetas]
      .filter(Boolean)
      .join("\n\n")
  const completo = bloques(true)
  // En X la descripción es lo único que se puede sacar para entrar en 280.
  return largo(completo) <= MAX_TEXTO[red] ? completo : bloques(false)
}

/** Los cinco textos de un video. */
export function textosDe(v: VideoParaTexto, redes: readonly Red[] = REDES): Partial<Record<Red, string>> {
  const r: Partial<Record<Red, string>> = {}
  for (const red of redes) r[red] = textoDe(v, red)
  return r
}
