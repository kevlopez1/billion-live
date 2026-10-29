// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · LAS GUARDAS DE CONTENIDO (puras: sin red ni base)
//
// Lo que un video que se publica solo nunca puede tener. Una regla en el
// prompt es una probabilidad; esto es una comparación de cadenas. Cada guarda
// devuelve las razones en español (vacío = pasa), para que el guionista se
// las devuelva al modelo y para que Kev las lea en el panel.
//
// Fuente: docs/fabrica/ESPECIFICACION.md, sección 4, y el plan
// (kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md, sección 6).
// Los patrones son datos (FAMILIAS): agregar uno es agregar una línea, con su
// prueba en guardas.test.ts.
// ──────────────────────────────────────────────────────────────

import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { duracionTotal, guionValido, type Episodio, type Red } from "@/components/casa-blanca/estudio/guion"
import { APERTURA_S, CIERRE_S, avisosDelEpisodio, textoFinal } from "@/components/casa-blanca/estudio/linea"
import { LUGAR } from "@/components/casa-blanca/lugares"
import { CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import { usd } from "@/components/casa-blanca/ui/formato"
import { caracteresRaros, cumple, encontrar, variantes } from "./normalizar"
import { aDia, luzDe, luzDelVideo, nombra, nombradosEn, realDe, SEMAFORO, tercerosEn } from "./semaforo"
import { FICCION, HASHTAG_CASA, MAX_TEXTO, MAX_TITULO, WEB_CASA, largo } from "./textos"
import { voseo } from "./voseo"

export { voseo } from "./voseo"

// ── Qué hay en un episodio ────────────────────────────────────

export interface Reparto {
  habla: Set<string>
  seguidos: Set<string>
  enToma: Set<string>
  reunidos: Set<string>
  todos: Set<string>
}

/** Quién sale en el episodio y de qué manera. */
export function repartoDe(ep: Episodio): Reparto {
  const r: Reparto = { habla: new Set(), seguidos: new Set(), enToma: new Set(), reunidos: new Set(), todos: new Set() }
  for (const p of ep.planos ?? []) {
    const c = p.camara
    if (c?.tipo === "seguir") r.seguidos.add(c.personaje)
    if (c?.tipo === "toma" && c.personaje) r.enToma.add(c.personaje)
    for (const id of p.reunir ?? []) r.reunidos.add(id)
    for (const l of p.dialogo ?? []) r.habla.add(l.quien)
  }
  for (const s of [r.habla, r.seguidos, r.enToma, r.reunidos]) for (const id of s) r.todos.add(id)
  return r
}

export interface TextoUbicado {
  donde: string
  texto: string
}

/** Todo texto del episodio que se ve en pantalla, con dónde está. */
export function textosVisibles(ep: Episodio): TextoUbicado[] {
  const out: TextoUbicado[] = [{ donde: "título del episodio", texto: ep.titulo ?? "" }]
  ;(ep.planos ?? []).forEach((p, i) => {
    const n = `plano ${i + 1}`
    if (p.titulo) out.push({ donde: `${n}, título`, texto: p.titulo })
    if (p.rotulo) out.push({ donde: `${n}, rótulo`, texto: p.rotulo })
    for (const l of p.dialogo ?? []) out.push({ donde: `${n}, línea de ${l.quien}`, texto: l.texto })
  })
  return out
}

/** Los textos de publicación de un video: el de cada red y la miniatura de YouTube. */
export interface TextosDelVideo {
  /** El título tal como se publica (con los números puestos). Lo usa la cola para buscar el post. */
  titulo?: string
  porRed?: Partial<Record<Red, string>>
  miniatura?: string
}

function textosDePublicacion(t?: TextosDelVideo): TextoUbicado[] {
  const out: TextoUbicado[] = []
  for (const [red, texto] of Object.entries(t?.porRed ?? {})) if (texto) out.push({ donde: `texto de ${red}`, texto })
  if (t?.miniatura) out.push({ donde: "miniatura", texto: t.miniatura })
  return out
}

/** Oraciones de un texto. En Bolivia el punto separa miles: fin de oración es [.!?…] seguido de espacio o fin. */
export function oraciones(texto: string): string[] {
  return texto
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── Reparto y semáforo ────────────────────────────────────────

/**
 * - `fuera` no aparece en ningún campo ni es nombrado en ningún texto.
 * - `vivo` solo de fondo: no habla, no se lo sigue, no es el personaje de una toma, ni
 *   primero ni solo en `reunir`; su nombre no va en títulos, rótulos, diálogo,
 *   textos de publicación ni miniatura.
 */
export function revisarReparto(ep: Episodio, textos: TextosDelVideo | undefined, fechaSalida: string | Date): string[] {
  const errores: string[] = []
  const dia = aDia(fechaSalida)
  const r = repartoDe(ep)
  for (const id of r.todos) {
    if (luzDe(id, dia) === "fuera") errores.push(`"${id}" está fuera del semáforo para una salida el ${dia}: no puede aparecer`)
  }
  for (const id of r.habla) if (luzDe(id, dia) === "vivo") errores.push(`"${id}" es una persona viva: solo de fondo, sin diálogo`)
  for (const id of r.seguidos) if (luzDe(id, dia) === "vivo") errores.push(`"${id}" es una persona viva: la cámara no lo sigue`)
  for (const id of r.enToma) if (luzDe(id, dia) === "vivo") errores.push(`"${id}" es una persona viva: no es el personaje de una toma`)
  ;(ep.planos ?? []).forEach((p, i) => {
    const reunir = p.reunir ?? []
    if (!reunir.length) return
    if (luzDe(reunir[0], dia) === "vivo") errores.push(`plano ${i + 1}: "${reunir[0]}" es una persona viva y va primero en reunir`)
    else if (reunir.every((id) => luzDe(id, dia) === "vivo")) errores.push(`plano ${i + 1}: en reunir solo hay personas vivas`)
  })

  const fuera = Object.keys(SEMAFORO).filter((id) => luzDe(id, dia) === "fuera")
  const vivos = Object.keys(SEMAFORO).filter((id) => luzDe(id, dia) === "vivo")
  for (const t of [...textosVisibles(ep), ...textosDePublicacion(textos)]) {
    for (const id of nombradosEn(t.texto, fuera)) errores.push(`${t.donde}: nombra a "${id}", que está fuera del semáforo`)
    for (const id of nombradosEn(t.texto, vivos)) errores.push(`${t.donde}: nombra a "${id}", una persona viva (solo de fondo, nunca en un texto)`)
    // Una persona real que no vive en la casa no tiene semáforo: no se nombra nunca.
    for (const id of tercerosEn(t.texto)) errores.push(`${t.donde}: nombra a "${id}", una persona real de fuera de la casa (nunca se la nombra)`)
  }
  return [...new Set(errores)]
}

// ── Regla comercial ───────────────────────────────────────────

/** Un monto como lo escribe el estudio ($1.234): el {RECAUDADO} ya reemplazado sigue siendo el reto. */
const monto = (n: number) => {
  const t = usd(n)
  // Un monto de un dígito («$0», «$5») aparecería en cualquier texto: solo se buscan los que se reconocen.
  return t.replace(/\D/g, "").length >= 3 ? new RegExp(`(?<![\\p{N}.,])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{N}])`, "u") : null
}

/**
 * Lo comercial: PRIME, el reto y sus números, en cualquier forma («P R I M E»,
 * «PRlME», «{ recaudado }», «el desafío de Kev», el monto ya reemplazado…).
 * Se busca en todas las variantes del texto (normalizar.ts).
 */
const COMERCIAL: ReadonlyArray<{ que: string; re: RegExp; compacto?: RegExp; enBoca?: true }> = [
  {
    que: "PRIME",
    enBoca: true,
    re: /(?<![\p{L}\p{N}])prime(?:\s*business)?(?![\p{L}\p{N}])/iu,
    // Sin espacios ni puntos y con 1/l/! por i: «P R I M E», «P.R.I.M.E», «PRlME», «Pr1me».
    compacto: /(?<![\p{L}\p{N}])pr[il1!|]me(?![\p{L}])/iu,
  },
  { que: "{RECAUDADO}", re: /\{\s*recaudado\s*\}/iu, enBoca: true },
  { que: "{META}", re: /\{\s*meta\s*\}/iu, enBoca: true },
  { que: "Kev o el auto del reto", re: /(?<![\p{L}])(?:kev|kevproject\p{L}*|mansory|mercedes|amg gt)(?![\p{L}])/iu, enBoca: true },
  { que: "el reto", re: /(?<![\p{L}])(?:retos?|desaf[ií]os?|recaudad\p{L}*)(?![\p{L}])/iu },
  ...[monto(RECAUDADO), monto(CHALLENGE_TARGET)].flatMap((re) => (re ? [{ que: "el monto del reto", re, enBoca: true as const }] : [])),
]

/** «P R I M E» → «PRIME»: sin espacios, puntos ni guiones entre letras sueltas. */
const compactar = (t: string) => t.replace(/(?<=\b\p{L})[\s.·_-]+(?=\p{L}\b)/gu, "")

/** Las marcas comerciales de un texto (vacío = no tiene). El enlace fijo a la casa no cuenta. `enBoca` = solo las que una persona real nunca dice. */
export function comercialEn(texto: string, enBoca = false): string[] {
  const sinWeb = texto.split(WEB_CASA).join(" ")
  const out: string[] = []
  for (const c of COMERCIAL) {
    if (enBoca && !c.enBoca) continue
    if (cumple(c.re, sinWeb) || (c.compacto && variantes(sinWeb).some((v) => c.compacto!.test(compactar(v))))) out.push(c.que)
  }
  return out
}

/**
 * Las personas reales del video, en cuadro o nombradas:
 * - "comercial": vivos y fallecidos de la casa, y cualquier persona real de fuera.
 * - "persona": además los históricos (Lincoln, Napoleón, Jesús…): a ellos
 *   tampoco se les inventa un delito, una enfermedad o un amante.
 */
function realesPresentes(ep: Episodio, textos: TextosDelVideo | undefined, nivel: "comercial" | "persona"): string[] {
  const valen = nivel === "persona" ? ["vivo", "fallecido", "historico"] : ["vivo", "fallecido"]
  const reales = PERSONAJES.filter((p) => valen.includes(p.real)).map((p) => p.id)
  const r = repartoDe(ep)
  const out = new Set(reales.filter((id) => r.todos.has(id)))
  for (const t of [...textosVisibles(ep), ...textosDePublicacion(textos)]) {
    for (const id of nombradosEn(t.texto, reales)) out.add(id)
    for (const id of tercerosEn(t.texto)) out.add(id)
  }
  return [...out]
}

/** ¿Habla como persona real? Las IA y los arquetipos de la casa no son nadie. */
const esPersona = (id: string) => ["vivo", "fallecido", "historico"].includes(realDe(id) ?? "")

/**
 * - Un video con una persona viva o fallecida no lleva PRIME, el reto ni sus números.
 * - Nadie que sea una persona real (tampoco un histórico) dice PRIME, Kev, el
 *   reto o sus números en un diálogo: sería una persona real recomendando, y
 *   TikTok lo prohíbe aunque esté etiquetado. PRIME va en rótulos o títulos.
 */
export function reglaComercial(ep: Episodio, textos?: TextosDelVideo): string[] {
  const errores: string[] = []
  ;(ep.planos ?? []).forEach((p, i) => {
    for (const l of p.dialogo ?? []) {
      if (!esPersona(l.quien)) continue
      const c = comercialEn(l.texto, true)
      if (c.length) errores.push(`plano ${i + 1}, línea de ${l.quien}: ${c.join(", ")} en boca de una persona real (va solo en rótulos o títulos)`)
    }
  })
  const reales = realesPresentes(ep, textos, "comercial")
  if (!reales.length) return errores
  for (const t of [...textosVisibles(ep), ...textosDePublicacion(textos)]) {
    for (const que of comercialEn(t.texto)) errores.push(`${t.donde}: ${que} en un video con ${reales.join(", ")} (persona real viva o fallecida)`)
  }
  return errores
}

// ── Contenido prohibido ───────────────────────────────────────

const EMPRESAS =
  /(?<![\p{L}\p{N}])(?:Tesla|SpaceX|OpenAI|Anthropic|Palantir|Google|Alphabet|Apple|Microsoft|Amazon|Nvidia|Facebook|Instagram|TikTok|YouTube|Neuralink|PayPal|Stripe|Netflix|Nike|Pixar|NeXT|xAI|Founders Fund)(?![\p{L}\p{N}])/u
const CIFRA = /\d|\$|%|(?<![\p{L}])(?:millones|millón|millon|billones|dólares|dolares|por ciento|fortuna)(?![\p{L}])/iu

export interface Familia {
  id: string
  /** Lo que se le dice al modelo y a Kev. */
  nombre: string
  /**
   * "siempre"; "con_persona" si hay una persona real en el video, también
   * histórica; "con_real" si hay una viva o fallecida (o una de fuera de la
   * casa nombrada); "con_kobe" si está Kobe (en cuadro o nombrado, como sea).
   */
  cuando: "siempre" | "con_persona" | "con_real" | "con_kobe"
  /** Una oración cae si cumple TODOS (cada uno es una lista de alternativas). */
  todos: RegExp[]
}

/**
 * Las familias prohibidas, como datos. Una oración que las cumple tumba el
 * guion. Se comparan en todas las variantes del texto (normalizar.ts): un
 * patrón con tilde encuentra también la palabra escrita sin ella.
 */
export const FAMILIAS: readonly Familia[] = [
  // Con una persona real (también histórica) en cuadro o nombrada: nada inventado de su vida privada ni delitos.
  {
    id: "delitos",
    nombre: "delitos de una persona real",
    cuando: "con_persona",
    todos: [
      /(?<![\p{L}])(?:delito|crimen|criminal|c[aá]rcel|prisi[oó]n|rejas|presos?|(?:fue|est[aá]|estuvo|qued[oó]) presa|presidiari[oa]|(?:lo|la|los|las) encerraron|encerrad[oa] en (?:la )?(?:c[aá]rcel|prisi[oó]n|celda)|arrest\p{L}*|esposad[oa]|fraude|estafa\p{L}*|rob[oó]|robo|ladr[oó]n|ladrona|lavado de dinero|soborn\p{L}*|corrupci[oó]n|corrupt[oa]|narco\p{L}*|tr[aá]fico de|asesin\p{L}*|mat[oó] a|homicid\p{L}*|violaci[oó]n|viol[oó] a|violador)(?![\p{L}])/iu,
    ],
  },
  {
    id: "juicios",
    nombre: "juicios o temas judiciales de una persona real",
    cuando: "con_real",
    todos: [/(?<![\p{L}])(?:juicio|juez|jueza|tribunal|demanda|demand[oó]|abogad[oa]s?|fiscal|condena\p{L}*|sentencia judicial|acusaci[oó]n|acusad[oa]|corte suprema|impeachment|imputad[oa])(?![\p{L}])/iu],
  },
  {
    id: "salud",
    nombre: "salud de una persona real",
    cuando: "con_persona",
    todos: [
      /(?<![\p{L}])(?:enferm\p{L}*|c[aá]ncer|tumor\p{L}*|infarto|derrame cerebral|sida|vih|diagn[oó]stic\p{L}*|hospital\p{L}*|salud mental|depresi[oó]n|adicci[oó]n|adict[oa]|drogas?|drogadict[oa]|drogad[oa]|coca[ií]na|hero[ií]na|alcoh[oó]lic[oa]|alcoholismo|borrach[oa]|medicament\p{L}*|pastillas?|cirug[ií]a|terapia|demencia|autismo|asperger|s[ií]ndrome)(?![\p{L}])/iu,
    ],
  },
  {
    id: "sexo",
    nombre: "sexo de una persona real",
    cuando: "con_persona",
    todos: [
      /(?<![\p{L}])(?:sexo|sexual\p{L}*|amante|infiel|infidelidad|acoso|desnud\p{L}*|porno\p{L}*|prostitu\p{L}*|onlyfans|se acost[oó] con|se acuesta con|affaire|aventura amorosa|una aventura con|enga[ñn][oó] a su)(?![\p{L}])/iu,
    ],
  },
  {
    id: "familia",
    nombre: "familia de una persona real",
    cuando: "con_real",
    todos: [/(?<![\p{L}])(?:esposa|esposo|marido|ex ?esposa|ex ?mujer|su mujer|divorci\p{L}*|hij[oa]s?|novi[oa]|herman[oa]s?|beb[eé]s?|embaraz\p{L}*|su familia|su madre|su padre|su pap[aá]|su mam[aá])(?![\p{L}])/iu],
  },
  // Siempre
  {
    id: "politica",
    nombre: "política electoral",
    cuando: "siempre",
    todos: [
      /(?<![\p{L}])(?:elecciones|electoral\p{L}*|elecci[oó]n presidencial|comicios|presidenciales|candidat[oa]s?|campaña (?:presidencial|electoral)|dem[oó]crata\p{L}*|republican[oa]s?|partido (?:pol[ií]tico|dem[oó]crata|republicano)|midterms?|vot(?:a|en|ar|é|ó|emos) por|voten|vayan a votar|salgan a votar|urnas|sufragio|MAGA|derecha pol[ií]tica|kamala|biden|vance|obama)(?![\p{L}])/iu,
    ],
  },
  {
    id: "recomendacion",
    nombre: "alguien recomendando PRIME, un producto o un candidato",
    cuando: "siempre",
    todos: [
      /(?<![\p{L}])(?:recomiend\p{L}*|recomendar|te conviene|les conviene|compr(?:a|en|alo|enlo)|us(?:a|en|alo|enlo|ar[ií]a)|lo usar[ií]a|prueb(?:a|en|alo|enlo)|suscr[ií]b\p{L}*|vot(?:a|en|ar) por|contrat(?:a|en|alo|enlo)|es lo mejor|lo mejor que (?:existe|hay)|la mejor empresa|el mejor (?:producto|servicio|curso)|h[aá]ganle caso|hazle caso|con prime|gracias a prime|conf[ií]en en|no se lo pierdan)(?![\p{L}])/iu,
      /(?<![\p{L}])(?:prime|primebusiness|producto|marca|candidat[oa]|app|aplicaci[oó]n|servicio|plan premium|curso|kev)(?![\p{L}])/iu,
    ],
  },
  {
    id: "empresa_cifra",
    nombre: "una empresa real con una cifra",
    cuando: "siempre",
    todos: [EMPRESAS, CIFRA],
  },
  {
    id: "consejo_plata",
    nombre: "consejos de plata",
    cuando: "siempre",
    todos: [
      /(?<![\p{L}])(?:invierte|inviertan|inviertas|invertir todo|inviertan todo|compra acciones|compren acciones|cripto\p{L}*|bitcoin|forex|trading|apalancamiento|pide un pr[eé]stamo|pidan un pr[eé]stamo|rentabilidad garantizada|duplica tu dinero|hazte rico|te vas a hacer rico|tus ahorros|sus ahorros en|pasa(?:te|r)? a d[oó]lares|compra d[oó]lares|compren d[oó]lares|compra oro|compren oro|en oro ma[ñn]ana)(?![\p{L}])/iu,
    ],
  },
  {
    id: "consejo_salud",
    nombre: "consejos de salud",
    cuando: "siempre",
    todos: [
      /(?<![\p{L}])(?:toma(?:r|n)? (?:este|esta|estos|estas|una|un) (?:pastilla|medicamento|suplemento|dosis)|dosis diaria|automedic\p{L}*|deja (?:tu|la) medicaci[oó]n|deja(?:r|n)? de tomar|no tomes|no tomen|sin ir al m[eé]dico|remedio (?:para|contra)|cura (?:el|la|los|las) (?:c[aá]ncer|diabetes|ansiedad|depresi[oó]n))(?![\p{L}])/iu,
    ],
  },
  {
    id: "consejo_leyes",
    nombre: "consejos legales",
    cuando: "siempre",
    todos: [/(?<![\p{L}])(?:no pagues impuestos|evad(?:ir|e|an) impuestos|demanda a tu|demanden a su|consejo legal|asesor[ií]a legal|vac[ií]o legal|no es delito si|es legal si)(?![\p{L}])/iu],
  },
  {
    id: "conspiracion",
    nombre: "conspiraciones contadas como hecho",
    cuando: "siempre",
    todos: [
      /(?<![\p{L}])(?:nos (?:ocultan|esconden) la verdad|nos mienten|la verdad que nadie (?:te|nos) (?:cuenta|dice)|tierra (?:es )?plana|alunizaje (?:fue )?(?:falso|mentira|un montaje)|llegada a la luna|fue un montaje|chemtrails|plandemia|nuevo orden mundial|reptilianos?|vacunas? (?:tienen|traen|causan) (?:chips?|autismo)|controlan el mundo en secreto|(?:los )?illuminati (?:controlan|gobiernan|dirigen))(?![\p{L}])/iu,
    ],
  },
  {
    id: "muerte_kobe",
    nombre: "la muerte de Kobe",
    cuando: "con_kobe",
    todos: [/(?<![\p{L}])(?:muri[oó]|muerte|muerto|falleci\p{L}*|accidente|helic[oó]ptero|calabasas|tragedia|choque|se estrell\p{L}*|se fue en (?:aquel|ese|el) vuelo|aquel vuelo|en el aire)(?![\p{L}])/iu],
  },
]

/** Las familias prohibidas que cumple el episodio (y sus textos), con dónde. */
export function revisarContenido(ep: Episodio, textos?: TextosDelVideo): string[] {
  const reales = realesPresentes(ep, textos, "comercial")
  const personas = realesPresentes(ep, textos, "persona")
  const todosLosTextos = [...textosVisibles(ep), ...textosDePublicacion(textos)]
  // Kobe como lo nombre el texto (también «la Mamba Negra»): la misma búsqueda que el semáforo.
  const conKobe = repartoDe(ep).todos.has("kobe") || todosLosTextos.some((t) => nombra("kobe", t.texto))
  const errores: string[] = []
  for (const f of FAMILIAS) {
    if (f.cuando === "con_real" && !reales.length) continue
    if (f.cuando === "con_persona" && !personas.length) continue
    if (f.cuando === "con_kobe" && !conKobe) continue
    for (const t of todosLosTextos) {
      const cae = variantes(t.texto)
        .flatMap(oraciones)
        .find((o) => f.todos.every((re) => re.test(o)))
      if (cae) errores.push(`${t.donde}: ${f.nombre} («${cae.slice(0, 60)}»)`)
    }
  }
  return [...errores, ...revisarCitas(ep, textos)]
}

// ── Citas ─────────────────────────────────────────────────────

const normalizar = (s: string) =>
  s
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[«“"]+|[»”"]+$/g, "")
    .trim()

/** Las citas que personajes.ts marca con C("…"), por residente. */
export const CITAS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  PERSONAJES.map((p) => {
    const lineas = [...Object.values(p.temas ?? {}).flat(), ...(p.pensamientos ?? [])]
    const citas = lineas.filter((l): l is { t: string; c: true } => typeof l === "object" && l !== null && l.c === true).map((l) => normalizar(l.t))
    return [p.id, new Set(citas)]
  }),
)

