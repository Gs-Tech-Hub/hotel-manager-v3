"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, AlertCircle } from "lucide-react";
import { formatTablePrice } from "@/lib/formatters";

interface RoomType {
  id: string;
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  capacity: number;
  bedSize?: string | null;
  roomSizeM2?: number | null;
  basePriceCents: number;
  amenities?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

interface Amenity {
  id: string;
  name: string;
  code: string;
  category?: string;
}

export default function EditRoomTypePage(props: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amenitiesList, setAmenitiesList] = useState<Amenity[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    imageUrl: "",
    capacity: 1,
    bedSize: "",
    roomSizeM2: "",
    basePriceCents: 0,
  });

  const [selectedAmenities, setSelectedAmenities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initializeForm = async () => {
      try {
        const { id } = await props.params;
        setRoomTypeId(id);

        // Fetch room type
        const rtRes = await fetch(`/api/room-types/${id}`);
        if (!rtRes.ok) throw new Error("Failed to fetch room type");
        const rtData = await rtRes.json();
        const roomType = rtData.data;

        setFormData({
          name: roomType.name,
          code: roomType.code,
          description: roomType.description || "",
          imageUrl: roomType.imageUrl || "",
          capacity: roomType.capacity,
          bedSize: roomType.bedSize || "",
          roomSizeM2: roomType.roomSizeM2?.toString() || "",
          basePriceCents: roomType.basePriceCents,
        });

        setSelectedAmenities(roomType.amenities || {});

        // Fetch amenities
        const amenRes = await fetch("/api/amenities");
        if (amenRes.ok) {
          const amenData = await amenRes.json();
          setAmenitiesList(amenData.data || []);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load room type");
      } finally {
        setIsLoading(false);
      }
    };

    initializeForm();
  }, [props.params]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "capacity" || name === "roomSizeM2"
          ? value === ""
            ? ""
            : parseInt(value, 10)
          : value,
    }));
  };

  const handleAmenityToggle = (amenityId: string) => {
    setSelectedAmenities((prev) => ({
      ...prev,
      [amenityId]: !prev[amenityId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/room-types/${roomTypeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          basePriceCents: Math.round(Number(formData.basePriceCents) * 100),
          amenities: selectedAmenities,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/room-types");
      } else {
        setError(data?.message || "Failed to update room type");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
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

  return (
    <div className="space-y-8">
      <Link href="/room-types">
        <Button variant="outline" size="sm">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Room Types
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Room Type</h1>
        <p className="text-muted-foreground">Update room type configuration</p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Error</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Room Type Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Deluxe Suite"
                  required
                />
              </div>

              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="e.g., DELUXE"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for this room type
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Room type description..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={handleInputChange}
                placeholder="e.g., https://example.com/images/deluxe-room.jpg"
              />
              {formData.imageUrl && (
                <div className="mt-2 w-32 h-24 rounded border overflow-hidden bg-muted">
                  <img
                    src={formData.imageUrl}
                    alt="Room type preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="capacity">Guest Capacity *</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="bedSize">Bed Size</Label>
                <Input
                  id="bedSize"
                  name="bedSize"
                  value={formData.bedSize}
                  onChange={handleInputChange}
                  placeholder="e.g., King, Queen, Twin"
                />
              </div>

              <div>
                <Label htmlFor="roomSizeM2">Room Size (m²)</Label>
                <Input
                  id="roomSizeM2"
                  name="roomSizeM2"
                  type="number"
                  min="1"
                  value={formData.roomSizeM2}
                  onChange={handleInputChange}
                  placeholder="e.g., 30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="basePriceCents">Base Price per Night *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="basePriceCents"
                  name="basePriceCents"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.basePriceCents}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {formatTablePrice(Math.round(Number(formData.basePriceCents) * 100))}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader>
            <CardTitle>Amenities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {amenitiesList.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {amenitiesList.map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAmenities[amenity.id] || false}
                      onChange={() => handleAmenityToggle(amenity.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{amenity.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No amenities available</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Link href="/room-types">
            <Button type="button" variant="outline">
              Cancel
            </Button>
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
