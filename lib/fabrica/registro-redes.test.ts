// Corre con: npx tsx lib/fabrica/registro-redes.test.ts
// Sin red ni base: qué redes entran al registro según el entorno, qué
// variable falta cuando no entran, y que el Ctx real lea los tokens de
// fabrica_tokens (base en memoria) y use el almacén inyectado.

import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { prueba, almacenFalso, terminar } from "./redes/falso"
import { ADAPTADORES, adaptadores, avisosDeConfiguracion, ctxReal, diagnostico, faltanDe } from "./registro-redes"
import { cifrar, type BaseTokens, type FilaToken } from "./tokens"
import { REDES, type Entorno } from "./tipos"

const clave = randomBytes(32).toString("hex")

/** Todo lo que piden las cinco redes. */
const COMPLETO: Entorno = {
  FABRICA_YT_CLIENT_ID: "yt-id",
  FABRICA_YT_CLIENT_SECRET: "yt-secreto",
  FABRICA_X_CLIENT_ID: "x-id",
  FABRICA_X_CLIENT_SECRET: "x-secreto",
  FABRICA_CLAVE_TOKENS: clave,
  SUPABASE_SERVICE_ROLE_KEY: "service",
  CASA_BLANCA_META_TOKEN: "meta",
  CASA_BLANCA_META_PAGE_ID: "123",
  FABRICA_UPLOADPOST_KEY: "up",
  FABRICA_UPLOADPOST_USUARIO: "casa",
  FABRICA_UPLOADPOST_AIGC_PROBADO: "true",
}
const TODAS_ENCENDIDAS: Entorno = {
  FABRICA_ACTIVA: "true",
  FABRICA_YOUTUBE_ACTIVA: "1",
  FABRICA_X_ACTIVA: "on",
  FABRICA_INSTAGRAM_ACTIVA: "sí",
  FABRICA_FACEBOOK_ACTIVA: "si",
  FABRICA_TIKTOK_ACTIVA: "true",
}

const callar = () => {}

