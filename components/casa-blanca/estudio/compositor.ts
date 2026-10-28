// ──────────────────────────────────────────────────────────────
// EL COMPOSITOR: arma cada cuadro del video en un canvas 2D.
//
// Toma la imagen del canvas WebGL (que renderiza al tamaño exacto de salida)
// y le dibuja encima todo lo demás con canvas 2D, nunca con DOM: así lo que se
// ve en vivo es exactamente lo que graba MediaRecorder y lo que lee el
// renderizador headless.
//
// Medidas: todo se escala con el alto (k = alto / 1080) y nada sale de la
// zona segura (5 % por lado). Los textos se miden: si no entran, se parten en
// líneas y se achica la letra; como último recurso, "…".
//
// "PRIME" nunca se escribe: se dibuja el logo (el mismo archivo que usa
// components/prime-mark.tsx, dentro del chip celeste #31abc4).
// ──────────────────────────────────────────────────────────────

import type { Visor } from "./guion"

export interface Fuentes {
  /** La condensada de la Casa Blanca (cb-cond). */
  cond: string
  /** La de texto (Manrope). */
  texto: string
}

export interface Recursos {
  fuentes: Fuentes
  /** public/logos/prime-wordmark.png (blanco sobre transparente). */
  logoPrime: HTMLImageElement | null
}

export interface DialogoEnCuadro {
  nombre: string
  color: string
  texto: string
  cita: boolean
  alfa: number
  /** Dónde está la cabeza de quien habla, en píxeles del cuadro (null si no se ve). */
  cabeza: { x: number; y: number } | null
}

export interface Capas {
  t: number
  fps: number
  visor: Visor
  /** Negro sobre la escena (0..1): apertura y cierre. */
  velo: number
  /** Temblor de mano (solo visor "camara"). */
  pulso: { dx: number; dy: number; giro: number; escala: number } | null
  titulo: { texto: string; alfa: number } | null
  rotulo: { texto: string; alfa: number } | null
  dialogo: DialogoEnCuadro | null
  /** "CAM 03 · SALA DE GUERRA" (visor "camara"). */
  camara: string | null
  /** Código de tiempo del visor "camara" ("00:00:05:12"). */
  codigo: string | null
  apertura: { alfa: number; subtitulo: string } | null
  cierre: { alfa: number; negro: number } | null
  /** Etiqueta chica de ficción (todo el video menos la apertura y el cierre). */
  ficcion: boolean
}

export const MARCA = "La Casa Blanca Project"
export const WEB = "kevproject.world/casa-blanca"
export const AVISO = "Personajes de ficción hechos con IA. No son las personas reales ni hablan por ellas."
export const ETIQUETA_FICCION = "Ficción hecha con IA"

const CELESTE_PRIME = "#31abc4"
const PRIME_RATIO = 600 / 107

// ── Texto con el logo de PRIME ────────────────────────────────

type Segmento = { tipo: "texto"; s: string } | { tipo: "logo" }
interface Palabra {
  segs: Segmento[]
  ancho: number
}
interface Estilo {
  familia: string
  peso: number | string
  tam: number
  /** Espaciado entre letras en em. */
  espaciado?: number
  italica?: boolean
}

const fuenteCss = (e: Estilo) => `${e.italica ? "italic " : ""}${e.peso} ${e.tam}px ${e.familia}`

function aplicarEstilo(ctx: CanvasRenderingContext2D, e: Estilo) {
  ctx.font = fuenteCss(e)
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ("letterSpacing" in c) c.letterSpacing = `${((e.espaciado ?? 0) * e.tam).toFixed(2)}px`
}

const chip = (tam: number) => {
  const alto = 0.62 * tam
  const ancho = alto * PRIME_RATIO
  const padX = 0.4 * tam
  const padY = 0.14 * tam
  return { img: { ancho, alto }, ancho: ancho + 2 * padX, alto: alto + 2 * padY, padX, padY }
}

/** "Hola PRIME." → [texto "Hola"], [logo, texto "."] (por palabra; límite de palabra como conPrime). */
function trocear(texto: string): Segmento[][] {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split(/\b(PRIME)\b/g)
        .filter((s) => s !== "")
        .map((s): Segmento => (s === "PRIME" ? { tipo: "logo" } : { tipo: "texto", s })),
    )
}

