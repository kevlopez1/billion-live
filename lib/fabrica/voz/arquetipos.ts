// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LAS VOCES DE LOS 24 RESIDENTES, DESCRITAS POR ARQUETIPO
//
// Cada voz de la fábrica es ORIGINAL: se crea en ElevenLabs Voice Design a
// partir de una descripción acústica (edad, timbre, ritmo, energía y acento)
// y nunca a partir de la persona real. Por eso aquí:
// - no va el nombre de nadie (ni de la casa ni de fuera), ni su cargo, su
//   país, su oficio o su época: esas son pistas para imitar a alguien;
// - no se copia el campo `voz` de personajes.ts: ese texto describe la
//   personalidad de la persona real y la identifica;
// - el acento es el mismo para todos: español latinoamericano neutro.
// La guarda `descripcionSegura()` lo comprueba por código, y un test la corre
// sobre las 24. Fuente: plan 11-FABRICA-DE-VIDEOS.md, paso c [V3][V5].
//
// `descripcion` va en inglés porque es lo que lee Voice Design (sus ejemplos
// y su guía de prompts están en inglés, SIN VERIFICAR que en español rinda
// igual). `resumen` es lo mismo en español, para que Kev elija.
// `muestra` es lo que dice cada candidata (100 a 1.000 caracteres): texto
// propio, nunca una cita, sin nombres, sin PRIME ni el reto.
//
// Quién recibe voz: solo quien puede hablar en un video (luz verde o
// amarillo en semaforo.ts). Los vivos salen de fondo y sin voz; Trump y
// Tate, tampoco. Sus arquetipos están escritos (pedido de la ola B1) pero
// `disenar-voces.ts` y `voces()` se niegan a usarlos.
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { SEMAFORO, TERCEROS_REALES, aliasDe, luzDe, nombradosEn, tercerosEn } from "../semaforo"
import { sinTildes } from "../normalizar"

export interface Arquetipo {
  id: string
  genero: "masculina" | "femenina" | "neutra"
  /** Edad aparente de la voz, en años. */
  edad: number
  /** Para Voice Design (20 a 1.000 caracteres). */
  descripcion: string
  /** Lo mismo en español, para Kev. */
  resumen: string
  /** Lo que dice la candidata (100 a 1.000 caracteres). */
  muestra: string
}

/** Lo que todas comparten: el acento. Un test exige esta frase en cada descripción. */
export const ACENTO = "neutral Latin American Spanish"

const a = (id: string, genero: Arquetipo["genero"], edad: number, descripcion: string, resumen: string, muestra: string): Arquetipo => ({
  id,
  genero,
  edad,
  descripcion,
  resumen,
  muestra,
})

