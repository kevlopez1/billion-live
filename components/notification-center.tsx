"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Settings,
  TrendingUp,
  DollarSign,
  Target,
  AlertTriangle,
  Info,
  Volume2,
  Mail,
  Smartphone,
} from "lucide-react"

export interface Notification {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  type: "investment" | "milestone" | "alert" | "info" | "goal"
  priority: "low" | "medium" | "high"
  actionUrl?: string
}

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

const typeIcons = {
  investment: DollarSign,
  milestone: Target,
  alert: AlertTriangle,
  info: Info,
  goal: TrendingUp,
}

const typeColors = {
  investment: "text-kev-primary bg-kev-primary/10",
  milestone: "text-kev-success bg-kev-success/10",
  alert: "text-amber-500 bg-amber-500/10",
  info: "text-blue-400 bg-blue-400/10",
  goal: "text-purple-400 bg-purple-400/10",
}

const priorityColors = {
  low: "border-l-neutral-500",
  medium: "border-l-amber-500",
  high: "border-l-red-500",
}

export function NotificationCenter({
  open,
  onOpenChange,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}: NotificationCenterProps) {
  const { t } = useApp()
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    soundEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    investmentAlerts: true,
    milestoneAlerts: true,
    goalAlerts: true,
    priceAlerts: true,
  })

  const unreadCount = notifications.filter((n) => !n.read).length
  const filteredNotifications = filter === "all" ? notifications : notifications.filter((n) => !n.read)

  const handleSettingChange = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
    toast.success("Notification settings updated")
  }

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups: Record<string, Notification[]> = {}

    notifications.forEach((notification) => {
      const time = notification.time
      let group = "Earlier"

      if (time.includes("min") || time.includes("hour")) {
        group = "Today"
      } else if (time.includes("day")) {
        const days = Number.parseInt(time)
        if (days === 1) group = "Yesterday"
        else if (days <= 7) group = "This Week"
      }

      if (!groups[group]) groups[group] = []
      groups[group].push(notification)
    })

    return groups
  }

  const groupedNotifications = groupNotificationsByDate(filteredNotifications)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-kev-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-kev-primary/20 text-kev-primary rounded-full">
                  {unreadCount} new
                </span>
              )}
            </DialogTitle>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? "bg-kev-primary/10 text-kev-primary" : "hover:bg-secondary/50 text-muted-foreground"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        {showSettings ? (
          <div className="space-y-4 py-4">
            <h3 className="text-sm font-medium">Notification Preferences</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Sound</div>
                    <div className="text-xs text-muted-foreground">Play sound for notifications</div>
                  </div>
                </div>
                <Switch checked={settings.soundEnabled} onCheckedChange={() => handleSettingChange("soundEnabled")} />
              </div>

              <div className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <div className="text-xs text-muted-foreground">Receive email notifications</div>
                  </div>
                </div>
                <Switch checked={settings.emailEnabled} onCheckedChange={() => handleSettingChange("emailEnabled")} />
              </div>

              <div className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Push</div>
                    <div className="text-xs text-muted-foreground">Browser push notifications</div>
                  </div>
                </div>
                <Switch checked={settings.pushEnabled} onCheckedChange={() => handleSettingChange("pushEnabled")} />
              </div>
            </div>

            <h3 className="text-sm font-medium mt-6">Alert Types</h3>

            <div className="space-y-3">
              {[
                { key: "investmentAlerts", label: "Investment Updates", icon: DollarSign },
                { key: "milestoneAlerts", label: "Milestones", icon: Target },
                { key: "goalAlerts", label: "Goal Progress", icon: TrendingUp },
                { key: "priceAlerts", label: "Price Alerts", icon: AlertTriangle },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 glass-card">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <Switch
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onCheckedChange={() => handleSettingChange(item.key as keyof typeof settings)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center justify-between py-2">
              <div className="flex gap-1 p-1 bg-secondary/30 rounded-lg">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filter === "all" ? "bg-kev-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("unread")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filter === "unread" ? "bg-kev-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="flex items-center gap-1 text-xs text-kev-primary hover:text-kev-primary-light transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                    <BellOff className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedNotifications).map(([group, items]) => (
                    <div key={group}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">{group}</div>
                      <div className="space-y-2">
                        {items.map((notification) => {
                          const Icon = typeIcons[notification.type]
                          return (
                            <div
                              key={notification.id}
                              className={`group relative p-3 glass-card border-l-2 ${priorityColors[notification.priority]} ${
                                !notification.read ? "bg-kev-primary/5" : ""
                              } hover:border-kev-primary/30 transition-all cursor-pointer`}
                              onClick={() => !notification.read && onMarkAsRead(notification.id)}
                            >
                              <div className="flex gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[notification.type]}`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4
                                      className={`text-sm font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}
                                    >
                                      {notification.title}
                                    </h4>
                                    {!notification.read && (
                                      <div className="w-2 h-2 rounded-full bg-kev-primary shrink-0 mt-1.5" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {notification.description}
                                  </p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-muted-foreground">{notification.time}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete(notification.id)
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 rounded transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="pt-3 border-t border-border/50 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 bg-transparent"
                  onClick={onClearAll}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Notifications
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
