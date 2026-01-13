import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { FeatureGateService } from '@/lib/billing';
import { db } from '@/lib/db';
import { jobCreators, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { dedupeCreators, formatEmailsForCsv } from '@/lib/export/csv-utils';
import { structuredConsole } from '@/lib/logging/console-proxy';

/**
 * @context V2 jobs store creators in jobCreators table, legacy jobs use scrapingResults.
 * This helper fetches V2 creators first, falls back to legacy if none found.
 */
async function getCreatorsForJobs(
	jobIds: string[]
): Promise<{ creators: any[]; source: 'v2' | 'legacy' }> {
	// Try V2 jobCreators table first
	const v2Creators = await db.query.jobCreators.findMany({
		where: inArray(jobCreators.jobId, jobIds),
	});

	if (v2Creators.length > 0) {
		structuredConsole.log(
			`CSV Export: Found ${v2Creators.length} creators in V2 jobCreators table`
		);
		// Extract creatorData from each row
		return {
			creators: v2Creators.map((c) => c.creatorData),
			source: 'v2',
		};
	}

	// Fall back to legacy scrapingResults
	structuredConsole.log('CSV Export: No V2 creators found, checking legacy scrapingResults');
	const legacyResults = await db.query.scrapingResults.findMany({
		where: inArray(scrapingResults.jobId, jobIds),
	});

	let allCreators: any[] = [];
	legacyResults.forEach((result) => {
		const creatorsData = result.creators as any;
		if (Array.isArray(creatorsData)) {
			allCreators = allCreators.concat(creatorsData);
		} else if (creatorsData && typeof creatorsData === 'object') {
			if ('results' in creatorsData && Array.isArray(creatorsData.results)) {
				const nested = creatorsData.results.reduce((acc: any[], r: any) => {
					if (r.creators && Array.isArray(r.creators)) {
						return [...acc, ...r.creators];
					}
					return acc;
				}, []);
				allCreators = allCreators.concat(nested);
			} else {
				Object.keys(creatorsData).forEach((key) => {
					if (Array.isArray(creatorsData[key])) {
						allCreators = allCreators.concat(creatorsData[key]);
					}
				});
			}
		}
	});

	return { creators: allCreators, source: 'legacy' };
}

// @performance Vercel timeout protection - CSV export can take a long time for large datasets
export const maxDuration = 60;

export async function GET(req: Request) {
	try {
		structuredConsole.log('CSV Export: Starting export process');
		const { searchParams } = new URL(req.url);
		const jobId = searchParams.get('jobId');
		const campaignId = searchParams.get('campaignId');

		if (!(jobId || campaignId)) {
			structuredConsole.log('CSV Export: Job ID or campaign ID is missing');
			return NextResponse.json({ error: 'Job ID or campaign ID is required' }, { status: 400 });
		}

		structuredConsole.log(`CSV Export: Processing job ID ${jobId} and campaign ID ${campaignId}`);

		// Verify authentication
		const { userId } = await getAuthOrTest();

		if (!userId) {
			structuredConsole.log('CSV Export: Authentication failed');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		structuredConsole.log('CSV Export: Authentication successful', { userId });

		// Feature gate: ensure CSV export is allowed for this plan
		const gate = await FeatureGateService.assertExportFormat(userId, 'CSV');
		if (!gate.allowed) {
			structuredConsole.log('CSV Export: blocked by feature gate', gate);
			return NextResponse.json(
				{
					error: 'CSV export not available on your plan',
					upgrade: true,
					currentPlan: gate.currentPlan,
					reason: gate.reason,
				},
				{ status: 403 }
			);
		}

		// Export all creators from all jobs in the campaign
		if (campaignId) {
			structuredConsole.log(`CSV Export: Processing campaign ID ${campaignId}`);

			// Get all jobs for the campaign
			const jobs = await db.query.scrapingJobs.findMany({
				where: (jobs, { eq }) => eq(jobs.campaignId, String(campaignId)),
			});
			structuredConsole.log('Jobs found:', jobs.length);

			if (jobs.length === 0) {
				return NextResponse.json({ error: 'No jobs found in campaign' }, { status: 404 });
			}

			// Collect keywords from all jobs
			let keywords: string[] = [];
			jobs.forEach((job) => {
				if (Array.isArray(job.keywords)) {
					keywords = keywords.concat(job.keywords);
				}
			});
			keywords = Array.from(new Set(keywords));

			// Get creators using V2/legacy helper
			const jobIds = jobs.map((j) => j.id);
			const { creators: allCreators, source } = await getCreatorsForJobs(jobIds);

			structuredConsole.log(
				`CSV Export: Found ${allCreators.length} creators from ${source} source`
			);

			const dedupedCampaignCreators = dedupeCreators(allCreators);
			structuredConsole.log('CSV Export: Deduped campaign creators', {
				before: allCreators.length,
				after: dedupedCampaignCreators.length,
				source,
			});

			if (dedupedCampaignCreators.length === 0) {
				return NextResponse.json({ error: 'No creators found in campaign' }, { status: 404 });
			}
			// Generar CSV igual que antes, usando allCreators y keywords
			let csvContent = '';
			const firstCreator = dedupedCampaignCreators[0];
			if (firstCreator.creator && firstCreator.video) {
				// Detect platform mix for campaign export
				const platforms = [
					...new Set(dedupedCampaignCreators.map((item) => item.platform || 'Unknown')),
				];
				structuredConsole.log('CSV Export (Campaign): Detected platforms:', platforms);

				// Use a unified format that works for all platforms
				const headers = [
					'Platform',
					'Creator/Channel Name',
					'Followers',
					'Video/Content URL',
					'Title/Description',
					'Views',
					'Likes',
					'Comments',
					'Shares',
					'Duration (seconds)',
					'Hashtags',
					'Date',
					'Keywords',
					'Email',
				];

				csvContent = headers.join(',') + '\n';

				dedupedCampaignCreators.forEach((item) => {
					const creator = item.creator || {};
					const video = item.video || {};
					const stats = video.statistics || {};
					const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(';') : '';
					const keywordsStr = keywords.join(';');
					const itemPlatform = item.platform || 'Unknown';
					const emailCell = formatEmailsForCsv([item, creator]);

					// Handle date based on platform
					let dateStr = '';
					if (itemPlatform === 'YouTube' && item.publishedTime) {
						dateStr = new Date(item.publishedTime).toISOString().split('T')[0];
					} else if (item.createTime) {
						dateStr = new Date(item.createTime * 1000).toISOString().split('T')[0];
					}

					const row = [
						`"${itemPlatform}"`,
						`"${creator.name || ''}"`,
						`"${creator.followers || 0}"`,
						`"${video.url || ''}"`,
						`"${(video.description || '').replace(/"/g, '""')}"`,
						`"${stats.views || 0}"`,
						`"${stats.likes || 0}"`,
						`"${stats.comments || 0}"`,
						`"${stats.shares || 0}"`,
						`"${item.lengthSeconds || 0}"`,
						`"${hashtags}"`,
						`"${dateStr}"`,
						`"${keywordsStr}"`,
						`"${emailCell}"`,
					];
					csvContent += row.join(',') + '\n';
				});
			} else if ('profile' in firstCreator) {
				csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
				dedupedCampaignCreators.forEach((creator) => {
					csvContent += `"${creator.profile || ''}","${(creator.keywords || []).join(';')}","${creator.platformName || ''}","${creator.followers || ''}","${creator.region || ''}","${creator.profileUrl || ''}","${(creator.creatorCategory || []).join(';')}"\n`;
				});
			} else if (
				'username' in firstCreator &&
				('is_private' in firstCreator || 'full_name' in firstCreator)
			) {
				csvContent = 'Username,Full Name,Email,Private,Verified,Profile URL\n';
				dedupedCampaignCreators.forEach((creator) => {
					const emailCell = formatEmailsForCsv(creator);
					csvContent += `"${creator.username || ''}","${creator.full_name || ''}","${emailCell}","${creator.is_private || ''}","${creator.is_verified || ''}","${creator.profile_pic_url || ''}"\n`;
				});
			} else {
				const fields = Object.keys(firstCreator);
				csvContent = fields.join(',') + '\n';
				dedupedCampaignCreators.forEach((creator) => {
					const values = fields.map((field) => {
						const value = creator[field];
						if (typeof value === 'object' && value !== null) {
							return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
						}
						return `"${value || ''}"`;
					});
					csvContent += values.join(',') + '\n';
				});
			}
			const headers = new Headers();
			headers.set('Content-Type', 'text/csv');
			headers.set(
				'Content-Disposition',
				`attachment; filename=creators-campaign-${campaignId}-${new Date().toISOString().split('T')[0]}.csv`
			);
			return new NextResponse(csvContent, {
				headers,
				status: 200,
			});
		}

		if (!jobId) {
			return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
		}

		// Get job data to include keywords in export
		const job = await db.query.scrapingJobs.findFirst({
			where: eq(scrapingJobs.id, jobId),
		});

		if (!job) {
			structuredConsole.log('CSV Export: Job not found');
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

		structuredConsole.log('CSV Export: Job data retrieved', {
			hasKeywords: Boolean(job?.keywords),
			keywordsLength: Array.isArray(job?.keywords) ? job.keywords.length : 0,
		});

		// Extract keywords for the CSV
		const keywords = (job?.keywords as string[]) || [];

		try {
			// Use V2/legacy helper to get creators
			const { creators, source } = await getCreatorsForJobs([jobId]);
			structuredConsole.log(`CSV Export: Found ${creators.length} creators from ${source} source`);

			const dedupedCreators = dedupeCreators(creators, {
				platformHint: job?.platform ?? null,
			});

			structuredConsole.log('CSV Export: Deduped creators for job export', {
				before: creators.length,
				after: dedupedCreators.length,
			});

			if (dedupedCreators.length === 0) {
				return NextResponse.json({ error: 'No creators found in data structure' }, { status: 404 });
			}

			// Generate CSV content
			let csvContent = '';
			const firstCreator = dedupedCreators[0];

			structuredConsole.log(
				'CSV Export: First creator structure sample',
				JSON.stringify(firstCreator).substring(0, 200) + '...'
			);

			// Detect the structure from the creators array
			if (
				firstCreator.username &&
				(firstCreator.is_verified !== undefined || firstCreator.full_name)
			) {
				// This is similar search format (Instagram or TikTok similar)
				structuredConsole.log('CSV Export: Detected similar search format');

				const platform = firstCreator.platform || 'Unknown';
				const headers = [
					'Username',
					'Full Name',
					'Followers',
					'Email',
					'Verified',
					'Private',
					'Platform',
					'Profile URL',
				];

				csvContent = headers.join(',') + '\n';

				dedupedCreators.forEach((creator) => {
					const emailCell = formatEmailsForCsv(creator);
					const profileUrl =
						creator.platform === 'TikTok'
							? `https://www.tiktok.com/@${creator.username}`
							: `https://instagram.com/${creator.username}`;

					const row = [
						`"${creator.username || ''}"`,
						`"${creator.full_name || creator.displayName || ''}"`,
						`"${creator.followerCount || creator.followers || 0}"`,
						`"${emailCell}"`,
						`"${creator.is_verified || creator.verified ? 'Yes' : 'No'}"`,
						`"${creator.is_private || creator.isPrivate ? 'Yes' : 'No'}"`,
						`"${creator.platform || 'Instagram'}"`,
						`"${profileUrl}"`,
					];

					csvContent += row.join(',') + '\n';
				});
			} else if (firstCreator.creator && firstCreator.video) {
				// Detect platform type to determine appropriate columns
				const platform = firstCreator.platform || 'Unknown';
				structuredConsole.log('CSV Export: Detected platform:', platform);

				let headers: string[];

				if (platform === 'YouTube' && job?.targetUsername) {
					// YouTube Similar Search - enhanced with bio/email data
					headers = [
						'Channel Name',
						'Handle',
						'Full Name',
						'Bio',
						'Email',
						'Social Links',
						'Subscribers',
						'Target Channel',
						'Platform',
					];
				} else if (platform === 'YouTube') {
					// YouTube Keyword Search - video-based data
					headers = [
						'Channel Name',
						'Subscribers',
						'Bio',
						'Email',
						'Social Links',
						'Video Title',
						'Video URL',
						'Views',
						'Duration (seconds)',
						'Hashtags',
						'Keywords',
						'Platform',
					];
				} else {
					// TikTok/other platforms columns
					headers = [
						'Username',
						'Followers',
						'Bio',
						'Email',
						'Video URL',
						'Description',
						'Likes',
						'Comments',
						'Shares',
						'Views',
						'Hashtags',
						'Created Date',
						'Keywords',
						'Platform',
					];
				}

				csvContent = headers.join(',') + '\n';

				dedupedCreators.forEach((item) => {
					const creator = item.creator || {};
					const video = item.video || {};
					const stats = video.statistics || {};
					const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(';') : '';
					const keywordsStr = keywords.join(';');
					const itemPlatform = item.platform || 'Unknown';
					const emailCell = formatEmailsForCsv([item, creator]);

					let row: string[];

					if (itemPlatform === 'YouTube' && job?.targetUsername) {
						// YouTube Similar Search - enhanced with bio/email data
						const bio = (item.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
						const socialLinks = Array.isArray(item.socialLinks) ? item.socialLinks.join('; ') : '';

						row = [
							`"${item.name || ''}"`,
							`"${item.handle || ''}"`,
							`"${item.full_name || item.name || ''}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${socialLinks}"`,
							`"${item.subscriberCount || 'N/A'}"`,
							`"${job.targetUsername || ''}"`,
							`"${itemPlatform}"`,
						];
					} else if (itemPlatform === 'YouTube') {
						// YouTube Keyword Search - video-based data
						// Extract bio and emails for YouTube export
						const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
						const socialLinks = Array.isArray(creator.socialLinks)
							? creator.socialLinks.join('; ')
							: '';

						row = [
							`"${creator.name || ''}"`,
							`"${creator.followers || 0}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${socialLinks}"`,
							`"${(video.description || '').replace(/"/g, '""')}"`, // Video title
							`"${video.url || ''}"`,
							`"${stats.views || 0}"`,
							`"${item.lengthSeconds || 0}"`,
							`"${hashtags}"`,
							`"${keywordsStr}"`,
							`"${itemPlatform}"`,
						];
					} else {
						// TikTok/other platforms data extraction
						const createdDate = item.createTime
							? new Date(item.createTime * 1000).toISOString().split('T')[0]
							: '';

						// Extract bio and emails for TikTok export
						const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV

						row = [
							`"${creator.name || ''}"`,
							`"${creator.followers || 0}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${video.url || ''}"`,
							`"${(video.description || '').replace(/"/g, '""')}"`,
							`"${stats.likes || 0}"`,
							`"${stats.comments || 0}"`,
							`"${stats.shares || 0}"`,
							`"${stats.views || 0}"`,
							`"${hashtags}"`,
							`"${createdDate}"`,
							`"${keywordsStr}"`,
							`"${itemPlatform}"`,
						];
					}

					csvContent += row.join(',') + '\n';
				});

				structuredConsole.log(`CSV Export: Generated CSV with ${platform} structure`);
			} else if ('profile' in firstCreator) {
				// Old TikTok format
				csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
				dedupedCreators.forEach((creator) => {
					csvContent += `"${creator.profile || ''}","${(creator.keywords || []).join(';')}","${creator.platformName || ''}","${creator.followers || ''}","${creator.region || ''}","${creator.profileUrl || ''}","${(creator.creatorCategory || []).join(';')}"\n`;
				});
				structuredConsole.log('CSV Export: Generated CSV with old TikTok structure');
			} else if (
				'username' in firstCreator &&
				('is_private' in firstCreator || 'full_name' in firstCreator)
			) {
				// Instagram similar search structure - enhanced with bio and email
				csvContent = 'Username,Full Name,Bio,Email,Private,Verified,Profile URL,Platform\n';
				dedupedCreators.forEach((creator) => {
					const emailCell = formatEmailsForCsv(creator);
					// Extract bio and emails for Instagram export
					const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
					const profileUrl = creator.profileUrl || `https://instagram.com/${creator.username}`;
					const platform = creator.platform || 'Instagram';

					csvContent += `"${creator.username || ''}","${creator.full_name || ''}","${bio}","${emailCell}","${creator.is_private ? 'Yes' : 'No'}","${creator.is_verified ? 'Yes' : 'No'}","${profileUrl}","${platform}"\n`;
				});
				structuredConsole.log(
					'CSV Export: Generated CSV with enhanced Instagram structure (bio/email included)'
				);
			} else {
				// Fallback for unknown structure - just try to extract common fields
				const fields = Object.keys(firstCreator);
				csvContent = fields.join(',') + '\n';

				dedupedCreators.forEach((creator) => {
					const values = fields.map((field) => {
						const value = creator[field];
						if (typeof value === 'object' && value !== null) {
							return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
						}
						return `"${value || ''}"`;
					});
					csvContent += values.join(',') + '\n';
				});
				structuredConsole.log(
					'CSV Export: Generated CSV with unknown structure, using fields:',
					fields
				);
			}

			// Set headers for CSV download
			const headers = new Headers();
			headers.set('Content-Type', 'text/csv');
			headers.set(
				'Content-Disposition',
				`attachment; filename=creators-${new Date().toISOString().split('T')[0]}.csv`
			);

			structuredConsole.log('CSV Export: Returning CSV file');
			return new NextResponse(csvContent, {
				headers,
				status: 200,
			});
		} catch (parseError) {
			structuredConsole.error('CSV Export: Error parsing creators data:', parseError);
			return NextResponse.json({ error: 'Error parsing creators data' }, { status: 500 });
		}
	} catch (error) {
		structuredConsole.error('CSV Export: Error exporting CSV:', error);
		return NextResponse.json(
			{ error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}
