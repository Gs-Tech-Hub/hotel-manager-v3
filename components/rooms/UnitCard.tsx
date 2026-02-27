/**
 * Unit Card Component
 * Displays a room/suite/apartment card with pricing and booking button
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnitKind } from '@prisma/client';
import { formatTablePrice } from '@/lib/formatters';

export interface AvailableUnit {
  unit: {
    id: string;
    roomNumber: string;
    unitKind: UnitKind | string;
    roomType: {
      name: string;
      capacity: number;
      imageUrl?: string;
      amenities?: Record<string, boolean>;
      description?: string;
    };
  };
  pricePerNightCents: number;
  totalCents: number;
  nights: number;
}

export interface UnitCardProps {
  availableUnit: AvailableUnit;
  onBook: (unitId: string) => void;
  isLoading?: boolean;
}

export function UnitCard({ availableUnit, onBook, isLoading = false }: UnitCardProps) {
  const { unit, pricePerNightCents, totalCents, nights } = availableUnit;

  const amenityList = unit.roomType.amenities
    ? Object.entries(unit.roomType.amenities)
        .filter(([, value]) => value)
        .map(([key]) => key.replace(/_/g, ' '))
    : [];

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      {unit.roomType.imageUrl && (
        <div className="w-full h-48 overflow-hidden bg-muted">
          <img
            src={unit.roomType.imageUrl}
            alt={unit.roomType.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Room {unit.roomNumber}</CardTitle>
            <CardDescription>
              {unit.roomType.name} • {unit.unitKind}
            </CardDescription>
          </div>
          <Badge variant="outline">
            Capacity: {unit.roomType.capacity}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {unit.roomType.description && (
          <p className="text-sm text-muted-foreground">{unit.roomType.description}</p>
        )}

        {amenityList.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Amenities</h4>
            <div className="flex flex-wrap gap-2">
              {amenityList.map((amenity) => (
                <Badge key={amenity} variant="secondary" className="capitalize">
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Price per night</span>
            <span className="font-medium">{formatTablePrice(pricePerNightCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Number of nights</span>
            <span className="font-medium">{nights}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatTablePrice(totalCents)}</span>
          </div>
        </div>

        <Button
          onClick={() => onBook(unit.id)}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Booking...' : 'Book Now'}
        </Button>
      </CardContent>
    </Card>
  );
}
