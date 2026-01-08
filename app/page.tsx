"use client"

import { useState } from "react"
import Image from "next/image"
import { useApp } from "@/context/app-context"
import { useAuth } from "@/context/auth-context"
import { CommandBar } from "@/components/command-bar"
import { PortfolioOverview } from "@/components/portfolio-overview"
import { MetricsGrid } from "@/components/metrics-grid"
import { ProjectsList } from "@/components/projects-list"
import { RevenueChart } from "@/components/revenue-chart"
import { ActivityFeed } from "@/components/activity-feed"
import { MobileNav } from "@/components/mobile-nav"
import { ParticlesBackground } from "@/components/particles-background"
import { AnalyticsView } from "@/components/analytics-view"
import { ProjectsView } from "@/components/projects-view"
import { SettingsView } from "@/components/settings-view"
import { DailyPulseView } from "@/components/daily-pulse-view"
import { ManifestoView } from "@/components/manifesto-view"
import { JourneyView } from "@/components/journey-view"
import { SocialPowerGrid } from "@/components/social-power-grid"
import { GlobalPresenceMap } from "@/components/global-presence-map"
import { CommunityWall } from "@/components/community-wall"
import { AdminView } from "@/components/admin-view"
import { GoalsView } from "@/components/goals-view"
import { CalendarView } from "@/components/calendar-view"
import { AchievementsView } from "@/components/achievements-view"
import { LoginDialog } from "@/components/login-dialog"
import { InstallPWAPrompt } from "@/components/install-pwa-prompt"
import { AIAssistantButton } from "@/components/ai-assistant"
import { NotificationCenter, type Notification } from "@/components/notification-center"
import { ExportReports } from "@/components/export-reports"
import { toast } from "sonner"
import {
  Bell,
  Search,
  Command,
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Cog,
  Activity,
  BookOpen,
  Milestone,
  Shield,
  Lock,
  Target,
  LogOut,
  Calendar,
  Trophy,
  Download,
} from "lucide-react"

export type ActiveView =
  | "dashboard"
  | "projects"
  | "analytics"
  | "settings"
  | "pulse"
  | "manifesto"
  | "history"
  | "admin"
  | "goals"
  | "calendar"
  | "achievements"

