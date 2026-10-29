// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · EL PARTE DIARIO Y EL VIGILANTE
//
// Desde las 23:00 de Bolivia el tick reclama el parte del día en la base
// (un ganador por día, nunca setInterval), lo arma, lo GUARDA y recién
// después lo manda. `enviado_en` se escribe solo si el canal confirmó. Si el
// parte no llega, el vigilante (el bot de Prime) lo nota leyendo
// GET /api/fabrica/vigilante: la ausencia del parte es la alarma.
//
// armarParte() y respuestaVigilante() son puras. hacerParte() recibe la base
// y el canal por parámetro.
// ──────────────────────────────────────────────────────────────

import type { BaseCola, BaseParte, FilaReporte, TokenConError } from "./base-cola"
import { tituloDe, type Entorno, type FilaEnvio, type FilaEstado, type FilaVideo, type RedId } from "./tipos"

export const RESERVA_MINIMA = 3
/** El parte se reintenta hasta 3 veces en el día, cada 9 min (el tick corre cada 10). */
export const INTENTOS_PARTE = 3
export const VENCE_PARTE_MIN = 9

export interface DatosParte {
  dia: string
  estado: FilaEstado
  /** Los videos con salida ese día (y sus envíos). */
  videos: FilaVideo[]
  envios: FilaEnvio[]
  reservaVerde: number
  tokens: TokenConError[]
  tanda: { reclamado: string; terminado: string | null; intentos: number } | null
}

export interface ResumenParte {
  dia: string
  producidos: Record<string, number>
  publicados: { red: RedId; titulo: string; enlace: string | null }[]
  fallidos: { titulo: string; red?: RedId; como: string }[]
  privados: { titulo: string; red: RedId; como: string }[]
  noHoy: { titulo: string; red: RedId; como: string }[]
  aprobaciones: { pendientes: number; vencidas: number }
  reserva: { verde: number; aviso: boolean }
  gasto: { usd: number; tope: number }
  pausas: { fabrica: string | null; redes: { red: string; motivo: string }[] }
  tokens: { red: string; error: string }[]
  tanda: { reclamada: string | null; terminada: string | null; intentos: number; detalle: unknown }
  ultimoTick: string | null
}

const n2 = (x: number) => x.toFixed(2).replace(".", ",")

