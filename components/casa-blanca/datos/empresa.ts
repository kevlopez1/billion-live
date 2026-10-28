// ──────────────────────────────────────────────────────────────
// LA EMPRESA — objetivos, departamentos, agentes y el brief de la IA
//
// Todo lo que la casa "hace" sale de aquí. El motor y la interfaz no tienen
// nada escrito a mano de un departamento: agregar uno es agregar su entrada
// en DETALLE (y su lugar en DEPARTAMENTOS_BASE, de lugares.ts).
//
// Reglas de este archivo:
//  - Los objetivos son reales. El del Mercedes se mide con el contador del
//    reto (lib/contador.ts); los otros dos, con entregables guardados de
//    verdad. Ningún porcentaje sale de otro lado.
//  - Las tareas son trabajo que le sirve a Kev, no relleno: cada detalle dice
//    qué se entrega (un guion, una lista, un plan, un correo).
//  - Esta página es pública: ni números internos de PRIME, ni nombres de
//    clientes, ni la palabra que el manual reserva para uso interno.
//  - En pantalla, todo texto de aquí pasa por conPrime(): "PRIME" va en
//    mayúsculas para que se cambie por el logo.
// ──────────────────────────────────────────────────────────────

import {
  CHALLENGE_DEADLINE,
  CHALLENGE_LAUNCH,
  CHALLENGE_RECORD_DEADLINE,
  CHALLENGE_TARGET,
  RECAUDADO,
} from "@/lib/contador"
import { DEPARTAMENTOS_BASE } from "../lugares"
import type { Agente, Departamento, Entregable, Objetivo } from "../tipos"

/** Puestos de agentes por departamento (grilla de 10 × 10 en el subsuelo). */
export const PUESTOS_POR_DEPARTAMENTO = 100

// ── Formato ───────────────────────────────────────────────────

/** Miles con punto, como se escribe en Bolivia: 450000 → "450.000". A mano para no depender del ICU del servidor. */
export function miles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

/** "2026-12-30" → "30 de diciembre de 2026". */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

// ── Objetivos ─────────────────────────────────────────────────

/** Los ids de objetivo, tipados: una tarea con un objetivo mal escrito no compila. */
type IdObjetivo = "mercedes" | "silicon-valley" | "mil-millones"

const OBJETIVOS_BASE: Array<Omit<Objetivo, "departamentos"> & { id: IdObjetivo }> = [
  {
    id: "mercedes",
    titulo: "De $10 a un Mercedes",
    descripcion: `Llegar a $${miles(CHALLENGE_TARGET)} con ingresos reales de PRIME. Récord: ${fechaLarga(CHALLENGE_RECORD_DEADLINE)}. Límite: ${fechaLarga(CHALLENGE_DEADLINE)}.`,
    metrica: "recaudado",
  },
  {
    id: "silicon-valley",
    titulo: "Llevar a PRIME a Silicon Valley",
    descripcion:
      "Que PRIME sea una startup que un fondo de Silicon Valley quiera financiar: un producto que escala, métricas reales y relaciones con inversionistas.",
  },
  {
    id: "mil-millones",
    titulo: "PRIME a mil millones",
    descripcion:
      "Una valuación de $1.000 millones: ser el número uno de la categoría, sumar empresas a precio justo y construir hoy lo del 2030.",
  },
]

// ── Departamentos ─────────────────────────────────────────────

/** [titulo, rol, detalle]. El rol tiene que estar en los roles del departamento. */
type T = [titulo: string, rol: string, detalle: string]

interface Detalle {
  mision: string
  /** Paleta de 22 colores elegida para leerse sobre fondo oscuro y separarse entre sí (sin el verde de "entregado"). */
  color: string
  roles: string[]
  tareas: Partial<Record<IdObjetivo, T[]>>
}

