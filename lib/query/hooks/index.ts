/**
 * React Query Hooks for Job/Creator Data
 *
 * Single source of truth for fetching and caching job data.
 * Replaces: useCreatorSearch, useAutoFetchAllPages, polling in useCampaignJobs
 */

export {
	type JobCreatorsData,
	prefetchJobCreators,
	type UseJobCreatorsOptions,
	useJobCreators,
} from './useJobCreators';
export {
	type CompletionData,
	type ProgressData,
	type UseJobPollingOptions,
	type UseJobPollingResult,
	useJobPolling,
} from './useJobPolling';
export {
	type JobStatus,
	type JobStatusData,
	jobStatusKeys,
	type UseJobStatusResult,
	useInvalidateJobStatus,
	useJobStatus,
} from './useJobStatus';
