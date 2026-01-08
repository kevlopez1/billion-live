"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/context/app-context"
import { Search, Briefcase, BarChart3, LayoutDashboard, Settings, X, FileText, Users } from "lucide-react"

interface CommandBarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const { t } = useApp()
  const [search, setSearch] = useState("")

  const commands = [
    {
      id: "dashboard",
      label: t.commandBar.dashboard,
      description: t.commandBar.dashboardDesc,
      icon: LayoutDashboard,
      shortcut: "D",
    },
    {
      id: "projects",
      label: t.commandBar.projects,
      description: t.commandBar.projectsDesc,
      icon: Briefcase,
      shortcut: "P",
    },
    {
      id: "analytics",
      label: t.commandBar.analytics,
      description: t.commandBar.analyticsDesc,
      icon: BarChart3,
      shortcut: "A",
    },
    {
      id: "reports",
      label: t.commandBar.reports,
      description: t.commandBar.reportsDesc,
      icon: FileText,
      shortcut: "R",
    },
    { id: "team", label: t.commandBar.team, description: t.commandBar.teamDesc, icon: Users, shortcut: "T" },
    {
      id: "settings",
      label: t.commandBar.settings,
      description: t.commandBar.settingsDesc,
      icon: Settings,
      shortcut: "S",
    },
  ]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()),
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-lg mx-4 rounded-lg bg-card border border-border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.commandBar.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
            autoFocus
          />
          <button onClick={() => onOpenChange(false)} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t.commandBar.quickActions}
          </p>
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-secondary transition-colors group"
              onClick={() => onOpenChange(false)}
            >
              <div className="p-1.5 bg-secondary rounded group-hover:bg-muted transition-colors">
                <cmd.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{cmd.label}</p>
                <p className="text-xs text-muted-foreground">{cmd.description}</p>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground border border-border">
                {cmd.shortcut}
              </kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
