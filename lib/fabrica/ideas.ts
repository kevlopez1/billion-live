// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LAS IDEAS DEL DÍA
//
// De lo que vivió la casa salen las ideas: 3 a 6 videos más 1 de reserva
// (solo verdes). Las fuentes son de la casa, nunca de un visitante:
//   - casa_blanca_memoria, tipos "conversacion_casa" (la pidió Kev, sin texto
//     libre), "trabajo" y "diario".
//     Fuera "charla" (resumen de una charla con un visitante), "noticia" (trae
//     entre comillas la noticia que escribió el visitante), "consejo" (trae
//     entre comillas el tema que escribió el visitante),
//     "conversacion_visitante" (la pidió la ruta pública: su resumen puede
//     traer el tema o el contexto que escribió el visitante) y "conversacion"
//     (el tipo viejo: todas sus filas salieron de la ruta pública).
//   - casa_blanca_conciencia: meta, pensamiento y opiniones de cada uno (la
//     reflexión diaria).
//   - ESPECIALES de personajes.ts, solo si la memoria no alcanza.
// En 7 días no se repite el par de protagonistas ni el tema.
//
// elegirIdeas() es pura (se prueba sin base); leerFuentesDeIdeas() es la que
// lee la base, con el cómo de cada fallo en el log.
// ──────────────────────────────────────────────────────────────

