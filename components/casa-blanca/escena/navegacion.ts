// ──────────────────────────────────────────────────────────────
// ORIENTACIÓN EN EL MUNDO 3D — para que se entienda dónde está todo
//
// - Superficie: el pabellón de vidrio del ascensor junto al Pórtico Sur, con
//   su letrero "SUBSUELO ↓" y un marcador flotante que se ve desde lejos.
// - Subsuelos: letreros flotantes sobre cada celda (departamento y líder) y
//   sobre el núcleo de ascensores; pasillos rotulados en el piso y una línea
//   dorada que lleva del ascensor a cada pasillo.
// - Ciudad: un letrero flotante sobre cada lugar y otro sobre el ascensor.
//
// Los letreros flotantes son "billboards": siempre de frente a la cámara y con
// un tamaño que crece con la distancia (dentro de un rango), para que se lean
// en la vista general y no tapen todo de cerca. Todos los de un nivel son UNA
// malla y UNA textura (un atlas): una llamada de dibujo por nivel.
//
// Los textos salen de lugares.ts y navegacion.ts: aquí no se escribe a mano
// el nombre de ningún departamento ni de ningún líder.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { CELDAS, DEPARTAMENTOS_BASE, HUELLAS, LUGAR, LUGARES, SUB_COLUMNAS, SUB_FILAS, SUB_MEDIO_ANCHO } from "../lugares"
import { NIVEL_CORTO, NUCLEO_ASCENSOR, PABELLON_ASCENSOR, ejeAscensor } from "../navegacion"
import { ALTURA_NIVEL } from "../tipos"
import type { CtxEscena } from "./contrato"
import { COLOR_DEPTO, LIDER_CORTO } from "./subsuelo"
import { techoCiudad } from "./ciudad"

const DORADO = "#e3b866"
const CIAN = "#8fd8ff"

/** La condensada del HUD (next/font le pone un nombre propio): se lee del CSS para usar la misma en los letreros. */
function fuenteCondensada(): string {
  if (typeof document === "undefined") return "sans-serif"
  const raiz = document.querySelector(".cb-raiz") ?? document.querySelector("main") ?? document.body
  const v = getComputedStyle(raiz).getPropertyValue("--font-condensada").trim()
  return `${v ? v + ", " : ""}'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif`
}

// ═══════════════════════════════════════════════════════════════
// Letreros flotantes
// ═══════════════════════════════════════════════════════════════

interface Letrero {
  /** Punto de anclaje: la punta de abajo del letrero. */
  x: number
  y: number
  z: number
  titulo: string
  sub?: string
  color: string
  /** Ancho en metros a la distancia de referencia. */
  ancho: number
  /** "pin": con punta abajo (sobre un lugar); "placa": sin punta. */
  forma?: "pin" | "placa"
}

const SLOT_W = 1024
const SLOT_H = 256

function rectRedondo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Ajusta la letra para que el texto entre en `max` px. */
function texto(g: CanvasRenderingContext2D, t: string, x: number, y: number, tam: number, peso: number, fuente: string, max: number, color: string) {
  let s = tam
  g.font = `${peso} ${s}px ${fuente}`
  const ancho = g.measureText(t).width
  if (ancho > max) {
    s = Math.floor((s * max) / ancho)
    g.font = `${peso} ${s}px ${fuente}`
  }
  g.fillStyle = color
  g.fillText(t, x, y)
}

