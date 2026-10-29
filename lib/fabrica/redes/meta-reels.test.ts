// Corre con: npx tsx lib/fabrica/redes/meta-reels.test.ts
// Sin red: fetch es una red de mentira (falso.ts) inyectada en lib/meta.ts.

import assert from "node:assert/strict"
import { GRAPH_VERSION, GRAPH_VERSIONES, clasificarMeta, cuerpoInstagram, graphDe, publicar as publicarMeta } from "../../meta"
import { etiquetaIA } from "../guardas"
import { textoDe } from "../textos"
import type { VideoParaRed } from "../tipos"
import { ctxFalso, json, prueba, redFalsa, terminar } from "./falso"
import { facebook, instagram } from "./meta-reels"

const titulo = "Lincoln y el contrato"
const env = { CASA_BLANCA_META_TOKEN: "token-cb", CASA_BLANCA_META_PAGE_ID: "222", META_SYSTEM_TOKEN: "token-kev", META_PAGE_ID: "111" }
const video = (red: "instagram" | "facebook"): VideoParaRed => ({
  videoId: "v1",
  envioId: "e1",
  red,
  titulo,
  texto: textoDe({ titulo, pilar: "historia" }, red),
  archivo: "2026-11-12/v1.mp4",
  duracionS: 70,
  formato: "16:9",
  horaSalida: "2026-11-12T16:00:00Z",
  idRed: null,
  contenedor: null,
  mediaId: null,
  publishAt: null,
})
const errorMeta = (code: number, sub?: number, status = 400) => json({ error: { message: `error ${code}`, code, ...(sub ? { error_subcode: sub } : {}) } }, status)

