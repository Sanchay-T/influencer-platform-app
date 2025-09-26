/**
 * QStash Webhook Specialized Logging
 * 
 * Provides specialized logging for QStash webhook processing with platform-specific
 * context and job lifecycle tracking.
 */

import { logger, LogLevel, LogCategory, LogContext } from '../logging';
import { logDbOperation, logExternalCall } from './api-logger';

/**
 * QStash Job Context for structured logging
 */
interface QStashJobContext extends LogContext {
  jobId: string;
  platform: string;
  userId?: string;
  campaignId?: string;
  qstashMessageId?: string;
  
  // Job state
  status?: string;
  processedRuns?: number;
  processedResults?: number;
  targetResults?: number;
  progress?: string;
  
  // Platform-specific
  keywords?: string[];
  targetUsername?: string;
  searchType?: string;
}

/**
 * Platform-specific processing context
 */
interface PlatformProcessingContext {
  platform: string;
  operation: string;
  apiCallCount?: number;
  maxApiCalls?: number;
  batchSize?: number;
  batchIndex?: number;
  totalBatches?: number;
}

/**
 * QStash Webhook Logger
 * Specialized logger for QStash webhook processing with enhanced context
 */
export class QStashLogger {
  private static instance: QStashLogger;
  private activeJobs = new Map<string, { startTime: number; context: QStashJobContext }>();

  public static getInstance(): QStashLogger {
    if (!QStashLogger.instance) {
      QStashLogger.instance = new QStashLogger();
    }
    return QStashLogger.instance;
  }

  /**
   * Start tracking a job processing cycle
   */
  public startJobProcessing(context: QStashJobContext): void {
    this.activeJobs.set(context.jobId, {
      startTime: Date.now(),
      context
    });

    logger.info('QStash job processing started', {
      requestId: context.requestId,
      jobId: context.jobId,
      platform: context.platform,
      userId: context.userId,
      campaignId: context.campaignId,
      qstashMessageId: context.qstashMessageId,
      targetResults: context.targetResults,
      processedRuns: context.processedRuns || 0,
      processedResults: context.processedResults || 0
    }, LogCategory.JOB);
  }

  /**
   * Complete job processing tracking
   */
  public completeJobProcessing(
    jobId: string, 
    status: 'completed' | 'error' | 'processing',
    additionalContext?: Partial<QStashJobContext>
  ): number {
    const jobInfo = this.activeJobs.get(jobId);
    if (!jobInfo) {
      logger.warn('QStash job completion tracking not found', { jobId }, LogCategory.JOB);
      return 0;
    }

    const duration = Date.now() - jobInfo.startTime;
    const context = { ...jobInfo.context, ...additionalContext };

    if (status === 'error') {
      logger.error('QStash job processing failed', undefined, {
        requestId: context.requestId,
        jobId,
        platform: context.platform,
        executionTime: duration,
        processedResults: context.processedResults,
        targetResults: context.targetResults
      }, LogCategory.JOB);
    } else if (status === 'completed') {
      logger.info('QStash job processing completed', {
        requestId: context.requestId,
        jobId,
        platform: context.platform,
        executionTime: duration,
        processedResults: context.processedResults,
        targetResults: context.targetResults,
        progress: context.progress
      }, LogCategory.JOB);
    } else {
      logger.info('QStash job processing iteration completed', {
        requestId: context.requestId,
        jobId,
        platform: context.platform,
        executionTime: duration,
        processedResults: context.processedResults,
        targetResults: context.targetResults,
        progress: context.progress,
        nextIterationScheduled: true
      }, LogCategory.JOB);
    }

    if (status === 'completed' || status === 'error') {
      this.activeJobs.delete(jobId);
    }

    return duration;
  }

