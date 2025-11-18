"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	CheckCircle2,
	Circle,
	Clock,
	AlertCircle,
	FileText,
	Download,
	BookmarkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	PhaseCard,
	ImplementationTimeline,
	SectionHeading,
	DocumentationBlock,
} from "@/components/admin/documentation/documentation-blocks";

interface Phase {
	id: string;
	number: number;
	title: string;
	duration: string;
	status: "pending" | "in-progress" | "completed";
	tasks: Task[];
}

interface Task {
	id: string;
	title: string;
	files?: string[];
	description?: string;
	status: "pending" | "completed";
}

const phases: Phase[] = [
	{
		id: "phase1",
		number: 1,
		title: "Admin Dashboard Foundation",
		duration: "Weeks 1-2",
		status: "pending",
		tasks: [
			{
				id: "sidebar",
				title: "Create admin sidebar component with hotel menu",
				files: ["components/admin/sidebar/admin-sidebar.tsx"],
				status: "pending",
			},
			{
				id: "dashboard-page",
				title: "Create dashboard homepage with stat cards",
				files: ["app/(dashboard)/dashboard/page.tsx"],
				status: "pending",
			},
			{
				id: "stat-card",
				title: "Create reusable StatCard component",
				files: ["components/admin/dashboard/stat-card.tsx"],
				status: "pending",
			},
			{
				id: "data-table",
				title: "Create reusable DataTable component",
				files: ["components/admin/tables/data-table.tsx"],
				status: "pending",
			},
		],
	},
	{
		id: "phase2",
		number: 2,
		title: "Operations & Transactions",
		duration: "Weeks 3-4",
		status: "pending",
		tasks: [
			{
				id: "departments",
				title: "Build Departments module",
				files: [
					"app/(dashboard)/departments/page.tsx",
					"app/(dashboard)/departments/[id]/page.tsx",
					"components/admin/departments/department-form.tsx",
				],
				status: "pending",
			},
			{
				id: "bookings",
				title: "Build Bookings module",
				files: [
					"app/(dashboard)/bookings/page.tsx",
					"app/(dashboard)/bookings/[id]/page.tsx",
					"components/admin/bookings/booking-table.tsx",
				],
				status: "pending",
			},
			{
				id: "orders",
				title: "Build Orders module with status tracking",
				files: [
					"app/(dashboard)/orders/page.tsx",
					"app/(dashboard)/orders/[id]/page.tsx",
					"components/admin/orders/order-status.tsx",
				],
				status: "pending",
			},
		],
	},
	{
		id: "phase3",
		number: 3,
		title: "Revenue Management",
		duration: "Weeks 5-6",
		status: "pending",
		tasks: [
			{
				id: "pos",
				title: "Build POS Terminals module",
				files: ["app/(dashboard)/pos-terminals/page.tsx"],
				status: "pending",
			},
			{
				id: "games",
				title: "Build Games & Entertainment module",
				files: ["app/(dashboard)/games/page.tsx"],
				status: "pending",
			},
			{
				id: "gym",
				title: "Build Gym Memberships module",
				files: ["app/(dashboard)/gym-memberships/page.tsx"],
				status: "pending",
			},
		],
	},
	{
		id: "phase4",
		number: 4,
		title: "Landing Page",
		duration: "Weeks 8-9",
		status: "pending",
		tasks: [
			{
				id: "public-layout",
				title: "Create public layout with navbar & footer",
				files: [
					"app/(public)/layout.tsx",
					"components/shared/navbar.tsx",
					"components/shared/footer.tsx",
				],
				status: "pending",
			},
			{
				id: "homepage",
				title: "Build homepage with hero section",
				files: ["app/(public)/page.tsx"],
				status: "pending",
			},
			{
				id: "booking-flow",
				title: "Build booking flow",
				files: [
					"app/(public)/booking/page.tsx",
					"app/(public)/booking/confirmation/page.tsx",
				],
				status: "pending",
			},
		],
	},
];