/** Dibuja un letrero en su casilla del atlas (1024 x 256): placa oscura, barra de color, título y bajada. */
function dibujarLetrero(g: CanvasRenderingContext2D, l: Letrero, ox: number, oy: number, fuente: string) {
  g.save()
  g.translate(ox, oy)
  g.clearRect(0, 0, SLOT_W, SLOT_H)
  const pin = l.forma !== "placa"
  const alto = pin ? 196 : 228
  const x0 = 14
  const w = SLOT_W - 28
  // Sombra suave para que el letrero se despegue del fondo.
  g.shadowColor = "rgba(0,0,0,0.55)"
  g.shadowBlur = 14
  rectRedondo(g, x0, 10, w, alto, 30)
  g.fillStyle = "rgba(9,11,16,0.9)"
  g.fill()
  g.shadowBlur = 0
  if (pin) {
    g.beginPath()
    g.moveTo(SLOT_W / 2 - 26, 10 + alto - 1)
    g.lineTo(SLOT_W / 2, SLOT_H - 4)
    g.lineTo(SLOT_W / 2 + 26, 10 + alto - 1)
    g.closePath()
    g.fill()
  }
  // Borde fino del color del lugar y barra a la izquierda.
  g.lineWidth = 4
  g.strokeStyle = l.color + "aa"
  rectRedondo(g, x0 + 2, 12, w - 4, alto - 4, 28)
  g.stroke()
  g.save()
  rectRedondo(g, x0, 10, w, alto, 30)
  g.clip()
  g.fillStyle = l.color
  g.fillRect(x0, 10, 22, alto)
  g.restore()
  g.textAlign = "center"
  g.textBaseline = "middle"
  const cx = SLOT_W / 2 + 10
  const max = w - 90
  if (l.sub) {
    texto(g, l.titulo, cx, 10 + alto * 0.36, 100, 800, fuente, max, "#ffffff")
    texto(g, l.sub, cx, 10 + alto * 0.77, 70, 700, fuente, max, l.color)
  } else {
    texto(g, l.titulo, cx, 10 + alto * 0.52, 112, 800, fuente, max, "#ffffff")
  }
  g.restore()
}

const VERT_LETRERO = /* glsl */ `
attribute vec2 aEsquina;
attribute vec2 aTam;
uniform float uRef;
uniform float uMin;
uniform float uMax;
uniform vec2 uCerca;
varying vec2 vUv;
varying float vAlfa;
void main() {
  vec4 c = modelViewMatrix * vec4(position, 1.0);
  float d = -c.z;
  // Tamaño parejo en pantalla dentro de un rango: legible lejos, discreto cerca.
  float k = clamp(d / uRef, uMin, uMax);
  c.xy += aEsquina * aTam * k;
  gl_Position = projectionMatrix * c;
  vUv = uv;
  vAlfa = smoothstep(uCerca.x, uCerca.y, d);
}`

const FRAG_LETRERO = /* glsl */ `
uniform sampler2D uMapa;
uniform float uBrillo;
uniform float uOpacidad;
varying vec2 vUv;
varying float vAlfa;
void main() {
  vec4 t = texture2D(uMapa, vUv);
  float a = t.a * vAlfa * uOpacidad;
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb * uBrillo, a);
}`

/**
 * Una malla con todos los letreros de un nivel. `ref`: distancia (m) a la
 * que el letrero mide su ancho; más lejos crece hasta `max` veces.
 */
