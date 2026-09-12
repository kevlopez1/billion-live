// ──────────────────────────────────────────────────────────────
// La firma "MANSORY" con la estética de la marca: serif en versalitas,
// muy espaciada, flanqueada por las alitas (tres líneas a cada lado).
//
// Se construye con TIPOGRAFÍA y no con su archivo de logo a propósito:
// se adapta a cualquier tamaño y color (hereda currentColor), queda nítido
// en cualquier pantalla y no depende de un asset de terceros.
// ──────────────────────────────────────────────────────────────

function Ala({ flip = false }: { flip?: boolean }) {
  return (
    <span
      className={`flex flex-col justify-center gap-[3px] ${flip ? "items-start" : "items-end"}`}
      aria-hidden
    >
      <i className="block h-px w-2.5 bg-current opacity-60" />
      <i className="block h-px w-4 bg-current opacity-85" />
      <i className="block h-px w-2.5 bg-current opacity-60" />
    </span>
  )
}

export function MansoryMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 align-middle ${className}`}>
      <Ala />
      <span className="font-serif-display uppercase leading-none tracking-[0.3em]">Mansory</span>
      <Ala flip />
    </span>
  )
}
