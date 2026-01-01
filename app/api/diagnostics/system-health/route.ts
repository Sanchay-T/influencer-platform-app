import { count, desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { deriveTrialStatus } from '@/lib/billing/trial-status';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { backgroundJobs, events } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET(request: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		structuredConsole.log(
			'🔍 [SYSTEM-HEALTH] Running comprehensive system diagnostics for user:',
			userId
		);

		const diagnostics: any = {
			timestamp: new Date().toISOString(),
			userId,
			checks: {},
		};

		// 1. Check if new tables exist
		structuredConsole.log('🔍 [SYSTEM-HEALTH] Checking database schema...');
		try {
			// Test events table
			const eventCount = await db.select({ count: count() }).from(events);
			diagnostics.checks.eventsTable = {
				exists: true,
				totalEvents: eventCount[0]?.count || 0,
			};
			structuredConsole.log(
				'✅ [SYSTEM-HEALTH] Events table exists with',
				eventCount[0]?.count,
				'events'
			);
		} catch (error) {
			diagnostics.checks.eventsTable = {
				exists: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
			structuredConsole.error('❌ [SYSTEM-HEALTH] Events table check failed:', error);
		}

		try {
			// Test background_jobs table
			const jobCount = await db.select({ count: count() }).from(backgroundJobs);
			diagnostics.checks.backgroundJobsTable = {
				exists: true,
				totalJobs: jobCount[0]?.count || 0,
			};
			structuredConsole.log(
				'✅ [SYSTEM-HEALTH] Background jobs table exists with',
				jobCount[0]?.count,
				'jobs'
			);
		} catch (error) {
			diagnostics.checks.backgroundJobsTable = {
				exists: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
			structuredConsole.error('❌ [SYSTEM-HEALTH] Background jobs table check failed:', error);
		}

		// 2. Check user profile state
		structuredConsole.log('🔍 [SYSTEM-HEALTH] Checking user profile state...');
		const userProfile = await getUserProfile(userId);

		if (userProfile) {
			// Derive trial status from subscription status + trial end date
			const trialStatus = deriveTrialStatus(
				userProfile.subscriptionStatus,
				userProfile.trialEndDate
			);

			diagnostics.checks.userProfile = {
				exists: true,
				onboardingStep: userProfile.onboardingStep,
				trialStatus, // Now derived
				currentPlan: userProfile.currentPlan,
				subscriptionStatus: userProfile.subscriptionStatus,
				hasStripeData: !!(userProfile.stripeCustomerId && userProfile.stripeSubscriptionId),
				lastWebhookEvent: userProfile.lastWebhookEvent,
				lastWebhookTimestamp: userProfile.lastWebhookTimestamp?.toISOString(),
				billingSyncStatus: userProfile.billingSyncStatus,
				inconsistentState:
					userProfile.currentPlan !== 'free' &&
					userProfile.onboardingStep !== 'completed' &&
					userProfile.stripeSubscriptionId,
			};
		} else {
			diagnostics.checks.userProfile = {
				exists: false,
				error: 'User profile not found',
			};
		}

		// 3. Check user events
		if (diagnostics.checks.eventsTable.exists) {
			structuredConsole.log('🔍 [SYSTEM-HEALTH] Checking user events...');
			try {
				const userEvents = await db.query.events.findMany({
					where: eq(events.aggregateId, userId),
					orderBy: desc(events.timestamp),
					limit: 10,
				});

				diagnostics.checks.userEvents = {
					totalEvents: userEvents.length,
					recentEvents: userEvents.map((event) => ({
						id: event.id,
						eventType: event.eventType,
						timestamp: event.timestamp.toISOString(),
						processingStatus: event.processingStatus,
						sourceSystem: event.sourceSystem,
					})),
				};
			} catch (error) {
				diagnostics.checks.userEvents = {
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}

		// 4. Check user background jobs
		if (diagnostics.checks.backgroundJobsTable.exists && userProfile) {
			structuredConsole.log('🔍 [SYSTEM-HEALTH] Checking user background jobs...');
			try {
				const userJobs = await db.query.backgroundJobs.findMany({
					where: eq(backgroundJobs.payload, userProfile.userId),
					orderBy: desc(backgroundJobs.createdAt),
					limit: 10,
				});

				diagnostics.checks.userBackgroundJobs = {
					totalJobs: userJobs.length,
					recentJobs: userJobs.map((job) => ({
						id: job.id,
						jobType: job.jobType,
						status: job.status,
						createdAt: job.createdAt.toISOString(),
						startedAt: job.startedAt?.toISOString(),
						completedAt: job.completedAt?.toISOString(),
						failedAt: job.failedAt?.toISOString(),
						retryCount: job.retryCount,
						error: job.error,
					})),
				};
			} catch (error) {
				diagnostics.checks.userBackgroundJobs = {
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}

		// 5. Check service imports
		structuredConsole.log('🔍 [SYSTEM-HEALTH] Checking service imports...');
		try {
			const { EventService } = await import('@/lib/events/event-service');
			diagnostics.checks.eventService = {
				importable: true,
				functions: typeof EventService.createEvent === 'function',
			};
		} catch (error) {
			diagnostics.checks.eventService = {
				importable: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}

		try {
			const { JobProcessor } = await import('@/lib/jobs/job-processor');
			diagnostics.checks.jobProcessor = {
				importable: true,
				functions: typeof JobProcessor.queueJob === 'function',
			};
		} catch (error) {
			diagnostics.checks.jobProcessor = {
				importable: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}

		// 6. Environment checks
		diagnostics.checks.environment = {
			hasQstashToken: !!process.env.QSTASH_TOKEN,
			hasQstashSigningKeys: !!(
				process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
			),
			hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
			nodeEnv: process.env.NODE_ENV,
		};

		// 7. Overall system health assessment
		const criticalIssues = [];
		if (!diagnostics.checks.eventsTable.exists) criticalIssues.push('Events table missing');
		if (!diagnostics.checks.backgroundJobsTable.exists)
			criticalIssues.push('Background jobs table missing');
		if (!diagnostics.checks.eventService.importable)
			criticalIssues.push('Event service not importable');
		if (!diagnostics.checks.jobProcessor.importable)
			criticalIssues.push('Job processor not importable');
		if (diagnostics.checks.userProfile.inconsistentState)
			criticalIssues.push('User in inconsistent state');

		diagnostics.overallHealth = {
			status: criticalIssues.length === 0 ? 'healthy' : 'unhealthy',
			criticalIssues,
			recommendedActions:
				criticalIssues.length > 0
					? [
							'Run database migration if tables are missing',
							'Check build/deployment if services not importable',
							'Review webhook processing if user state inconsistent',
						]
					: ['System appears healthy'],
		};

		structuredConsole.log('📊 [SYSTEM-HEALTH] Diagnostics complete:', {
			status: diagnostics.overallHealth.status,
			criticalIssues: criticalIssues.length,
			userState: diagnostics.checks.userProfile?.onboardingStep || 'unknown',
		});

		return NextResponse.json(diagnostics);
	} catch (error) {
		structuredConsole.error('❌ [SYSTEM-HEALTH] Diagnostics failed:', error);
		return NextResponse.json(
			{
				error: 'Diagnostics failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
