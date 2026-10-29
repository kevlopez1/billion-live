// fichas-mh.ts — de la ficha de hoy (avatar-fichas.ts, copia snap/) a la configuración de la
// cabeza MakeHuman. Un mapeo GENÉRICO (los mismos campos de la ficha mueven targets de MH) más
// un bloque `mh` por personaje con lo que la ficha no dice (peinado de MH, etnia, retoques).
// Uso: (esbuild → node) escribe cabeza/personajes-mh.json
import fs from "node:fs"
import { PERSONAJES } from "../../components/casa-blanca/datos/personajes"
import { resolverFicha, type FichaR } from "../../components/casa-blanca/escena/avatar-fichas"

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
// camino elegido: el pelo de HOY reajustado sobre la cara MH (peloHoy). Con PELO_MH=1 se hornea para el
// proxy de pelo de MakeHuman, que necesita el cuero teñido del color del pelo debajo.
const PELO_MH = process.env.PELO_MH === "1"
function edadASlider(anios: number) {
  if (anios <= 11) return Math.max(0, ((anios - 1) / 10) * 0.1875)
  if (anios <= 25) return 0.1875 + ((anios - 11) / 14) * (0.5 - 0.1875)
  return Math.min(1, 0.5 + ((anios - 25) / 65) * 0.5)
}

/** Lo que la ficha no dice y la cabeza MH necesita (iría como `mh` en avatar-fichas.ts). */
export interface ExtraMH {
  /** variante de ensayo: id del personaje del que sale (la cabeza se hornea con otro id) */
  de?: string
  etnia?: { african: number; asian: number; caucasian: number }
  peso?: number
  musculo?: number
  pelo?: { proxy: string; recorte?: { bajoFrente: number; bajoAtras: number }; inflar?: number } | null
  cejas?: string
  /** FASE 5 g2: retoque de la forma de las cejas propias sobre la de la ficha (grosor, arco, alto, inclinacion...) */
  cejasFicha?: Record<string, number>
  /** FASE 5 g2: retoque de la barba de la ficha (mascara pintada: mejillas, cuello, densidad...) */
  barbaFicha?: Record<string, number>
  /** FASE 5 g2: retoque de la línea del rapado (patillas, recta, alto...) */
  cueroLinea?: Record<string, number>
  /** FASE 5 g2: línea hasta donde se limpia el pelo pintado del atlas (por defecto { alto: -0.8 }) */
  limpiaCuero?: Record<string, number>
  pestanas?: string
  piel?: string
  /** FASE 5 g3: iris que reemplaza al de la ficha (androides: el del repo del 2026-10-29) */
  iris?: string
  /** targets de detalle que se suman al mapeo (id de modificador → valor) */
  detalles?: Record<string, number>
  expresion?: Record<string, number>
  /** FASE 5: gesto asimétrico, unidad → [derecha, izquierda] del personaje (hornear.mjs) */
  expresionLados?: Record<string, [number, number]>
  montaje?: { ajusteZ?: number; ajusteY?: number; escala?: number; sinBarbaHoy?: boolean; sinBigoteHoy?: boolean; bigoteBaja?: number; cueroSuave?: number; rizoFino?: number; barbaEspesor?: number }
  /** calvo: el cuero cabelludo pintado del atlas se cambia por piel limpia */
  calva?: boolean
  /** corona de pelo de un calvo, en tarjetas */
  corona?: { tope?: number; largo?: number; rizo?: number }
}

