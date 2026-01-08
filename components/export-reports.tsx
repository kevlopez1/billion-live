"use client"

import type React from "react"

import { useState } from "react"
import { useApp } from "@/context/app-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Loader2,
  BarChart3,
  DollarSign,
  Target,
  TrendingUp,
} from "lucide-react"

interface ExportReportsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportFormat = "json" | "csv" | "pdf"
type ReportType = "portfolio" | "performance" | "goals" | "transactions"

interface ExportOption {
  id: ReportType
  label: string
  description: string
  icon: React.ElementType
}

const exportOptions: ExportOption[] = [
  {
    id: "portfolio",
    label: "Portfolio Summary",
    description: "Complete overview of all investments",
    icon: DollarSign,
  },
  {
    id: "performance",
    label: "Performance Report",
    description: "Historical performance and analytics",
    icon: TrendingUp,
  },
  {
    id: "goals",
    label: "Goals Report",
    description: "Goal tracking and progress",
    icon: Target,
  },
  {
    id: "transactions",
    label: "Transaction History",
    description: "All investment transactions",
    icon: BarChart3,
  },
]

const formatOptions = [
  { id: "json" as const, label: "JSON", icon: FileJson, description: "Raw data format" },
  { id: "csv" as const, label: "CSV", icon: FileSpreadsheet, description: "Spreadsheet compatible" },
  { id: "pdf" as const, label: "PDF", icon: FileText, description: "Printable report" },
]

