import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface Args {
	articlesZip: string;
	imagesZip: string;
	outputDir: string;
	publicImagesDir: string;
}

type Category = 'finding-creators' | 'tools-platforms' | 'career-trends';

/**
 * USE2-76: Manual category overrides keyed by slug.
 * When adding new articles, add them here or they'll default to 'finding-creators'.
 */
const CATEGORY_OVERRIDES: Record<string, Category> = {
	// Finding Creators
	'influencer-discovery': 'finding-creators',
	'ugc-creators': 'finding-creators',
	'find-instagram-influencers-for-free': 'finding-creators',
	'find-tiktok-influencers-by-niche': 'finding-creators',
	// Tools & Platforms
	'heepsy-alternative': 'tools-platforms',
	'modash-alternative': 'tools-platforms',
	'upfluence-alternative': 'tools-platforms',
	'influencer-database-inaccurate': 'tools-platforms',
	// Career & Trends
	'influencer-marketing-jobs': 'career-trends',
	'influencer-marketing-news': 'career-trends',
};

type Block =
	| { type: 'heading'; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'image'; image: string; alt: string }
	| { type: 'table'; headers: string[]; rows: string[][]; caption?: string };

interface GeneratedArticle {
	slug: string;
	title: string;
	deck: string;
	category: Category;
	order: number | null;
	heroImage: string;
	heroAlt: string;
	readingTimeMinutes: number;
	imageGallery: string[];
	blocks: Block[];
	sourceFile: string;
}

interface GeneratedArticleSummary {
	slug: string;
	title: string;
	deck: string;
	category: Category;
	order: number | null;
	heroImage: string;
	heroAlt: string;
	readingTimeMinutes: number;
}

interface DocxParagraph {
	text: string;
	isListItem: boolean;
}

const DEFAULTS = {
	outputDir: path.resolve(process.cwd(), 'data/seo'),
	publicImagesDir: path.resolve(process.cwd(), 'public/seo/images'),
};

const IMAGE_EXTENSION_REGEX = /\.(png|jpg|jpeg|webp)$/i;

function parseArgs(argv: string[]): Partial<Args> {
	const parsed: Partial<Args> = {};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current.startsWith('--')) {
			continue;
		}

		const value = argv[index + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`Missing value for argument: ${current}`);
		}

		switch (current) {
			case '--articles-zip':
				parsed.articlesZip = path.resolve(value);
				break;
			case '--images-zip':
				parsed.imagesZip = path.resolve(value);
				break;
			case '--output-dir':
				parsed.outputDir = path.resolve(value);
				break;
			case '--public-images-dir':
				parsed.publicImagesDir = path.resolve(value);
				break;
			default:
				throw new Error(`Unknown argument: ${current}`);
		}

		index += 1;
	}

	return parsed;
}

function ensureZipExists(filePath: string, label: string): void {
	if (!existsSync(filePath)) {
		throw new Error(`${label} not found at ${filePath}`);
	}
}

function listFilesRecursive(directory: string): string[] {
	const files: string[] = [];
	const entries = readdirSync(directory, { withFileTypes: true });

	for (const entry of entries) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFilesRecursive(absolute));
			continue;
		}
		files.push(absolute);
	}

	return files;
}

function runUnzip(zipPath: string, destination: string): void {
	execFileSync('unzip', ['-o', zipPath, '-d', destination], {
		stdio: 'ignore',
	});
}

function decodeXmlEntities(input: string): string {
	return input
		.replaceAll('&amp;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'");
}

function normalizeWhitespace(input: string): string {
	return input.replace(/\s+/g, ' ').trim();
}

function extractDocxParagraphs(docxPath: string): DocxParagraph[] {
	const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'], {
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	});

	const paragraphMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
	const paragraphs: DocxParagraph[] = [];

	for (const paragraph of paragraphMatches) {
		const withLineBreaks = paragraph
			.replaceAll('<w:tab/>', '\t')
			.replaceAll('<w:br/>', '\n')
			.replaceAll('<w:cr/>', '\n');

		const textParts = Array.from(withLineBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g), (match) =>
			decodeXmlEntities(match[1]),
		);
		const combined = normalizeWhitespace(textParts.join(''));
		if (combined.length > 0) {
			paragraphs.push({
				text: combined,
				isListItem: /<w:numPr>/.test(paragraph),
			});
		}
	}

	return paragraphs;
}

