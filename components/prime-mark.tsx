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

export function PrimeMark({ className = "" }: { className?: string }) {
  return (
    <a
      href={PRIME_WEB}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="PRIME — ir al sitio de la empresa"
      title="primebusiness.live"
      className={`inline-flex translate-y-[0.1em] items-center rounded-[5px] bg-[#31abc4] px-[0.45em] py-[0.28em] align-baseline transition-opacity hover:opacity-85 ${className}`}
    >
      <Image
        src="/logos/prime-wordmark.png"
        alt="PRIME"
        width={600}
        height={107}
        className="h-[0.62em] w-auto"
        unoptimized
      />
    </a>
  )
}
