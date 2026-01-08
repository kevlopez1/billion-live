"use client"

import { useState } from "react"
import { ArrowUpRight, ArrowDownLeft, FileText, Users, Bell, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const activities = [
  {
    type: "transaction",
    title: "Investment received",
    description: "Apex Ventures Series B",
    amount: "+$2,500,000",
    time: "2 min ago",
    positive: true,
  },
  {
    type: "user",
    title: "New investor onboarded",
    description: "Capital Partners LLC",
    time: "15 min ago",
  },
  {
    type: "document",
    title: "Contract signed",
    description: "Neural Labs partnership",
    time: "1 hour ago",
  },
  {
    type: "transaction",
    title: "Dividend payout",
    description: "Q3 distributions",
    amount: "-$450,000",
    time: "3 hours ago",
    positive: false,
  },
  {
    type: "alert",
    title: "Milestone reached",
    description: "$45M portfolio value",
    time: "5 hours ago",
  },
  {
    type: "transaction",
    title: "Real estate acquisition",
    description: "Downtown Dubai property",
    amount: "+$12,000,000",
    time: "1 day ago",
    positive: true,
  },
  {
    type: "document",
    title: "Due diligence complete",
    description: "Quantum Trading audit",
    time: "2 days ago",
  },
  {
    type: "user",
    title: "Team member joined",
    description: "Sarah Chen - CFO",
    time: "3 days ago",
  },
]

const iconMap = {
  transaction: ArrowUpRight,
  user: Users,
  document: FileText,
  alert: Bell,
}

export function ActivityFeed() {
  const [showAll, setShowAll] = useState(false)

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Recent Activity</h2>
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-kev-primary hover:text-kev-primary-light transition-colors font-medium"
        >
          View all
        </button>
      </div>

      <div className="space-y-3 flex-1">
        {activities.slice(0, 5).map((activity, i) => {
          const Icon = iconMap[activity.type as keyof typeof iconMap]
          return (
            <div
              key={i}
              className="flex items-start gap-3 group cursor-pointer hover:bg-secondary/30 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <div className="p-2 bg-kev-primary/10 border border-kev-primary/20 rounded-lg flex-shrink-0 group-hover:bg-kev-primary/15 transition-colors">
                {activity.type === "transaction" && activity.positive === false ? (
                  <ArrowDownLeft className="w-4 h-4 text-kev-primary" />
                ) : (
                  <Icon className="w-4 h-4 text-kev-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  {activity.amount && (
                    <span
                      className={`text-sm font-medium number-display shrink-0 ${
                        activity.positive ? "text-kev-success" : "text-kev-danger"
                      }`}
                    >
                      {activity.amount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{activity.time}</p>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-kev-primary" />
              All Activity
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {activities.map((activity, i) => {
              const Icon = iconMap[activity.type as keyof typeof iconMap]
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="p-2 bg-kev-primary/10 border border-kev-primary/20 rounded-lg flex-shrink-0">
                    {activity.type === "transaction" && activity.positive === false ? (
                      <ArrowDownLeft className="w-4 h-4 text-kev-primary" />
                    ) : (
                      <Icon className="w-4 h-4 text-kev-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.amount && (
                        <span
                          className={`text-sm font-medium number-display ${activity.positive ? "text-kev-success" : "text-kev-danger"}`}
                        >
                          {activity.amount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
