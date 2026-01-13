/**
 * Performance Monitor
 *
 * Specialized performance tracking utilities for long-running operations,
 * API calls, database queries, and system resource monitoring.
 * Integrates with the background job logger for comprehensive tracking.
 */

import { backgroundJobLogger, JobPerformanceMetrics } from './background-job-logger';
import { logger } from './logger';
import { LogCategory, type LogContext, LogLevel } from './types';

/**
 * Performance metrics for various operation types
 */
export interface PerformanceMetrics {
	/** Operation duration in milliseconds */
	duration: number;
	/** Memory usage at start of operation */
	memoryStart?: number;
	/** Memory usage at end of operation */
	memoryEnd?: number;
	/** Memory delta (end - start) */
	memoryDelta?: number;
	/** CPU usage metrics if available */
	cpuUsage?: number;
	/** Custom timing phases */
	phases?: Record<string, number>;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Performance thresholds for different operation types
 */
type PerformanceThresholds = {
	api: { fast: number; normal: number; slow: number };
	database: { fast: number; normal: number; slow: number };
	image: { fast: number; normal: number; slow: number };
	email: { fast: number; normal: number; slow: number };
	job: { fast: number; normal: number; slow: number };
};

const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
	api: {
		fast: 200, // < 200ms is fast
		normal: 1000, // < 1s is normal
		slow: 5000, // > 5s is very slow
	},
	database: {
		fast: 50, // < 50ms is fast
		normal: 200, // < 200ms is normal
		slow: 1000, // > 1s is slow
	},
	image: {
		fast: 500, // < 500ms is fast
		normal: 2000, // < 2s is normal
		slow: 10000, // > 10s is slow
	},
	email: {
		fast: 1000, // < 1s is fast
		normal: 5000, // < 5s is normal
		slow: 15000, // > 15s is slow
	},
	job: {
		fast: 5000, // < 5s is fast
		normal: 30000, // < 30s is normal
		slow: 120000, // > 2 minutes is slow
	},
};

/**
 * Performance monitor class for tracking operations
 */
export class PerformanceMonitor {
	private startTime: number;
	private startMemory?: number;
	private phases: Map<string, number> = new Map();
	private phaseStartTimes: Map<string, number> = new Map();
	private operationType: keyof typeof PERFORMANCE_THRESHOLDS;
	private operationName: string;
	private context: LogContext;

	constructor(
		operationType: keyof typeof PERFORMANCE_THRESHOLDS,
		operationName: string,
		context: LogContext = {}
	) {
		this.operationType = operationType;
		this.operationName = operationName;
		this.context = context;
		this.startTime = Date.now();

		// Capture initial memory usage if in Node.js
		if (typeof process !== 'undefined') {
			this.startMemory = process.memoryUsage().heapUsed;
		}

		logger.debug(
			`Performance monitoring started: ${operationName}`,
			{
				...context,
				operationType,
				startTime: this.startTime,
				startMemory: this.startMemory,
			},
			LogCategory.PERFORMANCE
		);
	}

	/**
	 * Start timing a specific phase of the operation
	 */
	startPhase(phaseName: string): void {
		this.phaseStartTimes.set(phaseName, Date.now());

		logger.debug(
			`Phase started: ${phaseName}`,
			{
				...this.context,
				operationName: this.operationName,
				phase: phaseName,
				elapsed: Date.now() - this.startTime,
			},
			LogCategory.PERFORMANCE
		);
	}

	/**
	 * End timing a specific phase
	 */
	endPhase(phaseName: string): number {
		const startTime = this.phaseStartTimes.get(phaseName);
		if (!startTime) {
			logger.warn(`Phase "${phaseName}" was not started`, this.context, LogCategory.PERFORMANCE);
			return 0;
		}

		const duration = Date.now() - startTime;
		this.phases.set(phaseName, duration);
		this.phaseStartTimes.delete(phaseName);

		logger.debug(
			`Phase completed: ${phaseName}`,
			{
				...this.context,
				operationName: this.operationName,
				phase: phaseName,
				phaseDuration: duration,
				totalElapsed: Date.now() - this.startTime,
			},
			LogCategory.PERFORMANCE
		);

		return duration;
	}

	/**
	 * Add custom metric to the performance data
	 */
	addMetric(key: string, value: unknown): void {
		if (!this.context.metadata) {
			this.context.metadata = {};
		}
		this.context.metadata[key] = value;
	}

	/**
	 * Complete the performance monitoring and log results
	 */
	complete(success: boolean = true): PerformanceMetrics {
		const endTime = Date.now();
		const duration = endTime - this.startTime;
		const endMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : undefined;

		const metrics: PerformanceMetrics = {
			duration,
			memoryStart: this.startMemory,
			memoryEnd: endMemory,
			memoryDelta: this.startMemory && endMemory ? endMemory - this.startMemory : undefined,
			phases: Object.fromEntries(this.phases),
			metadata: this.context.metadata,
		};

		// Determine performance level
		const thresholds = PERFORMANCE_THRESHOLDS[this.operationType];
		let level: LogLevel;
		let performanceLevel: string;

		if (duration < thresholds.fast) {
			level = LogLevel.DEBUG;
			performanceLevel = 'fast';
		} else if (duration < thresholds.normal) {
			level = LogLevel.INFO;
			performanceLevel = 'normal';
		} else if (duration < thresholds.slow) {
			level = LogLevel.WARN;
			performanceLevel = 'slow';
		} else {
			level = LogLevel.ERROR;
			performanceLevel = 'very-slow';
		}

		// Log performance results
		const logContext = {
			...this.context,
			operationType: this.operationType,
			operationName: this.operationName,
			success,
			performanceLevel,
			duration,
			memoryDelta: metrics.memoryDelta,
			phases: metrics.phases,
			thresholds,
		};

		const message = `${this.operationName} completed (${performanceLevel}): ${duration}ms`;

		logger.log(level, message, logContext, LogCategory.PERFORMANCE);

		// Alert on very slow operations
		if (performanceLevel === 'very-slow') {
			logger.warn(
				`Very slow operation detected: ${this.operationName}`,
				{
					...logContext,
					alert: 'performance-degradation',
					recommendation: 'investigate-bottleneck',
				},
				LogCategory.PERFORMANCE
			);
		}

		return metrics;
	}

