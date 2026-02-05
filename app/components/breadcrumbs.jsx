'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function Breadcrumbs({
	items,
	showBackButton = true,
	backHref,
	backLabel = 'Back to Campaign',
}) {
	const router = useRouter();

	const handleBack = () => {
		if (backHref) {
			router.push(backHref);
			return;
		}

		// Find the campaign item to navigate back to
		const campaignItem = items.find((item) => item.type === 'campaign');
		if (campaignItem?.href) {
			router.push(campaignItem.href);
		} else {
			// Fallback to dashboard
			router.push('/dashboard');
		}
	};

	return (
		<div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400">
				{items.map((item, index) => (
					<div key={`${item.href ?? item.label}-${item.label}`} className="flex items-center">
						{item.href ? (
							<Link href={item.href} className="hover:text-zinc-200 transition-colors duration-200">
								{item.label}
							</Link>
						) : (
							<span className={index === items.length - 1 ? 'text-zinc-100 font-medium' : ''}>
								{item.label}
							</span>
						)}
						{index < items.length - 1 && <ChevronRight className="mx-1.5 h-4 w-4 text-zinc-500" />}
					</div>
				))}
			</nav>

			{showBackButton && (
				<Button
					variant="outline"
					size="sm"
					onClick={handleBack}
					className="flex items-center gap-2 self-start whitespace-nowrap md:self-auto"
				>
					<ArrowLeft className="h-4 w-4" />
					{backLabel}
				</Button>
			)}
		</div>
	);
}
