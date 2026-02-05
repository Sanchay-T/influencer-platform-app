import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { apiTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return apiTracker.trackRoute('campaign', 'get', async () => {
		try {
			structuredConsole.log('[CAMPAIGN-DETAIL-API] GET request received for campaign:', id);

			structuredConsole.log('[CAMPAIGN-DETAIL-API] Getting authenticated user from Clerk');
			const { userId } = await getAuthOrTest();

			if (!userId) {
				structuredConsole.error('[CAMPAIGN-DETAIL-API] Unauthorized - No valid user session');
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
			structuredConsole.log('[CAMPAIGN-DETAIL-API] User authenticated', { userId });

			// Set user and campaign context for Sentry
			SentryLogger.setContext('campaign_detail', { userId, campaignId: id });
			sessionTracker.setUser({ userId });

			structuredConsole.log(
				'[CAMPAIGN-DETAIL-API] Querying campaign with scraping jobs and results'
			);
			// Obtener la campaña con sus scraping jobs y resultados
			const campaign = await db.query.campaigns.findFirst({
				where: (campaigns, { eq }) => eq(campaigns.id, id),
				with: {
					scrapingJobs: {
						// FIX: Explicitly include processedResults so sidebar can show creator count
						// even when full results aren't loaded yet
						columns: {
							id: true,
							campaignId: true,
							userId: true,
							status: true,
							keywords: true,
							targetUsername: true,
							platform: true,
							searchParams: true,
							targetResults: true,
							processedResults: true, // Critical for sidebar creator count
							progress: true,
							error: true,
							createdAt: true,
							updatedAt: true,
							completedAt: true,
							timeoutAt: true,
						},
						with: {
							results: {
								columns: {
									id: true,
									jobId: true,
									creators: true,
									createdAt: true,
								},
							},
						},
						orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
					},
				},
			});

			if (!campaign) {
				structuredConsole.error('[CAMPAIGN-DETAIL-API] Campaign not found:', id);
				return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
			}
			structuredConsole.log('[CAMPAIGN-DETAIL-API] Campaign found:', {
				id: campaign.id,
				name: campaign.name,
			});

			// Verificar que la campaña pertenece al usuario
			if (campaign.userId !== userId) {
				structuredConsole.error(
					'[CAMPAIGN-DETAIL-API] Unauthorized - Campaign belongs to different user',
					{
						campaignUserId: campaign.userId,
						requestUserId: userId,
					}
				);
				// Track unauthorized access attempt
				SentryLogger.captureMessage('Unauthorized campaign access attempt', 'warning', {
					tags: { feature: 'campaign', reason: 'wrong_user' },
					extra: { campaignId: id, requestUserId: userId },
				});
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
			structuredConsole.log('[CAMPAIGN-DETAIL-API] User authorized to access campaign');

			structuredConsole.log('[CAMPAIGN-DETAIL-API] Campaign details:', {
				id: campaign.id,
				name: campaign.name,
				searchType: campaign.searchType,
				jobsCount: campaign.scrapingJobs?.length,
				jobs: campaign.scrapingJobs?.map((job) => ({
					id: job.id,
					status: job.status,
					resultsCount: job.results?.length || 0,
				})),
			});

			structuredConsole.log('[CAMPAIGN-DETAIL-API] Returning campaign details successfully');
			return NextResponse.json(campaign);
		} catch (error) {
			structuredConsole.error('[CAMPAIGN-DETAIL-API] Error fetching campaign:', error);

			// Capture error in Sentry with context
			SentryLogger.captureException(error, {
				tags: { feature: 'campaign', action: 'get' },
				extra: { campaignId: id },
			});

			return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
		}
	});
}
