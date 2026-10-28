"use client"

// ──────────────────────────────────────────────────────────────
// Piezas base del HUD: vidrio, botones, hojas y retratos.
//
// En computadora los paneles se abren a la derecha; en celular son hojas que
// suben desde abajo, para que el pulgar llegue y la escena siga a la vista.
// ──────────────────────────────────────────────────────────────

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import type { Personaje } from "../tipos"
import { iniciales } from "./formato"

export const VIDRIO =
  "border border-white/[0.09] bg-[rgba(9,11,15,0.62)] backdrop-blur-xl backdrop-saturate-150 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]"

export const FOCO =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"

export function Boton({
  children,
  activo = false,
  onClick,
  etiqueta,
  className = "",
  disabled,
  tipo = "button",
}: {
  children: ReactNode
  activo?: boolean
  onClick?: () => void
  etiqueta?: string
  className?: string
  disabled?: boolean
  tipo?: "button" | "submit"
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo || undefined}
      disabled={disabled}
      title={etiqueta}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold tracking-[0.01em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO} ${
        activo ? "bg-white text-black shadow-[0_0_24px_-6px_rgba(255,255,255,0.7)]" : "text-white/80 hover:bg-white/[0.1] hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Botón principal de un panel: blanco y sólido. */
export function BotonFuerte({
  children,
  onClick,
  disabled,
  tipo = "button",
  className = "",
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tipo?: "button" | "submit"
  className?: string
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none ${FOCO} ${className}`}
    >
      {children}
    </button>
  )
}

export function Rotulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`cb-cond text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45 ${className}`}>{children}</h3>
}

export function Barra({ valor, color = "#ffffff", alto = 4 }: { valor: number; color?: string; alto?: number }) {
  const v = Math.max(0, Math.min(1, valor))
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/[0.09]" style={{ height: alto }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${v > 0 ? Math.max(v * 100, 1.5) : 0}%`, background: color, boxShadow: v > 0 ? `0 0 12px ${color}88` : undefined }}
      />
    </div>
  )
}

/** La etiqueta que dice qué es ficción. Más visible para las personas vivas. */
export function EtiquetaFiccion({ p }: { p: Personaje }) {
  const texto =
    p.real === "vivo"
      ? "Ficción · persona real viva: no son sus palabras"
      : p.real === "arquetipo"
        ? "Personaje de ficción"
        : p.real === "ia"
          ? "IA · personaje de ficción"
          : "Personaje histórico · diálogos de ficción"
  const fuerte = p.real === "vivo"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
        fuerte ? "bg-amber-300 text-black" : "border border-white/15 text-white/60"
      }`}
    >
      {texto}
    </span>
  )
}

export function Retrato({ p, url, tam = 48, className = "" }: { p: Personaje; url?: string; tam?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: tam,
        height: tam,
        background: `radial-gradient(circle at 50% 30%, ${p.color}55, rgba(0,0,0,0.6) 75%)`,
        boxShadow: `inset 0 0 0 2px ${p.color}, 0 6px 18px -8px ${p.color}`,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="cb-cond font-bold text-white/85" style={{ fontSize: tam * 0.36 }}>
          {iniciales(p.nombre)}
        </span>
      )}
    </span>
  )
}

/**
 * Panel lateral (computadora) u hoja inferior (celular). No es modal: la
 * escena sigue viva detrás. Escape lo cierra.
 */
export function Hoja({
  titulo,
  onCerrar,
  children,
  ancho = 420,
  pie,
  cabecera,
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
  ancho?: number
  pie?: ReactNode
  cabecera?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [onCerrar])
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={titulo}
      className={`cb-hoja pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[76dvh] flex-col rounded-t-[28px] outline-none md:inset-x-auto md:bottom-[100px] md:right-7 md:top-[150px] md:max-h-none md:rounded-[26px] ${VIDRIO}`}
      style={{ ["--cb-ancho" as string]: `${ancho}px` }}
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25 md:hidden" aria-hidden />
      <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3 md:pt-5">
        <div className="min-w-0 flex-1">{cabecera ?? <h2 className="cb-cond text-[22px] font-bold uppercase tracking-[0.04em] text-white">{titulo}</h2>}</div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className={`-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white ${FOCO}`}
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pb-5 [scrollbar-width:thin]">{children}</div>
      {pie && <div className="shrink-0 border-t border-white/[0.07] px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{pie}</div>}
    </section>
  )
}

/** Diálogo centrado (consejo, noticia, aviso). En celular, hoja inferior. */
export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", tecla)
    ref.current?.focus({ preventScroll: true })
    return () => window.removeEventListener("keydown", tecla)
  }, [onCerrar])
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`cb-entra flex max-h-[86dvh] w-full flex-col rounded-t-[28px] outline-none md:w-[560px] md:rounded-[28px] ${VIDRIO} bg-[rgba(9,11,15,0.82)]`}
      >
        <header className="flex shrink-0 items-center gap-3 px-6 pb-2 pt-5">
          <h2 className="cb-cond flex-1 text-[24px] font-bold uppercase tracking-[0.04em] text-white">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className={`grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white ${FOCO}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Campo({
  valor,
  onCambio,
  placeholder,
  etiqueta,
  max = 200,
  tipo = "text",
  autoFocus,
}: {
  valor: string
  onCambio: (v: string) => void
  placeholder?: string
  etiqueta: string
  max?: number
  tipo?: "text" | "password"
  autoFocus?: boolean
}) {
  return (
    <input
      type={tipo}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      placeholder={placeholder}
      aria-label={etiqueta}
      maxLength={max}
      autoFocus={autoFocus}
      className={`h-11 w-full rounded-[16px] border border-white/10 bg-white/[0.05] px-4 text-[16px] text-white placeholder:text-white/35 md:text-[14px] ${FOCO}`}
    />
  )
}

export function Chip({ children, activo, onClick, color }: { children: ReactNode; activo?: boolean; onClick?: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-left text-[12px] font-semibold transition-colors ${FOCO} ${
        activo ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:border-white/30 hover:text-white"
      }`}
    >
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  )
}