const initialNotifications: Notification[] = [
  {
    id: "1",
    title: "New investment received",
    description: "Apex Ventures Series B - $2.5M funding round completed successfully",
    time: "2 min ago",
    read: false,
    type: "investment",
    priority: "high",
  },
  {
    id: "2",
    title: "Milestone reached",
    description: "Portfolio value hit $225M - You're 22.5% of the way to $1B!",
    time: "1 hour ago",
    read: false,
    type: "milestone",
    priority: "medium",
  },
  {
    id: "3",
    title: "Contract signed",
    description: "Neural Labs partnership finalized - Expected ROI: 35%",
    time: "3 hours ago",
    read: true,
    type: "investment",
    priority: "medium",
  },
  {
    id: "4",
    title: "Weekly report ready",
    description: "Q4 performance summary available for download",
    time: "1 day ago",
    read: true,
    type: "info",
    priority: "low",
  },
  {
    id: "5",
    title: "Goal progress update",
    description: "You're 45% toward your 'First $500M' goal",
    time: "2 days ago",
    read: true,
    type: "goal",
    priority: "medium",
  },
  {
    id: "6",
    title: "Price alert triggered",
    description: "Quantum Trading ROI exceeded 30% threshold",
    time: "3 days ago",
    read: true,
    type: "alert",
    priority: "high",
  },
]

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard")
  const [commandOpen, setCommandOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const { metrics, t } = useApp()
  const { isAuthenticated, user, logout } = useAuth()

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success("All notifications marked as read")
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    toast.success("Notification deleted")
  }

  const clearAllNotifications = () => {
    setNotifications([])
    toast.success("All notifications cleared")
  }

  const handleAdminAccess = () => {
    if (isAuthenticated) {
      setActiveView("admin")
    } else {
      setLoginOpen(true)
    }
  }

  const handleLogout = () => {
    logout()
    if (activeView === "admin") {
      setActiveView("dashboard")
    }
  }

  const navItems = [
    { id: "dashboard" as const, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: "pulse" as const, label: t.nav.dailyPulse, icon: Activity },
    { id: "projects" as const, label: t.nav.projects, icon: FolderKanban },
    { id: "goals" as const, label: t.nav.goals, icon: Target },
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "achievements" as const, label: "Achievements", icon: Trophy },
    { id: "manifesto" as const, label: t.nav.manifesto, icon: BookOpen },
    { id: "history" as const, label: t.nav.journey, icon: Milestone },
    { id: "analytics" as const, label: t.nav.analytics, icon: BarChart3 },
    { id: "settings" as const, label: t.nav.settings, icon: Cog },
  ]

  const allNavItems = isAuthenticated
    ? [...navItems, { id: "admin" as const, label: t.nav.admin, icon: Shield }]
    : navItems

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="view-transition stagger-children">
            <div className="flex items-end justify-between mb-2">
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t.dashboard.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t.dashboard.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-kev-success animate-pulse" />
                <span>{t.dashboard.liveData}</span>
              </div>
            </div>

            <PortfolioOverview />
            <MetricsGrid />
            <SocialPowerGrid />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="glass-card h-full hover-lift">
                  <RevenueChart />
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="glass-card h-full hover-lift">
                  <ActivityFeed />
                </div>
              </div>
            </div>

            <GlobalPresenceMap />

            <div className="glass-card hover-lift">
              <ProjectsList />
            </div>

            <CommunityWall />
          </div>
        )
      case "pulse":
        return (
          <div className="view-transition">
            <DailyPulseView />
          </div>
        )
      case "manifesto":
        return (
          <div className="view-transition">
            <ManifestoView />
          </div>
        )
      case "history":
        return (
          <div className="view-transition">
            <JourneyView />
          </div>
        )
      case "projects":
        return (
          <div className="view-transition">
            <ProjectsView />
          </div>
        )
      case "goals":
        return (
          <div className="view-transition">
            <GoalsView />
          </div>
        )
      case "calendar":
        return (
          <div className="view-transition">
            <CalendarView />
          </div>
        )
      case "achievements":
        return (
          <div className="view-transition">
            <AchievementsView />
          </div>
        )
      case "analytics":
        return (
          <div className="view-transition">
            <AnalyticsView />
          </div>
        )
      case "settings":
        return (
          <div className="view-transition">
            <SettingsView />
          </div>
        )
      case "admin":
        return isAuthenticated ? (
          <div className="view-transition">
            <AdminView />
          </div>
        ) : null
      default:
        return null
    }
  }

  const renderMobileContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="view-transition stagger-children">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">{t.dashboard.title}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{t.dashboard.subtitle}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-kev-success animate-pulse" />
                <span>Live</span>
              </div>
            </div>

            <PortfolioOverview />
            <MetricsGrid />
            <SocialPowerGrid />
            <div className="glass-card">
              <RevenueChart />
            </div>
            <div className="glass-card">
              <ActivityFeed />
            </div>
            <GlobalPresenceMap />
            <div className="glass-card">
              <ProjectsList />
            </div>
            <CommunityWall />
          </div>
        )
      case "pulse":
        return <DailyPulseView />
      case "manifesto":
        return <ManifestoView />
      case "history":
        return <JourneyView />
      case "projects":
        return <ProjectsView />
      case "goals":
        return <GoalsView />
      case "calendar":
        return <CalendarView />
      case "achievements":
        return <AchievementsView />
      case "analytics":
        return <AnalyticsView />
      case "settings":
        return <SettingsView />
      case "admin":
        return isAuthenticated ? <AdminView /> : null
      default:
        return null
    }
  }

  const getViewTitle = (view: ActiveView) => {
    const viewMap: Record<ActiveView, string> = {
      dashboard: t.nav.dashboard,
      pulse: t.nav.dailyPulse,
      projects: t.nav.projects,
      goals: t.nav.goals,
      calendar: "Calendar",
      achievements: "Achievements",
      analytics: t.nav.analytics,
      manifesto: t.nav.manifesto,
      history: t.nav.journey,
      settings: t.nav.settings,
      admin: t.nav.admin,
    }
    return viewMap[view]
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <ParticlesBackground />

      <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => setActiveView("admin")} />
      <InstallPWAPrompt />
      <AIAssistantButton />

      <NotificationCenter
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onClearAll={clearAllNotifications}
      />
      <ExportReports open={exportOpen} onOpenChange={setExportOpen} />

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen relative z-10">
        <aside className="w-64 border-r border-border/50 backdrop-blur-xl bg-background/60 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <div
              className="flex items-center gap-3 cursor-pointer press-effect"
              onDoubleClick={handleAdminAccess}
              title="Double-click to access admin"
            >
              <Image
                src="/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg"
                alt="Kev Strategy"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <div>
                <span className="text-sm font-semibold text-foreground block">Kev Strategy</span>
                <span className="text-xs text-muted-foreground">The Billion Live</span>
              </div>
              {isAuthenticated && (
                <div className="ml-auto">
                  <Lock className="w-3.5 h-3.5 text-kev-success" />
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {allNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => (item.id === "admin" ? handleAdminAccess() : setActiveView(item.id))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all press-effect ${activeView === item.id
                    ? item.id === "admin"
                      ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                      : "bg-kev-primary/15 text-kev-primary border border-kev-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Auth status / Login button at bottom */}
          <div className="p-3 border-t border-border/50">
            {isAuthenticated ? (
              <div className="glass-card p-3 !bg-kev-success/5 !border-kev-success/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
                      <span className="text-xs font-medium text-white">KS</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium">{user?.name}</div>
                      <div className="text-[10px] text-muted-foreground">{user?.role}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors press-effect"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="w-full glass-card p-3 !bg-secondary/30 hover:!border-kev-primary/30 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground press-effect"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Login</span>
              </button>
            )}
          </div>

          <div className="p-4 border-t border-border/50">
            <div className="glass-card p-3 !bg-kev-primary/5 !border-kev-primary/20">
              <div className="text-xs text-muted-foreground mb-1">{t.dashboard.netWorth}</div>
              <div className="text-lg font-semibold text-kev-primary number-display">
                ${(metrics.netWorth / 1_000_000).toFixed(1)}M
              </div>
              <div className="text-xs text-kev-success mt-1">
                +{metrics.monthlyGrowth}% {t.dashboard.monthlyGrowth.toLowerCase()}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <header className="px-6 py-4 border-b border-border/50 backdrop-blur-xl bg-background/60">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground glass-card !bg-secondary/40 hover:!border-kev-primary/30 rounded-lg transition-all press-effect"
              >
                <Search className="w-4 h-4" />
                <span className="hidden xl:inline">{t.common.search}...</span>
                <kbd className="hidden xl:inline px-1.5 py-0.5 text-[10px] font-mono bg-background/50 rounded border border-border/50">
                  <Command className="w-2.5 h-2.5 inline mr-0.5" />K
                </kbd>
              </button>

              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-kev-success/10 border border-kev-success/20 mr-2 animate-fade-in-scale">
                    <Shield className="w-3.5 h-3.5 text-kev-success" />
                    <span className="text-xs font-medium text-kev-success">Authenticated</span>
                  </div>
                )}
                <button
                  onClick={() => setExportOpen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors press-effect"
                  title="Export Reports"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors relative press-effect"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-kev-primary rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-bounce-in">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <div className="h-6 w-px bg-border/50 mx-1" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center glow-green-subtle">
                    <span className="text-xs font-medium text-white">KS</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-[1400px] mx-auto space-y-6">{renderContent()}</div>
          </main>

          <footer className="px-6 py-3 border-t border-border/50 backdrop-blur-xl bg-background/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>2024 Kev Strategy. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span>v2.1.0</span>
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-kev-success animate-pulse" />
                  Status: Operational
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col min-h-screen pb-20 relative z-10">
        <header className="sticky top-0 z-40 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 press-effect" onDoubleClick={handleAdminAccess}>
              <Image
                src="/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg"
                alt="Kev Strategy"
                width={28}
                height={28}
                className="rounded"
              />
              <span className="text-sm font-medium">{getViewTitle(activeView)}</span>
              {isAuthenticated && <Lock className="w-3 h-3 text-kev-success" />}
            </div>
            <div className="flex items-center gap-1">
              {isAuthenticated && (
                <button
                  onClick={() => setActiveView("admin")}
                  className="p-2 text-kev-success hover:bg-kev-success/10 rounded-md press-effect"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setExportOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md press-effect"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCommandOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md press-effect"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setNotificationsOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md relative press-effect"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-kev-primary rounded-full" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="space-y-4">{renderMobileContent()}</div>
        </main>

        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>
    </div>
  )
}