export function ExportReports({ open, onOpenChange }: ExportReportsProps) {
  const { metrics, projects, goals, t } = useApp()
  const [selectedReports, setSelectedReports] = useState<ReportType[]>(["portfolio"])
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json")
  const [dateRange, setDateRange] = useState<"all" | "ytd" | "month" | "quarter">("all")
  const [isExporting, setIsExporting] = useState(false)

  const toggleReport = (report: ReportType) => {
    setSelectedReports((prev) => (prev.includes(report) ? prev.filter((r) => r !== report) : [...prev, report]))
  }

  const generatePortfolioData = () => ({
    generatedAt: new Date().toISOString(),
    summary: {
      netWorth: metrics.netWorth,
      monthlyGrowth: metrics.monthlyGrowth,
      roi: metrics.roi,
      activeProjects: metrics.activeProjects,
      ytdReturn: metrics.ytdReturn,
      targetRevenue: metrics.targetRevenue,
    },
    projects: projects.map((p) => ({
      name: p.name,
      type: p.type,
      value: p.value,
      invested: p.invested,
      change: p.change,
      status: p.status,
      allocation: p.allocation,
    })),
  })

  const generatePerformanceData = () => ({
    generatedAt: new Date().toISOString(),
    metrics: {
      totalValue: projects.reduce((sum, p) => sum + p.value, 0),
      totalInvested: projects.reduce((sum, p) => sum + p.invested, 0),
      totalProfit: projects.reduce((sum, p) => sum + (p.value - p.invested), 0),
      averageROI: projects.reduce((sum, p) => sum + p.change, 0) / projects.length,
    },
    projectPerformance: projects.map((p) => ({
      name: p.name,
      roi: (((p.value - p.invested) / p.invested) * 100).toFixed(2),
      profit: p.value - p.invested,
      trend: p.trend,
    })),
  })

  const generateGoalsData = () => ({
    generatedAt: new Date().toISOString(),
    goals: goals.map((g) => ({
      name: g.name,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      progress: ((g.currentValue / g.targetValue) * 100).toFixed(1),
      deadline: g.deadline,
      category: g.category,
    })),
    billionProgress: {
      current: metrics.netWorth,
      target: 1_000_000_000,
      percentComplete: ((metrics.netWorth / 1_000_000_000) * 100).toFixed(4),
      estimatedCompletion: "2027",
    },
  })

  const generateTransactionsData = () => ({
    generatedAt: new Date().toISOString(),
    transactions: projects.flatMap((p) => [
      {
        date: "2024-01-15",
        project: p.name,
        type: "Investment",
        amount: p.invested,
        status: "Completed",
      },
    ]),
  })

  const convertToCSV = (data: Record<string, any>): string => {
    const flattenObject = (obj: Record<string, any>, prefix = ""): Record<string, any> => {
      const result: Record<string, any> = {}
      for (const key in obj) {
        const newKey = prefix ? `${prefix}_${key}` : key
        if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, flattenObject(obj[key], newKey))
        } else if (Array.isArray(obj[key])) {
          result[newKey] = JSON.stringify(obj[key])
        } else {
          result[newKey] = obj[key]
        }
      }
      return result
    }

    const flat = flattenObject(data)
    const headers = Object.keys(flat).join(",")
    const values = Object.values(flat)
      .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
      .join(",")

    return `${headers}\n${values}`
  }

  const handleExport = async () => {
    if (selectedReports.length === 0) {
      toast.error("Please select at least one report type")
      return
    }

    setIsExporting(true)

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const reportData: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      dateRange,
      format: selectedFormat,
    }

    if (selectedReports.includes("portfolio")) {
      reportData.portfolio = generatePortfolioData()
    }
    if (selectedReports.includes("performance")) {
      reportData.performance = generatePerformanceData()
    }
    if (selectedReports.includes("goals")) {
      reportData.goals = generateGoalsData()
    }
    if (selectedReports.includes("transactions")) {
      reportData.transactions = generateTransactionsData()
    }

    let content: string
    let mimeType: string
    let extension: string

    switch (selectedFormat) {
      case "csv":
        content = convertToCSV(reportData)
        mimeType = "text/csv"
        extension = "csv"
        break
      case "pdf":
        // For PDF, we'll generate a text representation
        content = `KEV STRATEGY - PORTFOLIO REPORT
================================
Generated: ${new Date().toLocaleString()}
Date Range: ${dateRange.toUpperCase()}

${JSON.stringify(reportData, null, 2)}`
        mimeType = "text/plain"
        extension = "txt" // Would be PDF with proper library
        toast.info("PDF export generates a text file. Full PDF support coming soon!")
        break
      default:
        content = JSON.stringify(reportData, null, 2)
        mimeType = "application/json"
        extension = "json"
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `kev-strategy-report-${new Date().toISOString().split("T")[0]}.${extension}`
    a.click()
    URL.revokeObjectURL(url)

    setIsExporting(false)
    toast.success("Report exported successfully!")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-kev-primary" />
            Export Reports
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Report Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Select Reports</h3>
            <div className="grid grid-cols-2 gap-3">
              {exportOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => toggleReport(option.id)}
                  className={`p-3 text-left glass-card transition-all ${
                    selectedReports.includes(option.id)
                      ? "!border-kev-primary/50 !bg-kev-primary/5"
                      : "hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <option.icon
                      className={`w-4 h-4 ${selectedReports.includes(option.id) ? "text-kev-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                    {selectedReports.includes(option.id) && (
                      <CheckCircle2 className="w-3 h-3 text-kev-success ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Export Format</h3>
            <div className="flex gap-2">
              {formatOptions.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`flex-1 p-3 glass-card transition-all ${
                    selectedFormat === format.id ? "!border-kev-primary/50 !bg-kev-primary/5" : "hover:border-border"
                  }`}
                >
                  <format.icon
                    className={`w-5 h-5 mx-auto mb-1 ${selectedFormat === format.id ? "text-kev-primary" : "text-muted-foreground"}`}
                  />
                  <div className="text-xs font-medium text-center">{format.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h3 className="text-sm font-medium mb-3">Date Range</h3>
            <div className="flex gap-2">
              {[
                { id: "all", label: "All Time" },
                { id: "ytd", label: "YTD" },
                { id: "quarter", label: "Quarter" },
                { id: "month", label: "Month" },
              ].map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id as typeof dateRange)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                    dateRange === range.id
                      ? "bg-kev-primary text-white"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedReports.length === 0}
            className="w-full bg-kev-primary hover:bg-kev-primary-light"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {selectedReports.length} Report{selectedReports.length > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
