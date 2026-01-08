"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { useApp, type Project } from "@/context/app-context"
import { TrendingUp, TrendingDown, Minus, ZoomIn, ZoomOut, Maximize2, Move, Lock, Unlock } from "lucide-react"

const statusColors: Record<string, { bg: string; border: string; glow: string }> = {
  Active: {
    bg: "bg-kev-success/20",
    border: "border-kev-success/40",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.3)]",
  },
  Growth: {
    bg: "bg-kev-primary/20",
    border: "border-kev-primary/40",
    glow: "shadow-[0_0_20px_rgba(61,90,76,0.3)]",
  },
  Stable: {
    bg: "bg-neutral-500/20",
    border: "border-neutral-500/40",
    glow: "shadow-[0_0_20px_rgba(115,115,115,0.2)]",
  },
  Monitoring: {
    bg: "bg-kev-warning/20",
    border: "border-kev-warning/40",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
  },
  Completed: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
  },
}

export function ProjectsMindMap() {
  const { projects, updateProjectPosition, metrics } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isLocked, setIsLocked] = useState(false)

  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({})

  const dragRef = useRef<{
    isDragging: boolean
    projectId: string | null
    startMouseX: number
    startMouseY: number
    startNodeX: number
    startNodeY: number
  }>({
    isDragging: false,
    projectId: null,
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0,
  })

  const panRef = useRef<{
    isPanning: boolean
    startX: number
    startY: number
    startPanX: number
    startPanY: number
  }>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  })

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isPanningState, setIsPanningState] = useState(false)

  // Initialize local positions from projects
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    projects.forEach((p) => {
      if (p.position) {
        positions[p.id] = { x: p.position.x, y: p.position.y }
      }
    })
    setLocalPositions(positions)
  }, [projects])

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    return `$${(value / 1_000).toFixed(0)}K`
  }

  const centerX = 400
  const centerY = 250

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragRef.current.isDragging && dragRef.current.projectId) {
        const dx = (e.clientX - dragRef.current.startMouseX) / zoom
        const dy = (e.clientY - dragRef.current.startMouseY) / zoom
        const newX = dragRef.current.startNodeX + dx
        const newY = dragRef.current.startNodeY + dy

        // Update local state immediately for smooth visual feedback
        setLocalPositions((prev) => ({
          ...prev,
          [dragRef.current.projectId!]: { x: newX, y: newY },
        }))
      } else if (panRef.current.isPanning) {
        const dx = e.clientX - panRef.current.startX
        const dy = e.clientY - panRef.current.startY
        setPan({
          x: panRef.current.startPanX + dx,
          y: panRef.current.startPanY + dy,
        })
      }
    },
    [zoom],
  )

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.isDragging && dragRef.current.projectId) {
      const pos = localPositions[dragRef.current.projectId]
      if (pos) {
        updateProjectPosition(dragRef.current.projectId, pos)
      }
    }

    dragRef.current.isDragging = false
    dragRef.current.projectId = null
    panRef.current.isPanning = false
    setDraggingId(null)
    setIsPanningState(false)
  }, [localPositions, updateProjectPosition])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Handle node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, project: Project) => {
    if (isLocked) return
    e.stopPropagation()
    e.preventDefault()

    const pos = localPositions[project.id] || project.position || { x: 0, y: 0 }

    dragRef.current = {
      isDragging: true,
      projectId: project.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y,
    }
    setDraggingId(project.id)
  }

  // Handle canvas pan start
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragRef.current.isDragging) return

    panRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    }
    setIsPanningState(true)
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Get position for a project (local state takes priority)
  const getPosition = (project: Project) => {
    return localPositions[project.id] || project.position || { x: 0, y: 0 }
  }

  // Draw connection lines
  const renderConnections = () => {
    return projects.map((project) => {
      const pos = getPosition(project)
      if (!pos) return null

      return (
        <line
          key={`line-${project.id}`}
          x1={centerX}
          y1={centerY}
          x2={pos.x + 100}
          y2={pos.y + 50}
          stroke="var(--kev-primary)"
          strokeWidth="2"
          strokeOpacity="0.3"
          strokeDasharray="5,5"
        />
      )
    })
  }

  return (
    <div className="glass-card overflow-hidden relative" style={{ height: "500px" }}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 glass-card hover:bg-kev-primary/20 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 glass-card hover:bg-kev-primary/20 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 glass-card hover:bg-kev-primary/20 transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-border/50" />
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`p-2 glass-card transition-colors ${isLocked ? "bg-kev-warning/20 text-kev-warning" : "hover:bg-kev-primary/20"}`}
          title={isLocked ? "Unlock Nodes" : "Lock Nodes"}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
        <span className="text-xs text-muted-foreground ml-2">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 z-20 text-xs text-muted-foreground glass-card px-3 py-1.5">
        <Move className="w-3 h-3 inline mr-1" />
        Drag nodes to reposition
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full select-none ${isPanningState ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleCanvasMouseDown}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
          className="w-full h-full relative"
        >
          {/* SVG for connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">{renderConnections()}</svg>

          {/* Center Node - Empire Hub */}
          <div
            className="absolute glass-card p-4 rounded-2xl border-2 border-kev-primary/50 bg-kev-primary/10 shadow-[0_0_40px_rgba(61,90,76,0.4)]"
            style={{
              left: centerX - 80,
              top: centerY - 50,
              width: 160,
            }}
          >
            <div className="text-center">
              <div className="text-xs text-kev-primary uppercase tracking-wider mb-1">Empire Hub</div>
              <div className="text-xl font-bold text-foreground">{formatCurrency(metrics.netWorth)}</div>
              <div className="text-xs text-muted-foreground mt-1">{projects.length} Projects</div>
            </div>
          </div>

          {/* Project Nodes */}
          {projects.map((project) => {
            const pos = getPosition(project)
            if (!pos) return null

            const colors = statusColors[project.status] || statusColors.Active
            const isDraggingThis = draggingId === project.id

            return (
              <div
                key={project.id}
                className={`absolute glass-card p-3 rounded-xl border-2 ${colors.border} ${colors.bg} ${
                  isDraggingThis ? `${colors.glow} scale-105` : "hover:scale-[1.02]"
                } ${isLocked ? "cursor-default" : "cursor-move"} transition-shadow`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: 200,
                  zIndex: isDraggingThis ? 100 : 10,
                  transition: isDraggingThis ? "box-shadow 0.2s, border-color 0.2s" : "all 0.2s",
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, project)}
              >
                {/* Status indicator */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{project.type}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      project.status === "Active" || project.status === "Growth"
                        ? "bg-kev-success animate-pulse"
                        : project.status === "Monitoring"
                          ? "bg-kev-warning"
                          : "bg-neutral-500"
                    }`}
                  />
                </div>

                {/* Project name */}
                <h4 className="font-semibold text-sm text-foreground mb-2 truncate">{project.name}</h4>

                {/* Value and change */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-lg font-bold text-foreground">{formatCurrency(project.value)}</div>
                    <div className="text-[10px] text-muted-foreground">{project.allocation}% allocation</div>
                  </div>
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
