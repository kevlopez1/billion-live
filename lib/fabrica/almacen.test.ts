// Corre con: npx tsx lib/fabrica/almacen.test.ts
// Sin red ni base: un Supabase Storage en memoria con la misma forma que
// db.storage (getBucket, createBucket, from().upload/createSignedUrl/remove).

import assert from "node:assert/strict"
import { almacenDesdeEnv, backendSupabase, configDe, crearAlmacen, horasDeFirma, rutaDelVideo, rutaInvalida, type StorageSupabase } from "./almacen"
import { prueba, terminar } from "./redes/falso"

const MB = 1024 * 1024

function storageMemoria(o: { bucket?: { public: boolean } | null; fallaSubir?: string; fallaFirmar?: string } = {}) {
  const archivos = new Map<string, { datos: Uint8Array; tipo: string; upsert: boolean }>()
  let bucket = o.bucket === undefined ? { public: false } : o.bucket
  const llamadas: string[] = []
  const creados: { public: boolean; fileSizeLimit?: number | string | null }[] = []
  const s: StorageSupabase = {
    getBucket: async (id) => {
      llamadas.push(`getBucket ${id}`)
      return bucket ? { data: { ...bucket }, error: null } : { data: null, error: { message: "Bucket not found", statusCode: "404" } }
    },
    createBucket: async (id, opc) => {
      llamadas.push(`createBucket ${id}`)
      creados.push(opc)
      bucket = { public: opc.public }
      return { data: { name: id }, error: null }
    },
    from: (b) => ({
      upload: async (ruta, datos, opc) => {
        llamadas.push(`upload ${b}/${ruta}`)
        if (o.fallaSubir) return { data: null, error: { message: o.fallaSubir, statusCode: "413" } }
        archivos.set(ruta, { datos, tipo: opc.contentType, upsert: opc.upsert })
        return { data: { path: ruta }, error: null }
      },
      createSignedUrl: async (ruta, seg) => {
        llamadas.push(`firmar ${b}/${ruta} ${seg}`)
        if (o.fallaFirmar) return { data: null, error: { message: o.fallaFirmar } }
        return { data: { signedUrl: `https://sb.prueba/storage/v1/object/sign/${b}/${ruta}?token=t&s=${seg}` }, error: null }
      },
      remove: async (rutas) => {
        llamadas.push(`remove ${b}/${rutas.join(",")}`)
        for (const r of rutas) archivos.delete(r)
        return { data: [], error: null }
      },
    }),
  }
  return { s, archivos, llamadas, creados }
}

const env = { SUPABASE_SERVICE_ROLE_KEY: "clave", FABRICA_BUCKET: "videos-casa" }
const silencio = () => {}

