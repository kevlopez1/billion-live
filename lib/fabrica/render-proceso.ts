// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL RENDER COMO PROCESO HIJO (la máquina con GPU)
//
// La tanda no dibuja: llama a scripts/casa-blanca-render.mjs (otro agente lo
// mantiene; aquí no se edita) con el episodio y la voz en disco, espera el
// MP4 y lee del log qué WebGL usó (para el chequeo NVIDIA de calidad.ts).
//
// ┌─ ENGANCHE PENDIENTE ─────────────────────────────────────────┐
// │ Hoy el render solo dibuja episodios del calendario (--ep <id>) │
// │ y sale SIN audio (-an). La tanda le pasa además:               │
// │   --episodio <episodio.json>  el Episodio de la fábrica        │
// │   --audio <voz.json>          tramos de audio + tiempos de     │
// │                               cada línea (voz/voces.ts)        │
// │   --renderer-log              que imprima «WebGL: <renderer>»  │
// │ Hasta que el script los lea, renderListo() dice qué falta y la │
// │ tanda NO pide voces (no se paga audio que no se va a usar).    │
// └──────────────────────────────────────────────────────────────┘
// ──────────────────────────────────────────────────────────────

import { spawn } from "node:child_process"
import type { Fallo, Log } from "./tipos"
import type { PedidoRender, Renderizar, ResultadoRender } from "./tanda"

export const SCRIPT_RENDER = "scripts/casa-blanca-render.mjs"
/** La reserva del render dura 40 min: el proceso se corta antes, a los 38. */
export const TIMEOUT_RENDER_MS = 38 * 60_000

/** Las opciones que el render tiene que entender para un video de la fábrica (el enganche). */
export const OPCIONES_FABRICA = ["--episodio", "--audio"] as const

/**
 * Qué opciones de la fábrica no nombra el código del render. Su lector de
 * argumentos acepta cualquier --clave sin quejarse: si el script no la nombra
 * (cada opción va documentada en su cabecera), la ignora y dibujaría otro
 * episodio o un video mudo.
 */
export function faltaEnElRender(fuente: string): string[] {
  return OPCIONES_FABRICA.filter((op) => !new RegExp(`${op}(?![\\w-])`).test(fuente))
}

/** Los argumentos del proceso. */
export function argsDelRender(p: PedidoRender, o: { script?: string; url: string; calidad: string }): string[] {
  const a = [o.script ?? SCRIPT_RENDER, "--ep", p.videoId, "--episodio", p.archivoEpisodio]
  if (p.archivoVoz) a.push("--audio", p.archivoVoz)
  if (p.episodio.formato) a.push("--formato", p.episodio.formato)
  a.push("--calidad", o.calidad, "--url", o.url, "--out", p.salida, "--renderer-log")
  return a
}

/** El WebGL que informó el render: la última línea «WebGL: …» o «renderer: …». */
export function rendererDeLaSalida(texto: string): string | null {
  let ultimo: string | null = null
  for (const m of texto.matchAll(/^\s*(?:\[[^\]]*\]\s*)?(?:webgl(?:\s+renderer)?|renderer)\s*[:=]\s*(.+?)\s*$/gim)) ultimo = m[1]
  return ultimo
}

export interface SalidaProceso {
  codigo: number | null
  /** stdout y stderr juntos, los últimos 64 KB. */
  texto: string
  cortado: boolean
}
export type CorrerRender = (cmd: string, args: string[], timeoutMs: number) => Promise<SalidaProceso>

/** Corre el render. Rechaza solo si no arranca (ENOENT…); un timeout lo mata y lo dice. */
export const correrRender: CorrerRender = (cmd, args, timeoutMs) =>
  new Promise((ok, mal) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let texto = ""
    let cortado = false
    const sumar = (b: Buffer) => {
      texto += b.toString("utf8")
      if (texto.length > 128_000) texto = texto.slice(-64_000)
    }
    p.stdout.on("data", sumar)
    p.stderr.on("data", sumar)
    const reloj = setTimeout(() => {
      cortado = true
      p.kill("SIGKILL")
    }, timeoutMs)
    p.on("error", (e) => {
      clearTimeout(reloj)
      mal(e)
    })
    p.on("close", (codigo) => {
      clearTimeout(reloj)
      ok({ codigo, texto: texto.slice(-64_000), cortado })
    })
  })

export interface OpcionesRender {
  /** El código del script (para el enganche). */
  leerFuente: () => string
  existe: (ruta: string) => Promise<boolean>
  url: string
  calidad: string
  node?: string
  script?: string
  correr?: CorrerRender
  timeoutMs?: number
  log: Log
}

/** ¿Puede el render hacer un video de la fábrica? null = sí; si no, qué falta (con el enganche). */
export function renderListo(o: Pick<OpcionesRender, "leerFuente" | "script">): string | null {
  let fuente: string
  try {
    fuente = o.leerFuente()
  } catch (e) {
    return `no se pudo leer ${o.script ?? SCRIPT_RENDER}: ${e instanceof Error ? e.message : e}`
  }
  const faltan = faltaEnElRender(fuente)
  return faltan.length
    ? `${o.script ?? SCRIPT_RENDER} todavía no lee ${faltan.join(" ni ")} (ENGANCHE pendiente: sin eso dibuja otro episodio o sale sin voz). No se piden voces ni se renderiza`
    : null
}

const cola = (s: string, n = 600) => s.trim().slice(-n)

export function renderConProceso(o: OpcionesRender): Renderizar {
  const correr = o.correr ?? correrRender
  const timeoutMs = o.timeoutMs ?? TIMEOUT_RENDER_MS
  return async (p): Promise<ResultadoRender> => {
    const falta = renderListo(o)
    if (falta) return { ok: false, clase: "reintentable", como: falta }
    const args = argsDelRender(p, { script: o.script, url: o.url, calidad: o.calidad })
    const cmd = o.node ?? process.execPath
    o.log(`[fabrica/render] ${p.videoId}: ${cmd} ${args.join(" ")}`)
    const t0 = Date.now()
    let s: SalidaProceso
    try {
      s = await correr(cmd, args, timeoutMs)
    } catch (e) {
      return { ok: false, clase: "fatal", como: `el render no arrancó (${cmd}): ${e instanceof Error ? e.message : e}` }
    }
    const min = ((Date.now() - t0) / 60_000).toFixed(1)
    if (s.cortado) return { ok: false, clase: "reintentable", como: `el render se cortó a los ${Math.round(timeoutMs / 60_000)} min (la reserva dura 40): ${cola(s.texto)}` } satisfies Fallo
    if (s.codigo !== 0) return { ok: false, clase: "reintentable", como: `el render salió con código ${s.codigo} a los ${min} min: ${cola(s.texto)}` }
    if (!(await o.existe(p.salida))) return { ok: false, clase: "reintentable", como: `el render terminó bien pero no dejó ${p.salida}: ${cola(s.texto, 300)}` }
    const renderer = rendererDeLaSalida(s.texto)
    if (!renderer) o.log(`[fabrica/render] ${p.videoId}: el render no informó el WebGL (calidad.ts lo avisa; con FABRICA_EXIGIR_NVIDIA, rechaza)`)
    return { ok: true, archivo: p.salida, renderer, como: `render en ${min} min${renderer ? ` con ${renderer}` : ""}` }
  }
}
