import type { ContenidoFabrica } from "@/lib/fabrica-reels"

// ──────────────────────────────────────────────────────────────
// LA FÁBRICA DE REELS — PRIME AL BILLÓN (/fabrica?canal=prime-al-billon)
//
// Semilla del canal Prime al Billón. Misma forma que lib/fabrica-reels.ts
// (Kev Project GTA), datos aparte. Nada inventado: lo que Kev todavía no
// definió queda vacío y la página lo dice.
// ──────────────────────────────────────────────────────────────

export const FABRICA_PRIME_ID = "prime-al-billon"

export const FABRICA_PRIME_BASE: ContenidoFabrica = {
  titulo: "Fábrica de reels",
  bajada:
    "Cómo se produce cada video de Prime al Billón, de la idea a las métricas. Si algo falla en la revisión, vuelve a edición. Lo que gana se repite como serie.",
  pasos: [
    { titulo: "1 · Idea", detalle: "Lo que ya funcionó + el tema del día" },
    { titulo: "2 · Guion", detalle: "Gancho de 0–2 s · cierre fijo del canal" },
    { titulo: "3 · Grabación (Kev)", detalle: "Vertical · micrófono · a cámara · tomas de apoyo propias", kev: true },
    { titulo: "4 · Edición en código", detalle: "Cortes · audio limpio · color · subtítulos · títulos · música desde el hype" },
    { titulo: "5 · Revisión", detalle: "Subtítulos sincronizados · volumen · encuadre · zona segura" },
    { titulo: "6 · Publicación", detalle: "Se sube sin publicar; sale solo con el «sí» de Kev" },
    { titulo: "7 · Métricas", detalle: "Vistas · retención a 3 s · compartidos · comentarios" },
  ],
  retornos: [
    { desde: 4, hasta: 3, etiqueta: "falla" },
    { desde: 5, hasta: 3, etiqueta: "cambios" },
    { desde: 6, hasta: 0, etiqueta: "lo que gana se repite como serie" },
    { desde: 6, hasta: 1, etiqueta: "el gancho que no retiene se reescribe", punteado: true },
  ],
  secciones: [
    { id: "flujo", tipo: "flujo", etiqueta: "El flujo", titulo: "Cómo se arma cada video" },
    {
      id: "reglas",
      tipo: "lista",
      etiqueta: "Principios del canal",
      titulo: "Reglas de cada video",
      items: [
        "Cada video acerca la historia al billón: un cliente, un empleado AI, un robot, un inversor o una cifra de PRIME.",
        "Siempre un número real en pantalla, con su fecha. Si Kev no dio la cifra, no hay número.",
        "Nada inventado: revenue, clientes y valuación solo como Kev los dio. Todo comprobable.",
        "Manda el dato, no el auto: el gancho es la cifra o el resultado, no el lujo.",
        "Gancho en los primeros 2 segundos, que se entienda sin sonido.",
        "Diario de fundador: Kev a cámara, desde Bolivia, contando qué pasó hoy en PRIME.",
        "Estilo explicador: títulos en cajas, esquemas y pantallas de color plano, como Hormozi.",
        "En el primer minuto, un cambio de imagen cada 2 segundos, como Iman.",
        "Empleados AI trabajando en negocios reales: se ve la pantalla y el negocio.",
        "PRIME siempre en mayúsculas y con su logo.",
        "Subtítulos siempre, con los títulos de dos líneas de Kev.",
        "Se exporta siempre con la música incluida, desde su momento hype.",
        "Una pregunta al final para que comenten.",
        "Cierre fijo hacia primebusiness.live (la frase la define Kev).",
        "Lo que gana se repite como serie: parte 2, parte 3.",
        "1 video al día hasta que la fábrica corra sola.",
        "Nada se publica sin el «sí» de Kev.",
      ],
    },
    { id: "mejores", tipo: "referentes", etiqueta: "Nuestros mejores videos", titulo: "El canal todavía no tiene videos publicados", refs: [] },
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
          paraKev: "",
        },
        {
          nombre: "Iman Gadzhi · YouTube (videos largos)",
          url: "https://www.youtube.com/watch?v=wtDDjBOfTZo",
          datos: "6.31M suscriptores · «Give me 26 minutes… Claude» 1.8M vistas · «5 Proven Ways… AI» 1.6M",
          imagenes: ["/fabrica/iman-youtube-v1.jpg"],
          ancho: true,
          puntos: [
            "Abre con una versión animada de él (caricatura 3D) en escenas temáticas: taller, traje de Iron Man.",
            "Texto en serif cursiva con ✳ que se va sumando palabra por palabra: «Same / Boring / Repetitive».",
            "Corta a él sentado en un living oscuro con lámparas cálidas, plano medio y fondo desenfocado.",
            "Tarjetas de vidrio tipo holograma flotan a su alrededor con los íconos de lo que nombra.",
            "Grabación de pantalla oscura, con zoom y la frase clave resaltada.",
            "Títulos de capítulo sobre azul oscuro con un brillo al centro: «The main problem».",
            "En el primer minuto, un cambio de imagen cada 2 segundos.",
          ],
          paraKev: "",
        },
        {
          nombre: "Iman Gadzhi · Reels de Instagram",
          url: "https://www.instagram.com/reel/CmylMjXpeCT/",
          datos: "3.38M seguidores · reel en Sudáfrica 3.4M vistas · reel del helicóptero 3.1M vistas",
          imagenes: ["/fabrica/iman-reels-v1.jpg"],
          ancho: true,
          puntos: [
            "Sin texto y sin voz: solo música y tomas de cine.",
            "Dron siguiéndolo mientras corre, con su G-Wagon detrás, por una ruta en la costa.",
            "Pantalla partida en 3 tomas aéreas al mismo tiempo.",
            "Contraluz de atardecer, ropa negra y colores apagados.",
            "Tomas tipo «paparazzi»: zoom de lejos, con grano. Helicóptero, reloj, G-Wagon, cena.",
          ],
          paraKev: "",
        },
        {
          nombre: "Iman Gadzhi · TikTok",
          url: "https://www.tiktok.com/@imangadzhi/video/7694300980669598998",
          datos: "«She always regrets it» 5.4M vistas · «Surprise Successful!» 4.7M vistas",
          imagenes: ["/fabrica/iman-tiktok-v1.jpg"],
          ancho: true,
          puntos: [
            "Sketches cotidianos en un auto descapotable con otra persona: cámara fija en el tablero, gran angular.",
            "Subtítulos de 1–2 palabras al centro: amarillos cuando habla él, blancos cuando habla la otra persona.",
            "Una frase chica arriba durante todo el video: «It's not what it looks like…».",
            "La palabra clave en blanco y negro, como golpe: «regret».",
            "Plano y contraplano rápido entre los dos.",
          ],
          paraKev: "",
        },
      ],
    },
    { id: "creadores", tipo: "referentes", etiqueta: "Creadores (no son referentes)", titulo: "Qué les funciona a otros creadores", refs: [] },
    {
      id: "musica",
      tipo: "tabla",
      etiqueta: "Música",
      titulo: "Canciones y su momento hype",
      columnas: ["Canción", "Artista", "Para qué", "Momento 1", "Otros momentos", "Cortes hechos"],
      filas: [
        ["Band4Band", "Central Cee Lil Baby", "Ganchos fuertes: PRIME frente a otras empresas de IA", "0:55–1:15", "0:09–0:24", "hype-1 · hype-2"],
        ["Wake Up in the Sky", "Gucci Mane Bruno Mars Kodak Black", "Un día del fundador, eventos", "0:00–0:25", "0:35–0:50", "hype-1 · hype-2"],
        ["Life Is Good", "Future Drake", "Hitos de PRIME, antes y después", "1:34–1:49", "0:20–0:35", "hype-1 · hype-2"],
        ["Last Breath", "Future", "Días difíciles, lo que no salió", "0:21–0:33", "1:03–1:18", "hype-1 · hype-2"],
        ["Niagara Falls (Foot or 2)", "Metro Boomin Travis Scott 21 Savage", "Resumen de la semana, cuenta hacia el billón", "0:15–0:30", "0:48–1:03", "hype-1 · hype-2"],
        ["Mask Off", "Future", "Cifras subiendo, comprobantes", "0:12–0:27", "0:00–0:26 · 0:39–0:54", "hype-1 · hype-2 · hype-3"],
        ["Money In The Grave", "Drake Rick Ross", "Clientes nuevos de PRIME, ventas cerradas", "0:05–0:38", "0:41–0:56", "hype-1 · hype-2"],
        ["All The Stars", "Kendrick Lamar SZA", "La meta: el billón, EE.UU., Silicon Valley", "0:35–0:50", "1:55–2:10", "hype-1 · hype-2"],
        ["Flashing Lights", "Kanye West", "Eventos y reuniones de noche", "1:18–1:33", "0:28–0:43", "hype-1 · hype-2"],
        ["Superhero (Heroes & Villains)", "Metro Boomin Future Chris Brown", "Robots Prime, lanzamientos", "0:42–0:57", "1:14–1:29", "hype-1 · hype-2"],
        ["HIGHEST IN THE ROOM", "Travis Scott", "Noches de trabajo, el marcador subiendo", "0:00–0:30", "1:11–1:26", "hype-1 · hype-2"],
        ["SICKO MODE", "Travis Scott Drake", "Cambios de ritmo, revelación de una cifra", "0:55–1:10", "3:11–3:26", "hype-1 · hype-2"],
      ],
    },
    { id: "ganchos", tipo: "lista", etiqueta: "Ganchos", titulo: "Ganchos para grabar", items: [] },
    { id: "guiones", tipo: "guiones", etiqueta: "Guiones", titulo: "Guiones para grabar", guiones: [
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 1/6 (día A, mañana) · «Nunca en la historia»",
        "estado": "Guía para grabar",
        "datos": "40 s · 104 palabras · All The Stars desde 0:35 · fijar en el perfil",
        "escenas": [
          [
            "0–4",
            "Kev a cámara, primer plano. Texto: NUNCA EN LA HISTORIA",
            "«Nunca en la historia se había presentado una oportunidad así.»"
          ],
          [
            "4–14",
            "Kev a cámara. Idea: tanto poder, a tan poco precio",
            "«O sea, realmente nos están dando muchísimo poder a un precio muy bajo. Una herramienta que piensa, que escribe, que programa, que atiende clientes. Y eso prácticamente no había pasado en ninguna época.»"
          ],
          [
            "14–25",
            "Fotos de Rockefeller, Gates y Bezos con zoom lento. Idea: antes ese poder era de pocos",
            "«Antes, para tener ese poder, tenías que ser una empresa gigante, tener millones, tener cientos de empleados. Hoy lo tienes en tu teléfono, por el precio de una suscripción.»"
          ],
          [
            "25–36",
            "Kev a cámara, más cerca. Idea: es difícil, pero hoy hay herramientas",
            "«Y es algo que queremos aprovechar. No quita que sea extremadamente complicado. Pero hoy tenemos las herramientas, y eso antes no existía.»"
          ],
          [
            "36–40",
            "Texto: PRIME AL BILLÓN · FASE 0",
            "«Por eso empiezo este canal. Esto es Prime al Billón.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md)."
        ]
      },
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 2/6 (día A, tarde) · «Todos pueden, casi nadie lo hace»",
        "estado": "Guía para grabar",
        "datos": "40 s · 110 palabras · Empire State Of Mind desde 0:54",
        "escenas": [
          [
            "0–4",
            "Kev a cámara. Texto: TODOS PUEDEN",
            "«Absolutamente todos tenemos la capacidad de hacer esto. Pero muy poca gente realmente lo hace.»"
          ],
          [
            "4–15",
            "Caja de texto: 18.8 % · Fuente: Microsoft, junio de 2026",
            "«Según Microsoft, en junio de este año solo el 18.8 % de la gente en edad de trabajar en el mundo usó inteligencia artificial. Menos de una de cada cinco personas.»"
          ],
          [
            "15–27",
            "Caja de texto: +70 % NO ES TRABAJO · Fuente: estudio de OpenAI (NBER, 2025)",
            "«Y de los que la usan, la mayoría la usa como un chat. Un estudio de OpenAI con los mensajes de ChatGPT encontró que más del 70 % no son de trabajo.»"
          ],
          [
            "27–36",
            "Toma de un celular con un chat abierto (Pexels o propia)",
            "«Entonces la mayoría le pregunta algo y ya. Casi nadie la está poniendo a trabajar de verdad.»"
          ],
          [
            "36–40",
            "Kev a cámara",
            "«Y ahí está la diferencia: no es la herramienta, es lo que haces con ella.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md).",
          "Fuentes en el texto del post: Microsoft, Global AI Diffusion Q2 2026 (sept. 2026) · NBER Working Paper 34255, «How People Use ChatGPT» (sept. 2025)."
        ]
      },
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 3/6 (día A, noche) · «La brecha ya empezó»",
        "estado": "Guía para grabar",
        "datos": "40 s · 108 palabras · HIGHEST IN THE ROOM desde 0:00",
        "escenas": [
          [
            "0–4",
            "Kev de noche. Texto: LA BRECHA YA EMPEZÓ",
            "«La brecha entre los que usan la IA y los que no ya empezó.»"
          ],
          [
            "4–15",
            "Caja de texto: 28.8 % vs. 16.2 % · Fuente: Microsoft, junio de 2026",
            "«Según Microsoft, en los países ricos ya la usa el 28.8 % de la gente en edad de trabajar. En países como los nuestros, el 16.2 %. Y esa diferencia está creciendo.»"
          ],
          [
            "15–26",
            "Pantalla partida: alguien con la IA trabajando y alguien solo con el teléfono",
            "«Yo creo que de aquí a 2030 la distancia entre la gente que sabe usar estas herramientas y la que no va a ser enorme. Y no hablo de hacerle una pregunta a un chat.»"
          ],
          [
            "26–36",
            "Grabación de pantalla real de PRIME trabajando (sin datos de clientes)",
            "«Hablo de esto: ponerla a trabajar para ti. Un empleado AI que responde a tus clientes mientras tú duermes.»"
          ],
          [
            "36–40",
            "Kev a cámara",
            "«Entonces, ¿de qué lado quieres estar en 2030?»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md).",
          "2030 es opinión de Kev («yo creo»); los porcentajes son de Microsoft, Global AI Diffusion Q2 2026."
        ]
      },
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 4/6 (día B, mañana) · «Ya no podemos estar tranquilos»",
        "estado": "Guía para grabar",
        "datos": "40 s · 99 palabras · Last Breath desde 0:21",
        "escenas": [
          [
            "0–4",
            "Kev a cámara, tranquilo. Texto: ¿CUÁNTO AGUANTAS SIN EL CELULAR?",
            "«Fíjate en esto: ¿cuánto tiempo aguantas sin mirar el celular?»"
          ],
          [
            "4–15",
            "Tomas rápidas de pantallas, notificaciones y scroll (Pexels o propias)",
            "«Hoy la gente ya no puede mantener la atención. No puede estar tranquila. Un video, otro video, otro, y cuando te das cuenta pasó una hora y no hiciste nada.»"
          ],
          [
            "15–26",
            "Kev a cámara. Idea: la IA suma todavía más información",
            "«Y la inteligencia artificial te da todavía más información. Tanta, que el cerebro prácticamente ya no puede procesarla toda. Te responde todo, pero tú no avanzas.»"
          ],
          [
            "26–36",
            "Kev a cámara, más cerca. Idea: el problema no es la herramienta",
            "«Entonces el problema no es la herramienta. La herramienta es increíble. El problema somos nosotros, que no sabemos estar en una sola cosa.»"
          ],
          [
            "36–40",
            "Texto: FASE 0",
            "«Y contra eso es lo que vamos a pelear aquí.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md).",
          "Sin cifras: es la observación de Kev. Pregunta para comentarios: «¿Cuánto tiempo aguantas sin mirar el celular?»."
        ]
      },
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 5/6 (día B, tarde) · «Cada día es mejor»",
        "estado": "Guía para grabar",
        "datos": "40 s · 94 palabras · Niagara Falls desde 0:15",
        "escenas": [
          [
            "0–4",
            "Kev a cámara. Texto: CADA DÍA ES MEJOR",
            "«La inteligencia artificial cada día se hace mejor y mejor.»"
          ],
          [
            "4–14",
            "Kev a cámara. Idea: la herramienta no es lo que frena",
            "«Lo que hace hoy, hace un año no lo hacía. Entonces, lo que nos frena no es la herramienta.»"
          ],
          [
            "14–24",
            "Cajas de texto, una por una: INSTRUCCIÓN · DOCTRINA · SOBREINFORMACIÓN",
            "«Nos frena la falta de instrucción, porque nadie nos enseñó a usarla. La doctrina de siempre, el «eso no es para nosotros». Y la sobreexposición de información.»"
          ],
          [
            "24–35",
            "Kev caminando. Idea: desarrollarse como persona",
            "«Lo que hay que hacer es desarrollarnos como personas, para poder controlar herramientas como la IA. Y no que la IA nos controle a nosotros.»"
          ],
          [
            "35–40",
            "Kev a cámara",
            "«Eso es lo que vamos a hacer en este canal, todos los días.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md)."
        ]
      },
      {
        "serie": "Fase 0",
        "titulo": "Fase 0 · 6/6 (día B, noche) · «Mañana empieza el Día 1»",
        "estado": "Guía para grabar",
        "datos": "40 s · 98 palabras · FE!N desde 0:23",
        "escenas": [
          [
            "0–4",
            "Kev a cámara. Texto: MAÑANA EMPIEZA EL DÍA 1",
            "«Mañana empieza el Día 1.»"
          ],
          [
            "4–14",
            "Kev a cámara. Idea: qué es PRIME y la meta",
            "«Mi empresa se llama PRIME. Lo que hacemos es poner empleados AI a trabajar en negocios reales. Y la meta es llevarla a mil millones de dólares, desde Bolivia.»"
          ],
          [
            "14–23",
            "Marcador en pantalla: $0 / $1,000,000,000",
            "«El marcador arranca en cero. Cada cliente, cada dólar que entre, lo vas a ver aquí, con pruebas.»"
          ],
          [
            "23–33",
            "Kev a cámara. Idea: es un registro, en público, con errores",
            "«No es un curso ni es motivación. Es un registro. Con todo lo que salga bien y con todo lo que salga mal, que va a ser bastante.»"
          ],
          [
            "33–40",
            "Cierre fijo: primebusiness.live · WhatsApp 72258926",
            "«Y si quieres un empleado AI en tu negocio, escríbele por WhatsApp. El número está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar, no un texto para leer. Largo pensado a ~2.5 palabras por segundo (150 por minuto). En edición se cortan los mejores tramos (ver referentes/voz-kev.md).",
          "El marcador cuenta revenue nuevo desde el Día 1 (pendiente de confirmar con Kev).",
          "Frase exacta del CTA pendiente de Kev."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 1/21 (Día 1, mañana) · «Un boliviano ya lo hizo»",
        "estado": "Guía para grabar",
        "datos": "40 s · 98 palabras · All The Stars desde 0:35 · tomas: personajes/claure",
        "escenas": [
          [
            "0–4",
            "Foto de Marcelo Claure con zoom. Texto: UN BOLIVIANO YA LO HIZO",
            "«Un boliviano ya llegó a dirigir empresas de miles de millones de dólares.»"
          ],
          [
            "4–15",
            "Fotos de Claure. Cajas: BRIGHTSTAR · SPRINT · INTER MIAMI",
            "«Se llama Marcelo Claure. Fundó Brightstar, fue director ejecutivo de Sprint, una de las grandes telefónicas de Estados Unidos, y es uno de los fundadores del Inter Miami.»"
          ],
          [
            "15–26",
            "Kev a cámara. Idea: si él pudo, el problema no es de dónde vienes",
            "«Y es boliviano. O sea, lo de «desde Bolivia no se puede» no es verdad. Ya alguien lo hizo antes. Y no lo digo para motivarte, lo digo porque es un dato.»"
          ],
          [
            "26–36",
            "Kev caminando",
            "«La diferencia es que hoy tenemos herramientas que él no tenía cuando empezó. La inteligencia artificial está en el teléfono de cualquiera.»"
          ],
          [
            "36–40",
            "Marcador Día 1",
            "«Ahora vamos nosotros.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Marcelo Claure). Créditos de las fotos en el post (CC BY-SA)."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 2/21 (Día 1, tarde) · «Qué es un empleado AI»",
        "estado": "Guía para grabar",
        "datos": "40 s · 101 palabras · Money In The Grave desde 0:05 · grabación de pantalla de PRIME · mecanismo (error → problema → otra forma) + organigrama de los 8 puestos",
        "escenas": [
          [
            "0–4",
            "Kev a cámara con el celular. Texto: LA MAYORÍA USA LA IA COMO UN CHAT",
            "«La mayoría de los negocios usa la inteligencia artificial como un chat. Le pregunta cosas y ya.»"
          ],
          [
            "4–12",
            "Kev a cámara. Texto: Y EL DUEÑO SIGUE HACIENDO TODO A MANO",
            "«Y el dueño sigue respondiendo, cotizando, cobrando y anotando a mano. O sea, la IA no le quitó ningún trabajo.»"
          ],
          [
            "12–26",
            "Grabación de pantalla real (datos de prueba): Kev escribe a las 3 a. m. y el empleado de ventas responde. Texto: VENTAS Y ATENCIÓN · 24/7",
            "«Un empleado AI tiene un puesto. Este es el de ventas: le escribo a las tres de la mañana, y me responde, me cotiza con los precios del negocio y toma el pedido.»"
          ],
          [
            "26–34",
            "Organigrama: el dueño arriba, los 8 puestos abajo; se enciende uno por uno. Texto: TRABAJAN SOLOS · TÚ APRUEBAS",
            "«Y es uno de ocho. Otro lleva las cuentas, otro publica en redes, otro te dice qué reponer. Trabajan solos; tú solo apruebas.»"
          ],
          [
            "34–40",
            "Cierre fijo: primebusiness.live · WhatsApp 72258926",
            "«Escríbele al 72258926: te responde el empleado AI.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "La pantalla debe ser real y sin datos de clientes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 3/21 (Día 1, noche) · «Día 1»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 63 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 1 · $[X] / $1,000,000,000",
            "«Día 1. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Lo que salió mal hoy: [algo real]. Y lo que aprendí: [algo real]. Porque esto va a tener muchos errores, y los voy a mostrar.»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 2.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 4/21 (Día 2, mañana) · «Los chips detrás de la IA»",
        "estado": "Guía para grabar",
        "datos": "40 s · 100 palabras · Superhero desde 0:42 · tomas: personajes/huang (si hay) o fotos",
        "escenas": [
          [
            "0–4",
            "Foto de Jensen Huang. Texto: NVIDIA, 1993",
            "«Detrás de toda la inteligencia artificial hay una empresa que casi nadie conoce por su nombre.»"
          ],
          [
            "4–15",
            "Fotos de Huang. Caja: COFUNDÓ NVIDIA EN 1993",
            "«Se llama Nvidia. La cofundó Jensen Huang en 1993, y desde entonces es su presidente y director ejecutivo. Y hoy es una de las empresas más valiosas del mundo.»"
          ],
          [
            "15–27",
            "Kev a cámara. Idea: él vio la ola antes",
            "«Hacían chips para videojuegos. Y esos mismos chips terminaron siendo los que hacen funcionar la inteligencia artificial. O sea, él estaba ahí cuando llegó la ola. Y no la vio pasar.»"
          ],
          [
            "27–40",
            "Kev a cámara, más cerca",
            "«Hoy la ola ya llegó, y está en tu teléfono. La pregunta es si te vas a subir o la vas a ver pasar.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Jensen Huang). Los chips para videojuegos y «una de las empresas más valiosas del mundo» se confirman con una fuente antes de grabar; si no, se cortan."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 5/21 (Día 2, tarde) · «¿Cuántas horas respondes WhatsApp?»",
        "estado": "Guía para grabar",
        "datos": "40 s · 41 palabras · Wake Up in the Sky desde 0:00 · entrevista en la calle",
        "escenas": [
          [
            "0–4",
            "Kev en la calle, micrófono, frente a un negocio. Texto: ¿CUÁNTAS HORAS AL DÍA RESPONDES WHATSAPP?",
            "«Disculpa, ¿cuántas horas al día pasas respondiendo WhatsApp de tu negocio?»"
          ],
          [
            "4–24",
            "Respuestas reales de 2 o 3 dueños de negocio (con su permiso)",
            "«[Respuestas reales.]»"
          ],
          [
            "24–34",
            "Kev al dueño. Idea: ¿le darías ese trabajo a un empleado AI?",
            "«¿Y si un empleado AI hiciera eso por ti, las veinticuatro horas, le darías ese trabajo?»"
          ],
          [
            "34–40",
            "Respuesta real + cierre fijo",
            "«[Respuesta.] Si tú también quieres uno, el WhatsApp está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Pedir permiso de cada persona antes de publicar. No mostrar números de teléfono."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 6/21 (Día 2, noche) · «Día 2»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 57 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 2 · $[X] / $1,000,000,000",
            "«Día 2. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Lo que salió mal hoy: [algo real]. Lo que me dijo la gente en la calle: [lo más interesante].»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 3.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 7/21 (Día 3, mañana) · «El arte de la guerra para empresas»",
        "estado": "Guía para grabar",
        "datos": "40 s · 101 palabras · Last Breath desde 0:21 · tomas: personajes/suntzu (foto)",
        "escenas": [
          [
            "0–4",
            "Foto de la estatua de Sun Tzu. Texto: HACE MÁS DE 2,000 AÑOS",
            "«Hace más de dos mil años, un general chino escribió un libro que hoy leen los empresarios.»"
          ],
          [
            "4–14",
            "Caja: SUN TZU · EL ARTE DE LA GUERRA",
            "«Se llama El arte de la guerra, de Sun Tzu. Y hay una idea que a mí me cambió la forma de ver los negocios. Y la sigo usando todos los días.»"
          ],
          [
            "14–25",
            "Texto grande: «SOMETER AL ENEMIGO SIN LUCHAR» (cap. 3)",
            "«Él dice que el arte supremo de la guerra es someter al enemigo sin luchar.»"
          ],
          [
            "25–40",
            "Kev a cámara. Idea: aplicado a PRIME",
            "«Para mí eso, en un negocio, es no pelear por precio con nadie. Es tener algo que el otro no tiene. Por ejemplo, un empleado que trabaja las veinticuatro horas mientras tu competencia todavía responde a mano.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "La cita es del capítulo 3; usar una traducción publicada y citarla en el post. Foto: CC BY 2.5."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 8/21 (Día 3, tarde) · «Un cliente de PRIME»",
        "estado": "Falta: cliente que acepte salir",
        "datos": "40 s · 53 palabras · Money In The Grave desde 0:05 · en el negocio del cliente",
        "escenas": [
          [
            "0–4",
            "Kev en el negocio del cliente. Texto: [NOMBRE DEL NEGOCIO]",
            "«Este es [nombre del negocio], y aquí trabaja un empleado AI de PRIME.»"
          ],
          [
            "4–16",
            "Pantalla partida: el dueño y el empleado AI respondiendo (pantalla real)",
            "«[El dueño cuenta qué hacía antes: cuántas horas, qué se le escapaba.]»"
          ],
          [
            "16–30",
            "El dueño a cámara",
            "«[Qué cambió desde que tiene el empleado AI. Solo lo que él diga, con sus palabras.]»"
          ],
          [
            "30–40",
            "Kev a cámara + cierre fijo",
            "«Y así como él, cualquier negocio. El WhatsApp está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Cliente antiguo: sale como historia, no suma al marcador.",
          "Pedir permiso firmado o por escrito al cliente."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 9/21 (Día 3, noche) · «Día 3»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 49 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 3 · $[X] / $1,000,000,000",
            "«Día 3. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Hoy grabé con [cliente]. Lo que más me sorprendió: [algo real].»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 4.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 10/21 (Día 4, mañana) · «No hace falta nacer en Silicon Valley»",
        "estado": "Guía para grabar",
        "datos": "40 s · 96 palabras · Empire State Of Mind desde 0:54 · tomas: personajes/jackma (foto)",
        "escenas": [
          [
            "0–4",
            "Foto de Jack Ma. Texto: NO HACE FALTA NACER EN SILICON VALLEY",
            "«No hace falta nacer en Silicon Valley para construir una empresa gigante.»"
          ],
          [
            "4–16",
            "Fotos de Jack Ma. Cajas: ALIBABA · PORTADA DE FORBES",
            "«Jack Ma fundó Alibaba en China, y fue el primer empresario de la China continental en salir en la portada de Forbes.»"
          ],
          [
            "16–28",
            "Kev a cámara. Idea: construyó lejos del centro",
            "«Lo construyó lejos de Estados Unidos, y terminó saliendo a la bolsa de Nueva York. O sea, el lugar donde empiezas no decide dónde terminas. Empezó prácticamente de cero.»"
          ],
          [
            "28–40",
            "Kev caminando en Santa Cruz",
            "«Yo estoy construyendo PRIME desde Bolivia. Y no lo veo como una desventaja, lo veo como el punto de partida. Al contrario, aquí casi nadie lo está haciendo, y eso es una ventaja.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Jack Ma). Foto: CC BY 2.0."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 11/21 (Día 4, tarde) · «Adivina la cifra»",
        "estado": "Falta: precio de PRIME",
        "datos": "40 s · 94 palabras · SICKO MODE desde 0:55 · precios del catálogo de PRIME (nov. 2026)",
        "escenas": [
          [
            "0–4",
            "Kev a cámara. Texto: ¿CUÁNTO CUESTA UN EMPLEADO AI?",
            "«¿Cuánto crees que cuesta un empleado AI que atienda tu negocio las veinticuatro horas?»"
          ],
          [
            "4–12",
            "Lista en pantalla: 24/7 · COTIZA · TOMA PEDIDOS · COBRA",
            "«Déjalo en los comentarios antes de ver la respuesta. Responde a cualquier hora, cotiza con tus precios, toma pedidos y cobra.»"
          ],
          [
            "12–22",
            "Caja grande: USD 35 / MES · Ventas y atención · Fuente: catálogo de PRIME, nov. 2026",
            "«Treinta y cinco dólares al mes. Ese es el de ventas y atención de PRIME.»"
          ],
          [
            "22–34",
            "Organigrama con precios: Contabilidad USD 29 · Compras USD 29 · Supervisor USD 45 · Marketing USD 70… Texto: CADA PUESTO SE SUMA",
            "«Y no es uno solo. Si además quieres que te lleve las cuentas, son veintinueve más. El que te dice qué reponer, otros veintinueve. Armas el equipo con los puestos que tu negocio necesita.»"
          ],
          [
            "34–40",
            "Cierre fijo",
            "«¿Cuánto habías dicho tú? El WhatsApp está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Precio: catálogo de PRIME, nov. 2026 (Ventas y atención, USD 35 al mes). No se compara con un sueldo sin fuente oficial.",
          "Los comentarios con cifras son el gancho: responder los primeros con el precio real."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 12/21 (Día 4, noche) · «Día 4»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 51 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 4 · $[X] / $1,000,000,000",
            "«Día 4. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Hoy hablé de precios. Lo que me escribieron: [mensajes reales, sin datos personales].»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 5.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 13/21 (Día 5, mañana) · «Cómo construyó Elon Musk»",
        "estado": "Guía para grabar",
        "datos": "40 s · 96 palabras · Niagara Falls desde 0:15 · tomas: personajes/musk",
        "escenas": [
          [
            "0–4",
            "Tomas de Musk (Casa Blanca, fotos). Texto: COHETES, AUTOS, IA",
            "«Cohetes, autos eléctricos, chips en el cerebro y la inteligencia artificial. Todo con la misma persona.»"
          ],
          [
            "4–16",
            "Cajas: SPACEX · TESLA · NEURALINK · OPENAI",
            "«Elon Musk fundó SpaceX, dirige Tesla, cofundó Neuralink y fue cofundador de OpenAI, la empresa de ChatGPT.»"
          ],
          [
            "16–28",
            "Kev a cámara. Idea: va por lo que parece imposible",
            "«Lo que yo aprendo de él no es la plata. Es que siempre va por lo que todos dicen que es imposible, y lo dice en voz alta. Y cuando le dicen que no se puede, lo hace igual.»"
          ],
          [
            "28–40",
            "Kev a cámara, más cerca",
            "«Llevar una empresa a mil millones de dólares desde Bolivia también suena imposible. Por eso lo digo en voz alta, aquí, todos los días.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Elon Musk). Créditos de tomas en el post."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 14/21 (Día 5, tarde) · «¿Usas IA en tu negocio?»",
        "estado": "Guía para grabar",
        "datos": "40 s · 44 palabras · Wake Up in the Sky desde 0:35 · entrevista en la calle",
        "escenas": [
          [
            "0–4",
            "Kev en la calle. Texto: ¿USAS INTELIGENCIA ARTIFICIAL EN TU NEGOCIO?",
            "«¿Usas inteligencia artificial en tu negocio?»"
          ],
          [
            "4–24",
            "Respuestas reales de 2 o 3 dueños de negocio (con permiso)",
            "«[Respuestas reales.]»"
          ],
          [
            "24–34",
            "Caja: 18.8 % · Microsoft, junio de 2026",
            "«Según Microsoft, en el mundo solo el 18.8 % de la gente en edad de trabajar usó inteligencia artificial. Y aquí se nota.»"
          ],
          [
            "34–40",
            "Cierre fijo",
            "«Si quieres empezar con un empleado AI, el WhatsApp está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Permiso de cada persona antes de publicar."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 15/21 (Día 5, noche) · «Día 5»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 48 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 5 · $[X] / $1,000,000,000",
            "«Día 5. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Lo que más me repitió la gente hoy: [lo real].»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 6.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 16/21 (Día 6, mañana) · «Mercado Libre: tecnología hecha en LatAm»",
        "estado": "Guía para grabar",
        "datos": "40 s · 104 palabras · Life Is Good desde 1:34 · tomas: personajes/galperin (foto)",
        "escenas": [
          [
            "0–4",
            "Foto de Marcos Galperin. Texto: HECHO EN LATINOAMÉRICA",
            "«Una de las empresas de tecnología más grandes de Latinoamérica empezó en Argentina.»"
          ],
          [
            "4–16",
            "Caja: MARCOS GALPERIN · FUNDADOR DE MERCADO LIBRE",
            "«Marcos Galperin fundó Mercado Libre. Hoy es considerado la persona más rica de Argentina. Y desde 2019 vive en Uruguay, siempre en la región.»"
          ],
          [
            "16–28",
            "Kev a cámara. Idea: tecnología de la región para la región",
            "«Lo que me gusta de su historia es que es tecnología hecha en la región, para la región. No vino nadie de afuera a hacerlo por nosotros. La construyeron latinoamericanos, para latinoamericanos.»"
          ],
          [
            "28–40",
            "Kev a cámara",
            "«Eso es lo que quiero con PRIME: inteligencia artificial hecha aquí, para los negocios de aquí. Y si Mercado Libre pudo desde Argentina, nosotros podemos desde Bolivia.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Marcos Galperin). Foto: CC BY 4.0."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 17/21 (Día 6, tarde) · «Cómo se arma un empleado AI»",
        "estado": "Falta: Kev revisa los pasos",
        "datos": "40 s · 92 palabras · HIGHEST IN THE ROOM desde 0:00 · grabación de pantalla",
        "escenas": [
          [
            "0–4",
            "Kev frente a la computadora. Texto: ASÍ SE ARMA UN EMPLEADO AI",
            "«Te muestro cómo se arma un empleado AI desde cero.»"
          ],
          [
            "4–16",
            "Grabación de pantalla real del proceso (sin datos de clientes). Paso 1",
            "«Primero, le enseñamos el negocio: qué vende, los precios, los horarios, cómo habla con los clientes. Todo lo que un empleado nuevo tendría que aprender en su primera semana.»"
          ],
          [
            "16–28",
            "Pantalla. Paso 2",
            "«Después lo conectamos al WhatsApp del negocio y lo probamos con preguntas reales, hasta que responde como respondería el dueño. Le corregimos lo que responde mal, una y otra vez.»"
          ],
          [
            "28–40",
            "Kev a cámara + cierre fijo",
            "«Y listo, empieza a trabajar. Si quieres uno para tu negocio, escríbele al 72258926.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Los pasos se ajustan a cómo lo hace PRIME de verdad: Kev los revisa antes de grabar."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 18/21 (Día 6, noche) · «Día 6»",
        "estado": "Plantilla diaria",
        "datos": "26 s · 50 palabras · HIGHEST IN THE ROOM desde 0:00 (bajo)",
        "escenas": [
          [
            "0–3",
            "Kev a cámara, de noche. Marcador: Día 6 · $[X] / $1,000,000,000",
            "«Día 6. El marcador está en [cifra real].»"
          ],
          [
            "3–12",
            "Kev a cámara, celular en mano. Idea: lo más importante que pasó hoy en PRIME",
            "«Hoy pasó esto: [lo más importante del día, con pruebas: un cliente, una reunión, un empleado AI instalado, o nada].»"
          ],
          [
            "12–21",
            "Tomas del día grabadas por Kev. Idea: lo que salió mal o lo que aprendí",
            "«Mañana cierro la primera semana. Lo que más me costó: [algo real].»"
          ],
          [
            "21–26",
            "Kev a cámara",
            "«Mañana: [lo que viene]. Nos vemos en el Día 7.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Si hoy no entró nada, se dice tal cual: «Hoy no entró ningún cliente. Esto fue lo que hice.» Nada inventado.",
          "Arte del día: plantilla «Día N» del lienzo de artes."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 19/21 (Día 7, mañana) · «Amazon empezó vendiendo libros»",
        "estado": "Guía para grabar",
        "datos": "40 s · 96 palabras · Mask Off desde 0:12 · tomas: personajes/bezos (foto)",
        "escenas": [
          [
            "0–4",
            "Foto de Jeff Bezos. Texto: EMPEZÓ CON LIBROS",
            "«Amazon, una de las empresas más grandes del mundo, empezó vendiendo libros por internet.»"
          ],
          [
            "4–16",
            "Caja: JEFF BEZOS · FUNDADOR DE AMAZON",
            "«Jeff Bezos fundó Amazon, y al principio no vendía de todo. Vendía una sola cosa. Libros. Nada más.»"
          ],
          [
            "16–28",
            "Kev a cámara. Idea: empezar chico, con una cosa",
            "«Eso para mí es clave: no empiezas con todo. Empiezas con una cosa, la haces muy bien, y de ahí creces. Casi todos quieren hacer todo desde el día uno, y por eso no terminan nada.»"
          ],
          [
            "28–40",
            "Kev a cámara",
            "«PRIME empieza con una sola cosa: un empleado AI que atiende a tus clientes. Y de ahí vamos al billón. Una sola cosa, bien hecha, todos los días.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Datos: Wikipedia (Jeff Bezos y Amazon). Revisar la fuente sobre los libros antes de grabar. Foto: dominio público."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 20/21 (Día 7, tarde) · «Lo mejor de la semana»",
        "estado": "Se decide con métricas",
        "datos": "40 s · 8 palabras · La canción del video que más rindió",
        "escenas": [
          [
            "0–40",
            "Se repite el formato de la tarde que mejor rindió en la semana, con otro gancho y otra persona",
            "«[Según métricas: entrevista, cliente o adivina la cifra.]»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Se decide con las métricas de los días 1 a 6."
        ]
      },
      {
        "serie": "Semana 1",
        "titulo": "Semana 1 · 21/21 (Día 7, noche) · «Resumen de la semana 1»",
        "estado": "Plantilla semanal",
        "datos": "40 s · 51 palabras · Niagara Falls desde 0:15",
        "escenas": [
          [
            "0–4",
            "Marcador: Día 7 · $[X] / $1,000,000,000",
            "«Primera semana. El marcador está en [cifra real].»"
          ],
          [
            "4–16",
            "Tomas de la semana. Cajas con lo que pasó, día por día",
            "«Esta semana pasó esto: [los 3 hechos más importantes, reales].»"
          ],
          [
            "16–28",
            "Kev a cámara. Idea: lo que salió mal",
            "«Lo que salió mal: [lo real]. Y lo que voy a cambiar la semana que viene: [lo real].»"
          ],
          [
            "28–40",
            "Kev a cámara + cierre fijo",
            "«Semana dos, empezamos mañana. Si quieres un empleado AI, el WhatsApp está en mi perfil.»"
          ]
        ],
        "notas": [
          "Kev habla libre: la frase es un ejemplo de su forma de hablar (referentes/voz-kev.md). ~2.5 palabras por segundo.",
          "Solo hechos y cifras reales de la semana."
        ]
      }
    ] },
    { id: "metricas", tipo: "metricas", etiqueta: "Métricas", titulo: "Cómo le va a cada video" },
    { id: "notas", tipo: "notas", etiqueta: "Notas", titulo: "Notas de Kev" },
  ],
  notas: [],
}
