import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import type { CampaignListParams } from '@/lib/campaigns/campaign-list';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';

export async function listCampaignsForUser(userId: string, params: CampaignListParams) {
	const offset = (params.page - 1) * params.limit;

	const whereClauses = [eq(campaigns.userId, userId)];

	if (params.status !== 'all') {
		whereClauses.push(eq(campaigns.status, params.status));
	}

	if (params.q) {
		const searchClause = or(
			ilike(campaigns.name, `%${params.q}%`),
			ilike(campaigns.description, `%${params.q}%`)
		);
		if (searchClause) {
			whereClauses.push(searchClause);
		}
	}

	const where = and(...whereClauses);

	const orderBy =
		params.sortBy === 'alpha'
			? [asc(campaigns.name), desc(campaigns.createdAt)]
			: params.sortBy === 'updated'
				? [desc(campaigns.updatedAt), desc(campaigns.createdAt)]
				: [desc(campaigns.createdAt)];

	const [totalResult, userCampaigns] = await Promise.all([
		db.select({ count: count() }).from(campaigns).where(where),

		db
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				searchType: campaigns.searchType,
				status: campaigns.status,
				createdAt: campaigns.createdAt,
				updatedAt: campaigns.updatedAt,
			})
			.from(campaigns)
			.where(where)
			.orderBy(...orderBy)
			.limit(params.limit)
			.offset(offset),
	]);

	const totalCount = totalResult[0]?.count ?? 0;

	return {
		campaigns: userCampaigns,
		pagination: {
			total: totalCount,
			pages: Math.ceil(totalCount / params.limit),
			currentPage: params.page,
			limit: params.limit,
		},
	};
}
