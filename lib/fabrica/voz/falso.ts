// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · VOZ FALSA (sin clave, sin red)
//
// Para que la tanda corra de punta a punta sin ElevenLabs: devuelve un WAV
// determinista (un tono bajito por voz, o silencio) con duraciones realistas
// según el largo del texto. Mismo contrato que el proveedor real.
//
// `falso: true` en todo lo que sale de aquí: un video con esta voz es de
// prueba y NUNCA se publica (la tanda lo mira con `vozPublicable()`).
//
// Duración: el español hablado ronda 14 caracteres por segundo (≈ 2,5
// palabras por segundo), más un respiro al final de cada línea.
// ──────────────────────────────────────────────────────────────

import type { Candidata, Creditos, Disenador, PedidoVoz, ProveedorVoz, SegmentoLinea, TramoDeAudio } from "./tipos"
import type { Fallo } from "../tipos"

export const CARACTERES_POR_SEGUNDO = 14
export const RESPIRO_S = 0.25
export const DURACION_MIN_S = 0.8
/** Entre una línea y la siguiente dentro de un diálogo. */
export const PAUSA_ENTRE_LINEAS_S = 0.2
export const MUESTREO_HZ = 16000

const redondear = (s: number) => Math.round(s * 100) / 100

/** Lo que tardaría una persona en decir ese texto. */
export function duracionDeTexto(texto: string): number {
  const n = texto.replace(/\s+/g, " ").trim().length
  return redondear(Math.max(DURACION_MIN_S, n / CARACTERES_POR_SEGUNDO + RESPIRO_S))
}

/** Un número estable a partir de un texto (FNV-1a de 32 bits). */
export function hashDe(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** El tono de cada voz: entre 140 y 400 Hz, siempre el mismo para el mismo id. */
export const tonoDe = (voiceId: string) => 140 + (hashDe(voiceId) % 261)

/** Una parte del audio: segundos de tono (frecuencia) o de silencio (null). */
export interface Parte {
  segundos: number
  hz: number | null
}

/** Un WAV PCM de 16 bits, mono, con esas partes una tras otra. Determinista. */
export function wav(partes: Parte[], muestreo = MUESTREO_HZ): Uint8Array {
  const muestras = partes.map((p) => Math.max(0, Math.round(p.segundos * muestreo)))
  const total = muestras.reduce((s, n) => s + n, 0)
  const datos = total * 2
  const b = new Uint8Array(44 + datos)
  const v = new DataView(b.buffer)
  const ascii = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  ascii(0, "RIFF")
  v.setUint32(4, 36 + datos, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  v.setUint32(16, 16, true) // tamaño del bloque fmt
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, muestreo, true)
  v.setUint32(28, muestreo * 2, true) // bytes por segundo
  v.setUint16(32, 2, true) // bytes por muestra
  v.setUint16(34, 16, true) // bits
  ascii(36, "data")
  v.setUint32(40, datos, true)
  let o = 44
  partes.forEach((p, k) => {
    const n = muestras[k]
    const fundido = Math.min(n / 2, muestreo * 0.02) // 20 ms de entrada y salida: sin clics
    for (let i = 0; i < n; i++) {
      let x = 0
      if (p.hz) {
        const env = Math.min(1, i / Math.max(1, fundido), (n - i) / Math.max(1, fundido))
        x = Math.round(Math.sin((2 * Math.PI * p.hz * i) / muestreo) * 3000 * env) // bajito: −21 dBFS
      }
      v.setInt16(o, x, true)
      o += 2
    }
  })
  return b
}

/** Lo que dura un WAV de los que arma `wav()` (para los tests y para el render de prueba). */
export function duracionDeWav(b: Uint8Array): number {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return v.getUint32(40, true) / v.getUint32(28, true)
}

export interface OpcionesFalsa {
  /** false = silencio en vez de tono. */
  tono?: boolean
  /** Para probar la tanda cuando la voz falla: el pedido número n (desde 1) devuelve este Fallo. */
  fallarEn?: { pedido: number; fallo: Fallo }
  /** El saldo que informa (por defecto, de sobra). */
  creditos?: Creditos | Fallo
}

export function crearVozFalsa(o: OpcionesFalsa = {}): ProveedorVoz & Disenador {
  const conTono = o.tono !== false
  let pedidos = 0
  let gastados = 0

  async function dialogo(lineas: PedidoVoz[]): Promise<TramoDeAudio | Fallo> {
    pedidos++
    if (o.fallarEn && o.fallarEn.pedido === pedidos) return o.fallarEn.fallo
    if (!lineas.length) return { ok: false, clase: "fatal", como: "voz falsa: el pedido no tiene líneas" }
    const partes: Parte[] = []
    const segmentos: SegmentoLinea[] = []
    let t = 0
    lineas.forEach((l, i) => {
      if (i > 0) {
        partes.push({ segundos: PAUSA_ENTRE_LINEAS_S, hz: null })
        t += PAUSA_ENTRE_LINEAS_S
      }
      const d = duracionDeTexto(l.texto)
      partes.push({ segundos: d, hz: conTono ? tonoDe(l.voiceId) : null })
      segmentos.push({ indice: i, inicioS: redondear(t), finS: redondear(t + d), duracionS: d })
      t += d
    })
    const caracteres = lineas.reduce((s, l) => s + l.texto.length, 0)
    gastados += caracteres
    return {
      ok: true,
      audio: wav(partes),
      formato: "wav",
      duracionS: redondear(t),
      lineas: segmentos,
      creditos: 0,
      como: `voz falsa (${conTono ? "tono" : "silencio"}), ${lineas.length} línea(s), ${caracteres} caracteres a ${CARACTERES_POR_SEGUNDO} por segundo`,
    }
  }

  async function disenar(descripcion: string, muestra: string): Promise<Candidata[] | Fallo> {
    const base = hashDe(descripcion).toString(36)
    const d = duracionDeTexto(muestra)
    return [1, 2, 3].map((n) => {
      const id = `falso-${base}-${n}`
      return { generatedVoiceId: id, audio: wav([{ segundos: d, hz: conTono ? tonoDe(id) : null }]), formato: "wav" as const, duracionS: d }
    })
  }

  return {
    nombre: "falso",
    modelo: "falso",
    modeloDiseno: "falso",
    falso: true,
    maxCaracteres: 2000,
    dialogo,
    creditos: async () => o.creditos ?? { ok: true, usados: 0, limite: 1_000_000, restantes: 1_000_000, renuevaEn: null, plan: "falso" },
    costoEstimado: () => 0,
    gastados: () => gastados,
    disenar,
    crearVoz: async (generatedVoiceId) => ({ ok: true, voiceId: `voz-${generatedVoiceId}` }),
    buscarVoz: async () => ({ ok: true, voiceId: null }),
  }
}
