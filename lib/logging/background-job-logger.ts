/**
 * Background Job Logger
 *
 * Specialized logger for QStash background jobs, long-running operations,
 * and async processing workflows. Provides job correlation tracking,
 * progress monitoring without log flooding, and performance optimization.
 */

import { isNumber, isRecord, isString } from '@/lib/utils/type-guards';
import { logger } from './logger';
import { LogCategory, type LogContext, LogLevel } from './types';

/**
 * Job lifecycle states for tracking
 */
export enum JobState {
	QUEUED = 'queued',
	PROCESSING = 'processing',
	COMPLETED = 'completed',
	FAILED = 'failed',
	RETRYING = 'retrying',
	CANCELLED = 'cancelled',
}

/**
 * Background job progress tracking interface
 */
export interface JobProgress {
	/** Current progress percentage (0-100) */
	percentage: number;
	/** Number of items processed */
	processed: number;
	/** Total number of items to process */
	total: number;
	/** Current operation description */
	currentOperation?: string;
	/** Additional metadata for this progress update */
	metadata?: Record<string, unknown>;
}

/**
 * Job context for correlation tracking
 */
export interface JobContext extends LogContext {
	/** Unique job identifier for correlation */
	jobId: string;
	/** QStash message ID if available */
	qstashMessageId?: string;
	/** Job type/category */
	jobType: string;
	/** Campaign ID if job is part of a campaign */
	campaignId?: string;
	/** Platform being processed */
	platform?: string;
	/** Search type (keyword, similar, etc.) */
	searchType?: string;
	/** Current job state */
	state?: JobState;
}

type JobContextOptions = {
	campaignId?: string;
	platform?: string;
	searchType?: string;
	userId?: string;
	qstashMessageId?: string;
	metadata?: Record<string, unknown>;
};

/**
 * Performance metrics for jobs
 */
export interface JobPerformanceMetrics {
	/** Total job duration in milliseconds */
	duration?: number;
	/** API calls made during job */
	apiCalls?: number;
	/** Memory usage at peak */
	memoryPeak?: number;
	/** Items processed per second */
	throughput?: number;
	/** Number of retry attempts */
	retries?: number;
	/** Time spent in each major phase */
	phaseTimings?: Record<string, number>;
}

/**
 * Specialized logger for background jobs and long-running operations
 */
export class BackgroundJobLogger {
	private static instance: BackgroundJobLogger;
	private jobTimers: Map<string, { startTime: number; lastProgress: number }> = new Map();
	private progressThrottleMap: Map<string, number> = new Map();

	// Configuration
	private readonly PROGRESS_THROTTLE_MS = 5000; // Only log progress every 5 seconds
	private readonly SLOW_JOB_THRESHOLD_MS = 30000; // 30 seconds
	private readonly MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB

	private constructor() {}

	public static getInstance(): BackgroundJobLogger {
		if (!BackgroundJobLogger.instance) {
			BackgroundJobLogger.instance = new BackgroundJobLogger();
		}
		return BackgroundJobLogger.instance;
	}

	/**
	 * Generate a correlation ID for job tracking
	 */
	private generateJobId(prefix: string = 'job'): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Start tracking a new background job
	 */
	public startJob(context: Omit<JobContext, 'jobId'> & { jobId?: string }): string {
		const jobType = typeof context.jobType === 'string' ? context.jobType : 'job';
		const jobId = context.jobId || this.generateJobId(jobType);
		const jobContext: JobContext = {
			...context,
			jobType,
			jobId,
			state: JobState.PROCESSING,
			timestamp: new Date().toISOString(),
		};

		// Initialize job tracking
		this.jobTimers.set(jobId, {
			startTime: Date.now(),
			lastProgress: 0,
		});

		logger.info(`Job started: ${context.jobType}`, jobContext, LogCategory.JOB);

		return jobId;
	}

	/**
	 * Update job state with proper correlation tracking
	 */
	public updateJobState(
		jobId: string,
		state: JobState,
		context?: Partial<JobContext>,
		category?: LogCategory
	): void {
		const baseContext: JobContext = {
			jobId,
			state,
			jobType: context?.jobType || 'unknown',
			...context,
		};

		const logLevel = this.getLogLevelForState(state);
		const message = `Job ${state}: ${baseContext.jobType}`;

		logger.log(logLevel, message, baseContext, category || LogCategory.JOB);
	}

