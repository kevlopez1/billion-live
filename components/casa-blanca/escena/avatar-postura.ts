// ──────────────────────────────────────────────────────────────
// Cómo se para, cómo camina y con qué gestos habla cada personaje.
//
// Sale de la descripción física de cada uno (postura_gestos de la ficha
// investigada): Trump con los pies abiertos y el mentón alto, Lincoln
// encorvado y con la mano en la solapa, Jobs con los dedos en "torre",
// Napoleón con la mano en el chaleco, Hormozi que corta el aire…
//
// Todo son números: el animador (avatar-anim.ts) los suma a cada pose sin
// crear objetos por cuadro.
//
// Manos: la muñeca va a un punto (cinemática inversa del brazo). El punto se
// da en un espacio del cuerpo, en metros de una persona de 1,78 m (se escala):
//   x: hacia el lado de esa mano (+ = afuera), desde la línea media
//      (o desde el costado del tronco con ref "lado", o desde la muñeca en
//      reposo con ref "bind");
//   y: desde la altura del hombro (− = abajo);
//   z: desde el frente del tronco a esa altura (+ = adelante); con ref
//      "espalda", desde la espalda hacia atrás.
// ──────────────────────────────────────────────────────────────

export type RefMano = "frente" | "lado" | "espalda" | "bind"

/** Forma de la mano: [curva de los dedos, curva del índice, pulgar] (0 abierta, 1 puño; − = estirada). */
export type Forma = readonly [number, number, number]

export const FORMA = {
  relajada: [0.14, 0.1, 0.1],
  abierta: [-0.1, -0.12, -0.1],
  suave: [0.35, 0.3, 0.25],
  punio: [1.05, 1.05, 0.9],
  senala: [1.05, -0.12, 0.75],
  pinza: [0.85, 0.42, 0.75],
  torre: [-0.05, -0.05, 0.05],
  // Yemas con yemas (la torre de Jobs): los dedos apenas curvos.
  yemas: [0.12, 0.1, 0.05],
  agarra: [0.75, 0.7, 0.6],
} as const satisfies Record<string, Forma>

export interface ManoG {
  /** Muñeca (ver arriba). */
  p: readonly [number, number, number]
  ref?: RefMano
  /** Desplazamiento del golpe (en el pico de cada acento). */
  b?: readonly [number, number, number]
  /** Hacia dónde apunta el codo: [afuera, arriba, adelante]. */
  polo?: readonly [number, number, number]
  forma: Forma
  /** Giro del antebrazo (+ = la palma hacia arriba/adelante). */
  prono?: number
  /** Muñeca: + = la mano se dobla hacia la palma. */
  flex?: number
}

export interface Gesto {
  d?: ManoG
  i?: ManoG
  /** Cabeza durante el gesto: [asentir (+ abajo), girar, ladear]. */
  cab?: readonly [number, number, number]
  /** Pecho: [inclinar adelante, girar, ladear]. */
  torso?: readonly [number, number, number]
  /** Cuánto asiente la cabeza en cada acento. */
  asiente?: number
}

const P_ABAJO = [0.35, -1, -0.15] as const
const P_ATRAS = [0.3, -0.2, -1] as const
const P_AFUERA = [1, -0.4, -0.25] as const