const EXTRA: Record<string, ExtraMH> = {
  trump: {
    etnia: { african: 0, asian: 0, caucasian: 1 }, peso: 0.78,
    pelo: { proxy: "short02", inflar: 0.05 }, cejas: "eyebrow010",
    detalles: { "head/head-fat-decr|incr": 0.5, "eyes/r-eye-eyefold-down|up": -0.25, "eyes/l-eye-eyefold-down|up": -0.25, "mouth/mouth-scale-horiz-decr|incr": -0.35, "mouth/mouth-upperlip-volume-decr|incr": -0.5, "chin/chin-width-decr|incr": 0.4, "neck/neck-double-decr|incr": 0.7, "head/head-square": 0.4 },
    expresion: { "mouth-pursing": 0.15 },
  },
  lincoln: {
    etnia: { african: 0, asian: 0, caucasian: 1 }, peso: 0.15, musculo: 0.45, piel: "old_lightskinned_male",
    pelo: { proxy: "short02", inflar: 0.08 }, cejas: "eyebrow001",
    detalles: { "head/head-oval": 0.3, "mouth/mouth-laugh-lines-in|out": 1, "cheek/l-cheek-inner-decr|incr": -1, "cheek/r-cheek-inner-decr|incr": -1, "cheek/l-cheek-volume-decr|incr": -0.5, "cheek/r-cheek-volume-decr|incr": -0.5, "head/head-age-decr|incr": 0.6, "chin/chin-height-decr|incr": 0.4, "nose/nose-hump-decr|incr": 0.4 },
  },
  kobe: {
    etnia: { african: 0.9, asian: 0, caucasian: 0.1 }, peso: 0.4, musculo: 0.75,
    pelo: null, cejas: "eyebrow009",
    detalles: { "nose/nose-flaring-decr|incr": 0.5 },
  },
  cleopatra: {
    etnia: { african: 0.1, asian: 0.05, caucasian: 0.85 }, peso: 0.4,
    pelo: { proxy: "bob02" }, cejas: "eyebrow006", pestanas: "eyelashes02",
    detalles: { "nose/nose-hump-decr|incr": 0.25 },
  },
  musk: {
    etnia: { african: 0, asian: 0, caucasian: 1 }, peso: 0.68,
    pelo: { proxy: "short02", inflar: 0.03 }, cejas: "eyebrow001",
    detalles: { "head/head-square": 0.5, "eyes/r-eye-eyefold-down|up": -0.4, "eyes/l-eye-eyefold-down|up": -0.4 },
  },
  "cleopatra-b1": { de: "cleopatra", pelo: { proxy: "bob01" } },
  "cleopatra-l1": { de: "cleopatra", pelo: { proxy: "long01" } },
  "musk-s4": { de: "musk", pelo: { proxy: "short04", inflar: 0.04 } },
  "musk-s3": { de: "musk", pelo: { proxy: "short03", inflar: 0.03 } },
  "trump-s1": { de: "trump", pelo: { proxy: "short01", inflar: 0.05 } },
  "lincoln-s1": { de: "lincoln", pelo: { proxy: "short01", inflar: 0.06 } },
  "lincoln-mb": { de: "lincoln", montaje: { sinBarbaHoy: true } },
  "socrates-mb": { de: "socrates", montaje: { sinBarbaHoy: true } },
  socrates: {
    etnia: { african: 0, asian: 0, caucasian: 1 }, peso: 0.7,
    pelo: null, calva: true, corona: { tope: 7.6, largo: 0.32, rizo: 0.7 }, cejas: "eyebrow009",
    detalles: { "head/head-round": 0.9, "head/head-scale-vert-decr|incr": -0.4, "head/head-scale-horiz-decr|incr": 0.4, "head/head-fat-decr|incr": 0.8, "forehead/forehead-nubian-decr|incr": 0.6, "nose/nose-septumangle-decr|incr": 0.8, "nose/nose-scale-vert-decr|incr": -0.6, "nose/nose-flaring-decr|incr": 1, "nose/nose-compression-compress|uncompress": -1, "nose/nose-hump-decr|incr": -1, "nose/nose-width3-decr|incr": 0.8, "nose/nose-point-down|up": 0.5, "mouth/mouth-scale-vert-decr|incr": 0.3, "eyes/r-eye-push1-in|out": 0.5, "eyes/l-eye-push1-in|out": 0.5, "eyes/r-eye-push2-in|out": 0.5, "eyes/l-eye-push2-in|out": 0.5, "eyes/r-eye-scale-decr|incr": 0.3, "eyes/l-eye-scale-decr|incr": 0.3, "cheek/r-cheek-volume-decr|incr": 0.4, "cheek/l-cheek-volume-decr|incr": 0.4 },
  },
}

// FASE 5 (afinado por grupos): cada grupo deja su bloque en cabeza/extra-*.json ({ id: ExtraMH }) y se
// suma aquí, para que los grupos no se pisen editando este archivo. Un id del JSON reemplaza al de arriba.
{
  const dir = process.env.EXTRA_DIR ?? process.cwd()
  for (const f of fs.readdirSync(dir).filter((x) => /^extra-.*\.json$/.test(x)).sort()) {
    const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")) as Record<string, ExtraMH>
    for (const [k, v] of Object.entries(j)) if (!k.startsWith("_")) EXTRA[k] = v
  }
}