export default function ImplementationGuidePage() {
	const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
	const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
		new Set()
	);

	const toggleTask = (taskId: string) => {
		const newExpanded = new Set(expandedTasks);
		if (newExpanded.has(taskId)) {
			newExpanded.delete(taskId);
		} else {
			newExpanded.add(taskId);
		}
		setExpandedTasks(newExpanded);
	};

	const completedPhases = phases.filter((p) => p.status === "completed").length;
	const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
	const completedTasks = phases.reduce(
		(sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length,
		0
	);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">
					Implementation Guide
				</h1>
				<p className="text-muted-foreground text-lg">
					Step-by-step guide to build the Hotel Manager System
				</p>
			</div>

			{/* Overall Progress */}
			<Card>
				<CardHeader>
					<CardTitle>Overall Progress</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Phases Completed</p>
							<p className="text-3xl font-bold">
								{completedPhases}/{phases.length}
							</p>
						</div>
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Tasks Completed</p>
							<p className="text-3xl font-bold">
								{completedTasks}/{totalTasks}
							</p>
						</div>
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Completion Rate</p>
							<p className="text-3xl font-bold">
								{Math.round((completedTasks / totalTasks) * 100)}%
							</p>
						</div>
					</div>
					<div className="w-full bg-muted rounded-full h-3">
						<div
							className="bg-primary h-3 rounded-full transition-all"
							style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Phase Timeline */}
			<Card>
				<CardHeader>
					<CardTitle>Implementation Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					<ImplementationTimeline
						phases={phases.map((p) => ({
							number: p.number,
							title: p.title,
							duration: p.duration,
							status: p.status,
						}))}
					/>
				</CardContent>
			</Card>

			{/* Phases Grid */}
			<Tabs defaultValue="phase1" className="w-full">
				<TabsList className="w-full grid w-full grid-cols-2 lg:grid-cols-4">
					{phases.map((phase) => (
						<TabsTrigger key={phase.id} value={phase.id}>
							Phase {phase.number}
						</TabsTrigger>
					))}
				</TabsList>

				{phases.map((phase) => (
					<TabsContent key={phase.id} value={phase.id} className="space-y-6">
						{/* Phase Header */}
						<Card>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge variant="outline">
												Phase {phase.number}
											</Badge>
											<Badge
												variant={
													phase.status === "completed"
														? "default"
														: phase.status === "in-progress"
															? "secondary"
															: "outline"
												}
											>
												{phase.status.toUpperCase()}
											</Badge>
										</div>
										<CardTitle className="text-2xl">
											{phase.title}
										</CardTitle>
										<p className="text-muted-foreground">
											Duration: {phase.duration}
										</p>
									</div>
									<Clock className="h-6 w-6 text-muted-foreground" />
								</div>
							</CardHeader>
						</Card>

						{/* Phase Tasks */}
						<div className="space-y-4">
							{phase.tasks.map((task) => (
								<Card key={task.id}>
									<CardHeader className="pb-3">
										<button
											onClick={() => toggleTask(task.id)}
											className="flex items-start justify-between w-full hover:opacity-75 transition-opacity"
										>
											<div className="flex items-start gap-3 flex-1">
												{task.status === "completed" ? (
													<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
												) : (
													<Circle className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
												)}
												<div className="text-left">
													<CardTitle className="text-base">
														{task.title}
													</CardTitle>
													{task.description && (
														<p className="text-sm text-muted-foreground mt-1">
															{task.description}
														</p>
													)}
												</div>
											</div>
										</button>
									</CardHeader>

									{/* Expanded Content */}
									{expandedTasks.has(task.id) && task.files && (
										<CardContent className="space-y-4">
											<div className="space-y-2">
												<h4 className="text-sm font-semibold">
													Files to Create/Update:
												</h4>
												<div className="space-y-2">
													{task.files.map((file) => (
														<div
															key={file}
															className="flex items-center gap-2 p-2 bg-muted rounded-md"
														>
															<FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
															<code className="text-xs flex-1 font-mono">
																{file}
															</code>
															<Button
																variant="ghost"
																size="sm"
																className="h-6 w-6 p-0"
															>
																<BookmarkIcon className="h-4 w-4" />
															</Button>
														</div>
													))}
												</div>
											</div>

											{/* Task Actions */}
											<div className="flex gap-2 pt-2">
												<Button size="sm" variant="outline">
													Start Task
												</Button>
												<Button size="sm" variant="outline">
													Mark Complete
												</Button>
											</div>
										</CardContent>
									)}
								</Card>
							))}
						</div>

						{/* Phase Summary */}
						<Card className="bg-muted/50">
							<CardHeader>
								<CardTitle className="text-base">Phase Summary</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<DocumentationBlock type="info">
									<p className="text-sm">
										Complete the tasks above in order. Each task involves
										creating or modifying specific files as indicated.
									</p>
								</DocumentationBlock>
								<Button className="w-full">
									<Download className="h-4 w-4 mr-2" />
									Download Checklist
								</Button>
							</CardContent>
						</Card>
					</TabsContent>
				))}
			</Tabs>

			{/* Implementation Tips */}
			<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
				<CardHeader>
					<div className="flex items-start gap-2">
						<AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
						<CardTitle className="text-base">Implementation Tips</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<p>
						<strong>1. Start with Phase 1:</strong> Build the foundation
						components (sidebar, dashboard, stat cards) before moving to other
						phases.
					</p>
					<p>
						<strong>2. Reuse Components:</strong> Use the reusable components
						(DataTable, StatCard, Card) across all modules.
					</p>
					<p>
						<strong>3. Follow the Structure:</strong> Organize files in the
						recommended directory structure for consistency and maintainability.
					</p>
					<p>
						<strong>4. Use shadcn/ui:</strong> All UI elements should use the
						pre-configured shadcn/ui components.
					</p>
					<p>
						<strong>5. Test Responsively:</strong> Test each page on mobile,
						tablet, and desktop to ensure proper responsive behavior.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
