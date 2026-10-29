// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · DISEÑAR LAS VOCES Y ANOTAR LA QUE ELIGE KEV
//
// La lógica de scripts/fabrica/disenar-voces.ts, con sus puertos por
// parámetro (diseñador, archivos, reloj, log) para probarla sin red.
//
// 1. disenarVoces(): 3 candidatas por residente que habla, desde su
//    arquetipo (arquetipos.ts). Cada residente terminado se anota EN EL
//    MOMENTO en candidatas.json: si el proceso se cae, la próxima corrida no
//    vuelve a pagar lo que ya tiene (el éxito deja rastro donde se mira).
// 2. elegirVoz(): Kev escucha y elige una. Se guarda en la biblioteca de
//    ElevenLabs (buscándola antes por nombre: crearla no es idempotente) y
//    se anota en voces.json con quién la aprobó y cuándo.
// ──────────────────────────────────────────────────────────────

import type { Log } from "../tipos"
import { esFallo } from "../redes/http"
import type { Fallo } from "../tipos"
import { arquetipoDe, conVoz, descripcionSegura, muestraSegura, puedeHablarAlgunaVez } from "./arquetipos"
import { aprobar, huellaDescripcion, nombreEnElServicio, type EntradaVoz, type RegistroVoces } from "./registro"
import type { Disenador } from "./tipos"

export const CANDIDATAS_POR_RESIDENTE = 3
/** Voice Design devuelve varias por pedido; si vienen menos de 3, se pide una vez más. */
const MAX_PEDIDOS_POR_RESIDENTE = 2

export interface CandidataGuardada {
  n: number
  generatedVoiceId: string
  /** El archivo de audio, relativo a la carpeta de salida. */
  archivo: string
  duracionS: number | null
}

export interface DisenoGuardado {
  proveedor: Disenador["nombre"]
  modeloDiseno: string
  /** Huella de la descripción con la que se diseñaron. */
  huella: string
  creadoEn: string
  candidatas: CandidataGuardada[]
}

/** Lo que guarda candidatas.json: por residente. */
export type Candidatas = Record<string, DisenoGuardado>

export interface PlanDeDiseno {
  disenar: string[]
  saltar: { id: string; porque: string }[]
}

/** A quién se le diseñan voces en esta corrida, y por qué se salta a los demás. Puro. */
export function planDeDiseno(o: { solo?: string[]; previas: Candidatas; registro: RegistroVoces; rehacer: boolean; proveedor: Disenador["nombre"] }): PlanDeDiseno {
  const saltar: PlanDeDiseno["saltar"] = []
  const disenar: string[] = []
  const pedidos = o.solo?.length ? o.solo : conVoz()
  for (const id of pedidos) {
    const arq = arquetipoDe(id)
    if (!arq) {
      saltar.push({ id, porque: "no es un residente con arquetipo" })
      continue
    }
    if (!puedeHablarAlgunaVez(id)) {
      saltar.push({ id, porque: "no habla en la fábrica (vivo o fuera, semáforo): no se le diseña voz" })
      continue
    }
    const errores = [...descripcionSegura(id, arq.descripcion), ...muestraSegura(id, arq.muestra)]
    if (errores.length) {
      saltar.push({ id, porque: `la descripción o la muestra no pasan la guarda: ${errores.join("; ")}` })
      continue
    }
    if (!o.rehacer && o.registro.voces[id]) {
      saltar.push({ id, porque: "ya tiene voz aprobada (con --rehacer se piden otras)" })
      continue
    }
    const previa = o.previas[id]
    if (!o.rehacer && previa && previa.proveedor === o.proveedor && previa.huella === huellaDescripcion(arq.descripcion) && previa.candidatas.length >= CANDIDATAS_POR_RESIDENTE) {
      saltar.push({ id, porque: "ya tiene 3 candidatas en candidatas.json (con --rehacer se piden otras)" })
      continue
    }
    disenar.push(id)
  }
  return { disenar, saltar }
}

