/**
 * Row transformation utilities for converting raw creator data into
 * normalized row objects for display in table/gallery views.
 */

export interface CreatorSnapshot {
	platform: string;
	externalId: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	url: string;
	followers: number | null;
	engagementRate: number | null;
	category: string | null;
	metadata: unknown;
}

export interface CreatorRow {
	id: string;
	snapshot: CreatorSnapshot;
	raw: unknown;
}

/**
 * Transforms an array of creator objects into normalized rows for display.
 * Handles deduplication of row keys and extracts relevant fields from
 * various data structures (TikTok, Instagram, YouTube formats).
 */
export function transformCreatorsToRows(
	creators: Array<Record<string, unknown>>,
	platformNormalized: string,
	startIndex: number,
	renderProfileLink: (creator: unknown) => string
): CreatorRow[] {
	const seenRowKeys = new Set<string>();

	return creators.map((creator, index) => {
		const base = (creator?.creator as Record<string, unknown>) || creator;
		const platformValue =
			(base?.platform as string) || (creator.platform as string) || platformNormalized || 'tiktok';
		const platform = typeof platformValue === 'string' ? platformValue : String(platformValue);

		// Extract handle from various possible locations
		const handleRaw =
			base?.uniqueId ||
			base?.username ||
			base?.handle ||
			base?.name ||
			creator.username ||
			`creator-${startIndex + index}`;
		const handleValue =
			typeof handleRaw === 'string'
				? handleRaw
				: String(handleRaw ?? `creator-${startIndex + index}`);
		const handle = handleValue.trim().length ? handleValue : `creator-${startIndex + index}`;

		// Extract external ID from various possible locations
		const externalRaw =
			base?.id ??
			base?.userId ??
			base?.user_id ??
			base?.externalId ??
			base?.profileId ??
			creator.id ??
			creator.externalId ??
			handle ??
			`creator-${startIndex + index}`;
		const externalId =
			typeof externalRaw === 'string'
				? externalRaw
				: String(externalRaw ?? `creator-${startIndex + index}`);

		// Normalize for stable keys
		const idPlatform = (platform || platformNormalized || 'tiktok').toString().toLowerCase();
		const idExternal = (externalId || handle).toString().toLowerCase();
		let keyId = `${idPlatform}-${idExternal}`;

		// Handle duplicate keys
		if (seenRowKeys.has(keyId)) {
			let i = 1;
			while (seenRowKeys.has(`${keyId}-${i}`)) i++;
			keyId = `${keyId}-${i}`;
		}
		seenRowKeys.add(keyId);

		// Build snapshot with normalized data
		const stats = base?.stats as Record<string, unknown> | undefined;
		const snapshot: CreatorSnapshot = {
			platform,
			externalId,
			handle,
			displayName:
				(base?.name as string) ||
				(base?.displayName as string) ||
				(creator.displayName as string) ||
				null,
			avatarUrl:
				(base?.avatarUrl as string) ||
				(base?.profile_pic_url as string) ||
				(base?.profilePicUrl as string) ||
				(creator.profile_pic_url as string) ||
				(creator.profilePicUrl as string) ||
				(creator.avatarUrl as string) ||
				null,
			url: renderProfileLink(creator),
			followers:
				(stats?.followerCount as number) ??
				(base?.followerCount as number) ??
				(base?.followers as number) ??
				(creator.followers as number) ??
				((creator.stats as Record<string, unknown>)?.followerCount as number) ??
				null,
			engagementRate:
				(stats?.engagementRate as number) ??
				(base?.engagementRate as number) ??
				(creator.engagementRate as number) ??
				null,
			category:
				(base?.category as string) ||
				(base?.topic as string) ||
				(base?.niche as string) ||
				(creator.category as string) ||
				null,
			metadata: creator,
		};

		return {
			id: keyId,
			snapshot,
			raw: creator,
		};
	});
}
