"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { formatTablePrice } from "@/lib/formatters";
import { getGuestStatus, getGuestStatusColor, getGuestStatusLabel } from "@/src/lib/booking-status";

interface Booking {
	id: string;
	bookingId: string;
	customer?: { firstName?: string; lastName?: string; email: string };
	unit?: { roomNumber: string; roomType: { name: string } };
	checkin: string;
	checkout: string;
	timeIn?: string | null;
	timeOut?: string | null;
	nights: number;
	bookingStatus: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
	totalPrice: number;
	extraNightsDays?: number | null;
	demurrageCharge?: number;
	totalAdditionalCharges?: number;
	totalChargesWithExtra?: number;
	guests: number;
}

interface BookingStats {
	totalPaid: number;
	totalUnpaid: number;
	totalCheckedIn: number;
	totalCheckedOut: number;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
	const today = new Date();
	return today.toISOString().split('T')[0];
}

// Get 30-day window starting from today in YYYY-MM-DD format
function getMonthRange(): { startDate: string; endDate: string } {
	const today = new Date();
	const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
	
	return {
		startDate: today.toISOString().split('T')[0],
		endDate: thirtyDaysFromNow.toISOString().split('T')[0],
	};
}

// Format status filter for display
function formatStatusFilterDisplay(filter: string): string {
	if (filter === 'all') return 'All Status';
	if (filter === 'pending_payment') return 'Pending Payments';
	if (filter === 'pending_checkin') return 'Pending Check-in';
	if (filter === 'checkin_pending_checkout') return 'Checked In - Pending Check-out';
	if (filter === 'pending_payment,pending_checkin') return 'Pending (Payments & Check-in)';
	if (filter === 'pending') return 'Pending Booking';
	if (filter === 'confirmed') return 'Confirmed';
	if (filter === 'completed') return 'Checked Out';
	if (filter === 'cancelled') return 'Cancelled';
	return filter;
}

