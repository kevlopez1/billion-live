// ──────────────────────────────────────────────────────────────
// El dominio del sitio, en UN solo lugar.
//
// Antes estaba escrito a mano en layout, robots, sitemap y el botón de
// compartir. Resultado: Google indexó el dominio viejo (billion-live.vercel.app)
// y el botón "Compartir" mandaba a la gente ahí.
//
// Se puede sobreescribir con NEXT_PUBLIC_SITE_URL sin tocar código.
// ──────────────────────────────────────────────────────────────
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kevproject.world"

/** Dominio sin protocolo, para mostrar en pantalla. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "")
