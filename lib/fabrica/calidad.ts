// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · CONTROL DE CALIDAD DEL VIDEO (puro)
//
// Lee lo que dicen ffprobe y ffmpeg (texto) y decide si un render sale:
// tamaño exacto (1920×1080 o 1440×1080, según el guion), cuadros por
// segundo, H.264 yuv420p, duración del guion ±0,5 s, sin negros ni
// congelados fuera de lo que el episodio permite, audio sin saturar donde
// hay diálogo, peso por debajo del límite del almacén, la etiqueta de
// ficción visible del segundo 0 al final y el renderer con NVIDIA.
//
// Aquí no se corre nada: la medición (procesos) vive en calidad-medir.ts y
// la línea de comandos en scripts/fabrica/calidad.ts. Pruebas:
// `npx tsx lib/fabrica/calidad.test.ts` (textos guardados) y
// `npx tsx lib/fabrica/calidad-medir.test.ts` (videos chicos de ffmpeg).
//
// Un dato que no se pudo medir nunca pasa como bueno: es un motivo de
// rechazo con el cómo. Spec: docs/fabrica/ESPECIFICACION.md (agente C).
// ──────────────────────────────────────────────────────────────

import type { Episodio, Formato } from "@/components/casa-blanca/estudio/guion"
import { APERTURA_S, CIERRE_S, FPS_POR_DEFECTO, TAMANO, armarLinea, horarioDialogo } from "@/components/casa-blanca/estudio/linea"
import { flag, type Entorno } from "./tipos"

// ── Lo que se espera del episodio ─────────────────────────────

/** Un intervalo en segundos de video. */
export interface Tramo {
  desde: number
  hasta: number
}

export interface Esperado {
  formato: Formato
  ancho: number
  alto: number
  fps: number
  /** Apertura + planos + cierre. */
  duracionS: number
  /** Las ventanas en que alguien habla (segundos de video). Vacío = sin diálogo. */
  dialogos: Tramo[]
  /** Donde el cuadro puede quedarse quieto: la apertura, la tarjeta del cierre y las tomas que terminan antes que su plano. */
  quietos: Tramo[]
}

/** Una toma del motor y lo que dura (escena.tomas() / TOMAS_CINE). */
export type TomaConDuracion = { id: string; duracion: number }

/**
 * Lo que tiene que medir el video de un episodio. `tomas` (opcional) suma los
 * tramos en que la cámara queda quieta porque la toma dura menos que el plano
 * (la misma cuenta que `avisosDelEpisodio` de linea.ts).
 */
export function esperadoDe(ep: Episodio, tomas: ReadonlyArray<TomaConDuracion> = []): Esperado {
  const fps = ep.fps ?? FPS_POR_DEFECTO
  const linea = armarLinea(ep, fps)
  const { ancho, alto } = TAMANO[ep.formato] ?? TAMANO["16:9"]
  const dialogos: Tramo[] = []
  // La apertura (el logo casi fijo) y la tarjeta del cierre pueden quedar quietas.
  const quietos: Tramo[] = [
    { desde: 0, hasta: APERTURA_S },
    { desde: linea.duracion - CIERRE_S, hasta: linea.duracion },
  ]
  const ultimo = linea.tramos.length - 1
  linea.tramos.forEach((tr, i) => {
    for (const l of horarioDialogo(tr.plano)) dialogos.push({ desde: tr.desde + l.desde, hasta: tr.desde + l.hasta })
    const c = tr.plano.camara
    if (c.tipo !== "toma" || c.toma === "seguir") return
    const toma = tomas.find((t) => t.id === c.toma)
    if (!toma) return
    // La toma corre desde el cuadro 0 si es el primer plano, y hasta el final si es el último.
    const empieza = i === 0 ? 0 : tr.desde
    const termina = i === ultimo ? linea.duracion : tr.hasta
    if (termina - empieza > toma.duracion) quietos.push({ desde: empieza + toma.duracion, hasta: termina })
  })
  return { formato: ep.formato, ancho, alto, fps, duracionS: linea.duracion, dialogos, quietos: unir(quietos) }
}

