// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · MEDIR UN VIDEO CON FFPROBE Y FFMPEG (procesos)
//
// Corre ffprobe y ffmpeg sobre el MP4 y le pasa el texto a calidad.ts, que
// decide. Tres corridas: la sonda (ffprobe), los filtros (blackdetect,
// freezedetect y, si hay audio, volumedetect + silencedetect) y la zona de la
// etiqueta de ficción (4 cuadros por segundo, en grises, recortada).
//
// `correr` y `peso` se inyectan: la tanda usa los de verdad; las pruebas
// también (calidad-medir.test.ts arma videos chicos con ffmpeg). Lo usa la
// tanda de la VM y la línea de comandos scripts/fabrica/calidad.ts.
// ──────────────────────────────────────────────────────────────

import { spawn } from "node:child_process"
import { stat } from "node:fs/promises"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import {
  MUESTRAS_POR_S,
  analizarEtiqueta,
  decidir,
  esperadoDe,
  leerCongelados,
  leerNegros,
  leerSilencios,
  leerSonda,
  leerVolumen,
  reglasDe,
  zonaEtiqueta,
  type ErrorDeMedicion,
  type Esperado,
  type Medicion,
  type ResultadoCalidad,
  type TomaConDuracion,
} from "./calidad"
import type { Entorno } from "./tipos"

export interface Salida {
  codigo: number | null
  stdout: Buffer
  stderr: string
}
export type Correr = (cmd: string, args: string[]) => Promise<Salida>

/** Lo último del stderr: ahí dice ffmpeg por qué falló. */
const cola = (s: string, n = 400) => s.trim().slice(-n)

/** Corre un proceso y junta su salida. Rechaza solo si no arranca (ENOENT…). */
export const correrProceso: Correr = (cmd, args) =>
  new Promise((ok, mal) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    const partes: Buffer[] = []
    let err = ""
    p.stdout.on("data", (b: Buffer) => partes.push(b))
    p.stderr.on("data", (b: Buffer) => {
      err += b.toString("utf8")
      // Los filtros escriben una línea por evento: con 4 MB alcanza; si no, se queda lo último.
      if (err.length > 4_000_000) err = err.slice(-2_000_000)
    })
    p.on("error", mal)
    p.on("close", (codigo) => ok({ codigo, stdout: Buffer.concat(partes), stderr: err }))
  })

export interface PuertosMedir {
  correr: Correr
  /** Bytes del archivo (si ffprobe no lo dice). */
  peso: (ruta: string) => Promise<number>
  ffmpeg: string
  ffprobe: string
}

export const puertosDeVerdad = (env: Entorno): PuertosMedir => ({
  correr: correrProceso,
  peso: async (ruta) => (await stat(ruta)).size,
  ffmpeg: env.FABRICA_FFMPEG?.trim() || "ffmpeg",
  ffprobe: env.FABRICA_FFPROBE?.trim() || "ffprobe",
})

/** Parámetros de los filtros. Los umbrales de la decisión viven en calidad.ts (Reglas). */
const NEGROS = "blackdetect=d=0.1:pic_th=0.98:pix_th=0.10"
const CONGELADOS = "freezedetect=n=-60dB:d=0.5"
const AUDIO = "volumedetect,silencedetect=n=-50dB:d=0.3"

function fallo(errores: ErrorDeMedicion[], que: ErrorDeMedicion["que"], como: string) {
  console.error(`[fabrica/calidad] medir ${que} falló: ${como}`)
  errores.push({ que, como })
}

