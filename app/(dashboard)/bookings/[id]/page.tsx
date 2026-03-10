"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, LogIn, LogOut, CreditCard, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTablePrice } from "@/lib/formatters";
import { 
	getGuestStatus, 
	getGuestStatusColor, 
	getGuestStatusLabel, 
	getRoomAvailabilityStatus,
	getRoomAvailabilityColor,
	getRoomAvailabilityLabel 
} from "@/src/lib/booking-status";
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
	const [showPaymentDialog, setShowPaymentDialog] = useState(false);
	const [showReceipt, setShowReceipt] = useState(false);
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

	const handleCheckIn = async () => {
		if (!booking || !booking.unit?.id) return;
		setIsSaving(true);
		try {
			// Update booking to set check-in time
			// Note: bookingStatus remains 'confirmed' (payment status)
			const bookingRes = await fetch(`/api/bookings/${bookingId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
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
			// Update booking to set check-out time
			// Note: bookingStatus remains 'confirmed' (payment status)
			const bookingRes = await fetch(`/api/bookings/${bookingId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
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
			// Fetch fresh booking to get current check-in/out state
			const refreshRes = await fetch(`/api/bookings/${bookingId}`);
			const refreshData = await refreshRes.json();
			const currentBooking = refreshData.data;

			const response = await fetch(`/api/bookings/${bookingId}/payment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amount: booking.totalPrice,
					method: paymentData.method,
				}),
			});

			if (!response.ok) throw new Error("Payment failed");

			const data = await response.json();
			if (data.data && data.data.booking) {
				// Response includes preserved check-in/out times from payment endpoint
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

	const handlePrintReceipt = () => {
		if (!booking) return;
		setShowReceipt(true);
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

	const isCheckedIn = booking.timeIn !== undefined && booking.timeIn !== null;
	const isCheckedOut = booking.timeOut !== undefined && booking.timeOut !== null;
	const isPaymentMade = booking.payment !== undefined && booking.payment !== null;

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
				<div className="flex flex-col items-end gap-2">
					<div className="flex items-center gap-2">
						<div>
							<p className="text-xs text-muted-foreground mb-1">Payment Status</p>
							<Badge className={statusColors[booking.bookingStatus]}>
								{booking.bookingStatus
									.split("_")
									.map(
										(word) =>
											word.charAt(0).toUpperCase() + word.slice(1)
									)
									.join(" ")}
							</Badge>
						</div>
						<div>
							<p className="text-xs text-muted-foreground mb-1">Guest Status</p>
							<Badge className={getGuestStatusColor(getGuestStatus(booking.timeIn, booking.timeOut))}>
								{getGuestStatusLabel(getGuestStatus(booking.timeIn, booking.timeOut))}
							</Badge>
						</div>
					</div>
					{(() => {
						const roomAvailability = getRoomAvailabilityStatus(
							booking.checkin,
							booking.checkout,
							isPaymentMade
						);
						return (
							<Badge className={getRoomAvailabilityColor(roomAvailability)}>
								Room: {getRoomAvailabilityLabel(roomAvailability)}
							</Badge>
						);
					})()}
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
				<CardHeader>
					<CardTitle>Booking Details</CardTitle>
				</CardHeader>
				<CardContent>
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
						<div className="bg-yellow-50 p-4 rounded border border-yellow-200 space-y-2">
							<p className="text-sm font-semibold text-yellow-900">Payment Pending</p>
							<p className="text-sm text-yellow-800">No payment has been processed yet.</p>
						</div>
					)}
					<div className="flex gap-2">
						<Button
							onClick={handlePrintReceipt}
							variant="outline"
							size="sm"
							className="flex-1"
						>
							<Printer className="h-4 w-4 mr-2" />
							Print Receipt
						</Button>
						{!booking.payment && (
							<Button
								onClick={() => setShowPaymentDialog(true)}
								size="sm"
								className="flex-1"
							>
								<CreditCard className="h-4 w-4 mr-2" />
								Process Payment
							</Button>
						)}
					</div>
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
								disabled={isSaving || !isPaymentMade}
								className="flex-1"
								title={!isPaymentMade ? "Payment must be made before check-in" : ""}
							>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<LogIn className="h-4 w-4 mr-2" />
								)}
								{isPaymentMade ? "Check In" : "Check In (Payment Required)"}
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

			{/* Receipt Modal */}
			{showReceipt && booking && (
				<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 w-96 shadow-lg max-h-[80vh] overflow-auto">
						<div className="font-mono text-sm space-y-2">
							{/* Header */}
							<div className="text-center border-b pb-3 mb-3">
								<div className="font-bold text-lg">HOTEL RECEIPT</div>
								<div className="text-xs text-muted-foreground">Booking Confirmation</div>
								<div className="text-xs text-muted-foreground mt-1">
									{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
								</div>
							</div>

							{/* Booking Info */}
							<div className="space-y-1 border-b pb-2">
								<div className="flex justify-between text-xs">
									<span className="font-semibold">Booking ID:</span>
									<span>{booking.bookingId}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span className="font-semibold">Status:</span>
									<span className="capitalize">{booking.bookingStatus.replace(/_/g, ' ')}</span>
								</div>
							</div>

							{/* Guest Info */}
							<div className="space-y-1 border-b pb-2">
								<div className="text-xs font-semibold mb-1">Guest Information</div>
								<div className="flex justify-between text-xs">
									<span>Name:</span>
									<span>{`${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim()}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Email:</span>
									<span className="text-right max-w-[150px] truncate">{booking.customer?.email}</span>
								</div>
								{booking.customer?.phone && (
									<div className="flex justify-between text-xs">
										<span>Phone:</span>
										<span>{booking.customer.phone}</span>
									</div>
								)}
							</div>

							{/* Room & Dates */}
							<div className="space-y-1 border-b pb-2">
								<div className="text-xs font-semibold mb-1">Accommodation Details</div>
								<div className="flex justify-between text-xs">
									<span>Room Number:</span>
									<span>{booking.unit?.roomNumber || 'N/A'}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Room Type:</span>
									<span>{booking.unit?.roomType?.name || 'N/A'}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Check-in:</span>
									<span>{new Date(booking.checkin).toLocaleDateString()}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Check-out:</span>
									<span>{new Date(booking.checkout).toLocaleDateString()}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Nights:</span>
									<span>{booking.nights}</span>
								</div>
								<div className="flex justify-between text-xs">
									<span>Guests:</span>
									<span>{booking.guests}</span>
								</div>
							</div>

							{/* Pricing */}
							<div className="space-y-1 border-b pb-2">
								<div className="flex justify-between text-xs font-semibold">
									<span>Per Night:</span>
									<span>{formatTablePrice(Math.round(booking.totalPrice / booking.nights))}</span>
								</div>
								<div className="flex justify-between font-bold text-sm">
									<span>Total:</span>
									<span>{formatTablePrice(booking.totalPrice)}</span>
								</div>
							</div>

							{/* Payment Info */}
							{booking.payment && (
								<div className="space-y-1 border-b pb-2">
									<div className="text-xs font-semibold mb-1">Payment Information</div>
									<div className="flex justify-between text-xs">
										<span>Method:</span>
										<span className="capitalize">{booking.payment.paymentMethod}</span>
									</div>
									<div className="flex justify-between text-xs">
										<span>Status:</span>
										<span className="text-green-600 font-semibold">✓ {booking.payment.paymentStatus}</span>
									</div>
									{booking.payment.transactionID && (
										<div className="flex justify-between text-xs">
											<span>Reference:</span>
											<span className="font-mono">{booking.payment.transactionID}</span>
										</div>
									)}
								</div>
							)}

							{/* Footer */}
							<div className="text-center text-xs text-muted-foreground pt-2 border-t">
								<div>Thank you for your stay!</div>
								<div className="mt-1">Please keep this receipt for your records</div>
							</div>
						</div>

						{/* Buttons */}
						<div className="flex gap-2 mt-4">
							<Button
								onClick={() => {
									const printWindow = window.open('', '', 'width=600,height=800');
									if (printWindow) {
										const receiptContent = document.querySelector('.font-mono');
										if (receiptContent) {
											printWindow.document.write('<html><head><title>Receipt</title></head><body>');
											printWindow.document.write(receiptContent.innerHTML);
											printWindow.document.write('</body></html>');
											printWindow.document.close();
											printWindow.print();
										}
									}
								}}
								size="sm"
								className="flex-1"
							>
								<Printer className="h-4 w-4 mr-2" />
								Print
							</Button>
							<Button
								onClick={() => setShowReceipt(false)}
								variant="outline"
								size="sm"
								className="flex-1"
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
