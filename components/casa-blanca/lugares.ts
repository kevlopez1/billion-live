// ──────────────────────────────────────────────────────────────
// EL MAPA DE LA CASA BLANCA VIVA
//
// Una sola fuente para dónde está cada cosa. La escena 3D construye la
// geometría en ESTAS coordenadas y la simulación camina por ESTE grafo: si
// algo se mueve, se mueve aquí y los dos lo ven igual.
//
// Superficie: medidas reales aproximadas (la Residencia mide 51,2 m de frente
// por 26 m de fondo; 168 x 85,5 pies). Subsuelo: ficción, bajo el Jardín Sur.
// Ver ejes y unidades en tipos.ts.
// ──────────────────────────────────────────────────────────────

import { ALTURA_NIVEL, type Arista, type Grafo, type Lugar, type NivelId, type NodoGrafo } from "./tipos"

// ── Huellas de los edificios (para la escena y para no caminar a través) ──
export const HUELLAS = {
  residencia: { x0: -25.6, x1: 25.6, z0: -13, z1: 13, alto: 21.3 },
  porticoNorte: { x0: -10.5, x1: 10.5, z0: -22, z1: -13 },
  /** Pórtico Sur: semicírculo de radio 9,5 m con centro en (0, 13). */
  porticoSur: { cx: 0, cz: 13, radio: 9.5 },
  alaOeste: { x0: -80, x1: -50, z0: -15, z1: 18, alto: 10 },
  /** Despacho Oval: óvalo de 10,9 x 8,8 m en la esquina sureste del Ala Oeste. */
  despachoOval: { cx: -52, cz: 15, rx: 5.45, rz: 4.4 },
  columnataOeste: { x0: -50, x1: -25.6, z0: 3, z1: 8 },
  /** Donde estaba el Ala Este (demolida en oct. 2025): obra del salón de baile. */
  obra: { x0: 32, x1: 80, z0: -15, z1: 25 },
  eeob: { x0: -160, x1: -100, z0: -60, z1: 60, alto: 26 },
  tesoro: { x0: 100, x1: 150, z0: -70, z1: 60, alto: 20 },
  /** La reja rodea el predio: 18 acres (7,3 ha). */
  reja: { x0: -95, x1: 95, z0: -70, z1: 162 },
  monumento: { x: 80, z: 1000, alto: 169.3 },
  fuenteNorte: { x: 0, z: -50, radio: 7 },
  fuenteSur: { x: 0, z: 86, radio: 9 },
  /** Huella del subsuelo (los tres niveles). */
  subsuelo: { x0: -90, x1: 90, z0: 18, z1: 142 },
  /**
   * La instalación subterránea: 74 x 102 m (con sus muros) y el piso en
   * y = -60, debajo de la huella del subsuelo. Salas de techo bajo alrededor
   * de un pozo de 20 x 32 m que sube hasta y = -28 (bajo el Subsuelo 3).
   */
  ciudad: { x0: -37, x1: 37, z0: 11, z1: 113, piso: -60, boveda: -28 },
} as const

// ── Grilla del subsuelo: 4 columnas x 3 filas de celdas de 40 x 34 m ──
export const SUB_COLUMNAS = [-66, -22, 22, 66] as const
export const SUB_FILAS = [46, 84, 122] as const
export const SUB_MEDIO_ANCHO = 20
export const SUB_MEDIO_FONDO = 17
/** Pasillos: filas en z = 27, 65, 103; columnas en x = -44, 0, 44. */
const PASILLO_Z = [27, 65, 103]
const PASILLO_X_TODOS = [-66, -44, -22, 0, 22, 44, 66]
const PASILLO_X_VERTICAL = [-44, 0, 44]

/**
 * Qué hay en cada celda del subsuelo. Los departamentos usan el id de su
 * líder: el departamento de Hormozi es "hormozi" y su lugar es "dep-hormozi".
 */
