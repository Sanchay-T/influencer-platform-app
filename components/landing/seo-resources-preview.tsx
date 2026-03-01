import Link from 'next/link';
import { SeoArticleCard } from '@/components/blog/seo-article-card';
import type { SeoArticleSummary } from '@/types/seo-content';

interface SeoResourcesPreviewProps {
	articles: SeoArticleSummary[];
}

export function SeoResourcesPreview({ articles }: SeoResourcesPreviewProps) {
	return (
		<section className="relative z-10 bg-black px-6 py-24 lg:px-12" id="resources">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black" />
			<div className="relative z-10 mx-auto max-w-7xl space-y-10">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl space-y-4">
						<span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80">
							Insights Library
						</span>
						<h2 className="text-balance text-4xl font-normal leading-tight text-white lg:text-5xl">
							Influencer Growth Guides Built From Real Campaign Patterns
						</h2>
						<p className="max-w-2xl text-base leading-relaxed text-white/72 lg:text-lg">
							Use these field-tested resources to run discovery, evaluate creator fit, and launch
							faster without relying on stale influencer databases.
						</p>
					</div>
					<Link
						href="/blog"
						className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
					>
						Browse all articles
					</Link>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{articles.map((article, index) => (
						<SeoArticleCard key={article.slug} article={article} compact priority={index < 2} />
					))}
				</div>
			</div>
		</section>
	);
}
