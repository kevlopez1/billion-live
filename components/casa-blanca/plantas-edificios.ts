// ──────────────────────────────────────────────────────────────
// LAS PLANTAS DEL ALA OESTE, EL EDIFICIO EISENHOWER Y EL TESORO
//
// Lo mismo que plantas.ts hace con la Residencia, en el mismo formato:
// cuartos, puertas, muros, macizos y escaleras. plantas.ts los suma a sus
// listas; nadie más importa este archivo.
//
// Ala Oeste (x −80..−50, z −15..18; muros de 0,6 m): la planta principal sigue
// el plano público en lo que se puede verificar (el Despacho Oval en la esquina
// sureste, la Sala del Gabinete al norte del Despacho, la Sala Roosevelt en el
// centro y sin ventanas, la Sala de las Palmas al final de la Columnata y el
// vestíbulo tras la puerta norte) y la Sala de Crisis va en el sótano.
// Compromiso escrito en la spec: la Sala de Prensa real está entre el Ala y la
// Residencia; aquí, en la esquina noreste del Ala, para no cambiar el exterior.
//
// Edificio Eisenhower y Tesoro: dos patios interiores rodeados por un anillo
// de pasillos y oficinas, como sus plantas reales. Las oficinas sin un dato
// verificable se llaman "Oficina" y no son lugares.
//
// La fachada de estos edificios es maciza en arquitectura.ts (no tiene cara de
// adentro): por dentro la cubre un "muro de forro" que ocupa el espesor del
// muro real salvo 2 cm de afuera, así no se pisan las caras.
// ──────────────────────────────────────────────────────────────

import type { Cuarto, EdificioId, Escalera, EstiloPiso, Macizo, Mueble, Muro, PlantaId, Puerta, Rect } from "./plantas"

const pu = (id: string, a: string, b: string, x: number, z: number, ancho: number, eje: "x" | "z", abierta?: boolean): Puerta => ({ id, a, b, x, z, ancho, eje, ...(abierta ? { abierta } : {}) })
const mu = (planta: PlantaId, x0: number, x1: number, z0: number, z1: number): Muro => ({ planta, x0, x1, z0, z1 })
const MADERA = "#5a3b22"
const CAOBA = "#4a2614"

type Fondo = "n" | "s" | "e" | "o"
/** Hacia dónde mira un mueble que está de espaldas a ese muro. */
const RUMBO: Record<Fondo, number> = { n: 0, s: Math.PI, o: Math.PI / 2, e: -Math.PI / 2 }

/**
 * Los muebles de una oficina: el escritorio de espaldas al muro `fondo` con su
 * silla y dos más enfrente, estantes contra ese muro (o contra un costado si
 * no entran), un sofá con su mesita si la oficina es honda y un cuadro.
 * (u, v) = a lo largo del muro de fondo y hacia adentro.
 */
function muebleOficina(r: Rect, fondo: Fondo, tapiz: string, tono: string): Mueble[] {
  const rr = RUMBO[fondo]
  const ns = fondo === "n" || fondo === "s"
  const W = ns ? r.x1 - r.x0 : r.z1 - r.z0
  const D = ns ? r.z1 - r.z0 : r.x1 - r.x0
  if (W < 3 || D < 3) return []
  const ox = fondo === "o" ? r.x0 : fondo === "e" ? r.x1 : (r.x0 + r.x1) / 2
  const oz = fondo === "n" ? r.z0 : fondo === "s" ? r.z1 : (r.z0 + r.z1) / 2
  const m = (t: Mueble["t"], u: number, v: number, giro: number, extra: Partial<Mueble> = {}): Mueble => ({
    t,
    x: ox + u * Math.cos(rr) + v * Math.sin(rr),
    z: oz - u * Math.sin(rr) + v * Math.cos(rr),
    rumbo: rr + giro,
    ...extra,
  })
  const out: Mueble[] = [
    m("escritorio", 0, 1.45, 0, { color: MADERA }),
    m("silla", 0, 0.72, 0, { color: tapiz }),
    m("silla", -0.5, 2.6, Math.PI, { color: tapiz }),
    m("silla", 0.5, 2.6, Math.PI, { color: tapiz }),
  ]
  if (W >= 6) for (const s of [-1, 1]) out.push(m("estante", s * (W / 2 - 1.35), 0.23, 0, { color: MADERA }))
  else out.push(m("estante", W / 2 - 0.23, D * 0.42, -Math.PI / 2, { color: MADERA, w: Math.min(2.0, D * 0.4) }))
  if (D >= 6.2 && W >= 4) {
    out.push(m("sofa", -(W / 2 - 0.5), D * 0.64, Math.PI / 2, { color: tapiz, w: 1.9 }))
    out.push(m("mesita", -(W / 2 - 1.5), D * 0.64, Math.PI / 2, { w: 1.0, d: 0.55, color: MADERA }))
  }
  if (W >= 6) out.push(m("cuadro", W / 2 - 0.05, D * 0.55, -Math.PI / 2, { w: 1.0, alto: 0.8, y: 1.4, tono }))
  return out
}

interface Fila {
  cuartos: Cuarto[]
  puertas: Puerta[]
  muros: Muro[]
}
const TAPICES = ["#3d5a7a", "#7a3b32", "#4f6b48", "#6b5a3a", "#5a4a6b"]
const TONOS = ["#3c3428", "#2f3440", "#3a2c26", "#2c3a30"]

/**
 * Una fila de oficinas iguales a lo largo de `eje` (de `desde` a `hasta`, con
 * tabiques de 0,3 m), cada una con su puerta al pasillo en el muro `muroPuerta`.
 * `lim` acota dónde puede ir la puerta (donde del otro lado hay pasillo).
 */
function filaOficinas(o: {
  pre: string
  planta: PlantaId
  eje: "x" | "z"
  desde: number
  hasta: number
  n: number
  a0: number
  a1: number
  pasillo: string
  muroPuerta: number
  lim: [number, number]
  fondo: Fondo
  color: string
  piso?: EstiloPiso
}): Fila {
  const out: Fila = { cuartos: [], puertas: [], muros: [] }
  const G = 0.3
  const largo = (o.hasta - o.desde - G * (o.n - 1)) / o.n
  const adentro = (o.a0 + o.a1) / 2 > o.muroPuerta ? 1 : -1
  for (let i = 0; i < o.n; i++) {
    const b0 = o.desde + i * (largo + G)
    const b1 = b0 + largo
    const rect: Rect = o.eje === "z" ? { x0: o.a0, x1: o.a1, z0: b0, z1: b1 } : { x0: b0, x1: b1, z0: o.a0, z1: o.a1 }
    const pc = Math.min(b1 - 0.8, Math.max(b0 + 0.8, Math.min(o.lim[1], Math.max(o.lim[0], (b0 + b1) / 2))))
    const id = `${o.pre}-${i + 1}`
    const nodo: [number, number] = o.eje === "z" ? [o.muroPuerta + adentro * 1.2, pc] : [pc, o.muroPuerta + adentro * 1.2]
    out.cuartos.push({
      id,
      planta: o.planta,
      nombre: "Oficina",
      rect,
      nodo,
      piso: o.piso ?? "parquet",
      muro: o.color,
      zocalo: "#e6dccb",
      muebles: muebleOficina(rect, o.fondo, TAPICES[i % TAPICES.length], TONOS[i % TONOS.length]),
    })
    out.puertas.push(pu(`${id}-p`, id, o.pasillo, o.eje === "z" ? o.muroPuerta : pc, o.eje === "z" ? pc : o.muroPuerta, 1.0, o.eje === "z" ? "z" : "x"))
    if (i < o.n - 1) out.muros.push(o.eje === "z" ? mu(o.planta, o.a0, o.a1, b1, b1 + G) : mu(o.planta, b1, b1 + G, o.a0, o.a1))
  }
  return out
}
const juntar = (...fs: Fila[]): Fila => ({ cuartos: fs.flatMap((f) => f.cuartos), puertas: fs.flatMap((f) => f.puertas), muros: fs.flatMap((f) => f.muros) })

