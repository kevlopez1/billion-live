// Corre con: npx tsx lib/fabrica/redes/uploadpost.test.ts
// Sin red: fetch es una red de mentira (falso.ts) que anota cada llamada.

import assert from "node:assert/strict"
import { textoDe } from "../textos"
import type { VideoParaRed } from "../tipos"
import { ctxFalso, json, prueba, redFalsa, terminar } from "./falso"
import { VARIABLE_AIGC, clasificarUploadPost, crearUploadPost } from "./uploadpost"

const titulo = "Cleopatra negocia el alquiler"
const video: VideoParaRed = {
  videoId: "v1",
  envioId: "e1",
  red: "tiktok",
  titulo,
  texto: textoDe({ titulo, pilar: "camara-oculta" }, "tiktok"),
  archivo: "2026-11-12/v1.mp4",
  duracionS: 72,
  formato: "16:9",
  horaSalida: "2026-11-12T16:00:00Z",
  idRed: null,
  contenedor: null,
  mediaId: null,
  publishAt: null,
}
const env = { FABRICA_UPLOADPOST_KEY: "k", FABRICA_UPLOADPOST_USUARIO: "casablanca", [VARIABLE_AIGC]: "true" }

async function main() {
  await prueba("clasificar: tabla de casos", () => {
    const casos: [number, unknown, string][] = [
      [400, { message: "spam_risk_too_many_posts" }, "no_hoy"],
      [429, null, "no_hoy"],
      [200, { results: { tiktok: { error: "Daily limit reached" } } }, "no_hoy"],
      [401, { message: "Invalid API key" }, "fatal"],
      [400, { message: "Invalid video format" }, "fatal"],
      [502, null, "reintentable"],
    ]
    for (const [s, c, clase] of casos) assert.equal(clasificarUploadPost(s, c), clase, `${s} ${JSON.stringify(c)}`)
  })

  await prueba("TikTok apagada en código mientras is_aigc no esté probado (ni con 'false' escrito)", async () => {
    for (const valor of [undefined, "false", "0", ""]) {
      const red = redFalsa([])
      const r = await crearUploadPost().publicar(video, ctxFalso(red.fetch, { env: { ...env, [VARIABLE_AIGC]: valor } }))
      assert.ok(!r.ok && r.clase === "fatal" && r.codigo === "aigc_sin_verificar", `${valor}: ${JSON.stringify(r)}`)
      assert.equal(red.llamadas.length, 0)
    }
  })

  await prueba("publicar: manda is_aigc, la URL firmada, el texto y la clave; queda pendiente con el request_id", async () => {
    const red = redFalsa([[/^POST https:\/\/api\.upload-post\.com\/api\/upload$/, () => json({ success: true, request_id: "req-1" })]])
    const r = await crearUploadPost().publicar(video, ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.pendiente === "req-1", JSON.stringify(r))
    const l = red.llamadas[0]
    assert.equal(l.headers.authorization, "Apikey k")
    assert.equal(l.campos.is_aigc, "true")
    assert.equal(l.campos["platform[]"], "tiktok")
    assert.equal(l.campos.user, "casablanca")
    assert.equal(l.campos.video, "https://almacen.prueba/2026-11-12/v1.mp4?firma=abc")
    assert.ok(l.campos.title.startsWith("Ficción hecha con IA."))
  })

  await prueba("retomar: con el request_id se pregunta el estado, nunca se sube otra vez", async () => {
    const listo = redFalsa([[/uploadposts\/status\?request_id=req-1/, () => json({ status: "completed", results: { tiktok: { success: true, url: "https://www.tiktok.com/@casablanca/video/77" } } })]])
    const r = await crearUploadPost().publicar({ ...video, contenedor: "req-1" }, ctxFalso(listo.fetch, { env }))
    assert.deepEqual(r, { ok: true, idRed: "https://www.tiktok.com/@casablanca/video/77", enlace: "https://www.tiktok.com/@casablanca/video/77" })
    assert.ok(!listo.llamadas.some((l) => l.url.endsWith("/upload")))
    const sigue = redFalsa([[/uploadposts\/status/, () => json({ status: "in_progress" })]])
    const r2 = await crearUploadPost().publicar({ ...video, contenedor: "req-1" }, ctxFalso(sigue.fetch, { env }))
    assert.ok(!r2.ok && r2.pendiente === "req-1")
    const fallo = redFalsa([[/uploadposts\/status/, () => json({ status: "failed", results: { tiktok: { success: false, error: "video too short" } } })]])
    const r3 = await crearUploadPost().publicar({ ...video, contenedor: "req-1" }, ctxFalso(fallo.fetch, { env }))
    assert.ok(!r3.ok && r3.clase === "fatal" && /too short/.test(r3.como))
    // La ruta de estado SIN VERIFICAR da 404: no se da por fallido algo que pudo salir.
    const sinRuta = redFalsa([[/uploadposts\/status/, () => json({ message: "Not found" }, 404)]])
    const r4 = await crearUploadPost().publicar({ ...video, contenedor: "req-1" }, ctxFalso(sinRuta.fetch, { env }))
    assert.ok(!r4.ok && r4.clase === "ambiguo")
  })

  await prueba("publicar: spam_risk = no_hoy; 5xx o corte = ambiguo", async () => {
    const spam = redFalsa([[/api\/upload$/, () => json({ message: "spam_risk_too_many_posts" }, 400)]])
    const r = await crearUploadPost().publicar(video, ctxFalso(spam.fetch, { env }))
    assert.ok(!r.ok && r.clase === "no_hoy")
    const caido = redFalsa([[/api\/upload$/, () => json({ message: "Bad gateway" }, 502)]])
    const r2 = await crearUploadPost().publicar(video, ctxFalso(caido.fetch, { env }))
    assert.ok(!r2.ok && r2.clase === "ambiguo")
  })

  await prueba("estado: oEmbed 200 = público; otra cosa no prueba nada (desconocida)", async () => {
    const url = "https://www.tiktok.com/@casablanca/video/77"
    const si = redFalsa([[/tiktok\.com\/oembed/, () => json({ title: "x" })]])
    assert.equal((await crearUploadPost().estado(url, ctxFalso(si.fetch, { env }))).visibilidad, "publico")
    const no = redFalsa([[/tiktok\.com\/oembed/, () => json({}, 400)]])
    assert.equal((await crearUploadPost().estado(url, ctxFalso(no.fetch, { env }))).visibilidad, "desconocida")
  })

  await prueba("recientes: si el historial falla es un Fallo, nunca 'no salió'", async () => {
    const red = redFalsa([[/history/, () => json({ message: "no" }, 404)]])
    const r = await crearUploadPost().recientes(new Date(), ctxFalso(red.fetch, { env }))
    assert.ok(!Array.isArray(r))
  })

  terminar()
}

main()
