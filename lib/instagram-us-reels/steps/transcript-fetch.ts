import type { ReelMedia } from '../types';
import { getInstagramTranscript } from '../clients/scrapecreators';

export interface TranscriptFetchOptions {
  concurrency?: number;
  timeoutMs?: number;
}

let transcriptFetcher = getInstagramTranscript;

export function setTranscriptFetcher(
  fetcher: typeof getInstagramTranscript,
): void {
  transcriptFetcher = fetcher;
}

export async function attachTranscripts(
  reels: ReelMedia[],
  options: TranscriptFetchOptions = {},
): Promise<void> {
  if (reels.length === 0) return;

  const concurrency = Math.max(1, options.concurrency ?? 2);
  const iterator = reels[Symbol.iterator]();

  async function worker() {
    for (;;) {
      const next = iterator.next();
      if (next.done) break;
      const reel = next.value;
      try {
        const transcript = await fetchTranscript(reel.url, options.timeoutMs);
        reel.transcript = transcript;
      } catch (error) {
        console.warn('[transcript-fetch] failed', {
          url: reel.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function fetchTranscript(url: string, timeoutMs?: number): Promise<string | null> {
  const controller = timeoutMs ? new AbortController() : undefined;
  if (controller) {
    setTimeout(() => controller.abort(), timeoutMs);
  }

  const payload = await transcriptFetcher(url, {});
  const transcripts = payload?.transcripts;
  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    return null;
  }
  return transcripts
    .map((entry: any) => entry?.transcript)
    .filter((text: any) => typeof text === 'string' && text.trim().length > 0)
    .join('\n')
    .trim();
}
