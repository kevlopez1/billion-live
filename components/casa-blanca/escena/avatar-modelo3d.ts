// ──────────────────────────────────────────────────────────────
// Personajes en 3D de verdad (TRELLIS.2, hechos en la MacBook de Kev).
//
// Cada GLB de public/casa-blanca/modelos-v1/<id>.glb trae la malla parada, a
// su altura real, con color por vértice y un atributo propio `_hueso`
// (hueso1, hueso2, peso1 × 255, 0, en bytes) calculado al exportar (ia3d/herramientas/huesos.py),
// con los índices de HUESOS de avatar-cuerpo.ts. Aquí se pega al mismo
// esqueleto del personaje armado, así camina, se sienta y gesticula con las
// mismas animaciones. Mientras carga (o si falla) se ve el personaje armado.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

const CARPETA = "/casa-blanca/modelos-v1"

/** Personajes que tienen modelo 3D. */
export const CON_MODELO = new Set([
  "trump", "suntzu", "thiel", "altman", "musk", "hormozi", "amodei", "pichai", "mason", "iluminado", "jesus", "karp",
  "marco", "napoleon", "tate", "gadzhi", "kobe", "socrates", "cleopatra", "leonardo", "lincoln", "jobs", "claude", "chatgpt",
])

/** Se puede apagar con ?modelos=0 en la dirección (para comparar con los armados). */
export function usarModelo(id: string): boolean {
  if (typeof window === "undefined") return false
  if (new URLSearchParams(window.location.search).get("modelos") === "0") return false
  return CON_MODELO.has(id)
}

let cargador: GLTFLoader | null = null
const geometrias = new Map<string, Promise<THREE.BufferGeometry>>()

/** Geometría lista para piel (una por personaje; se comparte si se pide dos veces). */
function geometria(id: string): Promise<THREE.BufferGeometry> {
  let g = geometrias.get(id)
  if (!g) {
    cargador ??= new GLTFLoader()
    g = cargador.loadAsync(`${CARPETA}/${id}.glb`).then((gltf) => {
      let malla: THREE.Mesh | null = null
      gltf.scene.traverse((o) => {
        if (!malla && (o as THREE.Mesh).isMesh) malla = o as THREE.Mesh
      })
      if (!malla) throw new Error(`sin malla en ${id}.glb`)
      const geo = (malla as THREE.Mesh).geometry as THREE.BufferGeometry
      const hueso = geo.getAttribute("_hueso") as THREE.BufferAttribute | undefined
      if (!hueso) throw new Error(`sin _hueso en ${id}.glb`)
      const n = hueso.count
      const idx = new Uint16Array(n * 4)
      const pes = new Float32Array(n * 4)
      for (let i = 0; i < n; i++) {
        idx[i * 4] = hueso.getX(i)
        idx[i * 4 + 1] = hueso.getY(i)
        const w = hueso.getZ(i) / 255
        pes[i * 4] = w
        pes[i * 4 + 1] = 1 - w
      }
      geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4))
      geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(pes, 4))
      geo.deleteAttribute("_hueso")
      // El color se guardó en sRGB; three lo espera lineal.
      const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined
      if (col) {
        const c = new THREE.Color()
        const lin = new Float32Array(col.count * 3)
        for (let i = 0; i < col.count; i++) {
          c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.SRGBColorSpace)
          lin[i * 3] = c.r
          lin[i * 3 + 1] = c.g
          lin[i * 3 + 2] = c.b
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(lin, 3))
      }
      geo.computeVertexNormals()
      return geo
    })
    g.catch(() => geometrias.delete(id))
    geometrias.set(id, g)
  }
  return g
}

let material: THREE.MeshStandardMaterial | null = null
let matSombrero: THREE.MeshStandardMaterial | null = null

export interface Modelo3D {
  malla: THREE.SkinnedMesh
  extras: THREE.Object3D[]
  triangulos: number
}

/**
 * Carga el modelo y lo pega al esqueleto. `alto` = altura del personaje armado
 * (la malla se escala para coincidir). `listo` recibe la malla ya pegada.
 */
export function cargarModelo3D(
  id: string,
  op: { alto: number; esqueleto: THREE.Skeleton; huesos: THREE.Bone[]; cabezaY: number; chistera: boolean; vivo: () => boolean },
  listo: (m: Modelo3D) => void,
) {
  geometria(id)
    .then((base) => {
      if (!op.vivo()) return
      const geo = base.clone()
      geo.computeBoundingBox()
      const k = op.alto / (geo.boundingBox!.max.y || op.alto)
      if (Math.abs(k - 1) > 0.002) geo.scale(k, k, k)
      material ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide })
      const malla = new THREE.SkinnedMesh(geo, material)
      malla.name = `modelo3d-${id}`
      malla.castShadow = true
      malla.receiveShadow = true
      malla.raycast = () => {}
      malla.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, op.alto * 0.5, 0), op.alto * 0.85)
      // El esqueleto se armó con el personaje en el origen: se pega con matriz identidad.
      malla.bind(op.esqueleto, new THREE.Matrix4())
      const extras: THREE.Object3D[] = []
      let triangulos = (geo.index ? geo.index.count : geo.getAttribute("position").count) / 3
      if (op.chistera) {
        // Lincoln: la chistera no salió en la imagen de origen; va aparte, en el hueso de la cabeza.
        matSombrero ??= new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.55 })
        const s = op.alto / 1.93
        const g = new THREE.Group()
        const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.088 * s, 0.084 * s, 0.2 * s, 28), matSombrero)
        copa.position.y = 0.1 * s
        const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 0.012 * s, 32), matSombrero)
        g.add(copa, ala)
        for (const m of [copa, ala]) {
          m.castShadow = true
          m.raycast = () => {}
        }
        const cab = op.huesos[4]
        g.position.set(0, op.alto - 0.035 * s - op.cabezaY, -0.01 * s)
        cab.add(g)
        extras.push(g)
        triangulos += 28 * 4 + 32 * 4
      }
      listo({ malla, extras, triangulos })
    })
    .catch((e) => console.warn("[casa-blanca] modelo 3D", id, e))
}
