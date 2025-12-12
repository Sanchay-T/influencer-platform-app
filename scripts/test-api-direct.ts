/**
 * Direct API Test Script
 * Tests YouTube and Instagram APIs directly to verify they work
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load from .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.SCRAPECREATORS_API_KEY;
const BASE_URL = 'https://api.scrapecreators.com';

async function testYouTube() {
	console.log('\n=== Testing YouTube Search API ===');
	const url = `${BASE_URL}/v1/youtube/search?query=fitness`;

	console.log('URL:', url);
	console.log('Starting request...');

	const start = Date.now();
	try {
		const response = await fetch(url, {
			headers: { 'x-api-key': API_KEY || '' },
			signal: AbortSignal.timeout(60_000),
		});

		const duration = Date.now() - start;
		console.log(`Response status: ${response.status} (${duration}ms)`);

		if (response.ok) {
			const data = await response.json();
			const videos = data?.videos ?? [];
			console.log(`Videos found: ${videos.length}`);
			if (videos.length > 0) {
				console.log('First video channel:', videos[0]?.channel?.title);
			}
		} else {
			const text = await response.text();
			console.log('Error response:', text.substring(0, 200));
		}
	} catch (error) {
		const duration = Date.now() - start;
		console.log(`Error after ${duration}ms:`, error instanceof Error ? error.message : error);
	}
}

async function testInstagram() {
	console.log('\n=== Testing Instagram Reels API ===');
	const url = `${BASE_URL}/v1/instagram/reels/search?query=fitness&amount=5`;

	console.log('URL:', url);
	console.log('Starting request...');

	const start = Date.now();
	try {
		const response = await fetch(url, {
			headers: { 'x-api-key': API_KEY || '' },
			signal: AbortSignal.timeout(120_000),
		});

		const duration = Date.now() - start;
		console.log(`Response status: ${response.status} (${duration}ms)`);

		if (response.ok) {
			const data = await response.json();
			console.log('Success:', data?.success);
			const reels = data?.reels ?? [];
			console.log(`Reels found: ${reels.length}`);
			if (reels.length > 0) {
				console.log('First reel owner:', reels[0]?.owner?.username);
			}
		} else {
			const text = await response.text();
			console.log('Error response:', text.substring(0, 200));
		}
	} catch (error) {
		const duration = Date.now() - start;
		console.log(`Error after ${duration}ms:`, error instanceof Error ? error.message : error);
	}
}

async function testTikTok() {
	console.log('\n=== Testing TikTok Search API ===');
	const url = `${BASE_URL}/v1/tiktok/search/keyword?keyword=fitness&region=US`;

	console.log('URL:', url);
	console.log('Starting request...');

	const start = Date.now();
	try {
		const response = await fetch(url, {
			headers: { 'x-api-key': API_KEY || '' },
			signal: AbortSignal.timeout(60_000),
		});

		const duration = Date.now() - start;
		console.log(`Response status: ${response.status} (${duration}ms)`);

		if (response.ok) {
			const data = await response.json();
			const items = data?.search_item_list ?? [];
			console.log(`Items found: ${items.length}`);
			if (items.length > 0) {
				console.log('First creator:', items[0]?.aweme_info?.author?.unique_id);
			}
		} else {
			const text = await response.text();
			console.log('Error response:', text.substring(0, 200));
		}
	} catch (error) {
		const duration = Date.now() - start;
		console.log(`Error after ${duration}ms:`, error instanceof Error ? error.message : error);
	}
}

async function main() {
	console.log('API Key loaded:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

	// Test all three in parallel
	await Promise.all([testTikTok(), testYouTube(), testInstagram()]);

	console.log('\n=== Tests complete ===');
}

main().catch(console.error);
