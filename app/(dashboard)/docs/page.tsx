"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, CheckSquare } from "lucide-react";

export default function DocsPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
                <p className="text-muted-foreground mt-2">Centralized documentation hub for guides, implementation instructions and quick references.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" /> Guides
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Implementation guides and structural docs.</p>
                        <div className="mt-4 flex gap-2">
                            <Link href="/dashboard/implementation-guide">
                                <Button variant="outline">Implementation Guide</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4" /> How-tos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Step-by-step instructions for common tasks.</p>
                        <div className="mt-4 flex gap-2">
                            <Link href="/dashboard/quick-reference">
                                <Button variant="outline">Quick Reference</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4" /> API & Dev
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">API usage, endpoints and developer notes.</p>
                        <div className="mt-4 flex gap-2">
                            <Link href="/dashboard/documentation">
                                <Button variant="outline">Low-level Docs</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
