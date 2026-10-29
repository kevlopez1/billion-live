// ──────────────────────────────────────────────────────────────
// Texturas de los personajes, todas generadas con código (CanvasTexture):
// poros de la piel, tejidos (lana, algodón, mezclilla, lino, punto, cuero),
// hebras de pelo, iris, número de camiseta, balón y sombra de contacto.
//
// Se crean una vez y se comparten entre los 24 personajes (las del iris, una
// por color de ojos). Nunca se liberan en el dispose de un personaje.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { azar, celdas, fbm, normalDesdeAltura, textura } from "./motor-texturas"

const cache = new Map<string, THREE.Texture>()
function una<T extends THREE.Texture>(clave: string, crear: () => T): T {
  let t = cache.get(clave) as T | undefined
  if (!t) {
    t = crear()
    cache.set(clave, t)
  }
  return t
}

const ANISO = 4

/** Poros y arrugas finas de la piel (normal map repetible). */
export function texPielNormal(): THREE.Texture {
  return una("piel-n", () => {
    const n = 256
    const base = fbm(n, 8, 8, 5, 41)
    const fino = fbm(n, 48, 48, 2, 43)
    const { f1 } = celdas(n, 40, 47)
    const { f1: f2 } = celdas(n, 23, 53)
    const h = new Float32Array(n * n)
    for (let i = 0; i < h.length; i++) {
      const poro = Math.exp(-((f1[i] / 0.16) ** 2)) * 0.9 + Math.exp(-((f2[i] / 0.12) ** 2)) * 0.5
      h[i] = base[i] * 0.5 + fino[i] * 0.35 - poro
    }
    return textura(n, normalDesdeAltura(n, h, 2.2), { color: false, anisotropia: ANISO })
  })
}

/** Variación de color fina de la piel (manchas, capilares): multiplica al color base. */
export function texPielColor(): THREE.Texture {
  return una("piel-c", () => {
    const n = 256
    const a = fbm(n, 6, 6, 5, 61)
    const b = fbm(n, 20, 20, 3, 67)
    const px = new Uint8ClampedArray(n * n * 4)
    for (let i = 0; i < n * n; i++) {
      const v = 0.93 + a[i] * 0.06 + (b[i] - 0.5) * 0.04
      const r = v + (a[i] - 0.5) * 0.02
      px[i * 4] = Math.min(255, r * 255)
      px[i * 4 + 1] = Math.min(255, v * 0.995 * 255)
      px[i * 4 + 2] = Math.min(255, v * 0.99 * 255)
      px[i * 4 + 3] = 255
    }
    return textura(n, px, { color: true, anisotropia: ANISO })
  })
}

export type Tejido = "lana" | "algodon" | "mezclilla" | "lino" | "punto" | "cuero" | "seda"

/** Normal map del tejido. Las UV de la ropa van en metros: la textura cubre ~4 cm. */
export function texTela(tipo: Tejido): THREE.Texture {
  return una(`tela-${tipo}`, () => {
    const n = 256
    const h = new Float32Array(n * n)
    const ruido = fbm(n, 16, 16, 4, 71 + tipo.length)
    const fibra = fbm(n, 128, 8, 2, 73)
    const slub = tipo === "mezclilla" ? fbm(n, 4, 64, 1, 79) : fibra
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x
        let v = 0
        switch (tipo) {
          case "lana": {
            // Sarga fina: diagonales de 45° muy juntas, con fibra.
            const d = ((x + y) / n) * 64 * Math.PI * 2
            v = 0.5 + 0.35 * Math.sin(d) + 0.2 * (fibra[i] - 0.5) + 0.25 * (ruido[i] - 0.5)
            break
          }
          case "mezclilla": {
            const d = ((x * 1 + y * 2) / n) * 40 * Math.PI * 2
            v = 0.5 + 0.45 * Math.sin(d) + 0.35 * (slub[i] - 0.5) + 0.2 * (fibra[i] - 0.5)
            break
          }
          case "algodon": {
            // Punto jersey: columnas de "V" muy pequeñas.
            const cx = (x / n) * 48
            const cy = (y / n) * 64
            const fx = cx - Math.floor(cx) - 0.5
            const fy = cy - Math.floor(cy)
            v = 0.5 + 0.4 * Math.cos(Math.abs(fx) * 6 - fy * 3) + 0.25 * (ruido[i] - 0.5)
            break
          }
          case "punto": {
            // Tejido de punto grueso: acanalado vertical con lazadas.
            const cx = (x / n) * 24
            const cy = (y / n) * 32
            const fx = cx - Math.floor(cx) - 0.5
            const fy = cy - Math.floor(cy)
            v = 0.5 + 0.45 * Math.cos(fx * Math.PI * 2) * (0.7 + 0.3 * Math.cos((fy + Math.abs(fx)) * Math.PI * 2)) + 0.2 * (ruido[i] - 0.5)
            break
          }
          case "lino": {
            const a = Math.sin((x / n) * 56 * Math.PI * 2)
            const b = Math.sin((y / n) * 56 * Math.PI * 2)
            v = 0.5 + 0.25 * a * b + 0.35 * (fibra[i] - 0.5) + 0.35 * (ruido[i] - 0.5)
            break
          }
          case "seda": {
            v = 0.5 + 0.15 * Math.sin(((x + y * 0.2) / n) * 90 * Math.PI * 2) + 0.15 * (ruido[i] - 0.5)
            break
          }
          case "cuero": {
            v = ruido[i]
            break
          }
        }
        h[i] = v
      }
    }
    if (tipo === "cuero") {
      const { borde } = celdas(n, 28, 83)
      for (let i = 0; i < h.length; i++) h[i] = h[i] * 0.4 + Math.min(1, borde[i] * 4) * 0.6
    }
    const fuerza = tipo === "punto" ? 2.4 : tipo === "cuero" ? 1.2 : 1.6
    return textura(n, normalDesdeAltura(n, h, fuerza), { color: false, anisotropia: ANISO })
  })
}

