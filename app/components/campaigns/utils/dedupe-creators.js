export const dedupeCreators = (creators = [], options = {}) => {
  const { platformHint } = options;
  const uniqueCreators = [];
  const seenKeys = new Set();

  const normalize = (value) => {
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

  const pushCandidate = (candidates, value) => {
    const normalized = normalize(value);
    if (!normalized) return;
    if (!candidates.has(normalized)) {
      candidates.add(normalized);
    }
  };

  const collectFromObject = (target, candidates) => {
    if (!target || typeof target !== 'object') return;
    const fields = [
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

    for (const field of fields) {
      pushCandidate(candidates, target[field]);
    }

    if (Array.isArray(target.ids)) {
      for (const value of target.ids) {
        pushCandidate(candidates, value);
      }
    }

    if (Array.isArray(target.handles)) {
      for (const value of target.handles) {
        pushCandidate(candidates, value);
      }
    }

    if (Array.isArray(target.urls)) {
      for (const value of target.urls) {
        pushCandidate(candidates, value);
      }
    }
  };

  const collectCandidates = (creator) => {
    const candidates = new Set();
    if (!creator || typeof creator !== 'object') {
      return candidates;
    }

    const possibleSources = [
      creator,
      creator.creator,
      creator.profile,
      creator.account,
      creator.author,
      creator.user,
      creator.owner,
      creator.metadata,
    ];

    for (const source of possibleSources) {
      collectFromObject(source, candidates);
    }

    const videoSources = [
      creator.video,
      creator.latestVideo,
      creator.latest_video,
      creator.content,
      creator.post,
      creator.latestPost,
      creator.latest_post,
    ];

    for (const video of videoSources) {
      collectFromObject(video, candidates);
      if (video && typeof video === 'object') {
        pushCandidate(candidates, video.url);
        pushCandidate(candidates, video.shareUrl);
        pushCandidate(candidates, video.share_url);
      }
    }

    pushCandidate(candidates, creator.profileUrl);
    pushCandidate(candidates, creator.profile_url);
    pushCandidate(candidates, creator.profileLink);
    pushCandidate(candidates, creator.profile_link);
    pushCandidate(candidates, creator.url);

    return candidates;
  };

  for (const creator of creators) {
    if (!creator) continue;

    const platformValue = normalize(creator.platform) || normalize(platformHint) || 'unknown';
    const candidates = collectCandidates(creator);
    let matched = false;

    if (candidates.size > 0) {
      for (const candidate of candidates) {
        const composite = `${platformValue}|${candidate}`;
        if (!seenKeys.has(composite)) {
          seenKeys.add(composite);
          uniqueCreators.push(creator);
          matched = true;
          break;
        }
      }
    }

    if (matched) continue;

    const fallbackKey = `${platformValue}|${JSON.stringify(creator)}`;
    if (!seenKeys.has(fallbackKey)) {
      seenKeys.add(fallbackKey);
      uniqueCreators.push(creator);
    }
  }

  return uniqueCreators;
};

export default dedupeCreators;
