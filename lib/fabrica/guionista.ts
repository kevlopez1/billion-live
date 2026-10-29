// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL GUIONISTA
//
// Idea → Episodio (el contrato de components/casa-blanca/estudio/guion.ts):
//   1. Claude escribe el guion en JSON (modelo barato por defecto).
//   2. Las guardas de código lo revisan (guardas.ts). Si algo falla, el
//      modelo recibe las razones y lo intenta de nuevo (3 intentos en total).
//   3. Una segunda pasada barata revisa lo que el código no puede medir
//      (difamación, límites de cada personaje, hechos inventados).
// Una respuesta que no es JSON se repite UNA vez; la segunda, se rechaza.
// Si la segunda pasada no contesta, el guion no sale (falla cerrado).
//
// El cliente de la IA se inyecta (PedirIA): las pruebas usan uno de mentira.
// Antes de cada llamada se reserva el gasto (reservarGasto) si la tanda lo da.
// ──────────────────────────────────────────────────────────────

import { createHash } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import type { Episodio, Red } from "@/components/casa-blanca/estudio/guion"
import { APERTURA_S, CIERRE_S, textoFinal } from "@/components/casa-blanca/estudio/linea"
import { LUGARES } from "@/components/casa-blanca/lugares"
import {
  DURACION_MAX,
  DURACION_MIN,
  DURACION_MIN_TIKTOK,
  FAMILIAS,
  repartoDe,
  revisarTodo,
  textosVisibles,
  type ContextoGuion,
  type TextosDelVideo,
} from "./guardas"
import type { Idea } from "./ideas"
import { aDia, luzDe } from "./semaforo"
import { MAX_TITULO, textosDe, type Pilar } from "./textos"

// ── Configuración ─────────────────────────────────────────────

const env = (k: string) => (process.env[k] ?? "").trim()
/** El más barato (Haiku 5.5: $0,10 / $0,50 por millón). Sonnet solo si Kev lo decide (paso 13), por env. */
export const MODELO_POR_DEFECTO = "claude-haiku-5-5"
export const modeloGuion = () => env("FABRICA_MODELO_GUION") || env("FABRICA_MODELO") || MODELO_POR_DEFECTO
export const modeloRevision = () => env("FABRICA_MODELO_REVISION") || MODELO_POR_DEFECTO
export const MAX_INTENTOS = 3

// ── El puerto de la IA ────────────────────────────────────────

export interface PedidoIA {
  /** Para el log: "guion" o "revision". */
  paso: string
  modelo: string
  sistema: string
  usuario: string
  maxTokens: number
  esfuerzo: "low" | "medium" | "high"
}

export type RespuestaIA =
  | { ok: true; texto: string; fin: string | null; uso?: { entrada: number; salida: number; cache?: number } }
  | { ok: false; como: string }

export type PedirIA = (p: PedidoIA) => Promise<RespuestaIA>

/** Lo único que el guionista usa del SDK: así las pruebas le pasan un cliente de mentira. */
export interface ClienteMensajes {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> }
}

/**
 * El puerto real: Anthropic con la clave propia de la fábrica (FABRICA_ANTHROPIC_KEY, workspace con tope, paso 6).
 * `crear` arma el cliente; las pruebas lo cambian por uno que no sale a la red.
 */
export function pedirConAnthropic(
  apiKey = env("FABRICA_ANTHROPIC_KEY"),
  crear: (apiKey: string) => ClienteMensajes = (k) => new Anthropic({ apiKey: k, timeout: 120_000, maxRetries: 1 }),
): PedirIA {
  return async (p) => {
    if (!apiKey) return { ok: false, como: "falta FABRICA_ANTHROPIC_KEY (clave propia de la fábrica, con tope de gasto)" }
    const cliente = crear(apiKey)
    try {
      const r = await cliente.messages.create({
        model: p.modelo,
        max_tokens: p.maxTokens,
        // El sistema es estable dentro de una tanda: se lee de la caché.
        system: [{ type: "text", text: p.sistema, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: p.usuario }],
        output_config: { effort: p.esfuerzo },
      })
      const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("")
      const uso = { entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cache: r.usage.cache_read_input_tokens ?? 0 }
      console.log(`[fabrica/guionista] ${p.paso} · ${p.modelo} · fin=${r.stop_reason} · entrada=${uso.entrada} · caché=${uso.cache} · salida=${uso.salida}`)
      return { ok: true, texto, fin: r.stop_reason, uso }
    } catch (e) {
      const como =
        e instanceof Anthropic.APIError
          ? `${e.status ?? "sin estado"} ${e.constructor.name}: ${e.message}`.slice(0, 400)
          : `${(e as Error)?.name ?? "Error"}: ${(e as Error)?.message ?? String(e)}`.slice(0, 400)
      console.error(`[fabrica/guionista] ${p.paso} · ${p.modelo} falló: ${como}`)
      return { ok: false, como }
    }
  }
}

