"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Utensils, Coffee, Layers, BarChart3 } from "lucide-react";

export default function PosIndexPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Point of Sale</h1>
                <p className="text-muted-foreground mt-2">POS overview and quick actions for orders, menu and departments.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">View and manage active orders coming from restaurant & bar.</p>
                        <div className="mt-4">
                            <Link href="/pos/orders"><Button>Open Orders</Button></Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Utensils className="h-4 w-4" /> Food Menu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Manage food items and inventory for the restaurant.</p>
                        <div className="mt-4">
                            <Link href="/pos/food"><Button>Food Menu</Button></Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Coffee className="h-4 w-4" /> Drinks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Manage drinks, bar menus and inventory.</p>
                        <div className="mt-4">
                            <Link href="/pos/drinks"><Button>Drinks</Button></Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Reports</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">View sales, revenue, and order analytics.</p>
                        <div className="mt-4">
                            <Link href="/pos/reports"><Button>View Reports</Button></Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
