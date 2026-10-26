// ──────────────────────────────────────────────────────────────
// LA REVISIÓN DE LA IA — tipos compartidos
//
// La API y el panel hablan de lo mismo, así que la forma vive en un solo
// archivo. `seccion` es la clave de una sección real del manual: por eso es
// una lista cerrada y no texto libre — es lo que permite que un hallazgo
// lleve de un clic al bloque del que habla.
// ──────────────────────────────────────────────────────────────

export const SECCIONES = [
  "meta", "personaje", "norte", "formatos", "edicion",
  "redes", "produccion", "enCola", "pendientes", "hoy", "futuro",
] as const

export type Seccion = (typeof SECCIONES)[number]

export const TIPOS = ["contradiccion", "hueco", "riesgo", "mejora"] as const
export type Tipo = (typeof TIPOS)[number]

export const GRAVEDADES = ["alta", "media", "baja"] as const
export type Gravedad = (typeof GRAVEDADES)[number]

export type Hallazgo = {
  tipo: Tipo
  seccion: Seccion
  titulo: string
  detalle: string
  accion: string
  gravedad: Gravedad
}

export type Revision = {
  resumen: string
  hallazgos: Hallazgo[]
}

export const ETIQUETA_TIPO: Record<Tipo, string> = {
  contradiccion: "Se contradice",
  hueco: "Falta",
  riesgo: "Riesgo",
  mejora: "Se puede mejorar",
}

export const ETIQUETA_SECCION: Record<Seccion, string> = {
  meta: "Portada",
  personaje: "El personaje",
  norte: "El norte",
  formatos: "Los formatos",
  edicion: "La edición",
  redes: "Las redes",
  produccion: "La producción",
  enCola: "Guiones e ideas",
  pendientes: "Pendientes",
  hoy: "Lo de hoy",
  futuro: "Lo que viene",
}

// El emoji de cada sección. Vivía copiado en dos archivos (el mapa y el árbol),
// que es como empiezan a divergir: se agrega una sección y aparece con icono en
// un lado y sin él en el otro.
export const ICONO_SECCION: Record<Seccion, string> = {
  meta: "🏁", personaje: "👤", norte: "🧭", formatos: "🎬", edicion: "✂️",
  redes: "📡", produccion: "👕", enCola: "🎯", pendientes: "📌", hoy: "✨", futuro: "📈",
}

// Alta primero: si solo lee tres, que sean las tres que importan.
export const ORDEN_GRAVEDAD: Record<Gravedad, number> = { alta: 0, media: 1, baja: 2 }

export function ordenar(hallazgos: Hallazgo[]): Hallazgo[] {
  return [...hallazgos].sort((a, b) => ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad])
}

// A qué sección del documento salta un hallazgo. Las claves del manual y los
// anclajes de la página no se llaman igual (`redes` se muestra como
// "Distribución", y `pendientes` vive dentro de "En cola"), así que la
// traducción va escrita en un solo lugar en vez de adivinarse en cada clic.
export const ANCLA: Record<Seccion, string> = {
  meta: "personaje",
  personaje: "personaje",
  norte: "norte",
  formatos: "formatos",
  edicion: "edicion",
  redes: "distribucion",
  produccion: "produccion",
  enCola: "cola",
  pendientes: "cola",
  hoy: "hoy",
  futuro: "futuro",
}