function extractImageFileNames(text: string): string[] {
	const matches = text.matchAll(/([a-z0-9][a-z0-9-]*\.(?:png|jpg|jpeg|webp))/gi);
	const unique = new Set<string>();
	for (const match of matches) {
		unique.add(match[1].toLowerCase());
	}
	return Array.from(unique);
}

function removeImagePlaceholderText(text: string): string {
	const cleaned = text
		.replace(/\[?INSERT IMAGE:\s*[^\]\n]+\]?/gi, '')
		.replaceAll('###', '')
		.trim();
	return normalizeWhitespace(cleaned);
}

function toTitleCaseFromFileName(fileName: string): string {
	const withoutExt = fileName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
	const words = withoutExt
		.split('-')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
	return `${words.join(' ')} chart`;
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '');
}

function looksLikeHeading(line: string): boolean {
	if (line.length === 0 || line.length > 90) {
		return false;
	}
	if (/^https?:\/\//i.test(line)) {
		return false;
	}
	if (/^[\d,.:%$]+$/.test(line)) {
		return false;
	}

	if (line.endsWith('?')) {
		return true;
	}
	if (/^Method\s+\d+:/i.test(line)) {
		return true;
	}
	if (/^\d+\.\s+/.test(line)) {
		return true;
	}
	if (/^(What|Why|How|Types of|Top|Best|The\s[A-Z]|When|Where|Real Costs)/.test(line)) {
		return true;
	}

	return false;
}

function splitInlineList(line: string): { lead: string | null; items: string[] } | null {
	const bulletCount = (line.match(/\s-\s(?=[A-Za-z])/g) ?? []).length;
	if (bulletCount < 2) {
		return null;
	}

	const rawParts = line.split(/\s-\s(?=[A-Za-z])/).map((part) => normalizeWhitespace(part));
	const parts = rawParts.filter((part) => part.length > 0);
	if (parts.length < 3) {
		return null;
	}

	return {
		lead: parts[0],
		items: parts.slice(1),
	};
}

function appendTextBlocks(rawText: string, blocks: Block[]): void {
	const text = normalizeWhitespace(rawText);
	if (text.length === 0) {
		return;
	}

	if (text.startsWith('•')) {
		const items = text
			.split('•')
			.map((item) => normalizeWhitespace(item))
			.filter(Boolean);
		if (items.length > 0) {
			blocks.push({ type: 'list', items });
			return;
		}
	}

	const inlineList = splitInlineList(text);
	if (inlineList) {
		if (inlineList.lead) {
			blocks.push({ type: 'paragraph', text: inlineList.lead });
		}
		blocks.push({ type: 'list', items: inlineList.items });
		return;
	}

	if (looksLikeHeading(text)) {
		blocks.push({ type: 'heading', text });
		return;
	}

	blocks.push({ type: 'paragraph', text });
}

function countWords(blocks: Block[]): number {
	let totalWords = 0;
	for (const block of blocks) {
		if (block.type === 'image') {
			continue;
		}
		if (block.type === 'list') {
			for (const item of block.items) {
				totalWords += item.split(/\s+/).filter(Boolean).length;
			}
			continue;
		}
		totalWords += block.text.split(/\s+/).filter(Boolean).length;
	}
	return totalWords;
}

