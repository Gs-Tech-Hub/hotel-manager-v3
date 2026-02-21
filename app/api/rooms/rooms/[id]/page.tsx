"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Edit, Trash2 } from "lucide-react";

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
		amenities?: Record<string, boolean>;
	};
}

const statusColors: Record<string, string> = {
	AVAILABLE: "bg-green-100 text-green-800",
	OCCUPIED: "bg-blue-100 text-blue-800",
	MAINTENANCE: "bg-amber-100 text-amber-800",
	CLEANING: "bg-purple-100 text-purple-800",
	BLOCKED: "bg-red-100 text-red-800",
};

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
				router.push("/rooms");
			}
		} catch (error) {
			console.error("Failed to delete room:", error);
		} finally {
			setIsDeleting(false);
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
		<div className="space-y-8 pb-12">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/rooms">
					<Button variant="outline" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<div className="flex-1">
					<h1 className="text-3xl font-bold tracking-tight">
						{room.roomType.name}
					</h1>
					<p className="text-muted-foreground">
						Room #{room.roomNumber} • {room.unitKind}
					</p>
				</div>
				<Badge className={statusColors[room.status]}>
					{room.status.charAt(0).toUpperCase() + room.status.slice(1)}
				</Badge>
			</div>

			{/* Main Info */}
			<div className="grid gap-6 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Capacity
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{room.roomType.capacity}</p>
						<p className="text-xs text-muted-foreground">guests</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Price per Night
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">
							${(room.roomType.basePriceCents / 100).toFixed(2)}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Room Size
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">
							{room.roomType.roomSizeM2 || "—"}{room.roomType.roomSizeM2 && "m²"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Details Tabs */}
			<Tabs defaultValue="info" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="info">Information</TabsTrigger>
					<TabsTrigger value="amenities">Amenities</TabsTrigger>
					<TabsTrigger value="maintenance">Maintenance</TabsTrigger>
					<TabsTrigger value="cleaning">Cleaning</TabsTrigger>
				</TabsList>

				{/* Information Tab */}
				<TabsContent value="info" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Room Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div>
								<h3 className="font-semibold mb-2">Description</h3>
								<p className="text-sm text-muted-foreground">
									{room.roomType.description || "No description provided"}
								</p>
							</div>

							{room.roomType.bedSize && (
								<div>
									<h3 className="font-semibold mb-2">Bed Size</h3>
									<p className="text-sm">{room.roomType.bedSize}</p>
								</div>
							)}

							{room.notes && (
								<div>
									<h3 className="font-semibold mb-2">Notes</h3>
									<p className="text-sm text-muted-foreground">{room.notes}</p>
								</div>
							)}

							<div className="pt-4 border-t">
								<Link href={`/rooms/${room.id}/edit`}>
									<Button>
										<Edit className="h-4 w-4 mr-2" />
										Edit Room
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Amenities Tab */}
				<TabsContent value="amenities">
					<Card>
						<CardHeader>
							<CardTitle>Amenities</CardTitle>
						</CardHeader>
						<CardContent>
							{room.roomType.amenities && Object.keys(room.roomType.amenities).length > 0 ? (
								<div className="space-y-3">
									{Object.entries(room.roomType.amenities)
										.filter(([, enabled]) => enabled)
										.map(([key]) => (
											<div key={key} className="flex items-center">
												<Badge variant="secondary" className="capitalize">
													{key.replace(/_/g, " ")}
												</Badge>
											</div>
										))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No amenities configured
								</p>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Maintenance Tab */}
				<TabsContent value="maintenance">
					<Card>
						<CardHeader>
							<CardTitle>Maintenance Requests</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Coming soon: Maintenance tracking for this room
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Cleaning Tab */}
				<TabsContent value="cleaning">
					<Card>
						<CardHeader>
							<CardTitle>Cleaning Tasks</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Coming soon: Cleaning schedule and history for this room
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Actions */}
			<div className="flex gap-2 justify-end">
				<Button
					variant="destructive"
					onClick={handleDelete}
					disabled={isDeleting}
				>
					{isDeleting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Deleting...
						</>
					) : (
						<>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete Room
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
