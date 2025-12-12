/**
 * CreatorGalleryView - Gallery/card view for displaying creator search results.
 * Shows creators in a responsive grid with visual previews.
 */

import { cn } from '@/lib/utils';
import type { CreatorSnapshot } from '../utils/creator-snapshot';
import type { Creator } from '../utils/creator-utils';
import { CreatorGalleryCard, type RowData } from './CreatorGalleryCard';

export interface CreatorGalleryViewProps {
	rows: RowData[];
	selectedCreators: Record<string, unknown>;
	platformNormalized: string;
	isInstagramUs: boolean;
	viewMode: string;
	// Callbacks
	toggleSelection: (rowId: string, snapshot: CreatorSnapshot) => void;
	renderProfileLink: (creator: Creator) => string;
}

export function CreatorGalleryView({
	rows,
	selectedCreators,
	platformNormalized,
	isInstagramUs,
	viewMode,
	toggleSelection,
	renderProfileLink,
}: CreatorGalleryViewProps) {
	return (
		<div className={cn('w-full p-4 md:p-6', viewMode === 'gallery' ? 'block' : 'hidden')}>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
				{rows.map((row) => (
					<CreatorGalleryCard
						key={row.id}
						row={row}
						isSelected={!!selectedCreators[row.id]}
						platformNormalized={platformNormalized}
						isInstagramUs={isInstagramUs}
						toggleSelection={toggleSelection}
						renderProfileLink={renderProfileLink}
					/>
				))}
			</div>
		</div>
	);
}
