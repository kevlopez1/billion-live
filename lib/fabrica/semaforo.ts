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
  kobe: { luz: "amarillo", alias: ["Kobe", "Bryant", "Black Mamba"] },
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
  trump: { luz: "fuera", cambios: [{ desde: "2026-11-11", luz: "vivo" }], alias: ["Trump", "Donald"] },
  tate: { luz: "fuera", alias: ["Tate", "Andrew Tate"] },
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

/** Una expresión que encuentra a ese residente por cualquiera de sus nombres, como palabra entera y sin importar mayúsculas. */
export function buscadorDe(id: string): RegExp {
  let re = CACHE.get(id)
  if (!re) {
    const alias = aliasDe(id)
      .sort((a, b) => b.length - a.length)
      .map(escapar)
      .join("|")
    // Sin alias no puede encontrar nada (una expresión vacía encontraría todo).
    re = new RegExp(alias ? `(?<![\\p{L}\\p{N}])(?:${alias})(?![\\p{L}\\p{N}])` : "(?!)", "iu")
    CACHE.set(id, re)
  }
  return re
}

/** Los residentes nombrados en un texto. */
export function nombradosEn(texto: string, ids: Iterable<string> = Object.keys(SEMAFORO)): string[] {
  const out: string[] = []
  for (const id of ids) if (buscadorDe(id).test(texto)) out.push(id)
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
