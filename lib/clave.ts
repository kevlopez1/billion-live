// ──────────────────────────────────────────────────────────────
// LA CLAVE, UNA SOLA VEZ POR DISPOSITIVO
//
// Antes cada página privada guardaba la clave por su lado (/branding,
// /kevlopez_proyectos, /preguntas, /centro), y en sessionStorage: se borraba
// al cerrar la pestaña y cada página la volvía a pedir. Para quien entra a
// trabajar todos los días, eso es pedir permiso cuatro veces al día.
//
// Ahora es una, en localStorage: se pide una vez en el dispositivo y sirve
// para todo. El candado de /branding la olvida.
//
// Ojo: el equipo (editor, filmmaker) guarda aquí SU clave, que solo abre el
// manual. Si con ella intentan entrar a algo de Kev, el servidor dice que no
// — pero eso NO borra la clave guardada: si la borrara, también los sacaría
// del manual, que es donde sí pueden estar.
// ──────────────────────────────────────────────────────────────

const K = "kev-admin-clave"
// Las de antes, por página. Se leen una vez para no pedir de nuevo la clave
// a quien ya la había puesto.
const VIEJAS = ["kev-proyectos-clave", "kev-preguntas-clave", "kev-centro-clave"]

export function leerClave(): string | null {
  try {
    const k = localStorage.getItem(K)
    if (k) return k
    for (const v of VIEJAS) {
      const x = sessionStorage.getItem(v)
      if (x) {
        localStorage.setItem(K, x)
        return x
      }
    }
  } catch {}
  return null
}

export function guardarClave(k: string) {
  try { localStorage.setItem(K, k) } catch {}
}

export function olvidarClave() {
  try {
    localStorage.removeItem(K)
    for (const v of VIEJAS) sessionStorage.removeItem(v)
  } catch {}
}