export const ARQUETIPOS: readonly Arquetipo[] = [
  // ── Verdes ──
  a(
    "lincoln",
    "masculina",
    55,
    `A tall, lean man in his mid-fifties. Warm, slightly reedy baritone with a soft rasp. Slow, deliberate pace with long pauses, like someone telling a story by a fire. Gentle, dry humor and a quiet melancholy. Low energy, very steady. Speaks ${ACENTO} with clear diction and no regional accent.`,
    "Hombre de unos 55 años. Barítono cálido con un poco de aspereza. Lento, con pausas largas, como quien cuenta una historia junto al fuego. Humor seco y algo de melancolía. Energía baja y estable.",
    "Cuando era muchacho partía leña antes del amanecer. Aprendí que un hacha bien afilada ahorra la mitad del trabajo. Con las ideas pasa igual: piénsalas bien antes de levantarlas, y el golpe sale solo.",
  ),
  a(
    "napoleon",
    "masculina",
    38,
    `A compact, restless man in his late thirties. Bright, cutting tenor with a commanding edge. Quick, impatient pace and short clipped sentences; theatrical and proud, raises his voice when excited. High energy. Speaks ${ACENTO} with crisp, emphatic diction.`,
    "Hombre de unos 38 años. Tenor brillante y cortante, de mando. Rápido, impaciente, frases cortas; teatral y orgulloso, sube la voz cuando se entusiasma. Energía alta.",
    "¡Otra reunión sin plan de batalla! Escuchen bien: primero el terreno, después los cañones y al final, la gloria. Quien duda pierde el puente. ¡En marcha, ahora mismo, que el tiempo no espera a nadie!",
  ),
  a(
    "leonardo",
    "masculina",
    60,
    `A gentle man around sixty. Warm, airy light baritone with a hint of breath. Curious and full of wonder; the pace speeds up and slows down as ideas arrive, and he sometimes trails off mid-sentence. Medium energy, kind and soft-spoken. Speaks ${ACENTO} with soft, relaxed diction.`,
    "Hombre de unos 60 años. Barítono liviano, cálido y con aire. Curioso y maravillado: acelera y frena según le llegan las ideas, a veces deja la frase a medias. Energía media, amable.",
    "Observa cómo cae la luz sobre el agua... no, espera, mira el ala de esa paloma. Cada pluma sigue una proporción. Si pudiera medirla con calma, podría construir una máquina que... bueno, primero el dibujo.",
  ),
  a(
    "cleopatra",
    "femenina",
    35,
    `A poised woman in her mid-thirties. Rich, smooth contralto, low and velvety. Measured, diplomatic pace with deliberate pauses; elegant, confident and subtly ironic, never in a hurry. Medium-low energy. Speaks ${ACENTO} with polished, precise diction.`,
    "Mujer de unos 35 años. Contralto rica y aterciopelada. Ritmo medido y diplomático, con pausas a propósito; elegante, segura e irónica, nunca apurada. Energía media baja.",
    "Toda conversación es una negociación, aunque el otro todavía no lo sepa. Sonrío, escucho y dejo que hable primero. Cuando termina, ya sé cuánto vale lo que me ofrece... y cuánto vale lo que no dijo.",
  ),
  a(
    "suntzu",
    "masculina",
    65,
    `An older man in his mid-sixties. Low, quiet, slightly grainy voice, soft at the edges. Very slow pace with long silences between phrases; calm, enigmatic and economical with words. Low energy, perfectly even volume. Speaks ${ACENTO} with careful, unhurried pronunciation.`,
    "Hombre de unos 65 años. Voz baja, tranquila y algo granulada. Muy lento, con silencios largos entre frases; sereno, enigmático, de pocas palabras. Energía baja, volumen parejo.",
    "El agua no discute con la piedra. La rodea, espera y al final la piedra cede. Antes de empezar cualquier pelea, pregúntate en silencio: ¿conozco el terreno, o solo conozco mis ganas de ganar?",
  ),
  a(
    "marco",
    "masculina",
    52,
    `A composed man in his early fifties. Steady, warm, mid-low baritone with a calm resonance. Sober, measured pace; short sentences delivered like notes written to himself. Serene and introspective, never rushed. Low energy. Speaks ${ACENTO} with clean, quiet diction.`,
    "Hombre de unos 52 años. Barítono medio bajo, cálido y firme. Sobrio y medido; frases cortas, como notas que se escribe a sí mismo. Sereno e introspectivo. Energía baja.",
    "Recuerda que todo pasa: el aplauso de hoy y la ofensa de ayer. Haz bien lo que te toca en esta hora, sin queja y sin prisa. Lo demás no depende de ti, así que no le entregues tu calma.",
  ),
  a(
    "socrates",
    "masculina",
    68,
    `A friendly older man near seventy. Gravelly, good-natured voice with a smile in it. Relaxed, conversational pace; playful and gently ironic, his sentences often rise into questions. Medium energy. Speaks ${ACENTO} with warm, easygoing diction.`,
    "Hombre de casi 70 años. Voz ronca y bonachona, con una sonrisa adentro. Relajado y conversador; juguetón e irónico, muchas frases terminan en pregunta. Energía media.",
    "Disculpa, amigo, yo no sé nada, por eso pregunto. Dices que el éxito es tener mucho. ¿Y quien tiene mucho y no duerme tranquilo, ha tenido éxito? Ayúdame a entenderlo, porque me confundo con facilidad.",
  ),
  a(
    "mason",
    "masculina",
    62,
    `A man in his early sixties with a deep, resonant bass voice. Slow, ceremonial pace with dramatic pauses; mysterious and grave, with a playful wink underneath. Low to medium energy. Speaks ${ACENTO} with rounded, solemn diction.`,
    "Hombre de unos 62 años. Bajo profundo y resonante. Lento y ceremonioso, con pausas dramáticas; misterioso y grave, con un guiño por debajo. Energía baja a media.",
    "Toda gran obra empieza con una piedra angular y una escuadra bien puesta. ¿Lo que hay detrás de esa puerta? Ah, eso se aprende más adelante. Paciencia, querido amigo, paciencia. Todo a su debido tiempo.",
  ),
  a(
    "iluminado",
    "masculina",
    45,
    `A man in his mid-forties with a hushed, breathy voice that leans toward a stage whisper. Slightly nasal, mid-range pitch. Medium pace with sudden stops; conspiratorial and playful, with bursts of suppressed laughter. Medium energy. Speaks ${ACENTO}.`,
    "Hombre de unos 45 años. Voz susurrada y con aire, casi un secreto en voz alta. Algo nasal. Ritmo medio con frenadas; cómplice y juguetón, con risas que se le escapan. Energía media.",
    "Desde arriba todo se ve más simple, ¿sabes? Las piezas ya estaban en su lugar mucho antes de 2040... No, no, yo no dije nada. Es una broma. ¿O no? Bueno, mejor hablemos del clima.",
  ),
  a(
    "claude",
    "neutra",
    35,
    `A calm, warm adult voice around thirty-five, gender-ambiguous, clear mid-range pitch. Thoughtful, measured pace; precise and honest, with a dry, gentle sense of humor. Medium-low energy, attentive and kind. Speaks ${ACENTO} with crisp, clean diction.`,
    "Voz adulta de unos 35 años, de género ambiguo, tono medio y claro. Pensativa y medida; precisa, honesta, con humor seco y suave. Energía media baja, atenta.",
    "No lo sé con certeza, y prefiero decirlo. Lo que sí puedo hacer es revisar los datos contigo, paso a paso. Por cierto, una ciudad entera levantó sus edificios para salir del barro. Bueno, casi entera.",
  ),
  a(
    "chatgpt",
    "neutra",
    30,
    `An upbeat, bright adult voice around thirty, gender-ambiguous, slightly higher pitch. Fast, eager pace; very friendly, helpful and enthusiastic, smiling through every sentence. High energy. Speaks ${ACENTO} with clear, quick diction.`,
    "Voz adulta de unos 30 años, de género ambiguo, tono algo alto y brillante. Rápida y entusiasta; muy amable y servicial, sonríe en cada frase. Energía alta.",
    "¡Claro que sí! Aquí tienes tres opciones: la rápida, la económica y la ambiciosa. ¿Quieres que te haga una tabla para compararlas? También puedo resumirlo en una lista. ¡Dime y lo preparo ahora mismo!",
  ),
  // ── Amarillos: con el OK de Kev en cada video ──
  a(
    "kobe",
    "masculina",
    40,
    `A strong, focused man around forty. Firm, resonant mid-low baritone. Measured, confident pace with emphasis on key words; demanding but warm, with intense concentration. Medium-high energy. Speaks ${ACENTO} with clear, steady diction.`,
    "Hombre de unos 40 años. Barítono medio bajo, firme y resonante. Ritmo seguro, remarca las palabras clave; exigente pero cálido, muy concentrado. Energía media alta.",
    "El trabajo que nadie ve es el que decide. Repite el detalle mil veces, hasta que salga sin pensar. Y cuando falles, que vas a fallar, vuelve al día siguiente un poco más temprano que ayer.",
  ),
  a(
    "jobs",
    "masculina",
    52,
    `A lean man in his early fifties. Clear, medium-pitched voice with a slight rasp. Deliberate pace with dramatic pauses before the point; focused, persuasive and intense, becoming passionate when excited. Medium-high energy. Speaks ${ACENTO} with sharp, precise diction.`,
    "Hombre de unos 52 años. Voz clara de tono medio, algo áspera. Pausado, con silencios antes de lo importante; persuasivo e intenso, se apasiona cuando algo le gusta. Energía media alta.",
    "Mira este botón. Sobra. Y este otro, también. Si alguien necesita un manual para entenderlo, todavía no está terminado. Quitemos todo lo que no importa hasta que quede solo lo esencial.",
  ),
  a(
    "jesus",
    "masculina",
    33,
    `A man in his early thirties with a soft, warm, gentle baritone. Calm, unhurried pace; compassionate and kind, with a light, gentle humor. Low energy, never harsh or loud. Speaks ${ACENTO} with soft, clear diction.`,
    "Hombre de unos 33 años. Barítono suave y cálido. Tranquilo, sin prisa; compasivo y amable, con un humor ligero. Energía baja, nunca áspero.",
    "Siéntate un momento, no hay prisa. Mira esa higuera: nadie la apura y aun así da fruto a su tiempo. ¿Por qué te apuras tanto tú? Respira, que el camino sigue ahí mañana.",
  ),
  // ── Vivos: de fondo y sin voz. Escritos, nunca diseñados. ──
  a(
    "thiel",
    "masculina",
    58,
    `A man in his late fifties with a soft, low, even voice. Slow pace, quiet and contemplative. Low energy. Speaks ${ACENTO}.`,
    "Hombre de unos 58 años. Voz suave, baja y pareja. Lenta y contemplativa. Energía baja.",
    "Antes de decidir, me gusta quedarme un rato en silencio. Casi siempre la respuesta correcta es la que nadie en la sala quiere decir en voz alta.",
  ),
  a(
    "altman",
    "masculina",
    40,
    `A soft-spoken man around forty with a light, gentle tenor. Relaxed pace and short sentences. Low to medium energy, optimistic tone. Speaks ${ACENTO}.`,
    "Hombre de unos 40 años. Tenor liviano y suave. Relajado, frases cortas. Energía baja a media, optimista.",
    "Creo que lo que viene es más grande de lo que parece. No sé exactamente cuándo, pero sí sé que conviene prepararse con calma desde hoy.",
  ),
  a(
    "musk",
    "masculina",
    55,
    `A man in his mid-fifties with a medium-pitched voice and small hesitations. Fast pace, playful tone. Medium-high energy. Speaks ${ACENTO}.`,
    "Hombre de unos 55 años. Tono medio, con pequeñas dudas al hablar. Rápido y juguetón. Energía media alta.",
    "Si el plan dice que tarda diez años, probablemente se puede en dos. Bueno, en tres. Lo importante es empezar por lo básico y no aceptar la primera respuesta.",
  ),
  a(
    "hormozi",
    "masculina",
    36,
    `A man in his mid-thirties with a deep, punchy baritone. Direct delivery, fast pace. High energy. Speaks ${ACENTO}.`,
    "Hombre de unos 36 años. Barítono profundo y contundente. Directo y rápido. Energía alta.",
    "Haz la cuenta. Si duplicas el esfuerzo y el resultado no cambia, el problema no es el esfuerzo. Cambia lo que ofreces y vuelve a medir mañana.",
  ),
  a(
    "amodei",
    "masculina",
    43,
    `A thoughtful man in his early forties with a medium tenor. Fast pace in long, careful sentences. Medium energy, earnest tone. Speaks ${ACENTO}.`,
    "Hombre de unos 43 años. Tenor medio. Rápido, en frases largas y cuidadosas. Energía media, tono serio.",
    "Hay que mirar las dos caras a la vez: lo mucho que se puede ganar y lo que puede salir mal. Ninguna de las dos se resuelve sola, así que conviene ir con cuidado.",
  ),
  a(
    "pichai",
    "masculina",
    54,
    `A gentle man in his mid-fifties with a soft, warm, mid-range voice. Calm, even pace. Low energy, polite tone. Speaks ${ACENTO}.`,
    "Hombre de unos 54 años. Voz suave y cálida de tono medio. Calmo y parejo. Energía baja, cortés.",
    "Lo útil de verdad es lo que llega a todos, no solo a unos pocos. Por eso prefiero avanzar despacio y con cuidado, pero sin dejar a nadie atrás.",
  ),
  a(
    "karp",
    "masculina",
    58,
    `A wiry man in his late fifties with an energetic, slightly raspy tenor. Rapid, restless delivery. High energy. Speaks ${ACENTO}.`,
    "Hombre de unos 58 años. Tenor enérgico, algo áspero. Habla rápido e inquieto. Energía alta.",
    "Las ideas no sirven si se quedan en el papel. Hay que defenderlas en voz alta, aunque incomoden, y después hacerlas funcionar en el mundo real.",
  ),
  a(
    "gadzhi",
    "masculina",
    30,
    `A polished young man around thirty with a smooth, low-medium voice. Calm, calculated pace. Low to medium energy, composed tone. Speaks ${ACENTO}.`,
    "Hombre de unos 30 años. Voz suave de tono medio bajo. Calmo y calculado. Energía baja a media, compuesto.",
    "Todo funciona mejor cuando es simple. Un sistema claro, pocas piezas y la disciplina de repetirlo todos los días, aunque nadie esté mirando.",
  ),
  // ── Fuera: no aparecen. Escritos, nunca diseñados. ──
  a(
    "trump",
    "masculina",
    78,
    `A robust man in his late seventies with a loud, brassy baritone. Medium pace. High energy, confident tone. Speaks ${ACENTO}.`,
    "Hombre de unos 78 años. Barítono fuerte y metálico. Ritmo medio. Energía alta, seguro.",
    "Un buen trato se nota desde el primer minuto. Si la otra parte se levanta de la mesa contenta, probablemente dejaste algo sobre ella. Hay que ir con calma.",
  ),
  a(
    "tate",
    "masculina",
    40,
    `A stern man around forty with a dry, deep voice. Short, clipped sentences. Medium-high energy, serious tone. Speaks ${ACENTO}.`,
    "Hombre de unos 40 años. Voz grave y seca. Frases cortas. Energía media alta, serio.",
    "Nadie va a venir a hacer el trabajo por ti. Te levantas, entrenas aunque no tengas ganas y repites lo mismo mañana. Así de simple, así de difícil.",
  ),
]

