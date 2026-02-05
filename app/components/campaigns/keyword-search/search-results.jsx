'use client';

/**
 * SearchResults - Simplified component using clean architecture
 *
 * @why From 500+ lines to ~200 lines by using single source of truth (useSearchJob)
 * Frontend is "dumb" - just displays what backend says
 *
 * @context Part of clean architecture refactor (TASK-008)
 * Replaces: useCreatorSearch, useBioEnrichment, useAutoFetchAllPages, SearchProgress
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { StartSubscriptionModal } from '@/app/components/billing/start-subscription-modal';
import { useStartSubscription } from '@/lib/hooks/use-start-subscription';
import { useTrialStatus } from '@/lib/hooks/use-trial-status';
import { CreatorGalleryView } from './components/CreatorGalleryView';
import { CreatorTableView } from './components/CreatorTableView';
import { EmailFilterOverlay } from './components/EmailFilterOverlay';
import { PaginationControls } from './components/PaginationControls';
import { ProgressDisplay } from './components/ProgressDisplay';
import { ResultsContainer } from './components/ResultsContainer';
import { SearchResultsHeader } from './components/SearchResultsHeader';
import { TrialUpgradeOverlay } from './components/TrialUpgradeOverlay';
import { useSearchJob } from './hooks/useSearchJob';
import { useCreatorEnrichment } from './useCreatorEnrichment';
import {
	buildEnrichmentTarget,
	hasAnyEmail,
	processBulkEnrichResults,
	transformCreatorsToRows,
} from './utils';
import { applyEnrichmentToCreatorList } from './utils/enrichment-applier';
import { buildProfileLink } from './utils/profile-link';

// ============================================================================
// Helper: Email filtering
// ============================================================================

function useEmailFilter(creators, _platformNormalized) {
	const [showEmailOnly, setShowEmailOnly] = useState(false);
	const [emailOverlayDismissed, setEmailOverlayDismissed] = useState(false);

	const hasEmail = useCallback(
		(creator) => hasAnyEmail(creator, {}), // No bio data needed - server already enriched
		[]
	);

	const filteredCreators = useMemo(() => {
		if (!showEmailOnly) {
			return creators;
		}
		return creators.filter(hasEmail);
	}, [creators, showEmailOnly, hasEmail]);

	const emailCount = useMemo(() => creators.filter(hasEmail).length, [creators, hasEmail]);

	const shouldShowEmailOverlay =
		!emailOverlayDismissed && showEmailOnly && filteredCreators.length === 0 && emailCount === 0;

	return {
		showEmailOnly,
		setShowEmailOnly,
		filteredCreators,
		emailCount,
		emailOverlayDismissed,
		setEmailOverlayDismissed,
		shouldShowEmailOverlay,
	};
}

// ============================================================================
// Constants
// ============================================================================

const TRIAL_CLEAR_LIMIT = 25; // Number of results shown clearly to trial users

// Plan prices for the modal (in dollars) - includes both new and legacy plans
const PLAN_PRICES = {
	// New plans (Jan 2026)
	growth: 199,
	scale: 599,
	pro: 1999,
	// Legacy plans (grandfathered)
	glow_up: 99,
	viral_surge: 249,
	fame_flex: 499,
};

// Plan display names
const PLAN_NAMES = {
	// New plans (Jan 2026)
	growth: 'Growth',
	scale: 'Scale',
	pro: 'Pro',
	// Legacy plans (grandfathered)
	glow_up: 'Glow Up',
	viral_surge: 'Viral Surge',
	fame_flex: 'Fame Flex',
};

// ============================================================================
// Main Component
// ============================================================================

const SearchResults = ({ searchData }) => {
	const jobId = searchData?.jobId;
	const platformNormalized = (searchData?.platform ?? '').toLowerCase().replace(/[-_]/g, '');

	// Trial status for blurring results
	const { isTrialUser, currentPlan } = useTrialStatus();

	// Single source of truth for job state
	const {
		message,
		progress,
		creatorsFound,
		creators,
		totalCreators,
		currentPage,
		itemsPerPage,
		setPage,
		setItemsPerPage,
		isComplete,
		isActive,
		isPageLoading,
	} = useSearchJob(jobId, platformNormalized);

	// UI state
	const [viewMode, setViewMode] = useState('table');
	const [selectedCreators, setSelectedCreators] = useState({});
	const [campaignName, setCampaignName] = useState('Campaign');
	const [localCreators, setLocalCreators] = useState([]);
	const resultsHeaderRef = useRef(null);

	// Start subscription modal state (USE2-40)
	const [showStartModal, setShowStartModal] = useState(false);
	const {
		startSubscription,
		openPortal,
		isLoading: isStartingSubscription,
	} = useStartSubscription();
	const { refetch: refetchTrialStatus } = useTrialStatus();

	// Enrichment hook (for Enrich button only)
	const {
		getEnrichment,
		isLoading: isEnrichmentLoading,
		enrichCreator,
		enrichMany,
		usage: enrichmentUsage,
		bulkState: enrichmentBulkState,
	} = useCreatorEnrichment();

	// Email filtering
	const {
		showEmailOnly,
		setShowEmailOnly,
		filteredCreators,
		emailCount,
		setEmailOverlayDismissed,
		shouldShowEmailOverlay,
	} = useEmailFilter(localCreators, platformNormalized);

	// Sync creators from hook to local state
	useEffect(() => {
		if (creators && creators.length > 0) {
			setLocalCreators(creators);
		}
	}, [creators]);

	// Derived values
	const isInstagramUs = ['instagram', 'instagramusreels', 'instagram10'].includes(
		platformNormalized
	);

	const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
	const selectionCount = selectedSnapshots.length;
	const selectedEnrichmentTargets = useMemo(
		() => selectedSnapshots.map((snapshot) => buildEnrichmentTarget(snapshot, platformNormalized)),
		[selectedSnapshots, platformNormalized]
	);

	// Transform creators to rows for table/gallery
	const renderProfileLink = useCallback(
		(creator) => buildProfileLink(creator, platformNormalized),
		[platformNormalized]
	);

	// @why Server-side pagination: useSearchJob already returns paginated results
	// We only slice client-side when filtering by email (which is client-side)
	const startIndex = (currentPage - 1) * itemsPerPage;
	const currentCreators = useMemo(() => {
		if (showEmailOnly) {
			// Email filter is client-side, so we need to paginate the filtered results
			return filteredCreators.slice(startIndex, startIndex + itemsPerPage);
		}
		// Server already paginated - use all creators from response
		return filteredCreators;
	}, [filteredCreators, startIndex, itemsPerPage, showEmailOnly]);

	const currentRows = useMemo(
		() =>
			transformCreatorsToRows(currentCreators, platformNormalized, startIndex, renderProfileLink),
		[currentCreators, platformNormalized, startIndex, renderProfileLink]
	);

	const currentRowIds = useMemo(() => currentRows.map((row) => row.id), [currentRows]);
	const allSelectedOnPage =
		currentRowIds.length > 0 && currentRowIds.every((id) => selectedCreators[id]);
	const someSelectedOnPage = currentRowIds.some((id) => selectedCreators[id]);

	// Apply enrichment to creators
	const applyEnrichmentToCreators = useCallback(
		(record, targetData, rawReference, origin = 'hydrate') => {
			if (!record) {
				return;
			}
			setLocalCreators((prev) => {
				const { creators: updated, didChange } = applyEnrichmentToCreatorList(
					prev,
					record,
					targetData,
					rawReference,
					origin
				);
				return didChange ? updated : prev;
			});
		},
		[]
	);

	// Selection handlers
	const toggleSelection = useCallback((rowId, snapshot) => {
		setSelectedCreators((prev) => {
			const next = { ...prev };
			if (next[rowId]) {
				delete next[rowId];
			} else {
				next[rowId] = snapshot;
			}
			return next;
		});
	}, []);

	const handleSelectPage = useCallback(
		(shouldSelect) => {
			setSelectedCreators((prev) => {
				const next = { ...prev };
				if (shouldSelect) {
					currentRows.forEach(({ id, snapshot }) => {
						next[id] = snapshot;
					});
				} else {
					currentRows.forEach(({ id }) => {
						delete next[id];
					});
				}
				return next;
			});
		},
		[currentRows]
	);

	const clearSelection = useCallback(() => setSelectedCreators({}), []);

	// Bulk enrich handler
	const handleBulkEnrich = useCallback(async () => {
		if (!selectedEnrichmentTargets.length) {
			return;
		}
		const result = await enrichMany(selectedEnrichmentTargets);
		processBulkEnrichResults(result, localCreators, applyEnrichmentToCreators);
	}, [selectedEnrichmentTargets, enrichMany, localCreators, applyEnrichmentToCreators]);

	// Page change handler
	const handlePageChange = useCallback(
		(newPage) => {
			setPage(newPage);
			resultsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		},
		[setPage]
	);

	// Page size change handler
	const handlePageSizeChange = useCallback(
		(newSize) => {
			setItemsPerPage(newSize);
			setTimeout(() => {
				resultsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 50);
		},
		[setItemsPerPage]
	);

	// Start subscription handler (USE2-40)
	const handleConfirmStartSubscription = useCallback(async () => {
		const result = await startSubscription();

		if (result.success) {
			setShowStartModal(false);
			toast.success('Subscription started! Loading all results...');

			// Refresh trial status (isTrialUser will become false)
			await refetchTrialStatus();

			// Force page refresh to reload with full access
			window.location.reload();
		} else {
			// Show error with option to update payment method
			toast.error(
				<div className="flex flex-col gap-2">
					<span>{result.error}</span>
					<button
						type="button"
						onClick={() => {
							toast.dismiss();
							openPortal();
						}}
						className="text-pink-400 hover:text-pink-300 text-sm underline text-left"
					>
						Update payment method
					</button>
				</div>,
				{ duration: 8000 }
			);
		}
	}, [startSubscription, refetchTrialStatus, openPortal]);

	// Fetch campaign name
	useEffect(() => {
		const fetchCampaignName = async () => {
			if (!searchData?.campaignId) {
				return;
			}
			try {
				const response = await fetch(`/api/campaigns/${searchData.campaignId}`);
				if (!response.ok) {
					return;
				}
				const data = await response.json();
				if (data?.name) {
					setCampaignName(data.name);
				}
			} catch (_error) {
				// Ignore campaign name fetch errors.
			}
		};
		fetchCampaignName();
	}, [searchData?.campaignId]);

	// No job yet
	if (!jobId) {
		return null;
	}

	// Loading/Progress state - show progress display
	if (!isComplete && localCreators.length === 0) {
		return <ProgressDisplay message={message} progress={progress} creatorsFound={creatorsFound} />;
	}

	// Calculate actual totals for display
	const displayTotalResults = showEmailOnly ? filteredCreators.length : totalCreators;
	const displayTotalPages = Math.max(
		1,
		Math.ceil((showEmailOnly ? filteredCreators.length : totalCreators) / itemsPerPage)
	);

	return (
		<div ref={resultsHeaderRef} className="space-y-4">
			<SearchResultsHeader
				campaignName={campaignName}
				campaignId={searchData?.campaignId}
				jobId={jobId}
				viewMode={viewMode}
				setViewMode={setViewMode}
				showEmailOnly={showEmailOnly}
				setShowEmailOnly={setShowEmailOnly}
				currentPage={currentPage}
				totalPages={displayTotalPages}
				totalResults={displayTotalResults}
				itemsPerPage={itemsPerPage}
				emailCount={emailCount}
				selectionCount={selectionCount}
				selectedSnapshots={selectedSnapshots}
				clearSelection={clearSelection}
				enrichmentBulkState={enrichmentBulkState}
				handleBulkEnrich={handleBulkEnrich}
				enrichmentUsage={enrichmentUsage}
				stillProcessing={isActive}
				displayedProgress={progress}
				isInstagramUs={isInstagramUs}
			/>

			{shouldShowEmailOverlay && (
				<EmailFilterOverlay
					onShowAll={() => setShowEmailOnly(false)}
					onDismiss={() => setEmailOverlayDismissed(true)}
				/>
			)}

			{/* Results container with relative positioning for overlay */}
			<div className="relative">
				<ResultsContainer
					stillProcessing={isActive}
					isPageLoading={isPageLoading}
					progressInfo={null}
				>
					<CreatorTableView
						rows={currentRows}
						selectedCreators={selectedCreators}
						allSelectedOnPage={allSelectedOnPage}
						someSelectedOnPage={someSelectedOnPage}
						platformNormalized={platformNormalized}
						bioLoading={false}
						viewMode={viewMode}
						isTrialUser={isTrialUser}
						trialClearLimit={TRIAL_CLEAR_LIMIT}
						onSelectPage={handleSelectPage}
						toggleSelection={toggleSelection}
						renderProfileLink={renderProfileLink}
						getBioDataForCreator={(creator) => creator?.bio_enriched || null}
						getBioEmailForCreator={(creator) => creator?.bio_enriched?.extracted_email || null}
						getEnrichment={getEnrichment}
						isEnrichmentLoading={isEnrichmentLoading}
						enrichCreator={enrichCreator}
						applyEnrichmentToCreators={applyEnrichmentToCreators}
						setBioEmailConfirmDialog={() => undefined}
					/>
					<CreatorGalleryView
						rows={currentRows}
						selectedCreators={selectedCreators}
						platformNormalized={platformNormalized}
						isInstagramUs={isInstagramUs}
						viewMode={viewMode}
						isTrialUser={isTrialUser}
						trialClearLimit={TRIAL_CLEAR_LIMIT}
						toggleSelection={toggleSelection}
						renderProfileLink={renderProfileLink}
					/>
				</ResultsContainer>

				{/* Trial upgrade overlay - positioned over blurred content */}
				{isTrialUser && totalCreators > TRIAL_CLEAR_LIMIT && (
					<TrialUpgradeOverlay
						blurredCount={totalCreators - TRIAL_CLEAR_LIMIT}
						currentPlan={currentPlan}
						onStartSubscription={() => setShowStartModal(true)}
					/>
				)}
			</div>

			{/* Start Subscription Modal (USE2-40) */}
			{isTrialUser && currentPlan && (
				<StartSubscriptionModal
					open={showStartModal}
					onOpenChange={setShowStartModal}
					planName={PLAN_NAMES[currentPlan] || currentPlan}
					amount={PLAN_PRICES[currentPlan] || 0}
					onConfirm={handleConfirmStartSubscription}
					isLoading={isStartingSubscription}
				/>
			)}

			{/* Hide pagination for trial users with blurred content - they can't use it anyway */}
			{(!isTrialUser || totalCreators <= TRIAL_CLEAR_LIMIT) && (
				<PaginationControls
					currentPage={currentPage}
					totalPages={displayTotalPages}
					totalResults={displayTotalResults}
					itemsPerPage={itemsPerPage}
					isLoading={isPageLoading}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
				/>
			)}

			{/* Show enrichment progress during active search */}
			{isActive && creatorsFound > 0 && (
				<div className="text-center text-xs text-zinc-500">{message}</div>
			)}
		</div>
	);
};

export default SearchResults;