export interface PuertosDiseno {
  disenador: Disenador
  /** Escribe un audio en la carpeta de salida y devuelve su nombre relativo. */
  escribir: (nombre: string, datos: Uint8Array) => string
  /** Guarda candidatas.json entero. */
  guardarCandidatas: (c: Candidatas) => void
  ahora: () => Date
  log: Log
}

export interface ResultadoDiseno {
  hechas: string[]
  fallidas: { id: string; como: string }[]
  candidatas: Candidatas
}

export async function disenarVoces(ids: string[], previas: Candidatas, p: PuertosDiseno): Promise<ResultadoDiseno> {
  const candidatas: Candidatas = { ...previas }
  const hechas: string[] = []
  const fallidas: ResultadoDiseno["fallidas"] = []
  if (!ids.length) return { hechas, fallidas, candidatas }

  // El saldo antes de gastar: el texto de cada muestra, por los pedidos que haga falta.
  const necesarios = ids.reduce((s, id) => s + (arquetipoDe(id)?.muestra.length ?? 0), 0)
  const c = await p.disenador.creditos()
  if (esFallo(c)) p.log(`[fabrica/voz] no se pudo leer el saldo (${c.como}); se sigue y frena el tope de la clave`)
  else if (c.restantes < necesarios) {
    const como = `saldo insuficiente: quedan ${c.restantes} créditos y las muestras suman ${necesarios} caracteres`
    p.log(`[fabrica/voz] ${como}`)
    return { hechas, fallidas: ids.map((id) => ({ id, como })), candidatas }
  }

  for (const [k, id] of ids.entries()) {
    const arq = arquetipoDe(id)
    // La guarda otra vez justo antes de mandar: lo que va a un tercero se revisa en el momento.
    const errores = arq ? [...descripcionSegura(id, arq.descripcion), ...muestraSegura(id, arq.muestra)] : [`${id}: sin arquetipo`]
    if (!arq || errores.length || !puedeHablarAlgunaVez(id)) {
      fallidas.push({ id, como: errores.join("; ") || `${id} no habla en la fábrica` })
      continue
    }
    const juntas: { generatedVoiceId: string; audio: Uint8Array; formato: string; duracionS: number | null }[] = []
    let fallo: Fallo | null = null
    for (let pedido = 1; pedido <= MAX_PEDIDOS_POR_RESIDENTE && juntas.length < CANDIDATAS_POR_RESIDENTE; pedido++) {
      const r = await p.disenador.disenar(arq.descripcion, arq.muestra)
      if (esFallo(r)) {
        fallo = r
        break
      }
      for (const x of r) if (!juntas.some((j) => j.generatedVoiceId === x.generatedVoiceId)) juntas.push(x)
    }
    if (fallo && !juntas.length) {
      p.log(`[fabrica/voz] ${id}: el diseño falló (${fallo.clase}): ${fallo.como}`)
      fallidas.push({ id, como: fallo.como })
      if (fallo.clase === "no_hoy") {
        // Sin saldo no tiene sentido seguir: los demás fallarían igual y cada intento cuenta.
        for (const resto of ids.slice(k + 1)) fallidas.push({ id: resto, como: `no se intentó: ${fallo.como}` })
        break
      }
      continue
    }
    const elegidas = juntas.slice(0, CANDIDATAS_POR_RESIDENTE).map((x, i) => ({
      n: i + 1,
      generatedVoiceId: x.generatedVoiceId,
      archivo: p.escribir(`${id}-${i + 1}.${x.formato}`, x.audio),
      duracionS: x.duracionS,
    }))
    candidatas[id] = {
      proveedor: p.disenador.nombre,
      modeloDiseno: p.disenador.modeloDiseno,
      huella: huellaDescripcion(arq.descripcion),
      creadoEn: p.ahora().toISOString(),
      candidatas: elegidas,
    }
    p.guardarCandidatas(candidatas)
    const faltan = CANDIDATAS_POR_RESIDENTE - elegidas.length
    p.log(`[fabrica/voz] ${id}: ${elegidas.length} candidata(s) guardada(s)${faltan > 0 ? ` (faltan ${faltan}: ${fallo ? fallo.como : "el servicio devolvió menos"})` : ""}`)
    hechas.push(id)
  }
  return { hechas, fallidas, candidatas }
}

