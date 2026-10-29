// ──────────────────────────────────────────────────────────────
// CASA BLANCA VIVA — el contrato entre módulos
//
// Todo lo que se pasa de un módulo a otro tiene su tipo aquí. Si un módulo
// necesita algo que no está, se agrega aquí primero.
//
// Unidades: metros. Origen: el centro de la Residencia, a nivel del suelo.
// Ejes: +x = este, -x = oeste, +z = sur (hacia el Jardín Sur y el
// Monumento a Washington), -z = norte (Pennsylvania Avenue), +y = arriba.
// ──────────────────────────────────────────────────────────────

import type { Asiento, PlantaId, Rect } from "./plantas"

export type Vec3 = { x: number; y: number; z: number }

/** La superficie, los tres pisos subterráneos y la ciudad subterránea, la más profunda. */
export type NivelId = "superficie" | "n1" | "n2" | "n3" | "ciudad"
export const ALTURA_NIVEL: Record<NivelId, number> = { superficie: 0, n1: -8, n2: -16, n3: -24, ciudad: -60 }
export const NOMBRE_NIVEL: Record<NivelId, string> = {
  superficie: "Superficie",
  n1: "Subsuelo 1 · Departamentos",
  n2: "Subsuelo 2 · Departamentos y Sala de guerra",
  n3: "Subsuelo 3 · Deporte y ocio",
  ciudad: "Ciudad subterránea",
}

export type TipoLugar = "edificio" | "jardin" | "deporte" | "departamento" | "ocio" | "servicio" | "obra" | "interior"

/**
 * Un lugar al que se puede ir. Es un rectángulo en planta (x0..x1, z0..z1) a
 * la altura `y`. Los personajes entran por `acceso` (un nodo del grafo) y
 * después se mueven libres dentro del rectángulo.
 *
 * `interior: true` = dentro de un edificio de la superficie. Si además tiene
 * `planta`, la sala existe en la escena (se entra y se ve a la gente); sin
 * `planta`, el personaje se oculta mientras está ahí (la regla vieja).
 */
export interface Lugar {
  id: string
  nombre: string
  nivel: NivelId
  tipo: TipoLugar
  x0: number
  x1: number
  z0: number
  z1: number
  y: number
  acceso: string
  interior?: boolean
  /** Un dato real del lugar. Si el lugar es de ficción, lo dice. */
  dato: string
  /** Para lugares de ficción: true. Se muestra con la etiqueta "ficción". */
  ficcion?: boolean
  /** La planta del edificio donde está la sala (plantas.ts). */
  planta?: PlantaId
  /** Donde se para la gente (sin muebles); sin zonas, el rectángulo entero. */
  zonas?: Rect[]
  /** Muebles que no se atraviesan: se rodean. */
  obst?: Rect[]
  /** Donde se sienta la gente (comer, trabajar). */
  asientos?: Asiento[]
}

export interface NodoGrafo {
  id: string
  p: Vec3
  nivel: NivelId
  /** El personaje no se ve mientras está en este nodo (dentro de un edificio, en el ascensor). */
  oculto?: boolean
  /** Dentro de una planta de un edificio (se ve solo con esa planta abierta). */
  planta?: PlantaId
}
/**
 * Arista no dirigida. `ascensor: true` = el tramo se hace en ascensor (vertical).
 * `interior: true` = por dentro de un edificio que todavía no tiene planta (no se ve).
 */
export type Arista = [string, string] | [string, string, { ascensor?: boolean; interior?: boolean }]
export interface Grafo {
  nodos: NodoGrafo[]
  aristas: Arista[]
}

// ── Personajes ────────────────────────────────────────────────

/** Una frase. `{t, c: true}` = cita o paráfrasis de un texto conocido. */
export type Linea = string | { t: string; c: true }

export type Tema =
  | "poder" | "dinero" | "muerte" | "tecnologia" | "guerra" | "fe" | "verdad" | "futuro" | "casa" | "comida" | "deporte" | "disciplina"

export type EstadoCuerpo = "quieto" | "camina" | "corre" | "sentado" | "habla" | "duerme" | "deporte" | "ascensor"

