import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, DollarSign, Users, Briefcase } from "lucide-react"

const reportCategories = [
  {
    id: "analytics",
    title: "Analytics Dashboard",
    description: "Comprehensive overview of all business metrics",
    icon: BarChart3,
    href: "/analytics",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "sales",
    title: "Sales Report",
    description: "Detailed sales analysis, revenue trends, and product performance",
    icon: DollarSign,
    href: "/reports/sales",
    color: "bg-green-100 text-green-700",
  },
  {
    id: "tax",
    title: "Tax Report",
    description: "Tax collection analytics and compliance tracking",
    icon: DollarSign,
    href: "/reports/tax",
    color: "bg-red-100 text-red-700",
  },
  {
    id: "employees",
    title: "Employee Report",
    description: "HR analytics, payroll, and employee management",
    icon: Briefcase,
    href: "/reports/employees",
    color: "bg-purple-100 text-purple-700",
  },
  {
    id: "users",
    title: "User Report",
    description: "User management, access analytics, and system activity",
    icon: Users,
    href: "/reports/users",
    color: "bg-orange-100 text-orange-700",
  },
]

export default function ReportsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="mt-2 text-gray-600">Access comprehensive business intelligence and reporting tools</p>
      </div>

      {/* Report Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportCategories.map((category) => {
          const Icon = category.icon
          return (
            <Link key={category.id} href={category.href}>
              <Card className="transition-all hover:shadow-lg hover:scale-105">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription className="mt-2">{category.description}</CardDescription>
                    </div>
                    <div className={`rounded-lg p-2 ${category.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    View Report
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Info */}
      <Card>
        <CardHeader>
          <CardTitle>Report Features</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-gray-900">Analytics Dashboard</h4>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• Real-time sales metrics</li>
              <li>• Revenue analysis</li>
              <li>• Tax collection tracking</li>
              <li>• Employee statistics</li>
              <li>• User management overview</li>
              <li>• Discount analytics</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Detailed Reports</h4>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• Custom date range filtering</li>
              <li>• Department-level breakdown</li>
              <li>• Payment method analysis</li>
              <li>• Top products & earners</li>
              <li>• Charge tracking</li>
              <li>• Export capabilities</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
