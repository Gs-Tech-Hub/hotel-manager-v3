"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CreditCard, DollarSign, Users, Calendar, TrendingUp } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMemo, useEffect, useState } from "react";
import { formatTablePrice } from "@/lib/formatters";

// Define dashboard sections and their access requirements
interface DashboardSection {
	id: string;
	title: string;
	description: string;
	requiredRoles?: string[];
	requiredPermissions?: string[];
	requiredAnyPermissions?: string[];
	adminBypass?: boolean;
}

const dashboardSections: DashboardSection[] = [
	{
		id: "revenue",
		title: "Revenue Analytics",
		description: "Total revenue last 24 hours",
		requiredRoles: ["manager", "admin"],
		requiredPermissions: ["reports.read"],
		adminBypass: true,
	},
	{
		id: "sales",
		title: "Sales Tracking",
		description: "Total orders in last 24 hours",
		requiredRoles: ["manager", "pos_manager", "admin"],
		requiredPermissions: ["orders.read"],
		adminBypass: true,
	},
	{
		id: "reservations",
		title: "Reservations",
		description: "Total bookings and reservations",
		requiredRoles: ["manager", "admin"],
		requiredPermissions: ["bookings.read"],
		adminBypass: true,
	},
	{
		id: "employees",
		title: "Employee Management",
		description: "Active employees in system",
		requiredRoles: ["manager", "admin"],
		requiredPermissions: ["employees.read"],
		adminBypass: true,
	},
];

// Stat cards that correspond to sections
const statsBySection = {
	revenue: {
		title: "Total Revenue",
		value: "$0",
		icon: DollarSign,
		description: "Last 24 hours",
		trend: "up" as const,
		color: "text-emerald-600",
		bgColor: "bg-emerald-50",
	},
	sales: {
		title: "Total Orders",
		value: "0",
		icon: CreditCard,
		description: "Last 24 hours",
		trend: "up" as const,
		color: "text-purple-600",
		bgColor: "bg-purple-50",
	},
	reservations: {
		title: "Total Reservations",
		value: "0",
		icon: Calendar,
		description: "Bookings and reservations",
		trend: "up" as const,
		color: "text-blue-600",
		bgColor: "bg-blue-50",
	},
	employees: {
		title: "Active Employees",
		value: "0",
		icon: Users,
		description: "Currently in system",
		trend: "up" as const,
		color: "text-orange-600",
		bgColor: "bg-orange-50",
	},
};

/**
 * Check if user can access a dashboard section based on roles/permissions
 */
function canAccessSection(section: DashboardSection, user: ReturnType<typeof useAuth>["user"]): boolean {
	if (!user) return false;

	// Admin bypass
	if (section.adminBypass && user.userType === 'admin') {
		return true;
	}

	// Check required roles
	if (section.requiredRoles && section.requiredRoles.length > 0) {
		const hasRole = user.roles?.some(r => section.requiredRoles!.includes(r));
		if (!hasRole) return false;
	}

	// Check required permissions
	if (section.requiredPermissions && section.requiredPermissions.length > 0) {
		const hasAllPermissions = section.requiredPermissions.every(perm =>
			user.permissions?.includes(perm)
		);
		if (!hasAllPermissions) return false;
	}

	// Check required any permissions
	if (section.requiredAnyPermissions && section.requiredAnyPermissions.length > 0) {
		const hasAnyPermission = user.permissions?.some(perm =>
			section.requiredAnyPermissions!.includes(perm)
		);
		if (!hasAnyPermission) return false;
	}

	return true;
}


