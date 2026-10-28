// Corre con: npx tsx lib/publicar-pedido.test.ts
// Sin red: fetch se reemplaza por un Meta de mentira que anota cada llamada.

import assert from "node:assert/strict"
import { cuentaDe, faltaVariable, urlDelEpisodio, validarPedido } from "./publicar-pedido"
import { configurado, continuar, publicar } from "./meta"

let fallos = 0
async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

const base = { tipo: "video", url: "https://kevproject.world/casa-blanca/videos/ep01.mp4", texto: "hola", destinos: ["ig", "fb"] }

async function main() {
  // AbortSignal.timeout no mantiene vivo a Node: sin esto, una llamada "colgada"
  // de la prueba terminaría el proceso en silencio en vez de cortarse a tiempo.
  const vivo = setInterval(() => {}, 1_000)
  // ── La cuenta ──
  await prueba("sin cuenta = la de Kev (lo de siempre)", () => {
    assert.equal(cuentaDe(undefined), "kev")
    assert.equal(cuentaDe(""), "kev")
    const v = validarPedido(base)
    assert.ok(v.ok && v.pedido.cuenta === "kev")
  })
  await prueba("casa-blanca se acepta, una cuenta inventada no", () => {
    const v = validarPedido({ ...base, cuenta: "casa-blanca" })
    assert.ok(v.ok && v.pedido.cuenta === "casa-blanca")
    assert.equal(cuentaDe("Casa-Blanca"), null)
    const w = validarPedido({ ...base, cuenta: "otra" })
    assert.ok(!w.ok && /Cuenta desconocida/.test(w.error))
  })

  // ── El pedido ──
  await prueba("rechaza lo mal pedido con un motivo", () => {
    for (const [cuerpo, motivo] of [
      [null, /objeto JSON/],
      [[], /objeto JSON/],
      [{ ...base, tipo: "audio" }, /foto o video/],
      [{ ...base, url: "http://kevproject.world/a.mp4" }, /https/],
      [{ ...base, url: "https://" }, /https/],
      [{ ...base, destinos: ["tiktok"] }, /al menos una red/],
      [{ ...base, texto: "x".repeat(2201) }, /2\.200/],
      [{ ...base, accion: "borrar" }, /Acción desconocida/],
    ] as const) {
      const v = validarPedido(cuerpo)
      assert.ok(!v.ok, `debió rechazar ${JSON.stringify(cuerpo)?.slice(0, 60)}`)
      assert.match(v.error, motivo)
    }
  })
  await prueba("destinos repetidos se cuentan una vez", () => {
    const v = validarPedido({ ...base, destinos: ["ig", "ig", "fb", "x"] })
    assert.ok(v.ok && v.pedido.accion === "publicar")
    if (v.ok && v.pedido.accion === "publicar") assert.deepEqual(v.pedido.destinos, ["ig", "fb"])
  })
  await prueba("continuar exige un id numérico (no entra cualquier cosa a la URL de Graph)", () => {
    assert.ok(validarPedido({ accion: "continuar", cuenta: "casa-blanca", contenedor: "17890012345678901" }).ok)
    assert.ok(!validarPedido({ accion: "continuar", contenedor: "../me?fields=x" }).ok)
    assert.ok(!validarPedido({ accion: "continuar" }).ok)
  })

  // ── Las variables ──
  await prueba("dice la variable exacta que falta, por cuenta", () => {
    assert.equal(faltaVariable("kev", {}), "META_SYSTEM_TOKEN")
    assert.equal(faltaVariable("kev", { META_SYSTEM_TOKEN: "t" }), "META_PAGE_ID")
    assert.equal(faltaVariable("kev", { META_SYSTEM_TOKEN: "t", META_PAGE_ID: "1" }), null)
    assert.equal(faltaVariable("casa-blanca", { META_SYSTEM_TOKEN: "t", META_PAGE_ID: "1" }), "CASA_BLANCA_META_TOKEN")
    assert.equal(faltaVariable("casa-blanca", { CASA_BLANCA_META_TOKEN: "t", CASA_BLANCA_META_PAGE_ID: "  " }), "CASA_BLANCA_META_PAGE_ID")
    assert.deepEqual(configurado("casa-blanca", { CASA_BLANCA_META_TOKEN: "t", CASA_BLANCA_META_PAGE_ID: "2" }), { ok: true })
    assert.deepEqual(configurado(undefined, {}), { ok: false, falta: "META_SYSTEM_TOKEN" })
  })
  await prueba("la URL del episodio es la de la web", () => {
    assert.equal(urlDelEpisodio("ep01-trailer"), "https://kevproject.world/casa-blanca/videos/ep01-trailer.mp4")
  })

  // ── Meta de mentira ──
  process.env.META_SYSTEM_TOKEN = "token-kev"
  process.env.META_PAGE_ID = "111"
  process.env.CASA_BLANCA_META_TOKEN = "token-cb"
  process.env.CASA_BLANCA_META_PAGE_ID = "222"

  type Llamada = { metodo: string; ruta: string; datos: Record<string, string> }
  let llamadas: Llamada[] = []
  let estadoContenedor = "IN_PROGRESS"
  // Rutas que no contestan nunca (solo las corta el AbortSignal de llamar()).
  let colgadas: string[] = []
  // media_publish falla y el contenedor pasa a PUBLISHED (otro pedido ganó).
  let publicaOtro = false
  globalThis.fetch = (async (entrada: string | URL, init?: RequestInit) => {
    const u = new URL(String(entrada))
    const metodo = init?.method ?? "GET"
    const datos = Object.fromEntries(metodo === "GET" ? u.searchParams : new URLSearchParams(String(init?.body)))
    const ruta = u.pathname.replace(/^\/v[\d.]+\//, "")
    llamadas.push({ metodo, ruta, datos })
    const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 })
    if (colgadas.some((c) => ruta.endsWith(c))) {
      return new Promise<Response>((_, rechazar) => {
        const s = init?.signal
        if (!s) return // sin señal colgaría para siempre: la prueba lo detecta por tiempo
        s.addEventListener("abort", () => rechazar(s.reason))
      })
    }
    if (publicaOtro && ruta.endsWith("/media_publish")) {
      estadoContenedor = "PUBLISHED"
      return new Response(JSON.stringify({ error: { message: "The media has already been published" } }), { status: 400 })
    }
    if (metodo === "GET" && (ruta === "111" || ruta === "222")) {
      return json({ access_token: `pagina-${ruta}`, instagram_business_account: { id: `ig-${ruta}` } })
    }
    if (ruta.endsWith("/media")) return json({ id: "900001" })
    if (ruta === "900001") return json({ status_code: estadoContenedor })
    if (ruta.endsWith("/media_publish")) return json({ id: "777" })
    if (ruta === "777") return json({ permalink: "https://www.instagram.com/reel/abc/" })
    if (ruta.endsWith("/videos")) return json({ id: "555" })
    return new Response(JSON.stringify({ error: { message: `ruta inesperada ${ruta}` } }), { status: 400 })
  }) as typeof fetch

  await prueba("casa-blanca usa SU token y SU página, nunca la de Kev", async () => {
    llamadas = []
    estadoContenedor = "FINISHED"
    const r = await publicar("casa-blanca", "video", base.url, "hola", ["ig", "fb"])
    assert.ok(r.ig?.ok && r.fb?.ok, JSON.stringify(r))
    assert.equal(llamadas[0].ruta, "222")
    assert.equal(llamadas[0].datos.access_token, "token-cb")
    assert.ok(llamadas.every((l) => !JSON.stringify(l).includes("111") && !JSON.stringify(l).includes("token-kev")))
  })
  await prueba("kev sigue usando META_SYSTEM_TOKEN y META_PAGE_ID", async () => {
    llamadas = []
    await publicar("kev", "foto", "https://kevproject.world/a.jpg", "", ["fb"])
    assert.equal(llamadas[0].ruta, "111")
    assert.equal(llamadas[0].datos.access_token, "token-kev")
  })
  await prueba("video en Instagram = REELS con video_url; en Facebook = /videos con file_url", async () => {
    llamadas = []
    estadoContenedor = "FINISHED"
    await publicar("casa-blanca", "video", base.url, "hola", ["ig", "fb"])
    const ig = llamadas.find((l) => l.ruta === "ig-222/media")!
    assert.equal(ig.datos.media_type, "REELS")
    assert.equal(ig.datos.video_url, base.url)
    const fb = llamadas.find((l) => l.ruta === "222/videos")!
    assert.equal(fb.datos.file_url, base.url)
    assert.equal(fb.datos.access_token, "pagina-222")
    // media_publish solo después de leer FINISHED.
    const iEstado = llamadas.findIndex((l) => l.ruta === "900001")
    const iPub = llamadas.findIndex((l) => l.ruta === "ig-222/media_publish")
    assert.ok(iEstado >= 0 && iPub > iEstado)
  })
  await prueba("si no termina a tiempo queda en proceso, sin publicar ni fallar", async () => {
    llamadas = []
    estadoContenedor = "IN_PROGRESS"
    const r = await publicar("casa-blanca", "video", base.url, "hola", ["ig"], 0)
    assert.ok(r.ig && !r.ig.ok && r.ig.pendiente === "900001", JSON.stringify(r.ig))
    assert.ok(!llamadas.some((l) => l.ruta.endsWith("/media_publish")))
  })
  await prueba("continuar publica cuando ya terminó", async () => {
    llamadas = []
    estadoContenedor = "FINISHED"
    const r = await continuar("casa-blanca", "900001", 0)
    assert.deepEqual(r, { ok: true, id: "777", enlace: "https://www.instagram.com/reel/abc/" })
  })
  await prueba("continuar sobre uno ya publicado no publica otra vez", async () => {
    llamadas = []
    estadoContenedor = "PUBLISHED"
    const r = await continuar("casa-blanca", "900001", 0)
    assert.ok(r.ok)
    assert.ok(!llamadas.some((l) => l.ruta.endsWith("/media_publish")))
  })
  await prueba("ERROR de Meta = no salió, con el motivo", async () => {
    estadoContenedor = "ERROR"
    const r = await continuar("casa-blanca", "900001", 0)
    assert.ok(!r.ok && !r.pendiente && /no pudo procesar/.test(r.error))
  })

  // ── Meta que no contesta ──
  await prueba("Instagram colgado: queda en proceso antes del corte y Facebook igual sale", async () => {
    llamadas = []
    estadoContenedor = "IN_PROGRESS"
    colgadas = ["900001"] // el GET de status_code no vuelve nunca
    const t0 = Date.now()
    const r = await publicar("casa-blanca", "video", base.url, "hola", ["ig", "fb"], 0)
    const ms = Date.now() - t0
    colgadas = []
    assert.ok(r.ig && !r.ig.ok && r.ig.pendiente === "900001", JSON.stringify(r.ig))
    assert.ok(r.fb?.ok, JSON.stringify(r.fb))
    // presupuesto 0 + margen de 10 s: con 45 s de presupuesto son 55, antes de los 60 de Vercel.
    assert.ok(ms >= 9_000 && ms < 11_500, `tardó ${ms} ms`)
    console.log(`     (cortó a los ${ms} ms)`)
  })
  await prueba("Facebook colgado: dice que no contestó, sin darlo por fallido ni colgar la ruta", async () => {
    llamadas = []
    colgadas = ["222/videos"]
    const t0 = Date.now()
    const r = await publicar("casa-blanca", "video", base.url, "hola", ["fb"], 0)
    const ms = Date.now() - t0
    colgadas = []
    assert.ok(r.fb && !r.fb.ok && /revisa la página antes de volver a publicarlo/.test(r.fb.error), JSON.stringify(r.fb))
    assert.ok(ms >= 7_000 && ms < 9_500, `tardó ${ms} ms`)
    console.log(`     (cortó a los ${ms} ms)`)
  })
  await prueba("continuar con la página colgada: sigue en proceso, no se pierde el id", async () => {
    colgadas = ["222"]
    const r = await continuar("casa-blanca", "900001", 0)
    colgadas = []
    assert.ok(!r.ok && r.pendiente === "900001", JSON.stringify(r))
  })
  await prueba("dos pedidos sobre el mismo reel: si media_publish falla y ya está PUBLISHED, salió", async () => {
    llamadas = []
    estadoContenedor = "FINISHED"
    publicaOtro = true
    const r = await continuar("casa-blanca", "900001", 0)
    publicaOtro = false
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(llamadas.filter((l) => l.ruta.endsWith("/media_publish")).length, 1)
  })
  await prueba("media_publish falla de verdad (no PUBLISHED): se dice el error de Meta", async () => {
    estadoContenedor = "FINISHED"
    const viejo = globalThis.fetch
    globalThis.fetch = (async (e: string | URL, i?: RequestInit) =>
      String(e).includes("/media_publish")
        ? new Response(JSON.stringify({ error: { message: "Permiso insuficiente" } }), { status: 400 })
        : viejo(e, i)) as typeof fetch
    const r = await continuar("casa-blanca", "900001", 0)
    globalThis.fetch = viejo
    assert.ok(!r.ok && !r.pendiente && r.error === "Permiso insuficiente", JSON.stringify(r))
  })

  clearInterval(vivo)
  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien")
  process.exit(fallos ? 1 : 0)
}

main()
