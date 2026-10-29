// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · QUÉ SE PUEDE PEDIRLE A /api/fabrica/estado (puro)
//
//   pausar    Kev, el vigilante (bot de Prime) o alguien del equipo nombrado
//             en FABRICA_PAUSA_EQUIPO. La fábrica entera o una red.
//   reanudar  SOLO Kev. Una pausa la puede poner cualquiera de los tres; quitarla
//             es decidir que el problema se resolvió, y eso es de Kev.
//   ajustar   SOLO Kev: modo aprobación, videos por día (1 a 6), tope de gasto.
// ──────────────────────────────────────────────────────────────

import { z } from "zod"
import { REDES, type Entorno, type RedId } from "./tipos"

export type Quien = { rol: "kev" } | { rol: "vigilante" } | { rol: "equipo"; nombre: string }

const red = z.enum(REDES as [RedId, ...RedId[]])

const Pedido = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("pausar"), motivo: z.string().trim().min(3).max(300), red: red.optional() }),
  z.object({ accion: z.literal("reanudar"), red: red.optional() }),
  z.object({
    accion: z.literal("ajustar"),
    modo_aprobacion: z.boolean().optional(),
    videos_por_dia: z.number().int().min(1).max(6).optional(),
    tope_gasto_usd_dia: z.number().min(0).max(100).optional(),
  }),
])
export type PedidoEstado = z.infer<typeof Pedido>

export function validarPedidoEstado(cuerpo: unknown): { ok: true; pedido: PedidoEstado } | { ok: false; error: string } {
  const r = Pedido.safeParse(cuerpo)
  if (r.success) {
    const p = r.data
    if (p.accion === "ajustar" && p.modo_aprobacion === undefined && p.videos_por_dia === undefined && p.tope_gasto_usd_dia === undefined) {
      return { ok: false, error: "Nada que ajustar." }
    }
    return { ok: true, pedido: p }
  }
  const c = cuerpo as { accion?: unknown } | null
  if (!c || typeof c !== "object" || !["pausar", "reanudar", "ajustar"].includes(String(c.accion))) {
    return { ok: false, error: "Acción desconocida: va pausar, reanudar o ajustar." }
  }
  if (c.accion === "pausar") return { ok: false, error: "Para pausar hace falta un motivo (3 a 300 caracteres) y, si es una red, una conocida." }
  return { ok: false, error: `Pedido inválido: ${r.error.issues.map((i) => `${i.path.join(".") || "cuerpo"} ${i.message}`).join("; ")}` }
}

/** Los nombres del equipo que pueden pausar: FABRICA_PAUSA_EQUIPO="editor,filmmaker". */
export const equipoQuePausa = (env: Entorno) =>
  (env.FABRICA_PAUSA_EQUIPO ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

/** null = puede; si no, el motivo del 403. */
export function sinPermiso(q: Quien, p: PedidoEstado, env: Entorno): string | null {
  if (q.rol === "kev") return null
  if (p.accion !== "pausar") return "Reanudar y ajustar la fábrica es solo de Kev."
  if (q.rol === "vigilante") return null
  return equipoQuePausa(env).includes(q.nombre.toLowerCase()) ? null : "Tu clave no está en FABRICA_PAUSA_EQUIPO."
}

export const porQuien = (q: Quien) => (q.rol === "equipo" ? `equipo:${q.nombre}` : q.rol)
