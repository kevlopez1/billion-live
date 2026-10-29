// Corre con: npx tsx lib/fabrica/guionista.test.ts
// Sin red: la IA es de mentira (devuelve lo que la prueba le dicta y anota cada pedido).
// Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import { contextoDePrueba, copia, guionBueno, salidaBuena } from "./datos-de-prueba"
import type { ContextoGuion } from "./guardas"
import { costoEstimado, escribirGuion, extraerJson, idDeVideo, MODELO_POR_DEFECTO, modeloGuion, slug, type PedidoIA, type PedirIA, type RespuestaIA } from "./guionista"
import type { Idea } from "./ideas"
import { FICCION } from "./textos"

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

const idea = (extra: Partial<Idea> = {}): Idea => ({
  pilar: "camara-oculta",
  personajes: ["napoleon", "suntzu"],
  par: "napoleon|suntzu",
  tema: "ajedrez partidas biblioteca",
  semilla: ["Napoleón perdió tres partidas de ajedrez contra Sun Tzu en la biblioteca."],
  fuentes: ["r1"],
  esReserva: false,
  puntaje: 8,
  ...extra,
})

const OK_REVISION = JSON.stringify({ ok: true, problemas: [] })

/** Una IA de mentira: el guion responde lo que dicta `guiones` en orden; la revisión, lo que dicta `revisiones`. */
function iaFalsa(guiones: Array<string | RespuestaIA>, revisiones: Array<string | RespuestaIA> = [OK_REVISION]) {
  const pedidos: PedidoIA[] = []
  let g = 0
  let r = 0
  const pedir: PedirIA = async (p) => {
    pedidos.push(p)
    const lista = p.paso === "guion" ? guiones : revisiones
    const i = p.paso === "guion" ? g++ : r++
    const x = lista[Math.min(i, lista.length - 1)]
    return typeof x === "string" ? { ok: true, texto: x, fin: "end_turn" } : x
  }
  return { pedir, pedidos }
}

const json = (x: unknown) => JSON.stringify(x)

