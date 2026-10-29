// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL ALMACÉN DE LOS MP4
//
// Donde vive el video entre la tanda (VM) y las redes. Reglas del plan
// (11-FABRICA-DE-VIDEOS.md) y de la especificación:
//   - Nunca un bucket público: un video sin aprobar no queda expuesto. Las
//     redes lo leen por una URL FIRMADA de 24 h o más.
//   - Un archivo que pasa el límite del almacén no se sube (el mismo límite
//     que mira calidad.ts: FABRICA_LIMITE_MB, 50 MB por defecto).
//   - Se borra cuando todas las redes cerraron (lo decide cola.ts, paso 10).
//
// Variables:
//   FABRICA_ALMACEN  supabase (por defecto) | blob (Vercel Blob, todavía no conectado)
//   FABRICA_BUCKET   el bucket privado de Supabase Storage (por defecto fabrica-videos)
//
// Dos capas: un `Backend` que solo habla con el servicio (Supabase hoy; Vercel
// Blob se suma implementando la misma interfaz) y `crearAlmacen`, que pone las
// reglas (ruta válida, peso, horas de la firma, bucket privado) y loguea el cómo.
// Puro salvo los puertos: `npx tsx lib/fabrica/almacen.test.ts`.
// ──────────────────────────────────────────────────────────────

import { getAdminClient } from "../supabase-admin"
import { reglasDe } from "./calidad"
import type { Almacen, Entorno, Log } from "./tipos"

/** Una firma de menos de 24 h puede vencer antes de que Meta o Upload-Post vayan a buscar el archivo. */
export const HORAS_MIN_FIRMA = 24
/** Más de 7 días no hace falta: el video sale a más tardar al día siguiente de la tanda. */
export const HORAS_MAX_FIRMA = 7 * 24
export const BUCKET_POR_DEFECTO = "fabrica-videos"
export const TIPO_MP4 = "video/mp4"

export type TipoAlmacen = "supabase" | "blob"

// ── Rutas ─────────────────────────────────────────────────────

/** Dónde se guarda el MP4 de un video: `<día>/<id>.mp4`. */
export const rutaDelVideo = (dia: string, videoId: string) => `${dia}/${videoId}.mp4`

/** Por qué una ruta no se acepta (vacío = se acepta). Nada de `..`, barras al inicio ni caracteres raros. */
export function rutaInvalida(ruta: string): string | null {
  if (!ruta) return "la ruta está vacía"
  if (ruta.length > 300) return `la ruta mide ${ruta.length} caracteres (máximo 300)`
  if (ruta.startsWith("/") || ruta.endsWith("/")) return `la ruta "${ruta}" empieza o termina con /`
  if (!/^[A-Za-z0-9._/-]+$/.test(ruta)) return `la ruta "${ruta}" tiene caracteres fuera de A-Z, 0-9, . _ - /`
  if (ruta.split("/").some((p) => p === "" || p === "." || p === "..")) return `la ruta "${ruta}" tiene un tramo vacío, . o ..`
  return null
}

/** Las horas de la firma, llevadas a [24, 168]. */
export function horasDeFirma(horas: number): number {
  if (!Number.isFinite(horas)) return HORAS_MIN_FIRMA
  return Math.min(HORAS_MAX_FIRMA, Math.max(HORAS_MIN_FIRMA, Math.ceil(horas)))
}

// ── El backend (lo que cambia entre Supabase y Vercel Blob) ───

export interface Backend {
  nombre: string
  /** Lanza si el contenedor es público o no se puede leer. Crea uno privado si no existe. */
  asegurarPrivado(limiteBytes: number): Promise<void>
  subir(ruta: string, datos: Uint8Array, tipo: string): Promise<void>
  firmar(ruta: string, segundos: number): Promise<string>
  /** Borrar algo que ya no está no es un error. */
  borrar(ruta: string): Promise<void>
}