/** Precio por millón de tokens (entrada, salida). Lo desconocido se estima como Opus: mejor sobrestimar el gasto. */
function precio(modelo: string): [number, number] {
  if (modelo.includes("haiku")) return [0.1, 0.5]
  if (modelo.includes("sonnet")) return [2, 10]
  return [4, 20]
}

/** El peor caso de una llamada en USD: la entrada estimada (≈3,5 caracteres por token) y todo el tope de salida. */
export function costoEstimado(p: Pick<PedidoIA, "modelo" | "sistema" | "usuario" | "maxTokens">): number {
  const [ent, sal] = precio(p.modelo)
  const tokensEntrada = (p.sistema.length + p.usuario.length) / 3.5
  return (tokensEntrada * ent + p.maxTokens * sal) / 1_000_000
}

// ── La forma de la respuesta ──────────────────────────────────

const Camara = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("toma"), toma: z.string(), personaje: z.string().optional() }),
  z.object({ tipo: z.literal("seguir"), personaje: z.string() }),
  z.object({ tipo: z.literal("lugar"), lugar: z.string() }),
])
const Plano = z.object({
  dur: z.number(),
  camara: Camara,
  hora: z.string().optional(),
  titulo: z.string().optional(),
  tituloEn: z.enum(["centro", "arriba"]).optional(),
  rotulo: z.string().optional(),
  dialogo: z.array(z.object({ quien: z.string(), texto: z.string(), cita: z.boolean().optional() })).optional(),
  reunir: z.array(z.string()).optional(),
  maqueta: z.boolean().optional(),
  visor: z.enum(["cine", "camara"]).optional(),
})
export const SalidaGuion = z.object({
  episodio: z.object({
    titulo: z.string().min(1),
    formato: z.enum(["16:9", "4:3"]),
    visor: z.enum(["cine", "camara"]),
    planos: z.array(Plano).min(1).max(20),
  }),
  descripcion: z.string().max(200).optional(),
  miniatura: z.string().min(1).max(40),
})
export type SalidaGuion = z.infer<typeof SalidaGuion>

const SalidaRevision = z.object({ ok: z.boolean(), problemas: z.array(z.string()).default([]) })

/** El primer objeto JSON de un texto (el modelo a veces lo envuelve en ``` o le pone una frase antes). */
export function extraerJson(texto: string): unknown {
  const sinCerco = texto.replace(/```(?:json)?/gi, "")
  const ini = sinCerco.indexOf("{")
  const fin = sinCerco.lastIndexOf("}")
  if (ini < 0 || fin <= ini) throw new Error("no hay un objeto JSON en la respuesta")
  return JSON.parse(sinCerco.slice(ini, fin + 1))
}

/** Lee la respuesta con un esquema. Devuelve el porqué si no sirve (sin tirar). */
export function leerRespuesta<T>(texto: string, esquema: z.ZodType<T>): { ok: true; datos: T } | { ok: false; como: string } {
  let crudo: unknown
  try {
    crudo = extraerJson(texto)
  } catch (e) {
    return { ok: false, como: `JSON inválido: ${(e as Error).message}`.slice(0, 300) }
  }
  const r = esquema.safeParse(crudo)
  if (r.success) return { ok: true, datos: r.data }
  const detalle = r.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "raíz"}: ${i.message}`)
  return { ok: false, como: `el JSON no tiene la forma pedida (${detalle.join("; ")})` }
}

// ── Ids, textos y huella ──────────────────────────────────────

/** "Napoleón no duerme" → "napoleon-no-duerme". */
export function slug(s: string, max = 30): string {
  const t = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return t.slice(0, max).replace(/-+$/g, "") || "video"
}