/**
 * Telas por capa (una sola textura de 16 capas, compartida por toda la ropa).
 * Cada vértice de la ropa dice su tela (atributo aArr.x) y el shader elige la
 * capa: así un traje, su camisa, la corbata de seda y los zapatos de cuero
 * van en UNA malla y UN material, cada uno con su trama. Por texel: R, G =
 * normal (espacio tangente); B = albedo (×2: 0,5 = sin cambio); A = rugosidad (×2).
 * Cada capa cubre su tamaño físico (TELA_REPETIR, por metro) para que la trama
 * tenga el paso real del tejido: sarga de lana 1,8 mm, mezclilla 2,6 mm, punto 4,5 mm.
 */
export const TELA = {
  lana: 0,
  popelina: 1,
  jersey: 2,
  punto: 3,
  mezclilla: 4,
  lino: 5,
  fieltro: 6,
  seda: 7,
  cuero: 8,
  malla: 9,
  acanalado: 10,
  suela: 11,
  liso: 12,
  macro: 13,
  charol: 14,
  gamuza: 15,
} as const
export type TelaId = (typeof TELA)[keyof typeof TELA]
/** Repeticiones por metro de cada capa (las UV de la ropa van en metros). */
export const TELA_REPETIR = [34.7, 50, 45, 27.8, 24, 24, 16.7, 60, 25, 38, 39, 33, 1, 2, 1, 33]

