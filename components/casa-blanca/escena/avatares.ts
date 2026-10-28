// ──────────────────────────────────────────────────────────────
// LOS PERSONAJES EN 3D
//
// Cada personaje se arma con piezas suaves (cápsulas, esferas, tornos) a
// partir de su Apariencia: nada de un personaje está escrito aquí, todo sale
// de datos/personajes.ts. El cuerpo es un esqueleto de grupos (cadera,
// rodillas, hombros, codos, cuello) para animarlo sin huesos ni modelos
// externos.
//
// Mira hacia +z (el motor gira la raíz con el rumbo) y mide `altura` metros
// con los pies en y = 0.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Avatar } from "./contrato"
import type { Apariencia, EstadoCuerpo, Personaje } from "../tipos"

// ── Geometrías compartidas (una sola vez para todos) ──────────
const geo = {
  esfera: new THREE.SphereGeometry(1, 28, 20),
  esferaBaja: new THREE.SphereGeometry(1, 14, 10),
  media: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  cilindro: new THREE.CylinderGeometry(1, 1, 1, 24),
  caja: new THREE.BoxGeometry(1, 1, 1),
  toro: new THREE.TorusGeometry(1, 0.12, 10, 32),
}
const capsulas = new Map<string, THREE.CapsuleGeometry>()
function capsula(r: number, largo: number) {
  const k = `${r.toFixed(3)}|${largo.toFixed(3)}`
  let g = capsulas.get(k)
  if (!g) {
    g = new THREE.CapsuleGeometry(r, largo, 8, 18)
    capsulas.set(k, g)
  }
  return g
}

/** Torso: un torno con cintura, pecho y hombros. Se escala por complexión. */
function torsoGeo(ancho: number, alto: number, saco: boolean) {
  const p: THREE.Vector2[] = []
  const perfil: Array<[number, number]> = saco
    ? [[0.0, 0], [0.165, 0], [0.168, 0.06], [0.16, 0.18], [0.175, 0.32], [0.19, 0.42], [0.185, 0.48], [0.12, 0.52], [0.06, 0.54], [0, 0.545]]
    : [[0.0, 0], [0.15, 0], [0.152, 0.06], [0.145, 0.18], [0.165, 0.32], [0.18, 0.42], [0.175, 0.48], [0.11, 0.52], [0.06, 0.54], [0, 0.545]]
  for (const [r, y] of perfil) p.push(new THREE.Vector2(r * ancho, y * alto))
  const g = new THREE.LatheGeometry(p, 28)
  g.scale(1, 1, 0.68)
  return g
}

/** Falda de túnica, toga o vestido: un cono de la cintura a los tobillos. */
function faldaGeo(largo: number, arriba: number, abajo: number) {
  const g = new THREE.CylinderGeometry(arriba, abajo, largo, 28, 1, true)
  g.translate(0, -largo / 2, 0)
  g.scale(1, 1, 0.78)
  return g
}

// ── Materiales (cacheados por color para compartir entre personajes) ──
const mats = new Map<string, THREE.MeshStandardMaterial>()
function mat(color: string, op: { rugosidad?: number; metal?: number; brillo?: boolean; tela?: boolean } = {}) {
  const k = `${color}|${op.rugosidad ?? ""}|${op.metal ?? ""}|${op.tela ? 1 : 0}`
  let m = mats.get(k)
  if (!m) {
    if (op.tela) {
      m = new THREE.MeshPhysicalMaterial({ color, roughness: op.rugosidad ?? 0.82, metalness: 0, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35) })
    } else {
      m = new THREE.MeshStandardMaterial({ color, roughness: op.rugosidad ?? 0.6, metalness: op.metal ?? 0 })
    }
    mats.set(k, m)
  }
  return m
}
const piel = (c: string) => mat(c, { rugosidad: 0.55 })
const tela = (c: string) => mat(c, { tela: true })
const ORO = () => mat("#d4a63a", { rugosidad: 0.28, metal: 0.9 })
const NEGRO = () => mat("#0d0d0f", { rugosidad: 0.45 })
const BLANCO_OJO = () => mat("#f4f1ea", { rugosidad: 0.3 })

/** Textura de líneas de escaneo para los hologramas (compartida). */
let lineas: THREE.CanvasTexture | null = null
function texturaLineas() {
  if (lineas) return lineas
  const c = document.createElement("canvas")
  c.width = 4
  c.height = 64
  const g = c.getContext("2d")!
  for (let y = 0; y < 64; y++) {
    const v = y % 4 < 2 ? 255 : 120
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 4, 1)
  }
  lineas = new THREE.CanvasTexture(c)
  lineas.wrapS = lineas.wrapT = THREE.RepeatWrapping
  lineas.repeat.set(1, 18)
  return lineas
}

