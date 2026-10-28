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
 * Hebras de pelo: gris (el color lo da el material) y alfa por hebra. Las
 * hebras corren a lo largo de v. El alfa de cada hebra es distinto, así el
 * borde que se desvanece con el color del vértice queda deshilachado.
 */
export function texPelo(): THREE.Texture {
  return una("pelo", () => {
    const n = 256
    const rnd = azar(97)
    const brillo = new Float32Array(n)
    const alfa = new Float32Array(n)
    const fase = new Float32Array(n)
    for (let x = 0; x < n; x++) {
      // Fase propia de cada hebra: sin el patrón en zigzag de una fase lineal.
      fase[x] = rnd() * Math.PI * 2
      brillo[x] = 0.72 + rnd() * 0.28
      // Alfa por hebra repartido: con alfa del vértice 1 quedan huecos entre hebras
      // (las capas de afuera se ven sueltas); con alfa > 2 la capa es opaca.
      alfa[x] = 0.22 + rnd() * 0.78
    }
    const largo = fbm(n, 64, 3, 3, 101)
    const px = new Uint8ClampedArray(n * n * 4)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x
        // Hebra que ondula un poco a lo largo.
        const xo = (x + Math.round(Math.sin((y / n) * Math.PI * 4 + fase[x]) * 1.2) + n) % n
        const b = brillo[xo] * (0.75 + 0.25 * largo[i])
        const a = alfa[xo] * (0.72 + 0.28 * largo[i])
        const o = i * 4
        px[o] = px[o + 1] = px[o + 2] = Math.min(255, b * 255)
        px[o + 3] = Math.min(255, a * 255)
      }
    }
    const t = textura(n, px, { color: true, anisotropia: ANISO })
    return t
  })
}

/**
 * Pelo rizado: bucles apretados (discos con su brillo y una espiral oscura)
 * sobre un fondo casi transparente. Con las capas de afuera casi opacas, la
 * silueta queda hecha de bucles —no de hebras sueltas— y el interior de la
 * mata se lee como rizos (Marco Aurelio, Sócrates, Karp, Amodei).
 * Se repite en u y v (sin costuras).
 */
export function texRizos(): THREE.Texture {
  return una("rizos", () => {
    const n = 256
    const rnd = azar(211)
    const L = new Float32Array(n * n).fill(0.45)
    const A = new Float32Array(n * n).fill(0.14)
    const hondo = new Float32Array(n * n).fill(-1)
    for (let c = 0; c < 240; c++) {
      const cx = rnd() * n
      const cy = rnd() * n
      const r = 8 + rnd() * 6
      const fase = rnd() * 6.28
      const z0 = rnd()
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          const d = Math.hypot(dx, dy) / r
          if (d > 1) continue
          const x = (Math.floor(cx + dx) % n + n) % n
          const y = (Math.floor(cy + dy) % n + n) % n
          const i = y * n + x
          // Cada bucle tapa a los de abajo (el de "z" mayor queda arriba).
          const zz = z0 + (1 - d) * 0.6
          if (zz < hondo[i]) continue
          hondo[i] = zz
          // Bola iluminada desde arriba a la izquierda, con una espiral más oscura.
          const nz = Math.sqrt(Math.max(0, 1 - d * d))
          const luz = Math.max(0, (-dx / r) * 0.45 + (-dy / r) * 0.55 + nz * 0.7)
          const espiral = 0.86 + 0.14 * Math.cos(Math.atan2(dy, dx) * 2 + d * 9 + fase)
          L[i] = (0.66 + 0.34 * luz) * espiral * (0.85 + 0.15 * (1 - d))
          A[i] = d < 0.82 ? 1 : 1 - (d - 0.82) / 0.18
        }
      }
    }
    const px = new Uint8ClampedArray(n * n * 4)
    for (let i = 0; i < n * n; i++) {
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = Math.min(255, L[i] * 255)
      px[i * 4 + 3] = Math.min(255, A[i] * 255)
    }
    const t = textura(n, px, { color: true, anisotropia: ANISO })
    // Las UV del pelo dan ~7 x 11 cm por vuelta de textura: así cada bucle mide ~1,5–2 cm.
    t.repeat.set(0.4, 0.55)
    return t
  })
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
 */
export function texArrugas(): THREE.Texture {
  return una("arrugas", () => {
    const n = 256
    const R = new Float32Array(n * n)
    const G = new Float32Array(n * n)
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
    const px = new Uint8ClampedArray(n * n * 4)
    for (let i = 0; i < n * n; i++) {
      px[i * 4] = Math.min(255, R[i] * (0.8 + 0.4 * ruido[i]) * 255)
      px[i * 4 + 1] = Math.min(255, G[i] * 255)
      px[i * 4 + 2] = 0
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
