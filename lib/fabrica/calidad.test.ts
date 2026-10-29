// Corre con: npx tsx lib/fabrica/calidad.test.ts
// Puro: sin red, sin base y sin ffmpeg. Las salidas de ffprobe y de los
// filtros están guardadas como texto (copiadas de corridas reales de ffmpeg 6.1).

import assert from "node:assert/strict"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import {
  analizarEtiqueta,
  decidir,
  esperadoDe,
  leerCongelados,
  leerNegros,
  leerSilencios,
  leerSonda,
  leerVolumen,
  reglasDe,
  restar,
  unir,
  type Medicion,
  type Sonda,
} from "./calidad"

let fallos = 0
function prueba(nombre: string, fn: () => void) {
  try {
    fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

// ── Datos ─────────────────────────────────────────────────────

/** 1,5 + 60 + 3 = 64,5 s; diálogo en el segundo plano. */
const EP: Episodio = {
  id: "fab-20261101-1-prueba",
  titulo: "Prueba",
  formato: "16:9",
  visor: "cine",
  planos: [
    { dur: 30, camara: { tipo: "toma", toma: "dron" } },
    { dur: 30, camara: { tipo: "lugar", lugar: "sala-guerra" }, dialogo: [{ quien: "lincoln", texto: "Hola." }, { quien: "napoleon", texto: "Adelante." }] },
  ],
}
const SIN_DIALOGO: Episodio = { ...EP, planos: EP.planos.map((p) => ({ ...p, dialogo: undefined })) }

const FFPROBE = JSON.stringify({
  streams: [
    { codec_name: "h264", codec_type: "video", width: 1920, height: 1080, sample_aspect_ratio: "1:1", pix_fmt: "yuv420p", r_frame_rate: "30/1", avg_frame_rate: "30/1", duration: "64.500000" },
    { codec_name: "aac", codec_type: "audio", channels: 2, duration: "64.480000" },
  ],
  format: { duration: "64.500000", size: "31457280" },
})

const FILTROS = `[Parsed_volumedetect_0 @ 0x55bcfb3b7b00] n_samples: 0
[silencedetect @ 0x55bcfb40d4c0] silence_start: 2.00579
[freezedetect @ 0x55bcfb997cc0] lavfi.freezedetect.freeze_start: 2
[silencedetect @ 0x55bcfb40d4c0] silence_end: 4.01054 | silence_duration: 2.00475
[blackdetect @ 0x55bcfb997ac0] black_start:2 black_end:4 black_duration:2
[freezedetect @ 0x55bcfb997cc0] lavfi.freezedetect.freeze_duration: 2
[freezedetect @ 0x55bcfb997cc0] lavfi.freezedetect.freeze_end: 4
[freezedetect @ 0x55bcfb997cc0] lavfi.freezedetect.freeze_start: 4
[Parsed_volumedetect_0 @ 0x55bcfb3b7b00] n_samples: 288768
[Parsed_volumedetect_0 @ 0x55bcfb3b7b00] mean_volume: -22.9 dB
[Parsed_volumedetect_0 @ 0x55bcfb3b7b00] max_volume: -16.1 dB
[Parsed_volumedetect_0 @ 0x55bcfb3b7b00] histogram_16db: 31`

const reglas = (env: Record<string, string> = {}) => reglasDe(env).reglas

function sondaBuena(cambios: Partial<Sonda> = {}): Sonda {
  return { ...leerSonda(FFPROBE), ...cambios }
}

/** Una medición que pasa todo; cada prueba cambia una cosa. */
function medicion(cambios: Partial<Medicion> = {}): Medicion {
  return {
    sonda: sondaBuena(),
    negros: [{ desde: 64.3, hasta: 64.5 }],
    congelados: [{ desde: 62, hasta: 64.5 }],
    volumen: { maxDb: -3, mediaDb: -20, muestras: 6_000_000, en0db: 0 },
    silencios: [],
    etiqueta: { muestras: 258, mascara: 800, ancho: 0.66, presentes: 257, sinEtiqueta: [{ desde: 64.25, hasta: 64.5 }], noEncontrada: false },
    renderer: "ANGLE (NVIDIA, Tesla T4 Direct3D11)",
    errores: [],
    ...cambios,
  }
}

const revisar = (m: Medicion, env: Record<string, string> = {}, ep: Episodio = EP) => decidir(esperadoDe(ep), m, reglas(env))
const tiene = (motivos: string[], parte: string) => assert.ok(motivos.some((x) => x.includes(parte)), `falta "${parte}" en ${JSON.stringify(motivos)}`)

// ── Lectura ───────────────────────────────────────────────────

prueba("ffprobe: tamaño, fps, códec, duración, peso y audio", () => {
  const s = leerSonda(FFPROBE)
  assert.deepEqual([s.ancho, s.alto, s.fps, s.codec, s.pixFmt, s.duracionS, s.bytes], [1920, 1080, 30, "h264", "yuv420p", 64.5, 31457280])
  assert.equal(s.audio?.codec, "aac")
})

prueba("ffprobe: sin video o sin JSON tira con el cómo", () => {
  assert.throws(() => leerSonda("no es json"), /no devolvió JSON/)
  assert.throws(() => leerSonda(JSON.stringify({ streams: [{ codec_type: "audio" }] })), /pista de video/)
})

prueba("blackdetect, freezedetect (abierto al final) y silencedetect", () => {
  assert.deepEqual(leerNegros(FILTROS, 6), [{ desde: 2, hasta: 4 }])
  assert.deepEqual(leerCongelados(FILTROS, 6), [{ desde: 2, hasta: 4 }, { desde: 4, hasta: 6 }])
  assert.deepEqual(leerSilencios(FILTROS, 6), [{ desde: 2.00579, hasta: 4.01054 }])
})

prueba("volumedetect: vale el último resumen, no el vacío", () => {
  const v = leerVolumen(FILTROS)
  assert.deepEqual(v, { maxDb: -16.1, mediaDb: -22.9, muestras: 288768, en0db: 0 })
  assert.equal(leerVolumen("[blackdetect @ 0x1] black_start:0 black_end:1"), null)
})

prueba("tramos: unir y restar", () => {
  assert.deepEqual(unir([{ desde: 3, hasta: 4 }, { desde: 0, hasta: 1 }, { desde: 1, hasta: 2 }]), [{ desde: 0, hasta: 2 }, { desde: 3, hasta: 4 }])
  assert.deepEqual(restar({ desde: 0, hasta: 10 }, [{ desde: 2, hasta: 3 }, { desde: 8, hasta: 12 }]), [{ desde: 0, hasta: 2 }, { desde: 3, hasta: 8 }])
})

// ── Lo esperado ───────────────────────────────────────────────

prueba("esperado: 16:9 a 1920×1080, 30 fps, apertura + planos + cierre", () => {
  const e = esperadoDe(EP)
  assert.deepEqual([e.ancho, e.alto, e.fps, e.duracionS], [1920, 1080, 30, 64.5])
  assert.equal(esperadoDe({ ...EP, formato: "4:3" }).ancho, 1440)
  assert.equal(e.dialogos.length, 2)
  assert.ok(e.dialogos[0].desde >= 31.5 && e.dialogos[1].hasta <= 61.5)
  assert.deepEqual(e.quietos, [{ desde: 0, hasta: 1.5 }, { desde: 61.5, hasta: 64.5 }])
})

prueba("esperado: una toma más corta que su plano suma su tramo quieto", () => {
  const e = esperadoDe(EP, [{ id: "dron", duracion: 20 }])
  // El primer plano corre desde el cuadro 0: la toma de 20 s termina en el 20 y queda quieta hasta el 31,5.
  assert.deepEqual(e.quietos, [{ desde: 0, hasta: 1.5 }, { desde: 20, hasta: 31.5 }, { desde: 61.5, hasta: 64.5 }])
})

// ── Reglas de entorno ─────────────────────────────────────────

prueba('banderas: "false" es apagado; el límite se lee en MB', () => {
  const r = reglasDe({ FABRICA_EXIGIR_AUDIO: "false", FABRICA_EXIGIR_NVIDIA: "true", FABRICA_LIMITE_MB: "200" })
  assert.equal(r.reglas.exigirAudio, false)
  assert.equal(r.reglas.exigirNvidia, true)
  assert.equal(r.reglas.limiteBytes, 200 * 1024 * 1024)
  const malo = reglasDe({ FABRICA_LIMITE_MB: "mucho" })
  assert.equal(malo.reglas.limiteBytes, 50 * 1024 * 1024)
  assert.equal(malo.avisos.length, 1)
})

// ── La decisión ───────────────────────────────────────────────

prueba("todo bien → calidad_ok (el fundido final y la tarjeta del cierre no cuentan)", () => {
  const r = revisar(medicion())
  assert.deepEqual(r.motivos, [])
  assert.equal(r.veredicto, "calidad_ok")
})

prueba("tamaño distinto al del guion → rechazado", () => {
  tiene(revisar(medicion({ sonda: sondaBuena({ ancho: 1280, alto: 720 }) })).motivos, "mide 1280×720")
  // 1440×1080 es válido, pero no para un guion 16:9.
  tiene(revisar(medicion({ sonda: sondaBuena({ ancho: 1440 }) })).motivos, "pide 1920×1080")
})

prueba("fps, códec y formato de píxel", () => {
  const r = revisar(medicion({ sonda: sondaBuena({ fps: 25, codec: "hevc", pixFmt: "yuv444p" }) }))
  tiene(r.motivos, "25 cuadros por segundo")
  tiene(r.motivos, "códec hevc")
  tiene(r.motivos, "yuv444p")
})

prueba("duración: ±0,5 s pasa, 0,6 s no", () => {
  // El fundido final se mide contra la duración real: aquí termina en 64,9.
  const fin = { negros: [], etiqueta: { muestras: 260, mascara: 800, ancho: 0.66, presentes: 259, sinEtiqueta: [{ desde: 64.75, hasta: 64.9 }], noEncontrada: false } }
  assert.deepEqual(revisar(medicion({ sonda: sondaBuena({ duracionS: 64.9 }), ...fin })).motivos, [])
  tiene(revisar(medicion({ sonda: sondaBuena({ duracionS: 65.1 }) })).motivos, "dura 65,1 s y el guion 64,5 s")
})

prueba("negro de 2 s en medio → rechazado; 0,4 s al final no", () => {
  tiene(revisar(medicion({ negros: [{ desde: 20, hasta: 22 }] })).motivos, "cuadros negros: 2,0 s de 20,0 s a 22,0 s")
  assert.equal(revisar(medicion({ negros: [{ desde: 64.1, hasta: 64.5 }] })).ok, true)
  tiene(revisar(medicion({ negros: [{ desde: 63.5, hasta: 64.5 }] })).motivos, "cuadros negros")
})

prueba("congelado: en el cierre o en una toma quieta pasa; en medio no", () => {
  tiene(revisar(medicion({ congelados: [{ desde: 10, hasta: 13 }] })).motivos, "imagen congelada")
  const esp = esperadoDe(EP, [{ id: "dron", duracion: 20 }])
  assert.equal(decidir(esp, medicion({ congelados: [{ desde: 21, hasta: 31 }] }), reglas()).ok, true)
  // Lo que sobra fuera del tramo permitido cuenta: de 31,5 a 33.
  tiene(decidir(esp, medicion({ congelados: [{ desde: 21, hasta: 33 }] }), reglas()).motivos, "1,5 s de 31,5 s a 33,0 s")
})

prueba("peso sobre el límite del almacén → rechazado", () => {
  tiene(revisar(medicion({ sonda: sondaBuena({ bytes: 60 * 1024 * 1024 }) })).motivos, "pesa 60,0 MB y el límite del almacén es 50,0 MB")
  assert.equal(revisar(medicion({ sonda: sondaBuena({ bytes: 60 * 1024 * 1024 }) }), { FABRICA_LIMITE_MB: "100" }).ok, true)
})

prueba("sin pista de audio: bloquea solo con diálogo y FABRICA_EXIGIR_AUDIO", () => {
  const sin = medicion({ sonda: sondaBuena({ audio: null }), volumen: null, silencios: null })
  const apagada = revisar(sin, { FABRICA_EXIGIR_AUDIO: "false" })
  assert.equal(apagada.ok, true)
  assert.ok(apagada.avisos.some((a) => a.includes("sin pista de audio")))
  tiene(revisar(sin, { FABRICA_EXIGIR_AUDIO: "1" }).motivos, "sin pista de audio y el guion tiene diálogo")
  assert.equal(revisar(sin, { FABRICA_EXIGIR_AUDIO: "1" }, SIN_DIALOGO).ok, true)
})

prueba("audio saturado → rechazado; un pico al tope no", () => {
  tiene(revisar(medicion({ volumen: { maxDb: 0, mediaDb: -8, muestras: 6_000_000, en0db: 5000 } })).motivos, "audio saturado")
  assert.equal(revisar(medicion({ volumen: { maxDb: 0, mediaDb: -20, muestras: 6_000_000, en0db: 3 } })).ok, true)
})

prueba("diálogo en silencio → rechazado", () => {
  const esp = esperadoDe(EP)
  tiene(revisar(medicion({ silencios: [{ desde: esp.dialogos[0].desde - 1, hasta: esp.dialogos[0].hasta + 1 }] })).motivos, "sin voz donde hay diálogo")
  tiene(revisar(medicion({ volumen: { maxDb: -91, mediaDb: -91, muestras: 1000, en0db: 0 } })).motivos, "en silencio")
})

prueba("etiqueta: falta en la apertura → rechazado; no encontrada → rechazado", () => {
  const sinApertura = medicion({ etiqueta: { muestras: 258, mascara: 800, ancho: 0.66, presentes: 252, sinEtiqueta: [{ desde: 0, hasta: 1.5 }], noEncontrada: false } })
  tiene(revisar(sinApertura).motivos, "sin etiqueta de ficción de 0,0 s a 1,5 s")
  tiene(revisar(medicion({ etiqueta: { muestras: 258, mascara: 12, ancho: 0.05, presentes: 0, sinEtiqueta: [{ desde: 0, hasta: 64.5 }], noEncontrada: true } })).motivos, "no se encontró la etiqueta")
})

prueba("renderer: sin NVIDIA bloquea solo con FABRICA_EXIGIR_NVIDIA", () => {
  const swift = medicion({ renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))" })
  assert.equal(revisar(swift).ok, true)
  tiene(revisar(swift, { FABRICA_EXIGIR_NVIDIA: "sí" }).motivos, "no usó NVIDIA")
  tiene(revisar(medicion({ renderer: null }), { FABRICA_EXIGIR_NVIDIA: "on" }).motivos, "no informó")
})

prueba("lo que no se pudo medir es un motivo, nunca un pase", () => {
  const r = revisar(medicion({ negros: null, congelados: null, errores: [{ que: "los filtros", como: "ffmpeg salió con 1: Invalid data" }] }))
  tiene(r.motivos, "no se pudo medir los filtros: ffmpeg salió con 1: Invalid data")
  const sinSonda = revisar(medicion({ sonda: null, negros: null, congelados: null, volumen: null, silencios: null, etiqueta: null, errores: [{ que: "la sonda", como: "moov atom not found" }] }))
  assert.equal(sinSonda.veredicto, "rechazado")
  tiene(revisar(medicion({ volumen: null })).motivos, "no se pudo medir el volumen")
})

// ── La etiqueta en píxeles ────────────────────────────────────

/** Zona de 200×24: fondo que cambia en cada muestra y, si `con`, un "texto" fijo (rayas claras con sombra). */
function muestra(i: number, con: boolean): Uint8Array {
  const w = 200
  const h = 24
  const pix = new Uint8Array(w * h)
  let semilla = i * 7919 + 13
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) % 256) / 256
  for (let p = 0; p < pix.length; p++) pix[p] = 60 + Math.floor(azar() * 140) // escena con bordes
  if (con)
    for (let x = 40; x < 180; x += 6)
      for (let y = 8; y < 18; y++) {
        pix[y * w + x] = 240
        pix[y * w + x + 1] = 240
        pix[y * w + x + 3] = 20
      }
  return pix
}

prueba("etiqueta fija sobre una escena que cambia: presente en cada muestra", () => {
  const a = analizarEtiqueta(Array.from({ length: 40 }, (_, i) => muestra(i, true)), 200, 24)
  assert.equal(a.noEncontrada, false)
  assert.equal(a.presentes, 40)
  assert.deepEqual(a.sinEtiqueta, [])
})

prueba("etiqueta que falta los primeros 1,5 s: el tramo sale con sus segundos", () => {
  const a = analizarEtiqueta(Array.from({ length: 40 }, (_, i) => muestra(i, i >= 6)), 200, 24)
  assert.equal(a.noEncontrada, false)
  assert.deepEqual(a.sinEtiqueta, [{ desde: 0, hasta: 1.5 }])
})

prueba("sin etiqueta: la escena sola no deja máscara estable", () => {
  const a = analizarEtiqueta(Array.from({ length: 40 }, (_, i) => muestra(i, false)), 200, 24)
  assert.equal(a.noEncontrada, true)
  assert.equal(a.presentes, 0)
})

if (fallos) {
  console.log(`\n${fallos} prueba(s) fallaron`)
  process.exit(1)
}
console.log("\nTodo bien.")
