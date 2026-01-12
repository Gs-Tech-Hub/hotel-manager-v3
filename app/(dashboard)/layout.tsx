"use client";
import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";
import { useAuth } from "@/components/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user } = useAuth();
	const pathname = usePathname();
	const router = useRouter();

	// Determine if user has no meaningful roles
	const hasNoOrDefaultRoles = !user?.roles || user.roles.length === 0 || 
		(user.roles.length === 1 && (user.roles[0] === 'employee' || user.roles[0] === 'default'));

	// Check if current path is restricted for users with no/default roles
	useEffect(() => {
		if (user && user.userType === 'employee' && hasNoOrDefaultRoles) {
			// Employees with no/default roles can ONLY access settings
			const allowedPaths = ['/dashboard', '/dashboard/settings'];
			const isAllowed = allowedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
			
			if (!isAllowed && pathname !== '/dashboard') {
				router.push('/dashboard/settings');
			}
		}
	}, [user, pathname, router, hasNoOrDefaultRoles]);

	return (
		<ProtectedRoute>
			<div className="relative flex h-screen overflow-hidden bg-background">
				{/* Sidebar */}
				<Sidebar />

				{/* Main Content */}
				<div className="flex-1 overflow-auto">
					<Topbar />
					<main className="p-8 max-w-[calc(100vw-18rem)] mx-auto">
						<div className="min-h-[calc(100vh-8rem)]">{children}</div>
					</main>
				</div>
			</div>
		</ProtectedRoute>
	);
}