// ── Reglas (entorno) ──────────────────────────────────────────

export interface Reglas {
  /** El límite por archivo del almacén (FABRICA_LIMITE_MB; 50 MB por defecto, el de Supabase Storage gratis). */
  limiteBytes: number
  /** FABRICA_EXIGIR_AUDIO: sin pista de audio en un guion con diálogo = rechazo. Apagada: solo aviso. */
  exigirAudio: boolean
  /** FABRICA_EXIGIR_NVIDIA: el render tiene que decir NVIDIA. Apagada: solo aviso. */
  exigirNvidia: boolean
  toleranciaDuracionS: number
  /** Un negro más largo que esto en medio del video es un hueco. */
  negroMaxS: number
  /** El fundido a negro del final puede durar hasta esto. */
  negroFinalMaxS: number
  /** Un congelado fuera de los quietos permitidos puede durar hasta esto. */
  congeladoMaxS: number
  /** El fundido final puede tapar la etiqueta este último tramo. */
  etiquetaFinalS: number
  /** Una línea de diálogo cubierta de silencio en esta fracción o más no tiene voz. */
  silencioMaxFraccion: number
}

export const LIMITE_MB_POR_DEFECTO = 50

export function reglasDe(env: Entorno): { reglas: Reglas; avisos: string[] } {
  const avisos: string[] = []
  let mb = LIMITE_MB_POR_DEFECTO
  const crudo = (env.FABRICA_LIMITE_MB ?? "").trim()
  if (crudo) {
    const n = Number(crudo.replace(",", "."))
    if (Number.isFinite(n) && n > 0) mb = n
    else avisos.push(`FABRICA_LIMITE_MB="${crudo}" no es un número positivo: se usó ${LIMITE_MB_POR_DEFECTO} MB`)
  }
  return {
    reglas: {
      limiteBytes: Math.floor(mb * 1024 * 1024),
      exigirAudio: flag(env.FABRICA_EXIGIR_AUDIO),
      exigirNvidia: flag(env.FABRICA_EXIGIR_NVIDIA),
      toleranciaDuracionS: 0.5,
      negroMaxS: 0.25,
      negroFinalMaxS: 0.5,
      congeladoMaxS: 1,
      etiquetaFinalS: 0.4,
      silencioMaxFraccion: 0.8,
    },
    avisos,
  }
}

// ── Lectura de ffprobe ────────────────────────────────────────

