import 'server-only';

import { z } from 'zod';
import rawArticleIndex from '@/data/seo/article-index.generated.json';
import rawArticles from '@/data/seo/articles.generated.json';
import type { SeoArticle, SeoArticleSummary } from '@/types/seo-content';

const articleSummarySchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(1),
	deck: z.string().min(1),
	category: z.union([z.literal('finding-creators'), z.literal('tools-platforms'), z.literal('career-trends')]),
	order: z.number().int().positive().nullable(),
	heroImage: z.string().min(1),
	heroAlt: z.string().min(1),
	readingTimeMinutes: z.number().int().positive(),
});

const articleBlockSchema = z.union([
	z.object({
		type: z.literal('heading'),
		text: z.string().min(1),
	}),
	z.object({
		type: z.literal('paragraph'),
		text: z.string().min(1),
	}),
	z.object({
		type: z.literal('list'),
		items: z.array(z.string().min(1)).min(1),
	}),
	z.object({
		type: z.literal('image'),
		image: z.string().min(1),
		alt: z.string().min(1),
	}),
	z.object({
		type: z.literal('table'),
		headers: z.array(z.string().min(1)).min(1),
		rows: z.array(z.array(z.string())).min(1),
		caption: z.string().optional(),
	}),
]);

const articleSchema = articleSummarySchema.extend({
	imageGallery: z.array(z.string().min(1)),
	blocks: z.array(articleBlockSchema),
	sourceFile: z.string().min(1),
});

const categoryRank = {
	'finding-creators': 0,
	'tools-platforms': 1,
	'career-trends': 2,
} as const;

function articleComparator(left: SeoArticleSummary, right: SeoArticleSummary): number {
	const categoryDifference = categoryRank[left.category] - categoryRank[right.category];
	if (categoryDifference !== 0) {
		return categoryDifference;
	}

	const leftOrder = left.order ?? Number.POSITIVE_INFINITY;
	const rightOrder = right.order ?? Number.POSITIVE_INFINITY;
	if (leftOrder !== rightOrder) {
		return leftOrder - rightOrder;
	}

	return left.title.localeCompare(right.title);
}

const articleIndex = z.array(articleSummarySchema).parse(rawArticleIndex);
const articleDetails = z.array(articleSchema).parse(rawArticles);

const sortedArticleIndex = [...articleIndex].sort(articleComparator);
const articleBySlug = new Map(articleDetails.map((article) => [article.slug, article]));

export function getSeoArticleIndex(): SeoArticleSummary[] {
	return sortedArticleIndex;
}

export function getFeaturedSeoArticles(limit = 4): SeoArticleSummary[] {
	return sortedArticleIndex.slice(0, Math.max(1, limit));
}

export function getSeoArticleBySlug(slug: string): SeoArticle | null {
	const article = articleBySlug.get(slug);
	if (!article) {
		return null;
	}
	return article;
}

export function getRelatedSeoArticles(slug: string, limit = 3): SeoArticleSummary[] {
	const current = articleBySlug.get(slug);
	if (!current) {
		return [];
	}

	const sameCategory = sortedArticleIndex.filter(
		(article) => article.slug !== slug && article.category === current.category,
	);
	const fallback = sortedArticleIndex.filter((article) => article.slug !== slug);
	const merged = [...sameCategory, ...fallback];
	const unique = new Map<string, SeoArticleSummary>();

	for (const article of merged) {
		if (!unique.has(article.slug)) {
			unique.set(article.slug, article);
		}
		if (unique.size >= limit) {
			break;
		}
	}

	const results = Array.from(unique.values());

	// USE2-75: Ensure at least 1 finding-creators guide in related articles
	const hasFindingCreators = results.some((a) => a.category === 'finding-creators');
	if (!hasFindingCreators && results.length >= limit) {
		const findingCreatorsArticle = sortedArticleIndex.find(
			(a) => a.slug !== slug && a.category === 'finding-creators' && !unique.has(a.slug),
		);
		if (findingCreatorsArticle) {
			results[results.length - 1] = findingCreatorsArticle;
		}
	}

	return results;
}
