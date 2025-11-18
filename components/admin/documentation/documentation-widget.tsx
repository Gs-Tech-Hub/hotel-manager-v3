"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
	BookOpen,
	CheckSquare,
	Code2,
	ArrowRight,
	Lightbulb,
	FileText,
	Clock,
	Users,
	Layers,
} from "lucide-react";

export function DocumentationWidget() {
	const resources = [
		{
			title: "Structural Implementation Guide",
			description: "Complete guide for Admin Dashboard & Landing Page build",
			icon: Layers,
			href: "/dashboard/documentation",
			color: "text-purple-600",
			status: "updated",
		},
		{
			title: "Implementation Guide",
			description: "Step-by-step phases with task tracking",
			icon: CheckSquare,
			href: "/dashboard/implementation-guide",
			color: "text-blue-600",
			status: "ready",
		},
		{
			title: "Quick Reference",
			description: "Code snippets, patterns, and file templates",
			icon: Code2,
			href: "/dashboard/quick-reference",
			color: "text-orange-600",
			status: "ready",
		},
	];

	const keyFeatures = [
		{
			title: "Admin Dashboard",
			description: "Complete hotel operations management interface",
			tasks: 40,
			icon: Users,
		},
		{
			title: "POS Terminal System",
			description: "Point-of-sale interface with payment processing",
			tasks: 12,
			icon: Code2,
		},
		{
			title: "Landing Page",
			description: "Guest-facing website with booking flow",
			tasks: 25,
			icon: FileText,
		},
		{
			title: "Revenue Management",
			description: "POS, Games, Gym Memberships integration",
			tasks: 15,
			icon: Lightbulb,
		},
	];

	return (
		<div className="space-y-6">
			{/* Main Resources */}
			<div className="grid gap-4 md:grid-cols-3">
				{resources.map((resource) => {
					const Icon = resource.icon;
					return (
						<Link key={resource.title} href={resource.href}>
							<Card className="h-full hover:shadow-lg transition-all cursor-pointer group hover:border-primary/50">
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<div className="space-y-1 flex-1">
											<CardTitle className="text-base group-hover:text-primary transition-colors">
												{resource.title}
											</CardTitle>
											<p className="text-xs text-muted-foreground line-clamp-2">
												{resource.description}
											</p>
										</div>
										<Icon
											className={`h-5 w-5 flex-shrink-0 ${resource.color}`}
										/>
									</div>
								</CardHeader>
								<CardContent>
									<Badge
										variant={
											resource.status === "updated"
												? "default"
												: "secondary"
										}
										className="text-xs"
									>
										{resource.status === "updated"
											? "Recently Updated"
											: "Ready to Use"}
									</Badge>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>

			{/* Key Implementation Sections */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Key Implementation Areas</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						{keyFeatures.map((feature) => {
							const Icon = feature.icon;
							return (
								<div
									key={feature.title}
									className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div className="flex items-start gap-3">
										<Icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
										<div className="flex-1">
											<h4 className="font-semibold text-sm">
												{feature.title}
											</h4>
											<p className="text-xs text-muted-foreground mt-1">
												{feature.description}
											</p>
											<p className="text-xs text-primary font-semibold mt-2">
												{feature.tasks} implementation tasks
											</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Quick Tips */}
			<Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						Implementation Tips
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>
						<strong>1. Start with Phase 1:</strong> Build the admin sidebar and
						dashboard foundation before other modules.
					</p>
					<p>
						<strong>2. Use Reusable Components:</strong> StatCard, DataTable, and
						Card components should be shared across all modules.
					</p>
					<p>
						<strong>3. Follow the Structure:</strong> Organize files in
						admin/, public/, and shared/ directories as documented.
					</p>
				</CardContent>
			</Card>

			{/* Getting Started CTA */}
			<div className="grid gap-4 md:grid-cols-2">
				<Link href="/dashboard/implementation-guide">
					<Card className="h-full hover:shadow-lg transition-all cursor-pointer group">
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
								<Clock className="h-5 w-5" />
								Start Implementation
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Follow the structured phase-by-phase guide to build the entire
								system.
							</p>
							<div className="flex items-center text-sm font-semibold text-primary">
								View Guide
								<ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
							</div>
						</CardContent>
					</Card>
				</Link>

				<Link href="/dashboard/quick-reference">
					<Card className="h-full hover:shadow-lg transition-all cursor-pointer group">
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
								<Code2 className="h-5 w-5" />
								Code Snippets
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Copy-paste ready code patterns and component templates.
							</p>
							<div className="flex items-center text-sm font-semibold text-primary">
								Browse Snippets
								<ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
							</div>
						</CardContent>
					</Card>
				</Link>
			</div>
		</div>
	);
}
