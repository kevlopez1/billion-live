// ──────────────────────────────────────────────────────────────
// Mide los prompts de sistema de La Casa Blanca Project, sin llamar a la IA:
//   npx tsx scripts/casa-blanca-prompts.ts
// Arma los sistemas reales (los mismos que usa lib/casa-blanca-servidor.ts)
// y dice su tamaño en caracteres y en tokens estimados (caracteres / 3,6).
// Sale con código 1 si el consejo de los 24 o la reflexión pasan el techo.
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { RECAUDADO } from "@/lib/contador"
import { sistemaGuionista, sistemaHablar, sistemaReflexion } from "@/lib/casa-blanca-servidor"

const TECHO_TOKENS = 25_000
const tokens = (n: number) => Math.round(n / 3.6)
const largo = (s: string | string[]) => (Array.isArray(s) ? s.join("") : s).length
const fila = (nombre: string, chars: number) => `${nombre.padEnd(34)} ${String(chars).padStart(7)} car. ${String(tokens(chars)).padStart(6)} tok.`

console.log("· hablar (un personaje, expediente completo)")
const hablar = PERSONAJES.map((p) => ({ id: p.id, n: largo(sistemaHablar(p, RECAUDADO)) }))
for (const h of hablar) console.log("  " + fila(h.id, h.n))
const mx = hablar.reduce((a, b) => (b.n > a.n ? b : a))
const mn = hablar.reduce((a, b) => (b.n < a.n ? b : a))
console.log(`  mínimo ${mn.id} ${tokens(mn.n)} tok. · máximo ${mx.id} ${tokens(mx.n)} tok.`)

console.log("\n· conversar (expediente mediano por cabeza)")
for (const ids of [["trump", "musk"], ["socrates", "marco", "jesus"], ["claude", "chatgpt", "amodei"]]) {
  console.log("  " + fila(ids.join(" + "), largo(sistemaGuionista(RECAUDADO, "PRESENTES", ids, 2, "media"))))
}

console.log("\n· consejo y reflexión (los 24, expediente corto)")
const todos = PERSONAJES.map((p) => p.id)
const consejo = largo(sistemaGuionista(RECAUDADO, "EN LA MESA", todos, 1, "corta"))
const reflexion = largo(sistemaReflexion(RECAUDADO))
console.log("  " + fila(`consejo (${todos.length})`, consejo))
console.log("  " + fila("reflexión del día", reflexion))

const pasados = [
  ["consejo", consejo],
  ["reflexión", reflexion],
].filter(([, n]) => tokens(n as number) > TECHO_TOKENS)
if (pasados.length) {
  console.error(`\nPASAN EL TECHO de ${TECHO_TOKENS} tokens: ${pasados.map(([x]) => x).join(", ")}`)
  process.exit(1)
}
console.log(`\nOK: consejo y reflexión por debajo de ${TECHO_TOKENS} tokens.`)
