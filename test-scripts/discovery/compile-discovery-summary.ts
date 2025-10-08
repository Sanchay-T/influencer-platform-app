import fs from 'node:fs';
import path from 'node:path';

interface SummaryRecord {
  name: string;
  platform: string;
  filters: Array<{ path: string; value: unknown }>;
  sort: Record<string, unknown>;
  paging: Record<string, unknown>;
  total: number | null;
  returned: number;
  creditsLeft: string | number | null;
  sampleAccounts: Array<{ username?: unknown; followers?: unknown; engagement_percent?: unknown }>;
  followerStats?: { min: number; max: number };
  engagementStats?: { min: number; max: number };
}

function findLatestRun(root: string): string {
  const runs = fs.readdirSync(root).filter((item) => {
    const fullPath = path.join(root, item);
    return fs.statSync(fullPath).isDirectory();
  }).sort();
  if (runs.length === 0) throw new Error('No discovery-api runs found.');
  return path.join(root, runs[runs.length - 1]);
}

function flatFilters(filters: Record<string, unknown>, prefix = 'filters'): Array<{ path: string; value: unknown }> {
  const entries: Array<{ path: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'ai_search') continue;
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const fullPath = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flatFilters(value as Record<string, unknown>, fullPath));
    } else {
      entries.push({ path: fullPath, value });
    }
  }
  return entries;
}

function computeStats(accounts: Array<{ profile?: Record<string, unknown> }>): { followerStats?: { min: number; max: number }; engagementStats?: { min: number; max: number } } {
  const followerValues: number[] = [];
  const engagementValues: number[] = [];
  for (const account of accounts) {
    const profile = account.profile ?? {};
    if (typeof profile.followers === 'number') followerValues.push(profile.followers);
    if (typeof profile.engagement_percent === 'number') engagementValues.push(profile.engagement_percent);
  }
  const stats: { followerStats?: { min: number; max: number }; engagementStats?: { min: number; max: number } } = {};
  if (followerValues.length > 0) {
    stats.followerStats = { min: Math.min(...followerValues), max: Math.max(...followerValues) };
  }
  if (engagementValues.length > 0) {
    stats.engagementStats = { min: Math.min(...engagementValues), max: Math.max(...engagementValues) };
  }
  return stats;
}

function summarizeRun(runDir: string): SummaryRecord[] {
  const scenarios = fs.readdirSync(runDir).filter((item) => fs.statSync(path.join(runDir, item)).isDirectory());
  const summaries: SummaryRecord[] = [];

  for (const scenario of scenarios) {
    const scenarioPath = path.join(runDir, scenario);
    const requestPath = path.join(scenarioPath, 'request.json');
    const responsePath = path.join(scenarioPath, 'response.json');
    if (!fs.existsSync(requestPath) || !fs.existsSync(responsePath)) continue;

    const request = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as { platform: string; filters: Record<string, unknown>; sort: Record<string, unknown>; paging: Record<string, unknown> };
    const response = JSON.parse(fs.readFileSync(responsePath, 'utf8')) as { total: number | null; limit: number | null; credits_left?: string | number | null; accounts?: Array<{ profile?: Record<string, unknown> }> };

    const filters = flatFilters(request.filters ?? {});
    const sampleAccounts = (response.accounts ?? []).slice(0, 3).map((account) => ({
      username: account.profile?.username,
      followers: account.profile?.followers,
      engagement_percent: account.profile?.engagement_percent,
    }));
    const stats = computeStats(response.accounts ?? []);

    summaries.push({
      name: scenario,
      platform: request.platform,
      filters,
      sort: request.sort ?? {},
      paging: request.paging ?? {},
      total: response.total ?? null,
      returned: (response.accounts ?? []).length,
      creditsLeft: response.credits_left ?? null,
      sampleAccounts,
      ...stats,
    });
  }

  return summaries;
}

function writeOutputs(runDir: string, summaries: SummaryRecord[]): void {
  const summaryPath = path.join(runDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summaries, null, 2));

  const markdownLines: string[] = [];
  markdownLines.push('# Discovery API Scenario Summary');
  markdownLines.push(`Run directory: ${runDir}`);
  markdownLines.push('');
  markdownLines.push('| Scenario | Platform | Key Filters | Total | Returned | Follower Range | Engagement Range |');
  markdownLines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const summary of summaries.sort((a, b) => a.name.localeCompare(b.name))) {
    const filterText = summary.filters.map((f) => `${f.path.replace('filters.', '')}=${Array.isArray(f.value) ? f.value.join(',') : JSON.stringify(f.value)}`).join('<br />');
    const followerRange = summary.followerStats ? `${summary.followerStats.min} - ${summary.followerStats.max}` : 'n/a';
    const engagementRange = summary.engagementStats ? `${summary.engagementStats.min} - ${summary.engagementStats.max}` : 'n/a';
    markdownLines.push(`| ${summary.name} | ${summary.platform} | ${filterText || 'base'} | ${summary.total ?? 'n/a'} | ${summary.returned} | ${followerRange} | ${engagementRange} |`);
  }
  fs.writeFileSync(path.join(runDir, 'summary.md'), markdownLines.join('\n'));
}

const root = path.join(process.cwd(), 'logs', 'discovery-api');
const runDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : findLatestRun(root);
const summaries = summarizeRun(runDir);
writeOutputs(runDir, summaries);
console.log(`Wrote summary for ${summaries.length} scenarios -> ${runDir}`);
