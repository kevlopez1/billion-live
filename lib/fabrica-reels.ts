// ──────────────────────────────────────────────────────────────
// LA FÁBRICA DE REELS — /fabrica
//
// Cómo se produce cada video del reto: el flujo, las reglas, los referentes,
// la música y los ganchos. Se lee sin clave; solo Kev edita.
//
// Esto es la SEMILLA. Cuando /fabrica guarda por primera vez, la versión viva
// es la de Supabase (tabla `fabrica_reels`) y este archivo queda de respaldo.
// Todo cuelga de un objeto: lo que se guarda es exactamente esta forma.
// ──────────────────────────────────────────────────────────────

export type Paso = { titulo: string; detalle: string; kev?: boolean }
export type Retorno = { desde: number; hasta: number; etiqueta: string; punteado?: boolean }
export type Referente = {
  nombre: string
  url: string
  datos: string
  imagenes: string[]
  puntos: string[]
  paraKev: string
  /** Capturas en tira (hoja de cuadros): van a lo ancho, una debajo de otra. */
  ancho?: boolean
}
export type Nota = { id: string; texto: string; fecha: string }

export type Seccion =
  | { id: string; tipo: "flujo"; etiqueta: string; titulo: string }
  | { id: string; tipo: "lista"; etiqueta: string; titulo: string; items: string[] }
  | { id: string; tipo: "referentes"; etiqueta: string; titulo: string; refs: Referente[] }
  | { id: string; tipo: "tabla"; etiqueta: string; titulo: string; columnas: string[]; filas: string[][] }
  | { id: string; tipo: "notas"; etiqueta: string; titulo: string }

export type ContenidoFabrica = {
  titulo: string
  bajada: string
  pasos: Paso[]
  retornos: Retorno[]
  secciones: Seccion[]
  notas: Nota[]
}

export const FABRICA_ID = "kev-project-gta"

