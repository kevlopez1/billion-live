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

export type Guion = {
  serie?: string // grupo dentro de Guiones: «Personajes», «Con música»…
  titulo: string
  estado: string
  datos: string
  escenas: string[][] // [segundos "0–2", en pantalla, Kev dice]
  notas: string[]
}
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
  | { id: string; tipo: "metricas"; etiqueta: string; titulo: string }
  | { id: string; tipo: "guiones"; etiqueta: string; titulo: string; guiones: Guion[] }

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
        "Una vez por semana, alguien conocido en cámara y etiquetado, de Bolivia o de cualquier país. El video con Pampeño tiene 937K vistas.",
        "3 videos por día: mañana, tarde y noche. Se graba en lote cada 2 días.",
        "Se exporta siempre con la música incluida, desde su momento de más hype.",
        "Gancho en los primeros 2 segundos, que se entienda sin sonido.",
        "Subtítulos siempre, con los títulos de dos líneas de Kev.",
        "Etiqueta de precio en el primer cuadro: «Mercedes Mansory · $450,000».",
        "Menos de 60 segundos. El de Pampeño dura 53.",
        "Lo que gana se repite como serie: parte 2, parte 3.",
        "Al publicar se elige la misma canción en la biblioteca de la app.",
        "Nada se publica sin el «sí» de Kev.",
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
          paraKev: "Una vez por semana, alguien conocido en cámara, de Bolivia o del mundo.",
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
          paraKev: "Explicadores de PRIME: abrir con Kev animado junto al Mansory, tarjetas holograma con PRIME y los comprobantes, fondo negro y azul.",
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
          paraKev: "Un reel al mes sin texto: Kev, el auto y la ciudad, con dron y contraluz, más tomas de lejos con zoom.",
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
          paraKev: "Subtítulos con un color por persona (Kev en celeste). Cámara en el tablero con un cliente o invitado en el auto.",
        },
      ],
    },
    {
      id: "edicion-ia",
      tipo: "referentes",
      etiqueta: "Edición especial con IA",
      titulo: "Cómo se hace cada efecto",
      refs: [
        {
          nombre: "0 · Antes y después: lo que cambia la edición",
          url: "https://www.instagram.com/reel/DfSrDF-Riau/",
          datos: "Reel de 9 s · izquierda el video crudo, derecha el editado",
          imagenes: ["/fabrica/ia/ia-17-v1.jpg"],
          ancho: true,
          puntos: [
            "El video crudo es un cuarto común con luz plana; el editado es otro cuarto, cálido y elegante.",
            "Lo que lo hace sentir caro: 1) nada queda quieto, 2) cada palabra tiene su propio estilo, 3) el texto vive entre capas (delante y detrás de él), 4) el fondo cambia por escena, 5) un solo color cálido en todo.",
            "Los subtítulos no son una caja abajo: son parte de la escena.",
          ],
          paraKev: "Las piezas 1 a 16 de esta lista se hacen con código, en local y gratis. Solo el cambio de cuarto (fondo nuevo con IA de video) cuesta créditos y va con el «sí» de Kev.",
        },
        {
          nombre: "1 · Palabras en 3D que giran alrededor de la cabeza y se alejan",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 0–1 · «Wait, how are these words going…»",
          imagenes: ["/fabrica/ia/ia-01-v1.jpg"],
          ancho: true,
          puntos: [
            "Cada palabra entra sola, justo cuando la dice, desde lejos y desenfocada.",
            "Las palabras viajan por un arco en 3D alrededor de la cabeza: las nuevas adelante, las anteriores se van hacia atrás, más chicas y borrosas. No desaparecen de golpe.",
            "Mezcla de letras: serif cursiva para «Wait,» y sans gruesa para el resto.",
          ],
          paraKev: "Tiempos por palabra con Whisper → cada palabra es un elemento con perspectiva CSS (rotateY, translateZ) que avanza por una curva; desenfoque según la distancia. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "2 · Cinta que pasa por delante y por detrás de él",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 1.25–2.5 · «behind my head?»",
          imagenes: ["/fabrica/ia/ia-02-v1.jpg"],
          ancho: true,
          puntos: [
            "Fondo blanco liso y él en silueta negra.",
            "Una cinta café 3D se dibuja y lo rodea: un tramo pasa por detrás del cuerpo y otro por delante.",
            "«head?» en serif gigante, también entre capas.",
          ],
          paraKev: "Máscara de la persona (herramientas/recorte-persona) → capas: fondo, cinta de atrás, persona, cinta de adelante. La cinta es un trazo SVG que se dibuja con stroke-dashoffset. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "3 · Texto 3D con explosión de partículas",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 2.5–4 · «OH SH*T»",
          imagenes: ["/fabrica/ia/ia-03-v1.jpg"],
          ancho: true,
          puntos: [
            "Letras con volumen (extrusión 3D) que entran con desenfoque de movimiento.",
            "Al golpe, salen pedacitos blancos volando (partículas) y la cámara tiembla.",
            "Corte rápido: él sale corriendo del cuadro.",
          ],
          paraKev: "Texto 3D con sombras apiladas (o Three.js) + partículas generadas con semilla fija + temblor de cámara de 3–4 cuadros. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "4 · Un texto se transforma en otro",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 4.5–6.5 · «every time I MOVE it SWITCHES UP»",
          imagenes: ["/fabrica/ia/ia-04-v1.jpg"],
          ancho: true,
          puntos: [
            "«every time» baja y se desenfoca mientras «I MOVE» aparece con desenfoque y la M pasa detrás de él.",
            "«switches up» cambia de letra en vivo: redonda → condensada en mayúsculas → serif cursiva. La palabra hace lo que dice.",
            "Las transiciones duran 3–5 cuadros, siempre con desenfoque: nunca un corte seco.",
          ],
          paraKev: "Dos capas de texto que se cruzan con fundido + desenfoque; el cambio de fuente se hace en el cuadro más borroso para que no se note el salto. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "5 · Neón que cambia de color",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 6.75–8 · «glowing letters»",
          imagenes: ["/fabrica/ia/ia-05-v1.jpg"],
          ancho: true,
          puntos: [
            "Letra redonda con brillo fuerte (glow) que pasa de amarillo a rojo a azul.",
            "El brillo tiñe el fondo: el cuarto entero toma el color del neón.",
            "La segunda línea («letters») entra debajo, con el mismo brillo.",
          ],
          paraKev: "text-shadow en varias capas con color animado + una capa de color encima del video en modo «overlay» que sigue el mismo color. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "6 · Líneas que caen una por una",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 8.25–9.5 · «BIG WHITE CAPITALS»",
          imagenes: ["/fabrica/ia/ia-06-v1.jpg"],
          ancho: true,
          puntos: [
            "Tres palabras en mayúsculas condensadas, apiladas.",
            "Cada línea entra desde más grande y desenfocada hasta asentarse, y empuja a las anteriores.",
            "La última pasa detrás de su cabeza.",
          ],
          paraKev: "Fuente condensada (tipo Anton/Bebas) + escala 1.3→1 con desenfoque por línea, escalonadas 4–6 cuadros. Capa detrás con la máscara. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "7 · Texto que se deshace en polvo",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 9.75–11 · «chunky italics.»",
          imagenes: ["/fabrica/ia/ia-07-v1.jpg"],
          ancho: true,
          puntos: [
            "Cursiva gruesa que entra con desenfoque de movimiento.",
            "Al terminar la frase, las letras se desintegran en polvo que se lleva el viento.",
            "Marca el cambio de escena.",
          ],
          paraKev: "Se toma el texto como imagen, se parte en miles de puntos y cada punto se mueve con ruido (simplex) y se apaga. Se hace con canvas en el render. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "8 · Letras que se arman solas + logo",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 11–12.5 · «i've set Claude Code»",
          imagenes: ["/fabrica/ia/ia-08-v1.jpg"],
          ancho: true,
          puntos: [
            "«Claude Code» en el color de la marca: las letras llegan desordenadas, a distintas alturas, y se acomodan.",
            "El logo (el asterisco) aparece girando al lado.",
            "Sirve para nombrar una marca: la marca se ve, no solo se dice.",
          ],
          paraKev: "Cada letra con su posición inicial al azar (semilla fija) y curva expo-out hacia su lugar. En los videos de Kev: «PRIME» con su logo (conPrime). Gratis, en la Mac de Kev.",
        },
        {
          nombre: "9 · Anotaciones de tipografía",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 12.5–13.5 · «up to design all my captions,»",
          imagenes: ["/fabrica/ia/ia-09-v1.jpg"],
          ancho: true,
          puntos: [
            "La palabra «captions,» aparece con líneas de diseñador: X-HEIGHT, BASELINE y «WGHT 540 TRACK +0».",
            "Los números cambian mientras la palabra se ajusta: se ve «técnico» y caro.",
            "Letra monoespaciada chica para las notas.",
          ],
          paraKev: "Líneas SVG finas que se dibujan + números que cuentan; la fuente variable cambia de peso (wght) en vivo. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "10 · Palabras detrás de la cabeza, en capas",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 13.75–15 · «even the words behind my head.»",
          imagenes: ["/fabrica/ia/ia-10-v1.jpg"],
          ancho: true,
          puntos: [
            "Las palabras flotan a distintas profundidades detrás de su cabeza y se mueven suave.",
            "Las de atrás más chicas y borrosas, las de adelante nítidas.",
            "Remata con «head.» en serif grande, desenfocada → nítida.",
          ],
          paraKev: "Máscara de la persona + palabras con distinta escala, desenfoque y velocidad (paralaje). Gratis, en la Mac de Kev.",
        },
        {
          nombre: "11 · Seguimiento de cara con datos",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 16–18 · «tracking my FACE · 10x a second»",
          imagenes: ["/fabrica/ia/ia-11-v1.jpg"],
          ancho: true,
          puntos: [
            "Recuadro amarillo que sigue la cara con «FACE 0.929 · X 0716 Y 0971».",
            "Silueta negra sobre fondo crema para explicar la idea.",
            "«10x» enorme en monoespaciada amarilla y «a second» debajo; el «1» va cambiando.",
          ],
          paraKev: "Detección de cara de macOS cuadro a cuadro (ya está en herramientas/recorte-persona: caras.json). Los números son reales, no inventados. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "12 · Flechas a mano y corchetes punteados",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 19.5–22.25 · «so my captions never end up underneath them.»",
          imagenes: ["/fabrica/ia/ia-12-v1.jpg"],
          ancho: true,
          puntos: [
            "Flechas blancas dibujadas a mano que se trazan alrededor de su brazo.",
            "«never» en serif roja con un pequeño error digital (glitch).",
            "Un corchete punteado en L se dibuja y encierra «end up underneath them.».",
          ],
          paraKev: "Trazos SVG con stroke-dashoffset (se dibujan solos) + línea punteada animada. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "13 · Contorno punteado + texto que sigue la silueta",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 22.5–26 · «normally you have to cut yourself out frame by frame»",
          imagenes: ["/fabrica/ia/ia-13-v1.jpg"],
          ancho: true,
          puntos: [
            "Toma desde arriba, acostado sobre una alfombra.",
            "Una línea punteada que se mueve (hormigas) recorre su contorno exacto.",
            "La frase se escribe siguiendo la curva de su cuerpo, alrededor de la cabeza.",
          ],
          paraKev: "Del borde de la máscara se saca el contorno (marching squares) → trayecto SVG → línea punteada animada + textPath. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "14 · Transición orgánica y fondo nuevo",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 25.75–27.75 · «but i'm just lying here.»",
          imagenes: ["/fabrica/ia/ia-14-v1.jpg"],
          ancho: true,
          puntos: [
            "Una mancha orgánica se expande y borra la alfombra: queda un fondo café liso con grano.",
            "Él se queda: solo cambia lo que hay detrás.",
            "«lying here.» en serif grande.",
          ],
          paraKev: "Máscara animada con forma de mancha (ruido) entre el fondo viejo y el nuevo; la persona va encima con su máscara. Gratis, en la Mac de Kev.",
        },
        {
          nombre: "15 · Cuarto en líneas y «no existe»",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 28–30 · «and this ROOM doesn't actually exist.»",
          imagenes: ["/fabrica/ia/ia-15-v1.jpg"],
          ancho: true,
          puntos: [
            "«ROOM» entra borrosa y queda solo en contorno.",
            "El cuarto se convierte en líneas blancas en perspectiva (wireframe).",
            "Remate: un círculo de luz revela su cuarto real, blanco y común.",
          ],
          paraKev: "Las líneas se dibujan con SVG en perspectiva (gratis). El cuarto elegante en sí es un fondo generado con IA de video o de imagen: cuesta créditos, solo con el «sí» de Kev.",
        },
        {
          nombre: "16 · Cierre dorado para comentarios",
          url: "https://www.instagram.com/reel/DfMiYjYRbMI/",
          datos: "Segundo 30–32 · «comment CAPTIONS and i'll send you a breakdown.»",
          imagenes: ["/fabrica/ia/ia-16-v1.jpg"],
          ancho: true,
          puntos: [
            "«comment» en arco, encima.",
            "«CAPTIONS» en letras doradas metálicas que entran una por una, girando.",
            "Flecha a mano que apunta a los comentarios + «a breakdown.» en serif.",
          ],
          paraKev: "Degradado dorado en el texto + brillo que pasa + letras escalonadas. Para Kev: «Comenta FIRMA» o «Comenta PRIME» en dorado. Gratis, en la Mac de Kev.",
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
      columnas: ["Canción", "Artista", "Para qué", "Momento 1", "Otros momentos"],
      filas: [
        ["Band4Band", "Central Cee, Lil Baby", "Gancho del Mansory, retos en la calle", "0:55–1:15", "0:09–0:24"],
        ["Wake Up in the Sky", "Gucci Mane, Bruno Mars, Kodak Black", "Vlog del día, eventos", "0:00–0:25", "0:35–0:50"],
        ["Life Is Good", "Future, Drake", "Hitos, antes y después", "1:34–1:49", "0:20–0:35"],
        ["Last Breath", "Future", "Días difíciles", "0:21–0:33", "1:03–1:18"],
        ["Niagara Falls", "Metro Boomin, Travis Scott, 21 Savage", "Resumen, cuenta regresiva", "0:15–0:30", "0:48–1:03"],
        ["Mask Off", "Future", "Contador subiendo, comprobantes", "0:12–0:27", "0:00–0:26 · 0:39–0:54"],
        ["Money In The Grave", "Drake, Rick Ross", "Ventas cerradas", "0:05–0:38", "0:41–0:56"],
        ["All The Stars", "Kendrick Lamar, SZA", "La meta: EE.UU., Dubái", "0:35–0:50", "1:55–2:10"],
        ["Flashing Lights", "Kanye West", "Autos de noche", "1:18–1:33", "0:28–0:43"],
        ["Superhero", "Metro Boomin, Future, Chris Brown", "Robots, lanzamientos", "0:42–0:57", "1:14–1:29"],
        ["HIGHEST IN THE ROOM", "Travis Scott", "Noches de trabajo", "0:00–0:30", "1:11–1:26"],
        ["SICKO MODE", "Travis Scott, Drake", "Cambios de ritmo, revelaciones, el Mansory", "0:55–1:10", "3:11–3:26"],
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
    {
      id: "guiones",
      tipo: "guiones",
      etiqueta: "Guiones",
      titulo: "Guiones para grabar",
      guiones: [
        {
          serie: "Personajes",
          titulo: "Serie personajes #1 · «Señor Mansory»",
          estado: "Listo para grabar",
          datos: "45 s · etiquetar a @mansory · música SICKO MODE desde 0:55",
          escenas: [
            ["0–2", "Kev a cámara con el billete de $10. Etiqueta: Mercedes Mansory · $450,000", "Señor Mansory: con estos 10 dólares me voy a comprar su auto."],
            ["2–6", "Toma propia del Mansory. Marcador: Día N · monto del día / $450K", "Sí, el de 450 mil dólares."],
            ["6–14", "Kev caminando por Santa Cruz", "Desde Bolivia, un país quebrado. Sin herencia, sin préstamo."],
            ["14–24", "Comprobantes reales y el contador subiendo", "Cada dólar sale de mi empresa, PRIME. Ya vamos [monto del día]."],
            ["24–34", "Kev a cámara, más cerca", "Y cuando lo tenga, señor Mansory, quiero que usted me lo entregue en persona."],
            ["34–40", "Pausa de 1 s con la música baja, luego el golpe", "Le quedan 8 meses para preparar las llaves."],
            ["40–45", "Cierre fijo", "Firma el Mercedes por 10 dólares en kevproject.world. ¿Crees que lo logro?"],
          ],
          notas: [
            "Texto del post: «@mansory, nos vemos en Dubái 🇧🇴».",
            "El plazo se cuenta hasta el límite de junio de 2027: recalcular el día que se grabe.",
            "El monto es el real del día, el de la web.",
            "Si Mansory responde o da like: parte 2 «Mansory me respondió» el mismo día.",
          ],
        },
        {
          serie: "Con música",
          titulo: "Comprobantes · «Mask Off»",
          estado: "Idea",
          datos: "15 s · Mask Off 0:12–0:27 · fuerte · casi sin voz",
          escenas: [
            ["0–2", "Billete de $10 a cámara. Texto: De $10 a un Mercedes Mansory", "(sin voz)"],
            ["2–5", "Un comprobante real por golpe del beat, con su monto grande", "(sin voz)"],
            ["5–9", "Más comprobantes, cada vez más rápido. El contador sube en una esquina", "(sin voz)"],
            ["9–12", "Kev mirando a cámara, serio. Marcador: Día N · [monto] / $450K", "Todo real."],
            ["12–15", "Cierre fijo en pantalla", "Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Un corte en cada golpe del beat.",
            "Los comprobantes son los de la web; tapar datos de clientes si hace falta.",
          ],
        },
        {
          serie: "Con música",
          titulo: "Por qué lo hago · «Last Breath»",
          estado: "Idea",
          datos: "12 s · Last Breath 0:21–0:33 · inspiracional",
          escenas: [
            ["0–3", "Santa Cruz de noche, Kev caminando de espaldas", "(voz en off) Me dijeron que desde Bolivia no se podía."],
            ["3–6", "Kev trabajando tarde, la pantalla ilumina su cara", "Así que lo hago en público."],
            ["6–9", "Foto del Mansory; la cámara se acerca despacio", "Cada dólar, con comprobante."],
            ["9–12", "Texto grande: Faltan $[lo que falta]", "(sin voz)"],
          ],
          notas: [
            "Pocas palabras, voz baja. La música hace el resto.",
            "Color frío y oscuro.",
          ],
        },
        {
          serie: "Con música",
          titulo: "Un día del reto · «Money In The Grave»",
          estado: "Idea",
          datos: "33 s · Money In The Grave 0:05–0:38 · vlog",
          escenas: [
            ["0–3", "Alarma a las 6 a. m. Texto: Día N del reto", "(sin voz)"],
            ["3–10", "Cortes en el beat: café, auto, reunión con un cliente, apretón de manos", "(sin voz)"],
            ["10–18", "El empleado AI de PRIME trabajando en pantalla; un pago que entra", "Esto es lo que paga el Mercedes."],
            ["18–26", "Robot, oficina, Kev contando el día a cámara", "Hoy entraron [monto]."],
            ["26–33", "Marcador del día y cierre fijo", "Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Sirve como formato diario: se repite cada semana cambiando las tomas.",
            "Un corte cada 1–2 s.",
          ],
        },
        {
          serie: "Con música",
          titulo: "La meta · «All The Stars»",
          estado: "Idea",
          datos: "15 s · All The Stars 0:35–0:50 · inspiracional",
          escenas: [
            ["0–3", "Kev mirando el cielo o la ciudad desde arriba", "(sin voz)"],
            ["3–12", "Los hitos aparecen uno por uno con un ✓ en los logrados: $10K · GITEX Dubái · $100K · Silicon Valley · $450K", "(sin voz)"],
            ["12–15", "Texto: Hoy: [monto]. Mira hasta dónde llego", "(sin voz)"],
          ],
          notas: [
            "Solo texto y música: funciona sin sonido.",
            "Los hitos son los de la web.",
          ],
        },
        {
          serie: "Con música",
          titulo: "El cambio · «SICKO MODE»",
          estado: "Idea",
          datos: "15 s · SICKO MODE 0:55–1:10 · fuerte, cambio de ritmo",
          escenas: [
            ["0–5", "Antes: Kev con el billete de $10, imagen apagada", "(sin voz)"],
            ["5–6", "Corte negro justo en el cambio del beat", "(sin voz)"],
            ["6–12", "Después: tomas rápidas del Mansory, del contador y de Kev con traje", "(sin voz)"],
            ["12–15", "Texto: Día N. Esto recién empieza", "(sin voz)"],
          ],
          notas: [
            "El golpe va exacto en el cambio de ritmo de la canción.",
            "Se puede repetir en cada hito: el antes y el después.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 1 · «Con este billete de $10…»",
          estado: "Listo para grabar",
          datos: "35 s · Band4Band 0:55 · a cámara",
          escenas: [
            ["0–2", "Billete de $10 pegado a la lente. Etiqueta: Mercedes Mansory · $450,000", "Con este billete de 10 dólares me voy a comprar un Mercedes de 450 mil."],
            ["2–6", "Foto o toma del Mansory", "Sí, este. El Mansory."],
            ["6–14", "Kev caminando. Marcador: Día N · [monto] / $450K", "Empecé con 10 dólares. Hoy voy [monto]. Todo con comprobante."],
            ["14–24", "Comprobantes reales y el empleado AI de PRIME trabajando", "Cada dólar sale de mi empresa, PRIME: empleados de inteligencia artificial para negocios."],
            ["24–30", "Kev a cámara, más cerca", "Tengo hasta junio de 2027. Lo hago en público para que me veas ganar o perder."],
            ["30–35", "Cierre fijo", "Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Es el gancho principal del reto: sirve como video fijo (anclado) del perfil.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 5 · «Si pierdo este reto, lo pierdo en público»",
          estado: "Listo para grabar",
          datos: "30 s · Last Breath 0:21 · serio",
          escenas: [
            ["0–2", "Kev a cámara, primer plano, sin música", "Si pierdo este reto, lo pierdo en público."],
            ["2–8", "Entra la música. La web kevproject.world con el contador en vivo", "Todo lo que gano está aquí, en vivo, con comprobantes."],
            ["8–16", "Tomas de días malos: Kev cansado, de noche, trabajando", "Hay días que no entra nada. También los muestro."],
            ["16–24", "Marcador: [monto] / $450K. Faltan $[lo que falta]", "Me faltan [lo que falta]. Y quedan 8 meses."],
            ["24–30", "Kev a cámara", "Si quieres ver si lo logro, quédate. Y si quieres ser parte, firma el Mercedes por 10 dólares."],
          ],
          notas: [
            "La honestidad es el gancho: mostrar un día malo de verdad.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 8 · «Desde un país quebrado…»",
          estado: "Listo para grabar",
          datos: "35 s · Niagara Falls 0:15 · Bolivia",
          escenas: [
            ["0–2", "Kev en una calle de Santa Cruz. Texto: Desde un país quebrado 🇧🇴", "Desde un país quebrado voy a comprar el auto más caro de Bolivia."],
            ["2–8", "Tomas de Santa Cruz: mercado, tráfico, filas", "Aquí muchos dicen que no se puede emprender."],
            ["8–18", "Kev en reunión con un cliente; comprobante en pantalla", "Yo vendo empleados de inteligencia artificial a negocios. Con eso pago el reto."],
            ["18–28", "Mansory + marcador del día", "450 mil dólares. Voy [monto]."],
            ["28–35", "Cierre fijo", "Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Antes de publicar, confirmar el dato de «el auto más caro de Bolivia».",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 9 · «En Bolivia te dicen que es imposible»",
          estado: "Listo para grabar",
          datos: "25 s · SICKO MODE 0:55 · prueba",
          escenas: [
            ["0–2", "Kev a cámara, ceja levantada", "En Bolivia te dicen que es imposible. Mira esto."],
            ["2–12", "Pantalla del celular: pagos entrando uno tras otro (con datos tapados)", "(sin voz)"],
            ["12–18", "Contador subiendo hasta [monto]", "Esto es lo que facturé en [N] días."],
            ["18–25", "Kev a cámara + cierre fijo", "Desde Bolivia. Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "El corte de «Mira esto» cae justo en el cambio de ritmo de SICKO MODE.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 14 · «Esta IA me está pagando el Mercedes»",
          estado: "Listo para grabar",
          datos: "35 s · Superhero 0:42 · PRIME",
          escenas: [
            ["0–2", "Pantalla con el empleado AI respondiendo a un cliente. Texto: Esta IA me paga el Mercedes", "Esta inteligencia artificial me está pagando el Mercedes."],
            ["2–12", "Grabación de pantalla: el empleado AI atiende, agenda y cobra", "Atiende a los clientes de un negocio, agenda y cobra. Las 24 horas."],
            ["12–20", "Kev con un cliente real (dueño de negocio)", "Se la instalo a negocios como este."],
            ["20–28", "Comprobante de pago + marcador", "Cada pago va directo al reto. Voy [monto]."],
            ["28–35", "Kev a cámara + cierre", "¿Lo quieres en tu negocio? Escríbeme. Y firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Usar tarjetas holograma estilo Iman para mostrar lo que hace el empleado AI.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 17 · «Robots humanoides a Bolivia»",
          estado: "Listo para grabar",
          datos: "30 s · Superhero 1:14 · robots",
          escenas: [
            ["0–2", "Toma del robot. Texto: Robots humanoides · Bolivia", "Seremos los primeros en traer robots humanoides a Bolivia."],
            ["2–10", "Tomas de robots trabajando (con licencia o propias)", "Robots que trabajan en empresas, no de juguete."],
            ["10–20", "Kev explicando a cámara", "Primero fueron los empleados de inteligencia artificial. El siguiente paso es el cuerpo."],
            ["20–25", "Marcador del reto", "Todo esto también es parte del camino al Mansory."],
            ["25–30", "Pregunta + cierre", "¿En qué negocio pondrías un robot? Te leo."],
          ],
          notas: [
            "Solo tomas de robots con licencia o grabadas por nosotros.",
            "Confirmar antes que el plan de traer robots es real y anunciable.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 20 · «¿Firmarías un Mercedes por $10?»",
          estado: "Listo para grabar",
          datos: "25 s · Wake Up in the Sky 0:00 · firma",
          escenas: [
            ["0–2", "Kev con un marcador frente a la foto del Mansory", "¿Firmarías un Mercedes por 10 dólares?"],
            ["2–10", "Pantalla de kevproject.world: la sección Firma el Mercedes", "Pones tu nombre y va en la carrocería del Mansory cuando lo compre."],
            ["10–18", "Nombres de gente que ya firmó (si hay permiso) o el contador de firmas", "Ya firmaron [N] personas."],
            ["18–25", "Kev a cámara + cierre", "Cupos limitados. Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Es el video de venta directa de la firma: fijarlo en el perfil.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 26 · «Si ganas en bolivianos, estás perdiendo»",
          estado: "Listo para grabar",
          datos: "35 s · Money In The Grave 0:05 · dinero",
          escenas: [
            ["0–2", "Kev con billetes en bolivianos en una mano y un dólar en la otra", "Si ganas en bolivianos, estás perdiendo."],
            ["2–12", "Gráfico simple: el dólar oficial y el del mercado", "El dólar oficial dice una cosa. En la calle cuesta otra: [dato real]."],
            ["12–22", "Kev a cámara", "Por eso todo lo que vendo, lo cobro en dólares. Clientes de afuera también."],
            ["22–30", "Marcador del reto en dólares", "Voy [monto] en dólares."],
            ["30–35", "Pregunta + cierre", "¿Tú en qué cobras? Te leo. Y firma el Mercedes por 10 dólares."],
          ],
          notas: [
            "El dato del dólar se busca el día que se graba, con fuente.",
            "Tema delicado: hablar de la experiencia propia, no dar consejo financiero.",
          ],
        },
        {
          serie: "Desde los ganchos",
          titulo: "Gancho 27 · «Elon Musk durmió en su oficina»",
          estado: "Listo para grabar",
          datos: "35 s · Last Breath 1:03 · historia de famoso",
          escenas: [
            ["0–2", "Foto de Elon Musk (con licencia) + Kev", "¿Sabías que Elon Musk durmió en su oficina para no quebrar?"],
            ["2–12", "Tomas de oficina de noche, escritorio, sofá", "Al principio no tenía para un departamento. Dormía donde trabajaba."],
            ["12–20", "Kev trabajando de noche en su oficina", "Yo no duermo en la oficina. Pero casi."],
            ["20–28", "Marcador del reto", "Voy [monto] de 450 mil."],
            ["28–35", "Kev a cámara + cierre", "Los que llegan lejos hacen lo que otros no. Firma el Mercedes por 10 dólares en kevproject.world."],
          ],
          notas: [
            "Contar la historia de Musk solo con datos verificados (fuente) y sin usar sus videos.",
          ],
        },
      ],
    },
    { id: "metricas", tipo: "metricas", etiqueta: "Métricas", titulo: "Cómo le va a cada video" },
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
    case "metricas":
      return true
    case "guiones":
      return Array.isArray(x.guiones) && x.guiones.every((g) => { const q = g as Record<string, unknown>; return q && (q.serie === undefined || txt(q.serie)) && txt(q.titulo) && txt(q.estado) && txt(q.datos) && Array.isArray(q.escenas) && q.escenas.every(txts) && txts(q.notas) })
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
