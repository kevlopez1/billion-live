// ──────────────────────────────────────────────────────────────
// EL MANUAL DE MARCA Y CONTENIDO — KEV PROJECT GTA
//
// Esta es la fuente única de /branding. Todo lo que se ve en esa página
// sale de aquí, así que para cambiar algo se edita UN archivo y nada más.
//
// Cómo agregar cosas:
//   · un principio nuevo   → un objeto más en EL_NORTE
//   · un formato de video  → un objeto más en FORMATOS, con sus beats
//   · una red social       → un objeto más en REDES, con su estado
//   · un video en cola     → un objeto más en EN_COLA
//
// Los ejemplos son guiones de Kev. Se transcriben como los dijo, solo
// corregidos de ortografía — el contenido no se reinterpreta.
// ──────────────────────────────────────────────────────────────

export const META = {
  titulo: "Branding y contenido",
  proyecto: "KEV PROJECT GTA",
  bajada: "De $10 a un Mercedes Mansory · kevproject.world",
}

// ── El personaje ──────────────────────────────────────────────
export const PERSONAJE = {
  nombre: "Kev López",
  fortalezas: [
    "Personalidad de joven ambicioso y entusiasta",
    "Gimnasio, hábitos, creencias y mentalidad",
    "Tecnología y lujo empresarial",
    "Seguridad al hablar y lenguaje corporal",
  ],
  debilidades: ["Falta de estructuración en el equipo de producción"],
  oportunidades: ["Show man en vivo 24/7"],
}

// ── I. El norte: lo que no se negocia ─────────────────────────
export type Principio = { n: number; titulo: string; cuerpo: string; detalle?: string[] }

export const EL_NORTE: Principio[] = [
  {
    n: 1,
    titulo: "El branding es lo más importante",
    cuerpo:
      "Es lo que percibe el espectador. No solo la estética de la edición: también la forma de comunicar, de transmitir y de estructurar el contenido, sea una historia, un carrusel, un reel o un video largo 16:9. El foco va en la satisfacción del espectador, sin soltar nuestros objetivos.",
  },
  {
    n: 2,
    titulo: "Apalancar las verdaderas ambiciones",
    cuerpo: "Distribuir PRIME en sus cuatro frentes reales.",
    detalle: [
      "Robotics business",
      "AI business",
      "Sistema financiero blockchain + IA",
      "AI agents economy",
    ],
  },
  {
    n: 3,
    titulo: "Países de operación de PRIME",
    cuerpo: "Dónde juega la empresa, y por lo tanto a quién le habla el contenido.",
    detalle: ["Estados Unidos", "Latinoamérica", "Emiratos Árabes Unidos", "India"],
  },
  {
    n: 4,
    titulo: "Repetir el objetivo como algo sencillo y simple",
    cuerpo:
      "El Mercedes Mansory se menciona como SHOW, no como objetivo real: «el chico del Mansory». Primero va la ambición grande, después el objetivo secundario dentro del mismo video. Eso apalanca las ambiciones verdaderas y a la vez construye la novela.",
    detalle: [
      "Ambición: «Voy a ser la primera empresa en vender robots humanoides al grupo empresarial más grande de mi país»",
      "Objetivo secundario: «Me llamo Kevin y estoy pasando de $10 a un Mercedes Mansory desde un país quebrado, hoy tenemos $7.000»",
    ],
  },
  {
    n: 5,
    titulo: "Que cada video sea un activo comercial, pero que no sea un anuncio",
    cuerpo:
      "El espectador responde a emociones, instintos y narrativas. Lo que se le vende es la novela completa: el proceso, la historia, el dolor, la victoria y los momentos incómodos.",
  },
  {
    n: 6,
    titulo: "Toda narrativa apunta a dos cosas",
    cuerpo:
      "Posicionar las verdaderas ambiciones y construir el apego a la novela del personaje principal. Si un video no hace ninguna de las dos, sobra.",
  },
  {
    n: 7,
    titulo: "Enfocar el contenido en qué va a ganar el espectador",
    cuerpo:
      "En la época del consumo masivo, el espectador busca obtener algo de cada contenido: entretenimiento, miedo, información. Si no se lleva nada, se va.",
  },
]

// ── II. Los formatos ──────────────────────────────────────────
export type Beat = { paso: string; ejemplo?: string }
export type Formato = {
  id: string
  n: number
  nombre: string
  para: string
  beats: Beat[]
}

