"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Room {
	id: string;
	name: string;
	roomNumber: string;
	status: "available" | "occupied" | "maintenance";
	price: number;
	capacity: number;
	description?: string;
}

export default function RoomEditPage(props: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const [room, setRoom] = useState<Room | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [formData, setFormData] = useState<Room | null>(null);
	const [roomId, setRoomId] = useState<string | null>(null);

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
					setRoom(data.data);
					setFormData(data.data);
				}
			} catch (error) {
				console.error("Failed to fetch room:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchRoom();
	}, [roomId]);

	const handleChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>
	) => {
		if (!formData) return;

		const { name, value } = e.target;
		setFormData({
			...formData,
			[name]:
				name === "price" || name === "capacity"
					? Number(value)
					: value,
		});
	};

	const handleSelectChange = (value: string) => {
		if (!formData) return;
		setFormData({ ...formData, status: value as Room["status"] });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData) return;

		setIsSaving(true);
		try {
			const response = await fetch(`/api/rooms/${roomId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				router.push(`/dashboard/rooms/${roomId}`);
			}
		} catch (error) {
			console.error("Failed to update room:", error);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!room || !formData) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">Room not found</p>
				<Link href="/dashboard/rooms">
					<Button className="mt-4">Back to Rooms</Button>
				</Link>
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
						{room.name} (Room #{room.roomNumber})
					</p>
				</div>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit}>
				<div className="grid gap-6">
					{/* Basic Info */}
					<Card>
						<CardHeader>
							<CardTitle>Basic Information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="name">Room Name</Label>
									<Input
										id="name"
										name="name"
										value={formData.name}
										onChange={handleChange}
										placeholder="e.g., Deluxe Suite"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="roomNumber">Room Number</Label>
									<Input
										id="roomNumber"
										name="roomNumber"
										value={formData.roomNumber}
										onChange={handleChange}
										placeholder="e.g., 101"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="capacity">Capacity (Guests)</Label>
									<Input
										id="capacity"
										name="capacity"
										type="number"
										value={formData.capacity}
										onChange={handleChange}
										min="1"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="price">
										Price per Night (cents)
									</Label>
									<Input
										id="price"
										name="price"
										type="number"
										value={formData.price}
										onChange={handleChange}
										min="0"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="status">Status</Label>
								<Select
									value={formData.status}
									onValueChange={handleSelectChange}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="available">
											Available
										</SelectItem>
										<SelectItem value="occupied">
											Occupied
										</SelectItem>
										<SelectItem value="maintenance">
											Maintenance
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									name="description"
									value={formData.description || ""}
									onChange={handleChange}
									placeholder="Add a description for this room..."
									rows={4}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Actions */}
					<div className="flex gap-2 justify-end">
						<Link href={`/dashboard/rooms/${room.id}`}>
							<Button variant="outline">Cancel</Button>
						</Link>
						<Button disabled={isSaving}>
							{isSaving ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
