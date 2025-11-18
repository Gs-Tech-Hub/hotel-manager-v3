"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Edit, Trash2 } from "lucide-react";
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
	amenities?: Array<{ id: string; name: string }>;
	beds?: Array<{ id: string; type: string; size: number }>;
}

export default function RoomDetailPage(props: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const [room, setRoom] = useState<Room | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isDeleting, setIsDeleting] = useState(false);
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
				}
			} catch (error) {
				console.error("Failed to fetch room:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchRoom();
	}, [roomId]);

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this room?")) return;

		setIsDeleting(true);
		try {
			const response = await fetch(`/api/rooms/${roomId}`, {
				method: "DELETE",
			});
			if (response.ok) {
				router.push("/dashboard/rooms");
			}
		} catch (error) {
			console.error("Failed to delete room:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!room) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">Room not found</p>
				<Link href="/dashboard/rooms">
					<Button className="mt-4">Back to Rooms</Button>
				</Link>
			</div>
		);
	}

	const statusColors = {
		available: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
		occupied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
		maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/dashboard/rooms">
					<Button variant="outline" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<div className="flex-1">
					<h1 className="text-4xl font-bold tracking-tight">{room.name}</h1>
					<p className="text-muted-foreground text-lg">
						Room #{room.roomNumber}
					</p>
				</div>
				<div className="flex gap-2">
					<Link href={`/dashboard/rooms/${room.id}/edit`}>
						<Button variant="outline">
							<Edit className="h-4 w-4 mr-2" />
							Edit
						</Button>
					</Link>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeleting}
					>
						<Trash2 className="h-4 w-4 mr-2" />
						{isDeleting ? "Deleting..." : "Delete"}
					</Button>
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				{/* Main Info */}
				<div className="md:col-span-2 space-y-6">
					{/* Status & Pricing Card */}
					<Card>
						<CardHeader>
							<CardTitle>Room Information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Status
									</p>
									<Badge className={statusColors[room.status]}>
										{room.status.charAt(0).toUpperCase() +
											room.status.slice(1)}
									</Badge>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Price per Night
									</p>
									<p className="text-2xl font-bold">
										${(room.price / 100).toFixed(2)}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Capacity
									</p>
									<p className="text-xl font-semibold">
										{room.capacity} guests
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Room Number
									</p>
									<p className="text-xl font-semibold">
										{room.roomNumber}
									</p>
								</div>
							</div>
							{room.description && (
								<div className="space-y-1 pt-4 border-t">
									<p className="text-xs text-muted-foreground uppercase">
										Description
									</p>
									<p className="text-muted-foreground">
										{room.description}
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Tabs */}
					<Card>
						<Tabs defaultValue="amenities">
							<TabsList className="w-full justify-start border-b rounded-none">
								<TabsTrigger value="amenities">Amenities</TabsTrigger>
								<TabsTrigger value="beds">Beds</TabsTrigger>
								<TabsTrigger value="bookings">Bookings</TabsTrigger>
							</TabsList>

							<TabsContent value="amenities" className="p-6">
								{room.amenities && room.amenities.length > 0 ? (
									<div className="grid grid-cols-2 gap-3">
										{room.amenities.map((amenity) => (
											<div
												key={amenity.id}
												className="p-3 border rounded-lg flex items-center gap-2"
											>
												<div className="h-2 w-2 rounded-full bg-primary" />
												<span className="text-sm">{amenity.name}</span>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No amenities listed
									</p>
								)}
							</TabsContent>

							<TabsContent value="beds" className="p-6">
								{room.beds && room.beds.length > 0 ? (
									<div className="space-y-3">
										{room.beds.map((bed) => (
											<div
												key={bed.id}
												className="p-3 border rounded-lg"
											>
												<p className="font-semibold text-sm">
													{bed.type}
												</p>
												<p className="text-xs text-muted-foreground">
													Size: {bed.size}
												</p>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No beds listed
									</p>
								)}
							</TabsContent>

							<TabsContent value="bookings" className="p-6">
								<p className="text-muted-foreground text-sm">
									Booking information coming soon
								</p>
							</TabsContent>
						</Tabs>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Quick Stats */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Quick Stats</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground uppercase">
									Monthly Revenue
								</p>
								<p className="text-2xl font-bold">
									${((room.price / 100) * 30).toFixed(2)}
								</p>
								<p className="text-xs text-muted-foreground">
									(30 nights @ full occupancy)
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Management */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Management</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Button className="w-full" variant="outline">
								Mark as Maintenance
							</Button>
							<Button className="w-full" variant="outline">
								View Bookings
							</Button>
							<Button className="w-full" variant="outline">
								Edit Room
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