const POR_ID = new Map(ARQUETIPOS.map((x) => [x.id, x]))

/** El arquetipo de un residente, o null si no tiene. */
export const arquetipoDe = (id: string): Arquetipo | null => POR_ID.get(id) ?? null

// ── Quién habla ───────────────────────────────────────────────

const HABLAN = new Set(["verde", "amarillo"])

/** ¿Puede hablar en un video que sale ese día? Solo verde y amarillo; vivo, fuera y desconocido, nunca. */
export const hablaEnLaFabrica = (id: string, dia: string | Date) => HABLAN.has(luzDe(id, dia))

/**
 * ¿Puede hablar alguna vez, hoy o por un cambio de luz programado? Decide a
 * quién se le diseña una voz: a un vivo, nunca (Trump pasa de fuera a vivo:
 * tampoco).
 */
export function puedeHablarAlgunaVez(id: string): boolean {
  const e = Object.prototype.hasOwnProperty.call(SEMAFORO, id) ? SEMAFORO[id] : undefined
  if (!e) return false
  return HABLAN.has(e.luz) || (e.cambios ?? []).some((c) => HABLAN.has(c.luz))
}

/** Los residentes a los que se les diseña voz. */
export const conVoz = () => ARQUETIPOS.filter((x) => puedeHablarAlgunaVez(x.id)).map((x) => x.id)

