import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // [Sentry] Initialize server-side error tracking
    await import('./sentry.server.config');

    // [Bootstrap] Ensure environment validation runs once during server start before any routes resolve.
    const { validateEnvironmentOnStartup } = await import('./lib/startup-validation.js');
    validateEnvironmentOnStartup();
    await import('./lib/logging/server-console-bridge');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // [Sentry] Initialize edge runtime error tracking
    await import('./sentry.edge.config');
  }
}

/**
 * Next.js instrumentation hook for request errors.
 * This captures all unhandled errors in API routes and server components.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) {
  // Capture the error with Sentry
  Sentry.captureException(err, {
    tags: {
      router_kind: context.routerKind,
      route_type: context.routeType,
      render_source: context.renderSource,
    },
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      revalidateReason: context.revalidateReason,
      renderType: context.renderType,
    },
  });

  // Also log to console for local debugging
  console.error('[REQUEST_ERROR]', {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}
