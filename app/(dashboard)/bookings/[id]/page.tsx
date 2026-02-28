"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Edit, Check, LogIn, LogOut, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTablePrice } from "@/lib/formatters";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BookingDetail {
	id: string;
	bookingId: string;
	customerId: string;
	unitId: string;
	checkin: string;
	checkout: string;
	timeIn?: string;
	timeOut?: string;
	nights: number;
	guests: number;
	totalPrice: number;
	bookingStatus: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
	customer: {
		id: string;
		firstName?: string;
		lastName?: string;
		email: string;
		phone?: string;
	};
	unit?: {
		id: string;
		roomNumber: string;
		status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE" | "BLOCKED";
		roomType?: {
			id: string;
			name: string;
			capacity: number;
		};
	};
	payment?: {
		id: string;
		transactionID: string;
		paymentMethod: string;
		paymentStatus: string;
		totalPrice: number;
	};
	createdAt: string;
	updatedAt: string;
}

export default function BookingDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const { toast } = useToast();
	const [booking, setBooking] = useState<BookingDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [bookingId, setBookingId] = useState<string | null>(null);
	const [editCheckIn, setEditCheckIn] = useState<string>("");
	const [editCheckOut, setEditCheckOut] = useState<string>("");
	const [showDateEdit, setShowDateEdit] = useState(false);
	const [showPaymentDialog, setShowPaymentDialog] = useState(false);
	const [paymentData, setPaymentData] = useState({
		amount: "",
		method: "cash",
	});

	useEffect(() => {
		const unwrapParams = async () => {
			const p = await params;
			setBookingId(p.id);
		};
		unwrapParams();
	}, [params]);

	useEffect(() => {
		if (!bookingId) return;

		const fetchBooking = async () => {
			try {
				const response = await fetch(`/api/bookings/${bookingId}`);
				const data = await response.json();
				if (data.success) {
					setBooking(data.data);
					setEditCheckIn(data.data.checkin);
					setEditCheckOut(data.data.checkout);
				}
			} catch (error) {
				console.error("Failed to fetch booking:", error);
				toast({
					title: "Error",
					description: "Failed to load booking details",
					variant: "destructive",
				});
			} finally {
				setIsLoading(false);
			}
		};

		fetchBooking();
	}, [bookingId, toast]);

	const handleUpdateDates = async () => {
		if (!booking) return;
		setIsSaving(true);
		try {
			const response = await fetch(`/api/bookings/${bookingId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					checkin: editCheckIn,
					checkout: editCheckOut,
				}),
			});
			const data = await response.json();
		if (data.success && data.data) {
				setBooking(data.data);
				setShowDateEdit(false);
				toast({
					title: "Success",
					description: "Booking dates updated",
				});
			}
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to update dates",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleCheckIn = async () => {
		if (!booking || !booking.unit?.id) return;
		setIsSaving(true);
		try {
			// Update booking status to in_progress
			const bookingRes = await fetch(`/api/bookings/${bookingId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					bookingStatus: "in_progress",
					timeIn: new Date().toISOString(),
				}),
			});

			if (!bookingRes.ok) throw new Error("Failed to check in");

			// Update room status to OCCUPIED
			await fetch(`/api/rooms/${booking.unit.id}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "OCCUPIED", reason: "Guest checked in" }),
			});

			const data = await bookingRes.json();
			if (data.data) {
				setBooking(data.data);
			}
			toast({
				title: "Success",
				description: "Guest checked in successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to check in guest",
				variant: "destructive",
			});
			console.error("Check-in error:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleCheckOut = async () => {
		if (!booking || !booking.unit?.id) return;
		setIsSaving(true);
		try {
			// Update booking status to completed
			const bookingRes = await fetch(`/api/bookings/${bookingId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					bookingStatus: "completed",
					timeOut: new Date().toISOString(),
				}),
			});

			if (!bookingRes.ok) throw new Error("Failed to check out");

			// Update room status to CLEANING (will need cleaning after guest checkout)
			await fetch(`/api/rooms/${booking.unit.id}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: "CLEANING",
					reason: "Guest checked out - room needs cleaning",
				}),
			});

			// Create cleaning task for the room
			const cleaningRes = await fetch(`/api/cleaning/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					unitId: booking.unit.id,
					taskType: "FULL_CLEAN",
					priority: "NORMAL",
					notes: `Post-checkout cleaning for booking ${booking.bookingId}`,
				}),
			});

			if (!cleaningRes.ok) {
				console.error("Failed to create cleaning task, but checkout completed");
			}

			const data = await bookingRes.json();
			if (data.data) {
				setBooking(data.data);
			}
			toast({
				title: "Success",
				description: "Guest checked out - room marked for cleaning",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to check out guest",
				variant: "destructive",
			});
			console.error("Check-out error:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleProcessPayment = async () => {
		if (!booking) {
			toast({
				title: "Error",
				description: "Booking not found",
				variant: "destructive",
			});
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch(`/api/bookings/${bookingId}/payment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amount: booking.totalPrice, // Full booking amount in cents
					method: paymentData.method,
				}),
			});

			if (!response.ok) throw new Error("Payment failed");

			const data = await response.json();
			if (data.data && data.data.booking) {
				setBooking(data.data.booking);
			}
			setShowPaymentDialog(false);
			setPaymentData({
				amount: "",
				method: "cash",
			});
			toast({
				title: "Success",
				description: `Payment of ${formatTablePrice(booking.totalPrice)} received successfully`,
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to process payment",
				variant: "destructive",
			});
			console.error("Payment error:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const statusColors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-800",
		confirmed: "bg-blue-100 text-blue-800",
		in_progress: "bg-green-100 text-green-800",
		completed: "bg-gray-100 text-gray-800",
		cancelled: "bg-red-100 text-red-800",
	};

	const roomStatusColors: Record<string, string> = {
		AVAILABLE: "bg-green-100 text-green-800",
		OCCUPIED: "bg-blue-100 text-blue-800",
		CLEANING: "bg-yellow-100 text-yellow-800",
		MAINTENANCE: "bg-red-100 text-red-800",
		BLOCKED: "bg-gray-100 text-gray-800",
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!booking) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">Booking not found</p>
				<Link href="/bookings">
					<Button className="mt-4">Back to Bookings</Button>
				</Link>
			</div>
		);
	}

	const isCheckedIn = booking.bookingStatus === "in_progress";
	const isCheckedOut = booking.bookingStatus === "completed";

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link href="/bookings">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold">{booking.bookingId}</h1>
						<p className="text-muted-foreground">
							{booking.customer ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim() || "Unknown Guest" : "Unknown Guest"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Badge className={statusColors[booking.bookingStatus]}>
						{booking.bookingStatus
							.split("_")
							.map(
								(word) =>
									word.charAt(0).toUpperCase() + word.slice(1)
							)
							.join(" ")}
					</Badge>
				<Badge className={roomStatusColors[booking.unit?.status || "AVAILABLE"]}>
					{booking.unit?.status || "N/A"}
					</Badge>
				</div>
			</div>

			{/* Main Content */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Guest Information */}
				<Card>
					<CardHeader>
						<CardTitle>Guest Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<Label className="text-muted-foreground">
								Name
							</Label>
							<p className="font-semibold">
								{booking.customer ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim() || "Unknown Guest" : "Unknown Guest"}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Email
							</Label>
							<p className="font-semibold">
								{booking.customer?.email || "N/A"}
							</p>
						</div>
						{booking.customer?.phone && (
							<div>
								<Label className="text-muted-foreground">
									Phone
								</Label>
								<p className="font-semibold">
									{booking.customer.phone}
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Room Information */}
				<Card>
					<CardHeader>
						<CardTitle>Room Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<Label className="text-muted-foreground">
								Room Number
							</Label>
							<p className="font-semibold">
								{booking.unit?.roomNumber || "N/A"}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Room Type
							</Label>
							<p className="font-semibold">
								{booking.unit?.roomType?.name || "N/A"}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Capacity
							</Label>
							<p className="font-semibold">
								{booking.unit?.roomType?.capacity || 0} guests
							</p>
						</div>
					{booking.unit?.id ? (
						<Link href={`/rooms/${booking.unit.id}`}>
							<Button variant="outline" size="sm" className="w-full mt-2">
								Manage Room
							</Button>
						</Link>
					) : null}
					</CardContent>
				</Card>

				{/* Pricing */}
				<Card>
					<CardHeader>
						<CardTitle>Pricing</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<Label className="text-muted-foreground">
								Total Price
							</Label>
							<p className="text-2xl font-bold">
								{formatTablePrice(booking.totalPrice)}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Per Night
							</Label>
							<p className="font-semibold">
								{formatTablePrice(
									Math.round(
										booking.totalPrice / booking.nights
									)
								)}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Nights
							</Label>
							<p className="font-semibold">
								{booking.nights}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Booking Dates & Actions */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<CardTitle>Booking Details</CardTitle>
					{!showDateEdit && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowDateEdit(true)}
						>
							<Edit className="h-4 w-4" />
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{showDateEdit ? (
						<div className="space-y-3">
							<div>
								<Label>Check-in</Label>
								<Input
									type="datetime-local"
									value={editCheckIn}
									onChange={(e) =>
										setEditCheckIn(e.target.value)
									}
								/>
							</div>
							<div>
								<Label>Check-out</Label>
								<Input
									type="datetime-local"
									value={editCheckOut}
									onChange={(e) =>
										setEditCheckOut(e.target.value)
									}
								/>
							</div>
							<div className="flex gap-2">
								<Button
									onClick={handleUpdateDates}
									disabled={isSaving}
								>
									{isSaving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Check className="h-4 w-4" />
									)}
									Save
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										setShowDateEdit(false)
									}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<Label className="text-muted-foreground">
									Check-in
								</Label>
								<p className="font-semibold">
									{new Date(
										booking.checkin
									).toLocaleString()}
								</p>
							</div>
							<div>
								<Label className="text-muted-foreground">
									Check-out
								</Label>
								<p className="font-semibold">
									{new Date(
										booking.checkout
									).toLocaleString()}
								</p>
							</div>
							<div>
								<Label className="text-muted-foreground">
									Guests
								</Label>
								<p className="font-semibold">
									{booking.guests}
								</p>
							</div>
							<div>
								<Label className="text-muted-foreground">
									Status
								</Label>
								<p className="font-semibold">
									{isCheckedIn ? "Checked In" : isCheckedOut ? "Checked Out" : "Pending"}
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Check-in/Out Actions */}
			{/* Payment Section */}
			<Card>
				<CardHeader>
					<CardTitle>Payment</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label className="text-muted-foreground">Total Due</Label>
							<p className="text-2xl font-bold text-blue-600">
								{formatTablePrice(booking.totalPrice)}
							</p>
						</div>
						{booking.payment && (
							<div>
								<Label className="text-muted-foreground">Payment Status</Label>
								<div className="mt-1">
									<div className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
										✓ {booking.payment.paymentStatus || 'Completed'}
									</div>
								</div>
							</div>
						)}
					</div>
					{booking.payment ? (
						<div className="bg-green-50 p-4 rounded border border-green-200 space-y-2">
							<p className="text-sm font-semibold text-green-900">Payment Details</p>
							<div className="text-sm text-green-800">
								<p>Method: <span className="font-semibold">{booking.payment.paymentMethod.toUpperCase()}</span></p>
								{booking.payment.transactionID && (
									<p>Reference: <span className="font-semibold">{booking.payment.transactionID}</span></p>
								)}
							</div>
						</div>
					) : (
						<Button
							onClick={() => setShowPaymentDialog(true)}
							className="w-full"
						>
							<CreditCard className="h-4 w-4 mr-2" />
							Process Payment
						</Button>
					)}
				</CardContent>
			</Card>

			{/* Payment Dialog */}
			{showPaymentDialog && (
				<Card className="shadow-lg">
					<CardHeader>
						<CardTitle>Confirm Payment</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label>Total Amount Due</Label>
							<p className="text-2xl font-bold text-blue-600 mt-1">
								{formatTablePrice(booking.totalPrice)}
							</p>
						</div>
						<div>
							<Label htmlFor="method">Payment Method</Label>
							<Select value={paymentData.method} onValueChange={(v) => setPaymentData({ ...paymentData, method: v })}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="card">Credit/Debit Card</SelectItem>
									<SelectItem value="bank_transfer">Bank Transfer</SelectItem>
									<SelectItem value="mobile_payment">Mobile Payment</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex gap-2">
							<Button
								onClick={handleProcessPayment}
								disabled={isSaving}
								className="flex-1"
							>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<CreditCard className="h-4 w-4 mr-2" />
								)}
								Confirm Payment
							</Button>
							<Button
								variant="outline"
								onClick={() => setShowPaymentDialog(false)}
								className="flex-1"
							>
								Cancel
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{!isCheckedOut && (
				<Card>
					<CardHeader>
						<CardTitle>Guest Actions</CardTitle>
					</CardHeader>
					<CardContent className="flex gap-2">
						{!isCheckedIn && (
							<Button
								onClick={handleCheckIn}
								disabled={isSaving}
								className="flex-1"
							>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<LogIn className="h-4 w-4 mr-2" />
								)}
								Check In
							</Button>
						)}
						{isCheckedIn && (
							<Button
								onClick={handleCheckOut}
								disabled={isSaving}
								variant="destructive"
								className="flex-1"
							>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<LogOut className="h-4 w-4 mr-2" />
								)}
								Check Out
							</Button>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
