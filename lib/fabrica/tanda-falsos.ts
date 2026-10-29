// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LOS PUERTOS DE MENTIRA DE LA TANDA
//
// Para correr la tanda entera sin red, sin base y sin GPU: el test
// (tanda.test.ts) y `npx tsx scripts/fabrica/tanda.ts --seco`.
//   - baseTandaEnMemoria: imita las funciones SQL de la parte 11 con las
//     mismas condiciones (reservar = estado + sin dueño vigente + intentos +
//     no pausada, en un solo paso; terminar = solo el dueño).
//   - iaDeMentira: un guion distinto por pedido, con los protagonistas de la
//     idea, que pasa las guardas; la segunda pasada dice que está bien.
//   - renderDeMentira, calidadDeMentira, almacenDeMentira, discoEnMemoria y
//     subidasDeMentira (YouTube y X).
// Nada de esto se usa en una tanda de verdad.
// ──────────────────────────────────────────────────────────────

import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import type { ResultadoCalidad } from "./calidad"
import { duracionDelVideo } from "./guardas"
import type { PedirIA } from "./guionista"
import type { IdeaPasada, PuertoIdeas } from "./ideas"
import type { BaseTanda, Disco, FilaVideoTanda, Renderizar, ResumenTanda, RevisarCalidad } from "./tanda"
import { diaBolivia, type Adaptador, type Almacen, type Ctx, type EstadoEnvio, type EstadoVideo, type FilaEnvio, type FilaEstado, type RedId } from "./tipos"

// ── La base ───────────────────────────────────────────────────

export type VideoEnMemoria = FilaVideoTanda & { trabajo: string | null; calidad: unknown; errores: unknown[]; avisos: string[] }

export interface MemoriaTanda {
  ahora: Date
  estado: FilaEstado
  videos: VideoEnMemoria[]
  envios: FilaEnvio[]
  candados: Map<string, { intentos: number; reclamado: number; terminado: number | null }>
  resumen: ResumenTanda | null
  /** Lo que se llamó, en orden. */
  llamadas: string[]
}

export function estadoAbierto(extra: Partial<FilaEstado> = {}): FilaEstado {
  return {
    pausada: false,
    motivo: null,
    pausada_por: null,
    pausada_en: null,
    modo_aprobacion: true,
    videos_por_dia: 3,
    tope_gasto_usd_dia: 5,
    dia: null,
    gasto_usd_dia: 0,
    publicados_dia: 0,
    fallidos_dia: 0,
    redes: {},
    ultimo_tick_en: null,
    ultima_tanda_en: null,
    ultima_tanda: null,
    ...extra,
  }
}

export const memoriaNueva = (ahora: Date, estado: FilaEstado = estadoAbierto()): MemoriaTanda => ({
  ahora,
  estado,
  videos: [],
  envios: [],
  candados: new Map(),
  resumen: null,
  llamadas: [],
})

const iso = (d: Date) => d.toISOString()
const t = (s: string | null | undefined) => (s ? Date.parse(s) : NaN)
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const TERMINALES: readonly EstadoVideo[] = ["publicado", "fallido", "rechazado"]

/** Los campos de fabrica_terminar_video que se copian tal cual. */
const CAMPOS_VIDEO = ["pilar", "personajes", "semaforo", "idea", "episodio", "guion_hash", "textos", "avisos", "archivo", "archivo_bytes", "duracion_s", "calidad", "motivo_rechazo", "es_reserva"] as const
const CAMPOS_ENVIO = ["id_red", "enlace", "contenedor", "media_id", "media_expira_en", "publish_at", "proximo_intento", "visibilidad", "intentos"] as const