export default function BookingsPage() {
	const monthRange = getMonthRange();
	const [bookings, setBookings] = useState<Booking[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("pending_payment,pending_checkin");
	const [startDate, setStartDate] = useState<string>(monthRange.startDate);
	const [endDate, setEndDate] = useState<string>(monthRange.endDate);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const limit = 10;
	const [showStatsModal, setShowStatsModal] = useState(false);
	const [bookingStats, setBookingStats] = useState<BookingStats>({
		totalPaid: 0,
		totalUnpaid: 0,
		totalCheckedIn: 0,
		totalCheckedOut: 0,
	});
	const [statsLoading, setStatsLoading] = useState(false);

	// Fetch booking statistics
	useEffect(() => {
		const fetchBookingStats = async () => {
			setStatsLoading(true);
			try {
				const response = await fetch(
					`/api/bookings/stats?startDate=${startDate}&endDate=${endDate}`
				);
				const data = await response.json();
				if (data.success && data.data) {
					setBookingStats({
						totalPaid: data.data.totalPaid,
						totalUnpaid: data.data.totalUnpaid,
						totalCheckedIn: data.data.totalCheckedIn,
						totalCheckedOut: data.data.totalCheckedOut,
					});
				}
			} catch (error) {
				console.error("Failed to fetch booking stats:", error);
			} finally {
				setStatsLoading(false);
			}
		};

		fetchBookingStats();
	}, [startDate, endDate]);

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
				if (startDate) {
					params.append("startDate", startDate);
				}
				if (endDate) {
					params.append("endDate", endDate);
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
	}, [page, search, statusFilter, startDate, endDate]);

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
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="min-w-0">
					<h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
					<p className="text-muted-foreground text-sm sm:text-base">
						Manage guest reservations and check-ins
					</p>
				</div>
				<div className="flex gap-2 flex-shrink-0">
					<Button
						variant="outline"
						onClick={() => setShowStatsModal(true)}
						className="text-sm"
					>
						📊 View Stats
					</Button>
					<Link href="/bookings/new">
						<Button className="text-sm">
							<Plus className="h-4 w-4 mr-2" />
							New Booking
						</Button>
					</Link>
				</div>
			</div>

			{/* Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="space-y-4">
						{/* Search and Status Filter */}
						<div className="flex flex-col sm:flex-row gap-4">
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search by booking number or guest name..."
										className="pl-10 text-sm"
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
								<SelectTrigger className="w-full sm:w-[240px] text-sm">
									<span>{formatStatusFilterDisplay(statusFilter)}</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="pending_payment,pending_checkin">Pending (Payments & Check-in)</SelectItem>
									<SelectItem value="pending_payment">Pending Payments</SelectItem>
									<SelectItem value="pending_checkin">Pending Check-in</SelectItem>
									<SelectItem value="checkin_pending_checkout">Checked In - Pending Check-out</SelectItem>
									<SelectItem value="pending">Pending Booking</SelectItem>
									<SelectItem value="confirmed">Confirmed</SelectItem>
									<SelectItem value="completed">Checked Out</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Date Filter */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="start-date" className="text-xs sm:text-sm mb-2 block">Start Date</Label>
								<Input
									id="start-date"
									type="date"
									className="text-sm"
									value={startDate}
									onChange={(e) => {
										setStartDate(e.target.value);
										setPage(1);
									}}
								/>
							</div>
							<div>
								<Label htmlFor="end-date" className="text-xs sm:text-sm mb-2 block">End Date</Label>
								<Input
									id="end-date"
									type="date"
									className="text-sm"
									value={endDate}
									onChange={(e) => {
										setEndDate(e.target.value);
										setPage(1);
									}}
								/>
							</div>
						</div>
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
									<CardContent className="p-4 sm:p-6">
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
											{/* Booking Info */}
											<div className="space-y-1 min-w-0">
												<p className="text-xs font-medium text-muted-foreground uppercase">
													Booking #
												</p>
												<p className="font-semibold truncate">
													{booking.bookingId}
												</p>
											</div>

											{/* Guest Info */}
											<div className="space-y-1 min-w-0">
												<p className="text-xs font-medium text-muted-foreground uppercase">
													Guest
												</p>
												<div className="min-w-0">
													<p className="font-semibold truncate text-sm">
														{booking.customer?.firstName || "Unknown Guest"}
													</p>
													<p className="text-xs text-muted-foreground truncate">
														{booking.customer?.email || "N/A"}
													</p>
												</div>
											</div>

											{/* Room & Dates */}
											<div className="space-y-1 min-w-0">
												<p className="text-xs font-medium text-muted-foreground uppercase">
													Room / Dates
												</p>
												<div className="min-w-0">
													<p className="font-semibold text-sm">
														{booking.unit?.roomNumber || "N/A"}
													</p>
													<p className="text-xs text-muted-foreground truncate">
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

											{/* Status */}
											<div className="space-y-1">
												<p className="text-xs font-medium text-muted-foreground uppercase">
													Status
												</p>
												<div className="flex flex-col gap-1">
													<div>
														<p className="text-xs text-muted-foreground mb-1">Payment</p>
														<Badge
															className={`${statusColors[booking.bookingStatus]} text-xs`}
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
													<div>
														<p className="text-xs text-muted-foreground mb-1">Guest</p>
														<Badge
														className={`${getGuestStatusColor(getGuestStatus(booking.timeIn, booking.timeOut))} text-xs`}
													>
														{getGuestStatusLabel(getGuestStatus(booking.timeIn, booking.timeOut))}
														</Badge>
													</div>
												</div>
											</div>

											{/* Price */}
											<div className="space-y-1 sm:text-right">
												<p className="text-xs font-medium text-muted-foreground uppercase">
													{booking.totalAdditionalCharges && booking.totalAdditionalCharges > 0 ? "Total Due (w/ Extra)" : "Total"}
												</p>
												<p className="text-lg font-bold">
													{formatTablePrice(
														booking.totalChargesWithExtra && booking.totalChargesWithExtra > 0
															? booking.totalChargesWithExtra
															: booking.totalPrice
													)}
												</p>
												{booking.totalAdditionalCharges && booking.totalAdditionalCharges > 0 && (
													<div className="text-xs text-orange-600 font-medium pt-1">
														+{formatTablePrice(booking.totalAdditionalCharges)} extra
														{booking.extraNightsDays && booking.extraNightsDays > 0 && ` (${booking.extraNightsDays} day${booking.extraNightsDays > 1 ? 's' : ''})`}
													</div>
												)}
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

		{/* Booking Stats Modal */}
		{showStatsModal && (
			<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
				<div className="bg-white dark:bg-slate-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
					<div className="sticky top-0 bg-white dark:bg-slate-950 border-b dark:border-slate-800 p-6 flex items-center justify-between">
						<h2 className="text-xl font-semibold">Booking Statistics</h2>
						<button
							onClick={() => setShowStatsModal(false)}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
						>
							✕
						</button>
					</div>
					<div className="p-8">
						{statsLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
								<Card className="dark:border-slate-800">
									<CardContent className="p-6">
										<div className="text-center space-y-3">
											<p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Paid</p>
											<p className="text-4xl font-bold text-green-600 dark:text-green-400 break-words">
												{formatTablePrice(bookingStats.totalPaid)}
											</p>
										</div>
									</CardContent>
								</Card>
								<Card className="dark:border-slate-800">
									<CardContent className="p-6">
										<div className="text-center space-y-3">
											<p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Unpaid</p>
											<p className="text-4xl font-bold text-red-600 dark:text-red-400 break-words">
												{formatTablePrice(bookingStats.totalUnpaid)}
											</p>
										</div>
									</CardContent>
								</Card>
								<Card className="dark:border-slate-800">
									<CardContent className="p-6">
										<div className="text-center space-y-3">
											<p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Checked In</p>
											<p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
												{bookingStats.totalCheckedIn}
											</p>
										</div>
									</CardContent>
								</Card>
								<Card className="dark:border-slate-800">
									<CardContent className="p-6">
										<div className="text-center space-y-3">
											<p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Checked Out</p>
											<p className="text-4xl font-bold text-gray-600 dark:text-gray-400">
												{bookingStats.totalCheckedOut}
											</p>
										</div>
									</CardContent>
								</Card>
							</div>
						)}
					</div>
				</div>
			</div>
		)}
	</div>
	);
}