export function texTelas(): THREE.DataArrayTexture {
  return una("telas", () => {
    // 128 px por capa: alcanza para el paso de cada trama (4 a 16 px por hilo) y se
    // arma en ~1/4 del tiempo que a 256.
    const n = 128
    const capas = 16
    const datos = new Uint8Array(n * n * 4 * capas)
    const h = new Float32Array(n * n)
    const alb = new Float32Array(n * n)
    const rug = new Float32Array(n * n)
    const ruido = fbm(n, 16, 16, 4, 171)
    const fibra = fbm(n, 64, 8, 2, 173)
    const fibraV = fbm(n, 8, 64, 2, 177)
    const grueso = fbm(n, 4, 4, 4, 181)
    const slubH = fbm(n, 6, 64, 2, 179)
    const slubV = fbm(n, 64, 6, 2, 183)
    const TAU = Math.PI * 2
    const fr = (x: number) => x - Math.floor(x)
    for (let c = 0; c < capas; c++) {
      let fuerza = 1.6
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = y * n + x
          const u = x / n
          const v = y / n
          let hv = 0.5
          let a = 1
          let r = 1
          switch (c) {
            case TELA.lana: {
              // Sarga 2/2: diagonales de 45° (16 por capa = 1,8 mm), hilo con fibra y un leve jaspeado.
              const d = fr((u + v) * 16)
              const cresta = 0.5 - 0.5 * Math.cos(d * TAU)
              hv = 0.5 + 0.3 * (cresta - 0.5) + 0.2 * (fibra[i] - 0.5) + 0.15 * (ruido[i] - 0.5)
              a = 1 + 0.05 * (cresta - 0.5) + 0.06 * (ruido[i] - 0.5) + 0.04 * (fibra[i] - 0.5)
              r = 1 - 0.08 * (cresta - 0.5)
              fuerza = 1.4
              break
            }
            case TELA.popelina: {
              // Popelina: trama invisible; quedan el arrugado fino y el brillo parejo del algodón.
              hv = 0.5 + 0.35 * (ruido[i] - 0.5) + 0.15 * (fibra[i] - 0.5) 
              a = 1 + 0.03 * (ruido[i] - 0.5)
              r = 1 + 0.06 * (ruido[i] - 0.5)
              fuerza = 0.9
              break
            }
            case TELA.jersey: {
              // Punto jersey: columnas de "V" de 1,1 mm (20 por capa), filas de 0,8 mm.
              const cx = u * 20
              const cy = v * 28
              const fx = fr(cx) - 0.5
              const fy = fr(cy + Math.abs(fx) * 0.8)
              hv = 0.5 + 0.35 * Math.cos(fx * TAU) * (0.6 + 0.4 * Math.sin(fy * TAU)) + 0.2 * (ruido[i] - 0.5)
              a = 1 + 0.04 * (ruido[i] - 0.5) - 0.05 * (0.5 - 0.5 * Math.cos(fx * TAU))
              r = 1 + 0.05 * (ruido[i] - 0.5)
              fuerza = 1.2
              break
            }
            case TELA.punto: {
              // Suéter: columnas de lazadas en V de 4,5 mm (8 por capa), 10 vueltas.
              const cx = u * 8
              const cy = v * 10
              const k = Math.floor(cx)
              const fx = fr(cx) - 0.5
              // Cada lazada es una "V": dos hojas inclinadas que bajan hacia el centro de la columna.
              const fy = fr(cy + Math.abs(fx) * 0.9)
              const hoja = Math.sin(Math.PI * Math.min(1, Math.abs(fx) * 2.2)) // 0 en el centro y el borde
              const lazo = Math.pow(Math.sin(Math.PI * fy), 0.7)
              hv = 0.25 + 0.55 * hoja * lazo + 0.12 * (fibra[i] - 0.5) + 0.1 * ((k * 0.37) % 1 - 0.5) * 0
              a = 0.86 + 0.18 * hoja * lazo + 0.06 * (grueso[i] - 0.5)
              r = 1
              fuerza = 2.6
              break
            }
            case TELA.mezclilla: {
              // Sarga 3/1 a 62°: el hilo índigo hace la diagonal; la trama blanca asoma en el surco.
              const d = fr(u * 16 + v * 16 * 0.53 + 0.15 * (slubV[i] - 0.5))
              const cresta = Math.pow(0.5 - 0.5 * Math.cos(d * TAU), 0.8)
              hv = 0.5 + 0.4 * (cresta - 0.5) + 0.1 * (slubV[i] - 0.5) + 0.12 * (fibra[i] - 0.5) + 0.15 * (ruido[i] - 0.5)
              // Surco = trama clara (+25 %), cresta = índigo; hilos de urdimbre irregulares (slub vertical).
              a = 1 + 0.26 * (0.5 - cresta) + 0.12 * (slubV[i] - 0.5) + 0.1 * (ruido[i] - 0.5)
              r = 1 + 0.06 * (0.5 - cresta)
              fuerza = 1.8
              break
            }
            case TELA.lino: {
              // Tafetán irregular de 1,3 mm con hilos gruesos (slub) en las dos direcciones.
              const ta = Math.sin(u * 32 * TAU + 2 * (slubH[i] - 0.5))
              const tb = Math.sin(v * 32 * TAU + 2 * (slubV[i] - 0.5))
              const gr = Math.max(0, slubH[i] - 0.62) * 3 + Math.max(0, slubV[i] - 0.62) * 3
              hv = 0.5 + 0.2 * ta * tb + 0.35 * gr + 0.18 * (ruido[i] - 0.5)
              a = 1 + 0.08 * gr - 0.04 * (1 - gr) * 0 + 0.05 * (grueso[i] - 0.5) + 0.03 * ta * tb
              r = 1 + 0.05 * (ruido[i] - 0.5)
              fuerza = 1.5
              break
            }
            case TELA.fieltro: {
              // Paño de lana grueso (mantos, capas, levita, fieltro del sombrero): borra difusa.
              hv = 0.5 + 0.45 * (fibra[i] - 0.5) + 0.45 * (fibraV[i] - 0.5) + 0.3 * (ruido[i] - 0.5)
              a = 1 + 0.07 * (grueso[i] - 0.5) + 0.04 * (fibra[i] - 0.5)
              r = 1 + 0.06 * (ruido[i] - 0.5)
              fuerza = 1.1
              break
            }
            case TELA.seda: {
              // Seda de corbata: sarga fina de 0,7 mm con hilos de brillo distinto.
              const d = fr((u - v) * 24)
              hv = 0.5 + 0.25 * Math.cos(d * TAU) + 0.08 * (fibra[i] - 0.5)
              a = 1 + 0.05 * Math.cos(d * TAU)
              r = 1 - 0.18 * (0.5 + 0.5 * Math.cos(d * TAU)) + 0.1
              fuerza = 1.2
              break
            }
            case TELA.cuero:
            case TELA.gamuza: {
              hv = ruido[i]
              a = 1 + 0.05 * (ruido[i] - 0.5)
              r = 1 + 0.25 * (ruido[i] - 0.5)
              fuerza = 1.1
              break
            }
            case TELA.malla: {
              // Malla de camiseta deportiva: agujeros hexagonales de 2,2 mm (12 por capa).
              const qx = u * 12
              const qy = v * 12 * 1.1547
              const fy0 = fr(qy) - 0.5
              const fx0 = fr(qx + (Math.floor(qy) % 2) * 0.5) - 0.5
              const dd = Math.hypot(fx0, fy0 * 0.9)
              const agujero = 1 - Math.min(1, Math.max(0, (dd - 0.22) / 0.12))
              hv = 0.6 - 0.45 * agujero + 0.1 * (fibra[i] - 0.5)
              a = 1 - 0.22 * agujero
              r = 1 + 0.1 * agujero
              fuerza = 1.8
              break
            }
            case TELA.acanalado: {
              // Canalé 2x2: costillas verticales de 3,2 mm (8 por capa).
              const fx = fr(u * 8)
              const cost = Math.pow(Math.sin(Math.PI * fx), 0.6)
              hv = 0.2 + 0.65 * cost + 0.1 * (fibraV[i] - 0.5) + 0.06 * Math.sin(v * 40 * TAU) * cost
              a = 0.86 + 0.18 * cost
              fuerza = 2.4
              break
            }
            case TELA.suela: {
              hv = 0.5 + 0.5 * (fibra[i] - 0.5) + 0.3 * (ruido[i] - 0.5)
              a = 1 + 0.04 * (ruido[i] - 0.5)
              fuerza = 0.8
              break
            }
            case TELA.macro: {
              // Variación grande (50 cm): la tela no es un degradado perfecto.
              hv = grueso[i]
              a = 1 + 0.08 * (grueso[i] - 0.5) + 0.04 * (ruido[i] - 0.5)
              r = 1 + 0.12 * (ruido[i] - 0.5)
              fuerza = 2.5
              break
            }
            default:
              hv = 0.5
          }
          h[i] = hv
          alb[i] = a
          rug[i] = r
        }
      }
      if (c === TELA.cuero || c === TELA.gamuza) {
        // Grano del cuero: celdas de ~1,5 mm con surcos; la gamuza, un pelo corto parejo.
        const { borde } = celdas(n, c === TELA.cuero ? 26 : 64, 83 + c)
        for (let i = 0; i < h.length; i++) h[i] = c === TELA.cuero ? h[i] * 0.35 + Math.min(1, borde[i] * 4) * 0.65 : 0.5 + 0.5 * (fibra[i] - 0.5) + 0.3 * (fibraV[i] - 0.5)
        if (c === TELA.gamuza) for (let i = 0; i < h.length; i++) rug[i] = 1 + 0.08 * (ruido[i] - 0.5)
      }
      const nor = normalDesdeAltura(n, h, c === TELA.liso || c === TELA.charol ? 0 : fuerza)
      const o0 = c * n * n * 4
      for (let i = 0; i < n * n; i++) {
        datos[o0 + i * 4] = nor[i * 4]
        // (sin flipY: la fila crece con v, al revés que en el lienzo)
        datos[o0 + i * 4 + 1] = 255 - nor[i * 4 + 1]
        datos[o0 + i * 4 + 2] = Math.max(0, Math.min(255, Math.round((alb[i] / 2) * 255)))
        datos[o0 + i * 4 + 3] = Math.max(0, Math.min(255, Math.round((rug[i] / 2) * 255)))
      }
    }
    const t = new THREE.DataArrayTexture(datos, n, n, capas)
    t.format = THREE.RGBAFormat
    t.type = THREE.UnsignedByteType
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = true
    t.anisotropy = ANISO
    t.colorSpace = THREE.NoColorSpace
    t.needsUpdate = true
    return t
  })
}