function medirPalabra(ctx: CanvasRenderingContext2D, segs: Segmento[], tam: number): number {
  let a = 0
  segs.forEach((s, i) => {
    a += s.tipo === "logo" ? chip(tam).ancho + (i < segs.length - 1 ? 0.1 : 0.12) * tam : ctx.measureText(s.s).width
  })
  return a
}

export interface Bloque {
  estilo: Estilo
  lineas: Palabra[][]
  anchos: number[]
  /** El ancho de la línea más larga. */
  ancho: number
  interlinea: number
  alto: number
  espacio: number
}

/**
 * Parte el texto en líneas que entran en `ancho` y achica la letra de `max` a
 * `min` hasta que entra en `maxLineas`. Si ni así entra, corta con "…".
 */
/** Reparte las palabras en renglones de `ancho` como máximo (con la letra ya aplicada en ctx). */
function envolver(ctx: CanvasRenderingContext2D, piezas: Segmento[][], tam: number, ancho: number, espacio: number): Palabra[][] {
  const lineas: Palabra[][] = []
  let actual: Palabra[] = []
  let usado = 0
  for (const segs of piezas) {
    let p: Palabra = { segs: [...segs], ancho: medirPalabra(ctx, segs, tam) }
    // Una palabra más ancha que el renglón (raro): se corta por letras.
    while (p.ancho > ancho && p.segs.length === 1 && p.segs[0].tipo === "texto" && p.segs[0].s.length > 1) {
      const s = p.segs[0].s
      let n = s.length - 1
      while (n > 1 && ctx.measureText(s.slice(0, n)).width > ancho) n--
      if (actual.length) lineas.push(actual)
      lineas.push([{ segs: [{ tipo: "texto", s: s.slice(0, n) }], ancho: ctx.measureText(s.slice(0, n)).width }])
      actual = []
      usado = 0
      p = { segs: [{ tipo: "texto", s: s.slice(n) }], ancho: ctx.measureText(s.slice(n)).width }
    }
    const nuevo = actual.length ? usado + espacio + p.ancho : p.ancho
    if (actual.length && nuevo > ancho) {
      lineas.push(actual)
      actual = [p]
      usado = p.ancho
    } else {
      actual.push(p)
      usado = nuevo
    }
  }
  if (actual.length) lineas.push(actual)
  return lineas
}

/**
 * Parte el texto en líneas que entran en `ancho` y achica la letra de `max` a
 * `min` hasta que entra en `maxLineas`. Si ni así entra, corta con "…".
 * Con dos líneas o más, las equilibra: sin una palabra sola colgando abajo.
 */
export function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  base: Omit<Estilo, "tam">,
  op: { max: number; min: number; ancho: number; maxLineas: number; interlinea?: number },
): Bloque {
  const piezas = trocear(texto)
  const inter = op.interlinea ?? 1.18
  let tam = op.max
  for (;;) {
    const estilo: Estilo = { ...base, tam }
    aplicarEstilo(ctx, estilo)
    const espacio = ctx.measureText(" ").width
    let lineas = envolver(ctx, piezas, tam, op.ancho, espacio)
    const anchoDe = (l: Palabra[]) => l.reduce((s, p, i) => s + p.ancho + (i ? espacio : 0), 0)
    if (lineas.length <= op.maxLineas || tam <= op.min) {
      if (lineas.length > op.maxLineas) {
        // No entra ni con la letra mínima: se corta y se avisa con "…".
        lineas.length = op.maxLineas
        const ultima = lineas[op.maxLineas - 1]
        const puntos = ctx.measureText("…").width
        while (ultima.length > 1 && anchoDe(ultima) + puntos > op.ancho) ultima.pop()
        const fin = ultima[ultima.length - 1]
        fin.segs = [...fin.segs, { tipo: "texto", s: "…" }]
        fin.ancho += puntos
      } else if (lineas.length > 1) {
        // El renglón más angosto que deja la misma cantidad de líneas.
        const n = lineas.length
        let bajo = Math.max(...lineas.flat().map((p) => p.ancho))
        let alto = op.ancho
        for (let k = 0; k < 14 && alto - bajo > 1; k++) {
          const medio = (bajo + alto) / 2
          if (envolver(ctx, piezas, tam, medio, espacio).length <= n) alto = medio
          else bajo = medio
        }
        lineas = envolver(ctx, piezas, tam, alto, espacio)
      }
      const anchos = lineas.map(anchoDe)
      const interlinea = tam * inter
      return { estilo, lineas, anchos, ancho: Math.max(0, ...anchos), interlinea, alto: interlinea * (lineas.length - 1) + tam, espacio }
    }
    tam = Math.max(op.min, Math.floor(tam * 0.92))
  }
}

