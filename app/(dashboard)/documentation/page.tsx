"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BookOpen,
	Search,
	FileText,
	LayoutDashboard,
	Code2,
	Layers,
	Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const documentationGuides = [
	{
		id: "structural",
		title: "Structural Implementation Guide",
		description: "Complete guide for Admin Dashboard & Landing Page Build",
		icon: Layers,
		category: "Core",
		lastUpdated: "November 18, 2025",
		sections: [
			{ title: "Overview", id: "overview" },
			{ title: "Current Template Analysis", id: "analysis" },
			{ title: "Project Structure", id: "structure" },
			{ title: "Admin Dashboard Implementation", id: "admin" },
			{ title: "POS Terminal UI System", id: "pos" },
			{ title: "Landing Page Implementation", id: "landing" },
			{ title: "Component Architecture", id: "architecture" },
			{ title: "Implementation Timeline", id: "timeline" },
			{ title: "File Creation Checklist", id: "checklist" },
		],
	},
	{
		id: "architecture",
		title: "Architecture Documentation",
		description: "System architecture and design patterns",
		icon: Code2,
		category: "Technical",
		lastUpdated: "November 18, 2025",
		sections: [
			{ title: "System Overview", id: "overview" },
			{ title: "Database Schema", id: "schema" },
			{ title: "API Design", id: "api" },
			{ title: "Component Patterns", id: "patterns" },
		],
	},
	{
		id: "implementation",
		title: "Implementation Checklist",
		description: "Step-by-step implementation tasks and progress tracking",
		icon: FileText,
		category: "Process",
		lastUpdated: "November 18, 2025",
		sections: [
			{ title: "Phase 1: Foundation", id: "phase1" },
			{ title: "Phase 2: Core Features", id: "phase2" },
			{ title: "Phase 3: Admin Dashboard", id: "phase3" },
			{ title: "Phase 4: Public Website", id: "phase4" },
		],
	},
	{
		id: "api-guide",
		title: "API Development Guide",
		description: "API endpoints, request/response formats, and integration",
		icon: Code2,
		category: "Development",
		lastUpdated: "November 18, 2025",
		sections: [
			{ title: "REST API Overview", id: "overview" },
			{ title: "Authentication", id: "auth" },
			{ title: "Endpoints", id: "endpoints" },
			{ title: "Error Handling", id: "errors" },
		],
	},
];

const quickLinks = [
	{
		title: "Dashboard Overview",
		description: "Key statistics and performance metrics",
		icon: LayoutDashboard,
		href: "#dashboard",
		color: "text-blue-600",
	},
	{
		title: "Admin Dashboard Implementation",
		description: "Build the admin interface with all modules",
		icon: Layers,
		href: "#admin",
		color: "text-purple-600",
	},
	{
		title: "POS Terminal System",
		description: "Point-of-sale interface implementation",
		icon: Code2,
		href: "#pos",
		color: "text-orange-600",
	},
	{
		title: "Landing Page Setup",
		description: "Public website implementation guide",
		icon: BookOpen,
		href: "#landing",
		color: "text-green-600",
	},
];

