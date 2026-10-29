// ──────────────────────────────────────────────────────────────
// CÓMO SE LLEGA A CADA LUGAR
//
// Una sola fuente para la orientación: el orden de los niveles, dónde está
// el ascensor, cómo se llaman los pasillos, el "cómo llegar" de cada lugar y
// el "dónde está" de cada residente. Lo usan el mapa y los paneles (ui/), los
// letreros 3D (escena/navegacion.ts) y la cámara (escena/motor-camara.ts).
//
// Todo sale de lugares.ts (CELDAS, LUGAR, NODO): si un lugar se mueve allí,
// las indicaciones cambian solas. Aquí no hay coordenadas escritas a mano
// salvo el pabellón de la superficie, que solo existe en la escena.
// ──────────────────────────────────────────────────────────────

import { CELDAS, DEPARTAMENTOS_BASE, GRAFO, HUELLAS, LUGAR, LUGARES, NODO, SUB_COLUMNAS, SUB_FILAS } from "./lugares"
import { CUARTO, ENLACES, ESCALERAS, NOMBRE_EDIFICIO, PLANTA, type PlantaId } from "./plantas"
import { ALTURA_NIVEL, NOMBRE_NIVEL, type EstadoCuerpo, type Lugar, type NivelId, type Vec3 } from "./tipos"

/** De arriba hacia abajo: el corte de la casa. */
export const ORDEN_NIVELES: NivelId[] = ["superficie", "n1", "n2", "n3", "ciudad"]

/** "Subsuelo 1", "Ciudad"…: el nombre corto (para botones y el radar). */
export const NIVEL_CORTO: Record<NivelId, string> = {
  superficie: "Superficie",
  n1: "Subsuelo 1",
  n2: "Subsuelo 2",
  n3: "Subsuelo 3",
  ciudad: "Ciudad subterránea",
}

/** Lo que hay en cada nivel (la segunda mitad de NOMBRE_NIVEL). */
export const NIVEL_CONTENIDO: Record<NivelId, string> = {
  superficie: "Jardines y edificios",
  n1: NOMBRE_NIVEL.n1.split(" · ")[1] ?? "",
  n2: NOMBRE_NIVEL.n2.split(" · ")[1] ?? "",
  n3: NOMBRE_NIVEL.n3.split(" · ")[1] ?? "",
  ciudad: "Bajo los subsuelos",
}

/** "0 m", "−8 m"… (con el signo menos tipográfico). */
export const profundidad = (n: NivelId) => (ALTURA_NIVEL[n] === 0 ? "0 m" : `−${Math.abs(ALTURA_NIVEL[n])} m`)

/** El nivel de arriba y el de abajo (null en los extremos). */
export function nivelVecino(n: NivelId, paso: -1 | 1): NivelId | null {
  return ORDEN_NIVELES[ORDEN_NIVELES.indexOf(n) + paso] ?? null
}

/**
 * El núcleo de ascensores de vidrio: atraviesa los tres subsuelos y baja a la
 * ciudad. Sale del grafo (nodo "n1-asc") para que la escena y la simulación
 * lo vean en el mismo lugar.
 */
export const NUCLEO_ASCENSOR = { x: NODO["n1-asc"]?.p.x ?? 0, z: NODO["n1-asc"]?.p.z ?? 22 }

/**
 * El pabellón de vidrio de la superficie: la entrada al ascensor, en el eje
 * del Pórtico Sur, a pocos pasos de la escalinata (el pórtico llega a z = 22,5).
 * El camino de grava del Jardín Sur lo atraviesa de norte a sur.
 */
export const PABELLON_ASCENSOR = {
  x: HUELLAS.porticoSur.cx,
  z: HUELLAS.porticoSur.cz + HUELLAS.porticoSur.radio + 8.5,
  ancho: 8.4,
  fondo: 5.2,
  alto: 3.6,
}

