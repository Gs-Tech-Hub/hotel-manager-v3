/**
 * Availability Search Component
 * Allows filtering by date range, unit type, capacity
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AvailabilitySearchProps {
  onSearch: (params: {
    checkInDate: string;
    checkOutDate: string;
    unitKind?: string;
    capacity?: number;
  }) => void;
  isLoading?: boolean;
}

export function AvailabilitySearch({
  onSearch,
  isLoading = false,
}: AvailabilitySearchProps) {
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [unitKind, setUnitKind] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('');

  const handleSearch = () => {
    if (!checkInDate || !checkOutDate) {
      alert('Please select check-in and check-out dates');
      return;
    }

    onSearch({
      checkInDate,
      checkOutDate,
      unitKind: unitKind || undefined,
      capacity: capacity ? parseInt(capacity) : undefined,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-6 bg-card">
      <h2 className="text-xl font-semibold">Find Available Units</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Check-In</label>
          <Input
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Check-Out</label>
          <Input
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Unit Type</label>
          <Select value={unitKind} onValueChange={setUnitKind} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any type</SelectItem>
              <SelectItem value="ROOM">Room</SelectItem>
              <SelectItem value="SUITE">Suite</SelectItem>
              <SelectItem value="APARTMENT">Apartment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Capacity</label>
          <Select value={capacity} onValueChange={setCapacity} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Any capacity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any capacity</SelectItem>
              <SelectItem value="1">1 Guest</SelectItem>
              <SelectItem value="2">2 Guests</SelectItem>
              <SelectItem value="4">4 Guests</SelectItem>
              <SelectItem value="6">6+ Guests</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSearch} disabled={isLoading} className="w-full md:w-auto">
        {isLoading ? 'Searching...' : 'Search Available Units'}
      </Button>
    </div>
  );
}
