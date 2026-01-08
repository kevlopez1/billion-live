"use client"

import { useState } from "react"
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Moon,
  Sun,
  Check,
  Globe,
  Loader2,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Lock,
  Smartphone,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react"
import { useApp } from "@/context/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

export function SettingsView() {
  const { theme, setTheme, locale, setLocale, t, metrics, projects } = useApp()
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    weekly: false,
    alerts: true,
  })

  // Profile state
  const [profile, setProfile] = useState({
    name: "Kevin Strategy",
    email: "kevin@kevstrategy.com",
    company: "Kev Strategy LLC",
    timezone: "UTC-5 (Eastern Time)",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Dialog states
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [showSessionsDialog, setShowSessionsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)

  // Form states
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [apiKey, setApiKey] = useState("sk_live_kev_2024_xR7mP9qL3nK5vB8wT1yC")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Sessions data
  const [sessions] = useState([
    { id: "1", device: "MacBook Pro", location: "Dubai, UAE", lastActive: "Now", current: true },
    { id: "2", device: "iPhone 15 Pro", location: "Dubai, UAE", lastActive: "2 hours ago", current: false },
    { id: "3", device: "iPad Pro", location: "Singapore", lastActive: "3 days ago", current: false },
  ])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsSavingProfile(false)
    toast.success("Profile updated successfully!")
  }

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      toast.error("Please fill in all fields")
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("New passwords do not match")
      return
    }
    if (passwordForm.new.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    setShowPasswordDialog(false)
    setPasswordForm({ current: "", new: "", confirm: "" })
    toast.success("Password changed successfully!")
  }

  const handleRevokeAllSessions = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    setShowSessionsDialog(false)
    toast.success("All other sessions have been revoked")
  }

  const handleRegenerateApiKey = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const newKey = `sk_live_kev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    setApiKey(newKey)
    setIsLoading(false)
    toast.success("New API key generated!")
  }

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    toast.success("API key copied to clipboard!")
  }

  const handleExportData = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const data = {
      profile,
      metrics,
      projects: projects.map((p) => ({
        name: p.name,
        type: p.type,
        value: p.value,
        invested: p.invested,
        status: p.status,
      })),
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `kev-strategy-export-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setIsLoading(false)
    toast.success("Data exported successfully!")
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm')
      return
    }

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsLoading(false)
    setShowDeleteDialog(false)
    toast.success("Account deletion requested. You will receive a confirmation email.")
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.settings.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-8 space-y-4">
          {/* Profile Section */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.profile}</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
                <span className="text-xl font-semibold text-white">KS</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{profile.name}</h3>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <button
                  onClick={() => setShowAvatarDialog(true)}
                  className="mt-2 text-sm text-kev-primary hover:text-kev-primary-light transition-colors"
                >
                  {t.settings.changeAvatar}
                </button>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="px-4 py-2 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  {t.settings.fullName}
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  {t.settings.email}
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  {t.settings.company}
                </label>
                <input
                  type="text"
                  value={profile.company}
                  onChange={(e) => setProfile((prev) => ({ ...prev, company: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  {t.settings.timezone}
                </label>
                <select
                  value={profile.timezone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50 transition-colors"
                >
                  <option>UTC-5 (Eastern Time)</option>
                  <option>UTC-8 (Pacific Time)</option>
                  <option>UTC+0 (London)</option>
                  <option>UTC+4 (Dubai)</option>
                  <option>UTC+8 (Singapore)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.notifications}</h2>
            </div>

            <div className="space-y-4">
              {[
                { key: "email", label: t.settings.emailNotifications, description: t.settings.emailDesc },
                { key: "push", label: t.settings.pushNotifications, description: t.settings.pushDesc },
                { key: "weekly", label: t.settings.weeklyDigest, description: t.settings.weeklyDesc },
                { key: "alerts", label: t.settings.priceAlerts, description: t.settings.alertsDesc },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  <button
                    onClick={() => {
                      setNotifications((prev) => ({
                        ...prev,
                        [item.key]: !prev[item.key as keyof typeof prev],
                      }))
                      toast.success(
                        `${item.label} ${notifications[item.key as keyof typeof notifications] ? "disabled" : "enabled"}`,
                      )
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notifications[item.key as keyof typeof notifications]
                        ? "bg-kev-primary"
                        : "bg-secondary border border-border/50"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        notifications[item.key as keyof typeof notifications] ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.security}</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <div className="font-medium text-sm">{t.settings.password}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.settings.lastChanged} 30 {t.settings.daysAgo}
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordDialog(true)}
                  className="text-sm text-kev-primary hover:text-kev-primary-light transition-colors"
                >
                  {t.settings.change}
                </button>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div>
                  <div className="font-medium text-sm">{t.settings.twoFactor}</div>
                  <div className="text-xs text-kev-success flex items-center gap-1">
                    <Check className="w-3 h-3" /> {t.settings.enabled}
                  </div>
                </div>
                <button
                  onClick={() => setShow2FADialog(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.settings.manage}
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">{t.settings.activeSessions}</div>
                  <div className="text-xs text-muted-foreground">3 {t.settings.devicesConnected}</div>
                </div>
                <button
                  onClick={() => setShowSessionsDialog(true)}
                  className="text-sm text-kev-danger hover:text-red-400 transition-colors"
                >
                  {t.settings.revokeAll}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.language}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLocale("en")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  locale === "en" ? "border-kev-primary bg-kev-primary/10" : "border-border/50 hover:border-border"
                }`}
              >
                <div className="w-full h-10 rounded bg-secondary/50 mb-2 flex items-center justify-center text-lg">
                  🇺🇸
                </div>
                <span className="text-xs font-medium">{t.settings.english}</span>
              </button>
              <button
                onClick={() => setLocale("es")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  locale === "es" ? "border-kev-primary bg-kev-primary/10" : "border-border/50 hover:border-border"
                }`}
              >
                <div className="w-full h-10 rounded bg-secondary/50 mb-2 flex items-center justify-center text-lg">
                  🇪🇸
                </div>
                <span className="text-xs font-medium">{t.settings.spanish}</span>
              </button>
            </div>
          </div>

          {/* Appearance */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.appearance}</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span className="text-sm">{theme === "dark" ? t.settings.darkMode : t.settings.lightMode}</span>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    theme === "dark" ? "bg-kev-primary" : "bg-secondary border border-border/50"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      theme === "dark" ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    theme === "light" ? "border-kev-primary bg-kev-primary/10" : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="w-full h-12 rounded bg-white border border-neutral-200 mb-2 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-neutral-600" />
                  </div>
                  <span className="text-xs font-medium">{t.settings.light}</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    theme === "dark" ? "border-kev-primary bg-kev-primary/10" : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="w-full h-12 rounded bg-neutral-900 border border-neutral-700 mb-2 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-neutral-300" />
                  </div>
                  <span className="text-xs font-medium">{t.settings.dark}</span>
                </button>
              </div>
            </div>
          </div>

          {/* API Access */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.apiAccess}</h2>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-secondary/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{t.settings.apiKey}</div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm truncate flex-1">
                    {showApiKey ? apiKey : "sk_live_••••••••••••••••"}
                  </div>
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={handleCopyApiKey} className="p-1 text-muted-foreground hover:text-foreground">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyDialog(true)}
                className="w-full py-2 text-sm text-kev-primary hover:text-kev-primary-light border border-kev-primary/30 hover:border-kev-primary/50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t.settings.generateNewKey}
              </button>
            </div>
          </div>

          {/* Data */}
          <div className="glass-card p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-kev-primary" />
              <h2 className="text-base font-semibold">{t.settings.data}</h2>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExportData}
                disabled={isLoading}
                className="w-full py-2 text-sm text-foreground hover:bg-secondary/50 border border-border/50 hover:border-border rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t.settings.exportData}
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full py-2 text-sm text-kev-danger hover:bg-kev-danger/10 border border-kev-danger/30 hover:border-kev-danger/50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t.settings.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-kev-primary" />
              Change Avatar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="w-24 h-24 mx-auto rounded-xl bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
              <span className="text-3xl font-semibold text-white">KS</span>
            </div>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-kev-primary/50 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
            </div>
            <button
              onClick={() => {
                setShowAvatarDialog(false)
                toast.success("Avatar feature coming soon!")
              }}
              className="w-full py-2.5 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm font-medium transition-colors"
            >
              Upload Avatar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-kev-primary" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-10 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, new: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-10 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-10 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={isLoading}
              className="w-full py-2.5 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Change Password
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-kev-primary" />
              Two-Factor Authentication
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-kev-success/10 border border-kev-success/20 rounded-lg">
              <div className="flex items-center gap-2 text-kev-success mb-1">
                <Check className="w-4 h-4" />
                <span className="font-medium">2FA is enabled</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is protected with two-factor authentication via authenticator app.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShow2FADialog(false)
                  toast.info("Backup codes feature coming soon!")
                }}
                className="w-full py-2 text-sm text-foreground hover:bg-secondary/50 border border-border/50 rounded-lg transition-colors"
              >
                View Backup Codes
              </button>
              <button
                onClick={() => {
                  setShow2FADialog(false)
                  toast.info("2FA reconfiguration coming soon!")
                }}
                className="w-full py-2 text-sm text-foreground hover:bg-secondary/50 border border-border/50 rounded-lg transition-colors"
              >
                Reconfigure 2FA
              </button>
              <button
                onClick={() => {
                  setShow2FADialog(false)
                  toast.warning("2FA disabled (demo)")
                }}
                className="w-full py-2 text-sm text-kev-danger hover:bg-kev-danger/10 border border-kev-danger/30 rounded-lg transition-colors"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-kev-primary" />
              Active Sessions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg ${session.current ? "bg-kev-primary/10 border border-kev-primary/20" : "bg-secondary/30"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{session.device}</span>
                      {session.current && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-kev-primary/20 text-kev-primary rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{session.location}</p>
                    <p className="text-xs text-muted-foreground">Last active: {session.lastActive}</p>
                  </div>
                  {!session.current && (
                    <button
                      onClick={() => toast.success(`Session on ${session.device} revoked`)}
                      className="text-xs text-kev-danger hover:text-red-400"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <button
              onClick={handleRevokeAllSessions}
              disabled={isLoading}
              className="w-full py-2.5 bg-kev-danger hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Revoke All Other Sessions
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-kev-primary" />
              Regenerate API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-kev-warning/10 border border-kev-warning/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-kev-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-kev-warning">Warning</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Regenerating your API key will invalidate the current key. Any applications using the old key will
                    stop working.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowApiKeyDialog(false)}
                className="flex-1 py-2.5 text-sm text-foreground hover:bg-secondary/50 border border-border/50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRegenerateApiKey()
                  setShowApiKeyDialog(false)
                }}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-kev-primary hover:bg-kev-primary-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerate
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-kev-danger">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-kev-danger/10 border border-kev-danger/20 rounded-lg">
              <p className="text-sm text-foreground">
                This action is <strong>permanent</strong> and cannot be undone. All your data, projects, and settings
                will be permanently deleted.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Type <span className="font-mono bg-secondary/50 px-1 rounded">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-kev-danger/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteConfirmText("")
                }}
                className="flex-1 py-2.5 text-sm text-foreground hover:bg-secondary/50 border border-border/50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isLoading || deleteConfirmText !== "DELETE"}
                className="flex-1 py-2.5 bg-kev-danger hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Account
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
