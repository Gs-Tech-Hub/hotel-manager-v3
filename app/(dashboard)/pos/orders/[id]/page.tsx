"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, X, Plus } from "lucide-react";
import { formatCents } from '@/lib/price';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { OrderExtrasDialog } from "@/components/pos/orders/OrderExtrasDialog";
import { OrderLineExtras } from "@/components/pos/orders/OrderLineExtras";

export default function OrderDetailPage() {
    const params = useParams();
    const id = params?.id;
    const router = useRouter();
    const [order, setOrder] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [refundError, setRefundError] = useState<string | null>(null);
    const [refundReason, setRefundReason] = useState("");
    const [extrasDialogOpen, setExtrasDialogOpen] = useState(false);
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/orders/${id}`, { credentials: 'same-origin' });
                const data = await res.json();
                console.log("Order data:", data, "status", res.status);
                if (res.ok && data && data.success) {
                    setOrder(data.data);
                } else {
                    // API returned error (not found, forbidden, etc.) — show not found UI
                    setOrder(null);
                }
            } catch (e) {
                console.error("Error fetching order:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [id]);

    // Refresh order details
    const refreshOrder = async () => {
        if (!order?.id) return;
        try {
            const res = await fetch(`/api/orders/${order.id}`, { credentials: 'same-origin' });
            const data = await res.json();
            if (res.ok && data && data.success) {
                setOrder(data.data);
            }
        } catch (e) {
            console.error("Error refreshing order:", e);
        }
    };

    const updateFulfillmentStatus = async (lineId: string, status: 'processing' | 'fulfilled') => {
        if (!order) return;
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/fulfillment`, {
                method: "PUT",
                credentials: 'same-origin',
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

    const fulfillAll = async () => {
        if (!order || !order.lines || order.lines.length === 0) return;
        setIsUpdating(true);
        try {
            const promises = order.lines.map((l: any) =>
                fetch(`/api/orders/${order.id}/fulfillment`, {
                    method: "PUT",
                    credentials: 'same-origin',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineItemId: l.id, status: 'fulfilled' }),
                })
            );
            await Promise.all(promises);
            // refresh
            const r = await fetch(`/api/orders/${order.id}`, { credentials: 'same-origin' });
            const d = await r.json();
            if (r.ok && d && d.success) setOrder(d.data);
        } catch (e) {
            console.error('Error fulfilling all lines:', e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order) return;
        setIsUpdating(true);
        setCancelError(null);
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: "DELETE",
                credentials: 'same-origin',
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (res.ok && data && data.success) {
                setCancelDialogOpen(false);
                // Refresh order
                const r = await fetch(`/api/orders/${order.id}`, { credentials: 'same-origin' });
                const d = await r.json();
                if (r.ok && d && d.success) {
                    setOrder(d.data);
                }
            } else {
                setCancelError(data?.error?.message || 'Failed to cancel order');
            }
        } catch (e: any) {
            console.error('Error cancelling order:', e);
            setCancelError(e?.message || 'Failed to cancel order');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRefundOrder = async () => {
        if (!order) return;
        setIsUpdating(true);
        setRefundError(null);
        try {
            const res = await fetch(`/api/orders/${order.id}/refund`, {
                method: "POST",
                credentials: 'same-origin',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: refundReason || undefined }),
            });
            const data = await res.json();
            if (res.ok && data && data.success) {
                setRefundDialogOpen(false);
                setRefundReason("");
                // Refresh order
                const r = await fetch(`/api/orders/${order.id}`, { credentials: 'same-origin' });
                const d = await r.json();
                if (r.ok && d && d.success) {
                    setOrder(d.data);
                }
            } else {
                setRefundError(data?.error?.message || 'Failed to refund order');
            }
        } catch (e: any) {
            console.error('Error refunding order:', e);
            setRefundError(e?.message || 'Failed to refund order');
        } finally {
            setIsUpdating(false);
        }
    };

    const formatPrice = (price: any) => formatCents(price);

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
                <Link href="/pos/orders">
                    <Button className="mt-4">Back to Orders</Button>
                </Link>
            </div>
        );
    }

    const departmentNames = (order.departments || []).map((d: any) => d?.department?.name).filter(Boolean);
    const statusColor = order.status === 'fulfilled' ? 'bg-green-100 text-green-800' : 
                       order.status === 'completed' ? 'bg-green-100 text-green-800' :
                       order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                       order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                       order.status === 'refunded' ? 'bg-orange-100 text-orange-800' :
                       'bg-yellow-100 text-yellow-800';
    const paymentColor = order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                        order.paymentStatus === 'partial' ? 'bg-blue-100 text-blue-800' :
                        order.paymentStatus === 'refunded' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800';
    
    // Calculate extras total from order extras
    const extrasTotal = (order.extras || []).reduce((sum: number, extra: any) => {
      return sum + (extra.lineTotal || 0);
    }, 0);
    
    // Determine available actions
    const canCancel = order.status === 'pending';
    const canRefund = order.status === 'pending' && 
                      (order.paymentStatus === 'paid' || order.paymentStatus === 'partial');

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Order #{order.orderNumber || order.id}</h1>
                    <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge className={statusColor}>{order.status}</Badge>
                        <Badge className={paymentColor}>{order.paymentStatus}</Badge>
                        <p className="text-muted-foreground text-sm">{departmentNames.join(', ') || "-"} • {new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => router.push('/pos/orders')}>Back</Button>
                    <Button onClick={fulfillAll} disabled={isUpdating || order.status === 'cancelled' || order.status === 'refunded'}>
                        {isUpdating ? 'Working...' : 'Mark All Fulfilled'}
                    </Button>
                    {canCancel && (
                        <Button 
                            variant="destructive" 
                            onClick={() => setCancelDialogOpen(true)}
                            disabled={isUpdating}
                        >
                            Cancel Order
                        </Button>
                    )}
                    {canRefund && (
                        <Button 
                            variant="outline"
                            onClick={() => setRefundDialogOpen(true)}
                            disabled={isUpdating}
                        >
                            Refund
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-semibold">{(order.customer as any)?.firstName || (order.customer as any)?.name || 'Guest'} {(order.customer as any)?.lastName || ''}</p>
                        <p className="text-sm text-muted-foreground">{(order.customer as any)?.phone || ''}</p>
                        <p className="text-sm text-muted-foreground">{(order.customer as any)?.email || ''}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                            {extrasTotal > 0 && (
                                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Extras</span><span>{formatPrice(extrasTotal)}</span></div>
                            )}
                            {order.discountTotal > 0 && (
                                <div className="flex justify-between text-green-600"><span className="text-sm">Discount</span><span>-{formatPrice(order.discountTotal)}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tax</span><span>{formatPrice(order.tax)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{
                                // Prefer showing the sum of recorded payments (transaction total) when available
                                (order.payments && order.payments.length > 0)
                                    ? formatPrice(order.payments.reduce((s: number, p: any) => s + (p.amount || 0), 0))
                                    : formatPrice(order.total)
                            }</span></div>
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
                                <div key={line.id} className="border-b pb-4 last:border-b-0">
                                    <div className="flex items-center justify-between mb-3">
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
                                            <div className="flex gap-1 flex-wrap justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedLineId(line.id);
                                                        setExtrasDialogOpen(true);
                                                    }}
                                                    disabled={isUpdating}
                                                >
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Add Extras
                                                </Button>
                                                {line.status !== 'fulfilled' && (
                                                    <>
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
                                                    </>
                                                )}
                                                {line.status === 'fulfilled' && (
                                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Display extras for this line */}
                                    <OrderLineExtras
                                        orderLineId={line.id}
                                        orderHeaderId={order.id}
                                        onExtrasChanged={refreshOrder}
                                    />
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

            {/* Cancel Order Dialog */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Order?</DialogTitle>
                        <DialogDescription>
                            This will cancel the pending order and release all inventory reservations.
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {cancelError && (
                        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded p-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{cancelError}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button 
                            variant="outline"
                            onClick={() => setCancelDialogOpen(false)}
                            disabled={isUpdating}
                        >
                            Keep Order
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleCancelOrder}
                            disabled={isUpdating}
                        >
                            {isUpdating ? 'Cancelling...' : 'Cancel Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refund Order Dialog */}
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Refund Order?</DialogTitle>
                        <DialogDescription>
                            This will refund the fulfilled order and reverse the payment.
                            The order will no longer count as sold.
                        </DialogDescription>
                    </DialogHeader>
                    {refundError && (
                        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded p-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{refundError}</p>
                        </div>
                    )}
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium">Refund Reason (optional)</label>
                            <textarea
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                placeholder="e.g., Customer request, damaged item, etc."
                                className="w-full mt-2 p-2 border rounded text-sm"
                                rows={3}
                                disabled={isUpdating}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline"
                            onClick={() => setRefundDialogOpen(false)}
                            disabled={isUpdating}
                        >
                            Keep Order
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleRefundOrder}
                            disabled={isUpdating}
                        >
                            {isUpdating ? 'Processing...' : 'Refund Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Extras Dialog */}
            <OrderExtrasDialog
                open={extrasDialogOpen}
                onOpenChange={setExtrasDialogOpen}
                orderHeaderId={order?.id || ''}
                orderLineId={selectedLineId || ''}
                onSuccess={refreshOrder}
            />
        </div>
    );
}
