"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, AlertCircle } from "lucide-react";

interface RoomType {
	id: string;
	name: string;
	code: string;
	capacity: number;
	basePriceCents: number;
	amenities?: Record<string, boolean>;
}

interface Department {
	id: string;
	name: string;
	departmentCode: string;
}

export default function RoomCreatePage() {
	const router = useRouter();
	const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
	const [departments, setDepartments] = useState<Department[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [room, setRoom] = useState({
		roomNumber: "",
		roomTypeId: "",
		unitKind: "ROOM",
		departmentId: "",
		status: "AVAILABLE",
		notes: "",
	});

	// Fetch room types and departments
	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			try {
				const [roomTypesRes, departmentsRes] = await Promise.all([
					fetch("/api/room-types"),
					fetch("/api/departments"),
				]);

				if (roomTypesRes.ok) {
					const data = await roomTypesRes.json();
					setRoomTypes(data.data || data.data?.items || []);
				}

				if (departmentsRes.ok) {
					const data = await departmentsRes.json();
					setDepartments(data.data || data.data?.items || []);
				}
			} catch (err) {
				console.error("Failed to fetch data:", err);
				setError("Failed to load room types and departments");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = e.target;
		setRoom((prev) => ({ ...prev, [name]: value }));
	};

	const handleSelectChange = (field: string, value: string) => {
		setRoom((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validation
		if (!room.roomNumber) {
			setError("Room number is required");
			return;
		}
		if (!room.roomTypeId) {
			setError("Please select a room type");
			return;
		}

		setIsSaving(true);

		try {
			// Only include departmentId if it's selected
			const payload = {
				...room,
				departmentId: room.departmentId || null,
			};

			const res = await fetch("/api/rooms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				router.push("/rooms");
			} else {
				setError(data?.message || "Failed to create room");
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
				<h1 className="text-3xl font-bold tracking-tight">Create Room</h1>
				<p className="text-muted-foreground">Add a new room to your inventory</p>
			</div>

			<form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="roomNumber">Room Number *</Label>
							<Input
								id="roomNumber"
								name="roomNumber"
								placeholder="e.g., 101, 202A"
								value={room.roomNumber}
								onChange={handleChange}
								required
							/>
						</div>

						<div>
							<Label htmlFor="roomTypeId">Room Type *</Label>
							<Select value={room.roomTypeId} onValueChange={(val) => handleSelectChange("roomTypeId", val)}>
								<SelectTrigger>
									<SelectValue placeholder="Select a room type" />
								</SelectTrigger>
								<SelectContent>
									{roomTypes.map((type) => (
										<SelectItem key={type.id} value={type.id}>
											{type.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="unitKind">Unit Kind *</Label>
							<Select value={room.unitKind} onValueChange={(val) => handleSelectChange("unitKind", val)}>
								<SelectTrigger>
									<SelectValue placeholder="Select unit kind" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ROOM">Room</SelectItem>
									<SelectItem value="SUITE">Suite</SelectItem>
									<SelectItem value="APARTMENT">Apartment</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="status">Status</Label>
							<Select value={room.status} onValueChange={(val) => handleSelectChange("status", val)}>
								<SelectTrigger>
									<SelectValue placeholder="Select status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="AVAILABLE">Available</SelectItem>
									<SelectItem value="OCCUPIED">Occupied</SelectItem>
									<SelectItem value="MAINTENANCE">Maintenance</SelectItem>
									<SelectItem value="CLEANING">Cleaning</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardContent>
				</Card>

				{/* Additional Information */}
				<Card>
					<CardHeader>
						<CardTitle>Additional Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="departmentId">Department (Optional)</Label>
							<Select value={room.departmentId} onValueChange={(val) => handleSelectChange("departmentId", val)}>
								<SelectTrigger>
									<SelectValue placeholder="Select a department" />
								</SelectTrigger>
								<SelectContent>
									{departments.map((dept) => (
										<SelectItem key={dept.id} value={dept.id}>
											{dept.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="notes">Notes</Label>
							<Textarea
								id="notes"
								name="notes"
								placeholder="Add any notes about this room..."
								value={room.notes}
								onChange={handleChange}
								rows={4}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Error & Actions */}
				<Card className="md:col-span-2">
					{error && (
						<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded p-3 m-4 mb-0">
							{error}
						</div>
					)}
					<CardContent className="pt-6 flex gap-2 justify-end">
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
								"Create Room"
							)}
						</Button>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
