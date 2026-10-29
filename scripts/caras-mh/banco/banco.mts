// Banco de las caras MakeHuman (navegador; lo arma y lo abre correr.cjs). Usa el código del REPO tal cual:
// crearAvatarReal (con ?caras=hoy, así no monta solo) + caraMH (avatar-cara-mh.ts).
// Modos:
//   hornear  re-hornea el pelo de hoy reajustado sobre la cara MH (reajuste en vivo, segundos por residente) y
//            lo devuelve en window.extra → <id>/pelo-hoy.{bin,json}. Hace falta cada vez que cambia el pelo o
//            la barba de hoy (avatar-pelo.ts, una ficha, el cuerpo): la huella del pelo no coincide y la web
//            deja la cabeza de hoy. Foto: los horneados, de 3/4.
//   ver      grilla de recortes: encuadre=cara|cuello|cuerpo, horas=12,17.5, hoy=1 (columna de hoy al lado),
//            estado=quieto|habla|camina, t=segundos de animación, giro=radianes alrededor del personaje.
import * as THREE from "three"
import { PERSONAJES } from "../../../components/casa-blanca/datos/personajes"
import { crearAvatarReal } from "../../../components/casa-blanca/escena/avatar-armado"
import { Cielo } from "../../../components/casa-blanca/escena/motor-cielo"
import { Post } from "../../../components/casa-blanca/escena/motor-post"
import { H } from "../../../components/casa-blanca/escena/avatar-cuerpo"
import type { Avatar } from "../../../components/casa-blanca/escena/contrato"
import type { EstadoCuerpo } from "../../../components/casa-blanca/tipos"
import { caraMH } from "../../../components/casa-blanca/escena/avatar-cara-mh"
import type { Montada } from "../../../components/casa-blanca/escena/avatar-cara-mh-montaje"

const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
const modo = q.get("modo") ?? "ver"
const ids = (q.get("ids") ?? "trump").split(",").filter(Boolean)
const horas = (q.get("horas") ?? "12").split(",").map(Number)
const BASE = "/casa-blanca/caras"
const info: Record<string, unknown> = {}

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
const scene = new THREE.Scene()
const cielo = new Cielo(scene, renderer, "alta")
const sol = cielo.sol
sol.castShadow = true
sol.shadow.mapSize.set(2048, 2048)
sol.shadow.bias = -0.0002
sol.shadow.normalBias = 0.02
const sc = sol.shadow.camera as THREE.OrthographicCamera
sc.left = -2; sc.right = 2; sc.top = 2.5; sc.bottom = -0.5; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix()
function ponerHora(h: number) {
  const amb = cielo.setHora(h)
  renderer.toneMappingExposure = amb.exposicion
  scene.environment = cielo.entorno(0, true)
  scene.environmentIntensity = cielo.intensidadEntorno
  sol.position.copy(cielo.luzDir).multiplyScalar(50)
  sol.target.position.set(0, 0, 0)
}
ponerHora(horas[0])
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#9a958c", roughness: 0.9 }))
suelo.rotation.x = -Math.PI / 2
suelo.receiveShadow = true
scene.add(suelo)
const fondo = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: "#5d6670", roughness: 0.95 }))
scene.add(fondo)
// el sol de 3/4 respecto de la cámara (fijado con la primera hora)
const azSol = Math.atan2(cielo.luzDir.x, cielo.luzDir.z)
const azCam = azSol + num("giroSol", 0.6)
const haciaCam = new THREE.Vector3(Math.sin(azCam), 0, Math.cos(azCam))
const camara = new THREE.PerspectiveCamera(20, 1, 0.05, 9000)
const post = new Post(renderer, scene, camara, "alta")
const lienzo = document.createElement("canvas")
const ctx = lienzo.getContext("2d")!
document.body.appendChild(lienzo)
const dt = 1 / 30