export const FORMATOS: Formato[] = [
  {
    id: "dopamina",
    n: 1,
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
    n: 2,
    nombre: "Crítica a favor",
    para: "Convertir el comentario malo en combustible.",
    beats: [
      { paso: "Abrir con el comentario malo", ejemplo: "Todo el mundo dice que nunca voy a llegar al Mercedes Mansory." },
      { paso: "Contradecirlo con un hecho", ejemplo: "Pero hoy firmé mi primer contrato de un robot humanoide vendido a una empresa de Estados Unidos." },
    ],
  },
  {
    id: "movimiento",
    n: 3,
    nombre: "Movimiento (en acción)",
    para: "Probar que el proceso pasa de verdad, en el mundo real.",
    beats: [
      { paso: "Dónde estoy y qué estoy haciendo", ejemplo: "Estoy en uno de los eventos de tecnología más grandes del mundo y voy a reunirme con el organizador." },
      { paso: "Dar contexto", ejemplo: "X es el organizador de DevCon 2026, que esta gestión se organiza en India, y nos va a contar…" },
    ],
  },
  {
    id: "interno",
    n: 4,
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
    n: 5,
    nombre: "Gancho dirigido al miedo",
    para: "Capturar en el primer segundo con un dato que incomoda.",
    beats: [
      { paso: "Un dato que da miedo, dicho de entrada", ejemplo: "Más de 450 mil empresas en Estados Unidos están cerrando sus operaciones por el impacto de la inteligencia artificial." },
    ],
  },
  {
    id: "crisis",
    n: 6,
    nombre: "La crisis como ventaja mediática",
    para: "Montarse en lo que ya es tendencia, nacional o internacional.",
    beats: [
      { paso: "El evento mediático en tendencia", ejemplo: "Rodrigo Paz acaba de firmar algo que cambiará el rumbo de Bolivia, pero no para bien." },
      { paso: "La información, lo mejor explicada posible, con datos interesantes" },
    ],
  },
  {
    id: "lifestyle",
    n: 7,
    nombre: "Life style",
    para: "Mostrar el logro físico sin que sea presumir.",
    beats: [
      { paso: "El logro, y el giro", ejemplo: "Me compré el nuevo iPhone 18 Pro. Pero no por la razón que todo el mundo cree." },
    ],
  },
  {
    id: "estrategico",
    n: 8,
    nombre: "Estratégico",
    para: "No solo conocimiento: estrategia y perspicacia.",
    beats: [
      { paso: "El resultado improbable", ejemplo: "Así conseguí un cliente de $10.000 sin un solo centavo." },
      { paso: "Contexto y explicación carismática" },
    ],
  },
  {
    id: "versus",
    n: 9,
    nombre: "Versus, comparación, antes y después",
    para: "El contraste hace el trabajo solo.",
    beats: [{ paso: "Dos estados, uno al lado del otro" }],
  },
  {
    id: "trends",
    n: 10,
    nombre: "Trends en tendencia",
    para: "Entrar donde el alcance ya está.",
    beats: [{ paso: "El formato del momento, con la narrativa de siempre" }],
  },
]

// ── III. Distribución ─────────────────────────────────────────
export type Estado = "usamos" | "pendiente" | "no"
export type Red = { nombre: string; estado: Estado; nota?: string }

export const REDES: Red[] = [
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
]

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  usamos: "En uso",
  pendiente: "Se puede implementar",
  no: "No la usamos",
}

// ── Producción ────────────────────────────────────────────────
export const PRODUCCION = {
  personaje: ["2 trajes: uno negro y uno azul", "2 pares de zapatos: negro y azul"],
  equipo: [] as string[],
}

// ── En cola ───────────────────────────────────────────────────
export type Video = { n: number; titulo: string; formato: string; formatoId?: string }

export const EN_COLA: Video[] = [
  { n: 1, titulo: "Día uno en India", formato: "Life style", formatoId: "lifestyle" },
  { n: 2, titulo: "Vamos a inundar más de 10 redes sociales a nivel mundial", formato: "Estratégico", formatoId: "estrategico" },
]

export const PENDIENTES = [
  "Agregar más carisma y personalidad",
  "Investigar qué le gusta a la gente hoy y qué se lo provoca",
]

// ── Lectura del mercado ───────────────────────────────────────
export type Lectura = { titulo: string; cuerpo: string }

export const HOY_2026: Lectura[] = [
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
]

export const HACIA_2028: Lectura[] = [
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
]
