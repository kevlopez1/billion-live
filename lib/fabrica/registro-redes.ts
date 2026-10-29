// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · QUÉ ADAPTADOR ATIENDE CADA RED
//
// El tick publica solo en una red que (1) está encendida por entorno
// (FABRICA_ACTIVA y FABRICA_<RED>_ACTIVA) y (2) tiene adaptador aquí.
// Mientras los adaptadores de lib/fabrica/redes/ no estén conectados, este
// registro está vacío y el tick no toca ninguna red: lo que llega a su hora
// queda omitido con el cómo ("sin adaptador").
//
// Al conectar uno: importarlo y sumarlo a ADAPTADORES, y completar ctxReal
// con tokens.ts y almacen.ts.
// ──────────────────────────────────────────────────────────────

import type { Adaptador, Ctx, Entorno, RedId } from "./tipos"

export function adaptadores(): Partial<Record<RedId, Adaptador>> {
  return {}
}

export function ctxReal(env: Entorno): Ctx {
  return {
    fetch,
    env,
    ahora: () => new Date(),
    token: async (red) => {
      console.error(`[fabrica/registro-redes] token de ${red} pedido sin tokens.ts conectado: se devuelve null`)
      return null
    },
    almacen: null,
    log: (m) => console.log(m),
  }
}
