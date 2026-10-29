// Corre con: npx tsx lib/fabrica/panel.test.ts
// La vista del panel de /publicar y la ruta de aprobar, sin red ni base.

import assert from "node:assert/strict"
import { esperaDe, erroresLegibles, leerResultadoDecision, validarDecision, vistaDelPanel, type EntradaVista, type FilaVideoPanel } from "./panel"
import type { FilaEnvio, FilaEstado } from "./tipos"

let fallos = 0
async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? (e.stack ?? e.message) : e}`)
  }
}

// 2026-11-10 15:00 en Bolivia.
const AHORA = new Date("2026-11-10T19:00:00Z")
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const estado = (x: Partial<FilaEstado> = {}): FilaEstado => ({
  pausada: false,
  motivo: null,
  pausada_por: null,
  pausada_en: null,
  modo_aprobacion: true,
  videos_por_dia: 3,
  tope_gasto_usd_dia: 5,
  dia: "2026-11-10",
  gasto_usd_dia: 0.03,
  publicados_dia: 2,
  fallidos_dia: 1,
  redes: {},
  ultimo_tick_en: "2026-11-10T18:50:00Z",
  ultima_tanda_en: null,
  ultima_tanda: null,
  ...x,
})

const video = (n: number, x: Partial<FilaVideoPanel> = {}): FilaVideoPanel => ({
  id: ID(n),
  creado: "2026-11-09T02:00:00Z",
  actualizado: "2026-11-09T02:00:00Z",
  dia: "2026-11-10",
  slot: n,
  hora_salida: "2026-11-10T16:00:00Z",
  es_reserva: false,
  estado: "programado",
  pilar: "historia",
  personajes: ["napoleon"],
  semaforo: "verde",
  episodio: { titulo: `Video ${n}` },
  textos: null,
  archivo: null,
  duracion_s: null,
  aprobado_video_en: "2026-11-09T03:00:00Z",
  motivo_rechazo: null,
  dueno: null,
  vence_en: null,
  intentos: 0,
  ...x,
})

const envio = (video: number, red: FilaEnvio["red"], x: Partial<FilaEnvio> = {}): FilaEnvio => ({
  id: `${ID(video)}-${red}`,
  video_id: ID(video),
  red,
  estado: "pendiente",
  id_red: null,
  enlace: null,
  contenedor: null,
  media_id: null,
  media_expira_en: null,
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
  ...x,
})

const entrada = (x: Partial<EntradaVista> = {}): EntradaVista => ({
  ahora: AHORA,
  estado: estado(),
  videos: [],
  envios: [],
  pendientes: [],
  parte: null,
  reservaVerde: 4,
  nombres: new Map([
    ["napoleon", "Napoleón"],
    ["kobe", "Kobe"],
    ["trump", "Trump"],
    ["musk", "Musk"],
  ]),
  ...x,
})

async function main() {
  await prueba("contadores: si la base todavía no cambió de día, hoy va en 0 (no los de ayer)", () => {
    const v = vistaDelPanel(entrada({ estado: estado({ dia: "2026-11-09" }) }))
    assert.deepEqual([v.delDia.gastoUsd, v.delDia.publicados, v.delDia.fallidos], [0, 0, 0])
    const w = vistaDelPanel(entrada())
    assert.deepEqual([w.delDia.gastoUsd, w.delDia.publicados, w.delDia.fallidos], [0.03, 2, 1])
    assert.equal(w.hoy, "2026-11-10")
    assert.equal(w.manana, "2026-11-11")
  })

  await prueba("cola: hoy y mañana, sin reservas, por día y lugar; la hora en Bolivia", () => {
    const v = vistaDelPanel(
      entrada({
        videos: [
          video(3, { dia: "2026-11-11", slot: 1, hora_salida: "2026-11-11T16:00:00Z" }),
          video(2, { slot: 2, hora_salida: "2026-11-10T20:00:00Z" }),
          video(1, { slot: 1 }),
          video(9, { es_reserva: true, slot: null }),
        ],
      }),
    )
    assert.deepEqual(
      v.cola.map((c) => [c.dia, c.slot, c.hora]),
      [
        ["2026-11-10", 1, "12:00"],
        ["2026-11-10", 2, "16:00"],
        ["2026-11-11", 1, "12:00"],
      ],
    )
    assert.equal(v.delDia.enCola, 2)
    assert.equal(v.cola[0].pilar, "Historia")
  })

  await prueba("semáforo: Trump fuera hasta el 10-nov y de fondo desde el 11, por el día de salida", () => {
    const v = vistaDelPanel(
      entrada({
        videos: [
          video(1, { personajes: ["napoleon", "trump"] }),
          video(2, { dia: "2026-11-11", personajes: ["kobe", "trump", "nadie"] }),
        ],
      }),
    )
    const luces = (i: number) => v.cola[i].personajes.map((p) => `${p.nombre}:${p.luz}`)
    assert.deepEqual(luces(0), ["Napoleón:verde", "Trump:fuera"])
    assert.deepEqual(luces(1), ["Kobe:amarillo", "Trump:vivo", "nadie:fuera"])
  })

  await prueba("envíos: en el orden de las redes, con el último error y su cómo, y el próximo intento si espera", () => {
    const v = vistaDelPanel(
      entrada({
        videos: [video(1)],
        envios: [
          envio(1, "x", {
            estado: "no_hoy",
            proximo_intento: "2026-11-11T04:00:00Z",
            ultimo_error: { paso: "publicar", como: "429 Too Many Requests", clase: "no_hoy", codigo: "429" },
          }),
          envio(1, "youtube", { estado: "programado" }),
          envio(1, "instagram", { estado: "confirmado", enlace: "https://www.instagram.com/reel/abc" }),
        ],
      }),
    )
    const e = v.cola[0].envios
    assert.deepEqual(e.map((x) => x.red), ["youtube", "instagram", "x"])
    assert.equal(e[2].error, "publicar: 429 Too Many Requests (429)")
    assert.equal(e[2].proximo, "00:00")
    assert.equal(e[1].enlace, "https://www.instagram.com/reel/abc")
  })

  await prueba("espera: guion siempre; video solo en modo aprobación y sin OK", () => {
    assert.equal(esperaDe({ estado: "aprobacion_pendiente", aprobado_video_en: null }, false), "guion")
    assert.equal(esperaDe({ estado: "subido_parcial", aprobado_video_en: null }, true), "video")
    assert.equal(esperaDe({ estado: "subido_parcial", aprobado_video_en: null }, false), null)
    assert.equal(esperaDe({ estado: "subido_parcial", aprobado_video_en: "2026-11-10T00:00:00Z" }, true), null)
    assert.equal(esperaDe({ estado: "publicado", aprobado_video_en: null }, true), null)
  })

  await prueba("decisiones: de cualquier día, sin repetir, con el diálogo y quién habla por su nombre", () => {
    const amarillo = video(1, {
      estado: "aprobacion_pendiente",
      semaforo: "amarillo",
      personajes: ["kobe"],
      guion_hash: "abc",
      aprobado_video_en: null,
      episodio: {
        titulo: "Kobe a las 4",
        planos: [
          { titulo: "Kobe a las 4", dialogo: [{ quien: "kobe", texto: "Mientras duermen, entreno." }] },
          { rotulo: "Gimnasio · 04:00", dialogo: [{ quien: "napoleon", texto: " Yo también. " }, { quien: "napoleon", texto: "" }] },
        ],
      },
      textos: { titulo: "Kobe a las 4", porRed: { x: "texto x", youtube: "texto yt" } },
      avisos: ["sin música"],
    })
    const otroDia = video(7, { dia: "2026-11-14", estado: "calidad_ok", aprobado_video_en: null, duracion_s: 64.5 })
    const v = vistaDelPanel(entrada({ videos: [amarillo, video(2)], pendientes: [amarillo, otroDia, video(8, { estado: "calidad_ok" })] }))
    assert.deepEqual(v.decisiones.map((d) => [d.que, d.video.id]), [
      ["guion", ID(1)],
      ["video", ID(7)],
    ])
    const d = v.decisiones[0]
    assert.deepEqual(d.dialogo, [
      { quien: "Kobe", texto: "Mientras duermen, entreno." },
      { quien: "Napoleón", texto: "Yo también." },
    ])
    assert.deepEqual(d.rotulos, ["Kobe a las 4", "Gimnasio · 04:00"])
    assert.equal(d.texto, "texto yt")
    assert.equal(d.video.guionHash, "abc")
    assert.deepEqual(d.avisos, ["sin música"])
    assert.equal(v.decisiones[1].duracionS, 64.5)
    // La del guion también figura en la cola, con su espera.
    assert.equal(v.cola.find((c) => c.id === ID(1))?.espera, "guion")
  })

  await prueba("modo aprobación apagado: ningún video espera, los guiones sí", () => {
    const v = vistaDelPanel(
      entrada({
        estado: estado({ modo_aprobacion: false }),
        pendientes: [video(1, { estado: "aprobacion_pendiente" }), video(2, { estado: "calidad_ok", aprobado_video_en: null })],
      }),
    )
    assert.deepEqual(v.decisiones.map((d) => d.que), ["guion"])
  })

  await prueba("trabajando: solo con una reserva vigente; una vencida no cuenta", () => {
    const v = vistaDelPanel(
      entrada({
        videos: [
          video(1, { dueno: "tanda", trabajo: "render", vence_en: "2026-11-10T19:30:00Z" }),
          video(2, { dueno: "tanda", trabajo: "render", vence_en: "2026-11-10T18:00:00Z" }),
        ],
      }),
    )
    assert.equal(v.cola[0].trabajando, "render")
    assert.equal(v.cola[1].trabajando, null)
  })

  await prueba("estado: redes pausadas con su motivo; parte con enviado o error", () => {
    const v = vistaDelPanel(
      entrada({
        estado: estado({ pausada: true, motivo: "tope de gasto", redes: { x: { pausada: true, motivo: "2 fallos seguidos", fallos_seguidos: 2 }, youtube: { fallos_seguidos: 1 } } }),
        parte: { dia: "2026-11-09", generado_en: "2026-11-10T03:00:00Z", enviado_en: null, canal: null, resumen: {}, texto: "Parte", error: "sin canal" },
      }),
    )
    assert.equal(v.estado.pausada, true)
    assert.deepEqual(v.estado.redesPausadas, [{ red: "x", motivo: "2 fallos seguidos" }])
    assert.equal(v.parte?.error, "sin canal")
    assert.deepEqual(v.reserva, { verdes: 4, minima: 3 })
  })

  await prueba("errores: los últimos 3, el más nuevo primero, con paso, cómo y código", () => {
    const e = [
      { paso: "guion", como: "a" },
      { paso: "render", como: "b" },
      { paso: "calidad", como: "c", codigo: "negro" },
      { como: "d" },
    ]
    assert.deepEqual(erroresLegibles(e), ["d", "calidad: c (negro)", "render: b"])
    assert.deepEqual(erroresLegibles(null), [])
    assert.deepEqual(erroresLegibles("roto"), [])
  })

  await prueba("validarDecision: id uuid, que y decisión conocidos, hash presente (puede ser null)", () => {
    assert.equal(validarDecision({ id: ID(1), que: "guion", decision: "aprobar", hash: "abc" }).ok, true)
    assert.equal(validarDecision({ id: ID(1), que: "video", decision: "rechazar", hash: null, motivo: "no" }).ok, true)
    assert.equal(validarDecision({ id: "1", que: "guion", decision: "aprobar", hash: "abc" }).ok, false)
    assert.equal(validarDecision({ id: ID(1), que: "idea", decision: "aprobar", hash: "abc" }).ok, false)
    assert.equal(validarDecision({ id: ID(1), que: "guion", decision: "aprobar" }).ok, false)
    assert.equal(validarDecision({ id: ID(1), que: "guion", decision: "aprobar", hash: "a", motivo: "x".repeat(301) }).ok, false)
  })

  await prueba("leerResultadoDecision: sin forma conocida = no aplicó, con el porqué", () => {
    assert.deepEqual(leerResultadoDecision({ ok: true, estado: "listo_para_render" }), { ok: true, estado: "listo_para_render", motivo: null })
    assert.deepEqual(leerResultadoDecision({ ok: false, motivo: "el guion cambió" }), { ok: false, estado: null, motivo: "el guion cambió" })
    assert.equal(leerResultadoDecision(null).ok, false)
    assert.equal(leerResultadoDecision({ ok: "true" }).ok, false)
  })

  // ── Las rutas: todo se corta ANTES de tocar la base ──
  const ADMIN = "a".repeat(32)
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.ADMIN_SECRET = ADMIN
  process.env.FABRICA_VIGILANTE_SECRET = "v".repeat(32)
  const pedido = (url: string, auth?: string, cuerpo?: unknown, metodo = "POST") =>
    new Request(`https://kevproject.world${url}`, {
      method: metodo,
      headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
      ...(cuerpo !== undefined ? { body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) } : {}),
    })
  const aprobar = await import("../../app/api/fabrica/aprobar/route")
  const panel = await import("../../app/api/fabrica/panel/route")
  const bueno = { id: ID(1), que: "guion", decision: "aprobar", hash: "abc" }

  await prueba("rutas: sin clave o con la del vigilante → 401 (aprobar y leer el panel es solo de Kev)", async () => {
    assert.equal((await aprobar.POST(pedido("/api/fabrica/aprobar", undefined, bueno))).status, 401)
    assert.equal((await aprobar.POST(pedido("/api/fabrica/aprobar", `Bearer ${"v".repeat(32)}`, bueno))).status, 401)
    assert.equal((await aprobar.GET(pedido("/api/fabrica/aprobar", undefined, undefined, "GET"))).status, 401)
    assert.equal((await panel.GET(pedido("/api/fabrica/panel", `Bearer ${ADMIN}x`, undefined, "GET"))).status, 401)
  })

  await prueba("rutas: pedido roto → 400 con el porqué; bueno sin base → 500 que lo dice", async () => {
    const roto = await aprobar.POST(pedido("/api/fabrica/aprobar", `Bearer ${ADMIN}`, "{no es json"))
    assert.equal(roto.status, 400)
    const malo = await aprobar.POST(pedido("/api/fabrica/aprobar", `Bearer ${ADMIN}`, { ...bueno, decision: "tal vez" }))
    assert.equal(malo.status, 400)
    assert.match((await malo.json()).error, /decision/)
    const sinBase = await aprobar.POST(pedido("/api/fabrica/aprobar", `Bearer ${ADMIN}`, bueno))
    assert.equal(sinBase.status, 500)
    assert.match((await sinBase.json()).error, /SUPABASE_SERVICE_ROLE_KEY/)
    const p = await panel.GET(pedido("/api/fabrica/panel", `Bearer ${ADMIN}`, undefined, "GET"))
    assert.equal(p.status, 500)
  })

  await prueba("rutas: sin ADMIN_SECRET → 500 que lo dice, no un 401 mudo", async () => {
    delete process.env.ADMIN_SECRET
    const r = await panel.GET(pedido("/api/fabrica/panel", `Bearer ${ADMIN}`, undefined, "GET"))
    assert.equal(r.status, 500)
    assert.match((await r.json()).error, /ADMIN_SECRET/)
    process.env.ADMIN_SECRET = ADMIN
  })

  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\ntodo bien")
  process.exit(fallos ? 1 : 0)
}

main()
