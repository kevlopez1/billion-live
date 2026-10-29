import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// El molde de /privacidad y /terminos: la misma columna, la misma fecha y
// los mismos correos. Lo que se promete aquí tiene que poder cumplirse.
// ──────────────────────────────────────────────────────────────

/** La fecha de la última versión de las dos páginas. Se cambia al cambiar el texto. */
export const ACTUALIZADO = "29 de octubre de 2026"
export const CORREO_CONTACTO = "kev@primebusiness.live"

export const YOUTUBE_TERMINOS = "https://www.youtube.com/t/terms"
export const GOOGLE_PRIVACIDAD = "https://policies.google.com/privacy"
export const GOOGLE_PERMISOS = "https://myaccount.google.com/permissions"

export function Correo({ a }: { a: string }) {
  return (
    <a href={`mailto:${a}`} className="break-words text-foreground underline underline-offset-2">
      {a}
    </a>
  )
}

export function Fuera({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">
      {children}
    </a>
  )
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function PaginaLegal({
  titulo,
  bajada,
  otra,
  children,
}: {
  titulo: string
  bajada: string
  otra: { href: string; texto: string }
  children: ReactNode
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <nav className="mb-12 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <ChevronRight className="h-4 w-4 rotate-180" /> Inicio
          </Link>
          <Link href={otra.href} className="underline underline-offset-2 transition-colors hover:text-foreground">
            {otra.texto}
          </Link>
        </nav>

        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter md:text-5xl">{titulo}</h1>
        <p className="mt-4 text-pretty text-lg font-light leading-relaxed text-muted-foreground">{bajada}</p>
        <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Actualizado el {ACTUALIZADO}</p>

        <div className="text-[15px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:space-y-2">
          {children}
        </div>
      </main>
    </div>
  )
}