export const FABRICA_BASE: ContenidoFabrica = {
  titulo: "Fábrica de reels",
  bajada:
    "Cómo se produce cada video del reto, de la idea a las métricas. Si algo falla en la revisión, vuelve a edición. Lo que gana se repite como serie.",
  pasos: [
    { titulo: "1 · Idea ganadora", detalle: "Lo que ya funcionó: Pampeño 937K, Mansory 33K, robots 27.5K + hito de la semana" },
    { titulo: "2 · Guion", detalle: "Gancho de 0–2 s · frase de 7 palabras · un número · cierre «Firma el Mercedes»" },
    { titulo: "3 · Grabación (Kev)", detalle: "Vertical · micrófono · a cámara · tomas de apoyo propias", kev: true },
    { titulo: "4 · Edición en código", detalle: "Cortes · audio limpio · color · subtítulos · títulos · contador · música desde el hype" },
    { titulo: "5 · Revisión", detalle: "Subtítulos sincronizados · siglas · volumen · encuadre · zona segura" },
    { titulo: "6 · Aprobación de Kev", detalle: "Sí, o lista de cambios" },
    { titulo: "7 · Publicación", detalle: "TikTok · Instagram ×2 · Facebook · YouTube Shorts · RedNote" },
    { titulo: "8 · Métricas a las 48 h", detalle: "Vistas · retención a 3 s · comentarios · firmas" },
  ],
  retornos: [
    { desde: 4, hasta: 3, etiqueta: "falla" },
    { desde: 5, hasta: 3, etiqueta: "cambios" },
    { desde: 7, hasta: 0, etiqueta: "lo que gana se repite como serie" },
    { desde: 7, hasta: 1, etiqueta: "el gancho que no retiene se reescribe", punteado: true },
  ],
  secciones: [
    { id: "flujo", tipo: "flujo", etiqueta: "El flujo", titulo: "Cómo se arma cada video" },
    {
      id: "reglas",
      tipo: "lista",
      etiqueta: "Principios del reto",
      titulo: "Reglas de cada video",
      items: [
        "Cada video lleva el día y el marcador: Día N · $8,635 / $450K.",
        "En el segundo 1, un objeto a cámara: el billete de $10, el Mansory o el robot.",
        "Siempre un número en pantalla: «$450,000», «Bs 2,400».",
        "Todo real: comprobantes, clientes, contador. Nada marcado como IA.",
        "Bolivia en la historia: «desde un país quebrado».",
        "Una pregunta al final para que comenten.",
        "Gente real en cámara: clientes y desconocidos.",
        "PRIME aparece como lo que paga el Mercedes, no como anuncio.",
        "Historias de famosos (Elon, MrBeast) conectadas con el reto.",
        "Cierre fijo: «Firma el Mercedes por $10 · kevproject.world».",
        "Una vez por semana, alguien conocido de Bolivia en cámara y etiquetado. El video con Pampeño tiene 937K vistas.",
        "3 videos por día: mañana, tarde y noche. Se graba en lote cada 2 días.",
        "Se exporta siempre con la música incluida, desde su momento de más hype.",
      ],
    },
    {
      id: "mejores",
      tipo: "referentes",
      etiqueta: "Nuestros mejores videos · TikTok @1kevlopez",
      titulo: "Lo que ya funcionó",
      refs: [
        {
          nombre: "De $10 a un Mercedes Mansory (con Pampeño)",
          url: "https://www.tiktok.com/@1kevlopez/video/7671114254103170312",
          datos: "937K vistas · 19.8K likes · 813 comentarios · 1,404 compartidos · 53 s",
          imagenes: ["/fabrica/kev-pampeno-v1.jpg"],
          ancho: true,
          puntos: [
            "Pampeño en cámara y etiquetado: trae su audiencia y se comparte.",
            "Muchas tomas distintas en los primeros 20 s: $10 → Mercedes → Pampeño → empresario → robot.",
            "«450 mil dólares» grande en pantalla.",
            "Falla: sin subtítulos y títulos con estilos distintos.",
          ],
          paraKev: "Una vez por semana, alguien conocido de Bolivia en cámara.",
        },
        {
          nombre: "Los 3 anclados (Mansory 33K · Robots 27.5K · Firma 27.2K)",
          url: "https://www.tiktok.com/@1kevlopez",
          datos: "66–98 comentarios cada uno, el triple que el resto",
          imagenes: ["/fabrica/kev-mansory-v1.jpg", "/fabrica/kev-robot-v1.jpg"],
          ancho: true,
          puntos: [
            "El Mansory o el billete de $10 en el primer tramo.",
            "Caminando en la calle, cámara cerca, micrófono de solapa, la misma polera.",
            "Falla: tomas horizontales con barras negras y tomas de apoyo en un recuadro chico.",
            "Falla: sin contador y 37–40 s de duración.",
          ],
          paraKev: "Subtítulos siempre, tomas verticales a pantalla completa y 25–30 s.",
        },
      ],
    },
    {
      id: "edicion",
      tipo: "referentes",
      etiqueta: "Referentes",
      titulo: "Cómo se ve",
      refs: [
        {
          nombre: "Alex Hormozi · «How I would start over if I had $0»",
          url: "https://www.instagram.com/reel/DfFZ_AYIMTO/",
          datos: "33K likes · 8.2K comentarios",
          imagenes: ["/fabrica/hormozi-explicador-v1.jpg"],
          ancho: true,
          puntos: [
            "Título en cajas de color, letra blanca en mayúsculas.",
            "Esquema gráfico encima de él en el primer cuadro.",
            "Pantallas completas de color plano con títulos, íconos y recortes de su foto.",
            "«Comenta MAP»: 8.2K comentarios.",
          ],
          paraKev: "Formato «explicador» para PRIME y el reto, con nuestros colores: fondo negro, cajas azul #0a8cfa, acento celeste #18b8fc, letra Archivo 900 + Comfortaa 300. Cierre: «Comenta FIRMA y te mando el link».",
        },
        {
          nombre: "Iman Gadzhi",
          url: "https://www.tiktok.com/@imangadzhi/video/7379007289941937441",
          datos: "11.6M vistas · 564K seguidores en TikTok · 6.31M en YouTube",
          imagenes: ["/fabrica/iman-a-v1.jpg", "/fabrica/iman-b-v1.jpg"],
          puntos: [
            "Etiqueta de precio en el primer cuadro: «$450,000 Maybach».",
            "Vlog sin guion en lugares de lujo: se ve como la vida real.",
            "Subtítulos cortos en mayúsculas de 2–3 palabras.",
          ],
          paraKev: "Etiqueta «Mercedes Mansory · $450,000» en el primer cuadro.",
        },
      ],
    },
    {
      id: "guion",
      tipo: "referentes",
      etiqueta: "Creadores (no son referentes)",
      titulo: "Qué les funciona a otros creadores",
      refs: [
        {
          nombre: "@herlan.mita",
          url: "https://www.tiktok.com/@herlan.mita/video/7699714478308461832",
          datos: "«Día 1 | $1.000.000 en 90 días» · Santa Cruz, Bolivia",
          imagenes: ["/fabrica/herlan-a-v1.jpg", "/fabrica/herlan-b-v1.jpg"],
          puntos: [
            "Serie con número de día y plazo cerrado.",
            "Pasa de una obra de ladrillo a un local terminado: el lugar cuenta el progreso.",
            "TikTok lo marca como «Generado por IA».",
          ],
          paraKev: "Contador de días y plazo visible, con comprobantes reales y una meta física: el auto.",
        },
        {
          nombre: "@eugeoller",
          url: "https://www.tiktok.com/@eugeoller/video/7157373089163021574",
          datos: "13.4M vistas · «La dura decisión de Shaquille O'Neal»",
          imagenes: ["/fabrica/euge-a-v1.jpg", "/fabrica/euge-b-v1.jpg"],
          puntos: [
            "«¿Sabías que…?» + un famoso con la palabra clave resaltada.",
            "Una imagen de apoyo a pantalla completa por cada frase.",
            "Se guarda porque enseña.",
          ],
          paraKev: "Serie «Lo que aprendí de…» conectada con el reto.",
        },
        {
          nombre: "@gonzalogovinden",
          url: "https://www.tiktok.com/@gonzalogovinden/video/7598287157450640696",
          datos: "70.6K likes · 701 compartidos · «¿Y tú, hubieras aceptado por $20K?»",
          imagenes: ["/fabrica/govinden-a-v1.jpg", "/fabrica/govinden-b-v1.jpg"],
          puntos: ["Arranca en plena acción con un desconocido.", "La oferta en dinero en pantalla.", "Pregunta directa al espectador."],
          paraKev: "Retos en la calle: «¿Firmarías el Mercedes por $10?».",
        },
        {
          nombre: "@colbyhom",
          url: "https://www.tiktok.com/@colbyhom/video/7503270238188784927",
          datos: "«I turned a penny into a Lamborghini» · 22 s",
          imagenes: ["/fabrica/colby-a-v1.jpg", "/fabrica/colby-b-v1.jpg"],
          puntos: ["El centavo pegado a la lente en el primer cuadro.", "Subtítulos de una palabra.", "Cada intercambio es un objeto nuevo."],
          paraKev: "Resumen de 20 s: $10 → primer cliente → $1K → $5K → hoy.",
        },
      ],
    },
    {
      id: "musica",
      tipo: "tabla",
      etiqueta: "Música",
      titulo: "Canciones y su momento hype",
      columnas: ["Canción", "Artista", "Para qué", "Hype"],
      filas: [
        ["Band4Band", "Central Cee, Lil Baby", "Gancho del Mansory, retos en la calle", "1:00"],
        ["Wake Up in the Sky", "Gucci Mane, Bruno Mars, Kodak Black", "Vlog del día, eventos", "0:08 (verificar)"],
        ["Life Is Good", "Future, Drake", "Hitos, antes y después", "1:36"],
        ["Last Breath", "Future", "Días difíciles", "0:41"],
        ["Niagara Falls", "Metro Boomin, Travis Scott, 21 Savage", "Resumen, cuenta regresiva", "0:15"],
        ["Mask Off", "Future", "Contador subiendo, comprobantes", "1:30 (verificar)"],
        ["Money In The Grave", "Drake, Rick Ross", "Ventas cerradas", "0:23"],
        ["All The Stars", "Kendrick Lamar, SZA", "La meta: EE.UU., Dubái", "0:35"],
        ["Flashing Lights", "Kanye West", "Autos de noche", "0:19"],
        ["Superhero", "Metro Boomin, Future, Chris Brown", "Robots, lanzamientos", "0:33"],
        ["HIGHEST IN THE ROOM", "Travis Scott", "Noches de trabajo", "0:11"],
      ],
    },
    {
      id: "ganchos",
      tipo: "lista",
      etiqueta: "Ganchos",
      titulo: "30 ganchos para grabar",
      items: [
        "«Con este billete de $10 me voy a comprar un Mercedes de $450 mil.»",
        "«Llevo $8,635. Me faltan $441,365.»",
        "«Todos se rieron cuando dije que iba a comprar un Mansory con $10.»",
        "«Día 1: $10. Día [N]: $[monto]. Así lo hice.»",
        "«Si pierdo este reto, lo pierdo en público.»",
        "«Esto es lo que gané hoy, sin mentir.»",
        "«Me quedan [N] días para romper el récord.»",
        "«Desde un país quebrado voy a comprar el auto más caro de Bolivia.»",
        "«En Bolivia te dicen que es imposible. Mira esto.»",
        "«Tres negocios que nunca debes abrir en Bolivia.»",
        "«¿Qué tan quebrada está Bolivia? Te lo muestro con números.»",
        "«Le pregunté a [conocido de Santa Cruz] cómo hizo su primer millón.»",
        "«Si eres de Santa Cruz, este video es para ti.»",
        "«Esta IA me está pagando el Mercedes.»",
        "«Un negocio de Santa Cruz no contrató a nadie. Contrató esto.»",
        "«Esta IA atendió a [N] clientes mientras yo dormía.»",
        "«Seremos los primeros en traer robots humanoides a Bolivia.»",
        "«Le cobré $[monto] a un negocio por algo que hace una IA en 5 minutos.»",
        "«Te doy $10 si me dices qué es esto.»",
        "«¿Firmarías un Mercedes por $10?»",
        "«Le ofrecí un empleado de IA gratis a esta tienda. Mira lo que pasó.»",
        "«Entré a cerrar un trato con solo un QR.»",
        "«Por esto no me compro un iPhone 17 Pro Max.»",
        "«No me cambio de polera. Y es a propósito.»",
        "«Dejé de trabajar por plata. Ahora trabajo por esto.»",
        "«Si ganas en bolivianos, estás perdiendo.»",
        "«¿Sabías que Elon Musk durmió en su oficina para no quebrar?»",
        "«MrBeast perdió plata en su primer negocio. Yo voy por el mismo camino.»",
        "«La jugada de Mansory que nadie te cuenta.»",
        "«Si llego a la meta, tu nombre va grabado en este auto.»",
      ],
    },
    { id: "notas", tipo: "notas", etiqueta: "Notas", titulo: "Notas de Kev" },
  ],
  notas: [],
}

