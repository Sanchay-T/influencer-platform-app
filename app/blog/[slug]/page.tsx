import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SeoArticleCard } from '@/components/blog/seo-article-card';
import { ArticleCta } from '@/components/blog/article-cta';
import { getRelatedSeoArticles, getSeoArticleBySlug, getSeoArticleIndex } from '@/lib/seo-content';
import type { SeoArticleBlock } from '@/types/seo-content';

interface ArticlePageProps {
	params: Promise<{ slug: string }>;
}

interface HeadingAnchor {
	id: string;
	text: string;
	blockIndex: number;
}

function toAnchorId(text: string, index: number): string {
	const slug = text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 48);
	return `${slug || 'section'}-${index + 1}`;
}

function buildHeadingAnchors(blocks: SeoArticleBlock[]): HeadingAnchor[] {
	const anchors: HeadingAnchor[] = [];

	for (const [index, block] of blocks.entries()) {
		if (block.type !== 'heading') {
			continue;
		}
		anchors.push({
			id: toAnchorId(block.text, anchors.length),
			text: block.text,
			blockIndex: index,
		});
	}

	return anchors;
}

export function generateStaticParams() {
	return getSeoArticleIndex().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
	const { slug } = await params;
	const article = getSeoArticleBySlug(slug);

	if (!article) {
		return {
			title: 'Article not found',
		};
	}

	const canonicalUrl = `https://usegemz.io/blog/${article.slug}`;

	return {
		title: article.title,
		description: article.deck,
		alternates: {
			canonical: canonicalUrl,
		},
		openGraph: {
			title: article.title,
			description: article.deck,
			url: canonicalUrl,
			type: 'article',
			images: [
				{
					url: article.heroImage,
					alt: article.heroAlt,
				},
			],
		},
		twitter: {
			card: 'summary_large_image',
			title: article.title,
			description: article.deck,
			images: [article.heroImage],
		},
	};
}