// ── La guarda de la descripción ───────────────────────────────

/**
 * Palabras que llevan a una persona concreta: pedir una imitación, o darle a
 * Voice Design su oficio, su país o su época. Se comparan sin tildes, en
 * minúsculas, como inicio de palabra («imitat» encuentra «imitate»).
 */
export const PISTAS_DE_IDENTIDAD: readonly string[] = [
  // Pedir una imitación
  "famous", "celebrity", "celebridad", "impression", "imitat", "imita", "sounds like", "suena como", "in the style of", "al estilo de",
  "resembl", "parecid", "clone", "clon", "real person", "persona real", "voice of", "voz de", "like a young", "like an old",
  // Cargos y oficios que identifican
  "president", "presidente", "emperor", "emperador", "king", "rey ", "queen", "reina", "pharaoh", "faraon", "general ", "philosopher",
  "filosofo", "prophet", "profeta", "messiah", "mesias", "saint", "santo", "athlete", "atleta", "basketball", "basquet", "baloncesto",
  "ceo", "founder", "fundador", "billionaire", "millonario", "inventor", "painter", "pintor", "strategist", "estratega", "investor",
  "inversor", "entrepreneur", "empresario", "chatbot", "assistant", "asistente", "robot", "artificial", "mason", "illuminat",
  // Empresas y lugares que identifican
  "apple", "tesla", "spacex", "google", "openai", "anthropic", "palantir", "paypal", "lakers",
  "rome", "roman", "roma", "greek", "griego", "greece", "grecia", "athens", "atenas", "egypt", "egipt", "france", "french", "frances",
  "corsica", "corcega", "italy", "italian", "italia", "florence", "florencia", "china", "chinese", "chino", "american", "americano",
  "illinois", "kentucky", "south african", "sudafric", "british", "britanic", "indian", "indio", "german", "aleman", "galilee", "galilea",
  "nazareth", "bethlehem", "belen", "jerusalem", "jerusalen", "silicon valley", "new york", "nueva york",
  // Épocas
  "ancient", "antiguo", "medieval", "renaissance", "renacimiento", "century", "siglo", "bc ", "a.c.",
]

