"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

interface Amenity {
	id: string;
	name: string;
	description?: string;
	icon?: string;
}

export default function NewRoomTypePage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [amenitiesList, setAmenitiesList] = useState<Amenity[]>([]);

	const [formData, setFormData] = useState({
		name: "",
		code: "",
		description: "",
		capacity: 1,
		bedSize: "",
		roomSizeM2: "",
		basePriceCents: 0,
	});

	const [selectedAmenities, setSelectedAmenities] = useState<Record<string, boolean>>({});

	// Fetch amenities from API
	useEffect(() => {
		const fetchAmenities = async () => {
			setIsLoading(true);
			try {
				const res = await fetch("/api/amenities");
				const data = await res.json();

				if (res.ok) {
					setAmenitiesList(data.data || []);
				}
			} catch (err) {
				console.error("Failed to fetch amenities:", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchAmenities();
	}, []);

	const handleAmenityChange = (amenityId: string) => {
		setSelectedAmenities((prev) => ({
			...prev,
			[amenityId]: !prev[amenityId],
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name || !formData.code) {
			setError("Name and code are required");
			return;
		}

		setIsSaving(true);
		try {
			const res = await fetch("/api/room-types", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					code: formData.code.toLowerCase(),
					description: formData.description,
					capacity: Number(formData.capacity),
					basePriceCents: Math.round(Number(formData.basePriceCents) * 100),
					amenities: selectedAmenities,
				}),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				router.push("/room-types");
			} else {
				setError(data?.message || "Failed to create room type");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-8">
			<Link href="/room-types">
				<Button variant="outline" size="sm">
					<ChevronLeft className="h-4 w-4 mr-2" />
					Back to Room Types
				</Button>
			</Link>

			<div>
				<h1 className="text-3xl font-bold tracking-tight">Create Room Type</h1>
				<p className="text-muted-foreground">Define a new room type category for your hotel</p>
			</div>

			{error && (
				<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-8">
				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<Label htmlFor="name">Room Type Name *</Label>
								<Input
									id="name"
									placeholder="e.g., Deluxe Room, Presidential Suite"
									value={formData.name}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, name: e.target.value }))
									}
									required
								/>
							</div>

							<div>
								<Label htmlFor="code">Code *</Label>
								<Input
									id="code"
									placeholder="e.g., deluxe, pres-suite"
									value={formData.code}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											code: e.target.value.toLowerCase().replace(/\s+/g, "-"),
										}))
									}
									required
								/>
							</div>

							<div>
								<Label htmlFor="capacity">Guest Capacity *</Label>
								<Input
									id="capacity"
									type="number"
									min="1"
									value={formData.capacity}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											capacity: Number(e.target.value),
										}))
									}
									required
								/>
							</div>

							<div>
								<Label htmlFor="bedSize">Bed Size</Label>
								<Input
									id="bedSize"
									placeholder="e.g., Queen, Twin, King, Double"
									value={formData.bedSize}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											bedSize: e.target.value,
										}))
									}
								/>
							</div>

							<div>
								<Label htmlFor="roomSizeM2">Room Size (m²)</Label>
								<Input
									id="roomSizeM2"
									type="number"
									min="1"
									placeholder="e.g., 25, 50"
									value={formData.roomSizeM2}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											roomSizeM2: e.target.value,
										}))
									}
								/>
							</div>

							<div>
								<Label htmlFor="price">Base Price per Night ($) *</Label>
								<Input
									id="price"
									type="number"
									min="0"
									step="0.01"
									value={formData.basePriceCents / 100}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											basePriceCents: Math.round(Number(e.target.value) * 100),
										}))
									}
									required
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								placeholder="Describe this room type for guests..."
								value={formData.description}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, description: e.target.value }))
								}
								rows={3}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Amenities */}
				<Card>
					<CardHeader>
						<CardTitle>Amenities</CardTitle>
						<p className="text-sm text-muted-foreground">Select which amenities are included in this room type</p>
					</CardHeader>
					<CardContent className="space-y-6">
						{amenitiesList.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								<p className="mb-4">No amenities available yet.</p>
								<Link href="/amenities/new">
									<Button variant="outline" size="sm">
										Create First Amenity
									</Button>
								</Link>
							</div>
						) : (
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
								{amenitiesList.map((amenity) => (
									<div key={amenity.id} className="flex items-center space-x-2">
										<Checkbox
											id={amenity.id}
											checked={selectedAmenities[amenity.id] || false}
											onCheckedChange={() => handleAmenityChange(amenity.id)}
										/>
										<Label htmlFor={amenity.id} className="cursor-pointer text-sm">
											{amenity.name}
										</Label>
									</div>
								))}
							</div>
						)}
						<div className="pt-4 border-t">
							<Link href="/amenities/new">
								<Button variant="outline" size="sm">
									Create New Amenity
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Summary */}
				<Card className="bg-muted/50">
					<CardHeader>
						<CardTitle className="text-base">Summary</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Room Type:</span>
							<span className="font-semibold">{formData.name || "—"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Capacity:</span>
							<span className="font-semibold">{formData.capacity} guests</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Base Price:</span>
							<span className="font-semibold">${(formData.basePriceCents / 100).toFixed(2)}/night</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Amenities:</span>
							<span className="font-semibold">
								{Object.values(selectedAmenities).filter(Boolean).length} selected
							</span>
						</div>
					</CardContent>
				</Card>

				{/* Actions */}
				<div className="flex gap-3">
					<Link href="/room-types" className="flex-1">
						<Button variant="outline" className="w-full">
							Cancel
						</Button>
					</Link>
					<Button type="submit" disabled={isSaving} className="flex-1">
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							"Create Room Type"
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}
