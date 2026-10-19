// ──────────────────────────────────────────────────────────────
// LAS PREGUNTAS ABIERTAS
//
// El método de Kev: una pregunta, y mínimo veinte respuestas. El número no es
// decoración. Las primeras cinco ya las sabías antes de sentarte; las que
// sirven aparecen cuando se acaba lo obvio y hay que seguir escribiendo. Por
// eso la meta es parte del dato y la página cuenta en voz alta.
//
// Cada respuesta se marca como hecha. Un ejercicio que termina en una lista
// bonita y no en algo hecho es pasatiempo.
// ──────────────────────────────────────────────────────────────

export type Respuesta = { texto: string; hecha?: boolean }

export type Pregunta = {
  id: string
  pregunta: string
  /** Cuántas respuestas hay que dar antes de parar. */
  meta: number
  /** Para cuándo. Texto libre: "hoy", "5 días", "este mes". */
  plazo: string
  creada: string
  respuestas: Respuesta[]
}

export type Tablero = { preguntas: Pregunta[] }

export const META_POR_DEFECTO = 20

// ── Los tramos ──
// La única razón de pedir veinte es llegar al tercer tramo. Nombrarlos en
// pantalla recuerda, mientras escribes, que parar en la ocho es parar antes.
export const TRAMOS = [
  { desde: 0, nombre: "Lo obvio", nota: "Esto ya lo sabías antes de sentarte." },
  { desde: 5, nombre: "Donde deja de ser obvio", nota: "Aquí empiezas a pensar de verdad." },
  { desde: 12, nombre: "Donde está lo que nadie dijo", nota: "Por esto se piden veinte." },
] as const

export function tramoDe(i: number) {
  return [...TRAMOS].reverse().find((t) => i >= t.desde) ?? TRAMOS[0]
}

export function hechas(p: Pregunta) {
  return p.respuestas.filter((r) => r.hecha && r.texto.trim()).length
}

/** Respuestas que cuentan: las vacías no son respuestas. */
export function llenas(p: Pregunta) {
  return p.respuestas.filter((r) => r.texto.trim()).length
}

export function nuevaPregunta(pregunta = ""): Pregunta {
  return {
    id: `p${Date.now().toString(36)}`,
    pregunta,
    meta: META_POR_DEFECTO,
    plazo: "",
    creada: new Date().toISOString().slice(0, 10),
    respuestas: [{ texto: "" }],
  }
}

// ── Comprobación de forma ──
// Se revisa entero antes de tocar la base. Un tablero a medias guardado
// encima del bueno es peor que un error.
const texto = (v: unknown) => typeof v === "string"

function preguntaValida(x: unknown): x is Pregunta {
  if (!x || typeof x !== "object") return false
  const p = x as Record<string, unknown>
  if (!["id", "pregunta", "plazo", "creada"].every((k) => texto(p[k]))) return false
  if (typeof p.meta !== "number" || !Number.isFinite(p.meta) || p.meta < 1) return false
  if (!Array.isArray(p.respuestas)) return false
  return p.respuestas.every((r) => {
    if (!r || typeof r !== "object") return false
    const o = r as Record<string, unknown>
    return texto(o.texto) && (o.hecha === undefined || typeof o.hecha === "boolean")
  })
}

export function valido(x: unknown): x is Tablero {
  if (!x || typeof x !== "object") return false
  const t = x as Record<string, unknown>
  return Array.isArray(t.preguntas) && t.preguntas.every(preguntaValida)
}

// ── Semilla ──
// Las de dinero, con sus propias respuestas y su propio estado (lo que ya
// escribió está marcado como hecho). Las del reto NO están aquí: viven en la
// sección "Las preguntas" del manual, que es donde Kev las pidió.
export function semilla(): Tablero {
  return {
    preguntas: [
      {
        id: "dinero-hoy",
        pregunta: "¿Cómo consigo hoy los 110.000?",
        meta: META_POR_DEFECTO,
        plazo: "hoy",
        creada: "2026-10-19",
        respuestas: [
          { texto: "Firmar con Dardo (9 mil USD)" },
          { texto: "Escribir mensaje claro y directo para Wilson Morales" },
          { texto: "Pedir 20 mil a 5 personas diferentes" },
          { texto: "Pedir 10 mil a 10 personas diferentes" },
          { texto: "Pedir 5 mil a 20 personas diferentes" },
          { texto: "Escribirle a Fernando", hecha: true },
          { texto: "Escribir a Jhonny", hecha: true },
          { texto: "Escribirle un mensaje directo al grano a Alex", hecha: true },
          { texto: "Escribirle a Santiago, por 50 mil", hecha: true },
          { texto: "Pedirle inversión a Yovanka de forma estratégica" },
          { texto: "Pedirle ayuda a Andrés Tejada (estructura e inversión)" },
        ],
      },
      {
        id: "dinero-5-dias",
        pregunta: "¿Cómo consigo 20.000 – 30.000 USD en 5 días?",
        meta: META_POR_DEFECTO,
        plazo: "5 días",
        creada: "2026-10-19",
        respuestas: [
          { texto: "Hablar con Fernando. A la espera de reunión", hecha: true },
          { texto: "Pensar en juntar o unir cosas" },
        ],
      },
    ],
  }
}