export interface Sonda {
  ancho: number | null
  alto: number | null
  codec: string | null
  pixFmt: string | null
  fps: number | null
  /** "1:1"; null si ffprobe no lo dice. */
  sar: string | null
  /** La del flujo de video; si no está, la del contenedor. */
  duracionS: number | null
  bytes: number | null
  audio: { codec: string | null; duracionS: number | null; canales: number | null } | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** "30/1" → 30; "0/0" → null. */
export function fraccion(v: unknown): number | null {
  if (typeof v !== "string") return num(v)
  const [a, b] = v.split("/").map(Number)
  if (b === undefined) return num(a)
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 && a > 0 ? a / b : null
}

/** La salida de `ffprobe -v error -show_streams -show_format -of json`. Tira con el cómo si no es eso. */
export function leerSonda(json: string): Sonda {
  let d: { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> }
  try {
    d = JSON.parse(json)
  } catch (e) {
    throw new Error(`ffprobe no devolvió JSON (${(e as Error).message}): ${json.slice(0, 200)}`)
  }
  const flujos = Array.isArray(d.streams) ? d.streams : []
  const v = flujos.find((s) => s.codec_type === "video")
  if (!v) throw new Error(`ffprobe no encontró una pista de video (${flujos.length} pistas)`)
  const a = flujos.find((s) => s.codec_type === "audio")
  const f = d.format ?? {}
  return {
    ancho: num(v.width),
    alto: num(v.height),
    codec: typeof v.codec_name === "string" ? v.codec_name : null,
    pixFmt: typeof v.pix_fmt === "string" ? v.pix_fmt : null,
    fps: fraccion(v.r_frame_rate) ?? fraccion(v.avg_frame_rate),
    sar: typeof v.sample_aspect_ratio === "string" ? v.sample_aspect_ratio : null,
    duracionS: num(v.duration) ?? num(f.duration),
    bytes: num(f.size),
    audio: a ? { codec: typeof a.codec_name === "string" ? a.codec_name : null, duracionS: num(a.duration), canales: num(a.channels) } : null,
  }
}

// ── Lectura de los filtros de ffmpeg (stderr) ─────────────────

/** blackdetect: "black_start:2 black_end:4 black_duration:2". Un negro abierto al final se cierra en `duracion`. */
export function leerNegros(stderr: string, duracion: number): Tramo[] {
  const out: Tramo[] = []
  for (const linea of stderr.split("\n")) {
    if (!linea.includes("blackdetect")) continue
    const ini = /black_start:\s*([\d.]+)/.exec(linea)
    if (!ini) continue
    const fin = /black_end:\s*([\d.]+)/.exec(linea)
    out.push({ desde: Number(ini[1]), hasta: fin ? Number(fin[1]) : duracion })
  }
  return out
}

/** Pares "<clave>_start: x" / "<clave>_end: y" (freezedetect, silencedetect). Uno abierto se cierra en `duracion`. */
function pares(stderr: string, filtro: string, clave: string, duracion: number): Tramo[] {
  const out: Tramo[] = []
  let abierto: number | null = null
  const ini = new RegExp(`${clave}_start:\\s*(-?[\\d.]+)`)
  const fin = new RegExp(`${clave}_end:\\s*(-?[\\d.]+)`)
  for (const linea of stderr.split("\n")) {
    if (!linea.includes(filtro)) continue
    const a = ini.exec(linea)
    if (a) abierto = Math.max(0, Number(a[1]))
    const b = fin.exec(linea)
    if (b && abierto !== null) {
      out.push({ desde: abierto, hasta: Number(b[1]) })
      abierto = null
    }
  }
  if (abierto !== null) out.push({ desde: abierto, hasta: duracion })
  return out
}

export const leerCongelados = (stderr: string, duracion: number) => pares(stderr, "freezedetect", "freeze", duracion)
export const leerSilencios = (stderr: string, duracion: number) => pares(stderr, "silencedetect", "silence", duracion)

export interface Volumen {
  maxDb: number
  mediaDb: number | null
  muestras: number | null
  /** Muestras en el escalón de 0 dB (al tope). */
  en0db: number
}

/** La última coincidencia: volumedetect puede escribir un resumen vacío antes del de verdad ("n_samples: 0"). */
function ultimo(re: RegExp, texto: string): string | null {
  let r: string | null = null
  const g = new RegExp(re.source, "g")
  for (let m = g.exec(texto); m; m = g.exec(texto)) r = m[1]
  return r
}

/** volumedetect. null si no aparece (la medición falló o no hubo audio). */
export function leerVolumen(stderr: string): Volumen | null {
  const solo = stderr
    .split("\n")
    .filter((l) => l.includes("volumedetect"))
    .join("\n")
  const max = ultimo(/max_volume:\s*(-?[\d.]+|-inf) dB/, solo)
  if (max === null) return null
  const media = ultimo(/mean_volume:\s*(-?[\d.]+|-inf) dB/, solo)
  const n = ultimo(/n_samples:\s*(\d+)/, solo)
  const cero = ultimo(/histogram_0db:\s*(\d+)/, solo)
  const db = (s: string) => (s === "-inf" ? -Infinity : Number(s))
  return { maxDb: db(max), mediaDb: media === null ? null : db(media), muestras: n === null ? null : Number(n), en0db: cero === null ? 0 : Number(cero) }
}

// ── La etiqueta de ficción ────────────────────────────────────

/**
 * Dónde va la etiqueta «FICCIÓN HECHA CON IA» (compositor.ts, paso 8): abajo a
 * la derecha, alineada al margen (5 % del ancho) con la base del texto en el
 * margen de abajo (5 % del alto), letra de 20 px a 1080. La zona tiene aire
 * para el acento, la sombra y un texto un poco más ancho.
 */
export function zonaEtiqueta(ancho: number, alto: number): { x: number; y: number; w: number; h: number } {
  const k = alto / 1080
  const par = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  const derecha = ancho - ancho * 0.05 + 10 * k
  const base = alto - alto * 0.05
  const w = par(390 * k)
  const h = par(44 * k)
  const x = Math.max(0, Math.min(ancho - w, par(derecha - w)))
  const y = Math.max(0, Math.min(alto - h, par(base - 32 * k)))
  return { x, y, w, h }
}

/** Cada cuánto se mira la etiqueta (4 cuadros por segundo). */
export const MUESTRAS_POR_S = 4

const BRILLO = 150
const CONTRASTE = 45
/** Un píxel es de la etiqueta si está en esta fracción de las muestras o más (el texto no se mueve; la escena sí). */
const ESTABLE = 0.5
/** De la máscara estable, esta fracción tiene que verse en una muestra para decir que la etiqueta está. */
const PRESENTE = 0.5

/**
 * Píxeles de trazo de texto: claros (el texto es blanco) con un vecino a 2 px
 * bastante más oscuro (la sombra o el fondo). Un cielo liso o una pared clara
 * no lo cumplen; un borde de la escena sí, pero la escena se mueve.
 */
export function trazos(pix: Uint8Array, w: number, h: number, brillo = BRILLO, contraste = CONTRASTE): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const v = pix[p]
      if (v < brillo) continue
      const vecinos = [x >= 2 ? pix[p - 2] : v, x < w - 2 ? pix[p + 2] : v, y >= 2 ? pix[p - 2 * w] : v, y < h - 2 ? pix[p + 2 * w] : v]
      if (v - Math.min(...vecinos) >= contraste) out[p] = 1
    }
  }
  return out
}