// ══════════════════════════════════════════════════════════════
// ALA OESTE
// ══════════════════════════════════════════════════════════════
const AP: PlantaId = "oeste-principal"
const AS: PlantaId = "oeste-sotano"
/** La cara de adentro de los muros del Ala Oeste. */
export const INTERIOR_ALA: Rect = { x0: -79.4, x1: -50.6, z0: -14.4, z1: 17.4 }

/** El Despacho Oval por dentro (el óvalo de HUELLAS.despachoOval, dentro de su muro de 0,5 m). */
export const OVAL = { cx: -52, cz: 15, rx: 5.2, rz: 4.1 }
/** El muro del óvalo: de la cara de adentro (OVAL) hasta este óvalo; el resto del espesor lo tapa el remate. */
const ANILLO = { rx: 5.6, rz: 4.5 }
const GRAD = Math.PI / 180
const enOvalo = (rx: number, rz: number, a: number): [number, number] => [OVAL.cx + rx * Math.cos(a * GRAD), OVAL.cz + rz * Math.sin(a * GRAD)]
function arcoOvalo(rx: number, rz: number, a0: number, a1: number): Array<[number, number]> {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 6))
  return Array.from({ length: n + 1 }, (_, i) => enOvalo(rx, rz, a0 + ((a1 - a0) * i) / n))
}
/** Tramos del muro del óvalo (grados: 0 = este, 90 = sur): entre las dos puertas y las tres ventanas del sur. */
const TRAMOS_OVALO: Array<[number, number]> = [
  [8.5, 60.5],
  [75.5, 82.5],
  [97.5, 105.5],
  [120.5, 172],
  [188, 351.5],
]

