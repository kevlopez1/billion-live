// ──────────────────────────────────────────────────────────────
// LOS NÚMEROS DE CADA VIDEO
//
// Se mide lo que DECIDE LA DISTRIBUCIÓN, no lo que es fácil de contar.
//
// YouTube dice en su documentación que para recomendar un Short mira tres
// cosas: qué proporción de gente eligió verlo (CTR), la duración media y el
// porcentaje medio visto. El memo interno de MrBeast obliga a su equipo a
// mirar exactamente esas tres. Instagram (Mosseri, enero 2025) nombró el
// tiempo de visionado, los likes por alcance y los envíos por alcance — y
// dijo que los envíos pesan más para llegar a quien NO te sigue.
//
// Por eso aquí casi todo es una TASA y no un total. Un total no se compara:
// 400 likes sobre 2.000 vistas y 400 sobre 200.000 son cosas opuestas, y en
// una tabla de totales se ven igual.
//
// Toda métrica que una red no reporte vale `null`, nunca 0. Un dato que falta
// no es un cero, y promediar ceros falsos hunde el promedio de un formato
// entero.
// ──────────────────────────────────────────────────────────────

export type Publicacion = {
  id: string
  fecha: string          // ISO, el día que se publicó
  titulo: string
  formatoId: string      // enlaza con uno de los formatos del manual
  red: string
  url?: string
  /** Los tres primeros segundos, transcritos. */
  gancho?: string
  vistas: number
  /** Cuánta gente lo vio pasar. Sin esto no existe ningún "por alcance". */
  alcance: number | null
  /** % que eligió verlo de los que lo vieron pasar. */
  ctr: number | null
  /** Segundos vistos en promedio. */
  duracionMedia: number | null
  /** % promedio visto. */
  retencion: number | null
  likes: number
  comentarios: number
  compartidos: number
  seguidores: number     // ganados por ese video
}

export type ResumenFormato = {
  formatoId: string
  nombre: string
  videos: number
  vistas: number
  vistasMedia: number
  // Las tres de YouTube
  ctrMedio: number | null
  duracionMedia: number | null
  retencionMedia: number | null
  // Las dos de Instagram, en % del alcance
  enviosPorAlcance: number | null
  likesPorAlcance: number | null
  seguidoresPorMil: number | null
  suficiente: boolean    // ¿hay datos para sacar conclusiones?
}

/** Por debajo de esto, un promedio es anécdota y no evidencia. */
export const MINIMO_PARA_CONCLUIR = 3

/** Promedia SOLO sobre los que traen el dato. Devuelve null si no lo trae ninguno. */
function mediaDe(pubs: Publicacion[], saca: (p: Publicacion) => number | null | undefined): number | null {
  const xs = pubs.map(saca).filter((x): x is number => typeof x === "number" && Number.isFinite(x))
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

const red1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
const red2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)

/** Una tasa sobre el alcance, en %. Solo cuenta los videos que traen alcance. */
function porAlcance(pubs: Publicacion[], saca: (p: Publicacion) => number): number | null {
  const conAlcance = pubs.filter((p) => typeof p.alcance === "number" && p.alcance > 0)
  if (!conAlcance.length) return null
  const total = conAlcance.reduce((a, p) => a + saca(p), 0)
  const alcance = conAlcance.reduce((a, p) => a + (p.alcance as number), 0)
  return alcance ? (total / alcance) * 100 : null
}

export function resumirPorFormato(
  pubs: Publicacion[],
  formatos: { id: string; nombre: string }[],
): ResumenFormato[] {
  return formatos
    .map((f) => {
      const propias = pubs.filter((p) => p.formatoId === f.id)
      const vistas = propias.reduce((a, p) => a + p.vistas, 0)
      const seguidores = propias.reduce((a, p) => a + p.seguidores, 0)
      return {
        formatoId: f.id,
        nombre: f.nombre,
        videos: propias.length,
        vistas,
        vistasMedia: propias.length ? Math.round(vistas / propias.length) : 0,
        ctrMedio: red1(mediaDe(propias, (p) => p.ctr)),
        duracionMedia: red1(mediaDe(propias, (p) => p.duracionMedia)),
        retencionMedia: red1(mediaDe(propias, (p) => p.retencion)),
        enviosPorAlcance: red2(porAlcance(propias, (p) => p.compartidos)),
        likesPorAlcance: red2(porAlcance(propias, (p) => p.likes)),
        seguidoresPorMil: vistas ? Math.round((seguidores / vistas) * 1000 * 10) / 10 : null,
        suficiente: propias.length >= MINIMO_PARA_CONCLUIR,
      }
    })
    // Se ordena por retención y no por vistas: las vistas dependen de cuánto
    // te empujó la red ese día; el porcentaje visto depende del video.
    .sort((a, b) => (b.retencionMedia ?? -1) - (a.retencionMedia ?? -1) || b.vistasMedia - a.vistasMedia)
}

