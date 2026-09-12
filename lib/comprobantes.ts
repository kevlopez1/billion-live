// ──────────────────────────────────────────────────────────────
// LOS COMPROBANTES — la prueba de que la plata es real.
//
// Fuente ÚNICA: los usa el resumen de la home y la página /comprobantes.
// Si vivieran en el componente, cualquier pago nuevo habría que cargarlo
// en dos lugares y tarde o temprano los totales dejarían de coincidir.
//
// Los datos personales de terceros (nombres, cuentas) van censurados EN LA
// IMAGEN con una barra sólida, no con CSS: así el archivo que se sirve nunca
// contiene el dato sensible.
// ──────────────────────────────────────────────────────────────

export type Comprobante = {
  src: string
  /** Monto en bolivianos, para poder sumarlo sin parsear texto. */
  bs: number
  bank: string
  date: string
}

export const COMPROBANTES: Comprobante[] = [
  { src: "/images/comprobantes/economico-qr.jpg", bs: 1000, bank: "Banco Económico · QR", date: "11 sep 2026" },
  { src: "/images/comprobantes/bnb-empresa.jpg", bs: 14000, bank: "Empresa · Banco Solidario", date: "10 sep 2026" },
  { src: "/images/comprobantes/fie-cuizaguana.jpg", bs: 2290, bank: "Banco Fie · QR", date: "1 sep 2026" },
  { src: "/images/comprobantes/deposito-cliente.jpg", bs: 11000, bank: "Efectivo · cliente Santa Cruz", date: "20 ago 2026" },
  { src: "/images/comprobantes/union.jpg", bs: 4000, bank: "Banco Unión", date: "17 ago 2026" },
  { src: "/images/comprobantes/ecofuturo.jpg", bs: 4500, bank: "Banco Ecofuturo", date: "14 ago 2026" },
  { src: "/images/comprobantes/yape.jpg", bs: 3000, bank: "Yape", date: "17 ago 2026" },
  { src: "/images/comprobantes/bancosol2.jpg", bs: 1187, bank: "BancoSol", date: "17 ago 2026" },
  { src: "/images/comprobantes/mercantil.jpg", bs: 3645, bank: "Mercantil Santa Cruz", date: "31 jul 2026" },
  { src: "/images/comprobantes/ganadero2.jpg", bs: 2300, bank: "Banco Ganadero", date: "31 jul 2026" },
  { src: "/images/comprobantes/bancosol.jpg", bs: 1800, bank: "BancoSol", date: "16 jul 2026" },
  { src: "/images/comprobantes/bnb.jpg", bs: 2100, bank: "BNB", date: "13 jul 2026" },
  { src: "/images/comprobantes/bcp2.jpg", bs: 1770, bank: "Banco de Crédito", date: "7 jul 2026" },
  { src: "/images/comprobantes/ganadero.jpg", bs: 3180, bank: "Banco Ganadero", date: "4 jul 2026" },
  { src: "/images/comprobantes/bcp1.jpg", bs: 1730, bank: "Banco de Crédito", date: "29 jun 2026" },
]

export const monto = (bs: number) => `Bs ${bs.toLocaleString("es-BO")}`

export const TOTAL_BS = COMPROBANTES.reduce((a, c) => a + c.bs, 0)
export const CANTIDAD = COMPROBANTES.length

/** Entidades distintas por las que entró plata: habla de clientes reales y variados. */
export const ENTIDADES = new Set(COMPROBANTES.map((c) => c.bank.split(" · ")[0])).size

/** El más viejo está último: el array va del más nuevo al más viejo. */
export const DESDE = COMPROBANTES[COMPROBANTES.length - 1].date
export const HASTA = COMPROBANTES[0].date