export const CELDAS: Record<"n1" | "n2" | "n3", string[][]> = {
  n1: [
    ["dep-hormozi", "dep-trump", "dep-musk", "dep-altman"],
    ["dep-gadzhi", "dep-thiel", "dep-amodei", "dep-pichai"],
    ["dep-tate", "dep-jobs", "dep-karp", "cafeteria"],
  ],
  n2: [
    ["dep-suntzu", "dep-napoleon", "sala-guerra", "dep-marco"],
    ["dep-jesus", "dep-socrates", "dep-lincoln", "dep-cleopatra"],
    ["dep-leonardo", "dep-kobe", "dep-mason", "dep-iluminado"],
  ],
  n3: [
    ["gimnasio", "basquet-int", "padel-int", "ring"],
    ["biblioteca", "parque-int", "piscina-int", "cine"],
    ["capilla", "estudio", "ajedrez", "taller-inventos"],
  ],
}

/** Los 22 departamentos: id = id del líder. Nombre corto para carteles. */
export const DEPARTAMENTOS_BASE: Array<{ id: string; nombre: string; nivel: NivelId; lugarId: string }> = [
  { id: "trump", nombre: "Presidencia y Negociación" },
  { id: "suntzu", nombre: "Estrategia" },
  { id: "thiel", nombre: "Capital y Silicon Valley" },
  { id: "altman", nombre: "Inteligencia Artificial" },
  { id: "musk", nombre: "Ingeniería" },
  { id: "hormozi", nombre: "Ofertas y Ventas" },
  { id: "amodei", nombre: "IA Segura" },
  { id: "pichai", nombre: "Distribución y Búsqueda" },
  { id: "mason", nombre: "Red de Contactos" },
  { id: "iluminado", nombre: "Visión 2040" },
  { id: "jesus", nombre: "Clientes y Servicio" },
  { id: "karp", nombre: "Datos e Inteligencia" },
  { id: "marco", nombre: "Finanzas y Disciplina" },
  { id: "napoleon", nombre: "Operaciones y Expansión" },
  { id: "tate", nombre: "Redes y Viralidad" },
  { id: "gadzhi", nombre: "Agencia y Contenido" },
  { id: "kobe", nombre: "Alto Rendimiento" },
  { id: "socrates", nombre: "Calidad y Crítica" },
  { id: "cleopatra", nombre: "Alianzas Internacionales" },
  { id: "leonardo", nombre: "Investigación e Inventos" },
  { id: "lincoln", nombre: "Legal e Instituciones" },
  { id: "jobs", nombre: "Producto y Marca" },
].map((d) => {
  const lugarId = `dep-${d.id}`
  const nivel = (["n1", "n2"] as const).find((n) => CELDAS[n].some((fila) => fila.includes(lugarId)))!
  return { ...d, nivel, lugarId }
})

// ── Nodos ─────────────────────────────────────────────────────
const nodos: NodoGrafo[] = []
const aristas: Arista[] = []
const N = (id: string, x: number, y: number, z: number, nivel: NivelId = "superficie", oculto = false) =>
  nodos.push({ id, p: { x, y, z }, nivel, ...(oculto ? { oculto: true } : {}) })
const E = (a: string, b: string, op?: { ascensor?: boolean; interior?: boolean }) =>
  aristas.push(op ? [a, b, op] : [a, b])

// Residencia
N("portico-sur", 0, 0, 25)
N("puerta-res-sur", 0, 0, 14)
N("res-int", 0, 0, 4, "superficie", true)
N("portico-norte", 0, 0, -25)
N("puerta-res-norte", 0, 0, -14.5)
N("balcon", 0, 8.6, 19)
N("asc-sup", 0, 0, 8, "superficie", true)
E("portico-sur", "puerta-res-sur")
E("puerta-res-sur", "res-int", { interior: true })
E("portico-norte", "puerta-res-norte")
E("puerta-res-norte", "res-int", { interior: true })
E("res-int", "balcon", { interior: true })
E("res-int", "asc-sup", { interior: true })

// Columnata Oeste, Jardín de las Rosas y Ala Oeste
N("col-e", -28, 0, 5.5)
N("col-o", -48, 0, 5.5)
N("rosas", -38, 0, 16)
N("puerta-oeste", -62, 0, 20)
N("oeste-int", -65, 0, 3, "superficie", true)
N("oeste-s", -62, 0, 28)
E("col-e", "res-int", { interior: true })
E("col-o", "oeste-int", { interior: true })
E("col-e", "col-o")
E("col-e", "rosas")
E("col-o", "rosas")
E("puerta-oeste", "oeste-int", { interior: true })
E("puerta-oeste", "oeste-s")