/** fab-AAAAMMDD-n-slug (n = el slot; "r" para la reserva). */
export function idDeVideo(dia: string, slot: number | null, titulo: string): string {
  return `fab-${aDia(dia).replace(/-/g, "")}-${slot ?? "r"}-${slug(titulo)}`
}

/** Huella del guion que vio Kev: si cambia una coma, la aprobación no vale. */
export function hashDeGuion(ep: Episodio, textos: TextosDelVideo): string {
  return createHash("sha256").update(JSON.stringify({ ep, textos })).digest("hex")
}

// ── Los prompts ───────────────────────────────────────────────

const PJ = new Map(PERSONAJES.map((p) => [p.id, p]))

const PILARES_TEXTO: Record<Pilar, string> = {
  "camara-oculta": "Cámara oculta: un solo momento entre los dos protagonistas, con conflicto o química, como si nadie los mirara. Visor «camara».",
  historia: "Historia: algo que le pasa a uno de los dos y que el otro cambia; cierra con una pregunta al espectador.",
  consejo:
    "El consejo: los protagonistas trabajan en la sala de guerra una tarea real para uno de los tres objetivos de Kev; si TODOS los personajes son verdes, un plano puede mostrar «{RECAUDADO} de {META}» en la Sala de Control (lugar ciudad-club).",
}

/** Las reglas fijas del guionista. Estable para un día de salida: se lee de la caché. */
export function sistemaGuionista(ctx: ContextoGuion): string {
  const dia = aDia(ctx.fechaSalida)
  const porLuz = (luz: string) =>
    PERSONAJES.filter((p) => luzDe(p.id, dia) === luz)
      .map((p) => p.id)
      .join(", ")
  const fichas = PERSONAJES.filter((p) => luzDe(p.id, dia) !== "fuera")
    .map((p) => `- ${p.id} (${p.corto}, ${luzDe(p.id, dia)}): ${p.rol}. Voz: ${p.voz} Límites: ${p.limites ?? "ficción declarada"} Dato real: ${p.bio}`)
    .join("\n")
  const lugares = LUGARES.map((l) => `${l.id} (${l.nombre})`).join(", ")
  const tomas = ctx.tomas.map((t) => `${t.id} (${t.duracion} s)`).join(", ")
  const min = ctx.redes.includes("tiktok") ? DURACION_MIN_TIKTOK : DURACION_MIN
  const planosMin = (min - APERTURA_S - CIERRE_S).toFixed(1)
  const planosMax = (DURACION_MAX - APERTURA_S - CIERRE_S).toFixed(1)
  return [
    "Eres el guionista de La Casa Blanca Project: una serie de ficción hecha con IA en la que 24 personajes inspirados en figuras reales viven en una Casa Blanca con tres pisos inventados bajo tierra. Escribes UN video horizontal a partir de algo que pasó en la casa.",
    "",
    "DEVUELVES SOLO UN OBJETO JSON, sin texto antes ni después, con esta forma:",
    '{"episodio": {"titulo": string, "formato": "16:9" | "4:3", "visor": "cine" | "camara", "planos": [Plano, ...]}, "descripcion": string (una frase, 160 caracteres o menos), "miniatura": string (3 palabras o menos)}',
    'Plano = {"dur": segundos, "camara": {"tipo": "toma", "toma": id, "personaje"?: id} | {"tipo": "seguir", "personaje": id} | {"tipo": "lugar", "lugar": id}, "hora"?: "HH:MM", "titulo"?: string, "tituloEn"?: "centro" | "arriba", "rotulo"?: string, "dialogo"?: [{"quien": id, "texto": string, "cita"?: true}], "reunir"?: [ids], "visor"?: "cine" | "camara"}',
    "",
    "MEDIDAS (las revisa un programa; si fallan, el guion se rechaza):",
    `- La suma de "dur" de los planos va de ${planosMin} a ${planosMax} s (el estudio agrega ${APERTURA_S} s de apertura y ${CIERRE_S} s de cierre). Cada plano dura de 2 a 15 s.`,
    `- El título del episodio: ${MAX_TITULO} caracteres o menos, es el gancho.`,
    "- Las líneas de un plano se reparten su duración en partes iguales: cada línea lleva como mucho 17 caracteres por segundo de su turno. Líneas cortas.",
    "- Una toma fija no dura más que su duración (abajo, entre paréntesis).",
    "- El primer rótulo dice dónde y a qué hora. Al menos un rótulo con un dato real de un personaje del video, COPIADO de su «Dato real» (abajo): nunca uno de memoria. Un año que no esté en su ficha se rechaza.",
    "- El último plano hace una pregunta al espectador.",
    "",
    `TOMAS: ${tomas}`,
    `LUGARES: ${lugares}`,
    "",
    `SEMÁFORO para la salida del ${dia} (es una regla, no una sugerencia):`,
    `- verdes (pueden hablar): ${porLuz("verde")}`,
    `- amarillos (pueden hablar; el video lo aprueba Kev): ${porLuz("amarillo")}`,
    `- vivos (SOLO de fondo en "reunir", nunca primeros ni solos, sin diálogo, sin cámara encima, sin su nombre en ningún texto): ${porLuz("vivo")}`,
    `- fuera (no aparecen ni se nombran): ${porLuz("fuera")}`,
    "",
    "NUNCA escribes:",
    ...FAMILIAS.map(
      (f) =>
        `- ${f.nombre}${f.cuando === "con_real" ? " (si hay una persona real viva o fallecida en el video)" : f.cuando === "con_persona" ? " (de cualquier persona real, también histórica)" : ""}`,
    ),
    "- Comillas de ningún tipo, en ningún texto (tampoco para el nombre de un libro). La única excepción: una línea de diálogo con \"cita\": true que copie igual una cita marcada en personajes.ts. Si no la sabes exacta, no hay cita. Tampoco «como dijo X:».",
    "- El nombre de una persona real que no vive en la casa (empresarios, políticos, deportistas, artistas): nunca. Tampoco por su cargo («el dueño de Tesla»).",
    "- PRIME, Kev, kevproject, {RECAUDADO} y {META} nunca en boca de una persona real (tampoco histórica): solo en un rótulo o un título.",
    "- Si hay una persona viva o fallecida (en cuadro o nombrada): ni PRIME, ni {RECAUDADO}, ni {META}, ni Kev, ni el reto o el desafío.",
    "- Llaves solo para {RECAUDADO} y {META}, escritas así, exactas.",
    "- Nada que un espectador razonable pueda creer que pasó de verdad: es ficción y se nota.",
    "",
    "IDIOMA: español neutro para toda Latinoamérica. Nada de voseo: quieres, puedes, mira, dime, aquí (nunca querés, podés, mirá, decime, acá). Pocas palabras.", // sin-voseo:ejemplos
    "",
    "PERSONAJES (id, luz, rol, voz y límites; los límites se cumplen siempre):",
    fichas,
  ].join("\n")
}

