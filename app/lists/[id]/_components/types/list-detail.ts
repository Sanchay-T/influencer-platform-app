/**
 * Types for the list detail page
 * Extracted from list-detail-client.tsx for modularity
 */
import type { ListDetail } from '@/lib/lists/overview';

// Re-export the base type
export type { ListDetail };

// Derived types
export type ListItem = ListDetail['items'][number];
export type ColumnState = Record<string, ListItem[]>;

// Alias for card components
export type CreatorListItem = ListItem;

// Component props
export interface ListDetailClientProps {
	listId: string;
	initialDetail: ListDetail;
}

// Constants
export const bucketLabels: Record<string, string> = {
	backlog: 'Backlog',
	shortlist: 'Shortlist',
	contacted: 'Contacted',
	booked: 'Booked',
};

export const defaultBucketOrder = ['backlog', 'shortlist', 'contacted', 'booked'];

// Meta form state
export interface MetaFormState {
	name: string;
	description: string;
	type: string;
}