// Jardín Sur
N("sur-1", 0, 0, 42)
N("sur-2", 0, 0, 64)
N("fuente-sur-o", -14, 0, 86)
N("sur-3", 0, 0, 110)
N("sur-4", 0, 0, 145)
N("so-1", -35, 0, 30)
N("so-2", -48, 0, 56)
N("so-3", -50, 0, 92)
N("so-4", -40, 0, 142)
N("se-1", 35, 0, 36)
N("se-2", 48, 0, 56)
N("se-3", 52, 0, 92)
N("se-4", 40, 0, 142)
E("portico-sur", "sur-1")
E("sur-1", "sur-2")
E("sur-2", "fuente-sur-o")
E("fuente-sur-o", "sur-3")
E("sur-3", "sur-4")
E("portico-sur", "so-1")
E("portico-sur", "se-1")
E("so-1", "rosas")
E("so-1", "oeste-s")
E("so-1", "so-2")
E("so-2", "so-3")
E("so-3", "so-4")
E("so-4", "sur-4")
E("se-1", "se-2")
E("se-2", "se-3")
E("se-3", "se-4")
E("se-4", "sur-4")
E("sur-2", "so-2")
E("sur-2", "se-2")
E("sur-3", "so-3")
E("sur-3", "se-3")

// Deporte y ocio en la superficie
N("piscina", -70, 0, 43)
N("golf", -38, 0, 47)
N("tenis", -48, 0, 70)
N("padel", -54, 0, 105)
N("basquet", -35, 0, 113)
N("gim-aire", 55, 0, 109)
N("parque", 44, 0, 70)
N("obra", 40, 0, 30)
E("oeste-s", "piscina")
E("so-2", "piscina")
E("so-1", "golf")
E("so-2", "golf")
E("so-2", "tenis")
E("so-3", "tenis")
E("so-3", "padel")
E("so-4", "padel")
E("so-4", "basquet")
E("sur-3", "basquet")
E("se-3", "gim-aire")
E("se-4", "gim-aire")
E("se-2", "parque")
E("se-3", "parque")
E("se-1", "obra")

// Calles y edificios vecinos
N("calle-oeste-s", -92, 0, 24)
N("calle-oeste-n", -92, 0, -35)
N("puerta-eeob", -99, 0, 0)
N("eeob-int", -130, 0, 0, "superficie", true)
N("calle-este-s", 92, 0, 32)
N("calle-este-n", 92, 0, -35)
N("puerta-tesoro", 99, 0, 0)
N("tesoro-int", 125, 0, 0, "superficie", true)
E("oeste-s", "calle-oeste-s")
E("calle-oeste-s", "calle-oeste-n")
E("calle-oeste-s", "puerta-eeob")
E("calle-oeste-n", "puerta-eeob")
E("puerta-eeob", "eeob-int", { interior: true })
E("calle-este-s", "calle-este-n")
E("calle-este-s", "puerta-tesoro")
E("calle-este-n", "puerta-tesoro")
E("puerta-tesoro", "tesoro-int", { interior: true })
E("calle-este-s", "se-2")

// Jardín Norte, Pennsylvania Avenue y el Parque Lafayette
N("norte-1", 0, 0, -36)
N("no-1", -40, 0, -40)
N("ne-1", 40, 0, -40)
N("fuente-norte-o", -14, 0, -52)
N("penn-c", 0, 0, -78)
N("penn-o", -60, 0, -78)
N("penn-e", 60, 0, -78)
N("lafayette", 0, 0, -120)
E("portico-norte", "norte-1")
E("norte-1", "no-1")
E("norte-1", "ne-1")
E("no-1", "calle-oeste-n")
E("ne-1", "calle-este-n")
E("norte-1", "fuente-norte-o")
E("fuente-norte-o", "penn-c")
E("penn-c", "penn-o")
E("penn-c", "penn-e")
E("penn-c", "lafayette")