	/**
	 * Update job progress with intelligent throttling to prevent log flooding
	 */
	public updateProgress(jobId: string, progress: JobProgress, context?: Partial<JobContext>): void {
		const now = Date.now();
		const lastProgressTime = this.progressThrottleMap.get(jobId) || 0;
		const jobTimer = this.jobTimers.get(jobId);

		// Throttle progress updates except for important milestones
		const isImportantMilestone = progress.percentage >= 100 || progress.percentage % 25 === 0;
		const shouldLog = isImportantMilestone || now - lastProgressTime >= this.PROGRESS_THROTTLE_MS;

		if (!shouldLog) {
			return;
		}

		this.progressThrottleMap.set(jobId, now);

		const progressContext: JobContext = {
			jobId,
			jobType: context?.jobType || 'unknown',
			state: JobState.PROCESSING,
			...context,
			metadata: {
				...context?.metadata,
				progress: {
					percentage: Math.round(progress.percentage * 100) / 100,
					processed: progress.processed,
					total: progress.total,
					currentOperation: progress.currentOperation,
				},
			},
		};

		// Add performance context if available
		if (jobTimer) {
			const elapsed = now - jobTimer.startTime;
			progressContext.executionTime = elapsed;

			// Calculate throughput
			if (progress.processed > 0 && elapsed > 0) {
				const throughput = (progress.processed / elapsed) * 1000; // items per second
				progressContext.metadata = {
					...progressContext.metadata,
					throughput: Math.round(throughput * 100) / 100,
				};
			}
		}

		const message = progress.currentOperation
			? `${progress.currentOperation} (${Math.round(progress.percentage)}%)`
			: `Job progress: ${Math.round(progress.percentage)}%`;

		logger.debug(message, progressContext, LogCategory.JOB);

		// Warn about slow jobs
		if (
			jobTimer &&
			now - jobTimer.startTime > this.SLOW_JOB_THRESHOLD_MS &&
			progress.percentage < 50
		) {
			logger.warn(`Slow job detected: ${jobId}`, progressContext, LogCategory.PERFORMANCE);
		}
	}

	/**
	 * Log successful job completion with performance metrics
	 */
	public completeJob(
		jobId: string,
		metrics?: JobPerformanceMetrics,
		context?: Partial<JobContext>
	): void {
		const jobTimer = this.jobTimers.get(jobId);
		const duration = jobTimer ? Date.now() - jobTimer.startTime : undefined;

		const completionContext: JobContext = {
			jobId,
			state: JobState.COMPLETED,
			jobType: context?.jobType || 'unknown',
			executionTime: duration,
			...context,
			metadata: {
				...context?.metadata,
				performance: {
					duration,
					...metrics,
				},
			},
		};

		logger.info(`Job completed: ${completionContext.jobType}`, completionContext, LogCategory.JOB);

		// Clean up tracking data
		this.jobTimers.delete(jobId);
		this.progressThrottleMap.delete(jobId);
	}

	/**
	 * Log job failure with error context and recovery suggestions
	 */
	public failJob(
		jobId: string,
		error: Error,
		context?: Partial<JobContext>,
		retryable: boolean = true
	): void {
		const jobTimer = this.jobTimers.get(jobId);
		const duration = jobTimer ? Date.now() - jobTimer.startTime : undefined;

		const errorRecord = isRecord(error) ? error : null;
		const errorCodeValue = errorRecord ? errorRecord.code : undefined;
		const errorCode = isString(errorCodeValue)
			? errorCodeValue
			: isNumber(errorCodeValue)
				? String(errorCodeValue)
				: error.name;

		const failureContext: JobContext = {
			jobId,
			state: JobState.FAILED,
			jobType: context?.jobType || 'unknown',
			executionTime: duration,
			errorCode,
			...context,
			metadata: {
				...context?.metadata,
				error: {
					name: error.name,
					message: error.message,
					retryable,
					failureTime: duration,
				},
			},
		};

		logger.error(`Job failed: ${failureContext.jobType}`, error, failureContext, LogCategory.JOB);

		// Clean up tracking data for non-retryable failures
		if (!retryable) {
			this.jobTimers.delete(jobId);
			this.progressThrottleMap.delete(jobId);
		}
	}

	/**
	 * Log API call within a job context
	 */
	public logApiCall(
		jobId: string,
		platform: string,
		endpoint: string,
		success: boolean,
		responseTime: number,
		context?: Partial<JobContext>
	): void {
		const apiContext: JobContext = {
			jobId,
			platform,
			jobType: context?.jobType || 'scraping',
			...context,
			metadata: {
				...context?.metadata,
				api: {
					platform,
					endpoint,
					success,
					responseTime,
					timestamp: new Date().toISOString(),
				},
			},
		};

		const message = `${platform} API ${success ? 'success' : 'failure'}: ${endpoint}`;
		const level = success ? LogLevel.DEBUG : LogLevel.WARN;

		logger.log(level, message, apiContext, LogCategory.API);
	}

	/**
	 * Log image processing operation within job context
	 */
	public logImageProcessing(
		jobId: string,
		operation: string,
		originalFormat: string,
		targetFormat: string,
		success: boolean,
		processingTime: number,
		context?: Partial<JobContext>
	): void {
		const imageContext: JobContext = {
			jobId,
			jobType: 'image-processing',
			...context,
			metadata: {
				...context?.metadata,
				imageProcessing: {
					operation,
					originalFormat,
					targetFormat,
					success,
					processingTime,
					timestamp: new Date().toISOString(),
				},
			},
		};

		const message = `Image ${operation}: ${originalFormat} → ${targetFormat} (${processingTime}ms)`;
		const level = success ? LogLevel.DEBUG : LogLevel.WARN;

		logger.log(level, message, imageContext, LogCategory.STORAGE);
	}