// ── Validación: lo único que entra a la base pasa por aquí ──
const txt = (v: unknown) => typeof v === "string"
const txts = (v: unknown) => Array.isArray(v) && v.every(txt)
const n = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0

function refValido(r: unknown): boolean {
  const x = r as Record<string, unknown>
  return !!x && txt(x.nombre) && txt(x.url) && txt(x.datos) && txts(x.imagenes) && txts(x.puntos) && txt(x.paraKev)
}

function seccionValida(s: unknown): boolean {
  const x = s as Record<string, unknown>
  if (!x || !txt(x.id) || !txt(x.etiqueta) || !txt(x.titulo)) return false
  switch (x.tipo) {
    case "flujo":
    case "notas":
      return true
    case "lista":
      return txts(x.items)
    case "referentes":
      return Array.isArray(x.refs) && x.refs.every(refValido)
    case "tabla":
      return txts(x.columnas) && Array.isArray(x.filas) && x.filas.every(txts)
    default:
      return false
  }
}

export function fabricaValida(c: unknown): c is ContenidoFabrica {
  const x = c as Record<string, unknown>
  if (!x || typeof x !== "object" || !txt(x.titulo) || !txt(x.bajada)) return false
  if (!Array.isArray(x.pasos) || !x.pasos.every((p) => { const q = p as Record<string, unknown>; return q && txt(q.titulo) && txt(q.detalle) })) return false
  const total = x.pasos.length
  if (!Array.isArray(x.retornos) || !x.retornos.every((r) => { const q = r as Record<string, unknown>; return q && n(q.desde) && n(q.hasta) && (q.desde as number) < total && (q.hasta as number) < total && txt(q.etiqueta) })) return false
  if (!Array.isArray(x.secciones) || !x.secciones.every(seccionValida)) return false
  if (!Array.isArray(x.notas) || !x.notas.every((v) => { const q = v as Record<string, unknown>; return q && txt(q.id) && txt(q.texto) && txt(q.fecha) })) return false
  return JSON.stringify(c).length < 500_000
}
