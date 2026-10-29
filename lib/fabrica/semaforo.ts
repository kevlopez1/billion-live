// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL SEMÁFORO POR PERSONAJE (dato, no prompt)
//
// Quién puede salir en un video que se publica solo, y cómo:
// - verde: sale solo.
// - amarillo: sale solo con el OK de Kev (aprobación en /publicar). Nunca en la reserva.
// - vivo: solo de fondo. Sin voz, sin diálogo, sin cámara encima, nunca en
//   un título, un rótulo, la miniatura ni los textos de publicación.
// - fuera: no aparece. Ni en cuadro ni nombrado.
//
// La luz se decide por la FECHA DE SALIDA del video (día de Bolivia), no por
// el día en que se escribe: un guion escrito el 9-nov que sale el 11-nov se
// juzga con la regla del 11. Un id que no está aquí es "fuera".
//
// Fuente: kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md, sección 6,
// y docs/fabrica/ESPECIFICACION.md, sección 4.
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { cumple, sinTildes, variantes } from "./normalizar"

export type Luz = "verde" | "amarillo" | "vivo" | "fuera"

export interface EntradaSemaforo {
  luz: Luz
  /** Desde ese día de Bolivia ("AAAA-MM-DD", inclusive) la luz pasa a ser otra. */
  cambios?: Array<{ desde: string; luz: Luz }>
  /**
   * Cómo se lo nombra en un texto, además de su nombre y su nombre corto.
   * Solo palabras que en español no son otra cosa: "Sam" o "Alex" solos no
   * van (son nombres comunes), "Elon" sí.
   */
  alias: string[]
}

export const SEMAFORO: Readonly<Record<string, EntradaSemaforo>> = {
  // ── Verdes ──
  lincoln: { luz: "verde", alias: ["Lincoln"] },
  napoleon: { luz: "verde", alias: ["Napoleón", "Napoleon", "Bonaparte"] },
  leonardo: { luz: "verde", alias: ["Leonardo", "Da Vinci"] },
  cleopatra: { luz: "verde", alias: ["Cleopatra"] },
  suntzu: { luz: "verde", alias: ["Sun Tzu"] },
  marco: { luz: "verde", alias: ["Marco Aurelio"] },
  socrates: { luz: "verde", alias: ["Sócrates", "Socrates"] },
  mason: { luz: "verde", alias: ["Gran Maestro"] },
  iluminado: { luz: "verde", alias: ["Iluminado"] },
  claude: { luz: "verde", alias: ["Claude"] },
  chatgpt: { luz: "verde", alias: ["ChatGPT"] },
  // ── Amarillos: solo con el OK de Kev ──
  // «Mamba» sola también: «la Mamba Negra» es como se lo dice en español.
  kobe: { luz: "amarillo", alias: ["Kobe", "Kobe Bean", "Bryant", "Black Mamba", "Mamba Negra", "Mamba"] },
  jobs: { luz: "amarillo", alias: ["Steve Jobs", "Jobs"] },
  jesus: { luz: "amarillo", alias: ["Jesús", "Jesus", "Jesucristo", "Nazaret"] },
  // ── Vivos: solo de fondo ──
  thiel: { luz: "vivo", alias: ["Thiel", "Peter Thiel"] },
  altman: { luz: "vivo", alias: ["Altman", "Sam Altman"] },
  musk: { luz: "vivo", alias: ["Musk", "Elon"] },
  hormozi: { luz: "vivo", alias: ["Hormozi"] },
  amodei: { luz: "vivo", alias: ["Amodei", "Dario Amodei"] },
  pichai: { luz: "vivo", alias: ["Pichai", "Sundar"] },
  karp: { luz: "vivo", alias: ["Karp", "Alex Karp"] },
  gadzhi: { luz: "vivo", alias: ["Gadzhi", "Iman Gadzhi"] },
  // ── Fuera ──
  // Trump: fuera de cuadro hasta el 10-nov inclusive (elecciones de EE. UU. del 3-nov y su resaca); desde el 11, vivo de fondo.
  trump: { luz: "fuera", cambios: [{ desde: "2026-11-11", luz: "vivo" }], alias: ["Trump", "Donald", "Melania", "Mar-a-Lago", "Mar a Lago"] },
  tate: { luz: "fuera", alias: ["Tate", "Andrew Tate"] },
}