async function main() {
  await prueba("cada red tiene su adaptador y el adaptador dice ser de esa red", () => {
    for (const r of REDES) assert.equal(ADAPTADORES[r].red, r)
  })

  await prueba("todo configurado y encendido: entran las cinco", () => {
    const logs: string[] = []
    const a = adaptadores({ ...COMPLETO, ...TODAS_ENCENDIDAS }, (m) => logs.push(m))
    assert.deepEqual(Object.keys(a).sort(), [...REDES].sort())
    assert.deepEqual(logs, [])
  })

  await prueba("sin FABRICA_ACTIVA no entra ninguna, aunque cada red esté encendida", () => {
    assert.deepEqual(adaptadores({ ...COMPLETO, ...TODAS_ENCENDIDAS, FABRICA_ACTIVA: "false" }, callar), {})
    assert.deepEqual(adaptadores({ ...COMPLETO, ...TODAS_ENCENDIDAS, FABRICA_ACTIVA: undefined }, callar), {})
  })

  await prueba("\"false\" en la variable de una red la deja afuera (flag, no if de cadena)", () => {
    const a = adaptadores({ ...COMPLETO, ...TODAS_ENCENDIDAS, FABRICA_X_ACTIVA: "false", FABRICA_TIKTOK_ACTIVA: "" }, callar)
    assert.ok(!a.x && !a.tiktok)
    assert.ok(a.youtube && a.instagram && a.facebook)
  })

  await prueba("encendida sin configurar: no entra y el log nombra la variable que falta", () => {
    const logs: string[] = []
    const env = { ...COMPLETO, ...TODAS_ENCENDIDAS, FABRICA_YT_CLIENT_SECRET: "  ", CASA_BLANCA_META_PAGE_ID: undefined }
    const a = adaptadores(env, (m) => logs.push(m))
    assert.ok(!a.youtube && !a.instagram && !a.facebook)
    assert.ok(a.x && a.tiktok)
    assert.ok(logs.some((l) => /youtube encendida pero sin configurar: falta FABRICA_YT_CLIENT_SECRET/.test(l)), logs.join("\n"))
    assert.ok(logs.some((l) => /instagram .*falta CASA_BLANCA_META_PAGE_ID/.test(l)))
    assert.ok(logs.some((l) => /facebook .*falta CASA_BLANCA_META_PAGE_ID/.test(l)))
  })

  await prueba("una red apagada sin configurar no ensucia el log", () => {
    const logs: string[] = []
    adaptadores({ ...COMPLETO, FABRICA_ACTIVA: "true", FABRICA_YOUTUBE_ACTIVA: "true", FABRICA_X_CLIENT_ID: undefined }, (m) => logs.push(m))
    assert.deepEqual(logs, [])
  })

  await prueba("faltanDe: lo que pide cada red, con el nombre exacto", () => {
    assert.deepEqual(faltanDe("youtube", {}), ["FABRICA_YT_CLIENT_ID", "FABRICA_YT_CLIENT_SECRET", "FABRICA_CLAVE_TOKENS", "SUPABASE_SERVICE_ROLE_KEY"])
    assert.deepEqual(faltanDe("x", {}), ["FABRICA_X_CLIENT_ID", "FABRICA_X_CLIENT_SECRET", "FABRICA_CLAVE_TOKENS", "SUPABASE_SERVICE_ROLE_KEY"])
    assert.deepEqual(faltanDe("instagram", {}), ["CASA_BLANCA_META_TOKEN", "CASA_BLANCA_META_PAGE_ID"])
    assert.deepEqual(faltanDe("facebook", { META_SYSTEM_TOKEN: "t", META_PAGE_ID: "p" }), ["CASA_BLANCA_META_TOKEN", "CASA_BLANCA_META_PAGE_ID"])
    const tk = faltanDe("tiktok", { FABRICA_UPLOADPOST_KEY: "k", FABRICA_UPLOADPOST_USUARIO: "u", FABRICA_UPLOADPOST_AIGC_PROBADO: "false" })
    assert.equal(tk.length, 1)
    assert.match(tk[0], /^FABRICA_UPLOADPOST_AIGC_PROBADO/)
    assert.match(faltanDe("x", { ...COMPLETO, FABRICA_CLAVE_TOKENS: "corta" })[0], /FABRICA_CLAVE_TOKENS \(no mide 32 bytes/)
    for (const r of REDES) assert.deepEqual(faltanDe(r, COMPLETO), [], r)
  })

  await prueba("diagnostico: dice por red si está encendida, qué falta y el almacén", () => {
    const d = diagnostico({ ...COMPLETO, FABRICA_ACTIVA: "1", FABRICA_X_ACTIVA: "1", FABRICA_ALMACEN: "blob" })
    assert.equal(d.activa, true)
    const x = d.redes.find((r) => r.red === "x")!
    assert.deepEqual(x, { red: "x", variable: "FABRICA_X_ACTIVA", encendida: true, faltan: [], lista: true })
    assert.equal(d.redes.find((r) => r.red === "youtube")!.lista, false)
    assert.match(d.almacen[0], /Vercel Blob/)
    assert.ok(avisosDeConfiguracion({ ...COMPLETO, ...TODAS_ENCENDIDAS, FABRICA_ALMACEN: "blob" }).some((a) => /sin almacén/.test(a)))
  })

  await prueba("ctxReal: el token sale de fabrica_tokens (descifrado) y el almacén es el inyectado", async () => {
    const vigente = cifrar({ refresh: "r", acceso: "acceso-yt", accesoExpira: "2026-11-12T18:00:00Z" }, Buffer.from(clave, "hex"))
    const base: BaseTokens = {
      leer: async (red): Promise<FilaToken | null> => (red === "youtube" ? { red, cifrado: vigente, version: 1, expira_en: null, renovando_hasta: null } : null),
      reservar: async () => null,
      rotar: async () => false,
      anotarError: async () => {},
      guardar: async () => {},
    }
    const errores: string[] = []
    const original = console.error
    console.error = (m: string) => errores.push(m)
    try {
      const c = ctxReal(COMPLETO, { baseTokens: base, almacen: almacenFalso, ahora: () => new Date("2026-11-12T16:00:00Z"), fetch: (async () => new Response("no")) as typeof fetch, log: callar })
      assert.equal(await c.token("youtube"), "acceso-yt")
      assert.equal(await c.token("x"), null)
      // Por qué fue null, para el adaptador: sin cargar = no_hoy (no fallido).
      assert.equal(c.tokenFallo?.("x")?.clase, "no_hoy")
      assert.equal(c.almacen, almacenFalso)
    } finally {
      console.error = original
    }
    assert.ok(errores.some((e) => /sin token de x \(no_hoy\): .*no hay token de x en fabrica_tokens/.test(e)), errores.join("\n"))
  })

  await prueba("ctxReal: sin base de tokens ni almacén, null con el cómo en el log", async () => {
    const errores: string[] = []
    const original = console.error
    console.error = (m: string) => errores.push(m)
    try {
      const c = ctxReal({}, { baseTokens: null, storage: null, log: callar })
      assert.equal(await c.token("youtube"), null)
      assert.equal(c.almacen, null)
    } finally {
      console.error = original
    }
    assert.ok(errores.some((e) => /token de youtube: sin base de tokens \(falta SUPABASE_SERVICE_ROLE_KEY\)/.test(e)))
    assert.ok(errores.some((e) => /sin almacén: falta SUPABASE_SERVICE_ROLE_KEY/.test(e)))
  })

  await prueba("todo encendido sin ninguna variable: el registro queda vacío", () => {
    const a = adaptadores({ ...TODAS_ENCENDIDAS }, callar)
    assert.deepEqual(a, {})
  })

  terminar()
}

void main()
