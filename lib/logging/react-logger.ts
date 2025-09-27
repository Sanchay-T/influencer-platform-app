/**
 * React-specific logging utilities and hooks
 * 
 * Provides React component lifecycle logging, user action tracking,
 * and performance monitoring specifically designed for React components.
 * 
 * @example
 * ```typescript
 * import { useComponentLogger, useUserActionLogger } from '@/lib/logging/react-logger';
 * 
 * function MyComponent() {
 *   const componentLogger = useComponentLogger('MyComponent');
 *   const userActionLogger = useUserActionLogger();
 *   
 *   const handleClick = () => {
 *     userActionLogger.click('submit-button', { formData });
 *   };
 *   
 *   return <button onClick={handleClick}>Submit</button>;
 * }
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { logger, LogLevel, LogCategory, LogContext } from './index';

/**
 * Hook for component lifecycle logging
 * Automatically logs mount, unmount, and provides update logging
 */
export function useComponentLogger(componentName: string, initialProps?: any) {
  const mountedRef = useRef(false);
  const propsRef = useRef(initialProps);

  const createContext = useCallback((additionalContext?: LogContext): LogContext => {
    return {
      componentName,
      ...additionalContext
    };
  }, [componentName]);

  // Log component mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      
      logger.debug(
        `Component mounted: ${componentName}`, 
        createContext({ 
          initialProps: initialProps ? JSON.stringify(initialProps).substring(0, 200) : undefined
        }),
        LogCategory.UI
      );
    }
  }, [componentName, initialProps, createContext]);

  // Log component unmount
  useEffect(() => {
    return () => {
      if (mountedRef.current) {
        logger.debug(
          `Component unmounted: ${componentName}`,
          createContext(),
          LogCategory.UI
        );
      }
    };
  }, [componentName, createContext]);

  const logUpdate = useCallback((changes: any, reason?: string) => {
    logger.debug(
      `Component updated: ${componentName}`,
      createContext({
        changes: JSON.stringify(changes).substring(0, 200),
        updateReason: reason,
        previousProps: propsRef.current ? JSON.stringify(propsRef.current).substring(0, 200) : undefined
      }),
      LogCategory.UI
    );
    propsRef.current = changes;
  }, [componentName, createContext]);

  const logError = useCallback((error: Error, context?: LogContext) => {
    logger.error(
      `Component error in ${componentName}: ${error.message}`,
      error,
      createContext(context),
      LogCategory.UI
    );
  }, [componentName, createContext]);

  const logWarning = useCallback((message: string, context?: LogContext) => {
    logger.warn(
      `Component warning in ${componentName}: ${message}`,
      createContext(context),
      LogCategory.UI
    );
  }, [componentName, createContext]);

  const logInfo = useCallback((message: string, context?: LogContext) => {
    logger.info(
      `${componentName}: ${message}`,
      createContext(context),
      LogCategory.UI
    );
  }, [componentName, createContext]);

  return {
    logUpdate,
    logError,
    logWarning,
    logInfo,
    createContext
  };
}

/**
 * Hook for tracking user interactions and actions
 * Provides structured logging for user behavior analytics
 */