export function baseTandaEnMemoria(m: MemoriaTanda): BaseTanda {
  const now = () => m.ahora.getTime()
  const libre = (x: { dueno: string | null; vence_en: string | null }) => !x.dueno || t(x.vence_en) < now()
  let n = 0
  const anotar = (s: string) => m.llamadas.push(s)

  return {
    async vencidosAAmbiguo() {
      anotar("vencidosAAmbiguo")
      let k = 0
      for (const e of m.envios) {
        if ((e.estado === "subiendo" || e.estado === "publicando") && t(e.vence_en) < now()) {
          Object.assign(e, { ambiguo_desde: e.estado, estado: "ambiguo", dueno: null, vence_en: null })
          k++
        }
      }
      return k
    },
    async leerEstado() {
      return copia(m.estado)
    },
    async reclamar(que, intentos, venceMin) {
      anotar(`reclamar:${que}`)
      const dia = diaBolivia(m.ahora)
      const clave = `${que}|${dia}`
      const c = m.candados.get(clave)
      if (!c) {
        m.candados.set(clave, { intentos: 1, reclamado: now(), terminado: null })
        return dia
      }
      if (c.terminado === null && c.intentos < intentos && c.reclamado < now() - venceMin * 60_000) {
        c.intentos++
        c.reclamado = now()
        return dia
      }
      return null
    },
    async terminarCandado(que, dia) {
      const c = m.candados.get(`${que}|${dia}`)
      if (!c || c.terminado !== null) return false
      c.terminado = now()
      return true
    },
    async sumarGasto(usd) {
      anotar(`gasto:${usd}`)
      const hoy = diaBolivia(m.ahora)
      if (m.estado.dia !== hoy) Object.assign(m.estado, { dia: hoy, gasto_usd_dia: 0, publicados_dia: 0, fallidos_dia: 0 })
      const nuevo = m.estado.gasto_usd_dia + usd
      if (nuevo > m.estado.tope_gasto_usd_dia) {
        if (!m.estado.pausada) Object.assign(m.estado, { pausada: true, motivo: "tope de gasto", pausada_por: "fabrica", pausada_en: iso(m.ahora) })
        return { ok: false, gasto: m.estado.gasto_usd_dia, tope: m.estado.tope_gasto_usd_dia, motivo: "tope de gasto" }
      }
      m.estado.gasto_usd_dia = nuevo
      return { ok: true, gasto: nuevo, tope: m.estado.tope_gasto_usd_dia }
    },
    async videosDe(dias) {
      return copia(m.videos.filter((v) => dias.includes(v.dia)))
    },
    async reservasVivas() {
      return copia(m.videos.filter((v) => v.es_reserva && v.slot === null && !TERMINALES.includes(v.estado)))
    },
    async guionesRecientes(k) {
      // Como la base: los k más nuevos y, además, toda reserva viva con guion.
      const conGuion = m.videos.filter((v) => v.episodio)
      const recientes = [...conGuion].sort((a, b) => t(b.creado) - t(a.creado)).slice(0, k)
      const reservas = conGuion.filter((v) => v.es_reserva && v.slot === null && !["publicado", "fallido", "rechazado"].includes(v.estado))
      return copia([...new Set([...recientes, ...reservas])].map((v) => v.episodio as Episodio))
    },
    async insertarVideo(f) {
      if (f.slot !== null && m.videos.some((v) => v.dia === f.dia && v.slot === f.slot)) {
        return { ok: false, ocupado: true, como: `duplicate key value violates unique constraint "fabrica_videos_slot_uq" (${f.dia}, ${f.slot})` }
      }
      const id = `v${String(++n).padStart(3, "0")}-${f.dia}`
      // creado avanza 1 ms por fila: el orden de "más nuevo primero" no depende de la suerte.
      const creado = iso(new Date(now() + n))
      m.videos.push({
        id,
        creado,
        actualizado: creado,
        dia: f.dia,
        slot: f.slot,
        hora_salida: f.hora_salida,
        es_reserva: f.es_reserva,
        estado: "idea",
        pilar: f.pilar,
        personajes: [...f.personajes],
        semaforo: null,
        idea: copia(f.idea),
        episodio: null,
        textos: null,
        archivo: null,
        duracion_s: null,
        aprobado_video_en: null,
        motivo_rechazo: null,
        dueno: null,
        vence_en: null,
        intentos: 0,
        trabajo: null,
        calidad: null,
        errores: [],
        avisos: [],
      })
      anotar(`insertar:${id}`)
      return { ok: true, id }
    },
    async reservarVideo(id, desde, trabajo, dueno, venceMin, maxIntentos) {
      const v = m.videos.find((x) => x.id === id)
      if (!v || !desde.includes(v.estado) || !libre(v) || v.intentos >= maxIntentos || m.estado.pausada) return null
      Object.assign(v, { dueno, trabajo, vence_en: iso(new Date(now() + venceMin * 60_000)), intentos: v.intentos + 1, actualizado: iso(m.ahora) })
      anotar(`reservar:${id}:${trabajo}`)
      return copia(v)
    },
    async terminarVideo(id, dueno, hasta, campos = {}) {
      const v = m.videos.find((x) => x.id === id)
      if (!v || v.dueno !== dueno) return false
      const seguir = campos.mantener_dueno === true
      const intentos = "intentos" in campos ? Number(campos.intentos) : hasta !== v.estado ? 0 : v.intentos
      for (const k of CAMPOS_VIDEO) if (k in campos) (v as Record<string, unknown>)[k] = copia(campos[k])
      if ("error" in campos) v.errores = [...v.errores, { cuando: iso(m.ahora), ...(campos.error as object) }].slice(-20)
      Object.assign(v, {
        estado: hasta,
        intentos,
        actualizado: iso(m.ahora),
        dueno: seguir ? v.dueno : null,
        trabajo: seguir ? v.trabajo : null,
        vence_en: seguir ? v.vence_en : null,
      })
      anotar(`terminar:${id}:${hasta}`)
      return true
    },
    async crearEnvios(videoId, redes) {
      for (const red of redes) {
        if (m.envios.some((e) => e.video_id === videoId && e.red === red)) continue
        m.envios.push({
          id: `e-${videoId}-${red}`,
          video_id: videoId,
          red,
          estado: "pendiente",
          id_red: null,
          enlace: null,
          contenedor: null,
          media_id: null,
          media_expira_en: null,
          publish_at: null,
          publicado_en: null,
          dueno: null,
          reservado_en: null,
          enviado_en: null,
          ambiguo_desde: null,
          vence_en: null,
          intentos: 0,
          proximo_intento: null,
          visibilidad: null,
          verificado_en: null,
          ultimo_error: null,
        })
      }
      anotar(`envios:${videoId}`)
    },
    async enviosDe(videoId) {
      return copia(m.envios.filter((e) => e.video_id === videoId))
    },
    async reservarEnvio(id, desde, enCurso, dueno, venceMin, maxIntentos) {
      const e = m.envios.find((x) => x.id === id)
      if (!e || !desde.includes(e.estado) || !libre(e) || e.intentos >= maxIntentos) return null
      if (e.proximo_intento && t(e.proximo_intento) > now()) return null
      if (m.estado.pausada || m.estado.redes[e.red]?.pausada) return null
      if (enCurso === "publicando" && m.videos.find((v) => v.id === e.video_id)?.estado !== "programado") return null
      Object.assign(e, {
        estado: enCurso,
        dueno,
        reservado_en: iso(m.ahora),
        enviado_en: enCurso === "publicando" || enCurso === "subiendo" ? iso(m.ahora) : e.enviado_en,
        vence_en: iso(new Date(now() + venceMin * 60_000)),
        intentos: e.intentos + 1,
      })
      anotar(`reservarEnvio:${id}:${enCurso}`)
      return copia(e)
    },
    async terminarEnvio(id, dueno, hasta: EstadoEnvio, campos = {}) {
      const e = m.envios.find((x) => x.id === id)
      if (!e || e.dueno !== dueno) return false
      for (const k of CAMPOS_ENVIO) if (k in campos) (e as unknown as Record<string, unknown>)[k] = campos[k]
      if ("error" in campos) e.ultimo_error = { cuando: iso(m.ahora), ...(campos.error as object) } as FilaEnvio["ultimo_error"]
      e.ambiguo_desde = hasta !== "ambiguo" ? null : e.estado !== "ambiguo" ? e.estado : e.ambiguo_desde
      Object.assign(e, { estado: hasta, dueno: null, vence_en: null })
      anotar(`terminarEnvio:${id}:${hasta}`)
      return true
    },
    async guardarResumen(r) {
      m.resumen = copia(r)
      m.estado.ultima_tanda_en = iso(m.ahora)
      m.estado.ultima_tanda = copia(r)
    },
  }
}