/** Meta de mentira para la cuenta casa-blanca. */
function meta(o: { usadas?: number; estado?: string; media?: () => Response } = {}) {
  return redFalsa([
    [/^GET https:\/\/graph\.facebook\.com\/v[\d.]+\/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
    [/content_publishing_limit/, () => json({ data: [{ quota_usage: o.usadas ?? 3, config: { quota_total: 100, quota_duration: 86400 } }] })],
    [/^POST .*\/ig-222\/media$/, o.media ?? (() => json({ id: "900001" }))],
    [/\/900001\?fields=status_code/, () => json({ status_code: o.estado ?? "FINISHED" })],
    [/^POST .*\/ig-222\/media_publish$/, () => json({ id: "777" })],
    [/\/777\?fields=permalink/, () => json({ permalink: "https://www.instagram.com/reel/abc/" })],
    [/^POST .*\/222\/videos$/, () => json({ id: "555" })],
  ])
}

async function main() {
  await prueba(`Graph va en ${GRAPH_VERSION} y META_GRAPH_URL lo pisa`, async () => {
    const red = meta()
    await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.ok(red.llamadas.every((l) => l.url.startsWith(`https://graph.facebook.com/${GRAPH_VERSION}/`) || l.url.startsWith("https://almacen")))
    const otra = redFalsa([[/.*/, () => json({ error: { message: "x", code: 1 } })]])
    await instagram.publicar(video("instagram"), ctxFalso(otra.fetch, { env: { ...env, META_GRAPH_URL: "https://graph.prueba/v99.0" } }))
    assert.ok(otra.llamadas[0].url.startsWith("https://graph.prueba/v99.0/222"))
  })

  await prueba("la cuenta de Kev sigue en Graph v23.0 (su flujo manual se probó con esa); la casa va en v26.0", async () => {
    assert.equal(GRAPH_VERSIONES.kev, "v23.0")
    assert.equal(GRAPH_VERSIONES["casa-blanca"], "v26.0")
    assert.equal(graphDe({}, "kev"), "https://graph.facebook.com/v23.0")
    assert.equal(graphDe({ META_GRAPH_URL: "https://g/v99.0" }, "kev"), "https://g/v99.0")
    const red = redFalsa([
      [/111\?fields=access_token/, () => json({ access_token: "pagina-111" })],
      [/111\/videos$/, () => json({ id: "1" })],
    ])
    await publicarMeta("kev", "video", "https://otra.cosa/v.mp4", "hola", ["fb"], 5_000, { fetch: red.fetch, env })
    assert.ok(red.llamadas.length >= 2 && red.llamadas.every((l) => l.url.startsWith("https://graph.facebook.com/v23.0/")), red.llamadas.map((l) => l.url).join(" "))
  })

  await prueba("instagram: media_publish falla con 5xx → pendiente con el MISMO contenedor; retomar ve PUBLISHED y no crea otro", async () => {
    // Fixture del revisor: Meta lo publicó, contestó 500 (código 2) y la relectura todavía dice FINISHED.
    const red = redFalsa([
      [/^GET .*\/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
      [/content_publishing_limit/, () => json({ data: [{ quota_usage: 1, config: { quota_total: 100 } }] })],
      [/^POST .*\/ig-222\/media$/, () => json({ id: "900001" })],
      [/\/900001\?fields=status_code/, () => json({ status_code: "FINISHED" })],
      [/^POST .*\/ig-222\/media_publish$/, () => errorMeta(2, undefined, 500)],
    ])
    const r = await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.pendiente === "900001" && r.clase === "reintentable", JSON.stringify(r))
    const red2 = meta({ estado: "PUBLISHED" })
    const r2 = await instagram.publicar({ ...video("instagram"), contenedor: r.ok ? null : (r.pendiente ?? null) }, ctxFalso(red2.fetch, { env }))
    assert.ok(r2.ok && r2.idRed === "900001", JSON.stringify(r2))
    assert.ok(!red2.llamadas.some((l) => l.url.endsWith("/ig-222/media") || l.url.endsWith("/media_publish")), "retomar creó o publicó otro")
    // Un rechazo seguro (permiso) no publicó nada: sigue siendo fatal, sin contenedor que retomar.
    const permiso = redFalsa([
      [/^GET .*\/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
      [/content_publishing_limit/, () => json({ data: [{ quota_usage: 1, config: { quota_total: 100 } }] })],
      [/^POST .*\/ig-222\/media$/, () => json({ id: "900001" })],
      [/\/900001\?fields=status_code/, () => json({ status_code: "FINISHED" })],
      [/^POST .*\/ig-222\/media_publish$/, () => errorMeta(10, undefined, 403)],
    ])
    const r3 = await instagram.publicar(video("instagram"), ctxFalso(permiso.fetch, { env }))
    assert.ok(!r3.ok && r3.clase === "fatal" && !r3.pendiente, JSON.stringify(r3))
  })

  await prueba("clasificar: tabla de códigos de Meta", () => {
    const casos: [number, unknown, string][] = [
      [400, { error: { code: 190 } }, "fatal"],
      [403, { error: { code: 10 } }, "fatal"],
      [403, { error: { code: 200 } }, "fatal"],
      [400, { error: { code: 9 } }, "no_hoy"],
      [400, { error: { code: 80002 } }, "no_hoy"],
      [400, { error: { code: 25, error_subcode: 2207042 } }, "no_hoy"],
      [500, { error: { code: 1 } }, "reintentable"],
      [500, { error: { code: 2 } }, "reintentable"],
      [400, { error: { code: 4 } }, "reintentable"],
      [400, { error: { code: 100 } }, "fatal"],
      [502, {}, "reintentable"],
    ]
    for (const [s, c, clase] of casos) assert.equal(clasificarMeta(s, c), clase, `${s} ${JSON.stringify(c)}`)
  })

  await prueba("instagram: el Reel lleva is_ai_generated=true y la cuenta es casa-blanca, nunca la de Kev", async () => {
    const red = meta()
    const r = await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.deepEqual(r, { ok: true, idRed: "777", enlace: "https://www.instagram.com/reel/abc/" })
    const c = red.llamadas.find((l) => l.url.endsWith("/ig-222/media"))!
    assert.equal(c.campos.is_ai_generated, "true")
    assert.equal(c.campos.media_type, "REELS")
    assert.equal(c.campos.video_url, "https://almacen.prueba/2026-11-12/v1.mp4?firma=abc")
    assert.ok(c.campos.caption.startsWith("Ficción hecha con IA."))
    assert.ok(red.llamadas.every((l) => !l.url.includes("/111") && !l.url.includes("token-kev") && !l.cuerpo.includes("token-kev")))
    assert.deepEqual(etiquetaIA("instagram", cuerpoInstagram("casa-blanca", "video", "u", video("instagram").texto)), [])
    // Sin el aviso de ficción como primera línea, tampoco sale (revisión del 2026-10-29).
    assert.ok(etiquetaIA("instagram", cuerpoInstagram("casa-blanca", "video", "u", "")).length > 0)
    // La cuenta de Kev sigue igual: sin el parámetro (salvo un video de la casa, que es ficción con IA).
    assert.equal(cuerpoInstagram("kev", "video", "u", "t").is_ai_generated, undefined)
  })

  await prueba("instagram: lee content_publishing_limit ANTES de crear el contenedor; lleno = no_hoy sin crear nada", async () => {
    const red = meta({ usadas: 100 })
    const r = await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.clase === "no_hoy" && r.codigo === "content_publishing_limit", JSON.stringify(r))
    assert.ok(!red.llamadas.some((l) => l.url.endsWith("/media")))
    const bien = meta()
    await instagram.publicar(video("instagram"), ctxFalso(bien.fetch, { env }))
    const iTope = bien.llamadas.findIndex((l) => l.url.includes("content_publishing_limit"))
    const iMedia = bien.llamadas.findIndex((l) => l.url.endsWith("/media"))
    assert.ok(iTope >= 0 && iMedia > iTope)
  })

  await prueba("instagram: tope de Meta 2207042 al crear = no_hoy con código", async () => {
    const red = meta({ media: () => errorMeta(25, 2207042) })
    const r = await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.clase === "no_hoy" && r.codigo === "25/2207042", JSON.stringify(r))
  })

  await prueba("instagram: token vencido (190) = fatal con el mensaje de Meta", async () => {
    const red = redFalsa([[/222\?fields=access_token/, () => errorMeta(190)]])
    const r = await instagram.publicar(video("instagram"), ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.clase === "fatal" && /error 190/.test(r.como) && r.codigo === "190", JSON.stringify(r))
  })

  await prueba("instagram: si Meta sigue procesando, vuelve pendiente con el contenedor; retomar no crea otro", async () => {
    const red = meta({ estado: "IN_PROGRESS" })
    const c = ctxFalso(red.fetch, { env })
    const inicio = Date.now()
    const r = await instagram.publicar(video("instagram"), c)
    assert.ok(!r.ok && r.pendiente === "900001", JSON.stringify(r))
    assert.ok(Date.now() - inicio < 25_000, "el tick necesita que publicar termine antes de 25 s")
    const red2 = meta({ estado: "FINISHED" })
    const r2 = await instagram.publicar({ ...video("instagram"), contenedor: "900001" }, ctxFalso(red2.fetch, { env }))
    assert.ok(r2.ok)
    assert.ok(!red2.llamadas.some((l) => l.url.endsWith("/ig-222/media")), "retomar creó otro contenedor")
  })

  await prueba("instagram: contenedor caído (ERROR/EXPIRED) = fatal, no se retoma en bucle", async () => {
    const red = meta({ estado: "EXPIRED" })
    const r = await instagram.publicar({ ...video("instagram"), contenedor: "900001" }, ctxFalso(red.fetch, { env }))
    assert.ok(!r.ok && r.clase === "fatal" && !r.pendiente)
  })

  await prueba("facebook: /videos con file_url; sin respuesta = ambiguo (la cola mira recientes antes)", async () => {
    const red = meta()
    const r = await facebook.publicar(video("facebook"), ctxFalso(red.fetch, { env }))
    assert.ok(r.ok && r.idRed === "555")
    const fb = red.llamadas.find((l) => l.url.endsWith("/222/videos"))!
    assert.equal(fb.campos.file_url, "https://almacen.prueba/2026-11-12/v1.mp4?firma=abc")
    assert.ok(fb.campos.description.startsWith("Ficción hecha con IA."))
    const colgada = redFalsa([
      [/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
      [/222\/videos$/, () => "colgar"],
    ])
    const r2 = await facebook.publicar(video("facebook"), ctxFalso(colgada.fetch, { env }))
    assert.ok(!r2.ok && r2.clase === "ambiguo", JSON.stringify(r2))
  })

  await prueba("recientes: videos de la página / media de Instagram desde la fecha", async () => {
    const red = redFalsa([
      [/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
      [/222\/videos\?fields=/, () =>
        json({ data: [{ id: "555", description: `x ${titulo}`, created_time: "2026-11-12T16:00:05+0000" }, { id: "1", description: "viejo", created_time: "2026-10-01T00:00:00+0000" }] })],
      [/ig-222\/media\?fields=/, () => json({ data: [{ id: "777", caption: titulo, timestamp: "2026-11-12T16:00:05+0000" }] })],
    ])
    const c = ctxFalso(red.fetch, { env })
    const fb = await facebook.recientes(new Date("2026-11-12T15:30:00Z"), c)
    assert.ok(Array.isArray(fb) && fb.length === 1 && fb[0].idRed === "555", JSON.stringify(fb))
    const ig = await instagram.recientes(new Date("2026-11-12T15:30:00Z"), c)
    assert.ok(Array.isArray(ig) && ig[0].idRed === "777")
    const caida = redFalsa([[/222\?fields=access_token/, () => errorMeta(2, undefined, 500)]])
    const r = await facebook.recientes(new Date(), ctxFalso(caida.fetch, { env }))
    assert.ok(!Array.isArray(r) && r.clase === "reintentable")
  })

  await prueba("estado: Facebook publicado / no publicado / procesando; Instagram existe", async () => {
    const casos: [unknown, string][] = [
      [{ id: "555", published: true, status: { video_status: "ready" } }, "publico"],
      [{ id: "555", published: false, status: { video_status: "ready" } }, "privado"],
      [{ id: "555", published: true, status: { video_status: "processing" } }, "procesando"],
    ]
    for (const [cuerpo, vis] of casos) {
      const red = redFalsa([
        [/222\?fields=access_token/, () => json({ access_token: "pagina-222" })],
        [/555\?fields=/, () => json(cuerpo)],
      ])
      assert.equal((await facebook.estado("555", ctxFalso(red.fetch, { env }))).visibilidad, vis)
    }
    const borrado = redFalsa([
      [/222\?fields=access_token/, () => json({ access_token: "pagina-222" })],
      [/555\?fields=/, () => errorMeta(100, 33)],
    ])
    assert.equal((await facebook.estado("555", ctxFalso(borrado.fetch, { env }))).visibilidad, "no_existe")
    const ig = redFalsa([
      [/222\?fields=access_token/, () => json({ access_token: "pagina-222", instagram_business_account: { id: "ig-222" } })],
      [/777\?fields=id/, () => json({ id: "777", permalink: "p" })],
    ])
    assert.equal((await instagram.estado("777", ctxFalso(ig.fetch, { env }))).visibilidad, "publico")
  })

  await prueba("sin almacén: fatal antes de tocar Meta", async () => {
    const red = meta()
    const c = ctxFalso(red.fetch, { env })
    c.almacen = null
    const r = await instagram.publicar(video("instagram"), c)
    assert.ok(!r.ok && r.clase === "fatal" && /almac/.test(r.como))
    assert.equal(red.llamadas.length, 0)
  })

  terminar()
}

main()
