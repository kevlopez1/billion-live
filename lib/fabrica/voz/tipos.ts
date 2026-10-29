// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · VOZ: EL CONTRATO DE LOS PROVEEDORES
//
// Dos proveedores con la misma forma: ElevenLabs (elevenlabs.ts) y uno falso
// (falso.ts) que devuelve audio de prueba con duraciones realistas, para que
// la tanda corra de punta a punta sin clave. Nunca lanzan: devuelven el
// resultado o un Fallo con la clase y el CÓMO (mismo contrato que las redes).
// ──────────────────────────────────────────────────────────────

import type { Fallo } from "../tipos"

export type { Fallo }

/** Una línea para decir: quién, con qué voz y qué texto (ya listo para la voz). */
export interface PedidoVoz {
  personaje: string
  voiceId: string
  texto: string
}

/** Dónde quedó una línea dentro de su tramo de audio. */
export interface SegmentoLinea {
  /** Posición de la línea dentro del pedido (0, 1, 2…). */
  indice: number
  inicioS: number
  finS: number
  duracionS: number
}

/** El audio de un pedido de diálogo, con la duración de cada línea. */
export interface TramoDeAudio {
  ok: true
  audio: Uint8Array
  formato: "mp3" | "wav"
  /** Lo que dura el audio entero. */
  duracionS: number
  lineas: SegmentoLinea[]
  /** Créditos que costó (los que informó el servicio o, si no informó, los estimados). */
  creditos: number
  /** Cómo se obtuvo: modelo, si el costo fue informado o estimado, reintentos. */
  como: string
}

export interface Creditos {
  ok: true
  usados: number
  limite: number
  restantes: number
  /** ISO, cuándo se renuevan, si el servicio lo dice. */
  renuevaEn: string | null
  plan: string | null
}

/** Una voz candidata de Voice Design (todavía no está en la biblioteca). */
export interface Candidata {
  generatedVoiceId: string
  audio: Uint8Array
  formato: "mp3" | "wav"
  duracionS: number | null
}

export interface ProveedorVoz {
  nombre: "elevenlabs" | "falso"
  /** El modelo de diálogo. */
  modelo: string
  /** true = audio de prueba: un video con esta voz nunca se publica. */
  falso: boolean
  /** Lo más largo que acepta un pedido de diálogo, en caracteres. */
  maxCaracteres: number
  /** Dice las líneas en orden, en un solo audio, con la duración de cada una. */
  dialogo(pedidos: PedidoVoz[]): Promise<TramoDeAudio | Fallo>
  /** El saldo de la cuenta. Un Fallo dice por qué no se pudo leer. */
  creditos(): Promise<Creditos | Fallo>
  /** Lo que costaría decir esos caracteres, en créditos. */
  costoEstimado(caracteres: number): number
  /** Caracteres reservados en este proceso (cada intento cuenta: se reserva antes de mandar). */
  gastados(): number
}

export interface Disenador {
  nombre: "elevenlabs" | "falso"
  modeloDiseno: string
  /** Pide candidatas a Voice Design a partir de una descripción y un texto de muestra. */
  disenar(descripcion: string, muestra: string): Promise<Candidata[] | Fallo>
  /** Guarda una candidata en la biblioteca como voz. No es idempotente: antes, `buscarVoz`. */
  crearVoz(generatedVoiceId: string, nombre: string, descripcion: string): Promise<{ ok: true; voiceId: string } | Fallo>
  /** Una voz de la biblioteca con ese nombre exacto (para no crearla dos veces). */
  buscarVoz(nombre: string): Promise<{ ok: true; voiceId: string | null } | Fallo>
  creditos(): Promise<Creditos | Fallo>
}