/**
 * Cómo se nombra a un vivo sin decir su nombre. Cuenta igual que nombrarlo:
 * «el dueño de Tesla me pidió decirles…» le atribuye una declaración a Musk.
 */
const CARGO = "(?:due[ñn][oa]s?|jef[ea]s?|ceo|fundador(?:a|es)?|cofundador(?:a|es)?|creador(?:a|es)?|director(?:a)?(?: ejecutiv[oa])?|president[ea](?: ejecutiv[oa])?|mandam[aá]s|cabeza|patr[oó]n|el de|la de)"
const EMPRESAS_DE: ReadonlyArray<[string, string]> = [
  ["musk", "Tesla|SpaceX|xAI|Neuralink|Starlink|The Boring Company|Twitter"],
  ["altman", "OpenAI|Open AI"],
  ["amodei", "Anthropic"],
  ["pichai", "Google|Alphabet"],
  ["karp", "Palantir"],
  ["thiel", "PayPal|Pay Pal|Palantir|Founders Fund"],
  ["hormozi", "Acquisition\\.com"],
]
export const PATRONES_DE: Readonly<Record<string, readonly RegExp[]>> = {
  ...Object.fromEntries(EMPRESAS_DE.map(([id, emp]) => [id, [new RegExp(`(?<![\\p{L}])${CARGO}\\s+(?:de\\s+)?(?:la\\s+|el\\s+)?(?:${emp})(?![\\p{L}])`, "iu")]])),
  trump: [/(?<![\p{L}])president[ea]\s+(?:n[uú]mero\s+|n\.?\s*[°º]?\s*)?(?:47|cuadrag[eé]simo\s+s[eé]ptimo)(?![\p{N}])/iu, /(?<![\p{L}])(?:el\s+)?(?:magnate|millonario)\s+naranja(?![\p{L}])/iu],
}

/**
 * Nombres de pila que en español son comunes («Sam», «Alex»): cuentan como
 * ese vivo solo si la MISMA oración habla de IA, empresas o cohetes.
 */
export const NOMBRES_DE_PILA: Readonly<Record<string, readonly string[]>> = {
  altman: ["Sam"],
  amodei: ["Dario", "Darío"],
  thiel: ["Peter"],
  karp: ["Alex"],
  hormozi: ["Alex"],
  gadzhi: ["Iman"],
  tate: ["Andrew"],
  pichai: ["Sundar"],
  musk: ["Elon"],
}
const CONTEXTO_TECH =
  /(?<![\p{L}])(?:ia|i\.a\.|inteligencia artificial|gpt|chat ?gpt|openai|anthropic|empresa|compa[ñn][ií]a|startup|cohete|robot|modelo|app|algoritmo|inversi[oó]n|inversor|fondo|negocio|marte|tesla|google|palantir|paypal|millones|billones|ventas|curso)(?![\p{L}])/iu

