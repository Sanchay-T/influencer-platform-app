import { cache } from 'react';
import {
	type CreatorListDetail,
	type CreatorListSummary,
	getListDetail,
	getListsForUser,
} from '@/lib/db/queries/list-queries';

// Breadcrumb: list overview helpers -> used by RSC pages and REST endpoints to avoid duplicate fetches.

export type ListSummary = CreatorListSummary;
export type ListDetail = CreatorListDetail;

export const getListSummaries = cache(async (clerkUserId: string): Promise<ListSummary[]> => {
	return getListsForUser(clerkUserId);
});

export const getListDetailCached = cache(
	async (clerkUserId: string, listId: string): Promise<ListDetail> => {
		return getListDetail(clerkUserId, listId);
	}
);
