import { NextResponse } from 'next/server';

/**
 * Health check endpoint for monitoring and deployment verification.
 *
 * Usage:
 * - Basic check: GET /api/health
 * - Detailed check: GET /api/health?detailed=true
 *
 * Used by:
 * - Vercel deployment checks
 * - Load balancers
 * - Uptime monitoring (e.g., Better Uptime, Pingdom)
 * - CI/CD pipelines
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const detailed = searchParams.get('detailed') === 'true';

	const health = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	};

	if (detailed) {
		return NextResponse.json({
			...health,
			environment: process.env.NODE_ENV,
			version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
			node: process.version,
			memory: {
				used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
				unit: 'MB',
			},
		});
	}

	return NextResponse.json(health);
}
