"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function OrderDetailPage(props: any) {
    const { params } = props;
    const router = useRouter();
    const [order, setOrder] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/orders/${params.id}`);
                const data = await res.json();
                if (data.success) setOrder(data.data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [params.id]);

    const updateStatus = async (status: string) => {
        if (!order) return;
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) setOrder(data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Order not found</p>
                <Link href="/dashboard/pos/orders">
                    <Button className="mt-4">Back to Orders</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Order #{order.orderNumber || order.id}</h1>
                    <p className="text-muted-foreground">{order.department?.name || "-"} • {new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/dashboard/pos/orders')}>Back</Button>
                    <Button onClick={() => updateStatus('completed')} disabled={isUpdating}>Mark Completed</Button>
                    <Button variant="destructive" onClick={() => updateStatus('cancelled')} disabled={isUpdating}>Cancel</Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-semibold">{order.customer?.name || 'Guest'}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.phone || ''}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.email || ''}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {order.items?.length ? (
                            <ul className="space-y-2">
                                {order.items.map((it: any) => (
                                    <li key={it.id} className="flex justify-between">
                                        <div>
                                            <div className="font-medium">{it.name}</div>
                                            <div className="text-sm text-muted-foreground">x{it.quantity}</div>
                                        </div>
                                        <div className="font-medium">${(it.price/100).toFixed(2)}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">No items</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Payment & Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span>${(order.subtotal/100).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tax</span><span>${(order.tax/100).toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold"><span>Total</span><span>${(order.totalPrice/100).toFixed(2)}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