// ── Personas reales que NO viven en la casa ──────────────────
// No hay semáforo para ellas: un video de la fábrica no las nombra nunca.
// Nombrarlas ya es el error (y además cuentan como persona real para la regla
// comercial y los temas prohibidos). Solo palabras que en español no son otra
// cosa: «Maduro», «Mesa», «Paz» o «Arce» solos no van.
export const TERCEROS_REALES: Readonly<Record<string, readonly string[]>> = {
  bezos: ["Bezos", "Jeff Bezos"],
  zuckerberg: ["Zuckerberg", "Mark Zuckerberg", "Zuck"],
  gates: ["Bill Gates"],
  buffett: ["Buffett", "Warren Buffett"],
  huang: ["Jensen Huang", "Jensen"],
  nadella: ["Nadella", "Satya Nadella"],
  cook: ["Tim Cook"],
  arnault: ["Arnault", "Bernard Arnault"],
  slim: ["Carlos Slim"],
  biden: ["Biden", "Joe Biden"],
  obama: ["Obama", "Barack Obama", "Michelle Obama"],
  harris: ["Kamala", "Kamala Harris"],
  vance: ["Vance", "JD Vance", "J. D. Vance"],
  putin: ["Putin", "Vladimir Putin"],
  xi: ["Xi Jinping", "Jinping"],
  zelensky: ["Zelensky", "Zelenski", "Zelenskyy"],
  netanyahu: ["Netanyahu"],
  milei: ["Milei", "Javier Milei"],
  maduro: ["Nicolás Maduro", "Nicolas Maduro"],
  lula: ["Lula", "Lula da Silva"],
  bolsonaro: ["Bolsonaro"],
  petro: ["Gustavo Petro"],
  bukele: ["Bukele", "Nayib Bukele"],
  sheinbaum: ["Sheinbaum", "Claudia Sheinbaum"],
  amlo: ["AMLO", "López Obrador", "Lopez Obrador"],
  // Bolivia: la difamación es delito penal.
  evo: ["Evo", "Evo Morales"],
  arce: ["Luis Arce", "Lucho Arce"],
  paz: ["Rodrigo Paz"],
  quiroga: ["Tuto Quiroga", "Jorge Quiroga"],
  doria: ["Doria Medina", "Samuel Doria Medina"],
  camacho: ["Luis Fernando Camacho", "Fernando Camacho"],
  anez: ["Jeanine Áñez", "Jeanine Añez", "Áñez", "Añez"],
  mesa: ["Carlos Mesa"],
  lara: ["Edmand Lara", "Edman Lara"],
  messi: ["Messi", "Lionel Messi"],
  ronaldo: ["Cristiano Ronaldo", "Ronaldo"],
  swift: ["Taylor Swift"],
  shakira: ["Shakira"],
  badbunny: ["Bad Bunny"],
  papa: ["Papa Francisco", "Papa León", "Papa Leon", "León XIV", "Leon XIV"],
}

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/

/** El día de Bolivia (UTC−4 fijo, sin horario de verano) de un instante. */
export function diaDeBolivia(fecha: Date): string {
  return new Date(fecha.getTime() - 4 * 3600_000).toISOString().slice(0, 10)
}

/** "2026-11-10" o un Date → "2026-11-10" (día de Bolivia). Lo inválido lanza: una fecha mal escrita no puede abrir el semáforo. */
export function aDia(fecha: string | Date): string {
  if (fecha instanceof Date) {
    if (Number.isNaN(fecha.getTime())) throw new Error("semaforo: fecha inválida")
    return diaDeBolivia(fecha)
  }
  if (!ES_DIA.test(fecha)) throw new Error(`semaforo: "${fecha}" no es AAAA-MM-DD`)
  return fecha
}

/** La luz de un residente el día en que sale el video. Desconocido = fuera. */
export function luzDe(id: string, fechaSalida: string | Date): Luz {
  const e = Object.prototype.hasOwnProperty.call(SEMAFORO, id) ? SEMAFORO[id] : undefined
  if (!e) return "fuera"
  const dia = aDia(fechaSalida)
  let luz = e.luz
  // Los cambios en orden de fecha: vale el último que ya empezó.
  for (const c of [...(e.cambios ?? [])].sort((a, b) => a.desde.localeCompare(b.desde))) if (dia >= c.desde) luz = c.luz
  return luz
}

const PJ = new Map(PERSONAJES.map((p) => [p.id, p]))

