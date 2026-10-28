// ──────────────────────────────────────────────────────────────
// Ruido periódico y utilidades para las texturas procedurales.
//
// Todo se genera en el navegador (nada de imágenes externas) y "da la vuelta"
// en los bordes: una textura repetida no muestra costuras. Los campos son
// Float32Array de n x n con valores 0..1.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"

export type Campo = Float32Array

/** Generador pseudoaleatorio determinista (mulberry32): la misma semilla da la misma textura. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Ruido fractal de valor, periódico. `fx` y `fy` son las celdas de la rejilla
 * en cada eje en la primera octava (enteros: así la textura se repite sin
 * costura). Con fx != fy el grano se estira (vetas, cepillado, corteza).
 */
export function fbm(n: number, fx: number, fy: number, octavas: number, semilla: number, ganancia = 0.5): Campo {
  const out = new Float32Array(n * n)
  let amp = 1
  let total = 0
  for (let o = 0; o < octavas; o++) {
    const cx = fx * (1 << o)
    const cy = fy * (1 << o)
    if (cx > n || cy > n) break
    const rnd = azar(semilla * 7919 + o * 1013 + 17)
    const rej = new Float32Array(cx * cy)
    for (let i = 0; i < rej.length; i++) rej[i] = rnd()
    const kx = cx / n
    const ky = cy / n
    for (let y = 0; y < n; y++) {
      const gy = y * ky
      const iy = Math.floor(gy)
      let ty = gy - iy
      ty = ty * ty * (3 - 2 * ty)
      const r0 = (iy % cy) * cx
      const r1 = ((iy + 1) % cy) * cx
      const fila = y * n
      for (let x = 0; x < n; x++) {
        const gx = x * kx
        const ix = Math.floor(gx)
        let tx = gx - ix
        tx = tx * tx * (3 - 2 * tx)
        const x0 = ix % cx
        const x1 = (ix + 1) % cx
        const a = rej[r0 + x0]
        const b = rej[r0 + x1]
        const c = rej[r1 + x0]
        const d = rej[r1 + x1]
        const ab = a + (b - a) * tx
        const cd = c + (d - c) * tx
        out[fila + x] += amp * (ab + (cd - ab) * ty)
      }
    }
    total += amp
    amp *= ganancia
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return normalizar(out)
}

/** Lleva un campo al rango 0..1 (el ruido de valor sale concentrado cerca de 0,5). */
export function normalizar(c: Campo): Campo {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < c.length; i++) {
    if (c[i] < min) min = c[i]
    if (c[i] > max) max = c[i]
  }
  const k = max > min ? 1 / (max - min) : 0
  for (let i = 0; i < c.length; i++) c[i] = (c[i] - min) * k
  return c
}

/**
 * Ruido celular (Worley) periódico: un punto por celda de una rejilla f x f.
 * Devuelve la distancia al punto más cercano (f1, 0..~1 en unidades de celda),
 * la diferencia con el segundo (borde entre piedras/hojas) y el id de la celda.
 */
export function celdas(n: number, f: number, semilla: number): { f1: Campo; borde: Campo; id: Float32Array } {
  const rnd = azar(semilla * 31 + 5)
  const px = new Float32Array(f * f)
  const py = new Float32Array(f * f)
  const val = new Float32Array(f * f)
  for (let i = 0; i < f * f; i++) {
    px[i] = 0.15 + rnd() * 0.7
    py[i] = 0.15 + rnd() * 0.7
    val[i] = rnd()
  }
  const f1 = new Float32Array(n * n)
  const borde = new Float32Array(n * n)
  const id = new Float32Array(n * n)
  const k = f / n
  for (let y = 0; y < n; y++) {
    const gy = (y + 0.5) * k
    const cy = Math.floor(gy)
    for (let x = 0; x < n; x++) {
      const gx = (x + 0.5) * k
      const cx = Math.floor(gx)
      let d1 = 9
      let d2 = 9
      let mejor = 0
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const ix = (((cx + ox) % f) + f) % f
          const iy = (((cy + oy) % f) + f) % f
          const j = iy * f + ix
          const dx = cx + ox + px[j] - gx
          const dy = cy + oy + py[j] - gy
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < d1) {
            d2 = d1
            d1 = d
            mejor = j
          } else if (d < d2) d2 = d
        }
      }
      const i = y * n + x
      f1[i] = d1
      borde[i] = d2 - d1
      id[i] = val[mejor]
    }
  }
  return { f1, borde, id }
}

/** Mapa de normales (espacio tangente, convención OpenGL) desde un campo de alturas. */
export function normalDesdeAltura(n: number, h: Campo, fuerza: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * n * 4)
  for (let y = 0; y < n; y++) {
    const ya = ((y - 1 + n) % n) * n
    const yb = ((y + 1) % n) * n
    const fila = y * n
    for (let x = 0; x < n; x++) {
      const xa = (x - 1 + n) % n
      const xb = (x + 1) % n
      const dx = (h[fila + xb] - h[fila + xa]) * fuerza
      // En el lienzo la y crece hacia abajo; en la textura (flipY) la v crece hacia arriba.
      const dy = (h[yb + x] - h[ya + x]) * fuerza
      const nx = -dx
      const ny = dy
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const o = (fila + x) * 4
      out[o] = (nx * inv * 0.5 + 0.5) * 255
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255
      out[o + 2] = (inv * 0.5 + 0.5) * 255
      out[o + 3] = 255
    }
  }
  return out
}

/** Pixeles RGBA a partir de una función por pixel (valores 0..1). */
export function pintar(n: number, fn: (i: number, x: number, y: number, rgb: [number, number, number]) => void): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * n * 4)
  const rgb: [number, number, number] = [0, 0, 0]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      fn(i, x, y, rgb)
      const o = i * 4
      out[o] = rgb[0] * 255
      out[o + 1] = rgb[1] * 255
      out[o + 2] = rgb[2] * 255
      out[o + 3] = 255
    }
  }
  return out
}

/** Escala de grises (para rugosidad: three lee el canal G). */
export function gris(n: number, fn: (i: number) => number): Uint8ClampedArray {
  return pintar(n, (i, _x, _y, rgb) => {
    const v = fn(i)
    rgb[0] = v
    rgb[1] = v
    rgb[2] = v
  })
}

function crearLienzo(ancho: number, alto: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = ancho
  c.height = alto
  return c
}

/** Textura repetible desde pixeles RGBA. `color` = true para mapas de color (sRGB). */
export function textura(
  n: number,
  pixeles: Uint8ClampedArray,
  op: { color: boolean; anisotropia: number; alto?: number },
): THREE.CanvasTexture {
  const alto = op.alto ?? n
  const lienzo = crearLienzo(n, alto)
  const ctx = lienzo.getContext("2d")!
  const datos = ctx.createImageData(n, alto)
  datos.data.set(pixeles)
  ctx.putImageData(datos, 0, 0)
  const t = new THREE.CanvasTexture(lienzo)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.anisotropy = op.anisotropia
  t.colorSpace = op.color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/** Distancia (en pixeles) a la línea de junta más cercana de una grilla periódica. */
export function distanciaJunta(v: number, paso: number): number {
  const r = v % paso
  return Math.min(r, paso - r)
}

export const suave = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
