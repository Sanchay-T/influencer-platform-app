import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

import { createSession, getSessionMetadata } from '@us-reels-agent/storage/session-manager';
import { appendUrls, updatePostData } from '@us-reels-agent/storage/csv-writer';
import { readSessionCsv } from '@us-reels-agent/storage/csv-reader';

const SAMPLE_URL = 'https://www.instagram.com/reel/TEST123/';

async function run() {
  const session = createSession('Test Keyword');

  appendUrls(session.sessionCsv, [SAMPLE_URL], 'Test Keyword');
  updatePostData(session.sessionCsv, [
    {
      url: SAMPLE_URL,
      caption: 'Sample caption',
      owner_handle: 'creator_handle',
      owner_name: 'Creator Name',
      views: 1000,
      location_name: 'New York',
    },
  ]);

  const rows = readSessionCsv(session.sessionCsv);
  assert.equal(rows.length, 1, 'Expected one reel row in session storage');
  assert.equal(rows[0]?.url, SAMPLE_URL, 'Stored reel row should match appended URL');
  assert.equal(rows[0]?.owner_handle, 'creator_handle', 'Reel row should include post metadata');

  const metadata = getSessionMetadata(session.metadataPath);
  assert.equal(metadata.totalUrls, 0, 'Metadata should default to zero totals before updates');

  assert.equal(
    existsSync(session.sessionCsv),
    false,
    'Session storage must not create filesystem artifacts',
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