  /**
   * Log platform-specific processing phase
   */
  public logPlatformPhase(
    jobId: string,
    phase: string,
    platformContext: PlatformProcessingContext,
    additionalData?: Record<string, any>
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.info(`${platformContext.platform} processing phase: ${phase}`, {
      requestId: context.requestId,
      jobId,
      platform: platformContext.platform,
      phase,
      operation: platformContext.operation,
      apiCallCount: platformContext.apiCallCount,
      maxApiCalls: platformContext.maxApiCalls,
      batchInfo: platformContext.batchIndex !== undefined ? {
        current: platformContext.batchIndex + 1,
        total: platformContext.totalBatches,
        size: platformContext.batchSize
      } : undefined,
      ...additionalData
    }, this.getPlatformCategory(platformContext.platform));
  }

  /**
   * Log API call with platform context
   */
  public async logPlatformApiCall<T>(
    jobId: string,
    operation: string,
    apiCall: () => Promise<T>,
    platformContext: PlatformProcessingContext,
    metadata?: Record<string, any>
  ): Promise<T> {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    return await logExternalCall(
      `${platformContext.platform.toLowerCase()}_${operation}`,
      apiCall,
      {
        requestId: context.requestId,
        jobId,
        platform: platformContext.platform,
        apiCallNumber: platformContext.apiCallCount,
        maxApiCalls: platformContext.maxApiCalls,
        ...metadata
      },
      this.getPlatformCategory(platformContext.platform)
    );
  }

  /**
   * Log database operation with job context
   */
  public async logJobDbOperation<T>(
    jobId: string,
    operation: string,
    dbCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    return await logDbOperation(
      `job_${operation}`,
      dbCall,
      {
        requestId: context.requestId,
        jobId,
        platform: context.platform,
        ...metadata
      }
    );
  }

  /**
   * Log progress update with unified calculation
   */
  public logProgressUpdate(
    jobId: string,
    progress: number | string,
    phase: string,
    details?: {
      processedResults?: number;
      targetResults?: number;
      apiCallsUsed?: number;
      maxApiCalls?: number;
    }
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.info('QStash job progress updated', {
      requestId: context.requestId,
      jobId,
      platform: context.platform,
      progress: typeof progress === 'string' ? progress : `${progress}%`,
      phase,
      progressDetails: details ? {
        resultsProgress: details.targetResults ? 
          `${details.processedResults || 0}/${details.targetResults}` : undefined,
        apiProgress: details.maxApiCalls ? 
          `${details.apiCallsUsed || 0}/${details.maxApiCalls}` : undefined
      } : undefined
    }, LogCategory.JOB);
  }

  /**
   * Log batch processing with detailed metrics
   */
  public logBatchProcessing(
    jobId: string,
    batchInfo: {
      batchIndex: number;
      totalBatches: number;
      batchSize: number;
      processedInBatch: number;
      totalProcessed: number;
      totalItems: number;
    },
    platform: string,
    additionalMetrics?: Record<string, any>
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.info('Batch processing completed', {
      requestId: context.requestId,
      jobId,
      platform,
      batch: {
        current: batchInfo.batchIndex + 1,
        total: batchInfo.totalBatches,
        size: batchInfo.batchSize,
        processedInBatch: batchInfo.processedInBatch
      },
      overall: {
        processed: batchInfo.totalProcessed,
        total: batchInfo.totalItems,
        progressPercentage: Math.round((batchInfo.totalProcessed / batchInfo.totalItems) * 100)
      },
      metrics: additionalMetrics
    }, this.getPlatformCategory(platform));
  }

  /**
   * Log quality filtering results
   */
  public logQualityFiltering(
    jobId: string,
    platform: string,
    filteringResults: {
      totalFound: number;
      afterFiltering: number;
      filterCriteria: string[];
      topResults?: Array<{ username: string; followerCount: number; score?: number }>;
    }
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.info('Quality filtering completed', {
      requestId: context.requestId,
      jobId,
      platform,
      filtering: {
        totalFound: filteringResults.totalFound,
        afterFiltering: filteringResults.afterFiltering,
        filterRate: `${Math.round((filteringResults.afterFiltering / filteringResults.totalFound) * 100)}%`,
        criteria: filteringResults.filterCriteria
      },
      topResults: filteringResults.topResults?.slice(0, 3)
    }, this.getPlatformCategory(platform));
  }

