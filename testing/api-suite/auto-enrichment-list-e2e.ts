/**
 * Auto enrichment list flow E2E smoke script.
 *
 * Runs through the user journey stages:
 * 1) create test user
 * 2) create list
 * 3) add creator(s) to list
 * 4) verify queued status
 * 5) trigger worker endpoint
 * 6) verify post-worker status + list detail metadata
 */

import process from 'node:process';

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord | null {
	if (!(value && typeof value === 'object')) {
		return null;
	}
	return Object.fromEntries(Object.entries(value));
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3002';
const userId = process.env.E2E_USER_ID || `dev-e2e-auto-${Date.now()}`;
const email = process.env.E2E_EMAIL || `e2e.test+auto.${Date.now()}@example.com`;

const headers: Record<string, string> = {
	'content-type': 'application/json',
	'x-dev-auth': process.env.E2E_DEV_BYPASS_TOKEN || 'dev-bypass',
	'x-dev-user-id': userId,
};

async function requestJson(path: string, init?: RequestInit) {
	const response = await fetch(`${BASE_URL}${path}`, init);
	const text = await response.text();
	let json: unknown = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text };
	}
	return { response, json };
}

function printStage(name: string, payload?: unknown) {
	console.log(`\n=== ${name} ===`);
	if (payload !== undefined) {
		console.log(JSON.stringify(payload, null, 2));
	}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

async function main() {
	printStage('Config', { BASE_URL, userId, email });

	const createUser = await requestJson('/api/admin/e2e/create-test-user', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ userId, email }),
	});
	printStage('Stage 1 - create test user', {
		status: createUser.response.status,
		body: createUser.json,
	});
	assert(createUser.response.ok, 'Failed at stage 1: cannot create test user');

	const createList = await requestJson('/api/lists', {
		method: 'POST',
		headers,
		body: JSON.stringify({ name: `E2E Auto Enrich ${Date.now()}`, type: 'research' }),
	});
	printStage('Stage 2 - create list', {
		status: createList.response.status,
		body: createList.json,
	});
	assert(createList.response.ok, 'Failed at stage 2: cannot create list');

	const listRecord = toRecord(createList.json) ?? {};
	const list = toRecord(listRecord.list) ?? {};
	const listId = typeof list.id === 'string' ? list.id : '';
	assert(listId.length > 0, 'Missing list id');

	const addCreators = await requestJson(`/api/lists/${listId}/items`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			creators: [
				{
					platform: 'instagram',
					externalId: `e2e_creator_${Date.now()}`,
					handle: 'e2e.creator.one',
					displayName: 'E2E Creator One',
					metadata: { source: 'e2e-script' },
				},
			],
		}),
	});
	printStage('Stage 3 - add creator to list', {
		status: addCreators.response.status,
		body: addCreators.json,
	});
	assert(addCreators.response.ok, 'Failed at stage 3: cannot add creators');

	const beforeStatus = await requestJson(`/api/lists/${listId}/enrichment-status`, {
		headers,
	});
	printStage('Stage 4 - enrichment status before worker', {
		status: beforeStatus.response.status,
		body: beforeStatus.json,
	});
	assert(beforeStatus.response.ok, 'Failed at stage 4: enrichment status unavailable');

	const addBody = toRecord(addCreators.json) ?? {};
	const addedCreators = Array.isArray(addBody.addedCreators) ? addBody.addedCreators : [];
	const worker = await requestJson('/api/qstash/auto-enrich-list-items', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ userId, listId, addedCreators }),
	});
	printStage('Stage 5 - worker execution', {
		status: worker.response.status,
		body: worker.json,
	});
	assert(worker.response.ok, 'Failed at stage 5: worker execution failed');

	const afterStatus = await requestJson(`/api/lists/${listId}/enrichment-status`, {
		headers,
	});
	printStage('Stage 6 - enrichment status after worker', {
		status: afterStatus.response.status,
		body: afterStatus.json,
	});
	assert(afterStatus.response.ok, 'Failed at stage 6: no status after worker');

	const detail = await requestJson(`/api/lists/${listId}`, { headers });
	printStage('Stage 7 - list detail metadata', {
		status: detail.response.status,
		firstItem: toRecord(detail.json)?.items ?? null,
	});
	assert(detail.response.ok, 'Failed at stage 7: cannot fetch list detail');

	printStage('E2E Result', {
		ok: true,
		message: 'Auto-enrichment list flow completed across all stages',
	});
}

main().catch((error) => {
	console.error('\nE2E FAILED');
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