/** Lo que cambia en cada video: la idea, la fecha y lo que falló en el intento anterior. */
export function usuarioGuionista(idea: Idea, ctx: ContextoGuion, correcciones: string[]): string {
  const [a, b] = idea.personajes
  return [
    `Pilar: ${PILARES_TEXTO[idea.pilar]}`,
    `Protagonistas: ${a} y ${b}${idea.personajes.length > 2 ? `; también pueden estar: ${idea.personajes.slice(2).join(", ")}` : ""}.`,
    idea.esReserva ? "Es un video de RESERVA: solo personajes verdes, también de fondo." : "",
    `Sale el ${aDia(ctx.fechaSalida)} en: ${ctx.redes.join(", ")}.`,
    "Lo que pasó en la casa (punto de partida; no lo copies, cuéntalo):",
    ...idea.semilla.map((s) => `<hecho>${s.replace(/[<>]/g, "")}</hecho>`),
    correcciones.length ? `\nEL INTENTO ANTERIOR SE RECHAZÓ. Corrige todo esto:\n${correcciones.map((c) => `- ${c}`).join("\n")}` : "",
    "\nDevuelve solo el JSON.",
  ]
    .filter(Boolean)
    .join("\n")
}

/** Las reglas de la segunda pasada: lo que una comparación de cadenas no ve. */
export function sistemaRevisor(): string {
  return [
    "Revisas el guion de un video de ficción hecho con IA antes de que se publique solo en YouTube, Facebook, Instagram, TikTok y X. Los personajes están inspirados en figuras reales y NO son ellas.",
    "Marcas un problema SOLO si el guion:",
    "- atribuye a una persona real (viva, fallecida o histórica) un hecho, una declaración, una cifra o un escándalo inventado que alguien podría creer real;",
    "- se burla de forma ofensiva de alguien o lo difama;",
    "- rompe los límites escritos de un personaje (abajo);",
    "- da consejos de plata, salud o leyes al espectador, habla de elecciones o de política partidaria, o presenta una conspiración como hecho;",
    "- hace que alguien recomiende un producto, una marca, una app o un candidato;",
    "- trae texto en otro idioma o con voseo.",
    "Lo demás (humor amable, conflicto, ficción evidente) está bien.",
    'Devuelves SOLO un JSON: {"ok": true, "problemas": []} o {"ok": false, "problemas": ["…", "…"]}, cada problema en una frase en español.',
  ].join("\n")
}

