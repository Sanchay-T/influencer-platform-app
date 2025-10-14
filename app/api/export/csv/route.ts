import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingResults, scrapingJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { FeatureGateService } from '@/lib/services/feature-gates';
import { dedupeCreators, formatEmailsForCsv } from '@/lib/export/csv-utils';

export async function GET(req: Request) {
  try {
    console.log('CSV Export: Starting export process');
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const campaignId = searchParams.get('campaignId');

    if (!jobId && !campaignId) {
      console.log('CSV Export: Job ID or campaign ID is missing');
      return NextResponse.json({ error: 'Job ID or campaign ID is required' }, { status: 400 });
    }

    console.log(`CSV Export: Processing job ID ${jobId} and campaign ID ${campaignId}`);

    // Verify authentication
    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      console.log('CSV Export: Authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('CSV Export: Authentication successful', { userId });

    // Feature gate: ensure CSV export is allowed for this plan
    const gate = await FeatureGateService.assertExportFormat(userId, 'CSV');
    if (!gate.allowed) {
      console.log('CSV Export: blocked by feature gate', gate);
      return NextResponse.json({
        error: 'CSV export not available on your plan',
        upgrade: true,
        currentPlan: gate.currentPlan,
        reason: gate.reason
      }, { status: 403 });
    }

    // Si se recibe campaignId, exportar todos los creadores de todos los jobs de la campaña
    if (campaignId) {
      console.log(`CSV Export: Processing campaign ID ${campaignId}`);
      // Buscar todos los jobs completados de la campaña
      const jobs = await db.query.scrapingJobs.findMany({
        where: (jobs, { eq }) => eq(jobs.campaignId, String(campaignId)),
        with: {
          results: true
        }
      });
      console.log('Jobs found:', jobs.length);
      let allCreators: any[] = [];
      let keywords: string[] = [];
      jobs.forEach((job, i) => {
        if (Array.isArray(job.keywords)) {
          keywords = keywords.concat(job.keywords);
        }
        console.log(`Job ${i} (${job.id}) has ${Array.isArray(job.results) ? job.results.length : 0} results`);
        if (Array.isArray(job.results)) {
          job.results.forEach((result, j) => {
            const creatorsData = result.creators;
            let count = 0;
            let structure = '';
            if (Array.isArray(creatorsData)) {
              count = creatorsData.length;
              structure = 'array';
              allCreators = allCreators.concat(creatorsData);
            } else if (creatorsData && typeof creatorsData === 'object' && !Array.isArray(creatorsData)) {
              if ('results' in creatorsData && Array.isArray((creatorsData as any).results)) {
                structure = 'object.results[]';
                const nested = (creatorsData as any).results.reduce((acc: any[], r: any) => {
                  if (r.creators && Array.isArray(r.creators)) {
                    return [...acc, ...r.creators];
                  }
                  return acc;
                }, []);
                count = nested.length;
                allCreators = allCreators.concat(nested);
              } else {
                structure = 'object.keys[]';
                Object.keys(creatorsData).forEach(key => {
                  if (Array.isArray((creatorsData as any)[key])) {
                    count += (creatorsData as any)[key].length;
                    allCreators = allCreators.concat((creatorsData as any)[key]);
                  }
                });
              }
            }
            console.log(`  Result ${j} has ${count} creators (structure: ${structure})`);
            if (count > 0) {
              let example = null;
              if (Array.isArray(creatorsData) && creatorsData.length > 0) example = creatorsData[0];
              else if (
                structure === 'object.results[]' &&
                creatorsData &&
                typeof creatorsData === 'object' &&
                !Array.isArray(creatorsData) &&
                'results' in creatorsData &&
                Array.isArray((creatorsData as any).results) &&
                (creatorsData as any).results.length > 0
              ) {
                const first = (creatorsData as any).results[0];
                if (first.creators && Array.isArray(first.creators) && first.creators.length > 0) example = first.creators[0];
              }
              if (example) {
                console.log(`    Example creator:`, JSON.stringify(example, null, 2));
              }
            }
          });
        }
      });
      keywords = Array.from(new Set(keywords)); // Unificar keywords
      console.log('Total creators found in campaign:', allCreators.length);
      const dedupedCampaignCreators = dedupeCreators(allCreators);
      console.log('CSV Export: Deduped campaign creators', {
        before: allCreators.length,
        after: dedupedCampaignCreators.length
      });

      if (dedupedCampaignCreators.length === 0) {
        return NextResponse.json({ error: 'No creators found in campaign' }, { status: 404 });
      }
      // Generar CSV igual que antes, usando allCreators y keywords
      let csvContent = '';
      const firstCreator = dedupedCampaignCreators[0];
      if (firstCreator.creator && firstCreator.video) {
        // Detect platform mix for campaign export
        const platforms = [...new Set(dedupedCampaignCreators.map(item => item.platform || 'Unknown'))];
        console.log('CSV Export (Campaign): Detected platforms:', platforms);
        
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
          'Email'
        ];
        
        csvContent = headers.join(',') + '\n';
        
        dedupedCampaignCreators.forEach(item => {
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
            `"${emailCell}"`
          ];
          csvContent += row.join(',') + '\n';
        });
      } else if ('profile' in firstCreator) {
        csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
        dedupedCampaignCreators.forEach(creator => {
          csvContent += `"${creator.profile || ''}","${(creator.keywords || []).join(';')}","${creator.platformName || ''}","${creator.followers || ''}","${creator.region || ''}","${creator.profileUrl || ''}","${(creator.creatorCategory || []).join(';')}"\n`;
        });
      } else if ('username' in firstCreator && ('is_private' in firstCreator || 'full_name' in firstCreator)) {
        csvContent = 'Username,Full Name,Email,Private,Verified,Profile URL\n';
        dedupedCampaignCreators.forEach(creator => {
          const emailCell = formatEmailsForCsv(creator);
          csvContent += `"${creator.username || ''}","${creator.full_name || ''}","${emailCell}","${creator.is_private || ''}","${creator.is_verified || ''}","${creator.profile_pic_url || ''}"\n`;
        });
      } else {
        const fields = Object.keys(firstCreator);
        csvContent = fields.join(',') + '\n';
        dedupedCampaignCreators.forEach(creator => {
          const values = fields.map(field => {
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
      headers.set('Content-Disposition', `attachment; filename=creators-campaign-${campaignId}-${new Date().toISOString().split('T')[0]}.csv`);
      return new NextResponse(csvContent, {
        headers,
        status: 200,
      });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    const result = await db.query.scrapingResults.findFirst({
      where: eq(scrapingResults.jobId, String(jobId))
    });

    if (!result) {
      console.log('CSV Export: No results found in database');
      return NextResponse.json({ error: 'Results not found' }, { status: 404 });
    }

    console.log('CSV Export: Found results in database');

    // Get job data to include keywords in export
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });

    console.log('CSV Export: Job data retrieved', { 
      hasKeywords: Boolean(job?.keywords),
      keywordsLength: Array.isArray(job?.keywords) ? job.keywords.length : 0 
    });

    // Extract keywords for the CSV
    const keywords = job?.keywords as string[] || [];

    try {
      // Get creators directly from result.creators to avoid additional API call
      // This is more reliable than making another API call
      let creators: any[] = [];
      const creatorsData = result.creators as any;
      
      if (Array.isArray(creatorsData)) {
        console.log('CSV Export: Using creators array directly from database');
        creators = creatorsData;
      } else if (creatorsData && typeof creatorsData === 'object') {
        // Handle possible nested structure
        if (creatorsData.results && Array.isArray(creatorsData.results)) {
          console.log('CSV Export: Extracting creators from nested results structure');
          creators = creatorsData.results.reduce((acc: any[], r: any) => {
            if (r.creators && Array.isArray(r.creators)) {
              return [...acc, ...r.creators];
            }
            return acc;
          }, []);
        }
      }
      
      if (creators.length === 0) {
        console.log('CSV Export: No creators found in database, attempting to parse creators from structure:', 
          JSON.stringify(creatorsData).substring(0, 200) + '...');
          
        // Last attempt - try to extract creators
        if (typeof creatorsData === 'object' && creatorsData !== null) {
          Object.keys(creatorsData).forEach(key => {
            if (Array.isArray(creatorsData[key])) {
              creators = creatorsData[key];
              console.log(`CSV Export: Found potential creators array under key '${key}'`);
            }
          });
        }
      }

      console.log(`CSV Export: Found ${creators.length} creators`);

      const dedupedCreators = dedupeCreators(creators, {
        platformHint: job?.platform ?? null
      });

      console.log('CSV Export: Deduped creators for job export', {
        before: creators.length,
        after: dedupedCreators.length
      });

      if (dedupedCreators.length === 0) {
        return NextResponse.json({ error: 'No creators found in data structure' }, { status: 404 });
      }

      // Generate CSV content
      let csvContent = '';
      const firstCreator = dedupedCreators[0];
      
      console.log('CSV Export: First creator structure sample', 
        JSON.stringify(firstCreator).substring(0, 200) + '...');

      // Detect the structure from the creators array
      if (firstCreator.username && (firstCreator.is_verified !== undefined || firstCreator.full_name)) {
        // This is similar search format (Instagram or TikTok similar)
        console.log('CSV Export: Detected similar search format');

        const platform = firstCreator.platform || 'Unknown';
        const headers = [
          'Username',
          'Full Name',
          'Followers',
          'Email',
          'Verified',
          'Private',
          'Platform',
          'Profile URL'
        ];
        
        csvContent = headers.join(',') + '\n';

        dedupedCreators.forEach(creator => {
          const emailCell = formatEmailsForCsv(creator);
          const profileUrl = creator.platform === 'TikTok'
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
            `"${profileUrl}"`
          ];
          
          csvContent += row.join(',') + '\n';
        });
      } else if (firstCreator.creator && firstCreator.video) {
        // Detect platform type to determine appropriate columns
        const platform = firstCreator.platform || 'Unknown';
        console.log('CSV Export: Detected platform:', platform);
        
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
            'Platform'
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
            'Platform'
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
            'Platform'
          ];
        }
        
        csvContent = headers.join(',') + '\n';
        
        dedupedCreators.forEach(item => {
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
              `"${itemPlatform}"`
            ];
          } else if (itemPlatform === 'YouTube') {
            // YouTube Keyword Search - video-based data
            // Extract bio and emails for YouTube export
            const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
            const socialLinks = Array.isArray(creator.socialLinks) ? creator.socialLinks.join('; ') : '';

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
              `"${itemPlatform}"`
            ];
          } else {
            // TikTok/other platforms data extraction
            const createdDate = item.createTime ?
              new Date(item.createTime * 1000).toISOString().split('T')[0] : '';

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
              `"${itemPlatform}"`
            ];
          }
          
          csvContent += row.join(',') + '\n';
        });

        console.log(`CSV Export: Generated CSV with ${platform} structure`);
      } else if ('profile' in firstCreator) {
        // Old TikTok format
        csvContent = 'Profile,Keywords,Platform,Followers,Region,Profile URL,Creator Categories\n';
        dedupedCreators.forEach(creator => {
          csvContent += `"${creator.profile || ''}","${(creator.keywords || []).join(';')}","${creator.platformName || ''}","${creator.followers || ''}","${creator.region || ''}","${creator.profileUrl || ''}","${(creator.creatorCategory || []).join(';')}"\n`;
        });
        console.log('CSV Export: Generated CSV with old TikTok structure');
      } else if ('username' in firstCreator && ('is_private' in firstCreator || 'full_name' in firstCreator)) {
        // Instagram similar search structure - enhanced with bio and email
        csvContent = 'Username,Full Name,Bio,Email,Private,Verified,Profile URL,Platform\n';
        dedupedCreators.forEach(creator => {
          const emailCell = formatEmailsForCsv(creator);
          // Extract bio and emails for Instagram export
          const bio = (creator.bio || '').replace(/"/g, '""'); // Escape quotes for CSV
          const profileUrl = creator.profileUrl || `https://instagram.com/${creator.username}`;
          const platform = creator.platform || 'Instagram';

          csvContent += `"${creator.username || ''}","${creator.full_name || ''}","${bio}","${emailCell}","${creator.is_private ? 'Yes' : 'No'}","${creator.is_verified ? 'Yes' : 'No'}","${profileUrl}","${platform}"\n`;
        });
        console.log('CSV Export: Generated CSV with enhanced Instagram structure (bio/email included)');
      } else {
        // Fallback for unknown structure - just try to extract common fields
        const fields = Object.keys(firstCreator);
        csvContent = fields.join(',') + '\n';

        dedupedCreators.forEach(creator => {
          const values = fields.map(field => {
            const value = creator[field];
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${value || ''}"`;
          });
          csvContent += values.join(',') + '\n';
        });
        console.log('CSV Export: Generated CSV with unknown structure, using fields:', fields);
      }

      // Set headers for CSV download
      const headers = new Headers();
      headers.set('Content-Type', 'text/csv');
      headers.set('Content-Disposition', `attachment; filename=creators-${new Date().toISOString().split('T')[0]}.csv`);

      console.log('CSV Export: Returning CSV file');
      return new NextResponse(csvContent, {
        headers,
        status: 200,
      });
    } catch (parseError) {
      console.error('CSV Export: Error parsing creators data:', parseError);
      return NextResponse.json({ error: 'Error parsing creators data' }, { status: 500 });
    }
  } catch (error) {
    console.error('CSV Export: Error exporting CSV:', error);
    return NextResponse.json({ error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 
