// Corre con: npx tsx lib/fabrica/reporte.test.ts
// Sin red ni base: la base es la falsa en memoria y el canal, uno de mentira.

import assert from "node:assert/strict"
import { baseEnMemoria, memoriaNueva } from "./base-memoria"
import { armarParte, canalHttp, hacerParte, respuestaVigilante, type Canal } from "./reporte"
import { instanteBolivia, type FilaEnvio, type FilaVideo } from "./tipos"

let fallos = 0
async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.stack ?? e.message : e}`)
  }
}

const DIA = "2026-11-25"
const A_LAS_23 = instanteBolivia(DIA, "23:05")

function video(id: string, campos: Partial<FilaVideo> = {}): FilaVideo {
  return {
    id,
    creado: A_LAS_23.toISOString(),
    actualizado: A_LAS_23.toISOString(),
    dia: DIA,
    slot: 1,
    hora_salida: instanteBolivia(DIA, "12:00").toISOString(),
    es_reserva: false,
    estado: "publicado",
    pilar: "historia",
    personajes: ["napoleon"],
    semaforo: "verde",
    episodio: null,
    textos: { titulo: `Título ${id}` },
    archivo: null,
    duracion_s: 64,
    aprobado_video_en: A_LAS_23.toISOString(),
    motivo_rechazo: null,
    dueno: null,
    vence_en: null,
    intentos: 0,
    ...campos,
  }
}

function envio(v: string, red: FilaEnvio["red"], campos: Partial<FilaEnvio> = {}): FilaEnvio {
  return {
    id: `${v}-${red}`,
    video_id: v,
    red,
    estado: "confirmado",
    id_red: "id",
    enlace: null,
    contenedor: null,
    media_id: null,
    media_expira_en: null,
    publish_at: null,
    publicado_en: null,
    dueno: null,
    reservado_en: null,
    vence_en: null,
    intentos: 1,
    proximo_intento: null,
    visibilidad: null,
    verificado_en: null,
    ultimo_error: null,
    ...campos,
  }
}

function memoriaDelDia() {
  const m = memoriaNueva(A_LAS_23)
  m.estado.pausada = false
  m.estado.gasto_usd_dia = 0.03
  m.videos.push(video("a"), video("b", { slot: 2, estado: "rechazado", motivo_rechazo: "sin OK del video a 30 min de la salida" }))
  m.envios.push(
    envio("a", "youtube", { enlace: "https://youtu.be/abc" }),
    envio("a", "x", { estado: "fallido", ultimo_error: { paso: "publicar", clase: "fatal", como: "401 Unauthorized", codigo: "401" } }),
    envio("a", "instagram", { estado: "fallido", visibilidad: "privado", ultimo_error: { paso: "verificar", clase: "privado", como: "SELF_ONLY" } }),
    envio("a", "tiktok", { estado: "no_hoy", ultimo_error: { paso: "publicar", clase: "no_hoy", como: "spam_risk_too_many_posts" } }),
  )
  m.reserva = 2
  return m
}

async function main() {
  await prueba("armarParte: cada cosa con su cómo", () => {
    const m = memoriaDelDia()
    m.estado.redes = { instagram: { pausada: true, motivo: "salió privado sin pedirlo" } }
    const { resumen, texto } = armarParte({ dia: DIA, estado: m.estado, videos: m.videos, envios: m.envios, reservaVerde: 2, tokens: [{ red: "x", ultimo_error: "invalid_grant", expira_en: null }], tanda: null })
    assert.deepEqual(resumen.producidos, { publicado: 1, rechazado: 1 })
    assert.deepEqual(resumen.publicados, [{ red: "youtube", titulo: "Título a", enlace: "https://youtu.be/abc" }])
    assert.equal(resumen.fallidos.length, 2)
    assert.equal(resumen.privados.length, 1, "un privado va aparte, no como fallido común")
    assert.equal(resumen.noHoy.length, 1)
    assert.equal(resumen.aprobaciones.vencidas, 1)
    assert.equal(resumen.reserva.aviso, true, "menos de 3 en la reserva = aviso")
    assert.match(texto, /401 Unauthorized/)
    assert.match(texto, /Privado sin pedirlo: instagram/)
    assert.match(texto, /Red pausada: instagram/)
    assert.match(texto, /Token de x sin renovar: invalid_grant/)
    assert.match(texto, /Gasto: USD 0,03 de 5,00/)
    assert.match(texto, /Tanda: no corrió/)
  })

  await prueba("armarParte: pausada lo dice primero", () => {
    const m = memoriaDelDia()
    Object.assign(m.estado, { pausada: true, motivo: "tope de gasto" })
    const { texto } = armarParte({ dia: DIA, estado: m.estado, videos: [], envios: [], reservaVerde: 5, tokens: [], tanda: null })
    assert.equal(texto.split("\n")[1], "PAUSADA: tope de gasto")
  })

  await prueba("hacerParte: se guarda ANTES de mandarse y sale una sola vez por día", async () => {
    const m = memoriaDelDia()
    const base = baseEnMemoria(m)
    let envios = 0
    const canal: Canal = async () => {
      m.llamadas.push("canal")
      envios++
      return { ok: true }
    }
    assert.equal(await hacerParte({ base, canal }), "parte enviado")
    assert.deepEqual(m.llamadas.filter((x) => x === "canal" || x.startsWith("guardar-parte")), [`guardar-parte:${DIA}`, "canal"])
    assert.ok(m.partes.get(DIA)?.enviado_en)
    // Otro tick a las 23:10 y otro a las 23:20: nada.
    m.ahora = new Date(A_LAS_23.getTime() + 10 * 60_000)
    assert.match(await hacerParte({ base, canal }), /ya salió/)
    m.ahora = new Date(A_LAS_23.getTime() + 20 * 60_000)
    await hacerParte({ base, canal })
    assert.equal(envios, 1)
  })

  await prueba("hacerParte: si el canal falla queda guardado sin enviado_en, con el cómo, y se reintenta", async () => {
    const m = memoriaDelDia()
    const base = baseEnMemoria(m)
    let falla = true
    const canal: Canal = async () => (falla ? { ok: false, como: "HTTP 502: bad gateway" } : { ok: true })
    assert.match(await hacerParte({ base, canal }), /NO enviado: HTTP 502/)
    assert.equal(m.partes.get(DIA)?.enviado_en, null)
    assert.equal(m.partes.get(DIA)?.error, "HTTP 502: bad gateway")
    // A los 5 min el candado sigue tomado; a los 10, vence y se reintenta.
    m.ahora = new Date(A_LAS_23.getTime() + 5 * 60_000)
    assert.match(await hacerParte({ base, canal }), /ya salió|lo tiene otro/)
    falla = false
    m.ahora = new Date(A_LAS_23.getTime() + 10 * 60_000)
    assert.equal(await hacerParte({ base, canal }), "parte enviado")
    assert.ok(m.partes.get(DIA)?.enviado_en)
    assert.equal(m.partes.get(DIA)?.error, null)
  })

  await prueba("hacerParte sin canal: queda guardado y lo dice", async () => {
    const m = memoriaDelDia()
    const r = await hacerParte({ base: baseEnMemoria(m), canal: null })
    assert.match(r, /falta FABRICA_AVISO_URL/)
    assert.equal(m.partes.get(DIA)?.enviado_en, null)
    assert.match(m.partes.get(DIA)?.error ?? "", /sin canal/)
  })

  await prueba("canalHttp: sin URL no hay canal; manda la clave; un 500 y un corte dicen el cómo", async () => {
    assert.equal(canalHttp({}), null)
    const vistos: { url: string; auth: string | null }[] = []
    const mk = (r: () => Response) =>
      (async (url: string, init?: RequestInit) => {
        vistos.push({ url, auth: new Headers(init?.headers).get("authorization") })
        return r()
      }) as unknown as typeof fetch
    const env = { FABRICA_AVISO_URL: "https://bot.example/aviso", FABRICA_AVISO_SECRET: "s3creto" }
    const cuerpo = { dia: DIA, texto: "t", resumen: armarParte({ dia: DIA, estado: memoriaNueva(A_LAS_23).estado, videos: [], envios: [], reservaVerde: 3, tokens: [], tanda: null }).resumen }
    assert.deepEqual(await canalHttp(env, mk(() => new Response("ok")))!(cuerpo), { ok: true })
    assert.deepEqual(vistos[0], { url: "https://bot.example/aviso", auth: "Bearer s3creto" })
    const r500 = await canalHttp(env, mk(() => new Response("se cayó", { status: 500 })))!(cuerpo)
    assert.deepEqual(r500, { ok: false, como: "HTTP 500: se cayó" })
    const corte = await canalHttp(env, (async () => {
      throw new Error("ECONNRESET")
    }) as unknown as typeof fetch)!(cuerpo)
    assert.deepEqual(corte, { ok: false, como: "no respondió: ECONNRESET" })
  })

  await prueba("vigilante: solo lo que el bot de Prime necesita para avisar", () => {
    const m = memoriaDelDia()
    m.estado.ultimo_tick_en = A_LAS_23.toISOString()
    const r = respuestaVigilante(A_LAS_23, m.estado, { dia: DIA, generado_en: "g", enviado_en: null, canal: "aviso", resumen: {}, texto: "secreto", error: "x" }, 4)
    assert.deepEqual(Object.keys(r).sort(), ["ahora", "motivo", "parte", "pausada", "reserva_verde", "ultima_tanda_en", "ultimo_tick_en"])
    assert.deepEqual(r.parte, { dia: DIA, generado_en: "g", enviado_en: null })
    assert.equal(respuestaVigilante(A_LAS_23, m.estado, null, 0).parte, null)
  })

  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\ntodo bien")
  process.exit(fallos ? 1 : 0)
}

main()