export function useUserActionLogger() {
  const { user } = useUser();

  const createUserContext = useCallback((additionalContext?: LogContext): LogContext => {
    return {
      userId: user?.id,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      ...additionalContext
    };
  }, [user]);

  const logClick = useCallback((elementId: string, context?: LogContext) => {
    logger.info(
      `User clicked: ${elementId}`,
      createUserContext({
        action: 'click',
        elementId,
        ...context
      }),
      LogCategory.UI
    );
  }, [createUserContext]);

  const logFormSubmission = useCallback((formName: string, formData?: any, context?: LogContext) => {
    logger.info(
      `User submitted form: ${formName}`,
      createUserContext({
        action: 'form_submit',
        formName,
        formFields: formData ? Object.keys(formData) : undefined,
        ...context
      }),
      LogCategory.UI
    );
  }, [createUserContext]);

  const logNavigation = useCallback((from: string, to: string, context?: LogContext) => {
    logger.info(
      `User navigated from ${from} to ${to}`,
      createUserContext({
        action: 'navigation',
        fromPath: from,
        toPath: to,
        ...context
      }),
      LogCategory.UI
    );
  }, [createUserContext]);

  const logSearch = useCallback((searchTerm: string, searchType?: string, context?: LogContext) => {
    logger.info(
      `User performed search: ${searchTerm}`,
      createUserContext({
        action: 'search',
        searchTerm,
        searchType,
        ...context
      }),
      LogCategory.SEARCH
    );
  }, [createUserContext]);

  const logError = useCallback((action: string, error: Error, context?: LogContext) => {
    logger.error(
      `User action failed: ${action}`,
      error,
      createUserContext({
        failedAction: action,
        ...context
      }),
      LogCategory.UI
    );
  }, [createUserContext]);

  return {
    logClick,
    logFormSubmission,
    logNavigation,
    logSearch,
    logError
  };
}

/**
 * Hook for performance monitoring in React components
 * Tracks render times, effect executions, and slow operations
 */
export function usePerformanceLogger(componentName: string) {
  const renderTimerRef = useRef<{ start: number; count: number }>({ start: 0, count: 0 });

  const createContext = useCallback((additionalContext?: LogContext): LogContext => {
    return {
      componentName,
      ...additionalContext
    };
  }, [componentName]);

  // Track render performance
  useEffect(() => {
    const startTime = performance.now();
    renderTimerRef.current = { start: startTime, count: renderTimerRef.current.count + 1 };

    return () => {
      const duration = performance.now() - startTime;
      
      if (duration > 100) { // Log slow renders (>100ms)
        logger.warn(
          `Slow render detected in ${componentName}`,
          createContext({
            renderDuration: duration,
            renderCount: renderTimerRef.current.count
          }),
          LogCategory.PERFORMANCE
        );
      } else {
        logger.debug(
          `Component rendered: ${componentName}`,
          createContext({
            renderDuration: duration,
            renderCount: renderTimerRef.current.count
          }),
          LogCategory.PERFORMANCE
        );
      }
    };
  });

  const trackAsyncOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      logger.info(
        `Async operation completed: ${operationName}`,
        createContext({
          operationName,
          executionTime: duration,
          ...context
        }),
        LogCategory.PERFORMANCE
      );
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      logger.error(
        `Async operation failed: ${operationName}`,
        error instanceof Error ? error : new Error(String(error)),
        createContext({
          operationName,
          executionTime: duration,
          ...context
        }),
        LogCategory.PERFORMANCE
      );
      
      throw error;
    }
  }, [createContext]);

  const trackSyncOperation = useCallback(<T>(
    operationName: string,
    operation: () => T,
    context?: LogContext
  ): T => {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      if (duration > 50) { // Log operations that take >50ms
        logger.info(
          `Sync operation completed: ${operationName}`,
          createContext({
            operationName,
            executionTime: duration,
            ...context
          }),
          LogCategory.PERFORMANCE
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      logger.error(
        `Sync operation failed: ${operationName}`,
        error instanceof Error ? error : new Error(String(error)),
        createContext({
          operationName,
          executionTime: duration,
          ...context
        }),
        LogCategory.PERFORMANCE
      );
      
      throw error;
    }
  }, [componentName, createContext]);

  return {
    trackAsyncOperation,
    trackSyncOperation
  };
}

/**
 * Hook for API call logging with automatic error handling
 * Provides consistent logging for fetch requests and API interactions
 */
