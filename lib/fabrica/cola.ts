// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LA COLA (el tick de cada 10 minutos)
//
// Dos mitades:
//   planDelTick()  PURA: con el estado, los videos, los envíos y la hora de
//                  la base decide qué hacer, en orden. Se prueba sin red.
//   ejecutarTick() hace el plan con los puertos que recibe (base, redes,
//                  reloj). Cada envío se RESERVA en la base antes de tocar la
//                  red, y antes de cada paso se vuelve a leer el interruptor.
//
// Orden de un tick (ESPECIFICACION.md, sección 3): latido → vencidos a
// ambiguo → si está pausada, solo desprogramar YouTube y salir → aprobaciones
// vencidas y huecos de las próximas 3 h → ambiguos (mirar recientes() antes
// de repetir) → contenedores de Instagram → publicar lo que toca, de a uno →
// publishAt de YouTube → verificar visibilidad → cerrar videos → parte desde
// las 23:00 → borrar del almacén lo que todas las redes cerraron.
// ──────────────────────────────────────────────────────────────

import type { BaseCola, CamposEnvio, CamposVideo } from "./base-cola"
import { textoValido } from "./guardas"
import {
  COSTO_USD,
  MAX_INTENTOS,
  REDES,
  TERMINALES_ENVIO,
  diaBolivia,
  esperaTras,
  estadoBase,
  flag,
  horaBolivia,
  horariosDelDia,
  instanteBolivia,
  mananaBolivia,
  redesEncendidas,
  sumarDias,
  tituloDe,
  type Adaptador,
  type Ctx,
  type Entorno,
  type ErrorGuardado,
  type EstadoEnvio,
  type EstadoVideo,
  type Fallo,
  type FilaEnvio,
  type FilaEstado,
  type FilaVideo,
  type Log,
  type Reciente,
  type RedId,
  type VideoParaRed,
  type Visibilidad,
} from "./tipos"

// ── Constantes del tick ──────────────────────────────────────

/** Cuánto antes de la salida se mira si el lugar va a llegar. */
export const HORIZONTE_HUECOS_MIN = 180
/**
 * YouTube recibe publishAt solo para los próximos 40 min: lo que YouTube ya
 * tiene programado sale aunque la base esté pausada, así que cuanto menos
 * quede expuesto, mejor. Además la ruta de pausa lo baja en el momento
 * (bajarYouTube), sin esperar al tick. 40 min = cuatro ticks para programarlo.
 */
export const HORIZONTE_YOUTUBE_MIN = 40
/** Lo que no salió hasta 3 h después de su hora ya no sale (no se publica tarde de golpe al reanudar). */
export const VENTANA_SALIDA_MIN = 180
/** Se mira la visibilidad 15 min después de publicar, y hasta 24 h. */
export const VERIFICAR_DESDE_MIN = 15
export const VERIFICAR_HASTA_H = 24
/** Una reserva de envío vence a los 3 min: un tick dura como mucho 60 s. */
export const VENCE_ENVIO_MIN = 3
/** Desde aquí se reclama el parte del día. */
export const HORA_PARTE = "23:00"
/** Un envío ambiguo se busca en la red desde 30 min antes de su reserva. */
export const MARGEN_RECIENTES_MIN = 30
/** La media de X tiene que vivir al menos hasta 30 min después de la salida. */
export const MARGEN_MEDIA_X_MIN = 30
/**
 * Un ambiguo se mira recién 8 min después de que se MANDÓ: un post recién
 * mandado tarda en aparecer en la lista, y "no está" no puede significar
 * "todavía no se ve".
 */
export const ESPERA_AMBIGUO_MIN = 8
/**
 * Las redes asíncronas esperan más: Facebook /videos con file_url (Meta baja
 * el archivo y lo procesa por su cuenta) y TikTok por Upload-Post
 * (async_upload) pueden no listar todavía un post que sí va a salir. SIN
 * VERIFICAR con una publicación real: probarlo antes de encender
 * FABRICA_FACEBOOK_ACTIVA o FABRICA_TIKTOK_ACTIVA.
 */
export const ESPERA_AMBIGUO_RED_MIN: Readonly<Record<RedId, number>> = {
  youtube: ESPERA_AMBIGUO_MIN,
  instagram: ESPERA_AMBIGUO_MIN,
  x: ESPERA_AMBIGUO_MIN,
  facebook: 30,
  tiktok: 30,
}

/** Cuándo se mandó lo que quedó en duda (enviado_en; si es una fila vieja, su reserva). */
export const enviadoEn = (e: Pick<FilaEnvio, "enviado_en" | "reservado_en">) => ms(e.enviado_en ?? e.reservado_en)

/** De dónde vino el ambiguo. Una fila de antes de la columna lo tenía en ultimo_error.paso. */
export const origenAmbiguo = (e: Pick<FilaEnvio, "ambiguo_desde" | "ultimo_error">): "subiendo" | "publicando" =>
  (e.ambiguo_desde ?? e.ultimo_error?.paso) === "subiendo" ? "subiendo" : "publicando"

const min = (n: number) => n * 60_000
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)

// ── El plan ──────────────────────────────────────────────────

export type Accion =
  | { tipo: "desprogramar"; envio: string; video: string; red: RedId }
  | { tipo: "cubrir_hueco"; dia: string; slot: number; hora: string }
  | { tipo: "resolver_ambiguo"; envio: string; video: string; red: RedId }
  | { tipo: "cerrar_ambiguo"; envio: string; red: RedId; como: string }
  | { tipo: "retomar"; envio: string; video: string; red: RedId }
  | { tipo: "omitir"; envio: string; red: RedId; desde: EstadoEnvio; como: string }
  | { tipo: "publicar"; envio: string; video: string; red: RedId; desde: EstadoEnvio }
  | { tipo: "programar"; envio: string; video: string; red: "youtube"; publishAt: string; desde: EstadoEnvio }
  | { tipo: "marcar_publicado"; envio: string; red: RedId }
  | { tipo: "verificar"; envio: string; video: string; red: RedId }
  | { tipo: "avanzar_video"; video: string; desde: EstadoVideo; hasta: EstadoVideo; motivo?: string }
  | { tipo: "parte" }
  | { tipo: "limpiar_almacen"; video: string; archivo: string; estado: "publicado" | "fallido" | "rechazado" }

