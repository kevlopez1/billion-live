"use client"

import { useState, useMemo } from "react"
import { useApp, type Goal } from "@/context/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  Target,
  Plus,
  TrendingUp,
  DollarSign,
  Briefcase,
  User,
  Flag,
  Calculator,
  ChevronRight,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  LineChart,
  Sparkles,
} from "lucide-react"
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts"

export function GoalsView() {
  const { metrics, goals, addGoal, updateGoal, deleteGoal, t, isLoading, locale } = useApp()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [simulatedGrowth, setSimulatedGrowth] = useState(metrics.monthlyGrowth)

  const [newGoal, setNewGoal] = useState({
    name: "",
    targetValue: 0,
    currentValue: 0,
    deadline: "",
    category: "financial" as Goal["category"],
  })

  // Calculate projection to $1B
  const calculateProjection = (growthRate: number) => {
    const currentWorth = metrics.netWorth
    const target = 1_000_000_000
    const monthlyRate = growthRate / 100

    if (monthlyRate <= 0) return { months: Number.POSITIVE_INFINITY, years: Number.POSITIVE_INFINITY, date: null }

    const months = Math.log(target / currentWorth) / Math.log(1 + monthlyRate)
    const years = months / 12

    const projectedDate = new Date()
    projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(months))

    return {
      months: Math.ceil(months),
      years: years.toFixed(1),
      date: projectedDate,
    }
  }

  const projection = calculateProjection(simulatedGrowth)

  // Generate projection chart data
  const projectionData = useMemo(() => {
    const data = []
    const currentWorth = metrics.netWorth
    const scenarios = [
      { name: "conservative", rate: simulatedGrowth * 0.7 },
      { name: "moderate", rate: simulatedGrowth },
      { name: "aggressive", rate: simulatedGrowth * 1.3 },
    ]

    for (let year = 0; year <= 10; year++) {
      const point: Record<string, number | string> = { year: `${2024 + year}` }
      scenarios.forEach((scenario) => {
        const monthlyRate = scenario.rate / 100
        const value = currentWorth * Math.pow(1 + monthlyRate, year * 12)
        point[scenario.name] = Math.min(value, 2_000_000_000)
      })
      point.target = 1_000_000_000
      data.push(point)
    }
    return data
  }, [metrics.netWorth, simulatedGrowth])

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const getGoalProgress = (goal: Goal) => {
    return Math.min((goal.currentValue / goal.targetValue) * 100, 100)
  }

  const getGoalStatus = (goal: Goal) => {
    const progress = getGoalProgress(goal)
    const deadline = new Date(goal.deadline)
    const now = new Date()
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (progress >= 100) return { status: "completed", color: "text-kev-success", icon: CheckCircle2 }
    if (daysLeft < 0) return { status: "behind", color: "text-red-500", icon: XCircle }
    if (daysLeft < 30 && progress < 80) return { status: "atRisk", color: "text-amber-500", icon: AlertTriangle }
    return { status: "onTrack", color: "text-kev-primary", icon: TrendingUp }
  }

  const getCategoryIcon = (category: Goal["category"]) => {
    switch (category) {
      case "financial":
        return DollarSign
      case "business":
        return Briefcase
      case "personal":
        return User
      case "milestone":
        return Flag
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return t.goals.completed
      case "behind":
        return t.goals.behind
      case "atRisk":
        return t.goals.atRisk
      case "onTrack":
        return t.goals.onTrack
      default:
        return status
    }
  }

  const handleAddGoal = async () => {
    if (!newGoal.name || !newGoal.targetValue || !newGoal.deadline) {
      toast.error(t.goals.fillRequired)
      return
    }

    await addGoal(newGoal)
    toast.success(t.goals.goalAdded)
    setAddDialogOpen(false)
    setNewGoal({ name: "", targetValue: 0, currentValue: 0, deadline: "", category: "financial" })
  }

  const handleDeleteGoal = async (id: string) => {
    await deleteGoal(id)
    toast.success(t.goals.goalDeleted)
  }

  const scenarioResults = [
    { name: t.goals.conservative, rate: simulatedGrowth * 0.7, ...calculateProjection(simulatedGrowth * 0.7) },
    { name: t.goals.moderate, rate: simulatedGrowth, ...calculateProjection(simulatedGrowth) },
    { name: t.goals.aggressive, rate: simulatedGrowth * 1.3, ...calculateProjection(simulatedGrowth * 1.3) },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.goals.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.goals.subtitle}</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-kev-primary hover:bg-kev-primary-light">
              <Plus className="w-4 h-4" />
              {t.goals.addGoal}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-kev-primary" />
                {t.goals.addGoal}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>{t.goals.goalName}</Label>
                <Input
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder={t.goals.goalNamePlaceholder}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.goals.targetValue}</Label>
                  <Input
                    type="number"
                    value={newGoal.targetValue || ""}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: Number(e.target.value) })}
                    placeholder="1000000"
                  />
                </div>
                <div>
                  <Label>{t.goals.currentValue}</Label>
                  <Input
                    type="number"
                    value={newGoal.currentValue || ""}
                    onChange={(e) => setNewGoal({ ...newGoal, currentValue: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.goals.deadline}</Label>
                  <Input
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t.goals.category}</Label>
                  <Select
                    value={newGoal.category}
                    onValueChange={(v) => setNewGoal({ ...newGoal, category: v as Goal["category"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="financial">{t.goals.financial}</SelectItem>
                      <SelectItem value="business">{t.goals.business}</SelectItem>
                      <SelectItem value="personal">{t.goals.personal}</SelectItem>
                      <SelectItem value="milestone">{t.goals.milestone}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleAddGoal}
                className="w-full bg-kev-primary hover:bg-kev-primary-light"
                disabled={isLoading}
              >
                {isLoading ? t.common.loading : t.goals.addGoal}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Billion Calculator Hero */}
      <div className="glass-card p-6 border-kev-primary/30 bg-gradient-to-br from-kev-primary/5 to-transparent">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-kev-primary/20 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-kev-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t.goals.billionCalculator}</h2>
            <p className="text-sm text-muted-foreground">{t.goals.atCurrentRate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="glass-card p-4 !bg-background/50">
            <div className="text-xs text-muted-foreground mb-1">{t.goals.currentNetWorth}</div>
            <div className="text-2xl font-bold text-kev-primary number-display">{formatCurrency(metrics.netWorth)}</div>
          </div>
          <div className="glass-card p-4 !bg-background/50">
            <div className="text-xs text-muted-foreground mb-1">{t.goals.targetAmount}</div>
            <div className="text-2xl font-bold text-foreground number-display">$1B</div>
          </div>
          <div className="glass-card p-4 !bg-background/50">
            <div className="text-xs text-muted-foreground mb-1">{t.goals.yearsToGoal}</div>
            <div className="text-2xl font-bold text-kev-success number-display flex items-center gap-2">
              {projection.years}
              <span className="text-sm font-normal text-muted-foreground">{t.goals.years}</span>
            </div>
          </div>
          <div className="glass-card p-4 !bg-background/50">
            <div className="text-xs text-muted-foreground mb-1">{t.goals.projectedDate}</div>
            <div className="text-2xl font-bold text-foreground">
              {projection.date?.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                year: "numeric",
                month: "short",
              }) || "N/A"}
            </div>
          </div>
        </div>

        {/* Growth Rate Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm">{t.goals.adjustGrowth}</Label>
            <span className="text-lg font-bold text-kev-primary">{simulatedGrowth.toFixed(1)}%</span>
          </div>
          <Slider
            value={[simulatedGrowth]}
            onValueChange={(v) => setSimulatedGrowth(v[0])}
            min={1}
            max={30}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1%</span>
            <span>15%</span>
            <span>30%</span>
          </div>
        </div>

        {/* Scenario Cards */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{t.goals.scenarioAnalysis}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarioResults.map((scenario, i) => (
              <div
                key={scenario.name}
                className={`glass-card p-4 ${i === 1 ? "!border-kev-primary/50 !bg-kev-primary/5" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles
                    className={`w-4 h-4 ${i === 0 ? "text-blue-400" : i === 1 ? "text-kev-primary" : "text-amber-400"}`}
                  />
                  <span className="text-sm font-medium">{scenario.name}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {t.goals.growthRate}: {scenario.rate.toFixed(1)}%/mo
                </div>
                <div className="text-lg font-bold">
                  {scenario.years} {t.goals.years}
                </div>
                <div className="text-xs text-muted-foreground">{scenario.date?.getFullYear() || "N/A"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChart className="w-5 h-5 text-kev-primary" />
          <h3 className="font-semibold">{t.goals.projectionChart}</h3>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData}>
              <defs>
                <linearGradient id="conservativeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="moderateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--kev-primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--kev-primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aggressiveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => `$${(v / 1_000_000_000).toFixed(1)}B`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatCurrency(value), ""]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="conservative"
                stroke="#3b82f6"
                fill="url(#conservativeGrad)"
                strokeWidth={2}
                name={t.goals.conservative}
              />
              <Area
                type="monotone"
                dataKey="moderate"
                stroke="hsl(var(--kev-primary))"
                fill="url(#moderateGrad)"
                strokeWidth={2}
                name={t.goals.moderate}
              />
              <Area
                type="monotone"
                dataKey="aggressive"
                stroke="#f59e0b"
                fill="url(#aggressiveGrad)"
                strokeWidth={2}
                name={t.goals.aggressive}
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name={t.goals.billionTarget}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goals List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-kev-primary" />
          <h3 className="font-semibold">{t.goals.yourGoals}</h3>
          <span className="text-xs text-muted-foreground">({goals.length})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const progress = getGoalProgress(goal)
            const status = getGoalStatus(goal)
            const CategoryIcon = getCategoryIcon(goal.category)
            const StatusIcon = status.icon
            const deadline = new Date(goal.deadline)
            const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

            return (
              <div key={goal.id} className="glass-card p-4 hover:border-kev-primary/30 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-kev-primary/10 flex items-center justify-center">
                      <CategoryIcon className="w-5 h-5 text-kev-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{goal.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusIcon className={`w-3 h-3 ${status.color}`} />
                        <span className={status.color}>{getStatusText(status.status)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t.goals.progress}</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">{t.goals.currentValue}</div>
                      <div className="font-medium number-display">
                        {goal.targetValue >= 1000000 ? formatCurrency(goal.currentValue) : goal.currentValue}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <div className="text-right">
                      <div className="text-muted-foreground text-xs">{t.goals.targetValue}</div>
                      <div className="font-medium number-display">
                        {goal.targetValue >= 1000000 ? formatCurrency(goal.targetValue) : goal.targetValue}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <Clock className="w-3 h-3" />
                    {daysLeft > 0 ? (
                      <span>
                        {daysLeft} {t.goals.daysLeft}
                      </span>
                    ) : (
                      <span className="text-red-500">{t.goals.deadlinePassed}</span>
                    )}
                    <span className="ml-auto">{deadline.toLocaleDateString(locale === "es" ? "es-ES" : "en-US")}</span>
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
