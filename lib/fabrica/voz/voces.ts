// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · VOCES DE UN EPISODIO (paso c de la cadena)
//
// Un Episodio entra; sale el audio de su diálogo con la duración de cada
// línea, para que el plano dure lo que su audio y de ahí salga el .srt.
//
//   const { proveedor } = proveedorDesdeEnv(process.env, { fetch, log })
//   const r = await voces(episodio, { proveedor, registro, dia, log })
//
// - Las líneas van en orden, partidas en pedidos de hasta 2.000 caracteres
//   (tramos). Cada línea dice en qué tramo quedó y cuánto dura.
// - Solo habla quien puede hablar ese día (verde o amarillo): un vivo con
//   una línea es un error del guion y aquí se frena otra vez.
// - Con ElevenLabs, cada residente necesita su voz aprobada en voces.json;
//   con la voz falsa, quien no la tenga usa una de prueba.
// - Antes de gastar se mira el saldo; si no alcanza, `no_hoy` con el cómo.
//   Si el saldo no se puede leer, se dice y se sigue: el freno queda en el
//   tope de la clave y en el de la tanda.
// - La tanda reserva el gasto en la base ANTES de llamar a voces()
//   (`fabrica_sumar_gasto(costoUsdEstimado(...))`).
// ──────────────────────────────────────────────────────────────

import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { textoFinal } from "@/components/casa-blanca/estudio/linea"
import type { Entorno, Fallo, Log } from "../tipos"
import { esFallo } from "../redes/http"
import { hablaEnLaFabrica } from "./arquetipos"
import { crearElevenLabs, MAX_CARACTERES_DIALOGO, TOPE_CARACTERES_POR_DEFECTO } from "./elevenlabs"
import { crearVozFalsa } from "./falso"
import { vozDe, type RegistroVoces } from "./registro"
import type { Disenador, PedidoVoz, ProveedorVoz } from "./tipos"

/** API por uso: $0,08 por cada 1.000 caracteres [V2] (SIN VERIFICAR; con un plan pago sale de sus créditos). */
export const USD_POR_MIL_CARACTERES = 0.08

// ── Proveedor según el entorno ────────────────────────────────

export interface ProveedorElegido {
  proveedor: (ProveedorVoz & Disenador) | null
  /** Las variables que faltan para el proveedor pedido. */
  falta: string[]
  como: string
}

/**
 * FABRICA_VOZ = "falso" (o vacía): voz falsa, audio de prueba que no se publica.
 * FABRICA_VOZ = "elevenlabs": exige FABRICA_ELEVENLABS_KEY.
 * Opcionales: FABRICA_ELEVENLABS_MODELO (eleven_v3), FABRICA_ELEVENLABS_MODELO_DISENO
 * (eleven_ttv_v3), FABRICA_VOZ_TOPE_CARACTERES (15000 por tanda).
 * Un valor que no se conoce no cae en la falsa: un audio de prueba publicado
 * por un error de tipeo es peor que una tanda parada.
 */
export function proveedorDesdeEnv(env: Entorno, p: { fetch: typeof fetch; log: Log; dormir?: (ms: number) => Promise<void> }): ProveedorElegido {
  const pedido = (env.FABRICA_VOZ ?? "").trim().toLowerCase()
  if (!pedido || pedido === "falso") {
    const como = `voz falsa (FABRICA_VOZ ${pedido ? "= falso" : "sin valor"}): audio de prueba, un video con esta voz no se publica`
    p.log(`[fabrica/voz] ${como}`)
    return { proveedor: crearVozFalsa(), falta: [], como }
  }
  if (pedido !== "elevenlabs") {
    const como = `FABRICA_VOZ = "${env.FABRICA_VOZ}" no se conoce (elevenlabs | falso): sin voz`
    p.log(`[fabrica/voz] ${como}`)
    return { proveedor: null, falta: ["FABRICA_VOZ"], como }
  }
  const clave = (env.FABRICA_ELEVENLABS_KEY ?? "").trim()
  if (!clave) {
    const como = "FABRICA_VOZ = elevenlabs pero falta FABRICA_ELEVENLABS_KEY: sin voz"
    p.log(`[fabrica/voz] ${como}`)
    return { proveedor: null, falta: ["FABRICA_ELEVENLABS_KEY"], como }
  }
  const crudo = (env.FABRICA_VOZ_TOPE_CARACTERES ?? "").trim()
  let tope = TOPE_CARACTERES_POR_DEFECTO
  if (crudo) {
    const n = Number(crudo)
    if (Number.isInteger(n) && n > 0) tope = n
    else p.log(`[fabrica/voz] FABRICA_VOZ_TOPE_CARACTERES = "${crudo}" no es un entero positivo: se usa ${TOPE_CARACTERES_POR_DEFECTO}`)
  }
  const proveedor = crearElevenLabs({
    fetch: p.fetch,
    clave,
    log: p.log,
    dormir: p.dormir,
    modelo: env.FABRICA_ELEVENLABS_MODELO?.trim() || undefined,
    modeloDiseno: env.FABRICA_ELEVENLABS_MODELO_DISENO?.trim() || undefined,
    topeCaracteres: tope,
  })
  const como = `ElevenLabs (${proveedor.modelo}, diseño ${proveedor.modeloDiseno}), tope de ${tope} caracteres por tanda`
  p.log(`[fabrica/voz] ${como}`)
  return { proveedor, falta: [], como }
}

