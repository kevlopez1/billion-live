// ──────────────────────────────────────────────────────────────
// La firma "MANSORY" con la estética de la marca: serif en versalitas,
// muy espaciada, flanqueada por las alitas (tres líneas a cada lado).
//
// Se construye con TIPOGRAFÍA y no con su archivo de logo a propósito:
// se adapta a cualquier tamaño y color (hereda currentColor), queda nítido
// en cualquier pantalla y no depende de un asset de terceros.
//
// Todo va en `em`, no en píxeles. Antes las alitas eran fijas (16px, 10px, 3px)
// y solo crecía la palabra: medido en el navegador, a 12px la alita medía lo
// mismo que la mayúscula, pero a 19px se quedaba en dos tercios y las tres
// rayitas dejaban de enmarcar la palabra para parecer tildes sueltas. En `em`
// la firma se ve igual a cualquier tamaño.
// ──────────────────────────────────────────────────────────────

function Ala({ flip = false }: { flip?: boolean }) {
  return (
    <span
      className={`flex flex-col justify-center gap-[0.25em] ${flip ? "items-start" : "items-end"}`}
      aria-hidden
    >
      <i className="block h-px w-[0.8em] bg-current opacity-60" />
      <i className="block h-px w-[1.3em] bg-current opacity-85" />
      <i className="block h-px w-[0.8em] bg-current opacity-60" />
    </span>
  )
}

export function MansoryMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.8em] align-middle ${className}`}>
      <Ala />
      {/* El -mr cancela el hueco fantasma que `tracking` deja DESPUÉS de la Y.
          Sin él la caja del texto termina 0.3em más a la derecha de lo que se
          ve, así que el ala derecha quedaba 3,7px más lejos que la izquierda y
          la firma se leía descentrada. */}
      <span className="-mr-[0.3em] font-serif-display uppercase leading-none tracking-[0.3em]">Mansory</span>
      <Ala flip />
    </span>
  )
}
