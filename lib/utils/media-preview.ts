// Breadcrumb: resolveCreatorPreview feeds gallery cards (SearchResults, SimilarSearch, KeywordSearch) with platform-specific media covers.

type UnknownRecord = Record<string, any>;

const MAX_DEPTH = 6;

const PRIMARY_IMAGE_KEYS = [
	'preview',
	'previewUrl',
	'preview_url',
	'previewImage',
	'preview_image',
	'preview_image_url',
	'mediaPreview',
	'display_url',
	'displayUrl',
	'display_src',
	'displaySrc',
	'cover',
	'coverUrl',
	'cover_url',
	'default_cover',
	'defaultCover',
	'dynamic_cover',
	'dynamicCover',
	'origin_cover',
	'originCover',
	'animated_cover',
	'animatedCover',
	'thumbnail',
	'thumbnailUrl',
	'thumbnail_url',
	'thumbnail_src',
	'thumbnailSrc',
	'thumbnail_resource',
	'thumbnail_resources',
	'thumb',
	'thumbUrl',
	'thumb_url',
	'image',
	'imageUrl',
	'image_url',
	'image_versions',
	'image_versions2',
	'picture',
	'pictureUrl',
	'picture_url',
	'poster',
	'posterUrl',
	'poster_url',
	'carousel_media',
	'carouselMedia',
	'big_thumbs',
	'bigThumbs',
	'display_resources',
	'displayResources',
	'resources',
	'url_list',
	'urlList',
	'urls',
	'url',
	'src',
	'source',
];

const EXCLUDED_KEYS = new Set([
	'avatar',
	'avatarUrl',
	'avatar_url',
	'avatar_thumb',
	'avatarThumb',
	'avatar_medium',
	'avatarMedium',
	'avatar_hd',
	'avatarHd',
	'profile_pic_url',
	'profile_pic_url_hd',
	'profilePicUrl',
	'profilePicUrlHd',
	'author',
	'authorInfo',
	'authorAvatar',
	'owner',
]);

const normalizeCandidateUrl = (value: string | null | undefined): string | null => {
	if (!value) return null;
	const raw = value.trim();
	if (!raw) return null;

	if (raw.startsWith('//')) {
		return `https:${raw}`;
	}

	if (
		raw.startsWith('http://') ||
		raw.startsWith('https://') ||
		raw.startsWith('data:') ||
		raw.startsWith('blob:') ||
		raw.startsWith('/api/proxy/image')
	) {
		return raw;
	}

	return null;
};

const extractFirstUrl = (candidate: any, depth = 0): string | null => {
	if (candidate == null || depth > MAX_DEPTH) return null;

	if (typeof candidate === 'string') {
		return normalizeCandidateUrl(candidate);
	}

	if (Array.isArray(candidate)) {
		for (const entry of candidate) {
			const resolved = extractFirstUrl(entry, depth + 1);
			if (resolved) return resolved;
		}
		return null;
	}

	if (typeof candidate === 'object') {
		for (const key of PRIMARY_IMAGE_KEYS) {
			if (Object.hasOwn(candidate, key)) {
				const resolved = extractFirstUrl(candidate[key as keyof typeof candidate], depth + 1);
				if (resolved) return resolved;
			}
		}

		for (const key of Object.keys(candidate)) {
			if (PRIMARY_IMAGE_KEYS.includes(key) || EXCLUDED_KEYS.has(key)) continue;
			const resolved = extractFirstUrl(candidate[key as keyof typeof candidate], depth + 1);
			if (resolved) return resolved;
		}
	}

	return null;
};

export const resolveCreatorPreview = (
	creator: unknown,
	fallback?: string | null
): string | null => {
	if (!creator) return fallback ?? null;

	const subject = creator as UnknownRecord;

	const containers = [
		subject?.preview,
		subject?.previewUrl,
		subject?.preview_url,
		subject?.previewImage,
		subject?.preview_image,
		subject?.preview_image_url,
		subject?.mediaPreview,
		subject?.media_preview,
		subject?.video,
		subject?.latestVideo,
		subject?.content,
		subject?.media,
		subject?.node,
		subject?.post,
		subject?.reel,
		subject?.aweme?.video,
		subject?.aweme?.aweme_info?.video,
		subject?.aweme_info?.video,
		subject?.item?.video,
		subject?.itemStruct?.video,
		subject?.edge_owner_to_timeline_media?.edges?.[0]?.node,
		subject?.edge_web_media_to_related_media?.edges?.[0]?.node,
		subject?.edge_sidecar_to_children?.edges?.[0]?.node,
		subject?.edge_highlight_reels?.edges?.[0]?.node,
		subject?.carousel_media,
		subject?.carouselMedia,
		subject?.images,
		subject?.image_versions2?.candidates,
		subject?.image_versions?.candidates,
		subject?.resources,
		subject?.display_resources,
		subject?.displayResources,
		subject?.thumbnail,
		subject?.thumbnailUrl,
		subject?.thumbnail_url,
		subject?.display_url,
		subject?.displayUrl,
		subject?.image,
		subject?.imageUrl,
		subject?.picture,
		subject?.poster,
		subject?.cover,
		subject?.coverUrl,
		subject?.cover_url,
	];

	for (const container of containers) {
		const resolved = extractFirstUrl(container);
		if (resolved) {
			return resolved;
		}
	}

	return fallback ?? null;
};
