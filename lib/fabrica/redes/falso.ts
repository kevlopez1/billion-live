// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · RED DE MENTIRA PARA LOS TESTS DE LOS ADAPTADORES
//
// Solo la importan los *.test.ts: un fetch que contesta según reglas y anota
// cada llamada (método, URL, cabeceras, cuerpo), y un Ctx armado con él.
// Sin red ni base.
// ──────────────────────────────────────────────────────────────

import type { Almacen, Ctx, Entorno, RedId } from "../tipos"

export interface Llamada {
  metodo: string
  url: string
  headers: Record<string, string>
  /** El cuerpo como texto (JSON o form), o los campos de un FormData. */
  cuerpo: string
  campos: Record<string, string>
}

export type Responder = (l: Llamada) => Response | Promise<Response> | "colgar" | "sin_red"

export const json = (o: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...headers } })

/** Un fetch falso. Reglas: [prueba sobre "METODO url", respuesta]. La primera que coincide gana. */
export function redFalsa(reglas: [RegExp, Responder][]) {
  const llamadas: Llamada[] = []
  const f = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada)
    const metodo = init?.method ?? "GET"
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    let cuerpo = ""
    const campos: Record<string, string> = {}
    const b = init?.body
    if (typeof b === "string") cuerpo = b
    else if (b instanceof URLSearchParams) {
      cuerpo = b.toString()
      b.forEach((v, k) => (campos[k] = v))
    } else if (b instanceof FormData) {
      b.forEach((v, k) => (campos[k] = typeof v === "string" ? v : `[archivo ${(v as Blob).size} B]`))
    } else if (b instanceof Uint8Array) cuerpo = `[${b.byteLength} B]`
    if (cuerpo.startsWith("{")) {
      try {
        Object.assign(campos, JSON.parse(cuerpo))
      } catch {
        /* no era JSON de verdad */
      }
    }
    const l: Llamada = { metodo, url, headers, cuerpo, campos }
    llamadas.push(l)
    const regla = reglas.find(([re]) => re.test(`${metodo} ${url}`))
    if (!regla) return json({ error: { message: `ruta inesperada ${metodo} ${url}` } }, 599)
    const r = await regla[1](l)
    if (r === "colgar") {
      return new Promise<Response>((_, rechazar) => {
        const s = init?.signal
        if (s) s.addEventListener("abort", () => rechazar(s.reason))
      })
    }
    if (r === "sin_red") throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })
    return r
  }) as typeof fetch
  return { fetch: f, llamadas }
}

/** Un almacén falso: la URL firmada apunta a un host de mentira que la red falsa sirve. */
export const almacenFalso: Almacen = {
  subir: async () => {},
  urlFirmada: async (ruta) => `https://almacen.prueba/${ruta}?firma=abc`,
  borrar: async () => {},
}

export function ctxFalso(f: typeof fetch, extra: { env?: Entorno; tokens?: Partial<Record<RedId, string | null>>; ahora?: Date } = {}): Ctx & { registro: string[] } {
  const registro: string[] = []
  const ahora = extra.ahora ?? new Date("2026-11-12T16:00:00Z")
  return {
    fetch: f,
    env: extra.env ?? {},
    ahora: () => ahora,
    token: async (red) => (extra.tokens && red in extra.tokens ? (extra.tokens[red] ?? null) : `acceso-${red}`),
    almacen: almacenFalso,
    log: (m) => registro.push(m),
    registro,
  }
}

// AbortSignal.timeout no mantiene vivo a Node: sin esto, una llamada "colgada"
// terminaría el proceso en silencio en vez de cortarse a tiempo.
const vivo = setInterval(() => {}, 1_000)

let fallos = 0
export async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

export function terminar() {
  clearInterval(vivo)
  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien")
  process.exit(fallos ? 1 : 0)
}

export const FICCION_PRUEBA = "Ficción hecha con IA. Personajes inspirados en figuras reales; no son ellas ni hablan por ellas."
