"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, TableSearchBar, TableFilterBar, Column } from "@/components/admin/tables/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type DrinkItem = {
    id: string;
    name: string;
    category?: string;
    price: number;
    stock?: number;
    active?: boolean;
};

export default function PosDrinksPage() {
    const router = useRouter();
    const [items, setItems] = useState<DrinkItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        const fetchItems = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({ page: String(page), limit: String(limit) });
                if (search) params.append("search", search);
                if (statusFilter) params.append("active", statusFilter);
                const res = await fetch(`/api/drinks?${params.toString()}`);
                const data = await res.json();
                if (data.success) {
                    setItems(data.data.items || []);
                    setTotal(data.data.meta?.total || 0);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchItems();
    }, [page, search, statusFilter]);

    const columns = useMemo<Column<DrinkItem>[]>(
        () => [
            { key: "name", label: "Name", sortable: true, width: "w-64" },
            { key: "category", label: "Category", width: "w-40" },
            { key: "price", label: "Price", render: (v) => `$${(Number(v) / 100).toFixed(2)}`, width: "w-28" },
            { key: "stock", label: "Stock", width: "w-24" },
            { key: "active", label: "Active", render: (v) => (v ? "Yes" : "No"), width: "w-24" },
            {
                key: "id",
                label: "Actions",
                render: (_v, item) => (
                    <div className="flex gap-2">
                        <button className="btn" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/pos/drinks/${item.id}`); }}>View</button>
                        <button className="btn" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/pos/drinks/${item.id}/edit`); }}>Edit</button>
                    </div>
                ),
                width: "w-36",
            },
        ],
        [router]
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Drinks Menu</h1>
                <p className="text-muted-foreground">Manage drinks and bar inventory.</p>
            </div>

            <div className="grid gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <TableSearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search drinks..." isLoading={isLoading} />
                    </div>
                    <TableFilterBar
                        filters={[{ key: "active", label: "Status", value: statusFilter, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]}
                        onFilterChange={(k, v) => { if (k === "active") { setStatusFilter(v); setPage(1); } }}
                    />
                </div>

                {isLoading ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ) : (
                    <DataTable columns={columns} data={items} isLoading={isLoading} pagination={{ total, page, limit, onPageChange: setPage }} onRowClick={(item) => router.push(`/dashboard/pos/drinks/${item.id}`)} />
                )}
            </div>
        </div>
    );
}
