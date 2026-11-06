// ──────────────────────────────────────────────────────────────
// Contrato de la escena 3D: lo que cada módulo de escena recibe y entrega.
// Lo implementa motor.ts; lo usan arquitectura.ts, paisaje.ts, subsuelo.ts,
// avatares.ts y la interfaz (CasaBlancaViva.tsx).
// ──────────────────────────────────────────────────────────────

import type * as THREE from "three"
import type { Calidad, EstadoCuerpo, EstadoPuesto, NivelId, TickEscena, Vec3 } from "../tipos"

/** Lo que el motor le pasa a cada constructor de escena. */
export interface CtxEscena {
  scene: THREE.Scene
  /** Cada objeto va al grupo de su nivel: el motor muestra u oculta niveles enteros. */
  niveles: Record<NivelId, THREE.Group>
  calidad: Calidad
  /** false en calidad baja: no activar castShadow/receiveShadow. */
  sombras: boolean
  /** Se llama en cada cuadro, después de mover el sol. */
  alActualizar(fn: (t: TickEscena) => void): void
  /**
   * Material que se enciende de noche (ventanas, faroles, letreros). El motor
   * pone `emissiveIntensity` entre `dia` (por defecto 0) y `noche` según la hora.
   */
  alAnochecer(mat: THREE.MeshStandardMaterial, noche: number, dia?: number): void
  /**
   * Luz que solo vale de noche (focos de la fachada, faroles importantes). El
   * motor escala su intensidad con la hora y puede apagar las que sobren en
   * calidad media/baja. Usarlas con medida: cada luz cuesta en todos los materiales.
   */
  luzNocturna(luz: THREE.Light, intensidadNoche: number): void
  /** Marca un objeto como clicable: al tocarlo, la interfaz abre ese lugar. */
  seleccionable(obj: THREE.Object3D, lugarId: string): void
  /** Texturas y materiales compartidos (creados una vez). */
  materiales: Materiales
}

/** Materiales base. Los módulos pueden crear los suyos, pero estos dan unidad de color. */
export interface Materiales {
  /** Arenisca pintada de blanco de la Casa Blanca. */
  fachada: THREE.MeshStandardMaterial
  /** Molduras, cornisas y columnas: un blanco apenas más cálido. */
  moldura: THREE.MeshStandardMaterial
  /** Vidrio de ventana: oscuro y reflejante de día. */
  vidrio: THREE.MeshStandardMaterial
  /** Vidrio de ventana encendido de noche (cálido). Registrado en alAnochecer. */
  ventanaNoche: THREE.MeshStandardMaterial
  techoMetal: THREE.MeshStandardMaterial
  pasto: THREE.MeshStandardMaterial
  pastoRayado: THREE.MeshStandardMaterial
  arbusto: THREE.MeshStandardMaterial
  hoja: THREE.MeshStandardMaterial
  corteza: THREE.MeshStandardMaterial
  asfalto: THREE.MeshStandardMaterial
  acera: THREE.MeshStandardMaterial
  grava: THREE.MeshStandardMaterial
  agua: THREE.MeshStandardMaterial
  hierroNegro: THREE.MeshStandardMaterial
  granito: THREE.MeshStandardMaterial
  concretoPulido: THREE.MeshStandardMaterial
  acero: THREE.MeshStandardMaterial
  madera: THREE.MeshStandardMaterial
}

/** El subsuelo entrega dónde está cada puesto y cómo pintarlo. */
export interface Subsuelo {
  /** Por departamento: 100 puestos (posición del asiento y hacia dónde mira, en radianes). */
  puestos: Record<string, Array<{ pos: Vec3; rumbo: number }>>
  /** Pinta los 100 puestos de un departamento según su estado. */
  marcarPuestos(depId: string, estados: EstadoPuesto[]): void
  /** Si el objeto tocado es un puesto, dice de qué departamento y cuál. */
  identificar(obj: THREE.Object3D, instanceId?: number): { depId: string; puesto: number } | null
}

/** Un personaje en 3D. Mide `altura` metros con los pies en y = 0 del grupo. */
export interface Avatar {
  raiz: THREE.Group
  altura: number
  /** Punto sobre la cabeza (coordenadas locales) para la etiqueta y la burbuja. */
  cabeza: THREE.Object3D
  animar(estado: EstadoCuerpo, dt: number, velocidad: number): void
  resaltar(on: boolean): void
  /** Silueta que se ve a través de las paredes: para seguir a alguien que está dentro de un edificio. */
  rayosX?(on: boolean): void
  dispose(): void
}

export type ModoCamara = "intro" | "dron" | "seguir" | "cine" | "nivel"

export interface Toque {
  tipo: "personaje" | "lugar" | "puesto"
  id: string
  puesto?: number
}

/** Lo que la interfaz usa de la escena. */
export interface Escena {
  /** Arranca el bucle de render. */
  iniciar(): void
  /** Hora del mundo (0–24). La escena mueve el sol, el cielo y las luces. */
  setHora(hora: number): void
  /** Cambia de nivel con una transición de cámara. */
  mostrarNivel(nivel: NivelId): void
  nivel(): NivelId
  /** Plano de apertura: zoom out desde el Pórtico Norte hasta la vista aérea. Resuelve al terminar o al saltarlo. */
  intro(): Promise<void>
  saltarIntro(): void
  modoCamara(modo: ModoCamara, objetivoId?: string): void
  /** Lleva la cámara a mirar un punto (para "ir a" un lugar). */
  enfocar(p: Vec3, distancia?: number): void
  /** Estado de los personajes de este cuadro (lo produce la simulación). */
  actualizarPersonajes(
    estados: Array<{ id: string; pos: Vec3; rumbo: number; estado: EstadoCuerpo; visible: boolean; velocidad: number; planta?: string | null }>,
  ): void
  marcarPuestos(depId: string, estados: EstadoPuesto[]): void
  /** Posición en pantalla (px, relativa al canvas) del punto sobre la cabeza de un personaje. */
  pantallaDe(id: string): { x: number; y: number; visible: boolean } | null
  /** Posición en pantalla de un punto del mundo. */
  proyectar(p: Vec3): { x: number; y: number; visible: boolean }
  /** Posición de la cámara y su rumbo (para el radar). */
  camaraEnPlanta(): { x: number; z: number; rumbo: number }
  alTocar(fn: (t: Toque) => void): void
  /** Imágenes PNG (data URL) de cada personaje para las fichas y el selector. */
  retratos(): Promise<Record<string, string>>
  calidad(): Calidad
  setCalidad(c: Calidad): void
  redimensionar(): void
  destruir(): void
}