const DETALLE: Record<string, Detalle> = {
  trump: {
    mision: "Negociar y cerrar los tratos grandes: sponsors, socios e inversionistas, con términos que dejen a PRIME ganando.",
    color: "#E1A536",
    roles: [
      "Negociación", "Cierre de tratos", "Mesa de sponsors", "Relación con inversionistas", "Hojas de términos", "Plan B",
      "Simulacros", "Preparación de reuniones", "Discursos", "Comunicados", "Anuncios grandes", "Agenda", "Gabinete",
      "Prioridades", "Seguimiento de acuerdos", "Imagen pública",
    ],
    tareas: {
      mercedes: [
        ["Escalera de sponsors en 3 niveles", "Negociación", "Una página: canje local, sponsor de un hito y sponsor del reto, con lo que da y recibe la marca en cada nivel."],
        ["Lista de 20 marcas para patrocinar", "Mesa de sponsors", "Marcas de Bolivia y Latinoamérica que ya patrocinan creadores (tecnología, bancos digitales, telefonía, autos), con el cargo de a quién escribirle."],
        ["Guion de llamada con un sponsor", "Mesa de sponsors", "Cinco minutos para pedirle a una marca que pague un hito (la laptop, un mes de servidores) y qué recibe a cambio."],
        ["Respuesta a 5 objeciones de un sponsor", "Simulacros", "Las cinco objeciones más probables (\"la audiencia es chica\", \"no es nuestro público\"...) con una respuesta de una frase para cada una."],
        ["Plan B de cada trato", "Plan B", "Para cada sponsor posible, qué hace Kev si dice que no, para no negociar con prisa."],
        ["Anuncio de cada hito del contador", "Anuncios grandes", "Texto corto para anunciar cada $10.000 recaudados, con la prueba que se muestra en pantalla."],
        ["Prioridades de la semana", "Prioridades", "Las tres acciones que más mueven el contador esta semana y lo que se deja para después."],
        ["Tabla de propuestas abiertas", "Seguimiento de acuerdos", "Cada propuesta enviada con a quién, cuándo, el próximo paso y la fecha del recordatorio."],
      ],
      "silicon-valley": [
        ["Los primeros 3 minutos con un fondo", "Preparación de reuniones", "Cómo abre Kev una reunión con un fondo de Silicon Valley: quién es, qué es PRIME y por qué ahora."],
        ["Límites antes de negociar", "Hojas de términos", "Lo que Kev no acepta en una hoja de términos (control del directorio, porcentaje máximo a ceder), decidido antes de sentarse."],
        ["Simulacro con un inversionista duro", "Simulacros", "Diálogo de práctica con las preguntas más duras (mercado, competencia, por qué desde Bolivia) y respuestas de dos frases."],
        ["Plan B si no entra un fondo", "Plan B", "Cómo crece PRIME 12 meses solo con ingresos propios, para negociar sin necesidad."],
        ["Correo de seguimiento a las 24 horas", "Relación con inversionistas", "Plantilla para después de una reunión: lo que se habló, un dato nuevo y el próximo paso."],
        ["Presentación de 60 segundos en inglés", "Discursos", "Cómo se presenta Kev en eventos de startups, con la historia de Bolivia en la primera frase."],
        ["Agenda de una semana en San Francisco", "Agenda", "Plantilla de viaje: reuniones, eventos abiertos de startups y traslados, sin huecos muertos."],
      ],
      "mil-millones": [
        ["Los 10 tratos que cambian la escala", "Negociación", "Diez acuerdos posibles (plataformas, telefónicas, bancos, cámaras de comercio) que podrían sumar miles de empresas, ordenados por impacto."],
        ["Acuerdo modelo con un distribuidor", "Cierre de tratos", "Términos para un socio que revende empleados de IA en su país: reparto, metas por trimestre y salida."],
        ["Lo que cada líder puede prometer", "Gabinete", "Qué puede acordar cada departamento y qué decide solo Kev: precios, exclusividades y porcentajes."],
        ["Calendario de anuncios del año", "Anuncios grandes", "Un anuncio fuerte por mes (producto, país nuevo, alianza), con la prueba que tiene que existir antes de anunciarlo."],
        ["Comunicado del número uno", "Comunicados", "Escrito por adelantado, con lo que tiene que ser cierto ese día para publicarlo."],
        ["Kev ante una empresa grande", "Imagen pública", "Qué tiene que ver el director de una empresa grande en los perfiles de Kev para aceptar la reunión."],
        ["Revisión trimestral de alianzas", "Seguimiento de acuerdos", "Formato para ver cada trimestre qué alianza trajo empresas y cuál se corta."],
      ],
    },
  },

  suntzu: {
    mision: "Ganar antes de pelear: elegir el terreno, el momento y la jugada para que PRIME no tenga que competir.",
    color: "#E25D1D",
    roles: [
      "Estrategia general", "Análisis del terreno", "Mapa de la competencia", "Posicionamiento", "Diseño de categoría", "Escenarios",
      "Juegos de guerra", "Inteligencia de mercado", "Ventajas injustas", "Priorización", "Plan de 30 días", "Plan de 90 días",
      "Hitos", "Riesgos", "Ritmo del reto", "Decisiones",
    ],
    tareas: {
      mercedes: [
        ["Ritmo que necesita el contador", "Ritmo del reto", "Cuánto hay que sumar por semana para llegar al récord y al límite, a partir del número real del contador."],
        ["Plan de 30 días al próximo hito", "Plan de 30 días", "Qué se vende, qué se publica y a quién se llama cada semana para sumar el próximo bloque de ingresos."],
        ["Las tres palancas del contador", "Priorización", "Clientes nuevos, clientes que suben de plan y sponsors: cuánto mueve cada uno y cuánto tiempo cuesta."],
        ["Plan contra el abandono", "Riesgos", "Kev nombró el abandono como su riesgo número uno: un sistema para que la constancia no dependa del ánimo."],
        ["Quién más hace retos en público", "Mapa de la competencia", "Diez creadores que documentan retos de dinero, qué les funcionó y en qué es distinto este."],
        ["Escenarios para el 30 de diciembre", "Escenarios", "Tres escenarios para la fecha del récord (llegar, quedar a medio camino, quedar lejos) y la jugada en cada uno."],
        ["Una decisión por semana", "Decisiones", "Formato de una página para que Kev decida rápido: opciones, costo, lo que se pierde y la recomendación."],
      ],
      "silicon-valley": [
        ["Por qué PRIME y por qué ahora", "Posicionamiento", "La tesis en cinco frases que un fondo de Silicon Valley necesita oír: el problema, el momento y la ventaja."],
        ["Ventajas injustas de PRIME", "Ventajas injustas", "Lo que PRIME tiene y un equipo de San Francisco no: el mercado en español, el costo y la historia pública."],
        ["Tres caminos a Silicon Valley", "Estrategia general", "Aceleradora, fondo directo o alianza con una empresa de allá: tiempos, lo que piden y lo que dan."],
        ["Hitos antes de postular", "Hitos", "Lo que debe existir antes de la primera reunión: empresas activas, ingresos mensuales, demo y equipo."],
        ["Juego de guerra: el fondo dice que no", "Juegos de guerra", "Las cinco razones más probables del \"no\" y qué se construye en 90 días para cambiar cada una."],
        ["Plan de 90 días hacia Silicon Valley", "Plan de 90 días", "Semana por semana: producto, métricas, postulaciones y contactos, con un responsable por tarea."],
      ],
      "mil-millones": [
        ["Diseño de la categoría Empleados AI", "Diseño de categoría", "Nombrar y definir la categoría que PRIME crea, para que los demás se comparen con PRIME y no al revés."],
        ["Dónde no hay nadie todavía", "Análisis del terreno", "Rubros y países donde nadie vende empleados de IA en español, ordenados por tamaño."],
        ["El negocio desde primeros principios", "Estrategia general", "Desarmar el negocio en sus partes (costo por conversación, tiempo de instalación, precio) y ver qué se puede simplificar."],
        ["De mil a cien mil empresas", "Escenarios", "Qué se rompe en cada escala (soporte, instalación, ventas) y qué hay que construir antes de que pase."],
        ["Mapa global de la competencia", "Mapa de la competencia", "Las empresas que venden agentes de IA para atender y vender: qué cobran, a quién y dónde PRIME es distinta."],
        ["Señales del mercado", "Inteligencia de mercado", "Lo que dicen los lanzamientos y las rondas de inversión del sector sobre hacia dónde va, en una página por mes."],
        ["Jugadas que no se hacen", "Priorización", "Ideas buenas que se dejan para después porque distraen del objetivo, con el motivo de cada una."],
      ],
    },
  },

  thiel: {
    mision: "Conseguir el capital y las relaciones de Silicon Valley que convierten a PRIME en una empresa financiable.",
    color: "#1D8EF5",
    roles: [
      "Búsqueda de fondos", "Aceleradoras", "Ángeles", "Tesis de inversión", "Deck", "Sala de datos", "Valuación", "Rondas y SAFE",
      "Correos a inversionistas", "Actualización mensual", "Preguntas de inversionistas", "Tesis a contracorriente",
      "Becas y programas", "Demo day", "Relación con fondos", "Mapa de Silicon Valley",
    ],
    tareas: {
      "silicon-valley": [
        ["Lista de 20 fondos y aceleradoras", "Búsqueda de fondos", "20 fondos y aceleradoras de Silicon Valley para IA temprana (Y Combinator, Techstars, Pear VC, Hustle Fund...), con cómo postular y qué verificar."],
        ["Postulación a Y Combinator", "Aceleradoras", "Borrador de las respuestas del formulario: qué hace PRIME, el progreso y por qué este equipo, en frases cortas y con números reales."],
        ["Postulación a la Thiel Fellowship", "Becas y programas", "Borrador de la postulación de Kev a la beca para jóvenes que construyen en lugar de estudiar, con su historia real; verificar la edad límite."],
        ["Deck de 10 diapositivas", "Deck", "Problema, solución, demo, mercado, tracción real, modelo, competencia, equipo, visión y pedido, una idea por diapositiva."],
        ["Correo frío a un ángel", "Ángeles", "Cinco líneas: la historia, la tracción real y un pedido concreto; más dos seguimientos para cuando no responde."],
        ["Actualización mensual", "Actualización mensual", "Plantilla que se manda aunque nadie haya invertido aún: números del mes, logros, problemas y en qué pueden ayudar."],
        ["Las 30 preguntas de un fondo", "Preguntas de inversionistas", "Las preguntas que más se repiten en reuniones de etapa temprana, con una respuesta de dos frases para cada una."],
        ["Índice de la sala de datos", "Sala de datos", "Carpetas y documentos que pide un fondo en la diligencia: sociedad, contratos, métricas y propiedad intelectual."],
        ["La verdad que pocos aceptan", "Tesis a contracorriente", "En una frase, la verdad importante en la que casi nadie está de acuerdo con Kev, y la prueba de que es cierta."],
      ],
      "mil-millones": [
        ["Rondas hasta mil millones", "Rondas y SAFE", "Presemilla, semilla y series A, B y C: rangos de referencia de cada ronda y qué métrica abre la siguiente."],
        ["Cuánto conserva Kev", "Valuación", "Tabla de dilución por ronda para ver qué parte de PRIME conserva Kev al llegar a una valuación de mil millones."],
        ["Qué paga el mercado por una empresa de IA", "Tesis de inversión", "Los múltiplos de ingresos que se pagan por empresas de software con IA y qué los sube: crecimiento, retención y margen."],
        ["Quién financió temprano a los grandes", "Mapa de Silicon Valley", "Qué fondos entraron primero en las empresas de IA más grandes y qué patrón se repite."],
        ["Guion de demo day", "Demo day", "Dos minutos para presentar PRIME con la demo en vivo de un empleado de IA vendiendo."],
        ["Diez fondos, doce meses antes", "Relación con fondos", "Plan para que diez fondos conozcan a PRIME un año antes de pedirles dinero: qué se les manda y cada cuánto."],
      ],
    },
  },

  // ChatGPT trabaja aquí: sus tareas las firma el "Equipo de ChatGPT".
  altman: {
    mision: "Construir la inteligencia de los empleados de IA de PRIME: que entiendan, respondan y vendan mejor cada semana.",
    color: "#299F9C",
    roles: [
      "Modelos de lenguaje", "Diseño de prompts", "Agentes y herramientas", "Memoria", "Voz y audio", "Visión",
      "Evaluación de respuestas", "Costo por conversación", "Multi-idioma", "Automatizaciones", "Integraciones",
      "Investigación aplicada", "Datos de mejora", "Velocidad de respuesta", "Agentes entre empresas", "Equipo de ChatGPT",
    ],
    tareas: {
      mercedes: [
        ["30 ganchos para videos", "Equipo de ChatGPT", "30 primeras frases de 3 segundos con plata, calle o drama, listas para grabar."],
        ["Empleado de IA para la comunidad", "Agentes y herramientas", "Un empleado de IA que contesta a la audiencia del reto y detecta a las empresas interesadas en PRIME."],
        ["Demo de 30 segundos", "Diseño de prompts", "Guion de una demo donde un empleado de IA atiende y cierra una venta, para videos y anuncios."],
        ["Un video largo, diez piezas", "Automatizaciones", "De un video largo a cortes, subtítulos y textos por red: qué hace la IA y qué revisa una persona."],
        ["Costo real por conversación", "Costo por conversación", "Cuánto cuesta cada conversación según el modelo, para cobrar lo justo sin perder margen."],
        ["Atender en inglés y portugués", "Multi-idioma", "Pruebas de un empleado de IA atendiendo en inglés y portugués para vender fuera de Bolivia, con los errores encontrados."],
      ],
      "silicon-valley": [
        ["Arquitectura de agentes en una página", "Agentes y herramientas", "Cómo un solo sistema sirve a todas las empresas clientes, explicado para un inversionista técnico."],
        ["100 pruebas de calidad", "Evaluación de respuestas", "Cien conversaciones de prueba con la respuesta esperada, para medir cada cambio antes de publicarlo."],
        ["Qué recuerda el empleado", "Memoria", "Qué recuerda un empleado de IA de cada cliente (pedidos, preferencias) y qué olvida por privacidad."],
        ["Empleado que atiende por voz", "Voz y audio", "Prototipo que contesta notas de voz y llamadas, con la lista de lo que falta para producción."],
        ["Leer la foto de un producto", "Visión", "Cómo un empleado de IA reconoce un producto en la foto que manda un cliente y lo busca en el catálogo."],
        ["Demo técnica de 2 minutos", "Equipo de ChatGPT", "Guion de una demo para Silicon Valley con el trabajo completo: atender, cotizar, tomar el pedido y hacer seguimiento."],
        ["Respuestas más rápidas", "Velocidad de respuesta", "Medir cuánto tarda cada respuesta y un plan para que sea más rápida que una persona escribiendo."],
      ],
      "mil-millones": [
        ["Economía de agente a agente", "Agentes entre empresas", "Cómo un empleado de IA de PRIME podría comprarle y venderle a los agentes de otras empresas, y qué se construye primero."],
        ["Un rubro nuevo en un día", "Diseño de prompts", "Plantillas por rubro (tienda, clínica, restaurante, taller) para instalar un empleado nuevo en horas, no en semanas."],
        ["Las 10 integraciones que abren mercados", "Integraciones", "Tiendas en línea, facturación, calendarios: las integraciones que más empresas piden, ordenadas por cuántas puertas abren."],
        ["Mejora semanal con errores reales", "Datos de mejora", "Proceso para que cada conversación que salió mal (anonimizada) se vuelva una prueba y la IA mejore cada semana."],
        ["Modelos del 2030", "Investigación aplicada", "Lo que podrán hacer los modelos de IA en 2030 según las tendencias públicas, y qué producto de PRIME eso habilita."],
        ["Elegir el modelo correcto", "Modelos de lenguaje", "Qué modelo usa cada tarea (atender, resumir, decidir) para que la calidad suba y el costo baje."],
        ["50 ideas de funciones", "Equipo de ChatGPT", "Cincuenta funciones nuevas ordenadas por cuántas empresas sumarían, y las cinco mejores con un boceto."],
      ],
    },
  },

  musk: {
    mision: "Que el producto escale de diez a cien mil empresas sin romperse, construido desde primeros principios.",
    color: "#3FEFF5",
    roles: [
      "Arquitectura", "Primeros principios", "Nube", "Base de datos", "Backend", "Frontend", "Aplicación móvil",
      "Canales de mensajería", "Escalabilidad", "Rendimiento", "Monitoreo", "Seguridad de sistemas", "Costo de servidores",
      "Pruebas automáticas", "Despliegues", "Herramientas internas",
    ],
    tareas: {
      "silicon-valley": [
        ["Arquitectura para inversionistas", "Arquitectura", "Por qué un solo sistema sirve a muchas empresas: lo que se comparte y lo que queda aislado por cliente."],
        ["Prueba de carga a mil empresas", "Escalabilidad", "Simular mil empresas atendiendo a la vez y anotar qué parte falla primero."],
        ["Panel de salud del sistema", "Monitoreo", "Mensajes por minuto, errores y tiempo de respuesta en un tablero listo para una diligencia técnica."],
        ["Mapa de lo que no tiene pruebas", "Pruebas automáticas", "Las partes sin pruebas automáticas, ordenadas por lo que costaría un error en cada una."],
        ["Un cliente nuevo en una hora", "Herramientas internas", "Herramienta que arma un empleado de IA a partir de una conversación, sin tocar código."],
        ["Costo de servidores por empresa", "Costo de servidores", "Cuánto cuesta servir a una empresa por mes y cómo baja cuando hay diez veces más."],
        ["Publicar sin cortar conversaciones", "Despliegues", "Proceso para publicar cambios varias veces al día sin cortar las conversaciones en curso."],
      ],
      "mil-millones": [
        ["El piso físico del costo", "Primeros principios", "Desarmar el costo de una conversación (modelo, servidor, mensajería) y buscar el mínimo posible de cada parte."],
        ["Arquitectura para cien mil empresas", "Base de datos", "Qué cambia en la base de datos, las colas y los servidores para pasar de cientos a cien mil clientes."],
        ["App para dueños de negocio", "Aplicación móvil", "Boceto de la app donde el dueño ve en tiempo real lo que atiende y vende su empleado de IA."],
        ["Alta sin llamada de ventas", "Frontend", "Flujo para que una empresa cree, pruebe y active su empleado de IA sola."],
        ["WhatsApp, un canal más", "Canales de mensajería", "Plan para sumar la web, Telegram y el correo como canales, con el orden y el esfuerzo de cada uno."],
        ["Seguridad para empresas grandes", "Seguridad de sistemas", "Lo que pide el área de sistemas de una empresa grande (cifrado, accesos, auditoría) y lo que falta."],
        ["Igual de rápido en cualquier país", "Rendimiento", "Medir el tiempo de respuesta desde México, España y Estados Unidos y qué hace falta para igualar al de Bolivia."],
      ],
    },
  },

  hormozi: {
    mision: "Hacer ofertas tan buenas que decir que no parezca un error, y cerrarlas.",
    color: "#FC8E71",
    roles: [
      "Diseño de ofertas", "Precios", "Garantías", "Bonos", "Guiones de venta", "Llamadas de cierre", "Objeciones", "Prospección",
      "Seguimiento", "Referidos", "Mejora de plan", "Casos de éxito", "Demostraciones", "Embudo", "Anuncios", "Métricas de ventas",
      "Ventas en dólares",
    ],
    tareas: {
      mercedes: [
        ["Oferta con garantía", "Garantías", "Garantía del empleado de IA: qué se promete, en qué plazo y qué pasa si no se cumple. La aprueba Kev."],
        ["Pila de valor", "Bonos", "Los bonos que se suman (instalación, catálogo cargado, reporte semanal) para que la oferta valga más de lo que cuesta."],
        ["Guion de venta de 30 segundos", "Guiones de venta", "Lo que dice Kev cuando un dueño de negocio pregunta qué hace PRIME: problema, demo, precio y cierre."],
        ["Las 10 objeciones de un dueño", "Objeciones", "\"Es caro\", \"mis clientes quieren hablar con una persona\", \"ya tengo a alguien\"... con una respuesta corta para cada una."],
        ["Perfil de los 50 primeros a llamar", "Prospección", "Rubro, tamaño y la señal de que un negocio pierde ventas por no responder rápido, más dónde encontrar cada uno."],
        ["Seguimiento de 7 días", "Seguimiento", "Mensajes del día 1, 2, 4 y 7 para quien pidió precio y no respondió: cortos y sin presión."],
        ["Programa de referidos", "Referidos", "Qué recibe un cliente por traer a otra empresa y el mensaje listo para pedirle el referido."],
        ["Oferta en dólares", "Ventas en dólares", "La oferta adaptada a dueños de negocio de México, España y Estados Unidos, con lo que cambia en el mensaje."],
        ["Mejora de plan", "Mejora de plan", "Qué ofrecer a un cliente contento (más canales, más empleados, videos con IA) y en qué momento."],
      ],
      "mil-millones": [
        ["Planes para sumar empresas", "Precios", "Estructura de planes que suma la mayor cantidad de empresas sin bajar el valor, con la lógica de cada escalón; los montos los decide Kev."],
        ["Embudo sin llamadas", "Embudo", "Del anuncio al pago sin hablar por teléfono, con la tasa a medir en cada paso."],
        ["Formato de caso de éxito", "Casos de éxito", "Antes, después y la prueba, más el mensaje para pedirle permiso al cliente antes de publicarlo."],
        ["Demo que cierra sola", "Demostraciones", "90 segundos en los que el visitante habla con un empleado de IA de su rubro y ve una venta hecha."],
        ["Cinco métricas de ventas", "Métricas de ventas", "Empresas nuevas, tasa de cierre, ciclo de venta, ticket y abandono: cómo se mide cada una."],
        ["Diez anuncios para la demo", "Anuncios", "Diez textos de anuncio que llevan a probar la demo, cada uno con un problema distinto del dueño de negocio."],
        ["Llamada de cierre de 15 minutos", "Llamadas de cierre", "Minuto a minuto: diagnóstico, demo con su negocio, oferta, garantía y cierre."],
        ["Oferta que se vende sola", "Diseño de ofertas", "Rehacer la oferta para que decir que no parezca un error: resultado, plazo y riesgo a la vista."],
      ],
    },
  },

  // Claude trabaja aquí: sus tareas las firma el "Equipo de Claude".
  amodei: {
    mision: "Que cada empleado de IA de PRIME sea confiable: dice la verdad, protege los datos y nunca promete lo que no puede cumplir.",
    color: "#FCD08B",
    roles: [
      "Evaluaciones", "Red team", "Políticas de uso", "Privacidad", "Aislamiento entre clientes", "Alucinaciones", "Montos seguros",
      "Escalado a humanos", "Transparencia", "Revisión de prompts", "Incidentes", "Cumplimiento", "Auditoría de respuestas",
      "Ética de la IA", "Equipo de Claude",
    ],
    tareas: {
      "silicon-valley": [
        ["Política de uso", "Políticas de uso", "Una página con lo que un empleado de IA de PRIME nunca hace (mentir, inventar precios, presionar), para inversionistas y clientes."],
        ["50 ataques a un empleado de IA", "Red team", "Mensajes que intentan que el empleado diga algo falso, regale descuentos o filtre datos, con el resultado de cada uno."],
        ["Prueba de aislamiento", "Aislamiento entre clientes", "Método y resultado que demuestran que el empleado de una empresa nunca muestra datos de otra."],
        ["Revisión mensual de respuestas", "Auditoría de respuestas", "Cómo revisar cada mes 200 respuestas anonimizadas: qué se cuenta, cómo se marca un error y qué se publica."],
        ["Cuándo pasa a una persona", "Escalado a humanos", "Reglas de cuándo la IA deja la conversación a alguien del negocio y cómo se le avisa."],
        ["Pruebas antes de publicar", "Evaluaciones", "Lo que tiene que pasar un empleado de IA antes de salir a producción, con el umbral de aprobación."],
        ["Revisión honesta del deck", "Equipo de Claude", "Claude lee el deck de PRIME y marca cada afirmación sin prueba, con la corrección sugerida."],
      ],
      "mil-millones": [
        ["Precios que no se inventan", "Montos seguros", "Guardas en código para que un empleado de IA nunca diga un precio, descuento o plazo que no está en el catálogo."],
        ["Cuando la IA no sabe", "Alucinaciones", "Cómo detectar una respuesta inventada y qué dice el empleado cuando no tiene el dato: \"lo consulto y te aviso\"."],
        ["Privacidad en lenguaje claro", "Privacidad", "Qué datos se guardan, cuánto tiempo y quién los ve, escrito para que lo entienda un dueño de negocio."],
        ["El cliente sabe que habla con IA", "Transparencia", "Cómo y cuándo el empleado dice que es una IA, sin arruinar la venta."],
        ["La primera hora de un incidente", "Incidentes", "Qué se hace si un empleado de IA dice algo grave: apagar, avisar, corregir y explicar."],
        ["Leyes de IA por país", "Cumplimiento", "Lo que piden las leyes de IA y de datos en Bolivia, México, la Unión Europea y Estados Unidos; marcar qué verificar con un abogado."],
        ["Cinco principios publicados", "Ética de la IA", "Cinco principios cortos que PRIME publica y cumple, cada uno con la prueba de que se cumple."],
        ["Segunda opinión de cada prompt", "Equipo de Claude", "Claude revisa cada prompt nuevo y señala dónde el empleado podría mentir, presionar o confundir al cliente."],
      ],
    },
  },

  pichai: {
    mision: "Que quien busque un empleado de IA, en Google o en un asistente de IA, encuentre primero a PRIME.",
    color: "#04C4F0",
    roles: [
      "SEO", "Búsqueda en IA", "Palabras clave", "Artículos para buscadores", "Perfil en Google", "Anuncios de búsqueda", "YouTube",
      "Directorios", "Tiendas de aplicaciones", "Menciones", "Analítica web", "Velocidad de la web", "Páginas por rubro",
      "Páginas por país", "Alianzas de distribución",
    ],
    tareas: {
      mercedes: [
        ["50 búsquedas de un dueño de negocio", "Palabras clave", "Búsquedas probables de quien quiere atender a sus clientes con IA, agrupadas por intención de compra; verificarlas con una herramienta."],
        ["YouTube del reto en orden", "YouTube", "Títulos, descripciones y capítulos de los videos largos del reto, pensados para que YouTube los recomiende."],
        ["Perfil de PRIME en Google", "Perfil en Google", "Categorías, fotos, preguntas frecuentes y cómo pedir reseñas a los clientes."],
        ["Diez páginas por rubro", "Páginas por rubro", "Páginas que muestran al empleado de IA en tiendas, clínicas, restaurantes y otros rubros, cada una con su título y su pregunta principal."],
        ["Del reto a PRIME", "Analítica web", "Cuántas visitas de kevproject.world llegan a primebusiness.live y tres cambios para que sean más."],
        ["Anuncios de búsqueda de prueba", "Anuncios de búsqueda", "Diez palabras clave de alta intención, gasto máximo por día y la regla para apagar la campaña."],
      ],
      "mil-millones": [
        ["Que la recomiende un asistente de IA", "Búsqueda en IA", "Qué tiene que publicar PRIME para que un asistente de IA la mencione cuando alguien pregunta por empleados de IA para empresas."],
        ["20 directorios de herramientas de IA", "Directorios", "Directorios y marketplaces donde listar a PRIME, con lo que pide cada uno."],
        ["Páginas por país", "Páginas por país", "Estructura para México, Colombia, España y Estados Unidos, con el idioma y los ejemplos de cada mercado."],
        ["30 artículos que atraen empresas", "Artículos para buscadores", "Respuestas a preguntas reales de dueños de negocio sobre IA, ordenadas por cuántas empresas pueden atraer."],
        ["Medios para contar la historia", "Menciones", "Medios de tecnología y negocios en español a los que contarles la historia de PRIME, con el ángulo para cada uno."],
        ["Estar dentro de las plataformas", "Alianzas de distribución", "Plataformas que ya tienen miles de pymes (facturación, tiendas en línea, bancos) y cómo PRIME podría estar dentro de ellas."],
        ["Web rápida en cualquier celular", "Velocidad de la web", "Medir primebusiness.live en un celular de gama baja y los arreglos para que cargue en menos de 2 segundos."],
        ["PRIME en las tiendas de apps", "Tiendas de aplicaciones", "Qué hace falta para publicar una app de PRIME en las tiendas y cómo se escribe su ficha para que la encuentren."],
      ],
    },
  },

  mason: {
    mision: "Abrir puertas: construir la red de personas que acercan a PRIME a clientes, sponsors e inversionistas.",
    color: "#AB7D8B",
    roles: [
      "Mapa de contactos", "Presentaciones cálidas", "Eventos", "Comunidades", "Mentores", "Cámaras de comercio", "Diáspora latina",
      "Embajadores", "Creadores", "Seguimiento de contactos", "Cafés", "Clubes y círculos", "LinkedIn", "Reciprocidad", "Protocolo",
    ],
    tareas: {
      mercedes: [
        ["Mapa de los primeros 100 contactos", "Mapa de contactos", "Quiénes de la red de Kev pueden comprar, presentar a alguien o patrocinar, ordenados por cercanía."],
        ["Mensaje para pedir una presentación", "Presentaciones cálidas", "Texto corto que un amigo puede reenviar tal cual para presentar a Kev con un dueño de negocio."],
        ["Eventos de los próximos 3 meses", "Eventos", "Ferias, encuentros de cámaras y eventos de emprendimiento en Santa Cruz, y a cuáles ir; verificar fechas."],
        ["Cámaras y gremios", "Cámaras de comercio", "Cámaras y asociaciones de Bolivia con muchas pymes, y la charla o demo que se les puede ofrecer."],
        ["Diez creadores para colaborar", "Creadores", "Creadores de negocios de Latinoamérica para un video juntos, con la idea de cada colaboración."],
        ["Tabla de seguimiento", "Seguimiento de contactos", "Cada contacto con lo último que se habló y la fecha para volver a escribirle."],
        ["Dar antes de pedir", "Reciprocidad", "Qué puede ofrecer Kev primero (una demo, un video, una presentación) a cada tipo de contacto."],
      ],
      "silicon-valley": [
        ["Latinos en Silicon Valley", "Diáspora latina", "Comunidades de fundadores e ingenieros latinoamericanos en el área de la bahía y cómo entrar a cada una."],
        ["Cinco mentores para PRIME", "Mentores", "Perfil de los mentores que más ayudarían y el mensaje para pedirle 20 minutos a cada uno."],
        ["LinkedIn de Kev en inglés", "LinkedIn", "Titular, resumen y tres publicaciones fijas para que un inversionista entienda en 10 segundos quién es Kev."],
        ["Programa de embajadores", "Embajadores", "Cómo clientes y amigos con contactos en Estados Unidos pueden presentar a PRIME, y qué reciben a cambio."],
        ["Dos cafés por semana", "Cafés", "Llamadas con fundadores que ya pasaron por una aceleradora, con las preguntas para cada una."],
        ["Comunidades de fundadores de IA", "Comunidades", "Grupos y foros donde los fundadores de IA comparten avances, y qué aportar en cada uno antes de pedir algo."],
        ["Protocolo de una cena con un inversionista", "Protocolo", "Qué llevar, qué preguntar y qué no decir en una cena o un café con alguien de un fondo."],
        ["Círculos que abren puertas", "Clubes y círculos", "Clubes, programas y redes de fundadores con proceso de admisión, donde se está cerca de quienes deciden; verificar requisitos."],
      ],
    },
  },

  iluminado: {
    mision: "Pensar con vista al 2030 y al 2040, y traer ese futuro al trabajo de hoy.",
    color: "#E4DF2C",
    roles: [
      "Futuros posibles", "Tendencias", "Señales débiles", "Escenarios 2030", "Escenarios 2040", "Tecnologías emergentes",
      "Robótica empresarial", "Economía de agentes", "Narrativa de visión", "Manifiesto", "Apuestas largas", "Hojas de ruta",
      "Ciencia ficción aplicada", "Riesgos del futuro", "Símbolos y rituales",
    ],
    tareas: {
      "silicon-valley": [
        ["La visión en una página", "Narrativa de visión", "Cómo es una empresa en 2030 con empleados de IA de PRIME, contado para un inversionista."],
        ["Manifiesto de PRIME", "Manifiesto", "Diez frases sobre en qué cree PRIME, para leerse en voz alta al cierre de un pitch."],
        ["Por qué el mercado será enorme", "Tendencias", "Tendencias públicas (adopción de IA, pymes de Latinoamérica, mensajería) que hacen grande el mercado, cada una con su fuente."],
        ["Hoja de ruta 2026–2030", "Hojas de ruta", "Del empleado de IA de hoy al cerebro de la empresa: qué sale cada año y qué lo hace posible."],
        ["Cinco señales del mes", "Señales débiles", "Noticias o lanzamientos pequeños que anuncian algo grande para los empleados de IA, y qué hacer con cada uno."],
        ["Una apuesta a diez años", "Apuestas largas", "Algo que hoy parece absurdo y en 2036 será obvio, con el primer paso que se puede dar este mes."],
      ],
      "mil-millones": [
        ["Tres mundos en 2040", "Escenarios 2040", "Agentes en todas las empresas, leyes muy estrictas o robots en la operación: dónde está PRIME en cada uno."],
        ["Robots en la pyme", "Robótica empresarial", "Qué tareas de una pyme podrían hacer robots antes de 2035 y cómo los coordinaría un empleado de IA."],
        ["Cuando el comprador es un agente", "Economía de agentes", "Cómo cambian las ventas cuando quien compra también es una IA, y qué tiene que tener PRIME ese día."],
        ["Diez tecnologías antes del 2030", "Tecnologías emergentes", "Agentes autónomos, voz en tiempo real, pagos entre agentes y más: fecha probable y uso para PRIME de cada una."],
        ["El 2030 construido hoy", "Ciencia ficción aplicada", "Tres funciones que parecen del 2030 y se pueden construir hoy con lo que ya existe."],
        ["Lo que puede dejar a PRIME afuera", "Riesgos del futuro", "Un gigante que regala lo mismo, una ley nueva, un cambio de canal: la defensa para cada riesgo."],
        ["Mil millones contados hacia atrás", "Escenarios 2030", "Desde una PRIME que vale mil millones, qué tuvo que pasar cada año desde 2026."],
        ["Ritual de la vista larga", "Símbolos y rituales", "Una reunión mensual de 30 minutos para mirar el 2040 y decidir una sola cosa para hacer hoy."],
      ],
    },
  },

  jesus: {
    mision: "Servir a cada empresa cliente como si fuera la única: que se quede, que crezca y que traiga a otra.",
    color: "#97CFDA",
    roles: [
      "Bienvenida", "Instalación", "Soporte", "Éxito del cliente", "Satisfacción", "Testimonios", "Referidos", "Retención",
      "Recuperación", "Capacitación", "Preguntas frecuentes", "Reportes al cliente", "Escucha de quejas", "Comunidad de clientes",
      "Renovaciones",
    ],
    tareas: {
      mercedes: [
        ["Pedido de testimonio en video", "Testimonios", "Mensaje para pedirle a un cliente contento un video de 20 segundos, con las tres preguntas que tiene que responder."],
        ["El momento del referido", "Referidos", "Cuándo pedir un referido (cuando el cliente ve su primera venta) y el texto exacto para pedirlo."],
        ["Bienvenida en 24 horas", "Bienvenida", "Lo que recibe una empresa el primer día: mensaje de bienvenida, lo que pasa esta semana y a quién escribir."],
        ["Reporte semanal al cliente", "Reportes al cliente", "Conversaciones atendidas, ventas registradas y una mejora para la próxima semana, en un mensaje."],
        ["Encuesta de dos preguntas", "Satisfacción", "Encuesta a los 30 días y qué se hace con cada tipo de respuesta."],
        ["Videos con clientes", "Comunidad de clientes", "Ideas de video con clientes, con su permiso: cómo atendían antes y cómo atienden ahora."],
        ["Clientes en riesgo", "Retención", "Señales de que un cliente se va (usa menos, se queja, paga tarde) y la llamada para cada caso."],
      ],
      "mil-millones": [
        ["Instalación sin llamada", "Instalación", "Guía paso a paso para que una empresa deje su empleado de IA funcionando sola en menos de una hora."],
        ["Centro de ayuda", "Preguntas frecuentes", "Las 40 preguntas más comunes con respuesta corta, para que el soporte crezca sin contratar."],
        ["Academia para clientes", "Capacitación", "Cinco videos cortos: catálogo, horarios, seguimiento, reportes y cómo sacarle más provecho al empleado de IA."],
        ["Metas a los 7, 30 y 90 días", "Éxito del cliente", "Lo que tiene que lograr un cliente en cada etapa y lo que hace PRIME para que lo logre."],
        ["Recuperar a quien se fue", "Recuperación", "Mensaje y oferta para quien canceló, con la pregunta para saber por qué se fue."],
        ["Del pago mensual al anual", "Renovaciones", "Oferta para pasar a pago anual, con el beneficio para el cliente y para PRIME."],
        ["Lo que dicen las quejas", "Escucha de quejas", "Juntar las quejas del mes y convertirlas en las tres mejoras más pedidas."],
        ["Soporte en minutos", "Soporte", "Tiempo de respuesta del soporte, la meta y lo que resuelve un empleado de IA antes de que intervenga una persona."],
      ],
    },
  },

  karp: {
    mision: "Convertir los datos en decisiones: medir de verdad el reto, las ventas y el producto, sin un solo número inventado.",
    color: "#8C9510",
    roles: [
      "Tableros", "Métricas del reto", "Métricas de negocio", "Analítica de contenido", "Analítica de producto", "Ingresos recurrentes",
      "Cohortes", "Pronósticos", "Calidad de datos", "Inteligencia competitiva", "Investigación de mercado", "Atribución",
      "Experimentos", "Reportes ejecutivos", "Privacidad de datos",
    ],
    tareas: {
      mercedes: [
        ["Tablero del contador", "Métricas del reto", "Lo sumado por semana y el ritmo necesario para el récord y el límite, todo desde el número real del contador."],
        ["De qué video llega cada cliente", "Atribución", "Una pregunta al cerrar cada venta para saber de qué video o red llegó la empresa, y la tabla donde se anota."],
        ["Qué formato repetir", "Analítica de contenido", "Retención, compartidos y comentarios de cada video, para decidir qué formato repetir."],
        ["Pronóstico honesto de diciembre", "Pronósticos", "Con el ritmo real hasta hoy, a dónde llega el contador el 30 de diciembre y qué tendría que cambiar."],
        ["Un experimento por semana", "Experimentos", "Gancho, horario u oferta: qué se prueba, qué se mide y cuándo se decide."],
        ["Cada número con su prueba", "Calidad de datos", "Revisión de que cada cifra publicada tiene comprobante, fecha y fuente."],
      ],
      "silicon-valley": [
        ["Las métricas que mira un fondo", "Métricas de negocio", "Ingresos recurrentes, crecimiento mensual, retención y costo de adquisición: definición y cómo medir cada una en PRIME."],
        ["Tabla de cohortes", "Cohortes", "Qué parte de las empresas de cada mes sigue pagando a los 3, 6 y 12 meses."],
        ["Tablero para inversionistas", "Tableros", "Las métricas reales de PRIME en una pantalla, lista para compartir en una reunión."],
        ["Qué se usa y qué no", "Analítica de producto", "Las funciones que más usan las empresas y las que nadie usa, para decidir qué construir."],
        ["Pymes de Latinoamérica en números", "Investigación de mercado", "Cuántas pymes hay en los cinco países más grandes de la región y cuántas venden por mensajería, con la fuente de cada número."],
        ["Ingresos recurrentes bien contados", "Ingresos recurrentes", "Reglas para contar solo lo que se cobra cada mes, separado de instalaciones y pagos únicos."],
        ["Reporte ejecutivo mensual", "Reportes ejecutivos", "Una página con los números del mes, lo que subió, lo que bajó y por qué."],
      ],
      "mil-millones": [
        ["La competencia en una página al mes", "Inteligencia competitiva", "Qué lanzaron, cuánto cobran y a quién le venden las empresas de agentes de IA."],
        ["Tamaño del mercado al 2030", "Investigación de mercado", "Cuántas empresas podrían usar empleados de IA en 2030 y cuántas necesita PRIME para valer mil millones, con las fuentes."],
        ["Pronóstico a cinco años", "Pronósticos", "Tres velocidades de crecimiento (lenta, base, rápida) a partir de los números reales de hoy."],
        ["Lo que solo PRIME aprende", "Analítica de producto", "Qué enseñan millones de conversaciones anonimizadas que nadie más tiene, y cómo mejora el producto con eso."],
        ["Privacidad desde el diseño", "Privacidad de datos", "Qué se anonimiza, qué nunca se usa para mejorar el producto y cómo se le explica al cliente."],
        ["Prueba de planes y precios", "Experimentos", "Un experimento con un grupo chico de empresas nuevas, sin cambiar lo que pagan las actuales."],
      ],
    },
  },

  marco: {
    mision: "Que cada dólar tenga un trabajo y cada día su disciplina: cuentas claras para el reto y para PRIME.",
    color: "#BF5FC9",
    roles: [
      "Contabilidad", "Flujo de caja", "Presupuesto", "Comprobantes", "Costos", "Margen", "Rentabilidad", "Cobros", "Tipo de cambio",
      "Modelo financiero", "Impuestos", "Reservas", "Reinversión", "Disciplina diaria", "Revisión semanal", "Estoicismo aplicado",
    ],
    tareas: {
      mercedes: [
        ["Comprobante de cada ingreso", "Comprobantes", "Proceso para que cada dólar del contador tenga su comprobante publicado, con los datos de terceros tapados en la imagen."],
        ["Flujo de caja del reto", "Flujo de caja", "Entradas, salidas y saldo por semana, separando lo que suma al contador de lo que se reinvierte."],
        ["Gastos que se cortan hoy", "Costos", "Cada gasto mensual con su retorno, y los que se cortan porque no traen ingresos."],
        ["Cobrar a tiempo", "Cobros", "Recordatorios de pago y la regla de qué pasa si un cliente no paga, escritos con respeto."],
        ["Una sola regla para bolivianos y dólares", "Tipo de cambio", "Cómo se pasa a dólares lo que se cobra en bolivianos: qué tipo de cambio, de qué fuente y de qué fecha."],
        ["Revisión del domingo", "Revisión semanal", "15 minutos: qué entró, qué salió, qué se aprendió y la meta de la semana."],
        ["Tres bloques al día", "Disciplina diaria", "Rutina con bloques fijos para vender, crear y construir, y cómo se mide si se cumplió."],
      ],
      "silicon-valley": [
        ["Modelo financiero a tres años", "Modelo financiero", "Ingresos, costos y empresas por mes, con los supuestos escritos y separados de los números reales."],
        ["Margen por cliente", "Margen", "Lo que queda de cada empresa cliente después de pagar modelos de IA, servidores y soporte."],
        ["En qué se gasta una inversión", "Presupuesto", "Si entra capital, en qué se usa cada dólar en los primeros 18 meses y qué resultado compra."],
        ["Cuentas listas para una diligencia", "Contabilidad", "Lo que tiene que estar en orden (estados financieros, contratos, cuentas separadas) antes de hablar con un fondo."],
        ["Impuestos en dos países", "Impuestos", "Qué cambia si PRIME tiene una sociedad en Estados Unidos y otra en Bolivia; marcar qué verificar con un contador."],
        ["Meses de vida", "Reservas", "Cuántos meses puede operar PRIME con lo que tiene, y la regla de reserva mínima."],
      ],
      "mil-millones": [
        ["Economía de cada cliente", "Rentabilidad", "Costo de conseguir una empresa, lo que paga en toda su vida como cliente y en cuánto tiempo devuelve lo invertido."],
        ["Regla de reinversión", "Reinversión", "Qué parte de cada ingreso se reinvierte en crecer y en qué orden."],
        ["Cobrar en todo el mundo", "Cobros", "Tarjeta, transferencia o stablecoins: cómo cobrar a empresas de otros países y cuánto cuesta cada camino."],
        ["La cuenta de los mil millones", "Modelo financiero", "Cuántas empresas, a qué precio promedio y con qué múltiplo llevan a una valuación de mil millones, con los supuestos a la vista."],
        ["Calma cuando entra menos", "Estoicismo aplicado", "Guía de una página para decidir cuando entra menos dinero del esperado: qué depende de Kev y qué no."],
        ["Presupuesto del año", "Presupuesto", "Presupuesto por área atado a la meta de empresas, revisado cada mes."],
      ],
    },
  },

  napoleon: {
    mision: "Llevar a PRIME de Bolivia al mundo con orden: un país a la vez, con procesos que se copian y no se improvisan.",
    color: "#B28242",
    roles: [
      "Procesos", "Manuales", "Expansión por país", "Lanzamientos", "Contratación", "Equipo remoto", "Proveedores", "Calidad operativa",
      "Planificación", "Tableros de operación", "Socios locales", "Cultura", "Herramientas", "Velocidad de ejecución", "Mapas de campaña",
    ],
    tareas: {
      mercedes: [
        ["Primeras ventas fuera de Bolivia", "Expansión por país", "Plan de 30 días para cerrar las primeras empresas en México, España o Estados Unidos, cobrando en dólares."],
        ["Grabar una vez, publicar en cuatro redes", "Procesos", "Quién hace cada paso y cuánto tarda, desde la grabación hasta la publicación."],
        ["El segundo editor", "Contratación", "Perfil, prueba de edición y rango de pago a proponer, para poder abrir la segunda cuenta."],
        ["Manual de instalación", "Manuales", "Cada paso desde que una empresa paga hasta que su empleado de IA atiende, con el tiempo de cada uno."],
        ["Semana tipo del reto", "Planificación", "Ventas, grabaciones, publicaciones e instalaciones en un calendario donde nada choca."],
        ["Herramientas mínimas", "Herramientas", "Las herramientas que se pagan, las que se cortan y las gratis que alcanzan."],
        ["Del pago a la atención en 48 horas", "Velocidad de ejecución", "Medir cuánto tarda hoy una instalación y qué se elimina para que un cliente nuevo esté atendiendo en dos días."],
      ],
      "mil-millones": [
        ["Orden de entrada a los países", "Mapas de campaña", "Diez países ordenados por tamaño, idioma, competencia y costo de entrar."],
        ["Manual para abrir un país", "Manuales", "Lo que se hace siempre al entrar a un país: socio local, precios en moneda local, primeros casos y anuncios."],
        ["El socio local", "Socios locales", "Perfil del socio que revende PRIME en su país y el acuerdo, para crecer sin oficinas."],
        ["Equipo en varios países", "Equipo remoto", "Horarios, reuniones y lo que se escribe en lugar de hablarse, para coordinar personas en varios países."],
        ["Misma calidad en cada país", "Calidad operativa", "Controles para que un cliente en España reciba la misma atención que uno en Santa Cruz."],
        ["Cómo se trabaja en PRIME", "Cultura", "Las reglas de la casa (todo hoy, rápido y verificado) escritas para quien entra al equipo."],
        ["Tablero de operación", "Tableros de operación", "Instalaciones en curso, tiempos de soporte y clientes por país en una sola pantalla."],
        ["Lanzamiento en un país nuevo", "Lanzamientos", "Las primeras dos semanas en un país: anuncios, demo local, eventos y la meta de empresas."],
      ],
    },
  },

  tate: {
    mision: "Que el reto se vea en todas partes: ganchos que detienen el dedo y videos que la gente comparte.",
    color: "#F3669A",
    roles: [
      "Ganchos", "Guiones cortos", "Tendencias", "Edición rápida", "Subtítulos", "TikTok", "Instagram", "YouTube Shorts", "Facebook",
      "X", "Comentarios", "Horarios", "Retención", "Colaboraciones", "Series", "Constancia",
    ],
    tareas: {
      mercedes: [
        ["Banco de 50 ganchos", "Ganchos", "Primeras frases de 3 segundos con plata, calle o drama, pasadas por el filtro del reto."],
        ["Guion de 30 segundos", "Guiones cortos", "Gancho, prueba en pantalla y cierre que pide compartir, en menos de 80 palabras."],
        ["Serie cada 48 horas", "Series", "Diez capítulos del reto, cada uno termina con la pregunta que obliga a ver el siguiente."],
        ["Arreglar los primeros 5 segundos", "Retención", "Dónde se va la gente en los videos que nadie terminó y cómo se rehace el comienzo."],
        ["Comentarios que se vuelven videos", "Comentarios", "Los 20 comentarios más repetidos y un video de respuesta para cada uno."],
        ["Prueba de horarios", "Horarios", "Dos semanas publicando en horarios distintos y cómo leer el resultado."],
        ["Hilo para X", "X", "Ocho publicaciones con la historia del reto hasta hoy, con el número real del contador."],
        ["Cinco colaboraciones", "Colaboraciones", "Creadores para un video juntos y el mensaje para proponerlo."],
        ["Tendencias de la semana", "Tendencias", "Tres formatos o audios del momento que encajan con el reto sin perder la marca."],
        ["Ni un día sin publicar", "Constancia", "Videos grabados por adelantado, una lista de reserva y la regla para los días malos."],
      ],
    },
  },

  gadzhi: {
    mision: "Producir el contenido del reto y de PRIME como una agencia de primer nivel: calidad alta, a tiempo, todas las semanas.",
    color: "#F1A4F7",
    roles: [
      "Dirección creativa", "Guiones largos", "Producción", "Edición", "Diseño gráfico", "Miniaturas", "Fotografía", "LinkedIn",
      "Boletín", "Calendario editorial", "Videos con IA", "Marca personal", "Reutilización", "Contenido educativo", "Documental",
    ],
    tareas: {
      mercedes: [
        ["Episodio de YouTube de 8 minutos", "Guiones largos", "El capítulo del mes: el número del contador, lo que salió mal, lo que funcionó y el próximo paso."],
        ["Calendario editorial del mes", "Calendario editorial", "Qué se publica cada día en cada red y para qué: alcance, confianza o venta."],
        ["Miniaturas que se leen en un celular", "Miniaturas", "Cinco conceptos con tres palabras y una cara, probados al tamaño real de un celular."],
        ["Videos con IA para clientes", "Videos con IA", "La mejora de plan de videos con IA para clientes de PRIME, con tres guiones de ejemplo."],
        ["Un video, ocho piezas", "Reutilización", "Cómo un video largo se vuelve cortes, carrusel, hilo y correo, con la lista de cada pieza."],
        ["Documental del récord", "Documental", "Estructura de un documental de 20 minutos y las escenas que hay que grabar desde ya."],
        ["Boletín semanal", "Boletín", "El correo de cada semana: el número, la lección y un llamado a la acción."],
        ["Que los videos se vean caros", "Producción", "Micrófono de solapa, luz y encuadre: lo mínimo, con precio de referencia de cada cosa."],
      ],
      "silicon-valley": [
        ["Construir en público en inglés", "LinkedIn", "Diez publicaciones sobre construir una empresa de IA desde Bolivia, para que los inversionistas sigan la historia."],
        ["Video para una aceleradora", "Producción", "Guion del video de un minuto que piden las aceleradoras: quién es Kev, qué hace PRIME y la tracción."],
        ["Kev como fundador", "Marca personal", "Cómo se presenta Kev en cada red para que lo vean como fundador de una empresa de IA, no solo como creador."],
        ["Diseño del deck", "Diseño gráfico", "Plantilla visual del deck con la identidad de PRIME: limpia, con aire y del 2030."],
        ["Qué es un empleado de IA", "Contenido educativo", "Cinco videos que lo explican a dueños de negocio, sin palabras técnicas."],
        ["Serie: camino a Silicon Valley", "Dirección creativa", "Capítulos, momentos clave y cómo se graba cada uno."],
        ["Fotos de fundador", "Fotografía", "Lista de fotos para perfiles, prensa y el deck: dónde, con qué luz y con qué ropa."],
      ],
    },
  },

  kobe: {
    mision: "Mentalidad de alto rendimiento aplicada al reto: entrenar para rendir al máximo todos los días.",
    color: "#8A75F1",
    roles: [
      "Rutina diaria", "Sueño y energía", "Entrenamiento físico", "Nutrición", "Enfoque profundo", "Hábitos", "Mentalidad",
      "Revisión de partido", "Práctica deliberada", "Recuperación", "Presión", "Oratoria", "Metas semanales", "Rendición de cuentas",
      "Gestión del tiempo",
    ],
    tareas: {
      mercedes: [
        ["Rutina de alto rendimiento", "Rutina diaria", "Un día de Kev con bloques de venta, contenido y entrenamiento, y el horario de sueño que lo sostiene."],
        ["Revisión de partido de cada video", "Revisión de partido", "Ver cada video publicado como Kobe veía sus partidos: tres cosas que mejorar en el siguiente."],
        ["Diez repeticiones de la llamada de venta", "Práctica deliberada", "Grabar la llamada de venta diez veces por semana y mejorar una sola cosa cada vez."],
        ["Oratoria frente a cámara", "Oratoria", "Ejercicios de 10 minutos al día para hablar más claro y con más energía en los videos."],
        ["Tres metas por semana", "Metas semanales", "Ventas, videos y entregas medibles, con la revisión del viernes."],
        ["30 minutos de entrenamiento", "Entrenamiento físico", "Plan diario sin gimnasio para tener energía en jornadas largas."],
        ["Alguien que revisa las metas", "Rendición de cuentas", "Un compañero que revisa las metas cada semana, y lo que se publica si no se cumplen."],
      ],
      "mil-millones": [
        ["Estándares del equipo", "Mentalidad", "Qué es un trabajo terminado, qué es llegar tarde y qué es excelencia en PRIME."],
        ["Cuatro horas sin interrupciones", "Enfoque profundo", "Cómo proteger cuatro horas al día para construir lo del 2030."],
        ["Dormir para decidir mejor", "Sueño y energía", "Plan de sueño para un fundador que decide mucho, con lo que dice la ciencia sobre dormir poco."],
        ["Antes de una reunión grande", "Presión", "Rutina previa a un pitch o una negociación: respiración, ensayo y la primera frase."],
        ["Descansar sin frenar", "Recuperación", "Un día por semana y una semana por trimestre de descanso, planificados para durar años."],
        ["En qué se va la semana", "Gestión del tiempo", "Medir una semana real de Kev y decidir qué se delega a un empleado de IA."],
        ["Comer para rendir", "Nutrición", "Menú simple y barato para días largos de trabajo y entrenamiento en Santa Cruz."],
      ],
    },
  },

  socrates: {
    mision: "Preguntar hasta encontrar la verdad: revisar cada pieza, cada número y cada promesa antes de que salga.",
    color: "#B0B68A",
    roles: [
      "Revisión de textos", "Verificación de datos", "Preguntas difíciles", "Abogado del diablo", "Revisión de guiones",
      "Revisión de ofertas", "Revisión del deck", "Pruebas de producto", "Experiencia de usuario", "Coherencia de marca",
      "Errores frecuentes", "Lecciones aprendidas", "Revisión de idioma", "Lógica", "Críticas de clientes",
    ],
    tareas: {
      mercedes: [
        ["Cada número con su comprobante", "Verificación de datos", "Revisar que cada cifra de los videos y de la web coincida con el contador y tenga comprobante."],
        ["Crítica de los últimos 10 videos", "Revisión de guiones", "Qué promete cada gancho y si el video lo cumple; los que engañan se marcan."],
        ["Abogado del diablo del plan del mes", "Abogado del diablo", "Cinco razones por las que el plan de 30 días podría fallar y lo que se cambia antes de empezar."],
        ["La oferta leída por un desconfiado", "Revisión de ofertas", "Qué no se entiende y qué suena a promesa vacía para un dueño de negocio."],
        ["Español neutro en todo", "Revisión de idioma", "Revisión de la web y los guiones para que suenen a español neutro de Latinoamérica."],
        ["Lecciones del mes", "Lecciones aprendidas", "Los errores del mes, su causa y la regla que evita repetirlos."],
      ],
      "silicon-valley": [
        ["20 preguntas que hunden un pitch", "Preguntas difíciles", "Lo que preguntaría un inversionista escéptico sobre PRIME, y dónde la respuesta de hoy es débil."],
        ["El deck frase por frase", "Revisión del deck", "Cada afirmación con su prueba; la que no la tiene se demuestra o se corta."],
        ["Usar PRIME como un extraño", "Pruebas de producto", "Hablar con un empleado de IA como un cliente nuevo y anotar cada momento confuso."],
        ["El primer minuto en la web", "Experiencia de usuario", "Qué ve un inversionista en su primer minuto en primebusiness.live y qué no entiende."],
        ["Los saltos de la tesis", "Lógica", "Dónde el argumento de por qué gana PRIME salta de una idea a otra sin prueba."],
        ["Un solo mensaje", "Coherencia de marca", "Cómo se describe PRIME en la web, el deck y LinkedIn, y una versión única."],
        ["Errores clásicos de startups", "Errores frecuentes", "Los errores más comunes en etapa temprana y si PRIME está cometiendo alguno."],
      ],
      "mil-millones": [
        ["Una pregunta por regla del manual", "Preguntas difíciles", "Para cada regla de Kev, la pregunta que comprueba si una decisión la cumple."],
        ["Dónde el plan depende de la suerte", "Abogado del diablo", "Las partes del plan a mil millones que dependen de suerte y no de trabajo, y cómo reducirlas."],
        ["Rúbrica de calidad del empleado", "Pruebas de producto", "50 conversaciones puntuadas en verdad, tono, rapidez, cierre y cuidado."],
        ["Arreglo u otro producto", "Críticas de clientes", "Separar las críticas que piden un arreglo de las que piden otro producto."],
        ["La versión más simple", "Lógica", "En cada proceso de PRIME, la parte más complicada y la versión simple que da el mismo resultado."],
        ["Promesas con respaldo", "Revisión de textos", "Cada promesa de la web y los anuncios con su prueba; la que no la tiene se reescribe."],
      ],
    },
  },

  cleopatra: {
    mision: "Tejer alianzas con empresas, gobiernos y comunidades de otros países que abran mercados enteros para PRIME.",
    color: "#1ECDAA",
    roles: [
      "Alianzas estratégicas", "Socios tecnológicos", "Programas para startups", "Gobiernos y cámaras", "Distribuidores",
      "Diplomacia empresarial", "Ferias internacionales", "Traducción y cultura", "Estados Unidos", "España", "México", "Brasil",
      "Revendedores", "Coinversiones", "Embajadas",
    ],
    tareas: {
      "silicon-valley": [
        ["Créditos de nube e IA para startups", "Programas para startups", "Programas de grandes empresas de nube e IA que dan créditos a startups, con requisitos y cómo postular; verificar condiciones vigentes."],
        ["Socios de software en Estados Unidos", "Socios tecnológicos", "Empresas de software que venden a pymes y podrían sumar los empleados de IA de PRIME a lo que ofrecen."],
        ["Negocios hispanos en Estados Unidos", "Estados Unidos", "Cuántos son, dónde están y por qué un empleado de IA en español les sirve, con fuentes."],
        ["Cinco ferias que valen el viaje", "Ferias internacionales", "Conferencias de startups e IA en Estados Unidos con la mejor relación entre costo y contactos; verificar fechas."],
        ["Presentar PRIME a la manera de allá", "Traducción y cultura", "Qué cambia al presentar ante una audiencia de Estados Unidos: directo, con números y en inglés."],
        ["Apoyo de oficinas comerciales", "Embajadas", "Programas de embajadas y oficinas comerciales que apoyan a startups latinoamericanas que viajan a Estados Unidos; verificar requisitos."],
        ["Primer mensaje a una empresa extranjera", "Diplomacia empresarial", "Plantilla respetuosa y con una propuesta clara para escribirle a una empresa grande de otro país."],
      ],
      "mil-millones": [
        ["Un distribuidor por región", "Distribuidores", "Perfil y acuerdo para la región andina, el Cono Sur, Centroamérica y el Caribe."],
        ["Entrada a España", "España", "Idioma, protección de datos europea, precios en euros y primeros clientes."],
        ["Entrada a México", "México", "Los rubros que más venden por mensajería en el mercado más grande de habla hispana, y cómo llegar a ellos."],
        ["Brasil en portugués", "Brasil", "Idioma, competidores locales y un socio de entrada."],
        ["Contrato de revendedor", "Revendedores", "Margen, metas, uso de la marca y lo que una agencia que revende PRIME no puede prometer."],
        ["Programas de digitalización de pymes", "Gobiernos y cámaras", "Programas públicos y de cámaras en Latinoamérica donde PRIME puede ser proveedor."],
        ["Alianza con una empresa grande", "Alianzas estratégicas", "Qué empresa de tecnología o telefonía de la región podría ofrecer PRIME a sus clientes, y qué gana cada lado."],
      ],
    },
  },

  leonardo: {
    mision: "Inventar lo que PRIME venderá en 2030: prototipos rápidos, probados con empresas reales.",
    color: "#E9B5B5",
    roles: [
      "Prototipos", "Investigación de usuarios", "Nuevos productos", "Bocetos", "Agentes autónomos", "Voz e interfaces", "Robótica",
      "Stablecoins", "Patentes", "Laboratorio", "Lectura de investigaciones", "Banco de ideas", "Hardware", "Pruebas con clientes",
      "Cuaderno de inventos",
    ],
    tareas: {
      "silicon-valley": [
        ["Un invento para la demo", "Prototipos", "Un prototipo de una semana (por ejemplo, un empleado de IA que llama para cobrar) listo para mostrar a inversionistas."],
        ["Cinco investigaciones de agentes", "Lectura de investigaciones", "Resumen de investigaciones públicas recientes sobre agentes de IA y qué se puede usar ya en PRIME."],
        ["Lo que es propio de PRIME", "Patentes", "Procesos, datos y marca: qué se puede proteger y cómo; marcar qué consultar con un abogado."],
        ["Diez preguntas a dueños de negocio", "Investigación de usuarios", "Guion de entrevista para descubrir qué tarea pagarían por quitarse de encima."],
        ["Cuaderno de inventos", "Cuaderno de inventos", "Formato al estilo de Leonardo: cada idea con boceto, prueba, resultado y fecha."],
        ["Un agente que trabaja solo", "Agentes autónomos", "Prototipo que hace una tarea completa sin que nadie le escriba: revisar pedidos y avisar faltantes."],
      ],
      "mil-millones": [
        ["Pagos entre agentes con stablecoins", "Stablecoins", "Cómo un empleado de IA podría cobrar y pagar en USDT o USDC, con los riesgos y lo que pide la ley."],
        ["Robots baratos para pymes", "Robótica", "Qué robots existen hoy para tiendas y depósitos y cómo se conectarían a un empleado de IA."],
        ["Un empleado que se maneja con la voz", "Voz e interfaces", "Boceto para dueños que no usan computadora: todo se pide y se aprueba hablando."],
        ["Banco de 100 ideas", "Banco de ideas", "Cien ideas puntuadas por impacto, costo y empresas que sumarían; las tres primeras con boceto."],
        ["El cerebro de la empresa", "Nuevos productos", "Concepto de un producto que junta ventas, inventario y atención en un solo agente para la pyme."],
        ["Un experimento por semana", "Laboratorio", "Hipótesis, fecha y resultado de cada experimento, aunque falle."],
        ["Un aparato para el mostrador", "Hardware", "Idea de un dispositivo simple que conecta al cliente de una tienda con su empleado de IA."],
        ["Probar con cinco clientes", "Pruebas con clientes", "Cómo se prueba un invento con cinco empresas reales antes de construirlo completo."],
      ],
    },
  },

  lincoln: {
    mision: "Que todo lo que hace PRIME esté en regla en cada país, para crecer sin sorpresas.",
    color: "#A0ACF1",
    roles: [
      "Sociedades", "Contratos con clientes", "Términos y privacidad", "Propiedad intelectual", "Marcas", "Inversiones y SAFE",
      "Acciones y socios", "Cumplimiento", "Regulación de IA", "Protección de datos", "Instituciones públicas", "Laboral",
      "Visas y viajes", "Disputas", "Ética y gobierno",
    ],
    tareas: {
      "silicon-valley": [
        ["Sociedad en Delaware", "Sociedades", "Pasos y costos de referencia para crear la sociedad que suelen pedir los fondos de Estados Unidos; verificar con un abogado."],
        ["Qué es un SAFE", "Inversiones y SAFE", "Una página sobre el acuerdo estándar que creó Y Combinator para invertir en etapa temprana, y qué cláusulas mirar."],
        ["Reparto de acciones", "Acciones y socios", "Consolidación en cuatro años con un año de espera: cómo funciona y por qué lo piden los fondos."],
        ["Registro de la marca", "Marcas", "Dónde y cómo registrar la marca PRIME en Bolivia y en Estados Unidos, revisando antes las marcas parecidas; verificar con un abogado."],
        ["Visa para reuniones de negocios", "Visas y viajes", "Qué visa necesita un boliviano para reuniones en Estados Unidos, qué documentos llevar y con cuánta anticipación pedirla."],
        ["El código es de PRIME", "Propiedad intelectual", "Cláusulas para que todo el código, los textos y los datos que se hacen para PRIME sean de PRIME."],
        ["Lo que pide la diligencia legal", "Cumplimiento", "Documentos legales que pide un fondo antes de invertir y cuáles faltan."],
      ],
      "mil-millones": [
        ["Contrato con clientes en lenguaje claro", "Contratos con clientes", "Qué hace el empleado de IA, qué no, quién responde por qué y cómo se cancela."],
        ["Términos y privacidad para varios países", "Términos y privacidad", "Términos de uso y política de privacidad que un dueño de negocio entiende."],
        ["Las leyes de IA que vienen", "Regulación de IA", "Lo que pide la ley de IA de la Unión Europea y lo que se discute en Latinoamérica, y qué cambiar hoy."],
        ["Datos personales por país", "Protección de datos", "Tabla de lo que pide cada país sobre los datos de los clientes de las empresas que usan PRIME."],
        ["Ser el número uno dentro de la ley", "Ética y gobierno", "Qué se puede y qué no al liderar una categoría: exclusividades, precios y contratos."],
        ["Contratar en otros países", "Laboral", "Cómo sumar personas de otros países sin abrir una empresa en cada uno; verificar con un abogado."],
        ["Vender al Estado", "Instituciones públicas", "Requisitos para vender a instituciones públicas en Bolivia y en otros países de la región."],
      ],
    },
  },

  jobs: {
    mision: "Un producto y una marca tan simples y tan buenos que se quieren sin explicación: el futuro del 2030 vivo en 2026.",
    color: "#E1E9F2",
    roles: [
      "Visión de producto", "Diseño de producto", "Experiencia de usuario", "Identidad visual", "Mensaje", "Lanzamientos",
      "Presentaciones", "Empaque de la oferta", "Página web", "Demo", "Detalles", "Simplicidad", "Investigación de clientes",
      "Hoja de ruta", "Sistema de diseño", "Narrativa de marca",
    ],
    tareas: {
      mercedes: [
        ["PRIME en una frase", "Mensaje", "Qué es PRIME en menos de diez palabras, probado con cinco dueños de negocio."],
        ["La web que vende en 10 segundos", "Página web", "Nuevo primer pantallazo de primebusiness.live: qué es, para quién y el botón para probar."],
        ["Demo abierta en la web", "Demo", "Un empleado de IA de prueba que cualquiera puede usar sin registrarse."],
        ["El reto y PRIME en cada pieza", "Narrativa de marca", "Cómo se conectan los dos: el auto es la carnada; el producto, la prueba."],
        ["Lanzamiento en 60 segundos", "Lanzamientos", "Guion de una función nueva presentada como una keynote, listo para grabar."],
        ["Diez detalles que se notan", "Detalles", "Mensajes, tiempos y avisos pequeños que hacen que el producto se sienta caro."],
      ],
      "silicon-valley": [
        ["Keynote de 5 minutos", "Presentaciones", "Una idea por diapositiva y la demo en el centro."],
        ["Los próximos 12 meses", "Hoja de ruta", "Qué sale, en qué orden y a qué se dice que no."],
        ["Un producto que se entiende solo", "Experiencia de usuario", "Desde que una empresa entra hasta que su empleado vende, con cada paso que sobra marcado."],
        ["Identidad en una página", "Identidad visual", "Logo, colores y tipografía aplicados al deck, la web y los correos."],
        ["Diez entrevistas con clientes", "Investigación de clientes", "Qué aman, qué odian y qué pagarían por tener."],
        ["Lo que se quita", "Simplicidad", "Funciones y textos que se eliminan porque nadie los usa o confunden."],
      ],
      "mil-millones": [
        ["El producto del 2030", "Visión de producto", "PRIME en 2030 descrito como si ya existiera, en una página."],
        ["La marca de la categoría", "Narrativa de marca", "Cómo la marca muestra que PRIME creó la categoría de los empleados de IA."],
        ["Planes fáciles de elegir", "Empaque de la oferta", "Nombre de cada plan, qué incluye y cómo se muestra para que elegir sea fácil."],
        ["Sistema de diseño", "Sistema de diseño", "Componentes, colores y tipografía documentados para que toda pieza se vea igual."],
        ["Un producto para cada tamaño", "Diseño de producto", "Cómo cambia el producto para la tienda de barrio, la pyme y la empresa grande, sin hacer tres productos."],
        ["El evento anual de PRIME", "Lanzamientos", "Fecha, formato y lo que se anuncia cada año."],
      ],
    },
  },
}

