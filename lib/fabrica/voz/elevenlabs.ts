// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · CLIENTE DE ELEVENLABS (Voice Design + Text to Dialogue)
//
// Solo corre en la VM de la tanda y en disenar-voces.ts. Nunca lanza:
// devuelve el resultado o un Fallo con la clase y el CÓMO (la respuesta del
// servicio tal cual), con el mismo `pedir()` que las redes.
//
// Lo que se usa (plan 11, paso c; SIN VERIFICAR en elevenlabs.io, esta
// sesión no lo abre: se confirma con la primera llamada real):
// - POST /v1/text-to-dialogue/with-timestamps: las líneas en orden, con su
//   voz, en un solo audio; `voice_segments` trae dónde empieza y termina cada
//   línea (`dialogue_input_index`). Modelo eleven_v3. Hasta 2.000 caracteres
//   por pedido [V4].
// - POST /v1/text-to-voice/design: candidatas desde una descripción (20 a
//   1.000 caracteres) y un texto de muestra (100 a 1.000) [V3].
// - POST /v1/text-to-voice: guarda una candidata como voz de la biblioteca.
// - GET /v2/voices?search=: busca una voz por nombre (antes de crear otra).
// - GET /v1/user/subscription: créditos usados y límite de la cuenta. El
//   límite PROPIO de la clave [V11] no sale ahí: si la clave llega a su tope,
//   el servicio contesta quota_exceeded y eso es `no_hoy`.
//
// Gasto: cada intento reserva sus caracteres ANTES de mandar contra el tope
// del proceso (FABRICA_VOZ_TOPE_CARACTERES). Un intento que se cae también
// cuenta: mejor frenar de más que gastar de más.
// ──────────────────────────────────────────────────────────────

import type { Clase, Fallo, Log } from "../tipos"
import { campo, esFallo, falloHttp, ok2xx, pedir, recortar, texto, type Respuesta } from "../redes/http"
import type { Candidata, Creditos, Disenador, PedidoVoz, ProveedorVoz, SegmentoLinea, TramoDeAudio } from "./tipos"

export const BASE_ELEVENLABS = "https://api.elevenlabs.io"
export const MODELO_DIALOGO = "eleven_v3"
export const MODELO_DISENO = "eleven_ttv_v3"
/** Text to Dialogue: hasta 2.000 caracteres por pedido [V4]. */
export const MAX_CARACTERES_DIALOGO = 2000
/** Por proceso (una tanda). Con 6 videos de ~1.200 caracteres y reintentos sobra. */
export const TOPE_CARACTERES_POR_DEFECTO = 15000
export const MAX_INTENTOS_VOZ = 3
/** Espera antes del intento siguiente: 2 s, luego 8 s. */
export const ESPERAS_VOZ_MS = [2000, 8000] as const
export const FORMATO_SALIDA = "mp3_44100_128"

export interface PuertosEleven {
  fetch: typeof fetch
  clave: string
  log: Log
  dormir?: (ms: number) => Promise<void>
  base?: string
  modelo?: string
  modeloDiseno?: string
  topeCaracteres?: number
}

const minus = (x: unknown) => (typeof x === "string" ? x.toLowerCase() : "")

/** El `detail` de un error de ElevenLabs como texto: `{status, message}`, una cadena o la lista de validación. */
export function detalleEleven(cuerpo: unknown): string {
  const d = campo(cuerpo, "detail")
  if (typeof d === "string") return d.toLowerCase()
  if (Array.isArray(d)) return d.map((x) => `${minus(campo(x, "type"))} ${minus(campo(x, "msg"))}`).join(" ")
  return `${minus(campo(d, "status"))} ${minus(campo(d, "message"))}`.trim()
}

/** El código corto del error (detail.status), para el campo `codigo`. */
export const codigoEleven = (cuerpo: unknown) => texto(campo(cuerpo, "detail", "status"))

/**
 * La clase de un error de ElevenLabs. Pura; la tabla de casos está en el test.
 * - Créditos o cuota agotados (de la cuenta o de la clave): no_hoy.
 * - Demasiados pedidos a la vez, servicio ocupado, 5xx, 408: reintentable.
 * - Clave inválida, sin permiso, sin plan, voz inexistente, texto demasiado
 *   largo, validación: fatal (repetir no lo arregla).
 */
