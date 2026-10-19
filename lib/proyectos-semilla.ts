// ──────────────────────────────────────────────────────────────
// La semilla de /kevlopez_proyectos: lo que Kev escribió (18 oct 2026) más los
// datos de eventos que se verificaron en la web.
//
// SOLO la importa el servidor (app/api/proyectos). Si la importara el
// navegador, las metas personales viajarían en el JavaScript público.
//
// Regla "todo real": lo que no se sabe NO se inventa. Va como tarea
// "Definir …" para que Kev lo llene.
// ──────────────────────────────────────────────────────────────

import { RAIZ, type Bloque, type Doc, type Estado, type Tablero, type TipoBloque } from "@/lib/proyectos"

let n = 0
const b = (t: TipoBloque, x: string, ok = false): Bloque => ({ id: `b${++n}`, t, x, ...(t === "todo" ? { ok } : {}) })
const p = (x: string) => b("p", x)
const li = (x: string) => b("li", x)
const todo = (x: string, ok = false) => b("todo", x, ok)

type Semilla = {
  id: string
  padre: string
  titulo: string
  icono: string
  estado?: Estado
  meta?: string
  plazo?: string
  bloques?: Bloque[]
}

const RAMAS: Semilla[] = [
  // 1 ─ El reto
  {
    id: "reto", padre: RAIZ, titulo: "De $10 a un Mercedes Mansory", icono: "🏎️", estado: "marcha",
    meta: "$450.000", plazo: "Récord 30 dic 2026 · límite 30 jun 2027",
    bloques: [
      p("Comprar el Mercedes Mansory con $450.000."),
      li("Día 1 del reto: 30 jun 2026."),
      li("Último dato del contador: $668 (5 jul 2026)."),
      todo("Poner aquí el número real de hoy"),
    ],
  },
  { id: "reto-contador", padre: "reto", titulo: "Contador: ganado hoy", icono: "📈", meta: "?", bloques: [todo("Definir el ganado real de hoy"), todo("Subir el contador de la web a ese número")] },
  { id: "reto-palanca", padre: "reto", titulo: "La palanca (sponsor o inversión)", icono: "🔑", bloques: [p("Con solo ahorrar no alcanza. El auto llega por una palanca."), todo("Armar la página de sponsors, con los números reales")] },
  { id: "reto-contenido", padre: "reto", titulo: "Contenido del reto", icono: "🎬", bloques: [li("2 videos de 30 s + 1 de 60 s por semana."), li("Filtro: ¿hay plata, calle o drama?"), todo("Subir la retención por encima del 70%")] },

  // 2 ─ Humanoide
  {
    id: "humanoide", padre: RAIZ, titulo: "Primer robot humanoide de PRIME", icono: "🤖",
    meta: "1 venta", plazo: "?",
    bloques: [
      p("Que PRIME venda su primer robot humanoide a una empresa o grupo de empresas."),
      todo("Definir modelo, proveedor, costo y precio de venta"),
      todo("Elegir 5 empresas que ya confían en PRIME"),
      todo("No comprar stock sin señal de pago"),
    ],
  },

  // 3 ─ LatAm
  {
    id: "latam", padre: RAIZ, titulo: "PRIME, plataforma de IA de LatAm", icono: "🌎",
    meta: "?", plazo: "?",
    bloques: [
      p("Que PRIME se establezca fuertemente como plataforma de IA para empresas y domine el mercado de LatAm."),
      todo("Definir la meta en números: MRR y clientes"),
      todo("Elegir un nicho primero"),
    ],
  },

  // 4 ─ Compras grandes
  { id: "grandes", padre: RAIZ, titulo: "Compras grandes", icono: "💎", bloques: [p("Cosas de precio elevado.")] },
  { id: "xiaomi", padre: "grandes", titulo: "Xiaomi SU7 Ultra", icono: "🚗", meta: "$70.000", bloques: [p("Dato verificado: en China parte de unos $72.830 y no se vende en EE.UU."), todo("Confirmar que es el SU7 Ultra"), todo("Ver cómo se importaría a Bolivia")] },
  { id: "casa", padre: "grandes", titulo: "Casa + terreno + departamento", icono: "🏡", meta: "$5.000.000", bloques: [li("Terreno y tierras agrícolas."), li("Casa."), li("Departamento.")] },

  // 5 ─ Compras pequeñas
  { id: "chicas", padre: RAIZ, titulo: "Compras pequeñas", icono: "🛍️", bloques: [p("Cosas de precio bajo.")] },
  { id: "iphone", padre: "chicas", titulo: "iPhone 18 Pro Max", icono: "📱", meta: "$1.900" },
  { id: "airpods", padre: "chicas", titulo: "AirPods", icono: "🎧", meta: "$350" },
  { id: "vr", padre: "chicas", titulo: "Lentes de realidad virtual", icono: "🥽", meta: "?", bloques: [todo("Elegir el modelo y poner el precio")] },
  { id: "reloj", padre: "chicas", titulo: "Reloj que controle toda mi salud", icono: "⌚", meta: "?", bloques: [todo("Elegir el modelo y poner el precio")] },

  // 6 ─ Viajes
  { id: "viajes", padre: RAIZ, titulo: "Eventos y viajes", icono: "✈️", bloques: [p("Viajes importantes a eventos que hay que pagar.")] },
  {
    id: "devcon", padre: "viajes", titulo: "Devcon 2026", icono: "🌐", estado: "marcha", meta: "≈ $3.700", plazo: "3–6 nov 2026 · Mumbai",
    bloques: [
      p("Urgente."),
      li("La entrada general sale entre $499 y $1.199 según la ola de venta."),
      li("El resto del presupuesto es vuelo y hotel."),
      todo("Decidir si vas, antes del 20 oct"),
      todo("Lista de 20 personas a conocer"),
    ],
  },
  {
    id: "gitex", padre: "viajes", titulo: "GITEX 2026", icono: "🏙️", estado: "marcha", meta: "?", plazo: "7–11 dic 2026 · Dubái",
    bloques: [p("Urgente."), todo("Definir el presupuesto (vuelo, hotel, entrada)"), todo("Decidir si vas, antes del 15 nov")],
  },

  // 7 ─ Palancas
  {
    id: "palancas", padre: RAIZ, titulo: "Lo que se puede hacer", icono: "🧠",
    bloques: [p("Lo que veo que se puede hacer.")],
  },
  { id: "pal-ia", padre: "palancas", titulo: "Todo lo online se construye con IA", icono: "⚙️", bloques: [p("En algunos casos hay permisos y reglas que cumplir, pero se puede hacer.")] },
  { id: "pal-kev", padre: "palancas", titulo: "Vitalizar al personaje Kev López", icono: "🎥", bloques: [p("Que crezca el personaje y, con él, salgan negocios paralelos.")] },
  { id: "pal-inv", padre: "palancas", titulo: "Conseguir la mayor cantidad de inversores", icono: "🤝", bloques: [todo("Definir la meta: cuántos y de cuánto")] },
  { id: "pal-4", padre: "palancas", titulo: "Punto 4 (pendiente)", icono: "✍️", bloques: [p("El mensaje original quedó cortado en el punto 4."), todo("Escribir aquí el punto 4")] },
]

export function semillaDoc(): Doc {
  n = 0
  return {
    v: 1,
    nodos: [
      {
        id: RAIZ, padre: null, titulo: "Kev López", icono: "🧭", estado: "marcha", meta: "", plazo: "",
        bloques: [
          p("Primero el número exacto, después lo que tenemos hoy, y recién entonces el plan de ataque."),
          li("Concepto claro, con números exactos."),
          li("Qué tenemos a día de hoy."),
          li("Plan de ataque, al estilo Sun Tzu."),
        ],
      },
      ...RAMAS.map((r) => ({
        id: r.id,
        padre: r.padre,
        titulo: r.titulo,
        icono: r.icono,
        estado: r.estado ?? ("idea" as Estado),
        meta: r.meta ?? "",
        plazo: r.plazo ?? "",
        bloques: r.bloques ?? [b("p", "")],
      })),
    ],
  }
}

/** La semilla ya en forma de tablero: un espacio, el de siempre. */
export function semilla(): Tablero {
  return { v: 2, espacios: [{ id: "principal", doc: semillaDoc(), trazos: [] }] }
}
