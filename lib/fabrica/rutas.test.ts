// Corre con: npx tsx lib/fabrica/rutas.test.ts
// Las rutas de la fábrica sin clave, con la equivocada y con permisos de
// menos. Todo se corta ANTES de tocar la base: sin red ni base.

import assert from "node:assert/strict"
import { conLlave } from "./auth"
import { sinPermiso, validarPedidoEstado } from "./estado-pedido"

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

const CRON = "c".repeat(32)
const VIGILANTE = "v".repeat(32)
const ADMIN = "a".repeat(32)
const pedido = (url: string, auth?: string, cuerpo?: unknown, metodo = "POST") =>
  new Request(`https://kevproject.world${url}`, {
    method: metodo,
    headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  })

async function main() {
  // Sin base: si una ruta llegara a tocarla, respondería 500 "Falta SUPABASE…", no 401/403.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.FABRICA_CRON_SECRET = CRON
  process.env.FABRICA_VIGILANTE_SECRET = VIGILANTE
  process.env.ADMIN_SECRET = ADMIN

  const tick = await import("../../app/api/fabrica/tick/route")
  const estado = await import("../../app/api/fabrica/estado/route")
  const vigilante = await import("../../app/api/fabrica/vigilante/route")

  await prueba("conLlave: sin cabecera, equivocada, buena, y clave corta = sin-clave", () => {
    const env = { FABRICA_CRON_SECRET: CRON }
    assert.equal(conLlave(pedido("/x"), "FABRICA_CRON_SECRET", env), false)
    assert.equal(conLlave(pedido("/x", `Bearer ${CRON}x`), "FABRICA_CRON_SECRET", env), false)
    assert.equal(conLlave(pedido("/x", `Bearer ${CRON}`), "FABRICA_CRON_SECRET", env), true)
    assert.equal(conLlave(pedido("/x", "Bearer corta"), "FABRICA_CRON_SECRET", { FABRICA_CRON_SECRET: "corta" }), "sin-clave")
    assert.equal(conLlave(pedido("/x", "Bearer "), "FABRICA_CRON_SECRET", {}), "sin-clave")
  })

  await prueba("tick: sin clave → 401; la del vigilante no sirve → 401; la buena pasa al tick", async () => {
    assert.equal((await tick.POST(pedido("/api/fabrica/tick"))).status, 401)
    assert.equal((await tick.POST(pedido("/api/fabrica/tick", `Bearer ${VIGILANTE}`))).status, 401)
    assert.equal((await tick.POST(pedido("/api/fabrica/tick", `Bearer ${ADMIN}`))).status, 401)
    const r = await tick.POST(pedido("/api/fabrica/tick", `Bearer ${CRON}`))
    assert.equal(r.status, 500)
    assert.match((await r.json()).error, /SUPABASE_SERVICE_ROLE_KEY/)
  })

  await prueba("tick: maxDuration de 60 s (el presupuesto del tick es 45)", () => {
    assert.equal(tick.maxDuration, 60)
  })

  await prueba("tick: sin FABRICA_CRON_SECRET → 500 que lo dice (no un 401 mudo)", async () => {
    delete process.env.FABRICA_CRON_SECRET
    const r = await tick.POST(pedido("/api/fabrica/tick", `Bearer ${CRON}`))
    assert.equal(r.status, 500)
    assert.match((await r.json()).error, /FABRICA_CRON_SECRET/)
    process.env.FABRICA_CRON_SECRET = CRON
  })

  await prueba("estado: GET y POST sin clave → 401", async () => {
    assert.equal((await estado.GET(pedido("/api/fabrica/estado", undefined, undefined, "GET"))).status, 401)
    assert.equal((await estado.POST(pedido("/api/fabrica/estado", undefined, { accion: "pausar", motivo: "prueba" }))).status, 401)
    assert.equal((await estado.POST(pedido("/api/fabrica/estado", `Bearer ${CRON}`, { accion: "pausar", motivo: "prueba" }))).status, 401)
  })

  await prueba("estado: el vigilante pausa pero NO reanuda ni ajusta (403), y no lee el panel", async () => {
    const reanudar = await estado.POST(pedido("/api/fabrica/estado", `Bearer ${VIGILANTE}`, { accion: "reanudar" }))
    assert.equal(reanudar.status, 403)
    const ajustar = await estado.POST(pedido("/api/fabrica/estado", `Bearer ${VIGILANTE}`, { accion: "ajustar", videos_por_dia: 6 }))
    assert.equal(ajustar.status, 403)
    assert.equal((await estado.GET(pedido("/api/fabrica/estado", `Bearer ${VIGILANTE}`, undefined, "GET"))).status, 401)
    // Pausar sí llega a la base (aquí no hay: 500 que lo dice).
    const pausar = await estado.POST(pedido("/api/fabrica/estado", `Bearer ${VIGILANTE}`, { accion: "pausar", motivo: "correo de YouTube" }))
    assert.equal(pausar.status, 500)
  })

  await prueba("estado: pedido inválido → 400 con el porqué", async () => {
    const r = await estado.POST(pedido("/api/fabrica/estado", `Bearer ${ADMIN}`, { accion: "pausar" }))
    assert.equal(r.status, 400)
    assert.match((await r.json()).error, /motivo/)
    assert.equal(validarPedidoEstado({ accion: "ajustar" }).ok, false)
    assert.equal(validarPedidoEstado({ accion: "ajustar", videos_por_dia: 7 }).ok, false)
    assert.equal(validarPedidoEstado({ accion: "pausar", motivo: "ok ok", red: "myspace" }).ok, false)
    assert.equal(validarPedidoEstado({ accion: "pausar", motivo: "ok ok", red: "x" }).ok, true)
  })

  await prueba("estado: el equipo pausa solo si está en FABRICA_PAUSA_EQUIPO; reanudar es de Kev", () => {
    const p = validarPedidoEstado({ accion: "pausar", motivo: "se ve mal" })
    const r = validarPedidoEstado({ accion: "reanudar" })
    assert.ok(p.ok && r.ok)
    const env = { FABRICA_PAUSA_EQUIPO: "Editor, filmmaker" }
    assert.equal(sinPermiso({ rol: "equipo", nombre: "editor" }, p.pedido, env), null)
    assert.notEqual(sinPermiso({ rol: "equipo", nombre: "otro" }, p.pedido, env), null)
    assert.notEqual(sinPermiso({ rol: "equipo", nombre: "editor" }, r.pedido, env), null)
    assert.equal(sinPermiso({ rol: "kev" }, r.pedido, env), null)
  })

  await prueba("vigilante: sin clave o con la del cron → 401", async () => {
    assert.equal((await vigilante.GET(pedido("/api/fabrica/vigilante", undefined, undefined, "GET"))).status, 401)
    assert.equal((await vigilante.GET(pedido("/api/fabrica/vigilante", `Bearer ${CRON}`, undefined, "GET"))).status, 401)
  })

  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\ntodo bien")
  process.exit(fallos ? 1 : 0)
}

main()