async function crear(id: string, mh: boolean, reajusteVivo = false): Promise<{ a: Avatar; m: Montada | null }> {
  const p = PERSONAJES.find((x) => x.id === id)
  if (!p) throw new Error("no existe " + id)
  const calidad = (q.get("calidad") ?? "alta") as "alta" | "media" | "baja"
  const a = crearAvatarReal(p, { calidad })
  let m: Montada | null = null
  if (mh) {
    const r = await caraMH(a, p, { base: BASE, calidad, reajusteVivo, sinPeloHorneado: reajusteVivo })
    if (!r.ok || !r.m) throw new Error(`caraMH ${id}: ${r.error}`)
    m = r.m
    for (const x of r.m.mallas) x.frustumCulled = false
    a.raiz.userData.triangulos += r.triangulos ?? 0
    a.raiz.userData.dibujos += r.dibujos ?? 0
    info[id] = { ms: r.ms, tris: a.raiz.userData.triangulos, dibujos: a.raiz.userData.dibujos, soldadura: [r.info?.soldaduraSobreCuelloMin, r.info?.soldaduraSobreCuelloMax], ctrl: r.info?.ctrl, reajuste: r.info?.reajuste_ms }
  } else info[id + "-hoy"] = { tris: a.raiz.userData.triangulos, dibujos: a.raiz.userData.dibujos }
  a.raiz.rotation.y = Math.atan2(haciaCam.x, haciaCam.z)
  scene.add(a.raiz)
  const estado = (q.get("estado") ?? "quieto") as EstadoCuerpo
  const pasos = Math.round(num("t", 1.2) / dt)
  for (let i = 0; i < pasos; i++) { a.animar(estado, dt, estado === "camina" ? 1.4 : 0); m?.actualizar() }
  a.raiz.updateMatrixWorld(true)
  // dbgPiel=1: piel MH en rojo y la de hoy en verde (dónde está la costura)
  if (m && q.get("dbgPiel") === "1") {
    const mh = new Set(m.mallas.map((x) => x.geometry))
    a.raiz.traverse((o) => {
      const x = o as THREE.SkinnedMesh
      if (!x.isSkinnedMesh) return
      const n = (x.material as THREE.Material).name || ""
      if (mh.has(x.geometry) && x === m.mallas[0]) x.material = new THREE.MeshLambertMaterial({ color: "#d03030" })
      else if (n.startsWith("piel-") || n.startsWith("androide-piel")) x.material = new THREE.MeshLambertMaterial({ color: "#30c040" })
    })
  }
  if (m && q.get("dbg") === "1") {
    const v = new THREE.Vector3()
    info[id + "-dbg"] = m.mallas.map((x) => {
      const n = x.geometry.getAttribute("position").count, c = new THREE.Vector3()
      for (let i = 0; i < n; i += 7) { x.getVertexPosition(i, v); c.add(v.applyMatrix4(x.matrixWorld)) }
      c.multiplyScalar(7 / n)
      return { n, mat: (x.material as THREE.Material).type, infl: x.morphTargetInfluences?.map((k) => +k.toFixed(2)), c: [c.x, c.y, c.z].map((k) => +k.toFixed(3)), bones: Array.from((x.geometry.getAttribute("skinIndex") as THREE.BufferAttribute).array.slice(0, 4)) }
    })
  }
  return { a, m }
}

function hueso(a: Avatar, i: number): THREE.Vector3 {
  let sm: THREE.SkinnedMesh | null = null
  a.raiz.traverse((o) => { if (!sm && (o as THREE.SkinnedMesh).isSkinnedMesh) sm = o as THREE.SkinnedMesh })
  return (sm as unknown as THREE.SkinnedMesh).skeleton.bones[i].getWorldPosition(new THREE.Vector3())
}
function encuadrar(a: Avatar, tipo: string, giro: number) {
  const ojos = hueso(a, H.ojoI).add(hueso(a, H.ojoD)).multiplyScalar(0.5)
  const az = Math.atan2(haciaCam.x, haciaCam.z) + giro
  const d = new THREE.Vector3(Math.sin(az), 0.04, Math.cos(az)).normalize()
  let obj = ojos.clone().add(new THREE.Vector3(0, -0.03, 0)), dist = 1.25, fov = 17
  if (tipo === "cuello") { obj = hueso(a, H.cuello).lerp(ojos, 0.25); dist = 1.0; fov = 17 }
  if (tipo === "cuerpo") { obj = new THREE.Vector3(0, a.altura * 0.55, 0); dist = a.altura * 3; fov = 22 }
  camara.fov = num("fov", fov)
  camara.position.copy(obj).addScaledVector(d, num("dist", dist))
  camara.lookAt(obj)
  camara.updateProjectionMatrix()
}
function foto(T: number): HTMLCanvasElement {
  renderer.setSize(T, T, false); post.setSize(T, T, 1); camara.aspect = 1; camara.updateProjectionMatrix()
  const d = new THREE.Vector3(); camara.getWorldDirection(d); d.y = 0; d.normalize()
  fondo.position.set(0, 9.9, 0).addScaledVector(d, 4)
  fondo.lookAt(camara.position.x, 9.9, camara.position.z)
  cielo.actualizar(dt, 1.2, camara)
  post.aplicar(cielo.ambiente, 0, 0, 1.2, false)
  post.render(dt)
  return renderer.domElement
}
function etiqueta(txt: string, x: number, y: number, w: number) {
  ctx.font = "600 16px sans-serif"; ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x, y, w, 26)
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(txt, x + w / 2, y + 19)
}

