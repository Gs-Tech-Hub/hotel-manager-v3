'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RegisterPlayer } from './register-player';
import { StartGame } from './start-game';
import { GameCheckout } from './game-checkout';
import { Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface GamesDashboardProps {
  departmentCode: string;
}

export function GamesDashboard({ departmentCode }: GamesDashboardProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [gameTypes, setGameTypes] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [gameStartOpen, setGameStartOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [customersRes, typesRes, sessionsRes] = await Promise.all([
          fetch(`/api/departments/${departmentCode}/games/players`),
          fetch(`/api/departments/${departmentCode}/games/types`),
          fetch(`/api/departments/${departmentCode}/games/sessions?status=active`),
        ]);

        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(data.data.customers);
        }

        if (typesRes.ok) {
          const data = await typesRes.json();
          setGameTypes(data.data.gameTypes);
        }

        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setActiveSessions(data.data.sessions);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [departmentCode]);

  const handlePlayerRegistered = (newCustomer: any) => {
    setCustomers([newCustomer, ...customers]);
    toast.success(`Customer ${newCustomer.firstName} registered successfully`);
  };

  const handleGameStarted = (session: any) => {
    setActiveSessions([session, ...activeSessions]);
    toast.success(`Game started for ${session.customer.firstName} ${session.customer.lastName}`);
  };

  const handleIncrementGame = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentCode}/games/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_game' }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveSessions(
          activeSessions.map((s) => (s.id === sessionId ? data.data.session : s))
        );
        toast.success('Game count incremented');
      } else {
        toast.error('Failed to increment game count');
      }
    } catch (error) {
      console.error('Failed to increment game:', error);
      toast.error('An error occurred');
    }
  };

  const handleOpenCheckout = (session: any) => {
    setSelectedSession(session);
    setCheckoutOpen(true);
  };

  const handleCheckoutComplete = (data: any) => {
    // Remove session from active sessions
    setActiveSessions(activeSessions.filter((s) => s.id !== data.session.id));
    toast.success(
      `Order created: ${data.order.message}. Proceed to terminal for payment.`
    );
  };

  const filteredCustomers = customers.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Games Management</h1>
          <p className="text-slate-600">Manage game sessions and player checkout</p>
        </div>
        <RegisterPlayer onPlayerRegistered={handlePlayerRegistered} departmentCode={departmentCode} />
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Active Game Sessions</CardTitle>
            <CardDescription className="text-blue-800">
              {activeSessions.length} customer(s) currently playing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg bg-white p-4"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {session.customer.firstName} {session.customer.lastName}
                    </p>
                    <p className="text-sm text-slate-600">
                      {session.gameType.name} • {session.gameCount} game(s) •
                      Total: ${Number(session.totalAmount).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIncrementGame(session.id)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      +1 Game
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenCheckout(session)}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      Checkout
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customers List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>Total: {filteredCustomers.length} customers</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {loading ? (
              <div className="py-8 text-center text-slate-500">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No customers found. Register a new customer to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Active Session</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => {
                      const activeSession = activeSessions.find(
                        (s) => s.customerId === customer.id
                      );
                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="font-semibold">
                            {customer.firstName} {customer.lastName}
                          </TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>{customer.email || '-'}</TableCell>
                          <TableCell>
                            {activeSession ? (
                              <Badge variant="default">
                                {activeSession.gameType.name} ({activeSession.gameCount})
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!activeSession && (
                              <StartGame
                                open={gameStartOpen}
                                onOpenChange={setGameStartOpen}
                                customer={customer}
                                gameTypes={gameTypes}
                                onGameStarted={handleGameStarted}
                                departmentCode={departmentCode}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checkout Dialog */}
      {selectedSession && (
        <GameCheckout
          session={selectedSession}
          departmentCode={departmentCode}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          onCheckoutComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
}
