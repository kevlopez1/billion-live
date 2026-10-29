// ──────────────────────────────────────────────────────────────
// LA CASA BLANCA PROJECT — la memoria y la conciencia, en la base
//
// Lo que viven los residentes ya no se pierde en el navegador de cada
// visitante: se guarda en Supabase (casa_blanca_memoria) y lo recuerdan para
// todos. Una vez por día cada uno reflexiona sobre lo vivido y amanece con un
// estado interior (casa_blanca_conciencia). Los prompts y la reflexión viven
// en lib/casa-blanca-servidor.ts; aquí, los datos: qué se guarda, cómo se
// limpia y cómo se lee.
//
// Nada de lo de aquí tira: si la base falla, se deja el porqué en el log y la
// casa sigue sin memoria compartida, como antes.
// ──────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto"
import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { getAdminClient } from "@/lib/supabase-admin"

const TABLA_MEMORIA = "casa_blanca_memoria"
const TABLA_CONCIENCIA = "casa_blanca_conciencia"
const TABLA_REFLEXION = "casa_blanca_reflexion"
const COLUMNAS_MEMORIA = "id, creado, personaje_id, tipo, texto, importancia, con"
const COLUMNAS_CONCIENCIA = "personaje_id, dia, animo, meta, pensamiento, diario, opiniones, actualizado"

/**
 * Las conversaciones entre residentes (conversar()) se guardan según QUIÉN
 * las pidió, no según si traen `tema`:
 *   - "conversacion_casa": la pidió Kev (con su clave) y sin texto libre (ni
 *     tema, ni contexto.actividad, ni contexto.recuerdos, ni contexto.hora).
 *     Es la única que puede usar la fábrica de videos (lib/fabrica/ideas.ts,
 *     TIPOS_DE_LA_CASA).
 *   - "conversacion_visitante": cualquier otra. La ruta pública acepta texto
 *     libre en el contexto que va tal cual al prompt, y el resumen lo puede
 *     traer: la fábrica nunca usa el texto de un visitante.
 *   - "conversacion": el tipo viejo. Todas las filas que lo tienen salieron
 *     de la ruta pública (ningún componente de la página llama a conversar),
 *     así que cuenta como de visitante. Ya no se escribe.
 */
export const TIPOS_RECUERDO = ["charla", "conversacion", "conversacion_casa", "conversacion_visitante", "consejo", "noticia", "trabajo", "diario"] as const
export type TipoRecuerdo = (typeof TIPOS_RECUERDO)[number]

/**
 * Los tipos que puede usar la fábrica de videos: los escribe la casa sola o
 * Kev. Los demás traen (o pueden traer) texto de un visitante. Cada tipo de
 * TIPOS_RECUERDO está en una de las dos listas (lib/fabrica/ideas.test.ts lo
 * exige): un tipo nuevo no se cuela sin que alguien decida de qué lado va.
 */
export const TIPOS_DE_LA_CASA = ["conversacion_casa", "trabajo", "diario"] as const satisfies readonly TipoRecuerdo[]
export const TIPOS_DE_VISITANTE = ["charla", "conversacion", "conversacion_visitante", "noticia", "consejo"] as const satisfies readonly TipoRecuerdo[]

/** Lo que mira tipoDeConversacion de un pedido: el tema y el texto libre del contexto. */
export interface OrigenConversacion {
  tema?: string | null
  contexto?: { hora?: string | null; actividad?: string | null; recuerdos?: unknown } | null
}

const conTexto = (s: string | null | undefined) => !!s?.trim()
/** ¿Trae recuerdos escritos por quien pide? (lista o por residente; vacíos no cuentan). */
function traeRecuerdos(r: unknown): boolean {
  if (Array.isArray(r)) return r.some((x) => typeof x === "string" && x.trim())
  if (r && typeof r === "object") return Object.values(r).some((v) => Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim()))
  return false
}

/**
 * El tipo del recuerdo de una conversación entre residentes. De la casa solo
 * si la pidió Kev y no trae ningún texto libre; si no, de visitante.
 */
export function tipoDeConversacion(p: OrigenConversacion, deKev: boolean): TipoRecuerdo {
  const c = p.contexto ?? {}
  const textoLibre = conTexto(p.tema) || conTexto(c.actividad) || conTexto(c.hora) || traeRecuerdos(c.recuerdos)
  return deKev && !textoLibre ? "conversacion_casa" : "conversacion_visitante"
}
/** El mismo tope que el check de la tabla. */
export const MAX_RECUERDO = 400

