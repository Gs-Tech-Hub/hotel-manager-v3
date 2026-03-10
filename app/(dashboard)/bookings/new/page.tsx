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
import { Loader2, X, Plus } from "lucide-react";
import { useMultipleUnitBooking } from "@/hooks/useMultipleUnitBooking";
import { formatTablePrice } from "@/lib/formatters";

interface Customer {
	id: string;
	firstName?: string;
	lastName?: string;
	email: string;
}

interface Unit {
	id: string;
	roomNumber: string;
	status: string;
	isAvailable?: boolean;
	unavailableReason?: string;
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

	// Multi-booking state
	const [isMultiBooking, setIsMultiBooking] = useState(false);
	const multiBooking = useMultipleUnitBooking();

	// Fetch customers on mount
	useEffect(() => {
		setIsLoading(true);
		const fetchCustomers = async () => {
			try {
				const customersRes = await fetch("/api/customers");
				if (customersRes.ok) {
					const customersData = await customersRes.json();
					setCustomers(customersData.data?.items || []);
				}
			} catch (err) {
				console.error("Failed to fetch customers:", err);
				setError("Failed to load customers");
			} finally {
				setIsLoading(false);
			}
		};

		fetchCustomers();
	}, []);

	// Fetch available units when dates change
	useEffect(() => {
		const fetchAvailableUnits = async () => {
			if (!booking.checkin || !booking.checkout) {
				// If no dates set, fetch all available units
				try {
					const roomsRes = await fetch("/api/rooms");
					if (roomsRes.ok) {
						const roomsData = await roomsRes.json();
						setUnits(roomsData.data || []);
					}
				} catch (err) {
					console.error("Failed to fetch rooms:", err);
				}
				return;
			}

			try {
				// Parse dates and format as YYYY-MM-DD
				const checkInDate = new Date(booking.checkin);
				const checkOutDate = new Date(booking.checkout);
				const checkinStr = checkInDate.toISOString().split('T')[0];
				const checkoutStr = checkOutDate.toISOString().split('T')[0];

				// Fetch only available units for these dates
				const roomsRes = await fetch(
					`/api/rooms?checkin=${checkinStr}&checkout=${checkoutStr}`
				);

				if (roomsRes.ok) {
					const roomsData = await roomsRes.json();
					console.log("Available Units:", roomsData.data);
					setUnits(roomsData.data || []);
				}
			} catch (err) {
				console.error("Failed to fetch available units:", err);
				setError("Failed to load available rooms");
			}
		};

		fetchAvailableUnits();
	}, [booking.checkin, booking.checkout]);

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

// If unit is selected, calculate total price (store as whole number in cents)
		if (field === "unitId") {
			const selectedUnit = units.find((u) => u.id === value);
			if (selectedUnit) {
				const unitPrice = selectedUnit.roomType.basePriceCents || 0;
				updated.totalPrice = Math.round(unitPrice * prev.nights);
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

		// Recalculate total price if unit is selected (store as cents)
			if (updated.unitId) {
				const selectedUnit = units.find((u) => u.id === updated.unitId);
				if (selectedUnit) {
					const unitPrice = selectedUnit.roomType.basePriceCents || 0;
					updated.totalPrice = Math.round(unitPrice * updated.nights);
					}
				}
			}

			return updated;
		});
	};

	const validateDates = (): string | null => {
		// Check if check-in date is not in the past
		if (booking.checkin) {
			const checkInDate = new Date(booking.checkin);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			
			if (checkInDate < today) {
				return 'Check-in date cannot be in the past';
			}
		}

		// Check that checkout is after check-in
		if (booking.checkin && booking.checkout) {
			const checkInDate = new Date(booking.checkin);
			const checkOutDate = new Date(booking.checkout);
			
			if (checkOutDate <= checkInDate) {
				return 'Check-out date must be after check-in date';
			}
		}

		return null;
	};

	const handleAddUnitToMultiBooking = () => {
		if (!booking.customerId) {
			setError("Please select a customer first");
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

		const dateError = validateDates();
		if (dateError) {
			setError(dateError);
			return;
		}

		multiBooking.addUnitBooking({
			unitId: booking.unitId,
			checkInDate: booking.checkin,
			checkOutDate: booking.checkout,
			totalCents: booking.totalPrice, // already in cents
		});

		// Reset unit selection for next booking
		setBooking(prev => ({
			...prev,
			unitId: "",
		}));
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validation
		if (!booking.customerId) {
			setError("Please select a customer");
			return;
		}

		// Multi-booking mode
		if (isMultiBooking) {
			if (multiBooking.state.bookings.length === 0) {
				setError("Please add at least one unit booking");
				return;
			}

			setIsSaving(true);

			try {
				const formatDateTime = (dateStr: string) => {
					if (!dateStr) return dateStr;
					let formatted = dateStr;
					const parts = dateStr.split('T');
					if (parts[1]?.split(':').length === 2) {
						formatted = `${parts[0]}T${parts[1]}:00`;
					}
					if (!formatted.endsWith('Z')) {
						formatted = `${formatted}Z`;
					}
					return formatted;
				};

				// Submit all bookings
				const bookingPromises = multiBooking.state.bookings.map(unitBooking =>
					fetch("/api/bookings", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							customerId: booking.customerId,
							unitId: unitBooking.unitId,
							checkin: formatDateTime(unitBooking.checkInDate),
							checkout: formatDateTime(unitBooking.checkOutDate),
							nights: Math.ceil((new Date(unitBooking.checkOutDate).getTime() - new Date(unitBooking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)),
							guests: booking.guests || 1,
							totalPrice: unitBooking.totalCents / 100, // convert back to dollars for booking API
						}),
					})
				);

				const responses = await Promise.all(bookingPromises);
				const allSuccess = responses.every(r => r.ok);

				if (allSuccess) {
					router.push("/bookings");
				} else {
					setError("Failed to create one or more bookings");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Network error");
			} finally {
				setIsSaving(false);
			}
			return;
		}

		// Single booking mode
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

		// Validate dates
		const dateError = validateDates();
		if (dateError) {
			setError(dateError);
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
													{`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown'} ({customer.email})
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

								{/* Multi-booking toggle */}
								<div className="pt-4 border-t">
									<Button
										type="button"
										variant={isMultiBooking ? "default" : "outline"}
										className="w-full"
										onClick={() => {
											setIsMultiBooking(!isMultiBooking);
											setError(null);
										}}
									>
										{isMultiBooking ? "✓ Multi-Booking Mode" : "Enable Multi-Booking"}
									</Button>
									<p className="text-xs text-muted-foreground mt-2">
										{isMultiBooking 
											? "Add multiple units for this guest" 
											: "Book multiple units for same guest"}
									</p>
								</div>
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

				{/* Room & Dates - Single or Multi Mode */}
				{isMultiBooking ? (
					<Card>
						<CardHeader>
							<CardTitle>Add Multiple Units</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="unitId">Unit</Label>
								<Select value={booking.unitId} onValueChange={(val) => handleSelectChange("unitId", val)}>
									<SelectTrigger>
										<SelectValue placeholder="Select a unit" />
									</SelectTrigger>
									<SelectContent>
										{units.map((unit) => {
										const isDisabled = !unit.isAvailable;
										const statusLabel = unit.isAvailable ? '✓ Available' : `✗ ${unit.unavailableReason || 'Unavailable'}`;
										const displayText = `${unit.roomNumber} - ${unit.roomType.name} (${unit.roomType.capacity}) ${statusLabel}`;
										
										return (
											<SelectItem 
												key={unit.id} 
												value={unit.id}
												disabled={isDisabled}
												title={isDisabled ? unit.unavailableReason : undefined}
												>
													{displayText}
												</SelectItem>
											);
										})}
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

							<Button
								type="button"
								className="w-full"
								onClick={handleAddUnitToMultiBooking}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Unit to Booking
							</Button>

							{/* List of added units */}
							{multiBooking.state.bookings.length > 0 && (
								<div className="bg-muted p-3 rounded space-y-2 mt-4">
									<p className="text-sm font-semibold">Added Units ({multiBooking.state.bookings.length})</p>
									{multiBooking.state.bookings.map((ub, idx) => {
										const unit = units.find(u => u.id === ub.unitId);
										return (
											<div key={idx} className="bg-background p-2 rounded flex justify-between items-center text-sm">
												<div>
													<p className="font-medium">{unit?.roomNumber}</p>
													<p className="text-xs text-muted-foreground">
														{new Date(ub.checkInDate).toLocaleDateString()} - {new Date(ub.checkOutDate).toLocaleDateString()}
													</p>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => multiBooking.removeUnitBooking(ub.unitId, ub.checkInDate)}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										);
									})}
								</div>
							)}

							<div className="bg-muted p-3 rounded">
								<p className="text-sm">
								<span className="font-semibold">Total Price:</span> {formatTablePrice(multiBooking.state.totalCents)}
								</p>
							</div>
						</CardContent>
					</Card>
				) : (
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
										{units.map((unit) => {
											const isDisabled = !unit.isAvailable;
											const statusLabel = unit.isAvailable ? '✓ Available' : `✗ ${unit.unavailableReason || 'Unavailable'}`;
											const displayText = `${unit.roomNumber} - ${unit.roomType.name} (${unit.roomType.capacity}) ${statusLabel}`;
											
											return (
												<SelectItem 
													key={unit.id} 
													value={unit.id}
													disabled={isDisabled}
													title={isDisabled ? unit.unavailableReason : undefined}
												>
													{displayText}
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground mt-1">
									✓ = Available for booking | ✗ = Not available (already booked or needs cleaning)
								</p>
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
				)}

				{/* Pricing */}
				<Card className="md:col-span-2">
					<CardHeader>
						<CardTitle>{isMultiBooking ? "Multi-Booking Summary" : "Pricing"}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{isMultiBooking ? (
							<div className="grid gap-4 md:grid-cols-3">
								<div>
									<Label>Units Booked</Label>
									<Input
										type="number"
										value={multiBooking.state.bookings.length}
										readOnly
										className="bg-muted"
									/>
								</div>
								<div>
									<Label>Total Price</Label>
									<Input
										type="text"
										value={formatTablePrice(multiBooking.state.totalCents)}
										readOnly
										className="bg-muted"
									/>
								</div>
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-3">
								<div>
									<Label htmlFor="totalPrice">Total Price</Label>
									<Input
										id="totalPrice"
										name="totalPrice"
											type="text"
											value={formatTablePrice(booking.totalPrice)}
											readOnly
										className="bg-muted"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Auto-calculated: Room Rate × Nights
									</p>
								</div>
							</div>
						)}

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
								) : isMultiBooking ? (
									`Create ${multiBooking.state.bookings.length} Booking${multiBooking.state.bookings.length !== 1 ? 's' : ''}`
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
