import type { ContenidoFabrica } from "@/lib/fabrica-reels"

// ──────────────────────────────────────────────────────────────
// LA FÁBRICA — MICRODUCK LIVE (/fabrica?canal=microduck-live)
//
// Semilla del canal 2 de MicroDuck: el mismo pato, en vivo, haciendo reír
// (noticias, farándula, el chat). El vivo es la fábrica de clips: cada
// transmisión se corta en clips de 15–30 s para TikTok, Reels y Shorts.
// Sale de live/CANAL-LIVE.md, live/PLAN-TECNICO.md y live/IDEAS-LIVE.md del
// repo kevlopez1/microduck-videos. Misma forma que lib/fabrica-reels.ts.
// Todavía no hubo ningún vivo: no hay métricas ni clips publicados.
// ──────────────────────────────────────────────────────────────

export const FABRICA_MICRODUCK_LIVE_ID = "microduck-live"

export const FABRICA_MICRODUCK_LIVE_BASE: ContenidoFabrica = {
  titulo: "Fábrica de reels",
  bajada:
    "Cómo se produce cada vivo de MicroDuck Live y los clips que salen de él. El pato 3D transmite desde la Mac de Kev, lee el chat y reacciona. Lo que junta en vivo suma al mismo contador de la meta. Lo que funciona en un clip vuelve como segmento.",
  pasos: [
    { titulo: "1 · Preparar el show", detalle: "Segmentos de 10–15 min · noticias y farándula verificadas, con fuente" },
    { titulo: "2 · Prueba técnica", detalle: "Escenario en OBS · voz · boca · filtro de seguridad · botón de silencio" },
    { titulo: "3 · En vivo", detalle: "Twitch y YouTube Live · siempre a la misma hora (prueba: 20:00 de Bolivia)" },
    { titulo: "4 · Persona con el botón de silencio", detalle: "Corta la voz al instante: «el pato fue al baño»", kev: true },
    { titulo: "5 · Registro", detalle: "Todo lo que dijo el pato queda guardado por día para revisar" },
    { titulo: "6 · Cortar clips", detalle: "10 a 20 clips de 15–30 s por transmisión, uno por momento" },
    { titulo: "7 · Revisión", detalle: "Reglas del vivo · gancho en 0–2 s · texto en el cuadro 0 · −14 LUFS" },
    { titulo: "8 · Aprobación de Kev", detalle: "Sí, o lista de cambios", kev: true },
    { titulo: "9 · Publicación y métricas", detalle: "TikTok · Reels · Shorts · se mide cada semana y se cambia un segmento a la vez" },
  ],
  retornos: [
    { desde: 1, hasta: 0, etiqueta: "falla" },
    { desde: 6, hasta: 5, etiqueta: "no cumple una regla" },
    { desde: 7, hasta: 5, etiqueta: "cambios" },
    { desde: 8, hasta: 0, etiqueta: "el clip que gana vuelve como segmento" },
  ],
  secciones: [
    { id: "flujo", tipo: "flujo", etiqueta: "El flujo", titulo: "Cómo se arma cada vivo" },
    {
      id: "reglas",
      tipo: "lista",
      etiqueta: "Principios del canal",
      titulo: "Reglas del vivo (no se negocian)",
      items: [
        "Español neutro. Nunca voseo.",
        "Siempre se dice que es una IA: «soy un pato de IA sin cuerpo, no me pidas que salte».",
        "Kawaii y gracioso: emociones exageradas, nunca cruel. Se ríe de sí mismo primero.",
        "Farándula y noticias: solo hechos públicos y verificados, con la fuente a mano. Nunca inventar chismes, romances, peleas ni delitos sobre personas reales.",
        "Nunca imágenes ni voces generadas de personas reales: el pato puede nombrar a un famoso y reaccionar, no mostrarlo ni imitarlo.",
        "Temas prohibidos: política partidaria, religión, tragedias recientes con víctimas, salud de personas, menores de edad, sexo, drogas, insultos y cualquier cosa contra un grupo de personas.",
        "Nada de promesas de dinero ni consejos financieros.",
        "No se muestran datos personales de nadie del chat: números, direcciones ni apellidos completos.",
        "El contador solo sube con plata real (suscripciones, Super Chat, donaciones). Hoy: $0 de $1.000.",
        "Música: solo con licencia para transmitir. Twitch y YouTube silencian o bajan el vivo por música ajena.",
        "Hay una persona con el botón de silencio en las primeras transmisiones.",
        "Todo lo que dice el pato pasa por el filtro de seguridad. Si duda, cambia de tema con un chiste.",
        "El modelo 3D lleva el crédito «Modelo 3D: Microduck · Pollen Robotics (Apache-2.0)» en pantalla.",
        "Las claves (ElevenLabs, Anthropic, stream) viven solo en .env, nunca en git.",
        "Ningún clip se publica sin el «sí» de Kev.",
      ],
    },
    {
      id: "show",
      tipo: "lista",
      etiqueta: "El show",
      titulo: "Segmentos de cada vivo (10–15 min cada uno)",
      items: [
        "1 · Noticias de pato: 3 noticias del mundo del día, contadas con su humor y sus caras.",
        "2 · Chisme kawaii: farándula pública del día, con reacciones exageradas.",
        "3 · El chat manda: la gente le pide cosas y él reacciona, opina o hace un reto.",
        "4 · Pato juez: le cuentan su comida, su mascota o su negocio y le pone nota del 1 al 10.",
        "5 · Cierre con el contador: «hoy juntamos $X; voy $Y de $1.000 para mi cuerpo».",
      ],
    },
    {
      id: "ideas",
      tipo: "tabla",
      etiqueta: "Ideas",
      titulo: "Ideas de segmentos para que el vivo no se repita",
      columnas: ["Idea", "Qué es", "Regla que toca", "Qué falta construir"],
      filas: [
        ["El pato no duerme", "Maratón de 12 horas. Cada meta del contador desbloquea algo: a los $50 canta, a los $100 se pone lentes para siempre.", "El contador solo sube con plata real · música con licencia", "Metas del contador que activan acciones (los lentes ya existen)"],
        ["Microduck adopta un humano", "Cada semana el chat elige a un espectador como «su humano» y el pato lo menciona todo el show.", "Solo el nombre de usuario del chat", "Memoria del show"],
        ["Juicio de patos", "El chat presenta un «caso» («mi hermano se comió mi pizza») y el pato es el juez, con martillo.", "Casos de broma: nada de personas reales ni delitos", "Emoción «juez» con martillo y sonido"],
        ["El pato aprende un idioma", "Cada día aprende 10 palabras en inglés o portugués que le enseña el chat.", "El filtro también revisa las palabras que enseñan", "Filtro en varios idiomas · lista de palabras aprendidas"],
        ["Diario del cuerpo", "Una vez por semana muestra en 3D su cuerpo armado pieza por pieza según lo que juntó.", "Montos reales del contador", "Precio por pieza del modelo (ya existe el modo «sin cuerpo»)"],
        ["El pato vs. otra IA", "Debates absurdos contra otro personaje de IA propio: «¿salteña o empanada?».", "Personaje propio, nunca una marca ni una imitación", "Segundo personaje con su voz"],
        ["Noticias al revés", "Cuenta una noticia y el chat vota si es verdad o mentira antes de que la revele.", "Noticias reales verificadas; las falsas se marcan al revelar", "Votación desde el chat · banco de noticias"],
        ["Pato horóscopo", "Cada mañana, predicciones ridículas por signo.", "Que se note que es un chiste: nada de salud ni dinero", "Nada: sale con el cerebro actual"],
      ],
    },
    {
      id: "escenario",
      tipo: "referentes",
      etiqueta: "El escenario",
      titulo: "Lo que ya está hecho (MVP del 2026-11-06)",
      refs: [
        {
          nombre: "El pato que habla en vivo",
          grupo: "Cómo se hace",
          url: "https://github.com/kevlopez1/microduck-videos/tree/main/live",
          datos: "npm run live · página local para OBS a 1920×1080 · probado en Chrome en la Mac",
          imagenes: ["/fabrica/microduck-live/escenario-v1.jpg"],
          ancho: true,
          puntos: [
            "El mismo pato 3D de los videos, ahora en tiempo real con Three.js.",
            "La boca: el pico de abajo se colgó de una bisagra propia y se abre con el volumen de la voz.",
            "9 emociones de los videos, pasadas a tiempo real: feliz, piensa, dice sí, dice no, sorpresa, triste, tímido, celebra y baile.",
            "Panel de control: escribes como si fueras el chat. Claude responde como el pato, o el pato dice tu texto tal cual.",
            "Filtro de seguridad de entrada y de salida, botón de silencio (tecla M) y registro por día.",
          ],
          paraKev: "Para probarlo completo faltan créditos de ElevenLabs y la clave de Anthropic en .env.",
        },
        {
          nombre: "Cómo está armado",
          grupo: "Cómo se hace",
          url: "https://github.com/kevlopez1/microduck-videos/blob/main/live/PLAN-TECNICO.md",
          datos: "Chat → cerebro → filtro → voz → escenario → OBS",
          imagenes: [],
          puntos: [
            "Cerebro: Claude Haiku para charlar, con la personalidad y las reglas del canal. Respuestas de 1 a 3 frases.",
            "Voz: ElevenLabs en streaming, misma voz del canal 1, modelo eleven_flash_v2_5 (el más rápido).",
            "Escenario: página web local que OBS toma como fuente de navegador, con el audio controlado por OBS.",
            "Meta de latencia: de 2 a 3 s entre el mensaje y la voz. Mientras espera, el pato pone cara de pensar.",
          ],
          paraKev: "",
        },
      ],
    },
    {
      id: "plataformas",
      tipo: "tabla",
      etiqueta: "Plataformas",
      titulo: "Dónde se transmite",
      columnas: ["Plataforma", "Rol", "Nota"],
      filas: [
        ["Twitch", "Principal", "Sin mínimo para transmitir. Bolivia entra en el programa de LATAM. Se aplican las normas generales."],
        ["YouTube Live", "Segunda", "Desde OBS no pide suscriptores: verificar el canal y activar el vivo (unas 24 h). Super Chat disponible en Bolivia."],
        ["Kick", "Opcional", "Exige avisar cuando la IA parece real y prohíbe deepfakes."],
        ["TikTok", "Solo clips", "TikTok Live pide un mínimo de seguidores y hace responsable al host por la voz sintética."],
      ],
    },
    {
      id: "medicion",
      tipo: "tabla",
      etiqueta: "Qué se mide",
      titulo: "Lo que se mide cada semana",
      columnas: ["Métrica", "Para qué"],
      filas: [
        ["Espectadores al mismo tiempo (promedio y pico)", "Si el show engancha"],
        ["Mensajes por minuto en el chat", "Si la gente conversa con el pato"],
        ["Minutos promedio por espectador", "Si los segmentos aguantan"],
        ["Seguidores y suscriptores nuevos", "Crecimiento"],
        ["Plata que suma al contador", "La meta"],
        ["Clips publicados y cuántos pasan las 100.000 vistas", "La fábrica de alcance"],
        ["Costo por hora (IA + voz + servidor)", "Que el show se pague solo"],
      ],
    },
    {
      id: "calendario",
      tipo: "lista",
      etiqueta: "Calendario",
      titulo: "Calendario de arranque",
      items: [
        "Semana 1: el pato en vivo con boca, emociones y voz, en una página que OBS toma como fuente. Hecho (falta probar con voz nueva).",
        "Semana 2: el cerebro conectado al chat de YouTube y Twitch, la cola de mensajes, el filtro y el contador.",
        "Semana 3: transmisión de prueba de 1 hora sin público, ajustes y primer vivo real.",
        "Después: 1 a 2 horas al día, siempre a la misma hora (prueba: 20:00 de Bolivia).",
      ],
    },
    {
      id: "pendientes",
      tipo: "lista",
      etiqueta: "Pendientes",
      titulo: "Lo que falta decidir o conseguir",
      items: [
        "Créditos de ElevenLabs: el 2026-11-06 la cuenta estaba en 0 de 30.000.",
        "Clave de Anthropic (ANTHROPIC_API_KEY) en el .env de la Mac.",
        "Decidir si la voz del vivo usa eleven_flash_v2_5 (rápida) o eleven_v3 (igual que los videos, más lenta).",
        "Crear y verificar las cuentas de Twitch y YouTube del canal; claves de stream en la Mac.",
        "Quién tiene el botón de silencio en las primeras transmisiones.",
        "Música con licencia para transmitir.",
      ],
    },
    { id: "metricas", tipo: "metricas", etiqueta: "Métricas", titulo: "Cómo le va a cada vivo y a cada clip" },
    { id: "notas", tipo: "notas", etiqueta: "Notas", titulo: "Notas de Kev" },
  ],
  notas: [],
}
