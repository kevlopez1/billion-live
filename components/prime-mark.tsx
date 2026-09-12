import Image from "next/image"

// ──────────────────────────────────────────────────────────────
// EL LOGO DE PRIME, para usar dentro de una frase.
//
// Antes decía "PRIME" escrito con la tipografía de la web, que no es la de la
// marca. Ahora va el logo de verdad: el wordmark recortado del archivo
// original, en blanco sobre transparente, dentro de un chip con el celeste
// exacto del logo (#31abc4, tomado del propio archivo).
//
// Se hace así y no con una imagen del logo entero para que el chip se adapte
// al tamaño del texto que lo rodea y no arrastre un borde de fondo recortado.
// ──────────────────────────────────────────────────────────────

const PRIME_WEB = "https://www.primebusiness.live/"

const CHIP =
  "inline-flex translate-y-[0.1em] items-center rounded-[5px] bg-[#31abc4] px-[0.45em] py-[0.28em] align-baseline"

/**
 * `link={false}` para cuando el logo va DENTRO de otro enlace o de un botón:
 * un <a> anidado en un <a> es HTML inválido y el navegador lo rompe.
 */
export function PrimeMark({ className = "", link = true }: { className?: string; link?: boolean }) {
  const logo = (
    <Image
      src="/logos/prime-wordmark.png"
      alt="PRIME"
      width={600}
      height={107}
      className="h-[0.62em] w-auto"
      unoptimized
    />
  )

  if (!link) return <span className={`${CHIP} ${className}`}>{logo}</span>

  return (
    <a
      href={PRIME_WEB}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="PRIME — ir al sitio de la empresa"
      title="primebusiness.live"
      className={`${CHIP} transition-opacity hover:opacity-85 ${className}`}
    >
      {logo}
    </a>
  )
}
