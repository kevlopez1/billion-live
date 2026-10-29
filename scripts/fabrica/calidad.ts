// ──────────────────────────────────────────────────────────────
// Control de calidad de un render de la fábrica, desde la terminal.
//
//   npx tsx scripts/fabrica/calidad.ts <video.mp4> <episodio.json> [--renderer "<WebGL>"] [--sin-tomas]
//
// <episodio.json>: un Episodio (components/casa-blanca/estudio/guion.ts) o
// una fila de fabrica_videos con el campo `episodio`.
// --renderer: lo que informó el render (WebGL). Sin él, aviso; con
//   FABRICA_EXIGIR_NVIDIA encendida, rechazo.
// --sin-tomas: no carga las tomas del motor (sin ellas, solo el cierre puede
//   quedar quieto: más estricto).
//
// Imprime el resultado en JSON. Sale con 0 = calidad_ok, 1 = rechazado,
// 2 = no se pudo empezar (archivo o argumentos).
// Variables: FABRICA_LIMITE_MB, FABRICA_EXIGIR_AUDIO, FABRICA_EXIGIR_NVIDIA,
// FABRICA_FFMPEG, FABRICA_FFPROBE.
// ──────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import type { TomaConDuracion } from "@/lib/fabrica/calidad"
import { revisarVideo } from "@/lib/fabrica/calidad-medir"

function args() {
  const a = process.argv.slice(2)
  const libres: string[] = []
  const o: { renderer: string | null; sinTomas: boolean } = { renderer: null, sinTomas: false }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--renderer") o.renderer = a[++i] ?? null
    else if (a[i] === "--sin-tomas") o.sinTomas = true
    else libres.push(a[i])
  }
  return { ...o, video: libres[0], episodio: libres[1] }
}

/** El Episodio, suelto o dentro de una fila. */
function leerEpisodio(ruta: string): Episodio {
  const d = JSON.parse(readFileSync(ruta, "utf8")) as { planos?: unknown; episodio?: { planos?: unknown } }
  const ep = Array.isArray(d.planos) ? d : Array.isArray(d.episodio?.planos) ? d.episodio : null
  if (!ep) throw new Error(`${ruta} no tiene un Episodio (falta "planos")`)
  return ep as Episodio
}

/** Las tomas del motor con su duración. Si no cargan, ninguna (más estricto, nunca inventadas). */
async function tomas(): Promise<TomaConDuracion[]> {
  try {
    const m = (await import("@/components/casa-blanca/escena/motor-camara")) as { TOMAS_CINE?: ReadonlyArray<TomaConDuracion> }
    if (!m.TOMAS_CINE?.length) throw new Error("motor-camara no exporta TOMAS_CINE")
    return m.TOMAS_CINE.map((t) => ({ id: t.id, duracion: t.duracion }))
  } catch (e) {
    console.error(`[fabrica/calidad] no se cargaron las tomas del motor (${(e as Error)?.message ?? e}): solo el cierre puede quedar quieto`)
    return []
  }
}

async function main() {
  const o = args()
  if (!o.video || !o.episodio) {
    console.error('Uso: npx tsx scripts/fabrica/calidad.ts <video.mp4> <episodio.json> [--renderer "<WebGL>"] [--sin-tomas]')
    process.exit(2)
  }
  let ep: Episodio
  try {
    ep = leerEpisodio(o.episodio)
  } catch (e) {
    console.error(`No se pudo leer el episodio: ${(e as Error).message}`)
    process.exit(2)
  }
  const r = await revisarVideo(o.video, ep, { env: process.env, tomas: o.sinTomas ? [] : await tomas(), renderer: o.renderer })
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(`Error: ${(e as Error)?.message ?? e}`)
  process.exit(2)
})
