// Corre con: npx tsx lib/fabrica/tokens.test.ts
// Sin red ni base: una base en memoria con la MISMA semántica que
// fabrica_reservar_token y fabrica_rotar_token (UPDATE condicional).

import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { prueba, terminar } from "./redes/falso"
import { accesoVigente, cifrar, claveDe, descifrar, tokenPara, type BaseTokens, type FilaToken, type Renovador } from "./tokens"

const clave = randomBytes(32)
const env = { FABRICA_CLAVE_TOKENS: clave.toString("hex") }
const ahora = new Date("2026-11-12T16:00:00Z")

/** La base en memoria. `antesDeRotar` deja simular a otro proceso entre renovar y rotar. */
function baseMemoria(inicial: { refresh: string; acceso?: string; accesoExpira?: string } | null) {
  const filas = new Map<string, FilaToken & { ultimo_error: string | null }>()
  let reloj = ahora.getTime()
  if (inicial) filas.set("x", { red: "x", cifrado: cifrar(inicial, clave), version: 1, expira_en: null, renovando_hasta: null, ultimo_error: null })
  const hooks: { antesDeRotar?: () => void } = {}
  const base: BaseTokens = {
    leer: async (red) => {
      const f = filas.get(red)
      return f ? { ...f } : null
    },
    reservar: async (red, venceSeg) => {
      const f = filas.get(red)
      if (!f || (f.renovando_hasta && Date.parse(f.renovando_hasta) >= reloj)) return null
      f.renovando_hasta = new Date(reloj + venceSeg * 1000).toISOString()
      return { ...f }
    },
    rotar: async (red, version, cifrado, expira) => {
      hooks.antesDeRotar?.()
      const f = filas.get(red)
      if (!f || f.version !== version) return false
      Object.assign(f, { cifrado, version: version + 1, expira_en: expira, renovando_hasta: null, ultimo_error: null })
      return true
    },
    anotarError: async (red, como) => {
      const f = filas.get(red)
      if (f) Object.assign(f, { ultimo_error: como, renovando_hasta: null })
    },
    guardar: async () => {},
  }
  return { base, filas, hooks, avanzar: (ms: number) => (reloj += ms) }
}

const renovadorX = (contador: { n: number }, prefijo = "r"): Renovador => async (refresh) => {
  contador.n++
  return { ok: true, acceso: `a-${refresh}`, expiraEn: new Date(ahora.getTime() + 7200_000).toISOString(), refresh: `${prefijo}${contador.n + 1}` }
}