function codificar(id: string, h: NonNullable<Montada["horneable"]>) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
  for (let i = 0; i < h.pos.length; i++) { mn[i % 3] = Math.min(mn[i % 3], h.pos[i]); mx[i % 3] = Math.max(mx[i % 3], h.pos[i]) }
  const esc = mn.map((x, e) => (mx[e] - x) / 65535 || 1e-9)
  let off = h.n * 6
  off += off % 4
  const buf = new ArrayBuffer(off + h.idx.length * 4 + (h.cuero ? h.cuero.length : 0))
  const q16 = new Uint16Array(buf, 0, h.n * 3)
  for (let i = 0; i < h.n * 3; i++) q16[i] = Math.round((h.pos[i] - mn[i % 3]) / esc[i % 3])
  new Uint32Array(buf, off, h.idx.length).set(h.idx)
  if (h.cuero) new Uint8Array(buf, off + h.idx.length * 4, h.cuero.length).set(Array.from(h.cuero, (x) => Math.round(x * 255)))
  let s = ""
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  const w = window as unknown as { extra?: Record<string, string> }
  w.extra = { ...(w.extra ?? {}), [`${id}/pelo-hoy.bin`]: btoa(s), [`${id}/pelo-hoy.json`]: btoa(JSON.stringify({ n: h.n, min: mn, esc, nIdx: h.idx.length, nCuero: h.cuero ? h.cuero.length : 0, huella: h.huella, nota: "pelo de hoy reajustado sobre la cara MH (avatar-cara-mh-montaje.ts), horneado por scripts/caras-mh/banco modo=hornear" })) }
}

async function main() {
  const T = num("tam", 360)
  if (modo === "hornear") {
    const cols = Math.min(ids.length, num("cols", 8))
    lienzo.width = cols * T; lienzo.height = Math.ceil(ids.length / cols) * T
    for (let i = 0; i < ids.length; i++) {
      const { a, m } = await crear(ids[i], true, true)
      if (!m?.horneable) throw new Error("sin horneable: " + ids[i])
      codificar(ids[i], m.horneable)
      encuadrar(a, "cara", num("giro", -0.55))
      ctx.drawImage(foto(T), (i % cols) * T, Math.floor(i / cols) * T)
      etiqueta(ids[i], (i % cols) * T, Math.floor(i / cols) * T + T - 26, T)
      a.dispose()
    }
  } else {
    const conHoy = q.get("hoy") === "1"
    const porFila = horas.length * (conHoy ? 2 : 1)
    lienzo.width = porFila * T; lienzo.height = ids.length * T
    for (let h = 0; h < horas.length; h++) {
      ponerHora(horas[h])
      for (let i = 0; i < ids.length; i++) {
        for (const mh of conHoy ? [false, true] : [true]) {
          const { a } = await crear(ids[i], mh)
          encuadrar(a, q.get("encuadre") ?? "cara", num("giro", -0.55))
          const x = (h * (conHoy ? 2 : 1) + (mh && conHoy ? 1 : 0)) * T, y = i * T
          ctx.drawImage(foto(T), x, y)
          etiqueta(`${ids[i]} · ${mh ? "MH" : "hoy"} · ${horas[h]} h`, x, y + T - 26, T)
          a.dispose()
        }
      }
    }
  }
  const w = window as unknown as Record<string, unknown>
  w.info = info
  w.png = lienzo.toDataURL("image/png")
  w.listo = true
}
main().catch((e) => { console.error("ERROR " + (e?.stack || e)); const w = window as unknown as Record<string, unknown>; w.info = { error: String(e?.stack || e) }; w.listo = true })
