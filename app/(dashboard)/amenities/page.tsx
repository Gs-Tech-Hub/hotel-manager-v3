"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Edit, Trash2, AlertCircle } from "lucide-react";
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

interface Amenity {
	id: string;
	name: string;
	description?: string;
	icon?: string;
	createdAt: string;
}

export default function AmenitiesPage() {
	const [amenities, setAmenities] = useState<Amenity[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		fetchAmenities();
	}, []);

	const fetchAmenities = async () => {
		setIsLoading(true);
		try {
			const res = await fetch("/api/amenities");
			const data = await res.json();

			if (res.ok) {
				setAmenities(data.data || []);
				setError(null);
			} else {
				setError(data?.message || "Failed to load amenities");
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
			const res = await fetch(`/api/amenities/${deleteId}`, {
				method: "DELETE",
			});

			const data = await res.json();

			if (res.ok) {
				setAmenities(amenities.filter((a) => a.id !== deleteId));
				setDeleteId(null);
				setError(null);
			} else {
				setError(data?.message || "Failed to delete amenity");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
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

	return (
		<div className="space-y-8">
			<div className="flex justify-between items-start">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Amenities</h1>
					<p className="text-muted-foreground">Create and manage room amenities</p>
				</div>
				<Link href="/amenities/new">
					<Button>
						<Plus className="h-4 w-4 mr-2" />
						New Amenity
					</Button>
				</Link>
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
					<CardTitle>Available Amenities</CardTitle>
				</CardHeader>
				<CardContent>
					{amenities.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<p className="mb-4">No amenities yet. Create your first one!</p>
							<Link href="/amenities/new">
								<Button>Create Amenity</Button>
							</Link>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Description</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{amenities.map((amenity) => (
									<TableRow key={amenity.id}>
										<TableCell className="font-medium">{amenity.name}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{amenity.description || "—"}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Link href={`/amenities/${amenity.id}/edit`}>
													<Button size="sm" variant="outline">
														<Edit className="h-4 w-4" />
													</Button>
												</Link>
												<Button
													size="sm"
													variant="destructive"
													onClick={() => setDeleteId(amenity.id)}
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
						<AlertDialogTitle>Delete Amenity</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this amenity? This action cannot be undone.
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