function renderBlock(block: SeoArticleBlock, key: string, headingId: string | null) {
	if (block.type === 'heading') {
		return (
			<h2
				key={key}
				id={headingId ?? undefined}
				className="scroll-mt-28 border-t border-white/10 pt-8 text-2xl font-semibold leading-tight text-white lg:text-3xl"
			>
				{block.text}
			</h2>
		);
	}

	if (block.type === 'paragraph') {
		return (
			<p key={key} className="text-base leading-relaxed text-white/84 lg:text-[1.05rem]">
				{block.text}
			</p>
		);
	}

	if (block.type === 'list') {
		return (
			<ul
				key={key}
				className="list-disc space-y-2.5 pl-6 text-base leading-relaxed text-white/84 marker:text-pink-300 lg:text-[1.05rem]"
			>
				{block.items.map((item, index) => (
					<li key={`${key}-${index + 1}`}>{item}</li>
				))}
			</ul>
		);
	}

	if (block.type === 'table') {
		return (
			<div key={key} className="overflow-x-auto">
				<table className="w-full border-collapse rounded-xl border border-white/12 text-sm lg:text-base">
					<thead>
						<tr className="border-b border-white/12 bg-white/[0.06]">
							{block.headers.map((header, i) => (
								<th
									key={`${key}-h-${i}`}
									className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/80"
								>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{block.rows.map((row, rowIndex) => (
							<tr key={`${key}-r-${rowIndex}`} className="border-b border-white/8 last:border-b-0">
								{row.map((cell, cellIndex) => (
									<td
										key={`${key}-r-${rowIndex}-c-${cellIndex}`}
										className="px-4 py-3 text-white/78"
									>
										{cell}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{block.caption && (
					<p className="mt-2 text-center text-xs text-white/50">{block.caption}</p>
				)}
			</div>
		);
	}

	return (
		<figure
			key={key}
			className="overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-black/30 shadow-[0_20px_70px_rgba(0,0,0,0.35)]"
		>
			<Image
				src={block.image}
				alt={block.alt}
				width={1200}
				height={675}
				sizes="(max-width: 1024px) 100vw, 860px"
				className="h-auto w-full object-cover"
			/>
			<figcaption className="border-t border-white/12 px-4 py-3 text-xs uppercase tracking-[0.15em] text-white/60">
				{block.alt}
			</figcaption>
		</figure>
	);
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
	const { slug } = await params;
	const article = getSeoArticleBySlug(slug);
	if (!article) {
		notFound();
	}

	const relatedArticles = getRelatedSeoArticles(slug, 3);
	const headingAnchors = buildHeadingAnchors(article.blocks);
	const headingByBlockIndex = new Map(headingAnchors.map((heading) => [heading.blockIndex, heading.id]));
	const showJumpLinks = headingAnchors.length >= 3;

	return (
		<div className="relative min-h-screen overflow-hidden bg-black text-white">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/65 via-black to-black" />

			<div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-12">
				<header className="mb-10 space-y-6">
					<Link
						href="/blog"
						className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/10"
					>
						Back to articles
					</Link>

					<div className="grid gap-8 lg:grid-cols-12 lg:items-start">
						<div className="space-y-5 lg:col-span-8">
							<div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/65">
								<span>{{ 'finding-creators': 'Finding Creators', 'tools-platforms': 'Tools & Platforms', 'career-trends': 'Career & Trends' }[article.category]}</span>
								<span>{article.readingTimeMinutes} min read</span>
							</div>
							<h1 className="text-balance text-4xl font-normal leading-tight lg:text-6xl">
								{article.title}
							</h1>
							<p className="max-w-3xl text-base leading-relaxed text-white/75 lg:text-lg">
								{article.deck}
							</p>
						</div>
						<div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] lg:col-span-4">
							<Image
								src={article.heroImage}
								alt={article.heroAlt}
								width={800}
								height={540}
								sizes="(max-width: 1024px) 100vw, 28vw"
								className="h-full w-full object-cover"
							/>
						</div>
					</div>
				</header>

				<div className="mb-8">
					<ArticleCta variant="banner" />
				</div>

				<div className={showJumpLinks ? 'grid gap-10 lg:grid-cols-12 lg:items-start' : ''}>
					<article className={`space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:p-8 ${showJumpLinks ? 'lg:col-span-8' : ''}`}>
						{(() => {
							const elements: React.ReactNode[] = [];
							let headingCount = 0;
							let midCtaInserted = false;

							for (const [index, block] of article.blocks.entries()) {
								if (block.type === 'heading') {
									headingCount++;
								}

								// Insert mid-article CTA after the 2nd heading
								if (headingCount === 2 && block.type === 'heading' && !midCtaInserted) {
									elements.push(
										<ArticleCta key="mid-article-cta" />,
									);
									midCtaInserted = true;
								}

								elements.push(
									renderBlock(
										block,
										`${article.slug}-${index}`,
										headingByBlockIndex.get(index) ?? null,
									),
								);
							}

							return elements;
						})()}
					</article>

					{showJumpLinks && (
						<aside className="hidden lg:col-span-4 lg:block">
							<div className="sticky top-28 rounded-2xl border border-white/12 bg-white/[0.04] p-5">
								<p className="text-xs uppercase tracking-[0.18em] text-white/60">Jump to section</p>
								<nav className="mt-4 space-y-2">
									{headingAnchors.map((heading) => (
										<a
											key={heading.id}
											href={`#${heading.id}`}
											className="block rounded-md px-2 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
										>
											{heading.text}
										</a>
									))}
								</nav>
							</div>
						</aside>
					)}
				</div>

				<div className="mt-12 grid gap-6 lg:grid-cols-12">
					<div className="rounded-2xl border border-white/12 bg-white/[0.04] p-6 lg:col-span-5 lg:p-8">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/80">Pricing</p>
						<p className="mt-3 text-3xl font-semibold text-white">Starting at $99<span className="text-lg font-normal text-white/60">/mo</span></p>
						<p className="mt-2 text-sm leading-relaxed text-white/65">
							Real-time creator search, AI ranking, and audience analytics. No annual contracts.
						</p>
						<Link
							href="/signup"
							className="mt-5 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-400 hover:shadow-pink-500/35"
						>
							Start free trial
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>

					<div className="rounded-2xl border border-white/15 bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent p-6 lg:col-span-7 lg:p-8">
						<h2 className="text-2xl font-semibold tracking-tight text-white">Need better creator discovery?</h2>
						<p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/72 lg:text-base">
							Gemz combines real-time creator search with AI ranking so you can move from keyword to
							qualified outreach without spreadsheet-heavy workflows.
						</p>
						<Link
							href="/signup"
							className="mt-5 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-400 hover:shadow-pink-500/35"
						>
							Try Gemz Free
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</div>

			{relatedArticles.length > 0 && (
				<section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 lg:px-12" aria-labelledby="related-guides-heading">
					<h2 id="related-guides-heading" className="mb-6 text-2xl font-semibold tracking-tight text-white">
						Related guides
					</h2>
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{relatedArticles.map((related) => (
							<SeoArticleCard key={related.slug} article={related} compact />
						))}
					</div>
				</section>
			)}
		</div>
	);
}