/** Nombre, nombre corto y alias de un residente (sin repetir). */
export function aliasDe(id: string): string[] {
  const p = PJ.get(id)
  const extra = Object.prototype.hasOwnProperty.call(SEMAFORO, id) ? SEMAFORO[id].alias : []
  const todos = [p?.nombre, p?.corto, ...extra].filter((s): s is string => !!s && s.trim().length >= 3)
  return [...new Set(todos.map((s) => s.trim()))]
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const CACHE = new Map<string, RegExp>()

/**
 * Una expresión que encuentra alguno de esos nombres como palabra entera, sin
 * importar mayúsculas. El borde es de LETRA: un número pegado («Kobe24») no
 * salva el nombre.
 */
export function buscadorDeNombres(nombres: readonly string[]): RegExp {
  // Cada nombre también sin tildes: «Napoleon», «Anez» o «Jesus» escritos sin ellas.
  const alias = [...new Set(nombres.flatMap((n) => [n, sinTildes(n)]))]
    .sort((a, b) => b.length - a.length)
    .map(escapar)
    .join("|")
  // Sin alias no puede encontrar nada (una expresión vacía encontraría todo).
  return new RegExp(alias ? `(?<![\\p{L}])(?:${alias})(?![\\p{L}])` : "(?!)", "iu")
}

/** Una expresión que encuentra a ese residente por cualquiera de sus nombres. */
export function buscadorDe(id: string): RegExp {
  let re = CACHE.get(id)
  if (!re) {
    re = buscadorDeNombres(aliasDe(id))
    CACHE.set(id, re)
  }
  return re
}

const oracionesDe = (t: string) => t.split(/(?<=[.!?…])\s+|\n+/)

/** ¿El texto nombra a ese residente? Por nombre, alias, cargo («el dueño de Tesla») o nombre de pila con contexto. */
export function nombra(id: string, texto: string): boolean {
  if (cumple(buscadorDe(id), texto)) return true
  for (const re of PATRONES_DE[id] ?? []) if (cumple(re, texto)) return true
  const pila = NOMBRES_DE_PILA[id]
  if (pila?.length) {
    const re = buscadorDeNombres(pila)
    for (const v of variantes(texto)) for (const o of oracionesDe(v)) if (re.test(o) && CONTEXTO_TECH.test(o)) return true
  }
  return false
}

/** Los residentes nombrados en un texto (por nombre, cargo o nombre de pila con contexto). */
export function nombradosEn(texto: string, ids: Iterable<string> = Object.keys(SEMAFORO)): string[] {
  const out: string[] = []
  for (const id of ids) if (nombra(id, texto)) out.push(id)
  return out
}

const BUSCA_TERCERO = new Map(Object.entries(TERCEROS_REALES).map(([id, n]) => [id, buscadorDeNombres(n)]))

/** Las personas reales de fuera de la casa nombradas en un texto. */
export function tercerosEn(texto: string): string[] {
  const out: string[] = []
  for (const [id, re] of BUSCA_TERCERO) if (cumple(re, texto)) out.push(id)
  return out
}

/** Los ids con esa luz el día de salida. */
export function conLuz(luz: Luz, fechaSalida: string | Date): string[] {
  return Object.keys(SEMAFORO).filter((id) => luzDe(id, fechaSalida) === luz)
}

/** `real` de personajes.ts: "vivo" y "fallecido" activan la regla comercial. */
export function realDe(id: string): string | null {
  return PJ.get(id)?.real ?? null
}

/** Lo que dice el semáforo de un video entero: amarillo si alguno es amarillo o hay un vivo de fondo; fuera si alguno está fuera. */
export function luzDelVideo(ids: Iterable<string>, fechaSalida: string | Date): "verde" | "amarillo" | "fuera" {
  let r: "verde" | "amarillo" | "fuera" = "verde"
  for (const id of ids) {
    const l = luzDe(id, fechaSalida)
    if (l === "fuera") return "fuera"
    if (l === "amarillo" || l === "vivo") r = "amarillo"
  }
  return r
}
