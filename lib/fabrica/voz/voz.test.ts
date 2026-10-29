// Corre con: npx tsx lib/fabrica/voz/voz.test.ts
// Sin red ni base: arquetipos y su guarda, voz falsa, registro, voces() de
// un episodio, el diseño de candidatas y la elección de Kev.

import assert from "node:assert/strict"
import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { comercialEn } from "../guardas"
import { guionBueno, copia } from "../datos-de-prueba"
import { prueba, terminar } from "../redes/falso"
import { esFallo } from "../redes/http"
import { nombradosEn, tercerosEn } from "../semaforo"
import { formasDeVoseo } from "../voseo"
import { ACENTO, ARQUETIPOS, arquetipoDe, conVoz, descripcionSegura, EVOCACIONES, hablaEnLaFabrica, muestraSegura, puedeHablarAlgunaVez } from "./arquetipos"
import { disenarVoces, elegirVoz, planDeDiseno, type Candidatas } from "./diseno"
import { crearVozFalsa, duracionDeTexto, duracionDeWav, tonoDe, wav } from "./falso"
import { aprobar, huellaDescripcion, nombreEnElServicio, registroVacio, validarRegistro, vozDe, type EntradaVoz, type RegistroVoces } from "./registro"
import type { Disenador } from "./tipos"
import { costoUsdEstimado, lineasDelEpisodio, partirEnPedidos, proveedorDesdeEnv, srt, textoParaVoz, voces, vozPublicable } from "./voces"

const DIA = "2026-11-15"
const silencio = () => {}

const entrada = (id: string, extra: Partial<EntradaVoz> = {}): EntradaVoz => ({
  voiceId: `voz-${id}`,
  proveedor: "elevenlabs",
  candidata: 2,
  generatedVoiceId: `g-${id}`,
  nombreEnElServicio: nombreEnElServicio(id, 2),
  modeloDiseno: "eleven_ttv_v3",
  huella: huellaDescripcion(arquetipoDe(id)!.descripcion),
  aprobadoPor: "kev",
  aprobadoEn: "2026-11-02T15:00:00.000Z",
  ...extra,
})

const registroCon = (...ids: string[]): RegistroVoces => ({ version: 1, voces: Object.fromEntries(ids.map((id) => [id, entrada(id)])) })

