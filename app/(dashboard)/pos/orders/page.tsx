"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DataTable, TableSearchBar, TableFilterBar, Column } from "@/components/admin/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCents, normalizeToCents, centsToDollars } from '@/lib/price';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

type Order = {
    id: string;
    orderNumber?: string;
    customer?: { name?: string; phone?: string } | null;
    departments?: { department?: { name?: string; code?: string } }[] | null;
    status: string;
    createdAt: string;
    total?: number;
    totalPaid?: number;
    amountDue?: number;
    fulfillments?: any[];
};

export default function PosOrdersPage() {
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("pending");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [departmentsList, setDepartmentsList] = useState<{ code: string; name?: string }[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    
    // Payment dialog state
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    
    // Add items dialog state
    const [showAddItemsDialog, setShowAddItemsDialog] = useState(false);
    const [selectedOrderForItems, setSelectedOrderForItems] = useState<Order | null>(null);
    const [newItemProductName, setNewItemProductName] = useState("");
    const [newItemQuantity, setNewItemQuantity] = useState(1);
    const [newItemUnitPrice, setNewItemUnitPrice] = useState("");
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    
    const limit = 10;

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({ page: String(page), limit: String(limit) });
                if (search) params.append("search", search);
                // Always include status filter for open orders - default to pending
                const status = statusFilter || "pending";
                params.append("status", status);
                if (departmentFilter) params.append("departmentCode", departmentFilter);
                const res = await fetch(`/api/orders?${params.toString()}`);
                const data = await res.json();
                if (data.success) {
                    setOrders(data.data.items || []);
                    setTotal(data.data.meta?.total || 0);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [page, search, statusFilter, departmentFilter]);

    // Payment handler
    const handlePayment = async () => {
        if (!selectedOrderForPayment || !paymentAmount) return;
        
        setIsSubmittingPayment(true);
        try {
            const amountCents = normalizeToCents(parseFloat(paymentAmount));
            const res = await fetch("/api/orders/settle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: selectedOrderForPayment.id,
                    paymentMethod: "cash",
                    amount: amountCents,
                }),
                credentials: "include",
            });
            
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error?.message || "Payment failed");
            }
            
            // Refresh orders
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (search) params.append("search", search);
            const status = statusFilter || "pending";
            params.append("status", status);
            if (departmentFilter) params.append("departmentCode", departmentFilter);
            const refreshRes = await fetch(`/api/orders?${params.toString()}`);
            const data = await refreshRes.json();
            if (data.success) {
                setOrders(data.data.items || []);
            }
            
            setShowPaymentDialog(false);
            setSelectedOrderForPayment(null);
            setPaymentAmount("");
        } catch (error) {
            alert(error instanceof Error ? error.message : "Payment failed");
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    // Add item handler
    const handleAddItem = async () => {
        if (!selectedOrderForItems || !newItemProductName || !newItemUnitPrice) return;
        
        setIsSubmittingItem(true);
        try {
            const departmentCode = selectedOrderForItems.departments?.[0]?.department?.code;
            if (!departmentCode) throw new Error("Order has no department");
            
            const res = await fetch(`/api/orders/${selectedOrderForItems.id}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: `${newItemProductName.toLowerCase().replace(/\s+/g, '-')}`,
                    productType: "inventory",
                    productName: newItemProductName,
                    departmentCode,
                    quantity: newItemQuantity,
                    unitPrice: parseFloat(newItemUnitPrice),
                }),
                credentials: "include",
            });
            
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error?.message || "Failed to add item");
            }
            
            // Refresh orders
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (search) params.append("search", search);
            const status = statusFilter || "pending";
            params.append("status", status);
            if (departmentFilter) params.append("departmentCode", departmentFilter);
            const refreshRes = await fetch(`/api/orders?${params.toString()}`);
            const data = await refreshRes.json();
            if (data.success) {
                setOrders(data.data.items || []);
            }
            
            setShowAddItemsDialog(false);
            setSelectedOrderForItems(null);
            setNewItemProductName("");
            setNewItemQuantity(1);
            setNewItemUnitPrice("");
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to add item");
        } finally {
            setIsSubmittingItem(false);
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
        fetchDepartments();
    }, []);

    const columns = useMemo<Column<Order>[]>(
        () => [
            { key: "orderNumber", label: "Order #", sortable: true, width: "w-28" },
            {
                key: "customer",
                label: "Customer",
                render: (_v, item) => item.customer?.name || "Guest",
                width: "w-32",
            },
            {
                key: "departments",
                label: "Departments",
                render: (_v, item) => {
                    const names = (item.departments || []).map((d) => d?.department?.name).filter(Boolean);
                    return <span className="text-xs">{names.length ? names.join(", ") : "-"}</span>;
                },
                width: "w-40",
            },
            {
                key: "createdAt",
                label: "Created",
                render: (v) => new Date(String(v)).toLocaleString(),
                width: "w-36",
                sortable: true,
            },
            {
                key: "total",
                label: "Total",
                render: (_v, item) => formatCents(item.total ?? 0),
                width: "w-24",
            },
            {
                key: "amountDue",
                label: "Due",
                render: (_v, item) => {
                    const due = item.amountDue ?? (item.total ?? 0);
                    const isPaid = due <= 0;
                    return (
                        <span className={isPaid ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {isPaid ? "✓ Paid" : formatCents(due)}
                        </span>
                    );
                },
                width: "w-28",
            },
            {
                key: "status",
                label: "Status",
                render: (v) => {
                    const s = String(v);
                    const cls =
                        s === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : s === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : s === "completed"
                            ? "bg-green-100 text-green-800"
                            : s === "fulfilled"
                            ? "bg-green-100 text-green-800"
                            : s === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800";
                    return <Badge className={cls}>{s}</Badge>;
                },
                width: "w-28",
            },
            {
                key: "id",
                label: "Actions",
                render: (_v, item) => (
                    <div className="flex gap-2">
                        {(item.amountDue ?? (item.total ?? 0)) > 0 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedOrderForPayment(item);
                                        setShowPaymentDialog(true);
                                    }}
                                >
                                    Pay
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedOrderForItems(item);
                                        setShowAddItemsDialog(true);
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
                ),
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
                                key: "status",
                                label: "Status",
                                value: statusFilter || "pending",
                                options: [
                                    { value: "pending", label: "Pending Payment" },
                                    { value: "processing", label: "In Progress" },
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
                        ]}
                        onFilterChange={(k, v) => {
                            if (k === "status") {
                                setStatusFilter(v === "all" ? "pending" : v);
                                setPage(1);
                            }
                            if (k === "department") {
                                setDepartmentFilter(v === "all" ? "" : v);
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
                        sorting={{ field: "createdAt", direction: "desc", onSort: () => {} }}
                    />
                )}
            </div>

            {/* Payment Dialog */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment - Order {selectedOrderForPayment?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Amount Due:</p>
                            <p className="text-2xl font-bold text-red-600">
                                {formatCents(selectedOrderForPayment?.amountDue ?? 0)}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Payment Amount ($)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                disabled={isSubmittingPayment}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handlePayment} disabled={isSubmittingPayment || !paymentAmount}>
                            {isSubmittingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Items Dialog */}
            <Dialog open={showAddItemsDialog} onOpenChange={setShowAddItemsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Item to Order {selectedOrderForItems?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Product Name</label>
                            <Input
                                placeholder="e.g., Extra Appetizer"
                                value={newItemProductName}
                                onChange={(e) => setNewItemProductName(e.target.value)}
                                disabled={isSubmittingItem}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Quantity</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={newItemQuantity}
                                    onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    disabled={isSubmittingItem}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Unit Price ($)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newItemUnitPrice}
                                    onChange={(e) => setNewItemUnitPrice(e.target.value)}
                                    disabled={isSubmittingItem}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddItemsDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddItem} disabled={isSubmittingItem || !newItemProductName || !newItemUnitPrice}>
                            {isSubmittingItem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Add Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
