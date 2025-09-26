export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
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