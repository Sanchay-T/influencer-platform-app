#!/usr/bin/env tsx
/**
 * 📊 Founder Usage Report Generator
 *
 * Generates a comprehensive Excel report with:
 * 1. Executive Summary - Key metrics and counts
 * 2. User Overview - All users with their current status
 * 3. Campaign Analytics - Search activity breakdown
 * 4. Creator Lists - Saved lists and engagement
 * 5. Platform Usage - TikTok/Instagram/YouTube breakdown
 * 6. Trial Conversion - Trial funnel metrics
 * 7. Raw Data - Complete data export
 */

import postgres from 'postgres';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Production database connection (read-only operations)
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.akjntwwpuhcnfoxesfus:49Wux6f00oTp4qQc@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

const sql = postgres(DATABASE_URL, {
  max: 1, // Single connection for read-only report
  idle_timeout: 20,
  connect_timeout: 30,
});

interface ReportData {
  executiveSummary: ExecutiveSummary;
  users: UserData[];
  campaigns: CampaignData[];
  jobs: JobData[];
  lists: ListData[];
  platformBreakdown: PlatformBreakdown;
  trialFunnel: TrialFunnel;
}

interface ExecutiveSummary {
  reportDate: string;
  totalUsers: number;
  activeUsers: number;
  totalCampaigns: number;
  completedCampaigns: number;
  totalSearchJobs: number;
  successfulJobs: number;
  totalCreatorsFound: number;
  totalLists: number;
  totalListItems: number;
  trialConversionRate: string;
  platformUsage: Record<string, number>;
  avgCampaignsPerUser: string;
  avgCreatorsPerCampaign: string;
}

interface UserData {
  userId: string;
  email: string | null;
  fullName: string | null;
  businessName: string | null;
  currentPlan: string;
  trialStatus: string;
  subscriptionStatus: string;
  onboardingStep: string;
  signupDate: string;
  trialStartDate: string | null;
  trialEndDate: string | null;
  campaignCount: number;
  creatorCount: number;
  listCount: number;
  lastActivity: string | null;
}

interface CampaignData {
  campaignId: string;
  userId: string;
  campaignName: string;
  searchType: string;
  status: string;
  jobCount: number;
  completedJobs: number;
  totalCreators: number;
  createdAt: string;
  updatedAt: string;
}

interface JobData {
  jobId: string;
  campaignId: string;
  platform: string;
  status: string;
  searchType: string;
  keywords: string;
  targetUsername: string | null;
  processedResults: number;
  targetResults: number;
  progress: string;
  createdAt: string;
  completedAt: string | null;
  duration: string | null;
}

