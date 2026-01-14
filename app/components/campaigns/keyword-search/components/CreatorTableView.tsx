/**
 * CreatorTableView - Table view for displaying creator search results.
 * Renders rows with full details including bio, email, views, and actions.
 */

import { Table, TableBody } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { EnrichmentTarget } from '../utils/creator-snapshot';
import type { Creator } from '../utils/creator-utils';
import { CreatorTableHeader } from './CreatorTableHeader';
import {
	type BioData,
	CreatorTableRow,
	type EnrichmentData,
	type RowData,
} from './CreatorTableRow';

export interface CreatorTableViewProps {
	rows: RowData[];
	selectedCreators: Record<string, unknown>;
	allSelectedOnPage: boolean;
	someSelectedOnPage: boolean;
	platformNormalized: string;
	bioLoading: boolean;
	viewMode: string;
	// Trial blur props
	isTrialUser?: boolean;
	trialClearLimit?: number;
	// Callbacks
	onSelectPage: (selected: boolean) => void;
	toggleSelection: (rowId: string, snapshot: unknown) => void;
	renderProfileLink: (creator: Creator) => string;
	getBioDataForCreator: (creator: Creator) => BioData | null;
	getBioEmailForCreator: (creator: Creator) => string | null;
	getEnrichment: (platform: string, handle: string) => EnrichmentData | null;
	isEnrichmentLoading: (platform: string, handle: string) => boolean;
	enrichCreator: (
		target: EnrichmentTarget & { forceRefresh?: boolean }
	) => Promise<EnrichmentData | null>;
	applyEnrichmentToCreators: (
		record: EnrichmentData,
		targetData: EnrichmentTarget,
		rawReference: Creator,
		origin: string
	) => void;
	setBioEmailConfirmDialog: (state: {
		open: boolean;
		creator: Creator | null;
		bioEmail: string | null;
		enrichmentTarget: EnrichmentTarget | null;
	}) => void;
}

export function CreatorTableView({
	rows,
	selectedCreators,
	allSelectedOnPage,
	someSelectedOnPage,
	platformNormalized,
	bioLoading,
	viewMode,
	isTrialUser = false,
	trialClearLimit = 25,
	onSelectPage,
	toggleSelection,
	renderProfileLink,
	getBioDataForCreator,
	getBioEmailForCreator,
	getEnrichment,
	isEnrichmentLoading,
	enrichCreator,
	applyEnrichmentToCreators,
	setBioEmailConfirmDialog,
}: CreatorTableViewProps) {
	return (
		<div className={cn('w-full', viewMode === 'table' ? 'block' : 'hidden')}>
			<div className="overflow-hidden lg:overflow-visible">
				<Table className="w-full">
					<CreatorTableHeader
						allSelectedOnPage={allSelectedOnPage}
						someSelectedOnPage={someSelectedOnPage}
						onSelectPage={onSelectPage}
					/>
					<TableBody className="divide-y divide-zinc-800">
						{rows.map((row, index) => (
							<CreatorTableRow
								key={row.id}
								row={row}
								isSelected={!!selectedCreators[row.id]}
								platformNormalized={platformNormalized}
								bioLoading={bioLoading}
								isBlurred={isTrialUser && index >= trialClearLimit}
								toggleSelection={toggleSelection}
								renderProfileLink={renderProfileLink}
								getBioDataForCreator={getBioDataForCreator}
								getBioEmailForCreator={getBioEmailForCreator}
								getEnrichment={getEnrichment}
								isEnrichmentLoading={isEnrichmentLoading}
								enrichCreator={enrichCreator}
								applyEnrichmentToCreators={applyEnrichmentToCreators}
								setBioEmailConfirmDialog={setBioEmailConfirmDialog}
							/>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