/** Las fuentes de las ideas desde la memoria: sin recuerdos ni conciencias (salen de ESPECIALES), con el historial de la base. */
export function ideasEnMemoria(m: MemoriaTanda, extra: Partial<{ recuerdos: Awaited<ReturnType<PuertoIdeas["recuerdosDesde"]>> }> = {}): PuertoIdeas {
  return {
    recuerdosDesde: async () => extra.recuerdos ?? [],
    conciencias: async () => [],
    historialDesde: async (desde) =>
      m.videos.filter((v) => v.dia >= desde).map((v): IdeaPasada => ({ dia: v.dia, personajes: v.personajes, tema: v.idea?.tema ?? null })),
  }
}

// ── La IA ─────────────────────────────────────────────────────

const PJ = new Map(PERSONAJES.map((p) => [p.id, p]))
const nombre = (id: string) => PJ.get(id)?.corto ?? id

/** Ocho escenas con palabras distintas: dos guiones de la misma tanda no se parecen (similitud < 0,6). */
const ESCENAS: ReadonlyArray<{ lugar: string; nombreLugar: string; titulo: (a: string, b: string) => string; lineas: [string, string, string, string, string, string] }> = [
  { lugar: "rosas", nombreLugar: "Jardín de las Rosas", titulo: (a) => `${a} pierde la paciencia`, lineas: ["Llevo una hora esperando.", "Las rosas no se apuran por nadie.", "Mi tiempo vale oro.", "Siéntate y huele algo.", "Nadie entiende la urgencia aquí.", "¿Esperarías tú una hora?"] },
  { lugar: "piscina", nombreLugar: "Piscina", titulo: (a, b) => `${b} reta a ${a} a nadar`, lineas: ["El agua está helada.", "Tres largos y te invito la cena.", "Acepto, pero sin trampas.", "Yo nunca hago trampas.", "Eso dijiste la semana pasada.", "¿Quién crees que llegó primero?"] },
  { lugar: "golf", nombreLugar: "Green de golf", titulo: (a) => `${a} contra el green`, lineas: ["Este palo está torcido.", "El palo está perfecto.", "Entonces el viento sopla mal.", "No hay viento esta noche.", "Mañana lo intento con luz.", "¿Le darías otra oportunidad?"] },
  { lugar: "biblioteca", nombreLugar: "Biblioteca", titulo: (a, b) => `${b} esconde un libro`, lineas: ["¿Quién movió mi libro favorito?", "Yo no toqué nada.", "Tus huellas dicen otra cosa.", "Lo estaba cuidando.", "Devuélvelo antes de medianoche.", "¿Tú lo devolverías?"] },
  { lugar: "jardin-sur", nombreLugar: "Jardín Sur", titulo: (a) => `${a} planea una fiesta`, lineas: ["Habrá música hasta el amanecer.", "Los vecinos van a protestar.", "Que protesten con estilo.", "Necesitamos sillas y faroles.", "Consigue cincuenta faroles.", "¿Vendrías a esa fiesta?"] },
  { lugar: "rosas", nombreLugar: "Jardín de las Rosas", titulo: (a, b) => `${a} y ${b} cambian de oficio`, lineas: ["Hoy cocino yo.", "Entonces yo barro el patio.", "Nunca te vi con una escoba.", "Siempre hay una primera vez.", "Si quemo la sopa, no digas nada.", "¿Qué oficio cambiarías tú?"] },
  { lugar: "piscina", nombreLugar: "Piscina", titulo: (a) => `El secreto de ${a}`, lineas: ["Tengo algo que contarte.", "Te escucho, pero rápido.", "Aprendí a silbar ayer.", "¿Eso era el gran secreto?", "Para mí fue una hazaña.", "¿Cuál fue tu última hazaña?"] },
  { lugar: "golf", nombreLugar: "Green de golf", titulo: (a, b) => `${b} le enseña a dibujar a ${a}`, lineas: ["Sostén el lápiz más suave.", "Así parece una cuchara.", "Las cucharas también son arte.", "Dibuja la luna primero.", "Me salió un queso redondo.", "¿Qué dibujarías esta noche?"] },
]

