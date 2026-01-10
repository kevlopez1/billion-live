"use client"

import { useApp } from "@/context/app-context"
import { TrendingUp, TrendingDown, Minus, MoreHorizontal } from "lucide-react"

const statusColors: Record<string, string> = {
  Active: "bg-kev-success/15 text-kev-success border border-kev-success/20",
  Growth: "bg-kev-primary/15 text-kev-primary border border-kev-primary/20",
  Stable: "bg-neutral-500/15 text-neutral-400 border border-neutral-500/20",
  Monitoring: "bg-kev-warning/15 text-kev-warning border border-kev-warning/20",
  Completed: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
}

export function ProjectsList() {
  const { projects } = useApp()
  console.log('ProjectsList received data:', projects)

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    return `$${(value / 1_000).toFixed(0)}K`
  }

  return (
    <div className="overflow-hidden">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Portfolio Holdings</h2>
            <p className="text-sm text-muted-foreground">Active investments and allocations</p>
          </div>
          <button className="text-sm text-kev-primary hover:text-kev-primary-light transition-colors">
            View details
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Project
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Value
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Change
              </th>
              <th className="text-center px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Allocation
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-kev-primary/5 transition-all duration-300 cursor-pointer group">
                <td className="px-6 py-4">
                  <span className="font-medium group-hover:text-kev-primary-light transition-colors">
                    {project.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{project.type}</td>
                <td className="px-6 py-4 text-right font-medium number-display">{formatCurrency(project.value)}</td>
                <td className="px-6 py-4 text-right">
                  <div
                    className={`inline-flex items-center gap-1 text-sm font-medium ${project.trend === "up"
                        ? "text-kev-success"
                        : project.trend === "down"
                          ? "text-kev-danger"
                          : "text-muted-foreground"
                      }`}
                  >
                    {project.trend === "up" && <TrendingUp className="w-3 h-3" />}
                    {project.trend === "down" && <TrendingDown className="w-3 h-3" />}
                    {project.trend === "neutral" && <Minus className="w-3 h-3" />}
                    {project.change > 0 ? "+" : ""}
                    {project.change}%
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[project.status]}`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">{project.allocation}%</td>
                <td className="px-6 py-4">
                  <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
