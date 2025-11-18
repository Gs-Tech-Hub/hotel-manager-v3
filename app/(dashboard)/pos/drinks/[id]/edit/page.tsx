"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function DrinkEditPage(props: any) {
    const { params } = props;
    const router = useRouter();
    const [item, setItem] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                const res = await fetch(`/api/drinks/${params.id}`);
                const data = await res.json();
                if (data.success) setItem(data.data);
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        fetchItem();
    }, [params.id]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setItem((s: any) => ({ ...s, [name]: value }));
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (!item) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/drinks/${params.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
            if (res.ok) router.push(`/dashboard/pos/drinks/${params.id}`);
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    if (isLoading) return (<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>);
    if (!item) return (<div className="text-center py-12"><p className="text-muted-foreground">Item not found</p></div>);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Edit: {item.name}</h1>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Basic</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" value={item.name || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="category">Category</Label>
                            <Input id="category" name="category" value={item.category || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <Label htmlFor="price">Price (cents)</Label>
                            <Input id="price" name="price" value={item.price || 0} onChange={handleChange} type="number" />
                        </div>
                        <div>
                            <Label htmlFor="stock">Stock</Label>
                            <Input id="stock" name="stock" value={item.stock || 0} onChange={handleChange} type="number" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" value={item.description || ''} onChange={handleChange} rows={6} />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => router.push(`/dashboard/pos/drinks/${item.id}`)}>Cancel</Button>
                                <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
