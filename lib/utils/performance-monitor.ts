/**
 * Performance monitoring utility for measuring loading times
 * Tracks user experience metrics and data loading performance
 */

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceSummary {
  operation: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  totalCalls: number;
  lastCall: number;
  cacheHitRate?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeTimers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operation: string, metadata?: Record<string, any>): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    const startTime = performance.now();
    
    this.activeTimers.set(timerId, startTime);
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const metric: PerformanceMetric = {
      operation,
      startTime,
      metadata
    };
    
    this.metrics.get(operation)!.push(metric);
    
    console.log(`⏱️ [PERF] Started: ${operation}`, { metadata, timerId });
    return timerId;
  }

  /**
   * End timing an operation
   */
  endTimer(timerId: string, metadata?: Record<string, any>): number {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      console.warn(`⚠️ [PERF] Timer not found: ${timerId}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Find the metric and update it
    for (const [operation, metrics] of this.metrics.entries()) {
      const metric = metrics.find(m => m.startTime === startTime);
      if (metric) {
        metric.endTime = endTime;
        metric.duration = duration;
        if (metadata) {
          metric.metadata = { ...metric.metadata, ...metadata };
        }
        
        console.log(`✅ [PERF] Completed: ${operation} in ${duration.toFixed(2)}ms`, {
          duration: `${duration.toFixed(2)}ms`,
          metadata: metric.metadata
        });
        
        break;
      }
    }
    
    this.activeTimers.delete(timerId);
    return duration;
  }

  /**
   * Quick timing for simple operations
   */
  time<T>(operation: string, fn: () => T | Promise<T>, metadata?: Record<string, any>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timerId = this.startTimer(operation, metadata);
      
      try {
        const result = await fn();
        this.endTimer(timerId);
        resolve(result);
      } catch (error) {
        this.endTimer(timerId, { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Get performance summary for an operation
   */
  getSummary(operation: string): PerformanceSummary | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) return null;

    const completedMetrics = metrics.filter(m => m.duration !== undefined);
    if (completedMetrics.length === 0) return null;

    const durations = completedMetrics.map(m => m.duration!);
    const cacheHits = completedMetrics.filter(m => m.metadata?.cached).length;
    
    return {
      operation,
      averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      totalCalls: completedMetrics.length,
      lastCall: Math.max(...completedMetrics.map(m => m.startTime)),
      cacheHitRate: cacheHits / completedMetrics.length
    };
  }

  /**
   * Get all performance summaries
   */
  getAllSummaries(): Record<string, PerformanceSummary> {
    const summaries: Record<string, PerformanceSummary> = {};
    
    for (const operation of this.metrics.keys()) {
      const summary = this.getSummary(operation);
      if (summary) {
        summaries[operation] = summary;
      }
    }
    
    return summaries;
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    const summaries = this.getAllSummaries();
    
    console.group('📊 Performance Report');
    
    Object.entries(summaries).forEach(([operation, summary]) => {
      console.group(`🔍 ${operation}`);
      console.log(`⏱️ Average: ${summary.averageTime.toFixed(2)}ms`);
      console.log(`⚡ Fastest: ${summary.minTime.toFixed(2)}ms`);
      console.log(`🐌 Slowest: ${summary.maxTime.toFixed(2)}ms`);
      console.log(`📈 Total Calls: ${summary.totalCalls}`);
      if (summary.cacheHitRate !== undefined) {
        console.log(`🎯 Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
      }
      console.groupEnd();
    });
    
    console.groupEnd();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics.clear();
    this.activeTimers.clear();
    console.log('🧹 [PERF] Cleared all metrics');
  }

  /**
   * Export metrics for analysis
   */
  export(): Record<string, PerformanceMetric[]> {
    const exported: Record<string, PerformanceMetric[]> = {};
    this.metrics.forEach((metrics, operation) => {
      exported[operation] = [...metrics];
    });
    return exported;
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// Browser performance API extensions
export class BrowserPerformance {
  /**
   * Measure First Contentful Paint
   */
  static getFCP(): number | null {
    try {
      const entries = performance.getEntriesByType('paint');
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : null;
    } catch {
      return null;
    }
  }

  /**
   * Measure Largest Contentful Paint
   */
  static getLCP(): Promise<number | null> {
    return new Promise((resolve) => {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lcpEntry = entries[entries.length - 1];
          resolve(lcpEntry ? lcpEntry.startTime : null);
          observer.disconnect();
        });
        
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 5000);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Measure navigation timing
   */
  static getNavigationTiming(): Record<string, number> | null {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnection: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseEnd - navigation.requestStart,
        domProcessing: navigation.domComplete - navigation.responseEnd
      };
    } catch {
      return null;
    }
  }
}

// React hook for component performance monitoring
export function usePerformanceMonitor() {
  const startComponentTimer = (componentName: string, operation: string) => {
    return perfMonitor.startTimer(`${componentName}.${operation}`);
  };

  const endComponentTimer = (timerId: string) => {
    return perfMonitor.endTimer(timerId);
  };

  const getComponentSummary = (componentName: string) => {
    return Object.entries(perfMonitor.getAllSummaries())
      .filter(([key]) => key.startsWith(componentName))
      .reduce((acc, [key, summary]) => {
        acc[key] = summary;
        return acc;
      }, {} as Record<string, PerformanceSummary>);
  };

  return {
    startTimer: startComponentTimer,
    endTimer: endComponentTimer,
    getSummary: getComponentSummary,
    logReport: perfMonitor.logReport.bind(perfMonitor)
  };
}