export function clasificarEleven(status: number, cuerpo: unknown): Clase {
  const d = detalleEleven(cuerpo)
  if (/max_character_limit|too long|text_too_long/.test(d)) return "fatal"
  if (/quota|credit|insufficient|character_limit_reached|limit_reached|exceeds your/.test(d)) return "no_hoy"
  if (status >= 500 || status === 408) return "reintentable"
  if (status === 429) return "reintentable" // too_many_concurrent_requests, system_busy
  return "fatal"
}

const fatal = (paso: string, como: string, codigo?: string): Fallo => ({ ok: false, clase: "fatal", como: `${paso}: ${como}`, ...(codigo ? { codigo } : {}) })

function bytesDeBase64(b64: unknown): Uint8Array | null {
  if (typeof b64 !== "string" || !b64) return null
  const datos = Uint8Array.from(Buffer.from(b64, "base64"))
  return datos.byteLength ? datos : null
}

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() && Number.isFinite(Number(x)) ? Number(x) : null)
const redondear = (s: number) => Math.round(s * 1000) / 1000

/**
 * La duración de cada línea desde `voice_segments`. Una línea puede venir en
 * varios segmentos: va del primer inicio al último fin. Una línea sin
 * segmento es un error: sin su duración el plano no puede durar lo que su audio.
 */
export function segmentosDeDialogo(cuerpo: unknown, cuantas: number): SegmentoLinea[] | string {
  const segs = campo(cuerpo, "voice_segments")
  if (!Array.isArray(segs)) return "la respuesta no trae voice_segments"
  const desde = new Map<number, number>()
  const hasta = new Map<number, number>()
  for (const s of segs) {
    const i = num(campo(s, "dialogue_input_index"))
    const ini = num(campo(s, "start_time_seconds"))
    const fin = num(campo(s, "end_time_seconds"))
    if (i === null || ini === null || fin === null || fin < ini) continue
    desde.set(i, Math.min(desde.get(i) ?? Infinity, ini))
    hasta.set(i, Math.max(hasta.get(i) ?? -Infinity, fin))
  }
  const faltan: number[] = []
  const out: SegmentoLinea[] = []
  for (let i = 0; i < cuantas; i++) {
    const a = desde.get(i)
    const b = hasta.get(i)
    if (a === undefined || b === undefined) {
      faltan.push(i + 1)
      continue
    }
    out.push({ indice: i, inicioS: redondear(a), finS: redondear(b), duracionS: redondear(b - a) })
  }
  if (faltan.length) return `voice_segments no trae la duración de la(s) línea(s) ${faltan.join(", ")} de ${cuantas}`
  return out
}

/** El fin del audio según la alineación por caracteres (si viene). */
function finDeAlineacion(cuerpo: unknown): number {
  const fines = campo(cuerpo, "alignment", "character_end_times_seconds")
  if (!Array.isArray(fines) || !fines.length) return 0
  return num(fines[fines.length - 1]) ?? 0
}