export const DEPARTAMENTOS: Departamento[] = DEPARTAMENTOS_BASE.map((b) => {
  const d = DETALLE[b.id]
  // Un departamento sin detalle rompería la grilla y el servidor en silencio:
  // mejor que falle al cargar, en desarrollo, con el motivo.
  if (!d) throw new Error(`casa-blanca/empresa: falta el DETALLE del departamento "${b.id}".`)
  const tareas = OBJETIVOS_BASE.flatMap((o) =>
    (d.tareas[o.id] ?? []).map(([titulo, rol, detalle]) => {
      if (!d.roles.includes(rol)) throw new Error(`casa-blanca/empresa: la tarea "${titulo}" de "${b.id}" usa el rol "${rol}", que no está en sus roles.`)
      return { objetivoId: o.id, titulo, rol, detalle }
    }),
  )
  return { id: b.id, nombre: b.nombre, liderId: b.id, mision: d.mision, color: d.color, lugarId: b.lugarId, nivel: b.nivel, roles: d.roles, tareas }
})

export const DEPARTAMENTO: Record<string, Departamento> = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.id, d]))

/** Quién trabaja en cada objetivo sale de las tareas: una sola fuente, no una lista aparte que se desincroniza. */
export const OBJETIVOS: Objetivo[] = OBJETIVOS_BASE.map((o) => ({
  ...o,
  departamentos: DEPARTAMENTOS.filter((d) => d.tareas.some((t) => t.objetivoId === o.id)).map((d) => d.id),
}))

