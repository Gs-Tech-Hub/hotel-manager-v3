"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTablePrice } from "@/lib/formatters";

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

export default function RoomDetailPage(props: {
	params: Promise<{ id: string }>;
}) {
	const router = useRouter();
	const [room, setRoom] = useState<Room | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isCreatingTask, setIsCreatingTask] = useState(false);
	const [isCreatingRequest, setIsCreatingRequest] = useState(false);
	const [error, setError] = useState<string | null>(null);
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

	const handleCreateCleaningTask = async () => {
		if (!roomId) return;
		setIsCreatingTask(true);
		setError(null);
		try {
			const payload = {
				unitId: roomId,
				taskType: "turnover",
				priority: "NORMAL",
				notes: "Scheduled from room details page",
			};
			console.log('Creating cleaning task with payload:', payload);
			
			const response = await fetch("/api/cleaning/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json();
			console.log('Cleaning task response:', { status: response.status, data });

			if (response.ok && data.success) {
				// Refresh room data to show updated status
				const refreshResponse = await fetch(`/api/rooms/${roomId}`);
				const refreshData = await refreshResponse.json();
				if (refreshData.success) {
					setRoom(refreshData.data);
				}
				setError(null);
			} else {
				const errorMsg = data?.message || "Failed to create cleaning task";
				console.error('Error creating cleaning task:', errorMsg);
				setError(errorMsg);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to create cleaning task";
			console.error('Exception creating cleaning task:', error);
			setError(errorMsg);
		} finally {
			setIsCreatingTask(false);
		}
	};

	const handleCreateMaintenanceRequest = async () => {
		if (!roomId) return;
		setIsCreatingRequest(true);
		setError(null);
		try {
			const payload = {
				unitId: roomId,
				category: "general",
				description: "General maintenance requested from room details page",
				priority: "NORMAL",
			};
			console.log('Creating maintenance request with payload:', payload);
			
			const response = await fetch("/api/maintenance/requests", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json();
			console.log('Maintenance request response:', { status: response.status, data });

			if (response.ok && data.success) {
				// Refresh room data to show updated status
				const refreshResponse = await fetch(`/api/rooms/${roomId}`);
				const refreshData = await refreshResponse.json();
				if (refreshData.success) {
					setRoom(refreshData.data);
				}
				setError(null);
			} else {
				const errorMsg = data?.message || "Failed to create maintenance request";
				console.error('Error creating maintenance request:', errorMsg);
				setError(errorMsg);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to create maintenance request";
			console.error('Exception creating maintenance request:', error);
			setError(errorMsg);
		} finally {
			setIsCreatingRequest(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!room) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">Room not found</p>
				<Link href="/rooms">
					<Button className="mt-4">Back to Rooms</Button>
				</Link>
			</div>
		);
	}

	const statusColors = {
		AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
		OCCUPIED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
		MAINTENANCE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
		CLEANING: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
		BLOCKED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center gap-4">
			<Link href="/rooms">
					<Button variant="outline" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<div className="flex-1">
				<h1 className="text-4xl font-bold tracking-tight">{room.roomType.name}</h1>
					<p className="text-muted-foreground text-lg">
						Room #{room.roomNumber}
					</p>
				</div>
				<div className="flex gap-2">
				<Link href={`/rooms/${room.id}/edit`}>
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
							{error && (
								<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 flex gap-2">
									<p className="text-sm">{error}</p>
								</div>
							)}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground uppercase">
										Status
									</p>
									<Badge className={statusColors[room.status as keyof typeof statusColors]}>
										{room.status.charAt(0).toUpperCase() +
											room.status.slice(1)}
									</Badge>
									<p className="text-xs text-muted-foreground mt-2">
										{room.status === 'CLEANING' && 'Use Cleaning page to complete'}
										{room.status === 'MAINTENANCE' && 'Use Maintenance page to complete'}
										{room.status === 'OCCUPIED' && 'Use checkout from Bookings'}
										{room.status === 'AVAILABLE' && 'Room is ready for booking'}
										{room.status === 'BLOCKED' && 'Contact management to unblock'}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Price per Night
									</p>
									<p className="text-2xl font-bold">
									{formatTablePrice(room.roomType.basePriceCents)}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Capacity
									</p>
									<p className="text-xl font-semibold">
										{room.roomType.capacity}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase">
										Unit Kind
									</p>
									<p className="text-xl font-semibold">
										{room.unitKind}
									</p>
								</div>
								{room.roomType.bedSize && (
									<div className="space-y-1">
										<p className="text-xs text-muted-foreground uppercase">
											Bed Size
										</p>
										<p className="text-lg font-semibold">
											{room.roomType.bedSize}
										</p>
									</div>
								)}
								{room.roomType.roomSizeM2 && (
									<div className="space-y-1">
										<p className="text-xs text-muted-foreground uppercase">
											Room Size
										</p>
										<p className="text-lg font-semibold">
											{room.roomType.roomSizeM2} m²
										</p>
									</div>
								)}
							</div>
							{room.roomType.description && (
								<div className="space-y-1 pt-4 border-t">
									<p className="text-xs text-muted-foreground uppercase">
										Description
									</p>
									<p className="text-muted-foreground">
										{room.roomType.description}
									</p>
								</div>
							)}
							{room.notes && (
								<div className="space-y-1 pt-4 border-t">
									<p className="text-xs text-muted-foreground uppercase">
										Notes
									</p>
									<p className="text-muted-foreground">
										{room.notes}
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
								<TabsTrigger value="maintenance">Maintenance</TabsTrigger>
								<TabsTrigger value="cleaning">Cleaning</TabsTrigger>
							</TabsList>

							<TabsContent value="amenities" className="p-6">
								{room.roomType.amenities && Object.keys(room.roomType.amenities).length > 0 ? (
									<div className="grid grid-cols-2 gap-3">
										{Object.entries(room.roomType.amenities)
											.filter(([, enabled]) => enabled)
											.map(([key]) => (
												<div
													key={key}
													className="p-3 border rounded-lg flex items-center gap-2"
												>
													<div className="h-2 w-2 rounded-full bg-primary" />
													<span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
												</div>
											))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No amenities listed
									</p>
								)}
							</TabsContent>

							<TabsContent value="maintenance" className="p-6">
								<div className="space-y-4">
									{room.status === "MAINTENANCE" ? (
										<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
											<p className="text-sm text-amber-800 font-semibold mb-2">
												🔧 Room is currently under maintenance
											</p>
											<p className="text-xs text-amber-700">
												Go to the Maintenance page to complete the request. Once verified, the room will automatically become available.
											</p>
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											This room is not currently under maintenance.
										</p>
									)}
									<Button 
										className="w-full" 
										variant="outline"
										onClick={handleCreateMaintenanceRequest}
										disabled={isCreatingRequest || room.status === "MAINTENANCE"}
									>
										{isCreatingRequest ? "Creating..." : "+ Create Maintenance Request"}
									</Button>
								</div>
							</TabsContent>

							<TabsContent value="cleaning" className="p-6">
								<div className="space-y-4">
									{room.status === "CLEANING" ? (
										<div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
											<p className="text-sm text-purple-800 font-semibold mb-2">
												🧹 Room is currently being cleaned
											</p>
											<p className="text-xs text-purple-700">
												Go to the Cleaning page to complete the task. Once inspected and approved, the room will automatically become available.
											</p>
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											This room is not currently scheduled for cleaning.
										</p>
									)}
									<Button 
										className="w-full" 
										variant="outline"
										onClick={handleCreateCleaningTask}
										disabled={isCreatingTask || room.status === "CLEANING"}
									>
										{isCreatingTask ? "Scheduling..." : "+ Schedule Cleaning Task"}
									</Button>
								</div>
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
								{formatTablePrice(room.roomType.basePriceCents * 30)}
								</p>
								<p className="text-xs text-muted-foreground">
									(30 nights @ full occupancy)
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Link href={`/rooms/${room.id}/edit`} className="block">
								<Button className="w-full" variant="outline">
									<Edit className="h-4 w-4 mr-2" />
									Edit Details
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
