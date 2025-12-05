'use client';

import { Lock, Shield } from 'lucide-react';

export function TrialInfoCard() {
	return (
		<div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
			<div className="flex items-start gap-3">
				<Shield className="h-5 w-5 text-emerald-400 mt-0.5" />
				<div>
					<h3 className="font-medium text-zinc-100 mb-1">7-Day Free Trial Included</h3>
					<p className="text-sm text-zinc-300">
						Start your trial immediately after onboarding. Full access to all features during the
						trial period.
					</p>
				</div>
			</div>
		</div>
	);
}

export function PaymentSecurityCard() {
	return (
		<div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
			<div className="flex items-start gap-3">
				<Lock className="h-5 w-5 text-pink-400 mt-0.5" />
				<div>
					<h3 className="font-medium text-zinc-100 mb-1">Secure Payment Processing</h3>
					<p className="text-sm text-zinc-300 mb-2">
						Payment method will be collected securely via Clerk's billing system after you complete
						onboarding.
					</p>
					<ul className="text-sm text-zinc-300 space-y-1">
						<li>• No charge during the 7-day trial</li>
						<li>• Cancel anytime before trial ends</li>
						<li>• Secure card storage with industry-standard encryption</li>
						<li>• Change plans or cancel from your dashboard</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
