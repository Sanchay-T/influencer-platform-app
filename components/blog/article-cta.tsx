import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface ArticleCtaProps {
	variant?: 'banner' | 'inline';
}

export function ArticleCta({ variant = 'inline' }: ArticleCtaProps) {
	if (variant === 'banner') {
		return (
			<div className="rounded-2xl border border-pink-400/25 bg-gradient-to-r from-pink-500/[0.08] via-pink-400/[0.04] to-transparent p-5 lg:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-base font-medium leading-snug text-white lg:text-lg">
						Find niche TikTok creators in 10 minutes with Gemz
					</p>
					<Link
						href="/signup"
						className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-400 hover:shadow-pink-500/35"
					>
						Try Gemz Free
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-white/12 bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent p-5 lg:p-6">
			<p className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-pink-300/80">
				Ready to find creators?
			</p>
			<p className="mb-4 text-sm leading-relaxed text-white/72 lg:text-base">
				Gemz uses real-time data and AI ranking to surface the right creators for your brand — no stale databases.
			</p>
			<Link
				href="/signup"
				className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-400 hover:shadow-pink-500/35"
			>
				Try Gemz Free
				<ArrowRight className="h-4 w-4" />
			</Link>
		</div>
	);
}
