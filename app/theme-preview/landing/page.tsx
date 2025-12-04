'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function LandingContent() {
	const params = useSearchParams();
	const green = (params.get('green') || 'affc41').toLowerCase();

	return (
		<div className={`theme-neon green-${green}`}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold">Welcome back</h1>
							<p className="text-sm text-muted-foreground">
								This mirrors the first signed-in view with the shell.
							</p>
						</div>
						<div className="flex gap-2">
							<Button variant="outline">Quick Import</Button>
							<Button>Create Campaign</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm text-muted-foreground">Active Campaigns</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">12</div>
								<p className="text-xs text-muted-foreground mt-1">3 starting this week</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm text-muted-foreground">New Creators</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">48</div>
								<p className="text-xs text-muted-foreground mt-1">from similar search</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm text-muted-foreground">Exports</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">5</div>
								<p className="text-xs text-muted-foreground mt-1">CSV downloads this month</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</DashboardLayout>
		</div>
	);
}

export default function LandingPreview() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<LandingContent />
		</Suspense>
	);
}
