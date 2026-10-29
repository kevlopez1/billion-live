// ──────────────────────────────────────────────────────────────
// Arma un personaje: esqueleto, piel, ojos, ropa, pelo y accesorios, y le
// da vida (avatar-anim.ts). Cumple el contrato Avatar de contrato.ts.
//
// Mallas por personaje (una por material, todas con el mismo esqueleto):
// piel, ropa, pelo, ojos y, si hace falta, cristales de gafas, lo que lleva
// en la mano y el balón; más la sombra de contacto y el anillo de selección.
// Las IA (holograma) son una sola malla de luz con prepaso de profundidad.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import type { Avatar } from "./contrato"
import type { EstadoCuerpo, Personaje } from "../tipos"
import { Cuerpo, mallaPiel } from "./avatar-cuerpo"
import { vestir, holguraDe } from "./avatar-ropa"
import { armarPelo } from "./avatar-pelo"
import { Animador } from "./avatar-anim"
import { hashTexto } from "./avatar-geo"
import { conFicha, vestuarioDe } from "./avatar-fichas"
import { matHolograma, matLente, matOjo, matPelo, matPiel, matRopa, matSombra } from "./avatar-materiales"
import { texBalon, texPunto, texSombra } from "./avatar-texturas"
import { esAndroide, matCejasLuz, matRopaAndroide, prepararAndroide } from "./avatar-androide"

let matBalon: THREE.MeshStandardMaterial | null = null
let geoBalon: THREE.SphereGeometry | null = null
const sinRayos = () => {}

