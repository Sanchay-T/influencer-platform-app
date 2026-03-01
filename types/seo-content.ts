export type SeoArticleCategory = 'finding-creators' | 'tools-platforms' | 'career-trends';

export interface SeoArticleBlockHeading {
	type: 'heading';
	text: string;
}

export interface SeoArticleBlockParagraph {
	type: 'paragraph';
	text: string;
}

export interface SeoArticleBlockList {
	type: 'list';
	items: string[];
}

export interface SeoArticleBlockImage {
	type: 'image';
	image: string;
	alt: string;
}

export interface SeoArticleBlockTable {
	type: 'table';
	headers: string[];
	rows: string[][];
	caption?: string;
}

export type SeoArticleBlock =
	| SeoArticleBlockHeading
	| SeoArticleBlockParagraph
	| SeoArticleBlockList
	| SeoArticleBlockImage
	| SeoArticleBlockTable;

export interface SeoArticleSummary {
	slug: string;
	title: string;
	deck: string;
	category: SeoArticleCategory;
	order: number | null;
	heroImage: string;
	heroAlt: string;
	readingTimeMinutes: number;
}

export interface SeoArticle extends SeoArticleSummary {
	imageGallery: string[];
	blocks: SeoArticleBlock[];
	sourceFile: string;
}