async function main() {
  await prueba("rutas: la del video es <día>/<id>.mp4 y se rechazan las peligrosas", () => {
    assert.equal(rutaDelVideo("2026-11-12", "v1"), "2026-11-12/v1.mp4")
    assert.equal(rutaInvalida("2026-11-12/v1.mp4"), null)
    for (const mala of ["", "/a.mp4", "a/../b.mp4", "a//b.mp4", "a b.mp4", "a/b/", "ñ.mp4", "./a.mp4"]) {
      assert.ok(rutaInvalida(mala), `debería rechazar "${mala}"`)
    }
  })

  await prueba("firma: nunca menos de 24 h ni más de 7 días", () => {
    assert.equal(horasDeFirma(1), 24)
    assert.equal(horasDeFirma(24), 24)
    assert.equal(horasDeFirma(30.2), 31)
    assert.equal(horasDeFirma(1000), 168)
    assert.equal(horasDeFirma(Number.NaN), 24)
  })

  await prueba("subir: revisa que el bucket sea privado una sola vez y sube con upsert", async () => {
    const m = storageMemoria()
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await a.subir("2026-11-12/v1.mp4", new Uint8Array(10), "video/mp4")
    await a.subir("2026-11-12/v2.mp4", new Uint8Array(10), "video/mp4")
    assert.equal(m.llamadas.filter((l) => l.startsWith("getBucket")).length, 1)
    assert.equal(m.archivos.get("2026-11-12/v1.mp4")?.tipo, "video/mp4")
    assert.equal(m.archivos.get("2026-11-12/v1.mp4")?.upsert, true)
  })

  await prueba("subir: un bucket PÚBLICO no recibe nada y el error lo dice", async () => {
    const m = storageMemoria({ bucket: { public: true } })
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await assert.rejects(a.subir("2026-11-12/v1.mp4", new Uint8Array(10), "video/mp4"), /PÚBLICO/)
    assert.equal(m.archivos.size, 0)
    assert.ok(!m.llamadas.some((l) => l.startsWith("upload")))
  })

  await prueba("subir: sin bucket, lo crea privado con el límite por archivo", async () => {
    const m = storageMemoria({ bucket: null })
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await a.subir("2026-11-12/v1.mp4", new Uint8Array(10), "video/mp4")
    assert.deepEqual(m.creados, [{ public: false, fileSizeLimit: 50 * MB }])
    assert.ok(m.archivos.has("2026-11-12/v1.mp4"))
  })

  await prueba("subir: más pesado que el límite no se sube, y dice cuánto pesa y cuál es el límite", async () => {
    const m = storageMemoria()
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 1 * MB, log: silencio })
    await assert.rejects(a.subir("2026-11-12/v1.mp4", new Uint8Array(2 * MB), "video/mp4"), /pesa 2,0 MB y el límite del almacén es 1,0 MB/)
    assert.equal(m.llamadas.length, 0)
  })

  await prueba("subir: vacío o ruta mala no llegan al servicio", async () => {
    const m = storageMemoria()
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 1 * MB, log: silencio })
    await assert.rejects(a.subir("2026-11-12/v1.mp4", new Uint8Array(0), "video/mp4"), /vacío/)
    await assert.rejects(a.subir("../v1.mp4", new Uint8Array(1), "video/mp4"), /\.\./)
    assert.equal(m.llamadas.length, 0)
  })

  await prueba("subir: el error del servicio sale con el cómo (mensaje y código)", async () => {
    const m = storageMemoria({ fallaSubir: "The object exceeded the maximum allowed size" })
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await assert.rejects(a.subir("2026-11-12/v1.mp4", new Uint8Array(5), "video/mp4"), /maximum allowed size \(código 413\)/)
  })

  await prueba("urlFirmada: pide 24 h aunque se pidan 2, en segundos, y devuelve la URL https", async () => {
    const m = storageMemoria()
    const logs: string[] = []
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: (l) => logs.push(l) })
    const url = await a.urlFirmada("2026-11-12/v1.mp4", 2)
    assert.match(url, /^https:\/\/sb\.prueba\/.*s=86400$/)
    assert.ok(m.llamadas.includes("firmar videos-casa/2026-11-12/v1.mp4 86400"))
    assert.ok(logs.some((l) => /se pidieron 2 h y se dan 24 h/.test(l)))
  })

  await prueba("urlFirmada: el error de firma sale con la ruta y el mensaje", async () => {
    const m = storageMemoria({ fallaFirmar: "Object not found" })
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await assert.rejects(a.urlFirmada("2026-11-12/v1.mp4", 24), /firmar 2026-11-12\/v1\.mp4 .*Object not found/)
  })

  await prueba("borrar: quita el archivo; borrar lo que ya no está no es un error", async () => {
    const m = storageMemoria()
    const a = crearAlmacen(backendSupabase(m.s, "videos-casa"), { limiteBytes: 50 * MB, log: silencio })
    await a.subir("2026-11-12/v1.mp4", new Uint8Array(3), "video/mp4")
    await a.borrar("2026-11-12/v1.mp4")
    assert.equal(m.archivos.size, 0)
    await a.borrar("2026-11-12/v1.mp4")
  })

  await prueba("borrar: un 'not found' del servicio cuenta como borrado; otro error no", async () => {
    const s: StorageSupabase = {
      getBucket: async () => ({ data: { public: false }, error: null }),
      createBucket: async () => ({ data: null, error: null }),
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: null, error: null }),
        remove: async (r) => (r[0] === "a/ya-no.mp4" ? { data: null, error: { message: "Object not found", statusCode: "404" } } : { data: null, error: { message: "permission denied", statusCode: "403" } }),
      }),
    }
    const a = crearAlmacen(backendSupabase(s, "b"), { limiteBytes: MB, log: silencio })
    await a.borrar("a/ya-no.mp4")
    await assert.rejects(a.borrar("a/otro.mp4"), /permission denied \(código 403\)/)
  })

  await prueba("configDe: supabase por defecto; blob y valores raros dicen qué falta", () => {
    const c = configDe(env)
    assert.ok(c.ok)
    if (c.ok) {
      assert.equal(c.config.tipo, "supabase")
      assert.equal(c.config.bucket, "videos-casa")
      assert.equal(c.config.limiteBytes, 50 * MB)
    }
    const sinBucket = configDe({ SUPABASE_SERVICE_ROLE_KEY: "k" })
    assert.ok(sinBucket.ok && sinBucket.config.bucket === "fabrica-videos")
    const limite = configDe({ ...env, FABRICA_LIMITE_MB: "200" })
    assert.ok(limite.ok && limite.config.limiteBytes === 200 * MB)
    const blob = configDe({ ...env, FABRICA_ALMACEN: "blob" })
    assert.ok(!blob.ok && /Vercel Blob/.test(blob.faltan[0]))
    const raro = configDe({ ...env, FABRICA_ALMACEN: "s3" })
    assert.ok(!raro.ok && /"s3"/.test(raro.faltan[0]))
    const sinClave = configDe({ FABRICA_BUCKET: "x" })
    assert.ok(!sinClave.ok && /SUPABASE_SERVICE_ROLE_KEY/.test(sinClave.faltan[0]))
    const malBucket = configDe({ ...env, FABRICA_BUCKET: "a/b" })
    assert.ok(!malBucket.ok && /FABRICA_BUCKET/.test(malBucket.faltan[0]))
  })

  await prueba("almacenDesdeEnv: sin configuración devuelve null y loguea qué falta (nunca un null mudo)", async () => {
    const errores: string[] = []
    const original = console.error
    console.error = (m: string) => errores.push(m)
    try {
      assert.equal(almacenDesdeEnv({}, { storage: storageMemoria().s }), null)
      assert.equal(almacenDesdeEnv(env, { storage: null }), null)
    } finally {
      console.error = original
    }
    assert.match(errores[0], /falta SUPABASE_SERVICE_ROLE_KEY/)
    assert.match(errores[1], /no se pudo crear el cliente/)
  })

  await prueba("almacenDesdeEnv: con todo, sube al bucket de FABRICA_BUCKET", async () => {
    const m = storageMemoria()
    const a = almacenDesdeEnv(env, { storage: m.s, log: silencio })
    assert.ok(a)
    await a!.subir("2026-11-12/v1.mp4", new Uint8Array(4), "video/mp4")
    assert.ok(m.llamadas.includes("upload videos-casa/2026-11-12/v1.mp4"))
  })

  terminar()
}

void main()
