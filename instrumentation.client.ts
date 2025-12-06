import * as Sentry from "@sentry/nextjs";

// Environment-based configuration for client-side
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';
const isProduction = environment === 'production';

// Enhanced client-side Sentry configuration
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://4157102c5407a90be0d7e8d5804d7160@o4509176214388736.ingest.us.sentry.io/4509979716616192",
  
  environment,
  
  // Optimized integrations for client-side performance
  integrations: [
    // Enhanced Session Replay with privacy-first settings
    Sentry.replayIntegration({
      // Privacy settings
      maskAllText: isProduction, // Only mask in production
      blockAllMedia: true,
      maskAllInputs: isProduction,
      
      // Performance settings
      sampleRate: isDevelopment ? 1.0 : (isProduction ? 0.1 : 0.3), // 10% in prod, 30% staging, 100% dev
      onErrorSampleRate: 1.0, // Always capture error sessions
      
      // Network settings
      networkDetailAllowed: !isProduction, // Only in non-production
      networkCaptureBodies: isDevelopment,
      
      // Session management
      maxReplayDuration: 30 * 60 * 1000, // 30 minutes max
      sessionSampleRate: isDevelopment ? 1.0 : (isProduction ? 0.1 : 0.3),
      
      // Privacy filters
      beforeAddRecordingEvent: (event) => {
        // Filter out sensitive events
        if (event.data && typeof event.data === 'object') {
          const data = event.data as any;
          if (data.tag === 'input' && data.attributes && data.attributes.type === 'password') {
            return null; // Skip password inputs
          }
        }
        return event;
      },
    }),
    
    // Enhanced console logging with filtering
    Sentry.consoleLoggingIntegration({ 
      levels: isDevelopment ? ["log", "info", "warn", "error"] : ["warn", "error"]
    }),
    
    // Browser-specific integrations
    Sentry.browserTracingIntegration({
      // Router instrumentation
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
      
      // Performance settings
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.vercel\.app/,
        /^https:\/\/[^/]*\.usegemz\.io/,
        process.env.NEXT_PUBLIC_SITE_URL,
      ].filter(Boolean),
      
      // Interaction tracking
      enableLongTask: isProduction,
      enableInp: true, // Interaction to Next Paint
      
      // Network monitoring
      shouldCreateSpanForRequest: (url) => {
        // Don't trace static assets, health checks, or analytics
        return !url.includes('/_next/static') && 
               !url.includes('/health') && 
               !url.includes('/ping') &&
               !url.includes('google-analytics') &&
               !url.includes('googletagmanager');
      },
    }),
    
    // HTTP instrumentation for API calls
    Sentry.httpClientIntegration({
      breadcrumbs: true,
      tracing: true,
    }),
    
    // Browser-specific error handling
    Sentry.globalHandlersIntegration({
      onerror: true,
      onunhandledrejection: true,
    }),
    
    // Context lines for better debugging
    Sentry.contextLinesIntegration(),
    
    // Deduplication
    Sentry.dedupeIntegration(),
    
    // React error boundary integration
    ...(typeof window !== 'undefined' ? [
      Sentry.browserProfilingIntegration()
    ] : []),
  ],
  
  // Environment-specific performance monitoring
  tracesSampleRate: isDevelopment ? 1.0 : (isProduction ? 0.1 : 0.3),
  
  // Profiles sampling (performance profiling)
  profilesSampleRate: isDevelopment ? 1.0 : (isProduction ? 0.05 : 0.2),
  
  // Session Replay settings (moved to integration above)
  replaysSessionSampleRate: isDevelopment ? 1.0 : (isProduction ? 0.1 : 0.3),
  replaysOnErrorSampleRate: 1.0, // Always capture error sessions
  
  // Enhanced error filtering
  beforeSend(event, hint) {
    // Filter out development-only errors
    if (isDevelopment) {
      return event;
    }
    
    // Filter out common non-critical browser errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Skip network errors that are retried
      if (error.message?.includes('Load failed') || 
          error.message?.includes('NetworkError') ||
          error.message?.includes('Failed to fetch')) {
        return null;
      }
      
      // Skip browser extension errors
      if (error.stack?.includes('extension://') || 
          error.stack?.includes('chrome-extension://') ||
          error.stack?.includes('moz-extension://')) {
        return null;
      }
      
      // Skip ad blocker errors
      if (error.message?.includes('blocked') && 
          (error.message?.includes('ad') || error.message?.includes('tracking'))) {
        return null;
      }
    }
    
    // Skip events with no useful information
    if (event.exception && event.exception.values) {
      const hasUsefulInfo = event.exception.values.some(exception => 
        exception.stacktrace && exception.stacktrace.frames && 
        exception.stacktrace.frames.length > 0
      );
      if (!hasUsefulInfo) {
        return null;
      }
    }
    
    return event;
  },
  
  // Enhanced breadcrumb filtering
  beforeBreadcrumb(breadcrumb) {
    // Skip noisy breadcrumbs in production
    if (isProduction) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null;
      }
      
      // Skip navigation breadcrumbs for static assets
      if (breadcrumb.category === 'navigation' && 
          breadcrumb.data?.to?.includes('/_next/static')) {
        return null;
      }
    }
    
    // Enhanced data sanitization
    if (breadcrumb.data) {
      breadcrumb.data = sanitizeClientData(breadcrumb.data);
    }
    
    return breadcrumb;
  },
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE,
  
  // Enhanced debugging
  debug: isDevelopment,
  
  // Enable logging with environment-specific settings
  _experiments: {
    enableLogs: true,
  },
  
  // Transport options for better performance
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
  
  // Session tracking
  autoSessionTracking: true,
  
  // Enhanced context
  initialScope: {
    tags: {
      component: 'client',
      environment,
    },
    contexts: {
      browser: {
        name: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      }
    }
  },
  
  // User privacy settings
  sendDefaultPii: false, // Don't send personally identifiable information
  
  // Error capture settings
  captureUnhandledRejections: true,
  maxBreadcrumbs: isProduction ? 50 : 100,
});

// Sanitize sensitive data from breadcrumbs
function sanitizeClientData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'cookie', 'session', 'apiKey', 'api_key', 'accessToken',
    'refreshToken', 'bearer', 'stripe', 'card', 'payment',
    'email', 'phone', 'address', 'creditCard'
  ];
  
  const sanitized = { ...data };
  
  for (const [key, value] of Object.entries(sanitized)) {
    const keyLower = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeClientData(value);
    } else if (typeof value === 'string' && value.length > 2000) {
      // Truncate very long strings to prevent payload bloat
      sanitized[key] = value.substring(0, 2000) + '...[TRUNCATED]';
    }
  }
  
  return sanitized;
}

// React Router v6 imports (only if available)
let React: any, useLocation: any, useNavigationType: any, createRoutesFromChildren: any, matchRoutes: any;
try {
  React = require('react');
  const routerImports = require('react-router-dom');
  useLocation = routerImports.useLocation;
  useNavigationType = routerImports.useNavigationType;
  createRoutesFromChildren = routerImports.createRoutesFromChildren;
  matchRoutes = routerImports.matchRoutes;
} catch {
  // Router not available, skip router instrumentation
}

// Export for testing
export { sanitizeClientData };