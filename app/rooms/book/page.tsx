/**
 * Public Room Booking Page
 * Search, select, and book rooms
 */

'use client';

import { useState } from 'react';
import { AvailabilitySearch } from '@/components/rooms/AvailabilitySearch';
import { UnitCard } from '@/components/rooms/UnitCard';
import { ReservationForm } from '@/components/rooms/ReservationForm';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface AvailableUnit {
  unit: {
    id: string;
    roomNumber: string;
    unitKind: string;
    roomType: {
      name: string;
      capacity: number;
      amenities?: Record<string, boolean>;
      description?: string;
    };
  };
  pricePerNightCents: number;
  totalCents: number;
  nights: number;
}

interface BookingStep {
  search: boolean;
  select: boolean;
  guestInfo: boolean;
  confirm: boolean;
}

export default function BookingPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>({
    search: true,
    select: false,
    guestInfo: false,
    confirm: false,
  });

  const [availableUnits, setAvailableUnits] = useState<AvailableUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<AvailableUnit | null>(null);
  const [searchParams, setSearchParams] = useState({
    checkInDate: '',
    checkOutDate: '',
  });
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (params: {
    checkInDate: string;
    checkOutDate: string;
    unitKind?: string;
    capacity?: number;
  }) => {
    try {
      setIsSearching(true);

      const queryParams = new URLSearchParams({
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        ...(params.unitKind && { unitKind: params.unitKind }),
        ...(params.capacity && { capacity: String(params.capacity) }),
      });

      const response = await fetch(`/api/availability?${queryParams}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setAvailableUnits(data.data?.availability || []);
      setSearchParams({
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
      });

      setStep({
        search: true,
        select: true,
        guestInfo: false,
        confirm: false,
      });

      if (data.data?.availability?.length === 0) {
        toast({
          title: 'No availability',
          description: 'No rooms available for the selected dates. Please try different dates.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUnit = (unit: AvailableUnit) => {
    setSelectedUnit(unit);
    setStep({
      search: true,
      select: true,
      guestInfo: true,
      confirm: false,
    });
  };

  const handleBook = async (data: {
    unitId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notes?: string;
  }) => {
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: data.unitId,
          checkInDate: searchParams.checkInDate,
          checkOutDate: searchParams.checkOutDate,
          source: 'web',
          notes: data.notes,
          guest: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Booking failed');
      }

      const result = await response.json();

      toast({
        title: 'Booking confirmed!',
        description: `Confirmation number: ${result.data.confirmation?.confirmationNo}`,
      });

      setStep({
        search: true,
        select: true,
        guestInfo: true,
        confirm: true,
      });

      // Reset after success
      setTimeout(() => {
        setAvailableUnits([]);
        setSelectedUnit(null);
        setStep({
          search: true,
          select: false,
          guestInfo: false,
          confirm: false,
        });
      }, 2000);
    } catch (error) {
      toast({
        title: 'Booking failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Find Your Perfect Room</h1>
          <p className="text-lg text-muted-foreground">
            Search, select, and book your stay today
          </p>
        </div>

        {/* Step 1: Search */}
        {step.search && (
          <AvailabilitySearch onSearch={handleSearch} isLoading={isSearching} />
        )}

        {/* Step 2: Select Unit */}
        {step.select && availableUnits.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Available Units</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableUnits.map((unit) => (
                <UnitCard
                  key={unit.unit.id}
                  availableUnit={unit}
                  onBook={() => handleSelectUnit(unit)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Guest Info */}
        {step.guestInfo && selectedUnit && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Selected Unit</h2>
              <UnitCard
                availableUnit={selectedUnit}
                onBook={() => {}}
                isLoading={true}
              />
            </div>
            <ReservationForm
              unitId={selectedUnit.unit.id}
              unitNumber={selectedUnit.unit.roomNumber}
              checkInDate={searchParams.checkInDate}
              checkOutDate={searchParams.checkOutDate}
              totalCents={selectedUnit.totalCents}
              onSubmit={handleBook}
            />
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step.confirm && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                ✅ Booking Confirmed!
              </h3>
              <p className="text-green-800 mb-4">
                A confirmation email has been sent to your inbox
              </p>
              <p className="text-sm text-green-700">
                Redirecting to home page...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
