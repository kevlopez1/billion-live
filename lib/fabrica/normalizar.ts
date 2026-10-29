// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · NORMALIZAR ANTES DE COMPARAR (puro)
//
// Una guarda que compara cadenas se salta con una letra que se ve igual y no
// es la misma: una M cirílica, un espacio de ancho cero en medio de un
// nombre, PRIME en ancho completo o «#ElonMusk» pegado. Todas las guardas
// comparan contra las VARIANTES de un texto (el original, el limpio y el
// limpio sin números por letras): si alguna cae, cae. Así los patrones con
// tildes siguen sirviendo y los trucos de Unicode no pasan.
// ──────────────────────────────────────────────────────────────

/** Letras cirílicas y griegas que se ven como latinas. */
const PARECIDAS: Readonly<Record<string, string>> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y", І: "I", Ј: "J", Ѕ: "S",
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", х: "x", у: "y", і: "i", ј: "j", ѕ: "s", ԁ: "d", ӏ: "l",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
  α: "a", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
}
const RE_PARECIDAS = new RegExp(`[${Object.keys(PARECIDAS).join("")}]`, "gu")

/** Un ZWJ dentro de un emoji compuesto es legítimo; en medio de una palabra, un truco. */
const ZWJ_DE_EMOJI = /(?<=\p{Extended_Pictographic}️?)‍(?=\p{Extended_Pictographic})/gu

/**
 * El texto como lo leería una persona: NFKC (ancho completo → normal, «．» →
 * «.»), sin caracteres invisibles, con las letras parecidas pasadas a latinas,
 * CamelCase separado («ElonMusk» → «Elon Musk») y sin # ni @ pegados.
 */
export function limpiar(texto: string): string {
  return texto
    .normalize("NFKC")
    .replace(ZWJ_DE_EMOJI, "")
    .replace(/\p{Cf}/gu, "")
    .replace(RE_PARECIDAS, (c) => PARECIDAS[c] ?? c)
    .replace(/[。․｡]/g, ".")
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/[#@]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .normalize("NFC")
}

/** Sin tildes ni diéresis (la ñ pasa a n): «Mirá» → «Mira». */
export const sinTildes = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC")

const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" }

/**
 * «Altm4n» → «Altman»: un número (o @ y $) metido en una palabra como letra.
 * Solo si está pegado a letras: «1805» o «Kobe24» quedan como están.
 */
export const sinLeet = (texto: string) => texto.replace(/(?<=\p{L})[013457@$](?=\p{L})|(?<=\p{L})[013457@$](?![\p{L}\p{N}])|(?<![\p{L}\p{N}])[013457@$](?=\p{L}{2})/gu, (c) => LEET[c] ?? c)

/**
 * Las formas en las que se compara un texto: el original, el limpio y el
 * limpio sin números por letras. Sin tildes NO: «retó» pasaría a «reto» y
 * «papá» a «papa». Lo que hace falta encontrar sin tilde (un nombre) lleva
 * las dos formas en su patrón (semaforo.ts).
 */
export function variantes(texto: string): string[] {
  const original = texto.normalize("NFC")
  const limpio = limpiar(texto)
  return [...new Set([original, limpio, sinLeet(limpio)])]
}

/** ¿Alguna variante del texto cumple el patrón? (Un patrón con /g no sirve: test() recuerda dónde quedó.) */
export const cumple = (re: RegExp, texto: string) => variantes(texto).some((v) => re.test(v))

/** El primer pedazo que encuentra el patrón en alguna variante, o null. */
export function encontrar(re: RegExp, texto: string): string | null {
  for (const v of variantes(texto)) {
    const m = v.match(re)
    if (m) return m[0]
  }
  return null
}

/**
 * Lo que un texto de un video nunca trae: caracteres invisibles (de formato)
 * o letras de otro alfabeto. No son un descuido: son la forma de esconder un
 * nombre o una marca de la guarda. Devuelve qué encontró (vacío = limpio).
 */
export function caracteresRaros(texto: string): string[] {
  const out = new Set<string>()
  for (const c of texto.normalize("NFKC").replace(ZWJ_DE_EMOJI, "")) {
    const cp = c.codePointAt(0)!
    const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`
    if (/\p{Cf}/u.test(c)) out.add(`invisible ${hex}`)
    else if (/\p{L}/u.test(c) && !/\p{Script=Latin}/u.test(c)) out.add(`«${c}» (${hex}, otro alfabeto)`)
  }
  return [...out]
}
