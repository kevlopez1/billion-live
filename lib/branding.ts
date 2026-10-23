// ──────────────────────────────────────────────────────────────
// EL MANUAL DE MARCA Y CONTENIDO — KEV PROJECT GTA
//
// Esto es la SEMILLA: el contenido con el que nace el panel y al que vuelve
// si la base de datos no responde. Una vez que /branding guarda por primera
// vez, la versión viva es la de Supabase (tabla `branding`) y este archivo
// queda solo como respaldo.
//
// Por eso todo cuelga de un único objeto: lo que se guarda en la base es
// exactamente esta forma, en una columna jsonb. Un campo nuevo aquí es un
// campo nuevo allá, sin migración.
// ──────────────────────────────────────────────────────────────

import type { Pregunta } from "@/lib/preguntas"
import type { Trazo } from "@/lib/proyectos"

/** Lo que Kev hace SOBRE el diagrama, que no es parte del manual pero sí de
 *  cómo lo mira: dónde puso cada sección, cuáles resaltó, cuáles marcó para
 *  saltar y qué dibujó encima. Va por sección y no por renglón: la clave de
 *  una sección es estable, la de un renglón es su posición en la lista y se
 *  movería sola al reordenar. */
export type Lienzo = {
  pos?: Record<string, { x: number; y: number }>
  tinta?: Record<string, number>
  fav?: string[]
  trazos?: Trazo[]
}

export type Estado = "usamos" | "pendiente" | "no"

export type Beat = { paso: string; ejemplo?: string }
export type Formato = { id: string; nombre: string; para: string; beats: Beat[] }
export type Principio = { titulo: string; cuerpo: string; detalle: string[] }
// ── Un rodaje, N salidas ──
// Qué pieza sale de un mismo rodaje para cada red. Sin esto, "estar en 10
// redes" es una intención; con esto es una lista de entregables.
export type Salida = { pieza: string; duracion: string; relacion: string }
export type Red = { nombre: string; estado: Estado; nota?: string; salida?: Salida }

// ── La línea de producción ──
// Una fábrica tiene estaciones. Un video no está "en cola" o "publicado": pasa
// por cinco estados, y saber en cuál está es lo que permite ver dónde se
// atasca el trabajo.
export const ETAPAS = ["idea", "guion", "grabado", "editado", "publicado"] as const
export type Etapa = (typeof ETAPAS)[number]

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  idea: "Idea",
  guion: "Guion",
  grabado: "Grabado",
  editado: "Editado",
  publicado: "Publicado",
}

export type Video = {
  titulo: string
  formato: string
  etapa?: Etapa
  /** Los tres primeros segundos, escritos antes de grabar. */
  gancho?: string
  /** Qué prueba en pantalla lleva. El manual lo exige: si se menciona un
   *  número, se muestra. */
  prueba?: string
}
export type Lectura = { titulo: string; cuerpo: string }
export type BloqueEdicion = { titulo: string; nota: string; reglas: string[] }

export type Contenido = {
  meta: { titulo: string; proyecto: string; bajada: string }
  personaje: { nombre: string; fortalezas: string[]; debilidades: string[]; oportunidades: string[] }
  norte: Principio[]
  formatos: Formato[]
  edicion: {
    regla: string
    /** El esqueleto del video, en orden. Es una secuencia y no una lista de
     *  reglas sueltas: que el paso 1 vaya antes que el 2 es parte de la regla.
     *  Opcional para no romper documentos guardados antes de que existiera. */
    estructura?: Beat[]
    bloques: BloqueEdicion[]
    nunca: string[]
  }
  redes: Red[]
  produccion: { personaje: string[]; equipo: string[] }
  enCola: Video[]
  pendientes: string[]
  hoy: Lectura[]
  futuro: Lectura[]
  /** YA NO SE USA. Las preguntas fueron una sección del manual y ahora son un
   *  espacio aparte (lib/preguntas.ts). Se deja el campo para leer lo que se
   *  haya contestado aquí: /api/preguntas lo suma al tablero una sola vez. */
  preguntas?: Pregunta[]
  /** El estado del diagrama. Opcional: el manual se lee igual sin él. */
  lienzo?: Lienzo
}

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  usamos: "En uso",
  pendiente: "Se puede implementar",
  no: "No la usamos",
}