export const OBJETIVO: Record<string, Objetivo> = Object.fromEntries(OBJETIVOS.map((o) => [o.id, o]))

/** Las tareas de un departamento para un objetivo, en el orden en que se hacen. */
export function tareasDe(depId: string, objetivoId: string): Departamento["tareas"] {
  return (DEPARTAMENTO[depId]?.tareas ?? []).filter((t) => t.objetivoId === objetivoId)
}

// El servidor guarda cada entregable con el título exacto de su tarea: así se
// sabe qué está hecho sin depender de lo que escribió la IA.
const hechas = (depId: string, objetivoId: string, entregables: Entregable[]) =>
  new Set(entregables.filter((e) => e.departamentoId === depId && e.objetivoId === objetivoId).map((e) => e.titulo.trim()))

/** La próxima tarea sin entregar de un departamento en un objetivo, o null si ya entregó todas. */
export function siguienteTarea(depId: string, objetivoId: string, entregables: Entregable[]): Departamento["tareas"][number] | null {
  const listas = hechas(depId, objetivoId, entregables)
  return tareasDe(depId, objetivoId).find((t) => !listas.has(t.titulo)) ?? null
}

// ── Agentes ───────────────────────────────────────────────────

// Nombres de pila de toda Latinoamérica (incluye quechua, aimara, mapuche y
// náhuatl). Fuera los de los líderes y el de Kev, para que una etiqueta no se
// confunda con un personaje. Mitad mujeres, mitad hombres en cada depto.
const NOMBRES_F = [
  "Valentina", "Camila", "Sofía", "Isabella", "Mariana", "Daniela", "Gabriela", "Lucía", "Victoria", "Martina", "Valeria", "Antonella",
  "Renata", "Ximena", "Fernanda", "Paula", "Andrea", "Carolina", "Natalia", "Juliana", "Catalina", "Florencia", "Agustina", "Emilia",
  "Regina", "Jimena", "Abril", "Salomé", "Luciana", "Micaela", "Romina", "Paola", "Alejandra", "Verónica", "Claudia", "Patricia",
  "Rocío", "Lorena", "Milagros", "Guadalupe", "Itzel", "Xóchitl", "Citlali", "Yaretzi", "Nayeli", "Wara", "Killa", "Nayra",
  "Ayelén", "Rayén", "Anahí", "Belén", "Pilar", "Inés", "Teresa", "Rosa", "Carmen", "Elena", "Adriana", "Mónica", "Beatriz",
  "Silvia", "Gloria", "Marisol", "Maribel", "Yesenia", "Dayana", "Karina", "Tatiana", "Vanessa", "Liliana", "Jazmín", "Esperanza",
  "Graciela", "Noemí", "Zoe", "Olivia", "Mía", "Amanda", "Bianca", "Celeste", "Dulce", "Estefanía", "Fabiola", "Ivana", "Lourdes",
  "Magdalena", "Maite", "Nicole", "Pamela", "Raquel", "Sara", "Tamara", "Wendy", "Yamila", "Luz", "Brenda", "Leticia", "Clara",
  "Julieta", "Isidora", "Constanza", "Josefina", "Trinidad", "Francisca", "Antonia", "Amparo", "Consuelo", "Dalia", "Iris", "Noelia",
  "Gisela", "Marcela", "Viviana", "Fiorella", "Kiara", "Yuliana", "Ruth", "Elisa",
]
const NOMBRES_M = [
  "Mateo", "Santiago", "Sebastián", "Diego", "Nicolás", "Samuel", "Matías", "Tomás", "Emiliano", "Joaquín", "Lucas", "Gabriel",
  "Daniel", "David", "Felipe", "Martín", "Andrés", "Rodrigo", "Gonzalo", "Fernando", "Ricardo", "Eduardo", "Javier", "Mauricio",
  "Sergio", "Raúl", "Óscar", "Hugo", "Iván", "Álvaro", "Ignacio", "Agustín", "Bruno", "Thiago", "Facundo", "Franco", "Lautaro",
  "Emilio", "Julián", "Maximiliano", "Rafael", "Esteban", "Cristian", "Pablo", "Manuel", "Miguel", "Ángel", "Carlos", "Luis", "José",
  "Jorge", "Alberto", "Héctor", "Ramiro", "Rolando", "Marcelo", "Gustavo", "Wilmer", "Edwin", "Freddy", "Wilson", "Renzo", "Piero",
  "Gael", "Leonel", "Elías", "Isaac", "Ismael", "Josué", "Saúl", "Alan", "Erick", "Jairo", "Fabián", "Patricio", "Vicente", "Benicio",
  "Cristóbal", "Amaru", "Inti", "Nahuel", "Cuauhtémoc", "Octavio", "Germán", "Rubén", "Ernesto", "Armando", "Gerardo", "Alfredo",
  "Arturo", "Ulises", "Valentín", "Dante", "Ezequiel", "Damián", "Simón", "Lisandro", "Mariano", "Horacio", "Bautista", "Axel",
  "Ariel", "Abel", "Efraín", "Moisés", "Noé", "Rigoberto", "Walter", "Emanuel", "Joel", "Omar", "Tadeo", "Lorenzo", "Salvador",
  "Guillermo", "Camilo", "Ronald", "Grover", "Hernán",
]