// ── Subsuelo: tres niveles iguales, unidos por el núcleo de ascensores ──
const SUBNIVELES = ["n1", "n2", "n3"] as const
for (const nv of SUBNIVELES) {
  const y = ALTURA_NIVEL[nv]
  N(`${nv}-asc`, 0, y, 22, nv)
  PASILLO_Z.forEach((z, r) => {
    PASILLO_X_TODOS.forEach((x, i) => {
      N(`${nv}-f${r}-${i}`, x, y, z, nv)
      if (i > 0) E(`${nv}-f${r}-${i - 1}`, `${nv}-f${r}-${i}`)
    })
  })
  for (const x of PASILLO_X_VERTICAL) {
    const i = PASILLO_X_TODOS.indexOf(x)
    for (let r = 1; r < PASILLO_Z.length; r++) E(`${nv}-f${r - 1}-${i}`, `${nv}-f${r}-${i}`)
  }
  E(`${nv}-asc`, `${nv}-f0-${PASILLO_X_TODOS.indexOf(0)}`)
  CELDAS[nv].forEach((fila, r) =>
    fila.forEach((lugarId, c) => {
      const cx = SUB_COLUMNAS[c]
      const cz = SUB_FILAS[r]
      N(`acc-${lugarId}`, cx, y, cz - 12, nv)
      E(`acc-${lugarId}`, `${nv}-f${r}-${PASILLO_X_TODOS.indexOf(cx)}`)
    }),
  )
}
E("asc-sup", "n1-asc", { ascensor: true })
E("n1-asc", "n2-asc", { ascensor: true })
E("n2-asc", "n3-asc", { ascensor: true })

// ── Instalación subterránea (ficción): el ascensor sigue bajando hasta y = -60 ──
// Cada arista es una línea recta por piso libre: cruza las paredes por sus puertas.
const C = ALTURA_NIVEL.ciudad
const NC = (id: string, x: number, z: number) => N(id, x, C, z, "ciudad")
NC("ciudad-asc", 0, 22)
NC("c-mirador", 0, 16.5)
NC("c-plaza", 0, 34)
NC("c-estacion", -20, 30)
NC("c-club", 16, 28)
NC("c-av-1", 0, 56)
NC("c-av-2", 0, 74)
NC("c-av-3", 0, 90)
NC("c-torres-n", -10, 56)
NC("c-torres-s", -10, 84)
NC("c-mercado", 14, 58)
NC("c-parque", 10, 81)
NC("c-arena", 0, 103)
E("n3-asc", "ciudad-asc", { ascensor: true })
E("ciudad-asc", "c-plaza")
E("ciudad-asc", "c-mirador")
E("c-plaza", "c-estacion")
E("c-plaza", "c-club")
E("c-plaza", "c-av-1")
E("c-av-1", "c-av-2")
E("c-av-2", "c-av-3")
E("c-av-1", "c-torres-n")
E("c-av-1", "c-mercado")
E("c-av-2", "c-parque")
E("c-av-3", "c-torres-s")
E("c-torres-n", "c-torres-s")
E("c-mercado", "c-parque")
E("c-av-3", "c-arena")

export const GRAFO: Grafo = { nodos, aristas }

// ── Lugares ───────────────────────────────────────────────────
const S = ALTURA_NIVEL.superficie
const L = (l: Omit<Lugar, "y"> & { y?: number }): Lugar => ({ y: S, ...l })

/** Dentro de un edificio: el rectángulo es el del edificio, el personaje no se ve. */
const dentro = (id: string, nombre: string, acceso: string, dato: string, rect: [number, number, number, number]): Lugar =>
  L({ id, nombre, nivel: "superficie", tipo: "interior", x0: rect[0], x1: rect[1], z0: rect[2], z1: rect[3], acceso, interior: true, dato })

const R = HUELLAS.residencia
const RES: [number, number, number, number] = [R.x0, R.x1, R.z0, R.z1]
const W = HUELLAS.alaOeste
const ALA: [number, number, number, number] = [W.x0, W.x1, W.z0, W.z1]

