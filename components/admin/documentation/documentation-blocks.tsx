"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, InfoIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DocumentationBlockProps {
	type?: "info" | "warning" | "success" | "code";
	title?: string;
	children: React.ReactNode;
	code?: string;
}

export function DocumentationBlock({
	type = "info",
	title,
	children,
	code,
}: DocumentationBlockProps) {
	const [copied, setCopied] = useState(false);

	const typeStyles = {
		info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
		warning:
			"bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
		success:
			"bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
		code: "bg-slate-900 dark:bg-slate-950 border-slate-700 dark:border-slate-800",
	};

	const iconMap = {
		info: InfoIcon,
		warning: AlertCircle,
		success: CheckCircle2,
		code: null,
	};

	const Icon = iconMap[type];
	const colorMap = {
		info: "text-blue-600 dark:text-blue-400",
		warning: "text-amber-600 dark:text-amber-400",
		success: "text-green-600 dark:text-green-400",
		code: "",
	};

	const handleCopy = async () => {
		if (code) {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className={`border rounded-lg p-4 ${typeStyles[type]}`}>
			{title && (
				<div className="flex items-center gap-2 mb-3">
					{Icon && <Icon className={`h-5 w-5 ${colorMap[type]}`} />}
					<h4 className="font-semibold text-sm">{title}</h4>
				</div>
			)}
			{type === "code" ? (
				<div>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs text-slate-400">Code</span>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleCopy}
							className="h-6 w-6 p-0"
						>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
					<pre className="text-xs text-slate-200 overflow-auto max-h-64">
						{code}
					</pre>
					{copied && (
						<p className="text-xs text-green-400 mt-2">Copied!</p>
					)}
				</div>
			) : (
				<div className="text-sm space-y-2">{children}</div>
			)}
		</div>
	);
}

interface FileListProps {
	title: string;
	files: string[];
	category?: string;
}

export function FileList({ title, files, category }: FileListProps) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">{title}</CardTitle>
					{category && <Badge variant="secondary">{category}</Badge>}
				</div>
			</CardHeader>
			<CardContent>
				<ul className="space-y-2">
					{files.map((file) => (
						<li key={file} className="flex items-center gap-2 text-sm">
							<span className="text-primary">▪</span>
							<code className="bg-muted px-2 py-1 rounded text-xs">
								{file}
							</code>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

interface PhaseProps {
	phase: number;
	title: string;
	duration: string;
	tasks: string[];
	completed?: number;
}

export function PhaseCard({ phase, title, duration, tasks, completed = 0 }: PhaseProps) {
	const progress = (completed / tasks.length) * 100;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<Badge>Phase {phase}</Badge>
							<span className="text-xs text-muted-foreground">{duration}</span>
						</div>
						<CardTitle className="text-base">{title}</CardTitle>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Progress Bar */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-semibold">
							{completed}/{tasks.length}
						</span>
					</div>
					<div className="w-full bg-muted rounded-full h-2">
						<div
							className="bg-primary h-2 rounded-full transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				{/* Tasks */}
				<div className="space-y-2">
					{tasks.map((task, index) => (
						<div
							key={task}
							className="flex items-start gap-2 text-sm"
						>
							<input
								type="checkbox"
								defaultChecked={index < completed}
								className="mt-1 rounded"
								disabled
							/>
							<span className="leading-relaxed">{task}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

interface SectionHeadingProps {
	level?: 1 | 2 | 3;
	children: React.ReactNode;
}

export function SectionHeading({ level = 2, children }: SectionHeadingProps) {
	const classes = {
		1: "text-3xl font-bold",
		2: "text-2xl font-bold",
		3: "text-lg font-semibold",
	};

	const Tag = `h${level}` as const;

	return (
		<Tag className={`${classes[level]} mt-8 mb-4`}>
			{children}
		</Tag>
	);
}

interface ImplementationTimelineProps {
	phases: {
		number: number;
		title: string;
		duration: string;
		status: "pending" | "in-progress" | "completed";
	}[];
}

export function ImplementationTimeline({
	phases,
}: ImplementationTimelineProps) {
	return (
		<div className="space-y-4">
			{phases.map((phase, index) => (
				<div key={phase.number} className="flex gap-4">
					{/* Timeline Line */}
					<div className="flex flex-col items-center">
						<div
							className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${
								phase.status === "completed"
									? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
									: phase.status === "in-progress"
										? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
										: "bg-muted text-muted-foreground"
							}`}
						>
							{phase.number}
						</div>
						{index < phases.length - 1 && (
							<div className="w-1 h-16 bg-muted mt-2" />
						)}
					</div>

					{/* Phase Info */}
					<div className="pb-8">
						<h4 className="font-semibold">{phase.title}</h4>
						<p className="text-sm text-muted-foreground">{phase.duration}</p>
						<Badge
							variant={
								phase.status === "completed"
									? "default"
									: phase.status === "in-progress"
										? "secondary"
										: "outline"
							}
							className="mt-2"
						>
							{phase.status.replace("-", " ").toUpperCase()}
						</Badge>
					</div>
				</div>
			))}
		</div>
	);
}
