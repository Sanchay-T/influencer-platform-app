/**
 * Helper utilities used by CSV export API routes. The functions here mirror the
 * client-side behaviour (deduping creators and extracting contact emails) so the
 * downloaded files match what users see inside the dashboard.
 */

const EMAIL_KEY_PATTERN = /email/i;
const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/i;

type CreatorRecord = Record<string, unknown>;

type DedupeOptions = {
  platformHint?: string | null;
};

const normalizeValue = (value: unknown): string | null => {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  return null;
};

const pushCandidate = (collector: Set<string>, value: unknown) => {
  const normalized = normalizeValue(value);
  if (!normalized) return;

  collector.add(normalized);
};

const collectFromObject = (source: CreatorRecord | undefined, collector: Set<string>) => {
  if (!source) return;

  const candidateFields = [
    'id',
    '_id',
    'uuid',
    'guid',
    'externalId',
    'external_id',
    'profileId',
    'profile_id',
    'profileID',
    'profileUrl',
    'profile_url',
    'profileLink',
    'profile_link',
    'url',
    'permalink',
    'link',
    'handle',
    'username',
    'userName',
    'uniqueId',
    'unique_id',
    'channelId',
    'channel_id',
    'accountId',
    'account_id',
    'creatorId',
    'creator_id',
    'userId',
    'user_id',
    'platformId',
    'platform_id',
    'videoId',
    'video_id',
    'awemeId',
    'aweme_id',
    'secUid',
    'sec_uid',
    'slug',
    'shortId',
    'short_id',
  ];

  for (const field of candidateFields) {
    pushCandidate(collector, source[field]);
  }

  const arrayFields: Array<keyof CreatorRecord> = ['ids', 'handles', 'urls'];
  for (const field of arrayFields) {
    const values = source[field];
    if (Array.isArray(values)) {
      values.forEach((value) => pushCandidate(collector, value));
    }
  }
};

const collectCandidates = (creator: CreatorRecord): Set<string> => {
  const collector = new Set<string>();

  const possibleSources = [
    creator,
    creator.creator as CreatorRecord | undefined,
    creator.profile as CreatorRecord | undefined,
    creator.account as CreatorRecord | undefined,
    creator.author as CreatorRecord | undefined,
    creator.user as CreatorRecord | undefined,
    creator.owner as CreatorRecord | undefined,
    creator.metadata as CreatorRecord | undefined,
  ];

  possibleSources.forEach((source) => collectFromObject(source, collector));

  const videoSources = [
    creator.video as CreatorRecord | undefined,
    creator.latestVideo as CreatorRecord | undefined,
    creator.latest_video as CreatorRecord | undefined,
    creator.content as CreatorRecord | undefined,
    creator.post as CreatorRecord | undefined,
    creator.latestPost as CreatorRecord | undefined,
    creator.latest_post as CreatorRecord | undefined,
  ];

  videoSources.forEach((video) => {
    collectFromObject(video, collector);
    if (video) {
      pushCandidate(collector, video.url);
      pushCandidate(collector, (video as CreatorRecord).shareUrl);
      pushCandidate(collector, (video as CreatorRecord).share_url);
    }
  });

  pushCandidate(collector, creator.profileUrl);
  pushCandidate(collector, (creator as CreatorRecord).profile_url);
  pushCandidate(collector, (creator as CreatorRecord).profileLink);
  pushCandidate(collector, (creator as CreatorRecord).profile_link);
  pushCandidate(collector, creator.url);

  return collector;
};

export const dedupeCreators = (
  creators: unknown[],
  options: DedupeOptions = {}
): CreatorRecord[] => {
  const { platformHint } = options;
  const uniqueCreators: CreatorRecord[] = [];
  const seen = new Set<string>();

  creators.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;

    const creator = candidate as CreatorRecord;
    const platformValue =
      normalizeValue(creator.platform) || normalizeValue(platformHint) || 'unknown';
    const identifiers = collectCandidates(creator);

    let matched = false;

    identifiers.forEach((value) => {
      if (matched) return;
      const key = `${platformValue}|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCreators.push(creator);
        matched = true;
      }
    });

    if (matched) return;

    const fallbackKey = `${platformValue}|${JSON.stringify(creator)}`;
    if (!seen.has(fallbackKey)) {
      seen.add(fallbackKey);
      uniqueCreators.push(creator);
    }
  });

  return uniqueCreators;
};

const normalizeEmail = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (EMAIL_REGEX.test(trimmed)) {
    return trimmed;
  }

  return null;
};

export const extractEmails = (input: unknown): string[] => {
  const collected = new Set<string>();
  const stack: unknown[] = [input];
  const visited = new Set<CreatorRecord>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) continue;

    if (typeof current === 'string') {
      const normalized = normalizeEmail(current);
      if (normalized) {
        collected.add(normalized);
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((value) => stack.push(value));
      continue;
    }

    if (typeof current === 'object') {
      const record = current as CreatorRecord;
      if (visited.has(record)) {
        continue;
      }
      visited.add(record);

      Object.entries(record).forEach(([key, value]) => {
        if (!value) return;

        if (EMAIL_KEY_PATTERN.test(key)) {
          stack.push(value);
        } else if (typeof value === 'string' && EMAIL_REGEX.test(value)) {
          stack.push(value);
        } else if (typeof value === 'object') {
          stack.push(value);
        }
      });
    }
  }

  return Array.from(collected);
};

export const formatEmailsForCsv = (input: unknown): string => {
  const emails = extractEmails(input);
  return emails.join('; ');
};