const SUPERFICIE: Lugar[] = [
  // Residencia (interiores reales)
  dentro("despacho-oval", "Despacho Oval", "oeste-int", "El actual está en la esquina sureste del Ala Oeste desde 1934; el primero lo estrenó Taft en 1909. El escritorio Resolute está hecho con madera de un barco británico.", ALA),
  dentro("sala-gabinete", "Sala del Gabinete", "oeste-int", "Aquí el presidente se reúne con sus secretarios. Da al Jardín de las Rosas.", ALA),
  dentro("sala-roosevelt", "Sala Roosevelt", "oeste-int", "Lleva el nombre de los dos Roosevelt: Theodore construyó el Ala Oeste en 1902 y Franklin la amplió.", ALA),
  dentro("sala-prensa", "Sala de Prensa", "oeste-int", "La Sala de Prensa James S. Brady está construida sobre la piscina que Franklin D. Roosevelt mandó instalar en 1933.", ALA),
  dentro("sala-crisis", "Sala de Crisis", "oeste-int", "Kennedy la creó en 1961, en el sótano del Ala Oeste, después del fracaso de Bahía de Cochinos.", ALA),
  dentro("salon-este", "Salón Este", "res-int", "El salón más grande de la casa. Abigail Adams colgaba aquí la ropa a secar; Lincoln fue velado aquí en 1865.", RES),
  dentro("salon-azul", "Salón Azul", "res-int", "Es ovalado. Grover Cleveland se casó aquí en 1886, el único presidente casado en la Casa Blanca.", RES),
  dentro("salon-rojo", "Salón Rojo", "res-int", "Rutherford B. Hayes juró aquí en secreto en 1877, antes de la ceremonia pública.", RES),
  dentro("salon-verde", "Salón Verde", "res-int", "Thomas Jefferson lo usaba como comedor.", RES),
  dentro("comedor-estado", "Comedor de Estado", "res-int", "Cenas de gala para unos 140 invitados. En su chimenea está tallada la oración de John Adams por esta casa.", RES),
  dentro("dormitorio-lincoln", "Dormitorio Lincoln", "res-int", "Lincoln lo usó como oficina, no como dormitorio. Guarda una copia manuscrita del Discurso de Gettysburg.", RES),
  dentro("sala-oval-amarilla", "Sala Oval Amarilla", "res-int", "Está justo encima del Salón Azul y da al Balcón Truman.", RES),
  dentro("cocina", "Cocina", "res-int", "Puede servir una cena para 140 invitados o bocaditos para más de 1.000.", RES),
  dentro("recepcion-diplomatica", "Recepción Diplomática", "res-int", "Sala ovalada. Franklin D. Roosevelt dio desde aquí sus charlas por radio.", RES),
  dentro("sala-mapas", "Sala de Mapas", "res-int", "Franklin D. Roosevelt siguió desde aquí la Segunda Guerra Mundial.", RES),
  dentro("solario", "Solario", "res-int", "Sala de vidrio en el tercer piso, sobre el Pórtico Sur.", RES),
  dentro("habitaciones", "Habitaciones", "res-int", "La residencia tiene 132 habitaciones y 35 baños en seis niveles.", RES),
  dentro("eeob", "Edificio Eisenhower", "eeob-int", "Oficinas del personal de la Casa Blanca y del vicepresidente, terminado en 1888.", [HUELLAS.eeob.x0, HUELLAS.eeob.x1, HUELLAS.eeob.z0, HUELLAS.eeob.z1]),
  dentro("tesoro", "Departamento del Tesoro", "tesoro-int", "Es el edificio que aparece en el reverso del billete de 10 dólares.", [HUELLAS.tesoro.x0, HUELLAS.tesoro.x1, HUELLAS.tesoro.z0, HUELLAS.tesoro.z1]),

  // Exteriores (se ven)
  L({ id: "balcon-truman", nombre: "Balcón Truman", nivel: "superficie", tipo: "edificio", x0: -5, x1: 5, z0: 17, z1: 21, y: 8.6, acceso: "balcon", dato: "Truman lo agregó al Pórtico Sur en 1948, en medio de críticas." }),
  L({ id: "jardin-sur", nombre: "Jardín Sur", nivel: "superficie", tipo: "jardin", x0: -30, x1: 30, z0: 32, z1: 150, acceso: "sur-2", dato: "Aquí aterriza el Marine One y se recibe a los jefes de Estado. La carrera de huevos de Pascua se hace aquí desde 1878." }),
  L({ id: "jardin-norte", nombre: "Jardín Norte", nivel: "superficie", tipo: "jardin", x0: -50, x1: 50, z0: -68, z1: -28, acceso: "norte-1", dato: "La cara que se ve desde Pennsylvania Avenue. Por el Pórtico Norte entran los invitados oficiales." }),
  L({ id: "rosas", nombre: "Jardín de las Rosas", nivel: "superficie", tipo: "jardin", x0: -48, x1: -29, z0: 9, z1: 25, acceso: "rosas", dato: "Creado en 1913, rediseñado en 1962 y pavimentado en 2025." }),
  L({ id: "columnata", nombre: "Columnata Oeste", nivel: "superficie", tipo: "edificio", x0: -50, x1: -26, z0: 3, z1: 8, acceso: "col-o", dato: "El pasillo techado entre la Residencia y el Ala Oeste. Desde septiembre de 2025 tiene el Paseo de la Fama presidencial." }),
  L({ id: "piscina", nombre: "Piscina", nivel: "superficie", tipo: "ocio", x0: -80, x1: -64, z0: 27, z1: 37, acceso: "piscina", dato: "Piscina exterior que Gerald Ford mandó construir en 1975." }),
  L({ id: "golf", nombre: "Green de golf", nivel: "superficie", tipo: "deporte", x0: -45, x1: -31, z0: 34, z1: 46, acceso: "golf", dato: "Eisenhower hizo instalar un green de práctica cerca del Despacho Oval en 1954." }),
  L({ id: "cancha-tenis", nombre: "Cancha de tenis y básquet", nivel: "superficie", tipo: "deporte", x0: -88, x1: -52, z0: 61, z1: 79, acceso: "tenis", dato: "La cancha de tenis del Jardín Sur. En 2009 Obama le agregó aros de básquet." }),
  L({ id: "cancha-padel", nombre: "Cancha de pádel", nivel: "superficie", tipo: "deporte", x0: -81, x1: -59, z0: 99, z1: 111, acceso: "padel", dato: "Ficción: no existe en la Casa Blanca real.", ficcion: true }),
  L({ id: "cancha-basquet", nombre: "Cancha de básquet", nivel: "superficie", tipo: "deporte", x0: -50, x1: -20, z0: 117, z1: 133, acceso: "basquet", dato: "Ficción: una cancha completa al aire libre, de 28 x 15 m.", ficcion: true }),
  L({ id: "gimnasio-aire", nombre: "Gimnasio al aire libre", nivel: "superficie", tipo: "deporte", x0: 45, x1: 65, z0: 112, z1: 128, acceso: "gim-aire", dato: "Ficción: barras, bancos y pesas junto al jardín.", ficcion: true }),
  L({ id: "parque", nombre: "Parque", nivel: "superficie", tipo: "jardin", x0: 45, x1: 78, z0: 55, z1: 85, acceso: "parque", dato: "Ficción: un parque con bancos y árboles en el lado este del Jardín Sur.", ficcion: true }),
  L({ id: "obra", nombre: "Obra del salón de baile", nivel: "superficie", tipo: "obra", x0: 32, x1: 80, z0: -15, z1: 25, acceso: "obra", dato: "El Ala Este se demolió en octubre de 2025 para construir un salón de baile de unos 8.360 m², con apertura prevista para 2028. La obra sigue mientras continúa el juicio." }),
  L({ id: "lafayette", nombre: "Parque Lafayette", nivel: "superficie", tipo: "jardin", x0: -55, x1: 55, z0: -165, z1: -90, acceso: "lafayette", dato: "Plaza pública frente al Pórtico Norte, con la estatua ecuestre de Andrew Jackson en el centro." }),
]

