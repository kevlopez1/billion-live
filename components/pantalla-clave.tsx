"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Loader2, Lock } from "lucide-react"

// Pantalla de entrada de las páginas privadas (/kevlopez_proyectos,
// /preguntas). Una sola, para que las dos digan lo mismo y se arreglen juntas.
export function PantallaClave({
  titulo,
  bajada,
  entrada,
  setEntrada,
  error,
  cargando,
  onEntrar,
}: {
  titulo: ReactNode
  bajada: string
  entrada: string
  setEntrada: (v: string) => void
  error: string
  cargando: boolean
  onEntrar: () => void
}) {
  const campo = useRef<HTMLInputElement>(null)
  // Se enfoca desde el efecto y no con autoFocus, que desajusta la hidratación.
  useEffect(() => { if (!cargando) campo.current?.focus() }, [cargando])

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={(e) => { e.preventDefault(); if (entrada) onEntrar() }}
        className="glass-card w-full max-w-sm p-7"
      >
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-[0.18em]">Privado</span>
        </div>
        <h1 className="font-display mb-1 text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{bajada}</p>
        <input
          type="password"
          ref={campo}
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Clave"
          aria-label="Clave"
          className="mb-3 w-full rounded-lg border border-border bg-foreground/[0.04] px-4 py-2.5 text-base outline-none transition-colors focus:border-foreground/30"
        />
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={cargando || !entrada}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-50"
        >
          {cargando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
        </button>
      </form>
    </main>
  )
}
