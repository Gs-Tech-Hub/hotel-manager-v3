"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  color?: "blue" | "green" | "red" | "purple" | "orange" | "yellow"
}

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    border: "border-green-200",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    border: "border-orange-200",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-600",
    border: "border-yellow-200",
  },
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  color = "blue",
}: StatsCardProps) {
  const colorClass = colorClasses[color]

  return (
    <Card className={`border ${colorClass.border} ${colorClass.bg}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-700">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass.text}`} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <div className={`text-2xl font-bold ${colorClass.text}`}>{value}</div>
          {description && (
            <div className="flex items-center space-x-1">
              {trend === "up" && (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              {trend === "down" && (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className="text-xs text-gray-600">
                {trendValue && <span className={trend === "up" ? "text-green-600" : "text-red-600"}>{trendValue}</span>}
                {!trendValue && description}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
