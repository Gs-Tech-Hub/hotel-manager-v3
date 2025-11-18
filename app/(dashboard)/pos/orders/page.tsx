"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, TableSearchBar, TableFilterBar, Column } from "@/components/admin/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Order = {
    id: string;
    orderNumber?: string;
    customer?: { name?: string; phone?: string } | null;
    department?: { name?: string } | null;
    status: string;
    createdAt: string;
    totalPrice: number;
};

export default function PosOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({ page: String(page), limit: String(limit) });
                if (search) params.append("search", search);
                if (statusFilter) params.append("status", statusFilter);
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
    }, [page, search, statusFilter]);

    const columns = useMemo<Column<Order>[]>(
        () => [
            { key: "orderNumber", label: "Order #", sortable: true, width: "w-36" },
            {
                key: "customer",
                label: "Customer",
                render: (_v, item) => item.customer?.name || "Guest",
                width: "w-56",
            },
            {
                key: "department",
                label: "Department",
                render: (_v, item) => item.department?.name || "-",
                width: "w-40",
            },
            {
                key: "createdAt",
                label: "Created",
                render: (v) => new Date(String(v)).toLocaleString(),
                width: "w-44",
                sortable: true,
            },
            {
                key: "totalPrice",
                label: "Total",
                render: (v) => `$${(Number(v) / 100).toFixed(2)}`,
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
                            : s === "completed"
                            ? "bg-green-100 text-green-800"
                            : s === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800";
                    return <Badge className={cls}>{s}</Badge>;
                },
                width: "w-36",
            },
            {
                key: "id",
                label: "Actions",
                render: (_v, item) => (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/pos/orders/${item.id}`); }}>
                            View
                        </Button>
                    </div>
                ),
                width: "w-32",
            },
        ],
        [router]
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
                                value: statusFilter,
                                options: [
                                    { value: "pending", label: "Pending" },
                                    { value: "in_progress", label: "In Progress" },
                                    { value: "completed", label: "Completed" },
                                    { value: "cancelled", label: "Cancelled" },
                                ],
                            },
                        ]}
                        onFilterChange={(k, v) => { if (k === "status") { setStatusFilter(v); setPage(1); } }}
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
                        onRowClick={(item) => router.push(`/dashboard/pos/orders/${item.id}`)}
                        pagination={{ total, page, limit, onPageChange: setPage }}
                        sorting={{ field: "createdAt", direction: "desc", onSort: () => {} }}
                    />
                )}
            </div>
        </div>
    );
}