/**
 * Dibuja un bloque. (x, yArriba) = esquina de arriba; alinear = "izq" | "centro".
 * La primera línea tiene la base en yArriba + 0,8 × tam.
 */
export function dibujarBloque(
  ctx: CanvasRenderingContext2D,
  b: Bloque,
  x: number,
  yArriba: number,
  alinear: "izq" | "centro",
  color: string,
  logo: HTMLImageElement | null,
  colorPrimero?: { palabras: number; color: string },
) {
  aplicarEstilo(ctx, b.estilo)
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"
  const tam = b.estilo.tam
  let contador = 0
  b.lineas.forEach((linea, i) => {
    const base = yArriba + 0.8 * tam + i * b.interlinea
    let cx = alinear === "centro" ? x - b.anchos[i] / 2 : x
    for (const p of linea) {
      const enColor = colorPrimero && contador < colorPrimero.palabras
      contador++
      for (const [j, s] of p.segs.entries()) {
        if (s.tipo === "texto") {
          ctx.fillStyle = enColor ? colorPrimero!.color : color
          ctx.fillText(s.s, cx, base)
          cx += ctx.measureText(s.s).width
        } else {
          const c = chip(tam)
          const y0 = base - 0.76 * tam
          const x0 = cx + 0.06 * tam
          ctx.save()
          ctx.shadowColor = "transparent"
          ctx.fillStyle = CELESTE_PRIME
          redondeado(ctx, x0, y0, c.ancho, c.alto, 0.14 * tam)
          ctx.fill()
          if (logo && logo.complete && logo.naturalWidth) ctx.drawImage(logo, x0 + c.padX, y0 + c.padY, c.img.ancho, c.img.alto)
          ctx.restore()
          aplicarEstilo(ctx, b.estilo)
          cx += c.ancho + (j < p.segs.length - 1 ? 0.1 : 0.12) * tam
        }
      }
      cx += b.espacio
    }
  })
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Dígitos de ancho fijo: el código de tiempo no baila. */
function textoTabular(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, avance: number) {
  let cx = x
  for (const ch of s) {
    if (/\d/.test(ch)) {
      const w = ctx.measureText(ch).width
      ctx.fillText(ch, cx + (avance - w) / 2, y)
      cx += avance
    } else {
      ctx.fillText(ch, cx, y)
      cx += ctx.measureText(ch).width
    }
  }
  return cx - x
}

function sombra(ctx: CanvasRenderingContext2D, k: number, fuerte = false) {
  ctx.shadowColor = "rgba(0,0,0,0.85)"
  ctx.shadowBlur = (fuerte ? 18 : 8) * k
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = (fuerte ? 3 : 1.5) * k
}
function sinSombra(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

// ── El cuadro ─────────────────────────────────────────────────

export function componer(ctx: CanvasRenderingContext2D, escena: CanvasImageSource, capas: Capas, rec: Recursos) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const k = H / 1080
  const mx = W * 0.05
  const my = H * 0.05
  const { cond, texto } = rec.fuentes
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, W, H)

  // 1. La escena (con el pulso de la mano en el visor de cámara).
  if (capas.pulso) {
    const p = capas.pulso
    ctx.save()
    ctx.translate(W / 2 + p.dx, H / 2 + p.dy)
    ctx.rotate(p.giro)
    ctx.scale(p.escala, p.escala)
    ctx.drawImage(escena, -W / 2, -H / 2, W, H)
    ctx.restore()
  } else ctx.drawImage(escena, 0, 0, W, H)

  // Viñeta leve del visor de cámara.
  if (capas.visor === "camara") {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56)
    g.addColorStop(0, "rgba(0,0,0,0)")
    g.addColorStop(1, "rgba(0,0,0,0.38)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  const enEscena = !capas.apertura && !capas.cierre

  // 2. Degradé abajo para que se lean el rótulo y los subtítulos.
  if (enEscena && (capas.dialogo || capas.rotulo)) {
    const a = Math.max(capas.dialogo?.alfa ?? 0, capas.rotulo?.alfa ?? 0)
    const g = ctx.createLinearGradient(0, H * 0.62, 0, H)
    g.addColorStop(0, "rgba(0,0,0,0)")
    g.addColorStop(1, `rgba(0,0,0,${(0.55 * a).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.62, W, H * 0.38)
  }

  // 3. Burbuja sobre quien habla.
  // En el visor de cámara, arriba están REC, la cámara y la marca: la burbuja no sube hasta ahí.
  const techo = my + (capas.visor === "camara" ? 100 : 40) * k
  if (enEscena && capas.dialogo && capas.dialogo.cabeza && capas.dialogo.alfa > 0) burbuja(ctx, capas.dialogo, rec, W, H, k, mx, techo)

  // 4. Título grande, al centro.
  if (enEscena && capas.titulo && capas.titulo.alfa > 0) {
    const b = ajustar(ctx, capas.titulo.texto.toLocaleUpperCase("es"), { familia: cond, peso: 800, espaciado: 0.02 }, {
      max: Math.round(124 * k),
      min: Math.round(56 * k),
      ancho: W - 2 * mx,
      maxLineas: 3,
      interlinea: 0.98,
    })
    const subir = (1 - capas.titulo.alfa) * 14 * k
    const y = Math.max(my, H * 0.42 - b.alto / 2) + subir
    // Una franja oscura y difusa detrás: el título se lee aunque la escena sea blanca (la fachada).
    const cy = y + b.alto / 2
    const franja = ctx.createLinearGradient(0, cy - b.alto, 0, cy + b.alto)
    franja.addColorStop(0, "rgba(0,0,0,0)")
    franja.addColorStop(0.5, `rgba(0,0,0,${(0.42 * capas.titulo.alfa).toFixed(3)})`)
    franja.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = franja
    ctx.fillRect(0, cy - b.alto, W, 2 * b.alto)
    ctx.globalAlpha = capas.titulo.alfa
    sombra(ctx, k, true)
    dibujarBloque(ctx, b, W / 2, y, "centro", "#ffffff", rec.logoPrime)
    sinSombra(ctx)
    ctx.globalAlpha = 1
  }

  // 5. Rótulo (tercio inferior, a la izquierda).
  if (enEscena && capas.rotulo && capas.rotulo.alfa > 0) {
    const b = ajustar(ctx, capas.rotulo.texto.toLocaleUpperCase("es"), { familia: cond, peso: 700, espaciado: 0.06 }, {
      max: Math.round(44 * k),
      min: Math.round(28 * k),
      ancho: Math.min(W * 0.62, W - 2 * mx - 40 * k),
      maxLineas: 2,
      interlinea: 1.08,
    })
    const pad = 16 * k
    const barra = 7 * k
    const ancho = b.ancho + 2 * pad + barra
    const alto = b.alto + 2 * pad
    const abajo = H * 0.78
    const y = Math.max(my, abajo - alto)
    const desliza = (1 - capas.rotulo.alfa) * -24 * k
    ctx.globalAlpha = capas.rotulo.alfa
    ctx.fillStyle = "rgba(8,10,14,0.72)"
    redondeado(ctx, mx + desliza, y, ancho, alto, 8 * k)
    ctx.fill()
    ctx.fillStyle = "#fbbf24"
    ctx.fillRect(mx + desliza, y, barra, alto)
    dibujarBloque(ctx, b, mx + desliza + barra + pad, y + pad, "izq", "#ffffff", rec.logoPrime)
    ctx.globalAlpha = 1
  }

  // 6. Subtítulo (abajo, centrado): "Nombre: texto".
  if (enEscena && capas.dialogo && capas.dialogo.alfa > 0) {
    const d = capas.dialogo
    const nombre = `${d.nombre}:`
    const cuerpo = `${nombre} ${d.texto}`
    const b = ajustar(ctx, cuerpo, { familia: texto, peso: 700 }, {
      max: Math.round(40 * k),
      min: Math.round(28 * k),
      ancho: W - 2 * mx - (d.cita ? 90 * k : 0),
      maxLineas: 2,
      interlinea: 1.25,
    })
    const y = H * 0.905 - b.alto
    ctx.globalAlpha = d.alfa
    sombra(ctx, k)
    const palabrasNombre = nombre.split(/\s+/).filter(Boolean).length
    dibujarBloque(ctx, b, W / 2, y, "centro", "#ffffff", rec.logoPrime, { palabras: palabrasNombre, color: aclarar(d.color) })
    if (d.cita) {
      // "CITA" al final de la última línea.
      const ultima = b.lineas.length - 1
      const xFin = W / 2 + b.anchos[ultima] / 2 + 14 * k
      const base = y + 0.8 * b.estilo.tam + ultima * b.interlinea
      aplicarEstilo(ctx, { familia: cond, peso: 700, tam: Math.round(22 * k), espaciado: 0.14 })
      ctx.fillStyle = "#fde68a"
      ctx.fillText("CITA", xFin, base)
    }
    sinSombra(ctx)
    ctx.globalAlpha = 1
  }

  // 7. Visor de cámara: REC, código de tiempo, nombre de la cámara y esquinas.
  if (enEscena && capas.visor === "camara") {
    ctx.strokeStyle = "rgba(255,255,255,0.78)"
    ctx.lineWidth = Math.max(1.5, 3 * k)
    const L = 64 * k
    const ix = H * 0.035
    const iy = H * 0.035
    for (const [x, y, sx, sy] of [
      [ix, iy, 1, 1],
      [W - ix, iy, -1, 1],
      [ix, H - iy, 1, -1],
      [W - ix, H - iy, -1, -1],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(x, y + sy * L)
      ctx.lineTo(x, y)
      ctx.lineTo(x + sx * L, y)
      ctx.stroke()
    }
    const tam = Math.round(30 * k)
    aplicarEstilo(ctx, { familia: cond, peso: 700, tam, espaciado: 0.08 })
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "left"
    sombra(ctx, k)
    const base = my + tam * 0.8
    // Punto rojo: medio segundo prendido, medio apagado.
    const prendido = Math.floor(capas.t * 2) % 2 === 0
    const r = 11 * k
    ctx.fillStyle = prendido ? "#ef2b2b" : "rgba(239,43,43,0.22)"
    ctx.beginPath()
    ctx.arc(mx + r, base - tam * 0.34, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    let x = mx + 2 * r + 12 * k
    ctx.fillText("REC", x, base)
    x += ctx.measureText("REC").width + 22 * k
    if (capas.codigo) {
      const avance = Math.max(...[..."0123456789"].map((d) => ctx.measureText(d).width))
      textoTabular(ctx, capas.codigo, x, base, avance)
    }
    if (capas.camara) {
      const anchoMax = W * 0.42
      const b = ajustar(ctx, capas.camara, { familia: cond, peso: 700, espaciado: 0.08 }, { max: tam, min: Math.round(20 * k), ancho: anchoMax, maxLineas: 1 })
      dibujarBloque(ctx, b, W - mx - b.ancho, my, "izq", "#ffffff", rec.logoPrime)
    }
    sinSombra(ctx)
  }

  // 8. La marca arriba al centro y la etiqueta de ficción abajo a la derecha.
  if (enEscena) {
    const tam = Math.round(22 * k)
    aplicarEstilo(ctx, { familia: cond, peso: 700, tam, espaciado: 0.42 })
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    sombra(ctx, k)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    const marca = MARCA.toLocaleUpperCase("es")
    // El espaciado agrega aire después de la última letra: se descuenta para centrar.
    const w = ctx.measureText(marca).width - 0.42 * tam
    // En el visor de cámara, arriba a la derecha bajo "CAM 0N" (arriba al centro queda limpio);
    // en cine, arriba al centro. Siempre sobre una pastilla oscura: la escena puede tener letreros detrás.
    const xMarca = capas.visor === "camara" ? W - mx - w : W / 2 - w / 2
    const yMarca = capas.visor === "camara" ? my + 30 * k + 14 * k + 0.8 * tam : my + 0.8 * tam
    sinSombra(ctx)
    ctx.fillStyle = "rgba(0,0,0,0.32)"
    redondeado(ctx, xMarca - 12 * k, yMarca - 0.8 * tam - 7 * k, w + 24 * k, tam + 14 * k, (tam + 14 * k) / 2)
    ctx.fill()
    sombra(ctx, k)
    ctx.fillStyle = "rgba(255,255,255,0.88)"
    ctx.fillText(marca, xMarca, yMarca)
    if (capas.ficcion) {
      const t2 = Math.round(20 * k)
      aplicarEstilo(ctx, { familia: cond, peso: 600, tam: t2, espaciado: 0.16 })
      const s = ETIQUETA_FICCION.toLocaleUpperCase("es")
      const w2 = ctx.measureText(s).width - 0.16 * t2
      ctx.fillStyle = "rgba(255,255,255,0.72)"
      ctx.fillText(s, W - mx - w2, H - my)
    }
    sinSombra(ctx)
  }

  // 9. Velo negro (apertura y cierre).
  if (capas.velo > 0) {
    ctx.globalAlpha = Math.min(1, capas.velo)
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }

  // 10. Apertura: el nombre del proyecto.
  if (capas.apertura && capas.apertura.alfa > 0) {
    const a = capas.apertura
    ctx.globalAlpha = a.alfa
    const b = ajustar(ctx, MARCA.toLocaleUpperCase("es"), { familia: cond, peso: 800, espaciado: 0.16 }, {
      max: Math.round(96 * k),
      min: Math.round(48 * k),
      ancho: W - 2 * mx,
      maxLineas: 2,
      interlinea: 1,
    })
    const sub = a.subtitulo
      ? ajustar(ctx, a.subtitulo, { familia: texto, peso: 600 }, { max: Math.round(32 * k), min: Math.round(22 * k), ancho: W - 2 * mx, maxLineas: 2 })
      : null
    const total = b.alto + (sub ? 26 * k + sub.alto : 0)
    const y = H / 2 - total / 2
    // El espaciado agrega aire después de la última letra: se corre medio espaciado para centrar.
    dibujarBloque(ctx, b, W / 2 + 0.08 * b.estilo.tam, y, "centro", "#ffffff", rec.logoPrime)
    ctx.fillStyle = "#fbbf24"
    ctx.fillRect(W / 2 - 40 * k, y + b.alto + 10 * k, 80 * k, 3 * k)
    if (sub) dibujarBloque(ctx, sub, W / 2, y + b.alto + 26 * k, "centro", "rgba(255,255,255,0.72)", rec.logoPrime)
    ctx.globalAlpha = 1
  }

  // 11. Cierre: la web y el aviso de ficción.
  if (capas.cierre) {
    const c = capas.cierre
    if (c.alfa > 0) {
      ctx.globalAlpha = c.alfa
      const marca = ajustar(ctx, MARCA.toLocaleUpperCase("es"), { familia: cond, peso: 700, espaciado: 0.32 }, {
        max: Math.round(34 * k),
        min: Math.round(22 * k),
        ancho: W - 2 * mx,
        maxLineas: 1,
      })
      const web = ajustar(ctx, WEB, { familia: cond, peso: 800, espaciado: 0.01 }, { max: Math.round(84 * k), min: Math.round(40 * k), ancho: W - 2 * mx, maxLineas: 1 })
      const aviso = ajustar(ctx, AVISO, { familia: texto, peso: 600 }, {
        max: Math.round(30 * k),
        min: Math.round(22 * k),
        ancho: Math.min(W - 2 * mx, 1100 * k),
        maxLineas: 3,
        interlinea: 1.3,
      })
      const g1 = 22 * k
      const g2 = 40 * k
      const total = marca.alto + g1 + web.alto + g2 + aviso.alto
      let y = H / 2 - total / 2
      dibujarBloque(ctx, marca, W / 2 + 0.16 * marca.estilo.tam, y, "centro", "rgba(255,255,255,0.8)", rec.logoPrime)
      y += marca.alto + g1
      dibujarBloque(ctx, web, W / 2, y, "centro", "#ffffff", rec.logoPrime)
      y += web.alto + g2 / 2
      ctx.fillStyle = "#fbbf24"
      ctx.fillRect(W / 2 - 40 * k, y - 1.5 * k, 80 * k, 3 * k)
      y += g2 / 2
      dibujarBloque(ctx, aviso, W / 2, y, "centro", "rgba(255,255,255,0.82)", rec.logoPrime)
      ctx.globalAlpha = 1
    }
    if (c.negro > 0) {
      ctx.globalAlpha = Math.min(1, c.negro)
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

/** Los colores de los residentes son para fondo oscuro; sobre negro algunos quedan apagados: se aclaran un poco. */
function aclarar(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return "#ffffff"
  const n = parseInt(m[1], 16)
  const mezcla = (c: number) => Math.round(c + (255 - c) * 0.25)
  const r = mezcla((n >> 16) & 255)
  const g = mezcla((n >> 8) & 255)
  const b = mezcla(n & 255)
  return `rgb(${r},${g},${b})`
}

function burbuja(ctx: CanvasRenderingContext2D, d: DialogoEnCuadro, rec: Recursos, W: number, H: number, k: number, mx: number, techo: number) {
  const cab = d.cabeza!
  const pad = 16 * k
  const anchoMax = Math.min(W * 0.34, 560 * k)
  const b = ajustar(ctx, d.texto, { familia: rec.fuentes.texto, peso: 650 }, {
    max: Math.round(28 * k),
    min: Math.round(21 * k),
    ancho: anchoMax - 2 * pad,
    maxLineas: 4,
    interlinea: 1.3,
  })
  const tamNombre = Math.round(19 * k)
  aplicarEstilo(ctx, { familia: rec.fuentes.cond, peso: 700, tam: tamNombre, espaciado: 0.12 })
  const nombre = d.nombre.toLocaleUpperCase("es") + (d.cita ? " · CITA" : "")
  const anchoNombre = ctx.measureText(nombre).width + 18 * k
  const ancho = Math.max(b.ancho, anchoNombre) + 2 * pad
  const altoNombre = tamNombre * 1.25
  const alto = altoNombre + 6 * k + b.alto + 2 * pad
  const pico = 12 * k
  // Encima de la cabeza; si no entra arriba, se queda en la zona segura (el pico apunta igual).
  let x = cab.x - ancho / 2
  x = Math.max(mx, Math.min(W - mx - ancho, x))
  let y = cab.y - 34 * k - pico - alto
  y = Math.max(techo, Math.min(H * 0.7 - alto, y))
  ctx.globalAlpha = d.alfa
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.55)"
  ctx.shadowBlur = 24 * k
  ctx.shadowOffsetY = 8 * k
  ctx.fillStyle = "#ffffff"
  redondeado(ctx, x, y, ancho, alto, 16 * k)
  ctx.fill()
  // El pico, hacia la cabeza (solo si la cabeza está debajo de la burbuja).
  const px = Math.max(x + 22 * k, Math.min(x + ancho - 22 * k, cab.x))
  if (cab.y > y + alto) {
    ctx.beginPath()
    ctx.moveTo(px - pico, y + alto - 1)
    ctx.lineTo(px + pico, y + alto - 1)
    ctx.lineTo(px, y + alto + pico)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // Nombre con el punto de su color.
  const yNombre = y + pad
  ctx.fillStyle = d.color
  ctx.beginPath()
  ctx.arc(x + pad + 5 * k, yNombre + tamNombre * 0.45, 5 * k, 0, Math.PI * 2)
  ctx.fill()
  aplicarEstilo(ctx, { familia: rec.fuentes.cond, peso: 700, tam: tamNombre, espaciado: 0.12 })
  ctx.fillStyle = d.cita ? "#92400e" : "rgba(11,13,16,0.62)"
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(nombre, x + pad + 16 * k, yNombre + tamNombre * 0.85)
  dibujarBloque(ctx, b, x + pad, yNombre + altoNombre + 6 * k, "izq", "#0b0d10", rec.logoPrime)
  ctx.globalAlpha = 1
}
