"use client"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { toast } from "sonner"
import {
  MapPin,
  Clock,
  Briefcase,
  Users,
  Lightbulb,
  ImageIcon,
  Send,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react"

type PulseCategory = "business" | "networking" | "personal"

export function DailyPulseView() {
  const [newPost, setNewPost] = useState("")
  const [category, setCategory] = useState<PulseCategory>("business")
  const { pulseEntries, liveStatus, isAdmin, addPulseEntry, deletePulseEntry, isLoading, t } = useApp()

  const categoryConfig: Record<PulseCategory, { label: string; color: string; bg: string; icon: typeof Briefcase }> = {
    business: { label: t.pulse.business, color: "text-kev-primary", bg: "bg-kev-primary/10", icon: Briefcase },
    networking: { label: t.pulse.networking, color: "text-blue-400", bg: "bg-blue-400/10", icon: Users },
    personal: { label: t.pulse.personal, color: "text-amber-400", bg: "bg-amber-400/10", icon: Lightbulb },
  }

  const handlePost = async () => {
    if (!newPost.trim()) {
      toast.error(t.pulse.enterContent)
      return
    }
    await addPulseEntry({ content: newPost, category })
    setNewPost("")
    toast.success(t.pulse.pulsePosted)
  }

  const handleDelete = async (id: string) => {
    await deletePulseEntry(id)
    toast.success(t.pulse.pulseDeleted)
  }

  const getAvailabilityText = (availability: string) => {
    if (availability === "available") return t.pulse.live
    if (availability === "busy") return t.pulse.busy
    return t.pulse.offline
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t.pulse.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.pulse.subtitle}</p>
        </div>
      </div>

      {/* Live Status Card - using dynamic data */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center glow-green-subtle">
              <span className="text-lg font-semibold text-white">KS</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground">Kevin Strategy</span>
                <div
                  className={`flex items-center gap-1 text-xs ${
                    liveStatus.availability === "available"
                      ? "text-kev-success"
                      : liveStatus.availability === "busy"
                        ? "text-amber-500"
                        : "text-neutral-400"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      liveStatus.availability === "available"
                        ? "bg-kev-success"
                        : liveStatus.availability === "busy"
                          ? "bg-amber-500"
                          : "bg-neutral-400"
                    }`}
                  />
                  <span className="capitalize">{getAvailabilityText(liveStatus.availability)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {liveStatus.location}, {liveStatus.country}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {t.pulse.localTime}: {liveStatus.localTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-kev-primary/5 border border-kev-primary/20">
          <div className="text-xs text-kev-primary font-medium mb-1 uppercase tracking-wider">{t.pulse.currently}</div>
          <p className="text-foreground">{liveStatus.currentActivity}</p>
        </div>
      </div>

      {/* New Post Composer */}
      <div className="glass-card p-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-white">KS</span>
          </div>
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={t.pulse.placeholder}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-sm min-h-[60px]"
            />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                {(["business", "networking", "personal"] as const).map((cat) => {
                  const config = categoryConfig[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                        category === cat
                          ? `${config.bg} ${config.color} border border-current/20`
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {config.label}
                    </button>
                  )
                })}
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors">
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handlePost}
                disabled={isLoading || !newPost.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-kev-primary text-white rounded-lg text-sm font-medium hover:bg-kev-primary-light transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t.pulse.post}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed - using dynamic entries */}
      <div className="space-y-4">
        {pulseEntries.map((entry) => {
          const config = categoryConfig[entry.category]
          return (
            <div key={entry.id} className="glass-card p-5 transition-all hover:border-kev-primary/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kev-primary to-kev-primary-light flex items-center justify-center">
                    <span className="text-xs font-medium text-white">KS</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground text-sm">Kevin Strategy</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.timeAgo}</span>
                      <span>·</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        <config.icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-foreground leading-relaxed">{entry.content}</p>

              {entry.hasImage && entry.imageUrl && (
                <div className="mt-4 rounded-xl overflow-hidden border border-border/50">
                  <img
                    src={entry.imageUrl || "/placeholder.svg"}
                    alt="Post attachment"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
