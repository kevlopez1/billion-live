// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL REGISTRO DE VOCES APROBADAS (voces.json)
//
// Una voz por residente, la que Kev eligió entre 3 candidatas
// (scripts/fabrica/disenar-voces.ts --elegir). Vive en el repo, en
// lib/fabrica/voz/voces.json: un voice_id no es secreto, cambia muy poco y
// así queda en el historial quién la aprobó y cuándo.
//
// Reglas por código, no por costumbre:
// - Solo quien puede hablar (verde o amarillo) tiene voz. Una entrada de un
//   vivo, de alguien fuera o de un id desconocido se descarta al leer y se
//   dice por qué.
// - Sin `aprobadoPor` no hay voz: elegir es de Kev.
// - Si la descripción del arquetipo cambió después de aprobarla, la voz
//   sigue (es la que Kev oyó) pero se avisa: conviene volver a elegir.
// ──────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { arquetipoDe, hablaEnLaFabrica, puedeHablarAlgunaVez } from "./arquetipos"
import { hashDe } from "./falso"

export const RUTA_REGISTRO = "lib/fabrica/voz/voces.json"

export interface EntradaVoz {
  /** El voice_id de la biblioteca de ElevenLabs. */
  voiceId: string
  proveedor: "elevenlabs"
  /** La candidata que eligió Kev (1, 2 o 3). */
  candidata: number
  generatedVoiceId: string
  /** El nombre con el que quedó en la biblioteca (sin el nombre de nadie). */
  nombreEnElServicio: string
  modeloDiseno: string
  /** Huella de la descripción con la que se diseñó. */
  huella: string
  aprobadoPor: string
  /** ISO. */
  aprobadoEn: string
}

export interface RegistroVoces {
  version: 1
  voces: Record<string, EntradaVoz>
}

export const registroVacio = (): RegistroVoces => ({ version: 1, voces: {} })

/** Huella corta de una descripción: si cambia, la voz aprobada ya no es la de la descripción. */
export const huellaDescripcion = (descripcion: string) => createHash("sha256").update(descripcion.trim()).digest("hex").slice(0, 16)

/**
 * El nombre de la voz en la biblioteca: sin el nombre del residente (es una
 * persona real en la mayoría de los casos) y estable, para buscarla antes de
 * crearla otra vez.
 */
export const nombreEnElServicio = (id: string, candidata: number) => `LCBP-${hashDe(id).toString(36).slice(0, 6)}-c${candidata}`

const esTexto = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0

/** Lee y limpia un registro. Lo que no vale se descarta y queda en `errores`, con el porqué. */
export function validarRegistro(x: unknown): { registro: RegistroVoces; errores: string[] } {
  const errores: string[] = []
  const registro = registroVacio()
  const voces = (x as { voces?: unknown })?.voces
  if (!x || typeof x !== "object" || (x as { version?: unknown }).version !== 1 || !voces || typeof voces !== "object") {
    return { registro, errores: ["el registro de voces no tiene la forma { version: 1, voces: {…} }"] }
  }
  for (const [id, e] of Object.entries(voces as Record<string, unknown>)) {
    if (!arquetipoDe(id)) {
      errores.push(`${id}: no es un residente con arquetipo; se descarta`)
      continue
    }
    if (!puedeHablarAlgunaVez(id)) {
      errores.push(`${id}: no habla en la fábrica (vivo o fuera); su voz se descarta`)
      continue
    }
    const v = e as Partial<EntradaVoz>
    const faltan: string[] = (["voiceId", "generatedVoiceId", "nombreEnElServicio", "modeloDiseno", "huella", "aprobadoPor", "aprobadoEn"] as const).filter((k) => !esTexto(v[k]))
    if (v.proveedor !== "elevenlabs") faltan.push("proveedor")
    if (!Number.isInteger(v.candidata) || (v.candidata as number) < 1) faltan.push("candidata")
    if (faltan.length) {
      errores.push(`${id}: a la entrada le falta ${faltan.join(", ")}; se descarta`)
      continue
    }
    registro.voces[id] = v as EntradaVoz
  }
  return { registro, errores }
}

export type VozResuelta = { ok: true; voiceId: string; aviso?: string } | { ok: false; porque: string }

/** La voz aprobada de un residente para un video que sale ese día. */
export function vozDe(reg: RegistroVoces, id: string, dia: string | Date): VozResuelta {
  if (!hablaEnLaFabrica(id, dia)) return { ok: false, porque: `${id} no habla en un video que sale ese día (semáforo)` }
  const e = Object.prototype.hasOwnProperty.call(reg.voces, id) ? reg.voces[id] : undefined
  if (!e) return { ok: false, porque: `${id} no tiene voz aprobada en ${RUTA_REGISTRO} (correr scripts/fabrica/disenar-voces.ts y elegir)` }
  const arq = arquetipoDe(id)
  const aviso = arq && huellaDescripcion(arq.descripcion) !== e.huella ? `${id}: la descripción del arquetipo cambió después de aprobar la voz; conviene volver a elegir` : undefined
  return { ok: true, voiceId: e.voiceId, ...(aviso ? { aviso } : {}) }
}

/** Anota la voz que eligió Kev. Devuelve el registro nuevo, o los motivos por los que no se puede. */
export function aprobar(reg: RegistroVoces, id: string, e: EntradaVoz): { ok: true; registro: RegistroVoces } | { ok: false; errores: string[] } {
  const prueba = validarRegistro({ version: 1, voces: { [id]: e } })
  if (prueba.errores.length) return { ok: false, errores: prueba.errores }
  return { ok: true, registro: { version: 1, voces: { ...reg.voces, [id]: e } } }
}

/** Lee el archivo. Sin archivo = registro vacío (y lo dice); un JSON roto también se dice, nunca se toma como vacío en silencio. */
export function leerRegistro(ruta: string): { registro: RegistroVoces; errores: string[] } {
  let crudo: string
  try {
    crudo = readFileSync(ruta, "utf8")
  } catch (e) {
    return { registro: registroVacio(), errores: [`no se pudo leer ${ruta}: ${e instanceof Error ? e.message : e}`] }
  }
  try {
    return validarRegistro(JSON.parse(crudo))
  } catch (e) {
    return { registro: registroVacio(), errores: [`${ruta} no es JSON válido: ${e instanceof Error ? e.message : e}`] }
  }
}

/** Escribe el registro ordenado por id (diffs chicos en el historial). */
export function guardarRegistro(ruta: string, reg: RegistroVoces): void {
  const voces = Object.fromEntries(Object.keys(reg.voces).sort().map((k) => [k, reg.voces[k]]))
  writeFileSync(ruta, `${JSON.stringify({ version: 1, voces }, null, 2)}\n`)
}