function articleSortComparator(a: GeneratedArticleSummary, b: GeneratedArticleSummary): number {
	const categoryRankMap: Record<Category, number> = { 'finding-creators': 0, 'tools-platforms': 1, 'career-trends': 2 };
	const categoryRank = (category: Category) => categoryRankMap[category];
	const categoryDiff = categoryRank(a.category) - categoryRank(b.category);
	if (categoryDiff !== 0) {
		return categoryDiff;
	}

	if (a.order !== null || b.order !== null) {
		const leftOrder = a.order ?? Number.POSITIVE_INFINITY;
		const rightOrder = b.order ?? Number.POSITIVE_INFINITY;
		if (leftOrder !== rightOrder) {
			return leftOrder - rightOrder;
		}
	}

	return a.title.localeCompare(b.title);
}

function main(): void {
	const cli = parseArgs(process.argv.slice(2));
	const args: Args = {
		articlesZip: cli.articlesZip ?? '',
		imagesZip: cli.imagesZip ?? '',
		outputDir: cli.outputDir ?? DEFAULTS.outputDir,
		publicImagesDir: cli.publicImagesDir ?? DEFAULTS.publicImagesDir,
	};

	if (!args.articlesZip || !args.imagesZip) {
		throw new Error(
			[
				'Usage: npm run seo:import -- --articles-zip <path/to/articles.zip> --images-zip <path/to/images.zip>',
				'Optional: --output-dir <path> --public-images-dir <path>',
			].join('\n'),
		);
	}

	ensureZipExists(args.articlesZip, 'Articles ZIP');
	ensureZipExists(args.imagesZip, 'Images ZIP');

	const tempRoot = path.resolve(process.cwd(), 'tmp/seo-import-runtime');
	const extractedArticlesDir = path.join(tempRoot, 'articles');
	const extractedImagesDir = path.join(tempRoot, 'images');

	rmSync(tempRoot, { recursive: true, force: true });
	mkdirSync(extractedArticlesDir, { recursive: true });
	mkdirSync(extractedImagesDir, { recursive: true });

	runUnzip(args.articlesZip, extractedArticlesDir);
	runUnzip(args.imagesZip, extractedImagesDir);

	const allDocxFiles = listFilesRecursive(extractedArticlesDir)
		.filter((filePath) => filePath.toLowerCase().endsWith('.docx'))
		.sort();
	if (allDocxFiles.length === 0) {
		throw new Error('No .docx files were found in the provided articles ZIP.');
	}

	const allImageFiles = listFilesRecursive(extractedImagesDir)
		.filter((filePath) => IMAGE_EXTENSION_REGEX.test(filePath.toLowerCase()))
		.sort();
	if (allImageFiles.length === 0) {
		throw new Error('No image files were found in the provided images ZIP.');
	}

	const imagePathByFileName = new Map<string, string>();
	for (const imageFile of allImageFiles) {
		const fileName = path.basename(imageFile).toLowerCase();
		const existing = imagePathByFileName.get(fileName);
		if (existing && existing !== imageFile) {
			throw new Error(
				`Image name collision detected for ${fileName}. Found both ${existing} and ${imageFile}.`,
			);
		}
		imagePathByFileName.set(fileName, imageFile);
	}

	mkdirSync(args.publicImagesDir, { recursive: true });
	for (const [fileName, sourcePath] of imagePathByFileName.entries()) {
		cpSync(sourcePath, path.join(args.publicImagesDir, fileName), { force: true });
	}

	const missingImages = new Set<string>();
	const generatedArticles: GeneratedArticle[] = [];

	for (const docxPath of allDocxFiles) {
		const relativeDocPath = path.relative(extractedArticlesDir, docxPath).replaceAll(path.sep, '/');
		const baseName = path.basename(docxPath, '.docx');
		const numberPrefix = baseName.match(/^(\d+)-(.+)$/);
		const order = numberPrefix ? Number.parseInt(numberPrefix[1], 10) : null;
		const slug = slugify(numberPrefix ? numberPrefix[2] : baseName);
		const category: Category = CATEGORY_OVERRIDES[slug] ?? 'finding-creators';

		const paragraphs = extractDocxParagraphs(docxPath);
		if (paragraphs.length < 2) {
			throw new Error(`Unexpected article structure in ${relativeDocPath}.`);
		}

		const title = normalizeWhitespace(paragraphs[0].text);
		const blocks: Block[] = [];
		const imageGallery = new Set<string>();
		let deck = '';
		let pendingListItems: string[] = [];

		const flushPendingListItems = (): void => {
			if (pendingListItems.length === 0) {
				return;
			}
			blocks.push({ type: 'list', items: pendingListItems });
			pendingListItems = [];
		};

		for (const paragraph of paragraphs.slice(1)) {
			const imageFiles = extractImageFileNames(paragraph.text);
			for (const imageFile of imageFiles) {
				flushPendingListItems();
				if (!imagePathByFileName.has(imageFile)) {
					missingImages.add(`${slug}: ${imageFile}`);
					continue;
				}
				const publicImagePath = `/seo/images/${imageFile}`;
				imageGallery.add(publicImagePath);
				blocks.push({
					type: 'image',
					image: publicImagePath,
					alt: toTitleCaseFromFileName(imageFile),
				});
			}

			const cleanedText = removeImagePlaceholderText(paragraph.text);
			if (cleanedText.length > 0) {
				if (paragraph.isListItem) {
					pendingListItems.push(cleanedText);
					continue;
				}
				flushPendingListItems();
				appendTextBlocks(cleanedText, blocks);
			}
		}

		flushPendingListItems();

		for (const block of blocks) {
			if (block.type === 'paragraph' && block.text.length > 40) {
				deck = block.text;
				break;
			}
		}
		if (!deck) {
			deck = `Read Gemz's guide on ${title.toLowerCase()}.`;
		}

		const imageGalleryList = Array.from(imageGallery);
		const heroImage = imageGalleryList[0] ?? '/landing/og-preview.jpg';
		const heroAlt = imageGalleryList[0]
			? toTitleCaseFromFileName(path.basename(imageGalleryList[0]))
			: `${title} hero image`;

		const readingTimeMinutes = Math.max(3, Math.round(countWords(blocks) / 220));

		generatedArticles.push({
			slug,
			title,
			deck,
			category,
			order,
			heroImage,
			heroAlt,
			readingTimeMinutes,
			imageGallery: imageGalleryList,
			blocks,
			sourceFile: relativeDocPath,
		});
	}

	const summaries: GeneratedArticleSummary[] = generatedArticles.map((article) => ({
		slug: article.slug,
		title: article.title,
		deck: article.deck,
		category: article.category,
		order: article.order,
		heroImage: article.heroImage,
		heroAlt: article.heroAlt,
		readingTimeMinutes: article.readingTimeMinutes,
	}));

	const sortedSummaries = [...summaries].sort(articleSortComparator);
	const summaryBySlug = new Map(sortedSummaries.map((summary) => [summary.slug, summary]));
	const sortedArticles = [...generatedArticles].sort((left, right) => {
		const leftSummary = summaryBySlug.get(left.slug);
		const rightSummary = summaryBySlug.get(right.slug);
		if (!leftSummary || !rightSummary) {
			return left.title.localeCompare(right.title);
		}
		return articleSortComparator(leftSummary, rightSummary);
	});

	mkdirSync(args.outputDir, { recursive: true });
	writeFileSync(
		path.join(args.outputDir, 'articles.generated.json'),
		`${JSON.stringify(sortedArticles, null, 2)}\n`,
		'utf8',
	);
	writeFileSync(
		path.join(args.outputDir, 'article-index.generated.json'),
		`${JSON.stringify(sortedSummaries, null, 2)}\n`,
		'utf8',
	);

	if (missingImages.size > 0) {
		console.warn('Warning: some image placeholders were not found in the images ZIP:');
		for (const missing of Array.from(missingImages).sort()) {
			console.warn(` - ${missing}`);
		}
	}

	console.log(`Imported ${sortedArticles.length} articles.`);
	console.log(`Copied ${imagePathByFileName.size} images to ${args.publicImagesDir}.`);
	console.log(`Generated data files in ${args.outputDir}.`);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
