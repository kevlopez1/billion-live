// Corre con: npx tsx lib/fabrica/redes/x.test.ts
// Sin red: fetch es una red de mentira (falso.ts) que anota cada llamada.

import assert from "node:assert/strict"
import { textoDe } from "../textos"
import type { VideoParaRed } from "../tipos"
import { FICCION_PRUEBA, ctxFalso, json, prueba, redFalsa, terminar } from "./falso"
import { clasificarX, crearX, renovarX } from "./x"

const ahora = new Date("2026-11-12T16:00:00Z")
const titulo = "Sun Tzu y la reunión de las 9"
const textoX = textoDe({ titulo, pilar: "consejo" }, "x")
const video: VideoParaRed = {
  videoId: "v1",
  envioId: "e1",
  red: "x",
  titulo,
  texto: textoX,
  archivo: "2026-11-12/v1.mp4",
  duracionS: 70,
  formato: "16:9",
  horaSalida: "2026-11-12T16:00:00Z",
  idRed: null,
  contenedor: null,
  mediaId: "m1",
  publishAt: null,
}
const sinEspera = { dormir: async () => {} }

async function main() {
  await prueba("clasificar: tabla de casos", () => {
    const casos: [number, unknown, string][] = [
      [429, { title: "Too Many Requests", detail: "Too Many Requests" }, "no_hoy"],
      [403, { detail: "You are not allowed to create a Tweet with duplicate content." }, "ambiguo"],
      [401, { title: "Unauthorized" }, "fatal"],
      [402, { title: "CreditsDepleted" }, "fatal"],
      [403, { detail: "You are not permitted to perform this action." }, "fatal"],
      [400, { errors: [{ message: "Invalid media id" }] }, "fatal"],
      [503, null, "reintentable"],
      [500, null, "reintentable"],
    ]
    for (const [s, c, clase] of casos) assert.equal(clasificarX(s, c), clase, `${s} ${JSON.stringify(c)}`)
  })

  await prueba("publicar: texto con URL o dominio = fatal ANTES de la red (ni token)", async () => {
    for (const malo of [`${textoX}\nhttps://kevproject.world`, `${FICCION_PRUEBA}\n\n${titulo}\n\nkevproject.world/casa-blanca\n\n#LaCasaBlancaProject #ElConsejo #Estrategia`, `${textoX} t.co/abc`]) {
      const red = redFalsa([])
      let pidioToken = false
      const c = ctxFalso(red.fetch)
      c.token = async () => {
        pidioToken = true
        return "t"
      }
      const r = await crearX(sinEspera).publicar({ ...video, texto: malo }, c)
      assert.ok(!r.ok && r.clase === "fatal" && r.codigo === "texto_invalido", JSON.stringify(r))
      assert.equal(red.llamadas.length, 0)
      assert.equal(pidioToken, false)
    }
  })

  await prueba("publicar: primera línea distinta del aviso de ficción = fatal", async () => {
    const red = redFalsa([])
    const r = await crearX(sinEspera).publicar({ ...video, texto: textoX.replace("Ficción hecha con IA.", "Ficción.") }, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "fatal")
    assert.equal(red.llamadas.length, 0)
  })

  await prueba("publicar: POST /2/tweets con el texto y la media", async () => {
    const red = redFalsa([[/^POST https:\/\/api\.x\.com\/2\/tweets$/, () => json({ data: { id: "1855", text: textoX } }, 201)]])
    const r = await crearX(sinEspera).publicar(video, ctxFalso(red.fetch))
    assert.deepEqual(r, { ok: true, idRed: "1855", enlace: "https://x.com/i/web/status/1855" })
    const c = JSON.parse(red.llamadas[0].cuerpo)
    assert.equal(c.text, textoX)
    assert.deepEqual(c.media, { media_ids: ["m1"] })
    assert.equal(red.llamadas[0].headers.authorization, "Bearer acceso-x")
  })

  await prueba("publicar: 429 (tope de 10 en 24 h) = no_hoy, con cuándo vuelve", async () => {
    const red = redFalsa([[/2\/tweets$/, () => json({ title: "Too Many Requests" }, 429, { "x-user-limit-24hour-remaining": "0", "x-user-limit-24hour-reset": "1763000000" })]])
    const r = await crearX(sinEspera).publicar(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "no_hoy" && /quedan 0/.test(r.como), JSON.stringify(r))
  })

  await prueba("publicar: sin respuesta o 503 = ambiguo (pudo haber salido); duplicado = ambiguo", async () => {
    for (const resp of [() => "colgar" as const, () => json({ title: "Service Unavailable" }, 503), () => json({ detail: "duplicate content" }, 403)]) {
      const red = redFalsa([[/2\/tweets$/, resp]])
      const x = crearX(sinEspera)
      // El corte real es de 20 s: para la prueba se usa un fetch que aborta ya.
      const c = ctxFalso(((u: string, i?: RequestInit) => red.fetch(u, { ...i, signal: AbortSignal.timeout(30) })) as typeof fetch)
      const r = await x.publicar(video, c)
      assert.ok(!r.ok && r.clase === "ambiguo", JSON.stringify(r))
    }
  })

  await prueba("publicar: sin media_id = fatal", async () => {
    const r = await crearX(sinEspera).publicar({ ...video, mediaId: null }, ctxFalso(redFalsa([]).fetch))
    assert.ok(!r.ok && r.clase === "fatal" && /media_id/.test(r.como))
  })

  await prueba("subir: initialize → append por trozos → finalize → status hasta succeeded; vence según X", async () => {
    let consultas = 0
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(25))],
      [/media\/upload\/initialize$/, () => json({ data: { id: "m9", media_key: "7_m9", expires_after_secs: 86400 } })],
      [/media\/upload\/m9\/append$/, () => new Response(null, { status: 204 })],
      [/media\/upload\/m9\/finalize$/, () => json({ data: { id: "m9", processing_info: { state: "pending", check_after_secs: 1 } } })],
      [/media\/upload\?command=STATUS&media_id=m9/, () => {
        consultas++
        return json({ data: { id: "m9", processing_info: consultas < 2 ? { state: "in_progress", check_after_secs: 1 } : { state: "succeeded" } } })
      }],
    ])
    const r = await crearX({ ...sinEspera, trozoBytes: 10 }).subir!(video, ctxFalso(red.fetch, { ahora }))
    assert.deepEqual(r, { ok: true, mediaId: "m9", expira: "2026-11-13T16:00:00.000Z" })
    const ini = red.llamadas.find((l) => l.url.endsWith("/initialize"))!
    assert.deepEqual(JSON.parse(ini.cuerpo), { media_type: "video/mp4", total_bytes: 25, media_category: "tweet_video" })
    const appends = red.llamadas.filter((l) => l.url.endsWith("/append"))
    assert.deepEqual(appends.map((l) => l.campos.segment_index), ["0", "1", "2"])
    assert.equal(consultas, 2)
  })

  await prueba("subir: X no pudo procesar = fatal con su error", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(5))],
      [/initialize$/, () => json({ data: { id: "m9" } })],
      [/append$/, () => new Response(null, { status: 204 })],
      [/finalize$/, () => json({ data: { id: "m9", processing_info: { state: "failed", error: { message: "InvalidMedia" } } } })],
    ])
    const r = await crearX(sinEspera).subir!(video, ctxFalso(red.fetch))
    assert.ok(!r.ok && r.clase === "fatal" && /InvalidMedia/.test(r.como), JSON.stringify(r))
  })

  await prueba("subir: sin expires_after_secs se asumen 24 h y queda escrito SIN VERIFICAR", async () => {
    const red = redFalsa([
      [/^GET https:\/\/almacen/, () => new Response(new Uint8Array(5))],
      [/initialize$/, () => json({ data: { id: "m9" } })],
      [/append$/, () => new Response(null, { status: 204 })],
      [/finalize$/, () => json({ data: { id: "m9" } })],
    ])
    const c = ctxFalso(red.fetch, { ahora })
    const r = await crearX(sinEspera).subir!(video, c)
    assert.ok(r.ok && r.expira === "2026-11-13T16:00:00.000Z")
    assert.ok(c.registro.some((m) => /SIN VERIFICAR/.test(m)))
  })

  await prueba("estado: existe = público; 404 = no existe", async () => {
    const si = redFalsa([[/2\/tweets\/1855$/, () => json({ data: { id: "1855", text: "x" } })]])
    assert.equal((await crearX().estado("1855", ctxFalso(si.fetch))).visibilidad, "publico")
    const no = redFalsa([[/2\/tweets\/1855$/, () => json({ errors: [{ title: "Not Found Error", detail: "Could not find tweet" }] }, 200)]])
    assert.equal((await crearX().estado("1855", ctxFalso(no.fetch))).visibilidad, "no_existe")
  })

  await prueba("recientes: los posts del usuario desde la fecha; sin posts = lista vacía real", async () => {
    const red = redFalsa([
      [/2\/users\/me$/, () => json({ data: { id: "u1" } })],
      [/2\/users\/u1\/tweets\?/, () => json({ data: [{ id: "1855", text: textoX, created_at: "2026-11-12T16:00:01.000Z" }], meta: { result_count: 1 } })],
    ])
    const r = await crearX().recientes(new Date("2026-11-12T15:30:00Z"), ctxFalso(red.fetch, { ahora }))
    assert.ok(Array.isArray(r) && r[0].idRed === "1855" && r[0].texto.includes(titulo))
    assert.ok(red.llamadas[1].url.includes("start_time=2026-11-12T15%3A30%3A00Z"))
    const vacia = redFalsa([[/users\/u1\/tweets/, () => json({ meta: { result_count: 0 } })]])
    const r2 = await crearX().recientes(new Date(), ctxFalso(vacia.fetch, { env: { FABRICA_X_USUARIO_ID: "u1" } }))
    assert.deepEqual(r2, [])
    const rara = redFalsa([[/users\/u1\/tweets/, () => json({})]])
    const r3 = await crearX().recientes(new Date(), ctxFalso(rara.fetch, { env: { FABRICA_X_USUARIO_ID: "u1" } }))
    assert.ok(!Array.isArray(r3), "una respuesta sin data ni result_count no es 'no salió'")
  })

  await prueba("renovar: Basic auth + refresh; devuelve el refresh NUEVO; 400 = fatal con 'reautorizar'", async () => {
    const env = { FABRICA_X_CLIENT_ID: "cid", FABRICA_X_CLIENT_SECRET: "sec" }
    const bien = redFalsa([[/oauth2\/token$/, () => json({ access_token: "a2", refresh_token: "r2", expires_in: 7200, token_type: "bearer" })]])
    const r = await renovarX("r1", { fetch: bien.fetch, env })
    assert.ok(r.ok && r.acceso === "a2" && r.refresh === "r2")
    assert.equal(bien.llamadas[0].headers.authorization, `Basic ${Buffer.from("cid:sec").toString("base64")}`)
    assert.equal(bien.llamadas[0].campos.refresh_token, "r1")
    const mal = redFalsa([[/oauth2\/token$/, () => json({ error: "invalid_request", error_description: "Value passed for the token was invalid." }, 400)]])
    const r2 = await renovarX("r1", { fetch: mal.fetch, env })
    assert.ok(!r2.ok && r2.clase === "fatal" && /reautorizar/.test(r2.como))
    const colgada = redFalsa([[/oauth2\/token$/, () => "colgar"]])
    const r3 = await renovarX("r1", { fetch: ((u: string, i?: RequestInit) => colgada.fetch(u, { ...i, signal: AbortSignal.timeout(30) })) as typeof fetch, env })
    assert.ok(!r3.ok && r3.clase === "ambiguo", "un corte puede haber gastado el refresh")
  })

  terminar()
}

main()
