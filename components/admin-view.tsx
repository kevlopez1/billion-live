"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { toast } from "sonner"
import {
  DollarSign,
  Target,
  TrendingUp,
  MapPin,
  Activity,
  Plus,
  Trash2,
  Save,
  Loader2,
  Scale,
  Rocket,
  Crown,
  Flag,
  Star,
  Globe,
  Building,
  Briefcase,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

type AdminTab = "metrics" | "pulse" | "projects" | "manifesto" | "journey"

const iconMap: Record<string, typeof Scale> = {
  Scale,
  Rocket,
  Crown,
  Flag,
  Star,
  Globe,
  Building,
  TrendingUp,
  Briefcase,
}

export function AdminView() {
  const {
    metrics,
    liveStatus,
    pulseEntries,
    projects,
    manifesto,
    milestones,
    isLoading,
    updateMetrics,
    updateLiveStatus,
    addPulseEntry,
    deletePulseEntry,
    addProject,
    updateProject,
    deleteProject,
    updateManifesto,
    addMilestone,
    deleteMilestone,
  } = useApp()

  const [activeTab, setActiveTab] = useState<AdminTab>("metrics")

  // Metrics form state
  const [metricsForm, setMetricsForm] = useState({
    netWorth: metrics.netWorth,
    monthlyGrowth: metrics.monthlyGrowth,
    roi: metrics.roi,
    activeProjects: metrics.activeProjects,
  })

  // Pulse form state
  const [pulseForm, setPulseForm] = useState({
    content: "",
    category: "business" as "business" | "networking" | "personal",
  })

  // Live status form
  const [statusForm, setStatusForm] = useState({
    location: liveStatus.location,
    country: liveStatus.country,
    currentActivity: liveStatus.currentActivity,
    availability: liveStatus.availability,
  })

  // Project form state
  const [projectForm, setProjectForm] = useState({
    name: "",
    type: "",
    value: 0,
    invested: 0,
    description: "",
    status: "Active" as Project["status"],
    allocation: 0,
  })
  const [editingProject, setEditingProject] = useState<string | null>(null)

  // Manifesto form state
  const [manifestoForm, setManifestoForm] = useState({
    mission: manifesto.mission,
    vision: manifesto.vision,
    purpose: manifesto.purpose,
    quote: manifesto.quote,
  })

  // Milestone form state
  const [milestoneForm, setMilestoneForm] = useState({
    year: "",
    title: "",
    description: "",
    netWorth: "",
    iconName: "Flag",
    highlight: false,
  })

  const tabs = [
    { id: "metrics" as const, label: "Metrics", icon: DollarSign },
    { id: "pulse" as const, label: "Daily Pulse", icon: Activity },
    { id: "projects" as const, label: "Projects", icon: Briefcase },
    { id: "manifesto" as const, label: "Manifesto", icon: Crown },
    { id: "journey" as const, label: "Journey", icon: Flag },
  ]

  const handleSaveMetrics = async () => {
    await updateMetrics(metricsForm)
    toast.success("Metrics updated successfully")
  }

  const handleSaveStatus = async () => {
    await updateLiveStatus(statusForm)
    toast.success("Live status updated successfully")
  }

  const handleAddPulse = async () => {
    if (!pulseForm.content.trim()) {
      toast.error("Please enter content for the pulse")
      return
    }
    await addPulseEntry(pulseForm)
    setPulseForm({ content: "", category: "business" })
    toast.success("Pulse entry added successfully")
  }

  const handleDeletePulse = async (id: string) => {
    await deletePulseEntry(id)
    toast.success("Pulse entry deleted")
  }

  const handleAddProject = async () => {
    if (!projectForm.name.trim()) {
      toast.error("Please enter a project name")
      return
    }
    await addProject({
      ...projectForm,
      change: 0,
      trend: "neutral",
    })
    setProjectForm({
      name: "",
      type: "",
      value: 0,
      invested: 0,
      description: "",
      status: "Active",
      allocation: 0,
    })
    toast.success("Project added successfully")
  }

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id)
    toast.success("Project deleted")
  }

  const handleSaveManifesto = async () => {
    await updateManifesto(manifestoForm)
    toast.success("Manifesto updated successfully")
  }

  const handleAddMilestone = async () => {
    if (!milestoneForm.year || !milestoneForm.title) {
      toast.error("Please fill in all required fields")
      return
    }
    await addMilestone(milestoneForm)
    setMilestoneForm({
      year: "",
      title: "",
      description: "",
      netWorth: "",
      iconName: "Flag",
      highlight: false,
    })
    toast.success("Milestone added successfully")
  }

  const handleDeleteMilestone = async (id: string) => {
    await deleteMilestone(id)
    toast.success("Milestone deleted")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Admin Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your empire's data and content</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-medium text-amber-500">Admin Mode Active</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-kev-primary/15 text-kev-primary border border-kev-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {/* Metrics Tab */}
        {activeTab === "metrics" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-kev-primary" />
              Global Metrics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Net Worth (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={metricsForm.netWorth}
                    onChange={(e) => setMetricsForm({ ...metricsForm, netWorth: Number(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Current: ${metrics.netWorth.toLocaleString()}</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Monthly Growth (%)</label>
                <div className="space-y-2">
                  <Slider
                    value={[metricsForm.monthlyGrowth]}
                    onValueChange={(v) => setMetricsForm({ ...metricsForm, monthlyGrowth: v[0] })}
                    max={50}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span className="text-kev-primary font-medium">{metricsForm.monthlyGrowth.toFixed(1)}%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">ROI (%)</label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    step="0.1"
                    value={metricsForm.roi}
                    onChange={(e) => setMetricsForm({ ...metricsForm, roi: Number(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Active Projects</label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={metricsForm.activeProjects}
                    onChange={(e) => setMetricsForm({ ...metricsForm, activeProjects: Number(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveMetrics}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-kev-primary hover:bg-kev-primary-light text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}

        {/* Daily Pulse Tab */}
        {activeTab === "pulse" && (
          <div className="space-y-6">
            {/* Live Status Editor */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-kev-primary" />
                Live Status
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Location</label>
                  <input
                    type="text"
                    value={statusForm.location}
                    onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
                    placeholder="e.g., Dubai"
                    className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <input
                    type="text"
                    value={statusForm.country}
                    onChange={(e) => setStatusForm({ ...statusForm, country: e.target.value })}
                    placeholder="e.g., UAE"
                    className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Current Activity</label>
                <textarea
                  value={statusForm.currentActivity}
                  onChange={(e) => setStatusForm({ ...statusForm, currentActivity: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Availability</label>
                <div className="flex gap-2">
                  {(["available", "busy", "offline"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusForm({ ...statusForm, availability: status })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                        statusForm.availability === status
                          ? status === "available"
                            ? "bg-kev-success/15 text-kev-success border border-kev-success/30"
                            : status === "busy"
                              ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                              : "bg-neutral-500/15 text-neutral-400 border border-neutral-500/30"
                          : "bg-secondary/50 text-muted-foreground border border-border/50 hover:border-border"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveStatus}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-kev-primary hover:bg-kev-primary-light text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Update Status
              </button>
            </div>

            <div className="h-px bg-border/50" />

            {/* New Pulse Entry */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-kev-primary" />
                Post New Update
              </h2>

              <textarea
                value={pulseForm.content}
                onChange={(e) => setPulseForm({ ...pulseForm, content: e.target.value })}
                placeholder="Share an update..."
                rows={3}
                className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(["business", "networking", "personal"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setPulseForm({ ...pulseForm, category: cat })}
                      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                        pulseForm.category === cat
                          ? cat === "business"
                            ? "bg-kev-primary/15 text-kev-primary border border-kev-primary/30"
                            : cat === "networking"
                              ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-secondary/50 text-muted-foreground border border-border/50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddPulse}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Post
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Existing Entries */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Recent Entries</h3>
              {pulseEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border/30"
                >
                  <div className="flex-1">
                    <p className="text-sm text-foreground line-clamp-2">{entry.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="capitalize">{entry.category}</span>
                      <span>·</span>
                      <span>{entry.timeAgo}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePulse(entry.id)}
                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-kev-primary" />
              Project Manager
            </h2>

            {/* Add New Project Form */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/30 space-y-4">
              <h3 className="text-sm font-medium text-foreground">Add New Project</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="Project Name"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
                <input
                  type="text"
                  value={projectForm.type}
                  onChange={(e) => setProjectForm({ ...projectForm, type: e.target.value })}
                  placeholder="Type (e.g., Real Estate)"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
                <input
                  type="number"
                  value={projectForm.value || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, value: Number(e.target.value) })}
                  placeholder="Current Value (USD)"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
                <input
                  type="number"
                  value={projectForm.invested || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, invested: Number(e.target.value) })}
                  placeholder="Amount Invested (USD)"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>

              <textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
              />

              <div className="flex items-center justify-between">
                <select
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as Project["status"] })}
                  className="px-4 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-kev-primary/50"
                >
                  <option value="Active">Active</option>
                  <option value="Growth">Growth</option>
                  <option value="Stable">Stable</option>
                  <option value="Monitoring">Monitoring</option>
                  <option value="Completed">Completed</option>
                </select>

                <button
                  onClick={handleAddProject}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Project
                </button>
              </div>
            </div>

            {/* Existing Projects */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Existing Projects ({projects.length})</h3>
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border/30"
                >
                  <div>
                    <h4 className="font-medium text-foreground">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {project.type} · ${project.value.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs ${
                        project.status === "Active"
                          ? "bg-kev-success/15 text-kev-success"
                          : project.status === "Growth"
                            ? "bg-kev-primary/15 text-kev-primary"
                            : project.status === "Monitoring"
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-neutral-500/15 text-neutral-400"
                      }`}
                    >
                      {project.status}
                    </span>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manifesto Tab */}
        {activeTab === "manifesto" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Crown className="w-5 h-5 text-kev-primary" />
              Manifesto Editor
            </h2>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mission</label>
                <textarea
                  value={manifestoForm.mission}
                  onChange={(e) => setManifestoForm({ ...manifestoForm, mission: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Vision</label>
                <textarea
                  value={manifestoForm.vision}
                  onChange={(e) => setManifestoForm({ ...manifestoForm, vision: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Purpose</label>
                <textarea
                  value={manifestoForm.purpose}
                  onChange={(e) => setManifestoForm({ ...manifestoForm, purpose: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Quote</label>
                <textarea
                  value={manifestoForm.quote}
                  onChange={(e) => setManifestoForm({ ...manifestoForm, quote: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleSaveManifesto}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-kev-primary hover:bg-kev-primary-light text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Manifesto
            </button>

            {/* Principles Preview */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Core Principles (3 Pillars)</h3>
              {manifesto.principles.map((principle) => (
                <div key={principle.id} className="p-4 bg-secondary/30 rounded-xl border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-kev-primary/10 border border-kev-primary/20 flex items-center justify-center">
                      {iconMap[principle.iconName] &&
                        (() => {
                          const Icon = iconMap[principle.iconName]
                          return <Icon className="w-4 h-4 text-kev-primary" />
                        })()}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{principle.title}</h4>
                      <p className="text-sm text-muted-foreground">{principle.shortDesc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Journey Tab */}
        {activeTab === "journey" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Flag className="w-5 h-5 text-kev-primary" />
              Journey Milestones
            </h2>

            {/* Add New Milestone */}
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/30 space-y-4">
              <h3 className="text-sm font-medium text-foreground">Add New Milestone</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={milestoneForm.year}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, year: e.target.value })}
                  placeholder="Year (e.g., 2025)"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
                <input
                  type="text"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                  placeholder="Title"
                  className="px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>

              <textarea
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={milestoneForm.netWorth}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, netWorth: e.target.value })}
                    placeholder="Net Worth (e.g., $500M)"
                    className="px-4 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-kev-primary/50 transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={milestoneForm.highlight}
                      onCheckedChange={(v) => setMilestoneForm({ ...milestoneForm, highlight: v })}
                    />
                    <span className="text-sm text-muted-foreground">Highlight</span>
                  </div>
                </div>

                <button
                  onClick={handleAddMilestone}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Milestone
                </button>
              </div>
            </div>

            {/* Existing Milestones */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Timeline ({milestones.length} milestones)</h3>
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    milestone.highlight ? "bg-kev-primary/5 border-kev-primary/20" : "bg-secondary/30 border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-kev-primary">{milestone.year}</span>
                    <div>
                      <h4 className="font-medium text-foreground">{milestone.title}</h4>
                      <p className="text-sm text-muted-foreground">{milestone.netWorth}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMilestone(milestone.id)}
                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type Project = {
  id: string
  name: string
  type: string
  value: number
  invested: number
  change: number
  trend: "up" | "down" | "neutral"
  status: "Active" | "Growth" | "Stable" | "Monitoring" | "Completed"
  allocation: number
  description: string
  lastUpdate: string
}
