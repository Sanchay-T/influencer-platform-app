import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { SeoArticleSummary } from '@/types/seo-content';

interface SeoArticleCardProps {
	article: SeoArticleSummary;
	priority?: boolean;
	compact?: boolean;
	featured?: boolean;
}

export function SeoArticleCard({
	article,
	priority = false,
	compact = false,
	featured = false,
}: SeoArticleCardProps) {
	const imageHeight = compact ? 'h-40' : featured ? 'h-72 lg:h-80' : 'h-52';
	const titleClasses = compact ? 'text-lg' : featured ? 'text-2xl lg:text-3xl' : 'text-xl';
	const deckLineClamp = featured ? 'line-clamp-4' : 'line-clamp-3';

	return (
		<Link
			href={`/blog/${article.slug}`}
			className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-black/30 shadow-[0_20px_70px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-white/35 hover:shadow-[0_28px_90px_rgba(255,46,204,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
		>
			<div className={`${imageHeight} relative overflow-hidden`}>
				<Image
					src={article.heroImage}
					alt={article.heroAlt}
					fill
					priority={priority}
					sizes={
						featured
							? '(max-width: 1024px) 100vw, 66vw'
							: compact
								? '(max-width: 1024px) 100vw, 40vw'
								: '(max-width: 1024px) 100vw, 30vw'
					}
					className="object-cover transition-transform duration-500 group-hover:scale-105"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
				<div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-4">
					<span className="rounded-full border border-white/25 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/80">
						{{ 'finding-creators': 'Finding Creators', 'tools-platforms': 'Tools & Platforms', 'career-trends': 'Career & Trends' }[article.category]}
					</span>
					<span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/70">
						{article.readingTimeMinutes} min
					</span>
				</div>
			</div>

			<div className={`${compact ? 'p-5' : featured ? 'p-7' : 'p-6'} flex flex-1 flex-col gap-3`}>
				<h3 className={`${titleClasses} text-pretty font-semibold leading-tight text-white`}>
					{article.title}
				</h3>
				<p className={`${deckLineClamp} text-sm leading-relaxed text-white/72 lg:text-base`}>
					{article.deck}
				</p>

				<div className="mt-auto flex items-center gap-2 text-sm font-semibold text-pink-200">
					Read article
					<ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
				</div>
			</div>
		</Link>
	);
}
