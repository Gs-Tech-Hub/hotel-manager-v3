"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Edit, AlertCircle, Check } from "lucide-react";
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
		name: string;
		email: string;
		phone?: string;
	};
	unit: {
		id: string;
		roomNumber: string;
		status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE" | "BLOCKED";
		roomType: {
			id: string;
			name: string;
			capacity: number;
		};
	};
	createdAt: string;
	updatedAt: string;
}

interface CleaningSchedule {
	id: string;
	unitId: string;
	scheduledDate: string;
	status: "pending" | "in_progress" | "completed";
	notes?: string;
	assignedTo?: string;
	createdAt: string;
}

export default function BookingDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const { toast } = useToast();
	const [booking, setBooking] = useState<BookingDetail | null>(null);
	const [cleaningSchedules, setCleaningSchedules] = useState<CleaningSchedule[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [bookingId, setBookingId] = useState<string | null>(null);
	const [editCheckIn, setEditCheckIn] = useState<string>("");
	const [editCheckOut, setEditCheckOut] = useState<string>("");
	const [newRoomStatus, setNewRoomStatus] = useState<string>("");
	const [showDateEdit, setShowDateEdit] = useState(false);
	const [showStatusEdit, setShowStatusEdit] = useState(false);
	const [showCleaningForm, setShowCleaningForm] = useState(false);
	const [cleaningDate, setCleaningDate] = useState<string>("");
	const [cleaningNotes, setCleaningNotes] = useState<string>("");

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
					setNewRoomStatus(data.data.unit.status);
					await fetchCleaningSchedules(data.data.unitId);
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

	const fetchCleaningSchedules = async (unitId: string) => {
		try {
			const response = await fetch(`/api/cleaning/schedules?unitId=${unitId}`);
			const data = await response.json();
			if (data.success) {
				setCleaningSchedules(data.data);
			}
		} catch (error) {
			console.error("Failed to fetch cleaning schedules:", error);
		}
	};

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
			if (data.success) {
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

	const handleUpdateRoomStatus = async () => {
		if (!booking) return;
		setIsSaving(true);
		try {
			const response = await fetch(`/api/rooms/${booking.unit.id}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newRoomStatus }),
			});
			const data = await response.json();
			if (data.success) {
				setBooking((prev) =>
					prev
						? {
								...prev,
								unit: { ...prev.unit, status: newRoomStatus as any },
							}
						: null
				);
				setShowStatusEdit(false);
				toast({
					title: "Success",
					description: "Room status updated",
				});
			}
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to update room status",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleCreateCleaning = async () => {
		if (!booking || !cleaningDate) return;
		setIsSaving(true);
		try {
			const response = await fetch(`/api/cleaning/schedules`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					unitId: booking.unit.id,
					scheduledDate: cleaningDate,
					notes: cleaningNotes,
					status: "pending",
				}),
			});
			const data = await response.json();
			if (data.success) {
				setCleaningSchedules([...cleaningSchedules, data.data]);
				setCleaningDate("");
				setCleaningNotes("");
				setShowCleaningForm(false);
				toast({
					title: "Success",
					description: "Cleaning schedule created",
				});
			}
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to create cleaning schedule",
				variant: "destructive",
			});
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

	const cleaningStatusColors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-800",
		in_progress: "bg-blue-100 text-blue-800",
		completed: "bg-green-100 text-green-800",
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
							{booking.customer.name}
						</p>
					</div>
				</div>
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

			{/* Main Tabs */}
			<Tabs defaultValue="details" className="w-full">
				<TabsList>
					<TabsTrigger value="details">Details</TabsTrigger>
					<TabsTrigger value="room">Room Management</TabsTrigger>
					<TabsTrigger value="cleaning">Cleaning Schedule</TabsTrigger>
				</TabsList>

				{/* Details Tab */}
				<TabsContent value="details" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
										{booking.customer.name}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">
										Email
									</Label>
									<p className="font-semibold">
										{booking.customer.email}
									</p>
								</div>
								{booking.customer.phone && (
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
										{booking.unit.roomNumber}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">
										Room Type
									</Label>
									<p className="font-semibold">
										{booking.unit.roomType.name}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">
										Capacity
									</Label>
									<p className="font-semibold">
										{booking.unit.roomType.capacity} guests
									</p>
								</div>
							</CardContent>
						</Card>

						{/* Booking Dates */}
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0">
								<CardTitle>Booking Dates</CardTitle>
								<Button
									variant="outline"
									size="sm"
									onClick={
										() => setShowDateEdit(!showDateEdit)
									}
								>
									<Edit className="h-4 w-4" />
								</Button>
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
													setEditCheckIn(
														e.target.value
													)
												}
											/>
										</div>
										<div>
											<Label>Check-out</Label>
											<Input
												type="datetime-local"
												value={editCheckOut}
												onChange={(e) =>
													setEditCheckOut(
														e.target.value
													)
												}
											/>
										</div>
										<div className="flex gap-2">
											<Button
												onClick={
													handleUpdateDates
												}
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
												onClick={
													() =>
														setShowDateEdit(
															false
														)
												}
											>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<div className="space-y-2">
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
												Nights
											</Label>
											<p className="font-semibold">
												{booking.nights}
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
									</div>
								)}
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
										{formatTablePrice(
											booking.totalPrice
										)}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">
										Per Night
									</Label>
									<p className="font-semibold">
										{formatTablePrice(
											Math.round(
												booking.totalPrice /
													booking.nights
											)
										)}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Room Management Tab */}
				<TabsContent value="room" className="space-y-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<CardTitle>Room Status</CardTitle>
							<Button
								variant="outline"
								size="sm"
								onClick={
									() => setShowStatusEdit(!showStatusEdit)
								}
							>
								<Edit className="h-4 w-4" />
							</Button>
						</CardHeader>
						<CardContent>
							{showStatusEdit ? (
								<div className="space-y-3">
									<div>
										<Label>Room Status</Label>
										<Select
											value={newRoomStatus}
											onValueChange={
												setNewRoomStatus
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="AVAILABLE">
													Available
												</SelectItem>
												<SelectItem value="OCCUPIED">
													Occupied
												</SelectItem>
												<SelectItem value="CLEANING">
													Cleaning
												</SelectItem>
												<SelectItem value="MAINTENANCE">
													Maintenance
												</SelectItem>
												<SelectItem value="BLOCKED">
													Blocked
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="flex gap-2">
										<Button
											onClick={
												handleUpdateRoomStatus
											}
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
											onClick={
												() =>
													setShowStatusEdit(
														false
													)
											}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<div>
									<Label className="text-muted-foreground">
										Current Status
									</Label>
									<div className="mt-2">
										<Badge
											className={
												roomStatusColors[
													booking.unit.status
												]
											}
										>
											{booking.unit.status}
										</Badge>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Room Details */}
					<Card>
						<CardHeader>
							<CardTitle>Room Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-muted-foreground">
										Room Number
									</Label>
									<p className="font-semibold">
										{booking.unit.roomNumber}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">
										Room Type
									</Label>
									<p className="font-semibold">
										{booking.unit.roomType.name}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Cleaning Schedule Tab */}
				<TabsContent value="cleaning" className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold">
							Cleaning Schedules
						</h2>
						<Button
							onClick={
								() => setShowCleaningForm(!showCleaningForm)
							}
						>
							Add Schedule
						</Button>
					</div>

					{showCleaningForm && (
						<Card>
							<CardHeader>
								<CardTitle>Create Cleaning Schedule</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div>
										<Label>Scheduled Date</Label>
										<Input
											type="datetime-local"
											value={cleaningDate}
											onChange={(e) =>
												setCleaningDate(
													e.target.value
												)
											}
										/>
									</div>
									<div>
										<Label>Notes</Label>
										<Input
											placeholder="e.g., Deep clean, replace linens"
											value={cleaningNotes}
											onChange={(e) =>
												setCleaningNotes(
													e.target.value
												)
											}
										/>
									</div>
									<div className="flex gap-2">
										<Button
											onClick={
												handleCreateCleaning
											}
											disabled={isSaving}
										>
											{isSaving ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Check className="h-4 w-4" />
											)}
											Create
										</Button>
										<Button
											variant="outline"
											onClick={
												() =>
													setShowCleaningForm(
														false
													)
											}
										>
											Cancel
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{cleaningSchedules.length > 0 ? (
						<div className="space-y-2">
							{cleaningSchedules.map((schedule) => (
								<Card key={schedule.id}>
									<CardContent className="pt-6">
										<div className="flex items-center justify-between">
											<div className="space-y-1">
												<p className="font-semibold">
													{new Date(
														schedule.scheduledDate
													).toLocaleString()}
												</p>
												{schedule.notes && (
													<p className="text-sm text-muted-foreground">
														{schedule.notes}
													</p>
												)}
											</div>
											<Badge
												className={
													cleaningStatusColors[
														schedule.status
													]
												}
											>
												{schedule.status}
											</Badge>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<Card>
							<CardContent className="pt-6">
								<p className="text-center text-muted-foreground">
									No cleaning schedules yet
								</p>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
