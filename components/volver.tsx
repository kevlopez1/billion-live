"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

import { MARCA_HOME, marcarVuelta } from "@/components/memoria-scroll"

// ──────────────────────────────────────────────────────────────
// "VOLVER AL RETO"
//
// Con un <Link href="/"> pelado, volver te dejaba ARRIBA DE TODO y con el
// contador animándose otra vez desde cero: se sentía como una recarga.
//
// Si ya pasaste por la home en esta pestaña, usamos history.back(), que
// restaura la posición exacta del scroll — volvés justo al botón que tocaste.
// Si entraste directo por un link compartido o por Google no hay a dónde
// volver, así que ahí sí se navega normal a la home.
// ──────────────────────────────────────────────────────────────
export function Volver({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter()
  const [interna, setInterna] = useState(false)

  useEffect(() => {
    try {
      setInterna(sessionStorage.getItem(MARCA_HOME) === "1")
    } catch {
      // Modo incógnito o storage bloqueado: se queda con el Link normal.
    }
  }, [])

  return (
    <Link
      href="/"
      className={className}
      onClick={(e) => {
        if (!interna) return
        e.preventDefault()
        marcarVuelta()
        router.back()
      }}
    >
      {children}
    </Link>
  )
}
