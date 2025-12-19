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
    status: string;
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
    const [statusFilter, setStatusFilter] = useState("pending");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [departmentsList, setDepartmentsList] = useState<{ code: string; name?: string }[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    
    // Sorting state
    const [sortField, setSortField] = useState("createdAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    
    // Payment state - using POSPayment component
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
    const [paymentTotalCents, setPaymentTotalCents] = useState(0);
    
    // Add items state - cart-based
    const [showAddItemsModal, setShowAddItemsModal] = useState(false);
    const [selectedOrderForItems, setSelectedOrderForItems] = useState<Order | null>(null);
    const [newItemCart, setNewItemCart] = useState<Array<{lineId: string; productName: string; quantity: number; unitPrice: number}>>([]);
    const [isSubmittingItems, setIsSubmittingItems] = useState(false);
    
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
    }, [page, search, statusFilter, departmentFilter, sortField, sortDirection]);

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
            
            setShowPaymentModal(false);
            setSelectedOrderForPayment(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Payment failed");
        }
    };

    // Add items handler
    const handleAddItems = async () => {
        if (!selectedOrderForItems || newItemCart.length === 0) return;
        
        setIsSubmittingItems(true);
        try {
            const departmentCode = selectedOrderForItems.departments?.[0]?.department?.code;
            if (!departmentCode) throw new Error("Order has no department");
            
            // Submit each item in the cart
            for (const item of newItemCart) {
                const res = await fetch(`/api/orders/${selectedOrderForItems.id}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: `${item.productName.toLowerCase().replace(/\s+/g, '-')}`,
                        productType: "inventory",
                        productName: item.productName,
                        departmentCode,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                    }),
                    credentials: "include",
                });
                
                if (!res.ok) {
                    const json = await res.json();
                    throw new Error(json.error?.message || "Failed to add item");
                }
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
            
            setShowAddItemsModal(false);
            setSelectedOrderForItems(null);
            setNewItemCart([]);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to add items");
        } finally {
            setIsSubmittingItems(false);
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
                render: (_v, item) => formatCents(item.total ?? 0, undefined, 'NGN'),
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
                            {isPaid ? "✓ Paid" : formatCents(due, undefined, 'NGN')}
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
                                            setNewItemCart([]);
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
                />
            )}

            {/* Add Items Modal */}
            <Dialog open={showAddItemsModal} onOpenChange={setShowAddItemsModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Items to Order {selectedOrderForItems?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Item Input Section */}
                        <div className="border-b pb-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Product Name</label>
                                    <Input
                                        id="itemProductName"
                                        placeholder="e.g., Extra Appetizer"
                                        disabled={isSubmittingItems}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Quantity</label>
                                    <Input
                                        id="itemQuantity"
                                        type="number"
                                        min="1"
                                        defaultValue="1"
                                        disabled={isSubmittingItems}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Unit Price</label>
                                    <Input
                                        id="itemUnitPrice"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        disabled={isSubmittingItems}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    const productName = (document.getElementById('itemProductName') as HTMLInputElement)?.value;
                                    const quantity = parseInt((document.getElementById('itemQuantity') as HTMLInputElement)?.value) || 1;
                                    const unitPrice = parseFloat((document.getElementById('itemUnitPrice') as HTMLInputElement)?.value) || 0;
                                    
                                    if (!productName || unitPrice <= 0) {
                                        alert("Please enter product name and unit price");
                                        return;
                                    }
                                    
                                    setNewItemCart([...newItemCart, {
                                        lineId: Math.random().toString(36).slice(2),
                                        productName,
                                        quantity,
                                        unitPrice,
                                    }]);
                                    
                                    // Clear inputs
                                    (document.getElementById('itemProductName') as HTMLInputElement).value = '';
                                    (document.getElementById('itemQuantity') as HTMLInputElement).value = '1';
                                    (document.getElementById('itemUnitPrice') as HTMLInputElement).value = '';
                                }}
                                className="mt-3 w-full"
                                disabled={isSubmittingItems}
                            >
                                Add to Cart
                            </Button>
                        </div>

                        {/* Cart Items */}
                        {newItemCart.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Items to Add:</h4>
                                {newItemCart.map((item) => (
                                    <div key={item.lineId} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.quantity} × <Price amount={normalizeToCents(item.unitPrice)} isMinor={true} />
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">
                                                <Price amount={normalizeToCents(item.quantity * item.unitPrice)} isMinor={true} />
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setNewItemCart(newItemCart.filter(x => x.lineId !== item.lineId))}
                                            disabled={isSubmittingItems}
                                        >
                                            ✕
                                        </Button>
                                    </div>
                                ))}
                                <div className="border-t pt-2 text-right">
                                    <p className="text-sm font-semibold">
                                        Total: <Price amount={newItemCart.reduce((sum, item) => sum + normalizeToCents(item.quantity * item.unitPrice), 0)} isMinor={true} />
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowAddItemsModal(false);
                            setSelectedOrderForItems(null);
                            setNewItemCart([]);
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddItems} 
                            disabled={isSubmittingItems || newItemCart.length === 0}
                        >
                            {isSubmittingItems ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Add {newItemCart.length} Item{newItemCart.length !== 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