const NOMBRES_SUB: Record<string, [string, string]> = {
  cafeteria: ["Cafetería", "Ficción: el café de los agentes. Abierto las 24 horas."],
  "sala-guerra": ["Sala de guerra", "Ficción: mesa redonda y pantallas. Aquí se reúne el consejo."],
  gimnasio: ["Gimnasio", "Ficción: pesas, máquinas y un piso de caucho."],
  "basquet-int": ["Cancha de básquet", "Ficción: cancha techada de 28 x 15 m."],
  "padel-int": ["Pádel", "Ficción: dos pistas de pádel techadas."],
  ring: ["Ring", "Ficción: ring de boxeo y kickboxing."],
  biblioteca: ["Biblioteca", "Ficción: dos pisos de estantes y mesas largas."],
  "parque-int": ["Parque interior", "Ficción: árboles bajo un tragaluz de vidrio."],
  "piscina-int": ["Piscina techada", "Ficción: piscina de 25 m."],
  cine: ["Cine", "Ficción: sala de proyección de 40 butacas."],
  capilla: ["Capilla", "Ficción: un espacio en silencio para orar o meditar."],
  estudio: ["Estudio de grabación", "Ficción: luces, cámaras y micrófonos para grabar contenido."],
  ajedrez: ["Sala de juegos", "Ficción: tableros de ajedrez, billar y cartas."],
  "taller-inventos": ["Taller de inventos", "Ficción: mesas de trabajo, prototipos y una impresora 3D."],
}

