"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardChartProps {
  title: string
  type: "bar" | "line" | "pie"
  data: any[]
  dataKey?: string
  xAxisKey?: string
  color?: string
  colors?: string[]
  height?: number
}

export function DashboardChart({
  title,
  type,
  data,
  dataKey,
  xAxisKey,
  color = "#3b82f6",
  colors,
  height = 300,
}: DashboardChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }} className="flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">{dataKey || 'Data'} Chart</p>
            <p className="text-xl font-semibold text-gray-800">{data.length} items</p>
            {data.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                {data.slice(0, 3).map((item: any, idx: number) => (
                  <div key={idx}>
                    {item[xAxisKey || 'name']}: {item[dataKey || 'value']}
                  </div>
                ))}
                {data.length > 3 && <div>...</div>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
