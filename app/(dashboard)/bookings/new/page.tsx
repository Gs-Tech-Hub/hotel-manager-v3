"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Customer {
	id: string;
	name: string;
	email: string;
}

interface Unit {
	id: string;
	roomNumber: string;
	status: string;
	roomType: {
		id: string;
		name: string;
		basePriceCents: number;
		capacity: number;
	};
}

export default function BookingCreatePage() {
	const router = useRouter();
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [units, setUnits] = useState<Unit[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
	const [showCreateCustomer, setShowCreateCustomer] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [booking, setBooking] = useState({
		customerId: "",
		unitId: "",
		checkin: "",
		checkout: "",
		nights: 1,
		guests: 1,
		totalPrice: 0,
	});
	const [newCustomer, setNewCustomer] = useState({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
	});

	// Fetch customers and rooms
	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			try {
				const [customersRes, roomsRes] = await Promise.all([
					fetch("/api/customers"),
					fetch("/api/rooms"),
				]);

				if (customersRes.ok) {
					const customersData = await customersRes.json();
					setCustomers(customersData.data?.items || []);
				}

				if (roomsRes.ok) {
					const roomsData = await roomsRes.json();
					console.log("Units API Response:", roomsData);
					console.log("Units Data:", roomsData.data);
					setUnits(roomsData.data || []);
				}
			} catch (err) {
				console.error("Failed to fetch data:", err);
				setError("Failed to load customers and rooms");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		const numFields = ["nights", "guests", "totalPrice"];
		setBooking((prev) => ({
			...prev,
			[name]: numFields.includes(name) ? Number(value) : value,
		}));
	};

	const handleSelectChange = (field: string, value: string) => {
		setBooking((prev) => {
			const updated = { ...prev, [field]: value };

		// If unit is selected, calculate total price
		if (field === "unitId") {
			const selectedUnit = units.find((u) => u.id === value);
			if (selectedUnit) {
				const unitPrice = selectedUnit.roomType.basePriceCents || 0;
				updated.totalPrice = unitPrice * prev.nights;
				}
			}

			return updated;
		});
	};

	const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setNewCustomer((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleCreateCustomer = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.email || !newCustomer.phone) {
			setError("Please fill in all customer fields");
			return;
		}

		setIsCreatingCustomer(true);

		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newCustomer),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				const createdCustomer = data.data;
				setCustomers((prev) => [...prev, createdCustomer]);
				setBooking((prev) => ({ ...prev, customerId: createdCustomer.id }));
				setNewCustomer({ firstName: "", lastName: "", email: "", phone: "" });
				setShowCreateCustomer(false);
			} else {
				setError(data?.message || "Failed to create customer");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsCreatingCustomer(false);
		}
	};

	const handleDateChange = (field: string, value: string) => {
		setBooking((prev) => {
			const updated = { ...prev, [field]: value };

			// Calculate nights if both dates are set
			if (updated.checkin && updated.checkout) {
				const checkInDate = new Date(updated.checkin);
				const checkOutDate = new Date(updated.checkout);
				const nightsCount = Math.ceil(
					(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
				);
				updated.nights = Math.max(1, nightsCount);

		// Recalculate total price if unit is selected
			if (updated.unitId) {
				const selectedUnit = units.find((u) => u.id === updated.unitId);
				if (selectedUnit) {
					const unitPrice = selectedUnit.roomType.basePriceCents || 0;
					updated.totalPrice = unitPrice * updated.nights;
					}
				}
			}

			return updated;
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validation
		if (!booking.customerId) {
			setError("Please select a customer");
			return;
		}
		if (!booking.unitId) {
			setError("Please select a unit");
			return;
		}
		if (!booking.checkin || !booking.checkout) {
			setError("Please select check-in and check-out dates");
			return;
		}
		if (booking.guests < 1) {
			setError("Number of guests must be at least 1");
			return;
		}

		setIsSaving(true);

		try {
			// Format datetime to ISO-8601 with seconds and timezone
			const formatDateTime = (dateStr: string) => {
				if (!dateStr) return dateStr;
				
				// Add :00 for seconds if missing
				let formatted = dateStr;
				const parts = dateStr.split('T');
				if (parts[1]?.split(':').length === 2) {
					formatted = `${parts[0]}T${parts[1]}:00`;
				}
				
				// Add Z for UTC timezone if not present
				if (!formatted.endsWith('Z')) {
					formatted = `${formatted}Z`;
				}
				
				return formatted;
			};

			const bookingData = {
				...booking,
				checkin: formatDateTime(booking.checkin),
				checkout: formatDateTime(booking.checkout),
			};

			const res = await fetch("/api/bookings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(bookingData),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				router.push("/bookings");
			} else {
				setError(data?.message || "Failed to create booking");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Create Booking</h1>
				<p className="text-muted-foreground">Create a new guest reservation</p>
			</div>

			<form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
				{/* Guest Information */}
				<Card>
					<CardHeader>
						<CardTitle>Guest Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{!showCreateCustomer ? (
							<>
								<div>
									<Label htmlFor="customerId">Customer</Label>
									<Select value={booking.customerId} onValueChange={(val) => handleSelectChange("customerId", val)}>
										<SelectTrigger>
											<SelectValue placeholder="Select a customer" />
										</SelectTrigger>
										<SelectContent>
											{customers.map((customer) => (
												<SelectItem key={customer.id} value={customer.id}>
													{customer.name} ({customer.email})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => setShowCreateCustomer(true)}
								>
									Create New Customer
								</Button>
							</>
						) : (
							<>
								<div>
									<Label htmlFor="firstName">First Name</Label>
									<Input
										id="firstName"
										name="firstName"
										value={newCustomer.firstName}
										onChange={handleNewCustomerChange}
										placeholder="First name"
									/>
								</div>
								<div>
									<Label htmlFor="lastName">Last Name</Label>
									<Input
										id="lastName"
										name="lastName"
										value={newCustomer.lastName}
										onChange={handleNewCustomerChange}
										placeholder="Last name"
									/>
								</div>
								<div>
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										name="email"
										type="email"
										value={newCustomer.email}
										onChange={handleNewCustomerChange}
										placeholder="email@example.com"
									/>
								</div>
								<div>
									<Label htmlFor="phone">Phone</Label>
									<Input
										id="phone"
										name="phone"
										type="tel"
										value={newCustomer.phone}
										onChange={handleNewCustomerChange}
										placeholder="+1 (555) 123-4567"
									/>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										className="flex-1"
										onClick={() => {
											setShowCreateCustomer(false);
											setNewCustomer({ firstName: "", lastName: "", email: "", phone: "" });
											setError(null);
										}}
										disabled={isCreatingCustomer}
									>
										Cancel
									</Button>
									<Button
										type="button"
										className="flex-1"
										onClick={handleCreateCustomer}
										disabled={isCreatingCustomer}
									>
										{isCreatingCustomer ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Creating...
											</>
										) : (
											"Create Customer"
										)}
									</Button>
								</div>
							</>
						)}

						<div>
							<Label htmlFor="guests">Number of Guests</Label>
							<Input
								id="guests"
								name="guests"
								type="number"
								min="1"
								value={booking.guests}
								onChange={handleChange}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Room & Dates */}
				<Card>
					<CardHeader>
						<CardTitle>Room & Dates</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="unitId">Unit</Label>
							<Select value={booking.unitId} onValueChange={(val) => handleSelectChange("unitId", val)}>
								<SelectTrigger>
									<SelectValue placeholder="Select a unit" />
								</SelectTrigger>
								<SelectContent>
									{units.map((unit) => (
										<SelectItem key={unit.id} value={unit.id}>
											{unit.roomNumber} - {unit.roomType.name} ({unit.roomType.capacity} guests)
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="checkin">Check-in Date</Label>
							<Input
								id="checkin"
								name="checkin"
								type="datetime-local"
								value={booking.checkin}
								onChange={(e) => handleDateChange("checkin", e.target.value)}
							/>
						</div>

						<div>
							<Label htmlFor="checkout">Check-out Date</Label>
							<Input
								id="checkout"
								name="checkout"
								type="datetime-local"
								value={booking.checkout}
								onChange={(e) => handleDateChange("checkout", e.target.value)}
							/>
						</div>

						<div className="bg-muted p-3 rounded">
							<p className="text-sm">
								<span className="font-semibold">Nights:</span> {booking.nights}
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Pricing */}
				<Card className="md:col-span-2">
					<CardHeader>
						<CardTitle>Pricing</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-3">
							<div>
								<Label htmlFor="totalPrice">Total Price</Label>
								<Input
									id="totalPrice"
									name="totalPrice"
									type="number"
									min="0"
									step="0.01"
									value={booking.totalPrice}
									readOnly
									placeholder="0.00"
									className="bg-muted"
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Auto-calculated: Room Rate × Nights
								</p>
							</div>
						</div>

						{error && (
							<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded p-3">
								{error}
							</div>
						)}

						<div className="flex gap-2 justify-end">
							<Button
								type="button"
								variant="outline"
								onClick={() => router.back()}
								disabled={isSaving}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSaving}>
								{isSaving ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Creating...
									</>
								) : (
									"Create Booking"
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
