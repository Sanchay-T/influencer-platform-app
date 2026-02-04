'use client';

import { Menu, PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBilling } from '@/lib/hooks/use-billing';
import { cn } from '@/lib/utils';

export default function DashboardHeader({ onToggleSidebar, isSidebarOpen }) {
	const router = useRouter();
	const [q, setQ] = useState('');
	const inputRef = useRef(null);

	// Gate: whether user can create more campaigns (use billing hook to avoid duplicate fetch)
	const { isLoaded: billingLoaded, usageInfo } = useBilling();
	const [canCreateCampaign, setCanCreateCampaign] = useState(true);
	const [loadingGate, setLoadingGate] = useState(true);

	useEffect(() => {
		if (!billingLoaded) return;
		const used = Number(usageInfo?.campaignsUsed ?? 0);
		const limit = usageInfo?.campaignsLimit;
		const unlimited = limit === -1 || limit === null || typeof limit === 'undefined';
		setCanCreateCampaign(unlimited || used < Number(limit));
		setLoadingGate(false);
	}, [billingLoaded, usageInfo]);

	const onKeyDown = (e) => {
		if (e.key === 'Enter') {
			// Navigate to existing similar search page; no backend change
			router.push('/campaigns/search/similar');
		}
	};

	// Focus search when pressing '/'; ignore if typing in an input/textarea/select
	useEffect(() => {
		const handler = (e) => {
			if (e.key !== '/') return;
			const el = e.target;
			const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
			if (
				tag === 'input' ||
				tag === 'textarea' ||
				tag === 'select' ||
				(el && el.isContentEditable)
			) {
				return;
			}
			e.preventDefault();
			inputRef.current?.focus();
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);

	return (
		<div className="sticky top-0 z-50 border-b border-zinc-700/50 bg-zinc-900/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/70">
			<div className="px-4 py-2 sm:px-6 md:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2.5">
						{/* Global sidebar toggle */}
						<button
							type="button"
							aria-label="Toggle sidebar"
							aria-pressed={isSidebarOpen}
							onClick={onToggleSidebar}
							className={cn(
								'mr-1 inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-pink-500/30 lg:hidden',
								isSidebarOpen && 'bg-zinc-800/60 text-zinc-100'
							)}
						>
							<Menu className="h-5 w-5" />
						</button>
					</div>

					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
						<div className="relative w-full sm:w-auto">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
							<Input
								ref={inputRef}
								placeholder="Search or press /"
								value={q}
								onChange={(e) => setQ(e.target.value)}
								onKeyDown={onKeyDown}
								className="h-9 w-full max-w-full border-zinc-700/50 bg-zinc-800/60 pl-10 placeholder:text-zinc-500 focus:border-pink-400/60 focus:ring-2 focus:ring-pink-500/20 sm:w-60 md:w-72 lg:w-80"
							/>
						</div>
						{/* Single global CTA with plan gating */}
						{canCreateCampaign ? (
							<Link href="/campaigns/new" className="w-full sm:w-auto">
								<Button
									size="sm"
									className="w-full bg-pink-600 text-white hover:bg-pink-500"
									disabled={loadingGate}
								>
									<PlusCircle className="mr-2 h-4 w-4" />
									Create Campaign
								</Button>
							</Link>
						) : (
							<Link href="/billing" className="w-full sm:w-auto">
								<Button size="sm" className="w-full bg-pink-600 text-white hover:bg-pink-500">
									Subscribe
								</Button>
							</Link>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