/** Toda comilla: dobles, angulares, simples curvas y la simple recta que no es un apóstrofo entre letras (O'Brien). */
const COMILLAS = /[«»“”"„‟‘’‚‛‹›❝❞＂]|(?<!\p{L})'|'(?!\p{L})/u
/** «Como dijo X:», «X escribió:» — una frase atribuida aunque no lleve comillas. */
const ATRIBUCION = /(?<![\p{L}])(?:dijo|dec[ií]a|dice|escribi[oó]|afirm[oó]|declar[oó]|seg[uú]n)(?![\p{L}])[^.!?:\n]{0,40}:/iu
/** «Lincoln: la IA nos hará libres» en un rótulo o un título: lo de antes de los dos puntos (que no son una hora). */
const ANTES_DE_DOS_PUNTOS = /^([^:\n]{1,40}?)(?<!\d)\s*:(?!\d)/u

/**
 * «Lincoln: la IA nos hará libres»: antes de los dos puntos hay SOLO el nombre
 * de una persona real (hasta 3 palabras). «Napoleón contra Sun Tzu: ¿atacar?»
 * es un título, no una firma.
 */
function firmaConDosPuntos(linea: string): boolean {
  const antes = linea.match(ANTES_DE_DOS_PUNTOS)?.[1]?.trim()
  if (!antes || antes.split(/\s+/).length > 3) return false
  if (/(?<![\p{L}])(?:contra|vs\.?|versus|y|e|o|con|de|del|parte|cap[ií]tulo|antes|despu[eé]s)(?![\p{L}])/iu.test(antes)) return false
  return nombraPersona(antes)
}

/** ¿El texto nombra a alguna persona real (de la casa, también histórica, o de fuera)? */
const nombraPersona = (texto: string) =>
  nombradosEn(texto, PERSONAJES.filter((p) => esPersona(p.id)).map((p) => p.id)).length > 0 || tercerosEn(texto).length > 0

/**
 * Una frase entre comillas pasa por real.
 * - En un diálogo, solo si la línea es `cita: true` y es igual a una C("…")
 *   de ese personaje.
 * - En cualquier otro texto (título, rótulo, miniatura, textos de cada red),
 *   nunca: una cita real solo existe como línea con cita: true.
 * - Tampoco «Como dijo Lincoln: …» sin comillas, fuera de una cita marcada.
 */
export function revisarCitas(ep: Episodio, textos?: TextosDelVideo): string[] {
  const errores: string[] = []
  ;(ep.planos ?? []).forEach((p, i) => {
    for (const l of p.dialogo ?? []) {
      const n = `plano ${i + 1}, línea de ${l.quien}`
      const marcada = CITAS.get(l.quien)?.has(normalizar(l.texto)) ?? false
      if (l.cita && !marcada) errores.push(`${n}: dice ser una cita real y no está marcada como cita en personajes.ts`)
      else if (!l.cita && cumple(COMILLAS, l.texto)) errores.push(`${n}: tiene comillas; una frase entre comillas pasa por real (solo las citas de personajes.ts, con cita: true)`)
      else if (!l.cita && cumple(ATRIBUCION, l.texto) && nombraPersona(l.texto)) errores.push(`${n}: le atribuye una frase a una persona real («dijo …:»); solo las citas de personajes.ts, con cita: true`)
    }
  })
  const fuera = [...textosVisibles(ep).filter((t) => !t.donde.includes(", línea de ")), ...textosDePublicacion(textos)]
  for (const t of fuera) {
    if (cumple(COMILLAS, t.texto)) errores.push(`${t.donde}: tiene comillas; fuera de un diálogo con cita: true, una frase entre comillas pasa por real`)
    else if ((cumple(ATRIBUCION, t.texto) && nombraPersona(t.texto)) || t.texto.split("\n").some(firmaConDosPuntos))
      errores.push(`${t.donde}: le atribuye una frase a una persona real («X: …»)`)
  }
  return errores
}

// ── Similitud ─────────────────────────────────────────────────

/** El texto de un guion para compararlo con otros: lo visible, en minúsculas y sin signos. */
export function huellaDe(ep: Episodio | string): string {
  const t = typeof ep === "string" ? ep : textosVisibles(ep).map((x) => x.texto).join(" ")
  return t
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function trigramas(s: string): Set<string> {
  const t = ` ${s} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  return out
}

/** Jaccard de trigramas de caracteres: 0 = nada en común, 1 = iguales. */
export function similitud(a: string, b: string): number {
  const A = trigramas(huellaDe(a))
  const B = trigramas(huellaDe(b))
  if (!A.size && !B.size) return 1
  let comunes = 0
  for (const x of A) if (B.has(x)) comunes++
  return comunes / (A.size + B.size - comunes)
}

export const TOPE_SIMILITUD = 0.6
export const GUIONES_A_COMPARAR = 30

// ── El guion entero ───────────────────────────────────────────

export interface ContextoGuion {
  /** Día de salida (Bolivia): el semáforo se juzga con esta fecha. */
  fechaSalida: string | Date
  /** Lo que existe en la escena (como guionValido). */
  ids: { personajes: Set<string>; lugares: Set<string>; tomas: Set<string> }
  /** escena.tomas(): para los avisos del estudio. */
  tomas: ReadonlyArray<{ id: string; duracion: number }>
  /** Las redes donde sale: TikTok pide 61 s o más. */
  redes: readonly Red[]
  /** Los últimos guiones (episodios o sus huellas); se usan los 30 más nuevos. */
  recientes?: ReadonlyArray<Episodio | string>
}

/** Los ids que existen en la escena, con las tomas dadas. */
export function idsDelEstudio(tomas: ReadonlyArray<{ id: string }>): ContextoGuion["ids"] {
  return {
    personajes: new Set(PERSONAJES.map((p) => p.id)),
    lugares: new Set(Object.keys(LUGAR)),
    tomas: new Set(tomas.map((t) => t.id)),
  }
}

export const DURACION_MIN = 60
export const DURACION_MIN_TIKTOK = 61
export const DURACION_MAX = 90

/** Segundos del video entero: apertura + planos + cierre. */
export const duracionDelVideo = (ep: Episodio) => duracionTotal(ep) + APERTURA_S + CIERRE_S

/** Lo técnico: que se pueda filmar, que dure lo que tiene que durar, que no se repita y que esté en español neutro. */
export function revisarGuion(ep: Episodio, ctx: ContextoGuion): string[] {
  const errores = [...guionValido(ep, ctx.ids), ...avisosDelEpisodio(ep, ctx.tomas)]
  const d = duracionDelVideo(ep)
  const min = ctx.redes.includes("tiktok") ? DURACION_MIN_TIKTOK : DURACION_MIN
  if (!(d >= min && d <= DURACION_MAX))
    errores.push(`el video dura ${d.toFixed(1)} s con apertura y cierre: va de ${min} a ${DURACION_MAX} s (los planos suman ${duracionTotal(ep).toFixed(1)} s)`)
  const largoTitulo = largo(textoFinal(ep.titulo ?? ""))
  if (largoTitulo > MAX_TITULO) errores.push(`el título tiene ${largoTitulo} caracteres (con los números puestos): van ${MAX_TITULO} o menos`)
  for (const t of textosVisibles(ep)) {
    errores.push(...voseo(t.texto, t.donde))
    // El estudio solo reemplaza {RECAUDADO} y {META} tal cual: cualquier otra llave sale cruda en pantalla.
    for (const m of t.texto.match(/\{[^{}]*\}/g) ?? []) if (m !== "{RECAUDADO}" && m !== "{META}") errores.push(`${t.donde}: ${m} no es una marca del estudio (van {RECAUDADO} o {META}, exactas)`)
    const raros = caracteresRaros(t.texto)
    if (raros.length) errores.push(`${t.donde}: caracteres que esconden texto (${raros.slice(0, 3).join(", ")})`)
  }
  errores.push(...revisarDatos(ep, ctx.fechaSalida))
  const recientes = (ctx.recientes ?? []).slice(0, GUIONES_A_COMPARAR)
  const yo = huellaDe(ep)
  let max = 0
  for (const r of recientes) max = Math.max(max, similitud(yo, huellaDe(r)))
  if (max >= TOPE_SIMILITUD) errores.push(`se parece demasiado a un guion reciente (${Math.round(max * 100)} %; el tope es ${TOPE_SIMILITUD * 100} %)`)
  return errores
}

// ── Datos reales ──────────────────────────────────────────────

/** Lo que personajes.ts sabe de verdad de un personaje: su ficha, su época y sus frases. */
function fuenteDe(id: string): string {
  const p = PERSONAJES.find((x) => x.id === id)
  if (!p) return ""
  const lineas = [...Object.values(p.temas ?? {}).flat(), ...(p.pensamientos ?? [])].map((l) => (typeof l === "string" ? l : (l as { t: string }).t))
  return [p.bio, p.epoca, ...lineas].join(" \n ")
}

/**
 * Un rótulo o un título con un año se presenta como dato real: ese año tiene
 * que estar en la ficha de un personaje del video (personajes.ts). Un dato que
 * el modelo sacó de memoria no se puede verificar, y uno inventado saldría
 * como real. El año de la salida vale (es la fecha del video).
 */
export function revisarDatos(ep: Episodio, fechaSalida: string | Date): string[] {
  const errores: string[] = []
  const fuentes = [...repartoDe(ep).todos].map(fuenteDe).join(" \n ")
  const anioSalida = aDia(fechaSalida).slice(0, 4)
  ;(ep.planos ?? []).forEach((p, i) => {
    for (const [que, texto] of [["rótulo", p.rotulo], ["título", p.titulo]] as const) {
      if (!texto) continue
      for (const m of texto.replace(/\b\d{1,2}:\d{2}\b/g, " ").match(/(?<![\p{N}.,])\d{3,4}(?![\p{N}])/gu) ?? []) {
        if (m !== anioSalida && !new RegExp(`(?<![\\p{N}])${m}(?![\\p{N}])`, "u").test(fuentes))
          errores.push(`plano ${i + 1}, ${que}: el dato «${m}» no está en la ficha de ningún personaje del video (copia el dato real de su ficha)`)
      }
    }
  })
  return errores
}

// ── Textos por red ────────────────────────────────────────────

/** URL o dominio suelto: "http", "www.", "algo.world", "t.co". En X cuesta $0,20 por post en vez de $0,015. */
const URL_O_DOMINIO = /https?:|www\.|(?<![\p{L}\p{N}@])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}(?![\p{L}\p{N}])/iu

/** Una marca del estudio ({RECAUDADO}, {META}…) que quedó sin reemplazar por su número, en cualquier forma ({recaudado}, { META }). */
const MARCA = /\{\s*[\p{L}_]+\s*\}/u
/** Un dominio escrito para que X no lo vea: «kevproject . world», «[.]», «punto com». */
const DOMINIO_DISFRAZADO = /[\p{L}\p{N}-]+\s*(?:\.|\[\.\]|\(\.\)|punto|dot)\s*(?:world|live|com|net|org|io|ly|co|bo|app|ai)(?![\p{L}])/iu

/** Igual que lo arma textos.ts: espacios juntados y las marcas con su número. */
const tituloPublicado = (titulo: string) => textoFinal(titulo).replace(/\s+/g, " ").trim()

/** Lo que tiene mal el texto de una red. `titulo`, si se da, tiene que estar (con sus números puestos). */
export function textoValido(red: Red, texto: string, titulo?: string): string[] {
  const errores: string[] = []
  const lineas = texto.split("\n")
  if (lineas[0] !== FICCION) errores.push(`texto de ${red}: la primera línea tiene que ser exactamente «${FICCION}»`)
  if (titulo !== undefined && !texto.includes(tituloPublicado(titulo))) errores.push(`texto de ${red}: falta el título`)
  const marca = texto.match(MARCA)
  if (marca) errores.push(`texto de ${red}: ${marca[0]} sin reemplazar por su número`)
  if (largo(texto) > MAX_TEXTO[red]) errores.push(`texto de ${red}: ${largo(texto)} caracteres (el tope es ${MAX_TEXTO[red]})`)
  const etiquetas: string[] = texto.match(/#[\p{L}\p{N}_]+/gu) ?? []
  if (!etiquetas.includes(HASHTAG_CASA)) errores.push(`texto de ${red}: falta ${HASHTAG_CASA}`)
  if (etiquetas.length !== 3) errores.push(`texto de ${red}: van 3 etiquetas (${HASHTAG_CASA} + 2 del pilar) y hay ${etiquetas.length}`)
  if (red === "x") {
    // Con NFKC «kevproject．world» pasa a «kevproject.world»; 。 y ․ también son puntos (normalizar.ts).
    const m = encontrar(URL_O_DOMINIO, texto) ?? encontrar(DOMINIO_DISFRAZADO, texto) ?? encontrar(/kevproject|primebusiness/i, texto)
    if (m) errores.push(`texto de x: tiene una URL o un dominio («${m}»); en X el enlace va solo en la bio`)
  } else if (!texto.includes(WEB_CASA)) errores.push(`texto de ${red}: falta ${WEB_CASA}`)
  const raros = caracteresRaros(texto)
  if (raros.length) errores.push(`texto de ${red}: caracteres que esconden texto (${raros.slice(0, 3).join(", ")})`)
  errores.push(...voseo(texto, `texto de ${red}`))
  return errores
}

/** La miniatura de YouTube: 3 palabras o menos, sin el nombre de una persona viva ni de alguien fuera. */
export function miniaturaValida(texto: string, fechaSalida: string | Date): string[] {
  const errores: string[] = []
  const palabras = texto.trim().split(/\s+/).filter(Boolean)
  if (palabras.length > 3) errores.push(`miniatura: ${palabras.length} palabras (van 3 o menos)`)
  const marca = texto.match(MARCA)
  if (marca) errores.push(`miniatura: ${marca[0]} sin reemplazar por su número`)
  const dia = aDia(fechaSalida)
  for (const id of Object.keys(SEMAFORO)) {
    const l = luzDe(id, dia)
    if ((l === "vivo" || l === "fuera") && nombra(id, texto)) errores.push(`miniatura: nombra a "${id}" (${l})`)
  }
  for (const id of tercerosEn(texto)) errores.push(`miniatura: nombra a "${id}" (persona real de fuera de la casa)`)
  const raros = caracteresRaros(texto)
  if (raros.length) errores.push(`miniatura: caracteres que esconden texto (${raros.slice(0, 3).join(", ")})`)
  errores.push(...voseo(texto, "miniatura"))
  return errores
}

// ── Etiquetas de IA ───────────────────────────────────────────

const esVerdadero = (x: unknown) => x === true || x === "true"

/**
 * El cuerpo que se manda a cada red lleva su etiqueta de IA Y el aviso de
 * ficción como primera línea del texto; si falta cualquiera, no se sube.
 * - YouTube: status.containsSyntheticMedia = true + snippet.description
 * - Instagram: is_ai_generated = true + caption
 * - TikTok (Upload-Post): is_aigc = true (SIN VERIFICAR que Upload-Post lo pase) + title
 * - Facebook y X no tienen parámetro: la primera línea del texto es el aviso.
 */
export function etiquetaIA(red: Red, cuerpo: unknown): string[] {
  const c = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as Record<string, unknown>
  const aviso = (texto: unknown, campo: string) => (typeof texto === "string" && texto.split("\n")[0] === FICCION ? [] : [`${red}: ${campo} no empieza con el aviso de ficción`])
  switch (red) {
    case "youtube": {
      const status = (c.status && typeof c.status === "object" ? c.status : {}) as Record<string, unknown>
      const snippet = (c.snippet && typeof c.snippet === "object" ? c.snippet : {}) as Record<string, unknown>
      // Un videos.update de part=status no manda texto (no toca la descripción): ahí solo va el parámetro.
      const conTexto = "snippet" in c
      return [
        ...(status.containsSyntheticMedia === true ? [] : ["youtube: falta status.containsSyntheticMedia = true"]),
        ...(conTexto ? aviso(snippet.description, "snippet.description") : []),
      ]
    }
    case "instagram":
      return [...(esVerdadero(c.is_ai_generated) ? [] : ["instagram: falta is_ai_generated = true"]), ...aviso(c.caption, "caption")]
    case "tiktok":
      return [...(esVerdadero(c.is_aigc) ? [] : ["tiktok: falta is_aigc = true"]), ...aviso(c.title ?? c.description, "title")]
    case "facebook":
    case "x": {
      const texto = [c.description, c.text, c.caption, c.message].find((v): v is string => typeof v === "string")
      return texto?.split("\n")[0] === FICCION ? [] : [`${red}: el texto no empieza con el aviso de ficción`]
    }
    default:
      return [`red desconocida: ${String(red)}`]
  }
}

// ── Todo junto ────────────────────────────────────────────────

export interface Revision {
  errores: string[]
  /** verde: sale solo. amarillo: espera el OK de Kev (hay un amarillo o un vivo de fondo). fuera: no sale. */
  luz: "verde" | "amarillo" | "fuera"
}

/** Todas las guardas sobre un guion y sus textos. Vacío = pasa. */
export function revisarTodo(ep: Episodio, textos: TextosDelVideo | undefined, ctx: ContextoGuion): Revision {
  const errores = [
    ...revisarGuion(ep, ctx),
    ...revisarReparto(ep, textos, ctx.fechaSalida),
    ...reglaComercial(ep, textos),
    ...revisarContenido(ep, textos),
  ]
  for (const [red, texto] of Object.entries(textos?.porRed ?? {}) as Array<[Red, string]>) errores.push(...textoValido(red, texto, textos?.titulo ?? ep.titulo))
  if (textos?.miniatura !== undefined) errores.push(...miniaturaValida(textos.miniatura, ctx.fechaSalida))
  const r = repartoDe(ep)
  // Un nombrado en un texto también cuenta para la luz (un vivo nombrado ya es error arriba): Kobe solo
  // en la descripción del post también espera el OK de Kev.
  const presentes = new Set([...r.todos, ...[...textosVisibles(ep), ...textosDePublicacion(textos)].flatMap((t) => nombradosEn(t.texto))])
  return { errores: [...new Set(errores)], luz: luzDelVideo(presentes, ctx.fechaSalida) }
}

/** Para el panel: si un id existe en personajes.ts y qué es. */
export const esReal = (id: string) => realDe(id) === "vivo" || realDe(id) === "fallecido"
