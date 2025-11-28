"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DataTable, TableSearchBar, TableFilterBar, Column } from "@/components/admin/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCents } from '@/lib/price';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

    type Order = {
    id: string;
    orderNumber?: string;
    customer?: { name?: string; phone?: string } | null;
    departments?: { department?: { name?: string; code?: string } }[] | null;
    status: string;
    createdAt: string;
        total?: number;
    fulfillments?: any[];
};

export default function PosOrdersPage() {
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [departmentsList, setDepartmentsList] = useState<{ code: string; name?: string }[]>([]);
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
                key: "fulfillments",
                label: "Fulfillments",
                render: (_v, item) => {
                    const f = item.fulfillments || [];
                    if (!f.length) return <span className="text-xs text-muted-foreground">-</span>;
                    const statuses = f.map((ff: any) => ff.status).filter(Boolean);
                    const unique = Array.from(new Set(statuses));
                    return <span className="text-xs">{f.length} ({unique.join(", ")})</span>;
                },
                width: "w-28",
            },
            {
                key: "id",
                label: "Actions",
                render: (_v, item) => (
                    <Link href={`/pos/orders/${item.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                    </Link>
                ),
                width: "w-20",
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
                                value: statusFilter || "all",
                                options: [
                                    { value: "all", label: "All" },
                                    { value: "pending", label: "Pending" },
                                    { value: "in_progress", label: "In Progress" },
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
                                setStatusFilter(v === "all" ? "" : v);
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
        </div>
    );
}