  /**
   * Log error with job context and recovery information
   */
  public logJobError(
    jobId: string,
    error: Error,
    phase: string,
    recoveryOptions?: {
      canRetry: boolean;
      canPartialComplete: boolean;
      retryDelay?: number;
      partialResults?: number;
    }
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.error(`QStash job error in ${phase}`, error, {
      requestId: context.requestId,
      jobId,
      platform: context.platform,
      phase,
      processedResults: context.processedResults,
      targetResults: context.targetResults,
      recovery: recoveryOptions
    }, LogCategory.JOB);
  }

  /**
   * Get appropriate log category for platform
   */
  private getPlatformCategory(platform: string): LogCategory {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('tiktok')) return LogCategory.TIKTOK;
    if (platformLower.includes('instagram')) return LogCategory.INSTAGRAM;
    if (platformLower.includes('youtube')) return LogCategory.YOUTUBE;
    return LogCategory.SCRAPING;
  }

  /**
   * Log final job statistics and metrics
   */
  public logJobStatistics(
    jobId: string,
    statistics: {
      totalExecutionTime: number;
      apiCallsMade: number;
      creatorsProcessed: number;
      batchesProcessed?: number;
      averageApiResponseTime?: number;
      cacheHitRate?: number;
      qualityFilterRate?: number;
    }
  ): void {
    const jobInfo = this.activeJobs.get(jobId);
    const context = jobInfo?.context || { jobId };

    logger.info('QStash job statistics', {
      requestId: context.requestId,
      jobId,
      platform: context.platform,
      performance: {
        totalTime: statistics.totalExecutionTime,
        avgApiTime: statistics.averageApiResponseTime,
        apiCallRate: statistics.apiCallsMade > 0 ? 
          Math.round(statistics.totalExecutionTime / statistics.apiCallsMade) : 0
      },
      processing: {
        creatorsProcessed: statistics.creatorsProcessed,
        batchesProcessed: statistics.batchesProcessed,
        apiCallsMade: statistics.apiCallsMade
      },
      quality: {
        cacheHitRate: statistics.cacheHitRate ? `${Math.round(statistics.cacheHitRate * 100)}%` : undefined,
        qualityFilterRate: statistics.qualityFilterRate ? `${Math.round(statistics.qualityFilterRate * 100)}%` : undefined
      }
    }, LogCategory.PERFORMANCE);
  }
}

/**
 * Export singleton instance
 */
export const qstashLogger = QStashLogger.getInstance();

/**
 * Convenience functions for common QStash logging patterns
 */

/**
 * Wrapper for QStash job processing with automatic lifecycle logging
 */
export const withQStashJobLogging = async <T>(
  jobContext: QStashJobContext,
  processor: (logger: QStashLogger) => Promise<T>
): Promise<T> => {
  qstashLogger.startJobProcessing(jobContext);
  
  try {
    const result = await processor(qstashLogger);
    qstashLogger.completeJobProcessing(jobContext.jobId, 'completed');
    return result;
  } catch (error) {
    qstashLogger.completeJobProcessing(jobContext.jobId, 'error');
    throw error;
  }
};

/**
 * Log platform-specific API operations
 */
export const logPlatformOperation = (
  jobId: string,
  platform: string,
  operation: string,
  data?: Record<string, any>
) => qstashLogger.logPlatformPhase(
  jobId,
  operation,
  { platform, operation },
  data
);

/**
 * Log batch processing results
 */
export const logBatchResults = (
  jobId: string,
  platform: string,
  batchInfo: {
    batchIndex: number;
    totalBatches: number;
    batchSize: number;
    processedInBatch: number;
    totalProcessed: number;
    totalItems: number;
  },
  metrics?: Record<string, any>
) => qstashLogger.logBatchProcessing(jobId, batchInfo, platform, metrics);