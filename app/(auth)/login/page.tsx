"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEffect } from 'react';

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

const formSchema = z.object({
	email: z.string().email({
		message: "Please enter a valid email address.",
	}),
	password: z.string().min(6, {
		message: "Password must be at least 6 characters.",
	}),
});

export default function LoginPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	// If a session already exists, redirect to dashboard
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await fetch('/api/auth/session', { credentials: 'include' });
				if (!mounted) return;
				if (res.ok) {
					// already authenticated → redirect
					router.replace('/dashboard');
				}
			} catch (err) {
				// ignore errors — user not authenticated
			}
		})();

		return () => { mounted = false; };
	}, [router]);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setIsLoading(true);
		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(values),
				credentials: 'include',
			});

			const data = await response.json();

			if (!response.ok) {
				toast.error("Login failed", {
					description: data.error || "Invalid email or password",
				});
				return;
			}

			toast.success("Login successful!", {
				description: "Welcome back! Redirecting...",
			});

			// Wait a bit for toast to show, then redirect
			setTimeout(() => {
				router.push("/dashboard");
				router.refresh();
			}, 1000);
		} catch (error) {
			console.error("Login error:", error);
			toast.error("Login failed", {
				description: "An unexpected error occurred",
			});
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<LogIn className="mx-auto h-12 w-12 text-gray-400" />
				<CardTitle className="mt-4 text-2xl">Welcome back</CardTitle>
				<CardDescription>
					Enter your credentials to access your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<div className="relative">
											<Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												placeholder="Enter your email"
												className="pl-10"
												disabled={isLoading}
												{...field}
											/>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<div className="relative">
											<Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												type="password"
												placeholder="Enter your password"
												className="pl-10"
												disabled={isLoading}
												{...field}
											/>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isLoading ? "Signing in..." : "Sign In"}
						</Button>
					</form>
				</Form>
			</CardContent>
			<CardFooter className="flex flex-col gap-4">
				<div className="text-center text-sm">
					<Link
						href="/forgot-password"
						className="text-blue-600 hover:text-blue-800 underline"
					>
						Forgot your password?
					</Link>
				</div>
				<div className="text-center text-sm">
					Don&apos;t have an account?{" "}
					<Link
						href="/register"
						className="text-blue-600 hover:text-blue-800 underline"
					>
						Sign up
					</Link>
				</div>
			</CardFooter>
		</Card>
	);
}
