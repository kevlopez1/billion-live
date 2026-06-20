"use client"

import { useApp } from "@/context/app-context"

export function ProjectsList() {
  const { projects } = useApp()

  return (
    <div className="overflow-hidden">
      <div className="p-6 md:p-8 border-b border-border">
        <h2 className="text-2xl font-bold tracking-tight">El Ecosistema</h2>
        <p className="text-sm text-muted-foreground mt-1 font-light">Una máquina, cuatro funciones</p>
      </div>

      <div className="divide-y divide-border">
        {projects.map((project) => {
          const isActive = project.status === "Active"
          return (
            <div
              key={project.id}
              className="group flex items-center gap-4 md:gap-6 px-6 md:px-8 py-5 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium truncate">{project.name}</span>
                  <span className="hidden sm:inline text-[10px] uppercase tracking-[0.12em] text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                    {project.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 font-light line-clamp-1 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="w-24 shrink-0 hidden md:block">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span className="uppercase tracking-wider">Peso</span>
                  <span className="number-display">{project.allocation}%</span>
                </div>
                <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/30 rounded-full transition-all duration-700"
                    style={{ width: `${project.allocation}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 w-20 justify-end">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-kev-success animate-pulse" : "bg-muted-foreground/40"}`}
                />
                <span className="text-[11px] text-muted-foreground">{project.status}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