const OVAL_MURO = "#ece3c9"
const PRINCIPAL: Cuarto[] = [
  {
    id: "ala-vestibulo",
    planta: AP,
    nombre: "Vestíbulo del Ala Oeste",
    rect: { x0: -73.0, x1: -61.8, z0: -14.4, z1: -3.0 },
    nodo: [-67.4, -4.1],
    piso: "parquet",
    muro: "#e7dcc3",
    zocalo: "#e6dccb",
    paso: true,
    alfombras: [{ x0: -71.6, x1: -63.4, z0: -12.2, z1: -5.4, color: "#2b3f6b", borde: "#c9a24e" }],
    muebles: [
      { t: "sofa", x: -72.55, z: -6.4, rumbo: Math.PI / 2, color: "#7a2b2a" },
      { t: "mesita", x: -71.3, z: -6.4, rumbo: Math.PI / 2, w: 1.0, d: 0.55, color: MADERA },
      { t: "butaca", x: -70.0, z: -8.4, rumbo: -0.6, color: "#c9b27a" },
      { t: "butaca", x: -70.0, z: -4.4, rumbo: Math.PI + 0.6, color: "#c9b27a" },
      { t: "mostrador", x: -62.95, z: -9.6, rumbo: -Math.PI / 2, w: 2.6, color: "#6a4426" },
      { t: "silla", x: -62.2, z: -9.6, rumbo: -Math.PI / 2, color: "#2a2420" },
      { t: "cuadro", x: -72.95, z: -10.6, rumbo: Math.PI / 2, w: 1.3, alto: 1.0, y: 1.3, tono: "#3c3428" },
      { t: "consola", x: -68.5, z: -14.15, rumbo: 0, color: "#d8b45a" },
      { t: "cuadro", x: -68.5, z: -14.38, rumbo: 0, w: 1.1, alto: 0.9, y: 1.35, tono: "#2f3440" },
      { t: "palmera", x: -72.4, z: -13.8 },
      { t: "palmera", x: -62.4, z: -13.8 },
    ],
  },
  {
    id: "ala-seguridad",
    planta: AP,
    nombre: "Oficina del Asesor de Seguridad Nacional",
    rect: { x0: -79.4, x1: -73.3, z0: -14.4, z1: -3.0 },
    nodo: [-74.4, -12.8],
    piso: "parquet",
    muro: "#e2dccd",
    zocalo: "#e6dccb",
    muebles: muebleOficina({ x0: -79.4, x1: -73.3, z0: -14.4, z1: -3.0 }, "o", "#3d5a7a", "#2c3a30"),
  },
  {
    id: "sala-prensa",
    planta: AP,
    nombre: "Sala de Prensa",
    lugarId: "sala-prensa",
    rect: { x0: -61.5, x1: -50.6, z0: -14.4, z1: -3.0 },
    nodo: [-60.6, -4.2],
    piso: "liso",
    colorPiso: "#26375c",
    muro: "#d9d6cf",
    zocalo: "#3a3f4a",
    muebles: [
      // El atril y el fondo azul con el óvalo de la Casa Blanca; 49 butacas en 7 filas de 7.
      { t: "telon", x: -56.05, z: -14.3, rumbo: 0, w: 6.2 },
      { t: "atril", x: -56.05, z: -12.9, rumbo: 0 },
      { t: "pantalla", x: -61.45, z: -11.4, rumbo: Math.PI / 2, w: 1.6 },
      { t: "pantalla", x: -50.65, z: -11.4, rumbo: -Math.PI / 2, w: 1.6 },
      ...Array.from({ length: 49 }, (_, k): Mueble => ({ t: "silla", x: -56.05 + ((k % 7) - 3) * 0.66, z: -10.4 + Math.floor(k / 7) * 0.95, rumbo: Math.PI, color: "#2f4a7a" })),
    ],
  },
  {
    id: "ala-pasillo",
    planta: AP,
    nombre: "Pasillo del Ala Oeste",
    rect: { x0: -79.4, x1: -50.6, z0: -2.7, z1: -0.2 },
    nodo: [-62.0, -1.45],
    piso: "liso",
    muro: "#e9e3d6",
    zocalo: "#d6cbb4",
    paso: true,
    alfombras: [{ x0: -78.8, x1: -51.2, z0: -2.0, z1: -0.9, color: "#3a4f7a", borde: "#c9a24e" }],
  },
  {
    id: "ala-vice",
    planta: AP,
    nombre: "Oficina del Vicepresidente",
    rect: { x0: -79.4, x1: -70.6, z0: 0.1, z1: 8.6 },
    nodo: [-75.0, 1.2],
    piso: "parquet",
    muro: "#e6dfcf",
    zocalo: "#e6dccb",
    muebles: muebleOficina({ x0: -79.4, x1: -70.6, z0: 0.1, z1: 8.6 }, "o", "#4f6b48", "#3a2c26"),
  },
  {
    id: "ala-jefe",
    planta: AP,
    nombre: "Oficina del Jefe de Gabinete",
    rect: { x0: -79.4, x1: -70.6, z0: 8.9, z1: 17.4 },
    nodo: [-76.0, 10.0],
    piso: "parquet",
    muro: "#e2dccd",
    zocalo: "#e6dccb",
    muebles: muebleOficina({ x0: -79.4, x1: -70.6, z0: 8.9, z1: 17.4 }, "s", "#7a3b32", "#3c3428"),
  },
  {
    id: "sala-roosevelt",
    planta: AP,
    nombre: "Sala Roosevelt",
    lugarId: "sala-roosevelt",
    rect: { x0: -70.3, x1: -63.6, z0: 0.1, z1: 9.4 },
    nodo: [-66.95, 1.2],
    piso: "parquet",
    muro: "#e8dcc0",
    cortina: "#7a2b2a",
    zocalo: "#e6dccb",
    alfombras: [{ x0: -69.4, x1: -64.5, z0: 2.0, z1: 8.6, color: "#6b3a2a", borde: "#c9a24e" }],
    muebles: [
      { t: "mesaReunion", x: -66.95, z: 5.3, w: 1.5, d: 5.2, color: CAOBA, tono: "#3b2b22" },
      // Sobre la chimenea, Theodore Roosevelt; en el muro sur, Franklin.
      { t: "chimenea", x: -70.05, z: 5.3, rumbo: Math.PI / 2, color: "#efe9df" },
      { t: "cuadro", x: -70.27, z: 5.3, rumbo: Math.PI / 2, w: 1.0, alto: 1.2, y: 1.4, tono: "#3a2c26" },
      { t: "cuadro", x: -66.95, z: 9.37, rumbo: Math.PI, w: 1.0, alto: 1.2, y: 1.2, tono: "#2f3440" },
      { t: "consola", x: -63.85, z: 6.6, rumbo: -Math.PI / 2, color: CAOBA },
      { t: "bandera", x: -69.6, z: 8.8, color: "#b22234" },
    ],
  },
  {
    id: "ala-oficina-sur",
    planta: AP,
    nombre: "Oficina",
    rect: { x0: -70.3, x1: -66.5, z0: 9.7, z1: 17.4 },
    nodo: [-69.3, 10.6],
    piso: "parquet",
    muro: "#e6dfcf",
    zocalo: "#e6dccb",
    muebles: muebleOficina({ x0: -70.3, x1: -66.5, z0: 9.7, z1: 17.4 }, "s", "#5a4a6b", "#2f3440"),
  },
  {
    id: "ala-escalera",
    planta: AP,
    nombre: "Escalera del Ala Oeste",
    rect: { x0: -66.2, x1: -63.6, z0: 9.7, z1: 17.4 },
    nodo: [-64.9, 10.35],
    piso: "liso",
    muro: "#e9e3d6",
    paso: true,
  },
  {
    id: "ala-pasillo-sur",
    planta: AP,
    nombre: "Pasillo sur",
    rect: { x0: -63.3, x1: -60.7, z0: 0.1, z1: 17.4 },
    nodo: [-62.0, 8.0],
    piso: "liso",
    muro: "#e9e3d6",
    zocalo: "#d6cbb4",
    paso: true,
    alfombras: [{ x0: -62.6, x1: -61.4, z0: 0.6, z1: 16.8, color: "#3a4f7a", borde: "#c9a24e" }],
  },
  {
    id: "sala-gabinete",
    planta: AP,
    nombre: "Sala del Gabinete",
    lugarId: "sala-gabinete",
    rect: { x0: -60.4, x1: -53.9, z0: 0.1, z1: 10.0 },
    nodo: [-57.15, 1.0],
    piso: "parquet",
    muro: "#ebe1c8",
    cortina: "#b8923f",
    zocalo: "#e6dccb",
    alfombras: [{ x0: -59.6, x1: -54.7, z0: 1.9, z1: 9.4, color: "#a8875a", borde: "#5a3b22" }],
    muebles: [
      // La mesa del Gabinete: dieciséis sillas de cuero alrededor.
      { t: "mesaReunion", x: -57.15, z: 5.6, w: 1.7, d: 6.4, color: CAOBA, tono: "#3b2b22" },
      { t: "cuadro", x: -60.37, z: 4.0, rumbo: Math.PI / 2, w: 1.0, alto: 1.3, y: 1.15, tono: "#3a2c26" },
      { t: "cuadro", x: -60.37, z: 7.4, rumbo: Math.PI / 2, w: 1.0, alto: 1.3, y: 1.15, tono: "#2f3440" },
      { t: "busto", x: -54.4, z: 9.4 },
      { t: "bandera", x: -59.8, z: 9.5, color: "#b22234" },
      { t: "bandera", x: -58.9, z: 9.5, color: "#1f3a6e" },
    ],
  },
  {
    id: "ala-palmas",
    planta: AP,
    nombre: "Sala de las Palmas",
    rect: { x0: -53.6, x1: -50.6, z0: 0.1, z1: 10.0 },
    nodo: [-52.1, 3.0],
    piso: "marmol",
    muro: "#e9e6dc",
    zocalo: "#cfc9bf",
    paso: true,
    muebles: [
      { t: "palmera", x: -53.1, z: 9.4 },
      { t: "palmera", x: -51.1, z: 9.4 },
      { t: "palmera", x: -51.1, z: 0.6 },
      { t: "consola", x: -53.35, z: 7.6, rumbo: Math.PI / 2, w: 1.2, color: "#e8e1d2" },
    ],
  },
  {
    id: "ala-antesala",
    planta: AP,
    nombre: "Antesala del Despacho Oval",
    rect: { x0: -60.4, x1: -57.9, z0: 10.3, z1: 17.4 },
    nodo: [-59.0, 13.7],
    piso: "parquet",
    muro: "#e8e0cc",
    zocalo: "#e6dccb",
    muebles: [
      { t: "escritorio", x: -59.2, z: 11.5, rumbo: Math.PI / 2, w: 1.4, d: 0.7, color: MADERA },
      { t: "silla", x: -59.95, z: 11.5, rumbo: Math.PI / 2, color: "#2a2420" },
      { t: "escritorio", x: -59.2, z: 16.5, rumbo: Math.PI / 2, w: 1.4, d: 0.7, color: MADERA },
      { t: "silla", x: -59.95, z: 16.5, rumbo: Math.PI / 2, color: "#2a2420" },
    ],
  },
  {
    id: "despacho-oval",
    planta: AP,
    nombre: "Despacho Oval",
    lugarId: "despacho-oval",
    rect: { x0: OVAL.cx - OVAL.rx, x1: OVAL.cx + OVAL.rx, z0: OVAL.cz - OVAL.rz, z1: OVAL.cz + OVAL.rz },
    elipse: { rx: OVAL.rx, rz: OVAL.rz },
    nodo: [-52, 16.15],
    piso: "parquet",
    muro: OVAL_MURO,
    cortina: "#c9a14a",
    zocalo: "#e6dccb",
    alfombras: [{ x0: -56.2, x1: -47.8, z0: 11.7, z1: 18.3, color: "#1f2f55", borde: "#c9a24e", oval: true }],
    muebles: [
      // El escritorio Resolute (1,83 x 1,22 m) frente a las ventanas del sur, con las dos banderas detrás.
      { t: "escritorio", x: -52, z: 17.3, rumbo: Math.PI, w: 1.83, d: 1.22, color: "#6a4426" },
      { t: "silla", x: -52, z: 18.2, rumbo: Math.PI, color: "#2a2420" },
      { t: "bandera", x: -53.5, z: 18.45, color: "#b22234" },
      { t: "bandera", x: -50.5, z: 18.45, color: "#1f3a6e" },
      // La chimenea al norte, con un retrato de Washington, y dos butacas a sus lados.
      { t: "chimenea", x: -52, z: 11.15, rumbo: 0, color: "#efe9df" },
      { t: "cuadro", x: -52, z: 10.95, rumbo: 0, w: 0.9, alto: 1.15, y: 1.45, tono: "#2c2620" },
      { t: "butaca", x: -53.6, z: 12.2, rumbo: 0.5, color: "#e8dcc0" },
      { t: "butaca", x: -50.4, z: 12.2, rumbo: -0.5, color: "#e8dcc0" },
      // Dos sofás enfrentados y la mesa baja.
      { t: "sofa", x: -53.75, z: 14.6, rumbo: Math.PI / 2, w: 2.0, color: "#e3d6b4" },
      { t: "sofa", x: -50.25, z: 14.6, rumbo: -Math.PI / 2, w: 2.0, color: "#e3d6b4" },
      { t: "mesita", x: -52, z: 14.6, rumbo: Math.PI / 2, w: 1.3, d: 0.6, color: MADERA },
      { t: "busto", x: -56.4, z: 13.0 },
    ],
  },
]
const PUERTAS_PRINCIPAL: Puerta[] = [
  pu("ala-norte", "ala-vestibulo", "afuera", -65, -14.7, 1.6, "x"),
  pu("ala-sur", "ala-pasillo-sur", "afuera", -62, 17.7, 1.6, "x"),
  pu("ala-columnata", "ala-palmas", "afuera", -50.3, 5.5, 1.5, "z"),
  pu("oval-rosas", "despacho-oval", "afuera", -46.5, 15.0, 1.2, "z"),
  pu("ala-vest-seg", "ala-vestibulo", "ala-seguridad", -73.15, -12.8, 1.0, "z"),
  pu("ala-vest-prensa", "ala-vestibulo", "sala-prensa", -61.65, -5.0, 1.2, "z"),
  pu("ala-vest-pas", "ala-vestibulo", "ala-pasillo", -67.4, -2.85, 4.0, "x", true),
  pu("ala-prensa-pas", "sala-prensa", "ala-pasillo", -59.6, -2.85, 1.4, "x"),
  pu("ala-pas-vice", "ala-pasillo", "ala-vice", -75.0, -0.05, 1.0, "x"),
  pu("ala-pas-roos", "ala-pasillo", "sala-roosevelt", -66.95, -0.05, 1.2, "x"),
  pu("ala-pas-sur", "ala-pasillo", "ala-pasillo-sur", -62.0, -0.05, 2.6, "x", true),
  pu("ala-pas-gab", "ala-pasillo", "sala-gabinete", -57.15, -0.05, 1.4, "x"),
  pu("ala-pas-palmas", "ala-pasillo", "ala-palmas", -52.1, -0.05, 2.4, "x", true),
  pu("ala-vice-jefe", "ala-vice", "ala-jefe", -77.5, 8.75, 1.0, "x"),
  pu("ala-jefe-ofi", "ala-jefe", "ala-oficina-sur", -70.45, 10.6, 1.0, "z"),
  pu("ala-roos-sur", "sala-roosevelt", "ala-pasillo-sur", -63.45, 1.2, 1.2, "z"),
  pu("ala-esc-sur", "ala-escalera", "ala-pasillo-sur", -63.45, 10.35, 1.2, "z"),
  pu("ala-gab-sur", "sala-gabinete", "ala-pasillo-sur", -60.55, 1.2, 1.2, "z"),
  pu("ala-gab-palmas", "sala-gabinete", "ala-palmas", -53.75, 1.2, 1.2, "z"),
  pu("ala-ante-sur", "ala-antesala", "ala-pasillo-sur", -60.55, 13.0, 1.0, "z"),
  pu("ala-ante-oval", "ala-antesala", "despacho-oval", -57.6, 15.0, 1.1, "z"),
]
const MUROS_PRINCIPAL: Muro[] = [
  mu(AP, -73.3, -73.0, -14.4, -3.0),
  mu(AP, -61.8, -61.5, -14.4, -3.0),
  mu(AP, -79.4, -50.6, -3.0, -2.7),
  mu(AP, -79.4, -50.6, -0.2, 0.1),
  mu(AP, -70.6, -70.3, 0.1, 17.4),
  mu(AP, -79.4, -70.6, 8.6, 8.9),
  mu(AP, -70.3, -63.6, 9.4, 9.7),
  mu(AP, -66.5, -66.2, 9.7, 17.4),
  mu(AP, -63.6, -63.3, 0.1, 17.4),
  mu(AP, -60.7, -60.4, 0.1, 17.4),
  mu(AP, -53.9, -53.6, 0.1, 10.0),
  mu(AP, -60.4, -50.6, 10.0, 10.3),
]
/** El muro del óvalo (con sus puertas y ventanas) y los rincones entre el óvalo y los cuartos del Ala. */
const MACIZOS_PRINCIPAL: Macizo[] = [
  ...TRAMOS_OVALO.map(([a0, a1]): Macizo => ({ planta: AP, pts: [...arcoOvalo(ANILLO.rx, ANILLO.rz, a0, a1), ...arcoOvalo(OVAL.rx, OVAL.rz, a1, a0)] })),
  {
    planta: AP,
    pts: [[-57.9, 10.3], [-50.6, 10.3], ...arcoOvalo(ANILLO.rx, ANILLO.rz, 360 - Math.acos(1.4 / ANILLO.rx) / GRAD, 188), [-57.9, enOvalo(ANILLO.rx, ANILLO.rz, 188)[1]]],
  },
  {
    planta: AP,
    pts: [[-57.9, enOvalo(ANILLO.rx, ANILLO.rz, 172)[1]], ...arcoOvalo(ANILLO.rx, ANILLO.rz, 172, 180 - Math.asin(2.4 / ANILLO.rz) / GRAD), [-57.9, 17.4]],
  },
]