export const ESTADOS: Estado[] = ["usamos", "pendiente", "no"]

export const CONTENIDO_BASE: Contenido = {
  meta: {
    titulo: "Branding y contenido",
    proyecto: "KEV PROJECT GTA",
    bajada: "De $10 a un Mercedes Mansory · kevproject.world",
  },

  personaje: {
    nombre: "Kev López",
    fortalezas: [
      "Personalidad de joven ambicioso y entusiasta",
      "Gimnasio, hábitos, creencias y mentalidad",
      "Tecnología y lujo empresarial",
      "Seguridad al hablar y lenguaje corporal",
    ],
    debilidades: ["Falta de estructuración en el equipo de producción"],
    oportunidades: ["Show man en vivo 24/7"],
  },

  norte: [
    {
      titulo: "El branding es lo más importante",
      cuerpo:
        "Es lo que percibe el espectador. No solo la estética de la edición: también la forma de comunicar, de transmitir y de estructurar el contenido, sea una historia, un carrusel, un reel o un video largo 16:9. El foco va en la satisfacción del espectador, sin soltar nuestros objetivos.",
      detalle: [],
    },
    {
      titulo: "Apalancar las verdaderas ambiciones",
      cuerpo: "Distribuir PRIME en sus cuatro frentes reales.",
      detalle: ["Robotics business", "AI business", "Sistema financiero blockchain + IA", "AI agents economy"],
    },
    {
      titulo: "Países de operación de PRIME",
      cuerpo: "Dónde juega la empresa, y por lo tanto a quién le habla el contenido.",
      detalle: ["Estados Unidos", "Latinoamérica", "Emiratos Árabes Unidos", "India"],
    },
    {
      titulo: "Repetir el objetivo como algo sencillo y simple",
      cuerpo:
        "El Mercedes Mansory se menciona como SHOW, no como objetivo real: «el chico del Mansory». Primero va la ambición grande, después el objetivo secundario dentro del mismo video. Eso apalanca las ambiciones verdaderas y a la vez construye la novela.",
      detalle: [
        "Ambición: «Voy a ser la primera empresa en vender robots humanoides al grupo empresarial más grande de mi país»",
        "Objetivo secundario: «Me llamo Kevin y estoy pasando de $10 a un Mercedes Mansory desde un país quebrado, hoy tenemos $7.000»",
      ],
    },
    {
      titulo: "Que cada video sea un activo comercial, pero que no sea un anuncio",
      cuerpo:
        "El espectador responde a emociones, instintos y narrativas. Lo que se le vende es la novela completa: el proceso, la historia, el dolor, la victoria y los momentos incómodos.",
      detalle: [],
    },
    {
      titulo: "Toda narrativa apunta a dos cosas",
      cuerpo:
        "Posicionar las verdaderas ambiciones y construir el apego a la novela del personaje principal. Si un video no hace ninguna de las dos, sobra.",
      detalle: [],
    },
    {
      titulo: "Enfocar el contenido en qué va a ganar el espectador",
      cuerpo:
        "En la época del consumo masivo, el espectador busca obtener algo de cada contenido: entretenimiento, miedo, información. Si no se lleva nada, se va.",
      detalle: [],
    },
  ],

  formatos: [
    {
      id: "dopamina",
      nombre: "Simple con edición dopamínica",
      para: "Posicionar a Kev como un referente único, original y con estilo.",
      beats: [
        { paso: "Intro ambicioso e innovador", ejemplo: "Voy a ser la primera empresa en vender robots humanoides al grupo empresarial más grande de mi país." },
        { paso: "Quién es el del proceso", ejemplo: "Me llamo Kevin y estoy pasando de $10 a un Mercedes Mansory desde un país quebrado. Hoy tenemos $7.000." },
        { paso: "El objetivo y a quién beneficia", ejemplo: "Los robots humanoides son un cambio generacional en cómo los empresarios dirigen sus negocios. Con esta solución, un empresario garantiza la eficiencia y la trazabilidad de cada centavo invertido." },
        { paso: "Posicionamiento de conocimiento técnico", ejemplo: "En Estados Unidos, Elon Musk está financiando TERAFAB con 110 mil millones de dólares: un centro de producción masiva de chips para robots humanoides." },
        { paso: "CTA innovador", ejemplo: "Si eres empresario y te interesa el futuro, escríbele a mi empleado de IA y te da el catálogo de nuestros servicios." },
      ],
    },
    {
      id: "critica",
      nombre: "Crítica a favor",
      para: "Convertir el comentario malo en combustible.",
      beats: [
        { paso: "Abrir con el comentario malo", ejemplo: "Todo el mundo dice que nunca voy a llegar al Mercedes Mansory." },
        { paso: "Contradecirlo con un hecho", ejemplo: "Pero hoy firmé mi primer contrato de un robot humanoide vendido a una empresa de Estados Unidos." },
      ],
    },
    {
      id: "movimiento",
      nombre: "Movimiento (en acción)",
      para: "Probar que el proceso pasa de verdad, en el mundo real.",
      beats: [
        { paso: "Dónde estoy y qué estoy haciendo", ejemplo: "Estoy en uno de los eventos de tecnología más grandes del mundo y voy a reunirme con el organizador." },
        { paso: "Dar contexto", ejemplo: "X es el organizador de DevCon 2026, que esta gestión se organiza en India, y nos va a contar…" },
      ],
    },
    {
      id: "interno",
      nombre: "Proceso interno de la empresa en vivo",
      para: "Mostrar la trastienda. Es lo que compra un empresario.",
      beats: [
        { paso: "El día a día y las soluciones", ejemplo: "Así dirijo mi flota de agentes de inteligencia artificial para que hagan el 80% del trabajo de mi empresa." },
        { paso: "Descripción técnica, clara y al grano", ejemplo: "Este agente es 100% para transacciones: se encarga de…" },
        { paso: "Cómo lo hemos hecho para otras empresas" },
        { paso: "CTA: cómo obtener la misma solución" },
      ],
    },
    {
      id: "miedo",
      nombre: "Gancho dirigido al miedo",
      para: "Capturar en el primer segundo con un dato que incomoda.",
      beats: [
        { paso: "Un dato que da miedo, dicho de entrada", ejemplo: "Más de 450 mil empresas en Estados Unidos están cerrando sus operaciones por el impacto de la inteligencia artificial." },
      ],
    },
    {
      id: "crisis",
      nombre: "La crisis como ventaja mediática",
      para: "Montarse en lo que ya es tendencia, nacional o internacional.",
      beats: [
        { paso: "El evento mediático en tendencia", ejemplo: "Rodrigo Paz acaba de firmar algo que cambiará el rumbo de Bolivia, pero no para bien." },
        { paso: "La información, lo mejor explicada posible, con datos interesantes" },
      ],
    },
    {
      id: "lifestyle",
      nombre: "Life style",
      para: "Mostrar el logro físico sin que sea presumir.",
      beats: [{ paso: "El logro, y el giro", ejemplo: "Me compré el nuevo iPhone 18 Pro. Pero no por la razón que todo el mundo cree." }],
    },
    {
      id: "estrategico",
      nombre: "Estratégico",
      para: "No solo conocimiento: estrategia y perspicacia.",
      beats: [
        { paso: "El resultado improbable", ejemplo: "Así conseguí un cliente de $10.000 sin un solo centavo." },
        { paso: "Contexto y explicación carismática" },
      ],
    },
    {
      id: "versus",
      nombre: "Versus, comparación, antes y después",
      para: "El contraste hace el trabajo solo.",
      beats: [{ paso: "Dos estados, uno al lado del otro" }],
    },
    {
      id: "trends",
      nombre: "Trends en tendencia",
      para: "Entrar donde el alcance ya está.",
      beats: [{ paso: "El formato del momento, con la narrativa de siempre" }],
    },
  ],

  // ── La edición ──
  // Las reglas sembradas aquí NO son inventadas: salen de los principios que
  // Kev ya escribió (la edición dopamínica, el skin in the game, la varianza
  // emocional, la verificabilidad). Donde él todavía no decidió algo, el
  // bloque queda vacío a propósito — el panel es editable y se llena ahí,
  // en vez de que alguien se invente su estética.
  edicion: {
    regla:
      "Edición dopamínica pero estética, que posicione a Kev como un referente único, original y con estilo. La estética no es decoración: es la mitad del branding.",
    // Pensada para formato largo y aplicable al corto: en corto se comprime,
    // no se saltan pasos.
    estructura: [
      { paso: "Gancho inicial visual" },
      { paso: "Complementos subyacentes", ejemplo: "Marcas, información, datos" },
      {
        paso: "Representación anime cinematográfico",
        ejemplo: "El personaje representado con ejemplos claros: información, imágenes, datos",
      },
      {
        paso: "Desarrollo con el personaje con autoridad",
        ejemplo: "MacBook, lentes, reloj y buen fondo · cambios de toma constantes",
      },
      { paso: "Tutorial", ejemplo: "El personaje a un lado y la pantalla compartida al otro" },
    ],
    bloques: [
      {
        titulo: "Los tres primeros segundos",
        nota: "Deciden todo lo demás. Si el gancho no entra aquí, el resto del video no existe.",
        reglas: [
          "Se abre con la ambición grande, no con el saludo ni con el nombre",
          "El objetivo del reto va después del gancho, nunca antes",
          "Nada de intro, logo ni presentación: el primer fotograma ya es contenido",
        ],
      },
      {
        titulo: "Las pruebas en pantalla",
        nota: "Es lo que separa este contenido del de un gurú. La audiencia premia la evidencia visual inmediata.",
        reglas: [
          "Si se menciona un número, se muestra: el saldo, el comprobante, la pantalla",
          "Se graba el proceso, no el resultado: el código, el correo, la negociación",
          "El rechazo y el error también se muestran — sin filtros es lo que genera respeto",
        ],
      },
      {
        titulo: "Ritmo y cortes",
        nota: "El movimiento sostiene la atención, pero en cuanto se nota, la rompe.",
        reglas: [
          "Zoom in y zoom out constantemente, pero estratégicos y nunca bruscos",
          "Cambios de toma del personaje constantemente",
        ],
      },
      {
        titulo: "Imagen y color",
        nota: "Lo que hace que un video se reconozca como suyo antes de oír nada.",
        reglas: [
          "El personaje se representa constantemente a sí mismo como anime cinematográfico",
          "El personaje aparece con autoridad: MacBook, lentes, reloj y buen fondo",
        ],
      },
      {
        titulo: "El personaje en cámara",
        nota: "No es edición: es lo que tiene que pasar mientras se graba. Ninguna edición lo arregla después.",
        reglas: [
          "Lenguaje corporal notable",
          "Seguridad notable",
          "Conocimiento notable sobre el tema que está tocando",
        ],
      },
      {
        titulo: "Texto en pantalla",
        nota: "Sin definir. Aquí van tipografía, posición y cuánto dura cada rótulo.",
        reglas: [],
      },
      {
        titulo: "Sonido",
        nota: "Sin definir. Aquí van la música, los efectos y dónde va el silencio.",
        reglas: [],
      },
    ],
    nunca: [
      "Que parezca un anuncio. Cada video es un activo comercial, pero no se ve como publicidad",
      "Éxito constante y plano: sin momentos incómodos, el video aburre y la gente se va",
      "Material ultraproducido que parezca generado: la imperfección humana visible es lo que da credibilidad",
      "Prometer un resultado sin mostrar la prueba en la misma pieza",
    ],
  },

  redes: [
    { nombre: "YouTube Shorts", estado: "usamos" },
    { nombre: "TikTok", estado: "usamos" },
    { nombre: "Facebook", estado: "usamos", nota: "Solo video, no imágenes" },
    { nombre: "Instagram", estado: "usamos", nota: "Solo video, no imágenes" },
    { nombre: "X (Twitter)", estado: "usamos", nota: "Solo video, no imágenes" },
    { nombre: "YouTube largo", estado: "no", nota: "No tenemos formato largo" },
    { nombre: "LinkedIn", estado: "no" },
    { nombre: "Bilibili", estado: "no" },
    { nombre: "RedNote", estado: "pendiente", nota: "El formato short se implementa rápido" },
    { nombre: "WeChat", estado: "pendiente", nota: "El formato short se implementa rápido" },
    { nombre: "Moj (India)", estado: "pendiente", nota: "El formato short se implementa rápido" },
    { nombre: "Reddit", estado: "pendiente", nota: "Short e imagen, se implementa rápido" },
    { nombre: "Farcaster", estado: "pendiente", nota: "Red social cripto" },
    { nombre: "Binance", estado: "pendiente", nota: "Red social de imágenes, aún no la usamos" },
  ],

  produccion: {
    personaje: [
      "2 trajes: uno negro y uno azul",
      "2 pares de zapatos: negro y azul",
      "MacBook, lentes y reloj: el kit con el que aparece en cámara",
      "Un buen fondo",
    ],
    equipo: [],
  },

  enCola: [
    { titulo: "Día uno en India", formato: "Life style" },
    { titulo: "Vamos a inundar más de 10 redes sociales a nivel mundial", formato: "Estratégico" },
  ],

  pendientes: [
    "Agregar más carisma y personalidad",
    "Investigar qué le gusta a la gente hoy y qué se lo provoca",
  ],

  hoy: [
    {
      titulo: "Contraste de estatus y choque cultural · el efecto underdog",
      cuerpo:
        "A nadie le impresiona un chico rico presumiendo dinero fácil. Lo que fascina es el abismo entre el punto de partida y la ambición: alguien saliendo de un entorno con limitaciones económicas y operando de tú a tú en escenarios globales de tecnología.",
    },
    {
      titulo: "Skin in the game · pruebas tangibles frente a discursos",
      cuerpo:
        "La audiencia premia la evidencia visual inmediata: el código del agente de IA, la pantalla con los saldos reales, el correo con el cliente, el rechazo en vivo. Ver el proceso sin filtros genera respeto; solo prometer resultados genera burla.",
    },
    {
      titulo: "Polarización calculada · el comentario como combustible",
      cuerpo:
        "Los algoritmos premian el debate en comentarios. Una afirmación contundente hace que los escépticos ataquen y los defensores respalden, y eso dispara la retención y el alcance.",
    },
    {
      titulo: "Varianza emocional · la novela completa",
      cuerpo:
        "El éxito constante aburre. La audiencia se engancha con la montaña rusa: momentos incómodos, negociaciones tensas, errores logísticos y victorias celebradas con euforia genuina.",
    },
  ],

  futuro: [
    {
      titulo: "Verificabilidad radical contra el contenido sintético",
      cuerpo:
        "Para 2028, internet estará inundado de video, texto y avatares generados por IA a costo marginal cero. La audiencia desconfiará por defecto de cualquier video ultraproducido o relato perfecto, y buscará imperfección humana visible: sudor, errores en tiempo real, entornos caóticos no simulados y pruebas documentadas en cadena o en registros bancarios públicos.",
    },
    {
      titulo: "Economía de agentes autónomos · resultados sin fricción",
      cuerpo:
        "Las empresas dejarán de comprar herramientas y software de asistencia: comprarán trabajo terminado. Buscarán flotas de agentes capaces de ejecutar flujos completos — ventas, finanzas, atención, logística — con retorno medible y supervisión humana mínima.",
    },
    {
      titulo: "Encarnación física de la tecnología · robótica humanoide",
      cuerpo:
        "La inteligencia digital pasa al mundo físico. El interés se mueve de los algoritmos en la nube a los robots humanoides y los sistemas que reemplazan tareas físicas repetitivas o peligrosas en manufactura, bodegas y servicios.",
    },
    {
      titulo: "Sistemas financieros desregulados y transfronterizos",
      cuerpo:
        "En economías con crisis monetaria o restricciones cambiarias, el empresario buscará rieles descentralizados — cripto, stablecoins, pagos máquina a máquina — para proteger su capital y liquidar al instante sin depender de la banca local.",
    },
    {
      titulo: "El arquetipo del operator-creator",
      cuerpo:
        "El público abandona al influencer de consejos y al gurú de estilo de vida estático. La atención se concentra en quien opera negocios reales frente a la cámara: negociaciones, desarrollo técnico y logística global.",
    },
  ],
}
