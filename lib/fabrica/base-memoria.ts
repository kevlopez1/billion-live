// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · UNA BASE FALSA EN MEMORIA (solo para tests)
//
// Imita las funciones SQL de la parte 11 de supabase/correr-todo.sql con las
// mismas condiciones: reservar = cambiar de estado SOLO si sigue en p_desde,
// nadie lo tiene (o venció), quedan intentos, es la hora y nada está pausado.
// Cada método es atómico (JS no corta una función síncrona a la mitad), como
// una sentencia en Postgres. La hora la pone el test.
// ──────────────────────────────────────────────────────────────

import type { BaseCola, BaseParte, CamposEnvio, CamposVideo, FilaReporte, OpcionesReserva, TokenConError } from "./base-cola"
import { diaBolivia, type EstadoDeRed, type EstadoEnvio, type EstadoVideo, type FilaEnvio, type FilaEstado, type FilaVideo, type RedId } from "./tipos"

export interface Memoria {
  ahora: Date
  estado: FilaEstado
  videos: FilaVideo[]
  envios: FilaEnvio[]
  candados: Map<string, { intentos: number; reclamado: number; terminado: number | null }>
  partes: Map<string, FilaReporte>
  tokens: TokenConError[]
  reserva: number
  /** Lo que se llamó, en orden: para comprobar el orden de los pasos. */
  llamadas: string[]
}

export function estadoInicial(): FilaEstado {
  return {
    pausada: true,
    motivo: "recién creada: la reanuda Kev",
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
  }
}

const iso = (d: Date) => d.toISOString()
const t = (s: string | null) => (s ? Date.parse(s) : NaN)

