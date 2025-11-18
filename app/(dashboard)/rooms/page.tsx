"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Grid, List, Loader2 } from "lucide-react";
import { DataTable, Column, TableSearchBar, TableFilterBar } from "@/components/admin/tables/data-table";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Room {
	id: string;
	name: string;
	roomNumber: string;
	status: "available" | "occupied" | "maintenance";
	price: number;
	capacity: number;
	description?: string;
}

type ViewMode = "grid" | "list";

export default function RoomsPage() {
	const [rooms, setRooms] = useState<Room[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const limit = 10;

	// Fetch rooms from API
	useEffect(() => {
		const fetchRooms = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({
					page: String(page),
					limit: String(limit),
					...(statusFilter && { status: statusFilter }),
				});

				const response = await fetch(`/api/rooms?${params}`);
				const data = await response.json();

				if (data.success) {
					setRooms(data.data.items || data.data);
					setTotal(data.data.meta?.total || data.data.length);
				}
			} catch (error) {
				console.error("Failed to fetch rooms:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchRooms();
	}, [page, statusFilter]);

	// Filter rooms by search query
	const filteredRooms = rooms.filter((room) =>
		room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const statusOptions = [
		{ value: "available", label: "Available" },
		{ value: "occupied", label: "Occupied" },
		{ value: "maintenance", label: "Maintenance" },
	];

	const statusColors = {
		available: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
		occupied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
		maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
	};

	const columns: Column<Room>[] = [
		{
			key: "roomNumber",
			label: "Room Number",
			sortable: true,
		},
		{
			key: "name",
			label: "Room Name",
			sortable: true,
		},
		{
			key: "status",
			label: "Status",
			render: (value) => (
				<Badge className={statusColors[value as keyof typeof statusColors]}>
					{value.charAt(0).toUpperCase() + value.slice(1)}
				</Badge>
			),
		},
		{
			key: "capacity",
			label: "Capacity",
			render: (value) => `${value} guests`,
		},
		{
			key: "price",
			label: "Price",
			render: (value) => `$${(value / 100).toFixed(2)}`,
		},
		{
			key: "id",
			label: "Actions",
			render: (value) => (
				<Link href={`/dashboard/rooms/${value}`}>
					<Button variant="outline" size="sm">
						View
					</Button>
				</Link>
			),
		},
	];

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="text-4xl font-bold tracking-tight">Rooms</h1>
				<p className="text-muted-foreground text-lg">
					Manage your hotel rooms and availability
				</p>
			</div>

			{/* Actions Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
				<div className="flex gap-2">
					<Button
						variant={viewMode === "grid" ? "default" : "outline"}
						size="icon"
						onClick={() => setViewMode("grid")}
						title="Grid view"
					>
						<Grid className="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === "list" ? "default" : "outline"}
						size="icon"
						onClick={() => setViewMode("list")}
						title="List view"
					>
						<List className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex gap-2 flex-1 md:flex-none">
					<TableSearchBar
						placeholder="Search by room number or name..."
						value={searchQuery}
						onChange={setSearchQuery}
						isLoading={isLoading}
					/>
				</div>

				<Button asChild>
					<Link href="/dashboard/rooms/new">
						<Plus className="h-4 w-4 mr-2" />
						Add Room
					</Link>
				</Button>
			</div>

			{/* Filters */}
			<TableFilterBar
				filters={[
					{
						key: "status",
						label: "Status",
						value: statusFilter,
						options: statusOptions,
					},
				]}
				onFilterChange={(key, value) => {
					setStatusFilter(value);
					setPage(1);
				}}
			/>

			{/* Grid View */}
			{viewMode === "grid" && (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{isLoading ? (
						<div className="col-span-full flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : filteredRooms.length === 0 ? (
						<div className="col-span-full text-center py-12">
							<p className="text-muted-foreground">No rooms found</p>
						</div>
					) : (
						filteredRooms.map((room) => (
							<Link key={room.id} href={`/dashboard/rooms/${room.id}`}>
								<Card className="h-full hover:shadow-lg transition-all cursor-pointer">
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div className="space-y-1 flex-1">
												<CardTitle className="text-lg">
													{room.name}
												</CardTitle>
												<p className="text-sm text-muted-foreground">
													Room #{room.roomNumber}
												</p>
											</div>
											<Badge
												className={statusColors[room.status]}
											>
												{room.status.charAt(0).toUpperCase() +
													room.status.slice(1)}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										{room.description && (
											<p className="text-sm text-muted-foreground">
												{room.description}
											</p>
										)}
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Capacity
												</p>
												<p className="font-semibold">
													{room.capacity} guests
												</p>
											</div>
											<div className="space-y-1">
												<p className="text-xs text-muted-foreground uppercase">
													Price
												</p>
												<p className="font-semibold">
													${(room.price / 100).toFixed(2)}
												</p>
											</div>
										</div>
										<Button className="w-full" variant="outline">
											View Details
										</Button>
									</CardContent>
								</Card>
							</Link>
						))
					)}
				</div>
			)}

			{/* List View */}
			{viewMode === "list" && (
				<DataTable<Room>
					columns={columns}
					data={filteredRooms}
					isLoading={isLoading}
					onRowClick={(room) => {
						window.location.href = `/dashboard/rooms/${room.id}`;
					}}
					pagination={{
						total,
						page,
						limit,
						onPageChange: setPage,
					}}
				/>
			)}
		</div>
	);
}