import { ESPECIALES, PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { TIPOS_DE_LA_CASA, TIPOS_DE_VISITANTE, type Conciencia, type Recuerdo } from "@/lib/casa-blanca-memoria"
import { aliasDe, luzDe, nombradosEn, SEMAFORO, tercerosEn } from "./semaforo"
import type { Pilar } from "./textos"

/**
 * Los tipos de recuerdo que puede usar la fábrica y los que traen texto de un
 * visitante viven junto a TIPOS_RECUERDO (lib/casa-blanca-memoria.ts): el
 * servidor de la casa también los usa para que una conversación de la casa
 * no se escriba con material de visitantes.
 */
export { TIPOS_DE_LA_CASA, TIPOS_DE_VISITANTE }

export interface Idea {
  pilar: Pilar
  /** Los dos protagonistas primero; el guionista puede sumar otros de fondo. */
  personajes: string[]
  /** "a|b", ordenado. */
  par: string
  /** Palabras clave del tema (para no repetirlo en 7 días). */
  tema: string
  /** Lo que pasó en la casa: el punto de partida del guion. */
  semilla: string[]
  /** De dónde salió: ids de recuerdos, "conciencia:<id>" o "especial:<par>". */
  fuentes: string[]
  esReserva: boolean
  puntaje: number
}

/** Un video ya planeado (de fabrica_videos): su día, su reparto (protagonistas primero) y su tema. */
export interface IdeaPasada {
  dia: string
  personajes: string[]
  tema?: string | null
}

export interface FuentesDeIdeas {
  recuerdos: Recuerdo[]
  conciencias: Conciencia[]
  /** Lo planeado en los últimos 7 días (y lo de hoy, si ya hay). */
  historial: IdeaPasada[]
}

export const DIAS_SIN_REPETIR = 7
/** Un residente sale como protagonista en dos ideas del día como mucho. */
const MAX_POR_PERSONAJE = 2
/** Dos temas con dos palabras clave en común son el mismo tema. */
const PALABRAS_EN_COMUN = 2
const ORDEN_PILARES: readonly Pilar[] = ["camara-oculta", "historia", "consejo"]
/** Los que se sientan en la sala de guerra en la temporada: compañeros de quien vivió algo solo. */
const SALA_DE_GUERRA = ["suntzu", "napoleon", "socrates", "marco", "claude", "chatgpt"]

// ── Pares y temas ─────────────────────────────────────────────

/** ¿Puede la fábrica usar un recuerdo de este tipo? Solo los de la casa; un tipo desconocido, no. */
export const esDeLaCasa = (tipo: string) => (TIPOS_DE_LA_CASA as readonly string[]).includes(tipo)

/** Una semilla que nombra a un visitante viene de algo que contó un visitante. */
export const HABLA_DE_UN_VISITANTE = /\bvisitantes?\b/i

export const parDe = (a: string, b: string) => [a, b].sort().join("|")
const parDeLista = (ids: string[]) => (ids.length >= 2 ? parDe(ids[0], ids[1]) : null)

const VACIAS = new Set(
  "porque cuando donde sobre entre hasta desde hacia contra durante mientras tambien también todavia todavía siempre nunca ahora antes después despues otra otras otro otros mismo misma mucho mucha muchos muchas poco pocos nadie alguien algo nada cada todos todas quien quién cual cuál estos estas esos esas aquel aquella ellos ellas nuestro nuestra nosotros ustedes estaba estaban estoy estuve tengo tiene tienen tenía hacer hacía hizo dijo dije digo decir puede pueden quiero quiere sería será fueron había habían hemos están estamos parece pienso creo sabía cosas veces mejor menos aunque luego entonces después entre sigue seguía vamos vuelve volvió sentí siento mañana noche tarde quedó queda quedan casa equipo entregó"
    .split(" "),
)
const NOMBRES = new Set(
  PERSONAJES.flatMap((p) => aliasDe(p.id).flatMap((a) => a.toLocaleLowerCase("es").split(/\s+/))).concat(["kev", "kevin"]),
)

/** Las palabras que dicen de qué trata un texto: las de 5 letras o más que no son vacías ni nombres. Hasta 4, en orden. */
export function palabrasClave(textos: string[]): string[] {
  const out: string[] = []
  for (const t of textos) {
    for (const w of t.toLocaleLowerCase("es").split(/[^\p{L}]+/u)) {
      if (w.length >= 5 && !VACIAS.has(w) && !NOMBRES.has(w) && !out.includes(w)) out.push(w)
      if (out.length >= 4) return out
    }
  }
  return out
}

export function mismoTema(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const A = new Set(a.split(" ").filter(Boolean))
  const comunes = b.split(" ").filter((w) => A.has(w)).length
  return comunes >= Math.min(PALABRAS_EN_COMUN, A.size)
}

const DIA_MS = 86_400_000
const diaANum = (d: string) => Date.parse(`${d}T00:00:00Z`)

// ── Candidatos ────────────────────────────────────────────────

type Candidato = Omit<Idea, "esReserva">

const PJ = new Map(PERSONAJES.map((p) => [p.id, p]))
const nombreDe = (id: string) => PJ.get(id)?.corto ?? id

function candidatos(f: FuentesDeIdeas, dia: string): Candidato[] {
  const out: Candidato[] = []
  const hoy = diaANum(dia)
  const frescura = (creado: string) => {
    const edad = (hoy - Date.parse(creado)) / DIA_MS
    return Number.isFinite(edad) ? Math.max(0.2, 1 - Math.max(0, edad) / 8) : 0.2
  }
  const conciencia = new Map(f.conciencias.map((c) => [c.personajeId, c]))
  /**
   * Con quién puede protagonizar alguien que vivió algo solo: los que más le
   * importan (opinión más fuerte, a favor o en contra) y después los de la sala
   * de guerra. Varios, para que un par ya usado no deje la idea sin compañero.
   */
  const compañeros = (id: string): string[] => {
    const ops = Object.entries(conciencia.get(id)?.opiniones ?? {})
      .filter(([otro]) => otro !== id && PJ.has(otro))
      .sort((a, b) => Math.abs(b[1].valor) - Math.abs(a[1].valor) || a[0].localeCompare(b[0]))
      .map(([otro]) => otro)
    return [...new Set([...ops, ...SALA_DE_GUERRA])].filter((x) => x !== id).slice(0, 4)
  }
  const agregar = (pilar: Pilar, a: string, b: string | null, semilla: string[], fuentes: string[], puntaje: number) => {
    if (!b || a === b || !PJ.has(a) || !PJ.has(b)) return
    const texto = semilla.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean)
    if (!texto.length) return
    out.push({ pilar, personajes: [a, b], par: parDe(a, b), tema: palabrasClave(texto).join(" "), semilla: texto, fuentes, puntaje })
  }

  for (const r of f.recuerdos) {
    // Lo que no es de la casa no entra, aunque el lector lo haya traído.
    if (!esDeLaCasa(r.tipo)) continue
    const peso = r.importancia * frescura(r.creado)
    if (r.tipo === "conversacion_casa") {
      for (const otro of r.con) agregar("camara-oculta", r.personajeId, otro, [r.texto], [r.id], peso)
    } else {
      const pilar: Pilar = r.tipo === "diario" ? "historia" : "consejo"
      const otros = r.tipo === "diario" && r.con.length ? r.con : compañeros(r.personajeId)
      // Cada compañero más abajo pesa un poco menos: primero el que más le importa.
      otros.forEach((otro, k) => agregar(pilar, r.personajeId, otro, [r.texto, conciencia.get(r.personajeId)?.meta ?? ""], [r.id], peso * (1 - 0.1 * k)))
    }
  }

  for (const c of f.conciencias) {
    for (const [otro, op] of Object.entries(c.opiniones)) {
      if (Math.abs(op.valor) < 30 || !op.frase) continue
      agregar(
        op.valor < 0 ? "camara-oculta" : "historia",
        c.personajeId,
        otro,
        [`${nombreDe(c.personajeId)} sobre ${nombreDe(otro)}: ${op.frase}`, c.pensamiento],
        [`conciencia:${c.personajeId}`],
        (Math.abs(op.valor) / 10) * frescura(`${c.dia}T12:00:00Z`),
      )
    }
  }

  // Si la memoria no alcanza: las conversaciones de guion de personajes.ts (datos de la casa, puntaje bajo).
  for (const [par, lineas] of Object.entries(ESPECIALES)) {
    const [a, b] = par.split("|")
    agregar("camara-oculta", a, b, lineas.slice(0, 3).map(([, t]) => t), [`especial:${par}`], 0.5)
  }
  return out
}