export interface AnalisisEtiqueta {
  muestras: number
  /** Píxeles de la máscara estable (el texto que no se mueve). */
  mascara: number
  /** Fracción del ancho de la zona que abarca la máscara, de punta a punta. */
  ancho: number
  /** Muestras en que se ve. */
  presentes: number
  /** Donde no se ve (segundos de video, con el paso de las muestras). */
  sinEtiqueta: Tramo[]
  /** La máscara no parece texto: muy chica o muy angosta. */
  noEncontrada: boolean
}

/**
 * `muestras[i]` = la zona en grises (w×h bytes) en el segundo i / porSegundo.
 * Robustez: un texto fijo sobre una escena que cambia deja una máscara
 * estable; cada muestra se compara contra esa máscara (con 1 px de holgura
 * por la compresión), así que una muestra con la escena llena de bordes pero
 * sin el texto no cuenta como etiqueta. Límite conocido: si la escena tiene un
 * borde claro inmóvil en esa esquina durante más de la mitad del video, se
 * podría confundir con la etiqueta; con varios planos y cámaras no pasa.
 */
export function analizarEtiqueta(muestras: Uint8Array[], w: number, h: number, porSegundo = MUESTRAS_POR_S): AnalisisEtiqueta {
  const n = muestras.length
  const paso = 1 / porSegundo
  if (!n) return { muestras: 0, mascara: 0, ancho: 0, presentes: 0, sinEtiqueta: [], noEncontrada: true }
  const marcas = muestras.map((m) => trazos(m, w, h))
  const cuenta = new Uint16Array(w * h)
  for (const m of marcas) for (let p = 0; p < m.length; p++) cuenta[p] += m[p]
  const mascara = new Uint8Array(w * h)
  let total = 0
  const xs: number[] = []
  for (let p = 0; p < mascara.length; p++) {
    if (cuenta[p] >= Math.max(1, Math.ceil(n * ESTABLE))) {
      mascara[p] = 1
      total++
      xs.push(p % w)
    }
  }
  // Lo que abarca de izquierda a derecha (sin el 2 % de cada punta: un píxel suelto no estira el texto).
  xs.sort((a, b) => a - b)
  const ancho = xs.length ? (xs[Math.floor(xs.length * 0.98)] - xs[Math.floor(xs.length * 0.02)] + 1) / w : 0
  // Un texto de 20 letras deja cientos de píxeles de trazo y ocupa más de un tercio de la zona.
  const noEncontrada = total < Math.max(40, 0.01 * w * h) || ancho < 0.35
  const sin: Tramo[] = []
  let presentes = 0
  marcas.forEach((m, i) => {
    let vistos = 0
    if (!noEncontrada) {
      for (let p = 0; p < mascara.length; p++) {
        if (!mascara[p]) continue
        const x = p % w
        const y = (p - x) / w
        let hay = false
        for (let dy = -1; dy <= 1 && !hay; dy++)
          for (let dx = -1; dx <= 1 && !hay; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx >= 0 && xx < w && yy >= 0 && yy < h && m[yy * w + xx]) hay = true
          }
        if (hay) vistos++
      }
    }
    if (!noEncontrada && vistos / total >= PRESENTE) presentes++
    else sin.push({ desde: i * paso, hasta: (i + 1) * paso })
  })
  return { muestras: n, mascara: total, ancho, presentes, sinEtiqueta: unir(sin), noEncontrada }
}

