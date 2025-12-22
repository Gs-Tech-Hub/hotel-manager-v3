"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DataTable, TableSearchBar, TableFilterBar, Column } from "@/components/admin/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCents, normalizeToCents, centsToDollars, calculateTax, calculateTotal } from '@/lib/price';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { POSPayment } from "@/components/admin/pos/pos-payment";
import Price from '@/components/ui/Price';

type Order = {
    id: string;
    orderNumber?: string;
    customer?: { name?: string; phone?: string } | null;
    departments?: { department?: { name?: string; code?: string } }[] | null;
    lines?: {
        departmentSectionId?: string | null;
        departmentSection?: {
            name?: string;
            department?: { code?: string; name?: string };
        } | null;
    }[] | null;
    status: string;
    paymentStatus?: string; // unpaid, paid, partial, refunded
    createdAt: string;
    total?: number; // in cents
    totalPaid?: number; // in cents
    amountDue?: number; // calculated
    fulfillments?: any[];
};

export default function PosOrdersPage() {
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState(""); // Fulfillment status (empty = all)
    const [paymentStatusFilter, setPaymentStatusFilter] = useState(""); // Payment status (empty = all)
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [departmentSectionFilter, setDepartmentSectionFilter] = useState("");
    const [departmentsList, setDepartmentsList] = useState<{ code: string; name?: string }[]>([]);
    const [departmentSectionsList, setDepartmentSectionsList] = useState<{ id: string; name?: string; slug?: string }[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    
    // Sorting state
    const [sortField, setSortField] = useState("createdAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // Payment state - using POSPayment component
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
    const [paymentTotalCents, setPaymentTotalCents] = useState(0);
    
    // Add items state
    const [showAddItemsModal, setShowAddItemsModal] = useState(false);
    const [selectedOrderForItems, setSelectedOrderForItems] = useState<Order | null>(null);
    
    const limit = 10;

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({ page: String(page), limit: String(limit) });
                if (search) params.append("search", search);
                // Include status filters only if explicitly set (not using defaults)
                if (statusFilter) params.append("status", statusFilter);
                if (paymentStatusFilter) params.append("paymentStatus", paymentStatusFilter);
                if (departmentFilter) params.append("departmentCode", departmentFilter);
                if (departmentSectionFilter) params.append("departmentSectionId", departmentSectionFilter);
                // Add sorting parameters
                params.append("sortBy", sortField);
                params.append("sortOrder", sortDirection);
                
                const res = await fetch(`/api/orders?${params.toString()}`);
                const data = await res.json();
                if (data.success) {
                    // Calculate amountDue for each order (total - totalPaid, all in cents)
                    const processedOrders = (data.data.items || []).map((order: any) => {
                        // Calculate totalPaid from payments array
                        const totalPaid = (order.payments || []).reduce((sum: number, p: any) => {
                            return sum + (p.amount || 0);
                        }, 0);
                        
                        return {
                            ...order,
                            total: order.total ?? 0, // in cents
                            totalPaid, // calculated in cents
                            amountDue: (order.total ?? 0) - totalPaid, // in cents
                        };
                    });
                    setOrders(processedOrders);
                    setTotal(data.data.meta?.total || 0);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [page, search, statusFilter, paymentStatusFilter, departmentFilter, departmentSectionFilter, sortField, sortDirection, refreshTrigger]);

    // Payment handler - receives from POSPayment component
    const handlePaymentComplete = async (payment: any) => {
        if (!selectedOrderForPayment) return;
        
        try {
            // payment.amount is in cents (isMinor: true)
            const amountCents = payment.isMinor ? payment.amount : normalizeToCents(payment.amount);
            
            const res = await fetch("/api/orders/settle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: selectedOrderForPayment.id,
                    paymentMethod: payment.method,
                    amount: amountCents,
                }),
                credentials: "include",
            });
            
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error?.message || "Payment failed");
            }
            
            // Trigger auto-reload
            setShowPaymentModal(false);
            setSelectedOrderForPayment(null);
            setRefreshTrigger(t => t + 1);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Payment failed");
        }
    };

    // Add items handler - routes to originating section terminal to maintain inventory integrity
    const handleAddItems = async () => {
        if (!selectedOrderForItems) return;
        
        try {
            // Get originating section ID from first line
            const firstLine = selectedOrderForItems.lines?.[0];
            if (!firstLine?.departmentSectionId) {
                throw new Error("Cannot determine order origin section");
            }
            
            const sectionId = firstLine.departmentSectionId;
            console.log('[Orders] Adding items - section ID:', sectionId);
            
            // Fetch terminals to find the one matching this section ID
            const res = await fetch('/api/pos/terminals', { credentials: 'include' });
            const json = await res.json();
            
            if (!json?.success || !Array.isArray(json.data)) {
                throw new Error("Failed to load terminals");
            }
            
            console.log('[Orders] Available terminals:', json.data);
            
            // Find the terminal (section) matching this ID
            const foundTerminal = json.data.find((t: any) => t.id === sectionId);
            console.log('[Orders] Found terminal:', foundTerminal);
            
            if (!foundTerminal) {
                throw new Error("Terminal not found");
            }
            
            // Get slug - generate from name if not set in DB
            let slug = foundTerminal.slug;
            if (!slug && foundTerminal.name) {
                slug = foundTerminal.name
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9\-]/g, '');
                console.log('[Orders] Generated slug from name:', slug);
            }
            
            if (!slug) {
                throw new Error("Cannot generate terminal route - missing name or slug");
            }
            
            // Route to section terminal with order context using proper slug-based route
            // Format: /pos-terminals/{slug}/checkout?terminal={terminalId}&addToOrder={orderId}
            const targetUri = `/pos-terminals/${encodeURIComponent(slug)}/checkout?terminal=${sectionId}&addToOrder=${selectedOrderForItems.id}`;
            console.log('[Orders] Navigating to:', targetUri);
            window.location.href = targetUri;
        } catch (error) {
            console.error('[Orders] Error adding items:', error);
            alert(error instanceof Error ? error.message : "Failed to route to terminal");
        }
    };

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await fetch(`/api/departments?limit=200`);
                const data = await res.json();
                if (data?.success) {
                    const list = (data.data?.items || []).map((d: any) => ({ code: d.code, name: d.name }));
                    setDepartmentsList(list);
                }
            } catch (err) {
                console.error("Failed to load departments", err);
            }
        };

        const fetchDepartmentSections = async () => {
            try {
                const res = await fetch(`/api/departments/sections?limit=500`);
                const data = await res.json();
                if (data?.success) {
                    const list = (data.data || []).map((s: any) => ({ 
                        id: s.id, 
                        name: s.name,
                        slug: s.slug
                    }));
                    setDepartmentSectionsList(list);
                }
            } catch (err) {
                console.error("Failed to load department sections", err);
            }
        };

        fetchDepartments();
        fetchDepartmentSections();
    }, []);

    const columns = useMemo<Column<Order>[]>(
        () => [
            { key: "orderNumber", label: "Order #", sortable: true, width: "w-20", render: (v) => String(v).slice(-8) },
            {
                key: "customer",
                label: "Customer",
                render: (_v, item) => item.customer?.name || "Guest",
                width: "w-32",
            },
            {
                key: "departments",
                label: "Department / Section",
                render: (_v, item) => {
                    // Get unique sections from lines
                    const sections = (item.lines || [])
                        .filter((l: any) => l.departmentSection?.name)
                        .map((l: any) => ({ name: l.departmentSection?.name, deptCode: l.departmentSection?.department?.code }))
                        .filter((v: any, i: number, a: any) => a.findIndex((x: any) => x.name === v.name) === i);
                    
                    // Format: "DeptCode: Section1, Section2"
                    if (sections.length > 0) {
                        const groupedByDept = sections.reduce((acc: any, s: any) => {
                            const key = s.deptCode || 'Unknown';
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(s.name);
                            return acc;
                        }, {});
                        
                        const display = Object.entries(groupedByDept)
                            .map(([deptCode, names]: any) => `${deptCode}: ${names.join(", ")}`)
                            .join(" | ");
                        return <span className="text-xs font-medium">{display || "-"}</span>;
                    }
                    
                    // Fallback to departments if no sections
                    const deptNames = (item.departments || []).map((d: any) => d?.department?.name).filter(Boolean);
                    return <span className="text-xs font-medium">{deptNames.join(", ") || "-"}</span>;
                },
                width: "w-48",
            },
            {
                key: "createdAt",
                label: "Created",
                render: (v) => {
                    const date = new Date(String(v));
                    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                },
                width: "w-28",
                sortable: true,
            },
            {
                key: "total",
                label: "Total",
                render: (_v, item) => formatCents(item.total ?? 0, undefined, 'NGN'),
                width: "w-24",
            },

            {
                key: "status",
                label: "Fulfillment",
                render: (v) => {
                    const s = String(v || "pending");
                    const cls =
                        s === "pending"
                            ? "bg-slate-100 text-slate-800"
                            : s === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : s === "fulfilled"
                            ? "bg-green-100 text-green-800"
                            : s === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : s === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800";
                    return <Badge className={cls}>{s}</Badge>;
                },
                width: "w-28",
            },
            {
                key: "amountDue",
                label: "Due",
                render: (_v, item) => {
                    const due = item.amountDue ?? (item.total ?? 0);
                    const isPaid = due <= 0;
                    return (
                        <span className={isPaid ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {isPaid ? "✓ Paid" : formatCents(due, undefined, 'NGN')}
                        </span>
                    );
                },
                width: "w-28",
            },
            {
                key: "id",
                label: "Actions",
                render: (_v, item) => {
                    // amountDue is calculated in cents
                    const amountDueCents = item.amountDue ?? ((item.total ?? 0) - (item.totalPaid ?? 0));
                    const isUnpaid = amountDueCents > 0;
                    
                    return (
                        <div className="flex gap-2">
                            {isUnpaid && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedOrderForPayment(item);
                                            // Pass amountDue in cents directly
                                            setPaymentTotalCents(amountDueCents);
                                            setShowPaymentModal(true);
                                        }}
                                    >
                                        Pay
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedOrderForItems(item);
                                            setShowAddItemsModal(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4" /> Item
                                    </Button>
                                </>
                            )}
                            <Link href={`/pos/orders/${item.id}`}>
                                <Button size="sm" variant="outline">View</Button>
                            </Link>
                        </div>
                    );
                },
                width: "w-48",
            },
        ],
        []
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">POS Orders</h1>
                <p className="text-muted-foreground">Manage orders from restaurant, bar and other departments.</p>
            </div>

            <div className="grid gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <TableSearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by order number or customer" isLoading={isLoading} />
                    </div>
                    <TableFilterBar
                        filters={[
                            {
                                key: "paymentStatus",
                                label: "Payment Status",
                                value: paymentStatusFilter || "all",
                                options: [
                                    { value: "all", label: "All Payment Status" },
                                    { value: "unpaid", label: "Unpaid" },
                                    { value: "partial", label: "Partial" },
                                    { value: "paid", label: "Paid" },
                                    { value: "refunded", label: "Refunded" },
                                ],
                            },
                            {
                                key: "status",
                                label: "Fulfillment Status",
                                value: statusFilter || "all",
                                options: [
                                    { value: "all", label: "All Fulfillment Status" },
                                    { value: "pending", label: "Pending" },
                                    { value: "processing", label: "Processing" },
                                    { value: "fulfilled", label: "Fulfilled" },
                                    { value: "completed", label: "Completed" },
                                    { value: "cancelled", label: "Cancelled" },
                                ],
                            },
                            {
                                key: "department",
                                label: "Department",
                                value: departmentFilter || "all",
                                options: [
                                    { value: "all", label: "All Departments" },
                                    ...departmentsList.map((d) => ({ value: d.code, label: d.name || d.code })),
                                ],
                            },
                            {
                                key: "departmentSection",
                                label: "Department Section",
                                value: departmentSectionFilter || "all",
                                options: [
                                    { value: "all", label: "All Sections" },
                                    ...departmentSectionsList.map((s) => ({ value: s.id, label: s.name || s.id })),
                                ],
                            },
                        ]}
                        onFilterChange={(k, v) => {
                            if (k === "paymentStatus") {
                                setPaymentStatusFilter(v === "all" ? "" : v);
                                setPage(1);
                            }
                            if (k === "status") {
                                setStatusFilter(v === "all" ? "" : v);
                                setPage(1);
                            }
                            if (k === "department") {
                                setDepartmentFilter(v === "all" ? "" : v);
                                setPage(1);
                            }
                            if (k === "departmentSection") {
                                setDepartmentSectionFilter(v === "all" ? "" : v);
                                setPage(1);
                            }
                        }}
                    />
                </div>

                {isLoading ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ) : (
                    <DataTable
                        columns={columns}
                        data={orders}
                        isLoading={isLoading}
                        pagination={{ total, page, limit, onPageChange: setPage }}
                        sorting={{ 
                            field: sortField, 
                            direction: sortDirection, 
                            onSort: (field) => {
                                if (sortField === field) {
                                    // Toggle direction if same field
                                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                                } else {
                                    // New field, default to desc
                                    setSortField(field);
                                    setSortDirection("desc");
                                }
                                setPage(1); // Reset to first page
                            }
                        }}
                    />
                )}
            </div>

            {/* Payment Modal - Using POSPayment Component */}
            {showPaymentModal && selectedOrderForPayment && (
                <POSPayment 
                    total={paymentTotalCents}
                    onComplete={handlePaymentComplete}
                    onCancel={() => {
                        setShowPaymentModal(false);
                        setSelectedOrderForPayment(null);
                    }}
                    allowDeferred={false}
                />
            )}

            {/* Add Items Modal */}
            <Dialog open={showAddItemsModal} onOpenChange={(open) => {
                setShowAddItemsModal(open);
                if (!open) {
                    setSelectedOrderForItems(null);
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Items to Order {selectedOrderForItems?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Originating Section Info */}
                        {selectedOrderForItems?.lines?.[0]?.departmentSection && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <p className="text-sm font-semibold text-blue-900">Originating Section</p>
                                <p className="text-sm text-blue-800 mt-1">
                                    {selectedOrderForItems.lines[0].departmentSection.name}
                                    {selectedOrderForItems.lines[0].departmentSection.department?.code && (
                                        <span className="font-medium"> ({selectedOrderForItems.lines[0].departmentSection.department.code})</span>
                                    )}
                                </p>
                                <p className="text-xs text-blue-700 mt-2">Items will be added to this section to maintain inventory integrity.</p>
                            </div>
                        )}

                        {/* Existing Items - Frozen */}
                        {selectedOrderForItems?.lines && selectedOrderForItems.lines.length > 0 && (
                            <div className="border-b pb-4">
                                <p className="text-sm font-semibold mb-2">Existing Items (Frozen)</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {selectedOrderForItems.lines.map((line: any, idx: number) => (
                                        <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                                            <p className="font-medium">{line.productName || 'Unknown'}</p>
                                            <p className="text-muted-foreground">Qty: {line.quantity}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowAddItemsModal(false);
                            setSelectedOrderForItems(null);
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddItems}
                        >
                            Open Terminal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
