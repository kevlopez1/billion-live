"use client"

import Link from "next/link"
import { LogIn, UserRound } from "lucide-react"
import { useAuth } from "@/context/auth-context"

// ──────────────────────────────────────────────────────────────
// La entrada a la cuenta, dentro del menú lateral.
//
// Antes el formulario de registro vivía suelto en la home, entre el contenido
// del reto. Crear una cuenta es navegación, no contenido: va donde la gente
// busca las opciones del sitio.
//
// Cambia según haya sesión o no — mandar a "Crear cuenta" a alguien que ya
// entró es hacerle perder el clic.
// ──────────────────────────────────────────────────────────────
export function EntradaCuenta({ onNavegar }: { onNavegar?: () => void }) {
  const { perfil, cargando } = useAuth()
  const dentro = !cargando && !!perfil

  return (
    <Link
      href="/cuenta"
      onClick={onNavegar}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-foreground/[0.06]"
    >
      {dentro ? <UserRound className="h-[18px] w-[18px]" /> : <LogIn className="h-[18px] w-[18px]" />}
      <span className="min-w-0 flex-1 truncate">
        {dentro ? "Mi cuenta" : "Crear cuenta o entrar"}
      </span>
      {dentro && perfil?.nombre && (
        <span className="shrink-0 truncate text-[11px] text-muted-foreground">
          {perfil.nombre.split(" ")[0]}
        </span>
      )}
    </Link>
  )
}
