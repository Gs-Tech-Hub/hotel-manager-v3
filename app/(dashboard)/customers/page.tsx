"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";

interface Customer {
	id: string;
	name: string;
	email: string;
	phone?: string;
	address?: string;
	city?: string;
	country?: string;
	totalBookings: number;
	totalSpent: number;
	createdAt: string;
}

export default function CustomersPage() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const limit = 10;

	useEffect(() => {
		const fetchCustomers = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({
					page: page.toString(),
					limit: limit.toString(),
				});

				if (search) {
					params.append("search", search);
				}

				const response = await fetch(`/api/customers?${params}`);
				const data = await response.json();
				if (data.success) {
					setCustomers(data.data.items);
					setTotal(data.data.meta?.total || 0);
				}
			} catch (error) {
				console.error("Failed to fetch customers:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCustomers();
	}, [page, search]);

	const pages = Math.ceil(total / limit);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Customers</h1>
					<p className="text-muted-foreground">
						View and manage guest profiles
					</p>
				</div>
				<Link href="/dashboard/customers/create">
					<Button>
						<Plus className="h-4 w-4 mr-2" />
						Add Customer
					</Button>
				</Link>
			</div>

			{/* Search */}
			<Card>
				<CardContent className="pt-6">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or email..."
							className="pl-10"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Customers List */}
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : customers.length === 0 ? (
				<Card>
					<CardContent className="text-center py-12">
						<p className="text-muted-foreground">No customers found</p>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid gap-4">
						{customers.map((customer) => (
							<Link
								key={customer.id}
								href={`/dashboard/customers/${customer.id}`}
							>
								<Card className="cursor-pointer hover:bg-accent transition-colors">
									<CardContent className="pt-6">
										<div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
											{/* Name */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Name
												</p>
												<p className="font-semibold">
													{customer.name}
												</p>
											</div>

											{/* Contact */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Contact
												</p>
												<div>
													<p className="text-sm">
														{customer.email}
													</p>
													{customer.phone && (
														<p className="text-xs text-muted-foreground">
															{customer.phone}
														</p>
													)}
												</div>
											</div>

											{/* Location */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Location
												</p>
												<p className="text-sm">
													{customer.city || "N/A"}
													{customer.country &&
														`, ${customer.country}`}
												</p>
											</div>

											{/* Stats */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Bookings
												</p>
												<div className="flex items-center gap-2">
													<Badge variant="outline">
														{customer.totalBookings}
													</Badge>
													<span className="text-xs text-muted-foreground">
														booking
														{customer.totalBookings !==
															1 && "s"}
													</span>
												</div>
											</div>

											{/* Total Spent */}
											<div className="space-y-1 text-right">
												<p className="text-xs text-muted-foreground uppercase">
													Total Spent
												</p>
												<p className="text-lg font-bold">
													${(
														customer.totalSpent / 100
													).toFixed(2)}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>

					{/* Pagination */}
					{pages > 1 && (
						<div className="flex items-center justify-center gap-2">
							<Button
								variant="outline"
								onClick={() => setPage(Math.max(1, page - 1))}
								disabled={page === 1}
							>
								Previous
							</Button>
							<div className="flex items-center gap-1">
								{Array.from({ length: pages }, (_, i) => i + 1).map(
									(p) => (
										<Button
											key={p}
											variant={page === p ? "default" : "outline"}
											onClick={() => setPage(p)}
											className="w-10"
										>
											{p}
										</Button>
									)
								)}
							</div>
							<Button
								variant="outline"
								onClick={() => setPage(Math.min(pages, page + 1))}
								disabled={page === pages}
							>
								Next
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
