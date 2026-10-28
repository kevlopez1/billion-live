// ──────────────────────────────────────────────────────────────
// QUÉ SE PUEDE PEDIRLE A /api/publicar
//
// Solo lógica pura (sin red, sin Next): así se prueba con `npx tsx` y la
// ruta y la página leen las mismas reglas.
//
// Dos cuentas de Meta, cada una con su propio token y su propia página:
//   kev          → META_SYSTEM_TOKEN + META_PAGE_ID (la de siempre)
//   casa-blanca  → CASA_BLANCA_META_TOKEN + CASA_BLANCA_META_PAGE_ID
// ──────────────────────────────────────────────────────────────

export const CUENTAS = ["kev", "casa-blanca"] as const
export type Cuenta = (typeof CUENTAS)[number]

export const NOMBRE_CUENTA: Record<Cuenta, string> = {
  kev: "Kev",
  "casa-blanca": "La Casa Blanca Project",
}

/** Las variables de Vercel de cada cuenta, en el orden en que se piden. */
export const VARIABLES: Record<Cuenta, { token: string; pagina: string }> = {
  kev: { token: "META_SYSTEM_TOKEN", pagina: "META_PAGE_ID" },
  "casa-blanca": { token: "CASA_BLANCA_META_TOKEN", pagina: "CASA_BLANCA_META_PAGE_ID" },
}

export type Tipo = "foto" | "video"
export type Destino = "ig" | "fb"
export const TIPOS: Tipo[] = ["foto", "video"]
export const DESTINOS: Destino[] = ["ig", "fb"]

/** Lo que el usuario del sistema necesita en la página para publicar. */
export const PERMISOS = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const

/** Sin cuenta = la de Kev, como antes de que hubiera dos. Una desconocida es null. */
export function cuentaDe(valor: unknown): Cuenta | null {
  if (valor === undefined || valor === null || valor === "") return "kev"
  return CUENTAS.includes(valor as Cuenta) ? (valor as Cuenta) : null
}

type Entorno = Record<string, string | undefined>

/** La variable exacta que falta, o ok. Un valor con solo espacios cuenta como vacío. */
export function faltaVariable(cuenta: Cuenta, env: Entorno): string | null {
  const v = VARIABLES[cuenta]
  if (!env[v.token]?.trim()) return v.token
  if (!env[v.pagina]?.trim()) return v.pagina
  return null
}

/** El archivo de un episodio, tal como lo sirve la web (public/casa-blanca/videos/). */
export const BASE_VIDEOS = "https://kevproject.world/casa-blanca/videos/"
export const urlDelEpisodio = (id: string) => `${BASE_VIDEOS}${encodeURIComponent(id)}.mp4`

export const MAX_TEXTO = 2200

export type Pedido =
  | { accion: "publicar"; cuenta: Cuenta; tipo: Tipo; url: string; texto: string; destinos: Destino[] }
  /** Un reel que quedó procesándose: se vuelve a mirar y, si terminó, se publica. */
  | { accion: "continuar"; cuenta: Cuenta; contenedor: string }

export type Validacion = { ok: true; pedido: Pedido } | { ok: false; error: string }

export function validarPedido(cuerpo: unknown): Validacion {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    return { ok: false, error: "El cuerpo tiene que ser un objeto JSON." }
  }
  const c = cuerpo as Record<string, unknown>
  const cuenta = cuentaDe(c.cuenta)
  if (!cuenta) return { ok: false, error: `Cuenta desconocida: va ${CUENTAS.join(" o ")}.` }

  if (c.accion === "continuar") {
    const contenedor = typeof c.contenedor === "string" ? c.contenedor.trim() : ""
    // Los ids de Meta son solo dígitos: cualquier otra cosa no va a la URL de Graph.
    if (!/^\d{5,30}$/.test(contenedor)) return { ok: false, error: "Falta el id del video en proceso." }
    return { ok: true, pedido: { accion: "continuar", cuenta, contenedor } }
  }
  if (c.accion !== undefined && c.accion !== "publicar") {
    return { ok: false, error: "Acción desconocida." }
  }

  const tipo = c.tipo as Tipo
  const url = typeof c.url === "string" ? c.url.trim() : ""
  const texto = typeof c.texto === "string" ? c.texto : ""
  const destinos = Array.isArray(c.destinos)
    ? [...new Set((c.destinos as unknown[]).filter((d): d is Destino => DESTINOS.includes(d as Destino)))]
    : []

  if (!TIPOS.includes(tipo)) return { ok: false, error: "Elige si es foto o video." }
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) {
    return { ok: false, error: "Meta necesita una dirección pública que empiece con https:// para ir a buscar el archivo." }
  }
  if (destinos.length === 0) return { ok: false, error: "Elige al menos una red: Instagram o Facebook." }
  if (texto.length > MAX_TEXTO) {
    return { ok: false, error: "El texto pasa de 2.200 caracteres, el máximo de Instagram." }
  }
  return { ok: true, pedido: { accion: "publicar", cuenta, tipo, url, texto, destinos } }
}