/** Una salida del guionista armada a mano para los protagonistas de un pedido. Pasa las guardas: 62 s de planos. */
export function salidaDeMentira(a: string, b: string, k: number) {
  const e = ESCENAS[k % ESCENAS.length]
  const ronda = Math.floor(k / ESCENAS.length)
  const titulo = `${e.titulo(nombre(a), nombre(b))}${ronda ? ` ${ronda + 1}` : ""}`.slice(0, 48)
  const l = e.lineas
  return {
    episodio: {
      titulo,
      formato: "16:9" as const,
      visor: "camara" as const,
      planos: [
        { dur: 10, camara: { tipo: "lugar" as const, lugar: e.lugar }, hora: "21:40", titulo, rotulo: `${e.nombreLugar} · 21:40` },
        { dur: 14, camara: { tipo: "seguir" as const, personaje: a }, reunir: [a, b], dialogo: [{ quien: a, texto: l[0] }, { quien: b, texto: l[1] }] },
        { dur: 14, camara: { tipo: "seguir" as const, personaje: b }, dialogo: [{ quien: a, texto: l[2] }, { quien: b, texto: l[3] }] },
        { dur: 12, camara: { tipo: "seguir" as const, personaje: a }, dialogo: [{ quien: a, texto: l[4] }] },
        { dur: 12, camara: { tipo: "lugar" as const, lugar: e.lugar }, titulo: l[5] },
      ],
    },
    descripcion: `${nombre(a)} y ${nombre(b)}, una noche en la casa.`,
    miniatura: "Una noche",
  }
}

