// ──────────────────────────────────────────────────────────────
// EL MANUAL, VISTO COMO ÁRBOL
//
// `/branding` guarda un documento de forma fija (secciones con campos
// propios: los formatos traen beats, las redes traen estado…) y
// `/kevlopez_proyectos` guarda un árbol de nodos libres. Son dos modelos
// distintos a propósito: el manual tiene estructura porque sobre ella se
// apoyan la revisión de la IA y los editores de cada sección.
//
// Pero el mapa y el índice lateral de proyectos ya están hechos, probados y
// se ven como Kev quiere. Así que en vez de escribir un segundo mapa, se
// traduce el manual a la forma que ese mapa entiende. Una traducción, no una
// copia: si el mapa mejora, mejora en los dos lados.
//
// Esto es SOLO de ida (manual → árbol). El árbol no se edita: lo que se edita
// es el documento, y de ahí vuelve a salir el árbol.
// ──────────────────────────────────────────────────────────────

import type { Contenido } from "@/lib/branding"
import { RAIZ, type Doc, type Estado, type Nodo } from "@/lib/proyectos"
import { ETIQUETA_SECCION, type Seccion } from "@/lib/revision"

type Rama = {
  id: Seccion
  icono: string
  /** Los textos de las hojas, ya sacados del documento. */
  hojas: string[]
  /** Estado por hoja, cuando la sección lo tiene (las redes). */
  estados?: Estado[]
}

/** El estado de una red, en los cuatro que entiende el mapa. */
const DE_RED: Record<string, Estado> = { usamos: "listo", pendiente: "idea", no: "pausa" }

function ramas(c: Contenido): Rama[] {
  const limpio = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
  return [
    { id: "personaje", icono: "", hojas: limpio([...c.personaje.fortalezas, ...c.personaje.debilidades, ...c.personaje.oportunidades]) },
    { id: "norte", icono: "", hojas: limpio(c.norte.map((p) => p.titulo)) },
    { id: "formatos", icono: "", hojas: limpio(c.formatos.map((f) => f.nombre)) },
    { id: "edicion", icono: "", hojas: limpio(c.edicion.bloques.map((b) => b.titulo)) },
    {
      id: "redes",
      icono: "",
      hojas: limpio(c.redes.map((r) => r.nombre)),
      estados: c.redes.filter((r) => r.nombre.trim()).map((r) => DE_RED[r.estado] ?? "idea"),
    },
    { id: "produccion", icono: "", hojas: limpio([...c.produccion.personaje, ...c.produccion.equipo]) },
    { id: "enCola", icono: "", hojas: limpio(c.enCola.map((v) => v.titulo)) },
    { id: "pendientes", icono: "", hojas: limpio(c.pendientes) },
    { id: "hoy", icono: "", hojas: limpio(c.hoy.map((l) => l.titulo)) },
    { id: "futuro", icono: "", hojas: limpio(c.futuro.map((l) => l.titulo)) },
  ]
}

/** `sec:norte` para una rama, `sec:norte:2` para su tercera hoja. */
export const idRama = (s: Seccion) => `sec:${s}`
export const seccionDe = (idNodo: string): Seccion | null => {
  const partes = idNodo.split(":")
  return partes[0] === "sec" && partes[1] ? (partes[1] as Seccion) : null
}

export function aDoc(c: Contenido, plegados: Set<string>): Doc {
  const vacio: Omit<Nodo, "id" | "padre" | "titulo" | "icono"> = {
    estado: "idea", meta: "", plazo: "", bloques: [],
  }

  const nodos: Nodo[] = [
    { id: RAIZ, padre: null, titulo: c.meta.proyecto || "El manual", icono: "", ...vacio, estado: "marcha" },
  ]

  for (const r of ramas(c)) {
    const id = idRama(r.id)
    nodos.push({
      id,
      padre: RAIZ,
      titulo: ETIQUETA_SECCION[r.id],
      icono: r.icono,
      ...vacio,
      // El número va en `meta`, que el mapa pinta debajo del título. Una rama
      // vacía lo dice con todas las letras: es lo que hay que ver de lejos.
      meta: r.hojas.length ? `${r.hojas.length}` : "vacía",
      estado: r.hojas.length ? "marcha" : "idea",
      plegado: plegados.has(id),
    })
    if (plegados.has(id)) continue
    r.hojas.forEach((texto, i) => {
      nodos.push({
        id: `${id}:${i}`,
        padre: id,
        titulo: texto,
        icono: "·",
        ...vacio,
        estado: r.estados?.[i] ?? "idea",
      })
    })
  }

  return { v: 1, nodos }
}
