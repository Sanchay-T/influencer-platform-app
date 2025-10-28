import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';

import { runInstagramUsReelsPipeline } from '@/lib/instagram-us-reels';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const keyword = String(body?.keyword ?? '').trim();

    if (!keyword) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const options = {
      transcripts: body?.transcripts !== false,
      maxProfiles: Number(body?.maxProfiles ?? undefined),
      reelsPerProfile: Number(body?.reelsPerProfile ?? undefined),
      serpEnabled: body?.serpEnabled !== false,
    } as const;

    const results = await runInstagramUsReelsPipeline({ keyword }, options);
    return NextResponse.json({ keyword, results });
  } catch (error: any) {
    structuredConsole.error('[instagram-us-reels] pipeline failed', error);
    return NextResponse.json(
      {
        error: 'Pipeline error',
        message: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
