import { auth } from '@clerk/nextjs/server';
import { and, eq, sql } from 'drizzle-orm';
import { Suspense } from 'react';
import ClientCampaignPage from '@/app/campaigns/[id]/client-page';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import type { Campaign } from '@/app/types/campaign';
import { db } from '@/lib/db';
import { campaigns, jobCreators } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

interface PageProps {
	params: Promise<{ id: string }>;
}

async function getCampaign(id: string) {
	try {
		const { userId } = await auth();

		if (!userId) {
			return null;
		}

		const debugCampaign = process.env.CAMPAIGN_DEBUG_LOGS === 'true';
		if (debugCampaign) {
			structuredConsole.log('Fetching campaign with id:', id);
		}
		const campaign = await db.query.campaigns.findFirst({
			where: and(eq(campaigns.id, id), eq(campaigns.userId, userId)),
			with: {
				scrapingJobs: {
					orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
				},
			},
		});

		if (!campaign) {
			if (debugCampaign) {
				structuredConsole.log('No campaign found with id:', id);
			}
			return null;
		}

		if (debugCampaign) {
			structuredConsole.log(
				'📊 [CAMPAIGN-DEBUG] Campaign structure:',
				JSON.stringify(
					{
						id: campaign.id,
						name: campaign.name,
						status: campaign.status,
						jobsCount: campaign.scrapingJobs?.length,
						jobs: campaign.scrapingJobs?.map((job) => ({
							id: job.id,
							status: job.status,
							createdAt: job.createdAt,
							campaignId: job.campaignId,
							platform: job.platform,
							keywords: job.keywords,
							targetUsername: job.targetUsername,
							// Results intentionally omitted during server render to prevent large payloads.
							resultsLoaded: false,
						})),
					},
					null,
					2
				)
			);

			// 🔍 ADDITIONAL LOGGING: Check if multiple jobs exist for this campaign
			structuredConsole.log(
				'🔍 [CAMPAIGN-RUNS-DEBUG] Total jobs found for campaign:',
				campaign.scrapingJobs?.length || 0
			);
			campaign.scrapingJobs?.forEach((job, index) => {
				structuredConsole.log(`🏃 [RUN-${index + 1}] Job ${job.id}:`, {
					status: job.status,
					createdAt: job.createdAt,
					platform: job.platform,
					resultsLoadedServer: false,
				});
			});

			// 🔍 COMPLETED JOBS DEBUG: Check how many completed jobs exist
			const completedJobs =
				campaign.scrapingJobs?.filter((job) => job.status === 'completed') || [];
			structuredConsole.log(
				'✅ [COMPLETED-JOBS-DEBUG] Found completed jobs:',
				completedJobs.length
			);
			completedJobs.forEach((job, index) => {
				structuredConsole.log(`✅ [COMPLETED-${index + 1}] Job ${job.id}:`, {
					platform: job.platform,
					createdAt: job.createdAt,
					resultsHydration: 'client-fetch',
				});
			});
		}

		// Pre-load first 50 creators for completed/partial jobs (for instant UI)
		const jobsWithData = await Promise.all(
			(campaign.scrapingJobs ?? []).map(async (job) => {
				// Only pre-load for terminal states that have data
				const hasData = ['completed', 'partial', 'error', 'timeout'].includes(job.status ?? '');

				if (!hasData) {
					return { ...job, results: [], totalCreators: 0, preloaded: false };
				}

				try {
					// Fetch first 200 creators from job_creators table
					// @why 200 is enough for initial view, pagination handles the rest
					const creators = await db
						.select({ creatorData: jobCreators.creatorData })
						.from(jobCreators)
						.where(eq(jobCreators.jobId, job.id))
						.orderBy(jobCreators.createdAt)
						.limit(200);

					// Get total count
					const countResult = await db
						.select({ count: sql<number>`count(*)::int` })
						.from(jobCreators)
						.where(eq(jobCreators.jobId, job.id));

					const totalCreators = countResult[0]?.count ?? 0;

					if (debugCampaign) {
						structuredConsole.log(
							`✅ [PRE-LOAD] Job ${job.id}: ${creators.length} creators pre-loaded, ${totalCreators} total`
						);
					}

					return {
						...job,
						results: [{ id: job.id, creators: creators.map((c) => c.creatorData) }],
						totalCreators,
						preloaded: true,
					};
				} catch (error) {
					structuredConsole.error(`Failed to pre-load creators for job ${job.id}:`, error);
					return { ...job, results: [], totalCreators: 0, preloaded: false };
				}
			})
		);

		return {
			...campaign,
			scrapingJobs: jobsWithData,
		};
	} catch (error) {
		structuredConsole.error('Error fetching campaign:', error);
		throw error;
	}
}

export default async function CampaignPage({ params }: PageProps) {
	const { id } = await params;
	const campaign = await getCampaign(id);

	return (
		<DashboardLayout>
			<Suspense
				fallback={
					<div className="flex items-center justify-center min-h-[60vh]">
						<div className="text-center space-y-4">
							<div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-200 border-t-transparent"></div>
							<p className="text-sm text-zinc-400">Loading campaign data...</p>
						</div>
					</div>
				}
			>
				<ClientCampaignPage campaign={campaign as Campaign | null} />
			</Suspense>
		</DashboardLayout>
	);
}
