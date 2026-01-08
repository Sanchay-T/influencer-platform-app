import type { MetadataRoute } from 'next';

/**
 * Dynamic sitemap generation for SEO
 *
 * @context Only includes public pages that should be indexed.
 * Currently just the homepage since all other routes are authenticated.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = 'https://usegemz.io';

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 1.0,
		},
	];
}
