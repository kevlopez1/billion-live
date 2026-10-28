// ──────────────────────────────────────────────────────────────
// EL EPISODIO DE MUESTRA del estudio (?ep=muestra).
//
// Sirve para probar el estudio de punta a punta mientras el calendario
// (episodios.ts) está vacío: una toma del motor con título, seguir a un
// residente con dos líneas, la Sala de guerra con el visor de cámara y tres
// residentes reunidos, y un lugar en modo maqueta con el número real del reto.
//
// Las líneas no se inventan: son frases que ya dicen esos personajes en
// datos/personajes.ts (recortadas a una oración cuando eran largas).
// ──────────────────────────────────────────────────────────────

import type { Episodio } from "./guion"

export const MUESTRA: Episodio = {
  id: "muestra",
  titulo: "Muestra del estudio",
  formato: "16:9",
  visor: "cine",
  fps: 30,
  planos: [
    {
      dur: 2.5,
      camara: { tipo: "toma", toma: "portico-norte" },
      hora: "17:30",
      titulo: "22 líderes y dos IA",
      rotulo: "Pórtico Norte · 17:30",
    },
    {
      dur: 5,
      camara: { tipo: "seguir", personaje: "karp" },
      rotulo: "Alex Karp · Jardín Sur",
      dialogo: [
        { quien: "karp", texto: "Hago ejercicio todos los días." },
        { quien: "karp", texto: "¿Almuerzo? Diez minutos." },
      ],
    },
    {
      dur: 3.5,
      camara: { tipo: "toma", toma: "sala-guerra" },
      visor: "camara",
      reunir: ["suntzu", "napoleon", "claude"],
      dialogo: [{ quien: "napoleon", texto: "Un trono es solo una banca forrada de terciopelo." }],
    },
    {
      dur: 2,
      camara: { tipo: "lugar", lugar: "jardin-sur" },
      maqueta: true,
      rotulo: "Recaudado en el reto: {RECAUDADO}",
    },
  ],
}