/** Reposos: dónde descansan las manos cuando no gesticulan. */
export const REPOSO = {
  // Colgando junto al muslo, el codo apenas doblado, la palma hacia el muslo.
  sueltas: { p: [0.0, 0.035, 0.03], ref: "bind", polo: P_ATRAS, forma: FORMA.relajada, prono: 0.15 },
  // Un poco separadas del cuerpo (Trump, Hormozi, Tate).
  abiertas: { p: [0.035, 0.045, 0.03], ref: "bind", polo: [0.6, -0.2, -1], forma: FORMA.relajada, prono: 0.1 },
  // Juntas al frente, bajo el ombligo (Altman, Pichai, Cleopatra).
  // (muñecas a 4,5 cm, palmas más hacia arriba y dedos más recogidos: una mano se
  // apoya en la otra; con 3,5 cm los dedos de una atravesaban la palma de la otra)
  juntas: { p: [0.045, -0.46, 0.075], polo: P_ABAJO, forma: [0.45, 0.4, 0.2], prono: 1.15, flex: 0.25 },
  // Juntas más arriba, cerca del pecho (Thiel).
  juntasAltas: { p: [0.04, -0.36, 0.08], polo: P_ABAJO, forma: FORMA.suave, prono: 1.0, flex: 0.3 },
  // Dentro de las mangas, frente al vientre (Sun Tzu, el Iluminado).
  mangas: { p: [0.05, -0.38, 0.12], polo: P_ABAJO, forma: FORMA.suave, prono: 1.25, flex: 0.1 },
  // Atrás, a la altura del cóccix (Napoleón, Leonardo al caminar).
  atras: { p: [0.05, -0.5, 0.05], ref: "espalda", polo: [0.9, -0.2, -0.6], forma: FORMA.suave, prono: -0.6, flex: 0.2 },
  // En el bolsillo del pantalón (Musk, Gadzhi, Tate): la mano entra en la tela.
  bolsillo: { p: [-0.035, -0.5, 0.055], ref: "lado", polo: [0.7, -0.3, -0.7], forma: FORMA.suave, prono: -0.2, flex: 0.1 },
  // Bolsillo bajo una remera que lo tapa (Musk, Gadzhi): la mano entra por el costado
  // del muslo, por debajo del ruedo. (Con el bolsillo de adelante los dedos asomaban
  // bajo el ruedo, como si tuviera las manos dentro de la camiseta.)
  bolsilloRemera: { p: [0.012, -0.58, 0.06], ref: "lado", polo: [0.7, -0.3, -0.7], forma: [0.3, 0.25, -0.3], prono: -0.2, flex: 0.15 },
  // Mano derecha dentro del chaleco (Napoleón, retrato de David).
  // (más arriba y más adentro, la mano plana: los dedos quedan bajo el borde de la
  // casaca y se ven el pulgar y el dorso; antes era un puño apoyado en la cintura)
  chaleco: { p: [0.0, -0.28, -0.05], polo: [0.8, -1, 0], forma: FORMA.suave, prono: 0.0, flex: 0.25 },
  // Mano en la solapa del levitón (Lincoln).
  solapa: { p: [0.08, -0.14, 0.03], polo: P_ABAJO, forma: FORMA.agarra, prono: 1.0, flex: 0.6 },
  // Mano en la cadera, el codo afuera (Cleopatra).
  cadera: { p: [0.035, -0.4, 0.0], ref: "lado", polo: P_AFUERA, forma: FORMA.relajada, prono: -0.4, flex: -0.25 },
  // Dedos en "torre" frente al pecho (Jobs).
  // (palmas enfrentadas —prono 0,45— y muñecas a 8 cm del centro: las yemas se
  // tocan; con 6 cm y la palma hacia el pecho los dedos se entrecruzaban)
  torre: { p: [0.082, -0.16, 0.13], polo: P_ABAJO, forma: FORMA.yemas, prono: 0.45, flex: -0.3 },
  // Sostiene el cuaderno o la tablilla contra el antebrazo (Leonardo, Marco).
  cuaderno: { p: [0.1, -0.42, 0.14], polo: [0.4, -1, -0.3], forma: FORMA.agarra, prono: 0.5, flex: 0.1 },
  // Sostiene el borde del manto sobre el pecho (Sócrates).
  manto: { p: [-0.02, -0.17, 0.04], polo: P_ABAJO, forma: FORMA.agarra, prono: 1.2, flex: 0.5 },
  // El rollo en la mano, frente al vientre (Sun Tzu).
  rollo: { p: [0.09, -0.4, 0.12], polo: P_ABAJO, forma: FORMA.agarra, prono: 0.6, flex: 0.1 },
} as const satisfies Record<string, ManoG>
export type Reposo = keyof typeof REPOSO

