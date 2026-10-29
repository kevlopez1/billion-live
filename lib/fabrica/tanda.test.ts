// Corre con: npx tsx lib/fabrica/tanda.test.ts
// La tanda entera, sin red ni base: base en memoria, IA, voz, render, calidad,
// almacén y redes de mentira (tanda-falsos.ts). Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import { tomasDelMotor, type PedirIA } from "./guionista"
import type { FuentesDeIdeas } from "./ideas"
import {
  destinoDeFallo,
  destinoDeGuionFallido,
  diaDeSalida,
  ejecutarTanda,
  planDeIdeas,
  reservasNuevas,
  resumenEnTexto,
  type TandaPuertos,
} from "./tanda"
import {
  almacenDeMentira,
  baseTandaEnMemoria,
  calidadDeMentira,
  ctxSinRed,
  discoEnMemoria,
  estadoAbierto,
  iaDeMentira,
  ideasEnMemoria,
  memoriaNueva,
  renderDeMentira,
  salidaDeMentira,
  subidasDeMentira,
  type MemoriaTanda,
} from "./tanda-falsos"
import { argsDelRender, faltaEnElRender, renderConProceso, renderListo, rendererDeLaSalida } from "./render-proceso"
import { instanteBolivia, type Fallo, type RedId } from "./tipos"
import { crearVozFalsa } from "./voz/falso"
import { registroVacio } from "./voz/registro"

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

/** 22:00 del 13-nov en Bolivia: la tanda hace los videos del 14. */
const NOCHE = new Date("2026-11-14T02:00:00Z")

type Opciones = Partial<Omit<TandaPuertos, "base" | "ideas" | "disco" | "ctx">> & {
  m?: MemoriaTanda
  rechazarCalidad?: (id: string) => string | null
  fallosSubida?: Partial<Record<RedId, Fallo["clase"]>>
}

/** Todo de mentira; cada prueba cambia lo suyo. */
function armar(o: Opciones = {}) {
  const m = o.m ?? memoriaNueva(new Date(NOCHE))
  const disco = discoEnMemoria()
  const almacen = almacenDeMentira()
  const renders: Array<{ videoId: string; archivoVoz: string | null }> = []
  const logs: string[] = []
  const ahora = () => m.ahora
  const ia = iaDeMentira()
  const p: TandaPuertos = {
    base: baseTandaEnMemoria(m),
    ideas: ideasEnMemoria(m),
    pedirIA: ia.pedir,
    voz: { proveedor: crearVozFalsa(), como: "voz falsa", falta: [] },
    registroVoces: registroVacio(),
    render: renderDeMentira(disco, renders),
    calidad: calidadDeMentira(disco, o.rechazarCalidad),
    almacen,
    adaptadores: subidasDeMentira(ahora, o.fallosSubida ?? {}),
    ctx: ctxSinRed(ahora, almacen, () => {}),
    disco,
    tomas: [],
    ahora,
    dormir: async (ms) => {
      m.ahora = new Date(m.ahora.getTime() + ms)
    },
    log: (s) => logs.push(s),
    dueno: "tanda:prueba:1",
    seco: true,
    ...o,
  }
  return { m, p, disco, almacen, renders, logs, ia }
}

const estados = (m: MemoriaTanda) => m.videos.map((v) => `${v.slot ?? "r"}:${v.estado}`).sort()

