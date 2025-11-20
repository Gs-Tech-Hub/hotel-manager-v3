"use client";

import Link from "next/link";

export default function PosDepartmentsPage() {
    // POS should not duplicate department management. Provide quick links to POS-specific pages
    // and a link to the centralized departments management.
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">POS — Administration</h1>
                <p className="text-muted-foreground">This area contains POS-specific tools. Department management is centralized.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border rounded p-4">
                    <h2 className="font-semibold text-lg">Terminals</h2>
                    <p className="text-sm text-muted-foreground">Manage POS terminals and their allowed items.</p>
                    <div className="mt-3">
                        <Link href="/dashboard/pos-terminals" className="text-sky-600">Open POS Terminals</Link>
                    </div>
                </div>

                <div className="border rounded p-4">
                    <h2 className="font-semibold text-lg">Orders</h2>
                    <p className="text-sm text-muted-foreground">View and manage POS orders.</p>
                    <div className="mt-3">
                        <Link href="/dashboard/orders" className="text-sky-600">Open Orders</Link>
                    </div>
                </div>

                <div className="border rounded p-4 col-span-full">
                    <h2 className="font-semibold text-lg">Departments (centralized)</h2>
                    <p className="text-sm text-muted-foreground">Department creation and configuration is handled in the Departments area.</p>
                    <div className="mt-3">
                        <Link href="/departments" className="text-sky-600">Open Departments</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
