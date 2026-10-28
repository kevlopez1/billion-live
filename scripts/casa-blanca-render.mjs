#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// Renderiza un episodio de La Casa Blanca Project a MP4, cuadro por cuadro.
//
//   node scripts/casa-blanca-render.mjs --ep muestra --formato 16:9 --calidad media --out muestra-16x9.mp4
//
// Opciones:
//   --ep <id>              episodio del calendario (components/casa-blanca/estudio/episodios.ts) o "muestra"
//   --formato 16:9|4:3     1920×1080 o 1440×1080 (por defecto, el del guion)
//   --visor cine|camara    fuerza el visor de todo el episodio (por defecto, el del guion)
//   --calidad baja|media|alta   (por defecto media)
//   --out <archivo.mp4>    (por defecto <ep>-<formato>.mp4)
//   --desde <s> --hasta <s>     solo un tramo (los cuadros anteriores se simulan igual: el tramo sale idéntico al del video entero)
//   --url http://localhost:3110 la web (npm run dev)
//   --hashes <archivo>     escribe el md5 de cada cuadro (para comprobar que dos renders son iguales)
//   --verbose              muestra la consola de la página
//
// Cómo funciona: abre /casa-blanca/estudio?render=1 en Chromium (Playwright),
// espera window.__estudio.listo y pide cada cuadro con __estudio.cuadro(i):
// el estudio avanza exactamente 1/fps de video y compone el cuadro en un
// canvas. Cada cuadro sale como JPEG (calidad 0,92) y entra por un pipe a
// ffmpeg, que arma H.264 yuv420p, CRF 20, preset medium, +faststart, sin audio.
// Mismo episodio y misma calidad = mismos cuadros (la simulación usa una
// semilla fija y nada visible lee el reloj de la computadora).
//
// En una máquina sin GPU, Chromium dibuja WebGL por software (SwiftShader): es
// lento (segundos por cuadro). Con GPU real conviene grabar desde la página
// (botón "Grabar") o correr este script en esa máquina.
// ──────────────────────────────────────────────────────────────

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

function args() {
  const a = process.argv.slice(2)
  const o = { calidad: "media", url: "http://localhost:3110" }
  for (let i = 0; i < a.length; i++) {
    const k = a[i]
    if (!k.startsWith("--")) continue
    const clave = k.slice(2)
    if (clave === "verbose") o.verbose = true
    else o[clave] = a[++i]
  }
  return o
}

function cargarPlaywright() {
  for (const ruta of ["playwright", "/opt/node-tools/node_modules/playwright", "playwright-core"]) {
    try {
      return require(ruta)
    } catch {
      // siguiente
    }
  }
  throw new Error("No se encontró Playwright. Instálalo con: npm i -D playwright && npx playwright install chromium")
}

const seg = (n) => (n < 60 ? `${n.toFixed(0)} s` : n < 3600 ? `${Math.floor(n / 60)} min ${String(Math.round(n % 60)).padStart(2, "0")} s` : `${(n / 3600).toFixed(1)} h`)