const SUBSUELO: Lugar[] = SUBNIVELES.flatMap((nv) =>
  CELDAS[nv].flatMap((fila, r) =>
    fila.map((lugarId, c): Lugar => {
      const cx = SUB_COLUMNAS[c]
      const cz = SUB_FILAS[r]
      const dep = DEPARTAMENTOS_BASE.find((d) => d.lugarId === lugarId)
      const [nombre, dato] = dep
        ? [`Departamento de ${dep.nombre}`, "Ficción: 100 puestos de agentes de IA."]
        : NOMBRES_SUB[lugarId]
      return {
        id: lugarId,
        nombre,
        nivel: nv,
        tipo: dep ? "departamento" : lugarId === "cafeteria" || lugarId === "sala-guerra" ? "servicio" : nv === "n3" ? "ocio" : "servicio",
        x0: cx - SUB_MEDIO_ANCHO,
        x1: cx + SUB_MEDIO_ANCHO,
        z0: cz - SUB_MEDIO_FONDO,
        z1: cz + SUB_MEDIO_FONDO,
        y: ALTURA_NIVEL[nv],
        acceso: `acc-${lugarId}`,
        dato,
        ficcion: true,
      }
    }),
  ),
)

const lc = (id: string, nombre: string, tipo: Lugar["tipo"], rect: [number, number, number, number], acceso: string, dato: string): Lugar => ({
  id, nombre, nivel: "ciudad", tipo, x0: rect[0], x1: rect[1], z0: rect[2], z1: rect[3], y: ALTURA_NIVEL.ciudad, acceso, dato, ficcion: true,
})
const CIUDAD: Lugar[] = [
  lc("ciudad-plaza", "Atrio del Pozo", "edificio", [-9, 9, 25, 43], "c-plaza", "Ficción: el fondo de un pozo de 32 m, con el ascensor de vidrio."),
  lc("ciudad-mirador", "Balcón del Pozo", "jardin", [-9, 9, 13, 20], "c-mirador", "Ficción: un piso de vidrio sobre el pozo, que sigue 12 m más abajo."),
  lc("ciudad-estacion", "Andén del Tren", "servicio", [-27, -13, 14, 43], "c-estacion", "Ficción: el tren que une la instalación con la Casa Blanca."),
  lc("ciudad-club", "Sala de Control", "edificio", [13, 20, 14, 39], "c-club", "Ficción: la sala que vigila la instalación, con el contador real del reto."),
  lc("ciudad-avenida", "Corredor Central", "servicio", [-3, 3, 46, 96], "c-av-2", "Ficción: el pasillo principal, con control de acceso por escaneo."),
  lc("ciudad-torres", "Laboratorios", "edificio", [-12.5, -6.5, 48, 92], "c-torres-n", "Ficción: laboratorios de vidrio donde se prueban los agentes de IA."),
  lc("ciudad-mercado", "Comedor", "ocio", [6.5, 15.5, 48, 67], "c-mercado", "Ficción: el comedor, abierto las 24 horas."),
  lc("ciudad-parque", "Jardín Hidropónico", "jardin", [6, 13, 70, 92], "c-parque", "Ficción: un huerto bajo luz artificial."),
  lc("ciudad-arena", "Cámara de Pruebas", "deporte", [-13, 13, 98, 111], "c-arena", "Ficción: la sala donde se prueban robots y drones."),
]

export const LUGARES: Lugar[] = [...SUPERFICIE, ...SUBSUELO, ...CIUDAD]
export const LUGAR: Record<string, Lugar> = Object.fromEntries(LUGARES.map((l) => [l.id, l]))
export const NODO: Record<string, NodoGrafo> = Object.fromEntries(nodos.map((n) => [n.id, n]))
