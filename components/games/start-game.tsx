import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Service = {
  id: string;
  name: string;
  serviceType: string;
  pricingModel: 'per_count' | 'per_time';
  pricePerCount?: number;
  pricePerMinute?: number;
};

interface StartGameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  gameSections: any[]; // Game sections (not game types)
  departmentCode: string;
  sectionCode?: string; // Optional section code (format: department:section)
  defaultSection?: any; // Default section to pre-select
  onGameStarted: (session: any) => void;
}

export function StartGame({
  open,
  onOpenChange,
  customer,
  gameSections = [],
  departmentCode,
  sectionCode,
  defaultSection,
  onGameStarted,
}: StartGameProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [servicesLoading, setServicesLoading] = useState(false);

  // Fetch services for this section
  useEffect(() => {
    if (!defaultSection?.id || !isOpen) return;

    const fetchServices = async () => {
      setServicesLoading(true);
      try {
        const response = await fetch(`/api/services/by-section/${defaultSection.id}`);
        if (response.ok) {
          const data = await response.json();
          setServices(data.data?.services || []);
        }
      } catch (error) {
        console.error('Failed to load services:', error);
      } finally {
        setServicesLoading(false);
      }
    };

    fetchServices();
  }, [defaultSection?.id, isOpen]);

  // Since sections are now game type identifiers, we use the section ID as gameTypeId
  // No need to fetch separately
  const handleStartGame = async () => {
    if (!defaultSection?.id) {
      setError('Game section data not loaded. Please wait...');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // departmentCode is already in the format "parent:section" or just "parent"
      // If it contains a colon, use it as-is; otherwise append the section ID
      const sectionCode = departmentCode.includes(':') 
        ? departmentCode 
        : `${departmentCode}:${defaultSection.slug || defaultSection.id}`;
      
      // Section name is the game type identifier - only pass customerId and optional serviceId
      const response = await fetch(`/api/departments/${sectionCode}/games/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          serviceId: selectedService || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to start game');
        return;
      }

      onGameStarted(data.data.session);
      setIsOpen(false);
      setSelectedService(''); // Reset service selection
    } catch (err) {
      setError('An error occurred while starting the game');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceData = services.find(s => s.id === selectedService);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Game for {customer.firstName} {customer.lastName}</DialogTitle>
          <DialogDescription>
            Configure game settings and pricing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Game Section</label>
            {defaultSection?.id ? (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200">
                ✓ Selected: <span className="font-semibold">{defaultSection.name}</span>
              </div>
            ) : (
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700 border border-yellow-200">
                Loading section data...
              </div>
            )}
          </div>

          {/* Service Selection */}
          {!servicesLoading && services.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Service / Pricing (Optional)</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full p-2 border rounded text-sm"
              >
                <option value="">No service (manual pricing)</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.pricingModel === 'per_count' 
                      ? `${service.pricePerCount}/game` 
                      : `${service.pricePerMinute}/min`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service Info Display */}
          {selectedServiceData && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-semibold text-blue-900">{selectedServiceData.name}</p>
              <p className="text-xs text-blue-700 mt-1">
                {selectedServiceData.pricingModel === 'per_count' 
                  ? `Price: ${selectedServiceData.pricePerCount}/game` 
                  : `Price: ${selectedServiceData.pricePerMinute}/minute`}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Pricing will be calculated at checkout based on game count
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleStartGame} disabled={loading || !defaultSection?.id}>
              {loading ? 'Starting...' : 'Start Game'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
