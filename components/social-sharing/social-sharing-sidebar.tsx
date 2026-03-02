'use client';

import { CheckCircle, Clock, Gift } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useBilling } from '@/lib/hooks/use-billing';
import { isRecord, toRecord } from '@/lib/utils/type-guards';

type SubmissionStatus = 'none' | 'pending' | 'approved' | 'rejected';

export function SocialSharingSidebar() {
	const [status, setStatus] = useState<SubmissionStatus>('none');
	const [loading, setLoading] = useState(true);
	const billing = useBilling();

	const fetchStatus = useCallback(async () => {
		try {
			const res = await fetch('/api/social-sharing/status');
			if (!res.ok) return;
			const raw: unknown = await res.json();
			const record = toRecord(raw);
			if (!record) return;
			const resolved = toRecord(record.data) ?? record;
			const s = typeof resolved.status === 'string' ? resolved.status : '';
			if (s === 'pending' || s === 'approved' || s === 'rejected') {
				setStatus(s);
			}
		} catch {
			// Non-critical
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	if (loading || !billing.isLoaded) return null;

	// Already claimed — show a small success indicator
	if (status === 'approved') {
		return (
			<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
				<div className="flex items-center gap-2.5">
					<div className="shrink-0 rounded-lg bg-emerald-500/10 p-1.5">
						<CheckCircle className="h-4 w-4 text-emerald-400" />
					</div>
					<span className="text-xs text-zinc-400">Reward applied</span>
				</div>
			</div>
		);
	}

	// Pending review
	if (status === 'pending') {
		return (
			<div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
				<div className="flex items-center gap-2.5">
					<div className="shrink-0 rounded-lg bg-amber-500/10 p-1.5">
						<Clock className="h-4 w-4 text-amber-400" />
					</div>
					<span className="text-xs text-zinc-400">Post under review</span>
				</div>
			</div>
		);
	}

	// Already rejected — let them try again from the billing page
	if (status === 'rejected') return null;

	// CTA — derive offer text from billing
	const isEligible = billing.isTrialing || (billing.hasActiveSubscription && billing.isPaidUser);
	const creditAmount = billing.planFeatures?.price ?? 0;

	const label = billing.isTrialing
		? 'Earn +30 days'
		: creditAmount > 0
			? `Earn $${creditAmount} credit`
			: 'Earn a free month';

	return (
		<Link
			href="/billing"
			className={`group relative block overflow-hidden rounded-xl border p-3.5 transition-all ${
				isEligible
					? 'border-pink-500/20 bg-gradient-to-br from-pink-500/[0.08] via-zinc-900 to-zinc-900 hover:border-pink-500/40 hover:from-pink-500/[0.12]'
					: 'border-zinc-800/50 bg-zinc-900/40'
			}`}
		>
			<div className="flex items-center gap-3">
				<div
					className={`shrink-0 rounded-lg p-2 ${isEligible ? 'bg-pink-500/10' : 'bg-zinc-800/50'}`}
				>
					<Gift className={`h-5 w-5 ${isEligible ? 'text-pink-400' : 'text-zinc-600'}`} />
				</div>
				<div className="min-w-0">
					<p
						className={`text-sm font-semibold ${isEligible ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-500'}`}
					>
						{label}
					</p>
					<p className="text-xs text-zinc-400 leading-tight mt-0.5">Share Gemz on social</p>
				</div>
			</div>
		</Link>
	);
}