export interface EntradaPlan {
  estado: FilaEstado
  videos: FilaVideo[]
  envios: FilaEnvio[]
  /** La hora de la base (latido), nunca la de Vercel. */
  ahora: Date
  /** FABRICA_ACTIVA. Apagada = como pausada. */
  fabricaActiva: boolean
  /** Redes encendidas por entorno y con adaptador. */
  activas: readonly RedId[]
}

const redPausada = (e: FilaEstado, red: RedId) => e.redes?.[red]?.pausada === true

/**
 * La hora a la que YouTube sacaría un envío `programado`: su publish_at, o la
 * salida del video si la reserva de programar se cortó antes de guardarlo (la
 * cola reserva en `programado` ANTES de llamar a YouTube: ante la duda, se
 * trata como programado y el interruptor lo baja).
 */
const salidaYouTube = (e: FilaEnvio, v: FilaVideo | undefined) => (e.publish_at ? ms(e.publish_at) : ms(v?.hora_salida))

/** ¿Este envío ya no va a cambiar? Un publicado sin verificar a las 24 h cuenta como cerrado. */
/** Envíos que pueden estar leyendo el archivo del almacén ahora mismo (una subida o un contenedor que se procesa). */
const LEYENDO_EL_ARCHIVO: readonly EstadoEnvio[] = ["subiendo", "publicando", "procesando"]

export function envioCerrado(e: FilaEnvio, ahora: Date): boolean {
  if ((TERMINALES_ENVIO as readonly string[]).includes(e.estado)) return true
  return e.estado === "publicado" && ahora.getTime() - ms(e.publicado_en) > VERIFICAR_HASTA_H * 3600_000
}

/** ¿El envío está listo para salir a la hora? YouTube y X necesitan lo suyo subido por la VM. */
const envioListo = (e: FilaEnvio) =>
  e.red === "youtube" || e.red === "x" ? e.estado === "subido" || e.estado === "programado" : e.estado === "pendiente"

/** Los lugares de hoy y mañana que salen en las próximas 3 h y no tienen un video que vaya a llegar. */
export function huecosDelTick(estado: FilaEstado, videos: FilaVideo[], ahora: Date) {
  const hoy = diaBolivia(ahora)
  const huecos: { dia: string; slot: number; hora: string }[] = []
  for (const dia of [hoy, sumarDias(hoy, 1)]) {
    horariosDelDia(estado.videos_por_dia, dia).forEach((h, i) => {
      const t = instanteBolivia(dia, h)
      const falta = t.getTime() - ahora.getTime()
      if (falta < 0 || falta > min(HORIZONTE_HUECOS_MIN)) return
      const v = videos.find((x) => x.dia === dia && x.slot === i + 1)
      // Llega si ya está subido (la aprobación se vence aparte, a 30 min) o más adelante.
      const llega = v && ["subido_parcial", "programado", "publicado"].includes(v.estado)
      if (!llega) huecos.push({ dia, slot: i + 1, hora: t.toISOString() })
    })
  }
  return huecos
}

/** subido_parcial → programado: aprobado (si hay modo aprobación), nada subiendo, y todo listo; desde 30 min antes, alcanza con uno listo. */
export function listoParaProgramar(v: FilaVideo, envios: FilaEnvio[], estado: FilaEstado, activas: readonly RedId[], ahora: Date): boolean {
  if (v.estado !== "subido_parcial" || v.slot === null || !v.hora_salida) return false
  if (estado.modo_aprobacion && !v.aprobado_video_en) return false
  if (envios.some((e) => e.estado === "subiendo" || e.estado === "ambiguo")) return false
  const vivos = envios.filter((e) => !(TERMINALES_ENVIO as readonly string[]).includes(e.estado))
  if (!vivos.length) return false
  const deActivas = vivos.filter((e) => activas.includes(e.red))
  if (deActivas.length && deActivas.every(envioListo)) return true
  return ahora.getTime() >= ms(v.hora_salida) - min(MARGEN_MEDIA_X_MIN) && vivos.some(envioListo)
}

/**
 * Paso 1 del tick (y lo que corre la ruta de pausa en el momento): YouTube
 * con publishAt por delante se baja a privado si la fábrica o la red se
 * pararon, o si el video se rechazó después de programarse. Pura.
 */
export function bajadasDeYouTube(p: EntradaPlan): Accion[] {
  const { estado, videos, envios, ahora, activas } = p
  const t = ahora.getTime()
  const video = new Map(videos.map((v) => [v.id, v]))
  const parada = estado.pausada || !p.fabricaActiva
  const puede = activas.includes("youtube") && !redPausada(estado, "youtube")
  const acciones: Accion[] = []
  for (const e of envios) {
    const v = video.get(e.video_id)
    if (e.red !== "youtube" || e.estado !== "programado" || !(salidaYouTube(e, v) > t)) continue
    const muerto = !v || v.estado === "rechazado" || v.estado === "fallido"
    if (parada || !puede || muerto) acciones.push({ tipo: "desprogramar", envio: e.id, video: e.video_id, red: "youtube" })
  }
  return acciones
}

/**
 * Qué hacer en este tick, en orden. Pura.
 * Pausada (o FABRICA_ACTIVA apagada) → solo desprogramar YouTube.
 */
