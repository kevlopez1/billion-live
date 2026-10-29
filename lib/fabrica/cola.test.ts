// Corre con: npx tsx lib/fabrica/cola.test.ts
// Sin red ni base: la base es la falsa en memoria (base-memoria.ts), que
// imita las reservas del SQL, y las redes son adaptadores de mentira que
// anotan cada llamada.

import assert from "node:assert/strict"
import { textosDe } from "./textos"
import { baseEnMemoria, memoriaNueva, type Memoria } from "./base-memoria"
import {
  ESPERA_AMBIGUO_MIN,
  ESPERA_AMBIGUO_RED_MIN,
  HORIZONTE_YOUTUBE_MIN,
  bajarYouTube,
  decidirAmbiguoYouTube,
  decidirAmbiguo,
  decidirPublicacion,
  decidirVerificacion,
  ejecutarTick,
  planDelTick,
  type Accion,
} from "./cola"
import {
  instanteBolivia,
  tituloDe,
  type Adaptador,
  type Ctx,
  type Fallo,
  type FilaEnvio,
  type FilaVideo,
  type Reciente,
  type RedId,
  type Visibilidad,
} from "./tipos"

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

// ── Armado ────────────────────────────────────────────────────

const DIA = "2026-11-25"
const SALIDA = instanteBolivia(DIA, "12:00") // 16:00 UTC
const mas = (d: Date, min: number) => new Date(d.getTime() + min * 60_000)
const iso = (d: Date) => d.toISOString()

let n = 0
function video(campos: Partial<FilaVideo> = {}): FilaVideo {
  n++
  const titulo = `Napoleón no sabe perder ${n}`
  return {
    id: `v${n}`,
    creado: iso(mas(SALIDA, -2000 + n)),
    actualizado: iso(mas(SALIDA, -600)),
    dia: DIA,
    slot: 1,
    hora_salida: iso(SALIDA),
    es_reserva: false,
    estado: "programado",
    pilar: "historia",
    personajes: ["napoleon", "suntzu"],
    semaforo: "verde",
    episodio: { titulo, formato: "16:9" },
    // Los textos como los arma el guionista (textos.ts): sin ellos la cola no manda nada.
    textos: { titulo, porRed: textosDe({ titulo, pilar: "historia" }) },
    archivo: `fabrica/${DIA}/v${n}.mp4`,
    duracion_s: 64.5,
    aprobado_video_en: iso(mas(SALIDA, -300)),
    motivo_rechazo: null,
    dueno: null,
    vence_en: null,
    intentos: 0,
    ...campos,
  }
}

function envio(v: FilaVideo, red: RedId, campos: Partial<FilaEnvio> = {}): FilaEnvio {
  return {
    id: `${v.id}-${red}`,
    video_id: v.id,
    red,
    estado: red === "youtube" || red === "x" ? "subido" : "pendiente",
    id_red: red === "youtube" ? `yt-${v.id}` : null,
    enlace: null,
    contenedor: null,
    media_id: red === "x" ? `media-${v.id}` : null,
    media_expira_en: red === "x" ? iso(mas(SALIDA, 600)) : null,
    publish_at: null,
    publicado_en: null,
    dueno: null,
    reservado_en: null,
    vence_en: null,
    intentos: 0,
    proximo_intento: null,
    visibilidad: null,
    verificado_en: null,
    ultimo_error: null,
    ...campos,
  }
}

/** La memoria con la fábrica reanudada (nace pausada, como la base). */
function memoria(ahora: Date, pausada = false): Memoria {
  const m = memoriaNueva(ahora)
  m.estado.pausada = pausada
  if (!pausada) m.estado.motivo = null
  return m
}

const ENV_TODO = {
  FABRICA_ACTIVA: "1",
  FABRICA_YOUTUBE_ACTIVA: "1",
  FABRICA_FACEBOOK_ACTIVA: "1",
  FABRICA_INSTAGRAM_ACTIVA: "1",
  FABRICA_TIKTOK_ACTIVA: "1",
  FABRICA_X_ACTIVA: "1",
}

interface Falso extends Adaptador {
  llamadas: string[]
}

type Resp = { ok: true; idRed: string; enlace?: string; contenedor?: string } | Fallo
function falso(
  red: RedId,
  o: {
    publicar?: () => Resp | Promise<Resp>
    recientes?: () => Reciente[] | Fallo
    estado?: () => { visibilidad: Visibilidad; como: string }
  } = {},
): Falso {
  const llamadas: string[] = []
  return {
    red,
    llamadas,
    async publicar(v) {
      llamadas.push(`publicar:${v.envioId}`)
      return o.publicar ? o.publicar() : { ok: true, idRed: `post-${v.envioId}` }
    },
    async programar(v, publishAt) {
      llamadas.push(`programar:${v.envioId}:${publishAt}`)
      return { ok: true }
    },
    async desprogramar(idRed) {
      llamadas.push(`desprogramar:${idRed}`)
      return { ok: true }
    },
    async estado(idRed) {
      llamadas.push(`estado:${idRed}`)
      return o.estado ? o.estado() : { visibilidad: "publico", como: "público" }
    },
    async recientes() {
      llamadas.push("recientes")
      return o.recientes ? o.recientes() : []
    },
    clasificar: () => "reintentable",
  }
}