export function baseEnMemoria(m: Memoria): BaseCola & BaseParte {
  const now = () => m.ahora.getTime()
  const libre = (x: { dueno: string | null; vence_en: string | null }) => !x.dueno || t(x.vence_en) < now()
  const alDia = () => {
    const hoy = diaBolivia(m.ahora)
    if (m.estado.dia !== hoy) Object.assign(m.estado, { dia: hoy, gasto_usd_dia: 0, publicados_dia: 0, fallidos_dia: 0 })
  }
  const conCuando = (e: unknown) => ({ cuando: iso(m.ahora), ...(e as object) })
  const pausar = (motivo: string, por: string, red?: RedId) => {
    if (!red) {
      if (!m.estado.pausada) Object.assign(m.estado, { pausada: true, motivo, pausada_por: por, pausada_en: iso(m.ahora) })
    } else if (!m.estado.redes[red]?.pausada) {
      m.estado.redes = { ...m.estado.redes, [red]: { ...(m.estado.redes[red] ?? {}), pausada: true, motivo } }
    }
    return { ...m.estado }
  }
  const aplicar = (e: FilaEnvio, campos: CamposEnvio) => {
    for (const [k, v] of Object.entries(campos)) {
      if (k === "error") e.ultimo_error = conCuando(v) as FilaEnvio["ultimo_error"]
      else if (k === "publicado_ahora") e.publicado_en = v ? iso(m.ahora) : e.publicado_en
      else if (k === "verificado_ahora") e.verificado_en = v ? iso(m.ahora) : e.verificado_en
      else (e as unknown as Record<string, unknown>)[k] = v
    }
  }
  const cargar = async (dias: string[]) => {
    const videos = m.videos.filter((v) => dias.includes(v.dia)).map((v) => ({ ...v }))
    const ids = new Set(videos.map((v) => v.id))
    return { videos, envios: m.envios.filter((e) => ids.has(e.video_id)).map((e) => ({ ...e })) }
  }

  return {
    async latido() {
      m.llamadas.push("latido")
      alDia()
      m.estado.ultimo_tick_en = iso(m.ahora)
      return { ahora: new Date(m.ahora), estado: { ...m.estado } }
    },
    async leerEstado() {
      return { ...m.estado, redes: { ...m.estado.redes } }
    },
    async vencidosAAmbiguo() {
      m.llamadas.push("vencidos")
      let n = 0
      for (const e of m.envios) {
        if ((e.estado === "subiendo" || e.estado === "publicando") && t(e.vence_en) < now()) {
          e.ultimo_error = conCuando({ paso: e.estado, clase: "ambiguo", como: `la reserva de ${e.dueno} venció en ${e.estado} sin cerrarse` }) as FilaEnvio["ultimo_error"]
          Object.assign(e, { ambiguo_desde: e.estado, estado: "ambiguo", dueno: null, vence_en: null })
          n++
        }
      }
      return n
    },
    async vencerAprobaciones() {
      m.llamadas.push("aprobaciones")
      return { guiones: 0, videos: [] }
    },
    cargar,
    async cubrirHueco(dia, slot, hora) {
      m.llamadas.push(`cubrir:${dia}:${slot}`)
      if (m.estado.pausada) return null
      const viejo = m.videos.find((v) => v.dia === dia && v.slot === slot)
      if (viejo && (viejo.estado === "programado" || viejo.estado === "publicado")) return null
      const nuevo = m.videos
        .filter((v) => v.es_reserva && v.slot === null && v.semaforo === "verde" && v.estado === "subido_parcial" && libre(v))
        .filter((v) => !m.estado.modo_aprobacion || v.aprobado_video_en)
        .sort((a, b) => a.creado.localeCompare(b.creado))[0]
      if (!nuevo) return null
      if (viejo) {
        const vivo = !["fallido", "rechazado", "publicado"].includes(viejo.estado)
        viejo.slot = null
        viejo.es_reserva = viejo.semaforo === "verde" && vivo
        if (viejo.semaforo !== "verde" && vivo) viejo.estado = "rechazado"
      }
      Object.assign(nuevo, { dia, slot, hora_salida: hora, es_reserva: false })
      return { ...nuevo }
    },
    async moverVideo(id, desde, hasta, campos: CamposVideo = {}) {
      const v = m.videos.find((x) => x.id === id)
      if (!v || !desde.includes(v.estado) || !libre(v)) return false
      if (hasta !== v.estado) v.intentos = 0
      v.estado = hasta as EstadoVideo
      if ("motivo_rechazo" in campos) v.motivo_rechazo = campos.motivo_rechazo as string
      if ("archivo" in campos) v.archivo = campos.archivo as string | null
      return true
    },
    async reservarEnvio(id, desde, enCurso, dueno, venceMin, maxIntentos, o: OpcionesReserva = {}) {
      m.llamadas.push(`reservar:${id}:${enCurso}`)
      const e = m.envios.find((x) => x.id === id)
      if (!e || !desde.includes(e.estado) || !libre(e) || e.intentos >= maxIntentos) return null
      if (e.proximo_intento && t(e.proximo_intento) > now()) return null
      // Publicar exige el video en programado en la misma "sentencia" (como el SQL).
      if (enCurso === "publicando" && m.videos.find((v) => v.id === e.video_id)?.estado !== "programado") return null
      if (!o.aunPausada && (m.estado.pausada || m.estado.redes[e.red]?.pausada)) return null
      Object.assign(e, {
        estado: enCurso,
        dueno,
        reservado_en: iso(m.ahora),
        // Como el SQL: solo una reserva que MANDA mueve el ancla de recientes().
        enviado_en: enCurso === "publicando" || enCurso === "subiendo" ? iso(m.ahora) : (e.enviado_en ?? null),
        vence_en: iso(new Date(now() + venceMin * 60_000)),
        intentos: e.intentos + ((o.sumar ?? true) ? 1 : 0),
      })
      return { ...e }
    },
    async terminarEnvio(id, dueno, hasta, campos = {}) {
      const e = m.envios.find((x) => x.id === id)
      if (!e || e.dueno !== dueno) return false
      // Como el SQL: al entrar en ambiguo se anota desde dónde; al salir, se borra.
      const ambiguoDesde = hasta !== "ambiguo" ? null : e.estado !== "ambiguo" ? e.estado : (e.ambiguo_desde ?? null)
      Object.assign(e, { estado: hasta as EstadoEnvio, dueno: null, vence_en: null, ambiguo_desde: ambiguoDesde })
      aplicar(e, campos)
      return true
    },
    async moverEnvio(id, desde, hasta, campos = {}) {
      const e = m.envios.find((x) => x.id === id)
      if (!e || !desde.includes(e.estado) || !libre(e)) return false
      e.estado = hasta
      aplicar(e, campos)
      return true
    },
    async sumarGasto(usd) {
      alDia()
      const e = m.estado
      if (!e.pausada && e.gasto_usd_dia + usd <= e.tope_gasto_usd_dia + 1e-9) {
        e.gasto_usd_dia = Math.round((e.gasto_usd_dia + usd) * 1e4) / 1e4
        return { ok: true, gasto: e.gasto_usd_dia, tope: e.tope_gasto_usd_dia }
      }
      pausar(`tope de gasto: ${e.gasto_usd_dia} + ${usd} pasa de ${e.tope_gasto_usd_dia} USD`, "fabrica")
      return { ok: false, gasto: e.gasto_usd_dia, tope: e.tope_gasto_usd_dia, motivo: m.estado.motivo ?? undefined }
    },
    async registrarResultado(red, ok) {
      alDia()
      const r: EstadoDeRed = { ...(m.estado.redes[red] ?? {}) }
      r.fallos_seguidos = ok ? 0 : (r.fallos_seguidos ?? 0) + 1
      m.estado.redes = { ...m.estado.redes, [red]: r }
      if (ok) m.estado.publicados_dia++
      else m.estado.fallidos_dia++
      if (!ok && (r.fallos_seguidos ?? 0) >= 2) pausar(`${r.fallos_seguidos} fallos seguidos`, "fabrica", red)
      return { ...m.estado.redes[red] }
    },
    async pausar(motivo, por, red) {
      return pausar(motivo, por, red)
    },
    async reanudar(por, red) {
      if (!red) Object.assign(m.estado, { pausada: false, motivo: null, pausada_por: por })
      else m.estado.redes = { ...m.estado.redes, [red]: { pausada: false, fallos_seguidos: 0 } }
      return { ...m.estado }
    },
    async ajustar(campos) {
      Object.assign(m.estado, campos)
      return { ...m.estado }
    },
    async reclamar(que, intentos, venceMin) {
      const dia = diaBolivia(m.ahora)
      const k = `${que}:${dia}`
      const c = m.candados.get(k)
      if (!c) {
        m.candados.set(k, { intentos: 1, reclamado: now(), terminado: null })
        return dia
      }
      if (c.terminado !== null || c.intentos >= intentos || c.reclamado >= now() - venceMin * 60_000) return null
      c.intentos++
      c.reclamado = now()
      return dia
    },
    async terminarCandado(que, dia) {
      const c = m.candados.get(`${que}:${dia}`)
      if (!c || c.terminado !== null) return false
      c.terminado = now()
      return true
    },

    async reservaVerde() {
      return m.reserva
    },
    async tokensConError() {
      return m.tokens
    },
    async candado(que, dia) {
      const c = m.candados.get(`${que}:${dia}`)
      return c ? { reclamado: iso(new Date(c.reclamado)), terminado: c.terminado ? iso(new Date(c.terminado)) : null, intentos: c.intentos } : null
    },
    async guardarParte(dia, resumen, texto, canal) {
      m.llamadas.push(`guardar-parte:${dia}`)
      const p = m.partes.get(dia)
      if (p?.enviado_en) return false
      m.partes.set(dia, { dia, generado_en: iso(m.ahora), enviado_en: null, canal, resumen, texto, error: null })
      return true
    },
    async resultadoParte(dia, error) {
      const p = m.partes.get(dia)
      if (p) Object.assign(p, { error, enviado_en: error === null ? iso(m.ahora) : p.enviado_en })
    },
    async ultimoParte() {
      return [...m.partes.values()].sort((a, b) => b.dia.localeCompare(a.dia))[0] ?? null
    },
  }
}

export function memoriaNueva(ahora: Date): Memoria {
  return { ahora, estado: estadoInicial(), videos: [], envios: [], candados: new Map(), partes: new Map(), tokens: [], reserva: 0, llamadas: [] }
}