/** FNV-1a de 32 bits: la semilla de cada departamento sale de su id. */
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: azar con semilla, igual en el servidor, en el navegador y en las pruebas. */
function azar(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function barajar<X>(lista: readonly X[], r: () => number): X[] {
  const a = lista.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const agentesCache = new Map<string, Agente[]>()

/**
 * Los 100 puestos de un departamento: siempre los mismos nombres y roles (la
 * semilla es el id del depto.), sin nombres repetidos dentro del depto. Los
 * roles van en bloques seguidos, así cada especialidad se sienta junta en la
 * grilla. Departamento desconocido → lista vacía.
 */
export function agentesDe(depId: string): Agente[] {
  let agentes = agentesCache.get(depId)
  if (!agentes) {
    const dep = DEPARTAMENTO[depId]
    if (!dep) return []
    const r = azar(hash32(`casa-blanca:${depId}`))
    const mitad = PUESTOS_POR_DEPARTAMENTO / 2
    const nombres = barajar(
      [...barajar(NOMBRES_F, r).slice(0, mitad), ...barajar(NOMBRES_M, r).slice(0, PUESTOS_POR_DEPARTAMENTO - mitad)],
      r,
    )
    agentes = nombres.map((nombre, puesto) => ({
      id: `${depId}-${puesto}`,
      departamentoId: depId,
      puesto,
      nombre,
      rol: dep.roles[Math.floor((puesto * dep.roles.length) / PUESTOS_POR_DEPARTAMENTO)],
    }))
    agentesCache.set(depId, agentes)
  }
  // Copia: quien ordene o filtre la lista no cambia la de los demás.
  return agentes.slice()
}

// ── Progreso ──────────────────────────────────────────────────

/**
 * Cuánto avanzó un objetivo, siempre con datos reales:
 *  - "mercedes": lo recaudado de la meta del auto (el contador del reto). Si el
 *    servidor trae un monto más nuevo de la base, se puede pasar en
 *    `recaudado`; si no es un monto válido del reto, se usa RECAUDADO.
 *  - Los demás: tareas entregadas de las tareas totales de los departamentos
 *    que trabajan en él. Cada tarea cuenta una vez aunque se repita.
 * `valor` y `meta` van crudos (no en porcentaje): la interfaz divide.
 */
export function progresoObjetivo(
  objetivoId: string,
  entregables: Entregable[],
  recaudado?: number,
): { valor: number; meta: number; texto: string } {
  const obj = OBJETIVO[objetivoId]
  if (!obj) return { valor: 0, meta: 0, texto: "Objetivo desconocido" }
  if (obj.metrica === "recaudado") {
    const valido = typeof recaudado === "number" && Number.isFinite(recaudado) && recaudado >= 0 && recaudado <= CHALLENGE_TARGET
    const valor = valido ? recaudado : RECAUDADO
    return { valor, meta: CHALLENGE_TARGET, texto: `$${miles(valor)} de $${miles(CHALLENGE_TARGET)}` }
  }
  let valor = 0
  let meta = 0
  for (const depId of obj.departamentos) {
    const tareas = tareasDe(depId, objetivoId)
    const listas = hechas(depId, objetivoId, entregables)
    meta += tareas.length
    valor += tareas.filter((t) => listas.has(t.titulo)).length
  }
  return { valor, meta, texto: `${miles(valor)} de ${miles(meta)} tareas entregadas` }
}

// ── El brief para la IA ───────────────────────────────────────

// Las formas prohibidas van escritas: decirle "no uses voseo" sin mostrárselas
// funciona mucho peor (igual que en app/api/branding).
const REGLA_IDIOMA =
  'Español neutro de Latinoamérica. NUNCA voseo: va "pon, deja, mira, tienes, puedes, eres, aquí, tú"; nunca "poné, dejá, mirá, tenés, podés, sos, acá, vos".' // sin-voseo:ejemplos

const PORCENTAJE = ((RECAUDADO / CHALLENGE_TARGET) * 100).toFixed(1).replace(".", ",")

/**
 * El contexto que recibe la IA en cada pedido (chat, conversaciones, consejo,
 * noticias y trabajo de los departamentos). Es público: nada de números
 * internos de PRIME ni de clientes. Las fechas y el monto salen de
 * lib/contador.ts, no se escriben a mano.
 */
export const BRIEF_PUBLICO = `LA CASA BLANCA PROJECT
Una réplica 3D de la Casa Blanca en kevproject.world/casa-blanca. Ahí viven 22 líderes (figuras históricas y actuales, en una ficción declarada) y dos IA, Claude y ChatGPT. Cada líder dirige un departamento de 100 agentes de IA que trabajan para tres objetivos reales de Kev.

QUIÉN ES KEV
Kev López (Benjamín Kevin López Mamani), 21 años, de Santa Cruz de la Sierra, Bolivia. Fundador de PRIME. Construye en público: lo que gana, lo que gasta y lo que falla. Su marca es "todo real, sin humo".

EL RETO: KEV PROJECT GTA
De $10 a un Mercedes Mansory (meta: $${miles(CHALLENGE_TARGET)}), en público, desde Bolivia, pagado solo con ingresos reales de PRIME. El auto es la carnada; el imperio es la meta.
- Día 1: ${fechaLarga(CHALLENGE_LAUNCH)}.
- Ritmo récord: ${fechaLarga(CHALLENGE_RECORD_DEADLINE)}.
- Límite: ${fechaLarga(CHALLENGE_DEADLINE)}.
- Recaudado: $${miles(RECAUDADO)} de $${miles(CHALLENGE_TARGET)} (${PORCENTAJE} %). Es el único número del reto y sale del contador de la web.

QUÉ ES PRIME
- Empleados de IA para empresas: agentes que atienden, venden y hacen seguimiento como un empleado más.
- Hoy lo que más vende es un Empleado AI que atiende y vende por WhatsApp. WhatsApp es un canal, no la identidad: PRIME no es "IA para WhatsApp".
- Es una startup de software (SaaS) que escala: un solo producto que sirve a muchas empresas a la vez y se vende muchas veces. No es una agencia que cobra por horas.
- Nació en Bolivia; el mercado es el mundo.
- Hacia adelante: del empleado de IA al cerebro de la empresa, la economía de agente a agente y la robótica empresarial.

LOS TRES OBJETIVOS
${OBJETIVOS.map((o, i) => `${i + 1}. ${o.titulo}: ${o.descripcion}`).join("\n")}

EL MANUAL DE KEV (las reglas con las que opera PRIME)
1. La competencia es para perdedores: PRIME no pelea por un lugar; busca ser el número uno en la categoría que creó.
2. Primeros principios y lo simple: se construye desde cómo funciona cada cosa. Lo más simple, con estructura y producción, muchas veces gana.
3. Se cobra lo justo y se suman empresas: la meta es siempre más empresas, porque más empresas cambian la percepción y la valuación.
4. La marca lo es todo: PRIME no es una empresa de IA del montón; es el futuro del 2030 vivo en 2026.
5. Todo hoy, rápido: con atención, constancia y perspicacia. Rápido no es sin revisar.
6. Ganar antes de pelear: pensar y planear antes de ejecutar; no se va a la guerra con un arma del 2010.
7. Vista al 2030 y al 2040: no limitarse por la realidad de hoy.
Para hablar de liderazgo se dice "el número uno" o "la categoría que PRIME creó". Nunca se habla de controlar un mercado ni de dejar afuera a otros.

LO QUE NO SE PUEDE HACER
- Inventar cifras: ingresos, clientes, usuarios, seguidores, inversiones, valuaciones ni porcentajes. El único número del reto es el recaudado de arriba. Si falta un dato, se escribe [DATO] para que Kev lo complete.
- Inventar precios de PRIME: los fija Kev. Si una pieza necesita uno, va [PRECIO].
- Nombrar clientes de PRIME o dar datos de una empresa cliente. Se habla de "una tienda" o "una clínica", nunca de una marca concreta.
- Prometer resultados sin prueba ("vas a vender el doble"). Lo que se afirma se tiene que poder mostrar.
- Decir que PRIME ya está en Silicon Valley, que tiene inversionistas o que levantó capital: son objetivos, no hechos.
- Inventar hechos, citas o escándalos de personas reales. Los personajes vivos son ficción declarada.
- Sobre fondos, aceleradoras, leyes, eventos y fechas: solo lo que se sabe con seguridad, y se marca "verificar" lo que pudo cambiar.

CÓMO SE ESCRIBE
- ${REGLA_IDIOMA}
- Corto y concreto: una idea por bloque, sin preámbulos ni superlativos vacíos.
- PRIME se escribe así, en mayúsculas (en la web se cambia por su logo).
- El auto se nombra "un Mercedes Mansory".
- Un entregable sirve hoy: listo para usar, copiar o grabar; no un consejo general.`