const ctx: Ctx = {
  fetch: (async () => {
    throw new Error("sin red en los tests")
  }) as unknown as typeof fetch,
  env: {},
  ahora: () => new Date(SALIDA),
  token: async () => null,
  almacen: null,
  log: () => {},
}

function tick(m: Memoria, adaptadores: Partial<Record<RedId, Adaptador>>, extra: { env?: Record<string, string>; parte?: () => Promise<string>; dueno?: string } = {}) {
  return ejecutarTick({
    base: baseEnMemoria(m),
    adaptadores,
    ctx,
    env: extra.env ?? ENV_TODO,
    reloj: () => 0,
    parte: extra.parte,
    dueno: extra.dueno,
    log: () => {},
  })
}

const tipos = (a: Accion[]) => a.map((x) => x.tipo)
const plan = (m: Memoria, extra: { fabricaActiva?: boolean; activas?: RedId[] } = {}) =>
  planDelTick({
    estado: m.estado,
    videos: m.videos,
    envios: m.envios,
    ahora: m.ahora,
    fabricaActiva: extra.fabricaActiva ?? true,
    activas: extra.activas ?? ["youtube", "facebook", "instagram", "tiktok", "x"],
  })

async function main() {
  // ── El interruptor ──────────────────────────────────────────

  await prueba("pausada: el plan solo baja YouTube programado (nada se publica)", () => {
    const m = memoria(mas(SALIDA, 1), true)
    const v = video()
    const yt2 = video({ hora_salida: iso(mas(SALIDA, 120)), slot: 2 })
    m.videos.push(v, yt2)
    m.envios.push(envio(v, "facebook"), envio(v, "x"), envio(yt2, "youtube", { estado: "programado", publish_at: iso(mas(SALIDA, 120)) }))
    const a = plan(m)
    assert.deepEqual(tipos(a), ["desprogramar"])
  })

  await prueba("FABRICA_ACTIVA apagada (o \"false\") = como pausada", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const fb = falso("facebook")
    const r = await tick(m, { facebook: fb }, { env: { ...ENV_TODO, FABRICA_ACTIVA: "false" } })
    assert.equal(r.pausada, true)
    assert.equal(fb.llamadas.length, 0)
    assert.equal(m.envios[0].estado, "pendiente")
  })

  await prueba("pausada: el tick desprograma YouTube aunque la reserva normal no corra pausada", async () => {
    const m = memoria(mas(SALIDA, -60), true)
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube", { estado: "programado", publish_at: iso(SALIDA) }))
    const yt = falso("youtube")
    await tick(m, { youtube: yt })
    assert.deepEqual(yt.llamadas, [`desprogramar:yt-${v.id}`])
    assert.equal(m.envios[0].estado, "subido")
    assert.equal(m.envios[0].publish_at, null)
  })

  await prueba("pausada desde las 23:00: igual sale el parte (si no, el vigilante no distingue pausa de tick muerto)", async () => {
    const m = memoria(instanteBolivia(DIA, "23:10"), true)
    let partes = 0
    const r = await tick(m, {}, { parte: async () => `parte ${++partes}` })
    assert.equal(partes, 1)
    assert.deepEqual(r.hechas.map((h) => h.accion), ["parte"])
  })

  await prueba("se pausa en medio del tick: lo que sigue no se manda", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v1 = video()
    const v2 = video({ slot: 2 })
    m.videos.push(v1, v2)
    m.envios.push(envio(v1, "facebook"), envio(v2, "facebook"))
    // Kev aprieta pausa mientras sale el primero.
    const fb = falso("facebook", {
      publicar: () => {
        m.estado.pausada = true
        m.estado.motivo = "Kev"
        return { ok: true, idRed: "post-1" }
      },
    })
    const r = await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 1)
    assert.equal(r.pausada, true)
    assert.match(r.cortado ?? "", /se pausó en medio del tick: Kev/)
    assert.equal(m.envios.find((e) => e.video_id === v2.id)?.estado, "pendiente")
  })

  await prueba("pausada en la base: la reserva pierde aunque el plan viejo diga publicar", async () => {
    const m = memoria(mas(SALIDA, 1), true)
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const r = await baseEnMemoria(m).reservarEnvio(`${v.id}-facebook`, ["pendiente"], "publicando", "tick-a", 3, 3)
    assert.equal(r, null)
  })

  // ── Reservas ───────────────────────────────────────────────

  await prueba("dos reservas a la vez del mismo envío: gana una", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const b = baseEnMemoria(m)
    const [a, c] = await Promise.all([
      b.reservarEnvio(`${v.id}-facebook`, ["pendiente"], "publicando", "tick-a", 3, 3),
      b.reservarEnvio(`${v.id}-facebook`, ["pendiente"], "publicando", "tick-b", 3, 3),
    ])
    assert.equal([a, c].filter(Boolean).length, 1)
    assert.equal(m.envios[0].dueno, "tick-a")
    assert.equal(m.envios[0].intentos, 1, "el intento se cuenta al reservar")
  })

  await prueba("dos ticks a la vez: cada envío sale UNA vez", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"), envio(v, "instagram"), envio(v, "x"))
    const fb = falso("facebook")
    const ig = falso("instagram")
    const x = falso("x")
    const ads = { facebook: fb, instagram: ig, x }
    const [r1, r2] = await Promise.all([tick(m, ads, { dueno: "tick-a" }), tick(m, ads, { dueno: "tick-b" })])
    assert.equal(fb.llamadas.length, 1)
    assert.equal(ig.llamadas.length, 1)
    assert.equal(x.llamadas.length, 1)
    const perdidas = [...r1.hechas, ...r2.hechas].filter((h) => h.resultado.startsWith("reserva perdida"))
    assert.equal(perdidas.length, 3)
    assert.ok(m.envios.every((e) => e.estado === "publicado"))
    assert.equal(m.estado.gasto_usd_dia, 0.015, "X se cobra una sola vez")
  })

  await prueba("solo el dueño cierra la reserva", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const b = baseEnMemoria(m)
    await b.reservarEnvio(`${v.id}-facebook`, ["pendiente"], "publicando", "tick-a", 3, 3)
    assert.equal(await b.terminarEnvio(`${v.id}-facebook`, "tick-b", "publicado"), false)
    assert.equal(m.envios[0].estado, "publicando")
  })

  await prueba("reserva vencida en publicando → ambiguo (no se repite a ciegas)", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const b = baseEnMemoria(m)
    await b.reservarEnvio(`${v.id}-facebook`, ["pendiente"], "publicando", "tick-muerto", 3, 3)
    m.ahora = mas(m.ahora, 4)
    assert.equal(await b.vencidosAAmbiguo(), 1)
    assert.equal(m.envios[0].estado, "ambiguo")
    assert.equal(m.envios[0].ultimo_error?.clase, "ambiguo")
    // El plan de ese momento NO lo publica de nuevo.
    assert.ok(!tipos(plan(m)).includes("publicar"))
  })

  await prueba("Kev rechaza el video mientras el tick corre: la reserva de publicar pierde", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"), envio(v, "instagram"))
    const fb = falso("facebook", {
      publicar: () => {
        m.videos[0].estado = "rechazado"
        return { ok: true, idRed: "post-fb" }
      },
    })
    const ig = falso("instagram")
    await tick(m, { facebook: fb, instagram: ig })
    assert.equal(fb.llamadas.length, 1)
    assert.equal(ig.llamadas.length, 0)
    assert.equal(m.envios.find((e) => e.red === "instagram")?.estado, "pendiente")
  })

  // ── Ambiguos: mirar antes de repetir ────────────────────────

  await prueba("ambiguo: primero recientes(); si está, publicado sin volver a mandar", async () => {
    const m = memoria(mas(SALIDA, 40))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook", { estado: "ambiguo", intentos: 1, reservado_en: iso(mas(SALIDA, 1)) }))
    assert.deepEqual(tipos(plan(m)), ["resolver_ambiguo"])
    const fb = falso("facebook", { recientes: () => [{ idRed: "fb-123", texto: `NAPOLEÓN no sabe perder ${v.id.slice(1)}!`, creado: iso(SALIDA) }] })
    await tick(m, { facebook: fb })
    assert.deepEqual(fb.llamadas, ["recientes"])
    assert.equal(m.envios[0].estado, "publicado")
    assert.equal(m.envios[0].id_red, "fb-123")
  })

  await prueba("ambiguo que no está entre los recientes: vuelve a intentarse (en el tick siguiente)", async () => {
    const m = memoria(mas(SALIDA, 40))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook", { estado: "ambiguo", intentos: 1, reservado_en: iso(mas(SALIDA, 1)) }))
    const fb = falso("facebook", { recientes: () => [{ idRed: "otro", texto: "otra cosa", creado: iso(SALIDA) }] })
    await tick(m, { facebook: fb })
    assert.deepEqual(fb.llamadas, ["recientes"])
    assert.equal(m.envios[0].estado, "pendiente")
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.at(-1), `publicar:${v.id}-facebook`)
    assert.equal(m.envios[0].estado, "publicado")
  })

  await prueba("ambiguo y la lista falla: sigue ambiguo, nada se manda", async () => {
    const m = memoria(mas(SALIDA, 40))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook", { estado: "ambiguo", intentos: 1, reservado_en: iso(mas(SALIDA, 1)) }))
    const fb = falso("facebook", { recientes: () => ({ ok: false, clase: "reintentable", como: "HTTP 503" }) })
    await tick(m, { facebook: fb })
    assert.deepEqual(fb.llamadas, ["recientes"])
    assert.equal(m.envios[0].estado, "ambiguo")
    assert.equal(m.envios[0].ultimo_error?.como, "HTTP 503")
  })

  await prueba(`ambiguo de hace menos de ${ESPERA_AMBIGUO_MIN} min: todavía no se mira`, () => {
    const m = memoria(mas(SALIDA, 4))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook", { estado: "ambiguo", intentos: 1, reservado_en: iso(mas(SALIDA, 1)) }))
    assert.deepEqual(tipos(plan(m)), [])
  })

  await prueba("ambiguo sin título: no se repite a ciegas (fallido, revisar a mano)", () => {
    const e = envio(video(), "facebook", { estado: "ambiguo", intentos: 1 })
    const d = decidirAmbiguo([], e, "  ")
    assert.equal(d.hasta, "fallido")
  })

  await prueba("ambiguo pasada la ventana: se cierra con el cómo, sin tocar la red", () => {
    const m = memoria(mas(SALIDA, 200))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook", { estado: "ambiguo", intentos: 1, reservado_en: iso(mas(SALIDA, 1)) }))
    // (el lugar 2, de las 16:00, sale en menos de 3 h y no tiene video: también pide su hueco)
    assert.deepEqual(tipos(plan(m)).filter((x) => x !== "cubrir_hueco"), ["cerrar_ambiguo"])
  })

  // ── Revisión del 2026-10-29: los fixtures de los revisores ──

  await prueba("título con {RECAUDADO}: se busca con el número (el post lo lleva), nunca con la marca", () => {
    // Fixture del revisor: episodio crudo con marcas; el post publicado ya trae el número.
    const v = video({
      episodio: { titulo: "Recaudado {RECAUDADO} de {META}", formato: "16:9" },
      textos: { porRed: { x: "Ficción hecha con IA. Personajes inspirados en figuras reales; no son ellas ni hablan por ellas.\n\nRecaudado $1.234 de $450.000\n\n#LaCasaBlancaProject #Historia #FicciónConIA" } },
    })
    assert.equal(tituloDe(v), "Recaudado $1.234 de $450.000")
    const e = envio(v, "x", { estado: "ambiguo", intentos: 1, ambiguo_desde: "publicando" })
    const d = decidirAmbiguo([{ idRed: "x1", texto: v.textos!.porRed!.x!, creado: iso(SALIDA) }], e, tituloDe(v))
    assert.equal(d.hasta, "publicado")
    assert.equal(d.campos.id_red, "x1")
    // Sin texto publicado ni título guardado, una marca cruda no se busca: vacío = revisar a mano.
    assert.equal(tituloDe({ episodio: { titulo: "Vamos por {RECAUDADO}" }, textos: null }), "")
  })

  await prueba("ambiguo: tres listas fallidas seguidas no corren el ancla; a la cuarta, el post está → publicado", async () => {
    // Fixture del revisor: X publica a las 12:00 (5xx, queda ambiguo) y la lista falla tres ticks.
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "x"))
    const b = baseEnMemoria(m)
    assert.ok(await b.reservarEnvio(`${v.id}-x`, ["subido"], "publicando", "tick-12", 3, 3))
    assert.ok(await b.terminarEnvio(`${v.id}-x`, "tick-12", "ambiguo", { error: { paso: "publicando", clase: "ambiguo", como: "HTTP 503" } }))
    assert.equal(m.envios[0].ambiguo_desde, "publicando")
    const enviado = Date.parse(m.envios[0].enviado_en!)
    let falla = true
    const pedidos: number[] = []
    const x = falso("x", {
      recientes: () => (falla ? { ok: false, clase: "reintentable", como: "token no renueva" } : []),
    })
    // La lista real filtra por `desde`: el post de las 12:01 solo aparece si la ventana lo incluye.
    x.recientes = async (desde) => {
      pedidos.push(desde.getTime())
      x.llamadas.push("recientes")
      if (falla) return { ok: false, clase: "reintentable", como: "token no renueva" }
      return desde.getTime() <= enviado ? [{ idRed: "tw-1", texto: `${tituloDe(v)}\n#LaCasaBlancaProject`, creado: iso(mas(SALIDA, 1)) }] : []
    }
    for (const minuto of [10, 20, 30, 40]) {
      m.ahora = mas(SALIDA, minuto)
      await tick(m, { x })
      assert.equal(m.envios[0].estado, "ambiguo", `minuto ${minuto}`)
      assert.equal(m.envios[0].ambiguo_desde, "publicando", "el error de la lista no pisa el origen")
    }
    falla = false
    m.ahora = mas(SALIDA, 50)
    await tick(m, { x })
    assert.ok(pedidos.every((d) => d <= enviado - 25 * 60_000), "el ancla no se mueve con las reservas que solo miran")
    assert.equal(m.envios[0].estado, "publicado")
    assert.equal(m.envios[0].id_red, "tw-1")
    assert.ok(!x.llamadas.some((l) => l.startsWith("publicar")), "nunca se vuelve a mandar")
  })

  await prueba("ambiguo de una subida de la VM: lista fallida y después la subida → subido (no publicado)", async () => {
    // Fixture del revisor: la primera lista falla y antes pisaba la marca 'subiendo'.
    const m = memoria(mas(SALIDA, -100))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube", { estado: "pendiente", id_red: null }))
    const b = baseEnMemoria(m)
    assert.ok(await b.reservarEnvio(`${v.id}-youtube`, ["pendiente"], "subiendo", "vm", 20, 3))
    m.ahora = mas(m.ahora, 21)
    assert.equal(await b.vencidosAAmbiguo(), 1)
    assert.equal(m.envios[0].ambiguo_desde, "subiendo")
    const r1 = decidirAmbiguo({ ok: false, clase: "reintentable", como: "token" }, m.envios[0], tituloDe(v))
    assert.equal(r1.hasta, "ambiguo")
    const yt = falso("youtube", { recientes: () => ({ ok: false, clase: "reintentable", como: "token" }) })
    m.ahora = mas(m.ahora, 10)
    await tick(m, { youtube: yt })
    assert.equal(m.envios[0].estado, "ambiguo")
    assert.equal(m.envios[0].ambiguo_desde, "subiendo")
    const yt2 = falso("youtube", { recientes: () => [{ idRed: "yt-sub", texto: tituloDe(v), creado: iso(m.ahora) }] })
    m.ahora = mas(m.ahora, 10)
    await tick(m, { youtube: yt2 })
    assert.equal(m.envios[0].estado, "subido")
    assert.equal(m.envios[0].id_red, "yt-sub")
    assert.equal(m.estado.redes.youtube?.pausada, undefined)
  })

  await prueba("YouTube ambiguo al PUBLICAR: se pregunta estado(), no la lista de subidas (que trae las privadas)", async () => {
    const m = memoria(mas(SALIDA, 12))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube", { estado: "ambiguo", intentos: 1, enviado_en: iso(mas(SALIDA, 1)), ambiguo_desde: "publicando" }))
    const yt = falso("youtube", { estado: () => ({ visibilidad: "privado", como: "privacyStatus=private" }) })
    await tick(m, { youtube: yt })
    assert.ok(!yt.llamadas.includes("recientes"))
    assert.equal(yt.llamadas[0], `estado:yt-${v.id}`)
    assert.equal(m.envios[0].estado, "subido", "privado = no salió: vuelve a publicarse (videos.update es idempotente)")
    assert.equal(m.estado.redes.youtube?.pausada, undefined, "no es una alarma")
    assert.equal(decidirAmbiguoYouTube({ visibilidad: "publico", como: "" }, m.envios[0]).hasta, "publicado")
    assert.equal(decidirAmbiguoYouTube({ visibilidad: "desconocida", como: "" }, m.envios[0]).hasta, "ambiguo")
  })

  await prueba(`Facebook y TikTok (asíncronas): el ambiguo espera ${ESPERA_AMBIGUO_RED_MIN.facebook} min antes de mirar`, () => {
    const m = memoria(mas(SALIDA, 20))
    const v = video()
    m.videos.push(v)
    m.envios.push(
      envio(v, "facebook", { estado: "ambiguo", intentos: 1, enviado_en: iso(mas(SALIDA, 1)), ambiguo_desde: "publicando" }),
      envio(v, "instagram", { estado: "ambiguo", intentos: 1, enviado_en: iso(mas(SALIDA, 1)), ambiguo_desde: "publicando" }),
    )
    assert.deepEqual(plan(m).flatMap((a) => (a.tipo === "resolver_ambiguo" ? [a.red] : [])), ["instagram"])
    m.ahora = mas(SALIDA, 32)
    assert.deepEqual(plan(m).flatMap((a) => (a.tipo === "resolver_ambiguo" ? [a.red] : [])), ["facebook", "instagram"])
  })

  await prueba("sin texto para una red: no se manda con \"\" (sin el aviso de ficción); fallido con el cómo", async () => {
    // Fixture del revisor: el envío de una red que no estaba cuando se escribió el guion.
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    delete v.textos!.porRed!.instagram
    m.videos.push(v)
    m.envios.push(envio(v, "instagram"))
    const ig = falso("instagram")
    await tick(m, { instagram: ig })
    assert.equal(ig.llamadas.length, 0)
    assert.equal(m.envios[0].estado, "fallido")
    assert.match(m.envios[0].ultimo_error?.como ?? "", /sin texto para instagram/)
    assert.equal(m.envios[0].intentos, 0, "no se reservó")
  })

  await prueba("un texto sin la línea FICCION no se manda", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    v.textos!.porRed!.facebook = v.textos!.porRed!.facebook!.split("\n\n").slice(1).join("\n\n")
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const fb = falso("facebook")
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 0)
    assert.equal(m.envios[0].estado, "fallido")
    assert.match(m.envios[0].ultimo_error?.como ?? "", /primera línea/)
  })

  await prueba("al pausar, la ruta baja YA lo que YouTube tiene programado (sin esperar al tick)", async () => {
    const m = memoria(mas(SALIDA, -8), true)
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube", { estado: "programado", publish_at: iso(SALIDA) }))
    const yt = falso("youtube")
    const hechas = await bajarYouTube({
      base: baseEnMemoria(m),
      adaptadores: { youtube: yt },
      ctx: { ...ctx, ahora: () => new Date(m.ahora) },
      env: ENV_TODO,
      reloj: () => 0,
      log: () => {},
    })
    assert.deepEqual(yt.llamadas, [`desprogramar:yt-${v.id}`])
    assert.equal(hechas.length, 1)
    assert.equal(m.envios[0].estado, "subido")
    assert.equal(m.envios[0].publish_at, null)
    assert.ok(!m.llamadas.includes("latido"), "no deja latido: no es un tick")
  })

  // ── Reintentos: clasificación ──────────────────────────────

  await prueba("decidirPublicacion: una tabla por clase", () => {
    const ahora = mas(SALIDA, 1)
    const r = (intentos: number) => envio(video(), "facebook", { estado: "publicando", intentos })
    const f = (clase: Fallo["clase"], extra: Partial<Fallo> = {}): Fallo => ({ ok: false, clase, como: `respuesta ${clase}`, ...extra })

    const ok = decidirPublicacion({ ok: true, idRed: "p1" }, r(1), ahora, "pendiente")
    assert.equal(ok.hasta, "publicado")
    assert.equal(ok.cuenta, true)

    const amb = decidirPublicacion(f("ambiguo"), r(1), ahora, "pendiente")
    assert.equal(amb.hasta, "ambiguo")
    assert.equal(amb.cuenta, undefined, "un ambiguo no es un fallo todavía")

    const noHoy = decidirPublicacion(f("no_hoy", { codigo: "429" }), r(1), ahora, "pendiente")
    assert.equal(noHoy.hasta, "no_hoy")
    assert.equal(noHoy.campos.proximo_intento, instanteBolivia("2026-11-26", "00:00").toISOString())
    assert.equal(noHoy.campos.intentos, 0, "el tope de la red no gasta el intento")

    const fatal = decidirPublicacion(f("fatal", { codigo: "190" }), r(1), ahora, "pendiente")
    assert.equal(fatal.hasta, "fallido")
    assert.equal(fatal.cuenta, false)
    assert.deepEqual((fatal.campos.error as { codigo?: string }).codigo, "190")

    const r1 = decidirPublicacion(f("reintentable"), r(1), ahora, "pendiente")
    assert.equal(r1.hasta, "pendiente")
    assert.equal(r1.campos.proximo_intento, mas(ahora, 10).toISOString())
    const r2 = decidirPublicacion(f("reintentable"), r(2), ahora, "subido")
    assert.equal(r2.hasta, "subido")
    assert.equal(r2.campos.proximo_intento, mas(ahora, 30).toISOString())
    const r3 = decidirPublicacion(f("reintentable"), r(3), ahora, "pendiente")
    assert.equal(r3.hasta, "fallido", "máximo 3 intentos")
    assert.match((r3.campos.error as { como: string }).como, /3 intentos/)

    const proc = decidirPublicacion(f("reintentable", { pendiente: "cont-1" }), r(1), ahora, "pendiente")
    assert.equal(proc.hasta, "procesando")
    assert.equal(proc.campos.contenedor, "cont-1")
    assert.equal(proc.campos.intentos, 0)
    // Retomar no sumó el intento: no se resta.
    const retomado = decidirPublicacion(f("reintentable", { pendiente: "cont-1" }), r(1), ahora, "procesando", false)
    assert.equal(retomado.campos.intentos, 1)
  })

  await prueba("reintentable: espera 10 min, después 30, y al tercero fallido", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const fb = falso("facebook", { publicar: () => ({ ok: false, clase: "reintentable", como: "HTTP 500" }) })
    await tick(m, { facebook: fb })
    assert.equal(m.envios[0].estado, "pendiente")
    assert.equal(m.envios[0].proximo_intento, mas(m.ahora, 10).toISOString())
    m.ahora = mas(m.ahora, 5)
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 1, "antes de los 10 min no se reintenta")
    // Una red que falla 2 veces seguidas se pausa; aquí se reanuda a mano para ver el tercer intento.
    m.ahora = mas(m.ahora, 6)
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 2)
    assert.equal(m.estado.redes.facebook?.pausada, true)
    m.estado.redes.facebook = { pausada: false, fallos_seguidos: 0 }
    m.ahora = mas(m.ahora, 31)
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 3)
    assert.equal(m.envios[0].estado, "fallido")
    m.ahora = mas(m.ahora, 100)
    await tick(m, { facebook: fb })
    assert.equal(fb.llamadas.length, 3, "nunca un cuarto")
  })

  await prueba("no_hoy: no se reintenta hoy; mañana desde las 00:00", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "x"))
    let veces = 0
    const x = falso("x", { publicar: () => (++veces === 1 ? { ok: false, clase: "no_hoy", como: "429 too many posts", codigo: "429" } : { ok: true, idRed: "x-1" }) })
    await tick(m, { x })
    assert.equal(m.envios[0].estado, "no_hoy")
    m.ahora = instanteBolivia(DIA, "23:50")
    await tick(m, { x })
    assert.equal(x.llamadas.length, 1)
    m.ahora = instanteBolivia("2026-11-26", "00:05")
    await tick(m, { x })
    assert.equal(x.llamadas.length, 2)
    assert.equal(m.envios[0].estado, "publicado")
  })

  await prueba("2 fallos seguidos de una red: la red se pausa y las demás siguen", async () => {
    const m = memoria(mas(SALIDA, 1))
    const vs = [video(), video({ slot: 2 }), video({ slot: 3 })]
    m.videos.push(...vs)
    for (const v of vs) m.envios.push(envio(v, "facebook"), envio(v, "instagram"))
    const fb = falso("facebook", { publicar: () => ({ ok: false, clase: "fatal", como: "(#200) sin permiso", codigo: "200" }) })
    const ig = falso("instagram")
    await tick(m, { facebook: fb, instagram: ig })
    assert.equal(fb.llamadas.length, 2)
    assert.equal(ig.llamadas.length, 3)
    assert.equal(m.estado.redes.facebook?.pausada, true)
    assert.match(m.estado.redes.facebook?.motivo ?? "", /2 fallos seguidos/)
    assert.equal(m.estado.pausada, false, "la fábrica sigue")
  })

  await prueba("tope de gasto: la fábrica se pausa ANTES de gastar y no se manda", async () => {
    const m = memoria(mas(SALIDA, 1))
    m.estado.tope_gasto_usd_dia = 0.01
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "x"))
    const x = falso("x")
    const r = await tick(m, { x })
    assert.equal(x.llamadas.length, 0)
    assert.equal(m.estado.pausada, true)
    assert.match(m.estado.motivo ?? "", /tope de gasto/)
    assert.equal(r.pausada, true)
    assert.equal(m.envios[0].estado, "subido")
    assert.equal(m.envios[0].intentos, 0, "el intento que no se gastó se devuelve")
    assert.equal(m.envios[0].dueno, null)
  })

  // ── Huecos y videos ────────────────────────────────────────

  await prueba("hueco en las próximas 3 h: lo cubre la reserva verde aprobada", async () => {
    const m = memoria(instanteBolivia(DIA, "10:00"))
    const tarde = video({ estado: "renderizado", aprobado_video_en: null })
    const reserva = video({ es_reserva: true, slot: null, dia: "2026-11-20", hora_salida: null, estado: "subido_parcial" })
    const amarilla = video({ es_reserva: true, slot: null, dia: "2026-11-20", hora_salida: null, estado: "subido_parcial", semaforo: "amarillo" })
    m.videos.push(tarde, amarilla, reserva)
    const a = plan(m)
    assert.deepEqual(tipos(a), ["cubrir_hueco"])
    await tick(m, {})
    assert.equal(reserva.slot, 1)
    assert.equal(reserva.dia, DIA)
    assert.equal(reserva.hora_salida, SALIDA.toISOString())
    assert.equal(reserva.es_reserva, false)
    assert.equal(tarde.slot, null)
    assert.equal(tarde.es_reserva, true, "un verde que no llegó pasa a la reserva")
    assert.equal(amarilla.slot, null, "un amarillo nunca cubre un hueco")
  })

  await prueba("subido_parcial → programado solo con el OK del video (modo aprobación)", () => {
    const m = memoria(mas(SALIDA, -120))
    const sinOk = video({ estado: "subido_parcial", aprobado_video_en: null })
    const conOk = video({ estado: "subido_parcial", slot: 2 })
    m.videos.push(sinOk, conOk)
    m.envios.push(envio(sinOk, "facebook"), envio(conOk, "facebook"))
    const a = plan(m).filter((x) => x.tipo === "avanzar_video")
    assert.deepEqual(a, [{ tipo: "avanzar_video", video: conOk.id, desde: "subido_parcial", hasta: "programado" }])
  })

  await prueba("programado → publicado cuando todas sus redes cerraron; fallido si ninguna salió", () => {
    const m = memoria(mas(SALIDA, 60))
    const bien = video()
    const mal = video({ slot: 2 })
    m.videos.push(bien, mal)
    m.envios.push(envio(bien, "facebook", { estado: "confirmado" }), envio(bien, "x", { estado: "omitido" }))
    m.envios.push(envio(mal, "facebook", { estado: "fallido" }))
    const a = plan(m).filter((x) => x.tipo === "avanzar_video")
    assert.deepEqual(
      a.map((x) => x.tipo === "avanzar_video" && [x.video, x.hasta]),
      [
        [bien.id, "publicado"],
        [mal.id, "fallido"],
      ],
    )
  })

  await prueba("red apagada, VM que no subió o media de X vencida: omitido con el cómo", () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(
      envio(v, "tiktok"),
      envio(v, "youtube", { estado: "pendiente" }),
      envio(v, "x", { media_expira_en: iso(mas(SALIDA, 10)) }),
    )
    const a = plan(m, { activas: ["youtube", "x"] })
    const omitidos = a.flatMap((x) => (x.tipo === "omitir" ? [`${x.red}: ${x.como}`] : []))
    assert.equal(omitidos.length, 3)
    assert.match(omitidos.join("\n"), /tiktok: red apagada/)
    assert.match(omitidos.join("\n"), /youtube: la VM no lo subió/)
    assert.match(omitidos.join("\n"), /x: la media de X vence/)
  })

  // ── YouTube ────────────────────────────────────────────────

  await prueba(`YouTube: publishAt solo dentro de los ${HORIZONTE_YOUTUBE_MIN} min, y la reserva queda en programado ANTES de llamar`, async () => {
    const lejos = memoria(mas(SALIDA, -60))
    const v0 = video()
    lejos.videos.push(v0)
    lejos.envios.push(envio(v0, "youtube"))
    assert.deepEqual(tipos(plan(lejos)), [])

    const m = memoria(mas(SALIDA, -30))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube"))
    let estadoAlLlamar = ""
    const yt = falso("youtube")
    yt.programar = async () => {
      estadoAlLlamar = m.envios[0].estado
      return { ok: true }
    }
    await tick(m, { youtube: yt })
    assert.equal(estadoAlLlamar, "programado")
    assert.equal(m.envios[0].estado, "programado")
    assert.equal(m.envios[0].publish_at, SALIDA.toISOString())
  })

  await prueba("YouTube a medio programar (tick muerto) y la fábrica se pausa: igual se baja", () => {
    const m = memoria(mas(SALIDA, -30), true)
    const v = video()
    m.videos.push(v)
    // Lo que deja un tick que murió dentro de programar(): programado, sin publish_at.
    m.envios.push(envio(v, "youtube", { estado: "programado", publish_at: null, dueno: "muerto", vence_en: iso(mas(SALIDA, -40)) }))
    assert.deepEqual(tipos(plan(m)), ["desprogramar"])
    m.estado.pausada = false
    assert.deepEqual(
      plan(m).map((x) => (x.tipo === "programar" ? `programar desde ${x.desde}` : x.tipo)),
      ["programar desde programado"],
    )
  })

  await prueba("YouTube: pasado su publishAt, YouTube lo sacó (sin volver a mandar)", () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "youtube", { estado: "programado", publish_at: iso(SALIDA) }))
    assert.deepEqual(tipos(plan(m)), ["marcar_publicado"])
  })

  // ── Verificación ───────────────────────────────────────────

  await prueba("privado sin pedirlo: fallido y esa red se pausa", async () => {
    const m = memoria(mas(SALIDA, 20))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "instagram", { estado: "publicado", id_red: "ig-1", publicado_en: iso(mas(SALIDA, 1)) }))
    const ig = falso("instagram", { estado: () => ({ visibilidad: "privado", como: "cuenta sin auditar: SELF_ONLY" }) })
    await tick(m, { instagram: ig })
    assert.equal(m.envios[0].estado, "fallido")
    assert.equal(m.estado.redes.instagram?.pausada, true)
    assert.equal(decidirVerificacion({ visibilidad: "publico", como: "" }).hasta, "confirmado")
    assert.equal(decidirVerificacion({ visibilidad: "procesando", como: "" }).hasta, "publicado")
  })

  // ── El parte ───────────────────────────────────────────────

  await prueba("antes de las 23:00 no hay parte; desde las 23:00 el plan lo pide (el candado decide)", () => {
    const m = memoria(instanteBolivia(DIA, "22:59"))
    assert.ok(!tipos(plan(m)).includes("parte"))
    m.ahora = instanteBolivia(DIA, "23:00")
    assert.ok(tipos(plan(m)).includes("parte"))
  })

  await prueba("presupuesto de tiempo: lo que no entra queda para el próximo tick", async () => {
    const m = memoria(mas(SALIDA, 1))
    const v = video()
    m.videos.push(v)
    m.envios.push(envio(v, "facebook"))
    const fb = falso("facebook")
    let ms = 0
    const r = await ejecutarTick({
      base: baseEnMemoria(m),
      adaptadores: { facebook: fb },
      ctx,
      env: ENV_TODO,
      reloj: () => (ms += 30_000),
      log: () => {},
    })
    assert.equal(fb.llamadas.length, 0)
    assert.match(r.cortado ?? "", /sin tiempo para publicar/)
    assert.equal(m.envios[0].estado, "pendiente")
  })

  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\ntodo bien")
  process.exit(fallos ? 1 : 0)
}

main()