// ── La elección ───────────────────────────────────────────────

export interface Eleccion {
  ideas: Idea[]
  reserva: Idea | null
  /** Por qué no se llegó a lo pedido, si no se llegó. */
  faltan: string[]
}

/** Qué luz pide cada lugar: las ideas aceptan verdes y amarillos; la reserva, solo verdes. */
const sirve = (ids: string[], dia: string, soloVerdes: boolean) =>
  ids.every((id) => {
    const l = luzDe(id, dia)
    return l === "verde" || (!soloVerdes && l === "amarillo")
  })

/**
 * Elige `cuantas` ideas (3 a 6) y una reserva verde para el día de salida `dia`.
 * Determinista: con las mismas fuentes, las mismas ideas.
 */
export function elegirIdeas(f: FuentesDeIdeas, op: { dia: string; cuantas: number }): Eleccion {
  const cuantas = Math.max(3, Math.min(6, Math.round(op.cuantas)))
  const desde = diaANum(op.dia) - DIAS_SIN_REPETIR * DIA_MS
  const pasado = f.historial.filter((h) => {
    const d = diaANum(h.dia)
    return Number.isFinite(d) && d > desde && d <= diaANum(op.dia)
  })
  const paresUsados = new Set(pasado.map((h) => parDeLista(h.personajes)).filter((p): p is string => !!p))
  const temasUsados = pasado.map((h) => h.tema).filter((t): t is string => !!t)
  const vivosYFuera = Object.keys(SEMAFORO).filter((id) => ["vivo", "fuera"].includes(luzDe(id, op.dia)))

  const todos = candidatos(f, op.dia)
    // Una semilla que nombra a un vivo, a alguien fuera o a una persona real de
    // fuera de la casa (Bezos, Evo…) invita al modelo a ponerlo: se descarta antes.
    // Tampoco una que habla de un visitante: la reflexión diaria (diario y
    // conciencia) lee también las charlas, noticias y consejos de visitantes,
    // y tiene la orden de llamarlo «un visitante». Esa semilla puede traer su
    // tema contado por el residente: fuera. (Riesgo que queda: una reflexión
    // que retoma el tema de un visitante sin nombrarlo: lo decide Kev.)
    .filter((c) => !c.semilla.some((s) => nombradosEn(s, vivosYFuera).length || tercerosEn(s).length || HABLA_DE_UN_VISITANTE.test(s)))
    .sort((a, b) => b.puntaje - a.puntaje || a.par.localeCompare(b.par) || a.fuentes[0].localeCompare(b.fuentes[0]))

  const elegidas: Idea[] = []
  const veces = new Map<string, number>()
  const libre = (c: Candidato, soloVerdes: boolean) =>
    sirve(c.personajes, op.dia, soloVerdes) &&
    !paresUsados.has(c.par) &&
    !temasUsados.some((t) => mismoTema(c.tema, t)) &&
    c.personajes.every((id) => (veces.get(id) ?? 0) < MAX_POR_PERSONAJE)
  const tomar = (c: Candidato, esReserva: boolean): Idea => {
    paresUsados.add(c.par)
    if (c.tema) temasUsados.push(c.tema)
    for (const id of c.personajes) veces.set(id, (veces.get(id) ?? 0) + 1)
    return { ...c, personajes: [...c.personajes], semilla: [...c.semilla], fuentes: [...c.fuentes], esReserva }
  }

  for (let k = 0; k < cuantas; k++) {
    const quiero = ORDEN_PILARES[k % ORDEN_PILARES.length]
    const c = todos.find((x) => x.pilar === quiero && libre(x, false)) ?? todos.find((x) => libre(x, false))
    if (!c) break
    elegidas.push(tomar(c, false))
  }
  const r = todos.find((x) => libre(x, true))
  const reserva = r ? tomar(r, true) : null

  const faltan: string[] = []
  if (elegidas.length < cuantas)
    faltan.push(`se pidieron ${cuantas} ideas y salieron ${elegidas.length}: no hay más pares ni temas sin repetir en ${DIAS_SIN_REPETIR} días`)
  if (!reserva) faltan.push("no hay una idea de reserva con solo personajes verdes")
  return { ideas: elegidas, reserva, faltan }
}