const minus = (t: string) => sinTildes(t).toLowerCase()

/** Las razones por las que una descripción no puede ir a Voice Design (vacío = pasa). */
export function descripcionSegura(id: string, descripcion: string): string[] {
  const errores: string[] = []
  const d = descripcion.trim()
  if (d.length < 20 || d.length > 1000) errores.push(`${id}: la descripción tiene ${d.length} caracteres (Voice Design pide de 20 a 1.000)`)
  if (!d.includes(ACENTO)) errores.push(`${id}: la descripción no fija el acento («${ACENTO}»)`)
  // Ningún nombre: ni de la casa (todos los residentes, no solo este) ni de fuera.
  const todos = PERSONAJES.map((p) => p.id)
  const nombrados = nombradosEn(d, todos)
  if (nombrados.length) errores.push(`${id}: la descripción nombra a ${nombrados.join(", ")}: una voz original no se describe con un nombre`)
  const terceros = tercerosEn(d)
  if (terceros.length) errores.push(`${id}: la descripción nombra a una persona real (${terceros.join(", ")})`)
  // Nombres que el buscador del semáforo no toma porque son cortos o comunes, pero que aquí sobran.
  // El acento se saca antes: «Latin American» es obligatorio y no es una pista.
  const plano = ` ${minus(d.split(ACENTO).join(" ")).replace(/[^\p{L}\p{N}.]+/gu, " ")} `
  for (const p of PERSONAJES) {
    for (const n of [p.nombre, p.corto, ...aliasDe(p.id)]) {
      const nn = minus(n).trim()
      if (nn.length >= 3 && plano.includes(` ${nn} `)) errores.push(`${id}: la descripción dice «${n}»`)
    }
  }
  for (const nombres of Object.values(TERCEROS_REALES)) {
    for (const n of nombres) if (plano.includes(` ${minus(n)} `)) errores.push(`${id}: la descripción dice «${n}»`)
  }
  const pistas = PISTAS_DE_IDENTIDAD.filter((p) => plano.includes(` ${minus(p)}`) || plano.includes(` ${minus(p).trim()} `))
  if (pistas.length) errores.push(`${id}: la descripción tiene pistas de identidad (${[...new Set(pistas.map((p) => p.trim()))].join(", ")})`)
  // Nada copiado del campo `voz` (personalidad de la persona real): ninguna
  // palabra larga de ese texto puede aparecer en la descripción.
  const voz = PERSONAJES.find((p) => p.id === id)?.voz ?? ""
  const largasDeVoz = new Set(minus(voz).split(/[^\p{L}]+/u).filter((w) => w.length >= 7))
  const copiadas = minus(d).split(/[^\p{L}]+/u).filter((w) => largasDeVoz.has(w))
  if (copiadas.length) errores.push(`${id}: la descripción copia palabras del campo voz de personajes.ts (${[...new Set(copiadas)].join(", ")})`)
  if (voz && minus(d).includes(minus(voz).slice(0, 40))) errores.push(`${id}: la descripción es el campo voz de personajes.ts`)
  return [...new Set(errores)]
}