export interface PedidoDeEleccion {
  id: string
  n: number
  aprobadoPor: string
}

/** Anota la candidata `n` de `id` como su voz: la guarda en la biblioteca (si no estaba) y devuelve el registro nuevo. */
export async function elegirVoz(
  e: PedidoDeEleccion,
  candidatas: Candidatas,
  registro: RegistroVoces,
  p: Pick<PuertosDiseno, "disenador" | "ahora" | "log">,
): Promise<{ ok: true; registro: RegistroVoces; entrada: EntradaVoz; reutilizada: boolean } | Fallo> {
  const fatal = (como: string): Fallo => ({ ok: false, clase: "fatal", como: `elegir ${e.id}: ${como}` })
  const arq = arquetipoDe(e.id)
  if (!arq) return fatal("no es un residente con arquetipo")
  if (!puedeHablarAlgunaVez(e.id)) return fatal("no habla en la fábrica (vivo o fuera): no lleva voz")
  if (!e.aprobadoPor.trim()) return fatal("falta quién la aprobó (--aprobado-por): elegir la voz es de Kev")
  const d = candidatas[e.id]
  if (!d) return fatal("no tiene candidatas en candidatas.json: primero diseñarlas")
  const c = d.candidatas.find((x) => x.n === e.n)
  if (!c) return fatal(`no existe la candidata ${e.n} (hay ${d.candidatas.map((x) => x.n).join(", ")})`)
  if (d.huella !== huellaDescripcion(arq.descripcion)) return fatal("la descripción del arquetipo cambió después de diseñar estas candidatas: diseñarlas de nuevo (--rehacer)")
  if (d.proveedor !== p.disenador.nombre) return fatal(`las candidatas son de «${d.proveedor}» y el diseñador es «${p.disenador.nombre}»: no se puede guardar una voz de prueba como real`)

  const nombre = nombreEnElServicio(e.id, e.n)
  // Antes de crear, mirar si ya está: un corte en la corrida anterior pudo haberla creado.
  const b = await p.disenador.buscarVoz(nombre)
  if (esFallo(b)) return { ...b, como: `elegir ${e.id}: no se pudo buscar ${nombre} en la biblioteca antes de crearla: ${b.como}` }
  let voiceId = b.voiceId
  const reutilizada = !!voiceId
  if (voiceId) p.log(`[fabrica/voz] ${e.id}: ${nombre} ya estaba en la biblioteca (${voiceId}): se reutiliza`)
  else {
    const r = await p.disenador.crearVoz(c.generatedVoiceId, nombre, arq.descripcion)
    if (esFallo(r)) {
      const extra = r.clase === "ambiguo" ? " (puede haberse creado: la próxima corrida la busca por nombre antes de repetir)" : ""
      return { ...r, como: `elegir ${e.id}: ${r.como}${extra}` }
    }
    voiceId = r.voiceId
  }
  if (p.disenador.nombre !== "elevenlabs") {
    return fatal(`con el diseñador «${p.disenador.nombre}» no se anota nada en voces.json (voz ${voiceId} de prueba)`)
  }
  const entrada: EntradaVoz = {
    voiceId,
    proveedor: "elevenlabs",
    candidata: e.n,
    generatedVoiceId: c.generatedVoiceId,
    nombreEnElServicio: nombre,
    modeloDiseno: d.modeloDiseno,
    huella: d.huella,
    aprobadoPor: e.aprobadoPor.trim(),
    aprobadoEn: p.ahora().toISOString(),
  }
  const a = aprobar(registro, e.id, entrada)
  if (!a.ok) return fatal(a.errores.join("; "))
  return { ok: true, registro: a.registro, entrada, reutilizada }
}
