"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { type Locale, getTranslation, type TranslationKeys } from "@/lib/i18n"
import {
  updateGlobalMetrics as updateSupabaseMetrics,
  addDailyPulseEntry,
  deleteDailyPulseEntry,
  getDailyPulseEntries,
  subscribeToDailyPulse,
  getProjects,
  subscribeToProjects,
  type DailyPulse as SupabasePulseEntry,
  type Project as SupabaseProject
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

// ── EL RETO: capa pública y capa secreta ──────────────────────────────
// Capa pública (la carnada): de $10 a un Mercedes-AMG GT 63 MANSORY (~$450K).
// Capa secreta (la meta real de largo plazo): el imperio de $1.000.000.000.
// El contador (netWorth) = revenue REAL de PRIME, editable desde el panel Admin.
export const CHALLENGE_TARGET = 450_000 // Mercedes-AMG GT 63 Mansory
export const SECRET_TARGET = 1_000_000_000 // El imperio (capa secreta)
export const CHALLENGE_START = 10 // Empezamos desde $10
// Fecha límite del reto. Cambiar acá el plazo (formato AAAA-MM-DD).
export const CHALLENGE_DEADLINE = "2027-06-29" // límite: 12 meses
export const CHALLENGE_RECORD_DEADLINE = "2026-12-29" // ritmo récord: 6 meses
export const CHALLENGE_LAUNCH = "2026-06-29" // fecha del relanzamiento (Día 1)

const initialMetrics: GlobalMetrics = {
  netWorth: 350, // recaudado a la fecha (real) — editá acá o desde /control
  monthlyGrowth: 0,
  roi: 0,
  targetRevenue: CHALLENGE_TARGET,
  activeProjects: 3,
  ytdReturn: 0,
}

const initialLiveStatus: LiveStatus = {
  location: "Santa Cruz de la Sierra",
  country: "Bolivia",
  localTime: "9:41 PM",
  currentActivity:
    "Instalando empleados de IA de PRIME para negocios bolivianos. Construyendo el imperio en público, desde la crisis, en cámara.",
  availability: "available",
}

const initialPulseEntries: PulseEntry[] = [
  {
    id: "1",
    content:
      "Día 1 del relanzamiento. El comentario con 1.300 likes decía 'me lo compró mi papá'. Yo empiezo desde $10, desde Bolivia, desde la crisis. Cada peso del contador es revenue real de PRIME. Esto no es flex — es la prueba de que se puede construir un imperio en público.",
    category: "business",
    timestamp: "2026-06-20 21:41",
    timeAgo: "Ahora mismo",
  },
  {
    id: "2",
    content:
      "Nueva 'Beca PRIME': instalé empleados de IA gratis a un negocio boliviano, en cámara. Por cada hito del reto, repito. La atención no se queda en mi bolsillo — se reinvierte en la economía que me formó.",
    category: "networking",
    timestamp: "2026-06-20 16:15",
    timeAgo: "hace 5 horas",
  },
  {
    id: "3",
    content:
      "El auto es la carnada. La meta real es el sistema: PRIME factura, la viralidad llena la base de datos, la base de datos se vuelve público real. Una máquina que no depende de mi tiempo.",
    category: "personal",
    timestamp: "2026-06-20 07:00",
    timeAgo: "hace 14 horas",
  },
]

// Las 4 funciones del imperio. Cada marca = una función:
// PRIME = dinero · KEV Strategy = reputación · Insightful = masificación · @Kev López = el medio.
const initialProjects: Project[] = [
  {
    id: "1",
    name: "PRIME",
    type: "Empleados de IA · Agent as a Service",
    value: 10,
    invested: 0,
    change: 0,
    trend: "up",
    status: "Active",
    allocation: 60,
    description:
      "Empleados de IA para empresas (primebusiness.live). El MOTOR DE DINERO del reto: el contador se alimenta del revenue real de PRIME. Moat = datos propios + nicho. Métricas que importan: MRR, clientes, retención.",
    lastUpdate: "Ahora mismo",
    position: { x: 120, y: 100 },
  },
  {
    id: "2",
    name: "KEV Strategy",
    type: "Inmobiliaria",
    value: 0,
    invested: 0,
    change: 0,
    trend: "neutral",
    status: "Growth",
    allocation: 22,
    description: "Inmobiliaria. La función REPUTACIÓN: activos reales y credibilidad de largo plazo.",
    lastUpdate: "Hoy",
    position: { x: 420, y: 90 },
  },
  {
    id: "3",
    name: "Insightful University",
    type: "Educación",
    value: 0,
    invested: 0,
    change: 0,
    trend: "up",
    status: "Growth",
    allocation: 18,
    description: "Educación. La función MASIFICACIÓN: convierte la atención del reto en alumnos y comunidad.",
    lastUpdate: "Hoy",
    position: { x: 260, y: 300 },
  },
]

const initialManifesto: ManifestoContent = {
  mission:
    "Probar, en público y desde Bolivia en crisis, que se puede ir de $10 a un Mercedes-AMG Mansory construyendo negocios reales — no por suerte ni por herencia, sino por sistema.",
  vision:
    "Un imperio construido a la vista de todos, donde la atención de un reto imposible se convierte en empresas que cambian la economía de LatAm.",
  purpose:
    "El auto es la carnada. La meta real es convertirme en el tipo de persona — y construir la máquina — capaz de levantar un imperio desde cero.",
  principles: [
    {
      id: "1",
      title: "Apalancamiento de la Atención",
      shortDesc: "El auto cuesta $450K una vez; la atención se convierte en 10x/100x/1000x",
      fullDesc:
        "Una máquina (el reto) genera HYPE → VIRALIDAD → BASE DE DATOS → PÚBLICO REAL. El Mercedes es la carnada que captura la atención; esa atención se reinvierte en PRIME (plataforma de IA para LatAm), en PRIME Payments (stablecoins para una economía sin dólares) y en la marca global. Cada vista no es vanidad: es capital que se compone.",
      iconName: "Rocket",
    },
    {
      id: "2",
      title: "Consistencia sobre Talento",
      shortDesc: "Mi mayor riesgo es abandonar. Por eso todo está diseñado para no fallar en consistencia.",
      fullDesc:
        "Lanzar proyectos y abandonarlos es el patrón que rompo en público. La racha (Día 1, 2, 3…) es la métrica más honesta del reto: no el dinero, sino el aparecer. Sistemas, no motivación. El que no falta, gana — aunque empiece desde $10.",
      iconName: "Scale",
    },
    {
      id: "3",
      title: "Autenticidad desde la Crisis",
      shortDesc: "Misión real desde Bolivia, no flex frívolo",
      fullDesc:
        "La Gen Z de 2026 valora la autenticidad por encima del éxito material. Por eso cada hito desbloquea una 'Beca PRIME': instalo empleados de IA gratis a un negocio boliviano, en cámara. El éxito no se presume — se comparte con la economía que me formó. Esa es la respuesta al comentario de los 1.300 likes.",
      iconName: "Crown",
    },
  ],
  quote:
    "No me lo compró mi papá. Empecé desde $10, desde Bolivia, en cámara. El auto es la carnada — el imperio es la meta.",
  quoteAuthor: "Kev — @kev.project.gta",
}

const initialMilestones: Milestone[] = [
  {
    id: "1",
    year: "2024",
    title: "Nace PRIME",
    description:
      "Fundo PRIME: empleados de IA para empresas (primebusiness.live). La tesis: no ser un wrapper, sino un moat de datos propios + nicho. El motor que financiará todo.",
    netWorth: "PRIME v1",
    iconName: "Flag",
    highlight: false,
  },
  {
    id: "2",
    year: "2025",
    title: "El Comentario de los 1.300 Likes",
    description:
      "El reto original en TikTok queda inactivo. Un comentario con 1.300 likes — 'me lo compró mi papá' — se vuelve el villano. La semilla del relanzamiento.",
    netWorth: "Pausa",
    iconName: "Globe",
    highlight: false,
  },
  {
    id: "3",
    year: "2026",
    title: "El Relanzamiento · Día 1",
    description:
      "Vuelvo. De $10 a un Mercedes-AMG GT 63 Mansory, desde Bolivia en crisis, en cámara. El contador se alimenta del revenue real de PRIME.",
    netWorth: "$10",
    iconName: "Star",
    highlight: true,
  },
  {
    id: "4",
    year: "Meta",
    title: "Mercedes-AMG GT 63 Mansory",
    description:
      "La carnada pública: ~$450.000. El auto que responde al comentario. Cada hito en el camino desbloquea una Beca PRIME para un negocio boliviano.",
    netWorth: "$450K",
    iconName: "TrendingUp",
    highlight: true,
  },
  {
    id: "5",
    year: "El Imperio",
    title: "La Capa Secreta",
    description:
      "El auto nunca fue la meta. PRIME como plataforma de IA para LatAm, PRIME Payments en stablecoins, y la marca global. La atención compuesta hacia los $1.000.000.000.",
    netWorth: "$1B",
    iconName: "Crown",
    highlight: false,
  },
]

const initialGoals: Goal[] = [
  {
    id: "1",
    name: "Mercedes-AMG GT 63 Mansory",
    targetValue: 450_000,
    currentValue: 10,
    deadline: "2027-12-31",
    category: "milestone",
    createdAt: "2026-06-20",
  },
  {
    id: "2",
    name: "El Imperio (capa secreta)",
    targetValue: 1_000_000_000,
    currentValue: 10,
    deadline: "2032-12-31",
    category: "financial",
    createdAt: "2026-06-20",
  },
  {
    id: "3",
    name: "Racha de consistencia: 30 días",
    targetValue: 30,
    currentValue: 1,
    deadline: "2026-07-20",
    category: "personal",
    createdAt: "2026-06-20",
  },
  {
    id: "4",
    name: "Becas PRIME instaladas",
    targetValue: 12,
    currentValue: 1,
    deadline: "2026-12-31",
    category: "business",
    createdAt: "2026-06-20",
  },
]

// Context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<GlobalMetrics>(initialMetrics)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(initialLiveStatus)
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>(initialPulseEntries)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [manifesto, setManifesto] = useState<ManifestoContent>(initialManifesto)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [goals, setGoals] = useState<Goal[]>(initialGoals) // Added goals state
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setThemeState] = useState<"light" | "dark">("light")
  const [locale, setLocaleState] = useState<Locale>("es")

  useEffect(() => {
    // Tema según la hora LOCAL del visitante: claro de día, oscuro de noche.
    const h = new Date().getHours()
    const initialTheme: "light" | "dark" = h < 7 || h >= 19 ? "dark" : "light"
    setThemeState(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")

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
      // Solo reemplazamos el contenido semilla del reto si la DB realmente trae datos.
      if (formattedEntries.length > 0) setPulseEntries(formattedEntries)
    }

    loadPulseEntries()

    // Subscribe to real-time pulse updates
    const unsubscribePulse = subscribeToDailyPulse((pulse, event) => {
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

    // Load initial projects from Supabase
    const loadProjects = async () => {
      const supabaseProjects = await getProjects()
      console.log('DEBUG: Raw Supabase projects:', supabaseProjects)
      const formattedProjects: Project[] = supabaseProjects.map((p) => ({
        id: p.id,
        name: p.name,
        type: "Venture", // Default type
        value: p.valuation,
        invested: 0, // Not in DB
        change: p.roi,
        trend: p.roi >= 0 ? "up" : "down",
        status: p.status as any, // Assuming DB values match exact strings or close enough
        allocation: 0, // Will be calculated dynamically if needed
        description: "",
        lastUpdate: new Date(p.created_at).toLocaleDateString(),
      }))
      // Solo reemplazamos las 4 marcas semilla si la DB realmente trae proyectos.
      if (formattedProjects.length > 0) setProjects(formattedProjects)
    }

    loadProjects()

    // Subscribe to real-time projects updates
    const unsubscribeProjects = subscribeToProjects((project, event) => {
      if (event === 'INSERT' || event === 'UPDATE') {
        const formattedProject: Project = {
          id: project.id,
          name: project.name,
          type: "Venture",
          value: project.valuation,
          invested: 0,
          change: project.roi,
          trend: project.roi >= 0 ? "up" : "down",
          status: project.status as any,
          allocation: 0,
          description: "",
          lastUpdate: new Date(project.created_at).toLocaleDateString(),
        }

        setProjects((prev) => {
          if (event === 'UPDATE') {
            return prev.map(p => p.id === project.id ? formattedProject : p)
          }
          return [...prev, formattedProject]
        })
      } else if (event === 'DELETE') {
        setProjects((prev) => prev.filter((p) => p.id !== project.id))
      }
    })

    return () => {
      unsubscribePulse()
      unsubscribeProjects()
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
