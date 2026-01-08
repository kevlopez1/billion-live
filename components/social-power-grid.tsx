"use client"

import { Youtube, Instagram, Twitter, TrendingUp, Users } from "lucide-react"

const socialPlatforms = [
  {
    name: "YouTube",
    icon: Youtube,
    followers: "847K",
    change: "+12.3K",
    changePercent: "+1.5%",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  {
    name: "Instagram",
    icon: Instagram,
    followers: "523K",
    change: "+8.7K",
    changePercent: "+1.7%",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
  },
  {
    name: "X (Twitter)",
    icon: Twitter,
    followers: "312K",
    change: "+5.2K",
    changePercent: "+1.7%",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "border-sky-400/20",
  },
]

export function SocialPowerGrid() {
  const totalFollowers = "1.68M"

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Social Power</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Influence as an asset</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-kev-primary" />
          <span className="font-semibold text-foreground number-display">{totalFollowers}</span>
          <span className="text-muted-foreground">Total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {socialPlatforms.map((platform) => (
          <div
            key={platform.name}
            className={`p-4 rounded-xl border ${platform.borderColor} ${platform.bgColor} transition-all hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <platform.icon className={`w-5 h-5 ${platform.color}`} />
                <span className="text-sm font-medium text-foreground">{platform.name}</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground number-display">{platform.followers}</div>
                <div className="text-xs text-muted-foreground">Followers</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-kev-success text-sm font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {platform.change}
                </div>
                <div className="text-xs text-muted-foreground">This month</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
