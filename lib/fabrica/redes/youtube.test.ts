// Corre con: npx tsx lib/fabrica/redes/youtube.test.ts
// Sin red: fetch es una red de mentira (falso.ts) que anota cada llamada.

import assert from "node:assert/strict"
import { textoDe } from "../textos"
import type { VideoParaRed } from "../tipos"
import { ctxFalso, json, prueba, redFalsa, terminar } from "./falso"
import { clasificarYouTube, crearYouTube, renovarYouTube } from "./youtube"

const ahora = new Date("2026-11-12T16:00:00Z")
const titulo = "Napoleón pierde la llave"
const video: VideoParaRed = {
  videoId: "v1",
  envioId: "e1",
  red: "youtube",
  titulo,
  texto: textoDe({ titulo, pilar: "historia" }, "youtube"),
  archivo: "2026-11-12/v1.mp4",
  duracionS: 75,
  formato: "16:9",
  horaSalida: "2026-11-12T16:00:00Z",
  idRed: null,
  contenedor: null,
  mediaId: null,
  publishAt: null,
}
const errorYT = (status: number, reason: string) => json({ error: { code: status, errors: [{ reason }], message: reason } }, status)

/** Una red de YouTube que contesta bien, con status configurable al releer. */
function youtubeBien(releer: Record<string, unknown> = { privacyStatus: "private", uploadStatus: "uploaded" }) {
  return redFalsa([
    [/^GET https:\/\/almacen\.prueba\//, () => new Response(new Uint8Array(1234))],
    [/^POST https:\/\/www\.googleapis\.com\/upload\/youtube\/v3\/videos\?uploadType=resumable/, () => new Response("", { status: 200, headers: { Location: "https://subida.prueba/sesion/1" } })],
    [/^PUT https:\/\/subida\.prueba\/sesion\/1/, () => json({ id: "yt123", status: { privacyStatus: "private", uploadStatus: "uploaded" } })],
    [/^GET https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?part=status/, () => json({ items: [{ id: "yt123", status: releer }] })],
    [/^PUT https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?part=status/, (l) => json({ id: "yt123", status: JSON.parse(l.cuerpo).status })],
  ])
}

async function main() {
  await prueba("clasificar: tabla de casos", () => {
    const casos: [number, unknown, string][] = [
      [403, { error: { errors: [{ reason: "quotaExceeded" }] } }, "no_hoy"],
      [400, { error: { errors: [{ reason: "uploadLimitExceeded" }] } }, "no_hoy"],
      [403, { error: { errors: [{ reason: "rateLimitExceeded" }] } }, "reintentable"],
      [500, { error: { errors: [{ reason: "backendError" }] } }, "reintentable"],
      [503, null, "reintentable"],
      [429, null, "reintentable"],
      [401, { error: { errors: [{ reason: "authError" }] } }, "fatal"],
      [400, { error: "invalid_grant" }, "fatal"],
      [403, { error: { errors: [{ reason: "forbidden" }] } }, "fatal"],
      [404, { error: { errors: [{ reason: "videoNotFound" }] } }, "fatal"],
    ]
    for (const [s, c, clase] of casos) assert.equal(clasificarYouTube(s, c), clase, `${s} ${JSON.stringify(c)}`)
  })

  await prueba("subir: privado, SIN publishAt, con containsSyntheticMedia = true, y relee el estado", async () => {
    const red = youtubeBien()
    const c = ctxFalso(red.fetch, { ahora })
    const r = await crearYouTube().subir!(video, c)
    assert.deepEqual(r, { ok: true, idRed: "yt123" })
    const ini = red.llamadas.find((l) => l.url.includes("uploadType=resumable"))!
    const cuerpo = JSON.parse(ini.cuerpo)
    assert.equal(cuerpo.status.containsSyntheticMedia, true)
    assert.equal(cuerpo.status.privacyStatus, "private")
    assert.equal(cuerpo.status.selfDeclaredMadeForKids, false)
    assert.equal(cuerpo.status.publishAt, undefined)
    assert.equal(ini.headers["x-upload-content-length"], "1234")
    assert.equal(ini.headers.authorization, "Bearer acceso-youtube")
    assert.ok(cuerpo.snippet.description.startsWith("Ficción hecha con IA."))
    assert.ok(red.llamadas.some((l) => l.metodo === "GET" && l.url.includes("/videos?part=status")), "no releyó el estado")
    assert.ok(c.registro.some((m) => /privacyStatus=private/.test(m)), "no dejó el cómo en el log")
  })

  await prueba("subir: los bytes sin respuesta = ambiguo (pudo quedar subido)", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(10))],
      [/uploadType=resumable/, () => new Response("", { status: 200, headers: { Location: "https://subida.prueba/s" } })],
      [/^PUT https:\/\/subida/, () => "colgar"],
    ])
    const r = await crearYouTube({ msSubida: 50 }).subir!(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "ambiguo", JSON.stringify(r))
    assert.match(r.ok ? "" : r.como, /sin respuesta/)
  })

  await prueba("subir: un 503 con los bytes ya mandados también es ambiguo", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(10))],
      [/uploadType=resumable/, () => new Response("", { status: 200, headers: { Location: "https://subida.prueba/s" } })],
      [/^PUT https:\/\/subida/, () => errorYT(503, "backendError")],
    ])
    const r = await crearYouTube().subir!(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "ambiguo", JSON.stringify(r))
  })

  await prueba("subir: quotaExceeded al abrir la sesión = no_hoy, con el cuerpo de Google en el cómo", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(10))],
      [/uploadType=resumable/, () => errorYT(403, "quotaExceeded")],
    ])
    const r = await crearYouTube().subir!(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "no_hoy" && r.codigo === "quotaExceeded" && /quotaExceeded/.test(r.como), JSON.stringify(r))
  })

  await prueba("subir: error de DNS antes de mandar = reintentable", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(10))],
      [/uploadType=resumable/, () => "sin_red"],
    ])
    const r = await crearYouTube().subir!(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "reintentable" && /ENOTFOUND/.test(r.como), JSON.stringify(r))
  })

  await prueba("sin token: fatal y ninguna llamada a YouTube", async () => {
    const red = youtubeBien()
    const r = await crearYouTube().subir!(video, ctxFalso(red.fetch, { tokens: { youtube: null } }))
    assert.ok(!r.ok && r.clase === "fatal")
    assert.equal(red.llamadas.filter((l) => l.url.includes("googleapis")).length, 0)
  })

  await prueba("sin token porque la base falló (tokenFallo reintentable): reintentable, no fatal; sin cargar: no_hoy", async () => {
    for (const clase of ["reintentable", "no_hoy"] as const) {
      const red = youtubeBien()
      const c = { ...ctxFalso(red.fetch, { tokens: { youtube: null } }), tokenFallo: () => ({ ok: false as const, clase, como: `tokens: ${clase}` }) }
      const r = await crearYouTube().subir!(video, c)
      assert.ok(!r.ok && r.clase === clase && new RegExp(`tokens: ${clase}`).test(r.como), JSON.stringify(r))
      assert.equal(red.llamadas.filter((l) => l.url.includes("googleapis")).length, 0)
    }
  })

  await prueba("programar: privado + publishAt + etiqueta de IA (update reemplaza todo el status)", async () => {
    const red = youtubeBien()
    const publishAt = "2026-11-12T18:00:00.000Z"
    const r = await crearYouTube().programar!({ ...video, idRed: "yt123" }, publishAt, ctxFalso(red.fetch, { ahora }))
    assert.deepEqual(r, { ok: true })
    const up = red.llamadas.find((l) => l.metodo === "PUT" && l.url.includes("/videos?part=status"))!
    const s = JSON.parse(up.cuerpo).status
    assert.deepEqual(s, { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false, containsSyntheticMedia: true })
  })

  await prueba("programar: publishAt a más de ~3 h = fatal sin tocar la red (el interruptor tiene que alcanzarlo)", async () => {
    const red = youtubeBien()
    const r = await crearYouTube().programar!({ ...video, idRed: "yt123" }, "2026-11-12T23:00:00Z", ctxFalso(red.fetch, { ahora }))
    assert.ok(!r.ok && r.clase === "fatal" && /ventana/.test(r.como))
    assert.equal(red.llamadas.length, 0)
  })

  await prueba("publicar: si al releer sigue privado = bloqueo de proyecto sin auditar (fatal)", async () => {
    const red = youtubeBien({ privacyStatus: "private", uploadStatus: "processed" })
    const r = await crearYouTube().publicar({ ...video, idRed: "yt123" }, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "fatal" && r.codigo === "privado_bloqueado", JSON.stringify(r))
    const up = red.llamadas.find((l) => l.metodo === "PUT")!
    assert.equal(JSON.parse(up.cuerpo).status.containsSyntheticMedia, true)
  })

  await prueba("publicar: público al releer = ok con el enlace", async () => {
    const red = youtubeBien({ privacyStatus: "public", uploadStatus: "processed" })
    const r = await crearYouTube().publicar({ ...video, idRed: "yt123" }, ctxFalso(red.fetch))
    assert.deepEqual(r, { ok: true, idRed: "yt123", enlace: "https://www.youtube.com/watch?v=yt123" })
  })

  await prueba("desprogramar: privado, sin publishAt, con la etiqueta", async () => {
    const red = youtubeBien()
    const r = await crearYouTube().desprogramar!("yt123", ctxFalso(red.fetch))
    assert.deepEqual(r, { ok: true })
    const s = JSON.parse(red.llamadas[0].cuerpo).status
    assert.equal(s.privacyStatus, "private")
    assert.ok(!("publishAt" in s))
    assert.equal(s.containsSyntheticMedia, true)
  })

  await prueba("desprogramar: si YouTube devuelve publishAt todavía, no se da por hecho", async () => {
    const red = redFalsa([[/^PUT .*videos\?part=status/, () => json({ status: { privacyStatus: "private", publishAt: "2026-11-12T18:00:00Z" } })]])
    const r = await crearYouTube().desprogramar!("yt123", ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "reintentable")
  })

  await prueba("estado: público, privado, procesando, no existe", async () => {
    const casos: [unknown, string][] = [
      [{ items: [{ status: { privacyStatus: "public", uploadStatus: "processed" } }] }, "publico"],
      [{ items: [{ status: { privacyStatus: "private", uploadStatus: "processed" } }] }, "privado"],
      [{ items: [{ status: { privacyStatus: "private", uploadStatus: "uploaded" } }] }, "procesando"],
      [{ items: [{ status: { privacyStatus: "private", uploadStatus: "rejected" } }] }, "no_existe"],
      [{ items: [] }, "no_existe"],
    ]
    for (const [cuerpo, vis] of casos) {
      const red = redFalsa([[/videos\?part=status/, () => json(cuerpo)]])
      const e = await crearYouTube().estado("yt123", ctxFalso(red.fetch))
      assert.equal(e.visibilidad, vis, JSON.stringify(cuerpo))
    }
  })

  await prueba("recientes: la lista de subidas del canal (1+1 unidades), desde la fecha pedida", async () => {
    const red = redFalsa([
      [/channels\?part=contentDetails&mine=true/, () => json({ items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] })],
      [/playlistItems\?/, () =>
        json({
          items: [
            { snippet: { resourceId: { videoId: "a" }, title: titulo, description: "x", publishedAt: "2026-11-12T15:30:00Z" } },
            { snippet: { resourceId: { videoId: "b" }, title: "viejo", description: "", publishedAt: "2026-11-01T15:30:00Z" } },
          ],
        })],
    ])
    const r = await crearYouTube().recientes(new Date("2026-11-12T15:00:00Z"), ctxFalso(red.fetch))
    assert.ok(Array.isArray(r) && r.length === 1 && r[0].idRed === "a" && r[0].texto.includes(titulo), JSON.stringify(r))
    assert.ok(!red.llamadas.some((l) => l.url.includes("/search")), "search cuesta 100 unidades")
  })

  await prueba("recientes: si falla, es un Fallo (nunca una lista vacía que diga 'no salió')", async () => {
    const red = redFalsa([[/channels/, () => errorYT(500, "backendError")]])
    const r = await crearYouTube().recientes(new Date(), ctxFalso(red.fetch))
    assert.ok(!Array.isArray(r) && r.clase === "reintentable")
  })

  await prueba("subtitular: captions.insert multipart con el videoId; DNS antes de mandar = reintentable", async () => {
    const bien = redFalsa([[/captions\?part=snippet&uploadType=multipart/, () => json({ id: "cap1" })]])
    const r = await crearYouTube().subtitular("yt123", "1\n00:00:00,000 --> 00:00:02,000\nHola\n", ctxFalso(bien.fetch))
    assert.deepEqual(r, { ok: true, id: "cap1" })
    assert.ok(bien.llamadas[0].cuerpo.includes('"videoId":"yt123"') && bien.llamadas[0].headers["content-type"].startsWith("multipart/related"))
    const colgada = redFalsa([[/captions/, () => "sin_red"]])
    const r2 = await crearYouTube().subtitular("yt123", "x", ctxFalso(colgada.fetch))
    // DNS = antes de mandar: reintentable aunque no sea idempotente.
    assert.ok(!r2.ok && r2.clase === "reintentable")
  })

  await prueba("renovar: invalid_grant = fatal con 'reautorizar'; bien = acceso nuevo", async () => {
    const env = { FABRICA_YT_CLIENT_ID: "id", FABRICA_YT_CLIENT_SECRET: "s" }
    const mal = redFalsa([[/oauth2\.googleapis\.com\/token/, () => json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400)]])
    const r = await renovarYouTube("rt", { fetch: mal.fetch, env })
    assert.ok(!r.ok && r.clase === "fatal" && /reautorizar/.test(r.como) && /expired or revoked/.test(r.como), JSON.stringify(r))
    const bien = redFalsa([[/oauth2\.googleapis\.com\/token/, () => json({ access_token: "ya29", expires_in: 3599 })]])
    const r2 = await renovarYouTube("rt", { fetch: bien.fetch, env })
    assert.ok(r2.ok && r2.acceso === "ya29" && r2.refresh === undefined)
    assert.equal(bien.llamadas[0].campos.grant_type, "refresh_token")
    const sinVars = await renovarYouTube("rt", { fetch: bien.fetch, env: {} })
    assert.ok(!sinVars.ok && /FABRICA_YT_CLIENT_ID/.test(sinVars.como))
  })

  terminar()
}

main()
