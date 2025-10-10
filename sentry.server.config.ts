import * as Sentry from "@sentry/nextjs";

// Environment-based configuration
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';

// Simplified Sentry initialization
try {
  Sentry.init({
    dsn: "https://4157102c5407a90be0d7e8d5804d7160@o4509176214388736.ingest.us.sentry.io/4509979716616192",
    
    // Basic integrations that work with Sentry v8
    integrations: [
      // Console capture integration for server-side logging
      Sentry.captureConsoleIntegration({ levels: ["log", "warn", "error"] }),
    ],

    // Performance Monitoring
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in prod
    
    // Enable logging
    _experiments: {
      enableLogs: true,
    },
  });

  console.log(`[SENTRY-SERVER] Initialized successfully for environment: ${environment}`);
  
} catch (error) {
  console.error('[SENTRY-SERVER] Failed to initialize Sentry:', error);
  // Continue without Sentry rather than crashing
}