// ──────────────────────────────────────────────────────────────
// Prueba de los expedientes de vida, sin frameworks ni dependencias:
//   npx tsx components/casa-blanca/datos/vidas.test.ts
// Sale con código 1 si algo falla. Mismo estilo que motor/simulacion.test.ts.
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "./personajes"
import { VIDAS, type Vida } from "./vidas"

let fallas = 0
let pasaron = 0
function ok(cond: unknown, msg: string) {
  if (cond) pasaron++
  else {
    fallas++
    console.error(`  FALLA: ${msg}`)
  }
}
function seccion(t: string) {
  console.log(`\n· ${t}`)
}

const URL = /https?:\/\/[^\s)]+/

seccion("están los 24, y solo ellos")
const ids = PERSONAJES.map((p) => p.id)
ok(ids.length === 24, `hay 24 residentes en personajes.ts (hay ${ids.length})`)
for (const id of ids) ok(Object.prototype.hasOwnProperty.call(VIDAS, id), `${id} tiene expediente`)
for (const id of Object.keys(VIDAS)) ok(ids.includes(id), `el expediente "${id}" es de un residente`)

seccion("cada cita tiene una fuente con URL")
for (const [id, v] of Object.entries(VIDAS)) {
  ok(v.citasVerificadas.length <= 4, `${id}: 4 citas como máximo (tiene ${v.citasVerificadas.length})`)
  for (const c of v.citasVerificadas) {
    ok(c.texto.trim().length >= 5 && c.texto.length <= 450, `${id}: cita de largo razonable («${c.texto.slice(0, 40)}…»)`)
    ok(URL.test(c.fuente), `${id}: la cita «${c.texto.slice(0, 40)}…» tiene una URL en la fuente`)
  }
  ok(v.fuentes.length >= 1, `${id}: al menos una fuente`)
  for (const f of v.fuentes) ok(/^https:\/\/\S+$/.test(f), `${id}: la fuente "${f}" es una URL https`)
}

seccion("largos dentro de los límites (el prompt no crece sin techo)")
for (const [id, v] of Object.entries(VIDAS)) {
  ok(v.resumen.length >= 200 && v.resumen.length <= 1100, `${id}: resumen de 200 a 1100 caracteres (tiene ${v.resumen.length})`)
  ok(v.lineaDeVida.length >= 3 && v.lineaDeVida.length <= 18, `${id}: línea de vida de 3 a 18 momentos (tiene ${v.lineaDeVida.length})`)
  for (const h of v.lineaDeVida) {
    ok(h.anio.trim() && h.anio.length <= 45, `${id}: año corto ("${h.anio}")`)
    ok(h.hecho.trim() && h.hecho.length <= 320, `${id}: hecho de 320 caracteres como máximo ("${h.hecho.slice(0, 40)}…")`)
  }
  ok(v.obrasYLogros.length >= 1 && v.obrasYLogros.length <= 8, `${id}: de 1 a 8 obras y logros`)
  ok(v.ideasYCreencias.length >= 3 && v.ideasYCreencias.length <= 8, `${id}: de 3 a 8 ideas`)
  ok(v.comoDecide.length >= 80 && v.comoDecide.length <= 700, `${id}: "cómo decide" de 80 a 700 caracteres (tiene ${v.comoDecide.length})`)
  ok(v.comoHabla.length >= 80 && v.comoHabla.length <= 700, `${id}: "cómo habla" de 80 a 700 caracteres (tiene ${v.comoHabla.length})`)
  ok(v.relaciones.length <= 6, `${id}: 6 relaciones como máximo`)
  ok(v.temasSensibles.length <= 10, `${id}: 10 temas sensibles como máximo`)
  for (const t of v.temasSensibles) ok(t.length <= 260, `${id}: tema sensible corto ("${t.slice(0, 40)}…")`)
}

