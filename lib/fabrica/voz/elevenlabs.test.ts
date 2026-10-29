// Corre con: npx tsx lib/fabrica/voz/elevenlabs.test.ts
// Sin red: un fetch falso (redes/falso.ts) que contesta como ElevenLabs.

import assert from "node:assert/strict"
import { json, prueba, redFalsa, terminar } from "../redes/falso"
import { esFallo } from "../redes/http"
import { clasificarEleven, crearElevenLabs, MAX_CARACTERES_DIALOGO, segmentosDeDialogo } from "./elevenlabs"
import type { PedidoVoz } from "./tipos"

const AUDIO = Buffer.from("audio-de-prueba").toString("base64")
const esperas: number[] = []
const dormir = async (ms: number) => {
  esperas.push(ms)
}

function cliente(reglas: Parameters<typeof redFalsa>[0], tope?: number) {
  const red = redFalsa(reglas)
  const registro: string[] = []
  const c = crearElevenLabs({ fetch: red.fetch, clave: "clave-prueba", log: (m) => registro.push(m), dormir, topeCaracteres: tope })
  return { c, red, registro }
}

const dos: PedidoVoz[] = [
  { personaje: "lincoln", voiceId: "v-lin", texto: "Cuando era muchacho partía leña." },
  { personaje: "socrates", voiceId: "v-soc", texto: "¿Y eso te hizo feliz?" },
]

