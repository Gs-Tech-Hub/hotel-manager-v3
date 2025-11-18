"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function PosDepartmentsPage() {
    const [deps, setDeps] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const res = await fetch('/api/departments');
                const data = await res.json();
                if (data.success) setDeps(data.data.items || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDeps();
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Departments</h1>
                <p className="text-muted-foreground">Restaurant, Bar and other service departments.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : deps.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">No departments found</CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {deps.map((d) => (
                        <Link key={d.code} href={`/dashboard/pos/departments/${d.code}`}>
                            <Card className="cursor-pointer hover:bg-accent transition-colors">
                                <CardHeader>
                                    <CardTitle>{d.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">Code: {d.code}</div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
