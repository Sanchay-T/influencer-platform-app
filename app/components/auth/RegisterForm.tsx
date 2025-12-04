'use client';

import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { signUp } from '@/app/auth/register/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function RegisterFormContent() {
	const [showPassword, setShowPassword] = React.useState(false);
	const searchParams = useSearchParams();
	const error = searchParams.get('error');

	return (
		<div className="flex flex-col gap-6 max-w-3xl mx-auto">
			<Card>
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl">Create an account</CardTitle>
					<CardDescription>Enter your information below to create your account</CardDescription>
				</CardHeader>
				<CardContent>
					<form action={signUp} className="flex flex-col gap-6">
						<div className="grid md:grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="name">Full Name</Label>
								<Input id="name" name="name" placeholder="John Doe" required />
							</div>

							<div className="grid gap-2">
								<Label htmlFor="company_name">Company Name</Label>
								<Input id="company_name" name="company_name" placeholder="Acme Inc." required />
							</div>

							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="industry">Industry</Label>
								<Input id="industry" name="industry" placeholder="Technology" required />
							</div>

							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" name="email" type="email" placeholder="m@example.com" required />
							</div>

							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="password">Password</Label>
								<div className="space-y-2">
									<div className="relative">
										<Input
											id="password"
											name="password"
											type={showPassword ? 'text' : 'password'}
											required
										/>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
											onClick={() => setShowPassword(!showPassword)}
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4 text-muted-foreground" />
											) : (
												<Eye className="h-4 w-4 text-muted-foreground" />
											)}
											<span className="sr-only">
												{showPassword ? 'Hide password' : 'Show password'}
											</span>
										</Button>
									</div>
									<div className="text-sm text-muted-foreground">
										Password must contain:
										<ul className="list-disc list-inside mt-1">
											<li>At least 6 characters</li>
											<li>At least one uppercase letter</li>
											<li>At least one lowercase letter</li>
											<li>At least one number</li>
										</ul>
									</div>
								</div>
							</div>
						</div>

						{error && <div className="text-sm text-red-500">{error}</div>}

						<div className="space-y-4">
							<Button type="submit" className="w-full">
								Create account
							</Button>

							<div className="text-center text-sm text-muted-foreground">
								Already have an account?{' '}
								<Link
									href="/auth/login"
									className="text-primary hover:underline underline-offset-4"
								>
									Sign in
								</Link>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

export function RegisterForm() {
	return (
		<Suspense
			fallback={
				<div className="flex flex-col gap-6 max-w-3xl mx-auto">
					<Card>
						<CardHeader className="space-y-1">
							<CardTitle className="text-2xl">Loading...</CardTitle>
						</CardHeader>
					</Card>
				</div>
			}
		>
			<RegisterFormContent />
		</Suspense>
	);
}