function pielMH(f: FichaR, e: ExtraMH): string {
  if (e.piel) return e.piel
  const edad = f.edadAnios < 38 ? "young" : f.edadAnios < 60 ? "middleage" : "old"
  const oscura = (e.etnia?.african ?? 0) > 0.5
  return `${edad}_${oscura ? "darkskinned" : "lightskinned"}_${f.fem ? "female" : "male"}`
}

/** Ficha → detalles de MakeHuman (valores de -1..1, o 0..1 los de un solo target). */
function detallesDe(f: FichaR): Record<string, number> {
  const c = f.cara, o = c.ojos, n = c.nariz, l = c.labios, r = c.orejas
  const d: Record<string, number> = {}
  const lados = (grupo: string, base: string, v: number) => { if (Math.abs(v) > 0.01) { d[`${grupo}/r-${base}`] = clamp(v, -1, 1); d[`${grupo}/l-${base}`] = clamp(v, -1, 1) } }
  const uno = (id: string, v: number) => { if (Math.abs(v) > 0.01) d[id] = clamp(v, -1, 1) }
  uno("head/head-scale-horiz-decr|incr", (c.ancho - 1) * 4)
  uno("head/head-scale-vert-decr|incr", (c.largo - 1) * 3.5)
  uno("forehead/forehead-scale-vert-decr|incr", c.frente * 0.15)
  uno("chin/chin-bones-decr|incr", (c.mandibula - 1) * 4)
  uno("chin/chin-prominent-decr|incr", (c.menton - 1) * 3 + c.mentonAvance * 0.6)
  uno("chin/chin-prognathism-decr|incr", c.mentonAvance * 0.5)
  uno("chin/chin-cleft-decr|incr", c.mentonPartido)
  uno("chin/chin-width-decr|incr", c.mentonCuadrado * 0.6)
  if (c.anguloMandibula > 0.55) d["head/head-square"] = clamp((c.anguloMandibula - 0.55) * 1.5, 0, 1)
  lados("cheek", "cheek-bones-decr|incr", (c.pomulos - 1) * 2.5)
  lados("cheek", "cheek-volume-decr|incr", c.mejillas * 0.8)
  uno("neck/neck-double-decr|incr", c.papada)
  uno("eyebrows/eyebrows-trans-backward|forward", (c.arcoCejas - 1) * 3)
  lados("eyes", "eye-scale-decr|incr", (o.tam - 1) * 3)
  lados("eyes", "eye-trans-in|out", (o.sep - 1) * 4)
  lados("eyes", "eye-corner2-down|up", o.incl * 4)
  lados("eyes", "eye-height2-decr|incr", (o.abierto - 1) * 1.3)
  lados("eyes", "eye-eyefold-angle-down|up", -(o.parpado - 0.3) * 0.4)
  lados("eyes", "eye-push1-in|out", -o.hundidos * 0.9)
  lados("eyes", "eye-push2-in|out", -o.hundidos * 0.9)
  if (o.monoparpado) lados("eyes", "eye-epicanthus-in|out", 0.8)
  lados("eyes", "eye-bag-decr|incr", o.bolsas * 0.9)
  uno("nose/nose-scale-vert-decr|incr", (n.largo - 1) * 3)
  uno("nose/nose-scale-horiz-decr|incr", (n.ancho - 1) * 2)
  uno("nose/nose-nostrils-width-decr|incr", (n.ancho - 1) * 2)
  uno("nose/nose-point-width-decr|incr", (n.punta - 1) * 3)
  uno("nose/nose-scale-depth-decr|incr", (n.proy - 1) * 3 - n.chata * 0.4)
  uno("nose/nose-hump-decr|incr", n.gancho * 1.2)
  uno("nose/nose-point-down|up", n.respingada * 0.8 - n.gancho * 0.5)
  uno("nose/nose-curve-concave|convex", -n.chata * 0.8 + n.gancho * 0.3)
  uno("nose/nose-width1-decr|incr", (0.5 - n.puente) * 0.8)
  uno("mouth/mouth-scale-horiz-decr|incr", (l.ancho - 1) * 3)
  uno("mouth/mouth-upperlip-volume-decr|incr", (l.superior - 1) * 2)
  uno("mouth/mouth-lowerlip-volume-decr|incr", (l.inferior - 1) * 2)
  uno("mouth/mouth-lowerlip-ext-down|up", l.avanceInferior * 0.6)
  uno("mouth/mouth-angles-down|up", l.comisuras * 0.8)
  lados("ears", "ear-scale-decr|incr", (r.tam - 1) * 3)
  lados("ears", "ear-wing-decr|incr", r.despegadas)
  lados("ears", "ear-lobe-decr|incr", (r.lobulo - 1) * 2)
  return d
}

