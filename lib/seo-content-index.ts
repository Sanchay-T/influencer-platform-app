import rawArticleIndex from '@/data/seo/article-index.generated.json';
import type { SeoArticleCategory } from '@/types/seo-content';
import type { SeoArticleSummary } from '@/types/seo-content';

const categoryRank = {
	pillar: 0,
	seo: 1,
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

function isSeoArticleCategory(value: string): value is SeoArticleCategory {
	return value === 'pillar' || value === 'seo';
}

const articleIndex: SeoArticleSummary[] = rawArticleIndex.map((article) => {
	if (!isSeoArticleCategory(article.category)) {
		throw new Error(`Invalid SEO article category: ${article.category}`);
	}

	return {
		slug: article.slug,
		title: article.title,
		deck: article.deck,
		category: article.category,
		order: article.order,
		heroImage: article.heroImage,
		heroAlt: article.heroAlt,
		readingTimeMinutes: article.readingTimeMinutes,
	};
});

export const seoArticleIndex = [...articleIndex].sort(articleComparator);

export function getFeaturedSeoArticleIndex(limit = 4): SeoArticleSummary[] {
	return seoArticleIndex.slice(0, Math.max(1, limit));
}