/**
 * La IA de mentira: el guion se arma con los protagonistas que pide el
 * prompt («Protagonistas: a y b»), una escena distinta por pedido; la
 * revisión dice que está bien. `pedidos` anota lo que se pidió.
 */
export function iaDeMentira(): { pedir: PedirIA; pedidos: Array<{ paso: string; usuario: string }> } {
  const pedidos: Array<{ paso: string; usuario: string }> = []
  let k = 0
  const pedir: PedirIA = async (p) => {
    pedidos.push({ paso: p.paso, usuario: p.usuario })
    if (p.paso !== "guion") return { ok: true, texto: JSON.stringify({ ok: true, problemas: [] }), fin: "end_turn" }
    const m = /Protagonistas: ([a-z]+) y ([a-z]+)/.exec(p.usuario)
    if (!m) return { ok: true, texto: "sin protagonistas en el pedido", fin: "end_turn" }
    return { ok: true, texto: JSON.stringify(salidaDeMentira(m[1], m[2], k++)), fin: "end_turn" }
  }
  return { pedir, pedidos }
}

// ── Render, calidad, almacén, disco y redes ───────────────────

export function discoEnMemoria(raiz = "/seco"): Disco & { archivos: Map<string, Uint8Array> } {
  const archivos = new Map<string, Uint8Array>()
  return {
    archivos,
    carpetaDe: (id) => `${raiz}/${id}`,
    async escribir(ruta, datos) {
      archivos.set(ruta, typeof datos === "string" ? new TextEncoder().encode(datos) : datos)
    },
    async leer(ruta) {
      const d = archivos.get(ruta)
      if (!d) throw new Error(`ENOENT: no existe ${ruta}`)
      return d
    },
    async existe(ruta) {
      return archivos.has(ruta)
    },
  }
}

/** Un "MP4" de mentira (bytes fijos) escrito donde el render dejaría el video. */
export function renderDeMentira(disco: Disco, pedidos: Array<{ videoId: string; archivoVoz: string | null }> = []): Renderizar {
  return async (p) => {
    pedidos.push({ videoId: p.videoId, archivoVoz: p.archivoVoz })
    const bytes = new Uint8Array(4096).map((_, i) => (i * 31 + p.videoId.length) % 251)
    await disco.escribir(p.salida, bytes)
    return { ok: true, archivo: p.salida, renderer: "seco (sin GPU)", como: "render de mentira (seco): no se dibujó nada" }
  }
}

