#!/usr/bin/env node
/**
 * Test CSV writer logic with mock data
 * Verifies that owner_handle is properly written to CSV
 */

import * as CsvWriter from './src/storage/csv-writer.js';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';

const TEST_CSV = '/tmp/test-owner-handle.csv';

// Clean up any existing test file
if (existsSync(TEST_CSV)) {
    unlinkSync(TEST_CSV);
}

console.log('🧪 CSV WRITER LOGIC TEST - Owner Handle Extraction\n');

// Step 1: Initialize CSV
console.log('Step 1: Initialize CSV...');
CsvWriter.initializeSessionCsv(TEST_CSV);
console.log('✅ CSV initialized\n');

// Step 2: Add URLs
console.log('Step 2: Add test URLs...');
const testUrls = [
    'https://www.instagram.com/reel/TEST123',
    'https://www.instagram.com/reel/TEST456',
    'https://www.instagram.com/reel/TEST789'
];
CsvWriter.appendUrls(TEST_CSV, testUrls, 'test_keyword');
console.log('✅ URLs added\n');

// Step 3: Update with mock post data (simulating scBatchPosts response)
console.log('Step 3: Update with mock post data...');
const mockPosts = [
    {
        url: 'https://www.instagram.com/reel/TEST123',
        shortcode: 'TEST123',
        caption: 'This is a test caption',
        owner_handle: 'testuser1',
        owner_name: 'Test User One',
        is_video: true,
        product_type: 'clips',
        views: 1000,
        taken_at_iso: '2025-10-10T00:00:00.000Z',
        thumbnail: 'https://example.com/thumb.jpg',
        location_name: 'New York, USA'
    },
    {
        url: 'https://www.instagram.com/reel/TEST456',
        shortcode: 'TEST456',
        caption: 'Another test',
        owner_handle: 'testuser2',  // This is what should be written
        owner_name: 'Test User Two',
        is_video: true,
        product_type: 'clips',
        views: 2000,
        taken_at_iso: '2025-10-10T00:00:00.000Z',
        thumbnail: 'https://example.com/thumb2.jpg',
        location_name: null
    },
    {
        url: 'https://www.instagram.com/reel/TEST789',
        shortcode: 'TEST789',
        caption: '',
        owner_handle: null,  // Test null case
        owner_name: null,
        is_video: true,
        product_type: 'clips',
        views: null,
        taken_at_iso: '2025-10-10T00:00:00.000Z',
        thumbnail: null,
        location_name: null
    }
];

CsvWriter.updatePostData(TEST_CSV, mockPosts);
console.log('✅ Post data updated\n');

// Step 4: Read and verify
console.log('Step 4: Read CSV and verify owner_handle...');
const csvContent = readFileSync(TEST_CSV, 'utf-8');
const rows = parse(csvContent, { columns: true, skip_empty_lines: true });

console.log('\n📊 CSV CONTENTS:');
console.log('═'.repeat(80));
rows.forEach((row: any, i: number) => {
    console.log(`\nRow ${i + 1}:`);
    console.log(`  URL: ${row.url}`);
    console.log(`  Keyword: ${row.keyword}`);
    console.log(`  Owner Handle: ${row.owner_handle || '❌ EMPTY'}`);
    console.log(`  Owner Name: ${row.owner_name || '❌ EMPTY'}`);
    console.log(`  Caption: ${row.caption?.substring(0, 30) || '❌ EMPTY'}`);
    console.log(`  Status: ${row.status}`);
});

console.log('\n═'.repeat(80));
console.log('🔍 VERIFICATION:');
console.log('═'.repeat(80));

const row1HasOwner = rows[0]?.owner_handle === 'testuser1';
const row2HasOwner = rows[1]?.owner_handle === 'testuser2';
const row3IsNull = rows[2]?.owner_handle === '' || !rows[2]?.owner_handle;

console.log(`Row 1 owner_handle: ${row1HasOwner ? '✅ CORRECT (testuser1)' : '❌ WRONG'}`);
console.log(`Row 2 owner_handle: ${row2HasOwner ? '✅ CORRECT (testuser2)' : '❌ WRONG'}`);
console.log(`Row 3 owner_handle: ${row3IsNull ? '✅ CORRECT (null/empty)' : '❌ WRONG'}`);

if (row1HasOwner && row2HasOwner && row3IsNull) {
    console.log('\n✅ CSV WRITER LOGIC IS WORKING CORRECTLY');
    console.log('   The issue must be with the ScrapeCreators API response');
} else {
    console.log('\n❌ CSV WRITER LOGIC HAS A BUG');
    console.log('   Owner handles are not being written properly');
}

console.log('\n═'.repeat(80));
console.log('🎯 CONCLUSION:');
console.log('═'.repeat(80));

console.log(`
If CSV writer is working:
  → The ScrapeCreators API is likely NOT returning owner data
  → Possible reasons:
    1. API rate limits hit (402 errors)
    2. trim=true parameter strips owner data
    3. API response structure changed
    4. Owner data not available for those specific reels

Next steps:
  1. Add credits to ScrapeCreators API
  2. Test with trim=false
  3. Add debug logging to scPost() function
  4. Check if owner data exists before filtering
`);

// Clean up
console.log('🧹 Cleaning up test file...');
unlinkSync(TEST_CSV);
console.log('✅ Test complete');