function mallaLetreros(letreros: Letrero[], op: { ref: number; min: number; max: number; cerca: [number, number]; brillo: number; nombre: string; encima?: boolean }) {
  const filas = Math.ceil(letreros.length / 2)
  const W = SLOT_W * 2
  const H = Math.max(SLOT_H, THREE.MathUtils.ceilPowerOfTwo(filas * SLOT_H))
  const lienzo = document.createElement("canvas")
  lienzo.width = W
  lienzo.height = H
  const g = lienzo.getContext("2d")
  if (!g) return null
  const dibujar = () => {
    const fuente = fuenteCondensada()
    g.clearRect(0, 0, W, H)
    letreros.forEach((l, i) => dibujarLetrero(g, l, (i % 2) * SLOT_W, Math.floor(i / 2) * SLOT_H, fuente))
  }
  dibujar()
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  // La fuente de la página puede llegar después: se redibuja cuando esté.
  document.fonts?.ready.then(() => {
    dibujar()
    tex.needsUpdate = true
  })

  const n = letreros.length
  const pos = new Float32Array(n * 4 * 3)
  const esq = new Float32Array(n * 4 * 2)
  const tam = new Float32Array(n * 4 * 2)
  const uv = new Float32Array(n * 4 * 2)
  const idx: number[] = []
  letreros.forEach((l, i) => {
    const u0 = ((i % 2) * SLOT_W) / W
    const u1 = u0 + SLOT_W / W
    const v1 = 1 - (Math.floor(i / 2) * SLOT_H) / H
    const v0 = v1 - SLOT_H / H
    const alto = (l.ancho * SLOT_H) / SLOT_W
    const esquinas: Array<[number, number, number, number]> = [
      [-0.5, 0, u0, v0],
      [0.5, 0, u1, v0],
      [0.5, 1, u1, v1],
      [-0.5, 1, u0, v1],
    ]
    esquinas.forEach(([ex, ey, u, v], j) => {
      const k = i * 4 + j
      pos.set([l.x, l.y, l.z], k * 3)
      esq.set([ex, ey], k * 2)
      tam.set([l.ancho, alto], k * 2)
      uv.set([u, v], k * 2)
    })
    const b = i * 4
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geo.setAttribute("aEsquina", new THREE.BufferAttribute(esq, 2))
  geo.setAttribute("aTam", new THREE.BufferAttribute(tam, 2))
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  geo.setIndex(idx)
  // La caja real cambia con la cámara: se agranda la esfera para que nunca se recorte por error.
  geo.computeBoundingSphere()
  if (geo.boundingSphere) geo.boundingSphere.radius += 60
  const mat = new THREE.ShaderMaterial({
    name: op.nombre,
    uniforms: {
      uMapa: { value: tex },
      uRef: { value: op.ref },
      uMin: { value: op.min },
      uMax: { value: op.max },
      uCerca: { value: new THREE.Vector2(op.cerca[0], op.cerca[1]) },
      uBrillo: { value: op.brillo },
      uOpacidad: { value: 1 },
    },
    vertexShader: VERT_LETRERO,
    fragmentShader: FRAG_LETRERO,
    transparent: true,
    depthWrite: false,
    // Un marcador de juego se ve aunque haya un edificio delante.
    depthTest: !op.encima,
  })
  const m = new THREE.Mesh(geo, mat)
  m.name = op.nombre
  m.renderOrder = op.encima ? 30 : 20
  // No le roban el toque a lo que está debajo.
  m.raycast = () => {}
  return m
}

// ═══════════════════════════════════════════════════════════════
// Rótulos en el piso de los pasillos
// ═══════════════════════════════════════════════════════════════

/** Atlas de rótulos de piso: "PASILLO 1..3", "EJE CENTRAL" y la flecha a los ascensores. */
function atlasPiso(): { tex: THREE.CanvasTexture; uv: Record<string, [number, number, number, number]> } {
  const W = 1024
  const H = 512
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!
  const uv: Record<string, [number, number, number, number]> = {}
  const casilla = (clave: string, x: number, y: number, w: number, h: number) => {
    uv[clave] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]
  }
  const dibujar = () => {
    const fuente = fuenteCondensada()
    g.clearRect(0, 0, W, H)
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = "#ffffff"
    for (let i = 0; i < 3; i++) {
      g.font = `800 92px ${fuente}`
      g.fillText(`PASILLO ${i + 1}`, 256, 64 + i * 128)
      casilla(`pasillo-${i + 1}`, 0, i * 128, 512, 128)
    }
    g.font = `800 92px ${fuente}`
    g.fillText("EJE CENTRAL", 768, 64)
    casilla("eje", 512, 0, 512, 128)
    // Flecha (chevrón doble) hacia arriba de la casilla: apunta a los ascensores.
    g.save()
    g.translate(768, 256)
    g.lineWidth = 22
    g.lineCap = "round"
    g.lineJoin = "round"
    g.strokeStyle = "#ffffff"
    for (const dy of [-26, 26]) {
      g.beginPath()
      g.moveTo(-70, dy + 36)
      g.lineTo(0, dy - 30)
      g.lineTo(70, dy + 36)
      g.stroke()
    }
    g.restore()
    casilla("flecha", 640, 128, 256, 256)
  }
  dibujar()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  document.fonts?.ready.then(() => {
    dibujar()
    tex.needsUpdate = true
  })
  return { tex, uv }
}

/** Un rectángulo plano en el piso, centrado en (x, z), girado `rot` alrededor de y, con su parte del atlas. */
function rotuloPiso(x: number, y: number, z: number, w: number, h: number, rot: number, uv: [number, number, number, number], color: THREE.Color) {
  const g = new THREE.PlaneGeometry(w, h)
  g.rotateX(-Math.PI / 2)
  g.rotateY(rot)
  g.translate(x, y, z)
  const a = g.getAttribute("uv") as THREE.BufferAttribute
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + (uv[2] - uv[0]) * a.getX(i), uv[1] + (uv[3] - uv[1]) * a.getY(i))
  const col = new Float32Array(a.count * 3)
  for (let i = 0; i < a.count; i++) col.set([color.r, color.g, color.b], i * 3)
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  return g
}