export default function DocumentationPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
	const [selectedSection, setSelectedSection] = useState<string | null>(null);

	const filteredGuides = documentationGuides.filter((guide) =>
		guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
		guide.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const activeGuide = documentationGuides.find((g) => g.id === selectedGuide);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
				<p className="text-muted-foreground text-lg">
					Complete implementation guides for the Hotel Manager System
				</p>
			</div>

			{/* Quick Links */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{quickLinks.map((link) => {
					const Icon = link.icon;
					return (
						<Card
							key={link.title}
							className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50"
						>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<CardTitle className="text-sm font-semibold">
										{link.title}
									</CardTitle>
									<Icon className={cn("h-5 w-5", link.color)} />
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									{link.description}
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Main Content */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Sidebar with Guides List */}
				<div className="lg:col-span-1">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Documentation</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{/* Search */}
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="search"
									placeholder="Search guides..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10 pr-4 py-2 h-9 text-sm"
								/>
							</div>

							{/* Guide List */}
							<div className="space-y-2">
								{filteredGuides.map((guide) => {
									const Icon = guide.icon;
									return (
										<button
											key={guide.id}
											onClick={() => {
												setSelectedGuide(guide.id);
												setSelectedSection(null);
											}}
											className={cn(
												"w-full text-left p-3 rounded-lg border transition-colors",
												selectedGuide === guide.id
													? "bg-primary/10 border-primary text-primary"
													: "hover:bg-muted border-transparent"
											)}
										>
											<div className="flex items-center gap-2 mb-1">
												<Icon className="h-4 w-4" />
												<span className="text-sm font-medium truncate">
													{guide.title}
												</span>
											</div>
											<p className="text-xs text-muted-foreground line-clamp-1">
												{guide.description}
											</p>
										</button>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Main Content Area */}
				<div className="lg:col-span-3">
					{activeGuide ? (
						<Tabs
							defaultValue="content"
							className="w-full"
						>
							<TabsList className="w-full grid w-full grid-cols-2">
								<TabsTrigger value="content">Content</TabsTrigger>
								<TabsTrigger value="structure">Structure</TabsTrigger>
							</TabsList>

							<TabsContent value="content" className="space-y-6">
								<Card>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-2">
												<CardTitle>{activeGuide.title}</CardTitle>
												<p className="text-sm text-muted-foreground">
													{activeGuide.description}
												</p>
											</div>
											<div className="text-xs text-muted-foreground flex items-center gap-1">
												<Clock className="h-4 w-4" />
												{activeGuide.lastUpdated}
											</div>
										</div>
									</CardHeader>
								</Card>

								{/* Sections Navigation */}
								<Card>
									<CardHeader>
										<CardTitle className="text-base">Sections</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{activeGuide.sections.map((section) => (
												<button
													key={section.id}
													onClick={() => setSelectedSection(section.id)}
													className={cn(
														"p-3 rounded-lg border text-left transition-all hover:shadow-md",
														selectedSection === section.id
															? "bg-primary/10 border-primary text-primary"
															: "hover:border-primary/30 hover:bg-muted/50"
													)}
												>
													<p className="font-medium text-sm">
														{section.title}
													</p>
												</button>
											))}
										</div>
									</CardContent>
								</Card>

								{/* Selected Section Content */}
								{selectedSection && (
									<Card>
										<CardHeader>
											<CardTitle>
												{activeGuide.sections.find(
													(s) => s.id === selectedSection
												)?.title}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<SectionContent
												guideId={activeGuide.id}
												sectionId={selectedSection}
											/>
										</CardContent>
									</Card>
								)}
							</TabsContent>

							<TabsContent value="structure" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Project Structure</CardTitle>
									</CardHeader>
									<CardContent>
										<ProjectStructureViewer guideId={activeGuide.id} />
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					) : (
						<Card className="h-96 flex items-center justify-center">
							<div className="text-center space-y-4">
								<BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
								<h3 className="font-semibold text-lg">Select a Guide</h3>
								<p className="text-muted-foreground text-sm">
									Choose a documentation guide from the list to view its contents
								</p>
							</div>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

function SectionContent({
	guideId,
	sectionId,
}: {
	guideId: string;
	sectionId: string;
}) {
	// This component displays section-specific content
	// In a real implementation, this would fetch and render the actual content

	const contentMap: Record<string, Record<string, React.ReactNode>> = {
		structural: {
			overview: (
				<div className="space-y-4">
					<p className="text-sm leading-relaxed">
						This guide adapts the comprehensive UI development framework documentation to the
						existing Hotel Manager v3 template which uses:
					</p>
					<ul className="space-y-2 text-sm">
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>Framework:</strong> Next.js 14 (App Router)</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>UI Library:</strong> shadcn/ui</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>Styling:</strong> Tailwind CSS</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>State Management:</strong> React hooks</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>Icons:</strong> Lucide React</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">✓</span>
							<span><strong>Dark Mode:</strong> next-themes</span>
						</li>
					</ul>
					<Button variant="outline" className="mt-4">
						Read Full Guide
					</Button>
				</div>
			),
			analysis: (
				<div className="space-y-4">
					<h4 className="font-semibold text-sm">Key Strengths of Current Template</h4>
					<ul className="space-y-2 text-sm">
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>Professional sidebar navigation with collapsible menu</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>Modern topbar with search, notifications, theme toggle</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>18+ pre-configured shadcn/ui components</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>Dark mode support with next-themes</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>Responsive layout with mobile-friendly design</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">✓</span>
							<span>Full TypeScript support</span>
						</li>
					</ul>
				</div>
			),
			structure: (
				<div className="space-y-4">
					<p className="text-sm font-semibold">Recommended Directory Organization:</p>
					<div className="bg-muted p-4 rounded-lg text-xs font-mono space-y-1 max-h-96 overflow-auto">
						<div>app/</div>
						<div className="ml-4">├── (dashboard)/ ← Admin Dashboard</div>
						<div className="ml-8">├── dashboard/ page.tsx</div>
						<div className="ml-8">├── departments/ [id]/</div>
						<div className="ml-8">├── rooms/ [id]/</div>
						<div className="ml-8">├── bookings/ [id]/</div>
						<div className="ml-8">├── pos-terminals/ [id]/</div>
						<div className="ml-8">├── games/ [id]/</div>
						<div className="ml-8">└── gym-memberships/ [id]/</div>
						<div className="ml-4">├── (public)/ ← Public Website</div>
						<div className="ml-8">├── page.tsx (homepage)</div>
						<div className="ml-8">├── rooms/ [id]/</div>
						<div className="ml-8">├── dining/ [id]/</div>
						<div className="ml-8">└── booking/ confirmation/</div>
					</div>
				</div>
			),
			admin: (
				<div className="space-y-4">
					<p className="text-sm">
						The admin dashboard includes comprehensive hotel operations management with the following modules:
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
							<p className="font-medium text-sm text-blue-900 dark:text-blue-300">Departments</p>
							<p className="text-xs text-blue-800 dark:text-blue-400 mt-1">Rooms, Front Desk, Housekeeping, Restaurant, Kitchen, Maintenance, Inventory, HR</p>
						</div>
						<div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
							<p className="font-medium text-sm text-purple-900 dark:text-purple-300">Operations</p>
							<p className="text-xs text-purple-800 dark:text-purple-400 mt-1">Rooms, Bookings, Customers, Orders, Inventory, Staff</p>
						</div>
						<div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
							<p className="font-medium text-sm text-orange-900 dark:text-orange-300">Revenue Management</p>
							<p className="text-xs text-orange-800 dark:text-orange-400 mt-1">POS Terminals, Games, Gym Memberships, Billing</p>
						</div>
						<div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
							<p className="font-medium text-sm text-green-900 dark:text-green-300">Administration</p>
							<p className="text-xs text-green-800 dark:text-green-400 mt-1">Users, Roles, Permissions, System Settings</p>
						</div>
					</div>
				</div>
			),
			pos: (
				<div className="space-y-4">
					<p className="text-sm font-semibold">POS Terminal Features:</p>
					<ul className="space-y-2 text-sm">
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Checkout Interface with item selection and cart management</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Payment Processing (cash, card, check) with change calculation</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Discount Application with promo codes and manager overrides</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Refund & Void Operations with approval workflow</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Receipt Generation (print or digital)</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Offline Mode with transaction queuing</span>
						</li>
						<li className="flex gap-2">
							<span className="text-orange-600">◆</span>
							<span>Real-time Inventory Management</span>
						</li>
					</ul>
				</div>
			),
			landing: (
				<div className="space-y-4">
					<p className="text-sm font-semibold">Landing Page Sections:</p>
					<ul className="space-y-2 text-sm">
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Hero Section with background image and CTA</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Features Section showcasing key amenities</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Room Showcase with grid and filtering</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Testimonials from previous guests</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Booking Widget for reservations</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Gallery with lightbox viewing</span>
						</li>
						<li className="flex gap-2">
							<span className="text-green-600">•</span>
							<span>Contact Information and footer</span>
						</li>
					</ul>
				</div>
			),
			architecture: (
				<div className="space-y-4">
					<p className="text-sm">
						Components are organized by domain with reusable UI elements:
					</p>
					<div className="space-y-2 text-sm font-mono bg-muted p-3 rounded-lg">
						<div>components/</div>
						<div className="ml-4">├── shared/ (sidebar, topbar, navbar, footer)</div>
						<div className="ml-4">├── admin/ (dashboards, forms, tables)</div>
						<div className="ml-4">├── public/ (hero, rooms, booking)</div>
						<div className="ml-4">└── ui/ (shadcn/ui components)</div>
					</div>
				</div>
			),
			timeline: (
				<div className="space-y-4">
					<div className="space-y-3">
						<div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
							<p className="font-semibold text-sm text-blue-900 dark:text-blue-300">Phase 1: Foundation (Weeks 1-2)</p>
							<p className="text-xs text-blue-800 dark:text-blue-400 mt-1">Admin sidebar, dashboard, stat cards, data tables</p>
						</div>
						<div className="p-3 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/30">
							<p className="font-semibold text-sm text-purple-900 dark:text-purple-300">Phase 2: Operations (Weeks 3-4)</p>
							<p className="text-xs text-purple-800 dark:text-purple-400 mt-1">Departments, Rooms, Bookings, Customers, Orders, Inventory</p>
						</div>
						<div className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30">
							<p className="font-semibold text-sm text-orange-900 dark:text-orange-300">Phase 3: Revenue (Weeks 5-6)</p>
							<p className="text-xs text-orange-800 dark:text-orange-400 mt-1">POS, Games & Entertainment, Gym Memberships</p>
						</div>
						<div className="p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30">
							<p className="font-semibold text-sm text-green-900 dark:text-green-300">Phase 4: Landing Page (Weeks 8-9)</p>
							<p className="text-xs text-green-800 dark:text-green-400 mt-1">Homepage, rooms page, booking flow, amenities</p>
						</div>
					</div>
				</div>
			),
			checklist: (
				<div className="space-y-4">
					<p className="text-sm">
						The documentation includes comprehensive checklists for:
					</p>
					<ul className="space-y-2 text-sm">
						<li className="flex gap-2">
							<input
								type="checkbox"
								className="mt-0.5"
								disabled
								defaultChecked={false}
							/>
							<span>Admin Dashboard Components (40+ files)</span>
						</li>
						<li className="flex gap-2">
							<input
								type="checkbox"
								className="mt-0.5"
								disabled
								defaultChecked={false}
							/>
							<span>Public Website Components (35+ files)</span>
						</li>
						<li className="flex gap-2">
							<input
								type="checkbox"
								className="mt-0.5"
								disabled
								defaultChecked={false}
							/>
							<span>Type Definitions and Services</span>
						</li>
						<li className="flex gap-2">
							<input
								type="checkbox"
								className="mt-0.5"
								disabled
								defaultChecked={false}
							/>
							<span>API Routes and Integration Points</span>
						</li>
					</ul>
					<Button variant="outline" className="mt-4">
						View Full Checklist
					</Button>
				</div>
			),
		},
	};

	return (
		contentMap[guideId]?.[sectionId] || (
			<p className="text-sm text-muted-foreground">Content loading...</p>
		)
	);
}

function ProjectStructureViewer({ guideId }: { guideId: string }) {
	const structures: Record<string, React.ReactNode> = {
		structural: (
			<div className="bg-muted p-4 rounded-lg text-xs font-mono space-y-1 max-h-96 overflow-auto">
				<div>app/</div>
				<div className="ml-4">├── (auth)/</div>
				<div className="ml-8">├── login/</div>
				<div className="ml-8">├── register/</div>
				<div className="ml-8">└── ...</div>
				<div className="ml-4">├── (dashboard)/</div>
				<div className="ml-8">├── dashboard/</div>
				<div className="ml-8">├── departments/ [id]/</div>
				<div className="ml-8">├── rooms/ [id]/</div>
				<div className="ml-8">├── bookings/ [id]/</div>
				<div className="ml-8">├── orders/ [id]/</div>
				<div className="ml-8">├── customers/ [id]/</div>
				<div className="ml-8">├── inventory/ [id]/</div>
				<div className="ml-8">├── pos-terminals/ [id]/</div>
				<div className="ml-8">├── games/ [id]/</div>
				<div className="ml-8">├── gym-memberships/ [id]/</div>
				<div className="ml-8">└── settings/</div>
				<div className="ml-4">├── (public)/</div>
				<div className="ml-8">├── page.tsx (home)</div>
				<div className="ml-8">├── rooms/ [id]/</div>
				<div className="ml-8">├── dining/ [id]/</div>
				<div className="ml-8">└── booking/ confirmation/</div>
				<div className="ml-4">└── api/</div>
			</div>
		),
	};

	return (
		structures[guideId] || (
			<p className="text-sm text-muted-foreground">Structure loading...</p>
		)
	);
}
