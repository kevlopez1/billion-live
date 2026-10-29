// Corre con: npx tsx lib/fabrica/calidad-medir.test.ts
// Sin red ni base. Necesita ffmpeg y ffprobe (en la VM y aquí están en /usr/bin):
// arma videos chicos con lavfi (uno bueno, uno con un hueco negro de 2 s, uno
// congelado, uno de otro tamaño, sin etiqueta, con la etiqueta tarde y con
// audio malo) y mira el veredicto. Si falta ffmpeg, FALLA: una prueba que se
// salta el caso difícil da una confianza que no existe.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { revisarVideo } from "./calidad-medir"
import type { ResultadoCalidad } from "./calidad"

let fallos = 0
async function prueba(nombre: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

const LETRA = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find((f) => existsSync(f))

/** 1,5 + 3 + 3 = 7,5 s a 10 cuadros por segundo (para que la prueba sea rápida), con una línea de diálogo. */
const EP: Episodio = {
  id: "fab-prueba-calidad",
  titulo: "Prueba",
  formato: "16:9",
  visor: "cine",
  fps: 10,
  planos: [{ dur: 3, camara: { tipo: "lugar", lugar: "sala-guerra" }, dialogo: [{ quien: "lincoln", texto: "Hola." }] }],
}
const DUR = 7.5

interface Receta {
  ancho?: number
  alto?: number
  /** Fondo fijo (congelado) en vez de uno que se mueve. */
  fijo?: boolean
  /** Negro sólido entre estos segundos (between de ffmpeg incluye las dos puntas). */
  negro?: [number, number]
  /** La etiqueta desde este segundo; null = sin etiqueta. */
  etiquetaDesde?: number | null
  /** Audio: tono, saturado o silencio; sin campo = sin pista. */
  audio?: "tono" | "saturado" | "silencio"
}

/** La etiqueta como la dibuja compositor.ts: blanca al 72 %, con sombra, abajo a la derecha sobre el margen del 5 %. */
function etiqueta(desde: number) {
  const f = `fontfile=${LETRA}:text='FICCIÓN HECHA CON IA':fontsize=h*20/1080:fontcolor=white@0.72:shadowcolor=black@0.85:shadowy=2`
  return `drawtext=${f}:x=w*0.95-tw:y=h*0.95-th${desde > 0 ? `:enable='gte(t,${desde})'` : ""}`
}

function armar(dir: string, nombre: string, r: Receta): string {
  const w = r.ancho ?? 1920
  const h = r.alto ?? 1080
  const fondo = r.fijo ? `color=c=0x4a6fa5:s=${w}x${h}:r=10:d=${DUR}` : `testsrc2=s=${w}x${h}:r=10:d=${DUR},noise=alls=10:allf=t`
  const filtros = [fondo]
  if (r.negro) filtros.push(`drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,${r.negro[0]},${r.negro[1]})'`)
  if (r.etiquetaDesde !== null) filtros.push(etiqueta(r.etiquetaDesde ?? 0))
  const args = ["-hide_banner", "-v", "error", "-y", "-f", "lavfi", "-i", filtros.join(",")]
  if (r.audio === "tono") args.push("-f", "lavfi", "-i", `sine=f=440:r=48000:d=${DUR},volume=-12dB`)
  if (r.audio === "saturado") args.push("-f", "lavfi", "-i", `aevalsrc=1.4*sin(2*PI*440*t):s=48000:d=${DUR}`)
  if (r.audio === "silencio") args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono:d=${DUR}`)
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p")
  if (r.audio) args.push("-c:a", "aac", "-shortest")
  const salida = join(dir, `${nombre}.mp4`)
  args.push(salida)
  const p = spawnSync("ffmpeg", args, { encoding: "utf8" })
  if (p.status !== 0) throw new Error(`ffmpeg no armó ${nombre}: ${p.error?.message ?? p.stderr}`)
  return salida
}

const NVIDIA = "ANGLE (NVIDIA, Tesla T4 Direct3D11 vs_5_0 ps_5_0)"
const revisar = (ruta: string, env: Record<string, string> = {}) => revisarVideo(ruta, EP, { env, renderer: NVIDIA })

function tiene(r: ResultadoCalidad, parte: string) {
  assert.equal(r.veredicto, "rechazado", `tenía que rechazarse: ${JSON.stringify(r.motivos)}`)
  assert.ok(r.motivos.some((m) => m.includes(parte)), `falta "${parte}" en ${JSON.stringify(r.motivos)}`)
}

async function main() {
  for (const bin of ["ffmpeg", "ffprobe"]) {
    const v = spawnSync(bin, ["-version"], { encoding: "utf8" })
    if (v.status !== 0) {
      console.log(`FALLA ${bin} no está instalado (${v.error?.message ?? v.stderr}): estas pruebas lo necesitan`)
      process.exit(1)
    }
  }
  if (!LETRA) {
    console.log("FALLA no hay una letra .ttf para dibujar la etiqueta (Liberation o DejaVu)")
    process.exit(1)
  }
  const dir = mkdtempSync(join(tmpdir(), "fabrica-calidad-"))
  try {
    const bueno = armar(dir, "bueno", { audio: "tono" })

    await prueba("bueno: 1920×1080, 7,5 s, H.264, con etiqueta y voz → calidad_ok", async () => {
      const r = await revisar(bueno)
      assert.deepEqual(r.motivos, [])
      assert.equal(r.veredicto, "calidad_ok")
      assert.equal(r.medido.etiqueta?.presentes, r.medido.etiqueta?.muestras)
    })

    await prueba("hueco negro de 2 s → rechazado", async () => {
      tiene(await revisar(armar(dir, "negro", { negro: [3, 4.95], audio: "tono" })), "cuadros negros: 2,0 s")
    })

    await prueba("congelado → rechazado", async () => {
      tiene(await revisar(armar(dir, "congelado", { fijo: true, audio: "tono" })), "imagen congelada")
    })

    await prueba("otro tamaño (1280×720) → rechazado", async () => {
      tiene(await revisar(armar(dir, "chico", { ancho: 1280, alto: 720, audio: "tono" })), "mide 1280×720")
    })

    await prueba("sin etiqueta de ficción → rechazado", async () => {
      tiene(await revisar(armar(dir, "sin-etiqueta", { etiquetaDesde: null, audio: "tono" })), "no se encontró la etiqueta")
    })

    await prueba("etiqueta desde el segundo 1,5 → rechazado con el tramo", async () => {
      tiene(await revisar(armar(dir, "etiqueta-tarde", { etiquetaDesde: 1.5, audio: "tono" })), "sin etiqueta de ficción de 0,0 s a 1,5 s")
    })

    await prueba("audio saturado → rechazado", async () => {
      tiene(await revisar(armar(dir, "saturado", { audio: "saturado" })), "audio saturado")
    })

    await prueba("pista de audio en silencio con diálogo → rechazado", async () => {
      tiene(await revisar(armar(dir, "mudo", { audio: "silencio" })), "en silencio")
    })

    const sinAudio = armar(dir, "sin-audio", {})
    await prueba('sin pista de audio: FABRICA_EXIGIR_AUDIO="false" avisa, "true" rechaza', async () => {
      const apagada = await revisar(sinAudio, { FABRICA_EXIGIR_AUDIO: "false" })
      assert.equal(apagada.veredicto, "calidad_ok", JSON.stringify(apagada.motivos))
      assert.ok(apagada.avisos.some((a) => a.includes("sin pista de audio")))
      tiene(await revisar(sinAudio, { FABRICA_EXIGIR_AUDIO: "true" }), "sin pista de audio")
    })

    await prueba("peso sobre FABRICA_LIMITE_MB → rechazado", async () => {
      tiene(await revisar(bueno, { FABRICA_LIMITE_MB: "0.01" }), "límite del almacén")
    })

    await prueba("archivo roto → rechazado con el cómo, sin tirar", async () => {
      tiene(await revisar(join(dir, "no-existe.mp4")), "no se pudo medir la sonda: ffprobe salió con 1")
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  if (fallos) {
    console.log(`\n${fallos} prueba(s) fallaron`)
    process.exit(1)
  }
  console.log("\nTodo bien.")
}

main()