	/**
	 * Log email operation within job context
	 */
	public logEmailOperation(
		jobId: string,
		operation: 'send' | 'queue' | 'deliver' | 'bounce' | 'fail',
		recipient: string,
		template: string,
		success: boolean,
		context?: Partial<JobContext>
	): void {
		const emailContext: JobContext = {
			jobId,
			jobType: 'email',
			userEmail: recipient,
			...context,
			metadata: {
				...context?.metadata,
				email: {
					operation,
					recipient: recipient.replace(/(.{2}).*@/, '$1***@'), // Partially redact email
					template,
					success,
					timestamp: new Date().toISOString(),
				},
			},
		};

		const message = `Email ${operation}: ${template} to ${recipient.replace(/(.{2}).*@/, '$1***@')}`;
		const level = success ? LogLevel.INFO : LogLevel.ERROR;

		logger.log(level, message, emailContext, LogCategory.EMAIL);
	}

	/**
	 * Monitor memory usage and warn about potential issues
	 */
	public checkMemoryUsage(jobId: string, context?: Partial<JobContext>): void {
		if (typeof process === 'undefined') return;

		const memUsage = process.memoryUsage();

		if (memUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
			const memoryContext: JobContext = {
				jobId,
				jobType: context?.jobType || 'unknown',
				memoryUsage: memUsage.heapUsed,
				...context,
				metadata: {
					...context?.metadata,
					memory: {
						heapUsed: memUsage.heapUsed,
						heapTotal: memUsage.heapTotal,
						external: memUsage.external,
						rss: memUsage.rss,
						threshold: this.MEMORY_WARNING_THRESHOLD,
					},
				},
			};

			logger.warn(`High memory usage in job: ${jobId}`, memoryContext, LogCategory.PERFORMANCE);
		}
	}

	/**
	 * Get appropriate log level for job state
	 */
	private getLogLevelForState(state: JobState): LogLevel {
		switch (state) {
			case JobState.QUEUED:
			case JobState.PROCESSING:
				return LogLevel.DEBUG;
			case JobState.COMPLETED:
				return LogLevel.INFO;
			case JobState.RETRYING:
				return LogLevel.WARN;
			case JobState.FAILED:
			case JobState.CANCELLED:
				return LogLevel.ERROR;
			default:
				return LogLevel.INFO;
		}
	}

	/**
	 * Create a job context template for consistent logging
	 */
	public createJobContext(
		jobType: string,
		options: JobContextOptions = {}
	): Omit<JobContext, 'jobId'> {
		return {
			jobType,
			campaignId: options.campaignId,
			platform: options.platform,
			searchType: options.searchType,
			userId: options.userId,
			qstashMessageId: options.qstashMessageId,
			timestamp: new Date().toISOString(),
			metadata: options.metadata,
		};
	}

	/**
	 * Flush all job tracking data (for graceful shutdown)
	 */
	public flush(): void {
		this.jobTimers.clear();
		this.progressThrottleMap.clear();
	}
}

/**
 * Export singleton instance for global use
 */
export const backgroundJobLogger = BackgroundJobLogger.getInstance();

/**
 * Export convenience functions for common job logging patterns
 */
export const jobLog = {
	start: (context: Omit<JobContext, 'jobId'> & { jobId?: string }) =>
		backgroundJobLogger.startJob(context),

	progress: (jobId: string, progress: JobProgress, context?: Partial<JobContext>) =>
		backgroundJobLogger.updateProgress(jobId, progress, context),

	complete: (jobId: string, metrics?: JobPerformanceMetrics, context?: Partial<JobContext>) =>
		backgroundJobLogger.completeJob(jobId, metrics, context),

	fail: (jobId: string, error: Error, context?: Partial<JobContext>, retryable?: boolean) =>
		backgroundJobLogger.failJob(jobId, error, context, retryable),

	api: (
		jobId: string,
		platform: string,
		endpoint: string,
		success: boolean,
		responseTime: number,
		context?: Partial<JobContext>
	) => backgroundJobLogger.logApiCall(jobId, platform, endpoint, success, responseTime, context),

	image: (
		jobId: string,
		operation: string,
		originalFormat: string,
		targetFormat: string,
		success: boolean,
		processingTime: number,
		context?: Partial<JobContext>
	) =>
		backgroundJobLogger.logImageProcessing(
			jobId,
			operation,
			originalFormat,
			targetFormat,
			success,
			processingTime,
			context
		),

	email: (
		jobId: string,
		operation: 'send' | 'queue' | 'deliver' | 'bounce' | 'fail',
		recipient: string,
		template: string,
		success: boolean,
		context?: Partial<JobContext>
	) =>
		backgroundJobLogger.logEmailOperation(jobId, operation, recipient, template, success, context),

	memory: (jobId: string, context?: Partial<JobContext>) =>
		backgroundJobLogger.checkMemoryUsage(jobId, context),

	createContext: (jobType: string, options?: JobContextOptions) =>
		backgroundJobLogger.createJobContext(jobType, options),
};