// ── Lectura de la base ────────────────────────────────────────

/** Lo que la tanda inyecta: la base de verdad o una de mentira en las pruebas. */
export interface PuertoIdeas {
  recuerdosDesde(desde: string, tipos: readonly string[]): Promise<Recuerdo[]>
  conciencias(): Promise<Conciencia[]>
  /** fabrica_videos desde ese día: dia, personajes, idea.tema. */
  historialDesde(desde: string): Promise<IdeaPasada[]>
}

/**
 * Lee las fuentes. Si el historial no se puede leer, no hay ideas: sin él no
 * se sabe qué se repitió (un vacío no es un dato). Si la memoria falla, se
 * sigue con la conciencia y ESPECIALES, y queda dicho en el log.
 */
export async function leerFuentesDeIdeas(p: PuertoIdeas, dia: string): Promise<{ ok: true; fuentes: FuentesDeIdeas } | { ok: false; como: string }> {
  const desde = new Date(diaANum(dia) - DIAS_SIN_REPETIR * DIA_MS).toISOString().slice(0, 10)
  let historial: IdeaPasada[]
  try {
    historial = await p.historialDesde(desde)
  } catch (e) {
    const como = `no se pudo leer el historial de fabrica_videos: ${(e as Error)?.message ?? String(e)}`
    console.error(`[fabrica/ideas] ${como}`)
    return { ok: false, como }
  }
  const [rec, con] = await Promise.allSettled([p.recuerdosDesde(desde, TIPOS_DE_LA_CASA), p.conciencias()])
  if (rec.status === "rejected") console.error("[fabrica/ideas] la memoria no se pudo leer, se sigue sin ella:", (rec.reason as Error)?.message ?? rec.reason)
  if (con.status === "rejected") console.error("[fabrica/ideas] la conciencia no se pudo leer, se sigue sin ella:", (con.reason as Error)?.message ?? con.reason)
  return {
    ok: true,
    fuentes: {
      recuerdos: rec.status === "fulfilled" ? rec.value : [],
      conciencias: con.status === "fulfilled" ? con.value : [],
      historial,
    },
  }
}

type ClienteSupabase = NonNullable<ReturnType<typeof import("@/lib/supabase-admin").getAdminClient>>

/** El puerto con Supabase (service role). Cada consulta que falla lanza con el mensaje de la base. */
export function puertoIdeasSupabase(admin: ClienteSupabase): PuertoIdeas {
  return {
    async recuerdosDesde(desde, tipos) {
      const { data, error } = await admin
        .from("casa_blanca_memoria")
        .select("id, creado, personaje_id, tipo, texto, importancia, con")
        .in("tipo", [...tipos])
        .gte("creado", `${desde}T04:00:00Z`)
        .order("creado", { ascending: false })
        .limit(400)
      if (error) throw new Error(`casa_blanca_memoria: ${error.message}`)
      return (data ?? []).map((f: Record<string, unknown>) => ({
        id: String(f.id),
        personajeId: String(f.personaje_id),
        tipo: f.tipo as Recuerdo["tipo"],
        texto: String(f.texto ?? ""),
        importancia: Number(f.importancia) || 5,
        con: Array.isArray(f.con) ? (f.con as string[]) : [],
        creado: String(f.creado),
      }))
    },
    async conciencias() {
      const { data, error } = await admin.from("casa_blanca_conciencia").select("personaje_id, dia, animo, meta, pensamiento, diario, opiniones, actualizado")
      if (error) throw new Error(`casa_blanca_conciencia: ${error.message}`)
      const { aOpiniones } = await import("@/lib/casa-blanca-memoria")
      return (data ?? []).map((f: Record<string, unknown>) => ({
        personajeId: String(f.personaje_id),
        dia: String(f.dia),
        animo: String(f.animo ?? ""),
        meta: String(f.meta ?? ""),
        pensamiento: String(f.pensamiento ?? ""),
        diario: String(f.diario ?? ""),
        opiniones: aOpiniones(f.opiniones),
        actualizado: String(f.actualizado),
      }))
    },
    async historialDesde(desde) {
      const { data, error } = await admin.from("fabrica_videos").select("dia, personajes, idea").gte("dia", desde)
      if (error) throw new Error(`fabrica_videos: ${error.message}`)
      return (data ?? []).map((f: Record<string, unknown>) => ({
        dia: String(f.dia),
        personajes: Array.isArray(f.personajes) ? (f.personajes as string[]) : [],
        tema: typeof (f.idea as { tema?: unknown } | null)?.tema === "string" ? ((f.idea as { tema: string }).tema) : null,
      }))
    },
  }
}