export async function medirVideo(ruta: string, esp: Esperado, p: PuertosMedir, renderer: string | null = null): Promise<Medicion> {
  const errores: ErrorDeMedicion[] = []
  const m: Medicion = { sonda: null, negros: null, congelados: null, volumen: null, silencios: null, etiqueta: null, renderer, errores }

  // 1. La sonda.
  try {
    const r = await p.correr(p.ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", ruta])
    if (r.codigo !== 0) throw new Error(`ffprobe salió con ${r.codigo}: ${cola(r.stderr) || "sin mensaje"}`)
    m.sonda = leerSonda(r.stdout.toString("utf8"))
  } catch (e) {
    fallo(errores, "la sonda", (e as Error).message)
    return m
  }
  const s = m.sonda
  if (s.bytes === null) {
    try {
      s.bytes = await p.peso(ruta)
    } catch (e) {
      fallo(errores, "el peso", (e as Error).message)
    }
  }
  const duracion = s.duracionS ?? esp.duracionS

  // 2. Negros, congelados y audio, en una sola pasada.
  try {
    const args = ["-hide_banner", "-nostats", "-i", ruta, "-map", "0:v:0", "-vf", `${NEGROS},${CONGELADOS}`]
    if (s.audio) args.push("-map", "0:a:0", "-af", AUDIO)
    args.push("-f", "null", "-")
    const r = await p.correr(p.ffmpeg, args)
    if (r.codigo !== 0) throw new Error(`ffmpeg salió con ${r.codigo}: ${cola(r.stderr) || "sin mensaje"}`)
    m.negros = leerNegros(r.stderr, duracion)
    m.congelados = leerCongelados(r.stderr, duracion)
    if (s.audio) {
      m.volumen = leerVolumen(r.stderr)
      if (!m.volumen) fallo(errores, "el audio", `volumedetect no dejó resultado: ${cola(r.stderr, 200)}`)
      else m.silencios = leerSilencios(r.stderr, duracion)
    }
  } catch (e) {
    fallo(errores, "los filtros", (e as Error).message)
    if (s.audio) errores.push({ que: "el audio", como: "los filtros no corrieron" })
  }

  // 3. La etiqueta de ficción: la zona de abajo a la derecha, en grises, 4 veces por segundo.
  try {
    const z = zonaEtiqueta(s.ancho ?? esp.ancho, s.alto ?? esp.alto)
    const r = await p.correr(p.ffmpeg, [
      "-hide_banner", "-nostats", "-v", "error", "-i", ruta, "-map", "0:v:0",
      "-vf", `fps=${MUESTRAS_POR_S},crop=${z.w}:${z.h}:${z.x}:${z.y},format=gray`,
      "-f", "rawvideo", "pipe:1",
    ])
    if (r.codigo !== 0) throw new Error(`ffmpeg salió con ${r.codigo}: ${cola(r.stderr) || "sin mensaje"}`)
    const tam = z.w * z.h
    if (!r.stdout.length || r.stdout.length % tam !== 0)
      throw new Error(`ffmpeg devolvió ${r.stdout.length} bytes, que no son cuadros de ${z.w}×${z.h}`)
    const muestras: Uint8Array[] = []
    for (let i = 0; i < r.stdout.length; i += tam) muestras.push(new Uint8Array(r.stdout.buffer, r.stdout.byteOffset + i, tam))
    m.etiqueta = analizarEtiqueta(muestras, z.w, z.h, MUESTRAS_POR_S)
  } catch (e) {
    fallo(errores, "la etiqueta", (e as Error).message)
  }
  return m
}

export interface OpcionesRevision {
  env: Entorno
  /** Las tomas del motor con su duración (TOMAS_CINE): suman los quietos permitidos. */
  tomas?: ReadonlyArray<TomaConDuracion>
  /** El WebGL que informó el render. */
  renderer?: string | null
  puertos?: PuertosMedir
}

/** Mide y decide. Nunca tira: lo que no se pudo medir sale como motivo de rechazo. */
export async function revisarVideo(ruta: string, ep: Episodio, o: OpcionesRevision): Promise<ResultadoCalidad> {
  const esp = esperadoDe(ep, o.tomas ?? [])
  const { reglas, avisos } = reglasDe(o.env)
  const m = await medirVideo(ruta, esp, o.puertos ?? puertosDeVerdad(o.env), o.renderer ?? null)
  return decidir(esp, m, reglas, avisos)
}