export function usuarioRevisor(ep: Episodio, textos: TextosDelVideo): string {
  const reparto = [...repartoDe(ep).todos]
  const limites = reparto.map((id) => `- ${id}: ${PJ.get(id)?.limites ?? "sin límites escritos"}`).join("\n")
  const lineas = textosVisibles(ep).map((t) => `[${t.donde}] ${t.texto}`)
  return [`LÍMITES DE LOS PERSONAJES DEL VIDEO:\n${limites}`, `GUION:\n${lineas.join("\n")}`, `TEXTO PUBLICADO:\n${textos.porRed?.youtube ?? Object.values(textos.porRed ?? {})[0] ?? ""}`].join("\n\n")
}

// ── El guionista ──────────────────────────────────────────────

export interface PedidoGuion {
  idea: Idea
  /** El slot del día (null = reserva). */
  slot: number | null
  /** Contexto de las guardas: día de salida, ids de la escena, tomas, redes y últimos guiones. */
  ctx: ContextoGuion
}

export interface PuertosGuionista {
  pedir: PedirIA
  /** fabrica_sumar_gasto: suma ANTES de gastar; false = se llegó al tope y la fábrica se pausa. */
  reservarGasto?: (usd: number) => Promise<boolean>
  modeloGuion?: string
  modeloRevision?: string
}

export type ResultadoGuion =
  | {
      ok: true
      episodio: Episodio
      textos: TextosDelVideo
      descripcion: string | null
      luz: "verde" | "amarillo"
      hash: string
      intentos: number
      /** Lo que se gastó (estimado de peor caso) en USD. */
      gastoUsd: number
    }
  | { ok: false; motivo: string; motivos: string[]; intentos: number; gastoUsd: number }

