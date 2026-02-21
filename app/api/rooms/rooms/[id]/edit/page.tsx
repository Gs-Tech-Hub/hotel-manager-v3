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
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";

interface Room {
	id: string;
	roomNumber: string;
	unitKind: string;
	status: string;
	notes?: string;
	roomType: {
		id: string;
		name: string;
		code: string;
		capacity: number;
		bedSize?: string | null;
		roomSizeM2?: number | null;
		basePriceCents: number;
		description?: string;
	};
}

export default function RoomEditPage(props: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const [room, setRoom] = useState<Room | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [roomId, setRoomId] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		roomNumber: "",
		unitKind: "ROOM",
		status: "AVAILABLE",
		notes: "",
	});

	useEffect(() => {
		const unwrapParams = async () => {
			const params = await props.params;
			setRoomId(params.id);
		};
		unwrapParams();
	}, [props.params]);

	useEffect(() => {
		if (!roomId) return;

		const fetchRoom = async () => {
			try {
				const response = await fetch(`/api/rooms/${roomId}`);
				const data = await response.json();
				if (data.success) {
					const roomData = data.data;
					setRoom(roomData);
					setFormData({
						roomNumber: roomData.roomNumber,
						unitKind: roomData.unitKind,
						status: roomData.status,
						notes: roomData.notes || "",
					});
				}
			} catch (error) {
				console.error("Failed to fetch room:", error);
				setError("Failed to load room details");
			} finally {
				setIsLoading(false);
			}
		};

		fetchRoom();
	}, [roomId]);

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSelectChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSaving(true);

		try {
			const response = await fetch(`/api/rooms/${roomId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (response.ok) {
				router.push(`/rooms/${roomId}`);
			} else {
				setError(data?.message || "Failed to save room");
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

	if (!room) {
		return (
			<div className="space-y-8">
				<Link href="/rooms">
					<Button variant="outline" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<p className="text-muted-foreground">Room not found</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href={`/rooms/${roomId}`}>
					<Button variant="outline" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Edit Room</h1>
					<p className="text-muted-foreground">
						{room.roomType.name} (Room #{room.roomNumber})
					</p>
				</div>
			</div>

			{/* Error Alert */}
			{error && (
				<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 flex gap-3">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold">Error</p>
						<p className="text-sm">{error}</p>
					</div>
				</div>
			)}

			{/* Form */}
			<form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
				{/* Room Information */}
				<Card>
					<CardHeader>
						<CardTitle>Room Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label htmlFor="roomNumber">Room Number *</Label>
							<Input
								id="roomNumber"
								name="roomNumber"
								value={formData.roomNumber}
								onChange={handleChange}
								required
							/>
						</div>

						<div>
							<Label htmlFor="unitKind">Unit Kind *</Label>
							<Select
								value={formData.unitKind}
								onValueChange={(val) => handleSelectChange("unitKind", val)}
							>
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
							<Label htmlFor="status">Status *</Label>
							<Select
								value={formData.status}
								onValueChange={(val) => handleSelectChange("status", val)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="AVAILABLE">Available</SelectItem>
									<SelectItem value="OCCUPIED">Occupied</SelectItem>
									<SelectItem value="CLEANING">Cleaning</SelectItem>
									<SelectItem value="MAINTENANCE">Maintenance</SelectItem>
									<SelectItem value="BLOCKED">Blocked</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardContent>
				</Card>

				{/* Room Type Information (Read-Only) */}
				<Card>
					<CardHeader>
						<CardTitle>Room Type Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label className="text-muted-foreground">Room Type</Label>
							<p className="font-semibold">{room.roomType.name}</p>
						</div>

						<div>
							<Label className="text-muted-foreground">Capacity</Label>
							<p className="font-semibold">{room.roomType.capacity} guests</p>
						</div>

						<div>
							<Label className="text-muted-foreground">Base Price</Label>
							<p className="font-semibold">
								${(room.roomType.basePriceCents / 100).toFixed(2)}/night
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Notes */}
				<Card className="md:col-span-2">
					<CardHeader>
						<CardTitle>Additional Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<Textarea
							id="notes"
							name="notes"
							placeholder="Add any notes about this room..."
							value={formData.notes}
							onChange={handleChange}
							rows={4}
						/>
					</CardContent>
				</Card>

				{/* Submit Button */}
				<div className="md:col-span-2 flex justify-end gap-2">
					<Link href={`/rooms/${roomId}`}>
						<Button variant="outline">Cancel</Button>
					</Link>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}