// ── Gestos al hablar (golpe = acento de la frase) ──
const G = (g: Gesto) => g
export const GESTOS = {
  // Palma abierta hacia arriba frente al vientre, presenta una idea.
  palma: G({ d: { p: [0.18, -0.36, 0.25], b: [0.0, -0.035, 0.015], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.5, flex: -0.15 }, asiente: 0.03 }),
  palmas: G({
    d: { p: [0.18, -0.37, 0.22], b: [0.01, -0.03, 0.01], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.45, flex: -0.15 },
    i: { p: [0.18, -0.38, 0.21], b: [0.01, -0.03, 0.01], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.45, flex: -0.15 },
    asiente: 0.035,
  }),
  // La "pinza de precisión" de Trump: pulgar e índice juntos, golpes cortos arriba y abajo.
  pinza: G({ d: { p: [0.17, -0.23, 0.27], b: [0.0, -0.045, 0.0], polo: P_ABAJO, forma: FORMA.pinza, prono: 0.75, flex: 0.1 }, cab: [-0.03, 0, 0], asiente: 0.04 }),
  // Acordeón: las dos palmas enfrentadas que se abren y cierran.
  acordeon: G({
    d: { p: [0.17, -0.3, 0.25], b: [0.06, 0, 0], polo: P_ABAJO, forma: FORMA.abierta, prono: 0.9, flex: -0.1 },
    i: { p: [0.17, -0.3, 0.25], b: [0.06, 0, 0], polo: P_ABAJO, forma: FORMA.abierta, prono: 0.9, flex: -0.1 },
    asiente: 0.02,
  }),
  // Señala al frente con el índice.
  senala: G({ d: { p: [0.2, -0.14, 0.38], b: [0.0, -0.02, 0.04], polo: P_ABAJO, forma: FORMA.senala, prono: 0.55, flex: -0.45 }, torso: [0.02, -0.08, 0], asiente: 0.03 }),
  // El índice arriba (Sócrates).
  indiceArriba: G({ d: { p: [0.17, -0.05, 0.2], b: [0.0, 0.025, 0.0], polo: P_ABAJO, forma: FORMA.senala, prono: 0.85, flex: -0.35 }, cab: [0, 0, 0.08], asiente: 0.02 }),
  // Corta el aire con la mano plana (Hormozi).
  corta: G({ d: { p: [0.18, -0.2, 0.32], b: [0.0, -0.07, 0.02], polo: P_ABAJO, forma: FORMA.torre, prono: 0.8, flex: -0.2 }, asiente: 0.05 }),
  corta2: G({
    d: { p: [0.16, -0.22, 0.3], b: [0.0, -0.06, 0.0], polo: P_ABAJO, forma: FORMA.torre, prono: 0.8, flex: -0.2 },
    i: { p: [0.16, -0.22, 0.3], b: [0.0, -0.06, 0.0], polo: P_ABAJO, forma: FORMA.torre, prono: 0.8, flex: -0.2 },
    asiente: 0.05,
  }),
  // Cuenta con los dedos: el índice de una mano toca los dedos de la otra.
  cuenta: G({
    d: { p: [0.07, -0.28, 0.3], b: [0.0, 0.015, 0.0], polo: P_ABAJO, forma: FORMA.senala, prono: 0.6, flex: 0.0 },
    i: { p: [0.1, -0.31, 0.26], b: [0.0, 0.0, 0.0], polo: P_ABAJO, forma: FORMA.abierta, prono: 0.4, flex: -0.6 },
    asiente: 0.02,
  }),
  // Enmarca la idea con las dos manos (Amodei).
  enmarca: G({
    d: { p: [0.16, -0.23, 0.26], b: [0.0, -0.03, 0.0], polo: P_ABAJO, forma: FORMA.torre, prono: 0.85, flex: -0.3 },
    i: { p: [0.16, -0.23, 0.26], b: [0.0, -0.03, 0.0], polo: P_ABAJO, forma: FORMA.torre, prono: 0.85, flex: -0.3 },
    asiente: 0.03,
  }),
  // Dedos en torre frente al pecho, golpecitos (Jobs).
  torre: G({
    d: { p: [0.082, -0.15, 0.13], b: [0.0, 0.012, 0.012], polo: P_ABAJO, forma: FORMA.yemas, prono: 0.45, flex: -0.3 },
    i: { p: [0.082, -0.15, 0.13], b: [0.0, 0.012, 0.012], polo: P_ABAJO, forma: FORMA.yemas, prono: 0.45, flex: -0.3 },
    asiente: 0.025,
  }),
  // "One more thing": la mano abierta arriba, presentando (Jobs).
  presenta: G({ d: { p: [0.25, -0.16, 0.25], b: [0.0, 0.02, 0.02], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.65, flex: -0.2 }, cab: [-0.02, 0.06, 0], asiente: 0.02 }),
  // La mano en el mentón, pensando (Lincoln, Jobs, Leonardo).
  menton: G({ d: { p: [0.04, 0.02, 0.05], b: [0, 0, 0], polo: P_ABAJO, forma: FORMA.suave, prono: 1.1, flex: 0.6 }, cab: [0.06, 0, 0.04], asiente: 0.0 }),
  // Bendición: la mano derecha a la altura del pecho, la palma afuera (Jesús).
  bendice: G({ d: { p: [0.17, -0.07, 0.24], b: [0.0, 0.01, 0.01], polo: P_ABAJO, forma: FORMA.torre, prono: 0.45, flex: -0.65 }, asiente: 0.02 }),
  // Concede: una mano adelante, abierta, la palma arriba (Cleopatra, Jesús).
  concede: G({ d: { p: [0.25, -0.3, 0.3], b: [0.02, -0.02, 0.02], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.55, flex: -0.25 }, cab: [-0.02, 0.05, 0.05], asiente: 0.02 }),
  // Clemencia: el brazo derecho adelante, la palma hacia abajo (Marco Aurelio).
  clemencia: G({ d: { p: [0.18, -0.16, 0.36], b: [0.0, -0.02, 0.01], polo: P_ABAJO, forma: FORMA.abierta, prono: -0.15, flex: 0.0 }, asiente: 0.02 }),
  // La palma abajo, señalando un mapa (Sun Tzu, el Gran Maestro).
  mapa: G({ d: { p: [0.2, -0.32, 0.32], b: [0.0, -0.025, 0.0], polo: P_ABAJO, forma: FORMA.abierta, prono: -0.2, flex: 0.05 }, asiente: 0.025 }),
  // El puño golpea la palma (Napoleón).
  punioPalma: G({
    d: { p: [0.03, -0.3, 0.22], b: [0.0, -0.05, 0.0], polo: P_ABAJO, forma: FORMA.punio, prono: 0.9, flex: 0.0 },
    i: { p: [0.05, -0.36, 0.2], b: [0.0, 0.0, 0.0], polo: P_ABAJO, forma: FORMA.abierta, prono: 1.45, flex: -0.1 },
    asiente: 0.05,
  }),
  // Gestos chicos y precisos cerca del pecho (Altman, Thiel, Pichai).
  chico: G({
    d: { p: [0.13, -0.33, 0.17], b: [0.0, -0.015, 0.01], polo: P_ABAJO, forma: FORMA.relajada, prono: 1.1, flex: -0.1 },
    i: { p: [0.06, -0.36, 0.1], b: [0.0, 0.0, 0.0], polo: P_ABAJO, forma: FORMA.suave, prono: 1.0, flex: 0.1 },
    asiente: 0.025,
  }),
  // Las dos manos abiertas con los dedos separados, enérgico (Karp).
  abiertas: G({
    d: { p: [0.22, -0.22, 0.24], b: [0.03, 0.03, 0.02], polo: P_ABAJO, forma: FORMA.abierta, prono: 0.6, flex: -0.25 },
    i: { p: [0.22, -0.24, 0.22], b: [0.03, 0.03, 0.02], polo: P_ABAJO, forma: FORMA.abierta, prono: 0.6, flex: -0.25 },
    torso: [0.04, 0, 0],
    asiente: 0.04,
  }),
} as const satisfies Record<string, Gesto>
export type GestoId = keyof typeof GESTOS

