import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const Index = () => {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-center px-4">
			{/* Minimal Header with Logo */}
			<div className="absolute top-6 left-8">
				<div className="flex items-center space-x-3">
					<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-lg">GS</span>
					</div>
					<span className="text-xl font-bold text-white hidden sm:inline">
						Hotel Manager
					</span>
				</div>
			</div>

			{/* Hero Section - Centered */}
			<div className="max-w-2xl mx-auto text-center">
				{/* Main Heading */}
				<h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
					<span className="block">Hotel Management</span>
					<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
						Made Simple
					</span>
				</h1>

				{/* Subheading */}
				<p className="text-lg text-gray-300 mb-12">
					Modern, intuitive software for hotel operations
				</p>

				{/* Login Button - Primary Focus */}
				<Button
					size="lg"
					className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 px-12 py-7 text-lg font-semibold shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/70 transition-all duration-300 transform hover:scale-105"
					asChild
				>
					<Link href="/login" className="flex items-center gap-2">
						Sign In
						<ArrowRight className="w-5 h-5" />
					</Link>
				</Button>

				{/* Additional Info */}
				<p className="text-gray-400 text-sm mt-6">
					Professional hotel management system
				</p>
			</div>

			{/* Subtle Accent */}
			<div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
				<div className="text-gray-600 text-sm">© 2024 GS Hotel Manager</div>
			</div>
		</div>
	);
};

export default Index;