export function crearElevenLabs(p: PuertosEleven): ProveedorVoz & Disenador {
  const base = (p.base ?? BASE_ELEVENLABS).replace(/\/+$/, "")
  const modelo = p.modelo || MODELO_DIALOGO
  const modeloDiseno = p.modeloDiseno || MODELO_DISENO
  const tope = p.topeCaracteres && p.topeCaracteres > 0 ? p.topeCaracteres : TOPE_CARACTERES_POR_DEFECTO
  const dormir = p.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const cabeceras = { "xi-api-key": p.clave, "Content-Type": "application/json", Accept: "application/json" }
  let gastados = 0

  /** Reserva los caracteres antes de mandar. Pasar el tope es `no_hoy`, sin tocar la red. */
  function reservar(caracteres: number, paso: string): Fallo | null {
    if (gastados + caracteres > tope) {
      return {
        ok: false,
        clase: "no_hoy",
        como: `${paso}: tope de la tanda: ya se reservaron ${gastados} caracteres y este pedido suma ${caracteres}; el tope es ${tope} (FABRICA_VOZ_TOPE_CARACTERES)`,
        codigo: "tope_tanda",
      }
    }
    gastados += caracteres
    return null
  }

  /** Repite solo lo reintentable, como máximo 3 veces, y deja en el log cada intento con su cómo. */
  async function conReintentos<T>(paso: string, caracteres: number, intento: () => Promise<T | Fallo>): Promise<{ r: T | Fallo; intentos: number }> {
    let ultimo: Fallo | null = null
    for (let n = 1; ; n++) {
      const sin = reservar(caracteres, paso)
      if (sin) return { r: ultimo ? { ...sin, como: `${sin.como}; el intento anterior: ${ultimo.como}` } : sin, intentos: n - 1 }
      const r = await intento()
      if (!esFallo(r)) return { r, intentos: n }
      ultimo = r
      if (r.clase !== "reintentable" || n >= MAX_INTENTOS_VOZ) {
        return { r: { ...r, como: `${r.como} (intento ${n} de ${MAX_INTENTOS_VOZ})` }, intentos: n }
      }
      const ms = ESPERAS_VOZ_MS[Math.min(n, ESPERAS_VOZ_MS.length) - 1]
      p.log(`[fabrica/voz] ${paso}: el intento ${n} falló (${r.como}); se reintenta en ${ms / 1000} s`)
      await dormir(ms)
    }
  }

  const respuesta = async (url: string, init: RequestInit, ms: number, idempotente: boolean, paso: string): Promise<Respuesta | Fallo> => {
    const r = await pedir(p, url, init, { ms, idempotente, paso })
    if (esFallo(r)) return r
    if (!ok2xx(r)) return falloHttp(paso, r, clasificarEleven, codigoEleven(r.cuerpo) ?? String(r.status))
    return r
  }

  async function creditos(): Promise<Creditos | Fallo> {
    const paso = "elevenlabs.creditos (GET /v1/user/subscription)"
    const r = await respuesta(`${base}/v1/user/subscription`, { method: "GET", headers: cabeceras }, 20_000, true, paso)
    if (esFallo(r)) return r
    const usados = num(campo(r.cuerpo, "character_count"))
    const limite = num(campo(r.cuerpo, "character_limit"))
    if (usados === null || limite === null) return fatal(paso, `la respuesta no trae character_count/character_limit: ${recortar(r.texto)}`)
    const reset = num(campo(r.cuerpo, "next_character_count_reset_unix"))
    return {
      ok: true,
      usados,
      limite,
      restantes: Math.max(0, limite - usados),
      renuevaEn: reset ? new Date(reset * 1000).toISOString() : null,
      plan: texto(campo(r.cuerpo, "tier")) ?? null,
    }
  }

  async function dialogo(pedidos: PedidoVoz[]): Promise<TramoDeAudio | Fallo> {
    const paso = "elevenlabs.dialogo (POST /v1/text-to-dialogue/with-timestamps)"
    if (!pedidos.length) return fatal(paso, "el pedido no tiene líneas")
    const malas = pedidos.map((x, i) => (!x.texto.trim() || !x.voiceId.trim() ? i + 1 : 0)).filter(Boolean)
    if (malas.length) return fatal(paso, `línea(s) ${malas.join(", ")} sin texto o sin voz`)
    const caracteres = pedidos.reduce((s, x) => s + x.texto.length, 0)
    if (caracteres > MAX_CARACTERES_DIALOGO) {
      return fatal(paso, `${caracteres} caracteres en un pedido; el tope es ${MAX_CARACTERES_DIALOGO}: hay que partirlo antes (partirEnPedidos)`, "pedido_largo")
    }
    const cuerpo = JSON.stringify({ inputs: pedidos.map((x) => ({ text: x.texto, voice_id: x.voiceId })), model_id: modelo })
    const { r, intentos } = await conReintentos<TramoDeAudio>(paso, caracteres, async () => {
      const res = await respuesta(`${base}/v1/text-to-dialogue/with-timestamps?output_format=${FORMATO_SALIDA}`, { method: "POST", headers: cabeceras, body: cuerpo }, 180_000, true, paso)
      if (esFallo(res)) return res
      const audio = bytesDeBase64(campo(res.cuerpo, "audio_base64"))
      if (!audio) return fatal(paso, `HTTP ${res.status} sin audio_base64: ${recortar(res.texto)}`)
      const lineas = segmentosDeDialogo(res.cuerpo, pedidos.length)
      if (typeof lineas === "string") return fatal(paso, `${lineas}; sin la duración de cada línea no se puede armar el plano`)
      const duracionS = redondear(Math.max(finDeAlineacion(res.cuerpo), ...lineas.map((l) => l.finS)))
      const informado = num(res.headers.get("character-cost"))
      return {
        ok: true,
        audio,
        formato: "mp3",
        duracionS,
        lineas,
        creditos: informado ?? caracteres,
        como: `${modelo}, ${pedidos.length} línea(s), ${caracteres} caracteres, costo ${informado !== null ? `informado: ${informado}` : "estimado (sin cabecera character-cost)"}`,
      }
    })
    if (esFallo(r)) return r
    return intentos > 1 ? { ...r, como: `${r.como}, ${intentos} intentos` } : r
  }

  async function disenar(descripcion: string, muestra: string): Promise<Candidata[] | Fallo> {
    const paso = "elevenlabs.disenar (POST /v1/text-to-voice/design)"
    const d = descripcion.trim()
    const t = muestra.trim()
    if (d.length < 20 || d.length > 1000) return fatal(paso, `la descripción tiene ${d.length} caracteres (de 20 a 1.000)`)
    if (t.length < 100 || t.length > 1000) return fatal(paso, `el texto de muestra tiene ${t.length} caracteres (de 100 a 1.000)`)
    const cuerpo = JSON.stringify({ voice_description: d, model_id: modeloDiseno, text: t, auto_generate_text: false })
    const { r } = await conReintentos<Candidata[]>(paso, t.length, async () => {
      const res = await respuesta(`${base}/v1/text-to-voice/design?output_format=${FORMATO_SALIDA}`, { method: "POST", headers: cabeceras, body: cuerpo }, 180_000, true, paso)
      if (esFallo(res)) return res
      const previews = campo(res.cuerpo, "previews")
      const out: Candidata[] = []
      for (const pv of Array.isArray(previews) ? previews : []) {
        const id = texto(campo(pv, "generated_voice_id"))
        const audio = bytesDeBase64(campo(pv, "audio_base_64"))
        if (id && audio) out.push({ generatedVoiceId: id, audio, formato: "mp3", duracionS: num(campo(pv, "duration_secs")) })
      }
      if (!out.length) return fatal(paso, `HTTP ${res.status} sin candidatas utilizables (previews con generated_voice_id y audio_base_64): ${recortar(res.texto)}`)
      return out
    })
    return r
  }

  async function buscarVoz(nombre: string): Promise<{ ok: true; voiceId: string | null } | Fallo> {
    const paso = "elevenlabs.buscarVoz (GET /v2/voices)"
    const r = await respuesta(`${base}/v2/voices?search=${encodeURIComponent(nombre)}&page_size=100`, { method: "GET", headers: cabeceras }, 20_000, true, paso)
    if (esFallo(r)) return r
    const voces = campo(r.cuerpo, "voices")
    if (!Array.isArray(voces)) return fatal(paso, `la respuesta no trae voices: ${recortar(r.texto)}`)
    const igual = voces.find((v) => texto(campo(v, "name")) === nombre)
    return { ok: true, voiceId: igual ? (texto(campo(igual, "voice_id")) ?? null) : null }
  }

  async function crearVoz(generatedVoiceId: string, nombre: string, descripcion: string): Promise<{ ok: true; voiceId: string } | Fallo> {
    const paso = "elevenlabs.crearVoz (POST /v1/text-to-voice)"
    // No idempotente y sin reintento automático: un corte puede haberla creado.
    // Quien llama busca la voz por nombre antes de intentarlo de nuevo.
    const r = await respuesta(
      `${base}/v1/text-to-voice`,
      { method: "POST", headers: cabeceras, body: JSON.stringify({ voice_name: nombre, voice_description: descripcion.trim(), generated_voice_id: generatedVoiceId }) },
      60_000,
      false,
      paso,
    )
    if (esFallo(r)) return r
    const voiceId = texto(campo(r.cuerpo, "voice_id"))
    if (!voiceId) return { ok: false, clase: "ambiguo", como: `${paso}: HTTP ${r.status} sin voice_id (puede haberse creado: buscarla por nombre): ${recortar(r.texto)}` }
    return { ok: true, voiceId }
  }

  return {
    nombre: "elevenlabs",
    modelo,
    modeloDiseno,
    falso: false,
    maxCaracteres: MAX_CARACTERES_DIALOGO,
    dialogo,
    creditos,
    costoEstimado: (caracteres) => caracteres, // eleven_v3: 1 crédito por carácter (SIN VERIFICAR)
    gastados: () => gastados,
    disenar,
    crearVoz,
    buscarVoz,
  }
}
