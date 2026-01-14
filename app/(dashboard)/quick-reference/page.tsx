"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Zap,
	Code2,
	Folder,
	BookOpen,
	RefreshCw,
	Copy,
	Link as LinkIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface QuickReference {
	title: string;
	content: string;
	category: "components" | "folders" | "commands" | "patterns";
	icon: React.ElementType;
}

const quickReferences: QuickReference[] = [
	{
		title: "StatCard Component",
		content: `// components/admin/dashboard/stat-card.tsx
interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  change?: string
  trend?: 'up' | 'down'
}

<StatCard 
  title="Total Revenue"
  value="$45,231.89"
  change="+20.1%"
  trend="up"
/>`,
		category: "components",
		icon: Code2,
	},
	{
		title: "Admin Sidebar Menu",
		content: `const adminSidebarMenu = [
  {
    title: 'Dashboard',
    section: 'Main',
    items: [
      { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
]`,
		category: "components",
		icon: Code2,
	},
	{
		title: "DataTable Component",
		content: `// Reusable data table with sorting/filtering
interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

<DataTable 
  columns={columns}
  data={data}
  onRowClick={handleRowClick}
  selectable
/>`,
		category: "components",
		icon: Code2,
	},
	{
		title: "Dashboard Directory",
		content: `app/(dashboard)/
  ├── dashboard/ (home)
  ├── departments/ (list & detail)
  ├── rooms/ (grid/list view)
  ├── bookings/ (reservations)
  ├── customers/ (guests)
  ├── orders/ (transactions)
  ├── inventory/ (stock)
  ├── pos-terminals/ (revenue)
  ├── games/ (entertainment)
  ├── gym-memberships/ (fitness)
  └── settings/ (admin)`,
		category: "folders",
		icon: Folder,
	},
	{
		title: "Public Website Directory",
		content: `app/(public)/
  ├── page.tsx (homepage)
  ├── rooms/ (showcase & detail)
  ├── dining/ (restaurants)
  ├── amenities/ (facilities)
  ├── gallery/ (photos)
  ├── booking/ (wizard & confirmation)
  ├── contact/ (contact form)
  └── about/ (hotel info)`,
		category: "folders",
		icon: Folder,
	},
	{
		title: "Install Dependencies",
		content: `# Install required packages
npm install next@latest react@latest
npm install shadcn-ui lucide-react next-themes
npm install @hookform/resolvers zod

# Add shadcn/ui components
npx shadcn-ui@latest add button card dialog input
npx shadcn-ui@latest add table tabs form`,
		category: "commands",
		icon: RefreshCw,
	},
];