const IDS = new Set(PERSONAJES.map((p) => p.id))
export const esResidente = (id: unknown): id is string => typeof id === "string" && IDS.has(id)

export type NuevoRecuerdo = {
  personajeId: string
  tipo: TipoRecuerdo
  texto: string
  /** 1 (de paso) a 10 (le cambió el día). */
  importancia?: number
  /** Los otros residentes que estaban. */
  con?: string[]
  /** Con id, el recuerdo se reescribe en vez de sumarse (una charla larga deja uno solo). */
  id?: string
}

export type Recuerdo = {
  id: string
  personajeId: string
  tipo: TipoRecuerdo
  texto: string
  importancia: number
  con: string[]
  creado: string
}

/** Lo que opina de cada uno: id → { valor de -100 a 100, frase }. */
export type Opiniones = Record<string, { valor: number; frase: string }>

export type Conciencia = {
  personajeId: string
  /** El día de Bolivia de la reflexión, "2026-10-28". */
  dia: string
  animo: string
  meta: string
  pensamiento: string
  diario: string
  opiniones: Opiniones
  actualizado: string
}

const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

/** Corta en el último espacio antes del máximo, para no dejar media palabra. */
export function recortar(s: string, max: number): string {
  if (s.length <= max) return s
  const corte = s.lastIndexOf(" ", max - 1)
  return `${s.slice(0, corte > max * 0.6 ? corte : max - 1).trim()}…`
}

/** Deja como mucho `n` palabras. */
export function recortarPalabras(s: string, n: number): string {
  const palabras = s.trim().split(/\s+/)
  return palabras.length <= n ? s.trim() : `${palabras.slice(0, n).join(" ").replace(/[.,;:]+$/, "")}…`
}

// ── Sin datos personales ──────────────────────────────────────
//
// El modelo tiene la orden de no escribir nada que identifique al visitante.
// Una orden en el prompt es una probabilidad; esto es una comparación de
// cadenas. Lo que se guarda pasa siempre por aquí antes de llegar a la base,
// porque la memoria la leen todos los visitantes.

const PRIVADO = "[dato privado]"
const RE_CORREO = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu
const RE_ENLACE = /(?<![\p{L}\p{N}])(?:https?:\/\/|www\.)\S+/giu
// Un dominio sin "http": "minegocio.com", "algo.com.bo/ruta". Solo con las
// terminaciones comunes, para no tocar un "etc.Y" pegado por error.
const TLD = "com|net|org|info|biz|io|ai|app|dev|me|co|tv|gg|ly|xyz|site|online|store|shop|link|live|world|news|blog|edu|gov|bo|ar|mx|cl|pe|ec|uy|py|ve|es|us|uk|br"
const RE_DOMINIO = new RegExp(`(?<![\\p{L}\\p{N}@.])(?:[\\p{L}\\p{N}-]+\\.)+(?:${TLD})(?:\\/\\S*)?(?![\\p{L}\\p{N}])`, "giu")
// Usuarios de redes ("@alguien"): identifican igual que un nombre.
const RE_USUARIO = /(?<![\p{L}\p{N}])@[\p{L}\p{N}._]{2,}/gu
// Candidatos a teléfono: 7 o más cifras con espacios, guiones, puntos o
// paréntesis entre medio. Después se descartan los que son otra cosa.
const RE_NUMERO = /(?<![\p{L}\p{N}$])\+?\d[\d\s().-]{5,}\d(?![\p{L}\p{N}])/gu
/** "1.000.000.000" es un monto con el punto de miles de Bolivia, no un teléfono. */
const RE_MILES = /^\d{1,3}(?:\.\d{3})+$/
/** "1776-1785" es un rango de años. */
const RE_AÑOS = /^\d{4}\s*[-–]\s*\d{4}$/

function esTelefono(m: string): boolean {
  const cifras = m.replace(/\D/g, "").length
  if (cifras < 7 || cifras > 15) return false
  const t = m.trim()
  return !RE_MILES.test(t) && !RE_AÑOS.test(t)
}

/** Las palabras que nunca se borran como si fueran el nombre del visitante: los residentes, Kev y la casa. */
const NO_ES_NOMBRE = new Set(
  [
    ...PERSONAJES.flatMap((p) => [p.corto, ...p.nombre.split(/\s+/)]),
    "Kev",
    "Kevin",
    "López",
    "PRIME",
    "Yo",
    "El",
    "La",
    "Los",
    "Las",
    "Un",
    "Una",
    "De",
    "Del",
    "Tu",
    "Su",
  ]
    .filter(Boolean)
    .map((s) => s.toLocaleLowerCase("es")),
)

