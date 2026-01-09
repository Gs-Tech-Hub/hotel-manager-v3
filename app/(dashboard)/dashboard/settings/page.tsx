"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileFormSchema = z.object({
	username: z
		.string()
		.min(2, {
			message: "Username must be at least 2 characters.",
		})
		.max(30, {
			message: "Username must not be longer than 30 characters.",
		}),
	name: z
		.string()
		.min(2, {
			message: "Name must be at least 2 characters.",
		})
		.max(100, {
			message: "Name must not be longer than 100 characters.",
		}),
	email: z
		.string({
			required_error: "Please select an email to display.",
		})
		.email(),
	bio: z.string().max(500, {
		message: "Bio must not be longer than 500 characters.",
	}),
	urls: z
		.array(
			z.object({
				value: z.string().url({ message: "Please enter a valid URL." }),
			}),
		)
		.optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// This can come from your database
const defaultValues: Partial<ProfileFormValues> = {
	bio: "I own a computer.",
	urls: [
		{ value: "https://shadcn.com" },
		{ value: "http://twitter.com/shadcn" },
	],
};

export default function SettingsPage() {
	const [activeTab, setActiveTab] = useState("profile");
	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues,
		mode: "onChange",
	});

	function onSubmit(data: ProfileFormValues) {
		console.log("Profile data:", data);
		toast.success("Profile updated successfully!", {
			description: "Your profile has been updated.",
		});
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Settings</h1>
				<p className="text-gray-600 mt-1">Manage your account, roles, and permissions</p>
			</div>
			<Separator />
			
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="profile">Profile</TabsTrigger>
					<TabsTrigger value="roles">Roles</TabsTrigger>
					<TabsTrigger value="permissions">Permissions</TabsTrigger>
				</TabsList>

				{/* Profile Tab */}
				<TabsContent value="profile" className="space-y-6 mt-6">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					<div className="flex items-center gap-6">
						<Avatar className="h-20 w-20">
							<AvatarImage src="/avatars/01.png" alt="@username" />
							<AvatarFallback>JD</AvatarFallback>
						</Avatar>
						<div className="space-y-2">
							<Label htmlFor="picture">Profile Picture</Label>
							<Button variant="outline" size="sm" className="w-fit">
								<Camera className="mr-2 h-4 w-4" />
								Change Picture
							</Button>
						</div>
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input placeholder="username" {...field} />
									</FormControl>
									<FormDescription>
										This is your public display name. It can be your real name
										or a pseudonym.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="John Doe" {...field} />
									</FormControl>
									<FormDescription>
										This is your public display name. It can be your real name
										or a pseudonym.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input placeholder="john.doe@example.com" {...field} />
								</FormControl>
								<FormDescription>
									You can manage verified email addresses in your{" "}
									<a
										href="/dashboard/settings/email"
										className="underline underline-offset-4"
									>
										email settings
									</a>
									.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="bio"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Bio</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Tell us a little bit about yourself"
										className="resize-none"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									You can <span>@mention</span> other users and organizations to
									link to them.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button type="submit">Update profile</Button>
				</form>
			</Form>
				</TabsContent>

				{/* Roles Tab */}
				<TabsContent value="roles" className="space-y-6 mt-6">
					<div>
						<h3 className="text-lg font-medium">Your Roles</h3>
						<p className="text-sm text-gray-600">Roles assigned to your account</p>
					</div>
					<Button asChild>
						<a href="/admin/roles">Manage All Roles</a>
					</Button>
				</TabsContent>

				{/* Permissions Tab */}
				<TabsContent value="permissions" className="space-y-6 mt-6">
					<div>
						<h3 className="text-lg font-medium">Your Permissions</h3>
						<p className="text-sm text-gray-600">Permissions associated with your roles</p>
					</div>
					<Button asChild>
						<a href="/admin/roles">Configure Permissions</a>
					</Button>
				</TabsContent>
			</Tabs>
		</div>
	);
}
