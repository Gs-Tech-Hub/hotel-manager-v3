"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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
                console.log("Order data:", data);
                if (data.success) setOrder(data.data);
            } catch (e) {
                console.error("Error fetching order:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [params.id]);

    const updateFulfillmentStatus = async (lineId: string, status: 'processing' | 'fulfilled') => {
        if (!order) return;
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/fulfillment`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lineItemId: lineId, status }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) setOrder(data.data);
            }
        } catch (e) {
            console.error("Error updating fulfillment:", e);
        } finally {
            setIsUpdating(false);
        }
    };

    const formatPrice = (price: any) => {
        if (price === null || price === undefined || price === 'NaN') return "$0.00";
        const num = Number(price);
        if (isNaN(num)) return "$0.00";
        return `$${(num / 100).toFixed(2)}`;
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

    const departmentNames = (order.departments || []).map((d: any) => d?.department?.name).filter(Boolean);
    const statusColor = order.status === 'fulfilled' ? 'bg-green-100 text-green-800' : 
                       order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                       'bg-yellow-100 text-yellow-800';

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Order #{order.orderNumber || order.id}</h1>
                    <div className="flex gap-2 mt-2">
                        <Badge className={statusColor}>{order.status}</Badge>
                        <p className="text-muted-foreground text-sm">{departmentNames.join(', ') || "-"} • {new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/dashboard/pos/orders')}>Back</Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-semibold">{order.customer?.firstName || 'Guest'} {order.customer?.lastName || ''}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.phone || ''}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.email || ''}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                            {order.discountTotal > 0 && (
                                <div className="flex justify-between text-green-600"><span className="text-sm">Discount</span><span>-{formatPrice(order.discountTotal)}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tax</span><span>{formatPrice(order.tax)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatPrice(order.total)}</span></div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Fulfillment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {order.lines && order.lines.length > 0 ? (
                                <div className="text-sm">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-semibold">{order.lines.filter((l: any) => l.status === 'fulfilled').length}/{order.lines.length}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-green-600 h-2 rounded-full"
                                            style={{
                                                width: `${order.lines.length > 0 ? (order.lines.filter((l: any) => l.status === 'fulfilled').length / order.lines.length) * 100 : 0}%`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">No items</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                    {order.lines && order.lines.length > 0 ? (
                        <div className="space-y-4">
                            {order.lines.map((line: any) => (
                                <div key={line.id} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                                    <div>
                                        <div className="font-medium">{line.productName}</div>
                                        <div className="text-sm text-muted-foreground">
                                            Qty: {line.quantity} × {formatPrice(line.unitPrice)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Dept: {line.departmentCode} • Status: <Badge variant="outline">{line.status}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="font-semibold">{formatPrice(line.lineTotal)}</div>
                                        {line.status !== 'fulfilled' && (
                                            <div className="flex gap-1">
                                                {line.status === 'pending' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateFulfillmentStatus(line.id, 'processing')}
                                                        disabled={isUpdating}
                                                    >
                                                        Start
                                                    </Button>
                                                )}
                                                {line.status === 'processing' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => updateFulfillmentStatus(line.id, 'fulfilled')}
                                                        disabled={isUpdating}
                                                    >
                                                        Complete
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        {line.status === 'fulfilled' && (
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No items in this order</p>
                    )}
                </CardContent>
            </Card>

            {order.fulfillments && order.fulfillments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fulfillment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {order.fulfillments.map((f: any) => (
                                <div key={f.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                                    <div>
                                        <Badge variant="outline">{f.status}</Badge>
                                        <span className="ml-2 text-muted-foreground">{f.notes || 'No notes'}</span>
                                    </div>
                                    <span className="text-muted-foreground">{new Date(f.fulfilledAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
