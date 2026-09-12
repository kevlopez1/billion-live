"use client"

import { useEffect } from "react"

export const MARCA_HOME = "kpg-home-vista"
const POS = "kpg-scroll"
const VOLVIENDO = "kpg-volviendo"

// Cualquiera de estos significa que la persona quiere mover la página ella misma.
const GESTOS = ["wheel", "touchstart", "pointerdown", "keydown"] as const

/** La llama "Volver" justo antes de retroceder. */
export function marcarVuelta() {
  try {
    sessionStorage.setItem(VOLVIENDO, "1")
  } catch {}
}

// ──────────────────────────────────────────────────────────────
// MEMORIA DEL SCROLL DE LA HOME
//
// Al volver de una página interna, la home aparecía arriba de todo: se sentía
// como una recarga. history.back() por sí solo no alcanza — Next intenta
// restaurar el scroll cuando la página todavía no tiene la altura final (las
// fotos y las secciones que aparecen al hacer scroll aún no cargaron), así
// que el salto se pierde y queda en 0.
//
// Por eso la posición se guarda a mano y se reintenta hasta que el documento
// es lo bastante alto como para que ese scroll exista de verdad.
// ──────────────────────────────────────────────────────────────
export function MemoriaScroll() {
  useEffect(() => {
    try {
      sessionStorage.setItem(MARCA_HOME, "1")
    } catch {}

    // Mientras restauramos NO se guarda: al montar, la página arranca en 0 y
    // ese 0 pisaba la posición buena antes de poder usarla.
    let restaurando = false

    // ── Guardar (una vez por frame, no en cada evento de scroll) ──
    let pendiente = false
    const alHacerScroll = () => {
      if (restaurando || pendiente) return
      pendiente = true
      requestAnimationFrame(() => {
        pendiente = false
        try {
          sessionStorage.setItem(POS, String(Math.round(window.scrollY)))
        } catch {}
      })
    }
    window.addEventListener("scroll", alHacerScroll, { passive: true })

    // ── Restaurar, solo si venimos de vuelta ──
    let cancelado = false
    // Si la persona toca la pantalla o la rueda, manda ella: cortamos.
    const rendirse = () => {
      cancelado = true
      restaurando = false
    }

    try {
      if (sessionStorage.getItem(VOLVIENDO) === "1") {
        sessionStorage.removeItem(VOLVIENDO)
        const y = Number(sessionStorage.getItem(POS) || 0)
        if (y > 0) {
          restaurando = true
          for (const ev of GESTOS) window.addEventListener(ev, rendirse, { passive: true, once: true })

          // Se insiste en vez de saltar una sola vez, por dos motivos: el
          // router hace su propia restauración después de montar y pisaba la
          // nuestra, y las imágenes de más abajo cargan tarde, así que al
          // principio el documento todavía no es lo bastante alto y el
          // navegador recorta el salto.
          const hasta = performance.now() + 1500
          let clavado = 0
          const intentar = () => {
            if (cancelado) return
            const alto = document.documentElement.scrollHeight
            const falta = Math.abs(window.scrollY - y) > 2
            if (alto >= y + window.innerHeight * 0.5 && falta) window.scrollTo(0, y)

            // Cuando la posición se sostiene sola por varios cuadros seguidos,
            // ya está: no hace falta seguir peleando hasta agotar el tiempo.
            clavado = falta ? 0 : clavado + 1
            if (clavado >= 20 || performance.now() >= hasta) {
              restaurando = false
              return
            }
            requestAnimationFrame(intentar)
          }
          requestAnimationFrame(intentar)
        }
      }
    } catch {}

    return () => {
      cancelado = true
      window.removeEventListener("scroll", alHacerScroll)
      for (const ev of GESTOS) window.removeEventListener(ev, rendirse)
    }
  }, [])

  return null
}