async function main() {
  const ctx: ContextoGuion = await contextoDePrueba("2026-11-15")
  const bueno = json(salidaBuena())

  await prueba("JSON válido: sale el guion, con id, textos por red y luz verde", async () => {
    const ia = iaFalsa([bueno])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok, !r.ok ? `${r.motivo} · ${r.motivos.join(" | ")}` : "")
    if (!r.ok) return
    assert.equal(r.episodio.id, "fab-20261115-1-napoleon-no-sabe-perder")
    assert.equal(r.luz, "verde")
    assert.equal(r.intentos, 1)
    assert.equal(r.textos.porRed?.youtube?.split("\n")[0], FICCION)
    assert.ok(r.textos.porRed?.youtube?.includes("kevproject.world/casa-blanca"))
    assert.ok(!r.textos.porRed?.x?.includes("kevproject"))
    assert.match(r.hash, /^[0-9a-f]{64}$/)
    assert.deepEqual(ia.pedidos.map((p) => p.paso), ["guion", "revision"])
    assert.equal(ia.pedidos[0].modelo, MODELO_POR_DEFECTO)
    assert.ok(r.gastoUsd > 0)
  })

  await prueba("el JSON envuelto en ``` o con una frase antes también se lee", async () => {
    const ia = iaFalsa([`Aquí está:\n\`\`\`json\n${bueno}\n\`\`\``])
    const r = await escribirGuion({ idea: idea(), slot: 2, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok)
  })

  await prueba("JSON inválido → se repite una vez → sale", async () => {
    const ia = iaFalsa(["no es json", bueno])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.intentos === 2)
    assert.match(ia.pedidos[1].usuario, /no sirvió: JSON inválido/)
  })

  await prueba("JSON inválido dos veces → falla con el motivo", async () => {
    const ia = iaFalsa(["{ roto", json({ episodio: { titulo: "x" } })])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(!r.ok)
    if (r.ok) return
    assert.match(r.motivo, /dos respuestas sin JSON válido/)
    assert.match(r.motivo, /forma pedida/)
    assert.equal(ia.pedidos.length, 2)
  })

  await prueba("una respuesta cortada (max_tokens) cuenta como JSON inválido", async () => {
    const ia = iaFalsa([{ ok: true, texto: bueno.slice(0, 50), fin: "max_tokens" }, bueno])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.intentos === 2)
  })

  await prueba("un guion que falla las guardas 3 veces → rechazado, con las razones y las correcciones al modelo", async () => {
    const malo = copia(guionBueno())
    malo.planos[1].reunir = ["napoleon", "suntzu", "musk"]
    malo.planos[1].dialogo!.push({ quien: "musk", texto: "Vamos a Marte." })
    const ia = iaFalsa([json(salidaBuena(malo))])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(!r.ok)
    if (r.ok) return
    assert.match(r.motivo, /3 guiones seguidos/)
    assert.ok(r.motivos.some((m) => /musk/.test(m)))
    assert.equal(ia.pedidos.length, 3)
    assert.match(ia.pedidos[1].usuario, /EL INTENTO ANTERIOR SE RECHAZÓ[\s\S]*musk/)
  })

  await prueba("falla una vez y se corrige: sale en el segundo intento", async () => {
    const malo = copia(guionBueno())
    malo.planos[4].dur = 2 // 52,5 s: corto
    const ia = iaFalsa([json(salidaBuena(malo)), bueno])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.intentos === 2)
  })

  await prueba("con un amarillo (Kobe), sale amarillo: espera el OK de Kev", async () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "kobe"]
    ep.planos[1].dialogo![1].quien = "kobe"
    const ia = iaFalsa([json(salidaBuena(ep))])
    const r = await escribirGuion({ idea: idea({ personajes: ["napoleon", "kobe"], par: "kobe|napoleon" }), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.luz === "amarillo", !r.ok ? r.motivos.join(" | ") : "")
  })

  await prueba("una reserva con un amarillo → rechazada", async () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "kobe"]
    const ia = iaFalsa([json(salidaBuena(ep))])
    const r = await escribirGuion({ idea: idea({ esReserva: true }), slot: null, ctx }, { pedir: ia.pedir })
    assert.ok(!r.ok && r.motivos.some((m) => /reserva: solo personajes verdes/.test(m)))
  })

  await prueba("la reserva verde lleva «r» en el id", async () => {
    const ia = iaFalsa([bueno])
    const r = await escribirGuion({ idea: idea({ esReserva: true }), slot: null, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.episodio.id === "fab-20261115-r-napoleon-no-sabe-perder")
  })

  await prueba("la segunda pasada marca un problema → se reescribe; luego aprueba", async () => {
    const ia = iaFalsa([bueno, bueno], [json({ ok: false, problemas: ["Atribuye a Napoleón una frase inventada."] }), OK_REVISION])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(r.ok && r.intentos === 2)
    assert.match(ia.pedidos[2].usuario, /revisión: Atribuye a Napoleón/)
  })

  await prueba("si la segunda pasada no contesta o no da veredicto, el guion no sale (falla cerrado)", async () => {
    const caida = iaFalsa([bueno], [{ ok: false, como: "529 OverloadedError: Overloaded" }])
    const a = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: caida.pedir })
    assert.ok(!a.ok && /segunda pasada no respondió: 529/.test(a.motivo))
    const muda = iaFalsa([bueno], ["sí, está bien"])
    const b = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: muda.pedir })
    assert.ok(!b.ok && /no dio un veredicto/.test(b.motivo))
  })

  await prueba("si la IA no responde, vuelve con el cómo", async () => {
    const ia = iaFalsa([{ ok: false, como: "401 AuthenticationError: invalid x-api-key" }])
    const r = await escribirGuion({ idea: idea(), slot: 1, ctx }, { pedir: ia.pedir })
    assert.ok(!r.ok && /401 AuthenticationError/.test(r.motivo))
  })

  await prueba("tope de gasto: no se llama a la IA", async () => {
    const ia = iaFalsa([bueno])
    const montos: number[] = []
    const r = await escribirGuion(
      { idea: idea(), slot: 1, ctx },
      {
        pedir: ia.pedir,
        reservarGasto: async (usd) => {
          montos.push(usd)
          return false
        },
      },
    )
    assert.ok(!r.ok && /tope de gasto/.test(r.motivo))
    assert.equal(ia.pedidos.length, 0)
    assert.equal(montos.length, 1)
    assert.ok(montos[0] > 0 && montos[0] < 0.05, `estimado ${montos[0]}`)
  })

  await prueba("el prompt lleva el semáforo del día de salida y los límites", async () => {
    const ia = iaFalsa([bueno])
    await escribirGuion({ idea: idea(), slot: 1, ctx: { ...ctx, fechaSalida: "2026-11-09" } }, { pedir: ia.pedir })
    const s = ia.pedidos[0].sistema
    assert.match(s, /fuera \(no aparecen ni se nombran\): [^\n]*trump/)
    assert.match(s, /vivos \(SOLO de fondo[^\n]*musk/)
    assert.match(s, /Límites:/)
    assert.ok(!/- trump \(/.test(s), "la ficha de alguien fuera no va en el prompt")
  })

  await prueba("utilidades: slug, id, JSON, costo y modelo por env", () => {
    assert.equal(slug("¡Napoleón no duerme!"), "napoleon-no-duerme")
    assert.equal(idDeVideo("2026-11-15", 3, "Ñandú y café"), "fab-20261115-3-nandu-y-cafe")
    assert.deepEqual(extraerJson('x {"a":1} y'), { a: 1 })
    assert.throws(() => extraerJson("nada"))
    assert.ok(costoEstimado({ modelo: "claude-haiku-5-5", sistema: "a".repeat(35_000), usuario: "", maxTokens: 16_000 }) < 0.01)
    const antes = process.env.FABRICA_MODELO_GUION
    process.env.FABRICA_MODELO_GUION = "  claude-sonnet-5-5 "
    assert.equal(modeloGuion(), "claude-sonnet-5-5")
    if (antes === undefined) delete process.env.FABRICA_MODELO_GUION
    else process.env.FABRICA_MODELO_GUION = antes
  })

  console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
  process.exit(fallos ? 1 : 0)
}

main()