// ── Sótano (y −3,4): la Sala de Crisis y el comedor de la Marina ──
const SOTANO: Cuarto[] = [
  {
    id: "ala-escalera-sotano",
    planta: AS,
    nombre: "Escalera del Ala Oeste",
    rect: { x0: -66.2, x1: -63.6, z0: 9.7, z1: 17.4 },
    nodo: [-64.9, 10.35],
    piso: "liso",
    muro: "#e2ddd2",
    paso: true,
  },
  {
    id: "sala-crisis",
    planta: AS,
    nombre: "Sala de Crisis",
    lugarId: "sala-crisis",
    rect: { x0: -79.4, x1: -66.5, z0: 4.0, z1: 17.4 },
    nodo: [-68.4, 10.35],
    piso: "liso",
    colorPiso: "#6a707a",
    muro: "#8a7058",
    zocalo: "#2f343c",
    alfombras: [{ x0: -78.4, x1: -67.5, z0: 4.8, z1: 10.6, color: "#3b4a66", borde: "#8a96aa" }],
    muebles: [
      // La sala de conferencias: mesa larga, sillas de cuero y pantallas en los muros.
      { t: "mesaReunion", x: -72.95, z: 7.6, rumbo: Math.PI / 2, w: 1.5, d: 5.6, color: "#3a2a1e", tono: "#24201c" },
      { t: "pantalla", x: -72.95, z: 4.05, rumbo: 0, w: 3.2 },
      { t: "pantalla", x: -76.9, z: 4.05, rumbo: 0, w: 1.6 },
      { t: "pantalla", x: -69.0, z: 4.05, rumbo: 0, w: 1.6 },
      { t: "pantalla", x: -79.35, z: 7.6, rumbo: Math.PI / 2, w: 2.2 },
      // El centro de vigilancia: puestos con pantallas, de cara al muro de video.
      { t: "escritorio", x: -76.6, z: 14.6, rumbo: 0, w: 1.6, d: 0.8, color: "#3a3f48" },
      { t: "escritorio", x: -73.2, z: 14.6, rumbo: 0, w: 1.6, d: 0.8, color: "#3a3f48" },
      { t: "escritorio", x: -69.8, z: 14.6, rumbo: 0, w: 1.6, d: 0.8, color: "#3a3f48" },
      { t: "silla", x: -76.6, z: 13.75, rumbo: 0, color: "#24201c" },
      { t: "silla", x: -73.2, z: 13.75, rumbo: 0, color: "#24201c" },
      { t: "silla", x: -69.8, z: 13.75, rumbo: 0, color: "#24201c" },
      { t: "pantalla", x: -73.2, z: 17.35, rumbo: Math.PI, w: 5.0 },
    ],
  },
  {
    id: "ala-marina",
    planta: AS,
    nombre: "Comedor de la Marina",
    rect: { x0: -63.3, x1: -54.0, z0: 4.0, z1: 12.0 },
    nodo: [-61.9, 10.6],
    piso: "parquet",
    muro: "#6b4a2e",
    zocalo: "#3a2616",
    muebles: [
      ...([
        [-60.2, 6.2],
        [-56.6, 6.2],
        [-56.6, 9.8],
      ] as const).flatMap(([x, z]): Mueble[] => [
        { t: "mesaRedonda", x, z, w: 1.1, d: 1.1, color: "#f1ece2" },
        { t: "silla", x: x - 0.9, z, rumbo: Math.PI / 2, color: "#1f3a6e" },
        { t: "silla", x: x + 0.9, z, rumbo: -Math.PI / 2, color: "#1f3a6e" },
      ]),
      { t: "aparador", x: -60.2, z: 11.7, rumbo: Math.PI, w: 2.2, color: CAOBA },
      { t: "cuadro", x: -54.05, z: 8.0, rumbo: -Math.PI / 2, w: 1.4, alto: 0.9, y: 1.3, tono: "#2a3a55" },
    ],
  },
]
const PUERTAS_SOTANO: Puerta[] = [pu("ala-sot-crisis", "ala-escalera-sotano", "sala-crisis", -66.35, 10.35, 1.0, "z"), pu("ala-sot-marina", "ala-escalera-sotano", "ala-marina", -63.45, 10.35, 1.0, "z")]
const MUROS_SOTANO: Muro[] = [mu(AS, -66.5, -66.2, 9.7, 17.4), mu(AS, -63.6, -63.3, 9.7, 12.0)]
const rectPts = (x0: number, x1: number, z0: number, z1: number): Array<[number, number]> => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
]
/** Lo que no se excavó: tierra maciza hasta el borde del Ala (los muros del sótano la contienen). */
const MACIZOS_SOTANO: Macizo[] = [
  rectPts(-80, -50, -15, 4.0),
  rectPts(-80, -79.4, 4.0, 18),
  rectPts(-79.4, -50, 17.4, 18),
  rectPts(-66.5, -63.3, 4.0, 9.7),
  rectPts(-63.6, -50, 12.0, 17.4),
  rectPts(-54.0, -50, 4.0, 12.0),
].map((pts) => ({ planta: AS, pts }))

