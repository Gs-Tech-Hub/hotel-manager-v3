"use client";

import { useState, useEffect } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Search,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
} from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Column<T> {
	key: keyof T;
	label: string;
	sortable?: boolean;
	render?: (value: any, item: T) => React.ReactNode;
	width?: string;
}

export interface DataTableProps<T extends { id: string }> {
	columns: Column<T>[];
	data: T[];
	isLoading?: boolean;
	onRowClick?: (item: T) => void;
	pagination?: {
		total: number;
		page: number;
		limit: number;
		onPageChange: (page: number) => void;
	};
	sorting?: {
		field: string;
		direction: "asc" | "desc";
		onSort: (field: string, direction: "asc" | "desc") => void;
	};
	selectable?: boolean;
	selectedRows?: Set<string>;
	onSelectionChange?: (selected: Set<string>) => void;
}

export function DataTable<T extends { id: string }>({
	columns,
	data,
	isLoading = false,
	onRowClick,
	pagination,
	sorting,
	selectable = false,
	selectedRows = new Set(),
	onSelectionChange,
}: DataTableProps<T>) {
	const [selectedLocal, setSelectedLocal] = useState<Set<string>>(
		selectedRows
	);

	const handleSelectAll = () => {
		const newSelected = new Set<string>();
		if (selectedLocal.size === data.length) {
			// Deselect all
		} else {
			// Select all
			data.forEach((item) => newSelected.add(item.id));
		}
		setSelectedLocal(newSelected);
		onSelectionChange?.(newSelected);
	};

	const handleSelectRow = (id: string) => {
		const newSelected = new Set(selectedLocal);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedLocal(newSelected);
		onSelectionChange?.(newSelected);
	};

	const handleSort = (field: string) => {
		if (!sorting) return;
		const newDirection =
			sorting.field === field && sorting.direction === "asc"
				? "desc"
				: "asc";
		sorting.onSort(field, newDirection);
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-8">
					<div className="text-center text-muted-foreground">
						Loading...
					</div>
				</CardContent>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card>
				<CardContent className="py-8">
					<div className="text-center text-muted-foreground">
						No data available
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<div className="rounded-lg border overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/50 hover:bg-muted/50">
							{selectable && (
								<TableHead className="w-12">
									<input
										type="checkbox"
										checked={selectedLocal.size === data.length}
										onChange={handleSelectAll}
										className="rounded border"
									/>
								</TableHead>
							)}
							{columns.map((column) => (
								<TableHead
									key={String(column.key)}
									className={cn(
										"text-xs font-semibold text-muted-foreground uppercase",
										column.width
									)}
								>
									<div className="flex items-center gap-2">
										{column.label}
										{column.sortable && sorting && (
											<button
												onClick={() =>
													handleSort(String(column.key))
												}
												className="p-1 hover:bg-muted rounded transition-colors"
											>
												{sorting.field === String(column.key) ? (
													sorting.direction === "asc" ? (
														<ArrowUp className="h-3 w-3" />
													) : (
														<ArrowDown className="h-3 w-3" />
													)
												) : (
													<ArrowUpDown className="h-3 w-3 opacity-50" />
												)}
											</button>
										)}
									</div>
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((item) => (
							<TableRow
								key={item.id}
								className={cn(
									"hover:bg-muted/50 transition-colors",
									onRowClick && "cursor-pointer"
								)}
								onClick={() => onRowClick?.(item)}
							>
								{selectable && (
									<TableCell className="w-12">
										<input
											type="checkbox"
											checked={selectedLocal.has(item.id)}
											onChange={() => handleSelectRow(item.id)}
											onClick={(e) => e.stopPropagation()}
											className="rounded border"
										/>
									</TableCell>
								)}
								{columns.map((column) => (
									<TableCell
										key={String(column.key)}
										className={cn(
											"text-sm",
											column.width
										)}
									>
										{column.render
											? column.render(item[column.key], item)
											: String(item[column.key])}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			{pagination && (
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
						{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
						{pagination.total} results
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={() => pagination.onPageChange(1)}
							disabled={pagination.page === 1}
						>
							<ChevronsLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={() => pagination.onPageChange(pagination.page - 1)}
							disabled={pagination.page === 1}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						<Select
							value={String(pagination.page)}
							onValueChange={(value) =>
								pagination.onPageChange(Number(value))
							}
						>
							<SelectTrigger className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({
									length: Math.ceil(
										pagination.total / pagination.limit
									),
								}).map((_, i) => (
									<SelectItem key={i + 1} value={String(i + 1)}>
										{i + 1}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Button
							variant="outline"
							size="icon"
							onClick={() => pagination.onPageChange(pagination.page + 1)}
							disabled={
								pagination.page >=
								Math.ceil(pagination.total / pagination.limit)
							}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={() =>
								pagination.onPageChange(
									Math.ceil(pagination.total / pagination.limit)
								)
							}
							disabled={
								pagination.page >=
								Math.ceil(pagination.total / pagination.limit)
							}
						>
							<ChevronsRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

export function TableSearchBar({
	placeholder = "Search...",
	value,
	onChange,
	isLoading = false,
}: {
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	isLoading?: boolean;
}) {
	return (
		<div className="relative">
			<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input
				type="search"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={isLoading}
				className="pl-10 pr-4 py-2"
			/>
		</div>
	);
}

export function TableFilterBar({
	filters,
	onFilterChange,
}: {
	filters: Array<{
		key: string;
		label: string;
		value: string;
		options: Array<{ value: string; label: string }>;
	}>;
	onFilterChange: (key: string, value: string) => void;
}) {
	return (
		<div className="flex gap-2 flex-wrap">
			{filters.map((filter) => (
				<Select
					key={filter.key}
					value={filter.value === '' ? "__all__" : filter.value}
					onValueChange={(value) => onFilterChange(filter.key, value === "__all__" ? "" : value)}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder={filter.label} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">All {filter.label}</SelectItem>
						{filter.options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			))}
		</div>
	);
}