const dialogoOk = (extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json(
    {
      audio_base64: AUDIO,
      alignment: { characters: [], character_start_times_seconds: [0], character_end_times_seconds: [4.9] },
      voice_segments: [
        { voice_id: "v-lin", start_time_seconds: 0, end_time_seconds: 1.2, character_start_index: 0, character_end_index: 10, dialogue_input_index: 0 },
        { voice_id: "v-lin", start_time_seconds: 1.2, end_time_seconds: 2.6, character_start_index: 10, character_end_index: 33, dialogue_input_index: 0 },
        { voice_id: "v-soc", start_time_seconds: 2.9, end_time_seconds: 4.8, character_start_index: 33, character_end_index: 54, dialogue_input_index: 1 },
      ],
      ...extra,
    },
    200,
    headers,
  )

async function main() {
  await prueba("clasificar: tabla de casos", () => {
    const casos: [number, unknown, string][] = [
      [401, { detail: { status: "quota_exceeded", message: "This request exceeds your quota of 10000." } }, "no_hoy"],
      [401, { detail: { status: "invalid_api_key", message: "Invalid API key" } }, "fatal"],
      [401, { detail: { status: "missing_permissions", message: "The API key is missing the permission user_read" } }, "fatal"],
      [429, { detail: { status: "too_many_concurrent_requests", message: "Too many concurrent requests" } }, "reintentable"],
      [429, { detail: { status: "system_busy", message: "busy" } }, "reintentable"],
      [400, { detail: { status: "max_character_limit_exceeded", message: "Text is too long" } }, "fatal"],
      [400, { detail: { status: "voice_not_found", message: "A voice with that ID does not exist" } }, "fatal"],
      [402, { detail: { status: "payment_required", message: "plan" } }, "fatal"],
      [422, { detail: [{ loc: ["body", "text"], msg: "field required", type: "missing" }] }, "fatal"],
      [500, null, "reintentable"],
      [503, { detail: "Service unavailable" }, "reintentable"],
      [408, null, "reintentable"],
      [403, { detail: "Your API key's credit quota has been exceeded" }, "no_hoy"],
    ]
    for (const [s, cuerpo, esperada] of casos) assert.equal(clasificarEleven(s, cuerpo), esperada, `${s} ${JSON.stringify(cuerpo)}`)
  })

  await prueba("segmentos: una línea en varios segmentos va del primer inicio al último fin; falta una → error", () => {
    const ok = segmentosDeDialogo(
      { voice_segments: [{ dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 1 }, { dialogue_input_index: 0, start_time_seconds: 1, end_time_seconds: 2.5 }, { dialogue_input_index: 1, start_time_seconds: 2.7, end_time_seconds: 3 }] },
      2,
    )
    assert.deepEqual(ok, [
      { indice: 0, inicioS: 0, finS: 2.5, duracionS: 2.5 },
      { indice: 1, inicioS: 2.7, finS: 3, duracionS: 0.3 },
    ])
    const falta = segmentosDeDialogo({ voice_segments: [{ dialogue_input_index: 0, start_time_seconds: 0, end_time_seconds: 1 }] }, 3)
    assert.equal(typeof falta, "string")
    assert.match(falta as string, /2, 3 de 3/)
    assert.match(segmentosDeDialogo({}, 1) as string, /no trae voice_segments/)
  })

  await prueba("diálogo: manda clave, modelo y las líneas en orden; devuelve audio y la duración de cada línea", async () => {
    const { c, red } = cliente([[/POST .*\/v1\/text-to-dialogue\/with-timestamps\?output_format=mp3_44100_128$/, () => dialogoOk({}, { "character-cost": "54" })]])
    const r = await c.dialogo(dos)
    assert.ok(!esFallo(r), esFallo(r) ? r.como : "")
    if (esFallo(r)) return
    const l = red.llamadas[0]
    assert.equal(l.headers["xi-api-key"], "clave-prueba")
    const cuerpo = JSON.parse(l.cuerpo)
    assert.equal(cuerpo.model_id, "eleven_v3")
    assert.deepEqual(cuerpo.inputs, [
      { text: dos[0].texto, voice_id: "v-lin" },
      { text: dos[1].texto, voice_id: "v-soc" },
    ])
    assert.equal(Buffer.from(r.audio).toString(), "audio-de-prueba")
    assert.equal(r.lineas.length, 2)
    assert.deepEqual(r.lineas[0], { indice: 0, inicioS: 0, finS: 2.6, duracionS: 2.6 })
    assert.equal(r.lineas[1].duracionS, 1.9)
    assert.equal(r.duracionS, 4.9, "el audio dura hasta el último carácter alineado")
    assert.equal(r.creditos, 54)
    assert.match(r.como, /informado: 54/)
  })

  await prueba("diálogo: sin cabecera de costo, el costo es el estimado y lo dice", async () => {
    const { c } = cliente([[/text-to-dialogue/, () => dialogoOk()]])
    const r = await c.dialogo(dos)
    assert.ok(!esFallo(r))
    if (esFallo(r)) return
    assert.equal(r.creditos, dos[0].texto.length + dos[1].texto.length)
    assert.match(r.como, /estimado/)
  })

  await prueba("diálogo: respuesta sin voice_segments → fatal con el cómo (no se inventa la duración)", async () => {
    const { c } = cliente([[/text-to-dialogue/, () => json({ audio_base64: AUDIO })]])
    const r = await c.dialogo(dos)
    assert.ok(esFallo(r))
    if (!esFallo(r)) return
    assert.equal(r.clase, "fatal")
    assert.match(r.como, /voice_segments/)
  })

  await prueba("diálogo: un pedido de más de 2.000 caracteres no sale a la red", async () => {
    const { c, red } = cliente([[/./, () => dialogoOk()]])
    const r = await c.dialogo([{ personaje: "lincoln", voiceId: "v", texto: "a".repeat(MAX_CARACTERES_DIALOGO + 1) }])
    assert.ok(esFallo(r) && r.clase === "fatal" && /partirlo/.test(r.como))
    assert.equal(red.llamadas.length, 0)
  })

  await prueba("diálogo: 429 de concurrencia se reintenta con espera y el log dice cómo falló", async () => {
    esperas.length = 0
    let n = 0
    const { c, red, registro } = cliente([
      [/text-to-dialogue/, () => (++n < 3 ? json({ detail: { status: "too_many_concurrent_requests", message: "Too many" } }, 429) : dialogoOk())],
    ])
    const r = await c.dialogo(dos)
    assert.ok(!esFallo(r), esFallo(r) ? r.como : "")
    assert.equal(red.llamadas.length, 3)
    assert.deepEqual(esperas, [2000, 8000])
    assert.equal(registro.length, 2)
    assert.match(registro[0], /intento 1 falló.*too_many_concurrent_requests/)
    if (!esFallo(r)) assert.match(r.como, /3 intentos/)
  })

  await prueba("diálogo: 5xx tres veces → reintentable con el número de intentos; créditos agotados → no_hoy sin reintentar", async () => {
    const a = cliente([[/text-to-dialogue/, () => json({ detail: "upstream error" }, 502)]])
    const r = await a.c.dialogo(dos)
    assert.ok(esFallo(r) && r.clase === "reintentable" && /intento 3 de 3/.test(r.como) && /HTTP 502/.test(r.como))
    assert.equal(a.red.llamadas.length, 3)

    const b = cliente([[/text-to-dialogue/, () => json({ detail: { status: "quota_exceeded", message: "This request exceeds your quota" } }, 401)]])
    const r2 = await b.c.dialogo(dos)
    assert.ok(esFallo(r2) && r2.clase === "no_hoy" && r2.codigo === "quota_exceeded")
    assert.equal(b.red.llamadas.length, 1)
  })

  await prueba("tope de la tanda: se reserva antes de mandar; pasarlo es no_hoy sin tocar la red", async () => {
    const chars = dos[0].texto.length + dos[1].texto.length
    const { c, red } = cliente([[/text-to-dialogue/, () => dialogoOk()]], chars + 10)
    assert.ok(!esFallo(await c.dialogo(dos)))
    assert.equal(c.gastados(), chars)
    const r = await c.dialogo(dos)
    assert.ok(esFallo(r) && r.clase === "no_hoy" && r.codigo === "tope_tanda" && /FABRICA_VOZ_TOPE_CARACTERES/.test(r.como))
    assert.equal(red.llamadas.length, 1)
  })

  await prueba("tope: un intento que falló también cuenta (se reservó antes de mandar)", async () => {
    const chars = dos[0].texto.length + dos[1].texto.length
    const { c, red } = cliente([[/text-to-dialogue/, () => json({ detail: "boom" }, 500)]], chars * 2)
    const r = await c.dialogo(dos)
    assert.ok(esFallo(r) && r.clase === "no_hoy", "el tercer intento ya no entra en el tope")
    if (esFallo(r)) assert.match(r.como, /el intento anterior: .*HTTP 500/, "el cómo dice también por qué se gastaron")
    assert.equal(red.llamadas.length, 2)
  })

  await prueba("créditos: lee el saldo; sin permiso es un Fallo con el cómo, no un cero", async () => {
    const { c } = cliente([[/GET .*\/v1\/user\/subscription$/, () => json({ character_count: 120000, character_limit: 121000, next_character_count_reset_unix: 1794787200, tier: "creator" })]])
    const r = await c.creditos()
    assert.ok(!esFallo(r))
    if (!esFallo(r)) {
      assert.equal(r.restantes, 1000)
      assert.equal(r.plan, "creator")
      assert.equal(r.renuevaEn, new Date(1794787200 * 1000).toISOString())
    }
    const sin = cliente([[/subscription/, () => json({ detail: { status: "missing_permissions", message: "needs user_read" } }, 401)]])
    const r2 = await sin.c.creditos()
    assert.ok(esFallo(r2) && r2.clase === "fatal" && /user_read/.test(r2.como))
  })

  await prueba("diseño: valida largos antes de la red y lee las candidatas", async () => {
    const { c, red } = cliente([
      [
        /POST .*\/v1\/text-to-voice\/design\?output_format=mp3_44100_128$/,
        () =>
          json({
            previews: [
              { generated_voice_id: "g1", audio_base_64: AUDIO, duration_secs: 9.1 },
              { generated_voice_id: "g2", audio_base_64: AUDIO, duration_secs: 9.4 },
              { generated_voice_id: "g3", audio_base_64: "" },
            ],
          }),
      ],
    ])
    const corta = await c.disenar("voz grave", "x".repeat(150))
    assert.ok(esFallo(corta) && /20 a 1.000/.test(corta.como))
    const r = await c.disenar("A calm man in his fifties, neutral Latin American Spanish.", "Hola. ".repeat(30))
    assert.ok(!esFallo(r))
    if (!esFallo(r)) assert.deepEqual(r.map((x) => x.generatedVoiceId), ["g1", "g2"], "la candidata sin audio no cuenta")
    assert.equal(red.llamadas.length, 1)
    const cuerpo = JSON.parse(red.llamadas[0].cuerpo)
    assert.equal(cuerpo.model_id, "eleven_ttv_v3")
    assert.equal(cuerpo.auto_generate_text, false)
  })

  await prueba("crear voz: no se reintenta; sin voice_id es ambiguo y lo dice", async () => {
    const b = cliente([[/POST .*\/v1\/text-to-voice$/, () => json({ detail: "boom" }, 500)]])
    const r = await b.c.crearVoz("g1", "LCBP-x-c1", "A calm man, neutral Latin American Spanish.")
    assert.ok(esFallo(r) && r.clase === "reintentable")
    assert.equal(b.red.llamadas.length, 1, "crear no se repite solo")
    const ok = cliente([[/POST .*\/v1\/text-to-voice$/, () => json({ voice_id: "voz-1" })]])
    const r2 = await ok.c.crearVoz("g1", "LCBP-x-c1", "desc")
    assert.deepEqual(r2, { ok: true, voiceId: "voz-1" })
    assert.deepEqual(JSON.parse(ok.red.llamadas[0].cuerpo), { voice_name: "LCBP-x-c1", voice_description: "desc", generated_voice_id: "g1" })
    const sinId = cliente([[/POST .*\/v1\/text-to-voice$/, () => json({ name: "x" })]])
    const r3 = await sinId.c.crearVoz("g1", "LCBP-x-c1", "desc")
    assert.ok(esFallo(r3) && r3.clase === "ambiguo" && /buscarla por nombre/.test(r3.como))
  })

  await prueba("buscar voz: solo el nombre exacto", async () => {
    const { c, red } = cliente([[/GET .*\/v2\/voices\?search=LCBP-abc-c2/, () => json({ voices: [{ voice_id: "otra", name: "LCBP-abc-c22" }, { voice_id: "esta", name: "LCBP-abc-c2" }] })]])
    assert.deepEqual(await c.buscarVoz("LCBP-abc-c2"), { ok: true, voiceId: "esta" })
    assert.equal(red.llamadas.length, 1)
  })
}

main().then(terminar)