export function useApiLogger() {
  const { user } = useUser();

  const createContext = useCallback((additionalContext?: LogContext): LogContext => {
    return {
      userId: user?.id,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      ...additionalContext
    };
  }, [user]);

  const logApiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit & { body?: any } = {},
    context?: LogContext
  ): Promise<T> => {
    const startTime = performance.now();
    const method = options.method || 'GET';
    
    logger.info(
      `API request started: ${method} ${endpoint}`,
      createContext({
        endpoint,
        method,
        hasBody: !!options.body,
        ...context
      }),
      LogCategory.API
    );

    try {
      const response = await fetch(endpoint, options);
      const duration = performance.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(
          `API request failed: ${method} ${endpoint}`,
          createContext({
            endpoint,
            method,
            statusCode: response.status,
            executionTime: duration,
            errorText,
            ...context
          }),
          LogCategory.API
        );
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      logger.info(
        `API request completed: ${method} ${endpoint}`,
        createContext({
          endpoint,
          method,
          statusCode: response.status,
          executionTime: duration,
          responseSize: JSON.stringify(data).length,
          ...context
        }),
        LogCategory.API
      );
      
      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      logger.error(
        `API request error: ${method} ${endpoint}`,
        error instanceof Error ? error : new Error(String(error)),
        createContext({
          endpoint,
          method,
          executionTime: duration,
          ...context
        }),
        LogCategory.API
      );
      
      throw error;
    }
  }, [createContext]);

  return {
    logApiCall
  };
}

/**
 * Hook for form validation and submission logging
 */
export function useFormLogger(formName: string) {
  const userActionLogger = useUserActionLogger();

  const logValidationError = useCallback((field: string, error: string, context?: LogContext) => {
    logger.warn(
      `Form validation error in ${formName}: ${field}`,
      {
        formName,
        field,
        validationError: error,
        ...context
      },
      LogCategory.UI
    );
  }, [formName]);

  const logSubmissionStart = useCallback((formData: any, context?: LogContext) => {
    userActionLogger.logFormSubmission(formName, formData, {
      submissionPhase: 'start',
      ...context
    });
  }, [formName, userActionLogger]);

  const logSubmissionSuccess = useCallback((responseData?: any, context?: LogContext) => {
    logger.info(
      `Form submission successful: ${formName}`,
      {
        formName,
        submissionPhase: 'success',
        hasResponseData: !!responseData,
        ...context
      },
      LogCategory.UI
    );
  }, [formName]);

  const logSubmissionError = useCallback((error: Error, context?: LogContext) => {
    logger.error(
      `Form submission failed: ${formName}`,
      error,
      {
        formName,
        submissionPhase: 'error',
        ...context
      },
      LogCategory.UI
    );
  }, [formName]);

  return {
    logValidationError,
    logSubmissionStart,
    logSubmissionSuccess,
    logSubmissionError
  };
}

/**
 * Create a structured replacement for console logging
 * Provides backward compatibility while adding structure
 */
export function createConsoleReplacement(componentName?: string, category?: LogCategory) {
  const baseContext: LogContext = componentName ? { componentName } : {};
  const logCategory = category || LogCategory.UI;

  return {
    log: (message: any, ...args: any[]) => {
      const fullMessage = typeof message === 'string' 
        ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`
        : JSON.stringify(message);
      
      logger.debug(fullMessage, baseContext, logCategory);
    },
    
    info: (message: any, ...args: any[]) => {
      const fullMessage = typeof message === 'string' 
        ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`
        : JSON.stringify(message);
      
      logger.info(fullMessage, baseContext, logCategory);
    },
    
    warn: (message: any, ...args: any[]) => {
      const fullMessage = typeof message === 'string' 
        ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`
        : JSON.stringify(message);
      
      logger.warn(fullMessage, baseContext, logCategory);
    },
    
    error: (message: any, ...args: any[]) => {
      const fullMessage = typeof message === 'string' 
        ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}`
        : JSON.stringify(message);
      
      const error = args.find(arg => arg instanceof Error);
      logger.error(fullMessage, error, baseContext, logCategory);
    }
  };
}
