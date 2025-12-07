'use client';

import { CreditCard } from 'lucide-react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PaymentStep from './payment-step';

interface Step3PlanProps {
	sessionId: string;
	userId?: string;
}

export default function Step3Plan({ sessionId, userId }: Step3PlanProps) {
	return (
		<>
			<CardHeader>
				<div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
					<CreditCard className="w-8 h-8 text-primary" />
				</div>
				<CardTitle className="text-2xl font-bold text-foreground text-center">
					Choose Your Plan 💳
				</CardTitle>
				<CardDescription className="text-muted-foreground text-center">
					Select the perfect plan for your influencer marketing needs.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<PaymentStep sessionId={sessionId} userId={userId} />
			</CardContent>
		</>
	);
}