// ══════════════════════════════════════════════════════════════
// EDIFICIO EISENHOWER (x −160..−100, z −60..60): dos patios y un anillo de pasillos
// ══════════════════════════════════════════════════════════════
/** La cara de adentro del forro (los muros retranqueados de la fachada, menos 0,6 m). */
export const INTERIOR_EEOB: Rect = { x0: -157.8, x1: -102.2, z0: -57.8, z1: 57.8 }
const E_FORRO = 0.58
const PATIO_N_E: Rect = { x0: -146.2, x1: -113.8, z0: -46.2, z1: -6.3 }
const PATIO_S_E: Rect = { x0: -146.2, x1: -113.8, z0: 6.3, z1: 46.2 }

function plantaEEOB(alta: boolean): Fila {
  const P: PlantaId = alta ? "eeob-alta" : "eeob-baja"
  const k = alta ? "eeob-a" : "eeob-b"
  const I = INTERIOR_EEOB
  const col = alta ? "#e6e0d2" : "#e2dccd"
  const corr = (id: string, nombre: string, r: Rect, nodo: [number, number]): Cuarto => ({ id: `${k}-${id}`, planta: P, nombre, rect: r, nodo, piso: "damero", muro: "#e9e4d8", zocalo: "#3a3530", paso: true })
  const cuartos: Cuarto[] = [
    corr("corr-o", "Pasillo oeste", { x0: -149.7, x1: -146.5, z0: -49.7, z1: 49.7 }, [-148.1, 0]),
    corr("corr-e", "Pasillo este", { x0: -113.5, x1: -110.3, z0: -49.7, z1: 49.7 }, [-111.9, 0]),
    corr("corr-n", "Pasillo norte", { x0: -146.5, x1: -113.5, z0: -49.7, z1: -46.5 }, [-130, -48.1]),
    corr("corr-s", "Pasillo sur", { x0: -146.5, x1: -113.5, z0: 46.5, z1: 49.7 }, [-130, 48.1]),
    corr("corr-c", "Pasillo central", { x0: -146.2, x1: -113.8, z0: -1.6, z1: 1.6 }, [-130, 0]),
    {
      id: `${k}-escalera`,
      planta: P,
      nombre: "Escalera",
      rect: { x0: -110.0, x1: -102.2, z0: 6.3, z1: 14.3 },
      nodo: [-106.9, 6.75],
      piso: "marmol",
      muro: "#e9e4d8",
      paso: true,
    },
  ]
  if (!alta) {
    cuartos.push({
      id: "eeob-b-vestibulo",
      planta: P,
      nombre: "Vestíbulo del Edificio Eisenhower",
      rect: { x0: -110.0, x1: -100.6, z0: -6.0, z1: 6.0 },
      nodo: [-106.1, 0],
      piso: "damero",
      muro: "#e4ddcd",
      zocalo: "#3a3530",
      paso: true,
      muebles: [
        { t: "mostrador", x: -106.1, z: -5.6, rumbo: 0, w: 3.0, color: "#3a2a1e" },
        { t: "banco", x: -108.2, z: 5.65, rumbo: Math.PI, color: "#7a2b2a" },
        { t: "bandera", x: -101.3, z: -5.3, color: "#b22234" },
        { t: "cuadro", x: -109.97, z: -3.6, rumbo: Math.PI / 2, w: 1.2, alto: 1.0, y: 1.3, tono: "#3a2c26" },
        { t: "palmera", x: -101.4, z: 5.3 },
      ],
    })
    for (const [id, nombre, r] of [
      ["patio-n", "Patio norte", PATIO_N_E],
      ["patio-s", "Patio sur", PATIO_S_E],
    ] as const) {
      const cx = (r.x0 + r.x1) / 2
      const cz = (r.z0 + r.z1) / 2
      cuartos.push({
        id: `eeob-b-${id}`,
        planta: P,
        nombre,
        rect: r,
        nodo: [cx, id === "patio-n" ? r.z0 + 1.2 : r.z1 - 1.2],
        piso: "piedra",
        colorPiso: "#a8a294",
        muro: "#b9b0a2",
        paso: true,
        muebles: [
          ...[-9, 9].flatMap((dx) => [-9, 9].map((dz): Mueble => ({ t: "palmera", x: cx + dx, z: cz + dz }))),
          { t: "banco", x: cx, z: cz - 4, rumbo: 0, color: "#6b6258" },
          { t: "banco", x: cx, z: cz + 4, rumbo: Math.PI, color: "#6b6258" },
        ],
      })
    }
  } else {
    cuartos.push(
      {
        id: "eeob-a-antesala",
        planta: P,
        nombre: "Antesala",
        rect: { x0: -110.0, x1: -102.2, z0: -6.0, z1: 6.0 },
        nodo: [-106.1, 0],
        piso: "damero",
        muro: "#e4ddcd",
        zocalo: "#3a3530",
        paso: true,
        muebles: [
          { t: "banco", x: -102.5, z: -2.0, rumbo: -Math.PI / 2, color: "#7a2b2a" },
          { t: "banco", x: -102.5, z: 2.0, rumbo: -Math.PI / 2, color: "#7a2b2a" },
        ],
      },
      {
        id: "eeob-ceremonial",
        planta: P,
        nombre: "Oficina Ceremonial del Vicepresidente",
        lugarId: "eeob",
        rect: { x0: -110.0, x1: -102.2, z0: -19.1, z1: -6.3 },
        nodo: [-106.1, -7.5],
        piso: "parquet",
        muro: "#e9dcc0",
        cortina: "#7a2b2a",
        zocalo: "#d9c9a6",
        alfombras: [{ x0: -109.2, x1: -103.0, z0: -18.0, z1: -8.4, color: "#7a3b32", borde: "#c9a24e" }],
        muebles: [
          { t: "escritorio", x: -106.1, z: -17.4, rumbo: 0, w: 1.9, d: 0.95, color: CAOBA },
          { t: "silla", x: -106.1, z: -18.25, rumbo: 0, color: "#2a2420" },
          { t: "bandera", x: -108.0, z: -18.5, color: "#b22234" },
          { t: "bandera", x: -104.2, z: -18.5, color: "#1f3a6e" },
          { t: "chimenea", x: -109.75, z: -12.7, rumbo: Math.PI / 2, color: "#efe9df" },
          { t: "cuadro", x: -109.97, z: -12.7, rumbo: Math.PI / 2, w: 0.9, alto: 1.1, y: 1.45, tono: "#3a2c26" },
          { t: "sofa", x: -103.0, z: -12.7, rumbo: -Math.PI / 2, color: "#7a2b2a" },
          { t: "mesita", x: -104.4, z: -12.7, rumbo: Math.PI / 2, w: 1.1, d: 0.55, color: MADERA },
          { t: "butaca", x: -105.9, z: -11.1, rumbo: Math.PI * 0.75, color: "#c9b27a" },
          { t: "butaca", x: -105.9, z: -14.3, rumbo: Math.PI * 0.25, color: "#c9b27a" },
          { t: "estante", x: -102.43, z: -16.6, rumbo: -Math.PI / 2, color: CAOBA },
        ],
      },
    )
  }
  const pasos: Puerta[] = [
    pu(`${k}-n-o`, `${k}-corr-n`, `${k}-corr-o`, -146.5, -48.1, 3.0, "z", true),
    pu(`${k}-n-e`, `${k}-corr-n`, `${k}-corr-e`, -113.5, -48.1, 3.0, "z", true),
    pu(`${k}-s-o`, `${k}-corr-s`, `${k}-corr-o`, -146.5, 48.1, 3.0, "z", true),
    pu(`${k}-s-e`, `${k}-corr-s`, `${k}-corr-e`, -113.5, 48.1, 3.0, "z", true),
    pu(`${k}-c-o`, `${k}-corr-c`, `${k}-corr-o`, -146.35, 0, 3.0, "z", true),
    pu(`${k}-c-e`, `${k}-corr-c`, `${k}-corr-e`, -113.65, 0, 3.0, "z", true),
  ]
  if (!alta) {
    pasos.push(
      pu("eeob-este", "eeob-b-vestibulo", "afuera", -100.3, 0, 1.6, "z"),
      pu("eeob-b-vest-corr", "eeob-b-vestibulo", "eeob-b-corr-e", -110.15, 0, 2.4, "z"),
      pu("eeob-b-vest-esc", "eeob-b-vestibulo", "eeob-b-escalera", -106.1, 6.15, 1.4, "x"),
      pu("eeob-b-patio-n", "eeob-b-patio-n", "eeob-b-corr-n", -130, -46.35, 2.0, "x"),
      pu("eeob-b-patio-s", "eeob-b-patio-s", "eeob-b-corr-s", -130, 46.35, 2.0, "x"),
    )
  } else {
    pasos.push(
      pu("eeob-a-ante-corr", "eeob-a-antesala", "eeob-a-corr-e", -110.15, 0, 2.4, "z"),
      pu("eeob-a-ante-esc", "eeob-a-antesala", "eeob-a-escalera", -106.1, 6.15, 1.4, "x"),
      pu("eeob-a-ante-cer", "eeob-a-antesala", "eeob-ceremonial", -106.1, -6.15, 1.4, "x"),
    )
  }
  const muros: Muro[] = [
    // El forro de la fachada (en la Planta baja, la del vestíbulo llega a la puerta este).
    mu(P, I.x0 - E_FORRO, I.x0, I.z0 - E_FORRO, I.z1 + E_FORRO),
    mu(P, I.x0 - E_FORRO, I.x1 + E_FORRO, I.z0 - E_FORRO, I.z0),
    mu(P, I.x0 - E_FORRO, I.x1 + E_FORRO, I.z1, I.z1 + E_FORRO),
    ...(alta
      ? [mu(P, I.x1, I.x1 + E_FORRO, I.z0 - E_FORRO, I.z1 + E_FORRO)]
      : [mu(P, I.x1, I.x1 + E_FORRO, I.z0 - E_FORRO, -6.3), mu(P, I.x1, I.x1 + E_FORRO, 6.3, I.z1 + E_FORRO), mu(P, -100.6, -100.02, -6.3, 6.3)]),
    // Las bandas de oficinas, el anillo y el ala central.
    mu(P, -150.0, -149.7, I.z0, I.z1),
    mu(P, -110.3, -110.0, I.z0, I.z1),
    mu(P, -149.7, -110.3, -50.0, -49.7),
    mu(P, -149.7, -110.3, 49.7, 50.0),
    mu(P, -146.5, -146.2, -46.5, 46.5),
    mu(P, -113.8, -113.5, -46.5, 46.5),
    mu(P, -146.2, -113.8, -46.5, -46.2),
    mu(P, -146.2, -113.8, 46.2, 46.5),
    mu(P, -146.2, -113.8, -6.3, -6.0),
    mu(P, -146.2, -113.8, 6.0, 6.3),
    mu(P, -146.2, -113.8, -1.9, -1.6),
    mu(P, -146.2, -113.8, 1.6, 1.9),
    // La banda este: el vestíbulo (o la antesala) y la escalera entre las oficinas.
    mu(P, -110.0, alta ? I.x1 : -100.02, -6.3, -6.0),
    mu(P, -110.0, alta ? I.x1 : -100.02, 6.0, 6.3),
    mu(P, -110.0, I.x1, 14.3, 14.6),
    ...(alta ? [mu(P, -110.0, I.x1, -19.4, -19.1)] : []),
  ]
  const fila = (pre: string, o: Partial<Parameters<typeof filaOficinas>[0]> & Pick<Parameters<typeof filaOficinas>[0], "eje" | "desde" | "hasta" | "n" | "a0" | "a1" | "pasillo" | "muroPuerta" | "lim" | "fondo">) =>
    filaOficinas({ pre: `${k}-${pre}`, planta: P, color: col, ...o })
  const filas = juntar(
    fila("o", { eje: "z", desde: I.z0, hasta: I.z1, n: 9, a0: I.x0, a1: -150.0, pasillo: `${k}-corr-o`, muroPuerta: -149.85, lim: [-48.6, 48.6], fondo: "o" }),
    fila("en", { eje: "z", desde: I.z0, hasta: alta ? -19.4 : -6.3, n: alta ? 3 : 4, a0: -110.0, a1: I.x1, pasillo: `${k}-corr-e`, muroPuerta: -110.15, lim: [-48.6, 48.6], fondo: "e" }),
    fila("es", { eje: "z", desde: 14.6, hasta: I.z1, n: 3, a0: -110.0, a1: I.x1, pasillo: `${k}-corr-e`, muroPuerta: -110.15, lim: [-48.6, 48.6], fondo: "e" }),
    fila("n", { eje: "x", desde: -149.7, hasta: -110.3, n: 3, a0: I.z0, a1: -50.0, pasillo: `${k}-corr-n`, muroPuerta: -49.85, lim: [-145.8, -114.2], fondo: "n" }),
    fila("s", { eje: "x", desde: -149.7, hasta: -110.3, n: 3, a0: 50.0, a1: I.z1, pasillo: `${k}-corr-s`, muroPuerta: 49.85, lim: [-145.8, -114.2], fondo: "s" }),
    fila("cn", { eje: "x", desde: -146.2, hasta: -113.8, n: 3, a0: -6.0, a1: -1.9, pasillo: `${k}-corr-c`, muroPuerta: -1.75, lim: [-145, -115], fondo: "n" }),
    fila("cs", { eje: "x", desde: -146.2, hasta: -113.8, n: 3, a0: 1.9, a1: 6.0, pasillo: `${k}-corr-c`, muroPuerta: 1.75, lim: [-145, -115], fondo: "s" }),
  )
  return juntar({ cuartos, puertas: pasos, muros }, filas)
}