async function main() {
  // ── Arquetipos ──
  await prueba("arquetipos: uno por cada uno de los 24 residentes, sin sobrantes", () => {
    assert.equal(PERSONAJES.length, 24)
    assert.deepEqual(ARQUETIPOS.map((a) => a.id).sort(), PERSONAJES.map((p) => p.id).sort())
  })

  await prueba("arquetipos: cada descripción pasa la guarda (sin nombres, sin pistas, sin copiar el campo voz, con el acento)", () => {
    for (const a of ARQUETIPOS) {
      assert.deepEqual(descripcionSegura(a.id, a.descripcion), [], a.id)
      assert.ok(a.descripcion.includes(ACENTO), a.id)
      assert.ok(a.edad >= 18 && a.edad <= 90, `${a.id}: edad ${a.edad}`)
      assert.ok(new RegExp(`\\b(${["twenty", "thirty", "forty", "fifty", "sixty", "seventy"].join("|")})|\\d{2}s\\b|thirties|forties|fifties|sixties|seventies`, "i").test(a.descripcion), `${a.id}: la descripción dice la edad`)
      assert.ok(/energy/i.test(a.descripcion), `${a.id}: la descripción dice la energía`)
      assert.ok(/pace|delivery|sentences/i.test(a.descripcion), `${a.id}: la descripción dice el ritmo`)
    }
  })

  await prueba("muestraSegura: atrapa la frase o la anécdota de la persona real (las muestras viejas)", () => {
    assert.ok(muestraSegura("socrates", "Disculpa, amigo, yo no sé nada, por eso pregunto.").some((e) => /no se nada/.test(e)))
    assert.ok(muestraSegura("lincoln", "Cuando era muchacho partía leña antes del amanecer.").some((e) => /lena/.test(e)))
    assert.ok(muestraSegura("marco", "Recuerda que todo pasa: el aplauso de hoy.").some((e) => /todo pasa/.test(e)))
    assert.ok(muestraSegura("jesus", "Mira esa higuera: nadie la apura.").length)
    for (const id of conVoz()) assert.ok(id in EVOCACIONES, `${id}: sin lista de evocaciones (decidir cuáles)`)
  })

  await prueba("arquetipos: las muestras miden 100 a 1.000, sin nombres, sin PRIME ni el reto, sin voseo", () => {
    for (const a of ARQUETIPOS) {
      assert.ok(a.muestra.length >= 100 && a.muestra.length <= 1000, `${a.id}: ${a.muestra.length} caracteres`)
      assert.deepEqual(nombradosEn(a.muestra, PERSONAJES.map((p) => p.id)), [], `${a.id}: nombra a alguien`)
      assert.deepEqual(tercerosEn(a.muestra), [], `${a.id}: nombra a un tercero`)
      assert.deepEqual(comercialEn(a.muestra), [], `${a.id}: marca comercial`)
      assert.deepEqual(formasDeVoseo(a.muestra), [], `${a.id}: voseo`)
      if (puedeHablarAlgunaVez(a.id)) assert.deepEqual(muestraSegura(a.id, a.muestra), [], `${a.id}: la muestra evoca a la persona real`)
      assert.deepEqual(formasDeVoseo(a.resumen), [], `${a.id}: voseo en el resumen`)
      assert.ok(!/["“”]/.test(a.muestra), `${a.id}: una muestra no lleva citas entre comillas`)
    }
  })

  await prueba("guarda: frena un nombre real, una pista de identidad, el campo voz copiado y la falta de acento", () => {
    const base = `A calm man in his fifties, warm baritone, slow pace, low energy. Speaks ${ACENTO}.`
    assert.deepEqual(descripcionSegura("lincoln", base), [])
    assert.ok(descripcionSegura("lincoln", `${base} Sounds like Abraham Lincoln.`).some((e) => /Lincoln|pistas/.test(e)))
    assert.ok(descripcionSegura("kobe", `${base} A former basketball star.`).some((e) => /pistas de identidad.*basketball/.test(e)))
    assert.ok(descripcionSegura("musk", `${base} Like the man from Tesla.`).some((e) => /tesla/.test(e)))
    assert.ok(descripcionSegura("lincoln", `${base} Bezos would love it.`).some((e) => /persona real|Bezos/.test(e)))
    assert.ok(descripcionSegura("lincoln", "A calm man in his fifties, warm baritone, slow pace.").some((e) => /acento/.test(e)))
    const voz = PERSONAJES.find((p) => p.id === "suntzu")!.voz
    assert.ok(descripcionSegura("suntzu", `${voz} ${ACENTO}`).some((e) => /campo voz/.test(e)))
    assert.ok(descripcionSegura("lincoln", "corta").some((e) => /20 a 1.000/.test(e)))
  })

  await prueba("quién habla: verdes y amarillos; nunca un vivo ni alguien fuera (Trump tampoco cuando pasa a vivo)", () => {
    const hablan = conVoz().sort()
    assert.deepEqual(hablan, ["chatgpt", "claude", "cleopatra", "iluminado", "jesus", "jobs", "kobe", "leonardo", "lincoln", "marco", "mason", "napoleon", "socrates", "suntzu"])
    for (const p of PERSONAJES.filter((x) => x.real === "vivo")) {
      assert.equal(puedeHablarAlgunaVez(p.id), false, p.id)
      assert.equal(hablaEnLaFabrica(p.id, "2026-12-01"), false, p.id)
    }
    assert.equal(hablaEnLaFabrica("desconocido", DIA), false)
  })

  // ── Voz falsa ──
  await prueba("voz falsa: duraciones realistas según el largo, WAV válido y determinista", () => {
    assert.equal(duracionDeTexto("Sí."), 0.8, "piso de 0,8 s")
    const larga = "Antes de empezar cualquier pelea, pregúntate en silencio si conoces el terreno."
    const d = duracionDeTexto(larga)
    assert.ok(d > 5 && d < 7, `~14 caracteres por segundo: ${d}`)
    const a = wav([{ segundos: 1.5, hz: 220 }, { segundos: 0.5, hz: null }])
    assert.equal(Buffer.from(a.slice(0, 4)).toString(), "RIFF")
    assert.equal(Buffer.from(a.slice(8, 12)).toString(), "WAVE")
    assert.equal(duracionDeWav(a), 2)
    assert.deepEqual(a, wav([{ segundos: 1.5, hz: 220 }, { segundos: 0.5, hz: null }]))
    assert.equal(tonoDe("v-1"), tonoDe("v-1"))
    assert.ok(tonoDe("v-1") >= 140 && tonoDe("v-1") <= 400)
  })

  await prueba("voz falsa: el diálogo da la duración de cada línea y el audio dura lo mismo", async () => {
    const f = crearVozFalsa()
    const r = await f.dialogo([
      { personaje: "napoleon", voiceId: "a", texto: "Otra partida. Ahora." },
      { personaje: "suntzu", voiceId: "b", texto: "Ya perdiste tres." },
    ])
    assert.ok(!esFallo(r))
    if (esFallo(r)) return
    assert.equal(r.lineas.length, 2)
    assert.equal(r.lineas[1].inicioS, Math.round((r.lineas[0].finS + 0.2) * 100) / 100)
    assert.ok(Math.abs(duracionDeWav(r.audio) - r.duracionS) < 0.01)
    assert.equal(r.formato, "wav")
    assert.equal(r.creditos, 0)
    assert.equal(f.falso, true)
  })

  // ── Registro ──
  await prueba("registro: descarta un vivo, un desconocido y una entrada sin aprobación, y dice por qué", () => {
    const { registro, errores } = validarRegistro({
      version: 1,
      voces: { lincoln: entrada("lincoln"), musk: { ...entrada("lincoln") }, nadie: entrada("lincoln"), kobe: entrada("kobe", { aprobadoPor: "" }) },
    })
    assert.deepEqual(Object.keys(registro.voces), ["lincoln"])
    assert.ok(errores.some((e) => /musk: no habla/.test(e)))
    assert.ok(errores.some((e) => /nadie: no es un residente/.test(e)))
    assert.ok(errores.some((e) => /kobe: .*aprobadoPor/.test(e)))
    assert.deepEqual(validarRegistro({ voces: [] }).errores.length, 1)
  })

  await prueba("registro: vozDe por día; sin voz dice qué correr; descripción cambiada → aviso", () => {
    const reg = registroCon("lincoln")
    assert.deepEqual(vozDe(reg, "lincoln", DIA), { ok: true, voiceId: "voz-lincoln" })
    const sin = vozDe(reg, "socrates", DIA)
    assert.ok(!sin.ok && /disenar-voces/.test(sin.porque))
    const vivo = vozDe(reg, "musk", DIA)
    assert.ok(!vivo.ok && /no habla/.test(vivo.porque))
    const vieja = vozDe({ version: 1, voces: { lincoln: entrada("lincoln", { huella: "otra" }) } }, "lincoln", DIA)
    assert.ok(vieja.ok && /cambió/.test(vieja.aviso ?? ""))
  })

  await prueba("registro: aprobar exige quién aprobó; un vivo nunca entra", () => {
    assert.ok(aprobar(registroVacio(), "lincoln", entrada("lincoln")).ok)
    assert.ok(!aprobar(registroVacio(), "lincoln", entrada("lincoln", { aprobadoPor: " " })).ok)
    assert.ok(!aprobar(registroVacio(), "altman", entrada("lincoln")).ok)
  })

  // ── Texto y pedidos ──
  await prueba("texto para la voz: números del reto puestos y montos en palabras", () => {
    assert.equal(textoParaVoz("Llevamos $1.234 de $450.000"), "Llevamos 1234 dólares de 450000 dólares")
    assert.equal(textoParaVoz("Cuesta $12,50 *hoy*"), "Cuesta 12 coma 50 dólares hoy")
    assert.ok(!/\{|\}/.test(textoParaVoz("Van {RECAUDADO} de {META}")))
  })

  await prueba("líneas y pedidos: en orden, partidos sin pasar el tope; una línea más larga que el tope es un error", () => {
    const ls = lineasDelEpisodio(guionBueno())
    assert.deepEqual(ls.map((l) => [l.plano, l.linea, l.personaje]), [
      [1, 0, "napoleon"],
      [1, 1, "suntzu"],
      [2, 0, "suntzu"],
      [2, 1, "napoleon"],
      [4, 0, "napoleon"],
    ])
    const ps = partirEnPedidos(ls, 70)
    assert.ok(Array.isArray(ps))
    if (Array.isArray(ps)) {
      assert.deepEqual(ps.flat().map((l) => l.indice), [0, 1, 2, 3, 4])
      for (const p of ps) assert.ok(p.length === 1 || p.reduce((s, l) => s + l.texto.length, 0) <= 70)
    }
    assert.equal(typeof partirEnPedidos(ls, 20), "string")
  })

  // ── voces() ──
  await prueba("voces: con la voz falsa corre de punta a punta sin registro y marca el video como no publicable", async () => {
    const r = await voces(guionBueno(), { proveedor: crearVozFalsa(), registro: registroVacio(), dia: DIA, log: silencio })
    assert.ok(!esFallo(r), esFallo(r) ? r.como : "")
    if (esFallo(r)) return
    assert.equal(r.lineas.length, 5)
    assert.equal(r.falso, true)
    assert.equal(vozPublicable(r), false)
    assert.equal(r.tramos.length, 1)
    assert.equal(r.vozPorPlanoS.length, 5)
    assert.equal(r.vozPorPlanoS[0], 0)
    assert.equal(r.vozPorPlanoS[3], 0)
    assert.ok(r.vozPorPlanoS[1] > 0 && r.vozPorPlanoS[4] > 0)
    assert.equal(r.vozPorPlanoS[4], r.lineas[4].duracionS)
  })

  await prueba("voces: varios tramos conservan el orden y cada línea dice su tramo", async () => {
    const f = crearVozFalsa()
    const p = { ...f, maxCaracteres: 70 }
    const r = await voces(guionBueno(), { proveedor: p, registro: registroVacio(), dia: DIA, log: silencio })
    assert.ok(!esFallo(r))
    if (esFallo(r)) return
    assert.ok(r.tramos.length > 1)
    assert.deepEqual(r.lineas.map((l) => l.indice), [0, 1, 2, 3, 4])
    assert.equal(r.lineas[r.lineas.length - 1].tramo, r.tramos.length - 1)
  })

  await prueba("voces: con un proveedor real, quien no tiene voz aprobada frena todo y se dicen todos los que faltan", async () => {
    const real = { ...crearVozFalsa(), nombre: "elevenlabs" as const, falso: false }
    const r = await voces(guionBueno(), { proveedor: real, registro: registroVacio(), dia: DIA, log: silencio })
    assert.ok(esFallo(r) && r.clase === "fatal")
    if (esFallo(r)) {
      assert.match(r.como, /napoleon no tiene voz aprobada/)
      assert.match(r.como, /suntzu no tiene voz aprobada/)
    }
    const ok = await voces(guionBueno(), { proveedor: real, registro: registroCon("napoleon", "suntzu"), dia: DIA, log: silencio })
    assert.ok(!esFallo(ok))
  })

  await prueba("voces: un vivo con diálogo se frena aquí también, aunque tenga una voz anotada", async () => {
    const ep: Episodio = copia(guionBueno())
    ep.planos[1].dialogo![0].quien = "musk"
    const r = await voces(ep, { proveedor: crearVozFalsa(), registro: registroVacio(), dia: DIA, log: silencio })
    assert.ok(esFallo(r) && /musk tiene diálogo pero no habla/.test(r.como))
  })

  await prueba("voces: saldo que no alcanza → no_hoy sin gastar; saldo ilegible → aviso y sigue", async () => {
    let pedidos = 0
    const base = crearVozFalsa({ creditos: { ok: true, usados: 999, limite: 1000, restantes: 1, renuevaEn: "2026-12-01T00:00:00.000Z", plan: "creator" } })
    const real = { ...base, nombre: "elevenlabs" as const, falso: false, costoEstimado: (n: number) => n, dialogo: async (...a: Parameters<typeof base.dialogo>) => (pedidos++, base.dialogo(...a)) }
    const r = await voces(guionBueno(), { proveedor: real, registro: registroCon("napoleon", "suntzu"), dia: DIA, log: silencio })
    assert.ok(esFallo(r) && r.clase === "no_hoy" && /quedan 1 créditos/.test(r.como) && /2026-12-01/.test(r.como))
    assert.equal(pedidos, 0)

    const ciego = { ...real, creditos: async () => ({ ok: false as const, clase: "fatal" as const, como: "HTTP 401 missing_permissions user_read" }) }
    const r2 = await voces(guionBueno(), { proveedor: ciego, registro: registroCon("napoleon", "suntzu"), dia: DIA, log: silencio })
    assert.ok(!esFallo(r2))
    if (!esFallo(r2)) assert.ok(r2.avisos.some((a) => /no se pudo leer el saldo.*user_read/.test(a)))
  })

  await prueba("voces: un tramo que falla corta el episodio y dice cuál y cómo", async () => {
    const f = crearVozFalsa({ fallarEn: { pedido: 2, fallo: { ok: false, clase: "reintentable", como: "HTTP 503 ocupado" } } })
    const registro: string[] = []
    const r = await voces(guionBueno(), { proveedor: { ...f, maxCaracteres: 70 }, registro: registroVacio(), dia: DIA, log: (m) => registro.push(m) })
    assert.ok(esFallo(r) && r.clase === "reintentable" && /tramo 2 de \d+\): HTTP 503/.test(r.como))
    assert.ok(registro.some((m) => /tramo 2 de \d+ falló \(reintentable\)/.test(m)))
  })

  await prueba("voces: un episodio sin diálogo no pide nada", async () => {
    const ep = copia(guionBueno())
    for (const p of ep.planos) delete p.dialogo
    const r = await voces(ep, { proveedor: crearVozFalsa(), registro: registroVacio(), dia: DIA, log: silencio })
    assert.ok(!esFallo(r) && r.lineas.length === 0 && r.tramos.length === 0)
  })

  await prueba("costo en dólares: la falsa no cuesta; la real, $0,08 por mil caracteres", () => {
    assert.equal(costoUsdEstimado(5000, { falso: true }), 0)
    assert.equal(costoUsdEstimado(5000, { falso: false }), 0.4)
  })

  await prueba("srt: numerado, con coma de milisegundos, sin líneas vacías", () => {
    assert.equal(
      srt([
        { inicioS: 1.5, finS: 3.25, texto: "Otra partida." },
        { inicioS: 4, finS: 4, texto: "nada" },
        { inicioS: 3661.002, finS: 3662, texto: " Ya perdiste. " },
      ]),
      "1\n00:00:01,500 --> 00:00:03,250\nOtra partida.\n\n2\n01:01:01,002 --> 01:01:02,000\nYa perdiste.\n",
    )
  })

  // ── Entorno ──
  await prueba("entorno: sin FABRICA_VOZ, falsa; elevenlabs sin clave o un valor raro → sin voz y dice qué falta", () => {
    const log: string[] = []
    const p = { fetch: (async () => new Response("")) as typeof fetch, log: (m: string) => log.push(m) }
    assert.equal(proveedorDesdeEnv({}, p).proveedor?.nombre, "falso")
    const sin = proveedorDesdeEnv({ FABRICA_VOZ: "elevenlabs" }, p)
    assert.equal(sin.proveedor, null)
    assert.deepEqual(sin.falta, ["FABRICA_ELEVENLABS_KEY"])
    const raro = proveedorDesdeEnv({ FABRICA_VOZ: "elevenlab" }, p)
    assert.equal(raro.proveedor, null, "un error de tipeo no cae en la voz falsa")
    const ok = proveedorDesdeEnv({ FABRICA_VOZ: " ElevenLabs ", FABRICA_ELEVENLABS_KEY: "k", FABRICA_VOZ_TOPE_CARACTERES: "abc" }, p)
    assert.equal(ok.proveedor?.nombre, "elevenlabs")
    assert.equal(ok.proveedor?.falso, false)
    assert.ok(log.some((m) => /FABRICA_VOZ_TOPE_CARACTERES = "abc"/.test(m)))
    assert.ok(log.some((m) => /falta FABRICA_ELEVENLABS_KEY/.test(m)))
  })

  // ── Diseño y elección ──
  await prueba("plan de diseño: solo quien habla; salta lo aprobado y lo que ya tiene 3 candidatas con la misma descripción", () => {
    const previas: Candidatas = {
      lincoln: { proveedor: "elevenlabs", modeloDiseno: "eleven_ttv_v3", huella: huellaDescripcion(arquetipoDe("lincoln")!.descripcion), creadoEn: "x", candidatas: [1, 2, 3].map((n) => ({ n, generatedVoiceId: `g${n}`, archivo: `lincoln-${n}.mp3`, duracionS: 9 })) },
      socrates: { proveedor: "elevenlabs", modeloDiseno: "eleven_ttv_v3", huella: "vieja", creadoEn: "x", candidatas: [1, 2, 3].map((n) => ({ n, generatedVoiceId: `g${n}`, archivo: "a", duracionS: 9 })) },
    }
    const plan = planDeDiseno({ previas, registro: registroCon("kobe"), rehacer: false, proveedor: "elevenlabs" })
    assert.equal(plan.disenar.length, 14 - 2)
    assert.ok(plan.disenar.includes("socrates"), "descripción cambiada: se diseña otra vez")
    assert.ok(plan.saltar.some((s) => s.id === "lincoln" && /3 candidatas/.test(s.porque)))
    assert.ok(plan.saltar.some((s) => s.id === "kobe" && /aprobada/.test(s.porque)))
    const solo = planDeDiseno({ solo: ["musk", "nadie", "lincoln"], previas, registro: registroVacio(), rehacer: true, proveedor: "elevenlabs" })
    assert.deepEqual(solo.disenar, ["lincoln"])
    assert.ok(solo.saltar.some((s) => s.id === "musk" && /no habla/.test(s.porque)))
    assert.ok(solo.saltar.some((s) => s.id === "nadie"))
  })

  await prueba("diseño: 3 candidatas por residente, candidatas.json se guarda después de cada uno, sin saldo se detiene", async () => {
    const archivos: string[] = []
    const guardados: Candidatas[] = []
    const puertos = (d: Disenador) => ({
      disenador: d,
      escribir: (n: string) => (archivos.push(n), n),
      guardarCandidatas: (c: Candidatas) => guardados.push(JSON.parse(JSON.stringify(c))),
      ahora: () => new Date("2026-11-01T12:00:00Z"),
      log: silencio,
    })
    const r = await disenarVoces(["lincoln", "socrates"], {}, puertos(crearVozFalsa()))
    assert.deepEqual(r.hechas, ["lincoln", "socrates"])
    assert.deepEqual(archivos, ["lincoln-1.wav", "lincoln-2.wav", "lincoln-3.wav", "socrates-1.wav", "socrates-2.wav", "socrates-3.wav"])
    assert.equal(guardados.length, 2, "una escritura por residente: si se cae, lo hecho queda")
    assert.deepEqual(Object.keys(guardados[0]), ["lincoln"])

    // Sin saldo a mitad de camino: no se intentan los demás.
    let n = 0
    const f = crearVozFalsa()
    const sinSaldo: Disenador = { ...f, disenar: async (a, b) => (++n === 2 ? { ok: false, clase: "no_hoy", como: "quota_exceeded" } : f.disenar(a, b)) }
    const r2 = await disenarVoces(["lincoln", "socrates", "marco"], {}, puertos(sinSaldo))
    assert.deepEqual(r2.hechas, ["lincoln"])
    assert.deepEqual(r2.fallidas.map((x) => x.id), ["socrates", "marco"])
    assert.match(r2.fallidas[1].como, /no se intentó: quota_exceeded/)
    assert.equal(n, 2)
  })

  await prueba("elegir: busca antes de crear, anota quién aprobó; con candidatas falsas no se anota nada", async () => {
    const arq = arquetipoDe("lincoln")!
    const candidatas: Candidatas = {
      lincoln: { proveedor: "elevenlabs", modeloDiseno: "eleven_ttv_v3", huella: huellaDescripcion(arq.descripcion), creadoEn: "x", candidatas: [1, 2, 3].map((n) => ({ n, generatedVoiceId: `g${n}`, archivo: "a", duracionS: 9 })) },
    }
    const creadas: string[] = []
    const f = crearVozFalsa()
    const real = (existe: string | null): Disenador => ({
      ...f,
      nombre: "elevenlabs",
      buscarVoz: async () => ({ ok: true, voiceId: existe }),
      crearVoz: async (g, nombre, desc) => {
        creadas.push(`${g} ${nombre}`)
        assert.equal(desc, arq.descripcion, "a la biblioteca va la descripción del arquetipo")
        assert.ok(!/lincoln/i.test(nombre), "el nombre en el servicio no dice quién es")
        return { ok: true, voiceId: "voz-nueva" }
      },
    })
    const ahora = () => new Date("2026-11-02T15:00:00Z")
    const r = await elegirVoz({ id: "lincoln", n: 2, aprobadoPor: "kev" }, candidatas, registroVacio(), { disenador: real(null), ahora, log: silencio })
    assert.ok(!esFallo(r), esFallo(r) ? r.como : "")
    if (!esFallo(r)) {
      assert.equal(r.registro.voces.lincoln.voiceId, "voz-nueva")
      assert.equal(r.registro.voces.lincoln.generatedVoiceId, "g2")
      assert.equal(r.registro.voces.lincoln.aprobadoPor, "kev")
      assert.equal(r.reutilizada, false)
    }
    assert.deepEqual(creadas, [`g2 ${nombreEnElServicio("lincoln", 2)}`])

    const otra = await elegirVoz({ id: "lincoln", n: 2, aprobadoPor: "kev" }, candidatas, registroVacio(), { disenador: real("ya-estaba"), ahora, log: silencio })
    assert.ok(!esFallo(otra) && otra.reutilizada && otra.entrada.voiceId === "ya-estaba")
    assert.equal(creadas.length, 1, "si ya está en la biblioteca no se crea otra")

    for (const [pedido, re] of [
      [{ id: "lincoln", n: 2, aprobadoPor: "" }, /aprobado-por/],
      [{ id: "lincoln", n: 7, aprobadoPor: "kev" }, /candidata 7/],
      [{ id: "musk", n: 1, aprobadoPor: "kev" }, /no habla/],
      [{ id: "socrates", n: 1, aprobadoPor: "kev" }, /sin candidatas|no tiene candidatas/],
    ] as const) {
      const x = await elegirVoz(pedido, candidatas, registroVacio(), { disenador: real(null), ahora, log: silencio })
      assert.ok(esFallo(x) && re.test(x.como), `${JSON.stringify(pedido)}: ${esFallo(x) ? x.como : "pasó"}`)
    }
    const vieja = await elegirVoz({ id: "lincoln", n: 1, aprobadoPor: "kev" }, { lincoln: { ...candidatas.lincoln, huella: "otra" } }, registroVacio(), { disenador: real(null), ahora, log: silencio })
    assert.ok(esFallo(vieja) && /cambió/.test(vieja.como))
    const deFalsa = await elegirVoz({ id: "lincoln", n: 1, aprobadoPor: "kev" }, { lincoln: { ...candidatas.lincoln, proveedor: "falso" } }, registroVacio(), { disenador: real(null), ahora, log: silencio })
    assert.ok(esFallo(deFalsa) && /voz de prueba como real/.test(deFalsa.como))
    const seco = await elegirVoz({ id: "lincoln", n: 1, aprobadoPor: "kev" }, { lincoln: { ...candidatas.lincoln, proveedor: "falso" } }, registroVacio(), { disenador: f, ahora, log: silencio })
    assert.ok(esFallo(seco) && /no se anota nada/.test(seco.como))
  })
}

main().then(terminar)
