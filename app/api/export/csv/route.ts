import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { FeatureGateService } from '@/lib/billing';
import { db } from '@/lib/db';
import { jobCreators, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { dedupeCreators, formatEmailsForCsv } from '@/lib/export/csv-utils';
import { structuredConsole } from '@/lib/logging/console-proxy';
import {
	getBooleanProperty,
	getNumberProperty,
	getRecordProperty,
	getStringArrayProperty,
	getStringProperty,
	toArray,
	toRecord,
	toStringArray,
	type UnknownRecord,
} from '@/lib/utils/type-guards';

const emptyRecord: UnknownRecord = {};

const getRecordOrEmpty = (value: unknown): UnknownRecord => toRecord(value) ?? emptyRecord;

const getStringOrEmpty = (record: UnknownRecord, key: string): string =>
	getStringProperty(record, key) ?? '';

const getNumberOrZero = (record: UnknownRecord, key: string): number =>
	getNumberProperty(record, key) ?? 0;

const getStringArrayOrEmpty = (record: UnknownRecord, key: string): string[] =>
	getStringArrayProperty(record, key) ?? [];

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

		const extractCreatorsFromData = (creatorsData: unknown) => {
			if (Array.isArray(creatorsData)) {
				return { creators: creatorsData, structure: 'array' };
			}
			const record = toRecord(creatorsData);
			if (!record) {
				return { creators: [], structure: '' };
			}

			const results = toArray(record.results);
			if (results) {
				const nested = results.reduce<unknown[]>((acc, entry) => {
					const entryRecord = toRecord(entry);
					if (Array.isArray(entryRecord?.creators)) {
						return [...acc, ...entryRecord.creators];
					}
					return acc;
				}, []);
				return { creators: nested, structure: 'object.results[]' };
			}

			const creators: unknown[] = [];
			Object.values(record).forEach((value) => {
				if (Array.isArray(value)) {
					creators.push(...value);
				}
			});
			return { creators, structure: 'object.keys[]' };
		};

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

		// Si se recibe campaignId, exportar todos los creadores de todos los jobs de la campaña
		if (campaignId) {
			structuredConsole.log(`CSV Export: Processing campaign ID ${campaignId}`);
			// Buscar todos los jobs completados de la campaña
			const jobs = await db.query.scrapingJobs.findMany({
				where: (jobs, { eq }) => eq(jobs.campaignId, String(campaignId)),
				with: {
					results: true,
					creators: true, // V2 job_creators table
				},
			});
			structuredConsole.log('Jobs found:', jobs.length);
			let allCreators: unknown[] = [];
			let keywords: string[] = [];
			for (const job of jobs) {
				if (Array.isArray(job.keywords)) {
					keywords = keywords.concat(job.keywords);
				}

				// First try V2 job_creators table
				if (Array.isArray(job.creators) && job.creators.length > 0) {
					structuredConsole.log(
						`Job ${job.id} has ${job.creators.length} creators in job_creators table (V2)`
					);
					const v2Creators = job.creators.map((jc) => jc.creatorData);
					allCreators = allCreators.concat(v2Creators);
				}
				// Fallback to legacy scrapingResults table
				else if (Array.isArray(job.results) && job.results.length > 0) {
					structuredConsole.log(
						`Job ${job.id} has ${job.results.length} results in scrapingResults (legacy)`
					);
					job.results.forEach((result) => {
						const creatorsData = result.creators;
						const extracted = extractCreatorsFromData(creatorsData);
						allCreators = allCreators.concat(extracted.creators);
					});
				} else {
					structuredConsole.log(`Job ${job.id} has no creators in either table`);
				}
			}
			keywords = Array.from(new Set(keywords)); // Unificar keywords
			structuredConsole.log('Total creators found in campaign:', allCreators.length);
			const dedupedCampaignCreators = dedupeCreators(allCreators);
			structuredConsole.log('CSV Export: Deduped campaign creators', {
				before: allCreators.length,
				after: dedupedCampaignCreators.length,
			});

			if (dedupedCampaignCreators.length === 0) {
				return NextResponse.json({ error: 'No creators found in campaign' }, { status: 404 });
			}
			// Generar CSV igual que antes, usando allCreators y keywords
			let csvContent = '';
			const firstCreator = dedupedCampaignCreators[0];
			const firstCreatorRecord = getRecordOrEmpty(firstCreator);
			const firstCreatorHasCreatorVideo = Boolean(
				getRecordProperty(firstCreatorRecord, 'creator') &&
					getRecordProperty(firstCreatorRecord, 'video')
			);

			if (firstCreatorHasCreatorVideo) {
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
					const itemRecord = getRecordOrEmpty(item);
					const creator = getRecordProperty(itemRecord, 'creator') ?? emptyRecord;
					const video = getRecordProperty(itemRecord, 'video') ?? emptyRecord;
					const stats = getRecordProperty(video, 'statistics') ?? emptyRecord;
					const hashtags = getStringArrayProperty(itemRecord, 'hashtags') ?? [];
					const keywordsStr = keywords.join(';');
					const itemPlatform = getStringProperty(itemRecord, 'platform') ?? 'Unknown';
					const emailCell = formatEmailsForCsv([itemRecord, creator]);
					const publishedTime = getStringProperty(itemRecord, 'publishedTime');
					const createTime = getNumberProperty(itemRecord, 'createTime');

					// Handle date based on platform
					let dateStr = '';
					if (itemPlatform === 'YouTube' && publishedTime) {
						dateStr = new Date(publishedTime).toISOString().split('T')[0];
					} else if (typeof createTime === 'number') {
						dateStr = new Date(createTime * 1000).toISOString().split('T')[0];
					}

					const creatorName = getStringOrEmpty(creator, 'name');
					const creatorFollowers = getNumberOrZero(creator, 'followers');
					const videoUrl = getStringOrEmpty(video, 'url');
					const videoDescription = getStringOrEmpty(video, 'description').replace(/"/g, '""');
					const statsViews = getNumberOrZero(stats, 'views');
					const statsLikes = getNumberOrZero(stats, 'likes');
					const statsComments = getNumberOrZero(stats, 'comments');
					const statsShares = getNumberOrZero(stats, 'shares');
					const lengthSeconds = getNumberOrZero(itemRecord, 'lengthSeconds');

					const row = [
						`"${itemPlatform}"`,
						`"${creatorName}"`,
						`"${creatorFollowers}"`,
						`"${videoUrl}"`,
						`"${videoDescription}"`,
						`"${statsViews}"`,
						`"${statsLikes}"`,
						`"${statsComments}"`,
						`"${statsShares}"`,
						`"${lengthSeconds}"`,
						`"${hashtags.join(';')}"`,
						`"${dateStr}"`,
						`"${keywordsStr}"`,
						`"${emailCell}"`,
					];
					csvContent += row.join(',') + '\n';
				});
			} else if (getStringProperty(firstCreatorRecord, 'profile')) {
				csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
				dedupedCampaignCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const profile = getStringOrEmpty(creatorRecord, 'profile');
					const creatorKeywords = getStringArrayProperty(creatorRecord, 'keywords') ?? [];
					const platformName = getStringOrEmpty(creatorRecord, 'platformName');
					const followers = getNumberProperty(creatorRecord, 'followers');
					const region = getStringOrEmpty(creatorRecord, 'region');
					const profileUrl = getStringOrEmpty(creatorRecord, 'profileUrl');
					const creatorCategory = getStringArrayProperty(creatorRecord, 'creatorCategory') ?? [];

					csvContent += `"${profile}","${creatorKeywords.join(';')}","${platformName}","${followers ?? ''}","${region}","${profileUrl}","${creatorCategory.join(';')}"\n`;
				});
			} else if (
				getStringProperty(firstCreatorRecord, 'username') &&
				(getBooleanProperty(firstCreatorRecord, 'is_private') != null ||
					getStringProperty(firstCreatorRecord, 'full_name'))
			) {
				csvContent = 'Username,Full Name,Email,Private,Verified,Profile URL\n';
				dedupedCampaignCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const emailCell = formatEmailsForCsv(creatorRecord);
					const username = getStringOrEmpty(creatorRecord, 'username');
					const fullName = getStringOrEmpty(creatorRecord, 'full_name');
					const isPrivate = getBooleanProperty(creatorRecord, 'is_private');
					const isVerified = getBooleanProperty(creatorRecord, 'is_verified');
					const profilePicUrl = getStringOrEmpty(creatorRecord, 'profile_pic_url');

					csvContent += `"${username}","${fullName}","${emailCell}","${isPrivate ?? ''}","${isVerified ?? ''}","${profilePicUrl}"\n`;
				});
			} else {
				const fields = Object.keys(firstCreatorRecord);
				csvContent = fields.join(',') + '\n';
				dedupedCampaignCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const values = fields.map((field) => {
						const value = creatorRecord[field];
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
			with: {
				creators: true, // V2 job_creators table
			},
		});

		if (!job) {
			structuredConsole.log('CSV Export: Job not found');
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

		structuredConsole.log('CSV Export: Job data retrieved', {
			hasKeywords: Boolean(job.keywords),
			keywordsLength: Array.isArray(job.keywords) ? job.keywords.length : 0,
			v2CreatorsCount: Array.isArray(job.creators) ? job.creators.length : 0,
		});

		// Extract keywords for the CSV
		const keywords = toStringArray(job.keywords) ?? [];

		try {
			let creators: unknown[] = [];

			// First try V2 job_creators table
			if (Array.isArray(job.creators) && job.creators.length > 0) {
				structuredConsole.log(
					`CSV Export: Using ${job.creators.length} creators from job_creators table (V2)`
				);
				creators = job.creators.map((jc) => jc.creatorData);
			} else {
				// Fallback to legacy scrapingResults table
				const result = await db.query.scrapingResults.findFirst({
					where: eq(scrapingResults.jobId, String(jobId)),
				});

				if (result) {
					structuredConsole.log('CSV Export: Using creators from scrapingResults (legacy)');
					const creatorsData = result.creators;
					const extracted = extractCreatorsFromData(creatorsData);
					creators = extracted.creators;
					if (extracted.structure === 'array') {
						structuredConsole.log('CSV Export: Using creators array directly from database');
					} else if (extracted.structure) {
						structuredConsole.log(
							`CSV Export: Extracting creators from nested structure (${extracted.structure})`
						);
					}
				}
			}

			if (creators.length === 0) {
				structuredConsole.log('CSV Export: No creators found in either table');
				return NextResponse.json({ error: 'No creators found for this job' }, { status: 404 });
			}

			structuredConsole.log(`CSV Export: Found ${creators.length} creators`);

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
			const firstCreator = dedupedCreators[0] ?? emptyRecord;
			const firstCreatorRecord = getRecordOrEmpty(firstCreator);
			const firstUsername = getStringProperty(firstCreatorRecord, 'username');
			const firstFullName = getStringProperty(firstCreatorRecord, 'full_name');
			const firstIsVerified = getBooleanProperty(firstCreatorRecord, 'is_verified');

			structuredConsole.log(
				'CSV Export: First creator structure sample',
				JSON.stringify(firstCreator).substring(0, 200) + '...'
			);

			// Detect the structure from the creators array
			if (firstUsername && (firstIsVerified != null || firstFullName)) {
				// This is similar search format (Instagram or TikTok similar)
				structuredConsole.log('CSV Export: Detected similar search format');

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
					const creatorRecord = getRecordOrEmpty(creator);
					const emailCell = formatEmailsForCsv(creatorRecord);
					const creatorPlatform = getStringProperty(creatorRecord, 'platform') ?? 'Instagram';
					const username = getStringOrEmpty(creatorRecord, 'username');
					const displayName = getStringProperty(creatorRecord, 'displayName');
					const fullName =
						getStringProperty(creatorRecord, 'full_name') ??
						displayName ??
						getStringOrEmpty(creatorRecord, 'name');
					const followerCount =
						getNumberProperty(creatorRecord, 'followerCount') ??
						getNumberProperty(creatorRecord, 'followers') ??
						0;
					const isVerified =
						getBooleanProperty(creatorRecord, 'is_verified') ??
						getBooleanProperty(creatorRecord, 'verified');
					const isPrivate =
						getBooleanProperty(creatorRecord, 'is_private') ??
						getBooleanProperty(creatorRecord, 'isPrivate');
					const profileUrl =
						creatorPlatform === 'TikTok' && username
							? `https://www.tiktok.com/@${username}`
							: username
								? `https://instagram.com/${username}`
								: '';

					const row = [
						`"${username}"`,
						`"${fullName}"`,
						`"${followerCount}"`,
						`"${emailCell}"`,
						`"${isVerified ? 'Yes' : 'No'}"`,
						`"${isPrivate ? 'Yes' : 'No'}"`,
						`"${creatorPlatform}"`,
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
					const itemRecord = getRecordOrEmpty(item);
					const creator = getRecordProperty(itemRecord, 'creator') ?? emptyRecord;
					const video = getRecordProperty(itemRecord, 'video') ?? emptyRecord;
					const stats = getRecordProperty(video, 'statistics') ?? emptyRecord;
					const hashtags = getStringArrayProperty(itemRecord, 'hashtags') ?? [];
					const keywordsStr = keywords.join(';');
					const itemPlatform = getStringProperty(itemRecord, 'platform') ?? 'Unknown';
					const emailCell = formatEmailsForCsv([itemRecord, creator]);

					let row: string[];

					if (itemPlatform === 'YouTube' && job?.targetUsername) {
						// YouTube Similar Search - enhanced with bio/email data
						const bio = getStringOrEmpty(itemRecord, 'bio').replace(/"/g, '""'); // Escape quotes for CSV
						const socialLinks = getStringArrayProperty(itemRecord, 'socialLinks') ?? [];
						const name = getStringOrEmpty(itemRecord, 'name');
						const handle = getStringOrEmpty(itemRecord, 'handle');
						const fullName =
							getStringProperty(itemRecord, 'full_name') ?? getStringOrEmpty(itemRecord, 'name');
						const subscriberCount =
							getNumberProperty(itemRecord, 'subscriberCount') ??
							getStringProperty(itemRecord, 'subscriberCount') ??
							'N/A';

						row = [
							`"${name}"`,
							`"${handle}"`,
							`"${fullName}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${socialLinks.join('; ')}"`,
							`"${subscriberCount}"`,
							`"${job.targetUsername || ''}"`,
							`"${itemPlatform}"`,
						];
					} else if (itemPlatform === 'YouTube') {
						// YouTube Keyword Search - video-based data
						// Extract bio and emails for YouTube export
						const bio = getStringOrEmpty(creator, 'bio').replace(/"/g, '""'); // Escape quotes for CSV
						const socialLinks = getStringArrayProperty(creator, 'socialLinks') ?? [];
						const creatorName = getStringOrEmpty(creator, 'name');
						const creatorFollowers = getNumberOrZero(creator, 'followers');
						const videoDescription = getStringOrEmpty(video, 'description').replace(/"/g, '""');
						const videoUrl = getStringOrEmpty(video, 'url');
						const statsViews = getNumberOrZero(stats, 'views');
						const lengthSeconds = getNumberOrZero(itemRecord, 'lengthSeconds');

						row = [
							`"${creatorName}"`,
							`"${creatorFollowers}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${socialLinks.join('; ')}"`,
							`"${videoDescription}"`, // Video title
							`"${videoUrl}"`,
							`"${statsViews}"`,
							`"${lengthSeconds}"`,
							`"${hashtags.join(';')}"`,
							`"${keywordsStr}"`,
							`"${itemPlatform}"`,
						];
					} else {
						// TikTok/other platforms data extraction
						const createTime = getNumberProperty(itemRecord, 'createTime');
						const createdDate =
							typeof createTime === 'number'
								? new Date(createTime * 1000).toISOString().split('T')[0]
								: '';

						// Extract bio and emails for TikTok export
						const bio = getStringOrEmpty(creator, 'bio').replace(/"/g, '""'); // Escape quotes for CSV
						const creatorName = getStringOrEmpty(creator, 'name');
						const creatorFollowers = getNumberOrZero(creator, 'followers');
						const videoUrl = getStringOrEmpty(video, 'url');
						const videoDescription = getStringOrEmpty(video, 'description').replace(/"/g, '""');
						const statsLikes = getNumberOrZero(stats, 'likes');
						const statsComments = getNumberOrZero(stats, 'comments');
						const statsShares = getNumberOrZero(stats, 'shares');
						const statsViews = getNumberOrZero(stats, 'views');

						row = [
							`"${creatorName}"`,
							`"${creatorFollowers}"`,
							`"${bio}"`,
							`"${emailCell}"`,
							`"${videoUrl}"`,
							`"${videoDescription}"`,
							`"${statsLikes}"`,
							`"${statsComments}"`,
							`"${statsShares}"`,
							`"${statsViews}"`,
							`"${hashtags.join(';')}"`,
							`"${createdDate}"`,
							`"${keywordsStr}"`,
							`"${itemPlatform}"`,
						];
					}

					csvContent += row.join(',') + '\n';
				});

				structuredConsole.log(`CSV Export: Generated CSV with ${platform} structure`);
			} else if (getStringProperty(firstCreator, 'profile')) {
				// Old TikTok format
				csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
				dedupedCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const profile = getStringOrEmpty(creatorRecord, 'profile');
					const creatorKeywords = getStringArrayProperty(creatorRecord, 'keywords') ?? [];
					const platformName = getStringOrEmpty(creatorRecord, 'platformName');
					const followers = getNumberProperty(creatorRecord, 'followers');
					const region = getStringOrEmpty(creatorRecord, 'region');
					const profileUrl = getStringOrEmpty(creatorRecord, 'profileUrl');
					const creatorCategory = getStringArrayProperty(creatorRecord, 'creatorCategory') ?? [];

					csvContent += `"${profile}","${creatorKeywords.join(';')}","${platformName}","${followers ?? ''}","${region}","${profileUrl}","${creatorCategory.join(';')}"\n`;
				});
				structuredConsole.log('CSV Export: Generated CSV with old TikTok structure');
			} else if (
				getStringProperty(firstCreator, 'username') &&
				(getBooleanProperty(firstCreator, 'is_private') != null ||
					getStringProperty(firstCreator, 'full_name'))
			) {
				// Instagram similar search structure - enhanced with bio and email
				csvContent = 'Username,Full Name,Bio,Email,Private,Verified,Profile URL,Platform\n';
				dedupedCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const emailCell = formatEmailsForCsv(creatorRecord);
					// Extract bio and emails for Instagram export
					const bio = getStringOrEmpty(creatorRecord, 'bio').replace(/"/g, '""'); // Escape quotes for CSV
					const username = getStringOrEmpty(creatorRecord, 'username');
					const fullName = getStringOrEmpty(creatorRecord, 'full_name');
					const isPrivate = getBooleanProperty(creatorRecord, 'is_private');
					const isVerified = getBooleanProperty(creatorRecord, 'is_verified');
					const profileUrl =
						getStringProperty(creatorRecord, 'profileUrl') ||
						(username ? `https://instagram.com/${username}` : '');
					const platform = getStringProperty(creatorRecord, 'platform') ?? 'Instagram';

					const isPrivateLabel = isPrivate == null ? '' : isPrivate ? 'Yes' : 'No';
					const isVerifiedLabel = isVerified == null ? '' : isVerified ? 'Yes' : 'No';

					csvContent += `"${username}","${fullName}","${bio}","${emailCell}","${isPrivateLabel}","${isVerifiedLabel}","${profileUrl}","${platform}"\n`;
				});
				structuredConsole.log(
					'CSV Export: Generated CSV with enhanced Instagram structure (bio/email included)'
				);
			} else {
				// Fallback for unknown structure - just try to extract common fields
				const fields = Object.keys(firstCreator);
				csvContent = fields.join(',') + '\n';

				dedupedCreators.forEach((creator) => {
					const creatorRecord = getRecordOrEmpty(creator);
					const values = fields.map((field) => {
						const value = creatorRecord[field];
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
