// ──────────────────────────────────────────────────────────────
// LOS NÚMEROS — qué formato funciona y cuál no.
//
// El manual de /branding dice QUÉ contar y CÓMO se ve. Esto cierra el
// círculo: cada video publicado se registra con su formato y sus números, y
// el panel calcula qué formato rinde. Sin esto se publica a ciegas.
//
// Los cálculos viven aquí, aparte de la pantalla, porque son la parte que
// tiene que estar bien: un promedio mal hecho hace tomar la decisión
// equivocada durante meses.
// ──────────────────────────────────────────────────────────────

export type Publicacion = {
  id: string
  fecha: string          // ISO, el día que se publicó
  titulo: string
  formatoId: string      // enlaza con uno de los formatos del manual
  red: string
  url?: string
  vistas: number
  retencion: number | null   // % promedio visto. null si la red no lo da.
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
  retencionMedia: number | null
  interaccion: number        // (likes + comentarios + compartidos) / vistas, en %
  seguidoresPorMil: number   // seguidores ganados por cada 1.000 vistas
  suficiente: boolean        // ¿hay datos para sacar conclusiones?
}

/** Por debajo de esto, un promedio es anécdota y no evidencia. */
export const MINIMO_PARA_CONCLUIR = 3

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function resumirPorFormato(
  pubs: Publicacion[],
  formatos: { id: string; nombre: string }[],
): ResumenFormato[] {
  return formatos
    .map((f) => {
      const propias = pubs.filter((p) => p.formatoId === f.id)
      const vistas = propias.reduce((a, p) => a + p.vistas, 0)
      // La retención se promedia solo sobre los videos que la traen: contar
      // un null como 0 hundiría el promedio de una red que no la reporta.
      const conRetencion = propias.filter((p) => typeof p.retencion === "number").map((p) => p.retencion as number)
      const interacciones = propias.reduce((a, p) => a + p.likes + p.comentarios + p.compartidos, 0)
      const seguidores = propias.reduce((a, p) => a + p.seguidores, 0)
      return {
        formatoId: f.id,
        nombre: f.nombre,
        videos: propias.length,
        vistas,
        vistasMedia: propias.length ? Math.round(vistas / propias.length) : 0,
        retencionMedia: conRetencion.length ? Math.round(media(conRetencion) * 10) / 10 : null,
        interaccion: vistas ? Math.round((interacciones / vistas) * 1000) / 10 : 0,
        seguidoresPorMil: vistas ? Math.round((seguidores / vistas) * 1000 * 10) / 10 : 0,
        suficiente: propias.length >= MINIMO_PARA_CONCLUIR,
      }
    })
    .sort((a, b) => b.vistasMedia - a.vistasMedia)
}

export type Totales = {
  videos: number
  vistas: number
  seguidores: number
  interaccion: number
  formatosProbados: number
  formatosConDatos: number
}

export function totales(pubs: Publicacion[], resumen: ResumenFormato[]): Totales {
  const vistas = pubs.reduce((a, p) => a + p.vistas, 0)
  const inter = pubs.reduce((a, p) => a + p.likes + p.comentarios + p.compartidos, 0)
  return {
    videos: pubs.length,
    vistas,
    seguidores: pubs.reduce((a, p) => a + p.seguidores, 0),
    interaccion: vistas ? Math.round((inter / vistas) * 1000) / 10 : 0,
    formatosProbados: resumen.filter((r) => r.videos > 0).length,
    formatosConDatos: resumen.filter((r) => r.suficiente).length,
  }
}

/**
 * La lectura en una frase. Devuelve null cuando todavía no hay con qué
 * concluir: decir "el formato 5 es el mejor" con un solo video es
 * exactamente el humo que este proyecto dice no tener.
 */
export function lectura(resumen: ResumenFormato[]): string | null {
  const solidos = resumen.filter((r) => r.suficiente)
  if (solidos.length < 2) return null
  const mejor = solidos[0]
  const peor = solidos[solidos.length - 1]
  if (!peor.vistasMedia) return null
  const veces = Math.round((mejor.vistasMedia / peor.vistasMedia) * 10) / 10
  if (veces < 1.3) {
    return `Con ${solidos.length} formatos medidos, ninguno se despega: el mejor hace ${veces}× el peor. Todavía no hay un ganador claro.`
  }
  return `«${mejor.nombre}» rinde ${veces}× más vistas por video que «${peor.nombre}». Si hay que elegir dónde poner el esfuerzo, va ahí.`
}

export const formatearNumero = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n)
