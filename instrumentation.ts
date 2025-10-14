export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    // [Bootstrap] Ensure environment validation runs once during server start before any routes resolve.
    const { validateEnvironmentOnStartup } = await import('./lib/startup-validation.js')
    validateEnvironmentOnStartup()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(err: unknown, request: {
  path: string;
  headers?: { [key: string]: string | string[] | undefined };
}) {
  const { captureRequestError } = await import('@sentry/nextjs');
  captureRequestError(err, request);
}