// ══════════════════════════════════════════════════════════════
// DEPARTAMENTO DEL TESORO (x 100..150, z −70..60): la entrada en el pabellón norte
// ══════════════════════════════════════════════════════════════
export const INTERIOR_TESORO: Rect = { x0: 104.6, x1: 149.4, z0: -69.4, z1: 59.4 }
const T_FORRO = 0.58
const PATIO_N_T: Rect = { x0: 116.2, x1: 137.8, z0: -57.8, z1: -8.3 }
const PATIO_S_T: Rect = { x0: 116.2, x1: 137.8, z0: 8.3, z1: 47.8 }

function plantaTesoro(): Fila {
  const P: PlantaId = "tesoro-baja"
  const I = INTERIOR_TESORO
  const col = "#e6e0d2"
  const corr = (id: string, nombre: string, r: Rect, nodo: [number, number]): Cuarto => ({ id: `tes-${id}`, planta: P, nombre, rect: r, nodo, piso: "marmol", muro: "#ece7dc", zocalo: "#cfc9bf", paso: true })
  const cuartos: Cuarto[] = [
    corr("corr-o", "Pasillo oeste", { x0: 112.7, x1: 115.9, z0: -61.3, z1: 51.3 }, [114.3, -20]),
    corr("corr-e", "Pasillo este", { x0: 138.1, x1: 141.3, z0: -61.3, z1: 51.3 }, [139.7, -20]),
    corr("corr-n", "Pasillo norte", { x0: 115.9, x1: 138.1, z0: -61.3, z1: -58.1 }, [127, -59.7]),
    corr("corr-s", "Pasillo sur", { x0: 115.9, x1: 138.1, z0: 48.1, z1: 51.3 }, [127, 49.7]),
    {
      id: "tes-vestibulo",
      planta: P,
      nombre: "Vestíbulo del Tesoro",
      rect: { x0: 100.6, x1: 112.4, z0: -61.3, z1: -50.0 },
      nodo: [106.5, -55.0],
      piso: "marmol",
      muro: "#e4ddcd",
      zocalo: "#cfc9bf",
      paso: true,
      muebles: [
        { t: "mostrador", x: 107.0, z: -60.9, rumbo: 0, w: 3.2, color: "#3a2a1e" },
        { t: "bandera", x: 101.3, z: -60.6, color: "#b22234" },
        { t: "busto", x: 101.2, z: -50.6 },
        { t: "palmera", x: 111.8, z: -50.6 },
      ],
    },
    {
      // La Sala del Efectivo (1869): doble altura de mármol con un balcón de bronce
      // corrido sobre ménsulas, y las ventanillas de caja a lo largo de los muros.
      id: "tes-efectivo",
      planta: P,
      nombre: "Sala del Efectivo",
      lugarId: "tesoro",
      rect: { x0: 116.2, x1: 137.8, z0: -8.0, z1: 8.0 },
      nodo: [117.4, 0],
      piso: "marmol",
      colorPiso: "#cdb98f",
      muro: "#d6c39a",
      zocalo: "#8a6a3a",
      alfombras: [{ x0: 120.0, x1: 134.0, z0: -3.0, z1: 3.0, color: "#7a2b2a", borde: "#c9a24e" }],
      muebles: [
        { t: "balcon", x: 127, z: -7.5, rumbo: 0, w: 21.6 },
        { t: "balcon", x: 127, z: 7.5, rumbo: Math.PI, w: 21.6 },
        ...[-1, 1].flatMap((s): Mueble[] => [
          { t: "balcon", x: 116.7, z: s * 4.3, rumbo: Math.PI / 2, w: 5.4 },
          { t: "balcon", x: 137.3, z: s * 4.3, rumbo: -Math.PI / 2, w: 5.4 },
        ]),
        ...[119.4, 123.2, 127.0, 130.8, 134.6].flatMap((x): Mueble[] => [
          { t: "mostrador", x, z: -6.9, rumbo: 0, color: "#8a6a3a" },
          { t: "mostrador", x, z: 6.9, rumbo: Math.PI, color: "#8a6a3a" },
        ]),
        { t: "banco", x: 124.1, z: 0, rumbo: 0, color: "#7a2b2a" },
        { t: "banco", x: 129.9, z: 0, rumbo: Math.PI, color: "#7a2b2a" },
      ],
    },
  ]
  for (const [id, nombre, r] of [
    ["patio-n", "Patio norte", PATIO_N_T],
    ["patio-s", "Patio sur", PATIO_S_T],
  ] as const) {
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    cuartos.push({
      id: `tes-${id}`,
      planta: P,
      nombre,
      rect: r,
      nodo: [cx, id === "patio-n" ? r.z0 + 1.2 : r.z1 - 1.2],
      piso: "piedra",
      colorPiso: "#a8a294",
      muro: "#c2b8a6",
      paso: true,
      muebles: [...[-6, 6].flatMap((dx) => [-12, 0, 12].map((dz): Mueble => ({ t: "palmera", x: cx + dx, z: cz + dz })))],
    })
  }
  const puertas: Puerta[] = [
    pu("tes-oeste", "tes-vestibulo", "afuera", 100.3, -55.0, 1.1, "z"),
    pu("tes-vest-corr", "tes-vestibulo", "tes-corr-o", 112.55, -55.0, 2.4, "z"),
    pu("tes-n-o", "tes-corr-n", "tes-corr-o", 115.9, -59.7, 3.0, "z", true),
    pu("tes-n-e", "tes-corr-n", "tes-corr-e", 138.1, -59.7, 3.0, "z", true),
    pu("tes-s-o", "tes-corr-s", "tes-corr-o", 115.9, 49.7, 3.0, "z", true),
    pu("tes-s-e", "tes-corr-s", "tes-corr-e", 138.1, 49.7, 3.0, "z", true),
    pu("tes-efec-o", "tes-efectivo", "tes-corr-o", 116.05, 0, 2.4, "z"),
    pu("tes-efec-e", "tes-efectivo", "tes-corr-e", 137.95, 0, 2.4, "z"),
    pu("tes-patio-n", "tes-patio-n", "tes-corr-n", 127, -57.95, 2.0, "x"),
    pu("tes-patio-s", "tes-patio-s", "tes-corr-s", 127, 47.95, 2.0, "x"),
  ]
  const muros: Muro[] = [
    // El forro: al oeste, el de la fachada retranqueada y, en el pabellón norte, el del vestíbulo.
    mu(P, I.x0 - T_FORRO, I.x0, I.z0 - T_FORRO, -61.6),
    mu(P, I.x0 - T_FORRO, I.x0, -49.7, I.z1 + T_FORRO),
    mu(P, 100.02, 100.6, -61.6, -49.7),
    mu(P, I.x1, I.x1 + T_FORRO, I.z0 - T_FORRO, I.z1 + T_FORRO),
    mu(P, I.x0 - T_FORRO, I.x1 + T_FORRO, I.z0 - T_FORRO, I.z0),
    mu(P, I.x0 - T_FORRO, I.x1 + T_FORRO, I.z1, I.z1 + T_FORRO),
    mu(P, 100.02, I.x0, -61.6, -61.3),
    mu(P, 100.02, 112.4, -50.0, -49.7),
    // Bandas, anillo y la Sala del Efectivo.
    mu(P, I.x0, I.x1, -61.6, -61.3),
    mu(P, I.x0, I.x1, 51.3, 51.6),
    mu(P, 112.4, 112.7, -61.3, 51.3),
    mu(P, 141.3, 141.6, -61.3, 51.3),
    mu(P, 115.9, 116.2, -58.1, 48.1),
    mu(P, 137.8, 138.1, -58.1, 48.1),
    mu(P, 116.2, 137.8, -58.1, -57.8),
    mu(P, 116.2, 137.8, 47.8, 48.1),
    mu(P, 116.2, 137.8, -8.3, -8.0),
    mu(P, 116.2, 137.8, 8.0, 8.3),
  ]
  const fila = (pre: string, o: Pick<Parameters<typeof filaOficinas>[0], "eje" | "desde" | "hasta" | "n" | "a0" | "a1" | "pasillo" | "muroPuerta" | "lim" | "fondo">) =>
    filaOficinas({ pre: `tes-${pre}`, planta: P, color: col, ...o })
  return juntar(
    { cuartos, puertas, muros },
    fila("n", { eje: "x", desde: I.x0, hasta: I.x1, n: 4, a0: I.z0, a1: -61.6, pasillo: "tes-corr-n", muroPuerta: -61.45, lim: [116.6, 137.4], fondo: "n" }),
    fila("s", { eje: "x", desde: I.x0, hasta: I.x1, n: 4, a0: 51.6, a1: I.z1, pasillo: "tes-corr-s", muroPuerta: 51.45, lim: [116.6, 137.4], fondo: "s" }),
    fila("o", { eje: "z", desde: -49.7, hasta: 51.3, n: 7, a0: I.x0, a1: 112.4, pasillo: "tes-corr-o", muroPuerta: 112.55, lim: [-60.5, 50.5], fondo: "o" }),
    fila("e", { eje: "z", desde: -61.3, hasta: 51.3, n: 8, a0: 141.6, a1: I.x1, pasillo: "tes-corr-e", muroPuerta: 141.45, lim: [-60.5, 50.5], fondo: "e" }),
  )
}