export interface Apariencia {
  /** Color de piel (hex). */
  piel: string
  /** Altura real aproximada en metros (1,55–2,00). */
  altura: number
  complexion: "delgado" | "medio" | "fuerte" | "atletico"
  pelo: {
    estilo: "corto" | "largo" | "calvo" | "rizado" | "rizado_voluminoso" | "peinado_atras" | "peinado_lado" | "rapado" | "melena_bob" | "rubio_tupe"
    color: string
  }
  barba?: { estilo: "completa" | "corta" | "candado" | "menton" | "larga" | "barba_de_dias"; color: string }
  sombrero?: "bicornio" | "chistera" | "laurel" | "gorra" | "corona_egipcia" | "boina" | null
  ropa: {
    /**
     * "androide": sudadera con el nombre en el pecho sobre un cuerpo de androide
     * (piel sintética, manos de metal; las IA: Claude y ChatGPT). `color` es la
     * sudadera y `color2` el pantalón.
     * "holograma": figura de luz translúcida (el primer diseño de las IA; hoy sin uso).
     */
    tipo: "traje" | "tunica" | "toga" | "uniforme_militar" | "deportivo" | "casual" | "cuello_alto" | "camiseta_basquet" | "vestido_egipcio" | "tunica_renacentista" | "androide" | "holograma"
    color: string
    color2?: string
    corbata?: string
  }
  accesorios: Array<"gafas" | "gafas_redondas" | "gafas_sol" | "reloj" | "balon" | "pergamino" | "cuaderno" | "collar_oro" | "faja" | "charreteras" | "auriculares" | "laptop">
}

/** Una entrada del horario: a partir de `hora` (0–23, puede ser decimal) va a `lugarId` a hacer `actividad`. */
export type EntradaHorario = [hora: number, lugarId: string, actividad: string, estado?: "duerme" | "trabaja" | "deporte" | "fantasma"]

export interface Personaje {
  id: string
  nombre: string
  /** Nombre corto para etiquetas y burbujas. */
  corto: string
  /** Color de su etiqueta y de su punto en el radar. */
  color: string
  epoca: string
  /** Su papel dentro de la casa. */
  rol: string
  departamentoId: string
  /**
   * "historico" | "fallecido" (siglo XX–XXI) | "vivo" | "arquetipo" (el Masón, el Iluminado) | "ia" (Claude, ChatGPT).
   * Los vivos llevan un aviso de ficción más visible.
   */
  real: "historico" | "fallecido" | "vivo" | "arquetipo" | "ia"
  /** Datos reales y verificables, 2–3 frases. */
  bio: string
  /** Cómo habla: guía para el guion y para la IA. */
  voz: string
  rasgos: [string, string, string]
  apariencia: Apariencia
  horario: EntradaHorario[]
  temas: Partial<Record<Tema, Linea[]>>
  pensamientos: Linea[]
  replicas: string[]
  /** Reacción de guion ante una noticia y el lugar al que va. */
  noticia: [texto: string, lugarId: string]
  /** Lo que la IA NO debe hacer con este personaje (personas vivas, temas sensibles). */
  limites?: string
}

/** Conversación de guion entre dos personajes: clave = ids ordenados unidos por "|". */
export type Especiales = Record<string, Array<[id: string, texto: string]>>

// ── La empresa ────────────────────────────────────────────────

export interface Objetivo {
  id: string
  titulo: string
  descripcion: string
  /** "recaudado" = se mide con el contador real del reto (lib/contador.ts). */
  metrica?: "recaudado"
  departamentos: string[]
}

export interface Departamento {
  id: string
  nombre: string
  liderId: string
  mision: string
  color: string
  /** Lugar (bullpen) donde trabaja: "dep-<id>". */
  lugarId: string
  nivel: NivelId
  /** 12–20 especialidades; los 100 puestos se reparten entre ellas. */
  roles: string[]
  /** Tareas de arranque por objetivo, en el orden en que se hacen. */
  tareas: Array<{ objetivoId: string; titulo: string; rol: string; detalle: string }>
}

/** Un puesto del departamento (0–99). El nombre y el rol salen de una semilla fija. */
export interface Agente {
  id: string
  departamentoId: string
  puesto: number
  nombre: string
  rol: string
}

export type EstadoPuesto = "libre" | "trabajando" | "entregado"

export interface Entregable {
  id: string
  creado: string
  objetivoId: string
  departamentoId: string
  puesto: number
  agenteNombre: string
  rol: string
  titulo: string
  /** Solo viene si quien pide es Kev, o si el entregable es público. */
  contenido?: string
  publico: boolean
}

// ── Escena 3D ─────────────────────────────────────────────────

export type Calidad = "alta" | "media" | "baja"

export interface TickEscena {
  dt: number
  /** Segundos reales desde que arrancó la escena. */
  tiempo: number
  /** Hora del día del mundo, 0–24 (decimal). */
  hora: number
  /** 0 = pleno día, 1 = noche cerrada. */
  noche: number
}
