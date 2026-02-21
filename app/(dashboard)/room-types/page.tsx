"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { formatTablePrice } from "@/lib/formatters";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomType {
	id: string;
	name: string;
	code: string;
	capacity: number;
	bedSize?: string | null;
	roomSizeM2?: number | null;
	basePriceCents: number;
	amenities?: Record<string, boolean>;
	createdAt: string;
}

export default function RoomTypesPage() {
	const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		fetchRoomTypes();
	}, []);

	const fetchRoomTypes = async () => {
		setIsLoading(true);
		try {
			const res = await fetch("/api/room-types");
			const data = await res.json();

			if (res.ok) {
				setRoomTypes(data.data || []);
				setError(null);
			} else {
				setError(data?.message || "Failed to load room types");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteId) return;

		setIsDeleting(true);
		try {
			const res = await fetch(`/api/room-types/${deleteId}`, {
				method: "DELETE",
			});

			const data = await res.json();

			if (res.ok) {
				setRoomTypes(roomTypes.filter((rt) => rt.id !== deleteId));
				setDeleteId(null);
				setError(null);
			} else {
				setError(data?.message || "Failed to delete room type");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsDeleting(false);
		}
	};

	const countAmenities = (amenities?: Record<string, boolean>) => {
		return Object.values(amenities || {}).filter(Boolean).length;
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
			<div className="flex justify-between items-start">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Room Types</h1>
					<p className="text-muted-foreground">Create and manage room type categories</p>
				</div>
				<div className="flex gap-2">
					<Link href="/amenities">
						<Button variant="outline">
							Amenities
						</Button>
					</Link>
					<Link href="/room-types/new">
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							New Room Type
						</Button>
					</Link>
				</div>
			</div>

			{error && (
				<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 flex gap-3">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-semibold">Error</p>
						<p className="text-sm">{error}</p>
					</div>
				</div>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Available Room Types</CardTitle>
				</CardHeader>
				<CardContent>
					{roomTypes.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<p className="mb-4">No room types yet. Create your first one!</p>
							<Link href="/room-types/new">
								<Button>Create Room Type</Button>
							</Link>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Code</TableHead>
									<TableHead className="text-center">Capacity</TableHead>
									<TableHead>Bed Size</TableHead>
									<TableHead>Room Size</TableHead>
									<TableHead className="text-right">Base Price</TableHead>
									<TableHead className="text-center">Amenities</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{roomTypes.map((rt) => (
									<TableRow key={rt.id}>
										<TableCell className="font-medium">{rt.name}</TableCell>
										<TableCell className="text-muted-foreground">{rt.code}</TableCell>
										<TableCell className="text-center">{rt.capacity} guests</TableCell>
										<TableCell>{rt.bedSize || "-"}</TableCell>
										<TableCell>{rt.roomSizeM2 ? `${rt.roomSizeM2} m²` : "-"}</TableCell>
									<TableCell className="text-right">{formatTablePrice(rt.basePriceCents)}</TableCell>
										<TableCell className="text-center">{countAmenities(rt.amenities)}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Link href={`/room-types/${rt.id}/edit`}>
													<Button size="sm" variant="outline">
														<Edit className="h-4 w-4" />
													</Button>
												</Link>
												<Button
													size="sm"
													variant="destructive"
													onClick={() => setDeleteId(rt.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Room Type</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this room type? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="flex gap-3 justify-end">
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
