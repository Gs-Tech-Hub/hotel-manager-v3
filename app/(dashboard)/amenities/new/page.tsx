"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

const ICON_OPTIONS = [
	"wifi",
	"thermometer",
	"tv",
	"briefcase",
	"wine",
	"lock",
	"mountain",
	"robe",
	"waves",
	"chef",
	"washer",
	"utensils",
	"concierge",
	"user-tie",
	"bath",
	"sofa",
	"bed",
	"door",
	"window",
	"leaf",
];

export default function NewAmenityPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		name: "",
		description: "",
		icon: "",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name) {
			setError("Amenity name is required");
			return;
		}

		setIsLoading(true);
		try {
			const res = await fetch("/api/amenities", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				router.push("/amenities");
			} else {
				setError(data?.message || "Failed to create amenity");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-8">
			<Link href="/amenities">
				<Button variant="outline" size="sm">
					<ChevronLeft className="h-4 w-4 mr-2" />
					Back to Amenities
				</Button>
			</Link>

			<div>
				<h1 className="text-3xl font-bold tracking-tight">Create Amenity</h1>
				<p className="text-muted-foreground">Define a new amenity for room types</p>
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
						<div>
							<Label htmlFor="name">Amenity Name *</Label>
							<Input
								id="name"
								placeholder="e.g., WiFi, Air Conditioning, Minibar"
								value={formData.name}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, name: e.target.value }))
								}
								required
							/>
						</div>

						<div>
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								placeholder="Describe this amenity in detail..."
								value={formData.description}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, description: e.target.value }))
								}
								rows={4}
							/>
						</div>

						<div>
							<Label htmlFor="icon">Icon (Optional)</Label>
							<Input
								id="icon"
								placeholder="e.g., wifi, thermometer, tv"
								value={formData.icon}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, icon: e.target.value }))
								}
								list="icon-suggestions"
							/>
							<datalist id="icon-suggestions">
								{ICON_OPTIONS.map((icon) => (
									<option key={icon} value={icon} />
								))}
							</datalist>
							<p className="text-xs text-muted-foreground mt-2">
								Suggested: wifi, thermometer, tv, briefcase, wine, lock, mountain, robe, waves, chef, washer, utensils
							</p>
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
							<span className="text-muted-foreground">Amenity Name:</span>
							<span className="font-semibold">{formData.name || "—"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Has Description:</span>
							<span className="font-semibold">{formData.description ? "Yes" : "No"}</span>
						</div>
						{formData.icon && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Icon:</span>
								<span className="font-semibold">{formData.icon}</span>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Actions */}
				<div className="flex gap-3">
					<Link href="/amenities" className="flex-1">
						<Button variant="outline" className="w-full">
							Cancel
						</Button>
					</Link>
					<Button type="submit" disabled={isLoading} className="flex-1">
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							"Create Amenity"
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}
