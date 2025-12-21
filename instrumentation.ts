export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // [Bootstrap] Ensure environment validation runs once during server start before any routes resolve.
    const { validateEnvironmentOnStartup } = await import('./lib/startup-validation.js')
    validateEnvironmentOnStartup()
    await import('./lib/logging/server-console-bridge')
  }

  // Edge runtime - no special setup needed
}

export async function onRequestError(err: unknown, request: {
  path: string;
  headers?: { [key: string]: string | string[] | undefined };
}) {
  // Log errors to console (Sentry removed)
  console.error('[REQUEST_ERROR]', {
    path: request.path,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}