const componentPatterns = [
	{
		name: "Page Structure",
		description: "Standard page layout with header and content grid",
		code: `export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">Title</h1>
        <p className="text-muted-foreground">Description</p>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cards */}
      </div>
    </div>
  )
}`,
	},
	{
		name: "Card Layout",
		description: "Reusable card for data display",
		code: `<Card className="group hover:shadow-lg">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>`,
	},
	{
		name: "Modal Pattern",
		description: "Standard dialog for create/edit operations",
		code: `<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Action</DialogTitle>
    </DialogHeader>
    {/* Form */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button onClick={handleSubmit}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
	},
	{
		name: "Form Pattern",
		description: "React Hook Form with validation",
		code: `const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {},
})

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField control={form.control} name="field">
        {({ field }) => <FormItem>...</FormItem>}
      </FormField>
    </form>
  </Form>
)`,
	},
];

const fileTemplates = [
	{
		path: "app/(dashboard)/departments/page.tsx",
		name: "Departments List Page",
	},
	{
		path: "components/admin/departments/department-form.tsx",
		name: "Department Form",
	},
	{
		path: "components/admin/tables/data-table.tsx",
		name: "Reusable Data Table",
	},
	{
		path: "components/admin/dashboard/stat-card.tsx",
		name: "Stat Card",
	},
	{
		path: "app/(public)/layout.tsx",
		name: "Public Layout",
	},
	{
		path: "components/shared/navbar.tsx",
		name: "Navigation Bar",
	},
];

export default function QuickReferencePage() {
	const [copied, setCopied] = useState<string | null>(null);

	const handleCopy = async (text: string, id: string) => {
		await navigator.clipboard.writeText(text);
		setCopied(id);
		setTimeout(() => setCopied(null), 2000);
	};

	const referencesByCategory = {
		components: quickReferences.filter((r) => r.category === "components"),
		folders: quickReferences.filter((r) => r.category === "folders"),
		commands: quickReferences.filter((r) => r.category === "commands"),
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">Quick Reference</h1>
				<p className="text-muted-foreground text-lg">
					Quick access to code snippets, component templates, and project structure
				</p>
			</div>

			<Tabs defaultValue="snippets" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="snippets">Code Snippets</TabsTrigger>
					<TabsTrigger value="patterns">Patterns</TabsTrigger>
					<TabsTrigger value="files">File Templates</TabsTrigger>
				</TabsList>

				{/* Code Snippets Tab */}
				<TabsContent value="snippets" className="space-y-6">
					<div className="grid gap-6">
						{Object.entries(referencesByCategory).map(
							([category, items]) => (
								<div key={category}>
									<h3 className="text-lg font-semibold mb-4 capitalize">
										{category}
									</h3>
									<div className="grid gap-4">
										{items.map((ref) => {
											const Icon = ref.icon;
											const refId = `ref-${ref.title
												.toLowerCase()
												.replace(/\s+/g, "-")}`;

											return (
												<Card key={ref.title}>
													<CardHeader className="pb-3">
														<div className="flex items-start justify-between">
															<div className="flex items-start gap-3">
																<Icon className="h-5 w-5 text-primary mt-1" />
																<div>
																	<CardTitle className="text-base">
																		{ref.title}
																	</CardTitle>
																</div>
															</div>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleCopy(
																		ref.content,
																		refId
																	)
																}
																className="h-8 w-8 p-0"
															>
																<Copy className="h-4 w-4" />
															</Button>
														</div>
													</CardHeader>
													<CardContent>
														<pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono">
															{ref.content}
														</pre>
														{copied === refId && (
															<p className="text-xs text-green-600 dark:text-green-400 mt-2">
																✓ Copied!
															</p>
														)}
													</CardContent>
												</Card>
											);
										})}
									</div>
								</div>
							)
						)}
					</div>
				</TabsContent>

				{/* Patterns Tab */}
				<TabsContent value="patterns" className="space-y-6">
					<div className="grid gap-4">
						{componentPatterns.map((pattern) => {
							const patternId = `pattern-${pattern.name
								.toLowerCase()
								.replace(/\s+/g, "-")}`;

							return (
								<Card key={pattern.name}>
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div>
												<CardTitle className="text-base">
													{pattern.name}
												</CardTitle>
												<p className="text-sm text-muted-foreground mt-1">
													{pattern.description}
												</p>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													handleCopy(pattern.code, patternId)
												}
												className="h-8 w-8 p-0"
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									</CardHeader>
									<CardContent>
										<pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono">
											{pattern.code}
										</pre>
										{copied === patternId && (
											<p className="text-xs text-green-600 dark:text-green-400 mt-2">
												✓ Copied!
											</p>
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				</TabsContent>

				{/* File Templates Tab */}
				<TabsContent value="files" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Key Files to Create</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{fileTemplates.map((file) => (
								<div
									key={file.path}
									className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
								>
									<div>
										<p className="font-semibold text-sm">{file.name}</p>
										<code className="text-xs text-muted-foreground font-mono">
											{file.path}
										</code>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0"
									>
										<LinkIcon className="h-4 w-4" />
									</Button>
								</div>
							))}
						</CardContent>
					</Card>

					{/* Getting Started */}
					<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								Getting Started
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div>
								<p className="font-semibold mb-1">
									1. Review the Project Structure
								</p>
								<p className="text-muted-foreground">
									Understand the recommended folder organization for admin,
									public, and shared components.
								</p>
							</div>
							<div>
								<p className="font-semibold mb-1">
									2. Create Base Components
								</p>
								<p className="text-muted-foreground">
									Start with StatCard, DataTable, and other reusable
									components.
								</p>
							</div>
							<div>
								<p className="font-semibold mb-1">
									3. Build Dashboard Pages
								</p>
								<p className="text-muted-foreground">
									Follow Phase 1 to build the admin dashboard foundation.
								</p>
							</div>
							<div>
								<p className="font-semibold mb-1">
									4. Expand with Modules
								</p>
								<p className="text-muted-foreground">
									Add departments, rooms, bookings, and other business modules.
								</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