async function main() {
  await prueba("cifrar/descifrar ida y vuelta; otra clave o un byte tocado = error", () => {
    const s = cifrar({ refresh: "r1", acceso: "a1" }, clave)
    assert.equal(s.split(".").length, 3)
    assert.deepEqual(descifrar(s, clave), { refresh: "r1", acceso: "a1" })
    assert.throws(() => descifrar(s, randomBytes(32)))
    const [iv, tag, datos] = s.split(".")
    const tocado = Buffer.from(datos, "base64")
    tocado[0] ^= 1
    assert.throws(() => descifrar([iv, tag, tocado.toString("base64")].join("."), clave))
  })

  await prueba("claveDe: hex o base64 de 32 bytes; otra cosa = null", () => {
    assert.ok(claveDe({ FABRICA_CLAVE_TOKENS: clave.toString("hex") })?.equals(clave))
    assert.ok(claveDe({ FABRICA_CLAVE_TOKENS: clave.toString("base64") })?.equals(clave))
    assert.equal(claveDe({ FABRICA_CLAVE_TOKENS: "corta" }), null)
    assert.equal(claveDe({}), null)
  })

  await prueba("acceso vigente: se usa sin renovar ni reservar", async () => {
    const m = baseMemoria({ refresh: "r1", acceso: "a-viejo", accesoExpira: new Date(ahora.getTime() + 3600_000).toISOString() })
    const n = { n: 0 }
    const r = await accesoVigente("x", { base: m.base, env, fetch, ahora: () => ahora, renovadores: { x: renovadorX(n) } })
    assert.deepEqual(r, { ok: true, acceso: "a-viejo" })
    assert.equal(n.n, 0)
    assert.equal(m.filas.get("x")!.renovando_hasta, null)
  })

  await prueba("vencido: reserva → renueva → rota; el refresh NUEVO queda guardado y la versión sube", async () => {
    const m = baseMemoria({ refresh: "r1" })
    const n = { n: 0 }
    const r = await accesoVigente("x", { base: m.base, env, fetch, ahora: () => ahora, renovadores: { x: renovadorX(n) }, log: () => {} })
    assert.deepEqual(r, { ok: true, acceso: "a-r1" })
    const f = m.filas.get("x")!
    assert.equal(f.version, 2)
    assert.equal(f.renovando_hasta, null)
    assert.equal(descifrar(f.cifrado, clave).refresh, "r2")
  })

  await prueba("dos a la vez: uno solo renueva (el refresh de X es de un solo uso), el otro lee el suyo", async () => {
    const m = baseMemoria({ refresh: "r1" })
    const n = { n: 0 }
    const lento: Renovador = async (refresh, p) => {
      await new Promise((ok) => setTimeout(ok, 30))
      return renovadorX(n)(refresh, p)
    }
    const puertos = { base: m.base, env, fetch, ahora: () => ahora, renovadores: { x: lento }, dormir: async () => new Promise<void>((ok) => setTimeout(ok, 20)), log: () => {} }
    const [a, b] = await Promise.all([accesoVigente("x", puertos), accesoVigente("x", puertos)])
    assert.equal(n.n, 1, "se renovó dos veces: el segundo habría gastado un refresh ya usado")
    assert.deepEqual(a, { ok: true, acceso: "a-r1" })
    assert.deepEqual(b, { ok: true, acceso: "a-r1" })
  })

  await prueba("rotación con versión vieja: no pisa, relee y usa la del otro", async () => {
    const m = baseMemoria({ refresh: "r1" })
    const n = { n: 0 }
    // Mientras este renovaba, la reserva venció y otro rotó (versión 2, con su acceso).
    m.hooks.antesDeRotar = () => {
      const f = m.filas.get("x")!
      if (f.version === 1) {
        Object.assign(f, {
          version: 2,
          cifrado: cifrar({ refresh: "r-otro", acceso: "a-otro", accesoExpira: new Date(ahora.getTime() + 7200_000).toISOString() }, clave),
          renovando_hasta: null,
        })
      }
    }
    const r = await accesoVigente("x", { base: m.base, env, fetch, ahora: () => ahora, renovadores: { x: renovadorX(n) }, log: () => {} })
    assert.deepEqual(r, { ok: true, acceso: "a-otro" })
    assert.equal(descifrar(m.filas.get("x")!.cifrado, clave).refresh, "r-otro", "pisó la rotación del otro")
  })

  await prueba("renovación fallida: anota ultimo_error con el cómo y suelta la reserva", async () => {
    const m = baseMemoria({ refresh: "r1" })
    const mal: Renovador = async () => ({ ok: false, clase: "fatal", como: "x.token: HTTP 400 invalid_request · reautorizar X" })
    const viejo = console.error
    console.error = () => {}
    const r = await accesoVigente("x", { base: m.base, env, fetch, ahora: () => ahora, renovadores: { x: mal } })
    console.error = viejo
    assert.ok(!r.ok && r.clase === "fatal")
    const f = m.filas.get("x")!
    assert.match(f.ultimo_error ?? "", /reautorizar/)
    assert.equal(f.renovando_hasta, null)
    assert.equal(descifrar(f.cifrado, clave).refresh, "r1", "no se tocó el refresh guardado")
  })

  await prueba("sin fila, sin clave o con la clave cambiada: fatal con el cómo (y tokenPara devuelve null, logueado)", async () => {
    const vacia = baseMemoria(null)
    const r1 = await accesoVigente("x", { base: vacia.base, env, fetch, ahora: () => ahora, renovadores: {} })
    assert.ok(!r1.ok && /cargar-token/.test(r1.como))
    const r2 = await accesoVigente("x", { base: baseMemoria({ refresh: "r" }).base, env: {}, fetch, ahora: () => ahora, renovadores: {} })
    assert.ok(!r2.ok && /FABRICA_CLAVE_TOKENS/.test(r2.como))
    const r3 = await accesoVigente("x", { base: baseMemoria({ refresh: "r" }).base, env: { FABRICA_CLAVE_TOKENS: randomBytes(32).toString("hex") }, fetch, ahora: () => ahora, renovadores: {} })
    assert.ok(!r3.ok && /descifrar/.test(r3.como))
    const logs: string[] = []
    const viejo = console.error
    console.error = (m: string) => logs.push(m)
    const t = await tokenPara({ base: vacia.base, env, fetch, ahora: () => ahora, renovadores: {} })("x")
    console.error = viejo
    assert.equal(t, null)
    assert.ok(logs.some((l) => /sin token de x/.test(l)))
  })

  terminar()
}

main()