async function main() {
  const o = args()
  if (!o.ep) {
    console.error("Falta --ep <id>. Ejemplo: node scripts/casa-blanca-render.mjs --ep muestra --formato 16:9 --out muestra.mp4")
    process.exit(2)
  }
  if (o.formato && o.formato !== "16:9" && o.formato !== "4:3") throw new Error(`--formato ${o.formato}: va 16:9 o 4:3`)
  if (!["baja", "media", "alta"].includes(o.calidad)) throw new Error(`--calidad ${o.calidad}: va baja, media o alta`)

  const q = new URLSearchParams({ ep: o.ep, render: "1", calidad: o.calidad })
  if (o.formato) q.set("formato", o.formato)
  if (o.visor) q.set("visor", o.visor)
  const url = `${o.url.replace(/\/$/, "")}/casa-blanca/estudio?${q}`

  const { chromium } = cargarPlaywright()
  const navegador = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  })
  let ffmpeg = null
  let renderEmpezado = false
  let recargada = false
  try {
    // La ventana es chica a propósito: el cuadro se arma en un canvas propio de W×H, no en la pantalla.
    const pagina = await navegador.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 })
    pagina.on("pageerror", (e) => console.error(`\n[página] ${e.message}`))
    // Con "npm run dev", un cambio en cualquier archivo recarga módulos en caliente
    // y reinicia el estudio a mitad del video. El socket de recarga se intercepta y
    // nunca recibe nada: lo que se filma es lo que había al abrir la página.
    if (pagina.routeWebSocket) await pagina.routeWebSocket(/_next\/webpack-hmr|turbopack-hmr|__nextjs/, () => {})
    pagina.on("framenavigated", (f) => {
      if (f === pagina.mainFrame() && renderEmpezado) recargada = true
    })
    if (o.verbose) pagina.on("console", (m) => console.error(`[consola ${m.type()}] ${m.text()}`))
    const t0 = Date.now()
    console.error(`Abriendo ${url}`)
    await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 600_000 })
    await pagina.waitForFunction(() => !!window.__estudio, null, { timeout: 600_000 })
    const info = await pagina.evaluate(() => window.__estudio.listo)
    const { ancho, alto, fps, cuadros, duracion, avisos } = info
    console.error(`Listo en ${seg((Date.now() - t0) / 1000)}: ${info.ep} · ${info.formato} · ${ancho}×${alto} · ${fps} fps · ${cuadros} cuadros (${duracion.toFixed(2)} s)`)
    for (const a of avisos ?? []) console.error(`  aviso: ${a}`)

    const desde = o.desde ? Math.max(0, Math.floor(Number(o.desde) * fps + 1e-6)) : 0
    const hasta = o.hasta ? Math.min(cuadros, Math.round(Number(o.hasta) * fps)) : cuadros
    if (!(hasta > desde)) throw new Error(`tramo vacío: cuadros ${desde}…${hasta}`)
    const out = o.out ?? `${info.ep}-${info.formato.replace(":", "x")}.mp4`

    ffmpeg = spawn(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-r", String(fps), "-movflags", "+faststart", "-an", out,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    )
    const terminado = new Promise((ok, mal) => {
      ffmpeg.on("error", mal)
      ffmpeg.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con código ${c}`))))
    })
    const escribir = (buf) => new Promise((ok) => (ffmpeg.stdin.write(buf) ? ok() : ffmpeg.stdin.once("drain", ok)))

    const hashes = []
    const total = hasta - desde
    const tRender = Date.now()
    if (desde > 0) console.error(`Simulando los ${desde} cuadros anteriores al tramo (sin guardarlos)…`)
    const sesion = info.sesion
    renderEmpezado = true
    for (let i = desde; i < hasta; i++) {
      const r = await pagina.evaluate(async (i) => {
        const e = window.__estudio
        if (!e) return { sesion: null, datos: "" }
        await e.cuadro(i)
        return { sesion: (await e.listo).sesion, datos: e.salida.toDataURL("image/jpeg", 0.92) }
      }, i)
      if (recargada || r.sesion !== sesion) throw new Error(`la página se recargó a mitad del render (cuadro ${i}): no se mezclan dos corridas en un video. Vuelve a correrlo.`)
      const datos = r.datos
      const buf = Buffer.from(datos.slice(datos.indexOf(",") + 1), "base64")
      if (o.hashes) hashes.push(`${i}\t${createHash("md5").update(buf).digest("hex")}`)
      await escribir(buf)
      const hechos = i - desde + 1
      const porCuadro = (Date.now() - tRender) / 1000 / hechos
      process.stderr.write(`\rcuadro ${i + 1}/${hasta} · ${porCuadro.toFixed(2)} s/cuadro · falta ${seg(porCuadro * (total - hechos))}   `)
    }
    ffmpeg.stdin.end()
    await terminado
    const s = (Date.now() - tRender) / 1000
    console.error(`\nListo: ${out} · ${total} cuadros en ${seg(s)} (${(s / total).toFixed(2)} s/cuadro)`)
    if (o.hashes) writeFileSync(o.hashes, hashes.join("\n") + "\n")
  } finally {
    if (ffmpeg && ffmpeg.exitCode === null && !ffmpeg.stdin.writableEnded) ffmpeg.stdin.end()
    await navegador.close()
  }
}

main().catch((e) => {
  console.error(`\nError: ${e?.message ?? e}`)
  process.exit(1)
})
