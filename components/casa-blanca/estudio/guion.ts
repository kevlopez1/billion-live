// ──────────────────────────────────────────────────────────────
// EL GUION DE UN VIDEO DE LA CASA BLANCA PROJECT
//
// Un episodio es una lista de planos. El estudio (/casa-blanca/estudio) lo
// filma con la misma escena y la misma simulación de la web, cuadro por
// cuadro, en horizontal: 16:9 (1920×1080) o 4:3 (1440×1080).
//
// Este archivo es el contrato entre el calendario de contenido (qué se
// cuenta) y el estudio (cómo se filma): todo id que aparece aquí tiene que
// existir en la escena. guionValido() lo comprueba antes de filmar.
// ──────────────────────────────────────────────────────────────

/** Horizontal, como una cámara grabando. 16:9 = 1920×1080; 4:3 = 1440×1080. */
export type Formato = "16:9" | "4:3"

/**
 * Cómo se ve el cuadro:
 * - "cine": limpio, con títulos sobrios (trailer, presentaciones).
 * - "camara": como un camarógrafo dentro de la casa: REC, código de tiempo,
 *   nombre de la cámara ("CAM 03 · SALA DE GUERRA") y un pulso leve de mano.
 */
export type Visor = "cine" | "camara"

/** La cámara de un plano. Los ids salen de la escena, de lugares.ts y de datos/personajes.ts. */
export type CamaraPlano =
  /** Una de las tomas del motor: escena.tomas() (portico-norte, dron, bajada, departamento, seguir, sala-guerra, ciudad, maqueta). */
  | { tipo: "toma"; toma: string; personaje?: string }
  /** Detrás de un residente, a su ritmo. */
  | { tipo: "seguir"; personaje: string }
  /** Un lugar entero encuadrado (cualquier id de LUGARES, en cualquier nivel). */
  | { tipo: "lugar"; lugar: string }

export interface LineaDialogo {
  /** Id del residente que habla. */
  quien: string
  texto: string
  /** true = cita real y verificable de esa persona (se marca como cita en pantalla). */
  cita?: boolean
}

export interface Plano {
  /** Segundos que dura el plano en el video. */
  dur: number
  camara: CamaraPlano
  /** Hora del mundo al empezar el plano, "17:30". Sin ella, sigue la del plano anterior. */
  hora?: string
  /** Texto grande en pantalla: el gancho o el título del bloque. Corto. */
  titulo?: string
  /** Texto chico (lugar, dato, quién es quién). */
  rotulo?: string
  /** Lo que dicen. Se ve como burbuja sobre el personaje y como subtítulo. */
  dialogo?: LineaDialogo[]
  /** Antes del plano, estos residentes ya están en el lugar del plano (para que salgan en cuadro). */
  reunir?: string[]
  /** Tilt-shift de maqueta. */
  maqueta?: boolean
  /** El visor de este plano; sin él, el del episodio. */
  visor?: Visor
}

export interface Episodio {
  /** "ep01-trailer": también es el nombre del archivo. */
  id: string
  titulo: string
  formato: Formato
  visor: Visor
  /** 30 por defecto. */
  fps?: number
  planos: Plano[]
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/** "17:30" → 17.5. */
export function horaANumero(h: string): number {
  const [hh, mm] = h.split(":").map(Number)
  return hh + mm / 60
}

export function duracionTotal(ep: Episodio): number {
  return ep.planos.reduce((s, p) => s + p.dur, 0)
}

/**
 * Lo que está mal en un guion, en palabras. Vacío = se puede filmar.
 * `ids` trae lo que existe de verdad: residentes, lugares y tomas.
 */
export function guionValido(ep: Episodio, ids: { personajes: Set<string>; lugares: Set<string>; tomas: Set<string> }): string[] {
  const errores: string[] = []
  if (!/^[a-z0-9-]+$/.test(ep.id)) errores.push(`id "${ep.id}": solo minúsculas, números y guiones`)
  if (ep.formato !== "16:9" && ep.formato !== "4:3") errores.push(`formato "${ep.formato}": va 16:9 o 4:3`)
  if (ep.visor !== "cine" && ep.visor !== "camara") errores.push(`visor "${ep.visor}": va cine o camara`)
  if (!ep.planos.length) errores.push("no tiene planos")
  ep.planos.forEach((p, i) => {
    const n = `plano ${i + 1}`
    if (!(p.dur > 0 && p.dur <= 60)) errores.push(`${n}: dur ${p.dur} (va de 0 a 60 s)`)
    if (p.hora !== undefined && !HORA.test(p.hora)) errores.push(`${n}: hora "${p.hora}" (va "HH:MM")`)
    if (p.visor !== undefined && p.visor !== "cine" && p.visor !== "camara") errores.push(`${n}: visor "${p.visor}": va cine o camara`)
    const c = p.camara
    if (c.tipo === "toma") {
      if (!ids.tomas.has(c.toma)) errores.push(`${n}: la toma "${c.toma}" no existe`)
      if (c.personaje !== undefined && !ids.personajes.has(c.personaje)) errores.push(`${n}: el residente "${c.personaje}" no existe`)
    } else if (c.tipo === "seguir") {
      if (!ids.personajes.has(c.personaje)) errores.push(`${n}: el residente "${c.personaje}" no existe`)
    } else if (c.tipo === "lugar") {
      if (!ids.lugares.has(c.lugar)) errores.push(`${n}: el lugar "${c.lugar}" no existe`)
    } else errores.push(`${n}: cámara desconocida`)
    for (const id of p.reunir ?? []) if (!ids.personajes.has(id)) errores.push(`${n}: reunir "${id}" no existe`)
    for (const l of p.dialogo ?? []) {
      if (!ids.personajes.has(l.quien)) errores.push(`${n}: habla "${l.quien}", que no existe`)
      if (!l.texto.trim()) errores.push(`${n}: una línea de diálogo vacía`)
    }
  })
  return errores
}

// ── El calendario ─────────────────────────────────────────────

export type Red = "youtube" | "facebook" | "instagram" | "tiktok" | "x"

/** Un video en el calendario: qué día sale, dónde y con qué texto. */
export interface EntradaCalendario {
  /** "2026-10-30". */
  fecha: string
  /** Hora de Bolivia, "19:00". */
  hora: string
  redes: Red[]
  /** El pilar de contenido al que pertenece. */
  pilar: string
  /** El texto que acompaña al video (descripción o caption). */
  texto: string
  episodio: Episodio
}