interface ListData {
  listId: string;
  ownerId: string;
  listName: string;
  listType: string;
  itemCount: number;
  collaboratorCount: number;
  exportCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PlatformBreakdown {
  tiktok: PlatformStats;
  instagram: PlatformStats;
  youtube: PlatformStats;
}

interface PlatformStats {
  totalJobs: number;
  completedJobs: number;
  totalCreators: number;
  avgCreatorsPerJob: string;
  successRate: string;
}

interface TrialFunnel {
  totalSignups: number;
  trialsStarted: number;
  activeTrials: number;
  expiredTrials: number;
  converted: number;
  trialStartRate: string;
  conversionRate: string;
  avgDaysToConversion: string | null;
}

async function generateFounderReport(): Promise<void> {
  console.log('📊 Generating Founder Usage Report...\n');

  try {
    const reportData: ReportData = {
      executiveSummary: await getExecutiveSummary(),
      users: await getUserData(),
      campaigns: await getCampaignData(),
      jobs: await getJobData(),
      lists: await getListData(),
      platformBreakdown: await getPlatformBreakdown(),
      trialFunnel: await getTrialFunnel(),
    };

    // Generate CSV files (Excel can open these)
    await generateCSVReports(reportData);

    console.log('\n✅ Report generation complete!');
    console.log('\n📁 Files generated:');
    console.log('   - founder-report-executive-summary.csv');
    console.log('   - founder-report-users.csv');
    console.log('   - founder-report-campaigns.csv');
    console.log('   - founder-report-jobs.csv');
    console.log('   - founder-report-lists.csv');
    console.log('   - founder-report-platform-breakdown.csv');
    console.log('   - founder-report-trial-funnel.csv');
    console.log('\n💡 Open these files in Excel/Google Sheets for analysis');

  } catch (error) {
    console.error('❌ Error generating report:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  console.log('📈 Gathering executive summary...');

  // Total users
  const [totalUsersResult] = await sql`
    SELECT COUNT(*)::int as count FROM users
  `;

  // Active users (users with at least one campaign or active trial/subscription)
  const [activeUsersResult] = await sql`
    SELECT COUNT(DISTINCT u.id)::int as count
    FROM users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    LEFT JOIN campaigns c ON u.user_id = c.user_id
    WHERE us.trial_status IN ('active', 'converted')
       OR us.subscription_status IN ('active', 'trialing')
       OR c.id IS NOT NULL
  `;

  // Campaign stats
  const [campaignStats] = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'completed')::int as completed
    FROM campaigns
  `;

  // Job stats
  const [jobStats] = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'completed')::int as successful
    FROM scraping_jobs
  `;

  // Total creators found
  const [creatorsResult] = await sql`
    SELECT
      COALESCE(SUM(processed_results), 0)::int as total
    FROM scraping_jobs
    WHERE status = 'completed'
  `;

  // List stats
  const [listStats] = await sql`
    SELECT
      COUNT(DISTINCT cl.id)::int as total_lists,
      COUNT(cli.id)::int as total_items
    FROM creator_lists cl
    LEFT JOIN creator_list_items cli ON cl.id = cli.list_id
  `;

  // Platform usage
  const platformUsage = await sql`
    SELECT
      platform,
      COUNT(*)::int as count
    FROM scraping_jobs
    GROUP BY platform
  `;

  // Trial conversion
  const [trialStats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE trial_status != 'pending')::int as started,
      COUNT(*) FILTER (WHERE trial_status = 'converted')::int as converted
    FROM user_subscriptions
  `;

  const conversionRate = trialStats.started > 0
    ? ((trialStats.converted / trialStats.started) * 100).toFixed(1)
    : '0.0';

  const avgCampaignsPerUser = totalUsersResult.count > 0
    ? (campaignStats.total / totalUsersResult.count).toFixed(1)
    : '0.0';

  const avgCreatorsPerCampaign = campaignStats.completed > 0
    ? (creatorsResult.total / campaignStats.completed).toFixed(0)
    : '0';

  // Format platform usage as string for CSV
  const platformUsageStr = platformUsage
    .map(p => `${p.platform}: ${p.count}`)
    .join('; ');

  return {
    reportDate: new Date().toISOString(),
    totalUsers: totalUsersResult.count,
    activeUsers: activeUsersResult.count,
    totalCampaigns: campaignStats.total,
    completedCampaigns: campaignStats.completed,
    totalSearchJobs: jobStats.total,
    successfulJobs: jobStats.successful,
    totalCreatorsFound: creatorsResult.total,
    totalLists: listStats.total_lists,
    totalListItems: listStats.total_items,
    trialConversionRate: `${conversionRate}%`,
    platformUsage: platformUsageStr,
    avgCampaignsPerUser,
    avgCreatorsPerCampaign,
  };
}

async function getUserData(): Promise<UserData[]> {
  console.log('👥 Gathering user data...');

  const users = await sql`
    SELECT
      u.user_id,
      u.email,
      u.full_name,
      u.business_name,
      COALESCE(us.current_plan, 'free') as current_plan,
      COALESCE(us.trial_status, 'pending') as trial_status,
      COALESCE(us.subscription_status, 'none') as subscription_status,
      u.onboarding_step,
      usd.signup_timestamp,
      us.trial_start_date,
      us.trial_end_date,
      (SELECT COUNT(*)::int FROM campaigns WHERE user_id = u.user_id) as campaign_count,
      (SELECT COALESCE(SUM(processed_results), 0)::int FROM scraping_jobs WHERE user_id = u.user_id) as creator_count,
      (SELECT COUNT(*)::int FROM creator_lists WHERE owner_id = u.id) as list_count,
      (SELECT MAX(updated_at) FROM campaigns WHERE user_id = u.user_id) as last_activity
    FROM users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    LEFT JOIN user_system_data usd ON u.id = usd.user_id
    ORDER BY usd.signup_timestamp DESC NULLS LAST
  `;

  return users.map(u => ({
    userId: u.user_id,
    email: u.email,
    fullName: u.full_name,
    businessName: u.business_name,
    currentPlan: u.current_plan,
    trialStatus: u.trial_status,
    subscriptionStatus: u.subscription_status,
    onboardingStep: u.onboarding_step,
    signupDate: u.signup_timestamp ? new Date(u.signup_timestamp).toISOString().split('T')[0] : 'N/A',
    trialStartDate: u.trial_start_date ? new Date(u.trial_start_date).toISOString().split('T')[0] : null,
    trialEndDate: u.trial_end_date ? new Date(u.trial_end_date).toISOString().split('T')[0] : null,
    campaignCount: u.campaign_count,
    creatorCount: u.creator_count,
    listCount: u.list_count,
    lastActivity: u.last_activity ? new Date(u.last_activity).toISOString().split('T')[0] : null,
  }));
}

async function getCampaignData(): Promise<CampaignData[]> {
  console.log('🎯 Gathering campaign data...');

  const campaigns = await sql`
    SELECT
      c.id,
      c.user_id,
      c.name,
      c.search_type,
      c.status,
      (SELECT COUNT(*)::int FROM scraping_jobs WHERE campaign_id = c.id) as job_count,
      (SELECT COUNT(*)::int FROM scraping_jobs WHERE campaign_id = c.id AND status = 'completed') as completed_jobs,
      (SELECT COALESCE(SUM(processed_results), 0)::int FROM scraping_jobs WHERE campaign_id = c.id) as total_creators,
      c.created_at,
      c.updated_at
    FROM campaigns c
    ORDER BY c.created_at DESC
  `;

  return campaigns.map(c => ({
    campaignId: c.id,
    userId: c.user_id,
    campaignName: c.name,
    searchType: c.search_type,
    status: c.status,
    jobCount: c.job_count,
    completedJobs: c.completed_jobs,
    totalCreators: c.total_creators,
    createdAt: new Date(c.created_at).toISOString().split('T')[0],
    updatedAt: new Date(c.updated_at).toISOString().split('T')[0],
  }));
}

async function getJobData(): Promise<JobData[]> {
  console.log('⚙️ Gathering job data...');

  const jobs = await sql`
    SELECT
      id,
      campaign_id,
      platform,
      status,
      CASE
        WHEN target_username IS NOT NULL THEN 'similar'
        ELSE 'keyword'
      END as search_type,
      COALESCE(keywords::text, '[]') as keywords,
      target_username,
      processed_results,
      target_results,
      progress,
      created_at,
      completed_at,
      CASE
        WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (completed_at - started_at))::int
        ELSE NULL
      END as duration_seconds
    FROM scraping_jobs
    ORDER BY created_at DESC
  `;

  return jobs.map(j => ({
    jobId: j.id,
    campaignId: j.campaign_id,
    platform: j.platform,
    status: j.status,
    searchType: j.search_type,
    keywords: j.keywords,
    targetUsername: j.target_username,
    processedResults: j.processed_results,
    targetResults: j.target_results,
    progress: `${j.progress}%`,
    createdAt: new Date(j.created_at).toISOString(),
    completedAt: j.completed_at ? new Date(j.completed_at).toISOString() : null,
    duration: j.duration_seconds ? `${Math.floor(j.duration_seconds / 60)}m ${j.duration_seconds % 60}s` : null,
  }));
}

async function getListData(): Promise<ListData[]> {
  console.log('📝 Gathering list data...');

  const lists = await sql`
    SELECT
      cl.id,
      u.user_id as owner_id,
      cl.name,
      cl.type,
      (SELECT COUNT(*)::int FROM creator_list_items WHERE list_id = cl.id) as item_count,
      (SELECT COUNT(*)::int FROM creator_list_collaborators WHERE list_id = cl.id) as collaborator_count,
      (SELECT COUNT(*)::int FROM list_exports WHERE list_id = cl.id) as export_count,
      cl.created_at,
      cl.updated_at
    FROM creator_lists cl
    JOIN users u ON cl.owner_id = u.id
    ORDER BY cl.created_at DESC
  `;

  return lists.map(l => ({
    listId: l.id,
    ownerId: l.owner_id,
    listName: l.name,
    listType: l.type,
    itemCount: l.item_count,
    collaboratorCount: l.collaborator_count,
    exportCount: l.export_count,
    createdAt: new Date(l.created_at).toISOString().split('T')[0],
    updatedAt: new Date(l.updated_at).toISOString().split('T')[0],
  }));
}

async function getPlatformBreakdown(): Promise<PlatformBreakdown> {
  console.log('📊 Calculating platform breakdown...');

  const platforms = ['TikTok', 'Instagram', 'YouTube'];
  const breakdown: any = {};

  for (const platform of platforms) {
    const [stats] = await sql`
      SELECT
        COUNT(*)::int as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed_jobs,
        COALESCE(SUM(processed_results), 0)::int as total_creators
      FROM scraping_jobs
      WHERE platform = ${platform}
    `;

    const avgCreators = stats.completed_jobs > 0
      ? (stats.total_creators / stats.completed_jobs).toFixed(0)
      : '0';

    const successRate = stats.total_jobs > 0
      ? ((stats.completed_jobs / stats.total_jobs) * 100).toFixed(1)
      : '0.0';

    breakdown[platform.toLowerCase()] = {
      totalJobs: stats.total_jobs,
      completedJobs: stats.completed_jobs,
      totalCreators: stats.total_creators,
      avgCreatorsPerJob: avgCreators,
      successRate: `${successRate}%`,
    };
  }

  return breakdown as PlatformBreakdown;
}

async function getTrialFunnel(): Promise<TrialFunnel> {
  console.log('🔄 Calculating trial funnel...');

  const [funnelStats] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) as total_signups,
      COUNT(*) FILTER (WHERE trial_status != 'pending')::int as trials_started,
      COUNT(*) FILTER (WHERE trial_status = 'active')::int as active_trials,
      COUNT(*) FILTER (WHERE trial_status = 'expired')::int as expired_trials,
      COUNT(*) FILTER (WHERE trial_status = 'converted')::int as converted,
      AVG(EXTRACT(EPOCH FROM (trial_conversion_date - trial_start_date)) / 86400) FILTER (
        WHERE trial_conversion_date IS NOT NULL AND trial_start_date IS NOT NULL
      ) as avg_days_to_conversion
    FROM user_subscriptions
  `;

  const trialStartRate = funnelStats.total_signups > 0
    ? ((funnelStats.trials_started / funnelStats.total_signups) * 100).toFixed(1)
    : '0.0';

  const conversionRate = funnelStats.trials_started > 0
    ? ((funnelStats.converted / funnelStats.trials_started) * 100).toFixed(1)
    : '0.0';

  const avgDays = funnelStats.avg_days_to_conversion && typeof funnelStats.avg_days_to_conversion === 'number'
    ? Number(funnelStats.avg_days_to_conversion).toFixed(1)
    : null;

  return {
    totalSignups: funnelStats.total_signups,
    trialsStarted: funnelStats.trials_started,
    activeTrials: funnelStats.active_trials,
    expiredTrials: funnelStats.expired_trials,
    converted: funnelStats.converted,
    trialStartRate: `${trialStartRate}%`,
    conversionRate: `${conversionRate}%`,
    avgDaysToConversion: avgDays ? `${avgDays} days` : null,
  };
}

function toCSV(data: any[], headers: string[]): string {
  const rows = [headers.join(',')];

  for (const item of data) {
    const row = headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape commas and quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

async function generateCSVReports(data: ReportData): Promise<void> {
  console.log('\n📄 Generating CSV files...');

  const outputDir = process.cwd();

  // Executive Summary
  const summaryHeaders = Object.keys(data.executiveSummary);
  const summaryCSV = toCSV([data.executiveSummary], summaryHeaders);
  writeFileSync(join(outputDir, 'founder-report-executive-summary.csv'), summaryCSV);
  console.log('   ✓ Executive summary');

  // Users
  if (data.users.length > 0) {
    const userHeaders = Object.keys(data.users[0]);
    const usersCSV = toCSV(data.users, userHeaders);
    writeFileSync(join(outputDir, 'founder-report-users.csv'), usersCSV);
    console.log('   ✓ Users data');
  }

  // Campaigns
  if (data.campaigns.length > 0) {
    const campaignHeaders = Object.keys(data.campaigns[0]);
    const campaignsCSV = toCSV(data.campaigns, campaignHeaders);
    writeFileSync(join(outputDir, 'founder-report-campaigns.csv'), campaignsCSV);
    console.log('   ✓ Campaigns data');
  }

  // Jobs
  if (data.jobs.length > 0) {
    const jobHeaders = Object.keys(data.jobs[0]);
    const jobsCSV = toCSV(data.jobs, jobHeaders);
    writeFileSync(join(outputDir, 'founder-report-jobs.csv'), jobsCSV);
    console.log('   ✓ Jobs data');
  }

  // Lists
  if (data.lists.length > 0) {
    const listHeaders = Object.keys(data.lists[0]);
    const listsCSV = toCSV(data.lists, listHeaders);
    writeFileSync(join(outputDir, 'founder-report-lists.csv'), listsCSV);
    console.log('   ✓ Lists data');
  }

  // Platform Breakdown
  const platformData = [
    { platform: 'TikTok', ...data.platformBreakdown.tiktok },
    { platform: 'Instagram', ...data.platformBreakdown.instagram },
    { platform: 'YouTube', ...data.platformBreakdown.youtube },
  ];
  const platformHeaders = Object.keys(platformData[0]);
  const platformCSV = toCSV(platformData, platformHeaders);
  writeFileSync(join(outputDir, 'founder-report-platform-breakdown.csv'), platformCSV);
  console.log('   ✓ Platform breakdown');

  // Trial Funnel
  const funnelHeaders = Object.keys(data.trialFunnel);
  const funnelCSV = toCSV([data.trialFunnel], funnelHeaders);
  writeFileSync(join(outputDir, 'founder-report-trial-funnel.csv'), funnelCSV);
  console.log('   ✓ Trial funnel');
}

// Run the report
generateFounderReport().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
