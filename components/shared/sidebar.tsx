"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Settings,
	Users,
	BarChart3,
	ChevronLeft,
	ChevronRight,
	FileText,
	Calendar,
	Database,
	MessageSquare,
	Shield,
	HelpCircle,
	LogIn,
	AlertCircle,
	BookOpen,
	CheckSquare,
	DoorOpen,
	BookMarked,
	ShoppingCart,
	ChevronDown,
	DollarSign,
	AlertCircleIcon,
	Briefcase,
	Flashlight,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./../../components/auth-context";
import { checkPageAccess, getPageAccessRule } from "@/lib/auth/page-access";
import { shouldHideSidebarItem, getAllowedSidebarGroups } from "@/lib/auth/role-landing";

const sidebarGroups = [
	{
		title: "General",
		items: [
			{
				title: "Dashboard",
				href: "/dashboard",
				icon: LayoutDashboard,
				badge: null,
			},
		],
	},

	{
		title: "Hotel Management",
		items: [
			{
				title: "Room Management",
				href: "/rooms",
				icon: DoorOpen,
				badge: null,
				children: [
					{
						title: "Amenities",
						href: "/amenities",
						icon: DoorOpen,
					},
					{
						title: "Room Types",
						href: "/room-types",
						icon: DoorOpen,
					},
					{
						title: "Rooms",
						href: "/rooms",
						icon: DoorOpen,
					},
					{
						title: "Cleaning Schedule",
						href: "/cleaning",
						icon: Flashlight,
					},
					{
						title: "Maintenance",
						href: "/maintenance",
						icon: AlertCircleIcon,
					},
				],
			},
			{
				title: "Bookings",
				href: "/bookings",
				icon: BookMarked,
				badge: null,
			},
			{
				title: "Customers",
				href: "/customers",
				icon: Users,
				badge: null,
			},
			{
				title: "Employees",
				href: "/employees",
				icon: Users,
				badge: null,
				children: [
					{
						title: "Employee List",
						href: "/employees",
						icon: Users,
					},
					{
						title: "Salary Payments",
						href: "/employees/salary-payments",
						icon: DollarSign,
					},
					{
						title: "Charges",
						href: "/employees/charges",
						icon: AlertCircle,
					},
					{
						title: "Leave Management",
						href: "/employees/leaves",
						icon: Calendar,
					},
				],
			},
			{
				title: "Departments",
				href: "/departments",
				icon: BookOpen,
				badge: null,
			},
			{
				title: "Inventory",
				href: "/inventory",
				icon: Database,
				badge: null,
			},
		],
	},

	{
		title: "POS & Operations",
		items: [
			{
				title: "POS",
				href: "/pos",
				icon: ShoppingCart,
				badge: null,
			},
			{
				title: "POS Terminals",
				href: "/pos-terminals",
				icon: ShoppingCart,
				badge: null,
			},
			{
				title: "Discounts",
				href: "/discounts",
				icon: BarChart3,
				badge: null,
			},
		],
	},

	{
		title: "Administration",
		items: [
			{
				title: "Roles & Permissions",
				href: "/admin/roles",
				icon: Shield,
				badge: null,
			},
			{
				title: "Page Access Control",
				href: "/admin/page-access",
				icon: Shield,
				badge: null,
			},
			{
				title: "Settings",
				href: "/dashboard/settings",
				icon: Settings,
				badge: null,
			},
		],
	},
];

interface SidebarProps {
	onMobileClose?: () => void;
}