export interface OpcionesAlmacen {
  limiteBytes: number
  log?: Log
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
const textoDe = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * El almacén con las reglas puestas. Cada error sale como excepción con el
 * cómo (qué ruta, qué dijo el servicio): los adaptadores (redes/http.ts) y la
 * tanda lo atrapan y lo guardan tal cual.
 */
export function crearAlmacen(backend: Backend, o: OpcionesAlmacen): Almacen {
  const log = o.log ?? ((m: string) => console.log(m))
  // La privacidad se revisa una vez por proceso, antes de la primera subida.
  let privado: Promise<void> | null = null
  const revisarPrivado = () => {
    if (!privado) {
      privado = backend.asegurarPrivado(o.limiteBytes).catch((e) => {
        privado = null // la próxima subida lo vuelve a intentar
        throw new Error(`[fabrica/almacen] ${backend.nombre}: no se pudo confirmar que el almacén es privado: ${textoDe(e)}`)
      })
    }
    return privado
  }
  const validar = (que: string, ruta: string) => {
    const mal = rutaInvalida(ruta)
    if (mal) throw new Error(`[fabrica/almacen] ${que}: ${mal}`)
  }

  return {
    async subir(ruta, datos, tipo) {
      validar("subir", ruta)
      if (!datos.byteLength) throw new Error(`[fabrica/almacen] subir ${ruta}: el archivo está vacío`)
      if (datos.byteLength > o.limiteBytes) {
        throw new Error(`[fabrica/almacen] subir ${ruta}: pesa ${mb(datos.byteLength)} y el límite del almacén es ${mb(o.limiteBytes)} (FABRICA_LIMITE_MB)`)
      }
      await revisarPrivado()
      try {
        await backend.subir(ruta, datos, tipo)
      } catch (e) {
        throw new Error(`[fabrica/almacen] subir ${ruta} (${mb(datos.byteLength)}) a ${backend.nombre} falló: ${textoDe(e)}`)
      }
      log(`[fabrica/almacen] ${ruta} subido a ${backend.nombre} (${mb(datos.byteLength)})`)
    },

    async urlFirmada(ruta, horas) {
      validar("urlFirmada", ruta)
      const h = horasDeFirma(horas)
      if (h !== horas) log(`[fabrica/almacen] firma de ${ruta}: se pidieron ${horas} h y se dan ${h} h (mínimo ${HORAS_MIN_FIRMA}, máximo ${HORAS_MAX_FIRMA})`)
      let url: string
      try {
        url = await backend.firmar(ruta, h * 3600)
      } catch (e) {
        throw new Error(`[fabrica/almacen] firmar ${ruta} en ${backend.nombre} falló: ${textoDe(e)}`)
      }
      if (!/^https:\/\//.test(url)) throw new Error(`[fabrica/almacen] firmar ${ruta}: ${backend.nombre} devolvió algo que no es una URL https: "${url.slice(0, 80)}"`)
      return url
    },

    async borrar(ruta) {
      validar("borrar", ruta)
      try {
        await backend.borrar(ruta)
      } catch (e) {
        throw new Error(`[fabrica/almacen] borrar ${ruta} de ${backend.nombre} falló: ${textoDe(e)}`)
      }
      log(`[fabrica/almacen] ${ruta} borrado de ${backend.nombre}`)
    },
  }
}

// ── Supabase Storage ──────────────────────────────────────────

type ErrorSb = { message: string; statusCode?: string | number; status?: number } | null

/** Lo poco que se usa de `db.storage` (así el test lo simula sin red). */
export interface StorageSupabase {
  getBucket(id: string): Promise<{ data: { public: boolean } | null; error: ErrorSb }>
  createBucket(id: string, o: { public: boolean; fileSizeLimit?: number | string | null }): Promise<{ data: unknown; error: ErrorSb }>
  from(bucket: string): {
    upload(ruta: string, datos: Uint8Array, o: { contentType: string; upsert: boolean; cacheControl?: string }): Promise<{ data: unknown; error: ErrorSb }>
    createSignedUrl(ruta: string, segundos: number): Promise<{ data: { signedUrl: string } | null; error: ErrorSb }>
    remove(rutas: string[]): Promise<{ data: unknown; error: ErrorSb }>
  }
}

const detalle = (e: NonNullable<ErrorSb>) => {
  const c = e.statusCode ?? e.status
  return `${e.message}${c !== undefined ? ` (código ${c})` : ""}`
}
const noExiste = (e: NonNullable<ErrorSb>) => /not.?found|no existe/i.test(e.message) || String(e.statusCode ?? e.status) === "404"

export function backendSupabase(storage: StorageSupabase, bucket: string): Backend {
  return {
    nombre: `Supabase Storage (${bucket})`,

    async asegurarPrivado(limiteBytes) {
      const { data, error } = await storage.getBucket(bucket)
      if (error && !noExiste(error)) throw new Error(`getBucket: ${detalle(error)}`)
      if (data) {
        if (data.public) throw new Error(`el bucket ${bucket} es PÚBLICO: los videos sin aprobar quedarían expuestos. Pasarlo a privado en Supabase antes de subir`)
        return
      }
      // No existe: se crea privado, con el mismo límite por archivo.
      const c = await storage.createBucket(bucket, { public: false, fileSizeLimit: limiteBytes })
      if (c.error && !/already exists|duplicate/i.test(c.error.message)) throw new Error(`createBucket: ${detalle(c.error)}`)
      // Si otro lo creó en el medio, se vuelve a mirar que sea privado.
      if (c.error) {
        const otra = await storage.getBucket(bucket)
        if (otra.error) throw new Error(`getBucket: ${detalle(otra.error)}`)
        if (otra.data?.public) throw new Error(`el bucket ${bucket} es PÚBLICO: los videos sin aprobar quedarían expuestos`)
      }
    },

    async subir(ruta, datos, tipo) {
      // upsert: la tanda que se cayó a mitad de la subida vuelve a subir lo mismo a la misma ruta.
      const { error } = await storage.from(bucket).upload(ruta, datos, { contentType: tipo, upsert: true, cacheControl: "3600" })
      if (error) throw new Error(detalle(error))
    },

    async firmar(ruta, segundos) {
      const { data, error } = await storage.from(bucket).createSignedUrl(ruta, segundos)
      if (error) throw new Error(detalle(error))
      if (!data?.signedUrl) throw new Error("Supabase no devolvió signedUrl")
      return data.signedUrl
    },

    async borrar(ruta) {
      const { error } = await storage.from(bucket).remove([ruta])
      if (error && !noExiste(error)) throw new Error(detalle(error))
    },
  }
}

// ── Desde el entorno ──────────────────────────────────────────

export interface ConfigAlmacen {
  tipo: TipoAlmacen
  bucket: string
  limiteBytes: number
}

/** Lo que dice el entorno, o qué falta (con el nombre de la variable). Puro. */
export function configDe(env: Entorno): { ok: true; config: ConfigAlmacen; avisos: string[] } | { ok: false; faltan: string[] } {
  const crudo = (env.FABRICA_ALMACEN ?? "").trim().toLowerCase()
  const tipo = crudo || "supabase"
  if (tipo === "blob") {
    return { ok: false, faltan: ["FABRICA_ALMACEN=blob: Vercel Blob todavía no está conectado (falta instalar @vercel/blob y escribir su Backend); usar supabase"] }
  }
  if (tipo !== "supabase") return { ok: false, faltan: [`FABRICA_ALMACEN="${crudo}" no es supabase ni blob`] }
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return { ok: false, faltan: ["SUPABASE_SERVICE_ROLE_KEY (el almacén usa Supabase Storage)"] }
  const bucket = (env.FABRICA_BUCKET ?? "").trim() || BUCKET_POR_DEFECTO
  const mal = rutaInvalida(bucket)
  if (mal || bucket.includes("/")) return { ok: false, faltan: [`FABRICA_BUCKET="${bucket}" no es un nombre de bucket válido`] }
  const { reglas, avisos } = reglasDe(env)
  return { ok: true, config: { tipo: "supabase", bucket, limiteBytes: reglas.limiteBytes }, avisos }
}

/**
 * El almacén real según el entorno, o null con el cómo en el log (nunca un null mudo:
 * los adaptadores dicen "sin almacén configurado (FABRICA_ALMACEN)").
 */
export function almacenDesdeEnv(
  env: Entorno,
  o: { storage?: StorageSupabase | null; log?: Log } = {},
): Almacen | null {
  const c = configDe(env)
  if (!c.ok) {
    console.error(`[fabrica/almacen] sin almacén: falta ${c.faltan.join("; ")}`)
    return null
  }
  for (const a of c.avisos) console.error(`[fabrica/almacen] ${a}`)
  const storage: StorageSupabase | null = o.storage === undefined ? (getAdminClient()?.storage ?? null) : o.storage
  if (!storage) {
    console.error("[fabrica/almacen] sin almacén: no se pudo crear el cliente de Supabase (SUPABASE_SERVICE_ROLE_KEY)")
    return null
  }
  return crearAlmacen(backendSupabase(storage, c.config.bucket), { limiteBytes: c.config.limiteBytes, log: o.log })
}
