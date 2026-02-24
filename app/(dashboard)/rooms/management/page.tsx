/**
 * Room management interface for front desk/manager to handle check-ins, check-outs, and room status
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  LogOut,
  AlertCircle,
  Wrench,
  Lock,
  Loader,
  X,
} from 'lucide-react';

interface Room {
  id: string;
  roomNumber: string;
  status: string;
  roomType: {
    name: string;
  };
  reservations?: Array<{
    id: string;
    guest: {
      firstName: string;
      lastName: string;
    };
    status: string;
    checkOutDate: string;
  }>;
}

interface CleaningRoutine {
  id: string;
  name: string;
  code: string;
  type: string;
  frequency: string;
}

const statusColors = {
  AVAILABLE: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-blue-100 text-blue-800',
  CLEANING: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-orange-100 text-orange-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

const statusIcons = {
  AVAILABLE: '✓',
  OCCUPIED: '👤',
  CLEANING: '🧹',
  MAINTENANCE: '🔧',
  BLOCKED: '🚫',
};

export default function RoomManagementPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [routines, setRoutines] = useState<CleaningRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [checkoutForm, setCheckoutForm] = useState({
    cleaningRoutineId: '',
    cleaningPriority: 'NORMAL',
    assignCleanerTo: '',
    checkoutNotes: '',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'AVAILABLE',
    reason: '',
    notes: '',
  });

  // Fetch rooms and routines
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [roomsRes, routinesRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/cleaning-routines'),
      ]);

      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data.data || []);
      }

      if (routinesRes.ok) {
        const data = await routinesRes.json();
        setRoutines(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedRoom) return;

    // Find the active reservation
    const activeReservation = selectedRoom.reservations?.find(
      (r) => r.status === 'CHECKED_IN'
    );

    if (!activeReservation) {
      alert('No active reservation for this room');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/reservations/${activeReservation.id}/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutForm),
        }
      );

      if (response.ok) {
        await fetchData();
        setShowCheckoutDialog(false);
        setSelectedRoom(null);
        setCheckoutForm({
          cleaningRoutineId: '',
          cleaningPriority: 'NORMAL',
          assignCleanerTo: '',
          checkoutNotes: '',
        });
        alert('Guest checked out successfully. Cleaning task created.');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing checkout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedRoom) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/rooms/${selectedRoom.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusForm),
      });

      if (response.ok) {
        await fetchData();
        setShowStatusDialog(false);
        setSelectedRoom(null);
        setStatusForm({
          status: 'AVAILABLE',
          reason: '',
          notes: '',
        });
        alert('Room status updated');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating room status');
    } finally {
      setActionLoading(false);
    }
  };

  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE').length;
  const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const cleaningRooms = rooms.filter((r) => r.status === 'CLEANING').length;
  const maintenanceRooms = rooms.filter((r) => r.status === 'MAINTENANCE').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Room Management</h1>
        <p className="text-gray-600">
          Check guest checkout and manage room status
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-3xl font-bold text-green-600">{availableRooms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Occupied</p>
              <p className="text-3xl font-bold text-blue-600">{occupiedRooms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Cleaning</p>
              <p className="text-3xl font-bold text-yellow-600">{cleaningRooms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Maintenance</p>
              <p className="text-3xl font-bold text-orange-600">{maintenanceRooms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-3xl font-bold">{rooms.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-4 gap-4">
        {rooms.map((room) => {
          const activeReservation = room.reservations?.find(
            (r) => r.status === 'CHECKED_IN'
          );

          return (
            <Card
              key={room.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedRoom(room)}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{room.roomNumber}</h3>
                    <span className="text-xl">{statusIcons[room.status as keyof typeof statusIcons]}</span>
                  </div>
                  <p className="text-sm text-gray-600">{room.roomType.name}</p>
                  <Badge
                    className={
                      statusColors[room.status as keyof typeof statusColors]
                    }
                  >
                    {room.status}
                  </Badge>

                  {activeReservation && (
                    <div className="bg-blue-50 p-2 rounded text-sm">
                      <p className="font-semibold">
                        {activeReservation.guest.firstName}{' '}
                        {activeReservation.guest.lastName}
                      </p>
                      <p className="text-xs text-gray-600">
                        Check-out:{' '}
                        {new Date(activeReservation.checkOutDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {room.status === 'OCCUPIED' && activeReservation && (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                        setShowCheckoutDialog(true);
                      }}
                    >
                      <LogOut className="w-3 h-3" />
                      Checkout
                    </Button>
                  )}

                  {room.status !== 'OCCUPIED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                        setStatusForm({ status: room.status, reason: '', notes: '' });
                        setShowStatusDialog(true);
                      }}
                    >
                      Change Status
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Checkout</DialogTitle>
            <DialogDescription>
              Room {selectedRoom?.roomNumber} - Complete guest checkout and create
              cleaning task
            </DialogDescription>
          </DialogHeader>

          {selectedRoom && (
            <div className="space-y-4">
              <div>
                <Label>Cleaning Routine (optional)</Label>
                <Select
                  value={checkoutForm.cleaningRoutineId}
                  onValueChange={(value) =>
                    setCheckoutForm((prev) => ({ ...prev, cleaningRoutineId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-select turnover routine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    {routines
                      .filter((r) => r.type === 'TURNOVER')
                      .map((routine) => (
                        <SelectItem key={routine.id} value={routine.id}>
                          {routine.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Cleaning Priority</Label>
                <Select
                  value={checkoutForm.cleaningPriority}
                  onValueChange={(value) =>
                    setCheckoutForm((prev) => ({ ...prev, cleaningPriority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Special Instructions</Label>
                <Textarea
                  value={checkoutForm.checkoutNotes}
                  onChange={(e) =>
                    setCheckoutForm((prev) => ({
                      ...prev,
                      checkoutNotes: e.target.value,
                    }))
                  }
                  placeholder="Any special cleaning instructions for this room?"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCheckout}
                  disabled={actionLoading}
                  className="gap-1"
                >
                  {actionLoading && <Loader className="w-4 h-4 animate-spin" />}
                  Complete Checkout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCheckoutDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Room Status</DialogTitle>
            <DialogDescription>
              Update status for room {selectedRoom?.roomNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedRoom && (
            <div className="space-y-4">
              <div>
                <Label>New Status</Label>
                <Select
                  value={statusForm.status}
                  onValueChange={(value) =>
                    setStatusForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  value={statusForm.reason}
                  onChange={(e) =>
                    setStatusForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Why are you changing the status?"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={statusForm.notes}
                  onChange={(e) =>
                    setStatusForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Additional notes"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleChangeStatus}
                  disabled={actionLoading}
                  className="gap-1"
                >
                  {actionLoading && <Loader className="w-4 h-4 animate-spin" />}
                  Update Status
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowStatusDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
