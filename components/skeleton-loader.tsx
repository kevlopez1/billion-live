"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  variant?: "text" | "circular" | "rectangular" | "card"
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const baseClasses = "skeleton animate-pulse"

  const variantClasses = {
    text: "h-4 w-full rounded",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-lg",
    card: "rounded-xl h-32",
  }

  return <div className={cn(baseClasses, variantClasses[variant], className)} />
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-24" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-8 w-20" />
        <Skeleton variant="rectangular" className="h-8 w-20" />
      </div>
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-24 h-3" />
        <Skeleton variant="circular" className="w-8 h-8" />
      </div>
      <Skeleton variant="text" className="w-32 h-8" />
      <Skeleton variant="text" className="w-20 h-3" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-32 h-5" />
        <div className="flex gap-2">
          <Skeleton variant="rectangular" className="w-16 h-7" />
          <Skeleton variant="rectangular" className="w-16 h-7" />
        </div>
      </div>
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            className="flex-1"
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
    </div>
  )
}
