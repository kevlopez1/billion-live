// ──────────────────────────────────────────────────────────────
// El plan B de la interfaz: cuando la IA no responde (sin clave, límite,
// error), el personaje contesta con una línea de su guion sobre el tema de
// la pregunta. Las líneas salen de datos/personajes: aquí no se escribe nada
// de un personaje en particular.
// ──────────────────────────────────────────────────────────────

import type { Linea, Personaje, Tema } from "../tipos"

const REGLAS: Array<[Tema, RegExp]> = [
  ["tecnologia", /tecnolog|\bias?\b|inteligencia|\bai\b|robot|software|computador|internet|celular|m[aá]quina|agente|c[oó]digo|startup/],
  ["dinero", /dinero|plata|rico|mill[oó]n|negocio|empresa|invert|d[oó]lar|imperio|vend|venta|cobrar|precio|mercedes|silicon/],
  ["muerte", /muert|morir|buena vida|\bvida\b|miedo/],
  ["guerra", /guerra|batalla|ej[eé]rcito|arma|pelea|conquist|ataque|competencia|rival/],
  ["fe", /dios|\bfe\b|creer|religi|rezar|orar|alma|cielo|milagro/],
  ["verdad", /verdad|mentir|mentira|honest|saber|conocimiento|periodis|noticia/],
  ["casa", /\bcasa\b|blanca|sal[oó]n|habitaci|cuarto|baile|jard[ií]n/],
  ["comida", /comida|comer|cena|hambre|almuerzo|desayuno|caf[eé]/],
  ["poder", /poder|mandar|gobern|presiden|l[ií]der|rey|emperador|manda|jefe/],
  ["futuro", /futuro|ma[nñ]ana|plan|sue[nñ]o|meta|2030|2040/],
  ["deporte", /deporte|b[aá]squet|tenis|p[aá]del|gimnasio|correr|entren|pelota|golf/],
  ["disciplina", /disciplin|h[aá]bito|madrug|constancia|esfuerzo|foco|trabajo duro/],
]

export function detectarTema(texto: string): Tema | null {
  const t = texto.toLowerCase()
  for (const [tema, re] of REGLAS) if (re.test(t)) return tema
  return null
}

const azar = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** Una línea de guion del personaje sobre el tema; si no tiene, una de las suyas. */
export function lineaDeGuion(p: Personaje, tema: Tema | null): { texto: string; cita: boolean } {
  const delTema = tema ? p.temas[tema] : undefined
  const todas = Object.values(p.temas).flat() as Linea[]
  const fuente: Linea[] =
    delTema && delTema.length ? delTema : todas.length ? todas : p.pensamientos.length ? p.pensamientos : p.replicas
  if (!fuente.length) return { texto: "…", cita: false }
  const l = azar(fuente)
  return typeof l === "string" ? { texto: l, cita: false } : { texto: l.t, cita: true }
}
