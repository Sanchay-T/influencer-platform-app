import * as Sentry from "@sentry/nextjs";

// Environment-based configuration for Edge runtime
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isDevelopment = environment === 'development';

// Simplified Edge runtime Sentry configuration
Sentry.init({
  dsn: "https://4157102c5407a90be0d7e8d5804d7160@o4509176214388736.ingest.us.sentry.io/4509979716616192",
  
  environment,
  
  // Basic integrations safe for Edge runtime
  integrations: [],
  
  // Conservative performance monitoring for Edge runtime
  tracesSampleRate: isDevelopment ? 1.0 : 0.05, // 100% in dev, 5% in prod (lower for Edge)
  
  // Disable session tracking in Edge runtime for performance
  autoSessionTracking: false,
  
  // Enable logging
  _experiments: {
    enableLogs: true,
  },
});