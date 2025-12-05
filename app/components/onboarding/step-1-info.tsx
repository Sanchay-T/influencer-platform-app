'use client';

import { AlertCircle, ArrowRight, Building, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Step1InfoProps {
	fullName: string;
	businessName: string;
	onFullNameChange: (value: string) => void;
	onBusinessNameChange: (value: string) => void;
	onSubmit: () => void;
	isLoading: boolean;
	error: string;
}

export default function Step1Info({
	fullName,
	businessName,
	onFullNameChange,
	onBusinessNameChange,
	onSubmit,
	isLoading,
	error,
}: Step1InfoProps) {
	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl font-bold text-foreground">Welcome to Gemz! 🎉</CardTitle>
				<CardDescription className="text-muted-foreground">
					Let's get to know you and your business better. This helps us personalize your experience.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className="space-y-2">
					<Label
						htmlFor="fullName"
						className="text-sm font-medium text-foreground flex items-center gap-2"
					>
						<User className="h-4 w-4" />
						Full Name
					</Label>
					<Input
						id="fullName"
						type="text"
						placeholder="e.g., John Doe"
						value={fullName}
						onChange={(e) => onFullNameChange(e.target.value)}
						className="h-12 text-base bg-zinc-800/50 border-zinc-700/50 focus:border-primary"
						disabled={isLoading}
					/>
				</div>

				<div className="space-y-2">
					<Label
						htmlFor="businessName"
						className="text-sm font-medium text-foreground flex items-center gap-2"
					>
						<Building className="h-4 w-4" />
						Business Name
					</Label>
					<Input
						id="businessName"
						type="text"
						placeholder="e.g., Acme Corp, John's Fitness Studio"
						value={businessName}
						onChange={(e) => onBusinessNameChange(e.target.value)}
						className="h-12 text-base bg-zinc-800/50 border-zinc-700/50 focus:border-primary"
						disabled={isLoading}
					/>
					<p className="text-xs text-muted-foreground">
						This could be your company name, brand name, or your own name if you're a solo
						entrepreneur.
					</p>
				</div>

				<Button
					onClick={onSubmit}
					className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
					disabled={isLoading}
				>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
							Saving...
						</div>
					) : (
						<div className="flex items-center gap-2">
							Continue
							<ArrowRight className="h-4 w-4" />
						</div>
					)}
				</Button>
			</CardContent>
		</>
	);
}
