"use client"

import { useState } from "react"

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function RevenueChart() {
  const [data] = useState([3.2, 4.1, 3.8, 5.2, 4.8, 6.1, 5.8, 7.2, 6.8, 7.8, 7.5, 8.2])

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold">Revenue Overview</h2>
          <p className="text-sm text-muted-foreground">Monthly revenue performance</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-kev-primary to-kev-primary-light glow-green-subtle" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <select className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm backdrop-blur-sm">
            <option>2024</option>
            <option>2023</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-64">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted-foreground">
          <span>$10M</span>
          <span>$7.5M</span>
          <span>$5M</span>
          <span>$2.5M</span>
          <span>$0</span>
        </div>

        {/* Grid lines */}
        <div className="absolute left-14 right-0 top-0 bottom-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-border/30" style={{ top: `${i * 25}%` }} />
          ))}
        </div>

        <div className="absolute left-14 right-0 top-0 bottom-8 flex items-end justify-between gap-2">
          {data.map((value, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group">
              <div
                className="w-full max-w-8 bg-gradient-to-t from-kev-primary to-kev-primary-light rounded-t transition-all duration-500 cursor-pointer relative"
                style={{
                  height: `${(value / 10) * 100}%`,
                  boxShadow: "0 0 20px oklch(0.45 0.1 160 / 0.3)",
                }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  ${value}M
                </div>
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-kev-primary-light to-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t" />
              </div>
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="absolute left-14 right-0 bottom-0 flex justify-between">
          {months.map((month) => (
            <span key={month} className="text-xs text-muted-foreground text-center flex-1">
              {month}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