/** El resumen y el texto del parte. Pura. */
export function armarParte(d: DatosParte): { resumen: ResumenParte; texto: string } {
  const delDia = d.videos.filter((v) => v.dia === d.dia && v.slot !== null)
  const titulo = new Map(d.videos.map((v) => [v.id, tituloDe(v) || v.id.slice(0, 8)]))
  const envios = d.envios.filter((e) => delDia.some((v) => v.id === e.video_id))

  const producidos: Record<string, number> = {}
  for (const v of delDia) producidos[v.estado] = (producidos[v.estado] ?? 0) + 1

  const t = (e: FilaEnvio) => titulo.get(e.video_id) ?? e.video_id
  const como = (e: FilaEnvio) => e.ultimo_error?.como ?? "sin detalle"
  const resumen: ResumenParte = {
    dia: d.dia,
    producidos,
    publicados: envios
      .filter((e) => e.estado === "publicado" || e.estado === "confirmado")
      .map((e) => ({ red: e.red, titulo: t(e), enlace: e.enlace })),
    fallidos: [
      ...envios.filter((e) => e.estado === "fallido" && e.visibilidad !== "privado").map((e) => ({ titulo: t(e), red: e.red, como: como(e) })),
      ...delDia
        .filter((v) => v.estado === "fallido" || v.estado === "rechazado")
        .map((v) => ({ titulo: titulo.get(v.id) ?? v.id, como: v.motivo_rechazo ?? v.estado })),
    ],
    privados: envios.filter((e) => e.visibilidad === "privado").map((e) => ({ titulo: t(e), red: e.red, como: como(e) })),
    noHoy: envios.filter((e) => e.estado === "no_hoy").map((e) => ({ titulo: t(e), red: e.red, como: como(e) })),
    aprobaciones: {
      pendientes: d.videos.filter((v) => v.estado === "aprobacion_pendiente" || (["calidad_ok", "subido_parcial"].includes(v.estado) && !v.aprobado_video_en && d.estado.modo_aprobacion)).length,
      vencidas: d.videos.filter((v) => v.estado === "rechazado" && /^sin (aprobación|OK)/.test(v.motivo_rechazo ?? "")).length,
    },
    reserva: { verde: d.reservaVerde, aviso: d.reservaVerde < RESERVA_MINIMA },
    gasto: { usd: Number(d.estado.gasto_usd_dia), tope: Number(d.estado.tope_gasto_usd_dia) },
    pausas: {
      fabrica: d.estado.pausada ? d.estado.motivo ?? "sin motivo" : null,
      redes: Object.entries(d.estado.redes ?? {})
        .filter(([, r]) => r?.pausada)
        .map(([red, r]) => ({ red, motivo: r?.motivo ?? "sin motivo" })),
    },
    tokens: d.tokens.map((x) => ({ red: x.red, error: x.ultimo_error ?? "" })),
    tanda: { reclamada: d.tanda?.reclamado ?? null, terminada: d.tanda?.terminado ?? null, intentos: d.tanda?.intentos ?? 0, detalle: d.estado.ultima_tanda ?? null },
    ultimoTick: d.estado.ultimo_tick_en,
  }

  const r = resumen
  const lineas: string[] = [`Fábrica de videos · parte del ${d.dia}`]
  if (r.pausas.fabrica) lineas.push(`PAUSADA: ${r.pausas.fabrica}`)
  // La última tanda que no terminó bien va arriba: una noche bloqueada no se puede ver igual que una buena.
  const ultima = r.tanda.detalle as { resultado?: unknown; motivo?: unknown } | null
  if (ultima && ["incompleta", "cortada", "error"].includes(String(ultima.resultado)))
    lineas.push(`TANDA ${String(ultima.resultado).toUpperCase()}: ${typeof ultima.motivo === "string" ? ultima.motivo : "sin motivo"}`)
  for (const p of r.pausas.redes) lineas.push(`Red pausada: ${p.red} (${p.motivo})`)
  const prod = Object.entries(r.producidos).map(([k, v]) => `${k} ${v}`).join(", ")
  lineas.push(`Videos del día: ${delDia.length}${prod ? ` (${prod})` : ""}`)
  lineas.push(`Publicados: ${r.publicados.length}`)
  for (const p of r.publicados) lineas.push(`  ${p.red} · ${p.titulo}${p.enlace ? ` · ${p.enlace}` : ""}`)
  if (r.fallidos.length) lineas.push(`Fallidos: ${r.fallidos.length}`)
  for (const f of r.fallidos) lineas.push(`  ${f.red ?? "video"} · ${f.titulo} · ${f.como}`)
  for (const f of r.privados) lineas.push(`Privado sin pedirlo: ${f.red} · ${f.titulo} · ${f.como}`)
  for (const f of r.noHoy) lineas.push(`Hoy no (tope de la red): ${f.red} · ${f.titulo} · ${f.como}`)
  if (r.aprobaciones.pendientes || r.aprobaciones.vencidas) {
    lineas.push(`Aprobaciones: ${r.aprobaciones.pendientes} pendientes, ${r.aprobaciones.vencidas} vencidas`)
  }
  lineas.push(`Reserva verde: ${r.reserva.verde}${r.reserva.aviso ? ` (AVISO: menos de ${RESERVA_MINIMA})` : ""}`)
  lineas.push(`Gasto: USD ${n2(r.gasto.usd)} de ${n2(r.gasto.tope)}`)
  for (const k of r.tokens) lineas.push(`Token de ${k.red} sin renovar: ${k.error}`)
  lineas.push(
    r.tanda.reclamada
      ? `Tanda: empezó ${r.tanda.reclamada}${r.tanda.terminada ? `, terminó ${r.tanda.terminada}` : ", NO terminó"}`
      : "Tanda: no corrió",
  )
  lineas.push(`Último tick: ${r.ultimoTick ?? "nunca"}`)
  return { resumen, texto: lineas.join("\n") }
}