/** Dónde está el tubo del ascensor en cada nivel (la cámara lo recorre al cambiar de nivel). */
export function ejeAscensor(n: NivelId): { x: number; z: number } {
  if (n === "superficie") return { x: PABELLON_ASCENSOR.x, z: PABELLON_ASCENSOR.z }
  if (n === "ciudad") return { x: NODO["ciudad-asc"]?.p.x ?? NUCLEO_ASCENSOR.x, z: NODO["ciudad-asc"]?.p.z ?? NUCLEO_ASCENSOR.z }
  return NUCLEO_ASCENSOR
}

// ── Pasillos del subsuelo ──────────────────────────────────────
// Los mismos tres pasillos en los tres subsuelos: el 1 pasa frente al
// ascensor; el eje central baja de norte a sur y los une.
export interface Celda {
  nivel: "n1" | "n2" | "n3"
  fila: number
  col: number
  cx: number
  cz: number
  /** Pasillo al que da su puerta: 1, 2 o 3 (de norte a sur). */
  pasillo: number
  lado: "este" | "oeste"
  /** Puerta contando desde el eje central: 1 o 2. */
  puerta: number
}

export function celdaDe(lugarId: string): Celda | null {
  for (const nivel of ["n1", "n2", "n3"] as const) {
    for (let fila = 0; fila < CELDAS[nivel].length; fila++) {
      const col = CELDAS[nivel][fila].indexOf(lugarId)
      if (col < 0) continue
      const cx = SUB_COLUMNAS[col]
      const orden = [...SUB_COLUMNAS].filter((x) => Math.sign(x) === Math.sign(cx)).sort((a, b) => Math.abs(a) - Math.abs(b))
      return {
        nivel,
        fila,
        col,
        cx,
        cz: SUB_FILAS[fila],
        pasillo: fila + 1,
        lado: cx < NUCLEO_ASCENSOR.x ? "oeste" : "este",
        puerta: orden.indexOf(cx) + 1,
      }
    }
  }
  return null
}

// ── Rumbos ─────────────────────────────────────────────────────
const RUMBOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]
/** Rumbo de b visto desde a (−z es el norte). */
export function rumbo(a: { x: number; z: number }, b: { x: number; z: number }): string {
  const ang = (Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI
  return RUMBOS[((Math.round(ang / 45) % 8) + 8) % 8]
}
const centro = (l: Lugar) => ({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2 })
const metros = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 5) * 5

/** El edificio que contiene un lugar interior (por su acceso en el grafo). */
const EDIFICIO_DE_ACCESO: Record<string, string> = {
  "oeste-int": "el Ala Oeste",
  "eeob-int": "el Edificio Eisenhower",
  "tesoro-int": "el Departamento del Tesoro",
}
const EDIFICIO_CON_ARTICULO: Record<string, string> = {
  residencia: "la Residencia",
  "ala-oeste": "el Ala Oeste",
  eeob: "el Edificio Eisenhower",
  tesoro: "el Departamento del Tesoro",
}
export function edificioDe(l: Lugar): string | null {
  if (!l.interior) return null
  // Una sala con planta entra por su propio nodo: el edificio sale de la planta.
  if (l.planta) return EDIFICIO_CON_ARTICULO[PLANTA[l.planta].edificio] ?? "un edificio"
  // Las habitaciones: su acceso es la puerta de un dormitorio, que sí es de una planta.
  const pl = NODO[l.acceso]?.planta
  if (pl) return EDIFICIO_CON_ARTICULO[PLANTA[pl].edificio] ?? "un edificio"
  return EDIFICIO_DE_ACCESO[l.acceso] ?? "un edificio"
}
/** "Dentro de la Residencia", "Dentro del Ala Oeste". */
export const dentroDe = (edificio: string) => `Dentro de ${edificio}`.replace("de el ", "del ")

// ── Cómo llegar ────────────────────────────────────────────────
export interface Paso {
  /** Para el ícono: dónde empieza, el ascensor, una escalera, un pasillo o la llegada. */
  tipo: "inicio" | "ascensor" | "escalera" | "pasillo" | "llegada"
  texto: string
}

