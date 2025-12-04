'use client';

import { Check } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const plans = [
	{
		name: 'Glow Up',
		price: '$19/mo',
		features: ['Similar search', 'Keyword search', 'CSV export'],
		cta: 'Choose Glow Up',
	},
	{
		name: 'Viral Surge',
		price: '$49/mo',
		features: ['Unlimited search', 'Advanced analytics', 'Priority support'],
		cta: 'Choose Viral Surge',
	},
	{
		name: 'Fame Flex',
		price: '$99/mo',
		features: ['API access', 'Team seats', 'Enterprise SLA'],
		cta: 'Contact Sales',
	},
];

function PricingContent() {
	const params = useSearchParams();
	const green = (params.get('green') || 'affc41').toLowerCase();

	return (
		<div className={`theme-neon green-${green}`}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="text-center">
						<h1 className="text-2xl font-bold">Pricing (Theme Preview)</h1>
						<p className="text-sm text-muted-foreground">
							Magenta CTAs with adjustable green accents for highlights.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{plans.map((p) => (
							<Card key={p.name}>
								<CardHeader>
									<CardTitle className="text-lg">{p.name}</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-3xl font-bold mb-2">{p.price}</div>
									<ul className="space-y-2 mb-4">
										{p.features.map((f) => (
											<li key={f} className="flex items-center gap-2 text-sm">
												<Check className="h-4 w-4 text-chart-1" />
												<span>{f}</span>
											</li>
										))}
									</ul>
									<Button className="w-full">{p.cta}</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</DashboardLayout>
		</div>
	);
}

export default function PricingPreview() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<PricingContent />
		</Suspense>
	);
}