async function main() {
  const tomas = await tomasDelMotor()

  // ── Lo puro ──
  await prueba("día de salida = día reclamado + 1", () => {
    assert.equal(diaDeSalida("2026-11-13"), "2026-11-14")
    assert.equal(diaDeSalida("2026-11-30"), "2026-12-01")
  })

  await prueba("reserva verde: 1 por noche si hay lugar, hasta 2 si baja de 3, nunca más de 5, sin repetir en una corrida retomada", () => {
    assert.equal(reservasNuevas(0, 0), 2)
    assert.equal(reservasNuevas(2, 0), 1)
    assert.equal(reservasNuevas(3, 0), 1)
    assert.equal(reservasNuevas(4, 0), 1)
    assert.equal(reservasNuevas(5, 0), 0)
    assert.equal(reservasNuevas(0, 2), 0, "la corrida retomada no suma otras dos")
    assert.equal(reservasNuevas(0, 1), 1)
  })

  await prueba("plan de ideas: un lugar libre, reservas sin repetir par ni con un amarillo", () => {
    const f: FuentesDeIdeas = { recuerdos: [], conciencias: [], historial: [] }
    const p = planDeIdeas(f, { dia: "2026-11-14", videosPorDia: 3, lugaresLibres: [2], reservas: 2 })
    assert.equal(p.lugares.length, 1)
    assert.equal(p.lugares[0].slot, 2)
    assert.equal(p.reserva.length, 2, p.faltan.join(" | "))
    const pares = [...p.lugares.map((l) => l.idea.par), ...p.reserva.map((i) => i.par)]
    assert.equal(new Set(pares).size, pares.length, pares.join(", "))
    for (const i of p.reserva) assert.ok(i.esReserva && !i.personajes.some((id) => ["kobe", "jobs", "jesus"].includes(id)), i.par)
  })

  await prueba("guion fallido: tope frena, la IA caída vuelve a idea, las guardas rechazan; fatal → fallido, lo demás vuelve", () => {
    assert.equal(destinoDeGuionFallido("la IA no respondió: se llegó al tope de gasto del día"), "tope")
    assert.equal(destinoDeGuionFallido("la IA no respondió: 529 overloaded"), "volver")
    assert.equal(destinoDeGuionFallido("la segunda pasada no respondió: timeout"), "volver")
    assert.equal(destinoDeGuionFallido("3 guiones seguidos no pasaron las guardas"), "rechazar")
    assert.equal(destinoDeFallo("fatal", "listo_para_render"), "fallido")
    assert.equal(destinoDeFallo("reintentable", "listo_para_render"), "listo_para_render")
    assert.equal(destinoDeFallo("no_hoy", "listo_para_render"), "listo_para_render")
  })

  // ── La cadena entera ──
  await prueba("pausada: no reclama el día ni toca nada", async () => {
    const { m, p } = armar({ m: memoriaNueva(new Date(NOCHE), estadoAbierto({ pausada: true, motivo: "lo pausó Kev" })) })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "pausada")
    assert.ok(!m.llamadas.some((l) => l.startsWith("reclamar")), m.llamadas.join(","))
    assert.equal(m.videos.length, 0)
    assert.equal(m.llamadas[0], "vencidosAAmbiguo", "lo vencido va primero, como en el tick")
  })

  await prueba("en seco, de punta a punta: ideas → guiones → voz → render → calidad → almacén → envíos → YouTube y X subidos", async () => {
    const { m, p, almacen, renders, disco } = armar()
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "completa", resumenEnTexto(r))
    assert.equal(r.diaReclamado, "2026-11-13")
    assert.equal(r.diaSalida, "2026-11-14")
    // 3 lugares con su hora + 2 de reserva (la reserva estaba vacía).
    const lugares = m.videos.filter((v) => v.slot !== null).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    assert.deepEqual(lugares.map((v) => v.slot), [1, 2, 3])
    assert.deepEqual(
      lugares.map((v) => v.hora_salida),
      ["12:00", "16:00", "21:30"].map((h) => instanteBolivia("2026-11-14", h).toISOString()),
    )
    assert.equal(m.videos.filter((v) => v.es_reserva).length, 2)
    // Los verdes llegan subidos; un amarillo espera a Kev.
    for (const v of m.videos) {
      if (v.semaforo === "amarillo") assert.equal(v.estado, "aprobacion_pendiente", v.id)
      else assert.equal(v.estado, "subido_parcial", `${v.id}: ${v.estado} ${JSON.stringify(v.errores)}`)
    }
    const listos = m.videos.filter((v) => v.estado === "subido_parcial")
    assert.ok(listos.length >= 3, estados(m).join(" "))
    for (const v of listos) {
      assert.equal(v.archivo, `${v.dia}/${v.id}.mp4`)
      assert.ok(almacen.archivos.has(v.archivo!), `${v.archivo} no está en el almacén`)
      const es = m.envios.filter((e) => e.video_id === v.id)
      assert.deepEqual(es.map((e) => e.red).sort(), ["facebook", "instagram", "tiktok", "x", "youtube"])
      assert.equal(es.find((e) => e.red === "youtube")?.estado, "subido")
      assert.equal(es.find((e) => e.red === "youtube")?.id_red, `yt-${v.id}`)
      assert.equal(es.find((e) => e.red === "x")?.estado, "subido")
      assert.ok(es.find((e) => e.red === "x")?.media_expira_en)
      for (const red of ["facebook", "instagram", "tiktok"]) assert.equal(es.find((e) => e.red === red)?.estado, "pendiente", red)
      // La voz quedó en disco y el render la recibió (el enganche del audio).
      assert.ok(renders.find((x) => x.videoId === v.id)?.archivoVoz?.endsWith("/voz.json"))
      assert.ok(disco.archivos.has(`/seco/${v.id}/episodio.json`))
      assert.ok(v.dueno === null, "nadie queda con la reserva")
    }
    // El resumen y el candado.
    assert.equal(m.resumen?.resultado, "completa")
    assert.ok(m.estado.ultima_tanda_en)
    assert.ok(m.candados.get("tanda|2026-11-13")?.terminado, "el candado se cierra al terminar")
    assert.equal(r.reservaVerde, 2)
    assert.equal(r.pasos.subida.ok, listos.length * 2)
  })

  await prueba("los guiones de esta noche cuentan para la similitud (dos gemelos en la misma tanda: el segundo no sale)", async () => {
    const gemelo = JSON.stringify(salidaDeMentira("napoleon", "suntzu", 0))
    const pedir: PedirIA = async (q) =>
      q.paso === "guion" ? { ok: true, texto: gemelo, fin: "end_turn" } : { ok: true, texto: JSON.stringify({ ok: true, problemas: [] }), fin: "end_turn" }
    const { m, p } = armar({ pedirIA: pedir })
    const r = await ejecutarTanda({ ...p, tomas })
    const conGuion = m.videos.filter((v) => v.episodio)
    assert.equal(conGuion.length, 1, estados(m).join(" "))
    const rechazados = m.videos.filter((v) => v.estado === "rechazado")
    assert.equal(rechazados.length, m.videos.length - 1)
    assert.ok(rechazados.every((v) => JSON.stringify(v.errores).includes("se parece demasiado")), JSON.stringify(rechazados[0]?.errores))
    assert.equal(r.pasos.guion.fallos, m.videos.length - 1)
  })

  await prueba("los guiones de noches anteriores también cuentan (se leen de la base)", async () => {
    const m = memoriaNueva(new Date(NOCHE))
    const { p: p1 } = armar({ m })
    await ejecutarTanda({ ...p1, tomas })
    const antes = m.videos.filter((v) => v.episodio).length
    // La noche siguiente, una IA que solo repite las escenas de anoche (con otros protagonistas): nada pasa.
    m.ahora = new Date(NOCHE.getTime() + 24 * 3600_000)
    const { p: p2 } = armar({ m })
    let k = 0
    const repite: PedirIA = async (q) => {
      if (q.paso !== "guion") return { ok: true, texto: JSON.stringify({ ok: true, problemas: [] }), fin: "end_turn" }
      const [, a, b] = /Protagonistas: ([a-z]+) y ([a-z]+)/.exec(q.usuario) ?? []
      return { ok: true, texto: JSON.stringify(salidaDeMentira(a, b, k++ % antes)), fin: "end_turn" }
    }
    const r = await ejecutarTanda({ ...p2, pedirIA: repite, tomas })
    assert.equal(r.diaSalida, "2026-11-15")
    assert.equal(r.pasos.guion.ok, 0, `anoche ${antes} guiones; hoy salieron ${r.pasos.guion.ok}`)
  })

  await prueba("amarillo: espera el OK de Kev; si llega dentro de la espera, se produce esa misma noche", async () => {
    const { m, p } = armar({ esperaAprobacionMin: 5 })
    let aprobados = 0
    const r = await ejecutarTanda({
      ...p,
      tomas,
      dormir: async (ms) => {
        m.ahora = new Date(m.ahora.getTime() + ms)
        // Kev aprueba desde el panel (UPDATE condicional sobre aprobacion_pendiente).
        for (const v of m.videos) if (v.estado === "aprobacion_pendiente" && !v.dueno) ((v.estado = "listo_para_render"), aprobados++)
      },
    })
    assert.ok(aprobados >= 1, "la prueba necesita al menos un amarillo")
    assert.equal(r.pendientesAprobacion, 0)
    for (const v of m.videos.filter((x) => x.semaforo === "amarillo")) assert.equal(v.estado, "subido_parcial", v.id)
  })

  await prueba("de verdad con la voz de prueba: escribe los guiones pero no renderiza nada (no se publicaría)", async () => {
    const { m, p, renders } = armar({ seco: false })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(renders.length, 0)
    assert.ok(m.videos.every((v) => ["listo_para_render", "aprobacion_pendiente"].includes(v.estado)), estados(m).join(" "))
    assert.ok(r.errores.some((e) => e.paso === "voz" && /FABRICA_VOZ=elevenlabs/.test(e.como)), JSON.stringify(r.errores))
  })

  await prueba("de verdad, un video que llega a calidad_ok con voz de prueba nunca va al almacén", async () => {
    const { m, p, almacen } = armar({ seco: false })
    // Una corrida en seco dejó videos renderizados con voz de prueba en esta base.
    await ejecutarTanda({ ...p, seco: true, tomas, almacen: null, almacenFalta: ["FABRICA_ALMACEN"] })
    const enCalidad = m.videos.filter((v) => v.estado === "calidad_ok")
    assert.ok(enCalidad.length >= 1, estados(m).join(" "))
    m.candados.clear()
    await ejecutarTanda({ ...p, tomas })
    for (const v of enCalidad) assert.equal(m.videos.find((x) => x.id === v.id)?.estado, "fallido")
    assert.equal(almacen.archivos.size, 0)
  })

  await prueba("sin proveedor de voz: lo dice con la variable que falta y no renderiza", async () => {
    const { m, p, renders } = armar({ voz: { proveedor: null, como: "FABRICA_VOZ = elevenlabs pero falta FABRICA_ELEVENLABS_KEY", falta: ["FABRICA_ELEVENLABS_KEY"] } })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(renders.length, 0)
    assert.ok(r.errores.some((e) => /FABRICA_ELEVENLABS_KEY/.test(e.como)))
    assert.ok(m.videos.some((v) => v.estado === "listo_para_render"))
  })

  await prueba("una segunda corrida el mismo día no reclama (candado cerrado) y no duplica nada", async () => {
    const m = memoriaNueva(new Date(NOCHE))
    const { p } = armar({ m })
    await ejecutarTanda({ ...p, tomas })
    const n = m.videos.length
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "sin_reclamar")
    assert.equal(m.videos.length, n)
  })

  await prueba("tope de gasto en los guiones: se corta, la idea vuelve, el candado queda abierto para retomar", async () => {
    const m = memoriaNueva(new Date(NOCHE), estadoAbierto({ tope_gasto_usd_dia: 0 }))
    const { p } = armar({ m })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "cortada", resumenEnTexto(r))
    assert.match(r.motivo ?? "", /tope de gasto/)
    assert.ok(m.estado.pausada, "el tope pausa la fábrica (fabrica_sumar_gasto)")
    assert.ok(m.videos.every((v) => v.estado === "idea" && v.dueno === null), estados(m).join(" "))
    assert.ok(m.videos.some((v) => JSON.stringify(v.errores).includes("tope de gasto")))
    assert.equal(m.candados.get("tanda|2026-11-13")?.terminado, null, "sin cerrar: se puede retomar")
    // Kev sube el tope y reanuda; a la 01:21 la VM retoma lo que quedó: sin reclamar el día
    // de hoy (lo necesita la tanda de esta noche), sin ideas nuevas y cerrando el candado de anoche.
    Object.assign(m.estado, { pausada: false, motivo: null, tope_gasto_usd_dia: 5 })
    m.ahora = new Date(m.ahora.getTime() + 201 * 60_000)
    const r2 = await ejecutarTanda({ ...p, tomas })
    assert.equal(r2.resultado, "completa", resumenEnTexto(r2))
    assert.equal(r2.diaSalida, "2026-11-14")
    assert.equal(r2.ideas.lugares + r2.ideas.reserva, 0, "las ideas ya estaban: no se duplican")
    assert.ok(m.videos.every((v) => v.estado !== "idea"), estados(m).join(" "))
    assert.ok(!m.candados.has("tanda|2026-11-14"), "la retoma no toma el candado de hoy")
    assert.ok(m.candados.get("tanda|2026-11-13")?.terminado, "cierra el de anoche")
  })

  await prueba("la fábrica se pausa en el medio: se corta antes del paso siguiente y lo dice", async () => {
    const { m, p } = armar()
    const pedir = iaDeMentira().pedir
    let llamadas = 0
    const r = await ejecutarTanda({
      ...p,
      tomas,
      pedirIA: async (q) => {
        if (q.paso === "guion" && ++llamadas === 2) Object.assign(m.estado, { pausada: true, motivo: "un correo de YouTube" })
        return pedir(q)
      },
    })
    assert.equal(r.resultado, "cortada")
    assert.match(r.motivo ?? "", /correo de YouTube/)
    assert.ok(m.videos.filter((v) => v.estado === "idea").length >= 1, estados(m).join(" "))
  })

  await prueba("calidad que rechaza: ese video queda rechazado con el motivo; los demás siguen", async () => {
    let primero: string | null = null
    const { m, p } = armar({
      rechazarCalidad: (id) => {
        primero ??= id
        return id === primero ? "dura 50,0 s y el guion dice 66,5 s (±0,5 s)" : null
      },
    })
    await ejecutarTanda({ ...p, tomas })
    const rech = m.videos.find((v) => v.episodio?.id === primero)
    assert.equal(rech?.estado, "rechazado")
    assert.match(rech?.motivo_rechazo ?? "", /^calidad: dura 50,0 s/)
    assert.ok(m.videos.some((v) => v.estado === "subido_parcial"))
  })

  await prueba("render que falla: reintentable vuelve a listo_para_render con el cómo; fatal → fallido", async () => {
    for (const clase of ["reintentable", "fatal"] as const) {
      const { m, p } = armar({ render: async () => ({ ok: false, clase, como: `ffmpeg salió con código 1: Conversion failed! (${clase})` }) })
      const r = await ejecutarTanda({ ...p, tomas })
      const esperado = clase === "fatal" ? "fallido" : "listo_para_render"
      const tocados = m.videos.filter((v) => JSON.stringify(v.errores).includes("Conversion failed!"))
      assert.ok(tocados.length >= 1)
      for (const v of tocados) assert.equal(v.estado, esperado, `${clase}: ${v.estado}`)
      assert.ok(r.errores.some((e) => e.paso === "render" && /Conversion failed!/.test(e.como)))
    }
  })

  await prueba("subidas que fallan: reintentable → pendiente con espera, ambiguo → ambiguo, fatal → fallido; cada una con el cómo", async () => {
    for (const [clase, estado] of [
      ["reintentable", "pendiente"],
      ["ambiguo", "ambiguo"],
      ["fatal", "fallido"],
      ["no_hoy", "pendiente"],
    ] as const) {
      const { m, p } = armar({ fallosSubida: { youtube: clase } })
      await ejecutarTanda({ ...p, tomas })
      const yt = m.envios.filter((e) => e.red === "youtube" && m.videos.find((v) => v.id === e.video_id)?.estado === "subido_parcial")
      assert.ok(yt.length >= 1)
      for (const e of yt) {
        assert.equal(e.estado, estado, `${clase}`)
        assert.match(e.ultimo_error?.como ?? "", new RegExp(`youtube.subir de mentira: ${clase}`))
        assert.equal(e.dueno, null)
        if (clase === "reintentable") assert.equal(e.proximo_intento, new Date(NOCHE.getTime() + 10 * 60_000).toISOString())
        if (clase === "no_hoy") assert.equal(e.proximo_intento, "2026-11-14T04:00:00.000Z", "mañana a las 00:00 de Bolivia")
      }
      // X no se entera de lo de YouTube.
      assert.ok(m.envios.filter((e) => e.red === "x" && e.estado === "subido").length >= 1)
    }
  })

  await prueba("render sin el enganche (--episodio, --audio): no se piden voces ni se renderiza, y lo dice", async () => {
    let pedidosDeVoz = 0
    const falsa = crearVozFalsa()
    const { m, p, renders } = armar({
      voz: { proveedor: { ...falsa, dialogo: (x) => (pedidosDeVoz++, falsa.dialogo(x)) }, como: "falsa", falta: [] },
      renderListo: () => renderListo({ leerFuente: () => "// node scripts/casa-blanca-render.mjs --ep muestra --out x.mp4\nconst a = ['-an']" }),
    })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(pedidosDeVoz, 0, "no se paga voz que no se va a usar")
    assert.equal(renders.length, 0)
    assert.ok(m.videos.some((v) => v.estado === "listo_para_render"))
    assert.ok(r.errores.some((e) => e.paso === "render" && /--episodio ni --audio/.test(e.como) && /ENGANCHE/.test(e.como)), JSON.stringify(r.errores))
  })

  await prueba("render como proceso: argumentos, WebGL del log, código de salida y archivo que falta", async () => {
    const ep = JSON.parse(JSON.stringify(salidaDeMentira("napoleon", "suntzu", 0).episodio))
    const pedido = { videoId: "v1", episodio: { id: "fab-x", ...ep }, archivoEpisodio: "/t/v1/episodio.json", archivoVoz: "/t/v1/voz.json", salida: "/t/v1/video.mp4" }
    assert.deepEqual(argsDelRender(pedido, { url: "http://localhost:3110", calidad: "media" }), [
      "scripts/casa-blanca-render.mjs", "--ep", "v1", "--episodio", "/t/v1/episodio.json", "--audio", "/t/v1/voz.json",
      "--formato", "16:9", "--calidad", "media", "--url", "http://localhost:3110", "--out", "/t/v1/video.mp4", "--renderer-log",
    ])
    assert.equal(rendererDeLaSalida("cuadro 1/1800\nWebGL: ANGLE (NVIDIA, Tesla T4)\nlisto"), "ANGLE (NVIDIA, Tesla T4)")
    assert.equal(rendererDeLaSalida("[render] renderer = SwiftShader"), "SwiftShader")
    assert.equal(rendererDeLaSalida("nada que ver"), null)
    assert.deepEqual(faltaEnElRender("--ep <id>\n--episodio <archivo>\n--audio <voz.json>"), [])
    assert.deepEqual(faltaEnElRender("--ep <id>\n--episodios-viejos"), ["--episodio", "--audio"])
    const fuente = () => "--episodio --audio"
    const correr = (codigo: number | null, texto: string, cortado = false) => async () => ({ codigo, texto, cortado })
    const conExiste = (existe: boolean) => ({ leerFuente: fuente, existe: async () => existe, url: "u", calidad: "media", log: () => {} })
    const bien = await renderConProceso({ ...conExiste(true), correr: correr(0, "WebGL: ANGLE (NVIDIA, Tesla T4)") })(pedido)
    assert.ok(bien.ok && bien.renderer === "ANGLE (NVIDIA, Tesla T4)")
    const mal = await renderConProceso({ ...conExiste(true), correr: correr(1, "Error: page.goto: net::ERR_CONNECTION_REFUSED") })(pedido)
    assert.ok(!mal.ok && mal.clase === "reintentable" && /código 1/.test(mal.como) && /ERR_CONNECTION_REFUSED/.test(mal.como))
    const sinArchivo = await renderConProceso({ ...conExiste(false), correr: correr(0, "listo") })(pedido)
    assert.ok(!sinArchivo.ok && /no dejó \/t\/v1\/video.mp4/.test(sinArchivo.como))
    const cortado = await renderConProceso({ ...conExiste(true), correr: correr(null, "cuadro 900", true) })(pedido)
    assert.ok(!cortado.ok && /se cortó/.test(cortado.como))
    const noArranca = await renderConProceso({ ...conExiste(true), correr: async () => Promise.reject(new Error("spawn node ENOENT")) })(pedido)
    assert.ok(!noArranca.ok && noArranca.clase === "fatal" && /ENOENT/.test(noArranca.como))
  })

  await prueba("una excepción de la base en un video no tumba la tanda: se anota y siguen los demás", async () => {
    const { m, p } = armar()
    let primera = true
    const reservar = p.base.reservarVideo
    p.base.reservarVideo = async (...a) => {
      if (a[2] === "render" && primera) {
        primera = false
        throw new Error("[fabrica/base-tanda] fabrica_reservar_video falló: fetch failed (ECONNRESET)")
      }
      return reservar(...a)
    }
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "completa")
    assert.ok(r.errores.some((e) => e.paso === "render" && /ECONNRESET/.test(e.como) && e.video), JSON.stringify(r.errores))
    assert.ok(m.videos.filter((v) => v.estado === "subido_parcial").length >= 2, estados(m).join(" "))
  })

  await prueba("al guardar el guion, personajes = protagonistas primero y después el resto del reparto", async () => {
    const { m, p } = armar()
    await ejecutarTanda({ ...p, tomas })
    for (const v of m.videos.filter((x) => x.episodio)) assert.deepEqual(v.personajes.slice(0, 2), v.idea?.personajes.slice(0, 2))
  })

  await prueba("sin almacén: el video queda en calidad_ok y el error nombra la variable", async () => {
    const { m, p } = armar({ almacen: null, almacenFalta: ["SUPABASE_SERVICE_ROLE_KEY (el almacén usa Supabase Storage)"] })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.ok(m.videos.some((v) => v.estado === "calidad_ok"))
    assert.ok(!m.videos.some((v) => v.estado === "subido_parcial"))
    assert.equal(m.envios.length, 0, "sin archivo no hay envíos")
    assert.ok(r.errores.some((e) => e.paso === "almacen" && /SUPABASE_SERVICE_ROLE_KEY/.test(e.como)))
  })

  await prueba("una red sin adaptador (apagada) no se sube y queda pendiente para que el tick la omita", async () => {
    const { m, p } = armar()
    const r = await ejecutarTanda({ ...p, tomas, adaptadores: { youtube: subidasDeMentira(() => m.ahora).youtube } })
    assert.ok(m.envios.filter((e) => e.red === "x").every((e) => e.estado === "pendiente"))
    assert.ok(m.envios.filter((e) => e.red === "youtube").some((e) => e.estado === "subido"))
    assert.equal(r.resultado, "completa")
  })

  await prueba("la voz que dice no_hoy (sin créditos) corta la noche sin gastar más", async () => {
    const falsa = crearVozFalsa()
    let pedidos = 0
    const { m, p, renders } = armar({
      voz: {
        proveedor: { ...falsa, dialogo: async () => (pedidos++, { ok: false, clase: "no_hoy", como: "quota_exceeded: 0 créditos", codigo: "sin_creditos" }) },
        como: "falsa sin créditos",
        falta: [],
      },
    })
    const r = await ejecutarTanda({ ...p, tomas })
    assert.equal(r.resultado, "cortada")
    assert.equal(pedidos, 1, "después del primer no_hoy no se pide más")
    assert.equal(renders.length, 0)
    assert.ok(m.videos.some((v) => v.estado === "listo_para_render" && JSON.stringify(v.errores).includes("quota_exceeded")))
  })

  console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
  process.exit(fallos ? 1 : 0)
}

main()