export interface Perfil {
  /** Medio ancho de apoyo extra por pie (m). */
  apoyo: number
  /** Puntas de los pies hacia afuera (rad). */
  puntas: number
  /** Rodillas destrabadas: cuánto baja la cadera (m). */
  rodilla: number
  /** Pelvis: + = inclinada adelante. */
  pelvis: number
  /** Encorvado: + = la columna y el pecho hacia adelante. */
  encorvar: number
  /** Pecho afuera (+). */
  pechoAfuera: number
  /** Cabeza adelantada (+). */
  cabezaAdelante: number
  /** Mentón: − = alto. */
  menton: number
  /** Cabeza ladeada en reposo (rad). */
  ladeo: number
  /** Hombros: + = atrás (retraídos), − = redondeados. */
  hombrosAtras: number
  /** Hombros caídos (+) o levantados (−). */
  hombrosCaida: number
  /** Peso cargado en una pierna: + izquierda, − derecha (contrapposto). */
  peso: number
  /** Vaivén en reposo (1 = normal). */
  vaiven: number
  /** Energía de los gestos: amplitud y velocidad (0,6 sereno … 1,5 inquieto). */
  energia: number
  /** Pasos por segundo relativos (Lincoln < 1, Cleopatra > 1). */
  cadencia: number
  /** Braceo relativo al caminar. */
  braceo: number
  /** Brazos separados del cuerpo al caminar (rad). */
  brazosAfuera: number
  /** Vaivén de cadera al caminar (1 = normal). */
  cadera: number
  reposoI: Reposo
  reposoD: Reposo
  /** Manos al caminar (si no, braceo libre). */
  caminaI?: Reposo
  caminaD?: Reposo
  /** Gestos al hablar, el primero el más frecuente. */
  gestos: readonly GestoId[]
  /** Pose al escuchar en una pausa larga (opcional). */
  escucha?: GestoId
  /** Rebota sobre los pies al hablar (Karp). */
  rebote?: number
}

