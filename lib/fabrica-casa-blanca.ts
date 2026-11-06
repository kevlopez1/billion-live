import type { ContenidoFabrica } from "@/lib/fabrica-reels"

// ──────────────────────────────────────────────────────────────
// LA FÁBRICA — LA CASA BLANCA PROJECT (/fabrica?canal=casa-blanca)
//
// Semilla del canal de la Casa Blanca. Misma forma que lib/fabrica-reels.ts,
// datos aparte. Aquí no graba nadie: los residentes viven la simulación y el
// estudio renderiza lo que pasa. Todo sale del plan
// (kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md) y de lib/fabrica/*.
// Lo que Kev todavía no decidió queda vacío o marcado como pendiente.
// ──────────────────────────────────────────────────────────────

export const FABRICA_CASA_BLANCA_ID = "casa-blanca"

export const FABRICA_CASA_BLANCA_BASE: ContenidoFabrica = {
  titulo: "Fábrica de videos",
  bajada:
    "Cómo lo que pasa cada día dentro de la Casa Blanca se convierte solo en videos horizontales con voz. Nadie graba: los residentes viven la simulación y el estudio renderiza. Si algo falla en el control, vuelve al guion o al render.",
  pasos: [
    { titulo: "1 · Ideas", detalle: "3–6 ideas (+1 de reserva) desde la memoria, la conciencia y la reflexión del día" },
    { titulo: "2 · Guion", detalle: "Episodio en JSON con Claude · guardas en código · segunda pasada" },
    { titulo: "3 · Voces", detalle: "Voces originales por arquetipo, nunca clonadas · el plano dura lo que su audio" },
    { titulo: "4 · Música", detalle: "Carpeta fija con licencia · rotada · baja cuando hay voz" },
    { titulo: "5 · Render", detalle: "Estudio determinístico con GPU · 1920×1080 o 1440×1080 · 60–90 s" },
    { titulo: "6 · Control de calidad", detalle: "Duración · sin cuadros negros · voz donde hay diálogo · rótulo de ficción" },
    { titulo: "7 · Aprobación (Kev)", detalle: "Solo los que llevan un personaje amarillo · sin respuesta en 24 h no sale", kev: true },
    { titulo: "8 · Publicación", detalle: "YouTube · Instagram · Facebook · TikTok · X, con su etiqueta de IA" },
    { titulo: "9 · Métricas", detalle: "A las 72 h y a los 7 días · lo que una red no da queda vacío, nunca en 0" },
  ],
  retornos: [
    { desde: 5, hasta: 4, etiqueta: "falla el control" },
    { desde: 6, hasta: 1, etiqueta: "cambios de Kev" },
    { desde: 8, hasta: 0, etiqueta: "cada domingo se ajusta el peso de cada pilar", punteado: true },
  ],
  secciones: [
    { id: "flujo", tipo: "flujo", etiqueta: "El flujo", titulo: "Cómo se arma cada video" },
    {
      id: "reglas",
      tipo: "lista",
      etiqueta: "Principios del canal",
      titulo: "Reglas de cada video",
      items: [
        "Nadie graba: lo que se publica sale de lo que vivieron los residentes en la simulación.",
        "Horizontal: 16:9 (1920×1080) o 4:3 (1440×1080), de 60 a 90 s. Los que van a TikTok, 61 s o más.",
        "Primera línea de cada texto: «Ficción hecha con IA. Personajes inspirados en figuras reales; no son ellas ni hablan por ellas.»",
        "El rótulo de ficción va dentro del video, del segundo 0 al final.",
        "Cada red con su etiqueta de IA. Si falta una, el video no se sube.",
        "Voces originales descritas por arquetipo. Nunca la voz clonada de una persona real.",
        "Un video con un personaje real (vivo o fallecido) no lleva PRIME, lo recaudado, la meta ni el reto.",
        "Vivos: de fondo, sin voz ni diálogo, nunca en título, miniatura ni junto a PRIME.",
        "Nunca: delitos, juicios, salud, sexo o familia de una persona real; política electoral; consejos de plata, salud o leyes; conspiraciones como hecho.",
        "Nunca el texto de un visitante. No se repite par de personajes ni tema en 7 días.",
        "Música con licencia, rotada (nunca dos días seguidos). Nada de música 100 % IA en YouTube.",
        "Título de 48 caracteres o menos. Miniatura: un cuadro del render, 3 palabras o menos, nunca la cara de una persona viva.",
        "En X, el texto va sin URL: el link solo en la bio.",
        "Español neutro, sin voseo.",
        "Interruptor: antes de cada paso se lee si la fábrica está pausada. Un privado inesperado o 2 fallos seguidos en una red la pausan sola.",
        "Si una plataforma o una persona reclama, se baja en menos de 24 h, sin discutir.",
        "Nada sale sin el «sí» de Kev mientras dure el modo aprobación.",
      ],
    },
    {
      id: "semaforo",
      tipo: "tabla",
      etiqueta: "Semáforo",
      titulo: "Quién puede salir solo",
      columnas: ["Color", "Personajes", "Qué pasa"],
      filas: [
        ["Verde", "Lincoln · Napoleón · Leonardo · Cleopatra · Sun Tzu · Marco Aurelio · Sócrates · el Gran Maestro · el Iluminado · Claude · ChatGPT", "Sale solo"],
        ["Amarillo", "Kobe · Jobs · Jesús", "Sale solo con el OK de Kev (la investigación recomienda rojo: lo decide Kev)"],
        ["Vivos", "Los residentes con «real: vivo» en personajes.ts", "Solo de fondo, sin voz ni diálogo"],
        ["Fuera", "Tate siempre · Trump fuera de cuadro hasta el 10-nov", "No aparecen"],
      ],
    },
    {
      id: "redes",
      tipo: "tabla",
      etiqueta: "Redes",
      titulo: "Dónde sale y cómo",
      columnas: ["Red", "Cómo se sube", "Etiqueta de IA", "Ojo"],
      filas: [
        ["YouTube", "API propia, privado + publishAt (solo ~3 h adelante)", "containsSyntheticMedia", "Un horizontal de 60 s no entra a Shorts"],
        ["Instagram", "lib/meta.ts, Reel con share_to_feed", "is_ai_generated", "Leer content_publishing_limit antes"],
        ["Facebook", "lib/meta.ts, /videos de la página", "Aviso en video y texto", "Los Reels por API exigen 9:16"],
        ["TikTok", "Upload-Post, a la hora de salida", "is_aigc (sin verificar que Upload-Post lo pase)", "Sin auditoría propia todo sale privado"],
        ["X", "API propia, pago por uso", "«Ficción con IA» en nombre y bio", "Sin URL en el texto"],
      ],
    },
    {
      id: "horarios",
      tipo: "lista",
      etiqueta: "Horarios",
      titulo: "Horas de salida (Bolivia)",
      items: [
        "Con 3 al día: 12:00 · 16:00 · 21:30.",
        "Con 6 al día: 10:00 · 12:00 · 14:00 · 16:00 · 21:00 · 22:30 (no antes de 30 días sin avisos de las plataformas).",
        "Ninguno a las 19:00 mientras dure la temporada (hasta el 22-nov): esa hora es de los episodios.",
        "Se renderiza el día anterior y hay una reserva de 3 a 5 videos solo con personajes verdes.",
      ],
    },
    { id: "mejores", tipo: "referentes", etiqueta: "Nuestros mejores videos", titulo: "El canal todavía no tiene videos publicados", refs: [] },
    { id: "referentes", tipo: "referentes", etiqueta: "Referentes", titulo: "Cómo se ve", refs: [] },
    {
      id: "musica",
      tipo: "tabla",
      etiqueta: "Música",
      titulo: "Pistas con licencia",
      columnas: ["Pista", "Artista", "Para qué", "Licencia", "Último uso"],
      filas: [],
    },
    { id: "ganchos", tipo: "lista", etiqueta: "Ganchos", titulo: "Ganchos que funcionaron", items: [] },
    {
      id: "guiones",
      tipo: "guiones",
      etiqueta: "Guiones",
      titulo: "Guiones generados",
      guiones: [
        {
          serie: "Borradores",
          titulo: "#1 · «Dos minutos» · Lincoln y Napoleón",
          estado: "Borrador para revisar",
          datos: "75 s · horizontal 16:9 · Columnata de noche · pilar liderazgo · título: Napoleón quiso dar un discurso de una hora",
          escenas: [
            ["0–6", "Columnata de noche. Lincoln camina despacio", "(pasos, viento)"],
            ["6–14", "Napoleón lo alcanza con un rollo de papel", "Napoleón: Mañana hablo ante todos. Tengo cuarenta páginas."],
            ["14–20", "Lincoln se detiene", "Lincoln: ¿Cuarenta?"],
            ["20–30", "Napoleón desenrolla el papel hasta el piso", "Napoleón: Batallas, reformas, el código civil. Cada página es una victoria."],
            ["30–42", "Lincoln sonríe y mira el papel", "Lincoln: En Gettysburg hablé dos minutos. Antes que yo, un hombre habló dos horas. ¿Sabes cómo se llamaba?"],
            ["42–46", "Napoleón duda", "Napoleón: … No."],
            ["46–56", "Lincoln sigue caminando", "Lincoln: Nadie lo sabe. Lo importante cabe en poco."],
            ["56–66", "Napoleón mira el rollo y arranca la primera hoja", "Napoleón: Una página. Una victoria."],
            ["66–75", "Plano abierto de la columnata: los dos se alejan", "Lincoln: Ahora sí te van a escuchar."],
          ],
          notas: [
            "Dato: el discurso de Gettysburg (1863) duró unos 2 minutos; Edward Everett habló unas 2 horas antes.",
            "Dato: el Código Civil de Napoleón es de 1804.",
            "Solo personajes en verde del semáforo.",
          ],
        },
        {
          serie: "Borradores",
          titulo: "#2 · «El que no se mueve» · Sun Tzu y Marco Aurelio",
          estado: "Borrador para revisar",
          datos: "70 s · horizontal 16:9 · Jardín de las Rosas de mañana · pilar disciplina · título: Sun Tzu y Marco Aurelio ante un mal día",
          escenas: [
            ["0–8", "Marco Aurelio escribe en su cuaderno, sentado", "(pájaros)"],
            ["8–16", "Sun Tzu se acerca con su pergamino", "Sun Tzu: Escribes como quien prepara una batalla."],
            ["16–28", "Marco no levanta la vista", "Marco Aurelio: Escribo para mí. Hoy me voy a encontrar con gente ingrata, mentirosa y envidiosa. Lo anoto para que no me sorprenda."],
            ["28–38", "Sun Tzu se sienta a su lado", "Sun Tzu: Conocer al enemigo antes de verlo. Lo apruebo."],
            ["38–50", "Marco cierra el cuaderno", "Marco Aurelio: No es un enemigo. El obstáculo es el camino."],
            ["50–60", "Sun Tzu mira las rosas", "Sun Tzu: Entonces la mejor victoria es la que no necesita pelea."],
            ["60–70", "Plano abierto del jardín", "Marco Aurelio: En eso, maestro, estamos de acuerdo."],
          ],
          notas: [
            "Fuente: Marco Aurelio, Meditaciones II.1 (la gente difícil) y V.20 (el obstáculo se vuelve camino).",
            "Fuente: Sun Tzu, El arte de la guerra III (vencer sin combatir).",
            "Solo personajes en verde del semáforo.",
          ],
        },
      ],
    },
    { id: "metricas", tipo: "metricas", etiqueta: "Métricas", titulo: "Cómo le va a cada video" },
    { id: "notas", tipo: "notas", etiqueta: "Notas", titulo: "Notas de Kev" },
  ],
  notas: [],
}