// ══════════════════════════════════════════════════════════════
// Lo que plantas.ts suma
// ══════════════════════════════════════════════════════════════
const EEOB_B = plantaEEOB(false)
const EEOB_A = plantaEEOB(true)
const TESORO = plantaTesoro()

export const CUARTOS_EDIFICIOS: Cuarto[] = [...PRINCIPAL, ...SOTANO, ...EEOB_B.cuartos, ...EEOB_A.cuartos, ...TESORO.cuartos]
export const PUERTAS_EDIFICIOS: Puerta[] = [...PUERTAS_PRINCIPAL, ...PUERTAS_SOTANO, ...EEOB_B.puertas, ...EEOB_A.puertas, ...TESORO.puertas]
export const MUROS_EDIFICIOS: Muro[] = [...MUROS_PRINCIPAL, ...MUROS_SOTANO, ...EEOB_B.muros, ...EEOB_A.muros, ...TESORO.muros]
export const MACIZOS_EDIFICIOS: Macizo[] = [...MACIZOS_PRINCIPAL, ...MACIZOS_SOTANO]

export const ESCALERAS_EDIFICIOS: Escalera[] = [
  // Del sótano a la planta principal del Ala Oeste: sube hacia el sur y vuelve.
  { id: "ala", nombre: "Escalera del Ala Oeste", abajo: "ala-escalera-sotano", arriba: "ala-escalera", sube: [-66.05, -64.95], llega: [-64.85, -63.75], zA: 11.0, dir: 1, huella: 0.28, zFin: 15.2 },
  { id: "eeob", nombre: "Escalera del Edificio Eisenhower", abajo: "eeob-b-escalera", arriba: "eeob-a-escalera", sube: [-108.6, -106.8], llega: [-106.6, -104.8], zA: 7.0, dir: 1, huella: 0.3, zFin: 12.6 },
]