/** Número de camiseta en una textura (Kobe: 24). */
function texturaNumero(numero: string, fondo: string, tinta: string) {
  const c = document.createElement("canvas")
  c.width = 128
  c.height = 128
  const g = c.getContext("2d")!
  g.fillStyle = fondo
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = tinta
  g.font = "bold 86px 'Bricolage Grotesque', 'Arial Black', sans-serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.lineWidth = 6
  g.strokeStyle = "#ffffff"
  g.strokeText(numero, 64, 70)
  g.fillText(numero, 64, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ── Construcción ──────────────────────────────────────────────

type Malla = THREE.Mesh<THREE.BufferGeometry, THREE.Material>

const ANCHO: Record<Apariencia["complexion"], number> = { delgado: 0.92, medio: 1, fuerte: 1.16, atletico: 1.08 }

export function crearAvatar(p: Personaje): Avatar {
  const ap = p.apariencia
  const altura = Math.min(2.05, Math.max(1.5, ap.altura || 1.78))
  const s = altura / 1.78
  const ancho = ANCHO[ap.complexion] ?? 1
  const holo = ap.ropa.tipo === "holograma"
  const largaRopa = ["tunica", "toga", "vestido_egipcio", "tunica_renacentista"].includes(ap.ropa.tipo)

  // Lo que se crea solo para este personaje (para liberarlo al final).
  const propias: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = []
  const mallas: Malla[] = []

  // Materiales del personaje
  let mPiel = piel(ap.piel)
  let mRopa = tela(ap.ropa.color)
  let mRopa2 = tela(ap.ropa.color2 ?? (ap.ropa.tipo === "traje" ? ap.ropa.color : "#2a2d34"))
  let mPelo = mat(ap.pelo.color, { rugosidad: 0.7 })
  let mBarba = mat(ap.barba?.color ?? ap.pelo.color, { rugosidad: 0.8 })
  let mZapato = mat(ap.ropa.tipo === "camiseta_basquet" || ap.ropa.tipo === "deportivo" ? "#f2f2f2" : "#141414", { rugosidad: 0.35 })

  // Holograma: un solo material de luz translúcida para todo el cuerpo.
  let mHolo: THREE.MeshStandardMaterial | null = null
  if (holo) {
    const t = texturaLineas().clone()
    t.needsUpdate = true
    propias.push(t)
    mHolo = new THREE.MeshStandardMaterial({
      color: ap.ropa.color,
      emissive: new THREE.Color(ap.ropa.color),
      emissiveIntensity: 1.6,
      emissiveMap: t,
      transparent: true,
      opacity: 0.62,
      roughness: 0.2,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    propias.push(mHolo)
    mPiel = mRopa = mRopa2 = mPelo = mBarba = mZapato = mHolo
  }

  const pieza = (g: THREE.BufferGeometry, m: THREE.Material, padre: THREE.Object3D, pos?: [number, number, number], esc?: [number, number, number], rot?: [number, number, number], sombra = true) => {
    const msh = new THREE.Mesh(g, m) as Malla
    if (pos) msh.position.set(...pos)
    if (esc) msh.scale.set(...esc)
    if (rot) msh.rotation.set(...rot)
    msh.castShadow = sombra && !holo
    padre.add(msh)
    mallas.push(msh)
    return msh
  }

  const raiz = new THREE.Group()
  raiz.name = `avatar-${p.id}`
  raiz.userData.personajeId = p.id
  const cuerpo = new THREE.Group()
  raiz.add(cuerpo)

  // Medidas base (para 1,78 m) escaladas
  const yCadera = 0.93 * s
  const muslo = 0.43 * s
  const pierna = 0.42 * s
  const brazo = 0.29 * s
  const antebrazo = 0.27 * s
  const altoTorso = 0.6 * s

  // ── Piernas ──
  const cadera = new THREE.Group()
  cadera.position.y = yCadera
  cuerpo.add(cadera)
  const pelvisMat = largaRopa ? mRopa : mRopa2
  pieza(geo.esfera, pelvisMat, cadera, [0, 0.02 * s, 0], [0.16 * s * ancho, 0.11 * s, 0.11 * s])

  const piernas: Array<{ cad: THREE.Group; rod: THREE.Group; pie: Malla }> = []
  for (const lado of [-1, 1]) {
    const cad = new THREE.Group()
    cad.position.set(lado * 0.09 * s * ancho, 0, 0)
    cadera.add(cad)
    const shortBasquet = ap.ropa.tipo === "camiseta_basquet"
    const botas = ap.ropa.tipo === "uniforme_militar"
    const rMuslo = 0.068 * s * Math.sqrt(ancho)
    pieza(capsula(rMuslo, muslo - rMuslo), shortBasquet ? mRopa2 : mRopa2, cad, [0, -muslo / 2, 0])
    if (shortBasquet) pieza(capsula(rMuslo * 0.82, muslo * 0.3), mPiel, cad, [0, -muslo * 0.85, 0])
    const rod = new THREE.Group()
    rod.position.y = -muslo
    cad.add(rod)
    const rPierna = 0.055 * s * Math.sqrt(ancho)
    pieza(capsula(rPierna, pierna - rPierna), shortBasquet ? mPiel : botas ? NEGRO() : mRopa2, rod, [0, -pierna / 2, 0])
    if (botas) pieza(capsula(rPierna * 1.12, pierna * 0.55), NEGRO(), rod, [0, -pierna * 0.62, 0])
    const pie = pieza(geo.esfera, mZapato, rod, [0, -pierna - 0.025 * s, 0.05 * s], [0.055 * s, 0.04 * s, 0.13 * s])
    piernas.push({ cad, rod, pie })
  }

  // ── Torso ──
  const torso = new THREE.Group()
  torso.position.y = yCadera + 0.02 * s
  cuerpo.add(torso)
  const conSaco = ap.ropa.tipo === "traje" || ap.ropa.tipo === "uniforme_militar"
  const gTorso = torsoGeo(ancho * s, altoTorso, conSaco)
  propias.push(gTorso)
  const torsoMalla = pieza(gTorso, ap.ropa.tipo === "camiseta_basquet" ? mRopa : mRopa, torso)

  if (largaRopa) {
    const largo = yCadera - 0.05 * s
    const gF = faldaGeo(largo, 0.16 * s * ancho, (ap.ropa.tipo === "vestido_egipcio" ? 0.21 : 0.27) * s * ancho)
    propias.push(gF)
    pieza(gF, mRopa, torso, [0, 0.04 * s, 0])
    if (ap.ropa.tipo === "toga" && ap.ropa.color2) {
      // Franja de la toga en diagonal sobre el pecho
      pieza(geo.caja, tela(ap.ropa.color2), torso, [0.02 * s, altoTorso * 0.55, 0.115 * s * ancho], [0.06 * s, altoTorso * 0.9, 0.01 * s], [0, 0, 0.55])
    }
  }

  if (conSaco) {
    // Faldón del saco, camisa, solapas y corbata
    const gFaldon = faldaGeo(0.2 * s, 0.168 * s * ancho, 0.18 * s * ancho)
    propias.push(gFaldon)
    pieza(gFaldon, mRopa, torso, [0, 0.03 * s, 0])
    const camisa = ap.ropa.tipo === "uniforme_militar" ? mat("#eceae2", { tela: true }) : mat("#f4f4f2", { tela: true })
    pieza(geo.caja, camisa, torso, [0, altoTorso * 0.78, 0.118 * s * ancho], [0.07 * s, 0.17 * s, 0.01 * s], [0.12, 0, 0])
    if (ap.ropa.tipo === "traje") {
      for (const lado of [-1, 1]) pieza(geo.caja, mat(new THREE.Color(ap.ropa.color).multiplyScalar(0.7).getStyle(), { tela: true }), torso, [lado * 0.05 * s, altoTorso * 0.72, 0.122 * s * ancho], [0.035 * s, 0.2 * s, 0.008 * s], [0.1, 0, -lado * 0.32])
      if (ap.ropa.corbata) {
        const larga = ap.ropa.corbata.toLowerCase().startsWith("#b") || ap.ropa.corbata.toLowerCase().startsWith("#c") || ap.ropa.corbata.toLowerCase().startsWith("#d")
        const largoCorbata = (larga ? 0.42 : 0.3) * s
        pieza(geo.caja, mat(ap.ropa.corbata, { rugosidad: 0.4 }), torso, [0, altoTorso * 0.86 - largoCorbata / 2, 0.126 * s * ancho], [0.042 * s, largoCorbata, 0.01 * s], [0.06, 0, 0])
      }
    }
    if (ap.ropa.tipo === "uniforme_militar") for (let i = 0; i < 5; i++) pieza(geo.esferaBaja, ORO(), torso, [0.03 * s, altoTorso * (0.25 + i * 0.11), 0.12 * s * ancho], [0.011 * s, 0.011 * s, 0.008 * s], undefined, false)
  }

  if (ap.ropa.tipo === "camiseta_basquet") {
    const num = (ap.ropa as { numero?: number | string }).numero ?? (p.id === "kobe" ? "24" : "")
    if (num) {
      const tx = texturaNumero(String(num), ap.ropa.color, ap.ropa.color2 ?? "#f2c230")
      const mn = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 })
      propias.push(tx, mn)
      for (const z of [1, -1]) pieza(new THREE.PlaneGeometry(0.17 * s, 0.17 * s), mn, torso, [0, altoTorso * 0.55, z * 0.123 * s * ancho], undefined, [0, z > 0 ? 0 : Math.PI, 0], false)
    }
  }

  // Cuello
  const cuelloAlto = ap.ropa.tipo === "cuello_alto"
  pieza(capsula(0.05 * s, 0.07 * s), cuelloAlto ? mRopa : mPiel, torso, [0, altoTorso + 0.02 * s, 0])
  if (cuelloAlto) pieza(capsula(0.058 * s, 0.05 * s), mRopa, torso, [0, altoTorso - 0.005 * s, 0])

  // ── Brazos ──
  const brazos: Array<{ hom: THREE.Group; codo: THREE.Group; mano: Malla }> = []
  const mangaCorta = ap.ropa.tipo === "camiseta_basquet" || ap.ropa.tipo === "vestido_egipcio"
  for (const lado of [-1, 1]) {
    const hom = new THREE.Group()
    hom.position.set(lado * 0.19 * s * ancho, altoTorso * 0.86, 0)
    torso.add(hom)
    const rB = 0.05 * s * Math.sqrt(ancho)
    pieza(capsula(rB, brazo - rB), mangaCorta ? mPiel : mRopa, hom, [0, -brazo / 2, 0])
    const codo = new THREE.Group()
    codo.position.y = -brazo
    hom.add(codo)
    pieza(capsula(rB * 0.88, antebrazo - rB), mangaCorta ? mPiel : mRopa, codo, [0, -antebrazo / 2, 0])
    if (!mangaCorta && !holo && conSaco) pieza(capsula(rB * 0.8, 0.02 * s), mat("#f4f4f2", { tela: true }), codo, [0, -antebrazo + 0.02 * s, 0])
    const mano = pieza(geo.esfera, mPiel, codo, [0, -antebrazo - 0.035 * s, 0], [0.042 * s, 0.055 * s, 0.03 * s])
    if (ap.ropa.tipo === "uniforme_militar" || ap.accesorios.includes("charreteras")) pieza(geo.caja, ORO(), hom, [0, 0.025 * s, 0], [0.1 * s, 0.025 * s, 0.09 * s], undefined, false)
    brazos.push({ hom, codo, mano })
  }

  // ── Cabeza ──
  const cuello = new THREE.Group()
  cuello.position.y = altoTorso + 0.06 * s
  torso.add(cuello)
  const cabezaG = new THREE.Group()
  cabezaG.position.y = 0.11 * s
  cuello.add(cabezaG)
  const hr = 0.108 * s // radio base del cráneo
  pieza(geo.esfera, mPiel, cabezaG, [0, 0, 0], [hr * 0.92, hr * 1.12, hr * 1.02])
  // Mandíbula y mentón
  pieza(geo.esfera, mPiel, cabezaG, [0, -hr * 0.45, hr * 0.18], [hr * 0.72, hr * 0.6, hr * 0.78])
  // Nariz, orejas, ojos, cejas, boca
  pieza(geo.esfera, mPiel, cabezaG, [0, -hr * 0.08, hr * 1.0], [hr * 0.13, hr * 0.22, hr * 0.17], undefined, false)
  for (const lado of [-1, 1]) {
    pieza(geo.esfera, mPiel, cabezaG, [lado * hr * 0.92, -hr * 0.05, 0], [hr * 0.1, hr * 0.22, hr * 0.15], undefined, false)
    if (!holo) {
      pieza(geo.esferaBaja, BLANCO_OJO(), cabezaG, [lado * hr * 0.36, hr * 0.12, hr * 0.86], [hr * 0.15, hr * 0.11, hr * 0.08], undefined, false)
      pieza(geo.esferaBaja, mat("#1d1b19", { rugosidad: 0.2 }), cabezaG, [lado * hr * 0.36, hr * 0.11, hr * 0.93], [hr * 0.075, hr * 0.08, hr * 0.04], undefined, false)
      pieza(geo.caja, ap.pelo.estilo === "calvo" ? mat(new THREE.Color(ap.piel).multiplyScalar(0.55).getStyle()) : mPelo, cabezaG, [lado * hr * 0.37, hr * 0.32, hr * 0.92], [hr * 0.36, hr * 0.06, hr * 0.06], [0, 0, -lado * 0.08], false)
    }
  }
  if (!holo) pieza(geo.caja, mat(new THREE.Color(ap.piel).multiplyScalar(0.62).getStyle()), cabezaG, [0, -hr * 0.46, hr * 0.92], [hr * 0.36, hr * 0.045, hr * 0.04], undefined, false)

  // Pelo
  const capa = (escala: number, dy = 0, mt = mPelo) => pieza(geo.media, mt, cabezaG, [0, hr * 0.12 + dy, -hr * 0.04], [hr * 0.98 * escala, hr * 1.05 * escala, hr * 1.06 * escala])
  switch (ap.pelo.estilo) {
    case "calvo":
      break
    case "rapado":
      capa(1.0)
      break
    case "corto":
      capa(1.04)
      pieza(geo.esfera, mPelo, cabezaG, [0, hr * 0.05, -hr * 0.42], [hr * 0.9, hr * 0.85, hr * 0.62])
      break
    case "peinado_atras":
      capa(1.06, hr * 0.03)
      pieza(geo.esfera, mPelo, cabezaG, [0, hr * 0.15, -hr * 0.4], [hr * 0.95, hr * 0.9, hr * 0.7])
      break
    case "peinado_lado":
      capa(1.05, hr * 0.02)
      pieza(geo.esfera, mPelo, cabezaG, [hr * 0.25, hr * 0.62, hr * 0.35], [hr * 0.6, hr * 0.28, hr * 0.5], [0, 0, -0.3])
      pieza(geo.esfera, mPelo, cabezaG, [0, hr * 0.05, -hr * 0.42], [hr * 0.9, hr * 0.85, hr * 0.62])
      break
    case "rubio_tupe":
      capa(1.08, hr * 0.04)
      pieza(geo.esfera, mPelo, cabezaG, [0, hr * 0.78, hr * 0.42], [hr * 0.92, hr * 0.42, hr * 0.62], [-0.25, 0, 0])
      pieza(geo.esfera, mPelo, cabezaG, [0, hr * 0.1, -hr * 0.45], [hr * 0.95, hr * 0.9, hr * 0.65])
      break
    case "largo":
      capa(1.06)
      pieza(geo.esfera, mPelo, cabezaG, [0, -hr * 0.55, -hr * 0.55], [hr * 0.95, hr * 1.25, hr * 0.42])
      for (const lado of [-1, 1]) pieza(geo.esfera, mPelo, cabezaG, [lado * hr * 0.88, -hr * 0.45, -hr * 0.1], [hr * 0.18, hr * 0.95, hr * 0.42])
      break
    case "rizado":
      capa(1.04)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        pieza(geo.esferaBaja, mPelo, cabezaG, [Math.cos(a) * hr * 0.62, hr * (0.62 + 0.12 * Math.sin(i * 1.7)), Math.sin(a) * hr * 0.6 - hr * 0.05], [hr * 0.32, hr * 0.32, hr * 0.32], undefined, false)
      }
      break
    case "rizado_voluminoso":
      capa(1.1)
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2
        const anillo = i % 2 ? 0.95 : 0.72
        pieza(geo.esferaBaja, mPelo, cabezaG, [Math.cos(a) * hr * anillo, hr * (0.55 + (i % 3) * 0.16), Math.sin(a) * hr * anillo - hr * 0.08], [hr * 0.42, hr * 0.42, hr * 0.42], undefined, false)
      }
      break
    case "melena_bob":
      capa(1.1, hr * 0.02)
      pieza(geo.cilindro, mPelo, cabezaG, [0, -hr * 0.25, -hr * 0.08], [hr * 1.1, hr * 0.85, hr * 1.04])
      pieza(geo.caja, mPelo, cabezaG, [0, hr * 0.55, hr * 0.8], [hr * 1.5, hr * 0.32, hr * 0.22])
      break
  }

  // Barba
  if (ap.barba && !holo) {
    const b = ap.barba.estilo
    if (b === "barba_de_dias") {
      const m = new THREE.MeshStandardMaterial({ color: ap.barba.color, roughness: 0.9, transparent: true, opacity: 0.38 })
      propias.push(m)
      pieza(geo.esfera, m, cabezaG, [0, -hr * 0.47, hr * 0.2], [hr * 0.75, hr * 0.62, hr * 0.81], undefined, false)
    } else if (b === "menton") {
      pieza(geo.esfera, mBarba, cabezaG, [0, -hr * 0.78, hr * 0.32], [hr * 0.62, hr * 0.32, hr * 0.55])
    } else if (b === "candado") {
      pieza(geo.esfera, mBarba, cabezaG, [0, -hr * 0.82, hr * 0.62], [hr * 0.3, hr * 0.26, hr * 0.22])
      pieza(geo.caja, mBarba, cabezaG, [0, -hr * 0.33, hr * 0.95], [hr * 0.42, hr * 0.07, hr * 0.06], undefined, false)
    } else if (b === "larga") {
      pieza(geo.esfera, mBarba, cabezaG, [0, -hr * 0.62, hr * 0.38], [hr * 0.78, hr * 0.62, hr * 0.7])
      pieza(geo.esfera, mBarba, cabezaG, [0, -hr * 1.45, hr * 0.45], [hr * 0.5, hr * 1.0, hr * 0.38])
      pieza(geo.caja, mBarba, cabezaG, [0, -hr * 0.33, hr * 0.95], [hr * 0.55, hr * 0.08, hr * 0.06], undefined, false)
    } else {
      const grande = b === "completa"
      pieza(geo.esfera, mBarba, cabezaG, [0, -hr * 0.55, hr * 0.3], [hr * (grande ? 0.82 : 0.76), hr * (grande ? 0.62 : 0.5), hr * (grande ? 0.78 : 0.74)])
      pieza(geo.caja, mBarba, cabezaG, [0, -hr * 0.33, hr * 0.95], [hr * 0.5, hr * 0.07, hr * 0.06], undefined, false)
    }
  }

  // Sombrero
  const tope = new THREE.Group()
  tope.position.y = hr * 1.08
  cabezaG.add(tope)
  let altoSombrero = 0
  switch (ap.sombrero) {
    case "bicornio": {
      const g = new THREE.CylinderGeometry(hr * 1.9, hr * 1.9, hr * 0.28, 32, 1, false, 0, Math.PI)
      g.rotateX(Math.PI / 2)
      g.rotateY(Math.PI / 2)
      propias.push(g)
      pieza(g, NEGRO(), tope, [0, -hr * 0.08, 0], [1, 1.05, 1])
      pieza(geo.esfera, mat("#1f3fae"), tope, [hr * 0.15, hr * 0.85, hr * 0.12], [hr * 0.22, hr * 0.22, hr * 0.06], [0, Math.PI / 2, 0], false)
      pieza(geo.esfera, mat("#ffffff"), tope, [hr * 0.17, hr * 0.85, hr * 0.12], [hr * 0.15, hr * 0.15, hr * 0.06], [0, Math.PI / 2, 0], false)
      pieza(geo.esfera, mat("#c9283a"), tope, [hr * 0.19, hr * 0.85, hr * 0.12], [hr * 0.08, hr * 0.08, hr * 0.06], [0, Math.PI / 2, 0], false)
      altoSombrero = hr * 1.8
      break
    }
    case "chistera":
      pieza(geo.cilindro, NEGRO(), tope, [0, hr * 0.85, 0], [hr * 0.78, hr * 1.7, hr * 0.78])
      pieza(geo.cilindro, NEGRO(), tope, [0, 0.0, 0], [hr * 1.35, hr * 0.06, hr * 1.35])
      altoSombrero = hr * 1.75
      break
    case "laurel":
      pieza(geo.toro, mat("#4e7a32", { rugosidad: 0.6 }), tope, [0, -hr * 0.35, 0], [hr * 0.98, hr * 0.98, hr * 0.98], [Math.PI / 2, 0, 0], false)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        pieza(geo.esferaBaja, mat("#6fa344", { rugosidad: 0.6 }), tope, [Math.cos(a) * hr, -hr * 0.3, Math.sin(a) * hr], [hr * 0.18, hr * 0.06, hr * 0.09], [0, -a, 0.4], false)
      }
      altoSombrero = hr * 0.2
      break
    case "gorra":
      pieza(geo.media, mRopa2, tope, [0, -hr * 0.55, 0], [hr * 1.04, hr * 0.7, hr * 1.06])
      pieza(geo.caja, mRopa2, tope, [0, -hr * 0.52, hr * 1.05], [hr * 1.2, hr * 0.05, hr * 0.7])
      altoSombrero = hr * 0.25
      break
    case "corona_egipcia":
      pieza(geo.cilindro, ORO(), tope, [0, -hr * 0.45, 0], [hr * 1.02, hr * 0.14, hr * 1.06])
      pieza(geo.esferaBaja, ORO(), tope, [0, -hr * 0.25, hr * 0.98], [hr * 0.1, hr * 0.22, hr * 0.08], undefined, false)
      altoSombrero = hr * 0.25
      break
    case "boina":
      pieza(geo.esfera, mRopa2, tope, [hr * 0.15, -hr * 0.3, 0], [hr * 1.2, hr * 0.32, hr * 1.12], [0, 0, -0.2])
      altoSombrero = hr * 0.2
      break
  }

  // Accesorios
  const acc = new Set(ap.accesorios)
  const manoD = brazos[1].mano
  const manoI = brazos[0].mano
  if (acc.has("gafas") || acc.has("gafas_redondas") || acc.has("gafas_sol")) {
    const sol = acc.has("gafas_sol")
    for (const lado of [-1, 1]) {
      if (sol) pieza(geo.esferaBaja, mat("#0b0b0d", { rugosidad: 0.1, metal: 0.4 }), cabezaG, [lado * hr * 0.36, hr * 0.1, hr * 0.98], [hr * 0.26, hr * 0.18, hr * 0.05], undefined, false)
      else pieza(geo.toro, mat(acc.has("gafas_redondas") ? "#2a2520" : "#1a1a1a", { rugosidad: 0.3, metal: 0.6 }), cabezaG, [lado * hr * 0.36, hr * 0.11, hr * 0.98], [hr * (acc.has("gafas_redondas") ? 0.2 : 0.22), hr * 0.18, hr * 0.2], undefined, false)
    }
    pieza(geo.caja, mat("#1a1a1a"), cabezaG, [0, hr * 0.13, hr * 1.0], [hr * 0.2, hr * 0.03, hr * 0.03], undefined, false)
  }
  if (acc.has("collar_oro") || ap.ropa.tipo === "vestido_egipcio") pieza(geo.toro, ORO(), torso, [0, altoTorso * 0.93, 0.01 * s], [0.13 * s * ancho, 0.1 * s, 0.13 * s], [Math.PI / 2 - 0.25, 0, 0], false)
  if (acc.has("faja")) pieza(geo.cilindro, mat("#1d1d22", { tela: true }), torso, [0, 0.06 * s, 0], [0.172 * s * ancho, 0.05 * s, 0.123 * s * ancho])
  if (acc.has("reloj")) pieza(geo.toro, ORO(), brazos[0].codo, [0, -antebrazo + 0.03 * s, 0], [0.045 * s, 0.045 * s, 0.07 * s], [Math.PI / 2, 0, 0], false)
  if (acc.has("auriculares")) pieza(geo.toro, mat("#1b1b1f", { rugosidad: 0.3 }), cabezaG, [0, hr * 0.15, 0], [hr * 1.08, hr * 1.12, hr * 1.0], [0, Math.PI / 2, 0], false)
  if (acc.has("pergamino")) pieza(geo.cilindro, mat("#e8dcb8", { rugosidad: 0.9 }), manoI, [0, -0.4, 0], [0.5, 4.5, 0.5], [0, 0, Math.PI / 2], false)
  if (acc.has("cuaderno")) pieza(geo.caja, mat("#5a3a24"), manoI, [0, -0.6, 0.3], [2.6, 3.2, 0.5], undefined, false)
  if (acc.has("laptop")) pieza(geo.caja, mat("#b9bcc2", { metal: 0.7, rugosidad: 0.3 }), manoI, [0, -0.5, 0.6], [4.6, 0.25, 3.4], undefined, false)

  let balon: Malla | null = null
  if (acc.has("balon")) {
    balon = pieza(geo.esfera, mat("#d9682b", { rugosidad: 0.7 }), raiz, [0.25 * s, 0.6 * s, 0.25 * s], [0.12 * s, 0.12 * s, 0.12 * s])
  }

  // Anillo de selección a los pies
  const anilloMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, depthWrite: false })
  const anilloGeo = new THREE.RingGeometry(0.42 * s, 0.5 * s, 40)
  anilloGeo.rotateX(-Math.PI / 2)
  propias.push(anilloMat, anilloGeo)
  const anillo = new THREE.Mesh(anilloGeo, anilloMat)
  anillo.position.y = 0.02
  anillo.visible = false
  raiz.add(anillo)

  // Brillo del holograma: un halo y partículas que suben
  let particulas: THREE.Points | null = null
  if (holo && mHolo) {
    const n = 40
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.sin(i * 12.9898) * 0.5) * 0.4 * s
      pos[i * 3 + 1] = ((i * 0.618) % 1) * altura
      pos[i * 3 + 2] = (Math.cos(i * 78.233) * 0.5) * 0.4 * s
    }
    const gP = new THREE.BufferGeometry()
    gP.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const mP = new THREE.PointsMaterial({ color: ap.ropa.color, size: 0.035 * s, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
    propias.push(gP, mP)
    particulas = new THREE.Points(gP, mP)
    raiz.add(particulas)
  }

  // Punto sobre la cabeza para etiquetas y burbujas
  const cabeza = new THREE.Object3D()
  cabeza.position.y = altura + altoSombrero + 0.25
  raiz.add(cabeza)

  // ── Animación ────────────────────────────────────────────────
  const fase0 = (p.id.length * 1.37) % (Math.PI * 2)
  let fase = fase0
  let t = fase0 * 3
  let mirar = 0
  let mirarObjetivo = 0
  let proximoVistazo = 2
  const zancada = 1.45 * s // metros por ciclo completo de pasos

  // Objetivos suavizados de cada articulación
  const obj = { cadI: 0, cadD: 0, rodI: 0, rodD: 0, homI: 0, homD: 0, codoI: 0, codoD: 0, homIz: 0, homDz: 0, torsoX: 0, cuerpoY: 0, cuelloX: 0, cuerpoRotX: 0 }
  const act = { ...obj }
  const suave = (k: keyof typeof obj, dt: number, vel = 10) => {
    act[k] += (obj[k] - act[k]) * Math.min(1, dt * vel)
  }

  function animar(estado: EstadoCuerpo, dt: number, velocidad: number) {
    t += dt
    const v = Math.max(0, velocidad || 0)
    for (const k of Object.keys(obj) as Array<keyof typeof obj>) obj[k] = 0
    obj.homIz = 0.08
    obj.homDz = -0.08

    // Vistazos ocasionales cuando está quieto
    proximoVistazo -= dt
    if (proximoVistazo <= 0) {
      mirarObjetivo = estado === "quieto" ? (Math.sin(t * 7.13) * 0.6) : 0
      proximoVistazo = 2 + ((Math.sin(t * 3.7) + 1) * 2)
    }
    mirar += (mirarObjetivo - mirar) * Math.min(1, dt * 3)

    let bote = 0
    switch (estado) {
      case "camina":
      case "corre": {
        const corre = estado === "corre" || v > 2.6
        const pasos = v > 0.05 ? v : corre ? 3.5 : 1.4
        fase += (pasos / zancada) * Math.PI * 2 * dt
        const amp = corre ? 0.85 : 0.5
        const sf = Math.sin(fase)
        obj.cadI = sf * amp
        obj.cadD = -sf * amp
        obj.rodI = Math.max(0, -Math.cos(fase)) * (corre ? 1.4 : 0.7)
        obj.rodD = Math.max(0, Math.cos(fase)) * (corre ? 1.4 : 0.7)
        obj.homI = -sf * (corre ? 0.9 : 0.45)
        obj.homD = sf * (corre ? 0.9 : 0.45)
        obj.codoI = corre ? -1.3 : -0.25
        obj.codoD = corre ? -1.3 : -0.25
        obj.torsoX = corre ? 0.18 : 0.03
        bote = Math.abs(Math.cos(fase)) * (corre ? 0.06 : 0.025) * s
        break
      }
      case "sentado": {
        obj.cadI = obj.cadD = -1.45
        obj.rodI = obj.rodD = 1.45
        obj.cuerpoY = -0.47 * s
        obj.homI = obj.homD = -0.75
        obj.codoI = -0.9 + Math.sin(t * 9) * 0.06
        obj.codoD = -0.9 + Math.sin(t * 9 + 1.3) * 0.06
        obj.torsoX = 0.08
        obj.cuelloX = 0.15
        break
      }
      case "habla": {
        obj.homI = -0.35 + Math.sin(t * 2.3) * 0.25
        obj.homD = -0.55 + Math.sin(t * 2.9 + 1) * 0.35
        obj.codoI = -0.9 + Math.sin(t * 3.1) * 0.25
        obj.codoD = -1.1 + Math.sin(t * 2.6 + 0.5) * 0.3
        obj.homIz = 0.25
        obj.homDz = -0.3
        obj.cuelloX = Math.sin(t * 3.4) * 0.06
        break
      }
      case "duerme": {
        obj.cuelloX = 0.5
        obj.torsoX = 0.2
        obj.homI = obj.homD = 0.1
        break
      }
      case "deporte": {
        if (balon) {
          // Dribleo: el balón rebota al costado
          fase += dt * 7
          obj.homD = -0.7
          obj.codoD = -0.6 + Math.sin(fase) * 0.4
          obj.cadI = 0.25
          obj.cadD = -0.25
          obj.rodI = obj.rodD = 0.35
          obj.cuerpoY = -0.05 * s
        } else {
          // Golpes de boxeo y saltos cortos
          fase += dt * 6
          const g = Math.sin(fase)
          obj.homI = -1.3 + Math.max(0, g) * -0.4
          obj.homD = -1.3 + Math.max(0, -g) * -0.4
          obj.codoI = -1.8 + Math.max(0, g) * 1.5
          obj.codoD = -1.8 + Math.max(0, -g) * 1.5
          obj.cadI = 0.2
          obj.cadD = -0.2
          obj.rodI = obj.rodD = 0.3
          bote = Math.abs(Math.sin(fase * 0.5)) * 0.05 * s
        }
        break
      }
      case "ascensor":
      case "quieto":
      default:
        break
    }

    for (const k of Object.keys(obj) as Array<keyof typeof obj>) suave(k, dt, estado === "camina" || estado === "corre" ? 16 : 8)

    piernas[0].cad.rotation.x = act.cadI
    piernas[1].cad.rotation.x = act.cadD
    piernas[0].rod.rotation.x = act.rodI
    piernas[1].rod.rotation.x = act.rodD
    brazos[0].hom.rotation.x = act.homI
    brazos[1].hom.rotation.x = act.homD
    brazos[0].hom.rotation.z = act.homIz
    brazos[1].hom.rotation.z = act.homDz
    brazos[0].codo.rotation.x = act.codoI
    brazos[1].codo.rotation.x = act.codoD
    torso.rotation.x = act.torsoX
    const respira = estado === "quieto" || estado === "habla" || estado === "duerme" ? Math.sin(t * 1.6) * 0.012 : 0
    torso.scale.set(1, 1 + respira, 1 + respira * 0.6)
    cuello.rotation.x = act.cuelloX
    cuello.rotation.y = mirar
    cuerpo.position.y = act.cuerpoY + bote

    if (balon) {
      if (estado === "deporte") {
        balon.visible = true
        balon.position.set(0.28 * s, 0.12 * s + Math.abs(Math.sin(fase)) * 0.55 * s, 0.32 * s)
      } else {
        balon.visible = estado !== "sentado" && estado !== "duerme" && estado !== "ascensor"
        balon.position.set(0.24 * s, 0.62 * s, 0.18 * s)
      }
    }

    if (mHolo) {
      const em = mHolo.emissiveMap
      if (em) em.offset.y = (em.offset.y - dt * 0.6) % 1
      mHolo.opacity = 0.56 + Math.sin(t * 13) * 0.03 + (Math.sin(t * 0.7) > 0.97 ? -0.25 : 0)
    }
    if (particulas) {
      const pos = particulas.geometry.getAttribute("position") as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.35
        if (y > altura) y = 0
        pos.setY(i, y)
      }
      pos.needsUpdate = true
    }
  }

  function resaltar(on: boolean) {
    anillo.visible = on
  }

  function dispose() {
    raiz.removeFromParent()
    for (const x of propias) x.dispose()
  }

  // Sombra de contacto suave bajo los pies (barata, ayuda a que no floten)
  const sombraMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: holo ? 0.12 : 0.28, depthWrite: false })
  const sombraGeo = new THREE.CircleGeometry(0.32 * s * ancho, 24)
  sombraGeo.rotateX(-Math.PI / 2)
  propias.push(sombraMat, sombraGeo)
  const sombraContacto = new THREE.Mesh(sombraGeo, sombraMat)
  sombraContacto.position.y = 0.012
  sombraContacto.renderOrder = -1
  raiz.add(sombraContacto)

  animar("quieto", 0, 0)
  void torsoMalla
  return { raiz, altura, cabeza, animar, resaltar, dispose }
}