seccion("lo que el personaje sabe no trae rumores ni palabras prohibidas")
// Los temas sensibles quedan fuera: ahí se nombra justamente lo que se evita.
const loQueSabe = (v: Vida) => [
  v.resumen,
  ...v.lineaDeVida.map((h) => `${h.anio} ${h.hecho}`),
  ...v.obrasYLogros,
  ...v.ideasYCreencias,
  v.comoDecide,
  v.comoHabla,
  ...v.relaciones,
  ...v.citasVerificadas.map((c) => c.texto),
]
const PROHIBIDAS: [RegExp, string][] = [
  [/según rumores|se rumorea|rumor/i, "rumores"],
  [/se dice que|dicen que|al parecer|presuntamente|supuestamente/i, "afirmaciones sin fuente"],
  [/monopoli/i, '"monopolio" (regla 8)'],
  [/vosotros|(?<!\p{L})vos(?!\p{L})|(?<!\p{L})acá(?!\p{L})/iu, "voseo o vosotros"], // sin-voseo:ejemplos
  [/\*\*|^#/m, "markdown"],
  [/—/, "raya (em dash)"],
]
for (const [id, v] of Object.entries(VIDAS)) {
  const texto = loQueSabe(v).join("\n")
  for (const [re, que] of PROHIBIDAS) {
    const m = texto.match(re)
    ok(!m, `${id}: sin ${que}${m ? ` (encontró "${m[0]}")` : ""}`)
  }
}

seccion("los temas sensibles también entran al prompt (van en LÍMITES)")
for (const [id, v] of Object.entries(VIDAS)) {
  const texto = v.temasSensibles.join("\n")
  ok(!/monopoli/i.test(texto), `${id}: temas sensibles sin "monopolio" (regla 8)`)
  ok(!/—/.test(texto), `${id}: temas sensibles sin raya (em dash)`)
}

seccion("reglas por categoría")
for (const p of PERSONAJES) {
  const v = VIDAS[p.id]
  if (!v) continue
  if (p.real === "vivo") ok(v.temasSensibles.length >= 3, `${p.id}: persona viva con al menos 3 temas sensibles`)
  if (p.real === "arquetipo") ok(/FICCIÓN/.test(v.resumen), `${p.id}: el resumen declara que es ficción`)
  if (p.real === "ia") {
    ok(/ficción/i.test(v.resumen), `${p.id}: el resumen declara que en la casa es un personaje de ficción`)
    // Nada de versiones, precios ni cifras de uso del producto real.
    const texto = loQueSabe(v).join("\n")
    ok(!/millones de usuarios|\$\s?\d|USD|\b(?:GPT|Claude)[- ]?\d/i.test(texto), `${p.id}: sin versiones, precios ni cifras de usuarios`)
    // Una frase de su creadora no es una cita suya.
    ok(v.citasVerificadas.length === 0, `${p.id}: una IA no tiene citas propias`)
  }
}
// Lo que los LÍMITES del personaje prohíben no puede estar en lo que sabe.
const sabe = (id: string) => loQueSabe(VIDAS[id]).join("\n")
ok(!/destitu|directorio de OpenAI lo/i.test(sabe("altman")), "altman: su destitución de 2023 no está en lo que sabe")
ok(!/elecci|candidatur|votos electorales|Make America|Biden|salón de baile|arancel/i.test(sabe("trump")), "trump: sin elecciones, campañas, aranceles ni salón de baile")
for (const id of ["trump", "musk", "thiel", "altman"]) ok(!/campaña|candidatur|Stargate|su gobierno/i.test(VIDAS[id].relaciones.join("\n")), `${id}: sus relaciones no guardan apoyo político`)
ok(!/Diversity Myth/.test(sabe("thiel")), "thiel: su libro político va en temas sensibles")
ok(!VIDAS.kobe.relaciones.some((r) => /tate/i.test(r)) && !VIDAS.tate.relaciones.some((r) => /kobe/i.test(r)), "kobe y tate: sin relación entre ellos")
ok(!VIDAS.jesus.relaciones.some((r) => /kobe/i.test(r)), "jesus: no opina sobre la fe de Kobe")
ok(!/ironía/i.test(VIDAS.suntzu.comoHabla), "suntzu: la prueba de las 180 mujeres no se cuenta con ironía")
ok(/Whole Earth Catalog/.test(VIDAS.jobs.citasVerificadas.map((c) => c.texto).join(" ")), "jobs: «Stay Hungry» dice de dónde la tomó")
ok(!/supersummary/i.test(JSON.stringify(VIDAS)), "ninguna fuente es un sitio de resúmenes")
// Kobe: la regla del personaje prohíbe referencias a su muerte; su línea de vida no la cuenta.
ok(!VIDAS.kobe.lineaDeVida.some((h) => /fallec|muer|accidente|helic/i.test(h.hecho)), "kobe: su línea de vida no habla de su muerte")

console.log(`\n${pasaron} pasaron, ${fallas} fallaron`)
if (fallas) process.exit(1)
