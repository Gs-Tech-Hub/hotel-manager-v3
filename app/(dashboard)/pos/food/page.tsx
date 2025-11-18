"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function PosFoodPage() {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await fetch('/api/food');
                const data = await res.json();
                if (data.success) setItems(data.data.items || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchItems();
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Food Menu</h1>
                <p className="text-muted-foreground">Manage food items and inventory.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">No food items found</CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {items.map((it) => (
                        <Link key={it.id} href={`/dashboard/pos/food/${it.id}`}>
                            <Card className="cursor-pointer hover:bg-accent transition-colors">
                                <CardHeader>
                                    <CardTitle>{it.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">${(it.price / 100).toFixed(2)}</div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
