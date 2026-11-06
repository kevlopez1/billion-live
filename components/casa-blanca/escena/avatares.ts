// ──────────────────────────────────────────────────────────────
// LOS PERSONAJES EN 3D
//
// Personajes semirrealistas generados con código, sin modelos ni servicios
// externos. Todo sale de la Apariencia de cada uno (datos/personajes.ts),
// corregida por su ficha física (avatar-fichas.ts: estatura, contextura,
// cara, edad, piel, pelo, barba y cejas, para que se reconozca a cada uno):
//
//   avatar-fichas.ts      las fichas por id y el motor que las resuelve en números.
//   avatar-cuerpo.ts      proporciones reales, esqueleto de 36 huesos y piel:
//                         tronco, cuello y cabeza en UNA malla continua;
//                         brazos con manos de cinco dedos; piernas y pies.
//   avatar-cabeza.ts      la cabeza esculpida con un campo de distancia
//                         (nariz, labios, párpados, mandíbula, papada…), la
//                         boca que se abre al hablar, y máscaras de pelo,
//                         cejas y barba.
//   avatar-ropa.ts        la ropa como capas que siguen al cuerpo (traje con
//                         solapas y corbata, túnicas con pliegues, uniforme,
//                         camiseta 24…), sombreros, gafas y accesorios.
//   avatar-pelo.ts        pelo en capas con hebras, mechones largos, barba por
//                         zonas, cejas con volumen y pestañas.
//   avatar-materiales.ts  piel con dispersión, tejidos, pelo, ojos, holograma.
//   avatar-texturas.ts    texturas procedurales (CanvasTexture).
//   avatar-anim.ts        caminar y correr con los pies plantados, sentarse y
//                         teclear, hablar con gestos, dormir, deporte, parpadeo.
//   avatar-armado.ts      arma todo y cumple el contrato Avatar.
//
// Mira hacia +z (el motor gira la raíz con el rumbo) y mide `altura` metros
// con los pies en y = 0.
// ──────────────────────────────────────────────────────────────

import type { Avatar } from "./contrato"
import type { Personaje } from "../tipos"
import { crearAvatarReal } from "./avatar-armado"

export function crearAvatar(p: Personaje): Avatar {
  return crearAvatarReal(p)
}