export function planDelTick(p: EntradaPlan): Accion[] {
  const { estado, videos, envios, ahora, activas } = p
  const t = ahora.getTime()
  const porVideo = new Map<string, FilaEnvio[]>()
  for (const e of envios) porVideo.set(e.video_id, [...(porVideo.get(e.video_id) ?? []), e])
  const video = new Map(videos.map((v) => [v.id, v]))
  const parada = estado.pausada || !p.fabricaActiva
  const puede = (red: RedId) => activas.includes(red) && !redPausada(estado, red)

  // 1. YouTube con publishAt por delante, si hay que bajarlo.
  const acciones: Accion[] = bajadasDeYouTube(p)
  // Pausada: nada más que el parte. El parte sale igual (dice que está
  // pausada): si no saliera, el vigilante no podría distinguir una pausa de
  // un tick muerto.
  if (parada) {
    if (horaBolivia(ahora) >= HORA_PARTE) acciones.push({ tipo: "parte" })
    return acciones
  }

  // 2. Huecos de las próximas 3 h: los cubre la reserva verde.
  for (const h of huecosDelTick(estado, videos, ahora)) acciones.push({ tipo: "cubrir_hueco", ...h })

  const ordenados = [...envios].sort(
    (a, b) => ms(video.get(a.video_id)?.hora_salida) - ms(video.get(b.video_id)?.hora_salida) || REDES.indexOf(a.red) - REDES.indexOf(b.red),
  )
  const finVentana = (e: FilaEnvio, v: FilaVideo) =>
    (e.estado === "no_hoy" ? ms(e.proximo_intento) : ms(v.hora_salida)) + min(VENTANA_SALIDA_MIN)
  const libre = (e: FilaEnvio) => !e.dueno || ms(e.vence_en) < t
  const esHora = (e: FilaEnvio) => !e.proximo_intento || ms(e.proximo_intento) <= t

  // 3. Ambiguos: primero se mira la red. Si la ventana pasó, a mano.
  for (const e of ordenados) {
    const v = video.get(e.video_id)
    if (e.estado !== "ambiguo" || !v || !libre(e)) continue
    if (v.hora_salida && t > finVentana(e, v)) {
      acciones.push({ tipo: "cerrar_ambiguo", envio: e.id, red: e.red, como: "quedó ambiguo hasta el fin de la ventana: revisar a mano en la red" })
    } else if (activas.includes(e.red) && !(t - enviadoEn(e) < min(ESPERA_AMBIGUO_RED_MIN[e.red]))) {
      acciones.push({ tipo: "resolver_ambiguo", envio: e.id, video: e.video_id, red: e.red })
    }
  }

  // 4. Contenedores de Instagram que se estaban procesando.
  for (const e of ordenados) {
    const v = video.get(e.video_id)
    if (e.estado !== "procesando" || !v || !libre(e)) continue
    if (v.hora_salida && t > finVentana(e, v)) {
      acciones.push({ tipo: "omitir", envio: e.id, red: e.red, desde: "procesando", como: "el contenedor no terminó de procesarse dentro de la ventana" })
    } else if (puede(e.red) && esHora(e)) {
      acciones.push({ tipo: "retomar", envio: e.id, video: e.video_id, red: e.red })
    }
  }

  // 5. Publicar lo que toca (y omitir, con el cómo, lo que ya no va a salir).
  for (const e of ordenados) {
    const v = video.get(e.video_id)
    if (!v || v.estado !== "programado" || !v.hora_salida || !libre(e)) continue
    if (!["pendiente", "subido", "no_hoy"].includes(e.estado)) continue
    if (e.estado !== "no_hoy" && t < ms(v.hora_salida)) continue
    const omitir = (como: string) => acciones.push({ tipo: "omitir", envio: e.id, red: e.red, desde: e.estado, como })
    if (t > finVentana(e, v)) {
      omitir(redPausada(estado, e.red) ? "la red estuvo pausada toda la ventana de salida" : "pasó la ventana de salida sin publicarse")
      continue
    }
    if (!activas.includes(e.red)) {
      omitir("red apagada (FABRICA_ACTIVA, su variable FABRICA_<RED>_ACTIVA o sin adaptador)")
      continue
    }
    if ((e.red === "youtube" || e.red === "x") && e.estado === "pendiente") {
      omitir("la VM no lo subió antes de la hora de salida")
      continue
    }
    if (e.red === "x" && !(ms(e.media_expira_en) >= ms(v.hora_salida) + min(MARGEN_MEDIA_X_MIN))) {
      omitir(`la media de X vence (${e.media_expira_en ?? "sin fecha"}) antes de 30 min después de la salida`)
      continue
    }
    if (redPausada(estado, e.red) || !esHora(e)) continue
    acciones.push({ tipo: "publicar", envio: e.id, video: e.video_id, red: e.red, desde: e.estado })
  }

  // 6. YouTube: publishAt solo dentro de las próximas 3 h; si ya pasó, YouTube lo sacó.
  //    Un `programado` sin publish_at es una programación cortada a la mitad:
  //    se vuelve a programar (es idempotente) mientras falte para la salida.
  for (const e of ordenados) {
    const v = video.get(e.video_id)
    if (e.red !== "youtube" || !v || !libre(e)) continue
    const falta = ms(v.hora_salida) - t
    const aTiempo = v.estado === "programado" && !!v.hora_salida && puede("youtube") && falta <= min(HORIZONTE_YOUTUBE_MIN) && falta > min(2)
    if (e.estado === "programado" && salidaYouTube(e, v) <= t) {
      acciones.push({ tipo: "marcar_publicado", envio: e.id, red: "youtube" })
    } else if (aTiempo && (e.estado === "subido" || (e.estado === "programado" && !e.publish_at))) {
      acciones.push({ tipo: "programar", envio: e.id, video: e.video_id, red: "youtube", publishAt: v.hora_salida!, desde: e.estado })
    }
  }

  // 7. Verificar la visibilidad real: sin auditoría, una red "publica" en privado y responde éxito.
  for (const e of ordenados) {
    if (e.estado !== "publicado" || !e.id_red || !libre(e) || envioCerrado(e, ahora)) continue
    if (t - ms(e.publicado_en) < min(VERIFICAR_DESDE_MIN) || !activas.includes(e.red)) continue
    acciones.push({ tipo: "verificar", envio: e.id, video: e.video_id, red: e.red })
  }

  // 8. Videos: subido_parcial → programado; programado → publicado o fallido.
  for (const v of videos) {
    const es = porVideo.get(v.id) ?? []
    if (v.dueno && ms(v.vence_en) > t) continue
    if (listoParaProgramar(v, es, estado, activas, ahora)) {
      acciones.push({ tipo: "avanzar_video", video: v.id, desde: "subido_parcial", hasta: "programado" })
    } else if (v.estado === "programado" && es.every((e) => envioCerrado(e, ahora))) {
      const alguno = es.some((e) => e.estado === "confirmado" || e.estado === "publicado")
      acciones.push({
        tipo: "avanzar_video",
        video: v.id,
        desde: "programado",
        hasta: alguno ? "publicado" : "fallido",
        motivo: alguno ? undefined : es.length ? "ninguna red lo publicó" : "no tenía envíos",
      })
    }
  }

  // 9. El parte, desde las 23:00 (el candado de la base decide si ya salió).
  if (horaBolivia(ahora) >= HORA_PARTE) acciones.push({ tipo: "parte" })

  // 10. El almacén: se borra lo publicado cuando todas sus redes cerraron, y
  //     lo que ya no va a salir (fallido o rechazado) cuando ninguna red lo
  //     está leyendo: si no, sus 45–90 MB quedan en el bucket para siempre.
  for (const v of videos) {
    if (!v.archivo || (v.dueno && ms(v.vence_en) > t)) continue
    const es = porVideo.get(v.id) ?? []
    if (v.estado === "publicado" && es.every((e) => envioCerrado(e, ahora))) {
      acciones.push({ tipo: "limpiar_almacen", video: v.id, archivo: v.archivo, estado: v.estado })
    } else if ((v.estado === "fallido" || v.estado === "rechazado") && !es.some((e) => LEYENDO_EL_ARCHIVO.includes(e.estado))) {
      acciones.push({ tipo: "limpiar_almacen", video: v.id, archivo: v.archivo, estado: v.estado })
    }
  }
  return acciones
}

