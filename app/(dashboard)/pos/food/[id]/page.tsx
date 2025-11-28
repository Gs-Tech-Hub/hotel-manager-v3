"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function FoodDetailPage(props: any) {
    const { params } = props;
    const router = useRouter();
    const [item, setItem] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const res = await fetch(`/api/food/${params.id}`, { credentials: 'same-origin' });
                const data = await res.json();
                if (data.success) setItem(data.data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchItem();
    }, [params.id]);

    const handleDelete = async () => {
        if (!confirm("Delete this food item?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/food/${params.id}`, { method: 'DELETE', credentials: 'same-origin' });
            if (res.ok) router.push('/pos/food');
        } catch (e) {
            console.error(e);
        } finally { setIsDeleting(false); }
    };

    if (isLoading) return (<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>);
    if (!item) return (<div className="text-center py-12"> <p className="text-muted-foreground">Item not found</p> <Link href="/pos/food"><Button className="mt-4">Back</Button></Link></div>);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{item.name}</h1>
                    <p className="text-muted-foreground">Category: {item.category}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/pos/food')}>Back</Button>
                    <Button onClick={() => router.push(`/pos/food/${item.id}/edit`)}>Edit</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete'}</Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div><strong>Price:</strong> ${(item.price/100).toFixed(2)}</div>
                            <div><strong>Stock:</strong> {item.stock ?? 'N/A'}</div>
                            <div><strong>Active:</strong> {item.active ? 'Yes' : 'No'}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
