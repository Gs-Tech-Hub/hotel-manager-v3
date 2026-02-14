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
import { Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { RegisterPlayer } from './register-player';
import { StartGame } from './start-game';
import { GameCheckout } from './game-checkout';

interface DepartmentGamesProps {
  departmentCode: string;
  departmentId: string;
}

export function DepartmentGames({ departmentCode, departmentId }: DepartmentGamesProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [gameTypes, setGameTypes] = useState<any[]>([]); // Now holds sections
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  // Initialize with a null section, will be populated with real data from fetch
  const [activeSection, setActiveSection] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [startGameOpen, setStartGameOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const apiBase = `/api/departments/${departmentCode}/games`;

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);

      const [customersRes, sessionsRes, sectionRes] = await Promise.all([
        fetch(`${apiBase}/players`),
        fetch(`${apiBase}/sessions?status=active`),
        fetch(`/api/departments/${departmentCode}/section`),
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.data.customers);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setActiveSessions(data.data.sessions);
      }

      // Check if the fetched department is a section or a parent
      if (sectionRes.ok) {
        const data = await sectionRes.json();
        const dept = data.data.department;
        
        // If this is a parent department (_isSection: false), fetch its children
        if (!dept._isSection) {
          const childrenRes = await fetch(`/api/departments/${departmentCode}/children`);
          if (childrenRes.ok) {
            const childrenData = await childrenRes.json();
            // The endpoint returns { data: { departments: [], sections: [] } }
            const sections = childrenData.data.sections || [];
            
            if (sections.length > 0) {
              // Use the first section
              const section = sections[0];
              setActiveSection({
                id: section.id,
                name: section.name,
                slug: section.slug || section.code?.split(':')[1] || section.id,
                code: section.code || `${departmentCode}:${section.id}`,
              });
            } else {
              console.warn('No sections found for department:', departmentCode);
              setActiveSection(null);
            }
          } else {
            console.error('Failed to fetch children:', childrenRes.status);
            setActiveSection(null);
          }
        } else {
          // This is already a section, use it directly
          setActiveSection({
            id: dept.id,
            name: dept.name,
            slug: dept.code.split(':')[1] || dept.id,
            code: dept.code,
          });
        }
      } else {
        setActiveSection(null);
      }
      setGameTypes([]); // Keep empty, not needed
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [departmentCode]);

  const handlePlayerRegistered = () => {
    setRegisterOpen(false);
    fetchData();
  };

  const handleGameStarted = () => {
    setStartGameOpen(false);
    setSelectedCustomer(null);
    fetchData();
  };

  const handleCheckout = (session: any) => {
    setSelectedSession(session);
    setCheckoutOpen(true);
  };

  const handleCheckoutComplete = () => {
    setCheckoutOpen(false);
    setSelectedSession(null);
    fetchData();
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently playing games</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={fetchData}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <p className="text-sm text-gray-500">No active game sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Game Type</TableHead>
                    <TableHead>Games Count</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{`${session.customer.firstName} ${session.customer.lastName}`}</TableCell>
                      <TableCell>{session.section.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.gameCount}</Badge>
                      </TableCell>
                      <TableCell>${Number(session.totalAmount).toFixed(2)}</TableCell>
                      <TableCell>{new Date(session.startedAt).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCheckout(session)}
                        >
                          Checkout
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Registered game players</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setRegisterOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Player
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {filteredCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No customers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>{`${customer.firstName} ${customer.lastName}`}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setStartGameOpen(true);
                          }}
                        >
                          Start Game
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <RegisterPlayer
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        departmentCode={departmentCode}
        onPlayerRegistered={handlePlayerRegistered}
      />

      {selectedCustomer && (
        <StartGame
          open={startGameOpen}
          onOpenChange={setStartGameOpen}
          customer={selectedCustomer}
          gameSections={activeSection ? [activeSection] : []}
          departmentCode={departmentCode}
          defaultSection={activeSection}
          onGameStarted={handleGameStarted}
        />
      )}

      {selectedSession && (
        <GameCheckout
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          session={selectedSession}
          departmentCode={departmentCode}
          onCheckoutComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
}