// ── Decisiones sobre lo que respondió la red (puras) ─────────

export interface Decision {
  hasta: EstadoEnvio
  campos: CamposEnvio
  /** Para los fallos seguidos de la red: true éxito, false fallo, undefined no cuenta. */
  cuenta?: boolean
}

type RespuestaPublicar = { ok: true; idRed: string; enlace?: string; contenedor?: string } | Fallo

const error = (paso: string, f: Pick<Fallo, "como" | "codigo">, clase: ErrorGuardado["clase"]): ErrorGuardado => ({
  paso,
  como: f.como,
  clase,
  ...(f.codigo ? { codigo: f.codigo } : {}),
})

/**
 * Qué hacer con la respuesta de publicar. `reservado` es el envío ya
 * reservado. `vuelta` es adonde vuelve si hay que reintentar (estadoBase, o
 * procesando si se retomaba un contenedor). `sumado` = la reserva contó este
 * intento (publicar sí; retomar un contenedor no): lo que no gasta intento lo
 * devuelve solo si se había sumado.
 */
export function decidirPublicacion(r: RespuestaPublicar, reservado: FilaEnvio, ahora: Date, vuelta: EstadoEnvio, sumado = true): Decision {
  const devuelto = sumado ? Math.max(0, reservado.intentos - 1) : reservado.intentos
  if (r.ok) {
    return { hasta: "publicado", campos: { id_red: r.idRed, enlace: r.enlace ?? null, publicado_ahora: true, proximo_intento: null }, cuenta: true }
  }
  // Instagram: el contenedor se sigue procesando. No es un fallo ni gasta el intento.
  if (r.pendiente) {
    return {
      hasta: "procesando",
      campos: { contenedor: r.pendiente, intentos: devuelto, error: error("publicar", r, r.clase) },
    }
  }
  switch (r.clase) {
    case "ambiguo":
      // Puede haber salido: nada de repetir sin mirar antes.
      return { hasta: "ambiguo", campos: { error: error("publicando", r, "ambiguo") } }
    case "no_hoy":
      // Tope o spam: hoy no. Mañana desde las 00:00, sin gastar el intento.
      return {
        hasta: "no_hoy",
        campos: { proximo_intento: mananaBolivia(ahora).toISOString(), intentos: devuelto, error: error("publicar", r, "no_hoy") },
      }
    case "fatal":
      return { hasta: "fallido", campos: { error: error("publicar", r, "fatal") }, cuenta: false }
    case "reintentable": {
      if (reservado.intentos >= MAX_INTENTOS) {
        return { hasta: "fallido", campos: { error: error("publicar", { ...r, como: `${r.como} (${reservado.intentos} intentos)` }, "reintentable") }, cuenta: false }
      }
      const proximo = new Date(ahora.getTime() + min(esperaTras(reservado.intentos))).toISOString()
      return { hasta: vuelta, campos: { proximo_intento: proximo, error: error("publicar", r, "reintentable") }, cuenta: false }
    }
  }
}

/** Normaliza para comparar títulos: sin tildes, sin mayúsculas, sin signos. */
const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Un envío ambiguo, con lo que la red dice que publicó. Si la lista falló,
 * sigue ambiguo (nunca se repite a ciegas). Si está, se toma su id. Si no
 * está, vuelve a intentarse (el intento ambiguo ya se contó).
 */