// ── Texto ─────────────────────────────────────────────────────

/**
 * El texto como se dice: con los números del reto puestos (textoFinal) y
 * los montos escritos para leerse («$1.234» → «1234 dólares»: en Bolivia el
 * punto separa miles y la voz podría leerlo como decimal).
 */
export function textoParaVoz(texto: string): string {
  return textoFinal(texto)
    .replace(/(?:US)?\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/g, (_, entero: string, dec?: string) => `${entero.replace(/\./g, "")}${dec ? ` coma ${dec}` : ""} dólares`)
    .replace(/[*_#~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export interface LineaVoz {
  /** Posición en todo el episodio (0, 1, 2…). */
  indice: number
  plano: number
  /** Posición dentro del plano. */
  linea: number
  personaje: string
  /** El texto como se dice (textoParaVoz). */
  texto: string
}

/** Las líneas de diálogo del episodio, en orden. Las vacías no se dicen. */
export function lineasDelEpisodio(ep: Episodio): LineaVoz[] {
  const out: LineaVoz[] = []
  ;(ep.planos ?? []).forEach((p, plano) => {
    ;(p.dialogo ?? []).forEach((l, linea) => {
      const texto = textoParaVoz(l.texto ?? "")
      if (texto) out.push({ indice: out.length, plano, linea, personaje: l.quien, texto })
    })
  })
  return out
}

/** Las líneas en pedidos de hasta `max` caracteres, sin cambiar el orden. Una línea más larga que el tope es un error del guion. */
export function partirEnPedidos(lineas: LineaVoz[], max = MAX_CARACTERES_DIALOGO): LineaVoz[][] | string {
  const largas = lineas.filter((l) => l.texto.length > max)
  if (largas.length) return `línea(s) ${largas.map((l) => `${l.indice + 1} (${l.texto.length} caracteres)`).join(", ")} pasan el tope de ${max} por pedido`
  const out: LineaVoz[][] = []
  let actual: LineaVoz[] = []
  let suma = 0
  for (const l of lineas) {
    if (actual.length && suma + l.texto.length > max) {
      out.push(actual)
      actual = []
      suma = 0
    }
    actual.push(l)
    suma += l.texto.length
  }
  if (actual.length) out.push(actual)
  return out
}

// ── Las voces del episodio ────────────────────────────────────

export interface LineaConVoz extends LineaVoz {
  tramo: number
  /** Segundos dentro de su tramo. */
  inicioS: number
  finS: number
  duracionS: number
}

export interface TramoGuardado {
  audio: Uint8Array
  formato: "mp3" | "wav"
  duracionS: number
  como: string
}

export interface ResultadoVoces {
  ok: true
  proveedor: ProveedorVoz["nombre"]
  modelo: string
  /** true = audio de prueba: el video no se publica (vozPublicable). */
  falso: boolean
  tramos: TramoGuardado[]
  lineas: LineaConVoz[]
  /** Segundos de voz de cada plano (suma de sus líneas), en el orden de ep.planos. */
  vozPorPlanoS: number[]
  caracteres: number
  creditos: number
  /** Lo que conviene que Kev sepa sin frenar la tanda (saldo ilegible, voz con descripción vieja). */
  avisos: string[]
}

export interface OpcionesVoces {
  proveedor: ProveedorVoz
  registro: RegistroVoces
  /** Día de salida (Bolivia): decide quién habla. */
  dia: string
  log: Log
}

const fatal = (como: string): Fallo => ({ ok: false, clase: "fatal", como: `voces: ${como}` })

export async function voces(ep: Episodio, o: OpcionesVoces): Promise<ResultadoVoces | Fallo> {
  const { proveedor, log } = o
  const lineas = lineasDelEpisodio(ep)
  const avisos: string[] = []
  const vacio: ResultadoVoces = {
    ok: true,
    proveedor: proveedor.nombre,
    modelo: proveedor.modelo,
    falso: proveedor.falso,
    tramos: [],
    lineas: [],
    vozPorPlanoS: (ep.planos ?? []).map(() => 0),
    caracteres: 0,
    creditos: 0,
    avisos,
  }
  if (!lineas.length) {
    log(`[fabrica/voz] ${ep.id}: sin diálogo, no se pide voz`)
    return vacio
  }

  // 1. Quién habla y con qué voz. Todos los problemas juntos, no el primero.
  const voz = new Map<string, string>()
  const problemas: string[] = []
  for (const id of new Set(lineas.map((l) => l.personaje))) {
    if (!hablaEnLaFabrica(id, o.dia)) {
      problemas.push(`${id} tiene diálogo pero no habla en un video que sale el ${o.dia} (semáforo): la guarda del guion debió frenarlo`)
      continue
    }
    const r = vozDe(o.registro, id, o.dia)
    if (r.ok) {
      voz.set(id, r.voiceId)
      if (r.aviso) avisos.push(r.aviso)
    } else if (proveedor.falso) voz.set(id, `falso:${id}`)
    else problemas.push(r.porque)
  }
  if (problemas.length) return fatal(problemas.join("; "))

  // 2. Pedidos de hasta el tope del proveedor.
  const pedidos = partirEnPedidos(lineas, proveedor.maxCaracteres)
  if (typeof pedidos === "string") return fatal(pedidos)
  const caracteres = lineas.reduce((s, l) => s + l.texto.length, 0)
  const costo = proveedor.costoEstimado(caracteres)

  // 3. El saldo, antes de gastar.
  if (!proveedor.falso) {
    const c = await proveedor.creditos()
    if (esFallo(c)) {
      const aviso = `no se pudo leer el saldo de ${proveedor.nombre} (${c.como}); se sigue: frenan el tope de la clave y el de la tanda`
      avisos.push(aviso)
      log(`[fabrica/voz] ${aviso}`)
    } else if (c.restantes < costo) {
      return {
        ok: false,
        clase: "no_hoy",
        como: `voces: saldo insuficiente en ${proveedor.nombre}: quedan ${c.restantes} créditos y ${ep.id} necesita ${costo}${c.renuevaEn ? ` (se renueva el ${c.renuevaEn})` : ""}`,
        codigo: "sin_creditos",
      }
    }
  }

  // 4. Cada tramo, en orden. Un tramo que falla corta el episodio: un video a medias no sirve.
  const tramos: TramoGuardado[] = []
  const conVoz: LineaConVoz[] = []
  let creditos = 0
  for (const [k, grupo] of pedidos.entries()) {
    const ps: PedidoVoz[] = grupo.map((l) => ({ personaje: l.personaje, voiceId: voz.get(l.personaje)!, texto: l.texto }))
    const r = await proveedor.dialogo(ps)
    if (esFallo(r)) {
      log(`[fabrica/voz] ${ep.id}: el tramo ${k + 1} de ${pedidos.length} falló (${r.clase}): ${r.como}`)
      return { ...r, como: `voces (tramo ${k + 1} de ${pedidos.length}): ${r.como}` }
    }
    tramos.push({ audio: r.audio, formato: r.formato, duracionS: r.duracionS, como: r.como })
    creditos += r.creditos
    for (const s of r.lineas) {
      const l = grupo[s.indice]
      if (l) conVoz.push({ ...l, tramo: k, inicioS: s.inicioS, finS: s.finS, duracionS: s.duracionS })
    }
    log(`[fabrica/voz] ${ep.id}: tramo ${k + 1} de ${pedidos.length} listo, ${r.duracionS} s (${r.como})`)
  }
  const vozPorPlanoS = (ep.planos ?? []).map(() => 0)
  for (const l of conVoz) vozPorPlanoS[l.plano] = Math.round((vozPorPlanoS[l.plano] + l.duracionS) * 1000) / 1000
  return { ...vacio, tramos, lineas: conVoz, vozPorPlanoS, caracteres, creditos }
}

/** ¿Se puede publicar un video con estas voces? Nunca con la voz falsa. */
export const vozPublicable = (r: Pick<ResultadoVoces, "falso">) => !r.falso

/** Lo que costaría en dólares, para reservar el gasto antes de pedir la voz (fabrica_sumar_gasto). La falsa no cuesta. */
export const costoUsdEstimado = (caracteres: number, proveedor: Pick<ProveedorVoz, "falso">) =>
  proveedor.falso ? 0 : Math.round((caracteres / 1000) * USD_POR_MIL_CARACTERES * 10000) / 10000

// ── Subtítulos ────────────────────────────────────────────────

export interface Subtitulo {
  inicioS: number
  finS: number
  texto: string
}

const tiempoSrt = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${dos(Math.floor(ms / 3600000))}:${dos(Math.floor(ms / 60000) % 60)}:${dos(Math.floor(ms / 1000) % 60)},${String(ms % 1000).padStart(3, "0")}`
}

/** Un .srt con los tiempos YA puestos en la línea de tiempo del video (eso lo decide el render). */
export function srt(subs: Subtitulo[]): string {
  return subs
    .filter((s) => s.texto.trim() && s.finS > s.inicioS)
    .map((s, i) => `${i + 1}\n${tiempoSrt(s.inicioS)} --> ${tiempoSrt(s.finS)}\n${s.texto.trim()}\n`)
    .join("\n")
}