/** Un rectángulo de color liso en el piso (líneas guía), con uv en la esquina blanca del atlas. */
function franjaPiso(x0: number, x1: number, z0: number, z1: number, y: number, color: THREE.Color, uvBlanco: [number, number]) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
  const a = g.getAttribute("uv") as THREE.BufferAttribute
  for (let i = 0; i < a.count; i++) a.setXY(i, uvBlanco[0], uvBlanco[1])
  const col = new Float32Array(a.count * 3)
  for (let i = 0; i < a.count; i++) col.set([color.r, color.g, color.b], i * 3)
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  return g
}

// ═══════════════════════════════════════════════════════════════
// Subsuelos
// ═══════════════════════════════════════════════════════════════

const PASILLOS_Z = [27, 65, 103]

function nombreDeCelda(lugarId: string): { titulo: string; sub?: string; color: string } {
  const d = DEPARTAMENTOS_BASE.find((x) => x.lugarId === lugarId)
  if (d) return { titulo: d.nombre.toUpperCase(), sub: `${(LIDER_CORTO[d.id] ?? d.id).toUpperCase()} · 100 AGENTES`, color: COLOR_DEPTO[d.id] ?? DORADO }
  return { titulo: (LUGAR[lugarId]?.nombre ?? lugarId).toUpperCase(), color: DORADO }
}

