import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile, incrementUsage } from '@/lib/db/queries/user-queries';
import { creatorProfiles } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { structuredConsole } from '@/lib/logging/console-proxy';
import type {
	CreatorEnrichmentPlatform,
	CreatorEnrichmentRecord,
	CreatorEnrichmentResult,
	CreatorEnrichmentSummary,
} from '@/types/creator-enrichment';

export type { CreatorEnrichmentResult } from '@/types/creator-enrichment';

// Breadcrumb: creator-enrichment service -> consumed by /api/creators/enrich & /api/creators/[id]/enriched-data -> stores Influencers.Club payloads + plan usage in Postgres.

const INFLUENCERS_CLUB_ENDPOINT =
	'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/';

const PLAN_ENRICHMENT_LIMITS: Record<string, number> = {
	free: 5,
	glow_up: 50,
	viral_surge: 200,
	fame_flex: -1,
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupportedPlatform = CreatorEnrichmentPlatform;

export class CreatorNotFoundError extends Error {
	public readonly identifier: string;

	constructor(identifier: string) {
		super(`Creator profile not found: ${identifier}`);
		this.name = 'CreatorNotFoundError';
		this.identifier = identifier;
	}
}

export class PlanLimitExceededError extends Error {
	public readonly limit: number;
	public readonly usage: number;
	public readonly plan: string;

	constructor(plan: string, usage: number, limit: number) {
		super(`Monthly enrichment limit reached for plan ${plan}`);
		this.name = 'PlanLimitExceededError';
		this.plan = plan;
		this.usage = usage;
		this.limit = limit;
	}
}

export class EnrichmentApiError extends Error {
	public readonly status: number;
	public readonly payload?: unknown;

	constructor(message: string, status: number, payload?: unknown) {
		super(message);
		this.name = 'EnrichmentApiError';
		this.status = status;
		this.payload = payload;
	}
}

interface EnrichmentMetadataContainer {
	enrichment?: CreatorEnrichmentRecord;
	[key: string]: unknown;
}

interface EnrichmentApiResponse {
	result?: Record<string, any> & {
		email?: string;
		emails?: string[];
		location?: string;
		other_links?: Record<string, any>;
		links_in_bio?: any;
	};
	detail?: string;
	error?: string;
	message?: string;
}

interface EnrichCreatorOptions {
	userId: string;
	creatorId?: string | null;
	handle: string;
	platform: SupportedPlatform;
	externalId?: string | null;
	displayName?: string | null;
	profileUrl?: string | null;
	metadata?: unknown;
	forceRefresh?: boolean;
}

const logger = createCategoryLogger(LogCategory.DATA);

export class CreatorEnrichmentService {
	private static ensureApiKey(): string {
		const apiKey = process.env.INFLUENCERS_CLUB_API_KEY;
		if (!apiKey) {
			throw new Error('INFLUENCERS_CLUB_API_KEY is not configured');
		}
		return apiKey;
	}

	private static resolveLimit(plan: string | undefined): number {
		if (!plan) return PLAN_ENRICHMENT_LIMITS.free;
		return PLAN_ENRICHMENT_LIMITS[plan] ?? -1;
	}

	private static buildSummary(result: EnrichmentApiResponse['result']): CreatorEnrichmentSummary {
		const followerCounts: Record<string, number> = {};
		const engagementRates: Record<string, number> = {};
		const emails = new Set<string>();
		let location: string | undefined;
		let lastContentTimestamp: string | undefined;
		const brands = new Set<string>();
		const crossPlatformHandles: Record<string, string> = {};

		if (!result) {
			return {
				primaryEmail: undefined,
				allEmails: [],
				followerCounts,
				engagementRates,
				brands: [],
				crossPlatformHandles,
				location,
				lastContentTimestamp,
			};
		}

		if (typeof result.email === 'string') {
			emails.add(result.email);
		}
		if (Array.isArray(result.emails)) {
			for (const email of result.emails) {
				if (typeof email === 'string') {
					emails.add(email);
				}
			}
		}

		if (typeof result.location === 'string') {
			location = result.location;
		} else if (result.location?.country || result.location?.city) {
			const pieces = [result.location.city, result.location.state, result.location.country].filter(
				Boolean
			);
			if (pieces.length > 0) {
				location = pieces.join(', ');
			}
		}

		Object.entries(result).forEach(([key, value]) => {
			if (!value || typeof value !== 'object') return;
			const platformData = value as Record<string, any>;
			if (platformData.email && typeof platformData.email === 'string') {
				emails.add(platformData.email);
			}
			if (typeof platformData.follower_count === 'number') {
				followerCounts[key] = platformData.follower_count;
			}
			if (typeof platformData.engagement_percent === 'number') {
				engagementRates[key] = platformData.engagement_percent;
			}
			if (Array.isArray(platformData.brands_found)) {
				platformData.brands_found.forEach((brand: unknown) => {
					if (typeof brand === 'string') {
						brands.add(brand);
					}
				});
			}
			if (!lastContentTimestamp && typeof platformData.most_recent_post_date === 'string') {
				lastContentTimestamp = platformData.most_recent_post_date;
			}
			if (platformData.related_platforms && typeof platformData.related_platforms === 'object') {
				Object.entries(platformData.related_platforms as Record<string, unknown>).forEach(
					([platformKey, handle]) => {
						if (typeof handle === 'string') {
							crossPlatformHandles[platformKey] = handle;
						}
					}
				);
			}
		});

		const allEmails = Array.from(emails);

		return {
			primaryEmail: allEmails[0],
			allEmails,
			followerCounts,
			engagementRates,
			brands: Array.from(brands),
			crossPlatformHandles,
			location,
			lastContentTimestamp,
		};
	}

	private static normalizeHandle(raw: string): string {
		return raw?.replace(/^@/, '').trim();
	}

	private static normalizeHandleForComparison(raw: string): string {
		return CreatorEnrichmentService.normalizeHandle(raw).toLowerCase();
	}

	private static isValidUuid(value: string | null | undefined): value is string {
		if (typeof value !== 'string') return false;
		return UUID_PATTERN.test(value);
	}

	private static async findCreatorRecord(args: {
		creatorId?: string | null;
		platform?: SupportedPlatform | string | null;
		handle?: string | null;
		externalId?: string | null;
	}) {
		if (args.creatorId && CreatorEnrichmentService.isValidUuid(args.creatorId)) {
			const byId = await db.query.creatorProfiles.findFirst({
				where: eq(creatorProfiles.id, args.creatorId),
			});
			if (byId) {
				return byId;
			}
		} else if (args.creatorId) {
			structuredConsole.warn('[creator-enrichment] ignoring non-uuid creatorId hint', {
				creatorId: args.creatorId,
			});
		}

		if (args.externalId) {
			const byExternal = await db.query.creatorProfiles.findFirst({
				where: eq(creatorProfiles.externalId, args.externalId),
			});
			if (byExternal) {
				return byExternal;
			}
		}

		const handleValue = args.handle ? CreatorEnrichmentService.normalizeHandle(args.handle) : null;
		if (!handleValue) {
			return null;
		}
		const handleLower = handleValue.toLowerCase();

		const platformValue = args.platform ? args.platform.toString() : null;

		if (platformValue) {
			const variants = Array.from(
				new Set(
					[
						platformValue,
						platformValue.toLowerCase(),
						platformValue.toUpperCase(),
						platformValue.charAt(0).toUpperCase() + platformValue.slice(1).toLowerCase(),
					].filter(Boolean)
				)
			);

			for (const variant of variants) {
				const direct = await db.query.creatorProfiles.findFirst({
					where: and(
						eq(creatorProfiles.platform, variant),
						eq(creatorProfiles.handle, handleValue)
					),
				});
				if (direct) {
					return direct;
				}
			}

			for (const variant of variants) {
				const platformCandidates = await db.query.creatorProfiles.findMany({
					where: eq(creatorProfiles.platform, variant),
					limit: 25,
				});
				const matched = platformCandidates.find((candidate) => {
					const candidateHandle =
						typeof candidate.handle === 'string'
							? CreatorEnrichmentService.normalizeHandle(candidate.handle)
							: null;
					return candidateHandle && candidateHandle.toLowerCase() === handleLower;
				});
				if (matched) {
					return matched;
				}
			}
		}

		const globalCandidates = await db.query.creatorProfiles.findMany({
			where: eq(creatorProfiles.handle, handleValue),
			limit: 25,
		});
		if (globalCandidates.length > 0) {
			return globalCandidates[0];
		}

		const fallbackCandidates = await db.query.creatorProfiles.findMany({
			limit: 50,
		});
		return (
			fallbackCandidates.find((candidate) => {
				const candidateHandle =
					typeof candidate.handle === 'string'
						? CreatorEnrichmentService.normalizeHandle(candidate.handle)
						: null;
				return candidateHandle && candidateHandle.toLowerCase() === handleLower;
			}) ?? null
		);
	}

	private static async callEnrichmentApi(args: {
		handle: string;
		platform: SupportedPlatform;
		includeLookalikes: boolean;
		emailRequired: 'preferred' | 'must_have';
	}): Promise<EnrichmentApiResponse> {
		const apiKey = CreatorEnrichmentService.ensureApiKey();

		const response = await fetch(INFLUENCERS_CLUB_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				handle: args.handle,
				platform: args.platform,
				include_lookalikes: args.includeLookalikes,
				email_required: args.emailRequired,
			}),
		});

		if (!response.ok) {
			let errorPayload: unknown;
			try {
				errorPayload = await response.json();
			} catch {
				errorPayload = await response.text();
			}

			structuredConsole.error('[creator-enrichment] external API error', {
				status: response.status,
				payload: errorPayload,
			});

			throw new EnrichmentApiError(
				'Influencers.Club enrichment request failed',
				response.status,
				errorPayload
			);
		}

		const json = (await response.json()) as EnrichmentApiResponse;
		return json;
	}

	private static normalizeMetadata(
		payload: EnrichmentApiResponse,
		context: {
			creatorId: string;
			creatorHandle?: string | null;
			creatorPlatform?: string | null;
			requestHandle: string;
			requestPlatform: SupportedPlatform;
		}
	): CreatorEnrichmentRecord {
		const enrichedAt = new Date().toISOString();
		const summary = CreatorEnrichmentService.buildSummary(payload.result);
		const displayHandle = context.creatorHandle?.trim()
			? context.creatorHandle
			: context.requestHandle;
		const displayPlatform = context.creatorPlatform?.trim()
			? context.creatorPlatform
			: context.requestPlatform;

		return {
			creatorId: context.creatorId,
			handle: displayHandle,
			platform: displayPlatform,
			enrichedAt,
			source: 'influencers_club',
			payload,
			summary,
			request: {
				handle: context.requestHandle,
				platform: context.requestPlatform,
				includeLookalikes: false,
				emailRequired: 'preferred',
			},
		};
	}

	private static async persistEnrichment(
		creatorId: string,
		enrichment: CreatorEnrichmentRecord,
		currentMetadata?: unknown
	): Promise<void> {
		const current: EnrichmentMetadataContainer =
			currentMetadata && typeof currentMetadata === 'object'
				? (currentMetadata as EnrichmentMetadataContainer)
				: {};

		const summary = enrichment.summary ?? {
			allEmails: [],
			primaryEmail: undefined,
		};
		const summaryEmails = Array.isArray(summary.allEmails) ? summary.allEmails : [];
		const normalizedEmails = summaryEmails
			.map((value) => (typeof value === 'string' ? value.trim() : null))
			.filter((value): value is string => Boolean(value));
		const existingEmails = Array.isArray((current as any)?.contactEmails)
			? ((current as any).contactEmails as string[])
			: [];
		const combinedEmails = Array.from(
			new Set(
				[...existingEmails, ...normalizedEmails].filter(
					(value) => typeof value === 'string' && value.trim().length
				)
			)
		);
		const primaryEmail =
			typeof summary.primaryEmail === 'string' && summary.primaryEmail.trim().length
				? summary.primaryEmail.trim()
				: ((current as any)?.primaryEmail ?? null);

		const nextMetadata: EnrichmentMetadataContainer = {
			...current,
			enrichment,
			contactEmails: combinedEmails,
			primaryEmail,
			lastEnrichedAt: enrichment.enrichedAt,
		};

		await db
			.update(creatorProfiles)
			.set({
				metadata: nextMetadata,
				updatedAt: new Date(),
			})
			.where(eq(creatorProfiles.id, creatorId));
	}

	private static async createPlaceholderCreator(input: {
		handle: string;
		platform: SupportedPlatform;
		externalId?: string | null;
		displayName?: string | null;
		profileUrl?: string | null;
		metadata?: unknown;
	}) {
		const normalizedHandle = CreatorEnrichmentService.normalizeHandle(input.handle);
		if (!normalizedHandle) {
			return null;
		}

		try {
			const [created] = await db
				.insert(creatorProfiles)
				.values({
					platform: input.platform,
					externalId: input.externalId ?? normalizedHandle,
					handle: normalizedHandle,
					displayName: input.displayName ?? null,
					url: input.profileUrl ?? null,
					metadata: {
						enrichmentPlaceholder: true,
						snapshot: input.metadata ?? null,
						createdAt: new Date().toISOString(),
					},
				})
				.returning({
					id: creatorProfiles.id,
					handle: creatorProfiles.handle,
					platform: creatorProfiles.platform,
					metadata: creatorProfiles.metadata,
				});

			return created ?? null;
		} catch (error) {
			structuredConsole.warn('[creator-enrichment] failed to insert placeholder creator', {
				error: error instanceof Error ? error.message : String(error),
				handle: normalizedHandle,
				platform: input.platform,
			});
			return null;
		}
	}

	public static async getCachedEnrichment(
		creatorId: string
	): Promise<CreatorEnrichmentRecord | null> {
		const creator = await db.query.creatorProfiles.findFirst({
			where: eq(creatorProfiles.id, creatorId),
			columns: {
				metadata: true,
			},
		});

		if (!creator) {
			throw new CreatorNotFoundError(creatorId);
		}

		const metadata = creator.metadata as EnrichmentMetadataContainer | null;
		if (!metadata?.enrichment) {
			return null;
		}

		return metadata.enrichment;
	}

	public static async getCachedEnrichmentByHandle(
		platform: SupportedPlatform,
		handle: string
	): Promise<CreatorEnrichmentRecord | null> {
		const creator = await CreatorEnrichmentService.findCreatorRecord({ platform, handle });
		if (!creator) {
			return null;
		}

		const metadata = creator.metadata as EnrichmentMetadataContainer | null;
		if (!metadata?.enrichment) {
			return null;
		}

		return metadata.enrichment;
	}

	public static async enrichCreator(
		options: EnrichCreatorOptions
	): Promise<CreatorEnrichmentResult> {
		const requestHandle = CreatorEnrichmentService.normalizeHandle(options.handle);
		const [userProfile, existingCreator] = await Promise.all([
			getUserProfile(options.userId),
			CreatorEnrichmentService.findCreatorRecord({
				creatorId: options.creatorId,
				handle: requestHandle,
				platform: options.platform,
				externalId: options.externalId,
			}),
		]);

		let creator = existingCreator;

		if (!userProfile) {
			throw new Error(`User not found: ${options.userId}`);
		}

		if (!creator) {
			creator = await CreatorEnrichmentService.createPlaceholderCreator({
				handle: requestHandle,
				platform: options.platform,
				externalId: options.externalId,
				displayName: options.displayName,
				profileUrl: options.profileUrl,
				metadata: options.metadata,
			});
		}

		if (!creator) {
			throw new CreatorNotFoundError(
				options.creatorId ?? options.externalId ?? `${options.platform}:${requestHandle}`
			);
		}

		const limit = CreatorEnrichmentService.resolveLimit(userProfile.currentPlan);
		const usage = userProfile.enrichmentsCurrentMonth ?? 0;

		const existingMetadata = creator.metadata as EnrichmentMetadataContainer | null;
		if (!options.forceRefresh && existingMetadata?.enrichment) {
			return {
				record: existingMetadata.enrichment,
				usage: {
					count: usage,
					limit,
				},
			};
		}

		if (limit >= 0 && usage >= limit) {
			logger.warn('Enrichment limit reached', {
				userId: options.userId,
				plan: userProfile.currentPlan,
				usage,
				limit,
			});
			throw new PlanLimitExceededError(userProfile.currentPlan, usage, limit);
		}

		logger.info('Calling Influencers.Club enrichment API', {
			userId: options.userId,
			creatorIdentifier: creator.id,
			handle: requestHandle,
			platform: options.platform,
		});

		const payload = await CreatorEnrichmentService.callEnrichmentApi({
			handle: requestHandle.toLowerCase(),
			platform: options.platform,
			includeLookalikes: false,
			emailRequired: 'preferred',
		});

		const record = CreatorEnrichmentService.normalizeMetadata(payload, {
			creatorId: creator.id,
			creatorHandle: creator.handle,
			creatorPlatform: creator.platform,
			requestHandle,
			requestPlatform: options.platform,
		});

		await CreatorEnrichmentService.persistEnrichment(creator.id, record, creator.metadata);

		await incrementUsage(options.userId, 'enrichments', 1);

		logger.info('Creator enrichment persisted', {
			userId: options.userId,
			creatorId: creator.id,
			enrichedAt: record.enrichedAt,
		});

		return {
			record,
			usage: {
				count: usage + 1,
				limit,
			},
		};
	}
}

export const creatorEnrichmentService = CreatorEnrichmentService;