// ── La decisión ───────────────────────────────────────────────

export interface ErrorDeMedicion {
  que: "la sonda" | "el peso" | "los filtros" | "el audio" | "la etiqueta"
  como: string
}

/** Lo que se midió. Un campo null = no se pudo medir (el cómo va en `errores`). */
export interface Medicion {
  sonda: Sonda | null
  negros: Tramo[] | null
  congelados: Tramo[] | null
  /** null si no hay pista de audio o no se pudo medir (mirar `errores`). */
  volumen: Volumen | null
  silencios: Tramo[] | null
  etiqueta: AnalisisEtiqueta | null
  /** El WebGL que usó el render ("ANGLE (NVIDIA, Tesla T4…)"), si el render lo informó. */
  renderer: string | null
  /** Cada medición que falló: qué ("la sonda", "el audio"…) y el cómo. */
  errores: ErrorDeMedicion[]
}

export interface ResultadoCalidad {
  ok: boolean
  veredicto: "calidad_ok" | "rechazado"
  /** Lo que bloquea, en español y con el valor medido. */
  motivos: string[]
  /** Lo que no bloquea. */
  avisos: string[]
  esperado: { ancho: number; alto: number; fps: number; duracionS: number; conDialogo: boolean }
  medido: {
    ancho: number | null
    alto: number | null
    fps: number | null
    codec: string | null
    pixFmt: string | null
    duracionS: number | null
    bytes: number | null
    limiteBytes: number
    audio: (Volumen & { codec: string | null; duracionS: number | null }) | { sinPista: true } | null
    negros: Tramo[] | null
    congelados: Tramo[] | null
    etiqueta: AnalisisEtiqueta | null
    renderer: string | null
  }
}

/** 1.5 → "1,5 s". */
export const seg = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1).replace(".", ",")} s`
const tramo = (t: Tramo) => `de ${seg(t.desde)} a ${seg(t.hasta)}`
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`

/** Une tramos que se tocan o se pisan. */
export function unir(tramos: Tramo[]): Tramo[] {
  const t = [...tramos].sort((a, b) => a.desde - b.desde)
  const out: Tramo[] = []
  for (const x of t) {
    const u = out[out.length - 1]
    if (u && x.desde <= u.hasta + 1e-6) u.hasta = Math.max(u.hasta, x.hasta)
    else out.push({ ...x })
  }
  return out
}