/** "la Sala Central", "el Gran Corredor": el artículo de cada cuarto. */
const FEMENINOS = /^(Sala|Galería|Despensa|Antesala|Escalinata|Gran Escalera|Escalera|Biblioteca|Cocina|Recepción|Habitación)/
const conArticulo = (n: string) => `${FEMENINOS.test(n) ? "la" : "el"} ${n}`
/** "a la Planta de Estado", "al Segundo piso". */
const aPlanta = (p: PlantaId) => (/^Planta/.test(PLANTA[p].nombre) ? `a la ${PLANTA[p].nombre}` : `al ${PLANTA[p].nombre}`)
/** Los cuartos que son una caja de escalera (no se nombran como pasillo). */
const DE_ESCALERA = new Set(ESCALERAS.flatMap((e) => [e.abajo, e.arriba]))

/**
 * El camino por dentro, sacado del grafo: desde la puerta del edificio que
 * queda más cerca (por dentro) hasta el nodo de llegada. Devuelve la puerta
 * y los nodos en orden.
 */
function caminoDentro(destino: string): { entrada: (typeof ENLACES)[number]; nodos: string[] } | null {
  const vecinos = new Map<string, string[]>()
  for (const [a, b, op] of GRAFO.aristas.map((x) => [x[0], x[1], x[2]] as const)) {
    if (op?.interior || op?.ascensor) continue
    vecinos.set(a, [...(vecinos.get(a) ?? []), b])
    vecinos.set(b, [...(vecinos.get(b) ?? []), a])
  }
  const largo = (ns: string[]) => ns.reduce((s, n, i) => (i ? s + Math.hypot(NODO[n].p.x - NODO[ns[i - 1]].p.x, NODO[n].p.y - NODO[ns[i - 1]].p.y, NODO[n].p.z - NODO[ns[i - 1]].p.z) : 0), 0)
  let mejor: { entrada: (typeof ENLACES)[number]; nodos: string[]; m: number } | null = null
  // Se entra desde el suelo (el balcón solo se alcanza desde adentro).
  for (const entrada of ENLACES.filter((e) => !e.oculto && (NODO[e.nodo]?.p.y ?? 1) < 0.5)) {
    const previo = new Map<string, string>()
    const cola = [entrada.nodo]
    const vistos = new Set(cola)
    while (cola.length) {
      const n = cola.shift()!
      if (n === destino) break
      for (const v of vecinos.get(n) ?? []) {
        if (vistos.has(v) || !NODO[v]?.planta) continue
        vistos.add(v)
        previo.set(v, n)
        cola.push(v)
      }
    }
    if (!previo.has(destino)) continue
    const nodos: string[] = []
    for (let n: string | undefined = destino; n; n = previo.get(n)) nodos.unshift(n)
    const m = largo(nodos)
    if (!mejor || m < mejor.m) mejor = { entrada, nodos, m }
  }
  return mejor
}