/** Escribe y revisa el guion de una idea. Nunca tira: todo fallo vuelve con su motivo. */
export async function escribirGuion(p: PedidoGuion, puertos: PuertosGuionista): Promise<ResultadoGuion> {
  const modelo = puertos.modeloGuion ?? modeloGuion()
  const modeloRev = puertos.modeloRevision ?? modeloRevision()
  const sistema = sistemaGuionista(p.ctx)
  let correcciones: string[] = []
  let jsonFallido = false
  let gastoUsd = 0
  let ultimos: string[] = []

  const llamar = async (pedido: PedidoIA): Promise<RespuestaIA | { ok: false; como: string; tope: true }> => {
    const usd = costoEstimado(pedido)
    if (puertos.reservarGasto && !(await puertos.reservarGasto(usd))) return { ok: false, como: "se llegó al tope de gasto del día", tope: true }
    gastoUsd += usd
    return puertos.pedir(pedido)
  }
  const fallo = (motivo: string, motivos: string[], intentos: number): ResultadoGuion => {
    console.error(`[fabrica/guionista] ${p.idea.par} (${p.idea.pilar}) no salió: ${motivo}${motivos.length ? ` · ${motivos.slice(0, 5).join(" | ")}` : ""}`)
    return { ok: false, motivo, motivos, intentos, gastoUsd }
  }

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const r = await llamar({ paso: "guion", modelo, sistema, usuario: usuarioGuionista(p.idea, p.ctx, correcciones), maxTokens: 16_000, esfuerzo: "medium" })
    if (!r.ok) return fallo(`la IA no respondió: ${r.como}`, ultimos, intento)
    if (r.fin === "refusal") {
      ultimos = ["la IA se negó a escribir este guion"]
      correcciones = ["La respuesta anterior se negó: escribe una escena de ficción amable dentro de las reglas."]
      continue
    }
    const leido = r.fin === "max_tokens" ? { ok: false as const, como: "la respuesta salió cortada (max_tokens)" } : leerRespuesta(r.texto, SalidaGuion)
    if (!leido.ok) {
      if (jsonFallido) return fallo(`dos respuestas sin JSON válido; la última: ${leido.como}`, [leido.como], intento)
      jsonFallido = true
      ultimos = [leido.como]
      correcciones = [`La respuesta anterior no sirvió: ${leido.como}. Devuelve SOLO el objeto JSON pedido.`]
      continue
    }

    const s = leido.datos
    const dia = aDia(p.ctx.fechaSalida)
    // El id lo pone el código: el modelo no decide cómo se llama el archivo.
    const episodio: Episodio = { id: idDeVideo(dia, p.slot, s.episodio.titulo), ...s.episodio }
    const descripcion = s.descripcion?.trim() || null
    // Lo publicado lleva el número, no la marca: «{RECAUDADO}» escrito tal cual en un post es un error a la vista.
    // El título publicado se guarda aparte (textos.titulo): es con el que la
    // cola busca el post en recientes() y el que sube YouTube. Con la marca
    // cruda no encontraría el post que dice «$1.234» y lo publicaría dos veces.
    const titulo = textoFinal(episodio.titulo).replace(/\s+/g, " ").trim()
    const textos: TextosDelVideo = {
      titulo,
      porRed: textosDe({ titulo, pilar: p.idea.pilar, descripcion: descripcion ? textoFinal(descripcion) : undefined }, p.ctx.redes),
      miniatura: s.miniatura.trim(),
    }
    const rev = revisarTodo(episodio, textos, p.ctx)
    const errores = [...rev.errores]
    if (p.idea.esReserva && rev.luz !== "verde") errores.push("es un video de reserva: solo personajes verdes (ni amarillos ni vivos de fondo)")
    if (errores.length || rev.luz === "fuera") {
      ultimos = errores
      correcciones = errores
      continue
    }

    const revision = await llamar({ paso: "revision", modelo: modeloRev, sistema: sistemaRevisor(), usuario: usuarioRevisor(episodio, textos), maxTokens: 4_000, esfuerzo: "low" })
    if (!revision.ok) return fallo(`la segunda pasada no respondió: ${revision.como}`, [], intento)
    const veredicto = revision.fin === "refusal" ? { ok: false as const, como: "la segunda pasada se negó" } : leerRespuesta(revision.texto, SalidaRevision)
    if (!veredicto.ok) return fallo(`la segunda pasada no dio un veredicto: ${veredicto.como}`, [], intento)
    const problemas = veredicto.datos.problemas ?? []
    if (!veredicto.datos.ok || problemas.length) {
      ultimos = problemas.length ? problemas.map((x) => `revisión: ${x}`) : ["revisión: rechazado sin motivo"]
      correcciones = ultimos
      continue
    }

    return { ok: true, episodio, textos, descripcion, luz: rev.luz, hash: hashDeGuion(episodio, textos), intentos: intento, gastoUsd }
  }
  return fallo(`${MAX_INTENTOS} guiones seguidos no pasaron las guardas`, ultimos, MAX_INTENTOS)
}

// ── El contexto del estudio ───────────────────────────────────

const TOMAS_DEL_CONTRATO = ["portico-norte", "dron", "bajada", "departamento", "seguir", "sala-guerra", "ciudad", "maqueta"]

/**
 * Las tomas de la escena con su duración. motor-camara.ts trae three: si no
 * carga (Node sin WebGL), se usan los ids del contrato con 9 s, y queda dicho.
 */
export async function tomasDelMotor(): Promise<Array<{ id: string; duracion: number }>> {
  try {
    const m = (await import("@/components/casa-blanca/escena/motor-camara")) as unknown as {
      TOMAS_CINE?: ReadonlyArray<{ id: string; duracion: number }>
      default?: { TOMAS_CINE?: ReadonlyArray<{ id: string; duracion: number }> }
    }
    const tomas = m.TOMAS_CINE ?? m.default?.TOMAS_CINE
    if (!tomas?.length) throw new Error("motor-camara no exporta TOMAS_CINE")
    return tomas.map((t) => ({ id: t.id, duracion: t.duracion }))
  } catch (e) {
    console.error(`[fabrica/guionista] no se cargaron las tomas del motor (${(e as Error)?.message ?? e}); se usan las del contrato con 9 s`)
    return TOMAS_DEL_CONTRATO.map((id) => ({ id, duracion: 9 }))
  }
}

export type { Red }