function construirSubsuelos(ctx: CtxEscena, piso: ReturnType<typeof atlasPiso>) {
  const blanco = new THREE.Color(1, 1, 1)
  const dorado = new THREE.Color(DORADO)
  // Esquina sin texto del atlas (abajo a la izquierda): sirve de "color liso".
  const uvLiso: [number, number] = [0.01, 0.01]
  const matPiso = new THREE.MeshBasicMaterial({
    name: "navegacion-piso",
    map: piso.tex,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
  // La esquina "lisa" del atlas es transparente: las líneas guía usan su propio material sólido.
  const matLinea = new THREE.MeshBasicMaterial({
    name: "navegacion-linea",
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })

  for (const nivel of ["n1", "n2", "n3"] as const) {
    const y = ALTURA_NIVEL[nivel]
    const grupo = ctx.niveles[nivel]
    const S = HUELLAS.subsuelo
    const yp = y + 0.025

    // ── Rótulos de piso ──
    const rotulos: THREE.BufferGeometry[] = []
    PASILLOS_Z.forEach((z, i) => {
      // Dos veces por pasillo, a cada lado del eje central, leyéndose desde el norte.
      for (const x of [-22, 22, -66, 66]) rotulos.push(rotuloPiso(x, yp, z, 8.4, 2.1, Math.PI, piso.uv[`pasillo-${i + 1}`], blanco))
    })
    // El eje central entre pasillos y las flechas hacia el ascensor.
    for (let r = 1; r < PASILLOS_Z.length; r++) {
      const zm = (PASILLOS_Z[r - 1] + PASILLOS_Z[r]) / 2
      rotulos.push(rotuloPiso(NUCLEO_ASCENSOR.x, yp, zm + 6, 8.4, 2.1, Math.PI / 2, piso.uv.eje, blanco))
      for (const dz of [-8, -4]) rotulos.push(rotuloPiso(NUCLEO_ASCENSOR.x, yp, zm + dz, 2.6, 2.6, 0, piso.uv.flecha, dorado))
    }
    for (const x of [-11, 11]) rotulos.push(rotuloPiso(x, yp, PASILLOS_Z[0], 2.4, 2.4, x < 0 ? Math.PI / 2 : -Math.PI / 2, piso.uv.flecha, dorado))
    const mr = new THREE.Mesh(mergeGeometries(rotulos), matPiso)
    mr.name = `navegacion-${nivel}-rotulos`
    mr.renderOrder = 2
    mr.raycast = () => {}
    grupo.add(mr)
    for (const g of rotulos) g.dispose()

    // ── Línea dorada: del ascensor por el Pasillo 1 y el eje central ──
    const lineas: THREE.BufferGeometry[] = []
    const a = 0.09
    lineas.push(franjaPiso(NUCLEO_ASCENSOR.x - a, NUCLEO_ASCENSOR.x + a, NUCLEO_ASCENSOR.z + 1.5, PASILLOS_Z[PASILLOS_Z.length - 1], yp, dorado, uvLiso))
    lineas.push(franjaPiso(S.x0 + 4, S.x1 - 4, PASILLOS_Z[0] - a, PASILLOS_Z[0] + a, yp, dorado, uvLiso))
    for (const z of PASILLOS_Z.slice(1)) lineas.push(franjaPiso(S.x0 + 4, S.x1 - 4, z - a, z + a, yp, dorado.clone().multiplyScalar(0.7), uvLiso))
    // Umbral de color en la puerta de cada celda: el color de su departamento.
    CELDAS[nivel].forEach((fila, r) =>
      fila.forEach((lugarId, c) => {
        const cx = SUB_COLUMNAS[c]
        const zPuerta = SUB_FILAS[r] - 17
        const col = new THREE.Color(nombreDeCelda(lugarId).color)
        lineas.push(franjaPiso(cx - 2, cx + 2, zPuerta - 1.6, zPuerta - 0.15, yp, col, uvLiso))
      }),
    )
    const ml = new THREE.Mesh(mergeGeometries(lineas), matLinea)
    ml.name = `navegacion-${nivel}-lineas`
    ml.renderOrder = 2
    ml.raycast = () => {}
    grupo.add(ml)
    for (const g of lineas) g.dispose()

    // ── Letreros flotantes ──
    const letreros: Letrero[] = []
    CELDAS[nivel].forEach((fila, r) =>
      fila.forEach((lugarId, c) => {
        const n = nombreDeCelda(lugarId)
        letreros.push({ x: SUB_COLUMNAS[c], y: y + 7.4, z: SUB_FILAS[r] - 4, titulo: n.titulo, sub: n.sub, color: n.color, ancho: SUB_MEDIO_ANCHO * 0.7 })
      }),
    )
    letreros.push({
      x: NUCLEO_ASCENSOR.x,
      y: y + 8.2,
      z: NUCLEO_ASCENSOR.z - 1,
      titulo: "ASCENSORES",
      sub: "SUPERFICIE ↑ · CIUDAD ↓",
      color: CIAN,
      ancho: 12,
    })
    const ml2 = mallaLetreros(letreros, { ref: 72, min: 0.75, max: 2.45, cerca: [9, 22], brillo: 1.3, nombre: `navegacion-${nivel}-letreros` })
    if (ml2) grupo.add(ml2)
  }
}

// ═══════════════════════════════════════════════════════════════
// Ciudad
// ═══════════════════════════════════════════════════════════════

function construirCiudadLetreros(ctx: CtxEscena) {
  const grupo = ctx.niveles.ciudad
  if (!grupo) return
  const y0 = ALTURA_NIVEL.ciudad
  const colores = ["#ffc35a", "#3fd6ff", "#ff4fae", "#9a6bff", "#7fd67f"]
  const letreros: Letrero[] = LUGARES.filter((l) => l.nivel === "ciudad").map((l, i) => {
    const x = (l.x0 + l.x1) / 2
    const z = (l.z0 + l.z1) / 2
    // Bajo la bóveda y sobre lo construido (las torres son altas).
    const alto = l.id === "ciudad-torres" ? 30 : l.id === "ciudad-arena" ? 18 : 12
    const y = Math.min(techoCiudad(x, z) - 4, y0 + alto)
    return { x, y, z, titulo: l.nombre.toUpperCase(), color: colores[i % colores.length], ancho: 11 }
  })
  const asc = ejeAscensor("ciudad")
  letreros.push({ x: asc.x, y: Math.min(techoCiudad(asc.x, asc.z) - 6, y0 + 16), z: asc.z, titulo: "ASCENSOR", sub: "SUBSUELOS Y SUPERFICIE ↑", color: CIAN, ancho: 11 })
  const m = mallaLetreros(letreros, { ref: 70, min: 0.7, max: 2.4, cerca: [10, 26], brillo: 1.2, nombre: "navegacion-ciudad-letreros" })
  if (m) grupo.add(m)
}

// ═══════════════════════════════════════════════════════════════
// Superficie: el pabellón del ascensor
// ═══════════════════════════════════════════════════════════════

/** El letrero de la fachada del pabellón: "SUBSUELO ↓" (dos caras, se enciende de noche). */
function texturaCartelPabellon(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 192
  const g = c.getContext("2d")!
  const dibujar = () => {
    const fuente = fuenteCondensada()
    g.fillStyle = "#0b0e14"
    g.fillRect(0, 0, 1024, 192)
    g.fillStyle = DORADO
    g.fillRect(0, 184, 1024, 8)
    g.textAlign = "center"
    g.textBaseline = "middle"
    texto(g, "SUBSUELO ↓", 512, 82, 118, 800, fuente, 940, "#ffffff")
    texto(g, "DEPARTAMENTOS · CIUDAD SUBTERRÁNEA", 512, 156, 40, 700, fuente, 900, DORADO)
  }
  dibujar()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  document.fonts?.ready.then(() => {
    dibujar()
    t.needsUpdate = true
  })
  return t
}

function caja(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

function construirPabellon(ctx: CtxEscena) {
  const P = PABELLON_ASCENSOR
  const grupo = new THREE.Group()
  grupo.name = "pabellon-ascensor"
  const hx = P.ancho / 2
  const hz = P.fondo / 2
  const x0 = P.x - hx
  const x1 = P.x + hx
  const z0 = P.z - hz
  const z1 = P.z + hz
  const H = P.alto
  const sombras = ctx.sombras

  // Zócalo de granito oscuro y piso de piedra.
  const piedra = new THREE.MeshStandardMaterial({ name: "pabellon-piedra", color: "#2b2d31", roughness: 0.35, metalness: 0.1 })
  const base = new THREE.Mesh(caja(x0 - 0.6, x1 + 0.6, 0, 0.16, z0 - 0.6, z1 + 0.6), piedra)
  base.receiveShadow = sombras
  grupo.add(base)

  // Marcos de bronce oscuro: parantes, dinteles y la cornisa.
  const bronce = new THREE.MeshStandardMaterial({ name: "pabellon-bronce", color: "#4a3b2a", roughness: 0.38, metalness: 0.85 })
  const marcos: THREE.BufferGeometry[] = []
  const t = 0.12
  for (const x of [x0, x0 + 1.9, x1 - 1.9, x1]) for (const z of [z0, z1]) marcos.push(caja(x - t, x + t, 0.16, H, z - t, z + t))
  for (const z of [z0 + hz]) for (const x of [x0, x1]) marcos.push(caja(x - t, x + t, 0.16, H, z - t, z + t))
  for (const z of [z0, z1]) marcos.push(caja(x0, x1, H - 0.18, H, z - t, z + t), caja(x0, x1, 0.16, 0.3, z - t, z + t))
  for (const x of [x0, x1]) marcos.push(caja(x - t, x + t, H - 0.18, H, z0, z1), caja(x - t, x + t, 0.16, 0.3, z0, z1))
  // Puertas del ascensor (al fondo, mirando al sur) y su marco.
  for (const s of [-1, 1]) marcos.push(caja(P.x + s * 1.1 - 0.75, P.x + s * 1.1 + 0.75, 0.16, 2.55, z0 + 0.25, z0 + 0.4))
  const mMarcos = new THREE.Mesh(mergeGeometries(marcos), bronce)
  mMarcos.castShadow = sombras
  grupo.add(mMarcos)
  for (const g of marcos) g.dispose()

  // Vidrio claro (no el de las ventanas: este deja ver adentro).
  const vidrio = new THREE.MeshStandardMaterial({
    name: "pabellon-vidrio",
    color: "#d6eef5",
    transparent: true,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const vidrios: THREE.BufferGeometry[] = []
  // Frente y fondo con la abertura de la puerta (2,4 m) al centro: el camino del jardín pasa por adentro.
  for (const z of [z0, z1]) {
    vidrios.push(caja(x0, P.x - 1.2, 0.3, H - 0.18, z - 0.02, z + 0.02), caja(P.x + 1.2, x1, 0.3, H - 0.18, z - 0.02, z + 0.02))
    vidrios.push(caja(P.x - 1.2, P.x + 1.2, 2.7, H - 0.18, z - 0.02, z + 0.02))
  }
  for (const x of [x0, x1]) vidrios.push(caja(x - 0.02, x + 0.02, 0.3, H - 0.18, z0, z1))
  const mVidrio = new THREE.Mesh(mergeGeometries(vidrios), vidrio)
  mVidrio.renderOrder = 3
  grupo.add(mVidrio)
  for (const g of vidrios) g.dispose()

  // Techo: losa blanca como la fachada, con un canto de luz cálida abajo.
  const techo = new THREE.Mesh(caja(x0 - 0.5, x1 + 0.5, H, H + 0.42, z0 - 0.5, z1 + 0.5), ctx.materiales.moldura)
  techo.castShadow = sombras
  techo.receiveShadow = sombras
  grupo.add(techo)
  const luz = new THREE.MeshStandardMaterial({ name: "pabellon-luz", color: "#000000", emissive: "#ffcf94", emissiveIntensity: 1 })
  ctx.alAnochecer(luz, 4, 1.4)
  const tiras: THREE.BufferGeometry[] = [
    caja(x0 - 0.45, x1 + 0.45, H - 0.04, H, z0 - 0.45, z0 - 0.35),
    caja(x0 - 0.45, x1 + 0.45, H - 0.04, H, z1 + 0.35, z1 + 0.45),
    // Plafón interior y la luz sobre las puertas.
    caja(x0 + 0.5, x1 - 0.5, H - 0.03, H - 0.01, z0 + 0.6, z1 - 0.6),
    caja(P.x - 2, P.x + 2, 2.62, 2.72, z0 + 0.3, z0 + 0.42),
  ]
  const mLuz = new THREE.Mesh(mergeGeometries(tiras), luz)
  grupo.add(mLuz)
  for (const g of tiras) g.dispose()

  // El letrero sobre el techo, de dos caras (sur y norte).
  const tex = texturaCartelPabellon()
  const cartel = new THREE.MeshStandardMaterial({ name: "pabellon-cartel", map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1, roughness: 0.5 })
  ctx.alAnochecer(cartel, 2.2, 0.9)
  const ancho = P.ancho - 0.6
  const alto = (ancho * 192) / 1024
  const yc = H + 0.42 + alto / 2 + 0.12
  // Caja de luz angosta al centro del techo; una cara al sur (el jardín) y otra al norte (la casa).
  const fondoCaja = 0.32
  const soporte = new THREE.Mesh(caja(P.x - ancho / 2 - 0.08, P.x + ancho / 2 + 0.08, H + 0.42, yc + alto / 2 + 0.08, P.z - fondoCaja / 2, P.z + fondoCaja / 2), bronce)
  soporte.castShadow = sombras
  grupo.add(soporte)
  for (const [z, rot] of [
    [P.z + fondoCaja / 2 + 0.01, 0],
    [P.z - fondoCaja / 2 - 0.01, Math.PI],
  ] as Array<[number, number]>) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), cartel)
    pl.position.set(P.x, yc, z)
    pl.rotation.y = rot
    grupo.add(pl)
  }

  grupo.updateMatrixWorld(true)
  ctx.niveles.superficie.add(grupo)
  // Tocar el pabellón abre el mapa (la interfaz entiende "ascensor").
  ctx.seleccionable(grupo, "ascensor")

  // Marcador flotante, como en un juego: se ve desde la vista aérea, por encima de la Residencia.
  const marcador = mallaLetreros(
    [{ x: P.x, y: 9, z: P.z, titulo: "ASCENSOR ↓", sub: `SUBSUELOS · ${NIVEL_CORTO.ciudad.toUpperCase()}`, color: DORADO, ancho: 10 }],
    { ref: 70, min: 0.8, max: 6, cerca: [16, 40], brillo: 1.15, nombre: "navegacion-superficie-marcador", encima: true },
  )
  if (marcador) {
    ctx.niveles.superficie.add(marcador)
    // Flota apenas: se nota que es un marcador y no parte del edificio.
    ctx.alActualizar((tick) => {
      marcador.position.y = Math.sin(tick.tiempo * 1.4) * 0.35
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// Entrada
// ═══════════════════════════════════════════════════════════════

export function construirNavegacion(ctx: CtxEscena): void {
  construirPabellon(ctx)
  construirSubsuelos(ctx, atlasPiso())
  construirCiudadLetreros(ctx)
}
