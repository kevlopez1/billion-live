// ──────────────────────────────────────────────────────────────
// Arma un personaje: esqueleto, piel, ojos, ropa, pelo y accesorios, y le
// da vida (avatar-anim.ts). Cumple el contrato Avatar de contrato.ts.
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Avatar } from "./contrato"
import type { EstadoCuerpo, Personaje } from "../tipos"
import { Cuerpo, mallaPiel, type Cobertura } from "./avatar-cuerpo"
import { matOjo, matPiel } from "./avatar-materiales"

export function crearAvatarReal(p: Personaje): Avatar {
  const ap = p.apariencia
  const cu = new Cuerpo(p, 0)
  const { huesos, esqueleto } = cu.esqueleto()
  const raiz = new THREE.Group()
  raiz.name = `avatar-${p.id}`
  raiz.userData.personajeId = p.id
  raiz.add(huesos[0])
  const cub: Cobertura = { tronco: () => false, brazo: () => false, pierna: () => false, pie: false, manos: false }
  const { lote, ojos } = mallaPiel(cu, cub, { sombraBarba: 0.15, barbaDias: false })
  const gPiel = lote.geometria()
  const mallas: THREE.SkinnedMesh[] = []
  const piel = new THREE.SkinnedMesh(gPiel, matPiel(ap.piel))
  const gOjos = ojos.geometria()
  const mOjos = new THREE.SkinnedMesh(gOjos, matOjo(cu.rasgos.iris))
  for (const m of [piel, mOjos]) {
    m.castShadow = true
    m.receiveShadow = true
    raiz.add(m)
    m.bind(esqueleto)
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, cu.H * 0.5, 0), cu.H * 0.8)
    mallas.push(m)
  }
  const cabeza = new THREE.Object3D()
  cabeza.position.y = cu.H + 0.3
  raiz.add(cabeza)
  const tris = lote.triangulos + ojos.triangulos
  raiz.userData.triangulos = tris
  return {
    raiz,
    altura: cu.H,
    cabeza,
    animar(_e: EstadoCuerpo, _dt: number, _v: number) {},
    resaltar() {},
    dispose() {
      raiz.removeFromParent()
      gPiel.dispose()
      gOjos.dispose()
      esqueleto.dispose()
    },
  }
}
