"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTablePrice } from "@/lib/formatters"

interface Column {
  key: string
  label: string
  format?: (value: any) => string
  align?: "left" | "center" | "right"
}

interface DashboardDataTableProps {
  title: string
  columns: Column[]
  data: any[]
  maxRows?: number
  emptyMessage?: string
}

export function DashboardDataTable({
  title,
  columns,
  data,
  maxRows = 10,
  emptyMessage = "No data available",
}: DashboardDataTableProps) {
  const displayData = data.slice(0, maxRows)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{emptyMessage}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                {columns.map((col) => (
                  <TableHead key={col.key} className={`text-${col.align || "left"}`}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={`text-${col.align || "left"}`}>
                      {col.format ? col.format(row[col.key]) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data.length > maxRows && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {displayData.length} of {data.length} records
          </div>
        )}
      </CardContent>
    </Card>
  )
}
