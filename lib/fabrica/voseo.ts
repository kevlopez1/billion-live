// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · VOSEO (la lista de scripts/sin-voseo.py, en TypeScript)
//
// Un guion que escribe una IA puede traer "querés" o "mirá": aquí se cortan
// antes de que lleguen a un video. La lista es la misma del detector de la
// web (y unas más); voseo.test (en guardas.test.ts) lee el .py y exige que estén todas.
// Cada línea con formas lleva la marca para que el detector no la cuente.
// ──────────────────────────────────────────────────────────────

import { limpiar } from "./normalizar"

export const FORMAS_VOSEO: readonly string[] = [
  "Poné", "poné", "Ponés", "ponés", "Dejá", "dejá", "Dejás", "dejás", "Mandá", "mandá", "Mandame", "mandame", // sin-voseo:ejemplos
  "Entrá", "entrá", "Entrás", "entrás", "Mirá", "mirá", "Mirás", "mirás", "Firmá", "firmá", "Elegí", "elegí", // sin-voseo:ejemplos
  "Elegís", "elegís", "Sumate", "sumate", "Sumá", "sumá", "Contame", "contame", "Decime", "decime", // sin-voseo:ejemplos
  "Quedate", "quedate", "Probá", "probá", "Probás", "probás", "Andá", "andá", "Volvé", "volvé", // sin-voseo:ejemplos
  "Compartí", "compartí", "Escribí", "escribí", "Sacá", "sacá", "Buscá", "buscá", "Revisá", "revisá", // sin-voseo:ejemplos
  "Agregá", "agregá", "Pedí", "pedí", "Cerrá", "cerrá", "Tocá", "tocá", "Llevá", "llevá", "Guardá", "guardá", // sin-voseo:ejemplos
  "Aprovechá", "aprovechá", "Seguí", "seguí", "Anotate", "anotate", "Registrate", "registrate", // sin-voseo:ejemplos
  "Compartilo", "compartilo", "Compartila", "compartila", "Mandalo", "mandalo", "Mandala", "mandala", // sin-voseo:ejemplos
  "Mirala", "mirala", "Miralo", "miralo", "Dejalo", "dejalo", "Dejala", "dejala", "Tomalo", "tomalo", // sin-voseo:ejemplos
  "Ponelo", "ponelo", "Ponela", "ponela", "Probalo", "probalo", "Probala", "probala", "Usalo", "usalo", // sin-voseo:ejemplos
  "Contalo", "contalo", "Guardalo", "guardalo", "Revisalo", "revisalo", "Buscalo", "buscalo", // sin-voseo:ejemplos
  "Seguilo", "seguilo", "Sumalo", "sumalo", "Anotalo", "anotalo", "Elegilo", "elegilo", // sin-voseo:ejemplos
  "querés", "Querés", "podés", "Podés", "tenés", "Tenés", "sabés", "Sabés", "hacés", "Hacés", "Sos", "sos", // sin-voseo:ejemplos
  "vivís", "construís", "Construís", "vendés", "Vendés", "llamás", "Llamás", "creés", "Creés", // sin-voseo:ejemplos
  "venís", "Venís", "ganás", "Ganás", "acá", "Acá", "vos", "Vos", "Metele", "Fijate", "fijate", // sin-voseo:ejemplos
  // Más que el .py: el texto de un modelo es abierto, no el copy fijo de la web (tabla del CLAUDE.md y frecuentes).
  "esperá", "creá", "pensá", "escuchá", "decí", "hacé", "vení", "tené", "hablá", "llamá", "jugá", "pagá", "andate", // sin-voseo:ejemplos
  "imaginate", "acordate", "olvidate", "vivís", "sentís", "decís", "pensás", "che", "boludo", "boluda", // sin-voseo:ejemplos
]

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// Como el PAT del .py (la forma entera, sin letra pegada antes ni después),
// pero SIN distinguir mayúsculas: un título en mayúsculas («MIRÁ ESTO») también cae.
const PATRON = new RegExp(`(?<![\\p{L}])(${[...new Set(FORMAS_VOSEO.map((f) => f.toLowerCase()))].map(escapar).join("|")})(?![\\p{L}])`, "giu")

/** Las formas de voseo que tiene un texto (vacío = está en español neutro). Se mira también limpio (tildes en NFD, letras parecidas). */
export function formasDeVoseo(texto: string): string[] {
  const out: string[] = []
  for (const v of new Set([texto.normalize("NFC"), limpiar(texto)])) for (const m of v.matchAll(PATRON)) out.push(m[1])
  return [...new Set(out)]
}

/** Las razones, en español, por las que un texto no pasa. `donde` dice qué texto es ("título", "plano 3"…). */
export function voseo(texto: string, donde = "texto"): string[] {
  const f = formasDeVoseo(texto)
  return f.length ? [`${donde}: tiene voseo (${[...new Set(f)].join(", ")}); va en español neutro`] : []
}