/** Lo que queda de `t` fuera de los `permitidos`. */
export function restar(t: Tramo, permitidos: Tramo[]): Tramo[] {
  let partes: Tramo[] = [{ ...t }]
  for (const p of permitidos) {
    partes = partes.flatMap((x) => {
      if (p.hasta <= x.desde || p.desde >= x.hasta) return [x]
      const r: Tramo[] = []
      if (p.desde > x.desde) r.push({ desde: x.desde, hasta: p.desde })
      if (p.hasta < x.hasta) r.push({ desde: p.hasta, hasta: x.hasta })
      return r
    })
  }
  return partes
}

/** Cuánto de `t` cubren los `tramos`. */
function cubierto(t: Tramo, tramos: Tramo[]): number {
  return unir(tramos).reduce((s, x) => s + Math.max(0, Math.min(t.hasta, x.hasta) - Math.max(t.desde, x.desde)), 0)
}

/** Lista corta: los primeros 3 y cuántos más. */
function primeros(xs: string[], max = 3): string {
  return xs.length <= max ? xs.join("; ") : `${xs.slice(0, max).join("; ")} y ${xs.length - max} más`
}

export function decidir(esp: Esperado, m: Medicion, reglas: Reglas, avisosPrevios: string[] = []): ResultadoCalidad {
  const motivos: string[] = m.errores.map((e) => `no se pudo medir ${e.que}: ${e.como}`)
  const avisos: string[] = [...avisosPrevios]
  const s = m.sonda
  const conDialogo = esp.dialogos.length > 0
  const duracion = s?.duracionS ?? esp.duracionS

  // Imagen.
  if (s) {
    if (s.ancho !== esp.ancho || s.alto !== esp.alto)
      motivos.push(`mide ${s.ancho ?? "?"}×${s.alto ?? "?"} y el guion (${esp.formato}) pide ${esp.ancho}×${esp.alto}`)
    if (s.sar && s.sar !== "1:1" && s.sar !== "0:1") motivos.push(`píxeles no cuadrados (${s.sar}): se vería deformado`)
    if (s.fps === null) motivos.push("no se pudo leer los cuadros por segundo")
    else if (Math.abs(s.fps - esp.fps) > 0.01) motivos.push(`va a ${+s.fps.toFixed(3)} cuadros por segundo y el guion pide ${esp.fps}`)
    if (s.codec !== "h264") motivos.push(`códec ${s.codec ?? "desconocido"}: va H.264`)
    if (s.pixFmt !== "yuv420p") motivos.push(`formato de píxel ${s.pixFmt ?? "desconocido"}: va yuv420p`)
    if (s.duracionS === null) motivos.push("no se pudo leer la duración")
    else if (Math.abs(s.duracionS - esp.duracionS) > reglas.toleranciaDuracionS)
      motivos.push(`dura ${seg(s.duracionS)} y el guion ${seg(esp.duracionS)} (tolerancia ±${seg(reglas.toleranciaDuracionS)})`)
    if (s.bytes === null) motivos.push("no se pudo leer el peso del archivo")
    else if (s.bytes > reglas.limiteBytes) motivos.push(`pesa ${mb(s.bytes)} y el límite del almacén es ${mb(reglas.limiteBytes)}`)
  }

  // Negros: ninguno en medio; al final, solo el fundido corto.
  if (m.negros) {
    const malos: string[] = []
    for (const t of m.negros) {
      const largo = t.hasta - t.desde
      const alFinal = t.hasta >= duracion - 0.1
      if (alFinal ? largo > reglas.negroFinalMaxS : largo > reglas.negroMaxS) malos.push(`${seg(largo)} ${tramo(t)}`)
    }
    if (malos.length) motivos.push(`cuadros negros: ${primeros(malos)}`)
  }

  // Congelados: lo que sobra fuera de los quietos que permite el episodio.
  if (m.congelados) {
    const malos: string[] = []
    for (const t of m.congelados)
      for (const r of restar(t, esp.quietos)) if (r.hasta - r.desde > reglas.congeladoMaxS) malos.push(`${seg(r.hasta - r.desde)} ${tramo(r)}`)
    if (malos.length) motivos.push(`imagen congelada fuera de la apertura y el cierre: ${primeros(malos)}`)
  }

  // Audio.
  let audio: ResultadoCalidad["medido"]["audio"] = null
  if (s && !s.audio) {
    audio = { sinPista: true }
    if (conDialogo && reglas.exigirAudio) motivos.push("sin pista de audio y el guion tiene diálogo")
    else if (conDialogo) avisos.push("sin pista de audio (el guion tiene diálogo; FABRICA_EXIGIR_AUDIO apagada: no bloquea)")
    else avisos.push("sin pista de audio")
  } else if (s?.audio) {
    const v = m.volumen
    if (!v) {
      if (!m.errores.some((e) => e.que === "el audio")) motivos.push("no se pudo medir el volumen del audio")
    } else {
      audio = { ...v, codec: s.audio.codec, duracionS: s.audio.duracionS }
      // Al tope de vez en cuando puede ser un pico normalizado; muchas muestras al tope es saturación.
      const umbral = Math.max(10, (v.muestras ?? 0) * 1e-5)
      if (v.maxDb >= -0.1 && v.en0db >= umbral) motivos.push(`audio saturado: ${v.en0db} muestras al tope (0 dB)`)
      if (conDialogo && v.maxDb <= -50) motivos.push(`la pista de audio está en silencio (pico ${v.maxDb === -Infinity ? "-inf" : v.maxDb} dB) y el guion tiene diálogo`)
      else if (conDialogo && m.silencios) {
        const mudos = esp.dialogos.filter((d) => cubierto(d, m.silencios!) >= reglas.silencioMaxFraccion * (d.hasta - d.desde))
        if (mudos.length) motivos.push(`sin voz donde hay diálogo: ${primeros(mudos.map(tramo))}`)
      } else if (conDialogo && !m.silencios && !m.errores.some((e) => e.que === "el audio")) motivos.push("no se pudo medir los silencios del audio")
      if (s.audio.duracionS !== null && s.duracionS !== null && s.duracionS - s.audio.duracionS > reglas.toleranciaDuracionS)
        avisos.push(`el audio dura ${seg(s.audio.duracionS)} y el video ${seg(s.duracionS)}`)
    }
  }

  // Etiqueta de ficción del segundo 0 al final.
  if (m.etiqueta) {
    const e = m.etiqueta
    if (e.noEncontrada)
      motivos.push(`no se encontró la etiqueta de ficción abajo a la derecha (${e.mascara} píxeles de texto estable, ${Math.round(e.ancho * 100)} % del ancho de la zona)`)
    else {
      const faltas = e.sinEtiqueta.filter((t) => t.desde < duracion - reglas.etiquetaFinalS)
      if (faltas.length) motivos.push(`sin etiqueta de ficción ${primeros(faltas.map(tramo))}`)
    }
  }

  // Renderer.
  if (m.renderer) {
    if (!/nvidia/i.test(m.renderer)) {
      if (reglas.exigirNvidia) motivos.push(`el render no usó NVIDIA: ${m.renderer}`)
      else avisos.push(`el render no usó NVIDIA (${m.renderer}); FABRICA_EXIGIR_NVIDIA apagada: no bloquea`)
    }
  } else if (reglas.exigirNvidia) motivos.push("el render no informó su renderer de WebGL")
  else avisos.push("el render no informó su renderer de WebGL")

  const ok = motivos.length === 0
  return {
    ok,
    veredicto: ok ? "calidad_ok" : "rechazado",
    motivos,
    avisos,
    esperado: { ancho: esp.ancho, alto: esp.alto, fps: esp.fps, duracionS: esp.duracionS, conDialogo },
    medido: {
      ancho: s?.ancho ?? null,
      alto: s?.alto ?? null,
      fps: s?.fps ?? null,
      codec: s?.codec ?? null,
      pixFmt: s?.pixFmt ?? null,
      duracionS: s?.duracionS ?? null,
      bytes: s?.bytes ?? null,
      limiteBytes: reglas.limiteBytes,
      audio,
      negros: m.negros,
      congelados: m.congelados,
      etiqueta: m.etiqueta,
      renderer: m.renderer,
    },
  }
}
