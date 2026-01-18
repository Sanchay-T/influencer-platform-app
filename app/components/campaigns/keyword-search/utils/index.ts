/**
 * Re-exports all utility modules for clean imports.
 * Usage: import { extractEmails, buildEnrichmentTarget, ... } from './utils';
 */

// Bulk enrichment handler
export {
	type BulkEnrichResult,
	findCreatorMatch,
	processBulkEnrichResults,
} from './bulk-enrich-handler';
// Snapshot utilities
export {
	buildEnrichmentTarget,
	type CreatorSnapshot,
	type EnrichmentTarget,
	formatEnrichedAtLabel,
	resolveCreatorIdFromSnapshot,
	resolveExternalIdFromSnapshot,
} from './creator-snapshot';
// Creator utilities
export {
	arraysEqual,
	type Creator,
	type EmailEntry,
	extractEmails,
	formatFollowers,
	hasContactEmail,
	mergeEmailLists,
	normalizeEmailCandidate,
	normalizeEmailList,
	normalizeHandleValue,
	normalizePlatformValue,
	resolveInitials,
} from './creator-utils';
// Email handlers
export {
	getBioDataForCreator,
	getBioEmailForCreator,
	hasAnyEmail,
	saveBioEmail,
} from './email-handlers';
// Enrichment applier
export {
	applyEnrichmentToCreatorList,
	doesEntryMatchTarget,
	type EnrichmentOrigin,
	type EnrichmentRecord,
	patchCreatorEntry,
} from './enrichment-applier';
// Media handlers
export {
	ensureImageUrl,
	handleImageError,
	handleImageLoad,
	handleImageStart,
	resolveMediaPreview,
} from './media-handlers';
// Progress utilities
export {
	formatDuration,
	getProgressStage,
	PinkSpinner,
	type PinkSpinnerProps,
} from './progress-utils';
// Selection handlers
export {
	areAllSelectedOnPage,
	areSomeSelectedOnPage,
	clearSelection,
	handleSelectPage,
	type SelectedCreators,
	type SetSelectedCreators,
	toggleSelection,
} from './selection-handlers';
// Row transformation
export {
	type CreatorRow,
	type CreatorSnapshot as RowSnapshot,
	transformCreatorsToRows,
} from './transform-rows';