/** "Al sur de la Sala Central": por dónde se entra, las escaleras y dónde queda la sala respecto del último pasillo. */
function pasosHasta(destino: string, nombre: string, donde: { x: number; z: number }): Paso[] {
  const c = caminoDentro(destino)
  if (!c) return []
  const pasos: Paso[] = [{ tipo: "inicio", texto: c.entrada.texto }]
  // Escaleras en orden; las seguidas de la misma escalera se dicen juntas ("hasta el Tercer piso").
  let pasillos: string[] = []
  for (const n of c.nodos) {
    const esc = /^i-e-(.+)-3$/.exec(n)
    if (esc) {
      const e = ESCALERAS.find((x) => x.id === esc[1])!
      const llega = NODO[n].planta!
      const prev = pasos[pasos.length - 1]
      const texto = `${e.nombre} ${aPlanta(llega)}`
      if (prev.tipo === "escalera" && prev.texto.startsWith(e.nombre)) prev.texto = texto
      else pasos.push({ tipo: "escalera", texto })
      pasillos = []
      continue
    }
    const id = n.startsWith("i-") && !n.startsWith("i-p-") && !n.startsWith("i-e-") ? n.slice(2) : null
    const cu = id ? CUARTO[id] : null
    if (!cu) continue
    if (cu.yNodo !== undefined) {
      pasos.push({ tipo: "escalera", texto: `${cu.nombre.replace(" norte", " de mármol")} ${aPlanta(cu.planta)}` })
      continue
    }
    // Los pasillos y las salas por las que se pasa (no la de llegada).
    if (n !== destino && !DE_ESCALERA.has(cu.id) && pasillos[pasillos.length - 1] !== cu.id) pasillos.push(cu.id)
  }
  if (pasillos.length) {
    const nombres = pasillos.map((p) => conArticulo(CUARTO[p].nombre))
    pasos.push({ tipo: "pasillo", texto: nombres.length > 1 ? `Por ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : `Por ${nombres[0]}` })
    const ult = CUARTO[pasillos[pasillos.length - 1]]
    const cu = { x: (ult.rect.x0 + ult.rect.x1) / 2, z: (ult.rect.z0 + ult.rect.z1) / 2 }
    pasos.push({ tipo: "llegada", texto: `${nombre}: la puerta al ${rumbo(cu, donde)} de ${conArticulo(ult.nombre)}` })
  } else pasos.push({ tipo: "llegada", texto: nombre })
  return pasos.map((p) => ({ ...p, texto: p.texto.replace(/ de el /g, " del ").replace(/ a el /g, " al ") }))
}

/** Los pasos dentro de un edificio hasta una sala con planta (o hasta la puerta de las habitaciones). */
function pasosDentro(lugarId: string): Paso[] {
  const l = LUGAR[lugarId]
  if (!l) return []
  if (l.planta) return pasosHasta(l.acceso, l.nombre, centro(l))
  if (NODO[l.acceso]?.planta) {
    const n = NODO[l.acceso]
    return pasosHasta(l.acceso, `${l.nombre} del ${PLANTA[n.planta!].nombre}`, { x: n.p.x, z: n.p.z - 1 })
  }
  return []
}

const DESDE_SUPERFICIE: Paso = { tipo: "inicio", texto: "Pabellón del ascensor, junto al Pórtico Sur" }
const ascensorA = (n: NivelId): Paso => ({ tipo: "ascensor", texto: `Ascensor al ${NIVEL_CORTO[n]} (${profundidad(n)})` })

/** Los pasos para llegar a un lugar desde la superficie. */
export function comoLlegar(lugarId: string): Paso[] {
  const l = LUGAR[lugarId]
  if (!l) return []
  if (l.planta || NODO[l.acceso]?.planta) return pasosDentro(lugarId)
  if (l.nivel === "superficie") {
    const c = centro(l)
    const edificio = edificioDe(l)
    const res = { x: 0, z: 0 }
    const m = metros(res, c)
    if (edificio) {
      const donde = edificio === "la Residencia" ? "Es el edificio central" : `A ${m} m al ${rumbo(res, c)} de la Residencia`
      return [
        { tipo: "inicio", texto: donde },
        { tipo: "llegada", texto: `${dentroDe(edificio)}: desde afuera no se ve` },
      ]
    }
    return [{ tipo: "llegada", texto: m < 25 ? "Junto a la Residencia" : `A ${m} m al ${rumbo(res, c)} de la Residencia` }]
  }
  if (l.nivel === "ciudad") {
    const asc = ejeAscensor("ciudad")
    const c = centro(l)
    const m = metros(asc, c)
    return [
      DESDE_SUPERFICIE,
      { tipo: "ascensor", texto: `Ascensor hasta el fondo: ${NIVEL_CORTO.ciudad} (${profundidad("ciudad")})` },
      { tipo: "llegada", texto: m < 15 ? "Al salir del ascensor" : `A ${m} m al ${rumbo(asc, c)} del ascensor` },
    ]
  }
  const celda = celdaDe(lugarId)
  if (!celda) return [DESDE_SUPERFICIE, ascensorA(l.nivel)]
  const pasillo: Paso =
    celda.pasillo === 1
      ? { tipo: "pasillo", texto: "Pasillo 1, frente al ascensor" }
      : { tipo: "pasillo", texto: `Eje central hasta el Pasillo ${celda.pasillo}` }
  return [
    DESDE_SUPERFICIE,
    ascensorA(celda.nivel),
    pasillo,
    { tipo: "llegada", texto: `Al ${celda.lado}, ${celda.puerta}.ª puerta` },
  ]
}

// ── Dónde está un residente ────────────────────────────────────
export interface EstadoUbicacion {
  lugarId: string | null
  destinoId: string | null
  nivel: NivelId
  visible: boolean
  estado: EstadoCuerpo
  pos: Vec3
}

/** Nombre corto del lugar para listas ("Ofertas y Ventas" en vez de "Departamento de Ofertas y Ventas"). */
export function nombreCorto(lugarId: string): string {
  const d = DEPARTAMENTOS_BASE.find((x) => x.lugarId === lugarId)
  return d ? d.nombre : LUGAR[lugarId]?.nombre ?? lugarId
}

/**
 * "Dentro de la Residencia · Salón Azul", "Subsuelo 1 · Ofertas y Ventas",
 * "En el ascensor", "De camino a la Cafetería". `dentro` dice si no se ve
 * (la cámara no lo puede mostrar).
 */
export function dondeEsta(e: EstadoUbicacion): { texto: string; dentro: boolean } {
  if (e.estado === "ascensor") return { texto: "En el ascensor", dentro: true }
  const l = e.lugarId ? LUGAR[e.lugarId] : undefined
  if (l?.planta) return { texto: `${NOMBRE_EDIFICIO[PLANTA[l.planta].edificio]} · ${PLANTA[l.planta].nombre} · ${l.nombre}`, dentro: false }
  if (l) {
    const edificio = edificioDe(l)
    if (edificio) return { texto: `${dentroDe(edificio)} · ${l.nombre}`, dentro: true }
    if (l.nivel === "superficie") return { texto: l.nombre, dentro: false }
    return { texto: `${NIVEL_CORTO[l.nivel]} · ${nombreCorto(l.id)}`, dentro: false }
  }
  const destino = e.destinoId ? LUGAR[e.destinoId] : undefined
  if (destino) return { texto: `De camino a ${nombreCorto(destino.id)}`, dentro: !e.visible }
  return { texto: NIVEL_CORTO[e.nivel], dentro: !e.visible }
}

// ── Encuadre de la cámara ──────────────────────────────────────
/**
 * El punto y la distancia a los que va la cámara para mostrar un lugar
 * entero. Un lugar interior se muestra desde afuera: su edificio.
 */
export function encuadreDe(lugarId: string): { centro: Vec3; distancia: number; nivel: NivelId } | null {
  if (lugarId === "ascensor") {
    const p = PABELLON_ASCENSOR
    return { centro: { x: p.x, y: 1.5, z: p.z }, distancia: 34, nivel: "superficie" }
  }
  const l = LUGAR[lugarId]
  if (!l) return null
  const c = centro(l)
  const lado = Math.max(l.x1 - l.x0, l.z1 - l.z0)
  // Una celda del subsuelo (40 x 34 m) entra entera a ~62 m; los jardines grandes piden más.
  const distancia = Math.min(300, Math.max(30, lado * 1.35 + 8))
  return { centro: { x: c.x, y: l.y, z: c.z }, distancia, nivel: l.nivel }
}

/** Los lugares de cada nivel, en el orden del mapa. */
export function lugaresDe(n: NivelId): Lugar[] {
  return LUGARES.filter((l) => l.nivel === n)
}