// ── El canal ─────────────────────────────────────────────────

export type Canal = (cuerpo: { dia: string; texto: string; resumen: ResumenParte }) => Promise<{ ok: true } | { ok: false; como: string }>

/** POST a FABRICA_AVISO_URL (el bot de Prime o un correo, lo decide Kev). null = sin canal. */
export function canalHttp(env: Entorno, f: typeof fetch = fetch): Canal | null {
  const url = env.FABRICA_AVISO_URL?.trim()
  if (!url) return null
  const secreto = env.FABRICA_AVISO_SECRET?.trim()
  return async (cuerpo) => {
    try {
      const res = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secreto ? { Authorization: `Bearer ${secreto}` } : {}) },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) return { ok: true }
      const txt = await res.text().catch((e) => `(sin cuerpo: ${e instanceof Error ? e.message : e})`)
      return { ok: false, como: `HTTP ${res.status}: ${txt.slice(0, 300)}` }
    } catch (e) {
      return { ok: false, como: `no respondió: ${e instanceof Error ? e.message : String(e)}` }
    }
  }
}

// ── El ejecutor ──────────────────────────────────────────────

export interface PuertosParte {
  base: BaseParte & Pick<BaseCola, "reclamar" | "terminarCandado">
  canal: Canal | null
}

/** Reclama, arma, guarda y manda el parte del día. Devuelve qué pasó, en palabras. */
export async function hacerParte(p: PuertosParte): Promise<string> {
  const dia = await p.base.reclamar("parte", INTENTOS_PARTE, VENCE_PARTE_MIN)
  if (!dia) return "el parte de hoy ya salió, lo tiene otro tick o se acabaron sus intentos"

  const [{ videos, envios }, estado, reservaVerde, tokens, tanda] = await Promise.all([
    p.base.cargar([dia]),
    p.base.leerEstado(),
    p.base.reservaVerde(),
    p.base.tokensConError(),
    p.base.candado("tanda", dia),
  ])
  const { resumen, texto } = armarParte({ dia, estado, videos, envios, reservaVerde, tokens, tanda })

  // Guardar ANTES de mandar.
  await p.base.guardarParte(dia, resumen, texto, p.canal ? "aviso" : "ninguno")
  if (!p.canal) {
    await p.base.resultadoParte(dia, "sin canal: falta FABRICA_AVISO_URL")
    await p.base.terminarCandado("parte", dia)
    console.error("[fabrica/reporte] el parte se guardó pero no salió: falta FABRICA_AVISO_URL")
    return "guardado, sin canal para mandarlo (falta FABRICA_AVISO_URL)"
  }
  const r = await p.canal({ dia, texto, resumen })
  if (r.ok) {
    await p.base.resultadoParte(dia, null)
    await p.base.terminarCandado("parte", dia)
    return "parte enviado"
  }
  // Sin terminar el candado: el próximo tick (pasado el vencimiento) lo reintenta.
  await p.base.resultadoParte(dia, r.como)
  console.error(`[fabrica/reporte] el parte no salió: ${r.como}`)
  return `parte guardado, NO enviado: ${r.como}`
}

// ── El vigilante ─────────────────────────────────────────────

export interface RespuestaVigilante {
  ahora: string
  ultimo_tick_en: string | null
  ultima_tanda_en: string | null
  pausada: boolean
  motivo: string | null
  parte: { dia: string; generado_en: string; enviado_en: string | null } | null
  reserva_verde: number
}

/** Solo lectura, para el bot de Prime: si no contesta, el tick tiene más de 30 min o no hay parte enviado, avisa. */
export function respuestaVigilante(ahora: Date, estado: FilaEstado, parte: FilaReporte | null, reservaVerde: number): RespuestaVigilante {
  return {
    ahora: ahora.toISOString(),
    ultimo_tick_en: estado.ultimo_tick_en,
    ultima_tanda_en: estado.ultima_tanda_en,
    pausada: estado.pausada,
    motivo: estado.motivo,
    parte: parte ? { dia: parte.dia, generado_en: parte.generado_en, enviado_en: parte.enviado_en } : null,
    reserva_verde: reservaVerde,
  }
}