/**
 * Hebras de pelo: gris (el color lo da el material) y alfa por hebra, agrupadas
 * en MECHONES de 3–8 mm (12–30 hebras de la textura): cada mechón tiene su
 * brillo, su onda y un perfil (el centro más claro y tupido, los bordes más
 * oscuros y ralos), así entre mechón y mechón queda una sombra y el pelo se lee
 * con volumen y no como un cepillado parejo. Las hebras corren a lo largo de v.
 * El brillo de cada mechón también corre la banda del reflejo anisotrópico
 * (matPelo), como en el pelo real, donde cada mechón brilla a otra altura.
 */
export function texPelo(): THREE.Texture {
  return una("pelo", () => {
    const n = 256
    const rnd = azar(97)
    const mech = new Int16Array(n)
    const pos = new Float32Array(n)
    const mb: number[] = []
    const mf: number[] = []
    const ma: number[] = []
    let x = 0
    while (x < n) {
      let w = 12 + Math.floor(rnd() * 19)
      if (n - x - w < 12) w = n - x
      for (let k = 0; k < w; k++) {
        mech[x + k] = mb.length
        pos[x + k] = (k + 0.5) / w
      }
      mb.push(0.86 + rnd() * 0.14)
      mf.push(rnd() * Math.PI * 2)
      ma.push(0.6 + rnd() * 2.2)
      x += w
    }
    const brillo = new Float32Array(n)
    const alfa = new Float32Array(n)
    const fase = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      fase[i] = rnd() * Math.PI * 2
      brillo[i] = 0.8 + rnd() * 0.2
      alfa[i] = 0.3 + rnd() * 0.7
    }
    const largo = fbm(n, 64, 3, 3, 101)
    const px = new Uint8ClampedArray(n * n * 4)
    for (let y = 0; y < n; y++) {
      const fy = (y / n) * Math.PI * 2
      for (let x = 0; x < n; x++) {
        const i = y * n + x
        // El mechón ondula entero (periodo entero: sin costura en v) y cada hebra un poco más.
        const m0 = mech[x]
        const xm = (x + Math.round(Math.sin(fy * 2 + mf[m0]) * ma[m0]) + n) % n
        const xo = (xm + Math.round(Math.sin(fy * 2 + fase[xm]) * 0.8) + n) % n
        const m = mech[xo]
        const perfil = Math.pow(Math.sin(Math.PI * pos[xo]), 0.6)
        const b = mb[m] * (0.76 + 0.24 * perfil) * brillo[xo] * (0.84 + 0.16 * largo[i])
        const a = alfa[xo] * (0.35 + 0.65 * perfil) * (0.78 + 0.3 * largo[i])
        const o = i * 4
        px[o] = px[o + 1] = px[o + 2] = Math.min(255, b * 255)
        px[o + 3] = Math.min(255, a * 255)
      }
    }
    return textura(n, px, { color: true, anisotropia: ANISO })
  })
}

