"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { type Locale, getTranslation, type TranslationKeys } from "@/lib/i18n"
import {
  updateGlobalMetrics as updateSupabaseMetrics,
  addDailyPulseEntry,
  deleteDailyPulseEntry,
  getDailyPulseEntries,
  subscribeToDailyPulse,
  type DailyPulse as SupabasePulseEntry
} from "@/lib/supabase"

// Types
export interface GlobalMetrics {
  netWorth: number
  monthlyGrowth: number
  roi: number
  targetRevenue: number
  activeProjects: number
  ytdReturn: number
}

export interface LiveStatus {
  location: string
  country: string
  localTime: string
  currentActivity: string
  availability: "available" | "busy" | "offline"
}

export interface PulseEntry {
  id: string
  content: string
  category: "business" | "networking" | "personal"
  timestamp: string
  timeAgo: string
  hasImage?: boolean
  imageUrl?: string
}

export interface NodePosition {
  x: number
  y: number
}

export interface Project {
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
  position?: NodePosition
}

export interface Principle {
  id: string
  title: string
  shortDesc: string
  fullDesc: string
  iconName: string
}

export interface ManifestoContent {
  mission: string
  vision: string
  purpose: string
  principles: Principle[]
  quote: string
  quoteAuthor: string
}

export interface Milestone {
  id: string
  year: string
  title: string
  description: string
  netWorth: string
  iconName: string
  highlight: boolean
}

export interface Goal {
  id: string
  name: string
  targetValue: number
  currentValue: number
  deadline: string
  category: "financial" | "business" | "personal" | "milestone"
  createdAt: string
}

interface AppState {
  metrics: GlobalMetrics
  liveStatus: LiveStatus
  pulseEntries: PulseEntry[]
  projects: Project[]
  manifesto: ManifestoContent
  milestones: Milestone[]
  goals: Goal[] // Added goals to state
  isAdmin: boolean
  theme: "light" | "dark"
  locale: Locale
}