export function decidirAmbiguo(lista: Reciente[] | Fallo, envio: FilaEnvio, titulo: string): Decision {
  if (!Array.isArray(lista)) {
    return { hasta: "ambiguo", campos: { error: error("recientes", lista, lista.clase) } }
  }
  // El origen vive en su propia columna: el error de una lista fallida no lo pisa.
  const subiendo = origenAmbiguo(envio) === "subiendo"
  const buscado = plano(titulo)
  // Sin título no hay con qué buscarlo: "no lo encontré" no probaría nada, y
  // repetir a ciegas es publicar dos veces.
  if (!buscado) {
    return {
      hasta: "fallido",
      campos: { error: { paso: "recientes", clase: "ambiguo", como: "sin título para buscarlo entre los recientes: revisar a mano en la red" } },
      cuenta: false,
    }
  }
  const hallado = lista.find((p) => plano(p.texto).includes(buscado))
  if (hallado) {
    return subiendo
      ? { hasta: "subido", campos: { id_red: hallado.idRed } }
      : { hasta: "publicado", campos: { id_red: hallado.idRed, publicado_ahora: true, proximo_intento: null }, cuenta: true }
  }
  if (envio.intentos >= MAX_INTENTOS) {
    return {
      hasta: "fallido",
      campos: { error: { paso: "recientes", clase: "ambiguo", como: `no estaba entre los ${lista.length} recientes y ya no quedan intentos` } },
      cuenta: false,
    }
  }
  return {
    hasta: subiendo ? "pendiente" : estadoBase(envio.red),
    campos: { error: { paso: "recientes", clase: "ambiguo", como: `no estaba entre los ${lista.length} posts recientes: se vuelve a intentar` } },
  }
}

/**
 * YouTube, ambiguo al PUBLICAR (no al subir): la VM ya había subido el video
 * en privado, así que estar en la lista de subidas no prueba nada. La
 * pregunta es estado(): público = salió; privado = no salió y se vuelve a
 * intentar (publicar es un videos.update, idempotente); sin respuesta clara,
 * sigue ambiguo.
 */
export function decidirAmbiguoYouTube(v: { visibilidad: Visibilidad; como: string }, envio: FilaEnvio): Decision {
  switch (v.visibilidad) {
    case "publico":
      return { hasta: "publicado", campos: { visibilidad: "publico", publicado_ahora: true, proximo_intento: null }, cuenta: true }
    case "privado":
      if (envio.intentos >= MAX_INTENTOS) {
        return { hasta: "fallido", campos: { error: { paso: "estado", clase: "ambiguo", como: `sigue privado y ya no quedan intentos: ${v.como}` } }, cuenta: false }
      }
      return { hasta: "subido", campos: { error: { paso: "estado", clase: "ambiguo", como: `sigue privado, no salió: se vuelve a publicar (${v.como})` } } }
    case "no_existe":
      return { hasta: "fallido", campos: { error: { paso: "estado", clase: "fatal", como: `el video ya no existe en YouTube: ${v.como}` } }, cuenta: false }
    default:
      return { hasta: "ambiguo", campos: { error: { paso: "estado", clase: "ambiguo", como: `estado ${v.visibilidad}: ${v.como}` } } }
  }
}

/** Lo que dice estado() de un post publicado. Un privado inesperado pausa esa red. */
export function decidirVerificacion(v: { visibilidad: Visibilidad; como: string }): Decision & { pausarRed?: string } {
  switch (v.visibilidad) {
    case "publico":
      return { hasta: "confirmado", campos: { visibilidad: "publico", verificado_ahora: true } }
    case "privado":
      return {
        hasta: "fallido",
        campos: { visibilidad: "privado", verificado_ahora: true, error: { paso: "verificar", clase: "privado", como: v.como } },
        pausarRed: `salió privado sin pedirlo: ${v.como}`,
      }
    case "no_existe":
      return { hasta: "fallido", campos: { visibilidad: "no_existe", verificado_ahora: true, error: { paso: "verificar", clase: "fatal", como: v.como } }, cuenta: false }
    default:
      // procesando o desconocida: se vuelve a mirar en el próximo tick.
      return { hasta: "publicado", campos: { visibilidad: v.visibilidad, verificado_ahora: true } }
  }
}

// ── El ejecutor ──────────────────────────────────────────────

export interface PuertosTick {
  base: BaseCola
  adaptadores: Partial<Record<RedId, Adaptador>>
  /**
   * Solo para desprogramar: las redes configuradas aunque estén apagadas por
   * entorno (registro-redes.ts, adaptadoresParaBajar). Apagar FABRICA_ACTIVA
   * tiene que bajar lo que YouTube ya tiene programado, no dejarlo salir.
   */
  bajar?: Partial<Record<RedId, Adaptador>>
  ctx: Ctx
  env: Entorno
  /** Milisegundos (Date.now): solo para el presupuesto de tiempo, nunca para decidir. */
  reloj: () => number
  /** 45 s por defecto: la ruta tiene maxDuration = 60. */
  presupuestoMs?: number
  /** Arma y manda el parte (reporte.ts). */
  parte?: () => Promise<string>
  dueno?: string
  log?: Log
}

export interface ResultadoTick {
  ahora: string
  pausada: boolean
  acciones: number
  hechas: { accion: Accion["tipo"]; envio?: string; video?: string; resultado: string }[]
  cortado?: string
}

/** Cuánto tiempo hace falta que quede para empezar cada paso. Un envío puede tardar ~20 s (meta.ts corta a los 45). */
const NECESITA_MS: Partial<Record<Accion["tipo"], number>> = {
  publicar: 25_000,
  retomar: 25_000,
  resolver_ambiguo: 12_000,
  programar: 12_000,
  desprogramar: 12_000,
  verificar: 8_000,
  parte: 10_000,
  limpiar_almacen: 8_000,
}

const textoDeError = (e: unknown) => (e instanceof Error ? e.message : String(e))

function paraRed(v: FilaVideo, e: FilaEnvio): VideoParaRed {
  return {
    videoId: v.id,
    envioId: e.id,
    red: e.red,
    titulo: tituloDe(v),
    // Nunca se publica con "" de relleno: textosParaPublicar() lo frena antes.
    texto: v.textos?.porRed?.[e.red] ?? "",
    archivo: v.archivo,
    duracionS: v.duracion_s === null ? null : Number(v.duracion_s),
    formato: v.episodio?.formato ?? null,
    horaSalida: v.hora_salida,
    idRed: e.id_red,
    contenedor: e.contenedor,
    mediaId: e.media_id,
    publishAt: e.publish_at,
  }
}