// "me llamo ana", "mi nombre es Ana Pérez", "soy Ana", "te escribe Ana".
// Tras "me llamo" la primera palabra vale en minúscula (la gente escribe así);
// tras "soy" solo con mayúscula ("soy de Bolivia" no es un nombre).
const PALABRA = "[\\p{L}'’-]+"
const MAYUS = "\\p{Lu}[\\p{L}'’-]*"
const RE_NOMBRE_SEGURO = new RegExp(`(?<!\\p{L})(?:[Mm]e llamo|[Mm]i nombre es|[Mm]e dicen)\\s+(${PALABRA}(?:\\s+${MAYUS}){0,2})`, "gu")
const RE_NOMBRE_PROBABLE = new RegExp(`(?<!\\p{L})(?:[Ss]oy|[Tt]e escribe|[Tt]e habla|[Aa]qu[ií] habla)\\s+(${MAYUS}(?:\\s+${MAYUS}){0,2})`, "gu")

/** Los nombres con los que se presentó el visitante, para borrarlos de lo que se guarda. */
export function nombresDelVisitante(textos: string[]): string[] {
  const nombres = new Set<string>()
  for (const t of textos) {
    for (const re of [RE_NOMBRE_SEGURO, RE_NOMBRE_PROBABLE]) {
      for (const m of t.matchAll(re)) {
        for (const palabra of m[1].split(/\s+/)) {
          if (palabra.length >= 2 && !NO_ES_NOMBRE.has(palabra.toLocaleLowerCase("es"))) nombres.add(palabra)
        }
      }
    }
  }
  return [...nombres]
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Borra correos, enlaces, dominios, usuarios de redes, teléfonos y los nombres dados. */
export function sinDatosPersonales(texto: string, nombres: string[] = []): string {
  let t = texto
    .replace(RE_CORREO, PRIVADO)
    .replace(RE_ENLACE, PRIVADO)
    .replace(RE_DOMINIO, PRIVADO)
    .replace(RE_USUARIO, PRIVADO)
    .replace(RE_NUMERO, (m) => (esTelefono(m) ? PRIVADO : m))
  for (const n of nombres) {
    const re = new RegExp(`(?<!\\p{L})${escapar(n)}(?!\\p{L})`, "giu")
    // Al principio de una oración va con mayúscula.
    t = t.replace(re, (_m, pos: number) => (pos === 0 || /[.!?¡¿]\s*$/.test(t.slice(0, pos)) ? "Alguien" : "alguien"))
  }
  return (
    t
      // Dos marcas seguidas ("[dato privado], [dato privado]") se juntan en una.
      .replace(/(\[dato privado\][\s,;/-]*){2,}/g, `${PRIVADO} `)
      // Un paréntesis que solo tenía datos privados no dice nada: se quita.
      .replace(/\s*\(\s*\[dato privado\]\s*\)/g, "")
      .replace(/\s+([),.;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  )
}

// Las palabras que no pueden cerrar un ánimo cortado ("imparable y con").
const COLGANTES = new Set(["y", "e", "o", "u", "con", "de", "del", "la", "el", "los", "las", "un", "una", "que", "en", "a", "al", "por", "para", "sin", "pero", "muy", "más", "algo", "tan", "bastante"])

/** El ánimo en 2–4 palabras. Si el modelo se pasó, la primera parte (antes de la coma) o las 4 primeras sin dejar un "y con" colgando. */
export function animoCorto(s: string): string {
  const t = s.replace(/[.…!]+$/, "").trim()
  const palabras = t.split(/\s+/).filter(Boolean)
  if (palabras.length <= 4) return t
  const primera = t.split(/[,;:]/)[0].trim()
  if (primera && primera.split(/\s+/).length <= 4) return primera
  const corte = palabras.slice(0, 4)
  while (corte.length > 1 && COLGANTES.has(corte[corte.length - 1].toLocaleLowerCase("es"))) corte.pop()
  return corte.join(" ").replace(/[,;:]+$/, "")
}

// ── Guardar y leer recuerdos ──────────────────────────────────

/** Guarda recuerdos. Devuelve cuántos guardó; si la base falla, 0 y el porqué en el log. */
export async function guardarRecuerdos(rs: NuevoRecuerdo[]): Promise<number> {
  const admin = getAdminClient()
  if (!admin || !rs.length) return 0
  const ahora = new Date().toISOString()
  const filas = []
  const vistos = new Set<string>()
  for (const r of rs) {
    if (!esResidente(r.personajeId) || !(TIPOS_RECUERDO as readonly string[]).includes(r.tipo)) continue
    const texto = recortar((r.texto ?? "").replace(/\s+/g, " ").trim(), MAX_RECUERDO)
    if (!texto) continue
    const id = r.id ?? randomUUID()
    // Dos filas con el mismo id en un mismo upsert hacen fallar a todo el lote.
    if (vistos.has(id)) continue
    vistos.add(id)
    filas.push({
      id,
      creado: ahora,
      personaje_id: r.personajeId,
      tipo: r.tipo,
      texto,
      importancia: limitar(Math.round(Number(r.importancia)), 1, 10) || 5,
      con: [...new Set((r.con ?? []).filter((x) => esResidente(x) && x !== r.personajeId))],
    })
  }
  if (!filas.length) return 0
  try {
    const { error } = await admin.from(TABLA_MEMORIA).upsert(filas, { onConflict: "id" })
    if (error) throw new Error(error.message)
    return filas.length
  } catch (e) {
    console.error(`[casa-blanca] no se guardaron ${filas.length} recuerdos (¿se corrió supabase/correr-todo.sql?):`, (e as Error).message)
    return 0
  }
}

type FilaMemoria = { id: string; creado: string; personaje_id: string; tipo: string; texto: string; importancia: number; con: string[] | null }

function aRecuerdo(f: FilaMemoria): Recuerdo | null {
  if (!f || !esResidente(f.personaje_id) || typeof f.texto !== "string" || !f.texto) return null
  const tipo = (TIPOS_RECUERDO as readonly string[]).includes(f.tipo) ? (f.tipo as TipoRecuerdo) : "charla"
  return {
    id: String(f.id),
    personajeId: f.personaje_id,
    tipo,
    texto: f.texto,
    importancia: limitar(Number(f.importancia) || 5, 1, 10),
    con: Array.isArray(f.con) ? f.con.filter(esResidente) : [],
    creado: String(f.creado),
  }
}

export type CuantosRecuerdos = { recientes: number; importantes: number; dias: number }

/**
 * Lo que recuerda cada uno: sus `recientes` más nuevos y, sin repetirlos, los
 * `importantes` más importantes de los últimos `dias` días. Una sola consulta
 * para todos (la función casa_blanca_recuerdos de la base). Lo más nuevo primero.
 */
export async function recuerdosDe(ids: string[], cuantos: CuantosRecuerdos): Promise<Map<string, Recuerdo[]>> {
  const mapa = new Map<string, Recuerdo[]>()
  const admin = getAdminClient()
  const validos = [...new Set(ids.filter(esResidente))]
  if (!admin || !validos.length) return mapa
  try {
    const { data, error } = await admin.rpc("casa_blanca_recuerdos", {
      p_ids: validos,
      p_recientes: cuantos.recientes,
      p_importantes: cuantos.importantes,
      p_dias: cuantos.dias,
    })
    if (error) throw new Error(error.message)
    for (const f of (Array.isArray(data) ? data : []) as FilaMemoria[]) {
      const r = aRecuerdo(f)
      if (r) (mapa.get(r.personajeId) ?? mapa.set(r.personajeId, []).get(r.personajeId)!).push(r)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado))
  } catch (e) {
    console.error("[casa-blanca] no se pudo leer la memoria, se sigue sin ella:", (e as Error).message)
  }
  return mapa
}

/** Los últimos `n` recuerdos de un residente (para su ficha). null si la base falló. */
export async function ultimosRecuerdos(id: string, n = 10): Promise<Recuerdo[] | null> {
  const admin = getAdminClient()
  if (!admin || !esResidente(id)) return []
  try {
    const { data, error } = await admin
      .from(TABLA_MEMORIA)
      .select(COLUMNAS_MEMORIA)
      .eq("personaje_id", id)
      .order("creado", { ascending: false })
      .limit(n)
    if (error) throw new Error(error.message)
    return ((data ?? []) as FilaMemoria[]).map(aRecuerdo).filter((r): r is Recuerdo => !!r)
  } catch (e) {
    console.error("[casa-blanca] no se pudieron leer los recuerdos de la ficha:", (e as Error).message)
    return null
  }
}

/**
 * Borra un recuerdo (solo Kev, desde la ficha): si algún día se guarda algo
 * que no debía quedar, se quita sin entrar a Supabase.
 */
export async function borrarRecuerdo(id: string): Promise<{ ok: true; borrados: number } | { ok: false; error: string }> {
  const admin = getAdminClient()
  if (!admin) return { ok: false, error: "Falta la conexión a la base (SUPABASE_SERVICE_ROLE_KEY)." }
  try {
    const { data, error } = await admin.from(TABLA_MEMORIA).delete().eq("id", id).select("id")
    if (error) throw new Error(error.message)
    return { ok: true, borrados: (data ?? []).length }
  } catch (e) {
    console.error("[casa-blanca] no se pudo borrar el recuerdo:", (e as Error).message)
    return { ok: false, error: "No se pudo borrar el recuerdo. Inténtalo de nuevo." }
  }
}

// ── La conciencia ─────────────────────────────────────────────

type FilaConciencia = {
  personaje_id: string
  dia: string
  animo: string | null
  meta: string | null
  pensamiento: string | null
  diario: string | null
  opiniones: unknown
  actualizado: string
}

/** Lo que venga en el jsonb, tolerante: solo ids de residentes con un número y una frase. */
export function aOpiniones(x: unknown): Opiniones {
  const r: Opiniones = {}
  if (!x || typeof x !== "object" || Array.isArray(x)) return r
  for (const [id, v] of Object.entries(x as Record<string, unknown>)) {
    if (!esResidente(id) || !v || typeof v !== "object") continue
    const valor = Number((v as { valor?: unknown }).valor)
    const frase = (v as { frase?: unknown }).frase
    if (!Number.isFinite(valor)) continue
    r[id] = { valor: limitar(Math.round(valor), -100, 100), frase: typeof frase === "string" ? frase : "" }
  }
  return r
}

/**
 * El estado interior de los residentes (de todos, o de los ids dados). null si
 * la base falló: no es lo mismo que "todavía no reflexionaron" (mapa vacío).
 */
export async function leerConciencias(ids?: string[]): Promise<Map<string, Conciencia> | null> {
  const admin = getAdminClient()
  if (!admin) return new Map()
  try {
    let q = admin.from(TABLA_CONCIENCIA).select(COLUMNAS_CONCIENCIA)
    if (ids) q = q.in("personaje_id", [...new Set(ids.filter(esResidente))])
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const mapa = new Map<string, Conciencia>()
    for (const f of (data ?? []) as FilaConciencia[]) {
      if (!esResidente(f.personaje_id)) continue
      mapa.set(f.personaje_id, {
        personajeId: f.personaje_id,
        dia: String(f.dia),
        animo: f.animo ?? "",
        meta: f.meta ?? "",
        pensamiento: f.pensamiento ?? "",
        diario: f.diario ?? "",
        opiniones: aOpiniones(f.opiniones),
        actualizado: String(f.actualizado),
      })
    }
    return mapa
  } catch (e) {
    console.error("[casa-blanca] no se pudo leer la conciencia:", (e as Error).message)
    return null
  }
}

/** Guarda el estado nuevo de los que reflexionaron. Los demás quedan como estaban. */
export async function guardarConciencias(cs: Conciencia[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getAdminClient()
  if (!admin) return { ok: false, error: "sin base" }
  const filas = cs
    .filter((c) => esResidente(c.personajeId))
    .map((c) => ({
      personaje_id: c.personajeId,
      dia: c.dia,
      animo: c.animo,
      meta: c.meta,
      pensamiento: c.pensamiento,
      diario: c.diario,
      opiniones: c.opiniones,
      actualizado: c.actualizado,
    }))
  if (!filas.length) return { ok: false, error: "nada que guardar" }
  const { error } = await admin.from(TABLA_CONCIENCIA).upsert(filas, { onConflict: "personaje_id" })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * El candado de la reflexión del día (casa_blanca_reclamar_reflexion). Devuelve
 * el día reclamado, o null si hoy ya está hecha, la está haciendo otro o se
 * acabaron los intentos. Lo decide la base en una sola sentencia: dos visitas
 * simultáneas no pueden ganar las dos.
 */
export async function reclamarReflexion(intentos: number, venceMin: number): Promise<string | null> {
  const admin = getAdminClient()
  if (!admin) return null
  try {
    const { data, error } = await admin.rpc("casa_blanca_reclamar_reflexion", { p_intentos: intentos, p_vence_min: venceMin })
    if (error) throw new Error(error.message)
    return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null
  } catch (e) {
    console.error("[casa-blanca] no se pudo reclamar la reflexión del día:", (e as Error).message)
    return null
  }
}

/** Marca la reflexión del día como hecha: hoy ya no se vuelve a pagar. */
export async function terminarReflexion(dia: string): Promise<void> {
  const admin = getAdminClient()
  if (!admin) return
  const { error } = await admin.from(TABLA_REFLEXION).update({ terminado: new Date().toISOString() }).eq("dia", dia)
  if (error) console.error("[casa-blanca] la reflexión se guardó pero no se marcó como hecha:", error.message)
}