interface AppContextType extends AppState {
  updateMetrics: (metrics: Partial<GlobalMetrics>) => Promise<void>
  updateLiveStatus: (status: Partial<LiveStatus>) => Promise<void>
  addPulseEntry: (entry: Omit<PulseEntry, "id" | "timestamp" | "timeAgo">) => Promise<void>
  deletePulseEntry: (id: string) => Promise<void>
  addProject: (project: Omit<Project, "id" | "lastUpdate">) => Promise<void>
  updateProject: (id: string, project: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  updateProjectPosition: (id: string, position: NodePosition) => void
  updateManifesto: (manifesto: Partial<ManifestoContent>) => Promise<void>
  addMilestone: (milestone: Omit<Milestone, "id">) => Promise<void>
  updateMilestone: (id: string, milestone: Partial<Milestone>) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>
  addGoal: (goal: Omit<Goal, "id" | "createdAt">) => Promise<void>
  updateGoal: (id: string, goal: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  toggleAdmin: () => void
  setTheme: (theme: "light" | "dark") => void
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  t: TranslationKeys
  isLoading: boolean
}

// ... existing code for initial data ...

const initialMetrics: GlobalMetrics = {
  netWorth: 225_234_891,
  monthlyGrowth: 12.4,
  roi: 34.2,
  targetRevenue: 1_000_000_000,
  activeProjects: 7,
  ytdReturn: 34.2,
}

const initialLiveStatus: LiveStatus = {
  location: "Dubai",
  country: "UAE",
  localTime: "11:32 PM",
  currentActivity:
    "Reviewing Q1 acquisition targets for the real estate portfolio. Focus on commercial properties in emerging markets.",
  availability: "available",
}

const initialPulseEntries: PulseEntry[] = [
  {
    id: "1",
    content:
      "Just closed a $12M real estate deal in Downtown Dubai. The team executed flawlessly. This is what happens when preparation meets opportunity.",
    category: "business",
    timestamp: "2024-01-06 14:32",
    timeAgo: "2 hours ago",
  },
  {
    id: "2",
    content:
      "Coffee meeting with a founder building AI infrastructure. The next wave is here and we're positioning early.",
    category: "networking",
    timestamp: "2024-01-06 11:15",
    timeAgo: "5 hours ago",
  },
  {
    id: "3",
    content:
      "Morning routine complete: 5am wake up, cold plunge, 2 hours of deep work before the world wakes up. Non-negotiables.",
    category: "personal",
    timestamp: "2024-01-06 07:00",
    timeAgo: "9 hours ago",
  },
]

const initialProjects: Project[] = [
  {
    id: "1",
    name: "Apex Ventures",
    type: "Venture Capital",
    value: 42_800_000,
    invested: 28_500_000,
    change: 18.2,
    trend: "up",
    status: "Active",
    allocation: 38,
    description: "Early-stage tech investments portfolio",
    lastUpdate: "2 hours ago",
    position: { x: 100, y: 100 },
  },
  {
    id: "2",
    name: "Neural Labs",
    type: "AI/ML Startup",
    value: 8_200_000,
    invested: 4_500_000,
    change: 24.5,
    trend: "up",
    status: "Growth",
    allocation: 18,
    description: "Machine learning infrastructure company",
    lastUpdate: "5 hours ago",
    position: { x: 400, y: 80 },
  },
  {
    id: "3",
    name: "Titan Real Estate",
    type: "Real Estate",
    value: 156_000_000,
    invested: 120_000_000,
    change: 2.1,
    trend: "neutral",
    status: "Stable",
    allocation: 25,
    description: "Commercial and residential properties",
    lastUpdate: "1 day ago",
    position: { x: 250, y: 280 },
  },
  {
    id: "4",
    name: "Quantum Trading",
    type: "Algorithmic Trading",
    value: 12_400_000,
    invested: 6_200_000,
    change: 34.2,
    trend: "up",
    status: "Active",
    allocation: 11,
    description: "High-frequency trading algorithms",
    lastUpdate: "30 min ago",
    position: { x: 550, y: 200 },
  },
  {
    id: "5",
    name: "Green Energy Fund",
    type: "Sustainable Energy",
    value: 5_800_000,
    invested: 6_100_000,
    change: -1.2,
    trend: "down",
    status: "Monitoring",
    allocation: 8,
    description: "Renewable energy investments",
    lastUpdate: "3 hours ago",
    position: { x: 150, y: 400 },
  },
]

const initialManifesto: ManifestoContent = {
  mission: "Build sustainable wealth through strategic investments while documenting the entire journey transparently",
  vision: "A world where financial success is demystified and accessible to anyone willing to learn and execute",
  purpose: "Prove that with strategy, discipline, and transparency, extraordinary results are achievable",
  principles: [
    {
      id: "1",
      title: "Riesgo Asimétrico",
      shortDesc: "Invertir donde la pérdida es limitada y la ganancia infinita",
      fullDesc:
        "El verdadero arte de la inversión está en encontrar oportunidades donde el downside está controlado pero el upside es ilimitado. Nunca arriesgo más del 5% en una sola posición, pero estructuro cada deal para que el potencial de ganancia sea 10x, 50x o incluso 100x. Esto significa decir no al 99% de las oportunidades y esperar pacientemente por las asimetrías perfectas.",
      iconName: "Scale",
    },
    {
      id: "2",
      title: "Escalabilidad Radical",
      shortDesc: "Negocios que funcionen sin tiempo por dinero",
      fullDesc:
        "El tiempo es el único recurso que no se puede recuperar. Por eso, cada negocio que construyo debe poder escalar sin mi presencia directa. Software, sistemas automatizados, equipos de clase mundial. Si mi ingreso depende de mis horas trabajadas, no es un negocio—es un empleo. La meta es crear máquinas de valor que funcionen 24/7/365.",
      iconName: "Rocket",
    },
    {
      id: "3",
      title: "Legado sobre Ego",
      shortDesc: "Construir para las próximas décadas, no para el próximo mes",
      fullDesc:
        "Las decisiones que tomo hoy están diseñadas para beneficiar a las generaciones que vienen. No compito por métricas de vanidad ni por reconocimiento inmediato. El verdadero éxito se mide en el impacto que dejas cuando ya no estás. Cada inversión, cada negocio, cada relación se evalúa con un horizonte de 30+ años.",
      iconName: "Crown",
    },
  ],
  quote:
    "La meta no es ser billonario. La meta es convertirse en el tipo de persona capaz de construir un imperio de mil millones.",
  quoteAuthor: "Kevin Strategy",
}

const initialMilestones: Milestone[] = [
  {
    id: "1",
    year: "2015",
    title: "El Comienzo",
    description:
      "Empecé con nada más que una laptop y ambición ilimitada. Primer negocio online lanzado desde un pequeño apartamento.",
    netWorth: "$2,500",
    iconName: "Flag",
    highlight: false,
  },
  {
    id: "2",
    year: "2016",
    title: "Primeros Ingresos",
    description: "E-commerce alcanza $10K/mes. Aprendí los fundamentos de marketing, ventas y adquisición de clientes.",
    netWorth: "$45,000",
    iconName: "TrendingUp",
    highlight: false,
  },
  {
    id: "3",
    year: "2018",
    title: "Primer Millón",
    description:
      "Crucé el millón de dólares en patrimonio neto. Diversifiqué en bienes raíces. Comencé a invertir en startups tech.",
    netWorth: "$1.2M",
    iconName: "Star",
    highlight: true,
  },
  {
    id: "4",
    year: "2020",
    title: "Pivote Pandémico",
    description:
      "Mientras otros entraban en pánico, nosotros nos posicionamos. Compramos activos en distress a descuentos profundos.",
    netWorth: "$24M",
    iconName: "Globe",
    highlight: false,
  },
  {
    id: "5",
    year: "2024",
    title: "Capítulo Actual",
    description: "En camino al año más rentable. Enfoque en apuestas de alta convicción en mercados emergentes.",
    netWorth: "$225M",
    iconName: "Star",
    highlight: true,
  },
]

const initialGoals: Goal[] = [
  {
    id: "1",
    name: "First $500M",
    targetValue: 500_000_000,
    currentValue: 225_234_891,
    deadline: "2026-12-31",
    category: "financial",
    createdAt: "2024-01-01",
  },
  {
    id: "2",
    name: "The Billion",
    targetValue: 1_000_000_000,
    currentValue: 225_234_891,
    deadline: "2030-12-31",
    category: "milestone",
    createdAt: "2024-01-01",
  },
  {
    id: "3",
    name: "10 Active Investments",
    targetValue: 10,
    currentValue: 7,
    deadline: "2025-06-30",
    category: "business",
    createdAt: "2024-01-01",
  },
  {
    id: "4",
    name: "Launch Podcast",
    targetValue: 1,
    currentValue: 0,
    deadline: "2025-03-31",
    category: "personal",
    createdAt: "2024-01-01",
  },
]

// Context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<GlobalMetrics>(initialMetrics)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(initialLiveStatus)
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>([])
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [manifesto, setManifesto] = useState<ManifestoContent>(initialManifesto)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [goals, setGoals] = useState<Goal[]>(initialGoals) // Added goals state
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setThemeState] = useState<"light" | "dark">("dark")
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    const savedTheme = localStorage.getItem("kev-theme") as "light" | "dark" | null
    const initialTheme = savedTheme || "dark"
    setThemeState(initialTheme)

    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    const savedLocale = localStorage.getItem("kev-locale") as Locale | null
    if (savedLocale) {
      setLocaleState(savedLocale)
    }