const BASE: Perfil = {
  apoyo: 0.0,
  puntas: 0.12,
  rodilla: 0.006,
  pelvis: 0,
  encorvar: 0,
  pechoAfuera: 0,
  cabezaAdelante: 0,
  menton: 0,
  ladeo: 0,
  hombrosAtras: 0,
  hombrosCaida: 0,
  peso: 0,
  vaiven: 1,
  energia: 1,
  cadencia: 1,
  braceo: 1,
  brazosAfuera: 0,
  cadera: 1,
  reposoI: "sueltas",
  reposoD: "sueltas",
  gestos: ["palma", "palmas", "chico"],
}

const P = (p: Partial<Perfil>): Perfil => ({ ...BASE, ...p })

/** Perfiles por id de personaje (sacados de postura_gestos de cada ficha). */
export const PERFILES: Record<string, Perfil> = {
  trump: P({ apoyo: 0.05, puntas: 0.2, pechoAfuera: 0.05, menton: -0.07, hombrosAtras: 0.04, energia: 1.1, cadencia: 0.88, braceo: 0.7, brazosAfuera: 0.08, cadera: 1.5, reposoI: "abiertas", reposoD: "abiertas", gestos: ["pinza", "acordeon", "senala", "pinza", "palmas"] }),
  musk: P({ apoyo: 0.0, puntas: 0.1, encorvar: 0.05, cabezaAdelante: 0.05, menton: 0.03, hombrosAtras: -0.05, hombrosCaida: 0.02, vaiven: 1.4, energia: 0.9, reposoI: "bolsilloRemera", reposoD: "bolsilloRemera", gestos: ["chico", "palma", "abiertas"] }),
  altman: P({ apoyo: -0.01, puntas: 0.08, encorvar: 0.02, cabezaAdelante: 0.02, ladeo: 0.05, vaiven: 0.6, energia: 0.7, cadencia: 1.12, braceo: 0.8, reposoI: "juntas", reposoD: "juntas", gestos: ["chico", "palma", "enmarca"] }),
  thiel: P({ apoyo: -0.01, puntas: 0.06, rodilla: 0.002, pechoAfuera: 0.01, menton: 0.03, vaiven: 0.45, energia: 0.6, braceo: 0.7, reposoI: "juntasAltas", reposoD: "juntasAltas", gestos: ["chico", "chico", "palma"] }),
  karp: P({ apoyo: 0.02, puntas: 0.14, encorvar: 0.04, cabezaAdelante: 0.03, vaiven: 1.8, energia: 1.5, cadencia: 1.15, braceo: 1.2, gestos: ["abiertas", "palmas", "senala", "abiertas"], rebote: 1 }),
  pichai: P({ apoyo: 0.0, puntas: 0.1, ladeo: 0.06, vaiven: 0.6, energia: 0.7, reposoI: "juntas", reposoD: "juntas", gestos: ["palma", "chico", "palmas"] }),
  amodei: P({ apoyo: 0.01, puntas: 0.1, encorvar: 0.04, cabezaAdelante: 0.03, vaiven: 1.4, energia: 1.25, gestos: ["enmarca", "cuenta", "palmas", "enmarca", "palma"] }),
  hormozi: P({ apoyo: 0.055, puntas: 0.16, pechoAfuera: 0.03, hombrosAtras: 0.05, encorvar: 0.02, energia: 1.15, braceo: 0.85, brazosAfuera: 0.1, reposoI: "abiertas", reposoD: "abiertas", gestos: ["corta", "cuenta", "corta2", "senala"] }),
  tate: P({ apoyo: 0.045, puntas: 0.15, pechoAfuera: 0.07, menton: -0.08, hombrosAtras: 0.07, energia: 0.95, cadencia: 0.9, braceo: 0.7, brazosAfuera: 0.12, reposoI: "abiertas", reposoD: "bolsillo", gestos: ["senala", "palma", "senala"] }),
  gadzhi: P({ apoyo: 0.0, puntas: 0.08, pechoAfuera: 0.02, menton: -0.02, vaiven: 0.6, energia: 0.75, reposoI: "sueltas", reposoD: "bolsilloRemera", caminaD: "bolsilloRemera", gestos: ["palma", "chico", "palmas"] }),
  jobs: P({ apoyo: 0.01, puntas: 0.12, encorvar: 0.03, cabezaAdelante: 0.05, energia: 0.9, reposoI: "torre", reposoD: "torre", gestos: ["presenta", "torre", "palma", "presenta"], escucha: "menton" }),
  kobe: P({ apoyo: 0.04, puntas: 0.1, rodilla: 0.012, cabezaAdelante: 0.03, menton: 0.02, vaiven: 1.2, energia: 1.1, gestos: ["senala", "palma", "corta"] }),
  lincoln: P({ apoyo: 0.0, puntas: 0.1, encorvar: 0.07, cabezaAdelante: 0.06, menton: 0.05, ladeo: 0.07, hombrosAtras: -0.05, hombrosCaida: 0.03, vaiven: 0.7, energia: 0.7, cadencia: 0.8, braceo: 0.8, reposoI: "solapa", reposoD: "sueltas", gestos: ["palma", "menton", "palma"], escucha: "menton" }),
  napoleon: P({ apoyo: 0.035, puntas: 0.2, pechoAfuera: 0.06, menton: -0.08, hombrosAtras: 0.06, energia: 1.1, cadencia: 1.15, braceo: 0.9, reposoI: "atras", reposoD: "chaleco", caminaI: "atras", gestos: ["senala", "punioPalma", "senala"] }),
  leonardo: P({ apoyo: 0.0, puntas: 0.1, encorvar: 0.03, cabezaAdelante: 0.03, menton: 0.04, vaiven: 0.8, energia: 0.8, cadencia: 0.9, reposoI: "cuaderno", reposoD: "sueltas", caminaD: "atras", gestos: ["palma", "menton", "mapa"], escucha: "menton" }),
  cleopatra: P({ apoyo: -0.02, puntas: 0.12, pechoAfuera: 0.03, menton: -0.06, hombrosAtras: 0.05, vaiven: 0.6, energia: 0.7, cadencia: 1.2, braceo: 0.6, cadera: 1.7, reposoI: "juntas", reposoD: "juntas", gestos: ["concede", "palma", "concede"] }),
  suntzu: P({ apoyo: 0.0, puntas: 0.12, pechoAfuera: 0.01, ladeo: 0.04, vaiven: 0.4, energia: 0.6, cadencia: 1.12, braceo: 0.5, reposoI: "rollo", reposoD: "mangas", caminaI: "rollo", gestos: ["mapa", "mapa", "palma"] }),
  marco: P({ apoyo: 0.0, puntas: 0.14, encorvar: 0.02, menton: 0.06, peso: 0.8, vaiven: 0.6, energia: 0.75, cadencia: 0.95, reposoI: "cuaderno", reposoD: "sueltas", caminaI: "cuaderno", gestos: ["clemencia", "palma", "clemencia"] }),
  socrates: P({ apoyo: 0.045, puntas: 0.16, encorvar: 0.03, cabezaAdelante: 0.04, ladeo: 0.05, energia: 0.95, reposoI: "manto", reposoD: "sueltas", gestos: ["indiceArriba", "palma", "indiceArriba"] }),
  jesus: P({ apoyo: 0.01, puntas: 0.1, ladeo: 0.06, vaiven: 0.6, energia: 0.7, cadencia: 0.9, braceo: 0.7, reposoI: "sueltas", reposoD: "sueltas", gestos: ["palmas", "concede", "bendice"] }),
  mason: P({ apoyo: 0.0, puntas: 0.12, encorvar: 0.06, cabezaAdelante: 0.04, menton: 0.04, hombrosCaida: 0.02, vaiven: 0.5, energia: 0.55, cadencia: 0.8, braceo: 0.6, reposoI: "juntas", reposoD: "juntas", gestos: ["mapa", "palma"] }),
  iluminado: P({ apoyo: -0.01, puntas: 0.06, rodilla: 0.002, vaiven: 0.25, energia: 0.5, cadencia: 1.1, braceo: 0.3, reposoI: "mangas", reposoD: "mangas", caminaI: "mangas", caminaD: "mangas", gestos: ["indiceArriba", "mapa"] }),
  claude: P({ apoyo: 0.01, puntas: 0.1, ladeo: 0.04, vaiven: 0.7, energia: 0.9, reposoI: "juntas", reposoD: "juntas", gestos: ["enmarca", "palmas", "palma"], escucha: "menton" }),
  chatgpt: P({ apoyo: 0.0, puntas: 0.08, rodilla: 0.003, vaiven: 0.5, energia: 1.1, gestos: ["corta", "palma", "palmas"] }),
}

export function perfilDe(id: string): Perfil {
  return PERFILES[id] ?? BASE
}