export function Sidebar({ onMobileClose }: SidebarProps) {
	const pathname = usePathname();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
		Object.fromEntries(sidebarGroups.map(g => [g.title, true]))
	);
	const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
		'/employees': false,
		'/rooms': false,
	});
	const { user } = useAuth();

	// Filter sidebar items based on user permissions and role-based visibility
	const getFilteredSidebarGroups = useMemo(() => {
		if (!user) return [];

		const allowedGroups = getAllowedSidebarGroups(user.roles);
		const canAccessPath = (path: string) => {
			const rule = getPageAccessRule(path);
			return checkPageAccess(
				rule,
				user.roles || [],
				user.permissions || [],
				user.userType || "employee"
			);
		};

		return sidebarGroups
			.filter(group => allowedGroups.includes(group.title))
			.map(group => ({
				...group,
				items: group.items
					.map((item) => {
						// Filter children too, so we don't show "dead" links.
						if ("children" in item && Array.isArray((item as any).children)) {
							const children = (item as any).children as Array<{ href: string }>;
							const filteredChildren = children.filter(
								(child) =>
									canAccessPath(child.href) &&
									!shouldHideSidebarItem(child.href, user.roles, user.departmentId)
							);
							return { ...(item as any), children: filteredChildren };
						}
						return item;
					})
					.filter((item: any) => {
						const isHidden = shouldHideSidebarItem(item.href, user.roles, user.departmentId);
						if (isHidden) return false;

						const hasAccess = canAccessPath(item.href);
						if (!hasAccess) return false;

						// If item has children, keep it only if at least one child is visible (or no children).
						if (Array.isArray(item.children)) {
							return item.children.length > 0;
						}
						return true;
					})
			}))
			.filter(group => group.items.length > 0);
	}, [user]);

	const toggleGroupExpanded = (title: string) => {
		setExpandedGroups(prev => ({
			...prev,
			[title]: !prev[title]
		}));
	};

	const toggleItemExpanded = (href: string) => {
		setExpandedItems(prev => ({
			...prev,
			[href]: !prev[href]
		}));
	};

	const handleLinkClick = () => {
		if (onMobileClose) {
			onMobileClose();
		}
	};

	return (
		<div
			className={cn(
				"flex h-full flex-col border-r bg-card shadow-sm transition-all duration-300",
				isCollapsed ? "w-16" : "w-72",
			)}
		>
			{/* Logo */}
			<div className="flex h-16 items-center border-b px-6 justify-between">
				{!isCollapsed && (
					<Link href="/dashboard" className="flex items-center gap-3 group">
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
							<LayoutDashboard className="w-4 h-4 text-primary-foreground" />
						</div>
						<span className="text-xl font-bold group-hover:text-primary transition-colors">
							Dashboard
						</span>
					</Link>
				)}
				{isCollapsed && (
					<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
						<LayoutDashboard className="w-4 h-4 text-primary-foreground" />
					</div>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 hover:bg-muted"
					onClick={() => setIsCollapsed(!isCollapsed)}
				>
					{isCollapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<ChevronLeft className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Navigation Groups */}
			<nav className="flex-1 overflow-y-auto space-y-6 p-6 pr-3 scrollbar-thin scrollbar-thumb-rounded-lg scrollbar-thumb-muted scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground">
				{getFilteredSidebarGroups.map((group) => (
					<div key={group.title} className="space-y-2">
						{/* Group Header with Toggle */}
						<div
							className="flex items-center justify-between gap-2 cursor-pointer group"
							onClick={() => !isCollapsed && toggleGroupExpanded(group.title)}
						>
							{!isCollapsed && (
								<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 flex-1">
									{group.title}
								</h3>
							)}
							{!isCollapsed && (
								<ChevronDown
									className={cn(
										"h-4 w-4 text-muted-foreground transition-transform duration-200 mx-2",
										!expandedGroups[group.title] && "-rotate-90"
									)}
								/>
							)}
						</div>

						{/* Group Items - Collapsible */}
						{(!isCollapsed || expandedGroups[group.title]) && (
							<div className={cn(
								"space-y-2 overflow-hidden transition-all duration-300",
								!expandedGroups[group.title] && !isCollapsed && "hidden"
							)}>
								{group.items.map((item) => {
									const Icon = item.icon;

									if ('children' in item && Array.isArray((item as any).children)) {
										const isParentActive = pathname === item.href || pathname.startsWith(item.href + "/");
										const isItemExpanded = expandedItems[item.href] !== false;
										return (
											<div key={item.href}>
												<div className="flex items-center gap-2">
													<Link
														href={item.href}
														onClick={handleLinkClick}
														className={cn(
															"group flex-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 hover:bg-muted",
															isParentActive
																? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
																: "text-muted-foreground hover:text-foreground",
															isCollapsed && "justify-center px-3 py-4",
														)}
														title={isCollapsed ? item.title : undefined}
													>
														{Icon && (
															<Icon
																className={cn(
																	"transition-all duration-200",
																	isCollapsed ? "h-5 w-5" : "h-4 w-4",
																	isParentActive && !isCollapsed && "text-primary-foreground",
																)}
															/>
														)}
														{!isCollapsed && <span className="group-hover:translate-x-0.5 transition-transform duration-200">{item.title}</span>}
													</Link>
													
													{/* Expand/Collapse Toggle for Children */}
													{!isCollapsed && (item as any).children && (item as any).children.length > 0 && (
														<button
															onClick={() => toggleItemExpanded(item.href)}
															className="p-1 rounded hover:bg-muted/50 transition-colors"
															title={isItemExpanded ? "Collapse" : "Expand"}
														>
															<ChevronDown
																className={cn(
																	"h-4 w-4 transition-transform duration-200",
																	!isItemExpanded && "-rotate-90"
																)}
															/>
														</button>
													)}
												</div>

												{/* Children links - Collapsible */}
												{!isCollapsed && isItemExpanded && (
													<div className="mt-2 space-y-1 pl-8 animate-in slide-in-from-top-2 fade-in duration-200">
														{(item as any).children.map((child: any) => {
															const isActiveChild = pathname === child.href;
															const ChildIcon = child.icon;
															return (
																<Link
																	key={child.href}
																	href={child.href}
																	onClick={handleLinkClick}
																	className={cn(
																		"group flex items-center gap-2 rounded px-2 py-2 text-sm transition-all duration-150 hover:bg-muted",
																		isActiveChild
																			? "bg-primary/90 text-primary-foreground"
																			: "text-muted-foreground hover:text-foreground",
																	)}
																	>
																	{ChildIcon && <ChildIcon className="h-3 w-3" />}
																	<span>{child.title}</span>
																	</Link>
																);
															})}
													</div>
												)}
											</div>
										);
									}

									// default single item
									const isActive = pathname === item.href;
									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={handleLinkClick}
											className={cn(
												"group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 hover:bg-muted",
												isActive
													? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
													: "text-muted-foreground hover:text-foreground",
												isCollapsed && "justify-center px-3 py-4",
											)}
											title={isCollapsed ? item.title : undefined}
										>
											{Icon && (
												<Icon
													className={cn(
														"transition-all duration-200",
														isCollapsed ? "h-5 w-5" : "h-4 w-4",
														isActive && !isCollapsed && "text-primary-foreground",
													)}
												/>
											)}
											{!isCollapsed && (
												<span className="group-hover:translate-x-0.5 transition-transform duration-200">
													{item.title}
												</span>
											)}
										</Link>
									);
									})}
							</div>
						)}
					</div>
				))}
			</nav>
		</div>
	);
}