    const savedPositions = localStorage.getItem("kev-project-positions")
    if (savedPositions) {
      try {
        const positions = JSON.parse(savedPositions) as Record<string, NodePosition>
        setProjects((prev) =>
          prev.map((p) => ({
            ...p,
            position: positions[p.id] || p.position,
          })),
        )
      } catch (e) {
        console.error("Failed to load project positions")
      }
    }

    const savedGoals = localStorage.getItem("kev-goals")
    if (savedGoals) {
      try {
        setGoals(JSON.parse(savedGoals))
      } catch (e) {
        console.error("Failed to load goals")
      }
    }

    // Load initial pulse entries from Supabase
    const loadPulseEntries = async () => {
      const entries = await getDailyPulseEntries()
      const formattedEntries: PulseEntry[] = entries.map((entry) => ({
        id: entry.id,
        content: entry.content,
        category: entry.category,
        timestamp: entry.timestamp,
        timeAgo: formatTimeAgo(new Date(entry.timestamp)),
        hasImage: entry.has_image,
        imageUrl: entry.image_url || undefined,
      }))
      setPulseEntries(formattedEntries)
    }

    loadPulseEntries()

    // Subscribe to real-time pulse updates
    const unsubscribe = subscribeToDailyPulse((pulse, event) => {
      if (event === 'INSERT') {
        const newEntry: PulseEntry = {
          id: pulse.id,
          content: pulse.content,
          category: pulse.category,
          timestamp: pulse.timestamp,
          timeAgo: formatTimeAgo(new Date(pulse.timestamp)),
          hasImage: pulse.has_image,
          imageUrl: pulse.image_url || undefined,
        }
        setPulseEntries((prev) => [newEntry, ...prev])
      } else if (event === 'DELETE') {
        setPulseEntries((prev) => prev.filter((p) => p.id !== pulse.id))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("kev-goals", JSON.stringify(goals))
  }, [goals])

  const updateMetrics = useCallback(async (newMetrics: Partial<GlobalMetrics>) => {
    setIsLoading(true)

    // Update Supabase
    const supabaseMetrics = {
      net_worth: newMetrics.netWorth,
      monthly_growth: newMetrics.monthlyGrowth,
      roi: newMetrics.roi,
      target_revenue: newMetrics.targetRevenue,
      active_projects: newMetrics.activeProjects,
      ytd_return: newMetrics.ytdReturn,
    }

    await updateSupabaseMetrics(supabaseMetrics)

    // Update local state as fallback
    setMetrics((prev) => ({ ...prev, ...newMetrics }))
    setIsLoading(false)
  }, [])

  const updateLiveStatus = useCallback(async (status: Partial<LiveStatus>) => {
    setIsLoading(true)
    await simulateApiCall()
    setLiveStatus((prev) => ({ ...prev, ...status }))
    setIsLoading(false)
  }, [])

  const addPulseEntry = useCallback(async (entry: Omit<PulseEntry, "id" | "timestamp" | "timeAgo">) => {
    setIsLoading(true)

    // Add to Supabase
    const supabaseEntry = {
      content: entry.content,
      category: entry.category,
      has_image: entry.hasImage || false,
      image_url: entry.imageUrl || null,
    }

    await addDailyPulseEntry(supabaseEntry)
    // Real-time subscription will handle adding to state automatically

    setIsLoading(false)
  }, [])

  const deletePulseEntry = useCallback(async (id: string) => {
    setIsLoading(true)

    // Delete from Supabase
    await deleteDailyPulseEntry(id)
    // Real-time subscription will handle removing from state automatically

    setIsLoading(false)
  }, [])

  const addProject = useCallback(async (project: Omit<Project, "id" | "lastUpdate">) => {
    setIsLoading(true)
    await simulateApiCall()
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      lastUpdate: "Just now",
      position: project.position || { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
    }
    setProjects((prev) => [...prev, newProject])
    setIsLoading(false)
  }, [])

  const updateProject = useCallback(async (id: string, project: Partial<Project>) => {
    setIsLoading(true)
    await simulateApiCall()
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...project, lastUpdate: "Just now" } : p)))
    setIsLoading(false)
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    setIsLoading(true)
    await simulateApiCall()
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setIsLoading(false)
  }, [])

  const updateProjectPosition = useCallback((id: string, position: NodePosition) => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, position } : p))
      const positions: Record<string, NodePosition> = {}
      updated.forEach((p) => {
        if (p.position) positions[p.id] = p.position
      })
      localStorage.setItem("kev-project-positions", JSON.stringify(positions))
      return updated
    })
  }, [])

  const updateManifesto = useCallback(async (newManifesto: Partial<ManifestoContent>) => {
    setIsLoading(true)
    await simulateApiCall()
    setManifesto((prev) => ({ ...prev, ...newManifesto }))
    setIsLoading(false)
  }, [])

  const addMilestone = useCallback(async (milestone: Omit<Milestone, "id">) => {
    setIsLoading(true)
    await simulateApiCall()
    const newMilestone: Milestone = {
      ...milestone,
      id: Date.now().toString(),
    }
    setMilestones((prev) => [...prev, newMilestone].sort((a, b) => Number.parseInt(a.year) - Number.parseInt(b.year)))
    setIsLoading(false)
  }, [])

  const updateMilestone = useCallback(async (id: string, milestone: Partial<Milestone>) => {
    setIsLoading(true)
    await simulateApiCall()
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...milestone } : m)))
    setIsLoading(false)
  }, [])

  const deleteMilestone = useCallback(async (id: string) => {
    setIsLoading(true)
    await simulateApiCall()
    setMilestones((prev) => prev.filter((m) => m.id !== id))
    setIsLoading(false)
  }, [])

  const addGoal = useCallback(async (goal: Omit<Goal, "id" | "createdAt">) => {
    setIsLoading(true)
    await simulateApiCall()
    const newGoal: Goal = {
      ...goal,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    setGoals((prev) => [...prev, newGoal])
    setIsLoading(false)
  }, [])

  const updateGoal = useCallback(async (id: string, goal: Partial<Goal>) => {
    setIsLoading(true)
    await simulateApiCall()
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...goal } : g)))
    setIsLoading(false)
  }, [])

  const deleteGoal = useCallback(async (id: string) => {
    setIsLoading(true)
    await simulateApiCall()
    setGoals((prev) => prev.filter((g) => g.id !== id))
    setIsLoading(false)
  }, [])

  const toggleAdmin = useCallback(() => {
    setIsAdmin((prev) => !prev)
  }, [])

  const setTheme = useCallback((newTheme: "light" | "dark") => {
    setThemeState(newTheme)
    localStorage.setItem("kev-theme", newTheme)

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("kev-locale", newLocale)
  }, [])

  const t = getTranslation(locale)

  return (
    <AppContext.Provider
      value={{
        metrics,
        liveStatus,
        pulseEntries,
        projects,
        manifesto,
        milestones,
        goals,
        isAdmin,
        isLoading,
        theme,
        locale,
        t,
        updateMetrics,
        updateLiveStatus,
        addPulseEntry,
        deletePulseEntry,
        addProject,
        updateProject,
        deleteProject,
        updateProjectPosition,
        updateManifesto,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        addGoal,
        updateGoal,
        deleteGoal,
        toggleAdmin,
        setTheme,
        toggleTheme,
        setLocale,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}

const simulateApiCall = () => new Promise((resolve) => setTimeout(resolve, 800))

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  return date.toLocaleDateString()
}
