'use client';

import { Clock, Lock, Shield, Sparkles } from 'lucide-react';

function getTrialEndDate(): string {
	const date = new Date();
	date.setDate(date.getDate() + 7);
	return date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

export function FreeTrialBanner() {
	const chargeDate = getTrialEndDate();

	return (
		<div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/20 border-2 border-emerald-500/50 p-5">
			<div className="absolute top-2 right-3 text-emerald-400/60">
				<Sparkles className="h-5 w-5" />
			</div>

			<div className="flex flex-col items-center text-center gap-3">
				<div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/30">
					<Clock className="h-5 w-5" />
					7-DAY FREE TRIAL
				</div>

				<div className="space-y-1">
					<p className="text-emerald-100 font-semibold text-base">
						$0.00 due today — Start exploring now!
					</p>
					<p className="text-emerald-200/80 text-sm">
						You won't be charged until <span className="font-semibold text-emerald-100">{chargeDate}</span>
					</p>
				</div>

				<div className="flex items-center gap-4 text-xs text-emerald-300/70 mt-1">
					<span className="flex items-center gap-1">
						<Shield className="h-3 w-3" />
						Cancel anytime
					</span>
					<span className="flex items-center gap-1">
						<Lock className="h-3 w-3" />
						No hidden fees
					</span>
				</div>
			</div>
		</div>
	);
}

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
