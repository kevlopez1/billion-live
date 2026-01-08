"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { toast } from "sonner"
import { ProjectsMindMap } from "./projects-mind-map"
import { ProjectDetailView } from "./project-detail-view"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Plus,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  LayoutGrid,
  Network,
  Loader2,
  Edit,
  Eye,
  Copy,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const statusColors: Record<string, string> = {
  Active: "bg-kev-success/15 text-kev-success border border-kev-success/20",
  Growth: "bg-kev-primary/15 text-kev-primary border border-kev-primary/20",
  Stable: "bg-neutral-500/15 text-neutral-400 border border-neutral-500/20",
  Monitoring: "bg-kev-warning/15 text-kev-warning border border-kev-warning/20",
  Completed: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
}

const statusOptions = ["Active", "Growth", "Stable", "Monitoring", "Completed"] as const

export function ProjectsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "mindmap">("mindmap")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [showDetailView, setShowDetailView] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newProject, setNewProject] = useState({
    name: "",
    type: "",
    description: "",
    value: "",
    invested: "",
    status: "Active" as const,
  })

  const { projects, isAdmin, deleteProject, addProject, t } = useApp()

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleDelete = async (id: string) => {
    await deleteProject(id)
    toast.success(t.common.success)
  }

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.type || !newProject.value) {
      toast.error("Please fill in required fields")
      return
    }

    setIsSubmitting(true)
    await addProject({
      name: newProject.name,
      type: newProject.type,
      description: newProject.description,
      value: Number.parseFloat(newProject.value) || 0,
      invested: Number.parseFloat(newProject.invested) || 0,
      change: 0,
      trend: "neutral",
      status: newProject.status,
      allocation: 0,
    })

    setNewProject({ name: "", type: "", description: "", value: "", invested: "", status: "Active" })
    setShowAddDialog(false)
    setIsSubmitting(false)
    toast.success("Project added successfully!")
  }

  const handleViewDetails = (id: string) => {
    setSelectedProject(id)
    setShowDetailView(true)
  }

  const handleCopyDetails = (project: (typeof projects)[0]) => {
    const details = `${project.name}\nType: ${project.type}\nValue: $${project.value.toLocaleString()}\nReturn: ${project.change > 0 ? "+" : ""}${project.change}%`
    navigator.clipboard.writeText(details)
    toast.success("Project details copied to clipboard!")
  }

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    return `$${(value / 1_000).toFixed(0)}K`
  }

  const selectedProjectData = projects.find((p) => p.id === selectedProject)

  return (
    <div className="space-y-4 lg:space-y-6">
      {selectedProjectData && (
        <ProjectDetailView
          project={selectedProjectData}
          open={showDetailView}
          onClose={() => {
            setShowDetailView(false)
            setSelectedProject(null)
          }}
        />
      )}

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">{t.projects.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.projects.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center glass-card p-1 rounded-lg">
            <button
              onClick={() => setViewMode("mindmap")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === "mindmap" ? "bg-kev-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">{t.projects.mindMap}</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === "grid" ? "bg-kev-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">{t.projects.grid}</span>
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>{t.projects.addProject}</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === "mindmap" ? (
        <ProjectsMindMap />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t.projects.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilterDialog(true)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                statusFilter
                  ? "bg-kev-primary/10 border-kev-primary/30 text-kev-primary"
                  : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{statusFilter || t.common.filter}</span>
              {statusFilter && (
                <X
                  className="w-3 h-3 ml-1 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    setStatusFilter(null)
                  }}
                />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="glass-card p-4 lg:p-5 hover:border-kev-primary/30 transition-all duration-300 cursor-pointer group"
                onClick={() => handleViewDetails(project.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold group-hover:text-kev-primary-light transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{project.type}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[project.status]}`}>
                    {project.status}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{project.description}</p>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t.projects.currentValue}
                    </div>
                    <div className="font-semibold number-display">{formatCurrency(project.value)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t.projects.invested}
                    </div>
                    <div className="font-medium text-muted-foreground number-display">
                      {formatCurrency(project.invested)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t.projects.return}
                    </div>
                    <div
                      className={`font-semibold flex items-center gap-1 ${
                        project.trend === "up"
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
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Updated {project.lastUpdate}</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        toast.info(`Opening ${project.name} external dashboard...`)
                      }}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleViewDetails(project.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyDetails(project)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Details
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toast.info("Edit feature coming soon")}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(project.id)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">No projects found matching your search.</p>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="mt-2 text-sm text-kev-primary hover:text-kev-primary-light"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-kev-primary" />
              Add New Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Project Name *</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Apex Ventures"
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Type *</label>
              <input
                type="text"
                value={newProject.type}
                onChange={(e) => setNewProject((prev) => ({ ...prev, type: e.target.value }))}
                placeholder="Venture Capital"
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Current Value *</label>
                <input
                  type="number"
                  value={newProject.value}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="1000000"
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Invested</label>
                <input
                  type="number"
                  value={newProject.invested}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, invested: e.target.value }))}
                  placeholder="500000"
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
              <select
                value={newProject.status}
                onChange={(e) => setNewProject((prev) => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddProject}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isSubmitting ? "Adding..." : "Add Project"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-kev-primary" />
              Filter Projects
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <button
              onClick={() => {
                setStatusFilter(null)
                setShowFilterDialog(false)
              }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                !statusFilter
                  ? "bg-kev-primary/10 text-kev-primary border border-kev-primary/20"
                  : "hover:bg-secondary/50"
              }`}
            >
              All Projects
            </button>
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status)
                  setShowFilterDialog(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  statusFilter === status
                    ? "bg-kev-primary/10 text-kev-primary border border-kev-primary/20"
                    : "hover:bg-secondary/50"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
