// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · DATOS DE PRUEBA (solo para los *.test.ts)
//
// Un guion que pasa todas las guardas y un contexto armado sin base ni red.
// Cada prueba copia el guion y le rompe una sola cosa.
// ──────────────────────────────────────────────────────────────

import type { Episodio, Red } from "@/components/casa-blanca/estudio/guion"
import { idsDelEstudio, type ContextoGuion } from "./guardas"
import { tomasDelMotor } from "./guionista"

/** 60 s de planos + 4,5 s de apertura y cierre = 64,5 s. Solo verdes (Napoleón y Sun Tzu). */
export function guionBueno(): Episodio {
  return {
    id: "fab-20261115-1-napoleon-no-sabe-perder",
    titulo: "Napoleón no sabe perder",
    formato: "16:9",
    visor: "camara",
    planos: [
      { dur: 10, camara: { tipo: "lugar", lugar: "biblioteca" }, hora: "22:05", titulo: "Napoleón no sabe perder", rotulo: "Biblioteca · Subsuelo 3 · 22:05" },
      {
        dur: 12,
        camara: { tipo: "seguir", personaje: "napoleon" },
        reunir: ["napoleon", "suntzu"],
        dialogo: [
          { quien: "napoleon", texto: "Otra partida. Ahora." },
          { quien: "suntzu", texto: "Ya perdiste tres." },
        ],
      },
      {
        dur: 12,
        camara: { tipo: "seguir", personaje: "suntzu" },
        dialogo: [
          { quien: "suntzu", texto: "El supremo arte de la guerra es someter al enemigo sin luchar.", cita: true },
          { quien: "napoleon", texto: "Yo gané en Austerlitz." },
        ],
      },
      { dur: 12, camara: { tipo: "lugar", lugar: "biblioteca" }, rotulo: "Austerlitz, 2 de diciembre de 1805: su victoria más famosa" },
      { dur: 14, camara: { tipo: "seguir", personaje: "napoleon" }, titulo: "¿Quién gana la cuarta?", dialogo: [{ quien: "napoleon", texto: "La cuarta es mía." }] },
    ],
  }
}

/** Lo que el modelo de mentira devuelve para el guion bueno (sin id: lo pone el código). */
export function salidaBuena(ep: Episodio = guionBueno()) {
  const { id: _id, ...episodio } = ep
  return { episodio, descripcion: "Sun Tzu le gana tres partidas seguidas a Napoleón.", miniatura: "Jaque al emperador" }
}

export const TODAS: Red[] = ["youtube", "facebook", "instagram", "tiktok", "x"]

export async function contextoDePrueba(fechaSalida = "2026-11-15", redes: Red[] = TODAS): Promise<ContextoGuion> {
  const tomas = await tomasDelMotor()
  return { fechaSalida, ids: idsDelEstudio(tomas), tomas, redes, recientes: [] }
}

/** Una copia profunda para romper una sola cosa. */
export const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