export function crearAvatarReal(original: Personaje): Avatar {
  // La ficha puede corregir la Apariencia (ropa, colores, peinado base).
  const p = conFicha(original)
  const ap = p.apariencia
  const holo = ap.ropa.tipo === "holograma"
  const cu = new Cuerpo(p, holguraDe(ap))
  const raiz = new THREE.Group()
  raiz.name = `avatar-${p.id}`
  raiz.userData.personajeId = p.id
  const s = cu.s

  const ropa = vestir(cu, p)
  const { lote: lPiel, ojos: lOjos } = mallaPiel(cu, ropa.cobertura, { sombraBarba: ropa.sombraBarba })
  const espalda = ap.ropa.tipo === "traje" || ap.ropa.tipo === "uniforme_militar" ? 0.02 : 0.026
  // Androide (Claude, ChatGPT): sin pelo (solo pestañas), cejas de luz y la
  // piel con sus líneas (avatar-androide.ts). Se prepara antes de reproporcionar.
  const andro = esAndroide(p) ? prepararAndroide(cu, p, lPiel) : null
  const lPelo = andro ? andro.pelo : armarPelo(cu, p, { holguraEspalda: espalda, bajoSombrero: !!ap.sombrero && ap.sombrero !== "laurel" && ap.sombrero !== "corona_egipcia", sombreroY: 0.07 })
  // Largo de piernas, brazos y cuello de la ficha: se estira todo junto (piel,
  // ropa, pelo) antes de armar el esqueleto.
  cu.reproporcionar([lPiel, lOjos, ropa.lote, lPelo, ...(ropa.lentes ? [ropa.lentes.lote] : []), ...(ropa.utileria ? [ropa.utileria] : []), ...(andro?.cejas ? [andro.cejas] : [])])

  const { huesos, esqueleto } = cu.esqueleto()
  raiz.add(huesos[0])
  const propias: Array<{ dispose(): void }> = [esqueleto]
  const mallas: THREE.Mesh[] = []
  let triangulos = 0
  const esfera = new THREE.Sphere(new THREE.Vector3(0, cu.H * 0.5, 0), cu.H * 0.85)
  const piel = (g: THREE.BufferGeometry, m: THREE.Material, sombra = true): THREE.SkinnedMesh => {
    const malla = new THREE.SkinnedMesh(g, m)
    malla.castShadow = sombra
    malla.receiveShadow = !holo
    raiz.add(malla)
    malla.bind(esqueleto)
    // Esfera fija: incluye todas las poses (el cálculo por defecto usa la pose del primer cuadro).
    malla.boundingSphere = esfera
    // Los clics los toma la caja invisible: no se recorren miles de triángulos con piel.
    malla.raycast = sinRayos
    malla.frustumCulled = true
    propias.push(g)
    mallas.push(malla)
    triangulos += (g.index ? g.index.count : g.getAttribute("position").count) / 3
    return malla
  }

  let holoMats: { color: THREE.ShaderMaterial; prepaso: THREE.ShaderMaterial } | null = null
  let particulas: THREE.Points | null = null
  let utileria: THREE.SkinnedMesh | null = null
  let balon: THREE.Mesh | null = null

  if (holo) {
    // Una sola figura de luz: piel, ropa, pelo y ojos fundidos.
    const partes = [lPiel.geometria(), ropa.lote.geometria(), lPelo.geometria(), lOjos.geometria()]
    for (const g of partes) {
      g.deleteAttribute("uv1")
      g.deleteAttribute("aArr")
    }
    // El pelo de luz es una masa esculpida: sin el alfa de las hebras (que el
    // holograma descartaba, y las cabezas salían calvas).
    const cPelo = partes[2].getAttribute("color") as THREE.BufferAttribute | undefined
    if (cPelo && cPelo.itemSize === 4) for (let i = 0; i < cPelo.count; i++) cPelo.setW(i, 1)
    const g = mergeGeometries(partes, false)!
    for (const x of partes) x.dispose()
    const ves = vestuarioDe(p.id)
    holoMats = matHolograma(ap.ropa.color, ap.ropa.color2 ?? "#ffffff", cu.H, { hex: !!ves.chaquetaMao, fundir: !!ves.abrigo })
    propias.push(holoMats.color, holoMats.prepaso)
    const pre = piel(g, holoMats.prepaso, false)
    pre.renderOrder = 10
    const col = new THREE.SkinnedMesh(g, holoMats.color)
    col.renderOrder = 11
    raiz.add(col)
    col.bind(esqueleto)
    col.boundingSphere = esfera
    col.raycast = sinRayos
    mallas.push(col)
    // Partículas que suben alrededor del cuerpo.
    const n = 70
    const pos = new Float32Array(n * 3)
    const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1
    for (let i = 0; i < n; i++) {
      const a = rnd(i, 1) * Math.PI * 2
      const r = (0.18 + rnd(i, 2) * 0.16) * s
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = rnd(i, 3) * cu.H
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const gP = new THREE.BufferGeometry()
    gP.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const mP = new THREE.PointsMaterial({ color: ap.ropa.color2 ?? ap.ropa.color, map: texPunto(), size: 0.03 * s, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    propias.push(gP, mP)
    particulas = new THREE.Points(gP, mP)
    particulas.raycast = sinRayos
    raiz.add(particulas)
  } else {
    const gPiel = lPiel.geometria()
    andro?.atributos(gPiel)
    piel(gPiel, andro ? andro.matPiel : matPiel(cu.rasgos.f.piel.base))
    piel(ropa.lote.geometria(), andro ? matRopaAndroide(p, ropa.tejido) : matRopa(ropa.tejido, ropa.numero))
    // El pelo no proyecta sombra: con alfa recortado, las hebras dejaban manchas
    // de "tierra" en la frente y en las mejillas (mapa de sombras a 2 mm).
    piel(lPelo.geometria(), andro ? andro.matPestanas : matPelo(cu.rasgos.f.pelo.color, cu.rasgos.f.pelo.rizo >= 0.6), false)
    if (andro?.cejas) piel(andro.cejas.geometria(), matCejasLuz(), false)
    piel(lOjos.geometria(), matOjo(cu.rasgos.iris, cu.rasgos.f.esclera), false)
    if (ropa.lentes) piel(ropa.lentes.lote.geometria(), matLente(ropa.lentes.sol), false)
    if (ropa.utileria) utileria = piel(ropa.utileria.geometria(), matRopa(ropa.tejido, ropa.numero))
    if (ap.accesorios.includes("balon")) {
      matBalon ??= new THREE.MeshStandardMaterial({ map: texBalon(), roughness: 0.72, metalness: 0 })
      geoBalon ??= new THREE.SphereGeometry(0.12, 24, 16)
      balon = new THREE.Mesh(geoBalon, matBalon)
      balon.castShadow = true
      balon.raycast = sinRayos
      raiz.add(balon)
      triangulos += 24 * 16 * 2
    }
  }

  // Caja invisible para los clics (el material no se dibuja).
  const gCaja = new THREE.BoxGeometry(0.62 * s, cu.H, 0.42 * s)
  gCaja.translate(0, cu.H / 2, 0)
  const mCaja = new THREE.MeshBasicMaterial({ visible: false })
  propias.push(gCaja, mCaja)
  const caja = new THREE.Mesh(gCaja, mCaja)
  raiz.add(caja)

  // Sombra de contacto (ayuda a que no floten en la sombra) y anillo de selección.
  const gSombra = new THREE.PlaneGeometry(0.85 * s, 0.85 * s)
  gSombra.rotateX(-Math.PI / 2)
  propias.push(gSombra)
  const sombra = new THREE.Mesh(gSombra, matSombra(holo, texSombra()))
  sombra.position.y = 0.012
  sombra.renderOrder = -1
  sombra.raycast = sinRayos
  raiz.add(sombra)
  const anilloMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, depthWrite: false })
  const anilloGeo = new THREE.RingGeometry(0.42 * s, 0.5 * s, 48)
  anilloGeo.rotateX(-Math.PI / 2)
  propias.push(anilloMat, anilloGeo)
  const anillo = new THREE.Mesh(anilloGeo, anilloMat)
  anillo.position.y = 0.02
  anillo.visible = false
  anillo.raycast = sinRayos
  raiz.add(anillo)

  // Punto sobre la cabeza para etiquetas y burbujas.
  const cabeza = new THREE.Object3D()
  const sobre = ropa.altoSombrero + 0.25
  cabeza.position.y = cu.H + sobre
  raiz.add(cabeza)

  const anim = new Animador(cu, huesos, raiz, { balon, utileria, semilla: hashTexto(p.id) % 997 })
  raiz.userData.triangulos = triangulos
  raiz.userData.dibujos = mallas.length + (balon ? 1 : 0) + 1 + (particulas ? 1 : 0)

  let tiempo = 0
  function animar(estado: EstadoCuerpo, dt: number, velocidad: number) {
    tiempo += Math.max(0, dt)
    anim.actualizar(estado, dt, velocidad)
    cabeza.position.y = anim.coronilla + sobre
    if (holoMats) holoMats.color.uniforms.uTiempo.value = tiempo
    if (particulas) {
      const pos = particulas.geometry.getAttribute("position") as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.3
        if (y > cu.H) y = 0
        pos.setY(i, y)
      }
      pos.needsUpdate = true
    }
  }

  function resaltar(on: boolean) {
    anillo.visible = on
  }

  // Rayos X: si la cámara sigue a alguien que está dentro de un edificio (los
  // interiores no se dibujan), se lo ve a través de las paredes, en su color.
  const matRayos = new THREE.MeshBasicMaterial({
    color: new THREE.Color(p.color).lerp(new THREE.Color("#ffffff"), 0.35),
    transparent: true,
    opacity: 0.62,
    depthTest: false,
    depthWrite: false,
  })
  propias.push(matRayos)
  const originales = new Map<THREE.Mesh, { mat: THREE.Material | THREE.Material[]; orden: number }>()
  // La utilería ya está en `mallas` (la armó piel()): repetirla acá hacía que
  // la segunda pasada guardara el material de rayos como "original" y el
  // objeto quedara transparente a través de las paredes para siempre.
  const todas: THREE.Mesh[] = balon ? [...mallas, balon] : mallas
  let enRayos = false
  function rayosX(on: boolean) {
    if (on === enRayos) return
    enRayos = on
    for (const m of todas) {
      if (on) {
        if (m.material !== matRayos) originales.set(m, { mat: m.material, orden: m.renderOrder })
        m.material = matRayos
        m.renderOrder = 10
      } else {
        const o = originales.get(m)
        if (o) {
          m.material = o.mat
          m.renderOrder = o.orden
        }
      }
    }
    sombra.visible = !on
    if (particulas) particulas.visible = !on
  }

  function dispose() {
    raiz.removeFromParent()
    for (const x of propias) x.dispose()
  }

  animar("quieto", 0, 0)
  return { raiz, altura: cu.H, cabeza, animar, resaltar, rayosX, dispose }
}
