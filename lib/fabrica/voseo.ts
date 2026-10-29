// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · VOSEO (la lista de scripts/sin-voseo.py, en TypeScript)
//
// Un guion que escribe una IA puede traer "querés" o "mirá": aquí se cortan
// antes de que lleguen a un video. La lista es la misma del detector de la
// web; voseo.test (en guardas.test.ts) lee el .py y exige que estén todas.
// Cada línea con formas lleva la marca para que el detector no la cuente.
// ──────────────────────────────────────────────────────────────

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
]

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// Igual que el PAT del .py: la forma entera, sin letra pegada antes ni después. Distingue mayúsculas, como el .py.
const PATRON = new RegExp(`(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])(${FORMAS_VOSEO.map(escapar).join("|")})(?![A-Za-zÁÉÍÓÚáéíóúñÑ])`, "g")

/** Las formas de voseo que tiene un texto (vacío = está en español neutro). */
export function formasDeVoseo(texto: string): string[] {
  return [...texto.matchAll(PATRON)].map((m) => m[1])
}

/** Las razones, en español, por las que un texto no pasa. `donde` dice qué texto es ("título", "plano 3"…). */
export function voseo(texto: string, donde = "texto"): string[] {
  const f = formasDeVoseo(texto)
  return f.length ? [`${donde}: tiene voseo (${[...new Set(f)].join(", ")}); va en español neutro`] : []
}