/**
 * La calidad de mentira: aprueba con la duración que el guion dice y el peso
 * del archivo, y una pista de audio "medida" (con `audio: "sin_pista"`, el
 * MP4 sale mudo, como el render de hoy con -an).
 */
export function calidadDeMentira(
  disco: Disco,
  rechazar: (id: string) => string | null = () => null,
  audio: "medido" | "sin_pista" = "medido",
): RevisarCalidad {
  return async (archivo, ep) => {
    const bytes = (await disco.leer(archivo)).byteLength
    const d = duracionDelVideo(ep)
    const motivo = rechazar(ep.id)
    const r: ResultadoCalidad = {
      ok: !motivo,
      veredicto: motivo ? "rechazado" : "calidad_ok",
      motivos: motivo ? [motivo] : [],
      avisos: ["calidad de mentira (seco): no se midió con ffmpeg"],
      esperado: { ancho: 1920, alto: 1080, fps: 30, duracionS: d, conDialogo: true },
      medido: {
        ancho: 1920,
        alto: 1080,
        fps: 30,
        codec: "h264",
        pixFmt: "yuv420p",
        duracionS: d,
        bytes,
        limiteBytes: 50 * 1024 * 1024,
        audio: audio === "sin_pista" ? { sinPista: true } : { maxDb: -3, mediaDb: -20, muestras: Math.round(d * 48_000), en0db: 0, codec: "aac", duracionS: d },
        negros: [],
        congelados: [],
        etiqueta: null,
        renderer: "seco (sin GPU)",
      },
    }
    return r
  }
}

export function almacenDeMentira(): Almacen & { archivos: Map<string, number> } {
  const archivos = new Map<string, number>()
  return {
    archivos,
    async subir(ruta, datos) {
      archivos.set(ruta, datos.byteLength)
    },
    async urlFirmada(ruta) {
      if (!archivos.has(ruta)) throw new Error(`${ruta} no está en el almacén de mentira`)
      return `https://almacen.seco.invalid/${ruta}?firma=seco`
    },
    async borrar(ruta) {
      archivos.delete(ruta)
    },
  }
}

/** YouTube y X de mentira: subir() devuelve un id; lo demás no se usa en la tanda. */
export function subidasDeMentira(ahora: () => Date, fallos: Partial<Record<RedId, Parameters<typeof falloDe>[0]>> = {}): Partial<Record<RedId, Adaptador>> {
  const una = (red: RedId): Adaptador => ({
    red,
    async subir(v) {
      const f = fallos[red]
      if (f) return falloDe(f, red)
      return red === "x"
        ? { ok: true, mediaId: `media-${v.videoId}`, expira: new Date(ahora().getTime() + 24 * 3600_000).toISOString() }
        : { ok: true, idRed: `yt-${v.videoId}` }
    },
    async publicar() {
      return { ok: false, clase: "fatal", como: `${red} de mentira: la tanda no publica` }
    },
    async estado() {
      return { visibilidad: "desconocida", como: "de mentira" }
    },
    async recientes() {
      return []
    },
    clasificar: () => "fatal",
  })
  return { youtube: una("youtube"), x: una("x") }
}

function falloDe(clase: "reintentable" | "no_hoy" | "fatal" | "ambiguo", red: RedId) {
  return { ok: false as const, clase, como: `${red}.subir de mentira: ${clase}` }
}

/** Un Ctx sin red: cualquier fetch falla con el cómo. */
export function ctxSinRed(ahora: () => Date, almacen: Almacen | null, log: (m: string) => void): Ctx {
  return {
    fetch: (async (url: unknown) => {
      throw new Error(`sin red en seco: se intentó ${String(url)}`)
    }) as typeof fetch,
    env: {},
    ahora,
    token: async () => null,
    almacen,
    log,
  }
}