/**
 * Lo que tiene mal lo que se va a mandar a una red (vacío = se puede mandar).
 * Se mira ANTES de reservar: un texto que falta no se rellena con "" (saldría
 * sin el aviso de ficción y, en TikTok, sin medir sus 61 s), y un título con
 * una marca sin reemplazar no sube.
 */
export function textosParaPublicar(v: FilaVideo, red: RedId): string[] {
  const titulo = tituloDe(v)
  const texto = v.textos?.porRed?.[red]
  if (!titulo) return [`sin título publicable para ${red} (falta o trae una marca sin reemplazar)`]
  if (!texto) return [`sin texto para ${red}: el guion no lo armó para esa red`]
  return textoValido(red, texto, titulo)
}

/** Un adaptador que lanza en vez de devolver un Fallo: no se sabe si mandó, así que es ambiguo. */
async function aFallo<T>(promesa: Promise<T | Fallo>, paso: string): Promise<T | Fallo> {
  try {
    return await promesa
  } catch (e) {
    return { ok: false, clase: "ambiguo", como: `${paso} lanzó una excepción: ${textoDeError(e)}` }
  }
}

export async function ejecutarTick(p: PuertosTick): Promise<ResultadoTick> {
  const inicio = p.reloj()
  const presupuesto = p.presupuestoMs ?? 45_000
  const log = p.log ?? ((m: string) => console.log(m))
  const dueno = p.dueno ?? `tick-${inicio.toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const { ahora, estado } = await p.base.latido()
  const vencidos = await p.base.vencidosAAmbiguo()
  if (vencidos) log(`[fabrica/cola] ${vencidos} envío(s) con la reserva vencida pasaron a ambiguo`)

  const fabricaActiva = flag(p.env.FABRICA_ACTIVA)
  const activas = redesEncendidas(p.env).filter((r) => p.adaptadores[r])
  if (!estado.pausada && fabricaActiva) {
    const v = await p.base.vencerAprobaciones()
    if (v.guiones || v.videos.length) log(`[fabrica/cola] aprobaciones vencidas: ${v.guiones} guion(es), ${v.videos.length} video(s) sin OK`)
  }

  const hoy = diaBolivia(ahora)
  const { videos, envios } = await p.base.cargar([sumarDias(hoy, -1), hoy, sumarDias(hoy, 1)])
  const acciones = planDelTick({ estado, videos, envios, ahora, fabricaActiva, activas })
  const res: ResultadoTick = { ahora: ahora.toISOString(), pausada: estado.pausada || !fabricaActiva, acciones: acciones.length, hechas: [] }
  const video = new Map(videos.map((v) => [v.id, v]))
  const envio = new Map(envios.map((e) => [e.id, e]))

  // Pausada (de antes o en medio del tick) solo se hace esto: bajar YouTube y el parte.
  const sePuedePausada = (tipo: Accion["tipo"]) => tipo === "desprogramar" || tipo === "parte"
  for (const a of acciones) {
    const queda = presupuesto - (p.reloj() - inicio)
    if (queda < (NECESITA_MS[a.tipo] ?? 3_000)) {
      res.cortado = `sin tiempo para ${a.tipo} (quedaban ${Math.round(queda / 1000)} s): sigue el próximo tick`
      break
    }
    if (res.pausada && !sePuedePausada(a.tipo)) continue
    // El interruptor se lee antes de cada paso (la reserva lo vuelve a mirar en la base).
    if (!sePuedePausada(a.tipo)) {
      const e = await p.base.leerEstado()
      if (e.pausada) {
        res.cortado = `se pausó en medio del tick: ${e.motivo ?? "sin motivo"}`
        res.pausada = true
        continue
      }
      if ("red" in a && e.redes?.[a.red]?.pausada && a.tipo !== "verificar" && a.tipo !== "omitir" && a.tipo !== "cerrar_ambiguo") {
        res.hechas.push({ accion: a.tipo, envio: "envio" in a ? a.envio : undefined, resultado: `red ${a.red} pausada` })
        continue
      }
    }
    let resultado: string
    try {
      resultado = await ejecutarAccion(a, { ...p, log }, dueno, ahora, video, envio)
    } catch (e) {
      // Un paso que falla no tumba el tick: se loguea con el cómo y se sigue.
      resultado = `error: ${textoDeError(e)}`
      console.error(`[fabrica/cola] ${a.tipo} falló: ${textoDeError(e)}`)
    }
    res.hechas.push({ accion: a.tipo, envio: "envio" in a ? a.envio : undefined, video: "video" in a ? a.video : undefined, resultado })
    if (resultado.startsWith("fábrica pausada")) {
      res.pausada = true
      res.cortado = resultado
    }
  }
  return res
}

/**
 * La ruta de pausa lo corre en el momento: lo que YouTube tiene programado
 * sale aunque la base diga pausada, y esperar al tick son hasta 10 min. No
 * deja latido (no es un tick: el vigilante no puede confundirlo con uno).
 * La hora es la del servidor: alcanza para saber qué publishAt está por delante.
 */
export async function bajarYouTube(p: Omit<PuertosTick, "parte">): Promise<ResultadoTick["hechas"]> {
  const log = p.log ?? ((m: string) => console.log(m))
  const dueno = p.dueno ?? `pausa-${p.reloj().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const ahora = p.ctx.ahora()
  const estado = await p.base.leerEstado()
  const hoy = diaBolivia(ahora)
  const { videos, envios } = await p.base.cargar([sumarDias(hoy, -1), hoy, sumarDias(hoy, 1)])
  const activas = redesEncendidas(p.env).filter((r) => p.adaptadores[r])
  const acciones = bajadasDeYouTube({ estado, videos, envios, ahora, fabricaActiva: flag(p.env.FABRICA_ACTIVA), activas })
  const video = new Map(videos.map((v) => [v.id, v]))
  const envio = new Map(envios.map((e) => [e.id, e]))
  const hechas: ResultadoTick["hechas"] = []
  for (const a of acciones) {
    let resultado: string
    try {
      resultado = await ejecutarAccion(a, { ...p, log }, dueno, ahora, video, envio)
    } catch (e) {
      resultado = `error: ${textoDeError(e)}`
      console.error(`[fabrica/cola] bajar YouTube al pausar falló: ${textoDeError(e)}`)
    }
    hechas.push({ accion: a.tipo, envio: "envio" in a ? a.envio : undefined, video: "video" in a ? a.video : undefined, resultado })
  }
  if (hechas.length) log(`[fabrica/cola] al pausar se bajaron ${hechas.length} envío(s) de YouTube: ${hechas.map((h) => h.resultado).join(" | ")}`)
  return hechas
}

async function ejecutarAccion(
  a: Accion,
  p: PuertosTick & { log: Log },
  dueno: string,
  ahora: Date,
  videos: Map<string, FilaVideo>,
  envios: Map<string, FilaEnvio>,
): Promise<string> {
  const { base } = p
  const adaptador = "red" in a ? (p.adaptadores[a.red] ?? (a.tipo === "desprogramar" ? p.bajar?.[a.red] : undefined)) : undefined

  switch (a.tipo) {
    case "cubrir_hueco": {
      const v = await base.cubrirHueco(a.dia, a.slot, a.hora)
      if (!v) return "sin reserva verde lista (o el lugar ya está en camino)"
      return `lo cubre ${v.id}`
    }
    case "omitir":
      return (await base.moverEnvio(a.envio, [a.desde], "omitido", { error: { paso: "publicar", clase: "omitido", como: a.como } }))
        ? `omitido: ${a.como}`
        : "otro lo movió antes"
    case "cerrar_ambiguo":
      return (await base.moverEnvio(a.envio, ["ambiguo"], "fallido", { error: { paso: "recientes", clase: "ambiguo", como: a.como } }))
        ? "fallido: revisar a mano"
        : "otro lo movió antes"
    case "marcar_publicado": {
      const ok = await base.moverEnvio(a.envio, ["programado"], "publicado", { publicado_ahora: true })
      if (ok) await base.registrarResultado(a.red, true)
      return ok ? "YouTube lo sacó a su hora" : "otro lo movió antes"
    }
    case "avanzar_video": {
      const campos: CamposVideo = a.motivo ? { motivo_rechazo: a.motivo } : {}
      return (await base.moverVideo(a.video, [a.desde], a.hasta, campos)) ? `${a.desde} → ${a.hasta}` : "otro lo movió antes"
    }
    case "parte":
      return p.parte ? await p.parte() : "sin parte configurado"
    case "limpiar_almacen": {
      if (!p.ctx.almacen) return "sin almacén configurado: no se borra"
      await p.ctx.almacen.borrar(a.archivo)
      await base.moverVideo(a.video, [a.estado], a.estado, { archivo: null })
      return `borrado del almacén (${a.estado})`
    }
  }

  // Lo que sigue toca la red: hace falta el adaptador, el envío y el video.
  const e0 = envios.get(a.envio)
  const v = videos.get(a.video)
  if (!adaptador) return `sin adaptador para ${a.red}`
  if (!e0 || !v) return "el envío o el video ya no están en la carga del tick"

  switch (a.tipo) {
    case "publicar":
    case "retomar": {
      const retomar = a.tipo === "retomar"
      const desde: EstadoEnvio[] = retomar ? ["procesando"] : [a.desde]
      // 0. Lo que se manda tiene que estar entero. Retomar no vuelve a mandar el texto (el contenedor ya lo tiene).
      if (!retomar) {
        const malos = textosParaPublicar(v, a.red)
        if (malos.length) {
          const como = malos.join("; ")
          const hasta: EstadoEnvio = a.desde === "no_hoy" ? "omitido" : "fallido"
          const movido = await base.moverEnvio(a.envio, [a.desde], hasta, { error: { paso: "publicar", clase: "fatal", como } })
          console.error(`[fabrica/cola] ${a.red}: ${a.envio} no se manda: ${como}`)
          return movido ? `${hasta}: ${como}` : "otro lo movió antes"
        }
      }
      // 1. Reservar. Sin reserva no se manda nada.
      const r = await base.reservarEnvio(a.envio, desde, "publicando", dueno, VENCE_ENVIO_MIN, MAX_INTENTOS, { sumar: !retomar })
      if (!r) return "reserva perdida: otro lo tiene, ya se movió o no quedan intentos"
      // 2. La plata, antes de gastarla. Si pasa el tope, la base pausa la fábrica.
      const costo = COSTO_USD[a.red]
      if (costo > 0) {
        const g = await base.sumarGasto(costo)
        if (!g.ok) {
          await base.terminarEnvio(r.id, dueno, e0.estado, { intentos: Math.max(0, r.intentos - 1) })
          return `fábrica pausada: ${g.motivo ?? "tope de gasto"}`
        }
      }
      // 3. Mandar.
      const resp = await aFallo(adaptador.publicar(paraRed(v, r), p.ctx), `${a.red}.publicar`)
      const d = decidirPublicacion(resp, r, ahora, retomar ? "procesando" : estadoBase(a.red), !retomar)
      // 4. Cerrar la reserva. Si no cierra, venció: el próximo tick la ve ambigua.
      const cerrado = await base.terminarEnvio(r.id, dueno, d.hasta, d.campos)
      if (!cerrado) console.error(`[fabrica/cola] ${a.red}: la reserva de ${r.id} venció antes de cerrarse en ${d.hasta}`)
      if (d.cuenta !== undefined) await base.registrarResultado(a.red, d.cuenta)
      return resp.ok ? `publicado (${resp.idRed})` : `${d.hasta}: ${resp.clase} · ${resp.como}`
    }
    case "resolver_ambiguo": {
      const r = await base.reservarEnvio(a.envio, ["ambiguo"], "ambiguo", dueno, VENCE_ENVIO_MIN, 99, { sumar: false })
      if (!r) return "reserva perdida"
      // YouTube al publicar: la subida privada ya estaba en la lista; se pregunta su visibilidad.
      if (a.red === "youtube" && origenAmbiguo(r) === "publicando" && r.id_red) {
        let vis: { visibilidad: Visibilidad; como: string }
        try {
          vis = await adaptador.estado(r.id_red, p.ctx)
        } catch (e) {
          vis = { visibilidad: "desconocida", como: `estado() lanzó: ${textoDeError(e)}` }
        }
        const d = decidirAmbiguoYouTube(vis, r)
        await base.terminarEnvio(r.id, dueno, d.hasta, d.campos)
        if (d.cuenta !== undefined) await base.registrarResultado(a.red, d.cuenta)
        return `ambiguo → ${d.hasta} (estado: ${vis.visibilidad})`
      }
      // Desde que se MANDÓ (enviado_en: las reservas que solo miran no la
      // mueven) o la salida, lo que sea antes, con margen.
      const ref = Math.min(...[enviadoEn(e0), ms(v.hora_salida)].filter(Number.isFinite))
      const desde = Number.isFinite(ref) ? ref : ahora.getTime() - 24 * 3600_000
      const lista = await aFallo(adaptador.recientes(new Date(desde - min(MARGEN_RECIENTES_MIN)), p.ctx), `${a.red}.recientes`)
      const d = decidirAmbiguo(lista, r, tituloDe(v))
      await base.terminarEnvio(r.id, dueno, d.hasta, d.campos)
      if (d.cuenta !== undefined) await base.registrarResultado(a.red, d.cuenta)
      if (!Array.isArray(lista)) console.error(`[fabrica/cola] ${a.red}: recientes() falló para ${r.id}, sigue ambiguo: ${lista.como}`)
      return `ambiguo → ${d.hasta}`
    }
    case "programar": {
      // Se reserva YA en `programado`: si el tick muere con YouTube a medio
      // programar, la base dice programado y el interruptor lo baja. Al revés
      // (reservar en subido) una pausa no lo vería y YouTube lo sacaría igual.
      const r = await base.reservarEnvio(a.envio, [a.desde], "programado", dueno, VENCE_ENVIO_MIN, 99, { sumar: false })
      if (!r) return "reserva perdida"
      if (!adaptador.programar) {
        await base.terminarEnvio(r.id, dueno, "subido", {})
        return "el adaptador de YouTube no sabe programar: sale a la hora con publicar"
      }
      const resp = await aFallo(adaptador.programar(paraRed(v, r), a.publishAt, p.ctx), "youtube.programar")
      if (resp.ok) {
        await base.terminarEnvio(r.id, dueno, "programado", { publish_at: a.publishAt })
        return `programado para ${a.publishAt}`
      }
      // Ambiguo (o ya venía de una programación cortada): pudo quedar
      // programado en YouTube. Sigue `programado` sin publish_at: el próximo
      // tick lo reprograma o, si está pausada, lo baja.
      const hasta: EstadoEnvio = resp.clase === "ambiguo" || a.desde === "programado" ? "programado" : "subido"
      await base.terminarEnvio(r.id, dueno, hasta, { publish_at: null, error: error("programar", resp, resp.clase) })
      return `no se programó (${hasta}): ${resp.clase} · ${resp.como}`
    }
    case "desprogramar": {
      const r = await base.reservarEnvio(a.envio, ["programado"], "programado", dueno, VENCE_ENVIO_MIN, 99, { sumar: false, aunPausada: true })
      if (!r) return "reserva perdida"
      if (!adaptador.desprogramar || !r.id_red) {
        await base.terminarEnvio(r.id, dueno, "programado", { error: { paso: "desprogramar", clase: "fatal", como: "sin desprogramar() o sin id de YouTube" } })
        console.error(`[fabrica/cola] youtube: no se pudo desprogramar ${r.id}: sin desprogramar() o sin id`)
        return "NO se desprogramó: falta el adaptador o el id"
      }
      const resp = await aFallo(adaptador.desprogramar(r.id_red, p.ctx), "youtube.desprogramar")
      if (resp.ok) {
        await base.terminarEnvio(r.id, dueno, "subido", { publish_at: null })
        return "desprogramado: privado y sin publishAt"
      }
      // Sigue programado: el próximo tick lo intenta otra vez (es idempotente).
      await base.terminarEnvio(r.id, dueno, "programado", { error: error("desprogramar", resp, resp.clase) })
      console.error(`[fabrica/cola] youtube: desprogramar ${r.id} falló: ${resp.como}`)
      return `NO se desprogramó: ${resp.como}`
    }
    case "verificar": {
      const r = await base.reservarEnvio(a.envio, ["publicado"], "publicado", dueno, VENCE_ENVIO_MIN, 99, { sumar: false })
      if (!r || !r.id_red) return "reserva perdida"
      let vis: { visibilidad: Visibilidad; como: string }
      try {
        vis = await adaptador.estado(r.id_red, p.ctx)
      } catch (e) {
        vis = { visibilidad: "desconocida", como: `estado() lanzó: ${textoDeError(e)}` }
      }
      const d = decidirVerificacion(vis)
      await base.terminarEnvio(r.id, dueno, d.hasta, d.campos)
      if (d.pausarRed) await base.pausar(d.pausarRed, "fabrica", a.red)
      if (d.cuenta !== undefined) await base.registrarResultado(a.red, d.cuenta)
      return `${vis.visibilidad}: ${vis.como}`
    }
  }
  return "acción desconocida"
}