export type Totales = {
  videos: number
  vistas: number
  seguidores: number
  ctrMedio: number | null
  duracionMedia: number | null
  retencionMedia: number | null
  enviosPorAlcance: number | null
  likesPorAlcance: number | null
  formatosProbados: number
  formatosConDatos: number
}

export function totales(pubs: Publicacion[], resumen: ResumenFormato[]): Totales {
  return {
    videos: pubs.length,
    vistas: pubs.reduce((a, p) => a + p.vistas, 0),
    seguidores: pubs.reduce((a, p) => a + p.seguidores, 0),
    ctrMedio: red1(mediaDe(pubs, (p) => p.ctr)),
    duracionMedia: red1(mediaDe(pubs, (p) => p.duracionMedia)),
    retencionMedia: red1(mediaDe(pubs, (p) => p.retencion)),
    enviosPorAlcance: red2(porAlcance(pubs, (p) => p.compartidos)),
    likesPorAlcance: red2(porAlcance(pubs, (p) => p.likes)),
    formatosProbados: resumen.filter((r) => r.videos > 0).length,
    formatosConDatos: resumen.filter((r) => r.suficiente).length,
  }
}

// ──────────────────────────────────────────────────────────────
// EL BANCO DE GANCHOS
//
// Los tres primeros segundos de cada video, con la retención que sacaron. El
// manual dice que ahí se decide todo; esto convierte esa creencia en algo que
// se puede mirar. Ordenados por retención: arriba, lo que de verdad retuvo.
// ──────────────────────────────────────────────────────────────

export type Gancho = {
  texto: string
  retencion: number | null
  formatoId: string
  titulo: string
  red: string
  fecha: string
}

export function ganchos(pubs: Publicacion[]): Gancho[] {
  return pubs
    .filter((p) => (p.gancho ?? "").trim())
    .map((p) => ({
      texto: (p.gancho as string).trim(),
      retencion: p.retencion,
      formatoId: p.formatoId,
      titulo: p.titulo,
      red: p.red,
      fecha: p.fecha,
    }))
    .sort((a, b) => (b.retencion ?? -1) - (a.retencion ?? -1))
}

/**
 * La lectura en una frase. Devuelve null cuando todavía no hay con qué
 * concluir: decir "el formato 5 es el mejor" con un solo video es
 * exactamente el humo que este proyecto dice no tener.
 */
export function lectura(resumen: ResumenFormato[]): string | null {
  const solidos = resumen.filter((r) => r.suficiente)
  if (solidos.length < 2) return null

  // Se compara por retención, que es lo que las redes dicen que miran. Si
  // todavía nadie la reporta, se cae a vistas por video, que es lo que hay.
  const conRet = solidos.filter((r) => r.retencionMedia !== null)
  if (conRet.length >= 2) {
    const mejor = conRet[0]
    const peor = conRet[conRet.length - 1]
    const dif = Math.round(((mejor.retencionMedia as number) - (peor.retencionMedia as number)) * 10) / 10
    if (dif < 3) {
      return `Con ${conRet.length} formatos medidos, ninguno se despega: entre el mejor y el peor hay ${dif} puntos de retención. Todavía no hay un ganador claro.`
    }
    return `«${mejor.nombre}» retiene ${dif} puntos más que «${peor.nombre}» (${mejor.retencionMedia}% contra ${peor.retencionMedia}%). Si hay que elegir dónde poner el esfuerzo, va ahí.`
  }

  const mejor = solidos[0]
  const peor = solidos[solidos.length - 1]
  if (!peor.vistasMedia) return null
  const veces = Math.round((mejor.vistasMedia / peor.vistasMedia) * 10) / 10
  if (veces < 1.3) {
    return `Con ${solidos.length} formatos medidos, ninguno se despega: el mejor hace ${veces}× el peor. Todavía no hay un ganador claro. (Falta cargar la retención, que es lo que de verdad miran las redes.)`
  }
  return `«${mejor.nombre}» rinde ${veces}× más vistas por video que «${peor.nombre}». Falta cargar la retención para confirmarlo: es lo que las redes dicen que miran.`
}

export const formatearNumero = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n)

/** Segundos a "1:23" o "45s". */
export const formatearDuracion = (s: number | null) =>
  s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)}s`
