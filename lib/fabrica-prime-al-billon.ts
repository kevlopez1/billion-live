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
    { id: "guiones", tipo: "guiones", etiqueta: "Guiones", titulo: "Guiones para grabar", guiones: [] },
    { id: "metricas", tipo: "metricas", etiqueta: "Métricas", titulo: "Cómo le va a cada video" },
    { id: "notas", tipo: "notas", etiqueta: "Notas", titulo: "Notas de Kev" },
  ],
  notas: [],
}