export default function DashboardPage() {
	const { user } = useAuth();
	const [metrics, setMetrics] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [stats, setStats] = useState(statsBySection);

	// Fetch analytics data on mount
	useEffect(() => {
		const fetchAnalytics = async () => {
			try {
				setLoading(true);
				// Fetch 24-hour data for dashboard
				const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
				const today = new Date().toISOString().split('T')[0];
				const params = new URLSearchParams({
					startDate: oneDayAgo,
					endDate: today,
				});
				const response = await fetch(`/api/analytics/dashboard?${params}`);
				if (response.ok) {
					const data = await response.json();
					const metricsData = data.data;
					setMetrics(metricsData);

					// Update stats with real data
					setStats(prev => ({
						...prev,
						revenue: {
							...prev.revenue,
							value: formatTablePrice(metricsData?.salesData?.totalRevenue || 0),
						},
						sales: {
							...prev.sales,
							value: String(metricsData?.salesData?.totalOrders || 0),
						},
						reservations: {
							...prev.reservations,
							value: String(metricsData?.bookingData?.totalReservations || 0),
						},
						employees: {
							...prev.employees,
							value: String(metricsData?.employeeData?.activeEmployees || 0),
						},
					}));
				}
			} catch (error) {
				console.error('Failed to fetch analytics:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchAnalytics();
	}, []);

	// Get accessible sections for this user
	const accessibleSections = useMemo(() => {
		if (!user) return [];
		return dashboardSections.filter(section => canAccessSection(section, user));
	}, [user]);

	// Get accessible stats based on sections
	const accessibleStats = useMemo(() => {
		return accessibleSections
			.map(section => stats[section.id as keyof typeof stats])
			.filter(Boolean);
	}, [accessibleSections, stats]);

	// Check if user has no meaningful roles
	const hasNoOrDefaultRoles = !user?.roles || user.roles.length === 0 || 
		(user.roles.length === 1 && (user.roles[0] === 'employee' || user.roles[0] === 'default'));

	// For employees with no/default roles, show restricted view
	if (user && user.userType === 'employee' && hasNoOrDefaultRoles) {
		return (
			<div className="space-y-8">
				<div className="flex flex-col gap-2">
					<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
					<p className="text-muted-foreground text-lg">
						Welcome back, {user.firstName || 'User'}! 
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-xl font-semibold">
							Limited Access
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Your account doesn&apos;t have any assigned roles yet. Please contact your administrator to assign roles and unlock dashboard features.
						</p>
						<p className="text-sm text-muted-foreground mt-4">
							In the meantime, you can manage your profile and settings.
						</p>
						<div className="mt-6">
							<Link href="/dashboard/settings">
								<Button>Go to Settings</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header Section */}
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground text-lg">
					Welcome back! Here&apos;s an overview of your data.
				</p>
			</div>

			{/* NOTE: Documentation moved to a dedicated Docs page */}

		{/* Stats Grid - Only show accessible stats */}
		{accessibleStats.length > 0 && (
			<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
				{accessibleStats.map((stat) => {
					const Icon = stat.icon;

					return (
						<Card
							key={stat.title}
							className="group hover:shadow-lg transition-all duration-200"
						>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									{stat.title}
								</CardTitle>
								<div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
									<Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
							</CardHeader>
							<CardContent className="pt-0">
								<div className="text-3xl font-bold mb-2">{stat.value}</div>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{stat.description}
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>
		)}

		{/* Additional Content Sections - Only show if user has access */}
		{accessibleSections.length > 0 && (
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Recent Activity Card - Admin only */}
				{canAccessSection(dashboardSections.find(s => s.id === 'activity')!, user) && (
					<Card>
						<CardHeader>
							<CardTitle className="text-xl font-semibold">
								Recent Activity
							</CardTitle>
							<p className="text-muted-foreground">
								Latest updates from your dashboard
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-4 p-4 rounded-lg border">
								<div className="w-2 h-2 rounded-full bg-green-500" />
								<div className="flex-1">
									<p className="font-medium">New user registered</p>
									<p className="text-sm text-muted-foreground">2 minutes ago</p>
								</div>
							</div>
							<div className="flex items-center gap-4 p-4 rounded-lg border">
								<div className="w-2 h-2 rounded-full bg-blue-500" />
								<div className="flex-1">
									<p className="font-medium">Payment processed</p>
									<p className="text-sm text-muted-foreground">5 minutes ago</p>
								</div>
							</div>
							<div className="flex items-center gap-4 p-4 rounded-lg border">
								<div className="w-2 h-2 rounded-full bg-orange-500" />
								<div className="flex-1">
									<p className="font-medium">System update completed</p>
									<p className="text-sm text-muted-foreground">1 hour ago</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Quick Actions Card - Managers and above */}
				{canAccessSection(dashboardSections.find(s => s.id === 'employees')!, user) && (
					<Card>
						<CardHeader>
							<CardTitle className="text-xl font-semibold">
								Quick Actions
							</CardTitle>
							<p className="text-muted-foreground">Commonly used features</p>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-3 gap-4">
								<Link href="/reports/sales">
									<button
										type="button"
										className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border hover:bg-muted transition-colors"
									>
										<TrendingUp className="h-6 w-6" />
										<span className="text-sm font-medium">Sales Report</span>
									</button>
								</Link>
								<Link href="/reports/tax">
									<button
										type="button"
										className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border hover:bg-muted transition-colors"
									>
										<DollarSign className="h-6 w-6" />
										<span className="text-sm font-medium">Tax Report</span>
									</button>
								</Link>
								<Link href="/dashboard/employees">
									<button
										type="button"
										className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border hover:bg-muted transition-colors"
									>
										<Users className="h-6 w-6" />
										<span className="text-sm font-medium">New Employee</span>
									</button>
								</Link>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		)}

		{/* No access message */}
		{accessibleSections.length === 0 && !hasNoOrDefaultRoles && (
			<Card>
				<CardHeader>
					<CardTitle className="text-xl font-semibold">
						No Dashboard Access
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground">
						Your account doesn&apos;t have permission to view dashboard metrics. Please contact your administrator for access.
					</p>
				</CardContent>
			</Card>
		)}
		</div>
	);
}