export function configMH(id: string) {
  const e0 = EXTRA[id] ?? {}
  const e: ExtraMH = e0.de ? { ...EXTRA[e0.de], ...e0, detalles: { ...(EXTRA[e0.de]?.detalles ?? {}), ...(e0.detalles ?? {}) } } : e0
  const p = PERSONAJES.find((x) => x.id === (e0.de ?? id))!
  const f = resolverFicha(p)
  const det = { ...detallesDe(f) }
  for (const [k, v] of Object.entries(e.detalles ?? {})) det[k] = clamp((det[k] ?? 0) + v, -1, 1)
  const mus = f.cuerpo.mBrazos
  const b = f.barba
  return {
    id, personaje: p.id,
    macro: {
      gender: f.fem ? 0 : 1,
      age: edadASlider(f.edadAnios),
      weight: e.peso ?? clamp(0.5 + c01(f.cara.mejillas) * 0.3 + f.cara.papada * 0.25, 0.1, 1),
      muscle: e.musculo ?? clamp(0.5 + (mus - 1) * 1.2, 0.1, 1),
      height: 0.5, proportions: 0.5,
      ...(e.etnia ?? { african: 0, asian: 0, caucasian: 1 }),
    },
    detalles: det,
    expresion: e.expresion ?? {},
    expresionLados: e.expresionLados ?? {},
    piel: pielMH(f, e),
    iris: e.iris ?? f.iris,
    cejas: e.cejas ?? "eyebrow001",
    // cejas propias (FASE 4): la forma sale de la ficha
    cejasFicha: { ...f.cejas, ...(e.cejasFicha ?? {}) },
    pestanas: e.pestanas ?? (f.fem ? "eyelashes02" : "eyelashes01"),
    pelo: !PELO_MH ? null : f.pelo.rapado > 0.5 || f.pelo.calvo > 0.95 ? (e.pelo ?? null) : e.pelo === undefined ? { proxy: "short02" } : e.pelo,
    // rapado: el pelo es solo la sombra en la piel; con peinado, el cuero debajo se tiñe del color
    // del pelo (así el borde del peinado no deja ver piel clara)
    cuero: f.pelo.rapado > 0.3 ? { densidad: f.pelo.rapado, linea: { recta: f.pelo.recta, entradas: f.pelo.entradas, alto: f.pelo.alto, ...(e.cueroLinea ?? {}) } }
      : (e.pelo?.proxy && PELO_MH ? { densidad: 0.6, linea: { recta: f.pelo.recta, entradas: f.pelo.entradas, alto: f.pelo.alto, patillas: f.fem ? -4 : f.pelo.patillas } } : null),
    barba: b ? { ...b, sombra: b.densidad < 0.35 ? b.densidad * 1.6 : 0.35, ...(e.barbaFicha ?? {}) } : null,
    montaje: e.montaje ?? {},
    // barba en tarjetas de MH solo si se usa (si no, la barba es la de hoy reajustada)
    // FASE 4: la barba en tarjetas de MH se descarta (se veía como vidrio roto / babero): va la de hoy reajustada
    tarjetasBarba: PELO_MH,
    calva: e.calva ?? false,
    maquillaje: f.piel.delineado > 0 || f.piel.sombraOjos ? { delineado: f.piel.delineado, sombra: f.piel.sombraOjos?.[1] ?? 0 } : null,
    corona: e.corona ?? null,
    ...(e.limpiaCuero ? { limpiaCuero: e.limpiaCuero } : {}),
  }
}
function c01(x: number) { return x }

const ids = (process.argv[2] ?? "trump,lincoln,kobe,cleopatra,musk,socrates").split(",")
const lista = ids.map(configMH)
fs.writeFileSync(process.argv[3] ?? "personajes-mh.json", JSON.stringify(lista, null, 1))
console.log("ok", lista.length)
