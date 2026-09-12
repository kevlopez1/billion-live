import { track as vercelTrack } from "@vercel/analytics"

// ──────────────────────────────────────────────────────────────
// EVENTOS DEL EMBUDO COMERCIAL
//
// Web Analytics mide pageviews solo. Eso dice cuánta gente llega, pero no
// QUÉ CONVIERTE. Estos eventos responden las preguntas que importan:
// ¿cuántos buscan contratar PRIME? ¿cuántos llegan al WhatsApp? ¿cuántos
// reservan un lugar en el auto?
//
// Los nombres viven acá y no sueltos por el código: si cada componente
// inventa el suyo, los datos quedan inservibles.
// Si Web Analytics está apagado, track() simplemente no hace nada.
// ──────────────────────────────────────────────────────────────

export const EV = {
  // Camino a PRIME (lo que da plata)
  HUB_ABIERTO: "hub_abierto",
  PRIME_WHATSAPP: "prime_whatsapp",
  PRIME_CLIENTES: "prime_clientes",
  PRIME_INVERSORES: "prime_inversores",
  HUB_ENTRAR_RETO: "hub_entrar_reto",
  // Monetización directa del reto
  FIRMA_CLICK: "firma_click",
  PIXEL_RESERVA: "pixel_reserva",
  PIXEL_PAGAR: "pixel_pagar",
  SPONSOR_ENVIADO: "sponsor_enviado",
  // Audiencia
  COMUNIDAD_WHATSAPP: "comunidad_whatsapp",
  NOTIFY_SUSCRITO: "notify_suscrito",
  COMPARTIR: "compartir",
} as const

type Props = Record<string, string | number | boolean | null>

export function track(evento: string, props?: Props) {
  try {
    vercelTrack(evento, props)
  } catch {
    // Medir nunca debe romper la web.
  }
}
