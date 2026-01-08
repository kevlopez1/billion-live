"use client"

import { useState, useMemo } from "react"
import { useApp, type Project } from "@/context/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  DollarSign,
  BarChart3,
  Target,
  Clock,
  ExternalLink,
  Download,
  Share2,
  Edit,
  PieChart,
  Activity,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
} from "recharts"
import { toast } from "sonner"

interface ProjectDetailViewProps {
  project: Project
  open: boolean
  onClose: () => void
}

// Generate mock historical data for charts
const generateHistoricalData = (project: Project) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const currentMonth = new Date().getMonth()
  const data = []

  let value = project.invested
  const monthlyGrowth = project.change / 12

  for (let i = 0; i < 12; i++) {
    const monthIndex = (currentMonth - 11 + i + 12) % 12
    const variance = (Math.random() - 0.3) * monthlyGrowth
    value = value * (1 + (monthlyGrowth + variance) / 100)

    data.push({
      month: months[monthIndex],
      value: Math.round(value),
      invested: project.invested,
      profit: Math.round(value - project.invested),
    })
  }

  // Ensure last value matches current
  data[11].value = project.value
  data[11].profit = project.value - project.invested

  return data
}

const generateMonthlyReturns = (project: Project) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const currentMonth = new Date().getMonth()

  return months.slice(0, currentMonth + 1).map((month, i) => ({
    month,
    return: (Math.random() * 10 - 2 + project.change / 12).toFixed(1),
  }))
}

const generateAllocationData = (project: Project) => {
  const types = [
    { name: "Principal", value: project.invested, color: "hsl(var(--kev-primary))" },
    { name: "Gains", value: Math.max(0, project.value - project.invested), color: "#22c55e" },
    { name: "Unrealized", value: Math.max(0, project.value * 0.1), color: "#3b82f6" },
  ]
  return types.filter((t) => t.value > 0)
}

export function ProjectDetailView({ project, open, onClose }: ProjectDetailViewProps) {
  const { t, isAdmin, updateProject } = useApp()
  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "transactions">("overview")

  const historicalData = useMemo(() => generateHistoricalData(project), [project])
  const monthlyReturns = useMemo(() => generateMonthlyReturns(project), [project])
  const allocationData = useMemo(() => generateAllocationData(project), [project])

  const roi = ((project.value - project.invested) / project.invested) * 100
  const profit = project.value - project.invested

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const statusColors: Record<string, string> = {
    Active: "bg-kev-success/15 text-kev-success border border-kev-success/20",
    Growth: "bg-kev-primary/15 text-kev-primary border border-kev-primary/20",
    Stable: "bg-neutral-500/15 text-neutral-400 border border-neutral-500/20",
    Monitoring: "bg-kev-warning/15 text-kev-warning border border-kev-warning/20",
    Completed: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  }

  const handleExportProject = () => {
    const data = {
      ...project,
      exportedAt: new Date().toISOString(),
      historicalData,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}-report.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Project data exported!")
  }

  const handleShareProject = () => {
    const text = `${project.name}\nType: ${project.type}\nValue: ${formatCurrency(project.value)}\nROI: ${roi.toFixed(1)}%`
    navigator.clipboard.writeText(text)
    toast.success("Project details copied to clipboard!")
  }

  // Mock transactions
  const transactions = [
    { id: "1", date: "2024-01-15", type: "Investment", amount: project.invested * 0.4, status: "Completed" },
    { id: "2", date: "2024-03-20", type: "Investment", amount: project.invested * 0.3, status: "Completed" },
    { id: "3", date: "2024-06-10", type: "Investment", amount: project.invested * 0.3, status: "Completed" },
    { id: "4", date: "2024-09-01", type: "Dividend", amount: profit * 0.1, status: "Received" },
    { id: "5", date: "2024-11-15", type: "Valuation Update", amount: project.value, status: "Recorded" },
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <DialogTitle className="text-xl">{project.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{project.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[project.status]}`}>
                {project.status}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Current Value
            </div>
            <div className="text-xl font-bold number-display">{formatCurrency(project.value)}</div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="w-3 h-3" />
              Invested
            </div>
            <div className="text-xl font-bold number-display">{formatCurrency(project.invested)}</div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="w-3 h-3" />
              ROI
            </div>
            <div
              className={`text-xl font-bold number-display flex items-center gap-1 ${roi >= 0 ? "text-kev-success" : "text-red-500"}`}
            >
              {roi >= 0 && <TrendingUp className="w-4 h-4" />}
              {roi < 0 && <TrendingDown className="w-4 h-4" />}
              {roi.toFixed(1)}%
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="w-3 h-3" />
              Profit/Loss
            </div>
            <div className={`text-xl font-bold number-display ${profit >= 0 ? "text-kev-success" : "text-red-500"}`}>
              {profit >= 0 ? "+" : ""}
              {formatCurrency(profit)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/30 rounded-lg mt-4">
          {(["overview", "performance", "transactions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                activeTab === tab ? "bg-kev-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Value Over Time Chart */}
              <div className="glass-card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-kev-primary" />
                  Value Over Time
                </h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalData}>
                      <defs>
                        <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--kev-primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--kev-primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), ""]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--kev-primary))"
                        fill="url(#valueGrad)"
                        strokeWidth={2}
                        name="Value"
                      />
                      <Line
                        type="monotone"
                        dataKey="invested"
                        stroke="#6b7280"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        dot={false}
                        name="Invested"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Description & Allocation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <h3 className="font-semibold mb-3">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Last updated: {project.lastUpdate}
                    </div>
                  </div>
                </div>

                <div className="glass-card p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-kev-primary" />
                    Value Breakdown
                  </h3>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={allocationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {allocationData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="space-y-6">
              {/* Monthly Returns */}
              <div className="glass-card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-kev-primary" />
                  Monthly Returns
                </h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyReturns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: string) => [`${value}%`, "Return"]}
                      />
                      <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                        {monthlyReturns.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={Number(entry.return) >= 0 ? "hsl(var(--kev-primary))" : "#ef4444"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Best Month</div>
                  <div className="text-lg font-bold text-kev-success">
                    +{Math.max(...monthlyReturns.map((m) => Number(m.return))).toFixed(1)}%
                  </div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Worst Month</div>
                  <div className="text-lg font-bold text-red-500">
                    {Math.min(...monthlyReturns.map((m) => Number(m.return))).toFixed(1)}%
                  </div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Avg Monthly</div>
                  <div className="text-lg font-bold">
                    {(monthlyReturns.reduce((a, b) => a + Number(b.return), 0) / monthlyReturns.length).toFixed(1)}%
                  </div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Volatility</div>
                  <div className="text-lg font-bold text-amber-500">Medium</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="p-4 text-sm">{tx.date}</td>
                        <td className="p-4 text-sm">{tx.type}</td>
                        <td className="p-4 text-sm text-right font-medium number-display">
                          {tx.type === "Dividend" ? "+" : ""}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              tx.status === "Completed" || tx.status === "Received"
                                ? "bg-kev-success/15 text-kev-success"
                                : "bg-blue-500/15 text-blue-400"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShareProject}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportProject}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => toast.info("Edit feature coming soon")}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <Button size="sm" onClick={() => toast.info("Opening external dashboard...")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
