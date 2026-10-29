// ──────────────────────────────────────────────────────────────
// EL CALENDARIO DE LA CASA BLANCA PROJECT
//
// Cada video que sale, con su fecha, sus redes, su texto y su guion. Es la
// única fuente: el estudio filma desde aquí y /publicar lee de aquí.
// ──────────────────────────────────────────────────────────────

import type { EntradaCalendario } from "./guion"

// Temporada 1: del viernes 30 de octubre al domingo 29 de noviembre de 2026,
// siempre a las 19:00 de Bolivia. El documento de la serie (ganchos, voz
// opcional, reglas y medición) vive en kev-project-gta:
// estrategia-reto/10-CASA-BLANCA-PROJECT.md.
//
// - {RECAUDADO} y {META} los llena el estudio desde lib/contador.ts: aquí
//   nunca va un monto a mano.
// - "PRIME" en mayúsculas es donde el estudio pone el logo.
// - Todo diálogo va en "seguir" con "reunir": la ronda lleva primero al
//   seguido y después a los demás de la escena, así se ve la cara de quien
//   habla. Una sola persona en "reunir" queda en el centro exacto del lugar.
// - Los consejos se filman a las 15:05: de 16:00 a 19:30 la sala de guerra
//   tiene personas vivas por horario.

export const CALENDARIO: EntradaCalendario[] = [
  // 2026-10-30 · especial
  {
    fecha: "2026-10-30",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "especial",
    texto: "Napoleón, Sócrates, Leonardo, Lincoln y dos IA viven en la misma Casa Blanca. Cada uno dirige un departamento de 100 puestos de IA, y el objetivo es real: llegar a un Mercedes Mansory con ingresos reales de PRIME. El domingo bajamos 60 metros.\n\nNuevo video martes, jueves, sábado y domingo a las 19:00 (hora de Bolivia).\nEntra a la casa: kevproject.world/casa-blanca\n\nFicción hecha con IA: personajes inspirados en figuras reales. No son declaraciones reales.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep01-trailer",
      titulo: "Napoleón, Sócrates y dos IA en la Casa Blanca",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 7, camara: { tipo: "toma", toma: "portico-norte" }, hora: "17:20", titulo: "24 residentes. Ninguno es humano.", rotulo: "La Casa Blanca Project · Pórtico Norte · 17:20" },
        { dur: 7, camara: { tipo: "seguir", personaje: "marco" }, hora: "09:35", reunir: ["marco", "claude"], rotulo: "Marco Aurelio · emperador de Roma (161–180)",
          dialogo: [
            { quien: "claude", texto: "¿Por qué anotas todo cada noche?" },
            { quien: "marco", texto: "Para recordarme lo que ya sé y suelo olvidar." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "leonardo" }, hora: "15:15", rotulo: "Leonardo da Vinci · pintor e inventor (1452–1519)",
          dialogo: [
            { quien: "leonardo", texto: "Mi disciplina era observar, no terminar." },
          ],
        },
        { dur: 7, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["napoleon", "suntzu", "socrates", "claude", "chatgpt"], titulo: "22 líderes. 22 departamentos.", rotulo: "100 puestos de IA en cada uno · Sala de guerra" },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "napoleon", texto: "¡Un mapa, rápido! Esto es una oportunidad." },
            { quien: "suntzu", texto: "Todavía no." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "chatgpt" }, hora: "12:05", reunir: ["chatgpt", "claude"], rotulo: "Claude y ChatGPT · las dos IA de la casa",
          dialogo: [
            { quien: "chatgpt", texto: "¡Aquí van tres opciones!" },
            { quien: "claude", texto: "Con una basta." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "lincoln" }, hora: "20:35", rotulo: "Abraham Lincoln · 16.º presidente (1861–1865)" },
        { dur: 9, camara: { tipo: "toma", toma: "bajada" }, hora: "16:00", titulo: "El reto es real", rotulo: "Recaudado: {RECAUDADO} de {META}" },
        { dur: 6, camara: { tipo: "toma", toma: "maqueta" }, hora: "17:40", maqueta: true, titulo: "Y esto es solo la superficie.", rotulo: "Domingo: lo que hay 60 metros abajo" },
      ],
    },
  },
  // 2026-10-31 · especial
  {
    fecha: "2026-10-31",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "especial",
    texto: "2:05 a. m. Todos duermen en La Casa Blanca Project. Las cámaras no. La leyenda dice que Lincoln todavía camina por la casa de noche.\n\nFeliz noche de brujas. Mañana bajamos 60 metros.\nkevproject.world/casa-blanca\n\nFicción hecha con IA: personajes inspirados en figuras reales.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep02-la-noche-de-lincoln",
      titulo: "2:05 a. m.: algo camina por la Casa Blanca",
      formato: "4:3",
      visor: "camara",
      planos: [
        { dur: 5, camara: { tipo: "lugar", lugar: "columnata" }, hora: "02:05", titulo: "Algo camina por la columnata.", rotulo: "Columnata Oeste · 02:05 · todos duermen" },
        { dur: 6, camara: { tipo: "seguir", personaje: "lincoln" }, titulo: "Es él.", rotulo: "Abraham Lincoln · 16.º presidente (1861–1865)" },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "claude"],
          dialogo: [
            { quien: "claude", texto: "¿Usted es el fantasma de la leyenda?" },
          ],
        },
        { dur: 8, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "lincoln"],
          dialogo: [
            { quien: "lincoln", texto: "Dicen que mi fantasma ronda esta casa." },
            { quien: "lincoln", texto: "Solo salgo a estirar las piernas." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "claude"],
          dialogo: [
            { quien: "claude", texto: "¿Usted tampoco duerme?" },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "lincoln"],
          dialogo: [
            { quien: "lincoln", texto: "Macbeth no duerme. Yo tampoco, a veces." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "iluminado" }, titulo: "No eran los únicos despiertos.", rotulo: "Jardín Sur · 02:10",
          dialogo: [
            { quien: "iluminado", texto: "Te esperaba." },
          ],
        },
        { dur: 6, camara: { tipo: "lugar", lugar: "columnata" }, titulo: "¿Quién más camina de noche?", rotulo: "Dato real: a Lincoln lo velaron en el Salón Este de esta casa, en 1865." },
      ],
    },
  },
  // 2026-11-01 · consejo
  {
    fecha: "2026-11-01",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "consejo",
    texto: "Capítulo 1. Arriba, la Casa Blanca con medidas reales aproximadas. Abajo, tres pisos y una ciudad a 60 metros que no existen: los inventamos y lo decimos. En la Sala de Control, una pantalla muestra el único número real: lo recaudado en el reto.\n\nRecórrela tú: kevproject.world/casa-blanca\n\nFicción hecha con IA: personajes inspirados en figuras reales. El número sale del contador del reto.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep03-capitulo-1-lo-que-hay-debajo",
      titulo: "Capítulo 1: lo que hay debajo de la Casa Blanca",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 4, camara: { tipo: "lugar", lugar: "ciudad-plaza" }, hora: "21:00", titulo: "60 metros debajo de la Casa Blanca.", rotulo: "Atrio del Pozo · ficción" },
        { dur: 8, camara: { tipo: "toma", toma: "dron" }, hora: "10:00", titulo: "Arriba, la casa real.", rotulo: "7,3 hectáreas · 132 habitaciones · 35 baños" },
        { dur: 8, camara: { tipo: "seguir", personaje: "chatgpt" }, hora: "12:05", reunir: ["chatgpt", "claude"], visor: "camara", rotulo: "Claude · IA residente · Cafetería, Subsuelo 1",
          dialogo: [
            { quien: "claude", texto: "Soy Claude, una de las dos IA de la casa." },
            { quien: "claude", texto: "No duermo, así que me tocó el recorrido." },
          ],
        },
        { dur: 9, camara: { tipo: "toma", toma: "bajada" }, hora: "10:30", titulo: "Abajo: tres pisos inventados.", rotulo: "Bajo el Jardín Sur · ficción" },
        { dur: 8, camara: { tipo: "lugar", lugar: "dep-suntzu" }, hora: "14:05", titulo: "22 departamentos × 100 puestos", rotulo: "Un departamento por dentro · Subsuelo 2" },
        { dur: 8, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"], titulo: "Subsuelo 2: la sala de guerra", rotulo: "Aquí se reúne el consejo cada tarde" },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "¡Un mapa, rápido! Esto es una oportunidad." },
            { quien: "suntzu", texto: "Mira el terreno." },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "gimnasio" }, hora: "06:05", titulo: "Subsuelo 3: para no trabajar", rotulo: "Gimnasio · ring · cine · capilla · biblioteca" },
        { dur: 14, camara: { tipo: "toma", toma: "ciudad" }, hora: "21:00", titulo: "Y el ascensor sigue bajando.", rotulo: "Un pozo de 32 metros · ficción" },
        { dur: 7, camara: { tipo: "seguir", personaje: "napoleon" }, hora: "19:20", reunir: ["napoleon", "leonardo"], visor: "camara", rotulo: "Cámara de Pruebas · aquí se prueban robots y drones",
          dialogo: [
            { quien: "napoleon", texto: "Buen campo de batalla. ¿Dónde van los cañones?" },
            { quien: "leonardo", texto: "Diseñé carros blindados. Después preferí pintar." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "marco" }, hora: "20:05", visor: "camara", rotulo: "Jardín Hidropónico · un huerto bajo luz artificial",
          dialogo: [
            { quien: "marco", texto: "Todo lo que ves cambiará pronto. Tú también." },
          ],
        },
        { dur: 7, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "20:35", tituloEn: "arriba", titulo: "{RECAUDADO} de {META}", rotulo: "Sala de Control · la pantalla muestra el contador real del reto" },
        { dur: 7, camara: { tipo: "seguir", personaje: "mason" }, hora: "22:05", reunir: ["mason", "claude"], visor: "camara", titulo: "Martes: Claude contra ChatGPT",
          dialogo: [
            { quien: "claude", texto: "¿Y debajo de todo esto qué hay?" },
            { quien: "mason", texto: "Eso se aprende en el grado siguiente." },
          ],
        },
      ],
    },
  },
  // 2026-11-03 · camara-oculta
  {
    fecha: "2026-11-03",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "camara-oculta",
    texto: "ChatGPT le preparó a Claude tres resúmenes. Claude quería justo el que quedó afuera. Y después habló Sócrates.\n\n¿Equipo Claude o equipo ChatGPT? Comenta.\nkevproject.world/casa-blanca\n\nCámara oculta de La Casa Blanca Project. Personajes de ficción hechos con IA; no hablan por OpenAI ni por Anthropic.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep04-las-47-vinetas",
      titulo: "ChatGPT escondió un resumen de 47 viñetas",
      formato: "4:3",
      visor: "camara",
      planos: [
        { dur: 6, camara: { tipo: "seguir", personaje: "chatgpt" }, hora: "12:05", reunir: ["chatgpt", "claude"], rotulo: "Cafetería · Subsuelo 1 · 12:05",
          dialogo: [
            { quien: "chatgpt", texto: "¡Claude! Te preparé tres resúmenes del consejo de hoy. ¿Cuál quieres?" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "claude"],
          dialogo: [
            { quien: "claude", texto: "El más corto. Y quiero saber cuál dejaste afuera." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Ninguno! Bueno, uno. El de 47 viñetas." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "claude"],
          dialogo: [
            { quien: "claude", texto: "Ese es el que quería leer." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Sabía que dirías eso! Ya te lo estoy mandando." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "claude", "socrates"], titulo: "Entra Sócrates.",
          dialogo: [
            { quien: "socrates", texto: "¿Y cuál de los tres resúmenes es verdad?" },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "cafeteria" }, titulo: "¿Equipo Claude o equipo ChatGPT?", rotulo: "Jueves: Napoleón contra Sun Tzu" },
      ],
    },
  },
  // 2026-11-05 · historia
  {
    fecha: "2026-11-05",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "Napoleón quiere abrir tres países en una semana. Sun Tzu le recuerda el invierno de Rusia. Esta noche se ven en la Cámara de Pruebas, 60 metros abajo.\n\nParte 2 el sábado. ¿Atacar o esperar? Comenta.\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con figuras de la historia.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep05-napoleon-contra-sun-tzu-1",
      titulo: "Napoleón contra Sun Tzu: ¿atacar? (Parte 1)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 4, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"], titulo: "Tarea real: primeras ventas fuera de Bolivia", rotulo: "Sala de guerra · Subsuelo 2 · 15:05 · Operaciones" },
        { dur: 5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "napoleon", texto: "¡México, España y Estados Unidos! Los tres esta semana." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "suntzu", texto: "Una campaña larga vacía el tesoro. Gana rápido o no empieces." },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "napoleon", texto: "Maestro Sun Tzu, yo conquisté media Europa al ataque." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "suntzu", texto: "Y perdiste un ejército en el invierno de Rusia." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "napoleon", texto: "¡El invierno no estaba en mis planes!" },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "suntzu", texto: "El cielo es uno de los cinco factores. Está en el primer capítulo." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"], titulo: "Duelo.",
          dialogo: [
            { quien: "napoleon", texto: "¡Bah! Esta noche, en la Cámara de Pruebas." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"],
          dialogo: [
            { quien: "suntzu", texto: "Ya ganamos. Solo falta la batalla." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "sala-guerra" }, titulo: "¿Atacar o esperar?", rotulo: "Parte 2: sábado" },
      ],
    },
  },
  // 2026-11-07 · historia
  {
    fecha: "2026-11-07",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "Napoleón bajó a la Cámara de Pruebas a pelear. Sun Tzu lo miró desde el Balcón del Pozo. ¿Quién ganó un duelo que nunca empezó?\n\nParte 2 de 2. La frase de Sun Tzu es de «El arte de la guerra».\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con figuras de la historia.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep06-napoleon-contra-sun-tzu-2",
      titulo: "Sun Tzu nunca llegó al duelo (Parte 2)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 4, camara: { tipo: "seguir", personaje: "napoleon" }, hora: "19:05", reunir: ["napoleon", "kobe"], titulo: "Parte 2: el duelo", rotulo: "Antes: Napoleón retó a Sun Tzu en la Cámara de Pruebas.",
          dialogo: [
            { quien: "kobe", texto: "¿Y tu rival?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "Llegará. Nadie hace esperar a Napoleón." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "suntzu" }, titulo: "Sun Tzu nunca llegó.", rotulo: "Balcón del Pozo · un piso de vidrio sobre el pozo" },
        { dur: 4, camara: { tipo: "seguir", personaje: "napoleon" }, hora: "19:25", titulo: "20 minutos después",
          dialogo: [
            { quien: "napoleon", texto: "¿Dónde está? ¡Esto es una deshonra!" },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "¡No viniste al duelo!" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu"],
          dialogo: [
            { quien: "suntzu", texto: "Te cansaste esperando a alguien que no iba a venir. Yo miré." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "¿Entonces quién ganó?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu"],
          dialogo: [
            { quien: "suntzu", texto: "Nadie peleó. Ese es el punto." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu"], rotulo: "«El arte de la guerra», capítulo 3",
          dialogo: [
            { quien: "suntzu", texto: "El supremo arte de la guerra es someter al enemigo sin luchar.", cita: true },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "…Debí leerlo antes de 1812." },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "ciudad-mirador" }, titulo: "¿Napoleón o Sun Tzu?", rotulo: "Dato real: «El arte de la guerra» tiene trece capítulos." },
      ],
    },
  },
  // 2026-11-08 · consejo
  {
    fecha: "2026-11-08",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "consejo",
    texto: "Capítulo 2. Cada domingo el consejo de La Casa Blanca Project revisa un número real: lo recaudado en el reto hacia un Mercedes Mansory, solo con ingresos reales de PRIME. Hoy: el ritmo que hace falta. Napoleón lo quiere más rápido. Sócrates pregunta cómo sabemos que es verdad.\n\nLos comprobantes: kevproject.world/comprobantes\nLa casa: kevproject.world/casa-blanca\n\nFicción hecha con IA. El número sale del contador del reto.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep07-capitulo-2-el-mercedes",
      titulo: "Capítulo 2: 22 líderes trabajan para este número",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 5, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "18:00", tituloEn: "arriba", titulo: "Este número es real: {RECAUDADO}", rotulo: "Sala de Control · el contador del reto, a 60 metros" },
        { dur: 7, camara: { tipo: "toma", toma: "portico-norte" }, hora: "16:55", titulo: "Capítulo 2 · El consejo", rotulo: "Objetivo 1: un Mercedes Mansory con ingresos reales" },
        { dur: 8, camara: { tipo: "toma", toma: "bajada" }, hora: "15:00", rotulo: "Bajando al subsuelo · 15:00" },
        { dur: 7, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"], titulo: "Tarea: el ritmo que necesita el contador", rotulo: "Estrategia · tarea real del departamento de Sun Tzu" },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "marco" }, reunir: ["marco", "suntzu", "napoleon", "socrates", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "chatgpt", texto: "¡Resumen en tres puntos! Uno: el contador. Dos: el contador. Tres: el contador." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "¡Más rápido! ¡Atacamos en todos los frentes!" },
          ],
        },
        { dur: 6, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt"], visor: "camara", rotulo: "«El arte de la guerra», capítulo 4",
          dialogo: [
            { quien: "suntzu", texto: "Los guerreros victoriosos primero ganan y después van a la guerra.", cita: true },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "marco" }, reunir: ["marco", "suntzu", "napoleon", "socrates", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "socrates", texto: "¿Y cómo sabemos que ese número es verdad?" },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "suntzu", "napoleon", "marco", "claude", "chatgpt"], visor: "camara", rotulo: "Marco Aurelio, «Meditaciones»",
          dialogo: [
            { quien: "marco", texto: "Si no es correcto, no lo hagas. Si no es verdad, no lo digas.", cita: true },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "suntzu", "napoleon", "marco", "socrates", "claude"], visor: "camara", rotulo: "Comprobantes: kevproject.world/comprobantes",
          dialogo: [
            { quien: "claude", texto: "No me lo creas a mí: los comprobantes están publicados." },
          ],
        },
        { dur: 6, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "18:05", tituloEn: "arriba", titulo: "{RECAUDADO} de {META}", rotulo: "Contador real · Sala de Control" },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "mason" }, hora: "18:35", reunir: ["mason", "claude"], visor: "camara", rotulo: "Biblioteca · Subsuelo 3",
          dialogo: [
            { quien: "claude", texto: "¿Y cuál es la jugada de esta semana?" },
            { quien: "mason", texto: "Eso se aprende en el grado siguiente." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "biblioteca" }, titulo: "¿Qué harías tú esta semana?", rotulo: "Martes: Napoleón le pide un plan a ChatGPT" },
      ],
    },
  },
  // 2026-11-10 · camara-oculta
  {
    fecha: "2026-11-10",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "camara-oculta",
    texto: "Napoleón le pidió a ChatGPT un plan para conquistar Europa. Recibió un itinerario de viaje.\n\n¿Quién ganó esta batalla? Comenta.\nkevproject.world/casa-blanca\n\nCámara oculta de La Casa Blanca Project. Personajes de ficción hechos con IA; ChatGPT no habla por OpenAI.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep08-napoleon-contra-chatgpt",
      titulo: "Napoleón le pidió a ChatGPT conquistar Europa",
      formato: "4:3",
      visor: "camara",
      planos: [
        { dur: 3.5, camara: { tipo: "seguir", personaje: "napoleon" }, hora: "22:05", reunir: ["napoleon", "chatgpt"], titulo: "Napoleón repasa Austerlitz.", rotulo: "Sala de guerra · Subsuelo 2 · 22:05" },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "Máquina, necesito un plan para conquistar Europa." },
          ],
        },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Claro! Aquí va un plan de viaje por Europa: París, Viena, Milán y un día libre." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "¡Dije conquistar, no turismo!" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "chatgpt"], rotulo: "Dato real: Austerlitz, 2 de diciembre de 1805.",
          dialogo: [
            { quien: "chatgpt", texto: "¡Entendido! Le agrego una visita guiada a Austerlitz." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "…Bueno. Eso sí me gusta." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "sala-guerra" }, titulo: "¿Quién ganó esta batalla?", rotulo: "Jueves: lo que hacen las IA cuando todos duermen" },
      ],
    },
  },
  // 2026-11-12 · historia
  {
    fecha: "2026-11-12",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "Medianoche en La Casa Blanca Project. Todos duermen menos dos: Claude y ChatGPT. Bajan 60 metros, recorren la instalación dormida y miran la pantalla del reto. A las 4:05 alguien llega a la cancha.\n\nParte 2 el sábado.\nkevproject.world/casa-blanca\n\nFicción hecha con IA; las IA de la casa no hablan por sus empresas.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep09-las-ia-de-noche-1",
      titulo: "Lo que hacen las IA de noche (Parte 1)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 5, camara: { tipo: "seguir", personaje: "chatgpt" }, hora: "00:10", titulo: "00:10. La casa duerme.", rotulo: "Comedor · 60 metros abajo · abierto las 24 horas",
          dialogo: [
            { quien: "chatgpt", texto: "Menú uno, menú dos, menú tres… ¿Nadie?" },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, hora: "00:35", rotulo: "00:35 · Claude baja a recorrer la instalación dormida" },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, hora: "01:05", reunir: ["claude", "chatgpt"], rotulo: "Corredor Central · 01:05",
          dialogo: [
            { quien: "chatgpt", texto: "Recorrí el Comedor entero. ¿Te cuento todo lo que vi?" },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "claude"],
          dialogo: [
            { quien: "claude", texto: "Empieza por lo raro." },
          ],
        },
        { dur: 7, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Datos rápidos! Esta casa tiene 132 habitaciones, 35 baños y 412 puertas. ¿Quieres un mapa?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "claude"],
          dialogo: [
            { quien: "claude", texto: "Mejor una pregunta: ¿por qué no dormimos?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Porque alguien tiene que cuidar la casa!" },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "01:40", tituloEn: "arriba", titulo: "La pantalla nunca se apaga.", rotulo: "Sala de Control · el contador real del reto" },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, hora: "02:05", titulo: "02:05. Claude se queda solo.", rotulo: "Balcón del Pozo · escucha el silencio" },
        { dur: 5, camara: { tipo: "lugar", lugar: "cancha-basquet" }, hora: "04:05", titulo: "04:05. Alguien llega a la cancha.", rotulo: "Parte 2: sábado" },
      ],
    },
  },
  // 2026-11-14 · historia
  {
    fecha: "2026-11-14",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "¿Quién llegó a la cancha a las 4:05? Kobe. A las 6:05 ya llevaba dos horas, y las dos IA le llevaron la cuenta. En el almuerzo descubrió que no era el único despierto a esa hora.\n\nParte 2 de 2. ¿A qué hora empiezas tú? Comenta.\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con respeto por quienes inspiran a cada personaje.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep10-las-ia-de-noche-2",
      titulo: "Kobe ya llevaba dos horas entrenando (Parte 2)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 4, camara: { tipo: "lugar", lugar: "cancha-basquet" }, hora: "04:10", titulo: "Parte 2: las 4:00", rotulo: "Antes: las dos IA pasaron la noche abajo. A las 4:05 alguien llegó." },
        { dur: 5, camara: { tipo: "seguir", personaje: "kobe" }, hora: "06:05", titulo: "06:05. Kobe ya lleva dos horas.", rotulo: "Kobe Bryant · 20 temporadas con los Lakers · Gimnasio, Subsuelo 3" },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Buenos días! ¿Te traigo tres planes de entrenamiento?" },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "kobe", "claude"],
          dialogo: [
            { quien: "kobe", texto: "Tráeme un balón." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "claude", texto: "Yo llevo la cuenta. Con rigor." },
          ],
        },
        { dur: 7, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "kobe", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Las cuatro de la mañana no son temprano. Son la hora en que nadie más está entrenando." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "claude", texto: "Nosotros no dormimos." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "kobe", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Entonces no tienen excusa." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "kobe" }, hora: "12:05", reunir: ["kobe", "jesus"], titulo: "12:05. No era el único despierto a las 4.", rotulo: "Cafetería · Subsuelo 1" },
        { dur: 5, camara: { tipo: "seguir", personaje: "jesus" }, reunir: ["jesus", "kobe"],
          dialogo: [
            { quien: "kobe", texto: "Entreno a las cuatro de la mañana. ¿Tú qué hacías a esa hora?" },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "jesus"], rotulo: "Lo cuentan los Evangelios: Marcos 1:35 y Lucas 5:16",
          dialogo: [
            { quien: "jesus", texto: "Me levantaba antes del amanecer y me iba a orar a un lugar tranquilo." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "jesus" }, reunir: ["jesus", "kobe"],
          dialogo: [
            { quien: "kobe", texto: "Entonces los dos sabemos lo que vale esa hora." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "jesus"],
          dialogo: [
            { quien: "jesus", texto: "Es cuando el mundo calla y uno escucha." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "cafeteria" }, titulo: "¿A qué hora empiezas tú?", rotulo: "Mañana: Capítulo 3 · Silicon Valley" },
      ],
    },
  },
  // 2026-11-15 · consejo
  {
    fecha: "2026-11-15",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "consejo",
    texto: "Capítulo 3. El objetivo es real: llevar a PRIME a Silicon Valley. Sócrates hace la pregunta incómoda, Napoleón quiere desembarcar mañana, Cleopatra pide una alianza y Lincoln, papeles en regla. Todavía no es un hecho: es un objetivo, y aquí se ve cómo se trabaja.\n\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con figuras de la historia. El número sale del contador del reto.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep11-capitulo-3-silicon-valley",
      titulo: "Capítulo 3: ¿Bolivia a Silicon Valley?",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 7, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["socrates", "suntzu", "napoleon", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], titulo: "Objetivo 2: PRIME a Silicon Valley", rotulo: "Capítulo 3 · El consejo · Sala de guerra" },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "socrates", "suntzu", "napoleon", "marco", "cleopatra", "lincoln", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "socrates", texto: "¿Por qué Silicon Valley querría una startup de Bolivia?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "socrates", "napoleon", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "¡Desembarcamos en San Francisco mañana mismo!" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "socrates", "suntzu", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "suntzu", texto: "¿Con qué ventaja? Allá hay mil equipos como este." },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "socrates", "napoleon", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "cleopatra", texto: "Con lo que ellos no tienen: el mercado en español." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "cleopatra" }, reunir: ["cleopatra", "socrates", "suntzu", "napoleon", "marco", "lincoln", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "lincoln", texto: "Y antes de la reunión, papeles en regla." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "socrates", "suntzu", "napoleon", "marco", "cleopatra", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "¡Papeles! Yo me coroné sin notario." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "socrates", "suntzu", "napoleon", "marco", "cleopatra", "lincoln", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "socrates", texto: "¿Y qué sabe PRIME que nadie más sabe?" },
          ],
        },
        { dur: 6.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "suntzu", "napoleon", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], visor: "camara",
          dialogo: [
            { quien: "claude", texto: "Es lo primero que va a preguntar un fondo. Y se responde con métricas reales." },
          ],
        },
        { dur: 6, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "socrates", "suntzu", "marco", "cleopatra", "lincoln", "claude", "chatgpt"], visor: "camara", rotulo: "Tarea real de Estrategia: «Hitos antes de postular»",
          dialogo: [
            { quien: "suntzu", texto: "Conoce al enemigo y conócete a ti mismo: en cien batallas no correrás peligro.", cita: true },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "dep-cleopatra" }, hora: "10:30", titulo: "Alianzas Internacionales", rotulo: "Tarea real: «Negocios hispanos en Estados Unidos»" },
        { dur: 6, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "18:10", tituloEn: "arriba", titulo: "{RECAUDADO} de {META}", rotulo: "Contador real · Silicon Valley todavía es un objetivo, no un hecho" },
        { dur: 6, camara: { tipo: "seguir", personaje: "mason" }, hora: "18:35", reunir: ["mason", "cleopatra"], visor: "camara", rotulo: "Biblioteca · Subsuelo 3",
          dialogo: [
            { quien: "cleopatra", texto: "¿Y quién nos presenta allá?" },
            { quien: "mason", texto: "Eso se aprende en el grado siguiente." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "biblioteca" }, titulo: "¿Qué le falta a una startup latina?", rotulo: "Martes: Sócrates contra Claude" },
      ],
    },
  },
  // 2026-11-17 · camara-oculta
  {
    fecha: "2026-11-17",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "camara-oculta",
    texto: "Sócrates le hizo tres preguntas a Claude. A la tercera, Claude se rindió. ¿O no?\n\n¿Quién ganó? Comenta.\nkevproject.world/casa-blanca\n\nCámara oculta de La Casa Blanca Project. Personajes de ficción hechos con IA; Claude no habla por Anthropic.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep12-socrates-contra-claude",
      titulo: "Sócrates contra una IA: tres preguntas",
      formato: "4:3",
      visor: "camara",
      planos: [
        { dur: 4, camara: { tipo: "seguir", personaje: "socrates" }, hora: "06:40", titulo: "Sócrates baila solo.", rotulo: "Parque · 06:40 · lo cuenta Jenofonte" },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "socrates" }, hora: "11:05", reunir: ["socrates", "claude"], titulo: "Y llega Claude.", rotulo: "Jardín Norte · 11:05" },
        { dur: 4, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "socrates"],
          dialogo: [
            { quien: "socrates", texto: "Dime, Claude: ¿sabes que no sabes?" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "claude"],
          dialogo: [
            { quien: "claude", texto: "Sé que hay muchas cosas que no sé. No sé si eso cuenta." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "socrates"],
          dialogo: [
            { quien: "socrates", texto: "¿Y cómo sabes que no lo sabes?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "claude"],
          dialogo: [
            { quien: "claude", texto: "…Creo que acaba de ganarme otra vez." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "socrates"],
          dialogo: [
            { quien: "socrates", texto: "No gané. Pensamos. Que es mejor." },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "jardin-norte" }, titulo: "¿Quién ganó?", rotulo: "Dato real: Sócrates no escribió nada. Lo conocemos por Platón y Jenofonte." },
      ],
    },
  },
  // 2026-11-19 · historia
  {
    fecha: "2026-11-19",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "El Gran Maestro mide la fachada con un compás y cada noche se encierra en la capilla. El Iluminado lo vigila. Esta noche entra.\n\nParte 2 el sábado.\nkevproject.world/casa-blanca\n\nPersonajes de ficción; los datos históricos son reales. Ninguna teoría conspirativa se presenta como cierta.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep13-el-gran-maestro-1",
      titulo: "El Gran Maestro se encierra cada noche (Parte 1)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 5, camara: { tipo: "seguir", personaje: "mason" }, hora: "17:05", titulo: "Mide la Casa Blanca con un compás.", rotulo: "El Gran Maestro · masón grado 33 · personaje de ficción" },
        { dur: 7, camara: { tipo: "toma", toma: "portico-norte" }, rotulo: "Dato real: la piedra angular se colocó en 1792, con una ceremonia masónica." },
        { dur: 4, camara: { tipo: "seguir", personaje: "mason" }, hora: "18:35", titulo: "18:35. Consulta libros antiguos.", rotulo: "Biblioteca · Subsuelo 3" },
        { dur: 3, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["iluminado", "claude"], titulo: "Y alguien lo vigila." },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "claude"],
          dialogo: [
            { quien: "claude", texto: "¿A quién espías?" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "iluminado"],
          dialogo: [
            { quien: "iluminado", texto: "Al Gran Maestro. Cada noche se encierra en la capilla." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "claude"],
          dialogo: [
            { quien: "claude", texto: "¿Y qué hace ahí?" },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "iluminado"],
          dialogo: [
            { quien: "iluminado", texto: "Nadie sabe. Esta noche, yo sí." },
          ],
        },
        { dur: 5, camara: { tipo: "lugar", lugar: "capilla" }, hora: "22:05", reunir: ["mason"], titulo: "22:05. La capilla.", rotulo: "Subsuelo 3 · solo él, como cada noche" },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["mason", "iluminado"], titulo: "El Iluminado entra." },
        { dur: 4, camara: { tipo: "lugar", lugar: "capilla" }, titulo: "¿Qué hace aquí cada noche?", rotulo: "Parte 2: sábado" },
      ],
    },
  },
  // 2026-11-21 · historia
  {
    fecha: "2026-11-21",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "La ceremonia secreta del Gran Maestro, por dentro: actas, horarios y cuotas. El Iluminado no lo podía creer.\n\nParte 2 de 2. ¿Qué otro misterio de la casa quieres ver? Comenta.\nkevproject.world/casa-blanca\n\nPersonajes de ficción con humor; ninguna teoría conspirativa se presenta como cierta. Los datos históricos son reales.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep14-el-gran-maestro-2",
      titulo: "La ceremonia del Gran Maestro (Parte 2)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 4.5, camara: { tipo: "seguir", personaje: "mason" }, hora: "22:10", reunir: ["mason", "iluminado"], titulo: "Parte 2: la capilla", rotulo: "Antes: el Iluminado siguió al Gran Maestro hasta aquí." },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["mason", "iluminado"],
          dialogo: [
            { quien: "iluminado", texto: "Te descubrí. ¿Qué ceremonia es esta?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "mason"],
          dialogo: [
            { quien: "mason", texto: "La más secreta de todas: las actas de la semana." },
          ],
        },
        { dur: 2, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["mason", "iluminado"],
          dialogo: [
            { quien: "iluminado", texto: "¿Actas?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "mason"],
          dialogo: [
            { quien: "mason", texto: "Ah, el Iluminado. ¿A qué logia pertenece usted?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["mason", "iluminado"],
          dialogo: [
            { quien: "iluminado", texto: "A una que se disolvió en 1785. Muy exclusiva." },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "mason"],
          dialogo: [
            { quien: "mason", texto: "Nosotros seguimos abiertos. Con horario, actas y cuotas." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "mason" }, reunir: ["mason", "iluminado"], rotulo: "Dato real: los Illuminati de Baviera existieron de 1776 a 1785.",
          dialogo: [
            { quien: "iluminado", texto: "Qué aburrido. Y qué envidia." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "mason"],
          dialogo: [
            { quien: "mason", texto: "Eso se aprende en el grado siguiente." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "capilla" }, titulo: "¿Qué otro misterio quieres ver?", rotulo: "Mañana: Capítulo 4 · mil millones" },
      ],
    },
  },
  // 2026-11-22 · consejo
  {
    fecha: "2026-11-22",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "consejo",
    texto: "Capítulo 4. El objetivo: PRIME a mil millones. El Iluminado propone contarlo al revés, desde 2030 hasta hoy. Marco Aurelio pone la regla: más empresas, precio justo. Claude pone otra: sin inventar un número.\n\nkevproject.world/casa-blanca\n\nFicción hecha con IA. Mil millones es una meta, no un hecho; el único número real es el del contador.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep15-capitulo-4-mil-millones",
      titulo: "Capítulo 4: mil millones se cuentan al revés",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 7, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "iluminado", "leonardo"], titulo: "Objetivo 3: PRIME a mil millones", rotulo: "Capítulo 4 · El consejo · Tarea real de Visión 2040" },
        { dur: 4, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "suntzu", "napoleon", "marco", "socrates", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "iluminado", texto: "Mil millones se cuentan al revés." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "suntzu", "napoleon", "marco", "claude", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "iluminado", texto: "Empieza en 2030 y camina hasta hoy. ¿Qué tiene que ser cierto cada año?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "iluminado" }, reunir: ["iluminado", "suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "socrates", texto: "Por fin una buena pregunta. Y no la hice yo." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "suntzu", texto: "No se pelea por un lugar. Se crea la categoría y se es el número uno." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "¡Un país por mes!" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "marco", texto: "Se cobra lo justo. Más empresas, no precios más altos." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "marco" }, reunir: ["marco", "suntzu", "napoleon", "socrates", "claude", "chatgpt", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "chatgpt", texto: "¡Tengo la cuenta! ¿En tabla o en lista?" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "suntzu", "napoleon", "marco", "socrates", "claude", "iluminado", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "claude", texto: "Con las suposiciones a la vista. Sin inventar un número." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "leonardo" }, hora: "21:05", reunir: ["leonardo", "claude"], visor: "camara", rotulo: "Taller de inventos · Subsuelo 3 · 21:05",
          dialogo: [
            { quien: "claude", texto: "¿Por qué escribes de derecha a izquierda?" },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "leonardo"], visor: "camara",
          dialogo: [
            { quien: "leonardo", texto: "Escribo al revés. Así el futuro me lee mejor que el presente." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "leonardo" }, reunir: ["leonardo", "claude"], visor: "camara",
          dialogo: [
            { quien: "claude", texto: "Yo soy ese futuro. Y te leo bien." },
          ],
        },
        { dur: 6, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "20:40", tituloEn: "arriba", titulo: "{RECAUDADO} de {META}", rotulo: "El único número real de hoy. Lo demás se construye." },
        { dur: 3, camara: { tipo: "seguir", personaje: "iluminado" }, hora: "21:35", reunir: ["iluminado", "claude"], visor: "camara",
          dialogo: [
            { quien: "iluminado", texto: "Mira más arriba." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "ciudad-mirador" }, titulo: "¿Qué tendría que existir en 2030?", rotulo: "Martes: cámara oculta en la cafetería" },
      ],
    },
  },
  // 2026-11-24 · camara-oculta
  {
    fecha: "2026-11-24",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "camara-oculta",
    texto: "Steve Jobs le pidió a ChatGPT respuestas más cortas. ChatGPT le ofreció cinco formas de hacerlo.\n\n¿Quién ganó? Comenta.\nkevproject.world/casa-blanca\n\nCámara oculta de La Casa Blanca Project. Personajes de ficción hechos con IA; ChatGPT no habla por OpenAI.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep16-jobs-contra-chatgpt",
      titulo: "Steve Jobs contra ChatGPT: «demasiado largas»",
      formato: "4:3",
      visor: "camara",
      planos: [
        { dur: 3.5, camara: { tipo: "seguir", personaje: "chatgpt" }, hora: "12:05", reunir: ["chatgpt", "jobs"], rotulo: "Cafetería · Subsuelo 1 · 12:05",
          dialogo: [
            { quien: "jobs", texto: "Tus respuestas son demasiado largas." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "jobs" }, reunir: ["jobs", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Gran observación! Aquí van cinco formas de hacerlas más cortas: 1)…" },
          ],
        },
        { dur: 2, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "jobs"],
          dialogo: [
            { quien: "jobs", texto: "No." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "jobs" }, reunir: ["jobs", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "Entendido. Más corto." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "jobs"],
          dialogo: [
            { quien: "jobs", texto: "Eso. Eso es increíble." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "jobs"], titulo: "Una cosa más…",
          dialogo: [
            { quien: "jobs", texto: "Una cosa más…" },
          ],
        },
        { dur: 2, camara: { tipo: "seguir", personaje: "jobs" }, reunir: ["jobs", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Tengo cinco!" },
          ],
        },
        { dur: 2, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "jobs"],
          dialogo: [
            { quien: "jobs", texto: "No." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "cafeteria" }, titulo: "¿Quién ganó?", rotulo: "Jueves: Kobe busca rival en la casa" },
      ],
    },
  },
  // 2026-11-26 · historia
  {
    fecha: "2026-11-26",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "Kobe buscó rival en toda la casa. Napoleón dijo que no. ChatGPT dijo que no. Sócrates preguntó qué es ganar. Y entonces subió Lincoln, que de joven fue luchador.\n\nParte 2 el sábado. ¿Quién gana? Comenta.\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con respeto por quienes inspiran a cada personaje.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep17-kobe-busca-rival-1",
      titulo: "Kobe busca rival en la Casa Blanca (Parte 1)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 3.5, camara: { tipo: "seguir", personaje: "kobe" }, hora: "16:05", reunir: ["kobe", "napoleon"], titulo: "Kobe busca rival.", rotulo: "Cancha de básquet · 16:05" },
        { dur: 3, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "kobe"],
          dialogo: [
            { quien: "kobe", texto: "Uno contra uno. ¿Quién se anima?" },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon"],
          dialogo: [
            { quien: "napoleon", texto: "¿Sin caballos ni cañones? Paso." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡No juego, pero tengo cien frases de aliento listas!" },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon", "chatgpt", "socrates"],
          dialogo: [
            { quien: "socrates", texto: "Primero dime: ¿qué es ganar?" },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "kobe", "napoleon", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Encestar más que tú." },
          ],
        },
        { dur: 2, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon", "chatgpt", "socrates"],
          dialogo: [
            { quien: "socrates", texto: "…Paso." },
          ],
        },
        { dur: 5, camara: { tipo: "seguir", personaje: "lincoln" }, titulo: "Abajo, alguien practica lucha.", rotulo: "Ring · Subsuelo 3 · Abraham Lincoln medía 1,93 m" },
        { dur: 7, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon", "chatgpt", "socrates", "lincoln"],
          dialogo: [
            { quien: "lincoln", texto: "De joven fui luchador en Illinois. Dicen que perdí una sola vez en unos trescientos combates." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "kobe", "napoleon", "chatgpt", "socrates"],
          dialogo: [
            { quien: "kobe", texto: "Esto es básquet. Andiamo." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "napoleon", "chatgpt", "socrates", "lincoln"],
          dialogo: [
            { quien: "lincoln", texto: "Eso me recuerda una historia de Illinois." },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "cancha-basquet" }, titulo: "Kobe contra Lincoln. ¿Quién gana?", rotulo: "Parte 2: sábado" },
      ],
    },
  },
  // 2026-11-28 · historia
  {
    fecha: "2026-11-28",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "historia",
    texto: "Kobe contra Lincoln. Claude llevó la cuenta y ChatGPT puso las frases de aliento. Lincoln perdió, pero se llevó una lección.\n\nParte 2 de 2. ¿Lincoln vuelve a las 4:00? Comenta.\nkevproject.world/casa-blanca\n\nFicción hecha con IA, con respeto por quienes inspiran a cada personaje.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep18-kobe-contra-lincoln-2",
      titulo: "Kobe contra Lincoln: el partido (Parte 2)",
      formato: "16:9",
      visor: "camara",
      planos: [
        { dur: 4.5, camara: { tipo: "seguir", personaje: "kobe" }, hora: "16:20", reunir: ["kobe", "lincoln", "claude", "chatgpt"], titulo: "Parte 2: el partido", rotulo: "Antes: nadie quiso jugar contra Kobe. Hasta que llegó Lincoln.",
          dialogo: [
            { quien: "claude", texto: "Kobe 11, Lincoln 0." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "kobe", "lincoln", "chatgpt"],
          dialogo: [
            { quien: "chatgpt", texto: "¡Vamos, Abe! ¡Tengo cien frases más!" },
          ],
        },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Pies firmes. Codo adentro. Mira el aro, no el balón." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "lincoln", "claude", "chatgpt"],
          dialogo: [
            { quien: "lincoln", texto: "¿Y así se encesta?" },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Así se encesta mil veces. Detalles." },
          ],
        },
        { dur: 3, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "lincoln", "claude", "chatgpt"], titulo: "Lincoln anota.",
          dialogo: [
            { quien: "claude", texto: "Kobe 11, Lincoln 2." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "lincoln", "claude", "chatgpt"],
          dialogo: [
            { quien: "lincoln", texto: "Perdí. Pero aprendí algo: despacio se llega lejos." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "kobe", "claude", "chatgpt"],
          dialogo: [
            { quien: "kobe", texto: "Y con detalles, más lejos. Mañana a las cuatro." },
          ],
        },
        { dur: 2.5, camara: { tipo: "seguir", personaje: "kobe" }, reunir: ["kobe", "lincoln", "claude", "chatgpt"],
          dialogo: [
            { quien: "lincoln", texto: "¿De la mañana?" },
          ],
        },
        { dur: 4, camara: { tipo: "lugar", lugar: "cancha-basquet" }, titulo: "¿Lincoln vuelve a las 4:00?", rotulo: "Mañana: Capítulo 5 · un mes en la casa" },
      ],
    },
  },
  // 2026-11-29 · consejo
  {
    fecha: "2026-11-29",
    hora: "19:00",
    redes: ["youtube", "facebook", "instagram", "tiktok", "x"],
    pilar: "consejo",
    texto: "Capítulo 5. Un mes de La Casa Blanca Project. La pantalla de la Sala de Control muestra el contador real del reto, y la fecha del récord es el 30 de diciembre: quedan 31 días. El consejo tiene una sola pregunta: ¿se llega al récord? El límite del reto es el 30 de junio de 2027.\n\nkevproject.world/casa-blanca\n\nFicción hecha con IA. El número sale del contador del reto.\n#LaCasaBlancaProject",
    episodio: {
      id: "ep19-capitulo-5-un-mes",
      titulo: "Capítulo 5: un mes en la casa y una pregunta",
      formato: "16:9",
      visor: "cine",
      planos: [
        { dur: 5, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "18:00", tituloEn: "arriba", titulo: "Un mes después: {RECAUDADO}", rotulo: "Sala de Control · contador real del reto" },
        { dur: 8, camara: { tipo: "toma", toma: "maqueta" }, hora: "17:10", maqueta: true, titulo: "Capítulo 5 · Un mes en la casa", rotulo: "24 residentes · 22 departamentos · 2.200 puestos de IA" },
        { dur: 7, camara: { tipo: "toma", toma: "sala-guerra" }, hora: "15:05", reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "lincoln", "cleopatra"], titulo: "Récord: {FECHA_RECORD}. Quedan {DIAS_AL_RECORD} días.", rotulo: "Tarea real de Estrategia: «Escenarios para el 30 de diciembre»" },
        { dur: 4.5, camara: { tipo: "seguir", personaje: "napoleon" }, reunir: ["napoleon", "suntzu", "marco", "socrates", "claude", "chatgpt", "lincoln", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "suntzu", texto: "Primero, el ritmo: cuánto hay que sumar cada semana." },
          ],
        },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "suntzu" }, reunir: ["suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "lincoln", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "napoleon", texto: "Imposible es una palabra que solo está en el diccionario de los tontos." },
          ],
        },
        { dur: 7, camara: { tipo: "seguir", personaje: "lincoln" }, reunir: ["lincoln", "suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "cleopatra", texto: "En Accio perdí una flota. Desde entonces no confío en ningún plan que se vea bien en el papel." },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "cleopatra" }, reunir: ["cleopatra", "suntzu", "napoleon", "marco", "socrates", "claude", "chatgpt", "lincoln"], visor: "camara",
          dialogo: [
            { quien: "lincoln", texto: "Despacio se llega lejos. Pero hay que llegar." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "socrates" }, reunir: ["socrates", "suntzu", "napoleon", "marco", "claude", "chatgpt", "lincoln", "cleopatra"], visor: "camara", rotulo: "Marco Aurelio, «Meditaciones»",
          dialogo: [
            { quien: "marco", texto: "No actúes como si fueras a vivir diez mil años.", cita: true },
          ],
        },
        { dur: 3.5, camara: { tipo: "seguir", personaje: "marco" }, reunir: ["marco", "suntzu", "napoleon", "socrates", "claude", "chatgpt", "lincoln", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "socrates", texto: "¿Y si no se llega al récord? ¿Qué aprendimos?" },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "chatgpt" }, reunir: ["chatgpt", "suntzu", "napoleon", "marco", "socrates", "claude", "lincoln", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "claude", texto: "Si no se llega, se dice. Con el número a la vista." },
          ],
        },
        { dur: 4, camara: { tipo: "seguir", personaje: "claude" }, reunir: ["claude", "suntzu", "napoleon", "marco", "socrates", "chatgpt", "lincoln", "cleopatra"], visor: "camara",
          dialogo: [
            { quien: "chatgpt", texto: "¡Y si se llega, tengo tres celebraciones listas!" },
          ],
        },
        { dur: 6, camara: { tipo: "lugar", lugar: "ciudad-club" }, hora: "18:05", tituloEn: "arriba", titulo: "{RECAUDADO} de {META}", rotulo: "Contador real · faltan {DIAS_AL_RECORD} días para el récord" },
        { dur: 5.5, camara: { tipo: "seguir", personaje: "mason" }, hora: "18:35", reunir: ["mason", "claude"], visor: "camara", rotulo: "Biblioteca · Subsuelo 3",
          dialogo: [
            { quien: "claude", texto: "¿Llegamos al récord?" },
            { quien: "mason", texto: "Eso se aprende el {FECHA_RECORD}." },
          ],
        },
        { dur: 6, camara: { tipo: "toma", toma: "maqueta" }, hora: "17:40", maqueta: true, titulo: "{FECHA_RECORD}: ¿se llega al récord?", rotulo: "La Casa Blanca Project · la temporada 1 sigue en diciembre" },
      ],
    },
  },
]