/**
 * Pelo rizado: rizos en forma de C y de O (tubos de hebras que giran), uno
 * encima de otro, sobre un fondo casi transparente. Cada rizo tiene volumen
 * (el centro del tubo más claro), hebras que corren a lo largo del giro y un
 * hueco por el que se ve la capa oscura de abajo. Con las capas de afuera casi
 * opacas, la silueta queda hecha de rizos (Amodei).
 * La dirección de la hebra en cada píxel va en una segunda textura
 * (texRizosDir: rg = dirección en u, v): con ella el reflejo anisotrópico sigue
 * el giro de cada rizo. Se repite en u y v (sin costuras).
 */
function rizosDatos(): { col: THREE.Texture; dir: THREE.Texture } {
  const n = 256
  const rnd = azar(211)
  const L = new Float32Array(n * n).fill(0.4)
  const A = new Float32Array(n * n).fill(0.1)
  const DX = new Float32Array(n * n).fill(0)
  const DY = new Float32Array(n * n).fill(1)
  const hondo = new Float32Array(n * n).fill(-1)
  for (let c = 0; c < 900; c++) {
    const cx = rnd() * n
    const cy = rnd() * n
    const r = 5.5 + rnd() * 5
    const a0 = rnd() * Math.PI * 2
    // Arco: de una C abierta a una O casi cerrada; elipse girada (ningún rizo es un círculo).
    const tramo = 3.6 + rnd() * 2.6
    const fase = rnd() * 6.28
    const z0 = rnd()
    const giro = rnd() < 0.5 ? 1 : -1
    const rot = rnd() * Math.PI
    const cr = Math.cos(rot)
    const sr = Math.sin(rot)
    const asp = 0.65 + rnd() * 0.5
    const tono = 0.78 + rnd() * 0.22
    const R = Math.ceil(r * 1.2)
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        // Coordenadas del rizo (girado y achatado).
        const lx = dx * cr + dy * sr
        const ly = (-dx * sr + dy * cr) / asp
        const d = Math.hypot(lx, ly) / r
        if (d > 1 || d < 0.3) continue
        let ang = Math.atan2(ly, lx) - a0
        ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        if (ang > tramo) continue
        // Puntas del arco afinadas.
        const punta = Math.min(1, ang / 0.7, (tramo - ang) / 0.5)
        const w = (d - 0.3) / 0.7
        const tubo = Math.sin(Math.PI * w)
        if (tubo < 1 - punta) continue
        const x = (Math.floor(cx + dx) % n + n) % n
        const y = (Math.floor(cy + dy) % n + n) % n
        const i = y * n + x
        // El tubo más alto tapa a los de abajo.
        const zz = z0 + tubo * 0.35
        if (zz < hondo[i]) continue
        hondo[i] = zz
        // Luz de arriba sobre el tubo, hebras a lo largo del giro.
        const k = Math.cos(Math.PI * w) / (d * r + 1e-6)
        const luz = 0.5 + 0.5 * Math.max(-1, Math.min(1, -dy * k * 0.6 - dx * k * 0.25 + tubo * 0.6))
        const hebra = 0.86 + 0.14 * Math.sin(d * r * 2.6 + fase)
        L[i] = (0.62 + 0.38 * luz) * (0.72 + 0.28 * tubo) * hebra * tono
        A[i] = Math.min(1, tubo * 2.2) * Math.min(1, punta * 1.5)
        // Tangente al giro (de vuelta al lienzo) en u y v (la fila 0 del lienzo es v = 1: la y se invierte).
        const tx = -ly
        const ty = lx * asp
        const gx = tx * cr - ty * sr
        const gy = tx * sr + ty * cr
        const t = Math.hypot(gx, gy) + 1e-6
        DX[i] = (gx / t) * giro
        DY[i] = (-gy / t) * giro
      }
    }
  }
  const px = new Uint8ClampedArray(n * n * 4)
  const pd = new Uint8ClampedArray(n * n * 4)
  for (let i = 0; i < n * n; i++) {
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = Math.min(255, L[i] * 255)
    px[i * 4 + 3] = Math.min(255, A[i] * 255)
    pd[i * 4] = Math.round((DX[i] * 0.5 + 0.5) * 255)
    pd[i * 4 + 1] = Math.round((DY[i] * 0.5 + 0.5) * 255)
    pd[i * 4 + 2] = 128
    pd[i * 4 + 3] = 255
  }
  const col = textura(n, px, { color: true, anisotropia: ANISO })
  const dir = textura(n, pd, { color: false, anisotropia: ANISO })
  // Las UV del pelo dan ~7 x 11 cm por vuelta de textura: así cada rizo mide ~1,5–2 cm.
  col.repeat.set(0.4, 0.55)
  dir.repeat.set(0.4, 0.55)
  return { col, dir }
}

