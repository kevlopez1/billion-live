"use client"

import { ArrowUpRight } from "lucide-react"

// Sección del ecosistema: ahora enfocada solo en PRIME, con link directo a la web.
export function ProjectsList() {
  return (
    <a
      href="https://primebusiness.live"
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-6 md:px-8 py-7 md:py-9 transition-colors hover:bg-foreground/[0.03]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-display font-extrabold text-2xl md:text-3xl tracking-tight">PRIME</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Empleados de IA · SaaS
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
            El motor de dinero del reto: el contador se alimenta del revenue real de PRIME. Empleados de IA
            para empresas — ventas primero, después procesos.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2.5 transition-all">
            Visitar primebusiness.live
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-kev-success animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Active</span>
        </span>
      </div>
    </a>
  )
}