/**
 * Las puertas a la calle de estos edificios: `nodo` es el del grafo de afuera,
 * a 0,55 m de la puerta (en línea con el nodo de adentro: se cambia de planta
 * justo en el vano).
 */
export const ENLACES_EDIFICIOS: Array<{ nodo: string; cuarto: string; puerta: string; texto: string }> = [
  { nodo: "puerta-oeste-n", cuarto: "ala-vestibulo", puerta: "ala-norte", texto: "Entra por la puerta norte del Ala Oeste" },
  { nodo: "puerta-oeste", cuarto: "ala-pasillo-sur", puerta: "ala-sur", texto: "Entra por la puerta sur del Ala Oeste" },
  { nodo: "col-o-puerta", cuarto: "ala-palmas", puerta: "ala-columnata", texto: "Entra desde la Columnata Oeste, por la Sala de las Palmas" },
  { nodo: "puerta-oval", cuarto: "despacho-oval", puerta: "oval-rosas", texto: "Entra desde el Jardín de las Rosas" },
  { nodo: "puerta-eeob-arriba", cuarto: "eeob-b-vestibulo", puerta: "eeob-este", texto: "Sube la escalinata y entra al Edificio Eisenhower" },
  { nodo: "puerta-tesoro", cuarto: "tes-vestibulo", puerta: "tes-oeste", texto: "Entra al Departamento del Tesoro por el pabellón norte" },
]

/** La cara de adentro de la fachada de cada edificio (para la cámara: se queda sobre la huella). */
export const INTERIORES_EDIFICIOS: Record<Exclude<EdificioId, "residencia">, Rect> = {
  "ala-oeste": { x0: INTERIOR_ALA.x0, x1: OVAL.cx + OVAL.rx, z0: INTERIOR_ALA.z0, z1: OVAL.cz + OVAL.rz },
  eeob: INTERIOR_EEOB,
  tesoro: INTERIOR_TESORO,
}

/** Los patios del Edificio Eisenhower (en el segundo piso, se ve su fondo abajo). */
export const PATIOS_EEOB: Rect[] = [PATIO_N_E, PATIO_S_E]

/**
 * El borde de cada fachada cortada, visto desde arriba: lo de afuera (la
 * huella) menos lo de adentro (hasta donde llegan los cuartos y los forros).
 * Lo que queda en medio es el espesor del muro, que se tapa con el remate.
 */
export const BORDE_ALA = { ovaloAfuera: { rx: 5.9, rz: 4.85 }, ovaloAdentro: { rx: 5.55, rz: 4.45 } }
export const FORRO = { eeob: E_FORRO, tesoro: T_FORRO }
