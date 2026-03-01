import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SeoArticleCard } from '@/components/blog/seo-article-card';
import { getSeoArticleIndex } from '@/lib/seo-content';

export const metadata: Metadata = {
	title: 'Influencer Marketing Blog',
	description:
		'Actionable influencer discovery, creator marketing, and platform comparison guides from the Gemz team.',
	alternates: {
		canonical: 'https://usegemz.io/blog',
	},
	openGraph: {
		title: 'Gemz Blog',
		description:
			'Actionable influencer discovery, creator marketing, and platform comparison guides from the Gemz team.',
		url: 'https://usegemz.io/blog',
		type: 'website',
		images: ['/landing/og-preview.png'],
	},
};

export default function BlogPage() {
	const allArticles = getSeoArticleIndex();
	const [primaryFeature, ...secondaryFeatures] = allArticles;
	const supportingFeatures = secondaryFeatures.slice(0, 2);
	const findingCreatorsArticles = allArticles.filter((article) => article.category === 'finding-creators');
	const toolsPlatformsArticles = allArticles.filter((article) => article.category === 'tools-platforms');
	const careerTrendsArticles = allArticles.filter((article) => article.category === 'career-trends');
	const latestArticles = allArticles.slice(0, 6);

	return (
		<div className="relative min-h-screen overflow-hidden bg-black text-white">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/70 via-black to-black" />
			<div className="absolute left-1/2 top-0 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-pink-500/10 blur-3xl" />

			<div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-12">
				<header className="mb-14 space-y-7">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<Link
							href="/"
							className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/75 transition-colors hover:bg-white/10"
						>
							Back to Gemz
						</Link>
						<div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/75">
							{allArticles.length} published guides
						</div>
					</div>

					<div className="space-y-5">
						<p className="text-xs uppercase tracking-[0.22em] text-pink-300/90">Gemz Editorial</p>
						<h1 className="max-w-5xl text-balance text-4xl font-normal leading-tight lg:text-6xl">
							Guides for high-performing influencer discovery teams
						</h1>
						<p className="max-w-3xl text-base leading-relaxed text-white/75 lg:text-lg">
							Playbooks, platform breakdowns, and tactical walkthroughs from the same research pipeline
							that powers Gemz. Start with a featured guide, then deep-dive by category.
						</p>
					</div>
				</header>

				{primaryFeature && (
					<section className="mb-16 space-y-6" aria-labelledby="featured-guides-heading">
						<div className="flex items-center justify-between gap-4">
							<h2 id="featured-guides-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
								Featured Guides
							</h2>
							<Link
								href={`/blog/${primaryFeature.slug}`}
								className="inline-flex items-center gap-2 text-sm font-medium text-pink-200 hover:text-pink-100"
							>
								Read lead story
								<ArrowRight className="h-4 w-4" />
							</Link>
						</div>

						<div className="grid gap-6 lg:grid-cols-12">
							<div className="lg:col-span-8">
								<SeoArticleCard article={primaryFeature} featured priority />
							</div>
							<div className="grid gap-6 lg:col-span-4">
								{supportingFeatures.map((article, index) => (
									<SeoArticleCard key={article.slug} article={article} compact priority={index === 0} />
								))}
							</div>
						</div>
					</section>
				)}

				{findingCreatorsArticles.length > 0 && (
				<section className="mb-16 space-y-6" aria-labelledby="finding-creators-heading">
					<div className="flex items-center justify-between gap-4">
						<h2 id="finding-creators-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
							Finding Creators
						</h2>
						<p className="text-sm text-white/65">Discovery tactics and playbooks for sourcing the right influencers.</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						{findingCreatorsArticles.map((article, index) => (
							<SeoArticleCard key={article.slug} article={article} priority={index < 2} />
						))}
					</div>
				</section>
			)}

			{toolsPlatformsArticles.length > 0 && (
				<section className="mb-16 space-y-6" aria-labelledby="tools-platforms-heading">
					<div className="flex items-center justify-between gap-4">
						<h2 id="tools-platforms-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
							Tools & Platforms
						</h2>
						<p className="text-sm text-white/65">Platform comparisons, alternatives, and data accuracy breakdowns.</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{toolsPlatformsArticles.map((article) => (
							<SeoArticleCard key={article.slug} article={article} compact />
						))}
					</div>
				</section>
			)}

			{careerTrendsArticles.length > 0 && (
				<section className="mb-16 space-y-6" aria-labelledby="career-trends-heading">
					<div className="flex items-center justify-between gap-4">
						<h2 id="career-trends-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
							Career & Trends
						</h2>
						<p className="text-sm text-white/65">Industry news, career guides, and creator economy insights.</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{careerTrendsArticles.map((article) => (
							<SeoArticleCard key={article.slug} article={article} compact />
						))}
					</div>
				</section>
			)}

				<section className="mb-16 space-y-6" aria-labelledby="latest-guides-heading">
					<h2 id="latest-guides-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
						Latest from the Library
					</h2>
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{latestArticles.map((article) => (
							<SeoArticleCard key={`latest-${article.slug}`} article={article} compact />
						))}
					</div>
				</section>

				<section className="rounded-3xl border border-white/15 bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent p-8 lg:p-10">
					<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-3xl space-y-3">
							<p className="text-xs uppercase tracking-[0.2em] text-white/60">From content to pipeline</p>
							<h2 className="text-balance text-3xl font-semibold leading-tight lg:text-4xl">
								Ready to operationalize these strategies?
							</h2>
							<p className="text-base leading-relaxed text-white/75">
								Use Gemz to run real-time creator discovery and turn these playbooks into repeatable
								campaign workflows.
							</p>
						</div>
						<Link
							href="/signup"
							className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-400 hover:shadow-pink-500/35"
						>
							Try Gemz Free
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</section>
			</div>
		</div>
	);
}