	/**
	 * Get current elapsed time without completing the monitor
	 */
	getElapsed(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Check if operation is taking longer than normal threshold
	 */
	isRunningLong(): boolean {
		const elapsed = this.getElapsed();
		return elapsed > PERFORMANCE_THRESHOLDS[this.operationType].normal;
	}

	/**
	 * Check if operation is taking longer than slow threshold
	 */
	isRunningSlow(): boolean {
		const elapsed = this.getElapsed();
		return elapsed > PERFORMANCE_THRESHOLDS[this.operationType].slow;
	}
}

/**
 * Convenience function for monitoring async operations
 */
export async function withPerformanceMonitoring<T>(
	operationType: keyof typeof PERFORMANCE_THRESHOLDS,
	operationName: string,
	operation: (monitor: PerformanceMonitor) => Promise<T>,
	context: LogContext = {}
): Promise<T> {
	const monitor = new PerformanceMonitor(operationType, operationName, context);

	try {
		const result = await operation(monitor);
		monitor.complete(true);
		return result;
	} catch (error) {
		monitor.complete(false);
		throw error;
	}
}

/**
 * Convenience function for monitoring sync operations
 */
export function withSyncPerformanceMonitoring<T>(
	operationType: keyof typeof PERFORMANCE_THRESHOLDS,
	operationName: string,
	operation: (monitor: PerformanceMonitor) => T,
	context: LogContext = {}
): T {
	const monitor = new PerformanceMonitor(operationType, operationName, context);

	try {
		const result = operation(monitor);
		monitor.complete(true);
		return result;
	} catch (error) {
		monitor.complete(false);
		throw error;
	}
}

/**
 * Create a simple timer for basic performance tracking
 */
export function createTimer(label?: string): {
	elapsed: () => number;
	end: () => number;
	log: (category?: LogCategory) => number;
} {
	const startTime = Date.now();

	return {
		elapsed: () => Date.now() - startTime,
		end: () => Date.now() - startTime,
		log: (category: LogCategory = LogCategory.PERFORMANCE) => {
			const duration = Date.now() - startTime;
			logger.debug(
				`Timer ${label || 'unnamed'}: ${duration}ms`,
				{
					duration,
					label,
				},
				category
			);
			return duration;
		},
	};
}

/**
 * Monitor system resource usage
 */
export function getSystemMetrics(): {
	memory?: NodeJS.MemoryUsage;
	uptime?: number;
	platform?: string;
	nodeVersion?: string;
} {
	if (typeof process === 'undefined') {
		return {};
	}

	return {
		memory: process.memoryUsage(),
		uptime: process.uptime(),
		platform: process.platform,
		nodeVersion: process.version,
	};
}

/**
 * Log system resource usage with warnings for high usage
 */
export function logSystemMetrics(context: LogContext = {}): void {
	const metrics = getSystemMetrics();

	if (!metrics.memory) {
		return;
	}

	const memoryUsageMB = metrics.memory.heapUsed / 1024 / 1024;
	const memoryTotalMB = metrics.memory.heapTotal / 1024 / 1024;
	const memoryUsagePercent = (memoryUsageMB / memoryTotalMB) * 100;

	let level: LogLevel = LogLevel.DEBUG;
	let alert: string | undefined;

	// Alert thresholds
	if (memoryUsageMB > 500) {
		// > 500MB
		level = LogLevel.WARN;
		alert = 'high-memory-usage';
	} else if (memoryUsageMB > 1000) {
		// > 1GB
		level = LogLevel.ERROR;
		alert = 'very-high-memory-usage';
	}

	logger.log(
		level,
		'System metrics report',
		{
			...context,
			memory: {
				heapUsedMB: Math.round(memoryUsageMB * 100) / 100,
				heapTotalMB: Math.round(memoryTotalMB * 100) / 100,
				usagePercent: Math.round(memoryUsagePercent * 100) / 100,
				external: metrics.memory.external,
				rss: metrics.memory.rss,
			},
			uptime: metrics.uptime,
			platform: metrics.platform,
			nodeVersion: metrics.nodeVersion,
			alert,
		},
		LogCategory.PERFORMANCE
	);
}

/**
 * Export convenience functions
 */
export const perf = {
	monitor: (type: keyof typeof PERFORMANCE_THRESHOLDS, name: string, context?: LogContext) =>
		new PerformanceMonitor(type, name, context),

	withAsync: withPerformanceMonitoring,
	withSync: withSyncPerformanceMonitoring,
	timer: createTimer,
	system: getSystemMetrics,
	logSystem: logSystemMetrics,
};
