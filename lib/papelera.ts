// ──────────────────────────────────────────────────────────────
// LA PAPELERA DEL MANUAL
//
// Kev borró una fortaleza sin querer, y "Deshacer" no la alcanzaba: solo
// recuerda lo hecho desde que se abrió la página. La base sí la tiene — cada
// guardado deja una copia en branding_historial — pero recuperar una versión
// entera desharía todo lo que se escribió después.
//
// Así que se compara cada versión vieja con la de hoy y se sacan solo los
// RENGLONES que ya no están. Cada uno se devuelve a su lugar, solo, sin tocar
// lo demás.
// ──────────────────────────────────────────────────────────────

export type Borrado = {
  /** Camino hasta la lista donde estaba: ["personaje","fortalezas"]. */
  ruta: (string | number)[]
  /** Dónde estaba dentro de la lista. Se vuelve a poner ahí, o al final. */
  indice: number
  /** Lo que había: un texto, o un objeto entero (un principio, un formato). */
  valor: unknown
  /** Lo que se le muestra a Kev. */
  texto: string
  /** La última vez que estuvo guardado. */
  visto: string
}

// Lo que no es contenido del manual, o tiene su propio lugar.
const IGNORAR = new Set(["meta", "lienzo", "preguntas"])

const clave = (o: unknown): string | null => {
  if (!o || typeof o !== "object") return null
  const x = o as Record<string, unknown>
  for (const k of ["titulo", "nombre", "paso", "pregunta"]) if (typeof x[k] === "string" && x[k]) return x[k] as string
  return null
}

// Con guardado automático, la base guarda también los pasos intermedios de
// escribir ("Seguridad al hab", "Seguridad al habla"…). Un texto viejo que es
// el principio de uno de hoy — o al revés — no se borró: se siguió escribiendo.
const parecido = (a: string, b: string) => {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase()
  return x === y || x.startsWith(y) || y.startsWith(x)
}

function comparar(viejo: unknown, hoy: unknown, ruta: (string | number)[], visto: string, salida: Borrado[]) {
  if (Array.isArray(viejo) && Array.isArray(hoy)) {
    if (viejo.every((v) => typeof v === "string")) {
      viejo.forEach((v, i) => {
        const s = (v as string).trim()
        if (s.length < 3) return
        if (hoy.some((h) => typeof h === "string" && parecido(h, s))) return
        salida.push({ ruta, indice: i, valor: v, texto: s, visto })
      })
      return
    }
    viejo.forEach((v, i) => {
      const k = clave(v)
      if (!k) return
      const j = hoy.findIndex((h) => clave(h) !== null && parecido(clave(h)!, k))
      if (j === -1) salida.push({ ruta, indice: i, valor: v, texto: k, visto })
      else comparar(v, hoy[j], [...ruta, j], visto, salida)
    })
    return
  }
  if (viejo && hoy && typeof viejo === "object" && typeof hoy === "object") {
    for (const k of Object.keys(viejo as object)) {
      if (ruta.length === 0 && IGNORAR.has(k)) continue
      comparar((viejo as Record<string, unknown>)[k], (hoy as Record<string, unknown>)[k], [...ruta, k], visto, salida)
    }
  }
}

/** Lo que estuvo en alguna versión vieja y hoy no está. Las versiones van de
 *  la más nueva a la más vieja; de cada cosa queda la vez más reciente. */
export function papelera(hoy: unknown, versiones: { contenido: unknown; guardado_en: string }[]): Borrado[] {
  const todos: Borrado[] = []
  for (const v of versiones) comparar(v.contenido, hoy, [], v.guardado_en, todos)

  const unicos: Borrado[] = []
  for (const b of todos) {
    const lugar = JSON.stringify(b.ruta)
    // Ya está (de una versión más nueva), o es un paso intermedio de algo que
    // ya está: se queda el texto más largo, que es el que se terminó de escribir.
    const i = unicos.findIndex((u) => JSON.stringify(u.ruta) === lugar && parecido(u.texto, b.texto))
    if (i === -1) unicos.push(b)
    else if (b.texto.length > unicos[i].texto.length) unicos[i] = { ...b, visto: unicos[i].visto }
  }
  return unicos
}

/** Devuelve un renglón a su lista, en su lugar si todavía existe esa posición. */
export function devolver<T>(doc: T, b: Borrado): T {
  let lista: unknown = doc
  for (const paso of b.ruta) lista = (lista as Record<string | number, unknown>)?.[paso]
  if (!Array.isArray(lista)) return doc
  lista.splice(Math.min(b.indice, lista.length), 0, structuredClone(b.valor))
  return doc
}

const NOMBRES: Record<string, string> = {
  personaje: "El personaje", norte: "El norte", formatos: "Los formatos", edicion: "La edición",
  redes: "Las redes", produccion: "La producción", enCola: "Guiones e ideas", pendientes: "Pendientes",
  hoy: "Lo de hoy", futuro: "Lo que viene", fortalezas: "Fortalezas", debilidades: "Debilidades",
  oportunidades: "Oportunidades", bloques: "Bloques", reglas: "Reglas", nunca: "Nunca", detalle: "Detalle",
  beats: "Pasos", estructura: "La estructura", equipo: "Equipo",
}

/** "El personaje · Fortalezas" */
export function dondeEstaba(b: Borrado): string {
  return b.ruta.filter((p) => typeof p === "string").map((p) => NOMBRES[p as string] ?? p).join(" · ")
}
