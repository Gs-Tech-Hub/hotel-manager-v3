"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";

interface Booking {
	id: string;
	bookingId: string;
	customer: { name?: string; email: string };
	unit: { roomNumber: string; roomType: { name: string } };
	checkin: string;
	checkout: string;
	bookingStatus: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
	totalPrice: number;
	guests: number;
}

export default function BookingsPage() {
	const [bookings, setBookings] = useState<Booking[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const limit = 10;

	useEffect(() => {
		const fetchBookings = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({
					page: page.toString(),
					limit: limit.toString(),
				});

				if (search) {
					params.append("search", search);
				}
				if (statusFilter !== "all") {
					params.append("status", statusFilter);
				}

				const response = await fetch(`/api/bookings?${params}`);
				const data = await response.json();
				if (data.success) {
					setBookings(data.data.items);
					setTotal(data.data.meta?.total || 0);
				}
			} catch (error) {
				console.error("Failed to fetch bookings:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchBookings();
	}, [page, search, statusFilter]);

	const statusColors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
		confirmed:
			"bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
		in_progress:
			"bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
		completed:
			"bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
		cancelled:
			"bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
	};

	const pages = Math.ceil(total / limit);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
					<p className="text-muted-foreground">
						Manage guest reservations and check-ins
					</p>
				</div>
				<Link href="/bookings/new">
					<Button>
						<Plus className="h-4 w-4 mr-2" />
						New Booking
					</Button>
				</Link>
			</div>

			{/* Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex gap-4">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by booking number or guest name..."
									className="pl-10"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(1);
									}}
								/>
							</div>
						</div>
						<Select
							value={statusFilter}
							onValueChange={(value) => {
								setStatusFilter(value);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="confirmed">Confirmed</SelectItem>
								<SelectItem value="checked-in">Checked In</SelectItem>
								<SelectItem value="checked-out">Checked Out</SelectItem>
								<SelectItem value="cancelled">Cancelled</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Bookings Table */}
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : bookings.length === 0 ? (
				<Card>
					<CardContent className="text-center py-12">
						<p className="text-muted-foreground">No bookings found</p>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid gap-4">
						{bookings.map((booking) => (
							<Link
								key={booking.id}
								href={`/bookings/${booking.id}`}
							>
								<Card className="cursor-pointer hover:bg-accent transition-colors">
									<CardContent className="pt-6">
										<div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
											{/* Booking Info */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Booking #
												</p>
												<p className="font-semibold">
													{booking.bookingId}
												</p>
											</div>

											{/* Guest Info */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Guest
												</p>
												<div>
													<p className="font-semibold">
														{booking.customer.name}
													</p>
													<p className="text-xs text-muted-foreground">
														{booking.customer.email}
													</p>
												</div>
											</div>

											{/* Room & Dates */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Room / Dates
												</p>
												<div>
													<p className="font-semibold">
													{booking.unit?.roomNumber || "N/A"}
												</p>
												<p className="text-xs text-muted-foreground">
													{booking.unit?.roomType?.name || "N/A"}
												</p>
												<p className="text-xs text-muted-foreground">
													{new Date(
														booking.checkin
													).toLocaleDateString()}{" "}
													-{" "}
													{new Date(
														booking.checkout
														).toLocaleDateString()}
													</p>
												</div>
											</div>

											{/* Status & Price */}
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Status
												</p>
												<Badge
													className={
														statusColors[booking.bookingStatus]
													}
												>
													{booking.bookingStatus
														.split("_")
														.map(
															(word) =>
																word
																	.charAt(0)
																	.toUpperCase() +
																word.slice(1)
														)
														.join(" ")}
												</Badge>
											</div>

											<div className="space-y-1 text-right">
												<p className="text-xs text-muted-foreground uppercase">
													Total
												</p>
												<p className="text-lg font-bold">
													${(booking.totalPrice / 100).toFixed(2)}
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
