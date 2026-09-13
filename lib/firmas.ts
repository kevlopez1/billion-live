// ──────────────────────────────────────────────────────────────
// LAS FIRMAS DEL MERCEDES — fuente única de verdad.
//
// Antes este mismo dato vivía escrito a mano en TRES lugares: el muro de
// nombres, la grilla de comprobantes, y el contador del auto (que lee de
// Supabase). El resultado se veía en la web: el contador decía "0 firmas"
// mientras dos bloques más abajo mostraban la firma #001 ya pagada.
//
// Ahora se edita AQUÍ y nada más. Al agregar una firma nueva:
//   1. se suma el objeto a FIRMAS
//   2. se deja el comprobante en /public/images/comprobantes/
//   3. los datos de terceros van censurados EN LA IMAGEN, con barra sólida
// ──────────────────────────────────────────────────────────────

export type Tier = "vip" | "clasica"

export type Firma = {
  n: number          // número de firma, en orden de pago
  nombre: string     // como va grabado en la carrocería
  tier: Tier
  montoBs: number    // lo que pagó, en bolivianos
  fecha: string      // ISO, el día del pago
  comprobante: string // ruta de la captura del pago
}

export const PRECIO_USD = 10

export const FIRMAS: Firma[] = [
  {
    n: 1,
    nombre: "Dyson Leónel Busto",
    tier: "clasica",
    montoBs: 118,
    fecha: "2026-07-30",
    comprobante: "/images/comprobantes/firma-001.jpg",
  },
]

// Todo lo demás se calcula. Ningún total escrito a mano.
export const CANTIDAD = FIRMAS.length
export const RECAUDADO_USD = CANTIDAD * PRECIO_USD

/** "#001" */
export const numero = (n: number) => `#${String(n).padStart(3, "0")}`

/** "30 jul 2026" */
export function fechaCorta(iso: string) {
  const [a, m, d] = iso.split("-").map(Number)
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return `${d} ${meses[m - 1]} ${a}`
}