let rizosHechos: { col: THREE.Texture; dir: THREE.Texture } | null = null
export function texRizos(): THREE.Texture {
  return una("rizos", () => (rizosHechos ??= rizosDatos()).col)
}
/** Dirección de la hebra en cada rizo (rg en 0..1 = -1..1 en u y v), alineada con texRizos. */
export function texRizosDir(): THREE.Texture {
  return una("rizos-dir", () => (rizosHechos ??= rizosDatos()).dir)
}

/** Ojo: iris y esclerótica en coordenadas polares (fila = ángulo desde el frente). */
export function texOjo(iris: string, esclera = "#ece6de"): THREE.Texture {
  return una(`ojo-${iris}-${esclera}`, () => {
    const n = 128
    const c = new THREE.Color(iris)
    const e = new THREE.Color(esclera)
    const ER = e.r * 255, EG = e.g * 255, EB = e.b * 255
    const rnd = azar(131)
    const fib = new Float32Array(n)
    for (let x = 0; x < n; x++) fib[x] = rnd()
    const vena = fbm(n, 12, 4, 3, 137)
    const px = new Uint8ClampedArray(n * n * 4)
    const R = c.r * 255, G = c.g * 255, B = c.b * 255
    for (let y = 0; y < n; y++) {
      const ang = ((y + 0.5) / n) * Math.PI // 0 = centro de la pupila
      for (let x = 0; x < n; x++) {
        const o = (y * n + x) * 4
        let r: number, g: number, b: number
        if (ang < 0.16) {
          r = g = b = 6
        } else if (ang < 0.52) {
          // Iris: fibras radiales, aro claro junto a la pupila, borde oscuro.
          const t = (ang - 0.16) / 0.36
          const f = 0.7 + 0.5 * (fib[x] * 0.6 + fib[(x + 1) % n] * 0.4) - 0.15
          const collar = Math.exp(-(((t - 0.22) / 0.1) ** 2)) * 0.35
          const borde = Math.max(0, (t - 0.78) / 0.22)
          const k = (f + collar) * (1 - borde * 0.75)
          r = R * k + 12 * collar
          g = G * k + 8 * collar
          b = B * k
        } else if (ang < 0.58) {
          // Anillo limbal: transición suave a la esclerótica.
          const t = (ang - 0.52) / 0.06
          r = 40 + t * (ER - 56)
          g = 34 + t * (EG - 58)
          b = 32 + t * (EB - 57)
        } else {
          const t = Math.min(1, (ang - 0.58) / 1.6)
          const v = vena[y * n + x]
          const rojo = Math.max(0, v - 0.62) * 2.4 * t
          r = ER - t * 10
          g = EG - t * 26 - rojo * 70
          b = EB - t * 30 - rojo * 70
        }
        px[o] = r
        px[o + 1] = g
        px[o + 2] = b
        px[o + 3] = 255
      }
    }
    const t = textura(n, px, { color: true, anisotropia: ANISO })
    t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

/**
 * Arrugas y pliegues de la cara en un mapa canónico (u por el ancho de la
 * cara, v de mentón a frente: mentón 0,1 · boca 0,3 · nariz 0,45 · ojos 0,68).
 * R = profundidad de las arrugas de la edad (frente, entrecejo, patas de
 * gallo, bajo los ojos, surcos nasogenianos, líneas de marioneta).
 * G = hoyuelo del mentón partido. La piel las usa como relieve y sombra.
 * B = la línea entre los labios (en todos, sin edad): la boca cae justo en v = 0,3
 * y una línea de 1 mm no entra en los colores por vértice (filas cada 3–8 mm).
 */
export function texArrugas(): THREE.Texture {
  return una("arrugas", () => {
    const n = 256
    const R = new Float32Array(n * n)
    const G = new Float32Array(n * n)
    const B = new Float32Array(n * n)
    const ruido = fbm(n, 12, 12, 3, 211)
    // Suma una línea (segmento curvo muestreado) con un ancho en píxeles.
    const linea = (dst: Float32Array, pts: Array<[number, number]>, ancho: number, prof: number) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [u0, v0] = pts[k]
        const [u1, v1] = pts[k + 1]
        const x0 = u0 * n, y0 = (1 - v0) * n, x1 = u1 * n, y1 = (1 - v1) * n
        const minx = Math.max(0, Math.floor(Math.min(x0, x1) - ancho * 3)), maxx = Math.min(n - 1, Math.ceil(Math.max(x0, x1) + ancho * 3))
        const miny = Math.max(0, Math.floor(Math.min(y0, y1) - ancho * 3)), maxy = Math.min(n - 1, Math.ceil(Math.max(y0, y1) + ancho * 3))
        const dx = x1 - x0, dy = y1 - y0
        const l2 = dx * dx + dy * dy || 1
        // Se afina hacia las puntas de la línea entera.
        const t0 = k / (pts.length - 1), t1 = (k + 1) / (pts.length - 1)
        for (let y = miny; y <= maxy; y++) {
          for (let x = minx; x <= maxx; x++) {
            const t = Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / l2))
            const px = x0 + dx * t - x, py = y0 + dy * t - y
            const d = Math.sqrt(px * px + py * py)
            const tg = t0 + (t1 - t0) * t
            const punta = Math.sin(Math.PI * Math.min(1, Math.max(0, tg))) ** 0.6
            const v = prof * punta * Math.exp(-((d / ancho) ** 2))
            const i = y * n + x
            if (v > dst[i]) dst[i] = v
          }
        }
      }
    }
    const curva = (f: (t: number) => [number, number], m = 12) => Array.from({ length: m + 1 }, (_, i) => f(i / m))
    for (const lado of [-1, 1]) {
      const U = (du: number) => 0.5 + lado * du
      // Patas de gallo: abanico desde el rabillo del ojo.
      for (const [ang, largo, p] of [[-0.45, 0.055, 0.7], [-0.12, 0.065, 0.9], [0.22, 0.06, 0.8], [0.55, 0.045, 0.55]] as const) {
        linea(R, curva((t) => [U(0.3 + Math.cos(ang) * largo * t), 0.685 + Math.sin(ang) * largo * t * 1.4 - 0.006 * t * t], 6), 1.1, p)
      }
      // Bajo el ojo: un arco que cuelga.
      linea(R, curva((t) => [U(0.13 + 0.17 * t), 0.636 - 0.018 * Math.sin(Math.PI * t) + 0.012 * t]), 1.4, 0.55)
      // Surco nasogeniano: del ala de la nariz a la comisura y un poco más.
      linea(R, curva((t) => [U(0.095 + 0.085 * t + 0.01 * Math.sin(Math.PI * t)), 0.455 - 0.2 * t]), 2.2, 1)
      // Marioneta: de la comisura hacia el mentón.
      linea(R, curva((t) => [U(0.168 - 0.01 * t), 0.275 - 0.11 * t]), 1.6, 0.6)
      // Entrecejo
      linea(R, curva((t) => [U(0.03 + 0.006 * t), 0.73 + 0.06 * t], 4), 1.1, 0.8)
    }
    // Frente: tres líneas largas, onduladas.
    for (const [v, p] of [[0.81, 0.75], [0.848, 1], [0.886, 0.8]] as const) {
      linea(R, curva((t) => [0.24 + 0.52 * t, v + 0.008 * Math.sin(t * Math.PI) + 0.004 * Math.sin(t * 17 + v * 50)], 24), 1.3, p)
    }
    // Hoyuelo del mentón.
    linea(G, curva((t) => [0.5, 0.125 + 0.075 * t], 4), 2.6, 1)
    // Línea de la boca: de comisura a comisura (u ±0,16 con la boca media).
    linea(B, curva((t) => [0.335 + 0.33 * t, 0.3], 16), 1.3, 1)
    const px = new Uint8ClampedArray(n * n * 4)
    for (let i = 0; i < n * n; i++) {
      px[i * 4] = Math.min(255, R[i] * (0.8 + 0.4 * ruido[i]) * 255)
      px[i * 4 + 1] = Math.min(255, G[i] * 255)
      px[i * 4 + 2] = Math.min(255, B[i] * 255)
      px[i * 4 + 3] = 255
    }
    const t = textura(n, px, { color: false, anisotropia: ANISO })
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

/**
 * Número de camiseta. La esquina superior izquierda es blanca y opaca: ahí
 * apunta la uv1 de toda la ropa; el número vive en el resto con fondo
 * transparente (la ropa usa alphaTest).
 */
export function texNumero(numero: string, relleno: string, borde: string): THREE.Texture {
  return una(`num-${numero}-${relleno}-${borde}`, () => {
    const n = 256
    const c = document.createElement("canvas")
    c.width = n
    c.height = n
    const g = c.getContext("2d")!
    g.clearRect(0, 0, n, n)
    g.fillStyle = "#ffffff"
    g.fillRect(0, 0, 20, 20)
    g.font = "900 168px 'Arial Black', 'Bricolage Grotesque', Impact, sans-serif"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.lineJoin = "round"
    g.lineWidth = 22
    g.strokeStyle = "#ffffff"
    g.strokeText(numero, n / 2 + 6, n / 2 + 10)
    g.lineWidth = 10
    g.strokeStyle = borde
    g.strokeText(numero, n / 2 + 6, n / 2 + 10)
    g.fillStyle = relleno
    g.fillText(numero, n / 2 + 6, n / 2 + 10)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = ANISO
    t.channel = 1
    return t
  })
}

/** Balón de básquet: naranja con granos y costuras negras (equirectangular). */
export function texBalon(): THREE.Texture {
  return una("balon", () => {
    const w = 256
    const h = 128
    const grano = fbm(w, 64, 64, 2, 151)
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      const lat = (0.5 - (y + 0.5) / h) * Math.PI
      for (let x = 0; x < w; x++) {
        const lon = ((x + 0.5) / w) * Math.PI * 2
        const o = (y * w + x) * 4
        // Costuras: ecuador, un meridiano completo y dos curvas.
        const dEc = Math.abs(lat)
        const dMer = Math.min(Math.abs(Math.sin(lon)) * Math.cos(lat), 1)
        const curva = Math.abs(Math.cos(lon)) - 0.55 * Math.cos(lat) - 0.2
        const d = Math.min(dEc, dMer, Math.abs(curva) * 0.6)
        const linea = d < 0.03 ? 1 : 0
        const v = 0.85 + grano[(y * 2) * w + x] * 0.25
        px[o] = linea ? 22 : 205 * v
        px[o + 1] = linea ? 16 : 92 * v
        px[o + 2] = linea ? 12 : 38 * v
        px[o + 3] = 255
      }
    }
    return textura(w, px, { color: true, anisotropia: ANISO, alto: h })
  })
}

/** Sombra de contacto: un degradé radial suave. */
export function texSombra(): THREE.Texture {
  return una("sombra", () => {
    const n = 64
    const c = document.createElement("canvas")
    c.width = c.height = n
    const g = c.getContext("2d")!
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
    gr.addColorStop(0, "rgba(0,0,0,1)")
    gr.addColorStop(0.45, "rgba(0,0,0,0.6)")
    gr.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = gr
    g.fillRect(0, 0, n, n)
    const t = new THREE.CanvasTexture(c)
    return t
  })
}

/** Punto de luz redondo y suave (partículas de los hologramas). */
export function texPunto(): THREE.Texture {
  return una("punto", () => {
    const n = 32
    const c = document.createElement("canvas")
    c.width = c.height = n
    const g = c.getContext("2d")!
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
    gr.addColorStop(0, "rgba(255,255,255,1)")
    gr.addColorStop(0.35, "rgba(255,255,255,0.55)")
    gr.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = gr
    g.fillRect(0, 0, n, n)
    return new THREE.CanvasTexture(c)
  })
}
